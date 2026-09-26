// Histogram-renderer. Tekent één resource-belastingsstrook onder de Gantt met
// dezelfde primaire tijdsinstellingen als GanttRenderer (plotbegin + dagen*zoom - scrollX),
// zodat de dagkolommen 1-op-1 onder de taakbalken staan. Eigen verticale schaal (eenheden i.p.v.
// rijen). Onder de takenlijst: een resourcekiezer-lijst; onder de tijdlijn: staafjes per dag met
// het deel boven de capaciteitslijn in rood (P6-patroon). Thema-bewust via CSS-variabelen.
// Welke x bij kiezer en plot hoort, staat op één plek: `histogramLayout` hieronder.
import type { ViewState } from '@/types/view';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';
import { readHistogramPalette, type HistogramPalette } from './themePalette';
import { dateToX as axisDateToX, type GanttAxis } from './timeAxis';
import { ellipsize } from './textFit';

export interface HistogramSeries {
  /** iso-datum → belaste eenheden voor de getoonde resource (of som over alle renewables). */
  load: Record<string, number>;
  /** iso-datum → capaciteit op die dag. */
  capacity: Record<string, number>;
  /** iso-datums waar load > capacity. */
  overSet: Set<string>;
}

export interface HistogramPickerItem {
  /** undefined = de "alle resources"-somrij. */
  id?: string;
  label: string;
  overallocated: boolean;
}

export interface HistogramRenderOptions {
  series: HistogramSeries;
  picker: HistogramPickerItem[];
  selectedResourceId?: string;   // undefined = "alle resources"
  view: ViewState;               // effectiveView (zelfde origin als de Gantt)
  canvasWidth: number;
  canvasHeight: number;
  /** Breedte van uitsluitend de resourcekiezer (= de takenlijst erboven). */
  pickerWidth: number;
  /** Aan welke kant van het canvas de kiezer staat: aan de kant van de takenlijst erboven, dus links
   *  in ltr en rechts in ar/fa. Afwezig ⇒ `'left'`. Zie
   *  `histogramLayout`. */
  pickerSide?: HistogramPickerSide;
  /** Verticale scrollpositie (px) van de kiezerlijst — de gepinde "alle resources"-somrij zelf
   *  scrollt nooit mee, dit geldt alleen voor de resourcerijen eronder. Sessiestate; eigendom van de
   *  aanroepende hook, niet van deze renderer — die klemt hier alleen af op `[0, maxScroll]` (zie
   *  `histogramPickerMaxScroll`). Afwezig ⇒ 0. */
  pickerScrollY?: number;
  labels: { unitsSuffix: string };
  emptyHint?: string;            // getoond wanneer er geen (herberekende) data is
  /** Geïnjecteerd histogram-palet. Afwezig ⇒ zelf gelezen via
   *  `readHistogramPalette()`; meegeven maakt de renderer headless-testbaar. */
  palette?: HistogramPalette;
  /** De HistogramRenderer deelt bewust EXACT
   *  dezelfde X-as als de Gantt, dus krijgt hier de LETTERLIJK ZELFDE `GanttAxis`-instantie als
   *  `GanttRenderer` (door `GanttCanvas` gebouwd en aan beide renderers doorgegeven) — anders
   *  schuiven de resource-staafjes onder de verkeerde kolommen zodra de as gecomprimeerd is.
   *  Afwezig ⇒ terugvallen op de rechtstreekse `timeAxis.dateToX`-aanroep (kalender-as). */
  axis?: GanttAxis;
  /** De CSS font-stack van de gekozen interface-lettertypefamilie
   *  (`resolveUIFontStack(ui.uiFontFamily)`). Een canvas leest géén CSS-variabelen, dus de stack
   *  moet als string mee. Afwezig ⇒ `FALLBACK_FONT_STACK`. */
  fontFamily?: string;
  /** Schaalfactor van `ui.uiFontScale` (bv. 1.25), zelfde contract als
   *  `GanttRenderOptions.fontScale`. Schaalt de labelfonts én de kiezerrij-hoogte mee, zodat de
   *  strook niet zichtbaar uit de pas loopt met de wél geschaalde Gantt erboven.
   *  Afwezig ⇒ factor 1. */
  fontScale?: number;
}

