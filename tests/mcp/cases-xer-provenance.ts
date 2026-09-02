// Gerichte MCP-contracttests voor retained XER/P6-bronsemantiek.
// Alle bronwaarden zijn synthetisch; er wordt geen corpusnaam of pad gebruikt.
import { useAppStore, test, assert, assertEq, run } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpContext, McpToolErr, McpToolOk, McpToolResult } from '@/services/mcp/contracts';
import {
  XER_SOURCE_ARCHIVE_CHUNK_BYTES,
  createEmptyXerArchiveDiagnostics,
  createEmptyXerArchiveReadModel,
  type XerSourceArchive,
} from '@/services/xerSourceArchive';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

const S = () => useAppStore.getState();
const TOOL = 'planner_inspect_xer_provenance';

function ctx(): McpContext {
  return {
    expectedDocId: null,
    tempIdMap: new Map<string, string>(),
    paused: false,
    readOnly: false,
    ensureBackup: async () => null,
  };
}

function call(name: string, args: unknown = {}): McpToolResult {
  const tool = getTool(name);
  assert(!!tool, `tool ${name} ontbreekt`);
  return tool!.handler(args, ctx()) as McpToolResult;
}

async function callAsync(name: string, args: unknown = {}): Promise<McpToolResult> {
  const tool = getTool(name);
  assert(!!tool, `tool ${name} ontbreekt`);
  return await tool!.handler(args, ctx());
}

function ok(name: string, args: unknown = {}): any {
  const result = call(name, args);
  assert(result.ok, `${name} gaf een fout: ${result.ok ? '' : result.error}`);
  return (result as McpToolOk).data;
}

function err(name: string, args: unknown): McpToolErr {
  const result = call(name, args);
  assert(!result.ok, `${name} moest falen`);
  return result as McpToolErr;
}

function reset(): void {
  S().newProject();
}

