import { formatDate, formatInstant, parseDate, parseInstant, localTodayIso } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { calendarForEngine } from '@/utils/effectiveWorkTime';

/**
 * Gedeelde datum-parse voor de import-readers (F5-a). Externe planningsbestanden dragen datums als
 * een ISO-achtige datetime (`2026-03-09T08:00:00`); wij bewaren in DAG-modus alleen de datum-prefix.
 * Lege invoer valt terug op vandaag (de bestaande reader-conventie — nooit een lege datum verzinnen).
 * Voor de GEPLANDE start/finish van een taak is "vandaag" alleen een plaatshouder: de lezer
 * registreert het ontbreken en `resolveMissingScheduleDates` (onderaan) vervangt hem.
 *
 * MSPDI (`parseMSPDate`) en P6 (`parseP6Date`) waren byte-identiek en importeren dit rechtstreeks.
 * CSV heeft een extra `DD-MM-YYYY`/`DD/MM/YYYY`-tak (`csvDateOrToday`). De IFC-reader deelt dit
 * BEWUST niet: die moet eerst de STEP-quoting én de `$`-null-conventie afhandelen en heeft afwijkende
 * lege-invoer-semantiek — zie de noot bij `parseDateFromIFC` in ifcReader. De statusdatum
 * (`importStatusDate`) deelt de IFC-reader wél: die krijgt de waarde al ontdaan van de STEP-typering.
 */

/** ISO-datum-prefix (`YYYY-MM-DD`) uit een datetime-string; lege invoer ⇒ vandaag. */
export function isoDatePrefixOrToday(s: string): string {
  if (!s) return localTodayIso();
  return s.substring(0, 10);
}

/** Een datetime uit MSPDI/P6 in de modus van de taak: UUR ⇒ de echte tijd-van-de-dag
 *  (`YYYY-MM-DDTHH:mm`, §7.3), DAG ⇒ de datum-prefix. Lege invoer ⇒ vandaag, zoals hierboven. */
export function importDateTime(s: string, hour: boolean): string {
  if (!s) return localTodayIso();
  return hour ? formatInstant(parseInstant(s), 'hour') : s.substring(0, 10);
}

/** Statusdatum uit een bestand → `project.statusDate`, voor élke lezer die hem kent (IFC, MSPDI, P6,
 *  `.mpp` via `statusDateFromXml`).
 *  Zonder tijd ⇒ `YYYY-MM-DD`; mét tijd ⇒ de store-vorm van een uur-instant (`YYYY-MM-DDTHH:mm`),
 *  ongeacht de modus van de taken: de tijd staat in het bestand en de engine gebruikt hem op een
 *  uur-projectkalender. Een onleesbare tijd ⇒ de datum. Het XML-dag-anker (een datum zonder tijd die
 *  MSPDI/P6 als `T08:00:00` moeten schrijven) vangt `statusDateFromXml` vóór deze functie af. */
export function importStatusDate(v: string): string {
  const day = v.substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return day;
  const instant = parseInstant(v);
  return Number.isNaN(instant.getTime()) ? day : formatInstant(instant, 'hour');
}

/** CSV-variant: accepteert naast ISO ook `DD-MM-YYYY` / `DD/MM/YYYY`; leeg/onherkenbaar ⇒ `undefined`. */
export function csvDate(s: string): string | undefined {
  if (!s) return undefined;
  // Eerst ISO proberen.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  // Dan DD-MM-YYYY of DD/MM/YYYY.
  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  return undefined;
}

/** `csvDate` met de bestaande vandaag-terugval (actuals/kalender-datums gebruiken hem niet). */
export function csvDateOrToday(s: string): string {
  return csvDate(s) ?? localTodayIso();
}

// ── Ontbrekende geplande start/finish van ingelezen taken ───────────────────────────────────────

/**
 * Taak-id's waarvan het bestand GEEN (leesbare) geplande start of finish droeg. De lezer zet tijdens
 * het parsen nog zijn gewone plaatshouder (vandaag, of bij `.mpp` finish = start) en registreert het
 * id hier; `resolveMissingScheduleDates` vervangt die plaatshouder daarna op één gedeelde manier.
 */
export interface MissingScheduleDates {
  start: Set<string>;
  finish: Set<string>;
}

export function emptyMissingScheduleDates(): MissingScheduleDates {
  return { start: new Set(), finish: new Set() };
}

/**
 * Geplande finish uit start + duur, alleen waar dat EENDUIDIG is:
 * - duur 0 (mijlpaal/nul-duur, elke eenheid) ⇒ finish = start;
 * - dagtaak op werktijd met een geheel aantal dagen en een datum zonder tijd ⇒ de laatste werkdag op
 *   de effectieve kalender van de taak (`CalendarEngine.addWorkDays`, startdag telt als dag 1 — exact
 *   de forward-pass-rekenregel).
 * Anders `undefined` (uurtaken, elapsed duur, fractionele dagen, datetime-starts: daar hangt het
 * antwoord af van tijd-van-de-dag/bandregels die pas de solver eenduidig toepast).
 */
