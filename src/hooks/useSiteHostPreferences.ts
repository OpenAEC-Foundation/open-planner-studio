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
 * - `openaec-host-ready`: alleen als er bij de start nog geen host was. De tool neemt dan taal en thema
 *   van de host over, maar leest zijn instellingen (`settings`) NIET: instellingen lezen gebeurt alleen
 *   bij de start (`siteHostSettings.ts`). Deze sessie bewaart dan niets bij die host.
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
    let lastTheme = siteHostTheme();
    let lastLocale = embeddedLocale();

    const applyPreferences = () => {
      const theme = siteHostTheme();
      if (theme !== null && theme !== lastTheme) setUI({ uiTheme: theme });
      lastTheme = theme;
      const locale = embeddedLocale();
      if (locale !== null && locale !== lastLocale && locale !== i18n.language) {
        void setLocale(locale).catch(error => console.warn('Taal van de host niet geladen:', error));
      }
      lastLocale = locale;
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
