import { readIFC, type IfcReadOptions } from './ifcReader';
import {
  XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT, XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_FORMAT,
} from '@/services/xerSourceArchive';
import type { ImportLabels, ImportResult } from '@/services/importTypes';

export type IfcReadWithXerOptions = Omit<IfcReadOptions, 'reconstructXerArchive'>;

export async function readIFCWithXerReconstruction(
  content: string,
  labels: ImportLabels = {},
  options: IfcReadWithXerOptions = {},
): Promise<ImportResult> {
  if (content.includes(XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT)
    || content.includes(XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_FORMAT)) {
    const { reconstructXerSourceFromBytes } = await import('@/services/xer/xerReader');
    return readIFC(content, labels, { ...options, reconstructXerArchive: reconstructXerSourceFromBytes });
  }
  return readIFC(content, labels, options);
}
