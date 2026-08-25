import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { WorkCalendar } from '@/types/calendar';
import { parseDate, formatDate, addCalendarDays, getWeekNumberFor, diffCalendarDays, isoDayOfWeek } from '@/utils/dateUtils';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { DateNotation } from '@/types/view';
import type { Draw2D } from '@/services/pdf/draw2d';
import { CanvasDraw2D } from '@/services/pdf/canvasDraw2d';
// Print-vriendelijk kleurschema — nu uit het centrale themapalet (audit C5/P17). De naam
// `PRINT_COLORS` blijft behouden zodat de teken-aanroepen ongewijzigd zijn; waarden zijn identiek.
import { PRINT_PALETTE as PRINT_COLORS } from '@/engine/renderer/themePalette';
import { dateToX as axisDateToX } from '@/engine/renderer/timeAxis';
import { computeSplitSegments } from '@/engine/renderer/splitBarGeometry';
import { snapToChoice } from '@/utils/numberChoice';
import { isSummaryTask } from '@/utils/taskHierarchy';

// BASISmaten bij rapport-lettergrootte 100%. Niets tekent hier nog rechtstreeks mee: alle
// tekenhelpers rekenen met de geschaalde varianten uit {@link ReportMetrics}/{@link makeMetrics}.
const ROW_HEIGHT = 24;
const PROJECT_HEADER_HEIGHT = 64;
const TIMELINE_HEADER_HEIGHT = 44;
const TABLE_WIDTH = 450;
const FOOTER_HEIGHT = 50;
// Inter (gevendorde glyf-TTF, family 'InterPDF') eerst — deterministisch en inbedbaar zodat preview
// en de latere vector-export identieke measureText geven; systeem-stack als fallback zolang de
// FontFace nog niet geladen is (§5.1/K2 ontwerpdoc). De swap reflowt bewust bestaande exports.
const FONT_FAMILY = 'InterPDF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// Relatielijn-stub: de horizontale afstand die een relatielijn eerst rechtdoor loopt vóórdat hij
// verticaal afknikt (en spiegelbeeldig links van de opvolger bij de "omheen"-route). Dit is de
// x-positie van de VERTICALE knik, gerekend vanaf de rechterrand van de voorganger-balk.
const DEP_STUB = 6;
// Linkerpad van een taaklabel RECHTS van de balk. Bewust groter dan `DEP_STUB`: het label begint
// pas voorbij de verticale knik van de relatie die uit DEZE balk vertrekt (issue #25 punt 2).
// De koppeling is expliciet — verandert de stub, dan schuift het label mee. Let op: dit dekt alleen
// de EIGEN knik; dat willekeurige andere relatielijnen niet over het label lopen komt doordat de
// labels als laatste getekend worden (zie de tekenvolgorde bij `drawDependencies`).
const BAR_LABEL_GAP = DEP_STUB + 8;
// Kleine pad voor de LINKER fallback van een taaklabel; daar vertrekt geen eigen relatie-knik, dus
// daar is de grote gap niet nodig.
const BAR_LABEL_PAD_LEFT = 4;

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

// Compute right-aligned column positions. `k` is de rapport-lettergrootteschaal (zie
// {@link ReportMetrics}); álle kolommaten schalen mee, want een grotere letter heeft een bredere
// kolom nodig. Bij k = 1 is dit rekenkundig exact de oude, ongeschaalde uitkomst.
function getColPositions(k: number) {
  const tableWidth = TABLE_WIDTH * k;
  const completeX = tableWidth - COL.complete.w * k;
  const endX = completeX - COL.end.w * k;
  const startX = endX - COL.start.w * k;
  const durationX = startX - COL.duration.w * k;
  const nameW = durationX - COL.name.x * k;
  return {
    rowNum: { x: COL.rowNum.x * k, w: COL.rowNum.w * k },
    wbs: { x: COL.wbs.x * k, w: COL.wbs.w * k },
    name: { x: COL.name.x * k, w: nameW },
    duration: { x: durationX, w: COL.duration.w * k },
    start: { x: startX, w: COL.start.w * k },
    end: { x: endX, w: COL.end.w * k },
    complete: { x: completeX, w: COL.complete.w * k },
  };
}

type ColPositions = ReturnType<typeof getColPositions>;

/**
 * De maatvoering van één rapport-render, geschaald met de instelbare rapport-lettergrootte
 * (issue #25 punt 4, rapport-helft). Alle tekenhelpers rekenen met dit object in plaats van met de
 * module-constanten hierboven — er mag geen pad overblijven waar nog een ONgeschaalde constante
 * gebruikt wordt, anders scheurt de layout bij een andere schaal.
 *
 * ==== WAAROM RELATIEF EN NIET UNIFORM (lees dit vóór je dit "vereenvoudigt") ====
 * Het hele rapport uniform opschalen is onder de fit-width-pagineerder een perfecte NO-OP. De
 * pagineerder schaalt de bron naar papier met `scale = printW / cw` (bronbreedte cw → printbreedte)
 * en berekent het aantal rijen per pagina als
 *     rows = ceil((ch − repeatH) / (printH / scale − repeatH)).
 * Vermenigvuldig je ALLE bronmaten met k, dan wordt de pagineerschaal `printW / (k·cw) = scale / k`
 * en krijgen in die rows-formule zowel `ch` en `repeatH` als `printH / scale` allemaal dezelfde
 * factor k — de uitkomst blijft exact gelijk. Op papier verandert er dus letterlijk niets: je zou
 * een knop bouwen die niets doet.
 *
 * Een rapport-lettergrootte is daarom alleen zinvol als RELATIEVE wijziging. We schalen daarom WEL:
 * alle fontgroottes, de rijhoogte, de beide kopstroken, de voettekst-strook, de tabelbreedte en de
 * kolombreedtes — en NIET de tijdlijn-zoom (px per dag). Netto op papier: tekst en tabel worden
 * echt groter, de chart-breedte krimpt navenant en er passen minder rijen op een vel. Precies wat
 * een gebruiker van "grotere letters" verwacht.
 *
 * Vuistregel voor losse offsets: alles in de TEKST-zones (project-kop, tijdschaal-kop, taaktabel,
 * voettekst, staaflabels) schaalt mee via {@link ReportMetrics.s}; de vaste decoraties in het
 * CHART-gebied (relatie-stub, pijlpunt, samenvattings-driehoekjes) blijven ongeschaald, want die
 * horen bij de ongeschaalde tijdlijn-geometrie.
 */
interface ReportMetrics {
  /** De schaalfactor zelf. 1 = 100% = byte-identiek aan het gedrag van vóór deze instelling. */
  k: number;
  /** Schaal een losse lengte/offset in de tekst-zones mee (paddings, baseline-correcties). */
  s(v: number): number;
  /** `font(9)` / `font(9, true)` → de CSS-fontstring met de geschaalde puntgrootte. */
  font(size: number, bold?: boolean): string;
  rowHeight: number;
  projectHeaderHeight: number;
  timelineHeaderHeight: number;
  totalHeaderHeight: number;
  tableWidth: number;
  footerHeight: number;
  cols: ColPositions;
}

/**
 * De aangeboden rapport-lettergroottes (percentage). Dit is de ENIGE bron van waarheid: de Select in
 * `ReportPanel` bouwt zijn opties hieruit, `loadReportSettings` valideert ertegen en `makeMetrics`
 * snapt ernaartoe.
 */
export const REPORT_FONT_SCALES = [90, 100, 110, 125] as const;

/**
 * Bouw de {@link ReportMetrics} voor een render. `reportFontScale` is een PERCENTAGE; ontbreekt hij
 * (of is hij onbruikbaar) dan geldt 100 ⇒ factor exact 1 ⇒ identieke output als voorheen.
 *
 * Een waarde buiten {@link REPORT_FONT_SCALES} wordt naar de dichtstbijzijnde toegestane waarde
 * GESNAPT, niet op het bereik geklemd. Klemmen zou een 108 gewoon op 108% renderen — een grootte die
 * geen enkele Select kan tonen en die na een herstart dus niet reproduceerbaar is. Zelfde semantiek
 * als in de settings- en rapport-loaders, allemaal via {@link snapToChoice}.
 */
