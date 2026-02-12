import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { WorkCalendar } from '@/types/calendar';
import { parseDate, formatDate, addCalendarDays, getWeekNumber, diffCalendarDays, isoDayOfWeek } from '@/utils/dateUtils';

/** Print-friendly color scheme */
const PRINT_COLORS = {
  bg: '#ffffff',
  surface: '#f8f9fa',
  grid: '#e5e7eb',
  gridWeekend: '#f3f4f6',
  border: '#d1d5db',
  text: '#111827',
  textSecondary: '#6b7280',
  critical: '#DC2626',
  criticalLight: '#FCA5A5',
  normal: '#2563EB',
  normalLight: '#93C5FD',
  milestone: '#7C3AED',
  float: '#10B981',
  dependency: '#9CA3AF',
  today: '#F59E0B',
  headerBg: '#f1f5f9',
  summary: '#7C3AED',
};

const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 44;
const TABLE_WIDTH = 320;

interface PrintTask extends Task {
  _depth?: number;
}

export function openPrintPreview(
  tasks: Task[],
  sequences: Sequence[],
  calendar: WorkCalendar,
  projectName: string,
  _viewStartDate: string,
) {
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

  // Compute date range
  let minDate = new Date(8640000000000000);
  let maxDate = new Date(0);
  for (const t of flatTasks) {
    const s = parseDate(t.time.earlyStart || t.time.scheduleStart);
    const f = parseDate(t.time.earlyFinish || t.time.scheduleFinish);
    if (s < minDate) minDate = s;
    if (f > maxDate) maxDate = f;
  }

  // Add padding days
  minDate = addCalendarDays(minDate, -7);
  maxDate = addCalendarDays(maxDate, 14);

  const totalDays = diffCalendarDays(minDate, maxDate);
  const zoom = 18; // pixels per day for print
  const chartWidth = totalDays * zoom;
  const canvasWidth = TABLE_WIDTH + chartWidth;
  const canvasHeight = HEADER_HEIGHT + flatTasks.length * ROW_HEIGHT + 60; // extra for footer

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

  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  const dpr = 2; // high resolution for print
  canvas.width = canvasWidth * dpr;
  canvas.height = canvasHeight * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Helper: date to X
  const dateToX = (date: Date) => TABLE_WIDTH + diffCalendarDays(minDate, date) * zoom;
  const rowToY = (i: number) => HEADER_HEIGHT + i * ROW_HEIGHT;

  // ---- DRAW ----

  // Background
  ctx.fillStyle = PRINT_COLORS.bg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Grid background - weekend/holiday shading
  for (let i = 0; i < totalDays; i++) {
    const date = addCalendarDays(minDate, i);
    const x = dateToX(date);
    const dow = isoDayOfWeek(date);
    const dateStr = formatDate(date);

    if (dow === 6 || dow === 7 || holidaySet.has(dateStr)) {
      ctx.fillStyle = PRINT_COLORS.gridWeekend;
      ctx.fillRect(x, HEADER_HEIGHT, zoom, canvasHeight - HEADER_HEIGHT);
    }

    // Vertical grid lines
    ctx.strokeStyle = PRINT_COLORS.grid;
    ctx.lineWidth = dow === 1 ? 0.8 : 0.3;
    ctx.beginPath();
    ctx.moveTo(x, HEADER_HEIGHT);
    ctx.lineTo(x, canvasHeight - 40);
    ctx.stroke();
  }

  // Horizontal grid lines
  for (let i = 0; i <= flatTasks.length; i++) {
    const y = rowToY(i);
    ctx.strokeStyle = PRINT_COLORS.grid;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }

  // Today line
  const today = new Date();
  const todayX = dateToX(today);
  if (todayX > TABLE_WIDTH && todayX < canvasWidth) {
    ctx.strokeStyle = PRINT_COLORS.today;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(todayX, HEADER_HEIGHT);
    ctx.lineTo(todayX, canvasHeight - 40);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Dependency arrows
  ctx.strokeStyle = PRINT_COLORS.dependency;
  ctx.fillStyle = PRINT_COLORS.dependency;
  ctx.lineWidth = 0.8;
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

    ctx.beginPath();
    ctx.moveTo(fromX, predY);
    const midX = fromX + 6;
    ctx.lineTo(midX, predY);
    ctx.lineTo(midX, succY);
    ctx.lineTo(toX, succY);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, succY);
    ctx.lineTo(toX - 4, succY - 2.5);
    ctx.lineTo(toX - 4, succY + 2.5);
    ctx.closePath();
    ctx.fill();
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
      const size = barHeight * 0.4;

      ctx.fillStyle = PRINT_COLORS.milestone;
      ctx.beginPath();
      ctx.moveTo(x, cy - size);
      ctx.lineTo(x + size, cy);
      ctx.lineTo(x, cy + size);
      ctx.lineTo(x - size, cy);
      ctx.closePath();
      ctx.fill();
    } else if (task.childIds.length > 0) {
      // Summary bar
      const start = parseDate(task.time.earlyStart || task.time.scheduleStart);
      const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
      const x1 = dateToX(start);
      const x2 = dateToX(end) + zoom;
      const width = Math.max(x2 - x1, 3);
      const barY = y + barHeight * 0.35;
      const barH = barHeight * 0.3;

      ctx.fillStyle = PRINT_COLORS.summary;
      ctx.fillRect(x1, barY, width, barH);

      // Left triangle
      ctx.beginPath();
      ctx.moveTo(x1, barY);
      ctx.lineTo(x1, barY + barH + 3);
      ctx.lineTo(x1 + 4, barY + barH);
      ctx.closePath();
      ctx.fill();

      // Right triangle
      ctx.beginPath();
      ctx.moveTo(x1 + width, barY);
      ctx.lineTo(x1 + width, barY + barH + 3);
      ctx.lineTo(x1 + width - 4, barY + barH);
      ctx.closePath();
      ctx.fill();
    } else {
      // Normal task bar
      const start = parseDate(task.time.earlyStart || task.time.scheduleStart);
      const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
      const x1 = dateToX(start);
      const x2 = dateToX(end) + zoom;
      const width = Math.max(x2 - x1, 3);
      const color = task.time.isCritical ? PRINT_COLORS.critical : PRINT_COLORS.normal;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x1, y, width, barHeight, 2);
      ctx.fill();

      // Progress
      if (task.time.completion > 0) {
        const progressWidth = width * task.time.completion;
        ctx.fillStyle = task.time.isCritical ? PRINT_COLORS.criticalLight : PRINT_COLORS.normalLight;
        ctx.beginPath();
        ctx.roundRect(x1, y, progressWidth, barHeight, 2);
        ctx.fill();
      }

      // Float indicator
      if (task.time.totalFloat > 0 && !task.time.isCritical) {
        const floatWidth = task.time.totalFloat * zoom;
        ctx.fillStyle = PRINT_COLORS.float + '30';
        ctx.fillRect(x2, y + barHeight / 4, floatWidth, barHeight / 2);
      }
    }
  }

  // ---- Timeline header ----
  ctx.fillStyle = PRINT_COLORS.headerBg;
  ctx.fillRect(0, 0, canvasWidth, HEADER_HEIGHT);

  ctx.strokeStyle = PRINT_COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_HEIGHT);
  ctx.lineTo(canvasWidth, HEADER_HEIGHT);
  ctx.stroke();

  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  let lastMonth = -1;
  let lastWeek = -1;

  for (let i = 0; i < totalDays; i++) {
    const date = addCalendarDays(minDate, i);
    const x = dateToX(date);
    const month = date.getUTCMonth();
    const weekNum = getWeekNumber(date);
    const dow = isoDayOfWeek(date);

    if (month !== lastMonth) {
      lastMonth = month;
      ctx.fillStyle = PRINT_COLORS.text;
      ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${months[month]} ${date.getUTCFullYear()}`, x + 3, HEADER_HEIGHT / 4);
    }

    if (dow === 1 && weekNum !== lastWeek) {
      lastWeek = weekNum;
      ctx.fillStyle = PRINT_COLORS.textSecondary;
      ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`W${weekNum}`, x + 2, HEADER_HEIGHT * 3 / 4);
    }
  }

  // ---- Task table ----
  ctx.fillStyle = PRINT_COLORS.surface;
  ctx.fillRect(0, 0, TABLE_WIDTH, canvasHeight - 40);

  // Header
  ctx.fillStyle = PRINT_COLORS.headerBg;
  ctx.fillRect(0, 0, TABLE_WIDTH, HEADER_HEIGHT);

  ctx.fillStyle = PRINT_COLORS.text;
  ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('WBS', 6, HEADER_HEIGHT / 2);
  ctx.fillText('Taaknaam', 48, HEADER_HEIGHT / 2);
  ctx.fillText('Duur', TABLE_WIDTH - 38, HEADER_HEIGHT / 2);

  // Task rows
  for (let i = 0; i < flatTasks.length; i++) {
    const task = flatTasks[i];
    const y = rowToY(i);
    const depth = depthMap.get(task.id) || 0;
    const textY = y + ROW_HEIGHT / 2;
    const indent = 6 + depth * 12;
    const isSummary = task.childIds.length > 0;

    // Alternating row background
    if (i % 2 === 0) {
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(0, y, TABLE_WIDTH, ROW_HEIGHT);
    }

    // Row border
    ctx.strokeStyle = PRINT_COLORS.grid;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(0, y + ROW_HEIGHT);
    ctx.lineTo(TABLE_WIDTH, y + ROW_HEIGHT);
    ctx.stroke();

    // WBS
    ctx.fillStyle = PRINT_COLORS.textSecondary;
    ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(task.wbsCode || '', 6, textY);

    // Name
    ctx.fillStyle = isSummary ? PRINT_COLORS.summary : PRINT_COLORS.text;
    ctx.font = isSummary ? 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif' : '9px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.save();
    ctx.beginPath();
    ctx.rect(44, y, TABLE_WIDTH - 90, ROW_HEIGHT);
    ctx.clip();
    ctx.fillText(task.name, 44 + indent, textY);
    ctx.restore();

    // Duration
    ctx.fillStyle = PRINT_COLORS.textSecondary;
    ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(task.isMilestone ? '0d' : `${task.time.scheduleDuration}d`, TABLE_WIDTH - 6, textY);
    ctx.textAlign = 'left';
  }

  // Table right border
  ctx.strokeStyle = PRINT_COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TABLE_WIDTH, 0);
  ctx.lineTo(TABLE_WIDTH, canvasHeight - 40);
  ctx.stroke();

  // ---- Footer ----
  const footerY = canvasHeight - 35;
  ctx.fillStyle = PRINT_COLORS.surface;
  ctx.fillRect(0, footerY - 5, canvasWidth, 40);
  ctx.strokeStyle = PRINT_COLORS.border;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, footerY - 5);
  ctx.lineTo(canvasWidth, footerY - 5);
  ctx.stroke();

  ctx.fillStyle = PRINT_COLORS.text;
  ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(projectName, 10, footerY + 10);

  ctx.fillStyle = PRINT_COLORS.textSecondary;
  ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
  const dateStr = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.fillText(`Afgedrukt: ${dateStr}`, 10, footerY + 24);

  // Legend
  const legendX = TABLE_WIDTH + 10;
  ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';

  ctx.fillStyle = PRINT_COLORS.critical;
  ctx.fillRect(legendX, footerY + 4, 20, 8);
  ctx.fillStyle = PRINT_COLORS.textSecondary;
  ctx.fillText('Kritiek pad', legendX + 24, footerY + 10);

  ctx.fillStyle = PRINT_COLORS.normal;
  ctx.fillRect(legendX + 100, footerY + 4, 20, 8);
  ctx.fillStyle = PRINT_COLORS.textSecondary;
  ctx.fillText('Normaal', legendX + 124, footerY + 10);

  ctx.fillStyle = PRINT_COLORS.milestone;
  ctx.beginPath();
  const mx = legendX + 200 + 5;
  ctx.moveTo(mx, footerY + 3);
  ctx.lineTo(mx + 5, footerY + 8);
  ctx.lineTo(mx, footerY + 13);
  ctx.lineTo(mx - 5, footerY + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PRINT_COLORS.textSecondary;
  ctx.fillText('Mijlpaal', legendX + 214, footerY + 10);

  ctx.fillStyle = PRINT_COLORS.summary;
  ctx.fillRect(legendX + 290, footerY + 6, 20, 4);
  ctx.fillStyle = PRINT_COLORS.textSecondary;
  ctx.fillText('Samenvatting', legendX + 314, footerY + 10);

  ctx.fillStyle = PRINT_COLORS.textSecondary;
  ctx.textAlign = 'right';
  ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Open Planner Studio', canvasWidth - 10, footerY + 10);
  ctx.textAlign = 'left';

  // ---- Open print window ----
  const dataUrl = canvas.toDataURL('image/png');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up geblokkeerd. Sta pop-ups toe voor deze site.');
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>${projectName} — Afdrukvoorbeeld</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #e5e7eb;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      width: 100%;
      background: #1e1e2e;
      color: #e0e0e8;
      display: flex;
      align-items: center;
      padding: 8px 16px;
      gap: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .toolbar h1 {
      font-size: 14px;
      font-weight: 600;
      flex: 1;
    }
    .toolbar button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 6px 20px;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
    }
    .toolbar button:hover { background: #3b82f6; }
    .toolbar button.secondary {
      background: transparent;
      border: 1px solid #3e3e55;
      color: #e0e0e8;
    }
    .toolbar button.secondary:hover { background: #2e2e42; }
    .preview {
      padding: 24px;
      overflow: auto;
    }
    .page {
      background: white;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      border-radius: 2px;
    }
    .page img {
      display: block;
      max-width: 100%;
      height: auto;
    }
    @media print {
      .toolbar { display: none !important; }
      body { background: white; }
      .preview { padding: 0; }
      .page {
        box-shadow: none;
        border-radius: 0;
      }
      .page img {
        width: 100%;
        height: auto;
      }
      @page {
        size: landscape;
        margin: 8mm;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>${projectName} — Afdrukvoorbeeld</h1>
    <button class="secondary" onclick="window.close()">Sluiten</button>
    <button onclick="window.print()">Afdrukken</button>
  </div>
  <div class="preview">
    <div class="page">
      <img src="${dataUrl}" alt="Planning ${projectName}" />
    </div>
  </div>
</body>
</html>`);

  printWindow.document.close();
}
