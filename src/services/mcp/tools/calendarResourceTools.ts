// MCP-toolmodule: kalender-, toewijzings-, nivelleer-, project- en baseline-mutaties. Zelfde
// bouwwijze als `taskTools.ts`: `planner_`-prefix, verplichte description, de vier MCP-annotaties, een
// JSON-schema met EXPLICIETE eenheden, en alle échte mutaties via `runMutateTool` →
// `runInMcpTransaction` (één undo-stap, één herberekening, geen bestands-/save-side-effects).
//
// Drie doorlopende conventies (zie ook `taskTools.ts`):
//   1. ZACHTE per-item-weigeringen (`itemRejections`) — één rotte regel rolt nooit de hele bulk terug;
//      structurele fouten van een ENKELVOUDIGE tool zijn hard via `McpStepError`.
//   2. LEGE-BATCH-SNELPAD — een bulk met statisch nul uitvoerbare items betreedt géén transactie
//      (geen spurious undo-snapshot, geen redo-wipe door een AI-no-op). De classificatie draait
//      daarom in een GEDEELDE helper die zowel het snelpad als de transactie-fn voedt.
//   3. `enrichOk` — de respons-`data` wordt ná de transactie opnieuw uit de VERSE store opgebouwd.
//
// SCHRIJFKANT SPREEKT DE LEESKANT (harde eis): de veldnamen zijn identiek aan de leestools —
// `assignmentId`, `unitsPerDay`, `curve`. Een AI die `get_task` leest kan die id's/velden dus
// rechtstreeks in `manage_assignments` terugstoppen.
import { WORK_RULES, type WorkRule } from '@/types/workRule';
import { workRuleApplies } from '@/engine/work/workRuleApply';
import type { McpContext, McpToolDef, McpToolOk } from '../contracts';
import {
  guardNonTransactional,
  McpStepError,
  runMutateTool,
  toolError,
  type MutationOutcome,
} from './runtime';
// Alleen als TYPE: wordt weggestreept bij compileren, dus géén runtime-import naar batchTool.
import type { BatchStepTool } from './batchTool';
import {
  booleanArgReason, enrichOk, okDirect, okDirectGuarded, parsedBatchStep, projectEndInfo, WRITE_ANNOTATIONS,
} from './helpers';
import type { AppState } from '@/state/appStore';
import { syncProjectCalendar } from '@/state/syncProjectCalendar';
import { validate } from '@/state/mcpValidation';
import { resolveCalendarHolidays } from '../calendarGenerate';
import { ensureFreshSchedule } from '../freshness';
import { createNewCalendar } from '@/engine/calendar/defaultCalendar';
import { computeMoveDelta } from '@/engine/moveProject';
import { diffDays } from '@/utils/dateUtils';
import { hoursPerDayForBlocks, workDaysFromBands, workDaysSetPatch } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';
import type { GeneratorCountry, HolidayGenParams } from '@/engine/calendar/generateCalendarHolidays';
import { isHourModeCalendar, type CalendarGeneration, type Holiday, type WorkCalendar, type WorkingException, type WorkTimeBands } from '@/types/calendar';
import { isResourceCurve, isValidUnits, RESOURCE_CURVES, type ResourceCurve } from '@/types/resource';
import type { Project } from '@/types/project';
import type { LevelingOptions, LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { isFiniteNumber } from '@/utils/guards';
import { hasLevelingOutput } from '@/utils/taskDefaults';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { markDocumentEdited } from '@/state/documentEdited';
import type { ClearableProjectKey } from '@/state/projectPatch';
import { holidayIssue, ISO_DATE_ONLY } from '@/utils/holidayRange';
import {
  calendarScalarBreakIssue, effectiveWorkTimeBands, simpleBreakNetHours, simpleBreakPatch, type ScalarBreakIssue,
} from '@/utils/effectiveWorkTime';

/**
 * Curve-toets (`isResourceCurve`, `types/resource.ts`). DIT IS EEN VEILIGHEIDSGUARD, GEEN COMFORT: de
 * schemapoort laat de binnenkant van array-items aan de tool (DIEPTE-REGEL in `schemaValidate.ts`).
 * Een onbekende curve (`"bell"` i.p.v. `"BELL"`) maakt `ResourceLoad.CURVE_POINTS[curve]`
 * `undefined` en klapt in `recomputeResourceLoad()`, dat in `runInMcpTransaction` BUITEN de
 * try/catch draait: uncaught TypeError, corrupte waarde gecommit én een undo-stap erbij. Vandaar:
 * filteren vóór de mutatie, als ZACHTE per-item-weigering die de geldige waarden noemt.
 */
const curveReason = (v: unknown): string =>
  `unknown curve '${String(v)}'; valid values are ${RESOURCE_CURVES.join(', ')} (case-sensitive)`;

type Rejection = { id: string; reason: string };
type StoreState = AppState;

/** Kalenderdagen tussen twee ISO-datums; 0 zodra één van beide ontbreekt (leeg projecteinde). */
function safeDiffDays(a: string, b: string): number {
  if (!a || !b) return 0;
  const d = diffDays(a, b);
  return Number.isFinite(d) ? d : 0;
}

// =================================================================================================
// planner_update_calendar
//
// Dispatch per item:
//   - id staat in de bibliotheek                     ⇒ wijzigen (draft.updateCalendar);
//   - id is de PROJECTKALENDER maar staat er nog niet ⇒ eerst `ensureProjectCalendarInLibrary`
//     (promotie: op een vers document leeft de projectkalender alleen als cache `s.calendar`),
//     dán wijzigen — de respons meldt `promoted: true`;
//   - onbekend id + `create: true`                    ⇒ aanmaken (draft.addCalendar);
//   - onbekend id zónder `create`                     ⇒ ZACHTE weigering.
// Holidays lopen altijd via `resolveCalendarHolidays` (meng-semantiek): generator-basis en/of
// rauwe uitzonderingen, met `becameLiteral` per item terug zodra `generation` daardoor vervalt.
// =================================================================================================

interface CalendarItem {
  id: string;
  create?: boolean;
  name?: string;
  description?: string;
  workDays?: number[];
  workStartHour?: number;
  workEndHour?: number;
  hoursPerDay?: number;
  /** UUR-kalender: werktijdbanden per ISO-weekdag in MINUTEN-vanaf-middernacht. `null` ⇒ terug naar
   *  een DAG-kalender. Exact de leesvorm van `get_calendars`. */
  workTime?: WorkTimeBands | null;
  /** Ploeg-classificatie (IFC `PredefinedType`). `null` ⇒ wissen. Leesvorm van `get_calendars`. */
  shift?: WorkCalendar['shift'] | null;
  /** Eenvoudig pauzepatroon van een DAG-kalender, in MINUTEN (begin vanaf middernacht, duur). Leesvorm
   *  van `get_calendars`; de netto uren worden eruit afgeleid zoals in de kalenderdialoog. */
  simpleBreakStartMinute?: number;
  simpleBreakDurationMinutes?: number;
  /** Dagen die WERKEND worden (MS Project "werkende uitzondering"), optioneel met eigen banden. De
   *  volledige lijst; vervangt de bestaande exact (`[]` wist ze). Leesvorm van `get_calendars`. */
  workingExceptions?: WorkingException[];
  /** Herkomst-metadata IN DE LEESVORM (`ruleSetId`/`breakChoice`/jaren). `null` ⇒ wissen. */
  generation?: CalendarGeneration | null;
  /** De VOLLEDIGE feestdagenlijst in de leesvorm van `get_calendars`; vervangt de lijst exact. */
  holidays?: Holiday[];
  generate?: HolidayGenParams;
  rawHolidays?: Holiday[];
  /** `merge` (default) = rauwe dagen TOEVOEGEN; `replace` = de lijst exact vervangen (verwijderen). */
  holidaysMode?: 'merge' | 'replace';
}

/** Velden die een item BETEKENISVOL maken; een update-item zonder één hiervan is een no-op-weigering.
 *  `holidaysMode` staat er BEWUST niet bij: een modus zonder `rawHolidays` verandert niets. */
const CAL_FIELD_KEYS: (keyof CalendarItem)[] = [
  'name', 'description', 'workDays', 'workStartHour', 'workEndHour', 'hoursPerDay',
  'simpleBreakStartMinute', 'simpleBreakDurationMinutes',
  'workTime', 'shift', 'generation', 'holidays', 'generate', 'rawHolidays', 'workingExceptions',
];

/**
 * Elke sleutel die een kalender-item KENT (allowlist, patroon `PROJECT_KEYS`). Een onbekende
 * sleutel wordt zacht geweigerd MÉT de lijst erbij — nooit stil weggegooid.
 */
const CAL_ITEM_KEYS: string[] = ['id', 'create', ...(CAL_FIELD_KEYS as string[]), 'holidaysMode'];

/**
 * AFGELEIDE, ALLEEN-LEES velden uit `get_calendars`. Ze zijn geen kalenderdata maar een berekening
 * over het BRONdocument (is het de projectdefault? hoeveel taken/resources hangen eraan?), dus ze
 * betekenen niets in het doeldocument. Ze worden geaccepteerd — anders zou een lezing niet
 * LETTERLIJK terug te schrijven zijn — maar expliciet gemeld als `ignoredFields` per rij, nooit stil
 * geslikt. Wisselen van projectkalender doe je met de app; `update_project.calendarId` weigert dat
 * met een verwijzing (zie PROJECT_REFUSED).
 *
 * `libraryOrigin` hoort in dezelfde groep: het is de bibliotheekstempel van de kalender in HET
 * BRONdocument (welk bibliotheekitem, welke versie, welke hash). Letterlijk overschrijven zou in een
 * ander document een koppeling vervalsen die de bibliotheek nooit gemaakt heeft; koppelen loopt via de
 * bibliotheek zelf. Dus: mag mee, doet niets, wordt gemeld.
 *
 * De P6-herkomstvelden (`p6Source`, `p6NonWorkPenaltyDates`, `p6NonWorkPenaltyDatesState`)
 * horen om dezelfde reden in deze groep: alleen de XER-reader mag de stempel
 * zetten (`types/calendar.ts`). `get_calendars` geeft ze letterlijk mee, dus ze moeten mee terug
 * kunnen, maar een MCP-schrijfactie mag in een ander document geen XER-herkomst vervalsen.
 */
const CAL_READONLY_KEYS: string[] = [
  'isProjectDefault', 'usedByTasks', 'usedByResources', 'libraryOrigin',
  'p6Source', 'p6NonWorkPenaltyDates', 'p6NonWorkPenaltyDatesState',
];

// ── Invoervalidatie ─────────────────────────────────────────────────────────────────────────────
//
// Waarom hier, en niet alleen in het JSON-schema: de schemapoort laat de binnenkant van array-items
// aan de tool (DIEPTE-REGEL in `schemaValidate.ts`). Een foute waarde die er toch doorheen komt,
// moet een LEESBARE weigering geven — nooit een kale TypeError diep in de generator (die belandt
// binnen `runInMcpTransaction` en rolt de hele call terug met "Cannot read properties of undefined").

/** Het ECHTE domein van `generate.country` (holidays.ts + generateCalendarHolidays.ts). */
const GEN_COUNTRIES: GeneratorCountry[] = ['NL', 'DE', 'BE', 'FR', 'UK', 'AT', 'CH', 'US', 'none'];
const BOUWVAK_CHOICES = ['geen', 'noord', 'midden', 'zuid'];

// ── DE KALENDER MOET ÉCHT OVERZETBAAR ZIJN ────────────────────────────────────────────────────────
//
// `get_calendars` belooft "de VOLLEDIGE WorkCalendar-definitie … genoeg om een kalender in een ANDER
// document te herbouwen" (spread van `...cal`). De schrijfkant accepteert dus ook `workTime`
// (uurbanden), `shift` (ploeg) en `generation` — anders bouwt een uurkalender in het doeldocument
// stil op als DAG-kalender.
//
//   RICHTING VAN DE NAAMDRIFT — de SCHRIJFKANT accepteert de LEESVORM, de leeskant blijft zoals hij
//   is. `generation` IS het opgeslagen modelveld (`WorkCalendar.generation`, round-trippend door
//   IFC); de leeskant hernoemen zou liegen over het model. `generate` is geen veld maar een
//   ACTIE-parameter: "draai de generator hier, over de spanne van DIT project". Ze betekenen ook
//   iets anders — `generate` materialiseert nieuwe dagen over de doel-projectspanne, `generation`
//   schrijft alleen de herkomst van de dagen die je meestuurt. Beide bestaan dus naast elkaar; ze
//   samen opgeven is tegenstrijdig en wordt geweigerd.
//
// Zelfde redenering voor `holidays`: dat is de leesvorm van de GEMATERIALISEERDE lijst en betekent
// hier "zet de lijst exact hierop" (mergen zou bij een `create` de app-default-feestdagen met de
// bronlijst verenigen — stille corruptie).

const WEEKDAY_KEYS = ['1', '2', '3', '4', '5', '6', '7'];
const MIN_PER_DAY = 1440;
const SHIFT_VALUES = ['FIRST', 'SECOND', 'THIRD', 'USERDEFINED'];
/** `CalendarGeneration.ruleSetId` is een HolidayCountry — dus ZONDER de generator-waarde 'none'. */
const GEN_RULESETS = GEN_COUNTRIES.filter((c) => c !== 'none');
const BREAK_CHOICES = ['noord', 'midden', 'zuid'];

/** `minuten-vanaf-middernacht` leesbaar maken in een foutmelding (1800 ⇒ '06:00 van de volgende dag'). */
function clockLabel(min: number): string {
  const wrapped = min >= MIN_PER_DAY;
  const m = ((min % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(Math.round(m % 60)).padStart(2, '0');
  return `${hh}:${mm}${wrapped ? ' (next day)' : ''}`;
}

/** Vormvalidatie van een feestdagenlijst (gedeeld door `rawHolidays` en `holidays`). De leesvorm eist
 *  een expliciete `endDate`; of de regel bruikbaar is (einde niet vóór begin) is dezelfde regel als
 *  in de kalenderdialogen (`holidayIssue`). */
function holidayListReason(list: unknown, field: string): string | null {
  if (!Array.isArray(list)) return `\`${field}\` must be an array`;
  for (const h of list as unknown[]) {
    if (!h || typeof h !== 'object' || Array.isArray(h)) return `every item in \`${field}\` must be an object`;
    const hh = h as Record<string, unknown>;
    if (typeof hh.name !== 'string' || hh.name === '') return `every \`${field}\` exception requires a non-empty \`name\``;
    for (const k of ['startDate', 'endDate'] as const) {
      if (typeof hh[k] !== 'string' || !ISO_DATE_ONLY.test(hh[k] as string)) {
        return `\`${field}.${k}\` must be an ISO date (YYYY-MM-DD), got '${String(hh[k])}'`;
      }
    }
    if (holidayIssue({ startDate: hh.startDate as string, endDate: hh.endDate as string }) === 'endBeforeStart') {
      return `\`${field}\`: endDate '${String(hh.endDate)}' lies before startDate '${String(hh.startDate)}'`;
    }
  }
  return null;
}

/**
 * Vormvalidatie van `workTime` (uurbanden). STRENG met opzet: een half toegepaste uurkalender is
 * erger dan een weigering, want elke duur van elke taak op deze kalender hangt eraan.
 *
 * Regels (spiegelen `WorkTimeBands` in `src/types/calendar.ts` en `canonicalizeBands`):
 *   - `byWeekday` bevat ALLE dagen 1..7 — een gedeeltelijke opgave zou de ontbrekende dagen stil
 *     niet-werkend maken (dit is de gevaarlijkste stille no-op die dit veld kan hebben);
 *   - band = `[start, end)` in minuten-vanaf-middernacht van de STARTdag: `0 ≤ start < 1440`,
 *     `start < end ≤ 2880`. Een dienst over middernacht telt DOOR (22:00→06:00 = 1320→1800); een
 *     niet-oplopende band wordt NIET stil als wrap geïnterpreteerd maar geweigerd;
 *   - banden per dag oplopend en niet-overlappend, en de staart van een wrap-band mag niet over de
 *     eerste band van de volgende dag heen lopen.
 */
function workTimeReason(wt: unknown): string | null {
  if (!wt || typeof wt !== 'object' || Array.isArray(wt)) {
    return '`workTime` must be an object with `byWeekday` (or `null` to go back to a DAY calendar)';
  }
  for (const k of Object.keys(wt)) {
    if (k !== 'byWeekday') return `unknown field \`workTime.${k}\`; \`workTime\` only knows \`byWeekday\``;
  }
  const bw = (wt as { byWeekday?: unknown }).byWeekday;
  if (!bw || typeof bw !== 'object' || Array.isArray(bw)) {
    return '`workTime.byWeekday` must be an object with the weekday keys "1" to "7" (1 = Monday … 7 = Sunday)';
  }
  const rec = bw as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    if (!WEEKDAY_KEYS.includes(k)) {
      return `unknown day key \`workTime.byWeekday.${k}\`; valid keys are "1" to "7" (1 = Monday … 7 = Sunday)`;
    }
  }
  const missing = WEEKDAY_KEYS.filter((k) => rec[k] === undefined);
  if (missing.length > 0) {
    return `\`workTime.byWeekday\` must contain ALL weekdays "1" to "7" (missing: ${missing.join(', ')}); a ` +
      'day with an empty list [] is non-working. A partial specification would SILENTLY make the missing ' +
      'days non-working — give the complete week (e.g. a reading from planner_get_calendars).';
  }
  const firstBandOf = (key: string): { start: number; end: number } | undefined => {
    const l = rec[key];
    return Array.isArray(l) && l.length > 0 ? (l[0] as { start: number; end: number }) : undefined;
  };
  for (const key of WEEKDAY_KEYS) {
    const list = rec[key];
    if (!Array.isArray(list)) return `\`workTime.byWeekday.${key}\` must be an array of bands ([] = non-working day)`;
    const bad = bandListReason(list, `workTime.byWeekday.${key}`);
    if (bad) return bad;
    const prevEnd = list.length > 0 ? (list[list.length - 1] as { end: number }).end : -1;
    // Wrap-staart mag niet over de eerste band van de VOLGENDE dag heen lopen (7 wrapt naar 1).
    if (prevEnd > MIN_PER_DAY) {
      const nextKey = key === '7' ? '1' : String(Number(key) + 1);
      const next = firstBandOf(nextKey);
      if (next && isFiniteNumber(next.start) && next.start < prevEnd - MIN_PER_DAY) {
        return `\`workTime.byWeekday.${key}\`: the band runs until ${clockLabel(prevEnd)} and overlaps the first band of day ${nextKey} (${clockLabel(next.start)})`;
      }
    }
  }
  return null;
}

/**
 * Vorm van één lijst banden `[start, end)` in minuten-vanaf-middernacht van de STARTdag: gedeeld door
 * `workTime.byWeekday.<dag>` en `workingExceptions[].bands` (zelfde canonieke vorm, `WorkTimeBands`).
 * `label` is het veldpad in de melding.
 */
function bandListReason(list: unknown[], label: string): string | null {
  let prevEnd = -1;
  for (const raw of list) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return `every band in \`${label}\` must be an object {start, end} (minutes from midnight)`;
    }
    const b = raw as Record<string, unknown>;
    for (const k of Object.keys(b)) {
      if (k !== 'start' && k !== 'end') return `unknown field \`${label}[].${k}\`; a band only knows \`start\` and \`end\``;
    }
    if (!isFiniteNumber(b.start) || !isFiniteNumber(b.end)) {
      return `\`${label}\`: \`start\` and \`end\` must be numbers in MINUTES from midnight (07:00 = 420)`;
    }
    const start = b.start;
    const end = b.end;
    if (start < 0 || start >= MIN_PER_DAY) {
      return `\`${label}\`: \`start\` ${start} falls outside the day; valid is 0 to 1439 minutes from midnight (0:00–23:59)`;
    }
    if (end <= start) {
      return `\`${label}\`: \`end\` ${end} (${clockLabel(end)}) does not lie after \`start\` ${start} (` +
        `${clockLabel(start)}). A shift across midnight keeps COUNTING in minutes: 22:00→06:00 is start ` +
        '1320, end 1800 — not 1320→360.';
    }
    if (end > 2 * MIN_PER_DAY) {
      return `\`${label}\`: \`end\` ${end} exceeds 2880 (a band may end at most 24 hours after midnight of the start day)`;
    }
    if (start < prevEnd) {
      return `\`${label}\`: the bands overlap or are out of order (band from ${clockLabel(start)} starts before the end ${clockLabel(prevEnd)} of the previous one); give them ascending and non-overlapping`;
    }
    prevEnd = end;
  }
  return null;
}

