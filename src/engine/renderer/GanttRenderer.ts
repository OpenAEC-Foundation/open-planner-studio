import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { ViewState } from '@/state/slices/types';
import { parseDate, formatDate, addCalendarDays, diffCalendarDays, isoDayOfWeek, getWeekNumberFor } from '@/utils/dateUtils';
import { WorkCalendar } from '@/types/calendar';
import { TimelineTier, TIER_CONFIG, pickTiers, nextTickBoundary, snapToTickStart } from './timelineTiers';

export interface GanttRenderOptions {
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkCalendar;
  view: ViewState;
  selectedTaskIds: string[];
  collapsedTaskIds: string[];
  canvasWidth: number;
  canvasHeight: number;
  taskTableWidth: number;
  rowHeight: number;
  headerHeight: number;
  localizedMonths?: string[];
  columnHeaders?: { wbs: string; taskName: string; duration: string };
  weekStartDay?: 'monday' | 'sunday';        // default 'monday'
  enableQuarterHourZoom?: boolean;            // default false
}

// Read theme colors from CSS variables on the document element
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bg: v('--theme-bg', '#1e1e2e'),
    surface: v('--theme-surface-alt', '#252536'),
    grid: v('--theme-surface-elevated', '#2e2e42'),
    gridWeekend: v('--theme-input-bg', '#1a1a28'),
    border: v('--theme-border', '#3e3e55'),
    text: v('--theme-text', '#e0e0e8'),
    textSecondary: v('--theme-text-dim', '#9090a8'),
    critical: '#DC2626',
    criticalLight: '#991B1B',
    normal: '#2563EB',
    normalLight: '#1D4ED8',
    milestone: '#7C3AED',
    float: '#10B981',
    baseline: '#6B7280',
    complete: '#1D4ED8',
    selected: '#F59E0B',
    dependency: '#6B7280',
    today: '#F59E0B',
    headerBg: v('--theme-surface-alt', '#252536'),
    summary: '#8B5CF6',
  };
}

type ThemeColors = ReturnType<typeof getThemeColors>;

export class GanttRenderer {
  private ctx: CanvasRenderingContext2D;
  private opts: GanttRenderOptions;
  private colors: ThemeColors;

  // Computed
  private viewStart: Date;
  private flatTasks: Task[]; // flattened task list in display order
  private taskDepths: Map<string, number>; // task id -> nesting depth
  private holidaySet: Set<string>;

  constructor(ctx: CanvasRenderingContext2D, opts: GanttRenderOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.colors = getThemeColors();

    this.viewStart = parseDate(opts.view.viewStartDate);
    this.taskDepths = new Map();
    this.flatTasks = this.flattenTasks(opts.tasks);
    this.holidaySet = new Set<string>();
    this.buildHolidaySet();
  }

  private buildHolidaySet(): void {
    for (const h of this.opts.calendar.holidays) {
      const start = parseDate(h.startDate);
      const end = parseDate(h.endDate);
      const days = diffCalendarDays(start, end);
      for (let i = 0; i <= days; i++) {
        this.holidaySet.add(formatDate(addCalendarDays(start, i)));
      }
    }
  }

  private flattenTasks(tasks: Task[]): Task[] {
    const result: Task[] = [];
    const roots = tasks.filter(t => !t.parentId);
    const collapsed = new Set(this.opts.collapsedTaskIds);

    const addRecursive = (task: Task, depth: number) => {
      this.taskDepths.set(task.id, depth);
      result.push(task);
      // Skip children if collapsed
      if (collapsed.has(task.id)) return;
      const children = tasks.filter(t => t.parentId === task.id);
      for (const child of children) {
        addRecursive(child, depth + 1);
      }
    };

    for (const root of roots) {
      addRecursive(root, 0);
    }

    // Add orphans
    for (const task of tasks) {
      if (!result.find(t => t.id === task.id)) {
        this.taskDepths.set(task.id, 0);
        result.push(task);
      }
    }

    return result;
  }

