import { create } from 'zustand';
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
import { createTaskGridSlice, type TaskGridSlice } from './slices/taskGridSlice';
import {
  bindDefaultGridTransactionStore,
  createGridTransactionSlice,
  type GridTransactionSlice,
} from './gridTransaction';

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
  LibrarySlice &
  TaskGridSlice &
  GridTransactionSlice;

/**
 * Bouw een NIEUWE, onafhankelijke store-instantie (K-item 41).
 *
 * WAAROM DIT BESTAAT. De app draait op één singleton (`useAppStore`, hieronder), en dat blijft
 * voorlopig zo: 1.048 verwijzingen in 123 bestanden lezen die singleton rechtstreeks. Deze factory
 * verandert daar niets aan — hij maakt alleen mogelijk wat met een kale `create(...)`-expressie
 * onmogelijk was: een TWEEDE store. Dat is de opening naar split-view met twee documenten naast
 * elkaar, cross-project rekenen en een gedeelde resourcepool.
 *
 * WAT EEN TWEEDE INSTANTIE VANDAAG WÉL KAN. Alles wat via de store zelf loopt: eigen project, eigen
 * taken/relaties/resources, eigen selectie, eigen session-historyledger en eigen `runCPM`. Twee
 * instanties zitten elkaar daarin niet in de weg.
 *
 * WAT HIJ NOG NIET KAN — lees dit vóór je hem gebruikt. Drie mechanismen hangen nog aan de
 * singleton of aan module-state, en die zijn dus GEDEELD tussen instanties:
 *
 *   1. `batchTransaction.withTransaction` en `mcpTransaction.runInMcpTransaction` importeren
 *      `useAppStore` rechtstreeks. Een bulk-transactie op instantie B landt op instantie A.
 *   2. `transaction.ts` houdt de undo-coalescing, de batch-diepte en de MCP-suppressie in
 *      MODULE-variabelen. Twee instanties delen die uitvoeringsstaat, dus een batch op A
 *      onderdrukt de historyregistratie van B.
 *   3. De app-globale registers (extensies, MCP-server, SDK, bibliotheek-persistentie) kennen maar
 *      één store. Dat is voor een deel bewust — een extensie hoort niet per venster te bestaan —
 *      maar het is niet uitgezocht welk deel.
 *
 * Die drie zijn geen bijzaak: ze zijn precies het werk dat ná deze factory komt.
 * `tests/planning/check-store-factory.ts` toetst zowel wat er wél onafhankelijk is als dat deze
 * koppelingen er NOG steeds zijn — zodat de test rood wordt zodra iemand er een oplost en eraan
 * herinnert de vastpinning weg te halen (zelfde mechaniek als `KNOWN_GAPS` in de round-trip-test).
 */
export function createAppStore() {
  return create<AppState>()(
    immer((...a) => ({
      ...createProjectSlice(...a),
      ...createTaskSlice(...a),
      ...createSelectionSlice(...a),
      ...createSequenceSlice(...a),
      ...createResourceSlice(...a),
      ...createScheduleSlice(...a),
      ...createHistorySlice(...a),
      ...createViewSlice(...a),
      ...createUiSlice(...a),
      ...createFileSlice(...a),
      ...createExtensionSlice(...a),
      ...createDocumentSlice(...a),
      ...createStructureSlice(...a),
      ...createBaselineSlice(...a),
      ...createLibrarySlice(...a),
      ...createTaskGridSlice(...a),
      ...createGridTransactionSlice(...a),
    })),
  );
}

/** De store van de app. Eén instantie, gebouwd met de factory hierboven. */
export const useAppStore = createAppStore();
bindDefaultGridTransactionStore(useAppStore.getState, useAppStore.setState);
