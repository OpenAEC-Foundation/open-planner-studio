import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { WorkCalendar } from '@/types/calendar';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { formatDate, formatInstant, MS_PER_DAY, parseDate, parseInstant, utcDayIndex } from '@/utils/dateUtils';

/**
 * De dagregels van de tijdas in minuten (spec `docs/superpowers/specs/2026-10-20-alleen-uren-design.md`,
 * §0 en §4.2):
 *
 *  - **werkdag van een moment** ({@link workdayOfInstant}): de datum waarop het werkblok begint waarin het
 *    moment valt; bij een eindmoment telt ook het werkblok dat op dat moment eindigt. Buiten elk werkblok:
 *    de datum van het moment, behalve een eindmoment om 00:00, dat bij de dag ervoor hoort (de 24:00-regel);
 *  - **D1** ({@link dayStartInstant}): een startachtige datum zonder tijd wordt het begin van het eerste
 *    werkblok dat op die datum begint;
 *  - **D2** ({@link dayEndInstant}): een eindachtige datum zonder tijd wordt het einde van het laatste
 *    werkblok dat op die datum begint (bij een nachtblok di 22:00–wo 06:00 dus wo 06:00);
 *  - **D4**: heeft de datum geen werkblok (weekend, feestdag), dan gelden de werkblokken van de typische
 *    werkdag op die datum (`CalendarEngine.typicalWorkdayBands`).
 *
 * Kalendertijd (ELAPSEDTIME) heeft dagranden 00:00 en 24:00: D1 is 00:00, D2 is 24:00 (00:00 van de dag
 * erna). De regels per taakveld (D3, D5–D7) staan in `src/state/migrations/minuteModel.ts`.
 *
 * F1 gebruikt deze regels bij voortgangsinvoer in het urenpad. De migratiefunctie en de
 * planningsharness gebruiken ze ook; F2 sluit de normalisatie aan op alle laad- en invoergrenzen.
 */

/** Startkant `[blokbegin, blokeinde)` of eindkant `(blokbegin, blokeinde]` van een moment. */
export type InstantSide = 'start' | 'end';

/** De klok waarop de dagregels rekenen: de werkblokken van een kalender, of kalendertijd (24/7). */
export type DayClock =
  | { readonly kind: 'blocks'; readonly engine: CalendarEngine; readonly calendar: WorkCalendar }
  | { readonly kind: 'elapsed' };

/** Kalendertijd: elk uur telt; de dagranden zijn 00:00 en 24:00. */
export const ELAPSED_CLOCK: DayClock = { kind: 'elapsed' };

/** De kant van een beperkingsdatum (§4.2): een startbeperking (SNET, SNLT, MSO) is startachtig, een
 *  eindbeperking (FNET, FNLT, MFO) eindachtig; ASAP/ALAP hebben geen datum (`null`). Dezelfde indeling
 *  als `constraintDateField` in `state/migrations/minuteModel.ts` (gepind in check-f4b-datumweergave);
 *  hier zonder state-import, voor de taskGrid-engine. */
export function constraintDateSide(type: string): InstantSide | null {
  if (type === 'SNET' || type === 'SNLT' || type === 'MSO') return 'start';
  if (type === 'FNET' || type === 'FNLT' || type === 'MFO') return 'end';
  return null;
}

/** De werkblokkenklok van een kalender. Een dagkalender krijgt zijn werkblokken uit zijn eigen velden
 *  (`calendarForEngine`), zoals de motor na F2. Een kalender zonder af te leiden werkblokken houdt een
 *  engine in dag-modus; dan valt D1/D2 terug op begin- en eindtijd van de kalender. */
