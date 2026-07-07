import { useTranslation } from 'react-i18next';
import { Task, MilestoneKind } from '@/types/task';
import { Field } from './shared';

/**
 * Mijlpaal-checkbox + mijlpaal-soort (2.4) + verplicht-vlag (2.4) — sectie 3 uit
 * `TaskPropertiesPanel` (fase 2.10, item 2). Pure `{ task, onChange }`.
 */
export function TaskMilestoneFields({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');

  return (
    <>
      <div className="flex gap-2">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={task.isMilestone}
            onChange={e => {
              // Mijlpaal = duur 0 (paritair met TaskDialog); uitvinken geeft de
              // standaardduur terug zodat de balk niet onzichtbaar blijft.
              const on = e.target.checked;
              onChange({
                isMilestone: on,
                ...(on ? {} : { milestoneKind: undefined, mandatory: undefined }),
                time: { ...task.time, scheduleDuration: on ? 0 : (task.time.scheduleDuration || 5) },
              });
            }}
            className="accent-accent"
          />
          {t('properties.milestone')}
        </label>
      </div>

      {task.isMilestone && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('properties.milestoneKind')}>
            <select
              value={task.milestoneKind ?? 'AUTO'}
              onChange={e => {
                const v = e.target.value;
                onChange({ milestoneKind: v === 'AUTO' ? undefined : (v as MilestoneKind) });
              }}
              className="input !text-xs !px-2.5 !py-1.5"
            >
              <option value="AUTO">{t('milestoneKind.AUTO')}</option>
              <option value="START">{t('milestoneKind.START')}</option>
              <option value="FINISH">{t('milestoneKind.FINISH')}</option>
            </select>
          </Field>
          <label className="flex items-center gap-1.5 self-end pb-1.5">
            <input
              type="checkbox"
              checked={!!task.mandatory}
              onChange={e => onChange({ mandatory: e.target.checked || undefined })}
              className="accent-accent"
            />
            {t('properties.mandatory')}
          </label>
        </div>
      )}
    </>
  );
}
