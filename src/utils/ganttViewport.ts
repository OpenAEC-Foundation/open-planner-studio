// Kleine registratie van het zichtbare Gantt-tijdvenster (fase 2.7, §3.3) + de gedeelde
// fit-to-project-berekening.
// GanttCanvas registreert bij elke render de werkelijk gemeten breedte van het primaire
// tijdlijnpaneel, zodat store-acties zoals `setTimeScale` de
// recenter-ankerformule (viewportmidden vasthouden) kunnen toepassen zonder dat de
// store aan React/DOM hangt. Headless (tests) blijft de breedte null → geen recenter.

import { parseDate, diffCalendarDays, addCalendarDays, formatDate } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import { maxGanttZoom, TIMESCALE_ZOOM } from '@/engine/renderer/timelineTiers';

/**
 * Zoomstap van de IN-/UITZOOM-knoppen en -sneltoetsen (K-item 34). Additief, niet
 * vermenigvuldigend — dat laatste is het wiel (×1.1), een bewust ander gebaar.
 *
 * Dit was DRIE losse waarden, en twee ervan waren fout: `ribbonConfig` en `ribbonWidgets` zoomden
 * in met +10 maar uit met −5, terwijl de sneltoets beide op 10 had. Één keer in- en weer uitzoomen
 * met de knoppen bracht je dus niet terug waar je begon, en herhaald klikken liet de zoom weglopen.
 * Er stond geen enkele toelichting bij de −5; alles wijst op een typefout die nooit is opgevallen
 * omdat er geen plek was waar de twee waarden naast elkaar stonden.
 */
export const ZOOM_STEP = 10;

/** Zoomniveau waar "Zoom herstellen" (knop, Ctrl+0 en de kale 0-toets) naartoe gaat. Stond los
 *  gedeclareerd in `GanttCanvas.tsx` én `useZoomShortcuts.ts`, plus als kaal getal in
 *  `ribbonWidgets.tsx`. */
export const DEFAULT_ZOOM = 30;

/** Dagen links-padding die het canvas vóór de vroegste taak toevoegt: de renderer-origin op
 *  scrollX=0 is (effectiveViewStart − ORIGIN_PADDING_DAYS). Gedeeld door GanttCanvas (render),
 *  useZoomShortcuts (Ctrl+0-fit) en de open-fit (fileSlice.requestFitToProject → GanttCanvas). */
export const ORIGIN_PADDING_DAYS = 14;

export interface TimelineZoomResult {
  zoom: number;
  scrollX: number;
}

/**
 * Cursor-geankerde zoom binnen één timelinepaneel. `anchorX` is altijd lokaal aan dat paneel:
 * x=0 is de linker tijdlijnrand en er wordt dus geen externe DOM-kolom meer afgetrokken.
 */
export function computeTimelineZoom(
  currentZoom: number,
  requestedZoom: number,
  scrollX: number,
  anchorX: number,
  maxZoom: number,
): TimelineZoomResult {
  const zoom = Math.max(0.5, Math.min(maxZoom, requestedZoom));
  if (zoom === currentZoom) return { zoom, scrollX };
  const daysUnderCursor = (anchorX + scrollX) / currentZoom;
  return {
    zoom,
    scrollX: Math.max(0, daysUnderCursor * zoom - anchorX),
  };
}

export interface SplitPaneWidths {
  primary: number;
  secondary: number;
}

/** Verdeel uitsluitend de ruimte naast de splitter over de twee timelinepanelen. */
export function computeSplitPaneWidths(
  totalWidth: number,
  ratio: number,
  splitterWidth: number,
): SplitPaneWidths {
  const available = Math.max(0, totalWidth - Math.max(0, splitterWidth));
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const primary = available * clampedRatio;
  return { primary, secondary: available - primary };
}

/**
 * Dezelfde verdeling als {@link computeSplitPaneWidths}, uitgedrukt als breed ondersteunde CSS.
 * `calc(20% - 1px)` is gelijk aan `(100% - 5px) × 0,2`, zonder te leunen op CSS Level 4-
 * vermenigvuldiging die nog niet in iedere ingebouwde webview beschikbaar is.
 */
export function splitPanePrimaryWidthCss(ratio: number, splitterWidth: number): string {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const clampedSplitter = Math.max(0, splitterWidth);
  return `calc(${clampedRatio * 100}% - ${clampedSplitter * clampedRatio}px)`;
}

export interface AnchoredZoomInput {
  currentZoom: number;
  currentScrollX: number;
  requestedZoom: number;
  /** Cursorpositie in pixels, gemeten in het coördinatenstelsel van de aanroeper. */
  anchorX: number;
  /** X-oorsprong van de tijdlijn binnen datzelfde coördinatenstelsel. */
  chartOriginX: number;
  maxZoom: number;
}

