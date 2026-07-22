/**
 * `PdfVectorDraw2D` — de pdf-lib-VECTOR-backend voor {@link Draw2D} (§4.2 ontwerpdoc). Waar de
 * canvas-backend rechtstreeks tekent, néémt deze backend elke teken-primitief op als een lijst
 * pdf-lib-`PDFOperator`s. Die operatoren worden door de vector-pagineerder (`paginateVector.ts`)
 * exact één keer in een Form-XObject gebakken (G1: O(taken×dagen), niet O(tegels×taken×dagen)) en
 * per pagina onder een eigen `q cm W n … Q` ge-`Do`'d.
 *
 * Coördinatenstelsel: de renderer werkt in LOGISCHE px met y-omlaag (canvas-conventie). PDF is
 * y-omhoog. Deze backend klapt elke y om via `y' = H - y` (H = logische hoogte); tekst blijft
 * daardoor rechtop (de baseline zit op `H - baselineY`, glyphs groeien omhoog = omhoog op scherm).
 * Het XObject krijgt dus BBox `[0,0,W,H]` en identiteits-Matrix; de per-pagina `cm` doet alleen
 * schaal + tegel-offset (géén flip meer).
 *
 * Puur browser (pdf-lib/fontkit) — geen Tauri-imports; lazy geladen in de export-tak.
 */
import {
  PDFFont, PDFOperator,
  pushGraphicsState, popGraphicsState, setGraphicsState,
  setFillingRgbColor, setStrokingRgbColor, setLineWidth, setDashPattern,
  moveTo, lineTo, closePath, appendBezierCurve, rectangle, fill, stroke,
  beginText, endText, setFontAndSize, setTextMatrix, showText,
} from 'pdf-lib';
import type { Draw2D, TextAlign, TextBaseline } from './draw2d';

/** Bezier-benadering van een kwart-cirkel: controle-afstand = kappa × r. */
const KAPPA = 0.5522847498307936;

/** Geparste kleur, componenten 0..1. */
interface RGBA { r: number; g: number; b: number; a: number }

/**
 * De resource-pool die de vector-pagineerder aanlevert: de twee ingebedde Inter-gewichten plus een
 * fabriek voor ExtGState-alpha's. `PdfVectorDraw2D` registreert alleen; de pool bezit de pdf-lib-
 * `PDFDocument`-context en levert de resource-dict voor het XObject.
 */
export interface PdfResourcePool {
  regular: PDFFont;
  bold: PDFFont;
  /**
   * Registreer (met dedup) een ExtGState met vul- én lijn-alpha `alpha` (0..1) en geef de resource-
   * sleutel terug (bv. `'GA0'`). Wordt door {@link buildResourcesDict} in de XObject-resources gezet.
   */
  registerAlpha(alpha: number): string;
}

/** Per-gewicht font-metrics (em-fracties) voor baseline-omrekening. */
interface FontMetrics { ascentEm: number; descentEm: number }

function readMetrics(font: PDFFont): FontMetrics {
  // De CustomFontEmbedder houdt de fontkit-font in `.embedder.font` (unitsPerEm/ascent/descent).
  const fk = (font as unknown as { embedder: { font: { unitsPerEm: number; ascent: number; descent: number; bbox: { maxY: number; minY: number } } } }).embedder.font;
  const upem = fk.unitsPerEm || 1000;
  const ascent = fk.ascent || fk.bbox.maxY;
  const descent = fk.descent || fk.bbox.minY; // negatief
  return { ascentEm: ascent / upem, descentEm: descent / upem };
}

/**
 * Parse een CSS-kleur naar {r,g,b,a} in 0..1. Ondersteunt de vormen die `printPreview.ts` gebruikt:
 * `#rgb`, `#rrggbb`, `#rrggbbaa` (bv. `'#10B981' + '40'`), `rgb(...)` en `rgba(...)`.
 */
