// MCP-bridge — begrensde, alleen-lezen inspectie van retained XER/P6-bronsemantiek.
//
// Deze tool leest uitsluitend het reeds opgeslagen `xerSourceArchive` en de actieve
// `xerImportMetadata`-view. Hij parset geen bytes opnieuw en raakt de store nooit. Summary is
// bewust vrij van raw rows en raw bytes; bronrijen en bytes zijn aparte, expliciet gepagineerde
// secties.

import type { AppState } from '@/state/appStore';
import type { McpContext, McpErrorCode, McpToolDef, McpToolResult } from '../contracts';
import { runReadTool, toolError } from './runtime';
import {
  XER_SOURCE_ARCHIVE_CHUNK_BYTES,
  type XerSourceArchive,
} from '@/services/xerSourceArchive';

const SECTIONS = ['summary', 'resourceCatalog', 'metadataCatalog', 'taskSourceRowsByProject', 'diagnostics', 'rawSource'] as const;
type Section = typeof SECTIONS[number];

const RESOURCE_COLLECTIONS = [
  'resources', 'identities', 'resourceSources', 'roleSources', 'rates', 'curves', 'assignmentSources', 'issues',
] as const;
const METADATA_COLLECTIONS = [
  'activityCodeTypes', 'customFieldDefs', 'taskProjections', 'issues',
  'ACTVTYPE', 'ACTVCODE', 'TASKACTV', 'UDFTYPE', 'UDFVALUE', 'MEMOTYPE', 'TASKNOTE', 'TASKMEMO',
  'TASK_NOTES', 'deferredUdfValues', 'unknownUdfTypes',
] as const;
const DIAGNOSTIC_COLLECTIONS = [
  'tableIssues', 'unknownTables', 'unknownFields', 'scheduleOptions', 'relationResolutionIssues',
  'resourceCatalogIssues', 'metadataCatalogIssues', 'documentViews', 'importReport',
] as const;
const ALL_COLLECTIONS = [...RESOURCE_COLLECTIONS, ...METADATA_COLLECTIONS, ...DIAGNOSTIC_COLLECTIONS] as const;

type Collection = typeof ALL_COLLECTIONS[number];

interface XerProvenanceArgs {
  section?: unknown;
  collection?: unknown;
  projectId?: unknown;
  limit?: unknown;
  offset?: unknown;
  includeRawSource?: unknown;
}

class XerProvenanceError extends Error {
  constructor(public readonly code: McpErrorCode, message: string) {
    super(message);
  }
}

function readTool(ctx: McpContext, fn: (state: AppState) => unknown): McpToolResult {
  const captured: { error: XerProvenanceError | null } = { error: null };
  const result = runReadTool(ctx, (state) => {
    try {
      return fn(state);
    } catch (error) {
      if (error instanceof XerProvenanceError) {
        captured.error = error;
        return undefined;
      }
      throw error;
    }
  });
  return captured.error
    ? toolError(ctx, captured.error.code, captured.error.message)
    : result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireOnlyKeys(args: unknown): XerProvenanceArgs {
  if (args === undefined || args === null) return {};
  if (!isObject(args)) throw new XerProvenanceError('VALIDATION', 'inspect_xer_provenance verwacht een object met argumenten.');
  const allowed = ['section', 'collection', 'projectId', 'limit', 'offset', 'includeRawSource'];
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) {
      throw new XerProvenanceError('VALIDATION', `onbekend argument \`${key}\` voor inspect_xer_provenance; toegestaan: ${allowed.join(', ')}.`);
    }
  }
  return args;
}

function requirePage(args: XerProvenanceArgs, rawSource: boolean): { limit: number; offset: number } {
  const limit = args.limit === undefined ? 50 : args.limit;
  const offset = args.offset === undefined ? 0 : args.offset;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new XerProvenanceError('VALIDATION', '`limit` moet een geheel getal van 1 t/m 1000 zijn.');
  }
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
    throw new XerProvenanceError('VALIDATION', '`offset` moet een geheel getal ≥ 0 zijn.');
  }
  // Een expliciete raw-source-call mag nooit ongemerkt een onbeperkte base64-respons worden.
  // Boven deze grens moet de client nog een pagina opvragen.
  if (rawSource && limit > 8) {
    throw new XerProvenanceError('VALIDATION', '`rawSource` accepteert maximaal 8 chunks per antwoord; gebruik offset voor volgende pagina\'s.');
  }
  return { limit, offset };
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new XerProvenanceError('VALIDATION', `\`${name}\` moet een niet-lege string zijn.`);
  }
  return value;
}

