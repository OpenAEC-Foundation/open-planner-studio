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
import { createExtensionSlice, type ExtensionSlice } from './slices/extensionSlice';

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
  FileSlice &
  ExtensionSlice;

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
    ...createExtensionSlice(...a),
  }))
);
