import { useMemo, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { computeVariance, type VarianceResult, type VarianceStatus } from '@/engine/variance';

/**
 * Variance-rapport (fase 2.6, §7): vergelijkt de huidige (CPM-)datums met de actieve baseline.
 * Deelt de pure `computeVariance` met de headless testharnas; de hook levert de rijen + de
 * projecteinde-delta voor de samenvatting. Zonder actieve baseline: lege uitkomst (lege-staat).
 */

/** Hook rond de pure `computeVariance` — gememoiseerd op tasks/cpmResult/baselines/activeBaselineId. */
export function useVarianceResult(): VarianceResult {
  const tasks = useAppStore(s => s.tasks);
  const cpmResult = useAppStore(s => s.cpmResult);
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const calendar = useAppStore(s => s.calendar);

  return useMemo(() => {
    const active = activeBaselineId ? baselines.find(b => b.id === activeBaselineId) ?? null : null;
    if (!active) return { rows: [] };
    const cal = new CalendarEngine(calendar);
    const currentEnd = cpmResult && !cpmResult.error ? cpmResult.projectEnd : undefined;
    return computeVariance(tasks, active, cal, currentEnd);
  }, [tasks, cpmResult, baselines, activeBaselineId, calendar]);
}

const STATUS_COLOR: Record<VarianceStatus, string> = {
  onSchedule: '#10B981',
  late: '#DC2626',
  early: '#2563EB',
  new: '#7C3AED',
  dropped: '#6B7280',
};

const COLUMNS = ['wbs', 'name', 'baselineStart', 'baselineFinish', 'currentStart', 'currentFinish', 'deltaStart', 'deltaFinish', 'status'] as const;

function fmtDelta(v: number | undefined): string {
  if (v === undefined) return '—';
  return v > 0 ? `+${v}` : `${v}`;
}

export function VarianceReport() {
  const { t } = useTranslation('report');
  const { rows } = useVarianceResult();

  return (
    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid var(--theme-border)' }}>
          {COLUMNS.map(h => (
            <th key={h} className="text-left px-2 py-1.5 font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
              {h === 'wbs' ? t('milestoneReport.wbs') : h === 'name' ? t('milestoneReport.name') : t(`variance.${h}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={COLUMNS.length} className="px-2 py-3" style={{ color: 'var(--theme-text-dim)' }}>{t('variance.noBaseline')}</td></tr>
        )}
        {rows.map(r => (
          <tr key={r.taskId} style={{ borderBottom: '1px solid var(--theme-border-light)' }}>
            <td className="px-2 py-1.5">{r.wbs}</td>
            <td className="px-2 py-1.5">{r.name}</td>
            <td className="px-2 py-1.5">{r.baselineStart || '—'}</td>
            <td className="px-2 py-1.5">{r.baselineFinish || '—'}</td>
            <td className="px-2 py-1.5">{r.currentStart || '—'}</td>
            <td className="px-2 py-1.5">{r.currentFinish || '—'}</td>
            <td className="px-2 py-1.5 text-right" style={r.deltaStart !== undefined && r.deltaStart > 0 ? { color: '#DC2626', fontWeight: 600 } : undefined}>
              {fmtDelta(r.deltaStart)}
            </td>
            <td className="px-2 py-1.5 text-right" style={r.deltaFinish !== undefined && r.deltaFinish > 0 ? { color: '#DC2626', fontWeight: 600 } : undefined}>
              {fmtDelta(r.deltaFinish)}
            </td>
            <td className="px-2 py-1.5">
              <span style={{ color: STATUS_COLOR[r.status], fontWeight: 600 }}>
                {t(`variance.status_${r.status}`)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Print-HTML voor het variance-rapport (zelfde popup-print-route als het mijlpalen-overzicht). */
export function useVarianceReportPrint(projectName: string): () => void {
  const { t } = useTranslation('report');
  const { rows, projectEndDelta } = useVarianceResult();

  return useCallback(() => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const headers = COLUMNS
      .map(h => `<th>${esc(h === 'wbs' ? t('milestoneReport.wbs') : h === 'name' ? t('milestoneReport.name') : t(`variance.${h}`))}</th>`).join('');
    const body = rows.map(r => `<tr>
      <td>${esc(r.wbs)}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.baselineStart || '—')}</td>
      <td>${esc(r.baselineFinish || '—')}</td>
      <td>${esc(r.currentStart || '—')}</td>
      <td>${esc(r.currentFinish || '—')}</td>
      <td style="text-align:right;${r.deltaStart !== undefined && r.deltaStart > 0 ? 'color:#DC2626;font-weight:600;' : ''}">${esc(fmtDelta(r.deltaStart))}</td>
      <td style="text-align:right;${r.deltaFinish !== undefined && r.deltaFinish > 0 ? 'color:#DC2626;font-weight:600;' : ''}">${esc(fmtDelta(r.deltaFinish))}</td>
      <td style="color:${STATUS_COLOR[r.status]};font-weight:600;">${esc(t(`variance.status_${r.status}`))}</td>
    </tr>`).join('');
    const summary = projectEndDelta !== undefined
      ? `<p class="sub">${esc(t('variance.projectEndDelta', { delta: fmtDelta(projectEndDelta) }))}</p>`
      : '';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html><head><title>${esc(projectName)} — ${esc(t('variance.title'))}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 16mm; color: #111; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  p.sub { font-size: 10px; color: #666; margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 10px; }
  th { text-align: left; border-bottom: 2px solid #333; padding: 4px 6px; }
  td { border-bottom: 1px solid #ddd; padding: 4px 6px; }
  @page { size: A4 landscape; margin: 10mm; }
</style>
</head><body>
<h1>${esc(t('variance.title'))}</h1>
<p class="sub">${esc(projectName)} — ${new Date().toISOString().slice(0, 10)}</p>
${summary}
<table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
    w.document.close();
  }, [rows, projectEndDelta, t, projectName]);
}
