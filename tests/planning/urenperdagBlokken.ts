import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { ImportResult } from '@/services/importTypes';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { hourTaskScheduleDuration } from '@/utils/taskDuration';

export type Day = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Band = { start: number; end: number };
export const DAYS: readonly Day[] = [1, 2, 3, 4, 5, 6, 7];
export const week = (m: Partial<Record<Day, Band[]>>): WorkTimeBands =>
  ({ byWeekday: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], ...m } });
export const on = (days: readonly Day[], bands: Band[]): Partial<Record<Day, Band[]>> =>
  Object.fromEntries(days.map((d) => [d, bands.map((b) => ({ ...b }))]));
const MA_VR: readonly Day[] = [1, 2, 3, 4, 5];

export interface UrenCase {
  label: string;
  cal: WorkCalendar;
  clockHours: number;
  written?: WorkTimeBands;
}

function hourCal(
  id: string, name: string, workTime: WorkTimeBands,
  scalar: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'hoursPerDay'>,
): WorkCalendar {
  const workDays = DAYS.filter((d) => workTime.byWeekday[d].length > 0);
  return { id, name, description: '', workDays, holidays: [], workTime, ...scalar };
}

export const CASES: readonly UrenCase[] = [
  {
    label: 'één blok (Late ploeg 14:00–24:00, 8 u/dag)',
    cal: hourCal('cal-late', 'Late ploeg', week(on(MA_VR, [{ start: 840, end: 1440 }])),
      { workStartHour: 14, workEndHour: 24, hoursPerDay: 8 }),
    clockHours: 10,
  },
  {
    label: 'twee blokken (07–12 + 13–17, 8 u/dag)',
    cal: hourCal('cal-twee', 'Twee blokken', week(on(MA_VR, [{ start: 420, end: 720 }, { start: 780, end: 1020 }])),
      { workStartHour: 7, workEndHour: 17, hoursPerDay: 8 }),
    clockHours: 9,
  },
  {
    label: 'nachtblok (22:00–06:00, 7,5 u/dag)',
    cal: hourCal('cal-nacht', 'Nachtblok', week(on(MA_VR, [{ start: 1320, end: 1800 }])),
      { workStartHour: 22, workEndHour: 6, hoursPerDay: 7.5 }),
    clockHours: 8,
  },
  {
    label: 'blokken per weekdag (ma–do 07–17, vr 07–12, 8 u/dag)',
    cal: hourCal('cal-perdag', 'Korte vrijdag', week({
      ...on([1, 2, 3, 4], [{ start: 420, end: 1020 }]), 5: [{ start: 420, end: 720 }],
    }), { workStartHour: 7, workEndHour: 17, hoursPerDay: 8 }),
    clockHours: 10,
  },
  {
    label: 'gelijk aan de spanne, niet aan de blokken (07–12 + 13–17, 10 u/dag)',
    cal: hourCal('cal-spanne', 'Spanne', week(on(MA_VR, [{ start: 420, end: 720 }, { start: 780, end: 1020 }])),
      { workStartHour: 7, workEndHour: 17, hoursPerDay: 10 }),
    clockHours: 9,
  },
  {
    label: 'gebroken getal (06–16, 7,6 u/dag)',
    cal: hourCal('cal-fractie', 'Fractie', week(on([1, 2, 3, 4, 5, 6], [{ start: 360, end: 960 }])),
      { workStartHour: 6, workEndHour: 16, hoursPerDay: 7.6 }),
    clockHours: 10,
  },
  {
    label: 'lange maandag (ma 07–17, di–vr 07–15, 10 u/dag)',
    cal: hourCal('cal-maandag', 'Lange maandag', week({
      1: [{ start: 420, end: 1020 }], ...on([2, 3, 4, 5], [{ start: 420, end: 900 }]),
    }), { workStartHour: 7, workEndHour: 17, hoursPerDay: 10 }),
    clockHours: 8,
  },
  {
    label: 'werkdagen zonder eigen blokken (ma 07–17, di/wo 07–15, do/vr leeg, 8 u/dag)',
    cal: { ...hourCal('cal-leeg', 'Werkdagen zonder blokken', week({
      1: [{ start: 420, end: 1020 }], ...on([2, 3], [{ start: 420, end: 900 }]),
    }), { workStartHour: 7, workEndHour: 17, hoursPerDay: 8 }), workDays: [1, 2, 3, 4, 5] },
    clockHours: 10,
    written: week({ ...on([1, 4, 5], [{ start: 420, end: 1020 }]), ...on([2, 3], [{ start: 420, end: 900 }]) }),
  },
  {
    label: 'gelijk aan de klokuren (07–15, 8 u/dag)',
    cal: hourCal('cal-gelijk', 'Gelijk', week(on(MA_VR, [{ start: 420, end: 900 }])),
      { workStartHour: 7, workEndHour: 15, hoursPerDay: 8 }),
    clockHours: 8,
  },
];

export const deviates = (c: UrenCase): boolean => c.cal.hoursPerDay !== c.clockHours;

function hourTask(id: string, name: string, cal: WorkCalendar, calendarId: string | undefined): Task {
  const time = createDefaultTaskTime('2026-06-01T07:00', 40, 'hours', cal);
  time.durationMinutes = 2400;
  time.scheduleDuration = hourTaskScheduleDuration(2400, cal);
  return {
    id, name, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    ...(calendarId ? { calendarId } : {}),
    time,
  } as Task;
}

export function buildProject(cases: readonly UrenCase[] = CASES): ImportResult {
  const [first, ...rest] = cases.map((c) => c.cal);
  const project = { ...createDefaultProject(), id: 'proj-urenperdag', calendarId: first.id, startDate: '2026-06-01' };
  const tasks: Task[] = [
    hourTask('t-late', 'Urentaak Late ploeg', first, undefined),
    ...rest.map((cal) => hourTask(`t-${cal.id.slice(4)}`, `Urentaak ${cal.name}`, cal, cal.id)),
  ];
  const dayTime = createDefaultTaskTime('2026-06-01', 5, 'days');
  dayTime.scheduleStart = '2026-06-01T07:00';
  dayTime.scheduleFinish = '2026-06-05T07:00';
  tasks.push({
    id: 't-dag', name: 'Dagtaak Late ploeg', description: '', wbsCode: 't-dag', taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: dayTime,
  } as Task);
  return { project, calendar: first, resourceCalendars: rest, tasks, sequences: [], resources: [], assignments: [] };
}
