/**
 * XER-schrijver (Primavera P6): het open project als `.xer`, met een verliesverslag.
 *
 * Tegenhanger van `readXER` (`xerReader.ts`). Voor de tabel- en kolomvorm die P6 bij import accepteert
 * is de MPXJ-schrijver geraadpleegd (https://github.com/joniles/mpxj, `PrimaveraXERFileWriter`,
 * `ProjectCalendarStructuredTextWriter`, LGPL-2.1, Jon Iles e.a.): tabelvolgorde, kolomnamen,
 * `ERMHDR`-velden, `""`-escaping en de `clndr_data`-vorm. Er is geen MPXJ-code overgenomen.
 *
 * De vertaling OPS → P6 deelt zijn tabellen met de P6 XML-schrijver (`p6xmlWriter.ts`): status,
 * constraint-soorten (`p6ConstraintTypes.ts`), resourcetypes, curvenamen, werkregels
 * (`workRuleMapping.ts`) en het project-ID (`p6ProjectIdentity`). Zo lopen de twee P6-formaten niet uit
 * elkaar.
 *
 * Duur, rest, lag en toewijzingsuren volgen het urenmodel zoals de P6 XML-schrijver (T13, T21, I7;
 * `xmlDayMeasure.ts`). Wat XER zelf niet draagt (de eenheid per taak, een breuk in de dagenmaat, de
 * projectstandaard van het taaktype, een vaste capaciteit) gaat mee als tekst-UDF met een OPS-naam; de
 * lijst en de leesregels staan in `xerOpsMarkers.ts`.
 *
 * Wat XER niet kan dragen, of wat deze schrijver nog niet schrijft, komt in `loss` (code + aantal).
 * `exportAs` maakt daar één melding van; nooit stil verlies.
 *
 * Codering (besluit, zie `XerWriteResult.encoding`): Windows-1252, zoals P6 zelf en MPXJ schrijven.
 * Past een teken daar niet in (Pools, Cyrillisch, Chinees …), dan schrijft de app UTF-8 zonder BOM en
 * meldt dat: liever tekst die een ander programma correct leest dan vraagtekens.
 */

import type { Project, EffectiveSchedulingOptions } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import { holidayEndDate } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence, SequenceType } from '@/types/sequence';
import type { ResourceAssignment } from '@/types/resource';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { effectiveSchedulingOptions, resolveConventions, builtInConventions, CONVENTION_KEYS } from '@/engine/scheduler/conventions/registry';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { isElapsedTask, taskDurationUnit } from '@/engine/scheduler/duration';
import { CONTOUR_SHAPE_VALUES, CURVE_TO_SHAPE, isFlatCurveValues } from '@/engine/contour/contourEngine';
import { XER_DURATION_TYPE_TOKEN } from '@/engine/work/workRuleMapping';
import { effectiveWorkRule, remainingMinutesOf } from '@/engine/work/workRuleApply';
import { DEFAULT_WORK_RULE } from '@/types/workRule';
import { exportCalendarLayout, taskMinutesForWrite } from '@/services/subdayIo';
import { countSplitTasksWithoutContour } from '@/services/contourIo';
import { calendarForEngine, effectiveWorkTimeBands } from '@/utils/effectiveWorkTime';
import { effHoursPerDay } from '@/utils/taskDuration';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { flattenOrder } from '@/utils/wbs';
import { computedFinish, computedStart } from '@/utils/taskDates';
import { isoDayOfWeek, parseDate } from '@/utils/dateUtils';
import { blocksClock, dayEndInstant, dayStartInstant, type DayClock } from '@/engine/calendar/workdayRules';
import { p6ConstraintToken } from '@/services/p6/p6ConstraintTypes';
import {
  P6_CURVE_TO_NAME, p6ProjectIdentity, p6RelationshipLag, resourceTypeToP6, splitWholeDay, taskStatusToP6,
} from '@/services/p6/p6xmlWriter';
import { P6_MAX_LENGTH } from '@/services/p6/p6xmlSchemaOrder';
import {
  LagRecordCollector, fieldRecordsJson, lagRecordKey, lagWorkMinutesPerDay, withElapsedUnit, writeDays, writeMinutes,
  dayMeasureMinutesPerDay, type WrittenAmount,
} from '@/services/xmlDayMeasure';
import { XER_RECORDED_OUTPUT_COLUMNS } from './xerRecordedTimes';
import { capacityStepsJson, OPS_XER_UDFS, XER_DURATION_FIELDS, type CapacityStepRecord, type XerOpsField } from './xerOpsMarkers';
import { LOSS_ORDER, type XerWriteInput, type XerWriteLossCode, type XerWriteResult } from '@/services/xerWriteTypes';

// ── Contract ─────────────────────────────────────────────────────────────────────────────────────

// Het contract (invoer, uitvoer, verliescodes) staat buiten deze map in `xerWriteTypes.ts`: de
// store en de melding gebruiken het zonder de lazy XER-chunk te laden (`check-xer-chunk-boundary.ts`).
export type { XerWriteInput, XerWriteLoss, XerWriteLossCode, XerWriteResult } from '@/services/xerWriteTypes';
export { LOSS_ORDER } from '@/services/xerWriteTypes';

// ── Vaste P6-tokens ─────────────────────────────────────────────────────────────────────────────

/** XER `TASKPRED.pred_type` per OPS-relatietype (de lezer leest ook kale dialecttokens). */
export const XER_LINK_TYPE: Record<SequenceType, string> = {
  FINISH_START: 'PR_FS',
  START_START: 'PR_SS',
  FINISH_FINISH: 'PR_FF',
  START_FINISH: 'PR_SF',
};

/** P6-status-label (`taskStatusToP6`, gedeeld met P6 XML) → XER-token. */
const XER_STATUS_TOKEN: Record<ReturnType<typeof taskStatusToP6>, string> = {
  'Not Started': 'TK_NotStart',
  'In Progress': 'TK_Active',
  Completed: 'TK_Complete',
};

/** P6 XML-resourcetype (`resourceTypeToP6`, gedeeld) → XER `rsrc_type`. */
const XER_RESOURCE_TYPE: Record<ReturnType<typeof resourceTypeToP6>, string> = {
  Labor: 'RT_Labor',
  Nonlabor: 'RT_Equip',
  Material: 'RT_Mat',
};

/** Prioriteit → `priority_type`; dezelfde getallen als de lezer. */
const XER_PRIORITY: readonly [number, string][] = [
  [0, 'PT_Lowest'], [250, 'PT_VeryLow'], [400, 'PT_Low'], [500, 'PT_Normal'],
  [750, 'PT_High'], [900, 'PT_VeryHigh'], [1000, 'PT_Top'],
];

const LAG_CALENDAR_TOKEN = {
  predecessor: 'rcal_Predecessor', successor: 'rcal_Successor', '24hour': 'rcal_24Hour', projectDefault: 'rcal_ProjDefault',
} as const;
const FLOAT_TYPE_TOKEN = { start: 'FT_SS', finish: 'FT_FF', smallest: 'FT_Min' } as const;

/** `udf_type_id` per OPS-veld. Dezelfde nummers als de P6 XML-export waar het veld daar ook bestaat. */
const OPS_XER_UDF_TYPE_ID: Record<XerOpsField, number> = {
  unit: 900000001, dayRecords: 900000003, exactRecords: 900000004, lagRecords: 900000005, inheritedWorkRule: 900000006,
  defaultWorkRule: 900000008, flatCapacity: 900000009, capacitySteps: 900000010,
};

const XER_VERSION = '20.12';
const CURRENCY = 'EUR';

// ── Tabelopbouw ──────────────────────────────────────────────────────────────────────────────────

type Cells = Record<string, string>;

interface Table {
  name: string;
  fields: readonly string[];
  rows: string[][];
}

function table(name: string, fields: readonly string[], rows: readonly Cells[]): Table {
  return { name, fields, rows: rows.map(row => fields.map(field => row[field] ?? '')) };
}

/** Tekstcel: geen tab of regeleinde (XER kent er geen escape voor), `"` ⇒ `""`. */
function text(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/[\t\r\n]+/g, ' ').replace(/"/g, '""');
}

/** Notitiecel: een regeleinde wordt DEL-DEL, zoals P6 het schrijft en `decodeXerNoteText` leest. */
function noteText(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r\n|\r|\n/g, '\u007f\u007f').replace(/"/g, '""');
}

/** Getal met `.` als decimaalteken, zonder groepering of exponent (CURRTYPE zegt `.`/`,`). */
function num(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '';
  const rounded = Math.round(value * 1e8) / 1e8;
  if (Object.is(rounded, -0) || rounded === 0) return '0';
  const out = String(rounded);
  return out.includes('e') ? rounded.toFixed(8).replace(/\.?0+$/, '') : out;
}