function makeMetrics(reportFontScale: number | undefined): ReportMetrics {
  const pct = snapToChoice(REPORT_FONT_SCALES, reportFontScale ?? 100) ?? 100;
  const k = pct / 100;
  const projectHeaderHeight = PROJECT_HEADER_HEIGHT * k;
  const timelineHeaderHeight = TIMELINE_HEADER_HEIGHT * k;
  return {
    k,
    s: (v) => v * k,
    font: (size, bold) => `${bold ? 'bold ' : ''}${size * k}px ${FONT_FAMILY}`,
    rowHeight: ROW_HEIGHT * k,
    projectHeaderHeight,
    timelineHeaderHeight,
    // Bewust de SOM van de twee geschaalde hoogtes, niet `(PROJECT + TIMELINE) * k`: alleen zo valt
    // de kopstrook-grens gegarandeerd tot op de bit samen met waar de tijdschaal-kop eindigt.
    totalHeaderHeight: projectHeaderHeight + timelineHeaderHeight,
    tableWidth: TABLE_WIDTH * k,
    footerHeight: FOOTER_HEIGHT * k,
    cols: getColPositions(k),
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
    legend: {
      criticalPath: string; normal: string; milestone: string; summary: string; float: string; completion: string;
      /** Eén regel die de LIJNSTIJL van de relaties verklaart: doorgetrokken = bepalend (driving),
       *  gestreept = niet-bepalend. Verschijnt alleen als er relaties getekend worden én de
       *  bindend-informatie beschikbaar is (zie {@link PrintOptions.drivingSequenceIds}). */
      relationStyle: string;
    };
    tableHeaders: { rowNum: string; wbs: string; taskName: string; start: string; end: string; duration: string; completion: string };
    page: string;
    of: string;
    /** Label boven de gestippelde "vandaag"-lijn in het Gantt-gebied. */
    today: string;
  };
  localizedMonths?: string[];
  localizedMonthsShort?: string[];
  locale?: string;
  projectStartDate?: string;
  projectEndDate?: string;
  projectAuthor?: string;
  /** Datumnotatie (taak #53) voor de header- en tabel-datums; ontbreekt ⇒ dd-mm-jjjj. */
  dateNotation?: DateNotation;
  /**
   * Eerste dag van de week (K-item 39). Bepaalt drie dingen die het scherm al zo doet: het
   * WEEKNUMMER (`getWeekNumberFor`), op welke dag het weeklabel in de kopstrook staat, en op welke
   * dag de zwaardere verticale rasterlijn valt. Ontbreekt ⇒ `'monday'`, exact het oude gedrag.
   *
   * Hier stond dit veld NIET, terwijl `ui.weekStartDay` een gewone instelling is die de Gantt op het
   * scherm wél volgt. Een gebruiker met "week begint op zondag" kreeg dus ISO-weeknummers op maandag
   * in de afdruk en Amerikaanse weeknummers op zondag op het scherm — hetzelfde project, twee
   * antwoorden.
   */
  weekStartDay?: 'monday' | 'sunday';
  /**
   * Aantal paginabreedtes waarover de tijdlijn in de export uitgesmeerd wordt (issue #25 punt 5).
   * Beïnvloedt alleen de auto-fit-zoom hieronder (bij een handmatige zoom bepaalt de gebruiker de
   * breedte al zelf); de feitelijke tegeling gebeurt in de pagineerder, die hetzelfde getal als
   * `timelineColumns` moet krijgen. Default 1 = oud gedrag (alles op één paginabreedte).
   */
  timelineColumns?: number;
  /**
   * Lettergrootte van het GEGENEREERDE RAPPORT als percentage (issue #25 punt 4). 100 (of
   * ontbrekend) = het oude gedrag, byte-identiek. Werkt bewust RELATIEF: tekst, rijhoogtes,
   * kopstroken en tabelbreedte schalen mee, de tijdlijn-zoom niet — zie de uitgebreide afleiding
   * bij {@link ReportMetrics}, want uniform schalen zou onder de fit-width-pagineerder niets doen.
   */
  reportFontScale?: number;
  /**
   * Ids van de BEPALENDE (driving) relaties uit de laatste CPM-run (issue #56). Zonder dit veld
   * tekent het rapport élke relatie neutraal doorgetrokken — exact het gedrag van vóór de fix, en
   * de eerlijke weergave zolang er niet gerekend is.
   *
   * WAAROM DIT DOOR MOET WORDEN GEGEVEN en niet uit de taken af te leiden is: "bepalend" is een
   * eigenschap van de RELATIE (relationship free float = 0), geen eigenschap van de twee taken.
   * Het is een `CPMResult`-veld dat bewust niet gepersisteerd wordt (ook niet in IFC), dus de enige
   * bron is de aanroeper die de store leest ({@link ReportPanel}).
   */
  drivingSequenceIds?: string[];
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
 * Teken een taaklabel. Dunne wrapper rond `fillText` die de uitlijning en kleur zet.
 *
 * Hier stond eerder een halo/knockout: een rechthoek in de papierkleur achter de tekst, zodat een
 * relatielijn die over een label loopt de tekst niet onleesbaar maakte. Die is er bewust weer uit
 * (review-ronde 2). Twee redenen. Ten eerste is hij overbodig geworden: de labels worden nu ná
 * `drawDependencies` getekend en liggen dus sowieso boven de lijnen — en in de vector-PDF stond
 * tekst altijd al boven alle vormen, want vormen gaan in het gedeelde Form-XObject en tekst wordt
 * daarná per tegel geëmit. Ten tweede kostte hij zichtbaar meer dan hij opleverde: per label werd
 * een strak wit blokje uit de weekend- en feestdagarcering en door de dag-rasterlijnen heen
 * gestanst, en dat waren er net zoveel als er taken zijn.
 */
function fillLabelText(
  d2d: Draw2D,
  text: string,
  x: number,
  y: number,
  align: 'left' | 'right',
  color: string,
): void {
  if (!text) return;
  d2d.fillStyle = color;
  d2d.textAlign = align;
  d2d.fillText(text, x, y);
}

/**
 * Teken een taaknaam-label bij een staaf (klachten 4b + 7). Probeert rechts van de staaf; loopt het
 * daar voorbij de canvasrand, dan wordt het links van de staaf getekend (rechts-uitgelijnd,
 * eindigend net vóór de staaf). Past het ook links niet, dan wordt het afgekort met '…' aan de kant
 * met de meeste ruimte. Zo valt een label nooit voorbij `canvasWidth` en overlapt het minder met
 * naburige staven.
 *
 * De labels worden bewust als laatste getekend (zie de tekenvolgorde in `renderReport`), zodat een
 * relatielijn die over een label loopt achter de tekst verdwijnt in plaats van erdoorheen.
 *
 * @param barRightX  x van de rechterrand van de staaf (incl. eventuele speling-indicator)
 * @param barLeftX   x van de linkerrand van de staaf
 * @param y          baseline-y voor de tekst (textBaseline blijft 'alphabetic')
 * @param fontSize   BASIS-fontgrootte (ongeschaald, zoals bij `m.font`); de helper schaalt zelf
 */
function drawBarLabel(
  d2d: Draw2D,
  m: ReportMetrics,
  name: string,
  barRightX: number,
  barLeftX: number,
  y: number,
  canvasWidth: number,
  color: string,
  fontSize: number,
  bold?: boolean,
) {
  const rightMargin = 10;
  d2d.font = m.font(fontSize, bold);
  d2d.fillStyle = color;
  d2d.textBaseline = 'alphabetic';
  // Rechts: voorbij de verticale knik van de EIGEN uitgaande relatie beginnen (`BAR_LABEL_GAP` >
  // `DEP_STUB`), links de kleine pad — daar vertrekt geen eigen relatie-knik (issue #25 punt 2).
  // Dat houdt het label vrij van z'n eigen lijn; lijnen van ANDERE relaties kunnen er nog steeds
  // overheen lopen, maar die verdwijnen achter de tekst omdat de labels als laatste getekend worden.
  //
  // `BAR_LABEL_GAP`/`BAR_LABEL_PAD_LEFT` schalen bewust NIET mee met de rapport-lettergrootte: de
  // gap bestaat alleen om vrij te blijven van de verticale relatie-knik, en die knik (`DEP_STUB`)
  // zit in de ongeschaalde chart-geometrie. Zou de gap wél meeschalen, dan verbrak dat de expliciete
  // koppeling `BAR_LABEL_GAP = DEP_STUB + 8` en schoof het label bij 125% nodeloos van z'n staaf af.
  const rightStart = barRightX + BAR_LABEL_GAP;
  const rightAvail = canvasWidth - rightMargin - rightStart;
  const leftEnd = barLeftX - BAR_LABEL_PAD_LEFT;
  const leftAvail = leftEnd - m.tableWidth; // chart begint bij de (geschaalde) tabelbreedte
  const textWidth = d2d.measureText(name).width;

  if (textWidth <= rightAvail) {
    fillLabelText(d2d, name, rightStart, y, 'left', color);
  } else if (textWidth <= leftAvail) {
    fillLabelText(d2d, name, leftEnd, y, 'right', color);
  } else if (rightAvail >= leftAvail) {
    fillLabelText(d2d, fitText(d2d, name, rightAvail), rightStart, y, 'left', color);
  } else {
    fillLabelText(d2d, fitText(d2d, name, leftAvail), leftEnd, y, 'right', color);
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
  /**
   * Hoogte (LOGISCHE/CSS-px, gemeten vanaf y = 0) van de kopstrook bovenaan de render: project-kop
   * + tijdschaal-kop. De pagineerders herhalen precies deze strook op elke pagina wanneer daarom
   * gevraagd wordt (issue #25 punt 1). Staat hier zodat de aanroeper de interne constanten van deze
   * module niet hoeft te kennen. 0 = geen herhaalbare kop (bv. de lege-project-render).
   */
  headerHeight: number;
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
  // Alle maatvoering loopt via dit object — de tekenhelpers lezen de module-constanten niet meer
  // rechtstreeks (zie {@link ReportMetrics} voor het waarom van relatief-schalen).
  const m = makeMetrics(options.reportFontScale);

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
    d2d.font = m.font(14);
    d2d.textAlign = 'center';
    d2d.fillText(options.labels?.noTasks ?? 'No tasks to display', 300, 100);
    // Geen kop-/tijdschaalstrook in de lege-staat (alleen een centrale melding) ⇒ niets te herhalen.
    // Het meldingsvak zelf houdt z'n vaste 600×200; alleen de tekst erin volgt de schaal.
    return { width: 600, height: 200, tableWidth: m.tableWidth, headerHeight: 0 };
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
  // Aantal paginabreedtes waarover de tijdlijn uitgesmeerd mag worden (issue #25 punt 5).
  const timelineColumns = Math.max(1, Math.floor(options.timelineColumns ?? 1));
  // Beschikbare chart-breedte over N papierbreedtes.
  //
  // AFLEIDING — de pagineerder tekent bij N fit-width-kolommen in totaal `canvasWidth +
  // (N-1)·tableWidth` bron-px (de naam-kolom wordt op elke volgende pagina herhaald) op N
  // paginabreedtes. Wil je dat die "virtuele" breedte precies N pagina's vult op ~1:1-schaal, dan:
  //     tableWidth + chartWidth + (N-1)·tableWidth = N·(paper.w - margins)
  //  ⇒  chartWidth = N·(paper.w - margins) - N·tableWidth = N·(paper.w - tableWidth - margins)
  // De N herhalingen van de naam-kolom zijn dus AL verrekend doordat we `tableWidth` binnen de
  // factor N aftrekken; er nog eens `tableWidth·(N-1)` bij optellen zou ze dubbel tellen en de
  // tijdlijn juist te breed (en dus na schaling te klein) maken. Bij N = 1 is dit exact de oude waarde.
  // `m.tableWidth` is de GESCHAALDE tabelbreedte: bij een grotere rapport-letter neemt de tabel meer
  // papier in en houdt de tijdlijn navenant minder over — precies de bedoelde ruil.
  const availableChartWidth = (paper.w - m.tableWidth - margins) * timelineColumns;

  let zoom: number;
  if (options.autoFit && totalDays > 0) {
    zoom = availableChartWidth / totalDays;
    // De klem blijft ONGESCHAALD: de tijdlijn-zoom (px per dag) is precies de maat die NIET meeschaalt,
    // anders zou het rapport uniform schalen en op papier niets veranderen (zie {@link ReportMetrics}).
    zoom = Math.max(5, Math.min(40, zoom));
  } else {
    zoom = options.customZoom || 22;
  }

  const chartWidth = totalDays * zoom;
  const canvasWidth = m.tableWidth + chartWidth;
  const canvasHeight = m.totalHeaderHeight + flatTasks.length * m.rowHeight + m.footerHeight;

  // T13 (§T2-afwijking, LAAG-7-afnemer): vóór deze taak bouwde deze functie een EIGEN holidaySet
  // en gebruikte ze `dow === 6 || dow === 7` als hardcoded weekend-check — beide genegeerd
  // `calendar.workingExceptions` volledig, dus een werkende zaterdag/uitzondering printte gewoon
  // als vrij. Eén `CalendarEngine`-instantie (dezelfde bron van waarheid als de solver/renderer)
  // vervangt beide: `isWorkDay` kent de volledige precedentie (workingExceptions > holidays >
  // workDays), en `isHoliday` blijft apart om holiday- en weekend-shading visueel te onderscheiden
  // (rood vs. grijs, ongewijzigd t.o.v. vóór deze taak). Byte-identiek zonder workingExceptions:
  // `isWorkDay`/`isHoliday` herberekenen exact dezelfde holidaySet/workDays-uitkomst als de oude
  // ad-hoc logica hierboven.
  const calEngine = new CalendarEngine(calendar);

  // Verkrijg de Draw2D-backend zodra de logische afmetingen bekend zijn (canvas-backend neemt de
  // dpr-scale + maat-setup over; vector-backend werkt 1:1 in logische px).
  const d2d = makeDraw2D(canvasWidth, canvasHeight);

  // Helper: date to X. Gedeeld met GanttRenderer/HistogramRenderer via `timeAxis.dateToX`
  // (issue #21 punt 5, fase 0-consolidatie); print heeft geen scrollX ⇒ `scrollX=0`. `minDate`/
  // `date` komen hier altijd uit `parseDate` (middernacht UTC), dus de fractionele
  // `daysFromStart`-berekening in `axisDateToX` is voor print altijd een geheel getal — identiek
  // aan de vroegere `diffCalendarDays(minDate, date) * zoom` (die intern ook afrondt, maar op een
  // al-geheel verschil is dat een no-op).
  const dateToX = (date: Date) => axisDateToX(date, minDate, m.tableWidth, zoom, 0);
  const chartTop = m.totalHeaderHeight;
  const chartBottom = canvasHeight - m.footerHeight;
  const rowToY = (i: number) => m.totalHeaderHeight + i * m.rowHeight;

  const cols = m.cols;

  // ==================== DRAW ====================

  // Background
  d2d.fillStyle = PRINT_COLORS.bg;
  d2d.fillRect(0, 0, canvasWidth, canvasHeight);

  // ---- PROJECT HEADER BOX ----
  drawProjectHeader(d2d, m, canvasWidth, projectName, options);

  // ---- GANTT CHART AREA ----

  // Grid background - weekend/holiday shading. T13: via CalendarEngine (zie de moduleuitleg
  // hierboven bij `calEngine`) — een werkende uitzondering (bv. een ingeroosterde zaterdag) is
  // hierdoor géén van beide meer en print dus ongeschaduwd, zoals elke gewone werkdag.
  if (options.showWeekends) {
    for (let i = 0; i < totalDays; i++) {
      const date = addCalendarDays(minDate, i);
      const x = dateToX(date);
      const dateStr = formatDate(date);
      const isWorkDay = calEngine.isWorkDay(date);
      const isHoliday = !isWorkDay && calEngine.isHoliday(dateStr);
      const isWeekend = !isWorkDay && !isHoliday;

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
      d2d.fillRect(m.tableWidth, rowToY(i), chartWidth, m.rowHeight);
    }
  }

  // Vertical grid lines
  for (let i = 0; i < totalDays; i++) {
    const date = addCalendarDays(minDate, i);
    const x = dateToX(date);
    const dow = isoDayOfWeek(date);

    d2d.strokeStyle = PRINT_COLORS.grid;
    // K-item 39: de zwaardere weeklijn valt op de INGESTELDE eerste dag van de week, net als op het
    // scherm (`GanttRenderer`: `dayOfWeek === (weekStartDay === 'sunday' ? 7 : 1)`).
    d2d.lineWidth = dow === (options.weekStartDay === 'sunday' ? 7 : 1) ? 0.8 : 0.2;
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
    d2d.moveTo(m.tableWidth, y);
    d2d.lineTo(canvasWidth, y);
    d2d.stroke();
  }

  // Today line
  //
  // Alleen de LIJN wordt hier getekend; het bijbehorende label hoort in de kopstrook en wordt
  // daarom door `drawTimelineHeader` gezet (zie de uitleg daar). Dat is geen cosmetische
  // herschikking maar een bugfix: dit blok loopt vóór `drawTimelineHeader`, en die schildert als
  // eerste zijn hele kopstrook-band over — een label op `chartTop - …` werd in de RASTER-preview
  // dus gewoon weggepoetst. In de VECTOR-PDF gebeurde dat níét (tekst staat daar altijd boven alle
  // vormen, zie `PdfVectorDraw2D.operators` vs `.texts`), zodat preview en export uit elkaar liepen
  // en het label in de PDF bovendien pal op het dagcijfer van vandaag landde.
  const today = new Date();
  const todayX = dateToX(today);
  const todayVisible = todayX > m.tableWidth && todayX < canvasWidth;
  if (todayVisible) {
    d2d.strokeStyle = PRINT_COLORS.today;
    d2d.lineWidth = 1.5;
    d2d.setLineDash([5, 3]);
    d2d.beginPath();
    d2d.moveTo(todayX, chartTop);
    d2d.lineTo(todayX, chartBottom);
    d2d.stroke();
    d2d.setLineDash([]);
  }

  // Task bars
  const barHeight = m.rowHeight * 0.55;
  const barOffset = (m.rowHeight - barHeight) / 2;

  // De taaknaam-labels worden hier alleen VERZAMELD en pas ná de relatiepijlen getekend — zie de
  // uitleg bij `drawDependencies` verderop. Eén job per label; de geometrie is op dat moment al
  // uitgerekend, dus uitstellen kost niets.
  interface BarLabelJob {
    name: string;
    /** x van de rechterrand van de staaf/ruit (incl. eventuele speling-indicator). */
    barRightX: number;
    /** x van de linkerrand van de staaf/ruit. */
    barLeftX: number;
    /** baseline-y van de tekst. */
    y: number;
    /** Vetgedrukt (alleen samenvattingstaken). */
    bold: boolean;
  }
  const barLabelJobs: BarLabelJob[] = [];

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
        barLabelJobs.push({ name: task.name, barRightX: x + size, barLeftX: x - size, y: cy + m.s(3), bold: false });
      }
    } else if (isSummaryTask(task)) {
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
        barLabelJobs.push({ name: task.name, barRightX: x1 + width, barLeftX: x1, y: y + barHeight / 2 + m.s(3), bold: true });
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

      // Z15 (O5-besluit, plan-§10): een ECHTE split (`Task.splitGaps`) tekent ALTIJD gesplitst —
      // geen weergave-instelling betrokken hier (printPreview kent `barSplitMode`/kalender-necking
      // sowieso niet, dat is puur een GanttRenderer-ding). `computeSplitSegments` (gedeeld met
      // GanttRenderer, `splitBarGeometry.ts`) wandelt met `calEngine`; printPreview kent geen
      // uur-modus (zie de moduleuitleg bij het `parseDate`-gebruik hierboven — alle datums hier
      // komen uit `parseDate`, nooit `parseInstant`), dus `hourMode=false` altijd.
      const segments = task.splitGaps && task.splitGaps.length > 0
        ? computeSplitSegments(task.splitGaps, start, end, false, calEngine)
        : [{ start, end }];
      // Eerste/laatste grens hergebruikt de AL BEKENDE volle-extent `x1`/`x2` (dragen de "+zoom voor
      // de inclusieve laatste dag"-correctie al); tussengrenzen zijn EXCLUSIEF (zie
      // `computeSplitSegments`), dus zuiver `dateToX(...)` — zelfde redenering als GanttRenderer.
      const segs = segments.map((s, i) => ({
        x1: i === 0 ? x1 : dateToX(s.start),
        x2: i === segments.length - 1 ? x2 : dateToX(s.end),
      }));
      const split = segs.length > 1;

      // Necking-connector door de gaten (dunne lijn op halve hoogte) — puur weergave, zelfde
      // conventie als GanttRenderer's necking-connector. Draw2D kent geen `globalAlpha`
      // (canvas-only), dus de "halftransparant"-indruk komt hier uit een hex-alpha-suffix op de
      // kleur (`+'80'`, zelfde patroon als de float-indicator hierboven met `+'40'`), niet uit een
      // stateful alpha-property.
      if (split) {
        d2d.strokeStyle = color + '80';
        d2d.lineWidth = 1;
        d2d.beginPath();
        d2d.moveTo(segs[0].x2, y + barHeight / 2);
        d2d.lineTo(segs[segs.length - 1].x1, y + barHeight / 2);
        d2d.stroke();
      }

      // Main bar with rounded corners — per segment (één segment ⇒ ongesplitst, ongewijzigd gedrag).
      for (const s of segs) {
        const sw = Math.max(s.x2 - s.x1, split ? 2 : 3);
        d2d.fillStyle = color;
        d2d.beginPath();
        d2d.roundRect(s.x1, y, sw, barHeight, 3);
        d2d.fill();
      }

      // Completion overlay (darker shade) — GLOBALE voortgangsgrens (`progressEnd`, over de volle
      // `[x1,x2]`-breedte berekend, ná de eventuele split), niet per segment opnieuw: zelfde
      // continuïteitsregel als GanttRenderer.drawTaskBar (Z15-acceptatiepunt 4).
      if (options.showCompletion && task.time.completion > 0) {
        const progressEnd = x1 + width * task.time.completion;
        d2d.fillStyle = isCritical ? PRINT_COLORS.criticalDark : PRINT_COLORS.normalDark;
        for (const s of segs) {
          const sw = Math.max(s.x2 - s.x1, split ? 2 : 3);
          if (progressEnd > s.x1) {
            const pw = Math.min(s.x1 + sw, progressEnd) - s.x1;
            if (pw > 0) {
              d2d.beginPath();
              d2d.roundRect(s.x1, y, pw, barHeight, 3);
              d2d.fill();
            }
          }
        }
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
        barLabelJobs.push({ name: task.name, barRightX, barLeftX: x1, y: y + barHeight / 2 + m.s(3), bold: false });
      }
    }
  }

  // ---- TEKENVOLGORDE IN HET CHART-GEBIED: staven → relatiepijlen → taaklabels ----
  //
  // 1. Relatiepijlen ná de staven (issue #25 punt 3). Stonden ze ervóór, dan schilderde elke balk
  //    die een lijn kruist die lijn gewoon weg; nu liggen de lijnen bovenop en zijn ze altijd
  //    zichtbaar.
  // 2. Maar de taaklabels moeten wéér boven de lijnen. Hier stond eerder de redenering dat dat niet
  //    hoefde omdat een label dankzij `BAR_LABEL_GAP` pas voorbij de verticale knik begint — dat
  //    argument gaat alleen op voor de knik van de EIGEN voorganger. Een relatie tussen twee heel
  //    andere taken (t1 → t3) knikt verticaal dwars door de rij van t2 heen en streepte het label
  //    van t2 zo doormidden. Daarom worden de labels nu als LAATSTE getekend: de tekst wint van de
  //    lijn, de lijn blijft zichtbaar overal waar geen tekst staat.
  //
  // Let op wat dit per backend betekent. In de vector-PDF — het primaire exportpad — stond tekst
  // altijd al boven alle vormen (vormen gaan in het gedeelde Form-XObject, tekst wordt daarná per
  // tegel geëmit), dus daar was dit nooit stuk. De omkering repareert dus feitelijk de RASTER-preview
  // en brengt die in lijn met wat de export altijd al deed — wat precies de bedoeling is, want die
  // twee horen WYSIWYG te zijn.
  if (options.showDeps) {
    drawDependencies(d2d, m, flatTasks, sequences, dateToX, rowToY, zoom, options);
  }

  for (const job of barLabelJobs) {
    drawBarLabel(d2d, m, job.name, job.barRightX, job.barLeftX, job.y, canvasWidth, PRINT_COLORS.text, 9, job.bold);
  }

  // ---- TIMELINE HEADER ----
  drawTimelineHeader(d2d, m, canvasWidth, minDate, totalDays, zoom, dateToX, options, todayVisible ? todayX : null);

  // ---- TASK TABLE ----
  drawTaskTable(d2d, m, flatTasks, depthMap, canvasHeight, cols, options);

  // ---- FOOTER ----
  drawFooter(d2d, m, canvasWidth, canvasHeight, projectName, options);

  // Tabelbreedte en kophoogte gaan GESCHAALD terug: de pagineerder bevriest exact deze kolom en
  // herhaalt exact deze strook per pagina, dus die moeten de rapport-lettergrootte volgen.
  return { width: canvasWidth, height: canvasHeight, tableWidth: m.tableWidth, headerHeight: m.totalHeaderHeight };
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
  m: ReportMetrics,
  canvasWidth: number,
  projectName: string,
  options: PrintOptions,
) {
  const hh = m.projectHeaderHeight;
  // De regel-y's en de horizontale pad schalen mee met de strookhoogte; bleven ze vast, dan zouden
  // de drie regels bij 125% over elkaar heen lopen (regelafstand 14 px bij een 11,25 px-letter).
  const pad = m.s(10);

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
  d2d.font = m.font(8);
  d2d.textBaseline = 'middle';
  d2d.textAlign = 'right';
  d2d.fillText(brandText, canvasWidth - pad, m.s(16));
  const brandWidth = d2d.measureText(brandText).width;

  // Project name (large, bold) — inkorten zodat hij niet tot in de branding loopt
  d2d.fillStyle = PRINT_COLORS.text;
  d2d.font = m.font(14, true);
  d2d.textBaseline = 'middle';
  d2d.textAlign = 'left';
  const nameMaxW = (canvasWidth - pad - brandWidth - m.s(12)) - pad;
  d2d.fillText(fitText(d2d, projectName, nameMaxW), pad, m.s(16));

  // Row 2: Company | Author | Print date | Version
  d2d.font = m.font(9);
  d2d.fillStyle = PRINT_COLORS.textSecondary;
  const row2Y = m.s(34);
  const rowMaxW = canvasWidth - 2 * pad; // binnen de paginabreedte houden (klacht 7)

  const companyLabel = options.companyName || '';
  const authorLabel = options.projectAuthor || '';
  const printLocale = options.locale ?? 'nl';
  const printDate = new Date().toLocaleDateString(printLocale, { day: '2-digit', month: 'long', year: 'numeric' });

  let row2Text = '';
  if (companyLabel) row2Text += companyLabel;
  if (authorLabel) row2Text += (row2Text ? '  |  ' : '') + authorLabel;
  row2Text += (row2Text ? '  |  ' : '') + `${options.labels?.printed ?? 'Printed:'} ${printDate}`;

  d2d.fillText(fitText(d2d, row2Text, rowMaxW), pad, row2Y);

  // Row 3: Project dates and duration
  const row3Y = m.s(48);
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

  d2d.fillText(fitText(d2d, row3Text, rowMaxW), pad, row3Y);

  d2d.textAlign = 'left';
  d2d.textBaseline = 'alphabetic';
}


