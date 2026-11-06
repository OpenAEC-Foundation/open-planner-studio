// Stap 1.10 (keuze 11, Ethan 2026-11-03; `docs/relaties-tussen-projecten.md`): de MCP-leestools geven de
// externe relaties terug, en `planner_refresh_external_links` ververst de ankers uit de bronbestanden.
//
// Wat deze cases vastleggen:
// 1. `planner_get_task`: de eigen koppelingen (`externalLinks`, altijd een lijst) en die van de fase erboven
//    (`inheritedExternalLinks`, met `fromTaskId`/`fromWbs`).
// 2. `planner_list_tasks`: het filter `externe_relaties`, het veld `ext` per rij, en `zonder_relaties` telt
//    een externe relatie als relatie (ook op een fase), net als `buildLogicIndex`.
// 3. `planner_get_project_info`: `statistics.externalRelations` en `externalSources` per bronproject.
// 4. `planner_refresh_external_links`: leest de bron één keer via de MCP-bestandsnaad (nep-fs in het geheugen),
//    zet de ankers in één undo-stap, meldt `changes`, telt een koppeling zonder pad als `manualLinks` (die
//    wordt alleen ververst als hetzelfde bronproject via een andere koppeling gelezen wordt, zoals in de app), weigert
//    een bron buiten de thuismap (`outOfScope`), weigert bij pauze en alleen-lezen zonder iets te lezen, en
//    geeft DOC_DRIFT als het actieve document wisselt terwijl de bron gelezen wordt. Een tweede aanroep op
//    dezelfde bron verandert niets.
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext, McpToolResult, McpToolOk, McpToolErr } from '@/services/mcp/contracts';
import { fileToolDeps, type McpFileFs } from '@/services/mcp/tools/fileTools';
import { createAppStoreContext } from '@/state/appStore';
import { readExternalSource } from '@/state/externalSource';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ExternalLink } from '@/types/task';

const S = () => useAppStore.getState();
const ctxWith = (over: McpContextOverrides = {}): McpContext => makeMcpContext(appStoreContext, over);

/** Via de echte `tools/call`-route, dus ook de schemapoort. */
let rpcId = 0;
async function rpc(name: string, args: unknown = {}, ctx: McpContext = ctxWith()): Promise<McpToolResult> {
  const raw = await handleMcpMessage(JSON.stringify({
    jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args },
  }), ctx);
  const response = JSON.parse(raw);
  assert(response.result !== undefined, `JSON-RPC-fout in plaats van toolresultaat: ${raw}`);
  return response.result.structuredContent as McpToolResult;
}
async function ok(name: string, args: unknown = {}, ctx?: McpContext): Promise<any> {
  const res = await rpc(name, args, ctx);
  assert(res.ok, `${name} gaf een fout: ${res.ok ? '' : `${(res as McpToolErr).code} ${(res as McpToolErr).error}`}`);
  return (res as McpToolOk).data;
}
async function err(name: string, args: unknown = {}, ctx?: McpContext): Promise<McpToolErr> {
  const res = await rpc(name, args, ctx);
  assert(!res.ok, `${name} had een fout moeten geven maar slaagde`);
  return res as McpToolErr;
}

// --- Nep-fs in het geheugen ----------------------------------------------------------------------

const HOME = '/home/tester';
const SOURCE = `${HOME}/projecten/Installateur.ifc`;
const OUTSIDE = '/elders/Sloper.ifc';
const files = new Map<string, string>();
const reads: string[] = [];
let onRead: (() => void) | null = null;

const fs: McpFileFs = {
  homeDir: async () => HOME,
  exists: async (p) => files.has(p),
  stat: async (p) => {
    const index = [...files.keys()].indexOf(p);
    if (index < 0) throw new Error(`ENOENT: ${p}`);
    return { isFile: true, dev: 1, ino: index + 1 };
  },
  writeTextFile: async (p, c) => { files.set(p, c); },
  readTextFile: async (p) => {
    reads.push(p);
    onRead?.();
    const v = files.get(p);
    if (v === undefined) throw new Error(`ENOENT: ${p}`);
    return v;
  },
  readFile: async (p) => {
    reads.push(p);
    onRead?.();
    const v = files.get(p);
    if (v === undefined) throw new Error(`ENOENT: ${p}`);
    return new TextEncoder().encode(v);
  },
};
fileToolDeps.getFs = async () => fs;

