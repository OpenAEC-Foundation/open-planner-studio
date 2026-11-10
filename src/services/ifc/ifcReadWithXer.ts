// `readIFCWithXerReconstruction` in een eigen module (#804 fase 1a): `formatRegistry.ts` en de bytes-route
// (`foreign/ifcBytesRoute.ts`) gebruiken hem allebei. In `formatRegistry` zou de bytes-route een importkring maken
// (`verify:cycles` telt ook een dynamische import). `formatRegistry` exporteert hem opnieuw; bestaande aanroepers
// veranderen niet.
import { readIFC, type IfcReadOptions } from './ifcReader';
import {
  XER_SOURCE_ARCHIVE_COMPACT_STORAGE_FORMAT, XER_SOURCE_ARCHIVE_RECOVERY_REFERENCE_FORMAT,
} from '@/services/xerSourceArchive';
import type { ImportLabels, ImportResult } from '@/services/importTypes';

/** Alle leesopties behalve de reconstructor: die kiest deze functie zelf. */
export type IfcReadWithXerOptions = Omit<IfcReadOptions, 'reconstructXerArchive'>;

/**
 * Lees IFC met behoud van de lazy XER-chunkgrens. Alleen een schema-2-envelope (of een schema-3-
 * crashherstelverwijzing) laadt de parser; gewone IFC en historische schema-1-archieven blijven op
 * het bestaande synchrone hoofdpad. `resolveXerArchiveReference` geeft alleen crashherstel mee.
 */
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
