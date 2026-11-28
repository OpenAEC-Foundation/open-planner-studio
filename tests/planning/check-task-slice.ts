import { useAppStore } from '@/state/appStore';
import {
  createDefaultTaskTime, taskHasActiveTimephasedSteering, taskHasTimephasedContours,
} from '@/utils/taskDefaults';
import { runGridMutation } from '@/state/gridTransaction';
import { progress } from '@/state/mcpValidation';
import type { Task } from '@/types/task';
import type { CellEditIntent } from '@/types/taskGrid';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

const task = (id: string): Task | undefined => S().tasks.find(t => t.id === id);

S().newProject();
ok('setup: fris project heeft geen statusdatum', S().project.statusDate === undefined);

const idA = S().addTask({
  name: 'A',
  time: createDefaultTaskTime('2015-01-05', 5),
});
S().runCPM();
ok('setup: runCPM zet scheduleStale terug op false', S().scheduleStale === false);

const plannedFinish = task(idA)?.time.earlyFinish;
ok(`setup: taak heeft een berekende earlyFinish (kreeg: ${plannedFinish})`, !!plannedFinish && plannedFinish.startsWith('2015-01'));

S().setTaskProgress(idA, 1);
const afterA = task(idA);

ok(
  `prog-h1-geen-teleport-naar-vandaag: actualFinish (${afterA?.time.actualFinish}) === eigen geplande finish (${plannedFinish}), NIET vandaag`,
  afterA?.time.actualFinish === plannedFinish,
);
ok(
  `prog-h1-geen-teleport-naar-vandaag: actualFinish valt niet toevallig in het huidige kalenderjaar (${afterA?.time.actualFinish})`,
  !!afterA?.time.actualFinish && !afterA.time.actualFinish.startsWith(new Date().getFullYear().toString()),
);
ok('prog-h1-geen-teleport-naar-vandaag: completion blijft 1', afterA?.time.completion === 1);
ok('prog-h1-geen-teleport-naar-vandaag: status COMPLETED', afterA?.status === 'COMPLETED');

ok(
  `prog-h1-stale-zonder-statusdatum: scheduleStale === true ná setTaskProgress(...,1) zonder statusdatum (kreeg: ${S().scheduleStale})`,
  S().scheduleStale === true,
);

S().runCPM();
const idB = S().addTask({ name: 'B', time: createDefaultTaskTime('2015-02-02', 3) });
S().runCPM();
ok('controle-setup: scheduleStale weer false ná de tweede runCPM', S().scheduleStale === false);
S().setActualStart(idB, '2015-02-02');
ok(
  `prog-h1-stale-zonder-statusdatum (setActualStart): scheduleStale === true (kreeg: ${S().scheduleStale})`,
  S().scheduleStale === true,
);

S().runCPM();
S().setActualFinish(idB, '2015-02-04');
ok(
  `prog-h1-stale-zonder-statusdatum (setActualFinish): scheduleStale === true (kreeg: ${S().scheduleStale})`,
  S().scheduleStale === true,
);

S().runCPM();
const idC = S().addTask({ name: 'C', time: createDefaultTaskTime('2026-07-06', 3) });
S().setStatusDate('2026-07-06');
S().runCPM();

const acceptedSameDayHour = S().setActualStart(idC, '2026-07-06T08:00');
ok(
  `t16-actual-statusdate-zelfde-dag-uur (setActualStart): geaccepteerd (kreeg: ${acceptedSameDayHour})`,
  acceptedSameDayHour === true,
);
ok(
  `t16-actual-statusdate-zelfde-dag-uur: actualStart daadwerkelijk gezet (kreeg: ${task(idC)?.time.actualStart})`,
  task(idC)?.time.actualStart === '2026-07-06T08:00',
);

