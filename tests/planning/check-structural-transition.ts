// Structuurovergangen met toewijzingen (audit taakmutaties §6) — headless tegen de ECHTE store, via
// dezelfde store-acties en contextmenufuncties die de UI aanroept.
//
// WORDT MIJLPAAL: paneel-vinkje en dialoog gingen via `updateTask(taskMilestoneTransition(...))`
// zonder toets — een taak met toewijzingen werd een mijlpaal met een onzichtbare toewijzing zonder
// belasting, een fase werd een ruit. Raster en MCP weigerden dat al. Nu weigeren alle routes met de
// gedeelde regel `milestoneRefusal` en een melding.
//
// WORDT FASE (eigenaarsbesluit "B met melding"): inspringen, verhangen, rij slepen, een subtaak of
// sjabloon toevoegen liet de toewijzing op de nieuwe fase staan (belasting 0). Met de vaste keuze
// `'move'` (extensies, en het gedrag van B–E hieronder) verhuist ze naar de eerste nieuwe subtaak die
// haar mag dragen, in dezelfde undo-stap, met een melding; kan dat niet schoon, dan weigert de hele
// handeling. Een mijlpaal die kinderen krijgt verliest zijn mijlpaalvlag.
//
// VRAAG (eigenaarsbesluit 2026-10-17, "altijd vragen", sectie F): zonder vaste keuze vraagt de store
// eerst (`ui.pendingPhaseAssignmentQuestion`) en verandert er niets tot het antwoord: Annuleren,
// Verwijderen of Verplaatsen, als één undo-stap.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domShim';
import { useAppStore } from '@/state/appStore';
import { contextMenuBulk } from '@/components/canvas/contextMenuScope';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';
import { hasBlockingDialogOpen } from '@/hooks/keyboard/shortcutRegistry';
import { phaseAssignmentQuestionForTaskDialog } from '@/state/slices/taskSlice';
import { saveTaskDialog } from '@/state/taskDialogSave';
import type { CellEditIntent } from '@/types/taskGrid';
import type { WbsTemplate } from '@/utils/wbsTemplates';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const task = (id: string) => S().tasks.find(t => t.id === id)!;
const undoDepth = () => historyDepthsForActiveScope(S()).undoDepth;
const assignmentsOf = (id: string) => S().assignments.filter(a => a.taskId === id);
const load = (resourceId: string) => Object.values(
  (S().resourceLoadResult?.load?.[resourceId] ?? {}) as Record<string, number>,
).reduce((sum, value) => sum + value, 0);
/** Meldingen sinds `from`, als [sleutel, params]. */
const noticesSince = (from: number) => S().ui.notifications.slice(from).map(n => [n.messageKey, n.params ?? {}]);
const noticeMark = () => S().ui.notifications.length;

function fresh(): void {
  S().newProject();
  S().setProject({ startDate: '2026-03-02' });
  useAppStore.setState((s) => { s.ui.notifications = []; });
}
function resource(name: string): string {
  return S().addResource({ name, type: 'LABOR', description: '', maxUnits: 1 });
}
/** Taak `L` met één toewijzing (resource R, 0,5 eenheid/dag, voorlading) en een losse opvolger `N`. */
function leafWithAssignment() {
  fresh();
  const L = S().addTask({ name: 'Metselen' });
  const R = resource('Metselaar');
  S().assignResource(L, R, 0.5, 'FRONT_LOADED');
  const N = S().addTask({ name: 'Voegen' });
  S().runCPM();
  const assignmentId = assignmentsOf(L)[0].id;
  return { L, R, N, assignmentId };
}

