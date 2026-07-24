import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { WorkCalendar } from '@/types/calendar';
import { parseDate, formatDate, addCalendarDays, getWeekNumber, diffCalendarDays, isoDayOfWeek } from '@/utils/dateUtils';
import type { DateNotation } from '@/types/view';
import type { Draw2D } from '@/services/pdf/draw2d';
import { CanvasDraw2D } from '@/services/pdf/canvasDraw2d';
// Print-vriendelijk kleurschema — nu uit het centrale themapalet (audit C5/P17). De naam
// `PRINT_COLORS` blijft behouden zodat de teken-aanroepen ongewijzigd zijn; waarden zijn identiek.
import { PRINT_PALETTE as PRINT_COLORS } from '@/engine/renderer/themePalette';
import { dateToX as axisDateToX } from '@/engine/renderer/timeAxis';

const ROW_HEIGHT = 24;
const PROJECT_HEADER_HEIGHT = 64;
const TIMELINE_HEADER_HEIGHT = 44;
const TOTAL_HEADER_HEIGHT = PROJECT_HEADER_HEIGHT + TIMELINE_HEADER_HEIGHT;
const TABLE_WIDTH = 450;
const FOOTER_HEIGHT = 50;
// Inter (gevendorde glyf-TTF, family 'InterPDF') eerst — deterministisch en inbedbaar zodat preview
// en de latere vector-export identieke measureText geven; systeem-stack als fallback zolang de
// FontFace nog niet geladen is (§5.1/K2 ontwerpdoc). De swap reflowt bewust bestaande exports.
const FONT_FAMILY = 'InterPDF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// Column definitions for the task table
const COL = {
  rowNum:    { x: 0,   w: 30  },
  wbs:       { x: 30,  w: 60  },
  name:      { x: 90,  w: 150 }, // flexible, actual end depends on remaining
  duration:  { x: 0,   w: 45  }, // positioned from right
  start:     { x: 0,   w: 70  },
  end:       { x: 0,   w: 70  },
  complete:  { x: 0,   w: 45  },
};

// Compute right-aligned column positions
function getColPositions() {
  const completeX = TABLE_WIDTH - COL.complete.w;
  const endX = completeX - COL.end.w;
  const startX = endX - COL.start.w;
  const durationX = startX - COL.duration.w;
  const nameW = durationX - COL.name.x;
  return {
    rowNum: { x: COL.rowNum.x, w: COL.rowNum.w },
    wbs: { x: COL.wbs.x, w: COL.wbs.w },
    name: { x: COL.name.x, w: nameW },
    duration: { x: durationX, w: COL.duration.w },
    start: { x: startX, w: COL.start.w },
    end: { x: endX, w: COL.end.w },
    complete: { x: completeX, w: COL.complete.w },
  };
}

/** Paper sizes at 96 DPI (landscape) */
const PAPER_SIZES: Record<string, { w: number; h: number }> = {
  'A4-landscape': { w: 1123, h: 794 },
  'A4-portrait': { w: 794, h: 1123 },
  'A3-landscape': { w: 1587, h: 1123 },
  'A3-portrait': { w: 1123, h: 1587 },
  'A1-landscape': { w: 3179, h: 2245 },
  'A1-portrait': { w: 2245, h: 3179 },
};

export interface PrintOptions {
  showCritical: boolean;
  showFloat: boolean;
  showDeps: boolean;
  showWeekends: boolean;
  showLegend: boolean;
  showTaskNames: boolean;
  showCompletion: boolean;
  autoFit: boolean;
  customZoom: number;
  paperSize: 'A4' | 'A3' | 'A1';
  orientation: 'landscape' | 'portrait';
  companyName: string;
  labels?: {
    noTasks: string;
    printed: string;
    legend: { criticalPath: string; normal: string; milestone: string; summary: string; float: string; completion: string };
    tableHeaders: { rowNum: string; wbs: string; taskName: string; start: string; end: string; duration: string; completion: string };
    page: string;
    of: string;
  };
  localizedMonths?: string[];
  localizedMonthsShort?: string[];
  locale?: string;
  projectStartDate?: string;
  projectEndDate?: string;
  projectAuthor?: string;
  /** Datumnotatie (taak #53) voor de header- en tabel-datums; ontbreekt ⇒ dd-mm-jjjj. */
  dateNotation?: DateNotation;
}

interface PrintTask extends Task {
  _depth?: number;
}

/**
 * Format een datum volgens de datumnotatie-instelling (taak #53). Zelfde reorder-semantiek als
 * `displayDate` in @/utils/displayDate, maar bewust een kleine lokale kopie zodat deze pure
 * print-service niet de React/zustand-store-hook hoeft te importeren. Ontbreekt de notatie ⇒
 * dd-mm-jjjj (ongewijzigd oud gedrag).
 */
function formatDutchDate(d: Date, notation: DateNotation = 'dmy'): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = String(d.getUTCFullYear());
  switch (notation) {
    case 'mdy': return `${month}-${day}-${year}`;
    case 'ymd': return `${year}-${month}-${day}`;
    default:    return `${day}-${month}-${year}`;
  }
}

/** Format duration as "15d" */
function formatDuration(days: number): string {
  return `${days}d`;
}

/** Format completion as "75%" */
function formatCompletion(completion: number): string {
  return `${Math.round(completion * 100)}%`;
}

/**
 * Kort `text` in met een ellipsis ('…') zodat het binnen `maxWidth` (in dezelfde px-eenheid als
 * `d2d.measureText`, d.w.z. de logische/CSS-px van de huidige transform) past. Verwacht dat
 * `d2d.font` al is ingesteld. Geeft '' terug als er geen ruimte is. Wordt gebruikt om tekst nooit
 * over een kolomrand/canvasrand te laten lopen (klachten 4 en 7).
 */