function page<T>(items: readonly T[], args: XerProvenanceArgs, rawSource = false): {
  items: T[];
  total: number;
  has_more: boolean;
  next_offset: number | null;
} {
  const { limit, offset } = requirePage(args, rawSource);
  const selected = items.slice(offset, offset + limit);
  const next = offset + selected.length;
  return {
    // Do not publish aliases into the frozen archive. This is especially important for raw rows:
    // an MCP caller can hold the structured result before transport serialization.
    items: structuredClone(selected),
    total: items.length,
    has_more: next < items.length,
    next_offset: next < items.length ? next : null,
  };
}

function collectionOf<T>(section: Section, collection: unknown, allowed: readonly string[], value: T): T {
  if (typeof collection !== 'string' || !allowed.includes(collection)) {
    throw new XerProvenanceError(
      'VALIDATION',
      `${section} vereist \`collection\` uit: ${allowed.join(', ')}.`,
    );
  }
  return value;
}

function projectIds(archive: XerSourceArchive): string[] {
  return Object.keys(archive.diagnostics.documentViews).sort();
}

function requireArchive(state: AppState): XerSourceArchive {
  if (!state.xerSourceArchive) {
    throw new XerProvenanceError('NOT_FOUND', 'Het actieve document bevat geen retained XER-bron.');
  }
  return state.xerSourceArchive;
}

function validateProjectSelector(archive: XerSourceArchive, projectId: unknown): string | undefined {
  if (projectId === undefined) return undefined;
  const selected = requireString(projectId, 'projectId');
  if (!projectIds(archive).includes(selected)) {
    throw new XerProvenanceError('NOT_FOUND', `Onbekende XER-projectselector: ${selected}.`);
  }
  return selected;
}

function summary(state: AppState, archive: XerSourceArchive | null): unknown {
  if (!archive) {
    return {
      sourcePresent: false,
      source: null,
      selector: { currentProjectId: state.xerSourceProjectId, availableProjectIds: [] },
      note: 'Er is voor dit document geen retained XER-bronarchief beschikbaar.',
    };
  }
  const readModel = archive.readModel;
  const file = archive.diagnostics.file;
  const table = file.tableReport;
  const metadata = readModel.metadataCatalog;
  const resources = readModel.resourceCatalog;
  const schedule = state.xerImportMetadata?.scheduleOptions;
  const ids = projectIds(archive);
  return {
    sourcePresent: true,
    source: {
      format: archive.format,
      schemaVersion: archive.schemaVersion,
      byteLength: archive.byteLength,
      sha256: archive.sha256,
      digest: { algorithm: 'SHA-256', value: archive.sha256 },
      encoding: archive.encoding,
      bom: archive.bom,
      newline: archive.newline,
      byteChunkCount: archive.byteChunks.length,
    },
    selector: {
      currentProjectId: state.xerSourceProjectId ?? state.xerImportMetadata?.sourceProjectId ?? null,
      availableProjectIds: ids,
    },
    numberFormat: readModel.numberFormat,
    schedoptions: {
      source: schedule?.source ?? 'xer-defaults',
      retainedSource: schedule?.retainedSource ?? {},
      mappedProgressMode: state.project.progressMode,
      mappedSchedulingOptions: state.project.schedulingOptions ?? null,
      sourceRowCount: schedule?.sourceRows.length ?? 0,
      fallbackCount: schedule?.fallbacks.length ?? 0,
      diagnosticCount: schedule?.diagnostics.length ?? 0,
    },
    importReport: file.importReport,
    diagnostics: {
      tableIssueCount: table.issues.length,
      unknownTableCount: table.unknownTables.length,
      unknownFieldCount: table.unknownFields?.length ?? 0,
      scheduleOptionsCount: file.scheduleOptions.length,
      relationResolutionIssueCount: file.relationResolutionIssues.length,
      resourceCatalogIssueCount: file.resourceCatalogIssues.length,
      metadataCatalogIssueCount: file.metadataCatalogIssues.length,
    },
    catalogCounts: {
      resourceCatalog: {
        resources: resources.resources.length,
        identities: resources.identities.length,
        resourceSources: resources.rows.resources.length,
        roleSources: resources.rows.roles.length,
        rates: resources.rows.rates.length,
        curves: resources.rows.curves.length,
        assignmentSources: resources.rows.assignments.length,
        issues: resources.issues.length,
      },
      metadataCatalog: {
        activityCodeTypes: metadata.activityCodeTypes.length,
        customFieldDefs: metadata.customFieldDefs.length,
        taskProjections: metadata.taskProjections.length,
        issues: metadata.issues.length,
        sourceData: Object.fromEntries(Object.entries(metadata.sourceData).map(([name, rows]) => [name, rows.length])),
      },
      taskSourceRowsByProject: Object.fromEntries(
        Object.entries(readModel.taskSourceRowsByProject).map(([projectId, rows]) => [projectId, rows.length]),
      ),
    },
  };
}

