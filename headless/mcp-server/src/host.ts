import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStoreFactory';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { registerAllTools } from '@/services/mcp/toolRegistry';
import { createMcpContext } from '@/services/mcp/context';
import { createAppBackupService } from '@/services/mcp/backupService';
import { fileToolDeps } from '@/services/mcp/tools/fileTools';
import { guideToolDeps } from '@/services/mcp/tools/guideTools';
import type { TextAssetFetch } from '@/utils/textAsset';
import type { McpContext } from '@/services/mcp/contracts';
import { createNodeFileFs } from './nodeFs';
import { installXmlDomParser } from './xmlDom';
import { createNodeBackupFs } from './backupFs';
import { createAppLock, platformDiscoveryDirs, type AppLock } from './appLock';
import { ifcFullWriteBlocked } from '@/state/ifcForeignGuard';

export const BACKUP_WITHHELD = 'No AI backup was made: this document comes from a file whose data from other programs this server ' +
  'cannot keep, so it writes no IFC for this document, not even a backup. The source file is untouched and stays the ' +
  'unchanged version.';

export interface HostOptions {
  root: string;
  dataDir: string;
  backup: boolean;
  readOnly: boolean;
  assets: Readonly<Record<string, string>>;
  open?: string | null;
  discoveryDirs?: readonly string[];
  isPathOpenInApp?: AppLock;
}

export type McpMessageHandler = (body: string, ctx: McpContext) => Promise<string>;

export interface HeadlessHost {
  app: AppStoreContext;
  root: string;
  dataDir: string;
  buildContext: () => McpContext;
  handleMessage: McpMessageHandler;
}

export function headlessInstructions(root: string): string {
  return [
    '',
    'Headless mode: no desktop app and no user interface; the schedule lives in memory and nobody else edits it.',
    `- Files only inside the working folder '${root}': "home folder" in tool texts means this folder, \`~/name.ifc\` is a file in it.`,
    '- No save or auto-save: write the active document with planner_export_ifc (`overwrite: true` replaces only a target without a building model or data from other programs); what you do not export is lost when the server stops.',
    '- While the desktop app runs, the server does not replace an existing file (SCOPE): use a new file name. Reading still works.',
  ].join('\n');
}

export function embeddedAssetFetch(assets: Readonly<Record<string, string>>): TextAssetFetch {
  return async (url) => {
    const key = url.replace(/^\/+/, '');
    const text = Object.prototype.hasOwnProperty.call(assets, key) ? assets[key] : undefined;
    return text === undefined
      ? { ok: false, status: 404, text: async () => '' }
      : { ok: true, status: 200, text: async () => text };
  };
}

function withHeadlessInstructions(rawBody: string, response: string, root: string): string {
  if (response === '') return response;
  try {
    const req = JSON.parse(rawBody) as { method?: unknown };
    if (!req || typeof req !== 'object' || req.method !== 'initialize') return response;
    const parsed = JSON.parse(response) as { result?: { instructions?: unknown } };
    if (!parsed.result || typeof parsed.result.instructions !== 'string') return response;
    parsed.result.instructions += `\n${headlessInstructions(root)}`;
    return JSON.stringify(parsed);
  } catch {
    return response;
  }
}

export async function createHeadlessHost(opts: HostOptions): Promise<HeadlessHost> {
  let root: string;
  try {
    root = await fsp.realpath(opts.root);
  } catch {
    throw new Error(`The working folder '${opts.root}' does not exist`);
  }
  if (!(await fsp.stat(root)).isDirectory()) throw new Error(`The working folder '${opts.root}' is not a folder`);

  installXmlDomParser();

  const app = createAppStoreContext({ emitHostEvents: false });
  app.store.setState((s) => { s.ui.featureFlags = { ifcForeignContent: true }; });

  const appLock = opts.isPathOpenInApp ?? createAppLock(opts.discoveryDirs ?? platformDiscoveryDirs());
  const fileFs = await createNodeFileFs(root, appLock);
  fileToolDeps.getFs = async () => fileFs;
  fileToolDeps.mainRouteUnlessForeign = true;
  guideToolDeps.fetchImpl = embeddedAssetFetch(opts.assets);
  registerAllTools();

  const backupService = createAppBackupService(app, {
    getFs: async () => createNodeBackupFs(opts.dataDir),
    autoBackupEnabled: async () => opts.backup,
  });
  const backup = {
    ensureBackup: backupService.ensureBackup,
    markDuplicateBorn: backupService.markDuplicateBorn,
    withheld: () => (ifcFullWriteBlocked(app.store.getState()) ? BACKUP_WITHHELD : null),
  };

  const buildContext = (): McpContext => createMcpContext(app, createMcpTransactions(app), backup);
  const handleMessage: McpMessageHandler = async (body, ctx) =>
    withHeadlessInstructions(body, await handleMcpMessage(body, ctx), root);

  async function openAtStart(file: string): Promise<void> {
    const target = path.resolve(root, file);
    const body = JSON.stringify({
      jsonrpc: '2.0', id: 'open-at-start', method: 'tools/call',
      params: { name: 'planner_import_schedule', arguments: { path: target } },
    });
    const response = JSON.parse(await handleMcpMessage(body, buildContext())) as {
      result?: { structuredContent?: { ok?: boolean; error?: string; code?: string } };
      error?: { message?: string };
    };
    const result = response.result?.structuredContent;
    if (!result || result.ok !== true) {
      throw new Error(`Could not open '${file}': ${result?.error ?? response.error?.message ?? 'unknown error'}`);
    }
  }

  if (opts.open) await openAtStart(opts.open);
  if (opts.readOnly) app.store.getState().setUI({ aiReadOnly: true });

  return { app, root, dataDir: opts.dataDir, buildContext, handleMessage };
}
