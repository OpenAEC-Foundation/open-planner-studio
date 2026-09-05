import type { Project, ProgressMode } from '@/types/project';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { CustomTaskType } from '@/types/taskType';
import type { Baseline } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { diffDays } from '@/utils/dateUtils';
import { applyWbsNumbering } from '@/utils/wbs';
import { CPMSolver, type CPMResult } from '@/engine/scheduler/CPMSolver';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { clampProjectStartAnchors } from '@/engine/scheduler/projectStartAnchorClamp';
import {
  computeMoveDelta, computeMoveImpact, computeHolidayGaps, shiftIso, shiftTask,
  shiftProjectDates, shiftResource, shiftBaseline,
  type MoveProjectOptions, type MoveImpact, type HolidayGapCalendar,
} from '@/engine/moveProject';
import { syncProjectCalendar, promoteProjectCalendarToLibrary } from '../syncProjectCalendar';
import { freshPayload, hydratePayload } from '../documentContract';
import { emitExtensionEvent, HOST_EVENTS } from '@/services/extensionEvents';
import { clearTimephasedLossNoticeForDoc } from '../timephasedLossNotice';
import { clearTaskTypesNoticeForDoc, notifyWorkRuleDurationsChanged } from '../taskTypesNotice';
import { captureTriangle, settleCalendarChange, settleDurationAftermath } from '@/engine/work/workRuleApply';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';
import type { AppSliceFactory } from './types';
import { deriveHoursPerDay } from '@/services/subdayIo';
import { isLeafTask } from '@/utils/taskHierarchy';
import type { XerImportMetadata } from '@/services/importTypes';
import type { XerSourceArchive } from '@/services/xerSourceArchive';
// K-item 27: de fabriek woont in de bladmodule `../defaults` (breekt de import-cyclus met
// documentContract/snapshot). Hier alleen doorgegeven, zodat bestaande importers ongemoeid blijven.
import { createDefaultProject } from '../defaults';
import { removeSessionHistoryForDocumentFromState } from '../sessionHistory';
export { createDefaultProject };

/** Opties voor de nieuw-project-wizard. */
export interface NewProjectOptions {
  name: string;
  description?: string;
  author?: string;
  company?: string;
  startDate: string;
  endDate?: string;
  calendar: WorkCalendar;
  phaseNames: string[];
  defaultTaskDurationUnit?: 'days' | 'hours';
}

/** Uitkomst van een `moveProject`-commit. */
export interface MoveProjectResult {
  /** false bij Δ=0 of een ongeldige huidige/nieuwe startdatum (R8/R9) — er is dan NIETS gemuteerd. */
  moved: boolean;
  deltaDays: number;
  taskCount: number;
}

/** Droogrun-uitkomst van `previewMoveProject` (§7). Muteert per definitie niets. */
export interface MoveProjectPreview {
  /** `NaN` als de huidige of nieuwe startdatum onbruikbaar is (R9). */
  deltaDays: number;
  startBefore: string;
  startAfter: string;
  /** `''` als er geen taken zijn (R3). */
  endBefore: string;
  endAfter: string;
  /** Projectduur in werkdagen (uit `CPMResult.projectDuration`). */
  durationBefore: number;
  durationAfter: number;
  /** Kalenderdagen die het EINDE opschuift. ≠ `deltaDays` ⇒ de kalender heeft ingegrepen
   *  (feestdagen/bouwvak schuiven NIET mee) — dat is het hele bestaansrecht van de preview. */
  endDeltaDays: number;
  impact: MoveImpact;
  /** Kalenders waarvan de GEGENEREERDE feestdagen de nieuwe periode niet dekken (R7). */
  holidayGapCalendars: HolidayGapCalendar[];
  /** Solver-fout in de droogrun (cyclus e.d.) — de UI toont hem en blokkeert Verplaatsen. */
  error?: string;
}

