import { useEffect, type MutableRefObject } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { RecoveryDeltaTracker, type RecoverySourceDocument } from '@/services/recovery/recoveryDelta';
import { saveRecovery } from '@/services/recovery/recoveryStore';

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
    // `RecoveryDeltaTracker` bewaart serialisatie los van de gepersisteerde basis: een mislukte
    // storage-transaction mag hergebruik van IFC-tekst toelaten, maar nooit doen alsof de bron al
    // veilig op schijf staat.
    const recoveryDelta = new RecoveryDeltaTracker();

    const runAutoSave = async () => {
      // Wacht tot de recovery-keuze gemaakt is: anders zou deze schrijfactie de
      // recovery-snapshots overschrijven vóórdat de gebruiker heeft gekozen.
      if (!autoSaveEnabled.current) return;
      // Voorkom overlappende schrijfacties; vraag een herhaling aan als er
      // tijdens het schrijven nieuwe wijzigingen binnenkwamen.
      if (saving) { pending = true; return; }
      const state = useAppStore.getState();
      const docs = state.getOpenDocumentPayloads();
      // Een verse, volledig schone sessie hoeft geen crashsnapshot te maken. Vanaf de eerste
      // echte save blijven actieve-tab- en metadatawijzigingen echter wél bewaard, ook als geen
      // document op dat moment dirty is. `isDirty` is dus hoogstens een eerste-eligibilityflag,
      // nooit de identiteit van IFC-inhoud.
      if (!docs.some((d) => d.payload.isDirty) && !recoveryDelta.hasPersistedSnapshot) return;
      saving = true;
      try {
        // Vergelijk de echte IFC-bronvelden (Immer-referenties) en niet `isDirty`: zo krijgt één
        // taakbewerking één volledige IFC-upsert, terwijl een actieve-tabwissel manifest-only is.
        const recoveryDocs: RecoverySourceDocument[] = docs.map(({ id, payload }) => ({
          id,
          source: payload,
          filePath: payload.filePath,
          isDirty: payload.isDirty,
        }));
        const recoverySave = recoveryDelta.prepare(
          state.activeDocumentId,
          recoveryDocs,
          (source) => writeIFC(buildWriteIFCInput(source)),
        );
        if (!recoverySave) return;
        // Backend-keuze (Tauri-bestanden of IndexedDB) zit in recoveryStore. De volledige
        // documentlijst is manifestmetadata; alleen `upserts` bevat zware IFC-teksten.
        await saveRecovery(recoverySave);
        recoveryDelta.commit(state.activeDocumentId, recoveryDocs);
      } catch (err) {
        console.error('Auto-save failed:', err);
        // dedupeKey is hier niet optioneel: de auto-save probeert het elke ~10 s opnieuw, dus
        // zonder samenvouwen levert één aanhoudende schrijffout zes meldingen per minuut op.
        useAppStore.getState().notify({
          severity: 'error',
          messageKey: 'notifications.autoSaveFailed',
          detail: (err as Error).message,
          dedupeKey: 'autosave',
        });
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
