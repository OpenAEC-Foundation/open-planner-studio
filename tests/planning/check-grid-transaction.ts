import './domStub';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppStore, useAppStore, type AppState } from '@/state/appStore';
import { commitPreparedGridMutation, prepareGridMutation, runGridMutation, type PreparedGridMutation } from '@/state/gridTransaction';
import type { CellEditIntent, PasteIntent, RelationSetIntent } from '@/types/taskGrid';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
const S = () => useAppStore.getState();
function reset(): void {
  S().newProject();
  useAppStore.setState(state => {
    state.historyEvents = [];
    state.nextHistorySequence = 1;
    state.ui.notifications = [];
    state.isDirty = false;
  });
}
function nameEdit(taskId: string, value: unknown): CellEditIntent {
  return { kind: 'cell-edit', taskId, columnId: 'task.name' as CellEditIntent['columnId'], route: 'task-field', value };
}
function cellEdit(taskId: string, columnId: string, route: CellEditIntent['route'], value: unknown): CellEditIntent {
  return { kind: 'cell-edit', taskId, columnId: columnId as CellEditIntent['columnId'], route, value };
}
function relationSet(
  taskId: string,
  direction: RelationSetIntent['direction'],
  wbsCodes: readonly string[],
): RelationSetIntent {
  return {
    kind: 'relation-set', taskId, direction,
    value: wbsCodes.map((wbsCode, index) => ({
      kind: 'internal', wbsCode, relType: 'FS', lagText: '',
      source: { index, start: index * 8, end: index * 8 + wbsCode.length, text: `${wbsCode} FS` },
    })),
  };
}
function observed(state: AppState): unknown {
  return {
    project: state.project, tasks: state.tasks, isDirty: state.isDirty,
    scheduleStale: state.scheduleStale, viewRows: state.viewRows,
    resourceLoadResult: state.resourceLoadResult, notifications: state.ui.notifications,
    historyEvents: state.historyEvents, nextHistorySequence: state.nextHistorySequence,
  };
}

// Meerdere relatiecellen in één paste worden tegen hun gezamenlijke eindtoestand beoordeeld.
// De eerste write maakt hier tijdelijk A->B->C->A; de tweede haalt B->C weg, zodat het eindresultaat
// geldig is. De toevallige writevolgorde mag die geldige herschikking niet blokkeren.
{
  reset();
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  const c = S().addTask({ name: 'C' });
  const wbsA = S().tasks.find(task => task.id === a)!.wbsCode;
  useAppStore.setState(state => {
    state.sequences = [
      { id: 'ab', predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 },
      { id: 'bc', predecessorId: b, successorId: c, type: 'FINISH_START', lagDays: 0 },
    ];
    state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false;
  });
  const result = runGridMutation([{
    kind: 'paste',
    writes: [relationSet(c, 'successor', [wbsA]), relationSet(b, 'successor', [])],
  }]);
  eq('Relationele paste valideert de gezamenlijke eindgraaf', result.ok, true);
  eq('Tijdelijke cyclus blokkeert geldig eindresultaat niet', S().sequences.map(sequence => (
    [sequence.predecessorId, sequence.successorId]
  )), [[a, b], [c, a]]);
  eq('Meercellige relatiepaste blijft één undo-eenheid', S().historyEvents.length, 1);
}

// Twee cellen mogen niet stil verschillende opdrachten geven voor dezelfde relatie. Dit is geen
// "laatste write wint": de hele paste wordt geweigerd en laat de live store ongemoeid.
{
  reset();
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  const wbsB = S().tasks.find(task => task.id === b)!.wbsCode;
  useAppStore.setState(state => {
    state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false;
  });
  const before = JSON.stringify(observed(S()));
  const result = runGridMutation([{
    kind: 'paste',
    writes: [relationSet(a, 'successor', [wbsB]), relationSet(b, 'predecessor', [])],
  }]);
  eq('Tegenspraak tussen overlappende relatiecellen faalt', result.ok, false);
  eq('Tegenspraak benoemt relationSetConflict', result.ok ? null : result.errors[0]?.code, 'relationSetConflict');
  eq('Tegenspraak laat store byte-identiek', JSON.stringify(observed(S())), before);
  // Bewaak ook de omgekeerde invoervolgorde: conflictgedrag mag niet van arrayvolgorde afhangen.
  const reversed = runGridMutation([{
    kind: 'paste',
    writes: [relationSet(b, 'predecessor', []), relationSet(a, 'successor', [wbsB])],
  }]);
  eq('Omgekeerde tegenspraak faalt eveneens', reversed.ok, false);
  eq('Omgekeerde tegenspraak laat store byte-identiek', JSON.stringify(observed(S())), before);
}

