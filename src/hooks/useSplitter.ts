import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

// Generieke sleep-splitter — hetzelfde patroon dat door de app werd gedupliceerd
// (rechterpaneel-rand in App, tabel/chart-rand in GanttCanvas): losse drag-state,
// window-listeners voor move/up, klem tussen min/max, en pas persisteren bij loslaten.
//
// Parametrisch zodat elke consument de geometrie zelf bepaalt:
//   - computeSize(e): rauwe grootte uit de muispositie (bv. window.innerWidth - e.clientX
//     voor een rechterpaneel, of e.clientX - rect.left voor een linkertabel);
//   - min / max: klem-grenzen. `max` mag een functie zijn wanneer de bovengrens dynamisch
//     is (bv. 60% van het venster — het venster kan tussen sessies resizen);
//   - onResize(size): pas de geklemde grootte toe (meestal een store-setter);
//   - onCommit(): optioneel, aangeroepen bij mouseup — meestal persisteren (localStorage).
export interface UseSplitterOptions {
  min: number;
  max: number | (() => number);
  computeSize: (e: Pick<MouseEvent, 'clientX' | 'clientY'>) => number;
  onResize: (size: number) => void;
  onCommit?: () => void;
}

export interface Splitter {
  isResizing: boolean;
  start: () => void;
  startPointer: (event: ReactPointerEvent<HTMLElement>) => void;
}

export function useSplitter(opts: UseSplitterOptions): Splitter {
  const [dragOwner, setDragOwner] = useState<'mouse' | number | null>(null);
  const isResizing = dragOwner !== null;

  useEffect(() => {
    if (dragOwner === null) return;
    const resizeFrom = (e: Pick<MouseEvent, 'clientX' | 'clientY'>) => {
      const maxW = typeof opts.max === 'function' ? opts.max() : opts.max;
      const size = Math.min(maxW, Math.max(opts.min, opts.computeSize(e)));
      opts.onResize(size);
    };
    const finish = () => {
      setDragOwner(null);
      opts.onCommit?.();
    };
    const handleMouseMove = (event: MouseEvent) => resizeFrom(event);
    const handlePointerMove = (event: PointerEvent) => {
      if (typeof dragOwner === 'number' && event.pointerId === dragOwner) resizeFrom(event);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (typeof dragOwner === 'number' && event.pointerId === dragOwner) finish();
    };
    if (dragOwner === 'mouse') {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', finish);
    } else {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', finish);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragOwner]);

  return {
    isResizing,
    start: () => setDragOwner('mouse'),
    startPointer: event => {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragOwner(event.pointerId);
    },
  };
}
