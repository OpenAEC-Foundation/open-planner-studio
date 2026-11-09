import { memo, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/components/icons';
import type { ReportStudioStep } from '@/utils/reportSettings';

// De vaste delen rond de stappen van het nieuwe Rapport-tabblad (issue #817): de kop van een stap met
// "Herstel standaard", het zwevende venster bij een ingeklapte zijbalk en de melding na "Herstel standaard". Apart van `GanttReportStudio`,
// dat de stapinhoud en de toestand houdt.

/** Een stap zonder fouten bij het eerste bedienelement: velden, knoppen en het gekozen item van een groep. */
const FIRST_CONTROL = [
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled])',
  'button:not([disabled]):not([tabindex="-1"])',
  '[tabindex="0"]',
].join(', ');

/** De kop van één stap: nummer, titel en (dicht) de samenvatting. Apart en `memo`, zodat een klik in een
 *  stap niet alle koppen opnieuw rendert. Een stap met een melding toont open een waarschuwingsteken
 *  naast de titel; dicht kleurt de samenvatting. */
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

/**
 * "Herstel standaard" in de kop van de open stap en in de kop van het zwevende venster (check Ethan
 * 9-11-2026: de voetbalk met Standaard en Verder is weg). Dezelfde actie als vroeger in de voet, met
 * "Ongedaan maken" in de werkbalk boven het papier. Uit als de stap al op de standaard staat.
 */
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

/** Rand tussen het venster en de rand van het werkvlak, en de hoogste hoogte van het venster. */
const POP_MARGIN = 12;
const POP_MAX_H = 560;
/** Ruimte tussen het venster en de zwevende exportknop eronder. */
const POP_AVOID_GAP = 8;
/** Onder deze afstand (px) is een druk op de kop een klik, geen sleep (zoals `GuidePanel`). */
const DRAG_THRESHOLD = 4;

interface PopRect { left: number; top: number; right: number; bottom: number }

/**
 * Het werkvlak van het venster: het tabblad zonder de zijbalk (de rand met de stapknoppen blijft vrij), en
 * nooit buiten het scherm. Zonder tabblad (los gebruik) het hele scherm.
 */
function workArea(node: HTMLElement): PopRect {
  const screen = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  const root = node.closest<HTMLElement>('[data-rs-studio]');
  if (!root) return screen;
  const r = root.getBoundingClientRect();
  const area = { left: Math.max(0, r.left), top: Math.max(0, r.top), right: Math.min(screen.right, r.right), bottom: Math.min(screen.bottom, r.bottom) };
  const side = root.querySelector<HTMLElement>(':scope > .rs-sidebar')?.getBoundingClientRect();
  if (side && side.width > 0) {
    // De zijbalk staat aan het begin van de regel: links, in rtl rechts.
    if (side.left <= area.left + 1) area.left = Math.max(area.left, side.right);
    else area.right = Math.min(area.right, side.left);
  }
  return area;
}

/**
 * Klein venster met een stap, naast de rand of naast het aangeklikte deel van het papier. `children` is de
 * stapinhoud, met een eigen scrollvak; de kop met "Herstel standaard" blijft zo altijd in beeld.
 *
 * `avoidRef`: een element dat het venster vrij laat (de zwevende exportknop linksonder). Ligt het venster
 * in de breedte boven die knop, dan eindigt het erboven en wordt het zo nodig lager (knownbug 947): zo blijft
 * exporteren bereikbaar zonder het venster te sluiten.
 *
 * Het venster is te verslepen aan zijn kop (check Ethan 9-11-2026), op dezelfde manier als het gidspaneel
 * (`GuidePanel`): een druk op een knop in de kop blijft een klik. Het blijft binnen het werkvlak (`workArea`)
 * en boven de exportknop. Een nieuwe plek (een andere stap of een klik op het papier) zet het weer naast
 * dat deel.
 */
export function StepPopover({ anchor, title, closeLabel, openInSidebarLabel, onClose, onOpenInSidebar, children, dataKey, avoidRef, headAction }: {
  anchor: { x: number; y: number };
  title: string;
  /** Een knop in de kop vóór "In de zijbalk" (Herstel standaard). */
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
  // Zelf neergezet (gesleept): de linkerbovenhoek. Vervalt bij een nieuwe plek (`anchor`).
  const [dragged, setDragged] = useState<{ left: number; top: number; key: string } | null>(null);
  const anchorKey = `${anchor.x},${anchor.y}`;
  const free = dragged?.key === anchorKey ? dragged : null;
  const returnFocus = useRef<Element | null>(null);
  // De sluitfunctie via een ref: een nieuwe functie bij elke render mag het effect hieronder niet opnieuw
  // laten lopen. Dat zette de focus na elke toetsaanslag terug (typen "abc" gaf "a").
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // De plek volgt ook de maat van het venster: groeit de inhoud (een melding erbij, de kolomkiezer open)
  // of wordt het scherm kleiner, dan schuift het venster omhoog tot het past. Is het hoger dan het werkvlak,
  // dan houdt de CSS het op die hoogte en scrolt de stapinhoud binnen het venster (`.rs-pop-scroll`).
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
      // De onderkant: de rand van het werkvlak, of de bovenkant van de knop als het venster erboven ligt.
      const avoid = avoidRef?.current?.getBoundingClientRect();
      const overAvoid = !!avoid && avoid.width > 0 && left < avoid.right + POP_AVOID_GAP && left + w > avoid.left - POP_AVOID_GAP;
      const areaBottom = area.bottom - POP_MARGIN;
      const bottom = overAvoid ? Math.min(areaBottom, avoid.top - POP_AVOID_GAP) : areaBottom;
      const minTop = area.top + POP_MARGIN;
      const maxHeight = Math.max(160, Math.min(POP_MAX_H, bottom - minTop));
      // De hoogte met de nieuwe grens: de CSS houdt het venster op `maxHeight`, de stapinhoud scrolt erin.
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

  // Slepen aan de kop. Knoppen in de kop blijven gewone knoppen; de plek zelf houdt `place` binnen het
  // werkvlak en boven de exportknop.
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

  // Eén keer per geopende stap: de focus op het eerste bedienelement van de stap (niet op "In de zijbalk"),
  // terug naar waar hij vandaan kwam bij sluiten. Heeft de stap zelf al iets gefocust (de kolom die op het
  // papier is aangeklikt), dan blijft dat staan.
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
      if (node && !node.contains(target) && !(target as HTMLElement).closest?.('[data-rs-rail-step], [data-rs-fab-export], [data-rs-undo], .rs-page, .ui-select-menu, [role="listbox"], .task-grid-column-chooser')) onCloseRef.current();
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

/** Na "Herstel standaard": een korte melding met "Ongedaan maken" (verdwijnt na 8 s). */
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
