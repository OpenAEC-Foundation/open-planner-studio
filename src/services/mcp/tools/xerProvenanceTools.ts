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
  includeRawRows?: unknown;
}

/** Sections waarvan een collectie/rij vrije brontekst (namen, notities, willekeurige XER-kolommen)
 *  kan dragen. Zonder `includeRawRows` geven deze een tel-projectie zonder celwaarden terug — de
 *  tweede expliciete opt-in naast `section`/`collection`, analoog aan `rawSource`/`includeRawSource`. */
const RAW_ROWS_SECTIONS: readonly Section[] = ['resourceCatalog', 'metadataCatalog', 'taskSourceRowsByProject'];

/** Binnen `resourceCatalog` de collecties die een `rawRow`-bronrij dragen; de rest (resources,
 *  identities, issues) is al een genormaliseerde, begrensde projectie. */
const RAW_ROW_RESOURCE_COLLECTIONS = new Set<Collection>(['resourceSources', 'roleSources', 'rates', 'curves', 'assignmentSources']);

/** Binnen `metadataCatalog` de collecties die letterlijk retained bronrijen zijn (`catalog.sourceData`);
 *  de rest (activityCodeTypes, customFieldDefs, taskProjections, issues) is al genormaliseerd. */
const RAW_ROW_METADATA_COLLECTIONS = new Set<Collection>([
  'ACTVTYPE', 'ACTVCODE', 'TASKACTV', 'UDFTYPE', 'UDFVALUE', 'MEMOTYPE', 'TASKNOTE', 'TASKMEMO',
  'TASK_NOTES', 'deferredUdfValues', 'unknownUdfTypes',
]);

/** Lagere paginalimiet zodra `includeRawRows` echte celwaarden ontgrendelt — spiegelt de aparte,
 *  strakkere grens die `rawSource` al had voor ruwe bytes. */
const RAW_ROWS_OPT_IN_MAX_LIMIT = 100;
/** Per-cel/per-string afkapgrens: een enkele vrije XER-kolom (notitie, naam) mag de respons niet
 *  onbegrensd laten groeien. */
const RAW_CELL_MAX_CHARS = 2000;
/** Harde bovengrens op de totale geserialiseerde paginarespons; een backstop naast de rij- en
 *  celgrenzen voor het geval veel kleinere cellen samen toch groot worden. */
const MAX_SECTION_RESPONSE_BYTES = 256 * 1024;

interface RawSourceRowLike {
  readonly line: number;
  readonly cells: Readonly<Record<string, string>>;
}

function truncateCell(value: string): string {
  if (value.length <= RAW_CELL_MAX_CHARS) return value;
  return `${value.slice(0, RAW_CELL_MAX_CHARS)}…(afgekapt op ${RAW_CELL_MAX_CHARS} tekens)`;
}

/** Zonder opt-in: alleen line + celaantal, geen enkele vrije waarde. Met opt-in: volledige cellen,
 *  elk individueel afgekapt. */
function projectSourceRow(row: RawSourceRowLike, includeRawRows: boolean): unknown {
  if (!includeRawRows) {
    return { line: row.line, fieldCount: Object.keys(row.cells).length };
  }
  const cells: Record<string, string> = {};
  for (const [field, value] of Object.entries(row.cells)) cells[field] = truncateCell(value);
  return { line: row.line, cells };
}

/** Zelfde projectie voor een item dat een `rawRow` draagt naast eigen (niet-vrije, id-achtige) velden. */
function projectRawRowBearingItem(item: Record<string, unknown>, includeRawRows: boolean): unknown {
  const { rawRow, ...rest } = item;
  return { ...rest, rawRow: projectSourceRow(rawRow as RawSourceRowLike, includeRawRows) };
}

/** Responsgrens-backstop: gooi een typed fout met een pagineerhint in plaats van een onbegrensde
 *  serialisatie toe te staan. */
