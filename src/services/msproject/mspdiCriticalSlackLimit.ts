import type { ProjectSchedulingOptions } from '@/types/project';

/**
 * De kritiek-drempel die MSPDI native draagt als `<CriticalSlackLimit>` (hele dagen), of `undefined` als de
 * definitie daar niet in past. Eén beslissing voor de writer en de verliesdetector (`xerExportLoss.ts`), zodat
 * wat de writer weglaat ook als verlies telt.
 *
 * Past: `totalFloat` met een niet-negatieve hele dagdrempel. Niet: `longestPath`, een breuk of negatieve
 * drempel, en elke `thresholdHours`. Die laatste wint in de motor (`scheduleAnalysis.ts`) en telt per taak in
 * uren op diens eigen kalender; de dagdrempel ernaast is dan niet de geldende instelling (#561). Een omrekening
 * naar dagen zou bij verschillende taakkalenders een schijnbaar exacte waarde geven.
 */
export function mspdiCriticalSlackLimit(
  definition: ProjectSchedulingOptions['criticalDefinition'],
): number | undefined {
  if (!definition
    || definition.mode !== 'totalFloat'
    || definition.thresholdHours !== undefined
    || typeof definition.threshold !== 'number'
    || !Number.isInteger(definition.threshold)
    || definition.threshold < 0) return undefined;
  return definition.threshold;
}
