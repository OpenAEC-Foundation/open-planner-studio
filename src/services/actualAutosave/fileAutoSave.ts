// De echte AutoSave naar het bestand van elk open document: welke documenten, welk doel, en de write onder de
// schrijfcoördinatie. `useAutoSave` plant de rondes; deze module staat los van React, zodat een test hem met de echte
// store en bestandslaag kan draaien (#804 fase 1a, fixronde 2).
//
// #804 stap 8: een document met een gebouwmodel (flag `ifcForeignContent` aan, de bron aanwezig) doet mee, via dezelfde
// gecontroleerde vervanging als Ctrl+S (`replaceOwnHandleWithRecovery` in de browser, `replaceOwnPathWithRecovery` op de
// desktop), met een eigen ritme per document (`modelAutoSaveRhythm.ts`), en zijn ronde wijkt voor elke handmatige
// actie (`runYieldingProjectFileWrite`) tot het herstel van de vervanging vastligt. Een gewoon document en elk document
// met de flag uit houden hun route en hun ritme van vóór stap 8; hun tik wacht in de rij achter een modelronde
// (`runAutoSaveTickWrite`, fixronde 3 van de review van #1033).
import type { AppState } from '@/state/appStore';
import type { DocumentPayload } from '@/state/documentContract';
import { rememberLiteralCalendarsWritten } from '@/state/savedLiteralCalendars';
import { ifcSchemaBlocksSilentWrite } from '@/services/ifc/ifcSchemaQuestion';
import { buildWriteIFCInput, sameIFCSource, type IFCSaveSource } from '@/state/ifcSaveInput';
import { documentContentOf, sameDocumentContent, type DocumentContentRef } from '@/state/documentSaveState';
import { computeIfcOutputHere, documentSaveCompute, prepareIfcOutput, writtenData, type IfcOutputCompute } from '@/state/prepareIfcOutput';
import { IfcSaveWorkerError } from '@/services/ifc/saveWorker/ifcSaveWorkerError';
import {
  canWriteToRefWithoutPrompt, fileIdentityFs, sameFileRef, saveTargetRef, saveToRefWithoutPrompt, sourceTargetContent,
  writeTargetReaders, type FileRef,
} from '@/services/fileAccess';
import {
  isManualProjectFileWriteQueued, runAutoSaveTickWrite, runYieldingProjectFileWrite, type YieldingTurn,
} from '@/services/fileAccess/writeCoordinator';
import { pendingReplaceFor, tauriReplaceRecords } from '@/services/fileAccess/replaceRecords';
import { tightAnchorsIfSaved } from '@/state/dependentCandidates';
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

export interface FileAutoSaveController extends ActualAutoSaveController {
  /** #804 stap 8: na elke wijziging in de store; houdt het ritme van de documenten met een gebouwmodel bij. */
  observe: () => void;
  /** Fixronde 1 van de review van #1033: een toetsaanslag in open veldinvoer van het actieve document (`noteTextEntry`);
   *  telt als werken voor de rust van een document met een gebouwmodel. */
  noteTextEntry: () => void;
  /** Het vroegste moment (de klok `now`) waarop een document met een gebouwmodel dat meedoet aan de beurt is; `null`: geen. */
  nextModelRoundAt: () => number | null;
  /** Fixronde 1 van de review van #1033: een ronde alleen voor de documenten met een gebouwmodel (hun eigen wekker).
   *  `flush` is de gewone ingang (het ritme van 10 s): elk document dat meedoet, een gebouwmodel alleen als het aan de beurt
   *  is. */
  flushModels: () => Promise<void>;
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
  // Stap 8: met de bron van dat moment. Een handmatige opslag van een document met een gebouwmodel maakt de geschreven
  // versie de bron (een nieuw object); ook als de planner meteen weer typt, doet het document dan weer mee. Zonder
  // gebouwmodel verandert de bron bij opslaan niet, dus daar beslissen alleen de twee eerdere voorwaarden.
  const refusedTarget = new Map<string, { ref: FileRef; source: IFCSaveSource['ifcSource'] }>();
  const targetNotified = new Set<string>();
  /** #804 stap 8: stoppen voor dit document tot de planner zelf opslaat of een ander doel kiest, met hoogstens één
   *  melding per document per sessie (`null`: de melding kwam al van de vervanging zelf). */
  const stopFor = (id: string, ref: FileRef, notice: NotifyInput | null) => {
    refusedTarget.set(id, { ref, source: payloadOf(id)?.ifcSource ?? null });
    if (targetNotified.has(id)) return;
    targetNotified.add(id);
    if (notice) getState().notify(notice);
  };
  const payloadOf = (id: string) => getState().getOpenDocumentPayloads().find(d => d.id === id)?.payload;

