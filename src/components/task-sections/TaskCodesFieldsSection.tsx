import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Field, CustomFieldInput } from './shared';

/**
 * Activity codes / custom fields (structuur) — sectie 11 uit `TaskPropertiesPanel` (fase 2.10,
 * item 2). RELATIONEEL/storeful: roept `setTaskActivityCode`/`setTaskCustomField` rechtstreeks
 * aan, identiek in paneel én dialoog.
 */
export function TaskCodesFieldsSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const tasks = useAppStore(s => s.tasks);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const setTaskActivityCode = useAppStore(s => s.setTaskActivityCode);
  const setTaskCustomField = useAppStore(s => s.setTaskCustomField);

  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;
  if (activityCodeTypes.length === 0 && customFieldDefs.length === 0) return null;

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-xs">{t('structure.title')}</span>
      {activityCodeTypes.map(type => (
        <Field key={type.id} label={type.name}>
          <select
            value={task.activityCodes?.[type.id] ?? ''}
            onChange={e => setTaskActivityCode(taskId, type.id, e.target.value || null)}
            className="input !text-xs !px-2.5 !py-1.5"
          >
            <option value="">{t('structure.none')}</option>
            {type.values.map(v => (
              <option key={v.id} value={v.id}>
                {v.code}{v.description ? ` — ${v.description}` : ''}
              </option>
            ))}
          </select>
        </Field>
      ))}
      {customFieldDefs.map(def => (
        <Field key={def.id} label={def.name}>
          <CustomFieldInput
            def={def}
            value={task.customFields?.[def.id]}
            onCommit={value => setTaskCustomField(taskId, def.id, value)}
          />
        </Field>
      ))}
    </>
  );
}
