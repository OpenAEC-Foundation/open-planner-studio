import { PROP, PSET } from './ifcPsets';
import {
  DAY_MEASURE_DURATION_KEYS, DAY_MEASURE_DURATIONS_PROP, DAY_MEASURE_LAGS_PROP, EXACT_FLOAT_KEYS, EXACT_FLOAT_PROP,
  EXACT_MINUTE_LAGS_PROP, EXACT_MINUTES_KEYS, EXACT_MINUTES_PROP,
} from './dayMeasureIo';
import { SCHEDULING_OPTION_KEYS } from './schedulingOptionsRead';
import { CONVENTION_KEYS } from '@/engine/scheduler/conventions/registry';
import type { WriteIFCInput } from './ifcWriter';

export type JsonListIdentity = { readonly veld: string } | 'volgorde';
export type JsonMapIdentity = 'sleutel' | 'volgorde';

export type JsonShape =
  | { readonly soort: 'waarde' }
  | { readonly soort: 'reeks' }
  | { readonly soort: 'doorgegeven' }
  | { readonly soort: 'object'; readonly sleutels: Readonly<Record<string, JsonShape>> }
  | { readonly soort: 'lijst'; readonly identiteit: JsonListIdentity; readonly item: JsonShape }
  | { readonly soort: 'kaart'; readonly identiteit: JsonMapIdentity; readonly waarde: JsonShape };

export interface JsonDomainView {
  readonly input: WriteIFCInput;
  readonly owners: ReadonlyMap<string, unknown>;
}

export interface JsonDomain {
  readonly get: (d: JsonDomainView, owner: string) => unknown;
  readonly set?: (input: WriteIFCInput, values: ReadonlyMap<string, unknown>) => WriteIFCInput;
}

export interface JsonProperty {
  readonly pset: string;
  readonly property: string;
  readonly shape: JsonShape;
  readonly domain?: JsonDomain;
}

const value: JsonShape = { soort: 'waarde' };
const series: JsonShape = { soort: 'reeks' };
const passedOn: JsonShape = { soort: 'doorgegeven' };
const object = (sleutels: Readonly<Record<string, JsonShape>>): JsonShape => ({ soort: 'object', sleutels });
const each = (shape: JsonShape, names: readonly string[]) => Object.fromEntries(names.map(name => [name, shape]));
const values = (...names: readonly string[]): JsonShape => object(each(value, names));
const records = (...names: readonly string[]): JsonShape => object(each(series, names));
const byField = (veld: string, item: JsonShape): JsonShape => ({ soort: 'lijst', identiteit: { veld }, item });
const byPosition = (item: JsonShape): JsonShape => ({ soort: 'lijst', identiteit: 'volgorde', item });
const keyed = (identiteit: JsonMapIdentity, waarde: JsonShape): JsonShape => ({ soort: 'kaart', identiteit, waarde });

const libraryOrigin = values('companyId', 'libraryItemId', 'poolVersion', 'syncedHash');
const conventions = values(...CONVENTION_KEYS);

const ownerOf = <T>(d: JsonDomainView, owner: string, prefix: string) => owner.startsWith(prefix) ? d.owners.get(owner) as T | undefined : undefined;
const calendarKey = (input: WriteIFCInput, id: string) => id === input.calendar.id ? '_calendar' : `calendar_${id}`;
const onProject = (owner: string, get: (input: WriteIFCInput) => unknown) => (d: JsonDomainView, at: string) => at === owner ? get(d.input) : undefined;
const onTask = (field: 'notes' | 'externalLinks'): JsonDomain => ({
  get: (d, owner) => ownerOf<WriteIFCInput['tasks'][number]>(d, owner, 'task_')?.[field],
  set: (input, values) => ({ ...input, tasks: input.tasks.map(t => values.has(`task_${t.id}`) ? { ...t, [field]: values.get(`task_${t.id}`) } : t) }),
});

