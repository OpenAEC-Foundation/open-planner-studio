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
  PDFFont, PDFOperator, PDFHexString,
  pushGraphicsState, popGraphicsState, setGraphicsState,
  setFillingRgbColor, setStrokingRgbColor, setLineWidth, setDashPattern,
  moveTo, lineTo, closePath, appendBezierCurve, rectangle, fill, stroke,
  beginText, endText, setFontAndSize, setTextMatrix, showText,
} from 'pdf-lib';
import type { Draw2D, TextAlign, TextBaseline } from './draw2d';
import {
  shapeAndPlace, isArabicScriptCp, isNeutralCp,
  type ShapingFonts, type ShapedRun, type FontKey,
} from './bidiShape';

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

/**
 * Eén geplaatst tekst-blok, uit het gedeelde Form-XObject gehaald (fase 2.1). De {@link PdfVectorDraw2D}
 * bakt tekst NIET meer mee in het XObject (dat zou z'n hele tekstlaag op elke tegel dupliceren bij
 * extractie); i.p.v. dat levert hij per `fillText` een placement met (a) de kant-en-klare low-level
 * tekst-operatoren (kleur/alpha + `BT…ET`, met een `setTextMatrix` in absolute XObject-coördinaten) en
 * (b) de bron-bounding-box in ONgeflipte report-px (canvas, y-omlaag). De pagineerder emit elke
 * placement onder EXACT dezelfde `cm`+clip als het XObject `Do`, maar alleen op de tegel(s) wiens
 * bron-venster de bbox raakt — zo landt de tekst pixel-identiek als in fase 2, maar zonder duplicatie.
 */
export interface PdfTextPlacement {
  /** Bron-bbox in report-px (canvas, y-omlaag): [x0,x1]×[y0,y1]. Bepaalt op welke tegel de tekst hoort. */
  x0: number; y0: number; x1: number; y1: number;
  /** Self-contained tekst-operatoren (setFillingRgbColor + evt. q/gs…Q rond BT…ET). */
  ops: PDFOperator[];
}

/** Per-gewicht font-metrics (em-fracties) voor baseline-omrekening. */
interface FontMetrics { ascentEm: number; descentEm: number }

/**
 * De subset van de fontkit-font-API die deze backend gebruikt (metrics + glyph-dekking + shaping).
 * `layout` maakt 'm ook bruikbaar als {@link ShapingFonts}-lid voor het complexe (RTL/gemengde) pad.
 */
interface FontkitFont {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  bbox: { maxY: number; minY: number };
  /** True als het font een echte (niet-`.notdef`) glyph heeft voor deze Unicode-codepoint. */
  hasGlyphForCodePoint(codePoint: number): boolean;
  /** fontkit-shaping (zie {@link ShapingFonts}); 5e arg stuurt de richting. */
  layout(
    string: string,
    features?: unknown,
    script?: unknown,
    language?: unknown,
    direction?: 'ltr' | 'rtl',
  ): {
    glyphs: Array<{ id: number }>;
    positions: Array<{ xAdvance: number; xOffset?: number; yOffset?: number }>;
  };
}

/** De twee gevendorde Noto-Sans-Arabic fontkit-fonts (Regular + Bold) voor RTL-shaping/-dekking. */
export interface ArabicShapingFonts {
  regular: FontkitFont;
  bold: FontkitFont;
}

/**
 * Eén CJK-font (uit een {@link file://./fontRegistry.ts}-provider) zoals de vector-pagineerder 'm aan
 * `PdfVectorDraw2D` aanreikt. `fk`/`fkBold` (fontkit) zijn ALTIJD aanwezig — nodig voor coverage én
 * breedte-meting (`measureText`) in de eerste pass, vóór er iets ingebed is. `embed` is er pas in de
 * TWEEDE pass (ná HarfBuzz-subset + `embedFont`): dán bevat het de ingebedde `PDFFont`s + hun
 * resource-sleutels (F4/F5, F6/F7, … per provider), waarmee CJK-tekst via `encodeText`+`showText`
 * geëmit wordt. Zonder `embed` (pass 1) verzamelt de backend alleen de gebruikte codepoints.
 */
