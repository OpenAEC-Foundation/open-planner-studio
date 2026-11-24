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

const startFinishResults: Array<Array<number | string | undefined>> = [];
for (const withBreak of [true, false]) {
  const schedule = createAppStoreContext().store.getState;
  schedule().setProject({ startDate: '2026-06-01' });
  const projectBand = [{ start: 480, end: 1200 }];
  const projectCalendar: WorkCalendar = {
    ...standard,
    workTime: { byWeekday: {
      1: projectBand, 2: projectBand, 3: projectBand, 4: projectBand, 5: projectBand, 6: [], 7: [],
    } },
  };
  const longBand = [{ start: 480, end: 1080 }];
  const crewCalendar: WorkCalendar = {
    ...crew,
    workTime: { byWeekday: {
      1: regular, 2: withBreak ? [{ start: 480, end: 720 }, { start: 780, end: 1020 }] : regular,
      3: longBand, 4: longBand, 5: regular, 6: [], 7: [],
    } },
  };
  const originalStart = withBreak ? '2026-06-02T12:30' : '2026-06-02T10:00';
  const lastValidStart = withBreak ? '2026-06-02T13:00' : originalStart;
  const firstInvalidStart = withBreak ? '2026-06-02T13:01' : '2026-06-02T10:01';
  const limit = withBreak ? '2026-06-03T13:00' : '2026-06-03T15:00';
  const firstLateFinish = withBreak ? '2026-06-03T13:01' : '2026-06-03T15:01';

  schedule().commitCalendarLibrary([projectCalendar, crewCalendar, craneCalendar], projectCalendar.id);
  if (!withBreak) schedule().setStatusDate(originalStart);
  schedule().addTask({ name: 'Start project', time: createDefaultTaskTime('2026-06-01T08:00', 1, 'hours') });
  const startTask = schedule().addTask({
    name: 'Voorganger', time: createDefaultTaskTime(originalStart, 1, 'hours'),
  });
  const finishTask = schedule().addTask({
    name: 'Opvolger', calendarId: crewCalendar.id, time: createDefaultTaskTime('2026-06-01T08:00', 0.5),
  });
  schedule().addSequence({ predecessorId: startTask, successorId: finishTask, type: 'START_FINISH', lagDays: 0 });
  const localCrane = schedule().addResource({
    name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1, calendarId: craneCalendar.id,
  });
  schedule().assignResource(finishTask, localCrane, 1, 'UNIFORM');
  schedule().runCPM();
  assert.deepEqual(schedule().resourceLoadResult?.overallocatedDays[localCrane], ['2026-06-02']);
  const sfProposal = schedule().levelResources({ constrainToFloat: false });
  assert.equal(sfProposal.delayMinutes?.[finishTask], withBreak ? 480 : 720);
  schedule().applyLeveling(sfProposal);
  assert.deepEqual(schedule().resourceLoadResult?.overallocatedDays, {});
  if (withBreak) schedule().setStatusDate(originalStart);
  schedule().updateTask(finishTask, { constraint: { type: 'FNLT', date: limit } });
  schedule().runCPM();

  const sfIfc = writeIFC(buildWriteIFCInput(schedule(), 'planOnly'));
  const sfReopened = createAppStoreContext().store.getState;
  await sfReopened().openOpenedFile({ name: 'nivelleren-begin-einde.ifc', content: sfIfc, ref: null });
  const pred = () => sfReopened().tasks.find(task => task.name === 'Voorganger')!;
  const succ = () => sfReopened().tasks.find(task => task.name === 'Opvolger')!;
  const snapshot = () => [pred().time.lateStart, pred().time.totalFloatMinutes];
  startFinishResults.push(snapshot());
  sfReopened().runCPM();
  startFinishResults.push(snapshot());
  assert.deepEqual(sfReopened().resourceLoadResult?.overallocatedDays, {});

  const movePredecessor = (scheduleStart: string) => {
    sfReopened().updateTask(pred().id, { time: { ...pred().time, scheduleStart } });
    sfReopened().runCPM();
  };
  movePredecessor(lastValidStart);
  assert.equal(succ().time.earlyFinish, limit);
  assert.equal(sfReopened().cpmResult?.violatedConstraintTaskIds.includes(succ().id), false);
  startFinishResults.push(snapshot());
  movePredecessor(firstInvalidStart);
  assert.equal(succ().time.earlyFinish, firstLateFinish);
  assert.equal(sfReopened().cpmResult?.violatedConstraintTaskIds.includes(succ().id), true);
  startFinishResults.push(snapshot());
}

