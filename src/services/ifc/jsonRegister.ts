import { PROP, PSET } from './ifcPsets';
import {
  DAY_MEASURE_DURATION_KEYS, DAY_MEASURE_DURATIONS_PROP, DAY_MEASURE_LAGS_PROP, EXACT_FLOAT_KEYS, EXACT_FLOAT_PROP,
  EXACT_MINUTE_LAGS_PROP, EXACT_MINUTES_KEYS, EXACT_MINUTES_PROP,
} from './dayMeasureIo';
import { SCHEDULING_OPTION_KEYS } from './schedulingOptionsRead';
import { CONVENTION_KEYS } from '@/engine/scheduler/conventions/registry';

export type JsonListIdentity = { readonly veld: string } | 'herkomstmerk';
export type JsonMapIdentity = 'sleutel' | 'toewijzing';

export type JsonShape =
  | { readonly soort: 'waarde' }
  | { readonly soort: 'doorgegeven' }
  | { readonly soort: 'object'; readonly sleutels: Readonly<Record<string, JsonShape>> }
  | { readonly soort: 'lijst'; readonly identiteit: JsonListIdentity; readonly item: JsonShape }
  | { readonly soort: 'kaart'; readonly identiteit: JsonMapIdentity; readonly waarde: JsonShape };

export interface JsonProperty {
  readonly pset: string;
  readonly property: string;
  readonly shape: JsonShape;
}

const value: JsonShape = { soort: 'waarde' };
const passedOn: JsonShape = { soort: 'doorgegeven' };
const object = (sleutels: Readonly<Record<string, JsonShape>>): JsonShape => ({ soort: 'object', sleutels });
const values = (...names: readonly string[]): JsonShape => object(Object.fromEntries(names.map(name => [name, value])));
const byField = (veld: string, item: JsonShape): JsonShape => ({ soort: 'lijst', identiteit: { veld }, item });
const byOrigin = (item: JsonShape): JsonShape => ({ soort: 'lijst', identiteit: 'herkomstmerk', item });
const keyed = (identiteit: JsonMapIdentity, waarde: JsonShape): JsonShape => ({ soort: 'kaart', identiteit, waarde });

const libraryOrigin = values('companyId', 'libraryItemId', 'poolVersion', 'syncedHash');
const conventions = values(...CONVENTION_KEYS);

