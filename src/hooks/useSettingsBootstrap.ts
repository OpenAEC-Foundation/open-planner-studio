import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { loadWelcomeSeen } from '@/utils/settingsStore';
import { loadAllSettings } from '@/utils/settingsRegistry';
import { loadAllExtensions } from '@/extensions';
import type { RecoveryState } from './useRecoveryRestore';
import { bootstrapTaskGridPreferences } from '@/state/taskGridBootstrap';

// Bootstrap van app-instellingen bij het opstarten: hydrateert de store uit localStorage
// (thema, locale, zoom, panelen, urenplanning, …) plus extensies, en toont de eerste-keer
// welkomstdialoog. De welkomstcheck hangt af van de recovery-flow (zie hieronder).
export function useSettingsBootstrap(recoveryResolved: boolean, recovery: RecoveryState | null): void {
  const setUI = useAppStore(s => s.setUI);

  useEffect(() => {
    // initLocale() is naar main.tsx verhuisd (pré-render, zodat de actieve taal-chunk vóór
    // de eerste paint geladen is). Hier alleen nog de overige app-instellingen hydrateren.
    // Pakket M (audit H1): één registergedreven hydratatie i.p.v. ~20 losse `loadX().then(setUI)`-
    // blokken. `loadAllSettings` itereert het `SETTINGS`-register + de drie afwijkers (thema-migratie,
    // synchrone bouwmodus, balkkleurkeuze) en levert één `setUI`-patch. Gedrag identiek: zelfde
    // sleutels/validators/defaults; alleen minder losse setUI-calls (de eindtoestand is gelijk — geen
    // veld overlapt).
    void loadAllSettings().then(patch => setUI(patch));
    void loadAllExtensions();
    // Recente bestanden leven in IndexedDB (async, met eenmalige localStorage-migratie) —
    // één keer bij opstart in de store hydrateren.
    void useAppStore.getState().hydrateRecentFiles();
  }, [setUI]);

  // Taakgridvoorkeuren wachten bewust tot de recoverykeuze volledig is afgehandeld. Bij mount is
  // de store nog het lege startdocument; direct lezen zou daardoor de dynamische defaults en een
  // eventuele oude actieve `view.columns` vastleggen uit het verkeerde document. Na herstel staat
  // hier eerst het werkelijk actieve document in de store; bij afwijzen/uitstellen blijft het lege
  // document terecht de bron. De ref maakt deze migratie exact eenmalig.
  const taskGridChecked = useRef(false);
  useEffect(() => {
    if (taskGridChecked.current || !recoveryResolved || recovery !== null) return;
    taskGridChecked.current = true;

    void bootstrapTaskGridPreferences(useAppStore).catch(error => {
      console.error('Taakgridvoorkeuren konden niet worden geïnitialiseerd:', error);
    });
  }, [recoveryResolved, recovery]);

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

    void loadWelcomeSeen().then(seen => {
      if (!seen) setUI({ showWelcomeDialog: true });
    });
  }, [recoveryResolved, recovery, setUI]);
}
