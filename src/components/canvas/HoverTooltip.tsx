import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const VIEWPORT_MARGIN = 8;
const CURSOR_GAP = 16;
const ANCHOR_GAP = 8;

function clampInto(v: number, lo: number, hi: number): number {
  if (lo > hi) return lo;
  return Math.min(Math.max(v, lo), hi);
}

interface HoverTooltipProps {
  left: number;
  top: number;
  children: ReactNode;
  placement?: 'cursor' | 'before-anchor';
  anchorWidth?: number;
  className?: string;
  id?: string;
}

export function HoverTooltip({ left, top, children, placement = 'cursor', anchorWidth = 0, className, id }: HoverTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.transform = '';
    const r = el.getBoundingClientRect();

    const wanted = placement === 'before-anchor'
      ? r.left - r.width - ANCHOR_GAP >= VIEWPORT_MARGIN
        ? -(r.width + ANCHOR_GAP)
        : anchorWidth + ANCHOR_GAP
      : r.right > window.innerWidth - VIEWPORT_MARGIN
        ? -(r.width + CURSOR_GAP * 2)
        : 0;
    const dx = clampInto(wanted, VIEWPORT_MARGIN - r.left, window.innerWidth - VIEWPORT_MARGIN - r.right);

    const dy = clampInto(0, VIEWPORT_MARGIN - r.top, window.innerHeight - VIEWPORT_MARGIN - r.bottom);

    el.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : '';
  });

  return createPortal(
    <div ref={ref} id={id} className={`gantt-tooltip${className ? ` ${className}` : ''}`} role="tooltip" style={{ left, top }}>
      {children}
    </div>,
    document.body,
  );
}