const rejectedNextDay = S().setActualStart(idC, '2026-07-07T00:01');
ok(
  `t16-actual-statusdate-latere-dag (setActualStart): geweigerd (kreeg: ${rejectedNextDay})`,
  rejectedNextDay === false,
);
ok(
  `t16-actual-statusdate-latere-dag: actualStart blijft ongewijzigd (kreeg: ${task(idC)?.time.actualStart})`,
  task(idC)?.time.actualStart === '2026-07-06T08:00',
);

const acceptedFinishSameDayHour = S().setActualFinish(idC, '2026-07-06T17:00');
ok(
  `t16-actual-statusdate-zelfde-dag-uur (setActualFinish): geaccepteerd (kreeg: ${acceptedFinishSameDayHour})`,
  acceptedFinishSameDayHour === true,
);

{
  const setup = () => {
    S().newProject();
    S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-10' });
    const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-06-01', 5) });
    const m = S().addTask({ name: 'M', isMilestone: true });
    const l = S().addTask({ name: 'L', time: createDefaultTaskTime('2026-06-01', 10) });
    const f = S().addTask({ name: 'F', time: createDefaultTaskTime('2026-06-01', 3) });
    S().addSequence({ predecessorId: a, successorId: m, type: 'FINISH_START', lagDays: 0 });
    S().addSequence({ predecessorId: l, successorId: f, type: 'FINISH_START', lagDays: 0 });
    S().runCPM();
    S().setActualStart(a, '2026-06-01');
    S().setActualFinish(a, '2026-06-05');
    S().setActualStart(l, '2026-06-01');
    S().setTaskProgress(l, 0.3);
    return { m, f };
  };
  const actuals = (time: { actualStart?: string; actualFinish?: string }) => `AS ${time.actualStart} / AF ${time.actualFinish}`;
  const inOrder = (time: { actualStart?: string; actualFinish?: string }) =>
    !!time.actualStart && !!time.actualFinish && time.actualStart <= time.actualFinish;

  let ids = setup();
  const staleStart = task(ids.m)!.time.earlyStart;
  ok(`mijlpaal-100-verouderd: voorwaarde — verouderde ES (${staleStart}) ligt ná de statusdatum`, staleStart > '2026-06-10');
  S().setTaskProgress(ids.m, 1);
  ok(`mijlpaal-100-verouderd: AS niet ná AF (${actuals(task(ids.m)!.time)})`, inOrder(task(ids.m)!.time));
  ok(`mijlpaal-100-verouderd: AS = AF = gepland moment na afmelden voorganger (${actuals(task(ids.m)!.time)})`,
    task(ids.m)!.time.actualStart === '2026-06-08T07:00' && task(ids.m)!.time.actualFinish === '2026-06-08T07:00');

  ids = setup();
  S().runCPM();
  ok(`toekomstige-taak-100: voorwaarde — verse ES (${task(ids.f)!.time.earlyStart}) ná de statusdatum`, task(ids.f)!.time.earlyStart > '2026-06-10');
  S().setTaskProgress(ids.f, 1);
  ok(`toekomstige-taak-100 (setTaskProgress): AS = AF = statusdatum (${actuals(task(ids.f)!.time)})`,
    task(ids.f)!.time.actualStart === '2026-06-10T16:00' && task(ids.f)!.time.actualFinish === '2026-06-10T16:00');

  ids = setup();
  S().runCPM();
  const grid = runGridMutation([{ kind: 'cell-edit', taskId: ids.f, columnId: 'task.time.completion' as CellEditIntent['columnId'], route: 'task-progress', value: 1 }]);
  ok(`toekomstige-taak-100 (rastercel): geaccepteerd en AS niet ná AF (${grid.ok}, ${actuals(task(ids.f)!.time)})`, grid.ok && inOrder(task(ids.f)!.time));

  const mcpDraft = { ...S(), tasks: structuredClone(S().tasks), assignments: structuredClone(S().assignments) } as unknown as Parameters<typeof progress.applyProgressUpdate>[0];
  const mcpTask = (mcpDraft.tasks as Task[]).find(t => t.name === 'F')!;
  mcpTask.time.completion = 0; mcpTask.time.actualStart = undefined; mcpTask.time.actualFinish = undefined;
  const refused = progress.applyProgressUpdate(mcpDraft, mcpTask.id, { completion: 100 }, '2026-06-10');
  ok(`toekomstige-taak-100 (MCP): zonder actualStart geweigerd, taak ongemoeid (${refused.applied}, ${actuals(mcpTask.time)})`,
    !refused.applied && !mcpTask.time.actualStart && !mcpTask.time.actualFinish);
  const mcp = progress.applyProgressUpdate(mcpDraft, mcpTask.id, { completion: 100, actualStart: '2026-06-08' }, '2026-06-10');
  ok(`toekomstige-taak-100 (MCP): mét actualStart toegepast en AS niet ná AF (${mcp.applied}, ${actuals(mcpTask.time)})`, mcp.applied && inOrder(mcpTask.time));

  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  const late = S().addTask({ name: 'Laat', time: createDefaultTaskTime('2026-06-01', 3) });
  S().runCPM();
  S().setActualStart(late, '2026-06-08');
  S().setTaskProgress(late, 1);
  ok(`zonder-statusdatum-100: vastgelegde AS blijft, AF niet ervóór (${actuals(task(late)!.time)})`,
    task(late)!.time.actualStart === '2026-06-08T07:00' && inOrder(task(late)!.time));
}

