import { useEffect, useRef } from 'react';
import type { ViewState } from '@/types/view';

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
  // Latest values in a ref so the keydown handler doesn't re-attach on every zoom/scroll change
  const latest = useRef(view);
  latest.current = view;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept while typing in an input/textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;

      const v = latest.current;
      // Sommige browser-/toetsenbordcombinaties leveren bij Ctrl+0 niet consequent dezelfde
      // `key`, maar wel de fysieke nulcode. De sneltoets blijft daardoor ook op numpad en
      // niet-US-layouts ondubbelzinnig een fit-to-project; een kale 0 herstelt alleen de zoom.
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
