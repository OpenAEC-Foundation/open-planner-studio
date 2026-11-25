import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { taskMinutesPerDay } from '@/services/ifc/dayMeasureIo';
import { checkMergeOutput, MergeNeedsPhase2Error, prepareIfcWrite, type OwnOutputCheck } from '@/services/ifc/foreign/mergeWriter';
import { readIfcBytesDetailed } from '@/services/ifc/foreign/ifcBytesRoute';
import { TASKTIME_SLOT } from '@/services/ifc/ifcTaskSlots';
import { parseIfcDuration } from '@/services/ifc/isoDuration';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { readXER } from '@/services/xer/xerReader';
import { prepareIfcOutput } from '@/state/prepareIfcOutput';
import { effHoursPerDay } from '@/utils/taskDuration';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { MSPDI_FIXTURE, P6XML_FIXTURE } from '../fixtures/recordedTimesFormats';
import { loadStore, openInStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { PROGRESS_TASK, recordedExample, withWall } from './opgeslagenDatumsVoorbeeld';
import { installDOMParser } from './xmldom-shim';

installDeterminism();
installDOMParser();
const { createAppStoreContext, buildWriteIFCInput } = await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const enc = new TextEncoder(), dec = new TextDecoder();

let passed = 0, failed = 0;
async function check(name: string, action: () => Promise<void>) {
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) {
    failed++;
    console.error(`XX ${name}: ${(error instanceof Error ? error.message : String(error)).slice(0, 4000)}`);
  }
}