{
  S().runCPM();
  const idW = S().addTask({ name: 'Z14b-venster', time: createDefaultTaskTime('2026-08-03', 5) });
  S().runCPM();

  const seedWindow = () => {
    S().updateTask(idW, {
      timephasedFinishFloor: '2026-08-10T17:00',
      timephasedStartAnchor: '2026-08-03T08:00',
      timephasedContours: [{ resourceUid: 42, periods: [{ afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' }] }],
    });
  };

  seedWindow();
  S().updateTask(idW, { name: 'Z14b-venster (hernoemd)' });
  const afterRename = task(idW);
  ok('z14b-venster: een naamswijziging (geen trigger) laat het venster ongemoeid',
    afterRename?.timephasedFinishFloor === '2026-08-10T17:00' && afterRename?.timephasedStartAnchor === '2026-08-03T08:00');
  ok('z14b-venster: de rauwe contouren blijven sowieso staan (geen trigger geraakt)',
    (afterRename?.timephasedContours?.length ?? 0) === 1);

  seedWindow();
  const beforeDur = task(idW)!;
  S().updateTask(idW, { time: { ...beforeDur.time, scheduleDuration: 7 } });
  const afterDur = task(idW);
  ok(`z14b-venster (duur-trigger): timephasedFinishFloor gewist (kreeg: ${afterDur?.timephasedFinishFloor})`,
    afterDur?.timephasedFinishFloor === undefined);
  ok(`z14b-venster (duur-trigger): timephasedStartAnchor gewist (kreeg: ${afterDur?.timephasedStartAnchor})`,
    afterDur?.timephasedStartAnchor === undefined);
  ok('z14b-venster (duur-trigger): de RAUWE contouren blijven staan — eigenaarsprincipe',
    (afterDur?.timephasedContours?.length ?? 0) === 1);

  seedWindow();
  S().addCalendar({ name: 'Z14b-kalender', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 17, hoursPerDay: 8, holidays: [] });
  const newCalId = S().calendars.find((c) => c.name === 'Z14b-kalender')!.id;
  S().setTaskCalendar(idW, newCalId);
  const afterCal = task(idW);
  ok(`z14b-venster (kalender-trigger): timephasedFinishFloor gewist (kreeg: ${afterCal?.timephasedFinishFloor})`,
    afterCal?.timephasedFinishFloor === undefined);
  ok(`z14b-venster (kalender-trigger): timephasedStartAnchor gewist (kreeg: ${afterCal?.timephasedStartAnchor})`,
    afterCal?.timephasedStartAnchor === undefined);
  ok('z14b-venster (kalender-trigger): de RAUWE contouren blijven staan',
    (afterCal?.timephasedContours?.length ?? 0) === 1);

  const resId = S().addResource({ name: 'Z14b-resource', type: 'LABOR', description: '', maxUnits: 1 });

  const idAssign = S().addTask({ name: 'Z14b-venster-assign', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idAssign, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  S().assignResource(idAssign, resId, 1);
  ok(`z14b-venster (assignResource-trigger): timephasedFinishFloor gewist (kreeg: ${task(idAssign)?.timephasedFinishFloor})`,
    task(idAssign)?.timephasedFinishFloor === undefined);

  const idMoveFrom = S().addTask({ name: 'Z14b-venster-move-van', time: createDefaultTaskTime('2026-08-03', 5) });
  const idMoveTo = S().addTask({ name: 'Z14b-venster-move-naar', time: createDefaultTaskTime('2026-08-03', 5) });
  S().assignResource(idMoveFrom, resId, 1);
  const moveAsnId = S().assignments.find((a) => a.taskId === idMoveFrom && a.resourceId === resId)!.id;
  S().updateTask(idMoveFrom, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  S().updateTask(idMoveTo, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  S().moveAssignment(moveAsnId, idMoveTo);
  ok('z14b-venster (moveAssignment-trigger): bronTaak venster gewist', task(idMoveFrom)?.timephasedFinishFloor === undefined);
  ok('z14b-venster (moveAssignment-trigger): doelTaak venster gewist', task(idMoveTo)?.timephasedFinishFloor === undefined);

  const idUnassign = S().addTask({ name: 'Z14b-venster-unassign', time: createDefaultTaskTime('2026-08-03', 5) });
  S().assignResource(idUnassign, resId, 1);
  const unassignAsnId = S().assignments.find((a) => a.taskId === idUnassign && a.resourceId === resId)!.id;
  S().updateTask(idUnassign, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  S().unassignResource(unassignAsnId);
  ok('z14b-venster (unassignResource-trigger): venster gewist', task(idUnassign)?.timephasedFinishFloor === undefined);

  const walkSeed = [{ anchor: '2026-08-03T08:00', resourceCalendarId: 'libcal' }];
  const idAssignW = S().addTask({ name: 'Z14b-walks-assign', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idAssignW, { timephasedDurationWalks: walkSeed });
  S().assignResource(idAssignW, resId, 1);
  ok(`f2 (assignResource-trigger): timephasedDurationWalks gewist (kreeg: ${JSON.stringify(task(idAssignW)?.timephasedDurationWalks)})`,
    task(idAssignW)?.timephasedDurationWalks === undefined);

  const idMoveFromW = S().addTask({ name: 'Z14b-walks-move-van', time: createDefaultTaskTime('2026-08-03', 5) });
  const idMoveToW = S().addTask({ name: 'Z14b-walks-move-naar', time: createDefaultTaskTime('2026-08-03', 5) });
  S().assignResource(idMoveFromW, resId, 1);
  const moveAsnIdW = S().assignments.find((a) => a.taskId === idMoveFromW && a.resourceId === resId)!.id;
  S().updateTask(idMoveFromW, { timephasedDurationWalks: walkSeed });
  S().updateTask(idMoveToW, { timephasedDurationWalks: walkSeed });
  S().moveAssignment(moveAsnIdW, idMoveToW);
  ok('f2 (moveAssignment-trigger): bronTaak timephasedDurationWalks gewist', task(idMoveFromW)?.timephasedDurationWalks === undefined);
  ok('f2 (moveAssignment-trigger): doelTaak timephasedDurationWalks gewist', task(idMoveToW)?.timephasedDurationWalks === undefined);

  const idUnassignW = S().addTask({ name: 'Z14b-walks-unassign', time: createDefaultTaskTime('2026-08-03', 5) });
  S().assignResource(idUnassignW, resId, 1);
  const unassignAsnIdW = S().assignments.find((a) => a.taskId === idUnassignW && a.resourceId === resId)!.id;
  S().updateTask(idUnassignW, { timephasedDurationWalks: walkSeed });
  S().unassignResource(unassignAsnIdW);
  ok('f2 (unassignResource-trigger): timephasedDurationWalks gewist', task(idUnassignW)?.timephasedDurationWalks === undefined);

  const idDurationW = S().addTask({ name: 'Z14b-walks-duur', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idDurationW, { timephasedDurationWalks: walkSeed });
  const beforeDurW = task(idDurationW)!;
  S().updateTask(idDurationW, { time: { ...beforeDurW.time, scheduleDuration: 8 } });
  ok('f2 controle: een duur-trigger laat timephasedDurationWalks ONGEMOEID zonder workMinutes (geen dubbele invalidatie)',
    task(idDurationW)?.timephasedDurationWalks?.length === 1);

  const walkSeedFrozen = [{ anchor: '2026-08-03T08:00', resourceCalendarId: 'libcal', workMinutes: 1440 }];

  const idDurationWF = S().addTask({ name: 'Z14b-walks-duur-frozen', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idDurationWF, { timephasedDurationWalks: walkSeedFrozen });
  const beforeDurWF = task(idDurationWF)!;
  S().updateTask(idDurationWF, { time: { ...beforeDurWF.time, scheduleDuration: 8 } });
  ok(`n2 (duur-trigger, workMinutes gezet): timephasedDurationWalks GEWIST (kreeg: ${JSON.stringify(task(idDurationWF)?.timephasedDurationWalks)})`,
    task(idDurationWF)?.timephasedDurationWalks === undefined);

  const idDateWF = S().addTask({ name: 'Z14b-walks-datum-frozen', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idDateWF, { timephasedDurationWalks: walkSeedFrozen });
  const beforeDateWF = task(idDateWF)!;
  S().updateTask(idDateWF, { time: { ...beforeDateWF.time, scheduleStart: '2026-08-04' } });
  ok(`n2 (datum-trigger, workMinutes gezet): timephasedDurationWalks GEWIST (kreeg: ${JSON.stringify(task(idDateWF)?.timephasedDurationWalks)})`,
    task(idDateWF)?.timephasedDurationWalks === undefined);

  const idCalWF = S().addTask({ name: 'Z14b-walks-kalender-frozen', time: createDefaultTaskTime('2026-08-03', 5) });
  S().updateTask(idCalWF, { timephasedDurationWalks: walkSeedFrozen });
  S().addCalendar({ name: 'Z14b-walks-kalender-frozen-cal', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 17, hoursPerDay: 8, holidays: [] });
  const walkFrozenCalId = S().calendars.find((c) => c.name === 'Z14b-walks-kalender-frozen-cal')!.id;
  S().setTaskCalendar(idCalWF, walkFrozenCalId);
  ok(`n2 controle: een kalender-trigger laat timephasedDurationWalks ONGEMOEID óók mét workMinutes (buiten N2-scope, zie boven) (kreeg: ${JSON.stringify(task(idCalWF)?.timephasedDurationWalks)})`,
    task(idCalWF)?.timephasedDurationWalks?.length === 1);

  const idRemoveCal = S().addTask({ name: 'Z14b-removeCalendar', time: createDefaultTaskTime('2026-08-03', 5) });
  const removeCalId = S().addCalendar({
    name: 'Z14b-te-verwijderen', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 17, hoursPerDay: 8, holidays: [],
  });
  S().setTaskCalendar(idRemoveCal, removeCalId);
  S().updateTask(idRemoveCal, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  S().removeCalendar(removeCalId);
  ok(`f3 (removeCalendar): timephasedFinishFloor gewist (kreeg: ${task(idRemoveCal)?.timephasedFinishFloor})`,
    task(idRemoveCal)?.timephasedFinishFloor === undefined);
  ok('f3 (removeCalendar): taak.calendarId inderdaad terugveld naar projectkalender (voorwaarde)',
    task(idRemoveCal)?.calendarId === undefined);

  const idCommitCal = S().addTask({ name: 'Z14b-commitCalendarLibrary', time: createDefaultTaskTime('2026-08-03', 5) });
  const commitCalId = S().addCalendar({
    name: 'Z14b-commit-weggehaald', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 17, hoursPerDay: 8, holidays: [],
  });
  S().setTaskCalendar(idCommitCal, commitCalId);
  S().updateTask(idCommitCal, { timephasedFinishFloor: '2026-08-10T17:00', timephasedStartAnchor: '2026-08-03T08:00' });
  const remainingCalendars = S().calendars.filter((c) => c.id !== commitCalId);
  S().commitCalendarLibrary(remainingCalendars, S().project.calendarId!);
  ok(`f3 (commitCalendarLibrary): timephasedFinishFloor gewist (kreeg: ${task(idCommitCal)?.timephasedFinishFloor})`,
    task(idCommitCal)?.timephasedFinishFloor === undefined);
  ok('f3 (commitCalendarLibrary): taak.calendarId inderdaad terugveld naar projectkalender (voorwaarde)',
    task(idCommitCal)?.calendarId === undefined);

  {
    const idPanelActive3 = S().addTask({ name: 'Panel-actief-laag3', time: createDefaultTaskTime('2026-08-03', 5) });
    S().updateTask(idPanelActive3, {
      timephasedFinishFloor: '2026-08-10T17:00',
      timephasedStartAnchor: '2026-08-03T08:00',
      timephasedContours: [{ resourceUid: 1, periods: [{ afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' }] }],
    });
    ok('deel2-actief(laag3): taskHasActiveTimephasedSteering === true',
      taskHasActiveTimephasedSteering(task(idPanelActive3)!) === true);
    ok('deel2-actief(laag3): taskHasTimephasedContours === true',
      taskHasTimephasedContours(task(idPanelActive3)!) === true);

    const idPanelActive4 = S().addTask({ name: 'Panel-actief-laag4', time: createDefaultTaskTime('2026-08-03', 5) });
    S().updateTask(idPanelActive4, {
      timephasedDurationWalks: [{ anchor: '2026-08-03T08:00', resourceCalendarId: 'libcal' }],
      timephasedContours: [{ resourceUid: 2, periods: [{ afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' }] }],
    });
    ok('deel2-actief(laag4): taskHasActiveTimephasedSteering === true (walks niet-leeg, geen venster nodig)',
      taskHasActiveTimephasedSteering(task(idPanelActive4)!) === true);

    const idPanelLost = S().addTask({ name: 'Panel-losgelaten', time: createDefaultTaskTime('2026-08-03', 5) });
    S().updateTask(idPanelLost, {
      timephasedFinishFloor: '2026-08-10T17:00',
      timephasedStartAnchor: '2026-08-03T08:00',
      timephasedContours: [{ resourceUid: 3, periods: [{ afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' }] }],
    });
    const beforeLost = task(idPanelLost)!;
    S().updateTask(idPanelLost, { time: { ...beforeLost.time, scheduleDuration: 8 } });
    ok('deel2-losgelaten: taskHasActiveTimephasedSteering === false (venster is gewist)',
      taskHasActiveTimephasedSteering(task(idPanelLost)!) === false);
    ok('deel2-losgelaten: taskHasTimephasedContours === true (rauwe bron blijft staan — eigenaarsprincipe)',
      taskHasTimephasedContours(task(idPanelLost)!) === true);

    const idPanelNone = S().addTask({ name: 'Panel-geen-msp', time: createDefaultTaskTime('2026-08-03', 5) });
    ok('deel2-geen-msp: taskHasActiveTimephasedSteering === false',
      taskHasActiveTimephasedSteering(task(idPanelNone)!) === false);
    ok('deel2-geen-msp: taskHasTimephasedContours === false',
      taskHasTimephasedContours(task(idPanelNone)!) === false);
  }
}

if (diffs.length === 0) {
  console.log(`OK  task-slice-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  task-slice-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
