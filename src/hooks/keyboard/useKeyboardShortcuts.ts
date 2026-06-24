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
  { key: 's', ctrl: true },               // Ctrl+S  handled by app (save)
  { key: 's', ctrl: true, shift: true },  // Ctrl+Shift+S  handled by app (save as)
  { key: 'o', ctrl: true },               // Ctrl+O  handled by app (open)
  { key: 'n', ctrl: true },               // Ctrl+N  handled by app (new project)
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
  const copyTasks = useAppStore(s => s.copyTasks);
  const pasteTasks = useAppStore(s => s.pasteTasks);
  const deselectAll = useAppStore(s => s.deselectAll);
  const setUI = useAppStore(s => s.setUI);
  const setZoom = useAppStore(s => s.setZoom);
  const zoom = useAppStore(s => s.view.zoom);
  const saveFile = useAppStore(s => s.saveFile);
  const saveFileAs = useAppStore(s => s.saveFileAs);
  const openFile = useAppStore(s => s.openFile);
  const newDocument = useAppStore(s => s.newDocument);
  const documents = useAppStore(s => s.documents);
  const switchDocument = useAppStore(s => s.switchDocument);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Block browser shortcuts in production but still run app actions
      if (isProduction && isBrowserShortcut(e)) {
        e.preventDefault();
        const ctrlB = e.ctrlKey || e.metaKey;
        if (e.key === 'F5') runCPM();
        else if (ctrlB && e.shiftKey && e.key.toLowerCase() === 's') saveFileAs();
        else if (ctrlB && e.key.toLowerCase() === 's') saveFile();
        else if (ctrlB && e.key.toLowerCase() === 'o') openFile();
        else if (ctrlB && e.key.toLowerCase() === 'n') newDocument();
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveFileAs();
      } else if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveFile();
      } else if (ctrl && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        openFile();
      } else if (ctrl && e.key.toLowerCase() === 'c') {
        if (selectedTaskIds.length > 0) {
          e.preventDefault();
          copyTasks();
        }
      } else if (ctrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteTasks();
      } else if (ctrl && e.key === 'z') {
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
        setUI({ showTaskDialog: false, editingTaskId: null, showDependencyMode: false, showProjectOverview: false });
      } else if (ctrl && /^[1-9]$/.test(e.key)) {
        // Multi-document: ⌘/Ctrl 1–9 springt naar het n-de open document.
        e.preventDefault();
        const doc = documents[Number(e.key) - 1];
        if (doc) switchDocument(doc.id);
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
        newDocument();
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
  }, [undo, redo, runCPM, deleteTask, selectedTaskIds, copyTasks, pasteTasks, deselectAll, setUI, setZoom, zoom, saveFile, saveFileAs, openFile, newDocument, documents, switchDocument]);
}
