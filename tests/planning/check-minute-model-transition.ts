import { makeMcpContext } from '../mcp/harness';
import { resolveEffectiveLagDays } from '@/engine/scheduler/CPMSolver';
import { getTool } from '@/services/mcp/toolRegistry';
import type { DistributionProposal } from '@/services/library/distribute';
import type { TaskColumnId } from '@/types/taskGrid';
import type { McpToolResult } from '@/services/mcp/contracts';
import { capturePayload, hydratePayload } from '@/state/documentContract';
import { freshPayload } from '@/state/documentContract';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { sanitizeSchedulingProfile } from '@/services/ifc/schedulingOptionsRead';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { createMcpTransactions } from '@/state/runtime/createMcpTransactions';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import './domStub';
import { readIFC } from '@/services/ifc/ifcReader';
import { payloadFromImport } from '@/state/documentContract';
import { prepareLoadedPayload } from '@/state/documentActivation';
import { minuteModelTransition, normalizeRecordedTimes } from '@/state/minuteModelTransition';
import { migrateToMinuteModel } from '@/state/migrations/minuteModel';
import { externIfc } from '../fixtures/recordedDatesIfc';

let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}
const parsed = readIFC(externIfc('b5'));
const raw = migrateToMinuteModel(payloadFromImport(parsed, null)).payload;
raw.minuteModelPending = true;
// De eerste commit toetst het protocol los; de motor gaat in de volgende stap naar werkblokken.
const computed = prepareLoadedPayload(raw, { recompute: true });
const source = { times: Object.fromEntries(raw.tasks.map(t => [t.id, {
  start: t.time.earlyStart, finish: t.time.earlyFinish,
}])), total: raw.tasks.length };
const rawJson = JSON.stringify(raw);
const result = minuteModelTransition(raw, computed, source);
eq('invoer blijft intact', JSON.stringify(raw), rawJson);
eq('omzetting afgerond', result.after.minuteModelPending, false);
eq('vóór-toestand is opgeslagen modus', result.before.datesAsRecorded, true);
eq('vóór-toestand is niet verouderd', result.before.scheduleStale, false);
eq('vóór-toestand houdt de vlag', result.before.minuteModelPending, true);
eq('melding en strook tellen dezelfde taken', result.before.recordedDates?.shiftedTaskIds, result.shifted);
eq('verschuiving maakt gewijzigd', result.after.isDirty, true);
eq('zonder vlag geen overgang', minuteModelTransition({ ...raw, minuteModelPending: false }, computed).shifted, []);
eq('mislukte solve houdt vlag', minuteModelTransition(raw, { ...computed, cpmResult: { ...computed.cpmResult!, error: 'invalidStartDate' } }).after.minuteModelPending, true);
const normalized = normalizeRecordedTimes(raw, { times: { [raw.tasks[0].id]: { start: '2026-03-02', finish: '2026-03-06' } }, total: 1 });
eq('vastlegging start wordt D1', normalized.times[raw.tasks[0].id].start, '2026-03-02T07:00');
eq('vastlegging einde wordt D2', normalized.times[raw.tasks[0].id].finish, '2026-03-06T16:00');

