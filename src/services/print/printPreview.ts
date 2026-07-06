import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { WorkCalendar } from '@/types/calendar';
import { parseDate, formatDate, addCalendarDays, getWeekNumber, diffCalendarDays, isoDayOfWeek } from '@/utils/dateUtils';
import type { DateNotation } from '@/state/slices/types';

/** Print-friendly color scheme */
const PRINT_COLORS = {
  bg: '#ffffff',
  surface: '#f8f9fa',
  grid: '#e5e7eb',
  gridWeekend: '#f0f1f3',
  gridHoliday: '#fef3c7',
  border: '#d1d5db',
  borderDark: '#9ca3af',
  text: '#111827',
  textSecondary: '#6b7280',
  critical: '#DC2626',
  criticalDark: '#991b1b',
  normal: '#2563EB',
  normalDark: '#1d4ed8',
  milestone: '#7C3AED',
  float: '#10B981',
  dependency: '#9CA3AF',
  today: '#F59E0B',
  headerBg: '#f1f5f9',
  summary: '#7C3AED',
  rowEven: '#f9fafb',
  rowOdd: '#ffffff',
};

const ROW_HEIGHT = 24;
const PROJECT_HEADER_HEIGHT = 64;
const TIMELINE_HEADER_HEIGHT = 44;
const TOTAL_HEADER_HEIGHT = PROJECT_HEADER_HEIGHT + TIMELINE_HEADER_HEIGHT;
const TABLE_WIDTH = 450;
const FOOTER_HEIGHT = 50;
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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