export function blocksClock(calendar: WorkCalendar): DayClock {
  return { kind: 'blocks', engine: new CalendarEngine(calendarForEngine(calendar)), calendar };
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MS_PER_MIN = 60_000;

/** Een datum zonder tijd (`YYYY-MM-DD`). */
export function isDateOnly(value: string): boolean {
  return DATE_ONLY_RE.test(value);
}

/** Een moment met tijd (`YYYY-MM-DDTHH:mm…`). */
export function isInstant(value: string): boolean {
  return INSTANT_RE.test(value);
}

/** B4: een werkdaggrens toont alleen haar werkdag; een moment binnen de dag houdt zijn tijd. */
export function workdayBoundaryLabel(clock: DayClock, value: string, side: InstantSide): string {
  if (!isInstant(value)) return value;
  const day = workdayOfInstant(clock, value, side);
  const boundary = side === 'start' ? dayStartInstant(clock, day) : dayEndInstant(clock, day);
  return boundary && parseInstant(boundary).getTime() === parseInstant(value).getTime() ? day : value;
}

function minuteOfDayIso(date: string, minutes: number): string {
  const ms = parseDate(date).getTime() + Math.round(minutes) * MS_PER_MIN;
  return formatInstant(new Date(ms), 'hour');
}

/** Werkblokken (minuten vanaf middernacht van `date`) die op `date` beginnen; leeg in dag-modus. */
function blocksOn(clock: Extract<DayClock, { kind: 'blocks' }>, date: string) {
  return clock.engine.effectiveBandsOn(parseDate(date));
}

/** Begin- of eindtijd van de kalender zelf, als er geen werkblokken af te leiden zijn. */
function scalarMinute(calendar: WorkCalendar, which: 'start' | 'end'): number | null {
  const start = calendar.workStartHour * 60;
  const end = calendar.workEndHour * 60;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1440 || start >= end) return null;
  return which === 'start' ? start : end;
}

/**
 * D1 (startachtig): het begin van het eerste werkblok dat op `date` begint; zonder werkblok op die datum
 * de werkblokken van de typische werkdag (D4). Kalendertijd: 00:00. `null` als `date` geen datum zonder
 * tijd is, of als de kalender geen werkblokken en geen geldige begintijd heeft.
 */
export function dayStartInstant(clock: DayClock, date: string): string | null {
  if (!isDateOnly(date) || Number.isNaN(parseDate(date).getTime())) return null;
  if (clock.kind === 'elapsed') return `${date}T00:00`;
  const own = blocksOn(clock, date);
  if (own.length > 0) return minuteOfDayIso(date, own[0].start);
  const typical = clock.engine.typicalWorkdayBands();
  if (typical.length > 0) return minuteOfDayIso(date, typical[0].start);
  const scalar = scalarMinute(clock.calendar, 'start');
  return scalar === null ? null : minuteOfDayIso(date, scalar);
}

/**
 * D2 (eindachtig): het einde van het laatste werkblok dat op `date` begint. Een nachtblok eindigt op de
 * dag erna; een blok tot 24:00 eindigt om 00:00 van de dag erna. Zonder werkblok op die datum de typische
 * werkdag (D4). Kalendertijd: 24:00. `null` zoals bij {@link dayStartInstant}.
 */
export function dayEndInstant(clock: DayClock, date: string): string | null {
  if (!isDateOnly(date) || Number.isNaN(parseDate(date).getTime())) return null;
  if (clock.kind === 'elapsed') return minuteOfDayIso(date, 1440);
  const own = blocksOn(clock, date);
  if (own.length > 0) return minuteOfDayIso(date, own[own.length - 1].end);
  const typical = clock.engine.typicalWorkdayBands();
  if (typical.length > 0) return minuteOfDayIso(date, typical[typical.length - 1].end);
  const scalar = scalarMinute(clock.calendar, 'end');
  return scalar === null ? null : minuteOfDayIso(date, scalar);
}

/**
 * De werkdag van het moment van een nulduur-mijlpaal (besluit B10 met de aanvulling "einde blijft einde",
 * spec §4.2): de datum waarvan de werkspanne het moment bevat. De werkspanne van een datum loopt van het
 * begin van zijn eerste werkblok tot het einde van zijn laatste (D1 tot D2, randen inbegrepen); een datum
 * zonder werkblok (weekend, feestdag) heeft de spanne van de typische werkdag (D4).
 *
 * Bevatten meer spannes het moment, dan wint eerst de rand van `side` (de soort van de mijlpaal: FINISH de
 * eindkant, anders de startkant), dan de andere rand, dan een moment binnen de spanne; bij een gelijke stand
 * gaat een datum met eigen werkblokken voor D4. Zo is di 00:00 op een 24-uurskalender bij FINISH "ma" en
 * anders "di", en za 00:00 na een 24-uursvrijdag bij START "za" (het begin van de typische werkdag, D4).
 * Voorbeeld: ma–do 22:00–06:00, vr 22:00–02:00, weekend vrij. Za 02:00 is het einde van vr: "vr". Zo 06:00
 * is het einde van de typische werkdag op za (D4): "za". Za 05:00 ligt in geen spanne.
 *
 * Buiten elke spanne, en bij kalendertijd, geldt {@link workdayOfInstant} aan de kant `side` (de klokdatum,
 * met de 24:00-regel). Een datum zonder tijd komt ongewijzigd terug; onleesbare invoer geeft `''`.
 *
 * Eén regel voor de tabel (`momentLabel`), de statuscontrole (`isTaskActualPastStatusDate`) en het
 * afmelden ({@link milestoneMomentOn}). Een gewone taak gebruikt deze regel niet.
 */
