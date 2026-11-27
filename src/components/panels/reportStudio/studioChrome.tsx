import { memo, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/components/icons';
import { PORTALED_MENU_SELECTOR } from '@/hooks/useClickOutside';
import type { ReportStudioStep } from '@/utils/reportSettings';

const FIRST_CONTROL = [
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled])',
  'button:not([disabled]):not([tabindex="-1"])',
  '[tabindex="0"]',
].join(', ');

export const StepHead = memo(function StepHead({ step, index, open, title, summary, warn, changed, onToggle, onKeyDown, register }: {
  step: ReportStudioStep;
  index: number;
  open: boolean;
  title: string;
  summary: string;
  warn: boolean;
  changed: boolean;
  onToggle: (step: ReportStudioStep) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>, step: ReportStudioStep) => void;
  register: (step: ReportStudioStep, el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={el => register(step, el)}
      type="button"
      className="rs-step-head"
      aria-expanded={open}
      aria-controls={`rs-step-${step}`}
      aria-description={open && warn ? summary : undefined}
      title={open ? (warn ? summary : undefined) : summary}
      onClick={() => onToggle(step)}
      onKeyDown={e => onKeyDown(e, step)}
      data-rs-step-head={step}
    >
      <span className="rs-step-num" data-changed={changed ? 'true' : undefined} aria-hidden="true">{index + 1}</span>
      <span className="rs-step-text">
        <span className="rs-step-title">
          {title}
          {open && warn && <Icon id="status.warning" size={14} className="rs-step-warn" data-rs-step-warn={step} />}
        </span>
        {!open && <span className="rs-step-summary" data-warn={warn ? 'true' : undefined} data-rs-summary={step}>{summary}</span>}
      </span>
      <Icon id="tree.expand" size={16} className="rs-chevron" />
    </button>
  );
});

export function StepReset({ step, label, disabled, onReset }: {
  step: ReportStudioStep;
  label: string;
  disabled: boolean;
  onReset: () => void;
}) {
  return (
    <button type="button" className="rs-icon-btn rs-step-reset" disabled={disabled} onClick={onReset}
      title={label} aria-label={label} data-rs-reset={step}>
      <Icon id="table.columns-reset" size={14} />
    </button>
  );
}

const POP_MARGIN = 12;
const POP_MAX_H = 560;
const POP_AVOID_GAP = 8;
const DRAG_THRESHOLD = 4;

interface PopRect { left: number; top: number; right: number; bottom: number }

function workArea(node: HTMLElement): PopRect {
  const screen = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  const root = node.closest<HTMLElement>('[data-rs-studio]');
  if (!root) return screen;
  const r = root.getBoundingClientRect();
  const area = { left: Math.max(0, r.left), top: Math.max(0, r.top), right: Math.min(screen.right, r.right), bottom: Math.min(screen.bottom, r.bottom) };
  const side = root.querySelector<HTMLElement>(':scope > .rs-sidebar')?.getBoundingClientRect();
  if (side && side.width > 0) {
    if (side.left <= area.left + 1) area.left = Math.max(area.left, side.right);
    else area.right = Math.min(area.right, side.left);
  }
  return area;
}

