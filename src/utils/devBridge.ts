import { useAppStore } from '@/state/appStore';
import { appLog } from '@/services/debug/appLog';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { ifcSaveBlocked, refusedWriteTarget, type WriteTargetDeps } from '@/state/ifcForeignGuard';
import { isIfcxName, namesFollowFormat } from '@/state/ifcxGuard';
import { ifcxEnabled } from '@/utils/featureFlags';
import { fileIdentityFs, writeTargetReaders } from '@/services/fileAccess';
import {
  parseOpenedFile,
  readIFCWithXerReconstruction,
  readFormatInput,
  type FormatIO,
} from '@/services/formatRegistry';
import { isMultiDocumentImport } from '@/services/importTypes';
import { findIfcxModel } from '@/services/ifc/ifcxModelSession';
import { enableExtension, disableExtension, removeExtension, saveExtensionToDb, installFromZipBlob } from '@/extensions';
import type { ExpectedExtensionIdentity, InstallOutcome } from '@/extensions';
import type { ExtensionManifest, ReadyExtension } from '@/extensions/types';
import { parseExtensionManifest, parseStoredExtension } from '@/extensions/validation';
import {
  getAllExtensionRecordsFromDb,
  quarantineIdForStorageKey,
} from '@/extensions/extensionLoader';
import { setConsentAsker, resetConsentAsker, type ConsentAsker } from '@/extensions';
import { copyScreenshotToClipboard } from '@/services/feedback/feedbackService';
import { isTauri } from '@/utils/platform';
import { loadMcpPort, loadMcpToken } from '@/utils/settingsStore';
import { registerHelpArticles, resetRegisteredHelpArticles } from '@/utils/helpArticleRegistry';
import { dateX, lastSize, paintCount, taskBarPoint, taskSegmentCount } from '@/utils/ganttTestDriver';

type AppState = ReturnType<typeof useAppStore.getState>;

function counts(s: AppState) {
  return {
    tasks: s.tasks.length,
    sequences: s.sequences.length,
    resources: s.resources.length,
    assignments: s.assignments.length,
  };
}

function stateSnapshot(s: AppState) {
  return { project: s.project.name, isDirty: s.isDirty, cpm: !!s.cpmResult, ...counts(s) };
}

async function roundTrip() {
  const s = useAppStore.getState();
  const content = writeIFC(buildWriteIFCInput(s, 'planOnly'));
  const parsed = await readIFCWithXerReconstruction(content);
  const before = counts(s);
  const after = {
    tasks: parsed.tasks.length,
    sequences: parsed.sequences.length,
    resources: parsed.resources.length,
    assignments: parsed.assignments.length,
  };
  const lossless =
    before.tasks === after.tasks &&
    before.sequences === after.sequences &&
    before.resources === after.resources &&
    before.assignments === after.assignments;
  return { bytes: content.length, before, after, lossless };
}

export async function saveToPathWithIO(
  path: string,
  io: { writeTextFile: (path: string, content: string) => Promise<void> },
  targetDeps: WriteTargetDeps = { identityFs: fileIdentityFs, readers: writeTargetReaders },
) {
  const s = useAppStore.getState();
  if (ifcSaveBlocked(s)) throw new Error('saveToPath: het document heeft een vreemd deel (gebouwmodel); opslaan is nog niet mogelijk.');
  if (namesFollowFormat(s, s.ui.featureFlags) && isIfcxName(path)) throw new Error('saveToPath: deze route schrijft IFC; kies een pad op .ifc.');
  if (await refusedWriteTarget(s, { kind: 'path', path }, targetDeps)) {
    throw new Error('saveToPath: dit bestand bevat een gebouwmodel of gegevens van een ander programma; kies een ander pad.');
  }
  const content = writeIFC(buildWriteIFCInput(s, 'planOnly'));
  await io.writeTextFile(path, content);
  return { path, bytes: content.length };
}

async function saveToPath(path: string) {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  return saveToPathWithIO(path, { writeTextFile });
}

export async function openFromPathWithIO(path: string, io: FormatIO) {
  const readOptions = ifcxEnabled(useAppStore.getState().ui.featureFlags) ? { ifcx: true } : undefined;
  const input = await readFormatInput(path, io, readOptions);
  const parsed = await parseOpenedFile(input, undefined, readOptions);
  const ref = { kind: 'path', path } as const;
  if (!isMultiDocumentImport(parsed) && parsed.ifcxRead && parsed.ifcxReferences) {
    await findIfcxModel(parsed.ifcxReferences, ref, [], candidate => io.readFile(candidate), await fileIdentityFs());
  }
  const opened = useAppStore.getState().openAsDocument(parsed, { name: path, ref });
  return { path, ...opened, ...counts(useAppStore.getState()) };
}

async function openFromPath(path: string) {
  const { readTextFile, readFile } = await import('@tauri-apps/plugin-fs');
  return openFromPathWithIO(path, { readTextFile, readFile });
}

