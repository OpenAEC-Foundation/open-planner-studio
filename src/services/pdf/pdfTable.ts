import type { Draw2D } from './draw2d';
import type { RenderReportResult } from '@/services/print/printPreview';
import { ellipsize } from '@/engine/renderer/textFit';
import { DEFAULT_REPORT_FONT_STACK } from './reportFont';
import {
  CURVE_CHART_FOOTNOTE_HEIGHT, CURVE_CHART_HEIGHT, CURVE_CHART_LEGEND_HEIGHT, CURVE_CHART_WIDTH, type CurveChartSpec,
  drawCurveChart, drawCurveLegend, layoutCurveChart,
} from './pdfCurveChart';

export type PdfTableAlign = 'left' | 'right' | 'center';

export interface PdfTableColumn<Row> {
  header: string;
  width: number;
  align: PdfTableAlign;
  text(row: Row): string;
  color?(row: Row): string | undefined;
  bold?(row: Row): boolean;
  indent?(row: Row): number;
}

export interface PdfTableSpec<Row> {
  title?: string;
  columns: PdfTableColumn<Row>[];
  rows: Row[];
  emptyText?: string;
}

export interface PdfReportSection<Row = unknown> {
  heading?: string;
  columns: PdfTableColumn<Row>[];
  rows: Row[];
  emptyText?: string;
}

export interface PdfSectionedReportSpec {
  title: string;
  subtitle?: string;
  notes?: string[];
  summary: { label: string; value: string; color?: string }[];
  kpis?: PdfReportKpi[];
  chart?: { spec?: CurveChartSpec; emptyText?: string };
  sections: PdfReportSection[];
}

export interface PdfReportKpi {
  label: string;
  value: string;
  detail?: string;
  color?: string;
}

const COLORS = {
  bg: '#ffffff',
  note: '#D97706',
  text: '#111827',
  textMuted: '#6b7280',
  textDim: '#9ca3af',
  headerBorder: '#9ca3af',
  rowBorder: '#e5e7eb',
};

const TITLE_FONT_SIZE = 15;
const HEADER_FONT_SIZE = 11;
const BODY_FONT_SIZE = 11;
const CELL_PAD_X = 8;
const ROW_HEIGHT = 26;
const HEADER_HEIGHT = 30;
const TITLE_HEIGHT = 36;
const TITLE_BASELINE_GAP = 12;
const SUBTITLE_HEIGHT = 20;
const SUMMARY_LINE_HEIGHT = 18;
const SUMMARY_GAP = 10;
const SECTION_HEADING_HEIGHT = 30;
const SECTION_GAP = 14;
const SUMMARY_COLUMN_WIDTH = 260;
const KPI_HEIGHT = 66;
const KPI_GAP = 10;
const BLOCK_GAP = 14;

export type MeasureText = (text: string, font: string) => number;

function columnHeaderFont(fontStack: string): string {
  return `bold ${HEADER_FONT_SIZE}px ${fontStack}`;
}

export function fitColumnsToHeaders<Row>(
  columns: PdfTableColumn<Row>[],
  measure: MeasureText,
  fontStack: string = DEFAULT_REPORT_FONT_STACK,
): PdfTableColumn<Row>[] {
  const headerFont = columnHeaderFont(fontStack);
  return columns.map(col => {
    const needed = Math.ceil(measure(col.header, headerFont) + 2 * CELL_PAD_X + 1);
    return needed > col.width ? { ...col, width: needed } : col;
  });
}

function cellX(align: PdfTableAlign, colX: number, colW: number): number {
  if (align === 'left') return colX + CELL_PAD_X;
  if (align === 'right') return colX + colW - CELL_PAD_X;
  return colX + colW / 2;
}

function tableHeight(rowCount: number): number {
  return HEADER_HEIGHT + Math.max(1, rowCount) * ROW_HEIGHT;
}

