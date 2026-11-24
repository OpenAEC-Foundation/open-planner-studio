import assert from 'node:assert/strict';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

const { store } = createAppStoreContext();
const state = store.getState;
state().setProject({ startDate: '2026-06-01' });
const add = (name: string, start: string, priority = 500) =>
  state().addTask({ name, time: createDefaultTaskTime(start, 1), priority });
const pinned = add('Vaste kraantaak', '2026-06-01', 1000);
const predecessor = add('Voorganger', '2026-06-01');
const successor = add('Opvolger buiten de scope', '2026-06-02');
const other = add('Andere machinetaak', '2026-06-03');
state().addSequence({ predecessorId: predecessor, successorId: successor, type: 'FINISH_START', lagDays: 0 });

const crane = state().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
const machine = state().addResource({ name: 'Machine', type: 'EQUIPMENT', description: '', maxUnits: 1 });
state().assignResource(pinned, crane, 1, 'UNIFORM');
state().assignResource(predecessor, crane, 1, 'UNIFORM');
state().assignResource(successor, machine, 1, 'UNIFORM');
state().assignResource(other, machine, 1, 'UNIFORM');

const startOf = (id: string) => state().cpmResult?.tasks.get(id)?.earlyStart.slice(0, 10);
state().runCPM();
assert.equal(startOf(successor), '2026-06-02');
assert.deepEqual(state().resourceLoadResult?.overallocatedDays[machine], undefined);

const scopeTaskIds = [pinned, predecessor];
const proposal = state().levelResources({ constrainToFloat: false, scopeTaskIds });
state().applyLeveling(proposal, { scopeTaskIds });

assert.equal(proposal.delays[predecessor], 1);
assert.equal(proposal.delays[successor], undefined);
assert.equal(startOf(successor), '2026-06-03');
assert.deepEqual(state().resourceLoadResult?.overallocatedDays[machine], ['2026-06-03']);
assert.deepEqual(proposal.unresolved[successor], ['2026-06-03']);
