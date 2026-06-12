# Store-slices & Extensiesysteem — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De monolithische Zustand-store (845 regels) opsplitsen in echte slices, en daarbovenop een extensiesysteem naar het model van Open Calc Studio (manifest + main.js in ZIP/JS, IndexedDB-opslag, sandbox-uitvoering, catalogus, Extension Manager in de Backstage, extensie-importers en ribbon-knoppen).

**Architecture:** `src/state/appStore.ts` wordt een pure compositie-root die 10 slice-creators samenvoegt onder één `create<AppState>()(immer(...))`. Elke slice is `StateCreator<AppState, [['zustand/immer', never]], [], XSlice>` zodat cross-slice toegang (runCPM, undo, newProject) gewoon via de volledige draft blijft werken — gedrag verandert NIET, code verhuist alleen. Het extensiesysteem is 100% frontend (geen Rust): `src/extensions/` (types, api, loader, service) + `extensionSlice` + UI in Backstage/Ribbon. Extensies zelf zijn app-niveau (IndexedDB), géén projectdata — dus géén IFC-round-trip-impact. Importer-resultaten zijn gewone store-data die al door de IFC-laag round-trippen.

**Tech Stack:** React 19, Zustand + Immer (slices-patroon), TypeScript strict, react-i18next (14 locales), IndexedDB, DecompressionStream (eigen ZIP-parser, geen JSZip), Tauri 2 (onaangeraakt).

**Verificatie:** Er is géén testrunner (zie CLAUDE.md). Elke taak eindigt met `npm run build` (tsc strict + vite) als poortwachter, en het plan sluit af met een Playwright-MCP-zelftest via `window.__OPS__` tegen de browser-dev-build. Committen mag vrij; pushen alleen op expliciet verzoek.

**Referentie:** werkende implementatie in `/tmp/open-calc-studio` (indien verdwenen: `gh repo clone OpenAEC-Foundation/open-calc-studio /tmp/open-calc-studio`). Dit plan bevat alle code; de kloon is alleen achtergrond.

**Belangrijke regels:**
- Commit-berichten en codecommentaar in het Nederlands.
- Zichtbare UI-teksten ALTIJD via `t(...)` — nooit hardcoden (bestaande hardcoded Backstage-teksten laten staan, geen scope-creep).
- `@/`-alias gebruiken in imports.
- Regelnummers in dit plan verwijzen naar `src/state/appStore.ts` zoals die nu is (845 regels); die blijven geldig t/m Taak 11 omdat appStore.ts pas in Taak 11 wordt aangepast.

---

# Deel A — Store naar slices (Taak 1–11)

Strategie: eerst alle slice-bestanden aanmaken (Taak 2–10; appStore.ts blijft onaangeroerd, build blijft groen omdat de nieuwe bestanden tegen het bestaande volledige `AppState`-type compileren), dan in één cutover (Taak 11) appStore.ts vervangen door de compositie-root.

### Taak 1: Fundament — `AppSlice`-type en snapshot-util

**Files:**
- Modify: `src/state/slices/types.ts`
- Create: `src/state/snapshot.ts`

- [ ] **Step 1: Voeg het `AppSlice`-hulptype toe aan `src/state/slices/types.ts`**

Bovenaan het bestand (boven `export type TimeScale`):

```ts
import type { StateCreator } from 'zustand';
import type { AppState } from '../appStore';

/**
 * StateCreator-alias voor alle slices: eerste generic is de VOLLEDIGE store
 * zodat cross-slice acties (runCPM, undo, newProject) de hele draft zien;
 * immer-middleware zit in de mutator-keten.
 * Type-only import van AppState → de import-cyclus is compile-time-only en veilig.
 */
export type AppSlice<T> = StateCreator<AppState, [['zustand/immer', never]], [], T>;
```

- [ ] **Step 2: Maak `src/state/snapshot.ts`**

```ts
import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';

// Undo/redo werkt met diepe JSON-kopieën van de muteerbare projectdata.
export interface Snapshot {
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
}

export function createSnapshot(state: Snapshot): Snapshot {
  return {
    tasks: JSON.parse(JSON.stringify(state.tasks)),
    sequences: JSON.parse(JSON.stringify(state.sequences)),
    resources: JSON.parse(JSON.stringify(state.resources)),
    assignments: JSON.parse(JSON.stringify(state.assignments)),
  };
}
```

(Aanroepers geven straks de volledige store-draft door; dat past structureel op `Snapshot`.)

- [ ] **Step 3: Build**

Run: `npm run build` — verwacht: groen.

- [ ] **Step 4: Commit**

```bash
git add src/state/slices/types.ts src/state/snapshot.ts
git commit -m "refactor(store): AppSlice-type en snapshot-util als fundament voor slices"
```

### Taak 2: `viewSlice`

**Files:**
- Create: `src/state/slices/viewSlice.ts`

- [ ] **Step 1: Maak het bestand** (gedrag identiek aan appStore.ts regels 172–180 en 543–564)

```ts
import { formatDate } from '@/utils/dateUtils';
import type { ViewState, TimeScale, AppSlice } from './types';

export interface ViewSlice {
  view: ViewState;
  setZoom: (zoom: number) => void;
  setTimeScale: (scale: TimeScale) => void;
  setScroll: (x: number, y: number) => void;
  setViewStartDate: (date: string) => void;
}

export function createDefaultView(): ViewState {
  return {
    scrollX: 0,
    scrollY: 0,
    zoom: 30, // pixels per dag
    timeScale: 'week',
    viewStartDate: formatDate(new Date()),
  };
}

export const createViewSlice: AppSlice<ViewSlice> = (set) => ({
  view: createDefaultView(),

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
});
```

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/state/slices/viewSlice.ts
git commit -m "refactor(store): viewSlice afgesplitst (nog niet gekoppeld)"
```

### Taak 3: `uiSlice`

**Files:**
- Create: `src/state/slices/uiSlice.ts`

- [ ] **Step 1: Maak het bestand** (gedrag identiek aan regels 182–208, 566–576, 578–587)

```ts
import type { UIState, AppSlice } from './types';

export interface UiSlice {
  ui: UIState;
  setUI: (updates: Partial<UIState>) => void;
  toggleCollapse: (taskId: string) => void;
}

export function createDefaultUI(): UIState {
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
    backstageSection: 'recent',
    collapsedTaskIds: [],
    inlineEditTaskId: null,
    showSettingsDialog: false,
    uiTheme: 'dark',
    enableQuarterHourZoom: false,
    weekStartDay: 'monday',
    scrollMode: 'modifier',
    positionDivision: 'left-right',
    modifierMap: { plain: 'vertical', ctrl: 'zoom', shift: 'horizontal' },
    debugTerminalEnabled: false,
    debugTerminalOpen: false,
  };
}

export const createUiSlice: AppSlice<UiSlice> = (set) => ({
  ui: createDefaultUI(),

  setUI: (updates) =>
    set((s) => {
      // Als debugTerminalEnabled uitgezet wordt, forceer de terminal dicht.
      if (updates.debugTerminalEnabled === false) {
        (updates as Partial<UIState>).debugTerminalOpen = false;
      }
      Object.assign(s.ui, updates);
      const max = s.ui.enableQuarterHourZoom ? 1000 : 400;
      if (s.view.zoom > max) s.view.zoom = max;
    }),

  toggleCollapse: (taskId) =>
    set((s) => {
      const idx = s.ui.collapsedTaskIds.indexOf(taskId);
      if (idx >= 0) {
        s.ui.collapsedTaskIds.splice(idx, 1);
      } else {
        s.ui.collapsedTaskIds.push(taskId);
      }
    }),
});
```

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/state/slices/uiSlice.ts
git commit -m "refactor(store): uiSlice afgesplitst (nog niet gekoppeld)"
```

### Taak 4: `historySlice`

**Files:**
- Create: `src/state/slices/historySlice.ts`

- [ ] **Step 1: Maak het bestand** (gedrag identiek aan regels 589–612)

```ts
import { createSnapshot, type Snapshot } from '../snapshot';
import type { AppSlice } from './types';

export interface HistorySlice {
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  undo: () => void;
  redo: () => void;
}

export const createHistorySlice: AppSlice<HistorySlice> = (set) => ({
  undoStack: [],
  redoStack: [],

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
});
```

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/state/slices/historySlice.ts
git commit -m "refactor(store): historySlice afgesplitst (nog niet gekoppeld)"
```

### Taak 5: `taskSlice`

**Files:**
- Create: `src/state/slices/taskSlice.ts`

- [ ] **Step 1: Maak het bestand.** De action-bodies zijn 1-op-1 verhuisd uit appStore.ts: `addTask` (265–299), `updateTask` (301–311), `deleteTask` (313–343), `moveTask` (345–369), `selectTask` (433–461), `selectTaskRange` (463–473), `deselectAll` (475–478). Wrapper:

```ts
import { Task, createDefaultTaskTime } from '@/types/task';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import { createSnapshot } from '../snapshot';
import type { AppSlice } from './types';

export interface TaskSlice {
  tasks: Task[];
  selectedTaskIds: string[];
  addTask: (task: Partial<Task> & { name: string }) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newParentId: string | null) => void;
  selectTask: (id: string, multi?: boolean, range?: boolean) => void;
  selectTaskRange: (fromId: string, toId: string) => void;
  deselectAll: () => void;
}

export const createTaskSlice: AppSlice<TaskSlice> = (set) => ({
  tasks: [],
  selectedTaskIds: [],

  // hieronder de 7 action-bodies, LETTERLIJK gekopieerd uit appStore.ts
  // (regelbereiken hierboven), inclusief commentaar — niets herschrijven
  addTask: (partial) => { /* regels 265–299 */ },
  updateTask: (id, updates) => { /* regels 301–311 */ },
  deleteTask: (id) => { /* regels 313–343 */ },
  moveTask: (id, newParentId) => { /* regels 345–369 */ },
  selectTask: (id, multi = false, range = false) => { /* regels 433–461 */ },
  selectTaskRange: (fromId, toId) => { /* regels 463–473 */ },
  deselectAll: () => { /* regels 475–478 */ },
});
```

**Let op:** de `/* regels … */`-commentaren zijn instructies voor jou, geen code — vervang elk door de letterlijke body uit appStore.ts. Voorbeeld voor `addTask` (zo moet het resultaat eruitzien; doe hetzelfde voor de andere zes):

```ts
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

      // Voeg toe aan de kinderen van de parent
      if (task.parentId) {
        const parent = s.tasks.find(t => t.id === task.parentId);
        if (parent) parent.childIds.push(id);
      }

      s.isDirty = true;
    });
    return id;
  },
```

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/state/slices/taskSlice.ts
git commit -m "refactor(store): taskSlice afgesplitst (nog niet gekoppeld)"
```

### Taak 6: `sequenceSlice`

**Files:**
- Create: `src/state/slices/sequenceSlice.ts`

- [ ] **Step 1: Maak het bestand** (bodies letterlijk uit regels 372–388 en 390–396)

```ts
import { Sequence } from '@/types/sequence';
import { generateId } from '@/utils/id';
import { createSnapshot } from '../snapshot';
import type { AppSlice } from './types';

export interface SequenceSlice {
  sequences: Sequence[];
  addSequence: (seq: Omit<Sequence, 'id'>) => string;
  removeSequence: (id: string) => void;
}

export const createSequenceSlice: AppSlice<SequenceSlice> = (set) => ({
  sequences: [],

  addSequence: (seq) => {
    const id = generateId('seq');
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];

      // Voorkom duplicaat
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
});
```

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/state/slices/sequenceSlice.ts
git commit -m "refactor(store): sequenceSlice afgesplitst (nog niet gekoppeld)"
```

### Taak 7: `resourceSlice`

**Files:**
- Create: `src/state/slices/resourceSlice.ts`

- [ ] **Step 1: Maak het bestand** (bodies letterlijk uit regels 399–430; resource-acties pushen bewust géén undo-snapshot — zo is het nu ook)

```ts
import { Resource, ResourceAssignment } from '@/types/resource';
import { generateId } from '@/utils/id';
import type { AppSlice } from './types';

