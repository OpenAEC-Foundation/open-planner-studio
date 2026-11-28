import type { EffectiveSchedulingOptions, Project } from '@/types/project';
import type { Task } from '@/types/task';
import { builtInConventions, CONVENTION_KEYS, resolveConventions } from '@/engine/scheduler/conventions/registry';

export function p6SchedulingRulesDiffer(
  project: Pick<Project, 'schedulingProfile' | 'schedulingOptions' | 'progressMode'>,
  options: EffectiveSchedulingOptions,
  tasks: readonly Pick<Task, 'p6ExpectedFinish' | 'time'>[],
): boolean {
  const own = resolveConventions(project.schedulingProfile);
  const p6 = builtInConventions('p6');
  if (CONVENTION_KEYS.some(key => own[key] !== p6[key])) return true;
  if (options.totalFloatMode === undefined) return true;
  if (options.useExpectedFinishDates === false && tasks.some(t => t.p6ExpectedFinish)) return true;
  if (options.useExpectedFinishDates === undefined && tasks.some(t => t.p6ExpectedFinish)) return true;
  if ((options.p6CompletedLateFromRemainingWindow ?? false) !== (project.progressMode !== 'PROGRESS_OVERRIDE')
    && tasks.some(t => t.time.actualFinish)) return true;
  const own2 = project.schedulingOptions ?? {};
  if (own2.leveling !== undefined) return true;
  if (own2.nearCriticalThreshold !== undefined) return true;
  const crit = options.criticalDefinition;
  if (crit && crit.mode === 'totalFloat' && crit.thresholdHours === undefined && (crit.threshold ?? 0) !== 0) return true;
  return false;
}
