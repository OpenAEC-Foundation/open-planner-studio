import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { useDialogKeys } from '@/hooks/useDialogKeys';
import { Locale, LANGUAGE_LABELS, supportedLanguages } from '@/i18n/config';
import { UITheme, UI_THEMES } from '@/state/slices/types';
import { saveLocale, saveTheme, saveAutoCalcCPM, saveWelcomeSeen } from '@/utils/settingsStore';
import { Select } from '@/components/common/Select';

// i18n-sleutels voor de thema-namen — zelfde subset als SettingsPanelContent.tsx (THEME_LABEL_KEYS),
// hier lokaal gedupliceerd i.p.v. geïmporteerd: het architect-besluit (§2 van het ontwerpdocument)
// is een EIGEN curated mini-laag, geen hergebruik van de volledige SettingsPanelContent-component.
const THEME_LABEL_KEYS = {
  'dark':          'settings.themeDark',
  'light':         'settings.themeLight',
  'high-contrast': 'settings.themeHighContrast',
} as const satisfies Record<UITheme, string>;

/**
 * Welkomstdialoog (fase 2.10, onderdeel 3, §6) — 2 stappen:
 *  1. Korte begroeting + curated mini-laag (taal/thema/auto-bereken) die RECHTSTREEKS dezelfde
 *     `applyTheme`/`applyLocale`/`autoCalcCPM`-opslagpatronen aanroept als `SettingsPanelContent`
 *     (architect-besluit 1: geen embedded component, geen eigen opslagsleutel — wijzigingen zijn
 *     dus meteen zichtbaar/identiek in tandwiel/ribbon/backstage-settings).
 *  2. "Rondleiding starten?" met Start/Overslaan.
 *
 * ELKE sluitroute (X, Escape, Overslaan op stap 1 of 2, Start) zet `saveWelcomeSeen(true)` —
 * de vlag betekent "gezien", niet "tour afgerond" (architect-besluit 4).
 */
export function WelcomeDialog() {
  const { t, i18n } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const currentTheme = useAppStore(s => s.ui.uiTheme);
  const autoCalcCPM = useAppStore(s => s.ui.autoCalcCPM);
  const [step, setStep] = useState<1 | 2>(1);

  const markSeenAndClose = () => {
    void saveWelcomeSeen(true);
    setUI({ showWelcomeDialog: false });
  };

  useDialogKeys({ onCancel: markSeenAndClose });

  const applyTheme = (theme: UITheme) => {
    setUI({ uiTheme: theme });
    void saveTheme(theme);
  };

  const applyLocale = (locale: Locale) => {
    void i18n.changeLanguage(locale);
    void saveLocale(locale);
  };

  const applyAutoCalcCPM = (checked: boolean) => {
    setUI({ autoCalcCPM: checked });
    void saveAutoCalcCPM(checked);
  };

  const startTour = () => {
    markSeenAndClose();
    setUI({ showTourOverlay: true, tourStepIndex: 0 });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[480px] max-h-[88vh] flex flex-col overflow-hidden"
        data-ops-welcome-dialog
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('welcome.title')}
          </span>
          <button onClick={markSeenAndClose} className="p-1 hover:bg-surface-hover rounded-[8px]" aria-label={t('close')}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-sm">
          {step === 1 ? (
            <>
              <p>{t('welcome.introBody')}</p>

              <div className="flex flex-col gap-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  {t('welcome.settingsSectionTitle')}
                </h3>

                <div>
                  <label className="block mb-1 text-xs text-text-secondary">{t('settings.language')}</label>
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

                <div>
                  <label className="block mb-1 text-xs text-text-secondary">{t('settings.theme')}</label>
                  <Select
                    aria-label={t('settings.theme')}
                    value={currentTheme}
                    onChange={v => applyTheme(v as UITheme)}
                    options={UI_THEMES.map(({ id }) => ({ value: id, label: t(THEME_LABEL_KEYS[id]) }))}
                  />
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoCalcCPM}
                    onChange={e => applyAutoCalcCPM(e.target.checked)}
                  />
                  <span>{t('settings.autoCalcCPM')}</span>
                </label>
                <p className="text-xs text-text-secondary">{t('settings.autoCalcCPMHint')}</p>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">{t('welcome.tourStepTitle')}</p>
              <p className="text-text-secondary">{t('welcome.tourStepBody')}</p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
          <button onClick={markSeenAndClose} className="btn btn--sm">{t('welcome.skip')}</button>
          {step === 1 ? (
            <button onClick={() => setStep(2)} className="btn btn--sm btn--primary">{t('welcome.next')}</button>
          ) : (
            <button onClick={startTour} className="btn btn--sm btn--primary">{t('welcome.startTour')}</button>
          )}
        </div>
      </div>
    </div>
  );
}
