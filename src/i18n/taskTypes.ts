import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { TaskType } from '@/types/task';

const TASK_TYPE_KEYS: TaskType[] = [
  'CONSTRUCTION',
  'INSTALLATION',
  'DEMOLITION',
  'LOGISTIC',
  'ATTENDANCE',
  'MOVE',
  'RENOVATION',
  'MAINTENANCE',
  'USERDEFINED',
];

export function getTaskTypeLabel(t: TFunction, type: TaskType): string {
  return t(`taskType.${type}`, { ns: 'task' });
}

export function useTaskTypeLabels() {
  const { t } = useTranslation('task');

  const labels: Record<TaskType, string> = {} as Record<TaskType, string>;
  for (const key of TASK_TYPE_KEYS) {
    labels[key] = t(`taskType.${key}`);
  }

  const options = TASK_TYPE_KEYS
    .filter(k => k !== 'USERDEFINED')
    .map(value => ({ value, label: labels[value] }));

  return { labels, options };
}
