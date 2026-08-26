/**
 * Bestandsbrede X8-mapping voor P6-activitycodes, UDF's en taaknotities.
 *
 * De catalogus wordt precies één keer uit X2-tabellen afgeleid vóór X4b zijn documenten maakt.
 * De projectview hieronder doet daarna uitsluitend lookup en kleine, mutable documentkopieën.
 */
import type { ActivityCodeType, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';
import { formatDate, parseInstant } from '@/utils/dateUtils';
import { parseXerNumber, type XerRow, type XerTables } from './xerTables';
import type {
  XerMetadataCatalog, XerMetadataIssue, XerMetadataIssueCode, XerMetadataProjectView,
  XerMetadataTaskProjection, XerTaskMetadata,
} from './xerMetadataTypes';

export type {
  XerMetadataCatalog, XerMetadataIssue, XerMetadataIssueCode, XerMetadataProjectView,
  XerMetadataTaskProjection, XerTaskMetadata,
} from './xerMetadataTypes';

const ISSUE_CODES = [
  'XER_ACTIVITY_CODE_MISSING_TYPE_ID', 'XER_ACTIVITY_CODE_MISSING_VALUE_ID',
  'XER_ACTIVITY_CODE_DUPLICATE_TYPE_ID', 'XER_ACTIVITY_CODE_DUPLICATE_VALUE_ID',
  'XER_ACTIVITY_CODE_DUPLICATE_LINK', 'XER_ACTIVITY_CODE_DANGLING_TYPE_PARENT',
  'XER_ACTIVITY_CODE_DANGLING_VALUE_PARENT', 'XER_ACTIVITY_CODE_DANGLING_TASK',
  'XER_ACTIVITY_CODE_DANGLING_TYPE', 'XER_ACTIVITY_CODE_DANGLING_VALUE',
  'XER_UDF_MISSING_TYPE_ID', 'XER_UDF_DUPLICATE_TYPE_ID', 'XER_UDF_DUPLICATE_VALUE',
  'XER_UDF_DANGLING_TYPE', 'XER_UDF_DANGLING_ENTITY', 'XER_UDF_AMBIGUOUS_TASK',
  'XER_UDF_UNKNOWN_DATA_TYPE', 'XER_UDF_INVALID_VALUE', 'XER_UDF_DEFERRED_ENTITY',
  'XER_NOTE_DUPLICATE_MEMO_ID', 'XER_NOTE_DANGLING_TASK', 'XER_NOTE_AMBIGUOUS_TASK',
] as const satisfies readonly XerMetadataIssueCode[];

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function rowKey(row: XerRow): string {
  return Object.entries(row.cells).sort(([a], [b]) => compareText(a, b))
    .map(([field, value]) => `${field}\u001f${value}`).join('\u001e');
}
function compareRows(left: XerRow, right: XerRow): number {
  return compareText(rowKey(left), rowKey(right)) || left.line - right.line;
}
function sequence(row: XerRow): number {
  const value = Number(row.cells.seq_num);
  return Number.isFinite(value) ? value : 0;
}
function issueState(): Record<XerMetadataIssueCode, number> {
  return Object.fromEntries(ISSUE_CODES.map(code => [code, 0])) as Record<XerMetadataIssueCode, number>;
}
function addIssue(
  issues: XerMetadataIssue[], counts: Record<XerMetadataIssueCode, number>, issue: XerMetadataIssue,
): void {
  issues.push(issue);
  counts[issue.code]++;
}

function stableHierarchy(rows: readonly XerRow[], idField: string, parentField: string): XerRow[] {
  const byId = new Map(rows.map(row => [row.cells[idField]!, row]));
  const children = new Map<string, XerRow[]>();
  const roots: XerRow[] = [];
  for (const row of rows) {
    const parent = row.cells[parentField]?.trim() ?? '';
    if (!parent || !byId.has(parent)) roots.push(row);
    else {
      const value = children.get(parent) ?? [];
      value.push(row); children.set(parent, value);
    }
  }
  const compare = (a: XerRow, b: XerRow) => sequence(a) - sequence(b)
    || compareText(a.cells[idField]!, b.cells[idField]!);
  const result: XerRow[] = [];
  const visit = (row: XerRow) => {
    result.push(row);
    for (const child of (children.get(row.cells[idField]!) ?? []).sort(compare)) visit(child);
  };
  for (const root of roots.sort(compare)) visit(root);
  const seen = new Set(result.map(row => row.cells[idField]!));
  result.push(...rows.filter(row => !seen.has(row.cells[idField]!)).sort(compare));
  return result;
}

interface TaskOwner { projectId: string; taskId: string; row: XerRow; }
function taskOwners(tables: XerTables): ReadonlyMap<string, readonly TaskOwner[]> {
  const byTaskId = new Map<string, TaskOwner[]>();
  for (const row of tables.tables.get('TASK')?.rows ?? []) {
    const projectId = row.cells.proj_id?.trim() ?? '';
    const taskId = row.cells.task_id?.trim() ?? '';
    if (!projectId || !taskId) continue;
    const owners = byTaskId.get(taskId) ?? [];
    owners.push({ projectId, taskId, row }); byTaskId.set(taskId, owners);
  }
  return byTaskId;
}

function resolveTask(
  row: XerRow, taskId: string, owners: ReadonlyMap<string, readonly TaskOwner[]>,
  issueCode: 'XER_ACTIVITY_CODE_DANGLING_TASK' | 'XER_UDF_DANGLING_ENTITY' | 'XER_NOTE_DANGLING_TASK',
  ambiguousCode: 'XER_UDF_AMBIGUOUS_TASK' | 'XER_NOTE_AMBIGUOUS_TASK' | undefined,
  table: XerMetadataIssue['table'], issues: XerMetadataIssue[], counts: Record<XerMetadataIssueCode, number>,
): TaskOwner | undefined {
  const candidates = owners.get(taskId) ?? [];
  const explicitProject = row.cells.proj_id?.trim();
  if (explicitProject) {
    const exact = candidates.find(candidate => candidate.projectId === explicitProject);
    if (exact) return exact;
  } else if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0 || !ambiguousCode) addIssue(issues, counts, { code: issueCode, table, line: row.line });
  else addIssue(issues, counts, { code: ambiguousCode, table, line: row.line });
  return undefined;
}

