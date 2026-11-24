import { readIFC } from '../ifcReader';
import { writeIFC, type WriteIFCInput } from '../ifcWriter';
import type { ImportResult } from '@/services/importTypes';

export function stepRoundtrip(input: WriteIFCInput): ImportResult {
  const { createdAt, modifiedAt } = input.project;
  return readIFC(writeIFC(input), {}, { projectTimestampFallback: { createdAt, modifiedAt } });
}
