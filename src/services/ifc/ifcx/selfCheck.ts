import type { WriteIFCInput } from '../ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { savedCustomTaskTypes } from '@/services/taskTypes/customTaskTypeRules';
import { carriesValue } from './fieldTable';
import { intendedGlobalIds } from './identity';
import { CALENDAR_GROUPS, carriedKeys, DOCUMENT_GROUPS, SEQUENCE_GROUPS, TASK_GROUPS } from './fieldGroups';
import { CALENDAR_KEYS, PROJECT_KEYS, SEQUENCE_KEYS, TASK_KEYS, TASK_TIME_KEYS } from './domainKeys';

type Model = Record<string, unknown>;
type Side = 'input' | 'reread';

export interface SelfCheckRule {
  readonly id: string;
  readonly keys: readonly string[];
  readonly reason: string;
  readonly normalize: (model: Model, side: Side, input: WriteIFCInput) => void;
}

function dropKeys(keys: readonly string[]) {
  return (model: Model) => { for (const key of keys) delete model[key]; };
}

function knownNotCarried(known: ReadonlySet<string>, carried: ReadonlySet<PropertyKey>): string[] {
  return [...known].filter(key => !carried.has(key));
}

const PROJECT_NOT_CARRIED = knownNotCarried(PROJECT_KEYS, carriedKeys(DOCUMENT_GROUPS));
const CALENDAR_NOT_CARRIED = knownNotCarried(CALENDAR_KEYS, carriedKeys(CALENDAR_GROUPS));
const TASK_LISTS_THE_READER_GIVES = ['resourceIds'];
const TASK_NOT_CARRIED = knownNotCarried(TASK_KEYS, new Set([...carriedKeys(TASK_GROUPS), ...TASK_LISTS_THE_READER_GIVES]));
const TASK_TIME_NOT_CARRIED = knownNotCarried(TASK_TIME_KEYS, new Set(TASK_GROUPS.flatMap(group => group.carriesTime)));
const SEQUENCE_NOT_CARRIED = knownNotCarried(SEQUENCE_KEYS, carriedKeys(SEQUENCE_GROUPS));
const INPUT_NOT_CARRIED_NOR_READ = [
  'libraryPool', 'xerSourceArchive', 'xer', 'xerSourceProjectId', 'recordedSourceFormat', 'recoveryForeignSource',
  'withheldTaskTimeFields', 'ifcLiteralCalendarIds',
];

function withoutEmpty<T extends object>(object: T, keys: readonly string[]): T {
  const copy = { ...object } as Record<string, unknown>;
  for (const key of keys) if (key in copy && !carriesValue(copy[key])) delete copy[key];
  return copy as T;
}

function dropEmptyNotCarried(model: Model, side: Side): void {
  if (side !== 'input') return;
  const input = model as unknown as WriteIFCInput;
  for (const key of INPUT_NOT_CARRIED_NOR_READ) if (key in model && !carriesValue(model[key])) delete model[key];
  model.project = withoutEmpty(input.project, PROJECT_NOT_CARRIED);
  model.calendar = withoutEmpty(input.calendar, CALENDAR_NOT_CARRIED);
  if (input.resourceCalendars) model.resourceCalendars = input.resourceCalendars.map(calendar => withoutEmpty(calendar, CALENDAR_NOT_CARRIED));
  model.tasks = input.tasks.map(task => ({ ...withoutEmpty(task, TASK_NOT_CARRIED), time: withoutEmpty(task.time, TASK_TIME_NOT_CARRIED) }));
  model.sequences = input.sequences.map(sequence => withoutEmpty(sequence, SEQUENCE_NOT_CARRIED));
}

const READ_METADATA = [
  'timeModel', 'milestonesAtDayEnd', 'recordedFields', 'recordedTimes', 'recordedTimesOrigin', 'xerOrigin', 'xerArchiveIssue',
  'xerMissingPlannedStarts', 'p6xmlReport', 'msProjectReport', 'sourceScheduleNotes', 'suggestedProfileId', 'ifcLegacySchemaLoss',
  'baselineOrphanGuids', 'ifcxSharedDatesApplied',
] as const;

const LISTS_THE_READER_GIVES = ['activityCodeTypes', 'customFieldDefs', 'baselines', 'resources', 'assignments', 'resourceCalendars'] as const;

