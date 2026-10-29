import type { ExportFormat } from './formatRegistry';
import type { XerImportMetadata } from './importTypes';
import type { XerSourceArchive } from './xerSourceArchive';
import { mspdiCriticalSlackLimit } from './msproject/mspdiCriticalSlackLimit';
import type { BuiltInProfileId, Project, ProjectSchedulingOptions } from '@/types/project';
import { CONVENTION_KEYS, builtInConventions, resolveConventions } from '@/engine/scheduler/conventions/registry';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Baseline } from '@/types/baseline';
import { isSummaryTask } from '@/utils/taskHierarchy';

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
  | 'p6-relation-lag-degradation'
  | 'constraints'
  | 'manual-scheduling'
  | 'hammock-tasks';

export interface XerExportLossWarning {
  /** `XER_ONLY_…`: het document draagt een XER-archief of XER-importmetadata. `EXPORT_…`: een document
   *  zonder XER-herkomst; dan kunnen alleen de categorieën uit live documentdata voorkomen (#554). */
  readonly code: 'XER_ONLY_DATA_NOT_EXPRESSIBLE' | 'EXPORT_DATA_NOT_EXPRESSIBLE';
  readonly format: XerLossyExportFormat;
  /** Er bestaat geen `.mpp`-export (de lezer is alleen-lezen). */
  readonly availability: 'supported-lossy';
  readonly categories: readonly XerExportLossCategory[];
}

/** Alleen de velden die de verliesdetector werkelijk inspecteert; geen tweede AppState-contract. */
export interface XerExportLossInput {
  readonly sourceArchive: XerSourceArchive | null;
  readonly importMetadata: XerImportMetadata | null;
  readonly project: Pick<Project, 'progressMode' | 'schedulingOptions' | 'schedulingProfile'>;
  readonly tasks: readonly Pick<Task, 'activityCodes' | 'customFields' | 'notes' | 'externalLinks' | 'constraint' | 'constraint2' | 'manuallyScheduled' | 'isHammock' | 'isSummary' | 'childIds'>[];
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
  /** Welke datumconstraints de writer schrijft. CSV heeft geen kolom; MSPDI kent één ConstraintType; P6 XML
   *  schrijft primair en secundair, maar alleen op een activiteit: een verzameltaak wordt een WBS-element. */
  readonly constraints: 'none' | 'primary' | 'activities';
  readonly schedulingOptions: 'none' | 'critical-slack-limit';
  /** Schrijft de writer taaknotities? (De XER-writer wel; de afvinkstatus meldt hij zelf.) */
  readonly notes: boolean;
  /** Schrijft de writer een hammock als hammock terug? (Alleen XER: `TT_LOE`.) */
  readonly hammocks: boolean;
  /** Met welk ingebouwd profiel dit doelformaat heropent = het `suggestedProfileId` van zijn lezer.
   *  CSV, MSPDI en P6-XML heropenen alle drie als OPS. */
  readonly reopenProfile: BuiltInProfileId;
}

/**
 * Gemeten tegen de drie writerimplementaties. Dit is een capabilitymatrix, geen vaste verlieslijst:
 * een categorie ontstaat pas wanneer de bijbehorende retained/live data werkelijk aanwezig is.
 */
/** De voortgangsbladen zijn werkbladen om rond te sturen, geen projectexport: ze dragen alleen
 *  id/WBS/naam/datums/voortgang en worden via `OPS Task ID` teruggekoppeld. Een XER-verliesmelding
 *  is daar per definitie loos (bv. relatie-lag-degradatie voor een blad zonder relaties). */
type ProgressSheetFormat = 'progress-csv' | 'progress-xlsx';
const isProgressSheetFormat = (format: string): format is ProgressSheetFormat =>
  format === 'progress-csv' || format === 'progress-xlsx';