function ensureProjection(
  projections: Map<string, XerMetadataTaskProjection>, owner: TaskOwner,
): XerMetadataTaskProjection {
  const key = `${owner.projectId}\u001f${owner.taskId}`;
  const existing = projections.get(key);
  if (existing) return existing;
  const created: XerMetadataTaskProjection = { projectId: owner.projectId, taskId: owner.taskId };
  projections.set(key, created);
  return created;
}

function uniqueById(
  rows: readonly XerRow[], idField: string, table: 'ACTVTYPE' | 'ACTVCODE' | 'UDFTYPE',
  missing: XerMetadataIssueCode, duplicate: XerMetadataIssueCode,
  issues: XerMetadataIssue[], counts: Record<XerMetadataIssueCode, number>,
): Map<string, XerRow> {
  const selected = new Map<string, XerRow>();
  for (const row of rows) {
    const id = row.cells[idField]?.trim() ?? '';
    if (!id) { addIssue(issues, counts, { code: missing, table, line: row.line }); continue; }
    const previous = selected.get(id);
    if (!previous) { selected.set(id, row); continue; }
    selected.set(id, compareRows(previous, row) <= 0 ? previous : row);
    addIssue(issues, counts, { code: duplicate, table, line: row.line, lines: [previous.line, row.line].sort((a, b) => a - b) });
  }
  return selected;
}

