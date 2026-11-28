import { create, type Mutate, type StoreApi, type UseBoundStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice';
import { createTaskSlice, type TaskSlice } from './slices/taskSlice';
import { createSelectionSlice, type SelectionSlice } from './slices/selectionSlice';
import { createSequenceSlice, type SequenceSlice } from './slices/sequenceSlice';
import { createResourceSlice, type ResourceSlice } from './slices/resourceSlice';
import { createScheduleSlice, type ScheduleSlice } from './slices/scheduleSlice';
import { createHistorySlice, type HistorySlice } from './slices/historySlice';
import { createViewSlice, type ViewSlice } from './slices/viewSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';
import { createFileSlice, type FileSlice } from './slices/fileSlice';
import { createExtensionSlice, type ExtensionSlice } from './slices/extensionSlice';
import { createDocumentSlice, type DocumentSlice } from './slices/documentSlice';
import { createStructureSlice, type StructureSlice } from './slices/structureSlice';
import { createBaselineSlice, type BaselineSlice } from './slices/baselineSlice';
import { createLibrarySlice, type LibrarySlice } from './slices/librarySlice';
import { createSchedulingProfileSlice, type SchedulingProfileSlice } from './slices/schedulingProfileSlice';
import { createTaskGridSlice, type TaskGridSlice } from './slices/taskGridSlice';
import { createGridTransactionSlice, type GridTransactionSlice } from './gridTransaction';
import { createStoreRuntime, type StoreRuntime, type StoreRuntimeOptions } from './runtime/storeRuntime';
import { bindScratchDocumentContextFactory } from './runtime/scratchDocument';

export type { ExportFormat } from './slices/fileSlice';

enableMapSet();

export type AppState = ProjectSlice &
  TaskSlice &
  SelectionSlice &
  SequenceSlice &
  ResourceSlice &
  ScheduleSlice &
  HistorySlice &
  ViewSlice &
  UiSlice &
  FileSlice &
  ExtensionSlice &
  DocumentSlice &
  StructureSlice &
  BaselineSlice &
  LibrarySlice &
  SchedulingProfileSlice &
  TaskGridSlice &
  GridTransactionSlice;

export type AppStore = UseBoundStore<
  Mutate<StoreApi<AppState>, [['zustand/immer', never]]>
>;

export interface AppStoreContext {
  store: AppStore;
  runtime: StoreRuntime;
}

export function createAppStoreContext(opts?: StoreRuntimeOptions): AppStoreContext {
  const runtime = createStoreRuntime(opts);
  const store = create<AppState>()(
    immer((...a) => ({
      ...createProjectSlice(runtime)(...a),
      ...createTaskSlice(runtime)(...a),
      ...createSelectionSlice(runtime)(...a),
      ...createSequenceSlice(runtime)(...a),
      ...createResourceSlice(runtime)(...a),
      ...createScheduleSlice(runtime)(...a),
      ...createHistorySlice(runtime)(...a),
      ...createViewSlice(runtime)(...a),
      ...createUiSlice(...a),
      ...createFileSlice(runtime)(...a),
      ...createExtensionSlice(...a),
      ...createDocumentSlice(runtime)(...a),
      ...createStructureSlice(runtime)(...a),
      ...createBaselineSlice(runtime)(...a),
      ...createLibrarySlice(runtime)(...a),
      ...createSchedulingProfileSlice(runtime)(...a),
      ...createTaskGridSlice(...a),
      ...createGridTransactionSlice(...a),
    })),
  );
  return { store, runtime };
}

export function createAppStore(): AppStore {
  return createAppStoreContext().store;
}

bindScratchDocumentContextFactory(createAppStoreContext);
