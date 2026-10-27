import { forwardRef } from 'react';
import type { TableReportSpec, ReportSection } from './tableReportSpec';
import { CurveChartView } from './CurveChartView';

/**
 * DOM-weergave van een gesectioneerd tabelrapport. Tekent exact wat `makeSectionedRenderReport`
 * in de PDF zet — zelfde kolomspec, zelfde kleuren, zelfde lege-staat-teksten — in de huisstijl
 * van het mijlpalen-/variance-rapport (`text-small leading-4`-tabel met thema-randen).
 */
function SectionTable({ s }: { s: ReportSection }) {
  return (
    <table className="w-full text-small leading-4" style={{ borderCollapse: 'collapse' }} data-ops-report-section={s.key}>
      <thead>
        <tr style={{ borderBottom: '2px solid var(--theme-border)' }}>
          {s.columns.map(c => (
            <th
              key={c.key}
              className={`px-2 py-1.5 font-semibold ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}
              style={{ color: 'var(--theme-text-muted)' }}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {s.rows.length === 0 && (
          <tr>
            <td colSpan={s.columns.length} className="px-2 py-3" style={{ color: 'var(--theme-text-dim)' }}>
              {s.emptyText ?? ''}
            </td>
          </tr>
        )}
        {s.rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--theme-border-light)' }}>
            {s.columns.map(c => {
              const color = c.color?.(row);
              const bold = c.bold?.(row) ?? false;
              const indent = c.indent?.(row) ?? 0;
              return (
                <td
                  key={c.key}
                  className={`px-2 py-1.5 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}
                  style={{ color, fontWeight: bold ? 600 : undefined, whiteSpace: 'nowrap', paddingLeft: indent > 0 ? `${8 + indent}px` : undefined }}
                >
                  {c.text(row)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const TableReportView = forwardRef<HTMLDivElement, { spec: TableReportSpec }>(function TableReportView({ spec }, ref) {
  return (
    <div
      ref={ref}
      className="bg-surface p-4"
      style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', maxWidth: 1200 }}
      data-ops-table-report={spec.fileSuffix}
    >
      <h3 className="ui-card-header !text-small !leading-4 mb-1">{spec.title}</h3>
      {spec.subtitle && <div className="text-small leading-4 mb-2" style={{ color: 'var(--theme-text-muted)' }}>{spec.subtitle}</div>}
      {spec.notes.map((n, i) => (
        <div key={i} className="text-small leading-4 mb-2" style={{ color: '#D97706' }} role="note">{n}</div>
      ))}
      {spec.summary.length > 0 && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-small leading-4 mb-3" style={{ maxWidth: 640 }} data-ops-report-summary>
          {spec.summary.map((item, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span style={{ color: 'var(--theme-text-muted)' }}>{item.label}</span>
              <span style={{ color: item.color, fontWeight: 600 }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {spec.kpis && spec.kpis.length > 0 && (
        <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${spec.kpis.length}, minmax(0, 1fr))`, maxWidth: 760 }} data-ops-report-kpis>
          {spec.kpis.map((k, i) => (
            <div key={i} className="px-2 py-1.5 min-w-0" style={{ border: '1px solid var(--theme-border-light)', borderRadius: 'var(--radius-sm)' }} data-ops-report-kpi>
              <div className="text-small leading-4 truncate" style={{ color: 'var(--theme-text-muted)' }}>{k.label}</div>
              <div className="text-heading leading-5 font-semibold truncate" style={{ color: k.color ?? 'var(--theme-text)' }}>{k.value}</div>
              {k.detail && <div className="text-small leading-4 truncate" style={{ color: 'var(--theme-text-muted)' }}>{k.detail}</div>}
            </div>
          ))}
        </div>
      )}
      {spec.chart && (
        <div className="mb-4">
          {spec.chart.spec
            ? <CurveChartView spec={spec.chart.spec} />
            : <div className="text-small leading-4" style={{ color: 'var(--theme-text-dim)' }}>{spec.chart.emptyText}</div>}
        </div>
      )}
      {spec.sections.map(s => (
        <div key={s.key} className="mb-4">
          {s.heading && <h4 className="text-small leading-4 font-semibold mb-1" style={{ color: 'var(--theme-text)' }}>{s.heading}</h4>}
          <div style={{ overflowX: 'auto' }}>
            <SectionTable s={s} />
          </div>
        </div>
      ))}
    </div>
  );
});