export interface ResourceSlice {
  resources: Resource[];
  assignments: ResourceAssignment[];
  addResource: (res: Omit<Resource, 'id'>) => string;
  removeResource: (id: string) => void;
  assignResource: (taskId: string, resourceId: string, units: number) => void;
  unassignResource: (assignmentId: string) => void;
}

export const createResourceSlice: AppSlice<ResourceSlice> = (set) => ({
  resources: [],
  assignments: [],

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
});
```

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/state/slices/resourceSlice.ts
git commit -m "refactor(store): resourceSlice afgesplitst (nog niet gekoppeld)"
```

### Taak 8: `scheduleSlice`

**Files:**
- Create: `src/state/slices/scheduleSlice.ts`

- [ ] **Step 1: Maak het bestand.** De `runCPM`-body is LETTERLIJK regels 481–541 van appStore.ts (inclusief de `updateSummary`-helper en alle commentaar). Wrapper:

```ts
import { Task } from '@/types/task';
import { CPMSolver, CPMResult } from '@/engine/scheduler/CPMSolver';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { AppSlice } from './types';

export interface ScheduleSlice {
  cpmResult: CPMResult | null;
  runCPM: () => void;
}

export const createScheduleSlice: AppSlice<ScheduleSlice> = (set) => ({
  cpmResult: null,

  runCPM: () =>
    set((s) => {
      // <-- hier de letterlijke body van regels 482–541 -->
    }),
});
```

(De body gebruikt `Task` in een type-assertion: `…filter(Boolean) as Task[]` — daarom de `Task`-import.)

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/state/slices/scheduleSlice.ts
git commit -m "refactor(store): scheduleSlice afgesplitst (nog niet gekoppeld)"
```

### Taak 9: `projectSlice`

**Files:**
- Create: `src/state/slices/projectSlice.ts`

- [ ] **Step 1: Maak het bestand** (bodies letterlijk uit regels 157–170, 229–262, 615–628; `newProject` gebruikt `createDefaultView` uit de viewSlice)

```ts
import { Project } from '@/types/project';
import { WorkCalendar, createDefaultCalendar } from '@/types/calendar';
import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
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
```

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/state/slices/projectSlice.ts
git commit -m "refactor(store): projectSlice afgesplitst (nog niet gekoppeld)"
```

### Taak 10: `fileSlice`

**Files:**
- Create: `src/state/slices/fileSlice.ts`

- [ ] **Step 1: Maak het bestand.** Bevat het `ExportFormat`-type, de recent-files-helpers (regels 29–47) en de zes file-acties met bodies LETTERLIJK uit appStore.ts: `openFile` (631–687), `saveFile` (689–718), `saveFileAs` (720–744), `exportAs` (746–801), `openRecentFile` (805–843). Wrapper:

```ts
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeCSV } from '@/services/csv/csvWriter';
import { readCSV } from '@/services/csv/csvReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { ensureExtension } from '@/utils/filePath';
import type { AppSlice } from './types';

const isTauri = () => '__TAURI_INTERNALS__' in window;

export type ExportFormat = 'ifc' | 'csv' | 'mspdi' | 'p6';

// ---- Recente bestanden (localStorage) ----
const RECENT_FILES_KEY = 'open-planner-studio-recent-files';
const MAX_RECENT_FILES = 10;

function readRecentFiles(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentFile(filePath: string): void {
  const recent = readRecentFiles().filter(f => f !== filePath);
  recent.unshift(filePath);
  if (recent.length > MAX_RECENT_FILES) recent.length = MAX_RECENT_FILES;
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recent));
}

export interface FileSlice {
  openFile: () => Promise<void>;
  saveFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  exportAs: (format: ExportFormat) => Promise<void>;
  getRecentFiles: () => string[];
  openRecentFile: (path: string) => Promise<void>;
}

export const createFileSlice: AppSlice<FileSlice> = (set, get) => ({
  openFile: async () => { /* letterlijk regels 632–687 */ },
  saveFile: async () => { /* letterlijk regels 690–718 */ },
  saveFileAs: async () => { /* letterlijk regels 721–744 */ },
  exportAs: async (format: ExportFormat) => { /* letterlijk regels 747–801 */ },
  getRecentFiles: () => readRecentFiles(),
  openRecentFile: async (filePath: string) => { /* letterlijk regels 806–843 */ },
});
```

De `/* letterlijk … */`-commentaren weer vervangen door de exacte bodies uit appStore.ts. In die bodies heet de oude helper `getRecentFiles()` — die aanroepen blijven werken niet: **hernoem in de geplakte bodies elke aanroep van de helper `getRecentFiles()` naar `readRecentFiles()`** (komt alléén voor binnen `addRecentFile`, die hierboven al af is — in de action-bodies zelf wordt alleen `addRecentFile(...)` aangeroepen, die naam blijft gelijk). De bodies gebruiken `set` en `get` precies zoals in het origineel.

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/state/slices/fileSlice.ts
git commit -m "refactor(store): fileSlice afgesplitst (nog niet gekoppeld)"
```

### Taak 11: Cutover — appStore.ts wordt compositie-root

**Files:**
- Modify: `src/state/appStore.ts` (volledig vervangen)

- [ ] **Step 1: Vervang de volledige inhoud van `src/state/appStore.ts` door:**

```ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice';
import { createTaskSlice, type TaskSlice } from './slices/taskSlice';
import { createSequenceSlice, type SequenceSlice } from './slices/sequenceSlice';
import { createResourceSlice, type ResourceSlice } from './slices/resourceSlice';
import { createScheduleSlice, type ScheduleSlice } from './slices/scheduleSlice';
import { createHistorySlice, type HistorySlice } from './slices/historySlice';
import { createViewSlice, type ViewSlice } from './slices/viewSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';
import { createFileSlice, type FileSlice } from './slices/fileSlice';

// Consumenten blijven ExportFormat uit '@/state/appStore' importeren.
export type { ExportFormat } from './slices/fileSlice';

enableMapSet();

/**
 * Compositie-root: de store is samengesteld uit slices (zie src/state/slices/).
 * Elke slice is getypeerd tegen de volledige AppState zodat cross-slice acties
 * (runCPM, undo/redo, newProject, file-I/O) de hele Immer-draft zien.
 */
export type AppState = ProjectSlice &
  TaskSlice &
  SequenceSlice &
  ResourceSlice &
  ScheduleSlice &
  HistorySlice &
  ViewSlice &
  UiSlice &
  FileSlice;

export const useAppStore = create<AppState>()(
  immer((...a) => ({
    ...createProjectSlice(...a),
    ...createTaskSlice(...a),
    ...createSequenceSlice(...a),
    ...createResourceSlice(...a),
    ...createScheduleSlice(...a),
    ...createHistorySlice(...a),
    ...createViewSlice(...a),
    ...createUiSlice(...a),
    ...createFileSlice(...a),
  }))
);
```

- [ ] **Step 2: Build** — `npm run build`, verwacht groen. Bekende valkuilen als het rood is:
  - `AppState` wordt nu via `export type` geëxporteerd; consumenten gebruiken het alleen als type, dat is OK.
  - Controleer dat geen enkele slice een veld dubbel declareert (elk veld hoort in precies één slice).
- [ ] **Step 3: Rooktest in de browser (snel).** Start `npm run dev` op de achtergrond, open `http://localhost:3007` (of `OPS_DEV_PORT`), en check in de console: `window.__OPS__.store.getState().tasks` bestaat, voeg via `window.__OPS__.store.getState().addTask({ name: 'Rooktest' })` een taak toe, run `runCPM`, `undo`. Verwacht: geen errors, taakaantal klopt. Stop de dev-server daarna.
- [ ] **Step 4: Commit**

```bash
git add src/state/appStore.ts
git commit -m "refactor(store): appStore is nu een compositie-root van negen slices"
```

---

# Deel B — Extensiesysteem (Taak 12–23)

### Taak 12: Extensie-types

**Files:**
- Create: `src/extensions/types.ts`

- [ ] **Step 1: Maak het bestand:**

```ts
/**
 * Typen voor het extensiesysteem van Open Planner Studio.
 * Gemodelleerd naar Open Calc Studio / Open 2D Studio:
 * een extensie = manifest.json + main.js (CommonJS, exporteert onLoad/onUnload),
 * verpakt als ZIP of los .js-bestand, opgeslagen in IndexedDB.
 */
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';

// ── Categorieën & permissies ──

export type ExtensionCategory =
  | 'Import/Export'
  | 'Planning'
  | 'Reporting'
  | 'Utility'
  | 'Other';

// Declaratief in het manifest; 'ribbon' en 'events' worden afgedwongen in de API.
export type ExtensionPermission =
  | 'commands'
  | 'ribbon'
  | 'backstage'
  | 'events'
  | 'filesystem'
  | 'network';

export type ExtensionStatus = 'enabled' | 'disabled' | 'error' | 'loading';

// ── Manifest (manifest.json in de extensie) ──

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  author: string;
  description: string;
  category: ExtensionCategory;
  main: string;              // relatief pad naar main.js
  permissions: ExtensionPermission[];
  repository?: string;
  tags?: string[];
  icon?: string;             // inline SVG-string of emoji
}

// ── Geïnstalleerde extensie (runtime-record in de store) ──

export interface InstalledExtension {
  id: string;
  manifest: ExtensionManifest;
  status: ExtensionStatus;
  error?: string;
}

// ── Plugin-interface (wat main.js exporteert) ──

export interface ExtensionPlugin {
  onLoad(api: ExtensionApi): void | Promise<void>;
  onUnload?(): void | Promise<void>;
}

// ── Importresultaat = exact de vorm die loadState verwacht ──

export interface ImportResult {
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
}

// ── Importer-registratie ──

export interface ImporterDefinition {
  id: string;
  name: string;
  description: string;
  fileExtensions: string[];   // bv. ['.xlsx', '.xer']
  icon?: string;
  handler: (file: File) => Promise<ImportResult>;
}

// ── Ribbon-registratie ──

export interface RibbonButtonRegistration {
  tab: string;                // RibbonTab-waarde, bv. 'start' of 'planning'
  group: string;              // groepslabel in de ribbon
  label: string;
  icon?: string;              // inline SVG-string
  onClick: () => void;
  tooltip?: string;
}

// ── Extension API (meegegeven aan onLoad) ──

export interface ExtensionApi {
  readonly extensionId: string;

  /** Registratie van import-formaten (verschijnen in Backstage → Importeren). */
  importers: {
    register(def: ImporterDefinition): void;
    unregister(id: string): void;
  };

  /** Lees-/schrijftoegang tot de planningsdata. Mutaties lopen via store-acties
   *  (die zelf undo-snapshots pushen); na bulk-wijzigingen zelf recalculate() aanroepen. */
  data: {
    getProject(): Project;
    getCalendar(): WorkCalendar;
    getTasks(): Task[];
    getSequences(): Sequence[];
    getResources(): Resource[];
    getAssignments(): ResourceAssignment[];
    addTask(task: Partial<Task> & { name: string }): string;
    updateTask(id: string, updates: Partial<Task>): void;
    addSequence(seq: Omit<Sequence, 'id'>): string;
    /** Vervang het volledige project (zoals een import doet) en herbereken. */
    loadProject(result: ImportResult): void;
    /** runCPM — herbereken het schema. */
    recalculate(): void;
  };

  /** Globale event-bus (permissie 'events' vereist). */
  events: {
    on(event: string, listener: (data: unknown) => void): () => void;
    off(event: string, listener: (data: unknown) => void): void;
    emit(event: string, data?: unknown): void;
  };

  /** UI-registratie. */
  ui: {
    addRibbonButton(reg: RibbonButtonRegistration): void;
    showNotification(message: string, type?: 'info' | 'warning' | 'error'): void;
  };

  /** Per-extensie instellingen (localStorage, prefix 'ops-ext:<id>:'). */
  settings: {
    get<T>(key: string, defaultValue: T): T;
    set<T>(key: string, value: T): void;
  };

  /** Intern — draait alle registraties terug bij disable. */
  _cleanup(): void;
}

// ── Catalogus (extern register op GitHub) ──

export interface ExtensionCatalog {
  version: string;
  lastUpdated: string;
  extensions: CatalogEntry[];
}

export interface CatalogEntry {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: ExtensionCategory;
  tags: string[];
  minAppVersion: string;
  repository: string;
  downloadUrl: string;        // wijst naar een release-ZIP
  icon?: string;
}
```

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/extensions/types.ts
git commit -m "feat(extensies): typen voor manifest, plugin-API, importers en catalogus"
```

### Taak 13: `extensionSlice` + koppeling in de store

**Files:**
- Create: `src/state/slices/extensionSlice.ts`
- Modify: `src/state/appStore.ts`

- [ ] **Step 1: Maak `src/state/slices/extensionSlice.ts`:**

```ts
import type {
  InstalledExtension,
  ExtensionStatus,
  CatalogEntry,
  RibbonButtonRegistration,
  ImporterDefinition,
} from '@/extensions/types';
import type { AppSlice } from './types';

