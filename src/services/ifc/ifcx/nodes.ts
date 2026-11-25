import type { WriteIFCInput } from '../ifcWriter';
import { savedCustomTaskTypes } from '@/services/taskTypes/customTaskTypeRules';
import { carriesValue, ifc5ValueDescription, membersOf, objectOf, type IfcxMember, type IfcxValue } from './fieldTable';
import { ATTRIBUTE, type IfcxAttributeName } from './profile';
import { DOCUMENT_FIELDS, PROJECT_KEYS_CARRIED, SCHEDULE_SHARED_FIELDS, WORKPLAN_SHARED_FIELDS } from './fields/documentFields';
import { CALENDAR_FIELDS, CALENDAR_KEYS_CARRIED, CALENDAR_SHARED_FIELDS } from './fields/calendarFields';
import { TASK_FIELDS, TASK_KEYS_CARRIED, TASK_SHARED_FIELDS, TASK_TIME_KEYS_CARRIED } from './fields/taskFields';
import { SEQUENCE_FIELDS, SEQUENCE_KEYS_CARRIED, SEQUENCE_SHARED_FIELDS } from './fields/sequenceFields';

export type NodeKind = 'workplan' | 'schedule' | 'calendar' | 'task' | 'sequence';
export type ModelKey = keyof WriteIFCInput;

export interface AttributeRegistration {
  readonly name: IfcxAttributeName;
  readonly fields: readonly (IfcxMember & { readonly key: string })[];
}

export interface CarriedObjectKeys {
  readonly object: string;
  readonly instances: (model: WriteIFCInput) => readonly (readonly [string, object])[];
  readonly keys: readonly string[];
}

export interface NodeRegistration {
  readonly kind: NodeKind;
  readonly attributes: readonly AttributeRegistration[];
  readonly modelKeys: readonly ModelKey[];
  readonly objectKeys: readonly CarriedObjectKeys[];
}

export const NODES: readonly NodeRegistration[] = [
  {
    kind: 'workplan',
    attributes: [{ name: ATTRIBUTE.workplan, fields: WORKPLAN_SHARED_FIELDS }, { name: ATTRIBUTE.document, fields: DOCUMENT_FIELDS }],
    modelKeys: ['project', 'timeModel', 'minuteModelPending', 'importPristine', 'ifcLiteralCalendarIds', 'recordedTimesOrigin'],
    objectKeys: [{ object: 'project', instances: model => [['het project', model.project]], keys: PROJECT_KEYS_CARRIED }],
  },
  {
    kind: 'schedule',
    attributes: [{ name: ATTRIBUTE.schedule, fields: SCHEDULE_SHARED_FIELDS }],
    modelKeys: [],
    objectKeys: [],
  },
  {
    kind: 'calendar',
    attributes: [{ name: ATTRIBUTE.calendar, fields: CALENDAR_SHARED_FIELDS }, { name: ATTRIBUTE.opsCalendar, fields: CALENDAR_FIELDS }],
    modelKeys: ['calendar', 'resourceCalendars'],
    objectKeys: [{
      object: 'calendar', keys: CALENDAR_KEYS_CARRIED,
      instances: model => [model.calendar, ...(model.resourceCalendars ?? [])].map(calendar => [`kalender ${calendar.id}`, calendar] as const),
    }],
  },
  {
    kind: 'task',
    attributes: [{ name: ATTRIBUTE.activity, fields: TASK_SHARED_FIELDS }, { name: ATTRIBUTE.opsTask, fields: TASK_FIELDS }],
    modelKeys: ['tasks', 'recordedFields'],
    objectKeys: [
      { object: 'task', instances: model => model.tasks.map(task => [`taak ${task.id}`, task] as const), keys: TASK_KEYS_CARRIED },
      { object: 'task.time', instances: model => model.tasks.map(task => [`taak ${task.id}`, task.time] as const), keys: TASK_TIME_KEYS_CARRIED },
    ],
  },
  {
    kind: 'sequence',
    attributes: [{ name: ATTRIBUTE.sequence, fields: SEQUENCE_SHARED_FIELDS }, { name: ATTRIBUTE.opsSequence, fields: SEQUENCE_FIELDS }],
    modelKeys: ['sequences'],
    objectKeys: [{ object: 'sequence', instances: model => model.sequences.map(sequence => [`relatie ${sequence.id}`, sequence] as const), keys: SEQUENCE_KEYS_CARRIED }],
  },
];

