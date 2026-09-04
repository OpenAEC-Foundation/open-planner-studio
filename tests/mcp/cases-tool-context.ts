// Plan 2, Task 5 — mechanisch en gedragsmatig bewijs dat de volledige MCP-tooltree zijn
// requestcontext gebruikt. Nulmeting vóór deze migratie (2026-08-25): alle tien modules hieronder
// importeerden `useAppStore` en/of `@/state/mcpTransaction`:
// baselineTools, batchTool, calendarResourceTools, dependencyTools, documentTools, fileTools,
// helpers, readTools, resourceTools en taskTools.

import {
  appStoreContext,
  makeMcpContext,
  useAppStore,
  test,
  assert,
  assertEq,
  run,
} from './harness';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';
import type { McpContext, McpToolDef, McpToolResult } from '@/services/mcp/contracts';
import { baselineTools } from '@/services/mcp/tools/baselineTools';
import { batchTools } from '@/services/mcp/tools/batchTool';
import { calendarResourceTools } from '@/services/mcp/tools/calendarResourceTools';
import { dependencyTools } from '@/services/mcp/tools/dependencyTools';
import { documentTools } from '@/services/mcp/tools/documentTools';
import { fileToolDeps, fileTools, type McpFileFs } from '@/services/mcp/tools/fileTools';
import { readTools } from '@/services/mcp/tools/readTools';
import { resourceTools } from '@/services/mcp/tools/resourceTools';
import { taskTools } from '@/services/mcp/tools/taskTools';
import { registerAllTools } from '@/services/mcp/toolRegistry';

interface Fixture {
  A: AppStoreContext;
  B: AppStoreContext;
  ctxB: McpContext;
  aBefore: string;
}

function plainState(app: AppStoreContext): string {
  const state = app.store.getState();
  return JSON.stringify({
    document: capturePayload(state),
    historyEvents: state.historyEvents,
    nextHistorySequence: state.nextHistorySequence,
    selectedTaskIds: state.selectedTaskIds,
    notifications: state.ui.notifications,
  });
}

function fixture(label: string): Fixture {
  useAppStore.getState().newProject();
  const A = appStoreContext;
  A.store.getState().setProject({ name: `Context A ${label}` });
  A.store.getState().ensureProjectCalendarInLibrary();

  const B = createAppStoreContext();
  B.store.getState().setProject({ name: `Context B ${label}` });
  B.store.getState().ensureProjectCalendarInLibrary();
  const ctxB = makeMcpContext(B, {
    expectedDocId: B.store.getState().activeDocumentId,
    ensureBackup: async () => null,
  });
  return { A, B, ctxB, aBefore: plainState(A) };
}

function tool(defs: McpToolDef[], name: string): McpToolDef {
  const found = defs.find((def) => def.name === name);
  if (!found) throw new Error(`testvoorwaarde: tool '${name}' ontbreekt`);
  return found;
}

async function call(defs: McpToolDef[], name: string, args: unknown, ctx: McpContext): Promise<McpToolResult> {
  return await tool(defs, name).handler(args, ctx);
}

function assertAUnchanged(f: Fixture, message: string): void {
  assertEq(plainState(f.A), f.aBefore, message);
}

test('readTools en baselineTools lezen response en envelop uit B; A blijft exact gelijk', async () => {
  const f = fixture('read');
  f.B.store.getState().runCPM();
  f.B.store.getState().saveBaseline('Baseline B');

  const info = await call(readTools, 'planner_get_project_info', {}, f.ctxB);
  const baselines = await call(baselineTools, 'planner_list_baselines', {}, f.ctxB);

  assert(info.ok && (info.data as { project: { name: string } }).project.name === 'Context B read',
    'project-info hoort de projectnaam uit B te lezen');
  assert(info.ok && info.envelope.documentTitle === 'Context B read',
    'de read-envelop hoort B te beschrijven');
  assert(baselines.ok && (baselines.data as { baselines: Array<{ name: string }> }).baselines[0]?.name === 'Baseline B',
    'baseline-list hoort de baseline uit B te lezen');
  assertAUnchanged(f, 'readclusters mogen A niet wijzigen');
});

test('taskTools muteert uitsluitend B', async () => {
  const f = fixture('tasks');
  const result = await call(taskTools, 'planner_add_tasks', {
    tasks: [{ tempId: 'tmp-context-b', name: 'Taak in B', duration: 2 }],
  }, f.ctxB);

  assert(result.ok && f.B.store.getState().tasks.some((task) => task.name === 'Taak in B'),
    'planner_add_tasks hoort de taak in B te maken');
  assertAUnchanged(f, 'taskTools mag A niet wijzigen');
});

