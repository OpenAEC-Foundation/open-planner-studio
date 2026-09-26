// AI-IMPORT × RESOURCEBIBLIOTHEEK — `planner_import_schedule` opent een projectbestand met dezelfde
// open-semantiek als Bestand → Openen en Recente bestanden (import/export-audit, bevinding 2).
//
// DE BUG DIE DIT VASTZET. `openFile`/`openRecentFile` gaven `linkedOpen: true` mee aan
// `applyLoadedProject`; de MCP-tool schreef zijn eigen opts-object en vergat die vlag. Een IFC met
// een bibliotheekkoppeling opende via de AI daardoor LOS (companyId/companyName en alle
// `libraryOrigin`-stempels gestript), terwijl `filePath` wél het bronpad werd. Twee gevolgen:
//   1. de eerstvolgende Ctrl+S schreef het gestripte document over het bronbestand — de koppeling
//      was stil en blijvend weg uit het bestand;
//   2. het bibliotheekslot gold niet meer: `planner_manage_resources` accepteerde een
//      tariefwijziging op een resource die uit de bibliotheek kwam, iets wat de gebruiker in het
//      resourcepaneel zelf niet eens kan.
// Sinds de fix lopen alle drie de echte open-paden door één store-actie (`openAsDocument`), die
// opslagdoel + `linkedOpen` samen zet; de tool bouwt geen eigen opts-object meer.
//
// Alles loopt via de ECHTE dispatcher (`handleMcpMessage`, dus óók de schemapoort), tegen de echte
// store; alleen de fs-rand is gefaked via `fileToolDeps.getFs` (in-memory, zoals cases-doc-file.ts).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join as joinPath, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { fileToolDeps, type McpFileFs } from '@/services/mcp/tools/fileTools';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

const S = () => useAppStore.getState();

// --- Fake fs (in-memory) -------------------------------------------------------------------------
const HOME = '/home/tester';
const files = new Map<string, string>();
const fs: McpFileFs = {
  homeDir: async () => HOME,
  exists: async (p) => files.has(p),
  writeTextFile: async (p, c) => { files.set(p, c); },
  readTextFile: async (p) => {
    const v = files.get(p);
    if (v === undefined) throw new Error(`ENOENT: ${p}`);
    return v;
  },
  readFile: async (p) => {
    const v = files.get(p);
    if (v === undefined) throw new Error(`ENOENT: ${p}`);
    return new TextEncoder().encode(v);
  },
};
fileToolDeps.getFs = async () => fs;

// --- Dispatch via rauwe JSON-RPC ------------------------------------------------------------------
let rpcId = 0;
/** `tools/call` door de echte dispatcher; geeft het (structured) toolresultaat terug. */
async function callTool(name: string, args: unknown, ctx: McpContext): Promise<McpToolResult> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }),
    ctx,
  );
  const resp = JSON.parse(raw);
  assert(resp.result !== undefined, `${name}: JSON-RPC-fout i.p.v. een toolresultaat: ${raw.slice(0, 300)}`);
  return resp.result.structuredContent as McpToolResult;
}
async function callOk(name: string, args: unknown, ctx: McpContext): Promise<McpToolOk> {
  const res = await callTool(name, args, ctx);
  assert(res.ok, `${name} gaf een fout: ${res.ok ? '' : res.error}`);
  return res as McpToolOk;
}

/** Reset naar één vers, leeg (pristine) document. */
function resetToSingleEmptyDocument(): void {
  for (const d of [...S().documents]) {
    if (d.id !== S().activeDocumentId) S().closeDocument(d.id);
  }
  S().closeDocument(S().activeDocumentId);
}

const SOURCE = `${HOME}/gekoppeld-project.ifc`;

/**
 * Een aan de resourcebibliotheek gekoppeld project met één gestempelde resource (tarief 65) en één
 * taak, als IFC in de fake fs op `SOURCE`. De bibliotheek zelf is app-globaal en blijft in de store
 * staan, precies zoals in de app wanneer de gebruiker een eigen project heropent.
 */
