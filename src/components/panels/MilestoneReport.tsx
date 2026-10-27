import { useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { useTaskIdDateText } from '@/hooks/displayDate';
import { constraintDateSide, type InstantSide } from '@/engine/calendar/workdayRules';
import type { Task } from '@/types/task';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { shownStart } from '@/utils/taskDates';

/**
 * Mijlpalen-overzicht: tabelrapport over alle mijlpalen — soort,
 * datum, bewaakte datum (constraint/deadline), float, verplicht en status.
 * Statusafleiding: te laat = geschonden constraint/gemiste deadline of tf < 0;
 * kritiek = `isCritical` van de solver (de kritiek-definitie uit de rekenopties); anders op schema.
 * Afwijkingen t.o.v. de baseline staan in het afwijkingenrapport (`VarianceReport`).
 */

export interface MilestoneRow {
  id: string;
  wbs: string;
  name: string;
  kind: 'AUTO' | 'START' | 'FINISH';
  date: string;
  guardDate: string;
  /** De kant van de bewaakte datum (B4): een start-beperking startachtig, een eind-beperking en een
   *  deadline eindachtig. */
  guardSide: InstantSide;
  float: number | undefined;
  mandatory: boolean;
  status: 'late' | 'critical' | 'onSchedule';
}

/** De rijen van het overzicht, puur uit taken + CPM-resultaat (scherm én vector-PDF lezen deze). */
export function computeMilestoneRows(tasks: readonly Task[], cpmResult: CPMResult | null): MilestoneRow[] {
  const violated = new Set(cpmResult && !cpmResult.error ? cpmResult.violatedConstraintTaskIds : []);
  const missed = new Set(cpmResult && !cpmResult.error ? cpmResult.missedDeadlineTaskIds : []);
  return tasks
    .filter(t => t.isMilestone)
    .map(t => {
      const tf = t.time.totalFloat;
      const late = violated.has(t.id) || missed.has(t.id) || (tf !== undefined && tf < 0);
      // "Kritiek" is de solverdefinitie (`isCritical`: drempel, langste pad, voltooid nooit kritiek),
      // net als Gantt, raster, kritiek-rapport en MCP — geen eigen `tf <= 0`.
      const status: MilestoneRow['status'] = late ? 'late' : t.time.isCritical ? 'critical' : 'onSchedule';
      return {
        id: t.id,
        wbs: t.wbsCode,
        name: t.name,
        kind: (t.milestoneKind ?? 'AUTO') as MilestoneRow['kind'],
        // De getoonde datum, zoals de ruit in de Gantt: een behaalde mijlpaal staat op zijn werkelijke datum.
        date: shownStart(t),
        guardDate: t.constraint?.date ?? t.deadline ?? '',
        guardSide: t.constraint?.date ? (constraintDateSide(t.constraint.type) ?? 'start') : 'end',
        float: tf,
        mandatory: !!t.mandatory,
        status,
      };
    });
}

export function useMilestoneRows(): MilestoneRow[] {
  const tasks = useAppStore(s => s.tasks);
  const cpmResult = useAppStore(s => s.cpmResult);
  return useMemo(() => computeMilestoneRows(tasks, cpmResult), [tasks, cpmResult]);
}

/** Geëxporteerd zodat de vector-PDF-tabel-export exact dezelfde statuskleuren gebruikt. */
export const STATUS_COLOR: Record<MilestoneRow['status'], string> = {
  late: '#DC2626',
  critical: '#D97706',
  onSchedule: '#10B981',
};

export function MilestoneReport() {
  const { t } = useTranslation('report');
  const rows = useMilestoneRows();
  // B4: een tijd alleen als het moment midden op de werkdag valt.
  const taskDate = useTaskIdDateText();

  return (
    <table className="w-full text-small leading-4" style={{ borderCollapse: 'collapse' }}>
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
            <td className="px-2 py-1.5">{taskDate(r.id, r.date, 'start')}</td>
            <td className="px-2 py-1.5">{taskDate(r.id, r.guardDate, r.guardSide, { milestoneOwn: false }) || '—'}</td>
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
