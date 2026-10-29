import type { ProjectSchedulingOptions } from '@/types/project';

/**
 * De kritiek-drempel die MSPDI native draagt als `<CriticalSlackLimit>` (hele dagen), of `undefined` als de
 * definitie daar niet in past. Eén beslissing voor de writer en de verliesdetector (`xerExportLoss.ts`), zodat
 * wat de writer weglaat ook als verlies telt.
 *
 * Past: `totalFloat` met een niet-negatieve hele dagdrempel. Met `thresholdHours` beslist alleen die: hij wint in
 * de motor (`scheduleAnalysis.ts`) en telt per taak in uren op diens eigen kalender, dus de dagdrempel ernaast is
 * niet de geldende instelling (#561). Alleen 0 uur is op elke kalender precies 0 dagen (de P6-standaard); een
 * andere urendrempel zou als dagen een schijnbaar exacte waarde geven en past dus niet. Ook niet: `longestPath`
 * en een breuk of negatieve dagdrempel.
 */
export function mspdiCriticalSlackLimit(
  definition: ProjectSchedulingOptions['criticalDefinition'],
): number | undefined {
  if (!definition || definition.mode !== 'totalFloat') return undefined;
  if (definition.thresholdHours !== undefined) return definition.thresholdHours === 0 ? 0 : undefined;
  if (typeof definition.threshold !== 'number'
    || !Number.isInteger(definition.threshold)
    || definition.threshold < 0) return undefined;
  return definition.threshold;
}
