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
  const day0 = utcDayIndex(t) * MS_PER_DAY;
  if (clock.kind === 'blocks') {
    // Een werkblok mag tot 2880 minuten na het begin van zijn dag lopen (canonieke wrap-band), dus het
    // blok dat `t` bevat, begint op de dag van `t` of op een van de twee dagen ervoor.
    for (let k = 0; k >= -2; k--) {
      const dayMs = day0 + k * MS_PER_DAY;
      for (const band of clock.engine.effectiveBandsOn(new Date(dayMs))) {
        const start = dayMs + band.start * MS_PER_MIN;
        const end = dayMs + band.end * MS_PER_MIN;
        const inside = side === 'start' ? start <= t && t < end : start < t && t <= end;
        if (inside) return formatDate(new Date(dayMs));
      }
    }
  }
  if (side === 'end' && t === day0) return formatDate(new Date(day0 - MS_PER_DAY));
  return formatDate(new Date(day0));
}
