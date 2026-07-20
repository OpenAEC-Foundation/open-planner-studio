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
import { formatDate } from '@/utils/dateUtils';
import { applyWbsNumbering } from '@/utils/wbs';
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