export interface CjkVectorFont {
  /** Provider-id (diagnose). */
  id: string;
  /** Snelle dekkings-voorfilter van de provider (nog geverifieerd tegen `fk.hasGlyphForCodePoint`). */
  covers(codepoint: number): boolean;
  /** fontkit Regular-font (coverage + breedte-meting; character-map = gewicht-onafhankelijk). */
  fk: FontkitFont;
  /** fontkit Bold-font. */
  fkBold: FontkitFont;
  /** Alleen in pass 2: de ingebedde (gesubsette) PDF-fonts + hun resource-sleutels. */
  embed?: {
    regular: PDFFont;
    bold: PDFFont;
    keyRegular: string;
    keyBold: string;
  };
}

/** Haal de door de CustomFontEmbedder gehouden fontkit-font uit een pdf-lib-`PDFFont`. */
function fontkitOf(font: PDFFont): FontkitFont {
  // De CustomFontEmbedder (subset:false) houdt de fontkit-font in `.embedder.font`.
  return (font as unknown as { embedder: { font: FontkitFont } }).embedder.font;
}

function readMetrics(fk: FontkitFont): FontMetrics {
  const upem = fk.unitsPerEm || 1000;
  const ascent = fk.ascent || fk.bbox.maxY;
  const descent = fk.descent || fk.bbox.minY; // negatief
  return { ascentEm: ascent / upem, descentEm: descent / upem };
}

/**
 * RTL-codepoint? (Arabisch + Hebreeuws, incl. presentatievormen). Puur vooruit-vlag: in v1 dekt Inter
 * deze scripts tóch niet, dus ze vallen sowieso al onder `uncoveredCodepoints`; de aparte `hasRtl`-vlag
 * laat een latere bidi/shaping-laag (fase na v1) onderscheiden "ongedekt Latijns rariteitje" van "RTL".
 */
