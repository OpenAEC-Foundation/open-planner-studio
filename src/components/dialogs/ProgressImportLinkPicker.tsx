import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, type SelectOption } from '@/components/common/Select';
import type { Task } from '@/types/task';

/** Hardening (plan T7): een `Select` met tienduizenden opties bevriest de dialoog, en het aantal
 *  taken is gebruikersinvoer — dus een harde grens, geen "best effort". */
const MAX_PICKER_OPTIONS = 200;

export interface ProgressImportLinkPickerProps {
  tasks: readonly Task[];
  /** Taken die al door een ANDERE rij geclaimd zijn — worden `disabled` getoond (A11 regel 3: UI-
   *  comfort, de kern weigert een dubbele koppeling sowieso zelf nog een keer). */
  takenTaskIds: ReadonlySet<string>;
  value: string | undefined;
  onChange: (taskId: string) => void;
  id?: string;
}

/**
 * Koppelkiezer voor de voortgangsimportdialoog (E3/A11, T7): een tekstveld dat op WBS-code en naam
 * filtert, plus de gedeelde `Select`. Verzameltaken worden BEWUST getoond (niet verstopt) — de kern
 * weigert de rij daarna zelf met `summaryTask`, en de gebruiker ziet zo waaróm dat gebeurt in plaats
 * van zich af te vragen waarom een taak nergens in de lijst staat.
 */
export function ProgressImportLinkPicker({ tasks, takenTaskIds, value, onChange, id }: ProgressImportLinkPickerProps) {
  const { t } = useTranslation('common');
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter(task =>
      task.wbsCode.toLowerCase().includes(needle) || task.name.toLowerCase().includes(needle));
  }, [tasks, filter]);

  const truncated = filtered.length > MAX_PICKER_OPTIONS;
  const limited = truncated ? filtered.slice(0, MAX_PICKER_OPTIONS) : filtered;

  const options: SelectOption[] = limited.map(task => {
    const label = `${task.wbsCode} — ${task.name}`;
    const isTaken = takenTaskIds.has(task.id) && task.id !== value;
    return {
      value: task.id,
      label: isTaken ? `${label} (${t('progressImport.pickerTaken')})` : label,
      disabled: isTaken,
    };
  });

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="text"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder={t('progressImport.pickerFilter')}
        className="input !text-xs !px-2.5 !py-1.5"
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