export interface ExtensionRibbonButton extends RibbonButtonRegistration {
  extensionId: string;
}

export interface ExtensionImporter extends ImporterDefinition {
  extensionId: string;
}

export interface ExtensionSlice {
  // State
  installedExtensions: Record<string, InstalledExtension>;
  extensionRibbonButtons: ExtensionRibbonButton[];
  extensionImporters: ExtensionImporter[];
  catalogEntries: CatalogEntry[];
  catalogLoading: boolean;
  catalogError: string | null;
  catalogLastFetched: number | null;

  // Extensie-CRUD
  registerExtension: (ext: InstalledExtension) => void;
  unregisterExtension: (id: string) => void;
  setExtensionStatus: (id: string, status: ExtensionStatus, error?: string) => void;

  // Ribbon-knoppen
  addExtensionRibbonButton: (btn: ExtensionRibbonButton) => void;
  removeExtensionRibbonButton: (extensionId: string, label: string) => void;

  // Importers
  addExtensionImporter: (imp: ExtensionImporter) => void;
  removeExtensionImporter: (extensionId: string, importerId: string) => void;

  // Alle UI van een extensie opruimen
  removeAllExtensionUI: (extensionId: string) => void;

  // Catalogus
  setCatalog: (entries: CatalogEntry[], fetchedAt: number) => void;
  setCatalogLoading: (loading: boolean) => void;
  setCatalogError: (error: string | null) => void;
}

export const createExtensionSlice: AppSlice<ExtensionSlice> = (set) => ({
  installedExtensions: {},
  extensionRibbonButtons: [],
  extensionImporters: [],
  catalogEntries: [],
  catalogLoading: false,
  catalogError: null,
  catalogLastFetched: null,

  registerExtension: (ext) =>
    set((s) => {
      s.installedExtensions[ext.id] = ext;
    }),

  unregisterExtension: (id) =>
    set((s) => {
      delete s.installedExtensions[id];
    }),

  setExtensionStatus: (id, status, error) =>
    set((s) => {
      const ext = s.installedExtensions[id];
      if (ext) {
        ext.status = status;
        ext.error = error;
      }
    }),

  addExtensionRibbonButton: (btn) =>
    set((s) => {
      const exists = s.extensionRibbonButtons.some(
        b => b.extensionId === btn.extensionId && b.label === btn.label
      );
      if (!exists) s.extensionRibbonButtons.push(btn);
    }),

  removeExtensionRibbonButton: (extensionId, label) =>
    set((s) => {
      s.extensionRibbonButtons = s.extensionRibbonButtons.filter(
        b => !(b.extensionId === extensionId && b.label === label)
      );
    }),

  addExtensionImporter: (imp) =>
    set((s) => {
      const exists = s.extensionImporters.some(
        i => i.extensionId === imp.extensionId && i.id === imp.id
      );
      if (!exists) s.extensionImporters.push(imp);
    }),

  removeExtensionImporter: (extensionId, importerId) =>
    set((s) => {
      s.extensionImporters = s.extensionImporters.filter(
        i => !(i.extensionId === extensionId && i.id === importerId)
      );
    }),

  removeAllExtensionUI: (extensionId) =>
    set((s) => {
      s.extensionRibbonButtons = s.extensionRibbonButtons.filter(
        b => b.extensionId !== extensionId
      );
      s.extensionImporters = s.extensionImporters.filter(
        i => i.extensionId !== extensionId
      );
    }),

  setCatalog: (entries, fetchedAt) =>
    set((s) => {
      s.catalogEntries = entries;
      s.catalogLastFetched = fetchedAt;
      s.catalogError = null;
    }),

  setCatalogLoading: (loading) =>
    set((s) => {
      s.catalogLoading = loading;
    }),

  setCatalogError: (error) =>
    set((s) => {
      s.catalogError = error;
    }),
});
```

- [ ] **Step 2: Koppel de slice in `src/state/appStore.ts`:** voeg de import toe, breid `AppState` uit met `& ExtensionSlice`, en voeg `...createExtensionSlice(...a),` toe aan de spread (na `...createFileSlice(...a),`):

```ts
import { createExtensionSlice, type ExtensionSlice } from './slices/extensionSlice';
// ...
export type AppState = ProjectSlice &
  // ...bestaande slices...
  FileSlice &
  ExtensionSlice;
// ...
    ...createFileSlice(...a),
    ...createExtensionSlice(...a),
```

- [ ] **Step 3: Build** — `npm run build`, verwacht groen.
- [ ] **Step 4: Commit**

```bash
git add src/state/slices/extensionSlice.ts src/state/appStore.ts
git commit -m "feat(extensies): extensionSlice in de store (registratie, ribbon, importers, catalogus)"
```

### Taak 14: `extensionApi` — scoped API met permissie-checks

**Files:**
- Create: `src/extensions/extensionApi.ts`

- [ ] **Step 1: Maak het bestand:**

```ts
/**
 * Maakt per extensie een scoped API-instantie met permissie-checks.
 * Alle registraties worden bijgehouden in cleanupFns zodat disable ze terugdraait.
 */
import type {
  ExtensionApi,
  ExtensionPermission,
  ImporterDefinition,
  RibbonButtonRegistration,
  ImportResult,
} from './types';
import { useAppStore } from '@/state/appStore';
import { appLog } from '@/services/debug/appLog';

type ExtEventListener = (data: unknown) => void;

// Globale event-bus voor extensies
const eventListeners = new Map<string, Set<ExtEventListener>>();

export function emitExtensionEvent(event: string, data?: unknown) {
  eventListeners.get(event)?.forEach((fn) => fn(data));
}

export function createExtensionApi(
  extensionId: string,
  permissions: ExtensionPermission[],
): ExtensionApi {
  const cleanupFns: (() => void)[] = [];

  function requirePermission(perm: ExtensionPermission) {
    if (!permissions.includes(perm)) {
      throw new Error(`Extensie "${extensionId}" mist permissie: ${perm}`);
    }
  }

  const settingsPrefix = `ops-ext:${extensionId}:`;

  const api: ExtensionApi = {
    extensionId,

    importers: {
      register(def: ImporterDefinition) {
        useAppStore.getState().addExtensionImporter({ ...def, extensionId });
        cleanupFns.push(() => {
          useAppStore.getState().removeExtensionImporter(extensionId, def.id);
        });
      },
      unregister(id: string) {
        useAppStore.getState().removeExtensionImporter(extensionId, id);
      },
    },

    data: {
      getProject: () => useAppStore.getState().project,
      getCalendar: () => useAppStore.getState().calendar,
      getTasks: () => useAppStore.getState().tasks,
      getSequences: () => useAppStore.getState().sequences,
      getResources: () => useAppStore.getState().resources,
      getAssignments: () => useAppStore.getState().assignments,
      addTask: (task) => useAppStore.getState().addTask(task),
      updateTask: (id, updates) => useAppStore.getState().updateTask(id, updates),
      addSequence: (seq) => useAppStore.getState().addSequence(seq),
      loadProject: (result: ImportResult) => {
        const store = useAppStore.getState();
        store.loadState(result);
        store.runCPM();
      },
      recalculate: () => useAppStore.getState().runCPM(),
    },

    events: {
      on(event: string, listener: ExtEventListener) {
        requirePermission('events');
        if (!eventListeners.has(event)) {
          eventListeners.set(event, new Set());
        }
        eventListeners.get(event)!.add(listener);
        const unsub = () => eventListeners.get(event)?.delete(listener);
        cleanupFns.push(unsub);
        return unsub;
      },
      off(event: string, listener: ExtEventListener) {
        eventListeners.get(event)?.delete(listener);
      },
      emit(event: string, data?: unknown) {
        requirePermission('events');
        emitExtensionEvent(event, data);
      },
    },

    ui: {
      addRibbonButton(reg: RibbonButtonRegistration) {
        requirePermission('ribbon');
        useAppStore.getState().addExtensionRibbonButton({ ...reg, extensionId });
        cleanupFns.push(() => {
          useAppStore.getState().removeExtensionRibbonButton(extensionId, reg.label);
        });
      },
      showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info') {
        // Zichtbaar in de debug-terminal én de console.
        const level = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
        appLog.emit(level, `ext:${extensionId}`, message);
        console.log(`[${extensionId}] ${message}`);
      },
    },

    settings: {
      get<T>(key: string, defaultValue: T): T {
        try {
          const raw = localStorage.getItem(settingsPrefix + key);
          return raw !== null ? JSON.parse(raw) : defaultValue;
        } catch {
          return defaultValue;
        }
      },
      set<T>(key: string, value: T) {
        localStorage.setItem(settingsPrefix + key, JSON.stringify(value));
      },
    },

    _cleanup() {
      cleanupFns.forEach((fn) => fn());
      cleanupFns.length = 0;
      useAppStore.getState().removeAllExtensionUI(extensionId);
    },
  };

  return api;
}
```

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/extensions/extensionApi.ts
git commit -m "feat(extensies): scoped extensie-API met permissie-checks en event-bus"
```

### Taak 15: `extensionLoader` — IndexedDB-opslag en sandbox-uitvoering

**Files:**
- Create: `src/extensions/extensionLoader.ts`

- [ ] **Step 1: Maak het bestand:**

