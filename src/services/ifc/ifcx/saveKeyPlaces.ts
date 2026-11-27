import type { IFCSaveSource } from '@/services/documentData';
import type { ModelKey } from './nodes';

export type IfcxSaveKeyPlace =
  | { readonly attributes: readonly ['openaec::ops::modelSource', 'openaec::links'] }
  | { readonly carriedAs: readonly ModelKey[]; readonly stepOnlyProjectField?: keyof IFCSaveSource['project'] }
  | { readonly exception: 'xer-archive'; readonly modelKeys: readonly ModelKey[] }
  | { readonly exception: 'not-written' };

export const IFCX_PLACE_OF_SAVE_KEY = {
  project: { carriedAs: ['project'], stepOnlyProjectField: 'ifcSchemaUnconfirmed' },
  calendar: { carriedAs: ['calendar'] },
  tasks: { carriedAs: ['tasks'] },
  sequences: { carriedAs: ['sequences'] },
  resources: { carriedAs: ['resources'] },
  assignments: { carriedAs: ['assignments'] },
  activityCodeTypes: { carriedAs: ['activityCodeTypes'] },
  customFieldDefs: { carriedAs: ['customFieldDefs'] },
  customTaskTypes: { carriedAs: ['customTaskTypes'] },
  calendars: { carriedAs: ['resourceCalendars'] },
  baselines: { carriedAs: ['baselines'] },
  activeBaselineId: { carriedAs: ['activeBaselineId'] },
  comparedBaselineIds: { carriedAs: ['comparedBaselineIds'] },
  importPristine: { carriedAs: ['importPristine'] },
  recordedDates: { carriedAs: ['recordedFields', 'recordedSourceFormat'] },
  datesAsRecorded: { carriedAs: ['recordedFields', 'recordedSourceFormat'] },
  minuteModelPending: { carriedAs: ['minuteModelPending'] },
  ifcGlobalIds: { carriedAs: ['ifcGlobalIds'] },
  ifcLiteralCalendarIds: { carriedAs: ['ifcLiteralCalendarIds'] },
  xerImportMetadata: { exception: 'xer-archive', modelKeys: ['xer'] },
  xerSourceArchive: { exception: 'xer-archive', modelKeys: ['xerSourceArchive'] },
  xerSourceProjectId: { exception: 'xer-archive', modelKeys: ['xerSourceProjectId'] },
  foreignSourceMark: { exception: 'not-written' },
  ifcSource: { exception: 'not-written' },
  ifcxReferences: { attributes: ['openaec::ops::modelSource', 'openaec::links'] },
} as const satisfies Record<keyof IFCSaveSource, IfcxSaveKeyPlace>;
