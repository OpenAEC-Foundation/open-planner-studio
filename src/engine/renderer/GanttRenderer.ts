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
  /** Ids van driving relaties uit de laatste CPM-berekening; undefined = nog niet berekend
   *  (dan tekenen alle pijlen in de neutrale stijl, zoals voorheen). */
  drivingSequenceIds?: string[];
  /** Path tracing (MSP Task Path-stijl): focus-taak + de te markeren voorgangers/opvolgers.
   *  Actief ⇒ niet-betrokken taken dimmen; driving-ketens in een sterkere tint. */
  trace?: {
    focusId: string;
    predecessors: string[];
    drivingPredecessors: string[];
    successors: string[];
    drivenSuccessors: string[];
  } | null;
  /** Groeperingsweergave (fase 2.2): banden per activity-code-waarde vervangen de
   *  WBS-boom — bandrij (label + kleur) gevolgd door de bladtaken van die groep.
   *  Berekend in GanttCanvas via utils/grouping (gedeeld met TableEditor). */
  grouping?: { label: string; color?: string; taskIds: string[] }[];
  /** Fase 2.3: taken met geschonden late-zijde-constraint resp. gemiste deadline
   *  (uit cpmResult) — kleurt de markers rood. */
  violatedConstraintTaskIds?: string[];
  missedDeadlineTaskIds?: string[];
  /** Voortgang & baselines (fase 2.6, §6). Alle optioneel ⇒ zonder statusdatum/baseline
   *  tekent de renderer exact als voorheen (backwards-compat). */
  statusDate?: string;                                   // project.statusDate (ISO)
  showStatusDateLine?: boolean;                          // UI-toggle
  showProgressLine?: boolean;                            // UI-toggle
  showBaselineOverlay?: boolean;                         // UI-toggle
  /** Overlay-datums uit de actieve baseline, keyed op Task.id (alleen leaf-taken). */
  baselineOverlay?: Map<string, { start: string; finish: string; isMilestone: boolean }>;
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
    // The Gantt now lives inside a white floating card, so the canvas background
    // must read the card surface (white in light), NOT the workspace tint (--theme-bg).
    bg: v('--theme-surface', '#ffffff'),
    surface: v('--theme-surface-alt', '#F6F8FB'),
    grid: v('--theme-border-light', '#EDF0F5'),
    gridWeekend: v('--theme-grid-weekend', '#EFF2F7'),
    border: v('--theme-border', '#E2E7EE'),
    text: v('--theme-text', '#333845'),
    textSecondary: v('--theme-text-dim', '#5B6472'),
    critical: '#DC2626',       // kritiek (rood)
    criticalLight: '#991B1B',  // voortgangsvulling kritiek
    normal: '#2563EB',         // normale taak (blauw)
    normalLight: '#1D4ED8',    // voortgangsvulling / voltooid (blauw)
    milestone: '#7C3AED',      // mijlpaal (paars, ruit)
    float: v('--theme-bar-float', '#059669'),
    baseline: '#6B7280',
    complete: '#1D4ED8',
    selected: v('--theme-accent', '#B45309'),
    dependency: '#6B7280',
    today: v('--theme-accent', '#B45309'),
    statusDate: '#7C3AED',     // statusdatum-/voortgangslijn (paars, fase 2.6)
    headerBg: v('--theme-surface-alt', '#F6F8FB'),
    summary: '#475569',        // samenvattingsbalk (slate)
    // Constraints & deadlines (fase 2.3; constraint-kleur uit PLAN §8.2)
    constraintEarly: '#3B82F6',   // vroege-zijde (SNET/FNET): blauw
    constraintLate: '#8B5CF6',    // late-zijde/pinnend (SNLT/FNLT/MSO/MFO): violet
    deadlineOk: '#10B981',        // deadline-marker (groen; rood bij overschrijding)
    // Path tracing (MSP Task Path-conventie: voorgangers goud, opvolgers paars; driving sterker)
    tracePred: '#F59E0B',
    tracePredDriving: '#D97706',
    traceSucc: '#A78BFA',
    traceSuccDriving: '#7C3AED',
  };
}

