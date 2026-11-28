import type { AppState } from '@/state/appStore';
import { buildImportLabels } from '@/i18n/importLabels';
import { isTreeMode } from '@/engine/view/visibleRows';
import { saveShowHistogram } from '@/utils/settingsStore';
import { ZOOM_STEP } from '@/utils/ganttViewport';
import i18n from '@/i18n/config';
import { canRedo, canUndo } from '@/state/sessionHistory';
import { isTaskListInView } from '@/state/ganttVisibility';

export interface Command {
  id: string;
  run: (store: AppState) => void;
  isEnabled?: (store: AppState) => boolean;
}

const hasSelection = (s: AppState): boolean => s.selectedTaskIds.length > 0;

export const hasEditableSelection = (s: AppState): boolean => hasSelection(s) && isTaskListInView(s.ui);

export const COMMANDS = {
  undo: {
    id: 'undo',
    run: (s) => s.undo(),
    isEnabled: canUndo,
  },
  redo: {
    id: 'redo',
    run: (s) => s.redo(),
    isEnabled: canRedo,
  },
  save: {
    id: 'save',
    run: (s) => { void s.saveFile(); },
  },
  saveAs: {
    id: 'saveAs',
    run: (s) => { void s.saveFileAs(); },
  },
  open: {
    id: 'open',
    run: (s) => { void s.openFile(buildImportLabels((key) => i18n.t(key, { ns: 'common' }))); },
  },
  delete: {
    id: 'delete',
    run: (s) => { s.deleteTasksBulk(s.selectedTaskIds); },
    isEnabled: hasEditableSelection,
  },
  indent: {
    id: 'indent',
    run: (s) => {
      if (isTreeMode(s.view)) s.indentTasks(s.selectedTaskIds);
      else s.notifyStructureLocked();
    },
    isEnabled: (s) => hasSelection(s) && isTreeMode(s.view),
  },
  outdent: {
    id: 'outdent',
    run: (s) => {
      if (isTreeMode(s.view)) s.outdentTasks(s.selectedTaskIds);
      else s.notifyStructureLocked();
    },
    isEnabled: (s) => hasSelection(s) && isTreeMode(s.view),
  },
  zoomIn: {
    id: 'zoomIn',
    run: (s) => s.setZoom(s.view.zoom + ZOOM_STEP),
  },
  zoomOut: {
    id: 'zoomOut',
    run: (s) => s.setZoom(s.view.zoom - ZOOM_STEP),
  },
  toggleHistogram: {
    id: 'toggleHistogram',
    run: (s) => {
      const next = !s.ui.showHistogram;
      s.setUI({ showHistogram: next });
      void saveShowHistogram(next);
    },
  },
  toggleWarningsPanel: {
    id: 'toggleWarningsPanel',
    run: (s) => {
      s.setUI({ showWarningsPanel: !s.ui.showWarningsPanel });
    },
  },
} satisfies Record<string, Command>;

export type CommandId = keyof typeof COMMANDS;

export function isCommandEnabled(cmd: Command, store: AppState): boolean {
  return cmd.isEnabled ? cmd.isEnabled(store) : true;
}
