import './domStub';
import { planTaskAssignmentSet } from '@/engine/taskGrid/assignmentPlan';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { createAppStore } from '@/state/appStore';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { AssignmentSetIntent, CellEditIntent, TaskAssignmentToken } from '@/types/taskGrid';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function task(id: string, patch: Partial<Task> = {}): Task {
  return {
    id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 5, scheduleStart: '2026-01-01',
      scheduleFinish: '2026-01-07', earlyStart: '2026-01-01', earlyFinish: '2026-01-07',
      lateStart: '2026-01-01', lateFinish: '2026-01-07', freeFloat: 0, totalFloat: 0,
      isCritical: true, completion: 0,
    },
    ...patch,
  };
}

const tasks = [task('t-leaf'), task('t-summary', { childIds: ['t-child'] }), task('t-milestone', {
  isMilestone: true,
  time: { ...task('template').time, scheduleDuration: 0 },
})];
const resources: Resource[] = [
  { id: 'r-a', name: 'Ploeg A', type: 'LABOR', description: '', maxUnits: 2 },
  { id: 'r-b', name: 'Ploeg B', type: 'LABOR', description: '', maxUnits: 2 },
  { id: 'r-c', name: 'Ploeg C', type: 'LABOR', description: '', maxUnits: 2 },
];
const assignments: ResourceAssignment[] = [
  { id: 'a-a', taskId: 't-leaf', resourceId: 'r-a', unitsPerDay: 1, curve: 'BELL', workWindowStart: '2026-01-01' },
  { id: 'a-b', taskId: 't-leaf', resourceId: 'r-b', unitsPerDay: 0.5 },
];
const before = JSON.stringify({ tasks, resources, assignments });

function plan(taskId: string, tokens: readonly TaskAssignmentToken[]) {
  return planTaskAssignmentSet({ taskId, tokens, tasks, resources, assignments });
}

const diff = plan('t-leaf', [
  { resourceId: 'r-a', unitsPerDay: 1.5, curve: 'FRONT_LOADED' },
  { assignmentId: 'a-b', resourceId: 'r-b', unitsPerDay: 0.5 },
  { resourceId: 'r-c', unitsPerDay: 2 },
]);
eq('Setdiff behoudt bestaand id op resource-identiteit en plant update/add', diff.ok ? diff.value.operations : diff, [
  { kind: 'update', assignmentId: 'a-a', unitsPerDay: 1.5, curve: 'FRONT_LOADED' },
  { kind: 'add', taskId: 't-leaf', resourceId: 'r-c', unitsPerDay: 2 },
]);
eq('Setdiff meldt de geraakte taak eenmaal', diff.ok ? diff.value.touchedTaskIds : diff, ['t-leaf']);
eq('Membershipverandering wordt afzonderlijk gemeld', diff.ok ? diff.value.membershipChangedTaskIds : diff, ['t-leaf']);
eq('Planner muteert geen enkele invoer', JSON.stringify({ tasks, resources, assignments }), before);

const removal = plan('t-leaf', [{ assignmentId: 'a-a', resourceId: 'r-a', unitsPerDay: 1, curve: 'BELL' }]);
eq('Ontbrekende gewenste token plant remove en behoudt vensterdata buiten de operatie',
  removal.ok ? removal.value.operations : removal,
  [{ kind: 'remove', assignmentId: 'a-b', taskId: 't-leaf', resourceId: 'r-b' }]);

const same = plan('t-leaf', [
  { resourceId: 'r-a', unitsPerDay: 1, curve: 'BELL' },
  { resourceId: 'r-b', unitsPerDay: 0.5 },
]);
eq('Zelfde gewenste set zonder ids matcht op resource en is een no-op', same.ok ? same.value.operations : same, []);

const explicitUniform = plan('t-leaf', [
  { resourceId: 'r-a', unitsPerDay: 1, curve: 'BELL' },
  { resourceId: 'r-b', unitsPerDay: 0.5, curve: 'UNIFORM' },
]);
eq('Expliciete UNIFORM wordt naar de canonieke lege curve genormaliseerd',
  explicitUniform.ok ? explicitUniform.value.operations : explicitUniform,
  []);

