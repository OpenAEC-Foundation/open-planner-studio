import { IFC_SCHEMAS, type Project } from '@/types/project';
import {
  BOOLEAN, CALENDAR_DATE, enumOf, GLOBAL_ID_OUTSIDE_PATH, ISO_DATE_OR_MOMENT_OR_EMPTY, NON_EMPTY_TEXT, REFERENCE, TEXT, VERSION_TEXT,
  type IfcxField,
} from '../fieldTable';
import { OPS_PROFILE_VERSION } from '../profile';
import { existingDatePart } from '../dateProjection';

export interface DocumentWriteSource {
  readonly project: Project;
  readonly headerUuid: string;
  readonly headerAuthor: string;
  readonly projectGlobalIdOutsidePath?: string;
  readonly workplanGlobalIdOutsidePath?: string;
  readonly scheduleGlobalIdOutsidePath?: string;
  readonly projectCalendarPath: string;
}

export interface DocumentReadTarget {
  readonly project: Project;
  readonly headerUuid: string;
  formatVersion: string;
  projectGlobalIdOutsidePath?: string;
  workplanGlobalIdOutsidePath?: string;
  scheduleGlobalIdOutsidePath?: string;
  calendarPath: string;
}

type DocumentField = IfcxField<DocumentWriteSource, DocumentReadTarget>;

export function sharedProjectDate(entered: string): string | undefined {
  return existingDatePart(entered);
}

function setOptional<K extends keyof Project>(project: Project, key: K, value: Project[K] | undefined): void {
  if (value !== undefined) project[key] = value;
}

export const WORKPLAN_FIELDS: readonly DocumentField[] = [
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
    key: 'start', value: CALENDAR_DATE, optional: true,
    write: s => sharedProjectDate(s.project.startDate),
    read: (v, t) => { t.project.startDate = (v as string | undefined) ?? ''; },
  },
  {
    key: 'finish', value: CALENDAR_DATE, optional: true,
    write: s => sharedProjectDate(s.project.endDate),
    read: (v, t) => { t.project.endDate = (v as string | undefined) ?? ''; },
  },
  {
    key: 'calendar', value: REFERENCE,
    write: s => s.projectCalendarPath,
    read: (v, t) => { t.calendarPath = v as string; },
  },
];

export const DOCUMENT_OPS_FIELDS: readonly DocumentField[] = [
  {
    key: 'formatVersion', value: VERSION_TEXT,
    write: () => OPS_PROFILE_VERSION,
    read: (v, t) => { t.formatVersion = v as string; },
  },
  {
    key: 'projectId', value: NON_EMPTY_TEXT, optional: true,
    write: s => (s.project.id !== s.headerUuid ? s.project.id : undefined),
    read: (v, t) => { t.project.id = (v as string | undefined) ?? t.headerUuid; },
  },
  {
    key: 'globalId', value: GLOBAL_ID_OUTSIDE_PATH, optional: true,
    write: s => s.projectGlobalIdOutsidePath,
    read: (v, t) => { t.projectGlobalIdOutsidePath = v as string | undefined; },
  },
  {
    key: 'workplanGlobalId', value: GLOBAL_ID_OUTSIDE_PATH, optional: true,
    write: s => s.workplanGlobalIdOutsidePath,
    read: (v, t) => { t.workplanGlobalIdOutsidePath = v as string | undefined; },
  },
  {
    key: 'scheduleGlobalId', value: GLOBAL_ID_OUTSIDE_PATH, optional: true,
    write: s => s.scheduleGlobalIdOutsidePath,
    read: (v, t) => { t.scheduleGlobalIdOutsidePath = v as string | undefined; },
  },
  {
    key: 'startDate', value: ISO_DATE_OR_MOMENT_OR_EMPTY, optional: true,
    write: s => (s.project.startDate !== (sharedProjectDate(s.project.startDate) ?? '') ? s.project.startDate : undefined),
    read: (v, t) => setOptional(t.project, 'startDate', v as string | undefined),
  },
  {
    key: 'endDate', value: ISO_DATE_OR_MOMENT_OR_EMPTY, optional: true,
    write: s => (s.project.endDate !== (sharedProjectDate(s.project.endDate) ?? '') ? s.project.endDate : undefined),
    read: (v, t) => setOptional(t.project, 'endDate', v as string | undefined),
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
    write: s => (s.project.author !== s.headerAuthor ? s.project.author : undefined),
    read: (v, t) => setOptional(t.project, 'author', v as string | undefined),
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
    key: 'ifcSchemaUnconfirmed', value: TEXT, optional: true,
    write: s => s.project.ifcSchemaUnconfirmed,
    read: (v, t) => setOptional(t.project, 'ifcSchemaUnconfirmed', v as string | undefined),
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
];

export const SCHEDULE_FIELDS: readonly IfcxField<{ readonly workplanPath: string }, { workplanPath?: string }>[] = [
  {
    key: 'workplan', value: REFERENCE,
    write: s => s.workplanPath,
    read: (v, t) => { t.workplanPath = v as string; },
  },
];

export const PROJECT_KEYS_CARRIED: readonly (keyof Project)[] = [
  'id', 'name', 'description', 'startDate', 'endDate', 'calendarId', 'createdAt', 'modifiedAt', 'author', 'company',
  'ifcSchema', 'ifcSchemaUnconfirmed', 'wbsAutoNumber', 'defaultTaskDurationUnit', 'statusDate',
];

export function emptyProject(): Project {
  return {
    id: '', name: '', description: '', startDate: '', endDate: '', calendarId: '', createdAt: '', modifiedAt: '',
    author: '', company: '',
  };
}
