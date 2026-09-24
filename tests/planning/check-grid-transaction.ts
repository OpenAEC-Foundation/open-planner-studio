import './domStub';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppStore, useAppStore, type AppState } from '@/state/appStore';
import { commitPreparedGridMutation, prepareGridMutation, runGridMutation, type PreparedGridMutation } from '@/state/gridTransaction';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import type { CellEditIntent, PasteIntent, RelationSetIntent } from '@/types/taskGrid';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
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

// Een meercellige paste moet mijlpaalovergangen semantisch ordenen, niet op basis van de
// toevallige links-naar-rechtsvolgorde van de zichtbare kolommen.
{
  function runMilestonePaste(initialMilestone: boolean, milestoneFirst: boolean): {
    ok: boolean; milestone?: boolean; duration?: number;
  } {
    reset();
    const taskId = S().addTask({ name: 'Volgorde', isMilestone: initialMilestone });
    const milestone = cellEdit(taskId, 'task.isMilestone', 'task-milestone', !initialMilestone);
    const duration = cellEdit(taskId, 'task.time.scheduleDuration', 'task-schedule', 480);
    const result = runGridMutation([{
      kind: 'paste',
      writes: milestoneFirst ? [milestone, duration] : [duration, milestone],
    } satisfies PasteIntent]);
    const task = S().tasks.find(candidate => candidate.id === taskId);
    return { ok: result.ok, milestone: task?.isMilestone, duration: task?.time.scheduleDuration };
  }

  const toMilestoneLeft = runMilestonePaste(false, true);
  const toMilestoneRight = runMilestonePaste(false, false);
  eq('Gewone taak naar mijlpaal slaagt in beide kolomvolgordes',
    [toMilestoneLeft.ok, toMilestoneRight.ok], [true, true]);
  eq('Gewone taak naar mijlpaal heeft in beide volgordes dezelfde eindtoestand',
    [toMilestoneLeft.milestone, toMilestoneLeft.duration],
    [toMilestoneRight.milestone, toMilestoneRight.duration]);
  eq('Mijlpaalovergang dwingt in beide volgordes duur nul af',
    [toMilestoneLeft.milestone, toMilestoneLeft.duration], [true, 0]);

  const fromMilestoneLeft = runMilestonePaste(true, true);
  const fromMilestoneRight = runMilestonePaste(true, false);
  eq('Mijlpaal naar gewone taak slaagt in beide kolomvolgordes',
    [fromMilestoneLeft.ok, fromMilestoneRight.ok], [true, true]);
  eq('Mijlpaal naar gewone taak bewaart in beide volgordes de geplakte duur',
    [fromMilestoneLeft.milestone, fromMilestoneLeft.duration], [false, 1]);
  eq('Omgekeerde kolomvolgorde levert exact dezelfde gewone taak op',
    [fromMilestoneRight.milestone, fromMilestoneRight.duration], [false, 1]);
}