for (const [label, taskId, tokens, code] of [
  ['onbekende taak', 't-missing', [], 'assignmentTaskNotFound'],
  ['summary', 't-summary', [], 'assignmentTaskUnavailable'],
  ['mijlpaal', 't-milestone', [], 'assignmentTaskUnavailable'],
  ['onbekende resource', 't-leaf', [{ resourceId: 'r-missing', unitsPerDay: 1 }], 'assignmentResourceNotFound'],
  ['dubbele resource', 't-leaf', [{ resourceId: 'r-a', unitsPerDay: 1 }, { resourceId: 'r-a', unitsPerDay: 2 }], 'assignmentDuplicateResource'],
] as const) {
  const result = plan(taskId, tokens);
  eq(`${label} wordt gericht geweigerd`, result.ok ? null : result.errors[0]?.code, code);
}

for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
  const result = plan('t-leaf', [{ resourceId: 'r-a', unitsPerDay: invalid }]);
  eq(`units ${String(invalid)} wordt geweigerd`, result.ok ? null : result.errors[0]?.code, 'assignmentUnits');
}

const duplicateAssignmentId = plan('t-leaf', [
  { assignmentId: 'a-a', resourceId: 'r-a', unitsPerDay: 1 },
  { assignmentId: 'a-a', resourceId: 'r-b', unitsPerDay: 1 },
]);
eq('Eén assignment-id mag niet twee tokens identificeren',
  duplicateAssignmentId.ok ? null : duplicateAssignmentId.errors[0]?.code,
  'assignmentDuplicateId');

const identitySwap = plan('t-leaf', [
  { assignmentId: 'a-a', resourceId: 'r-b', unitsPerDay: 1 },
]);
eq('Bestaande assignment-id mag niet stil van resource wisselen',
  identitySwap.ok ? null : identitySwap.errors[0]?.code,
  'assignmentIdentity');

const invalidCurve = plan('t-leaf', [
  { resourceId: 'r-a', unitsPerDay: 1, curve: 'ONBEKEND' as TaskAssignmentToken['curve'] },
]);
eq('Onbekende curve wordt geweigerd', invalidCurve.ok ? null : invalidCurve.errors[0]?.code, 'assignmentCurve');

function assignmentIntent(taskId: string, tokens: readonly TaskAssignmentToken[]): AssignmentSetIntent {
  return { kind: 'assignment-set', taskId, columnId: taskColumnId('assignment.resources'), tokens };
}

function transactionState(store: ReturnType<typeof createAppStore>) {
  const state = store.getState();
  return {
    tasks: state.tasks,
    assignments: state.assignments,
    resourceLoadResult: state.resourceLoadResult,
    isDirty: state.isDirty,
    historyEvents: state.historyEvents,
    notifications: state.ui.notifications,
  };
}

const store = createAppStore();
const storeTaskId = store.getState().addTask({ name: 'Transactietaak' });
const storeResourceIds = Array.from({ length: 5 }, (_, index) => store.getState().addResource({
  name: `Resource ${index + 1}`, type: 'LABOR', description: '', maxUnits: 2,
}));
store.setState(state => {
  const target = state.tasks.find(candidate => candidate.id === storeTaskId)!;
  target.timephasedFinishFloor = '2026-02-01';
  target.timephasedStartAnchor = '2026-01-01';
  target.timephasedDurationWalks = [{
    anchor: '2026-01-01', resourceCalendarId: state.calendar.id, workMinutes: 300,
  }];
  state.historyEvents = [];
  state.nextHistorySequence = 1;
  state.ui.notifications = [];
  state.isDirty = false;
});

const invalidTokens: TaskAssignmentToken[] = storeResourceIds.map((resourceId, index) => ({
  resourceId: index === 4 ? 'r-ontbreekt' : resourceId,
  unitsPerDay: index + 1,
}));
const beforeInvalidTransaction = JSON.stringify(transactionState(store));
let invalidPublications = 0;
const unsubscribeInvalid = store.subscribe(() => { invalidPublications++; });
const invalidTransaction = store.getState().runGridMutation([
  assignmentIntent(storeTaskId, invalidTokens),
]);
unsubscribeInvalid();
eq('Fout in laatste van vijf tokens weigert de transactie', invalidTransaction.ok, false);
eq('Fout in laatste token publiceert niets', invalidPublications, 0);
eq('Fout in laatste token laat data, load, history en meldingen byte-identiek',
  JSON.stringify(transactionState(store)), beforeInvalidTransaction);

