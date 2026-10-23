// Reviewronde 1A: B6 in beide passes, uitvoerbare late dagvensters en de 24:00-regel.
// Reviewronde 2A: een 24-uurs FS+0-keten verliest geen dag, en een harde MSO-pin wint van B6.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { parseInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';

const calendar: WorkCalendar = { id: 'c', name: 'c', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [] };
const options = { schedulingOptions: effectiveSchedulingOptions({}), projectStartDate: '2026-06-01' };
const task = (id: string, days = 1, start = '2026-06-01T07:00'): Task => ({
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: days === 0, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime(start, days),
});
let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
const fs: Sequence = { id: 'fs', predecessorId: 'M', successorId: 'A', type: 'FINISH_START', lagDays: 0 };

// De reviewerprobe, aangevuld met vrije speling, de exacte grens en de ketenuitzondering.
for (const baseId of ['ops', 'p6', 'msproject'] as const) {
  const opts = { ...options, schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(baseId) }) };
  const m = { ...task('M', 0), milestoneKind: 'START' as const };
  const result = new CPMSolver([m], [], calendar, [], opts).solve().tasks.get('M')!;
  const at = baseId === 'ops' ? '2026-06-01T16:00' : '2026-06-01T07:00';
  eq(`${baseId}: losse START heeft hetzelfde vroege en late moment`,
    [result.earlyStart, result.earlyFinish, result.lateStart, result.lateFinish], [at, at, at, at]);
  eq(`${baseId}: losse START heeft totale en vrije speling nul`, [result.totalFloat, result.freeFloat], [0, 0]);
  const chain = new CPMSolver([m, task('A')], [fs], calendar, [], opts).solve();
  eq(`${baseId}: START in een keten blijft startachtig`, chain.tasks.get('M')?.earlyStart, '2026-06-01T07:00');
}

for (const explicit of [false, true]) {
  const fullDay: WorkCalendar = { ...calendar, workDays: [1, 2, 3, 4, 5, 6, 7],
    workStartHour: 0, workEndHour: 24, hoursPerDay: 24 };
  const bands = [{ start: 0, end: 1440 }];
  if (explicit) fullDay.workTime = { byWeekday: { 1: bands, 2: bands, 3: bands,
    4: bands, 5: bands, 6: bands, 7: bands } };
  for (const days of [1, 2]) {
    const a = task('A', days, '2026-06-01T00:00');
    const result = new CPMSolver([a], [], fullDay, [], options).solve();
    const r = result.tasks.get('A')!;
    const end = `2026-06-0${days + 1}T00:00`;
    eq(`24 uur, expliciet=${explicit}, ${days} d: projectduur`, result.projectDuration, days);
    eq(`24 uur, expliciet=${explicit}, ${days} d: vroeg en laat venster`,
      [r.earlyStart, r.earlyFinish, r.lateStart, r.lateFinish], ['2026-06-01T00:00', end, '2026-06-01T00:00', end]);
    eq(`24 uur, expliciet=${explicit}, ${days} d: totale en vrije speling`, [r.totalFloat, r.freeFloat], [0, 0]);
    // Dezelfde terugrekening wordt ook gebruikt door een finishconstraint.
    const constrained = { ...a, constraint: { type: 'MFO' as const, date: end } };
    const pinned = new CPMSolver([constrained], [], fullDay, [], options).solve().tasks.get('A')!;
    eq(`24 uur, expliciet=${explicit}, ${days} d: eindpin rekent vanaf de eindwerkdag`, pinned.earlyStart, '2026-06-01T00:00');
  }
}