// Leeg = geldige no-op: geen publicatie en geen history.
{
  reset();
  let publications = 0;
  const unsubscribe = useAppStore.subscribe(() => { publications++; });
  const result = runGridMutation([]);
  unsubscribe();
  eq('Lege intentlijst slaagt', result.ok, true);
  eq('Lege intentlijst publiceert niets', publications, 0);
  eq('Lege intentlijst registreert niets', S().historyEvents.length, 0);
}

// Een factory-store gebruikt zijn eigen slicegetters en raakt de app-singleton niet.
{
  reset();
  const singletonTask = S().addTask({ name: 'Singleton' });
  const isolatedStore = createAppStore();
  const isolatedTask = isolatedStore.getState().addTask({ name: 'Tweede store' });
  isolatedStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false; });
  const result = isolatedStore.getState().runGridMutation([nameEdit(isolatedTask, 'Alleen tweede')]);
  eq('Factory-store voert eigen gridtransactie uit', result.ok, true);
  eq('Factory-store wijzigt zijn eigen taak', isolatedStore.getState().tasks[0]?.name, 'Alleen tweede');
  eq('Factory-store maakt eigen history', isolatedStore.getState().historyEvents.length, 1);
  eq('Factory-store raakt singleton-taak niet', S().tasks.find(task => task.id === singletonTask)?.name, 'Singleton');
}

// Prepare rekent uitsluitend op een geïsoleerde draft en mag de live store niet publiceren.
{
  reset();
  const taskId = S().addTask({ name: 'Live blijft staan' });
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false; });
  const before = JSON.stringify(observed(S()));
  let publications = 0;
  const unsubscribe = useAppStore.subscribe(() => { publications++; });
  const prepared = prepareGridMutation(S(), [nameEdit(taskId, 'Alleen voorbereid')]);
  unsubscribe();
  eq('Prepare slaagt op een geldige cel', prepared.ok, true);
  eq('Prepare publiceert niets', publications, 0);
  eq('Prepare laat live state byte-identiek', JSON.stringify(observed(S())), before);
  eq('Prepare bevat wel de voorgenomen waarde', prepared.ok ? prepared.value.after.tasks[0]?.name : null, 'Alleen voorbereid');
}

// Eén celcommit publiceert data, afgeleiden, dirty en exact één event tegelijk.
{
  reset();
  const taskId = S().addTask({ name: 'Voor' });
  S().runCPM();
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false; });
  const states: AppState[] = [];
  const unsubscribe = useAppStore.subscribe(state => states.push(state));
  const result = runGridMutation([nameEdit(taskId, 'Na')]);
  unsubscribe();
  eq('Eén celcommit slaagt', result.ok, true);
  eq('Eén celcommit publiceert exact één keer', states.length, 1);
  eq('Eén celcommit publiceert de waarde meteen', states.map(state => state.tasks[0]?.name), ['Na']);
  eq('Eén celcommit publiceert dirty meteen', states.map(state => state.isDirty), [true]);
  eq('Naamwijziging maakt planning niet stale', states.map(state => state.scheduleStale), [false]);
  eq('Eén celcommit publiceert exact één history-event', states.map(state => state.historyEvents.length), [1]);
  eq('Eén celcommit publiceert meteen passende rijen', states.map(state => state.viewRows.flatMap(row => row.kind === 'task' ? [row.task.name] : [])), [['Na']]);
  eq('Eén celcommit publiceert meteen de bijbehorende resourcebelasting', states[0]?.resourceLoadResult, S().resourceLoadResult);
  S().undo();
  eq('Undo van gridcommit herstelt taakdata', S().tasks[0]?.name, 'Voor');
  eq('Undo van gridcommit materialiseert passende rijen', S().viewRows.flatMap(row => row.kind === 'task' ? [row.task.name] : []), ['Voor']);
  S().redo();
  eq('Redo van gridcommit herstelt taakdata', S().tasks[0]?.name, 'Na');
  eq('Redo van gridcommit materialiseert passende rijen', S().viewRows.flatMap(row => row.kind === 'task' ? [row.task.name] : []), ['Na']);
}

