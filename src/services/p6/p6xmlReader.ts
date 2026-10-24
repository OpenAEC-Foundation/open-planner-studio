import { nameWithProjectCode } from '@/utils/projectCodeName';
import { P6XmlImportError } from './p6xmlErrors';
import { p6ConstraintFromCodeOrLabel } from './p6ConstraintTypes';
import { Task, TaskConstraint, ConstraintType } from '@/types/task';
import type { P6CompletePctType, P6DurationType } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { effHoursPerDay } from '@/utils/taskDuration';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment, ResourceType, ResourceCurve } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar, Holiday, WorkingException } from '@/types/calendar';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { parseInstant, localTodayIso, parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';
import { UNNAMED_HOLIDAY_NAME, UNNAMED_WORKING_EXCEPTION_NAME } from '@/services/calendarRecurrence';
import {
  OPS_DAY_MEASURE_DURATIONS_NAME, OPS_DAY_MEASURE_LAGS_NAME, OPS_EXACT_MINUTES_NAME,
  dayMeasureMinutesPerDay, lagFromRecord, lagRecordKey, normalizeKeepingDayRest, parseFieldRecords, parseLagRecords,
  readMeasure, recordHolds, type LagRecord,
} from '@/services/xmlDayMeasure';
import { normalizeImportedProgress, deriveImportedWorkRules, reconstructResourceIds } from '@/services/importNormalize';
import { flattenOrder } from '@/utils/wbs';
import { emptyMissingScheduleDates, importDateTimeOrUndefined, isoDatePrefixOrToday, parseImportedInstant, resolveMissingScheduleDates } from '@/services/importDates';
import { directChildText, toInt, toFloat } from '@/services/xmlDom';
import type { ImportResult, OpenedImport, P6XmlEmptyReason, P6XmlImportReport } from '@/services/importTypes';
import type { Baseline } from '@/types/baseline';
import { baselineTasksFromSource } from '@/services/importBaselines';
import type { CustomTaskType } from '@/types/taskType';
import type { TaskTimephasedContour } from '@/types/task';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { calendarForEngine, seedScalarBands } from '@/utils/effectiveWorkTime';
import { isFlatCurveValues, matchCurveValues, normalizeCurveValues } from '@/engine/contour/contourEngine';
import { attachContours, axisOffsetMinutes, collectContour, p6SpreadToContourPeriods } from '@/services/contourIo';
import { importedAssignmentRate, importedWorkFields } from '@/engine/work/workRuleMapping';
import { taskWorkMinutes } from '@/engine/contour/contourEngine';
import { buildRecordedTime, recordedFloatDays, type RecordedTime } from '@/engine/scheduler/recordedDates';
import {
  OPS_CUSTOM_TASK_TYPE_UDF_TITLE,
  P6_DAY_NAMES,
  OPS_DESCRIPTION_TOPIC_NAME,
  P6_LINK_TYPE,
  P6_NAME_TO_CURVE,
  isOpsInternalProjectId,
  isLegacyOpsProjectId,
} from './p6xmlWriter';
import { invertRecord } from '@/utils/collections';
import {
  DAY_TIME_ANCHOR, decodeCustomTaskType, isTaskDurationUnit, OPS_DURATION_UNIT_NAME, statusDateFromXml,
} from '@/services/xmlInterchange';
import {
  canonicalizeBands, clockToMinutes, hasNonAnchorTime, isSubDayMinutes, opsDayWithBreak,
  promoteHourCalendars, registerCalendarBands, sameBlocks,
} from '@/services/subdayIo';

// De rauwe-bandenregistry en `synth*BandsFromScalar` staan in subdayIo. P6_NAME_TO_CURVE (P6-curvenaam
// → OPS-curve) komt uit p6xmlWriter, waar beide (bewust asymmetrische) richtingen naast elkaar staan.

// P6 onderscheidt Nonlabor niet verder in Equipment/Subcontractor — zonder verdere hint komt
// Nonlabor terug als EQUIPMENT (geaccepteerd verlies).
function resourceTypeFromP6(p6Type: string): ResourceType {
  if (p6Type === 'Material') return 'MATERIAL';
  if (p6Type === 'Nonlabor') return 'EQUIPMENT';
  return 'LABOR';
}

// Dunne lokale wrappers rond de gedeelde XML-primitieven. P6 leest UITSLUITEND directe kinderen
// (anders pikt hij geneste subbomen met dezelfde tag op, bv. binnen een Relationship); die scope-keuze
// — het verschil met MSPDI's descendant-search — blijft hiermee per formaat bewaard.
function getElementText(parent: Element, tagName: string): string {
  return directChildText(parent, tagName);
}

function getElementInt(parent: Element, tagName: string, fallback = 0): number {
  return toInt(getElementText(parent, tagName), fallback);
}

function getElementFloat(parent: Element, tagName: string, fallback = 0): number {
  return toFloat(getElementText(parent, tagName), fallback);
}

/** P6-datum in DAG-modus (`2026-03-09T08:00:00` → `2026-03-09`); gedeeld met MSPDI. */
function parseP6Date(s: string): string {
  return isoDatePrefixOrToday(s);
}

/**
 * Percentage uit P6 XML → procent (0..100). Echte P6 XML schrijft een FRACTIE (0..1; Oracle-schema,
 * MPXJ `XmlProjectReader.reversePercentage` = ×100), en de eigen writer sinds 2026-10 ook (samen
 * met `<PercentCompleteType>`). Alleen een oudere OPS-export (`legacyOpsPercent`: OPS-marker en geen
 * `<PercentCompleteType>`) schreef procenten. Een waarde boven 1 kan geen fractie zijn (ander
 * programma) en blijft een procent.
 */
function p6PercentToPercent(raw: number, legacyOpsPercent: boolean): number {
  if (legacyOpsPercent || raw > 1) return raw;
  return raw * 100;
}

/** PMXML `<PercentCompleteType>`-label → XER-token (zelfde drie P6-soorten). */
const P6_XML_PERCENT_TYPE: Readonly<Record<string, P6CompletePctType>> = {
  Physical: 'CP_Phys',
  Duration: 'CP_Drtn',
  Units: 'CP_Units',
  // Scope (P6 21+): MPXJ kent het label en rekent het als Duration (`XmlProjectWriter`:
  // DURATION en SCOPE delen `getPercentageComplete`). Wij ook: de Duration-route hieronder, maar
  // eerst de eigen schemakolom `ScopePercentComplete` als die er staat.
  Scope: 'CP_Drtn',
};

/** Een getal-element, of null als het ontbreekt of leeg/`xsi:nil` is (anders dan `getElementFloat`,
 *  dat 0 teruggeeft: een ontbrekende kolom is geen 0 %). */
function optionalFloat(parent: Element, tagName: string): number | null {
  const raw = getElementText(parent, tagName).trim();
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Voortgang (procent, 0..100) van één activiteit — dezelfde lijn als de XER-lezer
 * (`xerReader.ts`, `complete_pct_type`):
 * - De status leidt: `Completed` ⇒ 100, `Not Started` ⇒ 0. Alleen een actieve taak leest een
 *   percentage. Uitzondering: een OPS-export (`writtenByOps`), waar de status niet de bron is.
 * - `<PercentCompleteType>` kiest de kolom en er is geen terugval op de kolom van een andere soort:
 *   Physical ⇒ `PhysicalPercentComplete`; Duration ⇒ `DurationPercentComplete`, zonder die kolom
 *   `1 − RemainingDuration/PlannedDuration` (zoals XER bij CP_Drtn); Units ⇒ `UnitsPercentComplete`.
 *   PMXML heeft een eigen Units-kolom; XER kent die niet en leest daar `complete_pct`.
 * - Ontbreekt de soort (eigen writer vóór 2026-10, andere tools), dan geldt Physical, net als XER
 *   bij een lege `complete_pct_type`. Een onbekend label valt terug op Duration (XER: CP_Drtn), met
 *   een waarschuwing.
 * Het getal zelf is een P6-fractie of een OPS-procent: zie `p6PercentToPercent`.
 */
function p6ActivityCompletionPercent(actEl: Element, writtenByOps: boolean): number {
  // Een OPS-export draagt de status alleen ter informatie: in OPS volgt de status uit voortgang en
  // actuals (`normalizeImportedProgress`), en een taak kan op 100 % staan met een oude status.
  const status = writtenByOps ? '' : getElementText(actEl, 'Status').trim();
  if (status === 'Completed') return 100;
  if (status === 'Not Started') return 0;
  const label = getElementText(actEl, 'PercentCompleteType').trim();
  const legacyOpsPercent = writtenByOps && !label;
  const type: P6CompletePctType = label ? P6_XML_PERCENT_TYPE[label] ?? 'CP_Drtn' : 'CP_Phys';
  if (label && !P6_XML_PERCENT_TYPE[label]) {
    console.warn(`P6-XML-import: onbekende <PercentCompleteType>-waarde '${label}' — Duration aangenomen.`);
  }
  const pct = (tag: string): number | null => {
    const raw = optionalFloat(actEl, tag);
    return raw == null ? null : p6PercentToPercent(raw, legacyOpsPercent);
  };
  if (type === 'CP_Phys') return pct('PhysicalPercentComplete') ?? 0;
  if (type === 'CP_Units') return pct('UnitsPercentComplete') ?? 0;
  const scope = label === 'Scope' ? pct('ScopePercentComplete') : null;
  if (scope != null) return scope;
  const duration = pct('DurationPercentComplete');
  if (duration != null) return duration;
  const remaining = optionalFloat(actEl, 'RemainingDuration');
  const planned = optionalFloat(actEl, 'PlannedDuration');
  return remaining != null && planned != null && planned > 0
    ? Math.max(0, Math.min(100, (1 - remaining / planned) * 100))
    : 0;
}

/** XER-tokens die OPS vóór 2026-10 in P6 XML schreef (`<Type>PR_FS</Type>`); alleen nog lezen. */
const P6_LEGACY_SEQUENCE_TYPE: Readonly<Record<string, SequenceType>> = {
  PR_FS: 'FINISH_START',
  PR_FF: 'FINISH_FINISH',
  PR_SS: 'START_START',
  PR_SF: 'START_FINISH',
};

/** PMXML-label (`Finish to Start`) én het XER-token dat oudere OPS-exports schreven (`PR_FS`). */
const SEQUENCE_TYPE_BY_P6: Partial<Record<string, SequenceType>> = {
  ...P6_LEGACY_SEQUENCE_TYPE,
  ...invertRecord(P6_LINK_TYPE),
};

/** De twee duurvelden van P6 XML, zoals de writer ze als sleutel in de records gebruikt. */
const P6_DURATION_FIELDS = { duration: 'PlannedDuration', remaining: 'RemainingDuration' } as const;

function p6HoursToDays(hours: number, hoursPerDay: number): number {
  if (hoursPerDay <= 0) hoursPerDay = 8;
  return hours / hoursPerDay;
}

/**
 * P6-constraintsoort → OPS-constraint. Echte P6 XML (PMXML) schrijft `<PrimaryConstraintType>` en
 * `<SecondaryConstraintType>` als Engels label (`Start On or After`); de eigen writer schrijft het
 * label sinds deze fix ook, maar oudere OPS-exports dragen het XER-token (`CS_MSOA`). Beide
 * schrijfwijzen worden gelezen, via de gedeelde helper `p6ConstraintFromCodeOrLabel`
 * (`p6ConstraintTypes.ts`, bron MPXJ `ConstraintTypeHelper`). De harde `Mandatory Start`/
 * `Mandatory Finish` komen terug als `MSO`/`MFO` mét `hard:true`.
 *
 * `<Primary|SecondaryConstraintType>` → OPS-constraint. Leeg ⇒ `undefined` (ASAP). Een onbekende
 * waarde ⇒ `undefined` mét waarschuwing, zodat een vreemd label zichtbaar blijft (zoals bij
 * `<DurationType>`).
 */
function p6ConstraintFromXml(raw: string, tag: string): { type: ConstraintType; hard?: boolean } | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  // Eigen sleutel (in de helper): een waarde als `toString` of `__proto__` raakt geen prototype-sleutel.
  const known = p6ConstraintFromCodeOrLabel(value);
  if (known) return known;
  console.warn(`P6-XML-import: onbekende <${tag}>-waarde '${value}' — constraint blijft afwezig.`);
  return undefined;
}

// P6-XML (PMXML) draagt `<DurationType>` als Engels label, niet als het XER-token
// (`DT_FixedDrtn`/`DT_FixedDUR2`/`DT_FixedRate`/`DT_FixedQty`) — zelfde vier canonieke P6-waarden,
// andere schrijfwijze. Labels geverifieerd tegen MPXJ `DurationTypeHelper` en Oracle's
// PMXML-schemadocumentatie. Oracle's XER-datamap (P6 EPPM XER Import/Export Data Map Guide,
// TASK.duration_type): DT_FixedDrtn = "Fixed Duration and Units/Time", DT_FixedDUR2 = "Fixed Duration
// and Units", DT_FixedQty = "Fixed Units", DT_FixedRate = "Fixed Units/Time" — dezelfde paren als
// `workRuleMapping.ts` (`XER_DURATION_TYPE_TOKEN` ↔ `P6_DURATION_TYPE_NAME`). Valkuil: de twee
// Fixed-Duration-labels worden makkelijk verwisseld.
const P6_XML_DURATION_TYPE_BY_LABEL: Readonly<Record<string, P6DurationType>> = {
  'Fixed Duration and Units': 'DT_FixedDUR2',
  'Fixed Duration and Units/Time': 'DT_FixedDrtn',
  'Fixed Units/Time': 'DT_FixedRate',
  'Fixed Units': 'DT_FixedQty',
};

/**
 * `<DurationType>` → `p6DurationType`, dat via `deriveImportedWorkRules` de werkregel voedt (net als
 * bij de XER-lezer). Onbekend/leeg label ⇒ veld AFWEZIG, nooit een aanname; de onbekende waarde wordt
 * gerapporteerd zodat een vreemd PMXML-label zichtbaar blijft.
 */
function p6DurationTypeFromXml(raw: string): P6DurationType | undefined {
  const label = raw.trim();
  if (!label) return undefined;
  const known = P6_XML_DURATION_TYPE_BY_LABEL[label];
  if (known) return known;
  console.warn(`P6-XML-import: onbekende <DurationType>-waarde '${label}' — p6DurationType blijft afwezig.`);
  return undefined;
}

/** Werkweek teruglezen (spiegel van `writeStandardWorkWeek`): per `<StandardWorkHours>` (echte P6)
 *  of `<StandardWorkHour>` (eigen writer) de dagnaam terugmappen naar een ISO-dagnummer via
 *  `P6_DAY_NAMES`; een dag telt als werkdag zodra hij een `<WorkTime>`-blok heeft.
 *  `workStartHour`/`workEndHour` komen van de LAATST gevonden werkdag: begin van het eerste blok,
 *  einde van het laatste blok (één scalar per kalender). Golden rule: geen `<StandardWorkWeek>`
 *  (ander tool / oud bestand) ⇒ lege workDays, de aanroeper valt terug op de
 *  `createDefaultCalendar()`-defaults. */
export function parseP6StandardWorkWeek(calEl: Element, alwaysLastMinute = false): {
  workDays: number[]; workStartHour?: number; workEndHour?: number;
  rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>>;
} {
  const wwEl = calEl.getElementsByTagName('StandardWorkWeek')[0];
  const workDays: number[] = [];
  let workStartHour: number | undefined;
  let workEndHour: number | undefined;
  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  if (!wwEl) return { workDays, rawByWeekday };

  for (let i = 0; i < wwEl.children.length; i++) {
    const dayEl = wwEl.children[i];
    // Oracle-schema (en MPXJ): `<StandardWorkHours>`; de eigen writer schrijft `<StandardWorkHour>`.
    // Beide lezen, anders valt elke echte P6-werkweek terug op de standaardkalender.
    if (dayEl.localName !== 'StandardWorkHours' && dayEl.localName !== 'StandardWorkHour') continue;
    const dayName = getElementText(dayEl, 'DayOfWeek');
    const isoDay = P6_DAY_NAMES.indexOf(dayName); // index == ISO-dagnummer (array begint met '' op 0)
    // ALLE <WorkTime>-banden van deze dag lezen; elke band → minuten-vanaf-middernacht.
    const wts = dayEl.getElementsByTagName('WorkTime');
    const dayBands: { start: number; end: number }[] = [];
    for (let k = 0; k < wts.length; k++) {
      const wt = wts[k];
      const s = clockToMinutes(getElementText(wt, 'Start'));
      const e = p6FinishClockToMinutes(getElementText(wt, 'Finish'), alwaysLastMinute);
      if (s == null || e == null) continue;
      dayBands.push({ start: s, end: e });
    }
    if (dayBands.length === 0 || isoDay <= 0) continue;
    // Scalar voor het dag-pad: begin van het eerste en einde van het laatste blok van de laatst
    // gevonden werkdag (08:00–12:00 + 13:00–17:00 ⇒ 8–17, niet alleen het middagblok 13–17).
    workStartHour = Math.floor(dayBands[0].start / 60);
    workEndHour = Math.floor(dayBands[dayBands.length - 1].end / 60);
    workDays.push(isoDay);
    rawByWeekday[isoDay as 1] = dayBands;
  }
  return { workDays, workStartHour, workEndHour, rawByWeekday };
}

/** Canonicaliseer de rauwe banden en registreer ze + de afwijking (a/b) op de kalender.
 *
 *  Dagkalender met pauze uit een eigen export (`writtenByOps`): de writer zet de effectieve blokken van
 *  een dagkalender (`effectiveWorkTimeBands`, met de pauze) op elke werkdag. Die twee blokken zijn dan
 *  geen afwijking: de kalender blijft een dagkalender, met begin, einde en uren per dag op de minuut, en
 *  de pauzevelden als de afleiding zonder pauzevelden (`seedScalarBands`) andere blokken geeft. Zoals de
 *  MSPDI-lezer (`applyCalendarBody`). Alleen als de netto blokken gelijk zijn aan `HoursPerDay` uit het
 *  bestand: anders kan de dagkalender de blokken niet dragen, en blijft het een uurkalender. */
function registerP6Bands(
  cal: WorkCalendar,
  rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>>,
  writtenByOps: boolean,
  fileHoursPerDay: number,
): void {
  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  const dayWithBreak = writtenByOps ? opsDayWithBreak(bands) : undefined;
  const netHours = dayWithBreak
    ? ((dayWithBreak[0].end - dayWithBreak[0].start) + (dayWithBreak[1].end - dayWithBreak[1].start)) / 60
    : undefined;
  const keepDay = dayWithBreak !== undefined && netHours !== undefined
    && (fileHoursPerDay <= 0 || Math.abs(fileHoursPerDay - netHours) < 1e-9);
  if (keepDay) {
    const [first, second] = dayWithBreak;
    cal.workStartHour = first.start / 60;
    cal.workEndHour = second.end / 60;
    cal.hoursPerDay = netHours;
    if (!sameBlocks(seedScalarBands(first.start, second.end, netHours), dayWithBreak)) {
      cal.simpleBreakStartMinute = first.end;
      cal.simpleBreakDurationMinutes = second.start - first.end;
    }
  }
  registerCalendarBands(cal, { canonical: bands, deviates: deviates && !keepDay });
}

/** Feestdagen/exceptions teruglezen (spiegel van `writeHolidayOrExceptions`).
 *
 *  Echte P6 XML gebruikt `<HolidayOrException>` voor BEIDE soorten uitzondering (Oracle-schema,
 *  MPXJ `XmlReaderHelper`): zonder `<WorkTime>`-blok met tijden is de dag niet-werkend; mét zulke
 *  blokken werkt de dag op precies die tijden (een werkende zaterdag, een korte dag). Eén blok
 *  00:00–23:59 is in P6 een niet-werkende dag. De eigen writer schrijft alleen feestdagen. */
function parseP6HolidayOrExceptions(calEl: Element, alwaysLastMinute = false): { holidays: Holiday[]; workingExceptions: WorkingException[] } {
  const holidays: Holiday[] = [];
  const workingExceptions: WorkingException[] = [];
  const hoEl = calEl.getElementsByTagName('HolidayOrExceptions')[0];
  if (!hoEl) return { holidays, workingExceptions };
  for (let i = 0; i < hoEl.children.length; i++) {
    const hEl = hoEl.children[i];
    if (hEl.localName !== 'HolidayOrException' && hEl.tagName !== 'HolidayOrException') continue;
    const date = getElementText(hEl, 'Date');
    if (!date) continue;
    const finishDate = getElementText(hEl, 'FinishDate') || date;
    const startDate = parseP6Date(date);
    const endDate = parseP6Date(finishDate);
    const bands: { start: number; end: number }[] = [];
    for (const wt of directChildrenByLocalName(hEl, 'WorkTime')) {
      const s = clockToMinutes(getElementText(wt, 'Start'));
      const e = p6FinishClockToMinutes(getElementText(wt, 'Finish'), alwaysLastMinute);
      if (s == null || e == null) continue;
      bands.push({ start: s, end: e <= s ? e + 1440 : e });
    }
    const wholeDayOff = bands.length === 1 && bands[0].start === 0 && bands[0].end === 1440;
    if (bands.length === 0 || wholeDayOff) {
      holidays.push({ name: getElementText(hEl, 'Name') || UNNAMED_HOLIDAY_NAME, startDate, endDate });
    } else {
      bands.sort((a, b) => a.start - b.start);
      // Aansluitende blokken samenvoegen: de writer splitst een werkdag van 24 uur in twee blokken,
      // omdat één blok 00:00–23:59 in P6 een vrije dag is.
      for (let k = bands.length - 1; k > 0; k--) {
        if (bands[k].start <= bands[k - 1].end) {
          bands[k - 1] = { start: bands[k - 1].start, end: Math.max(bands[k - 1].end, bands[k].end) };
          bands.splice(k, 1);
        }
      }
      workingExceptions.push({ name: getElementText(hEl, 'Name') || UNNAMED_WORKING_EXCEPTION_NAME, startDate, endDate, bands });
    }
  }
  return { holidays, workingExceptions };
}

/**
 * P6 schrijft het einde van een werktijdblok als de LAATSTE minuut ervan: 08:00–16:00 staat als
 * `<Finish>15:59:00</Finish>`, 07:30–16:30 als `16:29:00`. MPXJ (`XmlReaderHelper.getEndTime`) telt
 * bij elke eindtijd één minuut op. Sommige tools (Aspose, oudere OPS-exports) schrijven het exacte
 * einde (`16:00:00`). De regel geldt daarom per bestand (`p6FinishUsesLastMinute`):
 * - `lastMinute` ⇒ elke eindtijd +1 minuut (zoals MPXJ);
 * - anders blijft de eindtijd exact; alleen `23:59` is dan het einde van de dag (00:00–23:59 = hele dag).
 */
function p6FinishClockToMinutes(clock: string, lastMinute = false): number | null {
  const minutes = clockToMinutes(clock);
  if (minutes == null) return null;
  return lastMinute || minutes === 1439 ? minutes + 1 : minutes;
}

/**
 * Schrijft dit bestand eindtijden als laatste minuut (P6-vorm)? Ja als:
 * - het een OPS-export is met `<StandardWorkHours>` (writer sinds 2026-10: altijd einde − 1), of
 * - één eindtijd van een werktijdblok (behalve 23:59) niet op een veelvoud van 5 minuten valt
 *   (`15:59`, `16:29`, `11:44`): dat schrijft alleen de P6-vorm.
 * Een bestand met alleen exacte tijden (`16:00`, `16:30`) houdt ze exact.
 */
export function p6FinishUsesLastMinute(root: Element, writtenByOps: boolean): boolean {
  if (writtenByOps && root.getElementsByTagName('StandardWorkHours').length > 0) return true;
  const finishes = root.getElementsByTagName('Finish');
  for (let i = 0; i < finishes.length; i++) {
    const el = finishes[i];
    if (el.parentElement?.localName !== 'WorkTime') continue;
    const minutes = clockToMinutes(el.textContent?.trim() ?? '');
    if (minutes == null || minutes === 1439) continue;
    if (minutes % 5 !== 0) return true;
  }
  return false;
}

/**
 * P6 schrijft een uitzondering per DATUM; een bouwvak van drie weken staat er als vijftien losse
 * dagen. Voeg aansluitende dagen weer samen tot één reeks, maar alleen als dat niets verandert:
 * de volgende dag begint precies één kalenderdag na het einde, met dezelfde naam en (bij een
 * werkende uitzondering) dezelfde werktijd. Elke dag van de reeks blijft dus even vrij of werkend.
 */
function mergeConsecutiveDays<T extends { name: string; startDate: string; endDate: string; bands?: { start: number; end: number }[] }>(items: readonly T[]): T[] {
  const sorted = [...items].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const out: T[] = [];
  for (const item of sorted) {
    const last = out[out.length - 1];
    const lastEnd = last ? last.endDate || last.startDate : '';
    if (last && last.name === item.name && JSON.stringify(last.bands) === JSON.stringify(item.bands)
      && formatDate(addCalendarDays(parseDate(lastEnd), 1)) === item.startDate) {
      out[out.length - 1] = { ...last, endDate: item.endDate || item.startDate };
    } else {
      out.push({ ...item });
    }
  }
  return out;
}

function directChildrenByLocalName(parent: Element, localName: string): Element[] {
  const results: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === localName) results.push(child);
  }
  return results;
}

