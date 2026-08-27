import { Task } from '@/types/task';
import type { BaselineOverlay } from '@/types/baseline';
import { Sequence } from '@/types/sequence';
import type { ViewState, BarSplitMode, DurationDisplay } from '@/types/view';
import { parseDate, parseInstant, addCalendarDays, diffCalendarDays, isoDayOfWeek, getWeekNumberFor } from '@/utils/dateUtils';
import { holidayEndDate, WorkCalendar } from '@/types/calendar';
import { isHourCalendar } from '@/services/subdayIo';
import { effHoursPerDay, formatTaskDurationDisplay, taskDurationMinutes } from '@/utils/taskDuration';
import { formatDuration, DEFAULT_DURATION_SUFFIXES, type DurationSuffixes } from '@/utils/durationFormat';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { firstRowIndexByTask, type ViewRow } from '@/engine/view/visibleRows';
// #21: resource-accent — dezelfde pure toewijzings-module als de printlaag (één definitie van
// "welke resources kleuren welke taak"), geen tweede implementatie in de renderer.
import { assignmentsFor, computeBarColors, type BarPalette } from '@/services/print/barColors';
import type { BarColorContext } from '@/services/print/barColorCategories';
import type { BarColorSelection } from '@/types/barColor';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import { ensureThemeVisible } from '@/engine/renderer/resourcePalette';
import { TimelineTier, TierConfig, TIER_CONFIG, pickTiers, nextTickBoundary, snapToTickStart } from './timelineTiers';
import { readGanttPalette, type GanttPalette } from './themePalette';
import { xToDayOffset, type GanttAxis } from './timeAxis';
import { resolveGanttAxis, isCompressedEffective } from './workdayAxis';
import { computeSplitSegments } from './splitBarGeometry';

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
  /** #21: dun streepje resourcekleur ónder elke bladbalk (gesegmenteerd bij meerdere resources).
   *  Supplement, geen vervanging: de balkvulling blijft kritiek-pad-gekleurd. */
  showResourceAccent?: boolean;                          // UI-toggle
  /** Donker schermthema: het resource-accent verlicht te donkere kleuren naar een minimale
   *  zichtbaarheid (#21 — gemeten: slate-achtige tinten vielen weg op de donkere werkruimte).
   *  De EXPORT past dit NIET toe: papier is licht, daar staat de exacte kleur. */
  darkTheme?: boolean;
  /** Eén app-globale kleurkeuze voor zowel scherm als rapport. Ontbreekt = kritiek-padbeeld. */
  barColorSelection?: BarColorSelection;
  /** Projectcontext voor exact dezelfde categorievelden als onder Group. */
  activityCodeTypes?: ActivityCodeType[];
  customFieldDefs?: CustomFieldDef[];
  taskTypeLabels?: Record<string, string>;
  barColorNoneLabel?: string;
  /** Voor het accent: resources + toewijzingen (de renderer leeft buiten de store). */
  resources?: import('@/types/resource').Resource[];
  assignments?: import('@/types/resource').ResourceAssignment[];
  /** Overlay-datums uit de actieve baseline, keyed op Task.id (alleen leaf-taken). */
  baselineOverlay?: BaselineOverlay;
  canvasWidth: number;
  canvasHeight: number;
  taskTableWidth: number;
  rowHeight: number;
  headerHeight: number;
  localizedMonths?: string[];
  /** issue #21 punt 2 (vervolg: dagnamen): 7 weekdag-afkortingen, geïndexeerd op
   *  d.getUTCDay() (0=zondag … 6=zaterdag). Alleen gebruikt in de 'day'-tier bij zoom≥40;
   *  afwezig ⇒ de dag-tier toont alleen het dagnummer (backwards-compat). */
  localizedWeekdays?: string[];
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
  /** Issue #51 — de taak die op DIT moment aan een RAND gerekt wordt, plus welke rand. Aanwezig ⇒
   *  de renderer zet een compact duur-pilletje tegen die balkrand (`drawDragDurationBadge`).
   *  Afwezig ⇒ er wordt niets extra's getekend (byte-identiek aan vóór #51). Een `body`-sleep
   *  (verplaatsen) hoort hier BEWUST niet in: de duur verandert dan niet, dus een meelopend
   *  duurcijfer zou suggereren dat het gebaar hem beïnvloedt. */
  durationDrag?: { taskId: string; edge: 'left' | 'right' };
  /** Fase 2.9 (§5.4): high-contrast-thema actief. BINDEND user-besluit — in HC is kleur alléén
   *  onvoldoende, dus near-critical-balken krijgen een geblokt/gearceerd vulpatroon (kritiek=massief,
   *  near-critical=geblokt, normaal=omlijnd). Afwezig/false ⇒ licht/donker (amber-kleur als signaal). */
  highContrast?: boolean;
  /** Geïnjecteerd themapalet (audit C5/P17). Afwezig ⇒ de renderer leest het zelf via
   *  `readGanttPalette()` (identiek lees-moment/-resultaat als vroeger). Meegeven maakt de renderer
   *  puur/headless-testbaar (geen DOM-afhankelijkheid). */
  palette?: GanttPalette;
  /** Issue #21 punt 5 (fase 2): «alleen werkbare dagen tonen». Afwezig/false ⇒ de bestaande
   *  kalender-as (byte-identiek). Zie `axis` hieronder voor de gedeelde-instantie-variant. */
  compressNonWorkdays?: boolean;
  /** Issue #21 punt 5 (fase 2, ontwerp §10.1): een VAN BUITEN meegegeven `GanttAxis` — gebruikt
   *  door `GanttCanvas` om de PRIMAIRE Gantt-pane en de `HistogramRenderer` LETTERLIJK dezelfde
   *  as-instantie te geven (anders schuiven de resource-staafjes onder de verkeerde kolommen).
   *  Afwezig ⇒ de renderer bouwt zelf een as uit `calendar`+`compressNonWorkdays`+`view`
   *  (bv. de secundaire split-view-pane, of headless tests die geen axis meegeven). */
  axis?: GanttAxis;
  /** Issue #25 punt 4: de CSS font-stack van de gekozen interface-lettertypefamilie
   *  (`resolveUIFontStack(ui.uiFontFamily)`). Een canvas leest géén CSS-variabelen, dus de stack
   *  moet als string mee — zonder dit blijft de Gantt (taaknamen + tijdschaal, het grootste
   *  leesoppervlak van de app) in het oude hardgecodeerde lettertype staan terwijl de hele chrome
   *  eromheen wél omschakelt. Afwezig ⇒ `FALLBACK_FONT_STACK`, exact het oude gedrag. */
  fontFamily?: string;
  /** Issue #60: de Tekengrootte-instelling (`ui.uiFontScale`) als factor (1 = 100%). Zelfde reden
   *  als `fontFamily`: een canvas leest geen CSS-variabelen, dus de schaal moet expliciet mee.
   *  De aanroeper (GanttCanvas) schaalt `rowHeight`/`headerHeight` met DEZELFDE factor, zodat de
   *  grotere tekst ook de verticale ruimte krijgt (balkhoogtes/headerbanden zijn daar weer fracties
   *  van). Afwezig ⇒ 1 — headless tests en print-/exportpaden renderen byte-identiek als voorheen. */
  fontScale?: number;
}

/** De historische, hardgecodeerde stack van deze renderer. Blijft de fallback zodra een aanroeper
 *  `fontFamily` niet meegeeft (headless tests, print-/exportpaden), zodat die byte-identiek blijven
 *  renderen als vóór issue #25 punt 4. */
const FALLBACK_FONT_STACK = '-apple-system, BlinkMacSystemFont, sans-serif';

/**
 * Issue #41 — obstakel-index voor de relatie-routing: per ZICHTBARE rij het x-interval dat de balk
 * van die rij bedekt (incl. marge). Alleen zichtbare rijen: een balk buiten beeld kan niets
 * verbergen, en zo blijft de index O(zichtbare rijen) i.p.v. O(taken) — ook bij duizenden taken.
 *
 * `x1[k] = +Infinity` / `x2[k] = -Infinity` betekent "geen obstakel op deze rij" (bandkoprij), zodat
 * de vrij-test één uniforme vergelijking blijft zonder null-checks.
 */
interface RowObstacles {
  /** Rij-index van element 0. */
  r0: number;
  /** Laatste geïndexeerde rij-index (inclusief); `r1 < r0` ⇒ lege index. */
  r1: number;
  x1: Float64Array;
  x2: Float64Array;
}

const EMPTY_SPANS = new Float64Array(0);

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

export class GanttRenderer {
  private ctx: CanvasRenderingContext2D;
  private opts: GanttRenderOptions;
  private colors: GanttPalette;

  // Computed
  private viewStart: Date;
  // Rijmodel (fase 2.7, §4): de meegegeven gedeelde `viewRows`. Een rij is een taak-rij
  // (met depth/dimmed) of een bandkop-rij (`kind:'group'`). Alle hit-tests lopen via
  // getTaskAtY/getRowAtY en geven op een bandrij null/de bandrij terug, zodat
  // canvas-interacties vanzelf degraderen.
  private rows: ViewRow[];
  private rowIndexByTask: Map<string, number>; // task id -> EERSTE rij-index (§7.1, pijlen)
  /** Engine op de PROJECTkalender — enige bron voor de niet-werkdag-arcering van de grid
   *  (weekpatroon + feestdagen, B2): geen hardcoded za/zo en geen eigen holiday-expansie meer. */
  private projectEngine: CalendarEngine;
  private violatedSet: Set<string>;
  private missedDeadlineSet: Set<string>;
  private highContrast: boolean;
  /** Issue #21 punt 5 (fase 2): de gekozen tijd-as (kalender- of werkdagen-, §2.1). Fresh per
   *  render — zie `workdayAxis.ts` §2.2/§2.5 (geen cross-render cache). */
  private axis: GanttAxis;
  /** Is de as DAADWERKELIJK gecomprimeerd (vlag AAN én de kalender heeft werkdagen, §9.4-guard)?
   *  Stuurt de grid-/arceringkeuze in `drawGridBackground` (§4.2: geen niet-werkdagen ⇒ geen
   *  arcering, geen dubbele rasterlijnen op de samengevallen naad-x). */
  private compressed: boolean;
  private barColorContext: BarColorContext;

  /** Alpha voor gedimde rijen (filter-ouderketen, §4.2). */
  private static readonly DIM_ALPHA = 0.45;

  /** Fase 2.8b: per-kalender-id gecachete `CalendarEngine` voor de balk-opsplitsing (§6.9). De
   *  band-materialisatie zelf is gememoized op het kalender-OBJECT (WeakMap), dus deze cache
   *  voorkomt alleen herhaalde engine-constructie binnen één render. */
  private engineCache = new Map<string, CalendarEngine>();

