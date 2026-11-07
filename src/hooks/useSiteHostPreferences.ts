import { useEffect } from 'react';
import type { UIState } from '@/state/slices/types';
import { useAppStore } from '@/state/appStore';
import i18n, { embeddedLocale, setLocale } from '@/i18n/config';
import { SITE_HOST_READY_EVENT, candidateHosts, siteHostWindows } from '@/services/fileAccess/siteHost';
import { SITE_HOST_PREFERENCES_EVENT, siteHostTheme } from '@/services/fileAccess/siteHostPreferences';
import { disableSiteHostSettings, siteHostSettingsUnavailable } from '@/services/fileAccess/siteHostSettings';

/** Eén melding per sessie: ook bij een tweede mount (StrictMode) of een late host niet opnieuw. */
let unavailableNoticeShown = false;
function noticeIfSettingsUnavailable(): void {
  if (unavailableNoticeShown || !siteHostSettingsUnavailable()) return;
  unavailableNoticeShown = true;
  useAppStore.getState().notify({
    severity: 'info', messageKey: 'notifications.hostSettingsUnavailable', dedupeKey: 'host-settings-unavailable', sticky: true,
  });
}

/**
 * Taal en thema van de host tijdens de sessie, en de melding over zijn instellingen (#818).
 *
 * - `openaec-host-preferences`: de host meldt dat `taal` of `thema` op hetzelfde object veranderde.
 *   De tool leest beide opnieuw en past alleen toe wat ten opzichte van de vorige waarde van de host
 *   veranderde: de taal via i18n (alleen een taal die de tool kent; `de-AT` wordt `de`), het thema via
 *   de store. Niets wordt bewaard: niet in `ops-locale` en niet in `ops-theme`. Zo blijft een keuze die
 *   de gebruiker in de app maakte staan zolang de host die waarde niet zelf wijzigt.
 * - `openaec-host-ready`: alleen als er bij de mount nog geen host was. De tool neemt dan taal en thema
 *   van de host over, maar leest zijn instellingen (`settings`) NIET: instellingen lezen gebeurt alleen
 *   bij de start (`siteHostSettings.ts`). Deze sessie bewaart dan niets bij die host.
 * - Inhaalcontrole bij de mount (review #827 ronde 4): een host die verscheen terwijl `App` laadde (na
 *   de lezing in `main.tsx`, vóór deze luisteraar), krijgt hetzelfde als een late `openaec-host-ready`.
 *   `disableSiteHostSettings` doet niets voor een host die bij de start gelezen werd, of zonder
 *   `settings`. Taal en thema tellen pas als "van de host" als ze echt zijn toegepast; zo neemt de tool
 *   de taal van zo'n host alsnog over. Een ready-event daarna verandert niets meer.
 * - Heeft de host `settings` die de tool deze sessie niet gebruikt (te laat, een fout, of een host die
 *   pas na de start kwam), dan één melding via het meldingenkanaal.
 *
 * Luistert op dezelfde vensters als `useSiteInitialFile` (`siteHostWindows`). Een luisteraar op een
 * same-origin parent verdwijnt niet met dit iframe; daarom ook afmelden bij `pagehide`.
 */
export function useSiteHostPreferences(setUI: (patch: Partial<UIState>) => void): void {
  useEffect(() => {
    noticeIfSettingsUnavailable();
    const targets = siteHostWindows();
    if (targets.length === 0) return;
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
      disableSiteHostSettings();
      noticeIfSettingsUnavailable();
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
      // Inhaalcontrole: dezelfde stappen als `onReady`. Voor een host die bij de start al gelezen werd,
      // verandert dit niets (zie de kop).
      disableSiteHostSettings();
      noticeIfSettingsUnavailable();
      applyPreferences();
    }

    let attached = true;
    const detach = () => {
      if (!attached) return;
      attached = false;
      detachReady();
      for (const target of targets) {
        try { target.removeEventListener(SITE_HOST_PREFERENCES_EVENT, applyPreferences); } catch { /* parent weg */ }
      }
      window.removeEventListener('pagehide', detach);
    };
    window.addEventListener('pagehide', detach);
    return detach;
  }, [setUI]);
}