function resourceCatalog(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  const catalog = archive.readModel.resourceCatalog;
  const collection = collectionOf('resourceCatalog', args.collection, RESOURCE_COLLECTIONS, args.collection as Collection);
  const values: Record<Collection, readonly unknown[]> = {
    resources: catalog.resources,
    identities: catalog.identities,
    resourceSources: catalog.rows.resources,
    roleSources: catalog.rows.roles,
    rates: catalog.rows.rates,
    curves: catalog.rows.curves,
    assignmentSources: catalog.rows.assignments,
    issues: catalog.issues,
  } as Record<Collection, readonly unknown[]>;
  return { section: 'resourceCatalog', collection, ...page(values[collection], args) };
}

function metadataCatalog(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  const catalog = archive.readModel.metadataCatalog;
  const collection = collectionOf('metadataCatalog', args.collection, METADATA_COLLECTIONS, args.collection as Collection);
  const values: Record<string, readonly unknown[]> = {
    activityCodeTypes: catalog.activityCodeTypes,
    customFieldDefs: catalog.customFieldDefs,
    taskProjections: catalog.taskProjections,
    issues: catalog.issues,
    ...catalog.sourceData,
  };
  return { section: 'metadataCatalog', collection, ...page(values[collection] ?? [], args) };
}

function diagnostics(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  const file = archive.diagnostics.file;
  const collection = collectionOf('diagnostics', args.collection, DIAGNOSTIC_COLLECTIONS, args.collection as Collection);
  if (collection === 'importReport') {
    if (args.limit !== undefined || args.offset !== undefined) {
      throw new XerProvenanceError('VALIDATION', '`limit` en `offset` horen niet bij diagnostics/importReport.');
    }
    return { section: 'diagnostics', collection, report: structuredClone(file.importReport) };
  }
  const values: Record<string, readonly unknown[]> = {
    tableIssues: file.tableReport.issues,
    unknownTables: file.tableReport.unknownTables,
    unknownFields: file.tableReport.unknownFields ?? [],
    scheduleOptions: file.scheduleOptions,
    relationResolutionIssues: file.relationResolutionIssues,
    resourceCatalogIssues: file.resourceCatalogIssues,
    metadataCatalogIssues: file.metadataCatalogIssues,
    documentViews: Object.entries(archive.diagnostics.documentViews).sort(([left], [right]) => left.localeCompare(right)).map(([projectId, view]) => ({ projectId, view })),
  };
  const result = page(values[collection], args);
  return {
    section: 'diagnostics',
    collection,
    ...(collection === 'tableIssues' ? { encoding: file.tableReport.encoding, endMarkerSeen: file.tableReport.endMarkerSeen } : {}),
    ...result,
  };
}

function taskSourceRows(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  const projectId = requireString(args.projectId, 'projectId');
  if (!Object.prototype.hasOwnProperty.call(archive.readModel.taskSourceRowsByProject, projectId)) {
    throw new XerProvenanceError('NOT_FOUND', `Onbekende XER-projectselector: ${projectId}.`);
  }
  return {
    section: 'taskSourceRowsByProject',
    projectId,
    // XerArchiveSourceRowV1 retains every cell; this page applies no field or string truncation.
    ...page(archive.readModel.taskSourceRowsByProject[projectId] ?? [], args),
  };
}

function rawSource(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  if (args.includeRawSource !== true) {
    throw new XerProvenanceError('VALIDATION', 'rawSource vereist `includeRawSource: true`; bronbytes kunnen namen en vrije notities bevatten.');
  }
  const paged = page(archive.byteChunks, args, true);
  return {
    section: 'rawSource',
    privacy: 'expliciet aangevraagd; base64-brondata kan vrije projectinformatie bevatten',
    byteLength: archive.byteLength,
    sha256: archive.sha256,
    encoding: 'base64',
    chunkSizeBytes: XER_SOURCE_ARCHIVE_CHUNK_BYTES,
    totalChunks: archive.byteChunks.length,
    chunks: paged.items.map((base64, index) => ({ index: (typeof args.offset === 'number' ? args.offset : 0) + index, base64 })),
    total: paged.total,
    has_more: paged.has_more,
    next_offset: paged.next_offset,
  };
}

