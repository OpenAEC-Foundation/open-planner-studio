import type { Project, ProgressMode } from '@/types/project';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Baseline } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { formatDate, diffDays } from '@/utils/dateUtils';
import { applyWbsNumbering } from '@/utils/wbs';
import { CPMSolver, type CPMResult } from '@/engine/scheduler/CPMSolver';
import {
  computeMoveDelta, computeMoveImpact, computeHolidayGaps, shiftIso, shiftTask,
  shiftProjectDates, shiftResource, shiftBaseline,
  type MoveProjectOptions, type MoveImpact, type HolidayGapCalendar,
} from '@/engine/moveProject';
import { beginUndoable, finishMutation } from '../transaction';
import { syncProjectCalendar, promoteProjectCalendarToLibrary } from '../syncProjectCalendar';
import { freshPayload, hydratePayload } from '../documentContract';
import { emitExtensionEvent, HOST_EVENTS } from '@/services/extensionEvents';
import type { AppSlice } from './types';

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
   * Eén undo-stap; draait aansluitend `runCPM` + `requestFitToProject`. Δ=0 of een onbruikbare
   * startdatum ⇒ volledige no-op (géén snapshot, géén isDirty).
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
    baselines?: Baseline[];
    activeBaselineId?: string | null;
  }) => void;
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

export function createDefaultProject(): Project {
  return {
    id: generateId('proj'),
    name: 'Nieuw Project',
    description: '',
    startDate: formatDate(new Date()),
    endDate: '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
    // Nieuwe projecten nummeren de WBS automatisch; geladen bestanden zonder
    // vlag blijven op vrije tekst (zie Project.wbsAutoNumber).
    wbsAutoNumber: true,
  };
}

