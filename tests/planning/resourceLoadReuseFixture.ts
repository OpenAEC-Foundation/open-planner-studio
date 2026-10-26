// Synthetische, deterministische invoer voor regressie en de vergelijking van beide revisies.
import type { HistogramInput } from '@/engine/scheduler/ResourceLoad';
import { CONTOUR_SHAPE_VALUES } from '@/engine/contour/contourEngine';
import type { Task } from '@/types/task';
import type { ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';

export function makeResourceLoadReuseFixture(taskCount: number, assignmentsPerTask: number): HistogramInput {
  const calendar: WorkCalendar = {
    id: 'project', name: 'Projectkalender', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
    holidays: [{ name: 'Vrij', startDate: '2026-11-02', endDate: '2026-11-03' }],
    workingExceptions: [{ name: 'Werkzaterdag', startDate: '2026-10-24', endDate: '2026-10-24' }],
  };
  const calendars: WorkCalendar[] = [{
    ...calendar, id: 'kort', name: 'Korte zesdaagse kalender', workDays: [1, 2, 3, 4, 5, 6],
    hoursPerDay: 6, workEndHour: 14,
  }];
  const tasks: Task[] = [];
  for (let i = 0; i < taskCount; i++) {
    const kind = i % 8;
    const start = `2026-10-${19 + i % 5}`;
    const task: Task = {
      id: `t${i}`, name: `Taak ${i}`, description: '', wbsCode: `${i + 1}`,
      taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
      parentId: null, childIds: [], resourceIds: [],
      calendarId: kind === 5 || kind === 6 ? 'kort' : kind === 7 ? 'ontbreekt' : undefined,
      time: {
        durationType: kind === 2 ? 'ELAPSEDTIME' : 'WORKTIME', durationUnit: 'days',
        scheduleDuration: 30 + i % 3, scheduleStart: start, scheduleFinish: '2026-12-31',
        earlyStart: start, earlyFinish: kind === 2 || kind === 3 ? '2026-10-28' : '2026-12-31',
        lateStart: start, lateFinish: '2026-12-31', freeFloat: 0, totalFloat: 0,
        isCritical: false, completion: kind === 3 ? 1 : kind === 4 ? 0.4 : 0,
        actualStart: kind === 3 || kind === 4 ? start : undefined,
        actualFinish: kind === 3 ? '2026-10-28' : undefined,
      },
    };
    if (kind === 1 || kind === 2 || kind === 3 || kind === 5) {
      task.splitGaps = [{ afterMinutes: 480, gapMinutes: 960 }, { afterMinutes: 2400, gapMinutes: 240 }];
    }
    if (kind === 5) {
      Object.assign(task.time, {
        durationUnit: 'hours', durationMinutes: 450, remainingMinutes: 150,
        scheduleDuration: 1.25, completion: 2 / 3, earlyStart: `${start}T10:00`,
      });
    }
    if (kind === 6) {
      task.time.scheduleDuration = 2;
      // Twee toewijzingen aan dezelfde resource krijgen elk hun eigen contour; de tweede is langer.
      task.timephasedContours = [2, 5].map((days, j) => ({
        resourceUid: null, resourceId: 'r0',
        periods: [{ afterMinutes: 0, minutes: days * 360, workMinutes: days * (j ? 180 : 360), kind: 'remaining' }],
      }));
    }
    tasks.push(task);
  }
  const assignments: ResourceAssignment[] = [];
  // Bewust door elkaar: hergebruik mag niet afhangen van aangrenzende toewijzingen.
  for (let j = 0; j < assignmentsPerTask; j++) {
    for (let i = 0; i < taskCount; i++) {
      const a: ResourceAssignment = {
        id: `a${i}-${j}`, taskId: `t${i}`, resourceId: `r${Math.floor(j / 2) % 4}`,
        unitsPerDay: j % 2 ? 0.125 : 1, curve: j % 3 ? 'UNIFORM' : 'BELL',
      };
      if (i % 8 === 4 || i % 8 === 5) {
        a.remainingWorkMinutes = 315 + j;
        if (j % 2) a.actualWorkMinutes = 0;
      }
      if (j % 4 === 3) a.curveValues = [...CONTOUR_SHAPE_VALUES.FRONT_LOADED];
      assignments.push(a);
    }
  }
  return {
    tasks, assignments, calendar, calendars, sequences: [], cpmResult: null,
    resources: Array.from({ length: 4 }, (_, i) => ({
      id: `r${i}`, name: `Resource ${i}`, description: '', type: i === 3 ? 'MATERIAL' : 'LABOR',
      maxUnits: 3, calendarId: i === 1 ? 'kort' : undefined,
      availabilitySteps: [{ from: '2026-11-10', maxUnits: 0 }, { from: '2026-11-16', maxUnits: 2 }],
    })),
    from: '2026-10-19', to: '2026-12-31', bucket: 'week',
  };
}
