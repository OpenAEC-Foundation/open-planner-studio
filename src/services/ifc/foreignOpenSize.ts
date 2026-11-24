import { isMultiDocumentImport, type OpenedImport } from '@/services/importTypes';

export const IFC_FOREIGN_OPEN_WARN_MIB = 150;
export const IFC_FOREIGN_OPEN_WARN_BYTES = IFC_FOREIGN_OPEN_WARN_MIB * 1024 * 1024;

let lowered = Infinity;
export function lowerForeignOpenWarnBytesForTests(bytes?: number): void {
  if (bytes !== undefined && !Number.isFinite(bytes)) throw new RangeError(`lowerForeignOpenWarnBytesForTests: ${bytes} is geen eindig getal`);
  lowered = bytes ?? Infinity;
}

export function opensLargeForeignSource(parsed: OpenedImport): boolean {
  const limit = Math.min(lowered, IFC_FOREIGN_OPEN_WARN_BYTES);
  return (isMultiDocumentImport(parsed) ? parsed.results : [parsed])
    .some(result => !!result.ifcSource?.foreign && result.ifcSource.bytes.length > limit);
}