for (const bands of [
  [{ start: 420, end: 660 }],
  [{ start: 480, end: 600 }, { start: 780, end: 1020 }],
]) {
  const c: WorkCalendar = { ...calendar, workingExceptions: [{ name: 'Andere werkblokken',
    startDate: '2026-06-02', endDate: '2026-06-02', bands }] };
  const result = new CPMSolver([task('A', 1, '2026-06-01T13:00'), task('B', 1, '2026-06-02T07:00')],
    [], c, [], options).solve().tasks.get('A')!;
  const engine = new CalendarEngine(c);
  const ls = parseInstant(result.lateStart), lf = parseInstant(result.lateFinish);
  eq(`uitzondering ${JSON.stringify(bands)}: LS ≤ LF`, ls <= lf, true);
  eq(`uitzondering ${JSON.stringify(bands)}: late start op werkmoment`, engine.isWorkInstant(ls), true);
  eq(`uitzondering ${JSON.stringify(bands)}: dagtaak heeft resterende werktijd`, engine.workMinutesBetween(ls, lf) > 0, true);
  eq(`uitzondering ${JSON.stringify(bands)}: hele-dagvenster`,
    [result.lateStart, result.lateFinish], bands.length === 1
      ? ['2026-06-02T07:00', '2026-06-02T11:00'] : ['2026-06-02T16:00', '2026-06-02T17:00']);
  // Vanaf de gevonden late start moet de echte voorwaartse berekening dit venster uitvoeren.
  const replay = new CPMSolver([task('A', 1, result.lateStart)], [], c, [], options).solve().tasks.get('A')!;
  eq(`uitzondering ${JSON.stringify(bands)}: laat venster uitvoerbaar`,
    [replay.earlyStart, replay.earlyFinish], [result.lateStart, result.lateFinish]);
}
// Gelijke werkblokken bewaren de middagstart; de pauze telt niet als werktijd.
const unchanged = new CPMSolver([task('A', 1, '2026-06-01T13:00'), task('B', 1, '2026-06-02T07:00')],
  [], calendar, [], options).solve().tasks.get('A')!;
eq('gelijke werkblokken bewaren de middagstart', unchanged.lateStart, '2026-06-02T13:00');

// Dezelfde eindwerkdagbepaling herstelt vanzelf het bestaande nachtvenster.
const nightBand = [{ start: 1320, end: 1800 }];
const night: WorkCalendar = { ...calendar, workTime: { byWeekday: {
  1: nightBand, 2: nightBand, 3: nightBand, 4: nightBand, 5: nightBand, 6: [], 7: [],
} } };
for (const chained of [false, true]) {
  const a = task('A', 1, '2026-06-01T22:00'), b = task('B', 1, '2026-06-01T22:00');
  const result = new CPMSolver(chained ? [a, b] : [a], chained
    ? [{ ...fs, predecessorId: 'A', successorId: 'B', lagDays: 1 }] : [], night, [], options).solve();
  const r = result.tasks.get('A')!;
  eq(`nacht, keten=${chained}: geldig laat venster`,
    [r.lateStart, r.lateFinish], ['2026-06-01T22:00', '2026-06-02T06:00']);
  eq(`nacht, keten=${chained}: geen negatieve speling`, [r.totalFloat, r.freeFloat], [0, 0]);
  eq(`nacht, keten=${chained}: projectduur volgt de werkdag`, result.projectDuration, chained ? 3 : 1);
  if (chained) {
    const successor = result.tasks.get('B')!;
    eq('nacht: FS+1 houdt één werkdag tussen de taken',
      [successor.earlyStart, successor.earlyFinish, successor.lateStart, successor.lateFinish],
      ['2026-06-03T22:00', '2026-06-04T06:00', '2026-06-03T22:00', '2026-06-04T06:00']);
  }
}

// Ronde 2A, punt 1: de opvolgergrens di 00:00 is ook het geldige einde van maandag. De wacht voor
// hele dagen mag A daarom niet nog een dag terugzetten (eerder: laat zo 00:00–ma 00:00, speling −1).
for (const baseId of ['ops', 'p6', 'msproject'] as const) {
  const opts = { ...options, schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(baseId) }) };
  for (const explicit of [false, true]) {
    const fullDay: WorkCalendar = { ...calendar, workDays: [1, 2, 3, 4, 5, 6, 7],
      workStartHour: 0, workEndHour: 24, hoursPerDay: 24 };
    const bands = [{ start: 0, end: 1440 }];
    if (explicit) fullDay.workTime = { byWeekday: { 1: bands, 2: bands, 3: bands,
      4: bands, 5: bands, 6: bands, 7: bands } };
    const result = new CPMSolver([task('A', 1, '2026-06-01T00:00'), task('B', 1, '2026-06-01T00:00')],
      [{ ...fs, predecessorId: 'A', successorId: 'B' }], fullDay, [], opts).solve();
    const a = result.tasks.get('A')!, b = result.tasks.get('B')!;
    const label = `${baseId}, 24 uur expliciet=${explicit}, FS+0`;
    eq(`${label}: vroeg en laat venster van A`, [a.earlyStart, a.earlyFinish, a.lateStart, a.lateFinish],
      ['2026-06-01T00:00', '2026-06-02T00:00', '2026-06-01T00:00', '2026-06-02T00:00']);
    eq(`${label}: totale en vrije speling van A`, [a.totalFloat, a.freeFloat], [0, 0]);
    eq(`${label}: vroeg en laat venster van B`, [b.earlyStart, b.earlyFinish, b.lateStart, b.lateFinish],
      ['2026-06-02T00:00', '2026-06-03T00:00', '2026-06-02T00:00', '2026-06-03T00:00']);
  }
}

