// Onderhoudbaarheidsprogramma 2, Task 8 — volledige twee-store MCP-matrix.
//
// Dit is bewust één genormaliseerde bewijsbatterij bovenop de kleinere eigenaarstests uit Task 3–6.
// Elke fixture heeft echte documentdata, kalendercache+bibliotheek, resource/toewijzing, historie en
// meldingen. Vergelijkingen nemen niet alleen het actieve DocumentPayload mee, maar ook registry en
// appglobale velden die een singletonlek zichtbaar maken. Maps/Sets worden stabiel geserialiseerd.
import {
  appStoreContext,
  makeMcpContext,
  useAppStore,
  test,
  assert,
  assertEq,
  run,
} from './harness';
import {
  createAppStoreContext,
  type AppStoreContext,
} from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';
import {
  createMcpTransactions,
  type McpTransactions,
} from '@/state/runtime/createMcpTransactions';
import { draft, runInMcpTransaction } from '@/state/mcpTransaction';
import {
  McpStepError,
  runMutateTool,
} from '@/services/mcp/tools/runtime';
import { buildMcpContext } from '@/services/mcp/server';
import { __resetTimephasedLossNoticeForTests } from '@/state/timephasedLossNotice';
import type { McpContext, McpErrorCode, McpToolResult } from '@/services/mcp/contracts';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';

type Stable = null | boolean | number | string | Stable[] | { [key: string]: Stable };

/** JSON-stabiele kopie die ook aanwezigheid van undefined en inhoud van Map/Set bewaart. */
function stable(value: unknown): Stable {
  if (value === undefined) return { $undefined: true };
  if (value === null || typeof value === 'boolean' || typeof value === 'number'
      || typeof value === 'string') return value;
  if (value instanceof Map) {
    const entries = [...value.entries()].map(([key, item]) => [stable(key), stable(item)] as const);
    entries.sort((a, b) => JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0])));
    return { $map: entries as unknown as Stable[] };
  }
  if (value instanceof Set) {
    const values = [...value.values()].map(stable);
    values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return { $set: values };
  }
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === 'object') {
    const result: Record<string, Stable> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (typeof item !== 'function' && typeof item !== 'symbol') result[key] = stable(item);
    }
    return result;
  }
  return { $unsupported: typeof value };
}

/**
 * Volledige relevante toestand voor bytevergelijking. `capturePayload` is de documentbron; de
 * overige velden zijn juist de niet-documentgebonden grenzen waarop een contextlek zichtbaar wordt.
 */
function plainState(app: AppStoreContext): Stable {
  const state = app.store.getState();
  return stable({
    document: capturePayload(state),
    documents: state.documents,
    activeDocumentId: state.activeDocumentId,
    historyEvents: state.historyEvents,
    nextHistorySequence: state.nextHistorySequence,
    taskClipboard: state.taskClipboard,
    ui: {
      notifications: state.ui.notifications,
      aiPaused: state.ui.aiPaused,
      aiReadOnly: state.ui.aiReadOnly,
    },
  });
}

function firstDifference(actual: Stable, expected: Stable, path = '$'): string | null {
  if (Object.is(actual, expected)) return null;
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') {
    return `${path}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`;
  }
  if (Array.isArray(actual) !== Array.isArray(expected)) return `${path}: objectvorm verschilt`;
  const actualRecord = actual as Stable[] | Record<string, Stable>;
  const expectedRecord = expected as Stable[] | Record<string, Stable>;
  const actualKeys = Object.keys(actualRecord);
  const expectedKeys = Object.keys(expectedRecord);
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    return `${path}: sleutels verwacht ${JSON.stringify(expectedKeys)}, kreeg ${JSON.stringify(actualKeys)}`;
  }
  for (const key of expectedKeys) {
    const difference = firstDifference(
      (actualRecord as Record<string, Stable>)[key],
      (expectedRecord as Record<string, Stable>)[key],
      `${path}.${key}`,
    );
    if (difference) return difference;
  }
  return null;
}

function assertPlainEq(actual: Stable, expected: Stable, message: string): void {
  const difference = firstDifference(actual, expected);
  assert(!difference, `${message}${difference ? `\n  eerste afwijking: ${difference}` : ''}`);
}