```ts
/**
 * Extensie-loader — bewaart, laadt, activeert en deactiveert extensies.
 * Opslag: IndexedDB-database 'ops-extensions' (werkt in browser én Tauri-webview).
 * Uitvoering: new Function(...) met een minimale CommonJS-omgeving; require()
 * geeft alleen de host-SDK ('open-planner-studio') terug.
 */
import type { ExtensionManifest, ExtensionPlugin, InstalledExtension } from './types';
import { createExtensionApi } from './extensionApi';
import { useAppStore } from '@/state/appStore';

// Actieve plugin-instanties (voor opruimen bij disable)
const activePlugins = new Map<string, { plugin: ExtensionPlugin; api: ReturnType<typeof createExtensionApi> }>();

function openExtensionDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ops-extensions', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('extensions')) {
        db.createObjectStore('extensions', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface StoredExtension {
  id: string;
  manifest: ExtensionManifest;
  mainCode: string;
  enabled: boolean;
}

export async function saveExtensionToDb(ext: StoredExtension): Promise<void> {
  const db = await openExtensionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extensions', 'readwrite');
    tx.objectStore('extensions').put(ext);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeExtensionFromDb(id: string): Promise<void> {
  const db = await openExtensionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extensions', 'readwrite');
    tx.objectStore('extensions').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllExtensionsFromDb(): Promise<StoredExtension[]> {
  const db = await openExtensionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extensions', 'readonly');
    const req = tx.objectStore('extensions').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getExtensionFromDb(id: string): Promise<StoredExtension | undefined> {
  const db = await openExtensionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('extensions', 'readonly');
    const req = tx.objectStore('extensions').get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Voer extensie-code uit in een minimale CommonJS-sandbox. */
function executeExtensionCode(mainCode: string): ExtensionPlugin {
  const moduleExports: Record<string, unknown> = {};
  const moduleObj = { exports: moduleExports as Record<string, unknown> };

  const requireFn = (moduleName: string) => {
    if (moduleName === 'open-planner-studio') {
      return (window as unknown as Record<string, unknown>).__openPlannerStudioSdk || {};
    }
    throw new Error(`Module "${moduleName}" is niet beschikbaar in de extensie-sandbox`);
  };

  try {
    const fn = new Function('module', 'exports', 'require', mainCode);
    fn(moduleObj, moduleExports, requireFn);
  } catch (err) {
    throw new Error(`Uitvoeren van extensie-code mislukt: ${err}`);
  }

  const plugin = (moduleObj.exports as { default?: unknown }).default || moduleObj.exports;
  if (typeof (plugin as ExtensionPlugin).onLoad !== 'function') {
    throw new Error('Extensie moet een onLoad-functie exporteren');
  }

  return plugin as ExtensionPlugin;
}

/** Activeer een extensie: code laden, uitvoeren, onLoad(api) aanroepen. */
export async function enableExtension(id: string): Promise<void> {
  const store = useAppStore.getState();

  if (activePlugins.has(id)) return;

  store.setExtensionStatus(id, 'loading');

  try {
    const stored = await getExtensionFromDb(id);
    if (!stored) throw new Error(`Extensie "${id}" niet gevonden in opslag`);

    const plugin = executeExtensionCode(stored.mainCode);
    const api = createExtensionApi(id, stored.manifest.permissions);

    await plugin.onLoad(api);

    activePlugins.set(id, { plugin, api });
    store.setExtensionStatus(id, 'enabled');

    stored.enabled = true;
    await saveExtensionToDb(stored);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.setExtensionStatus(id, 'error', message);
    console.error(`[Extensies] Activeren van "${id}" mislukt:`, err);
  }
}

/** Deactiveer een extensie en draai alle registraties terug. */
export async function disableExtension(id: string): Promise<void> {
  const active = activePlugins.get(id);
  if (active) {
    try {
      await active.plugin.onUnload?.();
    } catch (err) {
      console.error(`[Extensies] Fout in onUnload van "${id}":`, err);
    }
    active.api._cleanup();
    activePlugins.delete(id);
  }

  useAppStore.getState().setExtensionStatus(id, 'disabled');

  const stored = await getExtensionFromDb(id);
  if (stored) {
    stored.enabled = false;
    await saveExtensionToDb(stored);
  }
}

/** Laad alle geïnstalleerde extensies bij het opstarten (auto-enable wat aan stond). */
export async function loadAllExtensions(): Promise<void> {
  try {
    const allExtensions = await getAllExtensionsFromDb();

    for (const ext of allExtensions) {
      const installed: InstalledExtension = {
        id: ext.id,
        manifest: ext.manifest,
        status: 'disabled',
      };
      useAppStore.getState().registerExtension(installed);

      if (ext.enabled) {
        await enableExtension(ext.id);
      }
    }
  } catch (err) {
    console.error('[Extensies] Laden van extensies mislukt:', err);
  }
}

export function getActivePlugins() {
  return activePlugins;
}
```

- [ ] **Step 2: Build** — `npm run build`, verwacht groen.
- [ ] **Step 3: Commit**

```bash
git add src/extensions/extensionLoader.ts
git commit -m "feat(extensies): loader met IndexedDB-opslag en sandbox-uitvoering"
```

### Taak 16: `extensionService` (installeren/catalogus) + barrel

**Files:**
- Create: `src/extensions/extensionService.ts`
- Create: `src/extensions/index.ts`

- [ ] **Step 1: Maak `src/extensions/extensionService.ts`:**

```ts
/**
 * Installeren, verwijderen en catalogusbeheer van extensies.
 * ZIP-parsing gebeurt met een minimale eigen parser op basis van
 * DecompressionStream — geen JSZip-dependency (zelfde aanpak als Open Calc Studio).
 */
import type { ExtensionManifest, InstalledExtension, CatalogEntry } from './types';
import {
  saveExtensionToDb,
  removeExtensionFromDb,
  enableExtension,
  disableExtension,
  getActivePlugins,
} from './extensionLoader';
import { useAppStore } from '@/state/appStore';

// ── Catalogus ──

const CATALOG_URL =
  'https://raw.githubusercontent.com/OpenAEC-Foundation/open-planner-studio-extensions/main/catalog.json';
const CATALOG_CACHE_MS = 30 * 60 * 1000; // 30 min

export async function fetchCatalog(): Promise<void> {
  const store = useAppStore.getState();
  const now = Date.now();

  if (store.catalogLastFetched && now - store.catalogLastFetched < CATALOG_CACHE_MS) return;

  store.setCatalogLoading(true);
  store.setCatalogError(null);

  try {
    const res = await fetch(CATALOG_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const catalog = await res.json();
    store.setCatalog(catalog.extensions || [], now);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Catalogus ophalen mislukt';
    useAppStore.getState().setCatalogError(message);
  } finally {
    useAppStore.getState().setCatalogLoading(false);
  }
}

// ── Installeren vanuit de catalogus ──

export async function installFromCatalog(entry: CatalogEntry): Promise<boolean> {
  try {
    const res = await fetch(entry.downloadUrl);
    if (!res.ok) throw new Error(`Download mislukt: HTTP ${res.status}`);

    const blob = await res.blob();
    return await installFromZipBlob(blob, entry.id);
  } catch (err) {
    console.error('[Extensies] Installeren vanuit catalogus mislukt:', err);
    return false;
  }
}

// ── Installeren vanuit een lokaal ZIP-bestand ──

export async function installFromFile(): Promise<boolean> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { resolve(false); return; }
      const result = await installFromZipBlob(file);
      resolve(result);
    };
    input.click();
  });
}

// ── Installeren vanuit een los .js-bestand (simpele extensies) ──

export async function installFromJsFile(): Promise<boolean> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { resolve(false); return; }

      try {
        const mainCode = await file.text();
        const manifest = extractManifestFromCode(mainCode, file.name);

        await saveExtensionToDb({
          id: manifest.id,
          manifest,
          mainCode,
          enabled: true,
        });

        const installed: InstalledExtension = {
          id: manifest.id,
          manifest,
          status: 'disabled',
        };
        useAppStore.getState().registerExtension(installed);
        await enableExtension(manifest.id);

        resolve(true);
      } catch (err) {
        console.error('[Extensies] Installeren vanuit JS mislukt:', err);
        resolve(false);
      }
    };
    input.click();
  });
}

function extractManifestFromCode(code: string, fileName: string): ExtensionManifest {
  // Zoek een @manifest-JSON-blok in het commentaar
  const match = code.match(/@manifest\s*(\{[\s\S]*?\})\s*\*/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch { /* val terug op gegenereerd manifest */ }
  }

  const id = fileName.replace(/\.js$/, '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  return {
    id,
    name: fileName.replace(/\.js$/, ''),
    version: '1.0.0',
    minAppVersion: '0.0.0',
    author: 'Onbekend',
    description: `Extensie geladen uit ${fileName}`,
    category: 'Other',
    main: 'main.js',
    permissions: ['commands', 'events'],
  };
}

// ── ZIP-afhandeling ──

async function installFromZipBlob(blob: Blob, overrideId?: string): Promise<boolean> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const files = await parseZipEntries(arrayBuffer);

    const manifestEntry = files.find((f) => f.name.endsWith('manifest.json'));
    if (!manifestEntry) throw new Error('Geen manifest.json gevonden in ZIP');

    const manifest: ExtensionManifest = JSON.parse(new TextDecoder().decode(manifestEntry.data));

    const mainPath = manifest.main || 'main.js';
    const mainEntry = files.find(
      (f) => f.name.endsWith(mainPath) || f.name.endsWith('/' + mainPath)
    );
    if (!mainEntry) throw new Error(`Hoofdbestand "${mainPath}" niet gevonden in ZIP`);

    const mainCode = new TextDecoder().decode(mainEntry.data);
    const id = overrideId || manifest.id;

    // Al geïnstalleerd? Eerst deactiveren.
    if (getActivePlugins().has(id)) {
      await disableExtension(id);
    }

    await saveExtensionToDb({
      id,
      manifest: { ...manifest, id },
      mainCode,
      enabled: true,
    });

    const installed: InstalledExtension = {
      id,
      manifest: { ...manifest, id },
      status: 'disabled',
    };
    useAppStore.getState().registerExtension(installed);
    await enableExtension(id);

    return true;
  } catch (err) {
    console.error('[Extensies] ZIP-installatie mislukt:', err);
    return false;
  }
}

// ── Minimale ZIP-parser (stored + deflate) ──

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

async function parseZipEntries(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const view = new DataView(buffer);
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset < buffer.byteLength - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // local file header signature

    const method = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameBytes = new Uint8Array(buffer, offset + 30, nameLen);
    const name = new TextDecoder().decode(nameBytes);
    const dataOffset = offset + 30 + nameLen + extraLen;
    const compressedData = new Uint8Array(buffer, dataOffset, compSize);

    // Mappen overslaan
    if (!name.endsWith('/')) {
      let data: Uint8Array;
      if (method === 0) {
        // ongecomprimeerd
        data = compressedData;
      } else if (method === 8) {
        // deflate — via DecompressionStream
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        void writer.write(compressedData);
        void writer.close();

        const chunks: Uint8Array[] = [];
        let totalLen = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.length;
        }
        data = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of chunks) {
          data.set(chunk, pos);
          pos += chunk.length;
        }
      } else {
        throw new Error(`Niet-ondersteunde compressiemethode: ${method}`);
      }

      // Gemeenschappelijke mapprefix strippen
      const cleanName = name.replace(/^[^/]+\//, '');
      if (cleanName) {
        entries.push({ name: cleanName, data });
      }
    }

    offset = dataOffset + compSize;
  }

  return entries;
}

// ── Extensie verwijderen ──

export async function removeExtension(id: string): Promise<void> {
  if (getActivePlugins().has(id)) {
    await disableExtension(id);
  }

  await removeExtensionFromDb(id);
  useAppStore.getState().unregisterExtension(id);

  // Instellingen van deze extensie opruimen
  const prefix = `ops-ext:${id}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
