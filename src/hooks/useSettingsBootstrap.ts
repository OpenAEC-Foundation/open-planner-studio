import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { initLocale } from '@/i18n/config';
import { initTheme, loadZoomSettings, loadDebugTerminalEnabled, loadDocumentChromeStyle, loadLeftPanelWidth, loadRightPanelWidth, loadRibbonCompact, loadShowHistogram, loadHistogramHeight, loadShowBaselineOverlay, loadShowProgressLine, loadShowStatusDateLine, loadShowMiniMap, loadAutoCalcCPM, loadConstructionMode, loadDateNotation, loadEnableHourPlanning, loadAllowMixedDayHour, loadDurationDisplay, loadBarSplitMode, loadWelcomeSeen } from '@/utils/settingsStore';
import { loadAllExtensions } from '@/extensions';
import type { RecoveryState } from './useRecoveryRestore';

// Bootstrap van app-instellingen bij het opstarten: hydrateert de store uit localStorage
// (thema, locale, zoom, panelen, urenplanning, …) plus extensies, en toont de eerste-keer
// welkomstdialoog. De welkomstcheck hangt af van de recovery-flow (zie hieronder).
export function useSettingsBootstrap(recoveryResolved: boolean, recovery: RecoveryState | null): void {
  const setUI = useAppStore(s => s.setUI);

  useEffect(() => {
    initLocale();
    initTheme().then(theme => {
      setUI({ uiTheme: theme });
    });
    loadZoomSettings().then(zs => {
      if (Object.keys(zs).length > 0) setUI(zs);
    });
    loadDebugTerminalEnabled().then(v => {
      if (typeof v === 'boolean') setUI({ debugTerminalEnabled: v });
    });
    loadDocumentChromeStyle().then(style => {
      if (style) setUI({ documentChromeStyle: style });
    });
    loadLeftPanelWidth().then(w => {
      if (typeof w === 'number') setUI({ leftPanelWidth: w });
    });
    loadRightPanelWidth().then(w => {
      if (typeof w === 'number') setUI({ rightPanelWidth: w });
    });
    loadRibbonCompact().then(v => {
      if (typeof v === 'boolean') setUI({ ribbonCompact: v });
    });
    loadShowHistogram().then(v => {
      if (typeof v === 'boolean') setUI({ showHistogram: v });
    });
    loadHistogramHeight().then(h => {
      if (typeof h === 'number') setUI({ histogramHeight: h });
    });
    loadShowBaselineOverlay().then(v => {
      if (typeof v === 'boolean') setUI({ showBaselineOverlay: v });
    });
    loadShowProgressLine().then(v => {
      if (typeof v === 'boolean') setUI({ showProgressLine: v });
    });
    loadShowStatusDateLine().then(v => {
      if (typeof v === 'boolean') setUI({ showStatusDateLine: v });
    });
    loadShowMiniMap().then(v => {
      if (typeof v === 'boolean') setUI({ showMiniMap: v });
    });
    loadAutoCalcCPM().then(v => {
      if (typeof v === 'boolean') setUI({ autoCalcCPM: v });
    });
    // Bouwmodus (2026-07-13): synchroon (geen Promise) — hydrateert de store uit localStorage.
    setUI({ constructionMode: loadConstructionMode() });
    loadDateNotation().then(v => {
      if (v) setUI({ dateNotation: v });
    });
    // Fase 2.8b (§6.8): urenplanning-instellingen — ontbrekende sleutel ⇒ default (undefined → geen setUI).
    loadEnableHourPlanning().then(v => {
      if (typeof v === 'boolean') setUI({ enableHourPlanning: v });
    });
    loadAllowMixedDayHour().then(v => {
      if (typeof v === 'boolean') setUI({ allowMixedDayHour: v });
    });
    loadDurationDisplay().then(v => {
      if (v) setUI({ durationDisplay: v });
    });
    loadBarSplitMode().then(v => {
      if (v) setUI({ barSplitMode: v });
    });
    void loadAllExtensions();
  }, []);

  // First-startup-ervaring (fase 2.10, onderdeel 3, §3): toont de WelcomeDialog bij een verse
  // `!loadWelcomeSeen()`. Eigen ref-guard (`welcomeChecked`) naar het recovery-/update-check-
  // patroon, maar reageert op de REACTIEVE `recoveryResolved`-state (niet de `recoveryChecked`-
  // ref, die synchroon al waar is vóórdat de async detectie/dialoogkeuze daadwerkelijk is
  // afgerond) — zo vuurt dit effect pas nadat de recovery-flow ECHT klaar is (geen data gevonden,
  // of de gebruiker heeft hersteld/verworpen/uitgesteld), nooit gelijktijdig met een zichtbare
  // `RecoveryDialog`. Werkt zowel in Tauri als browser-build — de `welcomeSeen`-vlag leeft in
  // localStorage, dat overal werkt.
  const welcomeChecked = useRef(false);
  useEffect(() => {
    if (welcomeChecked.current) return;
    if (!recoveryResolved) return; // wacht tot de recovery-flow (incl. eventuele keuze) echt klaar is
    if (recovery !== null) return; // RecoveryDialog is zichtbaar — welkomstdialoog wacht
    welcomeChecked.current = true;

    loadWelcomeSeen().then(seen => {
      if (!seen) setUI({ showWelcomeDialog: true });
    });
  }, [recoveryResolved, recovery, setUI]);
}
