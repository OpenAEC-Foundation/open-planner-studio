import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { ignoreUnreadable, loadLayouts } from '@/utils/settingsStore';
import { useStoredSettingRefresh } from '@/hooks/useStoredSettingRefresh';
import { builtinLayouts } from '@/components/viewControls/builtinLayouts';
import type { Layout } from '@/types/view';

const LAYOUTS_KEY = 'ops-taskGridLayouts';

export function useReportLayouts(): { layouts: Layout[]; loaded: boolean } {
  const { t } = useTranslation('common');
  const [own, setOwn] = useState<Layout[] | null>(null);
  const reload = useCallback(() => {
    void loadLayouts().then(setOwn, ignoreUnreadable);
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
