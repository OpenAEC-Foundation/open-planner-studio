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
  /** Fixronde bevinding 4: de taak die DEZE rij zelf al claimt — automatisch (WBS-terugval, nog geen
   *  override) of via een bestaande override. Die mag in de kiezer van DEZE rij nooit `disabled` zijn,
   *  ook al staat hij (terecht) in `takenTaskIds`: anders kan een gebruiker die op "Wijzigen" klikt
   *  zijn eigen, reeds gematchte taak niet meer terugkiezen. */
  currentTaskId?: string;
}

/**
 * Koppelkiezer voor de voortgangsimportdialoog (E3/A11, T7): een tekstveld dat op WBS-code en naam
 * filtert, plus de gedeelde `Select`. Verzameltaken worden BEWUST getoond (niet verstopt) — de kern
 * weigert de rij daarna zelf met `summaryTask`, en de gebruiker ziet zo waaróm dat gebeurt in plaats
 * van zich af te vragen waarom een taak nergens in de lijst staat.
 */
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
  const limited = truncated ? filtered.slice(0, MAX_PICKER_OPTIONS) : filtered;

  // Fixronde bevinding 1: bouwde eerder buiten een memo, op elke render van deze kiezer opnieuw.
  const options: SelectOption[] = useMemo(
    () => limited.map(task => {
      const label = `${task.wbsCode} — ${task.name}`;
      // Fixronde bevinding 4: `currentTaskId` (deze rij ZELF) is nooit "taken", ook al staat hij in
      // `takenTaskIds` — anders is de eigen, al gematchte taak niet meer terug te kiezen na "Wijzigen".
      const isTaken = takenTaskIds.has(task.id) && task.id !== value && task.id !== currentTaskId;
      return {
        value: task.id,
        label: isTaken ? `${label} (${t('progressImport.pickerTaken')})` : label,
        disabled: isTaken,
      };
    }),
    [limited, takenTaskIds, value, currentTaskId, t],
  );

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