/**
 * Het project dat de lezer inleest, plus de plek waar zijn objecten staan.
 *
 * Echte P6 XML (PMXML, Oracle-schema) zet projectobjecten BINNEN het project:
 * `<APIBusinessObjects><Project>…<WBS/><Activity/><Relationship/><ResourceAssignment/>…</Project>`.
 * Globale objecten (kalenders, resources, tarieven, UDF-typen, curves) staan op het hoogste niveau;
 * een project kan daarnaast eigen kalenders binnen `<Project>` dragen. De eigen writer
 * (`p6xmlWriter`) zet alles plat op het hoogste niveau, met `<ProjectObjectId>1</ProjectObjectId>`.
 * `scopedElements` leest beide vormen. `<BaselineProject>` wordt nooit gelezen.
 */
interface P6XmlScope {
  root: Element;
  /** Het gekozen `<Project>`, of null als het bestand er geen heeft. */
  project: Element | null;
  /** `<ObjectId>` van het gekozen project; null als het ontbreekt (dan geen filter). */
  projectObjectId: number | null;
  /** Mag een plat projectobject ZONDER `ProjectObjectId` bij dit project horen? Alleen als het het
   *  enige `<Project>` van het bestand is (of er geen is). Anders hoort zo'n object bij geen enkel
   *  project; `readAllP6XmlProjects` telt de activiteiten in het verslag. */
  ownsUnassigned: boolean;
}

