// Taak T22 — `planner_batch`: de batch-executor (spec §Compositie (1): `batch`).
//
// Draait headless tegen de ECHTE Zustand-store (via de harness) — geen mock van de store, wél EIGEN
// STUB-TOOLS: de echte mutatietools leven in andere banen en worden pas bij SYNC-2 samengevoegd.
// De executor is daarom registry-agnostisch: hij kent alleen `getTool()`, `def.batchable`,
// `def.kind` en de synchrone batch-kern (`batchStep`). De stubs hieronder spiegelen exact wat de
// echte tools zullen doen (o.a. `add_tasks` met zijn `created`-map).
//
// Bewezen contractpunten (spec §Compositie):
//   - één undo-snapshot over heterogene stappen; herberekening aan het eind;
//   - tussentijdse herberekening vóór een leesstap / `level_resources`-stap ná mutaties;
//   - gedeelde temp-id-namespace: `created`-maps herschrijven args van látere stappen (recursief);
//   - structurele stapfout (onbekende tool, McpStepError) ⇒ volledige rollback + rapport
//     (uitgevoerd/gefaald/niet bereikt);
//   - per-item-weigeringen zijn ZACHT: de batch loopt door en verzamelt ze prominent bovenaan;
//   - uitsluitingen (batch zelf, undo/redo, document-tools, save_baseline, tools zonder synchrone
//     batch-kern) worden vóór enige mutatie geweigerd;
//   - max 100 stappen; één backup-trigger met kind 'batch';
//   - de stappenloop is volledig SYNCHROON (statische assert op de eigen broncode).
import { useAppStore, test, assert, assertEq, run } from './harness';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import { readTools } from '@/services/mcp/tools/readTools';
import {
  batchTools, executeSteps, invokeStep, recomputeMidBatch, MAX_BATCH_STEPS,
  type BatchStepTool,
} from '@/services/mcp/tools/batchTool';
import { runMutateTool, McpStepError, type MutationOutcome } from '@/services/mcp/tools/runtime';
import type { McpContext, McpToolDef, McpToolResult } from '@/services/mcp/contracts';
import { draft } from '@/state/mcpTransaction';
import { createSnapshot } from '@/state/snapshot';

const store = useAppStore;

// Warm-up (zelfde reden als cases-transaction.ts/cases-runtime.ts): een verse store heeft
// `calendars: []`; het rollback-/restore-pad promoot de projectkalender-cache tot bibliotheek-entry.
// Door hier één edit te undo'en staat `cal-default` al in de bibliotheek, zodat een byte-identiek-
// assert die (benigne) promotie niet als store-verschil waarneemt.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

// ── Ctx-fabriek ──────────────────────────────────────────────────────────────────────────────────

interface BackupCall { docId: string; kind: McpToolDef['kind'] }
let backupCalls: BackupCall[] = [];

function makeCtx(over: Partial<McpContext> = {}): McpContext {
  return {
    expectedDocId: null,
    tempIdMap: new Map<string, string>(),
    paused: false,
    readOnly: false,
    ensureBackup: async (docId, kind) => { backupCalls.push({ docId, kind }); return null; },
    ...over,
  };
}

// ── Stub-tools ───────────────────────────────────────────────────────────────────────────────────

const MUT_ANNOT = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

/** Stub-mutatietool met een synchrone batch-kern (precies de vorm die de echte tools bij SYNC-2
 *  krijgen: kern los, `handler` = `runMutateTool` om diezelfde kern heen). */
function stubMutate(
  name: string,
  core: (args: unknown, ctx: McpContext) => MutationOutcome,
  over: Partial<BatchStepTool> = {},
): BatchStepTool {
  return {
    name,
    description: `stub-tool ${name} voor de batch-tests`,
    kind: 'mutate',
    batchable: true,
    inputSchema: { type: 'object' },
    annotations: { ...MUT_ANNOT },
    batchStep: core,
    handler: (args, ctx) => runMutateTool(ctx, 'mutate', () => core(args, ctx)),
    ...over,
  };
}

/** `add_tasks`-stub: maakt taken aan en levert de VOLLEDIGE tempId→realId-map als `data.created`
 *  (exact het contract van de echte `planner_add_tasks`, waar de temp-id-resolutie op leunt). */
const stubAddTasks = stubMutate('planner_stub_add_tasks', (args) => {
  const items = ((args as { tasks?: { tempId: string; name: string }[] })?.tasks) ?? [];
  const created: Record<string, string> = {};
  for (const it of items) created[it.tempId] = draft.addTask({ name: it.name });
  return { data: { created } };
});

