import { memo, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/components/icons';
import type { ReportStudioStep } from '@/utils/reportSettings';

// De vaste delen rond de stappen van het nieuwe Rapport-tabblad (issue #817): de kop van een stap, het
// zwevende venster bij een ingeklapte zijbalk en de melding na "Standaard". Apart van `GanttReportStudio`,
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

/** Rand tussen het venster en de rand van het scherm, en de hoogste hoogte van het venster. */
const POP_MARGIN = 12;
const POP_MAX_H = 560;
/** Ruimte tussen het venster en de zwevende exportknop eronder. */
const POP_AVOID_GAP = 8;

/**
 * Klein venster met een stap, naast de rand of naast het aangeklikte deel van het papier. `children` is de
 * stapinhoud (met eigen scrollvak) plus de stapvoet, die zo altijd onderaan in beeld blijft.
 *
 * `avoidRef`: een element dat het venster vrij laat (de zwevende exportknop linksonder). Ligt het venster
 * in de breedte boven die knop, dan eindigt het erboven en wordt het zo nodig lager (knownbug 947): zo blijft
 * exporteren bereikbaar zonder het venster te sluiten.
 */
export function StepPopover({ anchor, title, closeLabel, openInSidebarLabel, onClose, onOpenInSidebar, children, dataKey, avoidRef }: {
  anchor: { x: number; y: number };
  title: string;
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
  const returnFocus = useRef<Element | null>(null);
  // De sluitfunctie via een ref: een nieuwe functie bij elke render mag het effect hieronder niet opnieuw
  // laten lopen. Dat zette de focus na elke toetsaanslag terug (typen "abc" gaf "a").
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // De plek volgt ook de maat van het venster: groeit de inhoud (een melding erbij, de kolomkiezer open)
  // of wordt het scherm kleiner, dan schuift het venster omhoog tot het past. Is het hoger dan het scherm,
  // dan houdt de CSS het op schermhoogte en scrolt de stapinhoud binnen het venster (`.rs-pop-scroll`).
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const place = () => {
      const w = node.offsetWidth;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = anchor.x + POP_MARGIN;
      if (left + w > vw - POP_MARGIN) left = Math.max(POP_MARGIN, anchor.x - w - POP_MARGIN);
      // De onderkant: de rand van het scherm, of de bovenkant van de knop als het venster erboven ligt.
      const avoid = avoidRef?.current?.getBoundingClientRect();
      const overAvoid = !!avoid && avoid.width > 0 && left < avoid.right + POP_AVOID_GAP && left + w > avoid.left - POP_AVOID_GAP;
      const bottom = overAvoid ? Math.min(vh - POP_MARGIN, avoid.top - POP_AVOID_GAP) : vh - POP_MARGIN;
      const maxHeight = Math.max(160, Math.min(POP_MAX_H, bottom - POP_MARGIN));
      // De hoogte met de nieuwe grens: de CSS houdt het venster op `maxHeight`, de stapinhoud scrolt erin.
      const h = Math.min(node.offsetHeight, maxHeight);
      const top = Math.min(Math.max(POP_MARGIN, anchor.y - 24), Math.max(POP_MARGIN, bottom - h));
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
  }, [anchor.x, anchor.y, dataKey, avoidRef]);

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
      if (node && !node.contains(target) && !(target as HTMLElement).closest?.('[data-rs-rail-step], [data-rs-fab-export], [data-rs-undo], .rs-page, .ui-select-menu, [role="listbox"]')) onCloseRef.current();
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
      <div className="rs-pop-head">
        <span className="rs-step-title flex-1">{title}</span>
        <button type="button" className="ops-textlink" onClick={onOpenInSidebar}>{openInSidebarLabel}</button>
        <button type="button" className="rs-icon-btn" onClick={onClose} aria-label={closeLabel} title={closeLabel} data-rs-pop-close>
          <Icon id="ui.close" size={16} />
        </button>
      </div>
      {children}
    </div>
  );
}

/** Na "Standaard": een korte melding met "Ongedaan maken" (verdwijnt na 8 s). */
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
