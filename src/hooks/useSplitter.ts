import { useEffect, useState } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';

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
  computeSize: (e: MouseEvent) => number;
  onResize: (size: number) => void;
  onCommit?: () => void;
}

export interface Splitter {
  isResizing: boolean;
  start: () => void;
}

export function useSplitter(opts: UseSplitterOptions): Splitter {
  const [isResizing, setIsResizing] = useState(false);
  const optsRef = useLatestRef(opts);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const current = optsRef.current;
      const maxW = typeof current.max === 'function' ? current.max() : current.max;
      const size = Math.min(maxW, Math.max(current.min, current.computeSize(e)));
      current.onResize(size);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      optsRef.current.onCommit?.();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, optsRef]);

  return { isResizing, start: () => setIsResizing(true) };
}
