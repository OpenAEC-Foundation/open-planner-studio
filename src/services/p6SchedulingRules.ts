// Welke rekenregels een P6-export (XER en P6 XML) niet kan dragen. Beide schrijvers schrijven dezelfde
// rekenopties (`SCHEDOPTIONS` en `<ScheduleOptions>`), en beide lezers leiden ze op dezelfde manier af (#775).
import type { EffectiveSchedulingOptions, Project } from '@/types/project';
import type { Task } from '@/types/task';
import { builtInConventions, CONVENTION_KEYS, resolveConventions } from '@/engine/scheduler/conventions/registry';

/** Wat de lezer van de geschreven rekenopties maakt, vergeleken met wat het project nu gebruikt. Een
 *  verschil (of een profiel dat niet P6 is) ⇒ het verlies `schedulingRules`. */
export function p6SchedulingRulesDiffer(
  project: Pick<Project, 'schedulingProfile' | 'schedulingOptions' | 'progressMode'>,
  options: EffectiveSchedulingOptions,
  tasks: readonly Pick<Task, 'p6ExpectedFinish' | 'time'>[],
): boolean {
  const own = resolveConventions(project.schedulingProfile);
  const p6 = builtInConventions('p6');
  if (CONVENTION_KEYS.some(key => own[key] !== p6[key])) return true;
  if (options.totalFloatMode === undefined) return true; // "Automatisch" kent P6 niet
  if (options.useExpectedFinishDates === false && tasks.some(t => t.p6ExpectedFinish)) return true;
  if (options.useExpectedFinishDates === undefined && tasks.some(t => t.p6ExpectedFinish)) return true;
  if ((options.p6CompletedLateFromRemainingWindow ?? false) !== (project.progressMode !== 'PROGRESS_OVERRIDE')
    && tasks.some(t => t.time.actualFinish)) return true;
  // Alleen de eigen projectopties: `options` bevat ook de conventies (die toetst de regel hierboven).
  const own2 = project.schedulingOptions ?? {};
  if (own2.leveling !== undefined) return true;
  if (own2.nearCriticalThreshold !== undefined) return true;
  const crit = options.criticalDefinition;
  if (crit && crit.mode === 'totalFloat' && crit.thresholdHours === undefined && (crit.threshold ?? 0) !== 0) return true;
  return false;
}
