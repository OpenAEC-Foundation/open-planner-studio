// F4b, fixronde 2 (review r2 op PR #584): kalendertijd houdt 24 klokuren per dag bij kopiëren, plakken,
// invoer en weergave, ook onder P6 en MS Project.
//
// Faalgeval uit het rapport: een kalendertijdtaak van 1 d (1 juni 07:00 tot 2 juni 07:00). Ctrl+C op de
// Duur-cel gaf onder P6/MSP "8u" (1 d × de werktijd per dag); plakken op een ANDERE kalendertijdtaak gaf
// 480 min en na herberekenen een einde om 1 juni 15:00. De regel staat nu op één plek
// (`taskDurationInputContext` met `durationHoursPerDay`): bij kalendertijd blijft "d" een kalenderdag en
// rekent een omzetting met 24 u.
//
// De route is die van het taakraster: de kolomcontext uit `createTaskGridAdapterDomain` (zoals
// FullTaskGrid), `copyTaskGridSelection`, `planTaskGridPaste` en de store-actie `runGridMutation`.
// Kalender: ma–vr 07–12 + 13–16 (8 u). Start ma 1 juni 2026. Exit 0 = groen.
//
// Mutatiebewijs (2026-10-24, 45 checks): de invoerregel zonder kalendertijd (de fix weg) ⇒ 14 rood, met
// precies het faalgeval ("8u", 480 min, einde 1 juni 15:00); alleen "d blijft een dag" weg ⇒ 6 rood
// ("24u", de bestemming wordt een urentaak); de weergave zonder 24 u ⇒ 3 rood ("8u(1d)"); het tabelrapport
// zonder 24 u ⇒ 1 rood.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { createTaskGridAdapterDomain } from '@/engine/taskGrid/taskGridAdapter';
import { copyTaskGridSelection, planTaskGridPaste } from '@/engine/taskGrid/clipboard';
import { createTaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { createEmptyGridSelection, updateGridSelection } from '@/engine/taskGrid/selection';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { taskHoursPerDay, type ReportContext } from '@/engine/reports/reportCommon';
import { parseTaskDurationInput, taskDurationInputContext } from '@/utils/taskDurationInput';
import {
  effHoursPerDay, effectiveCalendarOf, effectiveDurationDisplay, formatTaskDurationText, profileCountsWorkdays,
} from '@/utils/taskDuration';
import type { DurationDisplay } from '@/types/view';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { ViewRow } from '@/engine/view/visibleRows';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

const bands = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const week: WorkCalendar = {
  id: 'cal-week', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
  hoursPerDay: 8, holidays: [], workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
};
const DURATION = taskColumnId('task.time.scheduleDuration');
const NL_SUFFIXES: Record<string, string> = { 'duration.suffixDay': 'd', 'duration.suffixHour': 'u', 'duration.suffixMinute': 'm' };
const HOUR = 3_600_000;

type Profile = 'ops' | 'p6' | 'msproject';
function fixture(profile: Profile, display: DurationDisplay = 'auto') {
  const { store } = createAppStoreContext();
  const S = store.getState;
  S().setCalendar(week);
  S().setProject({ startDate: '2026-06-01', schedulingProfile: builtInProfile(profile) });
  const taskOf = (id: string): Task => S().tasks.find(t => t.id === id)!;
  const addTask = (name: string, time: Partial<Task['time']>): string => {
    const id = S().addTask({ name });
    S().updateTask(id, { time: { ...taskOf(id).time, ...time } });
    return id;
  };
  /** De kolomcontext van het taakraster, zoals FullTaskGrid hem bouwt. */
  const domain = () => {
    const s = S();
    const countsWorkdays = profileCountsWorkdays(s.project);
    return createTaskGridAdapterDomain({
      projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
      assignments: s.assignments, resources: s.resources, baselines: s.baselines,
      activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs, customTaskTypes: s.customTaskTypes,
      scheduleStale: s.scheduleStale, wbsAutoNumber: s.project.wbsAutoNumber === true,
      labelForColumn: key => key,
      // De nl-afkortingen, zoals de app ze in cel en klembord zet ("8u").
      labelForText: key => NL_SUFFIXES[key] ?? key,
      effectiveHoursPerDay: t => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
      effectiveCalendar: t => effectiveCalendarOf(t, s.calendar, s.calendars),
      durationDisplay: effectiveDurationDisplay(display, countsWorkdays),
      workdayDurationMeasure: countsWorkdays,
      numberLocale: 'nl',
    });
  };
  const environment = (taskId: string) => {
    const d = domain();
    const task = taskOf(taskId);
    const rows: ViewRow[] = [{ kind: 'task', rowKey: task.id, task, depth: 0, dimmed: false }];
    const rowIndex = createTaskGridRowIndex(rows);
    const selection = updateGridSelection(createEmptyGridSelection(), { rowKey: task.id, columnId: DURATION }, rowIndex, [DURATION], 'replace');
    return { selection, rowIndex, columns: [DURATION], descriptors: d.descriptorsById, context: d.context, dateNotation: 'dmy' as const };
  };
  /** Ctrl+C op de Duur-cel van `from`. */
  const copy = (from: string) => {
    const copied = copyTaskGridSelection(environment(from));
    return copied.ok ? copied.value : `fout: ${copied.errors.map(e => e.code).join(',')}`;
  };
  /** Ctrl+V op de Duur-cel van `to` (de echte route zet `skipReadOnlyCells` aan). */
  const paste = (text: string, to: string) => {
    const planned = planTaskGridPaste(text, environment(to), { skipReadOnlyCells: true });
    return planned.ok && S().runGridMutation([planned.value]).ok;
  };
  const solved = (id: string) => {
    S().runCPM();
    const t = taskOf(id).time;
    return [t.earlyStart, t.earlyFinish];
  };
  const spanHours = (id: string) => {
    const [start, finish] = solved(id);
    return (Date.parse(finish!) - Date.parse(start!)) / HOUR;
  };
  const cellText = (id: string) => {
    const d = domain();
    return d.descriptorsById.get(DURATION)!.format!(undefined, taskOf(id), d.context);
  };
  const editText = (id: string) => {
    const d = domain();
    return d.descriptorsById.get(DURATION)!.editText!(taskOf(id), d.context);
  };
  return { S, taskOf, addTask, copy, paste, solved, spanHours, cellText, editText };
}

const elapsed = (days: number): Partial<Task['time']> =>
  ({ durationType: 'ELAPSEDTIME', durationUnit: 'days', scheduleDuration: days, durationMinutes: undefined });

// ── 1. Het faalgeval: 1 d kalendertijd kopiëren naar een andere kalendertijdtaak van 2 d ─────────────
for (const profile of ['p6', 'msproject', 'ops'] as const) {
  const f = fixture(profile);
  const source = f.addTask('Uitharden', elapsed(1));
  const target = f.addTask('Drogen', elapsed(2));
  same(`1 ${profile}: de bron loopt 1 juni 07:00 tot 2 juni 07:00`, f.solved(source), ['2026-06-01T07:00', '2026-06-02T07:00']);
  same(`1 ${profile}: de bestemming duurt eerst 48 klokuren`, f.spanHours(target), 48);
  const text = f.copy(source);
  same(`1 ${profile}: het klembord bevat "1d"`, text, '1d');
  same(`1 ${profile}: plakken op de andere taak lukt`, f.paste(text, target), true);
  same(`1 ${profile}: de bestemming krijgt 1 kalenderdag`,
    [f.taskOf(target).time.durationUnit, f.taskOf(target).time.scheduleDuration, f.taskOf(target).time.durationMinutes],
    ['days', 1, undefined]);
  same(`1 ${profile}: na herberekenen de volle 24 u`, f.solved(target), ['2026-06-01T07:00', '2026-06-02T07:00']);
}

// ── 2. Kalendertijd in uren, en een geplakte urentekst, houden ook 24 klokuren ───────────────────────
for (const profile of ['p6', 'msproject'] as const) {
  const f = fixture(profile);
  const source = f.addTask('Bron', { durationType: 'ELAPSEDTIME', durationUnit: 'hours', durationMinutes: 1440, scheduleDuration: 3 });
  const target = f.addTask('Doel', elapsed(2));
  const text = f.copy(source);
  same(`2 ${profile}: een urentaak in kalendertijd kopieert als "24u"`, text, '24u');
  same(`2 ${profile}: plakken op de andere taak lukt`, f.paste(text, target), true);
  same(`2 ${profile}: de bestemming krijgt 1440 min`, f.taskOf(target).time.durationMinutes, 1440);
  same(`2 ${profile}: na herberekenen de volle 24 u`, f.spanHours(target), 24);
}

// ── 3. Duurweergave "Altijd uren" onder P6/MSP: weergave, bewerktekst en een kaal getal ──────────────
for (const profile of ['p6', 'msproject'] as const) {
  const f = fixture(profile, 'hours');
  const id = f.addTask('Uitharden', elapsed(1));
  f.solved(id);
  same(`3 ${profile}: de cel toont 24 uur met de eigen maat erachter`, f.cellText(id), '24u(1d)');
  same(`3 ${profile}: de bewerktekst is 24`, f.editText(id), '24');
  // Een kaal getal staat in de eenheid die de cel toont: 48 uur kalendertijd is 2 kalenderdagen.
  same(`3 ${profile}: kaal "48" geplakt`, f.paste('48', id), true);
  same(`3 ${profile}: de taak krijgt 2 kalenderdagen`, f.taskOf(id).time.scheduleDuration, 2);
  same(`3 ${profile}: na herberekenen 48 klokuren`, f.spanHours(id), 48);
}

// ── 4. Paneel en dialoog lezen dezelfde regel (`taskDurationInputContext`) ───────────────────────────
{
  const task = { time: { durationType: 'ELAPSEDTIME', durationUnit: 'days' } } as Pick<Task, 'time'>;
  const p6 = taskDurationInputContext(task, { countsWorkdays: false, hoursPerDay: 8, display: 'auto' });
  same('4 P6 kalendertijd: "d" blijft een dag, 24 u per dag', [p6.dayMeasure, p6.hoursPerDay], [true, 24]);
  same('4 P6 kalendertijd: "3d" is 3 kalenderdagen', parseTaskDurationInput('3d', 'days', p6),
    { unit: 'days', scheduleDuration: 3, explicitUnit: true });
  const work = { time: { durationType: 'WORKTIME', durationUnit: 'days' } } as Pick<Task, 'time'>;
  const p6Work = taskDurationInputContext(work, { countsWorkdays: false, hoursPerDay: 8, display: 'auto' });
  same('4 P6 werktijd blijft B8: "3d" is 24 werkuren', parseTaskDurationInput('3d', 'days', p6Work),
    { unit: 'hours', durationMinutes: 1440, explicitUnit: true });
}

// ── 5. Weergave elders: tooltip, afdruk en tabelrapport rekenen met 24 u ─────────────────────────────
{
  const f = fixture('p6');
  const id = f.addTask('Uitharden', elapsed(1.5));
  const task = f.taskOf(id);
  same('5 formatTaskDurationText (tooltip, afdruk, paneel): 36 u', formatTaskDurationText(task, 8, { display: 'hours' }), '36h(1.5d)');
  const ctx = { calendar: week, calendars: [] } as unknown as ReportContext;
  same('5 tabelrapport: 24 u per dag bij kalendertijd', taskHoursPerDay(ctx, task), 24);
}

// ── 6. Controle: werktijd onder P6 blijft B8 (een dag is de werktijd per dag) ────────────────────────
{
  const f = fixture('p6');
  const source = f.addTask('Werk', { durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 1, durationMinutes: undefined });
  const target = f.addTask('Ander werk', { durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 2, durationMinutes: undefined });
  const before = f.solved(source);
  const text = f.copy(source);
  same('6 P6 werktijd: 1 d kopieert als "8u"', text, '8u');
  same('6 P6 werktijd: plakken lukt', f.paste(text, target), true);
  same('6 P6 werktijd: de bestemming krijgt 480 werkminuten', f.taskOf(target).time.durationMinutes, 480);
  same('6 P6 werktijd: hetzelfde einde als de bron', f.solved(target), before);
}

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX  ${failure}`);
  console.log(`\n${failures.length}/${checks} F4b-review-r2-checks mislukt.`);
  process.exit(1);
}
console.log(`OK  F4b review r2: ${checks} checks groen.`);