/** Vormvalidatie van `workingExceptions` (leesvorm): datums en volgorde zoals feestdagen
 *  (`holidayListReason`, dus ook `holidayIssue`), optioneel `bands` in de vorm van `workTime`. */
function workingExceptionsReason(list: unknown): string | null {
  const field = 'workingExceptions';
  const shape = holidayListReason(list, field);
  if (shape) return shape;
  for (const raw of list as Record<string, unknown>[]) {
    for (const k of Object.keys(raw)) {
      if (!['name', 'startDate', 'endDate', 'bands'].includes(k)) {
        return `unknown field \`${field}[].${k}\`; a working exception only knows name, startDate, endDate and (optionally) bands`;
      }
    }
    if (raw.bands === undefined) continue;
    if (!Array.isArray(raw.bands)) {
      return `\`${field}[].bands\` must be an array of bands (omitted = the normal working time of the calendar)`;
    }
    const bad = bandListReason(raw.bands, `${field}[].bands`);
    if (bad) return bad;
  }
  return null;
}

/** Leesbare reden bij een ongeldig pauzepatroon (zelfde regels als de kalenderdialoog). */
function scalarBreakReason(issue: ScalarBreakIssue, cal: Pick<WorkCalendar, 'workStartHour' | 'workEndHour' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>): string {
  const day = `${clockLabel(cal.workStartHour * 60)}–${clockLabel(cal.workEndHour * 60)}`;
  const pause = `break from ${clockLabel(cal.simpleBreakStartMinute ?? 12 * 60)}, ${String(cal.simpleBreakDurationMinutes ?? 0)} min`;
  switch (issue) {
    case 'invalidDuration':
      return '`simpleBreakDurationMinutes` must be a whole number of minutes of 0 or more (0 = no break)';
    case 'outsideWorkingDay':
      return `the ${pause} must fall entirely within the working day ${day} (\`simpleBreakStartMinute\`/\`simpleBreakDurationMinutes\` in MINUTES, 12:30 = 750)`;
    case 'consumesWorkingDay':
      return `the ${pause} covers the whole working day ${day}; no working time is left`;
  }
}

/** Vormvalidatie van `generation` (de LEESVORM van de herkomst-metadata). */
function generationReason(gen: unknown): string | null {
  if (!gen || typeof gen !== 'object' || Array.isArray(gen)) {
    return '`generation` must be an object as get_calendars returns it (`ruleSetId`, optionally ' +
      '`region`/`breakChoice`, `generatedFromYear`, `generatedToYear`), or `null` to clear the provenance';
  }
  const g = gen as Record<string, unknown>;
  const allowed = ['ruleSetId', 'region', 'breakChoice', 'generatedFromYear', 'generatedToYear'];
  for (const k of Object.keys(g)) {
    if (!allowed.includes(k)) {
      if (k === 'country' || k === 'bouwvak') {
        return `\`generation.${k}\` does not exist; those are the keys of \`generate\` (the GENERATOR). In ` +
          '`generation` (the read form) they are called `ruleSetId` and `breakChoice`.';
      }
      return `unknown field \`generation.${k}\`; allowed: ${allowed.join(', ')}`;
    }
  }
  if (!(GEN_RULESETS as string[]).includes(g.ruleSetId as string)) {
    return `unknown \`generation.ruleSetId\` '${String(g.ruleSetId)}'; valid values are ` +
      `${GEN_RULESETS.join(', ')} (case-sensitive; 'none' does not exist here — leave \`generation\` out or ` +
      'give `null` for a literal calendar)';
  }
  if (g.region !== undefined && typeof g.region !== 'string') return '`generation.region` must be a string';
  if (g.breakChoice !== undefined && !BREAK_CHOICES.includes(g.breakChoice as string)) {
    return `unknown \`generation.breakChoice\` '${String(g.breakChoice)}'; valid values are ` +
      `${BREAK_CHOICES.join(', ')} (NO construction holiday = leave the field out)`;
  }
  for (const k of ['generatedFromYear', 'generatedToYear'] as const) {
    if (!Number.isInteger(g[k]) || (g[k] as number) < 1000 || (g[k] as number) > 9999) {
      return `\`generation.${k}\` must be a year (integer, 1000–9999), got '${String(g[k])}'`;
    }
  }
  if ((g.generatedToYear as number) < (g.generatedFromYear as number)) {
    return `\`generation.generatedToYear\` (${String(g.generatedToYear)}) lies before \`generatedFromYear\` (${String(g.generatedFromYear)})`;
  }
  return null;
}

/**
 * Vormvalidatie van één kalender-item. Retourneert een leesbare weigeringsreden of `null`.
 * Elke weigering NOEMT de geldige verzameling, zodat de AI zich in één ronde kan corrigeren.
 */
function calendarItemReason(item: CalendarItem): string | null {
  // Allowlist-patroon: onbekende sleutels ketsen af MÉT de toegestane lijst; de afgeleide leesvelden van
  // get_calendars worden geaccepteerd (en verderop als `ignoredFields` gemeld).
  for (const key of Object.keys(item)) {
    if (CAL_ITEM_KEYS.includes(key) || CAL_READONLY_KEYS.includes(key)) continue;
    return `unknown field \`${key}\`; a calendar item only knows: ${CAL_ITEM_KEYS.join(', ')} (the derived ` +
      `read fields ${CAL_READONLY_KEYS.join(', ')} may come along but are ignored)`;
  }
  if (item.name !== undefined && typeof item.name !== 'string') return '`name` must be a string';
  if (item.description !== undefined && typeof item.description !== 'string') return '`description` must be a string';
  if (item.workDays !== undefined) {
    if (!Array.isArray(item.workDays) || item.workDays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
      return '`workDays` must be an array of ISO weekday numbers (1 = Monday … 7 = Sunday)';
    }
  }
  for (const k of ['workStartHour', 'workEndHour', 'hoursPerDay'] as const) {
    if (item[k] !== undefined && !isFiniteNumber(item[k])) return `\`${k}\` must be a number in HOURS`;
  }
  if (item.simpleBreakStartMinute !== undefined
    && (!Number.isInteger(item.simpleBreakStartMinute) || item.simpleBreakStartMinute < 0 || item.simpleBreakStartMinute >= MIN_PER_DAY)) {
    return '`simpleBreakStartMinute` must be a whole number of MINUTES from midnight (0–1439; 12:30 = 750)';
  }
  if (item.simpleBreakDurationMinutes !== undefined
    && (!Number.isInteger(item.simpleBreakDurationMinutes) || item.simpleBreakDurationMinutes < 0 || item.simpleBreakDurationMinutes > MIN_PER_DAY)) {
    return '`simpleBreakDurationMinutes` must be a whole number of minutes (0–1440; 0 = no break)';
  }
  if (item.workingExceptions !== undefined) {
    const bad = workingExceptionsReason(item.workingExceptions);
    if (bad) return bad;
  }

  // ── Uur-kalender: banden + ploeg ──────────────────────────────────────────────────────────────
  if (item.workTime !== undefined && item.workTime !== null) {
    const bad = workTimeReason(item.workTime);
    if (bad) return bad;
  }
  if (item.shift !== undefined && item.shift !== null && !SHIFT_VALUES.includes(item.shift)) {
    return `unknown \`shift\` '${String(item.shift)}'; valid values are ${SHIFT_VALUES.join(', ')} ` +
      '(case-sensitive; `null` clears the shift classification)';
  }

  // ── Herkomst + feestdagen: één bron tegelijk ──────────────────────────────────────────────────
  if (item.generation !== undefined && item.generation !== null) {
    const bad = generationReason(item.generation);
    if (bad) return bad;
  }
  if (item.generation !== undefined && item.generate !== undefined) {
    return 'give `generate` OR `generation`, not both: `generate` RUNS the generator over the project span ' +
      'of this document (and sets the provenance itself), while `generation` only writes the provenance ' +
      'metadata for holidays you send along';
  }
  if (item.holidays !== undefined) {
    const bad = holidayListReason(item.holidays, 'holidays');
    if (bad) return bad;
    if (item.rawHolidays !== undefined) {
      return 'give `holidays` OR `rawHolidays`, not both: `holidays` sets the COMPLETE list exactly (the ' +
        'read form of get_calendars), `rawHolidays` adds individual exceptions';
    }
    if (item.holidaysMode !== undefined) {
      return '`holidaysMode` belongs to `rawHolidays`; `holidays` replaces the list exactly by definition';
    }
    if (item.generate !== undefined) {
      return 'give `holidays` OR `generate`, not both: the generator would immediately overwrite the list ' +
        'you sent with days over the project span of THIS document';
    }
  }

  if (item.generate !== undefined) {
    const g = item.generate as unknown;
    if (!g || typeof g !== 'object' || Array.isArray(g)) return '`generate` must be an object with at least `country`';
    const gen = g as Record<string, unknown>;
    if (!(GEN_COUNTRIES as string[]).includes(gen.country as string)) {
      return `unknown \`generate.country\` '${String(gen.country)}'; valid values are ` +
        `${GEN_COUNTRIES.join(', ')} (case-sensitive; 'none' = no holiday set, clears the generated days)`;
    }
    if (gen.region !== undefined && typeof gen.region !== 'string') return '`generate.region` must be a string';
    if (gen.bouwvak !== undefined && !BOUWVAK_CHOICES.includes(gen.bouwvak as string)) {
      return `unknown \`generate.bouwvak\` '${String(gen.bouwvak)}'; valid values are ${BOUWVAK_CHOICES.join(', ')}`;
    }
  }

  if (item.holidaysMode !== undefined) {
    if (item.holidaysMode !== 'merge' && item.holidaysMode !== 'replace') {
      return `unknown \`holidaysMode\` '${String(item.holidaysMode)}'; valid values are merge, replace`;
    }
    if (item.rawHolidays === undefined) {
      return '`holidaysMode` only has meaning together with `rawHolidays`';
    }
  }

  if (item.rawHolidays !== undefined) {
    if (!Array.isArray(item.rawHolidays)) return '`rawHolidays` must be an array';
    // DE stille no-op: een lege lijst in de (default) TOEVOEG-modus verandert per definitie niets en
    // mag dus geen geslaagde wijziging heten. Een agent die een feestdag wil VERWIJDEREN stuurt
    // precies dit (de overblijvende dagen ⇒ vaak leeg).
    if (item.rawHolidays.length === 0 && (item.holidaysMode ?? 'merge') === 'merge') {
      return 'an empty `rawHolidays` changes nothing in the default ADD mode; use `holidaysMode: "replace"` ' +
        'to replace or clear the holiday list';
    }
    const bad = holidayListReason(item.rawHolidays, 'rawHolidays');
    if (bad) return bad;
  }

  // ── Dag↔uur-consistentie: `workDays` volgt de banden (zoals de kalenderdialoog) ────────────────
  // De banden-editor leidt `workDays` áltijd af uit de banden (`CalendarForm.applyBands`). Twee
  // tegenstrijdige bronnen in één item zouden een kalender opleveren waarin de solver op dag k wél
  // een werkdag ziet (`isWorkDay` leest `workDays`) maar geen enkele band kan materialiseren.
  if (item.workTime !== undefined && item.workTime !== null && item.workDays !== undefined) {
    const derived = workDaysFromBands(item.workTime).join(',');
    const given = [...item.workDays].sort((a, b) => a - b).join(',');
    if (derived !== given) {
      return `\`workDays\` (${given || 'empty'}) contradicts \`workTime\`: the bands yield working days ` +
        `${derived || 'empty'}. Leave \`workDays\` out (it is derived from the bands) or make both equal.`;
    }
  }
  return null;
}

