/**
 * De dagenmaat in IFC (alleen uren §3.3, §3.4, §3.10, §5.4; technische keuzes T5 en T21).
 *
 * Een hoeveelheid in dagen met een breuk (duur 2,5 d, rest 1,5 d, lag 0,5 d, kalendertijd 1,5 ed) gaat
 * nooit als gebroken `P…D` naar het bestand: OPS v2026.9.0 leest `P0.5D` als 5 dagen (I10, BEVESTIGD). Het
 * standaardveld draagt daarom de lengte in minuten (`PT…`: dagen × werktijd per dag, bij kalendertijd
 * dagen × 1440). Ernaast schrijft OPS een RECORD `[dagen, geschreven minuten]`. De lezer neemt de dagen
 * alleen terug als het standaardveld nog precies die minuten draagt (op de hele minuut). Wijzigde een
 * ander programma de lengte, dan geldt het standaardveld. Hele dagen blijven `P{n}D`, zoals nu.
 *
 * Waar de records staan:
 *  - duur, rest en werkelijke duur: eigenschap `DayMeasureDurations` in de per-taak-pset `OPS_WorkRule`;
 *  - lag: eigenschap `DayMeasureLags` in `OPS_Sequences` op het werkschema, met de GlobalId van de relatie
 *    als sleutel;
 *  - speling (T5): het standaardveld draagt hele dagen; de exacte dagen en de minuten staan in de
 *    eigenschap `ExactFloat` van `OPS_Analysis` (zie {@link exactFloatRecord}). Het record telt alleen
 *    als het standaardveld nog de afgeronde dagen van het record draagt;
 *  - urenmaat met een breuk in minuten (T14, de werkdriehoek rondt niet af): duur en rest gaan als `PT…`
 *    op de hele minuut, met een record `[exacte minuten, geschreven minuten]` in de eigenschap
 *    `ExactMinutes` van `OPS_WorkRule` (zie {@link exactMinutesRecord}). Zelfde leesregel;
 *  - een lag in de urenmaat met een breuk in minuten (§3.10, `.mpp` telt in tienden; review #591 r2): hetzelfde
 *    record `[exacte minuten, geschreven minuten]`, in de eigenschap `ExactMinuteLags` van `OPS_Sequences`, met
 *    de GlobalId van de relatie als sleutel, naast `DayMeasureLags`. Zelfde leesregel.
 *
 * Dit bestand importeert alleen typen en de duurhelper van de motor, zodat writer, reader en
 * `ifcPsets.ts` het zonder cyclus delen.
 */
import type { Task } from '@/types/task';
import { taskDurationUnit } from '@/engine/scheduler/duration';

/** `[dagen, geschreven minuten]`. De minuten zijn hele minuten (`minutesToIsoDuration` rondt af). */
export type DayMeasureRecord = readonly [days: number, minutes: number];

/** De IfcTaskTime-slots met een record in `DayMeasureDurations`, op hun IFC-attribuutnaam. */
export const DAY_MEASURE_DURATION_KEYS = ['ScheduleDuration', 'RemainingTime', 'ActualDuration'] as const;
export type DayMeasureDurationKey = typeof DAY_MEASURE_DURATION_KEYS[number];
export type DayMeasureDurationRecords = Partial<Record<DayMeasureDurationKey, DayMeasureRecord>>;

/** De speling-slots met een record in `ExactFloat`. */
export const EXACT_FLOAT_KEYS = ['TotalFloat', 'FreeFloat'] as const;
export type ExactFloatKey = typeof EXACT_FLOAT_KEYS[number];
/** `[exacte dagen, minuten]`; minuten `null` als de taak (nog) geen speling in minuten draagt. */
export type ExactFloatRecord = readonly [days: number, minutes: number | null];
export type ExactFloatRecords = Partial<Record<ExactFloatKey, ExactFloatRecord>>;

/** De IfcTaskTime-slots van een urentaak met een record in `ExactMinutes`. */
export const EXACT_MINUTES_KEYS = ['ScheduleDuration', 'RemainingTime'] as const;
export type ExactMinutesKey = typeof EXACT_MINUTES_KEYS[number];
/** `[exacte minuten, geschreven minuten]`: de bron van de urenmaat en wat het `PT…`-slot draagt. */
export type ExactMinutesRecord = readonly [minutes: number, written: number];
export type ExactMinutesRecords = Partial<Record<ExactMinutesKey, ExactMinutesRecord>>;

