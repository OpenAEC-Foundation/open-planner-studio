import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { useResolvedUITheme } from '@/hooks/useResolvedUITheme';
import { ResolvedUITheme, UI_THEMES, DocumentChromeStyle, DateNotation, DurationDisplay, BarSplitMode, UIFontFamily, UI_FONT_FAMILIES, UI_FONT_SCALES, type UIState } from '@/state/slices/types';
import { saveZoomSettings, saveDebugTerminalEnabled, saveDocumentChromeStyle, saveShowClassicViewControls, saveConstructionMode, saveDateNotation, saveEnableHourPlanning, saveShowTaskTypes, saveAllowMixedDayHour, saveDurationDisplay, saveBarSplitMode, saveCompressNonWorkdays, saveUIFontFamily, saveUIFontScale, saveAiAutostart } from '@/utils/settingsStore';
import { applyAiModeLive } from '@/services/mcp/server';
import { isTauri } from '@/utils/platform';
import { Select } from '@/components/common/Select';
import { Info } from 'lucide-react';
import { ScrollZoomSettings } from '@/components/dialogs/ScrollZoomSettings';
import '@/components/dialogs/SettingsDialog.css';
import './SettingsPanelContent.css';
import { applyAutoCalcCPM, applySetting, applyTheme } from './applySetting';
import { LanguageSelect, SettingToggle, THEME_LABEL_KEYS } from './settingControls';

// Drie tabs — Weergave (uiterlijk + Gantt-weergave), Planning (project-brede
// planningsopties) en Geavanceerd (AI, debug, benchmark, rondleiding, versie);
// zie docs/recepten/instelling.md en public/docs/{nl,en}/ref-instellingen.md.
type SettingsTab = 'appearance' | 'planning' | 'advanced';

// Representatieve kleurstalen per thema voor de visuele theme-picker.
const THEME_SWATCHES: Record<ResolvedUITheme, string[]> = {
  'dark':          ['#2A2A32', '#36363E', '#D97706', '#FAFAF9'],
  'light':         ['#FAFAF9', '#F5F5F4', '#D97706', '#36363E'],
  'high-contrast': ['#000000', '#0a0a0a', '#FFFF00', '#FFFFFF'],
};

