import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { ViewState, BarSplitMode, DurationDisplay } from '@/state/slices/types';
import { parseDate, parseInstant, formatDate, addCalendarDays, diffCalendarDays, isoDayOfWeek, getWeekNumberFor } from '@/utils/dateUtils';
import { WorkCalendar } from '@/types/calendar';
import { isHourCalendar } from '@/services/subdayIo';
import { effHoursPerDay, taskDurationMinutes } from '@/utils/taskDuration';
import { formatDuration, type DurationSuffixes } from '@/utils/durationFormat';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { firstRowIndexByTask, type ViewRow } from '@/engine/view/visibleRows';
import { TimelineTier, TIER_CONFIG, pickTiers, nextTickBoundary, snapToTickStart } from './timelineTiers';

export interface GanttRenderOptions {
  /** DE gedeelde zichtbare-rijenlijst (fase 2.7, §4): de renderer flattent NIET meer zelf —
   *  tabel en Gantt consumeren exact dezelfde `viewRows` uit de store, zodat rij i in beide
   *  hetzelfde is (bandkoppen incluis). */
  rows: ViewRow[];
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
  /** Fase 2.8b (§6.1/§6.9): effectieve kalender per taak-id (`task.calendarId` → bibliotheek, anders
   *  projectkalender). Bepaalt per taak of hij uur-modus is (sub-dag-balkpositie) en levert de
   *  banden voor de balk-opsplitsing. Afwezig ⇒ alle taken vallen terug op de projectkalender. */
  effectiveCalById?: Map<string, WorkCalendar>;
  /** Fase 2.8b (§6.9): stand van "Taakbalken bij onderbrekingen". Default 'selection'. */
  barSplitMode?: BarSplitMode;
  /** Fase 2.8b (§6.5): hoofdschakelaar Urenplanning. UIT ⇒ duurkolom byte-identiek (`Nd`). */
  enableHourPlanning?: boolean;
  /** Fase 2.8b (§6.5): Duurweergave-instelling voor de duurkolom (auto/dagen/uren). */
  durationDisplay?: DurationDisplay;
  /** Fase 2.8b (§6.4/§11): vertaalde eenheid-afkortingen voor de duurkolom-WEERGAVE. Afwezig ⇒ NL d/u/m. */
  durationSuffixes?: DurationSuffixes;
  /** Fase 2.9 (§5.5): vertaald "verouderd"-badgelabel voor een externe ghost-balk met sourceMissing.
   *  Afwezig ⇒ NL 'verouderd'. */
  externalStaleLabel?: string;
  /** Fase 2.9 (§5.4): high-contrast-thema actief. BINDEND user-besluit — in HC is kleur alléén
   *  onvoldoende, dus near-critical-balken krijgen een geblokt/gearceerd vulpatroon (kritiek=massief,
   *  near-critical=geblokt, normaal=omlijnd). Afwezig/false ⇒ licht/donker (amber-kleur als signaal). */
  highContrast?: boolean;
}