function finalizeBounded<T extends Record<string, unknown>>(result: T): T {
  if (JSON.stringify(result).length > MAX_SECTION_RESPONSE_BYTES) {
    throw new XerProvenanceError(
      'VALIDATION',
      `Deze pagina overschrijdt de responsgrens van ${MAX_SECTION_RESPONSE_BYTES} bytes geserialiseerd — verlaag \`limit\` of gebruik \`offset\` om te pagineren.`,
    );
  }
  return result;
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
  const allowed = ['section', 'collection', 'projectId', 'limit', 'offset', 'includeRawSource', 'includeRawRows'];
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) {
      throw new XerProvenanceError('VALIDATION', `onbekend argument \`${key}\` voor inspect_xer_provenance; toegestaan: ${allowed.join(', ')}.`);
    }
  }
  return args;
}

interface PageOptions {
  /** Verlaagt de generieke bovengrens van 1000; gebruikt voor `rawSource` (8 chunks) en de
   *  `includeRawRows`-opt-in (100 rijen). */
  maxLimit?: number;
  /** Naam voor de foutmelding zodra `limit` de verlaagde grens overschrijdt. */
  label?: string;
  /** Eenheid in de foutmelding ("chunks" voor rawSource, "rijen" voor raw rows). */
  unit?: string;
}

function requirePage(args: XerProvenanceArgs, options: PageOptions = {}): { limit: number; offset: number } {
  const maxLimit = options.maxLimit ?? 1000;
  const limit = args.limit === undefined ? 50 : args.limit;
  const offset = args.offset === undefined ? 0 : args.offset;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    if (options.label) {
      // Een expliciete raw-data-call mag nooit ongemerkt een onbeperkte respons worden. Boven deze
      // grens moet de client nog een pagina opvragen.
      throw new XerProvenanceError(
        'VALIDATION',
        `\`${options.label}\` accepteert maximaal ${maxLimit} ${options.unit ?? 'items'} per antwoord; gebruik offset voor volgende pagina's.`,
      );
    }
    throw new XerProvenanceError('VALIDATION', `\`limit\` moet een geheel getal van 1 t/m ${maxLimit} zijn.`);
  }
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
    throw new XerProvenanceError('VALIDATION', '`offset` moet een geheel getal ≥ 0 zijn.');
  }
  return { limit, offset };
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new XerProvenanceError('VALIDATION', `\`${name}\` moet een niet-lege string zijn.`);
  }
  return value;
}

function page<T>(items: readonly T[], args: XerProvenanceArgs, options: PageOptions = {}): {
  items: T[];
  total: number;
  has_more: boolean;
  next_offset: number | null;
} {
  const { limit, offset } = requirePage(args, options);
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
  const includeRawRows = args.includeRawRows === true;
  const isRawRowCollection = RAW_ROW_RESOURCE_COLLECTIONS.has(collection);
  const items = isRawRowCollection
    ? (values[collection] as Record<string, unknown>[]).map((item) => projectRawRowBearingItem(item, includeRawRows))
    : values[collection];
  const pageOptions: PageOptions = isRawRowCollection && includeRawRows
    ? { maxLimit: RAW_ROWS_OPT_IN_MAX_LIMIT, label: 'includeRawRows', unit: 'rijen' }
    : {};
  return finalizeBounded({ section: 'resourceCatalog', collection, ...page(items, args, pageOptions) });
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
  const includeRawRows = args.includeRawRows === true;
  const isRawRowCollection = RAW_ROW_METADATA_COLLECTIONS.has(collection);
  const items = isRawRowCollection
    ? (values[collection] ?? []).map((row) => projectSourceRow(row as RawSourceRowLike, includeRawRows))
    : (values[collection] ?? []);
  const pageOptions: PageOptions = isRawRowCollection && includeRawRows
    ? { maxLimit: RAW_ROWS_OPT_IN_MAX_LIMIT, label: 'includeRawRows', unit: 'rijen' }
    : {};
  return finalizeBounded({ section: 'metadataCatalog', collection, ...page(items, args, pageOptions) });
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
  const includeRawRows = args.includeRawRows === true;
  const rows = archive.readModel.taskSourceRowsByProject[projectId] ?? [];
  // Zonder `includeRawRows` een tel-projectie zonder celwaarden; met de opt-in de volle rij, per cel
  // afgekapt en met een lagere paginalimiet (zie RAW_ROWS_OPT_IN_MAX_LIMIT/RAW_CELL_MAX_CHARS hierboven).
  const items = rows.map((row) => projectSourceRow(row, includeRawRows));
  const pageOptions: PageOptions = includeRawRows
    ? { maxLimit: RAW_ROWS_OPT_IN_MAX_LIMIT, label: 'includeRawRows', unit: 'rijen' }
    : {};
  return finalizeBounded({
    section: 'taskSourceRowsByProject',
    projectId,
    ...page(items, args, pageOptions),
  });
}

