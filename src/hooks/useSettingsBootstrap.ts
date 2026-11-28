import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { loadWelcomeSeen, localStorageAvailable, welcomeSeenAtStartup } from '@/utils/settingsStore';
import { loadAllExtensions } from '@/extensions';
import { EXTENSIONS_ENABLED } from '@/utils/buildFlags';
import type { RecoveryState } from './useRecoveryRestore';
import { bootstrapTaskGridPreferences } from '@/state/taskGridBootstrap';
import { runsEmbedded } from '@/services/fileAccess/siteHost';
import { appLog } from '@/services/debug/appLog';
import { useSiteHostPreferences } from './useSiteHostPreferences';

const skipWelcomeReason = (): string | null =>
  runsEmbedded() ? 'ingebed' : !localStorageAvailable() ? 'geen localStorage' : null;

const logWelcomeCheck = (outcome: string) => appLog.emit('event', 'welkomst', `welkomstcontrole: ${outcome}`);

export function useSettingsBootstrap(recoveryResolved: boolean, recovery: RecoveryState | null): void {
  const setUI = useAppStore(s => s.setUI);
  const taskGridChecked = useRef(false);
  const reloadLateTaskGrid = useCallback(async (keys: ReadonlySet<string>) => {
    if (!taskGridChecked.current || !keys.has('ops-taskGridPreferences')) return;
    try {
      await bootstrapTaskGridPreferences(useAppStore);
    } catch (error) {
      console.error('Taakgridvoorkeuren van de host konden niet worden toegepast:', error);
    }
  }, []);
  useSiteHostPreferences(setUI, reloadLateTaskGrid);

  useEffect(() => {
    if (!welcomeSeenAtStartup() && skipWelcomeReason() === null) setUI({ welcomePending: true });
    if (EXTENSIONS_ENABLED) {
      void loadAllExtensions().catch(error => {
        console.error('Extensies laden mislukt:', error);
      });
    }
    void useAppStore.getState().hydrateRecentFiles().catch(error => {
      console.error('Recente bestanden laden mislukt:', error);
    });
  }, [setUI]);

  useEffect(() => {
    if (taskGridChecked.current || !recoveryResolved || recovery !== null) return;
    taskGridChecked.current = true;

    void bootstrapTaskGridPreferences(useAppStore).catch(error => {
      console.error('Taakgridvoorkeuren konden niet worden geïnitialiseerd:', error);
    });
  }, [recoveryResolved, recovery]);

  const welcomeChecked = useRef(false);
  useEffect(() => {
    if (welcomeChecked.current) return;
    if (!recoveryResolved) return;
    if (recovery !== null) return;
    welcomeChecked.current = true;

    const skipReason = skipWelcomeReason();
    if (skipReason) {
      setUI({ welcomePending: false });
      logWelcomeCheck(`overgeslagen (${skipReason})`);
      return;
    }

    void loadWelcomeSeen().then(seen => {
      setUI(seen ? { welcomePending: false } : { welcomePending: false, showWelcomeDialog: true });
      logWelcomeCheck(seen ? 'al gezien' : 'getoond');
    });
  }, [recoveryResolved, recovery, setUI]);
}