interface SeededContext {
  app: AppStoreContext;
  label: string;
  docId: string;
  taskId: string;
  resourceId: string;
  assignmentId: string;
}

function seedContext(label: string): SeededContext {
  const app = createAppStoreContext();
  const docId = `doc-${label}`;
  app.store.setState((state) => {
    state.activeDocumentId = docId;
    state.documents = [{ id: docId, payload: null }];
    state.project.id = `project-${label}`;
    state.project.name = `Project ${label}`;
    state.project.startDate = '2026-08-03';
    state.project.modifiedAt = '2026-08-25T00:00:00.000Z';
  });
  app.store.getState().ensureProjectCalendarInLibrary();
  const taskId = app.store.getState().addTask({ name: `Taak ${label}` });
  const resourceId = app.store.getState().addResource({
    name: `Resource ${label}`,
    description: `Eigen resource ${label}`,
    type: 'LABOR',
    maxUnits: 1,
  });
  app.store.getState().assignResource(taskId, resourceId, 1);
  const assignmentId = app.store.getState().assignments.find(
    (assignment) => assignment.taskId === taskId && assignment.resourceId === resourceId,
  )?.id;
  if (!assignmentId) throw new Error(`testvoorwaarde: toewijzing ${label} ontbreekt`);
  app.store.getState().runCPM();
  app.store.setState((state) => {
    state.ui.notifications = [{
      id: `note-${label}`,
      severity: 'info',
      messageKey: 'notifications.templateSaved',
      params: { label },
      count: 1,
    }];
    state.taskClipboard = null;
  });
  app.runtime.resetUndoCoalescing();
  app.store.getState().updateTask(taskId, { description: `History-seed ${label}` });
  app.store.getState().undo();
  app.runtime.resetUndoCoalescing();
  return { app, label, docId, taskId, resourceId, assignmentId };
}

interface PairFixture {
  A: SeededContext;
  B: SeededContext;
  ctxB: McpContext;
}

function pair(label: string): PairFixture {
  const A = seedContext(`A-${label}`);
  const B = seedContext(`B-${label}`);
  return {
    A,
    B,
    ctxB: makeMcpContext(B.app, {
      expectedDocId: B.docId,
      ensureBackup: async () => null,
    }),
  };
}

const stackDepths = (app: AppStoreContext) => ({
  undo: historyDepthsForActiveScope(app.store.getState()).undoDepth,
  redo: historyDepthsForActiveScope(app.store.getState()).redoDepth,
});

function expectError(result: McpToolResult, code: McpErrorCode, label: string): void {
  assert(!result.ok, `${label}: mutatie hoort te falen`);
  if (!result.ok) assertEq(result.code, code, `${label}: foutcode`);
}

// ── Succesmatrix ────────────────────────────────────────────────────────────────────────────────