function rawSource(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  if (args.includeRawSource !== true) {
    throw new XerProvenanceError('VALIDATION', 'rawSource vereist `includeRawSource: true`; bronbytes kunnen namen en vrije notities bevatten.');
  }
  const paged = page(archive.byteChunks, args, { maxLimit: 8, label: 'rawSource', unit: 'chunks' });
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
  if (args.includeRawRows !== undefined && typeof args.includeRawRows !== 'boolean') {
    throw new XerProvenanceError('VALIDATION', '`includeRawRows` moet een boolean zijn.');
  }
  const section = (args.section ?? 'summary') as Section;
  const archive = state.xerSourceArchive;
  if (args.projectId !== undefined && (typeof args.projectId !== 'string' || args.projectId.trim() === '')) {
    throw new XerProvenanceError('VALIDATION', '`projectId` moet een niet-lege string zijn.');
  }
  if (section !== 'rawSource' && args.includeRawSource !== undefined) {
    throw new XerProvenanceError('VALIDATION', '`includeRawSource` hoort alleen bij section `rawSource`.');
  }
  if (args.includeRawRows !== undefined && !RAW_ROWS_SECTIONS.includes(section)) {
    throw new XerProvenanceError(
      'VALIDATION',
      '`includeRawRows` hoort alleen bij section `resourceCatalog`, `metadataCatalog` of `taskSourceRowsByProject`.',
    );
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
    limit: { type: 'number', description: 'Aantal items/chunks; default 50, rawSource maximaal 8, includeRawRows maximaal 100.' },
    offset: { type: 'number', description: 'Startindex; default 0.' },
    includeRawSource: { type: 'boolean', description: 'Verplicht true voor de expliciete rawSource-sectie.' },
    includeRawRows: {
      type: 'boolean',
      description:
        'Alleen bij resourceCatalog/metadataCatalog/taskSourceRowsByProject: ontgrendelt de vrije ' +
        'brontekst van een rij (naam, notitie, willekeurige XER-kolom) i.p.v. alleen line+fieldCount, ' +
        'met een lagere paginalimiet (100) en per-cel-afkapping op 2.000 tekens.',
    },
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
    '`projectId`; zonder `includeRawRows:true` levert elke rij alleen `line`+`fieldCount`, geen cellen. ' +
    'rawSource vereist expliciet `includeRawSource:true`, geeft maximaal acht vaste base64-chunks per ' +
    'antwoord en meldt de privacygrens; summary lekt nooit raw bytes of vrije raw rows. ' +
    'resourceCatalog/metadataCatalog/taskSourceRowsByProject geven zonder `includeRawRows:true` een ' +
    'beperkte projectie zonder ruwe cellen; met de opt-in gelden een lagere paginalimiet, ' +
    'per-celafkapping en een responsgrens. De tool gebruikt alleen retained state, muteert de store ' +
    'niet, voert geen CPM uit en ondersteunt geen schrijfpad. Niet batchable: roep hem los aan, nooit ' +
    'als stap in `planner_batch`.',
  kind: 'read',
  batchable: false,
  inputSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (args, ctx) => readTool(ctx, (state) => inspect(state, args)),
}];
