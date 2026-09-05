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

console.log(`\n${checks} checks, ${diffs.length} afwijking(en)`);
if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX ${d}`);
  process.exit(1);
}
console.log('OK  work-rule-store: werkdriehoek bedraad in store, raster en MCP');
