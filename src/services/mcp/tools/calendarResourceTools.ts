// MCP-toolmodule (taak T20, spec §Tool-set Muteren + §Werkpakket 5 + het §level_resources-contract):
// kalender-, toewijzings-, nivelleer-, project- en baseline-mutaties. Zelfde bouwwijze als
// `taskTools.ts` (T19): `planner_`-prefix, verplichte description, de vier MCP-annotaties, een
// JSON-schema met EXPLICIETE eenheden, en alle échte mutaties via `runMutateTool` →
// `runInMcpTransaction` (één undo-stap, één herberekening, geen bestands-/save-side-effects).
//
// Drie doorlopende conventies uit T19:
//   1. ZACHTE per-item-weigeringen (`itemRejections`) — één rotte regel rolt nooit de hele bulk terug;
//      structurele fouten van een ENKELVOUDIGE tool zijn hard via `McpStepError`.
//   2. LEGE-BATCH-SNELPAD — een bulk met statisch nul uitvoerbare items betreedt géén transactie
//      (geen spurious undo-snapshot, geen redo-wipe door een AI-no-op). De classificatie draait
//      daarom in een GEDEELDE helper die zowel het snelpad als de transactie-fn voedt.
//   3. `enrichOk` — de respons-`data` wordt ná de transactie opnieuw uit de VERSE store opgebouwd.
//
// SCHRIJFKANT SPREEKT DE LEESKANT (harde eis): de veldnamen zijn identiek aan de T18-leestools —
// `assignmentId`, `unitsPerDay`, `curve`. Een AI die `get_task` leest kan die id's/velden dus
// rechtstreeks in `manage_assignments` terugstoppen.
import type { McpContext, McpToolDef, McpToolOk } from '../contracts';
import {
  guardNonTransactional,
  McpStepError,
  runMutateTool,
  toolError,
  type MutationOutcome,
} from './runtime';
// Alleen als TYPE (SYNC-2): wordt weggestreept bij compileren, dus géén runtime-import naar batchTool.
import type { BatchStepTool } from './batchTool';
import { enrichOk, okDirect, projectEndInfo } from './helpers';
import type { AppState } from '@/state/appStore';
import { syncProjectCalendar } from '@/state/syncProjectCalendar';
import { validate } from '@/state/mcpValidation';
import { resolveCalendarHolidays } from '../calendarGenerate';
import { ensureFreshSchedule } from '../staleGuard';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { computeMoveDelta } from '@/engine/moveProject';
import { diffDays } from '@/utils/dateUtils';
import { deriveHoursPerDay, workDaysFromBands } from '@/services/subdayIo';
import type { GeneratorCountry, HolidayGenParams } from '@/engine/calendar/generateCalendarHolidays';
import type { CalendarGeneration, Holiday, WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { ResourceCurve } from '@/types/resource';
import type { Project } from '@/types/project';
import type { LevelingOptions, LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { isSummaryTask } from '@/utils/taskHierarchy';

const STD_ANNOT = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

/**
 * Toegestane verdeelcurves + de bijbehorende typewachter — exact het `isSeqType`-patroon uit T19
 * (`taskTools.ts`). DIT IS EEN VEILIGHEIDSGUARD, GEEN COMFORT: de dispatcher valideert `inputSchema`
 * NIET, dus de tool-laag is de enige verdediging. Een onbekende curve (een LLM die `"bell"` i.p.v.
 * `"BELL"` schrijft) belandt anders ongefilterd in de store, waarna `ResourceLoad.CURVE_POINTS[curve]`
 * `undefined` oplevert en klapt in `recomputeResourceLoad()` — en dát draait in
 * `runInMcpTransaction` BUITEN de try/catch (stap 5), dus voorbij het rollback-pad: uncaught
 * TypeError, géén McpToolResult, corrupte waarde gecommit én een undo-stap erbij. Vandaar: filteren
 * vóór de mutatie, als ZACHTE per-item-weigering.
 */
const RESOURCE_CURVES: ResourceCurve[] = ['UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK'];
const isCurve = (v: unknown): v is ResourceCurve =>
  typeof v === 'string' && (RESOURCE_CURVES as string[]).includes(v);
/** Leesbare weigeringsreden die de geldige waarden noemt (de AI kan zich direct corrigeren). */
const curveReason = (v: unknown): string =>
  `onbekende curve '${String(v)}'; geldige waarden zijn ${RESOURCE_CURVES.join(', ')} (hoofdlettergevoelig)`;

type Rejection = { id: string; reason: string };
type StoreState = AppState;

/** Kalenderdagen tussen twee ISO-datums; 0 zodra één van beide ontbreekt (leeg projecteinde). */
function safeDiffDays(a: string, b: string): number {
  if (!a || !b) return 0;
  const d = diffDays(a, b);
  return Number.isFinite(d) ? d : 0;
}

// =================================================================================================
// planner_update_calendar (WP5)
//
// Dispatch per item (spec §WP5 regel 58):
//   - id staat in de bibliotheek                     ⇒ wijzigen (draft.updateCalendar);
//   - id is de PROJECTKALENDER maar staat er nog niet ⇒ eerst `ensureProjectCalendarInLibrary`
//     (WP5b-promotie: op een vers document leeft de projectkalender alleen als cache `s.calendar`),
//     dán wijzigen — de respons meldt `promoted: true`;
//   - onbekend id + `create: true`                    ⇒ aanmaken (draft.addCalendar);
//   - onbekend id zónder `create`                     ⇒ ZACHTE weigering.
// Holidays lopen altijd via `resolveCalendarHolidays` (meng-semantiek WP5d): generator-basis en/of
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
  'workTime', 'shift', 'generation', 'holidays', 'generate', 'rawHolidays',
];

/**
 * Elke sleutel die een kalender-item KENT (allowlist, patroon `PROJECT_KEYS`/K7). Een onbekende
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
 */
const CAL_READONLY_KEYS: string[] = ['isProjectDefault', 'usedByTasks', 'usedByResources'];

// ── Invoervalidatie (auditbevindingen K6 + H7) ───────────────────────────────────────────────────
//
// Waarom hier, en niet alleen in het JSON-schema: het schema is DOCUMENTATIE voor de AI, geen poort.
// Een foute waarde die er toch doorheen komt, moet een LEESBARE weigering geven — nooit een kale
// TypeError diep in de generator (die belandt binnen `runInMcpTransaction` en rolt de hele call
// terug met "Cannot read properties of undefined").

/** Het ECHTE domein van `generate.country` (holidays.ts + generateCalendarHolidays.ts). */
const GEN_COUNTRIES: GeneratorCountry[] = ['NL', 'DE', 'BE', 'FR', 'UK', 'AT', 'CH', 'none'];
const BOUWVAK_CHOICES = ['geen', 'noord', 'midden', 'zuid'];
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// ── H5 — DE KALENDER MOET ÉCHT OVERZETBAAR ZIJN ──────────────────────────────────────────────────
//
// `get_calendars` belooft "de VOLLEDIGE WorkCalendar-definitie … genoeg om een kalender in een ANDER
// document te herbouwen" en levert dat ook (spread van `...cal`). De schrijfkant kende drie van die
// velden niet: `workTime` (uurbanden), `shift` (ploeg) en `generation` — die laatste zelfs onder
// ANDERE sleutelnamen (`generate: {country, region, bouwvak}` tegenover de leesvorm
// `{ruleSetId, region, breakChoice, …}`). Een uurkalender bouwde in het doeldocument dus stil op als
// DAG-kalender, waardoor exacte urentaken niet planbaar zijn totdat er weer concrete banden bestaan.
// Hun gekozen eenheid en native hoeveelheid blijven daarbij altijd onaangeroerd. Sindsdien:
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
  return `${hh}:${mm}${wrapped ? ' (volgende dag)' : ''}`;
}