/** Objecten die bij één project horen. Globale objecten (kalenders, UDF-typen, notitieonderwerpen)
 *  hebben geen `ProjectObjectId` en horen bij elk project. */
const PROJECT_OBJECT_TAGS = new Set(['WBS', 'Activity', 'Relationship', 'ResourceAssignment', 'ActivityNote', 'UDFValue']);

/** Elementen van één soort voor het gekozen project: eerst de directe kinderen van het hoogste
 *  niveau (platte vorm en globale objecten), dan die binnen het gekozen `<Project>`. Een plat element
 *  met een `<ProjectObjectId>` van een ANDER project valt weg. */
function scopedElements(scope: P6XmlScope, localName: string): Element[] {
  const results: Element[] = [];
  for (const el of directChildrenByLocalName(scope.root, localName)) {
    const owner = getElementInt(el, 'ProjectObjectId', -1);
    if (owner >= 0 && scope.projectObjectId != null && owner !== scope.projectObjectId) continue;
    if (owner < 0 && !scope.ownsUnassigned && PROJECT_OBJECT_TAGS.has(localName)) continue;
    results.push(el);
  }
  if (scope.project) results.push(...directChildrenByLocalName(scope.project, localName));
  return results;
}

function scopeOf(root: Element, project: Element | null): P6XmlScope {
  const objId = project ? getElementInt(project, 'ObjectId', -1) : -1;
  const ownsUnassigned = !project
    || (project.localName === 'Project' && directChildrenByLocalName(root, 'Project').length === 1);
  return { root, project, projectObjectId: objId >= 0 ? objId : null, ownsUnassigned };
}

function hasActivities(scope: P6XmlScope): boolean {
  return scopedElements(scope, 'Activity').length > 0;
}

function parseP6XmlDocument(content: string): Element {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');

  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Invalid XML: ' + parserError.textContent);
  }
  return doc.documentElement;
}

/** Wat het lezen van één project oplevert naast het `ImportResult` zelf (voor het verslag). */
interface P6XmlProjectRead {
  result: ImportResult;
  /** Relaties waarvan een kant in een ander project ligt (`Predecessor/SuccessorProjectObjectId`),
   *  als sleutel (ObjectId, anders voorganger→opvolger): dezelfde relatie in twee projecten telt één keer. */
  crossProjectRelations: Set<string>;
  /** Ingelezen activiteiten (zonder WBS-samenvattingen). */
  activitiesRead: number;
}

/**
 * Waarom er geen enkele activiteit leesbaar is, als dat eenvoudig te zien is. Twee vormen uit het
 * corpus die op P6 XML lijken maar het niet zijn: activiteiten zonder `<ObjectId>` (relaties en WBS
 * zijn dan niet te koppelen) en activiteiten met XER-kolomnamen (`task_code`, `task_name`).
 */
function emptyReasonOf(root: Element): P6XmlEmptyReason {
  const activities: Element[] = [];
  for (const project of directChildrenByLocalName(root, 'Project')) {
    activities.push(...directChildrenByLocalName(project, 'Activity'));
  }
  activities.push(...directChildrenByLocalName(root, 'Activity'));
  if (activities.length === 0) return 'no-activities';
  if (activities.some(el => directChildrenByLocalName(el, 'task_code').length > 0
    || directChildrenByLocalName(el, 'task_name').length > 0)) return 'xer-columns';
  return 'no-object-ids';
}

/**
 * Lees een P6 XML-bestand zoals de open-pijplijn het opent — dezelfde lijn als XER
 * (`xerMultiProject.ts`):
 * - elk `<Project>` MET activiteiten wordt een eigen document; lege projecten worden overgeslagen.
 *   Heeft geen enkel project activiteiten, dan opent het eerste (leeg, met melding);
 * - elk `<BaselineProject>` wordt een baseline van zijn eigenaar (`OriginalProjectObjectId`); de
 *   baseline waar het project naar wijst (`CurrentBaselineProjectObjectId`) wordt de actieve.
 *   XER kent alleen die ene (`sum_base_proj_id`); PMXML noemt elke baseline expliciet;
 * - een relatie tussen twee projecten wordt geen relatie (XER: nooit solverinvoer). Het verslag telt ze;
 * - het actieve document is het document met de meeste activiteiten (XER: meeste bladtaken).
 * Eén document ⇒ een gewoon `ImportResult`, meer ⇒ een `MultiDocumentImport`.
 */
export function readP6XMLDocuments(content: string): OpenedImport {
  const results = readAllP6XmlProjects(content, true);
  if (results.length === 1) return results[0];
  let active = 0;
  results.forEach((result, i) => {
    if (leafCount(result) > leafCount(results[active])) active = i;
  });
  return { kind: 'multi-document', results, activeDocumentIndex: active };
}

/**
 * TESTHULP. Lees één P6 XML-bestand als één project: het eerste project mét activiteiten, met zijn
 * baselines. Gooit niet bij een leeg bestand (dan een leeg resultaat). Geen appcode gebruikt dit:
 * de open-pijplijn gebruikt `readP6XMLDocuments` (meerdere documenten, `P6XmlImportError`).
 */
export function readP6XML(content: string): ImportResult {
  return readAllP6XmlProjects(content)[0];
}

function leafCount(result: ImportResult): number {
  return result.tasks.filter(t => t.childIds.length === 0).length;
}