function fitText(d2d: Draw2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (d2d.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  // Binaire zoektocht naar de langste prefix die met ellipsis nog past.
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (d2d.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  if (lo === 0) return d2d.measureText(ellipsis).width <= maxWidth ? ellipsis : '';
  return text.slice(0, lo) + ellipsis;
}

/**
 * Teken een taaknaam-label bij een staaf (klachten 4b + 7). Probeert rechts van de staaf; loopt het
 * daar voorbij de canvasrand, dan wordt het links van de staaf getekend (rechts-uitgelijnd,
 * eindigend net vóór de staaf). Past het ook links niet, dan wordt het afgekort met '…' aan de kant
 * met de meeste ruimte. Zo valt een label nooit voorbij `canvasWidth` en overlapt het minder met
 * naburige staven.
 *
 * @param barRightX  x van de rechterrand van de staaf (incl. eventuele speling-indicator)
 * @param barLeftX   x van de linkerrand van de staaf
 * @param y          baseline-y voor de tekst (textBaseline blijft 'alphabetic')
 */
function drawBarLabel(
  d2d: Draw2D,
  name: string,
  barRightX: number,
  barLeftX: number,
  y: number,
  canvasWidth: number,
  color: string,
  font: string,
) {
  const pad = 4;
  const rightMargin = 10;
  d2d.font = font;
  d2d.fillStyle = color;
  d2d.textBaseline = 'alphabetic';
  const rightStart = barRightX + pad;
  const rightAvail = canvasWidth - rightMargin - rightStart;
  const leftEnd = barLeftX - pad;
  const leftAvail = leftEnd - TABLE_WIDTH; // chart begint bij TABLE_WIDTH
  const textWidth = d2d.measureText(name).width;

  if (textWidth <= rightAvail) {
    d2d.textAlign = 'left';
    d2d.fillText(name, rightStart, y);
  } else if (textWidth <= leftAvail) {
    d2d.textAlign = 'right';
    d2d.fillText(name, leftEnd, y);
  } else if (rightAvail >= leftAvail) {
    d2d.textAlign = 'left';
    d2d.fillText(fitText(d2d, name, rightAvail), rightStart, y);
  } else {
    d2d.textAlign = 'right';
    d2d.fillText(fitText(d2d, name, leftAvail), leftEnd, y);
  }
}

/**
 * Het resultaat van een print-render: de logische (CSS-px) afmetingen + de bevroren-kolombreedte.
 */
export interface RenderReportResult {
  width: number;
  height: number;
  /**
   * Breedte van de linker taaktabel-zone (de "frozen" naam-/info-kolommen links van het
   * Gantt-gebied), in LOGISCHE/CSS-px — dezelfde eenheid als `width`/`height` hierboven en als de
   * paginamaat die de PDF-laag (`miniPdf.canvasToPdfBytes`) uit `canvas.style.width` afleidt. Bewust
   * NIET in raster/device-px (`canvas.width` = logisch × devicePixelRatio): een andere golf gebruikt
   * dit om de tabelkolom per pagina te herhalen en werkt daarbij in hetzelfde logische coördinaten-
   * stelsel als de rest van het return-object; de raster-schaal komt daar apart bij.
   */
  tableWidth: number;
}

/**
 * Render het print-rapport tegen een {@link Draw2D}-backend die door `makeDraw2D` geleverd wordt.
 * Alle teken-logica is backend-agnostisch; `makeDraw2D(logicalW, logicalH)` wordt exact één keer
 * aangeroepen zodra de logische afmetingen bekend zijn (vóór er getekend wordt) en de teruggegeven
 * `Draw2D` ontvangt vervolgens alle teken-aanroepen. Zo delen de raster-preview (canvas-backend) en
 * de vector-export (pdf-lib-backend) exact dezelfde renderer.
 *
 * @returns De logische (CSS-px) afmetingen + de bevroren-kolombreedte ({@link RenderReportResult}).
 */
export function renderReport(
  makeDraw2D: (logicalW: number, logicalH: number) => Draw2D,
  tasks: Task[],
  sequences: Sequence[],
  calendar: WorkCalendar,
  projectName: string,
  options: PrintOptions,
): RenderReportResult {
  // Flatten and compute depth
  const flatTasks: PrintTask[] = [];
  const depthMap = new Map<string, number>();

  const addRecursive = (task: Task, depth: number) => {
    depthMap.set(task.id, depth);
    flatTasks.push(task);
    const children = tasks.filter(t => t.parentId === task.id);
    for (const child of children) {
      addRecursive(child, depth + 1);
    }
  };

  const roots = tasks.filter(t => !t.parentId);
  for (const root of roots) {
    addRecursive(root, 0);
  }
  for (const task of tasks) {
    if (!flatTasks.find(t => t.id === task.id)) {
      depthMap.set(task.id, 0);
      flatTasks.push(task);
    }
  }

  if (flatTasks.length === 0) {
    const d2d = makeDraw2D(600, 200);
    d2d.fillStyle = PRINT_COLORS.bg;
    d2d.fillRect(0, 0, 600, 200);
    d2d.fillStyle = PRINT_COLORS.textSecondary;
    d2d.font = `14px ${FONT_FAMILY}`;
    d2d.textAlign = 'center';
    d2d.fillText(options.labels?.noTasks ?? 'No tasks to display', 300, 100);
    return { width: 600, height: 200, tableWidth: TABLE_WIDTH };
  }

  // Compute date range
  let minDate = new Date(8640000000000000);
  let maxDate = new Date(0);
  for (const t of flatTasks) {
    const s = parseDate(t.time.earlyStart || t.time.scheduleStart);
    const f = parseDate(t.time.earlyFinish || t.time.scheduleFinish);
    if (s < minDate) minDate = s;
    if (f > maxDate) maxDate = f;

    // Include float in date range
    if (options.showFloat && t.time.totalFloat > 0) {
      const floatEnd = addCalendarDays(f, t.time.totalFloat);
      if (floatEnd > maxDate) maxDate = floatEnd;
    }
  }

  // Add padding days
  minDate = addCalendarDays(minDate, -7);
  maxDate = addCalendarDays(maxDate, 14);

  const totalDays = diffCalendarDays(minDate, maxDate);

  // Calculate zoom: auto-fit or custom
  const paperKey = `${options.paperSize}-${options.orientation}`;
  const paper = PAPER_SIZES[paperKey] || PAPER_SIZES['A3-landscape'];
  const margins = 20; // left + right margins in px
  const availableChartWidth = paper.w - TABLE_WIDTH - margins;

  let zoom: number;
  if (options.autoFit && totalDays > 0) {
    zoom = availableChartWidth / totalDays;
    zoom = Math.max(5, Math.min(40, zoom));
  } else {
    zoom = options.customZoom || 22;
  }

  const chartWidth = totalDays * zoom;
  const canvasWidth = TABLE_WIDTH + chartWidth;
  const canvasHeight = TOTAL_HEADER_HEIGHT + flatTasks.length * ROW_HEIGHT + FOOTER_HEIGHT;

  // Build holiday set
  const holidaySet = new Set<string>();
  for (const h of calendar.holidays) {
    const start = parseDate(h.startDate);
    const end = parseDate(h.endDate);
    const days = diffCalendarDays(start, end);
    for (let i = 0; i <= days; i++) {
      holidaySet.add(formatDate(addCalendarDays(start, i)));
    }
  }

  // Verkrijg de Draw2D-backend zodra de logische afmetingen bekend zijn (canvas-backend neemt de
  // dpr-scale + maat-setup over; vector-backend werkt 1:1 in logische px).
  const d2d = makeDraw2D(canvasWidth, canvasHeight);

  // Helper: date to X. Gedeeld met GanttRenderer/HistogramRenderer via `timeAxis.dateToX`
  // (issue #21 punt 5, fase 0-consolidatie); print heeft geen scrollX ⇒ `scrollX=0`. `minDate`/
  // `date` komen hier altijd uit `parseDate` (middernacht UTC), dus de fractionele
  // `daysFromStart`-berekening in `axisDateToX` is voor print altijd een geheel getal — identiek
  // aan de vroegere `diffCalendarDays(minDate, date) * zoom` (die intern ook afrondt, maar op een
  // al-geheel verschil is dat een no-op).
  const dateToX = (date: Date) => axisDateToX(date, minDate, TABLE_WIDTH, zoom, 0);
  const chartTop = TOTAL_HEADER_HEIGHT;
  const chartBottom = canvasHeight - FOOTER_HEIGHT;
  const rowToY = (i: number) => TOTAL_HEADER_HEIGHT + i * ROW_HEIGHT;

  const cols = getColPositions();

  // ==================== DRAW ====================

  // Background
  d2d.fillStyle = PRINT_COLORS.bg;
  d2d.fillRect(0, 0, canvasWidth, canvasHeight);

  // ---- PROJECT HEADER BOX ----
  drawProjectHeader(d2d, canvasWidth, projectName, options);

  // ---- GANTT CHART AREA ----

  // Grid background - weekend/holiday shading
  if (options.showWeekends) {
    for (let i = 0; i < totalDays; i++) {
      const date = addCalendarDays(minDate, i);
      const x = dateToX(date);
      const dow = isoDayOfWeek(date);
      const dateStr = formatDate(date);
      const isHoliday = holidaySet.has(dateStr);
      const isWeekend = dow === 6 || dow === 7;

      if (isHoliday) {
        d2d.fillStyle = PRINT_COLORS.gridHoliday;
        d2d.fillRect(x, chartTop, zoom, chartBottom - chartTop);
      } else if (isWeekend) {
        d2d.fillStyle = PRINT_COLORS.gridWeekend;
        d2d.fillRect(x, chartTop, zoom, chartBottom - chartTop);
      }
    }
  }

  // Alternating row backgrounds in chart area
  for (let i = 0; i < flatTasks.length; i++) {
    if (i % 2 === 0) {
      d2d.fillStyle = 'rgba(249, 250, 251, 0.3)';
      d2d.fillRect(TABLE_WIDTH, rowToY(i), chartWidth, ROW_HEIGHT);
    }
  }

  // Vertical grid lines
  for (let i = 0; i < totalDays; i++) {
    const date = addCalendarDays(minDate, i);
    const x = dateToX(date);
    const dow = isoDayOfWeek(date);

    d2d.strokeStyle = PRINT_COLORS.grid;
    d2d.lineWidth = dow === 1 ? 0.8 : 0.2;
    d2d.beginPath();
    d2d.moveTo(x, chartTop);
    d2d.lineTo(x, chartBottom);
    d2d.stroke();
  }

  // Horizontal grid lines in chart area
  for (let i = 0; i <= flatTasks.length; i++) {
    const y = rowToY(i);
    d2d.strokeStyle = PRINT_COLORS.grid;
    d2d.lineWidth = 0.3;
    d2d.beginPath();
    d2d.moveTo(TABLE_WIDTH, y);
    d2d.lineTo(canvasWidth, y);
    d2d.stroke();
  }

  // Today line
  const today = new Date();
  const todayX = dateToX(today);
  if (todayX > TABLE_WIDTH && todayX < canvasWidth) {
    d2d.strokeStyle = PRINT_COLORS.today;
    d2d.lineWidth = 1.5;
    d2d.setLineDash([5, 3]);
    d2d.beginPath();
    d2d.moveTo(todayX, chartTop);
    d2d.lineTo(todayX, chartBottom);
    d2d.stroke();
    d2d.setLineDash([]);

    // "Today" label
    d2d.fillStyle = PRINT_COLORS.today;
    d2d.font = `bold 7px ${FONT_FAMILY}`;
    d2d.textAlign = 'center';
    d2d.fillText('Today', todayX, chartTop - 2);
    d2d.textAlign = 'left';
  }

  // Dependency arrows
  if (options.showDeps) {
    drawDependencies(d2d, flatTasks, sequences, dateToX, rowToY, zoom);
  }

  // Task bars
  const barHeight = ROW_HEIGHT * 0.55;
  const barOffset = (ROW_HEIGHT - barHeight) / 2;

  for (let i = 0; i < flatTasks.length; i++) {
    const task = flatTasks[i];
    const y = rowToY(i) + barOffset;

    if (task.isMilestone) {
      // Milestone diamond
      const date = parseDate(task.time.earlyStart || task.time.scheduleStart);
      const x = dateToX(date) + zoom / 2;
      const cy = y + barHeight / 2;
      const size = barHeight * 0.45;

      d2d.fillStyle = PRINT_COLORS.milestone;
      d2d.beginPath();
      d2d.moveTo(x, cy - size);
      d2d.lineTo(x + size, cy);
      d2d.lineTo(x, cy + size);
      d2d.lineTo(x - size, cy);
      d2d.closePath();
      d2d.fill();

      // Task name label (rechts van de ruit, valt terug naar links/ellipsis bij de rand)
      if (options.showTaskNames) {
        drawBarLabel(d2d, task.name, x + size, x - size, cy + 3, canvasWidth, PRINT_COLORS.text, `9px ${FONT_FAMILY}`);
      }
    } else if (task.childIds.length > 0) {
      // Summary bracket bar
      const start = parseDate(task.time.earlyStart || task.time.scheduleStart);
      const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
      const x1 = dateToX(start);
      const x2 = dateToX(end) + zoom;
      const width = Math.max(x2 - x1, 3);
      const barY = y + barHeight * 0.3;
      const barH = barHeight * 0.3;

      d2d.fillStyle = PRINT_COLORS.summary;
      d2d.fillRect(x1, barY, width, barH);

      // Left triangle
      d2d.beginPath();
      d2d.moveTo(x1, barY);
      d2d.lineTo(x1, barY + barH + 5);
      d2d.lineTo(x1 + 6, barY + barH);
      d2d.closePath();
      d2d.fill();

      // Right triangle
      d2d.beginPath();
      d2d.moveTo(x1 + width, barY);
      d2d.lineTo(x1 + width, barY + barH + 5);
      d2d.lineTo(x1 + width - 6, barY + barH);
      d2d.closePath();
      d2d.fill();

      // Task name label (rechts van de balk, valt terug naar links/ellipsis bij de rand)
      if (options.showTaskNames) {
        drawBarLabel(d2d, task.name, x1 + width, x1, y + barHeight / 2 + 3, canvasWidth, PRINT_COLORS.text, `bold 9px ${FONT_FAMILY}`);
      }
    } else {
      // Normal task bar
      const start = parseDate(task.time.earlyStart || task.time.scheduleStart);
      const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
      const x1 = dateToX(start);
      const x2 = dateToX(end) + zoom;
      const width = Math.max(x2 - x1, 3);
      const isCritical = task.time.isCritical && options.showCritical;
      const color = isCritical ? PRINT_COLORS.critical : PRINT_COLORS.normal;

      // Main bar with rounded corners
      d2d.fillStyle = color;
      d2d.roundRect(x1, y, width, barHeight, 3);
      d2d.fill();

      // Completion overlay (darker shade)
      if (options.showCompletion && task.time.completion > 0) {
        const progressWidth = width * task.time.completion;
        d2d.fillStyle = isCritical ? PRINT_COLORS.criticalDark : PRINT_COLORS.normalDark;
        d2d.roundRect(x1, y, progressWidth, barHeight, 3);
        d2d.fill();
      }

      // Float indicator
      if (options.showFloat && task.time.totalFloat > 0 && !task.time.isCritical) {
        const floatWidth = task.time.totalFloat * zoom;
        d2d.fillStyle = PRINT_COLORS.float + '40';
        d2d.roundRect(x2, y + barHeight * 0.2, floatWidth, barHeight * 0.6, 2);
        d2d.fill();
      }

      // Task name label (rechts van de balk + eventuele speling; valt terug naar links/ellipsis bij de rand)
      if (options.showTaskNames) {
        const hasFloat = options.showFloat && task.time.totalFloat > 0 && !task.time.isCritical;
        const barRightX = x2 + (hasFloat ? task.time.totalFloat * zoom : 0);
        drawBarLabel(d2d, task.name, barRightX, x1, y + barHeight / 2 + 3, canvasWidth, PRINT_COLORS.text, `9px ${FONT_FAMILY}`);
      }
    }
  }

  // ---- TIMELINE HEADER ----
  drawTimelineHeader(d2d, canvasWidth, minDate, totalDays, zoom, dateToX, options);

  // ---- TASK TABLE ----
  drawTaskTable(d2d, flatTasks, depthMap, canvasHeight, cols, options);

  // ---- FOOTER ----
  drawFooter(d2d, canvasWidth, canvasHeight, projectName, options);

  return { width: canvasWidth, height: canvasHeight, tableWidth: TABLE_WIDTH };
}


/**
 * Render het print-rapport naar een canvas (raster/preview). Dunne wrapper over {@link renderReport}
 * met de canvas-backend: alle teken-logica leeft in `renderReport`, hier wordt alleen de Draw2D-
 * backend gekozen. Geeft de logische (CSS) afmetingen terug.
 *
 * `renderScale` overschrijft de raster-vs-logisch-multiplier (`canvas.width = logicalWidth *
 * renderScale`); default `window.devicePixelRatio || 2` zodat de on-screen preview z'n bestaande
 * gedrag houdt. De PDF-raster-export geeft een hogere vaste schaal door (zie `computeHighResScale`
 * in `@/utils/miniPdf`) zodat de geëxporteerde rasterresolutie niet afhangt van de schermdichtheid
 * van de exporterende gebruiker — een 1x/headless browser zou anders een wazig 96-DPI-beeld inbedden.
 */
export function renderPrintCanvas(
  canvas: HTMLCanvasElement,
  tasks: Task[],
  sequences: Sequence[],
  calendar: WorkCalendar,
  projectName: string,
  options: PrintOptions,
  renderScale?: number,
): RenderReportResult {
  const dpr = renderScale ?? (window.devicePixelRatio || 2);
  return renderReport(
    (w, h) => new CanvasDraw2D(canvas, w, h, dpr),
    tasks, sequences, calendar, projectName, options,
  );
}


/** Draw the project header box at the top of the page */
function drawProjectHeader(
  d2d: Draw2D,
  canvasWidth: number,
  projectName: string,
  options: PrintOptions,
) {
  const hh = PROJECT_HEADER_HEIGHT;

  // Background
  d2d.fillStyle = PRINT_COLORS.bg;
  d2d.fillRect(0, 0, canvasWidth, hh);

  // Border
  d2d.strokeStyle = PRINT_COLORS.borderDark;
  d2d.lineWidth = 1;
  d2d.strokeRect(0.5, 0.5, canvasWidth - 1, hh - 1);

  // Right-aligned branding — eerst tekenen + meten, zodat we de projectnaam ernaast kunnen inkorten
  // en overlap voorkomen (klacht 7).
  const brandText = 'Open Planner Studio';
  d2d.fillStyle = PRINT_COLORS.textSecondary;
  d2d.font = `8px ${FONT_FAMILY}`;
  d2d.textBaseline = 'middle';
  d2d.textAlign = 'right';
  d2d.fillText(brandText, canvasWidth - 10, 16);
  const brandWidth = d2d.measureText(brandText).width;

  // Project name (large, bold) — inkorten zodat hij niet tot in de branding loopt
  d2d.fillStyle = PRINT_COLORS.text;
  d2d.font = `bold 14px ${FONT_FAMILY}`;
  d2d.textBaseline = 'middle';
  d2d.textAlign = 'left';
  const nameMaxW = (canvasWidth - 10 - brandWidth - 12) - 10;
  d2d.fillText(fitText(d2d, projectName, nameMaxW), 10, 16);

  // Row 2: Company | Author | Print date | Version
  d2d.font = `9px ${FONT_FAMILY}`;
  d2d.fillStyle = PRINT_COLORS.textSecondary;
  const row2Y = 34;
  const rowMaxW = canvasWidth - 20; // binnen de paginabreedte houden (klacht 7)

  const companyLabel = options.companyName || '';
  const authorLabel = options.projectAuthor || '';
  const printLocale = options.locale ?? 'nl';
  const printDate = new Date().toLocaleDateString(printLocale, { day: '2-digit', month: 'long', year: 'numeric' });

  let row2Text = '';
  if (companyLabel) row2Text += companyLabel;
  if (authorLabel) row2Text += (row2Text ? '  |  ' : '') + authorLabel;
  row2Text += (row2Text ? '  |  ' : '') + `${options.labels?.printed ?? 'Printed:'} ${printDate}`;

  d2d.fillText(fitText(d2d, row2Text, rowMaxW), 10, row2Y);

  // Row 3: Project dates and duration
  const row3Y = 48;
  let row3Text = '';
  if (options.projectStartDate) {
    const sd = parseDate(options.projectStartDate);
    row3Text += `Start: ${formatDutchDate(sd, options.dateNotation)}`;
  }
  if (options.projectEndDate) {
    const ed = parseDate(options.projectEndDate);
    row3Text += (row3Text ? '  |  ' : '') + `Eind: ${formatDutchDate(ed, options.dateNotation)}`;
  }
  if (options.projectStartDate && options.projectEndDate) {
    const sd = parseDate(options.projectStartDate);
    const ed = parseDate(options.projectEndDate);
    const dur = diffCalendarDays(sd, ed);
    row3Text += `  |  Duur: ${dur}d`;
  }

  d2d.fillText(fitText(d2d, row3Text, rowMaxW), 10, row3Y);

  d2d.textAlign = 'left';
  d2d.textBaseline = 'alphabetic';
}


/** Draw the timeline header with month/week/day rows */
function drawTimelineHeader(
  d2d: Draw2D,
  canvasWidth: number,
  minDate: Date,
  totalDays: number,
  zoom: number,
  dateToX: (d: Date) => number,
  options: PrintOptions,
) {
  const top = PROJECT_HEADER_HEIGHT;
  const h = TIMELINE_HEADER_HEIGHT;
  const monthRowH = h / 2;
  const weekRowH = h / 2;

  // Background
  d2d.fillStyle = PRINT_COLORS.headerBg;
  d2d.fillRect(0, top, canvasWidth, h);

  // Bottom border
  d2d.strokeStyle = PRINT_COLORS.border;
  d2d.lineWidth = 1;
  d2d.beginPath();
  d2d.moveTo(0, top + h);
  d2d.lineTo(canvasWidth, top + h);
  d2d.stroke();

  // Mid border between month and week rows
  d2d.strokeStyle = PRINT_COLORS.grid;
  d2d.lineWidth = 0.5;
  d2d.beginPath();
  d2d.moveTo(TABLE_WIDTH, top + monthRowH);
  d2d.lineTo(canvasWidth, top + monthRowH);
  d2d.stroke();

  const months = options.localizedMonths ?? ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

  let lastMonth = -1;
  let lastWeek = -1;
  // Rechterrand (x) van het laatst getekende maand-/weeklabel, om overlap te vermijden (klacht 7).
  let lastMonthLabelRight = -Infinity;
  let lastWeekLabelRight = -Infinity;

  for (let i = 0; i < totalDays; i++) {
    const date = addCalendarDays(minDate, i);
    const x = dateToX(date);
    const month = date.getUTCMonth();
    const weekNum = getWeekNumber(date);
    const dow = isoDayOfWeek(date);

    // Month headers (capitalize first letter)
    if (month !== lastMonth) {
      lastMonth = month;
      const monthName = months[month];
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      const label = `${capitalizedMonth} ${date.getUTCFullYear()}`;

      // Vertical separator
      d2d.strokeStyle = PRINT_COLORS.border;
      d2d.lineWidth = 0.5;
      d2d.beginPath();
      d2d.moveTo(x, top);
      d2d.lineTo(x, top + monthRowH);
      d2d.stroke();

      // Alleen het label tekenen als het niet over het vorige maandlabel heen loopt (klacht 7);
      // liever een gat dan over-elkaar-lopende tekst.
      d2d.font = `bold 10px ${FONT_FAMILY}`;
      const monthLabelStart = x + 4;
      if (monthLabelStart >= lastMonthLabelRight + 6) {
        d2d.fillStyle = PRINT_COLORS.text;
        d2d.textBaseline = 'middle';
        d2d.textAlign = 'left';
        d2d.fillText(label, monthLabelStart, top + monthRowH / 2);
        lastMonthLabelRight = monthLabelStart + d2d.measureText(label).width;
      }
    }

    // Week headers
    if (dow === 1 && weekNum !== lastWeek) {
      lastWeek = weekNum;

      // Vertical separator
      d2d.strokeStyle = PRINT_COLORS.grid;
      d2d.lineWidth = 0.5;
      d2d.beginPath();
      d2d.moveTo(x, top + monthRowH);
      d2d.lineTo(x, top + h);
      d2d.stroke();

      // Alleen tekenen als er ruimte is t.o.v. het vorige weeklabel (klacht 7).
      const weekLabel = `W${weekNum}`;
      const weekLabelStart = x + 2;
      d2d.font = `9px ${FONT_FAMILY}`;
      if (weekLabelStart >= lastWeekLabelRight + 4) {
        d2d.fillStyle = PRINT_COLORS.textSecondary;
        d2d.textAlign = 'left';
        d2d.textBaseline = 'middle';
        d2d.fillText(weekLabel, weekLabelStart, top + monthRowH + weekRowH / 2);
        lastWeekLabelRight = weekLabelStart + d2d.measureText(weekLabel).width;
      }
    }

    // Day numbers if zoom is large enough
    if (zoom > 15) {
      const dayNum = date.getUTCDate();
      if (dow !== 6 && dow !== 7) { // Skip weekend days for cleaner display
        d2d.fillStyle = PRINT_COLORS.textSecondary;
        d2d.font = `7px ${FONT_FAMILY}`;
        d2d.textAlign = 'center';
        d2d.textBaseline = 'bottom';
        d2d.fillText(String(dayNum), x + zoom / 2, top + h - 1);
      }
    }
  }

  // Table header area (left side of timeline header)
  d2d.fillStyle = PRINT_COLORS.headerBg;
  d2d.fillRect(0, top, TABLE_WIDTH, h);

  // Table column headers
  const cols = getColPositions();
  d2d.fillStyle = PRINT_COLORS.text;
  d2d.font = `bold 9px ${FONT_FAMILY}`;
  d2d.textBaseline = 'middle';
  d2d.textAlign = 'center';
  const headerY = top + h / 2;

  const th = options.labels?.tableHeaders;
  d2d.fillText(th?.rowNum ?? '#', cols.rowNum.x + cols.rowNum.w / 2, headerY);
  d2d.fillText(th?.wbs ?? 'WBS', cols.wbs.x + cols.wbs.w / 2, headerY);

  d2d.textAlign = 'left';
  d2d.fillText(th?.taskName ?? 'Taaknaam', cols.name.x + 4, headerY);

  d2d.textAlign = 'center';
  d2d.fillText(th?.duration ?? 'Duur', cols.duration.x + cols.duration.w / 2, headerY);
  d2d.fillText(th?.start ?? 'Start', cols.start.x + cols.start.w / 2, headerY);
  d2d.fillText(th?.end ?? 'Einde', cols.end.x + cols.end.w / 2, headerY);
  d2d.fillText(th?.completion ?? 'Volt.', cols.complete.x + cols.complete.w / 2, headerY);

  // Column separator lines in header
  d2d.strokeStyle = PRINT_COLORS.border;
  d2d.lineWidth = 0.5;
  const colBorders = [cols.wbs.x, cols.name.x, cols.duration.x, cols.start.x, cols.end.x, cols.complete.x, TABLE_WIDTH];
  for (const cx of colBorders) {
    d2d.beginPath();
    d2d.moveTo(cx, top);
    d2d.lineTo(cx, top + h);
    d2d.stroke();
  }

  // Bottom border for header
  d2d.strokeStyle = PRINT_COLORS.borderDark;
  d2d.lineWidth = 1;
  d2d.beginPath();
  d2d.moveTo(0, top + h);
  d2d.lineTo(TABLE_WIDTH, top + h);
  d2d.stroke();

  d2d.textBaseline = 'alphabetic';
  d2d.textAlign = 'left';
}


/** Draw the task table (left side) */
function drawTaskTable(
  d2d: Draw2D,
  flatTasks: PrintTask[],
  depthMap: Map<string, number>,
  canvasHeight: number,
  cols: ReturnType<typeof getColPositions>,
  options: PrintOptions,
) {
  const chartBottom = canvasHeight - FOOTER_HEIGHT;

  // Table background
  d2d.fillStyle = PRINT_COLORS.bg;
  d2d.fillRect(0, TOTAL_HEADER_HEIGHT, TABLE_WIDTH, chartBottom - TOTAL_HEADER_HEIGHT);

  // Task rows
  for (let i = 0; i < flatTasks.length; i++) {
    const task = flatTasks[i];
    const y = TOTAL_HEADER_HEIGHT + i * ROW_HEIGHT;
    const depth = depthMap.get(task.id) || 0;
    const textY = y + ROW_HEIGHT / 2;
    const indent = depth * 12;
    const isSummary = task.childIds.length > 0;

    // Alternating row background
    if (i % 2 === 0) {
      d2d.fillStyle = PRINT_COLORS.rowEven;
      d2d.fillRect(0, y, TABLE_WIDTH, ROW_HEIGHT);
    }

    // Row border
    d2d.strokeStyle = PRINT_COLORS.grid;
    d2d.lineWidth = 0.3;
    d2d.beginPath();
    d2d.moveTo(0, y + ROW_HEIGHT);
    d2d.lineTo(TABLE_WIDTH, y + ROW_HEIGHT);
    d2d.stroke();

    // Row number
    d2d.fillStyle = PRINT_COLORS.textSecondary;
    d2d.font = `8px ${FONT_FAMILY}`;
    d2d.textAlign = 'right';
    d2d.textBaseline = 'middle';
    d2d.fillText(String(i + 1), cols.rowNum.x + cols.rowNum.w - 4, textY);

    // WBS
    d2d.fillStyle = PRINT_COLORS.textSecondary;
    d2d.font = `8px ${FONT_FAMILY}`;
    d2d.textAlign = 'left';
    d2d.fillText(task.wbsCode || '', cols.wbs.x + 4, textY);

    // Name with indentation — afkorten met ellipsis i.p.v. hard clippen (klacht 4a)
    d2d.fillStyle = isSummary ? PRINT_COLORS.summary : PRINT_COLORS.text;
    d2d.font = isSummary ? `bold 9px ${FONT_FAMILY}` : `9px ${FONT_FAMILY}`;
    d2d.textAlign = 'left';
    const nameX = cols.name.x + 4 + indent;
    const nameAvail = cols.name.x + cols.name.w - 2 - nameX; // kleine padding vóór de kolomrand
    d2d.fillText(fitText(d2d, task.name, nameAvail), nameX, textY);

    // Duration
    d2d.fillStyle = PRINT_COLORS.textSecondary;
    d2d.font = `8px ${FONT_FAMILY}`;
    d2d.textAlign = 'right';
    d2d.textBaseline = 'middle';
    d2d.fillText(formatDuration(task.time.scheduleDuration), cols.duration.x + cols.duration.w - 4, textY);

    // Start date
    const startStr = task.time.earlyStart || task.time.scheduleStart;
    if (startStr) {
      const sd = parseDate(startStr);
      d2d.fillText(formatDutchDate(sd, options.dateNotation), cols.start.x + cols.start.w - 4, textY);
    }

    // End date
    const endStr = task.time.earlyFinish || task.time.scheduleFinish;
    if (endStr) {
      const ed = parseDate(endStr);
      d2d.fillText(formatDutchDate(ed, options.dateNotation), cols.end.x + cols.end.w - 4, textY);
    }

    // Completion
    if (options.showCompletion) {
      d2d.fillText(formatCompletion(task.time.completion), cols.complete.x + cols.complete.w - 4, textY);
    }

    d2d.textAlign = 'left';
    d2d.textBaseline = 'alphabetic';
  }

  // Column separator lines throughout the table
  d2d.strokeStyle = PRINT_COLORS.grid;
  d2d.lineWidth = 0.5;
  const colBorders = [cols.wbs.x, cols.name.x, cols.duration.x, cols.start.x, cols.end.x, cols.complete.x];
  for (const cx of colBorders) {
    d2d.beginPath();
    d2d.moveTo(cx, TOTAL_HEADER_HEIGHT);
    d2d.lineTo(cx, chartBottom);
    d2d.stroke();
  }

  // Table right border (thick)
  d2d.strokeStyle = PRINT_COLORS.borderDark;
  d2d.lineWidth = 1;
  d2d.beginPath();
  d2d.moveTo(TABLE_WIDTH, PROJECT_HEADER_HEIGHT);
  d2d.lineTo(TABLE_WIDTH, chartBottom);
  d2d.stroke();

  // Table left border
  d2d.beginPath();
  d2d.moveTo(0, PROJECT_HEADER_HEIGHT);
  d2d.lineTo(0, chartBottom);
  d2d.stroke();
}


/** Draw dependency lines with arrowheads */
function drawDependencies(
  d2d: Draw2D,
  flatTasks: PrintTask[],
  sequences: Sequence[],
  dateToX: (d: Date) => number,
  rowToY: (i: number) => number,
  zoom: number,
) {
  d2d.strokeStyle = PRINT_COLORS.dependency;
  d2d.fillStyle = PRINT_COLORS.dependency;
  d2d.lineWidth = 1.2;

  for (const seq of sequences) {
    const predIdx = flatTasks.findIndex(t => t.id === seq.predecessorId);
    const succIdx = flatTasks.findIndex(t => t.id === seq.successorId);
    if (predIdx < 0 || succIdx < 0) continue;

    const pred = flatTasks[predIdx];
    const succ = flatTasks[succIdx];
    const predY = rowToY(predIdx) + ROW_HEIGHT / 2;
    const succY = rowToY(succIdx) + ROW_HEIGHT / 2;

    const predEnd = parseDate(pred.time.earlyFinish || pred.time.scheduleFinish);
    const succStart = parseDate(succ.time.earlyStart || succ.time.scheduleStart);
    const fromX = dateToX(predEnd) + zoom;
    const toX = dateToX(succStart);

    // Route: right from pred end, then down/up, then right to succ start
    const gapX = 6;
    const midX = fromX + gapX;

    d2d.beginPath();
    d2d.moveTo(fromX, predY);
    d2d.lineTo(midX, predY);
    d2d.lineTo(midX, succY);
    d2d.lineTo(toX, succY);
    d2d.stroke();

    // Arrowhead (filled triangle)
    d2d.beginPath();
    d2d.moveTo(toX, succY);
    d2d.lineTo(toX - 5, succY - 3);
    d2d.lineTo(toX - 5, succY + 3);
    d2d.closePath();
    d2d.fill();
  }
}


/** Draw the footer with project info, legend, and page number */
function drawFooter(
  d2d: Draw2D,
  canvasWidth: number,
  canvasHeight: number,
  projectName: string,
  options: PrintOptions,
) {
  const footerTop = canvasHeight - FOOTER_HEIGHT;

  // Background
  d2d.fillStyle = PRINT_COLORS.surface;
  d2d.fillRect(0, footerTop, canvasWidth, FOOTER_HEIGHT);

  // Top border
  d2d.strokeStyle = PRINT_COLORS.borderDark;
  d2d.lineWidth = 1;
  d2d.beginPath();
  d2d.moveTo(0, footerTop);
  d2d.lineTo(canvasWidth, footerTop);
  d2d.stroke();

  const midY = footerTop + FOOTER_HEIGHT / 2;

  // Left: Project name + print date (breedtes meten voor de dynamische legenda-layout)
  d2d.fillStyle = PRINT_COLORS.text;
  d2d.font = `bold 10px ${FONT_FAMILY}`;
  d2d.textAlign = 'left';
  d2d.textBaseline = 'middle';
  d2d.fillText(projectName, 10, midY - 8);
  const leftNameW = d2d.measureText(projectName).width;

  d2d.fillStyle = PRINT_COLORS.textSecondary;
  d2d.font = `8px ${FONT_FAMILY}`;
  const printLocale = options.locale ?? 'nl';
  const dateStr = new Date().toLocaleDateString(printLocale, { day: '2-digit', month: 'long', year: 'numeric' });
  const dateText = `${options.labels?.printed ?? 'Afgedrukt:'} ${dateStr}`;
  d2d.fillText(dateText, 10, midY + 8);
  const leftBlockRight = 10 + Math.max(leftNameW, d2d.measureText(dateText).width);

  // Right: Page number + branding (breedtes meten, dan tekenen)
  const pageLabel = options.labels?.page ?? 'Pagina';
  const ofLabel = options.labels?.of ?? 'van';
  const pageText = `${pageLabel} 1 ${ofLabel} 1`;
  const brandText = 'Open Planner Studio';
  d2d.font = `9px ${FONT_FAMILY}`;
  const pageW = d2d.measureText(pageText).width;
  d2d.font = `8px ${FONT_FAMILY}`;
  const brandW = d2d.measureText(brandText).width;
  const rightBlockLeft = canvasWidth - 10 - Math.max(pageW, brandW);

  d2d.fillStyle = PRINT_COLORS.textSecondary;
  d2d.textAlign = 'right';
  d2d.textBaseline = 'middle';
  d2d.font = `9px ${FONT_FAMILY}`;
  d2d.fillText(pageText, canvasWidth - 10, midY - 6);
  d2d.font = `8px ${FONT_FAMILY}`;
  d2d.fillText(brandText, canvasWidth - 10, midY + 8);

  // Center: Legend — dynamisch tussen het linker- en rechterblok, items weglaten bij te weinig
  // ruimte i.p.v. over de blokken heen tekenen (klacht 7).
  if (options.showLegend) {
    const availLeft = leftBlockRight + 16;
    const availRight = rightBlockLeft - 16;
    const availSpan = availRight - availLeft;
    if (availSpan > 20) {
      const lg = options.labels?.legend;
      const swatchW = 16;
      const gap = 16;
      type LegendItem = { label: string; draw: (x: number) => void };
      const items: LegendItem[] = [];

      if (options.showCritical) {
        items.push({ label: lg?.criticalPath ?? 'Kritiek pad', draw: (x) => {
          d2d.fillStyle = PRINT_COLORS.critical;
          d2d.roundRect(x, midY - 5, 16, 10, 2);
          d2d.fill();
        } });
      }
      items.push({ label: lg?.normal ?? 'Normaal', draw: (x) => {
        d2d.fillStyle = PRINT_COLORS.normal;
        d2d.roundRect(x, midY - 5, 16, 10, 2);
        d2d.fill();
      } });
      items.push({ label: lg?.milestone ?? 'Mijlpaal', draw: (x) => {
        d2d.fillStyle = PRINT_COLORS.milestone;
        const mx = x + 8;
        d2d.beginPath();
        d2d.moveTo(mx, midY - 5);
        d2d.lineTo(mx + 5, midY);
        d2d.lineTo(mx, midY + 5);
        d2d.lineTo(mx - 5, midY);
        d2d.closePath();
        d2d.fill();
      } });
      items.push({ label: lg?.summary ?? 'Samenvatting', draw: (x) => {
        d2d.fillStyle = PRINT_COLORS.summary;
        d2d.fillRect(x, midY - 2, 16, 4);
        d2d.beginPath();
        d2d.moveTo(x, midY - 2);
        d2d.lineTo(x, midY + 5);
        d2d.lineTo(x + 4, midY + 2);
        d2d.closePath();
        d2d.fill();
      } });
      if (options.showFloat) {
        items.push({ label: lg?.float ?? 'Speling', draw: (x) => {
          d2d.fillStyle = PRINT_COLORS.float + '40';
          d2d.fillRect(x, midY - 4, 16, 8);
        } });
      }

      d2d.font = `8px ${FONT_FAMILY}`;
      d2d.textBaseline = 'middle';
      const widths = items.map(it => swatchW + 4 + d2d.measureText(it.label).width);
      const measure = (n: number) => widths.slice(0, n).reduce((a, b) => a + b, 0) + gap * Math.max(0, n - 1);
      let visible = items.length;
      while (visible > 0 && measure(visible) > availSpan) visible--;

      let lx = availLeft + Math.max(0, (availSpan - measure(visible)) / 2);
      for (let k = 0; k < visible; k++) {
        items[k].draw(lx);
        d2d.fillStyle = PRINT_COLORS.textSecondary;
        d2d.textAlign = 'left';
        d2d.fillText(items[k].label, lx + swatchW + 4, midY);
        lx += widths[k] + gap;
      }
    }
  }

  d2d.textAlign = 'left';
  d2d.textBaseline = 'alphabetic';
}