// Echte laadroute: het vorige document mag nooit de vóór-snapshot worden.
const context = createAppStoreContext();
const store = context.store;
const load = readIFC(externIfc('b5-store'));
load.recordedTimesOrigin = 'ifc-own';
load.importPristine = false;
store.getState().addTask({ name: 'Vorig document' });
store.getState().applyLoadedProject(load, { recompute: true });
const bId = store.getState().tasks.find(t => t.name === 'B')!.id;
const bStart = () => store.getState().tasks.find(t => t.id === bId)!.time.earlyStart;
eq('laadroute rekent B', bStart(), '2026-03-09T07:00');
eq('laadroute één event', store.getState().historyEvents.length, 1);
eq('laadroute één omzettingsmelding', store.getState().ui.notifications.filter(n => n.messageKey === 'notifications.minuteModelConverted').length, 1);
eq('nieuwe save markeert minutenmodel', readIFC(writeIFC(buildWriteIFCInput(store.getState()))).timeModel, 'MINUTES-1');
store.getState().undo();
eq('undo geeft geladen B terug', bStart(), '2026-03-16T07:00');
eq('undo staat in modus', store.getState().datesAsRecorded, true);
eq('undo houdt vlag', store.getState().minuteModelPending, true);
eq('undo is niet verouderd', store.getState().scheduleStale, false);
eq('save na undo zonder markering', readIFC(writeIFC(buildWriteIFCInput(store.getState()))).timeModel, undefined);
eq('save na undo zonder bronformaat', readIFC(writeIFC(buildWriteIFCInput(store.getState()))).recordedSourceFormat, undefined);
const tx = createMcpTransactions(context);
eq('MCP naam slaagt', tx.run(() => tx.draft.updateTaskFields(bId, { name: 'B gewijzigd' })).ok, true);
eq('MCP naam houdt datums', bStart(), '2026-03-16T07:00');
eq('MCP naam houdt modus', store.getState().datesAsRecorded, true);
store.getState().undo();
eq('MCP undo houdt modus', store.getState().datesAsRecorded, true);
store.getState().runCPM();
eq('F5 rekent opnieuw', bStart(), '2026-03-09T07:00');
eq('F5 rondt vlag af', store.getState().minuteModelPending, false);
store.getState().undo();
eq('F5 undo geeft opgeslagen modus', bStart(), '2026-03-16T07:00');
const saved = writeIFC(buildWriteIFCInput(store.getState()));
store.getState().applyLoadedProject(readIFC(saved), { recompute: true });
eq('heropenen na undo rondt opnieuw af', bStart(), '2026-03-09T07:00');

// Projecteinde D2: maandag 16:00 geeft geen kunstmatige negatieve dag speling.
{
  const app = createAppStoreContext().store;
  const p = freshPayload();
  app.setState(s => {
    s.project = { ...p.project, startDate: '2026-06-01', endDate: '2026-06-01', schedulingOptions: { useProjectEndDateForFloat: true } };
    s.calendar = { ...p.calendar, workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [] };
    s.calendars = [];
  });
  const id = app.getState().addTask({ name: 'Eindtaak', time: createDefaultTaskTime('2026-06-01T08:00', 8, 'hours') });
  app.getState().runCPM();
  eq('projecteinde D2 late finish', app.getState().tasks.find(t => t.id === id)!.time.lateFinish, '2026-06-01T16:00');
  eq('projecteinde D2 speling', app.getState().tasks.find(t => t.id === id)!.time.totalFloat, 0);
  eq('projectdatums blijven invoer', [app.getState().project.startDate, app.getState().project.endDate], ['2026-06-01', '2026-06-01']);
  eq('T11 scalaire kalender heeft afgeleide blokken', [new CalendarEngine(app.getState().calendar).isHourMode, new CalendarEngine(app.getState().calendar).hasOwnWorkBlocks], [true, false]);
}
for (const id of ['ops', 'p6', 'msproject'] as const) {
  const profile = sanitizeSchedulingProfile({ ...builtInProfile(id), conventions: {} });
  eq(`T12 ontbrekende B6 volgt basis ${id}`, profile?.overrides.milestoneWithoutPredecessorAtDayEnd, undefined);
}


// Slapend herstel rekent een nog open omzetting niet stil op de achtergrond weg.
{
  const app = createAppStoreContext().store;
  const source = readIFC(externIfc('slapend'));
  source.recordedTimesOrigin = 'ifc-own'; source.importPristine = false;
  const current = { ...readIFC(externIfc('actief')), id: 'actief', filePath: null, isDirty: false, datesAsRecorded: false };
  app.getState().restoreDocuments([current, { ...source, id: 'slapend', filePath: null, isDirty: false, datesAsRecorded: false }], 'actief');
  const before = app.getState().documents.find(d => d.id === 'slapend')!.payload!;
  eq('slapend herstel houdt vlag', before.minuteModelPending, true);
  app.getState().recalculateStaleSleepingDocuments();
  eq('achtergrondberekening slaat open omzetting over', app.getState().documents.find(d => d.id === 'slapend')!.payload, before);
  app.getState().switchDocument('slapend');
  app.getState().runCPM();
  eq('activeren en berekenen rondt vlag af', app.getState().minuteModelPending, false);
  app.getState().undo();
  eq('undo na activeren houdt modus en vlag', [app.getState().datesAsRecorded, app.getState().minuteModelPending], [true, true]);
}

