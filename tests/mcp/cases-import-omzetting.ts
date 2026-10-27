// AI-IMPORT VAN EEN OUD BESTAND (B5) — `planner_import_schedule` meldt de omzetting naar het
// minutenmodel in het antwoord.
//
// DE BUG DIE DIT VASTZET (aanval na #600, a10). Een IFC zonder `TimeModel` wordt bij het openen
// omgerekend (B5, "berekenen en melden"). De app meldt dat via het meldingenkanaal
// (`notifications.minuteModelConverted`), maar dat kanaal bereikt een MCP-client niet: het
// importantwoord zei alleen `ok: true`, `scheduleStale: false`. Een agent die daarna direct
// `planner_export_ifc` deed, schreef stil de nieuwe datums weg.
//
// Fixture `tests/planning/fixtures/b5-lopend-oude-writer.ifc`: geschreven met de bron van main
// `fbd4a3f9d` (vóór de urenomzetting). Eén taak van 5 werkdagen, 32% gereed, werkelijke start
// ma 1 juni 2026 07:00, statusdatum 3 juni; kalender ma–vr 07–12 en 13–16. In het bestand eindigt
// de taak vr 5 juni 16:00; de exacte rest (3,4 werkdagen) geeft ma 8 juni 10:12, dus 0,4 werkdag later.
//
// Alles via de ECHTE dispatcher (`handleMcpMessage`), tegen de echte store; alleen de fs-rand is
// gefaked via `fileToolDeps.getFs` (in-memory, zoals cases-import-bibliotheek.ts).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { fileToolDeps, type McpFileFs } from '@/services/mcp/tools/fileTools';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

const S = () => useAppStore.getState();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const LEGACY = readFileSync(join(ROOT, 'tests/planning/fixtures/b5-lopend-oude-writer.ifc'), 'utf8');

// --- Fake fs (in-memory) -------------------------------------------------------------------------
const HOME = '/home/tester';
const files = new Map<string, string>();
const fs: McpFileFs = {
  homeDir: async () => HOME,
  exists: async (p) => files.has(p),
  stat: async () => { throw new Error('Import vraagt geen bestandsidentiteit op'); },
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

let rpcId = 0;
async function callOk(name: string, args: unknown, ctx: McpContext): Promise<McpToolOk> {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }),
    ctx,
  );
  const resp = JSON.parse(raw);
  assert(resp.result !== undefined, `${name}: JSON-RPC-fout i.p.v. een toolresultaat: ${raw.slice(0, 300)}`);
  const res = resp.result.structuredContent as McpToolResult;
  assert(res.ok, `${name} gaf een fout: ${res.ok ? '' : res.error}`);
  return res as McpToolOk;
}

interface ImportData {
  documents: { documentId: string; minuteModelConversion?: { shiftedTasks: number; maxShiftWorkdays: number } }[];
  notice?: string;
}

/** Reset naar één vers, leeg (pristine) document. */
function resetToSingleEmptyDocument(): void {
  for (const d of [...S().documents]) {
    if (d.id !== S().activeDocumentId) S().closeDocument(d.id);
  }
  S().closeDocument(S().activeDocumentId);
}

const LEGACY_PATH = `${HOME}/oud-lopend.ifc`;
const MODERN_PATH = `${HOME}/nieuw-lopend.ifc`;
files.set(LEGACY_PATH, LEGACY);

test('de fixture is een oud bestand met het einde van vóór de omzetting', () => {
  const parsed = readIFC(LEGACY);
  assertEq(parsed.timeModel, undefined, 'geen TimeModel');
  assertEq(parsed.tasks[0].time.earlyFinish, '2026-06-05T16:00', 'einde in het bestand');
});

test('import van een oud bestand meldt de omzetting: aantal taken en grootste verschuiving', async () => {
  resetToSingleEmptyDocument();
  const res = await callOk('planner_import_schedule', { path: LEGACY_PATH }, makeMcpContext());
  const data = res.data as ImportData;
  assertEq(data.documents[0].minuteModelConversion, { shiftedTasks: 1, maxShiftWorkdays: 0.4 },
    'de inventaris noemt de omzetting');
  assert(data.notice?.includes('1 task has a different start or finish; the largest shift is 0.4 workdays'),
    `de notice zegt het aan de agent: ${data.notice}`);
  // Hetzelfde getal als de melding die de gebruiker in de app ziet: één bron, twee kanalen.
  const notice = S().ui.notifications.find(n => n.messageKey === 'notifications.minuteModelConverted');
  assertEq([notice?.params?.count, notice?.numberParams?.days], [1, 0.4], 'de app-melding telt hetzelfde');
  assertEq(S().tasks[0].time.earlyFinish, '2026-06-08T10:12', 'het openen rekende de exacte rest');
});

test('import van een nieuw bestand (met TimeModel) meldt niets', async () => {
  // De omgezette stand van de vorige test, zoals de app hem nu opslaat: met `TimeModel`.
  const modern = writeIFC(buildWriteIFCInput(S()));
  assertEq(readIFC(modern).timeModel, 'MINUTES-1', 'het nieuwe bestand draagt de markering');
  files.set(MODERN_PATH, modern);
  resetToSingleEmptyDocument();
  const res = await callOk('planner_import_schedule', { path: MODERN_PATH }, makeMcpContext());
  const data = res.data as ImportData;
  assertEq(data.documents[0].minuteModelConversion, undefined, 'geen omzetting in de inventaris');
  assertEq(data.notice, undefined, 'geen notice');
  assertEq(S().tasks[0].time.earlyFinish, '2026-06-08T10:12', 'dezelfde datum, nu zonder omzetting');
});

await run();
