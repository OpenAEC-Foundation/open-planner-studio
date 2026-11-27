import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_LABELS, supportedLanguages, setLocale, type Locale } from '@/i18n/config';
import type { ResolvedUITheme } from '@/state/slices/types';
import { saveLocale } from '@/utils/settingsStore';
import { Select } from '@/components/common/Select';

export const THEME_LABEL_KEYS = {
  'dark':          'settings.themeDark',
  'light':         'settings.themeLight',
  'high-contrast': 'settings.themeHighContrast',
} as const satisfies Record<ResolvedUITheme, string>;

function applyLocale(locale: Locale): void {
  void setLocale(locale);
  void saveLocale(locale);
}

export const LANGUAGE_OPTIONS = [...supportedLanguages]
  .sort((a, b) => LANGUAGE_LABELS[a][0].localeCompare(LANGUAGE_LABELS[b][0]))
  .map(code => {
    const [short, label] = LANGUAGE_LABELS[code];
    return { value: code, label: `${short} — ${label}` };
  });

export function LanguageSelect() {
  const { t, i18n } = useTranslation('common');
  return (
    <Select
      aria-label={t('settings.language')}
      value={i18n.language}
      onChange={v => applyLocale(v as Locale)}
      options={LANGUAGE_OPTIONS}
    />
  );
}

export function SettingToggle({ label, hint, checked, onChange, disabled, style, inputProps }: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  style?: CSSProperties;
  inputProps?: Record<string, unknown>;
}) {
  return (
    <>
      <label className="settings-checkbox-row" style={style}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          {...inputProps}
        />
        <span>{label}</span>
      </label>
      {hint && <p className="settings-hint">{hint}</p>}
    </>
  );
}
