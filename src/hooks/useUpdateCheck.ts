import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { checkForUpdates, getInstallKind } from '@/services/updater/updaterService';
import { loadLastVersion, saveLastVersion, welcomeSeenAtStartup } from '@/utils/settingsStore';
import { detectJustUpdated } from '@/services/updater/releaseInfo';
import { appLog } from '@/services/debug/appLog';
import { isOnboardingActive } from '@/state/onboarding';

/**
 * Open "Update beschikbaar" pas als de eerste-startervaring (welkomst, rondleiding, tutorialvraag)
 * voorbij is — eigenaarsbesluit 2026-09-28: niets over elkaar heen. Loopt ze nog, dan één
 * store-abonnement dat zichzelf opzegt zodra ze klaar is.
 */
function openUpdateDialogWhenIdle(): void {
  const open = () => useAppStore.getState().setUI({ showUpdateDialog: true });
  if (!isOnboardingActive(useAppStore.getState().ui)) { open(); return; }
  const unsubscribe = useAppStore.subscribe(state => {
    if (isOnboardingActive(state.ui)) return;
    unsubscribe();
    open();
  });
}

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
          if (info) openUpdateDialogWhenIdle();
        });
      })
      .catch(() => { /* stille check — fouten negeren */ });
  }, []);

  // "Wat is er nieuw"-detectie (Tauri-only): vergelijk de opgeslagen laatst-gestarte versie met de
  // huidige. Verschillen ze, dan tonen we JustUpdatedDialog via `ui.justUpdated`. Ontbreekt de
  // opgeslagen versie, dan alleen bij een bestaande gebruiker (welkomst al gezien bij het opstarten);
  // een echte eerste start toont niets (`detectJustUpdated`). Daarna schrijven we de huidige versie weg.
  // Uitkomst én fouten gaan naar de app-log-bus zodat dit in de DebugTerminal te diagnosticeren is.
  const justUpdatedChecked = useRef(false);
  useEffect(() => {
    if (justUpdatedChecked.current) return;
    justUpdatedChecked.current = true;
    if (!isTauri()) return;
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