function writeLinkedSource(): { companyId: string; poolResId: string } {
  resetToSingleEmptyDocument();
  const companyId = S().addCompany('Testbedrijf');
  const poolResId = S().addPoolResource(companyId, {
    name: 'Kraanmachinist', type: 'LABOR', description: 'Bibliotheekafspraak', maxUnits: 2, costPerHour: 65,
  })!;
  S().bindProjectToCompany(companyId);
  S().addLibraryResourceToProject(companyId, poolResId);
  S().addTask({ name: 'Taak A' });
  S().runCPM();
  const content = writeIFC(buildWriteIFCInput(S()));
  // Nulmeting: het BRONBESTAND draagt de koppeling — anders bewijst de rest niets.
  assert(content.includes("'CompanyId'"), 'nulmeting: het bronbestand draagt de bibliotheekkoppeling (CompanyId)');
  assert(content.includes("'LibraryOrigin'"), 'nulmeting: het bronbestand draagt herkomststempels (LibraryOrigin)');
  files.set(SOURCE, content);
  resetToSingleEmptyDocument();
  return { companyId, poolResId };
}

/** De koppeling op het ACTIEVE document, zoals `applyLoadedProject(linkedOpen: true)` hem laat staan. */
function assertLinked(companyId: string, poolResId: string, label: string): void {
  const s = S();
  assertEq(s.project.companyId, companyId, `${label}: companyId blijft staan`);
  assertEq(s.project.companyName, 'Testbedrijf', `${label}: companyName blijft staan`);
  assertEq(s.resources.length, 1, `${label}: de ene resource is ingelezen`);
  const origin = s.resources[0].libraryOrigin;
  assert(!!origin, `${label}: de resource houdt zijn libraryOrigin-stempel`);
  assertEq(origin!.companyId, companyId, `${label}: stempel wijst naar de bibliotheek`);
  assertEq(origin!.libraryItemId, poolResId, `${label}: stempel wijst naar het bibliotheekitem`);
}

test('import_schedule (IFC) opent een gekoppeld project GEKOPPELD — zelfde semantiek als Bestand → Openen', async () => {
  const { companyId, poolResId } = writeLinkedSource();
  const ctx = makeMcpContext(appStoreContext);
  const res = await callOk('planner_import_schedule', { path: SOURCE }, ctx);
  const data = res.data as { filePath: string | null; reusedActiveTab: boolean; format: string };
  assertEq(data.format, 'IFC', 'IFC herkend');
  assertEq(data.reusedActiveTab, true, 'het lege starttabblad is hergebruikt');
  assertEq(S().filePath, SOURCE, 'het bronpad is het opslagdoel (Ctrl+S schrijft daarheen terug)');
  assertLinked(companyId, poolResId, 'na AI-import');
});

test('het bibliotheekslot geldt na een AI-import: tariefwijziging op een bibliotheekresource wordt geweigerd', async () => {
  writeLinkedSource();
  const ctx = makeMcpContext(appStoreContext);
  await callOk('planner_import_schedule', { path: SOURCE }, ctx);
  const resourceId = S().resources[0].id;
  // `ctx` draagt na de import het drift-anker van het importdocument (bindExpectedDoc).
  const res = await callOk('planner_manage_resources', {
    actions: [{ action: 'update', id: resourceId, costPerHour: 999 }],
  }, ctx);
  const rej = res.itemRejections ?? [];
  assertEq(rej.length, 1, `de tariefwijziging hoort per item geweigerd te worden, kreeg ${JSON.stringify(rej)}`);
  assert(rej[0].reason.includes('costPerHour'), `de weigering noemt het veld, kreeg: ${rej[0].reason}`);
  assertEq(S().resources[0].costPerHour, 65, 'het bibliotheektarief is ongewijzigd');
});

