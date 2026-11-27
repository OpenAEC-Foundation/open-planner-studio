import { useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { computeVariance, type VarianceResult, type VarianceStatus } from '@/engine/variance';
import { useTaskIdDateText } from '@/hooks/displayDate';
import { formatSignedReportNumber } from '@/utils/reportNumber';

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

export const STATUS_COLOR: Record<VarianceStatus, string> = {
  onSchedule: '#10B981',
  late: '#DC2626',
  early: '#2563EB',
  new: '#7C3AED',
  dropped: '#6B7280',
};

const COLUMNS = ['wbs', 'name', 'baselineStart', 'baselineFinish', 'currentStart', 'currentFinish', 'deltaStart', 'deltaFinish', 'status'] as const;

export function fmtDelta(v: number | undefined, locale?: string): string {
  if (v === undefined) return '—';
  return formatSignedReportNumber(v, locale);
}

export function VarianceReport() {
  const { t, i18n } = useTranslation('report');
  const { rows } = useVarianceResult();
  const taskDate = useTaskIdDateText();

  return (
    <table className="w-full text-small leading-4" style={{ borderCollapse: 'collapse' }}>
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
            <td className="px-2 py-1.5">{taskDate(r.taskId, r.baselineStart, 'start') || '—'}</td>
            <td className="px-2 py-1.5">{taskDate(r.taskId, r.baselineFinish, 'end') || '—'}</td>
            <td className="px-2 py-1.5">{taskDate(r.taskId, r.currentStart, 'start') || '—'}</td>
            <td className="px-2 py-1.5">{taskDate(r.taskId, r.currentFinish, 'end') || '—'}</td>
            <td className="px-2 py-1.5 text-right" style={r.deltaStart !== undefined && r.deltaStart > 0 ? { color: '#DC2626', fontWeight: 600 } : undefined}>
              {fmtDelta(r.deltaStart, i18n.language)}
            </td>
            <td className="px-2 py-1.5 text-right" style={r.deltaFinish !== undefined && r.deltaFinish > 0 ? { color: '#DC2626', fontWeight: 600 } : undefined}>
              {fmtDelta(r.deltaFinish, i18n.language)}
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
