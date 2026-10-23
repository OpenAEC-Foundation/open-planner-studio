// F3a: T14, B1a en B3 op de pure driehoek en op gewone taakobjecten; geen store of solver.
import {
  applyAssignmentAdded, applyDurationEdit, applyUnitsEdit, type TriangleState,
} from '@/engine/work/workTriangle';
import {
  captureCalendarChange, captureProgressWork, captureTriangle, carryRemainingThroughDurationEdit,
  remainingMinutesOf, settleCalendarChange, settleDurationEdit, settleProgressWork, settleRuleChange,
  settleUnitsEdit, settleWorkEdit, slotMinutesOf, triangleStateOf, workRuleContextOf,
  type WorkRuleDeps,
} from '@/engine/work/workRuleApply';
import type { WorkCalendar } from '@/types/calendar';
import type { ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import { WORK_RULES } from '@/types/workRule';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

let checks = 0;
const failures: string[] = [];
function ok(label: string, value: boolean): void {
  checks++;
  if (!value) failures.push(label);
}
function near(label: string, value: number | undefined, expected: number): void {
  ok(`${label}: ${value} ≈ ${expected}`, value !== undefined && Math.abs(value - expected) < 1e-9);
}

const calendar: WorkCalendar = {
  id: 'week', name: 'Korte vrijdag', description: '', hoursPerDay: 9,
  workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, holidays: [],
  // Modale dag = 8 u; vrijdag = 6 u. De opgeslagen scalar 9 mag de brug niet gebruiken.
  workTime: { byWeekday: {
    1: [{ start: 420, end: 900 }], 2: [{ start: 420, end: 900 }],
    3: [{ start: 420, end: 900 }], 4: [{ start: 420, end: 900 }],
    5: [{ start: 420, end: 780 }], 6: [], 7: [],
  } },
};
function fixture(days = 5): { task: Task; assignments: ResourceAssignment[]; deps: WorkRuleDeps } {
  return {
    task: {
      id: 'task', name: 'Werk', description: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
      wbsCode: '', priority: 0, resourceIds: ['r'],
      isMilestone: false, parentId: null, childIds: [], calendarId: calendar.id,
      time: createDefaultTaskTime('2026-06-03T07:00', days),
    },
    assignments: [{ id: 'a', taskId: 'task', resourceId: 'r', unitsPerDay: 1 }],
    deps: { calendar, calendars: [calendar], resources: [], project: {} },
  };
}

// T14: de pure kern rekent zonder maat, ook onder één minuut. De brug toetst beide maten hieronder.
{
  const state: TriangleState = {
    rule: 'FIXED_RATE', remainingMinutes: 1200, slotMinutes: 480,
    assignments: [{ id: 'a', unitsPerDay: 1, drivesDuration: true }],
  };
  const units = applyUnitsEdit(state, 'a', 7);
  near('kern: 20 u / 7', units.ok ? units.state.remainingMinutes : undefined, 1200 / 7);
  const duration = applyDurationEdit(state, 0.25);
  near('kern: kwart minuut', duration.ok ? duration.state.remainingMinutes : undefined, 0.25);
  const added = applyAssignmentAdded(state, { id: 'b', unitsPerDay: 2 });
  near('kern: werk verdeeld over inzet 3', added.ok ? added.state.remainingMinutes : undefined, 400);
}
near('slot houdt de effectieve factor exact', slotMinutesOf({ hoursPerDay: 7.123 }), 427.38);

// Elke werkregel beschermt ook na exact terugschrijven dezelfde hoek van de driehoek.
for (const rule of WORK_RULES) {
  const { task, assignments, deps } = fixture(2.5);
  settleRuleChange(task, assignments, deps, rule);
  assignments[0].remainingWorkMinutes = 1200;
  const captured = captureTriangle(task, assignments, deps);
  task.time.scheduleDuration = 1.25;
  if (task.time.durationUnit === 'hours') task.time.durationMinutes = 600;
  settleDurationEdit(task, captured);
  const keepWork = rule === 'FIXED_WORK' || rule === 'FIXED_DURATION_WORK';
  near(`${rule}: inzet na halveren duur`, assignments[0].unitsPerDay, keepWork ? 2 : 1);
  near(`${rule}: restwerk na halveren duur`, assignments[0].remainingWorkMinutes, keepWork ? 1200 : 600);
}

// Brug: terugschrijven mag de exacte kernuitkomst niet opnieuw afronden.
for (const unit of ['days', 'hours'] as const) {
  const { task, assignments, deps } = fixture(2.5);
  task.workRule = 'FIXED_RATE';
  if (unit === 'hours') Object.assign(task.time, { durationUnit: unit, durationMinutes: 1200 });
  const captured = captureTriangle(task, assignments, deps);
  assignments[0].unitsPerDay = 7;
  const result = settleUnitsEdit(task, assignments, captured, 'a', 7);
  ok(`${unit}: duurwijziging gemeld`, result.durationChanged);
  near(`${unit}: exacte duur`, task.time.scheduleDuration, 2.5 / 7);
  if (unit === 'hours') near('urenbron exact', task.time.durationMinutes, 1200 / 7);
  near(`${unit}: werk blijft 20 u`, assignments[0].remainingWorkMinutes, 1200);
}

// B1a: 5d vast werk wordt 40 u, ook zonder toewijzingen en via de projectstandaard.
for (const inherited of [false, true]) {
  const { task, assignments, deps } = fixture();
  if (inherited) { deps.project.defaultWorkRule = 'FIXED_WORK'; assignments.length = 0; }
  const result = settleRuleChange(task, assignments, deps, inherited ? undefined : 'FIXED_WORK');
  ok('B1a: feitelijke maatwijziging gemeld', result.durationUnitChanged);
  ok('B1a: urenmaat', task.time.durationUnit === 'hours');
  near('B1a: 5d wordt 40 u, niet 45 u', task.time.durationMinutes, 2400);
  near('B1a: dagengetal blijft 5', task.time.scheduleDuration, 5);
  if (!inherited) near('B1a: werkanker', assignments[0].remainingWorkMinutes, 2400);
  ok('B1a: herhalen meldt geen maatwijziging', !settleRuleChange(task, assignments, deps, 'FIXED_WORK').durationUnitChanged);
  settleRuleChange(task, assignments, deps, 'FIXED_RATE');
  ok('B1a: wissel terug behoudt urenmaat', task.time.durationUnit === 'hours');
}
for (const start of ['2026-06-01T07:00', '2026-06-03T07:00', '2026-06-05T07:00']) {
  const { task, assignments, deps } = fixture(3);
  task.time.scheduleStart = start;
  settleRuleChange(task, assignments, deps, 'FIXED_WORK');
  near(`T14: 3d blijft 24 u bij start ${start}`, task.time.durationMinutes, 1440);
  near('T14: werk onafhankelijk van plaatsing', assignments[0].remainingWorkMinutes, 1440);
}
// B1a geldt ook op 100 %: de driehoek weigert rest 0, de maat moet toch worden omgezet.
{
  const { task, assignments, deps } = fixture();
  task.time.completion = 1; task.time.remainingTime = 0;
  const result = settleRuleChange(task, assignments, deps, 'FIXED_WORK');
  ok('voltooid: maatwijziging gemeld', result.durationUnitChanged);
  near('voltooid: 40 u', task.time.durationMinutes, 2400);
  near('voltooid: rest 0', task.time.remainingMinutes, 0);
}
for (const excluded of ['milestone', 'summary', 'hammock', 'elapsed'] as const) {
  const { task, assignments, deps } = fixture();
  if (excluded === 'milestone') task.isMilestone = true;
  if (excluded === 'summary') task.childIds = ['child'];
  if (excluded === 'hammock') task.isHammock = true;
  if (excluded === 'elapsed') task.time.durationType = 'ELAPSEDTIME';
  const before = JSON.stringify(task.time);
  const result = settleRuleChange(task, assignments, deps, 'FIXED_WORK');
  ok(`${excluded}: geen tijdmutatie`, JSON.stringify(task.time) === before && !result.durationUnitChanged);
}

// B3: 32 % op 5d geeft 3,4d rest; bij omzetten en inzetwijziging blijft verricht werk staan.
{
  const { task, assignments, deps } = fixture();
  task.time.completion = 0.32;
  const ctx = workRuleContextOf(task, deps);
  near('B3: afgeleide rest exact', remainingMinutesOf(task, ctx), 1632);
  settleRuleChange(task, assignments, deps, 'FIXED_WORK');
  near('B3: omzetting houdt 3,4d rest', task.time.remainingMinutes, 1632);
  near('B3: omzetting houdt percentage', task.time.completion, 0.32);
  const captured = captureTriangle(task, assignments, deps);
  assignments[0].unitsPerDay = 7;
  settleUnitsEdit(task, assignments, captured, 'a', 7);
  near('B3: verrichte duur van 768 min blijft', (task.time.durationMinutes ?? 0) - (task.time.remainingMinutes ?? 0), 768);
  near('B3: exacte rest na inzetwijziging', task.time.remainingMinutes, 1632 / 7);
  near('B3: dagenrest volgt minuten', task.time.remainingTime, 3.4 / 7);
  near('B3: verricht resourcewerk blijft 768 min', assignments[0].actualWorkMinutes, 768);
  const progress = captureProgressWork(task, deps);
  task.time.completion = 1; task.time.remainingMinutes = 0; task.time.remainingTime = 0;
  settleProgressWork(task, assignments, progress);
  near('B3: latere voltooiing boekt het oorspronkelijke werk', assignments[0].actualWorkMinutes, 2400);
}
{
  const { task, assignments, deps } = fixture(2.5);
  task.workRule = 'FIXED_RATE'; task.time.actualStart = task.time.scheduleStart;
  const captured = captureTriangle(task, assignments, deps);
  assignments[0].unitsPerDay = 7;
  settleUnitsEdit(task, assignments, captured, 'a', 7);
  near('gestart op 0 %: dagenrest expliciet en exact', task.time.remainingTime, 2.5 / 7);
  near('gestart op 0 %: geen verricht deel verzonnen', task.time.completion, 0);
}
{
  const { task, assignments, deps } = fixture();
  task.time.completion = 0.32; task.time.remainingTime = 0.93;
  settleRuleChange(task, assignments, deps, 'FIXED_WORK');
  near('omzetting: expliciete rest wint van percentage', task.time.remainingMinutes, 446.4);
  near('omzetting: percentage blijft staan', task.time.completion, 0.32);
}
{
  const { task, assignments, deps } = fixture();
  task.time.completion = 0.32; assignments[0].remainingWorkMinutes = 1632;
  const captured = captureProgressWork(task, deps);
  task.time.completion = 0.5;
  settleProgressWork(task, assignments, captured);
  near('voortgang: restwerk', assignments[0].remainingWorkMinutes, 1200);
  near('voortgang: verricht werk', assignments[0].actualWorkMinutes, 1200);
}
{
  const { task } = fixture();
  task.time.completion = 0.32;
  const before = { ...task.time };
  task.time.scheduleDuration = 6;
  carryRemainingThroughDurationEdit(task, before, 8, undefined);
  near('duurbewerking: rest 3,4 + 1', task.time.remainingTime, 4.4);
  near('duurbewerking: verricht 1,6d blijft', task.time.completion * 6, 1.6);
}
// Een expliciet restveld op een ongestarte taak volgt ook een breuk in de nieuwe duur.
{
  const { task, assignments, deps } = fixture();
  task.time.remainingTime = 5;
  const captured = captureTriangle(task, assignments, deps);
  task.time.scheduleDuration = 2.5;
  settleDurationEdit(task, captured);
  near('ongestart: expliciete rest wordt 2,5d', task.time.remainingTime, 2.5);
}

// Contour en werkveld blijven gelijk, ook bij een exacte afgeleide inzet (geen vier decimalen).
{
  const { task, assignments, deps } = fixture(3);
  task.timephasedContours = [{ resourceUid: null, resourceId: 'r', periods: [{ afterMinutes: 0, minutes: 1440, workMinutes: 1440, kind: 'remaining' }] }];
  settleWorkEdit(task, assignments, deps, 'a', 1000);
  near('contour: exacte afgeleide inzet', assignments[0].unitsPerDay, 1000 / 1440);
  near('contour: werkveld', assignments[0].remainingWorkMinutes, 1000);
  near('contour: hoogte volgt werkveld', task.timephasedContours?.[0].periods[0].workMinutes, 1000);
  near('contour: werkidentiteit', 1440 * assignments[0].unitsPerDay, 1000);
}
{
  const { task, assignments, deps } = fixture(3);
  task.time.completion = 0.5;
  task.timephasedContours = [{ resourceUid: null, resourceId: 'r', periods: [
    { afterMinutes: 0, minutes: 720, workMinutes: 720, kind: 'actual' },
    { afterMinutes: 720, minutes: 720, workMinutes: 720, kind: 'remaining' },
  ] }];
  assignments[0].actualWorkMinutes = 720;
  settleWorkEdit(task, assignments, deps, 'a', 500);
  near('contour: verrichte periode blijft', task.timephasedContours?.[0].periods[0].workMinutes, 720);
  near('contour: resterende periode volgt werk', task.timephasedContours?.[0].periods[1].workMinutes, 500);
  near('contour: verricht veld blijft', assignments[0].actualWorkMinutes, 720);
}
// Kalenderwissel 8 → 6 u: dagenmaat FIXED_RATE houdt 32 u en krijgt 16/3d; urenmaat houdt minuten.
for (const hour of [false, true]) {
  const { task, assignments, deps } = fixture(4);
  task.workRule = 'FIXED_RATE';
  if (hour) Object.assign(task.time, { durationUnit: 'hours', durationMinutes: 1920, remainingTime: 2, remainingMinutes: 960 });
  const captured = captureCalendarChange(task, assignments, deps);
  const short: WorkCalendar = { ...calendar, id: 'short', workTime: undefined, hoursPerDay: 6 };
  task.calendarId = short.id; deps.calendars = [calendar, short];
  settleCalendarChange(task, assignments, captured, deps);
  near(`kalender ${hour}: verborgen dagen exact`, task.time.scheduleDuration, 16 / 3);
  if (hour) {
    near('kalender: urenbron blijft', task.time.durationMinutes, 1920);
    near('kalender: restminuten blijven', task.time.remainingMinutes, 960);
    near('kalender: dagenrest exact', task.time.remainingTime, 8 / 3);
  } else near('kalender: werk blijft', assignments[0].remainingWorkMinutes, 1920);
  near('kalender: nieuwe slot', triangleStateOf(task, assignments, workRuleContextOf(task, deps)).slotMinutes, 360);
}

for (const failure of failures) console.log(`XX  ${failure}`);
console.log(`${failures.length ? 'XX' : 'OK'}  check-work-rule-days-measure: ${checks} controles, ${failures.length} afwijkingen`);
process.exit(failures.length ? 1 : 0);