test('opnieuw opslaan na een AI-import behoudt de koppeling in het bronbestand', async () => {
  const { companyId, poolResId } = writeLinkedSource();
  const ctx = makeMcpContext(appStoreContext);
  await callOk('planner_import_schedule', { path: SOURCE }, ctx);

  // (a) Ctrl+S: `saveFile` schrijft `writeIFC(buildWriteIFCInput(state))` naar `filePath` (= SOURCE).
  assertEq(S().filePath, SOURCE, 'Ctrl+S-doel is het bronbestand');
  const ctrlS = writeIFC(buildWriteIFCInput(S()));
  assert(ctrlS.includes("'CompanyId'"), 'wat Ctrl+S terugschrijft draagt de bibliotheekkoppeling nog (CompanyId)');
  assert(ctrlS.includes("'LibraryOrigin'"), 'wat Ctrl+S terugschrijft draagt de herkomststempels nog (LibraryOrigin)');

  // (b) De AI-route: terugschrijven over het bronbestand en opnieuw openen — de koppeling overleeft.
  const exp = await callOk('planner_export_ifc', { path: SOURCE, overwrite: true }, ctx);
  assertEq((exp.data as { overwritten: boolean }).overwritten, true, 'het bronbestand is overschreven');
  const written = files.get(SOURCE)!;
  assert(written.includes("'CompanyId'") && written.includes("'LibraryOrigin'"),
    'het overschreven bronbestand draagt koppeling + stempels nog');
  resetToSingleEmptyDocument();
  await callOk('planner_import_schedule', { path: SOURCE }, makeMcpContext(appStoreContext));
  assertLinked(companyId, poolResId, 'na opslaan + heropenen');
});

// Broncode-check (naar het voorbeeld van tests/planning/check-recorded-dates.ts, 11c): de bug ontstond
// doordat een aanroeper buiten de store zijn EIGEN opts-object voor `applyLoadedProject` bouwde. Buiten
// de twee slices die de semantiek vastleggen (`openAsDocument`/voorbeelden in fileSlice, `loadState`
// in projectSlice) roept niemand `applyLoadedProject` rechtstreeks aan — een nieuw laadpad kiest
// bewust tussen `openAsDocument` (echt openen, gekoppeld) en `loadState` (los laden).
test('buiten fileSlice/projectSlice roept geen broncode `applyLoadedProject` rechtstreeks aan', () => {
  const kandidaten = [
    fileURLToPath(new URL('../../src/', import.meta.url).href),
    resolvePath(process.cwd(), 'src'),
  ];
  const srcRoot = kandidaten.find((p) => existsSync(p));
  assert(!!srcRoot, `de broncontrole vindt src/ (geprobeerd: ${kandidaten.join(', ')})`);
  const bestanden: string[] = [];
  const loop = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = joinPath(dir, entry.name);
      if (entry.isDirectory()) loop(full);
      else if (/\.tsx?$/.test(entry.name)) bestanden.push(full);
    }
  };
  loop(srcRoot!);
  assert(bestanden.length > 100, 'de broncontrole leest een plausibel aantal bronbestanden');
  const toegestaan = new Set(['state/slices/fileSlice.ts', 'state/slices/projectSlice.ts']);
  const aanroepers = bestanden
    .filter((f) => /\.applyLoadedProject\(/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(srcRoot!.length).replace(/^\/+/, '').split('\\').join('/'));
  assertEq(aanroepers.filter((f) => !toegestaan.has(f)), [],
    'gebruik `openAsDocument` (echt open-pad: opslagdoel + linkedOpen) of `loadState` (losse load), '
    + 'geen eigen `applyLoadedProject`-opts');
  assert(aanroepers.includes('state/slices/fileSlice.ts'), 'de check ziet de echte aanroeper (geen lege zoekactie)');
});

await run();