/** Registreert de (al herschreven) args die de stap ontving — de spiegel voor de temp-id-resolutie. */
let lastRecordArgs: unknown = null;
const stubRecord = stubMutate('planner_stub_record', (args) => {
  lastRecordArgs = args;
  return { data: { received: args } };
});

/** Bulk-stap met één ZACHTE per-item-weigering: de stap slaagt, de weigering moet zichtbaar blijven. */
const stubReject = stubMutate('planner_stub_reject', () => ({
  data: { applied: 1 },
  itemRejections: [{ id: 'taak-9', reason: 'completion 140 valt buiten 0-100' }],
}));

/** Structurele stapfout met een expliciete code (spiegelt een kringverwijzing uit een echte tool). */
const stubCycle = stubMutate('planner_stub_cycle', () => {
  throw new McpStepError('CYCLE', 'kringverwijzing tussen A en B');
});

/** Legt een ECHTE kring aan (twee relaties over en weer). De solver ziet die pas bij de eerstvolgende
 *  herberekening — zo bewijzen we de `cpmResult.error`-worp uit `recomputeMidBatch`. */
const stubCycleEdges = stubMutate('planner_stub_cycle_edges', (args) => {
  const { a, b } = args as { a: string; b: string };
  draft.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  draft.addSequence({ predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
  return { data: { edges: 2 } };
});

/** Levert een `created`-map met een tempId die NIET aan de gereserveerde `tmp-`-syntax voldoet. */
const stubBadTempId = stubMutate('planner_stub_bad_tempid', () => ({
  data: { created: { Fundering: draft.addTask({ name: 'slechte-tempid' }) } },
}));

/** Verlengt een bestaande taak fors — zodat een volgende leesstap alleen mét tussentijdse
 *  herberekening een ANDER projecteinde ziet. */
const stubExtend = stubMutate('planner_stub_extend', (args) => {
  const { taskId, duration } = args as { taskId: string; duration: number };
  const t = store.getState().tasks.find((x) => x.id === taskId);
  if (!t) throw new McpStepError('NOT_FOUND', `onbekende taak ${taskId}`);
  draft.updateTaskFields(taskId, { time: { ...t.time, scheduleDuration: duration } });
  return { data: { taskId, duration } };
});

/** `level_resources`-stub: legt vast wat de planning-staat WAS op het moment dat de stap draaide. */
let levelSaw: { projectEnd: string | null; scheduleStale: boolean } | null = null;
const stubLevel = stubMutate('planner_level_resources', () => {
  const s = store.getState();
  levelSaw = { projectEnd: s.cpmResult?.projectEnd ?? null, scheduleStale: s.scheduleStale };
  return { data: { shifts: 0 } };
});

/** Uitgesloten via `batchable:false` (de echte `save_baseline` doet hetzelfde). */
const stubSaveBaseline = stubMutate('planner_save_baseline', () => ({ data: null }), { batchable: false });

/** Uitgesloten via `kind:'document'` én `batchable:false`. */
const stubDocument = stubMutate('planner_switch_document', () => ({ data: null }), {
  kind: 'document', batchable: false,
});

/** Uitgesloten via de expliciete naam-blocklist — ook al staat `batchable` (foutief) op true. */
const stubUndo = stubMutate('planner_undo', () => ({ data: null }), { kind: 'other', batchable: true });

/** Batchable, maar ZONDER synchrone batch-kern: alleen een async handler ⇒ niet batch-uitvoerbaar. */
const stubAsyncOnly: McpToolDef = {
  name: 'planner_stub_async_only',
  description: 'stub zonder synchrone batch-kern',
  kind: 'mutate',
  batchable: true,
  inputSchema: { type: 'object' },
  annotations: { ...MUT_ANNOT },
  handler: async (_args, ctx) => runMutateTool(ctx, 'mutate', () => ({ data: null })),
};

const stubs: McpToolDef[] = [
  stubAddTasks, stubRecord, stubReject, stubCycle, stubCycleEdges, stubBadTempId, stubExtend, stubLevel,
  stubSaveBaseline, stubDocument, stubUndo, stubAsyncOnly,
];

// De registry krijgt: de ECHTE leestools (de leesstap-tests draaien tegen `planner_get_project_info`),
// de batch-tool zelf (nodig voor de batch-in-batch-weigering) en de stubs hierboven.
registerToolModules([readTools, batchTools, stubs]);

const batchDef = batchTools[0];

interface Step { tool: string; args?: unknown }

/** Draai `planner_batch` met een verse ctx en geef het resultaat terug. */
async function runBatch(steps: Step[], over: Partial<McpContext> = {}): Promise<McpToolResult> {
  return batchDef.handler({ steps }, makeCtx(over));
}

/** Typehulp: de `data` van een geslaagde batch. */
interface BatchData {
  rejections: { id: string; reason: string }[];
  stepCount: number;
  steps: { step: number; tool: string; status: string; data?: unknown }[];
  substeps: { tool: string; ok: boolean; durationMs: number; ts: number; argsJson: string; resultJson: string }[];
}

const taskCount = () => store.getState().tasks.length;

// =================================================================================================
// 1) Eén undo-snapshot over drie heterogene stappen
// =================================================================================================
test('batch: 3 heterogene stappen ⇒ precies één undo-snapshot, één undo maakt alles ongedaan', async () => {
  backupCalls = [];
  const beforeTasks = taskCount();
  const beforeUndo = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const res = await runBatch([
    { tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-a1', name: 'batch-A' }, { tempId: 'tmp-a2', name: 'batch-B' }] } },
    { tool: 'planner_stub_record', args: { note: 'tussenstap' } },
    { tool: 'planner_get_project_info' },
  ]);

  assert(res.ok, `de batch hoort te slagen, kreeg: ${res.ok ? '' : res.error}`);
  assertEq(taskCount(), beforeTasks + 2, 'beide taken horen aangemaakt te zijn');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, beforeUndo + 1, 'de hele batch hoort ÉÉN undo-snapshot te pushen');

  store.getState().undo();
  assertEq(taskCount(), beforeTasks, 'één undo hoort de complete batch ongedaan te maken');
});

// =================================================================================================
// 2) Gedeelde temp-id-namespace: `created`-map herschrijft args van látere stappen (recursief)
// =================================================================================================
test('batch: tempId uit stap 1 wordt in geneste args van stap 2 vervangen door het echte id', async () => {
  backupCalls = [];
  lastRecordArgs = null;

  const res = await runBatch([
    { tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-fundering', name: 'Fundering' }] } },
    {
      tool: 'planner_stub_record',
      args: {
        direct: 'tmp-fundering',
        nest: { list: ['tmp-fundering', 'blijft-staan'], diep: { id: 'tmp-fundering' } },
      },
    },
  ]);

  assert(res.ok, `de batch hoort te slagen, kreeg: ${res.ok ? '' : res.error}`);
  const created = (res as { data: BatchData }).data.steps[0].data as { created: Record<string, string> };
  const realId = created.created['tmp-fundering'];
  assert(typeof realId === 'string' && realId.length > 0, 'stap 1 hoort een created-map terug te geven');

  const seen = lastRecordArgs as { direct: string; nest: { list: string[]; diep: { id: string } } };
  assertEq(seen.direct, realId, 'een directe string-waarde die exact de tempId is, hoort herschreven te zijn');
  assertEq(seen.nest.list[0], realId, 'ook binnen een array hoort de tempId herschreven te zijn');
  assertEq(seen.nest.list[1], 'blijft-staan', 'een onbekende string blijft ongemoeid');
  assertEq(seen.nest.diep.id, realId, 'ook diep genest hoort de tempId herschreven te zijn');
});

// =================================================================================================
// 3) Structurele stapfout: onbekende tool ⇒ volledige rollback + rapport per stap
// =================================================================================================
test('batch: onbekende tool ⇒ volledige rollback + rapport uitgevoerd/gefaald/niet bereikt', async () => {
  backupCalls = [];
  store.getState().runCPM();
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));
  const beforeUndo = store.getState().historyEvents.filter(event => event.state === 'applied').length;

  const res = await runBatch([
    { tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-x1', name: 'wordt-teruggerold' }] } },
    { tool: 'planner_bestaat_niet', args: {} },
    { tool: 'planner_stub_record', args: {} },
  ]);

  assert(!res.ok, 'een onbekende tool hoort de batch te laten falen');
  if (res.ok) return;
  assert(res.error.includes('planner_bestaat_niet'), `de fout hoort de onbekende toolnaam te noemen, kreeg: ${res.error}`);
  assert(res.error.includes('uitgevoerd (teruggedraaid)'), `het rapport hoort stap 1 als uitgevoerd-en-teruggedraaid te melden, kreeg: ${res.error}`);
  assert(res.error.includes('gefaald'), 'het rapport hoort de gefaalde stap te melden');
  assert(res.error.includes('niet bereikt'), 'het rapport hoort de niet-bereikte stap te melden');
  assertEq(JSON.stringify(createSnapshot(store.getState())), beforeSnap, 'de store hoort byte-identiek teruggerold te zijn');
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, beforeUndo, 'een teruggerolde batch mag geen undo-stap achterlaten');
});

// =================================================================================================
// 4) Structurele stapfout met expliciete code: McpStepError('CYCLE') ⇒ rollback + die code
// =================================================================================================
test('batch: McpStepError(CYCLE) in stap 2 ⇒ code CYCLE, volledige rollback', async () => {
  backupCalls = [];
  store.getState().runCPM();
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));

  const res = await runBatch([
    { tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-y1', name: 'rolt-terug' }] } },
    { tool: 'planner_stub_cycle', args: {} },
  ]);

  assert(!res.ok, 'de batch hoort te falen op de kringverwijzing');
  if (res.ok) return;
  assertEq(res.code, 'CYCLE', 'de expliciete McpStepError-code hoort te winnen');
  assert(res.error.includes('kringverwijzing tussen A en B'), 'de boodschap van de stap hoort mee te komen');
  assertEq(JSON.stringify(createSnapshot(store.getState())), beforeSnap, 'de store hoort schoon teruggerold te zijn');
});

