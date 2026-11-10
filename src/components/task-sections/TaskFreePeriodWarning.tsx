import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate } from '@/hooks/displayDate';
import { effectiveCalendarOf } from '@/utils/taskDuration';
import { findLongFreePeriods } from '@/engine/scheduler/freePeriods';
import { shownFinish, shownStart } from '@/utils/taskDates';
import { Icon } from '@/components/icons';

/**
 * Waarschuwing "deze taak loopt over een lange vrije periode".
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

  // Zelfde getoonde start/einde als `TaskTimeFields`/Gantt/tooltip (`shownStart`/`shownFinish`) —
  // niet de rauwe plan-ankers.
  const start = task && !task.isMilestone ? shownStart(task) : undefined;
  const finish = task && !task.isMilestone ? shownFinish(task) : undefined;
  const cal = task ? effectiveCalendarOf(task, projectCal, calendars) : undefined;

  // Review vóór de merge (aanbeveling): memoïseren — de scan is O(taakduur in kalenderdagen) en
  // draaide anders op élke store-mutatie mee (ook per sleep-frame bij niet-datumwijzigingen).
  // Deps zijn de daadwerkelijke invoer (datums + kalender), niet het taak-object zelf.
  const periods = useMemo(
    () => (cal && start && finish ? findLongFreePeriods(cal, start, finish) : []),
    [cal, start, finish],
  );

  if (!task || task.isMilestone || periods.length === 0) return null;

  return (
    <>
      {periods.map((p, i) => (
        <div key={`${p.start}-${p.end}-${i}`} className="!text-body flex items-start gap-1" style={{ color: 'var(--theme-warning-text)' }} data-ops-free-period-warning>
          <Icon id="status.warning" size={16} />
          <span>{p.name
            ? t('properties.longFreePeriodWarningNamed', { name: p.name, days: p.days, start: dd.date(p.start), end: dd.date(p.end) })
            : t('properties.longFreePeriodWarning', { days: p.days, start: dd.date(p.start), end: dd.date(p.end) })}</span>
        </div>
      ))}
    </>
  );
}
