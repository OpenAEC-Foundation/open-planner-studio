import { useAppStore } from '@/state/appStore';
import { appLog } from '@/services/debug/appLog';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import {
  parseOpenedFile,
  readIFCWithXerReconstruction,
  readFormatForFile,
  readFormatInput,
  saveTargetFor,
  type FormatIO,
} from '@/services/formatRegistry';
import { enableExtension, disableExtension, removeExtension, saveExtensionToDb, installFromZipBlob } from '@/extensions';
import type { InstallOutcome } from '@/extensions';
import type { ExtensionManifest, InstalledExtension } from '@/extensions/types';
import { setConsentAsker, resetConsentAsker, type ConsentAsker } from '@/extensions';
import { copyScreenshotToClipboard } from '@/services/feedback/feedbackService';
import { isTauri } from '@/utils/platform';

/**
 * Dev-only inspectie- en controle-haak voor geautomatiseerd zelf-testen.
 *
 * Tier 1 (browser-dev-build): hangt de Zustand-store en de log-bus op `window.__OPS__`,
 * plus `roundTrip()`/`saveToPath()`/`openFromPath()`. Een browser-automatiseringssessie
 * (Playwright MCP) leest/assert via `browser_evaluate`. De Gantt is een <canvas>, dus
 * state-inspectie — niet pixel-vergelijking — is de betrouwbare manier om te verifiëren.
 *
 * Tier 2 (échte Tauri-runtime): een bestandssysteem-controlekanaal. Een poller kijkt in
 * `<appDataDir>/ops-test/cmd.json`, voert de opdracht uit en schrijft `res.json`. Zo kan
 * een extern proces de draaiende desktop-app écht bestanden laten opslaan/openen op schijf
 * en elke store-actie aanroepen — zonder WebDriver, zonder sudo. De native bestand-picker
 * wordt omzeild door een expliciet pad mee te geven (standaard testpraktijk).
 *
 * STRIKT dev-only: aangeroepen achter `import.meta.env.DEV` (main.tsx) via dynamische import,
 * dus dit verdwijnt volledig uit productie-builds. De poller start alleen in de Tauri-runtime.
 */

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

