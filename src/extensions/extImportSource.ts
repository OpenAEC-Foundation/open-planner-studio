/**
 * Publieke read-only XER-bronroute. Deze module vertaalt de immutable interne bronretentie naar
 * kleine, losse ext-facing DTO's. De summary kloont geen grote catalogi; pagina's klonen alleen hun
 * eigen records en chunks decoderen steeds naar een nieuwe Uint8Array.
 */
import {
  EXT_IMPORT_SOURCE_PAGE_SIZE_MAX,
  type ExtImportSourceCatalogPage,
  type ExtImportSourceCatalogCounts,
  type ExtImportSourceCollection,
  type ExtImportSourceDiagnosticsSummary,
  type ExtImportSourceInfo,
  type ExtImportSourceNumberFormat,
  type ExtImportSourcePageOptions,
  type ExtImportSourceRecord,
  type ExtImportSourceReport,
  type ExtImportSourceScheduleOptionsSummary,
} from './extTypes';
import type { XerImportMetadata, XerImportReport } from '@/services/importTypes';
import type {
  XerArchiveDocumentViewV1,
  XerSourceArchive,
} from '@/services/xerSourceArchive';
import { XER_SOURCE_ARCHIVE_CHUNK_BYTES } from '@/services/xerSourceArchive';

const DEFAULT_PAGE_SIZE = 100;

function copyRecord(value: object): ExtImportSourceRecord {
  return structuredClone(value) as ExtImportSourceRecord;
}

function copyReport(report: XerImportReport): ExtImportSourceReport {
  return {
    projectsSeen: report.projectsSeen,
    documentsOpened: report.documentsOpened,
    emptyProjectsSkipped: report.emptyProjectsSkipped,
    baselineProjectsExcluded: report.baselineProjectsExcluded,
    baselinesMaterialized: report.baselinesMaterialized,
    danglingBaselineReferences: report.danglingBaselineReferences,
    externalLinksPreserved: report.externalLinksPreserved,
    baselineExclusionReverted: report.baselineExclusionReverted,
    baselineFallbackReasons: [...report.baselineFallbackReasons],
  };
}

function validatePageOptions(options?: ExtImportSourcePageOptions): { offset: number; limit: number } {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new RangeError('Broncatalogus-offset moet een niet-negatief safe integer zijn.');
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > EXT_IMPORT_SOURCE_PAGE_SIZE_MAX) {
    throw new RangeError(`Broncatalogus-limit moet 1..${EXT_IMPORT_SOURCE_PAGE_SIZE_MAX} zijn.`);
  }
  return { offset, limit };
}

/**
 * Canoniseer `offset` tegen de werkelijke collectiegrootte, VÓÓR de slice (reviewbevinding P2).
 *
 * `validatePageOptions` bewijst alleen dat `offset` zelf een safe integer is — niet dat
 * `offset + limit` dat ook blijft: met `offset` tot aan `Number.MAX_SAFE_INTEGER` en `limit` tot
 * `EXT_IMPORT_SOURCE_PAGE_SIZE_MAX` (500) kon die som het safe integer-bereik verlaten, en
 * `records.slice(offset, offset + limit)` liet zo'n offset gewoon door in plaats van fail-closed
 * te weigeren. Elke echte collectie telt hooguit een paar duizend records, dus de juiste grens is
 * niet "offset ligt onder MAX_SAFE_INTEGER - limit" maar "offset ligt hoogstens op het einde van de
 * collectie": begrens `offset` op `total` — een lege, geldige laatste pagina in plaats van een fout —
 * en de daaropvolgende `offset + limit` blijft daarmee altijd ruim binnen het safe integer-bereik,
 * want `total` is per definitie het aantal records dat al in het geheugen staat.
 */
function resolvePageOffset(offset: number, total: number): number {
  return offset > total ? total : offset;
}

function documentViewFor(
  archive: XerSourceArchive,
  metadata: XerImportMetadata | null | undefined,
  sourceProjectId: string,
): XerArchiveDocumentViewV1 | undefined {
  return archive.diagnostics.documentViews[sourceProjectId]
    ?? (metadata?.sourceProjectId === sourceProjectId ? {
      sourceProjectId,
      defaultCurrencyCode: metadata.defaultCurrencyCode,
      tableReport: metadata.tableReport,
      calendarIssues: metadata.calendarIssues,
      enumFallbacks: metadata.enumFallbacks,
      scheduleOptions: {
        source: metadata.scheduleOptions.source,
        retainedSource: metadata.scheduleOptions.retainedSource,
        fallbacks: metadata.scheduleOptions.fallbacks,
        diagnostics: metadata.scheduleOptions.diagnostics,
        sourceRowIndexes: metadata.scheduleOptions.sourceRowIndexes,
      },
      externalRelations: metadata.externalRelations,
      externalLinks: metadata.externalLinks,
      report: metadata.report,
      ...(metadata.resources ? {
        resources: { assignments: metadata.resources.assignments, issues: metadata.resources.issues },
      } : {}),
    } : undefined);
}

