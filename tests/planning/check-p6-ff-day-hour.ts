// Review 2026-09-28 — P6-profiel: FF-relatie van een dagtaak naar een uurtaak.
//
// Conventie `p6FinishNotBeforeFinishFinishBound` stapte met `prevWorkInstant` terug op de lag-engine
// van de voorganger. Voor een dag-voorganger heeft die geen urenbanden, en de berekening van het hele
// document stopte met een TypeError. De conventie is voor zo'n relatie niet gedefinieerd; nu rekent
// het gewone pad door. (Bestond al vóór de audit; gevonden in de review.)
//
// Draait via run.sh. Exit 0 = alles groen.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

const DAY: WorkCalendar = { id: 'c', name: 'c', description: 'c', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [] };
const BAND = [{ start: 480, end: 960 }];
const HOUR = { ...DAY, id: 'h', workTime: { byWeekday: { 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: BAND, 6: [], 7: [] } } } as WorkCalendar;
const mk = (id: string, dur: number, unit: 'days' | 'hours') => ({
  ...(unit === 'hours' ? { calendarId: 'h' } : {}),
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
  parentId: null, childIds: [], resourceIds: [], time: createDefaultTaskTime('2026-06-01', dur, unit as never, DAY),
} as Task);

let fails = 0;
for (const base of ['p6', 'ops', 'msproject'] as const) {
  const so = effectiveSchedulingOptions({ schedulingProfile: { baseId: base, id: base, name: '', overrides: {} } });
  try {
    const r = new CPMSolver([mk('P0', 2, 'days'), mk('Q0', 8, 'hours')],
      [{ id: 's', predecessorId: 'P0', successorId: 'Q0', type: 'FINISH_FINISH', lagDays: 0 }], DAY, [DAY, HOUR], { schedulingOptions: so }).solve();
    if (r.error || !r.tasks.get('Q0')?.earlyFinish) { fails++; console.log(`XX ${base}: geen uitkomst (${r.error ?? ''})`); }
  } catch (err) {
    fails++;
    console.log(`XX ${base}: berekening gooit: ${String(err)}`);
  }
}
if (fails) { console.log(`XX  p6-ff-day-hour: ${fails} ROOD`); process.exit(1); }
console.log('OK  p6-ff-day-hour: alle profielen rekenen door (3)');