/**
 * Eén zoomankerformule voor beide Gantt-panes. De datum die vóór de zoom onder de cursor lag blijft
 * daar na de zoom liggen; `null` betekent dat klemmen geen wijziging oplevert.
 */
export function computeAnchoredZoom(input: AnchoredZoomInput): { zoom: number; scrollX: number } | null {
  const chartAnchorX = input.anchorX - input.chartOriginX;
  const result = computeTimelineZoom(
    input.currentZoom,
    input.requestedZoom,
    input.currentScrollX,
    chartAnchorX,
    input.maxZoom,
  );
  return result.zoom === input.currentZoom ? null : result;
}

/**
 * Effectieve tijdas-oorsprong (de datum die op scrollX = 0 valt) — DE ene bron voor die formule.
 *
 * De opgeslagen `viewStartDate` staat standaard op "vandaag" en houdt geen rekening met taken die
 * eerder beginnen; omdat de horizontale scrollbar (en de `setScroll`-klem) alleen scrollX >= 0
 * toestaan, is alles links van de oorsprong onbereikbaar. Vandaar: pin de oorsprong op de vroegste
 * taakstart (of `viewStartDate`, wat eerder is) minus {@link ORIGIN_PADDING_DAYS}.
 *
 * Deze functie woont HIER, en niet bij de renderopties, om een reden: hij hoort bij
 * `ORIGIN_PADDING_DAYS` en bij zijn twee andere gebruikers ({@link computeScrollToDate} hieronder,
 * en indirect de fit-berekening). Tot K-item 33 stond de lus drie keer los in de codebase — in de
 * render-memo, in `GanttCanvas.revealTaskIfOffscreen` en hier — alleen bij elkaar gehouden door
 * commentaarregels die pariteit beloofden. Zet hem dus niet in een module die `ganttViewport`
 * importeert: dat maakt hergebruik hier onmogelijk (circulaire import) en de derde kopie
 * onvermijdelijk.
 *
 * Verliesvrij t.o.v. de rauwe `Date`-variant voor elke geldige ISO-datum vanaf jaar 100:
 * `parseDate` kapt altijd naar UTC-middernacht en `addCalendarDays` houdt die vast, dus de
 * format/parse-heenweg voegt niets toe en haalt niets weg.
 *
 * TWEE uitzonderingen, allebei gemeten — "byte-identiek" is dus te sterk:
 *  - Onder jaar 100 loopt de twee-cijferige-jaarafbeelding van `Date.UTC` ertussen
 *    (`0100-01-03` → `1999-12-20` in plaats van `0099-12-20`). Praktisch onbereikbaar.
 *  - Een ONPARSEERBARE datum (leeg, corrupte import) wordt afgevangen: `formatDate`/`toISOString`
 *    zou dan `RangeError: Invalid time value` gooien, waar de oude inline-lussen een Invalid Date
 *    doorgaven en de aanroeper met NaN verder rekende. Zelfde val als beschreven in
 *    `taskDefaults.ts`.
 *
 *    Een eerdere versie liet die throw staan met als argument "de render-memo roept dezelfde
 *    `formatDate` al aan en sneuvelt dus eerder". Dat argument is ONJUIST, en dat is met een
 *    review vastgesteld: `App.tsx` zet `isFullPanel` op de tabbladen Tabel/Relaties/IFC/Rapport
 *    (en bij een niet-gedockt resourcepaneel), en dan is `GanttCanvas` helemaal niet gemonteerd.
 *    `useKeyboardShortcuts()` staat wél onvoorwaardelijk in `AppContent`, en `nav.scrollToToday`
 *    (Ctrl/Cmd+Home) heeft geen `when`-guard. Daar loopt dus een pad naar deze functie zonder dat
 *    er ooit een render-memo overheen is gegaan. Of een importer werkelijk zo'n datum kan
 *    opleveren is niet vastgesteld — maar een guard van één regel is goedkoper dan dat uitzoeken.
 */
export function computeEffectiveViewStart(
  tasks: Task[],
  viewStartDate: string,
  navigationStartDates: string[] = [],
): string {
  let earliest = parseDate(viewStartDate);
  for (const task of tasks) {
    const start = task.time.earlyStart || task.time.scheduleStart || task.time.lateStart;
    if (start) {
      const d = parseDate(start);
      if (d.getTime() < earliest.getTime()) earliest = d;
    }
  }
  // Een lege Gantt is niet automatisch een tijdloze Gantt: een kalender kan al concrete
  // uitzonderingen bevatten voordat de eerste taak bestaat. Neem het begin van zulke periodes mee
  // als mogelijke oorsprong, zodat een oudere vrije dag niet links van de onbereikbare scrollgrens
  // blijft liggen. Ongeldige importwaarden slaan we net als ongeldige taakdatums veilig over.
  for (const date of navigationStartDates) {
    const parsed = parseDate(date);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < earliest.getTime()) earliest = parsed;
  }
  // Onparseerbaar (leeg, corrupte import): geef de invoer onveranderd terug in plaats van te
  // gooien. De aanroeper rekent dan met een datum die net zo min klopt als zijn invoer, maar de
  // app blijft staan — en dat was ook het gedrag vóór K-item 33.
  if (Number.isNaN(earliest.getTime())) return viewStartDate;
  return formatDate(addCalendarDays(earliest, -ORIGIN_PADDING_DAYS));
}

