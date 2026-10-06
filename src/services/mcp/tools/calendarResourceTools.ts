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
import { ensureFreshSchedule } from '../staleGuard';
import { createNewCalendar } from '@/engine/calendar/defaultCalendar';
import { computeMoveDelta } from '@/engine/moveProject';
import { diffDays } from '@/utils/dateUtils';
import { deriveHoursPerDay, workDaysFromBands } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';
import type { GeneratorCountry, HolidayGenParams } from '@/engine/calendar/generateCalendarHolidays';
import type { CalendarGeneration, Holiday, WorkCalendar, WorkingException, WorkTimeBands } from '@/types/calendar';
import { isResourceCurve, isValidUnits, RESOURCE_CURVES, type ResourceCurve } from '@/types/resource';
import type { Project } from '@/types/project';
import type { LevelingOptions, LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { isFiniteNumber } from '@/utils/guards';
import { hasLevelingOutput } from '@/utils/taskDefaults';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { markDocumentEdited } from '@/state/documentEdited';
import { holidayIssue, ISO_DATE_ONLY } from '@/utils/holidayRange';
import {
  calendarScalarBreakIssue, simpleBreakNetHours, simpleBreakPatch, type ScalarBreakIssue,
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
const GEN_COUNTRIES: GeneratorCountry[] = ['NL', 'DE', 'BE', 'FR', 'UK', 'AT', 'CH', 'none'];
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

/** Spanne voor `computeGenerateSpan` (via resolveCalendarHolidays). Bij AANMAAK geven we bewust een
 *  LEEG projecteinde door: dan geldt de create-spanne (startjaar−1 t/m startjaar+3) i.p.v. een
 *  spanne rond een einddatum die nog niets met deze nieuwe kalender te maken heeft. */
function calendarSpan(s: StoreState, forCreate: boolean): { projectStart: string; projectEnd: string } {
  return {
    projectStart: s.project.startDate,
    projectEnd: forCreate ? '' : (s.project.endDate || s.cpmResult?.projectEnd || ''),
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
 * "Netto-uren per dag" een afleiding uit werkdag − pauze (`simpleBreakPatch` → `simpleBreakNetHours`).
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
    'hours are DERIVED from working day minus break, like the non-editable "Net hours per day" in the ' +
    `calendar dialog — here ${clockLabel(start)}–${clockLabel(end)} with ${pause} min break = ` +
    `${hoursLabel(net)} h net. Leave \`hoursPerDay\` out, or change the working day ` +
    '(`workStartHour`/`workEndHour`, in HOURS) or the break duration (`simpleBreakDurationMinutes`, in ' +
    `MINUTES) so that working day minus break becomes ${hoursLabel(item.hoursPerDay)} h` +
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
    // Spiegelt `CalendarForm.applyBands` (de kalenderdialoog): werkdagen én netto uren volgen de
    // banden. Zijn ze expliciet meegegeven (een letterlijke lezing stuurt ze mee), dan is die opgave
    // leidend — `calendarItemReason` heeft dan al vastgesteld dat `workDays` de banden niet tegenspreekt.
    if (item.workDays === undefined) patch.workDays = workDaysFromBands(bands);
    if (item.hoursPerDay === undefined) patch.hoursPerDay = deriveHoursPerDay(bands, existing.hoursPerDay);
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
  return cal.workTime ? 'hour' : 'day';
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

      // Een expliciete urentaak bewaart haar minuten onafhankelijk van de kalender. Zonder concrete
      // banden kan de solver die minuten echter niet langs werkende tijd plaatsen. Weiger daarom
      // vóór de mutatie: een rollback achteraf zou een halve kalenderwijziging kunnen laten lekken.
      if (dropKeys.includes('workTime')) {
        const state = ctx.app.store.getState();
        const hasAffectedHourTask = state.tasks.some((task) => task.time.durationUnit === 'hours'
          && (task.calendarId ?? state.calendar.id) === plan.targetId);
        if (hasAffectedHourTask) {
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

/** Eén weekdag in het `workTime.byWeekday`-schema (7× identiek; `[]` = niet-werkende dag). */
const WORKTIME_DAY_SCHEMA = {
  type: 'array',
  description:
    'Working-time bands of this weekday, ascending and non-overlapping. Empty list = non-working day.',
  items: {
    type: 'object',
    required: ['start', 'end'],
    properties: {
      start: { type: 'number', minimum: 0, maximum: 1439, description: 'Start in MINUTES from midnight (07:00 = 420).' },
      end: { type: 'number', minimum: 1, maximum: 2880, description: 'End in MINUTES from midnight of the START day; across midnight keeps counting (22:00→06:00 = 1800). Must be greater than `start`.' },
    },
  },
} as const;

const WORKTIME_SCHEMA = {
  type: ['object', 'null'],
  description:
    'HOUR calendar: working-time bands per ISO weekday in minutes from midnight. `null` = back to a DAY ' +
    'calendar. NOTE: this redefines the duration of every task on this calendar (see the description).',
  properties: {
    byWeekday: {
      type: 'object',
      description: 'All seven weekdays ("1" = Monday … "7" = Sunday) — a partial specification is refused.',
      properties: {
        '1': WORKTIME_DAY_SCHEMA, '2': WORKTIME_DAY_SCHEMA, '3': WORKTIME_DAY_SCHEMA, '4': WORKTIME_DAY_SCHEMA,
        '5': WORKTIME_DAY_SCHEMA, '6': WORKTIME_DAY_SCHEMA, '7': WORKTIME_DAY_SCHEMA,
      },
    },
  },
} as const;

/** Feestdag-item; gedeeld door `rawHolidays` (toevoegen) en `holidays` (exact vervangen). */
const HOLIDAY_ITEM_SCHEMA = {
  type: 'object',
  required: ['name', 'startDate', 'endDate'],
  properties: {
    name: { type: 'string' },
    startDate: { type: 'string', description: 'ISO date (YYYY-MM-DD), inclusive.' },
    endDate: { type: 'string', description: 'ISO date (YYYY-MM-DD), inclusive.' },
  },
} as const;

const updateCalendar: BatchStepTool = {
  name: 'planner_update_calendar',
  description:
    'Change or create work calendars (bulk — one call = one undo step). Per item: change an EXISTING ' +
    'calendar id, or create an unknown id with `create: true` (an unknown id WITHOUT `create` is softly ' +
    'refused). NOTE: calendar ids are PER DOCUMENT — an imported or other document rebuilds calendars via ' +
    '`create`, it never reuses an id from another document. Holidays can be set in two ways: `generate` ' +
    '(country/region/construction holiday — the generator materializes the days over the project span and ' +
    'REPLACES the existing list) and/or `rawHolidays` (literal exceptions, e.g. frost days). NOTE — ' +
    '`rawHolidays` ADDS by default: the given days are merged with the existing ones (deduplicated by date ' +
    'range), nothing disappears. If you want to REMOVE a holiday or set the list exactly, pass ' +
    '`holidaysMode: "replace"` — then the list becomes exactly `rawHolidays` (an EMPTY array clears all ' +
    'holidays). An empty `rawHolidays` in add mode is softly refused, because it would do nothing. If raw ' +
    'days are set, the generator provenance is cleared and the calendar is LITERAL from then on ' +
    '(`becameLiteral: true` per item) — regenerating is then no longer possible. With `create: true` WITHOUT ' +
    '`generate`/`rawHolidays`/`holidays` the new calendar inherits the holidays of the app default calendar ' +
    '(in construction mode: the NL set); the response reports that per row as `holidaysFrom: "app-default"` ' +
    'with `holidayCount`. If you want guaranteed NO holidays, pass `generate: { country: "none" }` or ' +
    '`holidays: []`. TRANSFERRING A CALENDAR TO ANOTHER DOCUMENT: pass a calendar object from ' +
    '`planner_get_calendars` back LITERALLY (with `create: true`). All read fields are accepted — `workTime` ' +
    '(hour bands), `shift`, `generation` (provenance in the READ FORM: `ruleSetId`/`breakChoice`/years), ' +
    '`holidays` (the complete list, which REPLACES the existing list exactly), the break pattern ' +
    '`simpleBreakStartMinute`/`simpleBreakDurationMinutes` (minutes) and `workingExceptions` (working days, ' +
    'replaces the list exactly). The derived read fields `isProjectDefault`/`usedByTasks`/`usedByResources` ' +
    'and the library stamp `libraryOrigin` may come along but do nothing; the response reports them as ' +
    '`ignoredFields`. BREAK: on a DAY calendar with a break, `hoursPerDay` is DERIVED from working day minus ' +
    'break, just like the non-editable "Net hours per day" in the calendar dialog. If you touch the break or ' +
    'start/end, `hoursPerDay` follows automatically. More or fewer net hours means: change ' +
    '`workStartHour`/`workEndHour` or `simpleBreakDurationMinutes`. A given `hoursPerDay` that does not ' +
    'match working day minus break (to the minute) is softly refused, naming the fields you do need to ' +
    'change; an equal value (as in a literal reading) does nothing. Without break fields (a legacy calendar) ' +
    '`hoursPerDay` can simply be set. A break outside the working day or covering the whole day is softly ' +
    'refused. Use `generate` (country/region/construction holiday) OR `generation` (provenance of days sent ' +
    'along), never both — `generate` RUNS the generator over the project span of THIS document, `generation` ' +
    'only writes the provenance. HOUR VS DAY CALENDAR: `workTime` turns it into an HOUR calendar (`null` ' +
    'sets it back to DAY). A calendar change NEVER changes the chosen unit or native quantity of a task. ' +
    'Start/finish distribution and project end can change, though; an hour task cannot be calculated without ' +
    'concrete work blocks. The response reports a mode switch as `modeChangedFrom` and confirms with ' +
    '`taskDurationsPreserved: true` that the task durations were not converted. `workDays` and `hoursPerDay` ' +
    'are DERIVED from the bands as soon as you pass `workTime` (as the calendar dialog does); if you pass ' +
    'them anyway, `workDays` must not contradict the bands. KEEPING IN THE FILE (IFC): a newly created ' +
    'calendar to which NO task and no resource is attached does NOT survive save+reload — so attach tasks to ' +
    'it right away with `update_tasks.calendarId`. Hour bands do survive IFC, but bands that DIFFER PER ' +
    'WEEKDAY do not: the format carries one work-week pattern, so on reload all working days get the bands ' +
    'of the first working day. A calendar in which tasks no longer fit (e.g. a long holiday block) gives no ' +
    'error but a prominent warning with `cappedTaskIds`. If, on the other hand, NO working time at all is ' +
    'left (empty `workDays`, or `workTime` bands on no day at all), the recalculation fails and the whole ' +
    'call is rolled back — a half calendar never ends up in the document.',
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
        description: 'The calendars to change/create; everything in one transaction.',
        items: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Existing calendar id; with `create: true` a freely chosen label (the real id comes back as `id`, your value as `requestedId`).' },
            create: { type: 'boolean', description: 'Create the calendar if the id does not exist.' },
            name: { type: 'string' },
            description: { type: 'string' },
            workDays: {
              type: 'array',
              items: { type: 'integer', minimum: 1, maximum: 7 },
              description: 'Working days as ISO weekday numbers (1 = Monday … 7 = Sunday).',
            },
            workStartHour: { type: 'number', description: 'Start of the working day in HOURS (0–24), e.g. 7.' },
            workEndHour: { type: 'number', description: 'End of the working day in HOURS (0–24), e.g. 16.' },
            hoursPerDay: {
              type: 'number',
              description: 'Net working hours per working day (HOURS), e.g. 8. On a DAY calendar WITH a ' +
                'break it is derived (working day minus break): a differing value is softly refused, an ' +
                'equal one does nothing — change the working day or the break duration there.',
            },
            simpleBreakStartMinute: {
              type: 'integer', minimum: 0, maximum: 1439,
              description: 'Start of the break on a DAY calendar, in MINUTES from midnight (12:30 = 750). Read field of get_calendars. The net hours (`hoursPerDay`) are derived from it, as in the calendar dialog.',
            },
            simpleBreakDurationMinutes: {
              type: 'integer', minimum: 0, maximum: 1440,
              description: 'Break duration in MINUTES (0 = no break). Must fall within the working day and may not cover it completely. Read field of get_calendars.',
            },
            workingExceptions: {
              type: 'array',
              description:
                'Days that become WORKING (e.g. a make-up Saturday) — the COMPLETE list, exactly the read ' +
                'field of planner_get_calendars; replaces the existing list (empty list = clear). Optionally ' +
                'per exception `bands` in the same form as `workTime` (omitted = the normal working time of ' +
                'the calendar).',
              items: {
                type: 'object',
                required: ['name', 'startDate', 'endDate'],
                properties: {
                  name: { type: 'string' },
                  startDate: { type: 'string', description: 'ISO date (YYYY-MM-DD), inclusive.' },
                  endDate: { type: 'string', description: 'ISO date (YYYY-MM-DD), inclusive.' },
                  bands: WORKTIME_DAY_SCHEMA,
                },
              },
            },
            generate: {
              type: 'object',
              description: 'Generator basis for holidays; the year span is derived from the project.',
              required: ['country'],
              properties: {
                country: {
                  type: 'string',
                  enum: ['NL', 'DE', 'BE', 'FR', 'UK', 'AT', 'CH', 'none'],
                  description:
                    'Country code of the holiday set — UPPERCASE, exactly one of the listed values. `none` = ' +
                    'no holiday set: that CLEARS the generated days (and the provenance).',
                },
                region: { type: 'string', description: 'Federal state/region/canton; omitted = national.' },
                bouwvak: { type: 'string', enum: ['geen', 'noord', 'midden', 'zuid'], description: 'NL only; default `geen` (none).' },
              },
            },
            holidaysMode: {
              type: 'string',
              enum: ['merge', 'replace'],
              description:
                '`merge` (default) = ADD `rawHolidays` to the existing holidays. `replace` = set the holiday ' +
                'list exactly to `rawHolidays` — this is the ONLY way to remove a holiday; an empty ' +
                '`rawHolidays` then clears them all.',
            },
            rawHolidays: {
              type: 'array',
              description:
                'Literal exceptions (frost days, company closure). ADDS by default (nothing disappears); ' +
                'with `holidaysMode: "replace"` this list replaces the existing one completely. Raw days ' +
                'clear the generator provenance.',
              items: HOLIDAY_ITEM_SCHEMA,
            },
            holidays: {
              type: 'array',
              description:
                'The COMPLETE holiday list — exactly the read field of planner_get_calendars. Replaces the ' +
                'existing list precisely (empty list = no holidays). For transferring a calendar between ' +
                'documents; combine with `generation` to take the provenance along too. Not together with ' +
                '`rawHolidays`/`holidaysMode`/`generate`.',
              items: HOLIDAY_ITEM_SCHEMA,
            },
            workTime: WORKTIME_SCHEMA,
            shift: {
              type: ['string', 'null'],
              enum: ['FIRST', 'SECOND', 'THIRD', 'USERDEFINED', null],
              description: 'Shift classification (IFC `PredefinedType`); `null` clears it. Read field of get_calendars.',
            },
            generation: {
              type: ['object', 'null'],
              description:
                'Provenance metadata in the READ FORM of get_calendars — only records WHERE the holidays ' +
                'sent along come from, and does NOT run the generator. `null` clears the provenance (the ' +
                'calendar becomes literal). Not together with `generate`.',
              required: ['ruleSetId', 'generatedFromYear', 'generatedToYear'],
              properties: {
                ruleSetId: { type: 'string', enum: ['NL', 'DE', 'BE', 'FR', 'UK', 'AT', 'CH'], description: 'Country set that produced the dates.' },
                region: { type: 'string', description: 'Federal state/region/canton; omitted = national.' },
                breakChoice: { type: 'string', enum: ['noord', 'midden', 'zuid'], description: 'NL construction holiday (bouwvak); omitted = none.' },
                generatedFromYear: { type: 'integer', description: 'First materialized year (incl.).' },
                generatedToYear: { type: 'integer', description: 'Last materialized year (incl.).' },
              },
            },
            isProjectDefault: { type: 'boolean', description: 'DERIVED read field of get_calendars — may come along, is ignored (comes back as `ignoredFields`).' },
            usedByTasks: { type: 'integer', description: 'DERIVED read field of get_calendars — may come along, is ignored.' },
            usedByResources: { type: 'integer', description: 'DERIVED read field of get_calendars — may come along, is ignored.' },
            libraryOrigin: { type: 'object', description: 'Library stamp from get_calendars (belongs to the SOURCE document) — may come along, is ignored (comes back as `ignoredFields`); linking to the library goes through the app.' },
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
      // De schakelaar Urenplanning is puur UI (de solver rekent sowieso uur-native): meld het, want
      // de gebruiker ziet zijn uurkalender anders nergens terug in de app.
      if (rows.some((r) => r.mode === 'hour') && !ctx.app.store.getState().ui.enableHourPlanning) {
        warnings.push(
          'There is now an HOUR calendar in this document while the app setting "Enable hour planning" is ' +
          'OFF. The schedule is calculated hour-native, but the app shows no hour input/display until the ' +
          'user turns that setting on (Settings → Enable hour planning).',
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
    'Manage resource assignments in bulk (one call = one undo step). One `action` per item: `add` (`taskId`, ' +
    '`resourceId`, `unitsPerDay` = units per WORKING DAY where 1 = 100% / one person, optionally `curve` and ' +
    '`remainingWorkMinutes`), `update` (`assignmentId` + `unitsPerDay`, `curve` and/or ' +
    '`remainingWorkMinutes`), `move` (`assignmentId` to another `taskId`) or `remove` (`assignmentId`). The ' +
    'ids and field names are exactly those of the read tools (get_task/list_resources), so you can put them ' +
    'straight back. WORK RULE (task type, `workRule` on the task — see planner_update_tasks): work = ' +
    'remaining duration × units, and the rule determines which corner moves along. Under ' +
    'FIXED_WORK/FIXED_RATE a `unitsPerDay` change or adding/removing a resource therefore changes the TASK ' +
    'DURATION; `remainingWorkMinutes` (remaining work in work minutes, > 0) lengthens/shortens the task ' +
    '(units protected) or changes the units (duration protected). Under the default rule FIXED_DURATION_RATE ' +
    'a units change leaves the duration alone and `remainingWorkMinutes` only rewrites the units (U = W / ' +
    'D). The response reports the project end; read the task again for the new duration. Assigning is only ' +
    'possible on a LEAF TASK (no milestone, no summary task) and the same resource may only be on the same ' +
    'task once — a second assignment would double-count the load and is softly refused, also when the ' +
    'duplicate is within this one call. Refused items come back in `itemRejections`; the valid items simply ' +
    'stay.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        minItems: 1,
        description: 'The assignment actions to run, in order.',
        items: {
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['add', 'update', 'move', 'remove'] },
            taskId: { type: 'string', description: 'For `add`: the leaf task. For `move`: the NEW leaf task.' },
            resourceId: { type: 'string', description: 'Only for `add`.' },
            assignmentId: { type: 'string', description: 'For `update`/`move`/`remove`; exactly the id from the read tools.' },
            unitsPerDay: { type: 'number', exclusiveMinimum: 0, description: 'Units per WORKING DAY (1 = 100% = one person/piece; 0.5 = half a day).' },
            curve: {
              type: 'string',
              enum: [...RESOURCE_CURVES],
              description: 'Distribution curve over the duration (the eight MS Project/P6 shapes); omitted = UNIFORM.',
            },
            remainingWorkMinutes: {
              type: 'number',
              exclusiveMinimum: 0,
              description:
                'For `add` or `update`: REMAINING work of this assignment in WORK minutes (8 hours = 480). ' +
                'The work rule of the task determines what moves along: the duration (FIXED_WORK/FIXED_RATE) ' +
                'or the units (FIXED_DURATION_*). Only on an ordinary leaf task on working time; material ' +
                'does not count towards the duration.',
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
      `${unresolvedCount} task(s) keep an unresolved peak; see \`unresolvedReasons\` (INTRINSIC_OVERRUN = ` +
      'the task on its own already asks for more than the capacity, CALENDAR_MISMATCH = resource and task ' +
      'calendar do not line up, INSUFFICIENT_CAPACITY = there is simply too little capacity, ' +
      'CEILING_TOO_TIGHT = the extension ceiling leaves too little room, CEILING_UNREACHABLE = a ' +
      'deadline/backward constraint makes every ceiling unreachable, RESIDUAL_FULL = the project\'s own ' +
      'allocation had room but the residual capacity of the library pool item is used up — other documents ' +
      'occupy the pool, NO_WINDOW_IN_HORIZON = the search horizon ran out without finding a fitting window).',
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
    'Level resource peaks by shifting tasks within their float (or beyond it). `constrainToFloat: true` ' +
    '(default) = smooth WITHIN the float: the project end date is sacred and peaks that cannot be resolved ' +
    'stay. `constrainToFloat: false` = the end date may move; the response then reports that shift ' +
    'prominently in `projectEndDelta` and `warnings`. With `resourceIds` you restrict it to certain ' +
    'resources (material is always skipped); with `dryRun: true` you get a complete PREVIEW without changing ' +
    'anything at all — recommended before you apply. The response always contains the complete result: ' +
    '`delays` (applied delay in working days), `shifts` (every task whose start moves), `unresolved` + ' +
    '`unresolvedReasons` (WHY a peak remained) and the project end before/after. Leveling first resets ' +
    'itself completely, so running it again does not stack.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      constrainToFloat: {
        type: 'boolean',
        description: 'true (default) = only shift within the total float, the end date stays sacred. false = the end date may shift.',
      },
      resourceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Restrict to these resources; omitted = all renewable resources (material never counts).',
      },
      dryRun: {
        type: 'boolean',
        description:
          'true = preview only: nothing is leveled and no undo step is created. Note: a schedule that has ' +
          'not been calculated yet is still recalculated FIRST in that case (otherwise the before/after ' +
          'dates would not be right); `recomputed` reports that.',
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
    'Clear all leveling delays, so every task is back on its unleveled date. Note: `planner_level_resources` ' +
    'resets the delays ITSELF before it calculates — so running this tool beforehand is pointless. Only use ' +
    'it to undo an earlier leveling without calculating a new one.',
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
    'Project info → Calculation profile and options; `planner_get_project_info` shows the active profile and ' +
    'the project options, `planner_get_critical_path` reports with `pathsMode` which setting applies.',
  schedulingProfile:
    'the calculation profile (P6 / MS Project / OPS / custom) is NOT settable via the bridge: a switch ' +
    'shifts dates of the whole document. Choose it in the app under File → Project info → Calculation ' +
    'profile; `planner_get_project_info` shows the active profile with its twenty-seven resolved conventions.',
  leveling:
    '`leveling` belongs in `project.schedulingOptions`: the leveling settings from the source file (P6 ' +
    'SCHEDOPTIONS/RSRCLEVELLIST) are read and kept, but NOT applied yet and not settable via the bridge. ' +
    '`planner_get_project_info` shows them read-only; manual leveling is done with `planner_level_resources`.',
  floatPaths:
    '`floatPaths` belongs in `project.schedulingOptions` and is NOT settable via the bridge (see the app ' +
    'under File → Project info → Calculation profile and options). `planner_get_critical_path` reports with ' +
    '`pathsMode` which setting applies.',
  calendarId:
    'WHICH calendar is the project default cannot be switched via the bridge — you do that in the app ' +
    '(calendar library → set as project calendar). If you want to change the CONTENT of the project calendar ' +
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
  const anchorsClamped = ctx.transactions.draft.setProject(p.updates);
  if (p.clearStatusDate || p.clearProgressMode || p.clearDefaultWorkRule) {
    ctx.app.store.setState((s) => {
      // `delete` i.p.v. `= undefined`: de IFC-serialisatie en de solver-defaults lezen op
      // sleutel-AANWEZIGHEID (zelfde conventie als de store-actie `setStatusDate`).
      if (p.clearStatusDate) delete s.project.statusDate;
      if (p.clearProgressMode) delete s.project.progressMode;
      if (p.clearDefaultWorkRule) delete s.project.defaultWorkRule;
      s.project.modifiedAt = new Date().toISOString();
      markDocumentEdited(s);
    });
  }
  return {
    data: {
      updated: p.touched,
      ...(anchorsClamped > 0 ? { anchorsClamped } : {}),
      ...(p.updates.statusDate ? { statusDateNote: STATUS_DATE_NOTE } : {}),
    },
  };
}

const updateProject: BatchStepTool = {
  name: 'planner_update_project',
  description:
    'Change project details: `name`, `description`, `author`, `company`, `statusDate` (the reporting date on ' +
    'which progress is recorded — WITHOUT this date the progress path of update_tasks refuses), `endDate` ' +
    '(the contractual/desired end date — pure metadata, it enforces NOTHING in the schedule; an empty string ' +
    'clears it), `defaultWorkRule` (project default task type for tasks without their own `workRule`; null = ' +
    'FIXED_DURATION_RATE), `progressMode` (RETAINED_LOGIC or PROGRESS_OVERRIDE — how the solver handles ' +
    'out-of-sequence work; null = back to the default RETAINED_LOGIC) and `startDate`. An UNKNOWN field is ' +
    'refused with the allowed list — nothing is ever silently thrown away. IMPORTANT about `startDate`: it ' +
    'is the anchor for tasks still to be CREATED and does not shift the REST of the existing schedule — no ' +
    'task FINISH moves along, except the finish of the clamped anchors themselves, which moves along ' +
    'preserving duration. Since T7b there IS one targeted exception (edit protection, not a Δ shift): a ' +
    'LATER `startDate` clamps existing task anchors that have no predecessor and no constraint and lie ' +
    'before the new start date forward TO that date (the response reports `anchorsClamped`) — so a root task ' +
    'does not silently stay hanging before the official project start after moving the start. A task with a ' +
    'predecessor, a constraint, or a start after the new date stays untouched. If you want to shift the ' +
    'WHOLE existing schedule (every anchor, every task) by Δ days, use `planner_move_project`. So set ' +
    '`startDate` before add_tasks, not after. EQUALLY IMPORTANT about `statusDate`: it is NOT a passive ' +
    'label but the DATA DATE from P6/MSP, and it RESCHEDULES the schedule. Work that has not started yet ' +
    '(completion 0) may no longer lie before the status date and is pushed forward to that date; on a ' +
    'schedule WITHOUT any progress EVERYTHING therefore moves along — including the first milestone — and ' +
    'the project end jumps by the same amount, while `startDate` simply stays. So only set a status date ' +
    'when you are actually going to record progress. The response reports the project end before AND after ' +
    'this call under `statusDateEffect`, so you see that shift. `statusDate: null` (or an empty string) ' +
    'clears the status date — do that deliberately: without a reporting date, actuals already recorded ' +
    'become inert (the solver no longer pins to them) and calculated dates can shift on the next ' +
    'recalculation.',
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
      startDate: { type: 'string', description: 'ISO date (YYYY-MM-DD). Anchor for NEW tasks; does NOT shift existing tasks.' },
      endDate: { type: 'string', description: 'Desired/contractual end date as an ISO date (YYYY-MM-DD); an empty string clears it. Metadata — enforces nothing in the schedule.' },
      statusDate: {
        type: ['string', 'null'],
        description:
          'ISO date (YYYY-MM-DD) — with hour planning a time to the minute is allowed (YYYY-MM-DDTHH:mm) — ' +
          'or null to clear it. This is the DATA DATE: unstarted work (completion 0) is pushed forward to ' +
          'this date, so setting it shifts the whole schedule and the project end even without any progress.',
      },
      progressMode: {
        type: ['string', 'null'],
        enum: ['RETAINED_LOGIC', 'PROGRESS_OVERRIDE', null],
        description: 'Progress scheduling mode; null = back to the default RETAINED_LOGIC.',
      },
      defaultWorkRule: {
        type: ['string', 'null'],
        enum: [...WORK_RULES, null],
        description:
          'Project default work rule (task type) for tasks without their own `workRule` — see ' +
          'planner_update_tasks `fields.workRule` for the four values. null = the default ' +
          'FIXED_DURATION_RATE. Switching changes no number.',
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
    'Shift the WHOLE existing schedule so that the project starts on `newStartDate`: all tasks and resource ' +
    'dates move along. This is the opposite of `planner_update_project.startDate` (which only sets the ' +
    'anchor for new tasks). Note: the CALENDARS deliberately do NOT move along — holidays and construction ' +
    'holiday lie on fixed dates, so the end date can jump by a DIFFERENT number of days than the shift ' +
    'itself; the response reports both. Baselines stay put by default (a baseline exists to measure ' +
    'deviation); with `shiftBaselines: true` they move along.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      newStartDate: { type: 'string', description: 'New project start as an ISO date (YYYY-MM-DD).' },
      shiftBaselines: { type: 'boolean', description: 'Let saved baselines move along; default false.' },
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
    'Record the current schedule as a baseline and make it active right away; later deviations are measured ' +
    'against it with compare_baseline/analyze_delay. If the schedule is out of date OR has never been ' +
    'calculated (e.g. after crash recovery), it is recalculated first so that the baseline is on fresh dates ' +
    '(`recomputed` reports that). This tool can NOT run as a step in a batch: a baseline should be a ' +
    'separate, deliberate measurement. Without `name` the baseline gets an incrementing default name.',
  kind: 'mutate',
  batchable: false,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: { name: { type: 'string', description: 'Name of the baseline; omitted = "Baseline N".' } },
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
      return toolError(ctx, 'VALIDATION', `the schedule could not be recalculated before the baseline: ${fresh.error} `);
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
