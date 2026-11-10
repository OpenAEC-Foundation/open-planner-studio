import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { loadLayouts } from '@/utils/settingsStore';
import { useStoredSettingRefresh } from '@/hooks/useStoredSettingRefresh';
import { builtinLayouts } from '@/components/viewControls/builtinLayouts';
import type { Layout } from '@/types/view';

/**
 * De layouts zoals op het lint: eerst de meegeleverde, dan de eigen layouts en opgeslagen filters (zelfde
 * namen en iconen). Ververst bij een wijziging in een ander venster of door de host (#818), en na het
 * sluiten van de layoutdialoog. `loaded` is pas waar als de eigen layouts gelezen zijn: tot dan geldt een
 * onbekende id niet als verwijderd.
 */
export function useReportLayouts(): { layouts: Layout[]; loaded: boolean } {
  const { t } = useTranslation('common');
  const [own, setOwn] = useState<Layout[] | null>(null);
  const reload = useCallback(() => {
    void loadLayouts().then(setOwn, () => setOwn(prev => prev ?? []));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useStoredSettingRefresh('ops-taskGridLayouts', reload);
  const dialogOpen = useAppStore(s => s.ui.showLayoutsDialog);
  const wasOpen = useRef(dialogOpen);
  useEffect(() => {
    if (wasOpen.current && !dialogOpen) reload();
    wasOpen.current = dialogOpen;
  }, [dialogOpen, reload]);
  return useMemo(() => ({ layouts: [...builtinLayouts(t), ...(own ?? [])], loaded: own !== null }), [t, own]);
}