export interface ProjectSlice {
  project: Project;
  calendar: WorkCalendar;
  isDirty: boolean;
  filePath: string | null;
  /** Web-opslaan-doel (spec §4). ALLEEN het FSA-opslaan-doel — nooit voor identiteit/titel;
   *  die blijven bij `filePath` (echt pad in Tauri, bestandsnaam in web). `null` in Tauri/fallback-web. */
  fileHandle: FileSystemFileHandle | null;
  /** Persoonlijke sessiekeuze voor echte bestands-AutoSave; per document via DOCUMENT_FIELDS. */
  autoSaveToFile: boolean;
  /** XER-herkomst van het actieve document; externe relaties blijven solverloze brondata. */
  xerImportMetadata: XerImportMetadata | null;
  xerSourceArchive: XerSourceArchive | null;
  xerSourceProjectId: string | null;
  /** Taaktypes-etappe (spec §7): werkregel-UI ontsloten voor dit document; zie DOCUMENT_FIELDS. */
  taskTypesVisible: boolean;
  setProject: (project: Partial<Project>) => void;
  /** Zet WBS-autonummering aan/uit; bij aanzetten wordt de hele boom direct hernummerd. */
  setWbsAutoNumber: (on: boolean) => void;
  setCalendar: (calendar: WorkCalendar) => void;
  /** Kies een bestaande bibliotheek-kalender (`s.calendars`) als projectdefault (ontwerp §7.1/§9.3).
   *  setCalendar-precedent: undo-snapshot + isDirty + scheduleStale (pakket H). No-op (en dus géén
   *  undo-stap) op een onbekende id of als hij al de projectdefault is. */
  setProjectCalendar: (id: string) => void;
  /** Promoveer de huidige gedenormaliseerde projectkalender (`s.calendar`) tot een zichtbare
   *  bibliotheek-entry als die er nog niet in staat (ontwerp §4.3-migratie, lazy variant voor de
   *  kalenderdialoog). Puur additief/niet-destructief — geen undo-snapshot nodig. */
  ensureProjectCalendarInLibrary: () => void;
  /** Statusdatum (P6 data date, fase 2.6). undefined = wissen. setCalendar-patroon: undo-snapshot +
   *  isDirty + scheduleStale (pakket H); dezelfde waarde opnieuw zetten is een no-op. */
  setStatusDate: (date: string | undefined) => void;
  /** Voortgangsmodus (fase 2.6). setCalendar-patroon (undo-snapshot + isDirty + scheduleStale). */
  setProgressMode: (mode: ProgressMode) => void;
  /**
   * Verschuif de HELE planning zodat het project op `newStartDate` begint (pakket D1).
   *
   * Δ = kalenderdagen tussen de huidige en de nieuwe projectstart. De KALENDERS schuiven bewust
   * NIET mee (feestdagen/bouwvak/winterstop liggen op absolute datums), dus einddatums kunnen met
   * een ánder aantal dagen verspringen dan Δ — `previewMoveProject` maakt dat vooraf zichtbaar.
   *
   * Eén undo-stap (óók in "datums zoals opgeslagen": die modus wordt in dezelfde producer verlaten,
   * niet pas door de aansluitende `runCPM`); draait aansluitend `runCPM` + `requestFitToProject`.
   * Δ=0 of een onbruikbare startdatum ⇒ volledige no-op (géén snapshot, géén isDirty).
   */
  moveProject: (newStartDate: string, opts?: MoveProjectOptions) => MoveProjectResult;
  /** Droogrun van `moveProject`: rekent de verschoven planning volledig door met een verse
   *  `CPMSolver` en geeft het resultaat terug ZONDER de store te muteren (levelResources-precedent). */
  previewMoveProject: (newStartDate: string, opts?: MoveProjectOptions) => MoveProjectPreview;
  newProject: () => void;
  /** Nieuw-project-wizard: maak een project met metadata, kalender en een
   *  fasering-skelet in een eigen tabblad (hergebruikt het actieve tabblad als
   *  dat nog leeg en ongewijzigd is). */
  createNewProject: (opts: NewProjectOptions) => void;
  setFilePath: (path: string | null) => void;
  loadState: (state: {
    project: Project;
    calendar: WorkCalendar;
    tasks: Task[];
    sequences: Sequence[];
    resources: Resource[];
    assignments: ResourceAssignment[];
    resourceCalendars?: WorkCalendar[];
    activityCodeTypes?: ActivityCodeType[];
    customFieldDefs?: CustomFieldDef[];
    customTaskTypes?: CustomTaskType[];
    baselines?: Baseline[];
    activeBaselineId?: string | null;
  }, opts?: { viewStartDate?: string }) => void;
}

