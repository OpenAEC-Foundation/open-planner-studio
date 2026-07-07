import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { computeFitToProject } from '@/utils/ganttViewport';

interface UseZoomShortcutsOpts {
  zoomAt: (newZoom: number, anchorX: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  taskTableWidth: number;
}

const DEFAULT_ZOOM = 30;

export function useZoomShortcuts({ zoomAt, containerRef, taskTableWidth }: UseZoomShortcutsOpts) {
  const setZoom = useAppStore(s => s.setZoom);
  const setScroll = useAppStore(s => s.setScroll);
  const setViewStartDate = useAppStore(s => s.setViewStartDate);
  const tasks = useAppStore(s => s.tasks);
  const view = useAppStore(s => s.view);
  const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);

  // Latest values in a ref so the keydown handler doesn't re-attach on every zoom/scroll change
  const latest = useRef({ view, tasks, enableQuarterHourZoom });
  latest.current = { view, tasks, enableQuarterHourZoom };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept while typing in an input/textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;

      const { view: v, tasks: t, enableQuarterHourZoom: enableQH } = latest.current;

      if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomAt(v.zoom * 1.1, centerX);
      } else if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomAt(v.zoom / 1.1, centerX);
      } else if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setZoom(DEFAULT_ZOOM);
        setScroll(0, 0);
      } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Fit to project — gedeelde helper (zelfde berekening als de open-fit, GanttCanvas).
        if (t.length === 0) {
          setZoom(DEFAULT_ZOOM);
          setScroll(0, 0);
          return;
        }
        const fit = computeFitToProject(t, rect.width - taskTableWidth, enableQH);
        if (!fit) return;
        setZoom(fit.zoom);
        setViewStartDate(fit.viewStartDate);
        setScroll(fit.scrollX, 0);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomAt, containerRef, taskTableWidth, setZoom, setScroll, setViewStartDate]);
}
