import type { ExportFormat } from './formatRegistry';
import type { XerImportMetadata } from './importTypes';
import type { XerSourceArchive } from './xerSourceArchive';
import type { Project, SchedulingOptions } from '@/types/project';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Baseline } from '@/types/baseline';

export type XerLossyExportFormat = Exclude<ExportFormat, 'ifc'>;
export type XerExportLossCategory =
  | 'exact-source-bytes'
  | 'unknown-tables-and-fields'
  | 'typed-diagnostics'
  | 'baselines'
  | 'udfs'
  | 'activity-codes'
  | 'notes'
  | 'raw-curves-and-assignment-quantities'
  | 'external-links'
  | 'schedule-options-and-provenance'
  | 'p6-relation-lag-degradation';

export interface XerExportLossWarning {
  readonly code: 'XER_ONLY_DATA_NOT_EXPRESSIBLE';
  readonly format: XerLossyExportFormat;
  /** Er bestaat geen `.mpp`-export (de lezer is alleen-lezen); de dode `'mpp'`/`'unsupported'`-tak
   *  is verwijderd (Fable-critreview PR #109 bevinding 12). */
  readonly availability: 'supported-lossy';
  readonly categories: readonly XerExportLossCategory[];
}

/** Alleen de velden die de verliesdetector werkelijk inspecteert; geen tweede AppState-contract. */
export interface XerExportLossInput {
  readonly sourceArchive: XerSourceArchive | null;
  readonly importMetadata: XerImportMetadata | null;
  readonly project: Pick<Project, 'progressMode' | 'schedulingOptions'>;
  readonly tasks: readonly Pick<Task, 'activityCodes' | 'customFields' | 'notes' | 'externalLinks'>[];
  readonly sequences: readonly Pick<Sequence, 'lagPercent' | 'lagUnit'>[];
  readonly assignments: readonly Pick<ResourceAssignment, 'curve' | 'unitsPerDay'>[];
  readonly activityCodeTypes: readonly ActivityCodeType[];
  readonly customFieldDefs: readonly CustomFieldDef[];
  readonly baselines: readonly Baseline[];
  readonly activeBaselineId: string | null;
}

interface ExportCapabilities {
  /** MSPDI projecteert alleen actieve taakwaarden; geen writer round-tript het OPS-baselineobject. */
  readonly baselineProjection: 'none' | 'active-task-values';
  /** Writer projecteert de live units/curve; retained XER-bronwaarden blijven altijd apart verlies. */
  readonly projectedAssignments: boolean;
  readonly percentLag: boolean;
  readonly elapsedLag: boolean;
  readonly schedulingOptions: 'none' | 'critical-slack-limit';
}

/**
 * Gemeten tegen de drie writerimplementaties. Dit is een capabilitymatrix, geen vaste verlieslijst:
 * een categorie ontstaat pas wanneer de bijbehorende retained/live data werkelijk aanwezig is.
 */
/** De voortgangsbladen (issue #27) zijn werkbladen om rond te sturen, geen projectexport: ze dragen
 *  alleen id/WBS/naam/datums/voortgang en worden via `OPS Task ID` teruggekoppeld. Een
 *  XER-verliesmelding is daar per definitie loos (gevonden in de critreview op de merge van main,
 *  2026-09-22: elke voortgangsexport van een XER-document meldde "PROGRESS-CSV" met de categorie
 *  relatie-lag-degradatie, voor een blad zonder relaties). */
type ProgressSheetFormat = 'progress-csv' | 'progress-xlsx';
const isProgressSheetFormat = (format: string): format is ProgressSheetFormat =>
  format === 'progress-csv' || format === 'progress-xlsx';

const EXPORT_CAPABILITIES: Readonly<Record<Exclude<ExportFormat, 'ifc' | ProgressSheetFormat>, ExportCapabilities>> = {
  csv: {
    baselineProjection: 'none',
    projectedAssignments: false,
    percentLag: true,
    elapsedLag: true,
    schedulingOptions: 'none',
  },
  mspdi: {
    baselineProjection: 'active-task-values',
    projectedAssignments: true,
    percentLag: true,
    elapsedLag: true,
    schedulingOptions: 'critical-slack-limit',
  },
  p6: {
    baselineProjection: 'none',
    projectedAssignments: true,
    percentLag: false,
    elapsedLag: false,
    schedulingOptions: 'none',
  },
};

export function xerExportTargetVerdict(
  format: ExportFormat,
): 'lossless' | 'supported-lossy' {
  if (format === 'ifc') return 'lossless';
  return 'supported-lossy';
}

