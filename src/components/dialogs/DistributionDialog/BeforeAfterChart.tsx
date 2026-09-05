// B1c-plan3 taak 11b — de voor/na-preview van de verdeeldialoog (spec §7).
//
// Twee gestapelde histogrammen, VOOR (`proposal.bookingByDay`) boven NA (`proposal.afterLoadByDay`),
// op de GEDEELDE tijdas (`occupancyAxis.ts` — dezelfde instantie als de fasestroken erboven, zodat
// een strook en de grafiek per constructie op dezelfde x-posities uitkomen; spec §7 wil één as voor
// stroken én grafiek, geen tweede berekening). De geometrie hieronder is een kleine, eigen kopie van
// wat `ResourceOccupancyView.tsx`s `OccupancyHistogram` doet (gestapelde staven per document,
// capaciteits-traplijn via `maxUnitsOn`, conflictband) — bewust GEEN gedeelde afhankelijkheid tussen
// de twee: die histogram-memo zit vast aan zijn EIGEN as-opbouw (gatcompressie, datumlabels) en heeft
// hier geen weerslag; een kleine, eigen versie is goedkoper dan een generieke component ervoor.
//
// CONFLICTDEFINITIE (ongewijzigd t.o.v. het bezettingsoverzicht): som van de boeking over alle
// documenten op een dag STRIKT GROTER dan `maxUnitsOn(poolItem, dag)` — geen tweede definitie. Voor
// de VOOR-stand is dat vrijwel altijd de bron van het conflict dat de gebruiker naar deze dialoog
// bracht; voor de NA-stand hoort er GEEN enkele conflictdag meer te zijn (dat is precies wat
// `computeDistribution` garandeert: `residualOn` blijft altijd ≥ 0) — behalve wanneer de motor een
// taak niet kon plaatsen (`afterIncomplete`): haar vraag staat dan NERGENS in `afterLoadByDay`, dus
// de na-som onderschat de werkelijke behoefte. Daarom een aparte, expliciete tekortmarkering bij de
// na-grafiek in plaats van een (foutieve) conflictband.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Resource } from '@/types/resource';
import { maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { DOC_PALETTE } from '@/utils/documents';
import { AXIS, type OccupancyAxis } from '@/components/panels/occupancyAxis';

const CHART = {
  plotHeight: 72,
  padTop: 4,
  padLeft: AXIS.padLeft,
  padRight: AXIS.padRight,
};

export interface BeforeAfterChartDoc {
  docId: string;
  title: string;
}

export interface BeforeAfterChartShortfall {
  docId: string;
  title: string;
  count: number;
}

export interface BeforeAfterChartProps {
  poolItem: Resource;
  /** De GEDEELDE as — dezelfde instantie als de fasestroken erboven; `null` ⇒ niets te tekenen. */
  axis: OccupancyAxis | null;
  /** Bovengrens van de verticale as, gedeeld tussen VOOR en NA zodat de twee grafieken echt
   *  vergelijkbaar zijn (dezelfde schaal die de dialoog al voor de fasestroken berekent). */
  scaleMax: number;
  /** Alle documenten die op dit poolitem boeken, in RANGORDE — zelfde volgorde en zelfde docId's als
   *  de fasestroken erboven, zodat de documentkleur overal hetzelfde is. */
  docs: BeforeAfterChartDoc[];
  /** `DistributionProposal.bookingByDay` — de VOOR-stand, letterlijk het grootboek. */
  bookingByDay: Record<string, Record<string, number>>;
  /** `DistributionProposal.afterLoadByDay` — de NA-stand, dezelfde boekhouding. */
  afterLoadByDay: Record<string, Record<string, number>>;
  /** `DistributionProposal.afterIncomplete` — minstens één taak kon niet geplaatst worden. */
  afterIncomplete: boolean;
  /** Per document met een tekort: hoeveel taken er niet pasten (`DistributionDocResult.shortfalls`). */
  shortfallDocs: BeforeAfterChartShortfall[];
}

/** Stabiele, onderling onderscheidbare kleur per document — dezelfde toewijzingslogica (eerste-
 *  gezien-volgorde over `DOC_PALETTE`) als `ResourceOccupancyView.tsx`s `docColors`, hier opnieuw
 *  toegepast op de rangorde van DEZE dialoog zodat strook en grafiek altijd matchen. */
function assignDocColors(docIds: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const docId of docIds) {
    if (!colors.has(docId)) colors.set(docId, DOC_PALETTE[colors.size % DOC_PALETTE.length]);
  }
  return colors;
}

interface StackedChart {
  bars: { key: string; x: number; y: number; w: number; h: number; fill: string }[];
  conflictDays: { key: string; x: number }[];
  capPaths: string[];
  baselineY: number;
}

/** Bouwt de geometrie van ÉÉN gestapeld histogram (VOOR of NA) op de gedeelde `axis`. Puur — geen
 *  React, geen state; aangeroepen voor beide standen met dezelfde `docsOrder`/`docColors`/`scaleMax`
 *  zodat de twee grafieken per constructie vergelijkbaar zijn. */
