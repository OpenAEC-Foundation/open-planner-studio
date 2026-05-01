import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { parseDate, diffCalendarDays } from '@/utils/dateUtils';

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept while typing in an input/textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;

      if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomAt(view.zoom * 1.1, centerX);
      } else if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomAt(view.zoom / 1.1, centerX);
      } else if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setZoom(DEFAULT_ZOOM);
        setScroll(0, view.scrollY);
      } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Fit to project
        if (tasks.length === 0) {
          setZoom(DEFAULT_ZOOM);
          setScroll(0, view.scrollY);
          return;
        }
        let minStart: string | null = null;
        let maxFinish: string | null = null;
        for (const t of tasks) {
          const s = t.time.earlyStart || t.time.scheduleStart;
          const f = t.time.earlyFinish || t.time.scheduleFinish || s;
          if (s && (!minStart || s < minStart)) minStart = s;
          if (f && (!maxFinish || f > maxFinish)) maxFinish = f;
        }
        if (!minStart || !maxFinish) return;
        const span = Math.max(1, diffCalendarDays(parseDate(minStart), parseDate(maxFinish)) + 1);
        const usable = rect.width - taskTableWidth;
        if (usable <= 0) return;
        const newZoom = Math.max(0.5, Math.min(400, usable / span));
        setZoom(newZoom);
        setViewStartDate(minStart);
        setScroll(0, view.scrollY);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomAt, containerRef, taskTableWidth, setZoom, setScroll, setViewStartDate, view.zoom, view.scrollY, tasks]);
}