/** De gereserveerde plek van het vandaag-label in de onderste regel van de kopstrook. */
interface TodayLabelBox {
  text: string;
  /** Horizontaal middelpunt waarop het label wordt gecentreerd (geklemd binnen het chartgebied). */
  cx: number;
  /** Gereserveerde x-band; dagcijfers die hierin vallen worden niet getekend. */
  left: number;
  right: number;
}

/**
 * Bepaal of en waar het vandaag-label past. Levert `null` wanneer er geen vandaag-lijn is óf het
 * label niet binnen het chartgebied past — dan valt het label weg in plaats van over de tijdschaal
 * of over de bevroren tabelkolom te lopen.
 *
 * Alle maten lopen via {@link ReportMetrics}, dus dit klopt bij elke papiermaat en elke
 * rapport-lettergrootte. De breedte komt uit `measureText`, waardoor het net zo goed werkt voor het
 * korte `今日` als voor het lange `Aujourd'hui` — en voor RTL (`اليوم`, `امروز`), want de
 * centrering is symmetrisch en beide backends meten de geshapte tekst.
 */
function reserveTodayLabel(
  d2d: Draw2D,
  m: ReportMetrics,
  canvasWidth: number,
  options: PrintOptions,
  todayX: number | null,
): TodayLabelBox | null {
  if (todayX === null) return null;
  const text = options.labels?.today ?? 'Vandaag';
  d2d.font = m.font(7, true);
  // Halve labelbreedte plus wat lucht, zodat een overgeslagen dagcijfer niet tegen het label plakt.
  const half = d2d.measureText(text).width / 2 + m.s(3);
  const min = m.tableWidth + half;
  const max = canvasWidth - half;
  if (max < min) return null;   // chartgebied smaller dan het label zelf ⇒ niets tekenen
  const cx = Math.min(Math.max(todayX, min), max);
  return { text, cx, left: cx - half, right: cx + half };
}