// --- De bron: Installateur, twee taken vanaf maandag 1 maart 2027 --------------------------------

// Eén bronstore voor alle versies: een echt bronbestand houdt zijn project-id en taak-id's bij opslaan.
const source = createAppStoreContext().store;
const B = () => source.getState();
B().newProject();
B().setProject({ startDate: '2027-03-01', name: 'Installateur' });
const installId = B().addTask({ name: 'Installatie', time: createDefaultTaskTime('2027-03-01', 5, 'days') });
const testId = B().addTask({ name: 'Testen', time: createDefaultTaskTime('2027-03-01', 2, 'days') });
B().addSequence({ predecessorId: installId, successorId: testId, type: 'FINISH_START', lagDays: 0 });

/** Reken de bron door en schrijf haar als IFC naar de nep-fs. */
function writeSource(): void {
  B().runCPM();
  files.set(SOURCE, writeIFC(buildWriteIFCInput(B())));
}

const io = { readTextFile: (p: string) => fs.readTextFile(p), readFile: (p: string) => fs.readFile(p) };

writeSource();
const first = await readExternalSource(SOURCE, io);
const installSrc = first.tasks.find(t => t.name === 'Installatie')!;
const testSrc = first.tasks.find(t => t.name === 'Testen')!;
assert(!!installSrc && !!testSrc, 'de bron heeft de taken Installatie en Testen');
reads.length = 0;

const link = (id: string, taskId: string, anchorDate: string, filePath: string | undefined, over: Partial<ExternalLink> = {}): Omit<ExternalLink, 'id'> & { id: string } => ({
  id, direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate, sourceMissing: false,
  sourceRef: {
    projectId: first.projectId, projectName: 'Installateur', taskId, taskName: 'Installatie',
    ...(filePath ? { filePath } : {}),
  },
  ...over,
});

// --- Het eigen plan: Aannemer ---------------------------------------------------------------------
//
// Fase "Afbouw" (koppeling op de fase, naar Installatie) met daaronder Stucwerk en Schilderwerk.
// Vloer heeft een eigen koppeling naar Testen, met 1 dag wachttijd. Gevel heeft een koppeling zonder pad
// (met de hand ingevoerd) naar hetzelfde bronproject. Dak heeft een koppeling naar een bron buiten de
// thuismap. Los heeft niets.

let ids: Record<string, string> = {};
function buildPlan(): void {
  S().newProject();
  S().setProject({ startDate: '2027-03-01', name: 'Aannemer' });
  const t = (name: string, parentId: string | null = null) =>
    S().addTask({ name, parentId, time: createDefaultTaskTime('2027-03-01', 3, 'days') });
  const afbouw = t('Afbouw');
  const stuc = t('Stucwerk', afbouw);
  const schilder = t('Schilderwerk', afbouw);
  const vloer = t('Vloer');
  const gevel = t('Gevel');
  const dak = t('Dak');
  const los = t('Los');
  const put = (taskId: string, l: ReturnType<typeof link>) => {
    const { id: _id, ...fields } = l;
    return S().addExternalLink(taskId, fields);
  };
  const afbouwLink = put(afbouw, link('', installSrc.id, '2027-03-01T16:00', SOURCE));
  const vloerLink = put(vloer, link('', testSrc.id, '2027-03-01T16:00', SOURCE, {
    lagDays: 1, sourceRef: { projectId: first.projectId, projectName: 'Installateur', taskId: testSrc.id, taskName: 'Testen', filePath: SOURCE },
  }));
  const gevelLink = put(gevel, link('', installSrc.id, '2027-03-01T16:00', undefined));
  const dakLink = put(dak, link('', 'x1', '2027-03-01T16:00', OUTSIDE, {
    sourceRef: { projectId: 'sloper', projectName: 'Sloper', taskId: 'x1', filePath: OUTSIDE },
  }));
  S().runCPM();
  ids = { afbouw, stuc, schilder, vloer, gevel, dak, los, afbouwLink, vloerLink, gevelLink, dakLink };
}
buildPlan();