/** Vormvalidatie van een feestdagenlijst (gedeeld door `rawHolidays` en `holidays`). */
function holidayListReason(list: unknown, field: string): string | null {
  if (!Array.isArray(list)) return `\`${field}\` moet een array zijn`;
  for (const h of list as unknown[]) {
    if (!h || typeof h !== 'object' || Array.isArray(h)) return `elk item in \`${field}\` moet een object zijn`;
    const hh = h as Record<string, unknown>;
    if (typeof hh.name !== 'string' || hh.name === '') return `elke \`${field}\`-uitzondering vereist een niet-lege \`name\``;
    for (const k of ['startDate', 'endDate'] as const) {
      if (typeof hh[k] !== 'string' || !ISO_DATE_ONLY.test(hh[k] as string)) {
        return `\`${field}.${k}\` moet een ISO-datum zijn (JJJJ-MM-DD), kreeg '${String(hh[k])}'`;
      }
    }
    if ((hh.endDate as string) < (hh.startDate as string)) {
      return `\`${field}\`: endDate '${String(hh.endDate)}' ligt vóór startDate '${String(hh.startDate)}'`;
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
    return '`workTime` moet een object zijn met `byWeekday` (of `null` om terug te gaan naar een DAG-kalender)';
  }
  for (const k of Object.keys(wt)) {
    if (k !== 'byWeekday') return `onbekend veld \`workTime.${k}\`; \`workTime\` kent alleen \`byWeekday\``;
  }
  const bw = (wt as { byWeekday?: unknown }).byWeekday;
  if (!bw || typeof bw !== 'object' || Array.isArray(bw)) {
    return '`workTime.byWeekday` moet een object zijn met de weekdagsleutels "1" t/m "7" (1 = maandag … 7 = zondag)';
  }
  const rec = bw as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    if (!WEEKDAY_KEYS.includes(k)) {
      return `onbekende dagsleutel \`workTime.byWeekday.${k}\`; geldige sleutels zijn "1" t/m "7" (1 = maandag … 7 = zondag)`;
    }
  }
  const missing = WEEKDAY_KEYS.filter((k) => rec[k] === undefined);
  if (missing.length > 0) {
    return `\`workTime.byWeekday\` moet ALLE weekdagen "1" t/m "7" bevatten (ontbreekt: ${missing.join(', ')}); ` +
      'een dag met een lege lijst [] is niet-werkend. Een gedeeltelijke opgave zou de ontbrekende dagen ' +
      'STIL niet-werkend maken — geef de volledige week (bijv. een lezing van planner_get_calendars).';
  }
  const firstBandOf = (key: string): { start: number; end: number } | undefined => {
    const l = rec[key];
    return Array.isArray(l) && l.length > 0 ? (l[0] as { start: number; end: number }) : undefined;
  };
  for (const key of WEEKDAY_KEYS) {
    const list = rec[key];
    if (!Array.isArray(list)) return `\`workTime.byWeekday.${key}\` moet een array van banden zijn ([] = niet-werkende dag)`;
    let prevEnd = -1;
    for (const raw of list as unknown[]) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return `elke band in \`workTime.byWeekday.${key}\` moet een object {start, end} zijn (minuten vanaf middernacht)`;
      }
      const b = raw as Record<string, unknown>;
      for (const k of Object.keys(b)) {
        if (k !== 'start' && k !== 'end') return `onbekend veld \`workTime.byWeekday.${key}[].${k}\`; een band kent alleen \`start\` en \`end\``;
      }
      if (!isFiniteNumber(b.start) || !isFiniteNumber(b.end)) {
        return `\`workTime.byWeekday.${key}\`: \`start\` en \`end\` moeten getallen zijn in MINUTEN vanaf middernacht (07:00 = 420)`;
      }
      const start = b.start;
      const end = b.end;
      if (start < 0 || start >= MIN_PER_DAY) {
        return `\`workTime.byWeekday.${key}\`: \`start\` ${start} valt buiten de dag; geldig is 0 t/m 1439 minuten vanaf middernacht (0:00–23:59)`;
      }
      if (end <= start) {
        return `\`workTime.byWeekday.${key}\`: \`end\` ${end} (${clockLabel(end)}) ligt niet ná \`start\` ${start} (${clockLabel(start)}). ` +
          'Een dienst over middernacht telt DOOR in minuten: 22:00→06:00 is start 1320, end 1800 — niet 1320→360.';
      }
      if (end > 2 * MIN_PER_DAY) {
        return `\`workTime.byWeekday.${key}\`: \`end\` ${end} overschrijdt 2880 (een band mag hoogstens 24 uur na middernacht van de startdag eindigen)`;
      }
      if (start < prevEnd) {
        return `\`workTime.byWeekday.${key}\`: de banden overlappen of staan niet op volgorde (band vanaf ${clockLabel(start)} begint vóór het einde ${clockLabel(prevEnd)} van de vorige); geef ze oplopend en niet-overlappend`;
      }
      prevEnd = end;
    }
    // Wrap-staart mag niet over de eerste band van de VOLGENDE dag heen lopen (7 wrapt naar 1).
    if (prevEnd > MIN_PER_DAY) {
      const nextKey = key === '7' ? '1' : String(Number(key) + 1);
      const next = firstBandOf(nextKey);
      if (next && isFiniteNumber(next.start) && next.start < prevEnd - MIN_PER_DAY) {
        return `\`workTime.byWeekday.${key}\`: de band loopt door tot ${clockLabel(prevEnd)} en overlapt de eerste band van dag ${nextKey} (${clockLabel(next.start)})`;
      }
    }
  }
  return null;
}

/** Vormvalidatie van `generation` (de LEESVORM van de herkomst-metadata). */
function generationReason(gen: unknown): string | null {
  if (!gen || typeof gen !== 'object' || Array.isArray(gen)) {
    return '`generation` moet een object zijn zoals get_calendars het teruggeeft ' +
      '(`ruleSetId`, optioneel `region`/`breakChoice`, `generatedFromYear`, `generatedToYear`), of `null` om de herkomst te wissen';
  }
  const g = gen as Record<string, unknown>;
  const allowed = ['ruleSetId', 'region', 'breakChoice', 'generatedFromYear', 'generatedToYear'];
  for (const k of Object.keys(g)) {
    if (!allowed.includes(k)) {
      if (k === 'country' || k === 'bouwvak') {
        return `\`generation.${k}\` bestaat niet; dat zijn de sleutels van \`generate\` (de GENERATOR). ` +
          'In `generation` (de leesvorm) heten ze `ruleSetId` en `breakChoice`.';
      }
      return `onbekend veld \`generation.${k}\`; toegestaan: ${allowed.join(', ')}`;
    }
  }
  if (!(GEN_RULESETS as string[]).includes(g.ruleSetId as string)) {
    return `onbekende \`generation.ruleSetId\` '${String(g.ruleSetId)}'; geldige waarden zijn ${GEN_RULESETS.join(', ')} ` +
      "(hoofdlettergevoelig; 'none' bestaat hier niet — laat `generation` weg of geef `null` voor een letterlijke kalender)";
  }
  if (g.region !== undefined && typeof g.region !== 'string') return '`generation.region` moet een string zijn';
  if (g.breakChoice !== undefined && !BREAK_CHOICES.includes(g.breakChoice as string)) {
    return `onbekende \`generation.breakChoice\` '${String(g.breakChoice)}'; geldige waarden zijn ${BREAK_CHOICES.join(', ')} ` +
      '(géén bouwvak = het veld weglaten)';
  }
  for (const k of ['generatedFromYear', 'generatedToYear'] as const) {
    if (!Number.isInteger(g[k]) || (g[k] as number) < 1000 || (g[k] as number) > 9999) {
      return `\`generation.${k}\` moet een jaartal zijn (geheel getal, 1000–9999), kreeg '${String(g[k])}'`;
    }
  }
  if ((g.generatedToYear as number) < (g.generatedFromYear as number)) {
    return `\`generation.generatedToYear\` (${String(g.generatedToYear)}) ligt vóór \`generatedFromYear\` (${String(g.generatedFromYear)})`;
  }
  return null;
}

/**
 * Vormvalidatie van één kalender-item. Retourneert een leesbare weigeringsreden of `null`.
 * Elke weigering NOEMT de geldige verzameling, zodat de AI zich in één ronde kan corrigeren.
 */
