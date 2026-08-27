import type { ExportFormat } from './formatRegistry';

export type XerLossyExportFormat = Exclude<ExportFormat, 'ifc'> | 'mpp';
export type XerExportLossCategory =
  | 'exact-source-bytes'
  | 'unknown-tables-and-fields'
  | 'typed-diagnostics'
  | 'project-report'
  | 'external-links'
  | 'p6-provenance';

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

  const categories: XerExportLossCategory[] = [];
  if (input.hasSourceArchive) {
    categories.push('exact-source-bytes', 'unknown-tables-and-fields', 'typed-diagnostics');
  }
  if (input.hasImportMetadata) {
    categories.push('project-report', 'external-links', 'p6-provenance');
  }
  return [{
    code: 'XER_ONLY_DATA_NOT_EXPRESSIBLE',
    format,
    availability,
    categories,
  }];
}