function mapActivityCodes(
  tables: XerTables, owners: ReadonlyMap<string, readonly TaskOwner[]>,
  projections: Map<string, XerMetadataTaskProjection>, issues: XerMetadataIssue[], counts: Record<XerMetadataIssueCode, number>,
): ActivityCodeType[] {
  const types = uniqueById(tables.tables.get('ACTVTYPE')?.rows ?? [], 'actv_code_type_id', 'ACTVTYPE',
    'XER_ACTIVITY_CODE_MISSING_TYPE_ID', 'XER_ACTIVITY_CODE_DUPLICATE_TYPE_ID', issues, counts);
  const values = uniqueById(tables.tables.get('ACTVCODE')?.rows ?? [], 'actv_code_id', 'ACTVCODE',
    'XER_ACTIVITY_CODE_MISSING_VALUE_ID', 'XER_ACTIVITY_CODE_DUPLICATE_VALUE_ID', issues, counts);
  const valuesByType = new Map<string, XerRow[]>();
  for (const row of types.values()) {
    const parent = row.cells.parent_actv_code_type_id?.trim() ?? '';
    if (parent && !types.has(parent)) addIssue(issues, counts, { code: 'XER_ACTIVITY_CODE_DANGLING_TYPE_PARENT', table: 'ACTVTYPE', line: row.line });
  }
  for (const row of values.values()) {
    const parent = row.cells.parent_actv_code_id?.trim() ?? '';
    if (parent && !values.has(parent)) addIssue(issues, counts, { code: 'XER_ACTIVITY_CODE_DANGLING_VALUE_PARENT', table: 'ACTVCODE', line: row.line });
    const typeId = row.cells.actv_code_type_id?.trim() ?? '';
    if (!types.has(typeId)) { addIssue(issues, counts, { code: 'XER_ACTIVITY_CODE_DANGLING_TYPE', table: 'ACTVCODE', line: row.line }); continue; }
    const grouped = valuesByType.get(typeId) ?? [];
    grouped.push(row); valuesByType.set(typeId, grouped);
  }
  const selected = new Map<string, Map<string, { valueId: string; row: XerRow }>>();
  for (const row of tables.tables.get('TASKACTV')?.rows ?? []) {
    const taskId = row.cells.task_id?.trim() ?? '';
    const owner = resolveTask(row, taskId, owners, 'XER_ACTIVITY_CODE_DANGLING_TASK', undefined, 'TASKACTV', issues, counts);
    if (!owner) continue;
    const typeId = row.cells.actv_code_type_id?.trim() ?? '';
    const valueId = row.cells.actv_code_id?.trim() ?? '';
    if (!types.has(typeId)) { addIssue(issues, counts, { code: 'XER_ACTIVITY_CODE_DANGLING_TYPE', table: 'TASKACTV', line: row.line }); continue; }
    if (values.get(valueId)?.cells.actv_code_type_id?.trim() !== typeId) {
      addIssue(issues, counts, { code: 'XER_ACTIVITY_CODE_DANGLING_VALUE', table: 'TASKACTV', line: row.line }); continue;
    }
    const key = `${owner.projectId}\u001f${owner.taskId}`;
    const forTask = selected.get(key) ?? new Map<string, { valueId: string; row: XerRow }>();
    const previous = forTask.get(typeId);
    if (previous) {
      addIssue(issues, counts, { code: 'XER_ACTIVITY_CODE_DUPLICATE_LINK', table: 'TASKACTV', line: row.line, lines: [previous.row.line, row.line].sort((a, b) => a - b) });
      if (compareText(valueId, previous.valueId) < 0) forTask.set(typeId, { valueId, row });
    } else forTask.set(typeId, { valueId, row });
    selected.set(key, forTask);
  }
  for (const [key, links] of selected) {
    const [projectId, taskId] = key.split('\u001f');
    const projection = ensureProjection(projections, { projectId: projectId!, taskId: taskId!, row: {} as XerRow });
    projection.activityCodes = Object.fromEntries([...links.entries()].sort(([a], [b]) => compareText(a, b)).map(([type, link]) => [type, link.valueId]));
  }
  return stableHierarchy([...types.values()], 'actv_code_type_id', 'parent_actv_code_type_id').map(type => ({
    id: type.cells.actv_code_type_id!, name: type.cells.actv_code_type || type.cells.actv_code_type_name || type.cells.actv_code_type_id!,
    values: stableHierarchy(valuesByType.get(type.cells.actv_code_type_id!) ?? [], 'actv_code_id', 'parent_actv_code_id')
      .map(value => ({ id: value.cells.actv_code_id!, code: value.cells.short_name || value.cells.actv_code_name || value.cells.actv_code_id!, ...(value.cells.actv_code_name ? { description: value.cells.actv_code_name } : {}) })),
  }));
}

