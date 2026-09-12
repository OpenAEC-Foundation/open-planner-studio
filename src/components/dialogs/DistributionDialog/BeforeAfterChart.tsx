// B1c-plan3 taak 11b — de voor/na-preview van de verdeeldialoog (spec §7).
//
// Twee gestapelde histogrammen, VOOR (`proposal.bookingByDay`) boven NA (`proposal.afterLoadByDay`),
// op de GEDEELDE tijdas (`occupancyAxis.ts` — dezelfde as-INSTANTIE als de fasestroken erboven, die
// de dialoog één keer bouwt; spec §7 wil één as voor stroken én grafiek, geen tweede berekening).
// De geometrie zelf staat in `chartGeometry.ts` (puur, headless getoetst) en is een kleine, eigen
// variant van wat `ResourceOccupancyView.tsx`s `OccupancyHistogram` doet (gestapelde staven per
// document, capaciteits-traplijn via `maxUnitsOn`, conflictband) — bewust GEEN gedeelde
// afhankelijkheid tussen de twee: die histogram-memo zit vast aan zijn EIGEN as-opbouw
// (gatcompressie, datumlabels) en heeft hier geen weerslag.
//
// DE VERTICALE SCHAAL IS EEN EIGEN SCHAAL (fixronde-2 bevinding B1). Deze grafiek STAPELT alle
// documenten; de fasestroken tekenen er één per rij. Leende de grafiek de strookschaal, dan viel de
// stapelsom boven de schaal en werd het conflict onzichtbaar. `chartScaleMax` rekent daarom over de
// stapelsom van VOOR én NA plus de capaciteit; `PhaseStrip` houdt zijn eigen `scaleMax`.
//
// CONFLICTDEFINITIE (ongewijzigd t.o.v. het bezettingsoverzicht): som van de boeking over alle
// documenten op een dag STRIKT GROTER dan `maxUnitsOn(poolItem, dag)` — geen tweede definitie. Voor
// de VOOR-stand is dat vrijwel altijd de bron van het conflict dat de gebruiker naar deze dialoog
// bracht; voor de NA-stand hoort er GEEN enkele conflictdag meer te zijn (dat is precies wat
// `computeDistribution` garandeert: `residualOn` blijft altijd ≥ 0) — behalve wanneer de motor een
// taak niet kon plaatsen (`afterIncomplete`): haar vraag staat dan NERGENS in `afterLoadByDay`, dus
// de na-som onderschat de werkelijke behoefte. Daarom een aparte, expliciete tekortmarkering bij de
// na-grafiek in plaats van een (foutieve) conflictband.
//
// DE CONFLICTBAND WORDT NA DE STAVEN GETEKEND (fixronde-2 bevinding B1). Ervóór schilderde een volle
// staaf de band gewoon dicht. Nu ligt de band als transparante wassing mét omranding bovenop — een
// conflictdag blijft dus herkenbaar, hoe hoog de staven er ook staan.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Resource } from '@/types/resource';
import { maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { DOC_PALETTE } from '@/utils/documents';
import { AXIS, type OccupancyAxis } from '@/components/panels/occupancyAxis';
import {
  CHART_PLOT, buildStackedChart, chartScaleMax, type StackedChartGeometry,
} from './chartGeometry';

const CHART = {
  plotHeight: CHART_PLOT.height,
  padTop: CHART_PLOT.padTop,
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
  /** Alle documenten die op dit poolitem boeken, in RANGORDE — zelfde volgorde en zelfde docId's als
   *  de fasestroken erboven. */
  docs: BeforeAfterChartDoc[];
  /** docId → kleur, door de dialoog bepaald en gedeeld met de fasestroken. */
  docColors: Map<string, string>;
  /** `DistributionProposal.bookingByDay` — de VOOR-stand, letterlijk het grootboek. */
  bookingByDay: Record<string, Record<string, number>>;
  /** `DistributionProposal.afterLoadByDay` — de NA-stand, dezelfde boekhouding. */
  afterLoadByDay: Record<string, Record<string, number>>;
  /** `DistributionProposal.afterIncomplete` — minstens één taak kon niet geplaatst worden. */
  afterIncomplete: boolean;
  /** Per document met een tekort: hoeveel taken er niet pasten (`DistributionDocResult.shortfalls`). */
  shortfallDocs: BeforeAfterChartShortfall[];
}

/** Eén van de twee gestapelde histogrammen (VOOR of NA), inclusief het `data-ops-distribution-
 *  chart-before`/`-after`-anker dat de browsertest gebruikt. */
function MiniHistogram({
  kind, label, axis, chart, width, docColors,
}: {
  kind: 'before' | 'after';
  label: string;
  axis: OccupancyAxis;
  chart: StackedChartGeometry;
  width: number;
  docColors: Map<string, string>;
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
          {chart.bars.map(b => (
            <rect
              key={b.key}
              x={b.x} y={b.y} width={b.w} height={b.h}
              fill={docColors.get(b.docId) ?? DOC_PALETTE[0]}
              data-ops-doc-id={b.docId}
            />
          ))}
          <line
            x1={CHART.padLeft} y1={chart.baselineY} x2={width - CHART.padRight} y2={chart.baselineY}
            stroke="var(--theme-border)" strokeWidth={1}
          />
          {chart.capPaths.map((d, i) => (
            <path key={`cap-${i}`} d={d} fill="none" stroke="var(--theme-text-dim)" strokeWidth={1.5} strokeDasharray="5 3" />
          ))}
          {/* NA de staven (zie het moduleblok): een volle staaf mag de conflictmarkering niet
              overschilderen. Wassing + omranding, zodat de band ook bovenop kleur leesbaar blijft. */}
          {chart.conflictDays.map(r => (
            <rect
              key={`c-${r.key}`}
              x={r.x + 0.5}
              y={CHART.padTop + 0.5}
              width={Math.max(1, axis.dayWidth - 1)}
              height={CHART.plotHeight - 1}
              fill="var(--error)"
              fillOpacity={0.16}
              stroke="var(--error)"
              strokeOpacity={0.8}
              strokeWidth={1}
              data-ops-conflict-day
            />
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
  poolItem, axis, docs, docColors, bookingByDay, afterLoadByDay, afterIncomplete, shortfallDocs,
}: BeforeAfterChartProps) {
  const { t } = useTranslation('common');

  const docIds = useMemo(() => docs.map(d => d.docId), [docs]);

  const charts = useMemo(() => {
    if (axis === null) return null;
    const capacityOn = (iso: string) => maxUnitsOn(poolItem, iso);
    // Eén schaal voor beide standen, over de STAPELSOM — zie het moduleblok (bevinding B1).
    const scaleMax = chartScaleMax(axis, capacityOn, [bookingByDay, afterLoadByDay]);
    const before = buildStackedChart(axis, capacityOn, bookingByDay, docIds, scaleMax);
    const after = buildStackedChart(axis, capacityOn, afterLoadByDay, docIds, scaleMax);
    return { before, after };
  }, [axis, poolItem, bookingByDay, afterLoadByDay, docIds]);

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
        docColors={docColors}
      />
      <MiniHistogram
        kind="after"
        label={t('resource.distribution.preview.after')}
        axis={axis}
        chart={charts.after}
        width={axis.width}
        docColors={docColors}
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