async function installExtensionFromCode(
  manifest: ExtensionManifest,
  mainCode: string,
  assets?: Record<string, Uint8Array>,
): Promise<ReadyExtension | undefined> {
  const parsed = parseExtensionManifest(manifest, 'fresh');
  if (!parsed.ok) throw new Error(parsed.error);
  const validatedManifest = parsed.value;
  await saveExtensionToDb({
    id: validatedManifest.id,
    manifest: validatedManifest,
    mainCode,
    enabled: true,
    ...(assets && Object.keys(assets).length > 0 ? { assets } : {}),
  });
  useAppStore.getState().registerReadyExtension({
    kind: 'ready',
    id: validatedManifest.id,
    manifest: validatedManifest,
    status: 'disabled',
  });
  await enableExtension(validatedManifest.id);
  return useAppStore.getState().installedExtensions[validatedManifest.id];
}

async function scanStoredExtensions(): Promise<Array<{
  storageKey: IDBValidKey;
  ok: boolean;
  reason?: string;
}>> {
  const records = await getAllExtensionRecordsFromDb();
  return records.map(({ storageKey, value }) => {
    const parsed = parseStoredExtension(value, storageKey);
    return parsed.ok
      ? { storageKey, ok: true }
      : { storageKey, ok: false, reason: parsed.error };
  });
}

export interface OpsCommand {
  id?: string;
  op: 'ping' | 'getState' | 'roundTrip' | 'save' | 'open' | 'dispatch' | 'feedbackTest' | 'mcpConnection' | 'mcpRestart' | 'mcpStop' | 'log';
  args?: Record<string, unknown>;
}

async function runOp(cmd: OpsCommand): Promise<Record<string, unknown>> {
  switch (cmd.op) {
    case 'ping': {
      const { appDataDir } = await import('@tauri-apps/api/path');
      return { ok: true, result: { pong: true, appDataDir: await appDataDir() } };
    }
    case 'getState':
      return { ok: true, result: stateSnapshot(useAppStore.getState()) };
    case 'roundTrip':
      return { ok: true, result: await roundTrip() };
    case 'save': {
      const path = cmd.args?.path as string | undefined;
      if (!path) return { ok: false, error: 'missing args.path' };
      return { ok: true, result: await saveToPath(path) };
    }
    case 'open': {
      const path = cmd.args?.path as string | undefined;
      if (!path) return { ok: false, error: 'missing args.path' };
      return { ok: true, result: await openFromPath(path) };
    }
    case 'dispatch': {
      const action = cmd.args?.action as string | undefined;
      const actionArgs = (cmd.args?.args as unknown[]) ?? [];
      const store = useAppStore.getState() as unknown as Record<string, unknown>;
      const fn = action ? store[action] : undefined;
      if (typeof fn !== 'function') return { ok: false, error: `no such action: ${action}` };
      const ret = await (fn as (...a: unknown[]) => unknown)(...actionArgs);
      return { ok: true, result: { ret, state: stateSnapshot(useAppStore.getState()) } };
    }
    case 'mcpConnection': {
      if (!import.meta.env.DEV) return { ok: false, error: 'mcpConnection is dev-only' };
      const ui = useAppStore.getState().ui;
      return {
        ok: true,
        result: { port: loadMcpPort(), token: loadMcpToken(), status: ui.aiServerStatus, aiMode: ui.aiMode },
      };
    }
    case 'mcpRestart': {
      if (!import.meta.env.DEV) return { ok: false, error: 'mcpRestart is dev-only' };
      const { stopMcpServer, startMcpServer } = await import('@/services/mcp/server');
      await stopMcpServer();
      await startMcpServer();
      return { ok: true, result: { status: useAppStore.getState().ui.aiServerStatus } };
    }
    case 'mcpStop': {
      if (!import.meta.env.DEV) return { ok: false, error: 'mcpStop is dev-only' };
      const { stopMcpServer } = await import('@/services/mcp/server');
      await stopMcpServer();
      return { ok: true, result: { status: useAppStore.getState().ui.aiServerStatus } };
    }
    case 'log': {
      if (!import.meta.env.DEV) return { ok: false, error: 'log is dev-only' };
      const channel = cmd.args?.channel as string | undefined;
      if (!channel) return { ok: false, error: 'missing args.channel' };
      return { ok: true, result: appLog.snapshot().filter(e => e.channel === channel).map(e => e.text) };
    }
    case 'feedbackTest': {
      const { domToPng } = await import('modern-screenshot');
      const root = document.getElementById('root') ?? document.body;
      const dataUrl = await domToPng(root);
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const outPath = await join(await appDataDir(), 'ops-test', 'feedback-capture.png');
      const [, b64] = dataUrl.split(',');
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await writeFile(outPath, bytes);
      let clipboardOk = false;
      let clipboardError: string | null = null;
      try {
        await copyScreenshotToClipboard(dataUrl);
        clipboardOk = true;
      } catch (e) {
        clipboardError = String(e);
      }
      return { ok: true, result: { pngPath: outPath, pngBytes: bytes.length, clipboardOk, clipboardError } };
    }
    default:
      return { ok: false, error: `unknown op: ${(cmd as OpsCommand).op}` };
  }
}