/** Draw rounded rect helper (polyfill for older canvas) */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Render the print preview onto a canvas. Returns the logical (CSS) dimensions. */
export function renderPrintCanvas(
  canvas: HTMLCanvasElement,
  tasks: Task[],
  sequences: Sequence[],
  calendar: WorkCalendar,
  projectName: string,
  options: PrintOptions,
): { width: number; height: number } {
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
    const dpr = window.devicePixelRatio || 2;
    canvas.width = 600 * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = '600px';
    canvas.style.height = '200px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = PRINT_COLORS.bg;
    ctx.fillRect(0, 0, 600, 200);
    ctx.fillStyle = PRINT_COLORS.textSecondary;
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(options.labels?.noTasks ?? 'No tasks to display', 300, 100);
    return { width: 600, height: 200 };
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

  // Create high-DPI canvas
  const dpr = window.devicePixelRatio || 2;
  canvas.width = canvasWidth * dpr;
  canvas.height = canvasHeight * dpr;
  canvas.style.width = canvasWidth + 'px';
  canvas.style.height = canvasHeight + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Helper: date to X
  const dateToX = (date: Date) => TABLE_WIDTH + diffCalendarDays(minDate, date) * zoom;
  const chartTop = TOTAL_HEADER_HEIGHT;
  const chartBottom = canvasHeight - FOOTER_HEIGHT;
  const rowToY = (i: number) => TOTAL_HEADER_HEIGHT + i * ROW_HEIGHT;

  const cols = getColPositions();

  // ==================== DRAW ====================

  // Background
  ctx.fillStyle = PRINT_COLORS.bg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // ---- PROJECT HEADER BOX ----
  drawProjectHeader(ctx, canvasWidth, projectName, options);

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
        ctx.fillStyle = PRINT_COLORS.gridHoliday;
        ctx.fillRect(x, chartTop, zoom, chartBottom - chartTop);
      } else if (isWeekend) {
        ctx.fillStyle = PRINT_COLORS.gridWeekend;
        ctx.fillRect(x, chartTop, zoom, chartBottom - chartTop);
      }
    }
  }

  // Alternating row backgrounds in chart area
  for (let i = 0; i < flatTasks.length; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(249, 250, 251, 0.3)';
      ctx.fillRect(TABLE_WIDTH, rowToY(i), chartWidth, ROW_HEIGHT);
    }
  }

  // Vertical grid lines
  for (let i = 0; i < totalDays; i++) {
    const date = addCalendarDays(minDate, i);
    const x = dateToX(date);
    const dow = isoDayOfWeek(date);

    ctx.strokeStyle = PRINT_COLORS.grid;
    ctx.lineWidth = dow === 1 ? 0.8 : 0.2;
    ctx.beginPath();
    ctx.moveTo(x, chartTop);
    ctx.lineTo(x, chartBottom);
    ctx.stroke();
  }

  // Horizontal grid lines in chart area
  for (let i = 0; i <= flatTasks.length; i++) {
    const y = rowToY(i);
    ctx.strokeStyle = PRINT_COLORS.grid;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(TABLE_WIDTH, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }

  // Today line
  const today = new Date();
  const todayX = dateToX(today);
  if (todayX > TABLE_WIDTH && todayX < canvasWidth) {
    ctx.strokeStyle = PRINT_COLORS.today;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(todayX, chartTop);
    ctx.lineTo(todayX, chartBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // "Today" label
    ctx.fillStyle = PRINT_COLORS.today;
    ctx.font = `bold 7px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText('Today', todayX, chartTop - 2);
    ctx.textAlign = 'left';
  }

  // Dependency arrows
  if (options.showDeps) {
    drawDependencies(ctx, flatTasks, sequences, dateToX, rowToY, zoom);
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

      ctx.fillStyle = PRINT_COLORS.milestone;
      ctx.beginPath();
      ctx.moveTo(x, cy - size);
      ctx.lineTo(x + size, cy);
      ctx.lineTo(x, cy + size);
      ctx.lineTo(x - size, cy);
      ctx.closePath();
      ctx.fill();

      // Task name label to the right
      if (options.showTaskNames) {
        ctx.fillStyle = PRINT_COLORS.text;
        ctx.font = `9px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(task.name, x + size + 4, cy + 3);
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

      ctx.fillStyle = PRINT_COLORS.summary;
      ctx.fillRect(x1, barY, width, barH);

      // Left triangle
      ctx.beginPath();
      ctx.moveTo(x1, barY);
      ctx.lineTo(x1, barY + barH + 5);
      ctx.lineTo(x1 + 6, barY + barH);
      ctx.closePath();
      ctx.fill();

      // Right triangle
      ctx.beginPath();
      ctx.moveTo(x1 + width, barY);
      ctx.lineTo(x1 + width, barY + barH + 5);
      ctx.lineTo(x1 + width - 6, barY + barH);
      ctx.closePath();
      ctx.fill();

      // Task name label to the right
      if (options.showTaskNames) {
        ctx.fillStyle = PRINT_COLORS.text;
        ctx.font = `bold 9px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(task.name, x2 + 4, y + barHeight / 2 + 3);
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
      ctx.fillStyle = color;
      roundRect(ctx, x1, y, width, barHeight, 3);
      ctx.fill();

      // Completion overlay (darker shade)
      if (options.showCompletion && task.time.completion > 0) {
        const progressWidth = width * task.time.completion;
        ctx.fillStyle = isCritical ? PRINT_COLORS.criticalDark : PRINT_COLORS.normalDark;
        roundRect(ctx, x1, y, progressWidth, barHeight, 3);
        ctx.fill();
      }

      // Float indicator
      if (options.showFloat && task.time.totalFloat > 0 && !task.time.isCritical) {
        const floatWidth = task.time.totalFloat * zoom;
        ctx.fillStyle = PRINT_COLORS.float + '40';
        roundRect(ctx, x2, y + barHeight * 0.2, floatWidth, barHeight * 0.6, 2);
        ctx.fill();
      }

      // Task name label to the right of the bar
      if (options.showTaskNames) {
        const labelX = x2 + (options.showFloat && task.time.totalFloat > 0 && !task.time.isCritical
          ? task.time.totalFloat * zoom + 4
          : 4);
        ctx.fillStyle = PRINT_COLORS.text;
        ctx.font = `9px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(task.name, labelX, y + barHeight / 2 + 3);
      }
    }
  }

  // ---- TIMELINE HEADER ----
  drawTimelineHeader(ctx, canvasWidth, minDate, totalDays, zoom, dateToX, options);

  // ---- TASK TABLE ----
  drawTaskTable(ctx, flatTasks, depthMap, canvasHeight, cols, options);

  // ---- FOOTER ----
  drawFooter(ctx, canvasWidth, canvasHeight, projectName, options);

  return { width: canvasWidth, height: canvasHeight };
}


