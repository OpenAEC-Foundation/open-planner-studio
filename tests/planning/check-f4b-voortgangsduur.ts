import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { createTaskGridAdapterDomain } from '@/engine/taskGrid/taskGridAdapter';
import { planTaskGridPaste } from '@/engine/taskGrid/clipboard';
import { parseGridEditorText } from '@/engine/taskGrid/editors';
import { createTaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { createEmptyGridSelection, updateGridSelection } from '@/engine/taskGrid/selection';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { effHoursPerDay, effectiveCalendarOf, effectiveDurationDisplay, profileCountsWorkdays } from '@/utils/taskDuration';
import type { WorkCalendar } from '@/types/calendar';
import type { DurationType, Task } from '@/types/task';
import type { TaskColumnId } from '@/types/taskGrid';
import type { ViewRow } from '@/engine/view/visibleRows';

declare const process: { exit(code: number): never };

const bands = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const week: WorkCalendar = {
  id: 'cal-week', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
  hoursPerDay: 8, holidays: [], workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
};
const NL_SUFFIXES: Record<string, string> = { 'duration.suffixDay': 'd', 'duration.suffixHour': 'u', 'duration.suffixMinute': 'm' };
const REMAINING = taskColumnId('task.time.remainingTime');
const ACTUAL = taskColumnId('task.time.actualDuration');

type Profile = 'ops' | 'p6' | 'msproject';
type Stand = 'niet gestart' | 'lopend' | 'gereed';
const ACTUAL_START: Record<Stand, Record<Profile, string>> = {
  'niet gestart': { ops: '2026-06-08T07:00', p6: '2026-06-08T07:00', msproject: '2026-06-01T07:00' },
  lopend: { ops: '2026-06-01T07:00', p6: '2026-06-01T07:00', msproject: '2026-06-01T07:00' },
  gereed: { ops: '2026-06-01T07:00', p6: '2026-06-01T07:00', msproject: '2026-06-01T07:00' },
};
const DONE_FINISH: Record<DurationType, string> = { WORKTIME: '2026-06-04T16:00', ELAPSEDTIME: '2026-06-05T07:00' };
type Column = 'rest' | 'werkelijk';
type Route = 'cel' | 'plakken';
const INPUTS = ['24u', '1d', '1d 4u', '1,5d'] as const;
type Input = typeof INPUTS[number];
type Outcome = {
  remainingTime?: number; remainingMinutes?: number; actualDuration?: number; completion: number; finish: string;
  actualStart?: string; actualFinish?: string;
};

const REST_WORK: Record<Input, Outcome> = {
  '24u': { remainingTime: 3, remainingMinutes: 1440, completion: 0.25, finish: '2026-06-10T16:00' },
  '1d': { remainingTime: 1, remainingMinutes: 480, completion: 0.75, finish: '2026-06-08T16:00' },
  '1d 4u': { remainingTime: 1.5, remainingMinutes: 720, completion: 0.625, finish: '2026-06-09T11:00' },
  '1,5d': { remainingTime: 1.5, remainingMinutes: 720, completion: 0.625, finish: '2026-06-09T11:00' },
};
const REST_ELAPSED: Record<Input, Outcome> = {
  '24u': { remainingTime: 1, remainingMinutes: 1440, completion: 0.75, finish: '2026-06-09T07:00' },
  '1d': { remainingTime: 1, remainingMinutes: 1440, completion: 0.75, finish: '2026-06-09T07:00' },
  '1d 4u': { remainingTime: 1.166667, remainingMinutes: 1680, completion: 0.708333, finish: '2026-06-09T11:00' },
  '1,5d': { remainingTime: 1.5, remainingMinutes: 2160, completion: 0.625, finish: '2026-06-09T19:00' },
};
const ACTUAL_WORK: Record<Input, Outcome> = {
  '24u': { actualDuration: 3, completion: 0.75, finish: '2026-06-08T16:00' },
  '1d': { actualDuration: 1, completion: 0.25, finish: '2026-06-10T16:00' },
  '1d 4u': { actualDuration: 1.5, completion: 0.375, finish: '2026-06-10T11:00' },
  '1,5d': { actualDuration: 1.5, completion: 0.375, finish: '2026-06-10T11:00' },
};
const ACTUAL_ELAPSED: Record<Input, Outcome> = {
  '24u': { actualDuration: 1, completion: 0.25, finish: '2026-06-11T07:00' },
  '1d': { actualDuration: 1, completion: 0.25, finish: '2026-06-11T07:00' },
  '1d 4u': { actualDuration: 1.166667, completion: 0.291667, finish: '2026-06-11T03:00' },
  '1,5d': { actualDuration: 1.5, completion: 0.375, finish: '2026-06-10T19:00' },
};

type Pair = { actual: string; rest: string; want: Outcome };
const PAIRS: Record<DurationType, Pair[]> = {
  WORKTIME: [
    { actual: '24u', rest: '1d', want: { actualDuration: 3, remainingTime: 1, remainingMinutes: 480, completion: 0.75, finish: '2026-06-08T16:00' } },
    { actual: '1d', rest: '24u', want: { actualDuration: 1, remainingTime: 3, remainingMinutes: 1440, completion: 0.25, finish: '2026-06-10T16:00' } },
    { actual: '1d 4u', rest: '2d 4u', want: { actualDuration: 1.5, remainingTime: 2.5, remainingMinutes: 1200, completion: 0.375, finish: '2026-06-10T11:00' } },
    { actual: '1,5d', rest: '2,5d', want: { actualDuration: 1.5, remainingTime: 2.5, remainingMinutes: 1200, completion: 0.375, finish: '2026-06-10T11:00' } },
  ],
  ELAPSEDTIME: [
    { actual: '24u', rest: '3d', want: { actualDuration: 1, remainingTime: 3, remainingMinutes: 4320, completion: 0.25, finish: '2026-06-11T07:00' } },
    { actual: '1d', rest: '72u', want: { actualDuration: 1, remainingTime: 3, remainingMinutes: 4320, completion: 0.25, finish: '2026-06-11T07:00' } },
    { actual: '1d 4u', rest: '2d 20u', want: { actualDuration: 1.166667, remainingTime: 2.833333, remainingMinutes: 4080, completion: 0.291667, finish: '2026-06-11T03:00' } },
    { actual: '1,5d', rest: '2,5d', want: { actualDuration: 1.5, remainingTime: 2.5, remainingMinutes: 3600, completion: 0.375, finish: '2026-06-10T19:00' } },
  ],
};

function expected(input: Input, type: DurationType, column: Column): Outcome {
  if (column === 'rest') return (type === 'ELAPSEDTIME' ? REST_ELAPSED : REST_WORK)[input];
  return (type === 'ELAPSEDTIME' ? ACTUAL_ELAPSED : ACTUAL_WORK)[input];
}

function fixture(profile: Profile) {
  const { store } = createAppStoreContext();
  const S = store.getState;
  S().setCalendar(week);
  S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-08T07:00', schedulingProfile: builtInProfile(profile) });
  const taskOf = (id: string): Task => S().tasks.find(t => t.id === id)!;
  const addTask = (name: string, type: DurationType, stand: Stand = 'lopend'): string => {
    const id = S().addTask({ name });
    const progress = stand === 'niet gestart' ? { completion: 0 }
      : stand === 'lopend' ? { actualStart: '2026-06-01T07:00', completion: 0.25 }
        : { actualStart: '2026-06-01T07:00', actualFinish: DONE_FINISH[type], completion: 1 };
    S().updateTask(id, { time: {
      ...taskOf(id).time, durationType: type, durationUnit: 'days', scheduleDuration: 4, durationMinutes: undefined,
      ...progress,
    } });
    return id;
  };
  const domain = () => {
    const s = S();
    const countsWorkdays = profileCountsWorkdays(s.project);
    return createTaskGridAdapterDomain({
      projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
      assignments: s.assignments, resources: s.resources, baselines: s.baselines,
      activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs, customTaskTypes: s.customTaskTypes,
      scheduleStale: s.scheduleStale, wbsAutoNumber: s.project.wbsAutoNumber === true,
      labelForColumn: key => key,
      labelForText: key => NL_SUFFIXES[key] ?? key,
      effectiveHoursPerDay: t => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
      effectiveCalendar: t => effectiveCalendarOf(t, s.calendar, s.calendars),
      durationDisplay: effectiveDurationDisplay('auto', countsWorkdays),
      workdayDurationMeasure: countsWorkdays,
      numberLocale: 'nl',
    });
  };
  const typeCell = (text: string, id: string, columnId: TaskColumnId): boolean => {
    const d = domain();
    const descriptor = d.descriptorsById.get(columnId)!;
    const task = taskOf(id);
    const parsed = parseGridEditorText(descriptor, text, task, d.context, 'dmy');
    if (!parsed.ok) return false;
    const validated = descriptor.validate!(parsed.value, task, d.context);
    if (!validated.ok) return false;
    const writes = descriptor.planWrite!(validated.value, task, d.context);
    return writes.ok && S().runGridMutation(writes.value).ok;
  };
  const paste = (text: string, id: string, columns: readonly TaskColumnId[]): boolean => {
    const d = domain();
    const task = taskOf(id);
    const rows: ViewRow[] = [{ kind: 'task', rowKey: task.id, task, depth: 0, dimmed: false }];
    const rowIndex = createTaskGridRowIndex(rows);
    const selection = updateGridSelection(createEmptyGridSelection(), { rowKey: task.id, columnId: columns[0]! }, rowIndex, [...columns], 'replace');
    const planned = planTaskGridPaste(text, {
      selection, rowIndex, columns: [...columns], descriptors: d.descriptorsById, context: d.context, dateNotation: 'dmy',
    }, { skipReadOnlyCells: true });
    return planned.ok && S().runGridMutation([planned.value]).ok;
  };
  const round6 = (n: number | undefined) => (n === undefined ? undefined : Number(n.toFixed(6)));
  const outcome = (id: string, column: Column | 'beide'): Outcome => {
    S().runCPM();
    const t = taskOf(id).time;
    const rest = { remainingTime: round6(t.remainingTime), remainingMinutes: round6(t.remainingMinutes) };
    const actual = { actualDuration: round6(t.actualDuration) };
    const progress = column === 'rest' ? rest : column === 'werkelijk' ? actual : { ...actual, ...rest };
    return { ...progress, completion: round6(t.completion)!, finish: t.earlyFinish!, actualStart: t.actualStart, actualFinish: t.actualFinish };
  };
  return { addTask, typeCell, paste, outcome };
}

let rows = 0;
const failures: string[] = [];
for (const stand of ['niet gestart', 'lopend', 'gereed'] as const)
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  const startAfter = ACTUAL_START[stand][profile];
  for (const type of ['WORKTIME', 'ELAPSEDTIME'] as const) {
    for (const column of ['rest', 'werkelijk'] as const) {
      const columnId = column === 'rest' ? REMAINING : ACTUAL;
      for (const input of INPUTS) {
        for (const route of ['cel', 'plakken'] as Route[]) {
          rows++;
          const f = fixture(profile);
          f.addTask('Andere', type);
          const id = f.addTask('Doel', type, stand);
          f.outcome(id, column);
          const accepted = route === 'cel' ? f.typeCell(input, id, columnId) : f.paste(input, id, [columnId]);
          const got = JSON.stringify({ accepted, ...f.outcome(id, column) });
          const want = JSON.stringify({ accepted: true, ...expected(input, type, column), actualStart: startAfter });
          const label = `${stand} ${profile} ${type === 'ELAPSEDTIME' ? 'kalendertijd' : 'werktijd'} ${column} "${input}" ${route}`;
          if (got !== want) failures.push(`${label}: verwacht ${want}, kreeg ${got}`);
        }
      }
    }
    for (const pair of PAIRS[type]) {
      rows++;
      const f = fixture(profile);
      f.addTask('Andere', type);
      const id = f.addTask('Doel', type, stand);
      f.outcome(id, 'beide');
      const accepted = f.paste(`${pair.actual}\t${pair.rest}`, id, [ACTUAL, REMAINING]);
      const got = JSON.stringify({ accepted, ...f.outcome(id, 'beide') });
      const want = JSON.stringify({ accepted: true, ...pair.want, actualStart: startAfter });
      const label = `${stand} ${profile} ${type === 'ELAPSEDTIME' ? 'kalendertijd' : 'werktijd'} beide "${pair.actual}" + "${pair.rest}" plakken`;
      if (got !== want) failures.push(`${label}: verwacht ${want}, kreeg ${got}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX  ${failure}`);
  console.log(`\n${failures.length}/${rows} rijen van de voortgangsduurtabel mislukt.`);
  process.exit(1);
}
console.log(`OK  F4b voortgangsduur: ${rows} rijen groen.`);
