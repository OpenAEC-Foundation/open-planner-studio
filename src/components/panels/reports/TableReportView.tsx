import { forwardRef } from 'react';
import type { TableReportSpec, ReportSection } from './tableReportSpec';

/**
 * DOM-weergave van een gesectioneerd tabelrapport. Tekent exact wat `makeSectionedRenderReport`
 * in de PDF zet — zelfde kolomspec, zelfde kleuren, zelfde lege-staat-teksten — in de huisstijl
 * van het mijlpalen-/variance-rapport (`text-xs`-tabel met thema-randen).
 */
function SectionTable({ s }: { s: ReportSection }) {
  return (
    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }} data-ops-report-section={s.key}>
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
      <h3 className="ui-card-header !text-xs mb-1">{spec.title}</h3>
      {spec.subtitle && <div className="text-xs mb-2" style={{ color: 'var(--theme-text-muted)' }}>{spec.subtitle}</div>}
      {spec.notes.map((n, i) => (
        <div key={i} className="text-xs mb-2" style={{ color: '#D97706' }} role="note">{n}</div>
      ))}
      {spec.summary.length > 0 && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-3" style={{ maxWidth: 640 }} data-ops-report-summary>
          {spec.summary.map((item, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span style={{ color: 'var(--theme-text-muted)' }}>{item.label}</span>
              <span style={{ color: item.color, fontWeight: 600 }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {spec.sections.map(s => (
        <div key={s.key} className="mb-4">
          {s.heading && <h4 className="text-xs font-semibold mb-1" style={{ color: 'var(--theme-text)' }}>{s.heading}</h4>}
          <div style={{ overflowX: 'auto' }}>
            <SectionTable s={s} />
          </div>
        </div>
      ))}
    </div>
  );
});
