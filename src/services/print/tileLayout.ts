export type PaperSize = 'a4' | 'a3' | 'a2' | 'a1';
export type Orientation = 'portrait' | 'landscape';
export type PaginateMode = 'fit-width' | 'actual';

export const PAPER_PT: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  a3: { width: 841.89, height: 1190.55 },
  a2: { width: 1190.55, height: 1683.78 },
  a1: { width: 1683.78, height: 2383.94 },
};

export const DEFAULT_MARGIN_PT = 24;

export const LOGICAL_PX_TO_PT = 72 / 96;

export function printableWidthPt(
  paperSize: PaperSize,
  orientation: Orientation,
  marginPt = DEFAULT_MARGIN_PT,
): number {
  const paper = PAPER_PT[paperSize];
  const pageWidthPt = orientation === 'landscape' ? paper.height : paper.width;
  return Math.max(0, pageWidthPt - 2 * marginPt);
}

export function printableWidthLogicalPx(
  paperSize: PaperSize,
  orientation: Orientation,
  marginPt = DEFAULT_MARGIN_PT,
): number {
  return printableWidthPt(paperSize, orientation, marginPt) / LOGICAL_PX_TO_PT;
}

export const PAGE_NUMBER_PT = 14;

export const MAX_TIMELINE_COLUMNS = 32;

export interface TileLayoutInput {
  paperSize: PaperSize;
  orientation: Orientation;
  mode: PaginateMode;
  logicalWidth: number;
  logicalHeight: number;
  frozenColumnWidthPx?: number;
  repeatHeaderHeightPx?: number;
  repeatFooterHeightPx?: number;
  breakOffsetsPx?: readonly number[];
  forcedBreakOffsetsPx?: readonly number[];
  timelineColumns?: number;
  marginPt?: number;
}

export interface TileXWindow {
  srcX: number;
  srcW: number;
  pageX: number;
}

export interface TileColumn {
  xWindows: TileXWindow[];
}

export interface TileBodyRow {
  srcY: number;
  srcH: number;
}

export function footerLayoutWidthFor(layout: Pick<TileLayout, 'repeatFooterPx' | 'footerLayoutWidthPx'>): number | undefined {
  return layout.repeatFooterPx > 0 ? layout.footerLayoutWidthPx : undefined;
}

export interface ReportTileDims {
  width: number;
  height: number;
  tableWidth: number;
  headerHeight: number;
  footerHeight: number;
  breakOffsets?: readonly number[];
  forcedBreakOffsets?: readonly number[];
}

export interface ReportTileOptions {
  paperSize: PaperSize;
  orientation: Orientation;
  mode: PaginateMode;
  repeatHeader: boolean;
  repeatFooter: boolean;
  timelineColumns?: number;
  marginPt?: number;
}

export function reportTileInput(dims: ReportTileDims, opts: ReportTileOptions): TileLayoutInput {
  return {
    paperSize: opts.paperSize,
    orientation: opts.orientation,
    mode: opts.mode,
    logicalWidth: dims.width,
    logicalHeight: dims.height,
    frozenColumnWidthPx: dims.tableWidth,
    repeatHeaderHeightPx: opts.repeatHeader ? dims.headerHeight : 0,
    repeatFooterHeightPx: opts.repeatFooter ? dims.footerHeight : 0,
    timelineColumns: opts.timelineColumns,
    marginPt: opts.marginPt,
    breakOffsetsPx: dims.breakOffsets,
    forcedBreakOffsetsPx: dims.forcedBreakOffsets,
  };
}

export function footerRelayoutWidth(layout: Pick<TileLayout, 'repeatFooterPx' | 'footerLayoutWidthPx'>, renderWidth: number): number | undefined {
  const width = footerLayoutWidthFor(layout);
  return width !== undefined && width < renderWidth - 0.5 ? width : undefined;
}

export interface TileLayout {
  pageWidthPt: number;
  pageHeightPt: number;
  marginPt: number;
  printW: number;
  printH: number;
  scale: number;
  rows: number;
  cols: number;
  frozenPx: number;
  frozenPtW: number;
  repeatHeaderPx: number;
  repeatHeaderPtH: number;
  repeatFooterPx: number;
  repeatFooterPtH: number;
  repeatFooterSrcY: number;
  footerWindow: TileXWindow;
  footerLayoutWidthPx: number;
  footerTopPt: number;
  bodyTopPt: number;
  columns: TileColumn[];
  bodyRows: TileBodyRow[];
}

const MIN_BREAK_FILL = 0.5;