// Near-critical "geblokt"-vulpatroon voor het high-contrast-thema (fase 2.9 §5.4, BINDEND besluit).
// GEMEMOIZED op moduleniveau: de bitmap wordt één keer getekend en de `CanvasPattern` één keer
// gemunt — nooit per frame (elke render maakt een nieuwe GanttRenderer, dus instance-caching zou
// per-frame zijn). Diagonale zwarte blokjes (8×8-tegel, twee kwadranten gevuld) lezen als "geblokt"
// bovenop de amber themakleur, zodat near-critical zonder kleurwaarneming te onderscheiden is.
let nearCriticalHatch: CanvasPattern | null = null;
function getNearCriticalHatch(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (nearCriticalHatch) return nearCriticalHatch;
  const size = 8;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const p = tile.getContext('2d');
  if (!p) return null;
  p.fillStyle = 'rgba(0,0,0,0.82)';
  p.fillRect(0, 0, size / 2, size / 2);
  p.fillRect(size / 2, size / 2, size / 2, size / 2);
  nearCriticalHatch = ctx.createPattern(tile, 'repeat');
  return nearCriticalHatch;
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
    nearCritical: '#F59E0B',   // bijna-kritiek (amber, tussen kritiek-rood en float-groen, fase 2.9 §5.4)
    hammock: '#0E7490',        // hammock/LOE-balk (teal, fase 2.9 §5.3)
    normal: '#2563EB',         // normale taak (blauw)
    normalLight: '#1D4ED8',    // voortgangsvulling / voltooid (blauw)
    milestone: '#7C3AED',      // mijlpaal (paars, ruit)
    float: v('--theme-bar-float', '#059669'),
    baseline: '#6B7280',
    complete: '#1D4ED8',
    selected: v('--theme-accent', '#B45309'),
    dependency: '#6B7280',
    today: v('--theme-accent', '#B45309'),
    statusDate: v('--theme-accent', '#B45309'),  // statusdatum-/voortgangslijn (accent-oranje, zoals oorspronkelijk fase 2.6 — zelfde bron als `today`/`selected`)
    headerBg: v('--theme-surface-alt', '#F6F8FB'),
    summary: '#475569',        // samenvattingsbalk (slate)
    ghost: '#94A3B8',          // externe (cross-project) ghost-balk (grijs, fase 2.9 §5.5)
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
  // Rijmodel (fase 2.7, §4): de meegegeven gedeelde `viewRows`. Een rij is een taak-rij
  // (met depth/dimmed) of een bandkop-rij (`kind:'group'`). Alle hit-tests lopen via
  // getTaskAtY/getRowAtY en geven op een bandrij null/de bandrij terug, zodat
  // canvas-interacties vanzelf degraderen.
  private rows: ViewRow[];
  private rowIndexByTask: Map<string, number>; // task id -> EERSTE rij-index (§7.1, pijlen)
  private holidaySet: Set<string>;
  private violatedSet: Set<string>;
  private missedDeadlineSet: Set<string>;
  private highContrast: boolean;

  /** Alpha voor gedimde rijen (filter-ouderketen, §4.2). */
  private static readonly DIM_ALPHA = 0.45;

  /** Fase 2.8b: per-kalender-id gecachete `CalendarEngine` voor de balk-opsplitsing (§6.9). De
   *  band-materialisatie zelf is gememoized op het kalender-OBJECT (WeakMap), dus deze cache
   *  voorkomt alleen herhaalde engine-constructie binnen één render. */
  private engineCache = new Map<string, CalendarEngine>();

  constructor(ctx: CanvasRenderingContext2D, opts: GanttRenderOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.colors = getThemeColors();

    this.viewStart = parseDate(opts.view.viewStartDate);
    this.rows = opts.rows;
    // "Eerste index wint" (§7.1): bij multi-band-duplicaten verbinden pijlen de eerste occurrence.
    this.rowIndexByTask = firstRowIndexByTask(opts.rows);
    this.holidaySet = new Set<string>();
    this.buildHolidaySet();
    this.violatedSet = new Set(opts.violatedConstraintTaskIds ?? []);
    this.missedDeadlineSet = new Set(opts.missedDeadlineTaskIds ?? []);
    this.highContrast = !!opts.highContrast;
  }

  /** Basis-balkkleur (fase 2.9 §5.4): kritiek-rood ≻ near-critical-amber ≻ float-path-tint ≻
   *  eigen kleur/normaal-blauw. `overrideColor` (trace-tint) wint altijd. Near-critical en de
   *  float-path-tint zijn analyse-overlays die alleen bestaan wanneer hun optie aanstaat ⇒ default
   *  byte-identiek (`isNearCritical`/`floatPath` afwezig). */
  private barColor(task: Task, overrideColor?: string): string {
    if (overrideColor) return overrideColor;
    if (task.time.isCritical) return this.colors.critical;
    if (task.time.isNearCritical) return this.colors.nearCritical;
    const fp = task.time.floatPath;
    if (fp !== undefined && fp > 1) {
      return GanttRenderer.FLOAT_PATH_TINTS[(fp - 2) % GanttRenderer.FLOAT_PATH_TINTS.length];
    }
    return task.color || this.colors.normal;
  }

  /** Optionele tint per float-pad (fase 2.9 §5.4): pad 1 = kritiek (rood, hierboven), paden ≥2
   *  krijgen elk een eigen tint. Alleen actief wanneer de floatPaths-optie draait (anders is
   *  `floatPath` ongezet). */
  private static readonly FLOAT_PATH_TINTS = [
    '#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#0D9488', '#9333EA',
  ];

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

  /**
   * Duurkolom-tekst (§6.5). Urenplanning UIT ⇒ byte-identiek het huidige `${scheduleDuration}d`.
   * AAN ⇒ de eigen eenheid per taak via de Duurweergave-instelling (dag-taak "3d", uur-taak "20u").
   */
  private durationText(task: Task): string {
    if (task.isMilestone) return '0d';
    if (!this.opts.enableHourPlanning) return `${task.time.scheduleDuration}d`;
    const cal = this.opts.effectiveCalById?.get(task.id) ?? this.opts.calendar;
    return formatDuration(taskDurationMinutes(task, cal), effHoursPerDay(cal), this.opts.durationDisplay ?? 'auto', this.opts.durationSuffixes);
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

  // ── Fase 2.8b: uur-bewuste balkgeometrie (§6.1) ────────────────────────────
  // Discriminator: een taak is UUR-modus zodra zijn (early/schedule-)datumstring een tijdcomponent
  // ('T') draagt — precies wat `formatInstant('hour')` emitteert (§2.4). Dag-taken (YYYY-MM-DD)
  // vallen dus ALTIJD op het bestaande dag-pad (`parseDate` + één dag breedte) ⇒ bit-identiek.

  /** Balk-uiteinden voor een taak. Uur-taak: `[dateToX(start), dateToX(finish))` (geen +dag, §6.1).
   *  Dag-taak: `[dateToX(start), dateToX(finish)+zoom)` (inclusieve eind-dag, ongewijzigd). */
  private barGeometry(task: Task): { x1: number; x2: number; hourMode: boolean; start: Date; end: Date } {
    const startStr = task.time.earlyStart || task.time.scheduleStart;
    const endStr = task.time.earlyFinish || task.time.scheduleFinish;
    const hourMode = startStr.includes('T') || endStr.includes('T');
    const start = hourMode ? parseInstant(startStr) : parseDate(startStr);
    const end = hourMode ? parseInstant(endStr) : parseDate(endStr);
    const x1 = this.dateToX(start);
    const x2 = hourMode ? this.dateToX(end) : this.dateToX(end) + this.opts.view.zoom;
    return { x1, x2, hourMode, start, end };
  }

  /** De effectieve `CalendarEngine` voor een taak (uur-modus), of null als de taak op een
   *  dag-kalender staat / geen kalendermap is meegegeven — dan wordt er niet opgesplitst. */
  private engineFor(task: Task): CalendarEngine | null {
    const cal = this.opts.effectiveCalById?.get(task.id) ?? this.opts.calendar;
    if (!isHourCalendar(cal)) return null;
    let eng = this.engineCache.get(cal.id);
    if (!eng) {
      eng = new CalendarEngine(cal);
      this.engineCache.set(cal.id, eng);
    }
    return eng;
  }

  /** Of een uur-taakbalk in werkblok-segmenten wordt getekend (§6.9): 'always' ⇒ altijd,
   *  'selection' ⇒ alleen als de taak geselecteerd is, 'never' ⇒ nooit. */
  private shouldSplit(isSelected: boolean): boolean {
    const mode = this.opts.barSplitMode ?? 'selection';
    return mode === 'always' || (mode === 'selection' && isSelected);
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
    // Ná de taakbalken (niet direct na de grid): een balk die een feestdagblok overspant zou het
    // naamlabel anders overschilderen — juist het scenario dat §6.2 zichtbaar moet maken (2.5-QA:
    // "opgerekte balk van vier weken" zonder duiding).
    this.drawHolidayLabels();
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
    for (let i = 0; i < this.rows.length + 1; i++) {
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

  /**
   * Naamlabel bij meerdaagse feestdagblokken (fase 2.8a, §6.2 — 2.5-QA-verhaal: een 5-daagse
   * taak leek een "opgerekte balk van vier weken" zonder dat de bouwvak-arcering zich verklaarde).
   * De arcering zelf blijft uitsluitend de projectkalender (§6.1); deze pass tekent alleen een
   * naam bovenop bestaande feestdagblokken die breder zijn dan ~3× de dagbreedte (te smal ⇒ geen
   * label, voorkomt onleesbare rommel bij losse enkele-dag-feestdagen). Horizontaal gecentreerd
   * bij voldoende breedte, anders verticaal (90°) langs de linkerrand van het blok.
   */
  private drawHolidayLabels(): void {
    const { canvasWidth, canvasHeight, headerHeight, taskTableWidth, view } = this.opts;
    const zoom = view.zoom;
    const minWidthPx = zoom * 3;
    const ctx = this.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.rect(taskTableWidth, headerHeight, Math.max(0, canvasWidth - taskTableWidth), Math.max(0, canvasHeight - headerHeight));
    ctx.clip();
    ctx.fillStyle = this.colors.textSecondary;

    for (const h of this.opts.calendar.holidays) {
      const start = parseDate(h.startDate);
      const end = parseDate(h.endDate);
      const days = diffCalendarDays(start, end) + 1;
      const widthPx = days * zoom;
      if (widthPx < minWidthPx) continue; // te smal voor een leesbaar label

      const x1 = this.dateToX(start);
      const x2 = x1 + widthPx;
      if (x2 < taskTableWidth || x1 > canvasWidth) continue; // volledig buiten beeld

      const clipX1 = Math.max(x1, taskTableWidth);
      const clipX2 = Math.min(x2, canvasWidth);
      const visibleWidth = clipX2 - clipX1;
      if (visibleWidth < zoom) continue;

      if (widthPx >= 70) {
        // Breed genoeg: horizontaal, gecentreerd in het zichtbare deel van het blok, bovenaan.
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(h.name, (clipX1 + clipX2) / 2, headerHeight + 6, visibleWidth - 8);
      } else {
        // Smal blok: verticale tekst langs de linkerrand.
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.save();
        ctx.translate(clipX1 + zoom / 2, headerHeight + 8);
        ctx.rotate(Math.PI / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(h.name, 0, 0, Math.max(0, canvasHeight - headerHeight - 16));
        ctx.restore();
      }
    }
    ctx.restore();
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
   *  Getekend ná de vandaag-lijn zodat beide zichtbaar zijn (statusdatum bovenop).
   *  De voortgangslijn (`drawProgressLine`, verderop getekend) tekent zelf al een ononderbroken
   *  spine op exact dezelfde X in dezelfde kleur — als die actief is zou deze gestippelde lijn er
   *  bovenop dubbel tekenen (stippel-door-massief-effect / geknipper). Zodra de voortgangslijn aan
   *  staat, IS die de statusdatum-markering; deze losse lijn treedt dan terug. */
  private drawStatusDateLine(): void {
    if (!this.opts.statusDate || this.opts.showStatusDateLine === false) return;
    if (this.opts.showProgressLine !== false) return;
    const ctx = this.ctx;
    const x = this.dateToX(parseDate(this.opts.statusDate));
    if (x > this.opts.taskTableWidth && x < this.opts.canvasWidth) {
      ctx.strokeStyle = this.colors.statusDate;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, this.opts.headerHeight);
      ctx.lineTo(x, this.opts.canvasHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** Voortgangslijn (fase 2.6, §6.3): één verticale lijn op de statusdatum die per zichtbare
   *  leaf-rij naar de voortgangspositie uitstulpt (MSP-zigzag). Hidden rijen worden overgeslagen
   *  (drawTaskBars-filter is impliciet: `rows` bevat geen hidden rijen). Summary-/band-/mijlpaal-
   *  rijen volgen de statusdatumlijn recht. */
  private drawProgressLine(): void {
    if (!this.opts.statusDate || this.opts.showProgressLine === false) return;
    const ctx = this.ctx;
    const statusDay = parseDate(this.opts.statusDate);
    const statusX = this.dateToX(statusDay);
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

    for (let i = 0; i < this.rows.length; i++) {
      const rowTop = this.rowToY(i);
      const rowBottom = rowTop + rowHeight;
      if (rowBottom < headerHeight || rowTop > canvasHeight) continue;
      const rowMid = rowTop + rowHeight / 2;
      const row = this.rows[i];
      const task = row.kind === 'task' ? row.task : null;

      let progressX = statusX;
      // Alleen echte leaf-taken (geen samenvatting/mijlpaal/band) stulpen uit.
      if (task && !task.isMilestone && task.childIds.length === 0) {
        const geo = this.barGeometry(task);
        const c = Math.max(0, Math.min(1, task.time.completion || 0));
        // Dagniveau-vergelijking t.o.v. de statusdatum (ook voor uur-taken: alleen de
        // kalenderdag telt hier mee, niet het uur) — zo blijft "op de statusdatum" stabiel.
        const finishDay = new Date(geo.end.getFullYear(), geo.end.getMonth(), geo.end.getDate());
        const startDay = new Date(geo.start.getFullYear(), geo.start.getMonth(), geo.start.getDate());
        const fullyDoneByStatus = c >= 1 && finishDay <= statusDay;
        const notYetStarted = c === 0 && startDay >= statusDay;
        if (!fullyDoneByStatus && !notYetStarted) {
          progressX = geo.x1 + (geo.x2 - geo.x1) * c;
        }
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

    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const y = this.rowToY(i) + barOffset;
      if (y + barHeight < this.opts.headerHeight || y > this.opts.canvasHeight) continue;

      if (row.kind === 'group') {
        // Bandkop-rij (§4.4): volle-breedte strook over het chart-gedeelte, op exact
        // dezelfde rij-index als de tabel-bandkop.
        const rowY = this.rowToY(i);
        this.ctx.fillStyle = this.colors.summary + '14';
        this.ctx.fillRect(this.opts.taskTableWidth, rowY, this.opts.canvasWidth - this.opts.taskTableWidth, this.opts.rowHeight);
        continue;
      }
      const task = row.task;
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
      else if (row.dimmed) this.ctx.globalAlpha = GanttRenderer.DIM_ALPHA; // filter-ouderketen (§4.2)
      if (task.isMilestone) {
        this.drawMilestone(task, y, barHeight, isSelected, overrideColor);
      } else if (task.childIds.length > 0) {
        this.drawSummaryBar(task, y, barHeight, isSelected, overrideColor);
      } else if (task.isHammock) {
        this.drawHammockBar(task, y, barHeight, isSelected, overrideColor);
      } else {
        this.drawTaskBar(task, y, barHeight, isSelected, overrideColor);
      }
      this.drawConstraintMarkers(task, y);
      this.drawNotesIndicator(task, y);
      // Externe (cross-project) ghost-balken (fase 2.9, §5.5): op volle dekking (niet mee-dimmen),
      // ná de constraint-markers zodat de badge bovenop leesbaar blijft.
      if (dimmed || row.dimmed) this.ctx.globalAlpha = 1;
      this.drawExternalGhosts(task, y, barHeight);
      // Baseline-onderbalk (fase 2.6): op volle dekking, ná het eventuele dim-herstel.
      this.drawBaselineOverlay(task, y, barHeight);
    }
  }

  private drawTaskBar(task: Task, y: number, height: number, isSelected: boolean, overrideColor?: string): void {
    const ctx = this.ctx;
    const geo = this.barGeometry(task);
    const { x1, x2 } = geo;

    if (x2 < this.opts.taskTableWidth || x1 > this.opts.canvasWidth) return;

    const width = Math.max(x2 - x1, 4);
    const color = this.barColor(task, overrideColor);
    const progressColor = task.time.isCritical ? this.colors.criticalLight : this.colors.normalLight;

    // Fase 2.8b (§6.9): een uur-taak splitst in werkblok-segmenten (pauzes/nachten vallen als gaten
    // weg) volgens de instelling; dag-taken en niet-gesplitste uur-taken zijn één doorlopend segment.
    // Segmenten komen uit de op het kalender-object gememoizede banden-materialisatie (geen extra solve).
    let segs: { x1: number; x2: number }[] = [{ x1, x2 }];
    let split = false;
    if (geo.hourMode && this.shouldSplit(isSelected)) {
      const eng = this.engineFor(task);
      const intervals = eng ? eng.workIntervalsBetween(geo.start, geo.end) : [];
      if (intervals.length > 0) {
        segs = intervals.map(iv => ({ x1: this.dateToX(iv.start), x2: this.dateToX(iv.end) }));
        split = true;
      }
    }

    // Necking-connector door de gaten (dunne lijn op halve hoogte) — puur weergave.
    if (split && segs.length > 1) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = ctx.globalAlpha * 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(segs[0].x2, y + height / 2);
      ctx.lineTo(segs[segs.length - 1].x1, y + height / 2);
      ctx.stroke();
      ctx.restore();
    }

    const progressEnd = x1 + width * task.time.completion;
    for (const s of segs) {
      const sw = Math.max(s.x2 - s.x1, split ? 2 : 4);
      // Segment-achtergrond
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(s.x1, y, sw, height, 3);
      ctx.fill();
      // Voortgangsvulling: het deel van dit segment links van de globale voortgangsgrens.
      if (task.time.completion > 0 && progressEnd > s.x1) {
        const pw = Math.min(s.x1 + sw, progressEnd) - s.x1;
        if (pw > 0) {
          ctx.fillStyle = progressColor;
          ctx.beginPath();
          ctx.roundRect(s.x1, y, pw, height, 3);
          ctx.fill();
        }
      }
    }

    // High-contrast-thema (fase 2.9 §5.4, BINDEND): kleur alléén is onvoldoende, dus de drie
    // toestanden krijgen een texture-onderscheid — kritiek=massief (ongewijzigd), near-critical=
    // GEBLOKT (gememoized diagonaal-blok-patroon bovenop de amber), normaal=OMLIJND (rand). In
    // licht/donker blijft de amber-kleur het primaire signaal (geen texture).
    if (this.highContrast && !task.time.isCritical) {
      if (task.time.isNearCritical) {
        const hatch = getNearCriticalHatch(ctx);
        if (hatch) {
          ctx.fillStyle = hatch;
          for (const s of segs) {
            const sw = Math.max(s.x2 - s.x1, split ? 2 : 4);
            ctx.beginPath();
            ctx.roundRect(s.x1, y, sw, height, 3);
            ctx.fill();
          }
        }
      } else {
        ctx.strokeStyle = this.colors.text;
        ctx.lineWidth = 1.5;
        for (const s of segs) {
          const sw = Math.max(s.x2 - s.x1, split ? 2 : 4);
          ctx.beginPath();
          ctx.roundRect(s.x1 + 0.75, y + 0.75, sw - 1.5, height - 1.5, 3);
          ctx.stroke();
        }
      }
    }

    // Float indicator (ná de exclusieve balk-finish x2)
    if (task.time.totalFloat > 0 && !task.time.isCritical) {
      const floatWidth = task.time.totalFloat * this.opts.view.zoom;
      ctx.fillStyle = this.colors.float + 'E6'; // ~90% opacity — float band needs ≥3:1 vs light bg
      ctx.fillRect(x2, y + height / 4, floatWidth, height / 2);
    }

    // Selection highlight — omvat de volle balk-extent [x1,x2], ook bij gesplitste segmenten.
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

  /**
   * Fase 2.9 §5.3 — hammock/LOE-balk. P6-conventie: een dunne balk die tussen de start- en
   * finish-driver spant, met haakvormige eind-caps (brackets naar beneden) i.p.v. een gevulde
   * taakbalk. De duur is afgeleid (de solver schrijft early/late), dus geen voortgangsvulling.
   */
  private drawHammockBar(task: Task, y: number, height: number, isSelected: boolean, overrideColor?: string): void {
    const ctx = this.ctx;
    const { x1, x2 } = this.barGeometry(task);
    if (x2 < this.opts.taskTableWidth || x1 > this.opts.canvasWidth) return;

    const width = Math.max(x2 - x1, 4);
    const color = overrideColor ?? this.colors.hammock;
    const barY = y + height * 0.4;
    const barH = height * 0.2;
    const hook = height * 0.42;

    // Dunne middenbalk.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x1, barY, width, barH, 1);
    ctx.fill();

    // Haakvormige eind-caps (LOE-conventie): korte verticale stukjes omlaag aan beide uiteinden.
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1 + 1, barY);
    ctx.lineTo(x1 + 1, barY + hook);
    ctx.moveTo(x2 - 1, barY);
    ctx.lineTo(x2 - 1, barY + hook);
    ctx.stroke();

    if (isSelected) {
      ctx.strokeStyle = this.colors.selected;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x1 - 1, y - 1, width + 2, height + 2, 4);
      ctx.stroke();
    }

    if (width > 40) {
      ctx.fillStyle = this.colors.text;
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.beginPath();
      ctx.rect(x1 + 4, y, width - 8, height);
      ctx.clip();
      ctx.fillText(task.name, x1 + 6, y + height * 0.2);
      ctx.restore();
    }
  }

  private drawSummaryBar(task: Task, y: number, height: number, isSelected: boolean, overrideColor?: string): void {
    const ctx = this.ctx;
    // Samenvattingsbalken zijn ALTIJD doorlopend (§6.9), maar wel uur-bewust gepositioneerd
    // wanneer hun rollup-datums een tijdcomponent dragen.
    const { x1, x2 } = this.barGeometry(task);

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
    const startStr = task.time.earlyStart || task.time.scheduleStart;
    const hourMode = startStr.includes('T');
    const date = hourMode ? parseInstant(startStr) : parseDate(startStr);
    // Grens-model (fase 2.4): een startmijlpaal ankert op het dagBEGIN (linkerrand van de
    // dagcel), een eindmijlpaal op het dagEINDE (rechterrand); automatisch blijft
    // dag-gecentreerd zoals voorheen. Fase 2.8b: een UUR-mijlpaal draagt de exacte instant al,
    // dus die ankert op de instant zelf (anchor 0) zonder dag-cel-verschuiving.
    const zoom = this.opts.view.zoom;
    const anchor = hourMode ? 0 : task.milestoneKind === 'START' ? 0 : task.milestoneKind === 'FINISH' ? zoom : zoom / 2;
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
   * Fase 2.9 (§5.5) — externe (cross-project) ghost-balken. Per `ExternalLink` een grijze balk die op
   * het bevroren anker EINDIGT (predecessor: de externe taak eindigt vóór mijn start) resp. BEGINT
   * (successor). `sourceMissing` ⇒ gestippelde rand + een "verouderd"-badge (bron niet geladen; her-
   * importeer om te verversen). De ghost is géén echte rij — puur weergave naast de lokale balk;
   * afwezig/leeg `externalLinks` ⇒ deze methode is een no-op (byte-identiek). */
  private drawExternalGhosts(task: Task, y: number, height: number): void {
    const links = task.externalLinks;
    if (!links || links.length === 0) return;
    const ctx = this.ctx;
    const ghostW = Math.max(this.opts.view.zoom * 1.5, 28);
    const gh = height * 0.72;
    const gy = y + (height - gh) / 2;
    const chartLeft = this.opts.taskTableWidth;

    for (const link of links) {
      const anchorStr = link.anchorDate;
      if (!anchorStr) continue;
      const anchor = anchorStr.includes('T') ? parseInstant(anchorStr) : parseDate(anchorStr);
      if (isNaN(anchor.getTime())) continue;
      const ax = this.dateToX(anchor);
      const gx1 = link.direction === 'predecessor' ? ax - ghostW : ax;
      if (gx1 + ghostW < chartLeft || gx1 > this.opts.canvasWidth) continue;

      ctx.save();
      // Clip aan het chart-gebied (de ghost mag niet over de taaktabel lopen).
      ctx.beginPath();
      ctx.rect(chartLeft, this.opts.headerHeight, this.opts.canvasWidth - chartLeft, this.opts.canvasHeight - this.opts.headerHeight);
      ctx.clip();
      // Vulling — semi-transparant grijs.
      ctx.fillStyle = this.colors.ghost + '40'; // ~25%
      ctx.beginPath();
      ctx.roundRect(gx1, gy, ghostW, gh, 2);
      ctx.fill();
      // Rand — solid (bron geladen) of gestippeld (sourceMissing = verouderd).
      ctx.strokeStyle = this.colors.ghost;
      ctx.lineWidth = 1;
      if (link.sourceMissing) ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.roundRect(gx1 + 0.5, gy + 0.5, ghostW - 1, gh - 1, 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // "verouderd"-badge bij sourceMissing.
      if (link.sourceMissing) {
        const label = this.opts.externalStaleLabel ?? 'verouderd';
        ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(label).width + 6;
        const bx = gx1 + Math.max((ghostW - tw) / 2, 0);
        const by = gy - 13;
        ctx.fillStyle = this.colors.critical;
        ctx.beginPath();
        ctx.roundRect(bx, by, tw, 12, 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, bx + 3, by + 6.5);
        ctx.textAlign = 'start';
      }
      ctx.restore();
    }
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
        if (c.hard && (c.type === 'MSO' || c.type === 'MFO')) {
          // Harde Mandatory-pin (fase 2.9 §5.1, besluit B2): een pin-glyph (kopje + steel) i.p.v.
          // het soft-ruitje; bij logica-schending in de waarschuwkleur (violatedSet, incl.
          // hard-pin-schending) — het kopje leest als een pushpin die de balk vastzet.
          ctx.strokeStyle = ctx.fillStyle as string;
          ctx.lineWidth = 1.5;
          const hy = y - 7;
          ctx.beginPath();
          ctx.moveTo(px, hy + 2);
          ctx.lineTo(px, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(px, hy, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
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

  /**
   * Fase 2.10 (item 1) — klein, neutraal-gekleurd "aantekeningen aanwezig"-badge, rechtsboven de
   * balk (naast `drawConstraintMarkers`, hetzelfde badge-precedent). Alleen zichtbaar bij ≥1 OPEN
   * (`!done`) aantekening — een volledig afgevinkte lijst toont niets meer (bewust informatief,
   * geen waarschuwingskleur).
   */
  private drawNotesIndicator(task: Task, y: number): void {
    const notes = task.notes;
    if (!notes || !notes.some(n => !n.done)) return;
    const ctx = this.ctx;
    const chartLeft = this.opts.taskTableWidth;
    const end = parseDate(task.time.earlyFinish || task.time.scheduleFinish);
    const px = this.dateToX(end) + this.opts.view.zoom;
    if (px < chartLeft || px > this.opts.canvasWidth) return;
    ctx.fillStyle = this.colors.textSecondary;
    ctx.beginPath();
    ctx.arc(px - 6, y - 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
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
      // §7.1: taskId→rij-index-map is "eerste occurrence wint" — bij multi-band-duplicaten
      // verbindt de pijl één keer, latere occurrences krijgen geen pijlen.
      const predIdx = this.rowIndexByTask.get(seq.predecessorId) ?? -1;
      const succIdx = this.rowIndexByTask.get(seq.successorId) ?? -1;
      if (predIdx < 0 || succIdx < 0) continue;

      const predRow = this.rows[predIdx];
      const succRow = this.rows[succIdx];
      if (predRow?.kind !== 'task' || succRow?.kind !== 'task') continue;
      const pred = predRow.task;
      const succ = succRow.task;

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
    // Split view (§10.2): het secundaire pane heeft taskTableWidth 0 — dan géén tabel
    // tekenen (anders lekken headerteksten/WBS-codes over de balken heen).
    if (taskTableWidth <= 0) return;
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
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const y = this.rowToY(i);
      if (y + rowHeight < headerHeight || y > canvasHeight) continue;

      if (row.kind === 'group') {
        // Bandkop-rij (§4.4): getinte rij + collapse-driehoek + vet label met count.
        ctx.fillStyle = this.colors.summary + '1A';
        ctx.fillRect(0, y, taskTableWidth, rowHeight);
        const midY = y + rowHeight / 2;
        const triX = 10 + row.levelIndex * 14;
        ctx.fillStyle = this.colors.textSecondary;
        ctx.beginPath();
        if (row.collapsed) {
          ctx.moveTo(triX, midY - 4);
          ctx.lineTo(triX, midY + 4);
          ctx.lineTo(triX + 6, midY);
        } else {
          ctx.moveTo(triX - 1, midY - 3);
          ctx.lineTo(triX + 7, midY - 3);
          ctx.lineTo(triX + 3, midY + 3);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = this.colors.text;
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y, taskTableWidth - 4, rowHeight);
        ctx.clip();
        ctx.fillText(`${row.label} (${row.count})`, triX + 12, midY);
        ctx.restore();
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y + rowHeight);
        ctx.lineTo(taskTableWidth, y + rowHeight);
        ctx.stroke();
        continue;
      }

      const task = row.task;
      const depth = row.depth;
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

      // Gedimde rij (filter-ouderketen, §4.2): tekst op verlaagde dekking.
      if (row.dimmed) ctx.globalAlpha = GanttRenderer.DIM_ALPHA;

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
      const durText = this.durationText(task);
      ctx.fillText(durText, taskTableWidth - 8, textY);
      ctx.textAlign = 'left';
      if (row.dimmed) ctx.globalAlpha = 1;
    }

    // Right border of table
    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(taskTableWidth, 0);
    ctx.lineTo(taskTableWidth, canvasHeight);
    ctx.stroke();
  }

  /** Hit test (§4.5): welke gedeelde ViewRow ligt op deze canvas-Y? */
  getRowAtY(canvasY: number): ViewRow | null {
    return this.rows[this.getRowIndex(canvasY)] ?? null;
  }

  /** Hit test: which task row is at the given canvas Y? Bandrijen geven null (§4.5). */
  getTaskAtY(canvasY: number): Task | null {
    const row = this.getRowAtY(canvasY);
    return row?.kind === 'task' ? row.task : null;
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
    const row = this.getRowAtY(canvasY);
    if (row?.kind !== 'task' || row.task.childIds.length === 0) return null;
    const indent = 55 + row.depth * 16;
    // Triangle area is roughly indent-12 to indent
    if (canvasX >= indent - 14 && canvasX <= indent + 2) {
      return row.task;
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

  /** Hit test (fase 2.10 golf 4, box-selection): welke taak-ids liggen met hun rij-band verticaal
   *  in [y1,y2] (canvas-coördinaten, willekeurige volgorde)? Bandrijen (`kind:'group'`) doen niet
   *  mee. Zelfde rij-index-wiskunde als getRowAtY, dus consistent met alle andere hit-tests. */
  getTaskIdsInYRange(y1: number, y2: number): string[] {
    const lo = Math.max(0, this.getRowIndex(Math.min(y1, y2)));
    const hi = Math.min(this.rows.length - 1, this.getRowIndex(Math.max(y1, y2)));
    const ids: string[] = [];
    for (let i = lo; i <= hi; i++) {
      const row = this.rows[i];
      if (row?.kind === 'task') ids.push(row.task.id);
    }
    return ids;
  }

  /** Hit test: get task bar bounds for a task at row index (for drag & drop) */
  getTaskBarBounds(canvasX: number, canvasY: number): { task: Task; edge: 'left' | 'right' | 'body' } | null {
    if (canvasX < this.opts.taskTableWidth) return null;
    const task = this.getTaskAtY(canvasY);
    if (!task || task.childIds.length > 0 || task.isMilestone) return null;

    // Uur-bewuste balk-uiteinden, zodat de resize-grepen op een sub-dag-balk kloppen (§6.1/§6.3).
    const { x1, x2 } = this.barGeometry(task);
    const edgeZone = 6; // pixels for edge detection

    if (canvasX >= x1 - edgeZone && canvasX <= x2 + edgeZone) {
      if (canvasX <= x1 + edgeZone) return { task, edge: 'left' };
      if (canvasX >= x2 - edgeZone) return { task, edge: 'right' };
      return { task, edge: 'body' };
    }
    return null;
  }
}
