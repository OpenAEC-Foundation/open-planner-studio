// De host van de headless MCP-server: één eigen storecontext plus de host-functies die in de app uit
// Tauri en de webview komen. Daarboven draait ONGEWIJZIGDE app-code: `handleMcpMessage` (dispatcher),
// de toolregistry met alle `planner_*`-tools, `runtime.ts` en `createRequestHandler`.
//
// Wat deze host invult (en de app anders):
//   - bestandstoegang      `fileToolDeps.getFs`   → `nodeFs.ts`, opgesloten in de werkmap (`--root`)
//   - MCP-backups          `createAppBackupService(app, { getFs, autoBackupEnabled })` → `backupFs.ts`
//   - gids en skills       `guideToolDeps.fetchImpl` → de in de bundel ingebedde teksten
//   - veiligheidsvlaggen   `ui.aiReadOnly` uit `--read-only`; `ui.aiPaused` blijft uit (geen knop)
//   - dialogen             bestaan niet: alle dialoogvlaggen in de ui-state blijven `false`
//   - XML-import           `globalThis.DOMParser` → `xmlDom.ts` (Node heeft er geen)
//
// SCHAKELSTUK (later, ontwerp "één plugin, drie situaties" op #570): `handleMessage` is de enige naad
// tussen de transports (stdio, HTTP) en de toolafhandeling: rauwe JSON-RPC in, rauwe JSON-RPC uit.
// Een schakelstuk komt daar vóór te staan en kiest per aanvraag tussen doorsturen naar de bridge van
// de app (als die draait) en deze headless afhandeling. De transports hoeven daarvoor niet te veranderen.
// Het slot ("weiger een bestand dat in de app open staat") zit in de bestandstoegang: `appLock.ts`.
//
// EÉN HOST PER PROCES: `fileToolDeps` en `guideToolDeps` zijn module-globals van de tools.
// Teksten die de agent leest zijn Engels; commentaar Nederlands.
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
import { createNodeFileFs, type NodeFsHooks } from './nodeFs';
import { installXmlDomParser } from './xmlDom';
import { createNodeBackupFs } from './backupFs';
import type { IsPathOpenInApp } from './appLock';

export interface HostOptions {
  /** Werkmap; moet bestaan. */
  root: string;
  /** Map voor de MCP-backups (`<dataDir>/ai-backups/…`). */
  dataDir: string;
  backup: boolean;
  readOnly: boolean;
  /** Ingebedde tekstbestanden, sleutel = pad binnen `public/` (bijv. `agent/planning-guide.md`). */
  assets: Readonly<Record<string, string>>;
  /** Bestand dat bij de start als document opengaat (pad in de werkmap). Dat is een keuze van wie de
   *  server start, niet van de agent: het gebeurt vóór `readOnly` ingaat. */
  open?: string | null;
  /** Slot-haak; standaard `isPathOpenInApp` uit `appLock.ts` (nu altijd `false`). */
  isPathOpenInApp?: IsPathOpenInApp;
  /** Alleen voor tests: haken in de bestandstoegang (`NodeFsHooks`). */
  fsHooks?: NodeFsHooks;
}

/** De naad voor een later schakelstuk: één JSON-RPC-bericht (rauw) met zijn context → het rauwe antwoord. */
export type McpMessageHandler = (body: string, ctx: McpContext) => Promise<string>;

export interface HeadlessHost {
  app: AppStoreContext;
  /** De `realpath` van de werkmap. */
  root: string;
  dataDir: string;
  buildContext: () => McpContext;
  handleMessage: McpMessageHandler;
}

/**
 * Extra uitleg in `initialize.instructions`, ná de vaste `MCP_INSTRUCTIONS` van de app. De tools en hun
 * beschrijvingen blijven gelijk aan de app; alleen dit kanaal vertelt de agent wat headless anders is.
 */
export function headlessInstructions(root: string): string {
  return [
    '',
    'Headless mode: this server runs without the Open Planner Studio desktop app, on a schedule in memory.',
    `- Files: the file tools only read and write inside the working folder '${root}'. Where a tool description says "home folder", read "working folder": \`~/name.ifc\` is a file in it, and absolute paths must stay inside it.`,
    '- Saving: there is no save command and no auto-save. Write the active document with planner_export_ifc (pass `overwrite: true` to replace the file you opened). Changes that you do not export are lost when the server stops.',
    '- There is no user interface: no dialogs, and nobody switches documents or edits next to you.',
  ].join('\n');
}

/** Een `fetch`-vervanger voor `fetchTextAsset` die alleen de ingebedde teksten kent. */
export function embeddedAssetFetch(assets: Readonly<Record<string, string>>): TextAssetFetch {
  return async (url) => {
    const key = url.replace(/^\/+/, '');
    const text = Object.prototype.hasOwnProperty.call(assets, key) ? assets[key] : undefined;
    return text === undefined
      ? { ok: false, status: 404, text: async () => '' }
      : { ok: true, status: 200, text: async () => text };
  };
}

/** Voeg de headless uitleg toe aan een geslaagd `initialize`-antwoord; al het andere blijft gelijk. */
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

  // Node heeft geen DOMParser; de MSPDI- en P6-XML-lezers van de app gebruiken hem (`xmlDom.ts`).
  installXmlDomParser();

  // Eén document zonder opslagdoel, zoals een nieuwe app-start. Geen host-events: extensies bestaan hier niet.
  const app = createAppStoreContext({ emitHostEvents: false });

  const fileFs = await createNodeFileFs(root, opts.isPathOpenInApp, opts.fsHooks);
  fileToolDeps.getFs = async () => fileFs;
  guideToolDeps.fetchImpl = embeddedAssetFetch(opts.assets);
  registerAllTools();

  const backupService = createAppBackupService(app, {
    getFs: async () => createNodeBackupFs(opts.dataDir),
    autoBackupEnabled: async () => opts.backup,
  });
  const backup = { ensureBackup: backupService.ensureBackup, markDuplicateBorn: backupService.markDuplicateBorn };

  // Zoals `buildMcpContext` in de app voor een eigen storecontext: per request een verse transactiefactory.
  const buildContext = (): McpContext => createMcpContext(app, createMcpTransactions(app), backup);
  const handleMessage: McpMessageHandler = async (body, ctx) =>
    withHeadlessInstructions(body, await handleMcpMessage(body, ctx), root);

  /** Open een bestand als document, via `planner_import_schedule` (dezelfde route als een agent). */
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
  // Pas ná het openen bij de start: alleen-lezen begrenst de agent, niet wie de server start.
  if (opts.readOnly) app.store.getState().setUI({ aiReadOnly: true });

  return { app, root, dataDir: opts.dataDir, buildContext, handleMessage };
}