/** Fallback-stack wanneer een aanroeper `fontFamily` niet meegeeft. */
const FALLBACK_FONT_STACK = 'system-ui, sans-serif';

const ROW_H = 18;          // hoogte van een resourcekiezer-rij
const TOP_PAD = 8;         // ruimte boven de hoogste staaf
const BOTTOM_PAD = 4;      // ruimte onder de nullijn
const LEFT_PAD = 8;        // padding binnen de kiezerzone
const PICKER_SCROLLBAR_W = 2; // breedte van de smalle, niet-sleepbare scroll-positie-indicator
const PICKER_SCROLLBAR_ALPHA = 0.45; // dekking van de indicator — subtiel, geen interactief element

// ── Horizontale indeling: kiezer en tijdplot ──────────────────────────────────────────────────
// Het histogram is één canvas over de volle breedte van de Gantt-werkruimte. De kiezer staat onder
// de takenlijst, de tijdplot onder de tijdlijn. In ar/fa spiegelt de werkruimte (de takenlijst staat
// dan RECHTS), maar de tijdlijn zelf blijft ltr: de tijd loopt ook daar links naar rechts. De plot
// wordt dus niet gespiegeld; kiezer en plot wisselen alleen van plek, elk met hun eigen inhoud
// ongewijzigd. Tekenen, hit-test, wielscroll en de gedeelde as (`chartOriginX`) lezen allemaal deze
// indeling — wie los `x >= pickerWidth` of `chartOriginX = pickerWidth` schrijft, neemt stil aan
// dat de kiezer links staat (in ar begint de dagas dan een kiezerbreedte na die van de tijdlijn).

/** Kant van het canvas waar de resourcekiezer staat. */
export type HistogramPickerSide = 'left' | 'right';

/** Wat de kiezer links en rechts van de tijdplot inneemt, in canvas-px. Hangt niet van de
 *  canvasbreedte af, zodat ook de gedeelde as er zonder gemeten canvas uit volgt:
 *  `chartOriginX` = `left`. */
export function histogramPlotInsets(
  pickerWidth: number,
  pickerSide: HistogramPickerSide = 'left',
): { left: number; right: number } {
  return pickerSide === 'right' ? { left: 0, right: pickerWidth } : { left: pickerWidth, right: 0 };
}

/** Halfopen x-bereiken `[left, right)` in canvas-px. */
export interface HistogramLayout {
  picker: { left: number; right: number };
  /** `plot.left` is de oorsprong van de tijdas (`chartOriginX`). */
  plot: { left: number; right: number };
}

export function histogramLayout(
  canvasWidth: number,
  pickerWidth: number,
  pickerSide: HistogramPickerSide = 'left',
): HistogramLayout {
  const inset = histogramPlotInsets(pickerWidth, pickerSide);
  return {
    picker: pickerSide === 'right'
      ? { left: canvasWidth - pickerWidth, right: canvasWidth }
      : { left: 0, right: pickerWidth },
    plot: { left: inset.left, right: canvasWidth - inset.right },
  };
}

/** Ligt canvas-x `x` in de kiezer? Eén definitie voor klik, hover en wielscroll. */
export function isInHistogramPicker(layout: HistogramLayout, x: number): boolean {
  return x >= layout.picker.left && x < layout.picker.right;
}

/** Rijhoogte van de kiezerlijst, geschaald met `fontScale` — dezelfde afronding als
 *  `HistogramRenderer.rowH`, maar als los aanroepbare functie zodat de scroll-eigenaar
 *  (buiten de renderer, zie de Gantt-grenzenpoort) zonder instantie dezelfde maat kent. */
export function histogramPickerRowHeight(fontScale = 1): number {
  return Math.round(ROW_H * fontScale);
}

