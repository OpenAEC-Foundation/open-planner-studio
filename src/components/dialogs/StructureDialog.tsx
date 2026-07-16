import { useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/common/Dialog';
import type { CustomFieldType } from '@/types/structure';

const inputCls = 'input !text-xs !px-2 !py-1 w-full';
const FIELD_TYPES: CustomFieldType[] = ['text', 'number', 'integer', 'cost', 'date', 'boolean'];

/**
 * Beheerdialoog voor projectstructuur (fase 2.2): activity-code-types met waarden
 * (code + omschrijving + kleur) en getypeerde custom fields. Wijzigingen gaan direct
 * de store in (alle acties hebben undo); geen aparte concept-kopie nodig.
 */
export function StructureDialog() {
  const { t } = useTranslation('task');
  const setUI = useAppStore(s => s.setUI);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const addActivityCodeType = useAppStore(s => s.addActivityCodeType);
  const renameActivityCodeType = useAppStore(s => s.renameActivityCodeType);
  const removeActivityCodeType = useAppStore(s => s.removeActivityCodeType);
  const addActivityCodeValue = useAppStore(s => s.addActivityCodeValue);
  const updateActivityCodeValue = useAppStore(s => s.updateActivityCodeValue);
  const removeActivityCodeValue = useAppStore(s => s.removeActivityCodeValue);
  const addCustomField = useAppStore(s => s.addCustomField);
  const renameCustomField = useAppStore(s => s.renameCustomField);
  const removeCustomField = useAppStore(s => s.removeCustomField);

  const [newTypeName, setNewTypeName] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');

  const close = () => setUI({ showStructureDialog: false });

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[720px] max-h-[90vh] flex flex-col overflow-hidden"
    >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('structure.title')}
          </span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 text-xs">
          {/* Activity-code-types */}
          <div className="flex flex-col gap-2">
            <span className="ui-card-header !text-xs">{t('structure.activityCodes')}</span>
            <p className="text-text-secondary">{t('structure.activityCodesHint')}</p>
            {activityCodeTypes.map(type => (
              <div key={type.id} className="border border-border rounded-[8px] p-2 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    className={inputCls + ' font-semibold'}
                    value={type.name}
                    onChange={e => renameActivityCodeType(type.id, e.target.value)}
                  />
                  <button
                    onClick={() => removeActivityCodeType(type.id)}
                    title={t('structure.removeType')}
                    style={{ color: 'var(--error)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {type.values.map(v => (
                  <div key={v.id} className="flex items-center gap-1.5 pl-2">
                    <input
                      className="input !text-xs !px-2 !py-1 w-24"
                      value={v.code}
                      placeholder={t('structure.valueCode')}
                      onChange={e => updateActivityCodeValue(type.id, v.id, { code: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      value={v.description ?? ''}
                      placeholder={t('structure.valueDescription')}
                      onChange={e => updateActivityCodeValue(type.id, v.id, { description: e.target.value })}
                    />
                    <input
                      type="color"
                      value={v.color ?? '#94A3B8'}
                      title={t('structure.valueColor')}
                      onChange={e => updateActivityCodeValue(type.id, v.id, { color: e.target.value })}
                      className="w-7 h-6 rounded cursor-pointer border border-border bg-transparent"
                    />
                    <button
                      onClick={() => removeActivityCodeValue(type.id, v.id)}
                      style={{ color: 'var(--error)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addActivityCodeValue(type.id, { code: `${t('structure.newValuePrefix')}${type.values.length + 1}` })}
                  className="btn btn--sm self-start flex items-center gap-1 !text-[11px]"
                >
                  <Plus size={11} />
                  {t('structure.addValue')}
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                className={inputCls}
                value={newTypeName}
                placeholder={t('structure.newTypePlaceholder')}
                onChange={e => setNewTypeName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newTypeName.trim()) {
                    addActivityCodeType(newTypeName.trim());
                    setNewTypeName('');
                  }
                }}
              />
              <button
                onClick={() => { if (newTypeName.trim()) { addActivityCodeType(newTypeName.trim()); setNewTypeName(''); } }}
                className="btn btn--sm flex items-center gap-1 whitespace-nowrap"
              >
                <Plus size={12} />
                {t('structure.addType')}
              </button>
            </div>
          </div>

          <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />

          {/* Custom fields */}
          <div className="flex flex-col gap-2">
            <span className="ui-card-header !text-xs">{t('structure.customFields')}</span>
            <p className="text-text-secondary">{t('structure.customFieldsHint')}</p>
            {customFieldDefs.map(def => (
              <div key={def.id} className="flex items-center gap-2">
                <input
                  className={inputCls}
                  value={def.name}
                  onChange={e => renameCustomField(def.id, e.target.value)}
                />
                <span className="text-text-secondary w-24 shrink-0">{t(`structure.fieldType.${def.type}`)}</span>
                <button onClick={() => removeCustomField(def.id)} style={{ color: 'var(--error)' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                className={inputCls}
                value={newFieldName}
                placeholder={t('structure.newFieldPlaceholder')}
                onChange={e => setNewFieldName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newFieldName.trim()) {
                    addCustomField(newFieldName.trim(), newFieldType);
                    setNewFieldName('');
                  }
                }}
              />
              <select
                className="input !text-xs !px-2 !py-1 w-32"
                value={newFieldType}
                onChange={e => setNewFieldType(e.target.value as CustomFieldType)}
              >
                {FIELD_TYPES.map(ft => (
                  <option key={ft} value={ft}>{t(`structure.fieldType.${ft}`)}</option>
                ))}
              </select>
              <button
                onClick={() => { if (newFieldName.trim()) { addCustomField(newFieldName.trim(), newFieldType); setNewFieldName(''); } }}
                className="btn btn--sm flex items-center gap-1 whitespace-nowrap"
              >
                <Plus size={12} />
                {t('structure.addField')}
              </button>
            </div>
          </div>
        </div>
    </Dialog>
  );
}
