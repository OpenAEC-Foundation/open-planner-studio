import { useEffect, type MutableRefObject } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { saveRecovery, type RecoveryDocContent } from '@/services/recovery/recoveryStore';

// Auto-save GETHROTTLED op ~10 s (voorheen 800 ms-debounce): bij een reeks wijzigingen
// schrijven we een recovery-snapshot HOOGSTENS eens per `AUTOSAVE_INTERVAL_MS`, óók tijdens
// aanhoudend bewerken (een debounce zou juist pas 10 s ná de laatste wijziging schrijven en
// dus tijdens een lange bewerksessie het dataverlies-venster vergroten). De throttle coalesceert
// snelle bursts (slepen/typen) net als voorheen tot één schrijfactie per interval. Alle open
// documenten krijgen een eigen IFC-snapshot; het opslagbackend (Tauri: appDataDir-bestanden +
// manifest; web: IndexedDB per tab-sessie) zit in `recoveryStore` — deze hook is
// platform-agnostisch en draait dus OOK in de browser-build.
const AUTOSAVE_INTERVAL_MS = 10_000;
//
// `autoSaveEnabled` is de gedeelde poort met de recovery-flow (useRecoveryRestore):
// blijft dicht tot de recovery-keuze is gemaakt, zodat de debounced auto-save de
// recovery-snapshots niet overschrijft vóórdat de gebruiker heeft gekozen.
export function useAutoSave(autoSaveEnabled: MutableRefObject<boolean>): void {
  useEffect(() => {
    let saving = false;
    let pending = false;
    // Cache van de laatst-geserialiseerde IFC per document-id, meegaand over de hele hook-levensduur.
    // Zo hoeven niet-gewijzigde documenten hun (dure) writeIFC niet elke tick opnieuw te draaien.
    const ifcCache = new Map<string, string>();

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
        const openIds = new Set(docs.map((d) => d.id));
        const recDocs: RecoveryDocContent[] = docs.map(({ id, payload }) => {
          let ifc = ifcCache.get(id);
          // Herserialiseer alleen als het document gewijzigd is (isDirty) of nog nooit geserialiseerd is.
          // Niet-gewijzigde, al-gecachte documenten hergebruiken hun IFC — hun inhoud is per definitie
          // ongewijzigd, dus de recovery-snapshot blijft correct (saveRecovery schrijft nog steeds álle
          // documenten, dus de herstel-correctheid verandert niet; alleen de dure writeIFC wordt overgeslagen).
          if (payload.isDirty || ifc === undefined) {
            ifc = writeIFC(buildWriteIFCInput(payload));
            ifcCache.set(id, ifc);
          }
          return { id, ifc, filePath: payload.filePath, isDirty: payload.isDirty };
        });
        // Ruim cache-entries op van documenten die niet meer open zijn (voorkomt onbegrensde groei).
        for (const cachedId of ifcCache.keys()) if (!openIds.has(cachedId)) ifcCache.delete(cachedId);
        // Backend-keuze (Tauri-bestanden of IndexedDB) zit in recoveryStore.
        await saveRecovery(state.activeDocumentId, recDocs);
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        saving = false;
        if (pending) { pending = false; void runAutoSave(); }
      }
    };

    // Throttle: plan hoogstens één save per interval. `lastSaveAt = 0` laat de eerste wijziging
    // na het laden meteen een snapshot krijgen; daarna wacht een save tot het interval sinds de
    // vorige verlopen is. Meerdere wijzigingen binnen één venster vallen samen in de reeds
    // geplande save (die de dán-actuele state leest), dus geen verloren bewerkingen.
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSaveAt = 0;
    const unsub = useAppStore.subscribe(() => {
      if (timer) return; // er staat al een save gepland binnen dit interval
      const wait = Math.max(0, AUTOSAVE_INTERVAL_MS - (Date.now() - lastSaveAt));
      timer = setTimeout(() => {
        timer = null;
        lastSaveAt = Date.now();
        void runAutoSave();
      }, wait);
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
