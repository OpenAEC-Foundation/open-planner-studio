// Speling, restduur en baselineduur: één getalopmaak op alle schermen (audit weergaven, bevinding 8).
//
// AANLEIDING. In urenmodus is speling een fractie van een werkdag. Het taakraster en de tooltip
// toonden de ruwe float ("1.6666666666666667", met een punt in een Nederlands scherm), het paneel
// rondde de vrije speling wél af (TS "0.444…" naast VS "0"), de baselinekolommen idem, en de
// restduur van een urentaak op 40% stond als "0" terwijl er nog 3 uur werk openstond (hij werd op
// hele dagen afgerond). Nu één opmaak: hoogstens twee decimalen, het decimaalteken van de taal en
// een eenheid (`formatWorkDaysText`); de restduur van een urentaak in uren/minuten
// (`formatRemainingDurationText`, dezelfde bron als de planning: `remainingMinutes` of duur × rest).
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { setLocale } from '@/i18n/config';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { useAppStore } from '@/state/appStore';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { baselineColumnId, taskColumnId } from '@/engine/taskGrid/fieldIds';
import { effectiveCalendarOf, effHoursPerDay, formatWorkDaysText } from '@/utils/taskDuration';
import { TaskTooltipContent } from '@/components/canvas/TaskTooltipContent';
import { TaskProgressFields } from '@/components/task-sections/TaskProgressFields';
import type { WorkCalendar } from '@/types/calendar';
import type { TaskTime } from '@/types/task';

await setLocale('nl');
const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

function gridCell(taskId: string, column: string): string | undefined {
  const s = S();
  const adapter = createTaskGridAdapter({
    projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
    assignments: s.assignments, resources: s.resources, baselines: s.baselines,
    activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs, customTaskTypes: s.customTaskTypes,
    scheduleStale: s.scheduleStale, wbsAutoNumber: false,
    effectiveHoursPerDay: t => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
    labelForColumn: k => k,
    labelForText: k => ({ 'duration.suffixDay': 'd', 'duration.suffixHour': 'h', 'duration.suffixMinute': 'm' } as Record<string, string>)[k] ?? k,
    numberLocale: 'nl',
    surfaceId: 'full-task-grid', rows: s.viewRows, selectedTaskIds: [],
  });
  const row = s.viewRows.find(r => r.kind === 'task' && r.task.id === taskId)!;
  return adapter.getCell(row.rowKey, taskColumnId(column))?.text;
}
const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const taskOf = (id: string) => S().tasks.find(t => t.id === id)!;

// ── Urenplanning, 9-uurskalender: A 5h naast B 9h, C na beide ⇒ A heeft 4 werkuren speling ──
S().newProject();
S().setUI({ enableHourPlanning: true });
const band = [{ start: 8 * 60, end: 17 * 60 }];
S().setCalendar({
  ...S().calendar, workDays: [1, 2, 3, 4, 5], holidays: [], hoursPerDay: 9, workStartHour: 8, workEndHour: 17,
  workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } },
} as WorkCalendar);
S().setProject({ startDate: '2026-06-01', name: 'Speling' });
const A = S().addTask({ name: 'A stelwerk', time: { durationUnit: 'hours', durationMinutes: 5 * 60 } as TaskTime });
const B = S().addTask({ name: 'B bekisting', time: { durationUnit: 'hours', durationMinutes: 9 * 60 } as TaskTime });
const C = S().addTask({ name: 'C storten', time: { durationUnit: 'hours', durationMinutes: 4 * 60 } as TaskTime });
S().addSequence({ predecessorId: A, successorId: C, type: 'FINISH_START', lagDays: 0 });
S().addSequence({ predecessorId: B, successorId: C, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
eq('opzet: A heeft 4/9 werkdag totale en vrije speling',
  [Math.round(taskOf(A).time.totalFloat * 900) / 900, Math.round(taskOf(A).time.freeFloat * 900) / 900], [4 / 9, 4 / 9]);

// 1. Speling: raster en tooltip in dezelfde notatie, TS en VS gelijk afgerond.
eq('1a raster Totale speling A', gridCell(A, 'task.time.totalFloat'), '0,44d');
eq('1b raster Vrije speling A', gridCell(A, 'task.time.freeFloat'), '0,44d');
eq('1c raster Interfererende speling A', gridCell(A, 'task.time.interferingFloat'), '0d');
// Het paneel (TaskCpmResultSection) gebruikt dezelfde functie met de lange eenheid; het
// rekenartefact uit issue #80 wordt "2,29 dagen", niet "2.2916666666666665" en niet "2".
eq('1d gedeelde opmaak voor het paneel', formatWorkDaysText(2.2916666666666665, { locale: 'nl', suffixes: { day: ' dagen', hour: 'h', minute: 'm' } }), '2,29 dagen');
const tip = text(renderToStaticMarkup(createElement(TaskTooltipContent, { task: taskOf(A) })));
eq('1e tooltip Totale speling A', /Totale speling:\|([^|]*)\|/.exec(tip)?.[1], '0,44d');

// 2. Restduur van een urentaak op 40%: 3 uur, niet "0".
S().setStatusDate('2026-06-01T10:00');
S().setTaskProgress(A, 0.4);
S().runCPM();
eq('2 opzet: A loopt nog tot 13:00 (3 uur werk)', [taskOf(A).time.completion, taskOf(A).time.earlyFinish], [0.4, '2026-06-01T13:00']);
eq('2a raster Resterende duur A', gridCell(A, 'task.time.remainingTime'), '3h');
const progress = renderToStaticMarkup(createElement(TaskProgressFields, {
  task: taskOf(A), onSetProgress: () => {}, onSetActualStart: () => true, onSetActualFinish: () => true,
}));
eq('2b paneel Resterend A', /<input[^>]*value="([^"]*)"[^>]*disabled/.exec(progress)?.[1] ?? /<input[^>]*disabled[^>]*value="([^"]*)"/.exec(progress)?.[1], '3h');
eq('2c paneel-label zonder "(werkdagen)" (de waarde draagt haar eenheid)', progress.includes('(werkdagen)'), false);
// Een dagtaak: gehele speling en restduur, nu met eenheid. D (3d) wordt de langste taak.
const D = S().addTask({ name: 'D dagtaak', time: { scheduleDuration: 3 } as TaskTime });
S().runCPM();
eq('2d raster Totale speling dagtaak D', gridCell(D, 'task.time.totalFloat'), '0d');
S().setTaskProgress(D, 1 / 3);
eq('2e raster Resterende duur dagtaak D', gridCell(D, 'task.time.remainingTime'), '2d');

// 3. Baselineduur en -afwijking van een urentaak (5h → 6h op een 9-uursdag).
const bl = S().saveBaseline('BL1');
const a = taskOf(A);
S().updateTask(A, { time: { ...a.time, durationMinutes: 6 * 60, scheduleDuration: 6 / 9 } });
S().runCPM();
const pid = S().project.id;
eq('3a raster BL1 — Duur', gridCell(A, baselineColumnId(pid, bl, 'duration') as string), '0,56d');
eq('3b raster BL1 — Duurafwijking', gridCell(A, baselineColumnId(pid, bl, 'varianceDuration') as string), '0,11d');

if (diffs.length === 0) {
  console.log(`OK  float-remaining-text: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  float-remaining-text: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