// ── A. Wordt mijlpaal ───────────────────────────────────────────────────────────────────────────
{
  const { L } = leafWithAssignment();
  const P = S().addTask({ name: 'Fase' });
  S().addTask({ name: 'Kind', parentId: P });
  const X = S().addTask({ name: 'Los' });
  S().runCPM();

  // Paneel/dialoog-patch via `updateTask`: de store weigert zelf ook (vangnet voor extensies).
  let before = undoDepth(); let mark = noticeMark();
  S().updateTask(L, taskMilestoneTransition(task(L), true));
  eq('A1 updateTask: taak met toewijzing wordt GEEN mijlpaal', task(L).isMilestone, false);
  eq('A1 updateTask: duur blijft staan (geen halve patch)', task(L).time.scheduleDuration, 5);
  eq('A1 updateTask: geen undo-stap', undoDepth(), before);
  eq('A1 updateTask: melding', noticesSince(mark), [['notifications.milestoneRefusedAssignments', { count: 1, task: 'Metselen' }]]);

  before = undoDepth(); mark = noticeMark();
  S().updateTask(P, taskMilestoneTransition(task(P), true));
  eq('A2 updateTask: fase wordt GEEN mijlpaal (geen ruit)', task(P).isMilestone, false);
  eq('A2 updateTask: melding', noticesSince(mark), [['notifications.milestoneRefusedSummary', { count: 1, task: 'Fase' }]]);
  eq('A2 updateTask: geen undo-stap', undoDepth(), before);

  // Contextmenu over een selectie: de toegestane taak wisselt, de rest blijft, één undo-stap.
  // (Meldingen eerst leeg: dezelfde weigerreden vouwt anders samen in de melding van A1/A2.)
  useAppStore.setState((s) => { s.ui.notifications = []; });
  S().selectTasks([L, P, X], false, X);
  before = undoDepth(); mark = noticeMark();
  contextMenuBulk.toggleMilestone(task(X));
  eq('A3 contextmenu: de gewone taak wordt mijlpaal', task(X).isMilestone, true);
  eq('A3 contextmenu: taak met toewijzing niet', task(L).isMilestone, false);
  eq('A3 contextmenu: fase niet', task(P).isMilestone, false);
  eq('A3 contextmenu: één undo-stap', undoDepth(), before + 1);
  eq('A3 contextmenu: één melding per reden', noticesSince(mark), [
    ['notifications.milestoneRefusedAssignments', { count: 1, task: 'Metselen' }],
    ['notifications.milestoneRefusedSummary', { count: 1, task: 'Fase' }],
  ]);

  // Raster: fase ⇒ mijlpaal weigert nu ook (toewijzingen weigerde het al).
  const grid = S().runGridMutation([{
    kind: 'cell-edit', taskId: P, columnId: 'task.isMilestone' as CellEditIntent['columnId'],
    route: 'task-milestone', value: true,
  }]);
  eq('A4 raster: fase ⇒ mijlpaal geweigerd', grid.ok ? 'ok' : grid.errors.map(e => e.code), ['milestoneUnavailable']);

  // Een gewone taak blijft gewoon omzetbaar (regressie).
  const Y = S().addTask({ name: 'Oplevering' });
  S().updateTask(Y, taskMilestoneTransition(task(Y), true));
  eq('A5 gewone taak wordt wél mijlpaal', [task(Y).isMilestone, task(Y).time.scheduleDuration], [true, 0]);
}

// ── B. Wordt fase: de toewijzing verhuist naar de eerste nieuwe subtaak ──────────────────────────
type Route = { label: string; run: (ids: { L: string; N: string }) => void };
const MOVE = { phaseAssignments: 'move' } as const;
const routes: Route[] = [
  { label: 'indentTasks (Alt+Shift+→)', run: ({ N }) => S().indentTasks([N], MOVE) },
  { label: 'moveTaskTo (rij slepen)', run: ({ L, N }) => S().moveTaskTo(N, { parentId: L, childIndex: 0 }, MOVE) },
  { label: 'moveTasksTo (selectie slepen)', run: ({ L, N }) => S().moveTasksTo([N], { parentId: L, childIndex: 0 }, MOVE) },
  { label: 'moveTask (taakvenster "Bovenliggende taak")', run: ({ L, N }) => S().moveTask(N, L, undefined, MOVE) },
];
for (const route of routes) {
  const { L, R, N, assignmentId } = leafWithAssignment();
  const before = undoDepth(); const mark = noticeMark();
  route.run({ L, N });
  const moved = S().assignments.find(a => a.id === assignmentId);
  eq(`B ${route.label}: N is kind van L`, task(N).parentId, L);
  eq(`B ${route.label}: toewijzing hangt nu aan N (zelfde id, eenheden, curve)`,
    moved && [moved.taskId, moved.resourceId, moved.unitsPerDay, moved.curve], [N, R, 0.5, 'FRONT_LOADED']);
  eq(`B ${route.label}: L draagt niets meer`, [assignmentsOf(L).length, task(L).resourceIds], [0, []]);
  eq(`B ${route.label}: N.resourceIds bijgewerkt`, task(N).resourceIds, [R]);
  eq(`B ${route.label}: één undo-stap`, undoDepth(), before + 1);
  eq(`B ${route.label}: melding`, noticesSince(mark), [['notifications.assignmentsMovedToSubtask', {
    count: 1, resources: 'Metselaar', phase: 'Metselen', child: 'Voegen',
  }]]);
  S().runCPM();
  eq(`B ${route.label}: belasting klopt weer (5 werkdagen × 0,5)`, load(R), 2.5);
  S().undo();
  eq(`B ${route.label}: één Ctrl+Z zet toewijzing én structuur terug`,
    [task(N).parentId, S().assignments.find(a => a.id === assignmentId)?.taskId], [null, L]);
}