const flag = (value: boolean): string => (value ? 'Y' : 'N');

/** Kap af op `max` tekens (codepunten) en tel het. */
function clip(value: string, max: number, counter: { truncated: number }): string {
  const chars = Array.from(value);
  if (chars.length <= max) return value;
  counter.truncated++;
  return chars.slice(0, max).join('');
}

/** Een code zoals hij in de XER-cel komt (vóór `text()`): geen tab of regeleinde, geen witruimte
 *  aan de randen. Normaliseren gebeurt VÓÓR de controle op lengte en uniciteit. */
function normalizeCode(value: string | undefined): string {
  return (value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
}

/**
 * Een unieke code van hooguit `max` tekens (review PR #393, punt 8). Eerst normaliseren en inkorten
 * (geteld als `truncated`), dan pas de uniciteit; een achtervoegsel `-2`, `-3`, … komt binnen de grens
 * (de basis wordt zo nodig korter). `changed` telt elke code die de schrijver moest aanpassen.
 */
function uniqueCode(
  raw: string | undefined, max: number, used: Set<string>, fallback: () => string,
  counter: { truncated: number }, changes: { changed: number },
): string {
  let code = clip(normalizeCode(raw), max, counter);
  if (!code || used.has(code)) {
    const base = code || fallback();
    let n = code ? 2 : 1;
    let candidate = code ? '' : clipChars(base, max);
    while (!candidate || used.has(candidate)) {
      const suffix = `-${n++}`;
      candidate = `${clipChars(base, Math.max(1, max - suffix.length))}${suffix}`;
    }
    code = candidate;
    changes.changed++;
  }
  used.add(code);
  return code;
}

function clipChars(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : chars.slice(0, max).join('');
}

/** P6-sleutels zijn gehele getallen. Een bestaande numerieke bron-id (uit een eerdere XER) blijft
 *  staan als hij uniek is; de rest krijgt het eerstvolgende vrije nummer. */
function allocateIds<T>(items: readonly T[], keyOf: (item: T) => string, preferred: (item: T) => string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const item of items) {
    const want = preferred(item)?.trim();
    if (want && /^[1-9]\d{0,14}$/.test(want) && !used.has(want)) {
      used.add(want);
      out.set(keyOf(item), want);
    }
  }
  let next = 1;
  for (const item of items) {
    const key = keyOf(item);
    if (out.has(key)) continue;
    while (used.has(String(next))) next++;
    used.add(String(next));
    out.set(key, String(next));
  }
  return out;
}

// ── Datums en kalenders ──────────────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

function clock(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

/** `YYYY-MM-DD` + minuten (mag ≥ 1440 zijn: dan de volgende dag). */
function dateWithMinutes(date: string, minutes: number): string {
  const day = Math.floor(minutes / 1440);
  const rest = minutes - day * 1440;
  const base = Date.parse(`${date.slice(0, 10)}T00:00:00Z`) + day * 86_400_000;
  return `${new Date(base).toISOString().slice(0, 10)} ${clock(rest)}`;
}

/**
 * Een OPS-datum als XER-datum `yyyy-MM-dd HH:mm`. Een moment gaat letterlijk. Een datum zonder tijd krijgt
 * het moment dat de motor er zelf van maakt, op de kalender van de taak (de dagregels, `workdayRules.ts`):
 * `start` ⇒ D1, het begin van het eerste werkblok; `finish` ⇒ D2, het einde van het laatste (zonder
 * werkblok die dag: de typische werkdag, D4). Zo leest `readXER` hetzelfde moment terug, ook de statusdatum
 * (startachtig, zoals de solver hem leest). `midnight` ⇒ 00:00: alleen voor een ingangsdatum, waarvan de
 * lezer alleen de datum gebruikt.
 */
class InstantWriter {
  private readonly clocks = new Map<string, DayClock>();

  private clock(cal: WorkCalendar): DayClock {
    let clock = this.clocks.get(cal.id);
    if (!clock) {
      clock = blocksClock(cal);
      this.clocks.set(cal.id, clock);
    }
    return clock;
  }

  write(iso: string | undefined, side: 'start' | 'finish' | 'midnight', cal: WorkCalendar): string {
    if (!iso) return '';
    if (iso.length >= 16 && iso[10] === 'T') return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
    const date = iso.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
    if (side === 'midnight') return `${date} 00:00`;
    const instant = side === 'start' ? dayStartInstant(this.clock(cal), date) : dayEndInstant(this.clock(cal), date);
    if (instant) return `${instant.slice(0, 10)} ${instant.slice(11, 16)}`;
    return dateWithMinutes(date, Math.round((side === 'start' ? cal.workStartHour : cal.workEndHour) * 60));
  }
}

/** Weekbanden van een kalender, met een band over middernacht gesplitst (de staart op de volgende
 *  dag): `clndr_data` kent per dag alleen tijden van 00:00 tot 24:00. */
function weekBands(cal: WorkCalendar): Record<number, { start: number; end: number }[]> {
  const bands = effectiveWorkTimeBands(cal);
  const out: Record<number, { start: number; end: number }[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
  for (let day = 1; day <= 7; day++) {
    const list = bands
      ? bands.byWeekday[day as 1] ?? []
      : cal.workDays.includes(day) ? [{ start: cal.workStartHour * 60, end: cal.workEndHour * 60 }] : [];
    for (const band of list) {
      if (band.end <= 1440) {
        out[day].push({ start: band.start, end: band.end });
      } else {
        out[day].push({ start: band.start, end: 1440 });
        out[(day % 7) + 1].push({ start: 0, end: band.end - 1440 });
      }
    }
  }
  for (const day of Object.keys(out)) out[Number(day)].sort((a, b) => a.start - b.start);
  return out;
}

function bandRecords(bands: readonly { start: number; end: number }[]): string {
  return bands.map((band, index) => `(0||${index}(s|${clock(band.start)}|f|${clock(band.end)})())`).join('');
}

const P6_EPOCH_MS = Date.UTC(1899, 11, 30);

function isoDaysInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  let d = Date.parse(`${start.slice(0, 10)}T00:00:00Z`);
  const last = Date.parse(`${end.slice(0, 10)}T00:00:00Z`);
  while (Number.isFinite(d) && d <= last && out.length < 3660) {
    out.push(new Date(d).toISOString().slice(0, 10));
    d += 86_400_000;
  }
  return out;
}

function nextIsoDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** De werktijd op één kalenderdatum (minuten 0–1440): de banden die die dag beginnen, afgekapt op
 *  middernacht, plus het deel na middernacht van de banden die de dag ervoor begonnen. */
function workOnDate(engine: CalendarEngine, date: string): { start: number; end: number }[] {
  const day = parseDate(date);
  const prev = parseDate(new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10));
  const pieces: { start: number; end: number }[] = [];
  for (const b of engine.effectiveBandsOn(prev)) if (b.end > 1440) pieces.push({ start: Math.max(0, b.start - 1440), end: Math.min(1440, b.end - 1440) });
  for (const b of engine.effectiveBandsOn(day)) if (b.start < 1440) pieces.push({ start: b.start, end: Math.min(1440, b.end) });
  pieces.sort((x, y) => x.start - y.start);
  const merged: { start: number; end: number }[] = [];
  for (const piece of pieces) {
    const last = merged[merged.length - 1];
    if (last && piece.start <= last.end) last.end = Math.max(last.end, piece.end);
    else if (piece.end > piece.start) merged.push({ ...piece });
  }
  return merged;
}

function sameBands(a: readonly { start: number; end: number }[], b: readonly { start: number; end: number }[]): boolean {
  return a.length === b.length && a.every((band, i) => band.start === b[i].start && band.end === b[i].end);
}

/**
 * `CALENDAR.clndr_data` in de vorm die `decodeXerCalendarData` leest: `DaysOfWeek` met P6-dagnummers
 * (1 = zondag … 7 = zaterdag), daarna `Exceptions` met één record per datum (`d` = dagen sinds
 * 1899-12-30). Een vrije dag heeft geen banden; een werkende uitzondering haar eigen banden, of die van
 * de weekdag. Elke datum één keer: P6 weigert dubbele uitzonderingen. Een werkende uitzondering wint
 * van een feestdag op dezelfde datum (zoals in de P6 XML-schrijver).
 */