const anchorOf = (taskId: string, linkId: string) =>
  S().tasks.find(t => t.id === taskId)!.externalLinks!.find(l => l.id === linkId)!.anchorDate;
const appliedSteps = () => S().historyEvents.filter(e => e.state === 'applied').length;

// --- 1. planner_get_task --------------------------------------------------------------------------

test('get_task: eigen koppelingen met richting, type, wachttijd, anker en bron', async () => {
  const data = await ok('planner_get_task', { taskId: ids.vloer });
  assertEq(data.externalLinks.length, 1, 'één eigen koppeling');
  const view = data.externalLinks[0];
  assertEq(view.linkId, ids.vloerLink, 'linkId');
  assertEq(view.direction, 'predecessor', 'richting');
  assertEq(view.type, 'FS', 'type');
  assertEq(view.lag, '+1d', 'wachttijd 1 dag');
  assertEq(view.anchorDate, '2027-03-01T16:00', 'anker');
  assertEq(view.sourceMissing, false, 'brontaak aanwezig');
  assertEq(view.source.projectId, first.projectId, 'bronproject');
  assertEq(view.source.taskId, testSrc.id, 'brontaak');
  assertEq(view.source.filePath, SOURCE, 'bronpad');
  assertEq(data.inheritedExternalLinks, undefined, 'geen fase erboven ⇒ geen geërfde koppelingen');
});

test('get_task: een taak in de fase erft de koppeling van de fase, met de fase erbij', async () => {
  const data = await ok('planner_get_task', { taskId: ids.stuc });
  assertEq(data.externalLinks, [], 'geen eigen koppeling ⇒ lege lijst');
  assertEq(data.inheritedExternalLinks.length, 1, 'één geërfde koppeling');
  assertEq(data.inheritedExternalLinks[0].linkId, ids.afbouwLink, 'de koppeling van Afbouw');
  assertEq(data.inheritedExternalLinks[0].fromTaskId, ids.afbouw, 'fromTaskId = de fase');
  assertEq(typeof data.inheritedExternalLinks[0].fromWbs, 'string', 'fromWbs is de WBS-code van de fase');
});

test('get_task: een taak zonder koppeling heeft een lege lijst en geen geërfde', async () => {
  const data = await ok('planner_get_task', { taskId: ids.los });
  assertEq(data.externalLinks, [], 'lege lijst');
  assertEq(data.inheritedExternalLinks, undefined, 'geen geërfde');
});

// --- 2. planner_list_tasks ------------------------------------------------------------------------

const names = (rows: Array<{ id: string }>) =>
  rows.map(r => S().tasks.find(t => t.id === r.id)!.name).sort();

test('list_tasks: externe_relaties true geeft de taken met een eigen of geërfde koppeling', async () => {
  const data = await ok('planner_list_tasks', { externe_relaties: true });
  assertEq(names(data.tasks), ['Afbouw', 'Dak', 'Gevel', 'Schilderwerk', 'Stucwerk', 'Vloer'], 'met externe relatie');
  const byName = new Map(data.tasks.map((r: any) => [S().tasks.find(t => t.id === r.id)!.name, r]));
  assertEq((byName.get('Stucwerk') as any).ext, 1, 'Stucwerk: ext 1 (geërfd)');
  assertEq((byName.get('Vloer') as any).ext, 1, 'Vloer: ext 1 (eigen)');
});

test('list_tasks: externe_relaties false geeft alleen de taak zonder', async () => {
  const data = await ok('planner_list_tasks', { externe_relaties: false });
  assertEq(names(data.tasks), ['Los'], 'zonder externe relatie');
  assertEq(data.tasks[0].ext, undefined, 'geen ext-veld zonder externe relatie');
});

test('list_tasks: zonder_relaties telt een externe relatie als relatie, ook op een fase', async () => {
  const data = await ok('planner_list_tasks', { zonder_relaties: true });
  assertEq(names(data.tasks), ['Los'], 'alleen Los is een wees');
});

test('list_tasks: externe_relaties moet een boolean zijn', async () => {
  const e = await err('planner_list_tasks', { externe_relaties: 'ja' });
  assertEq(e.code, 'VALIDATION', 'VALIDATION');
});