// addTask(parentId) — "Subtaak toevoegen" in het contextmenu, en de extensie-API.
{
  const { L, R, assignmentId } = leafWithAssignment();
  const before = undoDepth();
  const child = S().addTask({ name: 'Nieuwe taak', parentId: L }, MOVE);
  eq('B addTask(parentId): toewijzing naar de nieuwe subtaak', S().assignments.find(a => a.id === assignmentId)?.taskId, child);
  eq('B addTask(parentId): één undo-stap', undoDepth(), before + 1);
  S().runCPM();
  eq('B addTask(parentId): belasting klopt', load(R), 2.5);
}

// Selectie slepen: de eerste nieuwe subtaak die toewijzingen MAG dragen (geen mijlpaal).
{
  const { L, N, assignmentId } = leafWithAssignment();
  const M = S().addTask({ name: 'Keuring', isMilestone: true });
  S().moveTasksTo([M, N], { parentId: L, childIndex: 0 }, MOVE);
  eq('B moveTasksTo: mijlpaal overgeslagen, eerste bladtaak krijgt de toewijzing',
    S().assignments.find(a => a.id === assignmentId)?.taskId, N);
}

// Sjabloon invoegen onder L: een enkele bladwortel neemt de toewijzing over.
{
  const { L, assignmentId } = leafWithAssignment();
  const leafTemplate: WbsTemplate = {
    id: 'tpl', name: 'Los', createdAt: '2026-01-01', sequences: [],
    tasks: [{ id: 'a', parentId: null, name: 'Sjabloontaak', description: '', taskType: 'CONSTRUCTION', isMilestone: false, durationDays: 3 }],
  };
  const root = S().insertWbsTemplate(leafTemplate, L, MOVE)!;
  eq('B insertWbsTemplate: bladwortel krijgt de toewijzing', S().assignments.find(a => a.id === assignmentId)?.taskId, root);
}

// Meerdere taken worden in één handeling fase: elk apart, één undo-stap, één melding.
{
  fresh();
  const R1 = resource('Metselaar');
  const R2 = resource('Tegelzetter');
  const L1 = S().addTask({ name: 'Metselen' });
  const N1 = S().addTask({ name: 'Voegen' });
  const L2 = S().addTask({ name: 'Tegelen' });
  const N2 = S().addTask({ name: 'Kitten' });
  S().assignResource(L1, R1, 1);
  S().assignResource(L2, R2, 1);
  const before = undoDepth(); const mark = noticeMark();
  S().indentTasks([N1, N2], MOVE);
  eq('B selectie inspringen: elke nieuwe fase apart',
    [assignmentsOf(N1).map(a => a.resourceId), assignmentsOf(N2).map(a => a.resourceId)], [[R1], [R2]]);
  eq('B selectie inspringen: één undo-stap', undoDepth(), before + 1);
  eq('B selectie inspringen: één samenvattende melding', noticesSince(mark), [['notifications.assignmentsMovedToSubtasks', { count: 2 }]]);
}