function drawTable<Row>(
  d2d: Draw2D,
  y: number,
  columns: PdfTableColumn<Row>[],
  rows: Row[],
  emptyText: string | undefined,
  fontStack: string,
  breaks?: number[],
): number {
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

  let x = 0;
  d2d.font = columnHeaderFont(fontStack);
  d2d.fillStyle = COLORS.textMuted;
  d2d.textBaseline = 'middle';
  const headerMidY = y + HEADER_HEIGHT / 2;
  for (const col of columns) {
    d2d.textAlign = col.align;
    const avail = col.width - 2 * CELL_PAD_X;
    d2d.fillText(ellipsize(d2d, col.header, avail), cellX(col.align, x, col.width), headerMidY);
    x += col.width;
  }
  d2d.strokeStyle = COLORS.headerBorder;
  d2d.lineWidth = 2;
  d2d.beginPath();
  d2d.moveTo(0, y + HEADER_HEIGHT);
  d2d.lineTo(tableWidth, y + HEADER_HEIGHT);
  d2d.stroke();
  y += HEADER_HEIGHT;

  if (rows.length === 0) {
    d2d.fillStyle = COLORS.textDim;
    d2d.font = `${BODY_FONT_SIZE}px ${fontStack}`;
    d2d.textAlign = 'left';
    d2d.textBaseline = 'middle';
    d2d.fillText(emptyText ?? '', CELL_PAD_X, y + ROW_HEIGHT / 2);
    y += ROW_HEIGHT;
    breaks?.push(y);
  } else {
    for (const row of rows) {
      let cx = 0;
      const midY = y + ROW_HEIGHT / 2;
      for (const col of columns) {
        const bold = col.bold?.(row) ?? false;
        const color = col.color?.(row) ?? COLORS.text;
        d2d.font = `${bold ? 'bold ' : ''}${BODY_FONT_SIZE}px ${fontStack}`;
        d2d.fillStyle = color;
        d2d.textAlign = col.align;
        d2d.textBaseline = 'middle';
        const indent = col.align === 'left' ? Math.max(0, col.indent?.(row) ?? 0) : 0;
        const avail = col.width - 2 * CELL_PAD_X - indent;
        d2d.fillText(ellipsize(d2d, col.text(row), avail), cellX(col.align, cx, col.width) + indent, midY);
        cx += col.width;
      }
      d2d.strokeStyle = COLORS.rowBorder;
      d2d.lineWidth = 1;
      d2d.beginPath();
      d2d.moveTo(0, y + ROW_HEIGHT);
      d2d.lineTo(tableWidth, y + ROW_HEIGHT);
      d2d.stroke();
      y += ROW_HEIGHT;
      breaks?.push(y);
    }
  }
  return y;
}

export function makeTableRenderReport<Row>(
  spec: PdfTableSpec<Row>,
  measure?: MeasureText,
  fontStack: string = DEFAULT_REPORT_FONT_STACK,
): (makeDraw2D: (w: number, h: number) => Draw2D) => RenderReportResult {
  const columns = measure ? fitColumnsToHeaders(spec.columns, measure, fontStack) : spec.columns;
  return (makeDraw2D) => {
    const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
    const titleH = spec.title ? TITLE_HEIGHT : 0;
    const height = titleH + tableHeight(spec.rows.length);

    const d2d = makeDraw2D(tableWidth, height);

    d2d.fillStyle = COLORS.bg;
    d2d.fillRect(0, 0, tableWidth, height);

    let y = 0;

    if (spec.title) {
      d2d.fillStyle = COLORS.text;
      d2d.font = `bold ${TITLE_FONT_SIZE}px ${fontStack}`;
      d2d.textAlign = 'left';
      d2d.textBaseline = 'alphabetic';
      d2d.fillText(spec.title, 0, titleH - TITLE_BASELINE_GAP);
      y = titleH;
    }

    const breakOffsets: number[] = [];
    drawTable(d2d, y, columns, spec.rows, spec.emptyText, fontStack, breakOffsets);

    d2d.textAlign = 'left';
    d2d.textBaseline = 'alphabetic';

    return { width: tableWidth, height, tableWidth: 0, headerHeight: 0, footerHeight: 0, breakOffsets };
  };
}