/**
 * Draw the timeline header with month/week/day rows.
 *
 * @param todayX  x van de vandaag-lijn, of `null` als die buiten het chartgebied valt. Het
 *                vandaag-LABEL wordt hier getekend en niet bij de lijn zelf — zie {@link TodayLabelBox}.
 */
function drawTimelineHeader(
  d2d: Draw2D,
  m: ReportMetrics,
  canvasWidth: number,
  minDate: Date,
  totalDays: number,
  zoom: number,
  dateToX: (d: Date) => number,
  options: PrintOptions,
  todayX: number | null,
) {
  const top = m.projectHeaderHeight;
  const h = m.timelineHeaderHeight;
  const monthRowH = h / 2;
  const weekRowH = h / 2;

  // Het vandaag-label deelt de onderste regel van de kopstrook met de dagcijfers, en krijgt exact
  // dezelfde baseline/lettergrootte-band als die cijfers. Het wordt daarom hier gereserveerd vóór
  // de dag-lus: elk dagcijfer dat binnen deze box valt, wordt overgeslagen.
  //
  // Waarom wegLATEN en niet met een dekkend vlakje overschilderen? Omdat dat in de vector-PDF
  // principieel niet kan: vormen gaan in het gedeelde Form-XObject en ALLE tekst wordt daarná
  // geëmit (`PdfVectorDraw2D.operators` vs `.texts`), dus een rechthoek belandt altijd ONDER de
  // dagcijfers. Alleen een geometrische oplossing landt identiek in beide backends — en het is
  // bovendien hetzelfde idioom dat de maand-/weeklabels hieronder al hanteren (klacht 7): liever
  // een gat dan tekst over tekst.
  const todayLabel = reserveTodayLabel(d2d, m, canvasWidth, options, todayX);

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
  d2d.moveTo(m.tableWidth, top + monthRowH);
  d2d.lineTo(canvasWidth, top + monthRowH);
  d2d.stroke();

  const months = options.localizedMonths ?? ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

  // K-item 39: dezelfde weekdefinitie als het scherm. `weekStartDay` bepaalt zowel het NUMMER
  // (ISO wanneer maandag, Amerikaans wanneer zondag) als de dag waarop het label begint.
  const wsd = options.weekStartDay ?? 'monday';
  const weekStartDow = wsd === 'sunday' ? 7 : 1;

  let lastMonth = -1;
  let lastWeek = -1;
  // Rechterrand (x) van het laatst getekende maand-/weeklabel, om overlap te vermijden (klacht 7).
  let lastMonthLabelRight = -Infinity;
  let lastWeekLabelRight = -Infinity;

  for (let i = 0; i < totalDays; i++) {
    const date = addCalendarDays(minDate, i);
    const x = dateToX(date);
    const month = date.getUTCMonth();
    const weekNum = getWeekNumberFor(date, wsd);
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
      // Label-offsets/-tussenruimtes horen bij de TEKST en schalen dus mee.
      d2d.font = m.font(10, true);
      const monthLabelStart = x + m.s(4);
      if (monthLabelStart >= lastMonthLabelRight + m.s(6)) {
        d2d.fillStyle = PRINT_COLORS.text;
        d2d.textBaseline = 'middle';
        d2d.textAlign = 'left';
        d2d.fillText(label, monthLabelStart, top + monthRowH / 2);
        lastMonthLabelRight = monthLabelStart + d2d.measureText(label).width;
      }
    }

    // Week headers
    if (dow === weekStartDow && weekNum !== lastWeek) {
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
      const weekLabelStart = x + m.s(2);
      d2d.font = m.font(9);
      if (weekLabelStart >= lastWeekLabelRight + m.s(4)) {
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
        d2d.font = m.font(7);
        d2d.textAlign = 'center';
        d2d.textBaseline = 'bottom';
        const dayCx = x + zoom / 2;
        // Overlapt dit cijfer de gereserveerde band van het vandaag-label, dan laten we het weg
        // (het label benoemt die dag toch al). Box-tegen-box, dus ook een breed tweecijferig
        // getal op de rand valt correct af.
        const dayHalf = d2d.measureText(String(dayNum)).width / 2;
        const clash = todayLabel !== null
          && dayCx + dayHalf > todayLabel.left
          && dayCx - dayHalf < todayLabel.right;
        if (!clash) {
          d2d.fillText(String(dayNum), dayCx, top + h - m.s(1));
        }
      }
    }
  }

  // Het vandaag-label, op exact de baseline en in exact de band van de dagcijfers die hierboven
  // voor hem zijn weggelaten. `textBaseline` wordt expliciet gezet: bij lage zoom tekent de
  // dag-lus niets en zou hij anders de 'middle' van de weeklabels erven.
  if (todayLabel) {
    d2d.fillStyle = PRINT_COLORS.today;
    d2d.font = m.font(7, true);
    d2d.textAlign = 'center';
    d2d.textBaseline = 'bottom';
    d2d.fillText(todayLabel.text, todayLabel.cx, top + h - m.s(1));
  }

  // Table header area (left side of timeline header)
  d2d.fillStyle = PRINT_COLORS.headerBg;
  d2d.fillRect(0, top, m.tableWidth, h);

  // Table column headers
  const cols = m.cols;
  d2d.fillStyle = PRINT_COLORS.text;
  d2d.font = m.font(9, true);
  d2d.textBaseline = 'middle';
  d2d.textAlign = 'center';
  const headerY = top + h / 2;

  const th = options.labels?.tableHeaders;
  d2d.fillText(th?.rowNum ?? '#', cols.rowNum.x + cols.rowNum.w / 2, headerY);
  d2d.fillText(th?.wbs ?? 'WBS', cols.wbs.x + cols.wbs.w / 2, headerY);

  d2d.textAlign = 'left';
  d2d.fillText(th?.taskName ?? 'Taaknaam', cols.name.x + m.s(4), headerY);

  d2d.textAlign = 'center';
  d2d.fillText(th?.duration ?? 'Duur', cols.duration.x + cols.duration.w / 2, headerY);
  d2d.fillText(th?.start ?? 'Start', cols.start.x + cols.start.w / 2, headerY);
  d2d.fillText(th?.end ?? 'Einde', cols.end.x + cols.end.w / 2, headerY);
  d2d.fillText(th?.completion ?? 'Volt.', cols.complete.x + cols.complete.w / 2, headerY);

  // Column separator lines in header
  d2d.strokeStyle = PRINT_COLORS.border;
  d2d.lineWidth = 0.5;
  const colBorders = [cols.wbs.x, cols.name.x, cols.duration.x, cols.start.x, cols.end.x, cols.complete.x, m.tableWidth];
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
  d2d.lineTo(m.tableWidth, top + h);
  d2d.stroke();

  d2d.textBaseline = 'alphabetic';
  d2d.textAlign = 'left';
}


