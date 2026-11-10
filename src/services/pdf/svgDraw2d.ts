import { resolveCornerRadii, type CornerRadii, type Draw2D, type TextAlign, type TextBaseline } from './draw2d';
import { isRtlReportFont, reportTextFont } from './reportFont';

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
  | {
    k: 'path'; d: string; fill?: string; stroke?: string; lw?: number; dash?: string; b: Bounds;
    /** Bij een pad van alleen `M`/`L`: de punten per subpad (x, y, x, y, …), om zonder ontleden af te knippen. */
    pts?: number[][];
  }
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
  /** De punten van het pad per subpad, zolang het alleen `M`/`L` bevat; anders `null`. */
  private pts: number[][] | null = [];
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
    this.pts = [];
    this.px0 = Infinity; this.py0 = Infinity; this.px1 = -Infinity; this.py1 = -Infinity;
  }

  moveTo(x: number, y: number): void {
    this.path += `M${n(x)} ${n(y)}`;
    this.pts?.push([x, y]);
    this.grow(x, y);
  }
  lineTo(x: number, y: number): void {
    this.path += `L${n(x)} ${n(y)}`;
    if (this.pts) {
      const last = this.pts[this.pts.length - 1];
      if (last) last.push(x, y);
      else this.pts = null;
    }
    this.grow(x, y);
  }
  closePath(): void { if (this.path) this.path += 'Z'; this.pts = null; }

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
      // Een kopie: een pad mag na `stroke()` doorlopen, en de opname moet bij deze `d` blijven passen.
      ...(this.pts ? { pts: this.pts.map(line => line.slice()) } : {}),
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
    this.pts = null;
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
      // De letter waarmee de browser deze tekst tekent: voor Arabisch of Hebreeuws Noto vooraan, zoals de
      // PDF (`reportTextFont`). De meting hierboven krijgt de gewone letter; die kiest zelf.
      k: 'text', x, y: baselineY, text, font: this.fontId(reportTextFont(text, this.font)), fill: this.fillStyle, anchor,
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

// ---- Afknippen op een venster -------------------------------------------------------------------

/**
 * Hoeveel logische px een afgeknipte lijn of rechthoek buiten het venster doorloopt: ruim meer dan de
 * halve lijndikte plus de rand van de anti-aliasing, dus het knippunt valt altijd buiten beeld.
 */
const CLIP_PAD_PX = 4;

type Pt = { x: number; y: number };

/** De periode van een streeppatroon ("4 2" ⇒ 6; een oneven lijst herhaalt zich, "3" ⇒ 6), of 0. */
function dashPeriod(dash: string): number {
  const parts = dash.split(/[ ,]+/).map(Number).filter(v => Number.isFinite(v) && v >= 0);
  const sum = parts.reduce((a, b) => a + b, 0);
  return parts.length % 2 === 1 ? sum * 2 : sum;
}

/** De punten van een pad uit alleen `M`/`L`, per subpad; `null` bij een boog, `Z` of iets anders. */
function polylines(d: string): Pt[][] | null {
  if (!/^[ML0-9 .eE+-]*$/.test(d)) return null;
  const lines: Pt[][] = [];
  const re = /([ML])\s*(-?[0-9.]+(?:[eE][+-]?[0-9]+)?)\s+(-?[0-9.]+(?:[eE][+-]?[0-9]+)?)/g;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(d)) !== null) {
    if (m.index !== consumed) return null;
    consumed = re.lastIndex;
    const p = { x: Number(m[2]), y: Number(m[3]) };
    if (m[1] === 'M') lines.push([p]);
    else if (lines.length === 0) return null;
    else lines[lines.length - 1].push(p);
  }
  return consumed === d.length ? lines : null;
}

