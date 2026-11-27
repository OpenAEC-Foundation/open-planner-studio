import { saveTargetRef, type FileFilter, type SaveTargetFields } from '@/services/fileAccess';
import type { IfcxWriteRefusedError } from '@/services/ifc/ifcx/ifcxErrors';
import { IFCX_FILE_FILTERS } from '@/services/formatRegistry';
import { ifcxEnabled, type FeatureFlagValues } from '@/utils/featureFlags';
import { isIfcxName } from '@/utils/filePath';
import type { DocumentFileFormat } from './documentContract';
import type { IFCWriteInput } from './ifcSaveInput';
import { refusalNotice } from './refusalNotice';
import type { NotificationDetailLine, NotifyInput } from './slices/types';
import type { ReadImportResult } from '@/services/importTypes';

export type { DocumentFileFormat };

type FormatOwner = { readonly fileFormat: DocumentFileFormat };
type Flags = Readonly<FeatureFlagValues>;

export const IFC_FILE_FILTERS: FileFilter[] = [{ name: 'IFC Files', extensions: ['ifc'] }];

export { isIfcxName };

export function outputFormat(document: FormatOwner, featureFlags: Flags): DocumentFileFormat {
  return document.fileFormat === 'ifcx' && ifcxEnabled(featureFlags) ? 'ifcx' : 'ifc';
}

export function namesFollowFormat(document: FormatOwner, featureFlags: Flags): boolean {
  return document.fileFormat === 'ifcx' || ifcxEnabled(featureFlags);
}

export function nameFitsFormat(name: string, format: DocumentFileFormat): boolean {
  return isIfcxName(name) === (format === 'ifcx');
}

export function nameWithFormat(name: string, format: DocumentFileFormat): string {
  if (format === 'ifcx') return isIfcxName(name) ? name : `${name.replace(/\.ifc$/i, '')}.ifcx`;
  return isIfcxName(name) ? name.slice(0, -1) : name;
}

export function documentFileFilters(format: DocumentFileFormat): FileFilter[] {
  return [...(format === 'ifcx' ? IFCX_FILE_FILTERS : IFC_FILE_FILTERS)];
}

export function saveAsFileFilters(format: DocumentFileFormat): FileFilter[] {
  return [...documentFileFilters(format), ...documentFileFilters(format === 'ifcx' ? 'ifc' : 'ifcx')];
}

export function formatOfName(name: string): DocumentFileFormat {
  return isIfcxName(name) ? 'ifcx' : 'ifc';
}

export function ifcxInputWithoutXerArchive(input: IFCWriteInput): IFCWriteInput {
  return { ...input, xer: undefined, xerSourceArchive: undefined, xerSourceProjectId: undefined };
}

export function fileNameWithFormat(base: string, format: DocumentFileFormat): string {
  return `${base}.${format}`;
}

export function ifcxWriteBlocked(document: FormatOwner & SaveTargetFields, featureFlags: Flags): boolean {
  return document.fileFormat === 'ifcx' && !ifcxEnabled(featureFlags) && saveTargetRef(document) !== null;
}

export const IFCX_FLAG_OFF_NOTICE: NotifyInput = refusalNotice({ messageKey: 'ifcx.flagOff', dedupeKey: 'ifcx-flag-off' });

export const IFCX_NAME_MISMATCH_NOTICE: NotifyInput = refusalNotice({ messageKey: 'ifcx.nameMismatch', dedupeKey: 'ifcx-name-mismatch' });

export function ifcxWriteRefusedNotice(error: IfcxWriteRefusedError): NotifyInput {
  const detail = error.fields.length > 0 ? error.fields.join(', ') : error.message;
  return refusalNotice({ messageKey: 'ifcx.writeRefused', detail, dedupeKey: 'ifcx-write-refused', replaceOnDedupe: true });
}

export function ifcxImportNotice(file: string, summary: NonNullable<ReadImportResult['ifcxImport']>): NotifyInput {
  const { leftBehind, convertedToManual, origin, planningContent } = summary;
  const detailLines: NotificationDetailLine[] = [];
  const header = [origin.author, origin.id].filter(Boolean).join(' · ');
  if (!origin.hasOpsDocument && header) detailLines.push({ messageKey: 'ifcx.import.origin', params: { origin: header } });
  if (planningContent === 'unknown-only') detailLines.push({ messageKey: 'ifcx.import.noTasks' });
  const items = [
    ...leftBehind.attributes.map(({ attribute, count }) => `${attribute} (×${count})`),
    ...leftBehind.fields.map(({ attribute, field, count }) => `${attribute}.${field} (×${count})`),
    ...leftBehind.linkRelations.map(({ relation, count }) => `openaec::links/${relation} (×${count})`),
  ];
  if (items.length) detailLines.push({ messageKey: 'ifcx.import.leftBehind', params: { file, items: items.join(', ') } });
  if (leftBehind.workplans.length) detailLines.push({ messageKey: 'ifcx.import.workplans',
    params: { total: leftBehind.workplans.length, paths: leftBehind.workplans.join(', ') } });
  if (convertedToManual) detailLines.push({ messageKey: 'ifcx.import.manual', params: { total: convertedToManual } });
  return { severity: 'info', messageKey: planningContent === 'known' ? 'ifcx.import.opened' : 'ifcx.model.opened',
    params: { file }, detailLines, sticky: true };
}