test('succes op B: taak, relatie, resource, toewijzing en kalender committen éénmaal; A blijft exact', async () => {
  const f = pair('success');
  const aBefore = plainState(f.A.app);
  const bUndoBefore = historyDepthsForActiveScope(f.B.app.store.getState()).undoDepth;
  const originalRunCPM = f.B.app.store.getState().runCPM;
  let bRunCPMCalls = 0;
  f.B.app.store.setState({
    runCPM: () => {
      bRunCPMCalls++;
      originalRunCPM();
    },
  });

  const result = await runMutateTool(f.ctxB, 'mutate', () => {
    const secondTaskId = f.ctxB.transactions.draft.addTask({ name: 'Nieuwe B-taak' });
    const sequenceId = f.ctxB.transactions.draft.addSequence({
      predecessorId: f.B.taskId,
      successorId: secondTaskId,
      type: 'FINISH_START',
      lagDays: 0,
    });
    if (!sequenceId) throw new Error('testvoorwaarde: B-relatie is geweigerd');
    const secondResourceId = f.ctxB.transactions.draft.addResource({
      name: 'Nieuwe B-resource',
      description: '',
      type: 'EQUIPMENT',
      maxUnits: 2,
    });
    const assignmentId = f.ctxB.transactions.draft.assignResource(
      secondTaskId,
      secondResourceId,
      0.5,
    );
    const { id: _calendarId, ...calendarTemplate } = f.B.app.store.getState().calendar;
    const calendarId = f.ctxB.transactions.draft.addCalendar({
      ...calendarTemplate,
      name: 'Nieuwe B-kalender',
    });
    return {
      data: { secondTaskId, sequenceId, secondResourceId, assignmentId, calendarId },
    };
  });

  assert(result.ok, 'de samengestelde B-mutatie hoort te slagen');
  if (!result.ok) return;
  const data = result.data as Record<string, string>;
  const state = f.B.app.store.getState();
  assert(state.tasks.some((task) => task.id === data.secondTaskId), 'de nieuwe taak hoort in B');
  assert(state.sequences.some((sequence) => sequence.id === data.sequenceId), 'de relatie hoort in B');
  assert(state.resources.some((resource) => resource.id === data.secondResourceId), 'de resource hoort in B');
  assert(state.assignments.some((assignment) => assignment.id === data.assignmentId), 'de toewijzing hoort in B');
  assert(state.calendars.some((calendar) => calendar.id === data.calendarId), 'de kalender hoort in B');
  assertEq(historyDepthsForActiveScope(state).undoDepth, bUndoBefore + 1,
    'B krijgt exact één undo voor de hele mutatie');
  assertEq(historyDepthsForActiveScope(state).redoDepth, 0,
    'B-redo wordt door de geslaagde mutatie gewist');
  assertEq(bRunCPMCalls, 1, 'de B-transactie herrekent exact éénmaal');
  assert(state.cpmResult !== null && !state.cpmResult.error, 'B heeft één geldige recompute-uitkomst');
  assertEq(result.envelope.activeDocumentId, f.B.docId, 'de envelop draagt B-document-id');
  assertEq(result.envelope.documentTitle, `Project ${f.B.label}`, 'de envelop draagt B-titel');
  assertEq(result.envelope.scheduleStale, false, 'de B-envelop is na de eindsolve vers');
  assertEq(plainState(f.A.app), aBefore, 'succes op B laat A volledig bytegelijk');
});

// ── Vier rollbackoorzaken ────────────────────────────────────────────────────────────────────────

const rollbackCases: {
  label: string;
  code: McpErrorCode;
  mutate: (f: PairFixture) => void;
}[] = [
  {
    label: 'draftthrow',
    code: 'VALIDATION',
    mutate: (f) => {
      f.ctxB.transactions.draft.addTask({ name: 'Verdwijnt na draftthrow' });
      throw new Error('draftthrow met opzet');
    },
  },
  {
    label: 'expliciete McpStepError',
    code: 'NOT_FOUND',
    mutate: (f) => {
      f.ctxB.transactions.draft.addTask({ name: 'Verdwijnt na step error' });
      throw new McpStepError('NOT_FOUND', 'expliciete stapfout met opzet');
    },
  },
  {
    label: 'solvercycle',
    code: 'CYCLE',
    mutate: (f) => {
      const second = f.ctxB.transactions.draft.addTask({ name: 'Cyclische B-taak' });
      f.ctxB.transactions.draft.addSequence({
        predecessorId: f.B.taskId,
        successorId: second,
        type: 'FINISH_START',
        lagDays: 0,
      });
      f.ctxB.transactions.draft.addSequence({
        predecessorId: second,
        successorId: f.B.taskId,
        type: 'FINISH_START',
        lagDays: 0,
      });
    },
  },
  {
    label: 'nested run op dezelfde context',
    code: 'VALIDATION',
    mutate: (f) => {
      f.ctxB.transactions.draft.addTask({ name: 'Outer B-taak verdwijnt' });
      f.ctxB.transactions.run(() => {
        f.ctxB.transactions.draft.addTask({ name: 'Inner B-taak mag nooit ontstaan' });
      });
    },
  },
];

