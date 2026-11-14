import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAppStore } from '@/state/appStore';
import { Select } from '@/components/common/Select';
import { Icon } from '@/components/icons';
import { defaultSettingValue, isSettingChanged, resetSetting } from './catalog/settingsCatalog';
import type { ChoiceEntry, ChoiceOption, SettingEntry } from './catalog/types';
import { VisualChoice } from './VisualChoice';

/** De zichtbare naam van een keuze, met het live voorbeeld erachter als de instelling er een heeft. */
export function choiceOptionLabel(entry: ChoiceEntry, option: ChoiceOption, t: TFunction<'common'>): string {
  const label = option.labelKey ? t(option.labelKey) : option.label ?? String(option.value);
  return entry.example ? `${label} · ${entry.example(option.value)}` : label;
}

/** De standaardwaarde als tekst voor de knop terugzetten; leeg als er geen korte tekst voor is. */
function defaultValueLabel(entry: SettingEntry, t: TFunction<'common'>): string {
  if (!entry.binding) return '';
  const value = defaultSettingValue(entry.binding);
  if (entry.kind === 'toggle') return t(value ? 'settings.visualOn' : 'settings.visualOff');
  if (entry.kind === 'choice') {
    const option = entry.options.find(o => o.value === value);
    return option ? choiceOptionLabel(entry, option, t) : '';
  }
  return '';
}

/**
 * Eén instelling: naam met (bij een schakelaar) het vinkje, eventueel een keuzelijst rechts, de uitleg
 * eronder en daaronder het plaatje of de eigen bediening. Wijkt de waarde af van de standaard, dan
 * staat er een stip voor de naam en een knop om de standaard terug te zetten. Een instelling die nu
 * niets doet (een andere instelling of het profiel staat het niet toe) is uitgegrijsd, met de reden.
 */
export function SettingRow({ entry, highlighted }: { entry: SettingEntry; highlighted: boolean }) {
  const { t } = useTranslation('common');
  const available = useAppStore(s => entry.requires ? entry.requires.met(s) : true);
  const changed = useAppStore(s => isSettingChanged(entry, s.ui));
  const value = useAppStore(s => entry.binding ? s.ui[entry.binding.field] : undefined);
  const label = t(entry.labelKey);
  const disabled = !available;

  const resetLabel = (() => {
    const shown = defaultValueLabel(entry, t);
    return shown ? t('settings.resetToDefaultValue', { value: shown }) : t('settings.resetToDefault');
  })();

  const ToggleVisual = entry.kind === 'toggle' ? entry.visual : undefined;
  const ChoiceVisual = entry.kind === 'choice' ? entry.visual : undefined;
  const valueHintKey = entry.kind === 'choice' ? entry.valueHintKeys?.[String(value)] : undefined;

  return (
    <div
      className={`settings-item${changed ? ' is-changed' : ''}${highlighted ? ' is-highlighted' : ''}${disabled ? ' is-unavailable' : ''}`}
      data-ops-setting={entry.id}
      data-ops-setting-changed={changed || undefined}
      data-ops-legacy-settings={entry.legacy || undefined}
      // Focusbaar voor een directe link naar een instelling die nu uitgegrijsd is (geen bediening).
      tabIndex={-1}
    >
      <div className="settings-item-head">
        {changed && <span className="settings-changed-dot" title={t('settings.changedMarker')} aria-hidden="true" />}
        {entry.kind === 'toggle' ? (
          <label className="settings-checkbox-row settings-item-label">
            <input
              type="checkbox"
              checked={value === true}
              disabled={disabled}
              onChange={e => entry.binding.apply(e.target.checked)}
              {...entry.inputProps}
            />
            <span>{label}</span>
          </label>
        ) : (
          <span className="settings-item-label">{label}</span>
        )}
        {changed && <span className="sr-only">{t('settings.changedMarker')}</span>}
        {entry.legacy && <span className="settings-badge">{t('settings.legacyBadge')}</span>}
        <span className="settings-item-spacer" />
        {entry.kind === 'choice' && !ChoiceVisual && (
          <Select
            aria-label={label}
            className="settings-item-select"
            value={String(value)}
            disabled={disabled}
            onChange={v => entry.binding.apply(entry.options.find(o => String(o.value) === v)?.value)}
            options={entry.options.map(o => ({ value: String(o.value), label: choiceOptionLabel(entry, o, t) }))}
          />
        )}
        {entry.kind === 'custom' && entry.inline && (
          <span className="settings-item-select"><entry.Control /></span>
        )}
        {changed && (
          <button
            type="button"
            className="settings-reset"
            title={resetLabel}
            aria-label={`${resetLabel} (${label})`}
            data-ops-setting-reset={entry.id}
            onClick={() => resetSetting(entry)}
          >
            <Icon id="edit.undo" size={12} aria-hidden />
          </button>
        )}
      </div>

      {entry.hintKey && (entry.hintAsNote ? (
        <div className="ops-note" data-ops-setting-note={entry.id}>
          <Icon id="status.info" size={12} aria-hidden />
          <span>{t(entry.hintKey)}</span>
        </div>
      ) : (
        <p className="settings-hint">{t(entry.hintKey)}</p>
      ))}
      {disabled && <p className="settings-hint settings-unavailable-reason">{t(entry.requires!.reasonKey)}</p>}

      {entry.kind === 'toggle' && ToggleVisual && (
        <VisualChoice
          label={label}
          selectedKey={String(value === true)}
          disabled={disabled}
          onSelect={key => entry.binding.apply(key === 'true')}
          options={[false, true].map(on => ({
            key: String(on),
            label: t(on ? 'settings.visualOn' : 'settings.visualOff'),
            visual: <ToggleVisual on={on} />,
          }))}
        />
      )}
      {entry.kind === 'choice' && ChoiceVisual && (
        <VisualChoice
          label={label}
          selectedKey={String(value)}
          disabled={disabled}
          onSelect={key => entry.binding.apply(entry.options.find(o => String(o.value) === key)?.value)}
          options={entry.options.map(o => ({
            key: String(o.value),
            label: choiceOptionLabel(entry, o, t),
            visual: <ChoiceVisual value={String(o.value)} />,
          }))}
        />
      )}
      {valueHintKey && <p className="settings-hint">{t(valueHintKey)}</p>}
      {entry.kind === 'custom' && !entry.inline && (
        <fieldset className="settings-item-body" disabled={disabled}>
          <entry.Control />
        </fieldset>
      )}
    </div>
  );
}
