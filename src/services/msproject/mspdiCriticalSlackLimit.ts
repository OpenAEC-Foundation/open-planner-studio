import type { ProjectSchedulingOptions } from '@/types/project';

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

export function mspdiDropsHourThreshold(definition: ProjectSchedulingOptions['criticalDefinition']): boolean {
  return definition?.mode === 'totalFloat' && definition.thresholdHours !== undefined
    && mspdiCriticalSlackLimit(definition) === undefined;
}