function udfType(raw: string): CustomFieldType | undefined {
  const token = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (['FT_TEXT', 'FT_STATICTYPE', 'TEXT', 'STRING'].includes(token)) return 'text';
  if (['FT_FLOAT', 'FT_FLOAT_2_DECIMALS', 'FT_NUMBER', 'FLOAT', 'DOUBLE', 'NUMBER', 'NUMERIC', 'DECIMAL'].includes(token)) return 'number';
  if (['FT_INT', 'FT_INTEGER', 'INTEGER', 'INT'].includes(token)) return 'integer';
  if (['FT_COST', 'FT_MONEY', 'MONEY', 'CURRENCY', 'COST'].includes(token)) return 'cost';
  if (['FT_DATE', 'FT_START_DATE', 'FT_END_DATE', 'DATE', 'DATETIME'].includes(token)) return 'date';
  if (['FT_BOOLEAN', 'FT_INDICATOR', 'BOOLEAN', 'BOOL', 'INDICATOR'].includes(token)) return 'boolean';
  return undefined;
}
function udfValue(tables: XerTables, row: XerRow, type: CustomFieldType): CustomFieldValue | undefined {
  if (type === 'text') return row.cells.udf_text === '' ? undefined : row.cells.udf_text;
  if (type === 'boolean') {
    const raw = (row.cells.udf_text || row.cells.udf_number || '').trim().toUpperCase();
    return ['Y', 'YES', 'TRUE', '1'].includes(raw) ? true : ['N', 'NO', 'FALSE', '0'].includes(raw) ? false : undefined;
  }
  if (type === 'date') {
    const raw = row.cells.udf_date?.trim() ?? '';
    const parsed = parseInstant(raw.replace(' ', 'T'));
    return raw && !Number.isNaN(parsed.getTime()) ? formatDate(parsed) : undefined;
  }
  try {
    const value = parseXerNumber(row.cells.udf_number ?? '', tables.numberFormat);
    return type !== 'integer' || value === null || Number.isInteger(value) ? value ?? undefined : undefined;
  } catch { return undefined; }
}