/** Alle documenten van het bestand, in bestandsvolgorde, elk met baselines en hetzelfde verslag. */
function readAllP6XmlProjects(content: string, throwWhenEmpty = false): ImportResult[] {
  const root = parseP6XmlDocument(content);
  const projects = directChildrenByLocalName(root, 'Project');
  const nonEmpty = projects.map(project => scopeOf(root, project)).filter(hasActivities);
  const scopes = nonEmpty.length > 0 ? nonEmpty : [scopeOf(root, projects[0] ?? null)];
  const reads = scopes.map(readP6XmlProject);

  const baselineElements = directChildrenByLocalName(root, 'BaselineProject');
  let baselinesMaterialized = 0;
  // Losse baselineverwijzingen (zoals XER `danglingBaselineReferences`): een `<BaselineProject>` waarvan
  // de eigenaar niet als document opent (niet in het bestand, of leeg), en een
  // `CurrentBaselineProjectObjectId` die naar geen `<BaselineProject>` in het bestand wijst.
  const usedBaselines = new Set<Element>();
  let danglingBaselineReferences = 0;
  reads.forEach((read, i) => {
    const owner = scopes[i];
    if (owner.projectObjectId == null || !owner.project) return;
    const currentObjId = getElementInt(owner.project, 'CurrentBaselineProjectObjectId', -1);
    if (currentObjId >= 0 && !baselineElements.some(el => getElementInt(el, 'ObjectId', -1) === currentObjId)) {
      danglingBaselineReferences++;
    }
    const own = baselineElements.filter(el => getElementInt(el, 'OriginalProjectObjectId', -1) === owner.projectObjectId);
    if (own.length === 0) return;
    own.forEach(el => usedBaselines.add(el));
    const baselines = own.map(el => p6BaselineFrom(root, el, owner.projectObjectId!, read.result));
    read.result.baselines = [...(read.result.baselines ?? []), ...baselines];
    read.result.activeBaselineId = baselines.find(b => b.sourceProjectId === String(currentObjId))?.id ?? null;
    baselinesMaterialized += baselines.length;
  });
  danglingBaselineReferences += baselineElements.filter(el => !usedBaselines.has(el)).length;
  // Platte activiteiten zonder `ProjectObjectId` in een bestand met meerdere projecten: bij geen
  // enkel project ingelezen (`P6XmlScope.ownsUnassigned`), wel geteld.
  const unassignedActivities = projects.length > 1
    ? directChildrenByLocalName(root, 'Activity').filter(el => getElementInt(el, 'ProjectObjectId', -1) < 0).length
    : 0;

  const crossProjectRelations = new Set(reads.flatMap(read => [...read.crossProjectRelations]));
  const anyActivity = reads.some(read => read.activitiesRead > 0);
  const report: P6XmlImportReport = {
    projectsSeen: projects.length,
    documentsOpened: reads.length,
    emptyProjectsSkipped: nonEmpty.length > 0 ? projects.length - nonEmpty.length : 0,
    baselinesMaterialized,
    crossProjectRelations: crossProjectRelations.size,
    danglingBaselineReferences,
    unassignedActivities,
  };
  // Geen enkele leesbare activiteit: de import mislukt, zoals een lege XER (`XER_EMPTY_PROJECT`).
  // Geen leeg tabblad; de melding draagt de reden (`importFailureNotice` in fileSlice).
  if (!anyActivity && throwWhenEmpty) throw new P6XmlImportError(emptyReasonOf(root));
  for (const read of reads) read.result.p6xmlReport = { ...report };
  return reads.map(read => read.result);
}

/** Eén `<BaselineProject>` → baseline van het eigenaarproject (gedeelde regel `baselineTasksFromSource`). */
function p6BaselineFrom(root: Element, el: Element, ownerObjId: number, owner: ImportResult): Baseline {
  const objId = getElementInt(el, 'ObjectId', -1);
  const source = readP6XmlProject(scopeOf(root, el)).result;
  const { tasks, projectEnd } = baselineTasksFromSource(owner.tasks, source.tasks);
  const name = getElementText(el, 'Name');
  const code = getElementText(el, 'Id');
  return {
    id: `p6xml-baseline:${ownerObjId}:${objId}`,
    sourceProjectId: String(objId),
    name: p6ProjectName(name, code) || String(objId),
    createdAt: getElementText(el, 'LastBaselineUpdateDate') || owner.project.modifiedAt || owner.project.createdAt,
    tasks,
    projectEnd,
    projectDuration: 0,
  };
}