  /**
   * #804 stap 8: de ronde van een document met een gebouwmodel, binnen één schrijfbeurt die wijkt: de controle dat de
   * ronde nog bij deze inhoud hoort, de doel- en bronvergelijking, de merge (in de worker), de doelcontrole opnieuw, de
   * vervanging met herstelrecord en de commit. Dezelfde controles en dezelfde vervanging als Ctrl+S op het eigen doel
   * (`writeActiveDocument` in `fileSlice.ts`), zonder vraag of venster en met de meldingen van Automatisch opslaan. Tot
   * het herstelrecord (desktop) of de komende versie in het herstelmanifest (browser) geschreven is, stopt de ronde
   * zodra `yielded` afgaat: niets geschreven, het document blijft gewijzigd, geen melding (`'yielded'`). Daarna loopt ze
   * af en wacht de handmatige actie. Die grens is `turn.pass()` (fixronde 2 van de review van #1033): vanaf daar telt de
   * ronde als plaatsend, en een IFC-export neemt zijn bron pas op als ze klaar is.
   */
  const writeModel = (candidate: ActualAutoSaveCandidate) => runYieldingProjectFileWrite<ActualAutoSaveWrite>(async turn => {
    // Fixronde 2 van de review van #1033: het ritme geldt op het moment van de beurt, niet alleen bij het kiezen. Typte de
    // planner intussen (de rust begon opnieuw), wijzigde hij iets, of doet het document niet meer mee, dan begint de
    // ronde niet: niets gerekend, het ritme onveranderd, geen melding; de wekker plant de volgende beurt.
    if (!stillDue(candidate.id)) return 'refused';
    // De duur van de ronde: vanaf de beurt in de rij, tot en met de commit en de laatste herstelronde. Week ze al terwijl
    // ze op haar beurt wachtte, dan telt dat ook als geweken (opnieuw na de volgende rustperiode).
    rhythm.roundStarted(candidate.id);
    let outcome: ActualAutoSaveWrite | undefined;
    try {
      outcome = turn.yielded.aborted ? 'yielded' : await modelRound(candidate, turn);
      return outcome;
    } finally {
      rhythm.roundEnded(candidate.id, outcome === true ? 'written' : outcome === 'yielded' ? 'yielded' : 'other');
    }
  }, () => 'refused');

