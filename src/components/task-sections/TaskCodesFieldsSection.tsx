import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Field, CustomFieldInput } from './shared';
import { Select } from '@/components/common/Select';

/**
 * Activity codes / custom fields (structuur) — sectie van `TaskPropertiesPanel`.
 * RELATIONEEL/storeful: roept `setTaskActivityCode`/`setTaskCustomField` rechtstreeks
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
      <span className="ui-card-header !text-small !leading-4">{t('structure.title')}</span>
      {activityCodeTypes.map(type => (
        <Field key={type.id} label={type.name}>
          <Select
            aria-label={type.name}
            value={task.activityCodes?.[type.id] ?? ''}
            // Een id dat niet in dit codetype staat (kan via de extensie-API binnenkomen) toont "(geen)"
            // als gewone waarde, zoals de native lijst op main. "(geen)" kiezen wist dat id dan echt:
            // de waarde is anders dan '', dus de Select roept onChange('') aan.
            valueLabel={t('structure.none')}
            onChange={v => setTaskActivityCode(taskId, type.id, v || null)}
            className="!text-small !leading-4 !px-2.5 !py-1.5"
            options={[
              { value: '', label: t('structure.none') },
              ...type.values.map(v => ({
                value: v.id,
                label: `${v.code}${v.description ? ` — ${v.description}` : ''}`,
              })),
            ]}
          />
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
