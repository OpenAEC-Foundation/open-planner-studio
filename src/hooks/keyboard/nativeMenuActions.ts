// Native menuacties delen de sneltoetsacties én hun modale/draftbewaking. Geen nagebootste
// KeyboardEvents: een menu-opdracht heeft geen keydown en leest de actuele focus en store.
import { useAppStore } from '@/state/appStore';
import { SHORTCUTS, canRunShortcut, isGlobalShortcutFrozen, isShortcutBlockedByDialog } from './shortcutRegistry';
import { isTypingTarget } from './isTypingTarget';
import { commitPendingTextEdit } from './useKeyboardShortcuts';

export const NATIVE_SHORTCUT_IDS = [
  'file.newProject', 'file.open', 'file.save', 'file.saveAs', 'file.recalculate',
  'edit.undo', 'edit.redoShiftZ', 'edit.selectAll', 'view.zoomIn', 'view.zoomOut',
  'view.toggleFullscreen', 'nav.help', 'nav.reportTab', 'view.showShortcuts',
] as const;
export type NativeShortcutId = typeof NATIVE_SHORTCUT_IDS[number];

export function runNativeShortcut(id: NativeShortcutId): void {
  if (isGlobalShortcutFrozen()) return;
  const shortcut = SHORTCUTS.find(shortcut => shortcut.id === id);
  if (!shortcut) return;
  // Opslaan als mag vanuit invoer, net als Cmd+Shift+S in de productie-voorpoort.
  // Het dev/test-register laat die toets bewust niet toe; native menu's volgen productie.
  const entry = id === 'file.saveAs' ? { ...shortcut, allowInInput: true } : shortcut;
  const target = document.activeElement;
  const typing = isTypingTarget(target, {
    key: entry.combo.key, ctrlKey: false, metaKey: !!entry.combo.mod,
  });
  // Tekstgeschiedenis en tekstselectie blijven bij het veld; buiten invoer zijn het app-acties.
  if (typing && (id === 'edit.undo' || id === 'edit.redoShiftZ' || id === 'edit.selectAll')) {
    document.execCommand(id === 'edit.undo' ? 'undo' : id === 'edit.redoShiftZ' ? 'redo' : 'selectAll');
    return;
  }
  if (!canRunShortcut(entry, typing)) return;
  // Elke toegestane invoeractie commit eerst, zoals het toetsenbordregister: ook Presentatie
  // moet de veldwaarde bewaren voordat het eigenschappenpaneel verdwijnt.
  if (entry.allowInInput && typing) {
    commitPendingTextEdit(target, { recalculate: id !== 'file.recalculate' });
  }
  entry.run(useAppStore.getState());
}

export function openNativeSettings(): void {
  if (isGlobalShortcutFrozen() || isShortcutBlockedByDialog()) return;
  useAppStore.getState().setUI({ showSettingsDialog: true });
}
