// Kalender-generator-pad + meng-semantiek voor de kalendertools (`calendarResourceTools.ts`). Pure
// servicelaag: géén store-mutaties, geen snapshot, geen recompute.
//
// Meng-semantiek (bindend):
//   (a) alleen `generate`                    ⇒ holidays = materializeHolidays over de span uit
//                                              computeGenerateSpan; generation-metadata gezet;
//                                              becameLiteral=false.
//   (b) `generate` + `rawHolidays`           ⇒ generator-basis + rauwe uitzonderingen samengevoegd
//                                              (dedup op datumbereik); generation WEGGELATEN;
//                                              becameLiteral=true — de kalender is voortaan letterlijk.
//   (c) alleen `rawHolidays` op een kalender ⇒ bestaande holidays behouden + raw toegevoegd;
//        MÉT generation                        generation vervalt; becameLiteral=true.
//   (d) alleen `rawHolidays` op een kalender ⇒ gewoon mergen; becameLiteral=false (er viel niets
//        ZÓNDER generation                      te verliezen).
//
// De divergentie t.o.v. de kalenderdialoog is bedoeld: de regenerate-knop daar vervangt de
// holidays-lijst volledig, dus zou rauwe dagen wegvagen. Deze tool wist daarom `generation` zodra er
// rauwe dagen bijkomen — dan is er geen regenerate meer die iets kan wegvagen.

import {
  materializeHolidays,
  computeGenerateSpan,
  type HolidayGenParams,
} from '@/engine/calendar/generateCalendarHolidays';
import type { Holiday, WorkCalendar } from '@/types/calendar';

export interface CalendarHolidayInput {
  /** 1-op-1 het echte generator-type (land/regio/bouwvak); afwezig ⇒ geen generator-basis. */
  generate?: HolidayGenParams;
  /** Extra letterlijke uitzonderingen (bijv. vorstverletdagen). */
  rawHolidays?: Holiday[];
}

export interface CalendarHolidayResult {
  holidays: Holiday[];
  /** Alleen gezet als puur generator-gevoed (geval a); anders weggelaten. */
  generation?: WorkCalendar['generation'];
  /** true zodra `rawHolidays` de generation deed vervallen (gevallen b en c). */
  becameLiteral: boolean;
}

/** Dedup-sleutel = het datumbereik (start+eind). Twee uitzonderingen met hetzelfde bereik zijn één. */
const rangeKey = (h: Holiday): string => `${h.startDate}|${h.endDate}`;

/**
 * Voeg twee holiday-lijsten samen, gededupliceerd op datumbereik (eerste voorkomen wint, zodat de
 * `base`-naam behouden blijft bij overlap), en sorteer canoniek op startdatum — gelijk aan de
 * sortering die `materializeHolidays` zelf toepast.
 */
function dedupMerge(base: Holiday[], extra: Holiday[]): Holiday[] {
  const seen = new Set<string>();
  const out: Holiday[] = [];
  for (const h of [...base, ...extra]) {
    const key = rangeKey(h);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  out.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return out;
}

/**
 * Los de definitieve holiday-lijst + generation-status op voor een kalender-mutatie. Pure functie —
 * muteert `input`/`existing` niet en raakt de store niet aan.
 */
export function resolveCalendarHolidays(
  input: CalendarHolidayInput,
  span: { projectStart: string; projectEnd: string },
  existing?: Pick<WorkCalendar, 'holidays' | 'generation'>,
): CalendarHolidayResult {
  const hasRaw = (input.rawHolidays?.length ?? 0) > 0;
  const rawHolidays = input.rawHolidays ?? [];

  if (input.generate) {
    const { from, to } = computeGenerateSpan(span.projectStart, span.projectEnd);
    const mat = materializeHolidays(input.generate, from, to);
    if (hasRaw) {
      // (b) generator-basis + rauwe uitzonderingen ⇒ letterlijk, generation weg.
      return {
        holidays: dedupMerge(mat.holidays, rawHolidays),
        becameLiteral: true,
      };
    }
    // (a) zuiver generator-pad ⇒ generation-metadata behouden (kan undefined zijn bij country 'none').
    return {
      holidays: mat.holidays,
      generation: mat.generation,
      becameLiteral: false,
    };
  }

  // Geen generator-basis: begin bij de bestaande (letterlijke of gegenereerde) holidays.
  const base = existing?.holidays ?? [];
  if (hasRaw) {
    const hadGeneration = existing?.generation != null;
    // (c) bestaande generation vervalt door rauwe toevoeging; (d) niets te verliezen.
    return {
      holidays: dedupMerge(base, rawHolidays),
      becameLiteral: hadGeneration,
    };
  }

  // Degeneraat: geen generate, geen raw ⇒ no-op, behoud wat er was (incl. eventuele generation).
  return {
    holidays: base,
    generation: existing?.generation,
    becameLiteral: false,
  };
}