function readP6XmlProject(scope: P6XmlScope): P6XmlProjectRead {
  // De eigen writer schrijft altijd de OPS-duur-UDF-definitie: zo herkennen we een OPS-export. Dat
  // stuurt twee schaalkeuzes: eindtijden van werktijdblokken en het voortgangspercentage.
  const durationUnitUdfIds = new Set<number>();
  for (const udfType of scopedElements(scope, 'UDFType')) {
    if (getElementText(udfType, 'SubjectArea') !== 'Activity') continue;
    if (getElementText(udfType, 'DataType') !== 'Text') continue;
    if (getElementText(udfType, 'Title') !== OPS_DURATION_UNIT_NAME) continue;
    const objectId = getElementInt(udfType, 'ObjectId', -1);
    if (objectId >= 0) durationUnitUdfIds.add(objectId);
  }
  const writtenByOps = durationUnitUdfIds.size > 0;
  // De maatrecords (T21, T14; `xmlDayMeasure.ts`): Activity-Text-UDF's met een OPS-titel. De definitie van
  // `OPS_DayMeasureDurations` zegt ook dat de writer de dagenmaat in de werktijd per dag schreef (T13);
  // zonder die definitie (OPS tot en met F5a-1) telt een dag de opgeslagen `HoursPerDay`.
  const recordUdfIds = (title: string): Set<number> => new Set(scopedElements(scope, 'UDFType')
    .filter(el => getElementText(el, 'SubjectArea') === 'Activity' && getElementText(el, 'DataType') === 'Text'
      && getElementText(el, 'Title') === title)
    .map(el => getElementInt(el, 'ObjectId', -1))
    .filter(id => id >= 0));
  const dayMeasureDurationUdfIds = recordUdfIds(OPS_DAY_MEASURE_DURATIONS_NAME);
  const exactMinutesUdfIds = recordUdfIds(OPS_EXACT_MINUTES_NAME);
  const dayMeasureLagUdfIds = recordUdfIds(OPS_DAY_MEASURE_LAGS_NAME);
  const workdayIsWorkTime = dayMeasureDurationUdfIds.size > 0;
  const lastMinute = p6FinishUsesLastMinute(scope.root, writtenByOps);

  // Projectkalender: de kalender die het project als standaard voor activiteiten aanwijst
  // (`<ActivityDefaultCalendarObjectId>`), anders de eerste <Calendar> (de eigen writer zet de
  // projectkalender altijd eerst, met ObjectId 1).
  const calElements = scopedElements(scope, 'Calendar');
  const defaultCalObjId = scope.project ? getElementInt(scope.project, 'ActivityDefaultCalendarObjectId', -1) : -1;
  const projectCalEl = calElements.find(el => defaultCalObjId >= 0 && getElementInt(el, 'ObjectId', -1) === defaultCalObjId)
    ?? calElements[0];
  const calendar = projectCalEl ? readP6Calendar(projectCalEl, lastMinute, writtenByOps) : createDefaultCalendar();
  // Een eigen, geldige `HoursPerDay` per kalender; hij gaat na de uur-promotie terug (zie daar).
  const fileHoursPerDay = new Map<WorkCalendar, number>();
  const noteFileHoursPerDay = (cal: WorkCalendar, calEl: Element): void => {
    const fileHpd = getElementFloat(calEl, 'HoursPerDay');
    if (fileHpd > 0) fileHoursPerDay.set(cal, fileHpd);
  };
  if (projectCalEl) noteFileHoursPerDay(calendar, projectCalEl);
  const projectCalObjId = projectCalEl ? getElementInt(projectCalEl, 'ObjectId', -1) : -1;

  // Bibliotheekkalenders (taak- en resourcekalenders): elke andere <Calendar> met Type=Resource
  // (zo schrijft de eigen writer ze), plus elke andere kalender waar een activiteit of resource van
  // dit project naar verwijst (echte P6: Global-/Project-kalenders). Ongebruikte globale kalenders
  // blijven weg.
  const activityElements = scopedElements(scope, 'Activity');
  const resourceElements = scopedElements(scope, 'Resource');
  const referencedCalObjIds = new Set<number>(
    [...activityElements, ...resourceElements].map(el => getElementInt(el, 'CalendarObjectId', -1)),
  );
  const calObjIdToId = new Map<number, string>();
  const resourceCalendars: WorkCalendar[] = [];
  for (const calEl of calElements) {
    if (calEl === projectCalEl) continue;
    const objId = getElementInt(calEl, 'ObjectId', -1);
    if (objId < 0 || objId === projectCalObjId || calObjIdToId.has(objId)) continue;
    if (getElementText(calEl, 'Type') !== 'Resource' && !referencedCalObjIds.has(objId)) continue;
    const cal = readP6Calendar(calEl, lastMinute, writtenByOps);
    noteFileHoursPerDay(cal, calEl);
    cal.id = generateId('rescal');
    calObjIdToId.set(objId, cal.id);
    resourceCalendars.push(cal);
  }

  // Resources
  const resources: Resource[] = [];
  const resObjIdToId = new Map<number, string>();
  const pendingParents: { resId: string; parentObjId: number }[] = [];

  for (const resEl of resourceElements) {
    const objId = getElementInt(resEl, 'ObjectId', -1);
    if (objId < 0) continue;
    const id = generateId('res');
    resObjIdToId.set(objId, id);

    const name = getElementText(resEl, 'Name') || 'Resource';
    const p6Type = getElementText(resEl, 'ResourceType');
    const maxUnitsPerTime = getElementFloat(resEl, 'MaxUnitsPerTime');
    const calObjId = getElementInt(resEl, 'CalendarObjectId', -1);
    const unitOfMeasure = getElementText(resEl, 'UnitOfMeasureAbbreviation');
    const parentObjId = getElementInt(resEl, 'ParentObjectId', -1);

    const resource: Resource = {
      id,
      name,
      type: resourceTypeFromP6(p6Type),
      description: '',
      // MaxUnitsPerTime is in P6-XML een dimensieloze fractie (1.0 = 100%), geen uren/dag (zie
      // p6xmlWriter), dus 1:1 overnemen.
      maxUnits: maxUnitsPerTime > 0 ? maxUnitsPerTime : 1,
    };
    if (unitOfMeasure) resource.unitOfMeasure = unitOfMeasure;
    if (calObjId >= 0 && calObjIdToId.has(calObjId)) resource.calendarId = calObjIdToId.get(calObjId);
    resources.push(resource);
    if (parentObjId >= 0) pendingParents.push({ resId: id, parentObjId });
  }
  for (const { resId, parentObjId } of pendingParents) {
    const parentId = resObjIdToId.get(parentObjId);
    if (!parentId) continue;
    const resource = resources.find(r => r.id === resId);
    if (resource) resource.parentId = parentId;
  }

  // ResourceRates: top-level <ResourceRate>-elementen (siblings van <Resource>, spiegel van
  // p6xmlWriter) — PricePerUnit is het uurtarief. Bij meerdere rijen per resource (effective-dated
  // staffel, P6-native) wint de rij met de vroegste EffectiveDate als ons ene vlakke `costPerHour`.
  const rateElements = scopedElements(scope, 'ResourceRate');
  const earliestRate = new Map<string, { effective: string; price: number }>();
  for (const rateEl of rateElements) {
    const rateResObjId = getElementInt(rateEl, 'ResourceObjectId', -1);
    const resId = resObjIdToId.get(rateResObjId);
    if (!resId) continue;
    const priceText = getElementText(rateEl, 'PricePerUnit');
    const price = parseFloat(priceText);
    if (!priceText || !Number.isFinite(price)) continue;
    const effective = getElementText(rateEl, 'EffectiveDate'); // '' sorteert vóór elke datum
    const current = earliestRate.get(resId);
    if (!current || effective < current.effective) {
      earliestRate.set(resId, { effective, price });
    }
  }
  for (const [resId, rate] of earliestRate) {
    const resource = resources.find(r => r.id === resId);
    if (resource) resource.costPerHour = rate.price;
  }

  // Parse project
  const project = parseProject(scope.project);
  // Ontbrekende geplande datums (gedeelde regel `resolveMissingScheduleDates`, vóór de voortgang-
  // invarianten). Zonder <PlannedStartDate> op het project dragen ook de WBS-samenvattingen (die op
  // de projectstart worden aangemaakt) de vandaag-plaatshouder — die tellen dan mee als ontbrekend.
  const projEl = scope.project;
  const projectStartRaw = projEl ? getElementText(projEl, 'PlannedStartDate') : '';
  const missingDates = emptyMissingScheduleDates();

  // Parse WBS elements
  const wbsElements = scopedElements(scope, 'WBS');
  const wbsObjIdToId = new Map<number, string>();
  const wbsTasks: Task[] = [];

  for (const wbsEl of wbsElements) {
    const objId = getElementInt(wbsEl, 'ObjectId', -1);
    if (objId < 0) continue;

    const id = generateId('task');
    wbsObjIdToId.set(objId, id);

    const code = getElementText(wbsEl, 'Code');
    const name = getElementText(wbsEl, 'Name') || 'WBS';

    wbsTasks.push({
      id,
      name,
      description: '',
      wbsCode: code,
      taskType: 'CONSTRUCTION',
      status: 'NOT_STARTED',
      isMilestone: false,
      priority: 500,
      parentId: null, // resolved later
      childIds: [],
      time: createDefaultTaskTime(project.startDate, 0),
      resourceIds: [],
    });
    if (!projectStartRaw) { missingDates.start.add(id); missingDates.finish.add(id); }
  }

  // Broer/zus-volgorde uit `SequenceNumber` (de writer schrijft hem, dus de lezer honoreert hem).
  // Stabiele sortering; zonder het element blijft de documentvolgorde gelden. `flattenOrder` leest de
  // kindvolgorde uit de array-volgorde.
  const seqNrByObjId = new Map<number, number>();
  for (const wbsEl of wbsElements) {
    const objId = getElementInt(wbsEl, 'ObjectId', -1);
    const raw = getElementText(wbsEl, 'SequenceNumber');
    if (objId >= 0 && raw) { const n = toInt(raw, NaN); if (Number.isFinite(n)) seqNrByObjId.set(objId, n); }
  }
  if (seqNrByObjId.size > 0) {
    const idToObjId = new Map<string, number>([...wbsObjIdToId].map(([o, id]) => [id, o]));
    const indexOf = new Map(wbsTasks.map((t, i) => [t.id, i]));
    wbsTasks.sort((a, b) => {
      const sa = seqNrByObjId.get(idToObjId.get(a.id)!);
      const sb = seqNrByObjId.get(idToObjId.get(b.id)!);
      if (sa !== undefined && sb !== undefined && sa !== sb) return sa - sb;
      return indexOf.get(a.id)! - indexOf.get(b.id)!;
    });
  }

  // Resolve WBS parent-child
  for (const wbsEl of wbsElements) {
    const objId = getElementInt(wbsEl, 'ObjectId', -1);
    const parentObjId = getElementInt(wbsEl, 'ParentObjectId', -1);
    if (parentObjId < 0 || objId < 0) continue;

    const childId = wbsObjIdToId.get(objId);
    const parentId = wbsObjIdToId.get(parentObjId);
    if (childId && parentId) {
      const child = wbsTasks.find(t => t.id === childId);
      const parent = wbsTasks.find(t => t.id === parentId);
      if (child && parent) {
        child.parentId = parentId;
        if (!parent.childIds.includes(childId)) {
          parent.childIds.push(childId);
        }
      }
    }
  }

  // Parse activities
  const actObjIdToId = new Map<number, string>();
  const leafTasks: Task[] = [];
  const customTaskTypes = new Map<string, CustomTaskType>();

  // UDF-waarden per activiteit. Echte P6 (en de writer sinds 2026-10) zet ze IN de activiteit
  // (`<UDF><TypeObjectId/><TextValue/></UDF>`); oudere OPS-exports schreven losse `<UDFValue>`-
  // objecten (`ForeignObjectId`, `UDFTypeObjectId`, `Text`). Beide vormen worden gelezen. Alleen
  // onze exact benoemde definities tellen, zodat een toevallig JSON-object in een vreemde vrije
  // tekst nooit taaktype-data wordt.
  const udfEntries: { activityObjId: number; typeObjId: number; text: string }[] = [];
  for (const udfValue of scopedElements(scope, 'UDFValue')) {
    udfEntries.push({
      activityObjId: getElementInt(udfValue, 'ForeignObjectId', -1),
      typeObjId: getElementInt(udfValue, 'UDFTypeObjectId', -1),
      // Oracle noemt het tekstveld `Text`; `TextValue` tolerant, voor oudere OPS-builds.
      text: getElementText(udfValue, 'Text') || getElementText(udfValue, 'TextValue'),
    });
  }
  for (const actEl of activityElements) {
    const activityObjId = getElementInt(actEl, 'ObjectId', -1);
    for (const udf of directChildrenByLocalName(actEl, 'UDF')) {
      udfEntries.push({ activityObjId, typeObjId: getElementInt(udf, 'TypeObjectId', -1), text: getElementText(udf, 'TextValue') });
    }
  }
  const opsUdfTypeIds = new Set<number>();
  for (const udfType of scopedElements(scope, 'UDFType')) {
    if (getElementText(udfType, 'Title') !== OPS_CUSTOM_TASK_TYPE_UDF_TITLE) continue;
    const objectId = getElementInt(udfType, 'ObjectId', -1);
    if (objectId >= 0) opsUdfTypeIds.add(objectId);
  }
  const customTaskTypeByActivityObjectId = new Map<number, { id: string; name?: string }>();
  for (const entry of udfEntries) {
    if (!opsUdfTypeIds.has(entry.typeObjId)) continue;
    const parsed = decodeCustomTaskType(entry.text);
    if (entry.activityObjId >= 0 && parsed && !customTaskTypeByActivityObjectId.has(entry.activityObjId)) {
      customTaskTypeByActivityObjectId.set(entry.activityObjId, parsed);
    }
  }

  // PlannedDuration is in P6 altijd een hoeveelheid uren en zegt dus niet of OPS die taak als
  // werkdagen of als exacte werkuren moet behandelen. Alleen onze exact benoemde Activity-Text-UDF
  // is expliciet (`durationUnitUdfIds`, bovenaan); zonder definitie blijven vreemde/legacy bestanden
  // altijd op de urenmaat (T15).
  const explicitUnitByActivityObjectId = new Map<number, 'days' | 'hours'>();
  for (const entry of udfEntries) {
    if (!durationUnitUdfIds.has(entry.typeObjId)) continue;
    if (entry.activityObjId >= 0 && isTaskDurationUnit(entry.text)) {
      explicitUnitByActivityObjectId.set(entry.activityObjId, entry.text);
    }
  }
  // De tekst van de maatrecords per activiteit (de eerste waarde per soort).
  const recordTextByActivity = (ids: ReadonlySet<number>): Map<number, string> => {
    const out = new Map<number, string>();
    for (const entry of udfEntries) {
      if (ids.has(entry.typeObjId) && entry.activityObjId >= 0 && !out.has(entry.activityObjId)) out.set(entry.activityObjId, entry.text);
    }
    return out;
  };
  const dayMeasureDurationText = recordTextByActivity(dayMeasureDurationUdfIds);
  const exactMinutesText = recordTextByActivity(exactMinutesUdfIds);
  const dayMeasureLagText = recordTextByActivity(dayMeasureLagUdfIds);

  // Taakbeschrijving: oudere OPS-exports schreven `<Description>` op de activiteit (geen
  // schemaveld); de writer schrijft sinds 2026-10 een `<ActivityNote>` onder het notitieonderwerp
  // `OPS_DESCRIPTION_TOPIC_NAME`. Notities onder andere onderwerpen (echte P6: HTML) worden niet
  // als beschrijving gelezen.
  const descriptionTopicIds = new Set(scopedElements(scope, 'NotebookTopic')
    .filter(el => getElementText(el, 'Name') === OPS_DESCRIPTION_TOPIC_NAME)
    .map(el => getElementInt(el, 'ObjectId', -1)));
  const noteByActivityObjId = new Map<number, string>();
  for (const noteEl of scopedElements(scope, 'ActivityNote')) {
    if (!descriptionTopicIds.has(getElementInt(noteEl, 'NotebookTopicObjectId', -1))) continue;
    const actObjId = getElementInt(noteEl, 'ActivityObjectId', -1);
    if (actObjId >= 0 && !noteByActivityObjId.has(actObjId)) noteByActivityObjId.set(actObjId, getElementText(noteEl, 'Note'));
  }

  // Uur-modus-beslissing per kalender (discriminator a/b/c) vóór het bouwen van de taken. `calById`
  // mapt de projectkalender én de bibliotheekkalenders; `effCalIdOf` geeft per activity de effectieve
  // kalender-id (CalendarObjectId van de projectkalender of ontbrekend = projectkalender).
  const calById = new Map<string, WorkCalendar>([calendar, ...resourceCalendars].map(c => [c.id, c]));
  const effCalIdOf = (calObjId: number): string => calObjIdToId.get(calObjId) ?? calendar.id;

  // Werkelijke datums. `Not Started` wint van werkelijke datums (zoals het percentage,
  // `p6ActivityCompletionPercent`): sommige tools vullen ActualStart/Finish met een vuldatum
  // (aspose_p6_multiproject: 2000-01-01), en dan opende elke niet-gestarte taak als 100 % klaar. Bij een
  // OPS-export is de status geen bron. Dezelfde regel geldt voor de uur-modus-beslissing hieronder.
  const actualDateRaw = (actEl: Element, field: 'ActualStartDate' | 'ActualFinishDate'): string =>
    !writtenByOps && getElementText(actEl, 'Status').trim() === 'Not Started' ? '' : getElementText(actEl, field);

  const cSignalCalIds = new Set<string>();
  for (const actEl of activityElements) {
    const calId = effCalIdOf(getElementInt(actEl, 'CalendarObjectId', -1));
    const cal = calById.get(calId);
    if (!cal) continue;
    const durHours = getElementFloat(actEl, 'PlannedDuration');
    const durSignal = durHours > 0 && isSubDayMinutes(Math.round(durHours * 60), cal.hoursPerDay);
    // Ook een werkelijke datum met een eigen tijd telt: een feit uit de bron. Anders blijft de kalender
    // scalair, kapt de lezer "11:00" af tot de datum, en maakt de laadnormalisatie er 16:00 van (review
    // ronde 3 van PR #559, deel B: een voltooide eindmijlpaal met geplande datums op het anker).
    const dateSignal = [
      getElementText(actEl, 'PlannedStartDate'),
      getElementText(actEl, 'PlannedFinishDate'),
      actualDateRaw(actEl, 'ActualStartDate'),
      actualDateRaw(actEl, 'ActualFinishDate'),
    ].some(raw => hasNonAnchorTime(raw, DAY_TIME_ANCHOR) && importDateTimeOrUndefined(raw, true) !== undefined);
    if (durSignal || dateSignal) cSignalCalIds.add(calId);
  }
  // P6 valt terug op de scalar-synth zodra de geregistreerde canonical geen werkdag draagt
  // (preferCanonicalWhenEmpty = false) — zie `promoteHourCalendar`.
  const hourModeCalIds = promoteHourCalendars(calById, id => cSignalCalIds.has(id), false);
  // Een uurkalender rekent met zijn blokken; de pauzevelden van een dagkalender met pauze
  // (`registerP6Bands`) horen daar niet bij.
  for (const id of hourModeCalIds) {
    const promoted = calById.get(id);
    if (!promoted) continue;
    delete promoted.simpleBreakStartMinute;
    delete promoted.simpleBreakDurationMinutes;
  }
  // Een eigen `HoursPerDay` uit het bestand (authoritatief, zie `readP6Calendar`) gaat na de promotie
  // terug, zoals bij XER en IFC: de omrekening tussen dagen en uren mag afwijken van de blokken.
  for (const [cal, fileHpd] of fileHoursPerDay) cal.hoursPerDay = fileHpd;

  // "Datums zoals opgeslagen" voor P6 XML: P6's EIGEN rekenuitvoer per activiteit —
  // `EarlyStartDate`/`EarlyFinishDate` (terugval `StartDate`/`FinishDate`), `LateStartDate`/
  // `LateFinishDate`, `TotalFloat`/`FreeFloat` (uren) en `IsCritical` — als apart kanaal
  // (`ImportResult.recordedTimes`), nooit als solverinvoer: `task.time` krijgt de geplande datums.
  // Ontbrekende assen ontbreken, nooit een terugval.
  const recordedTimes: Record<string, RecordedTime> = {};

  for (const actEl of activityElements) {
    const objId = getElementInt(actEl, 'ObjectId', -1);
    if (objId < 0) continue;

    const id = generateId('task');
    actObjIdToId.set(objId, id);

    const actId = getElementText(actEl, 'Id');
    const name = getElementText(actEl, 'Name') || 'Activity';
    const p6Type = getElementText(actEl, 'Type');
    const p6DurationType = p6DurationTypeFromXml(getElementText(actEl, 'DurationType'));
    const plannedDuration = getElementFloat(actEl, 'PlannedDuration');
    const plannedStartRaw = getElementText(actEl, 'PlannedStartDate');
    const plannedFinishRaw = getElementText(actEl, 'PlannedFinishDate');
    const percentComplete = p6ActivityCompletionPercent(actEl, writtenByOps);
    const description = noteByActivityObjId.get(objId) ?? getElementText(actEl, 'Description');
    const customTaskType = customTaskTypeByActivityObjectId.get(objId);
    if (customTaskType?.name && !customTaskTypes.has(customTaskType.id)) {
      customTaskTypes.set(customTaskType.id, { id: customTaskType.id, name: customTaskType.name });
    }
    const wbsObjId = getElementInt(actEl, 'WBSObjectId', -1);
    // Taakkalender: effectieve <CalendarObjectId> → task.calendarId. De projectkalender (of een
    // ontbrekende/onbekende verwijzing) ⇒ undefined; `calObjIdToId` bevat de projectkalender nooit.
    const calObjId = getElementInt(actEl, 'CalendarObjectId', -1);
    const taskCalendarId = calObjIdToId.get(calObjId);

    // Uur- vs dag-modus voor deze taak.
    const effCalId = effCalIdOf(calObjId);
    const explicitUnit = explicitUnitByActivityObjectId.get(objId);
    const isHour = explicitUnit !== 'days';
    // Datumprecisie volgt de KALENDER, niet de duureenheid — zoals mspdiReader en de IFC-lezer: een
    // dagtaak op een urenkalender blijft een dagtaak (eenheid uit de OPS-marker), maar haar datums
    // (ook de actuals) houden hun echte tijd.
    const hourDates = hourModeCalIds.has(effCalId);
    const effCal = calById.get(effCalId) ?? calendar;
    const effHpd = effCal.hoursPerDay;
    // Datum-parser: uur ⇒ echte tijd (`parseInstant`+`formatInstant`), dag ⇒ tijd-strippen.
    const parseTaskDate = (raw: string): string | undefined => importDateTimeOrUndefined(raw, hourDates);
    const sourceStart = parseTaskDate(plannedStartRaw);
    const sourceFinish = parseTaskDate(plannedFinishRaw);
    const plannedStart = sourceStart ?? localTodayIso();
    const plannedFinish = sourceFinish ?? localTodayIso();
    // Onleesbaar is ontbrekend; alleen de invoer krijgt een plaatshouder, de bronuitvoer nooit.
    if (sourceStart === undefined) missingDates.start.add(id);
    if (sourceFinish === undefined) missingDates.finish.add(id);

    {
      const recordedDate = (raw: string): string | undefined => importDateTimeOrUndefined(raw, hourDates);
      const floatDays = (raw: string): number | undefined => {
        if (!raw) return undefined;
        const hours = Number.parseFloat(raw);
        // Op een uurkalender in werktijd per dag, zoals XER (`readXerRecordedTimes`): de werktijd rekent
        // en toont (eigenaarsbesluit 2026-10-15, "een dag"); de opgeslagen `HoursPerDay` telt hier niet.
        return Number.isFinite(hours)
          ? recordedFloatDays(hours * 60, effHoursPerDay(effCal) * 60)
          : undefined;
      };
      const criticalRaw = getElementText(actEl, 'IsCritical');
      const recorded = buildRecordedTime({
        start: recordedDate(getElementText(actEl, 'EarlyStartDate')) ?? recordedDate(getElementText(actEl, 'StartDate')),
        finish: recordedDate(getElementText(actEl, 'EarlyFinishDate')) ?? recordedDate(getElementText(actEl, 'FinishDate')),
        lateStart: recordedDate(getElementText(actEl, 'LateStartDate')),
        lateFinish: recordedDate(getElementText(actEl, 'LateFinishDate')),
        totalFloat: floatDays(getElementText(actEl, 'TotalFloat')),
        freeFloat: floatDays(getElementText(actEl, 'FreeFloat')),
        isCritical: criticalRaw === 'true' || criticalRaw === '1' ? true
          : criticalRaw === 'false' || criticalRaw === '0' ? false : undefined,
      });
      if (recorded) recordedTimes[id] = recorded;
    }

    // Actuals — leeg ⇒ undefined (invarianten via normalizeImportedProgress). `Not Started` wint:
    // zie `actualDateRaw`.
    const actualStartRaw = actualDateRaw(actEl, 'ActualStartDate');
    const actualFinishRaw = actualDateRaw(actEl, 'ActualFinishDate');
    const remainingRaw = getElementText(actEl, 'RemainingDuration');
    const actualStart = parseTaskDate(actualStartRaw);
    const actualFinish = parseTaskDate(actualFinishRaw);
    // Duur en rest (alleen uren §3.10; `readMeasure`). Urenmaat ⇒ minuten (`uren × 60`, op de hele minuut)
    // als bron van waarheid, dagengetal via `hourTaskScheduleDuration`; een `OPS_ExactMinutes`-record geeft
    // een breuk in minuten terug. Dagenmaat (OPS-markering `days`) ⇒ het record `[dagen, minuten]` zolang
    // de duur nog de geschreven minuten draagt, anders minuten ÷ minuten per dag. Een dag is de werktijd
    // per dag (T13), of in een ouder OPS-bestand de opgeslagen `HoursPerDay`. Rest en duur gebruiken
    // dezelfde dag, symmetrisch met de writer.
    const dayHoursPerDay = workdayIsWorkTime ? dayMeasureMinutesPerDay(effCal, false) / 60 : effHpd;
    const markerUnit = isHour ? 'hours' : 'days';
    const remainingHours = remainingRaw ? parseFloat(remainingRaw) : NaN;
    const hasRemaining = Number.isFinite(remainingHours);
    const measure = readMeasure({
      unit: markerUnit,
      durationMinutes: plannedDuration * 60,
      // Zonder geldig record: uren ÷ uren per dag, zoals voorheen (`p6HoursToDays`).
      durationDays: p6HoursToDays(plannedDuration, dayHoursPerDay),
      remainingMinutes: hasRemaining ? remainingHours * 60 : undefined,
      ...(hasRemaining ? { remainingDays: p6HoursToDays(remainingHours, dayHoursPerDay) } : {}),
      minutesPerDay: (dayHoursPerDay > 0 ? dayHoursPerDay : 8) * 60,
      calendar: effCal,
      dayRecords: markerUnit === 'days' ? parseFieldRecords(dayMeasureDurationText.get(objId), P6_DURATION_FIELDS) : {},
      exactRecords: markerUnit === 'hours' ? parseFieldRecords(exactMinutesText.get(objId), P6_DURATION_FIELDS) : {},
    });
    const remainingMinutes = measure.remainingMinutes;
    const remainingTime = measure.remainingTime;
    const durationMinutes = measure.durationMinutes;
    const durationDays = measure.scheduleDuration;
    const isMilestone = p6Type.includes('Milestone');
    // P6 onderscheidt Start/Finish Milestone — bewaar de soort expliciet.
    const milestoneKind = !isMilestone ? undefined
      : p6Type.includes('Finish') ? 'FINISH' as const
      : 'START' as const;

    const parentId = wbsObjId >= 0 ? wbsObjIdToId.get(wbsObjId) || null : null;

    // Datumconstraints: primair + secundair uit het PMXML-label of de `CS_*`-code. Secundair is altijd soft
    // (P6-invariant) ⇒ `hard` wordt gedropt. Datum: uur ⇒ echte tijd, dag ⇒ tijd-strippen.
    let constraint: TaskConstraint | undefined;
    const primCode = getElementText(actEl, 'PrimaryConstraintType');
    if (primCode) {
      const mapped = p6ConstraintFromXml(primCode, 'PrimaryConstraintType');
      if (mapped) {
        const cdate = parseTaskDate(getElementText(actEl, 'PrimaryConstraintDate'));
        constraint = {
          type: mapped.type,
          ...(mapped.hard ? { hard: true } : {}),
          ...(cdate ? { date: cdate } : {}),
        };
      }
    }
    let constraint2: TaskConstraint | undefined;
    const secCode = getElementText(actEl, 'SecondaryConstraintType');
    if (secCode) {
      const mapped2 = p6ConstraintFromXml(secCode, 'SecondaryConstraintType');
      if (mapped2) {
        const cdate2 = parseTaskDate(getElementText(actEl, 'SecondaryConstraintDate'));
        constraint2 = {
          type: mapped2.type,
          ...(cdate2 ? { date: cdate2 } : {}),
        };
      }
    }

    const task: Task = {
      id,
      name,
      description,
      wbsCode: actId,
      taskType: customTaskType ? 'USERDEFINED' : 'CONSTRUCTION',
      ...(customTaskType ? { customTaskTypeId: customTaskType.id } : {}),
      ...(p6DurationType ? { p6DurationType } : {}),
      status: 'NOT_STARTED', // afgeleid door normalizeImportedProgress uit completion/actuals
      isMilestone,
      ...(milestoneKind ? { milestoneKind } : {}),
      priority: 500,
      parentId,
      childIds: [],
      ...(constraint ? { constraint } : {}),
      ...(constraint2 ? { constraint2 } : {}),
      time: {
        durationType: 'WORKTIME',
        durationUnit: isHour ? 'hours' : 'days',
        scheduleDuration: durationDays,
        ...(durationMinutes != null ? { durationMinutes } : {}),
        scheduleStart: plannedStart,
        scheduleFinish: plannedFinish,
        earlyStart: plannedStart,
        earlyFinish: plannedFinish,
        lateStart: plannedStart,
        lateFinish: plannedFinish,
        freeFloat: 0,
        totalFloat: 0,
        isCritical: false,
        actualStart,
        actualFinish,
        remainingTime,
        ...(remainingMinutes != null ? { remainingMinutes } : {}),
        completion: percentComplete / 100,
      },
      resourceIds: [],
      ...(taskCalendarId ? { calendarId: taskCalendarId } : {}),
    };

    leafTasks.push(task);

    // Add to parent's children
    if (parentId) {
      const parent = wbsTasks.find(t => t.id === parentId);
      if (parent && !parent.childIds.includes(id)) {
        parent.childIds.push(id);
      }
    }
  }

  // Combine tasks: WBS (summary) + leaf activities — in BOOMVOLGORDE (diepte-eerst, zoals de andere
  // lezers); "samenvattingen eerst, dan bladen" brak de hiërarchie in de MSPDI-export.
  const tasks = [...flattenOrder([...wbsTasks, ...leafTasks])];

  // Anker = projectstart uit het bestand, anders de vroegste aanwezige activiteitstart; finish uit
  // start + duur op de effectieve kalender (P6 levert elke kalender mee, dus eenduidig voor hele
  // werkdagen).
  project.startDate = resolveMissingScheduleDates(tasks, missingDates, projectStartRaw ? project.startDate : '',
    (task) => resolveCalendar(task.calendarId, resourceCalendars, calendar));

  // Voortgang-invarianten op de rauw ingelezen actuals. De vastgelegde rest van een taak in de dagenmaat
  // blijft exact (B3), zoals de restminuten van een urentaak.
  normalizeKeepingDayRest(tasks, () => normalizeImportedProgress(tasks, project.statusDate));
  deriveImportedWorkRules(tasks); // werkregel uit <DurationType>

  // Parse relationships
  const relElements = scopedElements(scope, 'Relationship');
  const sequences: Sequence[] = [];

  // Een relatie met een kant in een ANDER project wordt geen Sequence: zoals bij XER (externe
  // relaties zijn daar nooit solverinvoer). Hij telt mee in het verslag.
  const crossProjectRelations = new Set<string>();
  const ownProjectObjId = scope.projectObjectId;
  // De lagrecords (T21) staan als één UDF op de opvolger, met als sleutel voorganger-ObjectId plus
  // relatietype. Een sleutel die bij één opvolger twee keer voorkomt, is dubbelzinnig en telt niet.
  const lagKeyOf = (relEl: Element): string => lagRecordKey(getElementInt(relEl, 'PredecessorActivityObjectId', -1),
    SEQUENCE_TYPE_BY_P6[getElementText(relEl, 'Type')] ?? 'FINISH_START');
  const lagKeyCount = new Map<string, number>();
  for (const relEl of relElements) {
    const key = `${getElementInt(relEl, 'SuccessorActivityObjectId', -1)}>${lagKeyOf(relEl)}`;
    lagKeyCount.set(key, (lagKeyCount.get(key) ?? 0) + 1);
  }
  const lagRecordsBySuccessor = new Map<number, Map<string, LagRecord>>();
  const lagRecordOf = (relEl: Element, succObjId: number): LagRecord | undefined => {
    if (lagKeyCount.get(`${succObjId}>${lagKeyOf(relEl)}`) !== 1) return undefined;
    let records = lagRecordsBySuccessor.get(succObjId);
    if (!records) {
      records = parseLagRecords(dayMeasureLagText.get(succObjId));
      lagRecordsBySuccessor.set(succObjId, records);
    }
    return records.get(lagKeyOf(relEl));
  };
  for (const relEl of relElements) {
    const predObjId = getElementInt(relEl, 'PredecessorActivityObjectId', -1);
    const succObjId = getElementInt(relEl, 'SuccessorActivityObjectId', -1);
    if (predObjId < 0 || succObjId < 0) continue;

    const predId = actObjIdToId.get(predObjId);
    const succId = actObjIdToId.get(succObjId);
    if (!predId || !succId) {
      const predProj = getElementInt(relEl, 'PredecessorProjectObjectId', -1);
      const succProj = getElementInt(relEl, 'SuccessorProjectObjectId', -1);
      if (ownProjectObjId != null && ((predProj >= 0 && predProj !== ownProjectObjId)
        || (succProj >= 0 && succProj !== ownProjectObjId))) {
        crossProjectRelations.add(getElementText(relEl, 'ObjectId') || `${predObjId}>${succObjId}`);
      }
      continue;
    }

    const p6Type = getElementText(relEl, 'Type');
    const lagHours = getElementFloat(relEl, 'Lag');

    // P6 bewaart lag in uren; de opvolgereenheid verandert die lengte niet (I5). Een lagrecord geeft de
    // dagenmaat (of de kalendertijd, die P6 per relatie niet kent) terug, zolang `Lag` nog de geschreven
    // minuten draagt; anders is de lag urenmaat (T21, T15).
    const record = lagRecordOf(relEl, succObjId);
    const seq: Sequence = {
      id: generateId('seq'),
      predecessorId: predId,
      successorId: succId,
      type: SEQUENCE_TYPE_BY_P6[p6Type] ?? 'FINISH_START',
      ...(recordHolds(record, lagHours * 60) ? lagFromRecord(record) : { lagDays: 0, lagMinutes: Math.round(lagHours * 60) }),
    };
    sequences.push(seq);
  }

  // `<ResourceCurve>`-catalogus: P6's resourcecurves als 21 waarden (`Value0`..`Value100`, MPXJ
  // `XmlContextReader.processWorkContour`), gekeyd op ObjectId. Een toewijzing verwijst ernaar via
  // `<ResourceCurveObjectId>`.
  const curveByObjId = new Map<number, { name: string; values: number[] }>();
  for (const curveEl of scopedElements(scope, 'ResourceCurve')) {
    const objId = getElementInt(curveEl, 'ObjectId', -1);
    if (objId < 0) continue;
    const valuesEl = curveEl.getElementsByTagName('Values')[0];
    if (!valuesEl) continue;
    const raw: number[] = [];
    for (let pct = 0; pct <= 100; pct += 5) raw.push(getElementFloat(valuesEl, `Value${pct}`, NaN));
    const values = normalizeCurveValues(raw);
    if (!values) continue;
    curveByObjId.set(objId, { name: getElementText(curveEl, 'Name'), values });
  }

  // Kalender-engine per taakkalender voor de as-vertaling van de spreidingsstrings.
  const taskById = new Map(tasks.map(t => [t.id, t] as const));
  const engineCache = new Map<string, CalendarEngine>();
  const engineForTask = (task: Task): CalendarEngine => {
    const key = task.calendarId ?? '';
    let eng = engineCache.get(key);
    if (!eng) {
      eng = new CalendarEngine(calendarForEngine(resolveCalendar(task.calendarId, resourceCalendars, calendar)));
      engineCache.set(key, eng);
    }
    return eng;
  };
  const contoursByTaskId = new Map<string, TaskTimephasedContour[]>();

  // ResourceAssignments
  const resourceById = new Map(resources.map(r => [r.id, r] as const));
  const asgnElements = scopedElements(scope, 'ResourceAssignment');
  const assignments: ResourceAssignment[] = [];
  for (const asgnEl of asgnElements) {
    const actObjId = getElementInt(asgnEl, 'ActivityObjectId', -1);
    const resObjId = getElementInt(asgnEl, 'ResourceObjectId', -1);
    if (actObjId < 0 || resObjId < 0) continue;
    const taskId = actObjIdToId.get(actObjId);
    const resourceId = resObjIdToId.get(resObjId);
    if (!taskId || !resourceId) continue;

    const plannedUnitsPerTime = getElementFloat(asgnEl, 'PlannedUnitsPerTime');

    // De CURVE. Schema-native: `<ResourceCurveObjectId>` → catalogus; de 21 waarden zijn de exacte
    // data (`curveValues`), `curve` is de OPS-benadering: een exacte tabelmatch, anders de
    // P6-curvenaam (`P6_NAME_TO_CURVE`), anders geen OPS-vorm. Een vlakke curve is geen curve.
    // COMPAT: oudere OPS-exports schreven de curveNAAM in `<PlannedCurve>` (daar hoort een
    // spreidingsstring `"werkuren:periodeuren;…"`, MPXJ `TimephasedHelper`); een `<PlannedCurve>`
    // zonder `:` wordt daarom nog als naam gelezen.
    const plannedCurveRaw = getElementText(asgnEl, 'PlannedCurve');
    const curveObjId = getElementInt(asgnEl, 'ResourceCurveObjectId', -1);
    const catalogCurve = curveObjId >= 0 ? curveByObjId.get(curveObjId) : undefined;
    let curve: ResourceCurve | undefined;
    let curveValues: number[] | undefined;
    if (catalogCurve && !isFlatCurveValues(catalogCurve.values)) {
      curve = matchCurveValues(catalogCurve.values) ?? P6_NAME_TO_CURVE[catalogCurve.name];
      curveValues = catalogCurve.values;
    } else if (plannedCurveRaw && plannedCurveRaw.indexOf(':') === -1) {
      curve = P6_NAME_TO_CURVE[plannedCurveRaw];
    }

    // <PlannedUnits>/<ActualUnits>/<RemainingUnits> in UREN → minuten.
    const unitsMinutes = (tag: string): number | undefined => {
      const raw = getElementText(asgnEl, tag);
      if (!raw.trim()) return undefined;
      const hours = parseFloat(raw);
      return Number.isFinite(hours) ? hours * 60 : undefined;
    };
    const remainingMinutes = unitsMinutes('RemainingUnits');
    // PlannedUnitsPerTime/RemainingUnitsPerTime zijn een fractie (1.0 = 100%), geen uren/dag
    // (spiegel van p6xmlWriter) — 1:1 overnemen. Bij restwerk het resttempo, anders het begrote
    // (eigenaarsbesluit 2026-10-15, spiegel van de XER-lezer `xerResourceAssignments.ts`; materiaal
    // houdt het begrote tempo). Ontbreekt RemainingUnitsPerTime, dan blijft alles zoals vroeger.
    // Geen bruikbaar begroot tempo (≤ 0)? Dan het resttempo als begroot, zoals de XER-lezer
    // (`plannedAssignmentRate`); dan is er geen apart begroot tempo en verzint de export er geen.
    // Pas zonder beide de oude terugval 1 (review #361 punt 2).
    const remainingRateRaw = getElementText(asgnEl, 'RemainingUnitsPerTime');
    const remainingRate = remainingRateRaw.trim() ? parseFloat(remainingRateRaw) : undefined;
    const plannedRate = plannedUnitsPerTime > 0 ? plannedUnitsPerTime
      : remainingRate !== undefined && Number.isFinite(remainingRate) && remainingRate > 0 ? remainingRate : 1;
    const isMaterial = resourceById.get(resourceId)?.type === 'MATERIAL';
    const { unitsPerDay, plannedUnitsPerDay } = isMaterial
      ? { unitsPerDay: plannedRate, plannedUnitsPerDay: undefined }
      : importedAssignmentRate(plannedRate, remainingRate, remainingMinutes);
    // De werkvelden alleen bewaard wanneer ze afwijken van `duur × inzet/tijd` (`importedWorkFields`).
    const workTask = taskById.get(taskId);
    const derivedWork = workTask ? taskWorkMinutes(workTask.time, engineForTask(workTask).hoursPerDay) * unitsPerDay : 0;
    const workFields = importedWorkFields({
      plannedMinutes: unitsMinutes('PlannedUnits'),
      actualMinutes: unitsMinutes('ActualUnits'),
      remainingMinutes,
    }, derivedWork);
    assignments.push({
      id: generateId('asgn'),
      taskId,
      resourceId,
      unitsPerDay,
      ...(plannedUnitsPerDay !== undefined ? { plannedUnitsPerDay } : {}),
      ...(curve && curve !== 'UNIFORM' ? { curve } : {}),
      ...(curveValues ? { curveValues } : {}),
      ...workFields,
    });

    // De SPREIDING: `<ActualCurve>` (verricht, anker `ActualStartDate`) en `<RemainingCurve>`
    // (resterend, anker `RemainingStartDate`) hebben voorrang; zonder die twee geldt `<PlannedCurve>`
    // (anker `PlannedStartDate`) als resterend werk — MPXJ `XmlProjectReader` leest exact deze drie
    // met deze ankers. Ankers worden op de taak-as gezet via de taakkalender (`axisOffsetMinutes`);
    // ontbreekt een anker, dan geldt de taakstart.
    const task = taskById.get(taskId);
    if (task && task.time.scheduleStart && task.childIds.length === 0) {
      const engine = engineForTask(task);
      const taskStart = parseInstant(task.time.scheduleStart);
      const anchorOffset = (tag: string): number => {
        const raw = getElementText(asgnEl, tag);
        return raw ? axisOffsetMinutes(engine, taskStart, parseImportedInstant(raw), false) : 0;
      };
      const actualSpread = getElementText(asgnEl, 'ActualCurve');
      const remainingSpread = getElementText(asgnEl, 'RemainingCurve');
      let periods = [
        ...p6SpreadToContourPeriods(actualSpread, anchorOffset('ActualStartDate'), 'actual'),
        ...p6SpreadToContourPeriods(remainingSpread, anchorOffset('RemainingStartDate'), 'remaining'),
      ];
      if (periods.length === 0 && plannedCurveRaw.indexOf(':') >= 0) {
        periods = p6SpreadToContourPeriods(plannedCurveRaw, anchorOffset('PlannedStartDate'), 'remaining');
      }
      if (periods.length > 1 && periods.some(p => p.workMinutes > 0)) {
        collectContour(contoursByTaskId, taskId, { resourceUid: null, resourceId, periods });
      }
    }
  }
  // Contouren + afgeleide werkonderbrekingen op de taken (zelfde afleiding als de .mpp-/MSPDI-lezer).
  attachContours(taskById, contoursByTaskId);
  reconstructResourceIds(tasks, assignments);

  const result: ImportResult = {
    project,
    calendar,
    tasks,
    sequences,
    resources,
    assignments,
    resourceCalendars,
    customTaskTypes: [...customTaskTypes.values()],
    // Rekenprofielen: P6-XML opent als OPS — de lezer zet geen opties, en onder het P6-profiel zouden
    // A12/A13/A16/A17/A20/B2 aangaan zonder orakel.
    suggestedProfileId: 'ops',
    ...(Object.keys(recordedTimes).length > 0 ? { recordedTimes, recordedTimesOrigin: 'p6xml' as const } : {}),
  };
  return { result, crossProjectRelations, activitiesRead: leafTasks.length };
}

