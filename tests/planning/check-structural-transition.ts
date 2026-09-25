// Structuurovergangen met toewijzingen (audit taakmutaties §6) — headless tegen de ECHTE store, via
// dezelfde store-acties en contextmenufuncties die de UI aanroept.
//
// WORDT MIJLPAAL: paneel-vinkje en dialoog gingen via `updateTask(taskMilestoneTransition(...))`
// zonder toets — een taak met toewijzingen werd een mijlpaal met een onzichtbare toewijzing zonder
// belasting, een fase werd een ruit. Raster en MCP weigerden dat al. Nu weigeren alle routes met de
// gedeelde regel `milestoneRefusal` en een melding.
//
// WORDT FASE (eigenaarsbesluit "B met melding"): inspringen, verhangen, rij slepen, een subtaak of
// sjabloon toevoegen liet de toewijzing op de nieuwe fase staan (belasting 0). Nu verhuist ze naar de
// eerste nieuwe subtaak die haar mag dragen, in dezelfde undo-stap, met een melding; kan dat niet
// schoon, dan weigert de hele handeling. Een mijlpaal die kinderen krijgt verliest zijn mijlpaalvlag.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domShim';
import { useAppStore } from '@/state/appStore';
import { contextMenuBulk } from '@/components/canvas/contextMenuScope';
import { taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';
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
const routes: Route[] = [
  { label: 'indentTasks (Alt+Shift+→)', run: ({ N }) => S().indentTasks([N]) },
  { label: 'moveTaskTo (rij slepen)', run: ({ L, N }) => S().moveTaskTo(N, { parentId: L, childIndex: 0 }) },
  { label: 'moveTasksTo (selectie slepen)', run: ({ L, N }) => S().moveTasksTo([N], { parentId: L, childIndex: 0 }) },
  { label: 'moveTask (taakvenster "Bovenliggende taak")', run: ({ L, N }) => S().moveTask(N, L) },
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
  const child = S().addTask({ name: 'Nieuwe taak', parentId: L });
  eq('B addTask(parentId): toewijzing naar de nieuwe subtaak', S().assignments.find(a => a.id === assignmentId)?.taskId, child);
  eq('B addTask(parentId): één undo-stap', undoDepth(), before + 1);
  S().runCPM();
  eq('B addTask(parentId): belasting klopt', load(R), 2.5);
}

// Selectie slepen: de eerste nieuwe subtaak die toewijzingen MAG dragen (geen mijlpaal).
{
  const { L, N, assignmentId } = leafWithAssignment();
  const M = S().addTask({ name: 'Keuring', isMilestone: true });
  S().moveTasksTo([M, N], { parentId: L, childIndex: 0 });
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
  const root = S().insertWbsTemplate(leafTemplate, L)!;
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
  S().indentTasks([N1, N2]);
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
  S().indentTasks([M]);
  eq('C1 mijlpaal inspringen onder L: geweigerd', task(M).parentId, null);
  eq('C1 toewijzing blijft op L', S().assignments.find(a => a.id === assignmentId)?.taskId, L);
  eq('C1 geen undo-stap', undoDepth(), before);
  eq('C1 melding', noticesSince(mark), [['notifications.phaseRefusedNoAssignableChild', { phase: 'Metselen' }]]);

  // "Mijlpaal als subtaak toevoegen": ook geweigerd, addTask geeft '' terug.
  const count = S().tasks.length;
  useAppStore.setState((s) => { s.ui.notifications = []; }); // zelfde fase ⇒ zou samenvouwen met C1
  before = undoDepth(); mark = noticeMark();
  const id = S().addTask({ name: 'Nieuwe mijlpaal', isMilestone: true, parentId: L });
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
  eq('C3 sjabloon-tak onder L: geweigerd', [S().insertWbsTemplate(branch, L), S().tasks.length], [null, beforeCount]);
}
{
  // De eerste nieuwe subtaak heeft dezelfde resource al ⇒ één resource per taak ⇒ weigeren.
  const { L, R, N, assignmentId } = leafWithAssignment();
  S().assignResource(N, R, 1);
  const before = undoDepth(); const mark = noticeMark();
  S().moveTaskTo(N, { parentId: L, childIndex: 0 });
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
  S().indentTasks([N]);
  eq('E verhuizing én relatiemelding', S().ui.notifications.map(n => n.messageKey), [
    'notifications.assignmentsMovedToSubtask',
    'notifications.relationsExcludedByHierarchy',
  ]);
  eq('E één undo-stap', undoDepth(), before + 1);
  S().undo();
  eq('E één Ctrl+Z zet structuur en toewijzing terug',
    [task(N).parentId, S().assignments.find(a => a.id === assignmentId)?.taskId, S().sequences.length], [null, L, 1]);
}

if (diffs.length === 0) {
  console.log(`OK  structural-transition: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  structural-transition: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
