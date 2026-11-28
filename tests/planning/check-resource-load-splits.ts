import { computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

const PROJECT_CAL: WorkCalendar = {
  id: 'cal-project', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

function task(id: string, earlyStart: string, earlyFinish: string, durationDays: number, extra?: Partial<Task>): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: durationDays,
      scheduleStart: earlyStart, scheduleFinish: earlyFinish,
      earlyStart, earlyFinish, lateStart: earlyStart, lateFinish: earlyFinish,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    ...extra,
  };
}

function res(id: string, maxUnits = 1, extra?: Partial<Resource>): Resource {
  return { id, name: id, type: 'LABOR', description: '', maxUnits, ...extra };
}

function assign(id: string, taskId: string, resourceId: string, unitsPerDay: number): ResourceAssignment {
  return { id, taskId, resourceId, unitsPerDay, curve: 'UNIFORM' };
}

console.log('-- resource-load-splits: splits slaan pauzedagen over --');
{
  const taskA = task('t-a', '2026-06-01', '2026-06-05', 3, {
    splitGaps: [
      { afterMinutes: 480, gapMinutes: 480 },
      { afterMinutes: 1440, gapMinutes: 480 },
    ],
  });
  const resourceR = res('r-a', 1);
  const assignments = [assign('a-a', 't-a', 'r-a', 1)];

  const result = computeResourceLoad([resourceR], assignments, [taskA], PROJECT_CAL, [], effectiveSchedulingOptions({}));
  const daily = result.load['r-a'] ?? {};

  eq('06-01 belast met 1', daily['2026-06-01'], 1);
  eq('06-03 belast met 1', daily['2026-06-03'], 1);
  eq('06-05 belast met 1', daily['2026-06-05'], 1);
  eq('06-02 (pauzedag) draagt geen last', daily['2026-06-02'], undefined);
  eq('06-04 (pauzedag) draagt geen last', daily['2026-06-04'], undefined);
  eq('geen extra dagen dan de drie werkdagen', Object.keys(daily).sort(), ['2026-06-01', '2026-06-03', '2026-06-05']);
}

console.log('-- resource-load-splits: FRONT_LOADED-curve volgt de echte werkdagen (niet de kalenderdagen) --');
{
  const taskAFront = task('t-a-front', '2026-06-01', '2026-06-05', 3, {
    splitGaps: [
      { afterMinutes: 480, gapMinutes: 480 },
      { afterMinutes: 1440, gapMinutes: 480 },
    ],
  });
  const resourceR = res('r-a-front', 5);
  const assignments = [{ id: 'a-a-front', taskId: 't-a-front', resourceId: 'r-a-front', unitsPerDay: 1, curve: 'FRONT_LOADED' as const }];

  const result = computeResourceLoad([resourceR], assignments, [taskAFront], PROJECT_CAL, [], effectiveSchedulingOptions({}));
  const daily = result.load['r-a-front'] ?? {};

  eq('werkdag 1 (06-01) draagt het hoogste gewicht (2)', daily['2026-06-01'], 2);
  eq('werkdag 2 (06-03, ná het eerste gat) draagt het middelste gewicht (1)', daily['2026-06-03'], 1);
  eq('werkdag 3 (06-05, ná het tweede gat) draagt het laagste gewicht (0)', daily['2026-06-05'], 0);
  eq('pauzedagen blijven buiten de mapping', [daily['2026-06-02'], daily['2026-06-04']], [undefined, undefined]);
}