type CalendarPlan =
  | { mode: 'update'; item: CalendarItem; targetId: string; needsPromotion: boolean }
  | { mode: 'create'; item: CalendarItem };

/**
 * Statische classificatie van een kalender-batch (bestaan / projectkalender-promotie / create /
 * leeg-item). GEDEELD door het lege-batch-snelpad en de transactie-fn, zodat beide exact dezelfde
 * weigeringen produceren.
 */
function classifyCalendars(s: StoreState, items: CalendarItem[]): { plans: CalendarPlan[]; rejections: Rejection[] } {
  const plans: CalendarPlan[] = [];
  const rejections: Rejection[] = [];
  for (const item of items) {
    const label = typeof item?.id === 'string' ? item.id : String(item?.id);
    if (!item || typeof item.id !== 'string' || item.id === '') {
      rejections.push({ id: label, reason: 'every calendar item requires a non-empty string `id`' });
      continue;
    }
    // Vormvalidatie vóór élke dispatch-beslissing: een item met een onbruikbare `generate`/
    // `rawHolidays` mag nooit een transactie openen (het zou daarbinnen klappen of stil niets doen).
    const badShape = calendarItemReason(item);
    if (badShape) {
      rejections.push({ id: item.id, reason: badShape });
      continue;
    }
    const inLibrary = s.calendars.some((c) => c.id === item.id);
    const isProjectCal = item.id === s.calendar.id;
    const hasFields = CAL_FIELD_KEYS.some((k) => item[k] !== undefined);
    if (inLibrary || isProjectCal) {
      if (!hasFields) {
        rejections.push({
          id: item.id,
          reason: `no changes given; an item must carry at least one of these fields: ${CAL_FIELD_KEYS.join(', ')}`,
        });
        continue;
      }
      const existing = s.calendars.find((c) => c.id === item.id) ?? s.calendar;
      const badBreak = mergedBreakReason(item, existing) ?? netHoursReason(item, existing);
      if (badBreak) {
        rejections.push({ id: item.id, reason: badBreak });
        continue;
      }
      plans.push({ mode: 'update', item, targetId: item.id, needsPromotion: !inLibrary });
      continue;
    }
    if (item.create === true) {
      const base = newCalendarBase(item);
      const badBreak = mergedBreakReason(item, base) ?? netHoursReason(item, base);
      if (badBreak) {
        rejections.push({ id: item.id, reason: badBreak });
        continue;
      }
      plans.push({ mode: 'create', item });
      continue;
    }
    rejections.push({
      id: item.id,
      reason: `calendar '${item.id}' does not exist in this document; pass \`create: true\` to create it (calendar ids are per document)`,
    });
  }
  return { plans, rejections };
}

/** Spanne voor `computeGenerateSpan` (via resolveCalendarHolidays). Bij wijzigen telt het latere van
 *  het ingevoerde en het berekende projecteinde. Bij AANMAAK geven we bewust een
 *  LEEG projecteinde door: dan geldt de create-spanne (startjaar−1 t/m startjaar+3) i.p.v. een
 *  spanne rond een einddatum die nog niets met deze nieuwe kalender te maken heeft. */
function calendarSpan(s: StoreState, forCreate: boolean): { projectStart: string; projectEnd: string } {
  const endDate = s.project.endDate || '';
  const calculatedEnd = s.cpmResult?.projectEnd || '';
  return {
    projectStart: s.project.startDate,
    projectEnd: forCreate ? '' : (endDate > calculatedEnd ? endDate : calculatedEnd),
  };
}

/** Diepe kopie van de banden (alle zeven dagsleutels; de validatie eist ze) — er belandt nooit een
 *  door de aanroeper vastgehouden object in de store. */