type Store = Awaited<ReturnType<typeof openInStore>>['store'];
const TIME_KEYS = ['earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'totalFloat', 'freeFloat', 'isCritical'] as const;
const shown = (store: Store) => store.getState().tasks.map(t => [t.name, ...TIME_KEYS.map(k => t.time[k])]);
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const refusal = (error: unknown) => error instanceof MergeNeedsPhase2Error
  ? `${[...new Set(error.cases.map(c => c.kind))].sort().join(', ')}: ${error.cases.map(c => c.detail).join(' | ').slice(0, 900)}`
  : String(error);

async function merged(store: Store): Promise<Uint8Array> {
  const state = store.getState();
  try { return (await prepareIfcWrite(buildWriteIFCInput(state, 'merge'), state.ifcSource!)).bytes; }
  catch (error) { throw new Error(`de merge weigerde: ${refusal(error)}`); }
}

async function opened(bytes: Uint8Array): Promise<Store> {
  const { store } = await openInStore(bytes, 'met-model.ifc');
  const s = store.getState();
  assert(s.ifcSource?.foreign, 'geopend met een vreemd deel');
  return store;
}

async function importedThenSaved(parsed: ImportResult): Promise<Uint8Array> {
  const { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  store.getState().applyOpenedImport(parsed, { filePath: null, recompute: true });
  assert.equal(store.getState().datesAsRecorded, true, 'de verse import staat in de modus');
  return withWall(writeIFC(buildWriteIFCInput(store.getState(), 'merge')));
}

function xerWithEarlyDates(): ImportResult {
  const text = readFileSync(join(root, 'tests/browser/fixtures/xer/zonder-bijzonderheden.xer'), 'utf8')
    .replace('\ttarget_start_date\ttarget_end_date\r\n', '\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\r\n')
    .replace('\t2026-06-01 08:00\t2026-06-12 16:00\r\n', '\t2026-06-01 08:00\t2026-06-12 16:00\t2026-06-02 08:00\t2026-06-15 16:00\r\n');
  assert(text.includes('early_start_date') && text.includes('2026-06-15 16:00'), 'de proef zette vroege datums in de XER');
  const read = readXER(enc.encode(text));
  const result = isMultiDocumentImport(read) ? read.results[0] : read;
  assert(result.xerSourceArchive, 'de XER-planning heeft een bronarchief');
  return result;
}

const withProfile = (baseId: 'p6' | 'msproject', name: string) => (input: WriteIFCInput) => {
  input.project = { ...input.project, schedulingProfile: { baseId, id: baseId, name, overrides: {} } };
};

interface Stand { readonly name: string; readonly make: () => Promise<Uint8Array>; readonly task?: string }
const STANDS: readonly Stand[] = [
  { name: 'MSPDI-herkomst (de reproductie van de review)', make: () => recordedExample() },
  { name: 'MSPDI-herkomst, ongewijzigd sinds import', make: () => recordedExample({ edit: input => { input.importPristine = true; } }) },
  { name: 'rekenprofiel P6', make: () => recordedExample({ edit: withProfile('p6', 'P6') }) },
  { name: 'rekenprofiel MS Project', make: () => recordedExample({ edit: withProfile('msproject', 'MS Project') }) },
  { name: 'echte MSPDI-import, opgeslagen als IFC', make: () => importedThenSaved(readMSPDI(MSPDI_FIXTURE)) },
  { name: 'echte P6 XML-import, opgeslagen als IFC', make: () => importedThenSaved(readP6XML(P6XML_FIXTURE)) },
  { name: 'echte XER-import met bronarchief, opgeslagen als IFC', make: () => importedThenSaved(xerWithEarlyDates()) },
  { name: 'oud document (minuteModelPending)', make: () => recordedExample({ edit: input => { input.minuteModelPending = true; } }) },
  { name: 'MSPDI-herkomst met een lopende taak', make: () => recordedExample({ progress: 0.5 }), task: PROGRESS_TASK },
  { name: 'MSPDI-herkomst met een voltooide taak', make: () => recordedExample({ progress: 1 }), task: PROGRESS_TASK },
];

for (const { name: stand, make } of STANDS) {
  await check(`2231 ${stand}: Ctrl+S zonder bewerking geeft de bron byte voor byte terug`, async () => {
    const source = await make(), store = await opened(source);
    assert.equal(store.getState().datesAsRecorded, true, 'geopend in "datums zoals opgeslagen"');
    assert(sameBytes(await merged(store), source), 'de merge geeft de bron terug');
  });

  await check(`2231 ${stand}: Ctrl+S na een bewerking schrijft, en heropenen toont de datums die de planner zag`, async () => {
    const store = await opened(await make());
    const task = store.getState().tasks.find(t => !t.childIds.length)!;
    store.getState().updateTask(task.id, { name: `${task.name} (hernoemd)` });
    assert.equal(store.getState().datesAsRecorded, true, 'een naam laat de modus staan');
    const reopened = await opened(await merged(store));
    assert.equal(reopened.getState().datesAsRecorded, true, 'heropend in de modus');
    assert.deepEqual(shown(reopened), shown(store));
  });
}

await check('2231 Set up site: de modus toont de opgeslagen vroege start, niet de berekening', async () => {
  const store = await opened(await recordedExample());
  const s = store.getState(), task = s.tasks.find(t => t.name === 'Set up site')!;
  assert.equal(task.time.earlyStart, task.time.scheduleStart);
  assert.equal(s.recordedDates?.total, s.tasks.length, 'alle taken zijn vastgelegd');
});

await check('2231 een datumbewerking zonder herberekening (scheduleStale): Ctrl+S schrijft, en heropenen toont wat main toont voor hetzelfde bestand zonder gebouwmodel', async () => {
  const lengthen = (store: Store) => {
    const task = store.getState().tasks.find(t => t.name === 'Set up site')!;
    store.getState().updateTask(task.id, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 } });
    assert.equal(store.getState().datesAsRecorded, false, 'een duurwijziging verlaat de modus');
    assert.equal(store.getState().scheduleStale, true, 'nog niet herberekend');
  };
  const store = await opened(await recordedExample());
  lengthen(store);
  const reopened = await opened(await merged(store));
  const { store: plain } = await openInStore(await recordedExample({ wall: false }), 'zonder-model.ifc');
  assert.equal(plain.getState().ifcSource?.foreign, false);
  lengthen(plain);
  const written = await prepareIfcOutput(plain.getState(), buildWriteIFCInput(plain.getState(), 'merge'));
  assert(!written.prepared, 'zonder gebouwmodel de gewone writer, zoals main');
  const { store: plainReopened } = await openInStore(enc.encode(written.content), 'zonder-model.ifc');
  assert.equal(reopened.getState().datesAsRecorded, plainReopened.getState().datesAsRecorded);
  assert.deepEqual(shown(reopened), shown(plainReopened));
});