export function makeSectionedRenderReport(
  spec: PdfSectionedReportSpec,
  measure?: MeasureText,
  fontStack: string = DEFAULT_REPORT_FONT_STACK,
): (makeDraw2D: (w: number, h: number) => Draw2D) => RenderReportResult {
  const sections = measure
    ? spec.sections.map(s => ({ ...s, columns: fitColumnsToHeaders(s.columns, measure, fontStack) }))
    : spec.sections;
  return (makeDraw2D) => {
    const sectionWidths = sections.map(s => s.columns.reduce((sum, c) => sum + c.width, 0));
    const width = Math.max(SUMMARY_COLUMN_WIDTH, ...sectionWidths, spec.chart ? CURVE_CHART_WIDTH : 0);
    const kpis = spec.kpis ?? [];
    const kpiH = kpis.length > 0 ? KPI_HEIGHT + BLOCK_GAP : 0;
    const chartSpec = spec.chart?.spec;
    const chartH = !spec.chart ? 0
      : chartSpec ? CURVE_CHART_HEIGHT + CURVE_CHART_LEGEND_HEIGHT + (chartSpec.footnote ? CURVE_CHART_FOOTNOTE_HEIGHT : 0) + BLOCK_GAP
      : SUBTITLE_HEIGHT + BLOCK_GAP;
    const subtitleH = spec.subtitle ? SUBTITLE_HEIGHT : 0;
    const notes = spec.notes ?? [];
    const notesH = notes.length * SUBTITLE_HEIGHT;
    const summaryLines = Math.ceil(spec.summary.length / 2);
    const summaryH = summaryLines > 0 ? summaryLines * SUMMARY_LINE_HEIGHT + SUMMARY_GAP : 0;
    let height = TITLE_HEIGHT + subtitleH + notesH + summaryH + kpiH + chartH;
    for (const s of sections) {
      height += (s.heading ? SECTION_HEADING_HEIGHT : 0) + tableHeight(s.rows.length) + SECTION_GAP;
    }

    const d2d = makeDraw2D(width, height);
    d2d.fillStyle = COLORS.bg;
    d2d.fillRect(0, 0, width, height);

    d2d.fillStyle = COLORS.text;
    d2d.font = `bold ${TITLE_FONT_SIZE}px ${fontStack}`;
    d2d.textAlign = 'left';
    d2d.textBaseline = 'alphabetic';
    d2d.fillText(spec.title, 0, TITLE_HEIGHT - TITLE_BASELINE_GAP);
    let y = TITLE_HEIGHT;

    if (spec.subtitle) {
      d2d.fillStyle = COLORS.textMuted;
      d2d.font = `${BODY_FONT_SIZE}px ${fontStack}`;
      d2d.textBaseline = 'middle';
      d2d.fillText(ellipsize(d2d, spec.subtitle, width), 0, y + SUBTITLE_HEIGHT / 2);
      y += SUBTITLE_HEIGHT;
    }
    for (const note of notes) {
      d2d.fillStyle = COLORS.note;
      d2d.font = `${BODY_FONT_SIZE}px ${fontStack}`;
      d2d.textBaseline = 'middle';
      d2d.fillText(ellipsize(d2d, note, width), 0, y + SUBTITLE_HEIGHT / 2);
      y += SUBTITLE_HEIGHT;
    }

    if (spec.summary.length > 0) {
      const colW = Math.max(SUMMARY_COLUMN_WIDTH, width / 2);
      spec.summary.forEach((item, i) => {
        const col = i % 2;
        const line = Math.floor(i / 2);
        const x = col * colW;
        const midY = y + line * SUMMARY_LINE_HEIGHT + SUMMARY_LINE_HEIGHT / 2;
        d2d.textBaseline = 'middle';
        d2d.textAlign = 'left';
        d2d.font = `${BODY_FONT_SIZE}px ${fontStack}`;
        d2d.fillStyle = COLORS.textMuted;
        const label = ellipsize(d2d, item.label, colW * 0.6);
        d2d.fillText(label, x, midY);
        const labelW = d2d.measureText(label).width + CELL_PAD_X;
        d2d.font = `bold ${BODY_FONT_SIZE}px ${fontStack}`;
        d2d.fillStyle = item.color ?? COLORS.text;
        d2d.fillText(ellipsize(d2d, item.value, colW - labelW - CELL_PAD_X), x + labelW, midY);
      });
      y += summaryH;
    }

    if (kpis.length > 0) {
      const boxW = (width - KPI_GAP * (kpis.length - 1)) / kpis.length;
      kpis.forEach((k, i) => {
        const x = i * (boxW + KPI_GAP);
        d2d.strokeStyle = COLORS.rowBorder;
        d2d.lineWidth = 1;
        d2d.strokeRect(x + 0.5, y + 0.5, boxW - 1, KPI_HEIGHT - 1);
        d2d.textAlign = 'left';
        d2d.textBaseline = 'middle';
        d2d.font = `${BODY_FONT_SIZE - 1}px ${fontStack}`;
        d2d.fillStyle = COLORS.textMuted;
        d2d.fillText(ellipsize(d2d, k.label, boxW - 2 * CELL_PAD_X), x + CELL_PAD_X, y + 14);
        d2d.font = `bold 18px ${fontStack}`;
        d2d.fillStyle = k.color ?? COLORS.text;
        d2d.fillText(ellipsize(d2d, k.value, boxW - 2 * CELL_PAD_X), x + CELL_PAD_X, y + 35);
        if (k.detail) {
          d2d.font = `${BODY_FONT_SIZE - 1}px ${fontStack}`;
          d2d.fillStyle = COLORS.textMuted;
          d2d.fillText(ellipsize(d2d, k.detail, boxW - 2 * CELL_PAD_X), x + CELL_PAD_X, y + 54);
        }
      });
      y += kpiH;
    }

    if (spec.chart) {
      if (chartSpec) {
        drawCurveChart(d2d, layoutCurveChart(chartSpec), 0, y, fontStack);
        y += CURVE_CHART_HEIGHT;
        drawCurveLegend(d2d, chartSpec, 0, y, width, fontStack, COLORS.text);
        y += CURVE_CHART_LEGEND_HEIGHT;
        if (chartSpec.footnote) {
          d2d.fillStyle = COLORS.textMuted;
          d2d.font = `${BODY_FONT_SIZE - 1}px ${fontStack}`;
          d2d.textAlign = 'left';
          d2d.textBaseline = 'middle';
          d2d.fillText(ellipsize(d2d, chartSpec.footnote, width), 0, y + CURVE_CHART_FOOTNOTE_HEIGHT / 2);
          y += CURVE_CHART_FOOTNOTE_HEIGHT;
        }
      } else {
        d2d.fillStyle = COLORS.textDim;
        d2d.font = `${BODY_FONT_SIZE}px ${fontStack}`;
        d2d.textAlign = 'left';
        d2d.textBaseline = 'middle';
        d2d.fillText(ellipsize(d2d, spec.chart.emptyText ?? '', width), 0, y + SUBTITLE_HEIGHT / 2);
        y += SUBTITLE_HEIGHT;
      }
      y += BLOCK_GAP;
    }

    const breakOffsets: number[] = [];
    if (spec.summary.length > 0 || spec.subtitle || notes.length > 0 || kpis.length > 0 || spec.chart) breakOffsets.push(y);
    for (const s of sections) {
      if (s.heading) {
        d2d.fillStyle = COLORS.text;
        d2d.font = `bold ${HEADER_FONT_SIZE + 1}px ${fontStack}`;
        d2d.textAlign = 'left';
        d2d.textBaseline = 'middle';
        d2d.fillText(ellipsize(d2d, s.heading, width), 0, y + SECTION_HEADING_HEIGHT / 2 + 4);
        y += SECTION_HEADING_HEIGHT;
      }
      y = drawTable(d2d, y, s.columns, s.rows, s.emptyText, fontStack, breakOffsets);
      y += SECTION_GAP;
      breakOffsets.push(y);
    }

    d2d.textAlign = 'left';
    d2d.textBaseline = 'alphabetic';
    return { width, height, tableWidth: 0, headerHeight: 0, footerHeight: 0, breakOffsets };
  };
}