export const JSON_PROPERTIES: readonly JsonProperty[] = [
  {
    pset: PSET.StructureMeta, property: PROP.StructureMeta.structure,
    shape: object({
      activityCodeTypes: byField('id', object({
        id: value, name: value, values: byField('id', values('id', 'code', 'description', 'color')),
      })),
      customFieldDefs: byField('id', values('id', 'name', 'type')),
    }),
    domain: {
      get: onProject('_project', input => ({ activityCodeTypes: input.activityCodeTypes ?? [], customFieldDefs: input.customFieldDefs ?? [] })),
      set: (input, values) => {
        const v = values.get('_project') as Pick<WriteIFCInput, 'activityCodeTypes' | 'customFieldDefs'>;
        return { ...input, activityCodeTypes: v.activityCodeTypes, customFieldDefs: v.customFieldDefs };
      },
    },
  },
  {
    pset: PSET.TaskTypes, property: PROP.TaskTypes.TaskTypes,
    shape: object({ definitions: byField('id', values('id', 'name', 'color')), taskTypeIds: keyed('sleutel', value) }),
    domain: { get: onProject('_project', input => ({ definitions: input.customTaskTypes ?? [] })) },
  },
  {
    pset: PSET.Library, property: PROP.Library.pool,
    shape: object({
      companyId: value, companyName: value, poolVersion: value, modifiedAt: value, seedVersion: value,
      calendars: byField('id', passedOn), resources: byField('id', passedOn),
    }),
    domain: { get: onProject('_project', input => input.libraryPool) },
  },
  {
    pset: PSET.Baselines, property: PROP.Baselines.Baselines,
    shape: byField('id', object({
      id: value, sourceProjectId: value, name: value, createdAt: value, projectEnd: value, projectDuration: value,
      tasks: byField('taskId', values(
        'taskId', 'sourceTaskId', 'sourceTaskCode', 'start', 'finish', 'duration', 'isMilestone', 'milestoneKind',
      )),
    })),
    domain: {
      get: onProject('_worksched', input => input.baselines ?? []),
      set: (input, values) => ({ ...input, baselines: values.get('_worksched') as WriteIFCInput['baselines'] }),
    },
  },
  { pset: PSET.Baselines, property: PROP.Baselines.TaskGuids, shape: keyed('sleutel', value) },
  { pset: PSET.Baselines, property: PROP.Baselines.ComparedBaselineIds, shape: series },
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
    domain: { get: onProject('_worksched', input => input.project.schedulingOptions) },
  },
  {
    pset: PSET.SchedulingProfile, property: PROP.SchedulingProfile.SchedulingProfile,
    shape: object({ id: value, baseId: value, name: value, conventions, overrides: conventions }),
  },
  { pset: PSET.Sequences, property: PROP.Sequences.P6StartAtPredecessorFinishBoundarySequenceGuids, shape: series },
  { pset: PSET.Sequences, property: DAY_MEASURE_LAGS_PROP, shape: keyed('sleutel', series) },
  { pset: PSET.Sequences, property: EXACT_MINUTE_LAGS_PROP, shape: keyed('sleutel', series) },
  {
    pset: PSET.Calendar, property: PROP.Calendar.LibraryOrigin, shape: libraryOrigin,
    domain: {
      get: (d, owner) => (owner === '_calendar' || owner.startsWith('calendar_') ? d.owners.get(owner) as WriteIFCInput['calendar'] | undefined : undefined)?.libraryOrigin,
      set: (input, values) => {
        const put = <C extends { id: string }>(c: C) => values.has(calendarKey(input, c.id)) ? { ...c, libraryOrigin: values.get(calendarKey(input, c.id)) } : c;
        return { ...input, calendar: put(input.calendar), ...(input.resourceCalendars ? { resourceCalendars: input.resourceCalendars.map(put) } : {}) };
      },
    },
  },
  { pset: PSET.Calendar, property: PROP.Calendar.WorkingExceptionKeysV1, shape: series },
  { pset: PSET.Calendar, property: PROP.Calendar.WorkingExceptionIds, shape: series },
  { pset: PSET.Calendar, property: PROP.Calendar.P6NonWorkPenaltyDates, shape: series },
  {
    pset: PSET.Resource, property: PROP.Resource.LibraryOrigin, shape: libraryOrigin,
    domain: {
      get: (d, owner) => ownerOf<WriteIFCInput['resources'][number]>(d, owner, 'res_')?.libraryOrigin,
      set: (input, values) => ({ ...input, resources: input.resources.map(r => values.has(`res_${r.id}`)
        ? { ...r, libraryOrigin: values.get(`res_${r.id}`) as typeof r.libraryOrigin } : r) }),
    },
  },
  {
    pset: PSET.Timephased, property: PROP.Timephased.Windows,
    shape: keyed('volgorde', object({
      ...each(value, ['workWindowStart', 'workWindowFinish', 'plannedWorkMinutes', 'actualWorkMinutes', 'remainingWorkMinutes',
        'plannedUnitsPerDay', 'costAmount']),
      curveValues: series,
    })),
  },
  {
    pset: PSET.DurationWalks, property: PROP.DurationWalks.DurationWalks,
    shape: byPosition(values('anchor', 'resourceCalendarGuid', 'workMinutes')),
  },
  {
    pset: PSET.ExternalLink, property: PROP.ExternalLink.Links,
    shape: byField('id', object({
      id: value, direction: value, relType: value, lagDays: value, lagMinutes: value, anchorDate: value,
      sourceRef: values('projectId', 'projectName', 'taskId', 'taskName', 'filePath', 'siteFileId'),
      sourceMissing: value, sourceVersion: value, anchorReadAt: value,
    })),
    domain: onTask('externalLinks'),
  },
  { pset: PSET.TaskNotes, property: PROP.TaskNotes.Notes, shape: byField('id', values('id', 'text', 'done')), domain: onTask('notes') },
  { pset: PSET.Analysis, property: EXACT_FLOAT_PROP, shape: records(...EXACT_FLOAT_KEYS) },
  { pset: PSET.Splits, property: PROP.Splits.Splits, shape: byPosition(values('afterMinutes', 'gapMinutes', 'source')) },
  {
    pset: PSET.Contours, property: PROP.Contours.Contours,
    shape: byPosition(object({
      resourceUid: value, resourceId: value, periods: byPosition(values('afterMinutes', 'minutes', 'workMinutes', 'kind')),
    })),
  },
  { pset: PSET.WorkRule, property: DAY_MEASURE_DURATIONS_PROP, shape: records(...DAY_MEASURE_DURATION_KEYS) },
  { pset: PSET.WorkRule, property: EXACT_MINUTES_PROP, shape: records(...EXACT_MINUTES_KEYS) },
];

const BY_NAME = new Map(JSON_PROPERTIES.map(p => [`${p.pset}\u0000${p.property}`, p]));

export function jsonPropertyShape(pset: string, property: string): JsonShape | undefined {
  return BY_NAME.get(`${pset}\u0000${property}`)?.shape;
}

export function jsonPropertyDomain(pset: string, property: string): JsonDomain | undefined {
  return BY_NAME.get(`${pset}\u0000${property}`)?.domain;
}

export function membersHaveIdentity(shape: JsonShape): boolean {
  if (shape.soort === 'object') return Object.values(shape.sleutels).every(membersHaveIdentity);
  if (shape.soort === 'lijst') return shape.identiteit !== 'volgorde' && membersHaveIdentity(shape.item);
  if (shape.soort === 'kaart') return shape.identiteit !== 'volgorde' && membersHaveIdentity(shape.waarde);
  return true;
}

export const JSON_PROPERTY_PSETS: ReadonlySet<string> = new Set(JSON_PROPERTIES.map(p => p.pset));
