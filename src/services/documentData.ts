import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import type { WithheldTaskTimeField } from '@/services/ifc/ifcTaskSlots';
import type { ReadImportResult, RecordedTimesOrigin } from '@/services/importTypes';
import type { DocumentPayload } from '@/state/documentContract';
import { migrateToMinuteModel } from '@/state/migrations/minuteModel';
import { unrecordedExportFields } from '@/state/recordedDatesSelectors';
import { hasTaskTypeData } from '@/state/taskTypesVisibility';
import { normalizeComparedBaselines } from '@/types/baseline';

export type ImportedDocumentData = Pick<DocumentPayload,
  | 'project' | 'calendar' | 'tasks' | 'sequences' | 'resources' | 'assignments' | 'calendars'
  | 'activityCodeTypes' | 'customFieldDefs' | 'customTaskTypes' | 'baselines' | 'activeBaselineId' | 'comparedBaselineIds'
  | 'xerImportMetadata' | 'xerSourceArchive' | 'xerSourceProjectId' | 'ifcSource' | 'foreignSourceMark' | 'ifcxReferences'
  | 'taskTypesVisible' | 'importPristine' | 'xerArchiveIssue' | 'ifcGlobalIds' | 'ifcLiteralCalendarIds' | 'minuteModelPending'>;

export function documentDataFromImport(parsed: ReadImportResult): ImportedDocumentData {
  const data: ImportedDocumentData = {
    project: parsed.project,
    calendar: parsed.calendar,
    tasks: parsed.tasks,
    sequences: parsed.sequences,
    resources: parsed.resources,
    assignments: parsed.assignments,
    calendars: parsed.resourceCalendars ?? [],
    activityCodeTypes: parsed.activityCodeTypes ?? [],
    customFieldDefs: parsed.customFieldDefs ?? [],
    customTaskTypes: parsed.customTaskTypes ?? [],
    baselines: parsed.baselines ?? [],
    activeBaselineId: parsed.activeBaselineId ?? null,
    comparedBaselineIds: normalizeComparedBaselines(parsed.comparedBaselineIds, parsed.baselines ?? [], parsed.activeBaselineId ?? null),
    xerImportMetadata: parsed.xer ?? null,
    xerSourceArchive: parsed.xerSourceArchive ?? null,
    xerSourceProjectId: parsed.xer?.sourceProjectId ?? parsed.xerSourceProjectId ?? null,
    ifcSource: parsed.ifcSource ?? null,
    ifcxReferences: parsed.ifcxReferences ?? null,
    foreignSourceMark: null,
    taskTypesVisible: hasTaskTypeData(parsed.tasks, parsed.assignments, parsed.project),
    importPristine: parsed.importPristine ?? isFreshImportOrigin(parsed.recordedTimesOrigin),
    xerArchiveIssue: parsed.xerArchiveIssue ?? null,
    ifcGlobalIds: parsed.ifcGlobalIds ?? null,
    ifcLiteralCalendarIds: parsed.ifcLiteralCalendarIds ?? null,
    minuteModelPending: false,
  };
  const migrated = migrateToMinuteModel(data, { timeModel: parsed.timeModel, milestonesAtDayEnd: parsed.milestonesAtDayEnd });
  return { ...migrated.payload, minuteModelPending: migrated.report.conversionPending };
}

export function isFreshImportOrigin(origin: RecordedTimesOrigin | undefined): boolean {
  return origin === 'xer' || origin === 'p6xml' || origin === 'mspdi' || origin === 'mpp' || origin === 'csv' || origin === 'ifc';
}

export type IFCSaveSource = Pick<
  DocumentPayload,
  | 'project'
  | 'calendar'
  | 'tasks'
  | 'sequences'
  | 'resources'
  | 'assignments'
  | 'activityCodeTypes'
  | 'customFieldDefs'
  | 'customTaskTypes'
  | 'calendars'
  | 'baselines'
  | 'activeBaselineId'
  | 'comparedBaselineIds'
  | 'ifcGlobalIds'
  | 'ifcLiteralCalendarIds'
  | 'ifcSource'
  | 'minuteModelPending'
>
  & Partial<Pick<DocumentPayload,
    | 'xerImportMetadata' | 'xerSourceArchive' | 'xerSourceProjectId' | 'importPristine'
    | 'recordedDates' | 'datesAsRecorded'
    | 'foreignSourceMark' | 'ifcxReferences'>>;

export type IFCWriteMode = 'merge' | 'planOnly';

export type IFCWriteInput = WriteIFCInput & { readonly writeMode: IFCWriteMode };

const ALL_COMPUTED_SLOTS: readonly WithheldTaskTimeField[] = [
  'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'totalFloat', 'freeFloat', 'isCritical',
];
function withheldFieldsFor(src: IFCSaveSource): WriteIFCInput['withheldTaskTimeFields'] {
  const recorded = src.recordedDates;
  if (!src.datesAsRecorded || !recorded) return undefined;
  const out: Record<string, readonly WithheldTaskTimeField[]> = {};
  for (const task of src.tasks) {
    const rec = recorded.times[task.id];
    const fields = rec ? unrecordedExportFields(rec) : ALL_COMPUTED_SLOTS;
    if (fields.length > 0) out[task.id] = fields;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function buildWriteIFCInput(src: IFCSaveSource, mode: IFCWriteMode): IFCWriteInput {
  const withheld = withheldFieldsFor(src);
  return {
    writeMode: mode,
    project: src.project,
    minuteModelPending: src.minuteModelPending,
    calendar: src.calendar,
    tasks: src.tasks,
    sequences: src.sequences,
    resources: src.resources,
    assignments: src.assignments,
    activityCodeTypes: src.activityCodeTypes,
    customFieldDefs: src.customFieldDefs,
    customTaskTypes: src.customTaskTypes,
    resourceCalendars: src.calendars,
    baselines: src.baselines,
    activeBaselineId: src.activeBaselineId,
    comparedBaselineIds: src.comparedBaselineIds,
    xer: src.xerImportMetadata ?? undefined,
    xerSourceArchive: src.xerSourceArchive ?? undefined,
    xerSourceProjectId: src.xerSourceProjectId ?? undefined,
    ...(src.importPristine ? { importPristine: true } : {}),
    ...(withheld ? { withheldTaskTimeFields: withheld } : {}),
    ...(src.ifcGlobalIds ? { ifcGlobalIds: src.ifcGlobalIds } : {}),
    ...(src.ifcLiteralCalendarIds?.length ? { ifcLiteralCalendarIds: src.ifcLiteralCalendarIds } : {}),
    ...(src.datesAsRecorded && src.recordedDates?.sourceFormat
      ? { recordedSourceFormat: src.recordedDates.sourceFormat } : {}),
  };
}
