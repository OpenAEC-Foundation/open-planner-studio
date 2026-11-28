import { useEffect, useRef } from 'react';
import i18n from '@/i18n/config';
import { buildImportLabels } from '@/i18n/importLabels';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { isDocumentLeaveBlocked } from '@/hooks/keyboard/shortcutRegistry';
import { tauriOpenIO } from '@/services/fileAccess/tauriOpenPath';
import { fileIdentityFs } from '@/services/fileAccess';
import { listenForLaunchFiles, openLaunchFiles } from '@/state/launchFiles';
import { readOptionsFor } from '@/services/formatRegistry';
import { appLog } from '@/services/debug/appLog';
import type { RecoveryState } from './useRecoveryRestore';

export function useLaunchFiles(recoveryResolved: boolean, recovery: RecoveryState | null): void {
  const started = useRef(false);

  useEffect(() => {
    if (!isTauri() || started.current || !recoveryResolved || recovery !== null) return;
    started.current = true;
    void (async () => {
      const [{ listen, emit }, io] = await Promise.all([import('@tauri-apps/api/event'), tauriOpenIO()]);
      await listenForLaunchFiles({
        listen: (event, handler) => listen(event, (e) => handler(e.payload)),
        emit: (event) => emit(event),
      }, (paths) => {
        void openLaunchFiles(
          useAppStore, paths, io, buildImportLabels((key) => i18n.t(key, { ns: 'common' })), isDocumentLeaveBlocked,
          { readOptions: readOptionsFor(useAppStore.getState().ui.featureFlags), identityFs: fileIdentityFs },
        );
      });
    })().catch((err: unknown) => appLog.emit('error', 'launch-files', 'luisteren naar meegegeven bestanden faalde', err));
  }, [recoveryResolved, recovery]);
}
