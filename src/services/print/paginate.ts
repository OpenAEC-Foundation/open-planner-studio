/**
 * Canvas → multi-page PDF-tegeling.
 *
 * Snijdt een bron-`HTMLCanvasElement` (het gerenderde rapport/Gantt) in pagina-tegels op een
 * echt papierformaat (A4/A3) en zet die via {@link buildImagePdf} om in één geldige multi-page
 * PDF. Puur browser (gebruikt off-screen `<canvas>`-en + `drawImage`); de PDF-bytelaag zelf is
 * dependency-loos (`src/utils/miniPdf.ts`).
 *
 * Twee modi:
 *   - `fit-width`: schaal de bron zó dat de volledige breedte op één papierbreedte past; alleen
 *     verticaal tegelen (1 kolom). Geen bevroren-kolom-herhaling nodig.
 *   - `actual`: 1 pt = 1 px (honoreert de on-screen zoom 1:1); zowel horizontaal als verticaal
 *     tegelen. De linker naam-strip (`frozenColumnWidthPx`) wordt op elke volgende horizontale
 *     tegel herhaald zodat elke pagina zelfstandig leesbaar blijft.
 */

import { buildImagePdf, type PdfImagePage } from '@/utils/miniPdf';

export type PaperSize = 'a4' | 'a3' | 'a1';
export type Orientation = 'portrait' | 'landscape';
export type PaginateMode = 'fit-width' | 'actual';

export interface PaginateOptions {
  paperSize: PaperSize;
  orientation: Orientation;
  mode: PaginateMode;
  /**
   * Logische (CSS-px) breedte van de broninhoud — dezelfde eenheid als `renderPrintCanvas().width`.
   * ALLE tegel-wiskunde gebeurt in deze logische eenheid; de device-pixels van het canvas
   * (`canvas.width` = logisch × devicePixelRatio) dienen alléén als high-res bron voor `drawImage`.
   */
  logicalWidth: number;
  /** Logische (CSS-px) hoogte van de broninhoud (= `renderPrintCanvas().height`). */
  logicalHeight: number;
  /** Breedte (LOGISCHE px) van de linker bevroren naam-kolom die op elke horizontale tegel herhaald wordt (alleen 'actual'). */
  frozenColumnWidthPx?: number;
  /** Paginamarge in punten (rondom). Default 24. */
  marginPt?: number;
  /** JPEG-kwaliteit voor elke pagina (0..1). Default 0.9. */
  quality?: number;
  /**
   * Dest-pixels per punt op het page-canvas — hoger = scherper maar duurder. Default {@link SUPERSAMPLE}.
   * De preview kan dit op 1 zetten (goedkoper; wordt toch verkleind weergegeven); de PDF-export
   * gebruikt de default.
   */
  supersample?: number;
}

/** Resultaat van {@link paginateCanvasToTiles}: één canvas per pagina + paginamaat/rooster. */
export interface PaginatedTiles {
  /** Eén canvas per pagina (rij-voor-rij van boven naar onder, binnen een rij van links naar rechts). */
  pages: HTMLCanvasElement[];
  /** Papierbreedte in PDF-punten (honoreert oriëntatie). */
  pageWidthPt: number;
  /** Papierhoogte in PDF-punten (honoreert oriëntatie). */
  pageHeightPt: number;
  /** Aantal horizontale tegels. */
  cols: number;
  /** Aantal verticale tegels. */
  rows: number;
}

/** Paginamaten in PDF-punten (1/72 inch), portret; landscape = omgewisseld. */
const PAPER_PT: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  a3: { width: 841.89, height: 1190.55 },
  a1: { width: 1683.78, height: 2383.94 },
};

/** Ruimte onderaan (punten) gereserveerd voor het paginanummer in de marge. */
const FOOTER_PT = 14;
/** Supersample-factor: teken op punt-resolutie × deze factor voor scherpe tekst; MediaBox blijft de echte puntmaat. */
const SUPERSAMPLE = 2;

