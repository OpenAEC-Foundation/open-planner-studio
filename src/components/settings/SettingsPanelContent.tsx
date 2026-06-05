import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Locale, LANGUAGE_LABELS, supportedLanguages } from '@/i18n/config';
import { UITheme, UI_THEMES } from '@/state/slices/types';
import { saveLocale, saveTheme, saveZoomSettings, saveDebugTerminalEnabled } from '@/utils/settingsStore';
import { Select } from '@/components/common/Select';
import { ScrollZoomSettings } from '@/components/dialogs/ScrollZoomSettings';
import '@/components/dialogs/SettingsDialog.css';
import './SettingsPanelContent.css';

type SettingsTab = 'general' | 'language' | 'timeline';

// Representatieve kleurstalen per thema voor de visuele theme-picker.
const THEME_SWATCHES: Record<UITheme, string[]> = {
  'dark':          ['#2A2A32', '#36363E', '#D97706', '#FAFAF9'],
  'light':         ['#FAFAF9', '#F5F5F4', '#D97706', '#36363E'],
  'high-contrast': ['#000000', '#0a0a0a', '#FFFF00', '#FFFFFF'],
};

// i18n-sleutels voor de thema-namen (UI_THEMES.label is alleen een Engelse fallback).
const THEME_LABEL_KEYS = {
  'dark':          'settings.themeDark',
  'light':         'settings.themeLight',
  'high-contrast': 'settings.themeHighContrast',
} as const;

/**
 * Eén gedeelde settings-UI die in alle drie de toegangspunten draait
 * (gear-dialog, Instellingen-ribbon → dialog, en File → Backstage).
 * Alle wijzigingen worden LIVE toegepast en gepersisteerd — geen pending/OK.
 */
export function SettingsPanelContent() {
  const { t, i18n } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const currentTheme = useAppStore(s => s.ui.uiTheme);
  const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);
  const weekStartDay = useAppStore(s => s.ui.weekStartDay);
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // --- Live appliers (geen pending state) -------------------------------
  const applyTheme = (theme: UITheme) => {
    setUI({ uiTheme: theme });
    void saveTheme(theme);
  };

  const applyLocale = (locale: Locale) => {
    void i18n.changeLanguage(locale);
    void saveLocale(locale);
  };

  return (
    <div className="settings-content">
      {/* Left sidebar tabs */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          {t('settings.general')}
        </button>
        <button
          className={`settings-tab ${activeTab === 'language' ? 'active' : ''}`}
          onClick={() => setActiveTab('language')}
        >
          {t('settings.language')}
        </button>
        <button
          className={`settings-tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          {t('settings.timeline')}
        </button>
      </div>

      {/* Right content */}
      <div className="settings-tab-content">
        {activeTab === 'general' && (
          <div className="settings-section-list">
            <div className="settings-section">
              <h3>{t('settings.theme')}</h3>
              <div className="settings-theme-grid">
                {UI_THEMES.map(({ id }) => (
                  <button
                    key={id}
                    type="button"
                    className={`settings-theme-card ${currentTheme === id ? 'active' : ''}`}
                    aria-pressed={currentTheme === id}
                    onClick={() => applyTheme(id)}
                  >
                    <h4>{t(THEME_LABEL_KEYS[id])}</h4>
                    <div className="settings-theme-swatches">
                      {THEME_SWATCHES[id].map((hex, i) => (
                        <span key={i} className="settings-theme-swatch" style={{ background: hex }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <h3>{t('settings.version')}</h3>
              <div className="settings-row">
                <span>{__APP_VERSION__}</span>
              </div>
            </div>

            <div className="settings-section">
              <h3>{t('settings.defaultZoom')}</h3>
              <div className="settings-row">
                <span>30 px/day</span>
              </div>
            </div>

            <div className="settings-section">
              <h3>{t('settings.debugTerminal')}</h3>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={debugTerminalEnabled}
                  onChange={e => {
                    const checked = e.target.checked;
                    setUI({ debugTerminalEnabled: checked });
                    void saveDebugTerminalEnabled(checked);
                  }}
                />
                <span>{t('settings.debugTerminalEnable')}</span>
              </label>
            </div>

            <div className="settings-section">
              <button
                className="settings-link"
                onClick={() => {
                  setUI({ showSettingsDialog: false, showProjectInfoDialog: true });
                }}
              >
                {t('settings.projectInfo')}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'language' && (
          <div className="settings-section-list">
            <div className="settings-section">
              <h3>{t('settings.language')}</h3>
              <Select
                aria-label={t('settings.language')}
                value={i18n.language}
                onChange={v => applyLocale(v as Locale)}
                options={[...supportedLanguages]
                  .sort((a, b) => LANGUAGE_LABELS[a][0].localeCompare(LANGUAGE_LABELS[b][0]))
                  .map(code => {
                    const [short, label] = LANGUAGE_LABELS[code];
                    return { value: code, label: `${short} — ${label}` };
                  })}
              />
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="settings-section-list">
            <div className="settings-section">
              <h3>{t('settings.weekStartDay')}</h3>
              <Select
                aria-label={t('settings.weekStartDay')}
                value={weekStartDay}
                onChange={v => {
                  const value = v as 'monday' | 'sunday';
                  setUI({ weekStartDay: value });
                  void saveZoomSettings({ weekStartDay: value });
                }}
                options={[
                  { value: 'monday', label: t('settings.weekStartMonday') },
                  { value: 'sunday', label: t('settings.weekStartSunday') },
                ]}
              />
            </div>
            <div className="settings-section">
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={enableQuarterHourZoom}
                  onChange={e => {
                    const checked = e.target.checked;
                    setUI({ enableQuarterHourZoom: checked });
                    void saveZoomSettings({ enableQuarterHourZoom: checked });
                  }}
                />
                <span>{t('settings.enableQuarterHourZoom')}</span>
              </label>
            </div>
            <ScrollZoomSettings />
          </div>
        )}
      </div>
    </div>
  );
}
