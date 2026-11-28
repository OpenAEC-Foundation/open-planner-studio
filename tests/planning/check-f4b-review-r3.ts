import './domStub';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { durationEditProgress } from '@/engine/work/workRuleApply';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { createTaskGridAdapterDomain } from '@/engine/taskGrid/taskGridAdapter';
import { copyTaskGridSelection, planTaskGridPaste } from '@/engine/taskGrid/clipboard';
import { parseGridEditorText } from '@/engine/taskGrid/editors';
import { createTaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { createEmptyGridSelection, updateGridSelection } from '@/engine/taskGrid/selection';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { parseTaskDurationInput, taskDurationInputContext, type ParsedTaskDuration } from '@/utils/taskDurationInput';
import {
  effHoursPerDay, effectiveCalendarOf, effectiveDurationDisplay, hourTaskScheduleDuration, profileCountsWorkdays,
} from '@/utils/taskDuration';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { parseInstant } from '@/utils/dateUtils';
import type { WorkCalendar } from '@/types/calendar';
import type { DurationType, Task, TaskDurationUnit } from '@/types/task';
import type { CellEditIntent } from '@/types/taskGrid';
import type { ViewRow } from '@/engine/view/visibleRows';

declare const process: { exit(code: number): never };

const bands = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const week: WorkCalendar = {
  id: 'cal-week', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
  hoursPerDay: 8, holidays: [], workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
};
const engine = new CalendarEngine(calendarForEngine(week));
const DURATION = taskColumnId('task.time.scheduleDuration');
const NL_SUFFIXES: Record<string, string> = { 'duration.suffixDay': 'd', 'duration.suffixHour': 'u', 'duration.suffixMinute': 'm' };

type Profile = 'ops' | 'p6' | 'msproject';
type Route = 'cel' | 'plakken' | 'kopiëren' | 'paneel';
type Outcome = { unit: TaskDurationUnit; stored: number; finish: string; minutes: number };

const INPUTS = ['1d', '1,5d', '24u', '1d 0u', '1d 4u', '2,5d 3u', '5'] as const;
type Input = typeof INPUTS[number];
const STARTED_INPUTS = [...INPUTS, '0d 8u', '2u'] as const;
type StartedInput = typeof STARTED_INPUTS[number];
type ProgressOutcome = {
  unit: TaskDurationUnit; stored: number; completion: number; finish: string;
  done?: number; rest?: number; actualStart?: string; actualFinish?: string;
};
const COMPOUND: ReadonlySet<Input> = new Set(['1d 0u', '1d 4u', '2,5d 3u']);

const day = (stored: number, finish: string, minutes: number): Outcome => ({ unit: 'days', stored, finish, minutes });
const hour = (stored: number, finish: string): Outcome => ({ unit: 'hours', stored, finish, minutes: stored });

const WORK_OPS: Record<Input, Outcome> = {
  '1d': day(1, '2026-06-01T16:00', 480),
  '1,5d': day(1.5, '2026-06-02T11:00', 720),
  '24u': hour(1440, '2026-06-03T16:00'),
  '1d 0u': day(1, '2026-06-01T16:00', 480),
  '1d 4u': day(1.5, '2026-06-02T11:00', 720),
  '2,5d 3u': day(2.875, '2026-06-03T15:00', 1380),
  '5': day(5, '2026-06-05T16:00', 2400),
};
const WORK_P6: Record<Input, Outcome> = {
  '1d': hour(480, '2026-06-01T16:00'),
  '1,5d': hour(720, '2026-06-02T11:00'),
  '24u': hour(1440, '2026-06-03T16:00'),
  '1d 0u': day(1, '2026-06-01T16:00', 480),
  '1d 4u': day(1.5, '2026-06-02T11:00', 720),
  '2,5d 3u': day(2.875, '2026-06-03T15:00', 1380),
  '5': day(5, '2026-06-05T16:00', 2400),
};
const ELAPSED: Record<Input, Outcome> = {
  '1d': day(1, '2026-06-02T07:00', 1440),
  '1,5d': day(1.5, '2026-06-02T19:00', 2160),
  '24u': hour(1440, '2026-06-02T07:00'),
  '1d 0u': day(1, '2026-06-02T07:00', 1440),
  '1d 4u': hour(1680, '2026-06-02T11:00'),
  '2,5d 3u': day(2.625, '2026-06-03T22:00', 3780),
  '5': day(5, '2026-06-06T07:00', 7200),
};
const START: Record<DurationType, Outcome> = {
  WORKTIME: day(2, '2026-06-02T16:00', 960),
  ELAPSEDTIME: day(2, '2026-06-03T07:00', 2880),
};

type P = ProgressOutcome | 'geweigerd';
const run = (unit: TaskDurationUnit, stored: number, done: number, rest: number, completion: number, finish: string): P =>
  ({ unit, stored, completion, finish, done, rest });
const RUN_WORK_OPS: Record<StartedInput, P> = {
  '1d': run('days', 1, 240, 240, 0.5, '2026-06-02T11:00'),
  '1,5d': run('days', 1.5, 240, 480, 0.333333, '2026-06-02T16:00'),
  '24u': run('hours', 1440, 240, 1200, 0.166667, '2026-06-04T11:00'),
  '1d 0u': run('days', 1, 240, 240, 0.5, '2026-06-02T11:00'),
  '1d 4u': run('days', 1.5, 240, 480, 0.333333, '2026-06-02T16:00'),
  '2,5d 3u': run('days', 2.875, 240, 1140, 0.173913, '2026-06-04T10:00'),
  '5': run('days', 5, 240, 2160, 0.1, '2026-06-08T11:00'),
  '0d 8u': run('days', 1, 240, 240, 0.5, '2026-06-02T11:00'),
  '2u': 'geweigerd',
};
const RUN_WORK_P6: Record<StartedInput, P> = {
  '1d': run('hours', 480, 240, 240, 0.5, '2026-06-02T11:00'),
  '1,5d': run('hours', 720, 240, 480, 0.333333, '2026-06-02T16:00'),
  '24u': run('hours', 1440, 240, 1200, 0.166667, '2026-06-04T11:00'),
  '1d 0u': run('days', 1, 240, 240, 0.5, '2026-06-02T11:00'),
  '1d 4u': run('days', 1.5, 240, 480, 0.333333, '2026-06-02T16:00'),
  '2,5d 3u': run('days', 2.875, 240, 1140, 0.173913, '2026-06-04T10:00'),
  '5': run('days', 5, 240, 2160, 0.1, '2026-06-08T11:00'),
  '0d 8u': run('days', 1, 240, 240, 0.5, '2026-06-02T11:00'),
  '2u': 'geweigerd',
};
const RUN_ELAPSED: Record<StartedInput, P> = {
  '1d': run('days', 1, 720, 720, 0.5, '2026-06-02T19:00'),
  '1,5d': run('days', 1.5, 720, 1440, 0.333333, '2026-06-03T07:00'),
  '24u': run('hours', 1440, 720, 720, 0.5, '2026-06-02T19:00'),
  '1d 0u': run('days', 1, 720, 720, 0.5, '2026-06-02T19:00'),
  '1d 4u': run('hours', 1680, 720, 960, 0.428571, '2026-06-02T23:00'),
  '2,5d 3u': run('days', 2.625, 720, 3060, 0.190476, '2026-06-04T10:00'),
  '5': run('days', 5, 720, 6480, 0.1, '2026-06-06T19:00'),
  '0d 8u': 'geweigerd',
  '2u': 'geweigerd',
};
const RUN_UNIT_HOURS: Record<DurationType, ProgressOutcome> = {
  WORKTIME: { unit: 'hours', stored: 960, completion: 0.25, finish: '2026-06-03T11:00', done: 240, rest: 720 },
  ELAPSEDTIME: { unit: 'hours', stored: 2880, completion: 0.25, finish: '2026-06-03T19:00', done: 720, rest: 2160 },
};
const DONE_TYPED: Record<'WORK_OPS' | 'WORK_P6' | 'ELAPSED', Record<StartedInput, [TaskDurationUnit, number]>> = {
  WORK_OPS: { '1d': ['days', 1], '1,5d': ['days', 1.5], '24u': ['hours', 1440], '1d 0u': ['days', 1], '1d 4u': ['days', 1.5],
    '2,5d 3u': ['days', 2.875], '5': ['days', 5], '0d 8u': ['days', 1], '2u': ['hours', 120] },
  WORK_P6: { '1d': ['hours', 480], '1,5d': ['hours', 720], '24u': ['hours', 1440], '1d 0u': ['days', 1], '1d 4u': ['days', 1.5],
    '2,5d 3u': ['days', 2.875], '5': ['days', 5], '0d 8u': ['days', 1], '2u': ['hours', 120] },
  ELAPSED: { '1d': ['days', 1], '1,5d': ['days', 1.5], '24u': ['hours', 1440], '1d 0u': ['days', 1], '1d 4u': ['hours', 1680],
    '2,5d 3u': ['days', 2.625], '5': ['days', 5], '0d 8u': ['hours', 480], '2u': ['hours', 120] },
};

function expectedStarted(input: StartedInput, type: DurationType, profile: Profile, stand: Stand): P {
  if (stand === 'lopend') return (type === 'ELAPSEDTIME' ? RUN_ELAPSED : profile === 'ops' ? RUN_WORK_OPS : RUN_WORK_P6)[input];
  const [unit, stored] = DONE_TYPED[type === 'ELAPSEDTIME' ? 'ELAPSED' : profile === 'ops' ? 'WORK_OPS' : 'WORK_P6'][input];
  return { unit, stored, completion: 1, finish: DONE_FINISH[type], actualStart: '2026-06-01T07:00', actualFinish: DONE_FINISH[type] };
}

function expected(input: Input, type: DurationType, profile: Profile, route: Route): Outcome | 'geweigerd' {
  if (route === 'paneel' && COMPOUND.has(input)) return 'geweigerd';
  const typed = type === 'ELAPSEDTIME' ? ELAPSED[input] : profile === 'ops' ? WORK_OPS[input] : WORK_P6[input];
  if (route === 'kopiëren' && type === 'WORKTIME' && profile !== 'ops' && typed.unit === 'days') {
    return hour(typed.minutes, typed.finish);
  }
  return typed;
}

type Stand = 'lopend' | 'gereed';
const DONE_FINISH: Record<DurationType, string> = { WORKTIME: '2026-06-02T16:00', ELAPSEDTIME: '2026-06-03T07:00' };

function fixture(profile: Profile, statusDate?: string) {
  const { store } = createAppStoreContext();
  const S = store.getState;
  S().setCalendar(week);
  S().setProject({ startDate: '2026-06-01', ...(statusDate ? { statusDate } : {}), schedulingProfile: builtInProfile(profile) });
  const taskOf = (id: string): Task => S().tasks.find(t => t.id === id)!;
  const addTask = (name: string, type: DurationType, unit: TaskDurationUnit = 'days', stand?: Stand): string => {
    const id = S().addTask({ name });
    const time = unit === 'days'
      ? { durationType: type, durationUnit: unit, scheduleDuration: 2, durationMinutes: undefined }
      : { durationType: type, durationUnit: unit, durationMinutes: type === 'ELAPSEDTIME' ? 2880 : 960, scheduleDuration: 2 };
    const progress = stand === 'lopend' ? { actualStart: '2026-06-01T07:00', completion: 0.25 }
      : stand === 'gereed' ? { actualStart: '2026-06-01T07:00', actualFinish: DONE_FINISH[type], completion: 1 } : {};
    S().updateTask(id, { time: { ...taskOf(id).time, ...time, ...progress } });
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
  const environment = (taskId: string) => {
    const d = domain();
    const task = taskOf(taskId);
    const rows: ViewRow[] = [{ kind: 'task', rowKey: task.id, task, depth: 0, dimmed: false }];
    const rowIndex = createTaskGridRowIndex(rows);
    const selection = updateGridSelection(createEmptyGridSelection(), { rowKey: task.id, columnId: DURATION }, rowIndex, [DURATION], 'replace');
    return { selection, rowIndex, columns: [DURATION], descriptors: d.descriptorsById, context: d.context, dateNotation: 'dmy' as const };
  };
  const typeCell = (text: string, id: string, columnId = DURATION): boolean => {
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
  const paste = (text: string, id: string): boolean => {
    const planned = planTaskGridPaste(text, environment(id), { skipReadOnlyCells: true });
    return planned.ok && S().runGridMutation([planned.value]).ok;
  };
  const copy = (id: string): string => {
    const copied = copyTaskGridSelection(environment(id));
    return copied.ok ? copied.value : '';
  };
  const panel = (text: string, id: string): boolean => {
    const task = taskOf(id);
    const s = S();
    const calendar = effectiveCalendarOf(task, s.calendar, s.calendars);
    const context = taskDurationInputContext(task, {
      countsWorkdays: profileCountsWorkdays(s.project), hoursPerDay: effHoursPerDay(calendar), display: 'auto',
    });
    const parsed: ParsedTaskDuration | null = parseTaskDurationInput(text, task.time.durationUnit, context);
    if (!parsed) return false;
    const time = { ...task.time, durationUnit: parsed.unit };
    if (parsed.unit === 'days') {
      time.scheduleDuration = parsed.scheduleDuration ?? 0;
      time.durationMinutes = undefined;
    } else {
      time.durationMinutes = parsed.durationMinutes ?? 0;
      time.scheduleDuration = hourTaskScheduleDuration(time.durationMinutes, calendar);
    }
    S().updateTask(id, { time });
    return true;
  };
  const outcome = (id: string): Outcome => {
    S().runCPM();
    const t = taskOf(id).time;
    const start = parseInstant(t.earlyStart!);
    const finish = parseInstant(t.earlyFinish!);
    const minutes = t.durationType === 'ELAPSEDTIME'
      ? (finish.getTime() - start.getTime()) / 60_000
      : engine.workMinutesBetween(start, finish);
    return {
      unit: t.durationUnit,
      stored: t.durationUnit === 'hours' ? t.durationMinutes! : t.scheduleDuration,
      finish: t.earlyFinish!,
      minutes,
    };
  };
  const round6 = (n: number) => Number(n.toFixed(6));
  const progressOutcome = (id: string, stand: Stand): ProgressOutcome => {
    S().runCPM();
    const t = taskOf(id).time;
    const perDay = t.durationType === 'ELAPSEDTIME' ? 24 * 60 : 8 * 60;
    const hours = t.durationUnit === 'hours';
    const stored = hours ? t.durationMinutes! : t.scheduleDuration;
    const base = { unit: t.durationUnit, stored, completion: round6(t.completion), finish: t.earlyFinish! };
    if (stand === 'gereed') return { ...base, actualStart: t.actualStart, actualFinish: t.actualFinish };
    const total = hours ? t.durationMinutes! : t.scheduleDuration * perDay;
    const rest = hours
      ? t.remainingMinutes ?? (1 - t.completion) * total
      : (t.remainingTime ?? (1 - t.completion) * t.scheduleDuration) * perDay;
    return { ...base, done: round6(t.completion * total), rest: round6(rest) };
  };
  const timeJson = (id: string) => JSON.stringify(taskOf(id).time);
  return { S, taskOf, addTask, typeCell, paste, copy, panel, outcome, progressOutcome, timeJson };
}

let rows = 0;
const failures: string[] = [];
function row(label: string, got: { accepted: boolean; outcome: Outcome }, want: Outcome | 'geweigerd', start: Outcome): void {
  rows++;
  const wantAccepted = want !== 'geweigerd';
  const wantOutcome = want === 'geweigerd' ? start : want;
  const a = JSON.stringify({ accepted: got.accepted, ...got.outcome });
  const b = JSON.stringify({ accepted: wantAccepted, ...wantOutcome });
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const type of ['WORKTIME', 'ELAPSEDTIME'] as const) {
    for (const input of INPUTS) {
      const label = (route: Route) => `${profile} ${type === 'ELAPSEDTIME' ? 'kalendertijd' : 'werktijd'} "${input}" ${route}`;
      {
        const f = fixture(profile);
        const typed = f.addTask('Getypt', type);
        const other = f.addTask('Kopie', type);
        f.outcome(typed);
        const accepted = f.typeCell(input, typed);
        row(label('cel'), { accepted, outcome: f.outcome(typed) }, expected(input, type, profile, 'cel'), START[type]);
        const text = f.copy(typed);
        const pasted = f.paste(text, other);
        row(`${label('kopiëren')} (klembord "${text}")`, { accepted: pasted, outcome: f.outcome(other) },
          expected(input, type, profile, 'kopiëren'), START[type]);
      }
      {
        const f = fixture(profile);
        f.addTask('Andere', type);
        const target = f.addTask('Doel', type);
        f.outcome(target);
        const accepted = f.paste(input, target);
        row(label('plakken'), { accepted, outcome: f.outcome(target) }, expected(input, type, profile, 'plakken'), START[type]);
      }
      {
        const f = fixture(profile);
        const id = f.addTask('Paneel', type);
        f.outcome(id);
        const accepted = f.panel(input, id);
        row(label('paneel'), { accepted, outcome: f.outcome(id) }, expected(input, type, profile, 'paneel'), START[type]);
      }
    }
  }
}

for (const profile of ['ops', 'p6', 'msproject'] as const) {
  const startHours = hour(2880, '2026-06-03T07:00');
  {
    const f = fixture(profile);
    const id = f.addTask('Uren', 'ELAPSEDTIME', 'hours');
    f.outcome(id);
    const accepted = f.typeCell('1d 0u', id);
    row(`${profile} kalendertijd in uren "1d 0u" cel`, { accepted, outcome: f.outcome(id) }, hour(1440, '2026-06-02T07:00'), startHours);
  }
  {
    const f = fixture(profile);
    const id = f.addTask('Uren', 'ELAPSEDTIME', 'hours');
    f.outcome(id);
    const accepted = f.typeCell('1d 4u', id);
    row(`${profile} kalendertijd in uren "1d 4u" cel`, { accepted, outcome: f.outcome(id) }, hour(1680, '2026-06-02T11:00'), startHours);
  }
  {
    const f = fixture(profile);
    const id = f.addTask('Minuten', 'ELAPSEDTIME');
    f.outcome(id);
    const intent: CellEditIntent = { kind: 'cell-edit', taskId: id, columnId: DURATION, route: 'task-schedule', value: 1440 };
    const accepted = f.S().runGridMutation([intent]).ok;
    row(`${profile} kalendertijd: los minutengetal 1440 naar de transactie`, { accepted, outcome: f.outcome(id) },
      day(1, '2026-06-02T07:00', 1440), START.ELAPSEDTIME);
  }
}

const UNIT = taskColumnId('task.time.durationUnit');
const KNOWN_DRIFT: ReadonlyMap<string, string> = new Map();
const known: string[] = [];
function startedRow(label: string, accepted: boolean, unchanged: boolean, got: ProgressOutcome, want: P): void {
  rows++;
  const drift = KNOWN_DRIFT.get(label);
  const wantShown = drift && want !== 'geweigerd' ? { ...want, finish: drift } : want;
  const a = want === 'geweigerd' ? JSON.stringify({ accepted, unchanged }) : JSON.stringify({ accepted, ...got });
  const b = wantShown === 'geweigerd' ? JSON.stringify({ accepted: false, unchanged: true }) : JSON.stringify({ accepted: true, ...wantShown });
  if (a !== b) {
    failures.push(drift
      ? `${label}: de bekende afwijking (einde ${drift} door ruis in de rest) is weg of anders; haal de rij uit KNOWN_DRIFT als het einde nu ${want === 'geweigerd' ? '-' : want.finish} is. Kreeg ${a}`
      : `${label}: verwacht ${b}, kreeg ${a}`);
  } else if (drift && want !== 'geweigerd') {
    known.push(`${label}: einde ${drift}, met de hand ${want.finish} (ruis in durationEditProgress)`);
  }
}
for (const stand of ['lopend', 'gereed'] as const) {
  const statusDate = stand === 'lopend' ? '2026-06-02T07:00' : '2026-06-08T07:00';
  for (const profile of ['ops', 'p6', 'msproject'] as const) {
    for (const type of ['WORKTIME', 'ELAPSEDTIME'] as const) {
      for (const input of STARTED_INPUTS) {
        for (const route of ['cel', 'plakken'] as const) {
          const f = fixture(profile, statusDate);
          f.addTask('Andere', type);
          const id = f.addTask('Doel', type, 'days', stand);
          f.progressOutcome(id, stand);
          const before = f.timeJson(id);
          const accepted = route === 'cel' ? f.typeCell(input, id) : f.paste(input, id);
          const got = f.progressOutcome(id, stand);
          const unchanged = f.timeJson(id) === before;
          startedRow(`${stand} ${profile} ${type === 'ELAPSEDTIME' ? 'kalendertijd' : 'werktijd'} "${input}" ${route}`,
            accepted, unchanged, got, expectedStarted(input, type, profile, stand));
        }
      }
      if (stand === 'lopend') {
        const f = fixture(profile, statusDate);
        const id = f.addTask('Doel', type, 'days', stand);
        f.progressOutcome(id, stand);
        const accepted = f.typeCell('hours', id, UNIT);
        startedRow(`lopend ${profile} ${type === 'ELAPSEDTIME' ? 'kalendertijd' : 'werktijd'} kolom Eenheid naar uren`,
          accepted, false, f.progressOutcome(id, stand), RUN_UNIT_HOURS[type]);
      }
    }
  }
}

for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const type of ['WORKTIME', 'ELAPSEDTIME'] as const) {
    for (const unit of ['days', 'hours'] as const) {
      const hpd = type === 'ELAPSEDTIME' ? 24 : 8;
      const { store } = createAppStoreContext();
      store.setState(s => {
        s.calendar = week;
        s.project.startDate = '2026-06-01T07:00';
        s.project.statusDate = '2026-06-02T07:00';
        s.project.schedulingProfile = builtInProfile(profile);
      });
      const S = () => store.getState();
      const before = { ...createDefaultTaskTime('2026-06-01T07:00', 4), durationUnit: unit,
        durationType: type, completion: 0.5, actualStart: '2026-06-01T07:00', remainingTime: 1,
        ...(unit === 'hours' ? { durationMinutes: 4 * hpd * 60, remainingMinutes: hpd * 60 } : {}) };
      const id = S().addTask({ name: 'Expliciete rest', time: before });
      const get = () => S().tasks.find(t => t.id === id)!.time;
      const afterUnit = unit === 'days' ? 'hours' : 'days';
      const after: Task['time'] = { ...get(), scheduleDuration: 4, durationUnit: afterUnit, durationMinutes: afterUnit === 'hours' ? 4 * hpd * 60 : undefined };
      S().updateTask(id, { time: after });
      const label = `341 ${profile} ${type} ${unit} naar ${afterUnit}`;
      const expect = [0.5, 1, afterUnit === 'hours' ? hpd * 60 : undefined];
      const state = () => [get().completion, get().remainingTime, get().remainingMinutes];
      rows++;
      if (JSON.stringify(state()) !== JSON.stringify(expect)) failures.push(`${label}: ${JSON.stringify(state())} ≠ ${JSON.stringify(expect)}`);
      S().runCPM();
      rows++;
      if (JSON.stringify(state()) !== JSON.stringify(expect)) failures.push(`${label}: F5 wijzigt de rest`);
      S().undo();
      rows++;
      if (get().durationUnit !== unit || get().remainingTime !== 1) failures.push(`${label}: undo herstelt de bron niet`);
      S().redo();
      rows++;
      if (JSON.stringify(state()) !== JSON.stringify(expect)) failures.push(`${label}: redo verliest de rest`);
      const reopened = createAppStoreContext().store;
      reopened.getState().loadState(readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))));
      reopened.getState().runCPM();
      const saved = reopened.getState().tasks.find(t => t.name === 'Expliciete rest')!.time;
      rows++;
      const savedState = [saved.completion, saved.durationUnit,
        afterUnit === 'hours' ? saved.remainingMinutes : saved.remainingTime];
      const savedWant = [0.5, afterUnit, afterUnit === 'hours' ? hpd * 60 : 1];
      if (JSON.stringify(savedState) !== JSON.stringify(savedWant)) {
        failures.push(`${label}: opslaan, heropenen en F5: ${JSON.stringify(savedState)} ≠ ${JSON.stringify(savedWant)}`);
      }
    }
  }
}
const before266 = { ...createDefaultTaskTime('2026-06-01T07:00', 2), completion: 0.25, actualStart: '2026-06-01T07:00' };
const after266 = { ...before266, durationUnit: 'hours' as const, durationMinutes: 720, scheduleDuration: 1.5 };
const result266 = durationEditProgress({ childIds: [] }, before266, after266, 8);
rows++;
if (!result266 || result266.refused || result266.remainingMinutes !== 480) failures.push(`266: rest moet exact 480 min zijn, kreeg ${JSON.stringify(result266)}`);

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX  ${failure}`);
  console.log(`\n${failures.length}/${rows} rijen van de F4b-duurtabel mislukt.`);
  process.exit(1);
}
for (const line of known) console.log(`BEKEND  ${line}`);
console.log(`OK  F4b review r3: ${rows} rijen van de duurtabel groen (${known.length} met een bekende motorafwijking).`);
