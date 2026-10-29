// check-leveler-candidate-axis.ts — aanval a12 na #600: de kandidaat-as van de nivelleerder
// (`candidateAxis` in ResourceLeveler.ts) liep elke kandidaat opnieuw vanaf de eerste start door alle
// overgeslagen werkdagen. Per taak kwadratisch, over een rij concurrerende taken de derde macht: 2000 taken
// nivelleren kostte 13–14 s in plaats van 0,6 s. Nu loopt elke kandidaat alleen de nieuw overgeslagen
// werkdag vanaf de vorige kandidaat.
//
// Deel 1 telt kalenderwerk (`findContaining`, de bloktoets onder elke bandwandeling), niet wandkloktijd:
// bij een verdubbeling van de concurrerende taken groeit het met ongeveer 4 (n kandidaten voor n taken).
// Met de oude wandeling was dat ongeveer 7 tot 8. De telling is deterministisch, dus stabiel op CI.
//
// Deel 2 legt de uitkomst vast op kalenders waar de stappen ongelijk zijn: een korte vrijdag, een
// nachtdienst over middernacht en een feestdag, met een start midden op de dag. De verwachte momenten
// zijn met de hand uitgerekend (zie per geval); de oude en de nieuwe as geven ze allebei.
import { levelResources } from '@/engine/scheduler/ResourceLeveler';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { makeBands } from '@/utils/effectiveWorkTime';
import type { Task, TaskConstraint, TaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Holiday, WorkCalendar, WorkTimeBands } from '@/types/calendar';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
function ok(label: string, cond: boolean): void { checks++; if (!cond) diffs.push(label); }

const B = (start: number, end: number) => ({ start, end });
function calendar(id: string, workTime: WorkTimeBands, holidays: Holiday[] = []): WorkCalendar {
  return {
    id, name: id, description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16,
    hoursPerDay: 8, holidays, workTime,
  };
}
const WEEK = calendar('week', makeBands([1, 2, 3, 4, 5], [B(480, 960)]));
const options = solveOptionsFor({ startDate: '2026-06-01', endDate: '' });

function time(extra: Partial<TaskTime>): TaskTime {
  return {
    durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 1,
    scheduleStart: '2026-06-01', scheduleFinish: '2026-06-01', earlyStart: '2026-06-01', earlyFinish: '2026-06-01',
    lateStart: '2026-06-01', lateFinish: '2026-06-01', freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    ...extra,
  };
}
function task(id: string, t: Partial<TaskTime>, extra: Partial<Task> = {}): Task {
  return {
    id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [], time: time(t), ...extra,
  };
}
const KRAAN: Resource = { id: 'kraan', name: 'Kraan', description: '', type: 'EQUIPMENT', maxUnits: 1 };

/** Nivelleer `leaves` (allemaal op de kraan, capaciteit 1) en geef per taak de start na nivelleren. */
function level(cal: WorkCalendar, leaves: Task[]): { starts: string[]; unresolved: number } {
  const tasks = leaves.map(t => ({ ...t, resourceIds: ['kraan'] }));
  const assignments: ResourceAssignment[] = tasks.map(t => ({ id: 'a' + t.id, taskId: t.id, resourceId: 'kraan', unitsPerDay: 1 }));
  const base = solveProject({ tasks, sequences: [], calendar: cal, calendars: [], ...options });
  if (base.error) throw new Error(JSON.stringify(base.error));
  const r = levelResources(tasks, [], [KRAAN], assignments, cal, [], base, { constrainToFloat: false }, options);
  const starts = tasks.map(t => r.shifts[t.id]?.newStart ?? base.tasks.get(t.id)?.earlyStart ?? '?').sort();
  return { starts, unresolved: Object.keys(r.unresolved).length };
}

