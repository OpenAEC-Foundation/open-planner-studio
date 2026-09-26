import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { applyRecordedTimesToTasks, type RecordedDatesState } from '@/engine/scheduler/recordedDates';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor, solveOptionsFor } from '@/engine/scheduler/solveInput';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { computeReliableResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import {
  levelResources as computeLeveling,
  type LevelingOptions,
  type LevelingResult,
} from '@/engine/scheduler/ResourceLeveler';
import { markScheduleStale } from '../transaction';
import { scheduleFailedNotice } from '../scheduleErrorNotice';
import { HOST_EVENTS } from '@/services/extensionEvents';
import { notifyLevelingDelayRounded } from '../timephasedLossNotice';
import { clearLevelingOutput, hasLevelingOutput, writeLevelingResult } from '@/utils/taskDefaults';
import type { AppSliceFactory } from './types';
import { isLeafTask } from '@/utils/taskHierarchy';

export interface ScheduleSlice {
  cpmResult: CPMResult | null;
  /** Belasting/capaciteit/overallocatie per resource, herberekend bij elke `runCPM`
   *  — "manual, not reactive", net als `cpmResult` zelf. */
  resourceLoadResult: ResourceLoadResult | null;
  /** "Verouderd"-vlag: gezet door datum-rakende mutaties (taak-/relatie-/projectkalender-
   *  wijzigingen), gewist door `runCPM`. Voedt een subtiele "herbereken (F5)"-hint. */
  scheduleStale: boolean;
  /** "Datums zoals opgeslagen" — wat het geopende bestand vastlegde, plus de teller
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
  /** Herbereken ALLEEN de resource-belasting op de bestaande CPM-datums: pure resource-
   *  mutaties (toewijzen, capaciteit, kalender) verversen zo het histogram direct, ZONDER runCPM en
   *  ZONDER de datums aan te raken — past binnen "manual, not reactive". Datum-rakende mutaties
   *  blijven handmatig (F5) en zetten in plaats hiervan `scheduleStale`. */
  recomputeResourceLoad: () => void;
  /** Nivelleer-preview: berekent de resource-nivellering tegen de laatst gedraaide
   *  CPM-run en geeft het resultaat terug ZONDER de store te muteren (UI toont eerst een diff,
   *  commit gaat via `applyLeveling`). Vereist een geldige `cpmResult`. */
  levelResources: (options: LevelingOptions) => LevelingResult;
  /** Commit een nivelleerresultaat: één undo-snapshot, schrijf `levelingDelay`s + `splitGaps`
   *  (idempotent — reset eerst álles binnen de scope, dan de nieuwe waarden) en her-draai CPM.
   *  `write` is precies wat de verdeler levert (`Pick<LevelingResult, 'delays' | 'gaps'>`) — een
   *  volle `LevelingResult` is hieraan toewijsbaar, dus bestaande aanroepers (LevelingDialog, MCP)
   *  blijven ongewijzigd werken. Met `opts.scopeTaskIds` (scope-behoudend toepassen) raken alleen
   *  de gescopete taken hun delay/gaten kwijt; taken buiten de scope zijn vaste last waarop het
   *  voorstel gerekend heeft en blijven ongemoeid. Afwezig ⇒ alle taken worden gereset. */
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
    // finaliseren en bevriezen — zichtbaar duur, voor nul mutaties. `get()` levert
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
      // "Datums zoals opgeslagen": dit is de ENIGE situatie waarin `runCPM` een undo-snapshot
      // pusht. Buiten de modus blijft de invariant
      // intact waar `staleGuard.ts` (ensureFreshSchedule) en `batchTool.ts` (recomputeMidBatch) op
      // leunen: "runCPM zet géén isDirty en pusht géén undo-snapshot". Binnen de modus is
      // doorrekenen wél een datawijziging — de opgeslagen datums worden overschreven — en die hoort
      // ongedaan te kunnen.
      //
      // Positie: bovenaan de producer uit hygiëne (de huisconventie "guards; beginUndoable;
      // mutatie"). Op het normale pad maakt het niets uit — `beginUndoable` legt de snapshot vast
      // via `originalAppState(s)`, de pre-producer-basisstaat, dus de plek binnen deze producer
      // verandert de snapshot niet. Op de defensieve `?? s`-terugval in `createSnapshot`
      // (snapshot.ts) leest hij wél de draft, en dán telt de positie alsnog. Laat 'm dus staan.
      //
      // Binnen een MCP- of bulk-transactie zwijgt `beginUndoable`; de transactie nam haar ene
      // snapshot al vóór de eerste mutatie (dus mét de modus aan) en dekt dit mee — zie
      // `runtime/createMcpTransactions.ts` (stap 5) en `batchTool.ts` (recomputeMidBatch).
      //
      // Dit is een BACKSTOP-pad, geen hoofdpad: de datum-rakende mutaties die zélf herrekenen
      // (moveProject, applyLeveling, clearLeveling) verlaten de modus in hun eigen producer, via
      // `finishMutation({ stale: true })`. Zo blijft het bij één undo-stap in plaats van twee, met
      // een tussentoestand die de gebruiker nooit gezien heeft.
      if (s.datesAsRecorded) {
        runtime.beginUndoable(s);
        openedHistory = true;
        s.datesAsRecorded = false;
        s.recordedDates = null;
      }
      s.scheduleStale = false; // F5/Bereken gedraaid — schema is (voor deze taken/relaties) vers.
      // De reken-kern (leaf-filter → solve → terugschrijven/rollup) staat in `solveProject` en
      // draait rechtstreeks op de Immer-draft: `s.tasks` wordt in-place gemuteerd. Dezelfde functie
      // draait het bezettingsoverzicht op een KLOON van de taken van een stale document — één
      // implementatie, geen divergentie. De samenvattings-
      // relatie-propagatie (MS Project-semantiek) zit dáár, zodat elke afnemer van de kern hem krijgt.
      // `solveInputFor` levert de volledige projectinvoer, incl. de projectstart als ondergrens
      // (`rootFloor`) en de opgeloste conventies.
      const result = solveProject(solveInputFor(s.project, s.tasks, s.sequences, s.calendar, s.calendars));

      // If circular dependency detected, store the result (with error) and bail
      if (result.error) {
        s.cpmResult = result;
        s.resourceLoadResult = null;
        if (openedHistory) runtime.finishUndoable(s, { nonEdit: true });
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
      if (openedHistory) runtime.finishUndoable(s, { nonEdit: true });
      else if (refreshPreviousEventAfter) runtime.refreshLatestDocumentDataHistoryAfter(s);
    });

    // Filter/sort kunnen op de zojuist bijgewerkte totalFloat/isCritical/earlyStart keyen.
    get().recomputeViewRows();

    // Een CPM-fout (cyclus, kalender zonder werkdagen, ongeldige startdatum) pusht zichzelf naar
    // het gecentraliseerde meldingenkanaal. Eén controle hier dekt beide uitgangen van deze actie —
    // de cyclus-bail boven én het normale pad — want in beide staat `cpmResult` met de fout. Zo is
    // de fout óók zichtbaar vanuit Backstage/tabel/rapport, waar het canvas niet gemonteerd is.
    const failed = scheduleFailedNotice(get().cpmResult);
    if (failed) get().notify(failed);

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

      // Gedeelde kern: schrijft de vastlegging in de taken en levert meteen het gereconstrueerde
      // `CPMResult` — dezelfde functie die de laadroute (`enterRecordedDatesMode`) op een payload
      // gebruikt.
      s.cpmResult = applyRecordedTimesToTasks(s.tasks, info.times, s.calendar);
      s.resourceLoadResult = computeReliableResourceLoad(
        s.cpmResult, s.resources, s.assignments, s.tasks, s.calendar, s.calendars,
      );
      s.datesAsRecorded = true;
      // De weergave is consistent met wat er getoond wordt — niet verouderd.
      s.scheduleStale = false;
      // Wel history sluiten, maar bewust niet dirty maken: er is niets gewijzigd t.o.v. het bestand.
      // `nonEdit`: undo/redo van deze stap wist "ongewijzigd sinds import" niet.
      runtime.finishUndoable(s, { nonEdit: true });
    });
    get().recomputeViewRows();
  },

  dismissRecordedDates: () => {
    // Géén beginUndoable/finishMutation: dit vuurt alleen in de AANBOD-stand (recordedDates gezet,
    // datesAsRecorded nog false) en raakt geen projectdata (tasks/cpmResult) of `datesAsRecorded`
    // aan — alleen het aanbod zelf verdwijnt. Dat lijkt in te gaan tegen de documentcontract-
    // invariant ("élke mutator van een 'derived'-snapshotveld pusht een snapshot"), maar die
    // invariant bewaakt DATA-consistentie: dat een undo nooit een half-oude/half-nieuwe combinatie
    // van velden kan opleveren. Hier is er geen combinatie om uit elkaar te
    // laten lopen — `recordedDates` bepaalt alleen of de strook een aanbod tóónt, en elke ECHTE
    // mutator (showRecordedDates, runCPM) pusht zijn EIGEN snapshot mét de op-dat-moment geldende
    // waarde van dit veld erin, dus die snapshots blijven intern consistent ongeacht wat dismiss
    // deed. Vergelijk `recomputeResourceLoad`, dat `resourceLoadResult` (rol 'none') ook zonder
    // snapshot muteert — een zuiver afgeleid veld, geen brondata.
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
    const leafTasks = s.tasks.filter(isLeafTask);
    // Zelfde samenvattingsrelatie-propagatie als runCPM (zie daar): `ResourceLeveler` krijgt hier
    // alleen bladtaken door, dus de expansie moet vóór het leaf-filter gebeuren, met de VOLLEDIGE
    // taakboom (parentId/childIds) als bron — `ResourceLeveler` zelf blijft ongewijzigd, die kent
    // de WBS-boom sowieso niet en hoeft dat ook niet te weten.
    const { sequences: expandedSequences } = expandSummaryRelations(s.tasks, s.sequences);
    // Dezelfde solve-opties als `runCPM` hierboven meegeven — zonder `dataDate`/`progressMode`
    // rekent de nivelleerder intern op een pure-ASAP-realiteit
    // die van de echte (actual-gepinde) planning kan afwijken zodra er voortgang+statusdatum is
    // (zie de parameter-toelichting in `ResourceLeveler.ts:levelResources`); zonder de
    // projectstart-vloer kan hij een wortel-taak vóór het projectbegin laten staan.
    return computeLeveling(
      leafTasks, expandedSequences, s.resources, s.assignments, s.calendar, s.calendars, cpm, options,
      // Zelfde invoer als runCPM hierboven (incl. projectstart-vloer) —
      // anders zou de nivelleerder een wortel-taak vóór het projectbegin kunnen laten staan.
      solveOptionsFor(s.project),
    );
  },

  applyLeveling: (write, opts) => {
    // Telt HOEVEEL taken hier hun sub-dag-
    // precisie verliezen, voor de eenmalige-per-document melding hieronder (buiten de producer,
    // zie `notifyTimephasedLoss`-precedent — `notify` roept zelf `set` aan, dus niet genest).
    let roundedCount = 0;
    set((s) => {
      runtime.beginUndoable(s);
      // Scope-behoudend toepassen: de verdeler nivelleert per POOLITEM, dus een delay op een taak
      // buiten de scope is VASTE LAST waarop het voorstel gerekend heeft. De nivelleerder rekent in
      // hele werkdagen, dus de sub-dag-precisie van de VORIGE nivellering vervalt hier bewust —
      // zichtbaar gebruikersverlies, geteld voor de melding hieronder. Zie `writeLevelingResult` in
      // taskDefaults.ts.
      roundedCount = writeLevelingResult(s.tasks, write, opts?.scopeTaskIds);
      // Wél de stale-vlag: dit is een datum-rakende mutatie, en `stale` is het signaal
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
      // De no-op-guard telt ALLE nivelleeruitvoer mee: `levelingDelay`, de sub-dag-precisie
      // (`levelingDelayMinutes`/`levelingDelayElapsed`) en leveling-GATEN — anders wordt een taak
      // met uitsluitend één daarvan stil overgeslagen. Dezelfde `hasLevelingOutput`
      // als de ribbon-enable-check in `ribbonConfig.tsx` en `planner_clear_leveling`.
      if (!s.tasks.some(hasLevelingOutput)) return; // niets te wissen, geen snapshot
      runtime.beginUndoable(s);
      for (const task of s.tasks) {
        if (clearLevelingOutput(task)) roundedCount++;
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
