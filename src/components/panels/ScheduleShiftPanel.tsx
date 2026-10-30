import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate, useTaskDateText } from '@/hooks/displayDate';
import { canUndoScheduleShift } from '@/state/scheduleShift';
import type { ShiftReason } from '@/engine/scheduler/shiftExplanation';
import type { Task } from '@/types/task';

/** Rijen per keer: een herberekening kan duizenden taken raken, en een lange lijst leest niemand. */
const ROWS_PER_PAGE = 200;

/**
 * Paneel Verschuivingen (#742): welke taken de laatste herberekening verschoof, en waarom. Een lijst,
 * geen overzicht: per taak het oude en nieuwe einde en de reden. Klik op een rij = de taak in de
 * Gantt tonen, via dezelfde `focusOnTask` als het Waarschuwingenpaneel.
 *
 * De lijst is een momentopname van die herberekening (`scheduleShift`). Latere bewerkingen veranderen
 * hem niet; alleen Ongedaan maken verdwijnt dan, want dat zou die bewerkingen meenemen.
 */
export function ScheduleShiftPanel() {
  const { t } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  const dd = useDisplayDate();
  const taskDate = useTaskDateText();
  const shift = useAppStore(s => s.scheduleShift);
  const tasks = useAppStore(s => s.tasks);
  const resources = useAppStore(s => s.resources);
  const activeTaskId = useAppStore(s => s.activeTaskId);
  const canUndo = useAppStore(canUndoScheduleShift);
  const undoScheduleShift = useAppStore(s => s.undoScheduleShift);
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE);

  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const resourceName = (id: string) => resources.find(r => r.id === id)?.name || id;
  const taskLabel = (task: Task | undefined, id: string) => {
    if (!task) return id;
    return task.wbsCode ? `${task.wbsCode} ${task.name}` : task.name;
  };

  const constraintText = (task: Task | undefined): string => {
    const constraint = task && !task.constraint2 ? task.constraint : undefined;
    if (!constraint) return t('scheduleShift.reason.constraintPlain');
    const name = tTask(`constraintType.${constraint.type}`);
    return t('scheduleShift.reason.constraint', {
      constraint: constraint.date ? `${name} ${dd.date(constraint.date)}` : name,
    });
  };

  const reasonText = (reason: ShiftReason, task: Task | undefined): string => {
    switch (reason.kind) {
      case 'predecessor': {
        const [first, ...others] = reason.taskIds;
        const name = taskLabel(taskById.get(first), first);
        return others.length > 0
          ? t('scheduleShift.reason.predecessorMore', { name, count: others.length })
          : t('scheduleShift.reason.predecessor', { name });
      }
      case 'calendar': return t('scheduleShift.reason.calendar', { name: reason.calendarName });
      case 'constraint': return constraintText(task);
      case 'statusDate': return t('scheduleShift.reason.statusDate', { date: dd.date(reason.date) });
      case 'resource':
        return reason.resourceIds.length > 0
          ? t('scheduleShift.reason.resource', { names: reason.resourceIds.map(resourceName).join(', ') })
          : t('scheduleShift.reason.resourceLeveling');
      case 'duration': return t('scheduleShift.reason.duration');
      case 'ownStart': return t('scheduleShift.reason.ownStart');
      case 'plannedStart': return t('scheduleShift.reason.plannedStart');
      case 'projectStart': return t('scheduleShift.reason.projectStart');
      case 'progress': return t('scheduleShift.reason.progress');
      case 'manual': return t('scheduleShift.reason.manual');
      case 'hammock': return t('scheduleShift.reason.hammock');
      case 'unknown': return t('scheduleShift.reason.unknown');
    }
  };

  const rows = shift?.report.tasks ?? [];
  return (
    <div className="flex flex-col h-full !text-body" data-ops-shift-panel>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border text-text-secondary flex-shrink-0">
        <span className="flex-1 min-w-0 truncate" data-ops-shift-summary>
          {shift
            ? t('scheduleShift.notice', { count: rows.length })
            : t('scheduleShift.emptyNoRun')}
        </span>
        {canUndo && (
          <button
            onClick={() => undoScheduleShift()}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-hover text-text-primary flex-shrink-0"
            data-ops-shift-undo
          >
            <Undo2 size={12} />
            <span>{t('scheduleShift.undo')}</span>
          </button>
        )}
      </div>

      {shift && rows.length === 0 ? (
        <div className="px-3 py-3 text-text-secondary" data-ops-shift-empty>{t('scheduleShift.emptyNoShift')}</div>
      ) : (
        <ul className="flex-1 overflow-y-auto m-0 p-0 list-none" role="list">
          {rows.slice(0, visibleRows).map(row => {
            const task = taskById.get(row.taskId);
            const current = row.taskId === activeTaskId;
            const label = taskLabel(task, row.taskId);
            const body = (
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-text-primary font-medium truncate">{label}</span>
                <span className="text-text-secondary whitespace-normal break-words">
                  {t('scheduleShift.finishChange', {
                    from: task ? taskDate(task, row.previousFinish, 'end', { milestoneOwn: true }) : dd.date(row.previousFinish),
                    to: task ? taskDate(task, row.finish, 'end', { milestoneOwn: true }) : dd.date(row.finish),
                  })}
                </span>
                <span className="text-text-secondary whitespace-normal break-words" data-ops-shift-reason={row.reason.kind}>
                  {reasonText(row.reason, task)}
                </span>
              </span>
            );
            return (
              <li key={row.taskId} className="border-b border-border">
                {task ? (
                  <button
                    onClick={() => useAppStore.getState().focusOnTask(row.taskId)}
                    aria-current={current ? 'true' : undefined}
                    className={`w-full text-left flex items-start gap-2 px-3 py-1.5 hover:bg-surface-hover${current ? ' bg-surface-hover' : ''}`}
                    title={t('scheduleShift.goTo', { target: label })}
                    data-ops-shift-id={row.taskId}
                  >
                    {body}
                  </button>
                ) : (
                  // De taak is na de herberekening verwijderd: niets om naartoe te springen.
                  <div className="w-full text-left flex items-start gap-2 px-3 py-1.5" data-ops-shift-id={row.taskId}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
          {rows.length > visibleRows && (
            <li>
              <button
                onClick={() => setVisibleRows(n => n + ROWS_PER_PAGE)}
                className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-text-primary"
                data-ops-shift-more
              >
                {t('scheduleShift.showMore', { count: rows.length - visibleRows })}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
