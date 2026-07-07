// Kleine, dependency-vrije registratie van het zichtbare Gantt-tijdvenster (fase 2.7, §3.3).
// GanttCanvas registreert bij elke render de breedte van het primaire chart-gedeelte
// (containerbreedte − takentabel), zodat store-acties zoals `setTimeScale` de
// recenter-ankerformule (viewportmidden vasthouden) kunnen toepassen zonder dat de
// store aan React/DOM hangt. Headless (tests) blijft de breedte null → geen recenter.

/** Dagen links-padding die het canvas vóór de vroegste taak toevoegt: de renderer-origin op
 *  scrollX=0 is (effectiveViewStart − ORIGIN_PADDING_DAYS). Gedeeld door GanttCanvas (render),
 *  useZoomShortcuts (fit-to-project) en viewSlice.focusProjectStart (openen bij projectperiode). */
export const ORIGIN_PADDING_DAYS = 14;

let chartWidth: number | null = null;

export function setGanttChartWidth(width: number): void {
  chartWidth = Number.isFinite(width) && width > 0 ? width : null;
}

export function getGanttChartWidth(): number | null {
  return chartWidth;
}

/**
 * Max. scrollbare grenzen (fase 2.8a QA, fix 2): `setScroll` klemde `scrollX`/`scrollY` alleen
 * naar beneden (`>= 0`), zonder bovengrens — een taakbalk-laag die volledig verdwijnt na een
 * (per ongeluk) verticale overscroll (bv. platte wheel-scroll in "position"-modus buiten de
 * rechtsboven-hoek, of horizontaal scrollen na een extreme zoom-uit/-in-cyclus) kwam daardoor
 * NOOIT meer in beeld terug — geen enkele render-pass herstelde het, want er was simpelweg geen
 * geldige boventgrens om naar terug te klemmen. GanttCanvas registreert bij elke render de
 * werkelijke inhoudsgrenzen (rijen×rowHeight, totale dagbreedte×zoom) zodat `setScroll` daar
 * altijd binnen blijft. Headless (tests): beide blijven null → geen bovengrens (ongewijzigd
 * gedrag, zelfde precedent als `chartWidth` hierboven).
 */
let maxScrollX: number | null = null;
let maxScrollY: number | null = null;

export function setGanttScrollBounds(bounds: { maxScrollX: number; maxScrollY: number }): void {
  maxScrollX = Number.isFinite(bounds.maxScrollX) ? Math.max(0, bounds.maxScrollX) : null;
  maxScrollY = Number.isFinite(bounds.maxScrollY) ? Math.max(0, bounds.maxScrollY) : null;
}

export function clampGanttScroll(x: number, y: number): { x: number; y: number } {
  return {
    x: maxScrollX !== null ? Math.min(x, maxScrollX) : x,
    y: maxScrollY !== null ? Math.min(y, maxScrollY) : y,
  };
}