// ═══════════════════════════════════════════════════════════════════════════
// Deel 1: kalenderwerk groeit kwadratisch, niet met de derde macht
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-candidate-axis: kalenderwerk bij oplopende capaciteitsdruk --');
/** De a12-waaier in het klein: één start, n parallelle eendaagse taken op de kraan, één einde. */
function calendarWork(n: number): number {
  const leaves = Array.from({ length: n }, (_, i) => task(`t${i}`, {}, { resourceIds: ['kraan'] }));
  const tasks = [task('start', { scheduleDuration: 0 }, { isMilestone: true }), ...leaves, task('end', { scheduleDuration: 0 }, { isMilestone: true })];
  const sequences: Sequence[] = leaves.flatMap(t => [
    { id: `in-${t.id}`, predecessorId: 'start', successorId: t.id, type: 'FINISH_START', lagDays: 0 },
    { id: `out-${t.id}`, predecessorId: t.id, successorId: 'end', type: 'FINISH_START', lagDays: 0 },
  ]);
  const assignments: ResourceAssignment[] = leaves.map(t => ({ id: `a-${t.id}`, taskId: t.id, resourceId: 'kraan', unitsPerDay: 1 }));
  const base = solveProject({ tasks, sequences, calendar: WEEK, calendars: [], ...options });
  if (base.error) throw new Error(JSON.stringify(base.error));
  // `findContaining` is privé in TypeScript; op het prototype is hij gewoon een methode.
  const proto = CalendarEngine.prototype as unknown as { findContaining: (...args: unknown[]) => unknown };
  const original = proto.findContaining;
  let calls = 0;
  proto.findContaining = function (this: unknown, ...args: unknown[]) { calls++; return original.apply(this, args); };
  try {
    const r = levelResources(tasks, sequences, [KRAAN], assignments, WEEK, [], base, { constrainToFloat: false }, options);
    eq(`waaier ${n}: alles opgelost`, Object.keys(r.unresolved).length, 0);
    eq(`waaier ${n}: n − 1 taken plus het einde verschoven`, Object.keys(r.shifts).length, n);
  } finally {
    proto.findContaining = original;
  }
  return calls;
}
{
  const small = calendarWork(60);
  const large = calendarWork(120);
  // Gemeten op 9a636ec69 (oude as): 173 214 → 1 260 854, factor 7,3. Met de stapsgewijze as: 36 334 →
  // 137 494, factor 3,8.
  ok(`kalenderwerk groeit sterker dan kwadratisch: ${small} → ${large} (factor ${(large / small).toFixed(2)}, grens 5)`,
    small > 0 && large <= small * 5);
  console.log(`   kalenderwerk 60/120 taken: ${small} → ${large} (factor ${(large / small).toFixed(2)})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Deel 2: dezelfde kandidaatmomenten op ongelijke kalenders
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- leveler-candidate-axis: korte vrijdag, nachtdienst en feestdag --');
const snet = (date: string): { constraint: TaskConstraint } => ({ constraint: { type: 'SNET', date } });
const hourTask = (minutes: number) => ({ durationUnit: 'hours' as const, durationMinutes: minutes, scheduleDuration: minutes / 480 });

// Korte vrijdag (ma–do 08–16, vr 08–14). Vier taken van 8 u, niet vóór wo 3 juni 14:00.
// Kandidaten vanaf wo 14:00: +480 = do 14:00; +960 = vr 14:00 (blokeinde) ⇒ ma 08:00; +1320 = ma 14:00;
// +1800 = di 14:00. A wo 14:00–do 14:00 (wo 0,25, do 0,75); B do 14:00 (do 0,25, vr 0,75); C past niet op
// do en krijgt ma 08:00; D botst op wo/do, do, ma (2×) en krijgt di 9 juni 14:00.
{
  const cal = calendar('korte-vrijdag', { byWeekday: { 1: [B(480, 960)], 2: [B(480, 960)], 3: [B(480, 960)], 4: [B(480, 960)], 5: [B(480, 840)], 6: [], 7: [] } });
  const leaves = ['A', 'B', 'C', 'D'].map(id => task(id, hourTask(480), snet('2026-06-03T14:00')));
  const r = level(cal, leaves);
  eq('korte vrijdag: starts', r.starts, ['2026-06-03T14:00', '2026-06-04T14:00', '2026-06-08T08:00', '2026-06-09T14:00']);
  eq('korte vrijdag: niets onopgelost', r.unresolved, 0);
}

// Nachtdienst (ma–vr 22:00–06:00, het blok hoort bij zijn startdag). Zes taken van 8 u: elke kandidaat is
// de volgende dienst; de zesde valt na het weekend op ma 8 juni 22:00.
{
  const cal = calendar('nacht', makeBands([1, 2, 3, 4, 5], [B(1320, 1800)]));
  const leaves = ['A', 'B', 'C', 'D', 'E', 'F'].map(id => task(id, hourTask(480)));
  const r = level(cal, leaves);
  eq('nachtdienst: starts', r.starts,
    ['2026-06-01T22:00', '2026-06-02T22:00', '2026-06-03T22:00', '2026-06-04T22:00', '2026-06-05T22:00', '2026-06-08T22:00']);
  eq('nachtdienst: niets onopgelost', r.unresolved, 0);
}

// Feestdag wo 3 juni, start midden op de dag. Drie taken van 8 u, niet vóór di 2 juni 12:00. A en B
// passen samen (di 0,5 + 0,5 en do 0,5 + 0,5). C: di en do zijn vol; +480 = do 12:00 (de feestdag telt
// niet mee), +960 = vr 12:00 ⇒ vr 0,5 en ma 0,5.
{
  const cal = calendar('feestdag', makeBands([1, 2, 3, 4, 5], [B(480, 960)]),
    [{ name: 'feestdag', startDate: '2026-06-03', endDate: '2026-06-03' }]);
  const leaves = ['A', 'B', 'C'].map(id => task(id, hourTask(480), snet('2026-06-02T12:00')));
  const r = level(cal, leaves);
  eq('feestdag: starts', r.starts, ['2026-06-02T12:00', '2026-06-02T12:00', '2026-06-05T12:00']);
  eq('feestdag: niets onopgelost', r.unresolved, 0);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) { console.log(`OK  leveler-candidate-axis: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  leveler-candidate-axis: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
