import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { cpmResultFromRecorded, type RecordedDatesState } from '@/engine/scheduler/recordedDates';
import { solveProject } from '@/engine/scheduler/solveProject';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { computeReliableResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import {
  levelResources as computeLeveling,
  type LevelingOptions,
  type LevelingResult,
} from '@/engine/scheduler/ResourceLeveler';
import { markScheduleStale } from '../transaction';
import { HOST_EVENTS } from '@/services/extensionEvents';
import { notifyLevelingDelayRounded } from '../timephasedLossNotice';
import { clearLevelingGaps } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { AppSliceFactory } from './types';

export interface ScheduleSlice {
  cpmResult: CPMResult | null;
  /** Belasting/capaciteit/overallocatie per resource, herberekend bij elke `runCPM` (fase 2.5,
   *  resources-ontwerp §4.2) — "manual, not reactive", net als `cpmResult` zelf. */
  resourceLoadResult: ResourceLoadResult | null;
  /** "Verouderd"-vlag (A6): gezet door datum-rakende mutaties (taak-/relatie-/projectkalender-
   *  wijzigingen), gewist door `runCPM`. Voedt een subtiele "herbereken (F5)"-hint. */
  scheduleStale: boolean;
  /** "Datums zoals opgeslagen" (issue #63) — wat het geopende bestand vastlegde, plus de teller
   *  voor de melding. Niet-null ⇒ herberekening verschoof datums en de strook biedt de modus aan.
   *  Bestaat alleen tussen het laden en de eerste bewerking/berekening. */
  recordedDates: RecordedDatesState | null;
  /** Staat de modus aan: toont de app de opgeslagen datums in plaats van de herberekende? */
  datesAsRecorded: boolean;
  /** Zet de app in "datums zoals opgeslagen": herstel wat het bestand vastlegde en reconstrueer
   *  `cpmResult` daaruit, zonder te solven. Pusht een undo-snapshot (contract-invariant: élke
   *  mutator van `datesAsRecorded` doet dat), maar zet bewust géén `isDirty` — de state komt hiermee
   *  dichter bij het bestand te liggen, niet verder. No-op zonder `recordedDates`. */
  showRecordedDates: () => void;
  /** Aanbod afslaan: de strook verdwijnt en de gebruiker werkt normaal verder met de herberekende
   *  planning. Géén undo-snapshot — er verandert niets aan de projectdata, alleen een aanbod
   *  verdwijnt. */
  dismissRecordedDates: () => void;
  runCPM: () => void;
  /** Herbereken ALLEEN de resource-belasting op de bestaande CPM-datums (A6): pure resource-
   *  mutaties (toewijzen, capaciteit, kalender) verversen zo het histogram direct, ZONDER runCPM en
   *  ZONDER de datums aan te raken — past binnen "manual, not reactive". Datum-rakende mutaties
   *  blijven handmatig (F5) en zetten in plaats hiervan `scheduleStale`. */
  recomputeResourceLoad: () => void;
  /** Nivelleer-preview (fase 2.5, §5): berekent de resource-nivellering tegen de laatst gedraaide
   *  CPM-run en geeft het resultaat terug ZONDER de store te muteren (UI toont eerst een diff,
   *  commit gaat via `applyLeveling`). Vereist een geldige `cpmResult`. */
  levelResources: (options: LevelingOptions) => LevelingResult;
  /** Commit een nivelleerresultaat: één undo-snapshot, schrijf `levelingDelay`s + `splitGaps`
   *  (idempotent — reset eerst álles binnen de scope, dan de nieuwe waarden) en her-draai CPM (§5.6).
   *  `write` is precies wat de verdeler levert (`Pick<LevelingResult, 'delays' | 'gaps'>`) — een
   *  volle `LevelingResult` is hieraan toewijsbaar, dus bestaande aanroepers (LevelingDialog, MCP)
   *  blijven ongewijzigd werken. Met `opts.scopeTaskIds` (B1c-plan3 taak 2, spec §5 "scope-behoudend
   *  toepassen — op drie plekken") raken alleen de gescopete taken hun delay/gaten kwijt; taken
   *  buiten de scope zijn vaste last waarop het voorstel gerekend heeft en blijven ongemoeid. Afwezig
   *  ⇒ byte-identiek aan het gedrag van vóór B1c-plan3: alle taken worden gereset. */
  applyLeveling: (
    write: Pick<LevelingResult, 'delays' | 'gaps'>,
    opts?: { scopeTaskIds?: string[] },
  ) => void;
  /** "Nivellering wissen": één undo-snapshot, zet alle `levelingDelay` terug op undefined,
   *  her-draai CPM. */
  clearLeveling: () => void;
}

export const createScheduleSlice: AppSliceFactory<ScheduleSlice> = (runtime) => (set, get) => ({
  cpmResult: null,
  resourceLoadResult: null,
  scheduleStale: false,
  recordedDates: null,
  datesAsRecorded: false,

  recomputeResourceLoad: () => {
    // Rekenen BUITEN de producer, alleen het resultaat erin — zelfde vorm als `recomputeViewRows`.
    // `computeResourceLoad` leest élke resource, toewijzing en taak; deed het dat op de draft, dan
    // maakte Immer voor stuk voor stuk een proxy die het aan het eind van de producer weer moet
    // finaliseren en bevriezen. Dat was zichtbaar duur: bij 1.000 taken/toewijzingen ging ~16% van
    // één `assignResource` op aan Immer-proxywerk waar nul mutaties tegenover stonden. `get()` levert
    // dezelfde (bevroren, dus veilig te lezen) staat plain.
    const s = get();
    const result = computeReliableResourceLoad(
      s.cpmResult, s.resources, s.assignments, s.tasks, s.calendar, s.calendars,
    );
    set((st) => { st.resourceLoadResult = result; });
  },

  runCPM: () => {
    set((s) => {
      const refreshPreviousEventAfter = s.scheduleStale && !s.datesAsRecorded;
      let openedHistory = false;
      // "Datums zoals opgeslagen" (issue #63): dit is de ENIGE situatie waarin `runCPM` een undo-
      // snapshot pusht. Buiten de modus blijft het gedrag byte-identiek en blijft de invariant
      // intact waar `staleGuard.ts` (ensureFreshSchedule) en `batchTool.ts` (recomputeMidBatch) op
      // leunen: "runCPM zet géén isDirty en pusht géén undo-snapshot". Binnen de modus is
      // doorrekenen wél een datawijziging — de opgeslagen datums worden overschreven — en die hoort
      // ongedaan te kunnen.
      //
      // Positie: bovenaan de producer uit hygiëne (de huisconventie "guards; beginUndoable;
      // mutatie"). Op het normale pad maakt het niets uit — `beginUndoable` kloont uit
      // `original(s)`, de pre-producer-basisstaat, dus de plek binnen deze producer verandert de
      // snapshot niet. Op de defensieve `?? s`-terugval in transaction.ts (mocht `original` ooit
      // undefined geven) kloont hij wél de draft, en dán telt de positie alsnog. Laat 'm dus staan.
      //
      // Binnen een MCP- of bulk-transactie zwijgt `beginUndoable`; de transactie nam haar ene
      // snapshot al vóór de eerste mutatie (dus mét de modus aan) en dekt dit mee — zie
      // `mcpTransaction.ts` stap 5 en `batchTool.ts` (recomputeMidBatch).
      //
      // Dit is een BACKSTOP-pad, geen hoofdpad: de datum-rakende mutaties die zélf herrekenen
      // (moveProject, applyLeveling, clearLeveling) verlaten de modus sinds de review van taak 6
      // in hun eigen producer, via `finishMutation({ stale: true })`. Zo blijft het bij één
      // undo-stap in plaats van twee, met een tussentoestand die de gebruiker nooit gezien heeft.
      if (s.datesAsRecorded) {
        runtime.beginUndoable(s);
        openedHistory = true;
        s.datesAsRecorded = false;
        s.recordedDates = null;
      }
      s.scheduleStale = false; // F5/Bereken gedraaid — schema is (voor deze taken/relaties) vers.
      // De reken-kern (leaf-filter → solve → terugschrijven/rollup) staat sinds A3/M3 in
      // `solveProject` en draait rechtstreeks op de Immer-draft: `s.tasks` wordt in-place gemuteerd,
      // net als voorheen. Dezelfde functie draait het bezettingsoverzicht op een KLOON van de taken
      // van een stale document (B1b §4.3b) — één implementatie, geen divergentie. De samenvattings-
      // relatie-propagatie (MS Project-semantiek) zit dáár, zodat elke afnemer van de kern hem krijgt.
      const result = solveProject({
        tasks: s.tasks,
        sequences: s.sequences,
        calendar: s.calendar,
        calendars: s.calendars,
        dataDate: s.project.statusDate,
        progressMode: s.project.progressMode,
        schedulingOptions: s.project.schedulingOptions,
        // Gebruikstest-bevinding 2026-08: ondergrens voor taken zónder voorganger (`rootFloor` in
        // CPMSolver) — zonder deze optie kon een taak met een verouderde `scheduleStart` (bv. gezet
        // vóór een latere wijziging van de projectstartdatum) gewoon vóór het projectbegin doorlopen.
        projectStartDate: s.project.startDate,
      });

      // If circular dependency detected, store the result (with error) and bail
      if (result.error) {
        s.cpmResult = result;
        s.resourceLoadResult = null;
        if (openedHistory) runtime.finishUndoable(s);
        else if (refreshPreviousEventAfter) runtime.refreshLatestDocumentDataHistoryAfter(s);
        // Een mislukte berekening laat de invoer niet actueel worden. Dit is ook belangrijk voor
        // automatisch berekenen: de statusbalk mag de waarschuwing alleen tijdelijk onderdrukken
        // terwijl een geplande solve nog kans heeft om te slagen.
        markScheduleStale(s);
        return;
      }

      s.cpmResult = result;

      // Belasting/overallocatie herberekenen ná de CPM-pass + samenvattingstaak-rollup hierboven
      // (de resource-belasting mapt op de zojuist bijgewerkte earlyStart/earlyFinish).
      s.resourceLoadResult = computeReliableResourceLoad(
        s.cpmResult, s.resources, s.assignments, s.tasks, s.calendar, s.calendars,
      );
      if (openedHistory) runtime.finishUndoable(s);
      else if (refreshPreviousEventAfter) runtime.refreshLatestDocumentDataHistoryAfter(s);
    });

    // Filter/sort kunnen op de zojuist bijgewerkte totalFloat/isCritical/earlyStart keyen (§4.3).
    get().recomputeViewRows();

    // Bevinding K8: een CPM-fout (cyclus, kalender zonder werkdagen, ongeldige startdatum) pusht
    // zichzelf naar het gecentraliseerde meldingenkanaal. Eén controle hier dekt beide uitgangen
    // van deze actie — de cyclus-bail boven én het normale pad — want in beide staat `cpmResult`
    // met de fout. Winst: de fout is nu óók zichtbaar vanuit Backstage/tabel/rapport, waar de
    // canvas-component (vroeger de énige toast) niet gemonteerd is.
    const cpmError = get().cpmResult?.error;
    if (cpmError) {
      get().notify({
        severity: 'error',
        messageKey: 'notifications.scheduleFailed',
        detail: cpmError,
        dedupeKey: 'cpm-error',
      });
    }

    const cpm = get().cpmResult;
    runtime.emitHostEvent(HOST_EVENTS.scheduleCalculated, {
      hasError: !!cpm?.error,
      error: cpm?.error ?? null,
      criticalTasks: get().tasks.filter((t) => t.time.isCritical).length,
    });
  },

  showRecordedDates: () => {
    set((s) => {
      const info = s.recordedDates;
      if (!info || s.datesAsRecorded) return; // no-op ⇒ géén snapshot (transaction.ts-patroon)
      runtime.beginUndoable(s);

      for (const task of s.tasks) {
        const rec = info.times[task.id];
        if (!rec) continue;
        task.time.earlyStart = rec.start;
        task.time.earlyFinish = rec.finish;
        task.time.lateStart = rec.lateStart ?? rec.start;
        task.time.lateFinish = rec.lateFinish ?? rec.finish;
        task.time.totalFloat = rec.totalFloat ?? 0;
        task.time.freeFloat = rec.freeFloat ?? 0;
        task.time.isCritical = rec.isCritical ?? false;
        // De analyse-afleidingen komen uit de zojuist weggegooide solve en zouden een planning
        // beschrijven die niet meer op het scherm staat. `applyCpmResult` hanteert dezelfde regel
        // voor uitgezette opties: afwezig ⇒ het veld wordt gewist.
        task.time.interferingFloat = undefined;
        task.time.isNearCritical = undefined;
        task.time.floatPath = undefined;
      }

      s.cpmResult = cpmResultFromRecorded(info.times, s.tasks, s.calendar);
      s.resourceLoadResult = computeReliableResourceLoad(
        s.cpmResult, s.resources, s.assignments, s.tasks, s.calendar, s.calendars,
      );
      s.datesAsRecorded = true;
      // De weergave is consistent met wat er getoond wordt — niet verouderd.
      s.scheduleStale = false;
      // Wel history sluiten, maar bewust niet dirty maken: er is niets gewijzigd t.o.v. het bestand.
      runtime.finishUndoable(s);
    });
    get().recomputeViewRows();
  },

  dismissRecordedDates: () => {
    // Géén beginUndoable/finishMutation: dit vuurt alleen in de AANBOD-stand (recordedDates gezet,
    // datesAsRecorded nog false) en raakt geen projectdata (tasks/cpmResult) of `datesAsRecorded`
    // aan — alleen het aanbod zelf verdwijnt. Dat lijkt in te gaan tegen de snapshot.ts-invariant
    // ("élke mutator van een 'ref'-snapshotveld pusht een snapshot"), maar die invariant bewaakt
    // DATA-consistentie: dat een undo nooit een half-oude/half-nieuwe combinatie van velden kan
    // opleveren (bug-klasse B3, bv. wbsAutoNumber). Hier is er geen combinatie om uit elkaar te
    // laten lopen — `recordedDates` bepaalt alleen of de strook een aanbod tóónt, en elke ECHTE
    // mutator (showRecordedDates, runCPM) pusht zijn EIGEN snapshot mét de op-dat-moment geldende
    // waarde van dit veld erin, dus die snapshots blijven intern consistent ongeacht wat dismiss
    // deed. Precedent: `recomputeResourceLoad` muteert `resourceLoadResult` (ook 'ref') net zo
    // zonder snapshot, om dezelfde reden — een zuiver afgeleid/advies-veld, geen brondata.
    // Effect van het ontbreken van een snapshot: een latere undo die vóór deze dismiss terugspoelt
    // laat het aanbod correct herverschijnen (het bestond toen echt), in plaats van dat "dismiss"
    // een eigen ongedaan-te-maken stap wordt — precies de bedoeling voor een wegklikbare melding.
    set((s) => { s.recordedDates = null; });
  },

  levelResources: (options) => {
    const s = get();
    const cpm = s.cpmResult;
    if (!cpm || cpm.error) {
      // Geen (geldige) CPM-run: niets te nivelleren — lege, veilige uitkomst.
      const end = cpm?.projectEnd ?? '';
      return { delays: {}, unresolved: {}, unresolvedReasons: {}, shifts: {}, projectEndBefore: end, projectEndAfter: end, gaps: {} };
    }
    // De leveler werkt op leaf-taken (net als de CPM-pass in runCPM).
    const leafTasks = s.tasks.filter((t) => t.childIds.length === 0);
    // Zelfde samenvattingsrelatie-propagatie als runCPM (zie daar): `ResourceLeveler` krijgt hier
    // alleen bladtaken door, dus de expansie moet vóór het leaf-filter gebeuren, met de VOLLEDIGE
    // taakboom (parentId/childIds) als bron — `ResourceLeveler` zelf blijft ongewijzigd, die kent
    // de WBS-boom sowieso niet en hoeft dat ook niet te weten.
    const { sequences: expandedSequences } = expandSummaryRelations(s.tasks, s.sequences);
    // Fase 2.10 (P1-verwante correctie): dezelfde CPMOptions als `runCPM` hierboven meegeven —
    // zonder `dataDate`/`progressMode` rekende de nivelleerder intern op een pure-ASAP-realiteit
    // die van de echte (actual-gepinde) planning kan afwijken zodra er voortgang+statusdatum is
    // (zie de parameter-toelichting in `ResourceLeveler.ts:levelResources`).
    return computeLeveling(
      leafTasks, expandedSequences, s.resources, s.assignments, s.calendar, s.calendars, cpm, options,
      {
        dataDate: s.project.statusDate, progressMode: s.project.progressMode,
        schedulingOptions: s.project.schedulingOptions,
        // Zelfde projectstart-vloer als runCPM hierboven (gebruikstest-bevinding 2026-08) — anders
        // zou de nivelleerder een wortel-taak vóór het projectbegin kunnen laten staan.
        projectStartDate: s.project.startDate,
      },
    );
  },

  applyLeveling: (write, opts) => {
    // B1c-plan-2 taak 1 (M10, eigenaarsbesluit 2026-08-31): telt HOEVEEL taken hier hun sub-dag-
    // precisie verliezen, voor de eenmalige-per-document melding hieronder (buiten de producer,
    // zie `notifyTimephasedLoss`-precedent — `notify` roept zelf `set` aan, dus niet genest).
    let roundedCount = 0;
    set((s) => {
      runtime.beginUndoable(s);
      // Scope-behoudend toepassen (spec §5, derde plek — B1c-plan3 taak 2). Zonder scope blijft dit
      // byte-identiek aan het gedrag van vóór B1c-plan3: alle taken worden gereset. MET scope raken
      // we uitsluitend de gescopete taken — de verdeler nivelleert per POOLITEM, dus een delay op een
      // taak die niets met dat poolitem te maken heeft is VASTE LAST waarop het voorstel gerekend
      // heeft; die hier wissen zou het document herschikken en het voorstel ongeldig maken.
      const scope = opts?.scopeTaskIds ? new Set(opts.scopeTaskIds) : null;
      for (const task of s.tasks) {
        if (scope && !scope.has(task.id)) continue;
        const d = write.delays[task.id];
        task.levelingDelay = d !== undefined && d > 0 ? d : undefined;
        // M10: `CPMSolver.shiftByLevelingDelay` leest `levelingDelayMinutes` VÓÓR `levelingDelay`.
        // Een achtergebleven sub-dag-waarde (uit een `.mpp`-import) zou de zojuist berekende delay
        // stil overrulen — nivelleren zou dan zichtbaar niets doen. De nivelleerder rekent in hele
        // werkdagen, dus de sub-dag-precisie van de VORIGE nivellering vervalt hier bewust — dat is
        // zichtbaar gebruikersverlies (eigenaarsbesluit 2026-08-31), geteld voor de melding hieronder.
        if (task.levelingDelayMinutes !== undefined || task.levelingDelayElapsed !== undefined) {
          roundedCount++;
        }
        task.levelingDelayMinutes = undefined;
        task.levelingDelayElapsed = undefined;
        // De onderbreek-modus (spec §4, "Herkomst"). `write.gaps[id]` is de VOLLEDIGE te schrijven
        // waarde — importsplits inbegrepen — dus hij mag rechtstreeks. Staat de taak NIET in
        // `write.gaps`, dan levert dit voorstel voor haar geen onderbreking: wis dan haar eventuele
        // leveling-gaten van een VORIGE nivellering en laat importsplits staan. Dat is precies wat
        // "idempotent herschrijven" betekent, en het is ook wat er gebeurt zodra de gebruiker
        // "Onderbrekingen toestaan" uitzet en opnieuw toepast (`gaps` is dan `{}`).
        const g = write.gaps[task.id];
        if (g !== undefined) task.splitGaps = g.length > 0 ? g : undefined;
        else clearLevelingGaps(task);
      }
      // Wél de stale-vlag (issue #63): dit is een datum-rakende mutatie, en `stale` is het signaal
      // waarop `finishMutation` de modus "datums zoals opgeslagen" verlaat — in dezelfde producer
      // die de snapshot hierboven al nam, dus in één undo-stap i.p.v. twee (zie moveProject).
      // De aansluitende runCPM zet `scheduleStale` meteen weer op false.
      runtime.finishMutation(s, { stale: true });
    });
    if (roundedCount > 0) {
      notifyLevelingDelayRounded(get().notify, get().activeDocumentId, roundedCount);
    }
    get().runCPM();
  },

  clearLeveling: () => {
    let changed = false;
    let roundedCount = 0;
    set((s) => {
      // M10: het no-op-guard breidt uit naar `levelingDelayMinutes` — anders zou een taak die
      // UITSLUITEND sub-dag-precisie draagt (geen `levelingDelay`) hier stil overgeslagen worden.
      // Fixronde B1c-plan-2-etappe-2 (bevinding 6): `levelingDelayElapsed` ontbrak hier terwijl de
      // teller vlak eronder 'm wél meetelt — een taak met UITSLUITEND `levelingDelayElapsed` werd zo
      // stil overgeslagen (geen snapshot, geen melding), ook al zou de lus 'm wél gewist hebben.
      // B1c-plan3 taak 2: de guard telt sinds nu ook leveling-GATEN mee — dezelfde conditie als de
      // ribbon-enable-check in `ribbonConfig.tsx` (letterlijk gelijk houden: een knop die inschakelt
      // terwijl de actie een no-op is, of andersom, is precies de bug die dit repareert).
      const hasLevelingGap = (t: Task) => (t.splitGaps ?? []).some(g => g.source === 'leveling');
      if (!s.tasks.some((t) =>
        t.levelingDelay !== undefined || t.levelingDelayMinutes !== undefined
        || t.levelingDelayElapsed !== undefined || hasLevelingGap(t))) return; // niets te wissen, geen snapshot
      runtime.beginUndoable(s);
      for (const task of s.tasks) {
        if (task.levelingDelayMinutes !== undefined || task.levelingDelayElapsed !== undefined) {
          roundedCount++;
        }
        task.levelingDelay = undefined;
        task.levelingDelayMinutes = undefined;
        task.levelingDelayElapsed = undefined;
        clearLevelingGaps(task); // uitsluitend `source: 'leveling'`; importsplits zijn brondata
      }
      runtime.finishMutation(s, { stale: true }); // zie applyLeveling; de aansluitende runCPM wist de vlag.
      changed = true;
    });
    if (roundedCount > 0) {
      notifyLevelingDelayRounded(get().notify, get().activeDocumentId, roundedCount);
    }
    if (changed) get().runCPM();
  },
});