// =================================================================================================
// 5) Per-item-weigering is ZACHT: de batch loopt door, weigeringen prominent bovenaan
// =================================================================================================
test('batch: per-item-weigering in stap 2 ⇒ batch slaagt, weigering prominent verzameld', async () => {
  backupCalls = [];
  lastRecordArgs = null;

  const res = await runBatch([
    { tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-z1', name: 'zacht-1' }] } },
    { tool: 'planner_stub_reject', args: {} },
    { tool: 'planner_stub_record', args: { na: 'de-weigering' } },
  ]);

  assert(res.ok, `een zachte weigering mag de batch niet laten falen, kreeg: ${res.ok ? '' : res.error}`);
  if (!res.ok) return;
  const data = res.data as BatchData;
  assertEq(Object.keys(data)[0], 'rejections', 'de weigeringen horen als EERSTE veld in de respons-data te staan (prominent bovenaan)');
  assertEq(data.rejections.length, 1, 'de weigering hoort verzameld te zijn');
  assert(data.rejections[0].reason.includes('stap 2'), `de weigering hoort zijn stap te noemen, kreeg: ${data.rejections[0].reason}`);
  assert(data.rejections[0].reason.includes('completion 140'), 'de originele reden hoort behouden te blijven');
  assertEq(res.itemRejections?.length, 1, 'de weigeringen horen óók op het contract-veld itemRejections te staan');
  assertEq(data.steps[2].status, 'uitgevoerd', 'stap 3 hoort gewoon gedraaid te zijn');
  assertEq((lastRecordArgs as { na: string }).na, 'de-weigering', 'stap 3 hoort zijn eigen args te hebben ontvangen');
});

// =================================================================================================
// 6) Max 100 stappen — geweigerd vóór enige transactie/backup
// =================================================================================================
test('batch: 101 stappen ⇒ VALIDATION, geen undo-snapshot en geen backup-trigger', async () => {
  backupCalls = [];
  const beforeUndo = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const steps: Step[] = [];
  for (let i = 0; i <= MAX_BATCH_STEPS; i++) steps.push({ tool: 'planner_stub_record', args: { i } });

  const res = await runBatch(steps);

  assert(!res.ok, 'meer dan 100 stappen hoort geweigerd te worden');
  if (!res.ok) {
    assertEq(res.code, 'VALIDATION', 'code hoort VALIDATION te zijn');
    assert(res.error.includes('100'), 'de fout hoort de limiet te noemen');
  }
  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, beforeUndo, 'een geweigerde batch mag geen undo-snapshot pushen');
  assertEq(backupCalls.length, 0, 'een geweigerde batch mag geen backup triggeren');
});

