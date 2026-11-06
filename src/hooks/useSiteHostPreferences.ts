import { useEffect } from 'react';
import type { UIState } from '@/state/slices/types';
import i18n, { embeddedLocale, initLocale, setLocale } from '@/i18n/config';
import { SITE_HOST_READY_EVENT, candidateHosts, siteHostWindows } from '@/services/fileAccess/siteHost';
import { SITE_HOST_PREFERENCES_EVENT, siteHostTheme } from '@/services/fileAccess/siteHostPreferences';
import { hydrateSiteHostSettings, onSiteHostSettingsHydrated } from '@/services/fileAccess/siteHostSettings';
import { loadAllSettings } from '@/utils/settingsRegistry';

/**
 * Taal, thema en instellingen van de host tijdens de sessie (#818).
 *
 * - `openaec-host-preferences`: de host meldt dat `taal` of `thema` op hetzelfde object veranderde.
 *   De tool leest beide opnieuw en past alleen toe wat ten opzichte van de vorige waarde van de host
 *   veranderde: de taal via i18n (alleen een taal die de tool kent; `de-AT` wordt `de`), het thema via
 *   de store. Niets wordt bewaard: niet in `ops-locale` en niet in `ops-theme`. Zo blijft een keuze die
 *   de gebruiker in de app maakte staan zolang de host die waarde niet zelf wijzigt.
 * - `openaec-host-ready`: alleen als er bij de start nog geen host was. De tool leest dan de
 *   instellingen van de host (`settings`), past ze toe via `loadAllSettings` → `setUI`, kiest de taal
 *   opnieuw en neemt taal en thema van de host over. Daarna meldt hij zich af.
 * - Een late lezing van de instellingen (na de time-out bij de start) past de instellingen alsnog toe:
 *   `loadAllSettings` → `setUI`, `onLateSettings` (de taakgridvoorkeuren) en de taal. Een document dat al
 *   open is, verandert niet: de bouwmodus geldt dan pas voor een nieuw project.
 *
 * Luistert op dezelfde vensters als `useSiteInitialFile` (`siteHostWindows`). Een luisteraar op een
 * same-origin parent verdwijnt niet met dit iframe; daarom ook afmelden bij `pagehide`.
 */
export function useSiteHostPreferences(
  setUI: (patch: Partial<UIState>) => void,
  /** Na het toepassen van instellingen die pas later van de host kwamen (late lezing of late host). */
  onLateSettings?: () => void,
): void {
  useEffect(() => {
    const targets = siteHostWindows();
    if (targets.length === 0) return;
    let disposed = false;
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

    const applySettings = async () => {
      try {
        const patch = await loadAllSettings();
        if (disposed) return;
        setUI(patch);
        onLateSettings?.();
        await initLocale();
      } catch (error) {
        console.warn('Instellingen van de host niet toegepast:', error);
      }
    };

    let readyAttached = false;
    const onReady = () => {
      if (candidateHosts().length === 0) return;
      detachReady();
      void (async () => {
        const outcome = await hydrateSiteHostSettings();
        if (disposed) return;
        if (outcome === 'geladen') await applySettings();
        if (disposed) return;
        applyPreferences();
      })();
    };
    const detachReady = () => {
      if (!readyAttached) return;
      readyAttached = false;
      for (const target of targets) {
        try { target.removeEventListener(SITE_HOST_READY_EVENT, onReady); } catch { /* parent weg */ }
      }
    };

    const offHydrated = onSiteHostSettingsHydrated(() => { void applySettings(); });
    for (const target of targets) target.addEventListener(SITE_HOST_PREFERENCES_EVENT, applyPreferences);
    if (candidateHosts().length === 0) {
      readyAttached = true;
      for (const target of targets) target.addEventListener(SITE_HOST_READY_EVENT, onReady);
    }

    let attached = true;
    const detach = () => {
      if (!attached) return;
      attached = false;
      disposed = true;
      detachReady();
      offHydrated();
      for (const target of targets) {
        try { target.removeEventListener(SITE_HOST_PREFERENCES_EVENT, applyPreferences); } catch { /* parent weg */ }
      }
      window.removeEventListener('pagehide', detach);
    };
    window.addEventListener('pagehide', detach);
    return detach;
  }, [setUI, onLateSettings]);
}
