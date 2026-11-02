import { useMemo } from 'react';
import {
  CURVE_BAND_OPACITY, CURVE_CHART_HEIGHT, CURVE_CHART_WIDTH, type CurveChartSpec, type Pt,
  curveLegendItems, layoutCurveChart,
} from '@/services/pdf/pdfCurveChart';

/**
 * DOM-weergave van de curvegrafiek: dezelfde ligging (`layoutCurveChart`) als de PDF, als SVG.
 * Raster, assen en tekst volgen het thema (CSS-variabelen); de lijnkleuren komen uit de spec en zijn
 * dezelfde als in de PDF. De band krijgt doorzichtigheid, zodat hij in licht én donker leest.
 */
const path = (pts: readonly Pt[], close = false) =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + (close ? ' Z' : '');

export function CurveChartView({ spec }: { spec: CurveChartSpec }) {
  const layout = useMemo(() => layoutCurveChart(spec), [spec]);
  const { plot, band } = layout;
  const legend = curveLegendItems(spec);
  return (
    <div data-ops-report-chart>
      <svg
        viewBox={`0 0 ${CURVE_CHART_WIDTH} ${CURVE_CHART_HEIGHT}`}
        width="100%"
        style={{ maxWidth: CURVE_CHART_WIDTH, display: 'block' }}
        role="img"
        aria-label={spec.ariaLabel}
      >
        {layout.yTicks.map((t, i) => (
          <g key={i}>
            <line x1={plot.x} x2={plot.x + plot.w} y1={t.y} y2={t.y} stroke="var(--theme-border-light)" strokeWidth={1} />
            <text x={plot.x - 6} y={t.y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--theme-text-muted)">{t.label}</text>
          </g>
        ))}
        {band && (
          <g data-ops-chart-band>
            <path d={path(band.polygon, true)} fill={band.color} fillOpacity={CURVE_BAND_OPACITY} stroke="none" />
            {band.edges.map((edge, i) => (
              <path key={i} d={path(edge)} fill="none" stroke={band.color} strokeWidth={1} strokeLinejoin="round" />
            ))}
          </g>
        )}
        <line x1={plot.x} x2={plot.x + plot.w} y1={plot.y + plot.h} y2={plot.y + plot.h} stroke="var(--theme-border)" strokeWidth={1} />
        {layout.xTicks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={plot.y + plot.h} y2={plot.y + plot.h + 4} stroke="var(--theme-border)" strokeWidth={1} />
            <text x={t.x} y={plot.y + plot.h + 14} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="var(--theme-text-muted)">{t.label}</text>
          </g>
        ))}
        {layout.lines.map(l => (
          <path
            key={l.key}
            d={path(l.pts)}
            fill="none"
            stroke={l.color}
            strokeWidth={2}
            strokeDasharray={l.dashed ? '6 4' : undefined}
            strokeLinejoin="round"
            data-ops-chart-series={l.key}
          />
        ))}
        {layout.marker && (
          <g data-ops-chart-marker>
            <line x1={layout.marker.x} x2={layout.marker.x} y1={plot.y - 4} y2={plot.y + plot.h} stroke={layout.marker.color} strokeWidth={1.5} strokeDasharray="3 3" />
            <text
              x={layout.marker.x + (layout.marker.labelAlign === 'left' ? 4 : -4)}
              y={plot.y - 12}
              textAnchor={layout.marker.labelAlign === 'left' ? 'start' : 'end'}
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={600}
              fill={layout.marker.color}
            >
              {layout.marker.label}
            </text>
          </g>
        )}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-small leading-4 mt-1" style={{ color: 'var(--theme-text)' }} data-ops-chart-legend>
        {legend.map(item => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <svg width={18} height={14} aria-hidden="true">
              {item.kind === 'band' ? (
                <rect x={0} y={2} width={18} height={10} fill={item.color} fillOpacity={CURVE_BAND_OPACITY * 2} />
              ) : item.kind === 'marker' ? (
                <line x1={9} x2={9} y1={0} y2={14} stroke={item.color} strokeWidth={1.5} strokeDasharray="3 3" />
              ) : (
                <line x1={0} x2={18} y1={7} y2={7} stroke={item.color} strokeWidth={2} strokeDasharray={item.kind === 'dashed' ? '5 3' : undefined} />
              )}
            </svg>
            {item.label}
          </span>
        ))}
      </div>
      {spec.footnote && (
        <div className="text-small leading-4 mt-1" style={{ color: 'var(--theme-text-muted)' }}>{spec.footnote}</div>
      )}
    </div>
  );
}