// =================================================================================================
// 7) Uitsluitingen: batch zelf, undo (naam-blocklist), document-tool en save_baseline (batchable:false)
// =================================================================================================
test('batch: uitgesloten tools (batch, undo, document, save_baseline) worden geweigerd vóór enige mutatie', async () => {
  const cases: { tool: string; waarom: string }[] = [
    { tool: 'planner_batch', waarom: 'een batch-in-batch' },
    { tool: 'planner_undo', waarom: 'undo (naam-blocklist, ondanks batchable:true)' },
    { tool: 'planner_switch_document', waarom: 'een document-tool' },
    { tool: 'planner_save_baseline', waarom: 'save_baseline (batchable:false)' },
  ];
  for (const c of cases) {
    backupCalls = [];
    const beforeTasks = taskCount();
    const beforeUndo = store.getState().historyEvents.filter(event => event.state === 'applied').length;
    const res = await runBatch([
      { tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-q1', name: 'mag-niet-ontstaan' }] } },
      { tool: c.tool, args: {} },
    ]);
    assert(!res.ok, `${c.waarom} hoort geweigerd te worden`);
    if (!res.ok) {
      assertEq(res.code, 'VALIDATION', `${c.waarom}: code hoort VALIDATION te zijn`);
      assert(res.error.includes(c.tool), `${c.waarom}: de fout hoort de toolnaam te noemen, kreeg: ${res.error}`);
    }
    assertEq(taskCount(), beforeTasks, `${c.waarom}: er mag niets uitgevoerd zijn`);
    assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, beforeUndo, `${c.waarom}: geen undo-snapshot`);
    assertEq(backupCalls.length, 0, `${c.waarom}: geen backup-trigger`);
  }
});