/**
 * Een opdracht afgeknipt op het venster `[x0, x1] × [y0, y1]` (plus `CLIP_PAD_PX`), of `null` als er
 * niets van overblijft. Waarom: een rasterlijn of weekendband loopt over de hele hoogte van het rapport
 * (bij 5000 taken 120.000 px). Op het blad knipt de geneste `<svg>` hem wel af, maar de browser rastert
 * elk element over zijn hele omhullende: zo kostte één schermtegel tot 0,6 s en sprong het papier traag.
 * Afgeknipt blijft binnen het venster elk pixel gelijk.
 *
 * Alleen wat zeker gelijk blijft wordt afgeknipt: rechthoeken, en lijnen van rechte stukken (`M`/`L`).
 * Van een lijn vallen alleen het begin en het eind buiten het venster weg; de hoeken ertussen blijven.
 * Een gestreepte lijn begint dan op een hele periode van het oude begin, zodat de strepen op dezelfde
 * plek blijven. Een boog, een gesloten of een gevuld pad blijft heel (balken en ruiten zijn klein).
 */
export function clipOpToWindow(op: SvgOp, x0: number, y0: number, x1: number, y1: number): SvgOp | null {
  if (op.k === 'text') return op;
  // Duizenden aanroepen per blad: eerst met losse getallen, objecten alleen voor de zeldzame vormen.
  const pad = CLIP_PAD_PX + (op.lw ?? 0);
  const lx = x0 - pad;
  const ly = y0 - pad;
  const hx = x1 + pad;
  const hy = y1 + pad;
  const bb = op.b;
  if (bb[0] >= lx && bb[1] >= ly && bb[2] <= hx && bb[3] <= hy) return op;
  if (op.k === 'rect') {
    // Een gestreepte rand loopt rondom; afknippen zou de strepen verschuiven.
    if (op.dash) return op;
    const rx0 = Math.max(op.x, lx);
    const ry0 = Math.max(op.y, ly);
    const rx1 = Math.min(op.x + op.w, hx);
    const ry1 = Math.min(op.y + op.h, hy);
    if (rx1 <= rx0 || ry1 <= ry0) return null;
    return { ...op, x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0, b: [rx0, ry0, rx1, ry1] };
  }
  // Een gevuld pad sluit zichzelf: stukken eraf knippen zou de vorm veranderen.
  if (op.stroke === undefined) return op;
  const pts = op.pts;
  if (pts && pts.length === 1 && pts[0].length === 4) return clipSingleLine(op, pts[0], x0, y0, x1, y1, lx, ly, hx, hy);
  const lo = { x: lx, y: ly };
  const hi = { x: hx, y: hy };
  const lines = op.pts ? op.pts.map(flat => {
    const line: Pt[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) line.push({ x: flat[i], y: flat[i + 1] });
    return line;
  }) : polylines(op.d);
  if (!lines) return op;
  const period = op.dash ? dashPeriod(op.dash) : 0;
  if (op.dash && !(period > 0)) return op;
  let d = '';
  const box: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (p: Pt, cmd: 'M' | 'L') => {
    d += `${cmd}${n(p.x)} ${n(p.y)}`;
    box[0] = Math.min(box[0], p.x); box[1] = Math.min(box[1], p.y);
    box[2] = Math.max(box[2], p.x); box[3] = Math.max(box[3], p.y);
  };
  for (const line of lines) {
    // Een los `M` tekent niets.
    if (line.length < 2) continue;
    // Afstand langs het subpad tot elk punt, en het stuk dat het venster raakt (eerste intrede, laatste
    // uittrede). Alleen het begin en het eind vallen weg; het midden en de hoeken blijven zoals ze waren.
    const along = [0];
    for (let i = 1; i < line.length; i++) along.push(along[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y));
    let sIn = Infinity;
    let sOut = -Infinity;
    for (let i = 1; i < line.length; i++) {
      const t = clipSegment(line[i - 1], line[i], lo, hi);
      if (!t) continue;
      const len = along[i] - along[i - 1];
      sIn = Math.min(sIn, along[i - 1] + t[0] * len);
      sOut = Math.max(sOut, along[i - 1] + t[1] * len);
    }
    if (!(sIn <= sOut)) continue;
    // Gestreept: het subpad begint op een hele periode van het oude begin, dus de strepen blijven staan
    // (SVG en PDF beginnen het patroon bij elk subpad opnieuw).
    const sStart = period > 0 ? Math.floor(sIn / period) * period : sIn;
    const at = (s: number): Pt => {
      for (let i = 1; i < line.length; i++) {
        if (s <= along[i] || i === line.length - 1) {
          const len = along[i] - along[i - 1];
          const t = len > 0 ? Math.min(1, Math.max(0, (s - along[i - 1]) / len)) : 0;
          return { x: line[i - 1].x + (line[i].x - line[i - 1].x) * t, y: line[i - 1].y + (line[i].y - line[i - 1].y) * t };
        }
      }
      return line[0];
    };
    add(at(sStart), 'M');
    for (let i = 1; i < line.length - 1; i++) if (along[i] > sStart && along[i] < sOut) add(line[i], 'L');
    add(at(sOut), 'L');
  }
  if (!d) return null;
  const half = (op.lw ?? 0) / 2;
  const { pts: _unclipped, ...rest } = op;
  return { ...rest, d, b: [box[0] - half, box[1] - half, box[2] + half, box[3] + half] };
}

