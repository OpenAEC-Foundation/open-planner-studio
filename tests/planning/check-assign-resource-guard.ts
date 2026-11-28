import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

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
const resId = S().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 1 });
useAppStore.setState(state => {
  const task = state.tasks.find(candidate => candidate.id === idA)!;
  task.timephasedFinishFloor = '2026-02-01';
  task.timephasedStartAnchor = '2026-01-01';
  task.timephasedDurationWalks = [{
    anchor: '2026-01-01', resourceCalendarId: state.calendar.id, workMinutes: 300,
  }];
  state.ui.notifications = [];
});
S().assignResource(idA, resId, 2);
eq('01 sanity: geldige toewijzing bestaat', S().assignments.length, 1);
eq('01b membership toevoegen wist beide timephased lagen', (() => {
  const task = S().tasks.find(candidate => candidate.id === idA)!;
  return {
    floor: task.timephasedFinishFloor,
    anchor: task.timephasedStartAnchor,
    walks: task.timephasedDurationWalks,
  };
})(), {});
eq('01c membership toevoegen meldt sturingsverlies eenmaal',
  S().ui.notifications.map(notification => notification.messageKey),
  ['notifications.mppTimephasedSteeringLost']);

const undoBeforeDuplicate = S().historyEvents.filter(event => event.state === 'applied').length;
S().assignResource(idA, resId, 9);
eq('01d dubbele resource op dezelfde taak wordt geweigerd', S().assignments.length, 1);
eq('01e dubbele resource maakt geen history-event',
  S().historyEvents.filter(event => event.state === 'applied').length, undoBeforeDuplicate);

const undoBefore = S().historyEvents.filter(event => event.state === 'applied').length;
S().assignResource(idB, 'res_bestaat_niet', 3);
eq('02 onbekend resourceId: geen toewijzing erbij', S().assignments.length, 1);
eq('03 onbekend resourceId: B.resourceIds blijft leeg', S().tasks.find(t => t.id === idB)?.resourceIds, []);
eq('04 onbekend resourceId: geen undo-snapshot', S().historyEvents.filter(event => event.state === 'applied').length, undoBefore);

S().assignResource(idB, null as unknown as string, 3);
S().assignResource(idB, undefined as unknown as string, 3);
eq('05 null/undefined resourceId: geen toewijzing erbij', S().assignments.length, 1);
eq('06 null/undefined resourceId: geen undo-snapshot', S().historyEvents.filter(event => event.state === 'applied').length, undoBefore);
eq('07 null/undefined resourceId: geen null in assignments', S().assignments.some(a => a.resourceId == null), false);

let saveOk = true;
let ifcAfterGuard = '';
try {
  ifcAfterGuard = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
} catch {
  saveOk = false;
}
eq('08 writeIFC na geweigerde toewijzing crasht niet', saveOk, true);
eq('09 writeIFC-uitvoer bevat de geldige toewijzing', ifcAfterGuard.includes('OPS_Assignments'), true);

useAppStore.setState((s) => {
  s.assignments.push({ id: 'asgn_poison', taskId: idB, resourceId: null as unknown as string, unitsPerDay: 1 });
});
let poisonedOk = true;
let ifcPoisoned = '';
try {
  ifcPoisoned = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
} catch {
  poisonedOk = false;
}
eq('10 writeIFC met vergiftigde toewijzing crasht niet', poisonedOk, true);
eq('11 geldige toewijzing overleeft de vergiftigde buurman', ifcPoisoned.includes('OPS_Assignments'), true);

if (diffs.length === 0) {
  console.log(`OK  assign-resource-guard-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  assign-resource-guard-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
