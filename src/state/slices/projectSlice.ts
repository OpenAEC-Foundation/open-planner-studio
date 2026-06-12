import type { Project } from '@/types/project';
import { createDefaultCalendar, type WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import { createDefaultView } from './viewSlice';
import type { AppSlice } from './types';

export interface ProjectSlice {
  project: Project;
  calendar: WorkCalendar;
  isDirty: boolean;
  filePath: string | null;
  setProject: (project: Partial<Project>) => void;
  setCalendar: (calendar: WorkCalendar) => void;
  newProject: () => void;
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
  };
}

export const createProjectSlice: AppSlice<ProjectSlice> = (set) => ({
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

  setCalendar: (calendar) =>
    set((s) => {
      s.calendar = calendar;
      s.isDirty = true;
    }),

  newProject: () =>
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
    }),

  setFilePath: (path) =>
    set((s) => {
      s.filePath = path;
    }),

  loadState: (loaded) =>
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
    }),
});
