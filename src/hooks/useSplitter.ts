import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';

// Generieke sleep-splitter — hetzelfde patroon dat door de app werd gedupliceerd
// (rechterpaneel-rand in App, tabel/chart-rand in GanttCanvas): losse drag-state,
// window-listeners voor move/up, klem tussen min/max, en pas persisteren bij loslaten.
//
// Parametrisch zodat elke consument de geometrie zelf bepaalt:
//   - computeSize(e): rauwe grootte uit de muispositie. Voor een horizontale rand via
//     `panelWidthAtPointer` hieronder, die ook de gespiegelde shell in ar/fa kent;
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

// ── Horizontale paneelranden in ltr én rtl ─────────────────────────────────────────────────────
// De shell spiegelt in ar/fa (`dir="rtl"` op <html>): de rechterrail staat dan links, de takenlijst
// rechts van de Gantt en de rapportinstellingen rechts van de preview. Een paneel ligt dus niet vast
// LINKS of RECHTS maar aan de logische begin- of eindkant van zijn container. Elke horizontale
// splitter rekent zijn breedte hier, met één regel voor muis en toetsenbord: de rand gaat de kant op
// van de muis (of de pijl). Wie `clientX - rect.left` los opschrijft, neemt stil aan dat het paneel
// links staat — zo werd de takenlijst in ar/fa breder als je de grens naar RECHTS sleepte.

/** Aan welke kant van zijn container een paneel ligt: `inline-start` is links in ltr en rechts in
 *  rtl, `inline-end` omgekeerd. */
export type PanelSide = 'inline-start' | 'inline-end';
export type InlineDirection = 'ltr' | 'rtl';

/** De richting waarin de layout van `element` loopt (berekend, dus ook via `dir` op een voorouder).
 *  Lees hem van het element waarvan de flex/grid de panelen plaatst. */
export function inlineDirectionOf(element: Element | null | undefined): InlineDirection {
  const target = element ?? document.documentElement;
  return getComputedStyle(target).direction === 'rtl' ? 'rtl' : 'ltr';
}

/** Ligt het paneel fysiek links in zijn container (en is zijn RECHTERrand de sleeprand)? */
function panelOnLeft(side: PanelSide, direction: InlineDirection): boolean {
  return (side === 'inline-start') === (direction === 'ltr');
}

/** Breedte van een paneel aan kant `side` van `bounds` wanneer zijn sleeprand op `clientX` ligt. */
export function panelWidthAtPointer(
  clientX: number,
  bounds: { left: number; right: number },
  side: PanelSide,
  direction: InlineDirection,
): number {
  return panelOnLeft(side, direction) ? clientX - bounds.left : bounds.right - clientX;
}

/** Pijltoets op dezelfde sleeprand: de rand schuift de kant van de pijl op. `1` = paneel breder,
 *  `-1` = smaller. */
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
