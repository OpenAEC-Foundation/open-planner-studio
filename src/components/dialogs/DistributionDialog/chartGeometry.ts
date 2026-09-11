// B1c-plan3 taak 11b / fixronde-2 bevinding B1 — de PURE geometrie van de voor/na-grafiek.
//
// WAAROM DIT EEN EIGEN MODULE IS. De grafiek stapelt ALLE documenten op elkaar; de fasestroken
// tekenen er juist één per rij. Dat zijn twee verschillende verticale schalen, en zolang de grafiek
// de schaal van de stroken leende viel het conflict letterlijk weg: bij twee documenten die elk 1
// boeken op een capaciteit van 1 is de stapelsom 2, terwijl de strookschaal op 1 blijft staan. De
// eerste staaf werd dan volle hoogte (`yOf` klemt op `Math.min(1, …)`) en de tweede zakte terug op
// de zichtbaarheidsbodem — precies het conflict dat de gebruiker naar deze dialoog bracht, door de
// schaal onzichtbaar gemaakt. `chartScaleMax` hieronder rekent daarom over de STAPELSOM per dag, en
// de fasestroken houden hun eigen, per-document `scaleMax`.
//
// PUUR, GEEN REACT, GEEN DOMEINTYPES. De capaciteit komt als functie binnen (`capacityOn`), niet als
// `Resource` — zo is deze module headless toetsbaar (`tests/planning/check-distribution-chart-scale.ts`)
// zonder de resource-laag mee te slepen, en kan de aanroeper gewoon dezelfde `maxUnitsOn` doorgeven
// die het bezettingsoverzicht ook hanteert (één conflictdefinitie, geen tweede).
import { DOC_PALETTE } from '@/utils/documents';
import type { OccupancyAxis } from '@/components/panels/occupancyAxis';

/** Verticale tekenmaten van één mini-histogram (viewBox-eenheden ≈ px). */
export const CHART_PLOT = {
  height: 72,
  padTop: 4,
};

/** Zichtbaarheidsbodem van een staaf: een kleine-maar-echte boeking mag niet op 0 px uitkomen.
 *  Dit is een BODEM, geen terugval — met een correcte `chartScaleMax` komt een staaf er alleen
 *  onder wanneer de boeking zelf verwaarloosbaar klein is tegenover de schaal. */
const MIN_BAR_HEIGHT = 0.5;

export interface ChartBar {
  key: string;
  docId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChartConflictDay {
  key: string;
  x: number;
}

export interface StackedChartGeometry {
  bars: ChartBar[];
  /** Dagen waarop de STAPELSOM strikt boven de capaciteit uitkomt — dezelfde conflictdefinitie als
   *  het bezettingsoverzicht, geen tweede. */
  conflictDays: ChartConflictDay[];
  /** Traplijn van de capaciteit, één pad per as-segment. */
  capPaths: string[];
  baselineY: number;
}

/** Alle kalenderdagen van de as, in tekenvolgorde. */
export function axisDays(axis: OccupancyAxis): string[] {
  const days: string[] = [];
  for (const segment of axis.segments) for (const iso of segment.days) days.push(iso);
  return days;
}

/**
 * De bovengrens van de verticale as van de VOOR- én NA-grafiek: het maximum over de as-dagen van
 * de capaciteit, de gestapelde VOOR-som en de gestapelde NA-som. Beide standen delen die ene waarde,
 * anders zijn de twee grafieken niet vergelijkbaar.
 *
 * De som loopt over ALLE documenten samen — dat is precies het verschil met de per-document-schaal
 * van de fasestroken, en de reden dat een conflict hier niet meer wegvalt. Gepinde documenten zitten
 * gewoon in `bookingByDay`/`afterLoadByDay`, dus een pin verandert de stapelsom niet en dus ook deze
 * schaal niet: de grafiek ziet er met en zonder pin hetzelfde uit.
 *
 * Ondergrens 1: een lege of verwaarloosbare grafiek mag niet door bijna-nul delen.
 */
export function chartScaleMax(
  axis: OccupancyAxis,
  capacityOn: (iso: string) => number,
  loadsByDoc: Record<string, Record<string, number>>[],
): number {
  let max = 1;
  for (const iso of axisDays(axis)) {
    const capacity = capacityOn(iso);
    if (capacity > max) max = capacity;
    for (const loadByDoc of loadsByDoc) {
      let stacked = 0;
      for (const perDay of Object.values(loadByDoc)) stacked += perDay[iso] ?? 0;
      if (stacked > max) max = stacked;
    }
  }
  return max;
}

/**
 * De geometrie van ÉÉN gestapeld histogram (VOOR of NA) op de gedeelde `axis`. Aangeroepen voor
 * beide standen met dezelfde `docsOrder` en dezelfde `scaleMax`, zodat de twee per constructie
 * vergelijkbaar zijn.
 */
export function buildStackedChart(
  axis: OccupancyAxis,
  capacityOn: (iso: string) => number,
  loadByDoc: Record<string, Record<string, number>>,
  docsOrder: string[],
  scaleMax: number,
): StackedChartGeometry {
  const yOf = (units: number) =>
    CHART_PLOT.padTop + CHART_PLOT.height * (1 - Math.min(1, Math.max(0, units) / Math.max(0.01, scaleMax)));
  const bars: ChartBar[] = [];
  const conflictDays: ChartConflictDay[] = [];
  const capPaths: string[] = [];

  for (const segment of axis.segments) {
    let capPath = '';
    let prevCap: number | null = null;
    for (let i = 0; i < segment.days.length; i++) {
      const iso = segment.days[i];
      const x = segment.x0 + i * axis.dayWidth;

      let acc = 0;
      for (const docId of docsOrder) {
        const units = loadByDoc[docId]?.[iso] ?? 0;
        if (units <= 0) continue;
        const y0 = yOf(acc);
        acc += units;
        const y1 = yOf(acc);
        bars.push({
          key: `${iso}-${docId}`,
          docId,
          x: x + 0.5,
          y: y1,
          w: Math.max(1, axis.dayWidth - 1),
          h: Math.max(MIN_BAR_HEIGHT, y0 - y1),
        });
      }

      const cap = capacityOn(iso);
      if (acc > cap) conflictDays.push({ key: iso, x });

      const y = yOf(cap);
      if (prevCap === null) capPath += `M ${x} ${y}`;
      else if (cap !== prevCap) capPath += ` L ${x} ${y}`;
      capPath += ` L ${x + axis.dayWidth} ${y}`;
      prevCap = cap;
    }
    capPaths.push(capPath);
  }

  return { bars, conflictDays, capPaths, baselineY: yOf(0) };
}

/** Stabiele, onderling onderscheidbare kleur per document — dezelfde toewijzingslogica
 *  (eerste-gezien-volgorde over `DOC_PALETTE`) als `ResourceOccupancyView.tsx`s `docColors`, hier
 *  toegepast op de RANGORDE van de verdeeldialoog. De dialoog berekent dit één keer en geeft het
 *  door aan zowel de fasestroken als de grafiek, zodat een document daar écht dezelfde kleur heeft
 *  (fixronde-2 bevinding B9). */
export function assignDocColors(docIds: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const docId of docIds) {
    if (!colors.has(docId)) colors.set(docId, DOC_PALETTE[colors.size % DOC_PALETTE.length]);
  }
  return colors;
}