// De volledige mijlpaalgroep wordt tegen de gezamenlijke eindtoestand toegepast. Bij uitzetten
// mogen milestoneKind/mandatory tijdens dezelfde paste dus niet read-only worden vóór hun writes
// zijn verwerkt. Alle 24 kolomvolgordes moeten exact dezelfde gewone taak opleveren, zowel met
// lege als met gevulde bronmetadata (de overgang wist metadata uiteindelijk altijd).
{
  function permutations<T>(values: readonly T[]): T[][] {
    if (values.length <= 1) return [[...values]];
    return values.flatMap((value, index) => permutations([
      ...values.slice(0, index), ...values.slice(index + 1),
    ]).map(rest => [value, ...rest]));
  }

  for (const metadata of [
    { kind: undefined, mandatory: undefined },
    { kind: 'START', mandatory: false },
    { kind: 'FINISH', mandatory: true },
  ] as const) {
    const outcomes: unknown[] = [];
    for (const order of permutations(['flag', 'duration', 'kind', 'mandatory'] as const)) {
      reset();
      const taskId = S().addTask({
        name: 'Volledige mijlpaalpasta', isMilestone: true,
        milestoneKind: 'FINISH', mandatory: true,
      });
      const writes = {
        flag: cellEdit(taskId, 'task.isMilestone', 'task-milestone', false),
        duration: cellEdit(taskId, 'task.time.scheduleDuration', 'task-schedule', 960),
        kind: cellEdit(taskId, 'task.milestoneKind', 'task-milestone', metadata.kind),
        mandatory: cellEdit(taskId, 'task.mandatory', 'task-milestone', metadata.mandatory),
      };
      const result = runGridMutation([{
        kind: 'paste', writes: order.map(key => writes[key]),
      } satisfies PasteIntent]);
      const task = S().tasks.find(candidate => candidate.id === taskId);
      outcomes.push({
        ok: result.ok,
        isMilestone: task?.isMilestone,
        duration: task?.time.scheduleDuration,
        milestoneKind: task?.milestoneKind,
        mandatory: task?.mandatory,
      });
    }
    const expected = {
      ok: true, isMilestone: false, duration: 2,
      milestoneKind: undefined, mandatory: undefined,
    };
    eq(`Mijlpaal uitzetten met metadata ${JSON.stringify(metadata)} slaagt in alle 24 volgordes`,
      outcomes, Array.from({ length: 24 }, () => expected));
  }
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

// Gekoppelde taakvelden worden tegen één gewenste eindtoestand beoordeeld. Geen tijdelijke
// constraint- of actualtoestand en geen visuele kolomvolgorde mag het resultaat bepalen.
{
  for (const reverse of [false, true]) {
    reset();
    const taskId = S().addTask({ name: `Constraintpaar ${reverse}` });
    useAppStore.setState(state => {
      const task = state.tasks.find(candidate => candidate.id === taskId)!;
      task.constraint = { type: 'SNET', date: '2026-01-01' };
      task.constraint2 = { type: 'SNLT', date: '2026-01-02' };
      state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false;
    });
    const primary = cellEdit(taskId, 'task.constraint.type', 'task-constraint', 'FNLT');
    const secondary = cellEdit(taskId, 'task.constraint2.type', 'task-constraint', 'FNET');
    const result = runGridMutation([{
      kind: 'paste', writes: reverse ? [secondary, primary] : [primary, secondary],
    }]);
    const task = S().tasks.find(candidate => candidate.id === taskId)!;
    eq(`Geldig gezamenlijk constraintpaar slaagt ${reverse}`, result.ok, true);
    eq(`Constraintpaar eindigt onafhankelijk van volgorde ${reverse}`,
      [task.constraint?.type, task.constraint2?.type], ['FNLT', 'FNET']);
  }

  for (const reverse of [false, true]) {
    reset();
    const taskId = S().addTask({ name: `Actualvenster ${reverse}` });
    useAppStore.setState(state => {
      const task = state.tasks.find(candidate => candidate.id === taskId)!;
      task.time.actualStart = '2026-01-01';
      task.time.actualFinish = '2026-01-02';
      task.time.completion = 1;
      task.status = 'COMPLETED';
      state.project.statusDate = '2026-12-31';
      state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false;
    });
    const start = cellEdit(taskId, 'task.time.actualStart', 'task-progress', '2026-01-03');
    const finish = cellEdit(taskId, 'task.time.actualFinish', 'task-progress', '2026-01-04');
    const result = runGridMutation([{
      kind: 'paste', writes: reverse ? [finish, start] : [start, finish],
    }]);
    const task = S().tasks.find(candidate => candidate.id === taskId)!;
    eq(`Geldig gezamenlijk actualvenster slaagt ${reverse}`, result.ok, true);
    eq(`Actualvenster eindigt onafhankelijk van volgorde ${reverse}`,
      [task.time.actualStart, task.time.actualFinish], ['2026-01-03', '2026-01-04']);
  }

  const conflictOutcomes: unknown[] = [];
  for (const reverse of [false, true]) {
    reset();
    const taskId = S().addTask({ name: `Voortgangsconflict ${reverse}` });
    useAppStore.setState(state => {
      state.project.statusDate = '2026-01-10';
      state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false;
    });
    const before = JSON.stringify(observed(S()));
    const status = cellEdit(taskId, 'task.status', 'task-progress', 'COMPLETED');
    const completion = cellEdit(taskId, 'task.time.completion', 'task-progress', 0.5);
    const result = runGridMutation([{
      kind: 'paste', writes: reverse ? [completion, status] : [status, completion],
    }]);
    conflictOutcomes.push({
      ok: result.ok,
      code: result.ok ? null : result.errors[0]?.code,
      unchanged: JSON.stringify(observed(S())) === before,
    });
  }
  eq('Tegenstrijdige status en completion falen in beide volgordes', conflictOutcomes, [
    { ok: false, code: 'conflictingProgressInputs', unchanged: true },
    { ok: false, code: 'conflictingProgressInputs', unchanged: true },
  ]);

  const completedOutcomes: unknown[] = [];
  for (const reverse of [false, true]) {
    reset();
    const taskId = S().addTask({ name: `Afgerond consistent ${reverse}` });
    useAppStore.setState(state => {
      state.project.statusDate = '2026-01-10';
      state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false;
    });
    const status = cellEdit(taskId, 'task.status', 'task-progress', 'COMPLETED');
    const completion = cellEdit(taskId, 'task.time.completion', 'task-progress', 1);
    const result = runGridMutation([{
      kind: 'paste', writes: reverse ? [completion, status] : [status, completion],
    }]);
    const task = S().tasks.find(candidate => candidate.id === taskId)!;
    completedOutcomes.push({
      ok: result.ok,
      status: task.status,
      completion: task.time.completion,
      actualStart: task.time.actualStart,
      actualFinish: task.time.actualFinish,
    });
  }
  eq('Consistente afgeronde voortgang is volgorde-onafhankelijk', completedOutcomes, [
    completedOutcomes[0], completedOutcomes[0],
  ]);

  const durationOutcomes: unknown[] = [];
  for (const reverse of [false, true]) {
    reset();
    const taskId = S().addTask({ name: `Duurpaar consistent ${reverse}` });
    useAppStore.setState(state => {
      state.project.statusDate = '2026-01-10';
      state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false;
    });
    const actual = cellEdit(taskId, 'task.time.actualDuration', 'task-progress', 2 * 8 * 60);
    const remaining = cellEdit(taskId, 'task.time.remainingTime', 'task-progress', 3 * 8 * 60);
    const result = runGridMutation([{
      kind: 'paste', writes: reverse ? [remaining, actual] : [actual, remaining],
    }]);
    const task = S().tasks.find(candidate => candidate.id === taskId)!;
    durationOutcomes.push({
      ok: result.ok,
      status: task.status,
      completion: task.time.completion,
      actualDuration: task.time.actualDuration,
      remainingTime: task.time.remainingTime,
    });
  }
  eq('Consistente werkelijk/resterende duur is volgorde-onafhankelijk', durationOutcomes, [
    durationOutcomes[0], durationOutcomes[0],
  ]);

  const durationConflictOutcomes: unknown[] = [];
  for (const reverse of [false, true]) {
    reset();
    const taskId = S().addTask({ name: `Duurpaar conflict ${reverse}` });
    useAppStore.setState(state => {
      state.project.statusDate = '2026-01-10';
      state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false;
    });
    const before = JSON.stringify(observed(S()));
    const actual = cellEdit(taskId, 'task.time.actualDuration', 'task-progress', 2 * 8 * 60);
    const remaining = cellEdit(taskId, 'task.time.remainingTime', 'task-progress', 2 * 8 * 60);
    const result = runGridMutation([{
      kind: 'paste', writes: reverse ? [remaining, actual] : [actual, remaining],
    }]);
    durationConflictOutcomes.push({
      ok: result.ok,
      code: result.ok ? null : result.errors[0]?.code,
      unchanged: JSON.stringify(observed(S())) === before,
    });
  }
  eq('Tegenstrijdige werkelijk/resterende duur faalt in beide volgordes', durationConflictOutcomes, [
    { ok: false, code: 'conflictingProgressInputs', unchanged: true },
    { ok: false, code: 'conflictingProgressInputs', unchanged: true },
  ]);

  const unrelatedCellOutcomes: unknown[] = [];
  for (const progressColumn of ['task.time.completion', 'task.status'] as const) {
    for (const includeDescription of [false, true]) {
      reset();
      const taskId = S().addTask({ name: `Voltooid met nevenveld ${progressColumn}` });
      useAppStore.setState(state => {
        const task = state.tasks.find(candidate => candidate.id === taskId)!;
        task.status = 'COMPLETED';
        task.time.completion = 1;
        task.time.actualStart = '2026-01-01';
        task.time.actualFinish = '2026-01-05';
        state.project.statusDate = '2026-01-10';
        state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false;
      });
      const writes = [progressColumn === 'task.status'
        ? cellEdit(taskId, progressColumn, 'task-progress', 'STARTED')
        : cellEdit(taskId, progressColumn, 'task-progress', 0.5)];
      if (includeDescription) writes.push(cellEdit(taskId, 'task.description', 'task-field', 'Nevenveld'));
      const result = runGridMutation([{ kind: 'paste', writes }]);
      const task = S().tasks.find(candidate => candidate.id === taskId)!;
      unrelatedCellOutcomes.push({
        progressColumn, includeDescription, ok: result.ok, status: task.status,
        completion: task.time.completion, actualFinish: task.time.actualFinish,
        description: task.description,
      });
    }
  }
  eq('Een ongerelateerde cel verandert de geldigheid van dezelfde voortgangswijziging niet',
    unrelatedCellOutcomes, [
      { progressColumn: 'task.time.completion', includeDescription: false, ok: true, status: 'STARTED', completion: 0.5, actualFinish: undefined, description: '' },
      { progressColumn: 'task.time.completion', includeDescription: true, ok: true, status: 'STARTED', completion: 0.5, actualFinish: undefined, description: 'Nevenveld' },
      { progressColumn: 'task.status', includeDescription: false, ok: true, status: 'STARTED', completion: 0, actualFinish: undefined, description: '' },
      { progressColumn: 'task.status', includeDescription: true, ok: true, status: 'STARTED', completion: 0, actualFinish: undefined, description: 'Nevenveld' },
    ]);

  const permutations = <T>(values: readonly T[]): T[][] => values.length <= 1
    ? [[...values]]
    : values.flatMap((value, index) => permutations([
      ...values.slice(0, index), ...values.slice(index + 1),
    ]).map(rest => [value, ...rest]));
  const tripleOutcomes: unknown[] = [];
  for (const order of permutations(['hammock', 'milestone', 'duration'] as const)) {
    reset();
    const taskId = S().addTask({ name: 'Hangmat naar mijlpaal', isHammock: true });
    const writes = {
      hammock: cellEdit(taskId, 'task.isHammock', 'task-hammock', false),
      milestone: cellEdit(taskId, 'task.isMilestone', 'task-milestone', true),
      duration: cellEdit(taskId, 'task.time.scheduleDuration', 'task-schedule', 480),
    };
    const result = runGridMutation([{ kind: 'paste', writes: order.map(key => writes[key]) }]);
    const task = S().tasks.find(candidate => candidate.id === taskId)!;
    tripleOutcomes.push({ ok: result.ok, isHammock: task.isHammock, isMilestone: task.isMilestone, duration: task.time.scheduleDuration });
  }
  eq('Hangmat uit, mijlpaal aan en duur zijn in alle zes volgordes gelijk', tripleOutcomes,
    Array.from({ length: 6 }, () => ({ ok: true, isHammock: undefined, isMilestone: true, duration: 0 })));

  const calendarDurationOutcomes: unknown[] = [];
  for (const reverse of [false, true]) {
    reset();
    const taskId = S().addTask({ name: `Kalender plus duur ${reverse}` });
    useAppStore.setState(state => {
      state.calendars.push({
        ...state.calendar, id: 'hour-6', name: 'Zes uur', hoursPerDay: 6,
        workStartHour: 8, workEndHour: 14,
        workTime: { byWeekday: {
          1: [{ start: 480, end: 840 }], 2: [{ start: 480, end: 840 }],
          3: [{ start: 480, end: 840 }], 4: [{ start: 480, end: 840 }],
          5: [{ start: 480, end: 840 }], 6: [], 7: [],
        } },
      });
      state.historyEvents = []; state.nextHistorySequence = 1; state.isDirty = false;
    });
    const calendar = cellEdit(taskId, 'task.calendarId', 'task-schedule', 'hour-6');
    const duration = cellEdit(taskId, 'task.time.scheduleDuration', 'task-schedule', 480);
    const result = runGridMutation([{
      kind: 'paste', writes: reverse ? [duration, calendar] : [calendar, duration],
    }]);
    const task = S().tasks.find(candidate => candidate.id === taskId)!;
    calendarDurationOutcomes.push({
      ok: result.ok, calendarId: task.calendarId,
      scheduleDuration: task.time.scheduleDuration, durationMinutes: task.time.durationMinutes,
    });
  }
  eq('Kalender plus duur gebruikt in beide volgordes de uiteindelijke zes-uurskalender',
    calendarDurationOutcomes, [
      { ok: true, calendarId: 'hour-6', scheduleDuration: 480 / 360, durationMinutes: 480 },
      { ok: true, calendarId: 'hour-6', scheduleDuration: 480 / 360, durationMinutes: 480 },
    ]);
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

// Algemene eindtoestandvalidatie mag een conditioneel veld niet door zijn eigen write laten
// openzetten. Een taak met meerdere notities blijft via de compacte tabelcel read-only.
{
  reset();
  const taskId = S().addTask({ name: 'Meerdere notities' });
  S().updateTask(taskId, {
    notes: [
      { id: 'n-1', text: 'Eerste', done: false },
      { id: 'n-2', text: 'Tweede', done: false },
    ],
  });
  const result = runGridMutation([
    cellEdit(taskId, 'task.notes', 'task-field', 'Overschrijf alles'),
  ]);
  eq('Conditioneel veld kan zichzelf niet schrijfbaar maken', result.ok, false);
  eq('Zelf-openende notitiecel blijft readOnly',
    result.ok ? null : result.errors[0]?.code, 'readOnly');
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

// Aanbeveling 4 (onafhankelijke eindreview): CONTROLLER_COLUMN_IDS in gridTransaction.ts is een
// met de hand onderhouden set, gebaseerd op de aanname dat precies deze vier velden ooit de
// conditionele readOnly-uitkomst van een ANDERE cel bepalen. Die aanname is niet automatisch
// afleidbaar uit de registry (readOnly is een ondoorzichtige functie `(task, ctx) => boolean`,
// geen gestructureerde afhankelijkheidslijst) — deze pin bewaakt 'm daarom EXPLICIET: hij faalt
// zodra de registry een NIEUWE conditioneel read-only, echt via cell-edit schrijfbare kolom krijgt
// (of een bestaande verdwijnt) zonder dat dit gecertificeerde overzicht wordt bijgewerkt. Dat
// dwingt een bewuste herbeoordeling van CONTROLLER_COLUMN_IDS af in plaats van een stille
// aanname die uit de pas gaat lopen.
{
  let root = process.cwd();
  if (!existsSync(join(root, 'package.json'))) {
    root = dirname(fileURLToPath(import.meta.url));
    while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);
  }
  const gridTransactionSource = readFileSync(join(root, 'src/state/gridTransaction.ts'), 'utf8');
  const controllerSetLiteral = /const CONTROLLER_COLUMN_IDS = new Set\(\[\n([\s\S]*?)\n {2}\]\);/
    .exec(gridTransactionSource)?.[1] ?? '';
  const controllerIdsInSource = [...controllerSetLiteral.matchAll(/'([^']+)'/g)].map(match => match[1]).sort();
  eq('CONTROLLER_COLUMN_IDS in de bron bevat exact de vier gecertificeerde controllervelden',
    controllerIdsInSource,
    ['task.constraint.type', 'task.constraint2.type', 'task.isHammock', 'task.isMilestone'].sort());

  const registryDescriptors = buildTaskColumnRegistry({
    projectId: 'aanbeveling-4-pin', activityCodeTypes: [], customFieldDefs: [], baselines: [],
  });
  const byId = new Map(registryDescriptors.map(descriptor => [String(descriptor.id), descriptor]));
  const conditionallyReadOnlyCellEditIds = registryDescriptors
    .filter(descriptor => typeof descriptor.readOnly === 'function'
      && typeof descriptor.parse === 'function' && typeof descriptor.planWrite === 'function')
    .map(descriptor => String(descriptor.id))
    .filter(id => !id.startsWith('assignment.'))
    .sort();
  eq('Exact overzicht van conditioneel read-only, echt via cell-edit schrijfbare kolommen',
    conditionallyReadOnlyCellEditIds,
    [
      'task.constraint.hard', 'task.isHammock', 'task.mandatory', 'task.milestoneKind',
      'task.notes', 'task.time.durationUnit', 'task.time.scheduleDuration', 'task.wbsCode',
      // Taaktypes-etappe (2026-09-05): `task.workRule` leest alleen isMilestone/isHammock (controllers)
      // en childIds (nooit cel-schrijfbaar) — gecertificeerd, zelfde klasse als scheduleDuration.
      'task.workRule',
    ].sort());
  for (const controllerId of controllerIdsInSource) {
    ok(`Controllerveld ${controllerId} bestaat als echte, via cell-edit schrijfbare kolom`,
      byId.has(controllerId) && typeof byId.get(controllerId)?.parse === 'function');
  }

  // Stilzwijgende aanname 1 (task.childIds): de conditionele readOnly-functies van isHammock e.a.
  // lezen task.childIds.length, maar childIds staat NOOIT in CONTROLLER_COLUMN_IDS. Dat is veilig
  // omdat childIds nooit los via een cel-paste schrijfbaar is (readonlyColumn, geen parse/
  // planWrite) — er bestaat structureel geen CellEditIntent-route die childIds binnen dezelfde
  // transactie kan veranderen, dus de aanname "childIds blijft constant tijdens één paste" hoeft
  // niet apart bewaakt te worden zolang dit klopt.
  const childIdsDescriptor = byId.get('task.childIds');
  ok('task.childIds is nooit los via een paste schrijfbaar (geen parse-functie)',
    childIdsDescriptor !== undefined && typeof childIdsDescriptor.parse !== 'function');

  // Stilzwijgende aanname 2 (ctx.assignmentsByTaskId): assignment.resources/unitsPerDay/curve zijn
  // ZELF ook conditioneel read-only (mede via `assignments(task, ctx).length === 0`, dus via
  // ctx.assignmentsByTaskId), maar staan bewust NIET in CONTROLLER_COLUMN_IDS of het bovenstaande
  // overzicht. Dat is veilig zolang hun writes altijd een AssignmentSetIntent opleveren
  // ('assignment-set'), nooit een CellEditIntent ('cell-edit') — dan lopen ze structureel NOOIT
  // door applyCellEdits' conditionele controle (die uitsluitend CellEditIntent[] ziet), en hoeft
  // ctx.assignmentsByTaskId geen deel te zijn van CONTROLLER_COLUMN_IDS.
  for (const assignmentId of ['assignment.resources', 'assignment.unitsPerDay', 'assignment.curve']) {
    const descriptor = byId.get(assignmentId);
    ok(`${assignmentId} bestaat en is conditioneel read-only (leest ctx.assignmentsByTaskId)`,
      descriptor !== undefined && typeof descriptor.readOnly === 'function');
    // planWriteUnchecked is de rauwe writer (slaat de eigen readOnly-check bewust over — dat is
    // precies waarom clipboard.ts 'm gebruikt voor de gezamenlijke-eindtoestandplanning), dus een
    // minimale nep-taak/-context volstaat om alleen de vorm van de opgeleverde intent te toetsen.
    const written = descriptor?.planWriteUnchecked?.(
      [], { id: 'aanbeveling-4-pin-task' } as unknown as Parameters<NonNullable<typeof descriptor.planWriteUnchecked>>[1],
      {} as unknown as Parameters<NonNullable<typeof descriptor.planWriteUnchecked>>[2],
    );
    ok(`${assignmentId} schrijft via 'assignment-set', niet via 'cell-edit' (nooit CONTROLLER_COLUMN_IDS nodig)`,
      written?.ok === true && written.value[0]?.kind === 'assignment-set');
  }
}

// Napunt 2 (onafhankelijke eindreview op 62b37ea6): task.isHammock zit zowel in
// CONTROLLER_COLUMN_IDS als heeft zelf een conditionele readOnly (isMilestone || childIds > 0).
// Tegencase van de reviewer: een samenvattende taak (childIds > 0) met isHammock=true, geplakt met
// {isHammock: false, duur: 5d}. Vóór de fixed-point-lus in gridTransaction.ts werd isHammock
// terecht overgeslagen, maar scheduleDuration daardoor TEN ONRECHTE als schrijfbaar beoordeeld
// (de gedeelde controllertoestanden namen optimistisch aan dat isHammock wél zou worden
// toegepast) — de write faalde dan hard op de VERKEERDE cel. Beide cellen moeten nu netjes
// overgeslagen worden, met precies één geaggregeerde melding.
{
  reset();
  const parentId = S().addTask({ name: 'Samenvattende taak', isHammock: true });
  const childId = S().addTask({ name: 'Kind' });
  useAppStore.setState(state => {
    const parent = state.tasks.find(candidate => candidate.id === parentId)!;
    const child = state.tasks.find(candidate => candidate.id === childId)!;
    parent.childIds = [childId];
    child.parentId = parentId;
  });
  const before = S().tasks.find(candidate => candidate.id === parentId)!;
  eq('Uitgangspunt: de samenvattende taak is een hangmat mét kinderen',
    [before.isHammock, before.childIds.length > 0], [true, true]);

  const paste: PasteIntent = {
    kind: 'paste',
    writes: [
      cellEdit(parentId, 'task.isHammock', 'task-hammock', false),
      cellEdit(parentId, 'task.time.scheduleDuration', 'task-schedule', 480),
    ],
    allowSkippingReadOnlyCells: true,
  };
  const result = runGridMutation([paste]);
  eq('De transactie slaagt (geen harde weigering op de verkeerde cel)', result.ok, true);
  const after = S().tasks.find(candidate => candidate.id === parentId)!;
  eq('isHammock blijft onaangeraakt (kan nooit jointly writable worden: niets raakt childIds)',
    after.isHammock, before.isHammock);
  eq('scheduleDuration blijft óók onaangeraakt (was alleen "schrijfbaar" dankzij de nooit-toegepaste isHammock-write)',
    after.time.scheduleDuration, before.time.scheduleDuration);
  eq('Precies één geaggregeerde melding over overgeslagen cellen',
    S().ui.notifications.filter(n => n.messageKey === 'notifications.pasteSkippedReadOnly').length, 1);
  eq('De melding telt beide overgeslagen cellen samen (isHammock + scheduleDuration)',
    S().ui.notifications.find(n => n.messageKey === 'notifications.pasteSkippedReadOnly')?.params?.count, 2);
}

if (diffs.length > 0) {
  console.error(`FAIL grid-transaction: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  grid-transaction: ${checks}/${checks}`);
}
