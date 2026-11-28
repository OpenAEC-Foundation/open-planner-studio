import type { Task, TaskSplitGap } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import {
  adoptLevelingGaps, canSplitTask, fromSplitPieces, splitScheduleFinish,
  type SplitPiece, type SplitRefusal,
} from '@/engine/scheduler/splitEdit';
import { buildEditedContourPeriods, contourDaySlots } from '@/engine/contour/contourEdit';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { isSummaryTask } from '@/engine/scheduler/relationRules';
import { contourKeepsWork, invalidateForTimeBaseChange, rescaleTaskContours, taskWorkMinutesOf } from '@/utils/taskDefaults';
import type { ResourceAssignment } from '@/types/resource';
import {
  captureTriangle, settleDurationEdit, type RecomputedRemainingWork, type WorkRuleDeps,
} from '@/engine/work/workRuleApply';

interface SplitState extends WorkRuleDeps {
  calendars: WorkCalendar[];
  calendar: WorkCalendar;
  assignments: ResourceAssignment[];
}

export function taskSplitRefusal(task: Task, pieces: SplitPiece[] | null, hoursPerDay: number): SplitRefusal | null {
  return pieces === null ? null : canSplitTask(task, hoursPerDay, isSummaryTask(task));
}

export interface SplitOutcome {
  timephasedLost: boolean;
  recomputedWork: RecomputedRemainingWork[];
}

export function applyTaskSplits(
  s: SplitState,
  task: Task,
  pieces: SplitPiece[] | null,
  hoursPerDay: number,
): SplitOutcome {
  const oldWorkMinutes = taskWorkMinutesOf(task, hoursPerDay);
  const slotMinutes = Math.max(1, hoursPerDay * 60);
  const triangle = captureTriangle(task, s.assignments, s);
  let recomputedWork: RecomputedRemainingWork[] = [];

  const { gaps, totalWorkMinutes } = pieces === null
    ? { gaps: [] as TaskSplitGap[], totalWorkMinutes: oldWorkMinutes }
    : fromSplitPieces(adoptLevelingGaps(pieces), task.splitGaps);
  if (Math.abs(totalWorkMinutes - oldWorkMinutes) > 1e-6) {
    task.time.scheduleDuration = totalWorkMinutes / slotMinutes;
    if (taskDurationUnit(task) === 'hours') task.time.durationMinutes = totalWorkMinutes;
    rescaleTaskContours(task, oldWorkMinutes, hoursPerDay, contourKeepsWork(task, s.project.defaultWorkRule), { keepGaps: true });
    recomputedWork = settleDurationEdit(task, triangle).recomputedWork;
  }

  const oldSlots = (task.timephasedContours ?? [])
    .map(contour => contourDaySlots(contour.periods, task.splitGaps, slotMinutes).remaining);
  task.splitGaps = gaps.length > 0 ? gaps : undefined;
  if (task.timephasedContours && task.timephasedContours.length > 0) {
    task.timephasedContours = task.timephasedContours.map((contour, index) => ({
      ...contour,
      periods: buildEditedContourPeriods(
        contour.periods, oldSlots[index] ?? [], task.splitGaps, slotMinutes,
      ),
    }));
  }

  const lostTimephasedGuidance = invalidateForTimeBaseChange(task);

  const engine = new CalendarEngine(calendarForEngine(
    resolveCalendar(task.calendarId, s.calendars, s.calendar),
  ));
  task.time.scheduleFinish = splitScheduleFinish(task, engine);
  task.time.earlyFinish = splitScheduleFinish(task, engine, task.time.earlyStart || task.time.scheduleStart);

  return { timephasedLost: lostTimephasedGuidance, recomputedWork };
}
