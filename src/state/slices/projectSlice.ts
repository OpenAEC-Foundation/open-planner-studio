import type { Project } from '@/types/project';
import { createDefaultCalendar, type WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import { applyWbsNumbering } from '@/utils/wbs';
import { createSnapshot } from '../snapshot';
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
      s.isDirty = true;
    }),

  newProject: () => {
    set((s) => {
      s.project = createDefaultProject();
      s.calendar = createDefaultCalendar();
      s.tasks = [];
      s.sequences = [];
      s.resources = [];
      s.assignments = [];
      s.selectedTaskIds = [];
      s.cpmResult = null;
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
        priority: 0,
        parentId: null,
        childIds: [],
        time: createDefaultTaskTime(proj.startDate, 5),
        resourceIds: [],
      }));
      s.sequences = [];
      s.resources = [];
      s.assignments = [];
      s.selectedTaskIds = [];
      s.cpmResult = null;
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
      s.selectedTaskIds = [];
      s.cpmResult = null;
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
