/**
 * Alleen uren §3.2, §3.3, §3.5 en §3.14: telt een duur, lag of rest in de DAGENMAAT (werkdagen op de
 * kalender) of in de URENMAAT (werkminuten)? Dit is de ene plek voor die vraag. Een aanroeper kijkt dus
 * niet zelf naar `durationUnit`, `lagMinutes` of `isHourMode`.
 *
 * De maat van de data zegt wat de planner invoerde; de conventie `workdayDurationMeasure` zegt of het
 * profiel die dagenmaat ook zo telt. Onder het P6- en het MSP-profiel staat ze uit: dan telt een dagenmaat
 * als uren (dagen × werktijd per dag × 60 minuten). Kalendertijd (`ELAPSEDTIME`) telt nooit in de dagenmaat,
 * in geen enkel profiel. Een procentlag telt in de maat van de voorganger (besluit B7): een deel van zijn
 * werkdagen als de voorganger in de dagenmaat telt, anders een deel van zijn werkminuten.
 *
 * Een REST volgt de taak: vraag `taskCountsInWorkdays` voor de taak waar de rest bij hoort.
 *
 * Puur en alleen types geïmporteerd, net als het register (`npm run verify:cycles`).
 */
import type { EffectiveSchedulingOptions } from '@/types/project';
import type { TaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';

/** Telt deze taak (en haar rest) in de dagenmaat? Ja als ze in dagen staat (`durationUnit: 'days'`), geen
 *  kalendertijd is en de conventie `workdayDurationMeasure` aan staat. Anders telt ze in werkminuten. */
export function taskCountsInWorkdays(
  task: { time: Pick<TaskTime, 'durationUnit' | 'durationType'> },
  options: Pick<EffectiveSchedulingOptions, 'workdayDurationMeasure'>,
): boolean {
  return task.time.durationUnit === 'days'
    && task.time.durationType !== 'ELAPSEDTIME'
    && options.workdayDurationMeasure === true;
}

/** Telt deze lag in de dagenmaat? Ja als de conventie `workdayDurationMeasure` aan staat, de lag geen
 *  kalendertijd is (`lagUnit: 'ELAPSEDTIME'`) en hij een lag in dagen is (`lagDays` zonder `lagMinutes`).
 *  Een procentlag volgt de maat van de voorganger (B7): hij telt in de dagenmaat als `predecessor` dat doet;
 *  zonder `predecessor` telt hij in werkminuten. Anders telt een lag in werkminuten (of klokminuten bij
 *  kalendertijd). */
export function lagCountsInWorkdays(
  sequence: Pick<Sequence, 'lagMinutes' | 'lagUnit' | 'lagPercent'>,
  options: Pick<EffectiveSchedulingOptions, 'workdayDurationMeasure'>,
  predecessor?: { time: Pick<TaskTime, 'durationUnit' | 'durationType'> },
): boolean {
  if (sequence.lagUnit === 'ELAPSEDTIME' || options.workdayDurationMeasure !== true) return false;
  if (sequence.lagPercent !== undefined) return predecessor !== undefined && taskCountsInWorkdays(predecessor, options);
  return sequence.lagMinutes === undefined;
}
