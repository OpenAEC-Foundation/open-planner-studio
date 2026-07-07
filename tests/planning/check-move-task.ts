// moveTask-cykelguard + addTask.notes-checks (fase 2.10 onderdeel 2, QA-fixes P1 en 4) —
// headless tegen de ECHTE Zustand-store (zelfde `useAppStore.getState()`-patroon als
// harness.ts/check-move-assignment.ts). Bewijst met echte code:
//  1) TaskDialog.handleSave verhangt een taak via `moveTask` (niet via een kale `updateTask`-
//     parentId-patch) — childIds blijven op BEIDE ouders correct gesynchroniseerd, en `viewRows`
//     toont de verhangen taak meteen op de nieuwe plek.
//  2) `moveTask` weigert een cyclische move (een summary onder zijn eigen kind hangen) zonder
//     halftoegepaste state — geen snapshot, geen mutatie.
//  3) `addTask` geeft `partial.notes` door aan de nieuwe taak.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const task = (id: string): Task | undefined => S().tasks.find(t => t.id === id);
const visibleTaskIds = () => S().viewRows.filter(r => r.kind === 'task').map(r => (r as { task: Task }).task.id);

// ── 1) Root → onder summary: childIds bevat de taak, viewRows toont hem onder de summary. ──
const idSum = S().addTask({ name: 'Summary' });
const idRoot = S().addTask({ name: 'RootTask' });
eq('01 setup: root is top-level (geen ouder)', task(idRoot)?.parentId, null);
eq('02 setup: summary heeft nog geen kinderen', task(idSum)?.childIds, []);

S().moveTask(idRoot, idSum);
eq('03 root→summary: task.parentId == summary', task(idRoot)?.parentId, idSum);
eq('04 root→summary: summary.childIds bevat de taak', task(idSum)?.childIds.includes(idRoot), true);
{
  const ids = visibleTaskIds();
  const sumIdx = ids.indexOf(idSum);
  const rootIdx = ids.indexOf(idRoot);
  eq('05 root→summary: viewRows toont de taak ná (onder) de summary', rootIdx > sumIdx && rootIdx === sumIdx + 1, true);
}

// ── 2) Kind A→B: A verliest childIds, B krijgt het kind. ──
const idA = S().addTask({ name: 'ParentA' });
const idB = S().addTask({ name: 'ParentB' });
const idChild = S().addTask({ name: 'Child', parentId: idA });
eq('06 setup: A.childIds bevat het kind', task(idA)?.childIds.includes(idChild), true);
eq('07 setup: B.childIds is leeg', task(idB)?.childIds, []);

S().moveTask(idChild, idB);
eq('08 A→B: child.parentId == B', task(idChild)?.parentId, idB);
eq('09 A→B: A.childIds verliest het kind', task(idA)?.childIds.includes(idChild), false);
eq('10 A→B: B.childIds krijgt het kind', task(idB)?.childIds.includes(idChild), true);

// ── 3) Cyklische move geweigerd: summary onder zijn eigen kind hangen. ──
const idOuter = S().addTask({ name: 'Outer' });
const idInner = S().addTask({ name: 'Inner', parentId: idOuter });
const undoLenBefore = S().undoStack.length;
const outerSnapshotBefore = JSON.stringify(task(idOuter));
const innerSnapshotBefore = JSON.stringify(task(idInner));

S().moveTask(idOuter, idInner); // Outer onder zijn eigen kind Inner -> cykel, moet geweigerd worden

eq('11 cykel: Outer.parentId ongewijzigd (null)', task(idOuter)?.parentId, null);
eq('12 cykel: Inner.parentId ongewijzigd (Outer)', task(idInner)?.parentId, idOuter);
eq('13 cykel: Outer.childIds ongewijzigd', task(idOuter)?.childIds.includes(idInner), true);
eq('14 cykel: geen halftoegepaste state (Outer-object byte-identiek)', JSON.stringify(task(idOuter)), outerSnapshotBefore);
eq('15 cykel: geen halftoegepaste state (Inner-object byte-identiek)', JSON.stringify(task(idInner)), innerSnapshotBefore);
eq('16 cykel: geen undo-snapshot gepusht (geweigerde move is een no-op)', S().undoStack.length, undoLenBefore);

// ── 3b) Cyklische move geweigerd: taak onder zichzelf hangen (newParentId === id). ──
const idSelf = S().addTask({ name: 'SelfMove' });
S().moveTask(idSelf, idSelf);
eq('17 self-move: parentId blijft null', task(idSelf)?.parentId, null);

// ── 4) addTask geeft partial.notes door. ──
const idNotes = S().addTask({
  name: 'MetAantekeningen',
  notes: [{ id: 'n1', text: 'Controleer levering', done: false }],
});
eq('18 addTask: notes komt aan op de nieuwe taak', task(idNotes)?.notes, [{ id: 'n1', text: 'Controleer levering', done: false }]);

const idNoNotes = S().addTask({ name: 'ZonderAantekeningen' });
eq('19 addTask: geen notes-arg ⇒ undefined (byte-identiek default)', task(idNoNotes)?.notes, undefined);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  move-task-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  move-task-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