// Ronde 2A, punt 2 en het orkestratorbesluit erna: een MSO of MFO op een losse mijlpaal legt één moment
// vast, zacht of hard. Vroeg en laat moment zijn gelijk, de speling is nul, er is geen schending en de
// mijlpaal blijft op de dag van de constraint. Zonder tijd: MSO ⇒ D1 (di 07:00), MFO ⇒ D2 (di 16:00).
// Eerder: B6 schoof naar 16:00, de late kant viel terug naar ma 16:00, een START met MFO ging naar wo
// 07:00, en onder P6/MSP begon de late kant op een scalaire kalender op di 07:00.
const blockBands = [{ start: 420, end: 960 }];
const blockCalendar: WorkCalendar = { ...calendar, workTime: { byWeekday: {
  1: blockBands, 2: blockBands, 3: blockBands, 4: blockBands, 5: blockBands, 6: [], 7: [],
} } };
for (const baseId of ['ops', 'p6', 'msproject'] as const) {
  const opts = { ...options, schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(baseId) }) };
  for (const [calendarName, cal] of [['dagkalender', calendar], ['blokkenkalender', blockCalendar]] as const) {
    for (const hard of [false, true]) {
      for (const type of ['MSO', 'MFO'] as const) {
        const dayBoundary = type === 'MSO' ? '2026-06-02T07:00' : '2026-06-02T16:00';
        for (const kind of ['START', 'FINISH'] as const) {
          for (const date of ['2026-06-02', dayBoundary, '2026-06-02T10:00']) {
            const m = { ...task('M', 0), milestoneKind: kind, constraint: { type, date, hard } };
            const result = new CPMSolver([m], [], cal, [], opts).solve();
            const r = result.tasks.get('M')!;
            const at = date.includes('T') ? date : dayBoundary;
            const label = `${baseId}, ${calendarName}: losse ${kind} met ${hard ? 'harde' : 'zachte'} ${type} ${date}`;
            eq(`${label}: vroeg en laat moment op de constraint`,
              [r.earlyStart, r.earlyFinish, r.lateStart, r.lateFinish], [at, at, at, at]);
            eq(`${label}: totale en vrije speling nul`, [r.totalFloat, r.freeFloat], [0, 0]);
            eq(`${label}: geen constraintschending gemeld`, result.violatedConstraintTaskIds, []);
          }
        }
      }
    }
    // Een MSO op het blokeinde blijft op die dag, ook als harde pin (eerder: wo 07:00).
    for (const hard of [false, true]) {
      const m = { ...task('M', 0), milestoneKind: 'START' as const,
        constraint: { type: 'MSO' as const, date: '2026-06-02T16:00', hard } };
      const r = new CPMSolver([m], [], cal, [], opts).solve().tasks.get('M')!;
      eq(`${baseId}, ${calendarName}: START met ${hard ? 'harde' : 'zachte'} MSO di 16:00 blijft op dinsdag`,
        [r.earlyStart, r.lateStart, r.totalFloat], ['2026-06-02T16:00', '2026-06-02T16:00', 0]);
    }
  }
}
// Een START-mijlpaal met voorganger en een zachte MFO blijft ook op het moment van de MFO (eerder: vroeg
// wo 07:00 met schending; tussenstand: vroeg di 16:00, laat di 07:00, speling −1).
for (const baseId of ['ops', 'p6', 'msproject'] as const) {
  const opts = { ...options, schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(baseId) }) };
  for (const [calendarName, cal] of [['dagkalender', calendar], ['blokkenkalender', blockCalendar]] as const) {
    const m = { ...task('M', 0), milestoneKind: 'START' as const, constraint: { type: 'MFO' as const, date: '2026-06-02' } };
    const result = new CPMSolver([task('A'), m], [{ ...fs, predecessorId: 'A', successorId: 'M' }], cal, [], opts).solve();
    const r = result.tasks.get('M')!;
    eq(`${baseId}, ${calendarName}: START na voorganger met zachte MFO di`,
      [r.earlyStart, r.lateStart, r.totalFloat, r.freeFloat, result.violatedConstraintTaskIds],
      ['2026-06-02T16:00', '2026-06-02T16:00', 0, 0, []]);
  }
}

