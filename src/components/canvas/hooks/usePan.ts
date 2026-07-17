import { RefObject, useEffect, useState } from 'react';
import { BOX_SELECT_THRESHOLD } from './constants';

// Map-style drag-to-pan (Optie 3 / 'drag' scroll mode). Captures the pointer
// origin and the scroll offsets at grab time; movement is applied as a delta.
export interface PanState {
  startClientX: number;
  startClientY: number;
  originScrollX: number;
  originScrollY: number;
}

interface UsePanOptions {
  setScroll: (x: number, y: number) => void;
  /** Gedeelde vlag met box-select + click-handler: onderdrukt de eerstvolgende native click ná een
   *  echte pan (anders wist die de zojuist gepande selectie). */
  justBoxSelectedRef: RefObject<boolean>;
}

// Pan-gebaar (kaart-stijl slepen in 'drag' scroll-modus). Bezit `panState` + window-listeners;
// het centrale mousedown-hittest roept `startPan(...)` aan.
export function usePan({ setScroll, justBoxSelectedRef }: UsePanOptions) {
  const [panState, setPanState] = useState<PanState | null>(null);

  // Map-style pan: translate pointer movement into scroll offsets. Dragging the
  // canvas content to the right reveals earlier content, so scrollX decreases.
  useEffect(() => {
    if (!panState) return;

    let panned = false;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panState.startClientX;
      const dy = e.clientY - panState.startClientY;
      if (Math.hypot(dx, dy) >= BOX_SELECT_THRESHOLD) panned = true;
      setScroll(panState.originScrollX - dx, panState.originScrollY - dy);
    };

    const handleMouseUp = () => {
      // Fase 2.10 fix-golf 1: de browser vuurt na een mouseup nog een native click op het canvas.
      // Zonder onderdrukking zou die click de zojuist gepande selectie overschrijven/wissen (net als
      // bij box-select hierboven). Alleen onderdrukken als er ook echt gepand is — een klik zonder
      // beweging in 'drag'-modus moet gewoon als normale selectie-klik blijven werken.
      if (panned) justBoxSelectedRef.current = true;
      setPanState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panState, setScroll]);

  return { panState, startPan: setPanState, active: !!panState };
}