/** Draw the task table (left side) */
function drawTaskTable(
  d2d: Draw2D,
  m: ReportMetrics,
  flatTasks: PrintTask[],
  depthMap: Map<string, number>,
  canvasHeight: number,
  cols: ColPositions,
  options: PrintOptions,
) {
  const chartBottom = canvasHeight - m.footerHeight;
  // Cel-padding: schaalt mee met de kolombreedtes, anders vreet een grotere letter de padding op.
  const cellPad = m.s(4);

  // Table background
  d2d.fillStyle = PRINT_COLORS.bg;
  d2d.fillRect(0, m.totalHeaderHeight, m.tableWidth, chartBottom - m.totalHeaderHeight);

  // Task rows
  for (let i = 0; i < flatTasks.length; i++) {
    const task = flatTasks[i];
    const y = m.totalHeaderHeight + i * m.rowHeight;
    const depth = depthMap.get(task.id) || 0;
    const textY = y + m.rowHeight / 2;
    // Inspringing per hiërarchieniveau schaalt mee: de naamkolom is breder geworden, dus een vaste
    // 12 px zou de boomstructuur bij een grote letter optisch platslaan.
    const indent = depth * m.s(12);
    const isSummary = isSummaryTask(task);

    // Alternating row background
    if (i % 2 === 0) {
      d2d.fillStyle = PRINT_COLORS.rowEven;
      d2d.fillRect(0, y, m.tableWidth, m.rowHeight);
    }

    // Row border
    d2d.strokeStyle = PRINT_COLORS.grid;
    d2d.lineWidth = 0.3;
    d2d.beginPath();
    d2d.moveTo(0, y + m.rowHeight);
    d2d.lineTo(m.tableWidth, y + m.rowHeight);
    d2d.stroke();

    // Row number
    d2d.fillStyle = PRINT_COLORS.textSecondary;
    d2d.font = m.font(8);
    d2d.textAlign = 'right';
    d2d.textBaseline = 'middle';
    d2d.fillText(String(i + 1), cols.rowNum.x + cols.rowNum.w - cellPad, textY);

    // WBS
    d2d.fillStyle = PRINT_COLORS.textSecondary;
    d2d.font = m.font(8);
    d2d.textAlign = 'left';
    d2d.fillText(task.wbsCode || '', cols.wbs.x + cellPad, textY);

    // Name with indentation — afkorten met ellipsis i.p.v. hard clippen (klacht 4a)
    d2d.fillStyle = isSummary ? PRINT_COLORS.summary : PRINT_COLORS.text;
    d2d.font = m.font(9, isSummary);
    d2d.textAlign = 'left';
    const nameX = cols.name.x + cellPad + indent;
    const nameAvail = cols.name.x + cols.name.w - m.s(2) - nameX; // kleine padding vóór de kolomrand
    d2d.fillText(fitText(d2d, task.name, nameAvail), nameX, textY);

    // Duration
    d2d.fillStyle = PRINT_COLORS.textSecondary;
    d2d.font = m.font(8);
    d2d.textAlign = 'right';
    d2d.textBaseline = 'middle';
    d2d.fillText(formatDuration(task.time.scheduleDuration), cols.duration.x + cols.duration.w - cellPad, textY);

    // Start date
    const startStr = task.time.earlyStart || task.time.scheduleStart;
    if (startStr) {
      const sd = parseDate(startStr);
      d2d.fillText(formatDutchDate(sd, options.dateNotation), cols.start.x + cols.start.w - cellPad, textY);
    }

    // End date
    const endStr = task.time.earlyFinish || task.time.scheduleFinish;
    if (endStr) {
      const ed = parseDate(endStr);
      d2d.fillText(formatDutchDate(ed, options.dateNotation), cols.end.x + cols.end.w - cellPad, textY);
    }

    // Completion
    if (options.showCompletion) {
      d2d.fillText(formatCompletion(task.time.completion), cols.complete.x + cols.complete.w - cellPad, textY);
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
    d2d.moveTo(cx, m.totalHeaderHeight);
    d2d.lineTo(cx, chartBottom);
    d2d.stroke();
  }

  // Table right border (thick)
  d2d.strokeStyle = PRINT_COLORS.borderDark;
  d2d.lineWidth = 1;
  d2d.beginPath();
  d2d.moveTo(m.tableWidth, m.projectHeaderHeight);
  d2d.lineTo(m.tableWidth, chartBottom);
  d2d.stroke();

  // Table left border
  d2d.beginPath();
  d2d.moveTo(0, m.projectHeaderHeight);
  d2d.lineTo(0, chartBottom);
  d2d.stroke();
}


/**
 * Teken de relatielijnen met pijlpunt.
 *
 * ==== KLEUR EN LIJNSTIJL (issue #56) ====
 * Het rapport zette hier één vaste grijze kleur BUITEN de lus en riep `setLineDash` nooit aan,
 * terwijl het scherm (`GanttRenderer.drawDependencyArrows`) de P6-conventie hanteert die elke
 * planner direct leest: doorgetrokken = bepalend (driving, bindt de opvolger), gestreept =
 * niet-bepalend, en rood wanneer een BEPALENDE relatie twee kritieke taken verbindt. Een export
 * waarin die betekenis wegvalt is geen cosmetisch verschil maar informatieverlies — precies de
 * klacht. Deze functie spiegelt de schermbeslissing nu regel voor regel.
 *
 * Drie bewuste afwijkingen van het scherm, elk met een reden:
 *  1. GRIJSTINT. Papier vraagt een lichtere neutrale lijn dan een beeldscherm; `PRINT_PALETTE`
 *     houdt daarom bewust `#9CA3AF` waar het schermpalet `#6B7280` gebruikt (zie de waarschuwing
 *     bovenin themePalette.ts). Alleen het KRITIEK-rood is in beide paletten dezelfde merk-hex.
 *  2. `options.showCritical`. Zet de gebruiker "kritiek pad tonen" uit, dan tekent de balklaag
 *     hierboven ook de kritieke taken neutraal blauw; rode lijnen tussen blauwe balken zou een
 *     kritiek pad tonen dat de gebruiker net heeft uitgezet.
 *  3. TRACE-DIMMING wordt NIET overgenomen: dat is interactieve state (het gedimd tonen van alles
 *     buiten een aangeklikt pad) waar een statisch papieren rapport niets aan heeft.
 *
 * ==== RELATIETYPE ====
 * De lus las `seq.type` helemaal niet en tekende élke relatie als FS (vanaf de VOORGANGER-FINISH).
 * Een SS-relatie kwam daardoor uit de verkeerde balkrand — een feitelijk onjuiste export, geen
 * cosmetiek. De ankerpunten volgen nu dezelfde logica als het scherm, inclusief de uitloop-
 * RICHTING: bij SS ankert de lijn op de LINKERrand van de voorganger en moet de stub dus naar
 * LINKS weglopen, anders begint de lijn ín de balk. Issue #59 breidt dat uit naar FF/SF: die
 * ankerten vroeger op de opvolger-START (de `default`-tak kende alleen FS/SS); nu landt de pijl
 * op de opvolger-FINISH (rechterrand) en wijst de kop naar links, met een gespiegelde inlooproute.
 *
 * De obstakel-routering van het scherm (kolomvrij-detectie, goot-trap om tussenliggende balken
 * heen) is bewust NIET overgenomen: het scherm tekent zijn pijlen ÓNDER de balken en heeft die
 * omweg nodig om ze zichtbaar te houden, het rapport tekent ze erBOVEN (zie de tekenvolgorde in
 * `renderReport`) — daar bestaat het occlusieprobleem niet.
 */
function drawDependencies(
  d2d: Draw2D,
  m: ReportMetrics,
  flatTasks: PrintTask[],
  sequences: Sequence[],
  dateToX: (d: Date) => number,
  rowToY: (i: number) => number,
  zoom: number,
  options: PrintOptions,
) {
  d2d.lineWidth = 1.2;

  // `null` = er is niet gerekend (of de aanroeper geeft het niet door) ⇒ alles neutraal
  // doorgetrokken, exact het gedrag van vóór issue #56. Zelfde semantiek als op het scherm.
  const drivingSet = options.drivingSequenceIds ? new Set(options.drivingSequenceIds) : null;

  for (const seq of sequences) {
    const predIdx = flatTasks.findIndex(t => t.id === seq.predecessorId);
    const succIdx = flatTasks.findIndex(t => t.id === seq.successorId);
    if (predIdx < 0 || succIdx < 0) continue;

    const pred = flatTasks[predIdx];
    const succ = flatTasks[succIdx];
    const predY = rowToY(predIdx) + m.rowHeight / 2;
    const succY = rowToY(succIdx) + m.rowHeight / 2;

    // Kleur + lijnstijl per relatie (issue #56) — zie de blokuitleg boven deze functie.
    const isDriving = drivingSet ? drivingSet.has(seq.id) : true;
    const isCriticalLink = drivingSet !== null && isDriving
      && options.showCritical && pred.time.isCritical && succ.time.isCritical;
    const color = isCriticalLink ? PRINT_COLORS.critical : PRINT_COLORS.dependency;
    d2d.strokeStyle = color;
    d2d.fillStyle = color;
    // Het streepjespatroon schaalt mee met de rapport-lettergrootte. Op papier is dat het verschil
    // tussen "streepjes die net zo fijn blijven terwijl alles eromheen groeit" en een lijnstijl die
    // op elke schaal even leesbaar is: de pagineerder schaalt de bron met `printW / canvasWidth`, en
    // die noemer is bij fit-width juist ONafhankelijk van de lettergrootte (`canvasWidth` =
    // `m.tableWidth + chartWidth` = `paper.w - margins`, want de tijdlijn krimpt precies zoveel als
    // de tabel groeit). Ongeschaald zou het patroon dus bij 90% én 125% dezelfde fysieke maat op
    // papier houden terwijl de rijhoogte en de tekst wél meebewegen. Papierformaat vraagt geen
    // compensatie: A4 en A1 krijgen allebei dezelfde 96dpi→pt-factor 0,75 (gemeten, zie de
    // regressiebatterij `check-dependency-style.ts`).
    d2d.setLineDash(isDriving ? [] : [m.s(4), m.s(3)]);

    // Ankerpunten + looprichtingen per relatietype (issue #59: FF/SF landden vroeger op de
    // opvolger-START doordat de `default`-tak ze als FS behandelde — spiegel van het scherm).
    //   predStart  (voorganger-anker = start/linkerrand): SS, SF
    //   succFinish (opvolger-anker  = finish/rechterrand): FF, SF
    let fromX: number;
    let toX: number;
    const predStart = seq.type === 'START_START' || seq.type === 'START_FINISH';
    const succFinish = seq.type === 'FINISH_FINISH' || seq.type === 'START_FINISH';
    if (predStart) {
      fromX = dateToX(parseDate(pred.time.earlyStart || pred.time.scheduleStart));
    } else {
      fromX = dateToX(parseDate(pred.time.earlyFinish || pred.time.scheduleFinish)) + zoom;
    }
    if (succFinish) {
      toX = dateToX(parseDate(succ.time.earlyFinish || succ.time.scheduleFinish)) + zoom;
    } else {
      toX = dateToX(parseDate(succ.time.earlyStart || succ.time.scheduleStart));
    }
    // dirOut = uitlooprichting bij de voorganger (weg van de balk); dirIn = aankomstkant bij de
    // opvolger: start-anker (FS/SS) komt van LINKS (−1, kop wijst naar rechts); finish-anker
    // (FF/SF) van RECHTS (+1, kop wijst naar links).
    const dirOut = predStart ? -1 : 1;
    const dirIn = succFinish ? 1 : -1;

    // De verticale knik naast de VOORGANGER (`outX`) ligt aan de uitloopkant; het inlooppunt
    // naast de OPVOLGER aan de aankomstkant — onafhankelijk van het relatietype.
    const outX = fromX + dirOut * DEP_STUB;

    // Twee routes (issue #25 punt 3):
    //  - VOORWAARTS (`toX >= outX + DEP_STUB`): de opvolger begint ruim rechts van de knik, dus de
    //    klassieke route volstaat — stukje rechtdoor, verticale knik, dan rechtdoor de opvolger-balk
    //    in. Bij FS/FF/SF is deze voorwaarde exact de oude `toX >= fromX + 2*DEP_STUB`.
    //  - TERUGWAARTS: de opvolger begint links van waar de lijn uitkomt. Het horizontale segment zou
    //    dan op `succY` achteruit dwars DOOR de opvolger-balk lopen. In plaats daarvan gaan we
    //    "omheen" via de rijgoot: de horizontale scheiding tussen twee rijen (bovenrand van de
    //    opvolger-rij als die eronder ligt, onderrand als hij erboven ligt), een paar px de rij in
    //    zodat de lijn nét naast de rasterlijn valt.
    d2d.beginPath();
    // Voorwaarts (knik volstaat) als `outX` ruim buiten de opvolgerbalk ligt aan de aankomstkant:
    // bij start-aankomst (dirIn −1) rechts ervan, bij finish-aankomst (dirIn +1) links ervan.
    if ((outX - toX) * dirIn >= DEP_STUB) {
      d2d.moveTo(fromX, predY);
      d2d.lineTo(outX, predY);
      d2d.lineTo(outX, succY);
      d2d.lineTo(toX, succY);
    } else {
      const gutterInset = 2;
      const gutterY = succIdx > predIdx
        ? rowToY(succIdx) + gutterInset            // opvolger eronder ⇒ goot = bovenrand opvolger-rij
        : rowToY(succIdx) + m.rowHeight - gutterInset; // opvolger erboven ⇒ goot = onderrand opvolger-rij
      const inX = toX + dirIn * DEP_STUB;
      d2d.moveTo(fromX, predY);
      d2d.lineTo(outX, predY);
      d2d.lineTo(outX, gutterY);
      d2d.lineTo(inX, gutterY);
      d2d.lineTo(inX, succY);
      d2d.lineTo(toX, succY);
    }
    d2d.stroke();

    // Arrowhead (filled triangle) — een `fill` negeert het dash-patroon, dus ook een niet-bepalende
    // relatie houdt een massieve pijlpunt (net als op het scherm).
    d2d.beginPath();
    d2d.moveTo(toX, succY);
    d2d.lineTo(toX + dirIn * 5, succY - 3);
    d2d.lineTo(toX + dirIn * 5, succY + 3);
    d2d.closePath();
    d2d.fill();
  }

  // VERPLICHTE reset: `drawTimelineHeader` en `drawTaskTable` lopen hierná en strepen hun kolom- en
  // rasterlijnen met dezelfde Draw2D. Bleef het dash-patroon staan, dan werd de hele kopstrook
  // gestreept zodra de laatste relatie niet-bepalend was.
  d2d.setLineDash([]);
}


/** Draw the footer with project info, legend, and page number */
function drawFooter(
  d2d: Draw2D,
  m: ReportMetrics,
  canvasWidth: number,
  canvasHeight: number,
  projectName: string,
  options: PrintOptions,
) {
  const footerTop = canvasHeight - m.footerHeight;
  // Alles in de voettekst is tekst-zone: de marge, de regelafstanden en de legenda-blokjes schalen
  // mee met de strookhoogte, anders staan de twee regels bij 125% over elkaar.
  const pad = m.s(10);

  // Background
  d2d.fillStyle = PRINT_COLORS.surface;
  d2d.fillRect(0, footerTop, canvasWidth, m.footerHeight);

  // Top border
  d2d.strokeStyle = PRINT_COLORS.borderDark;
  d2d.lineWidth = 1;
  d2d.beginPath();
  d2d.moveTo(0, footerTop);
  d2d.lineTo(canvasWidth, footerTop);
  d2d.stroke();

  const midY = footerTop + m.footerHeight / 2;

  // Left: Project name + print date (breedtes meten voor de dynamische legenda-layout)
  d2d.fillStyle = PRINT_COLORS.text;
  d2d.font = m.font(10, true);
  d2d.textAlign = 'left';
  d2d.textBaseline = 'middle';
  d2d.fillText(projectName, pad, midY - m.s(8));
  const leftNameW = d2d.measureText(projectName).width;

  d2d.fillStyle = PRINT_COLORS.textSecondary;
  d2d.font = m.font(8);
  const printLocale = options.locale ?? 'nl';
  const dateStr = new Date().toLocaleDateString(printLocale, { day: '2-digit', month: 'long', year: 'numeric' });
  const dateText = `${options.labels?.printed ?? 'Afgedrukt:'} ${dateStr}`;
  d2d.fillText(dateText, pad, midY + m.s(8));
  const leftBlockRight = pad + Math.max(leftNameW, d2d.measureText(dateText).width);

  // Right: Page number + branding (breedtes meten, dan tekenen)
  const pageLabel = options.labels?.page ?? 'Pagina';
  const ofLabel = options.labels?.of ?? 'van';
  const pageText = `${pageLabel} 1 ${ofLabel} 1`;
  const brandText = 'Open Planner Studio';
  d2d.font = m.font(9);
  const pageW = d2d.measureText(pageText).width;
  d2d.font = m.font(8);
  const brandW = d2d.measureText(brandText).width;
  const rightBlockLeft = canvasWidth - pad - Math.max(pageW, brandW);

  d2d.fillStyle = PRINT_COLORS.textSecondary;
  d2d.textAlign = 'right';
  d2d.textBaseline = 'middle';
  d2d.font = m.font(9);
  d2d.fillText(pageText, canvasWidth - pad, midY - m.s(6));
  d2d.font = m.font(8);
  d2d.fillText(brandText, canvasWidth - pad, midY + m.s(8));

  // Center: Legend — dynamisch tussen het linker- en rechterblok, items weglaten bij te weinig
  // ruimte i.p.v. over de blokken heen tekenen (klacht 7).
  if (options.showLegend) {
    const availLeft = leftBlockRight + m.s(16);
    const availRight = rightBlockLeft - m.s(16);
    const availSpan = availRight - availLeft;
    if (availSpan > m.s(20)) {
      const lg = options.labels?.legend;
      // De legenda-blokjes zijn op de 8px-legendatekst gemaat; ze schalen dus met de letter mee.
      const swatchW = m.s(16);
      const swatchH = m.s(10);
      const gap = m.s(16);
      const labelPad = m.s(4);
      type LegendItem = { label: string; draw: (x: number) => void };
      const items: LegendItem[] = [];

      if (options.showCritical) {
        items.push({ label: lg?.criticalPath ?? 'Kritiek pad', draw: (x) => {
          d2d.fillStyle = PRINT_COLORS.critical;
          d2d.roundRect(x, midY - swatchH / 2, swatchW, swatchH, m.s(2));
          d2d.fill();
        } });
      }
      items.push({ label: lg?.normal ?? 'Normaal', draw: (x) => {
        d2d.fillStyle = PRINT_COLORS.normal;
        d2d.roundRect(x, midY - swatchH / 2, swatchW, swatchH, m.s(2));
        d2d.fill();
      } });
      items.push({ label: lg?.milestone ?? 'Mijlpaal', draw: (x) => {
        d2d.fillStyle = PRINT_COLORS.milestone;
        const mx = x + swatchW / 2;
        d2d.beginPath();
        d2d.moveTo(mx, midY - m.s(5));
        d2d.lineTo(mx + m.s(5), midY);
        d2d.lineTo(mx, midY + m.s(5));
        d2d.lineTo(mx - m.s(5), midY);
        d2d.closePath();
        d2d.fill();
      } });
      items.push({ label: lg?.summary ?? 'Samenvatting', draw: (x) => {
        d2d.fillStyle = PRINT_COLORS.summary;
        d2d.fillRect(x, midY - m.s(2), swatchW, m.s(4));
        d2d.beginPath();
        d2d.moveTo(x, midY - m.s(2));
        d2d.lineTo(x, midY + m.s(5));
        d2d.lineTo(x + m.s(4), midY + m.s(2));
        d2d.closePath();
        d2d.fill();
      } });
      if (options.showFloat) {
        items.push({ label: lg?.float ?? 'Speling', draw: (x) => {
          d2d.fillStyle = PRINT_COLORS.float + '40';
          d2d.fillRect(x, midY - m.s(4), swatchW, m.s(8));
        } });
      }
      // Lijnstijl-uitleg (issue #56): ÉÉN legenda-regel die beide stijlen tegelijk toont — boven een
      // doorgetrokken, eronder een gestreept lijntje — zodat de conventie "doorgetrokken = bepalend,
      // gestreept = niet-bepalend" in het rapport zelf staat en niet als stilzwijgende kennis. Alleen
      // zinvol als er überhaupt relaties getekend worden ÉN de bindend-informatie er is: zonder
      // `drivingSequenceIds` is élke lijn doorgetrokken en zou de regel iets beloven wat er niet is.
      // Staat bewust achteraan: de legenda laat bij te weinig ruimte de laatste items weg, en dit is
      // de minst essentiële regel.
      if (options.showDeps && options.drivingSequenceIds) {
        items.push({ label: lg?.relationStyle ?? 'Bepalend / niet-bepalend', draw: (x) => {
          d2d.strokeStyle = PRINT_COLORS.dependency;
          d2d.lineWidth = 1.2;
          d2d.setLineDash([]);
          d2d.beginPath();
          d2d.moveTo(x, midY - m.s(3));
          d2d.lineTo(x + swatchW, midY - m.s(3));
          d2d.stroke();
          d2d.setLineDash([m.s(4), m.s(3)]);
          d2d.beginPath();
          d2d.moveTo(x, midY + m.s(3));
          d2d.lineTo(x + swatchW, midY + m.s(3));
          d2d.stroke();
          d2d.setLineDash([]);
        } });
      }

      d2d.font = m.font(8);
      d2d.textBaseline = 'middle';
      const widths = items.map(it => swatchW + labelPad + d2d.measureText(it.label).width);
      const measure = (n: number) => widths.slice(0, n).reduce((a, b) => a + b, 0) + gap * Math.max(0, n - 1);
      let visible = items.length;
      while (visible > 0 && measure(visible) > availSpan) visible--;

      let lx = availLeft + Math.max(0, (availSpan - measure(visible)) / 2);
      for (let k = 0; k < visible; k++) {
        items[k].draw(lx);
        d2d.fillStyle = PRINT_COLORS.textSecondary;
        d2d.textAlign = 'left';
        d2d.fillText(items[k].label, lx + swatchW + labelPad, midY);
        lx += widths[k] + gap;
      }
    }
  }

  d2d.textAlign = 'left';
  d2d.textBaseline = 'alphabetic';
}
