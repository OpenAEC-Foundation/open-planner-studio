// Twee-store-bewijs voor de per-context StoreRuntime (onderhoudbaarheidsprogramma 2, taak 2).
//
// Deze batterij gebruikt uitsluitend verse AppStoreContext-instanties. Documentstate vergelijken we
// via het canonieke documentcontract; uitvoeringsstate bewijzen we met undo-/redo-dieptes en de
// zichtbare batchstatus. Zo kan een gedeelde modulevariabele zich niet achter twee onafhankelijke
// Zustand-state-objecten verstoppen.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';
import { createBatchTransactions } from '@/state/runtime/createBatchTransactions';
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';

const diffs: string[] = [];
let checks = 0;

const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const NORMALIZED_CALENDAR: WorkCalendar = {
  id: 'runtime-isolation-calendar',
  name: 'Runtime-isolatiekalender',
  description: 'Vaste fixture zonder datum- of omgevingsafhankelijkheid',
  workDays: [1, 2, 3, 4, 5],
  workStartHour: 8,
  workEndHour: 16,
  hoursPerDay: 8,
  holidays: [],
};

interface Fixture {
  context: AppStoreContext;
  taskId: string;
}

function cloneCalendar(): WorkCalendar {
  return {
    ...NORMALIZED_CALENDAR,
    workDays: [...NORMALIZED_CALENDAR.workDays],
    holidays: [],
  };
}

function fixture(label: string): Fixture {
  const context = createAppStoreContext();
  const calendar = cloneCalendar();
  context.store.setState((state) => {
    state.project = {
      ...state.project,
      name: `Project ${label}`,
      startDate: '2026-01-05',
      calendarId: calendar.id,
    };
    state.calendar = calendar;
    state.calendars = [cloneCalendar()];
  });
  const taskId = context.store.getState().addTask({
    name: `${label}-start`,
    time: createDefaultTaskTime('2026-01-05', 5),
  });
  context.store.setState((state) => {
    state.historyEvents = [];
    state.nextHistorySequence = 1;
  });
  context.runtime.resetUndoCoalescing();
  return { context, taskId };
}

function depths(context: AppStoreContext) {
  const { undoDepth, redoDepth } = historyDepthsForActiveScope(context.store.getState());
  return {
    undo: undoDepth,
    redo: redoDepth,
  };
}

function documentState(context: AppStoreContext) {
  const { resourceLoadResult: _derivedResourceLoad, ...document } =
    capturePayload(context.store.getState());
  return document;
}

// ── 1. Dezelfde coalesceKey blijft per store een eigen reeks ────────────────────────────────
{
  const a = fixture('coalesce-A');
  const b = fixture('coalesce-B');

  a.context.store.getState().updateTask(a.taskId, { name: 'A-1' }, { coalesceKey: 'edit:name' });
  a.context.store.getState().updateTask(a.taskId, { name: 'A-2' }, { coalesceKey: 'edit:name' });
  eq('1 twee A-mutaties met dezelfde key vormen één A-stap', depths(a.context), { undo: 1, redo: 0 });

  b.context.store.getState().updateTask(b.taskId, { name: 'B-1' }, { coalesceKey: 'edit:name' });
  eq('2 dezelfde key in B vormt een eigen B-stap', depths(b.context), { undo: 1, redo: 0 });

  a.context.store.getState().updateTask(a.taskId, { name: 'A-3' }, { coalesceKey: 'edit:name' });
  eq('3 de B-mutatie onderbreekt de lopende A-reeks niet', depths(a.context), { undo: 1, redo: 0 });

  a.context.store.getState().addTask({
    name: 'gewone A-mutatie',
    time: createDefaultTaskTime('2026-01-06', 1),
  });
  a.context.store.getState().updateTask(a.taskId, { name: 'A-4' }, { coalesceKey: 'edit:name' });
  eq('4 een gewone A-mutatie breekt alleen de A-reeks', depths(a.context), { undo: 3, redo: 0 });

  b.context.store.getState().updateTask(b.taskId, { name: 'B-2' }, { coalesceKey: 'edit:name' });
  eq('4a de B-reeks coalescet na een gewone A-mutatie verder', depths(b.context), { undo: 1, redo: 0 });
}

// ── 2. Documentwissel en undo/redo resetten uitsluitend hun eigen runtime ───────────────────
{
  const a = fixture('wissel-A');
  const b = fixture('wissel-B');
  for (const name of ['A-wissel-1', 'A-wissel-2']) {
    a.context.store.getState().updateTask(a.taskId, { name }, { coalesceKey: 'edit:name' });
  }
  for (const name of ['B-wissel-1', 'B-wissel-2']) {
    b.context.store.getState().updateTask(b.taskId, { name }, { coalesceKey: 'edit:name' });
  }

  const originalA = a.context.store.getState().activeDocumentId;
  a.context.store.getState().newDocument();
  a.context.store.getState().switchDocument(originalA);
  a.context.store.getState().updateTask(a.taskId, { name: 'A-na-wissel' }, { coalesceKey: 'edit:name' });
  eq('5 terugswitchen breekt de oude A-coalescereeks', depths(a.context), { undo: 2, redo: 0 });

  b.context.store.getState().updateTask(b.taskId, { name: 'B-na-A-wissel' }, { coalesceKey: 'edit:name' });
  eq('5a een documentwissel in A breekt de B-reeks niet', depths(b.context), { undo: 1, redo: 0 });
}

