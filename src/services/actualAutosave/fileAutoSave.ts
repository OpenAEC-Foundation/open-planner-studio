// De echte AutoSave naar het bestand van elk open document: welke documenten, welk doel, en de write onder de
// schrijfcoördinatie. `useAutoSave` plant de rondes; deze module staat los van React, zodat een test hem met de echte
// store en bestandslaag kan draaien (#804 fase 1a, fixronde 2).
import type { AppState } from '@/state/appStore';
import { rememberLiteralCalendarsWritten } from '@/state/savedLiteralCalendars';
import { ifcSchemaBlocksSilentWrite } from '@/services/ifc/ifcSchemaQuestion';
import { buildWriteIFCInput, sameIFCSource } from '@/state/ifcSaveInput';
import { documentContentOf, sameDocumentContent } from '@/state/documentSaveState';
import { computeIfcOutputHere, prepareIfcOutput, type IfcOutputCompute } from '@/state/prepareIfcOutput';
import { IfcSaveWorkerError } from '@/services/ifc/saveWorker/ifcSaveWorkerError';
import {
  canWriteToRefWithoutPrompt, fileIdentityFs, sameFileRef, saveTargetRef, saveToRefWithoutPrompt, writeTargetReaders, type FileRef,
} from '@/services/fileAccess';
import { isProjectFileWriteBusy, runProjectFileWrite } from '@/services/fileAccess/writeCoordinator';
import {
  ifcWriteBlockedNotice, IFC_FOREIGN_TARGET_AUTOSAVE_NOTICE, IFC_SAVE_WORKER_FAILED_NOTICE, IFC_UNREADABLE_TARGET_AUTOSAVE_NOTICE,
  ifcSaveBlocked, refusedWriteTarget, type WriteTargetDeps,
} from '@/state/ifcForeignGuard';
import {
  AutoSaveTargetUnavailableError, createActualAutoSaveController, type ActualAutoSaveCandidate, type ActualAutoSaveController,
} from './actualAutoSave';

