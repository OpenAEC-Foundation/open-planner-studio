import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { Task, createDefaultTaskTime } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar, createDefaultCalendar } from '@/types/calendar';
import { ViewState, UIState, TimeScale } from './slices/types';
import { CPMSolver, CPMResult } from '@/engine/scheduler/CPMSolver';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeCSV } from '@/services/csv/csvWriter';
import { readCSV } from '@/services/csv/csvReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
const isTauri = () => '__TAURI_INTERNALS__' in window;

export type ExportFormat = 'ifc' | 'csv' | 'mspdi' | 'p6';

enableMapSet();

// ---- Recent files ----
const RECENT_FILES_KEY = 'open-planner-studio-recent-files';
const MAX_RECENT_FILES = 10;

function getRecentFiles(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentFile(filePath: string): void {
  const recent = getRecentFiles().filter(f => f !== filePath);
  recent.unshift(filePath);
  if (recent.length > MAX_RECENT_FILES) recent.length = MAX_RECENT_FILES;
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recent));
}

// ---- Undo/Redo snapshot ----
interface Snapshot {
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
}

// ---- Store State ----
export interface AppState {
  // Data
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  selectedTaskIds: string[];

  // CPM
  cpmResult: CPMResult | null;

  // View
  view: ViewState;
  ui: UIState;

  // Undo/Redo
  undoStack: Snapshot[];
  redoStack: Snapshot[];

  // Dirty flag
  isDirty: boolean;
  filePath: string | null;

  // Actions: Project
  setProject: (project: Partial<Project>) => void;
  setCalendar: (calendar: WorkCalendar) => void;
  newProject: () => void;
  setFilePath: (path: string | null) => void;

  // Actions: Tasks
  addTask: (task: Partial<Task> & { name: string }) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newParentId: string | null) => void;

  // Actions: Sequences
  addSequence: (seq: Omit<Sequence, 'id'>) => string;
  removeSequence: (id: string) => void;

  // Actions: Resources
  addResource: (res: Omit<Resource, 'id'>) => string;
  removeResource: (id: string) => void;
  assignResource: (taskId: string, resourceId: string, units: number) => void;
  unassignResource: (assignmentId: string) => void;

  // Actions: Selection
  selectTask: (id: string, multi?: boolean, range?: boolean) => void;
  selectTaskRange: (fromId: string, toId: string) => void;
  deselectAll: () => void;

  // Actions: CPM
  runCPM: () => void;

  // Actions: View
  setZoom: (zoom: number) => void;
  setTimeScale: (scale: TimeScale) => void;
  setScroll: (x: number, y: number) => void;
  setViewStartDate: (date: string) => void;

  // Actions: UI
  setUI: (updates: Partial<UIState>) => void;

  // Actions: Collapse/expand summary tasks
  toggleCollapse: (taskId: string) => void;

  // Actions: Undo/Redo
  undo: () => void;
  redo: () => void;

  // Actions: Load state (for IFC import)
  loadState: (state: {
    project: Project;
    calendar: WorkCalendar;
    tasks: Task[];
    sequences: Sequence[];
    resources: Resource[];
    assignments: ResourceAssignment[];
  }) => void;

  // Actions: File operations
  openFile: () => Promise<void>;
  saveFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  exportAs: (format: ExportFormat) => Promise<void>;
  getRecentFiles: () => string[];
  openRecentFile: (path: string) => Promise<void>;
}

function createSnapshot(state: AppState): Snapshot {
  return {
    tasks: JSON.parse(JSON.stringify(state.tasks)),
    sequences: JSON.parse(JSON.stringify(state.sequences)),
    resources: JSON.parse(JSON.stringify(state.resources)),
    assignments: JSON.parse(JSON.stringify(state.assignments)),
  };
}

