// Kleine registratie van het zichtbare Gantt-tijdvenster (fase 2.7, §3.3) + de gedeelde
// fit-to-project-berekening.
// GanttCanvas registreert bij elke render de breedte van het primaire chart-gedeelte
// (containerbreedte − takentabel), zodat store-acties zoals `setTimeScale` de
// recenter-ankerformule (viewportmidden vasthouden) kunnen toepassen zonder dat de
// store aan React/DOM hangt. Headless (tests) blijft de breedte null → geen recenter.

import { parseDate, diffCalendarDays, addCalendarDays, formatDate } from '@/utils/dateUtils';
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

/** Kleine marge (in dagen) die vóór de doeldatum zichtbaar blijft, zodat hij niet exact tegen de
 *  chart-linkerrand plakt (analoog aan de "reveal on select"-marge in
 *  GanttCanvas.revealTaskIfOffscreen). */
const SCROLL_TO_DATE_MARGIN_DAYS = 3;

/** Minimale slice van app-state die {@link computeScrollToDate} nodig heeft. Bewust GEEN
 *  `AppState`-import — dit bestand blijft headless/pure zoals de rest van `ganttViewport.ts`; een
 *  volledige store-snapshot (`useAppStore.getState()`) voldoet hier structureel aan. */
export interface ScrollToDateState {
  tasks: Task[];
  view: { viewStartDate: string; zoom: number };
  project: { statusDate?: string };
}

/**
 * Bereken de `scrollX` zodat `date` (default: `project.statusDate`, anders vandaag) links met een
 * kleine marge in het chart-gedeelte in beeld komt. Zoom en `view.viewStartDate` blijven
 * onaangeroerd. Gebruikt exact dezelfde `effectiveViewStart`-formule als `GanttCanvas`
 * (vroegste taakstart, of `view.viewStartDate` als niets vroeger is, min `ORIGIN_PADDING_DAYS`)
 * zodat de gesprongen positie 1-op-1 klopt met wat de renderer tekent. Gebruikt door
 * `Ctrl/Cmd+Home` (sneltoets-register, fase 2.10 golf 1).
 */
export function computeScrollToDate(date: string | undefined, state: ScrollToDateState): number {
  const target = date || state.project.statusDate || formatDate(new Date());

  let earliest = parseDate(state.view.viewStartDate);
  for (const task of state.tasks) {
    const s = task.time.earlyStart || task.time.scheduleStart || task.time.lateStart;
    if (s) {
      const d = parseDate(s);
      if (d.getTime() < earliest.getTime()) earliest = d;
    }
  }
  const effectiveViewStart = addCalendarDays(earliest, -ORIGIN_PADDING_DAYS);

  const days = diffCalendarDays(effectiveViewStart, parseDate(target));
  return Math.max(0, (days - SCROLL_TO_DATE_MARGIN_DAYS) * state.view.zoom);
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

/**
 * De laatst geregistreerde scrolbare grenzen (of `null` als er nog geen render-pass langskwam,
 * bv. headless). De wheel-handler leest `maxScrollY` om te bepalen of een verticale wheel-scroll
 * überhaupt iets kán bewegen: past het hele project verticaal in beeld (`maxScrollY <= 0`), dan
 * is verticaal scrollen een no-op en valt de handler terug op horizontaal — anders voelt het
 * gewone wiel "dood" (§keys-modus: plat wiel = verticaal per default).
 */
export function getGanttScrollBounds(): { maxScrollX: number | null; maxScrollY: number | null } {
  return { maxScrollX, maxScrollY };
}
