import type { EffectiveSchedulingOptions } from '@/types/project';
import type { TaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';

export function taskCountsInWorkdays(
  task: { time: Pick<TaskTime, 'durationUnit' | 'durationType'> },
  options: Pick<EffectiveSchedulingOptions, 'workdayDurationMeasure'>,
): boolean {
  return task.time.durationUnit === 'days'
    && task.time.durationType !== 'ELAPSEDTIME'
    && options.workdayDurationMeasure === true;
}

export function lagCountsInWorkdays(
  sequence: Pick<Sequence, 'lagMinutes' | 'lagUnit' | 'lagPercent'>,
  options: Pick<EffectiveSchedulingOptions, 'workdayDurationMeasure'>,
  predecessor?: { time: Pick<TaskTime, 'durationUnit' | 'durationType'> },
): boolean {
  if (sequence.lagUnit === 'ELAPSEDTIME' || options.workdayDurationMeasure !== true) return false;
  if (sequence.lagPercent !== undefined) return predecessor !== undefined && taskCountsInWorkdays(predecessor, options);
  return sequence.lagMinutes === undefined;
}