/** Hoogte in PIXELS van de scrollbare zone ONDER de gepinde "alle resources"-rij. Puur — geen
 *  renderer-instantie nodig — zodat de scroll-eigenaar exact dezelfde maat als `drawPicker`/
 *  `pickerAt` gebruikt. Rekent in pixels i.p.v. hele rijen: een rijhoogte-
 *  restje onderaan de strook (tot 22px bij fontScale 1.25) hoort bij het scrollbare bereik, anders
 *  blijft daar altijd een leeg gat staan dat nooit met scrollen te vullen is. */
export function histogramPickerTrackHeight(canvasHeight: number, fontScale = 1): number {
  const rowH = histogramPickerRowHeight(fontScale);
  return Math.max(0, canvasHeight - TOP_PAD - rowH);
}

/** Maximale scrollpositie (px) voor de kiezerlijst: `itemCount` is de VOLLEDIGE pickerlijst
 *  (inclusief de gepinde somrij op index 0), die zelf niet meetelt in het scrollbare deel. */
export function histogramPickerMaxScroll(itemCount: number, canvasHeight: number, fontScale = 1): number {
  const rowH = histogramPickerRowHeight(fontScale);
  const scrollableCount = Math.max(0, itemCount - 1);
  const trackHeight = histogramPickerTrackHeight(canvasHeight, fontScale);
  return Math.max(0, scrollableCount * rowH - trackHeight);
}

export class HistogramRenderer {
  private ctx: CanvasRenderingContext2D;
  private opts: HistogramRenderOptions;
  private colors: HistogramPalette;
  private viewStart: Date;
  private fontScale: number;
  /** Kiezer- en plotzone, één keer afgeleid uit kiezerbreedte en -kant (`histogramLayout`). */
  private layout: HistogramLayout;
  /** Lokale oorsprong van de tijdplot: het begin van de plotzone. */
  private chartOriginX: number;
  /** Kiezerrij-hoogte, geschaald met `fontScale` — één instance-waarde voor
   *  tekenen én hit-test, zodat die twee nooit uit elkaar kunnen lopen. */
  private rowH: number;
  /** Verticale scrollpositie van de kiezerlijst, afgeklemd op `[0, maxScroll]` zodat een
   *  verouderde waarde (bv. na een gewijzigde resourcelijst) nooit voorbij het einde tekent of
   *  hit-test. De klem gebeurt hier — niet bij de aanroeper — zodat tekenen en hit-testen altijd
   *  dezelfde afgeklemde waarde delen. */
  private pickerScrollY: number;
  /** Eén keer berekend in de constructor, hergebruikt door `drawPicker` — geen
   *  tweede, mogelijk uit de pas lopende berekening bij het tekenen van de scroll-indicator. */
  private maxScroll: number;

  constructor(ctx: CanvasRenderingContext2D, opts: HistogramRenderOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.colors = opts.palette ?? readHistogramPalette();
    this.viewStart = parseDate(opts.view.viewStartDate);
    this.fontScale = opts.fontScale ?? 1;
    this.layout = histogramLayout(opts.canvasWidth, opts.pickerWidth, opts.pickerSide);
    this.chartOriginX = this.layout.plot.left;
    this.rowH = histogramPickerRowHeight(this.fontScale);
    this.maxScroll = histogramPickerMaxScroll(opts.picker.length, opts.canvasHeight, this.fontScale);
    this.pickerScrollY = Math.min(this.maxScroll, Math.max(0, opts.pickerScrollY ?? 0));
  }

  /** Bouwt een `ctx.font`-string in de gekozen interface-lettertypefamilie,
   *  met de grootte geschaald via `fontScale` — zelfde helper (en zelfde
   *  afweging) als in `GanttRenderer.font()`. De kiezerrij-hoogte (`rowH`) schaalt mee; de
   *  plotzone zelf rekent met de door de gebruiker instelbare canvashoogte en blijft dus goed. */
  private font(sizePx: number, bold = false): string {
    return `${bold ? 'bold ' : ''}${Math.round(sizePx * this.fontScale)}px ${this.opts.fontFamily ?? FALLBACK_FONT_STACK}`;
  }