// Eerst bewerken en daarna Bereken: de bewerking en de overgang houden hun eigen undo-grens.
{
  const app = createAppStoreContext().store;
  app.setState(s => hydratePayload(s, raw));
  const b = app.getState().tasks.find(t => t.name === 'B')!;
  app.getState().updateTask(b.id, { name: 'B bewerkt vóór Bereken' });
  app.getState().runCPM();
  eq('bewerking vóór omzetting geeft twee events', app.getState().historyEvents.length, 2);
  app.getState().undo();
  const afterUndo = app.getState().tasks.find(t => t.id === b.id)!;
  eq('eerste undo houdt de bewerking in de opgeslagen modus', [afterUndo.name, afterUndo.time.earlyStart,
    app.getState().datesAsRecorded, app.getState().minuteModelPending], ['B bewerkt vóór Bereken', '2026-03-16T07:00', true, true]);
  app.getState().undo();
  eq('tweede undo geeft de toestand vóór de bewerking', app.getState().tasks.find(t => t.id === b.id)!.name, 'B');
}

// Een planningstransactie voegt de omzetting aan haar eigen event toe.
{
  const context = createAppStoreContext();
  const app = context.store;
  app.setState(s => hydratePayload(s, raw));
  const b = raw.tasks.find(t => t.name === 'B')!;
  const transaction = createMcpTransactions(context);
  eq('MCP met open omzetting slaagt', transaction.run(() => transaction.draft.updateTaskFields(b.id, { priority: 2 })).ok, true);
  eq('MCP en omzetting delen één event', app.getState().historyEvents.length, 1);
  eq('MCP met open omzetting meldt één verschuiving', app.getState().ui.notifications.filter(n => n.messageKey === 'notifications.minuteModelConverted').length, 1);
  eq('MCP met open omzetting rondt de vlag af', app.getState().minuteModelPending, false);
  app.getState().undo();
  eq('MCP undo zet invoer en open omzetting samen terug', [app.getState().tasks.find(t => t.id === b.id)!.priority,
    app.getState().tasks.find(t => t.id === b.id)!.time.earlyStart, app.getState().minuteModelPending],
    [b.priority, '2026-03-16T07:00', true]);
}

// Verdeling loopt door dezelfde route voor het actieve en het slapende document.
{
  const app = createAppStoreContext().store;
  app.setState(s => hydratePayload(s, raw));
  const sleepingId = app.getState().activeDocumentId;
  const activeId = app.getState().newDocument();
  app.setState(s => hydratePayload(s, raw));
  const b = raw.tasks.find(t => t.name === 'B')!;
  const proposal: DistributionProposal = {
    libraryItemId: 'minutenproef', blocked: null, hasShortfall: false,
    fixedLoadByDay: {}, residualByDay: {}, bookingByDay: {}, afterLoadByDay: {}, afterIncomplete: false,
    docs: [activeId, sleepingId].map(docId => ({
      docId, title: docId, participated: true, cannotMove: false,
      delays: { [b.id]: 1 }, gaps: {}, projectEndBefore: '2026-03-20', projectEndAfter: '2026-03-13',
      endShiftWorkdays: 0, shortfalls: [],
    })),
  };
  const applied = app.getState().applyDistribution(proposal, { [activeId]: [b.id], [sleepingId]: [b.id] });
  eq('verdeling met open omzetting slaagt', applied.ok, true);
  eq('verdeling schrijft één event per document', app.getState().historyEvents.length, 2);
  eq('verdeling rondt actieve en slapende vlag af', [app.getState().minuteModelPending,
    app.getState().documents.find(d => d.id === sleepingId)!.payload!.minuteModelPending], [false, false]);
  eq('verdeling meldt beide omzettingen', app.getState().ui.notifications.filter(n => n.messageKey === 'notifications.minuteModelConverted').length, 2);
  if (applied.ok) {
    const undone = app.getState().undoDistribution(applied.record);
    eq('verdeling terugdraaien raakt beide documenten', undone.undoneDocIds.slice().sort(), [activeId, sleepingId].sort());
    const active = app.getState(), sleeping = active.documents.find(d => d.id === sleepingId)!.payload!;
    eq('verdeling terugdraaien herstelt actieve datum en vertraging samen', [active.tasks.find(t => t.id === b.id)!.time.earlyStart,
      active.tasks.find(t => t.id === b.id)!.levelingDelay ?? 0, active.minuteModelPending], ['2026-03-16T07:00', 0, true]);
    eq('verdeling terugdraaien herstelt slapende datum en vertraging samen', [sleeping.tasks.find(t => t.id === b.id)!.time.earlyStart,
      sleeping.tasks.find(t => t.id === b.id)!.levelingDelay ?? 0, sleeping.minuteModelPending], ['2026-03-16T07:00', 0, true]);
  }
}

