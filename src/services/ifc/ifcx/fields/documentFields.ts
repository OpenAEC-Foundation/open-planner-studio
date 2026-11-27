import { IFC_SCHEMAS, type Project } from '@/types/project';
import {
  arrayOf, BOOLEAN, CALENDAR_DATE, enumOf, ISO_DATE_OR_MOMENT_OR_EMPTY, NON_EMPTY_TEXT, REFERENCE, TEXT, VERSION_TEXT,
  type IfcxField, type SharedField,
} from '../fieldTable';
import { OPS_PROFILE_VERSION } from '../profile';
import { existingDatePart } from '../dateProjection';
import type { RecordedSourceFormat } from '@/services/importTypes';
import { PROJECT_SETTINGS_FIELDS, PROJECT_SETTINGS_KEYS_CARRIED } from './projectSettingsFields';
import { SCHEDULING_FIELDS, SCHEDULING_KEYS_CARRIED } from './schedulingFields';
import { STRUCTURE_DOCUMENT_FIELDS, type PlanningStructure } from './structureFields';
import { BASELINE_SET_FIELDS, type BaselineSetReadTarget, type BaselineSetWriteSource } from './baselineFields';

export interface DocumentWriteSource extends BaselineSetWriteSource {
  readonly project: Project;
  readonly projectPath: string;
  readonly projectCalendarPath: string;
  readonly workplanPath: string;
  readonly timeModel?: string;
  readonly minuteModelPending: boolean;
  readonly importPristine: boolean;
  readonly literalCalendarPaths: readonly string[];
  readonly structure: Readonly<PlanningStructure>;
  readonly recordedSourceFormat?: RecordedSourceFormat;
}

export interface DocumentReadTarget extends BaselineSetReadTarget {
  readonly project: Project;
  readonly projectPath: string;
  calendarPath: string;
  timeModel?: string;
  minuteModelPending: boolean;
  importPristine: boolean;
  literalCalendarPaths: string[];
  structure: PlanningStructure;
  recordedSourceFormat?: RecordedSourceFormat;
}

type DocumentField = IfcxField<DocumentWriteSource, DocumentReadTarget>;

function setOptional<K extends keyof Project>(project: Project, key: K, value: Project[K] | undefined): void {
  if (value !== undefined) project[key] = value;
}

export const WORKPLAN_SHARED_FIELDS: readonly SharedField<DocumentWriteSource>[] = [
  { key: 'name', value: TEXT, write: s => s.project.name },
  { key: 'description', value: TEXT, optional: true, write: s => s.project.description || undefined },
  { key: 'start', value: CALENDAR_DATE, optional: true, write: s => existingDatePart(s.project.startDate) },
  { key: 'finish', value: CALENDAR_DATE, optional: true, write: s => existingDatePart(s.project.endDate) },
  { key: 'calendar', value: REFERENCE, write: s => s.projectCalendarPath },
];

export const SCHEDULE_SHARED_FIELDS: readonly SharedField<DocumentWriteSource>[] = [
  { key: 'workplan', value: REFERENCE, write: s => s.workplanPath },
];