// --- 3. planner_get_project_info ------------------------------------------------------------------

test('get_project_info: aantal externe relaties en de bronprojecten', async () => {
  const data = await ok('planner_get_project_info');
  assertEq(data.statistics.externalRelations, 4, 'vier koppelingen');
  const sources = [...data.externalSources].sort((a: any, b: any) => `${a.projectId}${a.filePath ?? ''}`.localeCompare(`${b.projectId}${b.filePath ?? ''}`));
  assertEq(sources.length, 3, 'drie bronnen: Installateur met pad, Installateur zonder pad, Sloper');
  const withPath = sources.find((s: any) => s.projectId === first.projectId && s.filePath === SOURCE);
  assertEq(withPath?.links, 2, 'twee koppelingen naar Installateur met pad');
  assertEq(withPath?.sourceMissing, 0, 'geen ontbrekende brontaak');
  const manual = sources.find((s: any) => s.projectId === first.projectId && s.filePath === undefined);
  assertEq(manual?.links, 1, 'één koppeling zonder pad');
});

// --- 4. planner_refresh_external_links ------------------------------------------------------------

test('refresh: weigert bij pauze en bij alleen-lezen, zonder iets te lezen', async () => {
  reads.length = 0;
  assertEq((await err('planner_refresh_external_links', {}, ctxWith({ paused: true }))).code, 'PAUSED', 'pauze');
  assertEq((await err('planner_refresh_external_links', {}, ctxWith({ readOnly: true }))).code, 'READ_ONLY', 'alleen-lezen');
  assertEq(reads, [], 'geen bron gelezen');
});

test('refresh: weigert onbekende argumenten', async () => {
  const res = await rpc('planner_refresh_external_links', { pad: SOURCE });
  assert(!res.ok, 'een onbekend argument is een fout');
});

test('refresh: DOC_DRIFT als het actieve document wisselt tijdens het lezen; het plan blijft gelijk', async () => {
  const docId = S().activeDocumentId;
  const steps = appliedSteps();
  let other: string | null = null;
  onRead = () => { other ??= S().newDocument(); };
  try {
    const e = await err('planner_refresh_external_links');
    assertEq(e.code, 'DOC_DRIFT', 'DOC_DRIFT');
  } finally {
    onRead = null;
    S().switchDocument(docId);
    if (other) S().closeDocument(other);
  }
  assertEq(S().activeDocumentId, docId, 'terug in het eigen document');
  assertEq(anchorOf(ids.afbouw, ids.afbouwLink), '2027-03-01T16:00', 'anker onveranderd');
  assertEq(appliedSteps(), steps, 'geen undo-stap');
});

test('refresh: zet de ankers uit de bron in één undo-stap en meldt de wijzigingen', async () => {
  reads.length = 0;
  const steps = appliedSteps();
  const data = await ok('planner_refresh_external_links');
  assertEq(reads.filter(p => p === SOURCE).length, 1, 'de bron is één keer gelezen');
  assert(!reads.includes(OUTSIDE), 'de bron buiten de thuismap is niet gelezen');
  const bySource = new Map(data.sources.map((s: any) => [s.path, s]));
  assertEq((bySource.get(SOURCE) as any).status, 'read', 'bron gelezen');
  assertEq((bySource.get(SOURCE) as any).projectName, 'Installateur', 'met de projectnaam');
  assertEq((bySource.get(OUTSIDE) as any).status, 'outOfScope', 'bron buiten de thuismap');
  assertEq(data.manualLinks, 1, 'één koppeling zonder pad');
  // Gevel heeft geen pad, maar wijst naar hetzelfde bronproject: die wordt mee ververst (project-id eerst).
  assertEq(data.refreshed, 3, 'drie koppelingen ververst');
  // Installatie (5 dagen vanaf ma 1 maart) is klaar op vr 5 maart 16:00; Testen (2 dagen) op di 9 maart 16:00.
  assertEq(anchorOf(ids.afbouw, ids.afbouwLink), '2027-03-05T16:00', 'Afbouw: einde Installatie');
  assertEq(anchorOf(ids.vloer, ids.vloerLink), '2027-03-09T16:00', 'Vloer: einde Testen');
  assertEq(anchorOf(ids.gevel, ids.gevelLink), '2027-03-05T16:00', 'Gevel (zonder pad, zelfde bronproject): mee ververst');
  assertEq(anchorOf(ids.dak, ids.dakLink), '2027-03-01T16:00', 'Dak (buiten de thuismap): onveranderd');
  const changes = [...data.changes].sort((a: any, b: any) => a.taskName.localeCompare(b.taskName));
  assertEq(changes.map((c: any) => [c.taskName, c.anchorBefore, c.anchorAfter, c.sourceMissing]), [
    ['Afbouw', '2027-03-01T16:00', '2027-03-05T16:00', false],
    ['Gevel', '2027-03-01T16:00', '2027-03-05T16:00', false],
    ['Vloer', '2027-03-01T16:00', '2027-03-09T16:00', false],
  ], 'changes');
  assertEq(appliedSteps(), steps + 1, 'één undo-stap');
  // De transactie rekent door, zoals de app na verversen: Stucwerk (in Afbouw) begint na het nieuwe anker.
  assertEq(S().scheduleStale, false, 'doorgerekend');
  assertEq(S().tasks.find(t => t.id === ids.stuc)!.time.earlyStart, '2027-03-08T07:00', 'Stucwerk begint ma 8 maart');
});