for (const rollbackCase of rollbackCases) {
  test(`rollback ${rollbackCase.label}: B en historie exact terug; A gelijk; B daarna bruikbaar`, async () => {
    const f = pair(`rollback-${rollbackCase.label.replace(/ /g, '-')}`);
    const aBefore = plainState(f.A.app);
    const bBefore = plainState(f.B.app);
    const result = await runMutateTool(f.ctxB, 'mutate', () => {
      rollbackCase.mutate(f);
      return { data: null };
    });

    expectError(result, rollbackCase.code, rollbackCase.label);
    assertPlainEq(plainState(f.B.app), bBefore,
      `${rollbackCase.label}: B inclusief undo/redo is exact hersteld`);
    assertPlainEq(plainState(f.A.app), aBefore, `${rollbackCase.label}: A blijft volledig bytegelijk`);

    const undoAfterRollback = historyDepthsForActiveScope(f.B.app.store.getState()).undoDepth;
    f.B.app.store.getState().updateTask(
      f.B.taskId,
      { description: `bruikbaar na ${rollbackCase.label}` },
      { coalesceKey: 'task.description' },
    );
    assertEq(historyDepthsForActiveScope(f.B.app.store.getState()).undoDepth, undoAfterRollback + 1,
      `${rollbackCase.label}: suppressie is dicht en coalescing begint een nieuwe stap`);
    const reuse = f.ctxB.transactions.run(() => {
      f.ctxB.transactions.draft.updateTaskFields(f.B.taskId, { priority: 321 });
    });
    assert(reuse.ok, `${rollbackCase.label}: dezelfde B-runtime is opnieuw bruikbaar`);
    assertEq(plainState(f.A.app), aBefore, `${rollbackCase.label}: ook hergebruik van B raakt A niet`);
  });
}

// ── Lease en reentrancy ──────────────────────────────────────────────────────────────────────────

test('verkeerde of gesloten lease kan een actieve outer lease niet vrijgeven', () => {
  const context = seedContext('lease-identity').app;
  const lease = context.runtime.enterMcpTransaction();
  const wrong = { token: Symbol('verkeerde-lease') };
  let wrongRejected = false;
  try {
    context.runtime.exitMcpTransaction(wrong);
  } catch {
    wrongRejected = true;
  }
  assert(wrongRejected, 'een verkeerde lease hoort te worden geweigerd');
  let stillActive = false;
  try {
    context.runtime.enterMcpTransaction();
  } catch (error) {
    stillActive = /herintreedbaar/i.test(error instanceof Error ? error.message : String(error));
  }
  assert(stillActive, 'na de verkeerde exit hoort de echte outer lease nog actief te zijn');
  context.runtime.exitMcpTransaction(lease);

  let closedRejected = false;
  try {
    context.runtime.exitMcpTransaction(lease);
  } catch {
    closedRejected = true;
  }
  assert(closedRejected, 'de reeds gesloten lease hoort niet nogmaals vrij te kunnen geven');
  const next = context.runtime.enterMcpTransaction();
  context.runtime.exitMcpTransaction(next);
});

function assertNestedRollback(
  label: string,
  B: SeededContext,
  outer: McpTransactions,
  inner: McpTransactions,
): void {
  const before = plainState(B.app);
  const result = outer.run(() => {
    outer.draft.addTask({ name: `${label} outer` });
    inner.run(() => inner.draft.addTask({ name: `${label} inner` }));
  });
  assert(!result.ok && /herintreedbaar/i.test(result.error),
    `${label}: nested enter moet als throw de outer callback bereiken`);
  assertEq(plainState(B.app), before, `${label}: outer rollback herstelt B volledig`);
  const reuse = inner.run(() => inner.draft.addTask({ name: `${label} hergebruik` }));
  assert(reuse.ok, `${label}: B is na het eigen finally weer bruikbaar`);
}

test('reentrancy is niet te omzeilen via hetzelfde object of een tweede factory', () => {
  const same = seedContext('nested-same');
  const txSame = createMcpTransactions(same.app);
  assertNestedRollback('zelfde factory', same, txSame, txSame);

  const split = seedContext('nested-split');
  assertNestedRollback(
    'twee factories',
    split,
    createMcpTransactions(split.app),
    createMcpTransactions(split.app),
  );
});

test('twee buildMcpContext(B)-resultaten delen dezelfde runtimeguard', () => {
  const B = seedContext('nested-server-context');
  const backup = { ensureBackup: async () => null, markDuplicateBorn: () => {} };
  const first = buildMcpContext(B.app, undefined, backup);
  const second = buildMcpContext(B.app, undefined, backup);
  assert(first.transactions !== second.transactions, 'voorwaarde: contexts hebben losse factoryobjecten');
  assertNestedRollback('twee servercontexts', B, first.transactions, second.transactions);
});

