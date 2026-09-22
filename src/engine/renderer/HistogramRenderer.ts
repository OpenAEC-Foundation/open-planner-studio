// Histogram-renderer (fase 2.5, §6.4). Tekent één resource-belastingsstrook onder de Gantt met
// dezelfde primaire tijdsinstellingen als GanttRenderer (pickerWidth + dagen*zoom - scrollX),
// zodat de dagkolommen 1-op-1 boven de taakbalken staan. Eigen verticale schaal (eenheden i.p.v.
// rijen). Links van pickerWidth: een resourcekiezer-lijst; rechts: staafjes per dag met het
// deel boven de capaciteitslijn in rood (P6-patroon). Thema-bewust via CSS-variabelen.
import type { ViewState } from '@/types/view';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';
import { readHistogramPalette, type HistogramPalette } from './themePalette';
import { dateToX as axisDateToX, type GanttAxis } from './timeAxis';

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
  /** Breedte van uitsluitend de resourcekiezer; tevens de lokale oorsprong van de tijdplot. */
  pickerWidth: number;
  /** R2a: verticale scrollpositie (px) van de kiezerlijst — de gepinde "alle resources"-somrij zelf
   *  scrollt nooit mee, dit geldt alleen voor de resourcerijen eronder. Sessiestate; eigendom van de
   *  aanroepende hook, niet van deze renderer — die klemt hier alleen af op `[0, maxScroll]` (zie
   *  `histogramPickerMaxScroll`). Afwezig ⇒ 0 (byte-identiek aan vóór R2a zolang de lijst toch al
   *  past). */
  pickerScrollY?: number;
  labels: { unitsSuffix: string };
  emptyHint?: string;            // getoond wanneer er geen (herberekende) data is
  /** Geïnjecteerd histogram-palet (audit C5/P17). Afwezig ⇒ zelf gelezen via
   *  `readHistogramPalette()` (identiek resultaat); meegeven maakt de renderer headless-testbaar. */
  palette?: HistogramPalette;
  /** Issue #21 punt 5 (fase 2, ontwerp §10.1 — BINDEND): de HistogramRenderer deelt bewust EXACT
   *  dezelfde X-as als de Gantt, dus krijgt hier de LETTERLIJK ZELFDE `GanttAxis`-instantie als
   *  `GanttRenderer` (door `GanttCanvas` gebouwd en aan beide renderers doorgegeven) — anders
   *  schuiven de resource-staafjes onder de verkeerde kolommen zodra de as gecomprimeerd is.
   *  Afwezig ⇒ terugvallen op de oude rechtstreekse `timeAxis.dateToX`-aanroep (byte-identiek). */
  axis?: GanttAxis;
  /** Issue #25 punt 4: de CSS font-stack van de gekozen interface-lettertypefamilie
   *  (`resolveUIFontStack(ui.uiFontFamily)`). Een canvas leest géén CSS-variabelen, dus de stack
   *  moet als string mee — anders blijft de resourcestrook in het oude lettertype staan terwijl de
   *  Gantt erboven en de chrome eromheen wél omschakelen. Afwezig ⇒ `FALLBACK_FONT_STACK`. */
  fontFamily?: string;
  /** Issue #60 (nazit): schaalfactor van `ui.uiFontScale` (bv. 1.25), zelfde contract als
   *  `GanttRenderOptions.fontScale`. Schaalt de labelfonts én de kiezerrij-hoogte mee, zodat de
   *  strook niet zichtbaar uit de pas loopt met de wél geschaalde Gantt erboven.
   *  Afwezig ⇒ factor 1 (byte-identiek aan voorheen). */
  fontScale?: number;
}

/** De historische, hardgecodeerde stack van deze renderer; fallback wanneer een aanroeper
 *  `fontFamily` niet meegeeft (byte-identiek aan vóór issue #25 punt 4). */
const FALLBACK_FONT_STACK = 'system-ui, sans-serif';

