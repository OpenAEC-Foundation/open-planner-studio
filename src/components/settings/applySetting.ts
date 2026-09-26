import { useAppStore } from '@/state/appStore';
import type { UIState, UITheme } from '@/state/slices/types';
import { saveAutoCalcCPM, saveTheme } from '@/utils/settingsStore';

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

export const applyTheme = (theme: UITheme) => applySetting('uiTheme', theme, saveTheme);

export const applyAutoCalcCPM = (checked: boolean) => applySetting('autoCalcCPM', checked, saveAutoCalcCPM);