function inspect(state: AppState, rawArgs: unknown): unknown {
  const args = requireOnlyKeys(rawArgs);
  if (args.section !== undefined && (typeof args.section !== 'string' || !(SECTIONS as readonly string[]).includes(args.section))) {
    throw new XerProvenanceError('VALIDATION', `\`section\` moet één van ${SECTIONS.join(', ')} zijn.`);
  }
  if (args.includeRawSource !== undefined && typeof args.includeRawSource !== 'boolean') {
    throw new XerProvenanceError('VALIDATION', '`includeRawSource` moet een boolean zijn.');
  }
  const section = (args.section ?? 'summary') as Section;
  const archive = state.xerSourceArchive;
  if (args.projectId !== undefined && (typeof args.projectId !== 'string' || args.projectId.trim() === '')) {
    throw new XerProvenanceError('VALIDATION', '`projectId` moet een niet-lege string zijn.');
  }
  if (section !== 'rawSource' && args.includeRawSource !== undefined) {
    throw new XerProvenanceError('VALIDATION', '`includeRawSource` hoort alleen bij section `rawSource`.');
  }
  if (section === 'summary') {
    if (args.collection !== undefined) throw new XerProvenanceError('VALIDATION', '`collection` hoort niet bij section `summary`.');
    if (args.limit !== undefined || args.offset !== undefined) throw new XerProvenanceError('VALIDATION', '`limit` en `offset` horen niet bij section `summary`.');
    if (args.projectId !== undefined && archive) validateProjectSelector(archive, args.projectId);
    return summary(state, archive);
  }
  if (args.projectId !== undefined && archive) validateProjectSelector(archive, args.projectId);
  const selected = requireArchive(state);
  if (section === 'rawSource') {
    if (args.collection !== undefined || args.projectId !== undefined) throw new XerProvenanceError('VALIDATION', '`rawSource` neemt alleen includeRawSource, limit en offset.');
    return rawSource(selected, args);
  }
  if (section === 'taskSourceRowsByProject') {
    if (args.collection !== undefined) throw new XerProvenanceError('VALIDATION', '`collection` hoort niet bij section `taskSourceRowsByProject`.');
    return taskSourceRows(selected, args);
  }
  if (section === 'resourceCatalog') return resourceCatalog(selected, args);
  if (section === 'metadataCatalog') return metadataCatalog(selected, args);
  if (section === 'diagnostics') return diagnostics(selected, args);
  throw new XerProvenanceError('VALIDATION', `Onbekende section: ${section}.`);
}

const inputSchema = {
  type: 'object',
  properties: {
    section: { type: 'string', enum: [...SECTIONS], description: 'Inspectieonderdeel; default summary.' },
    collection: { type: 'string', enum: [...ALL_COLLECTIONS], description: 'Gepagineerde collectie binnen resourceCatalog, metadataCatalog of diagnostics.' },
    projectId: { type: 'string', description: 'Verplichte expliciete XER-projectselector voor taskSourceRowsByProject.' },
    limit: { type: 'number', description: 'Aantal items/chunks; default 50, rawSource maximaal 8.' },
    offset: { type: 'number', description: 'Startindex; default 0.' },
    includeRawSource: { type: 'boolean', description: 'Verplicht true voor de expliciete rawSource-sectie.' },
  },
  additionalProperties: false,
} as const;

export const xerProvenanceTools: McpToolDef[] = [{
  name: 'planner_inspect_xer_provenance',
  description:
    'Bounded read-only inspectie van retained Primavera P6/XER-bronsemantiek. `section` is summary ' +
    '(veilig: bronaanwezigheid, byteLength, SHA-256, chunk count, selector, number format, SCHEDOPTIONS-, ' +
    'import- en diagnostiektellingen), resourceCatalog, metadataCatalog, taskSourceRowsByProject, ' +
    'diagnostics of rawSource. Cataloguscollecties zijn expliciet benoemd en gepagineerd met `limit`, ' +
    '`offset`, `total`, `has_more` en `next_offset`. taskSourceRowsByProject vereist een expliciete ' +
    '`projectId` en geeft alle cellen van die bronrijen terug zonder verborgen veld- of stringafkapping. ' +
    'rawSource vereist expliciet `includeRawSource:true`, geeft maximaal acht vaste base64-chunks per ' +
    'antwoord en meldt de privacygrens; summary lekt nooit raw bytes of vrije raw rows. De tool gebruikt ' +
    'alleen retained state, muteert de store niet, voert geen CPM uit en ondersteunt geen schrijfpad.',
  kind: 'read',
  batchable: true,
  inputSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (args, ctx) => readTool(ctx, (state) => inspect(state, args)),
}];
