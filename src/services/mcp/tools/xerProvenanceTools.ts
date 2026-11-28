import type { AppState } from '@/state/appStore';
import type { McpContext, McpErrorCode, McpToolDef, McpToolResult } from '../contracts';
import { runReadTool, toolError } from './runtime';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
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
const COLLECTION_ENUM: Collection[] = [...new Set<Collection>(ALL_COLLECTIONS)];

interface XerProvenanceArgs {
  section?: unknown;
  collection?: unknown;
  projectId?: unknown;
  limit?: unknown;
  offset?: unknown;
  includeRawSource?: unknown;
  includeRawRows?: unknown;
  includeResourceNames?: unknown;
}

const RESOURCE_NAMES_SECTIONS: readonly Section[] = ['resourceCatalog', 'rawSource'];

const RAW_ROWS_SECTIONS: readonly Section[] = ['resourceCatalog', 'metadataCatalog', 'taskSourceRowsByProject', 'diagnostics'];

const RAW_ROWS_OPT_IN_MAX_LIMIT = 100;
const RAW_CELL_MAX_CHARS = 2000;
const LABEL_MAX_CHARS = 200;
const MAX_CELLS_PER_ROW = 200;
const MAX_SECTION_RESPONSE_BYTES = 256 * 1024;

const SAFE_LABEL_KEYS = new Set([
  'id', 'sourceId', 'internalId', 'taskId', 'predecessorTaskId', 'projectId', 'sourceProjectId',
  'currentProjectId', 'resourceId', 'roleId', 'curveId', 'parentId', 'parentSourceId', 'calendarId',
  'calendarSourceId', 'defaultRoleSourceId', 'unitSourceId', 'taskSourceId', 'companyId',
  'libraryItemId', 'syncedHash',
  'name', 'shortName', 'code', 'taskCode', 'wbsCode', 'unitOfMeasure', 'currencyCode',
  'defaultCurrencyCode',
  'kind', 'type', 'rawType', 'table', 'field', 'reason', 'fallback', 'bestFit', 'encoding',
  'newline', 'bom', 'format', 'source', 'algorithm', 'status', 'from', 'token', 'decimal', 'group',
  'progressMode', 'mappedProgressMode', 'effectiveDate',
  'sha256', 'value', 'availableProjectIds', 'baselineFallbackReasons',
]);
const FREE_TEXT_MAP_KEYS = new Set(['customFields']);

class XerProvenanceError extends Error {
  constructor(public readonly code: McpErrorCode, message: string) {
    super(message);
  }
}

function truncateAt(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  let end = maxChars;
  const codeUnit = value.charCodeAt(end - 1);
  if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) end -= 1;
  return `${value.slice(0, end)}…(truncated at ${maxChars} characters)`;
}

function truncateCell(value: string): string {
  return truncateAt(value, RAW_CELL_MAX_CHARS);
}

