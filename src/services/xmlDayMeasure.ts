/**
 * De maat van duur, rest en lag in MSPDI en P6 XML (alleen uren §3.3, §3.10; T13, T21; F5a-2).
 *
 * Het standaardveld van het formaat (MSPDI `Duration`/`RemainingDuration`/`LinkLag`, P6 XML
 * `PlannedDuration`/`RemainingDuration`/`Lag`) draagt altijd de lengte, op de hele minuut. Een dagenmaat-
 * hoeveelheid telt daarin als werkdagen × de werktijd per dag (T13, "1 d = echte werktijd per dag",
 * eigenaarsbesluit 2026-10-15); een lag in de werktijd per dag van de lagkalender (I7).
 *
 * Daarnaast schrijft OPS maatinformatie in eigen tekstvelden (MSPDI-`ExtendedAttribute`, P6-UDF), in de
 * vorm die F3c voor IFC koos (`dayMeasureIo.ts`): een RECORD `[waarde, geschreven minuten]` per
 * standaardveld. De lezer gebruikt de waarde alleen als het standaardveld nog precies die minuten draagt
 * (op de hele minuut). Anders heeft een ander programma de lengte gewijzigd en geldt het standaardveld.
 *  - Taak, dagenmaat met een breuk (`OPS_DayMeasureDurations`): `[dagen, minuten]`. Hele dagen krijgen geen
 *    record; de lezer deelt dan de minuten door de werktijd per dag (§3.10).
 *  - Taak, urenmaat met een breuk in minuten (`OPS_ExactMinutes`, T14): `[exacte minuten, minuten]`.
 *  - Lag (`OPS_DayMeasureLags`, één veld op de opvolger): sleutel = voorganger plus relatietype (`12:SS`),
 *    waarde `[dagen, minuten]` voor ELKE lag in de dagenmaat, ook hele dagen: de relatie heeft geen eigen
 *    eenheidsmarkering, dus zonder record is elke lag urenmaat (T15). P6 XML kent geen lageenheid per
 *    relatie; daar draagt het record ook de kalendertijd: `[dagen, minuten, "ed"]` of
 *    `[minuten, minuten, "eu"]`. MSPDI zegt kalendertijd zelf met `LagFormat` (8 = ed, 6 = eu).
 *
 * De definitie van `OPS_DayMeasureDurations` schrijft OPS altijd, ook zonder records. De lezer herkent
 * daaraan een bestand dat de dagenmaat in de werktijd per dag schreef (T13). Een ouder OPS-bestand
 * schreef dagen × de opgeslagen uren per dag; dat leest hij zoals voorheen.
 */
import type { Task } from '@/types/task';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import { effHoursPerDay, hourTaskScheduleDuration } from '@/utils/taskDuration';
import {
  ELAPSED_MINUTES_PER_DAY, dayMeasureMinutes, exactMinutesRecord, isWholeDays, parseDayMeasureRecord, roundDays,
  type DayMeasureRecord, type ExactMinutesRecord,
} from '@/services/ifc/dayMeasureIo';

/** Namen van de OPS-velden (MSPDI `FieldName`/`Alias`, P6 UDF-`Title`). Eén plek voor beide formaten. */
export const OPS_DAY_MEASURE_DURATIONS_NAME = 'OPS_DayMeasureDurations';
export const OPS_EXACT_MINUTES_NAME = 'OPS_ExactMinutes';
export const OPS_DAY_MEASURE_LAGS_NAME = 'OPS_DayMeasureLags';

/** De twee duurvelden van een taak, op hun naam in het formaat. */
export interface DurationFieldNames { duration: string; remaining: string }

/** Records per duurveld, op de naam van het veld in het formaat. */
export type FieldRecords = Record<string, DayMeasureRecord>;

// ── Schrijven ─────────────────────────────────────────────────────────────────────────────────────

/** Een geschreven hoeveelheid: de minuten van het standaardveld, en het record als dat nodig is. */
export interface WrittenAmount { minutes: number; record?: DayMeasureRecord }