function cloneBands(wt: WorkTimeBands): WorkTimeBands {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (let wd = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7; wd <= 7; wd = (wd + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    byWeekday[wd] = (wt.byWeekday[wd] ?? []).map((b) => ({ start: b.start, end: b.end }));
  }
  return { byWeekday };
}

/** Basis van een nieuwe kalender (`create: true`): de gedeelde fabriek, met de naam van het item. */
function newCalendarBase(item: CalendarItem): Omit<WorkCalendar, 'id'> {
  return createNewCalendar(item.name ?? 'New calendar');
}

type CalendarBase = Omit<WorkCalendar, 'id'>;

/**
 * Zou dit item, samengevoegd met `existing`, een ongeldig pauzepatroon opleveren? Zelfde regels als
 * de kalenderdialoog (`calendarScalarBreakIssue`), alleen getoetst als het item de werkdag of de
 * pauze raakt — een naamswijziging op een kalender met oude, ongeldige data blijft mogelijk.
 */
function mergedBreakReason(item: CalendarItem, existing: CalendarBase): string | null {
  const touches = item.workStartHour !== undefined || item.workEndHour !== undefined
    || item.simpleBreakStartMinute !== undefined || item.simpleBreakDurationMinutes !== undefined;
  if (!touches) return null;
  const merged = { ...existing, ...calendarFieldPatch(item, existing) };
  const issue = calendarScalarBreakIssue(merged);
  return issue ? scalarBreakReason(issue, merged) : null;
}

/** Uren leesbaar in een reden, zoals de dialoog ze toont (twee decimalen): 8, 8.5, 8.33. */
function hoursLabel(hours: number): string {
  return String(Math.round(hours * 100) / 100);
}

/**
 * NETTO UREN OP EEN KALENDER MET PAUZE ("MCP doet wat de kalenderdialoog doet"). In de dialoog is
 * "Standaard werkdag" een afleiding uit werkdag − pauze (`simpleBreakPatch` → `simpleBreakNetHours`).
 * Een meegegeven `hoursPerDay` voor een DAG-kalender met (na samenvoegen) een pauzepatroon moet dus
 * gelijk zijn aan werkdag − pauze; afwijkend ⇒ zachte weigering met de velden die de AI wél moet
 * wijzigen, gelijk ⇒ no-op (`calendarFieldPatch` neemt de afgeleide waarde).
 *
 * "Gelijk" is gelijk op de MINUUT: werkdag en pauze zijn hele minuten, en de dialoog toont twee
 * decimalen (8,33 voor 8 u 20 min), wat hoogstens 0,3 min afwijkt.
 *
 * Hier buiten: een legacy-kalender zonder pauzevelden (daar is `hoursPerDay` de
 * opgave en leidt de engine juist de impliciete pauze eruit af) en een uurkalender (banden leidend).
 */
function netHoursReason(item: CalendarItem, existing: CalendarBase): string | null {
  if (item.hoursPerDay === undefined) return null;
  const merged: CalendarBase = { ...existing, ...calendarFieldPatch(item, existing) };
  if (item.workTime === null) delete merged.workTime;
  if (merged.workTime !== undefined) return null;
  if (merged.simpleBreakStartMinute === undefined && merged.simpleBreakDurationMinutes === undefined) return null;
  const net = simpleBreakNetHours(merged);
  if (net === undefined) {
    // Alleen bij oude/externe data met een ongeldige pauze (een item dat werkdag of pauze raakt, is
    // al door `mergedBreakReason` getoetst). De dialoog laat dan ook niets toepassen.
    const issue = calendarScalarBreakIssue(merged);
    return `${issue ? scalarBreakReason(issue, merged) : 'the break pattern is invalid'}; the net hours ` +
      '(`hoursPerDay`) follow from working day minus break, so fix the break first ' +
      '(`simpleBreakStartMinute`/`simpleBreakDurationMinutes`) or the working day ' +
      '(`workStartHour`/`workEndHour`)';
  }
  if (Math.abs(item.hoursPerDay - net) * 60 < 0.5) return null;

  const start = merged.workStartHour * 60;
  const end = merged.workEndHour * 60;
  const pause = merged.simpleBreakDurationMinutes ?? 0;
  const wanted = item.hoursPerDay * 60;
  // Twee concrete uitwegen, alleen als ze zelf geldig zijn: de werkdag later/eerder laten eindigen, of
  // de pauze aanpassen (begin en pauzebegin gelijk).
  const examples: string[] = [];
  if (Number.isInteger(wanted)) {
    const altEnd = start + wanted + pause;
    // Alleen als het label (twee decimalen) exact die minuut is: 15.25 wel, 15.33 (= 15:19,8) niet.
    const endLabel = hoursLabel(altEnd / 60);
    if (altEnd > start && altEnd <= MIN_PER_DAY && Math.abs(Number(endLabel) * 60 - altEnd) < 1e-6
      && !calendarScalarBreakIssue({ ...merged, workEndHour: altEnd / 60 })) {
      examples.push(`\`workEndHour: ${endLabel}\``);
    }
    const altPause = end - start - wanted;
    if (altPause >= 0 && !calendarScalarBreakIssue({ ...merged, simpleBreakDurationMinutes: altPause })) {
      examples.push(`\`simpleBreakDurationMinutes: ${altPause}\``);
    }
  }
  return `\`hoursPerDay\` ${hoursLabel(item.hoursPerDay)} does not match this calendar: with a break the net ` +
    'hours are DERIVED from working day minus break, like the non-editable "Standard workday" in the ' +
    `calendar dialog — here ${clockLabel(start)}–${clockLabel(end)} with ${pause} min break = ` +
    `${hoursLabel(net)}h net. Leave \`hoursPerDay\` out, or change the working day ` +
    '(`workStartHour`/`workEndHour`, in HOURS) or the break duration (`simpleBreakDurationMinutes`, in ' +
    `MINUTES) so that working day minus break becomes ${hoursLabel(item.hoursPerDay)}h` +
    `${(examples.length > 0 ? ` (e.g. ${examples.join(' or ')})` : '')}`;
}

/** De scalaire (niet-holiday) velden van een item als `Partial<WorkCalendar>`. `existing` levert de
 *  fallback voor de afgeleide `hoursPerDay` (bij `create` de basis uit `newCalendarBase`). */
function calendarFieldPatch(item: CalendarItem, existing: CalendarBase): Partial<WorkCalendar> {
  const patch: Partial<WorkCalendar> = {};
  if (item.name !== undefined) patch.name = item.name;
  if (item.description !== undefined) patch.description = item.description;
  if (item.workDays !== undefined) patch.workDays = [...item.workDays];
  if (item.workStartHour !== undefined) patch.workStartHour = item.workStartHour;
  if (item.workEndHour !== undefined) patch.workEndHour = item.workEndHour;
  if (item.hoursPerDay !== undefined) patch.hoursPerDay = item.hoursPerDay;
  if (item.workTime !== undefined && item.workTime !== null) {
    const bands = cloneBands(item.workTime);
    patch.workTime = bands;
    // Spiegelt `CalendarForm.applyBands` (de kalenderdialoog): de werkdagen volgen de banden. `hoursPerDay`
    // volgt ze met dezelfde regel als het venster: één call is één sessie, met `existing` (de kalender vóór
    // de call) als beginstand. Hij volgt dus alleen als hij gelijk was aan de modale dagsom van de blokken
    // van vóór de call; een bewuste afwijking (P6 `day_hr_cnt`, bv. Late ploeg 14–24 met 8) blijft staan.
    // Een dagkalender (ook `create`) heeft geen blokken en volgt (`hoursPerDayForBlocks` in `subdayIo.ts`).
    // Zijn ze expliciet meegegeven (een letterlijke lezing stuurt ze mee), dan is die opgave leidend —
    // `calendarItemReason` heeft dan al vastgesteld dat `workDays` de banden niet tegenspreekt.
    if (item.workDays === undefined) patch.workDays = workDaysFromBands(bands);
    if (item.hoursPerDay === undefined) patch.hoursPerDay = hoursPerDayForBlocks(existing, existing, bands);
  }
  // ALLEEN `workDays` OP EEN UURKALENDER (review PR #351): de blokken gaan mee via dezelfde functie als de
  // werkdagknoppen in het kalendervenster (`workDaysSetPatch`, één regel). Eerst gaan de nieuwe dagen aan,
  // daarna de andere uit. Een nieuwe werkdag krijgt een kopie van de eerste werkdag met blokken (volgorde
  // zondag, maandag … zaterdag; `firstBlockedDay`); is er geen, dan de blokken van de eigen enkelvoudige
  // werkdag (begin, einde, pauze), en pas daarna 07–12 + 13–16. Een vervallen werkdag verliest zijn blokken.
  // `hoursPerDay` volgt de nieuwe blokken alleen als hij gelijk was aan de modale dagsom van de blokken van
  // vóór de call; een bewuste afwijking (P6 `day_hr_cnt`, bv. Late ploeg 14–24 met 8) blijft staan
  // (`hoursPerDayForBlocks` in `subdayIo.ts`). Een `hoursPerDay` in het item zelf wint altijd. Zonder dit bleef een werkdag
  // zonder blokken achter, en na een IFC-rondgang kreeg die dag stil de blokken van maandag.
  // Gelijk aan het venster geldt alleen voor een geldige kalender. Startpunt zijn hier de werkdagen volgens
  // de BLOKKEN, niet de opgeslagen `workDays`: op een kalender die al tegenstrijdig was, ruimt MCP dus
  // bewust op (een werkdag zonder blokken krijgt alsnog blokken).
  if (item.workDays !== undefined && item.workTime === undefined && existing.workTime !== undefined) {
    const fromBands = { ...existing, workDays: workDaysFromBands(existing.workTime) };
    Object.assign(patch, workDaysSetPatch(fromBands, item.workDays));
    if (item.hoursPerDay !== undefined) patch.hoursPerDay = item.hoursPerDay;
  }
  if (item.shift !== undefined && item.shift !== null) patch.shift = item.shift;
  if (item.simpleBreakStartMinute !== undefined) patch.simpleBreakStartMinute = item.simpleBreakStartMinute;
  if (item.simpleBreakDurationMinutes !== undefined) patch.simpleBreakDurationMinutes = item.simpleBreakDurationMinutes;
  if (item.workingExceptions !== undefined && item.workingExceptions.length > 0) {
    patch.workingExceptions = item.workingExceptions.map((w) => ({
      name: w.name, startDate: w.startDate, endDate: w.endDate,
      ...(w.bands !== undefined ? { bands: w.bands.map((b) => ({ start: b.start, end: b.end })) } : {}),
    }));
  }
  // PAUZE ↔ NETTO UREN, zoals de kalenderdialoog (`simpleBreakPatch`, één definitie): raakt het item
  // de pauze, of de werkdag van een kalender die al een expliciete pauze heeft, dan wordt een legacy-
  // pauze eerst expliciet en volgt `hoursPerDay` uit werkdag + pauze — anders zegt het veld (en de
  // respons) 8 terwijl de engine 9 rekent. Niet op een UURkalender (daar zijn de banden leidend en
  // leidt de banden-tak hierboven `hoursPerDay` af). Werkdag wijzigen op een legacy-kalender zonder
  // pauzevelden blijft zoals het was.
  const touchesBreak = item.simpleBreakStartMinute !== undefined || item.simpleBreakDurationMinutes !== undefined;
  const touchesDay = item.workStartHour !== undefined || item.workEndHour !== undefined;
  const hasExplicitBreak = existing.simpleBreakStartMinute !== undefined || existing.simpleBreakDurationMinutes !== undefined;
  const hourCalendar = item.workTime === null ? false : (patch.workTime ?? existing.workTime) !== undefined;
  if (!hourCalendar && (touchesBreak || (hasExplicitBreak && touchesDay))) {
    const scalar: Partial<WorkCalendar> = {};
    for (const k of ['workStartHour', 'workEndHour', 'simpleBreakStartMinute', 'simpleBreakDurationMinutes'] as const) {
      if (patch[k] !== undefined) scalar[k] = patch[k];
    }
    Object.assign(patch, simpleBreakPatch(existing, scalar));
  }
  // Een meegegeven `hoursPerDay` op een DAG-kalender met pauzepatroon is geen opgave maar een
  // afleiding, net als in de dialoog: `netHoursReason` heeft een afwijkende waarde al geweigerd, dus
  // wat hier aankomt is gelijk en geldt de exacte afgeleide waarde (no-op). Legacy zonder pauzevelden:
  // `simpleBreakNetHours` geeft `undefined` en de opgave blijft staan.
  if (item.hoursPerDay !== undefined && !hourCalendar) {
    const net = simpleBreakNetHours({ ...existing, ...patch });
    if (net !== undefined) patch.hoursPerDay = net;
  }
  return patch;
}

// ── Dag↔uur-kalenderomschakeling ────────────────────────────────────────────────────────────────
// Een kalender bepaalt alleen de plaatsing. Een moduswissel mag dus uitsluitend als planningseffect
// worden gemeld; `durationUnit`, `scheduleDuration` en `durationMinutes` blijven onaangeroerd.

function calendarMode(cal: Pick<WorkCalendar, 'workTime'>): 'hour' | 'day' {
  return isHourModeCalendar(cal) ? 'hour' : 'day';
}

/**
 * Los de definitieve feestdagenlijst op voor één item, inclusief de VERVANG-modus.
 *
 * ONTWERPKEUZE. `resolveCalendarHolidays` (calendarGenerate.ts) is bewust alleen-toevoegend: het
 * MERGET rauwe uitzonderingen in de bestaande lijst. `holidaysMode: 'replace'` maakt VERWIJDEREN
 * mogelijk zónder die semantiek te breken:
 *   - default (`merge`)  ⇒ dedup-merge met wat er stond;
 *   - `replace`          ⇒ de lijst wordt EXACT de opgegeven `rawHolidays` (leeg = alles wissen).
 * De vervangmodus wordt hier afgehandeld i.p.v. in `calendarGenerate.ts`, omdat `generate` al
 * vervangend werkt (de generator negeert `existing.holidays`): alleen het generator-LOZE pad hoefde
 * een vervangvariant. Bij `replace` vervalt een bestaande `generation` — anders zou een latere
 * regenerate de bewust gewiste dagen terugbrengen.
 */
function resolveHolidaysForItem(
  item: CalendarItem,
  span: { projectStart: string; projectEnd: string },
  existing: Pick<WorkCalendar, 'holidays' | 'generation'>,
): { holidays: Holiday[]; generation?: WorkCalendar['generation']; becameLiteral: boolean } {
  // LETTERLIJKE OVERDRACHT — `holidays` is de leesvorm van get_calendars en betekent "zet de
  // lijst exact hierop". Bewust NIET mergend: bij een `create` zou de app-default-feestdagenset zich
  // stil met de bronlijst verenigen. Komt er een `generation` mee, dan blijft de kalender
  // gegenereerd (de herkomst reist mee); anders is de overgezette lijst per definitie letterlijk.
  if (item.holidays !== undefined) {
    const holidays = [...item.holidays].sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (item.generation !== undefined) return { holidays, becameLiteral: false };
    return { holidays, becameLiteral: existing.generation !== undefined };
  }
  if (item.holidaysMode === 'replace' && item.generate === undefined) {
    const holidays = [...(item.rawHolidays ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
    return { holidays, becameLiteral: existing.generation !== undefined };
  }
  return resolveCalendarHolidays({ generate: item.generate, rawHolidays: item.rawHolidays }, span, existing);
}

/** Vormvalidatie van `update_calendar`; string = foutboodschap. */
function parseUpdateCalendar(args: unknown): CalendarItem[] | string {
  const a = (args ?? {}) as { calendars?: unknown };
  if (!Array.isArray(a.calendars) || a.calendars.length === 0) {
    return 'update_calendar requires a non-empty `calendars` array';
  }
  return a.calendars as CalendarItem[];
}

/** Synchrone, transactie-vrije kern van `update_calendar` (zie de batchStep-noot in taskTools.ts). */
function updateCalendarCore(ctx: McpContext, items: CalendarItem[]): MutationOutcome {
    const { plans, rejections } = classifyCalendars(ctx.app.store.getState(), items);
    const rows: Record<string, unknown>[] = [];
    for (const plan of plans) {
      const item = plan.item;
      const wantsHolidays =
        item.generate !== undefined || item.rawHolidays !== undefined || item.holidays !== undefined;
      // De afgeleide leesvelden van get_calendars mogen mee, maar worden gemeld i.p.v. stil geslikt.
      const ignoredFields = CAL_READONLY_KEYS.filter((k) => k in (item as unknown as Record<string, unknown>));

      if (plan.mode === 'create') {
        // Basis = de gedeelde fabriek voor een nieuwe kalender (app-default ma-vr 07-16, dezelfde
        // als "+" in de kalenderdialoog en de resourcerij); de opgegeven velden overschrijven hem.
        // Zonder id: draft.addCalendar genereert een vers, document-lokaal id.
        const base = newCalendarBase(item);
        const cal: Omit<WorkCalendar, 'id'> = {
          ...base,
          ...calendarFieldPatch(item, base),
        };
        // Een verse kalender erft de dag-vorm van de app-default; een expliciete `workTime: null`
        // (of het ontbreken van banden in de lezing) hoort geen uur-kalender op te leveren.
        if (item.workTime === null) delete cal.workTime;
        if (item.shift === null) delete cal.shift;
        let becameLiteral = false;
        if (wantsHolidays) {
          const r = resolveHolidaysForItem(
            item,
            calendarSpan(ctx.app.store.getState(), true),
            { holidays: base.holidays, generation: base.generation },
          );
          cal.holidays = r.holidays;
          // `delete` i.p.v. `= undefined`: een sleutel-met-undefined is niet hetzelfde als een
          // afwezige sleutel (codebase-conventie, zie ook setStatusDate) — een letterlijke
          // kalender hoort geen `generation`-sleutel te dragen.
          if (r.generation !== undefined) cal.generation = r.generation;
          else delete cal.generation;
          becameLiteral = r.becameLiteral;
        }
        // Expliciete herkomst (de leesvorm) wint altijd — ook zonder feestdagen-opgave.
        if (item.generation === null) delete cal.generation;
        else if (item.generation !== undefined) cal.generation = { ...item.generation };
        const newId = ctx.transactions.draft.addCalendar(cal);
        // MAAK DE GEËRFDE FEESTDAGEN ZICHTBAAR. De basis is `createNewCalendar()`, en die levert in
        // bouwmodus (de default) een VOLLEDIGE NL-feestdagenset mét `generation`. Een agent die "een
        // lege kalender" aanmaakt krijgt dus ~30 NL-feestdagen mee; de herkomst staat daarom per rij en
        // de handler zet er een waarschuwing bij.
        const holidaysFrom = item.generate !== undefined
          ? 'generate'
          : item.holidays !== undefined
            ? 'holidays'
            : item.rawHolidays !== undefined ? 'rawHolidays' : 'app-default';
        const created = ctx.app.store.getState().calendars.find((c) => c.id === newId)!;
        const createdMode = calendarMode(created);
        rows.push({
          id: newId, requestedId: item.id, created: true, promoted: false, becameLiteral,
          holidayCount: cal.holidays.length,
          holidaysFrom,
          mode: createdMode,
          hoursPerDayEffective: effHoursPerDay(created),
          ...(created.shift ? { shift: created.shift } : {}),
          ...(ignoredFields.length > 0 ? { ignoredFields } : {}),
        });
        continue;
      }

      // Doel is de projectkalender die nog niet in de bibliotheek staat ⇒ eerst promoveren.
      // `ensureProjectCalendarInLibrary` is puur additief (geen undo-snapshot, geen recompute) en
      // dus transactie-veilig.
      let promoted = false;
      if (plan.needsPromotion) {
        ctx.app.store.getState().ensureProjectCalendarInLibrary();
        promoted = true;
      }
      const existing = ctx.app.store.getState().calendars.find((c) => c.id === plan.targetId);
      if (!existing) {
        // Kan alleen bij een defect in de promotie — harde stap-fout i.p.v. stil doorgaan.
        throw new McpStepError('NOT_FOUND', `calendar '${plan.targetId}' does not exist (after promotion)`);
      }
      // Modus-ijkpunt vóór de mutatie; native taakduren worden nooit geconverteerd.
      const beforeMode = calendarMode(existing);
      const updates = calendarFieldPatch(item, existing) as Partial<WorkCalendar>;
      let becameLiteral = false;
      // `draft.updateCalendar` doet een Object.assign en kan dus geen sleutel VERWIJDEREN; alles wat
      // weg moet (herkomst, banden, ploeg) verzamelen we hier en wissen we in één gerichte producer.
      const dropKeys: ('generation' | 'workTime' | 'shift' | 'workingExceptions')[] = [];
      let dropGeneration = false;
      if (wantsHolidays) {
        const r = resolveHolidaysForItem(
          item,
          calendarSpan(ctx.app.store.getState(), false),
          { holidays: existing.holidays, generation: existing.generation },
        );
        updates.holidays = r.holidays;
        if (r.generation !== undefined) updates.generation = r.generation;
        // Bij `becameLiteral` MOET de bestaande herkomst weg (anders zou een regenerate later de
        // rauwe dagen wegvagen).
        else dropGeneration = existing.generation !== undefined;
        becameLiteral = r.becameLiteral;
      }
      // Expliciete herkomst (leesvorm) wint van wat de holiday-resolutie afleidde. LET OP de
      // volgorde: dit moet de `dropGeneration` van hierboven kunnen HERROEPEN — anders wist de
      // wis-producer verderop de zojuist meegestuurde herkomst weer (de letterlijke overdracht
      // `holidays` + `generation` viel precies in dat gat).
      if (item.generation === null) {
        dropGeneration = existing.generation !== undefined;
        delete updates.generation;
      } else if (item.generation !== undefined) {
        updates.generation = { ...item.generation };
        dropGeneration = false;
      }
      if (dropGeneration) dropKeys.push('generation');
      if (item.workTime === null && existing.workTime !== undefined) dropKeys.push('workTime');
      if (item.shift === null && existing.shift !== undefined) dropKeys.push('shift');
      // Een lege lijst wist de werkende uitzonderingen; afwezig (niet `[]`) is de opslagvorm van de lezers.
      if (item.workingExceptions?.length === 0 && existing.workingExceptions !== undefined) dropKeys.push('workingExceptions');

      // Een urentaak heeft effectieve werkblokken nodig; die mogen ook uit de scalaire kalender
      // volgen. Toets de uiteindelijke kalender vóór de mutatie, inclusief verwijderde sleutels.
      if (dropKeys.includes('workTime')) {
        const state = ctx.app.store.getState();
        const resultingCalendar = { ...existing, ...updates };
        for (const key of dropKeys) delete resultingCalendar[key];
        const hasAffectedHourTask = state.tasks.some((task) => task.time.durationUnit === 'hours'
          && (task.calendarId ?? state.calendar.id) === plan.targetId);
        if (hasAffectedHourTask && !effectiveWorkTimeBands(resultingCalendar)) {
          throw new McpStepError(
            'VALIDATION',
            `cannot remove concrete work blocks: calendar '${plan.targetId}' is used by an hour task`,
          );
        }
      }

      ctx.transactions.draft.updateCalendar(plan.targetId, updates);
      if (dropKeys.length > 0) {
        ctx.app.store.setState((s) => {
          const idx = s.calendars.findIndex((c) => c.id === plan.targetId);
          if (idx >= 0) for (const k of dropKeys) delete s.calendars[idx][k];
          // De gedenormaliseerde projectkalender-cache moet de entry blijven volgen;
          // `draft.updateCalendar` synct zelf, maar deze extra producer maakt een nieuw
          // entry-object en zou de cache anders op het oude object laten wijzen.
          syncProjectCalendar(s);
          markDocumentEdited(s);
        });
      }

      // Alleen planningseffecten ná de mutatie; de taken zelf zijn onaangeroerd.
      const sAfter = ctx.app.store.getState();
      const updated = sAfter.calendars.find((c) => c.id === plan.targetId)!;
      const afterMode = calendarMode(updated);
      rows.push({
        id: plan.targetId, created: false, promoted, becameLiteral,
        mode: afterMode,
        ...(beforeMode !== afterMode
          ? { modeChangedFrom: beforeMode, taskDurationsPreserved: true }
          : {}),
        hoursPerDayEffective: effHoursPerDay(updated),
        ...(updated.shift ? { shift: updated.shift } : {}),
        ...(ignoredFields.length > 0 ? { ignoredFields } : {}),
      });
    }
    return { data: { calendars: rows }, itemRejections: rejections };
}

/** Eén weekdag in het `workTime.byWeekday`-schema (`[]` = niet-werkende dag). Staat twee keer in het schema: als
 *  `additionalProperties` van `byWeekday` en bij `workingExceptions[].bands`. Daarom zo kaal mogelijk:
 *  `WORKTIME_SCHEMA` legt de banden en hun grenzen één keer uit (#818). De schemapoort toetst array-items niet
 *  (DIEPTE-REGEL in `schemaValidate.ts`); `bandListReason` hierboven weigert ongeldige banden met een reden
 *  (`cases-uurkalender.ts`, test 3), maar laat een gebroken minuut door (knownbug 933). */
const WORKTIME_DAY_SCHEMA = {
  type: 'array',
  items: { type: 'object', required: ['start', 'end'] },
} as const;

const WORKTIME_SCHEMA = {
  type: ['object', 'null'],
  description: 'Makes an HOUR calendar; `null` = back to a DAY calendar.',
  properties: {
    byWeekday: {
      type: 'object',
      description:
        'All seven keys "1" (Mon) … "7" (Sun) are required. Per day ascending, non-overlapping bands ' +
        '{start, end} in MINUTES from midnight ([] = non-working): `start` 0–1439, `end` > `start` and ≤ 2880 ' +
        '(counts on past midnight: 22:00–06:00 = 1320–1800).',
      // Eén dagschema voor elke sleutel in plaats van zeven gelijke `properties` (#818). De handler toetst de
      // sleutels "1".."7" zelf (`workTimeReason`).
      additionalProperties: WORKTIME_DAY_SCHEMA,
    },
  },
} as const;

/** Feestdag-item; gedeeld door `rawHolidays` (toevoegen) en `holidays` (exact vervangen). */
const HOLIDAY_ITEM_SCHEMA = {
  type: 'object',
  required: ['name', 'startDate', 'endDate'],
  properties: {
    name: { type: 'string' },
    startDate: { type: 'string' },
    endDate: { type: 'string', description: 'Inclusive.' },
  },
} as const;

const updateCalendar: BatchStepTool = {
  name: 'planner_update_calendar',
  description:
    'Change calendars, or create one with `create: true` and an own `id` label, then use the returned `id` ' +
    '(ids are per document). `generate` replaces holidays; then `rawHolidays` adds (`holidaysMode: ' +
    '"replace"`: exact list) and clears the generator link (`becameLiteral`). `create` without holiday fields ' +
    'inherits the app default holidays; `holidays: []` = none. DAY calendar with a break: `hoursPerDay` is ' +
    'derived; change hours or break. HOUR calendar (`workTime`): `workDays` follows the bands; `hoursPerDay` ' +
    'too, unless it differed from the modal day sum of the old bands. A given `hoursPerDay` wins. Durations ' +
    'keep their unit; dates can move, and under FIXED_RATE (`workRule`) other hours per day change day ' +
    'durations.',
  kind: 'mutate',
  batchable: true,
  // Een kalenderwijziging kan bestaande feestdagen/werkdagen (en daarmee de planning) overschrijven.
  annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      calendars: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
            create: { type: 'boolean' },
            name: { type: 'string' },
            description: { type: 'string' },
            workDays: {
              type: 'array',
              items: { type: 'integer', minimum: 1, maximum: 7 },
              // Kopieerregel: `calendarFieldPatch` → `workDaysSetPatch` → `workDayTogglePatch` (`subdayIo.ts`) →
              // `firstBlockedDay`. Het antwoord toont geen banden, dus de agent moet dit vooraf weten (#818).
              description: '1 = Monday … 7 = Sunday. On an HOUR calendar, `workDays` alone clears removed days ' +
                'and gives new days the bands of the first day with bands (Sun, Mon … Sat); use `workTime` to ' +
                'choose hours.',
            },
            workStartHour: { type: 'number', description: 'HOURS (0–24).' },
            workEndHour: { type: 'number', description: 'HOURS (0–24).' },
            hoursPerDay: { type: 'number', description: 'Net hours.' },
            simpleBreakStartMinute: {
              type: 'integer', minimum: 0, maximum: 1439,
              description: 'MINUTES from midnight (12:30 = 750).',
            },
            simpleBreakDurationMinutes: {
              type: 'integer', minimum: 0, maximum: 1440,
              description: 'MINUTES; 0 = no break.',
            },
            workingExceptions: {
              type: 'array',
              description:
                'Extra WORKING days; the complete list, replaces the existing one. `bands` as one `workTime` day; ' +
                'omitted = normal hours.',
              items: {
                type: 'object',
                required: ['name', 'startDate', 'endDate'],
                properties: {
                  name: { type: 'string' },
                  startDate: { type: 'string' },
                  endDate: { type: 'string', description: 'Inclusive.' },
                  bands: WORKTIME_DAY_SCHEMA,
                },
              },
            },
            generate: {
              type: 'object',
              description: 'Covers project start year − 1 through the year after the project end (no end, or ' +
                'on create: start year + 3).',
              required: ['country'],
              properties: {
                country: {
                  type: 'string',
                  enum: ['NL', 'DE', 'BE', 'FR', 'UK', 'AT', 'CH', 'US', 'none'],
                  description: '`none` clears the generated days.',
                },
                region: { type: 'string', description: 'State/region/canton; omitted = national.' },
                bouwvak: { type: 'string', enum: ['geen', 'noord', 'midden', 'zuid'], description: 'NL construction holiday.' },
              },
            },
            holidaysMode: {
              type: 'string',
              enum: ['merge', 'replace'],
              description: 'For `rawHolidays`; default merge.',
            },
            rawHolidays: {
              type: 'array',
              description: 'Days off (frost, company closure); ISO dates.',
              items: HOLIDAY_ITEM_SCHEMA,
            },
            holidays: {
              type: 'array',
              description:
                'The complete list. Not with `rawHolidays`/`holidaysMode`/`generate`.',
              items: HOLIDAY_ITEM_SCHEMA,
            },
            workTime: WORKTIME_SCHEMA,
            shift: {
              type: ['string', 'null'],
              enum: ['FIRST', 'SECOND', 'THIRD', 'USERDEFINED', null],
            },
            // Alleen de buitenvorm (#818): de binnenkant toetst de schemapoort niet (kalenders zijn array-items,
            // DIEPTE-REGEL), en `generationReason` weigert een foute vorm met een reden die de sleutels en waarden
            // noemt. Een agent schrijft het object letterlijk terug zoals planner_get_calendars het gaf.
            generation: {
              type: ['object', 'null'],
              description:
                'Provenance only, as read from planner_get_calendars; does NOT generate. Not with `generate`.',
            },
            // De afgeleide leesvelden van get_calendars (`CAL_READONLY_KEYS`) staan bewust NIET in het schema: ze
            // zijn niet schrijfbaar. `items` heeft geen `additionalProperties: false`, dus een teruggestuurd object
            // blijft geldig; de handler meldt ze als `ignoredFields` (#818).
          },
        },
      },
    },
    required: ['calendars'],
  },
  batchStep: parsedBatchStep(parseUpdateCalendar, updateCalendarCore),
  async handler(args, ctx) {
    const parsed = parseUpdateCalendar(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const items = parsed;

    // Lege-batch-snelpad: statisch nul uitvoerbare items ⇒ direct Ok mét de weigeringen, zónder
    // transactie/backup/snapshot/redo-wipe.
    {
      const state = ctx.app.store.getState();
      const pre = classifyCalendars(state, items);
      if (pre.plans.length === 0) {
        return okDirectGuarded(ctx, { calendars: [], warnings: [], projectEnd: projectEndInfo(state).projectEnd }, pre.rejections);
      }
    }

    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => updateCalendarCore(ctx, items));

    return enrichOk(res, () => {
      const rows = ((res as McpToolOk).data as { calendars: Record<string, unknown>[] }).calendars;
      const { projectEnd, cappedTaskIds } = projectEndInfo(ctx.app.store.getState());
      // Beleid: een onwerkbaar venster is een WAARSCHUWING, geen fout — de kalenderwijziging
      // blijft gecommit; de AI hoort dit prominent aan de user te melden.
      const warnings: string[] = [];
      if (cappedTaskIds) {
        warnings.push(
          `Unworkable window: ${cappedTaskIds.length} task(s) could not be scheduled within this calendar ` +
          '(see cappedTaskIds). The calendar change HAS been applied — check working days and holidays.',
        );
      }
      // Een "leeg" aangemaakte kalender erft de feestdagen van de app-standaardkalender. Dat is
      // een bewuste app-default, maar het mag niet STIL gebeuren — zeg het hardop.
      const inherited = rows.filter((r) => r.created === true && r.holidaysFrom === 'app-default' && (r.holidayCount as number) > 0);
      if (inherited.length > 0) {
        warnings.push(
          `${inherited.length} newly created calendar(s) TOOK OVER the holidays of the app default calendar (` +
          `${inherited.map((r) => `${r.id}: ${r.holidayCount}`).join(', ')}) because no \`generate\` or ` +
          '`rawHolidays` was given. If you want a calendar without holidays, pass `generate: { country: ' +
          '"none" }`.',
        );
      }
      // Een moduswissel kan de planning verschuiven, maar nooit een taakeenheid/hoeveelheid wijzigen.
      const switched = rows.filter((r) => r.modeChangedFrom !== undefined);
      if (switched.length > 0) {
        warnings.push(
          `${switched.length} calendar(s) switched mode: ` +
          `${switched.map((r) => `${r.id}: ${r.modeChangedFrom} → ${r.mode}`).join(', ')}. The chosen unit ` +
          'and native quantity of every task are preserved. Only the schedule can shift; hour tasks require ' +
          'concrete work blocks to be calculated.',
        );
      }
      return { calendars: rows, warnings, projectEnd, ...(cappedTaskIds ? { cappedTaskIds } : {}) };
    });
  },
};