function truncateLabel(value: string): string {
  return truncateAt(value, LABEL_MAX_CHARS);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRawSourceRowLike(value: Record<string, unknown>): value is Record<string, unknown> & { line: number; cells: Record<string, string> } {
  if (typeof value.line !== 'number' || !isPlainRecord(value.cells)) return false;
  return Object.values(value.cells).every((cell) => typeof cell === 'string');
}

function uniqueTruncatedKey(candidate: string, used: Set<string>): string {
  let key = candidate;
  let suffix = 1;
  while (used.has(key)) {
    key = `${candidate}#${suffix}`;
    suffix += 1;
  }
  used.add(key);
  return key;
}

interface ByteBudget {
  charge(text: string): void;
}
function createByteBudget(maxBytes: number): ByteBudget {
  const encoder = new TextEncoder();
  let used = 0;
  return {
    charge(text: string): void {
      used += encoder.encode(text).byteLength;
      if (used > maxBytes) {
        throw new XerProvenanceError(
          'VALIDATION',
          `This page exceeds the response limit of ${MAX_SECTION_RESPONSE_BYTES} bytes — lower \`limit\` or use \`offset\` to paginate.`,
        );
      }
    },
  };
}

function projectSourceRow(
  row: Record<string, unknown> & { line: number; cells: Record<string, string> },
  includeRawRows: boolean,
  budget: ByteBudget,
): unknown {
  const { line, cells, ...rest } = row;
  const fieldNames = Object.keys(cells);

  const restProjected: Record<string, unknown> = {};
  for (const [restKey, restValue] of Object.entries(rest)) {
    const sanitized = sanitizeProvenanceValue(restValue, restKey, includeRawRows, budget);
    if (sanitized !== undefined) restProjected[restKey] = sanitized;
  }

  if (!includeRawRows) {
    return { line, fieldCount: fieldNames.length, ...restProjected };
  }

  const limited = fieldNames.slice(0, MAX_CELLS_PER_ROW);
  const projectedCells: Record<string, string> = {};
  const usedCellKeys = new Set<string>();
  for (const field of limited) {
    const truncatedField = uniqueTruncatedKey(truncateLabel(field), usedCellKeys);
    budget.charge(truncatedField);
    const truncatedValue = truncateCell(cells[field]);
    budget.charge(truncatedValue);
    projectedCells[truncatedField] = truncatedValue;
  }
  const projected: Record<string, unknown> = { line, cells: projectedCells, ...restProjected };
  if (fieldNames.length > MAX_CELLS_PER_ROW) {
    projected.fieldCount = fieldNames.length;
    projected.cellsTruncatedAt = MAX_CELLS_PER_ROW;
  }
  return projected;
}

function projectFreeTextMap(map: Record<string, unknown>, includeRawRows: boolean, budget: ByteBudget): unknown {
  const keys = Object.keys(map);
  if (!includeRawRows) return { fieldCount: keys.length };
  const limited = keys.slice(0, MAX_CELLS_PER_ROW);
  const out: Record<string, string> = {};
  const usedKeys = new Set<string>();
  for (const key of limited) {
    const truncatedKey = uniqueTruncatedKey(truncateLabel(key), usedKeys);
    budget.charge(truncatedKey);
    const raw = map[key];
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const truncatedValue = truncateCell(text);
    budget.charge(truncatedValue);
    out[truncatedKey] = truncatedValue;
  }
  const projected: Record<string, unknown> = { ...out };
  if (keys.length > MAX_CELLS_PER_ROW) projected.__truncated = { fieldCount: keys.length, cellsTruncatedAt: MAX_CELLS_PER_ROW };
  return projected;
}

const NAME_HIDDEN_KEY = 'nameHidden';

function resourceCodeOf(cells: Readonly<Record<string, string>> | undefined): string | undefined {
  const code = cells?.rsrc_short_name?.trim();
  return code ? code : undefined;
}

function resourceCodesByInternalId(archive: XerSourceArchive): Map<string, string> {
  const codes = new Map<string, string>();
  for (const source of archive.readModel.resourceCatalog.rows.resources) {
    const code = resourceCodeOf(source.rawRow?.cells);
    if (code !== undefined) codes.set(source.internalId, code);
  }
  return codes;
}

function projectResourceItem(item: unknown, codes: ReadonlyMap<string, string>, includeResourceNames: boolean): unknown {
  if (!isPlainRecord(item)) return item;
  const { name, ...rest } = item;
  const code = typeof rest.id === 'string' ? codes.get(rest.id) : undefined;
  return {
    ...rest,
    ...(code !== undefined ? { code } : {}),
    ...(includeResourceNames ? { name } : { [NAME_HIDDEN_KEY]: true }),
  };
}

function projectResourceSourceItem(
  item: unknown,
  includeRawRows: boolean,
  includeResourceNames: boolean,
  budget: ByteBudget,
): unknown {
  if (!isPlainRecord(item)) return sanitizeProvenanceValue(item, null, includeRawRows, budget);
  const { rawRow, ...rest } = item;
  const out = sanitizeProvenanceValue(rest, null, includeRawRows, budget) as Record<string, unknown>;
  const code = isPlainRecord(rawRow) && isPlainRecord(rawRow.cells)
    ? resourceCodeOf(rawRow.cells as Record<string, string>)
    : undefined;
  if (code !== undefined) {
    const truncated = truncateLabel(code);
    budget.charge(truncated);
    out.code = truncated;
  }
  if (rawRow !== undefined) {
    out.rawRow = sanitizeProvenanceValue(rawRow, 'rawRow', includeRawRows && includeResourceNames, budget);
  }
  return out;
}

function sanitizeProvenanceValue(value: unknown, key: string | null, includeRawRows: boolean, budget: ByteBudget): unknown {
  if (typeof value === 'string') {
    const isSafeLabel = key !== null && SAFE_LABEL_KEYS.has(key);
    if (!isSafeLabel) {
      if (!includeRawRows) return undefined;
      const truncated = truncateCell(value);
      budget.charge(truncated);
      return truncated;
    }
    const truncated = truncateLabel(value);
    budget.charge(truncated);
    return truncated;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeProvenanceValue(item, key, includeRawRows, budget))
      .filter((item) => item !== undefined);
  }
  if (isPlainRecord(value)) {
    if (isRawSourceRowLike(value)) {
      return projectSourceRow(value, includeRawRows, budget);
    }
    if (key !== null && FREE_TEXT_MAP_KEYS.has(key)) {
      return projectFreeTextMap(value, includeRawRows, budget);
    }
    const out: Record<string, unknown> = {};
    const usedKeys = new Set<string>();
    for (const [childKey, childValue] of Object.entries(value)) {
      const sanitized = sanitizeProvenanceValue(childValue, childKey, includeRawRows, budget);
      if (sanitized === undefined) continue;
      const truncatedKey = uniqueTruncatedKey(truncateLabel(childKey), usedKeys);
      budget.charge(truncatedKey);
      out[truncatedKey] = sanitized;
    }
    return out;
  }
  return value;
}

