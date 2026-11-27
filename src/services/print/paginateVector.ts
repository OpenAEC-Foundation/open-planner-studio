import {
  PDFDocument, PDFName, PDFRef, StandardFonts, type PDFFont, type PDFOperator,
  pushGraphicsState, popGraphicsState,
  concatTransformationMatrix, drawObject, rectangle, clip, endPath,
  setFillingRgbColor, beginText, endText, setFontAndSize, setTextMatrix, showText,
} from 'pdf-lib';
import { fontkit } from '@/services/pdf/fontkit';
import { embedReportFont } from '@/services/pdf/embedReportFont';
import { PdfVectorDraw2D, type PdfResourcePool, type ArabicShapingFonts, type CjkVectorFont } from '@/services/pdf/pdfVectorDraw2d';
import { getCjkFontProviders, type CjkFontProvider } from '@/services/pdf/fontRegistry';
import { appLog } from '@/services/debug/appLog';
import type { Draw2D } from '@/services/pdf/draw2d';
import type { RenderReportResult } from '@/services/print/printPreview';
import { computeTileLayout, footerRelayoutWidth, reportTileInput, type PaperSize, type Orientation, type PaginateMode } from './tileLayout';

export interface VectorPaginateOptions {
  paperSize: PaperSize;
  orientation: Orientation;
  mode: PaginateMode;
  marginPt?: number;
  repeatHeader?: boolean;
  repeatFooter?: boolean;
  timelineColumns?: number;
  baseDir?: 'ltr' | 'rtl';
  subsetFont: (ttf: Uint8Array, codepoints: Iterable<number>) => Promise<Uint8Array>;
  fallbackFonts?: ReadonlyArray<{ id: string; bytes: ReportFontBytes }>;
}

export interface ReportFontBytes {
  regular: Uint8Array;
  bold: Uint8Array;
}

export interface ArabicFontBytes {
  regular: Uint8Array;
  bold: Uint8Array;
}

const PAGE_NUMBER_FONT_KEY = 'FP';

