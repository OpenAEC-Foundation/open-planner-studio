// Restduur van een dagtaak met een breuk is exact (B3; aanval a08 na #600, BLOKKEERT 2).
//
// Sinds #600 mag een planner "0,25d" typen. Een nieuwe taak van 0,25 d (0 % gereed, geen ingevoerde rest)
// loopt na herberekenen ma 1 jun 07:00–09:00, maar de kolom Resterende duur, het paneel en de rapporten
// gaven 0 d rest: `remainingTaskMeasure` deed `Math.round(duur × (1 − voortgang))`. 0,5 d gaf 1 d en
// 2,5 d gaf 3 d. Nu: duur × (1 − voortgang), zonder afronding; een ingevoerde rest houdt voorrang.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { setLocale } from '@/i18n/config';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { commitTaskCellEditorValue } from '@/components/task-grid/TaskCellEditor';
import { TaskProgressFields } from '@/components/task-sections/TaskProgressFields';
import { profileCountsWorkdays, remainingTaskMeasure } from '@/utils/taskDuration';
import { remainingMeasure } from '@/engine/reports/reportCommon';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';

declare const process: { exit(code: number): never };

await setLocale('nl');

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) diffs.push(`${label}: verwacht ${b}, kreeg ${a}`);
}
function near(label: string, got: number, want: number): void {
  checks++;
  if (!(Math.abs(got - want) < 1e-9)) diffs.push(`${label}: verwacht ${want}, kreeg ${got}`);
}

// Standaardkalender: ma–vr 07:00–12:00 + 13:00–16:00 (8 u).
const blocks = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const standard: WorkCalendar = {
  id: 'std', name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
  hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: { 1: blocks, 2: blocks, 3: blocks, 4: blocks, 5: blocks, 6: [], 7: [] } },
};

const ctx = createAppStoreContext();
const S = ctx.store.getState;
S().setCalendar(standard);
S().setProject({ startDate: '2026-06-01', schedulingProfile: builtInProfile('ops') });
const of = (id: string) => S().tasks.find(t => t.id === id)!;
const adapter = () => createTaskGridAdapter({
  projectId: S().project.id, tasks: S().tasks,
  rows: S().tasks.map(task => ({ kind: 'task', rowKey: task.id, task, depth: 0, dimmed: false })),
  sequences: S().sequences, assignments: S().assignments, resources: S().resources, baselines: S().baselines,
  activityCodeTypes: [], customFieldDefs: [], scheduleStale: S().scheduleStale, wbsAutoNumber: false,
  surfaceId: 'full-task-grid', selectedTaskIds: [], labelForColumn: k => k,
  labelForText: k => ({ 'duration.suffixDay': 'd', 'duration.suffixHour': 'u', 'duration.suffixMinute': 'm' } as Record<string, string>)[k] ?? k,
  effectiveCalendar: () => standard, effectiveHoursPerDay: () => 8, dateNotation: 'dmy', timeNotation: '24h',
  workdayDurationMeasure: profileCountsWorkdays(S().project), numberLocale: 'nl',
  callbacks: { onCommitEdit: (_target, intents) => S().runGridMutation(intents) },
});
const commit = (id: string, column: string, text: string) => {
  const columnId = taskColumnId(column);
  return commitTaskCellEditorValue({ adapter: adapter(), cell: { rowKey: id, columnId }, text, messageForError: k => k });
};
const panelRemaining = (task: Task) => {
  const html = renderToStaticMarkup(createElement(TaskProgressFields, {
    task, onSetProgress: () => ({ ok: true as const }), onSetActualStart: () => ({ ok: true as const }),
    onSetActualFinish: () => ({ ok: true as const }),
  }));
  return /<input[^>]*value="([^"]*)"[^>]*disabled/.exec(html)?.[1] ?? /<input[^>]*disabled[^>]*value="([^"]*)"/.exec(html)?.[1];
};

// ── 1. Nieuwe taak, duur via de echte rastercommit, geen ingevoerde rest ────────────────────────────
const cases = [
  { typed: '0,25d', days: 0.25, finish: '2026-06-01T09:00', shown: '0,25d' },
  { typed: '0.5d', days: 0.5, finish: '2026-06-01T11:00', shown: '0,5d' },
  { typed: '2,5d', days: 2.5, finish: '2026-06-03T11:00', shown: '2,5d' },
];
for (const c of cases) {
  const id = S().addTask({ name: `Breuktaak ${c.typed}` });
  eq(`${c.typed} 1a duur typen in het raster: ok`, commit(id, 'task.time.scheduleDuration', c.typed), { ok: true });
  S().runCPM();
  const t = of(id);
  eq(`${c.typed} 1b opzet: dagenmaat, geen ingevoerde rest, 0 % gereed`,
    [t.time.durationUnit, t.time.scheduleDuration, t.time.remainingTime, t.time.completion], ['days', c.days, undefined, 0]);
  eq(`${c.typed} 1c na herberekenen: ma 1 jun 07:00 tot ${c.finish}`, [t.time.earlyStart, t.time.earlyFinish], ['2026-06-01T07:00', c.finish]);
  eq(`${c.typed} 1d rest in de eigen maat: ${c.days} d`, remainingTaskMeasure(t), { unit: 'days', days: c.days });
  eq(`${c.typed} 1e rapportbron: ${c.days} d`, remainingMeasure(t), { unit: 'days', days: c.days });
  eq(`${c.typed} 1f rastercel Resterende duur`, adapter().getCell(id, taskColumnId('task.time.remainingTime'))?.text, c.shown);
  eq(`${c.typed} 1g paneel Resterend`, panelRemaining(t), c.shown);
}

// ── 2. De terugval rekent exact; een ingevoerde rest houdt voorrang ────────────────────────────────
const base = of(S().tasks[0].id);
const withTime = (time: Partial<Task['time']>): Task => ({ ...base, time: { ...base.time, ...time } });
const fallback = remainingTaskMeasure(withTime({ scheduleDuration: 2.5, completion: 0.4, remainingTime: undefined }));
eq('2a terugval: dagenmaat', fallback.unit, 'days');
near('2b terugval: 2,5 d op 40 % ⇒ 1,5 d rest', fallback.unit === 'days' ? fallback.days : NaN, 1.5);
eq('2c ingevoerde rest houdt voorrang', remainingTaskMeasure(withTime({ scheduleDuration: 2.5, completion: 0.1, remainingTime: 1.75 })), { unit: 'days', days: 1.75 });
eq('2d ingevoerde rest 0 blijft 0', remainingTaskMeasure(withTime({ scheduleDuration: 2.5, completion: 0.1, remainingTime: 0 })), { unit: 'days', days: 0 });
eq('2e rapport: voltooid ⇒ 0 d', remainingMeasure(withTime({ scheduleDuration: 0.25, completion: 1, actualStart: '2026-06-01T07:00', actualFinish: '2026-06-01T09:00' })), { unit: 'days', days: 0 });

if (diffs.length) {
  console.error(`FAIL restduur-dagdelen: ${diffs.length}/${checks}`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK  restduur-dagdelen: ${checks}/${checks}`);
process.exit(0);
