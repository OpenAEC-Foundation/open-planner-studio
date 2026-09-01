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
import { createStoreRuntime, type StoreRuntime, type StoreRuntimeOptions } from './runtime/storeRuntime';

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
  LibrarySlice;

export type AppStore = UseBoundStore<
  Mutate<StoreApi<AppState>, [['zustand/immer', never]]>
>;

export interface AppStoreContext {
  /** Documentstate, undo/redo en niet-documentaire appstate van precies deze context. */
  store: AppStore;
  /** Undo-coalescing, batchdiepte, MCP-lease en timephased-verlies van precies deze context. */
  runtime: StoreRuntime;
}

/**
 * Bouw één onafhankelijke storecontext. Documentstate, undo/redo en uitvoeringsmetadata lekken niet
 * tussen contexten. `ui` en `taskClipboard` zijn bewust niet documentgebonden: zij overleven een
 * documentwissel binnen hun eigen context, maar worden evenmin met een andere context gedeeld.
 *
 * Batch-, MCP- en extensie-datafactories krijgen dit volledige object; zo kunnen zij state noch
 * suppressie-/leasemetadata uit een singleton halen. App-lifecycleregistries buiten de
 * Zustandfactory (plugininstances, eventbus en SDK-windowbinding) blijven bewust app-global; de
 * gemounte productinterface en React-selectors binden die aan `appStoreContext` hieronder.
 */
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
      ...createViewSlice(...a),
      ...createUiSlice(...a),
      ...createFileSlice(runtime)(...a),
      ...createExtensionSlice(...a),
      ...createDocumentSlice(runtime)(...a),
      ...createStructureSlice(runtime)(...a),
      ...createBaselineSlice(runtime)(...a),
      ...createLibrarySlice(runtime)(...a),
    })),
  );
  return { store, runtime };
}

/** Compatibiliteitsfactory voor callers die alleen de bekende Zustandvorm nodig hebben. */
export function createAppStore(): AppStore {
  return createAppStoreContext().store;
}

/** De gemounte productinterface blijft exact één appcontext gebruiken. */
export const appStoreContext = createAppStoreContext();
export const useAppStore = appStoreContext.store;
