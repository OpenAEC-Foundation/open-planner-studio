import { useAppStore } from '@/state/appStore';
import type { UIState, UITheme } from '@/state/slices/types';
import { hostThemeWinsNextStart, saveAutoCalcCPM, saveTheme } from '@/utils/settingsStore';

export function applySetting<K extends keyof UIState>(
  key: K,
  value: UIState[K],
  save: (value: UIState[K]) => unknown,
): void {
  useAppStore.getState().setUI({ [key]: value } as Pick<UIState, K>);
  void save(value);
}

let hostThemeNoticeShown = false;

export function applyTheme(theme: UITheme): void {
  const before = useAppStore.getState().ui.uiTheme;
  applySetting('uiTheme', theme, saveTheme);
  if (theme === before || hostThemeNoticeShown || !hostThemeWinsNextStart()) return;
  hostThemeNoticeShown = true;
  useAppStore.getState().notify({
    severity: 'info', messageKey: 'notifications.hostThemeUntilRestart', dedupeKey: 'host-theme-until-restart',
    durationMs: 10_000,
  });
}

export const applyAutoCalcCPM = (checked: boolean) => applySetting('autoCalcCPM', checked, saveAutoCalcCPM);