assert.deepEqual(startFinishResults, [
  ['2026-06-02T13:00', 30], ['2026-06-02T13:00', 30], ['2026-06-02T13:00', 0], ['2026-06-02T13:00', -1],
  ['2026-06-02T10:00', 0], ['2026-06-02T10:00', 0], ['2026-06-02T10:00', 0], ['2026-06-02T10:00', -1],
]);

const calendarBoundaryResults: Array<Array<number | string | undefined>> = [];
for (const mode of ['project-pause', 'successor-calendar', 'work-lag', 'successor-gap', 'shared-gap', 'shared-gap-negative'] as const) {
  const schedule = createAppStoreContext().store.getState;
  const sharedGap = mode === 'shared-gap' || mode === 'shared-gap-negative';
  const gap = mode === 'successor-gap' || sharedGap;
  schedule().setProject({ startDate: '2026-06-01', schedulingOptions: {
    lagCalendar: mode === 'project-pause' ? 'projectDefault' : mode === 'work-lag' ? 'predecessor' : 'successor',
  } });
  const wide = [{ start: 480, end: 1200 }];
  const short = [{ start: 480, end: 840 }];
  const tuesdayBreak = [{ start: 480, end: 720 }, { start: 780, end: 1020 }];
  const week = (monday: typeof regular, tuesday: typeof regular, wednesday: typeof regular, rest: typeof regular) =>
    ({ byWeekday: { 1: monday, 2: tuesday, 3: wednesday, 4: rest, 5: rest, 6: [], 7: [] } });
  const projectCalendar: WorkCalendar = {
    ...standard, workTime: week(wide, mode === 'project-pause'
      ? [{ start: 480, end: 765 }, { start: 840, end: 1200 }] : wide, wide, wide),
  };
  const predecessorCalendar: WorkCalendar = {
    ...standard, id: 'predecessor', name: 'Kalender voorganger',
    workTime: week(regular, sharedGap ? tuesdayBreak : wide, wide, regular),
  };
  const crewCalendar: WorkCalendar = {
    ...crew, workTime: week(regular, tuesdayBreak, short, mode === 'work-lag' ? regular : short),
  };
  schedule().commitCalendarLibrary([projectCalendar, predecessorCalendar, crewCalendar, craneCalendar], projectCalendar.id);
  schedule().addTask({ name: 'Start project', time: createDefaultTaskTime('2026-06-01T08:00', 1, 'hours') });
  if (mode === 'work-lag' || gap) {
    schedule().addTask({ name: 'Einde project', time: createDefaultTaskTime('2026-06-05T08:00', 1, 'hours') });
  }
  const finishFinish = mode === 'successor-calendar' || gap;
  const dataDate = gap ? '2026-06-02T08:00' : '2026-06-02T09:00';
  const start = mode === 'shared-gap-negative' ? dataDate : finishFinish ? '2026-06-02T11:00' : '2026-06-02T12:30';
  const prior = schedule().addTask({
    name: 'Voorganger', calendarId: predecessorCalendar.id, time: createDefaultTaskTime(start, 1, 'hours'),
  });
  const next = schedule().addTask({
    name: 'Opvolger', calendarId: crewCalendar.id, time: createDefaultTaskTime('2026-06-01T08:00', 0.5),
  });
  const link = schedule().addSequence({
    predecessorId: prior, successorId: next, type: finishFinish ? 'FINISH_FINISH' : 'START_FINISH', lagDays: 0,
  });
  assert(link);
  const crane = schedule().addResource({
    name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1, calendarId: craneCalendar.id,
  });
  schedule().assignResource(next, crane, 1, 'UNIFORM');
  if (mode === 'shared-gap-negative') schedule().setStatusDate(dataDate);
  schedule().runCPM();
  const proposal = schedule().levelResources({ constrainToFloat: false });
  assert(proposal.delayMinutes?.[next]);
  if (mode === 'shared-gap-negative') assert.equal(proposal.delayMinutes?.[next], 660);
  schedule().applyLeveling(proposal);
  const limit = mode === 'work-lag' ? '2026-06-03T13:00' : gap ? '2026-06-03T11:30' : '2026-06-03T11:00';
  schedule().setStatusDate(dataDate);
  if (mode === 'work-lag') {
    schedule().updateSequence(link, { type: 'FINISH_FINISH', lagMinutes: 30, lagUnit: 'WORKTIME' });
  }
  if (mode === 'work-lag' || gap) {
    const task = schedule().tasks.find(task => task.id === prior)!;
    const scheduleStart = mode === 'shared-gap-negative' ? '2026-06-02T11:00' : dataDate;
    schedule().updateTask(prior, { time: { ...task.time, scheduleStart } });
  }
  schedule().updateTask(next, { constraint: { type: 'FNLT', date: limit } });
  schedule().runCPM();

  const ifc = writeIFC(buildWriteIFCInput(schedule(), 'planOnly'));
  const reopened = createAppStoreContext().store.getState;
  await reopened().openOpenedFile({ name: 'nivelleren-relatiekalender.ifc', content: ifc, ref: null });
  const pred = () => reopened().tasks.find(task => task.name === 'Voorganger')!;
  const succ = reopened().tasks.find(task => task.name === 'Opvolger')!;
  const takeSnapshot = () => [pred().time.lateStart, pred().time.totalFloatMinutes];
  calendarBoundaryResults.push(takeSnapshot());
  reopened().runCPM();
  calendarBoundaryResults.push(takeSnapshot());

  const last = mode === 'project-pause' ? '2026-06-02T13:00'
    : mode === 'shared-gap' ? '2026-06-02T11:30' : mode === 'shared-gap-negative' ? '2026-06-02T08:30'
      : finishFinish ? '2026-06-02T11:00' : '2026-06-02T10:30';
  const after = last.slice(0, -1) + '1';
  for (const [scheduleStart, expectedViolation] of [[last, false], [after, true]] as const) {
    reopened().updateTask(pred().id, { time: { ...pred().time, scheduleStart } });
    reopened().runCPM();
    assert.equal(reopened().cpmResult?.violatedConstraintTaskIds.includes(succ.id), expectedViolation);
    calendarBoundaryResults.push(takeSnapshot());
  }
  if (mode === 'successor-gap') {
    reopened().updateTask(pred().id, { time: { ...pred().time, scheduleStart: '2026-06-02T12:30' } });
    reopened().runCPM();
    assert.equal(reopened().cpmResult?.violatedConstraintTaskIds.includes(succ.id), false);
    calendarBoundaryResults.push(takeSnapshot());
  }
  if (mode === 'shared-gap-negative') {
    reopened().updateTask(pred().id, { time: { ...pred().time, scheduleStart: '2026-06-02T11:01' } });
    reopened().runCPM();
    assert.equal(reopened().cpmResult?.violatedConstraintTaskIds.includes(succ.id), true);
    calendarBoundaryResults.push(takeSnapshot());
  }
}

