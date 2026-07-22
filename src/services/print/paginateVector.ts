/**
 * Vector-pagineerder (§4.3 ontwerpdoc): zet één keer-getekende Gantt-content (opgenomen door
 * {@link PdfVectorDraw2D}) om in een multi-page VECTOR-PDF. Zelfde tegel-/schaalwiskunde als de
 * raster-pagineerder (`paginate.ts` → `paginateCanvasToTiles`), maar een "tegel" wordt een PDF-
 * pagina die een gedeeld **Form-XObject** onder een eigen `q … cm W n … Q`-wrapper `Do`'t
 * (transform + clip) i.p.v. een `drawImage`-crop.
 *
 * **G1 (kritisch):** de volledige Gantt-tekening wordt exact ÉÉN keer als Form-XObject vastgelegd;
 * elke pagina Do't dat XObject. De operator-set blijft O(taken×dagen) i.p.v. O(tegels×taken×dagen).
 * **G2 (bewust v1-besluit):** `clip` (`W n`) beperkt alleen de rendering, niet welke tekst in de
 * stream staat — de bevroren naam-kolom wordt op elke kolom k>0 herhaald als zelfstandige tekst.
 *
 * Puur browser (pdf-lib/fontkit) — geen Tauri-imports; caller levert de rauwe Inter-TTF-bytes aan
 * (geen asset-loader-koppeling hier), zodat deze module ook headless bundelbaar is.
 */
import {
  PDFDocument, PDFName, PDFRef, type PDFFont, type PDFOperator,
  pushGraphicsState, popGraphicsState,
  concatTransformationMatrix, drawObject, rectangle, clip, endPath,
  setFillingRgbColor, beginText, endText, setFontAndSize, setTextMatrix, showText,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PdfVectorDraw2D, type PdfResourcePool, type ArabicShapingFonts } from '@/services/pdf/pdfVectorDraw2d';
import type { Draw2D } from '@/services/pdf/draw2d';
import type { RenderReportResult } from '@/services/print/printPreview';
import { PAPER_PT, FOOTER_PT, type PaperSize, type Orientation, type PaginateMode } from './paginate';

/** Optie-subset voor de vector-pagineerder; de logische dims + bevroren-kolombreedte komen uit de render. */
export interface VectorPaginateOptions {
  paperSize: PaperSize;
  orientation: Orientation;
  mode: PaginateMode;
  /** Paginamarge in punten (rondom). Default 24 (zelfde als de raster-pagineerder). */
  marginPt?: number;
  /**
   * Basisrichting van de export-taal (`RTL_LOCALES` ⇒ `'rtl'`). Stuurt de bidi-basisrichting in het
   * complexe (RTL/gemengde) tekst-pad. Default `'ltr'` — zo blijven de 12 LTR-locales onveranderd.
   */
  baseDir?: 'ltr' | 'rtl';
}

/** Rauwe Inter-TTF-bytes per gewicht (caller levert ze; hier geen `?url`/asset-loader-afhankelijkheid). */
export interface InterFontBytes {
  regular: Uint8Array;
  bold: Uint8Array;
}

/**
 * Rauwe Noto-Sans-Arabic-TTF-bytes per gewicht, voor het complexe RTL-pad. Altijd aangeleverd (nodig
 * om Arabisch tijdens de render te shapen/meten/dekken), maar pas ÍNGEBED als er ook echt Arabisch
 * getekend is — zo draagt een puur-Latijnse export géén Noto-font mee.
 */
export interface ArabicFontBytes {
  regular: Uint8Array;
  bold: Uint8Array;
}

/**
 * Gegooid door {@link paginateVectorToPdfBytes} zodra de te tekenen tekst codepoints bevat die het
 * ingebedde Inter-font niet dekt (CJK/RTL/…). Zonder deze bewuste fout zou `subset:false` die glyphs
 * stil op `.notdef` (tofu) mappen. `handleExportPDF` vangt 'm en valt terug op de raster-pijplijn, die
 * de browser CJK/RTL correct laat tekenen. De `name` is stabiel (`'VectorUnsupportedError'`) zodat de
 * catch 'm kan herkennen zónder deze (lazy geïmporteerde) module in de hoofdbundle te trekken.
 */