/** Dagen ⇒ de minuten van het standaardveld (dagen × minuten per dag, op de hele minuut), plus het record
 *  `[dagen, minuten]` bij een breuk (T21). Hele dagen: geen record. */
export function writeDays(days: number, minutesPerDay: number): WrittenAmount {
  const minutes = dayMeasureMinutes(days, minutesPerDay);
  return isWholeDays(days) ? { minutes } : { minutes, record: [roundDays(days), minutes] };
}

/** Urenmaat ⇒ de minuten van het standaardveld (op de hele minuut), plus het `ExactMinutes`-record bij een
 *  breuk in minuten (T14). */
export function writeMinutes(minutes: number): WrittenAmount {
  const record = exactMinutesRecord(minutes);
  return record ? { minutes: record[1], record } : { minutes: Math.round(minutes) };
}

/**
 * De minuten per dag voor de dagenmaat van een taak (T13): de werktijd per dag van haar kalender.
 * `elapsed`: een kalendertijd-taak telt 1440 minuten per dag. Alleen MSPDI kent kalendertijd per taak;
 * P6 XML schrijft een kalendertijd-taak als werktijd en geeft hier `false`.
 */
export function dayMeasureMinutesPerDay(calendar: WorkCalendar, elapsed: boolean): number {
  return elapsed ? ELAPSED_MINUTES_PER_DAY : effHoursPerDay(calendar) * 60;
}

/**
 * Minuten per lagdag in de werktijd van de lagkalender (`schedulingOptions.lagCalendar`, I7): standaard de
 * voorganger, of de opvolger, de projectkalender of 24 uur. Zoals de motor (`relDeps.lagEngine`) en de
 * IFC-writer (`lagMinutesPerDay`). Een lag in kalendertijd telt de aanroeper zelf.
 */
export function lagWorkMinutesPerDay(
  seq: Pick<Sequence, 'predecessorId' | 'successorId'>,
  lagCalendar: NonNullable<Project['schedulingOptions']>['lagCalendar'],
  projectCalendar: WorkCalendar,
  effCalByTask: ReadonlyMap<string, WorkCalendar>,
): number {
  if (lagCalendar === '24hour') return ELAPSED_MINUTES_PER_DAY;
  const cal = lagCalendar === 'projectDefault' ? projectCalendar
    : lagCalendar === 'successor' ? effCalByTask.get(seq.successorId) ?? projectCalendar
    : effCalByTask.get(seq.predecessorId) ?? projectCalendar;
  return effHoursPerDay(cal) * 60;
}

/** Een record van een lag: `[dagen, minuten]` (dagenmaat), of in P6 XML ook kalendertijd. */
export type LagRecord = readonly [value: number, minutes: number] | readonly [value: number, minutes: number, unit: 'ed' | 'eu'];

const LINK_TYPE_TOKEN: Record<SequenceType, string> = {
  FINISH_START: 'FS', START_START: 'SS', FINISH_FINISH: 'FF', START_FINISH: 'SF',
};

/** De sleutel van een lagrecord: voorganger plus relatietype (`12:SS`). De store staat tussen hetzelfde
 *  takenpaar één relatie per type toe (`relationAddVerdict`), dus de sleutel is per opvolger uniek. */
export function lagRecordKey(predecessor: string | number, type: SequenceType): string {
  return `${predecessor}:${LINK_TYPE_TOKEN[type]}`;
}

/**
 * Verzamelt de lagrecords per opvolger. Een sleutel die bij één opvolger twee keer voorkomt, is dubbelzinnig;
 * die valt weg (geen record, dus urenmaat bij het lezen, met de juiste lengte).
 */
export class LagRecordCollector {
  private readonly bySuccessor = new Map<string, Map<string, LagRecord | null>>();

  add(successorId: string, key: string, record: LagRecord | undefined): void {
    let map = this.bySuccessor.get(successorId);
    if (!map) {
      map = new Map();
      this.bySuccessor.set(successorId, map);
    }
    // Ook een relatie zonder record telt mee voor de uniciteit van de sleutel.
    map.set(key, map.has(key) ? null : record ?? null);
  }