function taskTimeArgs(text: string, task: string) {
  const line = text.split('\n').find(l => l.includes(`IFCTASKTIME('${task} Time'`));
  assert(line, `de taaktijd van ${task}`);
  const open = line.indexOf('(');
  return { line, head: line.slice(0, open + 1), args: line.slice(open + 1, line.lastIndexOf(')')).split(',') };
}

function withSlot(text: string, task: string, slot: number, token: string): Uint8Array {
  const { line, head, args } = taskTimeArgs(text, task);
  const changed = [...args];
  changed[slot] = token;
  return enc.encode(text.replace(line, `${head}${changed.join(',')});`));
}

async function verdict(bytes: Uint8Array, input: WriteIFCInput, source: NonNullable<ReturnType<Store['getState']>['ifcSource']>,
  own?: OwnOutputCheck): Promise<string> {
  try { await checkMergeOutput(bytes, input, source, own); return 'aanvaard'; }
  catch (error) {
    return error instanceof MergeNeedsPhase2Error ? [...new Set(error.cases.map(c => c.kind))].sort().join('+') : `fout: ${String(error)}`;
  }
}

async function preparedWithOwn(store: Store) {
  const s = store.getState(), input = buildWriteIFCInput(s, 'merge');
  let own: OwnOutputCheck | undefined;
  const { bytes } = await prepareIfcWrite(input, s.ifcSource!, undefined, observed => { own = observed; });
  assert(own, 'de merge schreef de uitvoer zelf');
  return { input, source: s.ifcSource!, bytes, own };
}

await check('2231 een nagebootste fout in de writer (een andere opgeslagen vroege start) weigert nog met planning-na-openen', async () => {
  const store = await opened(await recordedExample());
  const task = store.getState().tasks.find(t => !t.childIds.length)!;
  store.getState().updateTask(task.id, { name: `${task.name} (hernoemd)` });
  const state = store.getState(), input = buildWriteIFCInput(state, 'merge');
  const text = dec.decode(await merged(store));
  for (const wrong of ["'2027-05-05T07:00:00'", '$']) {
    const faulty = withSlot(text, 'Set up site', TASKTIME_SLOT.earlyStart, wrong);
    await assert.rejects(checkMergeOutput(faulty, input, state.ifcSource!), (error: unknown) => {
      assert(error instanceof MergeNeedsPhase2Error, String(error));
      assert.deepEqual([...new Set(error.cases.map(c => c.kind))], ['planning-na-openen'], refusal(error));
      return true;
    }, `vroege start ${wrong}`);
  }
});

await check('2231 de drie XER-kandidaten van de review: de geldige opslag slaagt, een andere en een ontbrekende vroege start weigeren met planning-na-openen, ook al herstelt het bronarchief de appdatum', async () => {
  const store = await opened(await importedThenSaved(xerWithEarlyDates()));
  assert.equal(store.getState().recordedDates?.origin, 'xer-archive');
  const recorded = store.getState().tasks.find(t => !!store.getState().recordedDates?.times[t.id])!;
  const name = 'Naam uit de XER-proef';
  store.getState().updateTask(recorded.id, { name });
  const { input, source, bytes: good, own } = await preparedWithOwn(store);
  const text = dec.decode(good);
  assert.equal(taskTimeArgs(text, name).args[TASKTIME_SLOT.earlyStart], "'2026-06-02T08:00:00'", 'de merge schreef de vroege start');
  const candidates = [
    ['de geldige uitvoer', good, '2026-06-02T08:00', 'aanvaard'],
    ['een andere vroege start', withSlot(text, name, TASKTIME_SLOT.earlyStart, "'2026-06-04T08:00:00'"), '2026-06-04T08:00', 'planning-na-openen'],
    ['een ontbrekende vroege start', withSlot(text, name, TASKTIME_SLOT.earlyStart, '$'), undefined, 'planning-na-openen'],
  ] as const;
  for (const [label, bytes, slot, expected] of candidates) {
    const { result } = await readIfcBytesDetailed(bytes);
    const read = result.tasks.find(t => t.name === name)!;
    assert.equal(result.recordedFields?.[read.id]?.includes('earlyStart') ? read.time.earlyStart : undefined, slot, `${label}: het slot`);
    const app = (await opened(bytes)).getState().tasks.find(t => t.name === name)!;
    assert.equal(app.time.earlyStart, '2026-06-02T08:00', `${label}: het bronarchief geeft de app de datum uit de XER`);
    assert.equal(await verdict(bytes, input, source, own), expected, label);
  }
});

