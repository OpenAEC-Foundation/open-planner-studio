export function tourAnchorSelector(anchor: string): string {
  const value = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(anchor)
    : anchor.replace(/["\\]/g, '\\$&');
  return `[data-tour-anchor="${value}"]`;
}

export function findTourAnchorRect(anchor: string, root: ParentNode = document): DOMRect | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  root.querySelectorAll(tourAnchorSelector(anchor)).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  });
  if (left === Infinity) return null;
  return new DOMRect(left, top, right - left, bottom - top);
}

export function ribbonTabFallback(anchor: string): string | null {
  const m = /^ribbon(?:-group)?:([^:]+):/.exec(anchor);
  return m ? `ribbon-tab:${m[1]}` : null;
}