// Cel twee faalt: niets van cel één mag lekken.
{
  reset();
  const taskId = S().addTask({ name: 'Oorspronkelijk' });
  S().runCPM();
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.ui.notifications = []; state.isDirty = false; });
  const before = JSON.stringify(observed(S()));
  const paste: PasteIntent = { kind: 'paste', writes: [nameEdit(taskId, 'Mag niet landen'), nameEdit('onbekende-taak', 'Fout')] };
  let publications = 0;
  const unsubscribe = useAppStore.subscribe(() => { publications++; });
  const result = runGridMutation([paste]);
  unsubscribe();
  eq('Paste met fout in cel twee faalt', result.ok, false);
  eq('Gefaalde paste publiceert niets', publications, 0);
  eq('Gefaalde paste laat alle bewaakte state byte-identiek', JSON.stringify(observed(S())), before);
}

// Een relationele celset loopt door de pure planner en commit samen met een gewone celwrite in
// exact dezelfde transactie: geen tussenpublicatie met alleen de naam of alleen de relatie.
{
  reset();
  const taskId = S().addTask({ name: 'Relatiegrens' });
  const predecessorId = S().addTask({ name: 'Voorganger' });
  const predecessorWbs = S().tasks.find(task => task.id === predecessorId)!.wbsCode;
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false; });
  const relation: RelationSetIntent = {
    kind: 'relation-set', taskId, direction: 'predecessor', value: [{
      kind: 'internal', wbsCode: predecessorWbs, relType: 'FS', lagText: '+2d',
      source: { index: 0, start: 0, end: 9, text: `${predecessorWbs} FS+2d` },
    }],
  };
  const paste: PasteIntent = { kind: 'paste', writes: [nameEdit(taskId, 'Relatie en naam landen'), relation] };
  let publications = 0;
  const unsubscribe = useAppStore.subscribe(() => { publications++; });
  const result = runGridMutation([paste]);
  unsubscribe();
  eq('Paste met aangesloten relatiewrite slaagt', result.ok, true);
  eq('Relatiepaste publiceert naam en relatie samen exact één keer', publications, 1);
  eq('Relatiepaste schrijft de naam', S().tasks.find(task => task.id === taskId)?.name, 'Relatie en naam landen');
  eq('Relatiepaste schrijft de gewenste relatie met lag', S().sequences.map(sequence => ({
    predecessorId: sequence.predecessorId, successorId: sequence.successorId, type: sequence.type, lagDays: sequence.lagDays,
  })), [{ predecessorId, successorId: taskId, type: 'FINISH_START', lagDays: 2 }]);
  eq('Relatiepaste maakt één gezamenlijk history-event', S().historyEvents.length, 1);
}

// Dezelfde bronmutatie met exact dezelfde waarde dedupliceert tot één wijziging.
{
  reset();
  const taskId = S().addTask({ name: 'Dubbel gelijk' });
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false; });
  let publications = 0;
  const unsubscribe = useAppStore.subscribe(() => { publications++; });
  const result = runGridMutation([nameEdit(taskId, 'Eén keer'), nameEdit(taskId, 'Eén keer')]);
  unsubscribe();
  eq('Gelijke dubbele veldmutatie slaagt', result.ok, true);
  eq('Gelijke dubbele veldmutatie publiceert één keer', publications, 1);
  eq('Gelijke dubbele veldmutatie schrijft de waarde', S().tasks[0]?.name, 'Eén keer');
  eq('Gelijke dubbele veldmutatie maakt één event', S().historyEvents.length, 1);
}

// Een relationele Excel-cel met een technisch ogende maar onbekende externe payload mag evenmin
// een eerdere write uit dezelfde paste laten lekken. Task 17 bewijst de precieze parserfout apart;
// deze check bewaakt hier daarnaast de atomaire transactiegrens van de aangesloten relatieplanner.
{
  reset();
  const taskId = S().addTask({ name: 'Externe suffix voor' });
  useAppStore.setState(state => {
    state.historyEvents = []; state.nextHistorySequence = 1; state.ui.notifications = []; state.isDirty = false;
  });
  const before = JSON.stringify(observed(S()));
  const unknownExternalToken = 'Project / Taak FS ⟦OPS-EXT/1:eyJ2IjoyfQ⟧';
  const relation: RelationSetIntent = {
    kind: 'relation-set', taskId, direction: 'predecessor', value: [unknownExternalToken],
  };
  const result = runGridMutation([{ kind: 'paste', writes: [nameEdit(taskId, 'Mag niet landen'), relation] }]);
  eq('Paste met onbekende externe suffix faalt', result.ok, false);
  eq('Onbekende externe suffix laat alle bewaakte state byte-identiek', JSON.stringify(observed(S())), before);
}