async function renamedAndWritten(bytes: Uint8Array, task?: string) {
  const store = await opened(bytes);
  const leaves = store.getState().tasks.filter(t => !t.childIds.length && !t.isMilestone);
  const edited = task ? leaves.find(t => t.name === task)! : leaves[0];
  store.getState().updateTask(edited.id, { name: `${edited.name} (hernoemd)` });
  assert.equal(store.getState().datesAsRecorded, true, 'een naam laat de modus staan');
  return { store, edited, ...await preparedWithOwn(store) };
}

await check('2231 de gevallen van review ronde 2 binnen de modus: een leeg slot waar de planning een waarde heeft, weigert met planning-na-openen', async () => {
  const done = await renamedAndWritten(await recordedExample({ progress: 1 }), PROGRESS_TASK);
  const plain = await renamedAndWritten(await recordedExample());
  const completed = `${PROGRESS_TASK} (hernoemd)`;
  const summary = plain.input.tasks.find(t => t.name === '1. Preparation')!;
  const milestone = plain.input.tasks.find(t => t.name === 'Start of refurbishment')!;
  assert.equal(summary.time.scheduleDuration, 8, 'de fase duurt acht dagen');
  assert(milestone.isMilestone && milestone.time.scheduleDuration === 0, 'de mijlpaal heeft een expliciete nulduur');
  const cases: [string, typeof done, string, ProbedSlot][] = [
    ['het werkelijke einde van een taak op 100%', done, completed, 'actualFinish'],
    ['de gereedheid van een taak op 100%', done, completed, 'completion'],
    ['de rest van een taak op 100%', done, completed, 'remainingTime'],
    ['de statustijd van een taak op 100%', done, completed, 'statusTime'],
    ['het duurtype', plain, 'Set up site (hernoemd)', 'durationType'],
    ['de geplande start', plain, 'Set up site (hernoemd)', 'scheduleStart'],
    ['de duur van acht dagen van een fase', plain, summary.name, 'scheduleDuration'],
    ['de nulduur van een mijlpaal', plain, milestone.name, 'scheduleDuration'],
  ];
  for (const written of [done, plain]) assert.equal(await verdict(written.bytes, written.input, written.source, written.own), 'aanvaard', 'de geldige uitvoer');
  for (const [label, written, task, slot] of cases) {
    const text = dec.decode(written.bytes);
    assert.notEqual(taskTimeArgs(text, task).args[TASKTIME_SLOT[slot]], '$', `${label}: de merge schreef het slot`);
    assert.equal(await verdict(withSlot(text, task, TASKTIME_SLOT[slot], '$'), written.input, written.source, written.own), 'planning-na-openen', label);
  }
});

await check('2231 een rest op een eigen kalender van vier uur: de lezer rekent met de kalender van de taak', async () => {
  const running = await renamedAndWritten(await recordedExample({ progress: 0.5, halfDay: true }), PROGRESS_TASK);
  const text = dec.decode(running.bytes), task = `${PROGRESS_TASK} (hernoemd)`;
  const domain = running.input.tasks.find(t => t.name === task)!;
  assert.equal(domain.time.remainingTime, 1.5, 'de rest is anderhalve werkdag');
  assert.equal(taskTimeArgs(text, task).args[TASKTIME_SLOT.remainingTime], "'PT6H0M0S'", 'anderhalve werkdag van vier uur');
  assert.equal(await verdict(running.bytes, running.input, running.source, running.own), 'aanvaard', 'de geldige uitvoer');
  assert.equal(await verdict(withSlot(text, task, TASKTIME_SLOT.remainingTime, "'PT12H0M0S'"), running.input, running.source, running.own),
    'planning-na-openen', 'twaalf uur is op deze kalender drie werkdagen, geen anderhalve');
});

const atHalfPastTen = (input: WriteIFCInput) => {
  input.project = { ...input.project, statusDate: `${input.project.statusDate}T10:30` };
};

