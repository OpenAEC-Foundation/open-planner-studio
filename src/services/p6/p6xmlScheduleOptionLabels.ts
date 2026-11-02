/**
 * De labels en velden die de P6 XML-schrijver voor de rekenopties gebruikt (issue #775). Een bladmodule: de
 * schrijver importeert hem zonder de XER-afleiding, zodat er geen importcyclus ontstaat
 * (`xerScheduleOptions` → `xerResources` → `p6xmlWriter`). De lezer staat in `p6xmlScheduleOptions.ts`.
 */
import type { EffectiveSchedulingOptions, Project } from '@/types/project';

/** De labels die de schrijver gebruikt (en de lezer terugleest). */
export const P6XML_LAG_CALENDAR = {
  predecessor: 'Predecessor Activity Calendar',
  successor: 'Successor Activity Calendar',
  // Het P6-schema staat `24 Hour Calendar` toe, zonder koppelteken (review Sol #781, punt 3); de lezer kent beide.
  '24hour': '24 Hour Calendar',
  projectDefault: 'Project Default Calendar',
} as const;
export const P6XML_FLOAT_TYPE = {
  start: 'Start Float = Late Start - Early Start',
  finish: 'Finish Float = Late Finish - Early Finish',
  smallest: 'Smallest of Start Float and Finish Float',
} as const;
export const P6XML_CRITICAL_PATH = { totalFloat: 'Critical Float', longestPath: 'Longest Path' } as const;
export const P6XML_OUT_OF_SEQUENCE = { RETAINED_LOGIC: 'Retained Logic', PROGRESS_OVERRIDE: 'Progress Override' } as const;

/** De rekenopties zoals de P6 XML-schrijver ze schrijft: de projectvelden en de kinderen van `<ScheduleOptions>`. */
export function p6XmlScheduleOptionFields(
  project: Pick<Project, 'progressMode' | 'endDate'>,
  options: EffectiveSchedulingOptions,
  hoursPerDay: number,
): { project: Array<[string, string]>; schedule: Array<[string, string]> } {
  const crit = options.criticalDefinition;
  const critHours = crit?.mode === 'totalFloat' ? crit.thresholdHours ?? (crit.threshold ?? 0) * hoursPerDay : 0;
  const flag = (value: boolean) => (value ? '1' : '0');
  const floatPaths = options.floatPaths;
  return {
    project: [
      ['CriticalActivityFloatLimit', String(critHours)],
      ['CriticalActivityPathType', P6XML_CRITICAL_PATH[crit?.mode === 'longestPath' ? 'longestPath' : 'totalFloat']],
    ],
    schedule: [
      ['CalculateFloatBasedOnFinishDate', flag(options.useProjectEndDateForFloat === true && !!project.endDate)],
      ['ComputeTotalFloatType', P6XML_FLOAT_TYPE[options.totalFloatMode ?? 'finish']],
      ['MakeOpenEndedActivitiesCritical', flag(options.makeOpenEndedCritical ?? false)],
      ...(floatPaths ? [
        ['MaximumMultipleFloatPaths', String(floatPaths.maxPaths)],
        ['MultipleFloatPathsEnabled', flag(floatPaths.enabled)],
        ['MultipleFloatPathsUseTotalFloat', flag(floatPaths.method === 'TOTAL_FLOAT')],
      ] as Array<[string, string]> : []),
      ['OutOfSequenceScheduleType', P6XML_OUT_OF_SEQUENCE[project.progressMode === 'PROGRESS_OVERRIDE' ? 'PROGRESS_OVERRIDE' : 'RETAINED_LOGIC']],
      ['RelationshipLagCalendar', P6XML_LAG_CALENDAR[options.lagCalendar ?? 'predecessor']],
      ['StartToStartLagCalculationType', flag((options.startToStartLagFrom ?? 'earlyStart') === 'earlyStart')],
      ['UseExpectedFinishDates', flag(options.useExpectedFinishDates ?? false)],
    ],
  };
}