function createDefaultProject(): Project {
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

function createDefaultView(): ViewState {
  return {
    scrollX: 0,
    scrollY: 0,
    zoom: 30, // pixels per day
    timeScale: 'week',
    viewStartDate: formatDate(new Date()),
  };
}

function createDefaultUI(): UIState {
  return {
    showTaskDialog: false,
    editingTaskId: null,
    showDependencyMode: false,
    dependencySourceId: null,
    showProjectSettings: false,
    showProjectInfoDialog: false,
    leftPanelWidth: 350,
    rightPanelWidth: 280,
    rightPanelVisible: true,
    rightPanelCollapsed: false,
    activeRibbonTab: 'start',
    collapsedTaskIds: [],
    inlineEditTaskId: null,
    showSettingsDialog: false,
    uiTheme: 'default',
    mouseWheelMode: 'zoom',
    enableQuarterHourZoom: false,
    weekStartDay: 'monday',
    smoothZoom: false,
  };
}

export const useAppStore = create<AppState>()(
  immer((set, get) => ({
    // Initial state
    project: createDefaultProject(),
    calendar: createDefaultCalendar(),
    tasks: [],
    sequences: [],
    resources: [],
    assignments: [],
    selectedTaskIds: [],
    cpmResult: null,
    view: createDefaultView(),
    ui: createDefaultUI(),
    undoStack: [],
    redoStack: [],
    isDirty: false,
    filePath: null,

    // --- Project ---
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

    // --- Tasks ---
    addTask: (partial) => {
      const id = generateId('task');
      set((s) => {
        s.undoStack.push(createSnapshot(s));
        s.redoStack = [];

        const now = s.project.startDate || formatDate(new Date());
        const task: Task = {
          id,
          name: partial.name,
          description: partial.description || '',
          wbsCode: partial.wbsCode || '',
          taskType: partial.taskType || 'CONSTRUCTION',
          status: partial.status || 'NOT_STARTED',
          isMilestone: partial.isMilestone || false,
          priority: partial.priority || 0,
          parentId: partial.parentId || null,
          childIds: [],
          time: partial.time || createDefaultTaskTime(now, partial.isMilestone ? 0 : 5),
          resourceIds: partial.resourceIds || [],
          color: partial.color,
        };

        s.tasks.push(task);

        // Add to parent's children
        if (task.parentId) {
          const parent = s.tasks.find(t => t.id === task.parentId);
          if (parent) parent.childIds.push(id);
        }

        s.isDirty = true;
      });
      return id;
    },

    updateTask: (id, updates) =>
      set((s) => {
        s.undoStack.push(createSnapshot(s));
        s.redoStack = [];

        const idx = s.tasks.findIndex(t => t.id === id);
        if (idx >= 0) {
          Object.assign(s.tasks[idx], updates);
          s.isDirty = true;
        }
      }),

    deleteTask: (id) =>
      set((s) => {
        s.undoStack.push(createSnapshot(s));
        s.redoStack = [];

        // Remove from parent
        const task = s.tasks.find(t => t.id === id);
        if (task?.parentId) {
          const parent = s.tasks.find(t => t.id === task.parentId);
          if (parent) {
            parent.childIds = parent.childIds.filter(cid => cid !== id);
          }
        }

        // Remove child tasks recursively
        const removeIds = new Set<string>();
        const collectChildren = (taskId: string) => {
          removeIds.add(taskId);
          const t = s.tasks.find(tt => tt.id === taskId);
          if (t) t.childIds.forEach(collectChildren);
        };
        collectChildren(id);

        s.tasks = s.tasks.filter(t => !removeIds.has(t.id));
        s.sequences = s.sequences.filter(
          seq => !removeIds.has(seq.predecessorId) && !removeIds.has(seq.successorId)
        );
        s.assignments = s.assignments.filter(a => !removeIds.has(a.taskId));
        s.selectedTaskIds = s.selectedTaskIds.filter(sid => !removeIds.has(sid));
        s.isDirty = true;
      }),

    moveTask: (id, newParentId) =>
      set((s) => {
        s.undoStack.push(createSnapshot(s));
        s.redoStack = [];

        const task = s.tasks.find(t => t.id === id);
        if (!task) return;

        // Remove from old parent
        if (task.parentId) {
          const oldParent = s.tasks.find(t => t.id === task.parentId);
          if (oldParent) {
            oldParent.childIds = oldParent.childIds.filter(c => c !== id);
          }
        }

        // Add to new parent
        task.parentId = newParentId;
        if (newParentId) {
          const newParent = s.tasks.find(t => t.id === newParentId);
          if (newParent) newParent.childIds.push(id);
        }

        s.isDirty = true;
      }),

    // --- Sequences ---
    addSequence: (seq) => {
      const id = generateId('seq');
      set((s) => {
        s.undoStack.push(createSnapshot(s));
        s.redoStack = [];

        // Prevent duplicate
        const exists = s.sequences.some(
          e => e.predecessorId === seq.predecessorId && e.successorId === seq.successorId
        );
        if (!exists) {
          s.sequences.push({ ...seq, id });
          s.isDirty = true;
        }
      });
      return id;
    },

    removeSequence: (id) =>
      set((s) => {
        s.undoStack.push(createSnapshot(s));
        s.redoStack = [];
        s.sequences = s.sequences.filter(seq => seq.id !== id);
        s.isDirty = true;
      }),

    // --- Resources ---
    addResource: (res) => {
      const id = generateId('res');
      set((s) => {
        s.resources.push({ ...res, id });
        s.isDirty = true;
      });
      return id;
    },

    removeResource: (id) =>
      set((s) => {
        s.resources = s.resources.filter(r => r.id !== id);
        s.assignments = s.assignments.filter(a => a.resourceId !== id);
        s.isDirty = true;
      }),

    assignResource: (taskId, resourceId, units) =>
      set((s) => {
        const id = generateId('asgn');
        s.assignments.push({ id, taskId, resourceId, units });
        const task = s.tasks.find(t => t.id === taskId);
        if (task && !task.resourceIds.includes(resourceId)) {
          task.resourceIds.push(resourceId);
        }
        s.isDirty = true;
      }),

    unassignResource: (assignmentId) =>
      set((s) => {
        s.assignments = s.assignments.filter(a => a.id !== assignmentId);
        s.isDirty = true;
      }),

    // --- Selection ---
    selectTask: (id, multi = false, range = false) =>
      set((s) => {
        if (range && s.selectedTaskIds.length > 0) {
          // Shift+click: select range from last selected to clicked task
          const lastSelected = s.selectedTaskIds[s.selectedTaskIds.length - 1];
          const flatIds = s.tasks.map(t => t.id);
          const fromIdx = flatIds.indexOf(lastSelected);
          const toIdx = flatIds.indexOf(id);
          if (fromIdx >= 0 && toIdx >= 0) {
            const start = Math.min(fromIdx, toIdx);
            const end = Math.max(fromIdx, toIdx);
            const rangeIds = flatIds.slice(start, end + 1);
            // Merge with existing selection (union)
            const merged = new Set([...s.selectedTaskIds, ...rangeIds]);
            s.selectedTaskIds = Array.from(merged);
          } else {
            s.selectedTaskIds = [id];
          }
        } else if (multi) {
          const idx = s.selectedTaskIds.indexOf(id);
          if (idx >= 0) {
            s.selectedTaskIds.splice(idx, 1);
          } else {
            s.selectedTaskIds.push(id);
          }
        } else {
          s.selectedTaskIds = [id];
        }
      }),

    selectTaskRange: (fromId, toId) =>
      set((s) => {
        const flatIds = s.tasks.map(t => t.id);
        const fromIdx = flatIds.indexOf(fromId);
        const toIdx = flatIds.indexOf(toId);
        if (fromIdx >= 0 && toIdx >= 0) {
          const start = Math.min(fromIdx, toIdx);
          const end = Math.max(fromIdx, toIdx);
          s.selectedTaskIds = flatIds.slice(start, end + 1);
        }
      }),

    deselectAll: () =>
      set((s) => {
        s.selectedTaskIds = [];
      }),

    // --- CPM ---
    runCPM: () =>
      set((s) => {
        const calEngine = new CalendarEngine(s.calendar);
        // Only run CPM on leaf tasks (non-summary)
        const leafTasks = s.tasks.filter(t => t.childIds.length === 0);
        const solver = new CPMSolver(leafTasks, s.sequences, calEngine);
        const result = solver.solve();

        // If circular dependency detected, store the result (with error) and bail
        if (result.error) {
          s.cpmResult = result;
          return;
        }

        // Apply results back to tasks
        for (const task of s.tasks) {
          const r = result.tasks.get(task.id);
          if (r) {
            task.time.earlyStart = r.earlyStart;
            task.time.earlyFinish = r.earlyFinish;
            task.time.lateStart = r.lateStart;
            task.time.lateFinish = r.lateFinish;
            task.time.totalFloat = r.totalFloat;
            task.time.freeFloat = r.freeFloat;
            task.time.isCritical = r.isCritical;
            task.time.scheduleStart = r.earlyStart;
            task.time.scheduleFinish = r.earlyFinish;
          }
        }

        // Update summary tasks (roll up dates from children)
        const updateSummary = (taskId: string) => {
          const task = s.tasks.find(t => t.id === taskId);
          if (!task || task.childIds.length === 0) return;

          for (const childId of task.childIds) {
            updateSummary(childId);
          }

          const children = task.childIds
            .map(cid => s.tasks.find(t => t.id === cid))
            .filter(Boolean) as Task[];

          if (children.length > 0) {
            const starts = children.map(c => c.time.earlyStart).sort();
            const finishes = children.map(c => c.time.earlyFinish).sort();
            task.time.earlyStart = starts[0];
            task.time.scheduleStart = starts[0];
            task.time.earlyFinish = finishes[finishes.length - 1];
            task.time.scheduleFinish = finishes[finishes.length - 1];
            task.time.isCritical = children.some(c => c.time.isCritical);
          }
        };

        // Find root tasks (no parent)
        for (const task of s.tasks) {
          if (!task.parentId) updateSummary(task.id);
        }

        s.cpmResult = result;
      }),

    // --- View ---
    setZoom: (zoom) =>
      set((s) => {
        const max = s.ui.enableQuarterHourZoom ? 1000 : 400;
        s.view.zoom = Math.max(0.5, Math.min(max, zoom));
      }),

    setTimeScale: (scale) =>
      set((s) => {
        s.view.timeScale = scale;
      }),

    setScroll: (x, y) =>
      set((s) => {
        s.view.scrollX = Math.max(0, x);
        s.view.scrollY = Math.max(0, y);
      }),

    setViewStartDate: (date) =>
      set((s) => {
        s.view.viewStartDate = date;
      }),

    // --- UI ---
    setUI: (updates) =>
      set((s) => {
        Object.assign(s.ui, updates);
        const max = s.ui.enableQuarterHourZoom ? 1000 : 400;
        if (s.view.zoom > max) s.view.zoom = max;
      }),

    // --- Collapse/expand ---
    toggleCollapse: (taskId) =>
      set((s) => {
        const idx = s.ui.collapsedTaskIds.indexOf(taskId);
        if (idx >= 0) {
          s.ui.collapsedTaskIds.splice(idx, 1);
        } else {
          s.ui.collapsedTaskIds.push(taskId);
        }
      }),

    // --- Undo/Redo ---
    undo: () =>
      set((s) => {
        if (s.undoStack.length === 0) return;
        s.redoStack.push(createSnapshot(s));
        const snapshot = s.undoStack.pop()!;
        s.tasks = snapshot.tasks;
        s.sequences = snapshot.sequences;
        s.resources = snapshot.resources;
        s.assignments = snapshot.assignments;
        s.isDirty = true;
      }),

    redo: () =>
      set((s) => {
        if (s.redoStack.length === 0) return;
        s.undoStack.push(createSnapshot(s));
        const snapshot = s.redoStack.pop()!;
        s.tasks = snapshot.tasks;
        s.sequences = snapshot.sequences;
        s.resources = snapshot.resources;
        s.assignments = snapshot.assignments;
        s.isDirty = true;
      }),

    // --- Load state (IFC import) ---
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

    // --- File operations ---
    openFile: async () => {
      if (!isTauri()) return;
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'All Supported', extensions: ['ifc', 'csv', 'xml'] },
          { name: 'IFC Files', extensions: ['ifc'] },
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'XML Files', extensions: ['xml'] },
        ],
      });
      if (!selected) return;
      const filePath = selected as string;
      try {
        const content = await readTextFile(filePath);
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        let parsed;

        if (ext === 'csv') {
          parsed = readCSV(content);
        } else if (ext === 'xml') {
          if (content.includes('schemas.microsoft.com/project') || content.includes('<Project')) {
            if (content.includes('APIBusinessObjects') || content.includes('Primavera')) {
              parsed = readP6XML(content);
            } else {
              parsed = readMSPDI(content);
            }
          } else if (content.includes('APIBusinessObjects') || content.includes('Primavera')) {
            parsed = readP6XML(content);
          } else {
            parsed = readMSPDI(content);
          }
        } else {
          parsed = readIFC(content);
        }

        set((s) => {
          s.project = parsed.project;
          s.calendar = parsed.calendar;
          s.tasks = parsed.tasks;
          s.sequences = parsed.sequences;
          s.resources = parsed.resources;
          s.assignments = parsed.assignments;
          s.selectedTaskIds = [];
          s.cpmResult = null;
          s.undoStack = [];
          s.redoStack = [];
          s.isDirty = false;
          s.filePath = filePath;
        });
        addRecentFile(filePath);
      } catch (err) {
        console.error('Failed to parse file:', err);
      }
    },

    saveFile: async () => {
      if (!isTauri()) return;
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const state = get();

      const content = writeIFC(
        state.project, state.calendar, state.tasks,
        state.sequences, state.resources, state.assignments,
      );

      if (state.filePath) {
        await writeTextFile(state.filePath, content);
        set((s) => { s.isDirty = false; });
      } else {
        const savedPath = await save({
          filters: [{ name: 'IFC Files', extensions: ['ifc'] }],
        });
        if (savedPath) {
          await writeTextFile(savedPath, content);
          set((s) => {
            s.filePath = savedPath;
            s.isDirty = false;
          });
          addRecentFile(savedPath);
        }
      }
    },

    saveFileAs: async () => {
      if (!isTauri()) return;
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const state = get();

      const content = writeIFC(
        state.project, state.calendar, state.tasks,
        state.sequences, state.resources, state.assignments,
      );

      const savedPath = await save({
        filters: [{ name: 'IFC Files', extensions: ['ifc'] }],
      });
      if (savedPath) {
        await writeTextFile(savedPath, content);
        set((s) => {
          s.filePath = savedPath;
          s.isDirty = false;
        });
        addRecentFile(savedPath);
      }
    },

    exportAs: async (format: ExportFormat) => {
      if (!isTauri()) return;
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const state = get();

      let content: string;
      let filters: { name: string; extensions: string[] }[];

      switch (format) {
        case 'csv':
          content = writeCSV(
            state.project, state.calendar, state.tasks,
            state.sequences, state.resources, state.assignments,
          );
          filters = [{ name: 'CSV Files', extensions: ['csv'] }];
          break;
        case 'mspdi':
          content = writeMSPDI(
            state.project, state.calendar, state.tasks,
            state.sequences, state.resources, state.assignments,
          );
          filters = [{ name: 'XML Files', extensions: ['xml'] }];
          break;
        case 'p6':
          content = writeP6XML(
            state.project, state.calendar, state.tasks,
            state.sequences, state.resources, state.assignments,
          );
          filters = [{ name: 'XML Files', extensions: ['xml'] }];
          break;
        case 'ifc':
        default:
          content = writeIFC(
            state.project, state.calendar, state.tasks,
            state.sequences, state.resources, state.assignments,
          );
          filters = [{ name: 'IFC Files', extensions: ['ifc'] }];
          break;
      }

      const savedPath = await save({ filters });
      if (savedPath) {
        await writeTextFile(savedPath, content);
        addRecentFile(savedPath);
      }
    },

    getRecentFiles: () => getRecentFiles(),

    openRecentFile: async (filePath: string) => {
      if (!isTauri()) return;
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      try {
        const content = await readTextFile(filePath);
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        let parsed;

        if (ext === 'csv') {
          parsed = readCSV(content);
        } else if (ext === 'xml') {
          if (content.includes('APIBusinessObjects') || content.includes('Primavera')) {
            parsed = readP6XML(content);
          } else {
            parsed = readMSPDI(content);
          }
        } else {
          parsed = readIFC(content);
        }

        set((s) => {
          s.project = parsed.project;
          s.calendar = parsed.calendar;
          s.tasks = parsed.tasks;
          s.sequences = parsed.sequences;
          s.resources = parsed.resources;
          s.assignments = parsed.assignments;
          s.selectedTaskIds = [];
          s.cpmResult = null;
          s.undoStack = [];
          s.redoStack = [];
          s.isDirty = false;
          s.filePath = filePath;
        });
        addRecentFile(filePath);
      } catch (err) {
        console.error('Failed to open recent file:', err);
      }
    },
  }))
);