await check('2231 de twee kandidaten van review ronde 3: een andere kloktijd van de peildatum en een onbepaald duurtype weigeren met planning-na-openen', async () => {
  const running = await renamedAndWritten(await recordedExample({ progress: 0.5, edit: atHalfPastTen }), PROGRESS_TASK);
  const text = dec.decode(running.bytes), task = `${PROGRESS_TASK} (hernoemd)`, { args } = taskTimeArgs(text, task);
  const statusDate = running.input.project.statusDate!;
  assert.match(statusDate, /^\d{4}-\d{2}-\d{2}T10:30$/, 'de peildatum heeft een kloktijd');
  assert.equal(args[TASKTIME_SLOT.statusTime], `'${statusDate}:00'`, 'de merge schreef de peildatum met haar kloktijd');
  assert.equal(args[TASKTIME_SLOT.durationType], '.WORKTIME.', 'de merge schreef het duurtype');
  const verdictOf = (bytes: Uint8Array) => verdict(bytes, running.input, running.source, running.own);
  assert.equal(await verdictOf(running.bytes), 'aanvaard', 'de geldige uitvoer');
  assert.equal(await verdictOf(withSlot(text, task, TASKTIME_SLOT.statusTime, `'${statusDate.slice(0, 10)}T13:45:00'`)),
    'planning-na-openen', 'een andere kloktijd op dezelfde dag');
  assert.equal(await verdictOf(withSlot(text, task, TASKTIME_SLOT.durationType, '.NOTDEFINED.')), 'planning-na-openen', 'een onbepaald duurtype');
});

const PROBED_SLOTS = [
  'durationType', 'scheduleDuration', 'scheduleStart', 'scheduleFinish', 'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish',
  'freeFloat', 'totalFloat', 'isCritical', 'statusTime', 'actualDuration', 'actualStart', 'actualFinish', 'remainingTime', 'completion',
] as const;
type ProbedSlot = typeof PROBED_SLOTS[number];
const DATE_SLOTS: ReadonlySet<ProbedSlot> = new Set<ProbedSlot>([
  'scheduleStart', 'scheduleFinish', 'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'statusTime', 'actualStart', 'actualFinish',
]);
type DomainTask = WriteIFCInput['tasks'][number];
const WITHHELD_RULE = 'in de modus houdt de schrijfinvoer dit rekenslot achter (withheldTaskTimeFields, ifcSaveInput.ts)';
const EMPTY_BY_RULE: Readonly<Record<ProbedSlot, (task: DomainTask, withheld: readonly string[], statusDate?: string) => string | undefined>> = {
  durationType: () => undefined,
  scheduleDuration: () => undefined,
  scheduleStart: t => (t.time.scheduleStart ? undefined : 'de planning heeft geen geplande start'),
  scheduleFinish: t => (t.time.scheduleFinish ? undefined : 'de planning heeft geen gepland einde'),
  earlyStart: (_t, w) => (w.includes('earlyStart') ? WITHHELD_RULE : undefined),
  earlyFinish: (_t, w) => (w.includes('earlyFinish') ? WITHHELD_RULE : undefined),
  lateStart: (_t, w) => (w.includes('lateStart') ? WITHHELD_RULE : undefined),
  lateFinish: (_t, w) => (w.includes('lateFinish') ? WITHHELD_RULE : undefined),
  freeFloat: (_t, w) => (w.includes('freeFloat') ? WITHHELD_RULE : undefined),
  totalFloat: (_t, w) => (w.includes('totalFloat') ? WITHHELD_RULE : undefined),
  isCritical: (_t, w) => (w.includes('isCritical') ? WITHHELD_RULE : undefined),
  statusTime: (t, _w, statusDate) => (t.time.actualStart || t.time.actualFinish
    ? (statusDate ? undefined : 'het project heeft geen statusdatum')
    : 'de statustijd staat alleen bij een taak met een werkelijke datum (StatusTime in IFC_TASKTIME_SLOTS)'),
  actualDuration: t => (t.time.actualDuration == null ? 'de planning heeft geen werkelijke duur' : undefined),
  actualStart: t => (t.time.actualStart ? undefined : 'de planning heeft geen werkelijke start'),
  actualFinish: t => (t.time.actualFinish ? undefined : 'de planning heeft geen werkelijk einde'),
  remainingTime: t => (t.time.remainingTime == null && t.time.remainingMinutes == null ? 'de planning heeft geen rest' : undefined),
  completion: t => (t.time.completion > 0 ? undefined : 'gereedheid 0 schrijft $, want IfcPositiveRatioMeasure moet groter zijn dan 0 (ifcCompletionReal)'),
};