export class VectorUnsupportedError extends Error {
  readonly codepoints: number[];
  readonly hasRtl: boolean;
  constructor(codepoints: number[], hasRtl: boolean) {
    const preview = codepoints
      .slice(0, 24)
      .map(cp => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'))
      .join(' ');
    const more = codepoints.length > 24 ? ` (+${codepoints.length - 24} more)` : '';
    super(`De rapportletter dekt ${codepoints.length} codepoint(s) niet: ${preview}${more}`);
    this.name = 'VectorUnsupportedError';
    this.codepoints = codepoints;
    this.hasRtl = hasRtl;
  }
}

export async function paginateVectorToPdfBytes(
  renderReport: (makeDraw2D: (w: number, h: number) => Draw2D, footerLayoutWidth?: number) => RenderReportResult,
  opts: VectorPaginateOptions,
  fontBytes: ReportFontBytes,
  arabicBytes: ArabicFontBytes,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await embedReportFont(doc, fontBytes.regular);
  const bold = await embedReportFont(doc, fontBytes.bold);

  const pool = createResourcePool(doc, regular, bold);

  const fkCreate = fontkit as unknown as { create(bytes: Uint8Array): ArabicShapingFonts['regular'] };
  const arabicFonts: ArabicShapingFonts = {
    regular: fkCreate.create(arabicBytes.regular),
    bold: fkCreate.create(arabicBytes.bold),
  };
  const baseDir = opts.baseDir ?? 'ltr';

  let lastCjk: CjkVectorFont[] = [];
  const runRender = (cjk: CjkVectorFont[], footerLayoutWidth?: number): { d2d: PdfVectorDraw2D; dims: RenderReportResult } => {
    let captured: PdfVectorDraw2D | null = null;
    lastCjk = cjk;
    const dims = renderReport((w, h) => {
      captured = new PdfVectorDraw2D(w, h, pool, baseDir, arabicFonts, cjk);
      return captured;
    }, footerLayoutWidth);
    if (!captured) throw new Error('paginateVectorToPdfBytes: renderReport riep de Draw2D-fabriek niet aan');
    return { d2d: captured as PdfVectorDraw2D, dims };
  };

  const fallbackProviders: CjkFontProvider[] = (opts.fallbackFonts ?? []).map(({ id, bytes }) => {
    let fk: ArabicShapingFonts['regular'] | undefined;
    return {
      id,
      covers: (cp: number) => (fk ??= fkCreate.create(bytes.regular)).hasGlyphForCodePoint(cp),
      getRegularBytes: async () => bytes.regular,
      getBoldBytes: async () => bytes.bold,
    };
  });
  const providers = [...fallbackProviders, ...getCjkFontProviders()];
  type LoadedCjk = {
    provider: (typeof providers)[number];
    regBytes: Uint8Array;
    boldBytes: Uint8Array;
    fk: ArabicShapingFonts['regular'];
    fkBold: ArabicShapingFonts['regular'];
  };

  let { d2d, dims } = runRender([]);

  const cjkPreload: LoadedCjk[] = [];
  if (providers.length > 0 && d2d.uncoveredCodepoints.size > 0) {
    const candidates = [...d2d.uncoveredCodepoints];
    for (const p of providers) {
      if (!candidates.some((cp) => p.covers(cp))) continue;
      try {
        const regBytes = await p.getRegularBytes();
        const boldBytes = p.getBoldBytes ? await p.getBoldBytes() : regBytes;
        cjkPreload.push({
          provider: p,
          regBytes,
          boldBytes,
          fk: fkCreate.create(regBytes),
          fkBold: fkCreate.create(boldBytes),
        });
      } catch (err) {
        appLog.emit('warn', 'pdf', `CJK-fontprovider '${p.id}' overgeslagen (laden/parsen mislukt):`, err);
      }
    }
  }

  const makeCjkBase = (i: number): CjkVectorFont => ({
    id: cjkPreload[i].provider.id,
    covers: (cp: number) => cjkPreload[i].provider.covers(cp),
    fk: cjkPreload[i].fk,
    fkBold: cjkPreload[i].fkBold,
  });

  if (cjkPreload.length > 0) {
    ({ d2d, dims } = runRender(cjkPreload.map((_, i) => makeCjkBase(i))));
  }

  if (d2d.uncoveredCodepoints.size > 0) {
    throw new VectorUnsupportedError([...d2d.uncoveredCodepoints], d2d.hasRtl);
  }

  let notoRegular: PDFFont | undefined;
  let notoBold: PDFFont | undefined;
  if (d2d.usedArabic) {
    notoRegular = await doc.embedFont(arabicBytes.regular, { subset: false });
    notoBold = await doc.embedFont(arabicBytes.bold, { subset: false });
    pool.setArabicFonts(notoRegular, notoBold);
  }

  if (d2d.usedCjk) {
    const cjkPass2: CjkVectorFont[] = [];
    for (let i = 0; i < cjkPreload.length; i++) {
      const base = makeCjkBase(i);
      const cps = d2d.usedCjkCodepoints.get(i);
      if (cps && cps.size > 0) {
        const keyRegular = `F${4 + 2 * i}`;
        const keyBold = `F${5 + 2 * i}`;
        const subReg = await opts.subsetFont(cjkPreload[i].regBytes, cps);
        const subBold = await opts.subsetFont(cjkPreload[i].boldBytes, cps);
        const embReg = await embedReportFont(doc, subReg);
        const embBold = await embedReportFont(doc, subBold);
        pool.setCjkFont(keyRegular, embReg);
        pool.setCjkFont(keyBold, embBold);
        base.embed = { regular: embReg, bold: embBold, keyRegular, keyBold };
      }
      cjkPass2.push(base);
    }
    ({ d2d, dims } = runRender(cjkPass2));
  }

  const tileInput = (d: RenderReportResult) => reportTileInput(d, {
    paperSize: opts.paperSize,
    orientation: opts.orientation,
    mode: opts.mode,
    repeatHeader: !!opts.repeatHeader,
    repeatFooter: !!opts.repeatFooter,
    timelineColumns: opts.timelineColumns,
    marginPt: opts.marginPt,
  });
  let layout = computeTileLayout(tileInput(dims));

  const footerLayoutWidth = footerRelayoutWidth(layout, dims.width);
  if (footerLayoutWidth !== undefined) {
    ({ d2d, dims } = runRender(lastCjk, footerLayoutWidth));
    layout = computeTileLayout(tileInput(dims));
    if (d2d.uncoveredCodepoints.size > 0) {
      throw new VectorUnsupportedError([...d2d.uncoveredCodepoints], d2d.hasRtl);
    }
  }

  const resources = pool.buildResourcesDict();
  const xobj = doc.context.formXObject(d2d.operators, {
    BBox: [0, 0, dims.width, dims.height],
    Matrix: [1, 0, 0, 1, 0, 0],
    Resources: resources,
  });
  const xobjRef = doc.context.register(xobj);
  const texts = d2d.texts;

  const {
    pageWidthPt: pageW, pageHeightPt: pageH, marginPt, scale, rows, cols, repeatHeaderPx, bodyTopPt,
    repeatFooterPx, repeatFooterSrcY, footerTopPt, footerWindow,
  } = layout;

  const ch = dims.height;
  const totalPages = rows * cols;

  const drawTile = (
    pageOps: PDFOperator[],
    srcX: number, srcY: number, srcW: number, srcH: number,
    pageX: number, destTopYUp: number,
  ) => {
    if (srcW <= 0 || srcH <= 0) return;
    const drawnW = srcW * scale;
    const drawnH = srcH * scale;
    const clipBottomYUp = destTopYUp - drawnH;
    const e = pageX - srcX * scale;
    const f = destTopYUp - (ch - srcY) * scale;
    pageOps.push(
      pushGraphicsState(),
      rectangle(pageX, clipBottomYUp, drawnW, drawnH), clip(), endPath(),
      concatTransformationMatrix(scale, 0, 0, scale, e, f),
      drawObject('X0'),
    );
    const srcXEnd = srcX + srcW;
    const srcYEnd = srcY + srcH;
    for (const t of texts) {
      if (t.x1 > srcX && t.x0 < srcXEnd && t.y1 > srcY && t.y0 < srcYEnd) {
        for (const op of t.ops) pageOps.push(op);
      }
    }
    pageOps.push(popGraphicsState());
  };

  const printTopYUp = pageH - marginPt;
  const bodyTopYUp = pageH - bodyTopPt;
  const footerTopYUp = pageH - footerTopPt;

  const regularFk = fontkit.create(fontBytes.regular);
  const pageNumberFont = [...'0123456789 /'].every(c => regularFk.hasGlyphForCodePoint(c.codePointAt(0)!))
    ? undefined
    : await doc.embedFont(StandardFonts.Helvetica);
  let pageIndex = 0;
  for (const row of layout.bodyRows) {
    for (const column of layout.columns) {
      pageIndex++;
      const page = doc.addPage([pageW, pageH]);
      const leaf = page.node;
      leaf.setXObject(PDFName.of('X0'), xobjRef);
      for (const [key, ref] of Object.entries(resources.Font)) {
        leaf.setFontDictionary(PDFName.of(key), ref);
      }
      for (const [key, ref] of Object.entries(resources.ExtGState)) {
        leaf.setExtGState(PDFName.of(key), ref);
      }

      const pageOps: PDFOperator[] = [];

      for (const win of column.xWindows) {
        if (repeatHeaderPx > 0) {
          drawTile(pageOps, win.srcX, 0, win.srcW, repeatHeaderPx, win.pageX, printTopYUp);
        }
        drawTile(pageOps, win.srcX, row.srcY, win.srcW, row.srcH, win.pageX, bodyTopYUp);
      }
      if (repeatFooterPx > 0) {
        drawTile(pageOps, footerWindow.srcX, repeatFooterSrcY, footerWindow.srcW, repeatFooterPx, footerWindow.pageX, footerTopYUp);
      }

      const label = `${pageIndex} / ${totalPages}`;
      const labelFont = pageNumberFont ?? regular;
      const labelW = labelFont.widthOfTextAtSize(label, 8);
      const labelX = (pageW - marginPt) - labelW;
      const labelYUp = marginPt * 0.5;
      if (pageNumberFont) leaf.setFontDictionary(PDFName.of(PAGE_NUMBER_FONT_KEY), pageNumberFont.ref);
      pageOps.push(
        setFillingRgbColor(0.6, 0.6, 0.6),
        beginText(),
        setFontAndSize(pageNumberFont ? PAGE_NUMBER_FONT_KEY : 'F0', 8),
        setTextMatrix(1, 0, 0, 1, labelX, labelYUp),
        showText(labelFont.encodeText(label)),
        endText(),
      );

      const contentRef = doc.context.register(doc.context.contentStream(pageOps));
      leaf.addContentStream(contentRef);
    }
  }

  return doc.save();
}

interface ResourcePool extends PdfResourcePool {
  buildResourcesDict(): { Font: Record<string, PDFRef>; ExtGState: Record<string, PDFRef> };
  setArabicFonts(reg: PDFFont, bld: PDFFont): void;
  setCjkFont(key: string, font: PDFFont): void;
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
    setCjkFont(key: string, font: PDFFont): void {
      fonts[key] = font.ref;
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
