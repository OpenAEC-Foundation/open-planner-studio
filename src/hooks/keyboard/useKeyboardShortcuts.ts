import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';

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

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, runCPM, deleteTask, selectedTaskIds, deselectAll, setUI, setZoom, zoom]);
}
