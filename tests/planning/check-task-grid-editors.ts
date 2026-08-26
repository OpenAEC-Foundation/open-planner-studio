import { planTaskCellEdit } from '@/engine/taskGrid/taskEditPlan';
import { activityCodeColumnId, customFieldColumnId, taskColumnId } from '@/engine/taskGrid/fieldIds';
import type { CellEditIntent, CellEditRoute } from '@/types/taskGrid';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const baseTask = {
  id: 't-1', name: 'Taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION',
  status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [],
  resourceIds: [], activityCodes: {}, customFields: {},
  time: {
    durationType: 'WORKTIME', scheduleDuration: 5,
    scheduleStart: '2026-01-05', scheduleFinish: '2026-01-09',
    earlyStart: '2026-01-05', earlyFinish: '2026-01-09',
    lateStart: '2026-01-05', lateFinish: '2026-01-09',
    freeFloat: 0, totalFloat: 0, isCritical: true, completion: 0,
  },
} as Task;
const environment = {
  projectId: 'p-1', wbsAutoNumber: false, statusDate: '2026-01-07',
  calendarIds: new Set(['cal-hour']), effectiveHoursPerDay: 8, hourMode: false,
  activityCodeTypes: [{ id: 'fase', name: 'Fase', values: [{ id: 'bouw', code: 'B' }] }],
  customFieldDefs: [
    { id: 'aantal', name: 'Aantal', type: 'integer' as const },
    { id: 'vrij', name: 'Vrij', type: 'text' as const },
  ],
};

function intent(columnId: string, route: CellEditRoute, value: unknown): CellEditIntent {
  return { kind: 'cell-edit', taskId: baseTask.id, columnId: taskColumnId(columnId), route, value };
}

function plan(
  columnId: string,
  route: CellEditRoute,
  value: unknown,
  task: Task = baseTask,
  overrides: Partial<typeof environment> = {},
) {
  return planTaskCellEdit(task, intent(columnId, route, value), { ...environment, ...overrides });
}

const textCases: readonly [string, unknown, keyof Task, unknown][] = [
  ['task.name', 'Nieuwe naam', 'name', 'Nieuwe naam'],
  ['task.description', 'Beschrijving', 'description', 'Beschrijving'],
  ['task.wbsCode', '2.4', 'wbsCode', '2.4'],
  ['task.taskType', 'INSTALLATION', 'taskType', 'INSTALLATION'],
  ['task.priority', 1000, 'priority', 1000],
  ['task.color', '#ff8800', 'color', '#ff8800'],
];
for (const [columnId, value, field, expected] of textCases) {
  const result = plan(columnId, 'task-field', value);
  eq(`${columnId}: bewaakte taakveldwrite`, result.ok ? result.value.task[field] : result, expected);
}
eq('WBS-autonummering weigert een write',
  plan('task.wbsCode', 'task-field', '9', baseTask, { wbsAutoNumber: true }).ok, false);
eq('Prioriteit buiten bereik blijft ook in de planner geweigerd',
  plan('task.priority', 'task-field', 1001).ok, false);
const newNote = plan('task.notes', 'task-field', 'Eerste notitie');
eq('Lege checklist krijgt één stabiele notitie zonder verliesgevende parsing',
  newNote.ok ? newNote.value.task.notes : newNote,
  [{ id: 'grid-note:t-1', text: 'Eerste notitie', done: false }]);
const oneNoteTask = { ...baseTask, notes: [{ id: 'n-1', text: 'Oud', done: true }] } as Task;
const changedNote = plan('task.notes', 'task-field', 'Nieuw', oneNoteTask);
eq('Eén notitie bewaart id en gereedstatus bij tekstbewerking',
  changedNote.ok ? changedNote.value.task.notes : changedNote,
  [{ id: 'n-1', text: 'Nieuw', done: true }]);
const multipleNotesTask = {
  ...baseTask,
  notes: [{ id: 'n-1', text: 'A', done: true }, { id: 'n-2', text: 'B', done: false }],
} as Task;
eq('Meerdere checklistitems weigeren een verliesgevende platte write',
  plan('task.notes', 'task-field', 'Plat', multipleNotesTask).ok, false);

const dayDuration = plan('task.time.scheduleDuration', 'task-schedule', 2400);
eq('Dagkalender zet minuten om naar werkdagen en bewaart geen uurbron', dayDuration.ok ? {
  days: dayDuration.value.task.time.scheduleDuration,
  minutes: dayDuration.value.task.time.durationMinutes,
} : dayDuration, { days: 5 });
const hourDuration = plan('task.time.scheduleDuration', 'task-schedule', 90, baseTask, { hourMode: true });
eq('Uurkalender bewaart minuten en houdt de dagafgeleide consistent', hourDuration.ok ? {
  days: hourDuration.value.task.time.scheduleDuration,
  minutes: hourDuration.value.task.time.durationMinutes,
} : hourDuration, { days: 0.1875, minutes: 90 });