/**
 * Tegel een bron-canvas naar losse pagina-canvassen (één `HTMLCanvasElement` per pagina).
 *
 * Dit is de gedeelde pagineer-engine: zowel {@link paginateCanvasToPdfBytes} (voor de PDF-export)
 * als de rapport-preview gebruiken deze functie zodat de preview WYSIWYG-identiek is aan de export.
 *
 * @returns {@link PaginatedTiles} — pagina-canvassen (rij-voor-rij van boven naar onder, binnen een
 *          rij van links naar rechts) + echte puntmaat + rooster.
 */
export function paginateCanvasToTiles(canvas: HTMLCanvasElement, opts: PaginateOptions): PaginatedTiles {
  const marginPt = opts.marginPt ?? 24;
  const frozenPx = opts.frozenColumnWidthPx ?? 0;

  const base = PAPER_PT[opts.paperSize];
  const pageW = opts.orientation === 'landscape' ? base.height : base.width;
  const pageH = opts.orientation === 'landscape' ? base.width : base.height;

  const printW = pageW - 2 * marginPt;
  const printH = pageH - 2 * marginPt - FOOTER_PT;

  // Bron-afmetingen in LOGISCHE px (CSS-px) — alle tegel-wiskunde gebeurt in deze eenheid.
  const cw = opts.logicalWidth;
  const ch = opts.logicalHeight;

  // Device-px per logische px: converteert een logische bron-rechthoek naar het feitelijke
  // high-res canvas-raster in de `drawImage`-bron-argumenten. `canvas.width` is logisch×dpr.
  const srcScale = cw > 0 ? canvas.width / cw : 1;

  // Schaal (punt per LOGISCHE px).
  const scale = opts.mode === 'fit-width' ? printW / cw : 1.0;

  // Verticale tegels.
  const rowHpx = printH / scale;
  const rows = Math.max(1, Math.ceil(ch / rowHpx));

  // Horizontale tegels.
  const frozenPtW = opts.mode === 'actual' ? frozenPx * scale : 0;
  // Body-px per kolom na kolom 0 (die de frozen-strip herhaalt).
  const bodyColPtW = printW - frozenPtW;         // punten beschikbaar voor de body-strook op tegel k>0
  const col0Bodypx = printW / scale;             // bron-px die kolom 0 in beeld brengt (incl. frozen-strip)
  const laterColBodypx = bodyColPtW / scale;     // extra body-bron-px per volgende kolom
  let cols = 1;
  if (opts.mode === 'actual' && cw > col0Bodypx && laterColBodypx > 0) {
    cols = 1 + Math.ceil((cw - col0Bodypx) / laterColBodypx);
  }
  cols = Math.max(1, cols);

  const pxPt = opts.supersample ?? SUPERSAMPLE; // dest-pixels per punt op het page-canvas
  const pageCanvasW = Math.max(1, Math.round(pageW * pxPt));
  const pageCanvasH = Math.max(1, Math.round(pageH * pxPt));

  const totalPages = rows * cols;
  const pages: HTMLCanvasElement[] = [];

  let pageIndex = 0;
  for (let r = 0; r < rows; r++) {
    // Verticaal bron-venster (bron-px).
    const srcY = r * rowHpx;
    const srcH = Math.min(rowHpx, ch - srcY);

    for (let c = 0; c < cols; c++) {
      pageIndex++;

      // Per pagina een NIEUW canvas (zodat de aanroeper alle pagina's tegelijk kan gebruiken).
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = pageCanvasW;
      pageCanvas.height = pageCanvasH;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('paginateCanvasToTiles: kon 2D-context niet verkrijgen');

      // Witte achtergrond.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvasW, pageCanvasH);

      // Dest y-offset (punt → dest-px), rekening houdend met de bovenmarge.
      const destYpx = marginPt * pxPt;
      const destHpx = srcH * scale * pxPt;

      if (c === 0) {
        // Kolom 0: bron-px [0 .. col0Bodypx] op x=margin, breedte printW.
        const srcX = 0;
        const srcW = Math.min(col0Bodypx, cw);
        drawTile(ctx, canvas, srcScale, srcX, srcY, srcW, srcH, marginPt * pxPt, destYpx, srcW * scale * pxPt, destHpx);
      } else {
        // Bevroren-strip herhalen op x=margin, breedte frozenPtW.
        if (frozenPx > 0 && frozenPtW > 0) {
          drawTile(
            ctx, canvas, srcScale,
            0, srcY, frozenPx, srcH,
            marginPt * pxPt, destYpx, frozenPtW * pxPt, destHpx,
          );
        }
        // Body-venster: kolom 0 dekt body-px [frozenPx .. col0Bodypx]; elke volgende kolom
        // dekt laterColBodypx verder, aansluitend zonder overlap of gat.
        const bodySrcX = col0Bodypx + (c - 1) * laterColBodypx;
        const bodySrcW = Math.min(laterColBodypx, cw - bodySrcX);
        if (bodySrcW > 0) {
          const bodyDestX = (marginPt + frozenPtW) * pxPt;
          drawTile(
            ctx, canvas, srcScale,
            bodySrcX, srcY, bodySrcW, srcH,
            bodyDestX, destYpx, bodySrcW * scale * pxPt, destHpx,
          );
        }
      }

      // Paginanummer rechtsonder in de marge (grijs, ~8pt).
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#999999';
      ctx.font = `${Math.round(8 * pxPt)}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      const label = `${pageIndex} / ${totalPages}`;
      const labelX = (pageW - marginPt) * pxPt;
      const labelY = (pageH - marginPt * 0.5) * pxPt;
      ctx.fillText(label, labelX, labelY);

      pages.push(pageCanvas);
    }
  }

  return { pages, pageWidthPt: pageW, pageHeightPt: pageH, cols, rows };
}

/**
 * Tegel een bron-canvas naar multi-page PDF-bytes.
 *
 * Deelt de pagineer-engine ({@link paginateCanvasToTiles}) met de rapport-preview en zet elk
 * pagina-canvas om naar JPEG voor de PDF.
 *
 * @returns Uint8Array met een geldige PDF 1.4 (meerdere pagina's, rij-voor-rij van boven naar
 *          onder, binnen een rij van links naar rechts).
 */
export function paginateCanvasToPdfBytes(canvas: HTMLCanvasElement, opts: PaginateOptions): Uint8Array {
  const quality = opts.quality ?? 0.9;
  const { pages, pageWidthPt, pageHeightPt } = paginateCanvasToTiles(canvas, opts);

  const pdfPages: PdfImagePage[] = pages.map(pageCanvas => {
    const dataUrl = pageCanvas.toDataURL('image/jpeg', quality);
    return {
      jpegBytes: dataUrlToBytes(dataUrl),
      widthPt: pageWidthPt,
      heightPt: pageHeightPt,
      imageWidthPx: pageCanvas.width,
      imageHeightPx: pageCanvas.height,
    };
  });

  return buildImagePdf(pdfPages);
}

/**
 * Teken een bron-regio → dest-regio; klemt zodat lege/negatieve regio's overgeslagen worden.
 * De bron-argumenten (sx/sy/sw/sh) komen in LOGISCHE px binnen en worden met `srcScale`
 * (device-px per logische px) naar het feitelijke high-res canvas-raster omgezet.
 */
function drawTile(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  srcScale: number,
  sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number,
): void {
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
  ctx.drawImage(src, sx * srcScale, sy * srcScale, sw * srcScale, sh * srcScale, dx, dy, dw, dh);
}

/** Ruwe JPEG-bytes uit een `data:image/jpeg;base64,...`-URL. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const marker = ';base64,';
  const idx = dataUrl.indexOf(marker);
  if (idx === -1) throw new Error('Onverwacht data-URL-formaat (geen base64-JPEG)');
  const binary = atob(dataUrl.slice(idx + marker.length));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