// De late kant begint alleen op het begin van de projecteinddag als de mijlpaal zelf op het begin van zijn
// werkdag staat. Eerder: onder P6/MSP op een scalaire kalender kreeg een START om 10:00 laat 07:00,
// speling −0,375 (op be58ba356: 0), en een mijlpaal zonder soort na een voorganger met een zachte MFO
// kreeg laat ma 07:00 bij vroeg ma 16:00, speling −1 (op be58ba356: 0).
for (const baseId of ['ops', 'p6', 'msproject'] as const) {
  const opts = { ...options, schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(baseId) }) };
  for (const [calendarName, cal] of [['dagkalender', calendar], ['blokkenkalender', blockCalendar]] as const) {
    const m = { ...task('M', 0, '2026-06-02T10:00'), milestoneKind: 'START' as const };
    const r = new CPMSolver([m], [], cal, [], opts).solve().tasks.get('M')!;
    eq(`${baseId}, ${calendarName}: losse START om 10:00 zonder constraint`,
      [r.earlyStart, r.lateStart, r.totalFloat, r.freeFloat], ['2026-06-02T10:00', '2026-06-02T10:00', 0, 0]);

    const n = { ...task('N', 0, '2026-09-07T07:00'), constraint: { type: 'MFO' as const, date: '2026-09-21' } };
    const chain = new CPMSolver([task('P', 5, '2026-09-07T07:00'), task('Q', 5, '2026-09-07T07:00'), n], [
      { ...fs, id: 'pq', predecessorId: 'P', successorId: 'Q' }, { ...fs, id: 'qn', predecessorId: 'Q', successorId: 'N' },
    ], cal, [], { ...opts, projectStartDate: '2026-09-07' }).solve();
    const rn = chain.tasks.get('N')!;
    eq(`${baseId}, ${calendarName}: mijlpaal zonder soort na voorganger met zachte MFO`,
      [rn.earlyStart, rn.lateStart, rn.totalFloat, rn.freeFloat, chain.violatedConstraintTaskIds],
      ['2026-09-21T16:00', '2026-09-21T16:00', 0, 0, []]);
  }
  // Waarvoor de plaats bedoeld is blijft: een START op het begin van de laatste projectdag, terwijl een
  // andere taak die dag tot 16:00 loopt, heeft speling nul.
  const start = { ...task('M', 0, '2026-06-02T07:00'), milestoneKind: 'START' as const };
  const last = new CPMSolver([task('A'), start, task('B', 2)], [{ ...fs, predecessorId: 'A', successorId: 'M' }],
    calendar, [], opts).solve().tasks.get('M')!;
  eq(`${baseId}, dagkalender: START op het begin van de laatste projectdag`,
    [last.earlyStart, last.lateStart, last.totalFloat], ['2026-06-02T07:00', '2026-06-02T07:00', 0]);
}

// Ronde 3A, punt 2: op een scalaire 24-uurskalender is het projecteinde wo 00:00 het einde van dinsdag.
// De START op het begin van die laatste werkdag (di 00:00) houdt speling 0 en blijft kritiek (eerder:
// laat wo 00:00, speling +1; op be58ba356: speling 0).
for (const baseId of ['ops', 'p6', 'msproject'] as const) {
  const opts = { ...options, schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(baseId) }) };
  const fullDay: WorkCalendar = { ...calendar, workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 24 };
  const m = { ...task('M', 0, '2026-06-01T00:00'), milestoneKind: 'START' as const };
  const result = new CPMSolver([task('P', 1, '2026-06-01T00:00'), m, task('B', 2, '2026-06-01T00:00')],
    [{ ...fs, predecessorId: 'P', successorId: 'M' }], fullDay, [], opts).solve();
  const r = result.tasks.get('M')!;
  eq(`${baseId}: START op de laatste 24-uurswerkdag`, [r.earlyStart, r.lateStart, r.totalFloat, r.isCritical],
    ['2026-06-02T00:00', '2026-06-02T00:00', 0, true]);
}