/** Resultaat van {@link computeFitToProject}: de zoom + scroll waarmee het HELE project
 *  (vroegste start … laatste finish) edge-to-edge in het tijdlijnpaneel past. */
export interface FitToProject {
  zoom: number;
  viewStartDate: string;
  scrollX: number;
}

/**
 * Bereken de zoom + scroll zodat de volledige projectperiode edge-to-edge in het zichtbare
 * tijdlijnpaneel past. ÉÉN bron van waarheid, gedeeld door de Ctrl+0-handler (useZoomShortcuts)
 * en de open-fit (GanttCanvas op het `pendingFit`-signaal) — zodat beide nooit uit elkaar lopen.
 *
 * `timelineWidth` is de daadwerkelijk gemeten paneelbreedte. Spiegelt de veldvolgorde van
 * `GanttCanvas.effectiveViewStart` /
 * content-width zodat de span exact klopt met wat de renderer tekent. Geeft `null` bij een leeg
 * project of een niet-zinnige breedte (≤ 0) — de aanroeper houdt dan zijn eigen gedrag aan.
 */
export function computeFitToProject(
  tasks: Task[],
  timelineWidth: number,
  enableQuarterHourZoom: boolean,
  enableHourPlanning = false,
  navigationStartDates: string[] = [],
): FitToProject | null {
  if (tasks.length === 0 || timelineWidth <= 0) return null;
  let minStart: string | null = null;
  let maxFinish: string | null = null;
  for (const task of tasks) {
    // LET OP de `|| s` op de finish-keten: die staat hier WEL en in `computeContentSpanDays`
    // (ganttRenderOptions.ts) NIET. Een taak met alleen een start telt dus mee voor de Ctrl+0-fit
    // maar niet voor de contentbreedte, en kan daardoor buiten `maxScrollX` vallen terwijl de fit
    // er wel naartoe zoomt. Bestaand verschil, niet door K-item 33 ontstaan, en met de huidige
    // `createDefaultTaskTime` (die altijd een `scheduleFinish` zet) alleen bereikbaar via een
    // corrupte import of een externe adapter. Genoteerd als open punt in docs/TODO.md; deze regel
    // staat er zodat de volgende lezer niet denkt dat het een slordigheid is.
    const s = task.time.earlyStart || task.time.scheduleStart || task.time.lateStart;
    const f = task.time.earlyFinish || task.time.scheduleFinish || task.time.lateFinish || s;
    if (s && (!minStart || s < minStart)) minStart = s;
    if (f && (!maxFinish || f > maxFinish)) maxFinish = f;
  }
  if (!minStart || !maxFinish) return null;
  const span = Math.max(1, diffCalendarDays(parseDate(minStart), parseDate(maxFinish)) + 1);
  const max = maxGanttZoom(enableQuarterHourZoom, enableHourPlanning);
  const zoom = Math.max(0.5, Math.min(max, timelineWidth / span));
  // De renderer kan zijn oorsprong verder naar links trekken voor kalenderuitzonderingen. Een fit
  // die blind met alleen `ORIGIN_PADDING_DAYS` rekent, zet dan wel de juiste zoom maar laat het
  // project te ver naar rechts staan. Gebruik exact zijn effectieve oorsprong en pan van daaruit
  // naar de eerste taak; zonder zulke uitzonderingen blijft dit 14 × zoom en dus byte-identiek.
  const effectiveStart = computeEffectiveViewStart(tasks, minStart, navigationStartDates);
  const scrollX = Math.max(0, diffCalendarDays(parseDate(effectiveStart), parseDate(minStart)) * zoom);
  return { zoom, viewStartDate: minStart, scrollX };
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
 * onaangeroerd. Deelt sinds K-item 33 LETTERLIJK {@link computeEffectiveViewStart} met de renderer
 * in plaats van een eigen kopie van die lus, zodat de gesprongen positie 1-op-1 klopt met wat er
 * getekend wordt — die pariteit werd hiervóór alleen door deze commentaarregel beloofd. Gebruikt
 * door `Ctrl/Cmd+Home` (sneltoets-register, fase 2.10 golf 1).
 */
export function computeScrollToDate(date: string | undefined, state: ScrollToDateState): number {
  const target = date || state.project.statusDate || formatDate(new Date());
  const effectiveViewStart = parseDate(computeEffectiveViewStart(state.tasks, state.view.viewStartDate));

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

/**
 * Pure formule voor de scrolbare grenzen (fase 2.8a QA, fix 2) — DE ene bron voor `drawPrimary`
 * (`GanttCanvas.tsx`, elke render) én de "spring naar taak"-sprong (issue #65). Die laatste zet
 * zelf een NIEUWE zoom/rijtelling en moet de grenzen dus VOORUIT berekenen in plaats van de
 * grenzen van de vorige render te lezen (die staan pas ná de eerstvolgende rAF-paint klaar) —
 * zonder deze gedeelde functie was dat een tweede kopie van dezelfde twee regels geweest, en
 * precies dat patroon (een formule die twee keer los staat) is al drie keer in dit bestand de
 * bron van een regressie gebleken (zie `ZOOM_STEP`/`computeEffectiveViewStart` hierboven).
 */
export function computeGanttScrollBounds(
  contentWidth: number,
  viewRowCount: number,
  rowHeight: number,
  headerHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): { maxScrollX: number; maxScrollY: number } {
  return {
    maxScrollX: Math.max(0, contentWidth - canvasWidth),
    maxScrollY: Math.max(0, viewRowCount * rowHeight - (canvasHeight - headerHeight)),
  };
}

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

/** Aandeel van de bruikbare breedte dat de taakbalk zelf inneemt bij "spring naar taak" (issue
 *  #65): hoog genoeg voor duidelijke context ervoor/erna, laag genoeg om niet edge-to-edge te
 *  ogen zoals `computeFitToProject`. */
const FOCUS_TASK_WIDTH_FRACTION = 0.2;

/** Onder-/bovengrens van het zoomniveau bij "spring naar taak": zonder grens verschrompelt een
 *  taak van maanden tot een streepje, en zoomt een milestone zo ver in dat alle context
 *  verdwijnt. Geankerd aan de bestaande tijdschaal-presets (kwartaal…dag) zodat het resultaat
 *  nooit een willekeurig getal is maar altijd een niveau dat de gebruiker ook via het lint kan
 *  kiezen. */
export const FOCUS_TASK_MIN_ZOOM = TIMESCALE_ZOOM.quarter;
export const FOCUS_TASK_MAX_ZOOM = TIMESCALE_ZOOM.day;

export interface FocusTaskHorizontal {
  zoom: number;
  scrollX: number;
}

/**
 * Zoom + horizontale scroll voor "spring naar taak" (issue #65, WBS-sprongknop bij afhankelijk-
 * heden): de taakbalk krijgt een vast aandeel van de bruikbare breedte en wordt gecentreerd —
 * bewust anders dan `computeFitToProject` (heel project, edge-to-edge) en `computeScrollToDate`/
 * `GanttCanvas.revealTaskIfOffscreen` (scroll-only, tegen de linkerrand, zoom ongewijzigd).
 *
 * `durationDays`/`midDayOffset` zijn al opgeloste dageenheden (fracties toegestaan, voor
 * uur-taken) — de aanroeper kent de datums/hour-mode-logica al (dezelfde conventie als
 * `revealTaskIfOffscreen`), dus dit blijft een pure functie zonder Date-parsing.
 */
export function computeFocusTaskHorizontal(
  durationDays: number,
  midDayOffset: number,
  timelineWidth: number,
): FocusTaskHorizontal {
  const duration = Math.max(1, durationDays);
  const rawZoom = (timelineWidth * FOCUS_TASK_WIDTH_FRACTION) / duration;
  const zoom = Math.max(FOCUS_TASK_MIN_ZOOM, Math.min(FOCUS_TASK_MAX_ZOOM, rawZoom));
  const scrollX = Math.max(0, midDayOffset * zoom - timelineWidth / 2);
  return { zoom, scrollX };
}

/**
 * Verticale scroll voor "spring naar taak": centreert rij `rowIndex` (0-based, index in
 * `viewRows`) in de zichtbare canvas-hoogte. Zelfde `rowToY`-formule als `GanttRenderer`
 * (`headerHeight + rowIndex * rowHeight - scrollY`, zie `GanttRenderer.ts:295`), hier omgekeerd
 * opgelost naar `scrollY`.
 */
export function computeFocusTaskScrollY(
  rowIndex: number,
  rowHeight: number,
  headerHeight: number,
  canvasHeight: number,
): number {
  const visibleHeight = canvasHeight - headerHeight;
  return Math.max(0, rowIndex * rowHeight + rowHeight / 2 - visibleHeight / 2);
}
