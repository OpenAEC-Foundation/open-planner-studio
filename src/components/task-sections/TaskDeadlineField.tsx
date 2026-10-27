import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { TaskDateTimeInput } from '@/components/common/TaskDateTimeInput';
import { Field } from './shared';

/** Deadline — sectie van `TaskPropertiesPanel`. Pure `{ task, onChange }`. */
export function TaskDeadlineField({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  return (
    <Field label={t('properties.deadline')}>
      <TaskDateTimeInput
        task={task}
        side="end"
        milestoneOwn={false}
        dataAttribute="deadline"
        className="input !text-small !leading-4 !px-2.5 !py-1.5"
        ariaLabel={t('properties.deadline')}
        value={task.deadline ?? ''}
        onCommit={v => onChange({ deadline: v || undefined })}
      />
    </Field>
  );
}