function mapUdfs(
  tables: XerTables, owners: ReadonlyMap<string, readonly TaskOwner[]>, projections: Map<string, XerMetadataTaskProjection>,
  issues: XerMetadataIssue[], counts: Record<XerMetadataIssueCode, number>,
): { definitions: CustomFieldDef[]; deferred: XerRow[]; unknown: XerRow[] } {
  const typeRows = uniqueById(tables.tables.get('UDFTYPE')?.rows ?? [], 'udf_type_id', 'UDFTYPE',
    'XER_UDF_MISSING_TYPE_ID', 'XER_UDF_DUPLICATE_TYPE_ID', issues, counts);
  const known = new Map<string, { row: XerRow; type: CustomFieldType }>();
  const unknown: XerRow[] = [];
  for (const [id, row] of typeRows) {
    const type = udfType(row.cells.logical_data_type || row.cells.udf_type || '');
    if (type) known.set(id, { row, type });
    else { unknown.push(row); addIssue(issues, counts, { code: 'XER_UDF_UNKNOWN_DATA_TYPE', table: 'UDFTYPE', line: row.line }); }
  }
  const deferred: XerRow[] = [];
  const selected = new Map<string, XerRow>();
  for (const row of tables.tables.get('UDFVALUE')?.rows ?? []) {
    const typeId = row.cells.udf_type_id?.trim() ?? '';
    const definition = typeRows.get(typeId);
    if (!definition) { addIssue(issues, counts, { code: 'XER_UDF_DANGLING_TYPE', table: 'UDFVALUE', line: row.line }); continue; }
    const entity = definition.cells.table_name?.trim().toUpperCase() || 'UNKNOWN';
    const entityId = (row.cells.fk_id || row.cells.task_id || '').trim();
    const key = `${typeId}\u001f${entity}\u001f${row.cells.proj_id?.trim() ?? ''}\u001f${entityId}`;
    const previous = selected.get(key);
    if (previous) addIssue(issues, counts, { code: 'XER_UDF_DUPLICATE_VALUE', table: 'UDFVALUE', line: row.line, lines: [previous.line, row.line].sort((a, b) => a - b) });
    if (!previous || compareRows(row, previous) < 0) selected.set(key, row);
  }
  for (const row of selected.values()) {
    const typeId = row.cells.udf_type_id!.trim();
    const info = known.get(typeId);
    const entity = typeRows.get(typeId)?.cells.table_name?.trim().toUpperCase() || 'UNKNOWN';
    if (entity !== 'TASK') { deferred.push(row); addIssue(issues, counts, { code: 'XER_UDF_DEFERRED_ENTITY', table: 'UDFVALUE', line: row.line }); continue; }
    if (!info) continue;
    const owner = resolveTask(row, (row.cells.fk_id || row.cells.task_id || '').trim(), owners,
      'XER_UDF_DANGLING_ENTITY', 'XER_UDF_AMBIGUOUS_TASK', 'UDFVALUE', issues, counts);
    if (!owner) continue;
    const value = udfValue(tables, row, info.type);
    if (value === undefined && (row.cells.udf_text || row.cells.udf_number || row.cells.udf_date)) {
      addIssue(issues, counts, { code: 'XER_UDF_INVALID_VALUE', table: 'UDFVALUE', line: row.line }); continue;
    }
    if (value !== undefined) {
      const projection = ensureProjection(projections, owner);
      projection.customFields = { ...(projection.customFields ?? {}), [typeId]: value };
    }
  }
  // Het bestaande OPS-taakmodel kent alleen taakvelden; alle andere definities/waarden blijven
  // volledig in de catalogus tot X9 ze op hun eigen entiteit kan round-trippen.
  const definitions = [...known.entries()].filter(([, info]) => info.row.cells.table_name?.trim().toUpperCase() === 'TASK')
    .sort(([a], [b]) => compareText(a, b)).map(([id, info]) => ({ id, name: info.row.cells.udf_type_label || info.row.cells.udf_type_name || id, type: info.type }));
  return { definitions, deferred, unknown };
}

function mapNotes(
  tables: XerTables, owners: ReadonlyMap<string, readonly TaskOwner[]>, projections: Map<string, XerMetadataTaskProjection>,
  issues: XerMetadataIssue[], counts: Record<XerMetadataIssueCode, number>,
): void {
  for (const row of tables.tables.get('TASK')?.rows ?? []) {
    if (!row.cells.task_notes) continue;
    const owner = resolveTask(row, row.cells.task_id?.trim() ?? '', owners, 'XER_NOTE_DANGLING_TASK', 'XER_NOTE_AMBIGUOUS_TASK', 'TASK', issues, counts);
    if (!owner) continue;
    ensureProjection(projections, owner).notes = [{ id: `xer-note:task:${owner.taskId}`, text: row.cells.task_notes, done: false }];
  }
  const memoTypes = new Set((tables.tables.get('MEMOTYPE')?.rows ?? []).map(row => row.cells.memo_type_id?.trim()).filter(Boolean));
  const selected = new Map<string, XerRow>();
  for (const row of tables.tables.get('TASKMEMO')?.rows ?? []) {
    const id = row.cells.memo_id?.trim() || `line-${row.line}`;
    const previous = selected.get(id);
    if (previous) addIssue(issues, counts, { code: 'XER_NOTE_DUPLICATE_MEMO_ID', table: 'TASKMEMO', line: row.line, lines: [previous.line, row.line].sort((a, b) => a - b) });
    if (!previous || compareRows(row, previous) < 0) selected.set(id, row);
  }
  for (const row of [...selected.values()].sort((a, b) => sequence(a) - sequence(b) || compareRows(a, b))) {
    if (!row.cells.task_memo) continue;
    if (memoTypes.size > 0 && !memoTypes.has(row.cells.memo_type_id?.trim())) continue;
    const owner = resolveTask(row, row.cells.task_id?.trim() ?? '', owners, 'XER_NOTE_DANGLING_TASK', 'XER_NOTE_AMBIGUOUS_TASK', 'TASKMEMO', issues, counts);
    if (!owner) continue;
    const projection = ensureProjection(projections, owner);
    projection.notes = [...(projection.notes ?? []), { id: `xer-note:memo:${row.cells.memo_id?.trim() || `line-${row.line}`}`, text: row.cells.task_memo, done: false }];
  }
}

