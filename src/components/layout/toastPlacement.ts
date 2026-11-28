export interface Rect { left: number; top: number; right: number; bottom: number }

export type ToastPlacement =
  | { kind: 'default' }
  | { kind: 'side'; left: number; right: number; bottom: number }
  | { kind: 'underModal' }
  | { kind: 'above'; bottom: number };

export const MIN_SIDE_WIDTH = 220;
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

const FLOATING_SELECTOR = '[role="dialog"][aria-modal="true"], [data-ops-guide-panel]';
const AVOID_SELECTOR = '[data-ops-toast-avoid]';

export function toastAvoidElements(doc: Document): HTMLElement[] {
  return Array.from(doc.querySelectorAll<HTMLElement>(`${FLOATING_SELECTOR}, ${AVOID_SELECTOR}`));
}

const layoutListeners = new Set<() => void>();

export function subscribeToastLayout(listener: () => void): () => void {
  layoutListeners.add(listener);
  return () => { layoutListeners.delete(listener); };
}

export function notifyToastLayoutChange(): void {
  for (const listener of layoutListeners) listener();
}

export function measureToastPlacement(doc: Document, win: Window): ToastPlacement {
  const rectsOf = (selector: string): Rect[] => Array.from(doc.querySelectorAll<HTMLElement>(selector))
    .map(el => el.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0)
    .map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
  return computeToastPlacement(
    { width: win.innerWidth, height: win.innerHeight },
    rectsOf(FLOATING_SELECTOR),
    rectsOf(AVOID_SELECTOR),
  );
}