// Twee verschillende waarden voor hetzelfde onderliggende taakveld zijn een setbrede fout.
{
  reset();
  const taskId = S().addTask({ name: 'Dubbel' });
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; });
  const result = runGridMutation([nameEdit(taskId, 'A'), nameEdit(taskId, 'B')]);
  eq('Tegenstrijdige dubbele veldmutatie faalt', result.ok, false);
  eq('Tegenstrijdige dubbele veldmutatie verandert niets', S().tasks[0]?.name, 'Dubbel');
  eq('Tegenstrijdige dubbele veldmutatie maakt geen event', S().historyEvents.length, 0);
}

// Een geldige bewerking naar de reeds aanwezige waarde blijft een volledige no-op.
{
  reset();
  const taskId = S().addTask({ name: 'Ongewijzigd' });
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false; });
  let publications = 0;
  const unsubscribe = useAppStore.subscribe(() => { publications++; });
  const result = runGridMutation([nameEdit(taskId, 'Ongewijzigd')]);
  unsubscribe();
  eq('Gelijke celwaarde is geldig', result.ok, true);
  eq('Gelijke celwaarde publiceert niets', publications, 0);
  eq('Gelijke celwaarde maakt niet dirty', S().isDirty, false);
  eq('Gelijke celwaarde maakt geen event', S().historyEvents.length, 0);
}

// Een buiten de wrapper vastgehouden prepare mag een latere wijziging niet overschrijven.
{
  reset();
  const taskId = S().addTask({ name: 'Oorspronkelijk' });
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false; });
  const prepared = prepareGridMutation(S(), [nameEdit(taskId, 'Voorbereid')]);
  S().updateTask(taskId, { name: 'Latere wijziging' });
  const result = prepared.ok ? commitPreparedGridMutation(prepared.value) : null;
  eq('Stale rechtstreekse commit wordt geweigerd', result?.ok, false);
  eq('Stale rechtstreekse commit benoemt stateChanged', result?.ok === false ? result.errors[0]?.code : null, 'stateChanged');
  eq('Stale rechtstreekse commit overschrijft latere waarde niet', S().tasks[0]?.name, 'Latere wijziging');
}

// Een throw binnen de enige producer rolt ook reeds toegepaste snapshotvelden volledig terug.
{
  reset();
  const taskId = S().addTask({ name: 'Voor producerfout' });
  useAppStore.setState(state => {
    state.historyEvents = [];
    state.nextHistorySequence = 0; // Dwing recordDocumentDataHistoryDelta om in de producer te gooien.
    state.isDirty = false;
  });
  const prepared = prepareGridMutation(S(), [nameEdit(taskId, 'Mag niet landen')]);
  const before = JSON.stringify(observed(S()));
  let publications = 0;
  const unsubscribe = useAppStore.subscribe(() => { publications++; });
  const result = prepared.ok ? commitPreparedGridMutation(prepared.value) : null;
  unsubscribe();
  eq('Producerfout wordt als commitFailed teruggegeven', result?.ok === false ? result.errors[0]?.code : null, 'commitFailed');
  eq('Producerfout publiceert niets', publications, 0);
  eq('Producerfout laat live state byte-identiek', JSON.stringify(observed(S())), before);
}

