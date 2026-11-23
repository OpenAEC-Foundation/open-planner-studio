import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';

declare const process: { exit(code: number): never };
let failures = 0;
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  const ctx = createAppStoreContext();
  const S = ctx.store.getState;
  S().setProject({ startDate: '2026-06-01', schedulingProfile: builtInProfile(profile) });
  const id = S().addTask({ name: 'Gestart na werktijd' });
  const task = () => S().tasks.find(t => t.id === id)!;
  S().updateTask(id, { time: { ...task().time, durationUnit: 'hours', durationMinutes: 480, scheduleDuration: 1 } });
  S().setStatusDate('2026-06-03');
  ctx.store.setState(s => {
    const t = s.tasks.find(t => t.id === id)!;
    Object.assign(t.time, { completion: 0.5, actualStart: '2026-06-03T18:00', remainingMinutes: 240, remainingTime: 0.5 });
  });
  S().runCPM();
  const actual = [task().time.earlyStart, task().time.earlyFinish];
  const expected = ['2026-06-03T18:00', profile === 'msproject' ? '2026-06-04T16:00' : '2026-06-04T11:00'];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.log(`XX ${profile}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(actual)}`);
  }
}
if (failures) process.exit(1);
console.log('OK restwerk begint niet vóór de werkelijke start');