export function milestoneWorkdayOf(clock: DayClock, value: string, side: InstantSide): string {
  if (isDateOnly(value)) return value;
  if (!isInstant(value)) return '';
  const t = parseInstant(value).getTime();
  if (Number.isNaN(t)) return '';
  if (clock.kind === 'blocks') {
    // Een werkdag eindigt uiterlijk 2880 minuten na het begin van zijn datum (canonieke wrap-band), dus de
    // spanne die `t` bevat, hoort bij de datum van `t` of bij een van de twee datums ervoor.
    const day0 = utcDayIndex(t) * MS_PER_DAY;
    let best: { date: string; rank: number } | null = null;
    for (let k = 0; k >= -2; k--) {
      const date = formatDate(new Date(day0 + k * MS_PER_DAY));
      const start = dayStartInstant(clock, date);
      const end = dayEndInstant(clock, date);
      if (!start || !end) continue;
      const s = parseInstant(start).getTime();
      const e = parseInstant(end).getTime();
      if (t < s || t > e) continue;
      const ownEdge = side === 'start' ? t === s : t === e;
      const otherEdge = side === 'start' ? t === e : t === s;
      const rank = (ownEdge ? 0 : otherEdge ? 2 : 4) + (blocksOn(clock, date).length > 0 ? 0 : 1);
      if (!best || rank < best.rank) best = { date, rank };
    }
    if (best) return best.date;
  }
  return workdayOfInstant(clock, value, side);
}

/** De rand van werkdag `day` (D1 of D2, met D4) waarop moment `value` valt: `'start'`, `'end'`, of `null`
 *  als het moment op geen van beide randen valt. */
export function workdayEdgeAt(clock: DayClock, day: string, value: string): InstantSide | null {
  if (!isInstant(value)) return null;
  const t = parseInstant(value).getTime();
  const start = dayStartInstant(clock, day);
  const end = dayEndInstant(clock, day);
  if (end && parseInstant(end).getTime() === t) return 'end';
  if (start && parseInstant(start).getTime() === t) return 'start';
  return null;
}

/**
 * Het moment van een mijlpaal die met alleen een datum wordt afgemeld (besluit B10 van Ethan, 2026-10-29,
 * met de aanvulling "einde blijft einde" van later die dag). `planned` is het moment uit de planning,
 * `date` de getypte werkdag, `side` de kant van de soort ({@link milestoneWorkdayOf}).
 *
 *  1. Staat de mijlpaal op het begin of het einde van zijn werkdag, dan komt hij op hetzelfde begin of
 *     einde van de getypte dag. Voorbeeld: ma–do 07:00–16:00, vr 07:00–12:00, "Oplevering" op ma 16:00,
 *     afgemeld op vr ⇒ vr 12:00.
 *  2. Daartussen geldt de geplande kloktijd: dezelfde afstand tot middernacht van zijn werkdag. Voorbeeld:
 *     ma 10:00, afgemeld op wo ⇒ wo 10:00.
 *  3. Uitwerking door de orkestrator (niet letterlijk in het besluit): valt die kloktijd in de dienst van
 *     een andere werkdag, dan gaat "de dag komt van wat je typt" voor. Het moment komt dan op de rand van de
 *     getypte werkdag die het dichtst bij ligt. Voorbeeld: ma–do 22:00–06:00, vr 22:00–02:00, za 04:00–12:00;
 *     een mijlpaal op di 05:00 (midden in de nacht van ma), afgemeld op vr ⇒ za 05:00 valt in de dienst van
 *     za, dus het einde van vr: za 02:00. Valt de kloktijd niet in de dienst van een andere werkdag, dan
 *     blijft hij staan: dagkalender, ma 14:00, afgemeld op een vrijdag 07:00–12:00 ⇒ vr 14:00.
 *
 * Twee gevallen dekken het besluit en de uitwerking niet (gemeld in PR #724). Hier gaat ook "de dag komt
 * van wat je typt" voor, anders toont de tabel een andere dag en weigert de statuscontrole de statusdag:
 *  4. De kloktijd valt in geen dienst, maar op een andere klokdatum dan de getypte dag: de dichtstbijzijnde
 *     rand. Voorbeeld: ma–do 22:00–06:00, vr 22:00–02:00, weekend vrij; di 05:00 afgemeld op vr ⇒ za 05:00
 *     ligt na het einde van vr en hoort bij za; dus za 02:00.
 *  5. De rand van de getypte dag is ook een rand van de buurdag, en de soort leest hem als die buurdag: de
 *     andere rand van de getypte dag. Voorbeeld: 24 uur ma–do, vr 00:00–12:00; een START-mijlpaal op
 *     vr 12:00 (einde vr), afgemeld op ma ⇒ het einde van ma is di 00:00, en START leest dat als "di"; dus
 *     het begin van ma: ma 00:00.
 *
 * Kort: het moment uit 1 of 2 blijft staan als {@link milestoneWorkdayOf} er de getypte dag van maakt;
 * anders de rand van de getypte dag die het dichtst bij ligt en er wel bij hoort.
 *
 * `null` als een van beide waarden onleesbaar is, of als de getypte dag geen rand heeft.
 */