// i18n-sleutels voor de lettertype-familie-opties — zelfde patroon als THEME_LABEL_KEYS.
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
  const { t } = useTranslation('common');
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
  const showClassicViewControls = useAppStore(s => s.ui.showClassicViewControls);
  const constructionMode = useAppStore(s => s.ui.constructionMode);
  const dateNotation = useAppStore(s => s.ui.dateNotation);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const showTaskTypes = useAppStore(s => s.ui.showTaskTypes);
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

  // --- Live appliers (geen pending state): elke wijziging meteen setUI + persisteren --------
  // Uitzetten landt op het thema dat op dát moment op het scherm staat, niet op een vaste waarde:
  // zo springt er niets bij het omzetten en kies je daarna verder vanaf wat je ziet.
  const applyFollowSystem = (checked: boolean) => applyTheme(checked ? 'system' : resolvedTheme);

  // Knoppen die een andere dialoog openen sluiten eerst de Instellingen-dialoog (tandwiel/ribbon)
  // én Backstage (activeRibbonTab terug naar 'start'), zodat die dialoog vrij opent.
  const openFromSettings = (patch: Partial<UIState>) =>
    setUI({ showSettingsDialog: false, activeRibbonTab: 'start', ...patch });

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
          className={`settings-tab ${activeTab === 'planning' ? 'active' : ''}`}
          onClick={() => setActiveTab('planning')}
        >
          {t('settings.planningTab')}
        </button>
        <button
          className={`settings-tab ${activeTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveTab('advanced')}
        >
          {t('settings.advancedTab')}
        </button>
      </div>

      {/* Right content */}
      <div className="settings-tab-content">
        {activeTab === 'appearance' && (
          <div className="settings-section-list">
            <div className="settings-section">
              <h3>{t('settings.theme')}</h3>
              <p className="scrollzoom-hint">{t('settings.themeHint')}</p>
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
              <SettingToggle
                label={t('settings.themeFollowSystem')}
                checked={followSystem}
                onChange={applyFollowSystem}
                style={{ marginTop: 8 }}
                inputProps={{ 'data-ops-follow-system-theme': true }}
              />
              {followSystem && (
                <p className="scrollzoom-hint">
                  {t('settings.themeSystemHint', { theme: t(THEME_LABEL_KEYS[resolvedTheme]) })}
                </p>
              )}
            </div>

            <div className="settings-section">
              <h3>{t('settings.language')}</h3>
              <LanguageSelect />
              <p className="scrollzoom-hint">{t('settings.languageHint')}</p>
            </div>

            {/* Lettertype interface: familie + grootte. Web-apps volgen — anders dan
                native apps — niet automatisch de systeemlettertype-instelling, wat leesbaarheid/
                toegankelijkheid kan beïnvloeden; hier kiest de gebruiker beide. Familie overschrijft
                via App.tsx de --font-heading/--font-body-variabelen (of herstelt ze bij 'default');
                de schaal stuurt de rem-basis + de calc-px-sizes in de chrome-css. Het effect dat de
                CSS-variabelen/rem-basis daadwerkelijk schrijft zit in App.tsx (één plek). */}
            <div className="settings-section">
              <h3>{t('settings.fontFamilyLabel')}</h3>
              <Select
                aria-label={t('settings.fontFamilyLabel')}
                value={uiFontFamily}
                onChange={v => applySetting('uiFontFamily', v as UIFontFamily, saveUIFontFamily)}
                options={UI_FONT_FAMILIES.map(f => ({ value: f, label: t(FONT_FAMILY_LABEL_KEYS[f]) }))}
              />
              <p className="scrollzoom-hint">{t('settings.fontHint')}</p>
            </div>

            <div className="settings-section">
              <h3>{t('settings.fontScaleLabel')}</h3>
              <Select
                aria-label={t('settings.fontScaleLabel')}
                value={String(uiFontScale)}
                onChange={v => applySetting('uiFontScale', Number(v), saveUIFontScale)}
                options={UI_FONT_SCALES.map(s => ({ value: String(s), label: `${s}%` }))}
              />
              <p className="scrollzoom-hint">{t('settings.fontScaleHint')}</p>
            </div>

            <div className="settings-section">
              <h3>{t('settings.dateNotation')}</h3>
              <Select
                aria-label={t('settings.dateNotation')}
                value={dateNotation}
                onChange={v => applySetting('dateNotation', v as DateNotation, saveDateNotation)}
                // De patroonletters zijn taalgebonden (nl jjjj, en yyyy, de JJJJ, fr aaaa, …),
                // dus door t() en niet hardgecodeerd.
                options={[
                  { value: 'dmy', label: t('settings.dateNotationDmy') },
                  { value: 'mdy', label: t('settings.dateNotationMdy') },
                  { value: 'ymd', label: t('settings.dateNotationYmd') },
                ]}
              />
              <p className="scrollzoom-hint">{t('settings.dateNotationHint')}</p>
            </div>

            <div className="settings-section">
              <h3>{t('settings.durationDisplay')}</h3>
              <Select
                aria-label={t('settings.durationDisplay')}
                value={durationDisplay}
                onChange={v => applySetting('durationDisplay', v as DurationDisplay, saveDurationDisplay)}
                options={[
                  { value: 'auto', label: t('settings.durationDisplayAuto') },
                  { value: 'days', label: t('settings.durationDisplayDays') },
                  { value: 'hours', label: t('settings.durationDisplayHours') },
                ]}
              />
              <p className="scrollzoom-hint">{t('settings.durationDisplayHint')}</p>
            </div>

            <div className="settings-section">
              <h3>{t('settings.documentChrome')}</h3>
              <Select
                aria-label={t('settings.documentChrome')}
                value={documentChromeStyle}
                onChange={v => applySetting('documentChromeStyle', v as DocumentChromeStyle, saveDocumentChromeStyle)}
                options={[
                  { value: 'tabs', label: t('settings.documentChromeTabs') },
                  { value: 'rail', label: t('settings.documentChromeRail') },
                  { value: 'switcher', label: t('settings.documentChromeSwitcher') },
                ]}
              />
              <p className="scrollzoom-hint">{t('settings.documentChromeHint')}</p>
            </div>

            {/* Subkop die de Gantt-tijdlijninstellingen groepeert — geen eigen tab, wel een
                herkenbare knip binnen Weergave. Werkdagen-as, kwartierzoom, taakbalksplitsing en
                scroll/zoom-gedrag horen allemaal bij hoe de tijdlijn zich gedraagt. */}
            <h3 className="settings-subhead">{t('settings.ganttSection')}</h3>

            <div className="settings-section">
              <h3>{t('settings.compressNonWorkdaysSection')}</h3>
              {/* «Alleen werkbare dagen tonen». */}
              <SettingToggle
                label={t('settings.compressNonWorkdays')}
                hint={t('settings.compressNonWorkdaysHint')}
                checked={compressNonWorkdays}
                onChange={checked => applySetting('compressNonWorkdays', checked, saveCompressNonWorkdays)}
              />
            </div>

            <div className="settings-section">
              <h3>{t('settings.quarterHourSection')}</h3>
              <SettingToggle
                label={t('settings.enableQuarterHourZoom')}
                hint={t('settings.enableQuarterHourZoomHint')}
                checked={enableQuarterHourZoom}
                onChange={checked => applySetting('enableQuarterHourZoom', checked, v => saveZoomSettings({ enableQuarterHourZoom: v }))}
              />
            </div>

            <div className="settings-section">
              <h3>{t('settings.barSplitMode')}</h3>
              <Select
                aria-label={t('settings.barSplitMode')}
                value={barSplitMode}
                onChange={v => applySetting('barSplitMode', v as BarSplitMode, saveBarSplitMode)}
                options={[
                  { value: 'never', label: t('settings.barSplitNever') },
                  { value: 'selection', label: t('settings.barSplitSelection') },
                  { value: 'always', label: t('settings.barSplitAlways') },
                ]}
              />
              <p className="scrollzoom-hint">{t('settings.barSplitModeHint')}</p>
            </div>

            <ScrollZoomSettings />
          </div>
        )}

        {activeTab === 'planning' && (
          <div className="settings-section-list">
            {/* Bouwmodus: app-brede schakelaar. AAN = bouwgerichte defaults/framing
                (default). UIT = bouw-agnostisch. Verschijnt via deze gedeelde component op alle 3
                de ingangen (gear/ribbontab/backstage). */}
            <div className="settings-section">
              <h3>{t('settings.constructionModeSection')}</h3>
              {/* De synchrone kalenderfabriek leest de vlag rechtstreeks uit localStorage, dus de save
                  moet vóór een eventuele nieuw-project-actie geschreven zijn — vandaar direct (niet
                  gedebounced). */}
              <SettingToggle
                label={t('settings.constructionMode')}
                hint={t('settings.constructionModeHint')}
                checked={constructionMode}
                onChange={checked => applySetting('constructionMode', checked, saveConstructionMode)}
              />
            </div>

            {/* Urenplanning — hoofdschakelaar + 3 sub-instellingen. Alle vier
                verschijnen op de drie ingangen tegelijk (gedeelde component). De sub-instelling
                "Gemengd toestaan" is alleen actief als de hoofdschakelaar aan staat. */}
            <div className="settings-section">
              <h3>{t('settings.hourPlanningSection')}</h3>
              <SettingToggle
                label={t('settings.enableHourPlanning')}
                hint={t('settings.enableHourPlanningHint')}
                checked={enableHourPlanning}
                onChange={checked => applySetting('enableHourPlanning', checked, saveEnableHourPlanning)}
              />
              {enableHourPlanning && (
                <SettingToggle
                  label={t('settings.allowMixedDayHour')}
                  checked={allowMixedDayHour}
                  onChange={checked => applySetting('allowMixedDayHour', checked, saveAllowMixedDayHour)}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>

            <div className="settings-section">
              <h3>{t('settings.weekStartDay')}</h3>
              <Select
                aria-label={t('settings.weekStartDay')}
                value={weekStartDay}
                onChange={v => applySetting('weekStartDay', v as 'monday' | 'sunday', value => saveZoomSettings({ weekStartDay: value }))}
                options={[
                  { value: 'monday', label: t('settings.weekStartMonday') },
                  { value: 'sunday', label: t('settings.weekStartSunday') },
                ]}
              />
              <p className="scrollzoom-hint">{t('settings.weekStartDayHint')}</p>
            </div>

            <div className="settings-section">
              <h3>{t('settings.calculationSection')}</h3>
              <SettingToggle
                label={t('settings.autoCalcCPM')}
                hint={t('settings.autoCalcCPMHint')}
                checked={autoCalcCPM}
                onChange={applyAutoCalcCPM}
              />
              {/* Werkregels en werk tonen — onder Berekenen (het
                  werkt ook op dagtaken, niet alleen bij urenplanning), zonder eigen sectiekop; de
                  toelichting is één zin in een gekleurd blok i.p.v. een los formulebijschrift. */}
              <label className="settings-checkbox-row" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={showTaskTypes}
                  onChange={e => applySetting('showTaskTypes', e.target.checked, saveShowTaskTypes)}
                  data-ops-setting-show-task-types
                />
                <span>{t('settings.showTaskTypes')}</span>
              </label>
              <div className="ops-note" data-ops-setting-show-task-types-note>
                <Info size={12} aria-hidden />
                <span>{t('settings.showTaskTypesHint')}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="settings-section-list">
            {/* AI-modus + automatisch starten: de enige twee AI-instellingen hier — de rest van
                de bediening leeft op het AI-tabblad. AAN ⇒ tabblad verschijnt; UIT ⇒ tabblad weg +
                bridge geforceerd gestopt (`applyAiModeLive` → `stopMcpServer` + status off). Via deze
                gedeelde component op alle 3 de ingangen (gear/Instellingen-ribbontab/Backstage).
                Automatisch starten hangt ONDER AI-modus: zonder AI-modus is er geen bridge om te
                starten, dus die schakelaar staat dan uit-gegrijsd i.p.v. dat hij stil niets doet. */}
            <div className="settings-section">
              <h3>{t('settings.aiModeSection')}</h3>
              <SettingToggle
                label={t('settings.aiMode')}
                hint={t('settings.aiModeHint')}
                checked={aiMode}
                onChange={checked => { void applyAiModeLive(checked); }}
              />
              <SettingToggle
                label={t('settings.aiAutostart')}
                hint={t('settings.aiAutostartHint')}
                checked={aiAutostart}
                disabled={!aiMode}
                onChange={checked => applySetting('aiAutostart', checked, saveAiAutostart)}
                style={{ opacity: aiMode ? 1 : 0.5 }}
              />
            </div>

            <div className="settings-section">
              <h3>{t('settings.debugTerminal')}</h3>
              <SettingToggle
                label={t('settings.debugTerminalEnable')}
                hint={t('settings.debugTerminalHint')}
                checked={debugTerminalEnabled}
                onChange={checked => applySetting('debugTerminalEnabled', checked, saveDebugTerminalEnabled)}
              />
            </div>

            {/* Benchmark-tool: via deze gedeelde component zichtbaar op alle 3 de
                ingangen (gear/Instellingen-ribbontab/Backstage). */}
            <div className="settings-section">
              <h3>{t('benchmark.section')}</h3>
              <p className="scrollzoom-hint">{t('benchmark.sectionHint')}</p>
              <button className="settings-link" onClick={() => openFromSettings({ showBenchmarkDialog: true })}>
                {t('benchmark.open')}
              </button>
            </div>

            {/* Statistieken: hoe vaak de app gedownload is, per OS en per release (publieke cijfers
                van de stats-branch). Bewust een KNOP naast Benchmark in Geavanceerd en geen eigen
                tabblad — de gemiddelde gebruiker heeft er niets aan. */}
            <div className="settings-section">
              <h3>{t('settings.statsSection')}</h3>
              <p className="scrollzoom-hint">{t('settings.statsSectionHint')}</p>
              <button className="settings-link" onClick={() => openFromSettings({ showStatsDialog: true })}>
                {t('settings.statsOpen')}
              </button>
            </div>

            {/* [Rondleiding]: derde herstart-ingang naast de Ribbon Weergave-knop en de Backstage-NavItem;
                zelfde actie, hergebruikt de bestaande tour-labels (geen nieuwe knoptekst-key nodig).
                Via openFromSettings start de tour altijd vanaf een schone body (zoals Backstage's
                eigen closeBackstage()), ongeacht welke van de 3 ingangen. */}
            <div className="settings-section">
              <h3>{t('tour.restartButton')}</h3>
              <p className="scrollzoom-hint">{t('settings.tourHint')}</p>
              <button
                className="settings-link"
                onClick={() => openFromSettings({ showTourOverlay: true, tourStepIndex: 0 })}
              >
                {t('tour.backstageRestart')}
              </button>
            </div>

            <div className="settings-section">
              <h3>{t('settings.version')}</h3>
              <p className="scrollzoom-hint">{t('settings.versionHint')}</p>
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
            {/* Legacy-functies: vervangen functies, duidelijk als zodanig gemarkeerd. */}
            <div className="settings-section" data-ops-legacy-settings="true">
              <h3>{t('settings.legacySection')}</h3>
              <SettingToggle
                label={t('settings.classicViewControls')}
                hint={t('settings.classicViewControlsHint')}
                checked={showClassicViewControls}
                onChange={checked => applySetting('showClassicViewControls', checked, saveShowClassicViewControls)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
