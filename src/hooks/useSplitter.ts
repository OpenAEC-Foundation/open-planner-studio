import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';
import { listenWindowDrag } from '@/hooks/listenWindowDrag';

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

export type PanelSide = 'inline-start' | 'inline-end';
export type InlineDirection = 'ltr' | 'rtl';

export function inlineDirectionOf(element: Element | null | undefined): InlineDirection {
  const target = element ?? document.documentElement;
  return getComputedStyle(target).direction === 'rtl' ? 'rtl' : 'ltr';
}

function panelOnLeft(side: PanelSide, direction: InlineDirection): boolean {
  return (side === 'inline-start') === (direction === 'ltr');
}

export function panelWidthAtPointer(
  clientX: number,
  bounds: { left: number; right: number },
  side: PanelSide,
  direction: InlineDirection,
): number {
  return panelOnLeft(side, direction) ? clientX - bounds.left : bounds.right - clientX;
}

export function panelWidthStepForArrow(
  key: 'ArrowLeft' | 'ArrowRight',
  side: PanelSide,
  direction: InlineDirection,
): 1 | -1 {
  return (key === 'ArrowRight') === panelOnLeft(side, direction) ? 1 : -1;
}

export function useSplitter(opts: UseSplitterOptions): Splitter {
  const [dragOwner, setDragOwner] = useState<'mouse' | number | null>(null);
  const isResizing = dragOwner !== null;
  const optsRef = useLatestRef(opts);

  useEffect(() => {
    if (dragOwner === null) return;
    const resizeFrom = (e: Pick<MouseEvent, 'clientX' | 'clientY'>) => {
      const current = optsRef.current;
      const maxW = typeof current.max === 'function' ? current.max() : current.max;
      const size = Math.min(maxW, Math.max(current.min, current.computeSize(e)));
      current.onResize(size);
    };
    const finish = () => {
      setDragOwner(null);
      optsRef.current.onCommit?.();
    };
    const handleMouseMove = (event: MouseEvent) => resizeFrom(event);
    const handlePointerMove = (event: PointerEvent) => {
      if (typeof dragOwner === 'number' && event.pointerId === dragOwner) resizeFrom(event);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (typeof dragOwner === 'number' && event.pointerId === dragOwner) finish();
    };
    if (dragOwner === 'mouse') {
      return listenWindowDrag({ onMove: handleMouseMove, onUp: finish, onDocumentSwitch: finish });
    }
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragOwner, optsRef]);

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
