// knownbugs #1: minutenlag op externe links mag in dagmodus niet verdwijnen.
// §3.3/I11: de minutenlag blijft exact. Een scalaire kalender geeft dezelfde uitkomst
// als dezelfde expliciete werkblokken; afronden naar hele daglag is sinds F2 verdwenen.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task, ExternalLink } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(label);
};

for (const base of ['ops', 'p6', 'msproject'] as const) {
  const schedulingOptions = effectiveSchedulingOptions({ schedulingProfile: { baseId: base, id: base, name: '', overrides: {} } });
  for (const hoursPerDay of [6, 8]) {
    const calendar: WorkCalendar = {
      id: 'calendar', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5],
      workStartHour: 8, workEndHour: 8 + hoursPerDay, hoursPerDay, holidays: [],
    };
    for (const direction of ['predecessor', 'successor'] as const) {
      for (const relType of ['FS', 'SS', 'FF', 'SF'] as const) {
        for (const sourceMissing of [false, true]) {
          const solve = (lag: Pick<ExternalLink, 'lagDays' | 'lagMinutes'>, explicit = false) => {
            const task: Task = {
              id: 'L', name: 'L', description: '', wbsCode: '', taskType: 'CONSTRUCTION',
              status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null,
              childIds: [], resourceIds: [], time: createDefaultTaskTime('2026-06-01', 5, 'days'),
              externalLinks: [{
                id: 'external', direction, relType, sourceMissing, ...lag,
                anchorDate: direction === 'predecessor' ? '2026-06-10' : '2026-06-03',
                sourceRef: { projectId: 'external-project', taskId: 'external-task' },
              }],
            };
            const result = new CPMSolver([task], [], explicit ? { ...calendar, workTime: { byWeekday: { 1: [{ start: 480, end: (8 + hoursPerDay) * 60 }], 2: [{ start: 480, end: (8 + hoursPerDay) * 60 }], 3: [{ start: 480, end: (8 + hoursPerDay) * 60 }], 4: [{ start: 480, end: (8 + hoursPerDay) * 60 }], 5: [{ start: 480, end: (8 + hoursPerDay) * 60 }], 6: [], 7: [] } } } : calendar, [], { schedulingOptions }).solve();
            if (result.error) throw new Error(result.error);
            return result.tasks.get('L');
          };
          for (const fraction of [-1.5, -0.5, 0, 0.5, 1.5]) {
            const minutes = fraction * hoursPerDay * 60;
            eq(`${base}/${hoursPerDay}/${direction}/${relType}/${sourceMissing}/${fraction}`,
              solve({ lagMinutes: minutes }), solve({ lagMinutes: minutes }, true));
          }
          // Een expliciete nul in minuten blijft de bron, ook bij een oud conflicterend dagveld.
          eq(`${base}/${hoursPerDay}/${direction}/${relType}/${sourceMissing}/nul overschrijft dagveld`,
            solve({ lagMinutes: 0, lagDays: 9 }), solve({ lagDays: 0 }));
          eq(`${base}/${hoursPerDay}/${direction}/${relType}/${sourceMissing}/ontbrekende lag`,
            solve({}), solve({ lagDays: 0 }));
        }
      }
    }
  }
}
if (failures.length) {
  console.error(`XX external-lag-days: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-lag-days: ${checks}/${checks}`);