export function StepPopover({ anchor, title, closeLabel, openInSidebarLabel, onClose, onOpenInSidebar, children, dataKey, avoidRef, headAction }: {
  anchor: { x: number; y: number };
  title: string;
  headAction?: ReactNode;
  closeLabel: string;
  openInSidebarLabel: string;
  onClose: () => void;
  onOpenInSidebar: () => void;
  children: ReactNode;
  dataKey: string;
  avoidRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight?: number }>({ left: anchor.x + 12, top: anchor.y });
  const [dragged, setDragged] = useState<{ left: number; top: number; key: string } | null>(null);
  const anchorKey = `${anchor.x},${anchor.y}`;
  const free = dragged?.key === anchorKey ? dragged : null;
  const returnFocus = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const place = () => {
      const w = node.offsetWidth;
      const area = workArea(node);
      const minLeft = area.left + POP_MARGIN;
      const maxLeft = Math.max(minLeft, area.right - POP_MARGIN - w);
      let left: number;
      if (free) {
        left = Math.min(Math.max(free.left, minLeft), maxLeft);
      } else {
        left = anchor.x + POP_MARGIN;
        if (left + w > area.right - POP_MARGIN) left = anchor.x - w - POP_MARGIN;
        left = Math.min(Math.max(left, minLeft), maxLeft);
      }
      const avoid = avoidRef?.current?.getBoundingClientRect();
      const overAvoid = !!avoid && avoid.width > 0 && left < avoid.right + POP_AVOID_GAP && left + w > avoid.left - POP_AVOID_GAP;
      const areaBottom = area.bottom - POP_MARGIN;
      const bottom = overAvoid ? Math.min(areaBottom, avoid.top - POP_AVOID_GAP) : areaBottom;
      const minTop = area.top + POP_MARGIN;
      const maxHeight = Math.max(160, Math.min(POP_MAX_H, bottom - minTop));
      const h = Math.min(node.offsetHeight, maxHeight);
      const wanted = free ? free.top : anchor.y - 24;
      const top = Math.min(Math.max(minTop, wanted), Math.max(minTop, bottom - h));
      setPos(prev => (prev.left === left && prev.top === top && prev.maxHeight === maxHeight ? prev : { left, top, maxHeight }));
    };
    place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(node);
    window.addEventListener('resize', place);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [anchor.x, anchor.y, dataKey, avoidRef, free]);

  const onHeadPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, select')) return;
    const node = ref.current;
    if (!node) return;
    const handle = e.currentTarget;
    const start = node.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!moved) {
        moved = true;
        handle.setPointerCapture?.(pointerId);
      }
      ev.preventDefault();
      setDragged({ left: start.left + dx, top: start.top + dy, key: anchorKey });
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  useEffect(() => {
    returnFocus.current = document.activeElement;
    const node = ref.current;
    if (node && !node.contains(document.activeElement)) {
      const body = node.querySelector<HTMLElement>('[data-rs-pop-body]');
      (body?.querySelector<HTMLElement>(FIRST_CONTROL) ?? node.querySelector<HTMLElement>(FIRST_CONTROL))?.focus();
    }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); } };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (node && !node.contains(target) && !(target as HTMLElement).closest?.(`[data-rs-rail-step], [data-rs-fab-export], [data-rs-undo], .rs-page, .ui-select-menu, [role="listbox"], .task-grid-column-chooser, ${PORTALED_MENU_SELECTOR}`)) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
      if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus({ preventScroll: true });
    };
  }, [dataKey]);

  return (
    <div ref={ref} className="rs-pop ui-pop" role="dialog" aria-label={title} style={{ left: pos.left, top: pos.top, maxHeight: pos.maxHeight }} data-rs-popover={dataKey}>
      <div className="rs-pop-head" onPointerDown={onHeadPointerDown} data-rs-pop-drag>
        <span className="rs-step-title flex-1">{title}</span>
        {headAction}
        <button type="button" className="ops-textlink" onClick={onOpenInSidebar}>{openInSidebarLabel}</button>
        <button type="button" className="rs-icon-btn" onClick={onClose} aria-label={closeLabel} title={closeLabel} data-rs-pop-close>
          <Icon id="ui.close" size={16} />
        </button>
      </div>
      {children}
    </div>
  );
}

export function UndoToast({ text, undoLabel, onUndo, onDismiss }: { text: string; undoLabel: string; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(timer);
  }, [text, onDismiss]);
  return (
    <div className="ops-toast toast-info rs-undo" role="status" data-rs-undo>
      <span>{text}</span>
      <button type="button" className="ops-textlink" onClick={onUndo} data-rs-undo-button>{undoLabel}</button>
    </div>
  );
}
