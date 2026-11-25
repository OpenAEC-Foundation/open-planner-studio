import type { FileFilter } from '@/services/fileAccess';
import type { IfcxWriteRefusedError } from '@/services/ifc/ifcx/ifcxErrors';
import { IFCX_FILE_FILTERS } from '@/services/formatRegistry';
import { ifcxEnabled, type FeatureFlagValues } from '@/utils/featureFlags';
import { isIfcxName } from '@/utils/filePath';
import { refusalNotice } from './refusalNotice';
import type { NotifyInput } from './slices/types';

export type DocumentFileFormat = 'ifc' | 'ifcx';

type FormatOwner = { readonly filePath: string | null };
type Flags = Readonly<FeatureFlagValues>;

export const IFC_FILE_FILTERS: FileFilter[] = [{ name: 'IFC Files', extensions: ['ifc'] }];

export { isIfcxName };

export function documentFileFormat(document: FormatOwner, featureFlags: Flags): DocumentFileFormat {
  return ifcxEnabled(featureFlags) && isIfcxName(document.filePath) ? 'ifcx' : 'ifc';
}

export function documentFileFilters(format: DocumentFileFormat): FileFilter[] {
  return [...(format === 'ifcx' ? IFCX_FILE_FILTERS : IFC_FILE_FILTERS)];
}

export function fileNameWithFormat(base: string, format: DocumentFileFormat): string {
  return `${base}.${format}`;
}

export function ifcxWriteBlocked(document: FormatOwner, featureFlags: Flags): boolean {
  return !ifcxEnabled(featureFlags) && isIfcxName(document.filePath);
}

export const IFCX_FLAG_OFF_NOTICE: NotifyInput = refusalNotice({ messageKey: 'ifcx.flagOff', dedupeKey: 'ifcx-flag-off' });

export function ifcxWriteRefusedNotice(error: IfcxWriteRefusedError): NotifyInput {
  const detail = error.fields.length > 0 ? error.fields.join(', ') : error.message;
  return refusalNotice({ messageKey: 'ifcx.writeRefused', detail, dedupeKey: 'ifcx-write-refused', replaceOnDedupe: true });
}
