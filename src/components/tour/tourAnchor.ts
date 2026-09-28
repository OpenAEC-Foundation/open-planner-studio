/**
 * Ankers (`data-tour-anchor`) opzoeken — gedeeld door de rondleiding (`TourOverlay`) en het
 * begeleidingspaneel van extensies (`components/guide/GuidePanel.tsx`).
 *
 * Een anker is een attribuutwaarde, geen CSS-selector: de selector bouwen we hier zelf, met
 * `CSS.escape` zodat een vreemde waarde nooit een ongeldige selector oplevert.
 *
 * ANKERFORMAAT (ook in docs/extensions.md):
 *  - `ribbon-tab:<tab>`             — een linttab (ook `ribbon-tab:file`);
 *  - `ribbon-group:<tab>:<groupId>` — een lintgroep;
 *  - `ribbon:<tab>:<itemId>`        — een lintknop of lintwidget;
 *  - vaste ankers voor de hoofdpanelen (`ribbon-tabs`, `gantt-panel`, `properties-panel`,
 *    `histogram-strip`, `report-panel`, `backstage-examples`, `feedback-button`, `rail:<paneel>`,
 *    `status-bar`).
 */

export function tourAnchorSelector(anchor: string): string {
  const value = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(anchor)
    : anchor.replace(/["\\]/g, '\\$&');
  return `[data-tour-anchor="${value}"]`;
}

/**
 * De omhullende rechthoek van alle ZICHTBARE elementen met dit anker (een lintwidget kan uit
 * meerdere elementen bestaan), of `null` als er geen enkel zichtbaar element is.
 */
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

/**
 * Terugval voor een lintanker dat nu niet in beeld is omdat een ANDERE tab actief is: wijs dan de
 * tab aan die de gebruiker moet openen (`ribbon:planning:calendar` → `ribbon-tab:planning`).
 */
export function ribbonTabFallback(anchor: string): string | null {
  const m = /^ribbon(?:-group)?:([^:]+):/.exec(anchor);
  return m ? `ribbon-tab:${m[1]}` : null;
}
