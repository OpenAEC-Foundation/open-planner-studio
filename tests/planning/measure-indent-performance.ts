// Alleen de begrensde CI-vergelijker draait deze meting; geen onderdeel van de tijdzonematrix.
// Beide revisies krijgen letterlijk dit bestand en dezelfde fixture. Laden, vastleggen,
// undo/redo en documentwissels vallen buiten de gemeten inspringhandeling.
import './domStub';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { capturePayload } from '@/state/documentContract';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';
import { indentFixture } from './indentFixture';

const output = process.argv[2];
assert.ok(output, 'Een uitvoermap is verplicht');
mkdirSync(output, { recursive: true });

// De oude route kostte bij 5.000 taken en 500 geselecteerde taken 211 seconden voor één meting.
// Beperk de vergelijkende tijdmeting; de regressiecheck bewaakt nog selecties van 1.000/2.000.
const selectionCount = (size: number) => Math.min(100, Math.floor(size / 5));

function exercise(size: number, sample: number, nested = false): number {
  const { store } = createAppStoreContext();
  const state = () => store.getState();
  const fixture = indentFixture(size);
  if (nested) {
    for (let i = 1; i < size; i++) {
      const parent = fixture.tasks[Math.floor((i - 1) / 4)];
      fixture.tasks[i].parentId = parent.id;
      parent.childIds.unshift(fixture.tasks[i].id);
    }
  }
  state().applyLoadedProject(fixture, { filePath: null, recompute: false, viewStartDate: '2026-03-02' });
  const count = selectionCount(size);
  const selected = nested
    ? state().tasks.filter((_, index) => index % 3 === 2).map(task => task.id)
    : state().tasks.slice(size - count).map(task => task.id);
  const ids = [...selected].reverse();
  ids.push('onbekende-taak', ids[0]);
  store.setState(draft => { draft.selectedTaskIds = ids; draft.activeTaskId = ids[0]; });
  const key = `${nested ? 'boom' : 'wortels'}-${size}-${sample}`;
  const save = (phase: string) => {
    const current = state();
    writeFileSync(join(output, `${key}-${phase}.json`), JSON.stringify({
      document: capturePayload(current),
      rows: current.viewRows,
      history: historyDepthsForActiveScope(current),
      question: current.ui.pendingPhaseAssignmentQuestion,
      notices: current.ui.notifications.map(notice => ({
        severity: notice.severity, messageKey: notice.messageKey, params: notice.params,
      })),
    }));
  };
  const tasksBefore = JSON.stringify(state().tasks);
  save('voor');
  global.gc?.();
  const start = performance.now();
  state().indentTasks(ids);
  const elapsed = performance.now() - start;
  assert.equal(historyDepthsForActiveScope(state()).undoDepth, 1, `${key}: één undo-stap`);
  assert.deepEqual(state().selectedTaskIds, ids, `${key}: selectie behouden`);
  const tasksAfter = JSON.stringify(state().tasks);
  assert.notEqual(tasksAfter, tasksBefore, `${key}: de handeling verandert werkelijk iets`);
  save('na');
  state().undo();
  assert.equal(JSON.stringify(state().tasks), tasksBefore, `${key}: undo herstelt alle taakvelden`);
  save('undo');
  state().redo();
  assert.equal(JSON.stringify(state().tasks), tasksAfter, `${key}: redo herstelt alle taakvelden`);
  save('redo');
  const documentId = state().activeDocumentId;
  state().newDocument();
  assert.equal(state().tasks.length, 0, `${key}: nieuw document begint leeg`);
  state().switchDocument(documentId);
  assert.equal(JSON.stringify(state().tasks), tasksAfter, `${key}: terugwisselen behoudt alle taakvelden`);
  assert.deepEqual(state().selectedTaskIds, ids, `${key}: terugwisselen behoudt selectie`);
  save('terug');
  console.log(`${key}: ${selected.length} geselecteerd, ${elapsed.toFixed(2)} ms`);
  return elapsed;
}

// Kleine opwarming en een aparte boom met ouder/kindselecties en afwijkende childIds-volgorde.
exercise(100, 0);
exercise(80, 0, true);
const measurements = [5000, 10000].map(size => {
  const samplesMs = Array.from({ length: 3 }, (_, index) => exercise(size, index));
  return { size, selected: selectionCount(size), samplesMs, medianMs: [...samplesMs].sort((a, b) => a - b)[1] };
});
writeFileSync(join(output, 'measurements.json'), JSON.stringify({
  revision: process.env.REVISION_SHA, node: process.version, measurements,
}, null, 2));
