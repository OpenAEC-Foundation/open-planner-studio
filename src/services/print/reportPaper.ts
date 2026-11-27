import type { RenderReportResult } from '@/services/print/printPreview';
import type { TileLayout } from '@/services/print/tileLayout';
import { clipOpToWindow, fontClassCss, opsInWindow, opsToSvg, reportFontClass, type RecordedReport, type SvgOp } from '@/services/pdf/svgDraw2d';

export interface PageWindow {
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  dstX: number;
  dstY: number;
}

export function pageWindows(layout: TileLayout, pageIndex: number): PageWindow[] {
  const total = layout.rows * layout.cols;
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= total) return [];
  const row = layout.bodyRows[Math.floor(pageIndex / layout.cols)];
  const column = layout.columns[pageIndex % layout.cols];
  if (!row || !column) return [];
  const windows: PageWindow[] = [];
  const push = (srcX: number, srcY: number, srcW: number, srcH: number, dstX: number, dstY: number) => {
    if (srcW > 0 && srcH > 0) windows.push({ srcX, srcY, srcW, srcH, dstX, dstY });
  };
  for (const win of column.xWindows) {
    if (layout.repeatHeaderPx > 0) push(win.srcX, 0, win.srcW, layout.repeatHeaderPx, win.pageX, layout.marginPt);
    push(win.srcX, row.srcY, win.srcW, row.srcH, win.pageX, layout.bodyTopPt);
  }
  if (layout.repeatFooterPx > 0) {
    push(layout.footerWindow.srcX, layout.repeatFooterSrcY, layout.footerWindow.srcW, layout.repeatFooterPx,
      layout.footerWindow.pageX, layout.footerTopPt);
  }
  return windows;
}

export function pageLabel(layout: TileLayout, pageIndex: number): { text: string; x: number; y: number } {
  return {
    text: `${pageIndex + 1} / ${layout.rows * layout.cols}`,
    x: layout.pageWidthPt - layout.marginPt,
    y: layout.pageHeightPt - layout.marginPt * 0.5,
  };
}

export interface ReportPageSvgOptions {
  rtl?: boolean;
  pageLabelFont?: string;
  embedFontStyle?: boolean;
  windowCache?: Map<string, string[]>;
}

export function reportPageSvg(
  rec: RecordedReport,
  layout: TileLayout,
  pageIndex: number,
  options: ReportPageSvgOptions = {},
): string {
  const W = layout.pageWidthPt;
  const H = layout.pageHeightPt;
  const classes = rec.fonts.map(reportFontClass);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(W)} ${num(H)}" width="100%" height="100%"`
      + `${options.rtl ? ' direction="rtl"' : ''} data-report-page-svg="${pageIndex}">`,
    ...(options.embedFontStyle === false ? [] : [`<style>${fontClassCss(rec.fonts)}</style>`]),
    `<rect width="${num(W)}" height="${num(H)}" fill="#ffffff"/>`,
  ];
  for (const win of pageWindows(layout, pageIndex)) {
    parts.push(
      `<svg x="${num(win.dstX)}" y="${num(win.dstY)}" width="${num(win.srcW * layout.scale)}" height="${num(win.srcH * layout.scale)}"`
        + ` viewBox="${num(win.srcX)} ${num(win.srcY)} ${num(win.srcW)} ${num(win.srcH)}" preserveAspectRatio="none" overflow="hidden">`,
    );
    const key = `${win.srcX}|${win.srcY}|${win.srcW}|${win.srcH}`;
    let body = options.windowCache?.get(key);
    if (!body) {
      const ids = opsInWindow(rec, win.srcX, win.srcY, win.srcX + win.srcW, win.srcY + win.srcH);
      const ops: SvgOp[] = [];
      for (const id of ids) {
        const op = clipOpToWindow(rec.ops[id], win.srcX, win.srcY, win.srcX + win.srcW, win.srcY + win.srcH);
        if (op) ops.push(op);
      }
      body = opsToSvg(ops, classes, options.rtl);
      options.windowCache?.set(key, body);
    }
    parts.push(...body);
    parts.push('</svg>');
  }
  const label = pageLabel(layout, pageIndex);
  parts.push(
    `<text x="${num(label.x)}" y="${num(label.y)}" text-anchor="${options.rtl ? 'start' : 'end'}" fill="#999999"`
      + ` style="font:${options.pageLabelFont ?? '8px InterPDF, sans-serif'};font-kerning:none">${label.text}</text>`,
  );
  parts.push('</svg>');
  return parts.join('');
}

function num(v: number): string {
  return String(Math.round(v * 100) / 100);
}

export type PaperRegionId = 'header' | 'columns' | 'chart' | 'footer';

export interface PaperRect { x: number; y: number; w: number; h: number }

export interface PaperRegion {
  id: PaperRegionId;
  rects: PaperRect[];
}

export interface PaperColumnRect extends PaperRect {
  key: string;
}

export interface PageRegions {
  regions: PaperRegion[];
  columns: PaperColumnRect[];
}

type LogicalBox = [number, number, number, number];

function mapBox(box: LogicalBox, win: PageWindow, scale: number): PaperRect | null {
  const x0 = Math.max(box[0], win.srcX);
  const y0 = Math.max(box[1], win.srcY);
  const x1 = Math.min(box[2], win.srcX + win.srcW);
  const y1 = Math.min(box[3], win.srcY + win.srcH);
  if (x1 - x0 <= 0.01 || y1 - y0 <= 0.01) return null;
  return {
    x: win.dstX + (x0 - win.srcX) * scale,
    y: win.dstY + (y0 - win.srcY) * scale,
    w: (x1 - x0) * scale,
    h: (y1 - y0) * scale,
  };
}

export function reportPaperRegions(result: RenderReportResult, layout: TileLayout, pageIndex: number): PageRegions {
  const W = result.width;
  const H = result.height;
  const head = result.projectHeaderHeight ?? result.headerHeight;
  const tw = result.tableWidth;
  const bodyBottom = H - result.footerHeight;
  const boxes: Record<PaperRegionId, LogicalBox | null> = {
    header: head > 0 ? [0, 0, W, head] : null,
    columns: tw > 0 && bodyBottom > head ? [0, head, tw, bodyBottom] : null,
    chart: W > tw && bodyBottom > head ? [tw, head, W, bodyBottom] : null,
    footer: result.footerHeight > 0 ? [0, bodyBottom, W, H] : null,
  };
  const windows = pageWindows(layout, pageIndex);
  const regions: PaperRegion[] = [];
  for (const id of ['header', 'columns', 'chart', 'footer'] as const) {
    const box = boxes[id];
    if (!box) continue;
    const rects = windows.map(win => mapBox(box, win, layout.scale)).filter((r): r is PaperRect => r !== null);
    if (rects.length > 0) regions.push({ id, rects });
  }
  const columns: PaperColumnRect[] = [];
  if (result.headerHeight > 0) {
    for (const col of result.tableColumnBounds ?? []) {
      for (const win of windows) {
        const r = mapBox([col.x, head, col.x + col.w, bodyBottom], win, layout.scale);
        if (r) columns.push({ ...r, key: col.key });
      }
    }
  }
  return { regions, columns };
}

export function hitPaperRegion(regions: PageRegions, x: number, y: number): { id: PaperRegionId; column?: string } | null {
  const inside = (r: PaperRect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  for (const region of regions.regions) {
    if (!region.rects.some(inside)) continue;
    const column = region.id === 'columns' ? regions.columns.find(inside)?.key : undefined;
    return column ? { id: region.id, column } : { id: region.id };
  }
  return null;
}
