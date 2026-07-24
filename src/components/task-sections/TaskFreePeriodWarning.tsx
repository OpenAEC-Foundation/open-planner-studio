import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate } from '@/hooks/displayDate';
import { effectiveCalendarOf } from '@/utils/taskDuration';
import { findLongFreePeriods } from '@/engine/scheduler/freePeriods';

/**
 * Waarschuwing "deze taak loopt over een lange vrije periode" — user-wens bij issue #21.
 * RELATIONEEL/storeful (zelfde classificatie als `TaskCpmResultSection`): puur lezend, geen
 * `onChange`-contract, dus `taskId`-only i.p.v. het volledige `{ task, onChange }`-contract.
 *
 * Mijlpalen worden bewust overgeslagen (aparte casus: een mijlpaal die toevallig op een vrije dag
 * valt is geen "taak die over een periode heen loopt") — evenals taken zonder geldige
 * start/finish. De eigenlijke detectie is puur/stateloos in `findLongFreePeriods`.
 */
export function TaskFreePeriodWarning({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const dd = useDisplayDate();
  const task = useAppStore(s => s.tasks.find(t => t.id === taskId));
  const calendars = useAppStore(s => s.calendars);
  const projectCal = useAppStore(s => s.calendar);

  if (!task || task.isMilestone) return null;

  // Zelfde "berekende start/finish"-bron als `TaskTimeFields`/Gantt/tooltip
  // (`earlyStart || scheduleStart`, analoog voor finish) — niet de rauwe plan-ankers.
  const start = task.time.earlyStart || task.time.scheduleStart;
  const finish = task.time.earlyFinish || task.time.scheduleFinish;
  if (!start || !finish) return null;

  const cal = effectiveCalendarOf(task, projectCal, calendars);
  const periods = findLongFreePeriods(cal, start, finish);
  if (periods.length === 0) return null;

  return (
    <>
      {periods.map((p, i) => (
        <div key={`${p.start}-${p.end}-${i}`} className="text-[11px]" style={{ color: 'var(--theme-warning-text)' }}>
          ⚠ {p.name
            ? t('properties.longFreePeriodWarningNamed', { name: p.name, days: p.days, start: dd.date(p.start), end: dd.date(p.end) })
            : t('properties.longFreePeriodWarning', { days: p.days, start: dd.date(p.start), end: dd.date(p.end) })}
        </div>
      ))}
    </>
  );
}
