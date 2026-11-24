import type { ImportResult } from '@/services/importTypes';

type Model = Record<string, unknown>;

export interface SelfCheckRule {
  readonly id: string;
  readonly keys: readonly string[];
  readonly reason: string;
  readonly normalize: (model: Model) => void;
}

function dropKeys(keys: readonly string[]) {
  return (model: Model) => { for (const key of keys) delete model[key]; };
}

const READ_METADATA = [
  'timeModel', 'milestonesAtDayEnd', 'recordedFields', 'recordedTimes', 'recordedTimesOrigin', 'xerOrigin', 'xerArchiveIssue',
  'xerMissingPlannedStarts', 'p6xmlReport', 'msProjectReport', 'sourceScheduleNotes', 'suggestedProfileId', 'ifcLegacySchemaLoss',
  'baselineOrphanGuids', 'ifcLiteralCalendarIds',
] as const;

export const SELF_CHECK_RULES: readonly SelfCheckRule[] = [
  {
    id: 'leesmeta', keys: READ_METADATA,
    reason: 'Wat een lezer bij openen meegeeft over het bestand dat hij las (de vastlegging van het bronbestand, het tijdmodel, meldingen, welke kalenders STEP letterlijk schreef): geen planningsgegeven, en elke lezer geeft het over zijn eigen bestand.',
    normalize: dropKeys(READ_METADATA),
  },
  {
    id: 'nee-is-afwezig', keys: ['minuteModelPending', 'importPristine'],
    reason: 'Onwaar betekent: geen openstaande omzetting en niet ongewijzigd sinds een import. De STEP-lezer zet de velden dan op onwaar, de IFCX-lezer laat ze weg.',
    normalize: model => { for (const key of ['minuteModelPending', 'importPristine']) if (model[key] === false) delete model[key]; },
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

function normalized(model: object, rules: readonly SelfCheckRule[]): Model {
  const copy: Model = { ...model };
  for (const rule of rules) rule.normalize(copy);
  return copy;
}

export function selfCheckDifferences(
  planning: ImportResult, reread: ImportResult, rules: readonly SelfCheckRule[] = SELF_CHECK_RULES, limit = 5,
): string[] {
  const out: string[] = [];
  differencesIn(normalized(planning, rules), normalized(reread, rules), '', out, limit);
  return out;
}
