import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import type { ResolvedUITheme } from '@/utils/theme';
import { detectSystemPrefersDark, resolveUITheme, subscribeSystemPrefersDark } from '@/utils/theme';

export function useSystemColorSchemeSync(): void {
  useEffect(() => {
    const setUI = useAppStore.getState().setUI;
    const apply = (prefersDark: boolean) => {
      if (useAppStore.getState().ui.systemPrefersDark !== prefersDark) setUI({ systemPrefersDark: prefersDark });
    };
    apply(detectSystemPrefersDark());
    return subscribeSystemPrefersDark(apply);
  }, []);
}

export function useResolvedUITheme(): ResolvedUITheme {
  return useAppStore(s => resolveUITheme(s.ui.uiTheme, s.ui.systemPrefersDark));
}