function finalizeBounded<T extends Record<string, unknown>>(result: T): T {
  const byteLength = new TextEncoder().encode(JSON.stringify(result)).length;
  if (byteLength > MAX_SECTION_RESPONSE_BYTES) {
    throw new XerProvenanceError(
      'VALIDATION',
      `This page exceeds the response limit of ${MAX_SECTION_RESPONSE_BYTES} bytes serialized — lower \`limit\` or use \`offset\` to paginate.`,
    );
  }
  return result;
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
  if (!isObject(args)) throw new XerProvenanceError('VALIDATION', 'inspect_xer_provenance expects an object with arguments.');
  const allowed = ['section', 'collection', 'projectId', 'limit', 'offset', 'includeRawSource', 'includeRawRows', 'includeResourceNames'];
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) {
      throw new XerProvenanceError('VALIDATION', `unknown argument \`${key}\` for inspect_xer_provenance; allowed: ${allowed.join(', ')}.`);
    }
  }
  return args;
}

interface PageOptions {
  maxLimit?: number;
  label?: string;
  unit?: string;
}

function requirePage(args: XerProvenanceArgs, options: PageOptions = {}): { limit: number; offset: number } {
  const maxLimit = options.maxLimit ?? 1000;
  const limit = args.limit === undefined ? 50 : args.limit;
  const offset = args.offset === undefined ? 0 : args.offset;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    if (options.label) {
      throw new XerProvenanceError(
        'VALIDATION',
        `\`${options.label}\` accepts at most ${maxLimit} ${options.unit ?? 'items'} per answer; use offset for the next pages.`,
      );
    }
    throw new XerProvenanceError('VALIDATION', `\`limit\` must be an integer from 1 to ${maxLimit}.`);
  }
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
    throw new XerProvenanceError('VALIDATION', '`offset` must be an integer ≥ 0.');
  }
  return { limit, offset };
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new XerProvenanceError('VALIDATION', `\`${name}\` must be a non-empty string.`);
  }
  return value;
}

interface Paginated<T> {
  readonly slice: readonly T[];
  readonly total: number;
  readonly offset: number;
}

function paginateRaw<T>(items: readonly T[], args: XerProvenanceArgs, options: PageOptions = {}): Paginated<T> {
  const { limit, offset } = requirePage(args, options);
  return { slice: items.slice(offset, offset + limit), total: items.length, offset };
}

function envelope(paged: Paginated<unknown>, items: unknown[]): {
  items: unknown[];
  total: number;
  has_more: boolean;
  next_offset: number | null;
} {
  const next = paged.offset + items.length;
  return {
    items,
    total: paged.total,
    has_more: next < paged.total,
    next_offset: next < paged.total ? next : null,
  };
}

function collectionOf<T>(section: Section, collection: unknown, allowed: readonly string[], value: T): T {
  if (typeof collection !== 'string' || !allowed.includes(collection)) {
    throw new XerProvenanceError(
      'VALIDATION',
      `${section} requires \`collection\` from: ${allowed.join(', ')}.`,
    );
  }
  return value;
}

