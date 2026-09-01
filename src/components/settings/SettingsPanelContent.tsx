import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { useResolvedUITheme } from '@/hooks/useResolvedUITheme';
import { Locale, LANGUAGE_LABELS, supportedLanguages, setLocale } from '@/i18n/config';
import { UITheme, ResolvedUITheme, UI_THEMES, DocumentChromeStyle, DateNotation, DurationDisplay, BarSplitMode, UIFontFamily, UI_FONT_FAMILIES, UI_FONT_SCALES } from '@/state/slices/types';
import { saveLocale, saveTheme, saveZoomSettings, saveDebugTerminalEnabled, saveDocumentChromeStyle, saveAutoCalcCPM, saveConstructionMode, saveDateNotation, saveEnableHourPlanning, saveAllowMixedDayHour, saveDurationDisplay, saveBarSplitMode, saveCompressNonWorkdays, saveUIFontFamily, saveUIFontScale, saveAiAutostart } from '@/utils/settingsStore';
import { applyAiModeLive } from '@/services/mcp/server';
import { isTauri } from '@/utils/platform';
import { Select } from '@/components/common/Select';
import { ScrollZoomSettings } from '@/components/dialogs/ScrollZoomSettings';
import '@/components/dialogs/SettingsDialog.css';
import './SettingsPanelContent.css';

type SettingsTab = 'appearance' | 'language' | 'timeline' | 'application';

// Representatieve kleurstalen per thema voor de visuele theme-picker.
const THEME_SWATCHES: Record<ResolvedUITheme, string[]> = {
  'dark':          ['#2A2A32', '#36363E', '#D97706', '#FAFAF9'],
  'light':         ['#FAFAF9', '#F5F5F4', '#D97706', '#36363E'],
  'high-contrast': ['#000000', '#0a0a0a', '#FFFF00', '#FFFFFF'],
};

// i18n-sleutels voor de thema-namen (UI_THEMES.label is alleen een Engelse fallback).
const THEME_LABEL_KEYS = {
  'dark':          'settings.themeDark',
  'light':         'settings.themeLight',
  'high-contrast': 'settings.themeHighContrast',
} as const satisfies Record<ResolvedUITheme, string>;

// i18n-sleutels voor de lettertype-familie-opties (issue #25.4) — zelfde patroon als THEME_LABEL_KEYS.
// `as const satisfies` i.p.v. een `Record<UIFontFamily, string>`-annotatie: die annotatie zou de
// waarden verbreden naar `string`, en dan accepteert de getypeerde `t(...)` ze niet meer (i18next
// valideert de sleutel tegen een union van bestaande keys). `satisfies` houdt de
// volledigheidscheck op UIFontFamily én de letterlijke sleuteltypen.
const FONT_FAMILY_LABEL_KEYS = {
  'default': 'settings.fontFamilyDefault',
  'system':  'settings.fontFamilySystem',
  'serif':   'settings.fontFamilySerif',
  'mono':    'settings.fontFamilyMono',
} as const satisfies Record<UIFontFamily, string>;

/**
 * Eén gedeelde settings-UI die in alle drie de toegangspunten draait
 * (gear-dialog, Instellingen-ribbon → dialog, en File → Backstage).
 * Alle wijzigingen worden LIVE toegepast en gepersisteerd — geen pending/OK.
 */
