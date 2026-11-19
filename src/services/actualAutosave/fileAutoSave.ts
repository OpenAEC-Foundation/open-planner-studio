// De echte AutoSave naar het bestand van elk open document: welke documenten, welk doel, en de write onder de
// schrijfcoördinatie. `useAutoSave` plant de rondes; deze module staat los van React, zodat een test hem met de echte
// store en bestandslaag kan draaien (#804 fase 1a, fixronde 2).
//
// #804 stap 8: een document met een gebouwmodel (flag `ifcForeignContent` aan, de bron aanwezig) doet mee, via dezelfde
// gecontroleerde vervanging als Ctrl+S (`replaceOwnHandleWithRecovery` in de browser, `replaceOwnPathWithRecovery` op de
// desktop), met een eigen ritme per document (`modelAutoSaveRhythm.ts`), en zijn ronde wijkt voor elke handmatige
// actie (`runYieldingProjectFileWrite`) zolang het herstelrecord niet geschreven is. Een gewoon document en elk document
// met de flag uit houden hun route en hun ritme van vóór stap 8.
import type { AppState } from '@/state/appStore';
import type { DocumentPayload } from '@/state/documentContract';
import { rememberLiteralCalendarsWritten } from '@/state/savedLiteralCalendars';
import { ifcSchemaBlocksSilentWrite } from '@/services/ifc/ifcSchemaQuestion';
import { buildWriteIFCInput, sameIFCSource } from '@/state/ifcSaveInput';
import { documentContentOf, sameDocumentContent, type DocumentContentRef } from '@/state/documentSaveState';
import { computeIfcOutputHere, prepareIfcOutput, type IfcOutputCompute } from '@/state/prepareIfcOutput';
import { IfcSaveWorkerError } from '@/services/ifc/saveWorker/ifcSaveWorkerError';
import {
  canWriteToRefWithoutPrompt, fileIdentityFs, sameFileRef, saveTargetRef, saveToRefWithoutPrompt, sourceTargetContent,
  writeTargetReaders, type FileRef,
} from '@/services/fileAccess';
import { isProjectFileWriteBusy, runProjectFileWrite, runYieldingProjectFileWrite } from '@/services/fileAccess/writeCoordinator';
import {
  ifcFullWriteBlocked, ifcWriteBlockedNotice, IFC_FOREIGN_TARGET_AUTOSAVE_NOTICE, IFC_SAVE_WORKER_FAILED_NOTICE,
  IFC_UNREADABLE_TARGET_AUTOSAVE_NOTICE, ifcSaveBlocked, refusedWriteTarget, type WriteTargetDeps,
} from '@/state/ifcForeignGuard';
import { hasForeignContent, type PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import { ownPathReplaceNotices, replaceOwnHandleWithRecovery, replaceOwnPathWithRecovery } from '@/state/ownFileReplace';
import {
  MODEL_AUTOSAVE_NOT_RECORDED_NOTICE, MODEL_AUTOSAVE_REMNANT_NOTICE, MODEL_AUTOSAVE_SAVE_AS_ONLY_NOTICE,
  MODEL_AUTOSAVE_TARGET_CHANGED_NOTICE,
} from '@/state/modelAutoSaveNotices';
import type { NotifyInput } from '@/state/slices/types';
import {
  AutoSaveTargetUnavailableError, createActualAutoSaveController, type ActualAutoSaveCandidate, type ActualAutoSaveController,
  type ActualAutoSaveWrite,
} from './actualAutoSave';
import { createModelAutoSaveRhythm, type ModelAutoSaveRhythm } from './modelAutoSaveRhythm';

/** #804 stap 8: doet dit document mee als document met een gebouwmodel? Met de flag aan, een vreemd deel en de bron
 *  aanwezig. Met de flag uit, of als de bron ontbreekt, blijft het geweigerd zoals vóór stap 8 (`ifcSaveBlocked`). */
function modelDocument(state: Pick<AppState, 'ui'>, payload: Pick<DocumentPayload, 'ifcSource' | 'foreignSourceMark'>): boolean {
  return ifcForeignContentEnabled(state.ui.featureFlags) && hasForeignContent(payload.ifcSource)
    && !ifcFullWriteBlocked({ ...payload, ui: state.ui });
}

/** Zou Ctrl+S voor dit document eerst vragen naar de afhankelijke projecten (`settleDependentAnchors` in `fileSlice.ts`)?
 *  Dan slaat een stille ronde met een gebouwmodel het over: ze stelt nooit een vraag. */
function dependentQuestionPossible(state: Pick<AppState, 'ui'>, id: string, payload: Pick<DocumentPayload, 'project'>): boolean {
  return state.ui.dependentProjects.some(r => r.documentId === id && r.projectId === payload.project.id && r.links.length > 0);
}

export interface FileAutoSaveController extends ActualAutoSaveController {
  /** #804 stap 8: na elke wijziging in de store; houdt het ritme van de documenten met een gebouwmodel bij. */
  observe: () => void;
  /** Het vroegste moment (de klok `now`) waarop een document met een gebouwmodel aan de beurt is; `null`: geen. */
  nextModelRoundAt: () => number | null;
}

export function createFileAutoSaveController(deps: {
  getState: () => AppState;
  /** De poort met de herstelkeuze: dicht tot die gemaakt is. */
  enabled: () => boolean;
  /** Alleen voor tests: andere naden voor de doelcontrole. */
  targetDeps?: WriteTargetDeps;
  /** Het rekenen van de IFC-uitvoer (#804 stap 6): in de gemounte app de opslagworker (`useAutoSave` geeft
   *  `appStoreContext.runtime.ifcSaveCompute`), standaard deze thread. */
  compute?: IfcOutputCompute;
  /** #804 stap 8: de klok van het ritme met een gebouwmodel; injecteerbaar voor tests. */
  now?: () => number;
}): FileAutoSaveController {
  const { getState } = deps;
  const rhythm: ModelAutoSaveRhythm = createModelAutoSaveRhythm(deps.now);
  /** Alleen met de flag aan heeft een document een ritme; met de flag uit raakt dit niets (zoals vóór stap 8). */
  const tracked = new Set<string>();
  const observe = () => {
    const state = getState();
    // Met de flag uit (en niets meer bij te houden) geen werk per wijziging: de app doet wat hij vóór stap 8 deed.
    if (tracked.size === 0 && !ifcForeignContentEnabled(state.ui.featureFlags)) return;
    const seen = new Set<string>();
    for (const { id, payload } of state.getOpenDocumentPayloads()) {
      if (!modelDocument(state, payload)) continue;
      seen.add(id);
      tracked.add(id);
      rhythm.observe(id, payload, payload.isDirty);
    }
    for (const id of tracked) if (!seen.has(id)) { tracked.delete(id); rhythm.forget(id); }
  };
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
  /** #804 stap 8: stoppen voor dit document tot de planner zelf opslaat of een ander doel kiest, met hoogstens één
   *  melding per document per sessie (`null`: de melding kwam al van de vervanging zelf). */
  const stopFor = (id: string, ref: FileRef, notice: NotifyInput | null) => {
    refusedTarget.set(id, ref);
    if (targetNotified.has(id)) return;
    targetNotified.add(id);
    if (notice) getState().notify(notice);
  };
  const payloadOf = (id: string) => getState().getOpenDocumentPayloads().find(d => d.id === id)?.payload;
  const modelPayload = (id: string) => { const payload = payloadOf(id); return !!payload && modelDocument(getState(), payload); };

  /**
   * #804 stap 8: de ronde van een document met een gebouwmodel, binnen één schrijfbeurt die wijkt: de controle dat de
   * ronde nog bij deze inhoud hoort, de doel- en bronvergelijking, de merge (in de worker), de doelcontrole opnieuw, de
   * vervanging met herstelrecord en de commit. Dezelfde controles en dezelfde vervanging als Ctrl+S op het eigen doel
   * (`writeActiveDocument` in `fileSlice.ts`), zonder vraag of venster en met de meldingen van Automatisch opslaan. Tot
   * het herstelrecord (desktop) of de komende versie in het herstelmanifest (browser) geschreven is, stopt de ronde
   * zodra `yielded` afgaat: niets geschreven, het document blijft gewijzigd, geen melding (`'yielded'`). Daarna loopt ze
   * af en wacht de handmatige actie.
   */
  const writeModel = (candidate: ActualAutoSaveCandidate) => runYieldingProjectFileWrite<ActualAutoSaveWrite>(async yielded => {
    // De duur van de ronde: vanaf de beurt in de rij, tot en met de commit en de laatste herstelronde. Week ze al terwijl
    // ze op haar beurt wachtte, dan telt dat ook als geweken (opnieuw na de volgende rustperiode).
    rhythm.roundStarted(candidate.id);
    let outcome: ActualAutoSaveWrite | undefined;
    try {
      outcome = yielded.aborted ? 'yielded' : await modelRound(candidate, yielded);
      return outcome;
    } finally {
      rhythm.roundEnded(candidate.id, outcome === true ? 'written' : outcome === 'yielded' ? 'yielded' : 'other');
    }
  }, () => 'refused');

  const modelRound = async (candidate: ActualAutoSaveCandidate, yielded: AbortSignal): Promise<ActualAutoSaveWrite> => {
    const current = payloadOf(candidate.id);
    if (!current) return false;
    const document: DocumentContentRef = { id: candidate.id, content: candidate.content };
    if (!sameDocumentContent(getState(), document)) return 'stale';
    if (candidate.source.ifcSource !== current.ifcSource || !sameIFCSource(candidate.source, current)) return 'stale';
    const ref = candidate.ref!;
    if (ref.kind === 'site') return 'refused';
    const source = current.ifcSource!;
    /** Hoort de ronde nog bij deze inhoud en deze bron (`refuseChangedDocumentWrite` van Ctrl+S, zonder melding)? */
    const changed = () => !sameDocumentContent(getState(), document) || payloadOf(candidate.id)?.ifcSource !== source;
    /** De doelbewaking van Ctrl+S op het eigen doel (`documentTargetCheck` met `ownTarget`): het document, zijn opslagdoel
     *  en zijn bron zijn nog dezelfde, en geen ander open document heeft dit bestand als bron. */
    const guard = async (): Promise<'stale' | 'refused' | null> => {
      const now = payloadOf(candidate.id);
      if (changed() || !now) return 'stale';
      const target = saveTargetRef(now);
      if (!target || !sameFileRef(target, ref)) return 'stale';
      if (!modelDocument(getState(), now)) return 'refused';
      const reason = await refusedWriteTarget(getState(), ref, targetDeps, { documentId: candidate.id, source });
      if (reason) {
        stopFor(candidate.id, ref, reason === 'unreadable-target' ? IFC_UNREADABLE_TARGET_AUTOSAVE_NOTICE : IFC_FOREIGN_TARGET_AUTOSAVE_NOTICE);
        return 'refused';
      }
      return changed() ? 'stale' : null;
    };

    const before = await guard();
    if (before) return before;
    if (yielded.aborted) return 'yielded';
    // De browser: staat er nog precies de bron, vóór de merge (zoals Ctrl+S). De desktop toetst dat in de vervanging zelf.
    if (ref.kind === 'handle' && await sourceTargetContent(ref, source.bytes) !== 'same') {
      stopFor(candidate.id, ref, MODEL_AUTOSAVE_TARGET_CHANGED_NOTICE);
      return 'refused';
    }
    if (yielded.aborted) return 'yielded';
    let prepared: PreparedIfcWrite | undefined;
    try {
      const output = await prepareIfcOutput({ ...current, ui: getState().ui }, buildWriteIFCInput(current, 'merge'), undefined,
        job => compute(job, yielded));
      prepared = output.prepared;
    } catch (error) {
      // Geweken tijdens het rekenen: de worker stopte op ons verzoek. Geen fout en geen melding.
      if (yielded.aborted) return 'yielded';
      throw error;
    }
    if (yielded.aborted) return 'yielded';
    if (!prepared) return 'refused';
    const after = await guard();
    if (after) return after;
    const commit = () => getState().markAutoSaveVersionSaved(document, current, prepared);

    if (ref.kind === 'handle') {
      // Vlak vóór het vastleggen van de komende versie in het herstelmanifest; daarna loopt de ronde af.
      if (yielded.aborted) return 'yielded';
      const result = await replaceOwnHandleWithRecovery({
        documentId: candidate.id, ref, prepared, source: source.bytes,
        stopBeforeWrite: changed, refuseBeforePlace: changed, commit,
      });
      if (result.code === 'replaced') return true;
      if (result.code === 'not-recorded') stopFor(candidate.id, ref, MODEL_AUTOSAVE_NOT_RECORDED_NOTICE);
      else if (result.code === 'target-changed') stopFor(candidate.id, ref, MODEL_AUTOSAVE_TARGET_CHANGED_NOTICE);
      else return 'stale';
      return 'refused';
    }

    let stoppedBy: 'stale' | 'refused' | null = null;
    const result = await replaceOwnPathWithRecovery({
      documentId: candidate.id, path: ref.path, prepared, source: { bytes: source.bytes, sha256: source.sha256 },
      yieldBeforeRecord: () => yielded.aborted, refuseRemnant: true,
      stopBeforeWrite: async () => (stoppedBy = await guard()) !== null,
      refuseBeforePlace: () => { if (changed()) stoppedBy = 'stale'; return stoppedBy !== null; },
      commit,
    });
    switch (result.code) {
      case 'replaced':
        // Een versie van een ander programma of een achtergebleven vorige versie: een feit over bestanden op schijf.
        for (const notice of ownPathReplaceNotices(result, ref.path)) getState().notify(notice);
        return true;
      case 'yielded': return 'yielded';
      case 'stopped': return stoppedBy ?? 'stale';
      case 'remnant': stopFor(candidate.id, ref, MODEL_AUTOSAVE_REMNANT_NOTICE); return 'refused';
      case 'not-recorded': stopFor(candidate.id, ref, MODEL_AUTOSAVE_NOT_RECORDED_NOTICE); return 'refused';
      case 'target-changed': stopFor(candidate.id, ref, MODEL_AUTOSAVE_TARGET_CHANGED_NOTICE); return 'refused';
      case 'save-as-only': stopFor(candidate.id, ref, MODEL_AUTOSAVE_SAVE_AS_ONLY_NOTICE); return 'refused';
      case 'failed':
        // Een mislukte ronde: de melding van Ctrl+S (één regel, ververst), en de volgende ronde probeert het opnieuw.
        for (const notice of ownPathReplaceNotices(result, ref.path)) getState().notify(notice);
        return 'refused';
      default: {
        // Een onbekende stand of hulpbestanden die blijven staan, met hun record: de melding van Ctrl+S, en stoppen.
        const notices = ownPathReplaceNotices(result, ref.path);
        for (const notice of notices) getState().notify(notice);
        stopFor(candidate.id, ref, null);
        return 'refused';
      }
    }
  };

  const controller = createActualAutoSaveController({
    listCandidates: (): ActualAutoSaveCandidate[] => {
      // Tijdens de herstelkeuze bestaat de live state nog niet betrouwbaar uit de gekozen
      // documenten. Geen bestand overschrijven vóór die blokkerende fase klaar is.
      if (!deps.enabled() || isProjectFileWriteBusy()) return [];
      observe();
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
        // nog weg). Crashherstel loopt door. Stap 8: behalve met de flag aan en de bron aanwezig (`modelDocument`).
        const model = modelDocument(state, payload);
        const foreignBlocked = !model && ifcSaveBlocked(payload);
        if (foreignBlocked && payload.autoSaveToFile && payload.isDirty && !foreignNotified.has(id)) {
          foreignNotified.add(id);
          getState().notify(ifcWriteBlockedNotice(payload));
        }
        const refused = refusedTarget.get(id);
        if (refused && (!payload.isDirty || !ref || !sameFileRef(refused, ref))) refusedTarget.delete(id);
        // Stap 8: een document met een gebouwmodel alleen op zijn eigen ritme, en nooit waar Ctrl+S een vraag zou stellen.
        const enabled = payload.autoSaveToFile && !ifcSchemaBlocksSilentWrite(payload.project, payload.ifcSource) && !foreignBlocked
          && !refusedTarget.has(id) && (!model || (rhythm.isDue(id) && !dependentQuestionPossible(state, id, payload)));
        return { id, content: documentContentOf(state, id)!.content, enabled, dirty: payload.isDirty, ref, source: payload };
      });
    },
    canWrite: canWriteToRefWithoutPrompt,
    // #804 stap 3, fixronde 1: de ronde koos haar kandidaten vóór het slot. Begon intussen de laatste fase van afsluiten
    // of van de updater (`closeProjectFileWrites`), dan schrijft ze niet meer: `'refused'`, niets te melden, het
    // document blijft gewijzigd.
    // Stap 8: de route kiest het document zoals het nu is; `writeModel` en de gewone route toetsen het daarna opnieuw onder
    // het schrijfslot.
    write: candidate => modelPayload(candidate.id) ? writeModel(candidate) : runProjectFileWrite<ActualAutoSaveWrite>(async () => {
      // Wachten op een handmatige write mag nooit alsnog een inmiddels oude autosave-inhoud laten overschrijven. Kijk
      // dus OPNIEUW onder de exclusieve lock, vóór het voorbereiden.
      const current = getState().getOpenDocumentPayloads().find((d) => d.id === candidate.id)?.payload;
      if (!current) return false;
      const document = { id: candidate.id, content: candidate.content };
      if (!sameDocumentContent(getState(), document)) return 'stale';
      if (candidate.source.ifcSource !== current.ifcSource || !sameIFCSource(candidate.source, current)) return 'stale';
      // Een document met een vreemd deel schrijft deze route nooit: met de flag aan en de bron aanwezig gaat het langs
      // `writeModel` (stap 8), anders sloot de kandidatenlijst het al uit.
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
  return { ...controller, observe, nextModelRoundAt: () => rhythm.nextDueAt() };
}