export function createFileAutoSaveController(deps: {
  getState: () => AppState;
  /** De poort met de herstelkeuze: dicht tot die gemaakt is. */
  enabled: () => boolean;
  /** Alleen voor tests: andere naden voor de doelcontrole. */
  targetDeps?: WriteTargetDeps;
  /** Het rekenen van de IFC-uitvoer (#804 stap 6): in de gemounte app de opslagworker (`useAutoSave` geeft
   *  `appStoreContext.runtime.ifcSaveCompute`), standaard deze thread. */
  compute?: IfcOutputCompute;
}): ActualAutoSaveController {
  const { getState } = deps;
  const compute = deps.compute ?? computeIfcOutputHere;
  const targetDeps: WriteTargetDeps = deps.targetDeps ?? { identityFs: fileIdentityFs, readers: writeTargetReaders };
  // #804 fase 1a: één melding per document als AutoSave aanstaat maar het vreemde deel opslaan verhindert.
  const foreignNotified = new Set<string>();
  // #804 fixronde 2: per document het doel dat de doelcontrole weigerde (de bron van een ander open document met een
  // vreemd deel, of een bestaand bestand met een gebouwmodel). AutoSave probeert daar niet opnieuw naartoe tot de
  // planner zelf opslaat (het document is dan niet meer gewijzigd) of een ander doel kiest. De melding één keer per
  // document per sessie (zolang deze controller leeft).
  const refusedTarget = new Map<string, FileRef>();
  const targetNotified = new Set<string>();
  return createActualAutoSaveController({
    listCandidates: (): ActualAutoSaveCandidate[] => {
      // Tijdens de herstelkeuze bestaat de live state nog niet betrouwbaar uit de gekozen
      // documenten. Geen bestand overschrijven vóór die blokkerende fase klaar is.
      if (!deps.enabled() || isProjectFileWriteBusy()) return [];
      const state = getState();
      return state.getOpenDocumentPayloads().map(({ id, payload }) => {
        // Eén afleiding van het opslagdoel, dezelfde als Opslaan. Een site-bestand valt hier
        // bewust af: automatisch opslaan naar de site staat uit (elke ronde zou een nieuwe versie
        // maken, besluit #309). Alleen Opslaan schrijft naar de site; crashherstel loopt gewoon door.
        const target = saveTargetRef(payload);
        const ref = target?.kind === 'site' ? null : target;
        // Schemavraag (issue #292): staat die open voor een schema dat de app niet schrijft (IFC2X3),
        // dan zou automatisch opslaan het bestandstype stil veranderen. Dan wacht het bestand op het
        // eerste expliciete opslaan, met de vraag. Crashherstel loopt gewoon door.
        // #804 fase 1a: een document met een vreemd deel schrijft niet naar het bestand (de writer laat het model
        // nog weg). Crashherstel loopt door.
        const foreignBlocked = ifcSaveBlocked(payload);
        if (foreignBlocked && payload.autoSaveToFile && payload.isDirty && !foreignNotified.has(id)) {
          foreignNotified.add(id);
          getState().notify(ifcWriteBlockedNotice(payload));
        }
        const refused = refusedTarget.get(id);
        if (refused && (!payload.isDirty || !ref || !sameFileRef(refused, ref))) refusedTarget.delete(id);
        const enabled = payload.autoSaveToFile && !ifcSchemaBlocksSilentWrite(payload.project, payload.ifcSource) && !foreignBlocked
          && !refusedTarget.has(id);
        return { id, content: documentContentOf(state, id)!.content, enabled, dirty: payload.isDirty, ref, source: payload };
      });
    },
    canWrite: canWriteToRefWithoutPrompt,
    // #804 stap 3, fixronde 1: de ronde koos haar kandidaten vóór het slot. Begon intussen de laatste fase van afsluiten
    // of van de updater (`closeProjectFileWrites`), dan schrijft ze niet meer: `'refused'`, niets te melden, het
    // document blijft gewijzigd.
    write: candidate => runProjectFileWrite<boolean | 'stale' | 'refused'>(async () => {
      // Wachten op een handmatige write mag nooit alsnog een inmiddels oude autosave-inhoud laten overschrijven. Kijk
      // dus OPNIEUW onder de exclusieve lock, vóór het voorbereiden.
      const current = getState().getOpenDocumentPayloads().find((d) => d.id === candidate.id)?.payload;
      if (!current) return false;
      const document = { id: candidate.id, content: candidate.content };
      if (!sameDocumentContent(getState(), document)) return 'stale';
      if (candidate.source.ifcSource !== current.ifcSource || !sameIFCSource(candidate.source, current)) return 'stale';
      // Een document met een vreemd deel schrijft AutoSave nog niet (stap 8); de kandidatenlijst sloot het al uit.
      if (ifcSaveBlocked(current)) return 'refused';
      // #804 stap 6: de momentopname en het rekenen onder het schrijfslot, via dezelfde berekenfunctie als Ctrl+S
      // (de opslagworker). Typt de planner intussen, dan schrijft de ronde deze momentopname en blijft het document
      // gewijzigd (`commitSavedDocument`); de volgende ronde neemt het latere werk mee.
      const output = await prepareIfcOutput({ ...current, ui: getState().ui }, buildWriteIFCInput(current, 'merge'), undefined, compute);
      if (output.prepared) return 'refused';
      // #804 fixronde 2: dezelfde doelcontrole als Opslaan, onder dezelfde lock. Fixronde 1 van #1027 (review Sol): ná het
      // rekenen, vlak vóór het schrijven, zoals Ctrl+S: een gebouwmodel dat tijdens het rekenen op het doel verscheen,
      // wordt niet overschreven. Eén doelscan; daarna beslist alleen nog de synchrone inhoudscontrole hieronder.
      const reason = await refusedWriteTarget(getState(), candidate.ref!, targetDeps);
      if (reason) {
        refusedTarget.set(candidate.id, candidate.ref!);
        if (!targetNotified.has(candidate.id)) {
          targetNotified.add(candidate.id);
          getState().notify(reason === 'unreadable-target'
            ? IFC_UNREADABLE_TARGET_AUTOSAVE_NOTICE : IFC_FOREIGN_TARGET_AUTOSAVE_NOTICE);
        }
        return 'refused';
      }
      rememberLiteralCalendarsWritten(current, output.literalCalendarIds);
      // Knownbug 1896: de laatste controle, vlak vóór de hernoeming of `close()`: hoort de ronde nog bij deze inhoud?
      let replaced = false;
      const contentReplaced = () => (replaced = !sameDocumentContent(getState(), document));
      if (contentReplaced()) return 'stale';
      const written = await saveToRefWithoutPrompt(candidate.ref!, output.bytes ?? output.content, contentReplaced);
      if (replaced) return 'stale';
      if (!written) return false;
      // Binnen dezelfde schrijfbeurt vastleggen, zoals Ctrl+S: dirty alleen weg als precies deze versie nog actueel is.
      getState().markAutoSaveVersionSaved(document, current);
      return true;
    }, () => 'refused'),
    onFailure: (_candidate, error) => {
      console.error('Werkelijke AutoSave mislukt:', error);
      // #804 stap 6: de opslagworker stierf of verliep; niets geschreven, dezelfde melding als bij Ctrl+S.
      if (error instanceof IfcSaveWorkerError) {
        getState().notify(IFC_SAVE_WORKER_FAILED_NOTICE);
        return;
      }
      getState().notify({
        severity: 'error',
        messageKey: error instanceof AutoSaveTargetUnavailableError
          ? 'notifications.autoSaveNotWritable' : 'notifications.autoSaveFailed',
        detail: error instanceof AutoSaveTargetUnavailableError ? undefined : (error as Error).message,
        dedupeKey: 'actual-autosave',
      });
    },
  });
}