// =================================================================================================
// planner_manage_assignments
//
// Bulk over vier acties. De pre-validatie draait `validate.assignmentAllowed` INCREMENTEEL tegen een
// gesimuleerde, meegroeiende toewijzingsverzameling: een tweede identieke `add` binnen dezelfde call
// wordt daardoor zacht geweigerd (zonder simulatie zou de dubbeltelling-guard hem missen, want de
// store bevat de eerste toewijzing pas ná de transactie-stap). Move/remove werken de simulatie
// eveneens bij, zodat "verplaats weg en wijs opnieuw toe" binnen één call gewoon kan.
// =================================================================================================

type AssignmentAction =
  | { action: 'add'; taskId: string; resourceId: string; unitsPerDay: number; curve?: ResourceCurve; remainingWorkMinutes?: number }
  | { action: 'update'; assignmentId: string; unitsPerDay?: number; curve?: ResourceCurve; remainingWorkMinutes?: number }
  | { action: 'move'; assignmentId: string; taskId: string }
  | { action: 'remove'; assignmentId: string };

/** Gesimuleerde toewijzing tijdens de pre-validatie (alleen de velden die de guards lezen). */
interface SimAssignment { id: string; taskId: string; resourceId: string; unitsPerDay: number }

function classifyAssignments(
  s: StoreState,
  actions: AssignmentAction[],
): { plans: { index: number; action: AssignmentAction }[]; rejections: Rejection[] } {
  const plans: { index: number; action: AssignmentAction }[] = [];
  const rejections: Rejection[] = [];
  let sim: SimAssignment[] = s.assignments.map((a) => ({
    id: a.id, taskId: a.taskId, resourceId: a.resourceId, unitsPerDay: a.unitsPerDay,
  }));
  /** De vorm die `validate.assignmentAllowed` leest, met de GESIMULEERDE toewijzingen. */
  const simState = () => ({ tasks: s.tasks, sequences: s.sequences, assignments: sim });

  actions.forEach((act, index) => {
    if (!act || typeof (act as { action?: unknown }).action !== 'string') {
      rejections.push({ id: `#${index}`, reason: 'every item requires an `action` (add | update | move | remove)' });
      return;
    }
    switch (act.action) {
      case 'add': {
        const label = `${act.taskId}->${act.resourceId}`;
        if (typeof act.taskId !== 'string' || typeof act.resourceId !== 'string') {
          rejections.push({ id: label, reason: '`add` requires string `taskId` and `resourceId`' });
          return;
        }
        if (!s.resources.some((r) => r.id === act.resourceId)) {
          rejections.push({ id: label, reason: `resource '${act.resourceId}' does not exist` });
          return;
        }
        if (act.curve !== undefined && !isResourceCurve(act.curve)) {
          rejections.push({ id: label, reason: curveReason(act.curve) });
          return;
        }
        const guard = validate.assignmentAllowed(simState(), act.taskId, act.resourceId, act.unitsPerDay);
        if (!guard.ok) {
          rejections.push({ id: label, reason: guard.reason });
          return;
        }
        // Werk direct bij `add` — nodig binnen planner_batch, want een
        // nieuwe toewijzing heeft daar nog geen tempId-resolveerbaar `assignmentId`.
        if (act.remainingWorkMinutes !== undefined) {
          if (!(typeof act.remainingWorkMinutes === 'number' && Number.isFinite(act.remainingWorkMinutes) && act.remainingWorkMinutes > 0)) {
            rejections.push({ id: label, reason: `invalid remainingWorkMinutes ${String(act.remainingWorkMinutes)} (work minutes, strictly positive required)` });
            return;
          }
          const owner = s.tasks.find((t) => t.id === act.taskId);
          if (!owner || !workRuleApplies(owner)) {
            rejections.push({ id: label, reason: 'remaining work can only be set on an ordinary leaf task on working time (not on a milestone, summary task, hammock or ELAPSEDTIME task)' });
            return;
          }
        }
        // Simulatie bijwerken: een volgende identieke `add` botst nu op de dubbeltelling-guard.
        sim = [...sim, { id: `sim-${index}`, taskId: act.taskId, resourceId: act.resourceId, unitsPerDay: act.unitsPerDay }];
        plans.push({ index, action: act });
        return;
      }
      case 'update': {
        const cur = sim.find((x) => x.id === act.assignmentId);
        if (!cur) {
          rejections.push({ id: String(act.assignmentId), reason: `assignment '${act.assignmentId}' does not exist` });
          return;
        }
        const hasUnits = act.unitsPerDay !== undefined;
        const hasCurve = act.curve !== undefined;
        const hasWork = act.remainingWorkMinutes !== undefined;
        if (!hasUnits && !hasCurve && !hasWork) {
          rejections.push({ id: act.assignmentId, reason: 'no `unitsPerDay`, `curve` or `remainingWorkMinutes` given' });
          return;
        }
        // Resterend werk loopt via de werkdriehoek (`draft.setAssignmentWork`).
        if (hasWork && !(typeof act.remainingWorkMinutes === 'number' && Number.isFinite(act.remainingWorkMinutes) && act.remainingWorkMinutes > 0)) {
          rejections.push({ id: act.assignmentId, reason: `invalid remainingWorkMinutes ${String(act.remainingWorkMinutes)} (work minutes, strictly positive required)` });
          return;
        }
        if (hasWork) {
          const owner = s.tasks.find((t) => t.id === cur.taskId);
          if (!owner || !workRuleApplies(owner)) {
            rejections.push({ id: act.assignmentId, reason: 'remaining work can only be set on an ordinary leaf task on working time (not on a milestone, summary task, hammock or ELAPSEDTIME task)' });
            return;
          }
        }
        if (hasUnits && !isValidUnits(act.unitsPerDay)) {
          rejections.push({ id: act.assignmentId, reason: `invalid unitsPerDay ${String(act.unitsPerDay)} (units/day, strictly positive required)` });
          return;
        }
        if (hasCurve && !isResourceCurve(act.curve)) {
          rejections.push({ id: act.assignmentId, reason: curveReason(act.curve) });
          return;
        }
        if (hasUnits) cur.unitsPerDay = act.unitsPerDay!;
        plans.push({ index, action: act });
        return;
      }
      case 'move': {
        const cur = sim.find((x) => x.id === act.assignmentId);
        if (!cur) {
          rejections.push({ id: String(act.assignmentId), reason: `assignment '${act.assignmentId}' does not exist` });
          return;
        }
        const target = s.tasks.find((t) => t.id === act.taskId);
        if (!target) {
          rejections.push({ id: act.assignmentId, reason: `target task '${act.taskId}' does not exist` });
          return;
        }
        if (target.isMilestone || isSummaryTask(target)) {
          rejections.push({ id: act.assignmentId, reason: `target task '${act.taskId}' is a milestone/summary task; those carry no resources` });
          return;
        }
        // Move naar de taak waar hij (gesimuleerd) al staat: de dubbelcheck hieronder sluit `cur`
        // zelf uit en zou dit doorlaten, waarna `draft.moveAssignment` gooit en de HELE call
        // terugrolt. Net als een dubbele `add` dus zacht weigeren — alleen dit item vervalt.
        if (cur.taskId === act.taskId) {
          rejections.push({ id: act.assignmentId, reason: `assignment '${act.assignmentId}' is already on task '${act.taskId}' (resource '${cur.resourceId}'); moving to the same task changes nothing` });
          return;
        }
        if (sim.some((x) => x.id !== cur.id && x.taskId === act.taskId && x.resourceId === cur.resourceId)) {
          rejections.push({ id: act.assignmentId, reason: `resource '${cur.resourceId}' is already assigned to task '${act.taskId}' (moving would double-count the load)` });
          return;
        }
        cur.taskId = act.taskId;
        plans.push({ index, action: act });
        return;
      }
      case 'remove': {
        if (!sim.some((x) => x.id === act.assignmentId)) {
          rejections.push({ id: String(act.assignmentId), reason: `assignment '${act.assignmentId}' does not exist` });
          return;
        }
        sim = sim.filter((x) => x.id !== act.assignmentId);
        plans.push({ index, action: act });
        return;
      }
      default:
        rejections.push({ id: `#${index}`, reason: `unknown action '${(act as { action: string }).action}' (add | update | move | remove)` });
    }
  });
  return { plans, rejections };
}

