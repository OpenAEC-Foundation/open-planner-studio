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
 * standaardveld. De lezer gebruikt de waarde alleen als twee dingen gelden (leesregel, `recordHolds` en
 * `dayRecordFits`):
 *  1. het standaardveld draagt nog precies die minuten (op de hele minuut). Anders heeft een ander programma
 *     de lengte gewijzigd;
 *  2. de waarde geeft met de huidige context nog die minuten: dagen × de minuten per dag van de huidige
 *     kalender en het huidige duurtype (taak), of van de lagkalender (lag). Anders koos een ander programma
 *     een andere kalender, of ontbreekt de lagkalender (review #585 r1, punt 1 en 2).
 * Geldt een van beide niet, dan geldt het standaardveld, in de urenmaat: de lengte blijft precies staan.
 *  - Taak, dagenmaat met een breuk (`OPS_DayMeasureDurations`): `[dagen, minuten]`. Hele dagen krijgen geen
 *    record; de lezer deelt dan de minuten door de werktijd per dag (§3.10).
 *  - Taak, urenmaat met een breuk in minuten (`OPS_ExactMinutes`, T14): `[exacte minuten, minuten]`.
 *  - Lag (`OPS_DayMeasureLags`, één veld op de opvolger): sleutel = voorganger plus relatietype (`12:SS`),
 *    waarde `[dagen, minuten]` voor ELKE lag in de dagenmaat, ook hele dagen: de relatie heeft geen eigen
 *    eenheidsmarkering, dus zonder record is elke lag urenmaat (T15).
 *  - Kalendertijd in P6 XML. P6 kent geen kalendertijd per relatie of per activiteit; het standaardveld telt
 *    daar in werktijd. Het record draagt dan ook de eenheid, altijd (ook bij hele dagen): `[dagen, minuten,
 *    "ed"]` of `[minuten, minuten, "eu"]`, voor een lag en voor de duur en rest van een taak (review #585 r1,
 *    punt 3). MSPDI zegt kalendertijd zelf: `LagFormat` 8 (ed) of 6 (eu), en `DurationFormat` bij een taak.
 *  - De lagkalender (`schedulingOptions.lagCalendar`, I7) staat in `OPS_LagCalendar`: MSPDI op de
 *    projectsamenvattingstaak (UID 0), P6 XML als project-UDF. Zonder dat veld rekent de lezer met de
 *    standaard, de voorganger.
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
  ELAPSED_MINUTES_PER_DAY, dayMeasureMinutes, dayMeasureRecord, exactMinutesRecord, isWholeDays, parseDayMeasureRecord, roundDays,
} from '@/services/ifc/dayMeasureIo';

/** Namen van de OPS-velden (MSPDI `FieldName`/`Alias`, P6 UDF-`Title`). Eén plek voor beide formaten. */
export const OPS_DAY_MEASURE_DURATIONS_NAME = 'OPS_DayMeasureDurations';
export const OPS_EXACT_MINUTES_NAME = 'OPS_ExactMinutes';
export const OPS_DAY_MEASURE_LAGS_NAME = 'OPS_DayMeasureLags';
export const OPS_LAG_CALENDAR_NAME = 'OPS_LagCalendar';

/** De lagkalender van het project (`schedulingOptions.lagCalendar`). */
export type LagCalendarOption = NonNullable<NonNullable<Project['schedulingOptions']>['lagCalendar']>;
const LAG_CALENDAR_OPTIONS: readonly LagCalendarOption[] = ['predecessor', 'successor', 'projectDefault', '24hour'];

/** De lagkalender uit het veld `OPS_LagCalendar`; een onbekende waarde telt als afwezig. */
export function parseLagCalendarOption(raw: string | undefined): LagCalendarOption | undefined {
  const value = raw?.trim();
  return LAG_CALENDAR_OPTIONS.find(option => option === value);
}

/** De twee duurvelden van een taak, op hun naam in het formaat. */
export interface DurationFieldNames { duration: string; remaining: string }

/** Eenheid van kalendertijd in een record (P6 XML): kalenderdagen of kalenderminuten. */
export type ElapsedUnit = 'ed' | 'eu';

/** Een record: `[waarde, geschreven minuten]`, in P6 XML voor kalendertijd met de eenheid erbij. */
export type FieldRecord = readonly [value: number, minutes: number] | readonly [value: number, minutes: number, unit: ElapsedUnit];

/** Records per duurveld, op de naam van het veld in het formaat. */
export type FieldRecords = Record<string, FieldRecord>;

// ── Schrijven ─────────────────────────────────────────────────────────────────────────────────────

/** Een geschreven hoeveelheid: de minuten van het standaardveld, en het record als dat nodig is. */
export interface WrittenAmount { minutes: number; record?: FieldRecord }

/** Dagen ⇒ de minuten van het standaardveld (dagen × minuten per dag, op de hele minuut), plus het record
 *  `[dagen, minuten]` bij een breuk (T21). Hele dagen: geen record. De minuten komen uit de bron; de dagen
 *  van het record verklaren precies die minuten (`recordDayValue`, aanval a06 na #600). */