test('A kan synchroon binnen B committen; na gefaalde B-run blijven eerst A en daarna B bruikbaar', () => {
  const f = pair('cross-context-reuse');
  const txA = createMcpTransactions(f.A.app);
  const txB = createMcpTransactions(f.B.app);
  const aUndoBefore = historyDepthsForActiveScope(f.A.app.store.getState()).undoDepth;
  const bUndoBefore = historyDepthsForActiveScope(f.B.app.store.getState()).undoDepth;
  const cross = txB.run(() => {
    const bId = txB.draft.addTask({ name: 'B outer commit' });
    const aResult = txA.run(() => txA.draft.addTask({ name: 'A inner commit' }));
    if (!aResult.ok) throw new Error(aResult.error);
    return { aId: aResult.value, bId };
  });
  assert(cross.ok, 'A-in-B hoort contextlokaal toegestaan te zijn');
  assertEq(historyDepthsForActiveScope(f.A.app.store.getState()).undoDepth, aUndoBefore + 1,
    'A krijgt één eigen undo');
  assertEq(historyDepthsForActiveScope(f.B.app.store.getState()).undoDepth, bUndoBefore + 1,
    'B krijgt één eigen undo');

  const failed = txB.run(() => {
    txB.draft.addTask({ name: 'B rollback voor hergebruik' });
    throw new Error('hergebruik-proef');
  });
  assert(!failed.ok, 'de voorbereide B-run hoort te falen');
  const aReuse = txA.run(() => txA.draft.addTask({ name: 'A na B-fout' }));
  const bReuse = txB.run(() => txB.draft.addTask({ name: 'B na eigen fout' }));
  assert(aReuse.ok, 'A blijft na B-rollback bruikbaar');
  assert(bReuse.ok, 'B wordt door het eigen finally weer bruikbaar');
});

// ── Contextlokale coalescing ────────────────────────────────────────────────────────────────────

test('B-succes en B-rollback breken alleen B-coalescing; A-reeks blijft doorlopen', () => {
  const f = pair('coalescing');
  f.A.app.store.setState({ historyEvents: [], nextHistorySequence: 1 });
  f.B.app.store.setState({ historyEvents: [], nextHistorySequence: 1 });
  f.A.app.runtime.resetUndoCoalescing();
  f.B.app.runtime.resetUndoCoalescing();
  for (const description of ['A-1', 'A-2']) {
    f.A.app.store.getState().updateTask(f.A.taskId, { description }, { coalesceKey: 'description' });
  }
  for (const description of ['B-1', 'B-2']) {
    f.B.app.store.getState().updateTask(f.B.taskId, { description }, { coalesceKey: 'description' });
  }
  assertEq(stackDepths(f.A.app), { undo: 1, redo: 0 }, 'A-reeks is open');
  assertEq(stackDepths(f.B.app), { undo: 1, redo: 0 }, 'B-reeks is open');

  const txB = createMcpTransactions(f.B.app);
  const success = txB.run(() => txB.draft.updateTaskFields(f.B.taskId, { priority: 101 }));
  assert(success.ok, 'B-succesvoorwaarde');
  const bAfterTx = historyDepthsForActiveScope(f.B.app.store.getState()).undoDepth;
  f.A.app.store.getState().updateTask(f.A.taskId, { description: 'A-na-B-succes' }, { coalesceKey: 'description' });
  f.B.app.store.getState().updateTask(f.B.taskId, { description: 'B-na-succes' }, { coalesceKey: 'description' });
  assertEq(historyDepthsForActiveScope(f.A.app.store.getState()).undoDepth, 1,
    'A coalescet door na B-succes');
  assertEq(historyDepthsForActiveScope(f.B.app.store.getState()).undoDepth, bAfterTx + 1,
    'B start na succes een nieuwe stap');

  const bBeforeRollback = historyDepthsForActiveScope(f.B.app.store.getState()).undoDepth;
  const rollback = txB.run(() => { throw new Error('coalescing rollback'); });
  assert(!rollback.ok, 'B-rollbackvoorwaarde');
  assertEq(historyDepthsForActiveScope(f.B.app.store.getState()).undoDepth, bBeforeRollback,
    'rollback laat geen undo achter');
  f.A.app.store.getState().updateTask(f.A.taskId, { description: 'A-na-B-rollback' }, { coalesceKey: 'description' });
  f.B.app.store.getState().updateTask(f.B.taskId, { description: 'B-na-rollback' }, { coalesceKey: 'description' });
  assertEq(historyDepthsForActiveScope(f.A.app.store.getState()).undoDepth, 1,
    'A coalescet ook door na B-rollback');
  assertEq(historyDepthsForActiveScope(f.B.app.store.getState()).undoDepth, bBeforeRollback + 1,
    'B begint na rollback opnieuw');
});

