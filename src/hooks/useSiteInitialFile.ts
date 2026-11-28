import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { isActivePristine } from '@/state/slices/fileSlice';
import { buildImportLabels } from '@/i18n/importLabels';
import { SITE_HOST_READY_EVENT, siteHostWindows, siteInitialFileId } from '@/services/fileAccess/siteHost';
import type { RecoveryState } from './useRecoveryRestore';

export function useSiteInitialFile(recoveryResolved: boolean, recovery: RecoveryState | null): void {
  const { t } = useTranslation('common');
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !recoveryResolved || recovery !== null) return;

    const tryOpen = (): boolean => {
      const id = siteInitialFileId();
      if (!id) return false;
      started.current = true;
      if (!isActivePristine(useAppStore.getState())) return true;
      void useAppStore.getState().openFromSite(id, buildImportLabels(t));
      return true;
    };

    if (tryOpen()) return;
    const targets = siteHostWindows();
    let attached = true;
    const detach = () => {
      if (!attached) return;
      attached = false;
      for (const target of targets) {
        try { target.removeEventListener(SITE_HOST_READY_EVENT, onReady); } catch { }
      }
      window.removeEventListener('pagehide', detach);
    };
    const onReady = () => {
      if (started.current || tryOpen()) detach();
    };
    for (const target of targets) target.addEventListener(SITE_HOST_READY_EVENT, onReady);
    window.addEventListener('pagehide', detach);
    return detach;
  }, [recoveryResolved, recovery, t]);
}
