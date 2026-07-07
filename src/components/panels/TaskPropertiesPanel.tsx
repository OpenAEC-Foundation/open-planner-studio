import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { Trash2 } from 'lucide-react';
import { TaskBasicFields } from '@/components/task-sections/TaskBasicFields';
import { TaskNotesFields } from '@/components/task-sections/TaskNotesFields';
import { TaskMilestoneFields } from '@/components/task-sections/TaskMilestoneFields';
import { TaskTimeFields } from '@/components/task-sections/TaskTimeFields';
import { TaskHammockFields } from '@/components/task-sections/TaskHammockFields';
import { TaskConstraintFields } from '@/components/task-sections/TaskConstraintFields';
import { TaskDeadlineField } from '@/components/task-sections/TaskDeadlineField';
import { TaskProgressFields } from '@/components/task-sections/TaskProgressFields';
import { TaskCpmResultSection } from '@/components/task-sections/TaskCpmResultSection';
import { TaskDependenciesSection } from '@/components/task-sections/TaskDependenciesSection';
import { TaskAssignmentsSection } from '@/components/task-sections/TaskAssignmentsSection';
import { TaskCodesFieldsSection } from '@/components/task-sections/TaskCodesFieldsSection';

// RESOURCE_CURVES/CURVE_KEY verhuisd naar `@/components/task-sections/shared` (fase 2.10, golf D) —
// Ribbon.tsx en de nieuwe Toewijzingen-sectie importeren vanaf daar. Re-export hier zou een
// cirkelvormige afhankelijkheid met task-sections/shared kunnen introduceren; bestaande imports zijn
// bijgewerkt naar de nieuwe plek.

/**
 * Eigenschappenpaneel voor de geselecteerde taak (fase 2.10, golf D: geëxtraheerd in gedeelde
 * `task-sections/*`-componenten, hergebruikt door `TaskDialog`). Dit paneel blijft INSTANT-APPLY
 * (`update(patch) => updateTask(task.id, patch)`) — exact het gedrag van vóór de extractie, puur
 * JSX/compositie verplaatst naar losse bestanden.
 */
export function TaskPropertiesPanel() {
  const { t } = useTranslation('task');

  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const tasks = useAppStore(s => s.tasks);
  const updateTask = useAppStore(s => s.updateTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const runCPM = useAppStore(s => s.runCPM);
  const setTaskCalendar = useAppStore(s => s.setTaskCalendar);
  // Voortgang (fase 2.6): de acties dwingen de §3.2-invarianten af — zie TaskProgressFields-docstring
  // voor waarom deze als dedicated setters (i.p.v. de generieke patch) worden doorgegeven.
  const setTaskProgress = useAppStore(s => s.setTaskProgress);
  const setActualStart = useAppStore(s => s.setActualStart);
  const setActualFinish = useAppStore(s => s.setActualFinish);

  if (selectedTaskIds.length === 0) {
    return (
      <div className="p-3 text-xs text-text-secondary">
        {t('properties.selectPrompt')}
      </div>
    );
  }

  if (selectedTaskIds.length > 1) {
    return (
      <div className="p-3 text-xs text-text-secondary">
        {t('properties.multiSelect', { count: selectedTaskIds.length })}
      </div>
    );
  }

  const task = tasks.find(t => t.id === selectedTaskIds[0]);
  if (!task) return null;

  const update = (updates: Partial<Task>) => {
    updateTask(task.id, updates);
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-xs overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="ui-card-header !text-xs">{t('properties.task')}</span>
        <button
          onClick={() => deleteTask(task.id)}
          className="p-1 rounded"
          style={{ color: 'var(--error)' }}
          title={t('properties.deleteTask')}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <TaskBasicFields
        task={task}
        onChange={update}
        onCalendarChange={id => setTaskCalendar(task.id, id)}
      />

      <TaskNotesFields task={task} onChange={update} />

      <TaskMilestoneFields task={task} onChange={update} />

      <TaskTimeFields task={task} onChange={update} />

      <TaskHammockFields task={task} onChange={update} />

      <TaskConstraintFields task={task} onChange={update} />

      <TaskDeadlineField task={task} onChange={update} />

      <TaskProgressFields
        task={task}
        onSetProgress={v => setTaskProgress(task.id, v)}
        onSetActualStart={d => setActualStart(task.id, d)}
        onSetActualFinish={d => setActualFinish(task.id, d)}
      />

      <TaskCpmResultSection taskId={task.id} />

      <TaskDependenciesSection taskId={task.id} />

      <TaskAssignmentsSection taskId={task.id} />

      <TaskCodesFieldsSection taskId={task.id} />

      <button
        onClick={runCPM}
        className="btn btn--sm btn--primary mt-2"
        style={{ boxShadow: 'var(--shadow-glow)' }}
      >
        {t('properties.recalculate')}
      </button>
    </div>
  );
}