function archiveFixture(): XerSourceArchive {
  // De production-reader levert deze exact gevormde objectgrafiek. De test gebruikt een compacte
  // synthetische variant, omdat deze suite MCP-responscontracten test en geen XER-parsercontract.
  const readModel = structuredClone(createEmptyXerArchiveReadModel()) as any;
  const diagnostics = structuredClone(createEmptyXerArchiveDiagnostics()) as any;
  const longCell = 'synthetic-free-cell-' + 'x'.repeat(1500);
  readModel.numberFormat = { decimal: ',', group: '.', source: 'currtype', currencyCode: 'EUR' };
  readModel.taskSourceRowsByProject = {
    'PROJ-A': [
      { line: 11, cells: { task_id: 'TASK-A', task_name: longCell, task_notes: 'synthetic note' } },
      { line: 12, cells: { task_id: 'TASK-B', task_name: 'Second synthetic task' } },
    ],
  };
  readModel.resourceCatalog = {
    resources: [{ id: 'resource-1', name: 'Synthetic Crew' }],
    identities: [{ kind: 'RESOURCE', sourceId: 'R-1', internalId: 'resource-1', line: 20 }],
    rows: {
      resources: [{ sourceId: 'R-1', rawRow: { line: 20, cells: { rsrc_id: 'R-1', rsrc_name: 'Synthetic Crew' } } }],
      roles: [{ sourceId: 'ROLE-1', rawRow: { line: 21, cells: { role_id: 'ROLE-1', role_name: 'Synthetic Role' } } }],
      rates: [{ sourceId: 'R-1', rawRow: { line: 22, cells: { rsrc_id: 'R-1' } } }],
      curves: [{ sourceId: 'CURVE-1', rawRow: { line: 23, cells: { curve_id: 'CURVE-1' } } }],
      assignments: [{ sourceId: 'R-1', taskSourceId: 'TASK-A', rawRow: { line: 24, cells: { task_id: 'TASK-A' } } }],
    },
    issues: [{ code: 'XER_RESOURCE_TYPE_FALLBACK', table: 'RSRC', line: 20, sourceId: 'R-1', fallback: 'LABOR' }],
  };
  readModel.metadataCatalog = {
    activityCodeTypes: [{ id: 'ACTIVITY-TYPE-1', name: 'Synthetic Discipline', values: [{ id: 'ACTIVITY-VALUE-1', code: 'CIVIL' }] }],
    customFieldDefs: [{ id: 'UDF-1', name: 'Synthetic phase', type: 'text' }],
    taskProjections: [{ projectId: 'PROJ-A', taskId: 'TASK-A', activityCodes: { 'ACTIVITY-TYPE-1': 'ACTIVITY-VALUE-1' }, customFields: { 'UDF-1': 'Phase A' } }],
    taskProjectionsByProject: { 'PROJ-A': [{ projectId: 'PROJ-A', taskId: 'TASK-A' }] },
    issues: [{ code: 'XER_UDF_INVALID_VALUE', table: 'UDFVALUE', line: 31 }],
    issueCounts: { XER_UDF_INVALID_VALUE: 1 },
    sourceData: {
      ACTVTYPE: [{ line: 25, cells: { actv_code_type_id: 'ACTIVITY-TYPE-1' } }],
      ACTVCODE: [{ line: 26, cells: { actv_code_id: 'ACTIVITY-VALUE-1' } }],
      TASKACTV: [{ line: 27, cells: { task_id: 'TASK-A' } }],
      UDFTYPE: [{ line: 28, cells: { udf_type_id: 'UDF-1' } }],
      UDFVALUE: [{ line: 29, cells: { fk_id: 'TASK-A' } }],
      MEMOTYPE: [{ line: 30, cells: { memo_type_id: 'MEMO-1' } }],
      TASKNOTE: [{ line: 31, cells: { task_id: 'TASK-A' } }],
      TASKMEMO: [{ line: 32, cells: { task_id: 'TASK-A' } }],
      TASK_NOTES: [{ line: 33, cells: { task_notes: 'synthetic note' } }],
      deferredUdfValues: [{ line: 34, cells: { fk_id: 'RESOURCE-1' } }],
      unknownUdfTypes: [{ line: 35, cells: { udf_type_id: 'UDF-UNKNOWN' } }],
    },
  };
  diagnostics.file = {
    tableReport: {
      encoding: 'windows-1252', endMarkerSeen: true,
      issues: [{ code: 'XER_SYNTHETIC_DIAGNOSTIC', line: 40, table: 'TASK' }],
      unknownTables: [{ name: 'SYNTHETIC_UNKNOWN', rows: 4 }],
      unknownFields: [{ table: 'TASK', name: 'synthetic_unknown_field', rows: 2 }],
    },
    scheduleOptions: [{ code: 'XER_DUPLICATE_SCHEDOPTIONS_PROJ_ID', projectId: 'PROJ-A', rowIndexes: [0, 1], lines: [41, 42] }],
    relationResolutionIssues: [{ reason: 'dangling', line: 43, field: 'task_id', taskId: 'TASK-B', predecessorTaskId: 'TASK-MISSING' }],
    resourceCatalogIssues: readModel.resourceCatalog.issues,
    metadataCatalogIssues: readModel.metadataCatalog.issues,
    importReport: {
      projectsSeen: 2, documentsOpened: 1, emptyProjectsSkipped: 1, baselineProjectsExcluded: 0,
      baselinesMaterialized: 0, danglingBaselineReferences: 1, externalLinksPreserved: 2,
      baselineExclusionReverted: false, baselineFallbackReasons: [],
    },
  };
  diagnostics.documentViews = { 'PROJ-A': { sourceProjectId: 'PROJ-A', synthetic: true } };
  return {
    schemaVersion: 1,
    format: 'primavera-p6-xer',
    byteLength: XER_SOURCE_ARCHIVE_CHUNK_BYTES * 10,
    sha256: 'synthetic-digest',
    encoding: 'windows-1252',
    bom: 'none',
    newline: 'lf',
    byteChunks: Array.from({ length: 10 }, (_, index) => `synthetic-chunk-${index}`),
    diagnostics,
    readModel,
  } as XerSourceArchive;
}

function attachArchive(): XerSourceArchive {
  reset();
  const archive = archiveFixture();
  S().setProject({ name: 'Synthetic XER project' });
  useAppStore.setState((state) => {
    state.xerSourceArchive = archive as any;
    state.xerSourceProjectId = 'PROJ-A';
    state.xerImportMetadata = {
      sourceProjectId: 'PROJ-A',
      defaultCurrencyCode: 'EUR',
      tableReport: archive.diagnostics.file.tableReport,
      calendarIssues: [], enumFallbacks: [], externalRelations: [], externalLinks: [],
      report: archive.diagnostics.file.importReport,
      scheduleOptions: {
        source: 'schedoptions', retainedSource: { sched_use_project_end_date_for_float: true },
        fallbacks: [{ field: 'synthetic_option', token: 'X', fallback: 'false', line: 41 }], diagnostics: [],
        sourceArchive: archive.readModel.scheduleOptionsSourceArchive, sourceRowIndexes: [], sourceRows: [],
      },
    } as any;
  });
  return archive;
}

