import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task, ConstraintType } from '@/types/task';
import { validateConstraintPair } from '@/engine/scheduler/constraintValidation';
import { DateTextInput } from '@/components/common/DateTextInput';
import { Field } from './shared';

/**
 * Constraint (2.3) + hard-pin (2.9) + secundaire constraint (2.9) + validatie — sectie 5 uit
 * `TaskPropertiesPanel` (fase 2.10, item 2). Pure `{ task, onChange }`. `pinHint`-state is puur
 * lokale UI-feedback (localStorage-gegate eenmalige hint), geen store-koppeling nodig.
 */
export function TaskConstraintFields({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  // Eenmalige, niet-blokkerende hint bij het AANZETTEN van een harde pin (besluit B2): "pin
  // overschrijft relaties". Geen bevestigingsdialoog — gegate op een localStorage-vlag zodat hij
  // maar één keer ooit verschijnt.
  const [pinHint, setPinHint] = useState(false);

  const pairValidation = validateConstraintPair(task.constraint, task.constraint2);
  const isPinnable = task.constraint?.type === 'MSO' || task.constraint?.type === 'MFO';

  return (
    <>
      {/* Constraint & deadline (fase 2.3) — P6-soft: schendingen worden negatieve float.
          Fase 2.9 §5.1/§5.2: harde Mandatory-pin + secundaire constraint.
          Volle paneelbreedte i.p.v. een 2-koloms grid (issue #21 pt. verbetering): de vertaalde
          constraint-labels zijn lange volzinnen + afkorting ("As soon as possible (ASAP)") — in een
          halve kolom (het paneel is standaard 280px) klipte de select vóór de sluit-haakjes, met het
          native pijltje er half doorheen. De datum staat eronder i.p.v. ernaast, zoals `TaskDeadlineField`
          al doet voor een los datumveld. */}
      <Field label={t('properties.constraint')}>
        <select
          value={task.constraint?.type ?? 'ASAP'}
          onChange={e => {
            const type = e.target.value as ConstraintType;
            if (type === 'ASAP') onChange({ constraint: undefined, constraint2: undefined });
            else if (type === 'ALAP') onChange({ constraint: { type }, constraint2: undefined });
            // Bij een niet-MSO/MFO-primair vervalt de harde pin (hard alleen zinvol op MSO/MFO).
            else onChange({ constraint: { type, date: task.constraint?.date ?? task.time.scheduleStart, hard: (type === 'MSO' || type === 'MFO') ? task.constraint?.hard : undefined } });
          }}
          className="input !text-xs !px-2.5 !py-1.5"
        >
          {(['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'] as ConstraintType[]).map(ct => (
            <option key={ct} value={ct}>{t(`constraintType.${ct}`)}</option>
          ))}
        </select>
      </Field>
      {task.constraint && task.constraint.type !== 'ALAP' && (
        <Field label={t('properties.constraintDate')}>
          <DateTextInput
            className="input !text-xs !px-2.5 !py-1.5"
            ariaLabel={t('properties.constraintDate')}
            value={task.constraint.date ?? ''}
            onCommit={v => onChange({ constraint: { ...task.constraint!, date: v } })}
          />
        </Field>
      )}

      {/* Harde Mandatory-pin (fase 2.9 §5.1, besluit B2): alleen bij MSO/MFO. Aanzetten ⇒ eenmalige
          niet-blokkerende hint "pin overschrijft relaties" (geen bevestigingsdialoog). */}
      {isPinnable && (
        <>
          <label className="flex items-center gap-1.5" title={t('properties.hardPinTip')}>
            <input
              type="checkbox"
              checked={!!task.constraint?.hard}
              onChange={e => {
                const on = e.target.checked;
                onChange({ constraint: { ...task.constraint!, hard: on || undefined } });
                if (on && !localStorage.getItem('ops-hardPinHintSeen')) {
                  localStorage.setItem('ops-hardPinHintSeen', '1');
                  setPinHint(true);
                }
              }}
              className="accent-accent"
              data-ops-hard-pin
            />
            {t('properties.hardPin')}
          </label>
          {pinHint && (
            <div
              className="flex items-start gap-2 text-[10px] px-2 py-1.5 rounded"
              style={{ background: 'var(--theme-surface-alt)', color: 'var(--theme-text-muted)' }}
              data-ops-pin-hint
            >
              <span className="flex-1">{t('properties.hardPinHint')}</span>
              <button onClick={() => setPinHint(false)} style={{ color: 'var(--theme-accent)' }}>×</button>
            </div>
          )}
        </>
      )}

      {/* Secundaire constraint (fase 2.9 §5.2): een tweede grens (SNET/FNET/SNLT/FNLT); altijd soft.
          Live validatie via validateConstraintPair — verboden combinaties rood + reden.
          Zelfde volle-breedte-fix als de primaire constraint hierboven (zelfde lange labels,
          zelfde 2-koloms-klip). */}
      {task.constraint && task.constraint.type !== 'ASAP' && task.constraint.type !== 'ALAP' && !task.constraint.hard && (
        <div className="flex flex-col gap-2">
          <Field label={t('properties.constraint2')}>
            <select
              value={task.constraint2?.type ?? ''}
              onChange={e => {
                const type = e.target.value as ConstraintType | '';
                if (!type) onChange({ constraint2: undefined });
                else onChange({ constraint2: { type: type as ConstraintType, date: task.constraint2?.date ?? task.time.scheduleStart } });
              }}
              className={`input !text-xs !px-2.5 !py-1.5 ${!pairValidation.ok ? '!border-[var(--error)]' : ''}`}
              title={!pairValidation.ok ? pairValidation.issues.map(i => t(`properties.constraintPair.${i}`)).join(' · ') : undefined}
              data-ops-constraint2-type
            >
              <option value="">{t('properties.constraint2None')}</option>
              {(['SNET', 'FNET', 'SNLT', 'FNLT'] as ConstraintType[]).map(ct => (
                <option key={ct} value={ct}>{t(`constraintType.${ct}`)}</option>
              ))}
            </select>
          </Field>
          {task.constraint2 && (
            <Field label={t('properties.constraint2Date')}>
              <DateTextInput
                className="input !text-xs !px-2.5 !py-1.5"
                ariaLabel={t('properties.constraint2Date')}
                value={task.constraint2.date ?? ''}
                onCommit={v => onChange({ constraint2: { ...task.constraint2!, date: v } })}
              />
            </Field>
          )}
          {!pairValidation.ok && (
            <div className="text-[10px]" style={{ color: 'var(--error)' }} data-ops-constraint2-error>
              {pairValidation.issues.map(i => t(`properties.constraintPair.${i}`)).join(' · ')}
            </div>
          )}
        </div>
      )}
    </>
  );
}
