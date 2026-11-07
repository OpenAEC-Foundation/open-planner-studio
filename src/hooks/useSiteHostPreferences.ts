import { useEffect } from 'react';
import type { UIState } from '@/state/slices/types';
import { useAppStore } from '@/state/appStore';
import { createDefaultUI } from '@/state/slices/uiSlice';
import i18n, { embeddedLocale, initLocale, setLocale } from '@/i18n/config';
import { SITE_HOST_READY_EVENT, candidateHosts, siteHostWindows } from '@/services/fileAccess/siteHost';
import { SITE_HOST_PREFERENCES_EVENT, siteHostTheme } from '@/services/fileAccess/siteHostPreferences';
import {
  adoptLateSiteHostSettings, onSiteHostSettingsEvent, siteHostSettingsDelayed, siteHostSettingsUnavailable,
  takeLateSiteHostSettings, type LateSettingsApplied,
} from '@/services/fileAccess/siteHostSettings';
import { loadAllSettings, settingFieldsByStorageKey } from '@/utils/settingsRegistry';

/** Instellingen die pas na de start binnenkwamen en nu in `localStorage` staan (`siteHostSettings.ts`).
 *  `changed`: de veranderde sleutels. Voor wat buiten de store-velden valt, zoals de taakgrid. */
export type LateSettingsHandler = (changed: ReadonlySet<string>) => void;

/** Eén keer per sessie: ook bij een tweede mount (StrictMode) niet opnieuw. */
let unavailableNoticeShown = false;
function noticeIfSettingsUnavailable(): void {
  if (unavailableNoticeShown || !siteHostSettingsUnavailable()) return;
  unavailableNoticeShown = true;
  useAppStore.getState().notify({
    severity: 'info', messageKey: 'notifications.hostSettingsUnavailable', dedupeKey: 'host-settings-unavailable', sticky: true,
  });
}

let delayDialogShown = false;
function showDelayDialogOnce(): void {
  if (delayDialogShown || !siteHostSettingsDelayed()) return;
  delayDialogShown = true;
  useAppStore.getState().setUI({ showSettingsDelayDialog: true });
}

/**
 * Pas instellingen live toe die pas na de start in `localStorage` kwamen, zoals een gewone start ze
 * zou laden: de store-velden van elke veranderde sleutel (een sleutel die nu ontbreekt, krijgt de
 * standaard van de store), de taal, en via `onLate` de taakgrid. Componenten en modules met een eigen
 * kopie verversen via het `StorageEvent` dat `siteHostSettings.ts` per sleutel stuurt.
 *
 * Grens: de bouwmodus bepaalt de kalender van het eerste document bij het maken van de store. Een laat
 * antwoord verandert die kalender niet meer; het geldt pas voor een volgend nieuw document.
 */
async function applyLateSettings(
  applied: LateSettingsApplied, setUI: (patch: Partial<UIState>) => void, onLate?: LateSettingsHandler,
): Promise<void> {
  const changed = new Set(applied.changed);
  try {
    const loaded = await loadAllSettings();
    const defaults = createDefaultUI();
    const patch: Partial<UIState> = {};
    for (const [key, field] of settingFieldsByStorageKey()) {
      if (!changed.has(key)) continue;
      (patch as Record<string, unknown>)[field] = field in loaded ? loaded[field] : defaults[field];
    }
    if (Object.keys(patch).length > 0) setUI(patch);
    // Ingebed wint de taal van de host (`initLocale`); zonder taal van de host de bewaarde taal.
    if (changed.has('ops-locale')) await initLocale();
    onLate?.(changed);
  } catch (error) {
    console.warn('Instellingen van de host niet toegepast:', error);
  }
}

/** Eén late toepassing tegelijk, in volgorde. */
let lateChain: Promise<void> = Promise.resolve();
function processLateSettings(setUI: (patch: Partial<UIState>) => void, onLate?: LateSettingsHandler): void {
  const applied = takeLateSiteHostSettings();
  if (!applied) return;
  // De belofte van de pop-up is ingelost: dicht, en daarna één korte melding.
  if (useAppStore.getState().ui.showSettingsDelayDialog) setUI({ showSettingsDelayDialog: false });
  lateChain = lateChain.then(() => applyLateSettings(applied, setUI, onLate)).then(() => {
    useAppStore.getState().notify({
      severity: 'info',
      messageKey: applied.reverted ? 'notifications.settingsLoadedLateReverted' : 'notifications.settingsLoadedLate',
      dedupeKey: 'host-settings-late',
    });
  });
}

