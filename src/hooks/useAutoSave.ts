import { useEffect, type MutableRefObject } from 'react';
import { appStoreContext, useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { ifcSchemaBlocksSilentWrite } from '@/services/ifc/ifcSchemaQuestion';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { RecoveryDeltaTracker, type RecoverySourceDocument } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { createRecoverySnapshotSerializer } from '@/services/recovery/recoverySnapshotSerializer';
import { createRecoveryTickQueue } from '@/services/recovery/recoveryTickQueue';
import { registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { canWriteToRefWithoutPrompt, saveTargetRef, saveToRefWithoutPrompt } from '@/services/fileAccess';
import { AutoSaveTargetUnavailableError, actualAutoSaveDelay, createActualAutoSaveController, type ActualAutoSaveCandidate } from '@/services/actualAutosave/actualAutoSave';
import { isProjectFileWriteBusy, runProjectFileWrite } from '@/services/fileAccess/writeCoordinator';
import { sameIFCSource } from '@/state/ifcSaveInput';
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
        const recoveryDocs: RecoverySourceDocument[] = docs.map(({ id, payload }) => ({
          id,
          source: payload,
          filePath: payload.filePath,
          // Het site-doel en de versie waarop DIT document rust: crashherstel zet ze terug, zodat
          // Ctrl+S na herstel weer naar de site schrijft mét conflictcontrole.
          siteFileId: payload.siteFileId,
          siteFileVersion: payload.siteFileId ? payload.siteFileVersion : null,
          isDirty: payload.isDirty,
          // "Datums zoals opgeslagen" is een weergavestand, geen IFC-inhoud: hij reist als
          // manifestmetadata mee zodat crashherstel hem terugzet i.p.v. hem te raden.
          datesAsRecorded: payload.datesAsRecorded,
        }));
        // Backend-keuze (Tauri-bestanden of IndexedDB) zit in recoveryStore. De volledige
        // documentlijst is manifestmetadata; alleen `upserts` bevat IFC-teksten, en die dragen het
        // XER-bronarchief alleen als verwijzing (eigenaarsbesluit plan (9), `serializeRecoverySnapshot`).
        await runRecoveryTick(recoveryDelta, state.activeDocumentId, recoveryDocs, serializer.serialize, enabled);
      } catch (err) {
        if (!enabled()) return;
        if (notifyRecoveryError(err, useAppStore.getState().notify)) return;
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
        void runAutoSave();
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
    const controller = createActualAutoSaveController({
      listCandidates: (): ActualAutoSaveCandidate[] => {
        // Tijdens de herstelkeuze bestaat de live state nog niet betrouwbaar uit de gekozen
        // documenten. Geen bestand overschrijven vóór die blokkerende fase klaar is.
        if (!autoSaveEnabled.current || isProjectFileWriteBusy()) return [];
        return useAppStore.getState().getOpenDocumentPayloads().map(({ id, payload }) => {
          // Eén afleiding van het opslagdoel, dezelfde als Opslaan. Een site-bestand valt hier
          // bewust af: automatisch opslaan naar de site staat uit (elke ronde zou een nieuwe versie
          // maken, besluit #309). Alleen Opslaan schrijft naar de site; crashherstel loopt gewoon door.
          const target = saveTargetRef(payload);
          const ref = target?.kind === 'site' ? null : target;
          // Schemavraag (issue #292): staat die open voor een schema dat de app niet schrijft (IFC2X3),
          // dan zou automatisch opslaan het bestandstype stil veranderen. Dan wacht het bestand op het
          // eerste expliciete opslaan, met de vraag. Crashherstel loopt gewoon door.
          const enabled = payload.autoSaveToFile && !ifcSchemaBlocksSilentWrite(payload.project);
          return { id, enabled, dirty: payload.isDirty, ref, source: payload };
        });
      },
      serialize: candidate => writeIFC(buildWriteIFCInput(candidate.source)),
      canWrite: canWriteToRefWithoutPrompt,
      write: (candidate, content) => runProjectFileWrite(async () => {
        // Wachten op een handmatige write mag nooit alsnog een inmiddels oude autosave-inhoud
        // laten overschrijven. Kijk dus OPNIEUW onder de exclusieve lock.
        const current = useAppStore.getState().getOpenDocumentPayloads().find((d) => d.id === candidate.id)?.payload;
        if (!current) return false;
        if (!sameIFCSource(candidate.source, current)) return 'stale';
        return saveToRefWithoutPrompt(candidate.ref!, content);
      }),
      markSavedIfUnchanged: candidate => useAppStore.getState().markAutoSaveVersionSaved(candidate.id, candidate.source),
      onFailure: (_candidate, error) => {
        console.error('Werkelijke AutoSave mislukt:', error);
        useAppStore.getState().notify({
          severity: 'error',
          messageKey: error instanceof AutoSaveTargetUnavailableError
            ? 'notifications.autoSaveNotWritable' : 'notifications.autoSaveFailed',
          detail: error instanceof AutoSaveTargetUnavailableError ? undefined : (error as Error).message,
          dedupeKey: 'actual-autosave',
        });
      },
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