export async function serializeOpsTestResponse(cmd: OpsCommand): Promise<string> {
  const res = await runOp(cmd);
  return JSON.stringify({ id: cmd.id, ...res });
}

async function startOpsTestPoller(): Promise<void> {
  const { exists, readTextFile, writeTextFile, remove, mkdir } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');

  const baseDir = await join(await appDataDir(), 'ops-test');
  try { await mkdir(baseDir, { recursive: true }); } catch { }
  const cmdPath = await join(baseDir, 'cmd.json');
  const resPath = await join(baseDir, 'res.json');
  const readyPath = await join(baseDir, 'ready.json');
  try { await writeTextFile(readyPath, JSON.stringify({ ready: true, baseDir })); } catch { }
  appLog.emit('event', 'opsTest', `poller actief: ${baseDir}`);

  const tick = async (): Promise<void> => {
    try {
      if (!(await exists(cmdPath))) return;
      const raw = await readTextFile(cmdPath);
      await remove(cmdPath);
      let cmd: OpsCommand;
      try {
        cmd = JSON.parse(raw) as OpsCommand;
      } catch {
        await writeTextFile(resPath, JSON.stringify({ ok: false, error: 'invalid JSON' }));
        return;
      }
      await writeTextFile(resPath, await serializeOpsTestResponse(cmd));
    } catch (err) {
      try { await writeTextFile(resPath, JSON.stringify({ ok: false, error: String(err) })); } catch { }
    }
  };

  setInterval(() => { void tick(); }, 400);
}

export interface OpsDevBridge {
  store: typeof useAppStore;
  log: typeof appLog;
  gantt: {
    taskBarPoint: typeof taskBarPoint;
    taskSegmentCount: typeof taskSegmentCount;
    paintCount: typeof paintCount;
    lastSize: typeof lastSize;
    dateX: typeof dateX;
  };
  roundTrip: typeof roundTrip;
  saveToPath: typeof saveToPath;
  openFromPath: typeof openFromPath;
  extensions: {
    installFromCode: typeof installExtensionFromCode;
    scanStored: typeof scanStoredExtensions;
    quarantineIdForKey: typeof quarantineIdForStorageKey;
    installFromZip: (blob: Blob, expected?: ExpectedExtensionIdentity) => Promise<InstallOutcome>;
    consent: {
      set: (fn: (req: unknown) => Promise<boolean>) => void;
      reset: () => void;
    };
    enable: typeof enableExtension;
    disable: typeof disableExtension;
    remove: typeof removeExtension;
  };
  library: {
    state: () => {
      companies: number;
      defaultCompanyId: string;
      pools: Record<string, { version: number; cals: number; res: number }>;
    };
    addCompany: (name: string) => string;
    addResource: (companyId: string, poolResourceId: string) => { added: boolean; resourceId: string | null };
  };
  help: {
    registerArticles: typeof registerHelpArticles;
    resetArticles: typeof resetRegisteredHelpArticles;
  };
}

declare global {
  interface Window {
    __OPS__?: OpsDevBridge;
  }
}

export function installDevBridge(): void {
  if (typeof window === 'undefined') return;
  window.__OPS__ = {
    store: useAppStore,
    log: appLog,
    gantt: { taskBarPoint, taskSegmentCount, paintCount, lastSize, dateX },
    roundTrip,
    saveToPath,
    openFromPath,
    extensions: {
      installFromCode: installExtensionFromCode,
      scanStored: scanStoredExtensions,
      quarantineIdForKey: quarantineIdForStorageKey,
      installFromZip: (blob: Blob, expected?: ExpectedExtensionIdentity) =>
        installFromZipBlob(blob, expected, { assumeConsent: true }),
      consent: {
        set: (fn) => setConsentAsker(fn as unknown as ConsentAsker),
        reset: resetConsentAsker,
      },
      enable: enableExtension,
      disable: disableExtension,
      remove: removeExtension,
    },
    library: {
      state: () => {
        const s = useAppStore.getState();
        return {
          companies: s.companies.length,
          defaultCompanyId: s.defaultCompanyId,
          pools: Object.fromEntries(Object.entries(s.pools).map(([k, v]) => [k, { version: v.poolVersion, cals: v.calendars.length, res: v.resources.length }])),
        };
      },
      addCompany: (name: string) => useAppStore.getState().addCompany(name),
      addResource: (companyId: string, poolResourceId: string) => useAppStore.getState().addLibraryResourceToProject(companyId, poolResourceId),
    },
    help: {
      registerArticles: registerHelpArticles,
      resetArticles: resetRegisteredHelpArticles,
    },
  };
  appLog.emit('event', 'devBridge', 'window.__OPS__ klaar (dev-only self-test haak)');
  if (import.meta.env.DEV && isTauri()) void startOpsTestPoller();
}