// Ronde 4: de START staat zelf op het projecteinde. P (1 of 2 d vanaf ma 00:00), FS+0 naar M, zonder B. Het
// projecteinde (di of wo 00:00) is dan ook het begin van de dag van M: M en P houden speling 0 (ronde 3: −1,
// P met een late start vóór het projectbegin). Een tweede START Q via SS+0 op ma 00:00 houdt speling tot
// die laatste dag (1 of 2 d), zoals op de basis. Een ingesteld projecteinde blijft een eindmoment: einde
// di, M op wo 00:00 ⇒ speling −1, zoals op de basis.
for (const baseId of ['ops', 'p6', 'msproject'] as const) {
  const opts = { ...options, schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(baseId) }) };
  const fullDay: WorkCalendar = { ...calendar, workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 24 };
  const m = { ...task('M', 0, '2026-06-01T00:00'), milestoneKind: 'START' as const };
  const q = { ...task('Q', 0, '2026-06-01T00:00'), milestoneKind: 'START' as const };
  for (const days of [1, 2]) {
    const end = days === 1 ? '2026-06-02T00:00' : '2026-06-03T00:00';
    const result = new CPMSolver([task('P', days, '2026-06-01T00:00'), m, q], [
      { ...fs, predecessorId: 'P', successorId: 'M' },
      { ...fs, id: 'ss', predecessorId: 'P', successorId: 'Q', type: 'START_START' },
    ], fullDay, [], opts).solve();
    const get = (id: string) => result.tasks.get(id)!;
    eq(`${baseId}: START op het projecteinde na P van ${days} d`,
      [get('M').earlyStart, get('M').lateStart, get('M').totalFloat, get('P').lateStart, get('P').totalFloat],
      [end, end, 0, '2026-06-01T00:00', 0]);
    eq(`${baseId}: tweede START op ma naast de START op het projecteinde (P ${days} d)`,
      [get('Q').lateStart, get('Q').totalFloat], [end, days]);
  }
  const fixedEnd = new CPMSolver([task('P', 2, '2026-06-01T00:00'), m], [{ ...fs, predecessorId: 'P', successorId: 'M' }],
    fullDay, [], { ...opts, projectEndDate: '2026-06-02',
      schedulingOptions: { ...opts.schedulingOptions, useProjectEndDateForFloat: true } }).solve().tasks.get('M')!;
  eq(`${baseId}: START op wo 00:00 na een ingesteld projecteinde di`,
    [fixedEnd.earlyStart, fixedEnd.lateStart, fixedEnd.totalFloat], ['2026-06-03T00:00', '2026-06-02T00:00', -1]);
}