```

- [ ] **Step 2: Maak `src/extensions/index.ts`:**

```ts
export * from './types';
export { createExtensionApi, emitExtensionEvent } from './extensionApi';
export {
  enableExtension,
  disableExtension,
  loadAllExtensions,
  saveExtensionToDb,
  getActivePlugins,
  type StoredExtension,
} from './extensionLoader';
export {
  fetchCatalog,
  installFromCatalog,
  installFromFile,
  installFromJsFile,
  removeExtension,
} from './extensionService';
```

- [ ] **Step 3: Build** — `npm run build`, verwacht groen.
- [ ] **Step 4: Commit**

```bash
git add src/extensions/extensionService.ts src/extensions/index.ts
git commit -m "feat(extensies): installatie (ZIP/JS/catalogus), eigen ZIP-parser en verwijderen"
```

### Taak 17: i18n-keys voor alle 14 locales

**Files:**
- Modify: `src/i18n/locales/{nl,en,fr,de,es,zh,it,pt,pl,tr,ar,ja,ko,fa}/menu.json` (14 bestanden)

- [ ] **Step 1: Voeg in ELK van de 14 `menu.json`-bestanden een top-level `"extensions"`-object toe** (naast `"ribbon"`, dus als sibling). De waarden per locale:

`nl/menu.json`:
```json
"extensions": {
  "title": "Extensies",
  "subtitle": "Beheer geïnstalleerde extensies of installeer nieuwe.",
  "installedTab": "Geïnstalleerd",
  "browseTab": "Bladeren",
  "installFromZip": "Installeren vanuit ZIP-bestand",
  "installFromJs": "Installeren vanuit JS-bestand",
  "searchPlaceholder": "Zoek extensies...",
  "noExtensions": "Nog geen extensies geïnstalleerd.",
  "noExtensionsHint": "Installeer een extensie via ZIP/JS of blader door de catalogus.",
  "enable": "Inschakelen",
  "disable": "Uitschakelen",
  "remove": "Verwijderen",
  "confirm": "Bevestig",
  "confirmRemoveHint": "Klik nogmaals om definitief te verwijderen",
  "catalogLoading": "Catalogus laden...",
  "catalogError": "Catalogus kon niet geladen worden: ",
  "retry": "Opnieuw proberen",
  "noCatalogResults": "Geen extensies gevonden.",
  "install": "Installeren",
  "installing": "Bezig...",
  "installedBadge": "Geïnstalleerd",
  "import": "Importeren",
  "importSubtitle": "Importeer projectdata via geïnstalleerde extensies.",
  "importEmpty": "Geen import-extensies geïnstalleerd. Voeg er een toe via Extensies."
}
```

`en/menu.json`:
```json
"extensions": {
  "title": "Extensions",
  "subtitle": "Manage installed extensions or install new ones.",
  "installedTab": "Installed",
  "browseTab": "Browse",
  "installFromZip": "Install from ZIP file",
  "installFromJs": "Install from JS file",
  "searchPlaceholder": "Search extensions...",
  "noExtensions": "No extensions installed yet.",
  "noExtensionsHint": "Install an extension from ZIP/JS or browse the catalog.",
  "enable": "Enable",
  "disable": "Disable",
  "remove": "Remove",
  "confirm": "Confirm",
  "confirmRemoveHint": "Click again to remove permanently",
  "catalogLoading": "Loading catalog...",
  "catalogError": "Could not load catalog: ",
  "retry": "Retry",
  "noCatalogResults": "No extensions found.",
  "install": "Install",
  "installing": "Installing...",
  "installedBadge": "Installed",
  "import": "Import",
  "importSubtitle": "Import project data through installed extensions.",
  "importEmpty": "No import extensions installed. Add one via Extensions."
}
```

`fr/menu.json`:
```json
"extensions": {
  "title": "Extensions",
  "subtitle": "Gérez les extensions installées ou installez-en de nouvelles.",
  "installedTab": "Installées",
  "browseTab": "Parcourir",
  "installFromZip": "Installer depuis un fichier ZIP",
  "installFromJs": "Installer depuis un fichier JS",
  "searchPlaceholder": "Rechercher des extensions...",
  "noExtensions": "Aucune extension installée.",
  "noExtensionsHint": "Installez une extension via ZIP/JS ou parcourez le catalogue.",
  "enable": "Activer",
  "disable": "Désactiver",
  "remove": "Supprimer",
  "confirm": "Confirmer",
  "confirmRemoveHint": "Cliquez à nouveau pour supprimer définitivement",
  "catalogLoading": "Chargement du catalogue...",
  "catalogError": "Impossible de charger le catalogue : ",
  "retry": "Réessayer",
  "noCatalogResults": "Aucune extension trouvée.",
  "install": "Installer",
  "installing": "Installation...",
  "installedBadge": "Installée",
  "import": "Importer",
  "importSubtitle": "Importez des données de projet via les extensions installées.",
  "importEmpty": "Aucune extension d'import installée. Ajoutez-en une via Extensions."
}
```

`de/menu.json`:
```json
"extensions": {
  "title": "Erweiterungen",
  "subtitle": "Installierte Erweiterungen verwalten oder neue installieren.",
  "installedTab": "Installiert",
  "browseTab": "Durchsuchen",
  "installFromZip": "Aus ZIP-Datei installieren",
  "installFromJs": "Aus JS-Datei installieren",
  "searchPlaceholder": "Erweiterungen suchen...",
  "noExtensions": "Noch keine Erweiterungen installiert.",
  "noExtensionsHint": "Installieren Sie eine Erweiterung per ZIP/JS oder durchsuchen Sie den Katalog.",
  "enable": "Aktivieren",
  "disable": "Deaktivieren",
  "remove": "Entfernen",
  "confirm": "Bestätigen",
  "confirmRemoveHint": "Erneut klicken, um endgültig zu entfernen",
  "catalogLoading": "Katalog wird geladen...",
  "catalogError": "Katalog konnte nicht geladen werden: ",
  "retry": "Erneut versuchen",
  "noCatalogResults": "Keine Erweiterungen gefunden.",
  "install": "Installieren",
  "installing": "Wird installiert...",
  "installedBadge": "Installiert",
  "import": "Importieren",
  "importSubtitle": "Projektdaten über installierte Erweiterungen importieren.",
  "importEmpty": "Keine Import-Erweiterungen installiert. Fügen Sie eine über Erweiterungen hinzu."
}
```

`es/menu.json`:
```json
"extensions": {
  "title": "Extensiones",
  "subtitle": "Gestiona las extensiones instaladas o instala nuevas.",
  "installedTab": "Instaladas",
  "browseTab": "Explorar",
  "installFromZip": "Instalar desde archivo ZIP",
  "installFromJs": "Instalar desde archivo JS",
  "searchPlaceholder": "Buscar extensiones...",
  "noExtensions": "Aún no hay extensiones instaladas.",
  "noExtensionsHint": "Instala una extensión desde ZIP/JS o explora el catálogo.",
  "enable": "Activar",
  "disable": "Desactivar",
  "remove": "Eliminar",
  "confirm": "Confirmar",
  "confirmRemoveHint": "Haz clic de nuevo para eliminar definitivamente",
  "catalogLoading": "Cargando catálogo...",
  "catalogError": "No se pudo cargar el catálogo: ",
  "retry": "Reintentar",
  "noCatalogResults": "No se encontraron extensiones.",
  "install": "Instalar",
  "installing": "Instalando...",
  "installedBadge": "Instalada",
  "import": "Importar",
  "importSubtitle": "Importa datos de proyecto mediante extensiones instaladas.",
  "importEmpty": "No hay extensiones de importación instaladas. Añade una en Extensiones."
}
```

`zh/menu.json`:
```json
"extensions": {
  "title": "扩展",
  "subtitle": "管理已安装的扩展或安装新扩展。",
  "installedTab": "已安装",
  "browseTab": "浏览",
  "installFromZip": "从 ZIP 文件安装",
  "installFromJs": "从 JS 文件安装",
  "searchPlaceholder": "搜索扩展...",
  "noExtensions": "尚未安装任何扩展。",
  "noExtensionsHint": "通过 ZIP/JS 安装扩展，或浏览扩展目录。",
  "enable": "启用",
  "disable": "禁用",
  "remove": "移除",
  "confirm": "确认",
  "confirmRemoveHint": "再次点击以永久移除",
  "catalogLoading": "正在加载目录...",
  "catalogError": "无法加载目录：",
  "retry": "重试",
  "noCatalogResults": "未找到扩展。",
  "install": "安装",
  "installing": "正在安装...",
  "installedBadge": "已安装",
  "import": "导入",
  "importSubtitle": "通过已安装的扩展导入项目数据。",
  "importEmpty": "未安装导入扩展。请通过“扩展”添加。"
}
```

`it/menu.json`:
```json
"extensions": {
  "title": "Estensioni",
  "subtitle": "Gestisci le estensioni installate o installane di nuove.",
  "installedTab": "Installate",
  "browseTab": "Sfoglia",
  "installFromZip": "Installa da file ZIP",
  "installFromJs": "Installa da file JS",
  "searchPlaceholder": "Cerca estensioni...",
  "noExtensions": "Nessuna estensione installata.",
  "noExtensionsHint": "Installa un'estensione da ZIP/JS o sfoglia il catalogo.",
  "enable": "Attiva",
  "disable": "Disattiva",
  "remove": "Rimuovi",
  "confirm": "Conferma",
  "confirmRemoveHint": "Fai clic di nuovo per rimuovere definitivamente",
  "catalogLoading": "Caricamento catalogo...",
  "catalogError": "Impossibile caricare il catalogo: ",
  "retry": "Riprova",
  "noCatalogResults": "Nessuna estensione trovata.",
  "install": "Installa",
  "installing": "Installazione...",
  "installedBadge": "Installata",
  "import": "Importa",
  "importSubtitle": "Importa dati di progetto tramite le estensioni installate.",
  "importEmpty": "Nessuna estensione di importazione installata. Aggiungine una tramite Estensioni."
}
```

`pt/menu.json`:
```json
"extensions": {
  "title": "Extensões",
  "subtitle": "Gerencie as extensões instaladas ou instale novas.",
  "installedTab": "Instaladas",
  "browseTab": "Explorar",
  "installFromZip": "Instalar de arquivo ZIP",
  "installFromJs": "Instalar de arquivo JS",
  "searchPlaceholder": "Pesquisar extensões...",
  "noExtensions": "Nenhuma extensão instalada ainda.",
  "noExtensionsHint": "Instale uma extensão via ZIP/JS ou explore o catálogo.",
  "enable": "Ativar",
  "disable": "Desativar",
  "remove": "Remover",
  "confirm": "Confirmar",
  "confirmRemoveHint": "Clique novamente para remover definitivamente",
  "catalogLoading": "Carregando catálogo...",
  "catalogError": "Não foi possível carregar o catálogo: ",
  "retry": "Tentar novamente",
  "noCatalogResults": "Nenhuma extensão encontrada.",
  "install": "Instalar",
  "installing": "Instalando...",
  "installedBadge": "Instalada",
  "import": "Importar",
  "importSubtitle": "Importe dados de projeto por meio das extensões instaladas.",
  "importEmpty": "Nenhuma extensão de importação instalada. Adicione uma em Extensões."
}
```

`pl/menu.json`:
```json
"extensions": {
  "title": "Rozszerzenia",
  "subtitle": "Zarządzaj zainstalowanymi rozszerzeniami lub instaluj nowe.",
  "installedTab": "Zainstalowane",
  "browseTab": "Przeglądaj",
  "installFromZip": "Zainstaluj z pliku ZIP",
  "installFromJs": "Zainstaluj z pliku JS",
  "searchPlaceholder": "Szukaj rozszerzeń...",
  "noExtensions": "Nie zainstalowano jeszcze żadnych rozszerzeń.",
  "noExtensionsHint": "Zainstaluj rozszerzenie z pliku ZIP/JS lub przeglądaj katalog.",
  "enable": "Włącz",
  "disable": "Wyłącz",
  "remove": "Usuń",
  "confirm": "Potwierdź",
  "confirmRemoveHint": "Kliknij ponownie, aby trwale usunąć",
  "catalogLoading": "Ładowanie katalogu...",
  "catalogError": "Nie można załadować katalogu: ",
  "retry": "Spróbuj ponownie",
  "noCatalogResults": "Nie znaleziono rozszerzeń.",
  "install": "Zainstaluj",
  "installing": "Instalowanie...",
  "installedBadge": "Zainstalowane",
  "import": "Importuj",
  "importSubtitle": "Importuj dane projektu za pomocą zainstalowanych rozszerzeń.",
  "importEmpty": "Brak rozszerzeń importu. Dodaj je w sekcji Rozszerzenia."
}
```

`tr/menu.json`:
```json
"extensions": {
  "title": "Uzantılar",
  "subtitle": "Yüklü uzantıları yönetin veya yenilerini yükleyin.",
  "installedTab": "Yüklü",
  "browseTab": "Gözat",
  "installFromZip": "ZIP dosyasından yükle",
  "installFromJs": "JS dosyasından yükle",
  "searchPlaceholder": "Uzantı ara...",
  "noExtensions": "Henüz yüklü uzantı yok.",
  "noExtensionsHint": "ZIP/JS ile bir uzantı yükleyin veya kataloğa göz atın.",
  "enable": "Etkinleştir",
  "disable": "Devre dışı bırak",
  "remove": "Kaldır",
  "confirm": "Onayla",
  "confirmRemoveHint": "Kalıcı olarak kaldırmak için tekrar tıklayın",
  "catalogLoading": "Katalog yükleniyor...",
  "catalogError": "Katalog yüklenemedi: ",
  "retry": "Tekrar dene",
  "noCatalogResults": "Uzantı bulunamadı.",
  "install": "Yükle",
  "installing": "Yükleniyor...",
  "installedBadge": "Yüklü",
  "import": "İçe aktar",
  "importSubtitle": "Yüklü uzantılar aracılığıyla proje verilerini içe aktarın.",
  "importEmpty": "İçe aktarma uzantısı yüklü değil. Uzantılar bölümünden ekleyin."
}
```

`ar/menu.json`:
```json
"extensions": {
  "title": "الإضافات",
  "subtitle": "إدارة الإضافات المثبّتة أو تثبيت إضافات جديدة.",
  "installedTab": "مثبّتة",
  "browseTab": "تصفّح",
  "installFromZip": "تثبيت من ملف ZIP",
  "installFromJs": "تثبيت من ملف JS",
  "searchPlaceholder": "البحث عن إضافات...",
  "noExtensions": "لا توجد إضافات مثبّتة بعد.",
  "noExtensionsHint": "ثبّت إضافة من ملف ZIP/JS أو تصفّح الكتالوج.",
  "enable": "تفعيل",
  "disable": "تعطيل",
  "remove": "إزالة",
  "confirm": "تأكيد",
  "confirmRemoveHint": "انقر مرة أخرى للإزالة نهائيًا",
  "catalogLoading": "جارٍ تحميل الكتالوج...",
  "catalogError": "تعذّر تحميل الكتالوج: ",
  "retry": "إعادة المحاولة",
  "noCatalogResults": "لم يتم العثور على إضافات.",
  "install": "تثبيت",
  "installing": "جارٍ التثبيت...",
  "installedBadge": "مثبّتة",
  "import": "استيراد",
  "importSubtitle": "استيراد بيانات المشروع عبر الإضافات المثبّتة.",
  "importEmpty": "لا توجد إضافات استيراد مثبّتة. أضف واحدة عبر الإضافات."
}
```

`ja/menu.json`:
```json
"extensions": {
  "title": "拡張機能",
  "subtitle": "インストール済みの拡張機能を管理、または新規インストール。",
  "installedTab": "インストール済み",
  "browseTab": "参照",
  "installFromZip": "ZIP ファイルからインストール",
  "installFromJs": "JS ファイルからインストール",
  "searchPlaceholder": "拡張機能を検索...",
  "noExtensions": "拡張機能はまだインストールされていません。",
  "noExtensionsHint": "ZIP/JS から拡張機能をインストールするか、カタログを参照してください。",
  "enable": "有効化",
  "disable": "無効化",
  "remove": "削除",
  "confirm": "確認",
  "confirmRemoveHint": "もう一度クリックすると完全に削除されます",
  "catalogLoading": "カタログを読み込み中...",
  "catalogError": "カタログを読み込めませんでした: ",
  "retry": "再試行",
  "noCatalogResults": "拡張機能が見つかりません。",
  "install": "インストール",
  "installing": "インストール中...",
  "installedBadge": "インストール済み",
  "import": "インポート",
  "importSubtitle": "インストール済みの拡張機能でプロジェクトデータをインポート。",
  "importEmpty": "インポート用拡張機能がありません。拡張機能から追加してください。"
}
```

`ko/menu.json`:
```json
"extensions": {
  "title": "확장 프로그램",
  "subtitle": "설치된 확장 프로그램을 관리하거나 새로 설치합니다.",
  "installedTab": "설치됨",
  "browseTab": "찾아보기",
  "installFromZip": "ZIP 파일에서 설치",
  "installFromJs": "JS 파일에서 설치",
  "searchPlaceholder": "확장 프로그램 검색...",
  "noExtensions": "아직 설치된 확장 프로그램이 없습니다.",
  "noExtensionsHint": "ZIP/JS로 확장 프로그램을 설치하거나 카탈로그를 둘러보세요.",
  "enable": "사용",
  "disable": "사용 안 함",
  "remove": "제거",
  "confirm": "확인",
  "confirmRemoveHint": "완전히 제거하려면 다시 클릭하세요",
  "catalogLoading": "카탈로그 불러오는 중...",
  "catalogError": "카탈로그를 불러올 수 없습니다: ",
  "retry": "다시 시도",
  "noCatalogResults": "확장 프로그램을 찾을 수 없습니다.",
  "install": "설치",
  "installing": "설치 중...",
  "installedBadge": "설치됨",
  "import": "가져오기",
  "importSubtitle": "설치된 확장 프로그램으로 프로젝트 데이터를 가져옵니다.",
  "importEmpty": "가져오기 확장 프로그램이 없습니다. 확장 프로그램에서 추가하세요."
}
```

`fa/menu.json`:
```json
"extensions": {
  "title": "افزونه‌ها",
  "subtitle": "مدیریت افزونه‌های نصب‌شده یا نصب افزونه‌های جدید.",
  "installedTab": "نصب‌شده",
  "browseTab": "مرور",
  "installFromZip": "نصب از فایل ZIP",
  "installFromJs": "نصب از فایل JS",
  "searchPlaceholder": "جستجوی افزونه‌ها...",
  "noExtensions": "هنوز افزونه‌ای نصب نشده است.",
  "noExtensionsHint": "افزونه‌ای را از ZIP/JS نصب کنید یا کاتالوگ را مرور کنید.",
  "enable": "فعال‌سازی",
  "disable": "غیرفعال‌سازی",
  "remove": "حذف",
  "confirm": "تأیید",
  "confirmRemoveHint": "برای حذف دائمی دوباره کلیک کنید",
  "catalogLoading": "در حال بارگیری کاتالوگ...",
  "catalogError": "کاتالوگ بارگیری نشد: ",
  "retry": "تلاش دوباره",
  "noCatalogResults": "افزونه‌ای یافت نشد.",
  "install": "نصب",
  "installing": "در حال نصب...",
  "installedBadge": "نصب‌شده",
  "import": "درون‌ریزی",
  "importSubtitle": "درون‌ریزی داده‌های پروژه از طریق افزونه‌های نصب‌شده.",
  "importEmpty": "افزونه درون‌ریزی نصب نشده است. از بخش افزونه‌ها اضافه کنید."
}
```

- [ ] **Step 2: Valideer alle JSON-bestanden:**

Run: `for f in src/i18n/locales/*/menu.json; do python3 -c "import json; json.load(open('$f'))" || echo "FOUT: $f"; done`
Verwacht: geen output (alle bestanden valide).

- [ ] **Step 3: Build** — `npm run build`, verwacht groen.
- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/*/menu.json
git commit -m "feat(extensies): i18n-keys voor extensiebeheer in alle 14 locales"
```

### Taak 18: ExtensionManagerPanel + CSS

**Files:**
- Create: `src/components/backstage/ExtensionManagerPanel.tsx`
- Create: `src/components/backstage/ExtensionManagerPanel.css`

- [ ] **Step 1: Maak `src/components/backstage/ExtensionManagerPanel.tsx`:**

```tsx
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import {
  enableExtension,
  disableExtension,
  removeExtension,
  installFromFile,
  installFromJsFile,
  fetchCatalog,
  installFromCatalog,
} from '@/extensions';
import type { InstalledExtension, CatalogEntry, ExtensionCategory } from '@/extensions/types';
import { Puzzle, FileArchive, FileCode, Plus } from 'lucide-react';
import './ExtensionManagerPanel.css';