export function computeTileLayout(input: TileLayoutInput): TileLayout {
  const marginPt = input.marginPt ?? DEFAULT_MARGIN_PT;
  const frozenRequestedPx = Math.max(0, input.frozenColumnWidthPx ?? 0);

  const base = PAPER_PT[input.paperSize];
  const pageWidthPt = input.orientation === 'landscape' ? base.height : base.width;
  const pageHeightPt = input.orientation === 'landscape' ? base.width : base.height;

  const printW = pageWidthPt - 2 * marginPt;
  const printH = pageHeightPt - 2 * marginPt - PAGE_NUMBER_PT;

  const cw = Number.isFinite(input.logicalWidth) ? Math.max(0, input.logicalWidth) : 0;
  const ch = Number.isFinite(input.logicalHeight) ? Math.max(0, input.logicalHeight) : 0;

  const requestedCols = input.timelineColumns ?? 1;
  const timelineCols = Number.isFinite(requestedCols)
    ? Math.min(MAX_TIMELINE_COLUMNS, Math.max(1, Math.floor(requestedCols)))
    : 1;

  let scale: number;
  if (input.mode === 'fit-width') {
    const virtualWidth = cw + (timelineCols - 1) * frozenRequestedPx;
    scale = virtualWidth > 0 ? (printW * timelineCols) / virtualWidth : 1;
  } else {
    scale = LOGICAL_PX_TO_PT;
  }

  const repeatsFrozen = input.mode === 'actual' || timelineCols > 1;
  const frozenPx = repeatsFrozen ? frozenRequestedPx : 0;
  const frozenPtW = frozenPx * scale;

  const col0Bodypx = printW / scale;
  const laterColBodypx = (printW - frozenPtW) / scale;

  let cols: number;
  if (input.mode === 'fit-width') {
    cols = timelineCols;
  } else if (cw > col0Bodypx && laterColBodypx > 0) {
    cols = 1 + Math.ceil((cw - col0Bodypx) / laterColBodypx);
  } else {
    cols = 1;
  }
  cols = Math.max(1, cols);

  const pageSrcHpx = printH / scale;
  const repeatRequestedPx = Math.max(0, input.repeatHeaderHeightPx ?? 0);
  const repeatHeaderPx = repeatRequestedPx > 0 && repeatRequestedPx < pageSrcHpx && repeatRequestedPx < ch
    ? repeatRequestedPx
    : 0;
  const repeatHeaderPtH = repeatHeaderPx * scale;
  const footerRequestedPx = Math.max(0, input.repeatFooterHeightPx ?? 0);
  const forcesSecondPage = (input.forcedBreakOffsetsPx ?? [])
    .some(y => Number.isFinite(y) && y > repeatHeaderPx && y < ch - footerRequestedPx);
  const multiPage = ch > pageSrcHpx || cols > 1 || forcesSecondPage;
  const repeatFooterPx = footerRequestedPx > 0
    && multiPage
    && repeatHeaderPx + footerRequestedPx < pageSrcHpx
    && repeatHeaderPx + footerRequestedPx < ch
    ? footerRequestedPx
    : 0;
  const repeatFooterPtH = repeatFooterPx * scale;
  const repeatFooterSrcY = ch - repeatFooterPx;
  const bodyEnd = repeatFooterSrcY;
  const bodyRowHpx = pageSrcHpx - repeatHeaderPx - repeatFooterPx;
  const bodyRows: TileBodyRow[] = [];
  const inBody = (y: number) => Number.isFinite(y) && y > repeatHeaderPx && y < bodyEnd;
  const breaks = (input.breakOffsetsPx ?? []).filter(inBody).sort((x, y) => x - y);
  const forced = (input.forcedBreakOffsetsPx ?? []).filter(inBody).sort((x, y) => x - y);
  const allowed = forced.length > 0 ? [...new Set([...breaks, ...forced])].sort((x, y) => x - y) : breaks;
  let srcY = repeatHeaderPx;
  let fi = 0;
  let ai = 0;
  while (srcY < bodyEnd || bodyRows.length === 0) {
    const maxEnd = Math.min(bodyEnd, srcY + bodyRowHpx);
    let end = maxEnd;
    while (fi < forced.length && forced[fi] <= srcY) fi++;
    const nextForced = forced[fi];
    if (nextForced !== undefined && nextForced <= maxEnd) {
      end = nextForced;
    } else if (allowed.length > 0 && maxEnd < bodyEnd) {
      while (ai < allowed.length && allowed[ai] <= srcY) ai++;
      let best = -1;
      for (let i = ai; i < allowed.length; i++) {
        const y = allowed[i];
        if (y > maxEnd) break;
        best = y;
      }
      if (best > srcY && best - srcY >= MIN_BREAK_FILL * bodyRowHpx) end = best;
    }
    bodyRows.push({ srcY, srcH: end - srcY });
    if (end <= srcY) break;
    srcY = end;
  }
  const rows = bodyRows.length;

  const columns: TileColumn[] = [];
  for (let c = 0; c < cols; c++) {
    if (c === 0) {
      columns.push({ xWindows: [{ srcX: 0, srcW: Math.min(col0Bodypx, cw), pageX: marginPt }] });
      continue;
    }
    const xWindows: TileXWindow[] = [];
    if (frozenPx > 0 && frozenPtW > 0) {
      xWindows.push({ srcX: 0, srcW: frozenPx, pageX: marginPt });
    }
    const bodySrcX = col0Bodypx + (c - 1) * laterColBodypx;
    xWindows.push({
      srcX: bodySrcX,
      srcW: Math.min(laterColBodypx, cw - bodySrcX),
      pageX: marginPt + frozenPtW,
    });
    columns.push({ xWindows });
  }

  return {
    pageWidthPt,
    pageHeightPt,
    marginPt,
    printW,
    printH,
    scale,
    rows,
    cols,
    frozenPx,
    frozenPtW,
    repeatHeaderPx,
    repeatHeaderPtH,
    repeatFooterPx,
    repeatFooterPtH,
    repeatFooterSrcY,
    footerWindow: { srcX: 0, srcW: Math.min(col0Bodypx, cw), pageX: marginPt },
    footerLayoutWidthPx: col0Bodypx,
    bodyTopPt: marginPt + repeatHeaderPtH,
    footerTopPt: marginPt + printH - repeatFooterPtH,
    columns,
    bodyRows,
  };
}