test('refresh: een tweede aanroep op dezelfde bron verandert niets', async () => {
  const steps = appliedSteps();
  const data = await ok('planner_refresh_external_links');
  assertEq(data.changes, [], 'geen wijzigingen');
  assertEq(data.refreshed, 3, 'wel drie koppelingen gecontroleerd');
  assertEq(appliedSteps(), steps, 'geen nieuwe undo-stap');
});

test('refresh: undo zet de oude ankers terug', async () => {
  S().undo();
  assertEq(anchorOf(ids.afbouw, ids.afbouwLink), '2027-03-01T16:00', 'Afbouw terug');
  assertEq(anchorOf(ids.vloer, ids.vloerLink), '2027-03-01T16:00', 'Vloer terug');
  S().redo();
  assertEq(anchorOf(ids.afbouw, ids.afbouwLink), '2027-03-05T16:00', 'Afbouw weer nieuw');
});

test('refresh: een nieuwe versie van de bron schuift het anker; een verdwenen brontaak geeft sourceMissing', async () => {
  B().updateTask(installId, { time: createDefaultTaskTime('2027-03-01', 7, 'days') });
  writeSource();
  const data = await ok('planner_refresh_external_links');
  // Installatie 7 werkdagen vanaf ma 1 maart ⇒ klaar op di 9 maart 16:00.
  assertEq(anchorOf(ids.afbouw, ids.afbouwLink), '2027-03-09T16:00', 'Afbouw volgt de nieuwe bron');
  assert(data.changes.some((c: any) => c.linkId === ids.afbouwLink && c.anchorBefore === '2027-03-05T16:00'), 'change van Afbouw');

  // Een versie zonder Testen: de koppeling van Vloer houdt haar anker en krijgt sourceMissing.
  const vloerBefore = anchorOf(ids.vloer, ids.vloerLink);
  B().deleteTask(testId);
  writeSource();
  const after = await ok('planner_refresh_external_links');
  const vloer = after.changes.find((c: any) => c.linkId === ids.vloerLink);
  assertEq(vloer?.sourceMissing, true, 'Vloer: brontaak ontbreekt');
  assertEq(vloer?.anchorAfter, vloerBefore, 'Vloer houdt het laatst bekende anker');
  assertEq(after.missing, 1, 'missing telt de ontbrekende brontaak');
});

test('refresh: zonder externe relaties leest de tool niets en verandert niets', async () => {
  S().newProject();
  S().addTask({ name: 'Alleen', time: createDefaultTaskTime('2027-03-01', 1, 'days') });
  reads.length = 0;
  const steps = appliedSteps();
  const data = await ok('planner_refresh_external_links');
  assertEq(data, { sources: [], refreshed: 0, missing: 0, manualLinks: 0, changes: [] }, 'leeg resultaat');
  assertEq(reads, [], 'niets gelezen');
  assertEq(appliedSteps(), steps, 'geen undo-stap');
});

