// Native menuacties delen de sneltoetsacties én hun modale/draftbewaking. Geen nagebootste
// KeyboardEvents: een menu-opdracht heeft geen keydown en leest de actuele focus en store.
import { useAppStore } from '@/state/appStore';
import { SHORTCUTS, isGlobalShortcutFrozen, isShortcutBlockedByDialog } from './shortcutRegistry';
import { isTypingTarget } from './isTypingTarget';
import { commitPendingTextEdit } from './useKeyboardShortcuts';

export const NATIVE_SHORTCUT_IDS = [
  'file.newProject', 'file.open', 'file.save', 'file.saveAs', 'file.recalculate',
  'edit.undo', 'edit.redoShiftZ', 'view.zoomIn', 'view.zoomOut',
  'view.toggleFullscreen', 'nav.help', 'nav.reportTab', 'view.showShortcuts',
] as const;
export type NativeShortcutId = typeof NATIVE_SHORTCUT_IDS[number];

export function runNativeShortcut(id: NativeShortcutId): void {
  if (isGlobalShortcutFrozen()) return;
  const entry = SHORTCUTS.find(shortcut => shortcut.id === id);
  if (!entry) return;
  const target = document.activeElement;
  const typing = isTypingTarget(target, {
    key: entry.combo.key, ctrlKey: false, metaKey: !!entry.combo.mod,
  });
  // Cmd+Z/Shift+Cmd+Z in een tekstveld blijft tekstgeschiedenis; buiten invoer is het app-undo.
  if (typing && (id === 'edit.undo' || id === 'edit.redoShiftZ')) {
    document.execCommand(id === 'edit.undo' ? 'undo' : 'redo');
    return;
  }
  if (entry.when && !entry.when()) return;
  // Opslaan en berekenen committen hetzelfde invoerconcept als Ctrl/Cmd+S en F5.
  if (id === 'file.save' || id === 'file.saveAs' || id === 'file.recalculate') {
    commitPendingTextEdit(target, { recalculate: id !== 'file.recalculate' });
  }
  entry.run(useAppStore.getState());
}

export function openNativeSettings(): void {
  if (isGlobalShortcutFrozen() || isShortcutBlockedByDialog()) return;
  useAppStore.getState().setUI({ showSettingsDialog: true });
}