/** Vormvalidatie van `manage_assignments`; string = foutboodschap. */
function parseAssignments(args: unknown): AssignmentAction[] | string {
  const a = (args ?? {}) as { actions?: unknown };
  if (!Array.isArray(a.actions) || a.actions.length === 0) {
    return 'manage_assignments requires a non-empty `actions` array';
  }
  return a.actions as AssignmentAction[];
}

/** Synchrone, transactie-vrije kern van `manage_assignments`. */
function manageAssignmentsCore(ctx: McpContext, actions: AssignmentAction[]): MutationOutcome {
    const { plans, rejections } = classifyAssignments(ctx.app.store.getState(), actions);
    const added: Record<string, unknown>[] = [];
    const updated: string[] = [];
    const moved: { assignmentId: string; taskId: string }[] = [];
    const removed: string[] = [];
    for (const { action } of plans) {
      switch (action.action) {
        case 'add': {
          const id = ctx.transactions.draft.assignResource(action.taskId, action.resourceId, action.unitsPerDay, action.curve);
          if (action.remainingWorkMinutes !== undefined) ctx.transactions.draft.setAssignmentWork(id, action.remainingWorkMinutes);
          added.push({
            assignmentId: id,
            taskId: action.taskId,
            resourceId: action.resourceId,
            unitsPerDay: action.unitsPerDay,
            ...(action.curve ? { curve: action.curve } : {}),
          });
          break;
        }
        case 'update': {
          const patch: { unitsPerDay?: number; curve?: ResourceCurve } = {};
          if (action.unitsPerDay !== undefined) patch.unitsPerDay = action.unitsPerDay;
          if (action.curve !== undefined) patch.curve = action.curve;
          if (Object.keys(patch).length > 0) ctx.transactions.draft.updateAssignment(action.assignmentId, patch);
          // Ná de inzet: een gelijktijdige `unitsPerDay` + `remainingWorkMinutes` betekent "deze inzet,
          // dít werk" — de duur volgt dan uit beide (FIXED_WORK/FIXED_RATE) of de inzet wordt door
          // het werk overschreven (duurbeschermende regels: I = W / R).
          if (action.remainingWorkMinutes !== undefined) ctx.transactions.draft.setAssignmentWork(action.assignmentId, action.remainingWorkMinutes);
          updated.push(action.assignmentId);
          break;
        }
        case 'move': {
          ctx.transactions.draft.moveAssignment(action.assignmentId, action.taskId);
          moved.push({ assignmentId: action.assignmentId, taskId: action.taskId });
          break;
        }
        case 'remove': {
          ctx.transactions.draft.unassignResource(action.assignmentId);
          removed.push(action.assignmentId);
          break;
        }
      }
    }
    return { data: { added, updated, moved, removed }, itemRejections: rejections };
}

const manageAssignments: BatchStepTool = {
  name: 'planner_manage_assignments',
  description:
    '`add`: `taskId`, `resourceId`, `unitsPerDay` (+ `curve`/`remainingWorkMinutes`); `update`: ' +
    '`assignmentId` + `unitsPerDay`/`curve`/`remainingWorkMinutes` (other resource: remove + add); `move`: ' +
    '`assignmentId` to `taskId`; `remove`: `assignmentId`. Leaf tasks only, no milestones or duplicate ' +
    'resources. Under FIXED_WORK/FIXED_RATE (`workRule`) units, `remainingWorkMinutes` or adding/removing a ' +
    'resource change the DURATION (reread the task); otherwise `remainingWorkMinutes` sets the units. One ' +
    'call = one undo step.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['add', 'update', 'move', 'remove'] },
            taskId: { type: 'string' },
            resourceId: { type: 'string' },
            assignmentId: { type: 'string' },
            unitsPerDay: { type: 'number', exclusiveMinimum: 0, description: '1 = one person full time.' },
            curve: { type: 'string', enum: [...RESOURCE_CURVES], description: 'Omitted = UNIFORM.' },
            remainingWorkMinutes: {
              type: 'number',
              exclusiveMinimum: 0,
              description:
                'Remaining work in WORK minutes (8 h = 480).',
            },
          },
        },
      },
    },
    required: ['actions'],
  },
  // Zie de batchStep-noot in taskTools.ts: het lege-batch-snelpad is puur transactie-vermijding en
  // dus overbodig binnen een batch (die bezit de transactie al).
  batchStep: parsedBatchStep(parseAssignments, manageAssignmentsCore),
  async handler(args, ctx) {
    const parsedActions = parseAssignments(args);
    if (typeof parsedActions === 'string') return toolError(ctx, 'VALIDATION', parsedActions);
    const actions = parsedActions;

    // Lege-batch-snelpad (zie de conventies bovenaan).
    {
      const state = ctx.app.store.getState();
      const pre = classifyAssignments(state, actions);
      if (pre.plans.length === 0) {
        return okDirectGuarded(
          ctx,
          { added: [], updated: [], moved: [], removed: [], projectEnd: projectEndInfo(state).projectEnd },
          pre.rejections,
        );
      }
    }

    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => manageAssignmentsCore(ctx, actions));

    return enrichOk(res, () => ({
      ...((res as McpToolOk).data as object),
      projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd,
    }));
  },
};

// =================================================================================================
// planner_level_resources
//
// Volgorde: guards → `ensureFreshSchedule` (een stale planning maakt de before/after-delta's onzin)
// → preview → optioneel commit. `ensureFreshSchedule` draait BUITEN elke transactie en kost toch
// geen undo-stap: `runCPM` raakt de undo-stack alleen bij het verlaten van "datums zoals
// opgeslagen", en modus-aan-én-stale is onbereikbaar (zie staleGuard.ts). Daarop rust de belofte
// "er ontstaat geen ongedaan-maak-stap" in de `dryRun`-beschrijving. `dryRun` gaat NIET door een
// transactie: er valt niets te backuppen of terug te rollen (`levelResources` is een pure
// preview-berekening op de store). De respons draagt ALTIJD het volledige LevelingResult.
// =================================================================================================

function levelingData(
  state: AppState,
  r: LevelingResult,
  dryRun: boolean,
  recomputed: boolean,
  constrainToFloat: boolean,
) {
  const calendarDays = safeDiffDays(r.projectEndBefore, r.projectEndAfter);
  const unresolvedCount = Object.keys(r.unresolved).length;
  const warnings: string[] = [];
  if (!constrainToFloat && calendarDays !== 0) {
    warnings.push(
      `The project end date SHIFTS: ${r.projectEndBefore} → ${r.projectEndAfter} (` +
      `${calendarDays > 0 ? '+' : ''}${calendarDays} calendar days). This is the consequence of ` +
      '`constrainToFloat: false`; with `true` the end date is sacred.',
    );
  }
  if (unresolvedCount > 0) {
    warnings.push(
      `${unresolvedCount} task(s) keep an unresolved peak; see \`unresolved\` for conflict dates and, when available, \`unresolvedReasons\` (INTRINSIC_OVERRUN = ` +
      'the task on its own already asks for more than the capacity, CALENDAR_MISMATCH = resource and task ' +
      'calendar do not line up, INSUFFICIENT_CAPACITY = there is simply too little capacity, ' +
      'CEILING_TOO_TIGHT = the extension ceiling leaves too little room, CEILING_UNREACHABLE = a ' +
      'deadline/backward constraint makes every ceiling unreachable, RESIDUAL_FULL = the project\'s own ' +
      'allocation had room but the residual capacity of the library pool item is used up — other documents ' +
      'occupy the pool, NO_WINDOW_IN_HORIZON = the search horizon ran out without finding a fitting window). ' +
      'Pinned tasks are not moved or searched for a new window, so their conflict dates may have no search reason.',
    );
  }
  // `projectEndAfter` is de VOORSPELLING van de nivelleerder; `projectEnd` is wat er ná de
  // eind-runCPM daadwerkelijk in de store staat. Bij `dryRun` is dat per definitie de ONgewijzigde
  // planning (== projectEndBefore) — beide meegeven maakt het verschil expliciet i.p.v. impliciet.
  const { projectEnd, cappedTaskIds } = projectEndInfo(state);
  if (cappedTaskIds) {
    warnings.push(
      `Unworkable window: ${cappedTaskIds.length} task(s) do not fit within their calendar (see cappedTaskIds).`,
    );
  }
  return {
    dryRun,
    recomputed,
    constrainToFloat,
    delays: r.delays,
    unresolved: r.unresolved,
    unresolvedReasons: r.unresolvedReasons,
    shifts: r.shifts,
    projectEndBefore: r.projectEndBefore,
    projectEndAfter: r.projectEndAfter,
    projectEndDelta: { before: r.projectEndBefore, after: r.projectEndAfter, calendarDays },
    projectEnd,
    ...(cappedTaskIds ? { cappedTaskIds } : {}),
    warnings,
  };
}

/** Args-vorm van `level_resources`; string = foutboodschap. */
function parseLeveling(
  args: unknown,
  state: AppState,
): { options: LevelingOptions; constrainToFloat: boolean; dryRun: boolean } | string {
  const a = (args ?? {}) as { constrainToFloat?: unknown; resourceIds?: unknown; dryRun?: unknown };
  if (a.constrainToFloat !== undefined && typeof a.constrainToFloat !== 'boolean') {
    return '`constrainToFloat` must be a boolean';
  }
  // `dryRun` streng typechecken: met `a.dryRun === true` zou elke niet-boolean (`"true"`, `1`) stil
  // `false` betekenen, dus een ECHTE nivellering terwijl de aanroeper dacht te previewen. Juist die
  // parameter wordt in de beschrijving verkocht als de veilige manier om eerst te kijken ⇒ hard
  // weigeren.
  if (a.dryRun !== undefined && typeof a.dryRun !== 'boolean') {
    return `${booleanArgReason(a.dryRun, 'dryRun')} — a non-boolean would silently count as \`false\` and so ` +
      'run a REAL leveling';
  }
  if (a.resourceIds !== undefined) {
    if (!Array.isArray(a.resourceIds)) return '`resourceIds` must be an array of resource ids';
    // Een selectie die (deels) niet bestaat, geeft anders een stille nul-effect-run: de leveler
    // filtert onbekende id's weg, waarna `delays: {}` / `shifts: []` leest als "er hoefde niets
    // genivelleerd te worden". Een lege selectie is om dezelfde reden nooit bedoeld.
    if (a.resourceIds.length === 0) {
      return '`resourceIds` is empty; leave the parameter out to level ALL renewable resources';
    }
    const bad = a.resourceIds.filter((x) => typeof x !== 'string' || x === '');
    if (bad.length > 0) return '`resourceIds` may only contain non-empty resource id strings';
    const known = new Set(state.resources.map((r) => r.id));
    const unknown = (a.resourceIds as string[]).filter((id) => !known.has(id));
    if (unknown.length > 0) {
      return `unknown resource id(s): ${unknown.join(', ')} — leveling would then silently do nothing; get ` +
        'valid ids with planner_list_resources';
    }
  }
  const constrainToFloat = a.constrainToFloat !== false; // default true (de hoofdroute)
  return {
    options: {
      constrainToFloat,
      ...(Array.isArray(a.resourceIds) ? { resourceIds: a.resourceIds as string[] } : {}),
    },
    constrainToFloat,
    dryRun: a.dryRun === true,
  };
}

