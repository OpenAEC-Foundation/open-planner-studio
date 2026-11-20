// Knownbug 5: een afgekapte FS-lead geeft geen vrije taakspeling voorbij het projecteinde.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';

const base: WorkCalendar = { id: 'c', name: 'c', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [] };
const bands = [{ start: 480, end: 960 }];
const withBands: WorkCalendar = { ...base, workTime: { byWeekday: {
  1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [],
} } };
function task(id: string, days: number, hours: boolean): Task {
  const time = createDefaultTaskTime('2026-06-01T08:00', days);
  time.durationUnit = hours ? 'hours' : 'days';
  time.durationMinutes = hours ? days * 480 : undefined;
  return { id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], time };
}

let clippedCount = 0;
const failures: string[] = [];
let cases = 0;
for (const [label, calendar, hours] of [['dagen', base, false], ['banddagen', withBands, false], ['uren', withBands, true]] as const) {
  for (const profile of ['ops', 'p6', 'msproject'] as const) {
    for (const [ad, bd, lag] of [[1, 1, -5], [3, 3, -5], [3, 5, -5], [5, 3, -5], [3, 3, 0]]) {
      const link: Sequence = { id: 'ab', type: 'FINISH_START', predecessorId: 'a', successorId: 'b',
        lagDays: lag, lagUnit: 'WORKTIME' };
      const res = new CPMSolver([task('a', ad, hours), task('b', bd, hours)], [link], calendar, [], {
        projectStartDate: '2026-06-01',
        schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: builtInProfile(profile) }),
      }).solve();
      const a = res.tasks.get('a'), b = res.tasks.get('b');
      if (res.error || !a || !b) throw new Error(`knownbug 5: geen resultaat ${res.error ?? ''}`);
      const clipped = res.truncatedLeadSequenceIds.includes(link.id);
      if (clipped) clippedCount++;
      const expectClipped = lag < 0 && ad < -lag;
      const expectRelationFloat = expectClipped ? -lag - ad : 0;
      const expectTaskFloat = expectClipped ? Math.min(expectRelationFloat, Math.max(0, bd - ad)) : 0;
      const expectStart = lag === 0 ? '2026-06-04T08:00' : '2026-06-01T08:00';
      if (clipped !== expectClipped || b.earlyStart !== expectStart
        || res.sequenceFreeFloat[link.id] !== expectRelationFloat
        || res.drivingSequenceIds.includes(link.id) !== !expectClipped
        || a.totalFloat !== expectTaskFloat || a.totalFloatMinutes !== expectTaskFloat * 480
        || a.freeFloat !== expectTaskFloat || a.freeFloatMinutes !== expectTaskFloat * 480) {
        failures.push(JSON.stringify({ label, profile, ad, bd, lag, clipped, expectTaskFloat, expectRelationFloat,
          a: { total: a.totalFloat, free: a.freeFloat, tm: a.totalFloatMinutes, fm: a.freeFloatMinutes },
          bStart: b.earlyStart, relationFloat: res.sequenceFreeFloat[link.id], driving: res.drivingSequenceIds }));
      }
      cases++;
    }
  }
}
if (clippedCount === 0) throw new Error('De diagnose heeft geen afgekapte lead bereikt');
if (failures.length) throw new Error(`KNOWNBUG5 ${failures.length}/${cases} mislukt:\n${failures.join('\n')}`);
console.log('KNOWNBUG5_SUMMARY', JSON.stringify({ cases, clippedCount, failures: failures.length }));