export function milestoneMomentOn(clock: DayClock, planned: string, date: string, side: InstantSide): string | null {
  if (!isInstant(planned) || !isDateOnly(date)) return null;
  const at = parseInstant(planned).getTime();
  const typedMs = parseDate(date).getTime();
  const plannedDay = milestoneWorkdayOf(clock, planned, side);
  if (Number.isNaN(at) || Number.isNaN(typedMs) || !plannedDay) return null;
  const start = dayStartInstant(clock, date);
  const end = dayEndInstant(clock, date);
  const edge = workdayEdgeAt(clock, plannedDay, planned);
  let candidates: (string | null)[];
  if (edge) {
    candidates = edge === 'end' ? [end, start] : [start, end];
  } else {
    const moment = formatInstant(new Date(typedMs + (at - parseDate(plannedDay).getTime())), 'hour');
    const t = parseInstant(moment).getTime();
    const distance = (edgeAt: string | null) => edgeAt ? Math.abs(parseInstant(edgeAt).getTime() - t) : Infinity;
    candidates = [moment, ...(distance(end) < distance(start) ? [end, start] : [start, end])];
  }
  return candidates.find(c => c !== null && milestoneWorkdayOf(clock, c, side) === date)
    ?? candidates.find(c => c !== null) ?? null;
}

/**
 * De werkdag van een moment (§0). Startkant: het werkblok `[begin, einde)` dat het moment bevat. Eindkant:
 * het werkblok `(begin, einde]`, zodat een eindmoment op een blokeinde bij dat blok hoort (nachtblok di
 * 22:00–wo 06:00, einde wo 06:00 ⇒ di). Buiten elk werkblok de klokdatum, met de 24:00-regel: een
 * eindmoment om 00:00 hoort bij de dag ervoor. Kalendertijd heeft geen blokken, alleen die regel.
 *
 * Een datum zonder tijd is al een werkdag en komt ongewijzigd terug. Onleesbare invoer geeft `''`.
 */
export function workdayOfInstant(clock: DayClock, value: string, side: InstantSide): string {
  if (isDateOnly(value)) return value;
  if (!isInstant(value)) return '';
  const t = parseInstant(value).getTime();
  if (Number.isNaN(t)) return '';
  return formatDate(workdayDateOfInstant(clock.kind === 'blocks' ? clock.engine : null, new Date(t), side));
}

/** Dezelfde werkdagbepaling voor de motor, zonder omzetting van Date naar tekst en terug.
 *  `null` als engine betekent kalendertijd; de eindkant houdt ook dan de 24:00-regel. */
export function workdayDateOfInstant(
  engine: Pick<CalendarEngine, 'effectiveBandsOn'> | null,
  instant: Date,
  side: InstantSide,
): Date {
  const t = instant.getTime();
  const day0 = utcDayIndex(t) * MS_PER_DAY;
  if (engine) {
    // Een werkblok mag tot 2880 minuten na het begin van zijn dag lopen (canonieke wrap-band), dus het
    // blok dat `t` bevat, begint op de dag van `t` of op een van de twee dagen ervoor.
    for (let k = 0; k >= -2; k--) {
      const dayMs = day0 + k * MS_PER_DAY;
      for (const band of engine.effectiveBandsOn(new Date(dayMs))) {
        const start = dayMs + band.start * MS_PER_MIN;
        const end = dayMs + band.end * MS_PER_MIN;
        const inside = side === 'start' ? start <= t && t < end : start < t && t <= end;
        if (inside) return new Date(dayMs);
      }
    }
  }
  if (side === 'end' && t === day0) return new Date(day0 - MS_PER_DAY);
  return new Date(day0);
}
