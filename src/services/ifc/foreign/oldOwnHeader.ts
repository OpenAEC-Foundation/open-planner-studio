/** De ene ruwe kopvorm van OPS v2026.2.0 t/m v2026.7.12 (ook tag 2026.7.12).
 * Alle 17 tags: LF, IFC4X3, dezelfde vaste regels en now = toISOString().split('.')[0]. Vanaf v2026.7.13 zijn de
 * drie vrije velden beschermd. Alleen na een strenge scanfout proberen we deze vorm; DATA blijft ongewijzigd streng.
 */
import { scanStep, StepScanError, type StepIndex } from './stepScanner';
import { recognizeOldOwnHeader } from '../oldOwnHeader';

/** Even lange, zelfstandige scankopie; ook Buffer.slice() mag de bron niet delen. */
function oldHeaderForScan(bytes: Uint8Array): Uint8Array | null {
  const header = recognizeOldOwnHeader(bytes);
  if (!header || header === 'main') return null;
  const safe = new Uint8Array(bytes);
  for (const [start, end] of header.fields) safe.fill(0x78, start, end);
  return safe;
}

/** Gedeelde ingang vóór indeling, voor openen en de merge. Een leesbaar bestand behoudt de gewone index/bytes. */
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