  const modelRound = async (candidate: ActualAutoSaveCandidate, turn: YieldingTurn): Promise<ActualAutoSaveWrite> => {
    const { yielded } = turn;
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
    // Waar Ctrl+S zou vragen (een te krap anker van een afhankelijk project), slaat de ronde het document over: ze stelt
    // nooit een vraag. Dezelfde beoordeling als Ctrl+S (`tightAnchorsIfSaved`); een ruim anker houdt niets tegen.
    if ((await tightAnchorsIfSaved(getState().ui.dependentProjects, candidate.id, current)).length > 0) return 'refused';
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
    if (yielded.aborted) return 'yielded';
    const commit = () => getState().markAutoSaveVersionSaved(document, current, prepared);

    // De grens van de voorrang ligt in de gedeelde vervanging (`stopBeforeWrite`): pas als het herstel vastligt (browser:
    // de komende versie in het herstelmanifest; desktop: het herstelrecord en het manifest) en vóór de eerste schrijfactie
    // op het doel. Meldt zich tot dan een handmatige actie, ook terwijl het herstel nog geschreven wordt, dan wijkt de
    // ronde: niets geschreven, het herstel weer opgeruimd. Daarna loopt ze af en wacht de handmatige actie.
    if (ref.kind === 'handle') {
      const result = await replaceOwnHandleWithRecovery({
        documentId: candidate.id, ref, prepared, source: source.bytes,
        // De grens: na het vastleggen van het herstel, vlak vóór `createWritable()`. `pass` laat de ronde daarna aflopen.
        stopBeforeWrite: () => changed() || !turn.pass(), refuseBeforePlace: changed, commit,
      });
      if (result.code === 'replaced') return true;
      if (result.code === 'not-recorded') stopFor(candidate.id, ref, MODEL_AUTOSAVE_NOT_RECORDED_NOTICE);
      else if (result.code === 'target-changed') stopFor(candidate.id, ref, MODEL_AUTOSAVE_TARGET_CHANGED_NOTICE);
      else return yielded.aborted ? 'yielded' : 'stale';
      return 'refused';
    }

    // Het beleid voor een eerdere, onderbroken vervanging van dit doel: Ctrl+S gaat er met een eigen record overheen,
    // Automatisch opslaan niet (de start van de app of het openen van het bestand handelt het eerst af).
    if (await pendingReplaceFor(await tauriReplaceRecords(), ref.path)) {
      stopFor(candidate.id, ref, MODEL_AUTOSAVE_REMNANT_NOTICE);
      return 'refused';
    }
    if (yielded.aborted) return 'yielded';
    let stoppedBy: 'stale' | 'refused' | 'yielded' | null = null;
    const result = await replaceOwnPathWithRecovery({
      documentId: candidate.id, path: ref.path, prepared, source: { bytes: source.bytes, sha256: source.sha256 },
      stopBeforeWrite: async () => {
        stoppedBy = yielded.aborted ? 'yielded' : await guard();
        // De grens: na het vastleggen van het herstel, vlak vóór de eerste schrijfactie in de projectmap.
        if (stoppedBy === null && !turn.pass()) stoppedBy = 'yielded';
        return stoppedBy !== null;
      },
      refuseBeforePlace: () => { if (changed()) stoppedBy = 'stale'; return stoppedBy !== null; },
      commit,
    });
    switch (result.code) {
      case 'replaced':
        // Een versie van een ander programma of een achtergebleven vorige versie: een feit over bestanden op schijf.
        for (const notice of ownPathReplaceNotices(result, ref.path)) getState().notify(notice);
        return true;
      case 'stopped': return stoppedBy ?? 'stale';
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

  /** Een oude weigering vervalt als de planner zelf opsloeg (niet meer gewijzigd, of bij een gebouwmodel een nieuwe bron)
   *  of een ander doel koos. */
  const settleRefusal = (id: string, payload: DocumentPayload, ref: FileRef | null) => {
    const refused = refusedTarget.get(id);
    if (refused && (!payload.isDirty || !ref || !sameFileRef(refused.ref, ref) || payload.ifcSource !== refused.source)) {
      refusedTarget.delete(id);
    }
  };
  /** Eén afleiding van het opslagdoel, dezelfde als Opslaan. Een site-bestand valt hier bewust af: automatisch opslaan
   *  naar de site staat uit (elke ronde zou een nieuwe versie maken, besluit #309). Alleen Opslaan schrijft naar de site;
   *  crashherstel loopt gewoon door. */
  const autoSaveRef = (payload: DocumentPayload): FileRef | null => {
    const target = saveTargetRef(payload);
    return target?.kind === 'site' ? null : target;
  };
  /** Doet dit document mee, los van zijn ritme? Schemavraag (issue #292): staat die open voor een schema dat de app niet
   *  schrijft (IFC2X3), dan zou automatisch opslaan het bestandstype stil veranderen. Dan wacht het bestand op het eerste
   *  expliciete opslaan, met de vraag. Crashherstel loopt gewoon door. */
  const takesPart = (id: string, payload: DocumentPayload): boolean => {
    settleRefusal(id, payload, autoSaveRef(payload));
    return payload.autoSaveToFile && !ifcSchemaBlocksSilentWrite(payload.project, payload.ifcSource) && !refusedTarget.has(id);
  };

  /** Doet dit document zonder gebouwmodel mee met de gewone tik? Dezelfde toets bij de keuze (`listPlain`) en bij de beurt
   *  in de rij (`write`, fixronde 4 van de review van #1033): een document met een vreemd deel schrijft deze route nooit. */
  const plainTakesPart = (id: string, payload: DocumentPayload): boolean => takesPart(id, payload) && !ifcSaveBlocked(payload);

  /** Fixronde 2 van de review van #1033: is dit document met een gebouwmodel nu (nog) aan de beurt? */
  const stillDue = (id: string): boolean => {
    observe();
    const payload = payloadOf(id);
    return !!payload && modelDocument(getState(), payload) && takesPart(id, payload) && rhythm.isDue(id);
  };

  /**
   * De gewone ronde (het ritme van 10 s): elk document zonder gebouwmodel, precies zoals vóór stap 8. Een document met een
   * gebouwmodel hoort hier niet bij (fixronde 2 van de review van #1033); dat zet alleen zijn eigen wekker aan de beurt
   * (`listModels`). Een ronde met een gebouwmodel in de rij houdt de gewone ronde niet tegen: haar tik sluit achter de
   * modelronde aan en schrijft direct daarna, zonder haar te laten wijken (`runAutoSaveTickWrite`, fixronde 3 van de review
   * van #1033). Alleen een handmatige actie in de rij laat de tik deze keer overslaan, zoals vóór stap 8.
   */
  const listPlain = (): ActualAutoSaveCandidate[] => {
    // Tijdens de herstelkeuze bestaat de live state nog niet betrouwbaar uit de gekozen
    // documenten. Geen bestand overschrijven vóór die blokkerende fase klaar is.
    if (!deps.enabled() || isManualProjectFileWriteQueued()) return [];
    const state = getState();
    const candidates: ActualAutoSaveCandidate[] = [];
    for (const { id, payload } of state.getOpenDocumentPayloads()) {
      if (modelDocument(state, payload)) continue;
      // #804 fase 1a: een document met een vreemd deel schrijft niet naar het bestand (de writer laat het model
      // nog weg). Crashherstel loopt door. Stap 8: behalve met de flag aan en de bron aanwezig (`listModels`).
      const foreignBlocked = ifcSaveBlocked(payload);
      if (foreignBlocked && payload.autoSaveToFile && payload.isDirty && !foreignNotified.has(id)) {
        foreignNotified.add(id);
        getState().notify(ifcWriteBlockedNotice(payload));
      }
      const enabled = plainTakesPart(id, payload);
      candidates.push({ id, content: documentContentOf(state, id)!.content, enabled, dirty: payload.isDirty,
        ref: autoSaveRef(payload), source: payload });
    }
    return candidates;
  };

  /** De ronde van de wekker met een gebouwmodel: alleen de documenten met een gebouwmodel die aan de beurt zijn. Bij hun
   *  beurt in de rij toetst `writeModel` het ritme opnieuw. Waar Ctrl+S een vraag zou stellen, beslist de ronde zelf
   *  (`modelRound`): ze stelt nooit een vraag. */
  const listModels = (): ActualAutoSaveCandidate[] => {
    // Een gewone tik in de rij houdt de modelronde niet tegen: ze sluit erachter aan en krijgt zo haar beurt.
    if (!deps.enabled() || isManualProjectFileWriteQueued()) return [];
    observe();
    const state = getState();
    const candidates: ActualAutoSaveCandidate[] = [];
    for (const { id, payload } of state.getOpenDocumentPayloads()) {
      if (!modelDocument(state, payload)) continue;
      candidates.push({ id, content: documentContentOf(state, id)!.content, enabled: takesPart(id, payload) && rhythm.isDue(id),
        dirty: payload.isDirty, ref: autoSaveRef(payload), source: payload });
    }
    return candidates;
  };

  const roundDeps = {
    canWrite: canWriteToRefWithoutPrompt,
    // #804 stap 3, fixronde 1: de ronde koos haar kandidaten vóór het slot. Begon intussen de laatste fase van afsluiten
    // of van de updater (`closeProjectFileWrites`), dan schrijft ze niet meer: `'refused'`, niets te melden, het
    // document blijft gewijzigd.
    write: (candidate: ActualAutoSaveCandidate) => runAutoSaveTickWrite<ActualAutoSaveWrite>(async () => {
      // Wachten op een handmatige write mag nooit alsnog een inmiddels oude autosave-inhoud laten overschrijven. Kijk
      // dus OPNIEUW onder de exclusieve lock, vóór het voorbereiden.
      const current = getState().getOpenDocumentPayloads().find((d) => d.id === candidate.id)?.payload;
      if (!current) return false;
      // Fixronde 4 van de review van #1033: een tik die achter een modelronde wachtte, toetst bij zijn beurt of zijn document
      // nog meedoet (dezelfde toets als bij de keuze), nog gewijzigd is en nog hetzelfde doel heeft. Zette de planner
      // Automatisch opslaan intussen uit, dan schrijft hij niets en meldt hij niets. Fixronde 5: synchroon, zonder wachten
      // tussen deze toets en het voorbereiden; de schrijftoestemming vraagt de controller zoals vóór stap 8 (`canWrite`).
      const target = autoSaveRef(current);
      if (!deps.enabled() || !current.isDirty || !plainTakesPart(candidate.id, current)
        || !target || !sameFileRef(target, candidate.ref!)) return 'refused';
      const document = { id: candidate.id, content: candidate.content };
      if (!sameDocumentContent(getState(), document)) return 'stale';
      if (candidate.source.ifcSource !== current.ifcSource || !sameIFCSource(candidate.source, current)) return 'stale';
      // #804 stap 6: de momentopname en het rekenen onder het schrijfslot, via dezelfde berekenfunctie als Ctrl+S
      // (de opslagworker). Typt de planner intussen, dan schrijft de ronde deze momentopname en blijft het document
      // gewijzigd (`commitSavedDocument`); de volgende ronde neemt het latere werk mee.
      const ui = getState().ui;
      const output = await prepareIfcOutput({ ...current, ui }, buildWriteIFCInput(current, 'merge'), undefined,
        documentSaveCompute(ui.featureFlags, compute));
      if (output.prepared) return 'refused';
      // #804 fixronde 2: dezelfde doelcontrole als Opslaan, onder dezelfde lock. Fixronde 1 van #1027 (review Sol): ná het
      // rekenen, vlak vóór het schrijven, zoals Ctrl+S: een gebouwmodel dat tijdens het rekenen op het doel verscheen,
      // wordt niet overschreven. Eén doelscan; daarna beslist alleen nog de synchrone inhoudscontrole hieronder.
      const reason = await refusedWriteTarget(getState(), candidate.ref!, targetDeps);
      if (reason) {
        refusedTarget.set(candidate.id, { ref: candidate.ref!, source: current.ifcSource });
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
      const plain = writtenData(ui.featureFlags, output);
      const written = await saveToRefWithoutPrompt(candidate.ref!, plain.data, contentReplaced);
      if (replaced) return 'stale';
      if (!written) return false;
      const fingerprint = plain.fingerprint instanceof Promise ? await plain.fingerprint : plain.fingerprint;
      // Binnen dezelfde schrijfbeurt vastleggen, zoals Ctrl+S: dirty alleen weg als precies deze versie nog actueel is.
      getState().markAutoSaveVersionSaved(document, current, undefined, fingerprint);
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
  } satisfies Omit<Parameters<typeof createActualAutoSaveController>[0], 'listCandidates'>;
  // Fixronde 2 van de review van #1033: twee gescheiden ingangen naar dezelfde schrijfrij. De gewone (het ritme van 10 s)
  // kent alleen documenten zonder gebouwmodel; de wekker van een gebouwmodel is de enige die een gebouwmodel aan de beurt
  // zet. Zo kiezen twee ingangen nooit hetzelfde document.
  const plain = createActualAutoSaveController({ ...roundDeps, listCandidates: listPlain });
  const models = createActualAutoSaveController({ ...roundDeps, listCandidates: listModels, write: writeModel });
  return {
    flush: plain.flush,
    flushModels: models.flush,
    isSaving: () => plain.isSaving() || models.isSaving(),
    observe,
    noteTextEntry: () => {
      const id = getState().activeDocumentId;
      if (tracked.has(id)) rhythm.touch(id);
    },
    // Alleen de documenten die meedoen (knownbug 1925): een gewijzigd gebouwmodel met Automatisch opslaan uit, of na een
    // stop, houdt de wekker niet wakker.
    nextModelRoundAt: () => {
      const payloads = new Map(getState().getOpenDocumentPayloads().map(({ id, payload }) => [id, payload]));
      return rhythm.nextDueAt(id => { const payload = payloads.get(id); return !!payload && takesPart(id, payload); });
    },
  };
}