type ThemeColors = ReturnType<typeof getThemeColors>;

export class GanttRenderer {
  private ctx: CanvasRenderingContext2D;
  private opts: GanttRenderOptions;
  private colors: ThemeColors;

  // Computed
  private viewStart: Date;
  // Rijmodel: een rij is een taak of (bij groeperingsweergave) een band-kop (null in
  // flatTasks + entry in bandAt). Alle hit-tests lopen via getTaskAtY en geven op een
  // bandrij gewoon null terug, zodat canvas-interacties vanzelf degraderen.
  private flatTasks: (Task | null)[]; // flattened rows in display order (null = bandrij)
  private flatTaskIndex: Map<string, number>; // task id -> row index in flatTasks
  private taskDepths: Map<string, number>; // task id -> nesting depth
  private bandAt: Map<number, { label: string; color?: string }>; // rij-index -> band-kop
  private holidaySet: Set<string>;
  private violatedSet: Set<string>;
  private missedDeadlineSet: Set<string>;

  constructor(ctx: CanvasRenderingContext2D, opts: GanttRenderOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.colors = getThemeColors();

    this.viewStart = parseDate(opts.view.viewStartDate);
    this.taskDepths = new Map();
    this.bandAt = new Map();
    this.flatTasks = opts.grouping
      ? this.flattenGrouped(opts.tasks, opts.grouping)
      : this.flattenTasks(opts.tasks);
    this.flatTaskIndex = new Map();
    this.flatTasks.forEach((t, i) => { if (t) this.flatTaskIndex.set(t.id, i); });
    this.holidaySet = new Set<string>();
    this.buildHolidaySet();
    this.violatedSet = new Set(opts.violatedConstraintTaskIds ?? []);
    this.missedDeadlineSet = new Set(opts.missedDeadlineTaskIds ?? []);
  }

