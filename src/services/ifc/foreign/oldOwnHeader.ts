import { scanStep, StepScanError, utf8BomLength, type StepIndex } from './stepScanner';
import { recognizeOldOwnHeader } from '../oldOwnHeader';

function oldHeaderForScan(bytes: Uint8Array): Uint8Array | null {
  const headerStart = utf8BomLength(bytes);
  const header = recognizeOldOwnHeader(bytes.subarray(headerStart));
  if (!header || header === 'main') return null;
  const safe = new Uint8Array(bytes);
  for (const [start, end] of header.fields) safe.fill(0x78, headerStart + start, headerStart + end);
  return safe;
}

export function scanForeignStep(bytes: Uint8Array): StepIndex {
  try {
    return scanStep(bytes);
  } catch (error) {
    if (!(error instanceof StepScanError)) throw error;
    const safe = oldHeaderForScan(bytes);
    if (!safe) throw error;
    return scanStep(safe);
  }
}