export class VectorUnsupportedError extends Error {
  /** De ongedekte Unicode-codepoints (voor logging/diagnose). */
  readonly codepoints: number[];
  /** True als er RTL-codepoints (Arabisch/Hebreeuws) tussen zaten. */
  readonly hasRtl: boolean;
  constructor(codepoints: number[], hasRtl: boolean) {
    const preview = codepoints
      .slice(0, 24)
      .map(cp => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'))
      .join(' ');
    const more = codepoints.length > 24 ? ` (+${codepoints.length - 24} more)` : '';
    super(`Inter dekt ${codepoints.length} codepoint(s) niet: ${preview}${more}`);
    this.name = 'VectorUnsupportedError';
    this.codepoints = codepoints;
    this.hasRtl = hasRtl;
  }
}

/**
 * Bouw een multi-page VECTOR-PDF uit een print-render.
 *
 * @param renderReport  wordt exact één keer aangeroepen met een Draw2D-fabriek; levert de logische
 *                       dims + bevroren-kolombreedte. Sluit `tasks/sequences/calendar/...` in.
 * @param opts          papierformaat/oriëntatie/modus/marge.
 * @param fontBytes     rauwe Inter-TTF-bytes (Regular + Bold) voor de subset-embedding.
 */
export async function paginateVectorToPdfBytes(
  renderReport: (makeDraw2D: (w: number, h: number) => Draw2D) => RenderReportResult,
  opts: VectorPaginateOptions,
  fontBytes: InterFontBytes,
  arabicBytes: ArabicFontBytes,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // BEWUST `subset: false` (volledige glyf-embed). pdf-lib 1.17.1's subsetter (via @pdf-lib/fontkit)
  // levert een subset waarvan de glyphs in pdfium/Chrome NIET renderen (tekst wordt deels onzichtbaar),
  // hoewel de ToUnicode-extractie klopt — empirisch aangetoond (pdfium + Chromium-screenshots). Volledig
  // inbedden rendert correct in álle viewers. Inter-Regular+Bold ≈ 0,4 MB (Flate) in de PDF; voor een
  // print-artefact (geen app-bundle) acceptabel. Subsetting terugbrengen vergt een pdf-lib/fontkit-fix
  // en is een blokker vóór CJK (fase 4b, waar subsetten wél verplicht is wegens 5–16 MB fonts).
  const regular = await doc.embedFont(fontBytes.regular, { subset: false });
  const bold = await doc.embedFont(fontBytes.bold, { subset: false });

  const pool = createResourcePool(doc, regular, bold);

  // Standalone fontkit-fonts uit de Noto-bytes (GEEN embedding): nodig om Arabisch/Perzisch tijdens de
  // render te shapen, te meten én z'n dekking te checken. `subset:false`-embedding gebruikt straks
  // dezelfde bytes → CID==GID==fontkit-glyph.id, dus de hier geshapte GID's kloppen met het latere font.
  const fkCreate = fontkit as unknown as { create(bytes: Uint8Array): ArabicShapingFonts['regular'] };
  const arabicFonts: ArabicShapingFonts = {
    regular: fkCreate.create(arabicBytes.regular),
    bold: fkCreate.create(arabicBytes.bold),
  };
  const baseDir = opts.baseDir ?? 'ltr';

  // Teken de VOLLEDIGE Gantt exact één keer; leg de operatoren vast (G1).
  let captured: PdfVectorDraw2D | null = null;
  const dims = renderReport((w, h) => {
    captured = new PdfVectorDraw2D(w, h, pool, baseDir, arabicFonts);
    return captured;
  });
  const d2d = captured as PdfVectorDraw2D | null;
  if (!d2d) throw new Error('paginateVectorToPdfBytes: renderReport riep de Draw2D-fabriek niet aan');

  // Coverage-poort (fase 4): `renderReport` heeft nu ALLE tekst door `fillText` gehaald, dus de
  // ongedekte-codepoint-set is compleet. Is die niet leeg → gooi vóór we de PDF verder opbouwen, zodat
  // `handleExportPDF` terugvalt op raster i.p.v. tofu te exporteren. Dekt Gantt én tabellen (beide gaan
  // door dezelfde PdfVectorDraw2D.fillText). Arabisch/Perzisch is nu multi-font gedekt (Inter ÓF Noto),
  // dus dat valt NIET meer hier uit; Hebreeuws/CJK wél → raster.
  if (d2d.uncoveredCodepoints.size > 0) {
    throw new VectorUnsupportedError([...d2d.uncoveredCodepoints], d2d.hasRtl);
  }

  // Conditionele Noto-embedding (geen Latijn-bloat): alléén als het complexe pad écht Arabisch/Perzisch
  // plaatste, bedden we Noto in en zetten we F2/F3 in de resources. Een puur-Latijnse export raakt dit
  // niet en draagt dus geen tweede FontFile2.
  let notoRegular: PDFFont | undefined;
  let notoBold: PDFFont | undefined;
  if (d2d.usedArabic) {
    notoRegular = await doc.embedFont(arabicBytes.regular, { subset: false });
    notoBold = await doc.embedFont(arabicBytes.bold, { subset: false });
    pool.setArabicFonts(notoRegular, notoBold);
  }

  // Eén Form-XObject met alle VORMEN (grid/staven/arcering) + eigen font/ExtGState-resources (G1: de
  // tekening wordt exact één keer vastgelegd en per pagina ge-`Do`'d). De TEKST zit BEWUST niet in het
  // XObject (fase 2.1): een gedeeld XObject `Do`'t z'n volledige tekstlaag op élke pagina, waardoor de
  // tekst-extractie elke taaknaam N× oplevert. De tekst wordt daarom per tegel apart geëmit (zie onder).
  const resources = pool.buildResourcesDict();
  const xobj = doc.context.formXObject(d2d.operators, {
    BBox: [0, 0, dims.width, dims.height],
    Matrix: [1, 0, 0, 1, 0, 0],
    Resources: resources,
  });
  const xobjRef = doc.context.register(xobj);
  const texts = d2d.texts;

  // ---- Tegel-/schaalwiskunde: 1:1 uit paginateCanvasToTiles (paginate.ts) ----
  const marginPt = opts.marginPt ?? 24;
  const frozenPx = dims.tableWidth;

  const base = PAPER_PT[opts.paperSize];
  const pageW = opts.orientation === 'landscape' ? base.height : base.width;
  const pageH = opts.orientation === 'landscape' ? base.width : base.height;

  const printW = pageW - 2 * marginPt;
  const printH = pageH - 2 * marginPt - FOOTER_PT;

  const cw = dims.width;
  const ch = dims.height;

  const scale = opts.mode === 'fit-width' ? printW / cw : 1.0;

  const rowHpx = printH / scale;
  const rows = Math.max(1, Math.ceil(ch / rowHpx));

  const frozenPtW = opts.mode === 'actual' ? frozenPx * scale : 0;
  const bodyColPtW = printW - frozenPtW;
  const col0Bodypx = printW / scale;
  const laterColBodypx = bodyColPtW / scale;
  let cols = 1;
  if (opts.mode === 'actual' && cw > col0Bodypx && laterColBodypx > 0) {
    cols = 1 + Math.ceil((cw - col0Bodypx) / laterColBodypx);
  }
  cols = Math.max(1, cols);

  const totalPages = rows * cols;

  // Top van het printgebied in PDF-punten (y-omhoog). Content groeit omlaag vanaf hier.
  const printTopYUp = pageH - marginPt;

  /**
   * Eén tegel-blok: `q  re W n  cm  /X0 Do  Q`. Clip = het getekende venster op de pagina (punten,
   * y-omhoog); `cm` = px→pt-schaal + tegel-offset (géén y-flip; die zit al in het XObject).
   */
  const drawTile = (
    pageOps: PDFOperator[],
    srcX: number, srcY: number, srcW: number, srcH: number,
    pageX: number,
  ) => {
    if (srcW <= 0 || srcH <= 0) return;
    const drawnW = srcW * scale;
    const drawnH = srcH * scale;
    const clipBottomYUp = printTopYUp - drawnH;
    const e = pageX - srcX * scale;
    const f = pageH - marginPt - (ch - srcY) * scale;
    pageOps.push(
      pushGraphicsState(),
      rectangle(pageX, clipBottomYUp, drawnW, drawnH), clip(), endPath(),
      concatTransformationMatrix(scale, 0, 0, scale, e, f),
      drawObject('X0'),
    );
    // Emit — ONDER dezelfde clip+cm als het XObject — de tekst wiens bron-bbox dit tegel-bronvenster
    // [srcX..srcX+srcW]×[srcY..srcY+srcH] RAAKT. Zelfde tegel-toewijzing als de vorm-tegeling: de clip
    // trimt partiële glyphs aan de tegelrand identiek, en de `setTextMatrix` (absolute XObject-coörd.)
    // + deze `cm` reproduceren exact de fase-2-plaatsing. Bevroren-kolomtekst (bron-x < frozenPx) valt
    // vanzelf binnen zowel de kolom-0-tegel als de herhaalde frozen-strip-tegel (pageX=marginPt,
    // srcX=0) → één keer per horizontale kolom; body-tekst raakt alleen z'n eigen body-venster.
    const srcXEnd = srcX + srcW;
    const srcYEnd = srcY + srcH;
    for (const t of texts) {
      if (t.x1 > srcX && t.x0 < srcXEnd && t.y1 > srcY && t.y0 < srcYEnd) {
        for (const op of t.ops) pageOps.push(op);
      }
    }
    pageOps.push(popGraphicsState());
  };

  let pageIndex = 0;
  for (let r = 0; r < rows; r++) {
    const srcY = r * rowHpx;
    const srcH = Math.min(rowHpx, ch - srcY);

    for (let c = 0; c < cols; c++) {
      pageIndex++;
      const page = doc.addPage([pageW, pageH]);
      const leaf = page.node;
      leaf.setXObject(PDFName.of('X0'), xobjRef);
      // De tegel-tekst (fase 2.1) én de footer draaien nu op de PAGINA-content-stream i.p.v. in het
      // XObject, dus de pagina heeft dezelfde resources nodig als het XObject: beide font-gewichten
      // (F0=Regular voor footer+tekst, F1=Bold) en elke ExtGState-alpha die de tekst gebruikt.
      leaf.setFontDictionary(PDFName.of('F0'), regular.ref);
      leaf.setFontDictionary(PDFName.of('F1'), bold.ref);
      // F2/F3 (Noto) alleen op de pagina als er Arabisch geplaatst is — anders geen dangling font-ref.
      if (notoRegular && notoBold) {
        leaf.setFontDictionary(PDFName.of('F2'), notoRegular.ref);
        leaf.setFontDictionary(PDFName.of('F3'), notoBold.ref);
      }
      for (const [key, ref] of Object.entries(resources.ExtGState)) {
        leaf.setExtGState(PDFName.of(key), ref);
      }

      const pageOps: PDFOperator[] = [];

      if (c === 0) {
        const srcW = Math.min(col0Bodypx, cw);
        drawTile(pageOps, 0, srcY, srcW, srcH, marginPt);
      } else {
        // Bevroren naam-strip herhalen (G2: zelfstandige tekst per pagina).
        if (frozenPx > 0 && frozenPtW > 0) {
          drawTile(pageOps, 0, srcY, frozenPx, srcH, marginPt);
        }
        const bodySrcX = col0Bodypx + (c - 1) * laterColBodypx;
        const bodySrcW = Math.min(laterColBodypx, cw - bodySrcX);
        if (bodySrcW > 0) {
          drawTile(pageOps, bodySrcX, srcY, bodySrcW, srcH, marginPt + frozenPtW);
        }
      }

      // Paginanummer rechtsonder in de marge (grijs ~8pt), als vector-tekst — buiten het XObject.
      const label = `${pageIndex} / ${totalPages}`;
      const labelW = regular.widthOfTextAtSize(label, 8);
      const labelX = (pageW - marginPt) - labelW;
      const labelYUp = marginPt * 0.5;
      pageOps.push(
        setFillingRgbColor(0.6, 0.6, 0.6),
        beginText(),
        setFontAndSize('F0', 8),
        setTextMatrix(1, 0, 0, 1, labelX, labelYUp),
        showText(regular.encodeText(label)),
        endText(),
      );

      const contentRef = doc.context.register(doc.context.contentStream(pageOps));
      leaf.addContentStream(contentRef);
    }
  }

  return doc.save();
}

/**
 * Bouwt een {@link PdfResourcePool}: vaste font-sleutels F0=Regular, F1=Bold, plus een gededupliceerde
 * ExtGState-fabriek voor alpha's. De pool bezit de refs die in de XObject-`/Resources` moeten.
 */
interface ResourcePool extends PdfResourcePool {
  buildResourcesDict(): { Font: Record<string, PDFRef>; ExtGState: Record<string, PDFRef> };
  /** Voeg de ingebedde Noto-gewichten toe als F2 (Regular) / F3 (Bold) — pas ná de coverage-poort. */
  setArabicFonts(reg: PDFFont, bld: PDFFont): void;
}

function createResourcePool(doc: PDFDocument, regular: PDFFont, bold: PDFFont): ResourcePool {
  const alphaKeys = new Map<number, string>();
  const extgStates: Array<{ key: string; ref: PDFRef }> = [];
  const fonts: Record<string, PDFRef> = { F0: regular.ref, F1: bold.ref };

  return {
    regular,
    bold,
    registerAlpha(alpha: number): string {
      const q = Math.round(alpha * 1000) / 1000;
      const existing = alphaKeys.get(q);
      if (existing) return existing;
      const key = `GA${alphaKeys.size}`;
      const ref = doc.context.register(doc.context.obj({ Type: 'ExtGState', ca: q, CA: q }));
      alphaKeys.set(q, key);
      extgStates.push({ key, ref });
      return key;
    },
    setArabicFonts(reg: PDFFont, bld: PDFFont): void {
      fonts.F2 = reg.ref;
      fonts.F3 = bld.ref;
    },
    buildResourcesDict() {
      const extg: Record<string, PDFRef> = {};
      for (const g of extgStates) extg[g.key] = g.ref;
      return {
        Font: { ...fonts },
        ExtGState: extg,
      };
    },
  };
}