export function SettingsPanelContent() {
  const { t, i18n } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const currentTheme = useAppStore(s => s.ui.uiTheme);
  // Zolang de systeemschakelaar aanstaat is er geen eigen keuze om te tonen: de kaarten staan uit
  // en de kaart die het systeem oplevert is de gemarkeerde.
  const resolvedTheme = useResolvedUITheme();
  const followSystem = currentTheme === 'system';
  const uiFontFamily = useAppStore(s => s.ui.uiFontFamily);
  const uiFontScale = useAppStore(s => s.ui.uiFontScale);
  const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);
  const weekStartDay = useAppStore(s => s.ui.weekStartDay);
  const debugTerminalEnabled = useAppStore(s => s.ui.debugTerminalEnabled);
  const documentChromeStyle = useAppStore(s => s.ui.documentChromeStyle);
  const autoCalcCPM = useAppStore(s => s.ui.autoCalcCPM);
  const constructionMode = useAppStore(s => s.ui.constructionMode);
  const dateNotation = useAppStore(s => s.ui.dateNotation);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const allowMixedDayHour = useAppStore(s => s.ui.allowMixedDayHour);
  const durationDisplay = useAppStore(s => s.ui.durationDisplay);
  const barSplitMode = useAppStore(s => s.ui.barSplitMode);
  const aiMode = useAppStore(s => s.ui.aiMode);
  const aiAutostart = useAppStore(s => s.ui.aiAutostart);
  const compressNonWorkdays = useAppStore(s => s.ui.compressNonWorkdays);

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  // "Wat is er nieuw" handmatig openen: toon JustUpdatedDialog voor de HUIDIGE versie (dus zonder
  // "van"-versie). KRITIEK: `@tauri-apps/*` alleen dynamisch achter `isTauri()` — in de web-build
  // valt dit terug op de build-time versie uit vite-define.
  const openWhatsNew = async () => {
    let version = __APP_VERSION__;
    if (isTauri()) {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        version = await getVersion();
      } catch {
        /* terugval op __APP_VERSION__ */
      }
    }
    setUI({ justUpdated: { from: null, to: version }, showSettingsDialog: false });
  };

  // --- Live appliers (geen pending state) -------------------------------
  const applyTheme = (theme: UITheme) => {
    setUI({ uiTheme: theme });
    void saveTheme(theme);
  };

  // Uitzetten landt op het thema dat op dát moment op het scherm staat, niet op een vaste waarde:
  // zo springt er niets bij het omzetten en kies je daarna verder vanaf wat je ziet.
  const applyFollowSystem = (checked: boolean) => applyTheme(checked ? 'system' : resolvedTheme);

  const applyLocale = (locale: Locale) => {
    void setLocale(locale);
    void saveLocale(locale);
  };

  const applyDocumentChrome = (style: DocumentChromeStyle) => {
    setUI({ documentChromeStyle: style });
    void saveDocumentChromeStyle(style);
  };

  const applyDateNotation = (notation: DateNotation) => {
    setUI({ dateNotation: notation });
    void saveDateNotation(notation);
  };

  // Lettertype interface (issue #25.4): live toepassen + persisteren, zelfde patroon als boven.
  // Het effect dat de CSS-variabelen/rem-basis daadwerkelijk schrijft zit in App.tsx (één plek).
  const applyUIFontFamily = (value: UIFontFamily) => {
    setUI({ uiFontFamily: value });
    void saveUIFontFamily(value);
  };

  const applyUIFontScale = (value: number) => {
    setUI({ uiFontScale: value });
    void saveUIFontScale(value);
  };

  // Bouwmodus (2026-07-13): live toepassen + persisteren (localStorage). De synchrone
  // kalenderfabriek leest de vlag rechtstreeks uit localStorage, dus de save moet vóór een
  // eventuele nieuw-project-actie geschreven zijn — vandaar direct (niet gedebounced).
  const applyConstructionMode = (value: boolean) => {
    setUI({ constructionMode: value });
    void saveConstructionMode(value);
  };

  // Fase 2.8b (§6.8): urenplanning-appliers — live toepassen + persisteren, zelfde patroon als boven.
  const applyEnableHourPlanning = (value: boolean) => {
    setUI({ enableHourPlanning: value });
    void saveEnableHourPlanning(value);
  };

  const applyAllowMixedDayHour = (value: boolean) => {
    setUI({ allowMixedDayHour: value });
    void saveAllowMixedDayHour(value);
  };

  const applyDurationDisplay = (value: DurationDisplay) => {
    setUI({ durationDisplay: value });
    void saveDurationDisplay(value);
  };

  const applyBarSplitMode = (value: BarSplitMode) => {
    setUI({ barSplitMode: value });
    void saveBarSplitMode(value);
  };

  // Issue #21 punt 5 (fase 2): «alleen werkbare dagen tonen».
  const applyCompressNonWorkdays = (checked: boolean) => {
    setUI({ compressNonWorkdays: checked });
    void saveCompressNonWorkdays(checked);
  };

  return (
    <div className="settings-content">
      {/* Left sidebar tabs */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          {t('settings.appearanceTab')}
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
        <button
          className={`settings-tab ${activeTab === 'application' ? 'active' : ''}`}
          onClick={() => setActiveTab('application')}
        >
          {t('settings.applicationTab')}
        </button>
      </div>

      {/* Right content */}
      <div className="settings-tab-content">
        {activeTab === 'appearance' && (
          <div className="settings-section-list">
            <div className="settings-section">
              <h3>{t('settings.theme')}</h3>
              <div className="settings-theme-grid">
                {UI_THEMES.map(({ id }) => (
                  <button
                    key={id}
                    type="button"
                    className={`settings-theme-card ${(followSystem ? resolvedTheme : currentTheme) === id ? 'active' : ''}`}
                    data-ops-theme-card={id}
                    aria-pressed={(followSystem ? resolvedTheme : currentTheme) === id}
                    disabled={followSystem}
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
              <label className="settings-checkbox-row" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  data-ops-follow-system-theme
                  checked={followSystem}
                  onChange={e => applyFollowSystem(e.target.checked)}
                />
                <span>{t('settings.themeFollowSystem')}</span>
              </label>
              {followSystem && (
                <p className="scrollzoom-hint">
                  {t('settings.themeSystemHint', { theme: t(THEME_LABEL_KEYS[resolvedTheme]) })}
                </p>
              )}
            </div>

            {/* Lettertype interface (issue #25.4): familie + grootte. Web-apps volgen — anders dan
                native apps — niet automatisch de systeemlettertype-instelling, wat leesbaarheid/
                toegankelijkheid kan beïnvloeden; hier kiest de gebruiker beide. Familie overschrijft
                via App.tsx de --font-heading/--font-body-variabelen (of herstelt ze bij 'default');
                de schaal stuurt de rem-basis + de calc-px-sizes in de chrome-css. */}
            <div className="settings-section">
              <h3>{t('settings.fontFamilyLabel')}</h3>
              <Select
                aria-label={t('settings.fontFamilyLabel')}
                value={uiFontFamily}
                onChange={v => applyUIFontFamily(v as UIFontFamily)}
                options={UI_FONT_FAMILIES.map(f => ({ value: f, label: t(FONT_FAMILY_LABEL_KEYS[f]) }))}
              />
              <p className="scrollzoom-hint">{t('settings.fontHint')}</p>
            </div>

            <div className="settings-section">
              <h3>{t('settings.fontScaleLabel')}</h3>
              <Select
                aria-label={t('settings.fontScaleLabel')}
                value={String(uiFontScale)}
                onChange={v => applyUIFontScale(Number(v))}
                options={UI_FONT_SCALES.map(s => ({ value: String(s), label: `${s}%` }))}
              />
            </div>

            <div className="settings-section">
              <h3>{t('settings.documentChrome')}</h3>
              <Select
                aria-label={t('settings.documentChrome')}
                value={documentChromeStyle}
                onChange={v => applyDocumentChrome(v as DocumentChromeStyle)}
                options={[
                  { value: 'tabs', label: t('settings.documentChromeTabs') },
                  { value: 'rail', label: t('settings.documentChromeRail') },
                  { value: 'switcher', label: t('settings.documentChromeSwitcher') },
                ]}
              />
            </div>

            <div className="settings-section">
              <h3>{t('settings.dateNotation')}</h3>
              <Select
                aria-label={t('settings.dateNotation')}
                value={dateNotation}
                onChange={v => applyDateNotation(v as DateNotation)}
                // De patroonletters zijn taalgebonden (nl jjjj, en yyyy, de JJJJ, fr aaaa, …),
                // dus door t() en niet hardgecodeerd — ze stonden hier in het Nederlands en
                // bleven daardoor in alle 14 locales onvertaald.
                options={[
                  { value: 'dmy', label: t('settings.dateNotationDmy') },
                  { value: 'mdy', label: t('settings.dateNotationMdy') },
                  { value: 'ymd', label: t('settings.dateNotationYmd') },
                ]}
              />
              <p className="scrollzoom-hint">{t('settings.dateNotationHint')}</p>
            </div>

            {/* Bouwmodus (2026-07-13): app-brede schakelaar. AAN = bouwgerichte defaults/framing
                (default). UIT = bouw-agnostisch. Verschijnt via deze gedeelde component op alle 3
                de ingangen (gear/ribbontab/backstage). */}
            <div className="settings-section">
              <h3>{t('settings.constructionModeSection')}</h3>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={constructionMode}
                  onChange={e => applyConstructionMode(e.target.checked)}
                />
                <span>{t('settings.constructionMode')}</span>
              </label>
              <p className="scrollzoom-hint">{t('settings.constructionModeHint')}</p>
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
            {/* Fase 2.8b (§6.8): Urenplanning — hoofdschakelaar + 3 sub-instellingen. Alle vier
                verschijnen op de drie ingangen tegelijk (gedeelde component). De sub-instelling
                "Gemengd toestaan" is alleen actief als de hoofdschakelaar aan staat. */}
            <div className="settings-section">
              <h3>{t('settings.hourPlanningSection')}</h3>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={enableHourPlanning}
                  onChange={e => applyEnableHourPlanning(e.target.checked)}
                />
                <span>{t('settings.enableHourPlanning')}</span>
              </label>
              <p className="scrollzoom-hint">{t('settings.enableHourPlanningHint')}</p>
              {enableHourPlanning && (
                <label className="settings-checkbox-row" style={{ marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={allowMixedDayHour}
                    onChange={e => applyAllowMixedDayHour(e.target.checked)}
                  />
                  <span>{t('settings.allowMixedDayHour')}</span>
                </label>
              )}
            </div>
            <div className="settings-section">
              <h3>{t('settings.durationDisplay')}</h3>
              <Select
                aria-label={t('settings.durationDisplay')}
                value={durationDisplay}
                onChange={v => applyDurationDisplay(v as DurationDisplay)}
                options={[
                  { value: 'auto', label: t('settings.durationDisplayAuto') },
                  { value: 'days', label: t('settings.durationDisplayDays') },
                  { value: 'hours', label: t('settings.durationDisplayHours') },
                ]}
              />
            </div>
            <div className="settings-section">
              <h3>{t('settings.barSplitMode')}</h3>
              <Select
                aria-label={t('settings.barSplitMode')}
                value={barSplitMode}
                onChange={v => applyBarSplitMode(v as BarSplitMode)}
                options={[
                  { value: 'never', label: t('settings.barSplitNever') },
                  { value: 'selection', label: t('settings.barSplitSelection') },
                  { value: 'always', label: t('settings.barSplitAlways') },
                ]}
              />
            </div>
            <div className="settings-section">
              <h3>{t('settings.compressNonWorkdaysSection')}</h3>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={compressNonWorkdays}
                  onChange={e => applyCompressNonWorkdays(e.target.checked)}
                />
                <span>{t('settings.compressNonWorkdays')}</span>
              </label>
              <p className="scrollzoom-hint">{t('settings.compressNonWorkdaysHint')}</p>
            </div>
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
              <h3>{t('settings.quarterHourSection')}</h3>
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
            <div className="settings-section">
              <h3>{t('settings.calculationSection')}</h3>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={autoCalcCPM}
                  onChange={e => {
                    const checked = e.target.checked;
                    setUI({ autoCalcCPM: checked });
                    void saveAutoCalcCPM(checked);
                  }}
                />
                <span>{t('settings.autoCalcCPM')}</span>
              </label>
              <p className="scrollzoom-hint">{t('settings.autoCalcCPMHint')}</p>
            </div>
            <ScrollZoomSettings />
          </div>
        )}

        {activeTab === 'application' && (
          <div className="settings-section-list">
            <div className="settings-section">
              <h3>{t('settings.version')}</h3>
              <div className="settings-row">
                <span>{__APP_VERSION__}</span>
              </div>
              <button
                className="settings-link"
                onClick={() => {
                  // Sluit de instellingen-dialog (web/gear) en open de update-dialog.
                  setUI({ showSettingsDialog: false, showUpdateDialog: true });
                }}
              >
                {t('updates.checkButton')}
              </button>
              <button
                className="settings-link"
                onClick={() => { void openWhatsNew(); }}
              >
                {t('updates.justUpdated.whatsNewButton')}
              </button>
            </div>

            <div className="settings-section">
              <h3>{t('settings.projectInfoSection')}</h3>
              <button
                className="settings-link"
                onClick={() => {
                  setUI({ showSettingsDialog: false, showProjectInfoDialog: true });
                }}
              >
                {t('settings.projectInfo')}
              </button>
            </div>

            {/* [Rondleiding] (fase 2.10, bugfix — user-melding: de herstart-ingang ontbrak in de
                Instellingen). Derde ingang naast de Ribbon Weergave-knop en de Backstage-NavItem;
                zelfde actie, hergebruikt de bestaande tour-labels (geen nieuwe knoptekst-key nodig).
                Sluit eerst de Instellingen-dialoog (gear/Instellingen-ribbontab) én Backstage
                (activeRibbonTab terug naar 'start', zoals Backstage's eigen closeBackstage()) zodat
                de tour altijd vanaf een schone body start, ongeacht welke van de 3 ingangen. */}
            <div className="settings-section">
              <h3>{t('tour.restartButton')}</h3>
              <p className="scrollzoom-hint">{t('settings.tourHint')}</p>
              <button
                className="settings-link"
                onClick={() => {
                  setUI({
                    showSettingsDialog: false,
                    activeRibbonTab: 'start',
                    showTourOverlay: true,
                    tourStepIndex: 0,
                  });
                }}
              >
                {t('tour.backstageRestart')}
              </button>
            </div>

            {/* Benchmark-tool (pakket S): via deze gedeelde component zichtbaar op alle 3 de
                ingangen (gear/Instellingen-ribbontab/Backstage). Sluit eerst de Instellingen-dialoog
                én Backstage (activeRibbonTab → 'start') zodat de benchmark-dialoog vrij opent. */}
            <div className="settings-section">
              <h3>{t('benchmark.section')}</h3>
              <p className="scrollzoom-hint">{t('benchmark.sectionHint')}</p>
              <button
                className="settings-link"
                onClick={() => {
                  setUI({ showSettingsDialog: false, activeRibbonTab: 'start', showBenchmarkDialog: true });
                }}
              >
                {t('benchmark.open')}
              </button>
            </div>

            {/* AI-modus (T14) + automatisch starten: de enige twee AI-instellingen hier — de rest van
                de bediening leeft op het AI-tabblad. AAN ⇒ tabblad verschijnt; UIT ⇒ tabblad weg +
                bridge geforceerd gestopt (`applyAiModeLive` → `stopMcpServer` + status off). Via deze
                gedeelde component op alle 3 de ingangen (gear/Instellingen-ribbontab/Backstage).
                Automatisch starten hangt ONDER AI-modus: zonder AI-modus is er geen bridge om te
                starten, dus die schakelaar staat dan uit-gegrijsd i.p.v. dat hij stil niets doet. */}
            <div className="settings-section">
              <h3>{t('settings.aiModeSection')}</h3>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={aiMode}
                  onChange={e => { void applyAiModeLive(e.target.checked); }}
                />
                <span>{t('settings.aiMode')}</span>
              </label>
              <p className="scrollzoom-hint">{t('settings.aiModeHint')}</p>
              <label className="settings-checkbox-row" style={{ opacity: aiMode ? 1 : 0.5 }}>
                <input
                  type="checkbox"
                  checked={aiAutostart}
                  disabled={!aiMode}
                  onChange={e => {
                    setUI({ aiAutostart: e.target.checked });
                    void saveAiAutostart(e.target.checked);
                  }}
                />
                <span>{t('settings.aiAutostart')}</span>
              </label>
              <p className="scrollzoom-hint">{t('settings.aiAutostartHint')}</p>
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
          </div>
        )}
      </div>
    </div>
  );
}
