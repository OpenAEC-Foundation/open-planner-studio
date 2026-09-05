// Gerichte MCP-contracttests voor retained XER/P6-bronsemantiek.
// Alle bronwaarden zijn synthetisch; er wordt geen corpusnaam of pad gebruikt.
import { useAppStore, makeMcpContext, test, assert, assertEq, run } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import type { McpContext, McpToolErr, McpToolOk, McpToolResult } from '@/services/mcp/contracts';
import {
  XER_SOURCE_ARCHIVE_CHUNK_BYTES,
  createEmptyXerArchiveDiagnostics,
  createEmptyXerArchiveReadModel,
  type XerSourceArchive,
} from '@/services/xerSourceArchive';
import { reconstructXerSourceArchiveFromBytes } from '@/services/xer/xerReader';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

const S = () => useAppStore.getState();
const TOOL = 'planner_inspect_xer_provenance';

function ctx(): McpContext {
  return makeMcpContext();
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

// Reviewbevinding P1 (batch): een grote gestructureerde XER-invoer mag geen enkele cel onbegrensd
// laten groeien. `LONG_CELL` is > het per-cel afkapniveau (2.000 tekens) zodat afkapping écht
// getest wordt (de oorspronkelijke synthetische fixture van 1.520 tekens bleef er ONDER en bewees
// dus niets over de afkapgrens zelf).
const LONG_CELL = 'synthetic-free-cell-' + 'x'.repeat(5000);
const LONG_CELL_TRUNCATED_LENGTH = 2000 + '…(afgekapt op 2000 tekens)'.length;

// Reviewronde 2 (review2-3d.md #2): de eerste fix dichtte alleen `rawRow.cells` af; vrije tekst
// BUITEN `rawRow` (roleSources.description, resources.description, taskProjections.notes/
// customFields) ging ongefilterd mee. Twee aparte secrets houden de twee behandelingen uit elkaar:
// FREE_TEXT_SECRET hoort in een veld dat zonder opt-in VOLLEDIG moet verdwijnen (notities); die
// mag dus NERGENS verschijnen, ook niet als afgekapt prefix. LABEL_SECRET hoort in een kort
// naam-/labelveld dat bewust ZICHTBAAR blijft maar hard afgekapt — daar is een 200-tekens-prefix
// een correcte uitkomst, geen lek.
const FREE_TEXT_SECRET = 'FREE-TEXT-SECRET-' + 'y'.repeat(9000);
const LABEL_SECRET = 'LABEL-SECRET-' + 'z'.repeat(9000);
const LABEL_TRUNCATED_LENGTH = 200 + '…(afgekapt op 200 tekens)'.length;

// Reviewronde 3 (review2-3d.md N2): een BLOCKLIST van vrije-tekstsleutels vergeet onvermijdelijk een
// synoniem — `text`/`comment`/`memo`/`remark`/`title`/`longName` glipten er in ronde 2 allemaal
// doorheen. De fix keert de classificatie om naar deny-by-default (`SAFE_LABEL_KEYS`-allowlist); deze
// zes alias-sleutels op `roleSources[0]` bewijzen dat ELKE onbekende sleutel nu standaard verborgen
// is, niet alleen de drie die de vorige ronde bij naam noemde.
const ALIAS_SECRET = 'ALIAS-SECRET-' + 'a'.repeat(3000);
const ALIAS_KEYS = ['text', 'comment', 'memo', 'remark', 'title', 'longName'] as const;

// Reviewronde 3 (review2-3d.md N5): een bronrij-vorm met méér dan twee sleutels moet nog steeds
// structureel herkend worden.
const N5_SECRET = 'N5-SHAPE-SECRET-' + 'n'.repeat(9000);

// Reviewronde 4 (review2-3d.md R8): exact het door de review gemeten getal — een project-id van
// 80.000 tekens die als OBJECTSLEUTEL (niet als waarde) de respons in gaat.
const LONG_PROJECT_ID = 'P'.repeat(80000);

function archiveFixture(): XerSourceArchive {
  // De production-reader levert deze exact gevormde objectgrafiek. De test gebruikt een compacte
  // synthetische variant, omdat deze suite MCP-responscontracten test en geen XER-parsercontract.
  const readModel = structuredClone(createEmptyXerArchiveReadModel()) as any;
  const diagnostics = structuredClone(createEmptyXerArchiveDiagnostics()) as any;
  // Review2-3d.md ronde 3, N3: `currencyCode` komt uit CURRTYPE in het bronbestand — een 5.014-tekens
  // waarde (exact het door de review gemeten getal) bewijst dat `summary` nu ook door de
  // labelafkapping loopt (het IS een SAFE_LABEL_KEYS-veld, dus zichtbaar, maar hard begrensd).
  readModel.numberFormat = { decimal: ',', group: '.', source: 'currtype', currencyCode: `EUR-${'Q'.repeat(5010)}` };
  readModel.taskSourceRowsByProject = {
    'PROJ-A': [
      { line: 11, cells: { task_id: 'TASK-A', task_name: LONG_CELL, task_notes: 'synthetic note' } },
      { line: 12, cells: { task_id: 'TASK-B', task_name: 'Second synthetic task' } },
    ],
    // Reviewbevinding P1 (responsgrens): 100 rijen (de opt-in-paginalimiet) met elk drie ruime
    // vrije cellen, zodat één pagina ná per-cel-afkapping alsnog boven de 256 kB-responsgrens komt.
    'PROJ-BIG': Array.from({ length: 100 }, (_, index) => ({
      line: 200 + index,
      cells: {
        task_id: `BIG-${index}`,
        cell_a: 'a'.repeat(3000),
        cell_b: 'b'.repeat(3000),
        cell_c: 'c'.repeat(3000),
      },
    })),
    // Review2-3d.md #4: CJK-tekst is 1 UTF-16-code-unit maar 3 UTF-8-bytes per teken. 50 rijen ×
    // 2.000 CJK-tekens = 100.000 CODE-UNITS (ver onder de oude "String.length"-grens van 262.144)
    // maar ≈ 300.000 ECHTE BYTES (ruim boven de 262.144-bytesgrens die de tool belooft).
    'PROJ-CJK': Array.from({ length: 50 }, (_, index) => ({
      line: 300 + index,
      cells: { task_id: `CJK-${index}`, greeting: '漢'.repeat(2000) },
    })),
    // Review2-3d.md #5: dit project heeft GEEN documentview (het is nooit "geopend" in de zin van
    // de lezer) maar staat wél hier — precies de P2_BASELINE-situatie uit de review: de summary moet
    // het adverteren, en de tool moet het ook echt accepteren.
    'PROJ-ONLY-IN-TASKROWS': [{ line: 500, cells: { task_id: 'ONLY-1' } }],
    // Review2-3d.md ronde 3, N5: een bronrij met MEER dan twee sleutels (zoals
    // `XerScheduleOptionsSourceRow` = `{table,line,cells}`) moet nog steeds structureel herkend
    // worden — niet fail-open naar de generieke labeltak vallen.
    'PROJ-SHAPE': [{ table: 'PROJECT', line: 800, cells: { secret_col: N5_SECRET } }],
    // Review2-3d.md ronde 3, N4: één rij met een kolomNAAM van 60.001 tekens (de review mat exact dit
    // getal) — moet zelf afgekapt worden, niet verbatim meegaan.
    'PROJ-LONGKEY': [{ line: 600, cells: { [`col_${'k'.repeat(60001)}`]: 'short-value' } }],
    // Review2-3d.md ronde 3, N4: 10 rijen × 200 cellen met LANGE kolomnamen maar TRIVIALE waarden —
    // zonder key-begroting zou de budget-teller hier bijna niets zien (de waarden zijn 1 teken) en
    // pas via de dure `finalizeBounded`-serialisatie ingrijpen, als het al binnen de opt-in-
    // paginalimiet past. Met key-begroting breekt de teller tijdens de projectie af.
    'PROJ-LONGKEY-BUDGET': Array.from({ length: 10 }, (_, rowIndex) => ({
      line: 700 + rowIndex,
      cells: Object.fromEntries(Array.from({ length: 200 }, (_, cellIndex) => [
        `col_${rowIndex}_${cellIndex}_${'k'.repeat(2500)}`, 'v',
      ])),
    })),
    // Review2-3d.md ronde 4, R8: een project-id van 80.000 tekens (`proj_id` komt uit het
    // bronbestand) belandt via `summary.catalogCounts.taskSourceRowsByProject` als OBJECTSLEUTEL —
    // de generieke objecttak deed voorheen `out[childKey] = …` zonder de sleutel zelf af te kappen.
    [LONG_PROJECT_ID]: [{ line: 900, cells: { task_id: 'LONGID-1' } }],
  };
  readModel.resourceCatalog = {
    resources: [{ id: 'resource-1', name: 'Synthetic Crew', description: FREE_TEXT_SECRET }],
    identities: [{ kind: 'RESOURCE', sourceId: 'R-1', internalId: 'resource-1', line: 20 }],
    rows: {
      resources: [{ sourceId: 'R-1', internalId: 'resource-1', line: 20, rawType: '1', rawRow: { line: 20, cells: { rsrc_id: 'R-1', rsrc_name: 'Synthetic Crew', rsrc_notes: LONG_CELL } } }],
      roles: [{
        sourceId: 'ROLE-1', internalId: 'role-1', line: 21, name: 'Synthetic Role', shortName: 'SR',
        description: FREE_TEXT_SECRET,
        // Zes alias-sleutels (review2-3d.md N2) — geen van deze staat op een blocklist, dus alleen
        // deny-by-default (SAFE_LABEL_KEYS) verbergt ze allemaal.
        text: ALIAS_SECRET, comment: ALIAS_SECRET, memo: ALIAS_SECRET, remark: ALIAS_SECRET,
        title: ALIAS_SECRET, longName: ALIAS_SECRET,
        rawRow: { line: 21, cells: { role_id: 'ROLE-1', role_name: 'Synthetic Role' } },
      }],
      rates: [{ sourceId: 'R-1', internalId: 'resource-1', entity: { kind: 'RESOURCE', sourceId: 'R-1', internalId: 'resource-1' }, line: 22, maxUnitsPerTime: null, costs: [null, null, null, null, null], rawRow: { line: 22, cells: { rsrc_id: 'R-1' } } }],
      curves: [{ sourceId: 'CURVE-1', internalId: 'curve-1', line: 23, name: LABEL_SECRET, rawPoints: Array(21).fill('0'), rawRow: { line: 23, cells: { curve_id: 'CURVE-1' } } }],
      assignments: [{ sourceId: 'R-1', taskSourceId: 'TASK-A', rawRow: { line: 24, cells: { task_id: 'TASK-A' } } }],
    },
    issues: [{ code: 'XER_RESOURCE_TYPE_FALLBACK', table: 'RSRC', line: 20, sourceId: 'R-1', fallback: 'LABOR' }],
  };
  readModel.metadataCatalog = {
    activityCodeTypes: [{ id: 'ACTIVITY-TYPE-1', name: 'Synthetic Discipline', values: [{ id: 'ACTIVITY-VALUE-1', code: 'CIVIL' }] }],
    customFieldDefs: [{ id: 'UDF-1', name: LABEL_SECRET, type: 'text' }],
    taskProjections: [{
      projectId: 'PROJ-A', taskId: 'TASK-A',
      // `Task['notes']` (src/types/task.ts) is een OBJECTARRAY (`{id,text,done}[]`), geen string
      // (review2-3d.md ronde 3, N1) — de fixture gebruikt bewust de ECHTE vorm zodat de test het
      // eerdere lek (de blocklist keek alleen naar de buitenste sleutel `notes`, niet naar `text`
      // binnenin) ook echt had gezien.
      notes: [{ id: 'note-1', text: FREE_TEXT_SECRET, done: false }],
      activityCodes: { 'ACTIVITY-TYPE-1': 'ACTIVITY-VALUE-1' },
      customFields: { 'UDF-1': FREE_TEXT_SECRET },
    }],
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
      // TASKMEMO draagt bij uitstek vrije notitietekst — de synthetische cel is bewust lang.
      TASKMEMO: [{ line: 32, cells: { task_id: 'TASK-A', task_memo: LONG_CELL } }],
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
  diagnostics.documentViews = {
    'PROJ-A': { sourceProjectId: 'PROJ-A', synthetic: true },
    'PROJ-BIG': { sourceProjectId: 'PROJ-BIG', synthetic: true },
  };
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

test('registratie: XER-provenance is read-only, gesloten en NIET batchable', () => {
  const tool = getTool(TOOL);
  assert(!!tool, 'XER-provenance-tool geregistreerd');
  assertEq(tool!.kind, 'read', 'kind read');
  assertEq(tool!.batchable, false, 'niet batchable (P1-fix): read-only-belofte mag een batch niet omzeilen');
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

test('P2 #2 (N3): summary loopt door dezelfde poort — currencyCode afgekapt, importReport geen alias, responsgrens', () => {
  const archive = attachArchive();
  const data = ok(TOOL);
  assertEq(data.numberFormat.currencyCode.length, LABEL_TRUNCATED_LENGTH, 'currencyCode (SAFE_LABEL_KEYS) afgekapt op 200 tekens, óók in summary (N3)');
  assert(
    data.importReport !== archive.diagnostics.file.importReport,
    'importReport is een verse, gesaneerde kopie — nooit meer een levende alias naar het bevroren archief (N3)',
  );
  assertEq(
    data.importReport.externalLinksPreserved,
    archive.diagnostics.file.importReport.externalLinksPreserved,
    'importReport-inhoud blijft (numeriek) correct ná sanering',
  );
  const byteLength = new TextEncoder().encode(JSON.stringify(data)).length;
  assert(byteLength <= 256 * 1024, `summary blijft binnen de responsgrens (N3), kreeg ${byteLength} bytes`);
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

test('resourceCatalog: rawRow-cellen alleen achter includeRawRows, met afkapping', () => {
  attachArchive();
  const closed = ok(TOOL, { section: 'resourceCatalog', collection: 'resourceSources', limit: 1 });
  assert(!('cells' in closed.items[0].rawRow), 'zonder opt-in geen cellen in rawRow');
  assertEq(closed.items[0].rawRow.fieldCount, 3, 'fieldCount i.p.v. cellen');
  assertEq(closed.items[0].sourceId, 'R-1', 'niet-vrije velden blijven zichtbaar zonder opt-in');
  const serializedClosed = JSON.stringify(closed);
  assert(!serializedClosed.includes('synthetic-free-cell-'), 'geen vrije brontekst zonder opt-in');

  const opened = ok(TOOL, { section: 'resourceCatalog', collection: 'resourceSources', limit: 1, includeRawRows: true });
  assertEq(opened.items[0].rawRow.cells.rsrc_id, 'R-1', 'korte cel ongewijzigd met opt-in');
  assertEq(opened.items[0].rawRow.cells.rsrc_notes.length, LONG_CELL_TRUNCATED_LENGTH, 'grote vrije cel afgekapt, niet volledig');
  assert(opened.items[0].rawRow.cells.rsrc_notes.endsWith('afgekapt op 2000 tekens)'), 'afkapmarker aanwezig');

  assertEq(err(TOOL, { section: 'resourceCatalog', collection: 'resourceSources', includeRawRows: true, limit: 101 }).code, 'VALIDATION', 'opt-in-paginalimiet 100');
  assertEq(err(TOOL, { section: 'summary', includeRawRows: true }).code, 'VALIDATION', 'includeRawRows alleen bij eigen sections');
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

test('metadataCatalog: retained brondata (TASKMEMO) alleen achter includeRawRows, met afkapping', () => {
  attachArchive();
  const closed = ok(TOOL, { section: 'metadataCatalog', collection: 'TASKMEMO', limit: 1 });
  assert(!('cells' in closed.items[0]), 'zonder opt-in geen cellen');
  assertEq(closed.items[0].fieldCount, 2, 'fieldCount i.p.v. cellen');
  const serializedClosed = JSON.stringify(closed);
  assert(!serializedClosed.includes('synthetic-free-cell-'), 'geen vrije notitietekst zonder opt-in');

  const opened = ok(TOOL, { section: 'metadataCatalog', collection: 'TASKMEMO', limit: 1, includeRawRows: true });
  assertEq(opened.items[0].cells.task_memo.length, LONG_CELL_TRUNCATED_LENGTH, 'grote notitiecel afgekapt met opt-in');

  // Genormaliseerde (niet-rij) collecties zijn ongevoelig voor includeRawRows: geen `cells` te
  // verbergen, dus geen gedragsverschil.
  const normalized = ok(TOOL, { section: 'metadataCatalog', collection: 'customFieldDefs', limit: 1, includeRawRows: true });
  assertEq(normalized.items[0].id, 'UDF-1', 'genormaliseerde collectie ongewijzigd door includeRawRows');
});

test('taskSourceRowsByProject: expliciete selector, standaard geen cellen, opt-in afgekapt', () => {
  attachArchive();
  const closed = ok(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-A', limit: 10 });
  assertEq(closed.total, 2, 'total task source rows');
  assert(!('cells' in closed.items[0]), 'zonder includeRawRows geen cellen');
  assertEq(closed.items[0].fieldCount, 3, 'fieldCount i.p.v. cellen (task_id/task_name/task_notes)');
  const serializedClosed = JSON.stringify(closed);
  assert(!serializedClosed.includes('synthetic-free-cell-'), 'geen vrije task-row zonder opt-in (P1)');

  const opened = ok(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-A', limit: 1, includeRawRows: true });
  assertEq(opened.items.length, 1, 'eerste pagina');
  assertEq(opened.items[0].cells.task_name.length, LONG_CELL_TRUNCATED_LENGTH, 'grote raw cel afgekapt, niet volledig (P1)');
  assert(opened.items[0].cells.task_name.endsWith('afgekapt op 2000 tekens)'), 'afkapmarker aanwezig');
  const second = ok(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-A', limit: 1, includeRawRows: true, offset: opened.next_offset });
  assertEq(second.items[0].cells.task_id, 'TASK-B', 'volgende pagina zonder overlap');

  assertEq(err(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-UNKNOWN' }).code, 'NOT_FOUND', 'unknown project');
  assertEq(err(TOOL, { section: 'taskSourceRowsByProject' }).code, 'VALIDATION', 'project-id verplicht');
  assertEq(err(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-A', includeRawRows: true, limit: 101 }).code, 'VALIDATION', 'opt-in-paginalimiet 100');
});

test("taskSourceRowsByProject: responsgrens vangt grote pagina's ondanks per-cel-afkapping", () => {
  attachArchive();
  const tooLarge = err(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-BIG', includeRawRows: true, limit: 100 });
  assertEq(tooLarge.code, 'VALIDATION', 'responsgrens (P1): 100 rijen × 3 afgekapte cellen > 256 kB');
  assert(/responsgrens|limit/.test(tooLarge.error), 'foutmelding hint naar limit/offset');
  const smaller = ok(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-BIG', includeRawRows: true, limit: 10 });
  assertEq(smaller.items.length, 10, 'kleinere pagina blijft onder de responsgrens');
});

test('diagnostics: archive-, unknown-table-, import-report- en documentviewinformatie', () => {
  attachArchive();
  for (const collection of ['tableIssues', 'unknownTables', 'unknownFields', 'scheduleOptions', 'relationResolutionIssues', 'resourceCatalogIssues', 'metadataCatalogIssues']) {
    const data = ok(TOOL, { section: 'diagnostics', collection, limit: 1 });
    assertEq(data.total, 1, `${collection}: total`);
    assertEq(data.items.length, 1, `${collection}: item`);
  }
  // Twee documentViews in de fixture (PROJ-A + PROJ-BIG, de laatste alleen voor de
  // responsgrens-test hierboven) — total telt dus mee, de pagina zelf blijft limit-gestuurd.
  const documentViews = ok(TOOL, { section: 'diagnostics', collection: 'documentViews', limit: 1 });
  assertEq(documentViews.total, 2, 'documentViews: total');
  assertEq(documentViews.items.length, 1, 'documentViews: item');
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

test('invalid args worden runtime geweigerd zonder storemutatie', () => {
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
  assertEq(err(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-A', includeRawRows: 'yes' as any }).code, 'VALIDATION', 'includeRawRows type');
  // `diagnostics` zit sinds review2-3d.md #1 óók in RAW_ROWS_SECTIONS (documentViews draagt dezelfde
  // vrije cellen als de andere drie) — `rawSource` heeft juist zijn EIGEN opt-in (`includeRawSource`)
  // en blijft dus wél buiten deze lijst.
  assertEq(err(TOOL, { section: 'rawSource', includeRawSource: true, includeRawRows: true }).code, 'VALIDATION', 'includeRawRows hoort niet bij rawSource (dat heeft includeRawSource)');
  assertEq(JSON.stringify({ tasks: S().tasks, sequences: S().sequences, archive: S().xerSourceArchive }), before, 'geen storemutatie door leespad');
});

test('P1: planner_batch weigert deze tool vóór enige mutatie, transactie of herberekening', async () => {
  attachArchive();
  // Expliciete, herkenbare uitgangstoestand — als checkExclusions vóór de transactie weigert, blijft
  // dit exact zo; verandert er iets, dan liep de aanroep alsnog door de mutatie-executor.
  useAppStore.setState((state) => {
    state.isDirty = false;
    state.scheduleStale = true;
    state.cpmResult = null;
  });
  const before = { isDirty: S().isDirty, scheduleStale: S().scheduleStale, cpmResult: S().cpmResult };

  const validArgsBatch = await callAsync('planner_batch', { steps: [{ tool: TOOL, args: { section: 'summary' } }] });
  assertEq(validArgsBatch.ok, false, 'geldige args helpen niet: de tool zelf is uitgesloten');
  assertEq((validArgsBatch as McpToolErr).code, 'VALIDATION', 'batchable:false ⇒ VALIDATION vóór de transactie');
  assert(/niet batchable|uitgesloten/.test((validArgsBatch as McpToolErr).error), 'foutmelding noemt de uitsluiting');

  const invalidArgsBatch = await callAsync('planner_batch', { steps: [{ tool: TOOL, args: { unexpected: true } }] });
  assertEq(invalidArgsBatch.ok, false, 'ook met ongeldige args blijft de weigering VALIDATION');
  assertEq((invalidArgsBatch as McpToolErr).code, 'VALIDATION', 'ongeldige args veranderen de foutcode niet');

  assertEq(S().isDirty, before.isDirty, 'isDirty ongewijzigd: checkExclusions weigert vóór runInMcpTransaction');
  assertEq(S().scheduleStale, before.scheduleStale, 'scheduleStale ongewijzigd: geen eindherberekening gedraaid');
  assertEq(S().cpmResult, before.cpmResult, 'cpmResult ongewijzigd: geen runCPM gedraaid');
});

test('no-XER document: veilige summary meldt afwezigheid, inhoudsectie geeft NOT_FOUND', () => {
  reset();
  const data = ok(TOOL);
  assertEq(data.sourcePresent, false, 'geen XER-bron');
  assertEq(err(TOOL, { section: 'resourceCatalog', collection: 'resources' }).code, 'NOT_FOUND', 'catalogus zonder bron');
});

test('P3 (R9): sourcePresent:false loopt ook door de poort — currentProjectId afgekapt', () => {
  reset();
  // `xerSourceProjectId` is GEEN statische tekst — het is een documentveld dat uit het bestand komt
  // (review2-3d.md ronde 4, R9). Vóór de fix retourneerde deze tak vóór sanitize/finalizeBounded.
  const hugeId = 'X'.repeat(9009);
  useAppStore.setState((state) => { state.xerSourceProjectId = hugeId; });
  const data = ok(TOOL);
  assertEq(data.sourcePresent, false, 'geen XER-bron');
  assertEq(data.selector.currentProjectId.length, LABEL_TRUNCATED_LENGTH, 'currentProjectId afgekapt op 200 tekens, ook zonder archief (R9)');
  assertEq(
    data.note,
    'Er is voor dit document geen retained XER-bronarchief beschikbaar.',
    'de statische systeemmelding blijft intact — die gaat bewust NIET door de vrije-tekstpoort (R9)',
  );
});

test('P2 (R8): sleutels in de generieke objecttak worden ook afgekapt en begroot', () => {
  attachArchive();
  const data = ok(TOOL);
  const catalogKeys = Object.keys(data.catalogCounts.taskSourceRowsByProject);
  const longKey = catalogKeys.find((k: string) => k.startsWith('P'.repeat(50)));
  assert(!!longKey, 'testopzet: de 80.000-tekens-project-id staat als sleutel in catalogCounts');
  assert(
    longKey!.length <= LABEL_TRUNCATED_LENGTH,
    `sleutel blijft afgekapt (kreeg ${longKey!.length} tekens), niet verbatim 80.000 (R8)`,
  );
  const availableMatch = data.selector.availableProjectIds.find((id: string) => id.startsWith('P'.repeat(50)));
  assert(!!availableMatch, 'testopzet: dezelfde project-id staat ook in availableProjectIds');
  assertEq(
    availableMatch.length,
    LABEL_TRUNCATED_LENGTH,
    'availableProjectIds (waarde-pad) was al afgekapt — nu consistent met de sleutel (R8)',
  );
});

// =================================================================================================
// Reviewronde 2 (review2-3d.md) — de EIGENSCHAP, niet drie losse paden.
// =================================================================================================

test('P1 #2: vrije tekst buiten rawRow verdwijnt zonder opt-in; labels blijven zichtbaar maar afgekapt', () => {
  attachArchive();

  // Vrije tekst (notes/description/customFields) — de SLEUTEL verdwijnt helemaal zonder opt-in,
  // niet slechts "afgekapt-maar-nog-zichtbaar".
  const roleClosed = ok(TOOL, { section: 'resourceCatalog', collection: 'roleSources', limit: 1 });
  assert(!('description' in roleClosed.items[0]), 'roleSources.description verdwijnt zonder opt-in');
  assert(!JSON.stringify(roleClosed).includes(FREE_TEXT_SECRET.slice(0, 50)), 'geen spoor van de vrije tekst zonder opt-in');
  // N2: geen van de zes alias-sleutels staat op een blocklist — alleen deny-by-default verbergt ze.
  for (const key of ALIAS_KEYS) {
    assert(!(key in roleClosed.items[0]), `roleSources.${key} verdwijnt zonder opt-in (alias-sleutel, N2)`);
  }
  assert(!JSON.stringify(roleClosed).includes(ALIAS_SECRET.slice(0, 30)), 'geen spoor van alias-sleutelinhoud zonder opt-in (N2)');

  const resourcesClosed = ok(TOOL, { section: 'resourceCatalog', collection: 'resources', limit: 1 });
  assert(!('description' in resourcesClosed.items[0]), 'resources.description verdwijnt zonder opt-in');
  assert(!JSON.stringify(resourcesClosed).includes(FREE_TEXT_SECRET.slice(0, 50)), 'geen spoor van de vrije tekst zonder opt-in');

  const projectionsClosed = ok(TOOL, { section: 'metadataCatalog', collection: 'taskProjections', limit: 1 });
  // `notes` is een objectarray (`{id,text,done}[]`, review2-3d.md N1): de array zelf blijft staan
  // (met het veilige `id`/`done`), maar het BLAD `text` — de eigenlijke notitietekst — verdwijnt.
  assertEq(projectionsClosed.items[0].notes[0].id, 'note-1', 'notes[].id (label) blijft zichtbaar');
  assert(!('text' in projectionsClosed.items[0].notes[0]), 'notes[].text verdwijnt zonder opt-in (N1)');
  assertEq(projectionsClosed.items[0].notes[0].done, false, 'notes[].done (boolean) blijft ongemoeid');
  assertEq(projectionsClosed.items[0].customFields.fieldCount, 1, 'customFields wordt een fieldCount-projectie, geen waarden');
  assert(!JSON.stringify(projectionsClosed).includes(FREE_TEXT_SECRET.slice(0, 50)), 'geen spoor van customFields-waarden zonder opt-in');

  // Met opt-in: de vrije tekst komt terug, maar afgekapt op 2.000 tekens — nooit de volle 9.000.
  const roleOpened = ok(TOOL, { section: 'resourceCatalog', collection: 'roleSources', limit: 1, includeRawRows: true });
  assertEq(roleOpened.items[0].description.length, LONG_CELL_TRUNCATED_LENGTH, 'description afgekapt op 2.000 tekens, niet de volle 9.000');
  assert(!JSON.stringify(roleOpened).includes(FREE_TEXT_SECRET), 'ook mét opt-in blijft de VOLLE 9.000-tekens-secret buiten bereik');
  for (const key of ALIAS_KEYS) {
    assertEq(roleOpened.items[0][key].length, LONG_CELL_TRUNCATED_LENGTH, `roleSources.${key} afgekapt op 2.000 tekens met opt-in (N2)`);
  }
  assert(!JSON.stringify(roleOpened).includes(ALIAS_SECRET), 'ook mét opt-in blijft de volle alias-sleutelinhoud buiten bereik (N2)');

  const projectionsOpened = ok(TOOL, { section: 'metadataCatalog', collection: 'taskProjections', limit: 1, includeRawRows: true });
  assertEq(projectionsOpened.items[0].notes[0].text.length, LONG_CELL_TRUNCATED_LENGTH, 'notes[].text afgekapt op 2.000 tekens met opt-in (N1)');
  assertEq(projectionsOpened.items[0].customFields['UDF-1'].length, LONG_CELL_TRUNCATED_LENGTH, 'customFields-waarde afgekapt op 2.000 tekens met opt-in');

  // Labels (namen buiten rawRow) blijven ALTIJD zichtbaar, met of zonder opt-in — maar hard afgekapt
  // op 200 tekens: "genormaliseerd" mag niet langer "onbegrensd" betekenen.
  const curvesClosed = ok(TOOL, { section: 'resourceCatalog', collection: 'curves', limit: 1 });
  assertEq(curvesClosed.items[0].name.length, LABEL_TRUNCATED_LENGTH, 'curves.name afgekapt op 200 tekens, altijd zichtbaar');
  assert(curvesClosed.items[0].name.startsWith('LABEL-SECRET-'), 'een label-prefix mag zichtbaar zijn (bewuste keuze, geen notitie)');

  const defsClosed = ok(TOOL, { section: 'metadataCatalog', collection: 'customFieldDefs', limit: 1 });
  assertEq(defsClosed.items[0].name.length, LABEL_TRUNCATED_LENGTH, 'customFieldDefs.name afgekapt op 200 tekens, altijd zichtbaar');
});

/** Loopt recursief door een respons en verzamelt elke stringwaarde. */
function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') { out.push(value); return; }
  if (Array.isArray(value)) { value.forEach((item) => collectStrings(item, out)); return; }
  if (value && typeof value === 'object') { Object.values(value as Record<string, unknown>).forEach((item) => collectStrings(item, out)); }
}

test('P1 #2: generieke walker — zonder opt-in geen string > 2.000 tekens en geen notitie-inhoud, over alle secties', () => {
  attachArchive();
  const calls: Array<[string, Record<string, unknown>]> = [
    ['summary', {}],
    ['resourceCatalog/resources', { section: 'resourceCatalog', collection: 'resources', limit: 10 }],
    ['resourceCatalog/roleSources', { section: 'resourceCatalog', collection: 'roleSources', limit: 10 }],
    ['resourceCatalog/curves', { section: 'resourceCatalog', collection: 'curves', limit: 10 }],
    ['resourceCatalog/resourceSources', { section: 'resourceCatalog', collection: 'resourceSources', limit: 10 }],
    ['metadataCatalog/customFieldDefs', { section: 'metadataCatalog', collection: 'customFieldDefs', limit: 10 }],
    ['metadataCatalog/taskProjections', { section: 'metadataCatalog', collection: 'taskProjections', limit: 10 }],
    ['metadataCatalog/TASKMEMO', { section: 'metadataCatalog', collection: 'TASKMEMO', limit: 10 }],
    ['taskSourceRowsByProject/PROJ-A', { section: 'taskSourceRowsByProject', projectId: 'PROJ-A', limit: 10 }],
    ['diagnostics/documentViews', { section: 'diagnostics', collection: 'documentViews', limit: 10 }],
    ['diagnostics/unknownFields', { section: 'diagnostics', collection: 'unknownFields', limit: 10 }],
    ['diagnostics/importReport', { section: 'diagnostics', collection: 'importReport' }],
  ];
  for (const [label, args] of calls) {
    const data = ok(TOOL, args);
    const strings: string[] = [];
    collectStrings(data, strings);
    assert(strings.length > 0, `${label}: testopzet — de respons moet minstens één string bevatten`);
    for (const value of strings) {
      assert(value.length <= 2000, `${label}: string van ${value.length} tekens overschrijdt de 2.000-tekens-grens zonder opt-in ("${value.slice(0, 40)}…")`);
      assert(!value.includes(FREE_TEXT_SECRET.slice(0, 50)), `${label}: bevat notitie-inhoud zonder includeRawRows`);
      // N2: dekt ook de zes alias-sleutels (roleSources) en, via taskProjections, geneste `notes[].text`.
      assert(!value.includes(ALIAS_SECRET.slice(0, 30)), `${label}: bevat alias-sleutelinhoud zonder includeRawRows`);
    }
  }
});

/** Reviewbevinding P1 #1 (review2-3d.md): de vorige documentViews-fixture was een handgeschreven
 *  stub (`{sourceProjectId, synthetic:true}`) die de productievorm niet had — de test was daardoor
 *  structureel blind voor het lek. Deze fixture gaat wél door de ECHTE lezer (`readXER`, via
 *  `reconstructXerSourceArchiveFromBytes`), corpusloos, met een bewust gigantische vrije cel in een
 *  TASKRSRC-kolom, zodat `documentViews[x].resources.assignments[].rawRow.cells` 'm ECHT draagt. */
const REAL_ARCHIVE_SECRET = 'REAL-SECRET-' + 'w'.repeat(50000);

function buildRealArchiveFixture(): XerSourceArchive {
  const source = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
    '%T\tCURRTYPE',
    '%F\tcurr_short_name\tdecimal_symbol\tdigit_group_symbol',
    '%R\tEUR\tcomma\tperiod',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    '%R\tP-REAL\tReal fixture project\tC\t2026-08-01 08:00',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC\tStandaard\t8\t40\t',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code',
    '%R\tT-REAL\tP-REAL\tA-1\tEchte taak\tC\t2026-08-01 08:00\t2026-08-01 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart',
    '%T\tRSRC',
    '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr',
    '%R\tR-REAL\tEchte resource\tRT_Labor\tC\t1',
    '%T\tTASKRSRC',
    '%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\ttarget_qty_per_hr\tremain_qty_per_hr\tremain_qty\ttarget_qty\tfree_secret_field',
    `%R\tAS-REAL\tP-REAL\tT-REAL\tR-REAL\t0,5\t0,5\t4\t4\t${REAL_ARCHIVE_SECRET}`,
    '%E',
  ].join('\r\n'));
  return reconstructXerSourceArchiveFromBytes(source);
}

/** Reviewbevinding #3/#6 (review2-3d.md): een rij met véél cellen (de `%F`-kolomkop van het
 *  bronbestand bepaalt dat aantal, dus een aanvaller-gecontroleerd bestand kan het opdrijven) mag
 *  geen tientallen-MB-tussenstring opbouwen vóór de responsgrens ingrijpt. 250 extra kolommen op
 *  ÉÉN TASKRSRC-rij, elk met een ruime vrije waarde. */
function buildManyCellsArchiveFixture(): XerSourceArchive {
  const extraColumnCount = 250;
  const extraFieldNames = Array.from({ length: extraColumnCount }, (_, index) => `extra_col_${index}`);
  const extraFieldValues = Array.from({ length: extraColumnCount }, (_, index) => `val${index}-${'q'.repeat(2500)}`);
  const source = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
    '%T\tCURRTYPE',
    '%F\tcurr_short_name\tdecimal_symbol\tdigit_group_symbol',
    '%R\tEUR\tcomma\tperiod',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    '%R\tP-MANYCELLS\tMany-cells fixture project\tC\t2026-08-01 08:00',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC\tStandaard\t8\t40\t',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code',
    '%R\tT-MANYCELLS\tP-MANYCELLS\tA-1\tGrote taak\tC\t2026-08-01 08:00\t2026-08-01 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart',
    '%T\tRSRC',
    '%F\trsrc_id\trsrc_name\trsrc_type\tclndr_id\tdef_qty_per_hr',
    '%R\tR-MANYCELLS\tGrote resource\tRT_Labor\tC\t1',
    '%T\tTASKRSRC',
    ['%F', 'taskrsrc_id', 'proj_id', 'task_id', 'rsrc_id', 'target_qty_per_hr', 'remain_qty_per_hr', 'remain_qty', 'target_qty', ...extraFieldNames].join('\t'),
    ['%R', 'AS-MANYCELLS', 'P-MANYCELLS', 'T-MANYCELLS', 'R-MANYCELLS', '0,5', '0,5', '4', '4', ...extraFieldValues].join('\t'),
    '%E',
  ].join('\r\n'));
  return reconstructXerSourceArchiveFromBytes(source);
}

function attachRealArchive(archive: XerSourceArchive, projectId: string): void {
  reset();
  S().setProject({ name: 'Real XER fixture project' });
  useAppStore.setState((state) => {
    state.xerSourceArchive = archive as any;
    state.xerSourceProjectId = projectId;
  });
}

test('P1 #1: diagnostics/documentViews gated net als de andere secties (echte lezer, geen stub)', () => {
  const archive = buildRealArchiveFixture();
  const view = archive.diagnostics.documentViews['P-REAL'] as any;
  assert(!!view?.resources?.assignments?.[0]?.rawRow, 'testopzet: de echte lezer levert een assignment-rawRow op');
  assert(view.resources.assignments[0].rawRow.cells.free_secret_field.includes('REAL-SECRET-'), 'testopzet: de secretkolom staat echt in de rawRow');
  attachRealArchive(archive, 'P-REAL');

  const closed = ok(TOOL, { section: 'diagnostics', collection: 'documentViews', limit: 1 });
  const closedStr = JSON.stringify(closed);
  assert(!closedStr.includes('REAL-SECRET-'), 'zonder opt-in mag de vrije TASKRSRC-cel niet verschijnen (P1 #1)');
  assert(closedStr.length < 5000, 'zonder opt-in blijft de documentview-pagina klein (geen 50.000-tekens-lek)');

  const opened = ok(TOOL, { section: 'diagnostics', collection: 'documentViews', limit: 1, includeRawRows: true });
  const openedStr = JSON.stringify(opened);
  assert(!openedStr.includes(REAL_ARCHIVE_SECRET), 'zelfs met opt-in blijft de cel afgekapt, nooit de volle 50.000 tekens');
  const cell = opened.items[0].view.resources.assignments[0].rawRow.cells.free_secret_field;
  assertEq(cell.length, LONG_CELL_TRUNCATED_LENGTH, 'afgekapt op exact dezelfde grens als de andere secties');
  assert(cell.startsWith('REAL-SECRET-'), 'het zichtbare prefix bevestigt dat dit dezelfde cel is');
});

test('P3 #6: cap op cellen per rij + budget-tijdens-projectie voorkomt een megabytes-tussenstring', () => {
  const archive = buildManyCellsArchiveFixture();
  const view = archive.diagnostics.documentViews['P-MANYCELLS'] as any;
  assertEq(Object.keys(view.resources.assignments[0].rawRow.cells).length, 258, 'testopzet: 250 extra + 8 kernvelden');
  attachRealArchive(archive, 'P-MANYCELLS');

  // 258 cellen × ~2.026 afgekapte tekens zou zonder cap/budget ruim boven de 256 kB-responsgrens
  // uitkomen — de fix moet dit AL TIJDENS de projectie afvangen (P3 #6), niet pas na een dure
  // volledige serialisatie.
  const tooMany = err(TOOL, { section: 'diagnostics', collection: 'documentViews', limit: 1, includeRawRows: true });
  assertEq(tooMany.code, 'VALIDATION', 'responsgrens grijpt in vóór de respons de deur uit gaat');
  assert(/responsgrens|limit/.test(tooMany.error), 'foutmelding hint naar limit/offset');

  // Zonder opt-in blijft de pagina klein — de cap/budget speelt alleen mee zodra celinhoud
  // daadwerkelijk wordt uitgelezen. (De 250 onbekende TASKRSRC-kolommen leveren wél 250 kleine
  // `unknownFields`-diagnostiekregels op — legitiem en ver onder de responsgrens, vandaar de
  // ruimere marge dan bij de andere "zonder opt-in blijft klein"-asserties in dit bestand.)
  const closed = ok(TOOL, { section: 'diagnostics', collection: 'documentViews', limit: 1 });
  const closedLength = JSON.stringify(closed).length;
  assert(closedLength < 50000, `zonder opt-in blijft de pagina klein ongeacht het celaantal, kreeg ${closedLength}`);
});

test('P2 #4: de responsgrens meet ECHTE UTF-8-bytes, niet UTF-16-code-units (CJK)', () => {
  attachArchive();
  // 50 rijen × 2.000 CJK-tekens = 100.000 code-units (ver onder de oude "String.length"-grens) maar
  // ≈ 300.000 ECHTE bytes (boven de 262.144-bytesgrens). Vóór de fix zou dit zijn DOORGELATEN.
  const tooManyBytes = err(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-CJK', includeRawRows: true, limit: 50 });
  assertEq(tooManyBytes.code, 'VALIDATION', 'CJK-pagina met te veel ECHTE bytes wordt geweigerd');

  // Een kleinere pagina (10 rijen × 2.000 CJK-tekens ≈ 60.000 bytes) blijft ruim onder de grens.
  const smaller = ok(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-CJK', includeRawRows: true, limit: 10 });
  assertEq(smaller.items.length, 10, 'kleinere CJK-pagina blijft toegestaan');
});

test('P2 #5: één selectorbron — een project alleen in taskSourceRowsByProject is toch bereikbaar', () => {
  attachArchive();
  const summaryData = ok(TOOL);
  assert(
    summaryData.selector.availableProjectIds.includes('PROJ-ONLY-IN-TASKROWS'),
    'summary adverteert het project (unie van documentViews én taskSourceRowsByProject)',
  );
  const rows = ok(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-ONLY-IN-TASKROWS', limit: 10 });
  assertEq(rows.total, 1, 'de tool accepteert exact het project dat de summary adverteert — geen zelftegenspraak meer');
});

test('P2 #5 (N5): rijdetectie op vorm (line + string-cells), niet op exact 2 sleutels', () => {
  attachArchive();
  const closed = ok(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-SHAPE', limit: 1 });
  // Vóór de fix viel een 3-sleutelrij (zoals XerScheduleOptionsSourceRow: {table,line,cells}) door
  // naar de generieke objecttak: `cells` werd dan een gewoon record en elke celwaarde kwam als LABEL
  // naar buiten — afgekapt, maar wél ZICHTBAAR zonder opt-in. Fail-open. Nu: fieldCount, geen cellen.
  assert(!('cells' in closed.items[0]), 'cellen blijven volledig weg zonder opt-in, ook bij een 3-sleutelrij (N5)');
  assertEq(closed.items[0].fieldCount, 1, 'fieldCount i.p.v. cellen (N5)');
  assertEq(closed.items[0].table, 'PROJECT', 'overige velden (table) blijven gewoon zichtbaar als label (N5)');
  assert(!JSON.stringify(closed).includes(N5_SECRET.slice(0, 50)), 'geen spoor van de bronrij-inhoud zonder opt-in (N5)');

  const opened = ok(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-SHAPE', limit: 1, includeRawRows: true });
  assertEq(opened.items[0].cells.secret_col.length, LONG_CELL_TRUNCATED_LENGTH, 'met opt-in: cel afgekapt op 2.000 tekens, niet leesbaar als los label (N5)');
});

test('P2 #4 (N4): cel-/veldNAMEN worden afgekapt én meegeteld in het budget', () => {
  attachArchive();
  const opened = ok(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-LONGKEY', includeRawRows: true, limit: 1 });
  const keys = Object.keys(opened.items[0].cells);
  assertEq(keys.length, 1, 'testopzet: precies één cel');
  assert(keys[0].length <= LABEL_TRUNCATED_LENGTH, `kolomnaam blijft afgekapt (kreeg ${keys[0].length} tekens), niet verbatim 60.001 (N4)`);

  // 10 rijen × 200 cellen met LANGE kolomnamen maar TRIVIALE waarden: zonder key-begroting zou de
  // teller hier bijna niets zien. De weigering hoort van de budget-tijdens-projectie te komen (dus
  // GEEN "geserialiseerd" in de melding — spiegelt de M4-pinningtest hieronder).
  const tooManyLongKeys = err(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-LONGKEY-BUDGET', includeRawRows: true, limit: 10 });
  assertEq(tooManyLongKeys.code, 'VALIDATION', 'lange kolomnamen alléén (triviale waarden) raken de responsgrens (N4)');
  assert(!tooManyLongKeys.error.includes('geserialiseerd'), 'de weigering komt van de budget-tijdens-projectie (kolomnamen tellen mee), niet pas van finalizeBounded (N4)');
});

test('P3 (M4): het ByteBudget-effect is gepind — de weigering komt van vóór, niet ná, de serialisatie', () => {
  attachArchive();
  // `PROJ-BIG` (100 rijen × 3 cellen van 3.000 tekens) is groot genoeg om de budget-teller AL TIJDENS
  // de projectie te laten afbreken, ruim vóór de dure volledige `JSON.stringify` in `finalizeBounded`.
  // De twee foutmeldingen verschillen bewust in tekst (`createByteBudget` mist "geserialiseerd",
  // `finalizeBounded` heeft het wél) — dat verschil is hier de gepinde eigenschap. Mutatiebewijs:
  // schakel de `ByteBudget`-drempel uit en dezelfde aanroep krijgt de finalizeBounded-tekst (`.includes`
  // wordt `true`), dus déze assertie kantelt — precies het gat dat de review aanwees (M4: 0 tests rood
  // toen de budgetdrempel alleen werd uitgeschakeld).
  const tooLarge = err(TOOL, { section: 'taskSourceRowsByProject', projectId: 'PROJ-BIG', includeRawRows: true, limit: 100 });
  assertEq(tooLarge.code, 'VALIDATION', 'responsgrens grijpt in');
  assert(!tooLarge.error.includes('geserialiseerd'), 'de weigering komt van de budget-tijdens-projectie, vóór volledige serialisatie (M4)');
});

test('P3 #8: loopt via de ECHTE dispatch-weg (handleMcpMessage), niet alleen def.handler', async () => {
  attachArchive();
  const dispatchCtx = makeMcpContext(undefined, { expectedDocId: S().activeDocumentId });
  const rpcCall = async (args: unknown) => {
    const raw = await handleMcpMessage(
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: TOOL, arguments: args } }),
      dispatchCtx,
    );
    return JSON.parse(raw);
  };

  const badLimitType = await rpcCall({ limit: '5' });
  assert(badLimitType.result?.isError === true, 'de schemapoort in de dispatcher weigert limit als string');
  assertEq(badLimitType.result.structuredContent.code, 'VALIDATION', 'VALIDATION via de dispatcher (limit)');

  const badIncludeRawRowsType = await rpcCall({ includeRawRows: 'yes' });
  assert(badIncludeRawRowsType.result?.isError === true, 'de schemapoort weigert includeRawRows als string');
  assertEq(badIncludeRawRowsType.result.structuredContent.code, 'VALIDATION', 'VALIDATION via de dispatcher (includeRawRows)');

  const validCall = await rpcCall({ section: 'summary' });
  assertEq(validCall.result?.isError, false, 'een geldige summary-call passeert de dispatcher ongehinderd');
});

await run();
