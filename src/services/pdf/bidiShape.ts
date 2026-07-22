/**
 * `bidiShape` — de bidi + shaping-kern voor de RTL-vector-PDF-uitbreiding (§ RTL-ontwerp).
 *
 * Doel: een logische (opslag-volgorde) tekststring met GEMENGDE scripts (Latijn/cijfers + Arabisch/
 * Perzisch) omzetten naar een reeks {@link ShapedRun}s in VISUELE volgorde, elk met (a) de geshapte
 * glyph-id's als hex (voor `PDFHexString.of(...)` + `showText` op een Identity-H/CIDFontType2-font) en
 * (b) een tekst-lokale x-plaatsing. De aanroeper (RTL-2) emit per run een `BT … setTextMatrix … ET`.
 *
 * ## Waarom een eigen bidi-laag boven de font
 * pdf-lib's `encodeText` roept al `font.layout(text)` aan (fontkit-shaping), maar voor gemengde strings
 * doet fontkit GEEN bidi-segmentatie: het shapet de hele string in één richting → Latijnse stukken en
 * cijfers belanden verkeerd t.o.v. Arabische stukken. Daarom splitsen we hier eerst met de Unicode
 * Bidirectional Algorithm (via `bidi-js`) in runs van gelijk embedding-level, herordenen die runs naar
 * visuele volgorde (UBA-regel L2), en shapen dán elke run apart met de juiste richting én font.
 *
 * ## Glyph-emissie (contract met RTL-2)
 * Het CID-font wordt ingebed met `subset:false` → `Identity-H` + `CIDFontType2` + `CIDToGIDMap:Identity`,
 * dus CID == GID == fontkit `glyph.id`. Daardoor mag de aanroeper de geshapte glyph-id's rechtstreeks als
 * `PDFHexString.of(<4-hex GID's>)` aan `showText` geven — bewezen renderend in MuPDF/pdfium.
 *
 * Puur browser/headless — geen Tauri- en geen pdf-lib-imports; deze module levert PURE DATA en kent
 * alleen `bidi-js` + een minimale fontkit-font-interface (door de aanroeper geïnjecteerd). Zo is hij
 * los te unit-testen (esbuild + Node) én bundelt hij mee in de lazy export-chunk, niet de hoofdbundle.
 */
// `bidi-js` (v1.0.3, MIT) levert geen eigen type-declaraties. We importeren de factory untyped (de
// `@ts-expect-error` onderdrukt de "geen declaratie"-fout zónder een los .d.ts-bestand) en typen daarna
// lokaal alléén het stukje API dat we gebruiken: `getEmbeddingLevels(str, baseDir).levels` (UBA
// embedding-levels per UTF-16 code-unit).
// @ts-expect-error -- bidi-js heeft geen type-declaraties; hieronder lokaal getypeerd.
import bidiFactoryUntyped from 'bidi-js';

/** Het deel van de bidi-js-API dat deze module gebruikt. */
interface BidiApi {
  getEmbeddingLevels(
    text: string,
    baseDirection?: 'ltr' | 'rtl' | 'auto',
  ): { levels: Uint8Array };
}
const bidiFactory = bidiFactoryUntyped as unknown as () => BidiApi;