/**
 * Synchrone, transactie-vrije kern van `level_resources`. Draait ZELF `ensureFreshSchedule` (nodig
 * voor kloppende before/after-delta's; kost geen undo-stap omdat modus-aan-én-stale onbereikbaar is —
 * zie de kop van deze tool en staleGuard.ts, NIET omdat er een transactie omheen zou staan). Dat
 * overlapt met de `recomputeMidBatch` die `planner_batch` vóór een levelingstap doet — bewust: de
 * kern moet ook kloppen als de leveling de EERSTE stap van de batch is en de store al stale de batch in ging.
 */
function levelResourcesCore(ctx: McpContext, p: { options: LevelingOptions; dryRun: boolean }): MutationOutcome {
  const fresh = ensureFreshSchedule(ctx.app);
  if (fresh.error) {
    throw new McpStepError('VALIDATION', `the schedule could not be recalculated before leveling: ${fresh.error}`);
  }
  const preview = ctx.app.store.getState().levelResources(p.options);
  // `dryRun` muteert per contract niets — binnen een batch dus een pure preview-stap.
  if (!p.dryRun) ctx.transactions.draft.applyLeveling(preview);
  return { data: preview };
}

const levelResources: BatchStepTool = {
  name: 'planner_level_resources',
  description:
    'Level resource overloads by delaying tasks. Default `constrainToFloat: true` stays within total float ' +
    '(end fixed; remaining peaks in `unresolved`); `false` may move the end (`projectEndDelta`). Material is ' +
    'never leveled. Try `dryRun: true` first. Resets earlier leveling itself, so reruns do not stack.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      constrainToFloat: { type: 'boolean' },
      resourceIds: { type: 'array', items: { type: 'string' }, description: 'Omitted = all renewable resources.' },
      dryRun: {
        type: 'boolean',
        description: 'Preview only; changes nothing.',
      },
    },
  },
  batchStep: parsedBatchStep(parseLeveling, levelResourcesCore),
  async handler(args, ctx) {
    const parsed = parseLeveling(args, ctx.app.store.getState());
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const { options, constrainToFloat, dryRun } = parsed;

    // Guards vóór de (potentieel dure) herberekening; `runMutateTool` draait ze zo dadelijk nogmaals
    // plus de backup — dat is bewust: een gepauzeerde bridge mag ook geen recompute uitlokken.
    const g = guardNonTransactional(ctx);
    if (g) return g;

    const fresh = ensureFreshSchedule(ctx.app);
    if (fresh.error) {
      return toolError(ctx, 'VALIDATION', `the schedule could not be recalculated before leveling: ${fresh.error}`);
    }

    if (dryRun) {
      const preview = ctx.app.store.getState().levelResources(options);
      return okDirect(ctx, levelingData(ctx.app.store.getState(), preview, true, fresh.recomputed, constrainToFloat), []);
    }

    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome =>
      levelResourcesCore(ctx, { options, dryRun: false }));
    return enrichOk(res, () =>
      levelingData(
        ctx.app.store.getState(),
        (res as McpToolOk).data as LevelingResult,
        false,
        fresh.recomputed,
        constrainToFloat,
      ),
    );
  },
};

// =================================================================================================
// planner_clear_leveling
// =================================================================================================
/** Hoeveel taken nivelleeruitvoer dragen — dezelfde `hasLevelingOutput` als de no-op-guard van de
 *  store-`clearLeveling` en de ribbonknop, dus ook uitsluitend sub-dag-precisie of pauzedagen. */
function levelingOutputCount(state: Pick<AppState, 'tasks'>): number {
  return state.tasks.filter(hasLevelingOutput).length;
}

/** Synchrone, transactie-vrije kern van `clear_leveling`; niets te wissen ⇒ geen mutatie. */
function clearLevelingCore(ctx: McpContext): MutationOutcome {
  const count = levelingOutputCount(ctx.app.store.getState());
  if (count === 0) return { data: { cleared: 0 } };
  ctx.transactions.draft.clearLeveling();
  return { data: { cleared: count } };
}

const clearLeveling: BatchStepTool = {
  name: 'planner_clear_leveling',
  description:
    'Remove all leveling delays.',
  kind: 'mutate',
  batchable: true,
  // GEEN destructiveHint: die annotatie staat op een GESLOTEN lijst (delete_tasks,
  // remove_dependencies, import_schedule, update_calendar). Nivellerings-vertragingen zijn afgeleide,
  // herberekenbare waarden — ze wissen vernietigt geen ingevoerde data.
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
  inputSchema: { type: 'object', properties: {} },
  batchStep(_args, ctx) {
    return clearLevelingCore(ctx);
  },
  async handler(_args, ctx) {
    const state = ctx.app.store.getState();
    const count = levelingOutputCount(state);
    // No-op-snelpad (spiegelt de store-`clearLeveling`-guard): niets te wissen ⇒ geen transactie,
    // geen undo-snapshot, geen redo-wipe.
    if (count === 0) {
      return okDirectGuarded(ctx, { cleared: 0, projectEnd: projectEndInfo(state).projectEnd }, []);
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => clearLevelingCore(ctx));
    return enrichOk(res, () => ({ cleared: count, projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd }));
  },
};

// =================================================================================================
// planner_update_project
// =================================================================================================
/** Datumvorm van `update_project`: `JJJJ-MM-DD`, en met `allowTime` ook `JJJJ-MM-DDTHH:mm` (de
 *  store-vorm van een uur-instant; alleen de statusdatum mag een tijd dragen, uurplanning). De datum
 *  moet bestaan (geen 31 februari); een willekeurige staart na de datum wordt geweigerd. */
function isProjectDateValue(v: unknown, allowTime: boolean): v is string {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2})?$/.exec(v);
  if (!m || (m[2] && !allowTime)) return false;
  const d = new Date(`${m[1]}${m[2] ?? 'T00:00'}:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, v.length) === v;
}

/** Elke sleutel die `update_project` KENT — de allowlist waartegen onbekende sleutels afketsen. */
const PROJECT_KEYS = [
  'name', 'description', 'author', 'company', 'startDate', 'endDate', 'statusDate', 'progressMode',
  'defaultWorkRule',
] as const;

/** Projectvelden die de bridge BEWUST niet schrijft, mét een reden. Een expliciete weigering is
 *  oneindig veel bruikbaarder dan stilte. */
const PROJECT_REFUSED: Record<string, string> = {
  schedulingOptions:
    'the calculation options (`schedulingOptions`, including `floatPaths`, `criticalDefinition`, ' +
    '`lagCalendar`, `startToStartLagFrom`) are NOT settable via the bridge: together with the calculation ' +
    'profile they determine the solver semantics of the whole document. Set them in the app under File → ' +
    'Project settings → Calculation profile and options; `planner_get_project_info` shows the active profile and ' +
    'the project options, `planner_get_critical_path` reports with `pathsMode` which setting applies.',
  schedulingProfile:
    'the calculation profile (P6 / MS Project / OPS / custom) is NOT settable via the bridge: a switch ' +
    'shifts dates of the whole document. Choose it in the app under File → Project settings → Calculation ' +
    'profile; `planner_get_project_info` shows the active profile with its twenty-nine resolved conventions.',
  leveling:
    '`leveling` belongs in `project.schedulingOptions`: the leveling settings from the source file (P6 ' +
    'SCHEDOPTIONS/RSRCLEVELLIST) are read and kept, but NOT applied yet and not settable via the bridge. ' +
    '`planner_get_project_info` shows them read-only; manual leveling is done with `planner_level_resources`.',
  floatPaths:
    '`floatPaths` belongs in `project.schedulingOptions` and is NOT settable via the bridge (see the app ' +
    'under File → Project settings → Calculation profile and options). `planner_get_critical_path` reports with ' +
    '`pathsMode` which setting applies.',
  calendarId:
    'WHICH calendar is the project default cannot be switched via the bridge — you do that in the app ' +
    '(calendar library → Set as project default). If you want to change the CONTENT of the project calendar ' +
    '(or align it with that of another document), write with `planner_update_calendar` to the id from ' +
    '`planner_get_calendars.projectDefaultId`; attaching a task to another calendar is done with ' +
    '`update_tasks.calendarId`. Calendar ids are per document.',
  wbsAutoNumber: 'automatic WBS numbering is a document setting in the app, not via the bridge.',
  id: '`id` is the stable project identity and is never overwritten.',
  createdAt: 'timestamps are managed by the app.',
  modifiedAt: 'timestamps are managed by the app.',
};

/** Vormvalidatie van `update_project`; string = foutboodschap. Levert de veld-merge, de
 *  wis-vlaggen voor `statusDate`/`progressMode` en de lijst geraakte velden.
 *
 *  ONBEKENDE SLEUTELS KETSEN AF: elke onbekende sleutel wordt bij naam geweigerd, mét de toegestane
 *  lijst erbij — nooit stil laten vallen.
 */
function parseUpdateProject(
  args: unknown,
): { updates: Partial<Project>; clearStatusDate: boolean; clearProgressMode: boolean; clearDefaultWorkRule: boolean; touched: string[] } | string {
  const a = (args ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(a)) {
    if ((PROJECT_KEYS as readonly string[]).includes(key)) continue;
    if (PROJECT_REFUSED[key]) return `\`${key}\` is not written: ${PROJECT_REFUSED[key]}`;
    return `unknown field \`${key}\`; update_project only knows: ${PROJECT_KEYS.join(', ')}`;
  }
  const updates: Partial<Project> = {};
  for (const key of ['name', 'description', 'author', 'company'] as const) {
    if (a[key] !== undefined) {
      if (typeof a[key] !== 'string') return `\`${key}\` must be a string`;
      updates[key] = a[key] as string;
    }
  }
  if (a.startDate !== undefined) {
    if (!isProjectDateValue(a.startDate, false)) {
      return '`startDate` must be an existing ISO date (YYYY-MM-DD, without time)';
    }
    updates.startDate = a.startDate;
  }
  // `endDate` is een ECHT projectveld (Backstage-invoer, IFC-round-trip, MSPDI `FinishDate`, P6
  // `MustFinishByDate`, en het voedt de generatie-spanne van `update_calendar`). De leeskant geeft hem
  // terug, dus hij is ook schrijfbaar. `''` = geen einddatum (de app-conventie:
  // `moveProject` laat '' bewust '' en de exporteurs slaan het veld dan over) — géén `null`, want
  // het veld is in het type een verplichte string.
  if (a.endDate !== undefined) {
    if (a.endDate !== '' && !isProjectDateValue(a.endDate, false)) {
      return '`endDate` must be an existing ISO date (YYYY-MM-DD, without time) or an empty string to clear it';
    }
    updates.endDate = a.endDate;
  }
  // `progressMode` is een documentinstelling die de solver leest (out-of-sequence-afhandeling) en
  // die `get_project_info` teruggeeft. Enum + wissen naar de default (RETAINED_LOGIC).
  let clearProgressMode = false;
  if (a.progressMode !== undefined) {
    if (a.progressMode === null || a.progressMode === '') {
      clearProgressMode = true;
    } else if (a.progressMode !== 'RETAINED_LOGIC' && a.progressMode !== 'PROGRESS_OVERRIDE') {
      return '`progressMode` must be RETAINED_LOGIC or PROGRESS_OVERRIDE (or null to fall back to the ' +
        `default RETAINED_LOGIC), got '${String(a.progressMode)}'`;
    } else {
      updates.progressMode = a.progressMode;
    }
  }
  // De projectstandaard-werkregel; wissen = terug naar FIXED_DURATION_RATE. Raakt geen enkel getal
  // op bestaande taken.
  let clearDefaultWorkRule = false;
  if (a.defaultWorkRule !== undefined) {
    if (a.defaultWorkRule === null || a.defaultWorkRule === '') {
      clearDefaultWorkRule = true;
    } else if (typeof a.defaultWorkRule !== 'string' || !(WORK_RULES as readonly string[]).includes(a.defaultWorkRule)) {
      return `\`defaultWorkRule\` must be one of ${WORK_RULES.join(' | ')} (or null for the default FIXED_DURATION_RATE)`;
    } else {
      updates.defaultWorkRule = a.defaultWorkRule as WorkRule;
    }
  }
  // Wissen loopt NIET via de veld-merge: `Object.assign({ statusDate: undefined })` laat de sleutel
  // met waarde `undefined` achter, terwijl de store-actie `setStatusDate` hem echt `delete`t. Die
  // vorm houden we aan (IFC-serialisatie en de statusdatum-guards lezen op sleutel-aanwezigheid).
  let clearStatusDate = false;
  if (a.statusDate !== undefined) {
    if (a.statusDate === null || a.statusDate === '') {
      clearStatusDate = true;
    } else if (!isProjectDateValue(a.statusDate, true)) {
      return '`statusDate` must be an existing ISO date (YYYY-MM-DD) or, with hour planning, a date-time to ' +
        'the minute (YYYY-MM-DDTHH:mm); null or an empty string clears it';
    } else {
      updates.statusDate = a.statusDate;
    }
  }
  const touched = [
    ...Object.keys(updates),
    ...(clearStatusDate ? ['statusDate'] : []),
    ...(clearProgressMode ? ['progressMode'] : []),
    ...(clearDefaultWorkRule ? ['defaultWorkRule'] : []),
  ];
  if (touched.length === 0) {
    return `update_project requires at least one field (${PROJECT_KEYS.join('/')})`;
  }
  return { updates, clearStatusDate, clearProgressMode, clearDefaultWorkRule, touched };
}

/** De mechanisme-uitleg die MEE MOET zodra er een statusdatum wordt GEZET. Staat bewust in de
 *  payload en niet alleen in de tool-beschrijving: de AI leest data vaak eerder dan de beschrijving,
 *  en dit gevolg (de hele planning schuift op) is groot genoeg om niet stil te mogen blijven. Het
 *  batch-pad krijgt hem hierdoor óók — daar is er geen `enrichOk` en dus geen voor/na-getal. */
const STATUS_DATE_NOTE =
  'The status date is the DATA DATE: work with completion 0 can never start before this date and is pushed ' +
  'forward to it. Even WITHOUT any recorded progress the whole schedule (including the first milestone) ' +
  'therefore shifts to the status date and the project end moves by the same amount; `startDate` stays ' +
  'untouched. Clear the status date (null) to undo that.';