const steered = {
  ...baseTask,
  time: { ...baseTask.time },
  timephasedFinishFloor: '2026-01-10',
  timephasedStartAnchor: '2026-01-05',
  timephasedDurationWalks: [{ anchor: '2026-01-05', resourceCalendarId: 'cal-hour', workMinutes: 300 }],
} as Task;
const shifted = plan('task.time.scheduleStart', 'task-schedule', '2026-01-06', steered);
eq('Datumedit wist bevroren timephased-sturing maar niet de rauwe bron', shifted.ok ? {
  floor: shifted.value.task.timephasedFinishFloor,
  anchor: shifted.value.task.timephasedStartAnchor,
  walks: shifted.value.task.timephasedDurationWalks,
  lost: shifted.value.timephasedGuidanceLost,
} : shifted, { lost: true });
eq('Onbekende taakkalender wordt niet stil opgeslagen',
  plan('task.calendarId', 'task-schedule', 'verdwenen').ok, false);

const milestoneOn = plan('task.isMilestone', 'task-milestone', true);
eq('Mijlpaal aan zet duur op nul', milestoneOn.ok ? {
  milestone: milestoneOn.value.task.isMilestone,
  duration: milestoneOn.value.task.time.scheduleDuration,
} : milestoneOn, { milestone: true, duration: 0 });
const milestoneOffTask = {
  ...baseTask, isMilestone: true, milestoneKind: 'FINISH', mandatory: true,
  time: { ...baseTask.time, scheduleDuration: 0 },
} as Task;
const milestoneOff = plan('task.isMilestone', 'task-milestone', false, milestoneOffTask);
eq('Mijlpaal uit herstelt bruikbare duur en wist mijlpaalmetadata', milestoneOff.ok ? {
  milestone: milestoneOff.value.task.isMilestone,
  kind: milestoneOff.value.task.milestoneKind,
  mandatory: milestoneOff.value.task.mandatory,
  duration: milestoneOff.value.task.time.scheduleDuration,
} : milestoneOff, { milestone: false, duration: 5 });
eq('Mijlpaalsoort op een gewone taak wordt geweigerd',
  plan('task.milestoneKind', 'task-milestone', 'START').ok, false);

const completion = plan('task.time.completion', 'task-progress', 0.4);
eq('Completion gebruikt de bestaande voortgangsinvarianten', completion.ok ? {
  completion: completion.value.task.time.completion,
  actualStart: completion.value.task.time.actualStart,
  remaining: completion.value.task.time.remainingTime,
  status: completion.value.task.status,
} : completion, { completion: 0.4, actualStart: '2026-01-05', remaining: 3, status: 'STARTED' });
eq('Actual op dezelfde dag als een date-only statusdatum is toegestaan',
  plan('task.time.actualStart', 'task-progress', '2026-01-07T17:00').ok, true);
eq('Actual na de statusdatum wordt atomair geweigerd',
  plan('task.time.actualFinish', 'task-progress', '2026-01-08').ok, false);
const completed = plan('task.status', 'task-progress', 'COMPLETED');
eq('Status voltooid routeert via completion/actual-invarianten', completed.ok ? {
  status: completed.value.task.status,
  completion: completed.value.task.time.completion,
  actualFinish: completed.value.task.time.actualFinish,
} : completed, { status: 'COMPLETED', completion: 1, actualFinish: '2026-01-07' });

const primary = plan('task.constraint.type', 'task-constraint', 'SNET');
eq('Constrainttype krijgt een bruikbare datum', primary.ok ? primary.value.task.constraint : primary,
  { type: 'SNET', date: '2026-01-05' });
const pairedTask = primary.ok
  ? { ...primary.value.task, constraint2: { type: 'FNLT', date: '2026-01-09' } } as Task
  : baseTask;
eq('Een tweede grens aan dezelfde zijde wordt als geheel geweigerd',
  plan('task.constraint2.type', 'task-constraint', 'FNET', pairedTask).ok, false);
eq('Harde pin buiten MSO/MFO wordt geweigerd',
  plan('task.constraint.hard', 'task-constraint', true, pairedTask).ok, false);

const activity = planTaskCellEdit(baseTask, {
  kind: 'cell-edit', taskId: baseTask.id, columnId: activityCodeColumnId('p-1', 'fase'),
  route: 'activity-code', value: 'bouw',
}, environment);
eq('Activity code schrijft alleen het projectgebonden veld',
  activity.ok ? activity.value.task.activityCodes : activity, { fase: 'bouw' });
const custom = planTaskCellEdit(baseTask, {
  kind: 'cell-edit', taskId: baseTask.id, columnId: customFieldColumnId('p-1', 'aantal'),
  route: 'custom-field', value: 7,
}, environment);
eq('Getypeerd custom field schrijft de gevalideerde waarde',
  custom.ok ? custom.value.task.customFields : custom, { aantal: 7 });
eq('Dynamisch veld uit een ander project wordt geweigerd', planTaskCellEdit(baseTask, {
  kind: 'cell-edit', taskId: baseTask.id, columnId: customFieldColumnId('ander', 'aantal'),
  route: 'custom-field', value: 7,
}, environment).ok, false);

eq('Verkeerde route kan een geldig kolom-id niet misbruiken',
  plan('task.name', 'task-progress', 'Misbruik').ok, false);
eq('De planner muteert de brontaak nooit', baseTask, {
  ...baseTask,
  time: { ...baseTask.time },
});

if (diffs.length) {
  console.error(`FAIL task-grid-editors: ${diffs.length}/${checks}`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK  task-grid-editors: ${checks}/${checks}`);