export function writeDays(days: number, minutesPerDay: number): WrittenAmount {
  const record = dayMeasureRecord(days, minutesPerDay);
  return isWholeDays(days) ? { minutes: record[1] } : { minutes: record[1], record };
}

/** Urenmaat ⇒ de minuten van het standaardveld (op de hele minuut), plus het `ExactMinutes`-record bij een
 *  breuk in minuten (T14). */
export function writeMinutes(minutes: number): WrittenAmount {
  const record = exactMinutesRecord(minutes);
  return record ? { minutes: record[1], record } : { minutes: Math.round(minutes) };
}

/** P6 XML: een hoeveelheid in kalendertijd krijgt altijd een record met de eenheid (ook bij hele dagen of
 *  minuten), want het standaardveld telt in P6 als werktijd. `value`: de dagen (`ed`) of de minuten (`eu`). */
export function withElapsedUnit(written: WrittenAmount, value: number, unit: ElapsedUnit): WrittenAmount {
  // `ed`: dezelfde dagen als het record van `writeDays` (die verklaren de minuten); hele dagen op 6 decimalen.
  const days = written.record?.[0] ?? roundDays(value);
  return { minutes: written.minutes, record: [unit === 'ed' ? days : value, written.minutes, unit] };
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
export type LagRecord = FieldRecord;

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
  const entries = Object.entries(records).filter((e): e is [string, FieldRecord] => e[1] !== undefined);
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

/** Eén record lezen: `[getal, hele minuten]`, eventueel met een kalendertijd-eenheid. Anders `undefined`. */
function parseFieldRecord(value: unknown): FieldRecord | undefined {
  if (!Array.isArray(value)) return undefined;
  const base = parseDayMeasureRecord(value.slice(0, 2));
  if (!base || value.length < 2) return undefined;
  if (value.length === 2) return base;
  return value.length === 3 && (value[2] === 'ed' || value[2] === 'eu') ? [base[0], base[1], value[2]] : undefined;
}

/** Duurrecords lezen (`[getal, hele minuten]` per veldnaam). Corrupte JSON of een ongeldig record blijft
 *  inert, zoals een bestand zonder record. */
export function parseFieldRecords(raw: string | undefined, names: DurationFieldNames): { duration?: FieldRecord; remaining?: FieldRecord } {
  const obj = parseJsonObject(raw);
  if (!obj) return {};
  const duration = parseFieldRecord(obj[names.duration]);
  const remaining = parseFieldRecord(obj[names.remaining]);
  return { ...(duration ? { duration } : {}), ...(remaining ? { remaining } : {}) };
}

/** Lagrecords lezen: sleutel → record. Een ongeldig record valt weg. */
export function parseLagRecords(raw: string | undefined): Map<string, LagRecord> {
  const out = new Map<string, LagRecord>();
  const obj = parseJsonObject(raw);
  if (!obj) return out;
  for (const [key, value] of Object.entries(obj)) {
    const record = key ? parseFieldRecord(value) : undefined;
    if (record) out.set(key, record);
  }
  return out;
}

/** Leesregel, deel 1 (T21): het record telt alleen als het standaardveld nog de geschreven minuten draagt (op
 *  de hele minuut). */
export function recordHolds<R extends readonly [number, number, ...unknown[]]>(record: R | undefined, standardMinutes: number | null | undefined): record is R {
  return record !== undefined && standardMinutes != null && Number.isFinite(standardMinutes)
    && Math.round(standardMinutes) === record[1];
}

const isElapsedUnit = (record: FieldRecord | undefined, unit: ElapsedUnit): boolean =>
  record !== undefined && record.length === 3 && record[2] === unit;

/**
 * Leesregel, deel 2 (review #585 r1): de waarde van het record geeft met de huidige context nog de geschreven
 * minuten. Een record in dagen (dagenmaat of `ed`): dagen × `minutesPerDay` op de hele minuut, zoals de writer
 * (`dayMeasureMinutes`). `minutesPerDay` is wat de lezer nu rekent: de huidige kalender en het huidige
 * duurtype van de taak, of de lagkalender van de relatie. Een record in minuten (`ExactMinutes`, `eu`) hangt
 * niet van een kalender af.
 */
export function dayRecordFits(record: FieldRecord, minutesPerDay: number): boolean {
  if (isElapsedUnit(record, 'eu')) return minuteRecordFits(record);
  return minutesPerDay > 0 && dayMeasureMinutes(record[0], minutesPerDay) === record[1];
}

/** Leesregel, deel 2, voor een record in minuten (`ExactMinutes`, `eu`): de waarde geeft op de hele minuut de
 *  geschreven minuten. */
export function minuteRecordFits(record: FieldRecord): boolean {
  return Math.round(record[0]) === record[1];
}

/** De hele leesregel voor een lagrecord: het standaardveld én de lagkalender. */
export function lagRecordHolds(record: LagRecord | undefined, standardMinutes: number, lagMinutesPerDay: number): record is LagRecord {
  return recordHolds(record, standardMinutes) && dayRecordFits(record, lagMinutesPerDay);
}

/** De gelezen maat van een taak: de velden van `TaskTime` die de duur en de rest dragen. `durationType` alleen
 *  als een geldig record kalendertijd zegt (P6 XML, `ed`/`eu`); anders beslist de lezer zelf. */
export interface ReadMeasure {
  durationUnit: 'days' | 'hours';
  scheduleDuration: number;
  durationMinutes?: number;
  remainingTime?: number;
  remainingMinutes?: number;
  durationType?: 'ELAPSEDTIME';
}

/**
 * Duur en rest van één taak uit de standaardvelden en de records (§3.10, T21, T14). De leesregel staat
 * hier één keer, voor beide formaten (`recordHolds` en `dayRecordFits`, zie de kop van dit bestand).
 *  - Urenmaat (OPS-markering `hours`, of geen markering: T15): de minuten. Een `ExactMinutes`-record geeft de
 *    exacte minuten terug zolang het standaardveld de geschreven minuten draagt; met de eenheid `eu` ook de
 *    kalendertijd.
 *  - Dagenmaat (OPS-markering `days`): met een duurrecord de exacte dagen. Draagt de duur niet meer de
 *    geschreven minuten, of past een duur- of restrecord niet meer bij `minutesPerDay` (een andere kalender
 *    of een ander duurtype), dan de urenmaat: duur én rest in de minuten uit het bestand. Zonder record:
 *    minuten ÷ minuten per dag. Een restrecord dat alleen niet meer bij de rest past (een ander programma
 *    wijzigde de rest), geeft de rest in de dagenmaat uit het standaardveld (zoals de IFC-lezer). Een
 *    duurrecord met de eenheid `ed` geeft ook de kalendertijd.
 * `minutesPerDay`: de minuten per dag die de lezer nu rekent (de huidige kalender en het huidige duurtype).
 * De minuten mogen een breuk zijn: de urenmaat rondt ze af op de hele minuut, de leesregel ook.
 * `durationDays`/`remainingDays`: de dagen van het standaardveld zonder geldig record, als het formaat ze zelf
 * draagt (MSPDI `P5D`); anders minuten ÷ minuten per dag (ook P6 XML, knownbug 293).
 */
export function readMeasure(input: {
  unit: 'days' | 'hours';
  durationMinutes: number;
  durationDays?: number;
  remainingMinutes: number | undefined;
  remainingDays?: number;
  minutesPerDay: number;
  calendar: WorkCalendar;
  dayRecords: { duration?: FieldRecord; remaining?: FieldRecord };
  exactRecords: { duration?: FieldRecord; remaining?: FieldRecord };
}): ReadMeasure {
  const { durationMinutes, remainingMinutes, minutesPerDay, calendar } = input;
  const perDay = (minutes: number) => (minutesPerDay > 0 ? minutes / minutesPerDay : 0);
  /** De urenmaat: de minuten uit het bestand, of de exacte minuten uit een geldig `ExactMinutes`-record. */
  const hours = (exact: { duration?: FieldRecord; remaining?: FieldRecord }): ReadMeasure => {
    const durationRecord = exact.duration;
    const durationHolds = recordHolds(durationRecord, durationMinutes) && minuteRecordFits(durationRecord);
    const minutes = durationHolds ? durationRecord[0] : Math.round(durationMinutes);
    const restRecord = exact.remaining;
    const rest = remainingMinutes === undefined ? undefined
      : recordHolds(restRecord, remainingMinutes) && minuteRecordFits(restRecord) ? restRecord[0] : Math.round(remainingMinutes);
    return {
      durationUnit: 'hours', durationMinutes: minutes, scheduleDuration: hourTaskScheduleDuration(minutes, calendar),
      ...(rest !== undefined ? { remainingMinutes: rest } : {}),
      ...(durationHolds && isElapsedUnit(durationRecord, 'eu') ? { durationType: 'ELAPSEDTIME' as const } : {}),
    };
  };
  if (input.unit === 'hours') return hours(input.exactRecords);
  const durationRecord = input.dayRecords.duration;
  const restRecord = input.dayRecords.remaining;
  const contextLost = [durationRecord, restRecord].some(record => record !== undefined && !dayRecordFits(record, minutesPerDay));
  if (contextLost || (durationRecord && !recordHolds(durationRecord, durationMinutes))) {
    // Een ander programma wijzigde de duur, de kalender of het duurtype: de urenmaat met de minuten uit het
    // bestand, voor duur én rest (T21). Een `ExactMinutes`-record hoort niet bij een dagenmaat-taak en telt niet.
    return hours({});
  }
  const days = durationRecord ? durationRecord[0] : input.durationDays ?? perDay(durationMinutes);
  const remainingTime = remainingMinutes === undefined ? undefined
    : recordHolds(restRecord, remainingMinutes) ? restRecord[0] : input.remainingDays ?? perDay(remainingMinutes);
  return {
    durationUnit: 'days', scheduleDuration: days, ...(remainingTime !== undefined ? { remainingTime } : {}),
    ...(isElapsedUnit(durationRecord, 'ed') ? { durationType: 'ELAPSEDTIME' as const } : {}),
  };
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