function projectIds(archive: XerSourceArchive): string[] {
  const ids = new Set<string>([
    ...Object.keys(archive.diagnostics.documentViews),
    ...Object.keys(archive.readModel.taskSourceRowsByProject),
  ]);
  return Array.from(ids).sort();
}

function missingArchiveNote(state: AppState): string {
  const issue = state.xerArchiveIssue;
  return issue
    ? `No archive (unusable on opening: ${issue.code}). The IFC carried an XER source archive that did not ` +
      'validate and was therefore left out; the schedule comes entirely from the IFC. Import the original ' +
      '.xer again to get the source provenance back.'
    : 'No retained XER source archive is available for this document.';
}

function requireArchive(state: AppState): XerSourceArchive {
  if (!state.xerSourceArchive) {
    throw new XerProvenanceError(
      'NOT_FOUND',
      state.xerArchiveIssue
        ? missingArchiveNote(state)
        : 'The active document contains no retained XER source.',
    );
  }
  return state.xerSourceArchive;
}

function validateProjectSelector(archive: XerSourceArchive, projectId: unknown): string | undefined {
  if (projectId === undefined) return undefined;
  const selected = requireString(projectId, 'projectId');
  if (!projectIds(archive).includes(selected)) {
    throw new XerProvenanceError('NOT_FOUND', `Unknown XER project selector: ${selected}.`);
  }
  return selected;
}