export const createProjectSlice: AppSlice<ProjectSlice> = (set, get) => ({
  project: createDefaultProject(),
  calendar: createDefaultCalendar(),
  isDirty: false,
  filePath: null,
  fileHandle: null,

  setProject: (updates) =>
    set((s) => {
      // No-op-guard vóór de snapshot (pakket H): een opslag met identieke waarden verandert niets —
      // geen undo-stap, geen `modifiedAt`-bump, geen isDirty.
      if (!projectChanges(s.project, updates)) return;
      beginUndoable(s);
      Object.assign(s.project, updates);
      s.project.modifiedAt = new Date().toISOString();
      // Alleen de projectstart raakt de planning (anker van de forward pass); naam/auteur niet (A6).
      finishMutation(s, { stale: 'startDate' in updates });
    }),

  setWbsAutoNumber: (on) =>
    set((s) => {
      if (!!s.project.wbsAutoNumber === on) return;
      beginUndoable(s);
      s.project.wbsAutoNumber = on;
      if (on) applyWbsNumbering(s.tasks);
      finishMutation(s); // WBS-nummering raakt geen datums: géén scheduleStale (bewuste asymmetrie).
    }),

  setCalendar: (calendar) =>
    set((s) => {
      // Houd de bibliotheek-entry (indien aanwezig) in sync met de gedenormaliseerde cache (§4.1).
      const idx = s.calendars.findIndex((c) => c.id === calendar.id);
      // No-op-guard vóór de snapshot (pakket H): identieke kalender (cache én bibliotheek-entry) ⇒
      // niets te doen. Anders zou een dialoog-commit zonder wijziging een lege undo-stap pushen.
      if (sameValue(s.calendar, calendar) && (idx < 0 || sameValue(s.calendars[idx], calendar))) return;
      beginUndoable(s);
      s.calendar = calendar;
      if (idx >= 0) s.calendars[idx] = calendar;
      finishMutation(s, { stale: true }); // projectkalender-wijziging (A6): planning verouderd tot F5.
    }),

  setProjectCalendar: (id) =>
    set((s) => {
      if (!s.calendars.some((c) => c.id === id)) return; // alleen bestaande bibliotheek-entries
      if (s.project.calendarId === id) return; // no-op-guard: al de projectdefault (geen lege undo-stap).
      beginUndoable(s);
      s.project.calendarId = id;
      finishMutation(s, { stale: true }); // projectdefault-wissel is datum-beïnvloedend (§5.4).
      syncProjectCalendar(s); // §9.1: cache gelijkzetten.
    }),

  ensureProjectCalendarInLibrary: () =>
    set((s) => {
      promoteProjectCalendarToLibrary(s); // §4.3-migratie, lazy variant (idempotent, geen undo nodig).
    }),

  setStatusDate: (date) =>
    set((s) => {
      const next = date || undefined; // '' telt als wissen — zelfde effect als undefined
      if (s.project.statusDate === next) return; // no-op-guard vóór de snapshot (pakket H)
      // Coalescing (pakket H): het statusdatumveld in het lint is een `DateTextInput` die LIVE per
      // toetsaanslag committeert — één ingetypte datum levert meerdere geldige commits op (zie
      // `beginUndoable`). Zonder key zouden dat evenzoveel undo-stappen met onzin-tussenwaarden zijn.
      beginUndoable(s, { coalesceKey: 'project.statusDate' });
      if (next) s.project.statusDate = next;
      else delete s.project.statusDate;
      s.project.modifiedAt = new Date().toISOString();
      finishMutation(s, { stale: true }); // datum-beïnvloedend (A6): planning verouderd tot F5.
    }),

  setProgressMode: (mode) =>
    set((s) => {
      if (s.project.progressMode === mode) return; // no-op-guard vóór de snapshot (pakket H)
      beginUndoable(s);
      s.project.progressMode = mode;
      s.project.modifiedAt = new Date().toISOString();
      finishMutation(s, { stale: true });
    }),

  moveProject: (newStartDate, opts) => {
    let out: MoveProjectResult = { moved: false, deltaDays: 0, taskCount: 0 };
    set((s) => {
      const delta = computeMoveDelta(s.project.startDate, newStartDate);
      // R8/R9 — guard vóór `beginUndoable`, zodat een no-op de undo-stack niet vervuilt.
      if (!Number.isFinite(delta) || delta === 0) return;
      beginUndoable(s);
      s.project = shiftProjectDates(s.project, delta);
      // Exact de gekozen datum, niet via Δ: voorkomt drift als `project.startDate` een datetime was.
      s.project.startDate = newStartDate;
      s.project.modifiedAt = new Date().toISOString();
      // Élk taakanker moet mee — `project.startDate` alleen zetten doet NIETS aan de planning,
      // want de forward pass leidt de projectstart af uit `time.scheduleStart`.
      s.tasks = s.tasks.map((t) => shiftTask(t, delta));
      s.resources = s.resources.map((r) => shiftResource(r, delta));
      // Default UIT (§1.6): een baseline bestaat om afwijking te meten; meeschuiven wist het signaal.
      if (opts?.shiftBaselines) s.baselines = s.baselines.map((b) => shiftBaseline(b, delta));
      // GEEN { stale: true }: de runCPM hieronder wist `scheduleStale` zelf (applyLeveling-precedent).
      finishMutation(s);
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
    const solve = (tasks: Task[], dataDate: string | undefined): CPMResult => {
      const leaf = tasks.filter((t) => t.childIds.length === 0);
      return new CPMSolver(leaf, s.sequences, s.calendar, s.calendars, {
        dataDate,
        progressMode: s.project.progressMode,
        schedulingOptions: s.project.schedulingOptions,
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
    const before = fresh ?? solve(s.tasks.map((t) => shiftTask(t, 0)), s.project.statusDate);
    const after = solve(
      s.tasks.map((t) => shiftTask(t, delta)),
      shiftIso(s.project.statusDate, delta),
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
      hydratePayload(s, freshPayload());
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
      const proj = createDefaultProject();
      proj.name = opts.name.trim() || proj.name;
      proj.description = opts.description ?? '';
      proj.author = opts.author ?? '';
      proj.company = opts.company ?? '';
      proj.startDate = opts.startDate || proj.startDate;
      proj.endDate = opts.endDate ?? '';
      proj.calendarId = opts.calendar.id;

      // Reset-pad (audit P10): start van een verse payload en override alleen de wizard-velden.
      // hydratePayload vult §4.4 de bibliotheek met de wizard-kalender (promote) en synct de cache.
      const payload = freshPayload();
      payload.project = proj;
      payload.calendar = opts.calendar;
      payload.tasks = opts.phaseNames.map((name, i) => ({
        id: generateId('task'),
        name,
        description: '',
        wbsCode: String(i + 1),
        // Bouwmodus (2026-07-13): wizard-fasen krijgen in bouw-agnostische modus een neutraal
        // taaktype (USERDEFINED) i.p.v. CONSTRUCTION.
        taskType: s.ui.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED',
        status: 'NOT_STARTED',
        isMilestone: false,
        priority: 500,
        parentId: null,
        childIds: [],
        time: createDefaultTaskTime(proj.startDate, 5),
        resourceIds: [],
      }));
      // Een leeg project (template 'Leeg') is nog niet 'dirty'; met fasen wél.
      payload.isDirty = opts.phaseNames.length > 0;
      hydratePayload(s, payload);
    });
    emitExtensionEvent(HOST_EVENTS.projectNew);
  },

  setFilePath: (path) =>
    set((s) => {
      s.filePath = path;
    }),

  loadState: (loaded) => {
    // Dunne wrapper over de gedeelde load-implementatie (audit P5/F6): `applyLoadedProject` in
    // fileSlice. loadState-semantiek = in-place vervangen — GEEN nieuw tabblad, GEEN runCPM/fit,
    // `filePath` ongemoeid (opt weggelaten). De externe callers blijven ongewijzigd.
    get().applyLoadedProject(loaded, {
      recompute: false,
      fit: false,
      hourDataNotice: false,
    });
  },
});