const hasObjectValues = (value: object | undefined): boolean =>
  value !== undefined && Object.values(value).some(item => item !== undefined && item !== '');

function hasTypedDiagnostics(archive: XerSourceArchive | null, metadata: XerImportMetadata | null): boolean {
  const file = archive?.diagnostics.file;
  if (file && (
    file.tableReport.issues.length > 0
    || file.scheduleOptions.length > 0
    || file.relationResolutionIssues.length > 0
    || file.resourceCatalogIssues.length > 0
    || file.metadataCatalogIssues.length > 0
  )) return true;

  if (archive && Object.values(archive.diagnostics.documentViews).some(view =>
    view.tableReport.issues.length > 0
    || view.calendarIssues.length > 0
    || view.enumFallbacks.length > 0
    || view.scheduleOptions.fallbacks.length > 0
    || view.scheduleOptions.diagnostics.length > 0
    || (view.resources?.issues.length ?? 0) > 0)) return true;

  return Boolean(metadata && (
    metadata.tableReport.issues.length > 0
    || metadata.calendarIssues.length > 0
    || metadata.enumFallbacks.length > 0
    || metadata.scheduleOptions.fallbacks.length > 0
    || metadata.scheduleOptions.diagnostics.length > 0
    || (metadata.resources?.issues.length ?? 0) > 0
    || (metadata.metadata?.catalog.issues.length ?? 0) > 0
  ));
}

function hasUnknownTablesOrFields(archive: XerSourceArchive | null, metadata: XerImportMetadata | null): boolean {
  return Boolean(
    archive?.diagnostics.file.tableReport.unknownTables.some(table => table.rows > 0)
    || archive?.diagnostics.file.tableReport.unknownFields?.some(field => field.rows > 0)
    || Object.values(archive?.diagnostics.documentViews ?? {}).some(view =>
      view.tableReport.unknownTables.some(table => table.rows > 0)
      || view.tableReport.unknownFields?.some(field => field.rows > 0))
    || metadata?.tableReport.unknownTables.some(table => table.rows > 0)
    || metadata?.tableReport.unknownFields?.some(field => field.rows > 0),
  );
}

function hasBaselineLoss(capabilities: ExportCapabilities, input: XerExportLossInput): boolean {
  if (input.baselines.length === 0) return false;
  // Ook `active-task-values` is bewust lossy: MSPDI-slot 0 draagt Start/Finish/Duration per taak,
  // maar niet id/sourceProjectId/name/createdAt/projectEnd/projectDuration of brontaakidentiteit.
  switch (capabilities.baselineProjection) {
    case 'none':
    case 'active-task-values':
      return true;
  }
}

function hasRetainedAssignmentDetails(metadata: XerImportMetadata | null): boolean {
  return Boolean(metadata?.resources?.assignments.some(source =>
    hasObjectValues(source.quantities)
    || hasObjectValues(source.rawCurves)
    || hasObjectValues(source.costs)
    || source.assignedRole !== undefined
    // `curveSourceId` verwijst naar de retained 21-punts curve in de bestandsbrede catalogus.
    // Geen doelwriter schrijft deze BRONIDENTITEIT (curv_id/curv_name) terug — de P6-writer
    // (p6xmlWriter.ts's `curveObjIdFor`, ná de contour-engine-etappe 2026-09) genereert bij export
    // een NIEUW `<ResourceCurve><ObjectId>` en een synthetische naam (`Curve N`) voor
    // `ResourceAssignment.curveValues`; de 21 waarden zelf komen voor het P6-doel dus wél
    // schema-natief terug, maar niet de oorspronkelijke P6-curve-identiteit/-naam, en MSPDI/CSV
    // kennen dat 21-puntsformaat sowieso niet (MSPDI kent alleen de 8 vaste `WorkContour`-vormen).
    // De overige archiefvelden hieronder (kwantiteiten, kostenopbouw, target_crv/remain_crv/
    // actual_crv-spreidingsstrings, rate-/kostentype) blijven sowieso ongeschreven, voor elk doel.
    || Boolean(source.curveSourceId?.trim())
    || Boolean(source.rateType?.trim())
    || Boolean(source.costSourceType?.trim())
    || Boolean(source.rawResourceType?.trim())));
}

function hasAssignmentLoss(
  capabilities: ExportCapabilities,
  input: XerExportLossInput,
): boolean {
  if (hasRetainedAssignmentDetails(input.importMetadata)) return true;
  return !capabilities.projectedAssignments && input.assignments.length > 0;
}