  /** Groeperingsweergave: per band een kop-rij gevolgd door de bladtaken (vlak, diepte 0). */
  private flattenGrouped(
    tasks: Task[],
    grouping: NonNullable<GanttRenderOptions['grouping']>,
  ): (Task | null)[] {
    const byId = new Map(tasks.map(t => [t.id, t]));
    const rows: (Task | null)[] = [];
    for (const group of grouping) {
      this.bandAt.set(rows.length, { label: group.label, color: group.color });
      rows.push(null);
      for (const id of group.taskIds) {
        const task = byId.get(id);
        if (!task) continue;
        this.taskDepths.set(task.id, 0);
        rows.push(task);
      }
    }
    return rows;
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
    // Ook verborgen (ingeklapte) nakomelingen als "gezien" markeren, anders
    // vist het orphan-vangnet ze op en belanden ze onderaan de lijst.
    const seen = new Set<string>();

    const addRecursive = (task: Task, depth: number, hidden: boolean) => {
      seen.add(task.id);
      if (!hidden) {
        this.taskDepths.set(task.id, depth);
        result.push(task);
      }
      const hideChildren = hidden || collapsed.has(task.id);
      const children = tasks.filter(t => t.parentId === task.id);
      for (const child of children) {
        addRecursive(child, depth + 1, hideChildren);
      }
    };

    for (const root of roots) {
      addRecursive(root, 0, false);
    }

    // Vangnet: alleen échte wezen (ouder bestaat niet meer), geen ingeklapte kinderen
    for (const task of tasks) {
      if (!seen.has(task.id)) {
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
    this.drawStatusDateLine();
    this.drawDependencyArrows();
    this.drawTaskBars();
    this.drawProgressLine();
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

  /** Statusdatumlijn (fase 2.6, §6.1): kopie van drawTodayLine met de statusdatum + eigen kleur.
   *  Getekend ná de vandaag-lijn zodat beide zichtbaar zijn (statusdatum bovenop). */
  private drawStatusDateLine(): void {
    if (!this.opts.statusDate || this.opts.showStatusDateLine === false) return;
    const ctx = this.ctx;
    const x = this.dateToX(parseDate(this.opts.statusDate));
    if (x > this.opts.taskTableWidth && x < this.opts.canvasWidth) {
      ctx.strokeStyle = this.colors.statusDate;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x, this.opts.headerHeight);
      ctx.lineTo(x, this.opts.canvasHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** Voortgangslijn (fase 2.6, §6.3): één verticale lijn op de statusdatum die per zichtbare
   *  leaf-rij naar de voortgangspositie uitstulpt (MSP-zigzag). Hidden rijen worden overgeslagen
   *  (drawTaskBars-filter is impliciet: flatTasks bevat geen hidden rijen). Summary-/band-/mijlpaal-
   *  rijen volgen de statusdatumlijn recht. */
  private drawProgressLine(): void {
    if (!this.opts.statusDate || this.opts.showProgressLine === false) return;
    const ctx = this.ctx;
    const zoom = this.opts.view.zoom;
    const statusX = this.dateToX(parseDate(this.opts.statusDate));
    const { headerHeight, canvasHeight, canvasWidth, taskTableWidth, rowHeight } = this.opts;

    ctx.save();
    // Nooit over de takentabel tekenen.
    ctx.beginPath();
    ctx.rect(taskTableWidth, headerHeight, canvasWidth - taskTableWidth, canvasHeight - headerHeight);
    ctx.clip();

    ctx.strokeStyle = this.colors.statusDate;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(statusX, headerHeight);

    for (let i = 0; i < this.flatTasks.length; i++) {
      const rowTop = this.rowToY(i);
      const rowBottom = rowTop + rowHeight;
      if (rowBottom < headerHeight || rowTop > canvasHeight) continue;
      const rowMid = rowTop + rowHeight / 2;
      const task = this.flatTasks[i];

      let progressX = statusX;
      // Alleen echte leaf-taken (geen samenvatting/mijlpaal/band) stulpen uit.
      if (task && !task.isMilestone && task.childIds.length === 0) {
        const start = parseDate(task.time.earlyStart || task.time.scheduleStart);
        const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
        const x1 = this.dateToX(start);
        const x2 = this.dateToX(end) + zoom;
        const c = Math.max(0, Math.min(1, task.time.completion || 0));
        progressX = x1 + (x2 - x1) * c;
      }

      ctx.lineTo(statusX, rowTop);
      ctx.lineTo(progressX, rowMid);
      ctx.lineTo(statusX, rowBottom);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Baseline-onderbalk (fase 2.6, §6.2): dunne balk (of ruit voor mijlpalen) in de baseline-kleur
   *  onder de hoofdbalk, uit de actieve-baseline-overlay. Alleen als de taak een baseline-entry heeft. */
  private drawBaselineOverlay(task: Task, y: number, height: number): void {
    const overlay = this.opts.baselineOverlay;
    if (!overlay || this.opts.showBaselineOverlay === false) return;
    const entry = overlay.get(task.id);
    if (!entry) return;

    const ctx = this.ctx;
    const zoom = this.opts.view.zoom;
    const baseHeight = Math.max(2, height * 0.28);
    const baseY = y + height + 1;
    ctx.fillStyle = this.colors.baseline;

    if (entry.isMilestone) {
      // Kleine ruit in baseline-kleur op de baseline-datum.
      const x = this.dateToX(parseDate(entry.start)) + zoom / 2;
      if (x < this.opts.taskTableWidth || x > this.opts.canvasWidth) return;
      const cy = baseY + baseHeight / 2;
      const s = baseHeight;
      ctx.beginPath();
      ctx.moveTo(x, cy - s);
      ctx.lineTo(x + s, cy);
      ctx.lineTo(x, cy + s);
      ctx.lineTo(x - s, cy);
      ctx.closePath();
      ctx.fill();
      return;
    }

    const x1 = this.dateToX(parseDate(entry.start));
    const x2 = this.dateToX(parseDate(entry.finish)) + zoom;
    if (x2 < this.opts.taskTableWidth || x1 > this.opts.canvasWidth) return;
    const width = Math.max(x2 - x1, 2);
    ctx.beginPath();
    ctx.roundRect(x1, baseY, width, baseHeight, 1);
    ctx.fill();
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

    // Path tracing: betrokken taken krijgen de trace-tint (driving-keten sterker), de rest dimt.
    // De focus-taak behoudt z'n eigen kleur — de selectiering markeert hem al.
    const trace = this.opts.trace;
    const tDPred = trace ? new Set(trace.drivingPredecessors) : null;
    const tPred = trace ? new Set(trace.predecessors) : null;
    const tDSucc = trace ? new Set(trace.drivenSuccessors) : null;
    const tSucc = trace ? new Set(trace.successors) : null;

    for (let i = 0; i < this.flatTasks.length; i++) {
      const task = this.flatTasks[i];
      const y = this.rowToY(i) + barOffset;
      if (y + barHeight < this.opts.headerHeight || y > this.opts.canvasHeight) continue;

      if (!task) {
        // Bandrij (groeperingsweergave): subtiele strook over het chart-gedeelte.
        const band = this.bandAt.get(i);
        const rowY = this.rowToY(i);
        this.ctx.fillStyle = (band?.color ?? this.colors.summary) + '14';
        this.ctx.fillRect(this.opts.taskTableWidth, rowY, this.opts.canvasWidth - this.opts.taskTableWidth, this.opts.rowHeight);
        continue;
      }
      const isSelected = this.opts.selectedTaskIds.includes(task.id);

      let overrideColor: string | undefined;
      let dimmed = false;
      if (trace && task.id !== trace.focusId) {
        if (tDPred!.has(task.id)) overrideColor = this.colors.tracePredDriving;
        else if (tPred!.has(task.id)) overrideColor = this.colors.tracePred;
        else if (tDSucc!.has(task.id)) overrideColor = this.colors.traceSuccDriving;
        else if (tSucc!.has(task.id)) overrideColor = this.colors.traceSucc;
        else dimmed = true;
      }

      if (dimmed) this.ctx.globalAlpha = 0.25;
      if (task.isMilestone) {
        this.drawMilestone(task, y, barHeight, isSelected, overrideColor);
      } else if (task.childIds.length > 0) {
        this.drawSummaryBar(task, y, barHeight, isSelected, overrideColor);
      } else {
        this.drawTaskBar(task, y, barHeight, isSelected, overrideColor);
      }
      this.drawConstraintMarkers(task, y);
      if (dimmed) this.ctx.globalAlpha = 1;
      // Baseline-onderbalk (fase 2.6): op volle dekking, ná het eventuele dim-herstel.
      this.drawBaselineOverlay(task, y, barHeight);
    }
  }

  private drawTaskBar(task: Task, y: number, height: number, isSelected: boolean, overrideColor?: string): void {
    const ctx = this.ctx;
    const start = parseDate(task.time.earlyStart || task.time.scheduleStart);
    const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
    const x1 = this.dateToX(start);
    const x2 = this.dateToX(end) + this.opts.view.zoom; // Include the end day

    if (x2 < this.opts.taskTableWidth || x1 > this.opts.canvasWidth) return;

    const width = Math.max(x2 - x1, 4);
    const color = overrideColor ?? (task.time.isCritical ? this.colors.critical : (task.color || this.colors.normal));

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
      ctx.fillStyle = this.colors.float + 'E6'; // ~90% opacity — float band needs ≥3:1 vs light bg
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

  private drawSummaryBar(task: Task, y: number, height: number, isSelected: boolean, overrideColor?: string): void {
    const ctx = this.ctx;
    const start = parseDate(task.time.earlyStart || task.time.scheduleStart);
    const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
    const x1 = this.dateToX(start);
    const x2 = this.dateToX(end) + this.opts.view.zoom;

    if (x2 < this.opts.taskTableWidth || x1 > this.opts.canvasWidth) return;

    const width = Math.max(x2 - x1, 4);
    const barY = y + height * 0.3;
    const barH = height * 0.4;

    // Summary bar (afgeronde hoeken voor de moderne look; ruit-eindkappen blijven)
    ctx.fillStyle = overrideColor ?? this.colors.summary;
    ctx.beginPath();
    ctx.roundRect(x1, barY, width, barH, 2);
    ctx.fill();

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

  private drawMilestone(task: Task, y: number, height: number, isSelected: boolean, overrideColor?: string): void {
    const ctx = this.ctx;
    const date = parseDate(task.time.earlyStart || task.time.scheduleStart);
    // Grens-model (fase 2.4): een startmijlpaal ankert op het dagBEGIN (linkerrand van de
    // dagcel), een eindmijlpaal op het dagEINDE (rechterrand); automatisch blijft
    // dag-gecentreerd zoals voorheen.
    const zoom = this.opts.view.zoom;
    const anchor = task.milestoneKind === 'START' ? 0 : task.milestoneKind === 'FINISH' ? zoom : zoom / 2;
    const x = this.dateToX(date) + anchor;
    const cy = y + height / 2;
    const size = height * 0.4;

    const diamond = (s: number) => {
      ctx.beginPath();
      ctx.moveTo(x, cy - s);
      ctx.lineTo(x + s, cy);
      ctx.lineTo(x, cy + s);
      ctx.lineTo(x - s, cy);
      ctx.closePath();
    };

    ctx.fillStyle = overrideColor ?? this.colors.milestone;
    diamond(size);
    ctx.fill();

    // Verplichte (contractuele) mijlpaal: dubbel-ruit-effect — witte kern in de ruit.
    if (task.mandatory) {
      ctx.fillStyle = this.colors.bg;
      diamond(size * 0.45);
      ctx.fill();
    }

    if (isSelected) {
      ctx.strokeStyle = this.colors.selected;
      ctx.lineWidth = 2;
      diamond(size);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = this.colors.text;
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(task.name, x + size + 6, cy);
  }

  /**
   * Fase 2.3 — constraint-pins en deadline-markers (F10/F11):
   *  - constraint: klein pin-ruitje boven de balkrand — blauw aan de startkant voor
   *    vroege-zijde types (SNET/FNET), violet aan de betreffende kant voor late-zijde/
   *    pinnende types (SNLT/FNLT/MSO/MFO), rood wanneer de constraint geschonden is;
   *  - deadline: pijl-omlaag op de deadline-datum (MSP-conventie) — groen, rood bij
   *    overschrijding.
   */
  private drawConstraintMarkers(task: Task, y: number): void {
    const ctx = this.ctx;
    const chartLeft = this.opts.taskTableWidth;

    const c = task.constraint;
    if (c && c.type !== 'ASAP' && c.type !== 'ALAP') {
      const start = parseDate(task.time.earlyStart || task.time.scheduleStart);
      const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
      const startSide = c.type === 'SNET' || c.type === 'SNLT' || c.type === 'MSO';
      const px = startSide ? this.dateToX(start) : this.dateToX(end) + this.opts.view.zoom;
      if (px >= chartLeft && px <= this.opts.canvasWidth) {
        const earlySide = c.type === 'SNET' || c.type === 'FNET';
        const violated = this.violatedSet.has(task.id);
        ctx.fillStyle = violated
          ? this.colors.critical
          : earlySide ? this.colors.constraintEarly : this.colors.constraintLate;
        const cy = y - 1;
        ctx.beginPath();
        ctx.moveTo(px, cy - 4);
        ctx.lineTo(px + 4, cy);
        ctx.lineTo(px, cy + 4);
        ctx.lineTo(px - 4, cy);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (task.deadline) {
      const d = parseDate(task.deadline);
      if (!isNaN(d.getTime())) {
        // Einde van de deadline-dag, consistent met de balk-finishkant.
        const dx = this.dateToX(d) + this.opts.view.zoom;
        if (dx >= chartLeft && dx <= this.opts.canvasWidth) {
          const missed = this.missedDeadlineSet.has(task.id);
          ctx.fillStyle = missed ? this.colors.critical : this.colors.deadlineOk;
          ctx.beginPath();
          ctx.moveTo(dx - 5, y - 2);
          ctx.lineTo(dx + 5, y - 2);
          ctx.lineTo(dx, y + 5);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  private drawDependencyArrows(): void {
    const ctx = this.ctx;
    ctx.lineWidth = 1;

    // P6-conventie die elke planner direct leest: doorgetrokken = driving (bindt de opvolger),
    // gestreept = non-driving; rood wanneer de driving relatie twee kritieke taken verbindt.
    // Zonder berekening (drivingSet undefined) tekent alles neutraal doorgetrokken.
    const drivingSet = this.opts.drivingSequenceIds ? new Set(this.opts.drivingSequenceIds) : null;

    // Bij actieve path tracing dimmen pijlen waarvan een van beide taken buiten de trace valt,
    // in lijn met de gedimde balken.
    const trace = this.opts.trace;
    const traced = trace
      ? new Set([trace.focusId, ...trace.predecessors, ...trace.successors])
      : null;

    for (const seq of this.opts.sequences) {
      const predIdx = this.flatTaskIndex.get(seq.predecessorId) ?? -1;
      const succIdx = this.flatTaskIndex.get(seq.successorId) ?? -1;
      if (predIdx < 0 || succIdx < 0) continue;

      const pred = this.flatTasks[predIdx];
      const succ = this.flatTasks[succIdx];
      if (!pred || !succ) continue;

      const isDriving = drivingSet ? drivingSet.has(seq.id) : true;
      const isCriticalLink = drivingSet !== null && isDriving
        && pred.time.isCritical && succ.time.isCritical;
      const color = isCriticalLink ? this.colors.critical : this.colors.dependency;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.setLineDash(isDriving ? [] : [4, 3]);
      ctx.globalAlpha = traced && !(traced.has(seq.predecessorId) && traced.has(seq.successorId)) ? 0.15 : 1;

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

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
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
      if (y + rowHeight < headerHeight || y > canvasHeight) continue;

      if (!task) {
        // Bandrij (groeperingsweergave): getinte rij met kleurblokje + vet label.
        const band = this.bandAt.get(i);
        ctx.fillStyle = (band?.color ?? this.colors.summary) + '1A';
        ctx.fillRect(0, y, taskTableWidth, rowHeight);
        if (band?.color) {
          ctx.fillStyle = band.color;
          ctx.fillRect(8, y + rowHeight / 2 - 5, 10, 10);
        }
        ctx.fillStyle = this.colors.text;
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(band?.label ?? '', band?.color ? 24 : 8, y + rowHeight / 2);
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y + rowHeight);
        ctx.lineTo(taskTableWidth, y + rowHeight);
        ctx.stroke();
        continue;
      }

      const depth = this.taskDepths.get(task.id) || 0;
      const isSelected = this.opts.selectedTaskIds.includes(task.id);
      const isSummary = task.childIds.length > 0;
      const isCollapsed = collapsed.has(task.id);

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

  /** Get the flat tasks list (for external reference); bandrijen uitgefilterd. */
  getFlatTasks(): Task[] {
    return this.flatTasks.filter((t): t is Task => t !== null);
  }
}
