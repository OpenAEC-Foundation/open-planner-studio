import { resolveCornerRadii, type CornerRadii, type Draw2D, type TextAlign, type TextBaseline } from './draw2d';

/**
 * SVG-backend voor `Draw2D` (issue #817): het rapportpapier op het scherm als vectortekening.
 *
 * WAAROM een derde backend naast canvas (raster) en pdf-lib (vector-PDF): de oude preview was een
 * PNG per pagina. Die is korrelig, je kunt er niet op inzoomen en een klik weet niet wat er staat.
 * Deze backend neemt precies dezelfde tekenaanroepen van `renderReport` op als de canvas- en de
 * PDF-backend, en zet ze om naar SVG-elementen. Daardoor is het papier op het scherm scherp op elke
 * zoom en blijft het gelijk aan de PDF: dezelfde renderer, dezelfde tekstmeting (de lettermaten uit het
 * fontbestand, `reportTextMeasure.ts`, ook in de vector-PDF) en dezelfde bladindeling (`TileLayout`).
 *
 * De opname is één keer per instellingenwijziging; daarna haalt `reportPageSvg` per zichtbaar blad
 * alleen de opdrachten op die in de vensters van dat blad vallen (een ruimtelijke index op y). Zo
 * blijft ook een planning van duizenden taken snel: een blad bevat alleen zijn eigen rijen.
 *
 * Coördinaten zijn LOGISCHE px (dezelfde eenheid als de andere backends). Er is geen transformatie
 * en geen clip in `Draw2D`; een venster op een blad is een geneste `<svg>` met een `viewBox`, die
 * vanzelf afknipt.
 */

/** Tekstmeting en basislijn, gelijk aan wat de canvas-backend met dezelfde letter zou doen. */
export interface SvgTextMetrics {
  /** Breedte van `text` in de CSS-letter `font` (logische px). */
  measure(text: string, font: string): number;
  /**
   * Afstand (logische px, positief = omlaag) van de tekenlijn die `baseline` aanwijst naar de
   * alfabetische basislijn. `alphabetic` ⇒ 0. SVG kent geen betrouwbare equivalent van canvas'
   * `middle`/`bottom`, dus de opname schuift elke tekst zelf naar de alfabetische basislijn.
   */
  baselineShift(font: string, baseline: TextBaseline): number;
}

/** Eén opgenomen tekenopdracht. `b` is de omhullende in logische px: [x0, y0, x1, y1]. */
export type SvgOp =
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; dash?: string; b: Bounds }
  | { k: 'path'; d: string; fill?: string; stroke?: string; lw?: number; dash?: string; b: Bounds }
  | { k: 'text'; x: number; y: number; text: string; font: number; fill: string; anchor: 'start' | 'middle' | 'end'; b: Bounds };

export type Bounds = [number, number, number, number];