  constructor(ctx: CanvasRenderingContext2D, opts: GanttRenderOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.colors = opts.palette ?? readGanttPalette();

    this.viewStart = parseDate(opts.view.viewStartDate);
    this.rows = opts.rows;
    // "Eerste index wint" (§7.1): bij multi-band-duplicaten verbinden pijlen de eerste occurrence.
    this.rowIndexByTask = firstRowIndexByTask(opts.rows);
    // Eén engine per render voor de grid-arcering; ook in de engineCache gezet zodat een
    // uur-modus-projectkalender in `engineFor` dezelfde instantie hergebruikt (geen dubbele
    // holiday-expansie binnen één render).
    this.projectEngine = new CalendarEngine(opts.calendar);
    this.engineCache.set(opts.calendar.id, this.projectEngine);
    this.violatedSet = new Set(opts.violatedConstraintTaskIds ?? []);
    this.missedDeadlineSet = new Set(opts.missedDeadlineTaskIds ?? []);
    this.highContrast = !!opts.highContrast;
    this.barColorContext = {
      activityCodeTypes: opts.activityCodeTypes ?? [],
      customFieldDefs: opts.customFieldDefs ?? [],
      resources: opts.resources ?? [],
      assignments: opts.assignments ?? [],
      taskTypeLabels: opts.taskTypeLabels,
      noneLabel: opts.barColorNoneLabel ?? '(geen)',
    };
    // Issue #21 punt 5 (fase 2): `opts.axis` (indien meegegeven door GanttCanvas — de gedeelde
    // instantie met HistogramRenderer, §10.1) wint; anders bouwt de renderer zelf een as uit de
    // eigen opts (secundaire split-view-pane, headless tests zonder axis-prop). Toggle
    // UIT/afwezig ⇒ `resolveGanttAxis` levert `buildCalendarAxis(...)` = byte-identiek aan vóór
    // fase 2 (het bestaande `dateToX`-pad hieronder).
    this.axis = opts.axis ?? resolveGanttAxis({
      calendar: this.projectEngine,
      compressNonWorkdays: !!opts.compressNonWorkdays,
      origin: this.viewStart,
      taskTableWidth: opts.taskTableWidth,
      zoom: opts.view.zoom,
      scrollX: opts.view.scrollX,
    });
    this.compressed = isCompressedEffective(this.projectEngine, !!opts.compressNonWorkdays);
  }

  /** Bouwt een `ctx.font`-string in de gekozen interface-lettertypefamilie (issue #25 punt 4) én
   *  -grootte (issue #60): `fontScale` (= `ui.uiFontScale`/100) schaalt elke fontgrootte mee.
   *  Enige plek waar deze renderer een font-stack samenstelt — vroeger stonden er 17 letterlijke
   *  `ctx.font`-strings verspreid door het bestand, die per definitie uit de pas liepen zodra de
   *  familie instelbaar werd.
   *
   *  De GEOMETRIE schaalt bij de aanroeper mee: GanttCanvas leidt `rowHeight`/`headerHeight` van
   *  dezelfde factor af, zodat grotere tekst niet clipt maar ruimte krijgt. Schaal hier dus nooit
   *  de grootte zonder dat de aanroeper de rijhoogte meegeeft — en andersom. Afronden houdt de
   *  tekst scherp (geen sub-pixel-fontgroottes). */
  private font(sizePx: number, bold = false): string {
    const size = Math.round(sizePx * (this.opts.fontScale ?? 1));
    return `${bold ? 'bold ' : ''}${size}px ${this.opts.fontFamily ?? FALLBACK_FONT_STACK}`;
  }

  /** Basis-balkkleur (fase 2.9 §5.4): kritiek-rood ≻ near-critical-amber ≻ float-path-tint ≻
   *  normaal-blauw. `overrideColor` (trace-tint) wint altijd. Near-critical en de
   *  float-path-tint zijn analyse-overlays die alleen bestaan wanneer hun optie aanstaat ⇒ default
   *  byte-identiek (`isNearCritical`/`floatPath` afwezig). */
  private barColor(task: Task, overrideColor?: string): string {
    if (overrideColor) return overrideColor;
    if (task.time.isCritical) return this.colors.critical;
    if (task.time.isNearCritical) return this.colors.nearCritical;
    const fp = task.time.floatPath;
    if (fp !== undefined && fp > 1) {
      const tints = this.colors.floatPathTints;
      return tints[(fp - 2) % tints.length];
    }
    return this.colors.normal;
  }

  /** Duurkolom-tekst (§6.5): de blijvende taakeenheid blijft óók zichtbaar wanneer de globale
   * urenplanningsschakelaar uit staat; die schakelaar mag geïmporteerde urendata niet herinterpreteren. */
  private durationText(task: Task): string {
    // M3 (Opus-review T15-iteratie-2): `isZeroDurationMilestone` i.p.v. de kale vlag — een
    // mijlpaal-met-duur (T15) toont haar EIGEN duur, niet "0d" (zelfde discriminator als de solver).
    if (isZeroDurationMilestone(task)) return '0d';
    const cal = this.opts.effectiveCalById?.get(task.id) ?? this.opts.calendar;
    return formatTaskDurationDisplay(
      task,
      cal,
      this.opts.durationDisplay ?? 'auto',
      this.opts.enableHourPlanning ?? false,
      this.opts.durationSuffixes,
    );
  }

  /** Kapt tekst af met een ellipsis zodra hij niet in `maxWidth` past (issue #38 punt 5): de
   *  taaktabel-kopteksten (WBS/Taaknaam/Duur) mogen nooit buiten hun kolom in de Gantt-zone
   *  lopen — vertalingen zoals DE "Dauer"/FR "Durée" kunnen breder zijn dan de gegokte offset
   *  die hier voorheen stond. Meet met het al ingestelde `ctx.font`, dus vóór het aanroepen
   *  moet de juiste font/grootte al gezet zijn. Zelfde aanpak als HistogramRenderer.truncate. */
  private truncate(text: string, maxWidth: number): string {
    const ctx = this.ctx;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
  }

  /** Convert a date (with optional sub-day precision) to X position on canvas.
   *  Issue #21 punt 5 (fase 2): het ENE as-chokepoint (ontwerp §2.1/§10) — nu `this.axis.dateToX`
   *  i.p.v. rechtstreeks `timeAxis.dateToX`. Toggle uit ⇒ `this.axis` ís de kalender-as (dunne
   *  wrapper om exact dezelfde `axisDateToX`-aanroep, zie `buildCalendarAxis`) ⇒ byte-identiek.
   *  Alle 30+ bestaande call-sites (grid, balken, pijlen, mijlpalen, header, …) werken ongewijzigd
   *  door dit ene punt. */
  dateToX(date: Date): number {
    return this.axis.dateToX(date);
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
    // Guard (TODO 2026-07-28): een taak zonder énige datum (noch CPM- noch schedule-, bv. uit een
    // onvolledige import) crashte hier per frame op `undefined.includes(...)` — de hele Gantt bleef
    // zwart. Terugval: de ontbrekende kant leent van de andere kant; ontbreken beide, dan één
    // dag-cel op de viewstart (zichtbaar, maar zonder datums geen sleep/resize — getTaskBarBounds
    // weigert zulke taken).
    const rawStart = task.time.earlyStart || task.time.scheduleStart || '';
    const rawEnd = task.time.earlyFinish || task.time.scheduleFinish || '';
    const startStr = rawStart || rawEnd;
    const endStr = rawEnd || rawStart;
    if (!startStr) {
      const d = this.viewStart;
      const x = this.dateToX(d);
      return { x1: x, x2: x + this.opts.view.zoom, hourMode: false, start: d, end: d };
    }
    const hourMode = startStr.includes('T') || endStr.includes('T');
    const start = hourMode ? parseInstant(startStr) : parseDate(startStr);
    const end = hourMode ? parseInstant(endStr) : parseDate(endStr);
    const x1 = this.dateToX(start);
    const x2 = hourMode ? this.dateToX(end) : this.dateToX(end) + this.opts.view.zoom;
    return { x1, x2, hourMode, start, end };
  }

  /** De effectieve `CalendarEngine` voor een taak, ONGEACHT dag-/uur-modus (Z15). Gedeelde cache
   *  met `engineFor` (hieronder), dat bewust NULL teruggeeft in dag-modus omdat de kalender-
   *  necking (`workIntervalsBetween`) daar toch niets oplevert. `Task.splitGaps` heeft echter
   *  ALTIJD een engine nodig — ook een dag-modus-taak (`workTime` ontbreekt) — om de gat-offsets
   *  naar schermcoördinaten te wandelen (`computeSplitSegments`, `splitBarGeometry.ts`). Een
   *  dag-modus-`CalendarEngine` bouwen is goedkoop (de uur-modus-band-uitrol in de constructor
   *  slaat over, zie `CalendarEngine`'s `mode`-branch), dus geen aparte null-guard nodig hier. */
  private engineForAnyMode(task: Task): CalendarEngine {
    const cal = this.opts.effectiveCalById?.get(task.id) ?? this.opts.calendar;
    let eng = this.engineCache.get(cal.id);
    if (!eng) {
      eng = new CalendarEngine(cal);
      this.engineCache.set(cal.id, eng);
    }
    return eng;
  }

  /** De effectieve `CalendarEngine` voor een taak (uur-modus), of null als de taak op een
   *  dag-kalender staat / geen kalendermap is meegegeven — dan wordt er niet opgesplitst. */
  private engineFor(task: Task): CalendarEngine | null {
    const cal = this.opts.effectiveCalById?.get(task.id) ?? this.opts.calendar;
    if (!isHourCalendar(cal)) return null;
    return this.engineForAnyMode(task);
  }

