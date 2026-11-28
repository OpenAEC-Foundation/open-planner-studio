import { useAppStore } from '@/state/appStore';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const idA = S().addTask({ name: 'A' });
const idB = S().addTask({ name: 'B' });
const idM = S().addTask({ name: 'M', isMilestone: true });
const idS = S().addTask({ name: 'S' });
S().addTask({ name: 'Sc', parentId: idS });
const idC = S().addTask({ name: 'C' });

const resId = S().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 1 });
S().assignResource(idA, resId, 4, 'BELL');
const asgn = () => S().assignments.find(a => a.taskId === idA && a.resourceId === resId);
eq('01 setup: toewijzing bestaat op A', !!asgn(), true);
const assignmentId = asgn()!.id;

S().assignResource(idC, resId, 2, 'UNIFORM');

useAppStore.setState(state => {
  for (const taskId of [idA, idB]) {
    const task = state.tasks.find(candidate => candidate.id === taskId)!;
    task.timephasedFinishFloor = '2026-02-01';
    task.timephasedStartAnchor = '2026-01-01';
    task.timephasedDurationWalks = [{
      anchor: '2026-01-01', resourceCalendarId: state.calendar.id, workMinutes: 300,
    }];
  }
  state.ui.notifications = [];
});
const moved = S().moveAssignment(assignmentId, idB);
eq('02 moveAssignment retourneert true', moved, true);
const afterMove = S().assignments.find(a => a.id === assignmentId);
eq('03 assignment.taskId == B', afterMove?.taskId, idB);
eq('04 unitsPerDay ongewijzigd (4)', afterMove?.unitsPerDay, 4);
eq('05 curve ongewijzigd (BELL)', afterMove?.curve, 'BELL');
eq('06 A.resourceIds bevat de resource niet meer', S().tasks.find(t => t.id === idA)?.resourceIds.includes(resId), false);
eq('07 B.resourceIds bevat de resource nu wel', S().tasks.find(t => t.id === idB)?.resourceIds.includes(resId), true);
eq('07b move wist beide timephased lagen op oude én nieuwe taak', [idA, idB].map(taskId => {
  const task = S().tasks.find(candidate => candidate.id === taskId)!;
  return {
    floor: task.timephasedFinishFloor,
    anchor: task.timephasedStartAnchor,
    walks: task.timephasedDurationWalks,
  };
}), [{}, {}]);
eq('07c move meldt beide geraakte taken in één waarschuwing',
  S().ui.notifications.map(notification => ({ key: notification.messageKey, count: notification.params?.count })),
  [{ key: 'notifications.mppTimephasedSteeringLost', count: 2 }]);

const rejM = S().moveAssignment(assignmentId, idM);
eq('08 weiger mijlpaal-doeltaak: retourneert false', rejM, false);
eq('09 weiger mijlpaal: assignment blijft op B', S().assignments.find(a => a.id === assignmentId)?.taskId, idB);

const rejS = S().moveAssignment(assignmentId, idS);
eq('10 weiger summary-doeltaak: retourneert false', rejS, false);
eq('11 weiger summary: assignment blijft op B', S().assignments.find(a => a.id === assignmentId)?.taskId, idB);

const rejDup = S().moveAssignment(assignmentId, idC);
eq('12 weiger dubbele resource-op-taak: retourneert false', rejDup, false);
eq('13 weiger dubbel: assignment blijft op B', S().assignments.find(a => a.id === assignmentId)?.taskId, idB);
eq('14 weiger dubbel: C behoudt zijn EIGEN (ongemoeide) toewijzing', S().assignments.filter(a => a.taskId === idC && a.resourceId === resId).length, 1);

eq('15 onbekend assignmentId ⇒ false', S().moveAssignment('nope', idA), false);

const movedBack = S().moveAssignment(assignmentId, idA);
eq('16 verplaats terug naar A: retourneert true', movedBack, true);
eq('17 terug op A: taskId == A', S().assignments.find(a => a.id === assignmentId)?.taskId, idA);
eq('18 terug op A: B.resourceIds leeg (geen andere toewijzing meer)', S().tasks.find(t => t.id === idB)?.resourceIds.includes(resId), false);
eq('19 terug op A: A.resourceIds bevat de resource weer', S().tasks.find(t => t.id === idA)?.resourceIds.includes(resId), true);

if (diffs.length === 0) {
  console.log(`OK  move-assignment-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  move-assignment-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