type SlotSort = 'tijdstip' | 'enum' | 'duur' | 'logische waarde' | 'getal';
const sortOf = (slot: ProbedSlot): SlotSort => DATE_SLOTS.has(slot) ? 'tijdstip' : slot === 'durationType' ? 'enum'
  : slot === 'isCritical' ? 'logische waarde' : slot === 'completion' ? 'getal' : 'duur';

const RULES = {
  'iso-duur': 'ISO 8601: dezelfde duur in een andere schrijfwijze, met weggelaten nulcomponenten of in minuten (parseIfcDuration)',
  werkdag: 'een rest, werkelijke duur of speling van een dagtaak rekent minuten om met de werkdag van de taakkalender, een speling met haar minuten (applyTaskTimeRecords)',
  dagmaat: 'een gebroken dagduur die in minuten staat met haar dagmaatrecord, is dezelfde dagduur in dagen (DayMeasure, dayMeasureIo.ts)',
  getal: 'STEP REAL: hetzelfde getal in een andere schrijfwijze',
} as const;
type RuleId = keyof typeof RULES;
interface Candidate { readonly kind: string; readonly token: string; readonly rule?: RuleId }

const nextDate = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

function stampCandidates(token: string): Candidate[] {
  const m = /^'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):00'$/.exec(token);
  assert(m, `een tijdstip: ${token}`);
  const [, date, clock] = m;
  return [
    { kind: 'een andere dag', token: `'${nextDate(date)}T${clock}:00'` },
    { kind: 'een andere kloktijd op dezelfde dag', token: `'${date}T${clock === '13:45' ? '10:30' : '13:45'}:00'` },
    { kind: 'een datum zonder tijd', token: `'${date}'` },
    clock === '07:00'
      ? { kind: 'middernacht waar 07:00 de datum zonder tijd is', token: `'${date}T00:00:00'` }
      : { kind: '07:00, de datum zonder tijd, waar een kloktijd hoort', token: `'${date}T07:00:00'` },
    { kind: 'de tijdzone Z', token: `'${date}T${clock}:00Z'` },
    { kind: 'de tijdzone +01:00', token: `'${date}T${clock}:00+01:00'` },
    { kind: 'andere seconden', token: `'${date}T${clock}:30'` },
  ];
}

function sameLengthRule(slot: ProbedSlot, task: DomainTask, to: 'uren' | 'dagen', minutes: number): RuleId | undefined {
  const hourTask = taskDurationUnit(task) === 'hours';
  if (slot === 'scheduleDuration') return !hourTask && to === 'dagen' ? 'dagmaat' : undefined;
  if (slot === 'remainingTime') return hourTask ? undefined : 'werkdag';
  if (slot === 'actualDuration') return 'werkdag';
  const own = slot === 'totalFloat' ? task.time.totalFloatMinutes : task.time.freeFloatMinutes;
  return (to === 'uren' ? own === minutes : own === undefined) ? 'werkdag' : undefined;
}