// =================================================================================================
// 8) Tussentijdse herberekening vóór een LEESSTAP die op mutaties volgt
// =================================================================================================
test('batch: leesstap ná mutaties ziet een VERSE planning (tussentijdse herberekening)', async () => {
  backupCalls = [];
  const id = store.getState().addTask({ name: 'verse-datums' });
  store.getState().runCPM();
  const endBefore = store.getState().cpmResult?.projectEnd ?? null;

  const res = await runBatch([
    { tool: 'planner_stub_extend', args: { taskId: id, duration: 400 } },
    { tool: 'planner_get_project_info' },
  ]);

  assert(res.ok, `de batch hoort te slagen, kreeg: ${res.ok ? '' : res.error}`);
  if (!res.ok) return;
  const data = res.data as BatchData;
  const info = data.steps[1].data as { schedule: { projectEnd: string | null; scheduleStale: boolean } };
  const endAfter = store.getState().cpmResult?.projectEnd ?? null;
  assert(endAfter !== endBefore, 'voorwaarde: de verlenging hoort het projecteinde te verzetten');
  assertEq(info.schedule.projectEnd, endAfter, 'de leesstap hoort het HERREKENDE projecteinde te zien, niet het oude');
  assertEq(info.schedule.scheduleStale, false, 'de leesstap hoort een verse planning te zien');
});

// =================================================================================================
// 9) Tussentijdse herberekening vóór een `level_resources`-stap die op mutaties volgt
// =================================================================================================
test('batch: level_resources-stap ná mutaties draait op een verse planning', async () => {
  backupCalls = [];
  levelSaw = null;
  const id = store.getState().addTask({ name: 'level-verse-basis' });
  store.getState().runCPM();
  const endBefore = store.getState().cpmResult?.projectEnd ?? null;

  const res = await runBatch([
    { tool: 'planner_stub_extend', args: { taskId: id, duration: 900 } },
    { tool: 'planner_level_resources', args: {} },
  ]);

  assert(res.ok, `de batch hoort te slagen, kreeg: ${res.ok ? '' : res.error}`);
  assert(levelSaw !== null, 'de level_resources-stap hoort gedraaid te zijn');
  assertEq(levelSaw!.projectEnd, store.getState().cpmResult?.projectEnd ?? null, 'level_resources hoort het herrekende projecteinde te zien');
  assert(levelSaw!.projectEnd !== endBefore, 'voorwaarde: het projecteinde is door de verlenging veranderd');
});

// =================================================================================================
// 10) Invariant: de stappenloop is volledig SYNCHROON (statische assert op de eigen broncode)
// =================================================================================================
test('batch: geen `await` in de stappenloop (statische assert) en geen async functies', () => {
  const src = [executeSteps, invokeStep, recomputeMidBatch].map((f) => f.toString()).join('\n');
  assert(!/\bawait\b/.test(src), 'de stappenloop (executeSteps/invokeStep/recomputeMidBatch) mag het woord `await` niet bevatten');
  for (const f of [executeSteps, invokeStep, recomputeMidBatch]) {
    assertEq(f.constructor.name, 'Function', `${f.name} moet een gewone (synchrone) functie zijn, geen AsyncFunction`);
  }
});