function calendarData(cal: WorkCalendar): string {
  const week = weekBands(cal);
  const days: string[] = [];
  for (let p6Day = 1; p6Day <= 7; p6Day++) {
    const iso = p6Day === 1 ? 7 : p6Day - 1;
    days.push(`(0||${p6Day}()(${bandRecords(week[iso])}))`);
  }
  const byDate = new Map<string, string>();
  for (const h of cal.holidays) {
    for (const date of isoDaysInclusive(h.startDate, holidayEndDate(h))) byDate.set(date, '');
  }
  const firstWorkday = [...cal.workDays].sort((a, b) => a - b)[0] ?? 1;
  for (const w of cal.workingExceptions ?? []) {
    for (const date of isoDaysInclusive(w.startDate, w.endDate || w.startDate)) {
      let bands = w.bands && w.bands.length > 0 ? [...w.bands] : week[isoDayOfWeek(parseDate(date))];
      if (bands.length === 0) bands = week[firstWorkday];
      if (bands.length === 0) bands = [{ start: cal.workStartHour * 60, end: cal.workEndHour * 60 }];
      byDate.set(date, bandRecords(splitWholeDay(bands).map(b => ({ start: b.start, end: Math.min(b.end, 1440) }))));
    }
  }
  // Uurkalender: schrijf per datum wat de rekenkern die dag WERKELIJK als werktijd ziet (00:00–24:00),
  // ook de ochtendstaart van een band die de dag ervoor over middernacht liep (review PR #393, punt 6).
  // Dat geldt voor elke uitzonderings- of feestdag én de dag erna; die dag-erna krijgt alleen een
  // eigen uitzondering als ze afwijkt van haar gewone weekpatroon.
  const engine = new CalendarEngine(calendarForEngine(cal));
  if (engine.isHourMode) {
    const explicit = new Set(byDate.keys());
    const candidates = new Set<string>();
    for (const date of explicit) { candidates.add(date); candidates.add(nextIsoDay(date)); }
    for (const date of candidates) {
      const bands = workOnDate(engine, date);
      const weekday = week[isoDayOfWeek(parseDate(date))];
      if (!explicit.has(date) && sameBands(bands, weekday)) continue;
      byDate.set(date, bandRecords(bands));
    }
  }
  const exceptions = [...byDate.keys()].sort().map((date, index) => {
    const serial = Math.round((Date.parse(`${date}T00:00:00Z`) - P6_EPOCH_MS) / 86_400_000);
    return `(0||${index}(d|${serial})(${byDate.get(date)}))`;
  });
  return `(0||CalendarData()((0||DaysOfWeek()(${days.join('')}))(0||Exceptions()(${exceptions.join('')}))))`;
}

// ── Windows-1252 ────────────────────────────────────────────────────────────────────────────────

/** De tekens 0x80–0x9F van Windows-1252 (de rest is gelijk aan Latin-1). */
const CP1252_HIGH: Readonly<Record<number, number>> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

function cp1252Byte(codePoint: number): number | undefined {
  if (codePoint < 0x80 || (codePoint >= 0xa0 && codePoint <= 0xff)) return codePoint;
  return CP1252_HIGH[codePoint];
}

/** Tekst ⇒ Windows-1252-bytes, of `null` plus het aantal tekens dat er niet in past. */
export function encodeWindows1252(value: string): { bytes: Uint8Array | null; unencodable: number } {
  const out = new Uint8Array(value.length);
  let length = 0;
  let unencodable = 0;
  for (const char of value) {
    const byte = cp1252Byte(char.codePointAt(0) ?? 0);
    if (byte === undefined) { unencodable++; continue; }
    out[length++] = byte;
  }
  return unencodable > 0 ? { bytes: null, unencodable } : { bytes: out.slice(0, length), unencodable: 0 };
}

// ── Kolommen ─────────────────────────────────────────────────────────────────────────────────────

const CURRTYPE_COLUMNS = [
  'curr_id', 'decimal_digit_cnt', 'curr_symbol', 'decimal_symbol', 'digit_group_symbol',
  'pos_curr_fmt_type', 'neg_curr_fmt_type', 'curr_type', 'curr_short_name', 'group_digit_cnt', 'base_exch_rate',
] as const;
const UMEASURE_COLUMNS = ['unit_id', 'seq_num', 'unit_abbrev', 'unit_name'] as const;
const RSRCCURVDATA_COLUMNS = [
  'curv_id', 'curv_name', 'default_flag', ...Array.from({ length: 21 }, (_, i) => `pct_usage_${i}`),
] as const;
const RSRC_COLUMNS = [
  'rsrc_id', 'parent_rsrc_id', 'clndr_id', 'role_id', 'rsrc_seq_num', 'rsrc_name', 'rsrc_short_name',
  'def_qty_per_hr', 'cost_qty_type', 'active_flag', 'curr_id', 'unit_id', 'rsrc_type', 'rsrc_notes',
] as const;
const RSRCRATE_COLUMNS = ['rsrc_rate_id', 'rsrc_id', 'max_qty_per_hr', 'cost_per_qty', 'start_date'] as const;
/** PROJECT: de gewone kolommen; de drie planningskolommen staan apart (zie hieronder). */
const PROJECT_COLUMNS = [
  'proj_id', 'fy_start_month_num', 'rsrc_self_add_flag', 'allow_complete_flag', 'rsrc_multi_assign_flag',
  'checkout_flag', 'project_flag', 'step_complete_flag', 'batch_sum_flag', 'name_sep_char',
  'def_complete_pct_type', 'proj_short_name', 'clndr_id', 'task_code_base', 'task_code_step', 'priority_num',
  'wbs_max_sum_level', 'strgy_priority_num', 'last_recalc_date', 'def_duration_type', 'def_qty_type',
  'add_by_name', 'def_rate_type', 'act_this_per_link_flag', 'def_task_type', 'act_pct_link_flag',
  'critical_path_type', 'def_rollup_dates_flag', 'rem_target_link_flag', 'reset_planned_flag',
  'allow_neg_act_flag', 'sum_assign_level', 'export_flag',
] as const;
/**
 * De PROJECT-kolommen geplande start, "Must Finish By" en de kritiekdrempel (uren). Hun namen staan in
 * de verboden-lijst van de lezer (bak 2: als TASK-kolom zijn het rekenuitvoer), daarom precies één
 * keer hier, als catalogus (gepind in `check-xer-field-whitelist.ts`); de waarden gaan positioneel.
 */
const XER_PROJECT_PLANNING_COLUMNS = ['plan_start_date', 'plan_end_date', 'critical_drtn_hr_cnt'] as const;
const CALENDAR_COLUMNS = [
  'clndr_id', 'default_flag', 'clndr_name', 'proj_id', 'base_clndr_id', 'clndr_type',
  'day_hr_cnt', 'week_hr_cnt', 'month_hr_cnt', 'year_hr_cnt', 'rsrc_private', 'clndr_data',
] as const;
const SCHEDOPTIONS_COLUMNS = [
  'schedoptions_id', 'proj_id', 'sched_outer_depend_type', 'sched_open_critical_flag',
  'sched_lag_early_start_flag', 'sched_retained_logic', 'sched_setplantoforecast', 'sched_float_type',
  'sched_calendar_on_relationship_lag', 'sched_use_expect_end_flag', 'sched_progress_override',
  'sched_use_project_end_date_for_float', 'enable_multiple_longest_path_calc',
  'limit_multiple_longest_path_calc', 'max_multiple_longest_path', 'use_total_float_multiple_longest_paths',
] as const;
const PROJWBS_COLUMNS = [
  'wbs_id', 'proj_id', 'obs_id', 'seq_num', 'est_wt', 'proj_node_flag', 'sum_data_flag', 'status_code',
  'wbs_short_name', 'wbs_name', 'parent_wbs_id',
] as const;
const TASK_COLUMNS = [
  'task_id', 'proj_id', 'wbs_id', 'clndr_id', 'phys_complete_pct', 'rev_fdbk_flag', 'est_wt',
  'lock_plan_flag', 'auto_compute_act_flag', 'complete_pct_type', 'task_type', 'duration_type',
  'status_code', 'task_code', 'task_name', 'remain_drtn_hr_cnt', 'target_drtn_hr_cnt', 'cstr_date',
  'act_start_date', 'act_end_date', 'expect_end_date', 'target_start_date', 'target_end_date', 'cstr_type',
  'priority_type', 'suspend_date', 'resume_date', 'cstr_date2', 'cstr_type2', 'complete_pct',
] as const;
const TASKPRED_COLUMNS = ['task_pred_id', 'task_id', 'pred_task_id', 'proj_id', 'pred_proj_id', 'pred_type', 'lag_hr_cnt'] as const;
const TASKRSRC_COLUMNS = [
  'taskrsrc_id', 'task_id', 'proj_id', 'cost_qty_link_flag', 'role_id', 'rsrc_id', 'remain_qty', 'target_qty',
  'remain_qty_per_hr', 'target_qty_per_hr', 'act_ot_qty', 'act_reg_qty', 'cost_per_qty', 'target_start_date',
  'target_end_date', 'rate_type', 'curv_id', 'rsrc_type', 'cost_per_qty_source_type',
] as const;
const UDFTYPE_COLUMNS = ['udf_type_id', 'table_name', 'udf_type_name', 'udf_type_label', 'logical_data_type', 'super_flag'] as const;
const UDFVALUE_COLUMNS = ['udf_type_id', 'fk_id', 'proj_id', 'udf_date', 'udf_number', 'udf_text', 'udf_code_id'] as const;
const MEMOTYPE_COLUMNS = ['memo_type_id', 'seq_num', 'eps_flag', 'proj_flag', 'wbs_flag', 'task_flag', 'memo_type'] as const;
const TASKMEMO_COLUMNS = ['memo_id', 'task_id', 'memo_type_id', 'proj_id', 'task_memo'] as const;

