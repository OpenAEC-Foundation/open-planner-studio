import type { PdfTableColumn, PdfSectionedReportSpec, PdfReportKpi } from '@/services/pdf/pdfTable';
import type { CurveChartSpec } from '@/services/pdf/pdfCurveChart';

export interface ReportColumn<Row> extends PdfTableColumn<Row> {
  key: string;
}

export interface ReportSection<Row = unknown> {
  key: string;
  heading?: string;
  columns: ReportColumn<Row>[];
  rows: Row[];
  emptyText?: string;
}

export interface ReportSummaryItem {
  label: string;
  value: string;
  color?: string;
}

export type ReportKpi = PdfReportKpi;

export interface TableReportSpec {
  title: string;
  subtitle?: string;
  notes: string[];
  summary: ReportSummaryItem[];
  kpis?: ReportKpi[];
  chart?: { spec?: CurveChartSpec; emptyText?: string };
  sections: ReportSection[];
  fileSuffix: string;
}

export function section<Row>(s: ReportSection<Row>): ReportSection {
  return s as unknown as ReportSection;
}

export function toPdfSpec(spec: TableReportSpec): PdfSectionedReportSpec {
  return {
    title: spec.title,
    subtitle: spec.subtitle,
    notes: spec.notes,
    summary: spec.summary.map(s => ({ label: s.label, value: s.value, color: s.color })),
    kpis: spec.kpis,
    chart: spec.chart,
    sections: spec.sections.map(s => ({ heading: s.heading, columns: s.columns, rows: s.rows, emptyText: s.emptyText })),
  };
}

export const REPORT_COLORS = {
  error: '#DC2626',
  warn: '#D97706',
  ok: '#10B981',
  info: '#2563EB',
  muted: '#6B7280',
  accent: '#7C3AED',
} as const;
