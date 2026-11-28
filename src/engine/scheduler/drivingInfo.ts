import type { CPMResult } from './CPMSolver';

export function knownDrivingSequenceIds<Ids extends readonly string[]>(
  cpm: (Pick<CPMResult, 'drivingUnknown' | 'error'> & { drivingSequenceIds: Ids }) | null | undefined,
): Ids | undefined {
  if (!cpm || cpm.error || cpm.drivingUnknown) return undefined;
  return cpm.drivingSequenceIds;
}