function freezeCatalog<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const key of Reflect.ownKeys(object)) freezeCatalog((object as Record<PropertyKey, unknown>)[key], seen);
  Object.freeze(object);
  return value;
}

/** Bouw eenmaal de gehele X8-catalogus, inclusief baselineprojecttaken die X4b niet als document opent. */
export function buildXerMetadataCatalog(tables: XerTables): XerMetadataCatalog {
  const issues: XerMetadataIssue[] = [];
  const counts = issueState();
  const projections = new Map<string, XerMetadataTaskProjection>();
  const owners = taskOwners(tables);
  const activityCodeTypes = mapActivityCodes(tables, owners, projections, issues, counts);
  const udf = mapUdfs(tables, owners, projections, issues, counts);
  mapNotes(tables, owners, projections, issues, counts);
  const taskProjections = [...projections.values()].sort((a, b) => compareText(a.projectId, b.projectId) || compareText(a.taskId, b.taskId));
  const taskProjectionsByProject = Object.create(null) as Record<string, XerMetadataTaskProjection[]>;
  for (const projection of taskProjections) {
    (taskProjectionsByProject[projection.projectId] ??= []).push(projection);
  }
  const catalog: XerMetadataCatalog = {
    activityCodeTypes, customFieldDefs: udf.definitions,
    taskProjections, taskProjectionsByProject,
    issues, issueCounts: counts,
    sourceData: {
      ACTVTYPE: tables.tables.get('ACTVTYPE')?.rows ?? [], ACTVCODE: tables.tables.get('ACTVCODE')?.rows ?? [],
      TASKACTV: tables.tables.get('TASKACTV')?.rows ?? [], UDFTYPE: tables.tables.get('UDFTYPE')?.rows ?? [],
      UDFVALUE: tables.tables.get('UDFVALUE')?.rows ?? [], MEMOTYPE: tables.tables.get('MEMOTYPE')?.rows ?? [],
      TASKMEMO: tables.tables.get('TASKMEMO')?.rows ?? [],
      TASK_NOTES: (tables.tables.get('TASK')?.rows ?? []).filter(row => Boolean(row.cells.task_notes)),
      deferredUdfValues: udf.deferred, unknownUdfTypes: udf.unknown,
    },
  };
  return freezeCatalog(catalog);
}

/** Maak kleine, muteerbare documentdata zonder ooit de bestandsbrede raw-catalogus te kopiëren. */
export function materializeXerMetadata(catalog: XerMetadataCatalog, projectId: string): XerMetadataProjectView {
  const taskMetadata = new Map<string, XerTaskMetadata>();
  const projectProjections = catalog.taskProjectionsByProject[projectId] ?? [];
  let visitedTaskProjectionCount = 0;
  for (const projection of projectProjections) {
    visitedTaskProjectionCount++;
    taskMetadata.set(projection.taskId, {
      ...(projection.activityCodes ? { activityCodes: { ...projection.activityCodes } } : {}),
      ...(projection.customFields ? { customFields: { ...projection.customFields } } : {}),
      ...(projection.notes ? { notes: projection.notes.map(note => ({ ...note })) } : {}),
    });
  }
  return {
    activityCodeTypes: catalog.activityCodeTypes.map(type => ({ ...type, values: type.values.map(value => ({ ...value })) })),
    customFieldDefs: catalog.customFieldDefs.map(definition => ({ ...definition })), taskMetadata,
    visitedTaskProjectionCount,
  };
}