const validTokens = storeResourceIds.slice(0, 2).map((resourceId, index) => ({
  resourceId, unitsPerDay: index + 1,
}));
const validPublications: ReturnType<typeof store.getState>[] = [];
const unsubscribeValid = store.subscribe(state => { validPublications.push(state); });
const validTransaction = store.getState().runGridMutation([
  assignmentIntent(storeTaskId, validTokens),
]);
unsubscribeValid();
const assigned = store.getState().assignments.filter(assignment => assignment.taskId === storeTaskId);
const assignedIds = assigned.map(assignment => assignment.id);
const assignedTask = store.getState().tasks.find(candidate => candidate.id === storeTaskId)!;
eq('Geldige multi-tokencommit slaagt', validTransaction.ok, true);
eq('Geldige multi-tokencommit publiceert data atomair en daarna pas de uitgestelde melding', {
  publications: validPublications.length,
  firstAssignments: validPublications[0]?.assignments.length,
  firstEvents: validPublications[0]?.historyEvents.length,
  firstHasLoad: validPublications[0]?.resourceLoadResult !== null,
  firstNotifications: validPublications[0]?.ui.notifications.length,
  secondNotifications: validPublications[1]?.ui.notifications.length,
}, {
  publications: 2, firstAssignments: 2, firstEvents: 1, firstHasLoad: true,
  firstNotifications: 0, secondNotifications: 1,
});
eq('Geldige multi-tokencommit maakt twee echte assignments',
  assigned.map(assignment => ({ resourceId: assignment.resourceId, unitsPerDay: assignment.unitsPerDay })),
  validTokens);
eq('Membershipcommit synchroniseert task.resourceIds', assignedTask.resourceIds, storeResourceIds.slice(0, 2));
eq('Membershipcommit wist beide timephased sturingslagen', {
  floor: assignedTask.timephasedFinishFloor,
  anchor: assignedTask.timephasedStartAnchor,
  walks: assignedTask.timephasedDurationWalks,
}, {});
eq('Membershipcommit maakt één historie-event', store.getState().historyEvents.length, 1);
eq('Membershipcommit meldt sturingsverlies eenmaal',
  store.getState().ui.notifications.map(notification => notification.messageKey),
  ['notifications.mppTimephasedSteeringLost']);
eq('Membershipcommit publiceert meteen resourcebelasting', store.getState().resourceLoadResult !== null, true);

store.setState(state => {
  const target = state.tasks.find(candidate => candidate.id === storeTaskId)!;
  target.timephasedFinishFloor = '2026-03-01';
  target.timephasedStartAnchor = '2026-02-01';
  target.timephasedDurationWalks = [{
    anchor: '2026-02-01', resourceCalendarId: state.calendar.id, workMinutes: 240,
  }];
  const importedAssignment = state.assignments.find(item => item.id === assignedIds[0])!;
  importedAssignment.workWindowStart = '2026-02-01';
  importedAssignment.workWindowFinish = '2026-02-05';
  state.historyEvents = [];
  state.nextHistorySequence = 1;
  state.ui.notifications = [];
  state.isDirty = false;
});
const updateTokens: TaskAssignmentToken[] = [
  { assignmentId: assignedIds[0], resourceId: storeResourceIds[0], unitsPerDay: 1.5, curve: 'BELL' },
  { assignmentId: assignedIds[1], resourceId: storeResourceIds[1], unitsPerDay: 2 },
];
const updateTransaction = store.getState().runGridMutation([
  assignmentIntent(storeTaskId, updateTokens),
]);
const afterUpdateTask = store.getState().tasks.find(candidate => candidate.id === storeTaskId)!;
eq('Units/curve-update slaagt', updateTransaction.ok, true);
eq('Units/curve-update behoudt beide assignment-ids',
  store.getState().assignments.filter(item => item.taskId === storeTaskId).map(item => item.id),
  assignedIds);
eq('Units/curve-update landt zonder vensterdata op assignment te vervangen',
  (() => {
    const assignment = store.getState().assignments.find(item => item.id === assignedIds[0]);
    return assignment ? {
      unitsPerDay: assignment.unitsPerDay,
      curve: assignment.curve,
      workWindowStart: assignment.workWindowStart,
      workWindowFinish: assignment.workWindowFinish,
    } : null;
  })(),
  {
    unitsPerDay: 1.5,
    curve: 'BELL',
    workWindowStart: '2026-02-01',
    workWindowFinish: '2026-02-05',
  });
