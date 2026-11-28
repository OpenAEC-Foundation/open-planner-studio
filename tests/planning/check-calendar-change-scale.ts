import { useAppStore } from '@/state/appStore';
import { generateBenchmarkProject } from '@/services/benchmark/generateProject';
import { captureCalendarChange, settleCalendarChange } from '@/engine/work/workRuleApply';
import { tasksFollowingProjectCalendar, tasksOnCalendar } from '@/state/calendarTasks';
import { syncProjectCalendar } from '@/state/syncProjectCalendar';
import type { AppState } from '@/state/appStore';

const S = () => useAppStore.getState();
const fails: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  checks++;
  if (!cond) fails.push(`${label}${detail ? `: ${detail}` : ''}`);
};

type RefState = Pick<AppState, 'tasks' | 'assignments' | 'calendars' | 'calendar' | 'project' | 'resources'>;
function snapshot(): RefState {
  const { tasks, assignments, calendars, calendar, project, resources } = S();
  return JSON.parse(JSON.stringify({ tasks, assignments, calendars, calendar, project, resources })) as RefState;
}
function referenceUpdate(s: RefState, calendarId: string, hoursPerDay: number): RefState {
  const idx = s.calendars.findIndex((c) => c.id === calendarId);
  const affected = tasksOnCalendar(s, calendarId).map((task) => ({ task, before: captureCalendarChange(task, s.assignments, s) }));
  Object.assign(s.calendars[idx], { hoursPerDay });
  syncProjectCalendar(s);
  for (const { task, before } of affected) settleCalendarChange(task, s.assignments, before, s);
  return s;
}

function load(size: number, seed: number) {
  const project = generateBenchmarkProject(size, { seed, resourceCount: 12 });
  project.tasks.forEach((t, i) => {
    if (i % 5 === 1) t.workRule = 'FIXED_WORK';
    if (i % 5 === 2) t.workRule = 'FIXED_RATE';
    if (i % 7 === 3) t.time.completion = 0.4;
  });
  project.assignments.forEach((a, i) => { if (i % 3 === 0) a.remainingWorkMinutes = 480 * (1 + (i % 4)); });
  S().applyLoadedProject(project, { filePath: null, recompute: false });
}

for (const seed of [1, 2, 3]) {
  load(400, seed);
  const calId = S().project.calendarId;
  const beforeTasks = JSON.stringify(S().tasks);
  const beforeAssignments = JSON.stringify(S().assignments);
  const want = referenceUpdate(snapshot(), calId, 6);
  S().updateCalendar(calId, { hoursPerDay: 6 });
  ok(`seed ${seed}: de wijziging herschrijft echt taken en toewijzingen (anders pint dit niets)`,
    JSON.stringify(S().tasks) !== beforeTasks && JSON.stringify(S().assignments) !== beforeAssignments);
  ok(`seed ${seed}: updateCalendar gelijk aan de per-taakroute (taken)`, JSON.stringify(S().tasks) === JSON.stringify(want.tasks));
  ok(`seed ${seed}: updateCalendar gelijk aan de per-taakroute (toewijzingen)`,
    JSON.stringify(S().assignments) === JSON.stringify(want.assignments));
}

{
  load(400, 4);
  const other = { ...S().calendar, id: 'cal-tweede', name: 'Tweede', hoursPerDay: 5 };
  useAppStore.setState((s) => { s.calendars.push(other); });
  const want = snapshot();
  {
    const affected = tasksFollowingProjectCalendar(want).map((task) => ({ task, before: captureCalendarChange(task, want.assignments, want) }));
    want.project.calendarId = other.id;
    syncProjectCalendar(want);
    for (const { task, before } of affected) settleCalendarChange(task, want.assignments, before, want);
  }
  S().setProjectCalendar(other.id);
  ok('setProjectCalendar gelijk aan de per-taakroute (taken)', JSON.stringify(S().tasks) === JSON.stringify(want.tasks));
  ok('setProjectCalendar gelijk aan de per-taakroute (toewijzingen)', JSON.stringify(S().assignments) === JSON.stringify(want.assignments));
}

load(8000, 7);
const calId = S().project.calendarId;
const t0 = performance.now();
S().updateCalendar(calId, { hoursPerDay: 7 });
const ms = performance.now() - t0;
console.log(`   updateCalendar 8000 taken / ${S().assignments.length} toewijzingen: ${ms.toFixed(0)} ms`);
ok('8000 taken: updateCalendar binnen 4 s', ms < 4000, `${ms.toFixed(0)} ms`);

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`check-calendar-change-scale: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-calendar-change-scale: ${checks}/${checks} groen`);