// Ronde 5: het dagbegin van de laatste projectdag komt uit de eigen kalender van de taak. P (ma, kalender
// 7–16) FS+0 naar START M: het projecteinde di 07:00 opent dinsdag. R (ma, kalender 8–16) SS+0 naar START
// Q met ALAP: Q hoort op di 08:00, speling 0, kritiek (ronde 4: laat di 07:00, buiten zijn werktijd; ALAP
// liet Q dan op ma 08:00 staan, met speling 1). Zowel via de solver als via `runCPM` in de store.
// Gemengd met een 24-uurskalender (projecteinde di 00:00): Q zonder ALAP krijgt laat het dagbegin van
// dinsdag op zijn eigen kalender, met speling 1, zoals op de basis (ronde 4: di 00:00).
{
  const morning: WorkCalendar = { ...calendar, id: 'ochtend', name: 'Ploeg 8-16', workStartHour: 8 };
  const fullDay: WorkCalendar = { ...calendar, id: 'continu', workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0,
    workEndHour: 24, hoursPerDay: 24 };
  const sequences: Sequence[] = [
    { ...fs, id: 'pm', predecessorId: 'P', successorId: 'M' },
    { ...fs, id: 'rq', predecessorId: 'R', successorId: 'Q', type: 'START_START' },
  ];
  // R en Q beginnen op het dagbegin van hun eigen kalender.
  const network = (pStart: string, other: WorkCalendar, alap: boolean): Task[] => [
    task('P', 1, pStart),
    { ...task('M', 0, pStart), milestoneKind: 'START' },
    { ...task('R', 1, `2026-06-01T0${other.workStartHour}:00`), calendarId: other.id },
    { ...task('Q', 0, `2026-06-01T0${other.workStartHour}:00`), calendarId: other.id, milestoneKind: 'START',
      ...(alap ? { constraint: { type: 'ALAP' as const } } : {}) },
  ];
  const want = ['2026-06-02T08:00', '2026-06-02T08:00', 0, true];
  for (const baseId of ['ops', 'p6', 'msproject'] as const) {
    const profile = builtInProfile(baseId);
    const opts = { ...options, schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: profile }) };
    const solved = new CPMSolver(network('2026-06-01T07:00', morning, true), sequences, calendar, [morning], opts)
      .solve().tasks.get('Q')!;
    eq(`${baseId}: ALAP-START op een kalender 8–16 naast een projecteinde di 07:00 (solver)`,
      [solved.earlyStart, solved.lateStart, solved.totalFloat, solved.isCritical], want);

    const ctx = createAppStoreContext();
    const S = () => ctx.store.getState();
    S().newProject();
    S().setProject({ startDate: '2026-06-01', schedulingProfile: profile });
    S().setCalendar({ ...calendar, id: S().calendar.id });
    const morningId = S().addCalendar({ ...morning });
    const ids = new Map<string, string>();
    for (const t of network('2026-06-01T07:00', morning, true)) {
      const id = S().addTask({ name: t.name, parentId: null, isMilestone: t.isMilestone, milestoneKind: t.milestoneKind,
        calendarId: t.calendarId ? morningId : undefined, constraint: t.constraint });
      ids.set(t.id, id);
      const own = S().tasks.find(x => x.id === id)!;
      S().updateTask(id, { time: { ...own.time, scheduleStart: t.time.scheduleStart, scheduleDuration: t.time.scheduleDuration } });
    }
    for (const s of sequences) {
      S().addSequence({ predecessorId: ids.get(s.predecessorId)!, successorId: ids.get(s.successorId)!, type: s.type, lagDays: 0 });
    }
    S().runCPM();
    const stored = S().tasks.find(t => t.id === ids.get('Q'))!.time;
    eq(`${baseId}: ALAP-START op een kalender 8–16 naast een projecteinde di 07:00 (store)`,
      [stored.earlyStart, stored.lateStart, stored.totalFloat, stored.isCritical], want);

    for (const other of [calendar, morning]) {
      const otherCal = { ...other, id: `ander-${other.workStartHour}` };
      const mixed = new CPMSolver(network('2026-06-01T00:00', otherCal, false), sequences, fullDay, [otherCal], opts)
        .solve().tasks.get('Q')!;
      const dayStart = `2026-06-02T0${other.workStartHour}:00`;
      eq(`${baseId}: START op een kalender ${other.workStartHour}–16 naast een 24-uursprojecteinde di 00:00`,
        [mixed.earlyStart, mixed.lateStart, mixed.totalFloat], [`2026-06-01T0${other.workStartHour}:00`, dayStart, 1]);
    }
  }
}

// Ronde 3A, punt 3: een SNLT is startachtig, ook op een mijlpaal. P op maandag, FS+0 naar M, SNLT di:
// M staat vroeg en laat op di 07:00, zonder schending (eerder: laat ma 16:00 en een gemelde schending).
for (const baseId of ['ops', 'p6', 'msproject'] as const) {
  const opts = { ...options, schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(baseId) }) };
  for (const [calendarName, cal] of [['dagkalender', calendar], ['blokkenkalender', blockCalendar]] as const) {
    for (const kind of ['START', undefined] as const) {
      for (const date of ['2026-06-02', '2026-06-02T07:00']) {
        const m = { ...task('M', 0), ...(kind ? { milestoneKind: kind } : {}), constraint: { type: 'SNLT' as const, date } };
        const result = new CPMSolver([task('P'), m], [{ ...fs, predecessorId: 'P', successorId: 'M' }], cal, [], opts).solve();
        const r = result.tasks.get('M')!;
        eq(`${baseId}, ${calendarName}: ${kind ?? 'mijlpaal zonder soort'} na P met SNLT ${date}`,
          [r.earlyStart, r.lateStart, r.totalFloat, result.violatedConstraintTaskIds],
          ['2026-06-02T07:00', '2026-06-02T07:00', 0, []]);
      }
    }
  }
}

