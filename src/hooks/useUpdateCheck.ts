import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { checkForUpdates, getInstallKind } from '@/services/updater/updaterService';
import { loadLastVersion, saveLastVersion } from '@/utils/settingsStore';
import { detectJustUpdated } from '@/services/updater/releaseInfo';

// Stille opstart-update-check (Tauri-only) — spiegelt het auto-save-patroon:
// dynamische import binnen de service, niet-blokkerend. Is er een update, dan
// openen we de update-dialog zodat de gebruiker het ziet. Fouten worden in
// stille modus genegeerd.
export function useUpdateCheck(): void {
  const updateChecked = useRef(false);
  useEffect(() => {
    if (updateChecked.current) return;
    updateChecked.current = true;
    if (!isTauri()) return;
    // Snap-builds worden door de Snap Store/snapd zelf bijgewerkt — de in-app
    // auto-check overslaan zodat we de gebruiker niet lastigvallen.
    getInstallKind()
      .then(kind => {
        if (kind === 'snap') return;
        return checkForUpdates(true).then(info => {
          if (info) useAppStore.getState().setUI({ showUpdateDialog: true });
        });
      })
      .catch(() => { /* stille check — fouten negeren */ });
  }, []);

  // "Je bent net geüpdatet"-detectie (Tauri-only): vergelijk de opgeslagen laatst-gestarte versie
  // met de huidige. Verschillen ze én was er een opgeslagen versie (dus geen verse installatie),
  // dan tonen we JustUpdatedDialog via `ui.justUpdated`. Daarna schrijven we de huidige versie weg.
  const justUpdatedChecked = useRef(false);
  useEffect(() => {
    if (justUpdatedChecked.current) return;
    justUpdatedChecked.current = true;
    if (!isTauri()) return;
    (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const current = await getVersion();
        const stored = await loadLastVersion();
        const jump = detectJustUpdated(stored, current);
        if (jump) useAppStore.getState().setUI({ justUpdated: jump });
        await saveLastVersion(current);
      } catch {
        /* geen Tauri-app-API of localStorage-fout — stil negeren */
      }
    })();
  }, []);
}
