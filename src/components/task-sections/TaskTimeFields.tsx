import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { WorkCalendar } from '@/types/calendar';
import { effectiveCalendarOf } from '@/utils/taskDuration';
import { shownStart, startAnchorAfterEdit, startIsActual } from '@/utils/taskDates';
import {
  constraintBlockingStart,
  predecessorDrivenTaskIds,
  startConstraintAfterEdit,
} from '@/engine/startEditConstraint';
import { notifyStartEdit } from '@/state/startConstraintNotice';
import { Task } from '@/types/task';
import { TaskDateTimeInput } from '@/components/common/TaskDateTimeInput';
import { Field } from './shared';
import { TaskDurationField } from './TaskDurationField';
import { TaskRecordedDatesNotice } from './TaskRecordedDatesNotice';

export function TaskTimeFields({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  const calendars = useAppStore(s => s.calendars);
  const projectCal = useAppStore(s => s.calendar);

  const cal: WorkCalendar = effectiveCalendarOf(task, projectCal, calendars);
  const shown = shownStart(task);
  const actualLocked = startIsActual(task);

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-small !leading-4">{t('properties.time')}</span>

      <TaskRecordedDatesNotice taskId={task.id} />

      <div className="grid grid-cols-1 gap-2">
        <Field label={t('properties.start')}>
          <TaskDateTimeInput
            task={task}
            side="start"
            dataAttribute="start"
            className="input !text-small !leading-4 !px-2.5 !py-1.5"
            ariaLabel={t('properties.start')}
            title={actualLocked ? t('taskGrid.validation.startIsActual') : t('properties.scheduleStartHint')}
            value={shown}
            required
            disabled={actualLocked}
            onCommit={v => {
              if (!v || actualLocked) return;
              const anchor = startAnchorAfterEdit(task, v);
              if (anchor === undefined) return;
              const state = useAppStore.getState();
              const driven = predecessorDrivenTaskIds(state.tasks, state.sequences).has(task.id);
              const blocking = constraintBlockingStart(task, driven);
              if (blocking) {
                notifyStartEdit(state.notify, [{ kind: 'blocked', name: task.name, constraint: blocking, taskId: task.id }], state.ui.dateNotation, state.ui.timeNotation);
                return false;
              }
              const snet = startConstraintAfterEdit(task, anchor, driven);
              if (!snet && anchor === task.time.scheduleStart) return;
              onChange({ time: { ...task.time, scheduleStart: anchor }, ...(snet ? { constraint: snet.constraint } : {}) });
              if (snet) {
                notifyStartEdit(state.notify, [{ kind: 'snet', name: task.name, date: anchor, change: snet.change }], state.ui.dateNotation, state.ui.timeNotation);
              }
            }}
          />
        </Field>
        <Field label={t('duration.label')}>
          <TaskDurationField task={task} calendar={cal} onChange={onChange} />
        </Field>
      </div>
    </>
  );
}