console.log('-- resource-load-splits: taak met eigen (6-daagse) kalender --');
{
  const SIX_DAY_CAL: WorkCalendar = {
    id: 'cal-six-day', name: 'zesdaags', description: '', workDays: [1, 2, 3, 4, 5, 6],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
  const taskB = task('t-b', '2026-06-05', '2026-06-09', 3, { calendarId: 'cal-six-day' });
  const resourceR = res('r-b', 1);
  const assignments = [assign('a-b', 't-b', 'r-b', 1)];

  const result = computeResourceLoad([resourceR], assignments, [taskB], PROJECT_CAL, [SIX_DAY_CAL], effectiveSchedulingOptions({}));
  const daily = result.load['r-b'] ?? {};

  eq('vr 06-05 belast met 1', daily['2026-06-05'], 1);
  eq('za 06-06 (werkdag op de taakkalender) belast met 1', daily['2026-06-06'], 1);
  eq('ma 06-08 belast met 1', daily['2026-06-08'], 1);
  eq('di 06-09 draagt geen last (earlyFinish wordt genegeerd, de duur is al verbruikt)', daily['2026-06-09'], undefined);
  eq('zo 06-07 draagt geen last (vrij, ook op de taakkalender)', daily['2026-06-07'], undefined);
  eq('geen extra dagen dan de drie werkdagen', Object.keys(daily).sort(), ['2026-06-05', '2026-06-06', '2026-06-08']);

  eq('capaciteit op za 06-06 (resource-kalender) is 0', result.capacity['r-b']?.['2026-06-06'], 0);
  ok('za 06-06 is overallocated (taak werkt, resource-kalender niet)',
    (result.overallocatedDays['r-b'] ?? []).includes('2026-06-06'));
}

console.log('-- resource-load-splits: ELAPSEDTIME — belasting stopt op earlyFinish --');
{
  const base = task('t-c', '2026-06-01', '2026-06-10', 10);
  const taskC: Task = { ...base, time: { ...base.time, durationType: 'ELAPSEDTIME' } };
  const resourceR = res('r-c', 10);
  const assignments = [assign('a-c', 't-c', 'r-c', 1)];

  const result = computeResourceLoad([resourceR], assignments, [taskC], PROJECT_CAL, [], effectiveSchedulingOptions({}));
  const daily = result.load['r-c'] ?? {};

  eq('laatste werkdag binnen de spanne (06-10) draagt last', daily['2026-06-10'], 1);
  eq('06-11 (voorbij earlyFinish) draagt geen last', daily['2026-06-11'], undefined);
  eq('06-12 (voorbij earlyFinish, de oude bug) draagt geen last', daily['2026-06-12'], undefined);
  eq(
    'exact de 8 werkdagen binnen 06-01..06-10, geen dag erbuiten',
    Object.keys(daily).sort(),
    ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-08', '2026-06-09', '2026-06-10'],
  );
}

console.log('-- resource-load-splits: VOLTOOIDE taak mapt op earlyStart..earlyFinish, niet voorbij (geval d) --');
{
  const HOLIDAY_CAL: WorkCalendar = {
    id: 'cal-holiday-load', name: 'feestdagen', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
    holidays: [
      { name: 'blokvakantie', startDate: '2026-06-04', endDate: '2026-06-05' },
    ],
  };
  const base = task('t-d', '2026-06-01', '2026-06-03', 5);
  const taskD: Task = {
    ...base,
    time: { ...base.time, completion: 1, actualStart: '2026-06-01', actualFinish: '2026-06-03' },
  };
  const resourceR = res('r-d', 5);
  const assignments = [assign('a-d', 't-d', 'r-d', 1)];

  const result = computeResourceLoad([resourceR], assignments, [taskD], HOLIDAY_CAL, [], effectiveSchedulingOptions({}));
  const daily = result.load['r-d'] ?? {};

  eq('laatste echte werkdag (06-03, earlyFinish) draagt last', daily['2026-06-03'], 1);
  eq('06-08 (voorbij earlyFinish, de oude 5-werkdagen-wandeling-bug) draagt geen last', daily['2026-06-08'], undefined);
  eq('06-09 (voorbij earlyFinish, idem) draagt geen last', daily['2026-06-09'], undefined);
  eq(
    'exact de 3 echte werkdagen binnen 06-01..06-03, geen dag erbuiten',
    Object.keys(daily).sort(),
    ['2026-06-01', '2026-06-02', '2026-06-03'],
  );
}

if (diffs.length === 0) {
  console.log(`OK  resource-load-splits: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  resource-load-splits: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