function selectedScheduleRows(
  archive: XerSourceArchive,
  view: XerArchiveDocumentViewV1 | undefined,
): readonly object[] {
  const indexes = view?.scheduleOptions.sourceRowIndexes ?? [];
  return indexes.flatMap((index) => {
    const row = archive.readModel.scheduleOptionsSourceArchive.rows[index];
    return row ? [row] : [];
  });
}

function sourceDataCounts(sourceData: Record<string, readonly unknown[]>): Record<string, number> {
  return Object.fromEntries(Object.entries(sourceData).map(([key, values]) => [key, values.length]));
}

function catalogCounts(
  archive: XerSourceArchive,
  sourceProjectId: string,
): ExtImportSourceCatalogCounts {
  const schedule = archive.readModel.scheduleOptionsSourceArchive;
  const resources = archive.readModel.resourceCatalog;
  const metadata = archive.readModel.metadataCatalog;
  const taskRows = archive.readModel.taskSourceRowsByProject;
  const currentProjectTaskProjections = metadata.taskProjectionsByProject[sourceProjectId]?.length ?? 0;
  const totalTaskRows = Object.values(taskRows).reduce((total, rows) => total + rows.length, 0);
  return {
    scheduleOptions: {
      sourceRows: schedule.rows.length,
      unmatchedRows: schedule.unmatchedScheduleOptionsRowIndexes.length,
      diagnostics: schedule.diagnostics.length,
    },
    resources: {
      resources: resources.resources.length,
      identities: resources.identities.length,
      rows: {
        resources: resources.rows.resources.length,
        roles: resources.rows.roles.length,
        rates: resources.rows.rates.length,
        curves: resources.rows.curves.length,
        assignments: resources.rows.assignments.length,
      },
      issues: resources.issues.length,
    },
    metadata: {
      activityCodeTypes: metadata.activityCodeTypes.length,
      customFieldDefs: metadata.customFieldDefs.length,
      taskProjections: metadata.taskProjections.length,
      currentProjectTaskProjections,
      issues: metadata.issues.length,
      issueCounts: { ...metadata.issueCounts },
      sourceData: sourceDataCounts(metadata.sourceData),
    },
    taskSourceRows: {
      projectCount: Object.keys(taskRows).length,
      totalRows: totalTaskRows,
      currentProjectRows: taskRows[sourceProjectId]?.length ?? 0,
    },
  };
}

function diagnosticsSummary(
  archive: XerSourceArchive,
  view: XerArchiveDocumentViewV1 | undefined,
): ExtImportSourceDiagnosticsSummary {
  const file = archive.diagnostics.file;
  return {
    file: {
      tableReport: {
        encoding: file.tableReport.encoding,
        endMarkerSeen: file.tableReport.endMarkerSeen,
        issueCount: file.tableReport.issues.length,
        unknownTableCount: file.tableReport.unknownTables.length,
        unknownFieldCount: file.tableReport.unknownFields?.length ?? 0,
      },
      scheduleOptionsDiagnosticCount: file.scheduleOptions.length,
      relationResolutionIssueCount: file.relationResolutionIssues.length,
      resourceCatalogIssueCount: file.resourceCatalogIssues.length,
      metadataCatalogIssueCount: file.metadataCatalogIssues.length,
    },
    document: {
      calendarIssueCount: view?.calendarIssues.length ?? 0,
      enumFallbackCount: view?.enumFallbacks.length ?? 0,
      scheduleOptionsFallbackCount: view?.scheduleOptions.fallbacks.length ?? 0,
      scheduleOptionsDiagnosticCount: view?.scheduleOptions.diagnostics.length ?? 0,
      externalRelationCount: view?.externalRelations.length ?? 0,
      externalLinkCount: view?.externalLinks.length ?? 0,
      resourceAssignmentCount: view?.resources?.assignments.length ?? 0,
      resourceIssueCount: view?.resources?.issues.length ?? 0,
    },
  };
}

function scheduleOptionsSummary(
  archive: XerSourceArchive,
  view: XerArchiveDocumentViewV1 | undefined,
): ExtImportSourceScheduleOptionsSummary {
  const schedule = archive.readModel.scheduleOptionsSourceArchive;
  return {
    source: view?.scheduleOptions.source ?? 'xer-defaults',
    retainedSource: { ...(view?.scheduleOptions.retainedSource ?? {}) },
    fallbackCount: view?.scheduleOptions.fallbacks.length ?? 0,
    diagnosticCount: view?.scheduleOptions.diagnostics.length ?? 0,
    sourceRowCount: view?.scheduleOptions.sourceRowIndexes.length ?? 0,
    unmatchedSourceRowCount: schedule.unmatchedScheduleOptionsRowIndexes.length,
  };
}

