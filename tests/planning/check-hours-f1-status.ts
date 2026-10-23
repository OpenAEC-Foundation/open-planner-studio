// F1: dezelfde statusregel in dialoog, paneel, raster en MCP. Werkelijke tijden blijven feiten.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { createTaskDialogSave, draftWithActualFinish } from '@/state/taskDialogSave';
import { planProgressEntry } from '@/engine/progressEntry';
import { isActualPastStatusDate, normalizeActualDate } from '@/engine/taskMutationRules';
import { cpmResultFromRecorded } from '@/engine/scheduler/recordedDates';
import { progress } from '@/state/mcpValidation';
import { makeBands } from '@/utils/effectiveWorkTime';
import type { WorkCalendar } from '@/types/calendar';
import type { CellEditIntent } from '@/types/taskGrid';
import type { Task } from '@/types/task';

let checks = 0;
const failures: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(label + ': ' + JSON.stringify(got) + ' != ' + JSON.stringify(want));
}
function fixture(statusDate: string, night = false, elapsed = false) {
  const context = createAppStoreContext();
  const S = () => context.store.getState();
  const calendar: WorkCalendar = {
    ...S().calendar, id: 'f1-kalender', workDays: [1, 2, 3, 4, 5], holidays: [],
    workStartHour: night ? 22 : 8, workEndHour: night ? 30 : 16, hoursPerDay: 8,
    workTime: makeBands([1, 2, 3, 4, 5], [{ start: night ? 1320 : 480, end: night ? 1800 : 960 }]),
  };
  S().setCalendar(calendar);
  S().setProject({ startDate: '2026-06-01', statusDate });
  const id = S().addTask({ name: 'F1', time: {
    scheduleStart: night ? '2026-06-01T22:00' : '2026-06-01T08:00',
    scheduleDuration: 1, durationUnit: 'hours', durationMinutes: 480,
    durationType: elapsed ? 'ELAPSEDTIME' : 'WORKTIME',
  } as Task['time'] });
  const task = () => S().tasks.find(t => t.id === id)!;
  return { context, S, id, task, calendar };
}
const cases: { status: string; value: string; want: string | null; night?: boolean; elapsed?: boolean }[] = [
  { status: '2026-06-03', value: '2026-06-03', want: '2026-06-03T16:00' },
  { status: '2026-06-03T12:00', value: '2026-06-03', want: '2026-06-03T12:00' },
  { status: '2026-06-03T12:00', value: '2026-06-03T14:00', want: null },
  { status: '2026-06-03', value: '2026-06-04T06:00', want: '2026-06-04T06:00', night: true },
  { status: '2026-06-03', value: '2026-06-04T22:00', want: null, night: true },
  { status: '2026-06-03', value: '2026-06-04T02:00', want: null, night: true, elapsed: true },
  { status: '2026-06-03', value: '2026-06-03', want: '2026-06-04T00:00', night: true, elapsed: true },
];
for (const c of cases) for (const route of ['dialoog', 'paneel', 'raster', 'plakken', 'MCP'] as const) {
  const f = fixture(c.status, c.night, c.elapsed);
  const label = route + ' ' + c.status + ' ' + c.value;
  const before = JSON.stringify(f.task());
  let accepted: boolean;
  if (route === 'dialoog') {
    const draft = draftWithActualFinish(f.task(), c.value, c.status, f.calendar);
    accepted = draft !== null;
    if (draft) accepted = createTaskDialogSave(f.context)({
      editingTaskId: f.id, draft, startDate: f.task().time.scheduleStart,
    });
  } else if (route === 'paneel') {
    accepted = f.S().setActualFinish(f.id, c.value);
  } else if (route === 'MCP') {
    // De tool roept deze validatie aan op zijn geïsoleerde mutatiedraft.
    const draft = structuredClone({
      tasks: f.S().tasks, sequences: [], assignments: [], resources: [],
      calendars: f.S().calendars, calendar: f.S().calendar, project: f.S().project,
    });
    const result = progress.applyProgressUpdate(draft, f.id, { actualFinish: c.value }, c.status);
    accepted = result.applied;
    eq(label + ' opgeslagen', draft.tasks[0].time.actualFinish ?? null, c.want);
    if (!accepted) eq(label + ' weigering atomair', JSON.stringify(draft.tasks[0]), before);
  } else {
    const edit = {
      kind: 'cell-edit' as const, taskId: f.id, columnId: 'task.time.actualFinish' as CellEditIntent['columnId'],
      route: 'task-progress' as const, value: c.value,
    };
    accepted = f.S().runGridMutation(route === 'plakken' ? [{ kind: 'paste', writes: [edit] }] : [edit]).ok;
  }
  eq(label + ' toegestaan', accepted, c.want !== null);
  if (route !== 'MCP') {
    eq(label + ' opgeslagen', f.task().time.actualFinish ?? null, c.want);
    if (!accepted) eq(label + ' weigering atomair', JSON.stringify(f.task()), before);
    if (accepted) {
      f.S().runCPM();
      eq(label + ' D6 berekend einde', f.task().time.earlyFinish, c.want);
    }
  }
}
{
  const f = fixture('2026-06-03');
  const plan = planProgressEntry(f.task(), { field: 'completion', value: 1 },
    { statusDate: '2026-06-03', calendar: f.calendar });
  eq('100% leidt D6 af', plan.ok && plan.change?.task.time.actualFinish, '2026-06-03T16:00');
  eq('Nachtfeit hoort bij statuswerkdag', isActualPastStatusDate('2026-06-04T02:00',
    '2026-06-03', { ...f.calendar, workTime: makeBands([1, 2, 3, 4, 5], [{ start: 1320, end: 1800 }]) }, 'end'), false);
}
{
  const f = fixture('2026-06-03');
  const task = { ...f.task(), deadline: '2026-06-03' };
  const result = cpmResultFromRecorded({ [f.id]: { start: '2026-06-03T08:00', finish: '2026-06-03T16:00' } },
    [task], f.calendar, [f.calendar]);
  eq('148 vastgelegde finish op deadline gehaald', result.missedDeadlineTaskIds, []);
  const missed = cpmResultFromRecorded({ [f.id]: { start: '2026-06-03T08:00', finish: '2026-06-04T16:00' } },
    [task], f.calendar, [f.calendar]);
  eq('148 vastgelegde finish na deadline gemist', missed.missedDeadlineTaskIds, [f.id]);
}
// F1 normaliseert alleen op de statuswerkdag; algemene invoernormalisatie hoort bij F2.
{
  const f = fixture('2026-06-10');
  eq('vóór statusdag blijft datumvorm staan', normalizeActualDate(f.task(), 'actualFinish',
    '2026-06-04', '2026-06-10', f.calendar), '2026-06-04');
  eq('zonder statusdag blijft datumvorm staan', normalizeActualDate(f.task(), 'actualFinish',
    '2026-06-04', undefined, f.calendar), '2026-06-04');
  eq('paneel accepteert ouder feit', f.S().setActualFinish(f.id, '2026-06-04'), true);
  eq('paneel bewaart ouder feit', f.task().time.actualFinish, '2026-06-04');
}
// Een gecombineerde MCP-invoer toetst het opgegeven einde vóór completion < 100 het wist.
for (const [actualFinish, applied] of [
  ['2026-06-03T14:00', false], ['2026-06-03T10:00', true],
] as const) {
  const f = fixture('2026-06-03T12:00');
  const draft = structuredClone({
    tasks: f.S().tasks, sequences: [], assignments: [], resources: [],
    calendars: f.S().calendars, calendar: f.S().calendar, project: f.S().project,
  });
  const before = JSON.stringify(draft.tasks[0]);
  const result = progress.applyProgressUpdate(draft, f.id, { completion: 50, actualFinish }, '2026-06-03T12:00');
  eq('MCP gecombineerd ' + actualFinish, result.applied, applied);
  eq('MCP gecombineerd einde gewist', draft.tasks[0].time.actualFinish ?? null, null);
  if (!applied) eq('MCP gecombineerde weigering atomair', JSON.stringify(draft.tasks[0]), before);
}
for (const failure of failures) console.log('XX ' + failure);
console.log('F1-statusregel: ' + checks + ' controles, ' + failures.length + ' fouten');
if (failures.length) process.exit(1);
