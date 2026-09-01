import type { ExportFormat } from './formatRegistry';

export type XerLossyExportFormat = Exclude<ExportFormat, 'ifc'> | 'mpp';
export type XerExportLossCategory =
  | 'baselines'
  | 'udfs'
  | 'activity-codes'
  | 'notes'
  | 'raw-curves-and-assignment-quantities'
  | 'external-links'
  | 'schedule-options-and-provenance';

export interface XerExportLossWarning {
  readonly code: 'XER_ONLY_DATA_NOT_EXPRESSIBLE';
  readonly format: XerLossyExportFormat;
  /** MPP staat hier expliciet op unsupported: OPS heeft geen native MPP-exportadapter. */
  readonly availability: 'supported-lossy' | 'unsupported';
  readonly categories: readonly XerExportLossCategory[];
}

export interface XerExportLossInput {
  readonly hasSourceArchive: boolean;
  readonly hasImportMetadata: boolean;
}

/**
 * Deze lijsten zijn bewust per doelformaat vastgelegd. De XER-import levert deze P6-gegevens
 * wel aan OPS, maar geen van de drie adapters kan ze zonder verlies representeren.
 */
const XER_LOSS_CATEGORIES_BY_FORMAT: Readonly<Record<Exclude<ExportFormat, 'ifc'>, readonly XerExportLossCategory[]>> = {
  csv: [
    'baselines',
    'udfs',
    'activity-codes',
    'notes',
    'raw-curves-and-assignment-quantities',
    'external-links',
    'schedule-options-and-provenance',
  ],
  mspdi: [
    'baselines',
    'udfs',
    'activity-codes',
    'notes',
    'raw-curves-and-assignment-quantities',
    'external-links',
    'schedule-options-and-provenance',
  ],
  p6: [
    'baselines',
    'udfs',
    'activity-codes',
    'notes',
    'raw-curves-and-assignment-quantities',
    'external-links',
    'schedule-options-and-provenance',
  ],
};

export function xerExportTargetVerdict(
  format: ExportFormat | 'mpp',
): 'lossless' | 'supported-lossy' | 'unsupported' {
  if (format === 'ifc') return 'lossless';
  if (format === 'mpp') return 'unsupported';
  return 'supported-lossy';
}

/**
 * X9-dienstcontract voor verliesdetectie. Dit levert uitsluitend getypeerde feiten; X10 bepaalt
 * vertaling, dedupe, toast en Lees-meer-link. Daardoor is de exportlaag niet console-only en wordt
 * deze worktree tegelijk geen tweede UI-schrijver.
 */
export function detectXerExportLoss(
  format: ExportFormat | 'mpp',
  input: XerExportLossInput,
): readonly XerExportLossWarning[] {
  if (format === 'ifc' || (!input.hasSourceArchive && !input.hasImportMetadata)) return [];
  const availability = format === 'mpp' ? 'unsupported' : 'supported-lossy';
  return [{
    code: 'XER_ONLY_DATA_NOT_EXPRESSIBLE',
    format,
    availability,
    categories: format === 'mpp'
      ? []
      : XER_LOSS_CATEGORIES_BY_FORMAT[format],
  }];
}
