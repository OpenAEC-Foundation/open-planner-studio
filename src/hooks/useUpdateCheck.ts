import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { UPDATES_AVAILABLE } from '@/utils/buildFlags';
import { checkForUpdates, getInstallKind } from '@/services/updater/updaterService';
import { loadLastVersion, saveLastVersion, welcomeSeenAtStartup } from '@/utils/settingsStore';
import { detectJustUpdated } from '@/services/updater/releaseInfo';
import { appLog } from '@/services/debug/appLog';
import { isOnboardingActive } from '@/state/onboarding';
import { getGuideView, subscribeGuideView } from '@/extensions/guideRuntime';

export function openUpdateDialogWhenIdle(): void {
  let opened = false;
  let scheduled = false;
  const tryOpen = () => {
    scheduled = false;
    if (opened) return;
    const ui = useAppStore.getState().ui;
    if (!ui.showUpdateDialog && (isOnboardingActive(ui) || getGuideView() !== null)) return;
    opened = true;
    unsubscribeStore();
    unsubscribeGuide();
    if (!ui.showUpdateDialog) useAppStore.getState().setUI({ showUpdateDialog: true });
  };
  const schedule = () => {
    if (opened || scheduled) return;
    scheduled = true;
    queueMicrotask(tryOpen);
  };
  const unsubscribeStore = useAppStore.subscribe(schedule);
  const unsubscribeGuide = subscribeGuideView(schedule);
  tryOpen();
}

export function useUpdateCheck(): void {
  const updateChecked = useRef(false);
  useEffect(() => {
    if (updateChecked.current) return;
    updateChecked.current = true;
    if (!UPDATES_AVAILABLE || !isTauri()) return;
    getInstallKind()
      .then(kind => {
        if (kind === 'snap' || kind === 'aur') return;
        return checkForUpdates(true).then(info => {
          if (info) openUpdateDialogWhenIdle();
        });
      })
      .catch(() => { });
  }, []);

  const justUpdatedChecked = useRef(false);
  useEffect(() => {
    if (justUpdatedChecked.current) return;
    justUpdatedChecked.current = true;
    if (!UPDATES_AVAILABLE || !isTauri()) return;
    void (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const current = await getVersion();
        const stored = await loadLastVersion();
        const firstStart = !welcomeSeenAtStartup();
        const jump = detectJustUpdated(stored, current, !firstStart);
        appLog.emit(
          'event',
          'update',
          `net-geüpdatet-check: opgeslagen=${stored ?? '(geen)'} huidig=${current} eerste start=${firstStart} → ${jump ? 'tonen' : 'niet tonen'}`,
        );
        if (jump) useAppStore.getState().setUI({ justUpdated: jump });
        await saveLastVersion(current);
      } catch (err) {
        appLog.emit('error', 'update', 'net-geüpdatet-check mislukt:', err);
      }
    })();
  }, []);
}
