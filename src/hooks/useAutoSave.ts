import { useEffect, type MutableRefObject } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { saveRecovery, type RecoveryDocContent } from '@/services/recovery/recoveryStore';

// Auto-save bij ELKE wijziging (gedebounced) i.p.v. op een vaste interval:
// we abonneren op de store en schrijven een recovery-snapshot kort nadat de
// wijzigingen tot rust komen (de debounce coalesceert snelle bursts zoals
// slepen/typen tot één schrijfactie). Alle open documenten krijgen een eigen
// IFC-snapshot; het opslagbackend (Tauri: appDataDir-bestanden + manifest;
// web: IndexedDB per tab-sessie) zit in `recoveryStore` — deze hook is
// platform-agnostisch en draait dus OOK in de browser-build.
//
// `autoSaveEnabled` is de gedeelde poort met de recovery-flow (useRecoveryRestore):
// blijft dicht tot de recovery-keuze is gemaakt, zodat de debounced auto-save de
// recovery-snapshots niet overschrijft vóórdat de gebruiker heeft gekozen.
export function useAutoSave(autoSaveEnabled: MutableRefObject<boolean>): void {
  useEffect(() => {
    let saving = false;
    let pending = false;

    const runAutoSave = async () => {
      // Wacht tot de recovery-keuze gemaakt is: anders zou deze schrijfactie de
      // recovery-snapshots overschrijven vóórdat de gebruiker heeft gekozen.
      if (!autoSaveEnabled.current) return;
      // Voorkom overlappende schrijfacties; vraag een herhaling aan als er
      // tijdens het schrijven nieuwe wijzigingen binnenkwamen.
      if (saving) { pending = true; return; }
      const state = useAppStore.getState();
      const docs = state.getOpenDocumentPayloads();
      if (!docs.some((d) => d.payload.isDirty)) return;
      saving = true;
      try {
        // Bouw het options-object via de gedeelde helper (pakket R1) zodat dit pad niet
        // opnieuw uit de pas loopt met de andere state→IFC-callsites.
        const recDocs: RecoveryDocContent[] = docs.map(({ id, payload }) => ({
          id,
          ifc: writeIFC(buildWriteIFCInput(payload)),
          filePath: payload.filePath,
          isDirty: payload.isDirty,
        }));
        // Backend-keuze (Tauri-bestanden of IndexedDB) zit in recoveryStore.
        await saveRecovery(state.activeDocumentId, recDocs);
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        saving = false;
        if (pending) { pending = false; void runAutoSave(); }
      }
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useAppStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void runAutoSave(); }, 800);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);

  // Web-only sluitwaarschuwing: een browsertab kan zomaar gesloten/herladen worden terwijl er
  // niet-opgeslagen wijzigingen zijn. Tauri heeft daarvoor zijn eigen sluitflow
  // (CloseDocumentDialog), dus daar geen native prompt bovenop.
  useEffect(() => {
    if (isTauri()) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const dirty = useAppStore.getState().getOpenDocumentPayloads().some((d) => d.payload.isDirty);
      if (!dirty) return;
      e.preventDefault();
      // Legacy-vereiste van sommige browsers om de prompt te tonen (de tekst zelf is niet instelbaar).
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
}
