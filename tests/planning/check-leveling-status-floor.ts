import assert from 'node:assert/strict';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

const { store } = createAppStoreContext();
const state = store.getState;
state().setProject({ startDate: '2026-06-01' });
state().setStatusDate('2026-06-02');
const first = state().addTask({ name: 'A', time: createDefaultTaskTime('2026-06-01', 1) });
const second = state().addTask({ name: 'B', time: createDefaultTaskTime('2026-06-01', 1) });
const resource = state().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
state().assignResource(first, resource, 1, 'UNIFORM');
state().assignResource(second, resource, 1, 'UNIFORM');

const starts = () => [first, second].map(id => state().cpmResult?.tasks.get(id)?.earlyStart.slice(0, 10));
state().runCPM();
assert.deepEqual(starts(), ['2026-06-02', '2026-06-02']);
assert.deepEqual(state().resourceLoadResult?.overallocatedDays[resource], ['2026-06-02']);

const proposal = state().levelResources({ constrainToFloat: false });
state().applyLeveling(proposal);
assert.deepEqual({
  minutes: proposal.delayMinutes?.[second],
  target: proposal.shifts[second]?.newStart.slice(0, 10),
  conflicts: proposal.unresolved,
  starts: starts(),
  overloaded: state().resourceLoadResult?.overallocatedDays[resource],
}, {
  minutes: 480,
  target: '2026-06-03',
  conflicts: {},
  starts: ['2026-06-02', '2026-06-03'],
  overloaded: undefined,
});
