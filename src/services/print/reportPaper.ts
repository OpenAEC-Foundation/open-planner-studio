// Het interactieve rapportpapier (issue #817): bladen als SVG en de klikbare delen van een blad.
//
// Alles hier is puur (geen DOM, geen canvas): de bladindeling komt uit dezelfde `TileLayout` als de
// PDF-pagineerders (`paginateVector.ts`, `paginate.ts`), dus een blad op het scherm heeft dezelfde
// vensters, dezelfde herhaalde kop en voet en hetzelfde paginanummer als het blad in de PDF.

import type { RenderReportResult } from '@/services/print/printPreview';
import type { TileLayout } from '@/services/print/tileLayout';
import { fontClassCss, opToSvg, opsInWindow, type RecordedReport } from '@/services/pdf/svgDraw2d';

/** Eén bronvenster van het rapport en waar het op het blad staat (punten vanaf linksboven). */
export interface PageWindow {
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  dstX: number;
  dstY: number;
}

/**
 * De vensters van één blad, in tekenvolgorde: per tegelkolom eerst de herhaalde kop, dan de body;
 * daarna één keer de herhaalde voet. Precies de volgorde en maten van `renderPrintPreviewPage` en van
 * `paginateVectorToPdfBytes`.
 */
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

/** Het paginanummer zoals de PDF het zet: `n / totaal`, rechts in de ondermarge, 8 pt grijs. */
export function pageLabel(layout: TileLayout, pageIndex: number): { text: string; x: number; y: number } {
  return {
    text: `${pageIndex + 1} / ${layout.rows * layout.cols}`,
    x: layout.pageWidthPt - layout.marginPt,
    y: layout.pageHeightPt - layout.marginPt * 0.5,
  };
}

export interface ReportPageSvgOptions {
  /** Schrijfrichting van de rapporttaal (zoals de canvas en de PDF die gebruiken voor gemengde tekst). */
  rtl?: boolean;
  /** CSS-letter van het paginanummer (8 pt Inter, zoals de PDF). */
  pageLabelFont?: string;
}

/**
 * Eén blad als complete `<svg>`-tekst (punten als eenheid, wit papier). Alleen de opdrachten die een
 * venster van dit blad raken komen erin; elk venster is een geneste `<svg>` die op zijn `viewBox`
 * afknipt — net als de clip die de raster- en de vectorpagineerder per venster zetten.
 */
export function reportPageSvg(
  rec: RecordedReport,
  layout: TileLayout,
  pageIndex: number,
  options: ReportPageSvgOptions = {},
): string {
  const W = layout.pageWidthPt;
  const H = layout.pageHeightPt;
  // Een eigen klassevoorvoegsel per blad: meerdere bladen staan in hetzelfde document en hun `<style>`
  // geldt documentbreed. De letterlijst is per opname gelijk, dus dezelfde regels botsen niet, maar
  // een vorige opname (andere letterindex) mag een nieuw blad nooit opmaken.
  const prefix = `rf${pageIndex}_`;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(W)} ${num(H)}" width="100%" height="100%"`
      + `${options.rtl ? ' direction="rtl"' : ''} data-report-page-svg="${pageIndex}">`,
    `<style>${fontClassCss(rec.fonts, prefix)}</style>`,
    `<rect width="${num(W)}" height="${num(H)}" fill="#ffffff"/>`,
  ];
  for (const win of pageWindows(layout, pageIndex)) {
    const ids = opsInWindow(rec, win.srcX, win.srcY, win.srcX + win.srcW, win.srcY + win.srcH);
    parts.push(
      `<svg x="${num(win.dstX)}" y="${num(win.dstY)}" width="${num(win.srcW * layout.scale)}" height="${num(win.srcH * layout.scale)}"`
        + ` viewBox="${num(win.srcX)} ${num(win.srcY)} ${num(win.srcW)} ${num(win.srcH)}" preserveAspectRatio="none" overflow="hidden">`,
    );
    for (const id of ids) parts.push(opToSvg(rec.ops[id], prefix, options.rtl));
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

// ---- Klikbare delen van het papier ----------------------------------------------------------------

/** De delen van het papier die een eigen stap in de zijbalk hebben. */
export type PaperRegionId = 'header' | 'columns' | 'chart' | 'footer';

export interface PaperRect { x: number; y: number; w: number; h: number }

export interface PaperRegion {
  id: PaperRegionId;
  /** Rechthoeken in punten op het blad; een deel kan op één blad in meerdere vensters staan. */
  rects: PaperRect[];
}

export interface PaperColumnRect extends PaperRect {
  /** Sleutel uit `RenderReportResult.tableColumnBounds` (ingebouwde soort of registersleutel). */
  key: string;
}

export interface PageRegions {
  regions: PaperRegion[];
  /** De tabelkolommen op dit blad (kop plus cellen), voor "welke kolom staat onder de muis". */
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

/**
 * De delen van één blad in punten: de kop (projectnaam en datums), de kolommen (kolomkoppen en
 * cellen), de balken met de tijdlijn en de voet met de legenda. De grenzen komen uit de render zelf
 * (`RenderReportResult`), dus ze liggen precies waar het papier ze tekent.
 */
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

/** Welk deel (en welke kolom) ligt onder een punt van het blad? `null` = de marge (stap Pagina). */
export function hitPaperRegion(regions: PageRegions, x: number, y: number): { id: PaperRegionId; column?: string } | null {
  const inside = (r: PaperRect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  for (const region of regions.regions) {
    if (!region.rects.some(inside)) continue;
    const column = region.id === 'columns' ? regions.columns.find(inside)?.key : undefined;
    return column ? { id: region.id, column } : { id: region.id };
  }
  return null;
}