eq('Units/curve-update behoudt beide timephased taaklagen', {
  floor: afterUpdateTask.timephasedFinishFloor,
  anchor: afterUpdateTask.timephasedStartAnchor,
  walks: afterUpdateTask.timephasedDurationWalks,
}, {
  floor: '2026-03-01', anchor: '2026-02-01',
  walks: [{ anchor: '2026-02-01', resourceCalendarId: store.getState().calendar.id, workMinutes: 240 }],
});
eq('Units/curve-update maakt één event en geen verliesmelding', {
  events: store.getState().historyEvents.length,
  notifications: store.getState().ui.notifications.length,
}, { events: 1, notifications: 0 });

store.setState(state => {
  state.historyEvents = [];
  state.nextHistorySequence = 1;
  state.ui.notifications = [];
  state.isDirty = false;
});
let noOpPublications = 0;
const unsubscribeNoOp = store.subscribe(() => { noOpPublications++; });
const noOp = store.getState().runGridMutation([assignmentIntent(storeTaskId, updateTokens)]);
unsubscribeNoOp();
eq('Identieke assignmentset is een geldige no-op', noOp.ok, true);
eq('Identieke assignmentset publiceert en registreert niets', {
  publications: noOpPublications,
  events: store.getState().historyEvents.length,
  dirty: store.getState().isDirty,
}, { publications: 0, events: 0, dirty: false });

const beforeMilestoneConflict = JSON.stringify(transactionState(store));
const milestoneEdit: CellEditIntent = {
  kind: 'cell-edit', taskId: storeTaskId, columnId: 'task.isMilestone' as CellEditIntent['columnId'],
  route: 'task-milestone', value: true,
};
const milestoneConflict = store.getState().runGridMutation([
  assignmentIntent(storeTaskId, updateTokens), milestoneEdit,
]);
eq('Eindtoestand met assignments op een mijlpaal wordt setbreed geweigerd',
  milestoneConflict.ok ? null : milestoneConflict.errors[0]?.code,
  'assignmentTaskUnavailable');
eq('Setbrede mijlpaalfout rolt ook eerdere writes volledig terug',
  JSON.stringify(transactionState(store)), beforeMilestoneConflict);

store.setState(state => {
  const target = state.tasks.find(candidate => candidate.id === storeTaskId)!;
  target.timephasedFinishFloor = '2026-04-01';
  target.timephasedStartAnchor = '2026-03-01';
  target.timephasedDurationWalks = [{
    anchor: '2026-03-01', resourceCalendarId: state.calendar.id, workMinutes: 180,
  }];
  state.historyEvents = [];
  state.nextHistorySequence = 1;
  state.ui.notifications = [];
  state.isDirty = false;
});
const removeTransaction = store.getState().runGridMutation([
  assignmentIntent(storeTaskId, [updateTokens[0]]),
]);
const afterRemoval = store.getState().tasks.find(candidate => candidate.id === storeTaskId)!;
eq('Token verwijderen verwijdert alleen de bedoelde assignment',
  removeTransaction.ok ? store.getState().assignments.map(item => item.id) : removeTransaction,
  [assignedIds[0]]);
eq('Token verwijderen synchroniseert resourceIds en wist beide sturingslagen', {
  resourceIds: afterRemoval.resourceIds,
  floor: afterRemoval.timephasedFinishFloor,
  anchor: afterRemoval.timephasedStartAnchor,
  walks: afterRemoval.timephasedDurationWalks,
}, { resourceIds: [storeResourceIds[0]] });
eq('Token verwijderen maakt één geschiedenis-event', store.getState().historyEvents.length, 1);

store.setState(state => {
  state.historyEvents = [];
  state.nextHistorySequence = 1;
  state.ui.notifications = [];
  state.isDirty = false;
});
const beforeConflictingSets = JSON.stringify(transactionState(store));
const conflictingSets = store.getState().runGridMutation([
  assignmentIntent(storeTaskId, [updateTokens[0]]),
  assignmentIntent(storeTaskId, [{ ...updateTokens[0], unitsPerDay: 99 }]),
]);
eq('Twee verschillende volledige sets voor dezelfde taak worden setbreed geweigerd',
  conflictingSets.ok ? null : conflictingSets.errors[0]?.code,
  'conflictingDuplicate');
eq('Tegenstrijdige volledige sets laten state byte-identiek',
  JSON.stringify(transactionState(store)), beforeConflictingSets);

if (diffs.length) {
  console.error(`FAIL task-grid-assignments: ${diffs.length}/${checks}`);
  for (const item of diffs) console.error(` - ${item}`);
  process.exit(1);
}
console.log(`OK  task-grid-assignments: ${checks}/${checks}`);
process.exit(0);