// ── Contextlokale timephased teller en meldingsgate ─────────────────────────────────────────────

function seedTimephasedWindow(context: SeededContext): void {
  context.app.store.setState((state) => {
    const task = state.tasks.find((candidate) => candidate.id === context.taskId);
    if (!task) throw new Error(`testvoorwaarde: taak ${context.taskId} ontbreekt`);
    task.timephasedFinishFloor = '2026-08-10T17:00';
    task.timephasedStartAnchor = '2026-08-03T08:00';
  });
}

async function loseTimephasedWindow(context: SeededContext): Promise<McpToolResult> {
  const ctx = makeMcpContext(context.app, {
    expectedDocId: context.docId,
    ensureBackup: async () => null,
  });
  return runMutateTool(ctx, 'mutate', () => {
    const task = context.app.store.getState().tasks.find((candidate) => candidate.id === context.taskId)!;
    ctx.transactions.draft.updateTaskFields(context.taskId, {
      time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 },
    });
    return { data: { id: context.taskId } };
  });
}

test('timephased teller, envelop en melding zijn lease-/contextlokaal; A-gate blijft beschikbaar', async () => {
  __resetTimephasedLossNoticeForTests();
  const f = pair('timephased');
  seedTimephasedWindow(f.A);
  seedTimephasedWindow(f.B);
  const aBeforeB = plainState(f.A.app);
  const aNotificationBaseline = f.A.app.store.getState().ui.notifications.length;
  const bNotificationBaseline = f.B.app.store.getState().ui.notifications.length;

  const bResult = await loseTimephasedWindow(f.B);
  assert(bResult.ok && bResult.envelope.timephasedGuidanceLost === 1,
    'alleen de actieve B-lease rapporteert één verloren taak in de envelop');
  assertEq(f.B.app.store.getState().ui.notifications.length, bNotificationBaseline + 1,
    'B krijgt zijn eigen eerste verliesmelding');
  assertEq(plainState(f.A.app), aBeforeB, 'B-verlies laat A inclusief meldingen exact gelijk');

  const aResult = await loseTimephasedWindow(f.A);
  assert(aResult.ok && aResult.envelope.timephasedGuidanceLost === 1,
    'A kan daarna zijn eigen eerste verlies tellen');
  assertEq(f.A.app.store.getState().ui.notifications.length, aNotificationBaseline + 1,
    'A-meldingsgate was niet door B geconsumeerd');
});

// ── Singletoncompatibiliteit ────────────────────────────────────────────────────────────────────

test('legacy runInMcpTransaction/draft blijven uitsluitend de app-singleton binden', () => {
  const A = seedContext('legacy-A');
  const B = seedContext('legacy-B');
  const aBefore = plainState(A.app);
  const bBefore = plainState(B.app);

  useAppStore.getState().newProject();
  useAppStore.getState().setProject({ name: 'Legacy singletonproject' });
  useAppStore.getState().ensureProjectCalendarInLibrary();
  const singletonCountBefore = useAppStore.getState().tasks.length;
  const result = runInMcpTransaction(() => {
    draft.addTask({ name: 'Alleen legacy singleton' });
  });

  assert(result.ok, 'de legacy wrapper hoort nog te slagen');
  assertEq(useAppStore.getState().tasks.length, singletonCountBefore + 1,
    'legacy draft muteert de app-singleton');
  assert(appStoreContext.store === useAppStore, 'de gemounte app blijft exact de bekende singleton');
  assertEq(plainState(A.app), aBefore, 'legacy wrapper raakt verse context A niet');
  assertEq(plainState(B.app), bBefore, 'legacy wrapper raakt verse context B niet');
});

await run();