{
  const a = fixture('historie-A');
  const b = fixture('historie-B');
  for (const name of ['A-historie-1', 'A-historie-2']) {
    a.context.store.getState().updateTask(a.taskId, { name }, { coalesceKey: 'edit:name' });
  }
  for (const name of ['B-historie-1', 'B-historie-2']) {
    b.context.store.getState().updateTask(b.taskId, { name }, { coalesceKey: 'edit:name' });
  }

  a.context.store.getState().undo();
  a.context.store.getState().redo();
  a.context.store.getState().updateTask(a.taskId, { name: 'A-na-redo' }, { coalesceKey: 'edit:name' });
  eq('6 undo/redo breekt de oude A-coalescereeks', depths(a.context), { undo: 2, redo: 0 });

  b.context.store.getState().updateTask(b.taskId, { name: 'B-na-A-redo' }, { coalesceKey: 'edit:name' });
  eq('6a undo/redo in A breekt de B-reeks niet', depths(b.context), { undo: 1, redo: 0 });
}

// ── 3. Geneste en vervlochten batches delen alleen runtime binnen dezelfde context ───────────
{
  const a = fixture('batch-A');
  const b = fixture('batch-B');
  const txA = createBatchTransactions(a.context);
  const txB = createBatchTransactions(b.context);
  const nestedTxB = createBatchTransactions(b.context);

  txB.withTransaction(() => {
    eq('7 tijdens de buitenste B-batch is B actief', b.context.runtime.isBatchActive(), true);
    eq('7a tijdens de buitenste B-batch blijft A inactief', a.context.runtime.isBatchActive(), false);
    b.context.store.getState().addTask({ name: 'B-buiten-1' });

    nestedTxB.withTransaction(() => {
      eq('7b een tweede B-factory ziet dezelfde actieve B-runtime', b.context.runtime.isBatchActive(), true);
      b.context.store.getState().addTask({ name: 'B-binnen' });
    });

    a.context.store.getState().addTask({ name: 'A-gewoon-tijdens-B' });
    eq('8 een gewone A-mutatie tijdens B krijgt een eigen snapshot', depths(a.context), { undo: 1, redo: 0 });

    txA.withTransaction(() => {
      eq('8a tijdens de A-batch zijn beide contexten onafhankelijk actief',
        [a.context.runtime.isBatchActive(), b.context.runtime.isBatchActive()], [true, true]);
      a.context.store.getState().addTask({ name: 'A-batch-1' });
      a.context.store.getState().addTask({ name: 'A-batch-2' });
    });
    b.context.store.getState().addTask({ name: 'B-buiten-2' });
  });

  eq('9 buitenste en geneste B-batch vormen samen één B-snapshot', depths(b.context), { undo: 1, redo: 0 });
  eq('9a gewone A-mutatie plus A-batch vormen twee A-snapshots', depths(a.context), { undo: 2, redo: 0 });
  eq('9b beide batchdieptes keren terug naar nul',
    [a.context.runtime.isBatchActive(), b.context.runtime.isBatchActive()], [false, false]);

  a.context.store.getState().addTask({ name: 'A-na-batches' });
  b.context.store.getState().addTask({ name: 'B-na-batches' });
  eq('10 na afloop krijgt een gewone A-mutatie weer een snapshot', depths(a.context), { undo: 3, redo: 0 });
  eq('10a na afloop krijgt een gewone B-mutatie weer een snapshot', depths(b.context), { undo: 2, redo: 0 });
}

// ── 4. Een batchthrow behoudt gedeeltelijke B-mutaties en raakt A nooit ──────────────────────
{
  const a = fixture('throw-A');
  const b = fixture('throw-B');
  const txB = createBatchTransactions(b.context);
  const aPayloadVoor = documentState(a.context);
  const aDepthsVoor = depths(a.context);
  const bPayloadVoor = documentState(b.context);
  const bTakenVoor = b.context.store.getState().tasks.length;
  let fout = '';

  try {
    txB.withTransaction(() => {
      b.context.store.getState().addTask({ name: 'B-voor-throw-1' });
      b.context.store.getState().addTask({ name: 'B-voor-throw-2' });
      throw new Error('verwachte batchthrow');
    });
  } catch (error) {
    fout = error instanceof Error ? error.message : String(error);
  }

  eq('11 de batchthrow bereikt de aanroeper', fout, 'verwachte batchthrow');
  eq('11a beide gedeeltelijke B-mutaties blijven staan',
    b.context.store.getState().tasks.slice(bTakenVoor).map(task => task.name),
    ['B-voor-throw-1', 'B-voor-throw-2']);
  eq('11b de gegooide B-batch vormt precies één undo-stap', depths(b.context), { undo: 1, redo: 0 });
  eq('11c document A blijft byte-inhoudelijk gelijk', documentState(a.context), aPayloadVoor);
  eq('11d de stacks van A blijven gelijk', depths(a.context), aDepthsVoor);
  eq('11e runtime B sluit ook na een throw', b.context.runtime.isBatchActive(), false);

  b.context.store.getState().undo();
  eq('12 één B-undo herstelt exact de payload van vóór de batch',
    documentState(b.context), bPayloadVoor);
  eq('12a die B-undo laat precies één redo-snapshot achter', depths(b.context), { undo: 0, redo: 1 });
  eq('12b die B-undo leidt resourcebelasting opnieuw af',
    b.context.store.getState().resourceLoadResult !== null, true);

  a.context.store.getState().addTask({ name: 'A-na-B-throw' });
  b.context.store.getState().addTask({ name: 'B-na-eigen-undo' });
  eq('13 een vervolgmutatie in A krijgt een eigen snapshot', depths(a.context), { undo: 1, redo: 0 });
  eq('13a een vervolgmutatie in B krijgt na undo een snapshot en wist redo',
    depths(b.context), { undo: 1, redo: 0 });
}

// ── Uitslag ────────────────────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: store-runtime-isolatie — ${checks} checks groen`);
  process.exit(0);
} else {
  console.log(`XX store-runtime-isolatie — ${diffs.length} van ${checks} checks rood:`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
