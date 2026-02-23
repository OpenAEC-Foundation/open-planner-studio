import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';

const isProduction = import.meta.env.PROD;

/** Browser shortcuts to block in production (Tauri WebView). */
const BLOCKED_SHORTCUTS: Array<{ key: string; ctrl?: boolean; shift?: boolean }> = [
  { key: 'r', ctrl: true },              // Ctrl+R  reload
  { key: 'r', ctrl: true, shift: true },  // Ctrl+Shift+R  hard reload
  { key: 'F5' },                          // handled by app (runCPM), but also block browser reload
  { key: 'F12' },                         // DevTools
  { key: 'i', ctrl: true, shift: true },  // Ctrl+Shift+I  DevTools
  { key: 'j', ctrl: true, shift: true },  // Ctrl+Shift+J  Console
  { key: 'u', ctrl: true },               // Ctrl+U  View Source
  { key: 'g', ctrl: true },               // Ctrl+G  Find
  { key: 'f', ctrl: true },               // Ctrl+F  Find (browser)
  { key: 'l', ctrl: true },               // Ctrl+L  Address bar
];

function isBrowserShortcut(e: KeyboardEvent): boolean {
  const ctrl = e.ctrlKey || e.metaKey;
  return BLOCKED_SHORTCUTS.some(s =>
    e.key.toLowerCase() === s.key.toLowerCase()
    && (s.ctrl ? ctrl : !ctrl)
    && (s.shift ? e.shiftKey : !e.shiftKey)
  );
}

export function useKeyboardShortcuts() {
  const undo = useAppStore(s => s.undo);
  const redo = useAppStore(s => s.redo);
  const runCPM = useAppStore(s => s.runCPM);
  const deleteTask = useAppStore(s => s.deleteTask);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const deselectAll = useAppStore(s => s.deselectAll);
  const setUI = useAppStore(s => s.setUI);
  const setZoom = useAppStore(s => s.setZoom);
  const zoom = useAppStore(s => s.view.zoom);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Block browser shortcuts in production
      if (isProduction && isBrowserShortcut(e)) {
        e.preventDefault();
        // Still run app action for F5
        if (e.key === 'F5') runCPM();
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'F5') {
        e.preventDefault();
        runCPM();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTaskIds.length > 0) {
          e.preventDefault();
          for (const id of selectedTaskIds) {
            deleteTask(id);
          }
        }
      } else if (e.key === 'Escape') {
        deselectAll();
        setUI({ showTaskDialog: false, editingTaskId: null, showDependencyMode: false });
      } else if (ctrl && e.key === '=') {
        e.preventDefault();
        setZoom(zoom + 10);
      } else if (ctrl && e.key === '-') {
        e.preventDefault();
        setZoom(zoom - 10);
      } else if (ctrl && e.key === 'p') {
        e.preventDefault();
        setUI({ activeRibbonTab: 'report' });
      } else if (ctrl && e.key === 'n') {
        e.preventDefault();
        setUI({ showTaskDialog: true, editingTaskId: null });
      }
    };

    // Disable right-click context menu in production
    const contextHandler = (e: MouseEvent) => {
      if (isProduction) e.preventDefault();
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('contextmenu', contextHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('contextmenu', contextHandler);
    };
  }, [undo, redo, runCPM, deleteTask, selectedTaskIds, deselectAll, setUI, setZoom, zoom]);
}