function isMspdiCriticalSlackLimit(options: SchedulingOptions): boolean {
  const definition = options.criticalDefinition;
  if (!definition
    || definition.mode !== 'totalFloat'
    || typeof definition.threshold !== 'number'
    || !Number.isInteger(definition.threshold)
    || definition.threshold < 0
    || definition.thresholdHours !== undefined) return false;
  return Object.entries(options).every(([key, value]) =>
    value === undefined || key === 'criticalDefinition');
}

function hasScheduleProvenance(input: XerExportLossInput): boolean {
  const metadata = input.importMetadata;
  const archiveSource = input.sourceArchive?.readModel.scheduleOptionsSourceArchive;
  return Boolean(
    (archiveSource?.rows.length ?? 0) > 0
    || (archiveSource?.unmatchedScheduleOptionsRowIndexes.length ?? 0) > 0
    || (archiveSource?.diagnostics.length ?? 0) > 0
    || (metadata?.scheduleOptions.sourceRows.length ?? 0) > 0
    || (metadata?.scheduleOptions.sourceRowIndexes.length ?? 0) > 0
    || (metadata?.scheduleOptions.fallbacks.length ?? 0) > 0
    || (metadata?.scheduleOptions.diagnostics.length ?? 0) > 0
    || (metadata && metadata.scheduleOptions.source === 'schedoptions')
    || hasObjectValues(metadata?.scheduleOptions.retainedSource)
  );
}

function hasScheduleLoss(capabilities: ExportCapabilities, input: XerExportLossInput): boolean {
  if (hasScheduleProvenance(input) || input.project.progressMode !== undefined) return true;
  const options = input.project.schedulingOptions;
  if (!options || Object.values(options).every(value => value === undefined)) return false;
  return capabilities.schedulingOptions === 'none' || !isMspdiCriticalSlackLimit(options);
}

function categoriesFor(
  format: Exclude<ExportFormat, 'ifc' | ProgressSheetFormat>,
  input: XerExportLossInput,
): XerExportLossCategory[] {
  const capabilities = EXPORT_CAPABILITIES[format];
  const categories: XerExportLossCategory[] = [];
  if (input.sourceArchive && input.sourceArchive.byteLength > 0) categories.push('exact-source-bytes');
  if (hasUnknownTablesOrFields(input.sourceArchive, input.importMetadata)) {
    categories.push('unknown-tables-and-fields');
  }
  if (hasTypedDiagnostics(input.sourceArchive, input.importMetadata)) categories.push('typed-diagnostics');
  if (hasBaselineLoss(capabilities, input)) categories.push('baselines');
  if (input.customFieldDefs.length > 0
    || input.tasks.some(task => hasObjectValues(task.customFields))) categories.push('udfs');
  if (input.activityCodeTypes.length > 0
    || input.tasks.some(task => hasObjectValues(task.activityCodes))) categories.push('activity-codes');
  if (input.tasks.some(task => (task.notes?.length ?? 0) > 0)) categories.push('notes');
  if (hasAssignmentLoss(capabilities, input)) {
    categories.push('raw-curves-and-assignment-quantities');
  }
  if (input.tasks.some(task => (task.externalLinks?.length ?? 0) > 0)
    || (input.importMetadata?.externalLinks.length ?? 0) > 0
    || (input.importMetadata?.externalRelations.length ?? 0) > 0) categories.push('external-links');
  if (hasScheduleLoss(capabilities, input)) categories.push('schedule-options-and-provenance');
  if ((!capabilities.percentLag && input.sequences.some(sequence =>
    typeof sequence.lagPercent === 'number' && Number.isFinite(sequence.lagPercent)))
    || (!capabilities.elapsedLag && input.sequences.some(sequence => sequence.lagUnit === 'ELAPSEDTIME'))) {
    categories.push('p6-relation-lag-degradation');
  }
  return categories;
}

/**
 * X9-dienstcontract voor verliesdetectie. Dit levert uitsluitend getypeerde feiten in de bestaande
 * exportAs-return-envelope; X10 bepaalt later vertaling, dedupe, toast en Lees-meer-link.
 */
export function detectXerExportLoss(
  format: ExportFormat,
  input: XerExportLossInput,
): readonly XerExportLossWarning[] {
  if (format === 'ifc' || isProgressSheetFormat(format)) return [];
  if (!input.sourceArchive && !input.importMetadata) return [];
  const categories = categoriesFor(format, input);
  if (categories.length === 0) return [];
  return [{
    code: 'XER_ONLY_DATA_NOT_EXPRESSIBLE',
    format,
    availability: 'supported-lossy',
    categories,
  }];
}
