// De echte AutoSave naar het bestand van elk open document: welke documenten, welk doel, en de write onder de
// schrijfcoördinatie. `useAutoSave` plant de rondes; deze module staat los van React, zodat een test hem met de echte
// store en bestandslaag kan draaien (#804 fase 1a, fixronde 2).
import type { AppState } from '@/state/appStore';
import { serializeForSave } from '@/state/savedLiteralCalendars';
import { ifcSchemaBlocksSilentWrite } from '@/services/ifc/ifcSchemaQuestion';
import { sameIFCSource } from '@/state/ifcSaveInput';
import { documentContentOf } from '@/state/documentSaveState';
import {
  canWriteToRefWithoutPrompt, fileIdentityFs, sameFileRef, saveTargetRef, saveToRefWithoutPrompt, writeTargetReaders, type FileRef,
} from '@/services/fileAccess';
import { isProjectFileWriteBusy, runProjectFileWrite } from '@/services/fileAccess/writeCoordinator';
import {
  ifcWriteBlockedNotice, IFC_FOREIGN_TARGET_AUTOSAVE_NOTICE, IFC_UNREADABLE_TARGET_AUTOSAVE_NOTICE, ifcSaveBlocked, refusedWriteTarget, type WriteTargetDeps,
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
}): ActualAutoSaveController {
  const { getState } = deps;
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
    serialize: candidate => serializeForSave(candidate.source),
    canWrite: canWriteToRefWithoutPrompt,
    // #804 stap 3, fixronde 1: de ronde koos haar kandidaten vóór het slot. Begon intussen de laatste fase van afsluiten
    // of van de updater (`closeProjectFileWrites`), dan schrijft ze niet meer: `'refused'`, niets te melden, het
    // document blijft gewijzigd.
    write: (candidate, content) => runProjectFileWrite<boolean | 'stale' | 'refused'>(async () => {
      // #804 fixronde 2: dezelfde doelcontrole als Opslaan, onder dezelfde lock, vóór de write.
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
      // Wachten op een handmatige write (of op de doelcontrole) mag nooit alsnog een inmiddels oude autosave-inhoud
      // laten overschrijven. Kijk dus OPNIEUW onder de exclusieve lock, vlak vóór de write.
      const current = getState().getOpenDocumentPayloads().find((d) => d.id === candidate.id)?.payload;
      if (!current) return false;
      if (candidate.source.ifcSource !== current.ifcSource || !sameIFCSource(candidate.source, current)) return 'stale';
      return saveToRefWithoutPrompt(candidate.ref!, content);
    }, () => 'refused'),
    markSavedIfUnchanged: candidate => getState().markAutoSaveVersionSaved({ id: candidate.id, content: candidate.content }, candidate.source),
    onFailure: (_candidate, error) => {
      console.error('Werkelijke AutoSave mislukt:', error);
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