/**
 * De P6 Project-ID (`<Id>`) van een `<Project>` of `<BaselineProject>`, of `''`. Geen code: het Id dat de
 * eigen writer zonder code schrijft (`OPS:` + intern id) en het interne id van exports tot en met
 * v2026.9.0 (`isLegacyOpsProjectId`); anders kreeg een heropende oude export een blijvende nepcode.
 */
function p6ProjectCode(id: string): string {
  const code = id.trim();
  return isOpsInternalProjectId(code) || isLegacyOpsProjectId(code) ? '' : code;
}

/** Naam van een P6-baseline: "Naam (Id)" (`nameWithProjectCode`). Een baseline is geen document;
 *  alleen haar label draagt de code. */
function p6ProjectName(name: string, id: string): string {
  return nameWithProjectCode(name.trim(), p6ProjectCode(id));
}

function parseProject(projEl: Element | null): Project {

  if (!projEl) {
    return {
      id: generateId('proj'),
      name: 'P6 Import',
      description: '',
      startDate: localTodayIso(),
      endDate: '',
      calendarId: 'cal-default',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      author: '',
      company: '',
    };
  }

  // MustFinishByDate is in P6 een optionele eis, geen berekend einde: ontbreekt hij, dan blijft de
  // einddatum leeg (zoals de writer hem voor een project zonder einddatum weglaat).
  const mustFinishRaw = getElementText(projEl, 'MustFinishByDate');
  // Naam kaal, code apart in `p6ProjectCode` (zie `documentProjectCode`). Geen naam ⇒ de code, zoals XER.
  const code = p6ProjectCode(getElementText(projEl, 'Id'));
  const project: Project = {
    id: generateId('proj'),
    name: getElementText(projEl, 'Name').trim() || code || 'P6 Import',
    description: getElementText(projEl, 'Description'),
    startDate: parseP6Date(getElementText(projEl, 'PlannedStartDate')),
    endDate: mustFinishRaw ? parseP6Date(mustFinishRaw) : '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
  };
  if (code) project.p6ProjectCode = code;
  // Data date → project.statusDate. Alleen wanneer aanwezig.
  const dataDateRaw = getElementText(projEl, 'DataDate');
  if (dataDateRaw) project.statusDate = statusDateFromXml(dataDateRaw);
  return project;
}