test('registratie: XER-provenance is read-only, gesloten en batchable', () => {
  const tool = getTool(TOOL);
  assert(!!tool, 'XER-provenance-tool geregistreerd');
  assertEq(tool!.kind, 'read', 'kind read');
  assertEq(tool!.batchable, true, 'batchable');
  assertEq(tool!.annotations.readOnlyHint, true, 'readOnlyHint');
  assertEq(tool!.annotations.openWorldHint, false, 'openWorldHint');
  assertEq((tool!.inputSchema as any).additionalProperties, false, 'unknown keys gesloten');
});

test('planner_get_task: alle acht P6-velden en relationele finish-boundary behouden aanwezigheid, ook false', () => {
  reset();
  const predecessor = S().addTask({ name: 'Synthetic predecessor', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  const successor = S().addTask({ name: 'Synthetic successor', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  const sequenceId = S().addSequence({ predecessorId: predecessor, successorId: successor, type: 'FINISH_START', lagDays: 0 });
  assert(!!sequenceId, 'synthetische relatie aangemaakt');
  useAppStore.setState((state) => {
    const task = state.tasks.find((item) => item.id === successor)!;
    task.p6DurationType = 'DT_FixedRate';
    task.p6ActivityType = 'TT_Task';
    task.p6ProjectId = 'PROJ-A';
    task.p6TaskId = 'TASK-B';
    task.p6ExplicitTargetWindow = false;
    task.p6CompletePctType = 'CP_Phys';
    task.p6ExpectedFinish = '2026-06-05';
    task.p6SuspendResume = false;
    state.sequences.find((item) => item.id === sequenceId)!.p6StartAtPredecessorFinishBoundary = false;
  });
  const data = ok('planner_get_task', { taskId: successor });
  assertEq(data.p6DurationType, 'DT_FixedRate', 'p6DurationType');
  assertEq(data.p6ActivityType, 'TT_Task', 'p6ActivityType');
  assertEq(data.p6ProjectId, 'PROJ-A', 'p6ProjectId');
  assertEq(data.p6TaskId, 'TASK-B', 'p6TaskId');
  assertEq(data.p6ExplicitTargetWindow, false, 'false presence target window');
  assertEq(data.p6CompletePctType, 'CP_Phys', 'p6CompletePctType');
  assertEq(data.p6ExpectedFinish, '2026-06-05', 'p6ExpectedFinish');
  assertEq(data.p6SuspendResume, false, 'false presence suspend/resume');
  assertEq(data.predecessors[0].p6StartAtPredecessorFinishBoundary, false, 'false presence relation boundary');
  const ordinary = S().addTask({ name: 'Synthetic ordinary', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  const ordinaryData = ok('planner_get_task', { taskId: ordinary });
  for (const field of ['p6DurationType', 'p6ActivityType', 'p6ProjectId', 'p6TaskId', 'p6ExplicitTargetWindow', 'p6CompletePctType', 'p6ExpectedFinish', 'p6SuspendResume']) {
    assert(!(field in ordinaryData), `${field} ontbreekt zonder bronaanwezigheid`);
  }
});

test('P6-velden blijven via update_tasks allemaal read-only met gerichte hints', async () => {
  reset();
  const id = S().addTask({ name: 'Synthetic task', isMilestone: false, parentId: null, time: createDefaultTaskTime('2026-06-01', 1) });
  const fields: Record<string, unknown> = {
    p6DurationType: 'DT_FixedRate', p6ActivityType: 'TT_LOE', p6ProjectId: 'PROJ-A', p6TaskId: 'TASK-A',
    p6ExplicitTargetWindow: false, p6CompletePctType: 'CP_Phys', p6ExpectedFinish: '2026-06-05', p6SuspendResume: false,
  };
  const before = JSON.stringify(S().tasks);
  for (const [field, value] of Object.entries(fields)) {
    const result = await callAsync('planner_update_tasks', { updates: [{ id, fields: { [field]: value } }] });
    assert(result.ok, `${field}: update call zelf blijft een zachte weigering`);
    const rejection = (result as McpToolOk).itemRejections?.[0];
    assert(!!rejection && rejection.reason.includes(`onbekend veld '${field}'`), `${field}: REJECT_HINTS is gericht`);
    assert(/P6|\.xer|importdata/.test(rejection!.reason), `${field}: hint benoemt bronsemantiek`);
  }
  assertEq(JSON.stringify(S().tasks), before, 'geen P6-mutatie');
});

test('summary: veilig, volledig geteld en zonder raw bytes of vrije raw rows', () => {
  const archive = attachArchive();
  const data = ok(TOOL);
  assertEq(data.sourcePresent, true, 'bron aanwezig');
  assertEq(data.source.byteLength, archive.byteLength, 'byteLength');
  assertEq(data.source.sha256, archive.sha256, 'digest');
  assertEq(data.source.byteChunkCount, 10, 'chunk count');
  assertEq(data.selector.currentProjectId, 'PROJ-A', 'selector');
  assertEq(data.numberFormat.decimal, ',', 'number format');
  assertEq(data.schedoptions.source, 'schedoptions', 'SCHEDOPTIONS source');
  assertEq(data.importReport.documentsOpened, 1, 'import report');
  assertEq(data.diagnostics.unknownTableCount, 1, 'unknown table count');
  assertEq(data.catalogCounts.resourceCatalog.resources, 1, 'resource count');
  assertEq(data.catalogCounts.metadataCatalog.customFieldDefs, 1, 'UDF-def count');
  const serialized = JSON.stringify(data);
  assert(!serialized.includes('synthetic-chunk-0'), 'summary bevat geen raw base64-chunk');
  assert(!serialized.includes('synthetic-free-cell-'), 'summary bevat geen vrije raw task-row');
});

test('resourceCatalog: alle collecties zijn afzonderlijk gepagineerd', () => {
  attachArchive();
  for (const collection of ['resources', 'identities', 'resourceSources', 'roleSources', 'rates', 'curves', 'assignmentSources', 'issues']) {
    const data = ok(TOOL, { section: 'resourceCatalog', collection, limit: 1, offset: 0 });
    assertEq(data.section, 'resourceCatalog', `${collection}: section`);
    assertEq(data.collection, collection, `${collection}: collection`);
    assertEq(data.total, 1, `${collection}: total`);
    assertEq(data.items.length, 1, `${collection}: item`);
  }
});

test('metadataCatalog: activity codes, UDF-defs, projecties en retained brondata leesbaar', () => {
  attachArchive();
  for (const collection of ['activityCodeTypes', 'customFieldDefs', 'taskProjections', 'issues', 'ACTVTYPE', 'ACTVCODE', 'TASKACTV', 'UDFTYPE', 'UDFVALUE', 'MEMOTYPE', 'TASKNOTE', 'TASKMEMO', 'TASK_NOTES', 'deferredUdfValues', 'unknownUdfTypes']) {
    const data = ok(TOOL, { section: 'metadataCatalog', collection, limit: 1 });
    assertEq(data.collection, collection, `${collection}: collection`);
    assertEq(data.total, 1, `${collection}: total`);
    assertEq(data.items.length, 1, `${collection}: item`);
  }
});

test('taskSourceRowsByProject: expliciete selector en geen verborgen veld/string-truncatie', () => {
  attachArchive();
  const first = ok(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-A', limit: 1 });
  assertEq(first.total, 2, 'total task source rows');
  assertEq(first.items.length, 1, 'eerste pagina');
  assertEq(first.items[0].cells.task_name.length, 1520, 'volledige synthetische raw cel');
  const second = ok(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-A', limit: 1, offset: first.next_offset });
  assertEq(second.items[0].cells.task_id, 'TASK-B', 'volgende pagina zonder overlap');
  assertEq(err(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-UNKNOWN' }).code, 'NOT_FOUND', 'unknown project');
  assertEq(err(TOOL, { section: 'taskSourceRowsByProject' }).code, 'VALIDATION', 'project-id verplicht');
});

test('diagnostics: archive-, unknown-table-, import-report- en documentviewinformatie', () => {
  attachArchive();
  for (const collection of ['tableIssues', 'unknownTables', 'unknownFields', 'scheduleOptions', 'relationResolutionIssues', 'resourceCatalogIssues', 'metadataCatalogIssues', 'documentViews']) {
    const data = ok(TOOL, { section: 'diagnostics', collection, limit: 1 });
    assertEq(data.total, 1, `${collection}: total`);
    assertEq(data.items.length, 1, `${collection}: item`);
  }
  const report = ok(TOOL, { section: 'diagnostics', collection: 'importReport' });
  assertEq(report.report.externalLinksPreserved, 2, 'importReport diagnostics');
});

test('rawSource: alleen opt-in, hard begrensd en paginaerbaar over grote payload', () => {
  attachArchive();
  const denied = err(TOOL, { section: 'rawSource' });
  assertEq(denied.code, 'VALIDATION', 'opt-in verplicht');
  assert(/vrije notities|bronbytes/.test(denied.error), 'privacyhint');
  const first = ok(TOOL, { section: 'rawSource', includeRawSource: true, limit: 8 });
  assertEq(first.chunks.length, 8, 'harde eerste pagina');
  assertEq(first.totalChunks, 10, 'alle chunks geteld');
  assertEq(first.has_more, true, 'volgende chunkpagina');
  const second = ok(TOOL, { section: 'rawSource', includeRawSource: true, limit: 8, offset: first.next_offset });
  assertEq(second.chunks.length, 2, 'laatste pagina');
  assertEq(second.chunks[0].index, 8, 'chunk-index');
  assertEq(err(TOOL, { section: 'rawSource', includeRawSource: true, limit: 9 }).code, 'VALIDATION', 'geen onbeperkte base64');
  assertEq(err(TOOL, { section: 'rawSource', includeRawSource: false }).code, 'VALIDATION', 'false is geen opt-in');
});

test('invalid args en planner_batch gebruiken dezelfde runtimevalidatie zonder storemutatie', async () => {
  attachArchive();
  const before = JSON.stringify({ tasks: S().tasks, sequences: S().sequences, archive: S().xerSourceArchive });
  assertEq(err(TOOL, { unexpected: true }).code, 'VALIDATION', 'unknown top-level key');
  assertEq(err(TOOL, { section: 'not-a-section' }).code, 'VALIDATION', 'unknown section');
  assertEq(err(TOOL, { section: 'resourceCatalog' }).code, 'VALIDATION', 'collection verplicht');
  assertEq(err(TOOL, { section: 'summary', projectId: 7 }).code, 'VALIDATION', 'project-id type');
  assertEq(err(TOOL, { section: 'metadataCatalog', collection: 'customFieldDefs', includeRawSource: true }).code, 'VALIDATION', 'raw opt-in alleen eigen section');
  assertEq(err(TOOL, { section: 'diagnostics', collection: 'importReport', limit: 1 }).code, 'VALIDATION', 'geen paging op scalar report');
  assertEq(err(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-A', limit: 0 }).code, 'VALIDATION', 'limit');
  assertEq(err(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-A', offset: -1 }).code, 'VALIDATION', 'offset');
  const batch = await callAsync('planner_batch', { steps: [{ tool: TOOL, args: { section: 'taskSourceRowsByProject', projectId: 'PROJ-A', limit: 1 } }] });
  assert(batch.ok, 'geldige provenance-call in batch');
  const batchData = (batch as McpToolOk).data as any;
  assertEq(batchData.steps[0].data.items.length, 1, 'batch leest dezelfde pagina');
  const badBatch = await callAsync('planner_batch', { steps: [{ tool: TOOL, args: { unexpected: true } }] });
  assertEq(badBatch.ok, false, 'ongeldige provenance-call in batch faalt hard');
  assertEq((badBatch as McpToolErr).code, 'VALIDATION', 'batch validation code');
  assertEq(JSON.stringify({ tasks: S().tasks, sequences: S().sequences, archive: S().xerSourceArchive }), before, 'geen storemutatie door lees- of batchpad');
});

test('no-XER document: veilige summary meldt afwezigheid, inhoudsectie geeft NOT_FOUND', () => {
  reset();
  const data = ok(TOOL);
  assertEq(data.sourcePresent, false, 'geen XER-bron');
  assertEq(err(TOOL, { section: 'resourceCatalog', collection: 'resources' }).code, 'NOT_FOUND', 'catalogus zonder bron');
});

await run();