/**
 * Structurele gelijkheid voor de no-op-guards hieronder (pakket H). Scalars via `===`, objecten
 * (bv. `schedulingOptions`, een hele `WorkCalendar`) via een JSON-vergelijking — Immer-drafts
 * serialiseren gewoon mee. Sleutelvolgorde telt mee: een gelijke-maar-anders-geordende kopie wordt
 * als "gewijzigd" gezien, wat hooguit één extra undo-stap kost en nooit tot verkeerde state leidt.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Verandert `updates` iets BETEKENISVOLS aan het project? `modifiedAt` telt bewust NIET mee: elke
 * mutator ververst dat veld, dus zonder deze uitzondering zou élke "opslaan" uit de Backstage/
 * projectdialoog — óók met volledig ongewijzigde waarden — een (lege) undo-stap pushen. Zie de kop
 * van `snapshot.ts`: sinds pakket H staat het volledige project in de snapshot, dus deze guard is
 * de tegenhanger die de undo-stack schoon houdt.
 */
function projectChanges(current: Project, updates: Partial<Project>): boolean {
  return (Object.keys(updates) as (keyof Project)[])
    .some((k) => k !== 'modifiedAt' && !sameValue(current[k], updates[k]));
}


export const createProjectSlice: AppSliceFactory<ProjectSlice> = (runtime) => (set, get) => ({
  project: createDefaultProject(),
  calendar: createDefaultCalendar(),
  isDirty: false,
  filePath: null,
  fileHandle: null,
  autoSaveToFile: false,
  xerImportMetadata: null,
  xerSourceArchive: null,
  xerSourceProjectId: null,
  taskTypesVisible: false,

  setProject: (updates) => {
    // T7b (plan-§9/O2-vervolg, orkestratorbesluit 2026-08-15 — optie B, ná escalatie T7 + de
    // review-fixronde H1/H3/L1/L2/M4): telt de wortel-ankers die deze aanroep klemt, buiten de
    // Immer-`set()`-producer om — zelfde precedent als `moveProject` hieronder (een `let out`/
    // teller die de producer vult, waarna de aanroeper ná `set()` op de VOLTOOIDE state reageert;
    // `get().notify(...)`/`get().runCPM()` binnen een actieve producer aanroepen kan niet).
    let clampedAnchors = 0;
    set((s) => {
      // No-op-guard vóór de snapshot (pakket H): een opslag met identieke waarden verandert niets —
      // geen undo-stap, geen `modifiedAt`-bump, geen isDirty.
      if (!projectChanges(s.project, updates)) return;
      runtime.beginUndoable(s);
      const prevStartDate = s.project.startDate;
      Object.assign(s.project, updates);
      s.project.modifiedAt = new Date().toISOString();
      // T7b: de projectstart-vloer verhuisde UIT de solver (CPMSolver is sinds T7 MSP-getrouw — een
      // ingelezen anker wordt nooit meer door de vloer overruled, zie `CPMSolver.ownAnchor`) NAAR
      // HIER, het bewerkmoment. Alléén hier bestaat het intentiesignaal "de gebruiker heeft zojuist
      // zelf de projectstart verzet": in de solver hebben een VEROUDERD in-app-anker (bv. een taak
      // met een start die dateert van vóór deze wijziging) en een aantoonbaar-eerder MS-Project-
      // anker (uit een `.mpp`-import) EXACT dezelfde vorm — wortel-taak, `scheduleStart` vóór
      // `project.startDate`, geen constraint — dus kon de solver ze niet uit elkaar houden
      // (architect-analyse, T7-escalatie). GEEN Δ-verschuiving van de rest van de planning; wie
      // alles wil opschuiven gebruikt `moveProject` ("Project verplaatsen"), dat hierboven al
      // expliciet ELK taakanker meeneemt. Geïmporteerde bestanden raken dit pad NIET: `loadState`/
      // `applyLoadedProject` (fileSlice.ts) lopen nooit door `setProject` — ze hydrateren de
      // payload rechtstreeks via het documentcontract — dus importgetrouwheid (T7) en deze
      // bewerkbescherming staan volledig los van elkaar, precies de scheiding die het
      // orkestratorbesluit vroeg. De klem-mechaniek zelf (snap/scheduleFinish/constraint-check/
      // hammock-skip) is UITBESTEED aan `clampProjectStartAnchors` (`engine/scheduler/
      // projectStartAnchorClamp.ts`) — gedeeld met `mcpTransaction.ts`'s `draft.setProject` zodat
      // de UI en de AI-assistent zich identiek gedragen (T7-review H1).
      if ('startDate' in updates && typeof updates.startDate === 'string') {
        clampedAnchors = clampProjectStartAnchors({
          tasks: s.tasks, sequences: s.sequences, calendar: s.calendar, calendars: s.calendars,
          prevStartDate, nextStartDate: updates.startDate,
        });
      }
      // Alleen de projectstart raakt de planning (anker van de forward pass); naam/auteur niet (A6).
      runtime.finishMutation(s, { stale: 'startDate' in updates });
    });
    if (clampedAnchors > 0) {
      // H3c: ná een DAADWERKELIJKE klem meteen herberekenen — anders is de melding ("meegeschoven")
      // op het moment dat hij verschijnt nog niet waar (de taken staan dan wel op hun nieuwe anker,
      // maar early/late-datums en het kritieke pad zijn nog niet bijgewerkt). Buiten `setProject`'s
      // gebruikelijke "scheduling is handmatig"-regel (CLAUDE.md) — bewust smal: alleen wanneer er
      // écht iets geklemd is, niet bij elke `setProject`-aanroep.
      get().runCPM();
      get().notify({
        severity: 'info',
        messageKey: 'notifications.projectStartAnchorsClamped',
        params: { count: clampedAnchors },
        dedupeKey: 'project-start-anchors-clamped',
      });
    }
  },

  setWbsAutoNumber: (on) =>
    set((s) => {
      if (!!s.project.wbsAutoNumber === on) return;
      runtime.beginUndoable(s);
      s.project.wbsAutoNumber = on;
      if (on) applyWbsNumbering(s.tasks);
      runtime.finishMutation(s); // WBS-nummering raakt geen datums: géén scheduleStale (bewuste asymmetrie).
    }),

  setCalendar: (calendar) =>
    set((s) => {
      // Houd de bibliotheek-entry (indien aanwezig) in sync met de gedenormaliseerde cache (§4.1).
      const idx = s.calendars.findIndex((c) => c.id === calendar.id);
      // No-op-guard vóór de snapshot (pakket H): identieke kalender (cache én bibliotheek-entry) ⇒
      // niets te doen. Anders zou een dialoog-commit zonder wijziging een lege undo-stap pushen.
      if (sameValue(s.calendar, calendar) && (idx < 0 || sameValue(s.calendars[idx], calendar))) return;
      runtime.beginUndoable(s);
      s.calendar = calendar;
      if (idx >= 0) s.calendars[idx] = calendar;
      runtime.finishMutation(s, { stale: true }); // projectkalender-wijziging (A6): planning verouderd tot F5.
    }),

  setProjectCalendar: (id) => {
    let changed = 0;
    set((s) => {
      if (!s.calendars.some((c) => c.id === id)) return; // alleen bestaande bibliotheek-entries
      if (s.project.calendarId === id) return; // no-op-guard: al de projectdefault (geen lege undo-stap).
      runtime.beginUndoable(s);
      // K2 (eigenaarsbesluit 2026-09-05): alle taken zónder eigen kalender volgen de projectkalender;
      // momentopnamen vóór de wissel, daarna beslist de werkregel per taak.
      const affected = s.tasks.filter((t) => t.calendarId === undefined).map((task) => ({ task, before: captureTriangle(task, s.assignments, s), oldDays: task.time.scheduleDuration }));
      s.project.calendarId = id;
      syncProjectCalendar(s); // §9.1: cache gelijkzetten (vóór de settle: die leest `s.calendar`).
      for (const { task, before, oldDays } of affected) {
        if (settleCalendarChange(task, s.assignments, before, s).durationChanged) {
          settleDurationAftermath(task, s, oldDays * taskCalendarHoursPerDay(task, s.calendars, s.calendar) * 60);
          changed++;
        }
      }
      runtime.finishMutation(s, { stale: true }); // projectdefault-wissel is datum-beïnvloedend (§5.4).
    });
    if (changed > 0) notifyWorkRuleDurationsChanged(get().notify, get().activeDocumentId, changed);
  },

  ensureProjectCalendarInLibrary: () =>
    set((s) => {
      promoteProjectCalendarToLibrary(s); // §4.3-migratie, lazy variant (idempotent, geen undo nodig).
    }),

  setStatusDate: (date) =>
    set((s) => {
      const next = date || undefined; // '' telt als wissen — zelfde effect als undefined
      if (s.project.statusDate === next) return; // no-op-guard vóór de snapshot (pakket H)
      // Coalescing (pakket H): het statusdatumveld in het lint is een `DateTextInput`. Die commit
      // sinds de `commitMode`-fix standaard pas bij het AFRONDEN (blur/Enter), dus één ingetypte
      // datum = één commit; deze key is daarmee geen noodzaak meer maar wél het vangnet dat blijft
      // gelden voor reeksen die tóch snel achter elkaar committen (plakken, corrigeren, pijltjes).
      // Zonder key zou elke commit een eigen undo-stap met onzin-tussenwaarde zijn (zie
      // `beginUndoable` en `tests/planning/check-date-input-commit.ts`).
      runtime.beginUndoable(s, { coalesceKey: 'project.statusDate' });
      if (next) s.project.statusDate = next;
      else delete s.project.statusDate;
      s.project.modifiedAt = new Date().toISOString();
      runtime.finishMutation(s, { stale: true }); // datum-beïnvloedend (A6): planning verouderd tot F5.
    }),

  setProgressMode: (mode) =>
    set((s) => {
      if (s.project.progressMode === mode) return; // no-op-guard vóór de snapshot (pakket H)
      runtime.beginUndoable(s);
      s.project.progressMode = mode;
      s.project.modifiedAt = new Date().toISOString();
      runtime.finishMutation(s, { stale: true });
    }),

  moveProject: (newStartDate, opts) => {
    let out: MoveProjectResult = { moved: false, deltaDays: 0, taskCount: 0 };
    set((s) => {
      const delta = computeMoveDelta(s.project.startDate, newStartDate);
      // R8/R9 — guard vóór `beginUndoable`, zodat een no-op de undo-stack niet vervuilt.
      if (!Number.isFinite(delta) || delta === 0) return;
      runtime.beginUndoable(s);
      s.project = shiftProjectDates(s.project, delta);
      // Exact de gekozen datum, niet via Δ: voorkomt drift als `project.startDate` een datetime was.
      s.project.startDate = newStartDate;
      s.project.modifiedAt = new Date().toISOString();
      // Élk taakanker moet mee: sinds T7 is `project.startDate` GEEN ondergrens meer voor een
      // wortel-taak-eigen ES in de solver (`CPMSolver.ownAnchor` is ongeklemd — de vloer geldt nu
      // uitsluitend nog als ondergrens tegen relatie-leads voor taken MET voorganger). De T7b-
      // bewerkbescherming in `setProject` hierboven (`clampProjectStartAnchors`) grijpt hier niet
      // in — `moveProject` roept `setProject` niet aan. Een Δ-verschuiving die ALLEEN
      // `project.startDate` verzet zou dus GEEN ENKEL taakanker meeschuiven, vooruit noch terug.
      // Een "project verplaatsen" moet het HELE project Δ dagen opschuiven; alle ankers (taken,
      // resources, evt. baselines) moeten dus expliciet mee.
      s.tasks = s.tasks.map((t) => shiftTask(t, delta));
      s.resources = s.resources.map((r) => shiftResource(r, delta));
      // Default UIT (§1.6): een baseline bestaat om afwijking te meten; meeschuiven wist het signaal.
      if (opts?.shiftBaselines) s.baselines = s.baselines.map((b) => shiftBaseline(b, delta));
      // WÉL { stale: true } (issue #63, review taak 6). Dit is een datum-rakende mutatie — daar
      // hoort de vlag bij, en `stale` is precies het signaal waarop `finishMutation` de modus
      // "datums zoals opgeslagen" verlaat. Zonder dit deed de `runCPM` hieronder dat, in een EIGEN
      // producer met een EIGEN snapshot: twee undo-stappen voor één verschuiving, met daartussen een
      // tussentoestand (nieuwe projectstart, opgeslagen taakdatums, oude reconstructie) die de
      // gebruiker nooit gezien heeft. Nu verlaat de modus in dezelfde producer die de snapshot al
      // nam ⇒ één undo-stap. De vlag zelf is een non-issue: de `runCPM` hieronder wist hem meteen
      // weer (het is de eerste regel van die actie), dus de "verouderd"-hint knippert niet.
      runtime.finishMutation(s, { stale: true });
      out = { moved: true, deltaDays: delta, taskCount: s.tasks.length };
    });
    if (out.moved) {
      get().runCPM();
      // §1.8: "toon het verplaatste project" — één definitie van in-beeld (computeFitToProject),
      // niet een tweede die view.viewStartDate met Δ zou schuiven (fout zodra het einde verspringt).
      get().requestFitToProject();
    }
    return out;
  },

  previewMoveProject: (newStartDate, opts) => {
    const s = get();
    const delta = computeMoveDelta(s.project.startDate, newStartDate);
    const impact = computeMoveImpact(
      s.tasks, s.resources,
      // `baselineCount` telt wat er MEE gaat schuiven, niet hoeveel baselines er zijn: staat de
      // checkbox uit (de default), dan blijven ze staan en is het er nul (§1.6).
      opts?.shiftBaselines ? s.baselines : [],
      s.customFieldDefs,
    );
    const empty: MoveProjectPreview = {
      deltaDays: delta,
      startBefore: s.project.startDate, startAfter: newStartDate,
      endBefore: '', endAfter: '',
      durationBefore: 0, durationAfter: 0, endDeltaDays: 0,
      impact, holidayGapCalendars: [],
    };
    if (!Number.isFinite(delta)) return empty;

    // Droogrun met een VERSE solver (§7.1): een goedkope schatting kan per definitie alleen
    // "oude einddatum + Δ" opleveren, en dát is precies het antwoord dat fout is.
    // LET OP: `CPMSolver` schrijft in de hammock-tak op de meegegeven task-objecten terug. Beide
    // takken hieronder krijgen daarom KOPIEËN uit `shiftTask` (dat `time` altijd kloont) — nooit de
    // store-objecten zelf. Zonder die kopie zou een "preview" de store muteren.
    // Samenvattingsrelatie-propagatie (zie `scheduleSlice.runCPM`): de WBS-boom (parentId/childIds)
    // wijzigt niet tussen de "voor"- en "na"-solve hieronder (alleen datums schuiven), dus één
    // expansie op `s.tasks` volstaat voor beide takken.
    const { sequences: expandedSequences } = expandSummaryRelations(s.tasks, s.sequences);
    const solve = (
      tasks: Task[], dataDate: string | undefined, projectStartDate: string, projectEndDate: string,
    ): CPMResult => {
      const leaf = tasks.filter(isLeafTask);
      return new CPMSolver(leaf, expandedSequences, s.calendar, s.calendars, {
        dataDate,
        progressMode: s.project.progressMode,
        schedulingOptions: s.project.schedulingOptions,
        // Gebruikstest-bevinding 2026-08 (zie `scheduleSlice.runCPM`): de "voor"-solve rekent tegen
        // de HUIDIGE projectstart, de "na"-solve tegen de NIEUWE — anders zou deze preview een
        // wortel-taak vóór zijn eigen projectbegin kunnen tonen.
        projectStartDate,
        projectEndDate,
      }).solve();
    };

    // "Voor" uit de bestaande run als die vers is; anders een tweede solve op de ONGEWIJZIGDE taken,
    // zodat voor en na gegarandeerd met dezelfde motor en opties gemeten zijn.
    // R3 — een project ZONDER taken heeft geen projecteinde. Dat wordt sinds pakket P bij de BRON
    // gegarandeerd (`scheduleAnalysis`: nul early-resultaten ⇒ `projectEnd: ''`, `projectDuration: 0`;
    // vroeger lekte daar de epoch `1970-01-01` uit), en `previewMoveProject` kent geen andere bron
    // voor `projectEnd` dan `solve()` — ook de `fresh`-tak leest een eerder solve-resultaat.
    // Deze afkorting blijft staan om twee redenen, GEEN van beide de epoch:
    //   1) hij slaat twee zinloze solves over op een lege takenlijst;
    //   2) hij pint `endDeltaDays` op 0 i.p.v. de Δ die de algemene tak zou invullen — er ís geen
    //      einddatum, dus "het einde schuift Δ dagen op" is een uitspraak over niets.
    // Verder is hij resultaat-identiek aan de algemene tak (leeg einde, duur 0, dezelfde
    // feestdagenspanne). Zie tests/planning move-07 en edge-empty-project-01.
    if (s.tasks.length === 0) {
      return {
        ...empty,
        holidayGapCalendars: computeHolidayGaps(
          [s.calendar, ...s.calendars],
          newStartDate,
          shiftIso(s.project.endDate, delta) || newStartDate,
        ),
      };
    }

    const fresh = s.cpmResult && !s.cpmResult.error && !s.scheduleStale ? s.cpmResult : null;
    const before = fresh ?? solve(
      s.tasks.map((t) => shiftTask(t, 0)), s.project.statusDate, s.project.startDate, s.project.endDate,
    );
    const after = solve(
      s.tasks.map((t) => shiftTask(t, delta)),
      shiftIso(s.project.statusDate, delta),
      newStartDate,
      shiftIso(s.project.endDate, delta) || s.project.endDate,
    );

    if (after.error) return { ...empty, error: after.error };

    const endBefore = before.error ? '' : before.projectEnd;
    const endAfter = after.projectEnd;
    // R2/besluit 2: wijkt dit af van `deltaDays`, dan heeft de kalender ingegrepen.
    const endDeltaDays = endBefore && endAfter ? diffDays(endBefore, endAfter) : delta;

    return {
      ...empty,
      endBefore, endAfter,
      durationBefore: before.error ? 0 : before.projectDuration,
      durationAfter: after.projectDuration,
      endDeltaDays: Number.isFinite(endDeltaDays) ? endDeltaDays : delta,
      // R7: dekt de gematerialiseerde feestdagenspanne de NIEUWE projectperiode nog? De
      // projectkalender-cache én de hele bibliotheek meenemen (dedupe op id gebeurt in de helper).
      holidayGapCalendars: computeHolidayGaps(
        [s.calendar, ...s.calendars],
        newStartDate,
        endAfter || shiftIso(s.project.endDate, delta) || newStartDate,
      ),
    };
  },

  newProject: () => {
    // Reset-pad (audit P10): één verse payload via het documentcontract i.p.v. een handmatig
    // veld-voor-veld-blok — capture/hydrate/fresh delen dezelfde `DOCUMENT_FIELDS`-lijst, dus een
    // nieuw per-document veld wordt hier automatisch mee-gereset (geen stille lek van het vorige
    // project). hydratePayload promoveert + synct de projectkalender (§4.3/§9.1).
    set((s) => {
      removeSessionHistoryForDocumentFromState(s, s.activeDocumentId);
      hydratePayload(s, freshPayload());
      // Zelfde reset als newDocument()/closeDocument() in documentSlice.ts (critreview taak 12):
      // showLibraryLinkDialog/libraryRefreshNotice zijn APP-globaal en worden door hydratePayload
      // NIET aangeraakt (het zijn geen DOCUMENT_FIELDS). Zonder deze reset kan een openstaande vlag
      // van het vorige project blijven staan, en LibraryLinkDialog rendert onvoorwaardelijk zodra
      // hij waar is — op een net gestart, ongebonden project levert dat een leeg koppel-/
      // afwijkingenscherm op dat nergens bij hoort.
      s.ui.showLibraryLinkDialog = false;
      s.ui.libraryRefreshNotice = null;
      // P1-fix (spec-review op 3fba671b) — `newProject()` hergebruikt het actieve docId voor een
      // compleet vers document; zonder deze reset erft dat verse document de "al gemeld"-registratie
      // van het VORIGE project en zou dus nooit meer melden. Zie `timephasedLossNotice.ts`'s
      // `clearTimephasedLossNoticeForDoc` voor de volledige toelichting (incl. waarom dit NIET ook
      // vanuit `newDocument()`/een echte bestandsopen hoort te gebeuren).
      clearTimephasedLossNoticeForDoc(s.activeDocumentId);
      clearTaskTypesNoticeForDoc(s.activeDocumentId); // taaktypes-etappe, review K1
    });
    emitExtensionEvent(HOST_EVENTS.projectNew);
  },

  createNewProject: (opts) => {
    // Hergebruik het actieve tabblad als dat nog leeg/ongewijzigd is, anders nieuw tabblad.
    const st = get();
    const pristine =
      st.tasks.length === 0 && st.sequences.length === 0 && st.resources.length === 0 &&
      st.filePath === null && !st.isDirty;
    if (!pristine) get().newDocument();

    set((s) => {
      removeSessionHistoryForDocumentFromState(s, s.activeDocumentId);
      const proj = createDefaultProject();
      proj.name = opts.name.trim() || proj.name;
      proj.description = opts.description ?? '';
      proj.author = opts.author ?? '';
      proj.company = opts.company ?? '';
      proj.startDate = opts.startDate || proj.startDate;
      proj.endDate = opts.endDate ?? '';
      proj.calendarId = opts.calendar.id;
      proj.defaultTaskDurationUnit = opts.defaultTaskDurationUnit ?? 'days';

      // Reset-pad (audit P10): start van een verse payload en override alleen de wizard-velden.
      // hydratePayload vult §4.4 de bibliotheek met de wizard-kalender (promote) en synct de cache.
      const payload = freshPayload();
      payload.project = proj;
      payload.calendar = opts.calendar;
      const phaseHoursPerDay = opts.calendar.workTime
        ? deriveHoursPerDay(opts.calendar.workTime, opts.calendar.hoursPerDay)
        : opts.calendar.hoursPerDay;
      payload.tasks = opts.phaseNames.map((name, i) => {
        const time = createDefaultTaskTime(proj.startDate, 5, proj.defaultTaskDurationUnit);
        if (time.durationUnit === 'hours') {
          time.scheduleDuration = phaseHoursPerDay > 0
            ? (time.durationMinutes ?? 0) / (phaseHoursPerDay * 60)
            : 0;
        }
        return {
          id: generateId('task'),
          name,
          description: '',
          wbsCode: String(i + 1),
          // Bouwmodus (2026-07-13): wizard-fasen krijgen in bouw-agnostische modus een neutraal
          // taaktype (USERDEFINED) i.p.v. CONSTRUCTION.
          taskType: s.ui.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED',
          status: 'NOT_STARTED' as const,
          isMilestone: false,
          priority: 500,
          parentId: null,
          childIds: [],
          time,
          resourceIds: [],
        };
      });
      // Een leeg project (template 'Leeg') is nog niet 'dirty'; met fasen wél.
      payload.isDirty = opts.phaseNames.length > 0;
      hydratePayload(s, payload);
      // Zelfde reset als newProject()/newDocument() hierboven: bij het PRISTINE-hergebruikpad
      // (geen newDocument()-aanroep, dus geen reset onderweg) kan een openstaande
      // showLibraryLinkDialog/libraryRefreshNotice van vóór deze wizard blijven hangen. Onvoorwaardelijk
      // hier zetten is een no-op op het niet-pristine pad (newDocument() heeft al gereset).
      s.ui.showLibraryLinkDialog = false;
      s.ui.libraryRefreshNotice = null;
      // P1-fix (spec-review op 3fba671b), zelfde reden als newProject() hierboven: op het PRISTINE-
      // hergebruikpad blijft het docId hetzelfde, dus zonder deze reset erft de wizard-uitkomst de
      // "al gemeld"-registratie van het vorige (lege) tabblad-verleden. Onvoorwaardelijk zetten is
      // een no-op op het niet-pristine pad (newDocument() gaf daar al een vers, ongeregistreerd docId).
      clearTimephasedLossNoticeForDoc(s.activeDocumentId);
      clearTaskTypesNoticeForDoc(s.activeDocumentId); // taaktypes-etappe, review K1
    });
    emitExtensionEvent(HOST_EVENTS.projectNew);
  },

  setFilePath: (path) =>
    set((s) => {
      s.filePath = path;
    }),

  loadState: (loaded, opts) => {
    // Dunne wrapper over de gedeelde load-implementatie (audit P5/F6): `applyLoadedProject` in
    // fileSlice. loadState-semantiek = in-place vervangen — GEEN nieuw tabblad/fit, `filePath`
    // ongemoeid (opt weggelaten). De berekening gebeurt vóór dezelfde ene publicatie.
    get().applyLoadedProject(loaded, {
      recompute: true,
      fit: false,
      hourDataNotice: false,
      viewStartDate: opts?.viewStartDate,
    });
  },
});
