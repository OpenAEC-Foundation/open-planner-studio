import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, type SelectOption } from '@/components/common/Select';
import type { Task } from '@/types/task';

const MAX_PICKER_OPTIONS = 200;

export interface ProgressImportLinkPickerProps {
  tasks: readonly Task[];
  takenTaskIds: ReadonlySet<string>;
  value: string | undefined;
  onChange: (taskId: string) => void;
  id?: string;
  currentTaskId?: string;
}

export function ProgressImportLinkPicker({ tasks, takenTaskIds, value, onChange, id, currentTaskId }: ProgressImportLinkPickerProps) {
  const { t } = useTranslation('common');
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter(task =>
      task.wbsCode.toLowerCase().includes(needle) || task.name.toLowerCase().includes(needle));
  }, [tasks, filter]);

  const truncated = filtered.length > MAX_PICKER_OPTIONS;

  const options: SelectOption[] = useMemo(() => {
    const limited = truncated ? filtered.slice(0, MAX_PICKER_OPTIONS) : filtered;
    return limited.map(task => {
      const label = `${task.wbsCode} — ${task.name}`;
      const isTaken = takenTaskIds.has(task.id) && task.id !== value && task.id !== currentTaskId;
      return {
        value: task.id,
        label: isTaken ? `${label} (${t('progressImport.pickerTaken')})` : label,
        disabled: isTaken,
      };
    });
  }, [filtered, truncated, takenTaskIds, value, currentTaskId, t]);

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="text"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder={t('progressImport.pickerFilter')}
        className="input !text-small !leading-4 !px-2.5 !py-1.5"
        aria-label={t('progressImport.pickerFilter')}
      />
      <Select
        id={id}
        value={value ?? ''}
        onChange={onChange}
        options={options}
        placeholder={t('progressImport.pickerPlaceholder')}
        aria-label={t('progressImport.pickerPlaceholder')}
      />
      {truncated && <span className="text-text-secondary">{t('progressImport.pickerTooMany')}</span>}
    </div>
  );
}