// B7 en I11: een halve werkdag blijft een halve werkdag, ook bij een dagvoorganger.
{
  const pred = { ...raw.tasks[0], time: { ...raw.tasks[0].time, scheduleDuration: 3 } };
  const seq = { id: 'lag', predecessorId: pred.id, successorId: 'B', type: 'FINISH_START' as const, lagDays: 0 };
  eq('B7 procentlag exact in de maat van de voorganger', resolveEffectiveLagDays({ ...seq, lagPercent: 50 }, pred, 8), 1.5);
  eq('I11 minutenlag naar een dagvoorganger blijft exact', resolveEffectiveLagDays({ ...seq, lagMinutes: 240 }, pred, 8), 0.5);
}

// Geen daadwerkelijke verschuiving: geen melding, event of vuile toestand.
{
  const app = createAppStoreContext().store;
  const text = writeIFC(buildWriteIFCInput({ ...computed, minuteModelPending: false }));
  const source = readIFC(text);
  delete source.timeModel;
  app.getState().applyLoadedProject(source, { recompute: true });
  eq('oud bestand zonder verschuiving heeft geen event', app.getState().historyEvents.length, 0);
  eq('oud bestand zonder verschuiving blijft schoon', app.getState().isDirty, false);
  eq('oud bestand zonder verschuiving krijgt geen melding', app.getState().ui.notifications.filter(n => n.messageKey === 'notifications.minuteModelConverted').length, 0);
  eq('oud bestand zonder verschuiving rondt de vlag af', app.getState().minuteModelPending, false);
  const modern = payloadFromImport({ ...source, timeModel: 'MINUTES-1' }, null);
  eq('nieuw bestand normaliseert een ankerdatum ook', modern.tasks[0].time.earlyStart.includes('T'), true);
  eq('nieuw bestand heeft geen open omzetting', modern.minuteModelPending, false);
}
// T17: ook een gewone rastercel normaliseert; dit mag niet alleen bij meerdere relatiewrites lopen.
{
  const app = createAppStoreContext().store;
  app.getState().setProject({ startDate: '2026-06-01', statusDate: '2026-06-10' });
  const id = app.getState().addTask({ name: 'Rasterdatum', time: createDefaultTaskTime('2026-06-01', 1) });
  const start = app.getState().runGridMutation([{ kind: 'cell-edit', taskId: id,
    columnId: 'task.time.actualStart' as TaskColumnId, route: 'task-progress', value: '2026-06-03' }]);
  eq('raster accepteert een oudere werkelijke start', start.ok, true);
  eq('raster normaliseert één cel met D1', app.getState().tasks.find(t => t.id === id)!.time.actualStart, '2026-06-03T07:00');
  const finish = app.getState().runGridMutation([{ kind: 'cell-edit', taskId: id,
    columnId: 'task.time.actualFinish' as TaskColumnId, route: 'task-progress', value: '2026-06-04' }]);
  eq('raster accepteert een ouder werkelijk einde', finish.ok, true);
  eq('raster normaliseert één cel met D2', app.getState().tasks.find(t => t.id === id)!.time.actualFinish, '2026-06-04T16:00');
}
async function finish() {
  // Het echte MCP-oppervlak, ook een leesstap midden in een batch.
  store.getState().undo();
  const ctx = makeMcpContext(context);
  const nameResult = await getTool('planner_update_tasks')!.handler({ updates: [{ id: bId, fields: { name: 'B via tool' } }] }, ctx) as McpToolResult;
  eq('echte tool naam slaagt', nameResult.ok, true);
  eq('echte tool naam houdt modus', [bStart(), store.getState().datesAsRecorded], ['2026-03-16T07:00', true]);
  store.getState().undo();
  const batch = await getTool('planner_batch')!.handler({ steps: [
    { tool: 'planner_update_tasks', args: { updates: [{ id: bId, fields: { name: 'B in batch' } }] } },
    { tool: 'planner_get_task', args: { taskId: bId } },
  ] }, ctx) as McpToolResult;
  eq('batch met metadata en lezen slaagt', batch.ok, true);
  eq('lezen in batch houdt modus', [bStart(), store.getState().datesAsRecorded], ['2026-03-16T07:00', true]);
  store.getState().undo();
  const r = store.getState().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1, costPerHour: 0 });
  store.getState().assignResource(bId, r, 1);
  store.setState(s => { s.tasks.find(t => t.id === bId)!.timephasedContours = [{ resourceUid: null, resourceId: r, periods: [{ afterMinutes: 0, minutes: 2400, workMinutes: 1200, kind: 'remaining' }] }]; });
  const ui = createAppStoreContext().store;
  ui.setState(s => hydratePayload(s, capturePayload(store.getState())));
  const beforeRule = structuredClone({ task: store.getState().tasks.find(t => t.id === bId), assignments: store.getState().assignments });
  ui.getState().setTaskWorkRule(bId, 'FIXED_WORK');
  const ruleResult = await getTool('planner_update_tasks')!.handler({ updates: [{ id: bId, fields: { workRule: 'FIXED_WORK' } }] }, ctx) as McpToolResult;
  eq('echte tool werkregel slaagt', ruleResult.ok, true);
  eq('werkregel met afwijkende contour houdt modus', [bStart(), store.getState().datesAsRecorded], ['2026-03-16T07:00', true]);
  eq('werkregel geeft hetzelfde restwerk als UI', store.getState().assignments, ui.getState().assignments);
  eq('werkregel geeft dezelfde contour als UI', store.getState().tasks.find(t => t.id === bId)!.timephasedContours, ui.getState().tasks.find(t => t.id === bId)!.timephasedContours);
  store.getState().undo();
  eq('werkregel undo herstelt taak, contour en restwerk',
    { task: store.getState().tasks.find(t => t.id === bId), assignments: store.getState().assignments }, beforeRule);
  const ruleBatch = await getTool('planner_batch')!.handler({ steps: [
    { tool: 'planner_update_tasks', args: { updates: [{ id: bId, fields: { workRule: 'FIXED_WORK' } }] } },
    { tool: 'planner_get_task', args: { taskId: bId } },
  ] }, ctx) as McpToolResult;
  eq('werkregelbatch met echte leesstap slaagt', ruleBatch.ok, true);
  eq('werkregelbatch met leesstap houdt datum en modus',
    [bStart(), store.getState().datesAsRecorded], ['2026-03-16T07:00', true]);
  eq('werkregelbatch geeft hetzelfde restwerk als UI', store.getState().assignments, ui.getState().assignments);
  eq('werkregelbatch geeft dezelfde contour als UI', store.getState().tasks.find(t => t.id === bId)!.timephasedContours,
    ui.getState().tasks.find(t => t.id === bId)!.timephasedContours);
  store.getState().undo();
  eq('werkregelbatch undo herstelt taak, contour en restwerk',
    { task: store.getState().tasks.find(t => t.id === bId), assignments: store.getState().assignments }, beforeRule);
  const planResult = await getTool('planner_update_tasks')!.handler({ updates: [{ id: bId, fields: { duration: 2, durationUnit: 'days', workRule: 'FIXED_WORK' } }] }, ctx) as McpToolResult;
  eq('duur en werkregel samen slaagt', planResult.ok, true);
  eq('duur plus werkregel verlaat modus', store.getState().datesAsRecorded, false);
  eq('MCP planning rondt de omzetting af', store.getState().minuteModelPending, false);
  store.getState().undo();
  const mixed = tx.run(() => {
    store.setState(s => { s.tasks.find(t => t.id === bId)!.timephasedContours![0].periods[0].workMinutes = 600; });
    tx.draft.setTaskWorkRule(bId, 'FIXED_WORK');
  });
  eq('ruwe contour plus werkregel slaagt', mixed.ok, true);
  eq('aansluitvoorwaarde houdt eerdere contourwijziging zichtbaar', store.getState().datesAsRecorded, false);
  store.getState().undo();
  eq('undo van gemengde bewerking geeft modus en contour terug', [store.getState().datesAsRecorded,
    store.getState().tasks.find(t => t.id === bId)!.timephasedContours![0].periods[0].workMinutes], [true, 1200]);

  if (errors.length) { for (const e of errors) console.log(`XX ${e}`); process.exitCode = 1; }
  console.log(`minutenovergang: ${checks - errors.length}/${checks} groen`);
}
void finish().catch(error => { console.error(error); process.exitCode = 1; });
