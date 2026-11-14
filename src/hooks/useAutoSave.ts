import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import { useEffect, type MutableRefObject } from 'react';
import { appStoreContext, useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { RecoveryDeltaTracker, type RecoverySourceDocument } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { recoveryStorageUnavailable } from '@/services/recovery/recoveryStore';
import { createRecoverySnapshotSerializer } from '@/services/recovery/recoverySnapshotSerializer';
import { createRecoveryTickQueue } from '@/services/recovery/recoveryTickQueue';
import { registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { actualAutoSaveDelay } from '@/services/actualAutosave/actualAutoSave';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import { notifyRecoveryError } from '@/state/recoveryManifestNotice';

// Auto-save GETHROTTLED op ~10 s (bewust geen debounce): bij een reeks wijzigingen
// schrijven we een recovery-snapshot HOOGSTENS eens per `AUTOSAVE_INTERVAL_MS`, óók tijdens
// aanhoudend bewerken (een debounce zou juist pas 10 s ná de laatste wijziging schrijven en
// dus tijdens een lange bewerksessie het dataverlies-venster vergroten). De throttle coalesceert
// snelle bursts (slepen/typen) tot één schrijfactie per interval. Alle open
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
    let disposed = false;
    const serializer = createRecoverySnapshotSerializer();
    const enabled = () => !disposed && autoSaveEnabled.current;
    // `RecoveryDeltaTracker` bewaart serialisatie los van de gepersisteerde basis: een mislukte
    // storage-transaction mag hergebruik van IFC-tekst toelaten, maar nooit doen alsof de bron al
    // veilig op schijf staat.
    const recoveryDelta = new RecoveryDeltaTracker();

    const saveRound = async () => {
      // Wacht tot de recovery-keuze gemaakt is: anders zou deze schrijfactie de
      // recovery-snapshots overschrijven vóórdat de gebruiker heeft gekozen.
      if (!enabled()) return;
      // De browser weigert IndexedDB (sandbox-iframe zonder `allow-same-origin`, issue #582): er is
      // geen plek voor een snapshot. Sla de hele ronde over, ook de IFC-serialisatie.
      if (recoveryStorageUnavailable()) return;
      const state = useAppStore.getState();
      const docs = state.getOpenDocumentPayloads();
      // Een verse, volledig schone sessie hoeft geen crashsnapshot te maken. Vanaf de eerste
      // echte save blijven actieve-tab- en metadatawijzigingen echter wél bewaard, ook als geen
      // document op dat moment dirty is. `isDirty` is dus hoogstens een eerste-eligibilityflag,
      // nooit de identiteit van IFC-inhoud.
      if (!docs.some((d) => d.payload.isDirty) && !recoveryDelta.hasPersistedSnapshot) return;
      try {
        // Vergelijk de echte IFC-bronvelden (Immer-referenties) en niet `isDirty`: zo krijgt één
        // taakbewerking één volledige IFC-upsert, terwijl een actieve-tabwissel manifest-only is.
        const recoveryDocs: RecoverySourceDocument[] = docs.map(({ id, payload }) =>
          recoverySourceDocument(id, payload, ifcForeignContentEnabled(state.ui.featureFlags)));
        // Backend-keuze (Tauri-bestanden of IndexedDB) zit in recoveryStore. De volledige
        // documentlijst is manifestmetadata; alleen `upserts` bevat IFC-teksten, en die dragen het
        // XER-bronarchief alleen als verwijzing (eigenaarsbesluit plan (9), `serializeRecoverySnapshot`).
        await runRecoveryTick(recoveryDelta, state.activeDocumentId, recoveryDocs, serializer.serialize, enabled, id => {
          useAppStore.getState().notify({ severity: 'error', messageKey: 'notifications.ifcSourceCopyFailed',
            dedupeKey: `ifc-source-copy-${id}` });
        });
      } catch (err) {
        if (!enabled()) return;
        if (!notifyRecoveryError(err, useAppStore.getState().notify)) {
          console.error('Auto-save failed:', err);
          // dedupeKey is hier niet optioneel: de auto-save probeert het elke ~10 s opnieuw, dus
          // zonder samenvouwen levert één aanhoudende schrijffout zes meldingen per minuut op.
          useAppStore.getState().notify({
            severity: 'error',
            messageKey: 'notifications.autoSaveFailed',
            detail: (err as Error).message,
            dedupeKey: 'autosave',
          });
        }
        // Een melding is geen geslaagde opslag: de expliciete flush vóór een update moet
        // afwijzen, zodat de updater niet installeert of herstart met onbewaarde wijzigingen.
        throw err;
      }
    };

    const runAutoSave = createRecoveryTickQueue(saveRound, enabled);

    // Throttle: plan hoogstens één save per interval. `lastSaveAt = 0` laat de eerste wijziging
    // na het laden meteen een snapshot krijgen; daarna wacht een save tot het interval sinds de
    // vorige verlopen is. Meerdere wijzigingen binnen één venster vallen samen in de reeds
    // geplande save (die de dán-actuele state leest), dus geen verloren bewerkingen.
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSaveAt = 0;
    // Directe ronde op verzoek (updater vóór `relaunch`): wacht een lopende save af en schrijft
    // daarna de actuele staat, buiten de throttle om.
    const unregisterFlush = registerRecoveryFlush(runAutoSave);
    const unsub = useAppStore.subscribe(() => {
      if (timer) return; // er staat al een save gepland binnen dit interval
      const wait = Math.max(0, AUTOSAVE_INTERVAL_MS - (Date.now() - lastSaveAt));
      timer = setTimeout(() => {
        timer = null;
        lastSaveAt = Date.now();
        // De ronde heeft de fout al gemeld. Alleen de periodieke aanroep vangt de afwijzing
        // af; een gelijktijdige expliciete flush krijgt dezelfde fout wél terug.
        void runAutoSave().catch(() => {});
      }, wait);
    });

    return () => {
      disposed = true;
      serializer.dispose();
      if (timer) clearTimeout(timer);
      unsub();
      unregisterFlush();
    };
  }, [autoSaveEnabled]);

  // Echte AutoSave is een APART mechanisme: recovery hierboven blijft alle gewijzigde documenten
  // snapshotten, ook wanneer deze keuze uitstaat of een document nog nooit is opgeslagen.
  useEffect(() => {
    // De controller (kandidaten, doelcontrole, write) staat in `fileAutoSave.ts`, zodat een test hem met de echte store
    // en bestandslaag kan draaien (#804 fixronde 2). Deze hook plant alleen de rondes.
    const controller = createFileAutoSaveController({
      getState: () => useAppStore.getState(),
      enabled: () => autoSaveEnabled.current,
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRunAt = 0;
    const request = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        lastRunAt = Date.now();
        void controller.flush();
      }, actualAutoSaveDelay(lastRunAt, Date.now()));
    };
    const unsub = useAppStore.subscribe(request);
    return () => { if (timer) clearTimeout(timer); unsub(); };
  }, [autoSaveEnabled]);

  // Web-only sluitwaarschuwing: een browsertab kan zomaar gesloten/herladen worden terwijl er
  // niet-opgeslagen wijzigingen zijn. Tauri heeft daarvoor zijn eigen sluitflow
  // (`useAppCloseGuard` → CloseDocumentDialog per document), dus daar geen native prompt bovenop.
  useEffect(() => {
    if (isTauri()) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // Eerst open veldinvoer afronden (review #401): een getypte inzet zonder blur maakt het
      // document pas hier gewijzigd, en hoort de sluitwaarschuwing te krijgen.
      appStoreContext.runtime.finishPendingTextEdits();
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