export function toExtImportSourceInfo(
  archive: XerSourceArchive,
  metadata: XerImportMetadata | null | undefined,
  sourceProjectId: string | null | undefined,
): ExtImportSourceInfo | null {
  const selector = sourceProjectId ?? metadata?.sourceProjectId;
  if (!selector) return null;
  const view = documentViewFor(archive, metadata, selector);
  const report = view?.report ?? archive.diagnostics.file.importReport;
  const numberFormat: ExtImportSourceNumberFormat = { ...archive.readModel.numberFormat };
  return {
    sourceFormat: archive.format,
    sourceProjectId: selector,
    selector: { kind: 'sourceProjectId', value: selector },
    archive: {
      schemaVersion: archive.schemaVersion,
      byteLength: archive.byteLength,
      sha256: archive.sha256,
      encoding: archive.encoding,
      bom: archive.bom,
      newline: archive.newline,
      chunkSize: XER_SOURCE_ARCHIVE_CHUNK_BYTES,
      chunkCount: archive.byteChunks.length,
    },
    numberFormat,
    diagnostics: diagnosticsSummary(archive, view),
    importReport: copyReport(report),
    scheduleOptions: scheduleOptionsSummary(archive, view),
    catalogs: catalogCounts(archive, selector),
  };
}

export function getExtImportSourceChunk(archive: XerSourceArchive, index: number): Uint8Array {
  if (!Number.isSafeInteger(index) || index < 0 || index >= archive.byteChunks.length) {
    throw new RangeError(`XER-bronchunk-index valt buiten 0..${Math.max(archive.byteChunks.length - 1, 0)}.`);
  }
  const encoded = archive.byteChunks[index];
  const binary = atob(encoded);
  const result = new Uint8Array(binary.length);
  for (let offset = 0; offset < binary.length; offset += 1) result[offset] = binary.charCodeAt(offset);
  return result;
}

function collectionRecords(
  archive: XerSourceArchive,
  sourceProjectId: string,
  view: XerArchiveDocumentViewV1 | undefined,
  collection: ExtImportSourceCollection,
): readonly object[] {
  const readModel = archive.readModel;
  const resourceRows = readModel.resourceCatalog.rows;
  const metadataSource = readModel.metadataCatalog.sourceData;
  const scheduleRows = selectedScheduleRows(archive, view);
  switch (collection) {
    case 'scheduleOptionsSourceRows': return scheduleRows;
    case 'resourceCatalogResources': return readModel.resourceCatalog.resources;
    case 'resourceCatalogIdentities': return readModel.resourceCatalog.identities;
    case 'resourceCatalogResourceRows': return resourceRows.resources;
    case 'resourceCatalogRoleRows': return resourceRows.roles;
    case 'resourceCatalogRateRows': return resourceRows.rates;
    case 'resourceCatalogCurveRows': return resourceRows.curves;
    case 'resourceCatalogAssignmentRows': return resourceRows.assignments;
    case 'resourceCatalogIssues': return readModel.resourceCatalog.issues;
    case 'metadataActivityCodeTypes': return readModel.metadataCatalog.activityCodeTypes;
    case 'metadataCustomFieldDefs': return readModel.metadataCatalog.customFieldDefs;
    case 'metadataTaskProjections': return readModel.metadataCatalog.taskProjections;
    case 'metadataIssues': return readModel.metadataCatalog.issues;
    case 'metadataSourceActvtypeRows': return metadataSource.ACTVTYPE;
    case 'metadataSourceActvcodeRows': return metadataSource.ACTVCODE;
    case 'metadataSourceTaskactvRows': return metadataSource.TASKACTV;
    case 'metadataSourceUdfTypeRows': return metadataSource.UDFTYPE;
    case 'metadataSourceUdfValueRows': return metadataSource.UDFVALUE;
    case 'metadataSourceMemotypeRows': return metadataSource.MEMOTYPE;
    case 'metadataSourceTasknoteRows': return metadataSource.TASKNOTE;
    case 'metadataSourceTaskmemoRows': return metadataSource.TASKMEMO;
    case 'metadataSourceTaskNotesRows': return metadataSource.TASK_NOTES;
    case 'metadataSourceDeferredUdfValueRows': return metadataSource.deferredUdfValues;
    case 'metadataSourceUnknownUdfTypeRows': return metadataSource.unknownUdfTypes;
    case 'taskSourceRows': return archive.readModel.taskSourceRowsByProject[sourceProjectId] ?? [];
    default: throw new RangeError(`Onbekende XER-broncatalogus: ${String(collection)}`);
  }
}

export function getExtImportSourceCatalogPage(
  archive: XerSourceArchive,
  metadata: XerImportMetadata | null | undefined,
  sourceProjectId: string | null | undefined,
  collection: ExtImportSourceCollection,
  options?: ExtImportSourcePageOptions,
): ExtImportSourceCatalogPage | null {
  const selector = sourceProjectId ?? metadata?.sourceProjectId;
  if (!selector) return null;
  const { offset: rawOffset, limit } = validatePageOptions(options);
  const view = documentViewFor(archive, metadata, selector);
  const records = collectionRecords(archive, selector, view, collection);
  const total = records.length;
  const offset = resolvePageOffset(rawOffset, total);
  return {
    collection,
    sourceProjectId: selector,
    offset,
    limit,
    total,
    items: records.slice(offset, offset + limit).map(copyRecord),
  };
}