// ── C. Weigeren als het niet schoon kan ──────────────────────────────────────────────────────────
{
  // Alleen een mijlpaal wordt het nieuwe kind ⇒ nergens heen ⇒ weigeren, niets gewijzigd.
  fresh();
  const L = S().addTask({ name: 'Metselen' });
  S().assignResource(L, resource('Metselaar'), 1);
  const assignmentId = assignmentsOf(L)[0].id;
  const M = S().addTask({ name: 'Keuring', isMilestone: true });
  let before = undoDepth(); let mark = noticeMark();
  S().indentTasks([M], MOVE);
  eq('C1 mijlpaal inspringen onder L: geweigerd', task(M).parentId, null);
  eq('C1 toewijzing blijft op L', S().assignments.find(a => a.id === assignmentId)?.taskId, L);
  eq('C1 geen undo-stap', undoDepth(), before);
  eq('C1 melding', noticesSince(mark), [['notifications.phaseRefusedNoAssignableChild', { phase: 'Metselen' }]]);

  // "Mijlpaal als subtaak toevoegen": ook geweigerd, addTask geeft '' terug.
  const count = S().tasks.length;
  useAppStore.setState((s) => { s.ui.notifications = []; }); // zelfde fase ⇒ zou samenvouwen met C1
  before = undoDepth(); mark = noticeMark();
  const id = S().addTask({ name: 'Nieuwe mijlpaal', isMilestone: true, parentId: L }, MOVE);
  eq('C2 addTask mijlpaal onder L: geweigerd', [id, S().tasks.length, undoDepth()], ['', count, before]);
  eq('C2 melding', noticesSince(mark).map(n => n[0]), ['notifications.phaseRefusedNoAssignableChild']);

  // Een tak (fase met kinderen) als enige nieuwe kind: evenmin een bladtaak ⇒ weigeren.
  const branch: WbsTemplate = {
    id: 'tpl2', name: 'Tak', createdAt: '2026-01-01', sequences: [],
    tasks: [
      { id: 'r', parentId: null, name: 'Tak', description: '', taskType: 'CONSTRUCTION', isMilestone: false, durationDays: 0 },
      { id: 'k', parentId: 'r', name: 'Takkind', description: '', taskType: 'CONSTRUCTION', isMilestone: false, durationDays: 2 },
    ],
  };
  const beforeCount = S().tasks.length;
  eq('C3 sjabloon-tak onder L: geweigerd', [S().insertWbsTemplate(branch, L, MOVE), S().tasks.length], [null, beforeCount]);
}
{
  // De eerste nieuwe subtaak heeft dezelfde resource al ⇒ één resource per taak ⇒ weigeren.
  const { L, R, N, assignmentId } = leafWithAssignment();
  S().assignResource(N, R, 1);
  const before = undoDepth(); const mark = noticeMark();
  S().moveTaskTo(N, { parentId: L, childIndex: 0 }, MOVE);
  eq('C4 dubbele resource: verhanging geweigerd', task(N).parentId, null);
  eq('C4 toewijzingen ongemoeid', [S().assignments.find(a => a.id === assignmentId)?.taskId, assignmentsOf(N).length], [L, 1]);
  eq('C4 geen undo-stap', undoDepth(), before);
  eq('C4 melding', noticesSince(mark), [['notifications.phaseRefusedDuplicateResource', {
    phase: 'Metselen', child: 'Voegen', resource: 'Metselaar',
  }]]);
}

// ── D. Een mijlpaal krijgt kinderen ⇒ mijlpaalvlag eraf, anders tekent de Gantt een ruit ──────────
{
  fresh();
  const M = S().addTask({ name: 'Oplevering', isMilestone: true, milestoneKind: 'FINISH', mandatory: true });
  const N = S().addTask({ name: 'Nazorg' });
  const mark = noticeMark();
  S().indentTasks([N]);
  eq('D mijlpaal wordt fase: vlag, soort en verplicht eraf',
    [task(M).isMilestone, task(M).milestoneKind, task(M).mandatory], [false, undefined, undefined]);
  eq('D melding', noticesSince(mark), [['notifications.milestoneClearedOnPhase', { count: 1, phase: 'Oplevering' }]]);
}

