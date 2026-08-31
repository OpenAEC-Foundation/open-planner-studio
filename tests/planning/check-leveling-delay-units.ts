// check-leveling-delay-units.ts — B1c-plan-2 taak 1 (M10): `levelingDelayMinutes` heeft in
// `CPMSolver.shiftByLevelingDelay` VOORRANG op `levelingDelay`, maar applyLeveling/clearLeveling en
// de leveler-baseline kenden alleen `levelingDelay` — een stille no-op-familie op elk
// `.mpp`-geïmporteerd project. Deze batterij pint alle drie de plekken, plus de eenmalige
// K8a-waarschuwing die het overschrijven van de sub-dag-precisie meldt (eigenaarsbesluit 2026-08-31).
//
// Draait via run.sh. Exit 0 = alles groen.

import { levelResources, type LevelingOptions } from '@/engine/scheduler/ResourceLeveler';
import { solveProject } from '@/engine/scheduler/solveProject';
import { useAppStore } from '@/state/appStore';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

// Projectkalender: ma-vr, 8u/dag — letterlijk gekopieerd uit check-leveler-splits.ts.
const PROJECT_CAL: WorkCalendar = {
  id: 'cal-project-leveler', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

/** Leaf-taak, zelfde veldvorm als check-leveler-splits.ts se `task()`. */
function task(id: string, earlyStart: string, earlyFinish: string, durationDays: number, extra?: Partial<Task>): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: durationDays,
      scheduleStart: earlyStart, scheduleFinish: earlyFinish,
      earlyStart, earlyFinish, lateStart: earlyStart, lateFinish: earlyFinish,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    ...extra,
  };
}

function res(id: string, maxUnits = 1, extra?: Partial<Resource>): Resource {
  return { id, name: id, type: 'LABOR', description: '', maxUnits, ...extra };
}

function assign(id: string, taskId: string, resourceId: string, unitsPerDay: number): ResourceAssignment {
  return { id, taskId, resourceId, unitsPerDay, curve: 'UNIFORM' };
}

/** Lege/verwaarloosbare CPMResult — `levelResources` gebruikt hem uitsluitend als fallback. */
function stubCpmResult(projectEnd: string): CPMResult {
  return {
    tasks: new Map(), criticalPath: [], drivingSequenceIds: [], sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [], violatedConstraintTaskIds: [], missedDeadlineTaskIds: [],
    outOfSequenceSequenceIds: [], nearCriticalTaskIds: [], criticalPaths: [], floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [], projectEnd, projectDuration: 0,
  };
}

const LEVEL_OPTS: LevelingOptions = { constrainToFloat: false };

// ═══════════════════════════════════════════════════════════════════════════
// Deel 1 (pure CPM): `levelingDelayMinutes` wint van `levelingDelay` — vastgelegd, BESTAAND gedrag
// van `CPMSolver.shiftByLevelingDelay` (regel ~762). Dit hoort al vóór de fix groen te zijn.
// Taak T, 1 werkdag, geen relaties, projectstart ma 2026-06-01 (bevestigd: maandag). Zet BEIDE
// velden: levelingDelay 1 (één werkdag) én levelingDelayMinutes 2400 (= 5 werkdagen à 8u = 480 min).
// `solveProject` moet op 2026-06-08 uitkomen (5 werkdagen later, ook maandag), NIET op 2026-06-02
// (1 werkdag later) — dat is de voorrang.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveling-delay-units: levelingDelayMinutes wint van levelingDelay (deel 1, bestaand gedrag) --');
{
  const taskT = task('T', '2026-06-01', '2026-06-01', 1, {
    levelingDelay: 1,
    levelingDelayMinutes: 2400,
  });
  const solved = solveProject({ tasks: [taskT], sequences: [], calendar: PROJECT_CAL, calendars: [] });
  ok('solveProject rekent zonder fout door', !solved.error);
  eq('levelingDelayMinutes wint van levelingDelay: T landt op 2026-06-08, niet 2026-06-02',
    taskT.time.earlyStart, '2026-06-08');
}

