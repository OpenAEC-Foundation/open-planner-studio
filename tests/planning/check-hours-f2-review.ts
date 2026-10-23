// Reviewronde 1A: B6 in beide passes, uitvoerbare late dagvensters en de 24:00-regel.
// Reviewronde 2A: een 24-uurs FS+0-keten verliest geen dag, en een harde MSO-pin wint van B6.
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

// Ronde 2A, punt 2: een losse mijlpaal met een harde MSO blijft op zijn pin (D1: di 07:00). B6 is
// alleen de standaardplaats; zonder voorrang kreeg de mijlpaal vroeg 16:00 en laat 07:00, speling −1.
for (const baseId of ['ops', 'p6', 'msproject'] as const) {
  const opts = { ...options, schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(baseId) }) };
  for (const kind of ['START', 'FINISH'] as const) {
    for (const date of ['2026-06-02', '2026-06-02T07:00']) {
      const m = { ...task('M', 0), milestoneKind: kind, constraint: { type: 'MSO' as const, date, hard: true } };
      const result = new CPMSolver([m], [], calendar, [], opts).solve();
      const r = result.tasks.get('M')!;
      const at = '2026-06-02T07:00';
      const label = `${baseId}: losse ${kind} met harde MSO ${date}`;
      eq(`${label}: vroeg en laat moment op de pin`, [r.earlyStart, r.earlyFinish, r.lateStart, r.lateFinish], [at, at, at, at]);
      eq(`${label}: totale en vrije speling nul`, [r.totalFloat, r.freeFloat], [0, 0]);
      eq(`${label}: geen constraintschending gemeld`, result.violatedConstraintTaskIds, []);
    }
  }
}

for (const error of errors) console.error(`XX ${error}`);
console.log(`F2-review: ${checks - errors.length}/${checks} controles geslaagd`);
process.exitCode = errors.length ? 1 : 0;
