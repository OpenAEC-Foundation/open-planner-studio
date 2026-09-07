import type { PdfTableColumn, PdfSectionedReportSpec } from '@/services/pdf/pdfTable';

/**
 * Contract tussen de rapportbouwers (`useTableReportSpec`), de DOM-weergave (`TableReportView`)
 * en de vector-PDF-export (`makeSectionedRenderReport`): ÉÉN kolomspec per sectie, die zowel de
 * `<table>` als de PDF tekent. Het mijlpalen- en variance-rapport houden nog hun eigen dubbele
 * kolomspec (DOM-component + `build*Columns`); de zeven rapporten uit discussie #31 delen deze.
 */
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
  /** Nadrukkleur (CSS-kleur) — dezelfde in DOM en PDF. */
  color?: string;
}

export interface TableReportSpec {
  title: string;
  subtitle?: string;
  /** Meldingen boven het rapport (geen statusdatum, planning niet berekend, …). */
  notes: string[];
  summary: ReportSummaryItem[];
  sections: ReportSection[];
  /** Bestandsnaam-suffix van de PDF-export (`<project>-<suffix>.pdf`), taalonafhankelijk. */
  fileSuffix: string;
}

/** Wist het rijtype van een sectie zodat secties met verschillende rijtypen in één lijst passen. */
export function section<Row>(s: ReportSection<Row>): ReportSection {
  return s as unknown as ReportSection;
}

export function toPdfSpec(spec: TableReportSpec): PdfSectionedReportSpec {
  return {
    title: spec.title,
    subtitle: [spec.subtitle, ...spec.notes].filter(Boolean).join(' · ') || undefined,
    summary: spec.summary.map(s => ({ label: s.label, value: s.value, color: s.color })),
    sections: spec.sections.map(s => ({ heading: s.heading, columns: s.columns, rows: s.rows, emptyText: s.emptyText })),
  };
}

/** Vaste rapportkleuren — dezelfde tinten als de mijlpalen-/variance-badges. */
export const REPORT_COLORS = {
  error: '#DC2626',
  warn: '#D97706',
  ok: '#10B981',
  info: '#2563EB',
  muted: '#6B7280',
  accent: '#7C3AED',
} as const;
