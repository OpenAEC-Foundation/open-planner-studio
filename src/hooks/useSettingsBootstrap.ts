import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { initLocale } from '@/i18n/config';
import { loadWelcomeSeen } from '@/utils/settingsStore';
import { loadAllSettings } from '@/utils/settingsRegistry';
import { loadAllExtensions } from '@/extensions';
import type { RecoveryState } from './useRecoveryRestore';

// Bootstrap van app-instellingen bij het opstarten: hydrateert de store uit localStorage
// (thema, locale, zoom, panelen, urenplanning, …) plus extensies, en toont de eerste-keer
// welkomstdialoog. De welkomstcheck hangt af van de recovery-flow (zie hieronder).
export function useSettingsBootstrap(recoveryResolved: boolean, recovery: RecoveryState | null): void {
  const setUI = useAppStore(s => s.setUI);

  useEffect(() => {
    initLocale();
    // Pakket M (audit H1): één registergedreven hydratatie i.p.v. ~20 losse `loadX().then(setUI)`-
    // blokken. `loadAllSettings` itereert het `SETTINGS`-register + de twee afwijkers (thema-migratie,
    // synchrone bouwmodus) en levert één `setUI`-patch. Gedrag identiek: zelfde sleutels/validators/
    // defaults; alleen minder losse setUI-calls (de eindtoestand is gelijk — geen veld overlapt).
    loadAllSettings().then(patch => setUI(patch));
    void loadAllExtensions();
    // Recente bestanden leven in IndexedDB (async, met eenmalige localStorage-migratie) —
    // één keer bij opstart in de store hydrateren.
    void useAppStore.getState().hydrateRecentFiles();
  }, []);

  // First-startup-ervaring (fase 2.10, onderdeel 3, §3): toont de WelcomeDialog bij een verse
  // `!loadWelcomeSeen()`. Eigen ref-guard (`welcomeChecked`) naar het recovery-/update-check-
  // patroon, maar reageert op de REACTIEVE `recoveryResolved`-state (niet de `recoveryChecked`-
  // ref, die synchroon al waar is vóórdat de async detectie/dialoogkeuze daadwerkelijk is
  // afgerond) — zo vuurt dit effect pas nadat de recovery-flow ECHT klaar is (geen data gevonden,
  // of de gebruiker heeft hersteld/verworpen/uitgesteld), nooit gelijktijdig met een zichtbare
  // `RecoveryDialog`. Werkt zowel in Tauri als browser-build — de `welcomeSeen`-vlag leeft in
  // localStorage, dat overal werkt.
  const welcomeChecked = useRef(false);
  useEffect(() => {
    if (welcomeChecked.current) return;
    if (!recoveryResolved) return; // wacht tot de recovery-flow (incl. eventuele keuze) echt klaar is
    if (recovery !== null) return; // RecoveryDialog is zichtbaar — welkomstdialoog wacht
    welcomeChecked.current = true;

    loadWelcomeSeen().then(seen => {
      if (!seen) setUI({ showWelcomeDialog: true });
    });
  }, [recoveryResolved, recovery, setUI]);
}