const EXPORT_CAPABILITIES: Readonly<Record<Exclude<ExportFormat, 'ifc' | ProgressSheetFormat>, ExportCapabilities>> = {
  csv: {
    baselineProjection: 'none',
    projectedAssignments: false,
    percentLag: true,
    elapsedLag: true,
    constraints: 'none',
    schedulingOptions: 'none',
    notes: false,
    hammocks: false,
    reopenProfile: 'ops',
  },
  mspdi: {
    baselineProjection: 'active-task-values',
    projectedAssignments: true,
    percentLag: true,
    elapsedLag: true,
    constraints: 'primary',
    schedulingOptions: 'critical-slack-limit',
    notes: false,
    hammocks: false,
    reopenProfile: 'ops',
  },
  p6: {
    baselineProjection: 'none',
    projectedAssignments: true,
    percentLag: false,
    elapsedLag: false,
    constraints: 'activities',
    schedulingOptions: 'none',
    notes: false,
    hammocks: false,
    reopenProfile: 'ops',
  },
  // De XER-writer (`xer/xerWriter.ts`) meldt zijn eigen verlies per soort; deze matrix telt alleen
  // voor de XER-broninformatie die geen writer terugschrijft (exacte bytes, onbekende tabellen, …).
  xer: {
    baselineProjection: 'none',
    projectedAssignments: true,
    percentLag: false,
    elapsedLag: false,
    constraints: 'activities',
    schedulingOptions: 'none',
    notes: true,
    hammocks: true,
    reopenProfile: 'p6',
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
    // (p6xmlWriter.ts's `curveObjIdFor`) genereert bij export
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

function isMspdiCriticalSlackLimit(options: ProjectSchedulingOptions): boolean {
  // Dezelfde beslissing als de MSPDI-writer: wat hij niet als CriticalSlackLimit schrijft, is verlies.
  if (mspdiCriticalSlackLimit(options.criticalDefinition) === undefined) return false;
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
  // Rekenprofielen: een profiel dat niet overleeft wat de lezer van het doelformaat
  // voorstelt, is verlies — niet "er is iets gedefinieerd".
  const kept = resolveConventions(input.project.schedulingProfile);
  const reopened = builtInConventions(capabilities.reopenProfile);
  if (CONVENTION_KEYS.some(key => kept[key] !== reopened[key])) return true;
  const options = input.project.schedulingOptions;
  if (!options || Object.values(options).every(value => value === undefined)) return false;
  return capabilities.schedulingOptions === 'none' || !isMspdiCriticalSlackLimit(options);
}

function hasConstraintLoss(
  capabilities: ExportCapabilities,
  task: XerExportLossInput['tasks'][number],
): boolean {
  const primary = task.constraint !== undefined && task.constraint.type !== 'ASAP';
  switch (capabilities.constraints) {
    case 'none': return primary || task.constraint2 !== undefined;
    case 'primary': return task.constraint2 !== undefined;
    case 'activities': return isSummaryTask(task) && (primary || task.constraint2 !== undefined);
  }
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
  if (!capabilities.notes && input.tasks.some(task => (task.notes?.length ?? 0) > 0)) categories.push('notes');
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
  if (input.tasks.some(task => hasConstraintLoss(capabilities, task))) categories.push('constraints');
  // Handmatige planning schrijft geen writer: die taak gaat als gewone taak met berekende datums. Een
  // hammock alleen CSV, MSPDI en P6 XML niet; de XER-writer schrijft hem als `TT_LOE`.
  if (input.tasks.some(task => task.manuallyScheduled)) categories.push('manual-scheduling');
  if (!capabilities.hammocks && input.tasks.some(task => task.isHammock)) categories.push('hammock-tasks');
  return categories;
}

/**
 * Dienstcontract voor verliesdetectie. Dit levert uitsluitend getypeerde feiten in de
 * exportAs-return-envelope; vertaling, dedupe, toast en Lees-meer-link liggen bij de aanroeper.
 */
export function detectXerExportLoss(
  format: ExportFormat,
  input: XerExportLossInput,
): readonly XerExportLossWarning[] {
  if (format === 'ifc' || isProgressSheetFormat(format)) return [];
  // Geen vroege uitweg voor een document zonder XER-herkomst: verlies hangt af van de data, niet van
  // de herkomst (#554). Zonder archief en metadata blijven de XER-categorieën vanzelf leeg.
  const categories = categoriesFor(format, input);
  if (categories.length === 0) return [];
  return [{
    code: input.sourceArchive || input.importMetadata
      ? 'XER_ONLY_DATA_NOT_EXPRESSIBLE'
      : 'EXPORT_DATA_NOT_EXPRESSIBLE',
    format,
    availability: 'supported-lossy',
    categories,
  }];
}