// ── E. Samen met de relatiemelding van #207 (verhangen maakt een relatie tot voorouder-relatie) ───
// Inspringen onder de eigen voorganger doet beide tegelijk: de toewijzing verhuist én de relatie
// L → N telt niet meer mee. Beide meldingen, en toch één undo-stap die alles terugzet.
{
  const { L, N, assignmentId } = leafWithAssignment();
  S().addSequence({ predecessorId: L, successorId: N, type: 'FINISH_START', lagDays: 0 });
  useAppStore.setState((s) => { s.ui.notifications = []; });
  const before = undoDepth();
  S().indentTasks([N], MOVE);
  eq('E verhuizing én relatiemelding', S().ui.notifications.map(n => n.messageKey), [
    'notifications.assignmentsMovedToSubtask',
    'notifications.relationsExcludedByHierarchy',
  ]);
  eq('E één undo-stap', undoDepth(), before + 1);
  S().undo();
  eq('E één Ctrl+Z zet structuur en toewijzing terug',
    [task(N).parentId, S().assignments.find(a => a.id === assignmentId)?.taskId, S().sequences.length], [null, L, 1]);
}


// ── F. Zonder vaste keuze: eerst de vraag (eigenaarsbesluit 2026-10-17, "altijd vragen") ─────────
const question = () => S().ui.pendingPhaseAssignmentQuestion;
/** Alles wat een annulering ongemoeid moet laten. */
const fingerprint = () => JSON.stringify({
  tasks: S().tasks.map(t => [t.id, t.parentId, t.childIds, t.resourceIds, t.isMilestone]),
  assignments: S().assignments.map(a => [a.id, a.taskId, a.resourceId]),
  undo: undoDepth(),
  dirty: S().isDirty,
});
{
  // F1 Inspringen vraagt eerst en verandert niets.
  const { L, N, assignmentId } = leafWithAssignment();
  const before = fingerprint(); const mark = noticeMark();
  S().indentTasks([N]);
  eq('F1 vraag staat open', question(), { items: [{
    phaseId: L, phaseName: 'Metselen', childCount: 1, firstChildName: 'Voegen',
    targetId: N, targetName: 'Voegen', resourceNames: ['Metselaar'], actualWork: [], blocked: null,
  }] });
  eq('F1 nog niets veranderd (structuur, toewijzing, undo, isDirty)', fingerprint(), before);
  eq('F1 geen melding', noticesSince(mark), []);
  eq('F1 de vraag is modaal (hasBlockingDialogOpen)', hasBlockingDialogOpen(S().ui), true);

  // F2 Annuleren: vraag weg, er verandert niets.
  S().answerPhaseAssignmentQuestion(null);
  eq('F2 annuleren: vraag weg', question(), null);
  eq('F2 annuleren: niets veranderd', fingerprint(), before);
  // Een tweede antwoord zonder open vraag is een no-op (dubbelklik).
  S().answerPhaseAssignmentQuestion('move');
  eq('F2 antwoord zonder vraag: no-op', fingerprint(), before);

  // F3 Verplaatsen: zoals vroeger, één undo-stap, en geen melding die de keuze herhaalt.
  const depth = undoDepth(); const mark3 = noticeMark();
  S().indentTasks([N]);
  S().answerPhaseAssignmentQuestion('move');
  eq('F3 verplaatsen: N onder L, toewijzing op N', [task(N).parentId, S().assignments.find(a => a.id === assignmentId)?.taskId], [L, N]);
  eq('F3 verplaatsen: één undo-stap', undoDepth(), depth + 1);
  eq('F3 verplaatsen: geen "verplaatst"-melding na de eigen keuze', noticesSince(mark3), []);
  eq('F3 vraag weg', question(), null);
  S().undo();
  eq('F3 één Ctrl+Z zet alles terug', [task(N).parentId, S().assignments.find(a => a.id === assignmentId)?.taskId], [null, L]);
}
{
  // F4 Verwijderen: de fase krijgt haar kind, haar toewijzingen verdwijnen; één undo-stap.
  const { L, N, R, assignmentId } = leafWithAssignment();
  const depth = undoDepth();
  S().moveTaskTo(N, { parentId: L, childIndex: 0 });
  S().answerPhaseAssignmentQuestion('remove');
  eq('F4 verwijderen: N onder L', task(N).parentId, L);
  eq('F4 verwijderen: geen toewijzing meer, nergens', [S().assignments.length, task(L).resourceIds, task(N).resourceIds], [0, [], []]);
  eq('F4 verwijderen: één undo-stap', undoDepth(), depth + 1);
  S().runCPM();
  eq('F4 verwijderen: geen belasting meer', load(R), 0);
  S().undo();
  eq('F4 één Ctrl+Z: structuur en toewijzing terug (zelfde id)',
    [task(N).parentId, S().assignments.find(a => a.id === assignmentId)?.taskId, task(L).resourceIds], [null, L, [R]]);
}
{
  // F5 Dezelfde resource op de subtaak: verplaatsen kan niet (geblokkeerd), verwijderen wel.
  const { L, N, R, assignmentId } = leafWithAssignment();
  S().assignResource(N, R, 1);
  const own = assignmentsOf(N)[0].id;
  const before = fingerprint();
  S().moveTasksTo([N], { parentId: L, childIndex: 0 });
  eq('F5 vraag: verplaatsen geblokkeerd door dezelfde resource',
    question()?.items.map(i => [i.targetName, i.blocked]), [['Voegen', { kind: 'duplicateResource', resourceNames: ['Metselaar'] }]]);
  eq('F5 nog niets veranderd', fingerprint(), before);
  S().answerPhaseAssignmentQuestion('remove');
  eq('F5 verwijderen: N onder L, toewijzing van L weg, N houdt de zijne',
    [task(N).parentId, S().assignments.some(a => a.id === assignmentId), S().assignments.map(a => a.id)], [L, false, [own]]);
}
{
  // F6 Alleen een mijlpaal als nieuw kind: verplaatsen kan nergens heen.
  fresh();
  const L = S().addTask({ name: 'Metselen' });
  S().assignResource(L, resource('Metselaar'), 1);
  const M = S().addTask({ name: 'Keuring', isMilestone: true });
  S().indentTasks([M]);
  eq('F6 vraag: geen geschikte subtaak', question()?.items.map(i => [i.targetId, i.blocked]), [[null, { kind: 'noAssignableChild' }]]);
  S().answerPhaseAssignmentQuestion('remove');
  eq('F6 verwijderen: mijlpaal onder L, geen toewijzing', [task(M).parentId, S().assignments.length], [L, 0]);
}
{
  // F7 Een selectie maakt twee fases: één vraag, per fase de resources; de keuze geldt voor allebei.
  fresh();
  const R1 = resource('Metselaar');
  const R2 = resource('Tegelzetter');
  const L1 = S().addTask({ name: 'Metselen' });
  const N1 = S().addTask({ name: 'Voegen' });
  const L2 = S().addTask({ name: 'Tegelen' });
  const N2 = S().addTask({ name: 'Kitten' });
  S().assignResource(L1, R1, 1);
  S().assignResource(L2, R2, 1);
  S().assignResource(N2, R2, 1); // N2 heeft Tegelzetter al ⇒ verplaatsen bij L2 kan niet
  const depth = undoDepth();
  S().indentTasks([N1, N2]);
  eq('F7 één vraag met twee fases, alleen de tweede geblokkeerd',
    question()?.items.map(i => [i.phaseName, i.resourceNames, i.blocked?.kind ?? null]),
    [['Metselen', ['Metselaar'], null], ['Tegelen', ['Tegelzetter'], 'duplicateResource']]);
  S().answerPhaseAssignmentQuestion('remove');
  eq('F7 verwijderen geldt voor allebei', [assignmentsOf(L1).length, assignmentsOf(L2).length, assignmentsOf(N2).length], [0, 0, 1]);
  eq('F7 één undo-stap', undoDepth(), depth + 1);
}
{
  // F8 Subtaak toevoegen: `addTask` geeft '' en vraagt; het antwoord maakt de taak alsnog.
  const { L, assignmentId } = leafWithAssignment();
  const count = S().tasks.length; const depth = undoDepth();
  const id = S().addTask({ name: 'Nieuwe taak', parentId: L });
  eq('F8 addTask: eerst de vraag, nog geen taak', [id, S().tasks.length, question()?.items[0].targetName], ['', count, 'Nieuwe taak']);
  S().answerPhaseAssignmentQuestion('move');
  const child = task(L).childIds[0];
  eq('F8 addTask + verplaatsen: nieuwe subtaak draagt de toewijzing',
    [S().tasks.length, S().assignments.find(a => a.id === assignmentId)?.taskId], [count + 1, child]);
  eq('F8 één undo-stap', undoDepth(), depth + 1);
}
{
  // F9 Sjabloon invoegen: `null` en de vraag; Verwijderen voegt het sjabloon in zonder toewijzing.
  const { L } = leafWithAssignment();
  const tpl: WbsTemplate = {
    id: 'tpl3', name: 'Los', createdAt: '2026-01-01', sequences: [],
    tasks: [{ id: 'a', parentId: null, name: 'Sjabloontaak', description: '', taskType: 'CONSTRUCTION', isMilestone: false, durationDays: 3 }],
  };
  eq('F9 insertWbsTemplate: eerst de vraag', [S().insertWbsTemplate(tpl, L), question()?.items[0].targetName], [null, 'Sjabloontaak']);
  S().answerPhaseAssignmentQuestion('remove');
  eq('F9 verwijderen: sjabloon onder L, geen toewijzing', [task(L).childIds.length, S().assignments.length], [1, 0]);
}
{
  // F10 De taakdialoog vraagt vóór het opslaan met dezelfde proef.
  const { L, N } = leafWithAssignment();
  const leaf = { name: 'Voegen', isMilestone: false, hasChildren: false };
  eq('F10 vraag bij een andere ouder',
    phaseAssignmentQuestionForTaskDialog(S(), N, L, leaf)?.items.map(i => i.targetName), ['Voegen']);
  eq('F10 geen vraag naar de wortel', phaseAssignmentQuestionForTaskDialog(S(), N, null, leaf), null);
  eq('F10 nieuwe mijlpaal onder L: geblokkeerd',
    phaseAssignmentQuestionForTaskDialog(S(), null, L, { name: 'M', isMilestone: true, hasChildren: false })?.items[0].blocked,
    { kind: 'noAssignableChild' });
  // Een taak zonder toewijzing die fase wordt: geen vraag, gewoon doen.
  const Y = S().addTask({ name: 'Leeg' });
  const X = S().addTask({ name: 'Los' });
  S().indentTasks([X]);
  eq('F10 geen toewijzing op de nieuwe fase ⇒ geen vraag, gewoon gedaan', [question(), task(X).parentId], [null, Y]);
}
{
  // F12 De vraag is verouderd zodra taken of toewijzingen intussen veranderen (review #374): het
  // antwoord doet dan niets. Probe van de review: de vraag noemt Metselaar, een undo zet intussen
  // een tweede toewijzing (Opperman) terug; "Verwijderen" mocht die niet meenemen.
  const { L, N, assignmentId } = leafWithAssignment();
  S().assignResource(L, resource('Opperman'), 1);
  const opperman = assignmentsOf(L).find(a => a.id !== assignmentId)!.id;
  S().unassignResource(opperman);
  S().indentTasks([N]);
  eq('F12 vraag noemt alleen Metselaar', question()?.items[0].resourceNames, ['Metselaar']);
  S().undo(); // Opperman terug, terwijl de vraag open staat (sneltoetsen zijn dicht; dit is het vangnet)
  const before = fingerprint(); const mark = noticeMark();
  S().answerPhaseAssignmentQuestion('remove');
  eq('F12 verouderd antwoord: vraag weg, niets gedaan', [question(), fingerprint()], [null, before]);
  eq('F12 Opperman en Metselaar staan nog op L', assignmentsOf(L).length, 2);
  eq('F12 melding via het ene kanaal', noticesSince(mark).map(n => n[0]), ['notifications.phaseQuestionOutdated']);
}
{
  // F14 Een wijziging die de vraag niet raakt (F5, een andere taak) houdt de keuze geldig (review #374:
  // het vangnet mocht een keuze niet stil weggooien na F5).
  const { L, N, assignmentId } = leafWithAssignment();
  const X = S().addTask({ name: 'Los' });
  S().indentTasks([N]);
  S().runCPM();
  S().updateTask(X, { name: 'Andere naam' });
  const mark = noticeMark();
  S().answerPhaseAssignmentQuestion('move');
  eq('F14 keuze uitgevoerd ondanks F5 en een andere wijziging',
    [task(N).parentId, S().assignments.find(a => a.id === assignmentId)?.taskId], [L, N]);
  eq('F14 geen verouderd-melding', noticesSince(mark).map(n => n[0]).filter(k => k === 'notifications.phaseQuestionOutdated'), []);
}
{
  // F13 Taak bewerken vraagt met de vorm van het CONCEPT (review #374).
  // a) Mijlpaal ⇒ gewone taak met een nieuwe ouder: verplaatsen kan wél.
  fresh();
  const L = S().addTask({ name: 'Metselen' });
  S().assignResource(L, resource('Metselaar'), 1);
  const M = S().addTask({ name: 'Keuring', isMilestone: true });
  const qa = phaseAssignmentQuestionForTaskDialog(S(), M, L, { name: 'Keuring (taak)', isMilestone: false, hasChildren: false });
  eq('F13a mijlpaal ⇒ taak: verplaatsen kan, naar de conceptnaam', qa?.items.map(i => [i.targetName, i.blocked]), [['Keuring (taak)', null]]);
  const draftA = { ...task(M), name: 'Keuring (taak)', isMilestone: false, parentId: L };
  draftA.time = { ...draftA.time, scheduleDuration: 3 };
  saveTaskDialog({ editingTaskId: M, draft: draftA, startDate: '2026-03-02', phaseAssignments: 'move' });
  eq('F13a opgeslagen: onder L, toewijzing op M, geen mijlpaal',
    [task(M).parentId, assignmentsOf(M).length, assignmentsOf(L).length, task(M).isMilestone], [L, 1, 0, false]);

  // b) Gewone taak ⇒ mijlpaal met een nieuwe ouder: verplaatsen kan niet; verwijderen slaat alles op.
  fresh();
  const L2 = S().addTask({ name: 'Metselen' });
  S().assignResource(L2, resource('Metselaar'), 1);
  const N2 = S().addTask({ name: 'Oplevering' });
  const qb = phaseAssignmentQuestionForTaskDialog(S(), N2, L2, { name: 'Oplevering', isMilestone: true, hasChildren: false });
  eq('F13b taak ⇒ mijlpaal: verplaatsen geblokkeerd', qb?.items[0].blocked, { kind: 'noAssignableChild' });
  const mark = noticeMark();
  const draftB = { ...task(N2), isMilestone: true, parentId: L2 };
  saveTaskDialog({ editingTaskId: N2, draft: draftB, startDate: '2026-03-02', phaseAssignments: 'remove' });
  eq('F13b opgeslagen: mijlpaal onder L2, toewijzing weg',
    [task(N2).isMilestone, task(N2).parentId, S().assignments.length], [true, L2, 0]);
  eq('F13b geen weigermelding', noticesSince(mark).map(n => n[0]).filter(k => String(k).includes('phaseRefused')), []);
}
{
  // F11 Verricht werk (actuals) op de toewijzing: verplaatsen houdt het, verwijderen niet.
  const { L, N, assignmentId } = leafWithAssignment();
  useAppStore.setState((s) => { s.assignments.find(a => a.id === assignmentId)!.actualWorkMinutes = 480; });
  S().indentTasks([N]);
  eq('F11 de vraag noemt het verrichte werk', question()?.items[0].actualWork, [{ resourceName: 'Metselaar', minutes: 480 }]);
  S().answerPhaseAssignmentQuestion('move');
  eq('F11 verplaatsen: verricht werk gaat mee', S().assignments.find(a => a.id === assignmentId)?.actualWorkMinutes, 480);
  S().undo();
  S().indentTasks([N]);
  S().answerPhaseAssignmentQuestion('remove');
  eq('F11 verwijderen: toewijzing mét verricht werk weg', [task(N).parentId, S().assignments.length], [L, 0]);
  S().undo();
  eq('F11 Ctrl+Z brengt het verrichte werk terug', S().assignments.find(a => a.id === assignmentId)?.actualWorkMinutes, 480);
}

if (diffs.length === 0) {
  console.log(`OK  structural-transition: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  structural-transition: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