const ROW_H = 18;          // hoogte van een resourcekiezer-rij
const TOP_PAD = 8;         // ruimte boven de hoogste staaf
const BOTTOM_PAD = 4;      // ruimte onder de nullijn
const LEFT_PAD = 8;        // padding binnen de kiezerzone
const PICKER_SCROLLBAR_W = 2; // breedte van de smalle, niet-sleepbare scroll-positie-indicator (R2a)
const PICKER_SCROLLBAR_ALPHA = 0.45; // dekking van de indicator — subtiel, geen interactief element

/** Rijhoogte van de kiezerlijst, geschaald met `fontScale` — dezelfde afronding als
 *  `HistogramRenderer.rowH`, maar als los aanroepbare functie zodat de scroll-eigenaar
 *  (buiten de renderer, zie de Gantt-grenzenpoort) zonder instantie dezelfde maat kent. */
export function histogramPickerRowHeight(fontScale = 1): number {
  return Math.round(ROW_H * fontScale);
}

/** Hoogte in PIXELS van de scrollbare zone ONDER de gepinde "alle resources"-rij. Puur — geen
 *  renderer-instantie nodig — zodat de scroll-eigenaar exact dezelfde maat als `drawPicker`/
 *  `pickerAt` gebruikt. Rekent in pixels i.p.v. hele rijen (R2a-fixronde punt 3): een rijhoogte-
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
  /** Lokale oorsprong van de tijdplot, één keer afgeleid van de semantische kiezerbreedte. */
  private chartOriginX: number;
  /** Kiezerrij-hoogte, geschaald met `fontScale` (issue #60-nazit) — één instance-waarde voor
   *  tekenen én hit-test, zodat die twee nooit uit elkaar kunnen lopen. */
  private rowH: number;
  /** R2a: verticale scrollpositie van de kiezerlijst, afgeklemd op `[0, maxScroll]` zodat een
   *  verouderde waarde (bv. na een gewijzigde resourcelijst) nooit voorbij het einde tekent of
   *  hit-test. De klem gebeurt hier — niet bij de aanroeper — zodat tekenen en hit-testen altijd
   *  dezelfde afgeklemde waarde delen. */
  private pickerScrollY: number;
  /** R2a-fixronde punt 6: één keer berekend in de constructor, hergebruikt door `drawPicker` — geen
   *  tweede, mogelijk uit de pas lopende berekening bij het tekenen van de scroll-indicator. */
  private maxScroll: number;

  constructor(ctx: CanvasRenderingContext2D, opts: HistogramRenderOptions) {
    this.ctx = ctx;
    this.opts = opts;
    this.colors = opts.palette ?? readHistogramPalette();
    this.viewStart = parseDate(opts.view.viewStartDate);
    this.fontScale = opts.fontScale ?? 1;
    this.chartOriginX = opts.pickerWidth;
    this.rowH = histogramPickerRowHeight(this.fontScale);
    this.maxScroll = histogramPickerMaxScroll(opts.picker.length, opts.canvasHeight, this.fontScale);
    this.pickerScrollY = Math.min(this.maxScroll, Math.max(0, opts.pickerScrollY ?? 0));
  }

  /** Bouwt een `ctx.font`-string in de gekozen interface-lettertypefamilie (issue #25 punt 4),
   *  met de grootte geschaald via `fontScale` (issue #60-nazit) — zelfde helper (en zelfde
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
    if (x >= this.opts.pickerWidth) return null;
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
    if (x < this.chartOriginX || y < 0 || y > this.opts.canvasHeight) return null;
    const iso = this.dateAtX(x);
    return this.opts.series.load[iso] !== undefined ? iso : null;
  }

  render(): void {
    const { canvasWidth, canvasHeight } = this.opts;
    const chartOriginX = this.chartOriginX;
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

    // Plotzone rechts van de tabel
    ctx.save();
    ctx.beginPath();
    ctx.rect(chartOriginX, 0, canvasWidth - chartOriginX, canvasHeight);
    ctx.clip();

    if (this.opts.emptyHint) {
      ctx.fillStyle = c.textDim;
      ctx.font = this.font(11);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.opts.emptyHint, (chartOriginX + canvasWidth) / 2, canvasHeight / 2);
      ctx.restore();
      return;
    }

    this.drawBars();
    ctx.restore();

    // Scheidingslijn tussen kiezer en plot
    ctx.strokeStyle = c.border;
    ctx.beginPath();
    ctx.moveTo(chartOriginX + 0.5, 0);
    ctx.lineTo(chartOriginX + 0.5, canvasHeight);
    ctx.stroke();
  }

  /** Tekent één kiezerrij op de gegeven Y (al in canvascoördinaten — de aanroeper bepaalt of dat
   *  de vaste gepinde positie is of een scroll-verschoven positie). */
  private drawPickerRow(item: HistogramPickerItem, y: number, reserveScrollbar: boolean): void {
    const ctx = this.ctx;
    const c = this.colors;
    const { pickerWidth } = this.opts;
    const selected = item.id === this.opts.selectedResourceId;
    if (selected) {
      ctx.fillStyle = c.active;
      ctx.fillRect(0, y, pickerWidth, this.rowH);
    }
    // Rood badge bij overallocatie
    if (item.overallocated) {
      ctx.fillStyle = c.barOver;
      ctx.beginPath();
      ctx.arc(LEFT_PAD + 3, y + this.rowH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = selected ? c.text : c.textDim;
    const textX = LEFT_PAD + 12;
    // R2a-fixronde punt 7: label niet onder de scroll-indicator laten doorlopen zodra die getekend
    // wordt — de gepinde somrij (nooit `reserveScrollbar`) blijft de volle breedte gebruiken.
    const maxW = pickerWidth - textX - 4 - (reserveScrollbar ? PICKER_SCROLLBAR_W + 2 : 0);
    ctx.fillText(this.truncate(item.label, maxW), textX, y + this.rowH / 2);
  }

  /** R2a: de gepinde "alle resources"-rij (index 0) blijft altijd op `TOP_PAD` staan; de overige
   *  resourcerijen scrollen daaronder binnen een geclipte zone, verschoven met `pickerScrollY`. Een
   *  smalle schuifbalk verschijnt alleen als de lijst niet past (`maxScroll > 0`) — dezelfde
   *  drempel als de scroll-eigenaar gebruikt om te klemmen. */
  private drawPicker(): void {
    const ctx = this.ctx;
    const c = this.colors;
    const { pickerWidth, picker, canvasHeight } = this.opts;

    ctx.fillStyle = c.surfaceAlt;
    ctx.fillRect(0, 0, pickerWidth, canvasHeight);

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
    ctx.rect(0, scrollTop, pickerWidth, canvasHeight - scrollTop);
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
    ctx.fillRect(pickerWidth - PICKER_SCROLLBAR_W - 1, thumbY, PICKER_SCROLLBAR_W, thumbHeight);
    ctx.restore();
  }

  private truncate(text: string, maxWidth: number): string {
    const ctx = this.ctx;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
  }

  private drawBars(): void {
    const ctx = this.ctx;
    const c = this.colors;
    const { series, view, canvasHeight } = this.opts;

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
      if (x + dayW < this.chartOriginX || x > this.opts.canvasWidth) continue;
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
    ctx.moveTo(this.chartOriginX, plotBottom + 0.5);
    ctx.lineTo(this.opts.canvasWidth, plotBottom + 0.5);
    ctx.stroke();

    for (const iso of isos) {
      const loadVal = series.load[iso] ?? 0;
      const capVal = series.capacity[iso] ?? 0;
      if (loadVal <= 0 && capVal <= 0) continue;
      const x = this.dateToX(parseDate(iso));
      if (x + dayW < this.chartOriginX || x > this.opts.canvasWidth) continue;

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

    // Y-as-label (max) linksboven in de plotzone
    ctx.fillStyle = c.textDim;
    ctx.font = this.font(9);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${this.formatUnits(yMaxData)} ${this.opts.labels.unitsSuffix}`, this.chartOriginX + 4, 2);
  }

  private formatUnits(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }
}