  /** Of een uur-taakbalk in werkblok-segmenten wordt getekend (§6.9): 'always' ⇒ altijd,
   *  'selection' ⇒ alleen als de taak geselecteerd is, 'never' ⇒ nooit. Z15: dit stuurt
   *  UITSLUITEND de kalender-necking (uur-modus, geen echte splits) — een taak met `Task.splitGaps`
   *  (een ECHTE MS Project-split) raadpleegt deze methode nooit, zie de O5-uitleg bij `drawTaskBar`. */
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
    this.drawDependencyArrows();
    this.drawTaskBars();
    // Ná de taakbalken (niet direct na de grid): een balk die een feestdagblok overspant zou het
    // naamlabel anders overschilderen — juist het scenario dat §6.2 zichtbaar moet maken (2.5-QA:
    // "opgerekte balk van vier weken" zonder duiding).
    this.drawHolidayLabels();
    // Issue #51: het duur-pilletje van een lopende rand-sleep. Ná alle chart-lagen (het moet
    // leesbaar bovenop de balk staan), maar VÓÓR header en taaktabel — die overschilderen hun eigen
    // zone, zodat een pilletje dat tegen de linker chart-rand aan zit nooit óver de takenlijst valt.
    this.drawDragDurationBadge();
    this.drawTimelineHeader();
    this.drawTaskTable();
    // Referentielijnen horen boven alle lagen te liggen. De voortgangslijn is alleen actief
    // wanneer de losse statusdatumlijn terugtreedt, dus deze aanroepen blijven exclusief.
    this.drawProgressLine();
    this.drawStatusDateLine();
  }

  private drawGridBackground(): void {
    const { canvasWidth, canvasHeight, headerHeight, view } = this.opts;
    const ctx = this.ctx;

    // Calculate visible date range
    const visibleDays = Math.ceil(canvasWidth / view.zoom) + 2;
    // startOffset = eerste zichtbare dag-index t.o.v. `viewStart`. Gelijk aan de inverse van
    // `this.dateToX` op x=`taskTableWidth` (het linker chart-randje): `xToDayOffset(taskTableWidth,
    // taskTableWidth, zoom, scrollX)` = `(taskTableWidth-taskTableWidth+scrollX)/zoom` =
    // `scrollX/zoom` — algebraïsch en drijvende-komma-identiek aan de vorige inline `scrollX/zoom`
    // (issue #21 punt 5, fase 0-consolidatie; geen Date-round-trip, dus geen ms-afronding erbij).
    const startOffset = Math.floor(xToDayOffset(this.opts.taskTableWidth, this.opts.taskTableWidth, view.zoom, view.scrollX));

    // Issue #21 punt 5 (fase 2, ontwerp §4.2/§10): bij een DAADWERKELIJK gecomprimeerde as bestaan
    // niet-werkdagen niet meer op het raster — itereren per kalenderdag zou meerdere niet-werkdagen
    // (za+zo+feestdag) op DEZELFDE naad-x laten samenvallen (kleef-rechts, §2.4), met dubbele
    // rasterlijnen en een arcering die per ongeluk over de eerstvolgende werkdag-kolom zou vallen.
    // Daarom hieronder een apart, index-gebaseerd pad dat uitsluitend over de as-eigen `dateAtIndex`
    // loopt (elke stap = één ECHTE werkdag); de niet-gecomprimeerde tak hieronder blijft ONGEWIJZIGD
    // (byte-identiek aan vóór fase 2 — geen enkele regel in die tak is aangeraakt).
    if (this.compressed) {
      // `axisStartIndex` = de as-index op x=taskTableWidth: `axis.dayIndexOf(viewStart)` (het
      // as-eigen nulpunt, kan >0 zijn — de as telt vanaf de epoch, zie workdayAxis.ts) plus
      // `scrollX/zoom` (dezelfde herleiding als `startOffset` hierboven, maar dan in as-eenheden
      // i.p.v. kalenderdagen-vanaf-viewStart).
      const axisStartIndex = Math.floor(this.axis.dayIndexOf(this.viewStart) + view.scrollX / view.zoom);
      for (let i = -1; i < visibleDays; i++) {
        const date = this.axis.dateAtIndex(axisStartIndex + i);
        const x = this.axis.dateToX(date);
        const dayOfWeek = isoDayOfWeek(date);

        // Geen arcering: `dateAtIndex` op de werkdagen-as geeft ALTIJD een echte werkdag terug
        // (§2.2: de prefix-som is per definitie een rij werkdag-indices) — er is niets om te
        // arceren (§4.2: "de arcering vervalt volledig").
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = dayOfWeek === (this.opts.weekStartDay === 'sunday' ? 7 : 1) ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(x, headerHeight);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
    } else {
      for (let i = -1; i < visibleDays; i++) {
        const date = addCalendarDays(this.viewStart, startOffset + i);
        const x = this.dateToX(date);
        const dayOfWeek = isoDayOfWeek(date);

        // Niet-werkdag-arcering (B2): de PROJECTKALENDER is de enige waarheid — weekpatroon +
        // feestdagen via `CalendarEngine.isWorkDay`, geen hardcoded za/zo. Bij een afwijkende
        // werkweek (bv. za werkdag) volgt de arcering nu de kalender; ma–vr blijft visueel identiek.
        if (!this.projectEngine.isWorkDay(date)) {
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
    // Issue #21 punt 5 (header-bugfix, vervolg fase 3 van werkdagen-as-ontwerp.md §4.3): onder
    // compressie bestaan feestdagen niet meer op de as (0 kolommen) — `widthPx = days*zoom`
    // gebruikt hieronder nog de OUDE, ongecomprimeerde dagbreedte, wat op de gecomprimeerde
    // `dateToX(start)`-positie een breed blok zou overtekenen dat niet bij de echte (0-brede)
    // naad past. §4.3 wijst dit zelf aan als toekomstige "naad-marker"-vervanging (latere fase,
    // hier niet gebouwd) — tot dan: simpelweg niets tekenen i.p.v. het 0-breedte-artefact.
    if (this.compressed) return;

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
      const end = parseDate(holidayEndDate(h));
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
        // Issue #21 (holiday-labels-clip-fix): ware grootte tekenen en CLIPPEN op het zichtbare
        // gebied i.p.v. samenknijpen via een fillText-maxWidth — een lang woord valt dan gewoon
        // gedeeltelijk buiten beeld i.p.v. onleesbaar verdrukt te worden.
        ctx.font = this.font(11, true);
        ctx.textBaseline = 'top';
        ctx.save();
        ctx.beginPath();
        ctx.rect(clipX1, headerHeight, visibleWidth, Math.max(0, canvasHeight - headerHeight));
        ctx.clip();
        // User-feedback issue #21: centreren + clippen sneed een te lange naam aan TWEE kanten af
        // ("stverlet funder" — het begin ontbrak, leest als wartaal). Past de naam in het zichtbare
        // deel: gecentreerd zoals voorheen. Past hij niet: links uitlijnen op de échte blokstart
        // (x1), zodat altijd het BEGIN van het woord zichtbaar is en alleen het einde wegvalt.
        if (ctx.measureText(h.name).width <= visibleWidth - 8) {
          ctx.textAlign = 'center';
          ctx.fillText(h.name, (clipX1 + clipX2) / 2, headerHeight + 6);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(h.name, x1 + 4, headerHeight + 6);
        }
        ctx.restore();
      } else {
        // Smal blok: verticale tekst langs de linkerrand. Zelfde clip-in-plaats-van-knijpen-aanpak,
        // maar dan in wereldcoördinaten VÓÓR de translate/rotate (clip-pad wordt vastgelegd in de
        // transform die op dat moment geldt), zodat de geroteerde tekst ook gewoon aan de onderkant
        // afgesneden wordt i.p.v. samengeperst.
        ctx.font = this.font(10);
        ctx.save();
        ctx.beginPath();
        ctx.rect(clipX1, headerHeight, visibleWidth, Math.max(0, canvasHeight - headerHeight));
        ctx.clip();
        ctx.save();
        ctx.translate(clipX1 + zoom / 2, headerHeight + 8);
        ctx.rotate(Math.PI / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(h.name, 0, 0);
        ctx.restore();
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
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]); // zelfde patroon als de vandaag-/statusdatumlijn (user-wens: één beeld)
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
      // Alleen echte leaf-taken (geen samenvatting/mijlpaal/band) stulpen uit. M3 (Opus-review
      // T15-iteratie-2): `isZeroDurationMilestone` — een mijlpaal-met-duur tekent als gewone balk
      // (regel ~940 hierboven) en krijgt dus ook haar eigen statusdatum-uitstulping.
      if (task && !isZeroDurationMilestone(task) && task.childIds.length === 0) {
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
  private drawBaselineOverlay(task: Task, y: number, height: number, resourceAccentHeight = 0): void {
    const overlay = this.opts.baselineOverlay;
    if (!overlay || this.opts.showBaselineOverlay === false) return;
    const entry = overlay.get(task.id);
    if (!entry) return;

    const ctx = this.ctx;
    const zoom = this.opts.view.zoom;
    const preferredBaseHeight = Math.max(2, height * 0.28);
    const baseY = y + height + 1 + resourceAccentHeight;
    // Resource-accent en baseline delen de vrije ruimte onder de hoofdbalk. Houd de baseline bij
    // de combinatie binnen dezelfde rij; bij de kleinste ondersteunde tekengrootte resteert nog
    // ruim 2 px en blijft de baseline dus zichtbaar zonder het accent te bedekken.
    const rowBottom = y + height + (this.opts.rowHeight - height) / 2;
    const baseHeight = resourceAccentHeight > 0
      ? Math.min(preferredBaseHeight, Math.max(2, rowBottom - baseY))
      : preferredBaseHeight;
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
    // De kopstrook volgt dezelfde tierkeuze als de uurinteractie. De oude harde `false` maakte
    // de instelling “kwartieren tonen bij ver inzoomen” alleen voor snapping effectief: uren en
    // kwartieren werden in de schermtijdlijn nooit getekend.
    const { major, mid, minor } = pickTiers(view.zoom, enableQH, this.opts.enableHourPlanning ?? false);

    // Visible date range. Issue #21 punt 5 (header-bugfix, vervolg fase 3 van
    // werkdagen-as-ontwerp.md §4.1/§10): via de as-index (`this.axis.dayIndexOf`/`dateAtIndex`)
    // i.p.v. de kalenderdag-aanname `scrollX/zoom` — die laatste gaat er impliciet van uit dat
    // 1 kalenderdag = 1 zoom-kolom, wat alleen klopt op de ongecomprimeerde as. Onder compressie
    // "kost" elke overgeslagen niet-werkdag 0 px maar telde in de oude formule als 1 kalenderdag
    // mee, dus het berekende bereik liep steeds verder ACHTER op het werkelijk zichtbare venster
    // naarmate scrollX groeide — bij genoeg scroll viel de tick-loop (`drawTierLabels`) stil
    // vóórdat hij het canvas had bereikt: een (deels of geheel) LEGE datumregel, precies het
    // gerapporteerde "zwarte" headergedeelte (bevestigd headless: bij scrollX=3000, zoom=26 gaf
    // de oude formule 0 dag-labels i.p.v. de volle breedte — zie `tests/planning/
    // check-header-compress.ts` voor de blijvende regressiebewaking).
    // Byte-identiek op de niet-gecomprimeerde as: `CalendarAxis.dayIndexOf(viewStart)`===0, dus
    // dit reduceert algebraïsch tot exact de oude `addCalendarDays(...)`-formule.
    const axisViewStartIdx = this.axis.dayIndexOf(this.viewStart);
    const startDate = this.axis.dateAtIndex(axisViewStartIdx + Math.floor(view.scrollX / view.zoom) - 1);
    const endDate = this.axis.dateAtIndex(axisViewStartIdx + Math.ceil((view.scrollX + canvasWidth) / view.zoom) + 1);

    // issue #21 punt 2: bij een `mid`-tier (dagweergave, 25≤zoom<80) komt er een weeknummer-rij
    // bij en worden de drie rijen gelijkmatig verdeeld (h/6, h/2, 5h/6). Zonder `mid` valt dit
    // blok weg en blijft de oorspronkelijke 2-rijen-layout hieronder byte-identiek staan.
    if (mid) {
      // --- Bovenste rij: major tier (maand) ---
      ctx.font = this.font(11, true);
      ctx.fillStyle = this.colors.text;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      this.drawTierLabels(major, startDate, endDate, headerHeight / 6);

      // --- Middenrij: mid tier (weeknummers), zelfde stijl als de minor-rij ---
      ctx.font = this.font(10);
      ctx.fillStyle = this.colors.textSecondary;
      this.drawTierLabels(mid, startDate, endDate, headerHeight / 2);

      // --- Onderste rij: minor tier (dag) ---
      ctx.font = this.font(10);
      ctx.fillStyle = this.colors.textSecondary;
      this.drawTierLabels(minor, startDate, endDate, headerHeight * 5 / 6);
      return;
    }

    // --- Top row: major tier ---
    ctx.font = this.font(11, true);
    ctx.fillStyle = this.colors.text;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    this.drawTierLabels(major, startDate, endDate, headerHeight / 4);

    // --- Bottom row: minor tier ---
    ctx.font = this.font(10);
    ctx.fillStyle = this.colors.textSecondary;
    this.drawTierLabels(minor, startDate, endDate, headerHeight * 3 / 4);
  }

  private drawTierLabels(
    tier: TimelineTier,
    startDate: Date,
    endDate: Date,
    yCenter: number,
  ): void {
    const { canvasWidth, taskTableWidth, weekStartDay, localizedMonths, localizedWeekdays } = this.opts;
    const wsd = weekStartDay ?? 'monday';
    const ctx = this.ctx;
    const cfg = TIER_CONFIG[tier];

    // Issue #21 punt 5 (header-bugfix, vervolg fase 3 van werkdagen-as-ontwerp.md §4.1): onder
    // compressie stapt de DAG-tier over werkdag-AS-INDICES i.p.v. kalenderdagen. Reden: met
    // `nextTickBoundary('day')` (+1 kalenderdag) vallen aaneengesloten niet-werkdagen (weekend,
    // feestdagblok) allemaal op dezelfde kleef-rechts-naad-x (`workdayAxis.ts`) — elke zo'n tick
    // krijgt toevallig `slotWidth===0` en wordt door de defensieve skip hieronder overgeslagen,
    // dus zichtbare dubbele labels ontstaan hier NIET. Week-/maand-tiers werken wél al
    // automatisch mee via `dateToX` (§4.1: "vrijwel automatisch") — alleen de dag-tier verandert
    // van stapmethode.
    if (tier === 'day' && this.compressed) {
      this.drawWorkdayTierLabels(startDate, endDate, yCenter, cfg, wsd, localizedWeekdays);
      return;
    }

    // Snap to the tick boundary at-or-before startDate
    let cursor = snapToTickStart(startDate, tier, wsd);
    let lastDrawnRight = -Infinity;

    while (cursor.getTime() <= endDate.getTime()) {
      const next = nextTickBoundary(cursor, tier);
      const x1 = this.dateToX(cursor);
      const x2 = this.dateToX(next);
      const labelText = this.formatTierLabel(tier, cursor, wsd, localizedMonths, localizedWeekdays);

      // Skip tick entirely if it doesn't reach the visible task area
      if (x2 <= taskTableWidth) {
        cursor = next;
        continue;
      }
      // Stop once we're past the right edge
      if (x1 >= canvasWidth) break;

      const labelX = Math.max(x1 + 4, taskTableWidth + 4);
      const slotWidth = x2 - Math.max(x1, taskTableWidth);

      // Defensive skip: if slot is too narrow OR we'd overlap the previous label. Issue #21
      // (tier-labels-overlap-fix): daarnaast pas TEKENEN als de GEMETEN tekstbreedte ook echt
      // vóór het einde van deze tick past (x2-2) — anders overslaan (nooit knijpen/afkappen via
      // een fillText-maxWidth), zodat twee labels (bv. maandnamen) nooit door elkaar heen lopen.
      // De lastDrawnRight-guard hierboven blijft als extra vangnet.
      if (slotWidth >= cfg.minLabelWidth && labelX > lastDrawnRight + 4) {
        const measured = ctx.measureText(labelText).width;
        if (labelX + measured <= x2 - 2) {
          ctx.fillText(labelText, labelX, yCenter);
          lastDrawnRight = labelX + measured;
        }
      }

      cursor = next;
    }
  }

  /**
   * Issue #21 punt 5 (header-bugfix): dag-tier onder compressie, itererend over
   * WERKDAG-as-indices (`this.axis.dayIndexOf`/`dateAtIndex`) i.p.v. kalenderdagen. Elke
   * opeenvolgende index is per constructie een ANDERE echte werkdag (§2.2 prefix-som) — er
   * bestaat dus geen niet-werkdag-tick om over te slaan, en twee ticks kunnen nooit op dezelfde
   * x landen. Bijkomend voordeel t.o.v. "per kalenderdag + 0-breedte-skip": het aantal
   * iteraties is O(zichtbare kolommen), niet O(zichtbare kalenderdagen incl. gecomprimeerde
   * weekenden/feestdagen) — bij een ver-gescrolde weergave met veel vrije dagen scheelt dat.
   */
  private drawWorkdayTierLabels(
    startDate: Date,
    endDate: Date,
    yCenter: number,
    cfg: TierConfig,
    wsd: 'monday' | 'sunday',
    localizedWeekdays?: string[],
  ): void {
    const { canvasWidth, taskTableWidth } = this.opts;
    const ctx = this.ctx;

    let idx = Math.floor(this.axis.dayIndexOf(startDate));
    const endIdx = Math.ceil(this.axis.dayIndexOf(endDate));
    let lastDrawnRight = -Infinity;

    while (idx <= endIdx) {
      const cursor = this.axis.dateAtIndex(idx);
      const next = this.axis.dateAtIndex(idx + 1);
      const x1 = this.axis.dateToX(cursor);
      const x2 = this.axis.dateToX(next);
      const labelText = this.formatTierLabel('day', cursor, wsd, undefined, localizedWeekdays);

      if (x2 <= taskTableWidth) {
        idx++;
        continue;
      }
      if (x1 >= canvasWidth) break;

      const labelX = Math.max(x1 + 4, taskTableWidth + 4);
      const slotWidth = x2 - Math.max(x1, taskTableWidth);

      // Zelfde meten-vóór-tekenen-guard als drawTierLabels hierboven (issue #21,
      // tier-labels-overlap-fix): niet knijpen/afkappen, gewoon overslaan als het niet past.
      if (slotWidth >= cfg.minLabelWidth && labelX > lastDrawnRight + 4) {
        const measured = ctx.measureText(labelText).width;
        if (labelX + measured <= x2 - 2) {
          ctx.fillText(labelText, labelX, yCenter);
          lastDrawnRight = labelX + measured;
        }
      }

      idx++;
    }
  }

  private formatTierLabel(
    tier: TimelineTier,
    d: Date,
    weekStartDay: 'monday' | 'sunday',
    localizedMonths?: string[],
    localizedWeekdays?: string[]
  ): string {
    const months = localizedMonths || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n: number) => n.toString().padStart(2, '0');
    switch (tier) {
      case 'year':        return `${d.getUTCFullYear()}`;
      case 'quarter':     return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
      case 'month':       return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      case 'week':        return `W${getWeekNumberFor(d, weekStartDay)}`;
      // issue #21 punt 2 (vervolg: dagnamen): bij voldoende inzoomen (zoom≥40 px/dag) de
      // weekdag-afkorting vóór het dagnummer tonen ('wo 23'); anders alleen het dagnummer.
      // Zonder localizedWeekdays valt het terug op alleen het dagnummer (backwards-compat).
      case 'day': {
        const dayNum = d.getUTCDate();
        if (localizedWeekdays && this.opts.view.zoom >= 40) {
          return `${localizedWeekdays[d.getUTCDay()]} ${dayNum}`;
        }
        return `${dayNum}`;
      }
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
      // M3 (Opus-review T15-iteratie-2): `isZeroDurationMilestone` — een mijlpaal-met-duur (T15) is
      // voor de PLANNING geen mijlpaal (zelfde discriminator als de solver) en tekent dus als een
      // gewone balk, niet als ruit.
      let resourceAccentHeight = 0;
      if (isZeroDurationMilestone(task)) {
        this.drawMilestone(task, y, barHeight, isSelected, overrideColor);
      } else if (task.childIds.length > 0) {
        this.drawSummaryBar(task, y, barHeight, isSelected, overrideColor);
      } else if (task.isHammock) {
        this.drawHammockBar(task, y, barHeight, isSelected, overrideColor);
      } else {
        resourceAccentHeight = this.drawTaskBar(task, y, barHeight, isSelected, overrideColor);
      }
      this.drawConstraintMarkers(task, y);
      this.drawNotesIndicator(task, y);
      // Externe (cross-project) ghost-balken (fase 2.9, §5.5): op volle dekking (niet mee-dimmen),
      // ná de constraint-markers zodat de badge bovenop leesbaar blijft.
      if (dimmed || row.dimmed) this.ctx.globalAlpha = 1;
      this.drawExternalGhosts(task, y, barHeight);
      // Baseline-onderbalk (fase 2.6): op volle dekking, ná het eventuele dim-herstel.
      this.drawBaselineOverlay(task, y, barHeight, resourceAccentHeight);
    }
  }

  private drawTaskBar(task: Task, y: number, height: number, isSelected: boolean, overrideColor?: string): number {
    const ctx = this.ctx;
    const geo = this.barGeometry(task);
    const { x1, x2 } = geo;

    // De speling-band loopt ná de balk door tot x2 + floatWidth (zie de float-indicator verderop).
    // Die breedte MOET in de zichtbaarheidstest mee: anders verdwijnt een band die nog ruim in
    // beeld staat zodra alleen de BALK links buiten beeld schuift — precies het gerapporteerde
    // gedrag. Eén bron voor de breedte, zodat test en tekening niet uit elkaar kunnen lopen.
    // Z15: deze cull-test redeneert bewust op de VOLLE extent (`x1`/`x2` uit `geo`, vóór segmentatie)
    // — ook voor een gesplitste taak. De segmenten (`segs`, hieronder) worden pas ná deze return
    // berekend en zijn nooit breder dan `[x1,x2]`, dus "volledig buiten beeld" op de volle extent
    // impliceert hetzelfde voor elk segment (`check-gantt-float-cull.ts` bewaakt dit).
    const floatWidth = task.time.totalFloat > 0 && !task.time.isCritical
      ? task.time.totalFloat * this.opts.view.zoom
      : 0;
    if (x2 + floatWidth < this.opts.taskTableWidth || x1 > this.opts.canvasWidth) return 0;

    const width = Math.max(x2 - x1, 4);
    // De gedeelde selectie gebruikt dezelfde pure engine als print. In critical blijft de
    // bestaande schermanalyse (float-pad-tinten) intact; Task.color wordt nergens meer gelezen.
    const selection = this.opts.barColorSelection ?? { mode: 'critical' as const };
    const dark = this.opts.darkTheme === true;
    const modeAdvies = selection.mode === 'critical'
      ? null
      : computeBarColors(
          task,
          selection,
          this.barColorContext,
          {
            critical: this.colors.critical, normal: this.colors.normal,
            nearCritical: this.colors.nearCritical, milestone: this.colors.milestone,
            uncategorized: this.colors.ghost,
          } satisfies BarPalette,
          width,
        );
    const modeColor = modeAdvies && modeAdvies.kind === 'solid'
      ? ensureThemeVisible(modeAdvies.fill, dark)
      : null;
    // Resource-segmenten als x-intervallen over [x1,x2] — buiten de uur-split-lus voorbereid, zodat
    // elk werkblok-segment zijn deel van de kleursegmenten tekent (gaten blijven gaten).
    const modeSegments: { cx1: number; cx2: number; color: string }[] = [];
    if (!overrideColor && modeAdvies && modeAdvies.kind === 'segments') {
      let cx = x1;
      modeAdvies.segments.forEach((seg, si) => {
        const isLast = si === modeAdvies.segments.length - 1;
        const w = isLast ? x2 - cx : (x2 - x1) * seg.weight;
        modeSegments.push({ cx1: cx, cx2: cx + w, color: ensureThemeVisible(seg.color, dark) });
        cx += w;
      });
    }

    const color = overrideColor ?? modeColor ?? this.barColor(task);
    // Voortgangsvulling: in de modi ligt er geen bijpassende "licht"-variant van een willekeurige
    // moduskleur — dan de vaste semi-transparante donkere laag (zelfde keuze als de printlaag).
    const progressColor = selection.mode !== 'critical'
      ? 'rgba(0, 0, 0, 0.25)'
      : task.time.isCritical ? this.colors.criticalLight : this.colors.normalLight;

    // Fase 2.8b (§6.9): een uur-taak splitst in werkblok-segmenten (pauzes/nachten vallen als gaten
    // weg) volgens de instelling; dag-taken en niet-gesplitste uur-taken zijn één doorlopend segment.
    // Segmenten komen uit de op het kalender-object gememoizede banden-materialisatie (geen extra solve).
    let segs: { x1: number; x2: number }[] = [{ x1, x2 }];
    let split = false;
    // Z15 (O5-besluit, plan-§10): een ECHTE split (`Task.splitGaps`, uit een .mpp-import afgeleid)
    // tekent ALTIJD gesplitst — een werkonderbreking is DATA, geen weergavevoorkeur. Deze tak
    // raadpleegt `shouldSplit`/`barSplitMode` daarom NIET; die blijven uitsluitend voor de
    // hieronder-volgende `else`-tak (kalender-necking, puur weergave, uur-modus-only).
    if (task.splitGaps && task.splitGaps.length > 0) {
      const eng = this.engineForAnyMode(task);
      const segments = computeSplitSegments(task.splitGaps, geo.start, geo.end, geo.hourMode, eng);
      if (segments.length > 1) {
        // Eerste/laatste grens hergebruikt de AL BEKENDE volle-extent `x1`/`x2` (dezelfde waarden
        // als de cull-test bovenaan deze functie): die dragen dag-modus' "+zoom voor de inclusieve
        // laatste dag"-correctie al, en `computeSplitSegments`'s tussengrenzen zijn bewust EXCLUSIEF
        // (zie die module) — dus zuiver `dateToX(...)` zonder nóg een correctie.
        segs = segments.map((s, i) => ({
          x1: i === 0 ? x1 : this.dateToX(s.start),
          x2: i === segments.length - 1 ? x2 : this.dateToX(s.end),
        }));
        split = true;
      }
    } else if (geo.hourMode && this.shouldSplit(isSelected)) {
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
      if (modeSegments.length > 0) {
        // Resource-modus: kleursegmenten binnen dít werkblok (overlap van elk kleurinterval met
        // [s.x1, s.x2]) — uur-split-gaten blijven zo gaten, precies als bij een enkele kleur.
        for (let mi = 0; mi < modeSegments.length; mi++) {
          const ms = modeSegments[mi];
          const ox1 = Math.max(ms.cx1, s.x1);
          const ox2 = Math.min(ms.cx2, s.x2);
          if (ox2 - ox1 < 0.5) continue;
          ctx.fillStyle = ms.color;
          ctx.beginPath();
          ctx.roundRect(ox1, y, ox2 - ox1, height, mi === 0 ? 3 : 0);
          ctx.fill();
        }
      } else {
        // Segment-achtergrond
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(s.x1, y, sw, height, 3);
        ctx.fill();
      }
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

    // #21: rode rand om kritieke taken — in de scherm-kleurmodi uit het modusadvies (spiegel van
    // de rapportmodi), in 'critical' bij een expliciete taakkleur (de kleur is dan de vulling;
    // zonder rand zou het kritieke pad onleesbaar worden). Volle [x1,x2]-extent, ook bij splits.
    const outlineColor = overrideColor ? null : modeAdvies?.outline;
    if (outlineColor) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x1 - 0.75, y - 0.75, width + 1.5, height + 1.5, 3);
      ctx.stroke();
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

    // Float indicator (ná de exclusieve balk-finish x2) — breedte is hierboven al bepaald en
    // wordt daar ook in de zichtbaarheidstest gebruikt.
    if (floatWidth > 0) {
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

    // Resource-accent (#21): dun streepje in de resourcekleur direct ónder de balk, gesegmenteerd
    // naar rato van unitsPerDay bij meerdere resources. Eén vast hoogtemaatje van 3 px — subtiel
    // genoeg om het kritiek-pad-beeld niet te verdringen, duidelijk genoeg om "wie doet dit" te lezen.
    let resourceAccentHeight = 0;
    if (this.opts.showResourceAccent) {
      const rows = assignmentsFor(task.id, this.opts.resources ?? [], this.opts.assignments ?? []);
      if (rows.length > 0) {
        const total = rows.reduce((a, r) => a + r.unitsPerDay, 0) || 1;
        const accentH = 3;
        const accentY = y + height + 1;
        let ax = x1;
        rows.forEach((r, i) => {
          const isLast = i === rows.length - 1;
          const w = isLast ? x2 - ax : (x2 - x1) * (r.unitsPerDay / total);
          // Donker thema: te donkere resourcekleuren verlichten — anders is het streepje onzichtbaar
          // tegen de donkere werkruimte (hue/verzadiging intact, dus nog steeds herkenbaar dezelfde).
          ctx.fillStyle = ensureThemeVisible(r.color, this.opts.darkTheme === true);
          ctx.fillRect(ax, accentY, Math.max(w, 1), accentH);
          ax += w;
        });
        resourceAccentHeight = accentH;
      }
    }

    // Task name on bar (if wide enough)
    if (width > 40) {
      ctx.fillStyle = this.colors.barText;
      ctx.font = this.font(10);
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.beginPath();
      ctx.rect(x1 + 4, y, width - 8, height);
      ctx.clip();
      ctx.fillText(task.name, x1 + 6, y + height / 2);
      ctx.restore();
    }
    return resourceAccentHeight;
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
      ctx.font = this.font(10);
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
    // Zelfde guard als barGeometry (TODO 2026-07-28): een datumloze mijlpaal heeft niets om op te
    // ankeren — niets tekenen i.p.v. per frame crashen op `undefined.includes(...)`.
    const startStr = task.time.earlyStart || task.time.scheduleStart
      || task.time.earlyFinish || task.time.scheduleFinish;
    if (!startStr) return;
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

    const selection = this.opts.barColorSelection ?? { mode: 'critical' as const };
    const advice = selection.mode === 'critical'
      ? null
      : computeBarColors(task, selection, this.barColorContext, {
          critical: this.colors.critical,
          normal: this.colors.normal,
          nearCritical: this.colors.nearCritical,
          milestone: this.colors.milestone,
          uncategorized: this.colors.ghost,
        });
    const milestoneFill = advice?.kind === 'segments' ? advice.segments[0].color : advice?.fill;
    ctx.fillStyle = overrideColor ?? ensureThemeVisible(milestoneFill ?? this.colors.milestone, this.opts.darkTheme === true);
    diamond(size);
    ctx.fill();

    if (!overrideColor && advice?.outline) {
      ctx.strokeStyle = advice.outline;
      ctx.lineWidth = 1.5;
      diamond(size);
      ctx.stroke();
    }

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
    ctx.font = this.font(10);
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
        ctx.font = this.font(9);
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

  // ── Issue #51: live duur-pilletje tijdens een rand-sleep ────────────────────

  /** Halve tekstmarge links/rechts binnen het pilletje. */
  private static readonly DRAG_BADGE_PAD_X = 5;
  /** Hoogte van het pilletje — iets hoger dan de balk (rowHeight/2 = 14), zodat hij als los
   *  chipje leest en niet als een stuk vulling van de balk zelf. */
  private static readonly DRAG_BADGE_H = 16;
  /** Afstand tussen het pilletje en de gesleepte balkrand. Klein genoeg dat het label duidelijk
   *  bij die rand hoort (de melder plakte hem in zijn voorbeeld tegen de resize-cursor aan). */
  private static readonly DRAG_BADGE_GAP = 4;

  /**
   * Duurtekst voor het sleep-pilletje. Hergebruikt de duurkolom-formattering (`durationText`) en
   * repareert alleen de twee gevallen waarin die voor dit doel te kort schiet:
   *  - urenplanning UIT ⇒ `durationText` plakt een HARDGECODEERDE `d` achter het getal; los van de
   *    tabelkop is dat de enige eenheidsaanduiding die de gebruiker ziet, dus hier de VERTAALDE
   *    afkorting;
   *  - een UUR-taak terwijl de urenplanning-schakelaar uit staat ⇒ `durationText` zou
   *    `scheduleDuration` (dagen) tonen, maar een uur-sleep muteert `durationMinutes`. Het getal
   *    zou dus stilstaan terwijl de balk beweegt. Formatteer dan alsnog uit de minuten.
   */
  private dragDurationText(task: Task): string {
    const sfx = this.opts.durationSuffixes ?? DEFAULT_DURATION_SUFFIXES;
    // `|| ''`: zelfde datumloos-guard als barGeometry (een gesleepte taak hóórt datums te hebben,
    // maar `.includes` op undefined zou het hele frame laten crashen).
    const startStr = task.time.earlyStart || task.time.scheduleStart || '';
    const endStr = task.time.earlyFinish || task.time.scheduleFinish || '';
    const hourMode = startStr.includes('T') || endStr.includes('T');
    if (hourMode) {
      const cal = this.opts.effectiveCalById?.get(task.id) ?? this.opts.calendar;
      const minutes = task.time.durationMinutes ?? taskDurationMinutes(task, cal);
      return formatDuration(minutes, effHoursPerDay(cal), this.opts.durationDisplay ?? 'auto', sfx);
    }
    return this.durationText(task);
  }

  /**
   * Issue #51 — compact duur-pilletje tegen de rand die op dit moment gerekt wordt.
   *
   * Waarom hier en niet als DOM-overlay: de x van een balkrand komt uit `barGeometry` bovenop de
   * gedeelde (mogelijk werkdag-gecomprimeerde) as. Buiten de renderer zou die geometrie een tweede
   * keer nagebouwd moeten worden — precies het soort duplicaat dat elders in dit bestand met veel
   * moeite tot ÉÉN as-chokepoint is teruggebracht. Bijkomend: het pilletje verschijnt zo in
   * dezelfde paint als de balk die het beschrijft (geen frame-lag/scheuring tussen DOM en canvas),
   * en de knipping tegen taaktabel/header komt gratis uit de tekenvolgorde in `render()`.
   *
   * Plaatsing: bij voorkeur BINNEN de balk tegen de gesleepte rand (zoals de melder het tekende);
   * past hij daar niet (smalle balk), dan net BUITEN die rand. In beide gevallen geklemd op het
   * chart-gebied, zodat een balk die tegen de vensterrand aan ligt zijn label niet kwijtraakt.
   */
  private drawDragDurationBadge(): void {
    const drag = this.opts.durationDrag;
    if (!drag) return;
    const rowIndex = this.rowIndexByTask.get(drag.taskId);
    if (rowIndex === undefined) return;
    const row = this.rows[rowIndex];
    if (row?.kind !== 'task') return;
    const task = row.task;

    const { rowHeight, headerHeight, canvasHeight, canvasWidth, taskTableWidth } = this.opts;
    const barHeight = rowHeight * 0.5;
    const barY = this.rowToY(rowIndex) + (rowHeight - barHeight) / 2;
    // Rij weggescrold: niets tekenen (zelfde zichtbaarheidstest als drawTaskBars).
    if (barY + barHeight < headerHeight || barY > canvasHeight) return;

    const ctx = this.ctx;
    const h = GanttRenderer.DRAG_BADGE_H;
    const gap = GanttRenderer.DRAG_BADGE_GAP;
    const label = this.dragDurationText(task);

    ctx.save();
    ctx.font = this.font(10, true);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(label).width + GanttRenderer.DRAG_BADGE_PAD_X * 2;

    const { x1, x2 } = this.barGeometry(task);
    let x: number;
    if (drag.edge === 'right') {
      // Rechts: bij voorkeur IN de balk (zoals de melder het tekende). De taaknaam staat links
      // uitgelijnd en wordt afgekapt, dus daar is het rustig.
      x = x2 - gap - w;
      if (x < x1 + 2) x = x2 + gap;           // past niet in de balk ⇒ er net buiten
    } else {
      // Links: juist BUITEN de balk. Binnenin valt het pilletje per definitie bovenop het
      // naamlabel (dat begint op x1 + een paar px) — gemeten gaf dat "8d)annen".
      x = x1 - gap - w;
      if (x < taskTableWidth + 2) x = x1 + gap;
    }
    // Binnen het chart-gebied houden; is dat smaller dan het pilletje, dan wint de linkerrand.
    const lo = taskTableWidth + 2;
    const hi = canvasWidth - w - 2;
    x = hi < lo ? lo : Math.min(Math.max(x, lo), hi);
    const y = barY + (barHeight - h) / 2;

    // OpenAEC-accent (Construction Amber) met de bijbehorende tekstkleur — hetzelfde paar
    // `--theme-accent` / `--theme-accent-on` dat de DOM-chrome voor accentknoppen gebruikt, dus
    // per thema correct (licht/donker oranje + wit, high-contrast geel + zwart). `colors.selected`
    // ís `--theme-accent`; deze renderer geeft die ene variabele per rol een eigen naam
    // (`selected`/`today`/`statusDate`), en dit is dezelfde bron.
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fillStyle = this.colors.selected;
    ctx.fill();
    // Randje in de paneelkleur is hier FUNCTIONEEL, niet decoratief: de gesleepte balk is altijd
    // ook de GESELECTEERDE balk (mousedown selecteert hem), en die draagt een 2px selectiering in
    // exact dezelfde accentkleur. Zonder deze scheiding vloeit het pilletje aan de balkrand samen
    // met die ring. BEKENDE GRENS (gemeten, issue #51): op een NEAR-CRITICAL balk — amber #F59E0B,
    // alleen zichtbaar met die analyse-optie aan — ligt het accent (#D97706) daar zó dicht bij dat
    // het pilletje zijn eigen vlak nauwelijks aftekent; leesbaar blijft het wel, want de witte
    // tekst en dit randje dragen het contrast. Een dikker randje (2px geprobeerd) helpt daar niet
    // zichtbaar aan en maakt het chipje alleen zwaarder, dus 1.5 gehouden.
    ctx.strokeStyle = this.colors.bg;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = this.colors.accentOn;
    ctx.fillText(label, x + GanttRenderer.DRAG_BADGE_PAD_X, y + h / 2 + 0.5);
    ctx.restore();
  }

  // ── Relatie-routing (issue #41) ─────────────────────────────────────────────
  // De pijlen worden VÓÓR de balken getekend (render-volgorde), dus alles wat onder een balk
  // doorloopt is per definitie onzichtbaar. De routing moet de balken daarom écht ontwijken.
  // Twee bouwstenen: (1) horizontaal reizen gebeurt in de GOOT tussen twee rijen — balken beslaan
  // alleen de middelste helft van een rij (`barHeight = rowHeight/2`, gecentreerd), dus de rijgrens
  // is per constructie balkvrij; (2) verticaal reizen gebeurt in een KOLOM die geen balk van een
  // tussenliggende rij raakt (`pickColumn`).

  /** Marge rond een balk waarbinnen geen doorsteek-kolom wordt gekozen (dekt selectiering + afronding). */
  private static readonly ARROW_PAD = 3;
  /** Uit-/inlooplengte van de pijlstubs naast de balkrand. */
  private static readonly ARROW_STUB = 8;
  /** Compacte stub voor krappe gevallen (FS zonder gat: `toX ≈ fromX`) — houdt het "omheen"-blokje
   *  klein zodat de meest voorkomende relatie geen brede zigzag wordt. */
  private static readonly ARROW_STUB_TIGHT = 4;
  /** Hergebruikt scratch-pad voor het pijlpad: max 8 punten. Een array per pijl zou bij duizenden
   *  relaties × 60 fps puur GC-druk zijn. */
  private readonly arrowPts: number[] = new Array(16).fill(0);

  /**
   * Bouwt de obstakel-index van de zichtbare rijen. Bewuste keuzes over wat wél/niet als obstakel telt:
   *  - de BALK zelf (taak/summary/hammock/mijlpaal) telt — dat is de dekkende vulling uit de melding;
   *  - een BANDKOPRIJ telt NIET: die strook is 8% transparant (`summary + '14'`) en verbergt niets,
   *    terwijl hij de volle breedte beslaat en dus élke kolom zou blokkeren;
   *  - de SPELINGSBAND, baseline-onderbalk, constraint-pins en aantekening-badges tellen NIET.
   *    De speling-band kan tientallen dagen breed zijn; hem als obstakel meenemen zou pijlen
   *    kilometers laten omlopen (spaghetti) voor een strook die maar een halve balkhoogte hoog is.
   *    De andere drie zijn punt-glyphs c.q. liggen buiten de goot (baseline eindigt op 0,89·rowHeight,
   *    de goot ligt op de rijgrens).
   */
  private buildRowObstacles(): RowObstacles {
    const { rowHeight, headerHeight, canvasHeight, view } = this.opts;
    const n = this.rows.length;
    // Zichtbaar: rowToY(i) < canvasHeight  én  rowToY(i) + rowHeight > headerHeight. Eén rij extra
    // marge aan beide kanten kost niets en houdt de index tolerant voor afrondingen.
    const first = Math.max(0, Math.ceil(view.scrollY / rowHeight) - 2);
    const last = Math.min(n - 1, Math.ceil((canvasHeight - headerHeight + view.scrollY) / rowHeight) + 1);
    if (last < first) return { r0: 0, r1: -1, x1: EMPTY_SPANS, x2: EMPTY_SPANS };

    const len = last - first + 1;
    const x1 = new Float64Array(len).fill(Infinity);
    const x2 = new Float64Array(len).fill(-Infinity);
    for (let i = first; i <= last; i++) {
      const row = this.rows[i];
      if (row.kind !== 'task') continue;
      const geo = this.barGeometry(row.task);
      // Een mijlpaalruit steekt buiten [x1,x2] uit (anker + halve ruitbreedte); ruimer padden i.p.v.
      // de anker-logica van `drawMilestone` te dupliceren (die zou stil uit de pas kunnen lopen).
      // M3 (Opus-review T15-iteratie-2): `isZeroDurationMilestone` — een mijlpaal-met-duur tekent
      // als gewone balk en heeft dus de gewone pijl-padding nodig, niet de ruit-padding.
      const pad = isZeroDurationMilestone(row.task) ? 6 : GanttRenderer.ARROW_PAD;
      x1[i - first] = geo.x1 - pad;
      x2[i - first] = geo.x2 + pad;
    }
    return { r0: first, r1: last, x1, x2 };
  }

  /** Is kolom `x` vrij van balken in de rijen STRIKT tussen `a` en `b`? De rijen van de voorganger
   *  en de opvolger zelf horen er niet bij: daar wordt de kolom per constructie al naast de balk
   *  gelegd. Rijen buiten de index (= buiten beeld) tellen niet mee. */
  private isColumnFree(obs: RowObstacles, x: number, a: number, b: number): boolean {
    const lo = Math.max(Math.min(a, b) + 1, obs.r0);
    const hi = Math.min(Math.max(a, b) - 1, obs.r1);
    for (let i = lo; i <= hi; i++) {
      const k = i - obs.r0;
      if (x > obs.x1[k] && x < obs.x2[k]) return false;
    }
    return true;
  }

  /** Kiest de verticale doorsteek-kolom: eerst de voorkeur, dan het alternatief, en pas als beide
   *  geblokkeerd zijn een gatenzoektocht in de corridor ertussen (de dure tak — zeldzaam, en
   *  begrensd tot de corridor zodat een omweg nooit buiten de eigen bounding box uitwaaiert).
   *  Vindt hij niets, dan wint de voorkeur en accepteren we de occlusie: liever een gedeeltelijk
   *  bedekte pijl dan een pijl die dwars door het hele diagram slingert. */
  private pickColumn(obs: RowObstacles, prefer: number, alt: number, a: number, b: number): number {
    if (this.isColumnFree(obs, prefer, a, b)) return prefer;
    if (this.isColumnFree(obs, alt, a, b)) return alt;

    const lo = Math.min(prefer, alt);
    const hi = Math.max(prefer, alt);
    if (hi - lo < 2) return prefer;
    const rLo = Math.max(Math.min(a, b) + 1, obs.r0);
    const rHi = Math.min(Math.max(a, b) - 1, obs.r1);

    const spans: { a: number; b: number }[] = [];
    for (let i = rLo; i <= rHi; i++) {
      const k = i - obs.r0;
      if (obs.x2[k] > lo && obs.x1[k] < hi) spans.push({ a: obs.x1[k], b: obs.x2[k] });
    }
    spans.sort((p, q) => p.a - q.a);

    let best = NaN;
    let bestDist = Infinity;
    const consider = (from: number, to: number): void => {
      if (to - from < 1) return;
      const c = Math.min(Math.max(prefer, from), to);
      const d = Math.abs(c - prefer);
      if (d < bestDist) { bestDist = d; best = c; }
    };
    let cursor = lo;
    for (const s of spans) {
      if (s.a > cursor) consider(cursor, Math.min(s.a, hi));
      if (s.b > cursor) cursor = s.b;
      if (cursor >= hi) break;
    }
    if (cursor < hi) consider(cursor, hi);
    return Number.isNaN(best) ? prefer : best;
  }

  /** Tekent het pijlpad uit het scratch-pad (`n` = aantal getallen, dus 2× het aantal punten).
   *  Punten die samenvallen worden overgeslagen — een lege lineTo is met `lineCap:'butt'` weliswaar
   *  onzichtbaar, maar zo blijft het pad ook onafhankelijk van een eventuele lineCap van buiten. */
  private strokeArrowPath(pts: number[], n: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    let px = pts[0];
    let py = pts[1];
    ctx.moveTo(px, py);
    for (let i = 2; i < n; i += 2) {
      const x = pts[i];
      const y = pts[i + 1];
      if (x === px && y === py) continue;
      ctx.lineTo(x, y);
      px = x;
      py = y;
    }
    ctx.stroke();
  }

  private drawDependencyArrows(): void {
    const ctx = this.ctx;
    // `lineWidth` blijft VÓÓR de vroege uitstap staan: de today-/statusdatumlijn hierboven laat 'm op
    // 2 achter, en de balklaag hieronder rekent op de 1 die deze methode altijd zette. De
    // setLineDash/globalAlpha-resets onderaan zijn zonder relaties per definitie no-ops.
    ctx.lineWidth = 1;
    if (this.opts.sequences.length === 0) return;
    const obs = this.buildRowObstacles();

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

      // Verticale offscreen-cull (prestatie). Issue #41: het pad is niet langer één elleboog, dus
      // de marge is opnieuw afgeleid. Alle y-waarden van de route liggen in {predY, succY, laneP,
      // laneS}; de goten `laneP`/`laneS` liggen op een rijgrens op ±rowHeight/2 van hun eigen
      // endpoint en dus (bij verschillende rijen) TUSSEN predY en succY. Alleen in het degeneratieve
      // geval predIdx === succIdx kan een goot rowHeight/2 buiten het paar vallen. Marge =
      // rowHeight/2 + 8 dekt dat plus pijlkop (±3) en lijnbreedte — een net-zichtbare pijl wordt
      // dus NOOIT overgeslagen. Bespaart de dure parseDate/dateToX hieronder voor de rest.
      const canvasH = this.opts.canvasHeight;
      const cullMargin = rowH / 2 + 8;
      if (Math.max(predY, succY) < -cullMargin || Math.min(predY, succY) > canvasH + cullMargin) continue;

      // Ankerpunten + looprichtingen per relatietype (issue #59: de oude `default`-tak tekende
      // FF en SF als FS, dus landden ze altijd op de opvolger-START i.p.v. de FINISH).
      //   predStart  — voorganger-anker = start/linkerrand  (SS, SF)
      //   succFinish — opvolger-anker  = finish/rechterrand (FF, SF)
      let fromX: number, toX: number, dirOut: number, dirIn: number;
      const predStart = seq.type === 'START_START' || seq.type === 'START_FINISH';
      const succFinish = seq.type === 'FINISH_FINISH' || seq.type === 'START_FINISH';
      if (predStart) {
        fromX = this.dateToX(parseDate(pred.time.earlyStart || pred.time.scheduleStart));
      } else {
        fromX = this.dateToX(parseDate(pred.time.earlyFinish || pred.time.scheduleFinish)) + this.opts.view.zoom;
      }
      if (succFinish) {
        toX = this.dateToX(parseDate(succ.time.earlyFinish || succ.time.scheduleFinish)) + this.opts.view.zoom;
      } else {
        toX = this.dateToX(parseDate(succ.time.earlyStart || succ.time.scheduleStart));
      }
      // dirOut = uitloop WEG van de voorgangerbalk; dirIn = aankomstkant bij de opvolger:
      // start-anker (FS/SS) komt van links (kop wijst naar rechts); finish-anker (FF/SF) van rechts.
      dirOut = predStart ? -1 : 1;
      dirIn = succFinish ? 1 : -1;

      if (fromX < this.opts.taskTableWidth && toX < this.opts.taskTableWidth) continue;

      // ── Routing (issue #41, uitbreiding #59 voor FF/SF) ───────────────────
      // `dirOut`/`dirIn` zijn hierboven berekend. `xa` ligt naast de voorgangerbalk (aan de
      // uitloopkant); `enter` ligt naast de opvolgerbalk aan de AANKOMSTkant — bij FS/SS links
      // (dirIn −1), bij FF/SF rechts (dirIn +1). Vóór #41 liep de SS-stub de balk ín.
      const tight = Math.abs(toX - fromX) < 2 * GanttRenderer.ARROW_STUB;
      const stub = tight ? GanttRenderer.ARROW_STUB_TIGHT : GanttRenderer.ARROW_STUB;
      const xa = fromX + dirOut * stub;      // naast de voorgangerbalk
      const enter = toX + dirIn * stub;      // naast de opvolgerbalk, aan de aankomstkant

      const pts = this.arrowPts;
      let n = 0;
      // De elleboog (één verticaal op `xa`) volstaat als `xa` buiten de opvolgerbalk valt — bij
      // start-aankomst (dirIn −1) betekent dat `xa <= enter`, bij finish-aankomst (dirIn +1) het
      // gespiegelde `xa >= enter` — én de kolom niet door een tussenliggende balk wordt geblokkeerd.
      const elbowOk = dirIn < 0 ? xa <= enter : xa >= enter;
      if (elbowOk && this.isColumnFree(obs, xa, predIdx, succIdx)) {
        // Klassieke elleboog — ongewijzigd t.o.v. vóór #41 (op de stublengte na, die alleen in
        // krappe gevallen kleiner wordt): er is ruimte vóór de opvolger én de kolom is vrij.
        // Het laatste horizontale stuk loopt op succY naar `toX` toe en blijft dus links van de
        // opvolgerbalk; de daling bij `xa` blijft naast de voorgangerbalk.
        pts[n++] = fromX; pts[n++] = predY;
        pts[n++] = xa;    pts[n++] = predY;
        pts[n++] = xa;    pts[n++] = succY;
        pts[n++] = toX;   pts[n++] = succY;
      } else {
        // Trap om de balken heen: uit de balk stappen, in de GOOT tussen de rijen reizen, en pas
        // links van de opvolgerbalk weer de rij in zakken. Dekt (a) FS zonder gat (toX ≈ fromX),
        // waar de oude route haar laatste stuk + pijlkop ónder de opvolgerbalk legde, (b) negatieve
        // lag / toX < fromX, en (c) een tussenliggende balk die de kolom blokkeert.
        const down = succIdx >= predIdx;
        const predTop = predY - rowH / 2;
        const succTop = succY - rowH / 2;
        const laneP = down ? predTop + rowH : predTop;   // rijgrens van de voorganger, kant opvolger
        const laneS = down ? succTop : succTop + rowH;   // rijgrens van de opvolger, kant voorganger
        // Bij aangrenzende rijen vallen beide goten samen: dan is er geen lange verticaal en doet de
        // kolomkeuze er niet toe (de trap knijpt zichzelf tot één horizontale in de goot).
        const col = laneP === laneS ? enter : this.pickColumn(obs, enter, xa, predIdx, succIdx);
        pts[n++] = fromX; pts[n++] = predY;
        pts[n++] = xa;    pts[n++] = predY;
        pts[n++] = xa;    pts[n++] = laneP;
        pts[n++] = col;   pts[n++] = laneP;
        pts[n++] = col;   pts[n++] = laneS;
        pts[n++] = enter; pts[n++] = laneS;
        pts[n++] = enter; pts[n++] = succY;
        pts[n++] = toX;   pts[n++] = succY;
      }
      this.strokeArrowPath(pts, n);

      // Arrowhead — base aan de aankomstkant (dirIn): FS/SS wijst naar rechts (base links), FF/SF
      // naar links (base rechts). `toX + dirIn*5` geeft voor dirIn −1 de oude `toX − 5`.
      ctx.beginPath();
      ctx.moveTo(toX, succY);
      ctx.lineTo(toX + dirIn * 5, succY - 3);
      ctx.lineTo(toX + dirIn * 5, succY + 3);
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
    // Issue #38 punt 5: de duur-kop stond links-uitgelijnd op een gegokte offset
    // (taskTableWidth - 45), dus een breder label (bv. DE "Dauer", FR "Durée") liep zo over de
    // rechterrand van de tabel de Gantt-zone in. De duur-per-rij hieronder (§ Duration) staat al
    // rechts-uitgelijnd op `taskTableWidth - 8` binnen een gereserveerde kolom van 55px (zelfde
    // marge als de taaknaam-clip: `taskTableWidth - indent - 55`) — de kop volgt nu diezelfde
    // rechterrand/kolombreedte, plus alle drie de kopteksten worden afgekapt zodat ze nooit
    // buiten hun eigen kolom kunnen lopen.
    //
    // De rechter-uitlijning wordt hier BEWUST met de hand uitgerekend (linkerrand = rechterrand −
    // tekstbreedte) in plaats van via `ctx.textAlign = 'right'`. Twee redenen: (1) `textAlign` is
    // globale context-state die daarna weer teruggezet moet worden — een lek dat de rest van de
    // frame-render stilletjes kan verschuiven; (2) de headless header-check
    // (`tests/planning/check-header-compress.ts`) leest de x van elke `fillText` als LINKERrand en
    // ziet een rechts-uitgelijnd label daardoor als een overlap met de tijdlijn-weeklabels
    // ("stapeling ... 'Duur' overlapt 'W47'"). Zelf rekenen geeft exact dezelfde pixels, houdt de
    // context schoon en laat de check kloppen op wat er werkelijk staat.
    const headers = this.opts.columnHeaders || { wbs: 'WBS', taskName: 'Taaknaam', duration: 'Duur' };
    const headerDurationColStart = taskTableWidth - 55; // zelfde kolomreservering als de rijen
    ctx.fillStyle = this.colors.text;
    ctx.font = this.font(11, true);
    ctx.textBaseline = 'middle';
    ctx.fillText(this.truncate(headers.wbs, 44), 8, headerHeight / 2);
    ctx.fillText(this.truncate(headers.taskName, headerDurationColStart - 60 - 4), 60, headerHeight / 2);
    const durationLabel = this.truncate(headers.duration, 47);
    const durationX = taskTableWidth - 8 - ctx.measureText(durationLabel).width;
    ctx.fillText(durationLabel, durationX, headerHeight / 2);

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
        ctx.font = this.font(11, true);
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
      ctx.font = this.font(10);
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
      ctx.font = this.font(11, isSummary);

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
        ctx.fillStyle = this.colors.barText;
        ctx.font = this.font(10, true);
        ctx.textAlign = 'center';
        ctx.fillText('+', btnX + btnSize / 2, textY);
        ctx.textAlign = 'left';
      }

      // Duration
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = this.font(10);
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

  /** Hit test (issue #21 punt 1, fase 2): verticale drieband bínnen de rij op `canvasY` — bovenste
   *  kwart = 'before' (invoegen boven deze rij), onderste kwart = 'after' (invoegen onder deze
   *  rij), middenband = 'nest' (kind worden van deze rij). Hergebruikt exact dezelfde
   *  rowTop-formule als `getRowIndex`/de rij-tekencode hierboven, zodat de zone altijd op de
   *  pixel klopt met waar de rij getekend is. */
  getRowZone(canvasY: number): 'before' | 'after' | 'nest' {
    const idx = this.getRowIndex(canvasY);
    const rowTop = this.opts.headerHeight + idx * this.opts.rowHeight - this.opts.view.scrollY;
    const frac = (canvasY - rowTop) / this.opts.rowHeight;
    if (frac < 0.25) return 'before';
    if (frac > 0.75) return 'after';
    return 'nest';
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

  /** Dev/browser-testnaad: vind de werkelijk getekende sleepbalk zonder geometrie te dupliceren.
   *  De methode blijft bewust in de renderer: alleen die bezit rijpositie, tijdas en hit-testbeleid.
   *  Datumloze terugvalstubs, nulduurmijlpalen en verzameltaken zijn niet sleepbaar en leveren
   *  daarom net als `getTaskBarBounds` geen fictieve rechthoek op. */
  getTaskBarRect(taskId: string): { left: number; right: number; top: number; bottom: number } | null {
    const rowIndex = this.rowIndexByTask.get(taskId);
    if (rowIndex === undefined) return null;
    const row = this.rows[rowIndex];
    if (row?.kind !== 'task') return null;
    const task = row.task;
    if (task.childIds.length > 0 || isZeroDurationMilestone(task)) return null;
    if (!(task.time.earlyStart || task.time.scheduleStart) || !(task.time.earlyFinish || task.time.scheduleFinish)) {
      return null;
    }

    const { x1, x2 } = this.barGeometry(task);
    const barHeight = this.opts.rowHeight * 0.5;
    const top = this.rowToY(rowIndex) + (this.opts.rowHeight - barHeight) / 2;
    return {
      left: x1,
      right: x1 + Math.max(x2 - x1, 4),
      top,
      bottom: top + barHeight,
    };
  }

  /** Hit test: get task bar bounds for a task at row index (for drag & drop) */
  getTaskBarBounds(canvasX: number, canvasY: number): { task: Task; edge: 'left' | 'right' | 'body' } | null {
    if (canvasX < this.opts.taskTableWidth) return null;
    const task = this.getTaskAtY(canvasY);
    // M3 (Opus-review T15-iteratie-2): `isZeroDurationMilestone` — een mijlpaal-met-duur tekent als
    // gewone balk (regel ~940) en moet dus ook gewoon sleep-/resize-baar zijn, zoals elke andere
    // taak met een echte duur.
    if (!task || task.childIds.length > 0 || isZeroDurationMilestone(task)) return null;
    // Datumloos-guard (TODO 2026-07-28): barGeometry tekent voor zo'n taak een terugval-stub op de
    // viewstart, maar die mag geen sleep/resize armen — de drag-hooks zouden met undefined
    // originalStart/originalFinish rekenen.
    if (!(task.time.earlyStart || task.time.scheduleStart) || !(task.time.earlyFinish || task.time.scheduleFinish)) {
      return null;
    }

    // Uur-bewuste balk-uiteinden, zodat de resize-grepen op een sub-dag-balk kloppen (§6.1/§6.3).
    // Z15: BEWUST de volle extent `[x1,x2]`, ook voor een gesplitste taak (`Task.splitGaps`) — een
    // gesplitste balk is deze etappe als GEHEEL sleep-/resize-baar, niet per segment. Dat is de
    // GEWENSTE uitkomst (plan-§Z15): bewerken van splits (een gat verslepen, een split opheffen)
    // is een aparte, latere etappe (O2-besluit); deze balk drag-/resize't dus exact zoals een
    // ongesplitste balk, ongeacht `splitGaps`.
    const { x1, x2 } = this.barGeometry(task);
    const edgeZone = 6; // pixels for edge detection

    if (canvasX >= x1 - edgeZone && canvasX <= x2 + edgeZone) {
      if (canvasX <= x1 + edgeZone) return { task, edge: 'left' };
      if (canvasX >= x2 - edgeZone) return { task, edge: 'right' };
      return { task, edge: 'body' };
    }
    return null;
  }

  /**
   * Hit test: mag hier een RELATIE-sleep starten?
   *
   * Bewust een aparte methode náást `getTaskBarBounds` en géén versoepeling daarvan. Die functie
   * armt slepen én resizen, en weigert mijlpalen en verzamelbalken om goede redenen: een ruit heeft
   * geen duur om te resizen, en de datums van een verzamelbalk zijn afgeleid uit de kinderen.
   * Sinds issue #40 armt dezelfde functie óók de relatie-sleep, en dáár slaat de mijlpaal-clausule
   * nergens op: een mijlpaal is een bladtaak met duur 0 die de solver volledig ondersteunt als
   * voorganger én opvolger. Dat was de bug.
   *
   * VERZAMELTAKEN ZIJN SINDS HET EIGENAARSBESLUIT VAN 2026-08-15 EXPLICIET WÉL TOEGESTAAN ALS BRON.
   * Tot dan weerde deze hit-test ze ("de solver krijgt alleen bladtaken, dus zo'n relatie zou een
   * spookrelatie zijn") — maar `expandSummaryRelations` (`engine/scheduler/expandSummaryRelations.ts`)
   * rekent een relatie mét een verzameltaak-eindpunt sindsdien gewoon door naar de onderliggende
   * bladtaken (MS Project-semantiek), en droppen óp een verzamelbalk werkte via `relationVerdict`
   * (`state/relationRules.ts`) al langer. Slepen VANAF een verzamelbalk hoorde in lockstep te
   * blijven met droppen ERÓP; deze functie liep sinds die wijziging achter. De uiteindelijke
   * legaliteit van de relatie (inclusief de resterende voorouder-weigering) wordt hoe dan ook pas
   * bij het loslaten bepaald — door `createRelationWithFeedback`/`relationVerdict`, niet hier — dus
   * deze hit-test hoeft alleen nog te weigeren waar helemaal geen zinnige balk staat (datumloos,
   * buiten de balk).
   *
   * De check hieronder importeert bewust niets uit `@/state` (deze renderer doet dat nergens) — zie
   * `isSummaryTask`/`isAncestorRelation` in `state/relationRules.ts` voor de daadwerkelijke regels;
   * hier is alleen de geometrie van belang.
   */
  getRelationSourceAt(canvasX: number, canvasY: number): Task | null {
    if (canvasX < this.opts.taskTableWidth) return null;
    const task = this.getTaskAtY(canvasY);
    if (!task) return null;
    // Zelfde datumloos-guard als getTaskBarBounds: een taak zonder datums heeft alleen een
    // terugval-stub op de viewstart en dus geen betekenisvolle positie om vanaf te slepen.
    if (!(task.time.earlyStart || task.time.scheduleStart) || !(task.time.earlyFinish || task.time.scheduleFinish)) {
      return null;
    }

    const { x1, x2 } = this.barGeometry(task);
    // Marge van 6px. In DAG-modus is dit niet strikt nodig — `barGeometry` geeft een mijlpaal
    // x2 = x1 + zoom, dus de zone beslaat al een volle dagcel en de ruit valt er bij elke
    // milestoneKind (START/AUTO/FINISH, anchor 0..zoom) binnen. In UUR-modus geldt x1 === x2
    // exact en ankert de ruit op x1; dáár is deze marge het enige dat 'm grijpbaar maakt.
    // 6 is dezelfde waarde die `buildRowObstacles` als mijlpaal-`pad` aanhoudt.
    const grab = 6;
    return canvasX >= x1 - grab && canvasX <= x2 + grab ? task : null;
  }
}