/** Niveau 1 — serialiseer de huidige state naar IFC en parse 'm terug; meet dataverlies. Werkt ook in de browser. */
async function roundTrip() {
  const s = useAppStore.getState();
  const content = writeIFC(buildWriteIFCInput(s));
  // Geen `labels`: dev-only zelftesthaak (`window.__OPS__`), geen productie-UI — `readIFC` valt
  // terug op de Engelse default voor een bestand zonder IFCPROJECT (zie ImportLabels).
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

/** Niveau 2 — schrijf de huidige state als IFC naar een expliciet pad (dialoog omzeild). Tauri-only. */
async function saveToPath(path: string) {
  const s = useAppStore.getState();
  const content = writeIFC(buildWriteIFCInput(s));
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(path, content);
  return { path, bytes: content.length };
}

/** Niveau 2 — lees een bestand van schijf en laad het in de store (route op extensie). Tauri-only.
 *  Dev-only gedragsverbetering (T1): loopt nu via de formatRegistry, dus `.xml` wordt hier ook
 *  herkend (voorheen viel dat stil terug op IFC). T2: binaire formaten worden als bytes gelezen
 *  i.p.v. tekst. */
export async function openFromPathWithIO(path: string, io: FormatIO) {
  const input = await readFormatInput(path, io);
  const parsed = await parseOpenedFile(input);
  const target = saveTargetFor(readFormatForFile(path), { kind: 'path', path }, path);
  const opened = useAppStore.getState().applyOpenedImport(parsed, {
    filePath: target.filePath,
    fileHandle: target.fileHandle,
    recompute: true,
    fit: true,
    hourDataNotice: true,
    linkedOpen: true,
  });
  return { path, ...opened, ...counts(useAppStore.getState()) };
}

async function openFromPath(path: string) {
  const { readTextFile, readFile } = await import('@tauri-apps/plugin-fs');
  return openFromPathWithIO(path, { readTextFile, readFile });
}

/** Dev-only: installeer een extensie direct vanuit een code-string (voor zelftests). */
async function installExtensionFromCode(
  manifest: ExtensionManifest,
  mainCode: string,
): Promise<InstalledExtension | undefined> {
  await saveExtensionToDb({ id: manifest.id, manifest, mainCode, enabled: true });
  useAppStore.getState().registerExtension({ id: manifest.id, manifest, status: 'disabled' });
  await enableExtension(manifest.id);
  return useAppStore.getState().installedExtensions[manifest.id];
}

interface OpsCommand {
  id?: string;
  op: 'ping' | 'getState' | 'roundTrip' | 'save' | 'open' | 'dispatch' | 'feedbackTest';
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
      return { ok: true, result: roundTrip() };
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
      // Roep een willekeurige store-actie aan, bv. { action: 'addTask', args: [{ name: 'X' }] }.
      const action = cmd.args?.action as string | undefined;
      const actionArgs = (cmd.args?.args as unknown[]) ?? [];
      const store = useAppStore.getState() as unknown as Record<string, unknown>;
      const fn = action ? store[action] : undefined;
      if (typeof fn !== 'function') return { ok: false, error: `no such action: ${action}` };
      const ret = await (fn as (...a: unknown[]) => unknown)(...actionArgs);
      return { ok: true, result: { ret, state: stateSnapshot(useAppStore.getState()) } };
    }
    case 'feedbackTest': {
      // Dev-only desktop-verificatie van de feedback-feature: toetst (1) of
      // modern-screenshot's domToPng het Gantt-<canvas> meepakt in de echte
      // WebKitGTK-webview, en (2) of de klembord-weg (Image.new → writeImage)
      // werkt op de desktop. De PNG wordt naar schijf geschreven zodat de
      // aansturende kant 'm visueel kan inspecteren.
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

/**
 * Tier 2 poller: bestandssysteem-controlekanaal in de échte Tauri-runtime.
 * Leest `<appDataDir>/ops-test/cmd.json`, voert uit, schrijft `res.json`.
 */
async function startOpsTestPoller(): Promise<void> {
  const { exists, readTextFile, writeTextFile, remove, mkdir } = await import('@tauri-apps/plugin-fs');
  const { appDataDir, join } = await import('@tauri-apps/api/path');

  const baseDir = await join(await appDataDir(), 'ops-test');
  try { await mkdir(baseDir, { recursive: true }); } catch { /* bestaat al of door harness aangemaakt */ }
  const cmdPath = await join(baseDir, 'cmd.json');
  const resPath = await join(baseDir, 'res.json');
  const readyPath = await join(baseDir, 'ready.json');
  try { await writeTextFile(readyPath, JSON.stringify({ ready: true, baseDir })); } catch { /* niet fataal */ }
  appLog.emit('event', 'opsTest', `poller actief: ${baseDir}`);

  const tick = async (): Promise<void> => {
    try {
      if (!(await exists(cmdPath))) return;
      const raw = await readTextFile(cmdPath);
      await remove(cmdPath); // consumeer meteen, voorkom dubbele verwerking
      let cmd: OpsCommand;
      try {
        cmd = JSON.parse(raw) as OpsCommand;
      } catch {
        await writeTextFile(resPath, JSON.stringify({ ok: false, error: 'invalid JSON' }));
        return;
      }
      const res = await runOp(cmd);
      await writeTextFile(resPath, JSON.stringify({ id: cmd.id, ...res }));
    } catch (err) {
      try { await writeTextFile(resPath, JSON.stringify({ ok: false, error: String(err) })); } catch { /* leeg */ }
    }
  };

  setInterval(() => { void tick(); }, 400);
}

export interface OpsDevBridge {
  /** Zustand-store: gebruik `.getState()`, `.setState()`, `.subscribe()`. */
  store: typeof useAppStore;
  /** In-memory log-bus: `.snapshot()` geeft gelogde regels + opgevangen fouten. */
  log: typeof appLog;
  /** Niveau 1: serialiseer→parse round-trip, meet dataverlies (werkt ook in de browser). */
  roundTrip: typeof roundTrip;
  /** Niveau 2 (Tauri): schrijf de state als IFC naar een expliciet pad. */
  saveToPath: typeof saveToPath;
  /** Niveau 2 (Tauri): lees een bestand van schijf en laad het in de store. */
  openFromPath: typeof openFromPath;
  /** Dev-only extensie-haken voor zelftests. */
  extensions: {
    installFromCode: typeof installExtensionFromCode;
    /** Installeer via het echte ZIP-pad (parse → assets → opslaan → activeren), MET de
     *  vertrouwensvraag overgeslagen — een zelftest heeft geen mens die een dialoog wegklikt.
     *  De dialoog zelf test je via `__OPS__.extensions.consent`. */
    installFromZip: (blob: Blob, overrideId?: string) => Promise<InstallOutcome>;
    /** Haken op de toestemmingsvraag (K-item 38), zodat een zelftest zowel het toestaan- als het
     *  weigeren-pad kan aansturen zonder de echte dialoog. */
    consent: {
      set: (fn: (req: unknown) => Promise<boolean>) => void;
      reset: () => void;
    };
    enable: typeof enableExtension;
    disable: typeof disableExtension;
    remove: typeof removeExtension;
  };
  /** Dev-only bedrijfsbibliotheek-haken voor zelftests (B1). */
  library: {
    state: () => {
      companies: number;
      defaultCompanyId: string;
      pools: Record<string, { version: number; cals: number; res: number }>;
    };
    addCompany: (name: string) => string;
    addResource: (companyId: string, poolResourceId: string) => { added: boolean; resourceId: string | null };
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
    roundTrip,
    saveToPath,
    openFromPath,
    extensions: {
      installFromCode: installExtensionFromCode,
      installFromZip: (blob: Blob, overrideId?: string) =>
        installFromZipBlob(blob, overrideId, { assumeConsent: true }),
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
  };
  appLog.emit('event', 'devBridge', 'window.__OPS__ klaar (dev-only self-test haak)');
  if (isTauri()) void startOpsTestPoller();
}