/**
 * Eén P6-<Calendar> → WorkCalendar. `lastMinute`: de eindtijdregel van het hele bestand
 * (`p6FinishUsesLastMinute`).
 */
function readP6Calendar(calEl: Element, lastMinute = false, writtenByOps = false): WorkCalendar {
  const calendar = createDefaultCalendar();
  calendar.name = getElementText(calEl, 'Name') || calendar.name;
  // P6 kent geen regelset-herkomst — createDefaultCalendar() zet 'm altijd; een uit P6 gelezen
  // kalender is dat niet.
  delete calendar.generation;

  const hpd = getElementFloat(calEl, 'HoursPerDay');
  if (hpd > 0) calendar.hoursPerDay = hpd; // authoritatief — StandardWorkWeek-uren overschrijven dit niet

  // Werkweek + feestdagen — golden rule: geen <StandardWorkWeek>/<HolidayOrExceptions> (ander tool /
  // oud bestand) ⇒ createDefaultCalendar()-defaults blijven staan.
  const ww = parseP6StandardWorkWeek(calEl, lastMinute);
  if (ww.workDays.length > 0) calendar.workDays = ww.workDays.sort((a, b) => a - b);
  if (ww.workStartHour !== undefined) calendar.workStartHour = ww.workStartHour;
  if (ww.workEndHour !== undefined) calendar.workEndHour = ww.workEndHour;
  registerP6Bands(calendar, ww.rawByWeekday, writtenByOps, hpd);

  // Een kalender met een eigen werkweek is een volledige P6-kalender: zonder uitzonderingen heeft hij
  // géén feestdagen. De NL-feestdagen van `createDefaultCalendar()` blijven alleen staan bij een kale
  // kalender zonder werkweek (ander tool / oud bestand).
  if (ww.workDays.length > 0) calendar.holidays = [];
  const { holidays, workingExceptions } = parseP6HolidayOrExceptions(calEl, lastMinute);
  // Invariant (`WorkCalendar.workingExceptions`): een datum staat nooit in beide lijsten. Draagt P6
  // dezelfde dag dubbel, dan wint de werkende uitzondering (die is specifieker).
  const workingDates = new Set(workingExceptions.map(w => w.startDate));
  const offDays = holidays.filter(h => !(h.startDate === h.endDate && workingDates.has(h.startDate)));
  if (offDays.length > 0) calendar.holidays = mergeConsecutiveDays(offDays);
  if (workingExceptions.length > 0) calendar.workingExceptions = mergeConsecutiveDays(workingExceptions);

  return calendar;
}