// ── Rekenopties ──────────────────────────────────────────────────────────────────────────────────

/** Wat de lezer van deze SCHEDOPTIONS-rij maakt, vergeleken met wat het project nu gebruikt. Een
 *  verschil (of een profiel dat niet P6 is) ⇒ het verlies `schedulingRules`. */
function schedulingRulesDiffer(project: Project, options: EffectiveSchedulingOptions, tasks: readonly Task[]): boolean {
  const own = resolveConventions(project.schedulingProfile);
  const p6 = builtInConventions('p6');
  if (CONVENTION_KEYS.some(key => own[key] !== p6[key])) return true;
  if (options.totalFloatMode === undefined) return true; // "Automatisch" kent P6 niet
  if (options.useExpectedFinishDates === false && tasks.some(t => t.p6ExpectedFinish)) return true;
  if (options.useExpectedFinishDates === undefined && tasks.some(t => t.p6ExpectedFinish)) return true;
  if ((options.p6CompletedLateFromRemainingWindow ?? false) !== (project.progressMode !== 'PROGRESS_OVERRIDE')
    && tasks.some(t => t.time.actualFinish)) return true;
  // Alleen de eigen projectopties: `options` bevat ook de conventies (die toetst de regel hierboven).
  const own2 = project.schedulingOptions ?? {};
  if (own2.leveling !== undefined) return true;
  if (own2.nearCriticalThreshold !== undefined) return true;
  const crit = options.criticalDefinition;
  if (crit && crit.mode === 'totalFloat' && crit.thresholdHours === undefined && (crit.threshold ?? 0) !== 0) return true;
  return false;
}

// ── Maat (alleen uren §3.3, §3.10; T13, T14, T21; `xmlDayMeasure.ts`) ───────────────────────────

/** De werktijd per dag van een kalender in minuten (T13): daarin telt de dagenmaat, net als in de P6
 *  XML-export en in de lezer (`readXER`). Een kalender zonder werktijd telt 8 u, net als de lezer. */
function workMinutesPerDayOf(cal: WorkCalendar): number {
  const minutes = dayMeasureMinutesPerDay(cal, false);
  return minutes > 0 ? minutes : 480;
}

/**
 * Duur en rest van een activiteit in de vorm die de XER draagt, met het record, zoals de P6 XML-export:
 *  - urenmaat: de minuten, op de hele minuut; een breuk gaat als `OPS_ExactMinutes`-record mee (T14);
 *  - dagenmaat: werkdagen × de werktijd per dag van de taakkalender (T13, niet de opgeslagen `hoursPerDay`);
 *    een breuk in dagen gaat als `OPS_DayMeasureDurations`-record mee (T21);
 *  - kalendertijd kent P6 niet per activiteit: de lengte telt als werktijd, en het record draagt de eenheid
 *    (`ed`/`eu`), ook bij hele dagen, zodat OPS de kalendertijd terugleest (review #585 r1, punt 3).
 * De rest volgt de solver en de werkregelbrug (`remainingMinutesOf`): de vastgelegde rest, anders duur ×
 * (1 − voortgang), in de maat van de taak. Een voltooide taak en een mijlpaal: 0.
 */
function writtenDurations(task: Task, cal: WorkCalendar, complete: boolean): { duration: WrittenAmount; remaining: WrittenAmount } {
  if (task.isMilestone) return { duration: { minutes: 0 }, remaining: { minutes: 0 } };
  const minutesPerDay = workMinutesPerDayOf(cal);
  const isHour = taskDurationUnit(task) === 'hours';
  const elapsed = isElapsedTask(task);
  const tag = (written: WrittenAmount, value: number): WrittenAmount =>
    (elapsed ? withElapsedUnit(written, value, isHour ? 'eu' : 'ed') : written);
  if (isHour) {
    const minutes = taskMinutesForWrite(task, minutesPerDay / 60);
    const rest = remainingMinutesOf(task, { hoursPerDay: minutesPerDay / 60 });
    return { duration: tag(writeMinutes(minutes), minutes), remaining: complete ? { minutes: 0 } : tag(writeMinutes(rest), rest) };
  }
  const days = task.time.scheduleDuration;
  const restDays = Math.max(0, task.time.remainingTime ?? days * (1 - (task.time.completion ?? 0)));
  return {
    duration: tag(writeDays(days, minutesPerDay), days),
    remaining: complete ? { minutes: 0 } : tag(writeDays(restDays, minutesPerDay), restDays),
  };
}

// ── Schrijver ───────────────────────────────────────────────────────────────────────────────────

