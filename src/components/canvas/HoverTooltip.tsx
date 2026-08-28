import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * De zwevende hover-tooltip (`.gantt-tooltip`), gerenderd via een portal naar `document.body`
 * met `position: fixed` — naar hetzelfde patroon als `Popover`/`Tooltip` elders in de app.
 *
 * Voorheen (issue #58) was dit een `position: absolute`-element binnen de dichtstbijzijnde
 * gepositioneerde voorouder, met een clip-berekening tegen die voorouders `overflow: hidden`
 * (de Gantt-pane). Issue #65 hergebruikt deze tooltip vanuit het eigenschappenpaneel — dat zelf
 * scrolt (`overflow-y-auto`) — waar diezelfde clip-aanname niet opgaat. De portal ontsnapt aan
 * ELKE omringende overflow-clip, dus de klem-logica hieronder hoeft alleen nog tegen het venster
 * te klemmen, niet tegen een positionerende ouder.
 *
 * `left`/`top` zijn VIEWPORT-coördinaten (dezelfde schaal als `MouseEvent.clientX/clientY`) —
 * de aanroeper geeft dus rechtstreeks `event.clientX ± offset` door, geen container-relatieve
 * berekening meer nodig.
 */

/** Marge tot de rand waarbinnen de tooltip moet blijven. */
const VIEWPORT_MARGIN = 8;
/** Horizontale afstand tussen cursor en tooltip: de offset die de aanroeper in `left` verwerkt.
 *  Alleen gebruikt om bij het spiegelen dezelfde ruimte aan de andere kant te laten. */
const CURSOR_GAP = 16;
/** Afstand tussen een bediening en de daaraan verankerde tooltip. */
const ANCHOR_GAP = 8;

/** Klem `v` in [lo, hi]; is dat interval leeg (doos past niet), dan wint `lo`. */
function clampInto(v: number, lo: number, hi: number): number {
  if (lo > hi) return lo;
  return Math.min(Math.max(v, lo), hi);
}

interface HoverTooltipProps {
  /** Positie in viewport-coördinaten (zie docstring hierboven). */
  left: number;
  top: number;
  children: ReactNode;
  /** De standaard volgt de muis; een bediening kan de tooltip liever vóór haar linkerrand tonen. */
  placement?: 'cursor' | 'before-anchor';
  /** Breedte van het anker, nodig voor de uitwijk naar de andere kant als links geen ruimte is. */
  anchorWidth?: number;
  /** Een bedieningstooltip mag zijn eigen zichtbare laag voor hit-testing gebruiken. */
  className?: string;
  /** Optioneel id voor aria-describedby op een verankerde bediening. */
  id?: string;
}

export function HoverTooltip({ left, top, children, placement = 'cursor', anchorWidth = 0, className, id }: HoverTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Bewust ZONDER dependency-array: de doos verandert ook van formaat door inhoud die niet in
  // `left`/`top` zit (andere taak, andere taal, andere lettergrootte).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.transform = '';
    const r = el.getBoundingClientRect();

    // Horizontaal: een ankerbediening krijgt normaal de tooltip links ervan. Is die zijde te
    // krap (zoals een rechterrail in RTL), dan wijkt hij naar rechts uit. Cursor-tooltips houden
    // hun bestaande spiegelgedrag aan de rechtervensterrand.
    const wanted = placement === 'before-anchor'
      ? r.left - r.width - ANCHOR_GAP >= VIEWPORT_MARGIN
        ? -(r.width + ANCHOR_GAP)
        : anchorWidth + ANCHOR_GAP
      : r.right > window.innerWidth - VIEWPORT_MARGIN
        ? -(r.width + CURSOR_GAP * 2)
        : 0;
    const dx = clampInto(wanted, VIEWPORT_MARGIN - r.left, window.innerWidth - VIEWPORT_MARGIN - r.right);

    // Verticaal: gewoon omhoog schuiven tot hij past.
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
