import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task, ConstraintType } from '@/types/task';
import { validateConstraintPair, withPrimaryConstraint } from '@/engine/scheduler/constraintValidation';
import { DateTextInput } from '@/components/common/DateTextInput';
import { Select } from '@/components/common/Select';
import { Field } from './shared';
import { readLocal, writeLocal } from '@/utils/settingsStore';

const PRIMARY_TYPES: ConstraintType[] = ['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'];
const SECONDARY_TYPES: ConstraintType[] = ['SNET', 'FNET', 'SNLT', 'FNLT'];

/**
 * Constraint + hard-pin + secundaire constraint + validatie — sectie van
 * `TaskPropertiesPanel`. Pure `{ task, onChange }`. `pinHint`-state is puur
 * lokale UI-feedback (localStorage-gegate eenmalige hint), geen store-koppeling nodig.
 */
export function TaskConstraintFields({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  // Eenmalige, niet-blokkerende hint bij het AANZETTEN van een harde pin: "pin
  // overschrijft relaties". Geen bevestigingsdialoog — gegate op een localStorage-vlag zodat hij
  // maar één keer ooit verschijnt.
  const [pinHint, setPinHint] = useState(false);
  const constraint2ErrorId = `${useId()}-constraint2-error`;

  const pairValidation = validateConstraintPair(task.constraint, task.constraint2);
  const isPinnable = task.constraint?.type === 'MSO' || task.constraint?.type === 'MFO';

  return (
    <>
      {/* Constraint & deadline — P6-soft: schendingen worden negatieve float.
          Plus harde Mandatory-pin + secundaire constraint.
          Volle paneelbreedte i.p.v. een 2-koloms grid: de vertaalde
          constraint-labels zijn lange volzinnen + afkorting ("As soon as possible (ASAP)") — in een
          halve kolom (het paneel is standaard 280px) klipt de keuzelijst vóór de sluit-haakjes. De datum staat eronder
          i.p.v. ernaast, zoals `TaskDeadlineField` al doet voor een los datumveld. */}
      <Field label={t('properties.constraint')}>
        <Select
          aria-label={t('properties.constraint')}
          value={task.constraint?.type ?? 'ASAP'}
          onChange={value => {
            const type = value as ConstraintType;
            // Gedeelde canonicalisatie met raster en MCP (`withPrimaryConstraint`): ASAP wist
            // beide constraints, ALAP de secundaire. Bij een niet-MSO/MFO-primair vervalt de harde
            // pin (hard alleen zinvol op MSO/MFO).
            const hard = (type === 'MSO' || type === 'MFO') ? task.constraint?.hard : undefined;
            onChange(withPrimaryConstraint(
              { type, date: task.constraint?.date ?? task.time.scheduleStart, hard },
              task.constraint2,
            ));
          }}
          className="!text-small !leading-4 !px-2.5 !py-1.5"
          options={PRIMARY_TYPES.map(ct => ({ value: ct, label: t(`constraintType.${ct}`) }))}
        />
      </Field>
      {task.constraint && task.constraint.type !== 'ALAP' && (
        <Field label={t('properties.constraintDate')}>
          <DateTextInput
            className="input !text-small !leading-4 !px-2.5 !py-1.5"
            ariaLabel={t('properties.constraintDate')}
            value={task.constraint.date ?? ''}
            // Elk type dat hier een datumveld toont, vraagt een datum (zoals het raster: `required`).
            required
            onCommit={v => { if (v) onChange({ constraint: { ...task.constraint!, date: v } }); }}
          />
        </Field>
      )}

      {/* Harde Mandatory-pin: alleen bij MSO/MFO. Aanzetten ⇒ eenmalige
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
                if (on && !readLocal('ops-hardPinHintSeen')) {
                  writeLocal('ops-hardPinHintSeen', '1');
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
              className="flex items-start gap-2 !text-small px-2 py-1.5 rounded"
              style={{ background: 'var(--theme-surface-alt)', color: 'var(--theme-text-muted)' }}
              data-ops-pin-hint
            >
              <span className="flex-1">{t('properties.hardPinHint')}</span>
              <button onClick={() => setPinHint(false)} style={{ color: 'var(--theme-accent)' }}>×</button>
            </div>
          )}
        </>
      )}

      {/* Secundaire constraint: een tweede grens (SNET/FNET/SNLT/FNLT); altijd soft.
          Live validatie via validateConstraintPair — verboden combinaties rood + reden.
          Zelfde volle-breedte-fix als de primaire constraint hierboven (zelfde lange labels,
          zelfde 2-koloms-klip). */}
      {task.constraint && task.constraint.type !== 'ASAP' && task.constraint.type !== 'ALAP' && !task.constraint.hard && (
        <div className="flex flex-col gap-2">
          <Field label={t('properties.constraint2')}>
            <Select
              aria-label={t('properties.constraint2')}
              value={task.constraint2?.type ?? ''}
              onChange={value => {
                const type = value as ConstraintType | '';
                if (!type) onChange({ constraint2: undefined });
                else onChange({ constraint2: { type: type as ConstraintType, date: task.constraint2?.date ?? task.time.scheduleStart } });
              }}
              className={`!text-small !leading-4 !px-2.5 !py-1.5 ${!pairValidation.ok ? '!border-[var(--error)]' : ''}`}
              aria-invalid={!pairValidation.ok ? true : undefined}
              // De reden staat zichtbaar onder de keuzelijst; de trigger verwijst ernaar.
              aria-describedby={!pairValidation.ok ? constraint2ErrorId : undefined}
              // Een secundair type buiten de lijst (bv. MSO uit een IFC-pset) heeft geen optie; toon
              // dan toch zijn naam in de trigger, als gewone waarde (hij is echt gezet).
              valueLabel={task.constraint2 ? t(`constraintType.${task.constraint2.type}`) : undefined}
              options={[
                { value: '', label: t('properties.constraint2None') },
                ...SECONDARY_TYPES.map(ct => ({ value: ct, label: t(`constraintType.${ct}`) })),
              ]}
            />
          </Field>
          {task.constraint2 && (
            <Field label={t('properties.constraint2Date')}>
              <DateTextInput
                className="input !text-small !leading-4 !px-2.5 !py-1.5"
                ariaLabel={t('properties.constraint2Date')}
                value={task.constraint2.date ?? ''}
                required
                onCommit={v => { if (v) onChange({ constraint2: { ...task.constraint2!, date: v } }); }}
              />
            </Field>
          )}
          {!pairValidation.ok && (
            <div id={constraint2ErrorId} className="!text-small" style={{ color: 'var(--error)' }} data-ops-constraint2-error>
              {pairValidation.issues.map(i => t(`properties.constraintPair.${i}`)).join(' · ')}
            </div>
          )}
        </div>
      )}
    </>
  );
}