/** De minimale fontkit-font-API die deze module nodig heeft (metrics + shaping). */
export interface ShapeFontkitFont {
  unitsPerEm: number;
  /**
   * fontkit's `Font.layout(string, features?, script?, language?, direction?)`. 5e argument stuurt de
   * shaping-richting (`'ltr'`/`'rtl'`); de teruggegeven `GlyphRun` staat in VISUELE volgorde (leftmost
   * glyph eerst), met per glyph een `id` (GID) en per positie de (GPOS-)advances/offsets in font-units.
   */
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

/** De vier ingebedde fontkit-fonts, één per (script × gewicht). Sleutels mappen op de PDF-font-keys. */
export interface ShapingFonts {
  /** Latijns Regular → PDF-fontkey `F0`. */
  latinRegular: ShapeFontkitFont;
  /** Latijns Bold → `F1`. */
  latinBold: ShapeFontkitFont;
  /** Arabisch Regular → `F2`. */
  arabicRegular: ShapeFontkitFont;
  /** Arabisch Bold → `F3`. */
  arabicBold: ShapeFontkitFont;
}

/** PDF-font-resource-sleutel; correspondeert 1-op-1 met {@link ShapingFonts}. */
export type FontKey = 'F0' | 'F1' | 'F2' | 'F3';

/**
 * Eén geplaatste glyph binnen een run. Alle maten zijn AL geschaald naar `size`-eenheden (px/pt).
 * `x`/`y` zijn tekst-lokaal: `x` = som van voorafgaande advances (+ deze glyph z'n `xOffset`), gemeten
 * vanaf het begin van de tekstplaatsing; `y` = de GPOS-`yOffset` t.o.v. de baseline (positief = omhoog).
 */
export interface PlacedGlyph {
  /** fontkit glyph-id (== CID == GID bij `subset:false`/Identity). */
  gid: number;
  /** 4-hex uppercase GID, klaar voor `PDFHexString.of(...)`. */
  hex: string;
  /** Tekst-lokale x van de glyph-oorsprong (incl. `xOffset`), in `size`-eenheden. */
  x: number;
  /** Baseline-relatieve y-offset (GPOS `yOffset`), in `size`-eenheden. */
  y: number;
  /** Horizontale advance van deze glyph (GPOS-adjusted), in `size`-eenheden. */
  advance: number;
}

/**
 * Eén geshapte, geplaatste run in VISUELE volgorde. PURE DATA.
 *
 * **Emissie-contract (belangrijk).** pdf-lib bouwt de CID-`/W`-breedtetabel alléén voor glyphs die het
 * via `encodeText` zag; rauwe glyph-id's (zoals hier) staan er niet in, dus een viewer valt voor die
 * glyphs terug op `/DW` (=1000) → veel te brede advances → LOSGEKOPPELDE Arabische letters (empirisch
 * bevestigd, MuPDF). Emit daarom NIET één `showText` per run op de font-advances, maar plaats elke glyph
 * expliciet op zijn eigen tekst-matrix met de {@link PlacedGlyph}-`x`/`y` (viewer-onafhankelijk, honoreert
 * de geshapte/GPOS-advances): per glyph `1 0 0 1 (xText+glyph.x) (baseline+glyph.y) Tm  <hex> Tj`.
 * `glyphHex`/`width`/`xStart` blijven beschikbaar voor plaatsing/metrics op run-niveau.
 */
export interface ShapedRun {
  /** Aaneengeschakelde 4-hex GID's (uppercase) van de hele run — handig, maar zie de emissie-waarschuwing. */
  glyphHex: string;
  /** Per-glyph placement in visuele volgorde — de ROBUUSTE emissiebron (honoreert advances/offsets). */
  glyphs: PlacedGlyph[];
  /** Welke ingebedde font deze run tekent. */
  fontKey: FontKey;
  /** Linker-x van de run in tekst-lokale coördinaten (0 = begin van de tekstplaatsing). */
  xStart: number;
  /** Som-breedte van de run in dezelfde eenheid als `size` (font-units × size / upem, GPOS-advances mee). */
  width: number;
}

/** Ruwe per-run shaping-data (voor tests/diagnose): glyph-id's + advances in VISUELE run-volgorde. */
export interface RawRun {
  /** Bron-substring (logische volgorde) van deze run. */
  text: string;
  /** UBA embedding-level van de run (oneven = RTL). */
  level: number;
  /** Shaping-richting waarmee deze run door fontkit ging. */
  dir: 'ltr' | 'rtl';
  /** Welke font-klasse (en dus welk script) deze run tekent. */
  fontKey: FontKey;
  /** Geshapte GID's in visuele volgorde (leftmost eerst). */
  glyphIds: number[];
  /** Per-glyph horizontale advance in font-units (GPOS-adjusted, zoals fontkit teruggeeft). */
  advances: number[];
  /** Per-glyph GPOS x-offset in font-units. */
  xOffsets: number[];
  /** Per-glyph GPOS y-offset in font-units (positief = omhoog). */
  yOffsets: number[];
}

// bidi-js is een factory: één keer instantiëren en hergebruiken (stateless API).
const bidi = bidiFactory();

/** Arabisch/Perzisch script (incl. Arabisch-Indische + Perzische cijfers) én presentatievormen. */
function isArabicScriptCp(cp: number): boolean {
  return (
    (cp >= 0x0600 && cp <= 0x06ff) || // Arabic (incl. ٠-٩ 0660-0669 en ۰-۹ 06F0-06F9)
    (cp >= 0x0750 && cp <= 0x077f) || // Arabic Supplement
    (cp >= 0x08a0 && cp <= 0x08ff) || // Arabic Extended-A
    (cp >= 0xfb50 && cp <= 0xfdff) || // Arabic Presentation Forms-A
    (cp >= 0xfe70 && cp <= 0xfeff)    // Arabic Presentation Forms-B
  );
}

/**
 * Neutrale/gedeelde codepoints (spatie, tab, veelvoorkomende interpunctie) hebben geen eigen script; ze
 * erven de font-klasse van hun run-level (RTL → Arabisch, anders Latijn). Zo blijft een Arabische run
 * mét interne spaties op het Arabische font i.p.v. bij elke spatie te splitsen.
 */
function isNeutralCp(cp: number): boolean {
  return (
    cp === 0x20 || cp === 0x09 || cp === 0x0a || cp === 0x0d || // whitespace
    cp === 0x00a0 ||                                            // NBSP
    (cp >= 0x2000 && cp <= 0x206f)                              // general punctuation / spaces
  );
}

/** Font-klasse ('latin'|'arabic') voor één codepoint, gegeven of z'n run-level oneven (RTL) is. */
function fontClassFor(cp: number, levelOdd: boolean): 'latin' | 'arabic' {
  if (isArabicScriptCp(cp)) return 'arabic';
  if (isNeutralCp(cp)) return levelOdd ? 'arabic' : 'latin';
  return 'latin';
}

/** Kies de fontkit-font + PDF-fontkey voor een (script-klasse × gewicht)-combinatie. */
function pickFont(
  cls: 'latin' | 'arabic',
  bold: boolean,
  fonts: ShapingFonts,
): { fk: ShapeFontkitFont; fontKey: FontKey } {
  if (cls === 'arabic') {
    return bold
      ? { fk: fonts.arabicBold, fontKey: 'F3' }
      : { fk: fonts.arabicRegular, fontKey: 'F2' };
  }
  return bold
    ? { fk: fonts.latinBold, fontKey: 'F1' }
    : { fk: fonts.latinRegular, fontKey: 'F0' };
}

/** Interne logische run: een maximale span van gelijk level ÉN gelijke font-klasse (UTF-16-indices). */
interface LogicalRun {
  start: number;
  end: number;
  level: number;
  cls: 'latin' | 'arabic';
}

/**
 * Segmenteer `text` in logische runs: eerst maximale gelijk-level-spans (UBA embedding-levels), dan
 * verder gesplitst op font-klasse-grenzen binnen een level (bv. Latijnse cijfers in Arabische context).
 * Werkt op UTF-16 code-units, gelijk aan de indexering van `bidi-js`' levels-array.
 */
function segmentRuns(text: string, baseDir: 'ltr' | 'rtl'): LogicalRun[] {
  const { levels } = bidi.getEmbeddingLevels(text, baseDir);
  const runs: LogicalRun[] = [];
  let start = 0;
  let curLevel = levels[0] ?? (baseDir === 'rtl' ? 1 : 0);
  let curCls = fontClassFor(text.charCodeAt(0), (curLevel & 1) === 1);
  for (let i = 1; i <= text.length; i++) {
    const atEnd = i === text.length;
    const lvl = atEnd ? -1 : levels[i];
    const cls = atEnd ? curCls : fontClassFor(text.charCodeAt(i), (lvl & 1) === 1);
    if (atEnd || lvl !== curLevel || cls !== curCls) {
      runs.push({ start, end: i, level: curLevel, cls: curCls });
      start = i;
      curLevel = lvl;
      curCls = cls;
    }
  }
  return runs;
}

/**
 * UBA-regel L2 op run-granulariteit: van het hoogste embedding-level omlaag tot het laagste oneven
 * level, keer elke CONTIGUE reeks runs met level ≥ L om. Resultaat = runs in visuele (links→rechts)
 * volgorde. Correct op run-granulariteit omdat elke run één uniform level heeft (runs splitsen nooit
 * een level-span): contigue runs van gelijk level worden onderling gekeerd net als losse tekens zouden.
 */
function reorderL2(runs: LogicalRun[]): LogicalRun[] {
  if (runs.length === 0) return runs;
  let maxLevel = 0;
  let minOdd = Infinity;
  for (const r of runs) {
    if (r.level > maxLevel) maxLevel = r.level;
    if ((r.level & 1) === 1 && r.level < minOdd) minOdd = r.level;
  }
  if (minOdd === Infinity) return runs; // puur LTR, niets te keren
  const out = runs.slice();
  for (let L = maxLevel; L >= minOdd; L--) {
    let i = 0;
    while (i < out.length) {
      if (out[i].level >= L) {
        let j = i;
        while (j + 1 < out.length && out[j + 1].level >= L) j++;
        // keer out[i..j] om
        let a = i;
        let b = j;
        while (a < b) {
          const t = out[a];
          out[a] = out[b];
          out[b] = t;
          a++;
          b--;
        }
        i = j + 1;
      } else {
        i++;
      }
    }
  }
  return out;
}

/** Zet één GID om naar 4-hex uppercase (numGlyphs ≪ 65536 → altijd 4 nibbles). */
function gidHex(id: number): string {
  return (id & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Kern-API: shape + plaats. Geeft de runs in VISUELE volgorde met glyph-hex, font-key en cumulatieve
 * tekst-lokale x-plaatsing (GPOS-`xAdvance` verrekend in de run-breedte).
 *
 * @param text     logische (opslag-)tekst; mag Latijn, cijfers én Arabisch/Perzisch mengen.
 * @param baseDir  basisrichting van de paragraaf/regel (`'ltr'` of `'rtl'`).
 * @param size     font-grootte in dezelfde eenheid waarin je `xStart`/`width` wilt (bv. px of pt).
 * @param fonts    de vier ingebedde fontkit-fonts (script × gewicht).
 * @param bold     kies de Bold-gewichten (F1/F3) i.p.v. Regular (F0/F2).
 */
export function shapeAndPlace(
  text: string,
  baseDir: 'ltr' | 'rtl',
  size: number,
  fonts: ShapingFonts,
  bold = false,
): ShapedRun[] {
  const raw = layoutRuns(text, baseDir, fonts, bold, size);
  const out: ShapedRun[] = [];
  let x = 0; // tekst-lokale cursor over alle runs (visuele volgorde)
  for (const r of raw) {
    const upem = fkUpem(r);
    const s = size / upem;
    const glyphs: PlacedGlyph[] = [];
    let pen = x; // linkerrand van deze glyph-cel
    for (let i = 0; i < r.glyphIds.length; i++) {
      const adv = r.advances[i] * s;
      glyphs.push({
        gid: r.glyphIds[i],
        hex: gidHex(r.glyphIds[i]),
        x: pen + r.xOffsets[i] * s,
        y: r.yOffsets[i] * s,
        advance: adv,
      });
      pen += adv;
    }
    out.push({
      glyphHex: r.glyphIds.map(gidHex).join(''),
      glyphs,
      fontKey: r.fontKey,
      xStart: x,
      width: r._width,
    });
    x += r._width;
  }
  return out;
}

/** De upem die bij het schalen van een run hoort (meegedragen in de raw-run). */
function fkUpem(r: RawRunSized): number {
  return r._upem;
}

/** {@link RawRun} met de al-geschaalde run-breedte + upem meegedragen (intern voor {@link shapeAndPlace}). */
interface RawRunSized extends RawRun {
  _width: number;
  _upem: number;
}

/**
 * Lager-niveau variant: geeft de ruwe geshapte glyph-id-arrays + advances per run in VISUELE volgorde.
 * Bedoeld voor headless tests die de VOLGORDE willen asserten (Arabisch verbonden & gespiegeld, cijfers
 * niet omgekeerd, Latijn links bij base-LTR), en voor een aanroeper die per-glyph GPOS-positionering
 * wil emitteren i.p.v. één `showText` per run.
 */
export function layoutRuns(
  text: string,
  baseDir: 'ltr' | 'rtl',
  fonts: ShapingFonts,
  bold = false,
  size = 1,
): RawRunSized[] {
  if (!text) return [];
  const logical = segmentRuns(text, baseDir);
  const visual = reorderL2(logical);
  const runs: RawRunSized[] = [];
  for (const lr of visual) {
    const str = text.slice(lr.start, lr.end);
    const dir: 'ltr' | 'rtl' = (lr.level & 1) === 1 ? 'rtl' : 'ltr';
    const { fk, fontKey } = pickFont(lr.cls, bold, fonts);
    const gr = fk.layout(str, undefined, undefined, undefined, dir);
    const glyphIds = gr.glyphs.map(g => g.id);
    const advances = gr.positions.map(p => p.xAdvance);
    const xOffsets = gr.positions.map(p => p.xOffset ?? 0);
    const yOffsets = gr.positions.map(p => p.yOffset ?? 0);
    const upem = fk.unitsPerEm || 1000;
    let sum = 0;
    for (const a of advances) sum += a;
    runs.push({
      text: str,
      level: lr.level,
      dir,
      fontKey,
      glyphIds,
      advances,
      xOffsets,
      yOffsets,
      _width: (sum * size) / upem,
      _upem: upem,
    });
  }
  return runs;
}