type TabId = 'installed' | 'browse';

const CATEGORY_COLORS: Record<ExtensionCategory, string> = {
  'Import/Export': '#06b6d4',
  Planning: '#3b82f6',
  Reporting: '#8b5cf6',
  Utility: '#6b7280',
  Other: '#6b7280',
};

export function ExtensionManagerPanel() {
  const { t } = useTranslation('menu');
  const [activeTab, setActiveTab] = useState<TabId>('installed');
  const [search, setSearch] = useState('');

  return (
    <div className="ext-manager">
      <div className="ext-manager-toolbar">
        <div className="ext-manager-tabs">
          <button
            className={`ext-tab ${activeTab === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            {t('extensions.installedTab')}
          </button>
          <button
            className={`ext-tab ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => { setActiveTab('browse'); void fetchCatalog(); }}
          >
            {t('extensions.browseTab')}
          </button>
        </div>

        <div className="ext-manager-actions">
          <button className="ext-install-btn" onClick={() => void installFromFile()} title={t('extensions.installFromZip')}>
            <FileArchive size={14} /> ZIP
          </button>
          <button className="ext-install-btn" onClick={() => void installFromJsFile()} title={t('extensions.installFromJs')}>
            <FileCode size={14} /> JS
          </button>
        </div>
      </div>

      <input
        className="ext-search"
        type="text"
        placeholder={t('extensions.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {activeTab === 'installed' && <InstalledTab search={search} />}
      {activeTab === 'browse' && <BrowseTab search={search} />}
    </div>
  );
}

function InstalledTab({ search }: { search: string }) {
  const { t } = useTranslation('menu');
  const extensions = useAppStore((s) => s.installedExtensions);
  const list = Object.values(extensions);

  const filtered = list.filter((ext) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      ext.manifest.name.toLowerCase().includes(q) ||
      ext.manifest.description.toLowerCase().includes(q) ||
      ext.manifest.author.toLowerCase().includes(q) ||
      ext.manifest.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="ext-empty">
        <p>{t('extensions.noExtensions')}</p>
        <p className="ext-empty-hint">{t('extensions.noExtensionsHint')}</p>
      </div>
    );
  }

  return (
    <div className="ext-list">
      {filtered.map((ext) => (
        <InstalledExtensionCard key={ext.id} ext={ext} />
      ))}
    </div>
  );
}

function InstalledExtensionCard({ ext }: { ext: InstalledExtension }) {
  const { t } = useTranslation('menu');
  const [removing, setRemoving] = useState(false);

  const handleToggle = useCallback(async () => {
    if (ext.status === 'enabled') {
      await disableExtension(ext.id);
    } else {
      await enableExtension(ext.id);
    }
  }, [ext.id, ext.status]);

  const handleRemove = useCallback(async () => {
    if (!removing) {
      setRemoving(true);
      return;
    }
    await removeExtension(ext.id);
  }, [ext.id, removing]);

  const isEnabled = ext.status === 'enabled';
  const isLoading = ext.status === 'loading';
  const isError = ext.status === 'error';

  return (
    <div className={`ext-card ${isError ? 'ext-card-error' : ''}`}>
      <div className="ext-card-icon">
        {ext.manifest.icon ? (
          <span dangerouslySetInnerHTML={{ __html: ext.manifest.icon }} />
        ) : (
          <Puzzle size={24} />
        )}
      </div>

      <div className="ext-card-body">
        <div className="ext-card-header">
          <span className="ext-card-name">{ext.manifest.name}</span>
          <span className="ext-card-version">v{ext.manifest.version}</span>
          <span
            className="ext-card-category"
            style={{ color: CATEGORY_COLORS[ext.manifest.category] || '#6b7280' }}
          >
            {ext.manifest.category}
          </span>
        </div>
        <p className="ext-card-desc">{ext.manifest.description}</p>
        <span className="ext-card-author">{ext.manifest.author}</span>
        {isError && ext.error && <p className="ext-card-error-msg">{ext.error}</p>}
      </div>

      <div className="ext-card-actions">
        <button
          className={`ext-toggle ${isEnabled ? 'ext-toggle-on' : ''}`}
          onClick={() => void handleToggle()}
          disabled={isLoading}
          title={isEnabled ? t('extensions.disable') : t('extensions.enable')}
        >
          <div className="ext-toggle-track">
            <div className="ext-toggle-thumb" />
          </div>
        </button>
        <button
          className={`ext-remove-btn ${removing ? 'ext-remove-confirm' : ''}`}
          onClick={() => void handleRemove()}
          title={removing ? t('extensions.confirmRemoveHint') : t('extensions.remove')}
        >
          {removing ? t('extensions.confirm') : t('extensions.remove')}
        </button>
      </div>
    </div>
  );
}

function BrowseTab({ search }: { search: string }) {
  const { t } = useTranslation('menu');
  const catalogEntries = useAppStore((s) => s.catalogEntries);
  const catalogLoading = useAppStore((s) => s.catalogLoading);
  const catalogError = useAppStore((s) => s.catalogError);
  const installed = useAppStore((s) => s.installedExtensions);

  const filtered = catalogEntries.filter((entry) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      entry.name.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.author.toLowerCase().includes(q) ||
      entry.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  if (catalogLoading) {
    return <div className="ext-empty"><p>{t('extensions.catalogLoading')}</p></div>;
  }

  if (catalogError) {
    return (
      <div className="ext-empty">
        <p>{t('extensions.catalogError')}{catalogError}</p>
        <button
          className="ext-install-btn"
          onClick={() => void fetchCatalog()}
          style={{ marginTop: 8 }}
        >
          {t('extensions.retry')}
        </button>
      </div>
    );
  }

  if (filtered.length === 0) {
    return <div className="ext-empty"><p>{t('extensions.noCatalogResults')}</p></div>;
  }

  return (
    <div className="ext-list">
      {filtered.map((entry) => (
        <CatalogCard key={entry.id} entry={entry} isInstalled={!!installed[entry.id]} />
      ))}
    </div>
  );
}

function CatalogCard({ entry, isInstalled }: { entry: CatalogEntry; isInstalled: boolean }) {
  const { t } = useTranslation('menu');
  const [installing, setInstalling] = useState(false);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    await installFromCatalog(entry);
    setInstalling(false);
  }, [entry]);

  return (
    <div className="ext-card">
      <div className="ext-card-icon">
        {entry.icon ? (
          <span dangerouslySetInnerHTML={{ __html: entry.icon }} />
        ) : (
          <Plus size={24} />
        )}
      </div>

      <div className="ext-card-body">
        <div className="ext-card-header">
          <span className="ext-card-name">{entry.name}</span>
          <span className="ext-card-version">v{entry.version}</span>
          <span
            className="ext-card-category"
            style={{ color: CATEGORY_COLORS[entry.category] || '#6b7280' }}
          >
            {entry.category}
          </span>
        </div>
        <p className="ext-card-desc">{entry.description}</p>
        <span className="ext-card-author">{entry.author}</span>
      </div>

      <div className="ext-card-actions">
        {isInstalled ? (
          <span className="ext-installed-badge">{t('extensions.installedBadge')}</span>
        ) : (
          <button
            className="ext-install-btn"
            onClick={() => void handleInstall()}
            disabled={installing}
          >
            {installing ? t('extensions.installing') : t('extensions.install')}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Maak `src/components/backstage/ExtensionManagerPanel.css`** (gebruikt de bestaande `--theme-*`-variabelen van de Backstage):

```css
/* Extensiebeheer — volgt de Backstage-stijl (--theme-* tokens) */
.ext-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
}

.ext-manager-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ext-manager-tabs {
  display: flex;
  gap: 4px;
}

.ext-tab {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--theme-border-light);
  border-radius: var(--radius-md);
  color: var(--theme-text-dim);
  font-size: 12px;
  cursor: pointer;
}

.ext-tab.active {
  background: var(--theme-accent);
  color: var(--theme-accent-on);
  border-color: var(--theme-accent);
}

.ext-manager-actions {
  display: flex;
  gap: 6px;
}

.ext-install-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: var(--theme-input-bg);
  border: 1px solid var(--theme-border-light);
  border-radius: var(--radius-md);
  color: var(--theme-text);
  font-size: 11px;
  cursor: pointer;
}

.ext-install-btn:hover { background: var(--theme-hover); }
.ext-install-btn:disabled { opacity: 0.5; cursor: default; }

.ext-search {
  padding: 6px 10px;
  background: var(--theme-input-bg);
  border: 1px solid var(--theme-border-light);
  border-radius: var(--radius-md);
  color: var(--theme-text);
  font-size: 12px;
}

.ext-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ext-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--theme-surface-alt);
  border: 1px solid var(--theme-border-light);
  border-radius: var(--radius-md);
}

.ext-card-error { border-color: #dc2626; }

.ext-card-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-accent);
}

.ext-card-icon svg { width: 24px; height: 24px; }

.ext-card-body { flex: 1; min-width: 0; }

.ext-card-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.ext-card-name { font-weight: 600; color: var(--theme-text); font-size: 13px; }
.ext-card-version { font-size: 11px; color: var(--theme-text-dim); }
.ext-card-category { font-size: 10px; font-weight: 600; text-transform: uppercase; }

.ext-card-desc {
  margin: 4px 0;
  font-size: 12px;
  color: var(--theme-text-dim);
}

.ext-card-author { font-size: 11px; color: var(--theme-text-muted); }

.ext-card-error-msg {
  margin: 4px 0 0;
  font-size: 11px;
  color: #dc2626;
}

.ext-card-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

/* Aan/uit-schakelaar */
.ext-toggle {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}
.ext-toggle:disabled { opacity: 0.5; cursor: default; }

.ext-toggle-track {
  width: 34px;
  height: 18px;
  border-radius: 9px;
  background: var(--theme-border-light);
  position: relative;
  transition: background 0.15s;
}

.ext-toggle-on .ext-toggle-track { background: var(--theme-accent); }

.ext-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--theme-bg);
  transition: left 0.15s;
}

.ext-toggle-on .ext-toggle-thumb { left: 18px; }

.ext-remove-btn {
  padding: 3px 8px;
  background: transparent;
  border: 1px solid var(--theme-border-light);
  border-radius: var(--radius-md);
  color: var(--theme-text-dim);
  font-size: 10px;
  cursor: pointer;
}

.ext-remove-confirm {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

.ext-installed-badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-accent);
  text-transform: uppercase;
}

.ext-empty {
  padding: 32px;
  text-align: center;
  color: var(--theme-text-dim);
  font-size: 12px;
}

.ext-empty-hint { font-size: 11px; color: var(--theme-text-muted); }
```

- [ ] **Step 3: Build** — `npm run build`, verwacht groen (het paneel is nog niet gemount; ongebruikte exports zijn geen tsc-fout).
- [ ] **Step 4: Commit**

```bash
git add src/components/backstage/ExtensionManagerPanel.tsx src/components/backstage/ExtensionManagerPanel.css
git commit -m "feat(extensies): ExtensionManagerPanel (geïnstalleerd/bladeren, ZIP/JS-installatie)"
```

### Taak 19: Backstage-secties 'extensions' en 'import'

**Files:**
- Modify: `src/state/slices/types.ts` (BackstageSection)
- Modify: `src/components/backstage/Backstage.tsx`

- [ ] **Step 1: Breid `BackstageSection` uit in `src/state/slices/types.ts`:**

```ts
export type BackstageSection =
  | 'recent'
  | 'export'
  | 'import'
  | 'print'
  | 'project-info'
  | 'settings'
  | 'extensions';
```

- [ ] **Step 2: Pas `src/components/backstage/Backstage.tsx` aan.**

a) Imports uitbreiden:

```ts
import {
  ArrowLeft, FileText, FolderOpen, Clock, Save, SaveAll, Download,
  Printer, Info, Settings, X, FileType, Puzzle, Upload,
} from 'lucide-react';
import { ExtensionManagerPanel } from '@/components/backstage/ExtensionManagerPanel';
import type { ExtensionImporter } from '@/state/slices/extensionSlice';
```

b) In de sidebar, direct ná de regel met `label="Exporteren"`, toevoegen:

```tsx
<NavItem icon={<Upload size={14} />} label={tMenu('extensions.import')} active={section === 'import'} onClick={() => goTo('import')} />
```

c) In de sidebar, direct ná de regel met `label="Instellingen"`, toevoegen:

```tsx
<NavItem icon={<Puzzle size={14} />} label={tMenu('extensions.title')} active={section === 'extensions'} onClick={() => goTo('extensions')} />
```

d) In `<main className="backstage-main">` twee regels toevoegen:

```tsx
{section === 'import' && <ImportSection />}
{section === 'extensions' && <ExtensionsSection />}
```

e) Onderaan het bestand twee secties toevoegen:

```tsx
// ---------------------------------------------------------------------------
// Import section — importers geregistreerd door extensies
// ---------------------------------------------------------------------------

function ImportSection() {
  const { t: tMenu } = useTranslation('menu');
  const importers = useAppStore(s => s.extensionImporters);
  const loadState = useAppStore(s => s.loadState);
  const runCPM = useAppStore(s => s.runCPM);
  const setUI = useAppStore(s => s.setUI);

  const handleImport = (imp: ExtensionImporter) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = imp.fileExtensions.join(',');
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const result = await imp.handler(file);
        loadState(result);
        runCPM();
        setUI({ activeRibbonTab: 'start' });
      } catch (err) {
        console.error('[Extensies] Import mislukt:', err);
      }
    };
    input.click();
  };

  return (
    <>
      <h2 className="backstage-title">{tMenu('extensions.import')}</h2>
      <p className="backstage-subtitle">{tMenu('extensions.importSubtitle')}</p>
      {importers.length === 0 ? (
        <div className="backstage-empty">{tMenu('extensions.importEmpty')}</div>
      ) : (
        <div className="backstage-export-grid">
          {importers.map(imp => (
            <button key={`${imp.extensionId}:${imp.id}`} className="backstage-export-card" onClick={() => handleImport(imp)}>
              <span className="backstage-export-icon">{imp.icon ? <span dangerouslySetInnerHTML={{ __html: imp.icon }} /> : <Upload size={20} />}</span>
              <span className="backstage-export-info">
                <h4>{imp.name}</h4>
                <p>{imp.description} ({imp.fileExtensions.join(', ')})</p>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Extensies section
// ---------------------------------------------------------------------------

function ExtensionsSection() {
  const { t: tMenu } = useTranslation('menu');
  return (
    <>
      <h2 className="backstage-title">{tMenu('extensions.title')}</h2>
      <p className="backstage-subtitle">{tMenu('extensions.subtitle')}</p>
      <ExtensionManagerPanel />
    </>
  );
}
```

- [ ] **Step 3: Build** — `npm run build`, verwacht groen.
- [ ] **Step 4: Commit**

```bash
git add src/state/slices/types.ts src/components/backstage/Backstage.tsx
git commit -m "feat(extensies): Backstage-secties Extensies en Importeren"
```

### Taak 20: Ribbon — extensie-knoppen renderen

**Files:**
- Modify: `src/components/layout/Ribbon/Ribbon.tsx`

- [ ] **Step 1: Voeg `Puzzle` toe aan de lucide-import** (in de bestaande import-lijst bovenaan).

- [ ] **Step 2: Voeg boven `export function Ribbon()` een component toe:**

```tsx
/**
 * Extensie-knoppen: door extensies geregistreerde ribbon-knoppen, gegroepeerd
 * per groepslabel, achteraan de actieve tab gerenderd.
 */
function ExtensionRibbonGroups({ tab }: { tab: RibbonTab }) {
  const buttons = useAppStore(s => s.extensionRibbonButtons);
  const forTab = buttons.filter(b => b.tab === tab);
  if (forTab.length === 0) return null;

  const groups = new Map<string, typeof forTab>();
  for (const b of forTab) {
    const list = groups.get(b.group) ?? [];
    list.push(b);
    groups.set(b.group, list);
  }

  return (
    <>
      {[...groups.entries()].map(([group, btns]) => (
        <span key={group} style={{ display: 'contents' }}>
          <div className="ribbon-separator" />
          <RibbonGroup label={group}>
            {btns.map(b => (
              <RibbonButton
                key={`${b.extensionId}:${b.label}`}
                label={b.label}
                icon={
                  b.icon
                    ? <span style={{ display: 'inline-flex', width: 20, height: 20 }} dangerouslySetInnerHTML={{ __html: b.icon }} />
                    : <Puzzle size={20} />
                }
                onClick={b.onClick}
              />
            ))}
          </RibbonGroup>
        </span>
      ))}
    </>
  );
}
```

- [ ] **Step 3: Render de component.** In `Ribbon()`, binnen `<div className="ribbon-content">`, direct vóór de sluitende `</div>` van dat content-blok (dus ná het `{activeTab === 'report' && (...)}`-blok), toevoegen:

```tsx
<ExtensionRibbonGroups tab={activeTab} />
```

- [ ] **Step 4: Build** — `npm run build`, verwacht groen.
- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Ribbon/Ribbon.tsx
git commit -m "feat(extensies): extensie-knoppen renderen in de ribbon"
```

### Taak 21: Bootstrap in App.tsx + devBridge-testhaken

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/utils/devBridge.ts`

- [ ] **Step 1: Bootstrap.** In `src/App.tsx`: voeg de import toe en roep de loader aan in de bestaande init-`useEffect` (die met `initLocale()`):

```ts
import { loadAllExtensions } from '@/extensions';
```

en in de useEffect-body, na `loadDebugTerminalEnabled().then(...)`:

```ts
    void loadAllExtensions();
```

- [ ] **Step 2: devBridge.** In `src/utils/devBridge.ts`:

a) Imports toevoegen:

```ts
import { enableExtension, disableExtension, removeExtension, saveExtensionToDb } from '@/extensions';
import type { ExtensionManifest, InstalledExtension } from '@/extensions/types';
```

b) Boven `interface OpsCommand` een testhaak toevoegen:

```ts
/** Dev-only: installeer een extensie direct vanuit een code-string (voor zelftests). */
async function installExtensionFromCode(
  manifest: ExtensionManifest,
  mainCode: string,
): Promise<InstalledExtension | undefined> {
  await saveExtensionToDb({ id: manifest.id, manifest, mainCode, enabled: true });
  useAppStore.getState().registerExtension({ id: manifest.id, manifest, status: 'disabled' });
  await enableExtension(manifest.id);
  return useAppStore.getState().installedExtensions[manifest.id];
}
```

