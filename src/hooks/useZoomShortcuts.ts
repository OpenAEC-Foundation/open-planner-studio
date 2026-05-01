import { useEffect, useRef } from 'react';
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
        setScroll(0, v.scrollY);
      } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Fit to project
        if (t.length === 0) {
          setZoom(DEFAULT_ZOOM);
          setScroll(0, v.scrollY);
          return;
        }
        let minStart: string | null = null;
        let maxFinish: string | null = null;
        for (const task of t) {
          const s = task.time.earlyStart || task.time.scheduleStart;
          const f = task.time.earlyFinish || task.time.scheduleFinish || s;
          if (s && (!minStart || s < minStart)) minStart = s;
          if (f && (!maxFinish || f > maxFinish)) maxFinish = f;
        }
        if (!minStart || !maxFinish) return;
        const span = Math.max(1, diffCalendarDays(parseDate(minStart), parseDate(maxFinish)) + 1);
        const usable = rect.width - taskTableWidth;
        if (usable <= 0) return;
        const max = enableQH ? 1000 : 400;
        const newZoom = Math.max(0.5, Math.min(max, usable / span));
        setZoom(newZoom);
        setViewStartDate(minStart);
        setScroll(0, v.scrollY);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomAt, containerRef, taskTableWidth, setZoom, setScroll, setViewStartDate]);
}
