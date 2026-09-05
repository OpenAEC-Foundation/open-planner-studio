// check-work-rule-store.ts — taaktypes-etappe (spec 2026-09-04, bouwstap 4): de werkdriehoek
// BEDRAAD in de store (`taskSlice.updateTask`/`setTaskWorkRule`, `resourceSlice.assignResource`/
// `updateAssignment`/`unassignResource`/`setAssignmentWork`), in het taakraster
// (`gridTransaction.ts`) en in de MCP-tweeling (`createMcpTransactions.ts`), plus de vierde bron
// van `assignmentDayUnits`. De pure kern staat in `check-work-triangle.ts`; hier gaat het om
// het ritueel eromheen: byte-identiek onder de standaardregel, `scheduleStale` bij een duur die
// uit de driehoek komt, één undo-stap (meetlat 28), contourherschaling met werkbehoud (22) en
// resource erbij onder FIXED_WORK (23).
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { runGridMutation } from '@/state/gridTransaction';
import { draft, runInMcpTransaction } from '@/state/mcpTransaction';
import { assignmentDayUnits } from '@/engine/scheduler/ResourceLoad';
import { workDaySlotsToPeriods } from '@/engine/contour/contourEdit';
import { contourKeepsWork, workRuleApplies } from '@/engine/work/workRuleApply';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { AssignmentSetIntent, CellEditIntent } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import type { ResourceAssignment } from '@/types/resource';
import { hasTaskTypeData } from '@/engine/work/taskTypesVisibility';
import { __resetTaskTypesNoticeForTests, notifyTaskTypesUnlocked } from '@/state/taskTypesNotice';
import { SETTINGS } from '@/utils/settingsRegistry';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { buildTaskRelationIndex } from '@/engine/taskGrid/relationIndex';

