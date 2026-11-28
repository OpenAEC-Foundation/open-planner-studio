import { useEffect, useRef } from 'react';
import type { ViewState } from '@/types/view';
import { isTypingTarget } from './keyboard/isTypingTarget';

interface UseZoomShortcutsOpts {
  zoomAt: (newZoom: number, anchorX: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  view: ViewState;
  resetZoom: () => void;
  fitToProject: () => void;
}


export function useZoomShortcuts({
  zoomAt,
  containerRef,
  view,
  resetZoom,
  fitToProject,
}: UseZoomShortcutsOpts) {
  const latest = useRef(view);
  latest.current = view;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target, e)) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;

      const v = latest.current;
      const isZero = e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0';

      if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomAt(v.zoom * 1.1, centerX);
      } else if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomAt(v.zoom / 1.1, centerX);
      } else if (isZero && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        fitToProject();
      } else if (isZero) {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomAt, containerRef, resetZoom, fitToProject]);
}