export const SELF_CHECK_RULES: readonly SelfCheckRule[] = [
  {
    id: 'schrijfroute', keys: ['writeMode'],
    reason: 'De keuze van de schrijfroute (samenvoegen of alleen de planning) is geen planningsgegeven; de STEP-writer leest haar ook niet.',
    normalize: dropKeys(['writeMode']),
  },
  {
    id: 'leesmeta', keys: READ_METADATA,
    reason: 'Wat een lezer bij openen meegeeft (de vastlegging van het bronbestand, het tijdmodel, meldingen): de STEP-writer leest het niet.',
    normalize: dropKeys(READ_METADATA),
  },
  {
    id: 'bronidentiteit', keys: ['ifcSource'],
    reason: 'De identiteit van een STEP-bron met een vreemd deel; de codec schrijft alleen de planning en de app kiest de route.',
    normalize: dropKeys(['ifcSource']),
  },
  {
    id: 'archiefopslag', keys: ['xerSourceArchiveStorage'],
    reason: 'Hoe een P6-bronarchief wordt opgeslagen; zonder archief (de voorcontrole weigert er een) heeft het geen effect.',
    normalize: dropKeys(['xerSourceArchiveStorage']),
  },
  {
    id: 'nee-is-afwezig', keys: ['minuteModelPending', 'importPristine'],
    reason: 'Onwaar betekent: geen openstaande omzetting en niet ongewijzigd sinds een import; de lezer zet de velden dan niet. Waar weigert de voorcontrole.',
    normalize: model => { for (const key of ['minuteModelPending', 'importPristine']) if (model[key] === false) delete model[key]; },
  },
  {
    id: 'globalids', keys: ['ifcGlobalIds'],
    reason: 'De invoer telt met de GlobalId die elk levend object houdt (bewaard, anders de standaard van de STEP-writer); een bewaarde GlobalId van een object dat niet meer bestaat, schrijft STEP ook niet. Een botsing weigert de writer vooraf.',
    normalize: (model, side, input) => { if (side === 'input') model.ifcGlobalIds = Object.fromEntries(intendedGlobalIds(input)); },
  },
  {
    id: 'gebruikte-taaktypes', keys: ['customTaskTypes'],
    reason: 'Alleen taaktypes die een taak gebruikt, worden opgeslagen, zoals in STEP; gebruikte weigert de voorcontrole nog.',
    normalize: (model, side, input) => { if (side === 'input') model.customTaskTypes = savedCustomTaskTypes(input.tasks, input.customTaskTypes ?? []); },
  },
  {
    id: 'geen-vergelijking', keys: ['comparedBaselineIds'],
    reason: '[null, null] betekent: geen baseline in de vergelijking, net als een ontbrekend veld.',
    normalize: model => {
      const ids = model.comparedBaselineIds;
      if (Array.isArray(ids) && ids.length === 2 && ids[0] === null && ids[1] === null) delete model.comparedBaselineIds;
    },
  },
  {
    id: 'lijsten-van-de-lezer', keys: [...LISTS_THE_READER_GIVES, 'activeBaselineId', ...TASK_LISTS_THE_READER_GIVES.map(key => `task.${key}`)],
    reason: 'De lezer geeft deze lijsten altijd, ook leeg, en activeBaselineId als null; ontbreken ze in de invoer, dan betekent dat hetzelfde. Met inhoud weigert de voorcontrole ze.',
    normalize: (model, side) => {
      if (side !== 'input') return;
      for (const key of LISTS_THE_READER_GIVES) if (model[key] === undefined) model[key] = [];
      if (model.activeBaselineId === undefined) model.activeBaselineId = null;
    },
  },
  {
    id: 'lege-velden-die-deze-versie-niet-draagt',
    keys: [...INPUT_NOT_CARRIED_NOR_READ, ...PROJECT_NOT_CARRIED.map(key => `project.${key}`), ...CALENDAR_NOT_CARRIED.map(key => `calendar.${key}`),
      ...TASK_NOT_CARRIED.map(key => `task.${key}`), ...TASK_TIME_NOT_CARRIED.map(key => `task.time.${key}`),
      ...SEQUENCE_NOT_CARRIED.map(key => `sequence.${key}`)],
    reason: 'Een bekend domeinveld dat deze versie nog niet draagt en leeg is (null, een lege lijst of een leeg object), betekent niets; met inhoud weigert de voorcontrole het. Een onbekend veld valt hier niet onder.',
    normalize: dropEmptyNotCarried,
  },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Set) && !(value instanceof Map);
}

function comparable(value: unknown): unknown {
  if (value instanceof Set) return [...value];
  if (value instanceof Map) return [...value];
  return value;
}

function describe(value: unknown): string {
  const text = value === undefined ? 'afwezig' : JSON.stringify(comparable(value)) ?? String(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function differencesIn(left: unknown, right: unknown, path: string, out: string[], limit: number): void {
  if (out.length >= limit) return;
  const a = comparable(left), b = comparable(right);
  if (a === undefined && b === undefined) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { out.push(`${path}: ${a.length} → ${b.length} items`); return; }
    for (let i = 0; i < a.length && out.length < limit; i++) differencesIn(a[i], b[i], `${path}[${i}]`, out, limit);
    return;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      differencesIn(a[key], b[key], path ? `${path}.${key}` : key, out, limit);
      if (out.length >= limit) return;
    }
    return;
  }
  if (!Object.is(a, b) && !(a === 0 && b === 0)) out.push(`${path}: ${describe(a)} → ${describe(b)}`);
}

function normalized(model: object, side: Side, input: WriteIFCInput, rules: readonly SelfCheckRule[]): Model {
  const copy: Model = { ...model };
  for (const rule of rules) rule.normalize(copy, side, input);
  return copy;
}

export function selfCheckDifferences(
  input: WriteIFCInput, reread: ImportResult, rules: readonly SelfCheckRule[] = SELF_CHECK_RULES, limit = 5,
): string[] {
  const out: string[] = [];
  differencesIn(normalized(input, 'input', input, rules), normalized(reread, 'reread', input, rules), '', out, limit);
  return out;
}