function durationCandidates(slot: ProbedSlot, token: string, task: DomainTask, minutesPerDay: number): Candidate[] {
  const inner = token.slice(1, -1), negative = inner.startsWith('-'), body = negative ? inner.slice(1) : inner, sign = negative ? '-' : '';
  const { days, timeMinutes } = parseIfcDuration(inner);
  const signed = timeMinutes === null ? days * minutesPerDay : timeMinutes + days * minutesPerDay, minutes = Math.abs(signed);
  const planned = Math.abs(Number(task.time[slot as keyof DomainTask['time']] ?? 0));
  const out: Candidate[] = timeMinutes === null ? [
    { kind: 'een andere lengte in dezelfde vorm', token: `'${sign}P0Y0M${Math.abs(days) + 1}D'` },
    { kind: 'dezelfde lengte zonder nulcomponenten', token: `'${sign}P${Math.abs(days)}D'`, rule: 'iso-duur' },
    { kind: 'dezelfde lengte in uren', token: `'${sign}PT${minutes}M'`, rule: sameLengthRule(slot, task, 'uren', signed) },
  ] : [
    { kind: 'een andere lengte in dezelfde vorm', token: `'${sign}${/T\d+H/.test(body) ? body.replace(/T(\d+)H/, (_, h: string) => `T${Number(h) + 1}H`) : body.replace('T', 'T1H')}'` },
    { kind: 'dezelfde lengte in minuten', token: `'${sign}PT${minutes}M'`, rule: 'iso-duur' },
    { kind: 'dezelfde lengte in dagen', token: `'${sign}P0Y0M${planned}D'`, rule: sameLengthRule(slot, task, 'dagen', signed) },
  ];
  if (minutes !== 0) {
    out.push({ kind: 'het andere teken', token: `'${negative ? body : `-${body}`}'` });
    out.push({ kind: 'een nulduur', token: "'P0Y0M0D'" });
  }
  return out;
}

function realCandidates(token: string): Candidate[] {
  const out: Candidate[] = [
    { kind: 'een andere waarde', token: token === '0.37' ? '0.38' : '0.37' },
    { kind: 'hetzelfde getal met een extra nul', token: token.includes('E') ? token.replace('E', '0E') : `${token}0`, rule: 'getal' },
  ];
  if (!token.includes('E')) out.push({ kind: 'hetzelfde getal met een exponent', token: `${token}E0`, rule: 'getal' });
  if (/^0\./.test(token)) out.push({ kind: 'hetzelfde getal zonder cijfer voor de punt', token: token.slice(1) });
  if (Number.isInteger(Number(token))) out.push({ kind: 'hetzelfde getal als INTEGER', token: String(Number(token)) });
  return out;
}

function candidatesFor(slot: ProbedSlot, token: string, task: DomainTask, minutesPerDay: number): Candidate[] {
  switch (sortOf(slot)) {
    case 'tijdstip': return stampCandidates(token);
    case 'enum': return ['.WORKTIME.', '.ELAPSEDTIME.', '.NOTDEFINED.', '.ONBEKEND.'].filter(m => m !== token)
      .map(member => ({ kind: `het lid ${member}`, token: member }));
    case 'logische waarde': return [{ kind: 'de andere waarde', token: token === '.T.' ? '.F.' : '.T.' }, { kind: 'onbekend (.U.)', token: '.U.' }];
    case 'getal': return realCandidates(token);
    default: return durationCandidates(slot, token, task, minutesPerDay);
  }
}

function valueWhereEmpty(slot: ProbedSlot, args: readonly string[]): string {
  const sort = sortOf(slot);
  if (sort === 'tijdstip') return args[TASKTIME_SLOT.scheduleStart];
  if (sort === 'logische waarde') return '.F.';
  if (sort === 'getal') return '0.37';
  return "'P0Y0M23D'";
}

function kindOf(task: DomainTask): string {
  const shape = task.childIds.length ? 'fase' : task.isMilestone ? 'mijlpaal' : 'bladtaak';
  const progress = task.time.actualFinish ? 'voltooid' : task.time.actualStart || task.time.completion > 0 ? 'lopend' : 'niet begonnen';
  return `${shape}, ${progress}`;
}

