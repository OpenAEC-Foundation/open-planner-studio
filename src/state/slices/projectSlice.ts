import type { Project, ProgressMode } from '@/types/project';
import { createDefaultCalendar, type WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Baseline } from '@/types/baseline';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import { applyWbsNumbering } from '@/utils/wbs';
import { createSnapshot } from '../snapshot';
import { syncProjectCalendar, promoteProjectCalendarToLibrary } from '../syncProjectCalendar';
import { createDefaultView } from './viewSlice';
import { emitExtensionEvent, HOST_EVENTS } from '@/extensions/eventBus';
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
  setProject: (project: Partial<Project>) => void;
  /** Zet WBS-autonummering aan/uit; bij aanzetten wordt de hele boom direct hernummerd. */
  setWbsAutoNumber: (on: boolean) => void;
  setCalendar: (calendar: WorkCalendar) => void;
  /** Kies een bestaande bibliotheek-kalender (`s.calendars`) als projectdefault (ontwerp §7.1/§9.3).
   *  setCalendar-precedent: isDirty + scheduleStale, GÉÉN undo-snapshot (bewuste asymmetrie —
   *  bibliotheek-CRUD zelf blijft wél undoable). No-op op een onbekende id. */
  setProjectCalendar: (id: string) => void;
  /** Promoveer de huidige gedenormaliseerde projectkalender (`s.calendar`) tot een zichtbare
   *  bibliotheek-entry als die er nog niet in staat (ontwerp §4.3-migratie, lazy variant voor de
   *  kalenderdialoog). Puur additief/niet-destructief — geen undo-snapshot nodig. */
  ensureProjectCalendarInLibrary: () => void;
  /** Statusdatum (P6 data date, fase 2.6). undefined = wissen. setCalendar-patroon: isDirty +
   *  scheduleStale, géén undo-snapshot (zie §10.3). */
  setStatusDate: (date: string | undefined) => void;
  /** Voortgangsmodus (fase 2.6). setCalendar-patroon (isDirty + scheduleStale, géén undo-snapshot). */
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

  setProject: (updates) =>
    set((s) => {
      Object.assign(s.project, updates);
      s.project.modifiedAt = new Date().toISOString();
      s.isDirty = true;
      // Alleen de projectstart raakt de planning (anker van de forward pass); naam/auteur niet (A6).
      if ('startDate' in updates) s.scheduleStale = true;
    }),

  setWbsAutoNumber: (on) =>
    set((s) => {
      if (!!s.project.wbsAutoNumber === on) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.project.wbsAutoNumber = on;
      if (on) applyWbsNumbering(s.tasks);
      s.isDirty = true;
    }),

  setCalendar: (calendar) =>
    set((s) => {
      s.calendar = calendar;
      // Houd de bibliotheek-entry (indien aanwezig) in sync met de gedenormaliseerde cache (§4.1).
      const idx = s.calendars.findIndex((c) => c.id === calendar.id);
      if (idx >= 0) s.calendars[idx] = calendar;
      s.isDirty = true;
      s.scheduleStale = true; // projectkalender-wijziging (A6): planning verouderd tot F5.
    }),

  setProjectCalendar: (id) =>
    set((s) => {
      if (!s.calendars.some((c) => c.id === id)) return; // alleen bestaande bibliotheek-entries
      s.project.calendarId = id;
      s.isDirty = true;
      s.scheduleStale = true; // projectdefault-wissel is datum-beïnvloedend (§5.4).
      syncProjectCalendar(s); // §9.1: cache gelijkzetten (géén undo-snapshot, §9.3).
    }),

  ensureProjectCalendarInLibrary: () =>
    set((s) => {
      promoteProjectCalendarToLibrary(s); // §4.3-migratie, lazy variant (idempotent, geen undo nodig).
    }),

  setStatusDate: (date) =>
    set((s) => {
      if (date) s.project.statusDate = date;
      else delete s.project.statusDate;
      s.project.modifiedAt = new Date().toISOString();
      s.isDirty = true;
      s.scheduleStale = true; // datum-beïnvloedend (A6): planning verouderd tot F5.
    }),

  setProgressMode: (mode) =>
    set((s) => {
      s.project.progressMode = mode;
      s.project.modifiedAt = new Date().toISOString();
      s.isDirty = true;
      s.scheduleStale = true;
    }),

  newProject: () => {
    set((s) => {
      s.project = createDefaultProject();
      s.calendar = createDefaultCalendar();
      s.tasks = [];
      s.sequences = [];
      s.resources = [];
      s.assignments = [];
      s.calendars = [];
      s.activityCodeTypes = [];
      s.customFieldDefs = [];
      s.selectedTaskIds = [];
      s.cpmResult = null;
      // Afgeleide belasting ook resetten (A5); de ribbon-guard van de UX-golf blijft defensief.
      s.resourceLoadResult = null;
      s.scheduleStale = false;
      s.baselines = [];
      s.activeBaselineId = null;
      s.view = createDefaultView();
      s.undoStack = [];
      s.redoStack = [];
      s.isDirty = false;
      s.filePath = null;
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

      s.project = proj;
      s.calendar = opts.calendar;
      s.tasks = opts.phaseNames.map((name, i) => ({
        id: generateId('task'),
        name,
        description: '',
        wbsCode: String(i + 1),
        taskType: 'CONSTRUCTION',
        status: 'NOT_STARTED',
        isMilestone: false,
        priority: 500,
        parentId: null,
        childIds: [],
        time: createDefaultTaskTime(proj.startDate, 5),
        resourceIds: [],
      }));
      s.sequences = [];
      s.resources = [];
      s.assignments = [];
      s.calendars = [];
      s.selectedTaskIds = [];
      s.cpmResult = null;
      s.resourceLoadResult = null;
      s.scheduleStale = false;
      s.baselines = [];
      s.activeBaselineId = null;
      s.view = createDefaultView();
      s.undoStack = [];
      s.redoStack = [];
      // Een leeg project (template 'Leeg') is nog niet 'dirty'; met fasen wél.
      s.isDirty = opts.phaseNames.length > 0;
      s.filePath = null;
    });
    emitExtensionEvent(HOST_EVENTS.projectNew);
  },

  setFilePath: (path) =>
    set((s) => {
      s.filePath = path;
    }),

  loadState: (loaded) => {
    set((s) => {
      s.project = loaded.project;
      s.calendar = loaded.calendar;
      s.tasks = loaded.tasks;
      s.sequences = loaded.sequences;
      s.resources = loaded.resources;
      s.assignments = loaded.assignments;
      // Kalender-bibliotheek (fase 2.8a; readers leveren nog het veld `resourceCalendars`).
      s.calendars = loaded.resourceCalendars ?? [];
      // §4.3-migratie: een bestand zonder bibliotheek-entry voor zijn projectkalender (elk
      // bestand van vóór 2.8a, of van CSV/P6/MSPDI) krijgt hier de eerste entry.
      promoteProjectCalendarToLibrary(s);
      s.activityCodeTypes = loaded.activityCodeTypes ?? [];
      s.customFieldDefs = loaded.customFieldDefs ?? [];
      s.selectedTaskIds = [];
      s.cpmResult = null;
      s.resourceLoadResult = null;
      s.scheduleStale = false;
      // Baselines uit de IFC-lezer (fase 2.6, §8.3); ontbreken ze (CSV/P6 of extern bestand) → leeg.
      s.baselines = loaded.baselines ?? [];
      s.activeBaselineId = loaded.activeBaselineId ?? null;
      s.undoStack = [];
      s.redoStack = [];
      s.isDirty = false;
    });
    emitExtensionEvent(HOST_EVENTS.projectLoaded, {
      tasks: loaded.tasks.length,
      sequences: loaded.sequences.length,
      resources: loaded.resources.length,
    });
  },
});