export function parseColor(css: string): RGBA {
  const s = css.trim();
  if (s[0] === '#') {
    const hex = s.slice(1);
    const h = (i: number, n: number) => parseInt(hex.substr(i, n), 16);
    if (hex.length === 3) return { r: h(0, 1) * 17 / 255, g: h(1, 1) * 17 / 255, b: h(2, 1) * 17 / 255, a: 1 };
    if (hex.length === 6) return { r: h(0, 2) / 255, g: h(2, 2) / 255, b: h(4, 2) / 255, a: 1 };
    if (hex.length === 8) return { r: h(0, 2) / 255, g: h(2, 2) / 255, b: h(4, 2) / 255, a: h(6, 2) / 255 };
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(',').map(p => p.trim());
    return {
      r: (parseFloat(parts[0]) || 0) / 255,
      g: (parseFloat(parts[1]) || 0) / 255,
      b: (parseFloat(parts[2]) || 0) / 255,
      a: parts.length > 3 ? (parseFloat(parts[3]) || 0) : 1,
    };
  }
  // Onbekend → ondoorzichtig zwart (mag nooit voorkomen in de renderer, maar faalt niet stil zichtbaar).
  return { r: 0, g: 0, b: 0, a: 1 };
}

/** Ontleed een canvas-`font`-string (bv. `"9px InterPDF…"`, `"bold 9px …"`) naar gewicht + px-grootte. */
function parseFont(css: string): { bold: boolean; size: number } {
  const bold = /(^|\s)(bold|[6-9]00)(\s|$)/i.test(css);
  const m = css.match(/(\d+(?:\.\d+)?)px/);
  return { bold, size: m ? parseFloat(m[1]) : 10 };
}

export class PdfVectorDraw2D implements Draw2D {
  /** De opgenomen operator-lijst (leest de pagineerder uit voor het Form-XObject). */
  readonly operators: PDFOperator[] = [];

  // Draw2D-stijlvelden (property-setters, net als de canvas-backend).
  font = '10px sans-serif';
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;
  textAlign: TextAlign = 'left';
  textBaseline: TextBaseline = 'alphabetic';

  private readonly H: number;
  private readonly pool: PdfResourcePool;
  private readonly mReg: FontMetrics;
  private readonly mBold: FontMetrics;
  private dash: number[] = [];
  /** Pad-buffer (geflipte pad-operatoren) sinds de laatste beginPath/roundRect; pas bij fill/stroke geëmit. */
  private pathBuf: PDFOperator[] = [];

  constructor(logicalW: number, logicalH: number, pool: PdfResourcePool) {
    void logicalW;
    this.H = logicalH;
    this.pool = pool;
    this.mReg = readMetrics(pool.regular);
    this.mBold = readMetrics(pool.bold);
  }

  private flipY(y: number): number { return this.H - y; }

  setLineDash(segments: number[]): void { this.dash = segments.slice(); }

  // ---- rects ----
  fillRect(x: number, y: number, w: number, h: number): void {
    // Canvas-rect [y..y+h] omlaag → PDF-rect met oorsprong linksonder (x, H-(y+h)), breedte w, hoogte h.
    this.paintFill([rectangle(x, this.flipY(y + h), w, h)], this.fillStyle);
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.paintStroke([rectangle(x, this.flipY(y + h), w, h)], this.strokeStyle);
  }

  // ---- paths ----
  beginPath(): void { this.pathBuf = []; }
  moveTo(x: number, y: number): void { this.pathBuf.push(moveTo(x, this.flipY(y))); }
  lineTo(x: number, y: number): void { this.pathBuf.push(lineTo(x, this.flipY(y))); }
  closePath(): void { this.pathBuf.push(closePath()); }
  fill(): void { this.paintFill(this.pathBuf, this.fillStyle); }
  stroke(): void { this.paintStroke(this.pathBuf, this.strokeStyle); }