/** Synchrone, transactie-vrije kern van `update_project`. */
function updateProjectCore(
  ctx: McpContext,
  p: { updates: Partial<Project>; clearStatusDate: boolean; clearProgressMode: boolean; clearDefaultWorkRule: boolean; touched: string[] },
): MutationOutcome {
  // `draft.setProject` levert het aantal wortel-ankers dat het klemde (zelfde
  // bewerkbescherming als de UI, `projectSlice.setProject`) — meegeven in `data` zodat óók het
  // `planner_batch`-pad (dat rechtstreeks `updateProjectCore` gebruikt, zonder `enrichOk`) dit ziet.
  // `delete` i.p.v. `= undefined` voor een gewist veld: de IFC-serialisatie en de solver-defaults
  // lezen op sleutel-AANWEZIGHEID (zelfde conventie als de store-actie `setStatusDate`). Het wissen
  // gaat door dezelfde patch, zodat ook een gewiste projectstandaard de taken omzet die hem erven.
  const clear: ClearableProjectKey[] = [
    ...(p.clearStatusDate ? ['statusDate' as const] : []),
    ...(p.clearProgressMode ? ['progressMode' as const] : []),
    ...(p.clearDefaultWorkRule ? ['defaultWorkRule' as const] : []),
  ];
  const { clampedAnchors: anchorsClamped, measureChangedTaskIds } = ctx.transactions.draft.setProject(p.updates, clear);
  return {
    data: {
      updated: p.touched,
      ...(anchorsClamped > 0 ? { anchorsClamped } : {}),
      // B1a: een nieuwe standaard *Vast werk* zette deze taken (zonder eigen `workRule`) om naar de urenmaat.
      ...(measureChangedTaskIds.length > 0 ? { hourMeasureTaskIds: measureChangedTaskIds } : {}),
      ...(p.updates.statusDate ? { statusDateNote: STATUS_DATE_NOTE } : {}),
    },
  };
}

const updateProject: BatchStepTool = {
  name: 'planner_update_project',
  description:
    'Change project details. `startDate` anchors NEW tasks and does not shift the schedule (set it before ' +
    'planner_add_tasks); a later one only clamps root tasks without predecessor or constraint forward ' +
    '(`anchorsClamped`). To shift the ' +
    'whole schedule use planner_move_project. `statusDate` is the DATA DATE: unstarted work (completion 0) ' +
    'cannot lie before it, so it moves the schedule and the project end even without progress; set it only ' +
    'to record progress (`statusDateEffect`). Clearing it makes recorded actuals inert. `endDate` enforces ' +
    'nothing but sets the span of generated holidays.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      author: { type: 'string' },
      company: { type: 'string' },
      startDate: { type: 'string', description: 'YYYY-MM-DD.' },
      endDate: { type: 'string', description: 'YYYY-MM-DD; "" clears.' },
      statusDate: {
        type: ['string', 'null'],
        description: 'DATA DATE: YYYY-MM-DD, or YYYY-MM-DDTHH:mm in an hour schedule; null or "" clears.',
      },
      progressMode: {
        type: ['string', 'null'],
        enum: ['RETAINED_LOGIC', 'PROGRESS_OVERRIDE', null],
        description: 'Out-of-sequence progress; null = RETAINED_LOGIC.',
      },
      defaultWorkRule: {
        type: ['string', 'null'],
        enum: [...WORK_RULES, null],
        description:
          'For tasks without own `workRule`; null = FIXED_DURATION_RATE. FIXED_WORK converts those tasks to ' +
          'hours (also after switching back).',
      },
    },
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseUpdateProject, updateProjectCore),
  async handler(args, ctx) {
    const parsed = parseUpdateProject(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const touched = parsed.touched;

    // Voor/ná-meting van het projecteinde — vóór de mutatie gelezen, want de transactie sluit af met
    // een `runCPM` en dan is de oude stand weg. Alleen zinvol wanneer de call de STATUSDATUM raakt:
    // dat is de enige metadata-wijziging hier die de gerekende datums verzet (data-date-vloer).
    // `staleBefore` reist mee omdat een verouderd `cpmResult` het voor-getal onbetrouwbaar maakt —
    // dan is het verschil geen zuiver statusdatum-effect en moet de AI dat kunnen zien.
    const statusDateTouched = touched.includes('statusDate');
    const before = ctx.app.store.getState();
    const projectEndBefore = statusDateTouched ? (before.cpmResult?.projectEnd ?? null) : null;
    const staleBefore = before.scheduleStale;

    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => updateProjectCore(ctx, parsed));
    // `enrichOk` hieronder OVERSCHRIJFT `res.data` met wat `build()` teruggeeft — dus
    // het `anchorsClamped`-getal dat `updateProjectCore` er net inzette moet er vóór die overschrijving
    // uit gelezen worden (binnen `build()`'s closure heeft `res.data` op dat moment nog de OUDE,
    // niet-verrijkte waarde — `enrichOk` roept `build()` immers aan vóórdat het toewijst).
    const anchorsClamped =
      res.ok && res.data && typeof res.data === 'object' && 'anchorsClamped' in res.data
        ? (res.data as { anchorsClamped: number }).anchorsClamped
        : 0;
    const hourMeasureTaskIds =
      res.ok && res.data && typeof res.data === 'object' && 'hourMeasureTaskIds' in res.data
        ? (res.data as { hourMeasureTaskIds: string[] }).hourMeasureTaskIds
        : [];
    return enrichOk(res, () => {
      const state = ctx.app.store.getState();
      const p = state.project;
      const projectEnd = projectEndInfo(state).projectEnd;
      return {
        updated: touched,
        project: {
          name: p.name, startDate: p.startDate, endDate: p.endDate,
          statusDate: p.statusDate ?? null, progressMode: p.progressMode ?? null,
          defaultWorkRule: p.defaultWorkRule ?? null,
        },
        // Herinnering in de payload zelf: de AI leest data vaak eerder dan de beschrijving. "Geen
        // bestaande taak verschuift" geldt niet onvoorwaardelijk: zie de uitzondering hieronder
        // (`anchorsClamped`, bewerkbescherming).
        note: '`startDate` is the anchor for NEW tasks and does not shift the REST of the existing schedule. ' +
          'Exception (edit protection, not a Δ shift): with a LATER startDate, root tasks without ' +
          'predecessor/constraint that lie before the new date move along TO that date — see ' +
          '`anchorsClamped`. Use planner_move_project to shift the WHOLE existing schedule (every anchor).',
        ...(anchorsClamped > 0 ? { anchorsClamped } : {}),
        ...(hourMeasureTaskIds.length > 0 ? { hourMeasureTaskIds } : {}),
        ...(statusDateTouched
          ? {
              statusDateEffect: {
                statusDate: p.statusDate ?? null,
                projectEndBefore,
                projectEndAfter: projectEnd,
                shifted: !!projectEndBefore && projectEndBefore !== projectEnd,
                staleBefore,
                note: STATUS_DATE_NOTE,
              },
            }
          : {}),
        projectEnd,
      };
    });
  },
};

// =================================================================================================
// planner_move_project — wrapt de bestaande slice-actie `moveProject` binnen de transactie.
//
// ROUTE-KEUZE (zelfde als `move_task` in taskTools.ts): we roepen de slice-actie DIRECT aan i.p.v.
// een eigen draft-primitief te bouwen. De verschuif-logica (project-, taak-, resource- en baseline-datums,
// exacte-datum-pinning i.p.v. Δ-drift) leeft in `moveProject` en mag niet gedupliceerd worden. De
// transactie-suppressievlag dekt de interne `beginUndoable`, zodat het één undo-stap blijft.
//
// DUBBELE runCPM — BEWUST GEACCEPTEERD: `moveProject` draait zelf `runCPM()` en de transactie aan
// het eind nóg eens. Nabouwen zonder die trailing recompute zou de enige bron van waarheid
// dupliceren; `runCPM` is idempotent en pusht binnen de transactie geen undo-snapshot, dus het is
// puur rekenwerk.
// =================================================================================================
/** Vormvalidatie van `move_project`; string = foutboodschap. */
function parseMoveProject(args: unknown): { newStartDate: string; shiftBaselines: boolean } | string {
  const a = (args ?? {}) as { newStartDate?: unknown; shiftBaselines?: unknown };
  // Strikt, net als `update_project`: de prefix-regex liet `2026-02-30`/`2026-13-45`/`2026-03-01xyz`
  // door; `parseDate` rolde die stil door (Δ klopt niet) en de ruwe string belandde in
  // `project.startDate` en dus in het IFC-bestand.
  if (!isProjectDateValue(a.newStartDate, false)) {
    return '`newStartDate` must be an existing ISO date (YYYY-MM-DD)';
  }
  // Zelfde patroon als `dryRun`, lagere inzet: een niet-boolean zou stil als `false` gelden, dus
  // baselines blijven staan terwijl de aanroeper denkt ze mee te verschuiven.
  if (a.shiftBaselines !== undefined && typeof a.shiftBaselines !== 'boolean') {
    return booleanArgReason(a.shiftBaselines, 'shiftBaselines');
  }
  return { newStartDate: a.newStartDate, shiftBaselines: a.shiftBaselines === true };
}

/**
 * Synchrone, transactie-vrije kern van `move_project`. Draagt het Δ-snelpad ZELF (anders zou een
 * verschuiving naar de datum waar het project al staat een hele batch laten terugrollen op een
 * no-op): Δ=0 ⇒ `moved: false` zonder enige mutatie, precies zoals de losse call.
 */
function moveProjectCore(ctx: McpContext, p: { newStartDate: string; shiftBaselines: boolean }): MutationOutcome {
  const s0 = ctx.app.store.getState();
  const delta = computeMoveDelta(s0.project.startDate, p.newStartDate);
  if (!Number.isFinite(delta)) {
    throw new McpStepError('VALIDATION', `cannot determine the shift from project start '${s0.project.startDate}'`);
  }
  if (delta === 0) {
    return { data: { moved: false, deltaDays: 0, taskCount: s0.tasks.length, reason: 'the project start is already this date' } };
  }
  const out = ctx.app.store.getState().moveProject(p.newStartDate, { shiftBaselines: p.shiftBaselines });
  if (!out.moved) throw new McpStepError('VALIDATION', `shifting to '${p.newStartDate}' produced no change`);
  return { data: out };
}

const moveProject: BatchStepTool = {
  name: 'planner_move_project',
  description:
    'Shift the whole schedule to start on `newStartDate`. Calendars stay, so the end can move by a different ' +
    'number of days. External link anchors stay fixed. Baselines move only with `shiftBaselines: true`.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      newStartDate: { type: 'string', description: 'YYYY-MM-DD.' },
      shiftBaselines: { type: 'boolean' },
    },
    required: ['newStartDate'],
  },
  batchStep: parsedBatchStep(parseMoveProject, moveProjectCore),
  async handler(args, ctx) {
    const parsed = parseMoveProject(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const { newStartDate, shiftBaselines } = parsed;

    const s0 = ctx.app.store.getState();
    const delta = computeMoveDelta(s0.project.startDate, newStartDate);
    if (!Number.isFinite(delta)) {
      return toolError(ctx, 'VALIDATION', `cannot determine the shift from project start '${s0.project.startDate}'`);
    }
    // No-op-snelpad: Δ=0 ⇒ `moveProject` muteert niets; dan ook geen transactie/undo-stap.
    if (delta === 0) {
      return okDirectGuarded(
        ctx,
        { moved: false, deltaDays: 0, taskCount: s0.tasks.length, reason: 'the project start is already this date', projectEnd: projectEndInfo(s0).projectEnd },
        [],
      );
    }
    const projectEndBefore = s0.cpmResult?.projectEnd ?? '';

    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => moveProjectCore(ctx, parsed));

    return enrichOk(res, () => {
      const out = (res as McpToolOk).data as { moved: boolean; deltaDays: number; taskCount: number };
      const { projectEnd, cappedTaskIds } = projectEndInfo(ctx.app.store.getState());
      const endDeltaDays = safeDiffDays(projectEndBefore, projectEnd);
      return {
        ...out,
        newStartDate,
        shiftBaselines,
        projectEndBefore,
        projectEnd,
        endDeltaDays,
        ...(endDeltaDays !== out.deltaDays
          ? { note: `The finish moves ${endDeltaDays} calendar days while the start moves ${out.deltaDays} days — the calendar (holidays/construction holiday) intervenes.` }
          : {}),
        ...(cappedTaskIds ? { cappedTaskIds } : {}),
      };
    });
  },
};

// =================================================================================================
// planner_save_baseline (staleness-guard; UITGESLOTEN van batch)
//
// ROUTE-KEUZE (zelfde als `move_task`/`move_project`): de slice-actie `saveBaseline` wordt DIRECT
// binnen de transactie aangeroepen — er is geen draft-variant en de snapshot-logica (leaf-taken,
// early-datums met schedule-fallback, actief zetten) hoort niet gedupliceerd te worden. De
// suppressievlag dekt de interne `beginUndoable`, dus het blijft één undo-stap.
//
// `batchable: false` is normatief: een baseline hoort een losse, bewuste
// nulmeting op een vers schema te zijn; binnen een batch-snapshot zou een rollback hem mee-wissen
// en is de volgorde-semantiek onbepaald.
// =================================================================================================
const saveBaseline: McpToolDef = {
  name: 'planner_save_baseline',
  description:
    'Save the current schedule as the new active baseline. Not allowed in planner_batch.',
  kind: 'mutate',
  batchable: false,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: { name: { type: 'string', description: 'Default "Baseline N".' } },
  },
  async handler(args, ctx) {
    const a = (args ?? {}) as { name?: unknown };
    if (a.name !== undefined && typeof a.name !== 'string') {
      return toolError(ctx, 'VALIDATION', '`name` must be a string');
    }

    const g = guardNonTransactional(ctx);
    if (g) return g;

    // Eerst herrekenen bij een stale planning (runCPM pusht hier geen undo-snapshot: "modus
    // aan én stale" is onbereikbaar, zie de kop van readTools.ts).
    const fresh = ensureFreshSchedule(ctx.app);
    if (fresh.error) {
      return toolError(ctx, 'VALIDATION', `the schedule could not be recalculated before the baseline: ${fresh.error}`);
    }

    const name = (a.name as string | undefined) || `Baseline ${ctx.app.store.getState().baselines.length + 1}`;
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => {
      const id = ctx.app.store.getState().saveBaseline(name);
      return { data: { baselineId: id } };
    });

    return enrichOk(res, () => {
      const id = ((res as McpToolOk).data as { baselineId: string }).baselineId;
      const state = ctx.app.store.getState();
      const bl = state.baselines.find((b) => b.id === id);
      return {
        baselineId: id,
        name,
        recomputed: fresh.recomputed,
        taskCount: bl?.tasks.length ?? 0,
        projectEnd: bl?.projectEnd ?? projectEndInfo(state).projectEnd,
      };
    });
  },
};

/** Alle tools van deze module als vlakke array (registreer via één regel in toolRegistry.MODULES). */
export const calendarResourceTools: McpToolDef[] = [
  updateCalendar,
  manageAssignments,
  levelResources,
  clearLeveling,
  updateProject,
  moveProject,
  saveBaseline,
];