const S = () => useAppStore.getState();
let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: kreeg ${g}, verwachtte ${w}`);
}
function ok(label: string, cond: boolean): void { eq(label, cond, true); }
const near = (a: number | undefined, b: number, eps = 1e-6) => a !== undefined && Math.abs(a - b) < eps;

function reset(): void {
  S().newProject();
  useAppStore.setState((s) => { s.historyEvents = []; s.nextHistorySequence = 1; s.ui.notifications = []; s.isDirty = false; });
}
const slot = () => S().calendar.hoursPerDay * 60;
const task = (id: string): Task => S().tasks.find((t) => t.id === id)!;
const asgOf = (taskId: string, resourceId: string): ResourceAssignment => S().assignments.find((a) => a.taskId === taskId && a.resourceId === resourceId)!;
function labor(name: string): string { return S().addResource({ name, type: 'LABOR', description: '', maxUnits: 1 }); }

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (a) standaardregel: byte-identiek aan vandaag --');
{
  reset();
  const t = S().addTask({ name: 'a', time: createDefaultTaskTime('2026-06-01', 5) });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().runCPM();
  const before = JSON.stringify(asgOf(t, r1));
  S().updateTask(t, { time: { ...task(t).time, scheduleDuration: 10 } });
  eq('a1 duur ×2 laat de toewijzing onder FIXED_DURATION_RATE ongemoeid', JSON.stringify(asgOf(t, r1)), before);
  eq('a2 …en schrijft geen werkveld', asgOf(t, r1).remainingWorkMinutes, undefined);
  S().runCPM();
  S().updateAssignment(asgOf(t, r1).id, { unitsPerDay: 0.5 });
  eq('a3 inzet → 0,5 laat de duur staan', task(t).time.scheduleDuration, 10);
  eq('a4 …en zet de planning NIET verouderd (zoals vandaag)', S().scheduleStale, false);
  const r2 = labor('r2');
  S().assignResource(t, r2, 1);
  eq('a5 tweede resource erbij: duur blijft 10', task(t).time.scheduleDuration, 10);
  eq('a6 …inzet r1 blijft 0,5, geen werkvelden', [asgOf(t, r1).unitsPerDay, asgOf(t, r1).remainingWorkMinutes, asgOf(t, r2).remainingWorkMinutes], [0.5, undefined, undefined]);
  eq('a7 workRuleApplies: bladtaak op werktijd', workRuleApplies(task(t)), true);
  const m = S().addTask({ name: 'm', isMilestone: true });
  eq('a8 workRuleApplies: mijlpaal niet', workRuleApplies(task(m)), false);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (b) FIXED_WORK in de store: duur, inzet, resource erbij/eraf, werk, undo --');
{
  reset();
  const t = S().addTask({ name: 'b', time: createDefaultTaskTime('2026-06-01', 4) });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().runCPM();
  const events0 = S().historyEvents.length;
  S().setTaskWorkRule(t, 'FIXED_WORK');
  eq('b1 typewissel schrijft workRule', task(t).workRule, 'FIXED_WORK');
  eq('b2 …legt het restwerk vast (4 dagen × slot)', asgOf(t, r1).remainingWorkMinutes, 4 * slot());
  eq('b3 …verandert de duur niet en zet niet verouderd', [task(t).time.scheduleDuration, S().scheduleStale], [4, false]);
  eq('b4 …is één undo-stap en dirty', [S().historyEvents.length - events0, S().isDirty], [1, true]);
  S().setTaskWorkRule(t, 'FIXED_WORK');
  eq('b5 ongewijzigde regel is een no-op (geen undo-event)', S().historyEvents.length - events0, 1);

  // Duur ×2 ⇒ inzet ×0,5, werk blijft.
  S().updateTask(t, { time: { ...task(t).time, scheduleDuration: 8 } });
  eq('b6 duur 4→8: inzet 0,5', asgOf(t, r1).unitsPerDay, 0.5);
  eq('b7 …werk blijft 4 slots', asgOf(t, r1).remainingWorkMinutes, 4 * slot());
  eq('b8 …planning verouderd', S().scheduleStale, true);
  S().runCPM();

  // Inzet → 1 ⇒ duur 4 (meetlat 28 hieronder: undo in één stap).
  const eventsBeforeUnits = S().historyEvents.length;
  S().updateAssignment(asgOf(t, r1).id, { unitsPerDay: 1 });
  eq('b9 inzet 0,5→1: duur 4', task(t).time.scheduleDuration, 4);
  eq('b10 …werk blijft, inzet exact 1', [asgOf(t, r1).remainingWorkMinutes, asgOf(t, r1).unitsPerDay], [4 * slot(), 1]);
  eq('b11 …planning verouderd', S().scheduleStale, true);
  eq('b12 …één undo-event', S().historyEvents.length - eventsBeforeUnits, 1);
  S().undo();
  eq('b13 (meetlat 28) undo zet duur én inzet in één stap terug', [task(t).time.scheduleDuration, asgOf(t, r1).unitsPerDay], [8, 0.5]);
  S().redo();
  eq('b14 redo herstelt', [task(t).time.scheduleDuration, asgOf(t, r1).unitsPerDay], [4, 1]);
  S().runCPM();

  // Resource erbij (spec §5 rij 4): werk 4 slots over twee resources à 1 ⇒ elk 2 slots, R = 2 d.
  const r2 = labor('r2');
  S().assignResource(t, r2, 1);
  eq('b15 tweede resource erbij onder FIXED_WORK: duur 2', task(t).time.scheduleDuration, 2);
  eq('b16 …werk naar rato: 2 + 2 slots', [asgOf(t, r1).remainingWorkMinutes, asgOf(t, r2).remainingWorkMinutes], [2 * slot(), 2 * slot()]);
  eq('b17 …inzet blijft zoals ingevoerd', [asgOf(t, r1).unitsPerDay, asgOf(t, r2).unitsPerDay], [1, 1]);
  eq('b18 …planning verouderd', S().scheduleStale, true);
  S().runCPM();
  // Materiaal erbij: telt niet mee (spec §4.3).
  const mat = S().addResource({ name: 'zand', type: 'MATERIAL', description: '', maxUnits: 100 });
  S().assignResource(t, mat, 10);
  eq('b19 materiaal erbij verandert de duur niet', [task(t).time.scheduleDuration, S().scheduleStale], [2, false]);
  eq('b20 …en krijgt geen werkveld', asgOf(t, mat).remainingWorkMinutes, undefined);
  // Resource eraf: r2 weg ⇒ 4 slots terug naar r1 ⇒ duur 4.
  S().unassignResource(asgOf(t, r2).id);
  eq('b21 r2 eraf: duur 4, werk 4 slots bij r1', [task(t).time.scheduleDuration, asgOf(t, r1).remainingWorkMinutes], [4, 4 * slot()]);
  S().runCPM();
  // Werk gezet (spec §5 rij 3): 8 slots bij inzet 1 ⇒ duur 8.
  S().setAssignmentWork(asgOf(t, r1).id, 8 * slot());
  eq('b22 werk → 8 slots: duur 8, inzet 1', [task(t).time.scheduleDuration, asgOf(t, r1).unitsPerDay, S().scheduleStale], [8, 1, true]);
  const eventsBeforeBad = S().historyEvents.length;
  S().setAssignmentWork(asgOf(t, r1).id, -1);
  S().setAssignmentWork('bestaat-niet', 100);
  eq('b23 ongeldig werk/onbekend id: no-op zonder undo-event', S().historyEvents.length, eventsBeforeBad);
  // Halve dag: 3 slots bij inzet 1 op dagmodus ⇒ R rondt op hele dagen; 2,5 d ⇒ 3 d.
  S().runCPM();
  S().setAssignmentWork(asgOf(t, r1).id, 2.5 * slot());
  eq('b24 2,5 dag werk rondt de duur naar boven op hele dagen', task(t).time.scheduleDuration, 3);
  eq('b25 …het werk zelf blijft 2,5 slots', asgOf(t, r1).remainingWorkMinutes, 2.5 * slot());
  // Terug naar de projectstandaard: geen getal verandert, het werkveld blijft staan.
  S().setTaskWorkRule(t, undefined);
  eq('b26 regel terug naar projectstandaard: veld weg, werk blijft', [task(t).workRule, asgOf(t, r1).remainingWorkMinutes], [undefined, 2.5 * slot()]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (c) FIXED_DURATION_WORK en projectstandaard --');
{
  reset();
  S().setProject({ defaultWorkRule: 'FIXED_DURATION_WORK' });
  const t = S().addTask({ name: 'c', time: createDefaultTaskTime('2026-06-01', 4) });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().runCPM();
  eq('c1 projectstandaard geldt zonder eigen workRule', task(t).workRule, undefined);
  S().updateAssignment(asgOf(t, r1).id, { unitsPerDay: 0.5 });
  eq('c2 inzet → 0,5: duur blijft 4, werk = R × I = 2 slots (vastgelegd)', [task(t).time.scheduleDuration, asgOf(t, r1).remainingWorkMinutes, S().scheduleStale], [4, 2 * slot(), false]);
  S().updateTask(t, { time: { ...task(t).time, scheduleDuration: 8 } });
  eq('c3 duur 4→8: inzet 0,25, werk blijft 2 slots', [asgOf(t, r1).unitsPerDay, asgOf(t, r1).remainingWorkMinutes], [0.25, 2 * slot()]);
  // MSP-afwijking 8-B: bewaard effortDriven true op FIXED_DURATION_WORK ⇒ werk volgt de duur.
  S().updateTask(t, { mspTaskType: 'FIXED_DURATION', effortDriven: true });
  S().runCPM();
  S().updateTask(t, { time: { ...task(t).time, scheduleDuration: 4 } });
  eq('c4 (8-B) FD+ED: duur 8→4 laat de inzet staan en herschrijft het werk', [asgOf(t, r1).unitsPerDay, asgOf(t, r1).remainingWorkMinutes], [0.25, slot()]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (d) contour met werkbehoud (meetlat 22/23) --');
{
  reset();
  const t = S().addTask({ name: 'd', time: createDefaultTaskTime('2026-06-01', 4) });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().runCPM();
  S().setTaskWorkRule(t, 'FIXED_WORK');
  // Vooraan belast: 2, 1, 0,5, 0,5 slots (som 4).
  const mpd = slot();
  S().setAssignmentContour(asgOf(t, r1).id, workDaySlotsToPeriods([2 * mpd, mpd, 0.5 * mpd, 0.5 * mpd], undefined, mpd));
  const workBefore = task(t).timephasedContours![0].periods.reduce((s, p) => s + p.workMinutes, 0);
  S().updateTask(t, { time: { ...task(t).time, scheduleDuration: 8 } });
  const c = task(t).timephasedContours![0].periods;
  eq('d1 (22) werk in de contour blijft na duur ×2', c.reduce((s, p) => s + p.workMinutes, 0), workBefore);
  eq('d2 (22) as ×2', c.reduce((m, p) => Math.max(m, p.afterMinutes + p.minutes), 0), 8 * mpd);
  eq('d3 inzet 0,5', asgOf(t, r1).unitsPerDay, 0.5);
  eq('d4 contourKeepsWork volgt de regel (eigen veld wint van MSP-vinkje)', [
    contourKeepsWork({ workRule: 'FIXED_WORK', mspTaskType: 'FIXED_UNITS' }),
    contourKeepsWork({ workRule: 'FIXED_DURATION_RATE', mspTaskType: 'FIXED_WORK' }),
    contourKeepsWork({ workRule: undefined, mspTaskType: 'FIXED_WORK' }),
    contourKeepsWork({ workRule: undefined, mspTaskType: undefined }, 'FIXED_DURATION_WORK'),
    contourKeepsWork({ workRule: undefined, mspTaskType: undefined }),
  ], [true, false, true, true, false]);
  // (23) tweede resource erbij à 0,5 naast r1 à 0,5: werk (4 slots) naar rato ⇒ 2 + 2;
  // R = 2 / 0,5 = 4 d ⇒ de as van r1's contour gaat van 8 terug naar 4 d, de HOOGTE halveert
  // (besluit 3: vorm blijft, hoogte zakt — `reconcileContourWork`); r2 heeft geen contour (vlak).
  S().runCPM();
  const r2 = labor('r2');
  S().assignResource(t, r2, 0.5);
  eq('d5 (23) duur uit W/ΣI: 4 dagen', task(t).time.scheduleDuration, 4);
  eq('d6 (23) werk 2 + 2 slots', [asgOf(t, r1).remainingWorkMinutes, asgOf(t, r2).remainingWorkMinutes], [2 * mpd, 2 * mpd]);
  const c2 = task(t).timephasedContours!.find((k) => k.resourceId === r1)!.periods;
  eq('d7 (23) contour r1: as 4 d, hoogte ×0,5 (som = nieuw restwerk)', [c2.reduce((m, p) => Math.max(m, p.afterMinutes + p.minutes), 0), c2.reduce((s, p) => s + p.workMinutes, 0)], [4 * mpd, 2 * mpd]);
  eq('d7b (23) vorm blijft: verhouding eerste/laatste periode ongewijzigd (4 : 1)', c2[0].workMinutes / c2[c2.length - 1].workMinutes, 4);
  eq('d8 (23) r2 heeft geen contour (vlak)', task(t).timephasedContours!.some((k) => k.resourceId === r2), false);
  eq('d9 (23) histogram r1 boekt de gehalveerde contour (som 2 dag-eenheden)', assignmentDayUnits(task(t), asgOf(t, r1), mpd, undefined, S().assignments.filter((a) => a.taskId === t)).map((u) => Math.round(u * 1000) / 1000), [1, 0.5, 0.25, 0.25]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (e) taakraster: dezelfde regels via gridTransaction --');
{
  reset();
  const t = S().addTask({ name: 'e', time: createDefaultTaskTime('2026-06-01', 4) });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().runCPM();
  S().setTaskWorkRule(t, 'FIXED_WORK');
  const cell = (columnId: string, route: CellEditIntent['route'], value: unknown): CellEditIntent =>
    ({ kind: 'cell-edit', taskId: t, columnId: columnId as CellEditIntent['columnId'], route, value });
  const res = runGridMutation([cell('task.time.scheduleDuration', 'task-schedule', 8 * slot())]);
  eq('e1 rasterduur 4→8 slaagt', res.ok, true);
  eq('e2 …inzet 0,5, werk blijft', [asgOf(t, r1).unitsPerDay, asgOf(t, r1).remainingWorkMinutes], [0.5, 4 * slot()]);
  S().runCPM();
  const set: AssignmentSetIntent = {
    kind: 'assignment-set', taskId: t, columnId: 'assignment.unitsPerDay' as AssignmentSetIntent['columnId'],
    tokens: [{ resourceId: r1, assignmentId: asgOf(t, r1).id, unitsPerDay: 1 }],
  };
  const res2 = runGridMutation([set]);
  eq('e3 rasterinzet 0,5→1 slaagt', res2.ok, true);
  eq('e4 …duur 4, planning verouderd', [task(t).time.scheduleDuration, S().scheduleStale], [4, true]);
  S().undo();
  eq('e5 undo in één stap', [task(t).time.scheduleDuration, asgOf(t, r1).unitsPerDay], [8, 0.5]);
  S().redo();
  S().runCPM();
  const r2 = labor('r2');
  const add: AssignmentSetIntent = {
    kind: 'assignment-set', taskId: t, columnId: 'assignment.resources' as AssignmentSetIntent['columnId'],
    tokens: [{ resourceId: r1, assignmentId: asgOf(t, r1).id, unitsPerDay: 1 }, { resourceId: r2, unitsPerDay: 1 }],
  };
  eq('e6 resource erbij via de Resources-cel slaagt', runGridMutation([add]).ok, true);
  eq('e7 …duur 2, werk 2 + 2 slots', [task(t).time.scheduleDuration, asgOf(t, r1).remainingWorkMinutes, asgOf(t, r2).remainingWorkMinutes], [2, 2 * slot(), 2 * slot()]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (f) MCP-tweeling --');
{
  reset();
  const t = S().addTask({ name: 'f', time: createDefaultTaskTime('2026-06-01', 4) });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().runCPM();
  const r = runInMcpTransaction(() => {
    draft.setTaskWorkRule(t, 'FIXED_WORK');
    draft.patchTaskFields(t, {}, { scheduleDuration: 8 });
  });
  eq('f1 MCP: typewissel + duur 4→8', [r.ok, asgOf(t, r1).unitsPerDay, asgOf(t, r1).remainingWorkMinutes], [true, 0.5, 4 * slot()]);
  const r2 = runInMcpTransaction(() => { draft.updateAssignment(asgOf(t, r1).id, { unitsPerDay: 1 }); });
  eq('f2 MCP: inzet → 1 ⇒ duur 4', [r2.ok, task(t).time.scheduleDuration], [true, 4]);
  const rid2 = labor('r2');
  const r3 = runInMcpTransaction(() => { draft.assignResource(t, rid2, 1); });
  eq('f3 MCP: resource erbij ⇒ duur 2', [r3.ok, task(t).time.scheduleDuration], [true, 2]);
  const r4 = runInMcpTransaction(() => { draft.unassignResource(asgOf(t, rid2).id); });
  eq('f4 MCP: resource eraf ⇒ duur 4', [r4.ok, task(t).time.scheduleDuration, asgOf(t, r1).remainingWorkMinutes], [true, 4, 4 * slot()]);
  const r5 = runInMcpTransaction(() => { draft.setAssignmentWork(asgOf(t, r1).id, 8 * slot()); });
  eq('f5 MCP: werk → 8 slots ⇒ duur 8', [r5.ok, task(t).time.scheduleDuration], [true, 8]);
  const r6 = runInMcpTransaction(() => { draft.setAssignmentWork(asgOf(t, r1).id, 0); });
  eq('f6 MCP: werk 0 is een fout (transactie teruggerold)', [r6.ok, task(t).time.scheduleDuration], [false, 8]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (g) assignmentDayUnits: opgeslagen werk als vierde bron --');
{
  const t = { id: 't', time: { ...createDefaultTaskTime('2026-06-01', 4) } } as Task;
  const base: ResourceAssignment = { id: 'a', taskId: 't', resourceId: 'r', unitsPerDay: 1 };
  eq('g1 zonder werkveld: formule (byte-identiek)', assignmentDayUnits(t, base, 480), [1, 1, 1, 1]);
  const r3 = (xs: number[]) => xs.map((v) => Math.round(v * 1e6) / 1e6);
  eq('g2 restwerk 2 slots op 4 dagen ⇒ 0,5/dag', r3(assignmentDayUnits(t, { ...base, remainingWorkMinutes: 960 }, 480)), [0.5, 0.5, 0.5, 0.5]);
  const front = assignmentDayUnits(t, { ...base, remainingWorkMinutes: 960, curve: 'FRONT_LOADED' }, 480);
  ok('g3 vooraan belast: eerste dag > laatste dag, som 2', front[0] > front[3] && near(front.reduce((s, v) => s + v, 0), 2));
  eq('g4 verricht + resterend telt samen', r3(assignmentDayUnits(t, { ...base, remainingWorkMinutes: 480, actualWorkMinutes: 480 }, 480)), [0.5, 0.5, 0.5, 0.5]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (h) voortgang > 0: geen drift, voortgangsbewerking is geen duurbewerking (review B1/B2/B3) --');
{
  reset();
  const t = S().addTask({ name: 'h', time: createDefaultTaskTime('2026-06-01', 10) });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().updateTask(t, { time: { ...task(t).time, completion: 0.5 } });
  S().runCPM();
  const mpd = slot();
  const loadBefore = assignmentDayUnits(task(t), asgOf(t, r1), mpd);
  S().setTaskWorkRule(t, 'FIXED_WORK');
  eq('h1 typewissel legt alleen het RESTwerk vast (5 dagen)', asgOf(t, r1).remainingWorkMinutes, 5 * mpd);
  const r6 = (xs: number[]) => xs.map((v) => Math.round(v * 1e6) / 1e6);
  eq('h2 (B3) histogram na typewissel ongewijzigd (verricht deel afgeleid)', r6(assignmentDayUnits(task(t), asgOf(t, r1), mpd)), r6(loadBefore));
  // Voortgangsbewerking via updateTask met een gespreide time-tak (TaskDialog-patroon) raakt de inzet niet.
  S().updateTask(t, { time: { ...task(t).time, completion: 0.7 } });
  eq('h3 (B1) completion-wijziging via updateTask laat de inzet staan', asgOf(t, r1).unitsPerDay, 1);
  S().updateTask(t, { time: { ...task(t).time, completion: 0.5 } });
  S().runCPM();
  // Inzet 1→2 op een half gedane taak: rest 5 d × 1 = 5 slots werk ⇒ R = 2,5 ⇒ 3 d; duur = 5 + 3 = 8.
  S().updateAssignment(asgOf(t, r1).id, { unitsPerDay: 2 });
  eq('h4 (B2) inzet 1→2: duur 8 (5 gedaan + 3 rest), rest expliciet 3', [task(t).time.scheduleDuration, task(t).time.remainingTime], [8, 3]);
  S().runCPM();
  S().updateAssignment(asgOf(t, r1).id, { unitsPerDay: 1 });
  eq('h5 (B2) inzet 2→1: terug naar 10, rest 5 — geen drift', [task(t).time.scheduleDuration, task(t).time.remainingTime], [10, 5]);
  S().runCPM();
  S().updateAssignment(asgOf(t, r1).id, { unitsPerDay: 2 });
  S().runCPM();
  S().updateAssignment(asgOf(t, r1).id, { unitsPerDay: 1 });
  eq('h6 (case 31) heen-en-weer blijft 10', task(t).time.scheduleDuration, 10);
  // Raster: een voortgangscel verandert de rest, niet de duur ⇒ geen driehoekstap.
  const cellP = (columnId: string, route: CellEditIntent['route'], value: unknown): CellEditIntent =>
    ({ kind: 'cell-edit', taskId: t, columnId: columnId as CellEditIntent['columnId'], route, value });
  eq('h7 (B1) rastercel completion 0,5→0,8 slaagt', runGridMutation([cellP('task.time.completion', 'task-progress', 0.8)]).ok, true);
  eq('h8 (B1) …en laat inzet en duur staan', [asgOf(t, r1).unitsPerDay, task(t).time.scheduleDuration], [1, 10]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (i) uurmodus --');
{
  reset();
  const t = S().addTask({ name: 'i', time: createDefaultTaskTime('2026-06-01', 4, 'hours') });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().runCPM();
  eq('i0 voorwaarde: uurtaak van 240 minuten', [task(t).time.durationUnit, task(t).time.durationMinutes], ['hours', 240]);
  S().setTaskWorkRule(t, 'FIXED_WORK');
  eq('i1 restwerk vastgelegd in minuten', asgOf(t, r1).remainingWorkMinutes, 240);
  S().setAssignmentWork(asgOf(t, r1).id, 360);
  eq('i2 werk 360 min bij inzet 1 ⇒ duur 360 min (geen dagafronding)', [task(t).time.durationMinutes, task(t).time.scheduleDuration], [360, 360 / slot()]);
  S().runCPM();
  S().updateAssignment(asgOf(t, r1).id, { unitsPerDay: 2 });
  eq('i3 inzet 2 ⇒ 180 min', task(t).time.durationMinutes, 180);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (j) FIXED_RATE en de 8-B-cel effortDriven:false --');
{
  reset();
  const t = S().addTask({ name: 'j', time: createDefaultTaskTime('2026-06-01', 4) });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().runCPM();
  S().setTaskWorkRule(t, 'FIXED_RATE');
  const r2 = labor('r2');
  S().assignResource(t, r2, 1);
  eq('j1 FIXED_RATE (zuiver P6): resource erbij verdeelt het werk ⇒ duur 2', task(t).time.scheduleDuration, 2);
  S().runCPM();
  S().unassignResource(asgOf(t, r2).id);
  eq('j2 …eraf ⇒ terug naar 4', task(t).time.scheduleDuration, 4);
  S().runCPM();
  S().setAssignmentWork(asgOf(t, r1).id, 8 * slot());
  eq('j3 FIXED_RATE: meer werk ⇒ langer (8), inzet blijft 1', [task(t).time.scheduleDuration, asgOf(t, r1).unitsPerDay], [8, 1]);
  S().runCPM();
  // 8-B: MSP "Fixed Units, niet effort-driven" ⇒ resource erbij verandert het werk, niet de duur.
  S().updateTask(t, { mspTaskType: 'FIXED_UNITS', effortDriven: false });
  S().runCPM();
  S().assignResource(t, r2, 1);
  eq('j4 (8-B) FIXED_RATE + effortDriven:false: erbij laat de duur staan', task(t).time.scheduleDuration, 8);
  // De kern schrijft de nieuwkomer geen veld (afwezig ⇒ afgeleid als R × I, hetzelfde getal).
  eq('j5 (8-B) …de nieuwe toewijzing krijgt geen veld (afgeleid = R × I)', asgOf(t, r2).remainingWorkMinutes, undefined);
  S().runCPM();
  S().unassignResource(asgOf(t, r2).id);
  eq('j6 (8-B) …eraf laat de duur staan', task(t).time.scheduleDuration, 8);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (k) raster: materiaal, gemengde Resources-cel (K6), datums-zoals-opgeslagen --');
{
  reset();
  const t = S().addTask({ name: 'k', time: createDefaultTaskTime('2026-06-01', 4) });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().runCPM();
  S().setTaskWorkRule(t, 'FIXED_WORK');
  const mat = S().addResource({ name: 'beton', type: 'MATERIAL', description: '', maxUnits: 100 });
  const addMat: AssignmentSetIntent = {
    kind: 'assignment-set', taskId: t, columnId: 'assignment.resources' as AssignmentSetIntent['columnId'],
    tokens: [{ resourceId: r1, assignmentId: asgOf(t, r1).id, unitsPerDay: 1 }, { resourceId: mat, unitsPerDay: 20 }],
  };
  eq('k1 materiaal erbij via het raster slaagt', runGridMutation([addMat]).ok, true);
  eq('k2 …en verandert de duur niet, geen werkveld op materiaal', [task(t).time.scheduleDuration, asgOf(t, mat).remainingWorkMinutes], [4, undefined]);
  // Gemengde cel: r1 eraf + r2 erbij (à 0,5) in één keer. Volgorde verwijderen → toevoegen:
  // r1's werk (4 slots) gaat naar de blijvers — er zijn er geen (materiaal stuurt niet), dus het
  // werk vervalt; r2 komt daarna als EERSTE werkresource en krijgt geen veld (afwezig ⇒ afgeleid
  // als R × I = 4 × 0,5 = 2 slots); de duur blijft 4.
  const r2 = labor('r2');
  const swap: AssignmentSetIntent = {
    kind: 'assignment-set', taskId: t, columnId: 'assignment.resources' as AssignmentSetIntent['columnId'],
    tokens: [{ resourceId: mat, assignmentId: asgOf(t, mat).id, unitsPerDay: 20 }, { resourceId: r2, unitsPerDay: 0.5 }],
  };
  eq('k3 (K6) r1 eraf + r2 erbij in één cel slaagt', runGridMutation([swap]).ok, true);
  eq('k4 (K6) volgorde verwijderen→toevoegen: duur 4, r2 zonder veld (afgeleid), r1 weg', [task(t).time.scheduleDuration, asgOf(t, r2).remainingWorkMinutes, S().assignments.some((a) => a.resourceId === r1)], [4, undefined, false]);
  // Datums zoals opgeslagen: een duur uit de driehoek verlaat die modus (zelfde als een duurcel).
  S().runCPM();
  useAppStore.setState((s) => { s.datesAsRecorded = true; s.recordedDates = {} as never; });
  const units: AssignmentSetIntent = {
    kind: 'assignment-set', taskId: t, columnId: 'assignment.unitsPerDay' as AssignmentSetIntent['columnId'],
    tokens: [{ resourceId: mat, assignmentId: asgOf(t, mat).id, unitsPerDay: 20 }, { resourceId: r2, assignmentId: asgOf(t, r2).id, unitsPerDay: 1 }],
  };
  eq('k5 inzet r2 0,5→1 onder FIXED_WORK via het raster slaagt', runGridMutation([units]).ok, true);
  eq('k6 …duur 2, planning verouderd, datums-zoals-opgeslagen verlaten', [task(t).time.scheduleDuration, S().scheduleStale, S().datesAsRecorded, S().recordedDates], [2, true, false, null]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (l) moveAssignment en removeResource lopen door de driehoek (review B4) --');
{
  reset();
  const a = S().addTask({ name: 'la', time: createDefaultTaskTime('2026-06-01', 4) });
  const b = S().addTask({ name: 'lb', time: createDefaultTaskTime('2026-06-01', 4) });
  const r1 = labor('r1');
  const r2 = labor('r2');
  S().assignResource(a, r1, 1);
  S().assignResource(a, r2, 1);
  S().assignResource(b, r1, 1);
  S().runCPM();
  S().setTaskWorkRule(a, 'FIXED_WORK');
  S().setTaskWorkRule(b, 'FIXED_WORK');
  // a: r1 en r2 elk 4 slots vastgelegd (8 slots totaal); b: r1 4 slots. r2 van a naar b:
  // a ⇒ "eraf": al het restwerk (8 slots) blijft en gaat naar r1 ⇒ R = 8 d (spec §5 rij 5);
  // b ⇒ "erbij": 4 slots over r1 + r2 naar rato ⇒ 2 + 2, R = 2 d.
  const events0 = S().historyEvents.length;
  S().moveAssignment(asgOf(a, r2).id, b);
  eq('l1 verplaatsen: oude taak houdt al haar werk bij r1 (8 slots ⇒ duur 8)', [asgOf(a, r1).remainingWorkMinutes, task(a).time.scheduleDuration], [8 * slot(), 8]);
  eq('l2 verplaatsen: nieuwe taak verdeelt haar werk ⇒ duur 2, 2 + 2', [task(b).time.scheduleDuration, asgOf(b, r1).remainingWorkMinutes, asgOf(b, r2).remainingWorkMinutes], [2, 2 * slot(), 2 * slot()]);
  eq('l3 …één undo-stap, planning verouderd', [S().historyEvents.length - events0, S().scheduleStale], [1, true]);
  S().runCPM();
  // Resource r2 verwijderen: b verliest r2 ⇒ 4 slots terug naar r1 ⇒ duur 4.
  S().removeResource(r2);
  eq('l4 removeResource: b terug naar 4 dagen met al het werk bij r1', [task(b).time.scheduleDuration, asgOf(b, r1).remainingWorkMinutes, S().scheduleStale], [4, 4 * slot(), true]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (m) workRule via de generieke updateTask legt óók vast (review K1) --');
{
  reset();
  const t = S().addTask({ name: 'm', time: createDefaultTaskTime('2026-06-01', 4) });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().runCPM();
  S().updateTask(t, { workRule: 'FIXED_WORK' });
  eq('m1 updateTask({ workRule }) zet de regel én legt het werk vast', [task(t).workRule, asgOf(t, r1).remainingWorkMinutes], ['FIXED_WORK', 4 * slot()]);
  const events0 = S().historyEvents.length;
  S().updateTask(t, { workRule: 'FIXED_WORK' });
  eq('m2 ongewijzigde regel via updateTask: wel een (lege) stap zoals elke updateTask, geen getal veranderd', [asgOf(t, r1).unitsPerDay, task(t).time.scheduleDuration], [1, 4]);
  void events0;
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (n) bouwstap 5: ontsluiting, instelling en de rasterkolommen Werkregel / Resterend werk --');
{
  eq('n1 hasTaskTypeData: leeg ⇒ false', hasTaskTypeData([], []), false);
  eq('n2 hasTaskTypeData: workRule/mspTaskType/p6DurationType/werkveld/projectstandaard ⇒ true', [
    hasTaskTypeData([{ workRule: 'FIXED_WORK' }], []),
    hasTaskTypeData([{ mspTaskType: 'FIXED_UNITS' }], []),
    hasTaskTypeData([{ p6DurationType: 'DT_FixedQty' }], []),
    hasTaskTypeData([], [{ remainingWorkMinutes: 60 }]),
    hasTaskTypeData([], [], { defaultWorkRule: 'FIXED_RATE' }),
  ], [true, true, true, true, true]);
  ok('n3 instelling showTaskTypes staat in het register', SETTINGS.some((d) => d.key === 'showTaskTypes' && d.field === 'showTaskTypes'));
  reset();
  eq('n4 vers document: niet ontsloten, instelling uit', [S().taskTypesVisible, S().ui.showTaskTypes], [false, false]);
  const t = S().addTask({ name: 'n', time: createDefaultTaskTime('2026-06-01', 4) });
  const r1 = labor('r1');
  S().assignResource(t, r1, 1);
  S().runCPM();
  S().setTaskWorkRule(t, 'FIXED_WORK');
  eq('n5 een gezette regel ontsluit het document', S().taskTypesVisible, true);
  // Raster: de kolom Werkregel is alleen beschikbaar wanneer ontsloten.
  const registry = buildTaskColumnRegistry({ projectId: S().project.id, activityCodeTypes: [], customFieldDefs: [], baselines: [], customTaskTypes: [] });
  const workRuleCol = registry.find((d) => String(d.id) === 'task.workRule')!;
  const workCol = registry.find((d) => String(d.id) === 'assignment.remainingWork')!;
  const ctxBase = { projectId: S().project.id, tasksById: new Map(), relationIndex: buildTaskRelationIndex([], [], null), assignmentsByTaskId: new Map(), resourcesById: new Map(), baselinesById: new Map(), scheduleStale: false };
  eq('n6 Werkregel- en Resterend-werk-kolom alleen beschikbaar wanneer ontsloten', [
    workRuleCol.available({ ...ctxBase, taskTypesUnlocked: true }), workRuleCol.available(ctxBase),
    workCol.available({ ...ctxBase, taskTypesUnlocked: true }), workCol.available(ctxBase),
  ], [true, false, true, false]);
  eq('n7 Werkregel is bewerkbaar met de vier waarden + projectstandaard', workRuleCol.editorOptions?.map((o) => o.value), ['', 'FIXED_DURATION_RATE', 'FIXED_DURATION_WORK', 'FIXED_WORK', 'FIXED_RATE']);
  // Raster: typewissel via de cel legt het werk vast (zelfde als setTaskWorkRule), terug naar '' wist.
  S().setTaskWorkRule(t, undefined);
  useAppStore.setState((s) => { const a = s.assignments.find((x) => x.taskId === t)!; delete a.remainingWorkMinutes; });
  const cell = (columnId: string, route: CellEditIntent['route'], value: unknown): CellEditIntent =>
    ({ kind: 'cell-edit', taskId: t, columnId: columnId as CellEditIntent['columnId'], route, value });
  eq('n8 rastercel Werkregel → FIXED_WORK slaagt', runGridMutation([cell('task.workRule', 'task-field', 'FIXED_WORK')]).ok, true);
  eq('n9 …regel gezet én werk vastgelegd (4 slots)', [task(t).workRule, asgOf(t, r1).remainingWorkMinutes], ['FIXED_WORK', 4 * slot()]);
  eq('n10 rastercel Werkregel → leeg slaagt en wist het veld', [runGridMutation([cell('task.workRule', 'task-field', undefined)]).ok, task(t).workRule], [true, undefined]);
  eq('n11 rastercel Werkregel ongeldig wordt geweigerd', runGridMutation([cell('task.workRule', 'task-field', 'fixed_work')]).ok, false);
  // Raster: Resterend werk als assignment-set: 4 slots → 8 slots onder FIXED_WORK ⇒ duur 8.
  S().setTaskWorkRule(t, 'FIXED_WORK');
  S().runCPM();
  const setWork: AssignmentSetIntent = {
    kind: 'assignment-set', taskId: t, columnId: 'assignment.remainingWork' as AssignmentSetIntent['columnId'],
    tokens: [{ resourceId: r1, assignmentId: asgOf(t, r1).id, unitsPerDay: 1, remainingWorkMinutes: 8 * slot() }],
  };
  eq('n12 rastercel Resterend werk slaagt', runGridMutation([setWork]).ok, true);
  eq('n13 …duur 8, werk 8 slots, planning verouderd', [task(t).time.scheduleDuration, asgOf(t, r1).remainingWorkMinutes, S().scheduleStale], [8, 8 * slot(), true]);
  S().undo();
  eq('n14 …undo in één stap', [task(t).time.scheduleDuration, asgOf(t, r1).remainingWorkMinutes], [4, 4 * slot()]);
  // Parser van de kolom: "naam: uren".
  const parsed = workCol.parse!('r1: 12', task(t), { ...ctxBase, taskTypesUnlocked: true, tasksById: new Map([[t, task(t)]]), assignmentsByTaskId: new Map([[t, S().assignments.filter((a) => a.taskId === t)]]), resourcesById: new Map(S().resources.map((r) => [r.id, r])), effectiveHoursPerDay: () => S().calendar.hoursPerDay });
  eq('n15 parser "r1: 12" ⇒ 720 werkminuten', parsed.ok ? (parsed.value as { remainingWorkMinutes?: number }[])[0]?.remainingWorkMinutes : parsed, 720);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (o) reviewronde stap 5: plakken behoudt werk, werkcel bevriest niets, typewissel via paneel, melding na newProject --');
{
  reset();
  const t = S().addTask({ name: 'o', time: createDefaultTaskTime('2026-06-01', 4) });
  const r1 = labor('r1');
  const r2 = labor('r2');
  S().assignResource(t, r1, 1);
  S().assignResource(t, r2, 1);
  S().runCPM();
  const registry = buildTaskColumnRegistry({ projectId: S().project.id, activityCodeTypes: [], customFieldDefs: [], baselines: [], customTaskTypes: [] });
  const workCol = registry.find((d) => String(d.id) === 'assignment.remainingWork')!;
  const ctxOf = () => ({
    projectId: S().project.id, tasksById: new Map([[t, task(t)]]), relationIndex: buildTaskRelationIndex([], [], null),
    assignmentsByTaskId: new Map([[t, S().assignments.filter((a) => a.taskId === t)]]),
    resourcesById: new Map(S().resources.map((r) => [r.id, r])), baselinesById: new Map(), scheduleStale: false,
    taskTypesUnlocked: true, effectiveHoursPerDay: () => S().calendar.hoursPerDay,
  });
  // (B1) tokens met een VREEMD assignmentId (plakken vanaf een andere taak) houden hun werk.
  const foreign = [{ assignmentId: 'van-andere-taak', resourceId: r1, unitsPerDay: 1, remainingWorkMinutes: 600 }];
  const validated = workCol.validate!(foreign, task(t), ctxOf());
  eq('o1 (B1) cross-task tokens behouden remainingWorkMinutes na normalisatie', validated.ok ? (validated.value as { remainingWorkMinutes?: number }[])[0]?.remainingWorkMinutes : validated, 600);
  // (B2) FIXED_RATE, twee toewijzingen zonder opgeslagen werk: alleen r1 bewerken laat r2 zonder veld.
  S().setTaskWorkRule(t, 'FIXED_RATE');
  useAppStore.setState((s) => { for (const a of s.assignments) if (a.taskId === t) delete a.remainingWorkMinutes; });
  S().runCPM();
  const cell: AssignmentSetIntent = {
    kind: 'assignment-set', taskId: t, columnId: 'assignment.remainingWork' as AssignmentSetIntent['columnId'],
    tokens: [
      { resourceId: r1, assignmentId: asgOf(t, r1).id, unitsPerDay: 1, remainingWorkMinutes: 8 * slot() },
      { resourceId: r2, assignmentId: asgOf(t, r2).id, unitsPerDay: 1, remainingWorkMinutes: 4 * slot() }, // = de getoonde waarde
    ],
  };
  eq('o2 (B2) werkcel met r2 op de getoonde waarde slaagt', runGridMutation([cell]).ok, true);
  eq('o3 (B2) r1 8 slots ⇒ duur 8; r2 krijgt GEEN expliciet werk (blijft afgeleid)', [task(t).time.scheduleDuration, asgOf(t, r1).remainingWorkMinutes, asgOf(t, r2).remainingWorkMinutes], [8, 8 * slot(), undefined]);
  // (B3) typewissel via de generieke updateTask zet niet verouderd (setTaskWorkRule is de UI-route).
  S().runCPM();
  useAppStore.setState((s) => { s.datesAsRecorded = true; s.recordedDates = {} as never; });
  S().setTaskWorkRule(t, 'FIXED_WORK');
  eq('o4 (B3) setTaskWorkRule laat scheduleStale en datums-zoals-opgeslagen ongemoeid', [S().scheduleStale, S().datesAsRecorded], [false, true]);
  useAppStore.setState((s) => { s.datesAsRecorded = false; s.recordedDates = null; });
  // (K4) werk zetten op een ELAPSEDTIME-taak is een no-op zonder undo-stap.
  const e = S().addTask({ name: 'elapsed', time: { ...createDefaultTaskTime('2026-06-01', 4), durationType: 'ELAPSEDTIME' } });
  S().assignResource(e, r1, 1);
  const events0 = S().historyEvents.length;
  S().setAssignmentWork(asgOf(e, r1).id, 480);
  eq('o5 (K4) setAssignmentWork op ELAPSEDTIME: no-op, geen undo-stap', [S().historyEvents.length - events0, asgOf(e, r1).remainingWorkMinutes], [0, undefined]);
  // (K1) melding: één per document, opnieuw na newProject op hetzelfde docId.
  __resetTaskTypesNoticeForTests();
  const docId = S().activeDocumentId;
  const count = () => S().ui.notifications.filter((n) => n.messageKey === 'notifications.taskTypesUnlocked').length;
  notifyTaskTypesUnlocked(S().notify, docId);
  notifyTaskTypesUnlocked(S().notify, docId);
  eq('o6 (K1) melding één keer per document', count(), 1);
  // De toast-lijst vouwt op `dedupeKey` samen zolang de vorige nog staat; leeg 'm dus eerst, zodat
  // alleen de sessie-gate (per docId) telt.
  S().newProject();
  useAppStore.setState((s) => { s.ui.notifications = []; });
  notifyTaskTypesUnlocked(S().notify, S().activeDocumentId);
  eq('o7 (K1) na newProject (zelfde tabblad) opnieuw meldbaar', count(), 1);
  useAppStore.setState((s) => { s.ui.notifications = []; });
  notifyTaskTypesUnlocked(S().notify, S().activeDocumentId);
  eq('o7b (K1) …maar daarna weer één keer per document', count(), 0);
  // (K3) de generieke updateTask en de MCP-tweeling ontsluiten óók.
  reset();
  const t2 = S().addTask({ name: 'k3', time: createDefaultTaskTime('2026-06-01', 2) });
  S().updateTask(t2, { workRule: 'FIXED_WORK' });
  eq('o8 (K3) updateTask({ workRule }) ontsluit het document', S().taskTypesVisible, true);
  reset();
  const t3 = S().addTask({ name: 'k3b', time: createDefaultTaskTime('2026-06-01', 2) });
  runInMcpTransaction(() => { draft.setTaskWorkRule(t3, 'FIXED_RATE'); });
  eq('o9 (K3) MCP setTaskWorkRule ontsluit het document', S().taskTypesVisible, true);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (p) eigenaarsbesluiten 2026-09-05: kalenderwissel door de werkregel (K2) en rest schuift mee met Δ --');
{
  reset();
  // Een tweede kalender met 6 u/dag: kopie van de projectkalender met andere hoursPerDay.
  const base = S().calendar;
  const six = S().addCalendar({ ...base, id: 'cal-6h', name: '6 uur', hoursPerDay: 6 } as never);
  const sixId = typeof six === 'string' ? six : 'cal-6h';
  eq('p0 voorwaarde: projectkalender 8 u/dag, tweede kalender 6 u/dag', [base.hoursPerDay, S().calendars.find((c) => c.id === sixId)?.hoursPerDay], [8, 6]);
  const mk = (rule: 'FIXED_WORK' | 'FIXED_DURATION_WORK' | 'FIXED_DURATION_RATE' | 'FIXED_RATE' | undefined) => {
    const t = S().addTask({ name: `p-${rule ?? 'std'}`, time: createDefaultTaskTime('2026-06-01', 4) });
    const r = labor(`r-${rule ?? 'std'}`);
    S().assignResource(t, r, 1);
    S().runCPM();
    if (rule) S().setTaskWorkRule(t, rule);
    return { t, r };
  };
  // (32) FIXED_WORK: 32 u blijft, 6 u/dag ⇒ 6 dagen.
  const a = mk('FIXED_WORK');
  const events0 = S().historyEvents.length;
  S().setTaskCalendar(a.t, sixId);
  eq('p1 (32) FIXED_WORK: kalender 8→6 u/dag ⇒ duur 6, werk 32 u, inzet 1', [task(a.t).time.scheduleDuration, asgOf(a.t, a.r).remainingWorkMinutes, asgOf(a.t, a.r).unitsPerDay, S().scheduleStale], [6, 32 * 60, 1, true]);
  eq('p2 …één undo-stap', S().historyEvents.length - events0, 1);
  S().undo();
  eq('p3 …undo zet kalender én duur terug', [task(a.t).calendarId, task(a.t).time.scheduleDuration], [undefined, 4]);
  S().redo();
  S().runCPM();
  // (33) FIXED_DURATION_WORK: duur 4 blijft, inzet 32/24 = 1,333.
  const b = mk('FIXED_DURATION_WORK');
  S().setTaskCalendar(b.t, sixId);
  eq('p4 (33) FIXED_DURATION_WORK: duur 4, inzet 1,3333, werk 32 u', [task(b.t).time.scheduleDuration, asgOf(b.t, b.r).unitsPerDay, asgOf(b.t, b.r).remainingWorkMinutes], [4, 1.3333, 32 * 60]);
  // (34) standaardregel zonder veld: byte-identiek (geen veld, duur 4, inzet 1).
  const c = mk(undefined);
  const before = JSON.stringify(asgOf(c.t, c.r));
  S().setTaskCalendar(c.t, sixId);
  eq('p5 (34) standaardregel zonder werkveld: toewijzing byte-identiek, duur 4', [JSON.stringify(asgOf(c.t, c.r)) === before, task(c.t).time.scheduleDuration], [true, 4]);
  // (34) standaardregel mét veld: werk volgt (32 → 24 u).
  const d = mk(undefined);
  useAppStore.setState((s) => { s.assignments.find((x) => x.taskId === d.t)!.remainingWorkMinutes = 32 * 60; });
  S().setTaskCalendar(d.t, sixId);
  eq('p6 (34) standaardregel mét werkveld: werk volgt naar 24 u', [task(d.t).time.scheduleDuration, asgOf(d.t, d.r).remainingWorkMinutes], [4, 24 * 60]);
  // Uurtaak: geen slotafhankelijke duur ⇒ niets.
  const h = S().addTask({ name: 'p-hours', time: createDefaultTaskTime('2026-06-01', 4, 'hours') });
  const hr = labor('r-h');
  S().assignResource(h, hr, 1);
  S().runCPM();
  S().setTaskWorkRule(h, 'FIXED_WORK');
  S().setTaskCalendar(h, sixId);
  eq('p7 uurtaak: kalenderwissel raakt duur noch inzet', [task(h).time.durationMinutes, asgOf(h, hr).unitsPerDay], [240, 1]);
  // Via de generieke updateTask (dialoog/paneel-patch) en via het raster.
  const e = mk('FIXED_WORK');
  S().updateTask(e.t, { calendarId: sixId });
  eq('p8 updateTask({ calendarId }) loopt ook door de regel ⇒ duur 6', task(e.t).time.scheduleDuration, 6);
  const f = mk('FIXED_WORK');
  const cellCal: CellEditIntent = { kind: 'cell-edit', taskId: f.t, columnId: 'task.calendarId' as CellEditIntent['columnId'], route: 'task-schedule', value: sixId };
  eq('p9 rastercel kalender slaagt en volgt de regel ⇒ duur 6', [runGridMutation([cellCal]).ok, task(f.t).time.scheduleDuration], [true, 6]);
  // Projectkalender: taken zonder eigen kalender volgen; melding met aantal.
  reset();
  const six2 = S().addCalendar({ ...S().calendar, id: 'cal-6h-b', name: '6 uur', hoursPerDay: 6 } as never);
  const six2Id = typeof six2 === 'string' ? six2 : 'cal-6h-b';
  const g1 = mk('FIXED_WORK');
  const g2 = mk('FIXED_RATE');
  const g3 = mk(undefined);
  useAppStore.setState((s) => { s.ui.notifications = []; });
  S().setProjectCalendar(six2Id);
  eq('p10 projectkalender 8→6: Vast werk en Vaste inzet ⇒ 6 d, standaard blijft 4', [task(g1.t).time.scheduleDuration, task(g2.t).time.scheduleDuration, task(g3.t).time.scheduleDuration], [6, 6, 4]);
  const note = S().ui.notifications.find((n) => n.messageKey === 'notifications.workRuleDurationsChanged');
  eq('p11 …één melding met het aantal aangepaste taken (2)', note?.params?.count, 2);
  // Kalenderinhoud wijzigen (uren per dag) op de projectkalender.
  useAppStore.setState((s) => { s.ui.notifications = []; });
  S().updateCalendar(six2Id, { hoursPerDay: 4 });
  eq('p12 updateCalendar 6→4 u/dag: Vast werk 32 u ⇒ 8 d; melding telt 2', [task(g1.t).time.scheduleDuration, S().ui.notifications.find((n) => n.messageKey === 'notifications.workRuleDurationsChanged')?.params?.count], [8, 2]);
  // MCP-tweeling: patchTaskFields met calendarId.
  reset();
  const six3 = S().addCalendar({ ...S().calendar, id: 'cal-6h-c', name: '6 uur', hoursPerDay: 6 } as never);
  const six3Id = typeof six3 === 'string' ? six3 : 'cal-6h-c';
  const m = mk('FIXED_WORK');
  const mr = runInMcpTransaction(() => { draft.patchTaskFields(m.t, { calendarId: six3Id }); });
  eq('p13 MCP patchTaskFields({ calendarId }) ⇒ duur 6', [mr.ok, task(m.t).time.scheduleDuration], [true, 6]);

  // ── Beslispunt 2: expliciete rest schuift mee met Δ, geklemd op 0; completion blijft.
  reset();
  const q = S().addTask({ name: 'q', time: createDefaultTaskTime('2026-06-01', 10) });
  const qr = labor('r-q');
  S().assignResource(q, qr, 1);
  S().updateTask(q, { time: { ...task(q).time, completion: 0.5, remainingTime: 3 } });
  S().runCPM();
  S().updateTask(q, { time: { ...task(q).time, scheduleDuration: 12 } });
  eq('q1 duur 10→12 bij expliciete rest 3 ⇒ rest 5, completion blijft 0,5', [task(q).time.remainingTime, task(q).time.completion], [5, 0.5]);
  S().updateTask(q, { time: { ...task(q).time, scheduleDuration: 4 } });
  eq('q2 duur 12→4 (−8) ⇒ rest geklemd op 0', task(q).time.remainingTime, 0);
  // Onder FIXED_WORK volgt de driehoek de verschoven rest.
  S().updateTask(q, { time: { ...task(q).time, scheduleDuration: 10, remainingTime: 5 } });
  eq('q2b een patch die de rest ZELF zet, wordt niet ook nog verschoven', task(q).time.remainingTime, 5);
  S().runCPM();
  S().setTaskWorkRule(q, 'FIXED_WORK');
  eq('q3 voorwaarde: restwerk 5 d vastgelegd', asgOf(q, qr).remainingWorkMinutes, 5 * slot());
  S().updateTask(q, { time: { ...task(q).time, scheduleDuration: 15 } });
  eq('q4 duur 10→15 ⇒ rest 10, inzet 0,5 (werk 5 d blijft)', [task(q).time.remainingTime, asgOf(q, qr).unitsPerDay, asgOf(q, qr).remainingWorkMinutes], [10, 0.5, 5 * slot()]);
  // Raster en uurmodus.
  const cellDur: CellEditIntent = { kind: 'cell-edit', taskId: q, columnId: 'task.time.scheduleDuration' as CellEditIntent['columnId'], route: 'task-schedule', value: 20 * slot() };
  eq('q5 rastercel duur 15→20 ⇒ rest 15', [runGridMutation([cellDur]).ok, task(q).time.remainingTime], [true, 15]);
  const u = S().addTask({ name: 'u', time: createDefaultTaskTime('2026-06-01', 4, 'hours') });
  S().updateTask(u, { time: { ...task(u).time, completion: 0.5, remainingMinutes: 100 } });
  S().updateTask(u, { time: { ...task(u).time, durationMinutes: 300 } });
  eq('q6 uurmodus: 240→300 min bij rest 100 ⇒ rest 160', task(u).time.remainingMinutes, 160);
  const mq = runInMcpTransaction(() => { draft.patchTaskFields(q, {}, { scheduleDuration: 22 }); });
  eq('q7 MCP patchTaskFields duur 20→22 ⇒ rest 17', [mq.ok, task(q).time.remainingTime], [true, 17]);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('-- (r) reviewronde 2026-09-05 op K2/Δ-rest (F1–F10): kalender + duur in één bewerking, contour-as, gestarte taak, FIXED_RATE, bungelende kalender, meldingen --');
{
  const addSix = (suffix: string): string => {
    const id = S().addCalendar({ ...S().calendar, id: `cal-6h-${suffix}`, name: '6 uur', hoursPerDay: 6 } as never);
    return typeof id === 'string' ? id : `cal-6h-${suffix}`;
  };
  const mkTask = (name: string, days: number, rule?: 'FIXED_WORK' | 'FIXED_DURATION_WORK' | 'FIXED_RATE') => {
    const t = S().addTask({ name, time: createDefaultTaskTime('2026-06-01', days) });
    const r = labor(`r-${name}`);
    S().assignResource(t, r, 1);
    S().runCPM();
    if (rule) S().setTaskWorkRule(t, rule);
    return { t, r };
  };
  const cell = (taskId: string, columnId: string, value: unknown): CellEditIntent =>
    ({ kind: 'cell-edit', taskId, columnId: columnId as CellEditIntent['columnId'], route: 'task-schedule', value });

  // (F1) raster: kalender én duur in dezelfde paste — de duurbewerking moet overleven.
  reset();
  const six = addSix('r');
  const f1 = mkTask('r-f1', 10, 'FIXED_WORK');
  const res1 = runGridMutation([cell(f1.t, 'task.calendarId', six), cell(f1.t, 'task.time.scheduleDuration', 4 * 360)]);
  eq('r1 (F1) FIXED_WORK: paste kalender→6 u én duur→4 d ⇒ kalender 6 u, duur 4, werk 80 u blijft, inzet 3,3333', [res1.ok, task(f1.t).calendarId, task(f1.t).time.scheduleDuration, asgOf(f1.t, f1.r).remainingWorkMinutes, asgOf(f1.t, f1.r).unitsPerDay], [true, six, 4, 80 * 60, 3.3333]);
  const f1b = mkTask('r-f1b', 10);
  const res1b = runGridMutation([cell(f1b.t, 'task.calendarId', six), cell(f1b.t, 'task.time.scheduleDuration', 4 * 360)]);
  eq('r2 (F1) standaardregel: dezelfde paste ⇒ duur 4 (geheel), geen werkveld, inzet 1', [res1b.ok, task(f1b.t).time.scheduleDuration, asgOf(f1b.t, f1b.r).remainingWorkMinutes, asgOf(f1b.t, f1b.r).unitsPerDay], [true, 4, undefined, 1]);
  // Omgekeerde volgorde in de edit-set maakt niet uit: de kalenderstap gaat altijd voor.
  const f1c = mkTask('r-f1c', 10, 'FIXED_WORK');
  const res1c = runGridMutation([cell(f1c.t, 'task.time.scheduleDuration', 4 * 360), cell(f1c.t, 'task.calendarId', six)]);
  eq('r3 (F1) volgorde in de paste is irrelevant', [res1c.ok, task(f1c.t).time.scheduleDuration, asgOf(f1c.t, f1c.r).unitsPerDay], [true, 4, 3.3333]);

  // (F2) MCP patchTaskFields: kalender + duur in één call laat het verrichte deel staan.
  const f2 = mkTask('r-f2', 10, 'FIXED_WORK');
  S().updateTask(f2.t, { time: { ...task(f2.t).time, completion: 0.5, remainingTime: 5 } });
  S().runCPM();
  const res2 = runInMcpTransaction(() => { draft.patchTaskFields(f2.t, { calendarId: six }, { scheduleDuration: 8 }); });
  eq('r4 (F2) MCP kalender→6 u + duur→8 in één call ⇒ duur 8, rest 3 (verricht 5 d blijft), completion 0,5', [res2.ok, task(f2.t).time.scheduleDuration, task(f2.t).time.remainingTime, task(f2.t).time.completion], [true, 8, 3, 0.5]);
  // (F8) een aanroeper die de rest ZELF zet via `top.time`, ziet 'm niet óók nog verschuiven.
  const f8 = mkTask('r-f8', 10);
  S().updateTask(f8.t, { time: { ...task(f8.t).time, completion: 0.5, remainingTime: 5 } });
  const res8 = runInMcpTransaction(() => { draft.patchTaskFields(f8.t, { time: { ...task(f8.t).time, scheduleDuration: 14, remainingTime: 9 } }, { scheduleDuration: 14 }); });
  eq('r5 (F8) MCP patchTaskFields met eigen rest 9 ⇒ rest 9 (niet 13)', [res8.ok, task(f8.t).time.scheduleDuration, task(f8.t).time.remainingTime], [true, 14, 9]);

  // (F3) contour-as na een kalenderwissel: as-span == duur × nieuwe slot; werk volgens de regel.
  const span = (t: string) => task(t).timephasedContours![0].periods.reduce((m, p) => Math.max(m, p.afterMinutes + p.minutes), 0);
  const sum = (t: string) => task(t).timephasedContours![0].periods.reduce((s, p) => s + p.workMinutes, 0);
  const withContour = (rule?: 'FIXED_WORK' | 'FIXED_DURATION_WORK') => {
    const x = mkTask(`r-f3-${rule ?? 'std'}`, 4, rule);
    const mpd = slot();
    S().setAssignmentContour(asgOf(x.t, x.r).id, workDaySlotsToPeriods([2 * mpd, mpd, 0.5 * mpd, 0.5 * mpd], undefined, mpd));
    return x;
  };
  const c1 = withContour('FIXED_WORK');
  eq('r6 voorwaarde: contour 4 d × 8 u (as 1920, werk 1920)', [span(c1.t), sum(c1.t)], [1920, 1920]);
  S().setTaskCalendar(c1.t, six);
  eq('r7 (F3) FIXED_WORK 8→6 u: duur 6, as 6 × 360 = 2160, werk 1920 blijft', [task(c1.t).time.scheduleDuration, span(c1.t), sum(c1.t)], [6, 2160, 1920]);
  eq('r8 (F3) histogram boekt over 6 dagen, niet 8', assignmentDayUnits(task(c1.t), asgOf(c1.t, c1.r), 360, undefined, S().assignments.filter((a) => a.taskId === c1.t)).length, 6);
  const c2 = withContour('FIXED_DURATION_WORK');
  S().setTaskCalendar(c2.t, six);
  eq('r9 (F3) Vaste duur en werk: dagen blijven 4, as volgt de slot (1440), werk 1920 (inzet 1,3333)', [task(c2.t).time.scheduleDuration, span(c2.t), sum(c2.t), asgOf(c2.t, c2.r).unitsPerDay], [4, 1440, 1920, 1.3333]);
  const c3 = withContour(undefined);
  S().setTaskCalendar(c3.t, six);
  eq('r10 (F3) standaardregel: dagen 4, as 1440, werk volgt (1440)', [task(c3.t).time.scheduleDuration, span(c3.t), sum(c3.t)], [4, 1440, 1440]);

  // (G1/G2) contour mét opgeslagen werkveld, alle vier de regels: hoogte == werk van de toewijzing (opgeslagen ?? afgeleid), as == duur × nieuwe slot.
  for (const rule of ['FIXED_DURATION_RATE', 'FIXED_DURATION_WORK', 'FIXED_WORK', 'FIXED_RATE'] as const) {
    const x = mkTask(`r-g-${rule}`, 4, rule === 'FIXED_DURATION_RATE' ? undefined : rule);
    const mpd = slot();
    S().setAssignmentContour(asgOf(x.t, x.r).id, workDaySlotsToPeriods([2 * mpd, mpd, 0.5 * mpd, 0.5 * mpd], undefined, mpd));
    S().setAssignmentWork(asgOf(x.t, x.r).id, 4 * mpd);
    S().setTaskCalendar(x.t, six);
    const a = asgOf(x.t, x.r);
    const work = a.remainingWorkMinutes ?? task(x.t).time.scheduleDuration * 360 * a.unitsPerDay;
    eq(`r10-${rule} contour mét werkveld na 8→6 u: as = duur × 360, hoogte = werk toewijzing`, [span(x.t) === task(x.t).time.scheduleDuration * 360, Math.round(sum(x.t)), Math.round(work)], [true, Math.round(work), rule === 'FIXED_DURATION_RATE' ? 1440 : 1920]);
    eq(`r10-${rule} histogram: som van de dageenheden = werk / 360`, Math.round(assignmentDayUnits(task(x.t), a, 360, undefined, S().assignments.filter((q) => q.taskId === x.t)).reduce((m, u) => m + u, 0) * 360), Math.round(work));
  }
  // (F4) gestarte taak: verricht blijft een feit, heen en terug is stabiel; completion blijft (bekende inconsistentie, TODO).
  // Eerst voortgang, dán de regel: het vastgelegde RESTwerk is 5 d × 8 u = 40 u (spec §7 besluit 2).
  const f4 = mkTask('r-f4', 10);
  S().updateTask(f4.t, { time: { ...task(f4.t).time, completion: 0.5 } });
  S().runCPM();
  S().setTaskWorkRule(f4.t, 'FIXED_WORK');
  eq('r11a voorwaarde: restwerk 40 u vastgelegd', asgOf(f4.t, f4.r).remainingWorkMinutes, 40 * 60);
  S().setTaskCalendar(f4.t, six);
  eq('r11 (F4) 10 d op 50 % → 6 u/dag: duur 12, rest 7, completion 0,5, werk 40 u, inzet 1', [task(f4.t).time.scheduleDuration, task(f4.t).time.remainingTime, task(f4.t).time.completion, asgOf(f4.t, f4.r).remainingWorkMinutes, asgOf(f4.t, f4.r).unitsPerDay], [12, 7, 0.5, 40 * 60, 1]);
  S().setTaskCalendar(f4.t, undefined);
  eq('r12 (F4) terug naar 8 u: duur 10, rest 5, werk 40 u', [task(f4.t).time.scheduleDuration, task(f4.t).time.remainingTime, asgOf(f4.t, f4.r).remainingWorkMinutes], [10, 5, 40 * 60]);

  // (F5) FIXED_RATE via setTaskCalendar: duur volgt, maar er komt géén werkveld.
  const f5 = mkTask('r-f5', 4, 'FIXED_RATE');
  S().setTaskCalendar(f5.t, six);
  eq('r13 (F5) FIXED_RATE 8→6 u: duur 6, inzet 1, werkveld blijft afwezig', [task(f5.t).time.scheduleDuration, asgOf(f5.t, f5.r).unitsPerDay, asgOf(f5.t, f5.r).remainingWorkMinutes], [6, 1, undefined]);

  // (F7) Δ-rest geldt ook op een ELAPSEDTIME-taak (duur-identiteit, geen driehoeksregel); niet op een mijlpaal.
  const f7 = S().addTask({ name: 'r-f7', time: { ...createDefaultTaskTime('2026-06-01', 10), durationType: 'ELAPSEDTIME' } });
  S().updateTask(f7, { time: { ...task(f7).time, completion: 0.5, remainingTime: 5 } });
  S().updateTask(f7, { time: { ...task(f7).time, scheduleDuration: 20 } });
  eq('r14 (F7) ELAPSEDTIME 10→20 bij rest 5 ⇒ rest 15 (bewust, spec §6.5)', task(f7).time.remainingTime, 15);

  // (F9) projectkalender: een bungelende taakkalender volgt de projectkalender; een expliciete verwijzing naar de OUDE projectkalender niet.
  reset();
  const six2 = addSix('r2');
  const oldProjectCal = S().project.calendarId;
  const g1 = mkTask('r-g1', 4, 'FIXED_WORK');
  const g2 = mkTask('r-g2', 4, 'FIXED_WORK');
  const g3 = mkTask('r-g3', 4, 'FIXED_WORK');
  useAppStore.setState((s) => {
    s.tasks.find((t) => t.id === g2.t)!.calendarId = 'weg-ermee';
    s.tasks.find((t) => t.id === g3.t)!.calendarId = oldProjectCal;
  });
  useAppStore.setState((s) => { s.ui.notifications = []; });
  const events0 = S().historyEvents.length;
  S().setProjectCalendar(six2);
  eq('r15 (F9) projectkalender 8→6: zonder kalender 6 d, bungelend 6 d, expliciet-oude blijft 4 d', [task(g1.t).time.scheduleDuration, task(g2.t).time.scheduleDuration, task(g3.t).time.scheduleDuration], [6, 6, 4]);
  eq('r16 (F9) …melding telt 2, één undo-stap', [S().ui.notifications.find((n) => n.messageKey === 'notifications.workRuleDurationsChanged')?.params?.count, S().historyEvents.length - events0], [2, 1]);
  S().undo();
  eq('r17 undo van setProjectCalendar: projectkalender, cache én beide duren terug', [S().project.calendarId === oldProjectCal, S().calendar.hoursPerDay, task(g1.t).time.scheduleDuration, task(g2.t).time.scheduleDuration], [true, 8, 4, 4]);

  // (F10) twee opeenvolgende bewerkingen geven twee meldingen met elk hun eigen aantal (geen ×N-badge met het laatste aantal).
  S().redo();
  useAppStore.setState((s) => { s.ui.notifications = []; });
  S().updateCalendar(six2, { hoursPerDay: 4 });
  useAppStore.setState((s) => { s.tasks.find((t) => t.id === g2.t)!.calendarId = undefined; });
  S().updateCalendar(six2, { hoursPerDay: 3 });
  const notes = S().ui.notifications.filter((n) => n.messageKey === 'notifications.workRuleDurationsChanged');
  eq('r18 (F10) burst 2 en daarna 2: twee losse meldingen, elk count 1 (geen dedupe-badge)', [notes.length, notes.map((n) => n.count), notes.map((n) => n.params?.count)], [2, [1, 1], [2, 2]]);

  // MCP-tweeling `draft.updateCalendar`: zelfde regel, zelfde melding.
  reset();
  const six3 = addSix('r3');
  const m1 = mkTask('r-m1', 4, 'FIXED_WORK');
  S().setTaskCalendar(m1.t, six3);
  eq('r19 voorwaarde: 6 d op 6 u', task(m1.t).time.scheduleDuration, 6);
  useAppStore.setState((s) => { s.ui.notifications = []; });
  const resM = runInMcpTransaction(() => { draft.updateCalendar(six3, { hoursPerDay: 4 }); });
  eq('r20 MCP draft.updateCalendar 6→4 u: 32 u ⇒ 8 d; melding telt 1', [resM.ok, task(m1.t).time.scheduleDuration, S().ui.notifications.find((n) => n.messageKey === 'notifications.workRuleDurationsChanged')?.params?.count], [true, 8, 1]);

  // Timephased-verlies: wist de nazorg van de regel het Z8-venster, dan wordt dat óók gemeld (setTaskCalendar wiste 'm anders stil).
  reset();
  const six4 = addSix('r4');
  const z = mkTask('r-z', 4, 'FIXED_WORK');
  useAppStore.setState((s) => { s.tasks.find((t) => t.id === z.t)!.timephasedFinishFloor = '2026-06-05'; s.ui.notifications = []; });
  S().setTaskCalendar(z.t, six4);
  eq('r21 Z8-venster gewist door de nazorg ⇒ venster weg én melding', [task(z.t).timephasedFinishFloor, S().ui.notifications.some((n) => n.messageKey === 'notifications.mppTimephasedSteeringLost')], [undefined, true]);
  // (G4) dezelfde melding via updateCalendar en setProjectCalendar.
  reset();
  const six5 = addSix('r5');
  const z2 = mkTask('r-z2', 4, 'FIXED_WORK');
  S().setTaskCalendar(z2.t, six5);
  useAppStore.setState((s) => { s.tasks.find((t) => t.id === z2.t)!.timephasedFinishFloor = '2026-06-05'; s.ui.notifications = []; });
  S().updateCalendar(six5, { hoursPerDay: 4 });
  eq('r22 (G4) updateCalendar: venster weg én verliesmelding', [task(z2.t).timephasedFinishFloor, S().ui.notifications.some((n) => n.messageKey === 'notifications.mppTimephasedSteeringLost')], [undefined, true]);
  reset();
  const six6 = addSix('r6');
  const z3 = mkTask('r-z3', 4, 'FIXED_WORK');
  useAppStore.setState((s) => { s.tasks.find((t) => t.id === z3.t)!.timephasedFinishFloor = '2026-06-05'; s.ui.notifications = []; });
  S().setProjectCalendar(six6);
  eq('r23 (G4) setProjectCalendar: venster weg én verliesmelding', [task(z3.t).timephasedFinishFloor, S().ui.notifications.some((n) => n.messageKey === 'notifications.mppTimephasedSteeringLost')], [undefined, true]);
}

console.log(`\n${checks} checks, ${diffs.length} afwijking(en)`);
if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX ${d}`);
  process.exit(1);
}
console.log('OK  work-rule-store: werkdriehoek bedraad in store, raster en MCP');