// Een subscriber kan tijdens de buitenste call geen tweede gridtransactie binnensmokkelen.
{
  reset();
  const taskId = S().addTask({ name: 'Buiten' });
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false; });
  const nestedResults: ReturnType<typeof runGridMutation>[] = [];
  let publications = 0;
  const unsubscribe = useAppStore.subscribe(() => {
    publications++;
    if (nestedResults.length === 0) nestedResults.push(runGridMutation([nameEdit(taskId, 'Binnen')]));
  });
  const outer = runGridMutation([nameEdit(taskId, 'Buiten klaar')]);
  unsubscribe();
  const nested = nestedResults[0];
  eq('Buitenste gridtransactie slaagt', outer.ok, true);
  eq('Herintredende gridtransactie faalt', nested?.ok, false);
  eq('Herintredende gridtransactie benoemt reentrant', nested?.ok === false ? nested.errors[0]?.code : null, 'reentrant');
  eq('Herintreding veroorzaakt geen tweede publicatie', publications, 1);
  eq('Alleen de buitenste waarde landt', S().tasks[0]?.name, 'Buiten klaar');
  eq('Alleen de buitenste transactie maakt history', S().historyEvents.length, 1);
}

// De registry blijft eigenaar van naamvalidatie; leeg en witruimte zijn ongeldig.
{
  for (const [label, value] of [['lege', ''], ['witruimte', '   ']] as const) {
    reset();
    const taskId = S().addTask({ name: 'Blijft geldig' });
    useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false; });
    const result = runGridMutation([nameEdit(taskId, value)]);
    eq(`${label} taaknaam faalt`, result.ok, false);
    eq(`${label} taaknaam benoemt required`, result.ok ? null : result.errors[0]?.code, 'required');
    eq(`${label} taaknaam verandert niets`, S().tasks[0]?.name, 'Blijft geldig');
    eq(`${label} taaknaam maakt geen history`, S().historyEvents.length, 0);
  }
}

// Read-only/berekende kolom wordt al in prepare geweigerd.
{
  reset();
  const taskId = S().addTask({ name: 'Read-only' });
  const result = runGridMutation([{
    kind: 'cell-edit', taskId,
    columnId: 'task.time.earlyStart' as CellEditIntent['columnId'],
    route: 'task-schedule', value: '2030-01-01',
  }]);
  eq('Read-only intent faalt', result.ok, false);
  eq('Read-only intent benoemt readOnly', result.ok ? null : result.errors[0]?.code, 'readOnly');
}

// Task 12: verschillende bewaakte routes landen samen als één atomaire documentmutatie.
{
  reset();
  const taskId = S().addTask({ name: 'Bewaakt' });
  useAppStore.setState(state => {
    state.historyEvents = [];
    state.nextHistorySequence = 1;
    state.isDirty = false;
    state.scheduleStale = false;
    state.project.statusDate = '2026-01-10';
  });
  const result = runGridMutation([
    nameEdit(taskId, 'Bewaakt gewijzigd'),
    cellEdit(taskId, 'task.time.completion', 'task-progress', 0.4),
    cellEdit(taskId, 'task.constraint.type', 'task-constraint', 'SNET'),
  ]);
  const task = S().tasks.find(candidate => candidate.id === taskId);
  eq('Gemengde bewaakte transactie slaagt', result.ok, true);
  eq('Gemengde transactie landt alle drie routes', task ? {
    name: task.name,
    completion: task.time.completion,
    status: task.status,
    constraint: task.constraint,
  } : null, {
    name: 'Bewaakt gewijzigd', completion: 0.4, status: 'STARTED',
    constraint: { type: 'SNET', date: task?.time.scheduleStart },
  });
  eq('Gemengde transactie maakt precies één history-event', S().historyEvents.length, 1);
  eq('Planningrelevante route zet scheduleStale', S().scheduleStale, true);
}

// Een fout in de laatste bewaakte write rolt eerdere geldige writes volledig terug.
{
  reset();
  const taskId = S().addTask({ name: 'Rollback bewaakt' });
  useAppStore.setState(state => {
    state.historyEvents = [];
    state.nextHistorySequence = 1;
    state.isDirty = false;
    state.scheduleStale = false;
    state.project.statusDate = '2026-01-10';
  });
  const before = JSON.stringify(observed(S()));
  const result = runGridMutation([
    nameEdit(taskId, 'Mag niet landen'),
    cellEdit(taskId, 'task.time.actualFinish', 'task-progress', '2099-01-01'),
  ]);
  eq('Late ongeldige actual weigert de hele batch', result.ok, false);
  eq('Late ongeldige actual heeft gerichte foutcode',
    result.ok ? null : result.errors[0]?.code, 'actualAfterStatusDate');
  eq('Late fout laat alle bekeken state byte-identiek', JSON.stringify(observed(S())), before);
}

