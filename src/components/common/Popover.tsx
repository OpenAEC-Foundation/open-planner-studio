import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useClickOutside } from '@/hooks/useClickOutside';

const BASE_PANEL_STYLE: CSSProperties = {
  position: 'fixed',
  width: 'max-content',
  background: 'var(--theme-dropdown-bg)',
  border: '1px solid var(--theme-border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-pop)',
};

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  panelStyle?: CSSProperties;
  panelClassName?: string;
  containerStyle?: CSSProperties;
  fitViewport?: boolean;
  panelRole?: 'dialog';
  panelAriaLabel?: string;
}

export const POPOVER_REPOSITION_EVENT = 'ops:popover-reposition';

const VIEWPORT_MARGIN = 8;

const VIEWPORT_MAX_WIDTH = `calc(100vw - ${2 * VIEWPORT_MARGIN}px)`;

function fitLeft(left: number, width: number): number {
  return Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN));
}

export function Popover({
  open, onClose, trigger, children, align = 'left', panelStyle, panelClassName, containerStyle, fitViewport = false,
  panelRole, panelAriaLabel,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const anchorRectRef = useRef<DOMRect | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const closeKeepingInput = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && panelRef.current?.contains(active)) active.blur();
    closeRef.current();
  };
  const closeKeepingInputRef = useRef(closeKeepingInput);
  closeKeepingInputRef.current = closeKeepingInput;
  useClickOutside(ref, closeKeepingInput, open, { extraRef: panelRef });

  useEffect(() => {
    if (!open) return;
    const container = ref.current;
    const focused = document.activeElement;
    const trigger = focused instanceof HTMLElement && container?.contains(focused) ? focused : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current();
      trigger?.focus();
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target === document || (target instanceof Node && container && target.contains(container))) {
        const anchor = anchorRectRef.current;
        const current = container?.getBoundingClientRect();
        if (anchor && current && (current.left !== anchor.left || current.right !== anchor.right || current.bottom !== anchor.bottom)) {
          closeKeepingInputRef.current();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const [panelPos, setPanelPos] = useState<CSSProperties | null>(null);
  const panelMounted = panelPos !== null;
  useLayoutEffect(() => {
    if (!open) { anchorRectRef.current = null; setPanelPos(null); return; }
    const place = () => {
      const trigger = ref.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      anchorRectRef.current = rect;
      const marginTop = typeof panelStyle?.marginTop === 'number' ? panelStyle.marginTop : 0;
      const fit: CSSProperties = fitViewport
        ? { maxHeight: Math.max(0, window.innerHeight - rect.bottom - marginTop - VIEWPORT_MARGIN) }
        : {};
      const width = panelRef.current?.offsetWidth ?? 0;
      const left = fitLeft(align === 'right' ? rect.right - width : rect.left, width);
      setPanelPos({ top: rect.bottom, left, minWidth: rect.width, ...fit });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener(POPOVER_REPOSITION_EVENT, place);
    const observer = panelRef.current ? new ResizeObserver(place) : null;
    if (panelRef.current) observer?.observe(panelRef.current);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener(POPOVER_REPOSITION_EVENT, place);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align, fitViewport, panelMounted]);

  const siteMaxWidth = panelStyle?.maxWidth;
  const maxWidth = siteMaxWidth === undefined
    ? VIEWPORT_MAX_WIDTH
    : `min(${typeof siteMaxWidth === 'number' ? `${siteMaxWidth}px` : siteMaxWidth}, ${VIEWPORT_MAX_WIDTH})`;

  return (
    <div ref={ref} style={{ position: 'relative', ...containerStyle }}>
      {trigger}
      {open && panelPos && createPortal(
        <div ref={panelRef} role={panelRole} aria-label={panelAriaLabel} className={panelClassName} style={{ ...BASE_PANEL_STYLE, ...panelPos, ...panelStyle, maxWidth }}>
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