assert.deepEqual(calendarBoundaryResults, [
  ['2026-06-02T13:00', 30], ['2026-06-02T13:00', 30], ['2026-06-02T13:00', 0], ['2026-06-02T13:00', -1],
  ['2026-06-02T11:00', 0], ['2026-06-02T11:00', 0], ['2026-06-02T11:00', 0], ['2026-06-02T11:00', -1],
  ['2026-06-02T10:30', 90], ['2026-06-02T10:30', 90], ['2026-06-02T10:30', 0], ['2026-06-02T10:30', -1],
  ['2026-06-02T11:00', 180], ['2026-06-02T11:00', 180], ['2026-06-02T11:00', 0], ['2026-06-02T11:00', -1],
  ['2026-06-02T12:30', 0],
  ['2026-06-02T11:30', 210], ['2026-06-02T11:30', 210], ['2026-06-02T11:30', 0], ['2026-06-02T11:30', -1],
  ['2026-06-02T08:30', -150], ['2026-06-02T08:30', -150], ['2026-06-02T08:30', 0], ['2026-06-02T08:30', -1],
  ['2026-06-02T08:30', -151],
]);

const tiedFinishDates: Array<Array<string | number | undefined>> = [];
const pinnedDates: Array<Array<string | number | undefined>> = [];
for (const finishStartFirst of [false, true]) {
  const schedule = createAppStoreContext().store.getState;
  schedule().setProject({ startDate: '2026-06-01' });
  const workWeek = (start: number, end: number): WorkCalendar['workTime'] => {
    const work = [{ start, end }];
    return { byWeekday: { 1: work, 2: work, 3: work, 4: work, 5: work, 6: [], 7: [] } };
  };
  const projectCalendar = { ...standard, workTime: workWeek(480, 960) };
  const crewCalendar = { ...crew, workTime: workWeek(600, 1080) };
  schedule().commitCalendarLibrary([projectCalendar, crewCalendar, craneCalendar], projectCalendar.id);
  schedule().addTask({ name: 'Start project', time: createDefaultTaskTime('2026-06-01T08:00', 1, 'hours') });
  schedule().addTask({ name: 'Einde project', time: createDefaultTaskTime('2026-06-05T08:00', 1, 'hours') });
  const predecessor = schedule().addTask({
    name: 'Voorganger', time: createDefaultTaskTime('2026-06-02T14:00', 1, 'hours'),
  });
  const leveled = schedule().addTask({
    name: 'Kraantaak', calendarId: crewCalendar.id, time: createDefaultTaskTime('2026-06-01T10:00', 0.5),
  });
  const other = schedule().addTask({
    name: 'Tweede opvolger', time: createDefaultTaskTime('2026-06-01T08:00', 1, 'hours'),
  });
  const relations = [
    { successorId: leveled, type: 'START_FINISH' },
    { successorId: other, type: 'FINISH_START' },
  ] as const;
  for (const relation of finishStartFirst ? [...relations].reverse() : relations) {
    schedule().addSequence({ ...relation, predecessorId: predecessor, lagDays: 0 });
  }
  const crane = schedule().addResource({
    name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1, calendarId: craneCalendar.id,
  });
  schedule().assignResource(leveled, crane, 1, 'UNIFORM');
  schedule().runCPM();
  const proposal = schedule().levelResources({ constrainToFloat: false });
  assert.equal(proposal.delayMinutes?.[leveled], 480);
  schedule().applyLeveling(proposal);
  schedule().setStatusDate('2026-06-02T08:00');
  schedule().updateTask(other, { constraint: { type: 'SNLT', date: '2026-06-03T09:00' } });
  schedule().updateTask(leveled, { constraint: { type: 'FNLT', date: '2026-06-03T16:00' } });
  schedule().runCPM();

  const content = writeIFC(buildWriteIFCInput(schedule(), 'planOnly'));
  const reopened = createAppStoreContext().store.getState;
  await reopened().openOpenedFile({ name: 'gelijke-eindgrenzen.ifc', content, ref: null });
  const prior = () => reopened().tasks.find(task => task.name === 'Voorganger')!;
  const recordLateDates = () => {
    const { lateStart, lateFinish, totalFloatMinutes } = prior().time;
    tiedFinishDates.push([lateStart, lateFinish, totalFloatMinutes]);
  };
  recordLateDates();
  reopened().runCPM();
  recordLateDates();
  const leveledId = reopened().tasks.find(task => task.name === 'Kraantaak')!.id;
  for (const [scheduleStart, expectedViolation] of [['2026-06-02T16:00', false], ['2026-06-03T08:00', true]] as const) {
    reopened().updateTask(prior().id, { time: { ...prior().time, scheduleStart } });
    reopened().runCPM();
    assert.equal(reopened().cpmResult?.violatedConstraintTaskIds.includes(leveledId), expectedViolation);
  }
  for (const [type, date] of [['MSO', '2026-06-03T08:00'], ['MFO', '2026-06-03T09:00']] as const) {
    reopened().updateTask(prior().id, { constraint: { type, date, hard: true } });
    reopened().runCPM();
    const pinnedFile = writeIFC(buildWriteIFCInput(reopened(), 'planOnly'));
    const reopenedPinned = createAppStoreContext().store.getState;
    await reopenedPinned().openOpenedFile({ name: 'harde-datum.ifc', content: pinnedFile, ref: null });
    const recordPinnedDates = () => {
      const task = reopenedPinned().tasks.find(task => task.name === 'Voorganger')!;
      assert.equal(task.constraint?.hard, true);
      assert.equal(task.constraint?.type, type);
      const { lateStart, lateFinish, totalFloatMinutes } = task.time;
      pinnedDates.push([lateStart, lateFinish, totalFloatMinutes]);
    };
    recordPinnedDates();
    reopenedPinned().runCPM();
    recordPinnedDates();
  }
}
assert.deepEqual(tiedFinishDates, Array.from({ length: 4 }, () => ['2026-06-02T16:00', '2026-06-03T09:00', 120]));
assert.deepEqual(pinnedDates, Array.from({ length: 8 }, () => ['2026-06-03T08:00', '2026-06-03T09:00', 0]));