  /** De JSON-tekst voor het veld van deze opvolger, of `undefined` zonder records. */
  json(successorId: string): string | undefined {
    const entries = [...(this.bySuccessor.get(successorId) ?? [])].filter((e): e is [string, LagRecord] => e[1] !== null);
    return entries.length > 0 ? JSON.stringify(Object.fromEntries(entries)) : undefined;
  }
}

/** De JSON-tekst voor de duurrecords van een taak, of `undefined` zonder records. */
export function fieldRecordsJson(records: Partial<FieldRecords>): string | undefined {
  const entries = Object.entries(records).filter((e): e is [string, DayMeasureRecord] => e[1] !== undefined);
  return entries.length > 0 ? JSON.stringify(Object.fromEntries(entries)) : undefined;
}

// ── Lezen ─────────────────────────────────────────────────────────────────────────────────────────

function parseJsonObject(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

/** Duurrecords lezen (`[getal, hele minuten]` per veldnaam). Corrupte JSON of een ongeldig record blijft
 *  inert, zoals een bestand zonder record. */
export function parseFieldRecords(raw: string | undefined, names: DurationFieldNames): { duration?: DayMeasureRecord; remaining?: DayMeasureRecord } {
  const obj = parseJsonObject(raw);
  if (!obj) return {};
  const duration = parseDayMeasureRecord(obj[names.duration]);
  const remaining = parseDayMeasureRecord(obj[names.remaining]);
  return { ...(duration ? { duration } : {}), ...(remaining ? { remaining } : {}) };
}

/** Lagrecords lezen: sleutel → record. Een ongeldig record valt weg. */
export function parseLagRecords(raw: string | undefined): Map<string, LagRecord> {
  const out = new Map<string, LagRecord>();
  const obj = parseJsonObject(raw);
  if (!obj) return out;
  for (const [key, value] of Object.entries(obj)) {
    if (!key || !Array.isArray(value)) continue;
    const base = parseDayMeasureRecord(value.slice(0, 2));
    if (!base) continue;
    if (value.length === 2) out.set(key, base);
    else if (value.length === 3 && (value[2] === 'ed' || value[2] === 'eu')) out.set(key, [base[0], base[1], value[2]]);
  }
  return out;
}

/** De leesregel van T21: het record telt alleen als het standaardveld nog de geschreven minuten draagt (op
 *  de hele minuut). */
export function recordHolds<R extends readonly [number, number, ...unknown[]]>(record: R | undefined, standardMinutes: number | null | undefined): record is R {
  return record !== undefined && standardMinutes != null && Number.isFinite(standardMinutes)
    && Math.round(standardMinutes) === record[1];
}

/** De gelezen maat van een taak: de velden van `TaskTime` die de duur en de rest dragen. */
export interface ReadMeasure {
  durationUnit: 'days' | 'hours';
  scheduleDuration: number;
  durationMinutes?: number;
  remainingTime?: number;
  remainingMinutes?: number;
}

/**
 * Duur en rest van één taak uit de standaardvelden en de records (§3.10, T21, T14).
 *  - Urenmaat (OPS-markering `hours`, of geen markering: T15): de minuten. Een `ExactMinutes`-record geeft de
 *    exacte minuten terug zolang het standaardveld de geschreven minuten draagt.
 *  - Dagenmaat (OPS-markering `days`): met een duurrecord de exacte dagen, zolang de duur nog de geschreven
 *    minuten draagt; bij een andere duur de urenmaat (de rest dan in minuten). Zonder record: minuten ÷
 *    minuten per dag. De rest volgt dezelfde regel, maar blijft in de dagenmaat (zoals de IFC-lezer).
 * De minuten mogen een breuk zijn: de urenmaat rondt ze af op de hele minuut, de leesregel ook.
 * `durationDays`/`remainingDays`: de dagen van het standaardveld zonder geldig record, als de lezer die zelf
 * uitrekent (MSPDI `P5D`, P6 uren ÷ uren per dag); anders minuten ÷ minuten per dag.
 */
export function readMeasure(input: {
  unit: 'days' | 'hours';
  durationMinutes: number;
  durationDays?: number;
  remainingMinutes: number | undefined;
  remainingDays?: number;
  minutesPerDay: number;
  calendar: WorkCalendar;
  dayRecords: { duration?: DayMeasureRecord; remaining?: DayMeasureRecord };
  exactRecords: { duration?: ExactMinutesRecord; remaining?: ExactMinutesRecord };
}): ReadMeasure {
  const { durationMinutes, remainingMinutes, minutesPerDay, calendar } = input;
  const perDay = (minutes: number) => (minutesPerDay > 0 ? minutes / minutesPerDay : 0);
  const hours = (): ReadMeasure => {
    const exact = recordHolds(input.exactRecords.duration, durationMinutes) ? input.exactRecords.duration[0] : Math.round(durationMinutes);
    const rest = remainingMinutes === undefined ? undefined
      : recordHolds(input.exactRecords.remaining, remainingMinutes) ? input.exactRecords.remaining[0] : Math.round(remainingMinutes);
    return {
      durationUnit: 'hours', durationMinutes: exact, scheduleDuration: hourTaskScheduleDuration(exact, calendar),
      ...(rest !== undefined ? { remainingMinutes: rest } : {}),
    };
  };
  if (input.unit === 'hours') return hours();
  const durationRecord = input.dayRecords.duration;
  if (durationRecord && !recordHolds(durationRecord, durationMinutes)) {
    // Een ander programma wijzigde de duur: de urenmaat met de minuten uit het bestand (T21). Een
    // `ExactMinutes`-record hoort niet bij een dagenmaat-taak en telt niet.
    const minutes = Math.round(durationMinutes);
    return {
      durationUnit: 'hours', durationMinutes: minutes, scheduleDuration: hourTaskScheduleDuration(minutes, calendar),
      ...(remainingMinutes !== undefined ? { remainingMinutes: Math.round(remainingMinutes) } : {}),
    };
  }
  const days = durationRecord ? durationRecord[0] : input.durationDays ?? perDay(durationMinutes);
  const restRecord = input.dayRecords.remaining;
  const remainingTime = remainingMinutes === undefined ? undefined
    : recordHolds(restRecord, remainingMinutes) ? restRecord[0] : input.remainingDays ?? perDay(remainingMinutes);
  return { durationUnit: 'days', scheduleDuration: days, ...(remainingTime !== undefined ? { remainingTime } : {}) };
}

/** De gelezen lag uit een geldig record (de leesregel is al getoetst): de velden van `Sequence`. */
export function lagFromRecord(record: LagRecord): Pick<Sequence, 'lagDays' | 'lagMinutes' | 'lagUnit'> {
  if (record.length === 3 && record[2] === 'eu') return { lagDays: 0, lagMinutes: record[0], lagUnit: 'ELAPSEDTIME' };
  if (record.length === 3 && record[2] === 'ed') return { lagDays: record[0], lagUnit: 'ELAPSEDTIME' };
  return { lagDays: record[0] };
}

/**
 * Voortgangsnormalisatie zonder verlies van de rest van een dagenmaat-taak (B3: rest exact). De gedeelde
 * normalisatie (`normalizeImportedProgress` → `applyRemainingDuration`) leidt de rest van een lopende dagtaak
 * af uit het percentage. MSPDI bewaart dat percentage als heel getal: 3 d met 1 d rest werd 67 % en dus
 * 0,99 d. Voor een urentaak blijven de vastgelegde restminuten al staan; dit doet hetzelfde voor de
 * vastgelegde rest van een taak in de dagenmaat (alleen een OPS-bestand draagt de dagenmaat-markering).
 * Een voltooide taak houdt rest 0.
 */
export function normalizeKeepingDayRest(tasks: Task[], normalize: () => void): void {
  const recorded = new Map<string, number>();
  for (const task of tasks) {
    const rest = task.time.remainingTime;
    if (task.time.durationUnit === 'days' && rest != null && Number.isFinite(rest)) recorded.set(task.id, rest);
  }
  normalize();
  for (const task of tasks) {
    const rest = recorded.get(task.id);
    if (rest !== undefined && task.status === 'STARTED' && task.time.completion < 1) task.time.remainingTime = rest;
  }
}
