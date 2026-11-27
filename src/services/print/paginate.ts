import { buildImagePdf, type PdfImagePage } from '@/utils/miniPdf';
import { computeTileLayout, type PaperSize, type Orientation, type PaginateMode } from './tileLayout';
import { dataUrlToBytes } from '@/utils/dataUrl';

export interface PaginateOptions {
  paperSize: PaperSize;
  orientation: Orientation;
  mode: PaginateMode;
  logicalWidth: number;
  logicalHeight: number;
  frozenColumnWidthPx?: number;
  repeatHeaderHeightPx?: number;
  repeatFooterHeightPx?: number;
  timelineColumns?: number;
  marginPt?: number;
  breakOffsetsPx?: readonly number[];
  forcedBreakOffsetsPx?: readonly number[];
  quality?: number;
  supersample?: number;
}

export function paginateCanvasToTile(
  canvas: HTMLCanvasElement,
  opts: PaginateOptions,
  pageIndex: number,
): HTMLCanvasElement | undefined {
  const layout = computeTileLayout(opts);
  const totalPages = layout.rows * layout.cols;
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= totalPages) return undefined;

  const rowIndex = Math.floor(pageIndex / layout.cols);
  const columnIndex = pageIndex % layout.cols;
  const row = layout.bodyRows[rowIndex];
  const column = layout.columns[columnIndex];
  if (!row || !column) return undefined;

  const srcScale = opts.logicalWidth > 0 ? canvas.width / opts.logicalWidth : 1;
  const pxPt = opts.supersample ?? SUPERSAMPLE;
  const pageCanvasW = Math.max(1, Math.round(layout.pageWidthPt * pxPt));
  const pageCanvasH = Math.max(1, Math.round(layout.pageHeightPt * pxPt));
  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = pageCanvasW;
  pageCanvas.height = pageCanvasH;
  const ctx = pageCanvas.getContext('2d');
  if (!ctx) throw new Error('paginateCanvasToTile: kon 2D-context niet verkrijgen');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageCanvasW, pageCanvasH);
  for (const win of column.xWindows) {
    const destXpx = win.pageX * pxPt;
    const destWpx = win.srcW * layout.scale * pxPt;
    if (layout.repeatHeaderPx > 0) {
      drawTile(ctx, canvas, srcScale, win.srcX, 0, win.srcW, layout.repeatHeaderPx,
        destXpx, layout.marginPt * pxPt, destWpx, layout.repeatHeaderPx * layout.scale * pxPt);
    }
    drawTile(ctx, canvas, srcScale, win.srcX, row.srcY, win.srcW, row.srcH,
      destXpx, layout.bodyTopPt * pxPt, destWpx, row.srcH * layout.scale * pxPt);
  }
  if (layout.repeatFooterPx > 0) {
    const fw = layout.footerWindow;
    drawTile(ctx, canvas, srcScale, fw.srcX, layout.repeatFooterSrcY, fw.srcW, layout.repeatFooterPx,
      fw.pageX * pxPt, layout.footerTopPt * pxPt, fw.srcW * layout.scale * pxPt, layout.repeatFooterPtH * pxPt);
  }
  ctx.fillStyle = '#999999';
  ctx.font = `${Math.round(8 * pxPt)}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${pageIndex + 1} / ${totalPages}`, (layout.pageWidthPt - layout.marginPt) * pxPt,
    (layout.pageHeightPt - layout.marginPt * 0.5) * pxPt);
  return pageCanvas;
}

const SUPERSAMPLE = 2;

export function paginateCanvasToPdfBytes(canvas: HTMLCanvasElement, opts: PaginateOptions): Uint8Array {
  const quality = opts.quality ?? 0.9;
  const layout = computeTileLayout(opts);
  const totalPages = layout.rows * layout.cols;

  const pdfPages: PdfImagePage[] = [];
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageCanvas = paginateCanvasToTile(canvas, opts, pageIndex);
    if (!pageCanvas) continue;
    const dataUrl = pageCanvas.toDataURL('image/jpeg', quality);
    pdfPages.push({
      jpegBytes: dataUrlToBytes(dataUrl),
      widthPt: layout.pageWidthPt,
      heightPt: layout.pageHeightPt,
      imageWidthPx: pageCanvas.width,
      imageHeightPx: pageCanvas.height,
    });
    pageCanvas.width = 0;
    pageCanvas.height = 0;
  }

  return buildImagePdf(pdfPages);
}

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
