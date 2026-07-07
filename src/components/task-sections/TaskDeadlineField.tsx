import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { DateTextInput } from '@/components/common/DateTextInput';
import { Field } from './shared';

/** Deadline — sectie 6 uit `TaskPropertiesPanel` (fase 2.10, item 2). Pure `{ task, onChange }`. */
export function TaskDeadlineField({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  return (
    <Field label={t('properties.deadline')}>
      <DateTextInput
        className="input !text-xs !px-2.5 !py-1.5"
        ariaLabel={t('properties.deadline')}
        value={task.deadline ?? ''}
        onCommit={v => onChange({ deadline: v || undefined })}
      />
    </Field>
  );
}