// Duur-/datumedit wist alleen afgeleide timephased-sturing en meldt pas na de commit.
{
  reset();
  const taskId = S().addTask({ name: 'Timephased grid' });
  useAppStore.setState(state => {
    const task = state.tasks.find(candidate => candidate.id === taskId)!;
    task.timephasedFinishFloor = '2026-02-01';
    task.timephasedStartAnchor = '2026-01-01';
    task.timephasedDurationWalks = [{
      anchor: '2026-01-01', resourceCalendarId: state.calendar.id, workMinutes: 300,
    }];
    task.timephasedContours = [{
      resourceUid: null, periods: [{ afterMinutes: 0, minutes: 300, workMinutes: 300, kind: 'remaining' }],
    }];
    state.historyEvents = [];
    state.nextHistorySequence = 1;
    state.ui.notifications = [];
    state.isDirty = false;
    state.scheduleStale = false;
  });
  const result = runGridMutation([
    cellEdit(taskId, 'task.time.scheduleDuration', 'task-schedule', 480),
  ]);
  const task = S().tasks.find(candidate => candidate.id === taskId);
  eq('Duurtransactie slaagt', result.ok, true);
  eq('Duurtransactie wist alleen bevroren sturing', task ? {
    duration: task.time.scheduleDuration,
    floor: task.timephasedFinishFloor,
    anchor: task.timephasedStartAnchor,
    walks: task.timephasedDurationWalks,
    contourCount: task.timephasedContours?.length,
  } : null, { duration: 1, contourCount: 1 });
  eq('Duurtransactie maakt één event', S().historyEvents.length, 1);
  eq('Timephased-verlies meldt precies eenmaal na commit',
    S().ui.notifications.map(notification => notification.messageKey),
    ['notifications.mppTimephasedSteeringLost']);
}

// Ook vaste technische en conditioneel read-only descriptors komen uit de registry.
{
  reset();
  const ordinary = S().addTask({ name: 'Gewoon' });
  const hammock = S().addTask({ name: 'Hammock', isHammock: true });
  S().setWbsAutoNumber(true);
  const cases: Array<[string, CellEditIntent]> = [
    ['technische taak-id', cellEdit(ordinary, 'task.id', 'task-field', 'nieuw-id')],
    ['WBS bij autonummering', cellEdit(ordinary, 'task.wbsCode', 'task-field', '9.9')],
    ['duur van hammock', cellEdit(hammock, 'task.time.scheduleDuration', 'task-schedule', 10)],
    ['assignmenttempo zonder assignment', cellEdit(ordinary, 'assignment.unitsPerDay', 'task-field', [])],
  ];
  for (const [label, intent] of cases) {
    const result = runGridMutation([intent]);
    eq(`${label} faalt`, result.ok, false);
    eq(`${label} benoemt readOnly`, result.ok ? null : result.errors[0]?.code, 'readOnly');
  }
}

// Solverfout blijft door gridcommit én de daaropvolgende undo/redo zonder schijnbelasting.
{
  reset();
  const a = S().addTask({ name: 'Cyclus A' });
  const b = S().addTask({ name: 'Cyclus B' });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  eq('Opzet heeft echte solverfout', typeof S().cpmResult?.error, 'string');
  eq('Opzet heeft geen betrouwbare resourcebelasting', S().resourceLoadResult, null);
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false; });
  const result = runGridMutation([nameEdit(a, 'Cyclus A hernoemd')]);
  eq('Naamcommit op foutieve planning slaagt', result.ok, true);
  eq('Gridcommit houdt belasting null bij solverfout', S().resourceLoadResult, null);
  S().undo();
  eq('Undo houdt solverfout vast', typeof S().cpmResult?.error, 'string');
  eq('Undo houdt belasting null bij solverfout', S().resourceLoadResult, null);
  S().redo();
  eq('Redo houdt solverfout vast', typeof S().cpmResult?.error, 'string');
  eq('Redo houdt belasting null bij solverfout', S().resourceLoadResult, null);
  S().addResource({ name: 'Resource na solverfout', type: 'LABOR', description: '', maxUnits: 1 });
  eq('Resourcebewerking houdt solverfout vast', typeof S().cpmResult?.error, 'string');
  eq('Resourcebewerking houdt belasting null bij solverfout', S().resourceLoadResult, null);
}