export const JSON_PROPERTIES: readonly JsonProperty[] = [
  {
    pset: PSET.StructureMeta, property: PROP.StructureMeta.structure,
    shape: object({
      activityCodeTypes: byField('id', object({
        id: value, name: value, values: byField('id', values('id', 'code', 'description', 'color')),
      })),
      customFieldDefs: byField('id', values('id', 'name', 'type')),
    }),
  },
  {
    pset: PSET.TaskTypes, property: PROP.TaskTypes.TaskTypes,
    shape: object({ definitions: byField('id', values('id', 'name', 'color')), taskTypeIds: keyed('sleutel', value) }),
  },
  {
    pset: PSET.Library, property: PROP.Library.pool,
    shape: object({
      companyId: value, companyName: value, poolVersion: value, modifiedAt: value, seedVersion: value,
      calendars: byField('id', passedOn), resources: byField('id', passedOn),
    }),
  },
  {
    pset: PSET.Baselines, property: PROP.Baselines.Baselines,
    shape: byField('id', object({
      id: value, sourceProjectId: value, name: value, createdAt: value, projectEnd: value, projectDuration: value,
      tasks: byField('taskId', values(
        'taskId', 'sourceTaskId', 'sourceTaskCode', 'start', 'finish', 'duration', 'isMilestone', 'milestoneKind',
      )),
    })),
  },
  { pset: PSET.Baselines, property: PROP.Baselines.TaskGuids, shape: keyed('sleutel', value) },
  { pset: PSET.Baselines, property: PROP.Baselines.ComparedBaselineIds, shape: value },
  {
    pset: PSET.SchedulingOptions, property: PROP.SchedulingOptions.SchedulingOptions,
    shape: object({
      ...Object.fromEntries(SCHEDULING_OPTION_KEYS.map(name => [name, value])),
      criticalDefinition: values('mode', 'threshold', 'thresholdHours'),
      floatPaths: values('enabled', 'method', 'maxPaths'),
      leveling: object({
        preserveScheduledDates: value, levelAllResources: value,
        priority: byField('field', values('field', 'direction')),
        resources: byField('resourceId', values('resourceId', 'maxUnitsPerHour')),
      }),
    }),
  },
  {
    pset: PSET.SchedulingProfile, property: PROP.SchedulingProfile.SchedulingProfile,
    shape: object({ id: value, baseId: value, name: value, conventions, overrides: conventions }),
  },
  { pset: PSET.Sequences, property: PROP.Sequences.P6StartAtPredecessorFinishBoundarySequenceGuids, shape: value },
  { pset: PSET.Sequences, property: DAY_MEASURE_LAGS_PROP, shape: keyed('sleutel', value) },
  { pset: PSET.Sequences, property: EXACT_MINUTE_LAGS_PROP, shape: keyed('sleutel', value) },
  { pset: PSET.Calendar, property: PROP.Calendar.LibraryOrigin, shape: libraryOrigin },
  { pset: PSET.Calendar, property: PROP.Calendar.WorkingExceptionKeysV1, shape: value },
  { pset: PSET.Calendar, property: PROP.Calendar.WorkingExceptionIds, shape: value },
  { pset: PSET.Calendar, property: PROP.Calendar.P6NonWorkPenaltyDates, shape: value },
  { pset: PSET.Resource, property: PROP.Resource.LibraryOrigin, shape: libraryOrigin },
  {
    pset: PSET.Timephased, property: PROP.Timephased.Windows,
    shape: keyed('toewijzing', values(
      'workWindowStart', 'workWindowFinish', 'curveValues', 'plannedWorkMinutes', 'actualWorkMinutes',
      'remainingWorkMinutes', 'plannedUnitsPerDay', 'costAmount',
    )),
  },
  {
    pset: PSET.DurationWalks, property: PROP.DurationWalks.DurationWalks,
    shape: byOrigin(values('anchor', 'resourceCalendarGuid', 'workMinutes')),
  },
  {
    pset: PSET.ExternalLink, property: PROP.ExternalLink.Links,
    shape: byField('id', object({
      id: value, direction: value, relType: value, lagDays: value, lagMinutes: value, anchorDate: value,
      sourceRef: values('projectId', 'projectName', 'taskId', 'taskName', 'filePath', 'siteFileId'),
      sourceMissing: value, sourceVersion: value, anchorReadAt: value,
    })),
  },
  { pset: PSET.TaskNotes, property: PROP.TaskNotes.Notes, shape: byField('id', values('id', 'text', 'done')) },
  { pset: PSET.Analysis, property: EXACT_FLOAT_PROP, shape: values(...EXACT_FLOAT_KEYS) },
  { pset: PSET.Splits, property: PROP.Splits.Splits, shape: byOrigin(values('afterMinutes', 'gapMinutes', 'source')) },
  {
    pset: PSET.Contours, property: PROP.Contours.Contours,
    shape: byOrigin(object({
      resourceUid: value, resourceId: value, periods: byOrigin(values('afterMinutes', 'minutes', 'workMinutes', 'kind')),
    })),
  },
  { pset: PSET.WorkRule, property: DAY_MEASURE_DURATIONS_PROP, shape: values(...DAY_MEASURE_DURATION_KEYS) },
  { pset: PSET.WorkRule, property: EXACT_MINUTES_PROP, shape: values(...EXACT_MINUTES_KEYS) },
];

const BY_NAME = new Map(JSON_PROPERTIES.map(p => [`${p.pset}\u0000${p.property}`, p.shape]));

export function jsonPropertyShape(pset: string, property: string): JsonShape | undefined {
  return BY_NAME.get(`${pset}\u0000${property}`);
}

export const JSON_PROPERTY_PSETS: ReadonlySet<string> = new Set(JSON_PROPERTIES.map(p => p.pset));