  /** Gedeelde X-as met GanttRenderer (issue #21 punt 5, fase 2 — ontwerp §10.1): `opts.axis`
   *  (meegegeven door `GanttCanvas`, de letterlijk gedeelde instantie) wint; afwezig ⇒ het oude
   *  rechtstreekse `timeAxis.dateToX`-pad (bit-identiek), zodat de dagkolommen 1-op-1 boven de
   *  taakbalken staan zowel bij de kalender- als de werkdagen-as. */
  private dateToX(date: Date): number {
    if (this.opts.axis) return this.opts.axis.dateToX(date);
    return axisDateToX(date, this.viewStart, this.chartOriginX, this.opts.view.zoom, this.opts.view.scrollX);
  }

  /** Inverse: kolom-iso onder een X-positie in de plotzone. Gaat via `opts.axis.xToDate` zodra die
   *  gedeelde as gecomprimeerd is (§10.1) — anders (as afwezig) het oude kalenderdag-pad. */
  dateAtX(x: number): string {
    if (this.opts.axis) return formatDate(this.opts.axis.xToDate(x));
    const daysFromStart = (x - this.chartOriginX + this.opts.view.scrollX) / this.opts.view.zoom;
    const d = addCalendarDays(this.viewStart, Math.floor(daysFromStart));
    return formatDate(d);
  }

  /** Hit-test op de kiezerzone: geeft { id } terug (id undefined = "alle resources"), of null.
   *  R2a: index 0 (de gepinde somrij) staat altijd op `TOP_PAD..TOP_PAD+rowH`, ongeacht scroll; de
   *  rijen erna liggen in het scrollbare deel eronder, verschoven met `pickerScrollY` — exact de
   *  geometrie die `drawPicker` ook tekent. */
  pickerAt(x: number, y: number): { id?: string } | null {
    if (!isInHistogramPicker(this.layout, x)) return null;
    if (this.opts.picker.length === 0) return null;
    if (y >= TOP_PAD && y < TOP_PAD + this.rowH) return { id: this.opts.picker[0].id };
    const scrollTop = TOP_PAD + this.rowH;
    if (y < scrollTop) return null;
    // `idx` is hier per constructie altijd >= 1: y >= scrollTop (net gecontroleerd) en
    // pickerScrollY >= 0, dus de teller in de floor is nooit negatief.
    const idx = 1 + Math.floor((y - scrollTop + this.pickerScrollY) / this.rowH);
    if (idx >= this.opts.picker.length) return null;
    return { id: this.opts.picker[idx].id };
  }

  /** Hit-test op een dagkolom in de plotzone: geeft de iso-datum terug als daar belasting is. */
  dayAt(x: number, y: number): string | null {
    const { plot } = this.layout;
    if (x < plot.left || x >= plot.right || y < 0 || y > this.opts.canvasHeight) return null;
    const iso = this.dateAtX(x);
    return this.opts.series.load[iso] !== undefined ? iso : null;
  }

  render(): void {
    const { canvasWidth, canvasHeight } = this.opts;
    const { plot } = this.layout;
    const ctx = this.ctx;
    const c = this.colors;

    // Achtergrond
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Bovenrand (scheiding met de Gantt erboven)
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(canvasWidth, 0.5);
    ctx.stroke();

    this.drawPicker();

    // Plotzone onder de tijdlijn
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.left, 0, plot.right - plot.left, canvasHeight);
    ctx.clip();