function buildStack(
  axis: OccupancyAxis,
  poolItem: Resource,
  loadByDoc: Map<string, Record<string, number>>,
  docsOrder: string[],
  docColors: Map<string, string>,
  scaleMax: number,
): StackedChart {
  const yOf = (units: number) =>
    CHART.padTop + CHART.plotHeight * (1 - Math.min(1, Math.max(0, units) / Math.max(0.01, scaleMax)));
  const bars: StackedChart['bars'] = [];
  const conflictDays: StackedChart['conflictDays'] = [];
  const capPaths: string[] = [];

  for (const segment of axis.segments) {
    let capPath = '';
    let prevCap: number | null = null;
    for (let i = 0; i < segment.days.length; i++) {
      const iso = segment.days[i];
      const x = segment.x0 + i * axis.dayWidth;

      let acc = 0;
      for (const docId of docsOrder) {
        const units = loadByDoc.get(docId)?.[iso] ?? 0;
        if (units <= 0) continue;
        const y0 = yOf(acc);
        acc += units;
        const y1 = yOf(acc);
        bars.push({
          key: `${iso}-${docId}`,
          x: x + 0.5,
          y: y1,
          w: Math.max(1, axis.dayWidth - 1),
          h: Math.max(0.5, y0 - y1),
          fill: docColors.get(docId) ?? DOC_PALETTE[0],
        });
      }

      // Conflictdefinitie (moduleblok hierboven): som STRIKT GROTER dan de capaciteit — géén tweede
      // definitie t.o.v. het bezettingsoverzicht.
      const cap = maxUnitsOn(poolItem, iso);
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

/** Eén van de twee gestapelde histogrammen (VOOR of NA), inclusief het `data-ops-distribution-
 *  chart-before`/`-after`-anker dat de browsertest gebruikt. */
function MiniHistogram({
  kind, label, axis, chart, width,
}: {
  kind: 'before' | 'after';
  label: string;
  axis: OccupancyAxis;
  chart: StackedChart;
  width: number;
}) {
  const height = CHART.padTop + CHART.plotHeight;
  return (
    <div
      className="flex flex-col gap-1"
      {...(kind === 'before' ? { 'data-ops-distribution-chart-before': '' } : { 'data-ops-distribution-chart-after': '' })}
    >
      <span className="text-[10px] text-text-secondary">{label}</span>
      {/* Geforceerd LTR, net als het bezettingshistogram en de fasestroken: een tijdas spiegelt
          nergens in dit product. */}
      <div className="overflow-x-auto" dir="ltr" style={{ direction: 'ltr' }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={label}
          style={{ display: 'block' }}
        >
          {chart.conflictDays.map(r => (
            <rect
              key={`c-${r.key}`}
              x={r.x}
              y={CHART.padTop}
              width={axis.dayWidth}
              height={CHART.plotHeight}
              fill="var(--error)"
              opacity={0.16}
              data-ops-conflict-day
            />
          ))}
          {chart.bars.map(b => (
            <rect key={b.key} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill} />
          ))}
          <line
            x1={CHART.padLeft} y1={chart.baselineY} x2={width - CHART.padRight} y2={chart.baselineY}
            stroke="var(--theme-border)" strokeWidth={1}
          />
          {chart.capPaths.map((d, i) => (
            <path key={`cap-${i}`} d={d} fill="none" stroke="var(--theme-text-dim)" strokeWidth={1.5} strokeDasharray="5 3" />
          ))}
          {axis.breaks.map((x, i) => (
            <text key={`b-${i}`} x={x} y={CHART.padTop + CHART.plotHeight / 2} textAnchor="middle" fontSize={11} fill="var(--theme-text-muted)">⋯</text>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function BeforeAfterChart({
  poolItem, axis, scaleMax, docs, bookingByDay, afterLoadByDay, afterIncomplete, shortfallDocs,
}: BeforeAfterChartProps) {
  const { t } = useTranslation('common');

  const docColors = useMemo(() => assignDocColors(docs.map(d => d.docId)), [docs]);
  const docIds = useMemo(() => docs.map(d => d.docId), [docs]);

  const charts = useMemo(() => {
    if (axis === null) return null;
    const before = buildStack(axis, poolItem, new Map(Object.entries(bookingByDay)), docIds, docColors, scaleMax);
    const after = buildStack(axis, poolItem, new Map(Object.entries(afterLoadByDay)), docIds, docColors, scaleMax);
    return { before, after };
  }, [axis, poolItem, bookingByDay, afterLoadByDay, docIds, docColors, scaleMax]);

  if (axis === null || charts === null) {
    return (
      <div className="text-text-secondary" data-ops-distribution-preview>
        {t('resource.distribution.preview.before')} / {t('resource.distribution.preview.after')} / {t('resource.distribution.preview.capacity')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-ops-distribution-preview>
      <MiniHistogram
        kind="before"
        label={t('resource.distribution.preview.before')}
        axis={axis}
        chart={charts.before}
        width={axis.width}
      />
      <MiniHistogram
        kind="after"
        label={t('resource.distribution.preview.after')}
        axis={axis}
        chart={charts.after}
        width={axis.width}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {docs.map(doc => (
          <span key={doc.docId} className="inline-flex items-center gap-1.5 min-w-0">
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: docColors.get(doc.docId) }} aria-hidden />
            <span className="truncate text-[10px] text-text-secondary">{doc.title}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <svg width={18} height={8} aria-hidden><line x1={0} y1={4} x2={18} y2={4} stroke="var(--theme-text-dim)" strokeWidth={1.5} strokeDasharray="5 3" /></svg>
          <span className="text-[10px] text-text-secondary">{t('resource.distribution.preview.capacity')}</span>
        </span>
      </div>
      {/* NA-onvolledigheid (moduleblok hierboven): de na-balken missen de vraag van niet-geplaatste
          taken — dat moet bij de na-grafiek zelf staan, niet alleen in het aparte tekortblok
          onderaan de dialoog, anders leest een lezer de na-stand als "opgelost". */}
      {afterIncomplete && (
        <div className="flex flex-col gap-0.5" data-ops-distribution-preview-shortfall>
          <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
            {t('resource.distribution.shortfall.title')}
          </span>
          {shortfallDocs.map(doc => (
            <span key={doc.docId} style={{ color: 'var(--error)' }}>
              {t('resource.distribution.shortfall.doc', { doc: doc.title, count: doc.count })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