c) `OpsDevBridge`-interface uitbreiden met:

```ts
  /** Dev-only extensie-haken voor zelftests. */
  extensions: {
    installFromCode: typeof installExtensionFromCode;
    enable: typeof enableExtension;
    disable: typeof disableExtension;
    remove: typeof removeExtension;
  };
```

d) In `installDevBridge()` het object uitbreiden:

```ts
  window.__OPS__ = {
    store: useAppStore,
    log: appLog,
    roundTrip,
    saveToPath,
    openFromPath,
    extensions: {
      installFromCode: installExtensionFromCode,
      enable: enableExtension,
      disable: disableExtension,
      remove: removeExtension,
    },
  };
```

- [ ] **Step 3: Build** — `npm run build`, verwacht groen.
- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/utils/devBridge.ts
git commit -m "feat(extensies): laden bij opstarten + devBridge-haken voor zelftests"
```

### Taak 22: Zelftest via Playwright MCP (Tier 1)

Geen bestandswijzigingen — dit is de verificatietaak conform `docs/self-test-harness.md`. Browser-build, asserties via store-state.

- [ ] **Step 1: Start de dev-server op de achtergrond:** `npm run dev` (poort 3007 of `OPS_DEV_PORT`).
- [ ] **Step 2: Navigeer met Playwright MCP naar `http://localhost:3007`.**
- [ ] **Step 3: Installeer een testextensie via `browser_evaluate`:**

```js
await window.__OPS__.extensions.installFromCode(
  {
    id: 'zelftest-extensie',
    name: 'Zelftest Extensie',
    version: '1.0.0',
    minAppVersion: '0.0.0',
    author: 'Zelftest',
    description: 'Testextensie voor de zelftest-harness',
    category: 'Utility',
    main: 'main.js',
    permissions: ['ribbon', 'events'],
  },
  `
  module.exports = {
    onLoad(api) {
      api.importers.register({
        id: 'zelftest-import',
        name: 'Zelftest Import',
        description: 'Dummy importer',
        fileExtensions: ['.zt'],
        handler: async () => { throw new Error('dummy'); },
      });
      api.ui.addRibbonButton({
        tab: 'start',
        group: 'Zelftest',
        label: 'Test',
        onClick: () => { window.__zelftestClicked = true; },
      });
      api.settings.set('begroet', true);
      api.ui.showNotification('Zelftest geladen');
    },
    onUnload() {},
  };
  `
);
return JSON.stringify(window.__OPS__.store.getState().installedExtensions['zelftest-extensie']);
```

Verwacht: status `"enabled"`.

- [ ] **Step 4: Assert registraties via `browser_evaluate`:**

```js
const s = window.__OPS__.store.getState();
return JSON.stringify({
  importers: s.extensionImporters.map(i => i.id),
  ribbon: s.extensionRibbonButtons.map(b => `${b.tab}/${b.group}/${b.label}`),
  setting: localStorage.getItem('ops-ext:zelftest-extensie:begroet'),
});
```

Verwacht: `importers` bevat `zelftest-import`, `ribbon` bevat `start/Zelftest/Test`, `setting` is `"true"`.

- [ ] **Step 5: Controleer de UI.** Maak een snapshot van de Start-ribbon — verwacht een groep "Zelftest" met knop "Test". Klik de knop; assert `window.__zelftestClicked === true`. Navigeer naar Bestand → Extensies (klik File-tab, dan Extensies in de sidebar) — verwacht de kaart "Zelftest Extensie" met aan-knop. Naar Importeren — verwacht de kaart "Zelftest Import".
- [ ] **Step 6: Disable-pad.** Via `browser_evaluate`: `await window.__OPS__.extensions.disable('zelftest-extensie')`; assert dat `extensionImporters` en `extensionRibbonButtons` leeg zijn en status `"disabled"` is. Herlaad de pagina; assert dat de extensie geregistreerd blijft (IndexedDB) maar uit blijft.
- [ ] **Step 7: Opruimen.** `await window.__OPS__.extensions.remove('zelftest-extensie')`; assert `installedExtensions` leeg. Stop de dev-server.
- [ ] **Step 8: Los eventuele gevonden problemen op** (fix → build → opnieuw testen) en commit fixes met passende berichten.

### Taak 23: Documentatie

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/TODO.md`
- Create: `docs/extensions.md`

- [ ] **Step 1: CLAUDE.md — vervang de sectie "### State: one Zustand + Immer store"** (de eerste alinea; de alinea over scheduling/undo blijft staan) door:

```markdown
### State: één Zustand + Immer store, samengesteld uit slices

`src/state/appStore.ts` is een compositie-root: `create<AppState>()(immer(...))` spreidt tien slice-creators uit `src/state/slices/` (project, task, sequence, resource, schedule, history, view, ui, file, extension). Elke slice is getypeerd als `AppSlice<XSlice>` (zie `slices/types.ts`) tegen de **volledige** `AppState`, zodat cross-slice acties (runCPM, undo/redo, newProject, file-I/O) gewoon de hele Immer-draft muteren. Nieuwe state/acties horen in de passende slice; `slices/types.ts` bevat daarnaast gedeelde type/enum-definities (`ViewState`, `UIState`, …). Domain-types staan in `src/types/`. De renderer leest alleen uit de store.
```

- [ ] **Step 2: CLAUDE.md — voeg na de sectie "### Settings persistence" een nieuwe sectie toe:**

```markdown
### Extensiesysteem

Naar het model van Open Calc Studio (`OpenAEC-Foundation/open-calc-studio`): een extensie is een ZIP (of los `.js`) met `manifest.json` + `main.js` (CommonJS, exporteert `onLoad(api)`/`onUnload()`). Volledig frontend — geen Rust. Code in `src/extensions/` (types, api, loader, service), state in `extensionSlice`. Opslag: IndexedDB `ops-extensions`; uitvoering: `new Function(...)`-sandbox waarvan `require()` alleen `'open-planner-studio'` teruggeeft; permissies (`ribbon`, `events`, …) worden per API-call afgedwongen. UI: Backstage → Extensies (beheer/installeren/catalogus) en Backstage → Importeren (extensie-importers); extensie-ribbon-knoppen renderen via `ExtensionRibbonGroups`. Catalogus: `open-planner-studio-extensions/catalog.json` op GitHub raw (30 min cache). Extensies zijn app-niveau data (geen projectdata) — geen IFC-round-trip-impact; importer-resultaten (`ImportResult`) zijn gewone store-data. Zelftest-haken: `window.__OPS__.extensions.*` (dev-only). Auteurshandleiding: `docs/extensions.md`.
```

- [ ] **Step 3: `docs/CHANGELOG.md`** — voeg bovenaan (onder de titel, boven de vorige entry) toe, met de stijl van het bestand:

```markdown
## 2026-06-12

- **Store-architectuur**: de monolithische Zustand-store is opgesplitst in tien slices (`src/state/slices/`); `appStore.ts` is nu een compositie-root. Geen gedragswijziging.
- **Extensiesysteem**: extensies (manifest + main.js, als ZIP/JS of uit de catalogus) kunnen importers en ribbon-knoppen registreren. Beheer via Bestand → Extensies; importeren via Bestand → Importeren. Naar het model van Open Calc Studio.
```

(Als het bestand een andere kopstructuur gebruikt: volg die.)

- [ ] **Step 4: `docs/TODO.md`** — voeg toe aan de lijst:

```markdown
- [ ] GitHub-repo `OpenAEC-Foundation/open-planner-studio-extensions` aanmaken met `catalog.json` (zelfde formaat als `open-calc-studio-extensions`); tot die tijd toont Bladeren een nette foutmelding.
- [ ] Voorbeeld-extensie publiceren (bv. een XER- of Excel-importer) als referentie voor extensie-auteurs.
- [ ] `window.__openPlannerStudioSdk` vullen met een echte SDK-API (nu leeg object in de sandbox-require).
```

- [ ] **Step 5: Maak `docs/extensions.md`** (auteurshandleiding):

```markdown
# Extensies schrijven voor Open Planner Studio

Een extensie is een ZIP-bestand met twee bestanden — of een los `.js`-bestand met een `@manifest`-commentaarblok.

## manifest.json

```json
{
  "id": "mijn-extensie",
  "name": "Mijn Extensie",
  "version": "1.0.0",
  "minAppVersion": "2026.4.0",
  "author": "Jouw Naam",
  "description": "Wat de extensie doet.",
  "category": "Import/Export",
  "main": "main.js",
  "permissions": ["ribbon", "events"],
  "icon": "<svg viewBox=\"0 0 24 24\">…</svg>"
}
```

Categorieën: `Import/Export`, `Planning`, `Reporting`, `Utility`, `Other`.
Permissies: `ribbon` en `events` worden afgedwongen; de overige (`commands`, `backstage`, `filesystem`, `network`) zijn declaratief.

## main.js

CommonJS-module die `onLoad(api)` exporteert (en optioneel `onUnload()`):

```js
module.exports = {
  onLoad(api) {
    // Importer: verschijnt in Bestand → Importeren
    api.importers.register({
      id: 'mijn-import',
      name: 'Mijn Formaat',
      description: 'Leest .abc-bestanden',
      fileExtensions: ['.abc'],
      handler: async (file) => {
        const text = await file.text();
        // … parse text …
        return { project, calendar, tasks, sequences, resources, assignments };
      },
    });

    // Ribbon-knop (permissie 'ribbon')
    api.ui.addRibbonButton({
      tab: 'start',
      group: 'Mijn Groep',
      label: 'Doe iets',
      onClick: () => api.ui.showNotification('Gedaan!'),
    });
  },
  onUnload() {},
};
```

## API-overzicht

| Onderdeel | Functies |
|---|---|
| `api.importers` | `register(def)`, `unregister(id)` |
| `api.data` | `getProject/getCalendar/getTasks/getSequences/getResources/getAssignments`, `addTask`, `updateTask`, `addSequence`, `loadProject(result)`, `recalculate()` |
| `api.events` | `on/off/emit` (permissie `events`) |
| `api.ui` | `addRibbonButton(reg)` (permissie `ribbon`), `showNotification(msg, type?)` |
| `api.settings` | `get(key, default)`, `set(key, value)` — per extensie geprefixt in localStorage |

Belangrijk: na het muteren van taken/relaties zelf `api.data.recalculate()` aanroepen — het schema wordt niet reactief herberekend. `loadProject()` doet dat automatisch.

## Installeren

Bestand → Extensies → **ZIP** of **JS** (lokaal bestand), of via de **Bladeren**-tab (catalogus: `OpenAEC-Foundation/open-planner-studio-extensions`).

Bij een los `.js`-bestand mag het manifest als commentaarblok bovenaan:

```js
/** @manifest { "id": "mijn-extensie", "name": "Mijn Extensie", "version": "1.0.0", "minAppVersion": "0.0.0", "author": "Ik", "description": "…", "category": "Utility", "main": "main.js", "permissions": [] } */
```
```

- [ ] **Step 6: Verwijs vanuit CLAUDE.md naar de handleiding** — voeg onder "## Docs" toe:

```markdown
- [docs/extensions.md](docs/extensions.md) — handleiding voor extensie-auteurs (manifest, API, installeren).
```

- [ ] **Step 7: Build** — `npm run build`, verwacht groen.
- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md docs/CHANGELOG.md docs/TODO.md docs/extensions.md
git commit -m "docs: store-slices en extensiesysteem gedocumenteerd"
```

---

## Definition of done

1. `npm run build` groen op elke commit.
2. Zelftest (Taak 22) volledig groen: installeren, registraties, UI zichtbaar, disable draait alles terug, IndexedDB persistentie over een herlaad, verwijderen ruimt op.
3. Geen gedragswijziging in bestaande functies (taken, CPM, undo, file-I/O, instellingen) — steekproef in de rooktest van Taak 11.
4. Alle nieuwe UI-teksten via `t(...)` met keys in alle 14 locales.
5. Documentatie bijgewerkt (CLAUDE.md, CHANGELOG, TODO, extensions.md).