function finishFromStartAndDuration(task: Task, calendar: WorkCalendar): string | undefined {
  const t = task.time;
  if (t.scheduleDuration === 0 && !t.durationMinutes) return t.scheduleStart;
  if (t.scheduleStart.includes('T')) return undefined;
  if (t.durationUnit !== 'days' || t.durationType !== 'WORKTIME') return undefined;
  if (!Number.isInteger(t.scheduleDuration) || t.scheduleDuration < 0) return undefined;
  const start = parseDate(t.scheduleStart);
  if (isNaN(start.getTime())) return undefined;
  const { date, capped } = new CalendarEngine(calendarForEngine(calendar))
    .addWorkDaysChecked(start, t.scheduleDuration);
  return capped ? undefined : formatDate(date);
}

/**
 * Eén regel voor alle lezers (IFC/CSV/MSPDI/P6/MPP) voor een ontbrekende geplande start/finish —
 * vóór `normalizeImportedProgress`, zodat ook de AS/AF-defaults van een voltooide taak geen leesdatum
 * zien (import/export-audit, vervolg op bevinding 6):
 *
 * 1. PROJECTSTART-ANKER: de projectstart uit het bestand, anders de vroegste AANWEZIGE taakstart
 *    (datumdeel), anders vandaag (leeg project). De aanroeper beslist of hij dit anker ook als
 *    `project.startDate` overneemt.
 * 2. ONTBREKENDE START ⇒ het anker, net als een nieuwe taak (`addTask` zet een taak zonder datum op de
 *    projectstart). Voorheen werd dat de leesdatum, en een wortel-taak gebruikt zijn eigen start als
 *    anker in de forward pass — hij verhuisde dus naar vandaag.
 * 3. ONTBREKENDE FINISH ⇒ start + duur waar dat eenduidig is (`finishFromStartAndDuration`), anders
 *    blijft de plaatshouder van de lezer staan.
 *
 * Early/late-velden die de plaatshouder spiegelden (zoals de lezers ze bij constructie gelijk zetten)
 * gaan mee. @returns het gebruikte projectstart-anker.
 */
export function resolveMissingScheduleDates(
  tasks: Task[],
  missing: MissingScheduleDates,
  fileProjectStart: string,
  calendarOf: (task: Task) => WorkCalendar,
): string {
  let earliest = '';
  for (const t of tasks) {
    if (missing.start.has(t.id)) continue;
    const st = t.time.scheduleStart;
    if (st && (!earliest || st < earliest)) earliest = st;
  }
  const anchor = fileProjectStart
    ? fileProjectStart.substring(0, 10)
    : (earliest ? earliest.substring(0, 10) : localTodayIso());
  for (const t of tasks) {
    const time = t.time;
    if (missing.start.has(t.id)) {
      const placeholder = time.scheduleStart;
      time.scheduleStart = anchor;
      if (time.earlyStart === placeholder) time.earlyStart = anchor;
      if (time.lateStart === placeholder) time.lateStart = anchor;
    }
    if (missing.finish.has(t.id)) {
      const derived = finishFromStartAndDuration(t, calendarOf(t));
      if (derived === undefined) continue;
      const placeholder = time.scheduleFinish;
      time.scheduleFinish = derived;
      if (time.earlyFinish === placeholder) time.earlyFinish = derived;
      if (time.lateFinish === placeholder) time.lateFinish = derived;
    }
  }
  return anchor;
}

/**
 * Strikte CSV-variant voor de VASTLEGGING ("datums zoals opgeslagen", bak 4): dezelfde twee
 * herkende vormen als `csvDateOrToday`, maar een cel die niets herkenbaars bevat — of een datum die
 * niet bestaat (maand 13, 31 februari) — geeft `undefined` in plaats van "vandaag". Een verzonnen
 * vandaag-datum als "zo stond het in het bestand" liet het document anders in de modus openen met
 * alle taken op vandaag (critreview op ded4d8c3, bevinding 1). `task.time` blijft de gewone,
 * vergevende lezing via `csvDateOrToday`.
 */
export function csvDateOrUndefined(s: string): string | undefined {
  const trimmed = s.trim();
  let y: number, m: number, d: number;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = iso ? null : trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (iso) { y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]); }
  else if (dmy) { y = Number(dmy[3]); m = Number(dmy[2]); d = Number(dmy[1]); }
  else return undefined;
  if (m < 1 || m > 12 || d < 1) return undefined;
  // Dagen in de maand via UTC — geen lokale tijdzone in het spel.
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > daysInMonth) return undefined;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
