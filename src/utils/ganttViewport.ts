// Kleine registratie van het zichtbare Gantt-tijdvenster (fase 2.7, §3.3) + de gedeelde
// fit-to-project-berekening.
// GanttCanvas registreert bij elke render de breedte van het primaire chart-gedeelte
// (containerbreedte − takentabel), zodat store-acties zoals `setTimeScale` de
// recenter-ankerformule (viewportmidden vasthouden) kunnen toepassen zonder dat de
// store aan React/DOM hangt. Headless (tests) blijft de breedte null → geen recenter.

import { parseDate, diffCalendarDays } from '@/utils/dateUtils';
import type { Task } from '@/types/task';

/** Dagen links-padding die het canvas vóór de vroegste taak toevoegt: de renderer-origin op
 *  scrollX=0 is (effectiveViewStart − ORIGIN_PADDING_DAYS). Gedeeld door GanttCanvas (render),
 *  useZoomShortcuts (Ctrl+0-fit) en de open-fit (fileSlice.requestFitToProject → GanttCanvas). */
export const ORIGIN_PADDING_DAYS = 14;

/** Resultaat van {@link computeFitToProject}: de zoom + scroll waarmee het HELE project
 *  (vroegste start … laatste finish) edge-to-edge in het chart-gedeelte past. */
export interface FitToProject {
  zoom: number;
  viewStartDate: string;
  scrollX: number;
}

/**
 * Bereken de zoom + scroll zodat de volledige projectperiode edge-to-edge in het zichtbare
 * chart-gedeelte past. ÉÉN bron van waarheid, gedeeld door de Ctrl+0-handler (useZoomShortcuts)
 * en de open-fit (GanttCanvas op het `pendingFit`-signaal) — zodat beide nooit uit elkaar lopen.
 *
 * `usableWidth` = containerbreedte − takentabelbreedte (de store kent die breedte niet; de
 * aanroeper meet ze). Spiegelt de veldvolgorde van `GanttCanvas.effectiveViewStart` /
 * content-width zodat de span exact klopt met wat de renderer tekent. Geeft `null` bij een leeg
 * project of een niet-zinnige breedte (≤ 0) — de aanroeper houdt dan zijn eigen gedrag aan.
 */
export function computeFitToProject(
  tasks: Task[],
  usableWidth: number,
  enableQuarterHourZoom: boolean,
): FitToProject | null {
  if (tasks.length === 0 || usableWidth <= 0) return null;
  let minStart: string | null = null;
  let maxFinish: string | null = null;
  for (const task of tasks) {
    const s = task.time.earlyStart || task.time.scheduleStart || task.time.lateStart;
    const f = task.time.earlyFinish || task.time.scheduleFinish || task.time.lateFinish || s;
    if (s && (!minStart || s < minStart)) minStart = s;
    if (f && (!maxFinish || f > maxFinish)) maxFinish = f;
  }
  if (!minStart || !maxFinish) return null;
  const span = Math.max(1, diffCalendarDays(parseDate(minStart), parseDate(maxFinish)) + 1);
  const max = enableQuarterHourZoom ? 1000 : 400;
  const zoom = Math.max(0.5, Math.min(max, usableWidth / span));
  // De renderer-origin op scrollX=0 is (minStart − ORIGIN_PADDING_DAYS); scroll door
  // ORIGIN_PADDING_DAYS·zoom zodat minStart op de chart-linkerrand landt en maxFinish exact op
  // de rechterrand → alles past edge-to-edge.
  return { zoom, viewStartDate: minStart, scrollX: ORIGIN_PADDING_DAYS * zoom };
}

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