/** Namen van de eigenschappen. Voorlopige namen uit de spec (§3.3, §3.10); één plek. */
export const DAY_MEASURE_DURATIONS_PROP = 'DayMeasureDurations';
export const EXACT_MINUTES_PROP = 'ExactMinutes';
export const DAY_MEASURE_LAGS_PROP = 'DayMeasureLags';
export const EXACT_MINUTE_LAGS_PROP = 'ExactMinuteLags';
export const EXACT_FLOAT_PROP = 'ExactFloat';

/** Klokminuten per kalendertijd-dag. */
export const ELAPSED_MINUTES_PER_DAY = 1440;

/** Een dagengetal op 6 decimalen, zoals `ifcDayNumber` in de writer (spec §3.14: nauwkeurig tot ruim
 *  onder een minuut). Zo staat er geen float-ruis in het record en is een tweede ronde gelijk. */
export function roundDays(days: number): number {
  return Math.round(days * 1e6) / 1e6;
}

/** Hele dagen na de afronding op 6 decimalen (zoals de writer ze als `P{n}D` schrijft). Een niet-eindige
 *  waarde telt als heel: die gaat ongewijzigd door de oude `P…D`-vorm. */
export function isWholeDays(days: number): boolean {
  return !Number.isFinite(days) || Number.isInteger(roundDays(days));
}

/** De minuten die het standaardveld voor `days` draagt: dagen × minuten per dag, op de hele minuut. */
export function dayMeasureMinutes(days: number, minutesPerDay: number): number {
  return Math.round(days * minutesPerDay);
}

/** Het record voor een gebroken dag: dagen op 6 decimalen, en de minuten die de writer schrijft. */
export function dayMeasureRecord(days: number, minutesPerDay: number): DayMeasureRecord {
  return [roundDays(days), dayMeasureMinutes(days, minutesPerDay)];
}

/**
 * Draagt deze taak haar duur in dagen (de dagenmaat, of kalendertijd in dagen) met een breuk in duur
 * of rest? Dan gaan duur en rest allebei als `PT…` met een record. Reden: een oudere OPS leest dan een
 * urentaak met dezelfde lengte, ook voor de rest (§3.10, §5.4: "een oudere OPS leest dan een urentaak").
 * Een gebroken rest naast een duur in `P{n}D` leest v2026.9.0 als `ceil(uren ÷ 8)` hele dagen; op een
 * kalender met korte dagen gaat er dan een deel van een dag verloren.
 *
 * Dit vraagt naar de BRON van het veld (`durationUnit`, via `taskDurationUnit` zoals de rest van de
 * writer), niet of het profiel in de dagenmaat telt: de schrijver bewaart de maat in elk profiel (§3.3).
 */
export function dayTaskWritesMinutes(task: Task): boolean {
  if (taskDurationUnit(task) === 'hours') return false;
  const t = task.time;
  return !isWholeDays(t.scheduleDuration) || (t.remainingTime != null && !isWholeDays(t.remainingTime));
}

/** Schrijft de IfcTaskTime-duur van deze taak een tijddeel (`PT…`)? Urenmaat altijd; dagenmaat bij een
 *  breuk. Zo'n taak maakt haar kalender letterlijk (§3.6, `minuteModelWriteView`). */
export function taskDurationWritesMinutes(task: Task): boolean {
  return taskDurationUnit(task) === 'hours' || dayTaskWritesMinutes(task);
}

/** Minuten per dag voor een duur van deze taak: kalendertijd 1440, anders de werktijd per dag. */
export function taskMinutesPerDay(task: Task, workHoursPerDay: number): number {
  return task.time.durationType === 'ELAPSEDTIME' ? ELAPSED_MINUTES_PER_DAY : workHoursPerDay * 60;
}

/**
 * Het `ExactMinutes`-record voor een duur of rest in de urenmaat, of `undefined` als de minuten heel zijn.
 * De werkdriehoek schrijft de urenmaat zonder afronding (T14; 1920 min werk bij inzet 7 geeft
 * 274,2857… min). Het `PT…`-slot draagt hele minuten (`minutesToIsoDuration` rondt af); het record
 * bewaart de bron ernaast, met dezelfde leesregel als T21: het telt alleen als het slot nog de
 * geschreven minuten draagt.
 */
