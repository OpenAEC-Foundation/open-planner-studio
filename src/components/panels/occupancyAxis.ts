// B1c-plan3 taak 9 — de GEDEELDE tijdas van het bezettingsoverzicht en de verdeeldialoog.
//
// Deze module is LETTERLIJK de as-opbouw die tot nu toe binnen `OccupancyHistogram`s memo stond
// (`ResourceOccupancyView.tsx`, §5a): domein → gatcompressie → dagbreedte → segmenten/breuken.
// Er is bewust geen gedragswijziging bij de verhuizing: het histogram roept nu dezelfde code aan
// die de fasestroken van de verdeeldialoog gebruiken, zodat een strook en het histogram eronder
// per constructie op dezelfde x-posities uitkomen. Een tweede, handgeschreven as in de dialoog zou
// daar stilzwijgend van kunnen afwijken.
//
// PUUR, GEEN REACT. De aanroeper bepaalt zelf wat er ín die as getekend wordt (staven, banden,
// handles) en hoe hoog de plot is; deze module kent alleen de horizontale indeling.
import { parseDate, formatDate, addCalendarDays, diffDays } from '@/utils/dateUtils';

/** Horizontale tekenmaten van de as (viewBox-eenheden ≈ px). Verticale maten horen bij de
 *  aanroeper — het histogram is 130 hoog, een fasestrook een fractie daarvan. */
export const AXIS = {
  padLeft: 34,      // ruimte links voor de y-as-waarden van het histogram
  padRight: 8,
  minDayWidth: 4,
  maxDayWidth: 16,
  targetWidth: 760, // richtbreedte; meer dagen ⇒ breder (scroll), minder ⇒ bredere staven
  breakWidth: 14,   // breedte van de "⋯"-breukmarkering tussen segmenten
};

/** Gaten langer dan dit aantal kalenderdagen zonder enige boeking worden ingeklapt (§5a). */
export const GAP_COMPRESS_DAYS = 30;

export interface OccupancyAxisSegment {
  /** Alle kalenderdagen van het segment (granulariteit één dag, incl. boekingsloze dagen). */
  days: string[];
  /** x-positie (viewBox) van de eerste dag. */
  x0: number;
}

export interface OccupancyAxis {
  segments: OccupancyAxisSegment[];
  /** x-middens van de breukmarkeringen tussen de segmenten. */
  breaks: number[];
  dayWidth: number;
  width: number;
  /** x-positie van de LINKERrand van die dag, of `null` wanneer de dag buiten het domein valt of
   *  in een ingeklapt gat verdwenen is. */
  xOf(iso: string): number | null;
}

/** Alle ISO-kalenderdagen van `from` t/m `to` (inclusief). */
export function expandDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = parseDate(from); ; d = addCalendarDays(d, 1)) {
    const iso = formatDate(d);
    if (iso > to) break;
    days.push(iso);
  }
  return days;
}

/**
 * Bouw de tijdas over `bookedDays` (de dagen die er echt toe doen; volgorde en duplicaten maken
 * niet uit). Een aaneengesloten gat van meer dan `GAP_COMPRESS_DAYS` kalenderdagen zonder boeking
 * breekt het domein in twee segmenten; binnen een segment blijft de granulariteit één kalenderdag,
 * zodat de tijd daar proportioneel blijft.
 *
 * Geeft `null` wanneer er geen enkele dag is — de aanroeper toont dan zijn eigen lege toestand.
 */
export function buildOccupancyAxis(
  bookedDays: string[],
  opts?: { targetWidth?: number },
): OccupancyAxis | null {
  const sortedBooked = [...new Set(bookedDays)].sort();
  if (sortedBooked.length === 0) return null;

  // Gatcompressie: `diffDays(prev, iso) - 1` is precies de lengte van het gat (opeenvolgende
  // dagen ⇒ 0).
  const ranges: { from: string; to: string }[] = [];
  let from = sortedBooked[0];
  let prev = from;
  for (let i = 1; i < sortedBooked.length; i++) {
    const iso = sortedBooked[i];
    if (diffDays(prev, iso) - 1 > GAP_COMPRESS_DAYS) {
      ranges.push({ from, to: prev });
      from = iso;
    }
    prev = iso;
  }
  ranges.push({ from, to: prev });

  const totalDays = ranges.reduce((n, r) => n + diffDays(r.from, r.to) + 1, 0);
  const dayWidth = Math.max(
    AXIS.minDayWidth,
    Math.min(AXIS.maxDayWidth, Math.floor((opts?.targetWidth ?? AXIS.targetWidth) / totalDays)),
  );

  const segments: OccupancyAxisSegment[] = [];
  const breaks: number[] = [];
  let cursor = AXIS.padLeft;
  for (const range of ranges) {
    if (segments.length > 0) {
      breaks.push(cursor + AXIS.breakWidth / 2);
      cursor += AXIS.breakWidth;
    }
    const days = expandDays(range.from, range.to);
    segments.push({ days, x0: cursor });
    cursor += days.length * dayWidth;
  }
  const width = cursor + AXIS.padRight;

  const xByIso = new Map<string, number>();
  for (const segment of segments) {
    for (let i = 0; i < segment.days.length; i++) xByIso.set(segment.days[i], segment.x0 + i * dayWidth);
  }

  return {
    segments,
    breaks,
    dayWidth,
    width,
    xOf: (iso: string) => xByIso.get(iso) ?? null,
  };
}
