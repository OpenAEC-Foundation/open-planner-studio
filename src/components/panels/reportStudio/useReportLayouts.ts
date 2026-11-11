import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { loadLayouts, tryReadLocal } from '@/utils/settingsStore';
import { useStoredSettingRefresh } from '@/hooks/useStoredSettingRefresh';
import { builtinLayouts } from '@/components/viewControls/builtinLayouts';
import type { Layout } from '@/types/view';

const LAYOUTS_KEY = 'ops-taskGridLayouts';

/**
 * De layouts zoals op het lint: eerst de meegeleverde, dan de eigen layouts en opgeslagen filters (zelfde
 * namen en iconen). Ververst bij een wijziging in een ander venster of door de host (#818), en na het
 * sluiten van de layoutdialoog. `loaded` is pas waar als de eigen layouts gelezen zijn: tot dan geldt een
 * onbekende id niet als verwijderd. Is de opslag niet te lezen, dan blijft de vorige lijst staan: een leesfout
 * is geen lege lijst, anders viel het rapport terug op Alle taken (review Terra #893, ronde 8).
 */
export function useReportLayouts(): { layouts: Layout[]; loaded: boolean } {
  const { t } = useTranslation('common');
  const [own, setOwn] = useState<Layout[] | null>(null);
  const reload = useCallback(() => {
    const readable = () => tryReadLocal(LAYOUTS_KEY) !== false;
    if (!readable()) return;
    void loadLayouts().then(list => { if (readable()) setOwn(list); }, () => setOwn(prev => prev ?? []));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useStoredSettingRefresh(LAYOUTS_KEY, reload);
  const dialogOpen = useAppStore(s => s.ui.showLayoutsDialog);
  const wasOpen = useRef(dialogOpen);
  useEffect(() => {
    if (wasOpen.current && !dialogOpen) reload();
    wasOpen.current = dialogOpen;
  }, [dialogOpen, reload]);
  return useMemo(() => ({ layouts: [...builtinLayouts(t), ...(own ?? [])], loaded: own !== null }), [t, own]);
}