/** Draw the project header box at the top of the page */
function drawProjectHeader(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  projectName: string,
  options: PrintOptions,
) {
  const hh = PROJECT_HEADER_HEIGHT;

  // Background
  ctx.fillStyle = PRINT_COLORS.bg;
  ctx.fillRect(0, 0, canvasWidth, hh);

  // Border
  ctx.strokeStyle = PRINT_COLORS.borderDark;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, canvasWidth - 1, hh - 1);

  // Project name (large, bold)
  ctx.fillStyle = PRINT_COLORS.text;
  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(projectName, 10, 16);

  // Row 2: Company | Author | Print date | Version
  ctx.font = `9px ${FONT_FAMILY}`;
  ctx.fillStyle = PRINT_COLORS.textSecondary;
  const row2Y = 34;

  const companyLabel = options.companyName || '';
  const authorLabel = options.projectAuthor || '';
  const printLocale = options.locale ?? 'nl';
  const printDate = new Date().toLocaleDateString(printLocale, { day: '2-digit', month: 'long', year: 'numeric' });

  let row2Text = '';
  if (companyLabel) row2Text += companyLabel;
  if (authorLabel) row2Text += (row2Text ? '  |  ' : '') + authorLabel;
  row2Text += (row2Text ? '  |  ' : '') + `${options.labels?.printed ?? 'Printed:'} ${printDate}`;

  ctx.fillText(row2Text, 10, row2Y);

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

  ctx.fillText(row3Text, 10, row3Y);

  // Right-aligned branding
  ctx.fillStyle = PRINT_COLORS.textSecondary;
  ctx.font = `8px ${FONT_FAMILY}`;
  ctx.textAlign = 'right';
  ctx.fillText('Open Planner Studio', canvasWidth - 10, 16);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}


/** Draw the timeline header with month/week/day rows */
function drawTimelineHeader(
  ctx: CanvasRenderingContext2D,
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
  ctx.fillStyle = PRINT_COLORS.headerBg;
  ctx.fillRect(0, top, canvasWidth, h);

  // Bottom border
  ctx.strokeStyle = PRINT_COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, top + h);
  ctx.lineTo(canvasWidth, top + h);
  ctx.stroke();

  // Mid border between month and week rows
  ctx.strokeStyle = PRINT_COLORS.grid;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(TABLE_WIDTH, top + monthRowH);
  ctx.lineTo(canvasWidth, top + monthRowH);
  ctx.stroke();

  const months = options.localizedMonths ?? ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

  let lastMonth = -1;
  let lastWeek = -1;

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
      ctx.strokeStyle = PRINT_COLORS.border;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + monthRowH);
      ctx.stroke();

      ctx.fillStyle = PRINT_COLORS.text;
      ctx.font = `bold 10px ${FONT_FAMILY}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 4, top + monthRowH / 2);
    }

    // Week headers
    if (dow === 1 && weekNum !== lastWeek) {
      lastWeek = weekNum;

      // Vertical separator
      ctx.strokeStyle = PRINT_COLORS.grid;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, top + monthRowH);
      ctx.lineTo(x, top + h);
      ctx.stroke();

      ctx.fillStyle = PRINT_COLORS.textSecondary;
      ctx.font = `9px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`W${weekNum}`, x + 2, top + monthRowH + weekRowH / 2);
    }

    // Day numbers if zoom is large enough
    if (zoom > 15) {
      const dayNum = date.getUTCDate();
      if (dow !== 6 && dow !== 7) { // Skip weekend days for cleaner display
        ctx.fillStyle = PRINT_COLORS.textSecondary;
        ctx.font = `7px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(dayNum), x + zoom / 2, top + h - 1);
      }
    }
  }

  // Table header area (left side of timeline header)
  ctx.fillStyle = PRINT_COLORS.headerBg;
  ctx.fillRect(0, top, TABLE_WIDTH, h);

  // Table column headers
  const cols = getColPositions();
  ctx.fillStyle = PRINT_COLORS.text;
  ctx.font = `bold 9px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const headerY = top + h / 2;

  const th = options.labels?.tableHeaders;
  ctx.fillText(th?.rowNum ?? '#', cols.rowNum.x + cols.rowNum.w / 2, headerY);
  ctx.fillText(th?.wbs ?? 'WBS', cols.wbs.x + cols.wbs.w / 2, headerY);

  ctx.textAlign = 'left';
  ctx.fillText(th?.taskName ?? 'Taaknaam', cols.name.x + 4, headerY);

  ctx.textAlign = 'center';
  ctx.fillText(th?.duration ?? 'Duur', cols.duration.x + cols.duration.w / 2, headerY);
  ctx.fillText(th?.start ?? 'Start', cols.start.x + cols.start.w / 2, headerY);
  ctx.fillText(th?.end ?? 'Einde', cols.end.x + cols.end.w / 2, headerY);
  ctx.fillText(th?.completion ?? 'Volt.', cols.complete.x + cols.complete.w / 2, headerY);

  // Column separator lines in header
  ctx.strokeStyle = PRINT_COLORS.border;
  ctx.lineWidth = 0.5;
  const colBorders = [cols.wbs.x, cols.name.x, cols.duration.x, cols.start.x, cols.end.x, cols.complete.x, TABLE_WIDTH];
  for (const cx of colBorders) {
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top + h);
    ctx.stroke();
  }

  // Bottom border for header
  ctx.strokeStyle = PRINT_COLORS.borderDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, top + h);
  ctx.lineTo(TABLE_WIDTH, top + h);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}