  /**
   * Afgeronde rechthoek — reproduceert `CanvasDraw2D.roundRect` (arcTo-variant) met bezier-hoeken
   * (kappa). Zet — net als de canvas-backend — een nieuw (subpad-)pad klaar; de aanroeper doet
   * daarna `fill()`. Guard `w<0`, `r = min(r, w/2, h/2)`. Bouwt in canvas-coördinaten en flipt elke y.
   */
  roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.pathBuf = [];
    if (w < 0) return;
    r = Math.min(r, w / 2, h / 2);
    const c = KAPPA * r;
    const fy = (yy: number) => this.flipY(yy);
    const P = this.pathBuf;
    // start midden-boven-links, met de klok mee (canvas-conventie), y geflipt bij emit.
    P.push(moveTo(x + r, fy(y)));
    P.push(lineTo(x + w - r, fy(y)));
    P.push(appendBezierCurve(x + w - r + c, fy(y), x + w, fy(y + r - c), x + w, fy(y + r)));       // TR
    P.push(lineTo(x + w, fy(y + h - r)));
    P.push(appendBezierCurve(x + w, fy(y + h - r + c), x + w - r + c, fy(y + h), x + w - r, fy(y + h))); // BR
    P.push(lineTo(x + r, fy(y + h)));
    P.push(appendBezierCurve(x + r - c, fy(y + h), x, fy(y + h - r + c), x, fy(y + h - r)));       // BL
    P.push(lineTo(x, fy(y + r)));
    P.push(appendBezierCurve(x, fy(y + r - c), x + r - c, fy(y), x + r, fy(y)));                   // TL
    P.push(closePath());
  }

  // ---- tekst ----
  fillText(text: string, x: number, y: number): void {
    if (!text) return;
    const { bold, size } = parseFont(this.font);
    const pdfFont = bold ? this.pool.bold : this.pool.regular;
    const metrics = bold ? this.mBold : this.mReg;
    const width = pdfFont.widthOfTextAtSize(text, size);

    // Horizontale uitlijning via x-offset op de gemeten breedte.
    let tx = x;
    if (this.textAlign === 'center') tx = x - width / 2;
    else if (this.textAlign === 'right') tx = x - width;

    // Verticale baseline. Canvas-y betekent, afhankelijk van textBaseline, een andere lijn; reken om
    // naar de alfabetische baseline (B, canvas-y) via de font-metrics.
    const ascentPx = metrics.ascentEm * size;
    const descentPx = metrics.descentEm * size; // negatief
    let baselineY = y; // 'alphabetic'
    if (this.textBaseline === 'middle') baselineY = y + (ascentPx + descentPx) / 2;
    else if (this.textBaseline === 'bottom') baselineY = y + descentPx;

    const c = parseColor(this.fillStyle);
    const textOps: PDFOperator[] = [
      beginText(),
      setFontAndSize(bold ? 'F1' : 'F0', size),
      setTextMatrix(1, 0, 0, 1, tx, this.flipY(baselineY)),
      showText(pdfFont.encodeText(text)),
      endText(),
    ];
    if (c.a < 1) {
      const gs = this.pool.registerAlpha(c.a);
      this.operators.push(
        pushGraphicsState(), setGraphicsState(gs),
        setFillingRgbColor(c.r, c.g, c.b), ...textOps,
        popGraphicsState(),
      );
    } else {
      this.operators.push(setFillingRgbColor(c.r, c.g, c.b), ...textOps);
    }
  }

  measureText(text: string): { width: number } {
    const { bold, size } = parseFont(this.font);
    const pdfFont = bold ? this.pool.bold : this.pool.regular;
    return { width: pdfFont.widthOfTextAtSize(text, size) };
  }

  // ---- interne paint-helpers ----
  private paintFill(pathOps: PDFOperator[], colorStr: string): void {
    if (pathOps.length === 0) return;
    const c = parseColor(colorStr);
    if (c.a < 1) {
      const gs = this.pool.registerAlpha(c.a);
      this.operators.push(
        pushGraphicsState(), setGraphicsState(gs),
        setFillingRgbColor(c.r, c.g, c.b), ...pathOps, fill(),
        popGraphicsState(),
      );
    } else {
      this.operators.push(setFillingRgbColor(c.r, c.g, c.b), ...pathOps, fill());
    }
  }

  private paintStroke(pathOps: PDFOperator[], colorStr: string): void {
    if (pathOps.length === 0) return;
    const c = parseColor(colorStr);
    const pre: PDFOperator[] = [
      setStrokingRgbColor(c.r, c.g, c.b),
      setLineWidth(this.lineWidth),
      setDashPattern(this.dash, 0),
    ];
    if (c.a < 1) {
      const gs = this.pool.registerAlpha(c.a);
      this.operators.push(pushGraphicsState(), setGraphicsState(gs), ...pre, ...pathOps, stroke(), popGraphicsState());
    } else {
      this.operators.push(...pre, ...pathOps, stroke());
    }
  }
}
