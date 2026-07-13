import { useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { useDisplayDate } from '@/hooks/displayDate';

/**
 * Mijlpalen-overzicht (fase 2.4): tabelrapport over alle mijlpalen — soort,
 * datum, bewaakte datum (constraint/deadline), float, verplicht en status.
 * Statusafleiding: te laat = geschonden constraint/gemiste deadline of tf < 0;
 * kritiek = tf ≤ 0; anders op schema. Baseline-/variance-kolommen en MTA
 * vereisen snapshots en volgen met fase 2.6 (baselines).
 */

export interface MilestoneRow {
  id: string;
  wbs: string;
  name: string;
  kind: 'AUTO' | 'START' | 'FINISH';
  date: string;
  guardDate: string;
  float: number | undefined;
  mandatory: boolean;
  status: 'late' | 'critical' | 'onSchedule';
}

export function useMilestoneRows(): MilestoneRow[] {
  const tasks = useAppStore(s => s.tasks);
  const cpmResult = useAppStore(s => s.cpmResult);

  return useMemo(() => {
    const violated = new Set(cpmResult && !cpmResult.error ? cpmResult.violatedConstraintTaskIds : []);
    const missed = new Set(cpmResult && !cpmResult.error ? cpmResult.missedDeadlineTaskIds : []);
    return tasks
      .filter(t => t.isMilestone)
      .map(t => {
        const tf = t.time.totalFloat;
        const late = violated.has(t.id) || missed.has(t.id) || (tf !== undefined && tf < 0);
        const status: MilestoneRow['status'] = late ? 'late' : tf !== undefined && tf <= 0 ? 'critical' : 'onSchedule';
        return {
          id: t.id,
          wbs: t.wbsCode,
          name: t.name,
          kind: (t.milestoneKind ?? 'AUTO') as MilestoneRow['kind'],
          date: t.time.earlyStart || t.time.scheduleStart,
          guardDate: t.constraint?.date ?? t.deadline ?? '',
          float: tf,
          mandatory: !!t.mandatory,
          status,
        };
      });
  }, [tasks, cpmResult]);
}

const STATUS_COLOR: Record<MilestoneRow['status'], string> = {
  late: '#DC2626',
  critical: '#D97706',
  onSchedule: '#10B981',
};

export function MilestoneReport() {
  const { t } = useTranslation('report');
  const rows = useMilestoneRows();
  const dd = useDisplayDate();

  return (
    <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid var(--theme-border)' }}>
          {(['wbs', 'name', 'kind', 'date', 'guardDate', 'float', 'mandatory', 'status'] as const).map(h => (
            <th key={h} className="text-left px-2 py-1.5 font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
              {t(`milestoneReport.${h}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={8} className="px-2 py-3" style={{ color: 'var(--theme-text-dim)' }}>{t('milestoneReport.empty')}</td></tr>
        )}
        {rows.map(r => (
          <tr key={r.id} style={{ borderBottom: '1px solid var(--theme-border-light)' }}>
            <td className="px-2 py-1.5">{r.wbs}</td>
            <td className="px-2 py-1.5">{r.mandatory ? '◆ ' : ''}{r.name}</td>
            <td className="px-2 py-1.5">{t(`milestoneReport.kind_${r.kind}`)}</td>
            <td className="px-2 py-1.5">{dd.date(r.date)}</td>
            <td className="px-2 py-1.5">{dd.date(r.guardDate) || '—'}</td>
            <td className="px-2 py-1.5 text-right" style={r.float !== undefined && r.float < 0 ? { color: '#DC2626', fontWeight: 600 } : undefined}>
              {r.float === undefined ? '—' : r.float}
            </td>
            <td className="px-2 py-1.5">{r.mandatory ? t('milestoneReport.yes') : ''}</td>
            <td className="px-2 py-1.5">
              <span style={{ color: STATUS_COLOR[r.status], fontWeight: 600 }}>
                {t(`milestoneReport.status_${r.status}`)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
