/**
 * Alleen uren §3.2, §3.3, §3.5 en §3.14: telt een duur, lag of rest in de DAGENMAAT (werkdagen op de
 * kalender) of in de URENMAAT (werkminuten)? Dit is de ene plek voor die vraag. Een aanroeper kijkt dus
 * niet zelf naar `durationUnit`, `lagMinutes` of `isHourMode`.
 *
 * De maat van de data zegt wat de planner invoerde; de conventie `workdayDurationMeasure` zegt of het
 * profiel die dagenmaat ook zo telt. Onder het P6- en het MSP-profiel staat ze uit: dan telt een dagenmaat
 * als uren (dagen × werktijd per dag × 60 minuten). Kalendertijd (`ELAPSEDTIME`) en een procentlag tellen
 * nooit in de dagenmaat, in geen enkel profiel.
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

/** Telt deze lag in de dagenmaat? Ja als het een lag in dagen is (`lagDays` zonder `lagMinutes`), geen
 *  kalendertijd (`lagUnit: 'ELAPSEDTIME'`) en geen procentlag, en de conventie `workdayDurationMeasure`
 *  aan staat. Anders telt hij in werkminuten (of klokminuten bij kalendertijd). */
export function lagCountsInWorkdays(
  sequence: Pick<Sequence, 'lagMinutes' | 'lagUnit' | 'lagPercent'>,
  options: Pick<EffectiveSchedulingOptions, 'workdayDurationMeasure'>,
): boolean {
  return sequence.lagMinutes === undefined
    && sequence.lagUnit !== 'ELAPSEDTIME'
    && sequence.lagPercent === undefined
    && options.workdayDurationMeasure === true;
}