test('dependencyTools leest en muteert uitsluitend B', async () => {
  const f = fixture('dependencies');
  const pred = f.B.store.getState().addTask({ name: 'B voorganger' });
  const succ = f.B.store.getState().addTask({ name: 'B opvolger' });
  const seqId = f.B.store.getState().addSequence({
    predecessorId: pred,
    successorId: succ,
    type: 'FINISH_START',
    lagDays: 0,
  });
  f.aBefore = plainState(f.A);

  const result = await call(dependencyTools, 'planner_update_dependencies', {
    updates: [{ seqId, lag: 2 }],
  }, f.ctxB);

  assert(result.ok && f.B.store.getState().sequences.find((seq) => seq.id === seqId)?.lagDays === 2,
    'planner_update_dependencies hoort alleen B\'s relatie te wijzigen');
  assertAUnchanged(f, 'dependencyTools mag A niet wijzigen');
});

test('resourceTools muteert uitsluitend B', async () => {
  const f = fixture('resources');
  const result = await call(resourceTools, 'planner_manage_resources', {
    actions: [{ action: 'create', tempId: 'tmp-resource-b', name: 'Resource B', type: 'LABOR', maxUnits: 1 }],
  }, f.ctxB);

  assert(result.ok && f.B.store.getState().resources.some((resource) => resource.name === 'Resource B'),
    'planner_manage_resources hoort de resource in B te maken');
  assertAUnchanged(f, 'resourceTools mag A niet wijzigen');
});

test('calendarResourceTools muteert uitsluitend B', async () => {
  const f = fixture('project');
  const result = await call(calendarResourceTools, 'planner_update_project', {
    description: 'Beschrijving alleen in B',
  }, f.ctxB);

  assert(result.ok && f.B.store.getState().project.description === 'Beschrijving alleen in B',
    'planner_update_project hoort B te wijzigen');
  assertAUnchanged(f, 'calendarResourceTools mag A niet wijzigen');
});

test('baselineTools muteert uitsluitend B', async () => {
  const f = fixture('baseline-mutate');
  f.B.store.getState().runCPM();
  const baselineId = f.B.store.getState().saveBaseline('Oude B-baseline');
  f.aBefore = plainState(f.A);

  const result = await call(baselineTools, 'planner_rename_baseline', {
    baselineId,
    name: 'Nieuwe B-baseline',
  }, f.ctxB);

  assert(result.ok && f.B.store.getState().baselines.find((baseline) => baseline.id === baselineId)?.name === 'Nieuwe B-baseline',
    'planner_rename_baseline hoort B te wijzigen');
  assertAUnchanged(f, 'baselineTools mag A niet wijzigen');
});

test('batchTool houdt stappen, drafts en recompute uitsluitend in B', async () => {
  registerAllTools();
  const f = fixture('batch');
  const result = await call(batchTools, 'planner_batch', {
    steps: [
      { tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-batch-b', name: 'Batchtaak B' }] } },
      { tool: 'planner_update_project', args: { company: 'Bedrijf B' } },
    ],
  }, f.ctxB);

  assert(result.ok && f.B.store.getState().tasks.some((task) => task.name === 'Batchtaak B'),
    'de batchtaak hoort in B te staan');
  assert(result.ok && f.B.store.getState().project.company === 'Bedrijf B',
    'de batchprojectwijziging hoort in B te staan');
  assertAUnchanged(f, 'batchTool mag A niet wijzigen');
});

test('documentTools leest en maakt documenten uitsluitend in B', async () => {
  const f = fixture('documents');
  const beforeCount = f.B.store.getState().documents.length;
  const listed = await call(documentTools, 'planner_list_documents', {}, f.ctxB);
  const created = await call(documentTools, 'planner_new_document', {}, f.ctxB);

  assert(listed.ok && (listed.data as { documents: Array<{ title: string }> }).documents[0]?.title === 'Context B documents',
    'planner_list_documents hoort B te lezen');
  assert(created.ok && f.B.store.getState().documents.length === beforeCount + 1,
    'planner_new_document hoort een document in B te maken');
  assertAUnchanged(f, 'documentTools mag A niet wijzigen');
});

test('fileTools exporteert de IFC-state uit B en laat A exact gelijk', async () => {
  const f = fixture('bestand');
  f.B.store.getState().addTask({ name: 'Bestandstaak B' });
  f.B.store.getState().runCPM();
  f.aBefore = plainState(f.A);
  let written = '';
  const fakeFs: McpFileFs = {
    homeDir: async () => '/home/test',
    exists: async () => false,
    writeTextFile: async (_path, content) => { written = content; },
    readTextFile: async () => '',
    readFile: async () => new Uint8Array(),
  };
  const previousGetFs = fileToolDeps.getFs;
  fileToolDeps.getFs = async () => fakeFs;
  try {
    const result = await call(fileTools, 'planner_export_ifc', {
      path: '/home/test/context-b.ifc',
    }, f.ctxB);
    assert(result.ok, 'planner_export_ifc hoort met de fake fs te slagen');
    assert(written.includes('Context B bestand') && written.includes('Bestandstaak B'),
      'de geschreven IFC hoort project en taak uit B te bevatten');
    assert(!written.includes('Context A bestand'), 'de geschreven IFC mag geen projectdata uit A bevatten');
  } finally {
    fileToolDeps.getFs = previousGetFs;
  }
  assertAUnchanged(f, 'fileTools mag A niet wijzigen');
});

await run();