export const DOCUMENT_FIELDS: readonly DocumentField[] = [
  {
    key: 'formatVersion', value: VERSION_TEXT,
    write: () => OPS_PROFILE_VERSION,
    read: () => {},
  },
  {
    key: 'name', value: TEXT,
    write: s => s.project.name,
    read: (v, t) => { t.project.name = v as string; },
  },
  {
    key: 'description', value: TEXT, optional: true,
    write: s => s.project.description || undefined,
    read: (v, t) => { t.project.description = (v as string | undefined) ?? ''; },
  },
  {
    key: 'calendar', value: REFERENCE,
    write: s => s.projectCalendarPath,
    read: (v, t) => { t.calendarPath = v as string; },
  },
  {
    key: 'projectId', value: NON_EMPTY_TEXT, optional: true,
    write: s => (s.project.id !== s.projectPath ? s.project.id : undefined),
    read: (v, t) => { t.project.id = (v as string | undefined) ?? t.projectPath; },
  },
  {
    key: 'startDate', value: ISO_DATE_OR_MOMENT_OR_EMPTY, optional: true,
    write: s => s.project.startDate || undefined,
    read: (v, t) => { t.project.startDate = (v as string | undefined) ?? ''; },
  },
  {
    key: 'endDate', value: ISO_DATE_OR_MOMENT_OR_EMPTY, optional: true,
    write: s => s.project.endDate || undefined,
    read: (v, t) => { t.project.endDate = (v as string | undefined) ?? ''; },
  },
  {
    key: 'createdAt', value: ISO_DATE_OR_MOMENT_OR_EMPTY, optional: true,
    write: s => s.project.createdAt || undefined,
    read: (v, t) => { t.project.createdAt = (v as string | undefined) ?? ''; },
  },
  {
    key: 'modifiedAt', value: ISO_DATE_OR_MOMENT_OR_EMPTY, optional: true,
    write: s => s.project.modifiedAt || undefined,
    read: (v, t) => { t.project.modifiedAt = (v as string | undefined) ?? ''; },
  },
  {
    key: 'author', value: TEXT, optional: true,
    write: s => s.project.author || undefined,
    read: (v, t) => { t.project.author = (v as string | undefined) ?? ''; },
  },
  {
    key: 'company', value: TEXT, optional: true,
    write: s => s.project.company || undefined,
    read: (v, t) => { t.project.company = (v as string | undefined) ?? ''; },
  },
  {
    key: 'ifcSchema', value: enumOf(IFC_SCHEMAS), optional: true,
    write: s => s.project.ifcSchema,
    read: (v, t) => setOptional(t.project, 'ifcSchema', v as Project['ifcSchema']),
  },
  {
    key: 'wbsAutoNumber', value: BOOLEAN, optional: true,
    write: s => s.project.wbsAutoNumber,
    read: (v, t) => setOptional(t.project, 'wbsAutoNumber', v as boolean | undefined),
  },
  {
    key: 'defaultTaskDurationUnit', value: enumOf(['days', 'hours']), optional: true,
    write: s => s.project.defaultTaskDurationUnit,
    read: (v, t) => setOptional(t.project, 'defaultTaskDurationUnit', v as Project['defaultTaskDurationUnit']),
  },
  {
    key: 'statusDate', value: ISO_DATE_OR_MOMENT_OR_EMPTY, optional: true,
    write: s => s.project.statusDate,
    read: (v, t) => setOptional(t.project, 'statusDate', v as string | undefined),
  },
  {
    key: 'timeModel', value: NON_EMPTY_TEXT, optional: true,
    write: s => s.timeModel,
    read: (v, t) => { t.timeModel = v as string | undefined; },
  },
  {
    key: 'minuteModelPending', value: BOOLEAN, optional: true,
    write: s => (s.minuteModelPending ? true : undefined),
    read: (v, t) => { t.minuteModelPending = v === true; },
  },
  {
    key: 'importPristine', value: BOOLEAN, optional: true,
    write: s => (s.importPristine ? true : undefined),
    read: (v, t) => { t.importPristine = v === true; },
  },
  {
    key: 'literalCalendars', value: arrayOf(REFERENCE), optional: true,
    write: s => (s.literalCalendarPaths.length > 0 ? [...s.literalCalendarPaths] : undefined),
    read: (v, t) => { t.literalCalendarPaths = [...((v as string[] | undefined) ?? [])]; },
  },
  ...PROJECT_SETTINGS_FIELDS, ...SCHEDULING_FIELDS, ...STRUCTURE_DOCUMENT_FIELDS,
  ...BASELINE_SET_FIELDS,
];

export const PROJECT_KEYS_CARRIED: readonly (keyof Project)[] = [
  'id', 'name', 'description', 'startDate', 'endDate', 'calendarId', 'createdAt', 'modifiedAt', 'author', 'company',
  'ifcSchema', 'wbsAutoNumber', 'defaultTaskDurationUnit', 'statusDate',
  ...PROJECT_SETTINGS_KEYS_CARRIED, ...SCHEDULING_KEYS_CARRIED,
];

export function emptyProject(): Project {
  return {
    id: '', name: '', description: '', startDate: '', endDate: '', calendarId: '', createdAt: '', modifiedAt: '',
    author: '', company: '',
  };
}
