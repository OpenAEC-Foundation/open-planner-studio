import assert from 'node:assert/strict';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
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
  days: proposal.delays[second],
  minutes: proposal.delayMinutes?.[second],
  target: proposal.shifts[second]?.newStart.slice(0, 10),
  conflicts: proposal.unresolved,
  starts: starts(),
  overloaded: state().resourceLoadResult?.overallocatedDays[resource],
}, {
  days: 2,
  minutes: 960,
  target: '2026-06-03',
  conflicts: {},
  starts: ['2026-06-02', '2026-06-03'],
  overloaded: undefined,
});
const repeat = state().levelResources({ constrainToFloat: false });
assert.deepEqual(repeat.delayMinutes, proposal.delayMinutes);
assert.deepEqual(repeat.shifts, {});

state().newProject();
state().setProject({ startDate: '2026-06-01' });
state().setStatusDate('2026-06-01');
const a = state().addTask({ name: 'A', time: createDefaultTaskTime('2026-06-01', 1) });
const b = state().addTask({ name: 'B', time: createDefaultTaskTime('2026-06-01', 1) });
const c = state().addTask({ name: 'C', time: createDefaultTaskTime('2026-06-03', 1) });
const crane = state().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
for (const id of [a, b, c]) state().assignResource(id, crane, 1, 'UNIFORM');
state().runCPM();
const existing = state().levelResources({ constrainToFloat: false });
assert.equal(existing.delayMinutes?.[b], 480);
state().applyLeveling(existing);
state().setActualStart(a, '2026-06-01');
state().setActualFinish(a, '2026-06-01');
state().runCPM();
const { project } = state();
const content = writeIFC(buildWriteIFCInput({ ...state(), project: { ...project, statusDate: '2026-06-02' } }, 'planOnly'));
const reopened = createAppStoreContext().store.getState;
await reopened().openOpenedFile({ name: 'genivelleerd.ifc', content, ref: null });

const assertExistingPlacement = () => {
  const task = reopened().tasks.find(task => task.name === 'B');
  assert.equal(task?.levelingDelayMinutes, 480);
  assert.equal(task?.time.earlyStart.slice(0, 10), '2026-06-02');
  assert.deepEqual(reopened().resourceLoadResult?.overallocatedDays, {});
};
assertExistingPlacement();
reopened().runCPM();
assertExistingPlacement();
