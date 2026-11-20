// Knownbug 5: meet float rond een FS-lead die tegen de projectstart wordt afgeknipt.
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
let inversions = 0;
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
      const inversion = a.freeFloat > a.totalFloat;
      if (clipped) clippedCount++;
      if (clipped && inversion) inversions++;
      if (lag === 0 && clipped) throw new Error('Nul-lag is onverwacht afgeknipt');
      cases++;
      console.log('KNOWNBUG5', JSON.stringify({ label, profile, ad, bd, lag, clipped,
        a: { total: a.totalFloat, free: a.freeFloat, tm: a.totalFloatMinutes, fm: a.freeFloatMinutes },
        bStart: b.earlyStart, relationFloat: res.sequenceFreeFloat[link.id] }));
    }
  }
}
if (clippedCount === 0) throw new Error('De diagnose heeft geen afgekapte lead bereikt');
console.log('KNOWNBUG5_SUMMARY', JSON.stringify({ cases, clippedCount, inversions }));