  /** Convert a date (with optional sub-day precision) to X position on canvas */
  dateToX(date: Date): number {
    const msPerDay = 86400000;
    const daysFromStart = (date.getTime() - this.viewStart.getTime()) / msPerDay;
    return this.opts.taskTableWidth + daysFromStart * this.opts.view.zoom - this.opts.view.scrollX;
  }

  /** Convert task row index to Y position */
  rowToY(rowIndex: number): number {
    return this.opts.headerHeight + rowIndex * this.opts.rowHeight - this.opts.view.scrollY;
  }

  render(): void {
    const { canvasWidth, canvasHeight } = this.opts;
    const ctx = this.ctx;

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw layers
    this.drawGridBackground();
    this.drawTodayLine();
    this.drawDependencyArrows();
    this.drawTaskBars();
    this.drawTimelineHeader();
    this.drawTaskTable();
  }

  private drawGridBackground(): void {
    const { canvasWidth, canvasHeight, headerHeight, view } = this.opts;
    const ctx = this.ctx;

    // Calculate visible date range
    const visibleDays = Math.ceil(canvasWidth / view.zoom) + 2;
    const startOffset = Math.floor(view.scrollX / view.zoom);

    for (let i = -1; i < visibleDays; i++) {
      const date = addCalendarDays(this.viewStart, startOffset + i);
      const x = this.dateToX(date);
      const dayOfWeek = isoDayOfWeek(date);
      const dateStr = formatDate(date);

      // Weekend or holiday background
      if (dayOfWeek === 6 || dayOfWeek === 7 || this.holidaySet.has(dateStr)) {
        ctx.fillStyle = this.colors.gridWeekend;
        ctx.fillRect(x, headerHeight, view.zoom, canvasHeight - headerHeight);
      }

      // Vertical grid line
      ctx.strokeStyle = this.colors.grid;
      ctx.lineWidth = dayOfWeek === (this.opts.weekStartDay === 'sunday' ? 7 : 1) ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, headerHeight);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    // Horizontal grid lines (per row)
    for (let i = 0; i < this.flatTasks.length + 1; i++) {
      const y = this.rowToY(i);
      if (y < headerHeight || y > canvasHeight) continue;
      ctx.strokeStyle = this.colors.grid;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  }

  private drawTodayLine(): void {
    const ctx = this.ctx;
    const today = new Date();
    const x = this.dateToX(today);

    if (x > this.opts.taskTableWidth && x < this.opts.canvasWidth) {
      ctx.strokeStyle = this.colors.today;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, this.opts.headerHeight);
      ctx.lineTo(x, this.opts.canvasHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawTimelineHeader(): void {
    const { canvasWidth, headerHeight, view, enableQuarterHourZoom } = this.opts;
    const ctx = this.ctx;

    // Header background + bottom border
    ctx.fillStyle = this.colors.headerBg;
    ctx.fillRect(0, 0, canvasWidth, headerHeight);
    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(canvasWidth, headerHeight);
    ctx.stroke();

    const enableQH = enableQuarterHourZoom ?? false;
    const { major, minor } = pickTiers(view.zoom, enableQH);

    // Visible date range
    const startDate = addCalendarDays(this.viewStart, Math.floor(view.scrollX / view.zoom) - 1);
    const endDate = addCalendarDays(this.viewStart, Math.ceil((view.scrollX + canvasWidth) / view.zoom) + 1);

    // --- Top row: major tier ---
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = this.colors.text;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    this.drawTierLabels(major, startDate, endDate, headerHeight / 4);

    // --- Bottom row: minor tier ---
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = this.colors.textSecondary;
    this.drawTierLabels(minor, startDate, endDate, headerHeight * 3 / 4);
  }

  private drawTierLabels(
    tier: TimelineTier,
    startDate: Date,
    endDate: Date,
    yCenter: number,
  ): void {
    const { canvasWidth, taskTableWidth, weekStartDay, localizedMonths } = this.opts;
    const wsd = weekStartDay ?? 'monday';
    const ctx = this.ctx;
    const cfg = TIER_CONFIG[tier];

    // Snap to the tick boundary at-or-before startDate
    let cursor = snapToTickStart(startDate, tier, wsd);
    let lastDrawnRight = -Infinity;

    while (cursor.getTime() <= endDate.getTime()) {
      const next = nextTickBoundary(cursor, tier);
      const x1 = this.dateToX(cursor);
      const x2 = this.dateToX(next);
      const labelText = this.formatTierLabel(tier, cursor, wsd, localizedMonths);

      // Skip tick entirely if it doesn't reach the visible task area
      if (x2 <= taskTableWidth) {
        cursor = next;
        continue;
      }
      // Stop once we're past the right edge
      if (x1 >= canvasWidth) break;

      const labelX = Math.max(x1 + 4, taskTableWidth + 4);
      const slotWidth = x2 - Math.max(x1, taskTableWidth);

      // Defensive skip: if slot is too narrow OR we'd overlap the previous label
      if (slotWidth >= cfg.minLabelWidth && labelX > lastDrawnRight + 4) {
        ctx.fillText(labelText, labelX, yCenter);
        const measured = ctx.measureText(labelText).width;
        lastDrawnRight = labelX + measured;
      }

      cursor = next;
    }
  }

  private formatTierLabel(
    tier: TimelineTier,
    d: Date,
    weekStartDay: 'monday' | 'sunday',
    localizedMonths?: string[]
  ): string {
    const months = localizedMonths || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n: number) => n.toString().padStart(2, '0');
    switch (tier) {
      case 'year':        return `${d.getUTCFullYear()}`;
      case 'quarter':     return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
      case 'month':       return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      case 'week':        return `W${getWeekNumberFor(d, weekStartDay)}`;
      case 'day':         return `${d.getUTCDate()}`;
      case 'hour':        return `${pad(d.getUTCHours())}:00`;
      case 'quarterHour': return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    }
  }

  private drawTaskBars(): void {
    const { rowHeight } = this.opts;
    const barHeight = rowHeight * 0.5;
    const barOffset = (rowHeight - barHeight) / 2;

    for (let i = 0; i < this.flatTasks.length; i++) {
      const task = this.flatTasks[i];
      const y = this.rowToY(i) + barOffset;
      const isSelected = this.opts.selectedTaskIds.includes(task.id);

      if (y + barHeight < this.opts.headerHeight || y > this.opts.canvasHeight) continue;

      if (task.isMilestone) {
        this.drawMilestone(task, y, barHeight, isSelected);
      } else if (task.childIds.length > 0) {
        this.drawSummaryBar(task, y, barHeight, isSelected);
      } else {
        this.drawTaskBar(task, y, barHeight, isSelected);
      }
    }
  }

  private drawTaskBar(task: Task, y: number, height: number, isSelected: boolean): void {
    const ctx = this.ctx;
    const start = parseDate(task.time.earlyStart || task.time.scheduleStart);
    const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
    const x1 = this.dateToX(start);
    const x2 = this.dateToX(end) + this.opts.view.zoom; // Include the end day

    if (x2 < this.opts.taskTableWidth || x1 > this.opts.canvasWidth) return;

    const width = Math.max(x2 - x1, 4);
    const color = task.time.isCritical ? this.colors.critical : (task.color || this.colors.normal);

    // Bar background
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x1, y, width, height, 3);
    ctx.fill();

    // Progress fill
    if (task.time.completion > 0) {
      const progressWidth = width * task.time.completion;
      ctx.fillStyle = task.time.isCritical ? this.colors.criticalLight : this.colors.normalLight;
      ctx.beginPath();
      ctx.roundRect(x1, y, progressWidth, height, 3);
      ctx.fill();
    }

    // Float indicator
    if (task.time.totalFloat > 0 && !task.time.isCritical) {
      const floatWidth = task.time.totalFloat * this.opts.view.zoom;
      ctx.fillStyle = this.colors.float + '40'; // 25% opacity
      ctx.fillRect(x2, y + height / 4, floatWidth, height / 2);
    }

    // Selection highlight
    if (isSelected) {
      ctx.strokeStyle = this.colors.selected;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x1 - 1, y - 1, width + 2, height + 2, 4);
      ctx.stroke();
    }

    // Task name on bar (if wide enough)
    if (width > 40) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.beginPath();
      ctx.rect(x1 + 4, y, width - 8, height);
      ctx.clip();
      ctx.fillText(task.name, x1 + 6, y + height / 2);
      ctx.restore();
    }
  }

  private drawSummaryBar(task: Task, y: number, height: number, isSelected: boolean): void {
    const ctx = this.ctx;
    const start = parseDate(task.time.earlyStart || task.time.scheduleStart);
    const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
    const x1 = this.dateToX(start);
    const x2 = this.dateToX(end) + this.opts.view.zoom;

    if (x2 < this.opts.taskTableWidth || x1 > this.opts.canvasWidth) return;

    const width = Math.max(x2 - x1, 4);
    const barY = y + height * 0.3;
    const barH = height * 0.4;

    // Summary bar
    ctx.fillStyle = this.colors.summary;
    ctx.fillRect(x1, barY, width, barH);

    // Triangles at start and end
    ctx.beginPath();
    ctx.moveTo(x1, barY);
    ctx.lineTo(x1, barY + barH + 4);
    ctx.lineTo(x1 + 6, barY + barH);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x1 + width, barY);
    ctx.lineTo(x1 + width, barY + barH + 4);
    ctx.lineTo(x1 + width - 6, barY + barH);
    ctx.closePath();
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = this.colors.selected;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 - 1, barY - 1, width + 2, barH + 6);
    }
  }

  private drawMilestone(task: Task, y: number, height: number, isSelected: boolean): void {
    const ctx = this.ctx;
    const date = parseDate(task.time.earlyStart || task.time.scheduleStart);
    const x = this.dateToX(date) + this.opts.view.zoom / 2;
    const cy = y + height / 2;
    const size = height * 0.4;

    ctx.fillStyle = this.colors.milestone;
    ctx.beginPath();
    ctx.moveTo(x, cy - size);
    ctx.lineTo(x + size, cy);
    ctx.lineTo(x, cy + size);
    ctx.lineTo(x - size, cy);
    ctx.closePath();
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = this.colors.selected;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = this.colors.text;
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(task.name, x + size + 6, cy);
  }

  private drawDependencyArrows(): void {
    const ctx = this.ctx;
    ctx.strokeStyle = this.colors.dependency;
    ctx.fillStyle = this.colors.dependency;
    ctx.lineWidth = 1;

    for (const seq of this.opts.sequences) {
      const predIdx = this.flatTasks.findIndex(t => t.id === seq.predecessorId);
      const succIdx = this.flatTasks.findIndex(t => t.id === seq.successorId);
      if (predIdx < 0 || succIdx < 0) continue;

      const pred = this.flatTasks[predIdx];
      const succ = this.flatTasks[succIdx];

      const rowH = this.opts.rowHeight;
      const predY = this.rowToY(predIdx) + rowH / 2;
      const succY = this.rowToY(succIdx) + rowH / 2;

      let fromX: number, toX: number;

      switch (seq.type) {
        case 'FINISH_START': {
          const predEnd = parseDate(pred.time.earlyFinish || pred.time.scheduleFinish);
          fromX = this.dateToX(predEnd) + this.opts.view.zoom;
          const succStart = parseDate(succ.time.earlyStart || succ.time.scheduleStart);
          toX = this.dateToX(succStart);
          break;
        }
        case 'START_START': {
          const predStart = parseDate(pred.time.earlyStart || pred.time.scheduleStart);
          fromX = this.dateToX(predStart);
          const succStart = parseDate(succ.time.earlyStart || succ.time.scheduleStart);
          toX = this.dateToX(succStart);
          break;
        }
        default: {
          const predEnd = parseDate(pred.time.earlyFinish || pred.time.scheduleFinish);
          fromX = this.dateToX(predEnd) + this.opts.view.zoom;
          const succStart = parseDate(succ.time.earlyStart || succ.time.scheduleStart);
          toX = this.dateToX(succStart);
        }
      }

      if (fromX < this.opts.taskTableWidth && toX < this.opts.taskTableWidth) continue;

      // Draw path
      ctx.beginPath();
      ctx.moveTo(fromX, predY);
      const midX = fromX + 8;
      ctx.lineTo(midX, predY);
      ctx.lineTo(midX, succY);
      ctx.lineTo(toX, succY);
      ctx.stroke();

      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(toX, succY);
      ctx.lineTo(toX - 5, succY - 3);
      ctx.lineTo(toX - 5, succY + 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawTaskTable(): void {
    const { taskTableWidth, canvasHeight, headerHeight, rowHeight } = this.opts;
    const ctx = this.ctx;
    const collapsed = new Set(this.opts.collapsedTaskIds);

    // Table background
    ctx.fillStyle = this.colors.surface;
    ctx.fillRect(0, 0, taskTableWidth, canvasHeight);

    // Header
    ctx.fillStyle = this.colors.headerBg;
    ctx.fillRect(0, 0, taskTableWidth, headerHeight);

    // Header text
    const headers = this.opts.columnHeaders || { wbs: 'WBS', taskName: 'Taaknaam', duration: 'Duur' };
    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(headers.wbs, 8, headerHeight / 2);
    ctx.fillText(headers.taskName, 60, headerHeight / 2);
    ctx.fillText(headers.duration, taskTableWidth - 45, headerHeight / 2);

    // Header border
    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(taskTableWidth, headerHeight);
    ctx.stroke();

    // Task rows
    for (let i = 0; i < this.flatTasks.length; i++) {
      const task = this.flatTasks[i];
      const y = this.rowToY(i);
      const depth = this.taskDepths.get(task.id) || 0;
      const isSelected = this.opts.selectedTaskIds.includes(task.id);
      const isSummary = task.childIds.length > 0;
      const isCollapsed = collapsed.has(task.id);

      if (y + rowHeight < headerHeight || y > canvasHeight) continue;

      // Selection highlight
      if (isSelected) {
        ctx.fillStyle = this.colors.selected + '20';
        ctx.fillRect(0, y, taskTableWidth, rowHeight);
      }

      // Summary row subtle background
      if (isSummary) {
        ctx.fillStyle = this.colors.summary + '08';
        ctx.fillRect(0, y, taskTableWidth, rowHeight);
      }

      // Row border
      ctx.strokeStyle = this.colors.grid;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight);
      ctx.lineTo(taskTableWidth, y + rowHeight);
      ctx.stroke();

      const textY = y + rowHeight / 2;
      const indent = 55 + depth * 16;

      // WBS code
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(task.wbsCode || '', 8, textY);

      // Collapse/expand triangle for summary tasks
      if (isSummary) {
        const triX = indent - 2;
        const triY = textY;
        ctx.fillStyle = this.colors.textSecondary;
        ctx.beginPath();
        if (isCollapsed) {
          // Right-pointing triangle (collapsed)
          ctx.moveTo(triX - 8, triY - 4);
          ctx.lineTo(triX - 8, triY + 4);
          ctx.lineTo(triX - 2, triY);
        } else {
          // Down-pointing triangle (expanded)
          ctx.moveTo(triX - 9, triY - 3);
          ctx.lineTo(triX - 1, triY - 3);
          ctx.lineTo(triX - 5, triY + 3);
        }
        ctx.closePath();
        ctx.fill();
      }

      // Task name
      ctx.fillStyle = isSummary ? this.colors.summary : this.colors.text;
      ctx.font = isSummary ? 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif' : '11px -apple-system, BlinkMacSystemFont, sans-serif';

      ctx.save();
      ctx.beginPath();
      ctx.rect(indent, y, taskTableWidth - indent - 55, rowHeight);
      ctx.clip();
      ctx.fillText(task.name, indent + 2, textY);
      ctx.restore();

      // '+' button for summary tasks (add child)
      if (isSummary) {
        const btnX = taskTableWidth - 52;
        const btnY = textY - 6;
        const btnSize = 12;
        ctx.fillStyle = this.colors.float + '60';
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnSize, btnSize, 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+', btnX + btnSize / 2, textY);
        ctx.textAlign = 'left';
      }

      // Duration
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'right';
      const durText = task.isMilestone ? '0d' : `${task.time.scheduleDuration}d`;
      ctx.fillText(durText, taskTableWidth - 8, textY);
      ctx.textAlign = 'left';
    }

    // Right border of table
    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(taskTableWidth, 0);
    ctx.lineTo(taskTableWidth, canvasHeight);
    ctx.stroke();
  }

  /** Hit test: which task row is at the given canvas Y? */
  getTaskAtY(canvasY: number): Task | null {
    const rowIndex = Math.floor((canvasY - this.opts.headerHeight + this.opts.view.scrollY) / this.opts.rowHeight);
    return this.flatTasks[rowIndex] || null;
  }

  /** Hit test: get the row index for a Y position */
  getRowIndex(canvasY: number): number {
    return Math.floor((canvasY - this.opts.headerHeight + this.opts.view.scrollY) / this.opts.rowHeight);
  }

  /** Hit test: is this position in the task table area? */
  isInTaskTable(canvasX: number): boolean {
    return canvasX < this.opts.taskTableWidth;
  }

  /** Hit test: did the click land on the collapse/expand triangle of a summary task? */
  isCollapseToggle(canvasX: number, canvasY: number): Task | null {
    const task = this.getTaskAtY(canvasY);
    if (!task || task.childIds.length === 0) return null;
    const depth = this.taskDepths.get(task.id) || 0;
    const indent = 55 + depth * 16;
    // Triangle area is roughly indent-12 to indent
    if (canvasX >= indent - 14 && canvasX <= indent + 2) {
      return task;
    }
    return null;
  }

  /** Hit test: did the click land on the '+' button of a summary task? */
  isAddButton(canvasX: number, canvasY: number): Task | null {
    const task = this.getTaskAtY(canvasY);
    if (!task || task.childIds.length === 0) return null;
    const btnX = this.opts.taskTableWidth - 52;
    if (canvasX >= btnX && canvasX <= btnX + 14) {
      return task;
    }
    return null;
  }

  /** Hit test: get task bar bounds for a task at row index (for drag & drop) */
  getTaskBarBounds(canvasX: number, canvasY: number): { task: Task; edge: 'left' | 'right' | 'body' } | null {
    if (canvasX < this.opts.taskTableWidth) return null;
    const task = this.getTaskAtY(canvasY);
    if (!task || task.childIds.length > 0 || task.isMilestone) return null;

    const start = parseDate(task.time.earlyStart || task.time.scheduleStart);
    const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
    const x1 = this.dateToX(start);
    const x2 = this.dateToX(end) + this.opts.view.zoom;
    const edgeZone = 6; // pixels for edge detection

    if (canvasX >= x1 - edgeZone && canvasX <= x2 + edgeZone) {
      if (canvasX <= x1 + edgeZone) return { task, edge: 'left' };
      if (canvasX >= x2 - edgeZone) return { task, edge: 'right' };
      return { task, edge: 'body' };
    }
    return null;
  }

  /** Get the flat tasks list (for external reference) */
  getFlatTasks(): Task[] {
    return this.flatTasks;
  }
}