function isRtlCodepoint(cp: number): boolean {
  return (
    (cp >= 0x0590 && cp <= 0x05FF) || // Hebreeuws
    (cp >= 0x0600 && cp <= 0x06FF) || // Arabisch
    (cp >= 0x0750 && cp <= 0x077F) || // Arabic Supplement
    (cp >= 0x08A0 && cp <= 0x08FF) || // Arabic Extended-A
    (cp >= 0xFB50 && cp <= 0xFDFF) || // Arabic Presentation Forms-A
    (cp >= 0xFE70 && cp <= 0xFEFF)    // Arabic Presentation Forms-B
  );
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
  /** De opgenomen VORM-operatoren (leest de pagineerder uit voor het gedeelde Form-XObject). */
  readonly operators: PDFOperator[] = [];
  /** De opgenomen TEKST-placements (per tegel geplaatst door de pagineerder; NIET in het XObject). */
  readonly texts: PdfTextPlacement[] = [];

  // Draw2D-stijlvelden (property-setters, net als de canvas-backend).
  font = '10px sans-serif';
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;
  textAlign: TextAlign = 'left';
  textBaseline: TextBaseline = 'alphabetic';

  /**
   * Codepoints die het ingebedde Inter-font NIET dekt (geen echte glyph → zou als `.notdef`/tofu
   * renderen bij `subset:false`). De pagineerder gooit een {@link VectorUnsupportedError} zodra deze
   * set niet leeg is, zodat de export terugvalt op raster (dat CJK/RTL via de browser wél tekent).
   * Wordt tijdens `fillText` gevuld en dekt zo ALLE getekende tekst (Gantt én tabellen).
   */
  readonly uncoveredCodepoints = new Set<number>();
  /** True zodra een RTL-codepoint (Arabisch/Hebreeuws) getekend is — vooruit-vlag voor een latere bidi-laag. */
  hasRtl = false;
  /**
   * True zodra er via het complexe pad daadwerkelijk een Arabische/Perzische glyph (font-key F2/F3)
   * geplaatst is. De pagineerder bedt Noto ALLEEN dan in (en zet F2/F3 in de resources), zodat een
   * puur-Latijnse export géén Noto-font meedraagt (geen bloat, geen dangling resource-refs).
   */
  usedArabic = false;
  /**
   * Gebruikte CJK-codepoints per provider-index (⇒ de HarfBuzz-subset-set van de pagineerder). Wordt in
   * BEIDE passes gevuld tijdens `fillText`, zodat de pagineerder ná pass 1 exact weet welke glyphs elk
   * providerfont moet behouden. Leeg ⇒ geen CJK getekend ⇒ geen subset/embed (geen bloat).
   */
  readonly usedCjkCodepoints = new Map<number, Set<number>>();
  /** True zodra er een CJK-codepoint (door een provider gedekt) getekend is. Stuurt de twee-pass-keuze. */
  usedCjk = false;

  private readonly H: number;
  private readonly pool: PdfResourcePool;
  private readonly fkReg: FontkitFont;
  private readonly fkBold: FontkitFont;
  private readonly mReg: FontMetrics;
  private readonly mBold: FontMetrics;
  /** De CJK-fonts (per provider) — fontkit voor coverage/meting, `embed` pas in pass 2 (emissie). */
  private readonly cjkFonts: CjkVectorFont[];
  /** True als ELKE CJK-font z'n `embed` heeft (pass 2) → CJK-tekst wordt daadwerkelijk geëmit. */
  private readonly cjkEmbedReady: boolean;
  /** Basisrichting van de export-taal (`RTL_LOCALES` ⇒ `'rtl'`). Stuurt bidi in het complexe pad. */
  private readonly baseDir: 'ltr' | 'rtl';
  /** De vier fontkit-fonts (Latijn×gewicht + Arabisch×gewicht) voor het complexe pad; undefined ⇒ geen Noto. */
  private readonly shapingFonts?: ShapingFonts;
  /** Noto-fontkit voor coverage-checks (character-map is gewicht-onafhankelijk → Regular volstaat). */
  private readonly fkArabic?: FontkitFont;
  /**
   * Per-codepoint dekkingscache (`cp → gedekt?`). Een grote planning tekent duizenden labels met veel
   * herhaalde tekens; zonder cache zou elke `fillText` z'n hele string opnieuw tegen fontkit opzoeken.
   * Inter-Regular en -Bold delen dezelfde character-set, dus één cache over beide gewichten volstaat.
   */
  private readonly coverageCache = new Map<number, boolean>();
  /**
   * Aparte dekkingscache voor het RTL/complexe pad (zie {@link checkCoverageComplex}). Die kent een
   * ANDERE dekkingsregel dan {@link coverageCache}: in het complexe pad tellen CJK-providers NIET mee
   * (het pad tekent uitsluitend via Inter/Noto), dus een CJK-codepoint is daar ongedekt terwijl hij in
   * de gedeelde cache "gedekt" (provider) zou staan. Een aparte cache voorkomt kruisbesmetting.
   */
  private readonly coverageCacheComplex = new Map<number, boolean>();
  private dash: number[] = [];
  /** Pad-buffer (geflipte pad-operatoren) sinds de laatste beginPath/roundRect; pas bij fill/stroke geëmit. */
  private pathBuf: PDFOperator[] = [];

  constructor(
    logicalW: number,
    logicalH: number,
    pool: PdfResourcePool,
    baseDir: 'ltr' | 'rtl' = 'ltr',
    arabicFonts?: ArabicShapingFonts,
    cjkFonts?: CjkVectorFont[],
  ) {
    void logicalW;
    this.H = logicalH;
    this.pool = pool;
    this.fkReg = fontkitOf(pool.regular);
    this.fkBold = fontkitOf(pool.bold);
    this.mReg = readMetrics(this.fkReg);
    this.mBold = readMetrics(this.fkBold);
    this.cjkFonts = cjkFonts ?? [];
    this.cjkEmbedReady = this.cjkFonts.length > 0 && this.cjkFonts.every(c => c.embed !== undefined);
    this.baseDir = baseDir;
    if (arabicFonts) {
      this.fkArabic = arabicFonts.regular;
      this.shapingFonts = {
        latinRegular: this.fkReg,
        latinBold: this.fkBold,
        arabicRegular: arabicFonts.regular,
        arabicBold: arabicFonts.bold,
      };
    }
  }

  /**
   * Registreer de glyph-dekking van `text` (per codepoint) tegen het ingebedde Inter-font `fk`.
   * Ongedekte codepoints landen in {@link uncoveredCodepoints}; RTL-codepoints zetten {@link hasRtl}.
   * Itereert per Unicode-codepoint (`for…of`), dus surrogaat-paren (astrale CJK) tellen als één cp.
   */
  private checkCoverage(text: string, fk: FontkitFont): void {
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      if (isRtlCodepoint(cp)) this.hasRtl = true;
      let covered = this.coverageCache.get(cp);
      if (covered === undefined) {
        // Multi-font: een codepoint is "gedekt" als Inter ÓF Noto-Arabic (indien aanwezig) ÓF een
        // geregistreerde CJK-provider 'm heeft. Zo vallen Arabisch/Perzisch (Noto) én CJK (provider)
        // niet in `uncoveredCodepoints` (→ vector), terwijl Hebreeuws en CJK-zónder-provider — door
        // niets gedekt — ongedekt blijven (→ raster-fallback).
        covered =
          fk.hasGlyphForCodePoint(cp) ||
          (this.fkArabic?.hasGlyphForCodePoint(cp) ?? false) ||
          this.cjkProviderIndexFor(cp) >= 0;
        this.coverageCache.set(cp, covered);
      }
      if (!covered) this.uncoveredCodepoints.add(cp);
    }
  }

  /**
   * Coverage-check voor het RTL/COMPLEXE pad (G-1). Cruciaal verschil met {@link checkCoverage}: het
   * complexe pad ({@link fillTextComplex} → {@link shapeAndPlace}) tekent ELKE codepoint via één van de
   * twee shaping-fonts — Inter (font-klasse `latin`) of Noto-Arabic (`arabic`) — en NOOIT via een
   * CJK-provider. `bidiShape.fontClassFor` klasseert een niet-Arabisch, niet-neutraal teken (dus óók
   * Han/Kana/Hangul) als `latin` → Inter shapet 'm → `.notdef`/tofu, terwijl {@link checkCoverage} 'm
   * via de provider als "gedekt" zou zien. Zo'n string levert dus STIL tofu.
   *
   * Fix: verifieer per codepoint of het font van z'n eigen font-klasse de glyph ÉCHT heeft. Zo niet →
   * in {@link uncoveredCodepoints}, zodat de coverage-poort van de pagineerder `VectorUnsupportedError`
   * gooit en de export op RASTER terugvalt (dat mengscripts wél correct via de browser tekent).
   *
   * De klasse-toewijzing spiegelt {@link file://./bidiShape.ts}'s `fontClassFor` (zelfde helpers, geen
   * drift): Arabisch-script → Noto; neutraal → Noto óf (als Noto 'm mist) Inter — dus gedekt zodra één
   * van beide 'm heeft; al het overige (Latijn, cijfers, CJK, …) → Inter. Gevolg per vereiste:
   *   • puur-Arabisch, Arabisch+Latijn(+cijfers), puur-Latijn → elk teken door z'n font gedekt → vector;
   *   • Arabisch+CJK → het CJK-teken valt in `latin`-klasse, Inter mist 'm → ongedekt → raster (geen tofu).
   */
  private checkCoverageComplex(text: string, bold: boolean): void {
    const latinFk = bold ? this.fkBold : this.fkReg;
    const arabicHas = (cp: number) => this.fkArabic?.hasGlyphForCodePoint(cp) ?? false;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      if (isRtlCodepoint(cp)) this.hasRtl = true;
      let covered = this.coverageCacheComplex.get(cp);
      if (covered === undefined) {
        if (isArabicScriptCp(cp)) {
          covered = arabicHas(cp);                       // → Noto (F2/F3)
        } else if (isNeutralCp(cp)) {
          covered = latinFk.hasGlyphForCodePoint(cp) || arabicHas(cp); // → Inter óf Noto
        } else {
          covered = latinFk.hasGlyphForCodePoint(cp);    // → Inter (F0/F1); CJK mist hier → ongedekt
        }
        this.coverageCacheComplex.set(cp, covered);
      }
      if (!covered) this.uncoveredCodepoints.add(cp);
    }
  }

  /**
   * Index van de eerste geregistreerde CJK-provider die `cp` echt dekt (`covers()` én een niet-`.notdef`
   * fontkit-glyph), of −1. Gebruikt door coverage (→ vector i.p.v. raster) én door het run-splitsen in
   * {@link fillTextCjk} (welk providerfont een teken tekent).
   */
  private cjkProviderIndexFor(cp: number): number {
    for (let i = 0; i < this.cjkFonts.length; i++) {
      const c = this.cjkFonts[i];
      if (c.covers(cp) && c.fk.hasGlyphForCodePoint(cp)) return i;
    }
    return -1;
  }

  /**
   * True als `text` minstens één teken bevat dat Inter NIET dekt maar een CJK-provider WÉL. Zo blijft
   * puur-Latijnse tekst op het onveranderde snelpad (byte-identiek aan vóór CJK) en gaat alleen echte
   * gemengd/CJK-tekst door het (LTR, niet-bidi) run-splitsende CJK-pad.
   */
  private textHasCjk(text: string): boolean {
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      if (!this.fkReg.hasGlyphForCodePoint(cp) && this.cjkProviderIndexFor(cp) >= 0) return true;
    }
    return false;
  }

  /** Verzamel de door CJK-providers gedekte codepoints van `text` per provider-index (voor de subset-set). */
  private collectCjkCodepoints(text: string): void {
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      if (this.fkReg.hasGlyphForCodePoint(cp)) continue; // Latijn/cijfers → Inter, geen CJK-subset nodig
      const idx = this.cjkProviderIndexFor(cp);
      if (idx < 0) continue;
      let set = this.usedCjkCodepoints.get(idx);
      if (!set) { set = new Set<number>(); this.usedCjkCodepoints.set(idx, set); }
      set.add(cp);
      this.usedCjk = true;
    }
  }

  /** Breedte (in `size`-eenheden) van een tekst-run op een fontkit-font (horizontaal, som van advances). */
  private fkRunWidth(fk: FontkitFont, str: string, size: number): number {
    const run = fk.layout(str);
    let adv = 0;
    for (const p of run.positions) adv += p.xAdvance;
    return (adv * size) / (fk.unitsPerEm || 1000);
  }

  /** True als `text` minstens één RTL-codepoint bevat (trigger voor het complexe bidi/shaping-pad). */
  private hasRtlText(text: string): boolean {
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined && isRtlCodepoint(cp)) return true;
    }
    return false;
  }

  /**
   * Complexe (RTL/gemengde) shaping: draai `text` door de bidi/shaping-kern en geef de runs in visuele
   * volgorde + de totale breedte (= som van de run-breedtes, multi-font). Gedeeld door {@link fillText}
   * (emissie) en {@link measureText} (metrics) zodat afkap/paginering exact op de emissie aansluit.
   */
  private shapeComplex(text: string, bold: boolean, size: number): { runs: ShapedRun[]; width: number } {
    const runs = shapeAndPlace(text, this.baseDir, size, this.shapingFonts!, bold);
    let width = 0;
    for (const r of runs) width += r.width;
    return { runs, width };
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

    // Complex pad: bevat de string RTL (Arabisch/Perzisch) én zijn de shaping-fonts beschikbaar, dan
    // gaat de tekst door de bidi/shaping-kern en wordt PER GLYPH geplaatst (het `/W`-tabel-contract:
    // rauwe geshapte GID's zonder per-glyph-matrix vallen op `/DW` → losgekoppelde letters). Zonder
    // shaping-fonts (of geen RTL) valt hij door naar het onveranderde Latijnse snelpad hieronder.
    // Coverage MOET hier via {@link checkCoverageComplex} (G-1): dit pad tekent nooit via een CJK-
    // provider, dus een codepoint die enkel een provider dekt (Han in een Arabisch+CJK-label) is hier
    // ongedekt → coverage-poort → raster, i.p.v. Inter 'm als tofu te laten shapen.
    if (this.shapingFonts && this.hasRtlText(text)) {
      this.checkCoverageComplex(text, bold);
      this.fillTextComplex(text, x, y, bold, size, metrics);
      return;
    }

    // Niet-complex pad (Latijn/CJK, LTR): glyph-dekking checken vóór het encoden. Een ongedekte
    // codepoint mapt bij subset:false op `.notdef` (tofu) zónder fout; de pagineerder leest
    // `uncoveredCodepoints` uit en faalt bewust, zodat de raster-fallback aanslaat i.p.v. tofu.
    this.checkCoverage(text, bold ? this.fkBold : this.fkReg);

    // CJK-pad (LTR, géén bidi/shaping — horizontale CJK is codepoint→glyph): bevat de string tekens die
    // Inter niet dekt maar een provider wél, dan verzamelen we altijd de gebruikte codepoints (voor de
    // subset-set) en emitteren — zodra de providerfonts ingebed zijn (pass 2) — via het providerfont.
    // In pass 1 (nog geen embed) verzamelen we enkel: de operatoren van pass 1 worden tóch weggegooid.
    if (this.textHasCjk(text)) {
      this.collectCjkCodepoints(text);
      if (this.cjkEmbedReady) this.fillTextCjk(text, x, y, bold, size, metrics);
      return;
    }

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
    // Self-contained op-blok: kleur (+ evt. alpha via q/gs…Q) rond BT…ET. De pagineerder emit dit
    // ONVERANDERD onder de tegel-`cm`+clip, zodat de tekst pixel-identiek landt als toen hij in het
    // XObject zat (setTextMatrix staat in absolute XObject-coördinaten).
    let ops: PDFOperator[];
    if (c.a < 1) {
      const gs = this.pool.registerAlpha(c.a);
      ops = [
        pushGraphicsState(), setGraphicsState(gs),
        setFillingRgbColor(c.r, c.g, c.b), ...textOps,
        popGraphicsState(),
      ];
    } else {
      ops = [setFillingRgbColor(c.r, c.g, c.b), ...textOps];
    }

    // Bron-bbox in report-px (canvas, y-omlaag) voor de tegel-toewijzing: horizontaal [tx, tx+width];
    // verticaal de glyf-extent rond de baseline (ascenders omhoog = kleinere y, descenders omlaag =
    // grotere y). Zo emit de pagineerder de tekst op precies die tegels waar z'n glyphs zichtbaar zijn.
    this.texts.push({
      x0: tx,
      x1: tx + width,
      y0: baselineY - ascentPx,
      y1: baselineY - descentPx,
      ops,
    });
  }

  /**
   * Complex (RTL/gemengd) tekst-pad: shape via de bidi/shaping-kern en emit ELKE glyph op z'n eigen
   * tekst-matrix (`setTextMatrix` + `showText(<hex>)`) — bewust NIET één `showText` per run, want de
   * `/W`-breedtetabel van pdf-lib dekt alleen via `encodeText` geregistreerde glyphs; rauwe geshapte
   * GID's zouden op `/DW=1000` vallen en de Arabische letters losgekoppeld tekenen (RTL-1 bewees dit).
   * Per run een `setFontAndSize(fontKey,…)` (F0/F1 Latijn, F2/F3 Noto); de kleur/alpha net als het snelpad.
   */
  private fillTextComplex(
    text: string, x: number, y: number, bold: boolean, size: number, metrics: FontMetrics,
  ): void {
    const { runs, width } = this.shapeComplex(text, bold, size);
    if (runs.length === 0) return;

    // Uitlijning op de totale (multi-font) breedte — zo landt rechts-uitgelijnde RTL-tekst correct.
    let tx = x;
    if (this.textAlign === 'center') tx = x - width / 2;
    else if (this.textAlign === 'right') tx = x - width;

    // Baseline-omrekening identiek aan het snelpad (Latijnse metrics → consistente rij-uitlijning).
    const ascentPx = metrics.ascentEm * size;
    const descentPx = metrics.descentEm * size; // negatief
    let baselineY = y; // 'alphabetic'
    if (this.textBaseline === 'middle') baselineY = y + (ascentPx + descentPx) / 2;
    else if (this.textBaseline === 'bottom') baselineY = y + descentPx;
    const pdfBaselineY = this.flipY(baselineY); // PDF y-omhoog

    // Per-glyph emissie binnen één BT…ET. `glyph.x` = tekst-lokale x vanaf de plaatsings-oorsprong;
    // `glyph.y` = baseline-relatieve GPOS-offset (positief = omhoog → in PDF y-omhoog optellen).
    const textOps: PDFOperator[] = [beginText()];
    for (const run of runs) {
      if (run.fontKey === 'F2' || run.fontKey === 'F3') this.usedArabic = true;
      textOps.push(setFontAndSize(run.fontKey as FontKey, size));
      for (const g of run.glyphs) {
        textOps.push(
          setTextMatrix(1, 0, 0, 1, tx + g.x, pdfBaselineY + g.y),
          showText(PDFHexString.of(g.hex)),
        );
      }
    }
    textOps.push(endText());

    const c = parseColor(this.fillStyle);
    let ops: PDFOperator[];
    if (c.a < 1) {
      const gs = this.pool.registerAlpha(c.a);
      ops = [
        pushGraphicsState(), setGraphicsState(gs),
        setFillingRgbColor(c.r, c.g, c.b), ...textOps,
        popGraphicsState(),
      ];
    } else {
      ops = [setFillingRgbColor(c.r, c.g, c.b), ...textOps];
    }

    // Bron-bbox (report-px, y-omlaag) over de hele tekstplaatsing — voor de per-tegel-emissie.
    this.texts.push({
      x0: tx,
      x1: tx + width,
      y0: baselineY - ascentPx,
      y1: baselineY - descentPx,
      ops,
    });
  }

  /**
   * CJK-tekst-pad (LTR, niet-bidi): splits `text` in maximale runs van gelijke font-toewijzing (Inter
   * vs. één CJK-provider), emit per run een `setFontAndSize(fontKey) + Tm + encodeText`-blok op de
   * cumulatieve x. Zelfde baseline-omrekening + kleur/alpha-wrapping + bron-bbox-model als het snelpad,
   * zodat de pagineerder 'm identiek per tegel plaatst. Alleen aangeroepen als de providerfonts ingebed
   * zijn (pass 2), dus elke CJK-run heeft gegarandeerd een `embed`.
   */
  private fillTextCjk(
    text: string, x: number, y: number, bold: boolean, size: number, metrics: FontMetrics,
  ): void {
    const runs = this.splitCjkRuns(text);
    if (runs.length === 0) return;

    // Breedtes per run + totaal (voor uitlijning). Latijn via de PDF-font-metrics, CJK via fontkit —
    // identiek aan {@link measureText}, zodat afkap/paginering op de emissie aansluiten.
    const widths = runs.map(r => this.cjkRunWidth(r, bold, size));
    let total = 0;
    for (const w of widths) total += w;

    let tx = x;
    if (this.textAlign === 'center') tx = x - total / 2;
    else if (this.textAlign === 'right') tx = x - total;

    const ascentPx = metrics.ascentEm * size;
    const descentPx = metrics.descentEm * size; // negatief
    let baselineY = y; // 'alphabetic'
    if (this.textBaseline === 'middle') baselineY = y + (ascentPx + descentPx) / 2;
    else if (this.textBaseline === 'bottom') baselineY = y + descentPx;
    const pdfBaselineY = this.flipY(baselineY);

    const textOps: PDFOperator[] = [beginText()];
    let cursor = tx;
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const { fontKey, pdfFont } = this.cjkRunFont(r, bold);
      textOps.push(
        setFontAndSize(fontKey, size),
        setTextMatrix(1, 0, 0, 1, cursor, pdfBaselineY),
        showText(pdfFont.encodeText(r.str)),
      );
      cursor += widths[i];
    }
    textOps.push(endText());

    const c = parseColor(this.fillStyle);
    let ops: PDFOperator[];
    if (c.a < 1) {
      const gs = this.pool.registerAlpha(c.a);
      ops = [
        pushGraphicsState(), setGraphicsState(gs),
        setFillingRgbColor(c.r, c.g, c.b), ...textOps,
        popGraphicsState(),
      ];
    } else {
      ops = [setFillingRgbColor(c.r, c.g, c.b), ...textOps];
    }

    this.texts.push({
      x0: tx,
      x1: tx + total,
      y0: baselineY - ascentPx,
      y1: baselineY - descentPx,
      ops,
    });
  }

  /** Eén run in het CJK-pad: een span tekst die door één font (Inter of provider-`idx`) getekend wordt. */
  private splitCjkRuns(text: string): Array<{ latin: boolean; idx: number; str: string }> {
    const runs: Array<{ latin: boolean; idx: number; str: string }> = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      // Inter heeft voorrang (Latijn/cijfers in een CJK-label blijven op Inter). Anders de provider die
      // 'm dekt; dekt niets 'm (kan niet in pass 2, gate is al gepasseerd), dan als Inter (tofu).
      let latin = true;
      let idx = -1;
      if (!this.fkReg.hasGlyphForCodePoint(cp)) {
        const pi = this.cjkProviderIndexFor(cp);
        if (pi >= 0) { latin = false; idx = pi; }
      }
      const last = runs[runs.length - 1];
      if (last && last.latin === latin && last.idx === idx) last.str += ch;
      else runs.push({ latin, idx, str: ch });
    }
    return runs;
  }

  /** Breedte van een CJK-pad-run: Latijn via de PDF-font (kerning-consistent), CJK via fontkit-advances. */
  private cjkRunWidth(run: { latin: boolean; idx: number; str: string }, bold: boolean, size: number): number {
    if (run.latin) {
      const pdfFont = bold ? this.pool.bold : this.pool.regular;
      return pdfFont.widthOfTextAtSize(run.str, size);
    }
    const c = this.cjkFonts[run.idx];
    return this.fkRunWidth(bold ? c.fkBold : c.fk, run.str, size);
  }

  /** Font-resource-sleutel + PDF-font voor een CJK-pad-run (alleen pass 2 — `embed` is gegarandeerd). */
  private cjkRunFont(
    run: { latin: boolean; idx: number; str: string }, bold: boolean,
  ): { fontKey: string; pdfFont: PDFFont } {
    if (run.latin) {
      return bold
        ? { fontKey: 'F1', pdfFont: this.pool.bold }
        : { fontKey: 'F0', pdfFont: this.pool.regular };
    }
    const embed = this.cjkFonts[run.idx].embed!;
    return bold
      ? { fontKey: embed.keyBold, pdfFont: embed.bold }
      : { fontKey: embed.keyRegular, pdfFont: embed.regular };
  }

  measureText(text: string): { width: number } {
    const { bold, size } = parseFont(this.font);
    // Complex pad: dezelfde shaping-pijplijn als `fillText` → som van de run-breedtes (multi-font),
    // zodat `fitText`-afkapping/`drawBarLabel`/paginering exact op de emissie aansluiten.
    if (this.shapingFonts && this.hasRtlText(text)) {
      return { width: this.shapeComplex(text, bold, size).width };
    }
    // CJK-pad: som van de run-breedtes (Inter + providerfonts), consistent tussen beide render-passes
    // (fontkit-breedtes zijn in beide passes beschikbaar) zodat de paginering niet tussen de passes schuift.
    if (this.textHasCjk(text)) {
      let total = 0;
      for (const r of this.splitCjkRuns(text)) total += this.cjkRunWidth(r, bold, size);
      return { width: total };
    }
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
