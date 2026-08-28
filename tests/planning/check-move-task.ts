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

// ── 4) addTask's eigen `time`-default (K-item 31) ────────────────────────────
// Negen callsites gaven `time: createDefaultTaskTime(project.startDate || vandaag, 5)` mee —
// letterlijk wat de store zelf al doet. Die zijn weggehaald; deze checks zijn de reden dat dat
// veilig is. Ze pinnen precies wat de callsites deden, dus als iemand de default in taskSlice
// verandert (of hem terugzet op `new Date()`) valt dat hier om, en niet pas als een gebruiker
// een taak op de verkeerde datum ziet verschijnen.
S().setProject({ startDate: '2027-03-01' });

const idDefTime = S().addTask({ name: 'ZonderTijd' });
eq('20 addTask zonder time: start = project.startDate (niet vandaag)', task(idDefTime)?.time.scheduleStart, '2027-03-01');
eq('21 addTask zonder time: duur 5 werkdagen voor een gewone taak', task(idDefTime)?.time.scheduleDuration, 5);

const idDefMilestone = S().addTask({ name: 'ZonderTijdMijlpaal', isMilestone: true });
eq('22 addTask zonder time: mijlpaal krijgt duur 0', task(idDefMilestone)?.time.scheduleDuration, 0);
eq('23 addTask zonder time: mijlpaal start ook op project.startDate', task(idDefMilestone)?.time.scheduleStart, '2027-03-01');

// Een expliciete `time` moet nog steeds voorrang houden — anders zouden de callsites die hem
// wél om een reden meegeven (sjablonen, import, de SDK) stil overschreven worden.
const idExplicit = S().addTask({
  name: 'EigenTijd',
  time: { ...task(idDefTime)!.time, scheduleStart: '2027-06-15', scheduleDuration: 12 },
});
eq('24 addTask mét time: expliciete waarde wint van de default', task(idExplicit)?.time.scheduleStart, '2027-06-15');
eq('25 addTask mét time: expliciete duur wint van de default', task(idExplicit)?.time.scheduleDuration, 12);

// ── 5) moveTask zonder position: WBS-volgorde moet childIds-volgorde volgen (regressie voor de
//      gerapporteerde 3.1/3.2/3.3-bug — een taak die vóór zijn latere siblings werd aangemaakt en
//      via het Taakdialoog van ouder wisselt (TaskDialog.handleSave roept moveTask zónder position
//      aan), moet het WBS-nummer van zijn NIEUWE (laatste) plek krijgen, niet van zijn oude
//      array-positie). ──
const idNieuweTaak = S().addTask({ name: 'Nieuwe taak' }); // root, vroeg in de rauwe array
const idRuwbouw = S().addTask({ name: 'ruwbouw' });
const idFundering = S().addTask({ name: 'herstellen fundering', parentId: idRuwbouw });
const idScheiding = S().addTask({ name: 'scheidingswanden', parentId: idRuwbouw });

S().moveTask(idNieuweTaak, idRuwbouw); // zoals TaskDialog.handleSave: geen position

eq('26 moveTask zonder position: childIds-volgorde = [fundering, scheiding, nieuweTaak]',
  task(idRuwbouw)?.childIds, [idFundering, idScheiding, idNieuweTaak]);
eq('27 moveTask zonder position: WBS van nieuweTaak matcht zijn zichtbare (laatste) plek',
  task(idNieuweTaak)?.wbsCode, `${task(idRuwbouw)?.wbsCode}.3`);
eq('28 moveTask zonder position: fundering blijft 1e kind',
  task(idFundering)?.wbsCode, `${task(idRuwbouw)?.wbsCode}.1`);
eq('29 moveTask zonder position: scheiding blijft 2e kind',
  task(idScheiding)?.wbsCode, `${task(idRuwbouw)?.wbsCode}.2`);

// ── 6) addTask: taskType overerven van de bestaande ouder (alleen bij aanmaken). ──────────
const idOuderLogistiek = S().addTask({ name: 'OuderLogistiek', taskType: 'LOGISTIC' });
const idKindZonderType = S().addTask({ name: 'KindZonderType', parentId: idOuderLogistiek });
eq('30 addTask met ouder: kind zonder eigen taskType erft LOGISTIC van de ouder', task(idKindZonderType)?.taskType, 'LOGISTIC');

const idKindMetType = S().addTask({ name: 'KindMetType', parentId: idOuderLogistiek, taskType: 'DEMOLITION' });
eq('31 addTask met ouder: expliciete taskType op het kind wint van de ouder', task(idKindMetType)?.taskType, 'DEMOLITION');

const idRootZonderType = S().addTask({ name: 'RootZonderType' });
eq('32 addTask zonder ouder: root valt terug op de bouwmodus-default (CONSTRUCTION)', task(idRootZonderType)?.taskType, 'CONSTRUCTION');

const idOuderCustom = S().addTask({ name: 'OuderCustom', taskType: 'USERDEFINED', customTaskTypeId: 'ops-engineering' });
const idKindCustomErft = S().addTask({ name: 'KindCustomErft', parentId: idOuderCustom });
eq('33 addTask erft de stabiele custom-type-id samen met USERDEFINED', task(idKindCustomErft)?.customTaskTypeId, 'ops-engineering');
const idKindBuiltinWint = S().addTask({ name: 'KindBuiltinWint', parentId: idOuderCustom, taskType: 'CONSTRUCTION' });
eq('34 expliciete builtin op kind wist de custom-type-id van de ouder', task(idKindBuiltinWint)?.customTaskTypeId, undefined);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  move-task-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  move-task-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