// --- 5. Review #813: een geweigerde of onleesbare bron krijgt geen anker van een andere bron --------------
//
// Letterlijk: twee IFC-versies met hetzelfde project-id en dezelfde taak-id's. Bron A staat in de
// gebruikersmap (Installatie klaar vr 5 maart 2027 16:00). Bron B staat erbuiten (anker vr 12 maart 2027
// 16:00). De tool leest alleen A en meldt B als `outOfScope`. De koppeling naar B moet haar anker en pad
// houden: de afhankelijke taak begint dan ma 15 maart, niet ma 8 maart. Hetzelfde voor een bron die niet te
// lezen is (`unreadable`).
const SOURCE_A = `${HOME}/projecten/Installateur-A.ifc`;
const sourceA = createAppStoreContext().store;
sourceA.getState().newProject();
sourceA.getState().setProject({ startDate: '2027-03-01', name: 'Installateur' });
const installA = sourceA.getState().addTask({ name: 'Installatie', time: createDefaultTaskTime('2027-03-01', 5, 'days') });
sourceA.getState().runCPM();
files.set(SOURCE_A, writeIFC(buildWriteIFCInput(sourceA.getState())));
const readA = await readExternalSource(SOURCE_A, io);
const installAId = readA.tasks.find(t => t.name === 'Installatie')!.id;
assert(installAId === installA || !!installAId, 'bron A heeft Installatie');

for (const [label, pathB] of [['outOfScope', '/elders/Installateur-B.ifc'], ['unreadable', `${HOME}/projecten/weg/Installateur-B.ifc`]] as const) {
  test(`refresh: een ${label}-bron met hetzelfde project-id houdt haar anker en pad`, async () => {
    S().newProject();
    S().setProject({ startDate: '2027-03-01', name: 'Aannemer' });
    const viaA = S().addTask({ name: 'Via A', time: createDefaultTaskTime('2027-03-01', 2, 'days') });
    const viaB = S().addTask({ name: 'Via B', time: createDefaultTaskTime('2027-03-01', 2, 'days') });
    const ref = (filePath: string) => ({
      projectId: readA.projectId, projectName: 'Installateur', taskId: installAId, taskName: 'Installatie', filePath,
    });
    const linkA = S().addExternalLink(viaA, {
      direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate: '2027-03-01T16:00', sourceMissing: false, sourceRef: ref(SOURCE_A),
    });
    const linkB = S().addExternalLink(viaB, {
      direction: 'predecessor', relType: 'FS', lagDays: 0, anchorDate: '2027-03-12T16:00', sourceMissing: false, sourceRef: ref(pathB),
    });
    S().runCPM();
    const linkOf = (taskId: string, linkId: string) => S().tasks.find(t => t.id === taskId)!.externalLinks!.find(l => l.id === linkId)!;
    const startOf = (taskId: string) => S().tasks.find(t => t.id === taskId)!.time.earlyStart;
    assertEq(startOf(viaB), '2027-03-15T07:00', 'opzet: Via B begint ma 15 maart');

    const data = await ok('planner_refresh_external_links');
    const statusOf = new Map(data.sources.map((x: any) => [x.path, x.status]));
    assertEq(statusOf.get(SOURCE_A), 'read', 'bron A gelezen');
    assertEq(statusOf.get(pathB), label, `bron B: ${label}`);
    assertEq(linkOf(viaA, linkA).anchorDate, '2027-03-05T16:00', 'Via A: het anker uit bron A');
    assertEq([linkOf(viaB, linkB).anchorDate, linkOf(viaB, linkB).sourceRef.filePath, linkOf(viaB, linkB).sourceMissing],
      ['2027-03-12T16:00', pathB, false], 'Via B: anker en pad blijven');
    assertEq(startOf(viaB), '2027-03-15T07:00', 'Via B begint nog steeds ma 15 maart');
    assertEq(data.refreshed, 1, 'alleen de koppeling naar A is ververst');
    assertEq(data.changes.map((c: any) => c.linkId), [linkA], 'alleen Via A staat in changes');
  });
}

await run();