const dashPeriods = new Map<string, number>();

/** `n(v)` met een geheugen van twee waarden: in één venster krijgen duizenden lijnen dezelfde twee uiteinden. */
const numMemo = { a: Number.NaN, aText: '', b: Number.NaN, bText: '', next: 0 };
function numText(v: number): string {
  if (v === numMemo.a) return numMemo.aText;
  if (v === numMemo.b) return numMemo.bText;
  const text = n(v);
  if (numMemo.next === 0) { numMemo.a = v; numMemo.aText = text; } else { numMemo.b = v; numMemo.bText = text; }
  numMemo.next = 1 - numMemo.next;
  return text;
}

/**
 * De snelle weg van {@link clipOpToWindow} voor één lijnstuk (de rasterlijnen: duizenden per blad), zonder
 * tussenobjecten. Een horizontaal of verticaal stuk dat het venster zelf langs zijn richting alleen raakt
 * (de rasterlijnen beginnen precies op de onderrand van de kop), tekent daar niets: zijn uiteinden zijn
 * plat. Dat stuk valt weg.
 */
function clipSingleLine(
  op: Extract<SvgOp, { k: 'path' }>, p: readonly number[], x0: number, y0: number, x1: number, y1: number,
  lx: number, ly: number, hx: number, hy: number,
): SvgOp | null {
  const ax = p[0]; const ay = p[1]; const bx = p[2]; const by = p[3];
  if (ax === bx && ay !== by && Math.min(Math.max(ay, by), y1) - Math.max(Math.min(ay, by), y0) <= 0) return null;
  if (ay === by && ax !== bx && Math.min(Math.max(ax, bx), x1) - Math.max(Math.min(ax, bx), x0) <= 0) return null;
  // Een ongestreepte rechte lijn (verreweg de meeste: het raster): de vaste coördinaat staat al als tekst
  // in de opgenomen `d` (`M<x> <y>L<x> <y>`), en de afgeknipte uiteinden zijn per venster dezelfde.
  if (!op.dash && (ax === bx || ay === by) && op.d.charCodeAt(0) === 77 /* M */) {
    const space = op.d.indexOf(' ');
    const ell = op.d.indexOf('L', space);
    if (space > 0 && ell > space) {
      const half = (op.lw ?? 0) / 2;
      if (ax === bx) {
        if (ax < lx || ax > hx) return null;
        const s = Math.max(Math.min(ay, by), ly);
        const e = Math.min(Math.max(ay, by), hy);
        if (e <= s) return null;
        const xs = op.d.slice(1, space);
        return { k: 'path', d: `M${xs} ${numText(s)}L${xs} ${numText(e)}`, stroke: op.stroke, lw: op.lw, b: [ax - half, s, ax + half, e] };
      }
      if (ay < ly || ay > hy) return null;
      const s = Math.max(Math.min(ax, bx), lx);
      const e = Math.min(Math.max(ax, bx), hx);
      if (e <= s) return null;
      const ys = op.d.slice(space + 1, ell);
      return { k: 'path', d: `M${numText(s)} ${ys}L${numText(e)} ${ys}`, stroke: op.stroke, lw: op.lw, b: [s, ay - half, e, ay + half] };
    }
  }
  // Liang–Barsky op de rechthoek met marge.
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const edge = (pp: number, q: number): boolean => {
    if (pp === 0) return q >= 0;
    const r = q / pp;
    if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (!edge(-dx, ax - lx) || !edge(dx, hx - ax) || !edge(-dy, ay - ly) || !edge(dy, hy - ay)) return null;
  if (op.dash && t0 > 0) {
    let period = dashPeriods.get(op.dash);
    if (period === undefined) { period = dashPeriod(op.dash); dashPeriods.set(op.dash, period); }
    if (!(period > 0)) return op;
    const len = Math.hypot(dx, dy);
    t0 = len > 0 ? (Math.floor((t0 * len) / period) * period) / len : 0;
  }
  const sx = ax + dx * t0; const sy = ay + dy * t0;
  const ex = ax + dx * t1; const ey = ay + dy * t1;
  const half = (op.lw ?? 0) / 2;
  return {
    k: 'path', d: `M${n(sx)} ${n(sy)}L${n(ex)} ${n(ey)}`, stroke: op.stroke, lw: op.lw, ...(op.dash ? { dash: op.dash } : {}),
    b: [Math.min(sx, ex) - half, Math.min(sy, ey) - half, Math.max(sx, ex) + half, Math.max(sy, ey) + half],
  };
}

/** Het deel `[t0, t1]` (0 = `a`, 1 = `b`) van een lijnstuk binnen de rechthoek `lo`–`hi` (Liang–Barsky), of `null`. */
function clipSegment(a: Pt, b: Pt, lo: Pt, hi: Pt): [number, number] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - lo.x, hi.x - a.x, a.y - lo.y, hi.y - a.y];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [t0, t1];
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
export function opToSvg(op: SvgOp, classPrefix: FontClasses, rtl = false): string {
  switch (op.k) {
    case 'rect':
      return `<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}"${paintAttrs(op)}/>`;
    case 'path':
      return `<path d="${op.d}"${paintAttrs(op)}/>`;
    case 'text': {
      const anchor = rtl && op.anchor !== 'middle' ? (op.anchor === 'start' ? 'end' : 'start') : op.anchor;
      return `<text class="${fontClassOf(classPrefix, op.font)}" x="${n(op.x)}" y="${n(op.y)}"${anchor === 'start' ? '' : ` text-anchor="${anchor}"`} fill="${escAttr(op.fill)}">${esc(op.text)}</text>`;
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

/** Lijnen of vlakken in één dekkende kleur: daarbinnen maakt de volgorde voor de pixels niets uit. */
function colorKey(op: SvgOp): string | null {
  if (op.k === 'path' && op.stroke !== undefined && isOpaque(op.stroke)) return `s|${op.stroke}`;
  if (op.k === 'rect' && op.stroke === undefined && isOpaque(op.fill)) return `f|${op.fill}`;
  return null;
}

/**
 * Opdrachten als SVG-elementen, in tekenvolgorde. Opeenvolgende lijnen in dezelfde dekkende kleur worden
 * één `<path>` per lijnstijl (dikte en streep), opeenvolgende dekkende rechthoeken in dezelfde kleur één
 * `<path>`: een Gantt-blad heeft duizenden rasterlijnen en celranden (bij een lange planning om en om dun
 * en dik), en minder elementen maakt het inlezen, opmaken en tekenen in de browser veel sneller. Binnen
 * zo'n reeks van één kleur maakt de volgorde niet uit (dezelfde kleur over dezelfde kleur); wat ervoor
 * of erna komt, blijft eronder of erboven liggen.
 */
export function opsToSvg(ops: readonly SvgOp[], classPrefix: FontClasses, rtl = false): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    const color = colorKey(op);
    if (color === null) { out.push(opToSvg(op, classPrefix, rtl)); i++; continue; }
    let j = i + 1;
    while (j < ops.length && colorKey(ops[j]) === color) j++;
    // Per lijnstijl, in de volgorde van eerste voorkomen.
    const groups = new Map<string, SvgOp[]>();
    for (let k = i; k < j; k++) {
      const key = mergeKey(ops[k])!;
      const list = groups.get(key);
      if (list) list.push(ops[k]);
      else groups.set(key, [ops[k]]);
    }
    for (const list of groups.values()) {
      const first = list[0];
      if (list.length === 1) { out.push(opToSvg(first, classPrefix, rtl)); continue; }
      let d = '';
      for (const item of list) d += mergedD(item);
      const paint = first.k === 'path'
        ? { stroke: first.stroke, lw: first.lw, dash: first.dash }
        : { fill: first.k === 'rect' ? first.fill : undefined };
      out.push(`<path d="${d}"${paintAttrs(paint)}/>`);
    }
    i = j;
  }
  return out;
}

/**
 * De letterklasse van een tekst: een voorvoegsel plus de index in de letterlijst van de opname, of een
 * lijst klassenamen per index (`reportFontClass`).
 */
export type FontClasses = string | readonly string[];

function fontClassOf(classes: FontClasses, font: number): string {
  return typeof classes === 'string' ? `${classes}${font}` : (classes[font] ?? `rf${font}`);
}

/**
 * De klassenaam van één CSS-letter, afgeleid van de letter zelf (FNV-1a): dezelfde letter heeft in elke
 * opname en op elk blad dezelfde klasse. Zo kan één gedeelde stijlregel per letter alle bladen opmaken,
 * in plaats van een `<style>` per blad (elke nieuwe `<style>` laat de browser het hele document opnieuw
 * opmaken).
 */
export function reportFontClass(font: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < font.length; i++) {
    h ^= font.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `rf${(h >>> 0).toString(36)}`;
}

/**
 * De vaste tekstregel van het papier. Kerning staat uit, net als in de canvas-backend en de PDF (die
 * tellen advances zonder kerning; tekst met Arabisch of Hebreeuws kernt wel, zie {@link reportFontRule});
 * `white-space: pre` houdt spaties zoals canvas ze tekent.
 * `geometricPrecision`: zonder die regel zet Chromium kleine tekst (een blad op schermgrootte, 8 px ×
 * schaal) per teken op hele pixels, en dan vallen er gaten in woorden. Alleen voor tekst op een blad:
 * een `<style>` in een SVG geldt voor het hele document.
 */
export const REPORT_PAGE_TEXT_RULE = 'svg[data-report-page-svg] text{font-kerning:none;white-space:pre;text-rendering:geometricPrecision}';

/**
 * De regel voor één letterklasse. `font` is de canvas-letter (`bold 9px InterPDF, …`); de
 * CSS-`font`-shorthand leest exact dezelfde schrijfwijze.
 *
 * De letter van een tekst met Arabisch of Hebreeuws (`rtlReportFont`) tekent met kerning: de PDF zet zo'n
 * tekst via `fontkit.layout` en dat kernt. Die regel moet zwaarder wegen dan {@link REPORT_PAGE_TEXT_RULE},
 * en blijft één regel (`insertRule` in `paperFontRules.ts` neemt er één tegelijk).
 */
export function reportFontRule(font: string): string {
  const cls = reportFontClass(font);
  return isRtlReportFont(font)
    ? `svg[data-report-page-svg] text.${cls}{font:${font};font-kerning:normal}`
    : `.${cls}{font:${font}}`;
}

/** De letterklassen van een opname als CSS (`reportFontRule` per letter), met de vaste tekstregel. */
export function fontClassCss(fonts: readonly string[]): string {
  return fonts.map(reportFontRule).join('') + REPORT_PAGE_TEXT_RULE;
}