export function writeXER(input: XerWriteInput): XerWriteResult {
  const { project, calendar } = input;
  const losses = new Map<XerWriteLossCode, number>();
  const lose = (code: XerWriteLossCode, count: number) => {
    if (count > 0) losses.set(code, (losses.get(code) ?? 0) + count);
  };
  const counter = { truncated: 0 };

  const tasks = [...flattenOrder([...input.tasks])];
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const wbsTasks = tasks.filter(isSummaryTask);
  const leafTasks = tasks.filter(isLeafTask);

  const { libraryCalendars, effCalByTask } = exportCalendarLayout(tasks, calendar, [...input.calendars]);
  const allCalendars = [calendar, ...libraryCalendars];
  const calendarById = new Map(allCalendars.map(c => [c.id, c]));
  const effCal = (task: Task): WorkCalendar => effCalByTask.get(task.id) ?? calendar;
  const instants = new InstantWriter();
  const options = effectiveSchedulingOptions(project);

  // ── Identiteiten ─────────────────────────────────────────────────────────────────────────────
  const identity = p6ProjectIdentity(project, input.projectCode);
  // Het P6 Project-ID: de eigen code van het document, anders de projectnaam (review PR #393, punt 2).
  // Geen `OPS:`-code: die zou na heropenen als code van de gebruiker gelden. Een naam als ID toont de
  // app na heropenen niet dubbel (`nameWithProjectCode`: naam = code ⇒ alleen de naam).
  const ownProjectCode = normalizeCode(input.projectCode ?? undefined);
  const projectCode = ownProjectCode
    ? clip(ownProjectCode, P6_MAX_LENGTH.Project.Id, counter)
    : clipChars(normalizeCode(identity.name) || 'Project', P6_MAX_LENGTH.Project.Id);
  const codeChanges = { changed: 0 };
  const projId = /^[1-9]\d{0,14}$/.test(leafTasks[0]?.p6ProjectId ?? '') ? leafTasks[0]!.p6ProjectId! : '1';
  const calIds = allocateIds(allCalendars, c => c.id, c => c.id);
  const taskIds = allocateIds(leafTasks, t => t.id, t => t.p6TaskId ?? t.id);
  const wbsIds = allocateIds(wbsTasks, t => t.id, t => /^xer-wbs:[^:]*:(\d+)$/.exec(t.id)?.[1]);
  const resIds = allocateIds(input.resources, r => r.id, r => /^xer-resource:(\d+)$/.exec(r.id)?.[1] ?? r.id);

  // De projectknoop van P6 (PROJWBS met `proj_node_flag = Y`): de wortel van de WBS, met de
  // projectnaam. Heeft het project precies één wortel, een samenvatting met de projectnaam (zo komt
  // een eerder ingelezen XER binnen), dan IS die de projectknoop — anders zou elke rondgang een
  // laag toevoegen. Anders maakt de schrijver een nieuwe knoop.
  const roots = tasks.filter(t => !t.parentId || !taskById.has(t.parentId));
  const foldedRoot = roots.length === 1 && isSummaryTask(roots[0]) && roots[0].name.trim() === identity.name.trim()
    ? roots[0] : undefined;
  const usedWbsIds = new Set(wbsIds.values());
  let projectNodeId = foldedRoot ? wbsIds.get(foldedRoot.id)! : '';
  if (!projectNodeId) {
    let n = 1;
    while (usedWbsIds.has(String(n))) n++;
    projectNodeId = String(n);
  }
  const wbsIdOf = (parentId: string | null): string =>
    (parentId && wbsIds.get(parentId)) || projectNodeId;

  // ── PROJECT ──────────────────────────────────────────────────────────────────────────────────
  const crit = options.criticalDefinition;
  const critHours = crit?.mode === 'totalFloat'
    ? crit.thresholdHours ?? (crit.threshold ?? 0) * calendar.hoursPerDay
    : 0;
  const projectRow: Cells = {
    proj_id: projId, fy_start_month_num: '1', rsrc_self_add_flag: 'Y', allow_complete_flag: 'Y',
    rsrc_multi_assign_flag: 'Y', checkout_flag: 'N', project_flag: 'Y', step_complete_flag: 'N',
    batch_sum_flag: 'Y', name_sep_char: '.', def_complete_pct_type: 'CP_Drtn',
    proj_short_name: text(projectCode),
    clndr_id: calIds.get(calendar.id)!, task_code_base: '1000', task_code_step: '10', priority_num: '10',
    wbs_max_sum_level: '0', strgy_priority_num: '100',
    last_recalc_date: instants.write(project.statusDate, 'start', calendar),
    // De effectieve projectstandaard, ook zonder eigen keuze (`DEFAULT_WORK_RULE`, review ronde 2 E1).
    def_duration_type: XER_DURATION_TYPE_TOKEN[project.defaultWorkRule ?? DEFAULT_WORK_RULE], def_qty_type: 'QT_Hour', add_by_name: 'admin', def_rate_type: 'COST_PER_QTY',
    act_this_per_link_flag: 'Y', def_task_type: 'TT_Task', act_pct_link_flag: 'N',
    critical_path_type: crit?.mode === 'longestPath' ? 'CT_DrivPath' : 'CT_TotFloat',
    def_rollup_dates_flag: 'Y', rem_target_link_flag: 'Y', reset_planned_flag: 'N', allow_neg_act_flag: 'N',
    sum_assign_level: 'SL_Taskrsrc', export_flag: 'Y',
  };
  const projectPlanning: string[] = [
    instants.write(project.startDate, 'start', calendar),
    options.useProjectEndDateForFloat ? instants.write(project.endDate, 'finish', calendar) : '',
    num(critHours),
  ];
  if (project.description?.trim() || project.author?.trim() || project.company?.trim()) lose('projectDetails', 1);
  // De eigen keuze van het project (review PR #393 ronde 2, punt E2). `def_duration_type` staat er altijd,
  // ook zonder keuze; de UDF zegt `readXER` dat het project deze standaard zelf koos.
  const opsValues: { field: XerOpsField; fkId: string; text: string }[] = [];
  if (project.defaultWorkRule) opsValues.push({ field: 'defaultWorkRule', fkId: projId, text: project.defaultWorkRule });

  // ── CALENDAR ─────────────────────────────────────────────────────────────────────────────────
  const taskCalendarIds = new Set(tasks.map(t => t.calendarId).filter((id): id is string => !!id));
  const calendarRows: Cells[] = allCalendars.map(cal => {
    const week = weekBands(cal);
    const workDays = Object.values(week).filter(b => b.length > 0).length;
    const weekHours = cal.hoursPerDay * workDays;
    lose('holidayNames', cal.holidays.filter(h => h.name.trim()).length
      + (cal.workingExceptions ?? []).filter(w => w.name.trim()).length);
    return {
      clndr_id: calIds.get(cal.id)!, default_flag: 'N', clndr_name: text(cal.name || cal.id),
      base_clndr_id: '', clndr_type: cal === calendar || taskCalendarIds.has(cal.id) ? 'CA_Base' : 'CA_Rsrc',
      day_hr_cnt: num(cal.hoursPerDay), week_hr_cnt: num(weekHours), month_hr_cnt: num(weekHours * 4),
      year_hr_cnt: num(weekHours * 52), rsrc_private: 'N', clndr_data: calendarData(cal),
    };
  });

  // ── SCHEDOPTIONS ─────────────────────────────────────────────────────────────────────────────
  const floatPaths = options.floatPaths;
  const scheduleRow: Cells = {
    schedoptions_id: '1', proj_id: projId, sched_outer_depend_type: 'SD_Both',
    sched_open_critical_flag: flag(options.makeOpenEndedCritical ?? false),
    sched_lag_early_start_flag: flag((options.startToStartLagFrom ?? 'earlyStart') === 'earlyStart'),
    sched_retained_logic: flag(project.progressMode !== 'PROGRESS_OVERRIDE'),
    sched_setplantoforecast: 'N',
    sched_float_type: FLOAT_TYPE_TOKEN[options.totalFloatMode ?? 'finish'],
    sched_calendar_on_relationship_lag: LAG_CALENDAR_TOKEN[options.lagCalendar ?? 'predecessor'],
    sched_use_expect_end_flag: flag(options.useExpectedFinishDates ?? false),
    sched_progress_override: flag(project.progressMode === 'PROGRESS_OVERRIDE'),
    sched_use_project_end_date_for_float: flag(options.useProjectEndDateForFloat === true && !!project.endDate),
    ...(floatPaths ? {
      enable_multiple_longest_path_calc: flag(floatPaths.enabled),
      limit_multiple_longest_path_calc: 'Y',
      max_multiple_longest_path: num(floatPaths.maxPaths),
      use_total_float_multiple_longest_paths: flag(floatPaths.method === 'TOTAL_FLOAT'),
    } : {}),
  };
  if (schedulingRulesDiffer(project, options, tasks)) lose('schedulingRules', 1);
  // Een kalender zonder eigen werktijdblokken (alleen begin, einde en uren per dag) schrijft de XER als banden.
  // De lezer leest elke kalender met banden als urenkalender (`xerCalendarData.ts`, gelijk aan main), dus na
  // heropenen heeft ze eigen werktijdblokken, en de engine rekent daar anders mee (knownbug 466; review PR
  // #393 ronde 3, punt 1). Geen markering: het besluit daarover ligt bij de eigenaar. Wel een melding.
  lose('calendarKinds', allCalendars.filter(cal => !cal.workTime && effectiveWorkTimeBands(cal) !== undefined).length);

  // ── PROJWBS ──────────────────────────────────────────────────────────────────────────────────
  const order = new Map(tasks.map((t, i) => [t.id, i + 1]));
  const wbsRows: Cells[] = [];
  const nodeName = foldedRoot ? foldedRoot.name : identity.name;
  const nodeCode = foldedRoot?.wbsCode?.trim() || projectCode;
  // WBS-codes: uniek per ouder (P6), na normalisatie en binnen de grens.
  const usedWbsCodes = new Map<string, Set<string>>();
  const wbsCodeFor = (parentWbsId: string, raw: string | undefined, fallback: () => string): string => {
    let used = usedWbsCodes.get(parentWbsId);
    if (!used) { used = new Set(); usedWbsCodes.set(parentWbsId, used); }
    return uniqueCode(raw, P6_MAX_LENGTH.WBS.Code, used, fallback, counter, codeChanges);
  };
  wbsRows.push({
    wbs_id: projectNodeId, proj_id: projId, seq_num: '0', est_wt: '1', proj_node_flag: 'Y', sum_data_flag: 'N',
    status_code: 'WS_Open', wbs_short_name: text(wbsCodeFor('', nodeCode, () => 'WBS')),
    wbs_name: text(clip(nodeName, P6_MAX_LENGTH.WBS.Name, counter)), parent_wbs_id: '',
  });
  for (const wbs of wbsTasks) {
    if (wbs === foldedRoot) continue;
    const parentWbsId = wbsIdOf(wbs.parentId);
    const code = wbsCodeFor(parentWbsId, wbs.wbsCode, () => String(order.get(wbs.id)));
    wbsRows.push({
      wbs_id: wbsIds.get(wbs.id)!, proj_id: projId, seq_num: String(order.get(wbs.id)), est_wt: '1',
      proj_node_flag: 'N', sum_data_flag: 'N', status_code: 'WS_Open',
      wbs_short_name: text(code),
      wbs_name: text(clip(wbs.name || code, P6_MAX_LENGTH.WBS.Name, counter)),
      parent_wbs_id: parentWbsId,
    });
  }

  // ── TASK ─────────────────────────────────────────────────────────────────────────────────────
  const usedCodes = new Set<string>();
  const taskRows: string[][] = [];
  /** Per taak de geschreven duur en rest in minuten: de toewijzingen hieronder rekenen ermee. */
  const writtenByTask = new Map<string, { duration: number; remaining: number }>();
  for (const task of leafTasks) {
    const cal = effCal(task);
    const status = XER_STATUS_TOKEN[taskStatusToP6(task)];
    const { duration, remaining } = writtenDurations(task, cal, status === 'TK_Complete');
    writtenByTask.set(task.id, { duration: duration.minutes, remaining: remaining.minutes });
    // Activiteit-ID: uniek, niet leeg en hooguit 40 tekens, ná normalisatie (P6 eist dat).
    const code = uniqueCode(task.wbsCode, P6_MAX_LENGTH.Activity.Id, usedCodes, () => `A${(order.get(task.id) ?? 1) * 10}`, counter, codeChanges);
    const milestoneSide = task.milestoneKind === 'FINISH' ? 'finish' : 'start';
    const startSide = task.isMilestone ? milestoneSide : 'start';
    const finishSide = task.isMilestone ? milestoneSide : 'finish';
    const constraintSide = (type: string | undefined): 'start' | 'finish' =>
      type === 'MFO' || type === 'FNET' || type === 'FNLT' ? 'finish' : 'start';
    // De EFFECTIEVE werkregel: eigen regel, anders de projectstandaard (review PR #393, punt 3). Alleen
    // een taak zonder beide houdt haar P6-duurtype uit de bron, of anders de standaardregel.
    const ruleSource = task.workRule ?? project.defaultWorkRule;
    const durationType = ruleSource
      ? XER_DURATION_TYPE_TOKEN[effectiveWorkRule(task, project.defaultWorkRule)]
      : task.p6DurationType ?? XER_DURATION_TYPE_TOKEN[effectiveWorkRule(task)];
    // Activiteittype: mijlpaal, hammock (TT_LOE), anders het P6-type uit de bron als dat een gewone
    // activiteit is (TT_Rsrc, TT_WBS: review PR #393, punt 7), anders TT_Task.
    const taskType = task.isMilestone ? (task.milestoneKind === 'FINISH' ? 'TT_FinMile' : 'TT_Mile')
      : task.isHammock ? 'TT_LOE'
        : task.p6ActivityType === 'TT_Rsrc' || task.p6ActivityType === 'TT_WBS' ? task.p6ActivityType : 'TT_Task';
    const priority = XER_PRIORITY.reduce((best, entry) =>
      Math.abs(entry[0] - task.priority) < Math.abs(best[0] - task.priority) ? entry : best, XER_PRIORITY[3]);
    const pct = num(Math.max(0, Math.min(1, task.time.completion)) * 100);
    const row: Cells = {
      task_id: taskIds.get(task.id)!, proj_id: projId, wbs_id: wbsIdOf(task.parentId),
      clndr_id: calIds.get(cal.id)!, phys_complete_pct: pct, rev_fdbk_flag: 'N', est_wt: '1',
      lock_plan_flag: 'N', auto_compute_act_flag: 'N', complete_pct_type: task.p6CompletePctType ?? 'CP_Phys',
      task_type: taskType, duration_type: durationType, status_code: status,
      task_code: text(code), task_name: text(clip(task.name, P6_MAX_LENGTH.Activity.Name, counter)),
      remain_drtn_hr_cnt: num(remaining.minutes / 60), target_drtn_hr_cnt: num(duration.minutes / 60),
      act_start_date: instants.write(task.time.actualStart, 'start', cal),
      act_end_date: instants.write(task.time.actualFinish, 'finish', cal),
      expect_end_date: instants.write(task.p6ExpectedFinish, 'finish', cal),
      // Geplande datums = de geplande datums van OPS (`scheduleStart`/`scheduleFinish`), het omgekeerde
      // van de lezer. Niet de berekende datums (zoals de P6 XML-export): onder P6-herkomst leest de
      // lezer target_* als ondergrens, en een ALAP-taak zou dan na de rondgang anders rekenen.
      target_start_date: instants.write(task.time.scheduleStart, startSide, cal),
      target_end_date: instants.write(task.time.scheduleFinish, finishSide, cal),
      priority_type: task.priority === 500 ? 'PT_Normal' : priority[1],
      suspend_date: instants.write(task.time.stop, 'finish', cal),
      resume_date: instants.write(task.time.resume, 'start', cal),
      complete_pct: pct,
    };
    const c1 = task.constraint ? p6ConstraintToken(task.constraint) : undefined;
    if (c1) {
      row.cstr_type = c1;
      row.cstr_date = instants.write(task.constraint?.date, constraintSide(task.constraint?.type), cal);
    }
    const c2 = task.constraint2 ? p6ConstraintToken({ ...task.constraint2, hard: false }) : undefined;
    if (c2) {
      row.cstr_type2 = c2;
      row.cstr_date2 = instants.write(task.constraint2?.date, constraintSide(task.constraint2?.type), cal);
    }
    if (!XER_PRIORITY.some(([value]) => value === task.priority)) lose('priorities', 1);
    // Rekenuitvoer (bak 4) achter de gewone kolommen: P6 toont ze tot de eerste herberekening, en de
    // lezer leest ze als "Datums zoals opgeslagen", nooit als invoer.
    // Speling in uren: de berekende minuten, anders dagen × de werktijd per dag (T13).
    const workHpd = workMinutesPerDayOf(cal) / 60;
    const recorded = [
      instants.write(computedStart(task), startSide, cal),
      instants.write(computedFinish(task), finishSide, cal),
      instants.write(task.time.lateStart, startSide, cal),
      instants.write(task.time.lateFinish, finishSide, cal),
      num(task.time.totalFloatMinutes !== undefined ? task.time.totalFloatMinutes / 60 : task.time.totalFloat * workHpd),
      num(task.time.freeFloatMinutes !== undefined ? task.time.freeFloatMinutes / 60 : task.time.freeFloat * workHpd),
    ];
    taskRows.push([...TASK_COLUMNS.map(field => row[field] ?? ''), ...recorded]);
    // De eenheid van de taak en, bij een breuk, het record (T15, T21): zo leest `readXER` de maat terug.
    const taskId = taskIds.get(task.id)!;
    opsValues.push({ field: 'unit', fkId: taskId, text: taskDurationUnit(task) });
    const records = fieldRecordsJson({ [XER_DURATION_FIELDS.duration]: duration.record, [XER_DURATION_FIELDS.remaining]: remaining.record });
    if (records !== undefined) opsValues.push({ field: taskDurationUnit(task) === 'hours' ? 'exactRecords' : 'dayRecords', fkId: taskId, text: records });
    // Een taak zonder eigen werkregel erft de projectstandaard. `duration_type` draagt de effectieve regel, en de
    // lezer maakt daar een eigen regel van; deze markering zegt dat ze geërfd was (review PR #393 ronde 3, punt 2).
    const inheritedRule = effectiveWorkRule(task, project.defaultWorkRule);
    if (task.workRule === undefined && durationType === XER_DURATION_TYPE_TOKEN[inheritedRule]) {
      opsValues.push({ field: 'inheritedWorkRule', fkId: taskId, text: inheritedRule });
    }
  }

  // Verlies op taakniveau.
  lose('taskDescriptions', tasks.filter(t => t.description?.trim()).length);
  lose('activityCodes', tasks.filter(t => Object.values(t.activityCodes ?? {}).some(v => v)).length);
  lose('customFields', tasks.filter(t => Object.values(t.customFields ?? {}).some(v => v !== undefined && v !== '')).length);
  lose('externalLinks', tasks.reduce((n, t) => n + (t.externalLinks?.length ?? 0), 0));
  lose('deadlines', tasks.filter(t => t.deadline).length);
  lose('customTaskTypes', tasks.filter(t => t.customTaskTypeId).length);
  lose('taskCategories', tasks.filter(t => t.taskType && t.taskType !== 'CONSTRUCTION').length);
  lose('manualTasks', tasks.filter(t => t.manuallyScheduled).length);
  lose('elapsedDurations', tasks.filter(t => t.time.durationType === 'ELAPSEDTIME').length);
  lose('levelingDelays', tasks.filter(t => (t.levelingDelay ?? 0) !== 0 || (t.levelingDelayMinutes ?? 0) !== 0).length);
  lose('splits', countSplitTasksWithoutContour([...tasks]) + tasks.filter(t => (t.timephasedContours?.length ?? 0) > 0).length);
  lose('noteStatus', tasks.reduce((n, t) => n + (t.notes ?? []).filter(note => note.done).length, 0));
  lose('baselines', input.baselineCount ?? 0);

  // ── TASKPRED ─────────────────────────────────────────────────────────────────────────────────
  // P6 kent geen relatie met een WBS-element: een relatie die een samenvatting raakt, gaat als de
  // bladrelaties die de solver er zelf van maakt (`expandSummaryRelations`).
  const touchesSummary = (s: Sequence) => isSummaryTask(taskById.get(s.predecessorId)) || isSummaryTask(taskById.get(s.successorId));
  lose('summaryRelations', input.sequences.filter(touchesSummary).length);
  const expanded = expandSummaryRelations(tasks, [...input.sequences]).sequences;
  // De lag in uren en, voor de dagenmaat en kalendertijd, het lagrecord: dezelfde regel als de P6 XML-export
  // (`p6RelationshipLag`; T21, I7). Een lag in dagen telt in de werktijd per dag van de lagkalender, die de
  // SCHEDOPTIONS-rij hierboven ook noemt. De records gaan als één UDF op de opvolger, met de voorganger
  // en het relatietype als sleutel.
  const lagRecords = new LagRecordCollector();
  const predRows: Cells[] = [];
  let predId = 1;
  for (const seq of expanded) {
    const pred = taskById.get(seq.predecessorId);
    const succ = taskById.get(seq.successorId);
    const predTaskId = taskIds.get(seq.predecessorId);
    const succTaskId = taskIds.get(seq.successorId);
    if (!pred || !succ || !predTaskId || !succTaskId) continue;
    const { hours, record } = p6RelationshipLag(seq, taskById, effCalByTask, calendar,
      lagWorkMinutesPerDay(seq, options.lagCalendar, calendar, effCalByTask));
    lagRecords.add(seq.successorId, lagRecordKey(predTaskId, seq.type), record);
    if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) lose('percentLags', 1);
    else if (seq.lagUnit === 'ELAPSEDTIME') lose('elapsedLags', 1);
    predRows.push({
      task_pred_id: String(predId++), task_id: succTaskId, pred_task_id: predTaskId, proj_id: projId,
      pred_proj_id: projId, pred_type: XER_LINK_TYPE[seq.type], lag_hr_cnt: num(hours),
    });
  }
  for (const task of leafTasks) {
    const json = lagRecords.json(task.id);
    if (json !== undefined) opsValues.push({ field: 'lagRecords', fkId: taskIds.get(task.id)!, text: json });
  }

  // ── RSRC / RSRCRATE / UMEASURE ───────────────────────────────────────────────────────────────
  const units = [...new Set(input.resources.map(r => r.unitOfMeasure?.trim()).filter((u): u is string => !!u))];
  const unitIds = new Map(units.map((u, i) => [u, String(i + 1)]));
  const usedShortNames = new Set<string>();
  const rsrcRows: Cells[] = [];
  const rateRows: Cells[] = [];
  let rateId = 1;
  input.resources.forEach((res, index) => {
    const p6Type = resourceTypeToP6(res.type);
    if (res.type === 'CREW' || res.type === 'SUBCONTRACTOR') lose('resourceTypes', 1);
    if (res.libraryOrigin) lose('libraryLinks', 1);
    const shortName = uniqueCode(input.resourceCodes?.get(res.id) ?? res.name, P6_MAX_LENGTH.Resource.Id, usedShortNames, () => 'R', counter, codeChanges);
    const resCal = (res.calendarId && calendarById.get(res.calendarId)) || calendar;
    rsrcRows.push({
      rsrc_id: resIds.get(res.id)!, parent_rsrc_id: res.parentId ? resIds.get(res.parentId) ?? '' : '',
      clndr_id: calIds.get(resCal.id)!, rsrc_seq_num: String(index + 1),
      rsrc_name: text(clip(res.name || shortName, P6_MAX_LENGTH.Resource.Name, counter)),
      rsrc_short_name: text(shortName), def_qty_per_hr: num(res.maxUnits), cost_qty_type: 'QT_Hour',
      active_flag: 'Y', curr_id: '1', unit_id: res.unitOfMeasure ? unitIds.get(res.unitOfMeasure.trim()) ?? '' : '',
      rsrc_type: XER_RESOURCE_TYPE[p6Type], rsrc_notes: noteText(res.description ?? ''),
    });
    // Tarief en beschikbaarheid: één RSRCRATE-rij per stap; zonder stappen één rij met de vaste
    // capaciteit (`maxUnits`) als maximale inzet, ook zonder tarief (review PR #393, punt 4). P6
    // onderscheidt standaardinzet (`def_qty_per_hr`) en maximale capaciteit (`max_qty_per_hr`).
    // Materiaal: OPS kent capaciteit en inzet per DAG, XER per uur. De toewijzingen delen de dag door
    // de uren per dag (TASKRSRC hieronder); de capaciteit moet dezelfde schaal krijgen, anders is
    // 80 m³/dag op 80 m³/dag in P6 12,5 % bezet (review PR #393 ronde 2, punt C). `def_qty_per_hr`
    // blijft ongeschaald: dat leest `readXER` als `maxUnits` (de lezer blijft ongewijzigd).
    const capacityHpd = resCal.hoursPerDay > 0 ? resCal.hoursPerDay : 8;
    const capacity = (units: number) => (res.type === 'MATERIAL' ? units / capacityHpd : units);
    const steps = res.availabilitySteps ?? [];
    if (steps.length > 0) {
      // Materiaal: de stap staat per uur in P6; `OPS_CapacitySteps` bewaart per startdatum de dagwaarde en de
      // geschreven waarde, zodat `readXER` de stap per dag terugleest (`buildXerResourceCatalog`). Een
      // startdatum die twee keer voorkomt, krijgt geen record (de lezer kan de rijen niet uit elkaar houden).
      const stepRecords = new Map<string, CapacityStepRecord>();
      const repeatedDates = new Set<string>();
      for (const step of steps) {
        const date = step.from.slice(0, 10);
        const written = num(capacity(step.maxUnits));
        rateRows.push({
          rsrc_rate_id: String(rateId++), rsrc_id: resIds.get(res.id)!, max_qty_per_hr: written,
          cost_per_qty: num(res.costPerHour), start_date: `${date} 00:00`,
        });
        if (stepRecords.has(date)) repeatedDates.add(date);
        else if (written !== '') stepRecords.set(date, [step.maxUnits, Number(written)]);
      }
      for (const date of repeatedDates) stepRecords.delete(date);
      if (res.type === 'MATERIAL' && stepRecords.size > 0) {
        opsValues.push({ field: 'capacitySteps', fkId: resIds.get(res.id)!, text: capacityStepsJson(stepRecords) });
      }
    } else {
      // Vaste capaciteit: de lezer maakt van een RSRCRATE-rij een stap. De UDF `OPS_FlatCapacity` met de
      // geschreven waarde zegt `readXER` dat deze rij de vaste capaciteit is, zodat *Max. eenheden* na
      // heropenen weer de capaciteit bepaalt (review PR #393 ronde 2, punt D; `buildXerResourceCatalog`).
      const maxPerHour = num(capacity(res.maxUnits));
      rateRows.push({
        rsrc_rate_id: String(rateId++), rsrc_id: resIds.get(res.id)!, max_qty_per_hr: maxPerHour,
        cost_per_qty: num(res.costPerHour), start_date: instants.write(project.startDate, 'midnight', calendar),
      });
      opsValues.push({ field: 'flatCapacity', fkId: resIds.get(res.id)!, text: maxPerHour });
    }
  });

  // ── RSRCCURVDATA / TASKRSRC ──────────────────────────────────────────────────────────────────
  const resourceById = new Map(input.resources.map(r => [r.id, r]));
  const curveRows: Cells[] = [];
  const curveIdByKey = new Map<string, string>();
  const curveIdFor = (a: ResourceAssignment): string => {
    const values = a.curveValues ?? (a.curve && a.curve !== 'UNIFORM' ? CONTOUR_SHAPE_VALUES[CURVE_TO_SHAPE[a.curve]] : undefined);
    if (!values || isFlatCurveValues(values)) return '';
    const key = values.map(String).join(',');
    let id = curveIdByKey.get(key);
    if (!id) {
      id = String(curveIdByKey.size + 1);
      curveIdByKey.set(key, id);
      const cells: Cells = {
        curv_id: id, curv_name: text((a.curve ? P6_CURVE_TO_NAME[a.curve] : undefined) ?? `Curve ${id}`), default_flag: 'N',
      };
      values.forEach((v, i) => { cells[`pct_usage_${i}`] = num(v); });
      curveRows.push(cells);
    }
    return id;
  };
  const assignmentRows: Cells[] = [];
  let assignmentId = 1;
  for (const a of input.assignments) {
    const task = taskById.get(a.taskId);
    const res = resourceById.get(a.resourceId);
    if (!task || !res) continue;
    if (!isLeafTask(task)) { lose('summaryAssignments', 1); continue; }
    const cal = effCal(task);
    const isMaterial = res.type === 'MATERIAL';
    // Materiaal: OPS rekent per dag, XER per uur. De lezer vermenigvuldigt weer met dezelfde dag: op een
    // urentaak de werktijd per dag van de taakkalender, op een dagtaak de `hoursPerDay` van de
    // resourcekalender (`unitsPerDay` in `xerResourceAssignments.ts`).
    const materialHpd = taskDurationUnit(task) === 'hours'
      ? effHoursPerDay(cal)
      : ((res.calendarId && calendarById.get(res.calendarId)) || calendar).hoursPerDay;
    const perHour = (rate: number) => (isMaterial ? rate / (materialHpd > 0 ? materialHpd : 8) : rate);
    const planned = a.plannedUnitsPerDay ?? a.unitsPerDay;
    // Afgeleid werk = de geschreven duur × inzet: dezelfde uren als in TASK, dus voor een dagtaak werkdagen ×
    // de werktijd per dag (T14), zoals de werkregelbrug rekent.
    const written = writtenByTask.get(task.id) ?? { duration: 0, remaining: 0 };
    const targetQty = a.plannedWorkMinutes !== undefined ? a.plannedWorkMinutes / 60 : written.duration / 60 * perHour(planned);
    // Restwerk: het vastgelegde veld, anders afgeleid zoals de werkregelbrug het doet: effectieve
    // restduur × resterende inzet (`remainingWorkOf`; review PR #393, punt 5). Niet begroot − verricht:
    // zonder vastgelegd verricht werk is dat de hele begroting. Een voltooide taak heeft geen restduur.
    const remainQty = a.remainingWorkMinutes !== undefined ? a.remainingWorkMinutes / 60 : written.remaining / 60 * perHour(a.unitsPerDay);
    // Verricht werk: het vastgelegde veld, anders begroot − rest (het werk dat de voortgang al dekt).
    const actualQty = a.actualWorkMinutes !== undefined ? a.actualWorkMinutes / 60 : Math.max(0, targetQty - remainQty);
    assignmentRows.push({
      taskrsrc_id: String(assignmentId++), task_id: taskIds.get(task.id)!, proj_id: projId, cost_qty_link_flag: 'Y',
      role_id: '', rsrc_id: resIds.get(res.id)!, remain_qty: num(remainQty), target_qty: num(targetQty),
      remain_qty_per_hr: num(perHour(a.unitsPerDay)), target_qty_per_hr: num(perHour(planned)),
      act_ot_qty: '0', act_reg_qty: num(actualQty), cost_per_qty: num(res.costPerHour),
      target_start_date: instants.write(task.time.scheduleStart, 'start', cal),
      target_end_date: instants.write(task.time.scheduleFinish, 'finish', cal),
      rate_type: 'COST_PER_QTY', curv_id: curveIdFor(a), rsrc_type: XER_RESOURCE_TYPE[resourceTypeToP6(res.type)],
      cost_per_qty_source_type: 'ST_Rsrc',
    });
  }

  // ── MEMOTYPE / TASKMEMO ──────────────────────────────────────────────────────────────────────
  const memoRows: Cells[] = [];
  for (const task of leafTasks) {
    for (const note of task.notes ?? []) {
      if (!note.text.trim()) continue;
      memoRows.push({
        memo_id: String(memoRows.length + 1), task_id: taskIds.get(task.id)!, memo_type_id: '1', proj_id: projId,
        task_memo: noteText(note.text),
      });
    }
  }
  // P6 kent alleen notities op een activiteit (TASKMEMO); die van een WBS-element gaan niet mee.
  lose('summaryNotes', wbsTasks.reduce((n, t) => n + (t.notes ?? []).filter(note => note.text.trim()).length, 0));

  // ── Samenstellen ─────────────────────────────────────────────────────────────────────────────
  const tables: Table[] = [
    table('CURRTYPE', CURRTYPE_COLUMNS, [{
      curr_id: '1', decimal_digit_cnt: '2', curr_symbol: '€', decimal_symbol: '.', digit_group_symbol: ',',
      pos_curr_fmt_type: '#1.1', neg_curr_fmt_type: '(#1.1)', curr_type: 'Euro', curr_short_name: CURRENCY,
      group_digit_cnt: '3', base_exch_rate: '1',
    }]),
  ];
  if (units.length > 0) {
    tables.push(table('UMEASURE', UMEASURE_COLUMNS, units.map((u, i) => ({
      unit_id: unitIds.get(u)!, seq_num: String(i + 1), unit_abbrev: text(u), unit_name: text(u),
    }))));
  }
  if (rateRows.length > 0) tables.push(table('RSRCRATE', RSRCRATE_COLUMNS, rateRows));
  if (rsrcRows.length > 0) tables.push(table('RSRC', RSRC_COLUMNS, rsrcRows));
  const projectTable = table('PROJECT', PROJECT_COLUMNS, [projectRow]);
  tables.push({
    name: 'PROJECT',
    fields: [...PROJECT_COLUMNS, ...XER_PROJECT_PLANNING_COLUMNS],
    rows: [[...projectTable.rows[0], ...projectPlanning]],
  });
  tables.push(table('CALENDAR', CALENDAR_COLUMNS, calendarRows));
  tables.push(table('SCHEDOPTIONS', SCHEDOPTIONS_COLUMNS, [scheduleRow]));
  tables.push(table('PROJWBS', PROJWBS_COLUMNS, wbsRows));
  tables.push({ name: 'TASK', fields: [...TASK_COLUMNS, ...XER_RECORDED_OUTPUT_COLUMNS], rows: taskRows });
  if (predRows.length > 0) tables.push(table('TASKPRED', TASKPRED_COLUMNS, predRows));
  if (curveRows.length > 0) tables.push(table('RSRCCURVDATA', RSRCCURVDATA_COLUMNS, curveRows));
  if (assignmentRows.length > 0) tables.push(table('TASKRSRC', TASKRSRC_COLUMNS, assignmentRows));
  // OPS-velden (`xerOpsMarkers.ts`), zoals de P6 XML-export: de maat per taak en haar records, de
  // standaardwerkregel en de vaste capaciteit, zodat `readXER` een eigen export zo terugleest. P6 ziet
  // gewone eigen velden (tekst). De taakvelden staan er altijd; de andere alleen met een waarde.
  const usedFields = new Set(opsValues.map(value => value.field));
  const udfs = OPS_XER_UDFS.filter(udf => udf.table === 'TASK' || usedFields.has(udf.field));
  const udfTypeId = (field: XerOpsField) => String(OPS_XER_UDF_TYPE_ID[field]);
  tables.push(table('UDFTYPE', UDFTYPE_COLUMNS, udfs.map(udf => ({
    udf_type_id: udfTypeId(udf.field), table_name: udf.table, udf_type_name: `user_field_${udfTypeId(udf.field)}`,
    udf_type_label: udf.label, logical_data_type: 'FT_TEXT', super_flag: 'N',
  }))));
  tables.push(table('UDFVALUE', UDFVALUE_COLUMNS, opsValues.map(value => ({
    udf_type_id: udfTypeId(value.field), fk_id: value.fkId, proj_id: projId, udf_text: text(value.text),
  }))));
  if (memoRows.length > 0) {
    tables.push(table('MEMOTYPE', MEMOTYPE_COLUMNS, [{
      memo_type_id: '1', seq_num: '1', eps_flag: 'N', proj_flag: 'N', wbs_flag: 'N', task_flag: 'Y', memo_type: 'Notes',
    }]));
    tables.push(table('TASKMEMO', TASKMEMO_COLUMNS, memoRows));
  }

  const exportDate = input.exportDate ?? new Date().toISOString().slice(0, 10);
  const lines = [
    ['ERMHDR', XER_VERSION, exportDate, 'Project', 'admin', 'admin', 'dbxDatabaseNoName', 'Project Management', CURRENCY].join('\t'),
  ];
  for (const t of tables) {
    lines.push(`%T\t${t.name}`);
    lines.push(`%F\t${t.fields.join('\t')}`);
    for (const row of t.rows) lines.push(`%R\t${row.join('\t')}`);
  }
  lines.push('%E');
  const content = `${lines.join('\r\n')}\r\n`;

  lose('truncatedNames', counter.truncated);
  lose('changedIds', codeChanges.changed);
  const encoded = encodeWindows1252(content);
  let bytes: Uint8Array;
  let encoding: XerWriteResult['encoding'];
  if (encoded.bytes) {
    bytes = encoded.bytes;
    encoding = 'windows-1252';
  } else {
    bytes = new TextEncoder().encode(content);
    encoding = 'utf-8';
    lose('nonLatinText', encoded.unencodable);
  }
  const loss = LOSS_ORDER.filter(code => (losses.get(code) ?? 0) > 0).map(code => ({ code, count: losses.get(code)! }));
  return { text: content, bytes, encoding, loss };
}

