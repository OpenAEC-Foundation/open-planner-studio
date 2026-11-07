import { useAppStore } from '@/state/appStore';
import type { UIState, UITheme } from '@/state/slices/types';
import { hostThemeWinsNextStart, saveAutoCalcCPM, saveTheme } from '@/utils/settingsStore';

// Bewust een losse module zonder `@/i18n/config`: het lint (ribbonWidgets) gebruikt dit ook, en
// headless checks laden dat lint in Node zonder DOM.

/** Live toepassen + persisteren: het vaste recept van een instelling (eerst setUI, dan de saver). */
export function applySetting<K extends keyof UIState>(
  key: K,
  value: UIState[K],
  save: (value: UIState[K]) => unknown,
): void {
  useAppStore.getState().setUI({ [key]: value } as Pick<UIState, K>);
  void save(value);
}

/** Eén melding per sessie (#818): ook bij een volgende themawissel niet opnieuw. */
let hostThemeNoticeShown = false;

/** De themakeuze van de gebruiker, via elke route (⚙, Instellingen-tab, Backstage, welkomstvenster).
 *  Een wissel van de host (`useSiteHostPreferences`) en de start (`settingsRegistry`) zetten
 *  `uiTheme` direct en komen hier niet langs. Ingebed met een thema van de host geldt de keuze maar
 *  tot de volgende start; de eerste echte wissel meldt dat één keer. */
export function applyTheme(theme: UITheme): void {
  const before = useAppStore.getState().ui.uiTheme;
  applySetting('uiTheme', theme, saveTheme);
  if (theme === before || hostThemeNoticeShown || !hostThemeWinsNextStart()) return;
  hostThemeNoticeShown = true;
  useAppStore.getState().notify({
    severity: 'info', messageKey: 'notifications.hostThemeUntilRestart', dedupeKey: 'host-theme-until-restart',
    // Twee zinnen: iets langer dan de standaard 5 s, zodat de gebruiker ze kan lezen.
    durationMs: 10_000,
  });
}

export const applyAutoCalcCPM = (checked: boolean) => applySetting('autoCalcCPM', checked, saveAutoCalcCPM);
