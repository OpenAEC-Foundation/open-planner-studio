/**
 * Plaatsing van de meldingenstapel naast open dialogen en plakkende actiebalken (B5, gebruikstest
 * rekenprofielen 24-09). De stapel staat standaard onderaan in het midden, en lag daardoor over de
 * voetknoppen (Annuleren/Toepassen) van de Projectinfo-dialoog en de nieuw-projectwizard: een modale
 * dialoog staat ook gecentreerd en reikt tot 5 vh van de onderrand.
 *
 * Regel: een melding bedekt nooit een knop van een open dialoog of van een `[data-ops-toast-avoid]`-balk.
 *  1. Staat er een modale dialoog open (`[role="dialog"][aria-modal="true"]`), dan gaat de stapel
 *     naast de dialoog, aan de kant met de meeste ruimte — mits daar een bruikbare breedte over is.
 *  2. Is die ruimte er niet (smal venster), dan zakt de stapel ONDER de dialoogbackdrop (z-laag):
 *     dan is hij gedimd zichtbaar en komt hij terug zodra de dialoog sluit, maar dekt hij niets af.
 *  3. Zonder dialoog maar met een zichtbare `[data-ops-toast-avoid]`-balk (de plakkende actiebalk van
 *     Backstage → Projectinfo) schuift de stapel boven die balk.
 * Puur rekenwerk op rechthoeken, zodat het los van de DOM te redeneren is; de host meet.
 */
export interface Rect { left: number; top: number; right: number; bottom: number }

export type ToastPlacement =
  | { kind: 'default' }
  | { kind: 'side'; left: number; right: number; bottom: number }
  | { kind: 'underModal' }
  | { kind: 'above'; bottom: number };

/** Minimale breedte van een zijstrook voor een leesbare melding. */
export const MIN_SIDE_WIDTH = 220;
/** Marge tussen stapel en dialoog/vensterrand, en de standaard ondermarge (`--sp-6`). */
export const TOAST_GAP = 16;
export const DEFAULT_BOTTOM = 24;

function union(rects: readonly Rect[]): Rect {
  return rects.reduce((u, r) => ({
    left: Math.min(u.left, r.left), top: Math.min(u.top, r.top),
    right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom),
  }));
}

export function computeToastPlacement(
  viewport: { width: number; height: number },
  modals: readonly Rect[],
  avoidBars: readonly Rect[],
): ToastPlacement {
  if (modals.length > 0) {
    const u = union(modals);
    const rightSpace = viewport.width - u.right - 2 * TOAST_GAP;
    const leftSpace = u.left - 2 * TOAST_GAP;
    if (Math.max(rightSpace, leftSpace) >= MIN_SIDE_WIDTH) {
      return rightSpace >= leftSpace
        ? { kind: 'side', left: u.right + TOAST_GAP, right: TOAST_GAP, bottom: DEFAULT_BOTTOM }
        : { kind: 'side', left: TOAST_GAP, right: viewport.width - u.left + TOAST_GAP, bottom: DEFAULT_BOTTOM };
    }
    return { kind: 'underModal' };
  }
  const bars = avoidBars.filter(r => r.bottom > 0 && r.top < viewport.height && r.right > r.left);
  if (bars.length > 0) {
    const top = Math.min(...bars.map(r => r.top));
    const bottom = Math.max(DEFAULT_BOTTOM, viewport.height - top + TOAST_GAP);
    return bottom === DEFAULT_BOTTOM ? { kind: 'default' } : { kind: 'above', bottom };
  }
  return { kind: 'default' };
}

export function samePlacement(a: ToastPlacement, b: ToastPlacement): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"]';
const AVOID_SELECTOR = '[data-ops-toast-avoid]';

/** De elementen waar de plaatsing van afhangt — de host hangt er een `ResizeObserver` aan. */
export function toastAvoidElements(doc: Document): HTMLElement[] {
  return Array.from(doc.querySelectorAll<HTMLElement>(`${MODAL_SELECTOR}, ${AVOID_SELECTOR}`));
}

// Signaal voor `[data-ops-toast-avoid]`-balken die mounten/unmounten (een dialoog meldt zich al via
// de dialoogstapel, zie `subscribeDialogStack`). Module-globaal, net als die stapel: puur UI-coördinatie.
const layoutListeners = new Set<() => void>();

/** Luistert naar het verschijnen/verdwijnen van een toast-mijdbalk. Geeft een opzegfunctie. */
export function subscribeToastLayout(listener: () => void): () => void {
  layoutListeners.add(listener);
  return () => { layoutListeners.delete(listener); };
}

/** Aan te roepen door een component met een `[data-ops-toast-avoid]`-balk bij mount en unmount. */
export function notifyToastLayoutChange(): void {
  for (const listener of layoutListeners) listener();
}

/** Meet de huidige DOM: zichtbare modale dialoogpanelen en toast-mijdbalken. */
export function measureToastPlacement(doc: Document, win: Window): ToastPlacement {
  const rectsOf = (selector: string): Rect[] => Array.from(doc.querySelectorAll<HTMLElement>(selector))
    .map(el => el.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0)
    .map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
  return computeToastPlacement(
    { width: win.innerWidth, height: win.innerHeight },
    rectsOf(MODAL_SELECTOR),
    rectsOf(AVOID_SELECTOR),
  );
}