/**
 * Taal en thema van de host tijdens de sessie, en zijn instellingen (`settings`) als die pas na de
 * start komen (#818).
 *
 * - `openaec-host-preferences`: de host meldt dat `taal` of `thema` op hetzelfde object veranderde.
 *   De tool leest beide opnieuw en past alleen toe wat ten opzichte van de vorige waarde van de host
 *   veranderde: de taal via i18n (alleen een taal die de tool kent; `de-AT` wordt `de`), het thema via
 *   de store. Niets wordt bewaard: niet in `ops-locale` en niet in `ops-theme`. Zo blijft een keuze die
 *   de gebruiker in de app maakte staan zolang de host die waarde niet zelf wijzigt.
 * - De start wachtte vergeefs op de instellingen (geen antwoord binnen 5 s, of een afwijzing): één
 *   pop-up (`SettingsDelayDialog`). `siteHostSettings.ts` wacht op de achtergrond verder.
 * - Komen de instellingen alsnog, dan staan ze al in `localStorage` (de bewaarde winnen, zie
 *   `siteHostSettings.ts`). Deze hook past ze live toe (`applyLateSettings`), sluit de pop-up en geeft
 *   één korte melding; met de zin "teruggezet" als de gebruiker intussen iets wijzigde dat terugging.
 *   Kwamen ze vóór de mount, dan doet de mount dat alsnog.
 * - `openaec-host-ready`: alleen als er bij de mount nog geen host was. De tool neemt dan taal en thema
 *   van de host over en leest zijn instellingen als een laat antwoord (`adoptLateSiteHostSettings`).
 * - Inhaalcontrole bij de mount (review #827 ronde 4): een host die verscheen terwijl `App` laadde (na
 *   de lezing in `main.tsx`, vóór deze luisteraar), krijgt hetzelfde als een late `openaec-host-ready`.
 *   `adoptLateSiteHostSettings` doet niets voor een host die bij de start gelezen werd, of zonder
 *   `settings`. Taal en thema tellen pas als "van de host" als ze echt zijn toegepast; zo neemt de tool
 *   de taal van zo'n host alsnog over. Een ready-event daarna verandert niets meer.
 * - Zet een lokale fout het bewaren uit, dan één blijvende melding via het meldingenkanaal.
 *
 * Luistert op dezelfde vensters als `useSiteInitialFile` (`siteHostWindows`). Een luisteraar op een
 * same-origin parent verdwijnt niet met dit iframe; daarom ook afmelden bij `pagehide`.
 */
export function useSiteHostPreferences(setUI: (patch: Partial<UIState>) => void, onLate?: LateSettingsHandler): void {
  useEffect(() => {
    const onSettingsEvent = () => {
      showDelayDialogOnce();
      noticeIfSettingsUnavailable();
      processLateSettings(setUI, onLate);
    };
    const offSettings = onSiteHostSettingsEvent(onSettingsEvent);
    onSettingsEvent();

    const targets = siteHostWindows();
    if (targets.length === 0) return offSettings;
    // De laatst TOEGEPASTE waarde van de host. Bij de mount alleen wat de start al toepaste: een host die
    // pas tijdens het laden kwam, heeft zijn taal en thema dan nog niet gekregen.
    const startTheme = siteHostTheme();
    let lastTheme = startTheme !== null && useAppStore.getState().ui.uiTheme === startTheme ? startTheme : null;
    const startLocale = embeddedLocale();
    let lastLocale = startLocale !== null && i18n.language === startLocale ? startLocale : null;

    const applyPreferences = () => {
      const theme = siteHostTheme();
      if (theme !== null && theme !== lastTheme) setUI({ uiTheme: theme });
      lastTheme = theme;
      const locale = embeddedLocale();
      if (locale === null || locale === lastLocale) return;
      if (locale === i18n.language) { lastLocale = locale; return; }
      void setLocale(locale)
        .then(() => { if (embeddedLocale() === locale) lastLocale = locale; })
        .catch(error => console.warn('Taal van de host niet geladen:', error));
    };

    let readyAttached = false;
    const onReady = () => {
      if (candidateHosts().length === 0) return;
      detachReady();
      adoptLateSiteHostSettings();
      applyPreferences();
    };
    const detachReady = () => {
      if (!readyAttached) return;
      readyAttached = false;
      for (const target of targets) {
        try { target.removeEventListener(SITE_HOST_READY_EVENT, onReady); } catch { /* parent weg */ }
      }
    };

    for (const target of targets) target.addEventListener(SITE_HOST_PREFERENCES_EVENT, applyPreferences);
    if (candidateHosts().length === 0) {
      readyAttached = true;
      for (const target of targets) target.addEventListener(SITE_HOST_READY_EVENT, onReady);
    } else {
      // Inhaalcontrole: dezelfde stappen als een ready-event. Voor een host die bij de start al gelezen
      // werd, verandert dit niets (zie de kop).
      onReady();
    }

    let attached = true;
    const detach = () => {
      if (!attached) return;
      attached = false;
      offSettings();
      detachReady();
      for (const target of targets) {
        try { target.removeEventListener(SITE_HOST_PREFERENCES_EVENT, applyPreferences); } catch { /* parent weg */ }
      }
      window.removeEventListener('pagehide', detach);
    };
    window.addEventListener('pagehide', detach);
    return detach;
  }, [setUI, onLate]);
}