function calendarItemReason(item: CalendarItem): string | null {
  // K7-patroon: onbekende sleutels ketsen af MÉT de toegestane lijst; de afgeleide leesvelden van
  // get_calendars worden geaccepteerd (en verderop als `ignoredFields` gemeld).
  for (const key of Object.keys(item)) {
    if (CAL_ITEM_KEYS.includes(key) || CAL_READONLY_KEYS.includes(key)) continue;
    return `onbekend veld \`${key}\`; een kalender-item kent alleen: ${CAL_ITEM_KEYS.join(', ')} ` +
      `(de afgeleide leesvelden ${CAL_READONLY_KEYS.join(', ')} mogen mee maar worden genegeerd)`;
  }
  if (item.name !== undefined && typeof item.name !== 'string') return '`name` moet een string zijn';
  if (item.description !== undefined && typeof item.description !== 'string') return '`description` moet een string zijn';
  if (item.workDays !== undefined) {
    if (!Array.isArray(item.workDays) || item.workDays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
      return '`workDays` moet een array van ISO-weekdagnummers zijn (1 = maandag … 7 = zondag)';
    }
  }
  for (const k of ['workStartHour', 'workEndHour', 'hoursPerDay'] as const) {
    if (item[k] !== undefined && !isFiniteNumber(item[k])) return `\`${k}\` moet een getal in UREN zijn`;
  }

  // ── Uur-kalender: banden + ploeg ──────────────────────────────────────────────────────────────
  if (item.workTime !== undefined && item.workTime !== null) {
    const bad = workTimeReason(item.workTime);
    if (bad) return bad;
  }
  if (item.shift !== undefined && item.shift !== null && !SHIFT_VALUES.includes(item.shift)) {
    return `onbekende \`shift\` '${String(item.shift)}'; geldige waarden zijn ${SHIFT_VALUES.join(', ')} ` +
      '(hoofdlettergevoelig; `null` wist de ploeg-classificatie)';
  }

  // ── Herkomst + feestdagen: één bron tegelijk ──────────────────────────────────────────────────
  if (item.generation !== undefined && item.generation !== null) {
    const bad = generationReason(item.generation);
    if (bad) return bad;
  }
  if (item.generation !== undefined && item.generate !== undefined) {
    return 'geef `generate` OF `generation`, niet allebei: `generate` DRAAIT de generator over de ' +
      'projectspanne van dit document (en zet de herkomst zelf), terwijl `generation` alleen de ' +
      'herkomst-metadata schrijft bij feestdagen die je meestuurt';
  }
  if (item.holidays !== undefined) {
    const bad = holidayListReason(item.holidays, 'holidays');
    if (bad) return bad;
    if (item.rawHolidays !== undefined) {
      return 'geef `holidays` OF `rawHolidays`, niet allebei: `holidays` zet de VOLLEDIGE lijst exact ' +
        '(de leesvorm van get_calendars), `rawHolidays` voegt losse uitzonderingen toe';
    }
    if (item.holidaysMode !== undefined) {
      return '`holidaysMode` hoort bij `rawHolidays`; `holidays` vervangt de lijst per definitie exact';
    }
    if (item.generate !== undefined) {
      return 'geef `holidays` OF `generate`, niet allebei: de generator zou de meegestuurde lijst ' +
        'meteen overschrijven met dagen over de projectspanne van DIT document';
    }
  }

  if (item.generate !== undefined) {
    const g = item.generate as unknown;
    if (!g || typeof g !== 'object' || Array.isArray(g)) return '`generate` moet een object zijn met minstens `country`';
    const gen = g as Record<string, unknown>;
    if (!(GEN_COUNTRIES as string[]).includes(gen.country as string)) {
      return `onbekend \`generate.country\` '${String(gen.country)}'; geldige waarden zijn ${GEN_COUNTRIES.join(', ')} ` +
        "(hoofdlettergevoelig; 'none' = geen feestdagenset, wist de gegenereerde dagen)";
    }
    if (gen.region !== undefined && typeof gen.region !== 'string') return '`generate.region` moet een string zijn';
    if (gen.bouwvak !== undefined && !BOUWVAK_CHOICES.includes(gen.bouwvak as string)) {
      return `onbekende \`generate.bouwvak\` '${String(gen.bouwvak)}'; geldige waarden zijn ${BOUWVAK_CHOICES.join(', ')}`;
    }
  }

  if (item.holidaysMode !== undefined) {
    if (item.holidaysMode !== 'merge' && item.holidaysMode !== 'replace') {
      return `onbekende \`holidaysMode\` '${String(item.holidaysMode)}'; geldige waarden zijn merge, replace`;
    }
    if (item.rawHolidays === undefined) {
      return '`holidaysMode` heeft alleen betekenis samen met `rawHolidays`';
    }
  }

  if (item.rawHolidays !== undefined) {
    if (!Array.isArray(item.rawHolidays)) return '`rawHolidays` moet een array zijn';
    // K6 — DE stille no-op: een lege lijst in de (default) TOEVOEG-modus verandert per definitie
    // niets, maar kwam terug als een geslaagde wijziging. Een agent die een feestdag wilde
    // VERWIJDEREN stuurde precies dit (de overblijvende dagen ⇒ vaak leeg) en kreeg `ok`.
    if (item.rawHolidays.length === 0 && (item.holidaysMode ?? 'merge') === 'merge') {
      return 'een lege `rawHolidays` verandert niets in de standaard TOEVOEG-modus; gebruik ' +
        '`holidaysMode: "replace"` om de feestdagenlijst te vervangen of te wissen';
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
      return `\`workDays\` (${given || 'leeg'}) spreekt \`workTime\` tegen: de banden leveren werkdagen ${derived || 'leeg'}. ` +
        'Laat `workDays` weg (hij wordt uit de banden afgeleid) of maak beide gelijk.';
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
      rejections.push({ id: label, reason: 'elk kalender-item vereist een niet-lege string-`id`' });
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
          reason: `geen wijzigingen opgegeven; een item moet minstens één van deze velden dragen: ${CAL_FIELD_KEYS.join(', ')}`,
        });
        continue;
      }
      plans.push({ mode: 'update', item, targetId: item.id, needsPromotion: !inLibrary });
      continue;
    }
    if (item.create === true) {
      plans.push({ mode: 'create', item });
      continue;
    }
    rejections.push({
      id: item.id,
      reason: `kalender '${item.id}' bestaat niet in dit document; geef \`create: true\` mee om hem aan te maken (kalender-id's zijn per document)`,
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

/** De scalaire (niet-holiday) velden van een item als `Partial<WorkCalendar>`. `existing` levert de
 *  fallback voor de afgeleide `hoursPerDay` (bij `create` de app-default-basis). */
function calendarFieldPatch(item: CalendarItem, existing: Pick<WorkCalendar, 'hoursPerDay'>): Partial<WorkCalendar> {
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
  return patch;
}

// ── Dag↔uur-kalenderomschakeling ────────────────────────────────────────────────────────────────
// Een kalender bepaalt alleen de plaatsing. Een moduswissel mag dus uitsluitend als planningseffect
// worden gemeld; `durationUnit`, `scheduleDuration` en `durationMinutes` blijven onaangeroerd.

function calendarMode(cal: Pick<WorkCalendar, 'workTime'>): 'hour' | 'day' {
  return cal.workTime ? 'hour' : 'day';
}

/**
 * Los de definitieve feestdagenlijst op voor één item, inclusief de VERVANG-modus (K6).
 *
 * ONTWERPKEUZE. `resolveCalendarHolidays` (calendarGenerate.ts) is bewust alleen-toevoegend: het
 * MERGET rauwe uitzonderingen in de bestaande lijst. Daardoor bestond er geen enkele manier om via
 * de bridge een feestdag te VERWIJDEREN — een agent die gevraagd werd een vorstverletdag terug te
 * draaien stuurde de overblijvende dagen, kreeg `ok`, en veranderde niets. `holidaysMode: 'replace'`
 * dicht dat gat zónder de bestaande semantiek te breken:
 *   - default (`merge`)  ⇒ exact het oude gedrag (dedup-merge met wat er stond);
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
  // (H5) LETTERLIJKE OVERDRACHT — `holidays` is de leesvorm van get_calendars en betekent "zet de
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
    return 'update_calendar vereist een niet-lege `calendars`-array';
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
        // Basis = de app-default (ma-vr 07-16); de opgegeven velden overschrijven hem. Het id van
        // de default wordt weggegooid: draft.addCalendar genereert een vers, document-lokaal id.
        const { id: _ignored, ...base } = createDefaultCalendar();
        const cal: Omit<WorkCalendar, 'id'> = {
          ...base,
          name: item.name ?? 'Nieuwe kalender',
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
        // M7 — MAAK DE GEËRFDE FEESTDAGEN ZICHTBAAR. De basis is `createDefaultCalendar()`, en die
        // levert in bouwmodus (de default) een VOLLEDIGE NL-feestdagenset mét `generation`. Een
        // agent die "een lege kalender" aanmaakt kreeg dus stilzwijgend ~30 NL-feestdagen mee,
        // zonder dat één respons of beschrijving dat noemde. De herkomst staat nu per rij; de
        // handler zet er bovendien een waarschuwing bij.
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
          hoursPerDayEffective: created.workTime
            ? deriveHoursPerDay(created.workTime, created.hoursPerDay)
            : created.hoursPerDay,
          ...(created.shift ? { shift: created.shift } : {}),
          ...(ignoredFields.length > 0 ? { ignoredFields } : {}),
        });
        continue;
      }

      // WP5b: doel is de projectkalender die nog niet in de bibliotheek staat ⇒ eerst promoveren.
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
        throw new McpStepError('NOT_FOUND', `kalender '${plan.targetId}' bestaat niet (na promotie)`);
      }
      // Modus-ijkpunt vóór de mutatie; native taakduren worden nooit geconverteerd.
      const beforeMode = calendarMode(existing);
      const updates = calendarFieldPatch(item, existing) as Partial<WorkCalendar>;
      let becameLiteral = false;
      // `draft.updateCalendar` doet een Object.assign en kan dus geen sleutel VERWIJDEREN; alles wat
      // weg moet (herkomst, banden, ploeg) verzamelen we hier en wissen we in één gerichte producer.
      const dropKeys: ('generation' | 'workTime' | 'shift')[] = [];
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
            `kan concrete werkblokken niet verwijderen: kalender '${plan.targetId}' wordt gebruikt door een urentaak`,
          );
        }
      }

      ctx.transactions.draft.updateCalendar(plan.targetId, updates);
      if (dropKeys.length > 0) {
        ctx.app.store.setState((s) => {
          const idx = s.calendars.findIndex((c) => c.id === plan.targetId);
          if (idx >= 0) for (const k of dropKeys) delete s.calendars[idx][k];
          // De gedenormaliseerde projectkalender-cache moet de entry blijven volgen (§9.1);
          // `draft.updateCalendar` synct zelf, maar deze extra producer maakt een nieuw
          // entry-object en zou de cache anders op het oude object laten wijzen.
          syncProjectCalendar(s);
          s.isDirty = true;
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
        hoursPerDayEffective: updated.workTime
          ? deriveHoursPerDay(updated.workTime, updated.hoursPerDay)
          : updated.hoursPerDay,
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
    'Werktijdbanden van deze weekdag, oplopend en niet-overlappend. Lege lijst = niet-werkende dag.',
  items: {
    type: 'object',
    required: ['start', 'end'],
    properties: {
      start: { type: 'number', minimum: 0, maximum: 1439, description: 'Begin in MINUTEN vanaf middernacht (07:00 = 420).' },
      end: { type: 'number', minimum: 1, maximum: 2880, description: 'Einde in MINUTEN vanaf middernacht van de STARTdag; over middernacht telt door (22:00→06:00 = 1800). Moet groter zijn dan `start`.' },
    },
  },
} as const;

const WORKTIME_SCHEMA = {
  type: ['object', 'null'],
  description:
    'UUR-kalender: werktijdbanden per ISO-weekdag in minuten vanaf middernacht. `null` = terug naar een ' +
    'DAG-kalender. LET OP: dit herdefinieert de duur van elke taak op deze kalender (zie de beschrijving).',
  properties: {
    byWeekday: {
      type: 'object',
      description: 'Alle zeven weekdagen ("1" = maandag … "7" = zondag) — een gedeeltelijke opgave wordt geweigerd.',
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
    startDate: { type: 'string', description: 'ISO-datum (JJJJ-MM-DD), inclusief.' },
    endDate: { type: 'string', description: 'ISO-datum (JJJJ-MM-DD), inclusief.' },
  },
} as const;

const updateCalendar: BatchStepTool = {
  name: 'planner_update_calendar',
  description:
    'Wijzig of maak werkkalenders (bulk — één call = één ongedaan-maak-stap). Per item: een BESTAAND ' +
    'kalender-id wijzigen, of een onbekend id met `create: true` aanmaken (onbekend id zónder `create` ' +
    'wordt zacht geweigerd). LET OP: kalender-id\'s zijn PER DOCUMENT — een geïmporteerd of ander ' +
    'document herbouwt kalenders via `create`, het hergebruikt nooit een id uit een ander document. ' +
    'Feestdagen kunnen op twee manieren: `generate` (land/regio/bouwvak — de generator materialiseert ' +
    'de dagen over de projectspanne en VERVANGT de bestaande lijst) en/of `rawHolidays` (letterlijke ' +
    'uitzonderingen, bijv. vorstverlet). LET OP — `rawHolidays` is standaard TOEVOEGEN: de opgegeven ' +
    'dagen worden bij de bestaande gemergd (dedup op datumbereik), er verdwijnt niets. Wil je een ' +
    'feestdag VERWIJDEREN of de lijst exact zetten, geef dan `holidaysMode: "replace"` mee — dan wordt ' +
    'de lijst precies `rawHolidays` (een LEGE array wist alle feestdagen). Een lege `rawHolidays` in de ' +
    'toevoeg-modus wordt zacht geweigerd, want die zou niets doen. Worden er rauwe dagen gezet, dan ' +
    'wordt de generator-herkomst gewist en is de kalender voortaan LETTERLIJK (`becameLiteral: true` ' +
    'per item) — hergenereren kan dan niet meer. ' +
    'Bij `create: true` ZONDER `generate`/`rawHolidays`/`holidays` erft de nieuwe kalender de feestdagen ' +
    'van de app-standaardkalender (in bouwmodus: de NL-set); de respons meldt dat per rij als ' +
    '`holidaysFrom: "app-default"` met `holidayCount`. Wil je gegarandeerd géén feestdagen, geef dan ' +
    '`generate: { country: "none" }` of `holidays: []` mee. ' +
    'KALENDER OVERZETTEN NAAR EEN ANDER DOCUMENT: geef een kalenderobject uit `planner_get_calendars` ' +
    'LETTERLIJK terug (met `create: true`). Alle leesvelden worden geaccepteerd — `workTime` (uurbanden), ' +
    '`shift`, `generation` (herkomst in de LEESVORM: `ruleSetId`/`breakChoice`/jaren) en `holidays` (de ' +
    'volledige lijst, die de bestaande lijst exact VERVANGT). De afgeleide leesvelden ' +
    '`isProjectDefault`/`usedByTasks`/`usedByResources` mogen mee maar doen niets; de respons meldt ze als ' +
    '`ignoredFields`. Gebruik `generate` (land/regio/bouwvak) óf `generation` (herkomst van meegestuurde ' +
    'dagen), nooit allebei — `generate` DRAAIT de generator over de projectspanne van DIT document, ' +
    '`generation` schrijft alleen de herkomst. ' +
    'UUR- VS DAG-KALENDER: `workTime` maakt er een UUR-kalender van (`null` zet hem terug op DAG). ' +
    'Een kalenderwijziging verandert NOOIT de gekozen eenheid of native hoeveelheid van een taak. ' +
    'Wel kunnen begin/eindverdeling en projecteinde veranderen; een urentaak is zonder concrete ' +
    'werkblokken niet doorrekenbaar. De respons meldt een moduswissel als `modeChangedFrom` en bevestigt ' +
    'met `taskDurationsPreserved: true` dat de taakduren niet zijn geconverteerd. ' +
    '`workDays` en `hoursPerDay` worden uit de banden AFGELEID zodra je `workTime` meegeeft (zoals de ' +
    'kalenderdialoog doet); geef je ze toch mee, dan mag `workDays` de banden niet tegenspreken. ' +
    'BEWAREN IN HET BESTAND (IFC): een nieuw aangemaakte kalender waaraan GEEN taak en geen resource ' +
    'hangt, overleeft opslaan+herladen NIET — hang er dus meteen taken aan met `update_tasks.calendarId`. ' +
    'Uurbanden overleven IFC wél, maar per WEEKDAG VERSCHILLENDE banden niet: het formaat draagt één ' +
    'werkweek-patroon, dus bij herladen krijgen alle werkdagen de banden van de eerste werkdag. ' +
    'Een kalender waarin taken niet meer passen (bijv. een lang feestdagblok) levert géén fout maar een ' +
    'prominente waarschuwing met `cappedTaskIds`. Blijft er daarentegen HELEMAAL geen werktijd over ' +
    '(lege `workDays`, of `workTime`-banden op geen enkele dag), dan faalt de herberekening en wordt de ' +
    'hele call teruggerold — er komt nooit een halve kalender in het document.',
  kind: 'mutate',
  batchable: true,
  // Een kalenderwijziging kan bestaande feestdagen/werkdagen (en daarmee de planning) overschrijven.
  annotations: { ...STD_ANNOT, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      calendars: {
        type: 'array',
        minItems: 1,
        description: 'De te wijzigen/aan te maken kalenders; alles in één transactie.',
        items: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Bestaand kalender-id; bij `create: true` een vrij te kiezen aanduiding (het echte id komt terug als `id`, jouw waarde als `requestedId`).' },
            create: { type: 'boolean', description: 'Maak de kalender aan als het id niet bestaat.' },
            name: { type: 'string' },
            description: { type: 'string' },
            workDays: {
              type: 'array',
              items: { type: 'integer', minimum: 1, maximum: 7 },
              description: 'Werkdagen als ISO-weekdagnummers (1 = maandag … 7 = zondag).',
            },
            workStartHour: { type: 'number', description: 'Begin werkdag in UREN (0–24), bijv. 7.' },
            workEndHour: { type: 'number', description: 'Einde werkdag in UREN (0–24), bijv. 16.' },
            hoursPerDay: { type: 'number', description: 'Netto werkuren per werkdag (UREN), bijv. 8.' },
            generate: {
              type: 'object',
              description: 'Generator-basis voor feestdagen; de jaarspanne wordt uit het project afgeleid.',
              required: ['country'],
              properties: {
                country: {
                  type: 'string',
                  enum: ['NL', 'DE', 'BE', 'FR', 'UK', 'AT', 'CH', 'none'],
                  description:
                    'Landcode van de feestdagenset — HOOFDLETTERS, exact één van de opgesomde waarden. ' +
                    "`none` = geen feestdagenset: dat WIST de gegenereerde dagen (en de herkomst).",
                },
                region: { type: 'string', description: 'Bundesland/landsdeel/kanton; weglaten = landelijk.' },
                bouwvak: { type: 'string', enum: ['geen', 'noord', 'midden', 'zuid'], description: 'Alleen NL; default `geen`.' },
              },
            },
            holidaysMode: {
              type: 'string',
              enum: ['merge', 'replace'],
              description:
                '`merge` (default) = `rawHolidays` TOEVOEGEN aan de bestaande feestdagen. `replace` = de ' +
                'feestdagenlijst exact gelijkstellen aan `rawHolidays` — dit is de ENIGE manier om een ' +
                'feestdag te verwijderen; een lege `rawHolidays` wist ze dan allemaal.',
            },
            rawHolidays: {
              type: 'array',
              description:
                'Letterlijke uitzonderingen (vorstverlet, bedrijfssluiting). Standaard TOEVOEGEN (niets ' +
                'verdwijnt); met `holidaysMode: "replace"` vervangt deze lijst de bestaande volledig. ' +
                'Rauwe dagen wissen de generator-herkomst.',
              items: HOLIDAY_ITEM_SCHEMA,
            },
            holidays: {
              type: 'array',
              description:
                'De VOLLEDIGE feestdagenlijst — exact het leesveld van planner_get_calendars. Vervangt de ' +
                'bestaande lijst precies (lege lijst = geen feestdagen). Voor het overzetten van een kalender ' +
                'tussen documenten; combineer met `generation` om ook de herkomst mee te nemen. Niet samen met ' +
                '`rawHolidays`/`holidaysMode`/`generate`.',
              items: HOLIDAY_ITEM_SCHEMA,
            },
            workTime: WORKTIME_SCHEMA,
            shift: {
              type: ['string', 'null'],
              enum: ['FIRST', 'SECOND', 'THIRD', 'USERDEFINED', null],
              description: 'Ploeg-classificatie (IFC `PredefinedType`); `null` wist hem. Leesveld van get_calendars.',
            },
            generation: {
              type: ['object', 'null'],
              description:
                'Herkomst-metadata in de LEESVORM van get_calendars — schrijft alleen vast WAAR de ' +
                'meegestuurde feestdagen vandaan komen, en draait de generator NIET. `null` wist de herkomst ' +
                '(de kalender wordt letterlijk). Niet samen met `generate`.',
              required: ['ruleSetId', 'generatedFromYear', 'generatedToYear'],
              properties: {
                ruleSetId: { type: 'string', enum: ['NL', 'DE', 'BE', 'FR', 'UK', 'AT', 'CH'], description: 'Landenset die de datums voortbracht.' },
                region: { type: 'string', description: 'Bundesland/landsdeel/kanton; weglaten = landelijk.' },
                breakChoice: { type: 'string', enum: ['noord', 'midden', 'zuid'], description: 'NL-bouwvak; weglaten = geen.' },
                generatedFromYear: { type: 'integer', description: 'Eerste gematerialiseerde jaar (incl.).' },
                generatedToYear: { type: 'integer', description: 'Laatste gematerialiseerde jaar (incl.).' },
              },
            },
            isProjectDefault: { type: 'boolean', description: 'AFGELEID leesveld van get_calendars — mag mee, wordt genegeerd (komt terug als `ignoredFields`).' },
            usedByTasks: { type: 'integer', description: 'AFGELEID leesveld van get_calendars — mag mee, wordt genegeerd.' },
            usedByResources: { type: 'integer', description: 'AFGELEID leesveld van get_calendars — mag mee, wordt genegeerd.' },
          },
        },
      },
    },
    required: ['calendars'],
  },
  batchStep(args, ctx) {
    const parsed = parseUpdateCalendar(args);
    if (typeof parsed === 'string') throw new McpStepError('VALIDATION', parsed);
    return updateCalendarCore(ctx, parsed);
  },
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
        const g = guardNonTransactional(ctx);
        if (g) return g;
        return okDirect(ctx, { calendars: [], warnings: [], projectEnd: projectEndInfo(state).projectEnd }, pre.rejections);
      }
    }

    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => updateCalendarCore(ctx, items));

    return enrichOk(res, () => {
      const rows = ((res as McpToolOk).data as { calendars: Record<string, unknown>[] }).calendars;
      const { projectEnd, cappedTaskIds } = projectEndInfo(ctx.app.store.getState());
      // WP7-beleid: een onwerkbaar venster is een WAARSCHUWING, geen fout — de kalenderwijziging
      // blijft gecommit; de AI hoort dit prominent aan de user te melden.
      const warnings: string[] = [];
      if (cappedTaskIds) {
        warnings.push(
          `Onwerkbaar venster: ${cappedTaskIds.length} taak/taken konden niet binnen deze kalender worden ingepland ` +
          `(zie cappedTaskIds). De kalenderwijziging IS toegepast — controleer werkdagen en feestdagen.`,
        );
      }
      // M7: een "leeg" aangemaakte kalender erft de feestdagen van de app-standaardkalender. Dat is
      // een bewuste app-default, maar het mag niet STIL gebeuren — zeg het hardop.
      const inherited = rows.filter((r) => r.created === true && r.holidaysFrom === 'app-default' && (r.holidayCount as number) > 0);
      if (inherited.length > 0) {
        warnings.push(
          `${inherited.length} nieuw aangemaakte kalender(s) hebben de feestdagen van de app-standaardkalender ` +
          `OVERGENOMEN (${inherited.map((r) => `${r.id}: ${r.holidayCount}`).join(', ')}) omdat er geen \`generate\` of ` +
          '`rawHolidays` was opgegeven. Wil je een kalender zonder feestdagen, geef dan `generate: { country: "none" }`.',
        );
      }
      // Een moduswissel kan de planning verschuiven, maar nooit een taakeenheid/hoeveelheid wijzigen.
      const switched = rows.filter((r) => r.modeChangedFrom !== undefined);
      if (switched.length > 0) {
        warnings.push(
          `${switched.length} kalender(s) wisselden van modus: ` +
          `${switched.map((r) => `${r.id}: ${r.modeChangedFrom} → ${r.mode}`).join(', ')}. ` +
          'De gekozen eenheid en native hoeveelheid van elke taak blijven behouden. Alleen de ' +
          'planning kan verschuiven; urentaken vereisen concrete werkblokken om door te rekenen.',
        );
      }
      // De schakelaar Urenplanning is puur UI (de solver rekent sowieso uur-native): meld het, want
      // de gebruiker ziet zijn uurkalender anders nergens terug in de app.
      if (rows.some((r) => r.mode === 'hour') && !ctx.app.store.getState().ui.enableHourPlanning) {
        warnings.push(
          'Er staat nu een UUR-kalender in dit document terwijl de app-instelling "Urenplanning" UIT staat. ' +
          'De planning wordt wél uur-native gerekend, maar de app toont geen uur-invoer/-weergave totdat de ' +
          'gebruiker die instelling aanzet (Instellingen → Urenplanning).',
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
  | { action: 'add'; taskId: string; resourceId: string; unitsPerDay: number; curve?: ResourceCurve }
  | { action: 'update'; assignmentId: string; unitsPerDay?: number; curve?: ResourceCurve }
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
      rejections.push({ id: `#${index}`, reason: 'elk item vereist een `action` (add | update | move | remove)' });
      return;
    }
    switch (act.action) {
      case 'add': {
        const label = `${act.taskId}->${act.resourceId}`;
        if (typeof act.taskId !== 'string' || typeof act.resourceId !== 'string') {
          rejections.push({ id: label, reason: '`add` vereist string-`taskId` en -`resourceId`' });
          return;
        }
        if (!s.resources.some((r) => r.id === act.resourceId)) {
          rejections.push({ id: label, reason: `resource '${act.resourceId}' bestaat niet` });
          return;
        }
        if (act.curve !== undefined && !isCurve(act.curve)) {
          rejections.push({ id: label, reason: curveReason(act.curve) });
          return;
        }
        const guard = validate.assignmentAllowed(simState(), act.taskId, act.resourceId, act.unitsPerDay);
        if (!guard.ok) {
          rejections.push({ id: label, reason: guard.reason });
          return;
        }
        // Simulatie bijwerken: een volgende identieke `add` botst nu op de dubbeltelling-guard.
        sim = [...sim, { id: `sim-${index}`, taskId: act.taskId, resourceId: act.resourceId, unitsPerDay: act.unitsPerDay }];
        plans.push({ index, action: act });
        return;
      }
      case 'update': {
        const cur = sim.find((x) => x.id === act.assignmentId);
        if (!cur) {
          rejections.push({ id: String(act.assignmentId), reason: `toewijzing '${act.assignmentId}' bestaat niet` });
          return;
        }
        const hasUnits = act.unitsPerDay !== undefined;
        const hasCurve = act.curve !== undefined;
        if (!hasUnits && !hasCurve) {
          rejections.push({ id: act.assignmentId, reason: 'geen `unitsPerDay` of `curve` opgegeven' });
          return;
        }
        if (hasUnits && !(typeof act.unitsPerDay === 'number' && Number.isFinite(act.unitsPerDay) && act.unitsPerDay > 0)) {
          rejections.push({ id: act.assignmentId, reason: `ongeldige unitsPerDay ${String(act.unitsPerDay)} (eenheden/dag, strikt positief vereist)` });
          return;
        }
        if (hasCurve && !isCurve(act.curve)) {
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
          rejections.push({ id: String(act.assignmentId), reason: `toewijzing '${act.assignmentId}' bestaat niet` });
          return;
        }
        const target = s.tasks.find((t) => t.id === act.taskId);
        if (!target) {
          rejections.push({ id: act.assignmentId, reason: `doeltaak '${act.taskId}' bestaat niet` });
          return;
        }
        if (target.isMilestone || isSummaryTask(target)) {
          rejections.push({ id: act.assignmentId, reason: `doeltaak '${act.taskId}' is een mijlpaal/verzameltaak; die dragen geen resources` });
          return;
        }
        if (sim.some((x) => x.id !== cur.id && x.taskId === act.taskId && x.resourceId === cur.resourceId)) {
          rejections.push({ id: act.assignmentId, reason: `resource '${cur.resourceId}' is al toegewezen aan taak '${act.taskId}' (verplaatsen zou de last dubbel tellen)` });
          return;
        }
        cur.taskId = act.taskId;
        plans.push({ index, action: act });
        return;
      }
      case 'remove': {
        if (!sim.some((x) => x.id === act.assignmentId)) {
          rejections.push({ id: String(act.assignmentId), reason: `toewijzing '${act.assignmentId}' bestaat niet` });
          return;
        }
        sim = sim.filter((x) => x.id !== act.assignmentId);
        plans.push({ index, action: act });
        return;
      }
      default:
        rejections.push({ id: `#${index}`, reason: `onbekende actie '${(act as { action: string }).action}' (add | update | move | remove)` });
    }
  });
  return { plans, rejections };
}

/** Vormvalidatie van `manage_assignments`; string = foutboodschap. */
function parseAssignments(args: unknown): AssignmentAction[] | string {
  const a = (args ?? {}) as { actions?: unknown };
  if (!Array.isArray(a.actions) || a.actions.length === 0) {
    return 'manage_assignments vereist een niet-lege `actions`-array';
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
          ctx.transactions.draft.updateAssignment(action.assignmentId, patch);
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
    'Beheer resource-toewijzingen in bulk (één call = één ongedaan-maak-stap). Per item één `action`: ' +
    '`add` (`taskId`, `resourceId`, `unitsPerDay` = eenheden per WERKDAG waarbij 1 = 100% / één ' +
    'persoon, optioneel `curve`), `update` (`assignmentId` + `unitsPerDay` en/of `curve`), `move` ' +
    '(`assignmentId` naar een andere `taskId`) of `remove` (`assignmentId`). De id\'s en veldnamen zijn ' +
    'exact die van de leestools (get_task/list_resources), dus je kunt ze rechtstreeks terugstoppen. ' +
    'Toewijzen kan alleen op een BLADTAAK (geen mijlpaal, geen verzameltaak) en dezelfde resource mag ' +
    'maar één keer op dezelfde taak staan — een tweede toewijzing zou de last dubbel tellen en wordt ' +
    'zacht geweigerd, óók als het duplicaat binnen deze ene call zit. Geweigerde items komen terug in ' +
    '`itemRejections`; de geldige items blijven gewoon staan.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT },
  inputSchema: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        minItems: 1,
        description: 'De uit te voeren toewijzings-acties, in volgorde.',
        items: {
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['add', 'update', 'move', 'remove'] },
            taskId: { type: 'string', description: 'Bij `add`: de bladtaak. Bij `move`: de NIEUWE bladtaak.' },
            resourceId: { type: 'string', description: 'Alleen bij `add`.' },
            assignmentId: { type: 'string', description: 'Bij `update`/`move`/`remove`; exact het id uit de leestools.' },
            unitsPerDay: { type: 'number', exclusiveMinimum: 0, description: 'Eenheden per WERKDAG (1 = 100% = één persoon/stuk; 0,5 = halve dag).' },
            curve: {
              type: 'string',
              enum: ['UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK'],
              description: 'Verdeelcurve over de duur; weglaten = UNIFORM.',
            },
          },
        },
      },
    },
    required: ['actions'],
  },
  // Zie de batchStep-noot in taskTools.ts: het lege-batch-snelpad is puur transactie-vermijding en
  // dus overbodig binnen een batch (die bezit de transactie al).
  batchStep(args, ctx) {
    const parsed = parseAssignments(args);
    if (typeof parsed === 'string') throw new McpStepError('VALIDATION', parsed);
    return manageAssignmentsCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsedActions = parseAssignments(args);
    if (typeof parsedActions === 'string') return toolError(ctx, 'VALIDATION', parsedActions);
    const actions = parsedActions;

    // Lege-batch-snelpad (zie T19-reviewfix Issue 2).
    {
      const state = ctx.app.store.getState();
      const pre = classifyAssignments(state, actions);
      if (pre.plans.length === 0) {
        const g = guardNonTransactional(ctx);
        if (g) return g;
        return okDirect(
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
// planner_level_resources (spec §level_resources-contract)
//
// Volgorde: guards → `ensureFreshSchedule` (WP8-patroon: een stale planning maakt de before/after-
// delta's onzin). Dat kost geen undo-stap, en de reden is NIET "we zitten in een transactie" — deze
// `ensureFreshSchedule` draait juist BUITEN elke transactie, vóór `runMutateTool`. De reden is die
// van `save_baseline` hieronder: `runCPM` raakt de undo-stack alleen bij het verlaten van "datums
// zoals opgeslagen" (issue #63), en modus-aan-én-stale is onbereikbaar (zie staleGuard.ts).
// Daarop rust ook de belofte "er ontstaat geen ongedaan-maak-stap" in de `dryRun`-beschrijving.
// → preview → optioneel commit. `dryRun` gaat NIET door een transactie: er valt niets te backuppen
// of terug te rollen (`levelResources` is een pure preview-berekening op de store).
// De respons draagt ALTIJD het volledige LevelingResult.
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
      `De projecteinddatum VERSCHUIFT: ${r.projectEndBefore} → ${r.projectEndAfter} (${calendarDays > 0 ? '+' : ''}${calendarDays} kalenderdagen). ` +
      'Dit is het gevolg van `constrainToFloat: false`; met `true` blijft de einddatum heilig.',
    );
  }
  if (unresolvedCount > 0) {
    warnings.push(
      `${unresolvedCount} taak/taken houden een onopgeloste piek; zie \`unresolvedReasons\` ` +
      '(INTRINSIC_OVERRUN = de taak vraagt op zichzelf al meer dan de capaciteit, CALENDAR_MISMATCH = ' +
      'resource- en taakkalender sluiten niet aan, INSUFFICIENT_CAPACITY = er is domweg te weinig capaciteit, ' +
      'CEILING_TOO_TIGHT = het uitloop-plafond laat te weinig ruimte, CEILING_UNREACHABLE = een deadline/' +
      'backward-constraint maakt elk plafond onbereikbaar, RESIDUAL_FULL = de eigen projectinzet had ' +
      'ruimte maar de restcapaciteit van het bibliotheek-poolitem is op — andere documenten bezetten de ' +
      'pool, NO_WINDOW_IN_HORIZON = de zoekhorizon liep leeg zonder een passend venster te vinden).',
    );
  }
  // `projectEndAfter` is de VOORSPELLING van de nivelleerder; `projectEnd` is wat er ná de
  // eind-runCPM daadwerkelijk in de store staat. Bij `dryRun` is dat per definitie de ONgewijzigde
  // planning (== projectEndBefore) — beide meegeven maakt het verschil expliciet i.p.v. impliciet.
  const { projectEnd, cappedTaskIds } = projectEndInfo(state);
  if (cappedTaskIds) {
    warnings.push(
      `Onwerkbaar venster: ${cappedTaskIds.length} taak/taken passen niet binnen hun kalender (zie cappedTaskIds).`,
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
    return '`constrainToFloat` moet een boolean zijn';
  }
  // H8 — `dryRun` werd als ENIGE parameter niet getypecheckt (`a.dryRun === true`). Elke
  // waarheidsachtige niet-boolean (`"true"`, `1`) betekende stil `false`, dus een ECHTE nivellering
  // terwijl de aanroeper dacht te previewen. Juist die parameter wordt in de beschrijving verkocht
  // als de veilige manier om eerst te kijken ⇒ hard weigeren.
  if (a.dryRun !== undefined && typeof a.dryRun !== 'boolean') {
    return `\`dryRun\` moet een boolean zijn (true/false), kreeg ${typeof a.dryRun} '${String(a.dryRun)}' — ` +
      'een niet-boolean zou stil als `false` gelden en dus een ECHTE nivellering uitvoeren';
  }
  if (a.resourceIds !== undefined) {
    if (!Array.isArray(a.resourceIds)) return "`resourceIds` moet een array van resource-id's zijn";
    // H11 — een selectie die (deels) niet bestaat, gaf een stille nul-effect-run: de leveler
    // filtert onbekende id's weg, waarna `delays: {}` / `shifts: []` leest als "er hoefde niets
    // genivelleerd te worden". Een lege selectie is om dezelfde reden nooit bedoeld.
    if (a.resourceIds.length === 0) {
      return '`resourceIds` is leeg; laat de parameter weg om ALLE hernieuwbare resources te nivelleren';
    }
    const bad = a.resourceIds.filter((x) => typeof x !== 'string' || x === '');
    if (bad.length > 0) return "`resourceIds` mag alleen niet-lege resource-id-strings bevatten";
    const known = new Set(state.resources.map((r) => r.id));
    const unknown = (a.resourceIds as string[]).filter((id) => !known.has(id));
    if (unknown.length > 0) {
      return `onbekende resource-id(s): ${unknown.join(', ')} — nivelleren zou dan stil niets doen; ` +
        'haal geldige id\'s op met planner_list_resources';
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
 * voor kloppende before/after-delta\'s; kost geen undo-stap omdat modus-aan-én-stale onbereikbaar is —
 * zie de kop van deze tool en staleGuard.ts, NIET omdat er een transactie omheen zou staan). Dat overlapt met de
 * `recomputeMidBatch` die `planner_batch` vóór een levelingstap doet — bewust: de kern moet ook
 * kloppen als de leveling de EERSTE stap van de batch is en de store al stale de batch in ging.
 */
function levelResourcesCore(ctx: McpContext, p: { options: LevelingOptions; dryRun: boolean }): MutationOutcome {
  const fresh = ensureFreshSchedule(ctx.app);
  if (fresh.error) {
    throw new McpStepError('VALIDATION', `planning kon niet worden herrekend vóór het nivelleren: ${fresh.error}`);
  }
  const preview = ctx.app.store.getState().levelResources(p.options);
  // `dryRun` muteert per contract niets — binnen een batch dus een pure preview-stap.
  if (!p.dryRun) ctx.transactions.draft.applyLeveling(preview);
  return { data: preview };
}

const levelResources: BatchStepTool = {
  name: 'planner_level_resources',
  description:
    'Nivelleer resource-pieken door taken binnen hun speling (of daarbuiten) te verschuiven. ' +
    '`constrainToFloat: true` (default) = gladstrijken BINNEN de speling: de projecteinddatum blijft ' +
    'heilig en pieken die niet oplosbaar zijn blijven staan. `constrainToFloat: false` = de einddatum ' +
    'mag opschuiven; de respons meldt die verschuiving dan prominent in `projectEndDelta` en ' +
    '`warnings`. Met `resourceIds` beperk je het tot bepaalde resources (materiaal wordt altijd ' +
    'overgeslagen); met `dryRun: true` krijg je een volledige PREVIEW zonder ook maar iets te ' +
    'wijzigen — aan te raden vóór je toepast. De respons bevat altijd het volledige resultaat: ' +
    '`delays` (toegepaste vertraging in werkdagen), `shifts` (elke taak wiens start opschuift), ' +
    '`unresolved` + `unresolvedReasons` (waaróm een piek bleef staan) en projecteinde vóór/na. ' +
    'De nivellering reset zichzelf eerst volledig, dus opnieuw draaien stapelt niet.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT },
  inputSchema: {
    type: 'object',
    properties: {
      constrainToFloat: {
        type: 'boolean',
        description: 'true (default) = alleen binnen de totale speling schuiven, einddatum blijft heilig. false = einddatum mag verschuiven.',
      },
      resourceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Beperk tot deze resources; weglaten = alle hernieuwbare resources (materiaal telt nooit mee).',
      },
      dryRun: {
        type: 'boolean',
        description:
          'true = alleen preview: er wordt niets genivelleerd en er ontstaat geen ongedaan-maak-stap. ' +
          'Let op: een nog niet doorgerekende planning wordt ook dan éérst herrekend (anders kloppen de ' +
          'voor/na-datums niet); `recomputed` meldt dat.',
      },
    },
  },
  batchStep(args, ctx) {
    const parsed = parseLeveling(args, ctx.app.store.getState());
    if (typeof parsed === 'string') throw new McpStepError('VALIDATION', parsed);
    return levelResourcesCore(ctx, parsed);
  },
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
      return toolError(ctx, 'VALIDATION', `planning kon niet worden herrekend vóór het nivelleren: ${fresh.error}`);
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
/** Synchrone, transactie-vrije kern van `clear_leveling`; niets te wissen ⇒ geen mutatie. */
function clearLevelingCore(ctx: McpContext): MutationOutcome {
  const count = ctx.app.store.getState().tasks.filter((t) => t.levelingDelay !== undefined).length;
  if (count === 0) return { data: { cleared: 0 } };
  ctx.transactions.draft.clearLeveling();
  return { data: { cleared: count } };
}

const clearLeveling: BatchStepTool = {
  name: 'planner_clear_leveling',
  description:
    'Wis alle nivellerings-vertragingen, zodat elke taak weer op zijn ongenivelleerde datum staat. ' +
    'Let op: `planner_level_resources` reset de vertragingen ZELF voordat het rekent — deze tool ' +
    'vooraf draaien is dus zinloos. Gebruik hem alleen om een eerdere nivellering ongedaan te maken ' +
    'zonder een nieuwe te berekenen.',
  kind: 'mutate',
  batchable: true,
  // GEEN destructiveHint: spec r65 zet die annotatie op een GESLOTEN lijst (delete_tasks,
  // remove_dependencies, import_schedule, update_calendar). Nivellerings-vertragingen zijn afgeleide,
  // herberekenbare waarden — ze wissen vernietigt geen ingevoerde data.
  annotations: { ...STD_ANNOT, idempotentHint: true },
  inputSchema: { type: 'object', properties: {} },
  batchStep(_args, ctx) {
    return clearLevelingCore(ctx);
  },
  async handler(_args, ctx) {
    const state = ctx.app.store.getState();
    const count = state.tasks.filter((t) => t.levelingDelay !== undefined).length;
    // No-op-snelpad (spiegelt de store-`clearLeveling`-guard): niets te wissen ⇒ geen transactie,
    // geen undo-snapshot, geen redo-wipe.
    if (count === 0) {
      const g = guardNonTransactional(ctx);
      if (g) return g;
      return okDirect(ctx, { cleared: 0, projectEnd: projectEndInfo(state).projectEnd }, []);
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => clearLevelingCore(ctx));
    return enrichOk(res, () => ({ cleared: count, projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd }));
  },
};

// =================================================================================================
// planner_update_project
// =================================================================================================
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/** Elke sleutel die `update_project` KENT — de allowlist waartegen onbekende sleutels afketsen. */
const PROJECT_KEYS = [
  'name', 'description', 'author', 'company', 'startDate', 'endDate', 'statusDate', 'progressMode',
] as const;

/** Projectvelden die de bridge BEWUST niet schrijft, mét een reden. Een expliciete weigering is
 *  oneindig veel bruikbaarder dan de stilte van vroeger. */
const PROJECT_REFUSED: Record<string, string> = {
  schedulingOptions:
    'de reken-opties (`schedulingOptions`, waaronder `floatPaths`, `criticalDefinition`, `lagCalendar`) ' +
    'zijn NIET via de bridge instelbaar: het is een samenhangend blok dat de solver-semantiek van het ' +
    'hele document verandert, en half blootstellen zou stille gedragsverschillen opleveren. Zet ze in ' +
    'de app onder Planning → opties; `planner_get_critical_path` meldt met `pathsMode` welke stand geldt.',
  floatPaths:
    '`floatPaths` hoort in `project.schedulingOptions` en is NIET via de bridge instelbaar (zie de ' +
    'app onder Planning → opties). `planner_get_critical_path` meldt met `pathsMode` welke stand geldt.',
  calendarId:
    'WELKE kalender de projectdefault is, kan de bridge niet wisselen — dat doe je in de app ' +
    '(kalenderbibliotheek → als projectkalender instellen). Wil je de INHOUD van de projectkalender ' +
    'wijzigen (of hem gelijkmaken aan die van een ander document), schrijf dan met ' +
    '`planner_update_calendar` op het id uit `planner_get_calendars.projectDefaultId`; een taak aan ' +
    'een andere kalender hangen doe je met `update_tasks.calendarId`. Kalender-id\'s zijn per document.',
  wbsAutoNumber: 'automatisch WBS-nummeren is een documentinstelling in de app, niet via de bridge.',
  id: '`id` is de stabiele projectidentiteit en wordt nooit overschreven.',
  createdAt: 'tijdstempels worden door de app beheerd.',
  modifiedAt: 'tijdstempels worden door de app beheerd.',
};

/** Vormvalidatie van `update_project`; string = foutboodschap. Levert de veld-merge, de
 *  wis-vlaggen voor `statusDate`/`progressMode` en de lijst geraakte velden.
 *
 *  K7 — ONBEKENDE SLEUTELS KETSEN AF. Vroeger liep deze functie een vaste sleutellijst af en liet al
 *  het andere STIL vallen: `{name:'X', endDate:'2027-01-01'}` meldde `updated:['name']` en gooide
 *  `endDate` weg zonder één woord. Alleen een call ZONDER enige bekende sleutel gaf een fout. Nu
 *  wordt elke onbekende sleutel bij naam geweigerd, mét de toegestane lijst erbij.
 */
function parseUpdateProject(
  args: unknown,
): { updates: Partial<Project>; clearStatusDate: boolean; clearProgressMode: boolean; touched: string[] } | string {
  const a = (args ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(a)) {
    if ((PROJECT_KEYS as readonly string[]).includes(key)) continue;
    if (PROJECT_REFUSED[key]) return `\`${key}\` wordt niet geschreven: ${PROJECT_REFUSED[key]}`;
    return `onbekend veld \`${key}\`; update_project kent alleen: ${PROJECT_KEYS.join(', ')}`;
  }
  const updates: Partial<Project> = {};
  for (const key of ['name', 'description', 'author', 'company'] as const) {
    if (a[key] !== undefined) {
      if (typeof a[key] !== 'string') return `\`${key}\` moet een string zijn`;
      updates[key] = a[key] as string;
    }
  }
  if (a.startDate !== undefined) {
    if (typeof a.startDate !== 'string' || !ISO_DATE.test(a.startDate)) {
      return '`startDate` moet een ISO-datum zijn (JJJJ-MM-DD)';
    }
    updates.startDate = a.startDate;
  }
  // `endDate` is een ECHT projectveld (Backstage-invoer, IFC-round-trip, MSPDI `FinishDate`, P6
  // `MustFinishByDate`, en het voedt de generatie-spanne van `update_calendar`). De leeskant gaf hem
  // al terug; hij hoorde dus ook schrijfbaar te zijn. `''` = geen einddatum (de app-conventie:
  // `moveProject` laat '' bewust '' en de exporteurs slaan het veld dan over) — géén `null`, want
  // het veld is in het type een verplichte string.
  if (a.endDate !== undefined) {
    if (typeof a.endDate !== 'string' || (a.endDate !== '' && !ISO_DATE.test(a.endDate))) {
      return '`endDate` moet een ISO-datum zijn (JJJJ-MM-DD) of een lege string om hem te wissen';
    }
    updates.endDate = a.endDate;
  }
  // `progressMode` is een documentinstelling die de solver leest (out-of-sequence-afhandeling) en
  // die `get_project_info` al teruggaf. Enum + wissen naar de default (RETAINED_LOGIC).
  let clearProgressMode = false;
  if (a.progressMode !== undefined) {
    if (a.progressMode === null || a.progressMode === '') {
      clearProgressMode = true;
    } else if (a.progressMode !== 'RETAINED_LOGIC' && a.progressMode !== 'PROGRESS_OVERRIDE') {
      return `\`progressMode\` moet RETAINED_LOGIC of PROGRESS_OVERRIDE zijn (of null om terug te vallen ` +
        `op de default RETAINED_LOGIC), kreeg '${String(a.progressMode)}'`;
    } else {
      updates.progressMode = a.progressMode;
    }
  }
  // Wissen loopt NIET via de veld-merge: `Object.assign({ statusDate: undefined })` laat de sleutel
  // met waarde `undefined` achter, terwijl de store-actie `setStatusDate` hem echt `delete`t. Die
  // vorm houden we aan (IFC-serialisatie en de statusdatum-guards lezen op sleutel-aanwezigheid).
  let clearStatusDate = false;
  if (a.statusDate !== undefined) {
    if (a.statusDate === null || a.statusDate === '') {
      clearStatusDate = true;
    } else if (typeof a.statusDate !== 'string' || !ISO_DATE.test(a.statusDate)) {
      return '`statusDate` moet een ISO-datum zijn (JJJJ-MM-DD) of null';
    } else {
      updates.statusDate = a.statusDate;
    }
  }
  const touched = [
    ...Object.keys(updates),
    ...(clearStatusDate ? ['statusDate'] : []),
    ...(clearProgressMode ? ['progressMode'] : []),
  ];
  if (touched.length === 0) {
    return `update_project vereist minstens één veld (${PROJECT_KEYS.join('/')})`;
  }
  return { updates, clearStatusDate, clearProgressMode, touched };
}

/** De mechanisme-uitleg die MEE MOET zodra er een statusdatum wordt GEZET. Staat bewust in de
 *  payload en niet alleen in de tool-beschrijving: de AI leest data vaak eerder dan de beschrijving,
 *  en dit gevolg (de hele planning schuift op) is groot genoeg om niet stil te mogen blijven. Het
 *  batch-pad krijgt hem hierdoor óók — daar is er geen `enrichOk` en dus geen voor/na-getal. */
const STATUS_DATE_NOTE =
  'De statusdatum is de DATA DATE: werk met completion 0 kan nooit vóór deze datum starten en wordt ' +
  'erheen vooruitgeschoven. Ook zónder enige geregistreerde voortgang verschuift de hele planning ' +
  '(inclusief de eerste mijlpaal) daardoor naar de statusdatum en schuift het projecteinde evenveel ' +
  'op; `startDate` blijft ongemoeid. Wis de statusdatum (null) om dat terug te draaien.';

/** Synchrone, transactie-vrije kern van `update_project`. */
function updateProjectCore(
  ctx: McpContext,
  p: { updates: Partial<Project>; clearStatusDate: boolean; clearProgressMode: boolean; touched: string[] },
): MutationOutcome {
  // T7-review H1: `draft.setProject` levert nu het aantal wortel-ankers dat het klemde (zelfde
  // bewerkbescherming als de UI, `projectSlice.setProject`) — meegeven in `data` zodat óók het
  // `planner_batch`-pad (dat rechtstreeks `updateProjectCore` gebruikt, zonder `enrichOk`) dit ziet.
  const anchorsClamped = ctx.transactions.draft.setProject(p.updates);
  if (p.clearStatusDate || p.clearProgressMode) {
    ctx.app.store.setState((s) => {
      // `delete` i.p.v. `= undefined`: de IFC-serialisatie en de solver-defaults lezen op
      // sleutel-AANWEZIGHEID (zelfde conventie als de store-actie `setStatusDate`).
      if (p.clearStatusDate) delete s.project.statusDate;
      if (p.clearProgressMode) delete s.project.progressMode;
      s.project.modifiedAt = new Date().toISOString();
      s.isDirty = true;
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
    'Wijzig projectgegevens: `name`, `description`, `author`, `company`, `statusDate` (de peildatum ' +
    'waarop voortgang wordt geregistreerd — zónder deze datum weigert het voortgangspad van ' +
    'update_tasks), `endDate` (de contractuele/gewenste einddatum — puur metadata, hij dwingt NIETS ' +
    'af in de planning; lege string wist hem), `progressMode` (RETAINED_LOGIC of PROGRESS_OVERRIDE — ' +
    'hoe de solver werk buiten de volgorde afhandelt; null = terug naar de default RETAINED_LOGIC) en ' +
    '`startDate`. Een ONBEKEND veld wordt geweigerd met de toegestane lijst erbij — er wordt nooit ' +
    'stil iets weggegooid. BELANGRIJK over `startDate`: het is het anker voor NIEUW aan te maken ' +
    'taken en verschuift de REST van de bestaande planning niet — geen enkele taak-EIND schuift mee, ' +
    'behalve het eind van de geklemde ankers zelf, dat duurbehoudend meeschuift. ' +
    'Sinds T7b is er wél één gerichte uitzondering (bewerkbescherming, geen Δ-verschuiving): een ' +
    'LATERE `startDate` klemt bestaande taak-ankers die zónder voorganger en zónder constraint vóór ' +
    'de nieuwe startdatum staan, vooruit náár die datum (de respons meldt `anchorsClamped`) — zo blijft een ' +
    'wortel-taak niet stil vóór het officiële projectbegin hangen na het verzetten van de start. Een ' +
    'taak met een voorganger, een constraint, of een start ná de nieuwe datum blijft ongemoeid. Wil ' +
    'je de HELE bestaande planning (elk anker, elke taak) Δ dagen opschuiven, gebruik dan ' +
    '`planner_move_project`. Zet `startDate` dus vóór add_tasks, niet erna. NET ZO BELANGRIJK over ' +
    '`statusDate`: dat is GEEN passief label maar de DATA DATE ' +
    'uit P6/MSP, en die HERSCHIKT de planning. Werk dat nog niet begonnen is (completion 0) mag niet ' +
    'meer vóór de statusdatum liggen en wordt naar die datum vooruitgeschoven; op een planning ' +
    'zónder enige voortgang schuift dus ALLES mee — inclusief de eerste mijlpaal — en verspringt het ' +
    'projecteinde evenveel, terwijl `startDate` gewoon blijft staan. Zet een statusdatum daarom pas ' +
    'wanneer je ook echt voortgang gaat registreren. De respons meldt onder `statusDateEffect` het ' +
    'projecteinde vóór én ná deze call, zodat je die verschuiving ziet. ' +
    '`statusDate: null` (of een lege string) wist de statusdatum — doe dat bewust: zonder ' +
    'peildatum worden reeds geregistreerde actuals inert (de solver pint er niet meer op) en kunnen ' +
    'berekende datums bij de eerstvolgende herberekening verschuiven.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT },
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      author: { type: 'string' },
      company: { type: 'string' },
      startDate: { type: 'string', description: 'ISO-datum (JJJJ-MM-DD). Anker voor NIEUWE taken; verschuift bestaande taken NIET.' },
      endDate: { type: 'string', description: 'Gewenste/contractuele einddatum als ISO-datum (JJJJ-MM-DD); lege string wist hem. Metadata — dwingt niets af in de planning.' },
      statusDate: {
        type: ['string', 'null'],
        description:
          'ISO-datum (JJJJ-MM-DD) of null om te wissen. Dit is de DATA DATE: niet-gestart werk ' +
          '(completion 0) wordt naar deze datum vooruitgeschoven, dus het zetten ervan verschuift ' +
          'ook zonder enige voortgang de hele planning en het projecteinde.',
      },
      progressMode: {
        type: ['string', 'null'],
        enum: ['RETAINED_LOGIC', 'PROGRESS_OVERRIDE', null],
        description: 'Voortgangs-scheduling-modus; null = terug naar de default RETAINED_LOGIC.',
      },
    },
    additionalProperties: false,
  },
  batchStep(args, ctx) {
    const parsed = parseUpdateProject(args);
    if (typeof parsed === 'string') throw new McpStepError('VALIDATION', parsed);
    return updateProjectCore(ctx, parsed);
  },
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
    // T7-review H1: `enrichOk` hieronder OVERSCHRIJFT `res.data` met wat `build()` teruggeeft — dus
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
        },
        // Herinnering in de payload zelf: de AI leest data vaak eerder dan de beschrijving.
        // T7-review H1: dit beloofde tot nu toe onvoorwaardelijk dat GEEN enkele bestaande taak
        // verschuift — sinds de bewerkbescherming klopt dat niet meer voor de uitzondering
        // hieronder (`anchorsClamped`).
        note: '`startDate` is het anker voor NIEUWE taken en verschuift de REST van de bestaande ' +
          'planning niet. Uitzondering (bewerkbescherming, geen Δ-verschuiving): bij een LATERE ' +
          'startDate schuiven wortel-taken zonder voorganger/constraint die vóór de nieuwe datum ' +
          'staan mee náár die datum — zie `anchorsClamped`. Gebruik planner_move_project om de ' +
          'HELE bestaande planning (elk anker) te verschuiven.',
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
// ROUTE-KEUZE (zelfde als T19's `move_task`): we roepen de slice-actie DIRECT aan i.p.v. een eigen
// draft-primitief te bouwen. De verschuif-logica (project-, taak-, resource- en baseline-datums,
// exacte-datum-pinning i.p.v. Δ-drift) leeft in `moveProject` en mag niet gedupliceerd worden. De
// transactie-suppressievlag dekt de interne `beginUndoable`, zodat het één undo-stap blijft.
//
// DUBBELE runCPM — BEWUST GEACCEPTEERD: `moveProject` draait na zijn `set()` zelf `runCPM()` (+
// `requestFitToProject`), en `runInMcpTransaction` draait aan het eind nóg een keer `runCPM`. Dat is
// één overbodige herberekening. Het alternatief — de verschuif-logica hier nabouwen zonder de
// trailing recompute — zou de enige bron van waarheid dupliceren en bij elke wijziging in
// `moveProject` stil uit de pas gaan lopen. `runCPM` is idempotent en pusht binnen de transactie
// geen undo-snapshot
// (invariant a), dus de dubbele run is puur rekenwerk, geen semantisch verschil.
// =================================================================================================
/** Vormvalidatie van `move_project`; string = foutboodschap. */
function parseMoveProject(args: unknown): { newStartDate: string; shiftBaselines: boolean } | string {
  const a = (args ?? {}) as { newStartDate?: unknown; shiftBaselines?: unknown };
  if (typeof a.newStartDate !== 'string' || !ISO_DATE.test(a.newStartDate)) {
    return '`newStartDate` moet een ISO-datum zijn (JJJJ-MM-DD)';
  }
  // Zelfde patroon als `dryRun` (H8), lagere inzet: een niet-boolean gold stil als `false`, dus
  // baselines bleven staan terwijl de aanroeper dacht ze mee te verschuiven.
  if (a.shiftBaselines !== undefined && typeof a.shiftBaselines !== 'boolean') {
    return `\`shiftBaselines\` moet een boolean zijn (true/false), kreeg ${typeof a.shiftBaselines} '${String(a.shiftBaselines)}'`;
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
    throw new McpStepError('VALIDATION', `kan de verschuiving niet bepalen vanaf projectstart '${s0.project.startDate}'`);
  }
  if (delta === 0) {
    return { data: { moved: false, deltaDays: 0, taskCount: s0.tasks.length, reason: 'de projectstart is al deze datum' } };
  }
  const out = ctx.app.store.getState().moveProject(p.newStartDate, { shiftBaselines: p.shiftBaselines });
  if (!out.moved) throw new McpStepError('VALIDATION', `verschuiven naar '${p.newStartDate}' leverde geen wijziging op`);
  return { data: out };
}

const moveProject: BatchStepTool = {
  name: 'planner_move_project',
  description:
    'Verschuif de HELE bestaande planning zodat het project op `newStartDate` begint: alle taken en ' +
    'resource-datums schuiven mee. Dit is het tegenovergestelde van `planner_update_project.startDate` ' +
    '(dat alleen het anker voor nieuwe taken zet). Let op: de KALENDERS schuiven bewust NIET mee — ' +
    'feestdagen en bouwvak liggen op vaste datums, dus de einddatum kan met een ánder aantal dagen ' +
    'verspringen dan de verschuiving zelf; de respons meldt beide. Baselines blijven standaard staan ' +
    '(een baseline bestaat om afwijking te meten); met `shiftBaselines: true` schuiven ze mee.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT },
  inputSchema: {
    type: 'object',
    properties: {
      newStartDate: { type: 'string', description: 'Nieuwe projectstart als ISO-datum (JJJJ-MM-DD).' },
      shiftBaselines: { type: 'boolean', description: 'Laat opgeslagen baselines meeschuiven; default false.' },
    },
    required: ['newStartDate'],
  },
  batchStep(args, ctx) {
    const parsed = parseMoveProject(args);
    if (typeof parsed === 'string') throw new McpStepError('VALIDATION', parsed);
    return moveProjectCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsed = parseMoveProject(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const { newStartDate, shiftBaselines } = parsed;

    const s0 = ctx.app.store.getState();
    const delta = computeMoveDelta(s0.project.startDate, newStartDate);
    if (!Number.isFinite(delta)) {
      return toolError(ctx, 'VALIDATION', `kan de verschuiving niet bepalen vanaf projectstart '${s0.project.startDate}'`);
    }
    // No-op-snelpad: Δ=0 ⇒ `moveProject` muteert niets; dan ook geen transactie/undo-stap.
    if (delta === 0) {
      const g = guardNonTransactional(ctx);
      if (g) return g;
      return okDirect(
        ctx,
        { moved: false, deltaDays: 0, taskCount: s0.tasks.length, reason: 'de projectstart is al deze datum', projectEnd: projectEndInfo(s0).projectEnd },
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
          ? { note: `Het einde schuift ${endDeltaDays} kalenderdagen op terwijl de start ${out.deltaDays} dagen opschuift — de kalender (feestdagen/bouwvak) grijpt in.` }
          : {}),
        ...(cappedTaskIds ? { cappedTaskIds } : {}),
      };
    });
  },
};

// =================================================================================================
// planner_save_baseline (WP8 staleness-guard; UITGESLOTEN van batch)
//
// ROUTE-KEUZE (zelfde als `move_task`/`move_project`): de slice-actie `saveBaseline` wordt DIRECT
// binnen de transactie aangeroepen — er is geen draft-variant en de snapshot-logica (leaf-taken,
// early-datums met schedule-fallback, actief zetten) hoort niet gedupliceerd te worden. De
// suppressievlag dekt de interne `beginUndoable`, dus het blijft één undo-stap.
//
// `batchable: false` is normatief (spec §Compositie): een baseline hoort een losse, bewuste
// nulmeting op een vers schema te zijn; binnen een batch-snapshot zou een rollback hem mee-wissen
// en is de volgorde-semantiek onbepaald.
// =================================================================================================
const saveBaseline: McpToolDef = {
  name: 'planner_save_baseline',
  description:
    'Leg de huidige planning vast als baseline (nulmeting) en maak die direct actief; latere ' +
    'afwijkingen meet je ertegen af met compare_baseline/analyze_delay. Is de planning verouderd OF ' +
    'nog nooit doorgerekend (bijv. na crash-herstel), dan wordt eerst herrekend zodat de baseline op ' +
    'verse datums staat (`recomputed` meldt dat). Deze tool kan NIET als stap in een batch draaien: een baseline hoort een losse, ' +
    'bewuste nulmeting te zijn. Zonder `name` krijgt de baseline een oplopende standaardnaam.',
  kind: 'mutate',
  batchable: false,
  annotations: { ...STD_ANNOT },
  inputSchema: {
    type: 'object',
    properties: { name: { type: 'string', description: 'Naam van de baseline; weglaten = "Baseline N".' } },
  },
  async handler(args, ctx) {
    const a = (args ?? {}) as { name?: unknown };
    if (a.name !== undefined && typeof a.name !== 'string') {
      return toolError(ctx, 'VALIDATION', '`name` moet een string zijn');
    }

    const g = guardNonTransactional(ctx);
    if (g) return g;

    // WP8: eerst herrekenen bij een stale planning (runCPM pusht hier geen undo-snapshot: "modus
    // aan én stale" is onbereikbaar, zie de kop van readTools.ts).
    const fresh = ensureFreshSchedule(ctx.app);
    if (fresh.error) {
      return toolError(ctx, 'VALIDATION', `planning kon niet worden herrekend vóór de baseline: ${fresh.error}`);
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

/** Alle T20-tools als vlakke module-array (registreer via één regel in toolRegistry.MODULES). */
export const calendarResourceTools: McpToolDef[] = [
  updateCalendar,
  manageAssignments,
  levelResources,
  clearLeveling,
  updateProject,
  moveProject,
  saveBaseline,
];
