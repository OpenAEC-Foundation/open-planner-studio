import assert from 'node:assert/strict';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';

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

const related = createAppStoreContext().store.getState;
related().setProject({ startDate: '2026-06-01' });
related().setStatusDate('2026-06-02T13:00');
const standard = related().calendar;
const regular = [{ start: 480, end: 960 }];
const crew: WorkCalendar = {
  ...standard,
  id: 'crew',
  name: 'Ploeg',
  workTime: { byWeekday: {
    1: regular, 2: regular, 3: [{ start: 480, end: 1080 }], 4: [{ start: 480, end: 660 }],
    5: regular, 6: [], 7: [],
  } },
};
const craneCalendar: WorkCalendar = {
  ...standard,
  id: 'crane',
  name: 'Kraankalender',
  holidays: [{ name: 'Kraan niet beschikbaar', startDate: '2026-06-02', endDate: '2026-06-02' }],
};
related().commitCalendarLibrary([standard, crew, craneCalendar], standard.id);
const predecessor = related().addTask({
  name: 'Voorganger', calendarId: crew.id, time: createDefaultTaskTime('2026-06-01T09:00', 1, 'hours'),
});
const successor = related().addTask({
  name: 'Opvolger', calendarId: crew.id, time: createDefaultTaskTime('2026-06-01T09:00', 1),
});
related().addSequence({ predecessorId: predecessor, successorId: successor, type: 'FINISH_FINISH', lagDays: 0 });
const relatedCrane = related().addResource({
  name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1, calendarId: craneCalendar.id,
});
related().assignResource(successor, relatedCrane, 1, 'UNIFORM');
related().runCPM();
assert.deepEqual(related().resourceLoadResult?.overallocatedDays[relatedCrane], ['2026-06-02']);
const withRelation = related().levelResources({ constrainToFloat: false });
assert.equal(withRelation.shifts[successor]?.newStart, '2026-06-03T13:00');
related().applyLeveling(withRelation);

const assertRelatedPlacement = (current: ReturnType<typeof related>) => {
  const pred = current.tasks.find(task => task.name === 'Voorganger')?.time;
  const succ = current.tasks.find(task => task.name === 'Opvolger')?.time;
  assert.deepEqual({
    successorStart: succ?.earlyStart,
    predecessorFinish: pred?.earlyFinish,
    predecessorLateFinish: pred?.lateFinish,
    predecessorFloatMinutes: pred?.totalFloatMinutes,
    overloaded: current.resourceLoadResult?.overallocatedDays,
  }, {
    successorStart: '2026-06-03T13:00',
    predecessorFinish: '2026-06-02T14:00',
    predecessorLateFinish: '2026-06-02T14:00',
    predecessorFloatMinutes: 0,
    overloaded: {},
  });
};
const relatedIfc = writeIFC(buildWriteIFCInput(related(), 'planOnly'));
const relatedReopened = createAppStoreContext().store.getState;
await relatedReopened().openOpenedFile({ name: 'nivelleren-einde-einde.ifc', content: relatedIfc, ref: null });
assertRelatedPlacement(related());
assertRelatedPlacement(relatedReopened());
relatedReopened().runCPM();
assertRelatedPlacement(relatedReopened());

const acrossBreak = createAppStoreContext().store.getState;
acrossBreak().setProject({ startDate: '2026-06-01' });
const projectBand = [{ start: 480, end: 1200 }];
const projectCalendar: WorkCalendar = {
  ...standard,
  workTime: { byWeekday: {
    1: projectBand, 2: projectBand, 3: projectBand, 4: projectBand, 5: projectBand, 6: [], 7: [],
  } },
};
const longBand = [{ start: 480, end: 1080 }];
const breakCalendar: WorkCalendar = {
  ...crew,
  workTime: { byWeekday: {
    1: regular, 2: [{ start: 480, end: 720 }, { start: 780, end: 1020 }],
    3: longBand, 4: longBand, 5: regular, 6: [], 7: [],
  } },
};
acrossBreak().commitCalendarLibrary([projectCalendar, breakCalendar, craneCalendar], projectCalendar.id);
acrossBreak().addTask({ name: 'Start project', time: createDefaultTaskTime('2026-06-01T08:00', 1, 'hours') });
const breakStart = acrossBreak().addTask({
  name: 'Voorganger', time: createDefaultTaskTime('2026-06-02T12:30', 1, 'hours'),
});
const breakFinish = acrossBreak().addTask({
  name: 'Opvolger', calendarId: breakCalendar.id, time: createDefaultTaskTime('2026-06-01T08:00', 0.5),
});
acrossBreak().addSequence({ predecessorId: breakStart, successorId: breakFinish, type: 'START_FINISH', lagDays: 0 });
const breakCrane = acrossBreak().addResource({
  name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1, calendarId: craneCalendar.id,
});
acrossBreak().assignResource(breakFinish, breakCrane, 1, 'UNIFORM');
acrossBreak().runCPM();
const breakProposal = acrossBreak().levelResources({ constrainToFloat: false });
assert.equal(breakProposal.delayMinutes?.[breakFinish], 480);
acrossBreak().applyLeveling(breakProposal);

const assertBreakPlacement = (current: ReturnType<typeof acrossBreak>) => {
  const pred = current.tasks.find(task => task.name === 'Voorganger')?.time;
  const succ = current.tasks.find(task => task.name === 'Opvolger')?.time;
  assert.deepEqual({
    successorStart: succ?.earlyStart,
    predecessorStart: pred?.earlyStart,
    predecessorLateStart: pred?.lateStart,
    predecessorFloatMinutes: pred?.totalFloatMinutes,
    overloaded: current.resourceLoadResult?.overallocatedDays,
  }, {
    successorStart: '2026-06-03T08:00',
    predecessorStart: '2026-06-02T12:30',
    predecessorLateStart: '2026-06-02T14:00',
    predecessorFloatMinutes: 90,
    overloaded: {},
  });
};
assertBreakPlacement(acrossBreak());
acrossBreak().setStatusDate('2026-06-02T12:30');
acrossBreak().runCPM();
const breakIfc = writeIFC(buildWriteIFCInput(acrossBreak(), 'planOnly'));
const breakReopened = createAppStoreContext().store.getState;
await breakReopened().openOpenedFile({ name: 'nivelleren-begin-einde.ifc', content: breakIfc, ref: null });
assertBreakPlacement(acrossBreak());
assertBreakPlacement(breakReopened());
breakReopened().runCPM();
assertBreakPlacement(breakReopened());
