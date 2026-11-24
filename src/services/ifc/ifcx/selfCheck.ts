import { ifcGuid128, ifcObjectSeed, type WriteIFCInput } from '../ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { savedCustomTaskTypes } from '@/services/taskTypes/customTaskTypeRules';
import { carriesValue } from './fieldTable';
import { stepGlobalIdsFor } from './stepGlobalIds';

type Model = Record<string, unknown>;
type Side = 'input' | 'reread';

export interface SelfCheckRule {
  readonly id: string;
  readonly keys: readonly string[];
  readonly reason: string;
  readonly normalize?: (model: Model, side: Side, input: WriteIFCInput) => void;
}

function dropKeys(keys: readonly string[]) {
  return (model: Model) => { for (const key of keys) delete model[key]; };
}

function expectedGlobalIds(input: WriteIFCInput): Record<string, string> {
  const globalIdOf = stepGlobalIdsFor(input);
  const out: Record<string, string> = {};
  const put = (kind: 'proj' | 'cal' | 'task' | 'seq', id: string) => { out[ifcObjectSeed(kind, id)] = globalIdOf(kind, id); };
  put('proj', input.project.id);
  put('cal', input.calendar.id);
  for (const calendar of input.resourceCalendars ?? []) put('cal', calendar.id);
  for (const task of input.tasks) put('task', task.id);
  for (const sequence of input.sequences) put('seq', sequence.id);
  for (const kind of ['wp', 'ws'] as const) {
    const seed = ifcObjectSeed(kind, input.project.id);
    const globalId = globalIdOf(kind, input.project.id);
    if (globalId !== ifcGuid128(seed)) out[seed] = globalId;
  }
  return out;
}

const READ_METADATA = [
  'timeModel', 'milestonesAtDayEnd', 'recordedFields', 'recordedTimes', 'recordedTimesOrigin', 'xerOrigin', 'xerArchiveIssue',
  'xerMissingPlannedStarts', 'p6xmlReport', 'msProjectReport', 'sourceScheduleNotes', 'suggestedProfileId', 'ifcLegacySchemaLoss',
  'baselineOrphanGuids',
] as const;

export const SELF_CHECK_RULES: readonly SelfCheckRule[] = [
  {
    id: 'leeg-is-afwezig', keys: ['*'],
    reason: 'Een lege lijst, een leeg object, null en een veld dat niet gezet is, betekenen hetzelfde: er is niets. De voorcontrole volgt dezelfde regel.',
  },
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
    reason: 'De lezer geeft elk object de GlobalId die de STEP-writer het zou geven; een bewaarde GlobalId van een object dat niet meer bestaat, schrijft STEP ook niet.',
    normalize: (model, side, input) => { if (side === 'input') model.ifcGlobalIds = expectedGlobalIds(input); },
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
      if (Array.isArray(ids) && ids.every(id => id === null)) delete model.comparedBaselineIds;
    },
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
  const text = JSON.stringify(comparable(value)) ?? String(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function differencesIn(left: unknown, right: unknown, path: string, emptyIsAbsent: boolean, out: string[], limit: number): void {
  if (out.length >= limit) return;
  const absent = (value: unknown) => value === undefined || (emptyIsAbsent && !carriesValue(comparable(value)));
  const a = comparable(left), b = comparable(right);
  if (absent(a) && absent(b)) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { out.push(`${path}: ${a.length} → ${b.length} items`); return; }
    for (let i = 0; i < a.length && out.length < limit; i++) differencesIn(a[i], b[i], `${path}[${i}]`, emptyIsAbsent, out, limit);
    return;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      differencesIn(a[key], b[key], path ? `${path}.${key}` : key, emptyIsAbsent, out, limit);
      if (out.length >= limit) return;
    }
    return;
  }
  if (a !== b) out.push(`${path}: ${describe(a)} → ${describe(b)}`);
}

function normalized(model: object, side: Side, input: WriteIFCInput, rules: readonly SelfCheckRule[]): Model {
  const copy: Model = { ...model };
  for (const rule of rules) rule.normalize?.(copy, side, input);
  return copy;
}

export function selfCheckDifferences(
  input: WriteIFCInput, reread: ImportResult, rules: readonly SelfCheckRule[] = SELF_CHECK_RULES, limit = 5,
): string[] {
  const out: string[] = [];
  differencesIn(normalized(input, 'input', input, rules), normalized(reread, 'reread', input, rules), '',
    rules.some(rule => rule.id === 'leeg-is-afwezig'), out, limit);
  return out;
}