/** Draw the task table (left side) */
function drawTaskTable(
  ctx: CanvasRenderingContext2D,
  flatTasks: PrintTask[],
  depthMap: Map<string, number>,
  canvasHeight: number,
  cols: ReturnType<typeof getColPositions>,
  options: PrintOptions,
) {
  const chartBottom = canvasHeight - FOOTER_HEIGHT;

  // Table background
  ctx.fillStyle = PRINT_COLORS.bg;
  ctx.fillRect(0, TOTAL_HEADER_HEIGHT, TABLE_WIDTH, chartBottom - TOTAL_HEADER_HEIGHT);

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
      ctx.fillStyle = PRINT_COLORS.rowEven;
      ctx.fillRect(0, y, TABLE_WIDTH, ROW_HEIGHT);
    }

    // Row border
    ctx.strokeStyle = PRINT_COLORS.grid;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(0, y + ROW_HEIGHT);
    ctx.lineTo(TABLE_WIDTH, y + ROW_HEIGHT);
    ctx.stroke();

    // Row number
    ctx.fillStyle = PRINT_COLORS.textSecondary;
    ctx.font = `8px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), cols.rowNum.x + cols.rowNum.w - 4, textY);

    // WBS
    ctx.fillStyle = PRINT_COLORS.textSecondary;
    ctx.font = `8px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillText(task.wbsCode || '', cols.wbs.x + 4, textY);

    // Name with indentation and clipping
    ctx.fillStyle = isSummary ? PRINT_COLORS.summary : PRINT_COLORS.text;
    ctx.font = isSummary ? `bold 9px ${FONT_FAMILY}` : `9px ${FONT_FAMILY}`;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cols.name.x, y, cols.name.w, ROW_HEIGHT);
    ctx.clip();
    ctx.fillText(task.name, cols.name.x + 4 + indent, textY);
    ctx.restore();

    // Duration
    ctx.fillStyle = PRINT_COLORS.textSecondary;
    ctx.font = `8px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatDuration(task.time.scheduleDuration), cols.duration.x + cols.duration.w - 4, textY);

    // Start date
    const startStr = task.time.earlyStart || task.time.scheduleStart;
    if (startStr) {
      const sd = parseDate(startStr);
      ctx.fillText(formatDutchDate(sd, options.dateNotation), cols.start.x + cols.start.w - 4, textY);
    }

    // End date
    const endStr = task.time.earlyFinish || task.time.scheduleFinish;
    if (endStr) {
      const ed = parseDate(endStr);
      ctx.fillText(formatDutchDate(ed, options.dateNotation), cols.end.x + cols.end.w - 4, textY);
    }

    // Completion
    if (options.showCompletion) {
      ctx.fillText(formatCompletion(task.time.completion), cols.complete.x + cols.complete.w - 4, textY);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // Column separator lines throughout the table
  ctx.strokeStyle = PRINT_COLORS.grid;
  ctx.lineWidth = 0.5;
  const colBorders = [cols.wbs.x, cols.name.x, cols.duration.x, cols.start.x, cols.end.x, cols.complete.x];
  for (const cx of colBorders) {
    ctx.beginPath();
    ctx.moveTo(cx, TOTAL_HEADER_HEIGHT);
    ctx.lineTo(cx, chartBottom);
    ctx.stroke();
  }

  // Table right border (thick)
  ctx.strokeStyle = PRINT_COLORS.borderDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TABLE_WIDTH, PROJECT_HEADER_HEIGHT);
  ctx.lineTo(TABLE_WIDTH, chartBottom);
  ctx.stroke();

  // Table left border
  ctx.beginPath();
  ctx.moveTo(0, PROJECT_HEADER_HEIGHT);
  ctx.lineTo(0, chartBottom);
  ctx.stroke();
}


/** Draw dependency lines with arrowheads */
function drawDependencies(
  ctx: CanvasRenderingContext2D,
  flatTasks: PrintTask[],
  sequences: Sequence[],
  dateToX: (d: Date) => number,
  rowToY: (i: number) => number,
  zoom: number,
) {
  ctx.strokeStyle = PRINT_COLORS.dependency;
  ctx.fillStyle = PRINT_COLORS.dependency;
  ctx.lineWidth = 1.2;

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

    ctx.beginPath();
    ctx.moveTo(fromX, predY);
    ctx.lineTo(midX, predY);
    ctx.lineTo(midX, succY);
    ctx.lineTo(toX, succY);
    ctx.stroke();

    // Arrowhead (filled triangle)
    ctx.beginPath();
    ctx.moveTo(toX, succY);
    ctx.lineTo(toX - 5, succY - 3);
    ctx.lineTo(toX - 5, succY + 3);
    ctx.closePath();
    ctx.fill();
  }
}


/** Draw the footer with project info, legend, and page number */
function drawFooter(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  projectName: string,
  options: PrintOptions,
) {
  const footerTop = canvasHeight - FOOTER_HEIGHT;

  // Background
  ctx.fillStyle = PRINT_COLORS.surface;
  ctx.fillRect(0, footerTop, canvasWidth, FOOTER_HEIGHT);

  // Top border
  ctx.strokeStyle = PRINT_COLORS.borderDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerTop);
  ctx.lineTo(canvasWidth, footerTop);
  ctx.stroke();

  const midY = footerTop + FOOTER_HEIGHT / 2;

  // Left: Project name + print date
  ctx.fillStyle = PRINT_COLORS.text;
  ctx.font = `bold 10px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(projectName, 10, midY - 8);

  ctx.fillStyle = PRINT_COLORS.textSecondary;
  ctx.font = `8px ${FONT_FAMILY}`;
  const printLocale = options.locale ?? 'nl';
  const dateStr = new Date().toLocaleDateString(printLocale, { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.fillText(`${options.labels?.printed ?? 'Afgedrukt:'} ${dateStr}`, 10, midY + 8);

  // Center: Legend
  if (options.showLegend) {
    const lg = options.labels?.legend;
    const legendStartX = canvasWidth / 2 - 200;
    let lx = legendStartX;
    ctx.font = `8px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';

    // Critical path
    if (options.showCritical) {
      ctx.fillStyle = PRINT_COLORS.critical;
      roundRect(ctx, lx, midY - 5, 16, 10, 2);
      ctx.fill();
      ctx.fillStyle = PRINT_COLORS.textSecondary;
      ctx.fillText(lg?.criticalPath ?? 'Kritiek pad', lx + 20, midY);
      lx += 90;
    }

    // Normal
    ctx.fillStyle = PRINT_COLORS.normal;
    roundRect(ctx, lx, midY - 5, 16, 10, 2);
    ctx.fill();
    ctx.fillStyle = PRINT_COLORS.textSecondary;
    ctx.fillText(lg?.normal ?? 'Normaal', lx + 20, midY);
    lx += 70;

    // Milestone
    ctx.fillStyle = PRINT_COLORS.milestone;
    const mx = lx + 5;
    ctx.beginPath();
    ctx.moveTo(mx, midY - 5);
    ctx.lineTo(mx + 5, midY);
    ctx.lineTo(mx, midY + 5);
    ctx.lineTo(mx - 5, midY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PRINT_COLORS.textSecondary;
    ctx.fillText(lg?.milestone ?? 'Mijlpaal', lx + 14, midY);
    lx += 70;

    // Summary
    ctx.fillStyle = PRINT_COLORS.summary;
    ctx.fillRect(lx, midY - 2, 16, 4);
    // Small triangles
    ctx.beginPath();
    ctx.moveTo(lx, midY - 2);
    ctx.lineTo(lx, midY + 5);
    ctx.lineTo(lx + 4, midY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PRINT_COLORS.textSecondary;
    ctx.fillText(lg?.summary ?? 'Samenvatting', lx + 20, midY);
    lx += 90;

    // Float
    if (options.showFloat) {
      ctx.fillStyle = PRINT_COLORS.float + '40';
      ctx.fillRect(lx, midY - 4, 16, 8);
      ctx.fillStyle = PRINT_COLORS.textSecondary;
      ctx.fillText(lg?.float ?? 'Speling', lx + 20, midY);
    }
  }

  // Right: Page number + branding
  ctx.fillStyle = PRINT_COLORS.textSecondary;
  ctx.font = `9px ${FONT_FAMILY}`;
  ctx.textAlign = 'right';
  const pageLabel = options.labels?.page ?? 'Pagina';
  const ofLabel = options.labels?.of ?? 'van';
  ctx.fillText(`${pageLabel} 1 ${ofLabel} 1`, canvasWidth - 10, midY - 6);

  ctx.font = `8px ${FONT_FAMILY}`;
  ctx.fillText('Open Planner Studio', canvasWidth - 10, midY + 8);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