// Prepare is puur; documentwissel vóór rechtstreekse commit wordt defensief geweigerd.
{
  reset();
  const taskId = S().addTask({ name: 'Document A' });
  const prepared = prepareGridMutation(S(), [nameEdit(taskId, 'Voorbereid')]);
  eq('Prepare slaagt', prepared.ok, true);
  const documentA = S().activeDocumentId;
  S().newDocument();
  const beforeCommit = JSON.stringify(observed(S()));
  const result = prepared.ok ? commitPreparedGridMutation(prepared.value) : null;
  eq('Commit op ander actief document faalt', result?.ok, false);
  eq('Document-id mismatch laat nieuwe document byte-identiek', JSON.stringify(observed(S())), beforeCommit);
  eq('Mismatch-resultaat benoemt documentChanged', result?.ok === false ? result.errors[0]?.code : null, 'documentChanged');
  eq('Setup wisselde werkelijk document', S().activeDocumentId === documentA, false);
}

// Uitgestelde melding verschijnt pas ná de ene brondata/historyproducer.
{
  reset();
  const taskId = S().addTask({ name: 'Melding voor' });
  useAppStore.setState(state => { state.historyEvents = []; state.nextHistorySequence = 1; state.ui.notifications = []; });
  const prepared = prepareGridMutation(S(), [nameEdit(taskId, 'Melding na')]);
  const states: AppState[] = [];
  const unsubscribe = useAppStore.subscribe(state => states.push(state));
  const withNotification: PreparedGridMutation | null = prepared.ok ? {
    ...prepared.value,
    notifications: [{ severity: 'info', messageKey: 'notifications.relationCreated' }],
  } : null;
  const result = withNotification ? commitPreparedGridMutation(withNotification) : null;
  unsubscribe();
  eq('Voorbereide commit met melding slaagt', result?.ok, true);
  eq('Eerste publicatie bevat data en history maar nog geen melding', states[0] ? [states[0].tasks[0]?.name, states[0].historyEvents.length, states[0].ui.notifications.length] : null, ['Melding na', 1, 0]);
  eq('Melding verschijnt pas in een latere publicatie', states.map(state => state.ui.notifications.length), [0, 1]);
}

// Bronstructuur: prepare raakt geen live store en het kritieke commitvenster blijft synchroon.
{
  let root = process.cwd();
  if (!existsSync(join(root, 'package.json'))) {
    root = dirname(fileURLToPath(import.meta.url));
    while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);
  }
  const sourcePath = join(root, 'src/state/gridTransaction.ts');
  eq('Bronstructuur vindt gridTransaction.ts', existsSync(sourcePath), true);
  const source = existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : '';
  const prepareStart = source.indexOf('export function prepareGridMutation(');
  const commitStart = source.indexOf('function commitPreparedAgainstStore(');
  const commitEnd = source.indexOf('export function commitPreparedGridMutation(', commitStart);
  eq('Bronstructuur vindt de preparefunctie', prepareStart >= 0, true);
  eq('Bronstructuur vindt het kritieke commitvenster', commitStart >= 0 && commitEnd > commitStart, true);

  const prepareSource = source.slice(prepareStart, commitStart);
  for (const forbidden of ['useAppStore', '.setState(', '.notify(', 'runCPM(', 'withTransaction']) {
    eq(`Prepare bevat geen live route: ${forbidden}`, prepareSource.includes(forbidden), false);
  }
  eq('Gridtransactie importeert de app-singleton niet terug', source.includes("import { useAppStore } from './appStore'"), false);

  const commitSource = source.slice(commitStart, commitEnd);
  for (const forbidden of ['async ', 'await ', 'Promise', 'emitExtensionEvent', 'extensionHook', 'withTransaction']) {
    eq(`Kritieke commit blijft vrij van ${forbidden.trim()}`, commitSource.includes(forbidden), false);
  }
  eq('Kritieke commit bevat exact één storeproducer', (commitSource.match(/\bset\s*\(/g) ?? []).length, 1);
  eq('Kritieke commit controleert document vóór de producer',
    commitSource.indexOf('activeDocumentId') < commitSource.indexOf('set(state =>'), true);
}

if (diffs.length > 0) {
  console.error(`FAIL grid-transaction: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  grid-transaction: ${checks}/${checks}`);
}
