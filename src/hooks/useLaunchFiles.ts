import { useEffect, useRef } from 'react';
import i18n from '@/i18n/config';
import { buildImportLabels } from '@/i18n/importLabels';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { isDocumentLeaveBlocked } from '@/hooks/keyboard/shortcutRegistry';
import { tauriOpenIO } from '@/services/fileAccess/tauriOpenPath';
import { fileIdentityFs } from '@/services/fileAccess';
import { listenForLaunchFiles, openLaunchFiles } from '@/state/launchFiles';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import { appLog } from '@/services/debug/appLog';
import type { RecoveryState } from './useRecoveryRestore';

/**
 * Bestanden die bij het starten zijn meegegeven (issue #1091), alleen op de desktop. Pas na de
 * herstelkeuze, zoals het startbestand van de site: tot dan houdt Rust de paden vast. Een tweede start
 * met een bestand komt via hetzelfde event in dit venster. Elk pad loopt door `state/launchFiles.ts`.
 */
export function useLaunchFiles(recoveryResolved: boolean, recovery: RecoveryState | null): void {
  const started = useRef(false);

  useEffect(() => {
    if (!isTauri() || started.current || !recoveryResolved || recovery !== null) return;
    started.current = true;
    // Het luisteren blijft zolang de app draait: een tweede start kan op elk moment een bestand sturen.
    void (async () => {
      const [{ listen, emit }, io] = await Promise.all([import('@tauri-apps/api/event'), tauriOpenIO()]);
      await listenForLaunchFiles({
        listen: (event, handler) => listen(event, (e) => handler(e.payload)),
        emit: (event) => emit(event),
      }, (paths) => {
        void openLaunchFiles(
          useAppStore, paths, io, buildImportLabels((key) => i18n.t(key, { ns: 'common' })), isDocumentLeaveBlocked,
          { readOptions: { ifcBytes: ifcForeignContentEnabled(useAppStore.getState().ui.featureFlags) }, identityFs: fileIdentityFs },
        );
      });
    })().catch((err: unknown) => appLog.emit('error', 'launch-files', 'luisteren naar meegegeven bestanden faalde', err));
  }, [recoveryResolved, recovery]);
}