    if (this.opts.emptyHint) {
      ctx.fillStyle = c.textDim;
      ctx.font = this.font(11);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.opts.emptyHint, (plot.left + plot.right) / 2, canvasHeight / 2);
      ctx.restore();
      return;
    }

    this.drawBars();
    ctx.restore();

    // Scheidingslijn tussen kiezer en plot: de eerste plotpixel aan de kiezerkant, zodat hij onder
    // de lijn van de werkruimtesplitter valt (die ligt in beide richtingen aan de Gantt-kant).
    const separatorX = this.opts.pickerSide === 'right' ? plot.right - 0.5 : plot.left + 0.5;
    ctx.strokeStyle = c.border;
    ctx.beginPath();
    ctx.moveTo(separatorX, 0);
    ctx.lineTo(separatorX, canvasHeight);
    ctx.stroke();
  }

  /** Tekent één kiezerrij op de gegeven Y (al in canvascoördinaten — de aanroeper bepaalt of dat
   *  de vaste gepinde positie is of een scroll-verschoven positie). */
  private drawPickerRow(item: HistogramPickerItem, y: number, reserveScrollbar: boolean): void {
    const ctx = this.ctx;
    const c = this.colors;
    const { pickerWidth } = this.opts;
    const x0 = this.layout.picker.left;
    const selected = item.id === this.opts.selectedResourceId;
    if (selected) {
      ctx.fillStyle = c.active;
      ctx.fillRect(x0, y, pickerWidth, this.rowH);
    }
    // Rood badge bij overallocatie
    if (item.overallocated) {
      ctx.fillStyle = c.barOver;
      ctx.beginPath();
      ctx.arc(x0 + LEFT_PAD + 3, y + this.rowH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = selected ? c.text : c.textDim;
    const textOffset = LEFT_PAD + 12;
    // R2a-fixronde punt 7: label niet onder de scroll-indicator laten doorlopen zodra die getekend
    // wordt — de gepinde somrij (nooit `reserveScrollbar`) blijft de volle breedte gebruiken.
    const maxW = pickerWidth - textOffset - 4 - (reserveScrollbar ? PICKER_SCROLLBAR_W + 2 : 0);
    ctx.fillText(ellipsize(ctx, item.label, maxW), x0 + textOffset, y + this.rowH / 2);
  }

  /** R2a: de gepinde "alle resources"-rij (index 0) blijft altijd op `TOP_PAD` staan; de overige
   *  resourcerijen scrollen daaronder binnen een geclipte zone, verschoven met `pickerScrollY`. Een
   *  smalle schuifbalk verschijnt alleen als de lijst niet past (`maxScroll > 0`) — dezelfde
   *  drempel als de scroll-eigenaar gebruikt om te klemmen. */
  private drawPicker(): void {
    const ctx = this.ctx;
    const c = this.colors;
    const { pickerWidth, picker, canvasHeight } = this.opts;
    const x0 = this.layout.picker.left;

    ctx.fillStyle = c.surfaceAlt;
    ctx.fillRect(x0, 0, pickerWidth, canvasHeight);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = this.font(11);

    if (picker.length === 0) return;

    const showScrollbar = this.maxScroll > 0;

    // Gepinde somrij — nooit verschoven door scroll.
    this.drawPickerRow(picker[0], TOP_PAD, false);

    const scrollTop = TOP_PAD + this.rowH;
    const scrollableItems = picker.slice(1);
    if (scrollableItems.length === 0 || scrollTop >= canvasHeight) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, scrollTop, pickerWidth, canvasHeight - scrollTop);
    ctx.clip();
    scrollableItems.forEach((item, i) => {
      const y = scrollTop - this.pickerScrollY + i * this.rowH;
      if (y + this.rowH < scrollTop || y > canvasHeight) return;
      this.drawPickerRow(item, y, showScrollbar);
    });
    ctx.restore();

    if (!showScrollbar) return;
    // R2a-fixronde punt 3/8: dezelfde `trackHeight` als `histogramPickerTrackHeight`/de scroll-hook
    // (pixels, geen hele rijen) — anders lopen tekenen en scrollgrenzen weer uiteen. Blijft bewust
    // een NIET-sleepbare positie-indicator (punt 8): dun en alleen zichtbaar zolang de lijst niet
    // past; slepen zou eigen pointer-down/-move/-up-afhandeling in de canvas-hit-test vergen die
    // hier niet in verhouding staat tot de rest van deze fixronde.
    const trackHeight = histogramPickerTrackHeight(canvasHeight, this.fontScale);
    const contentHeight = scrollableItems.length * this.rowH;
    const thumbHeight = Math.max(12, trackHeight * Math.min(1, trackHeight / contentHeight));
    const thumbY = scrollTop + (this.pickerScrollY / this.maxScroll) * (trackHeight - thumbHeight);
    ctx.save();
    ctx.fillStyle = c.textDim;
    ctx.globalAlpha = PICKER_SCROLLBAR_ALPHA;
    ctx.fillRect(x0 + pickerWidth - PICKER_SCROLLBAR_W - 1, thumbY, PICKER_SCROLLBAR_W, thumbHeight);
    ctx.restore();
  }

  private drawBars(): void {
    const ctx = this.ctx;
    const c = this.colors;
    const { series, view, canvasHeight } = this.opts;
    const { plot } = this.layout;

    const isos = Object.keys(series.load);
    if (isos.length === 0) return;

    const dayW = Math.max(1, view.zoom);
    const barInset = dayW > 6 ? 1 : 0;

    // Y-schaal op wat ZICHTBAAR is (ontwerp §6.4, bevinding 4): top = max(load, capacity) binnen
    // het huidige datumbereik, zodat een enkele projectpiek elders normale periodes niet
    // platdrukt. +5% marge zodat de hoogste staaf niet tegen de bovenrand plakt. Minimaal 1 om
    // deling door 0 te vermijden. Overallocatie-staven blijven boven de capaciteitslijn zichtbaar.
    let yMaxData = 1;
    for (const iso of isos) {
      const x = this.dateToX(parseDate(iso));
      if (x + dayW < plot.left || x > plot.right) continue;
      yMaxData = Math.max(yMaxData, series.load[iso] ?? 0, series.capacity[iso] ?? 0);
    }
    const yMax = yMaxData * 1.05;

    const plotBottom = canvasHeight - BOTTOM_PAD;
    const plotHeight = canvasHeight - TOP_PAD - BOTTOM_PAD;
    const unitToY = (u: number) => plotBottom - (u / yMax) * plotHeight;

    // Nullijn
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot.left, plotBottom + 0.5);
    ctx.lineTo(plot.right, plotBottom + 0.5);
    ctx.stroke();

    for (const iso of isos) {
      const loadVal = series.load[iso] ?? 0;
      const capVal = series.capacity[iso] ?? 0;
      if (loadVal <= 0 && capVal <= 0) continue;
      const x = this.dateToX(parseDate(iso));
      if (x + dayW < plot.left || x > plot.right) continue;

      const capY = unitToY(capVal);

      if (loadVal > 0) {
        const overCap = loadVal > capVal + 1e-9;
        const topY = unitToY(loadVal);
        const bx = x + barInset;
        const bw = Math.max(1, dayW - barInset * 2);
        if (overCap) {
          // Normale deel tot capaciteit, rode deel erboven.
          ctx.fillStyle = c.barNormal;
          ctx.fillRect(bx, capY, bw, plotBottom - capY);
          ctx.fillStyle = c.barOver;
          ctx.fillRect(bx, topY, bw, capY - topY);
        } else {
          ctx.fillStyle = c.barNormal;
          ctx.fillRect(bx, topY, bw, plotBottom - topY);
        }
      }

      // Capaciteitslijn-segment (stapvormig: per dag zijn eigen niveau).
      if (capVal > 0) {
        ctx.strokeStyle = c.capacity;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, capY);
        ctx.lineTo(x + dayW, capY);
        ctx.stroke();
      }
    }

    // Y-as-label (max) linksboven in de plotzone, aan het begin van de tijd (ook in ar/fa)
    ctx.fillStyle = c.textDim;
    ctx.font = this.font(9);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${this.formatUnits(yMaxData)} ${this.opts.labels.unitsSuffix}`, plot.left + 4, 2);
  }

  private formatUnits(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }
}