const PROPERTY_STANDS: readonly Stand[] = [
  ...STANDS,
  { name: 'MSPDI-herkomst met een lopende taak op een kalender van vier uur', make: () => recordedExample({ progress: 0.5, halfDay: true }), task: PROGRESS_TASK },
  { name: 'MSPDI-herkomst met een lopende taak en een peildatum om 10.30 uur', make: () => recordedExample({ progress: 0.5, edit: atHalfPastTen }), task: PROGRESS_TASK },
];
interface Tally { copies: number; refused: number; byRule: Map<RuleId, number> }
const probed = { copies: 0, kinds: new Set<string>(), empty: new Map<string, number>(), byDifference: new Map<string, Tally>() };
for (const { name: stand, make, task: named } of PROPERTY_STANDS) {
  await check(`2231 ${stand}: elk soort verschil in elk tijdslot weigert, behalve wat een regel van de lijst gelijk noemt`, async () => {
    const { input, source, bytes: good, own, edited } = await renamedAndWritten(await make(), named);
    assert.equal(await verdict(good, input, source, own), 'aanvaard', 'de geldige uitvoer');
    const withheld = (id: string): readonly string[] => input.withheldTaskTimeFields?.[id] ?? [];
    const picked = new Map<string, string>([[`${kindOf(input.tasks.find(t => t.id === edited.id)!)} | ${JSON.stringify(withheld(edited.id))}`, edited.id]]);
    for (const t of input.tasks) {
      const key = `${kindOf(t)} | ${JSON.stringify(withheld(t.id))}`;
      if (!picked.has(key)) picked.set(key, t.id);
    }
    const text = dec.decode(good), deviations: string[] = [];
    for (const id of picked.values()) {
      const task = input.tasks.find(t => t.id === id)!, { args } = taskTimeArgs(text, task.name);
      const calendar = resolveCalendar(task.calendarId, input.resourceCalendars ?? [], input.calendar);
      const minutesPerDay = taskMinutesPerDay(task, effHoursPerDay(calendar));
      probed.kinds.add(kindOf(task));
      for (const slot of PROBED_SLOTS) {
        const at = TASKTIME_SLOT[slot], token = args[at];
        const rule = EMPTY_BY_RULE[slot](task, withheld(id), input.project.statusDate);
        if ((token === '$') !== (rule !== undefined)) deviations.push(`${stand} | ${task.name} | ${slot}: de merge schreef ${token}, de regel zegt ${rule ?? 'gevuld'}`);
        if (rule) probed.empty.set(rule, (probed.empty.get(rule) ?? 0) + 1);
        const candidates: Candidate[] = token === '$'
          ? [{ kind: 'een waarde waar de regel het slot leeg laat', token: valueWhereEmpty(slot, args) }]
          : [...candidatesFor(slot, token, task, minutesPerDay), { kind: 'leeg ($) waar de planning een waarde heeft', token: '$' }];
        for (const candidate of candidates) {
          const result = await verdict(withSlot(text, task.name, at, candidate.token), input, source, own);
          const difference = `${sortOf(slot)} | ${candidate.kind}`;
          const tally = probed.byDifference.get(difference) ?? { copies: 0, refused: 0, byRule: new Map<RuleId, number>() };
          probed.byDifference.set(difference, tally);
          tally.copies++;
          probed.copies++;
          if (result === 'planning-na-openen') tally.refused++;
          if (candidate.rule && result === 'aanvaard') tally.byRule.set(candidate.rule, (tally.byRule.get(candidate.rule) ?? 0) + 1);
          if (result !== (candidate.rule ? 'aanvaard' : 'planning-na-openen')) {
            deviations.push(`${stand} | ${kindOf(task)} | ${task.name} | ${slot} | ${candidate.kind}: ${token} → ${candidate.token}: ${result}${candidate.rule ? `, de regel ${candidate.rule} noemt het gelijk` : ''}`);
          }
        }
      }
    }
    assert.equal(deviations.length, 0, `elke kopie weigert met planning-na-openen, behalve wat een regel gelijk noemt:\n${deviations.join('\n')}`);
  });
}

console.log(`Eigenschapsproef: ${probed.copies} kopieën.`);
for (const [difference, tally] of [...probed.byDifference].sort(([a], [b]) => a.localeCompare(b))) {
  const rules = [...tally.byRule].map(([rule, count]) => `${count}× gelijk volgens ${rule}`).join(', ');
  console.log(`VERSCHIL ${difference}: ${tally.copies} kopieën, ${tally.refused} geweigerd${rules ? `, ${rules}` : ''}`);
}
for (const [rule, text] of Object.entries(RULES)) console.log(`REGEL ${rule}: ${text}`);
console.log(`Taaksoorten: ${[...probed.kinds].sort().join('; ')}.`);
for (const [rule, count] of probed.empty) console.log(`LEEG VOLGENS DE REGEL (${count}×) ${rule}`);
console.log(`Opgeslagen datums bij de merge: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
