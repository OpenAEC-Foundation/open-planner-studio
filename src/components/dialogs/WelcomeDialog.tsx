import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { UITheme, UI_THEMES } from '@/state/slices/types';
import { useResolvedUITheme } from '@/hooks/useResolvedUITheme';
import { saveWelcomeSeen } from '@/utils/settingsStore';
import { Select } from '@/components/common/Select';
// Bewust een EIGEN curated mini-laag, geen hergebruik van de volledige
// SettingsPanelContent-component — wel dezelfde losse bouwstenen.
import { applyAutoCalcCPM, applyTheme } from '@/components/settings/applySetting';
import { LanguageSelect, THEME_LABEL_KEYS } from '@/components/settings/settingControls';

/**
 * Welkomstdialoog — 2 stappen:
 *  1. Korte begroeting + curated mini-laag (taal/thema/auto-bereken) die RECHTSTREEKS dezelfde
 *     `applyTheme`/`applyLocale`/`applyAutoCalcCPM` (settingControls) aanroept als `SettingsPanelContent`
 *     (geen embedded component, geen eigen opslagsleutel — wijzigingen zijn
 *     dus meteen zichtbaar/identiek in tandwiel/ribbon/backstage-settings).
 *  2. "Rondleiding starten?" met Start/Overslaan.
 *
 * ELKE sluitroute (X, Escape, Overslaan op stap 1 of 2, Start) zet `saveWelcomeSeen(true)` —
 * de vlag betekent "gezien", niet "tour afgerond".
 */
export function WelcomeDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const currentTheme = useAppStore(s => s.ui.uiTheme);
  // Zelfde tweetrapsvorm als in de settings-UI: de keuzelijst toont wat er getekend wordt en gaat
  // op slot zolang de systeemschakelaar aanstaat.
  const resolvedTheme = useResolvedUITheme();
  const followSystem = currentTheme === 'system';
  const autoCalcCPM = useAppStore(s => s.ui.autoCalcCPM);
  const [step, setStep] = useState<1 | 2>(1);

  const markSeenAndClose = () => {
    void saveWelcomeSeen(true);
    setUI({ showWelcomeDialog: false });
  };

  const startTour = () => {
    markSeenAndClose();
    setUI({ showTourOverlay: true, tourStepIndex: 0 });
  };

  return (
    // Bewust GEEN backdrop-close (eerste-startdialoog) — alleen Escape/knoppen sluiten.
    <Dialog
      onCancel={markSeenAndClose}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[480px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-welcome-dialog': true }}
    >
        <DialogHeader title={t('welcome.title')} onClose={markSeenAndClose} />

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-body leading-5">
          {step === 1 ? (
            <>
              <p>{t('welcome.introBody')}</p>

              <div className="flex flex-col gap-3">
                <h3 className="!text-small font-semibold uppercase tracking-wider text-text-secondary">
                  {t('welcome.settingsSectionTitle')}
                </h3>

                <div>
                  <label className="block mb-1 text-small leading-4 text-text-secondary">{t('settings.language')}</label>
                  <LanguageSelect />
                </div>

                <div>
                  <label className="block mb-1 text-small leading-4 text-text-secondary">{t('settings.theme')}</label>
                  <Select
                    aria-label={t('settings.theme')}
                    value={followSystem ? resolvedTheme : currentTheme}
                    disabled={followSystem}
                    onChange={v => applyTheme(v as UITheme)}
                    options={UI_THEMES.map(({ id }) => ({ value: id, label: t(THEME_LABEL_KEYS[id]) }))}
                  />
                  <label className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      data-ops-follow-system-theme
                      checked={followSystem}
                      onChange={e => applyTheme(e.target.checked ? 'system' : resolvedTheme)}
                    />
                    <span>{t('settings.themeFollowSystem')}</span>
                  </label>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoCalcCPM}
                    onChange={e => applyAutoCalcCPM(e.target.checked)}
                  />
                  <span>{t('settings.autoCalcCPM')}</span>
                </label>
                <p className="text-small leading-4 text-text-secondary">{t('settings.autoCalcCPMHint')}</p>
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
    </Dialog>
  );
}
