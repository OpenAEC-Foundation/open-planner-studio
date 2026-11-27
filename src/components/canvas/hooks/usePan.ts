import { RefObject, useEffect, useState } from 'react';
import { BOX_SELECT_THRESHOLD } from './constants';
import { listenWindowDrag } from '@/hooks/listenWindowDrag';

export interface PanState {
  button: number;
  startClientX: number;
  startClientY: number;
  originScrollX: number;
  originScrollY: number;
}

interface UsePanOptions {
  setScroll: (x: number, y: number) => void;
  justBoxSelectedRef: RefObject<boolean>;
}

export function usePan({ setScroll, justBoxSelectedRef }: UsePanOptions) {
  const [panState, setPanState] = useState<PanState | null>(null);

  useEffect(() => {
    if (!panState) return;

    let panned = false;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panState.startClientX;
      const dy = e.clientY - panState.startClientY;
      if (Math.hypot(dx, dy) >= BOX_SELECT_THRESHOLD) panned = true;
      setScroll(panState.originScrollX - dx, panState.originScrollY - dy);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== panState.button) return;
      if (panned && e.button === 0) justBoxSelectedRef.current = true;
      setPanState(null);
    };

    return listenWindowDrag({ onMove: handleMouseMove, onUp: handleMouseUp, onDocumentSwitch: () => setPanState(null) });
  }, [panState, setScroll, justBoxSelectedRef]);

  return { panState, startPan: setPanState, active: !!panState };
}