function summary(state: AppState, archive: XerSourceArchive | null): unknown {
  if (!archive) {
    const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
    const sanitized = sanitizeProvenanceValue(
      { sourcePresent: false, source: null, selector: { currentProjectId: state.xerSourceProjectId, availableProjectIds: [] } },
      null,
      false,
      budget,
    ) as Record<string, unknown>;
    sanitized.note = missingArchiveNote(state);
    sanitized.archiveIssue = state.xerArchiveIssue ? { code: state.xerArchiveIssue.code } : null;
    return finalizeBounded(sanitized);
  }
  const readModel = archive.readModel;
  const file = archive.diagnostics.file;
  const table = file.tableReport;
  const metadata = readModel.metadataCatalog;
  const resources = readModel.resourceCatalog;
  const schedule = state.xerImportMetadata?.scheduleOptions;
  const ids = projectIds(archive);
  const raw = {
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
      schedulingProfileId: state.project.schedulingProfile?.id ?? 'ops',
      effectiveSchedulingOptions: effectiveSchedulingOptions(state.project),
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
  const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
  const sanitized = sanitizeProvenanceValue(raw, null, false, budget) as Record<string, unknown>;
  return finalizeBounded(sanitized);
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
  const includeResourceNames = args.includeResourceNames === true;
  const pageOptions: PageOptions = includeRawRows
    ? { maxLimit: RAW_ROWS_OPT_IN_MAX_LIMIT, label: 'includeRawRows', unit: 'rijen' }
    : {};
  const paged = paginateRaw(values[collection], args, pageOptions);
  const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
  let items: unknown[];
  if (collection === 'resources') {
    const codes = resourceCodesByInternalId(archive);
    items = paged.slice.map((item) => sanitizeProvenanceValue(
      projectResourceItem(item, codes, includeResourceNames), null, includeRawRows, budget,
    ));
  } else if (collection === 'resourceSources') {
    items = paged.slice.map((item) => projectResourceSourceItem(item, includeRawRows, includeResourceNames, budget));
  } else {
    items = paged.slice.map((item) => sanitizeProvenanceValue(item, null, includeRawRows, budget));
  }
  return finalizeBounded({ section: 'resourceCatalog', collection, ...envelope(paged, items) });
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
  const pageOptions: PageOptions = includeRawRows
    ? { maxLimit: RAW_ROWS_OPT_IN_MAX_LIMIT, label: 'includeRawRows', unit: 'rijen' }
    : {};
  const paged = paginateRaw(values[collection] ?? [], args, pageOptions);
  const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
  const items = paged.slice.map((item) => sanitizeProvenanceValue(item, null, includeRawRows, budget));
  return finalizeBounded({ section: 'metadataCatalog', collection, ...envelope(paged, items) });
}

function diagnostics(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  const file = archive.diagnostics.file;
  const collection = collectionOf('diagnostics', args.collection, DIAGNOSTIC_COLLECTIONS, args.collection as Collection);
  const includeRawRows = args.includeRawRows === true;
  if (collection === 'importReport') {
    if (args.limit !== undefined || args.offset !== undefined) {
      throw new XerProvenanceError('VALIDATION', '`limit` and `offset` do not belong to diagnostics/importReport.');
    }
    const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
    const report = sanitizeProvenanceValue(file.importReport, null, includeRawRows, budget);
    return finalizeBounded({ section: 'diagnostics', collection, report });
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
  const pageOptions: PageOptions = includeRawRows
    ? { maxLimit: RAW_ROWS_OPT_IN_MAX_LIMIT, label: 'includeRawRows', unit: 'rijen' }
    : {};
  const paged = paginateRaw(values[collection], args, pageOptions);
  const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
  const items = paged.slice.map((item) => sanitizeProvenanceValue(item, null, includeRawRows, budget));
  return finalizeBounded({
    section: 'diagnostics',
    collection,
    ...(collection === 'tableIssues' ? { encoding: file.tableReport.encoding, endMarkerSeen: file.tableReport.endMarkerSeen } : {}),
    ...envelope(paged, items),
  });
}

function taskSourceRows(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  const projectId = requireString(args.projectId, 'projectId');
  if (!Object.prototype.hasOwnProperty.call(archive.readModel.taskSourceRowsByProject, projectId)) {
    throw new XerProvenanceError('NOT_FOUND', `Unknown XER project selector: ${projectId}.`);
  }
  const includeRawRows = args.includeRawRows === true;
  const rows = archive.readModel.taskSourceRowsByProject[projectId] ?? [];
  const pageOptions: PageOptions = includeRawRows
    ? { maxLimit: RAW_ROWS_OPT_IN_MAX_LIMIT, label: 'includeRawRows', unit: 'rijen' }
    : {};
  const paged = paginateRaw(rows, args, pageOptions);
  const budget = createByteBudget(MAX_SECTION_RESPONSE_BYTES);
  const items = paged.slice.map((row) => sanitizeProvenanceValue(row, null, includeRawRows, budget));
  return finalizeBounded({ section: 'taskSourceRowsByProject', projectId, ...envelope(paged, items) });
}

function rawSource(archive: XerSourceArchive, args: XerProvenanceArgs): unknown {
  if (args.includeRawSource !== true) {
    throw new XerProvenanceError('VALIDATION', 'rawSource requires `includeRawSource: true`; source bytes can contain names and free notes.');
  }
  if (args.includeResourceNames !== true) {
    throw new XerProvenanceError(
      'VALIDATION',
      'rawSource also requires `includeResourceNames: true`: the source bytes contain resource names (often names of people). Ask the user for permission first.',
    );
  }
  const paged = paginateRaw(archive.byteChunks, args, { maxLimit: 8, label: 'rawSource', unit: 'chunks' });
  const next = paged.offset + paged.slice.length;
  return {
    section: 'rawSource',
    privacy: 'explicitly requested; base64 source data can contain free project information',
    byteLength: archive.byteLength,
    sha256: archive.sha256,
    encoding: 'base64',
    chunkSizeBytes: XER_SOURCE_ARCHIVE_CHUNK_BYTES,
    totalChunks: archive.byteChunks.length,
    chunks: paged.slice.map((base64, index) => ({ index: paged.offset + index, base64 })),
    total: paged.total,
    has_more: next < paged.total,
    next_offset: next < paged.total ? next : null,
  };
}

function inspect(state: AppState, rawArgs: unknown): unknown {
  const args = requireOnlyKeys(rawArgs);
  if (args.section !== undefined && (typeof args.section !== 'string' || !(SECTIONS as readonly string[]).includes(args.section))) {
    throw new XerProvenanceError('VALIDATION', `\`section\` must be one of ${SECTIONS.join(', ')}.`);
  }
  if (args.includeRawSource !== undefined && typeof args.includeRawSource !== 'boolean') {
    throw new XerProvenanceError('VALIDATION', '`includeRawSource` must be a boolean.');
  }
  if (args.includeRawRows !== undefined && typeof args.includeRawRows !== 'boolean') {
    throw new XerProvenanceError('VALIDATION', '`includeRawRows` must be a boolean.');
  }
  if (args.includeResourceNames !== undefined && typeof args.includeResourceNames !== 'boolean') {
    throw new XerProvenanceError('VALIDATION', '`includeResourceNames` must be a boolean.');
  }
  const section = (args.section ?? 'summary') as Section;
  const archive = state.xerSourceArchive;
  if (args.projectId !== undefined && (typeof args.projectId !== 'string' || args.projectId.trim() === '')) {
    throw new XerProvenanceError('VALIDATION', '`projectId` must be a non-empty string.');
  }
  if (section !== 'rawSource' && args.includeRawSource !== undefined) {
    throw new XerProvenanceError('VALIDATION', '`includeRawSource` only belongs to section `rawSource`.');
  }
  if (args.includeRawRows !== undefined && !RAW_ROWS_SECTIONS.includes(section)) {
    throw new XerProvenanceError(
      'VALIDATION',
      '`includeRawRows` only belongs to section `resourceCatalog`, `metadataCatalog`, `taskSourceRowsByProject` or `diagnostics`.',
    );
  }
  if (args.includeResourceNames !== undefined && !RESOURCE_NAMES_SECTIONS.includes(section)) {
    throw new XerProvenanceError(
      'VALIDATION',
      '`includeResourceNames` only belongs to section `resourceCatalog` or `rawSource`; no other section returns resource names.',
    );
  }
  if (section === 'summary') {
    if (args.collection !== undefined) throw new XerProvenanceError('VALIDATION', '`collection` does not belong to section `summary`.');
    if (args.limit !== undefined || args.offset !== undefined) throw new XerProvenanceError('VALIDATION', '`limit` and `offset` do not belong to section `summary`.');
    if (args.projectId !== undefined && archive) validateProjectSelector(archive, args.projectId);
    return summary(state, archive);
  }
  if (args.projectId !== undefined && archive) validateProjectSelector(archive, args.projectId);
  const selected = requireArchive(state);
  if (section === 'rawSource') {
    if (args.collection !== undefined || args.projectId !== undefined) throw new XerProvenanceError('VALIDATION', '`rawSource` only takes includeRawSource, limit and offset.');
    return rawSource(selected, args);
  }
  if (section === 'taskSourceRowsByProject') {
    if (args.collection !== undefined) throw new XerProvenanceError('VALIDATION', '`collection` does not belong to section `taskSourceRowsByProject`.');
    return taskSourceRows(selected, args);
  }
  if (section === 'resourceCatalog') return resourceCatalog(selected, args);
  if (section === 'metadataCatalog') return metadataCatalog(selected, args);
  if (section === 'diagnostics') return diagnostics(selected, args);
  throw new XerProvenanceError('VALIDATION', `Unknown section: ${section}.`);
}

const inputSchema = {
  type: 'object',
  properties: {
    section: { type: 'string', enum: [...SECTIONS], description: 'Default summary.' },
    collection: { type: 'string', enum: COLLECTION_ENUM, description: 'Within resourceCatalog, metadataCatalog or diagnostics.' },
    projectId: { type: 'string', description: 'Required for taskSourceRowsByProject (`selector.availableProjectIds`).' },
    limit: { type: 'number', description: 'Default 50; rawSource ≤ 8 chunks of ~256 kB, with includeRawRows ≤ 100.' },
    offset: { type: 'number' },
    includeRawSource: { type: 'boolean', description: 'Required for rawSource.' },
    includeRawRows: {
      type: 'boolean',
      description:
        'Also show free text (notes, custom fields, other XER columns); not for summary or rawSource.',
    },
    includeResourceNames: {
      type: 'boolean',
      default: false,
      description: 'For resourceCatalog; required for rawSource. Needs permission (see above).',
    },
  },
  additionalProperties: false,
} as const;

export const xerProvenanceTools: McpToolDef[] = [{
  name: 'planner_inspect_xer_provenance',
  description:
    'Read the retained P6/XER source of an imported file (not batchable). Without `includeRawRows` only ' +
    'id/code/label fields show. Resource ' +
    'names are hidden: before `includeResourceNames: true`, ask the user for permission, because the names ' +
    'are personal data and go to your AI provider.',
  kind: 'read',
  batchable: false,
  inputSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: (args, ctx) => readTool(ctx, (state) => inspect(state, args)),
}];