export function exactMinutesRecord(minutes: number | undefined): ExactMinutesRecord | undefined {
  if (minutes === undefined || !Number.isFinite(minutes) || Number.isInteger(minutes)) return undefined;
  return [minutes, Math.round(minutes)];
}

/** De speling in hele dagen voor het standaardveld (T5). `-0` wordt 0. */
export function wholeFloatDays(days: number): number {
  if (!Number.isFinite(days)) return days;
  const rounded = Math.round(days);
  return rounded === 0 ? 0 : rounded;
}

/**
 * Het `ExactFloat`-record voor één speling (T5), of `undefined` als het standaardveld (hele dagen) alles
 * zegt: de dagen zijn heel en er zijn geen minuten. De minuten gaan mee zodra de taak ze draagt
 * ("de precieze minuten gaan in de OPS-pset", §3.4); de lezer leidt ze nergens zelf af ("de lezer neemt
 * de minuten als ze er zijn"). De exacte dagen gaan mee omdat het standaardveld afrondt.
 */
export function exactFloatRecord(days: number, minutes: number | undefined): ExactFloatRecord | undefined {
  if (!Number.isFinite(days)) return undefined;
  const hasMinutes = minutes !== undefined && Number.isFinite(minutes);
  if (!hasMinutes && isWholeDays(days)) return undefined;
  return [roundDays(days), hasMinutes ? minutes : null];
}

// ── JSON-vorm van de records ─────────────────────────────────────────────────────────────────────

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Een geldig record `[dagen, minuten]`: twee eindige getallen, minuten heel. Anders `undefined`. */
export function parseDayMeasureRecord(value: unknown): DayMeasureRecord | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [days, minutes] = value as unknown[];
  if (!finite(days) || !finite(minutes) || !Number.isInteger(minutes)) return undefined;
  return [days, minutes];
}

function parseExactFloatRecord(value: unknown): ExactFloatRecord | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [days, minutes] = value as unknown[];
  if (!finite(days) || (minutes !== null && !finite(minutes))) return undefined;
  return [days, minutes];
}

function parseJsonObject(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

/** `DayMeasureDurations` lezen. Corrupte JSON of een ongeldig record blijft inert (zoals een bestand
 *  zonder record). */
export function parseDayMeasureDurations(raw: unknown): DayMeasureDurationRecords | undefined {
  const obj = parseJsonObject(raw);
  if (!obj) return undefined;
  const out: { -readonly [K in DayMeasureDurationKey]?: DayMeasureRecord } = {};
  for (const key of DAY_MEASURE_DURATION_KEYS) {
    const record = parseDayMeasureRecord(obj[key]);
    if (record) out[key] = record;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** `ExactMinutes` lezen; zelfde regel. Een record is `[eindige minuten, hele geschreven minuten]`. */
export function parseExactMinutes(raw: unknown): ExactMinutesRecords | undefined {
  const obj = parseJsonObject(raw);
  if (!obj) return undefined;
  const out: { -readonly [K in ExactMinutesKey]?: ExactMinutesRecord } = {};
  for (const key of EXACT_MINUTES_KEYS) {
    const record = parseDayMeasureRecord(obj[key]);
    if (record) out[key] = record;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** `ExactFloat` lezen; zelfde regel. */
export function parseExactFloat(raw: unknown): ExactFloatRecords | undefined {
  const obj = parseJsonObject(raw);
  if (!obj) return undefined;
  const out: { -readonly [K in ExactFloatKey]?: ExactFloatRecord } = {};
  for (const key of EXACT_FLOAT_KEYS) {
    const record = parseExactFloatRecord(obj[key]);
    if (record) out[key] = record;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** `DayMeasureLags` lezen: GlobalId van de relatie → record. Alleen een object telt; een ongeldig record
 *  valt weg. `undefined` = geen geldige bron. `ExactMinuteLags` heeft dezelfde vorm (twee getallen, nu
 *  `[exacte minuten, geschreven minuten]`) en gaat door dezelfde parser. */
export function parseDayMeasureLags(raw: unknown): Map<string, DayMeasureRecord> | undefined {
  const obj = parseJsonObject(raw);
  if (!obj) return undefined;
  const out = new Map<string, DayMeasureRecord>();
  for (const [guid, value] of Object.entries(obj)) {
    const record = parseDayMeasureRecord(value);
    if (guid && record) out.set(guid, record);
  }
  return out;
}
