import { isMultiDocumentImport, type OpenedImport } from '@/services/importTypes';

export const IFC_FOREIGN_OPEN_WARN_BYTES = 150 * 1024 * 1024;

let lowered = Infinity;
export function lowerForeignOpenWarnBytesForTests(bytes?: number): void {
  if (bytes !== undefined && !Number.isFinite(bytes)) throw new RangeError(`lowerForeignOpenWarnBytesForTests: ${bytes} is geen eindig getal`);
  lowered = bytes ?? Infinity;
}

const warnBytes = () => Math.min(lowered, IFC_FOREIGN_OPEN_WARN_BYTES);

export const foreignOpenWarnMiB = (): number => Math.floor(warnBytes() / (1024 * 1024));

export function opensLargeForeignSource(parsed: OpenedImport): boolean {
  const limit = warnBytes();
  return (isMultiDocumentImport(parsed) ? parsed.results : [parsed])
    .some(result => !!result.ifcSource?.foreign && result.ifcSource.bytes.length > limit);
}
