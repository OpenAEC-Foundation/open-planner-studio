// F3b: vaste plaatsingen zijn het orakel; de solver bepaalt geen verwachte dagverdeling.
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { workPlacement } from '@/engine/scheduler/workPlacement';
import { assignmentPlacementLoad } from '@/engine/scheduler/ResourceLoad';
import { exceedsCapacity } from '@/engine/scheduler/capacityTolerance';
import { parseInstant } from '@/utils/dateUtils';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { makeBands } from '@/utils/effectiveWorkTime';
import type { Task } from '@/types/task';
import type { ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';

const calendar: WorkCalendar = {
  id: 'plaatsing', name: 'plaatsing', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: makeBands([1, 2, 3, 4, 5], [{ start: 480, end: 960 }]),
};
const shortFriday: WorkCalendar = { ...calendar, workStartHour: 7, workEndHour: 15, workTime: {
  byWeekday: { ...makeBands([1, 2, 3, 4, 5], [{ start: 420, end: 900 }]).byWeekday, 5: [{ start: 420, end: 780 }] },
} };
const engine = new CalendarEngine(calendar);
const shortEngine = new CalendarEngine(shortFriday);
let checks = 0;
const failures: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${label}: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`);
}
function rounded(values: readonly number[]): number[] { return values.map(n => Math.round(n * 1e9) / 1e9); }
function task(start: string, finish: string, duration = 3): Task {
  return {
    id: 'taak', name: 'taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: ['r'],
    time: { ...createDefaultTaskTime(start, duration), durationType: 'WORKTIME', durationUnit: 'hours',
      scheduleDuration: duration, durationMinutes: duration * 480, scheduleStart: start, scheduleFinish: finish,
      earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish },
  };
}
const assignment: ResourceAssignment = { id: 'a', taskId: 'taak', resourceId: 'r', unitsPerDay: 1 };
const base = task('2026-06-03T12:00', '2026-06-08T12:00');
const placement = { start: parseInstant(base.time.earlyStart), finish: parseInstant(base.time.earlyFinish), measure: 'minutes' as const };
const expectedDays = ['2026-06-03', '2026-06-04', '2026-06-05', '2026-06-08'];
const result = assignmentPlacementLoad(base, assignment, engine, placement);
eq('deeldagen: werkdagen', result.days.map(d => d.iso), expectedDays);
eq('deeldagen: aandelen', rounded(result.units), [0.5, 1, 1, 0.5]);
const friday = task('2026-06-05T07:00', '2026-06-08T09:00', 1);
const fridayDemand = assignmentPlacementLoad(friday, assignment, shortEngine, {
  start: parseInstant('2026-06-05T07:00'), duration: 480, measure: 'minutes',
});
const mondayDemand = assignmentPlacementLoad(friday, assignment, shortEngine, {
  start: parseInstant('2026-06-08T07:00'), duration: 480, measure: 'minutes',
});
eq('korte vrijdag: 6 + 2 uur', rounded(fridayDemand.units), [0.75, 0.25]);
eq('maandag: vraag opnieuw berekend', rounded(mondayDemand.units), [1]);
eq('maandag met vaste 0,25: geweigerd', exceedsCapacity(0.25 + mondayDemand.units[0], 1), true);
const noon = assignmentPlacementLoad(friday, assignment, shortEngine, {
  start: parseInstant('2026-06-08T11:00'), duration: 480, measure: 'minutes',
});
eq('plaatsingen onderscheiden startmomenten op dezelfde datum', rounded(noon.units), [0.5, 0.5]);

// De opgeslagen taak blijft 'days'; alleen het expliciet aangeleverde maatbeleid verschilt.
const dayTask = { ...friday, time: { ...friday.time, durationUnit: 'days' as const } };
eq('effectieve dagenmaat: vrijdag één dag', rounded(assignmentPlacementLoad(dayTask, assignment, shortEngine, {
  start: parseInstant('2026-06-05T07:00'), duration: 1, measure: 'workdays',
}).units), [1]);
eq('effectieve minutenmaat bij dezelfde dagtaak', rounded(assignmentPlacementLoad(dayTask, assignment, shortEngine, {
  start: parseInstant('2026-06-05T07:00'), duration: 480, measure: 'minutes',
}).units), [0.75, 0.25]);
eq('profieltoepassing herschrijft de taak niet', dayTask.time.durationUnit, 'days');

const split = { ...base, splitGaps: [{ afterMinutes: 120, gapMinutes: 240 }, { afterMinutes: 600, gapMinutes: 120 }] };
const splitPlacement = { ...placement, gaps: split.splitGaps };
eq('splits: twee gaten op cumulatieve minutenas', rounded(assignmentPlacementLoad(split, assignment, engine, splitPlacement).units), [0.25, 0.5, 1, 0.5]);
eq('splitkandidaat: geen afronding naar dagslots', rounded(assignmentPlacementLoad(split, assignment, engine, {
  start: placement.start, duration: 1440, measure: 'minutes', gaps: split.splitGaps,
}).units), [0.25, 0.5, 1, 1, 0.25]);

const contour = { resourceId: 'r', resourceUid: null, periods: [
  { afterMinutes: 0, minutes: 480, workMinutes: 240, kind: 'remaining' as const },
  { afterMinutes: 480, minutes: 960, workMinutes: 960, kind: 'remaining' as const },
] };
eq('contour: echte overlap met deeldagen', rounded(assignmentPlacementLoad(base, assignment, engine, placement, contour).units), [0.25, 0.75, 1, 0.5]);
const stored = { ...assignment, remainingWorkMinutes: 720 };
eq('opgeslagen werk: totaal 12 uur blijft behouden', rounded(assignmentPlacementLoad(base, stored, engine, placement).units), [0.25, 0.5, 0.5, 0.25]);
eq('curve: bestaande FRONT_LOADED-slots gewogen naar overlap', rounded(assignmentPlacementLoad(base, { ...assignment, curve: 'FRONT_LOADED' }, engine, placement).units), [1, 1.5, 0.5, 0]);
const curveValues = { ...assignment, curveValues: [0, ...Array<number>(10).fill(2), ...Array<number>(10).fill(1)] };
eq('exacte curve: werkbehoud', rounded([assignmentPlacementLoad(base, curveValues, engine, placement).units.reduce((a, b) => a + b, 0)]), [3]);
const fractionalCurve = task('2026-06-03T12:00', '2026-06-05T16:00', 2.5);
eq('gebroken curveduur: geen afronding van het werktotaal', rounded([assignmentPlacementLoad(
  fractionalCurve, { ...assignment, curve: 'BELL' }, engine,
  { ...placement, finish: parseInstant('2026-06-05T16:00') },
).units.reduce((a, b) => a + b, 0)]), [2.5]);
const fractionalDay = workPlacement(shortEngine, { start: parseInstant('2026-06-05T10:00'), duration: 1, measure: 'workdays' });
eq('dagenmaat: twee halve dagen met verschillende daglengten', rounded(fractionalDay.days.map(d => d.share)), [0.5, 0.5]);
eq('dagenmaat: werkelijk eindmoment', fractionalDay.finish.toISOString(), '2026-06-08T11:00:00.000Z');

const brokenBands = { ...calendar, workTime: makeBands([1, 2, 3, 4, 5], [{ start: 420, end: 720 }, { start: 780, end: 960 }]) };
const lunch = workPlacement(new CalendarEngine(brokenBands), {
  start: parseInstant('2026-06-03T12:00'), finish: parseInstant('2026-06-03T15:00'), measure: 'minutes',
});
eq('pauze is geen werk', rounded(lunch.days.map(d => d.minutes)), [120]);
const exceptionCalendar = { ...calendar, holidays: [{ name: 'vrij', startDate: '2026-06-04', endDate: '2026-06-04' }],
  workingExceptions: [{ name: 'zaterdag', startDate: '2026-06-06', endDate: '2026-06-06', bands: [{ start: 480, end: 600 }] }] };
const exceptionDays = workPlacement(new CalendarEngine(exceptionCalendar), {
  start: parseInstant('2026-06-04T08:00'), finish: parseInstant('2026-06-06T10:00'), measure: 'workdays',
});
eq('feestdag overgeslagen, korte werkende uitzondering telt één', exceptionDays.days.map(d => [d.iso, d.share]), [['2026-06-05', 1], ['2026-06-06', 1]]);

const nightCalendar = { ...calendar, workTime: makeBands([1, 2, 3, 4, 5], [{ start: 1320, end: 1800 }]) };
const night = workPlacement(new CalendarEngine(nightCalendar), {
  start: parseInstant('2026-06-04T00:00'), finish: parseInstant('2026-06-04T04:00'), measure: 'workdays',
});
eq('nachtblok hoort bij zijn startdag', night.days.map(d => d.iso), ['2026-06-03']);
eq('nachtblok: deel van de hele shift', rounded(night.days.map(d => d.share)), [0.5]);
eq('exclusief einde boekt geen volgende dag', workPlacement(engine, {
  start: parseInstant('2026-06-01T08:00'), finish: parseInstant('2026-06-02T08:00'), measure: 'minutes',
}).days.map(d => d.iso), ['2026-06-01']);

// F3c zal het scatterpad op deze kern aansluiten. De kern krijgt hier de gekozen splits
// expliciet: ma/wo werken, met een pauze van 480 minuten op de cumulatieve as.
const twoDays = task('2026-06-01T08:00', '2026-06-03T16:00', 2);
const scattered = assignmentPlacementLoad(twoDays, assignment, engine, {
  start: parseInstant('2026-06-01T08:00'), duration: 960, measure: 'minutes',
  gaps: [{ afterMinutes: 480, gapMinutes: 480, source: 'leveling' }],
});
eq('onderbroken plaatsing: werkdagen maandag en woensdag', scattered.days.map(d => d.iso), ['2026-06-01', '2026-06-03']);
eq('onderbroken plaatsing: beide dagen één', rounded(scattered.units), [1, 1]);
const boundary = workPlacement(engine, { start: parseInstant('2026-06-01T16:00'), duration: 480, measure: 'minutes' });
eq('blokgrens: volle acht uur op dinsdag', boundary.days.map(d => [d.iso, d.minutes]), [['2026-06-02', 480]]);
eq('blokgrens: einde dinsdag 16:00', boundary.finish.toISOString(), '2026-06-02T16:00:00.000Z');

for (const failure of failures) console.error(`XX ${failure}`);
console.log(`Plaatsingsbelasting: ${checks} checks, ${failures.length} afwijkingen`);
process.exit(failures.length ? 1 : 0);
