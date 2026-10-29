import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { checkForUpdates, getInstallKind } from '@/services/updater/updaterService';
import { loadLastVersion, saveLastVersion, welcomeSeenAtStartup } from '@/utils/settingsStore';
import { detectJustUpdated } from '@/services/updater/releaseInfo';
import { appLog } from '@/services/debug/appLog';
import { isOnboardingActive } from '@/state/onboarding';
import { getGuideView, subscribeGuideView } from '@/extensions/guideRuntime';

/**
 * Stel de automatische updatedialoog uit tot welkomst/rondleiding/tutorialvraag én begeleiding
 * klaar zijn. Handmatig openen blijft mogelijk. Store en gids hebben ieder hun eigen abonnement.
 */
export function openUpdateDialogWhenIdle(): void {
  let opened = false;
  let scheduled = false;
  const tryOpen = () => {
    scheduled = false;
    if (opened) return;
    const ui = useAppStore.getState().ui;
    // Een handmatig geopende dialoog heeft het verzoek al afgehandeld: later niet nóg eens tonen.
    if (!ui.showUpdateDialog && (isOnboardingActive(ui) || getGuideView() !== null)) return;
    opened = true;
    unsubscribeStore();
    unsubscribeGuide();
    if (!ui.showUpdateDialog) useAppStore.getState().setUI({ showUpdateDialog: true });
  };
  const schedule = () => {
    if (opened || scheduled) return;
    scheduled = true;
    // Een gids vervangen is synchroon stop → start. Beoordeel de eindstand, niet dat korte gat.
    queueMicrotask(tryOpen);
  };
  const unsubscribeStore = useAppStore.subscribe(schedule);
  const unsubscribeGuide = subscribeGuideView(schedule);
  tryOpen();
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
    // Snap- en AUR-builds werkt de pakketbeheerder zelf bij (snapd, pacman) — de in-app
    // auto-check overslaan zodat we de gebruiker niet lastigvallen.
    getInstallKind()
      .then(kind => {
        if (kind === 'snap' || kind === 'aur') return;
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