export const PATH_MODEL_KEYS: readonly ModelKey[] = ['ifcGlobalIds'];

export const LOAD_BOUNDARY_MODEL_KEYS: readonly ModelKey[] = ['milestonesAtDayEnd'];

const MODEL_KEYS = {
  project: true, calendar: true, tasks: true, sequences: true, resources: true, assignments: true, resourceCalendars: true,
  activityCodeTypes: true, customFieldDefs: true, customTaskTypes: true, baselines: true, activeBaselineId: true,
  comparedBaselineIds: true, libraryPool: true, timeModel: true, milestonesAtDayEnd: true, sourceScheduleNotes: true,
  recordedFields: true, recordedTimes: true, recordedTimesOrigin: true, importPristine: true, ifcGlobalIds: true,
  baselineOrphanGuids: true, ifcLiteralCalendarIds: true, recordedSourceFormat: true, suggestedProfileId: true, xer: true,
  xerOrigin: true, xerSourceArchive: true, ifcSource: true, ifcLegacySchemaLoss: true, recoveryForeignSource: true,
  xerSourceProjectId: true, xerArchiveIssue: true, xerMissingPlannedStarts: true, p6xmlReport: true, msProjectReport: true,
  minuteModelPending: true, withheldTaskTimeFields: true, xerSourceArchiveStorage: true,
} as const satisfies Record<ModelKey, true>;

export const ALL_MODEL_KEYS = Object.keys(MODEL_KEYS) as ModelKey[];

const CARRIED_MODEL_KEYS = new Set<ModelKey>([...NODES.flatMap(node => node.modelKeys), ...PATH_MODEL_KEYS, ...LOAD_BOUNDARY_MODEL_KEYS]);

export const STEP_WRITER_INPUT_NOT_CARRIED: readonly ModelKey[] = ALL_MODEL_KEYS.filter(key => !CARRIED_MODEL_KEYS.has(key));

const CARRIES_CONTENT: Partial<Record<ModelKey, (model: WriteIFCInput) => boolean>> = {
  customTaskTypes: model => savedCustomTaskTypes(model.tasks, model.customTaskTypes ?? []).length > 0,
};

export function carriesModelContent(model: WriteIFCInput, key: ModelKey): boolean {
  const carries = CARRIES_CONTENT[key];
  return carries ? carries(model) : carriesValue(model[key]);
}

export const OWN_ATTRIBUTE_VALUES: ReadonlyMap<IfcxAttributeName, IfcxValue> = new Map(
  NODES.flatMap(node => node.attributes.map(attribute => [attribute.name, objectOf(membersOf(attribute.fields))] as const)),
);

export const NODE_SHAPES: readonly { readonly kind: NodeKind; readonly attributes: ReadonlySet<IfcxAttributeName> }[] = NODES.map(node => ({
  kind: node.kind, attributes: new Set(node.attributes.map(attribute => attribute.name)),
}));

export function isOwnAttributeName(name: string): name is IfcxAttributeName {
  return OWN_ATTRIBUTE_VALUES.has(name as IfcxAttributeName);
}

export function ownSchemas(used: ReadonlySet<string>): Record<string, { value: Record<string, unknown> }> {
  const schemas: Record<string, { value: Record<string, unknown> }> = {};
  for (const [name, value] of OWN_ATTRIBUTE_VALUES) if (used.has(name)) schemas[name] = { value: ifc5ValueDescription(value) };
  return schemas;
}