// Ronde 3A, punt 1: een FNET die een START-mijlpaal verschuift, legt een eindmoment vast. FNET di
// (opgeslagen als di 16:00) blijft di 16:00, en schuift niet door naar wo 07:00 (of, los, met B6 naar
// wo 16:00). Bij een gelijkspel met de voorganger (P eindigt zelf di 16:00) geldt de gewone startsnap.
for (const baseId of ['ops', 'p6', 'msproject'] as const) {
  const opts = { ...options, schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(baseId) }) };
  for (const [calendarName, cal] of [['dagkalender', calendar], ['blokkenkalender', blockCalendar]] as const) {
    for (const kind of ['START', undefined] as const) {
      const label = `${baseId}, ${calendarName}: ${kind ?? 'mijlpaal zonder soort'}`;
      for (const date of ['2026-06-02', '2026-06-02T16:00']) {
        const m = { ...task('M', 0), ...(kind ? { milestoneKind: kind } : {}), constraint: { type: 'FNET' as const, date } };
        const afterP = new CPMSolver([task('P'), m], [{ ...fs, predecessorId: 'P', successorId: 'M' }], cal, [], opts).solve();
        const r = afterP.tasks.get('M')!;
        eq(`${label} na P met FNET ${date}`,
          [r.earlyStart, r.lateStart, r.totalFloat, afterP.violatedConstraintTaskIds],
          ['2026-06-02T16:00', '2026-06-02T16:00', 0, []]);
        const alone = new CPMSolver([m], [], cal, [], opts).solve().tasks.get('M')!;
        eq(`${label} los met FNET ${date}`, [alone.earlyStart, alone.lateStart], ['2026-06-02T16:00', '2026-06-02T16:00']);
      }
      const m = { ...task('M', 0), ...(kind ? { milestoneKind: kind } : {}), constraint: { type: 'FNET' as const, date: '2026-06-02' } };
      const tie = new CPMSolver([task('P', 2), m], [{ ...fs, predecessorId: 'P', successorId: 'M' }], cal, [], opts)
        .solve().tasks.get('M')!;
      eq(`${label} met FNET di na P tot di 16:00 (gelijkspel)`, tie.earlyStart, '2026-06-03T07:00');
      // Ook via FF+0 verandert een FNET die gelijk valt met de voorganger niets.
      const tieFf = new CPMSolver([task('P', 2), m],
        [{ ...fs, predecessorId: 'P', successorId: 'M', type: 'FINISH_FINISH' }], cal, [], opts).solve();
      const tieFfWithout = new CPMSolver([task('P', 2), { ...m, constraint: undefined }],
        [{ ...fs, predecessorId: 'P', successorId: 'M', type: 'FINISH_FINISH' }], cal, [], opts).solve();
      eq(`${label} met FNET di na P tot di 16:00 via FF (gelijkspel, als zonder FNET)`,
        tieFf.tasks.get('M')!.earlyStart, tieFfWithout.tasks.get('M')!.earlyStart);
    }
  }
}

// B6 blijft gelden voor een losse mijlpaal met een andere constraint (SNET): einde van de werkdag.
{
  const m = { ...task('M', 0), milestoneKind: 'START' as const, constraint: { type: 'SNET' as const, date: '2026-06-02' } };
  const r = new CPMSolver([m], [], calendar, [], options).solve().tasks.get('M')!;
  eq('ops: losse START met SNET houdt B6', [r.earlyStart, r.lateStart, r.totalFloat], ['2026-06-02T16:00', '2026-06-02T16:00', 0]);
}

for (const error of errors) console.error(`XX ${error}`);
console.log(`F2-review: ${checks - errors.length}/${checks} controles geslaagd`);
process.exitCode = errors.length ? 1 : 0;