// =================================================================================================
// 11) Activiteitenlog: substeps per stap met tool/ok/duur + args/resultaat
// =================================================================================================
test('batch: respons draagt substeps met per stap tool, ok en duur', async () => {
  backupCalls = [];
  const res = await runBatch([
    { tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-s1', name: 'sub-1' }] } },
    { tool: 'planner_get_project_info' },
  ]);

  assert(res.ok, `de batch hoort te slagen, kreeg: ${res.ok ? '' : res.error}`);
  if (!res.ok) return;
  const data = res.data as BatchData;
  assertEq(data.substeps.length, 2, 'er hoort één substep per stap te zijn');
  assertEq(data.substeps[0].tool, 'planner_stub_add_tasks', 'de substep hoort de toolnaam te dragen');
  assertEq(data.substeps[1].tool, 'planner_get_project_info', 'de tweede substep hoort de leestool te noemen');
  for (const s of data.substeps) {
    assertEq(s.ok, true, 'een geslaagde stap hoort ok:true te melden');
    assert(typeof s.durationMs === 'number' && s.durationMs >= 0, 'elke substep hoort een duur te dragen');
    assert(typeof s.ts === 'number' && s.ts > 0, 'elke substep hoort een tijdstip te dragen');
    assert(typeof s.argsJson === 'string' && typeof s.resultJson === 'string', 'elke substep hoort args/resultaat als JSON te dragen');
  }
});

// =================================================================================================
// 12) Backup-trigger: de batch telt als ÉÉN muterende aanroep (kind 'batch')
// =================================================================================================
test('batch: precies één backup-trigger voor de hele batch, met kind batch', async () => {
  backupCalls = [];
  const res = await runBatch([
    { tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-b1', name: 'backup-1' }] } },
    { tool: 'planner_stub_record', args: {} },
    { tool: 'planner_stub_reject', args: {} },
  ]);

  assert(res.ok, `de batch hoort te slagen, kreeg: ${res.ok ? '' : res.error}`);
  assertEq(backupCalls.length, 1, 'een batch hoort precies ÉÉN backup te triggeren, nooit één per stap');
  assertEq(backupCalls[0].kind, 'batch', "de backup-trigger hoort kind 'batch' te melden");
});

// =================================================================================================
// 13) Args-validatie: geen array / leeg / stap zonder toolnaam
// =================================================================================================
test('batch: ongeldige steps-args ⇒ VALIDATION zonder enige mutatie', async () => {
  backupCalls = [];
  const beforeUndo = store.getState().historyEvents.filter(event => event.state === 'applied').length;
  const ctx = makeCtx();

  const geenArray = await batchDef.handler({ steps: 'nope' }, ctx);
  assert(!geenArray.ok && geenArray.code === 'VALIDATION', 'een niet-array `steps` hoort VALIDATION te geven');

  const leeg = await batchDef.handler({ steps: [] }, ctx);
  assert(!leeg.ok && leeg.code === 'VALIDATION', 'een lege `steps` hoort VALIDATION te geven');

  const geenTool = await batchDef.handler({ steps: [{ args: {} }] }, ctx);
  assert(!geenTool.ok && geenTool.code === 'VALIDATION', 'een stap zonder string-`tool` hoort VALIDATION te geven');

  assertEq(store.getState().historyEvents.filter(event => event.state === 'applied').length, beforeUndo, 'geen van de weigeringen mag een undo-snapshot pushen');
  assertEq(backupCalls.length, 0, 'geen van de weigeringen mag een backup triggeren');
});

// =================================================================================================
// 14) Een batchable tool ZONDER synchrone batch-kern is niet uitvoerbaar in een batch
// =================================================================================================
test('batch: tool zonder synchrone batch-kern ⇒ geweigerd vóór enige mutatie', async () => {
  backupCalls = [];
  const beforeTasks = taskCount();
  const res = await runBatch([
    { tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-n1', name: 'mag-niet-ontstaan' }] } },
    { tool: 'planner_stub_async_only', args: {} },
  ]);

  assert(!res.ok, 'een tool zonder synchrone batch-kern hoort geweigerd te worden');
  if (!res.ok) {
    assertEq(res.code, 'VALIDATION', 'code hoort VALIDATION te zijn');
    assert(res.error.includes('planner_stub_async_only'), 'de fout hoort de toolnaam te noemen');
  }
  assertEq(taskCount(), beforeTasks, 'er mag niets uitgevoerd zijn');
  assertEq(backupCalls.length, 0, 'er mag geen backup getriggerd zijn');
});

// =================================================================================================
// 15) Contract-vorm van de tool-definitie zelf
// =================================================================================================
test('planner_batch: definitie is kind batch, niet zelf batchable, met slot-leesstap-uitleg', () => {
  assertEq(batchDef.name, 'planner_batch', 'de tool hoort planner_batch te heten');
  assertEq(batchDef.kind, 'batch', "kind hoort 'batch' te zijn (stuurt de backup-trigger)");
  assertEq(batchDef.batchable, false, 'planner_batch mag nooit zelf als batch-stap draaien');
  assert(/slot/i.test(batchDef.description), 'de beschrijving hoort uit te leggen dat alleen een SLOT-leesstap zinvol is');
  assert(/100/.test(batchDef.description), 'de beschrijving hoort de limiet van 100 stappen te noemen');
});

// =================================================================================================
// 16) REGRESSIE I1 — vrije tekst blijft vrije tekst (de probe uit de review)
//     Een tempId die toevallig ook een taaknaam is, mocht die naam stil in een intern id veranderen.
//     Nu: alleen id-velden worden herschreven, alles onder een vrije-tekst-sleutel blijft letterlijk.
// =================================================================================================
test('batch: tempId-herschrijving raakt nooit vrije tekst (name/description/notes)', async () => {
  backupCalls = [];
  lastRecordArgs = null;

  const res = await runBatch([
    { tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-fundering', name: 'Fundering' }] } },
    {
      tool: 'planner_stub_record',
      args: {
        taskId: 'tmp-fundering',                  // id-veld ⇒ MOET herschreven worden
        name: 'tmp-fundering',                    // vrije tekst ⇒ moet letterlijk blijven
        description: 'werk aan tmp-fundering',    // bevat de tempId niet exact ⇒ hoe dan ook letterlijk
        notes: 'tmp-fundering',
        fields: { name: 'tmp-fundering', parentId: 'tmp-fundering' },
        tasks: [{ name: 'tmp-fundering' }],
        // De deny-list moet over de HELE subboom doorwerken, niet alleen op het eerste niveau.
        // Twee vormen die tot nu toe ongepind waren (eindintegratie):
        comment: { detail: 'tmp-fundering' },   // string TWEE niveaus onder een deny-sleutel
        label: ['tmp-fundering'],               // ARRAY direct onder een deny-sleutel
      },
    },
  ]);

  assert(res.ok, `de batch hoort te slagen, kreeg: ${res.ok ? '' : res.error}`);
  const created = (res as { data: BatchData }).data.steps[0].data as { created: Record<string, string> };
  const realId = created.created['tmp-fundering'];
  const seen = lastRecordArgs as {
    taskId: string; name: string; description: string; notes: string;
    fields: { name: string; parentId: string }; tasks: { name: string }[];
    comment: { detail: string }; label: string[];
  };

  assertEq(seen.taskId, realId, 'een id-veld hoort wél herschreven te worden');
  assertEq(seen.name, 'tmp-fundering', 'een `name` mag NOOIT herschreven worden (reviewprobe I1)');
  assertEq(seen.notes, 'tmp-fundering', 'een `notes`-veld mag nooit herschreven worden');
  assertEq(seen.description, 'werk aan tmp-fundering', 'een beschrijving blijft letterlijk');
  assertEq(seen.fields.name, 'tmp-fundering', 'ook genest onder `fields` blijft een naam letterlijk');
  assertEq(seen.fields.parentId, realId, 'een genest id-veld hoort wél herschreven te worden');
  assertEq(seen.tasks[0].name, 'tmp-fundering', 'een naam binnen een array van items blijft letterlijk');
  assertEq(seen.comment.detail, 'tmp-fundering', 'twee niveaus onder een deny-sleutel blijft óók letterlijk (subboom-propagatie)');
  assertEq(seen.label[0], 'tmp-fundering', 'een array-element onder een deny-sleutel blijft letterlijk');
});

// =================================================================================================
// 17) REGRESSIE I1c — de temp-id-map werkt niet door naar een VOLGENDE batch (zelfde ctx)
// =================================================================================================
test('batch: tempId uit een eerdere batch wordt in een volgende batch NIET herschreven', async () => {
  backupCalls = [];
  const ctx = makeCtx(); // ÉÉN ctx over twee batches — precies de sessie-situatie uit de review

  const eerste = await batchDef.handler({
    steps: [{ tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-cross', name: 'cross-1' }] } }],
  }, ctx);
  assert(eerste.ok, 'de eerste batch hoort te slagen');
  assertEq(ctx.tempIdMap.size, 0, 'de temp-id-map hoort ná de batch leeg te zijn');

  lastRecordArgs = null;
  const tweede = await batchDef.handler({
    steps: [{ tool: 'planner_stub_record', args: { taskId: 'tmp-cross' } }],
  }, ctx);
  assert(tweede.ok, 'de tweede batch hoort te slagen');
  assertEq((lastRecordArgs as { taskId: string }).taskId, 'tmp-cross',
    'een tempId uit een EERDERE batch mag in een volgende batch niet meer vervangen worden');
});

// =================================================================================================
// 18) REGRESSIE I1b — een tempId buiten de gereserveerde syntax faalt LUID (geen stille acceptatie)
// =================================================================================================
test('batch: created-map met een niet-conforme tempId ⇒ VALIDATION + volledige rollback', async () => {
  backupCalls = [];
  store.getState().runCPM();
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));

  const res = await runBatch([
    { tool: 'planner_stub_bad_tempid', args: {} },
    { tool: 'planner_stub_record', args: {} },
  ]);

  assert(!res.ok, 'een tempId zonder tmp-prefix hoort de batch te laten falen');
  if (!res.ok) {
    assertEq(res.code, 'VALIDATION', 'code hoort VALIDATION te zijn');
    assert(res.error.includes("'Fundering'"), 'de fout hoort de overtredende tempId te noemen');
    assert(res.error.includes('tmp-'), 'de fout hoort de gereserveerde syntax uit te leggen');
  }
  assertEq(JSON.stringify(createSnapshot(store.getState())), beforeSnap, 'de store hoort schoon teruggerold te zijn');
});

// =================================================================================================
// 19) REGRESSIE I2 — een GEFAALDE batch levert rapport én substeps gestructureerd terug
// =================================================================================================
test('batch: faalpad draagt steps + substeps in het data-veld van de fout', async () => {
  backupCalls = [];
  const res = await runBatch([
    { tool: 'planner_stub_add_tasks', args: { tasks: [{ tempId: 'tmp-fail', name: 'faal-1' }] } },
    { tool: 'planner_stub_cycle', args: {} },
    { tool: 'planner_stub_record', args: {} },
  ]);

  assert(!res.ok, 'de batch hoort te falen');
  if (res.ok) return;
  const data = res.data as { steps: BatchData['steps']; substeps: BatchData['substeps'] } | undefined;
  assert(data != null, 'een gefaalde batch hoort gestructureerde context in `data` te dragen');
  assertEq(data!.steps.map((s) => s.status), ['uitgevoerd', 'gefaald', 'niet bereikt'],
    'het gestructureerde rapport hoort per stap de status te dragen');
  assertEq(data!.substeps.length, 2, 'er horen substeps te zijn voor de uitgevoerde én de gefaalde stap');
  assertEq(data!.substeps[1].ok, false, 'de substep van de gefaalde stap hoort ok:false te melden');
  assert(res.error.includes('uitgevoerd (teruggedraaid)'), 'de leesbare samenvatting blijft in `error` staan');
});

// =================================================================================================
// 20) De `cpmResult.error`-worp uit de TUSSENTIJDSE herberekening (kring in stap 1, lezing in stap 2)
// =================================================================================================
test('batch: kring in stap 1 + leesstap ⇒ CYCLE uit de tussentijdse herberekening, alles terug', async () => {
  backupCalls = [];
  const a = store.getState().addTask({ name: 'kring-A' });
  const b = store.getState().addTask({ name: 'kring-B' });
  store.getState().runCPM();
  const beforeSnap = JSON.stringify(createSnapshot(store.getState()));

  const res = await runBatch([
    { tool: 'planner_stub_cycle_edges', args: { a, b } },
    { tool: 'planner_get_project_info' },
  ]);

  assert(!res.ok, 'een kring vóór een leesstap hoort de batch te laten falen');
  if (!res.ok) {
    assertEq(res.code, 'CYCLE', 'code hoort CYCLE te zijn');
    assert(res.error.includes('tussentijdse herberekening'), `de fout hoort de tussentijdse herberekening te noemen, kreeg: ${res.error}`);
    const data = res.data as { steps: BatchData['steps'] } | undefined;
    assertEq(data?.steps[1].status, 'gefaald', 'de leesstap hoort als gefaalde stap gerapporteerd te worden');
  }
  assertEq(JSON.stringify(createSnapshot(store.getState())), beforeSnap, 'de kring-relaties horen teruggerold te zijn');
});

await run();