// ═══════════════════════════════════════════════════════════════════════════
// Deel 2 (leveler-baseline): de strip in `workTasks` is compleet. `CPMSolver.forwardPass` past
// `levelingDelayMinutes` alléén toe op een taak MET voorganger (`!noPreds`, regel ~1452) — een
// wortel-taak negeert het veld sowieso (Z6-fixronde-besluit, empirisch op het MSP-corpus). De
// M10-bug manifesteert zich dus pas op een taak met een voorganger: taak A volgt taak P (FS, geen
// resource op P) en draagt `levelingDelayMinutes: 2400` UIT EEN EERDERE nivellering/import (geen
// `levelingDelay` — precies wat `mppReader.ts` achterlaat). Taak B (root, geen voorganger) wil
// dezelfde dag als A's onvertraagde PF (ma 2026-06-01) op dezelfde resource (cap 1).
//
// De baseline hoort delay-VRIJ te zijn: A's PF is dan 2026-06-01, er is een ECHT conflict met B,
// en precies één van de twee krijgt een delay. Vóór de fix bleef `levelingDelayMinutes` in de
// baseline-kopie staan; `CPMSolver` schoof A daar zelf al 5 werkdagen op (naar 2026-06-08, geverifieerd
// met een losse debugrun: `shifts.a.newStart === '2026-06-08'`), dus concurreerde ze niet meer met B
// op 2026-06-01 — het conflict verdween volledig uit beeld (`r.delays` bleef LEEG).
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveling-delay-units: baseline is delay-vrij ook voor levelingDelayMinutes (deel 2) --');
{
  const taskP = task('p', '2026-05-29', '2026-05-29', 1);
  const taskA = task('a', '2026-05-29', '2026-05-29', 1, { levelingDelayMinutes: 2400 });
  const taskB = task('b', '2026-06-01', '2026-06-01', 1);
  const seq: Sequence = { id: 's-p-a', predecessorId: 'p', successorId: 'a', type: 'FINISH_START', lagDays: 0 };
  const resourceR = res('r1', 1);
  const assignments = [assign('a-r1', 'a', 'r1', 1), assign('b-r1', 'b', 'r1', 1)];
  const cpmResult = stubCpmResult('2026-06-01');
  const r = levelResources([taskP, taskA, taskB], [seq], [resourceR], assignments, PROJECT_CAL, [], cpmResult, LEVEL_OPTS);

  ok('baseline is delay-vrij: er is een echt conflict en precies één taak wijkt',
    Object.keys(r.delays).length === 1);
  ok('geen onopgeloste conflicten (cap 1 volstaat voor twee taken van 1 dag)',
    Object.keys(r.unresolved).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Deel 3 (store): applyLeveling/clearLeveling wissen ook de sub-dag-velden, en de aansluitende
// runCPM past de NIEUWE (hele-werkdagen-)delay toe — niet de achtergebleven sub-dag-waarde.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveling-delay-units: applyLeveling/clearLeveling wissen de sub-dag-precisie (deel 3) --');
const S = () => useAppStore.getState();
const notifKey = 'notifications.levelingDelayRoundedToWorkdays' as const;
const notifCount = () => S().ui.notifications.filter(n => n.messageKey === notifKey).length;

S().newProject();
for (const n of [...S().ui.notifications]) S().dismissNotification(n.id);
S().setProject({ startDate: '2026-06-01' }); // maandag (bevestigd)
const idT = S().addTask({ name: 'T' });
S().updateTask(idT, { levelingDelayMinutes: 2400, levelingDelayElapsed: true });

S().applyLeveling({
  delays: { [idT]: 2 }, unresolved: {}, unresolvedReasons: {}, shifts: {},
  projectEndBefore: '2026-06-01', projectEndAfter: '2026-06-03', gaps: {},
});
{
  const t = S().tasks.find(x => x.id === idT)!;
  eq('applyLeveling wist de sub-dag-precisie', t.levelingDelayMinutes, undefined);
  eq('applyLeveling wist de elapsed-vlag', t.levelingDelayElapsed, undefined);
  eq('applyLeveling zet de nieuwe (hele-werkdagen) delay', t.levelingDelay, 2);
  eq('de CPM past de NIEUWE delay toe: PF (2026-06-01) + 2 werkdagen = 2026-06-03 (woensdag)',
    t.time.earlyStart, '2026-06-03');
}

// ═══════════════════════════════════════════════════════════════════════════
// Deel 4 (melding, eigenaarsbesluit 2026-08-31): eenmalig per document, bij het EERSTE verlies.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveling-delay-units: eenmalige K8a-melding bij het overschrijven van sub-dag-precisie (deel 4) --');
ok('eerste keer verlies ⇒ melding gepusht', notifCount() >= 1);
eq('precies één melding van dit type na het eerste verlies', notifCount(), 1);

// Tweede verlies op een ANDERE taak, zelfde document ⇒ GEEN tweede melding (eenmalig-per-document,
// spiegelt notifyTimephasedLoss se "eenmalig per document, deze sessie").
const idU = S().addTask({ name: 'U' });
S().updateTask(idU, { levelingDelayMinutes: 1200 });
S().clearLeveling(); // wist U se sub-dag-precisie ⇒ een NIEUW, echt verlies, zelfde document
eq('clearLeveling wist ook levelingDelayMinutes', S().tasks.find(t => t.id === idU)!.levelingDelayMinutes, undefined);
eq('tweede verlies in hetzelfde document meldt NIET nogmaals', notifCount(), 1);

// Een clearLeveling-aanroep die NIETS met sub-dag-precisie wist (taak V draagt alleen een gewone
// `levelingDelay`, geen sub-dag-velden) is — op een VERS document, zodat de sessiegate zelf niet de
// verklaring is — een no-op voor DEZE melding ⇒ geen melding, ook niet de eerste keer voor dat doc.
S().newProject();
for (const n of [...S().ui.notifications]) S().dismissNotification(n.id);
const idV = S().addTask({ name: 'V' });
S().updateTask(idV, { levelingDelay: 3 }); // gewone delay, GEEN levelingDelayMinutes/-Elapsed
S().clearLeveling();
eq('geen melding als er niets te wissen viel (ook niet de eerste keer voor dit document)',
  S().ui.notifications.filter(n => n.messageKey === notifKey).length, 0);

// ═══════════════════════════════════════════════════════════════════════════
// Deel 5 (fixronde B1c-plan-2-etappe-2, bevinding 6): een taak met UITSLUITEND `levelingDelayElapsed`
// (geen `levelingDelay`, geen `levelingDelayMinutes`) werd door de no-op-guard van `clearLeveling`
// (`scheduleSlice.ts`) ten onrechte als "niets te wissen" gezien — de guard toetste alleen de eerste
// twee velden, terwijl de wislus (en de teller vlak eronder) `levelingDelayElapsed` al wél meenamen.
// Gevolg vóór de fix: stille no-op — geen undo-snapshot, geen melding, het veld bleef gewoon staan.
// ═══════════════════════════════════════════════════════════════════════════
S().newProject();
for (const n of [...S().ui.notifications]) S().dismissNotification(n.id);
const idW = S().addTask({ name: 'W' });
S().updateTask(idW, { levelingDelayElapsed: true }); // UITSLUITEND het elapsed-veld
const undoDepthBeforeW = S().undoStack.length;
S().clearLeveling();
eq('clearLeveling wist levelingDelayElapsed ook als het het ENIGE sub-dag-veld is',
  S().tasks.find(t => t.id === idW)!.levelingDelayElapsed, undefined);
ok('clearLeveling pusht een undo-snapshot (geen stille no-op)', S().undoStack.length > undoDepthBeforeW);
eq('en meldt het verlies (eerste keer voor dit document)',
  S().ui.notifications.filter(n => n.messageKey === notifKey).length, 1);

// ── Uitkomst ──────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  leveling-delay-units: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  leveling-delay-units: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
