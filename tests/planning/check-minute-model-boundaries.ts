// F2: D7 mag de projectvloer niet verzetten; T8 bindt SF aan het echte startmoment.
// Een expliciete urenkalender houdt haar bestaande late mijlpaalmoment (§6.1).
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';

const calendar: WorkCalendar = { id: 'c', name: 'c', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [] };
const options = { schedulingOptions: effectiveSchedulingOptions({}), projectStartDate: '2026-06-01' };
const task = (id: string, days: number, start = '2026-06-01T07:00'): Task => ({
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: days === 0, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime(start, days),
});
const sf: Sequence = { id: 'sf', predecessorId: 'M', successorId: 'B', type: 'START_FINISH', lagDays: 0 };
let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}
{
  const milestone = { ...task('M', 0, '2026-06-01T16:00'), milestoneKind: 'FINISH' as const };
  const result = new CPMSolver([milestone, task('B', 2)], [sf], calendar, [], options).solve();
  eq('D7 geeft geen extra projectdag', result.tasks.get('B')?.earlyStart, '2026-06-01T07:00');
  eq('mk-14 houdt zijn einde op dagniveau', result.tasks.get('B')?.earlyFinish, '2026-06-02T16:00');
  const earlier = task('R', 1, '2026-05-28T07:00');
  const loose = new CPMSolver([earlier, milestone, task('B', 2)], [sf], calendar, [],
    { ...options, projectStartDate: '2026-05-28' }).solve();
  eq('SF zonder projectafkap start op vrijdag', loose.tasks.get('B')?.earlyStart, '2026-05-29T07:00');
  eq('SF bindt het einde aan het echte mijlpaalmoment', loose.tasks.get('B')?.earlyFinish, '2026-06-01T16:00');
}
{
  const band = [{ start: 480, end: 960 }];
  const hourCalendar: WorkCalendar = { ...calendar, workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } } };
  const a = task('A', 1, '2026-07-07T08:00');
  a.time.durationUnit = 'hours'; a.time.durationMinutes = 720;
  const m = { ...task('M', 0, '2026-07-06T08:00'), milestoneKind: 'START' as const };
  const result = new CPMSolver([a, m], [{ ...sf, predecessorId: 'A', successorId: 'M', type: 'START_START', lagMinutes: 240 }], hourCalendar, [], options).solve();
  eq('START-mijlpaal op urenkalender houdt het late moment', result.tasks.get('M')?.lateFinish, '2026-07-08T12:00');
}
{
  const m = { ...task('M', 0, '2026-06-05T16:00'), milestoneKind: 'FINISH' as const };
  m.time = { ...m.time, completion: 1, actualStart: '2026-06-05T16:00', actualFinish: '2026-06-05T16:00' };
  const result = new CPMSolver([m], [], calendar, [], options).solve();
  eq('D7 voltooide eindmijlpaal blijft één feitelijk moment',
    [result.tasks.get('M')?.earlyStart, result.tasks.get('M')?.earlyFinish], ['2026-06-05T16:00', '2026-06-05T16:00']);
  const elapsed = task('E', 1);
  elapsed.time = { ...elapsed.time, durationType: 'ELAPSEDTIME', completion: 1,
    actualStart: '2026-06-06T00:00', actualFinish: '2026-06-07T00:00' };
  const complete = new CPMSolver([elapsed], [], calendar, [], options).solve();
  eq('D3 voltooid kalendertijdvenster bewaart de feiten',
    [complete.tasks.get('E')?.earlyStart, complete.tasks.get('E')?.earlyFinish], ['2026-06-06T00:00', '2026-06-07T00:00']);
  const a = task('A', 1), z = task('Z', 1, '2026-06-05T08:00');
  z.time.durationUnit = 'hours'; z.time.durationMinutes = 240;
  const float = new CPMSolver([a, z], [], calendar, [], options).solve();
  eq('dagspeling telt onafhankelijk van de kloktijd', float.tasks.get('A')?.totalFloat, 4);
  const end = task('Eind', 0);
  const term = new CPMSolver([a, end, task('Lang', 5)],
    [{ ...sf, predecessorId: 'A', successorId: 'Eind', type: 'FINISH_START' }], calendar, [], options).solve();
  eq('mijlpaal zonder soort na FS gebruikt de startkant voor late daggrens', term.tasks.get('Eind')?.lateFinish, '2026-06-05T07:00');
}
{
  // Twee actuele takken blijven twee kritieke paden, ook met een gedeelde voltooide voorganger.
  const completed = task('C', 1);
  completed.time = { ...completed.time, completion: 1, actualStart: '2026-06-01T07:00', actualFinish: '2026-06-01T16:00' };
  const result = new CPMSolver([completed, task('A', 2), task('B', 2)], ['A', 'B'].map(id => ({
    ...sf, id, predecessorId: 'C', successorId: id, type: 'FINISH_START' as const,
  })), calendar, [], { ...options, dataDate: '2026-06-02T07:00', schedulingOptions: effectiveSchedulingOptions({ schedulingOptions: {
    floatPaths: { enabled: true, method: 'FREE_FLOAT', maxPaths: 4 },
  } }) }).solve();
  eq('twee kritieke takken met gedeelde historie blijven herkenbaar', result.criticalPaths.length, 2);
  eq('extra kritieke paden bevatten alleen kritieke activiteiten',
    result.criticalPaths.slice(1).every(path => path.every(id => result.tasks.get(id)?.isCritical)), true);
}
{
  // F2 telt hele dagen, maar de terugrekening mag geen onmogelijke late kant maken.
  const band = [{ start: 480, end: 960 }];
  const hours: WorkCalendar = { ...calendar, id: 'h', workTime: {
    byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] },
  } };
  const d = task('D', 2, '2026-07-06T07:00');
  const h = task('H', 1, '2026-07-06T08:00');
  h.calendarId = 'h'; h.time.durationUnit = 'hours'; h.time.durationMinutes = 240;
  const link = { ...sf, predecessorId: 'D', successorId: 'H', type: 'FINISH_START' as const };
  const opts = { ...options, projectStartDate: '2026-07-06' };
  const result = new CPMSolver([d, h], [link], calendar, [hours], opts).solve();
  eq('dag → uur: late dagfinish past volledig vóór woensdag 08:00',
    [result.tasks.get('D')?.lateStart, result.tasks.get('D')?.lateFinish, result.tasks.get('D')?.totalFloat],
    ['2026-07-06T07:00', '2026-07-07T16:00', 0]);
  d.time.scheduleDuration = 1;
  const reverse = new CPMSolver([h, d], [{ ...link, predecessorId: 'H', successorId: 'D' }], calendar, [hours], opts).solve();
  eq('uur → dag: F2 houdt de hele dag vanaf maandag 13:00',
    [reverse.tasks.get('D')?.earlyStart, reverse.tasks.get('D')?.earlyFinish],
    ['2026-07-06T13:00', '2026-07-06T16:00']);
  eq('uur → dag: late start bewaart het moment van dezelfde vroege dag',
    [reverse.tasks.get('D')?.lateStart, reverse.tasks.get('D')?.lateFinish],
    ['2026-07-06T13:00', '2026-07-06T16:00']);
  eq('uur → dag: voorganger zonder harde grens heeft geen negatieve speling',
    [reverse.tasks.get('H')?.lateStart, reverse.tasks.get('H')?.lateFinish, reverse.tasks.get('H')?.totalFloat],
    ['2026-07-06T09:00', '2026-07-06T13:00', 0.125]);
  // Gelijke werkdagen: de bestaande urenloper toont welk einde de F3-loper moet bereiken.
  const exactDay = { ...d, time: { ...d.time, durationUnit: 'hours' as const, durationMinutes: 480 } };
  const exact = new CPMSolver([h, exactDay], [{ ...link, predecessorId: 'H', successorId: 'D' }], calendar, [hours], opts).solve();
  eq('uur → dag: referentie voor F3 telt ook het resterende deel van de eerste dag',
    [exact.tasks.get('D')?.earlyStart, exact.tasks.get('D')?.earlyFinish],
    ['2026-07-06T13:00', '2026-07-07T12:00']);
}
{
  // §3.3/I11: de minutenlag wint van zijn afgeronde dagen-equivalent.
  // F2-tussenstand; F3 → E donderdag 11:00 (§3.14), getoetst via de urenloper.
  const d = task('D', 2, '2026-07-06T07:00');
  const e = task('E', 1, '2026-07-06T07:00');
  e.time.durationUnit = 'hours'; e.time.durationMinutes = 480;
  const result = new CPMSolver([d, e], [{ ...sf, predecessorId: 'D', successorId: 'E',
    type: 'FINISH_START', lagDays: 1, lagMinutes: 240 }], calendar, [],
    { ...options, projectStartDate: '2026-07-06' }).solve();
  eq('minutenlag bij dagvoorganger: F3-referentie',
    [result.tasks.get('E')?.earlyStart, result.tasks.get('E')?.earlyFinish],
    ['2026-07-08T11:00', '2026-07-09T11:00']);
}
for (const error of errors) console.log(`XX ${error}`);
console.log(`Minutenmodel-grenzen: ${checks - errors.length}/${checks} gelijk.`);
if (errors.length) process.exitCode = 1;