/** Getallen in de SVG: twee decimalen is ruim genoeg (0,01 logische px) en houdt de tekst klein. */
function n(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

/**
 * Neemt de tekenaanroepen van `renderReport` op. De stijl-eigenschappen volgen de canvas-API, net als
 * bij de andere backends: wat hier ingesteld staat op het moment van `fill`/`stroke`/`fillText`
 * hoort bij die opdracht.
 */
export class SvgRecordingDraw2D implements Draw2D {
  readonly ops: SvgOp[] = [];
  /** De unieke letters, in volgorde van eerste gebruik; een tekstopdracht wijst er een index in aan. */
  readonly fonts: string[] = [];
  private readonly fontIndex = new Map<string, number>();

  // Dezelfde beginwaarden als een verse CanvasRenderingContext2D.
  font = '10px sans-serif';
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;
  textAlign: TextAlign = 'left';
  textBaseline: TextBaseline = 'alphabetic';
  private dash = '';

  private path = '';
  private px0 = Infinity;
  private py0 = Infinity;
  private px1 = -Infinity;
  private py1 = -Infinity;

  constructor(
    readonly width: number,
    readonly height: number,
    private readonly metrics: SvgTextMetrics,
  ) {}

  setLineDash(segments: number[]): void {
    this.dash = segments.length > 0 && segments.some(s => s > 0) ? segments.map(n).join(' ') : '';
  }

  // ---- rects ----
  fillRect(x: number, y: number, w: number, h: number): void {
    const r = normRect(x, y, w, h);
    if (r.w === 0 || r.h === 0) return;
    this.ops.push({ k: 'rect', ...r, fill: this.fillStyle, b: [r.x, r.y, r.x + r.w, r.y + r.h] });
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    const r = normRect(x, y, w, h);
    const half = this.lineWidth / 2;
    this.ops.push({
      k: 'rect', ...r, stroke: this.strokeStyle, lw: this.lineWidth, ...(this.dash ? { dash: this.dash } : {}),
      b: [r.x - half, r.y - half, r.x + r.w + half, r.y + r.h + half],
    });
  }

  // ---- paths ----
  beginPath(): void {
    this.path = '';
    this.px0 = Infinity; this.py0 = Infinity; this.px1 = -Infinity; this.py1 = -Infinity;
  }

  moveTo(x: number, y: number): void { this.path += `M${n(x)} ${n(y)}`; this.grow(x, y); }
  lineTo(x: number, y: number): void { this.path += `L${n(x)} ${n(y)}`; this.grow(x, y); }
  closePath(): void { if (this.path) this.path += 'Z'; }

  fill(): void {
    if (!this.path) return;
    this.ops.push({ k: 'path', d: this.path, fill: this.fillStyle, b: [this.px0, this.py0, this.px1, this.py1] });
  }

  stroke(): void {
    if (!this.path) return;
    const half = this.lineWidth / 2;
    this.ops.push({
      k: 'path', d: this.path, stroke: this.strokeStyle, lw: this.lineWidth, ...(this.dash ? { dash: this.dash } : {}),
      b: [this.px0 - half, this.py0 - half, this.px1 + half, this.py1 + half],
    });
  }

  /**
   * Afgeronde rechthoek, met dezelfde betekenis als de canvas-backend: begint een nieuw pad, elke
   * straal begrensd op de halve breedte/hoogte, `w < 0` tekent niets. De hoeken zijn kwartcirkels
   * (wat `arcTo` bij een rechte hoek ook tekent).
   */
  roundRect(x: number, y: number, w: number, h: number, r: CornerRadii): void {
    if (w < 0) return;
    const [tl, tr, br, bl] = resolveCornerRadii(r, w, h);
    this.beginPath();
    const arc = (rad: number, ex: number, ey: number) => (rad > 0 ? `A${n(rad)} ${n(rad)} 0 0 1 ${n(ex)} ${n(ey)}` : `L${n(ex)} ${n(ey)}`);
    this.path = `M${n(x + tl)} ${n(y)}`
      + `L${n(x + w - tr)} ${n(y)}` + arc(tr, x + w, y + tr)
      + `L${n(x + w)} ${n(y + h - br)}` + arc(br, x + w - br, y + h)
      + `L${n(x + bl)} ${n(y + h)}` + arc(bl, x, y + h - bl)
      + `L${n(x)} ${n(y + tl)}` + arc(tl, x + tl, y)
      + 'Z';
    this.grow(x, y);
    this.grow(x + w, y + h);
  }

  // ---- tekst ----
  fillText(text: string, x: number, y: number): void {
    if (!text) return;
    const width = this.metrics.measure(text, this.font);
    const baselineY = y + this.metrics.baselineShift(this.font, this.textBaseline);
    const anchor = this.textAlign === 'center' ? 'middle' : this.textAlign === 'right' ? 'end' : 'start';
    const x0 = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;
    const size = this.fontSize(this.font);
    this.ops.push({
      k: 'text', x, y: baselineY, text, font: this.fontId(this.font), fill: this.fillStyle, anchor,
      // Ruime omhullende: boven de basislijn één letterhoogte, eronder een derde.
      b: [x0, baselineY - size, x0 + width, baselineY + size * 0.35],
    });
  }

  measureText(text: string): { width: number } {
    return { width: this.metrics.measure(text, this.font) };
  }

  private readonly fontSizes = new Map<string, number>();
  private fontSize(font: string): number {
    let size = this.fontSizes.get(font);
    if (size === undefined) { size = fontPx(font); this.fontSizes.set(font, size); }
    return size;
  }

  private fontId(font: string): number {
    let id = this.fontIndex.get(font);
    if (id === undefined) {
      id = this.fonts.length;
      this.fonts.push(font);
      this.fontIndex.set(font, id);
    }
    return id;
  }

  private grow(x: number, y: number): void {
    if (x < this.px0) this.px0 = x;
    if (y < this.py0) this.py0 = y;
    if (x > this.px1) this.px1 = x;
    if (y > this.py1) this.py1 = y;
  }
}

function normRect(x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  return {
    x: w < 0 ? x + w : x,
    y: h < 0 ? y + h : y,
    w: Math.abs(w),
    h: Math.abs(h),
  };
}

/** De puntgrootte uit een CSS-letter als `bold 9px InterPDF, …` (terugval 10). */
export function fontPx(font: string): number {
  const m = /(\d+(?:\.\d+)?)px/.exec(font);
  return m ? Number(m[1]) : 10;
}

// ---- Opname met ruimtelijke index -----------------------------------------------------------------

/** Hoogte (logische px) van één emmer van de y-index. */
const BUCKET_PX = 256;
/** Een opdracht hoger dan dit (achtergrond, verticale rasterlijnen, weekendbanden) gaat in de lange lijst. */
const TALL_PX = BUCKET_PX * 4;

/** Een opgenomen rapport: alle opdrachten plus een index om per venster snel te selecteren. */
export interface RecordedReport {
  width: number;
  height: number;
  ops: readonly SvgOp[];
  fonts: readonly string[];
  /** Indexen van opdrachten per y-emmer (alleen niet-hoge opdrachten). */
  buckets: ReadonlyMap<number, readonly number[]>;
  /** Indexen van hoge opdrachten; die worden per venster lineair op x gefilterd. */
  tall: readonly number[];
}

export function indexRecording(rec: SvgRecordingDraw2D): RecordedReport {
  const buckets = new Map<number, number[]>();
  const tall: number[] = [];
  rec.ops.forEach((op, i) => {
    const [, y0, , y1] = op.b;
    if (y1 - y0 > TALL_PX) { tall.push(i); return; }
    const first = Math.floor(y0 / BUCKET_PX);
    const last = Math.floor(y1 / BUCKET_PX);
    for (let bkt = first; bkt <= last; bkt++) {
      const list = buckets.get(bkt);
      if (list) list.push(i);
      else buckets.set(bkt, [i]);
    }
  });
  return { width: rec.width, height: rec.height, ops: rec.ops, fonts: rec.fonts, buckets, tall };
}

/** De opdrachten (indexen, in tekenvolgorde) die het bronvenster raken. */
export function opsInWindow(rec: RecordedReport, x0: number, y0: number, x1: number, y1: number): number[] {
  const hit = new Set<number>();
  const overlaps = (op: SvgOp) => op.b[2] >= x0 && op.b[0] <= x1 && op.b[3] >= y0 && op.b[1] <= y1;
  for (const i of rec.tall) if (overlaps(rec.ops[i])) hit.add(i);
  const first = Math.floor(y0 / BUCKET_PX);
  const last = Math.floor(y1 / BUCKET_PX);
  for (let bkt = first; bkt <= last; bkt++) {
    for (const i of rec.buckets.get(bkt) ?? []) if (!hit.has(i) && overlaps(rec.ops[i])) hit.add(i);
  }
  return [...hit].sort((a, b) => a - b);
}

// ---- Serialisatie ------------------------------------------------------------------------------

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(text: string): string {
  return esc(text).replace(/"/g, '&quot;');
}

function paintAttrs(op: { fill?: string; stroke?: string; lw?: number; dash?: string }): string {
  if (op.stroke !== undefined) {
    return ` fill="none" stroke="${escAttr(op.stroke)}" stroke-width="${n(op.lw ?? 1)}"${op.dash ? ` stroke-dasharray="${op.dash}"` : ''}`;
  }
  return ` fill="${escAttr(op.fill ?? '#000000')}"`;
}

/**
 * Eén opdracht als SVG-element. Een tekst verwijst naar zijn letterklasse (`<prefix><index>`).
 *
 * `rtl`: het blad staat in een rechts-naar-linkstaal. Canvas en PDF ordenen gemengde tekst dan met
 * basisrichting rtl, maar `textAlign` links/rechts blijft daar absoluut. In SVG hangt `text-anchor`
 * aan de schrijfrichting (`start` = rechts in rtl), dus het anker wisselt hier om: de linkerrand
 * blijft de linkerrand.
 */
export function opToSvg(op: SvgOp, classPrefix: string, rtl = false): string {
  switch (op.k) {
    case 'rect':
      return `<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}"${paintAttrs(op)}/>`;
    case 'path':
      return `<path d="${op.d}"${paintAttrs(op)}/>`;
    case 'text': {
      const anchor = rtl && op.anchor !== 'middle' ? (op.anchor === 'start' ? 'end' : 'start') : op.anchor;
      return `<text class="${classPrefix}${op.font}" x="${n(op.x)}" y="${n(op.y)}"${anchor === 'start' ? '' : ` text-anchor="${anchor}"`} fill="${escAttr(op.fill)}">${esc(op.text)}</text>`;
    }
  }
}

/** Een kleur zonder doorzichtigheid: dan is één samengevoegd pad gelijk aan losse opdrachten. */
function isOpaque(color: string | undefined): boolean {
  if (!color) return false;
  const c = color.trim().toLowerCase();
  if (c === 'transparent' || c.startsWith('rgba') || c.startsWith('hsla')) return false;
  if (c.startsWith('#')) return c.length === 4 || c.length === 7;
  return true;
}

/** Sleutel waarop opeenvolgende opdrachten samen één `<path>` mogen worden, of `null`. */
function mergeKey(op: SvgOp): string | null {
  // Lijnen: één pad met meerdere subpaden tekent hetzelfde als losse paden (geen vulregel, dekkende kleur).
  if (op.k === 'path' && op.stroke !== undefined && isOpaque(op.stroke)) return `s|${op.stroke}|${op.lw ?? 1}|${op.dash ?? ''}`;
  // Gevulde rechthoeken: allemaal met de klok mee, dus ook overlappend geen gaten (nonzero).
  if (op.k === 'rect' && op.stroke === undefined && isOpaque(op.fill)) return `f|${op.fill}`;
  return null;
}

function mergedD(op: SvgOp): string {
  if (op.k === 'path') return op.d;
  // Een opgenomen rechthoek heeft altijd een positieve maat (`normRect` bij het opnemen), dus elk
  // subpad draait met de klok mee en overlap slaat geen gat.
  if (op.k === 'rect') return `M${n(op.x)} ${n(op.y)}h${n(op.w)}v${n(op.h)}h${n(-op.w)}Z`;
  return '';
}

/**
 * Opdrachten als SVG-elementen, in tekenvolgorde. Opeenvolgende lijnen met dezelfde stijl en
 * opeenvolgende dekkende rechthoeken met dezelfde kleur worden één `<path>`: een Gantt-blad heeft
 * honderden rasterlijnen en celranden, en minder elementen maakt het inlezen en tekenen in de browser
 * veel sneller. De volgorde verandert niet, dus wat erboven lag blijft erboven liggen.
 */
export function opsToSvg(ops: readonly SvgOp[], classPrefix: string, rtl = false): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    const key = mergeKey(op);
    if (key === null) { out.push(opToSvg(op, classPrefix, rtl)); i++; continue; }
    let j = i + 1;
    while (j < ops.length && mergeKey(ops[j]) === key) j++;
    if (j - i === 1) { out.push(opToSvg(op, classPrefix, rtl)); i = j; continue; }
    let d = '';
    for (let k = i; k < j; k++) d += mergedD(ops[k]);
    const paint = op.k === 'path'
      ? { stroke: op.stroke, lw: op.lw, dash: op.dash }
      : { fill: op.fill };
    out.push(`<path d="${d}"${paintAttrs(paint)}/>`);
    i = j;
  }
  return out;
}

/**
 * De letterklassen van een opname als CSS. `font` is de canvas-letter (`bold 9px InterPDF, …`); de
 * CSS-`font`-shorthand leest exact dezelfde schrijfwijze. Kerning staat uit, net als in de
 * canvas-backend en de PDF (die tellen advances zonder kerning); `white-space: pre` houdt spaties
 * zoals canvas ze tekent. `geometricPrecision`: zonder die regel zet Chromium kleine tekst (een blad op
 * schermgrootte, 8 px × schaal) per teken op hele pixels, en dan vallen er gaten in woorden.
 */
export function fontClassCss(fonts: readonly string[], classPrefix: string): string {
  return fonts.map((font, i) => `.${classPrefix}${i}{font:${font}}`).join('')
    + 'text{font-kerning:none;white-space:pre;text-rendering:geometricPrecision}';
}
