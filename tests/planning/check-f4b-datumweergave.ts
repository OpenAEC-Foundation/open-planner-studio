// F4b (spec "alleen uren" B4, §3.6, §4.2): hoe een taakdatum op het scherm staat.
//
// Een datum toont alleen een tijd als het moment midden op de werkdag valt:
//  - een startachtig veld zonder tijd op het begin van het eerste werkblok van zijn werkdag;
//  - een eindachtig veld zonder tijd op het einde van het laatste werkblok (ook de 24:00-regel en de
//    nachtploeg, die bij de dag horen waarop hun blok begint);
//  - een mijlpaal toont geen tijd als zijn ene moment op een van beide dagranden valt.
// Met tijd staat de klokdatum; OPS toont nooit "24:00". De voorbeelden komen letterlijk uit B4 (§8).
// Raster, tooltip, taakpaneel, rapporten en afdruk delen `taskDateLabel` (`@/utils/taskDateLabel`).
import './domStub';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { copyGridEditorValue, gridTaskDateField } from '@/engine/taskGrid/editors';
import { makeTaskDateLabeler } from '@/engine/reports/reportCommon';
import { momentLabel, taskDateClock, taskDateLabel } from '@/utils/taskDateLabel';
import { displayDateTime } from '@/utils/displayDate';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { TaskColumnContext } from '@/types/taskGrid';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task, TaskTime } from '@/types/task';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

type Band = { start: number; end: number };
const week = (bands: Band[], days: number[] = [1, 2, 3, 4, 5]): WorkTimeBands => ({
  byWeekday: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(d => [d, days.includes(d) ? bands : []])) as WorkTimeBands['byWeekday'],
});
const cal = (id: string, workTime: WorkTimeBands, workDays = [1, 2, 3, 4, 5]): WorkCalendar => ({
  id, name: id, description: '', workDays, workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime,
});
// De standaardkalender van B4: 07:00–12:00 + 13:00–16:00 op ma–vr.
const standard = cal('std', week([{ start: 420, end: 720 }, { start: 780, end: 960 }]));
// Dezelfde standaardkalender als dagkalender (zonder eigen werkblokken): de motor leidt de blokken af.
const scalar: WorkCalendar = {
  id: 'scalar', name: 'scalar', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const allDay = cal('24u', week([{ start: 0, end: 1440 }], [1, 2, 3, 4, 5, 6, 7]), [1, 2, 3, 4, 5, 6, 7]);
// Nachtploeg 22:00–06:00 op ma–vr; het blok hoort bij de dag waarop het begint.
const night = cal('nacht', week([{ start: 1320, end: 1800 }]));

function task(time: Partial<TaskTime> = {}, extra: Partial<Task> = {}): Task {
  return {
    id: extra.id ?? 't', name: 'Taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], activityCodes: {}, customFields: {},
    ...extra,
    time: { ...createDefaultTaskTime('2026-06-01', 1, 'days'), ...time },
  } as Task;
}
const dayTask = task();
const milestone = (kind?: 'START' | 'FINISH') => task({ scheduleDuration: 0 }, { isMilestone: true, ...(kind ? { milestoneKind: kind } : {}) });
const elapsed = task({ durationType: 'ELAPSEDTIME' });
const show = (label: string) => displayDateTime(label, 'dmy', '24h');

// ── 1. De voorbeelden uit B4 op de standaardkalender ──────────────────────────────────────────────
same('start na de pauze: "wo 3 jun 13:00"', taskDateLabel(dayTask, '2026-06-03T13:00', 'start', standard), '2026-06-03T13:00');
same('einde vóór de pauze: "wo 3 jun 12:00"', taskDateLabel(dayTask, '2026-06-03T12:00', 'end', standard), '2026-06-03T12:00');
same('start om 16:00 (rauw anker): "ma 1 jun 16:00"', taskDateLabel(dayTask, '2026-06-01T16:00', 'start', standard), '2026-06-01T16:00');
same('einde om 07:00: "di 2 jun 07:00"', taskDateLabel(dayTask, '2026-06-02T07:00', 'end', standard), '2026-06-02T07:00');
same('start op het begin van de werkdag: alleen de datum', taskDateLabel(dayTask, '2026-06-01T07:00', 'start', standard), '2026-06-01');
same('einde op het einde van de werkdag: alleen de datum', taskDateLabel(dayTask, '2026-06-05T16:00', 'end', standard), '2026-06-05');
same('een datum zonder tijd blijft een datum', taskDateLabel(dayTask, '2026-06-03', 'start', standard), '2026-06-03');
same('een lege waarde blijft leeg', taskDateLabel(dayTask, '', 'end', standard), '');
same('dezelfde regel op een dagkalender (afgeleide blokken)', [
  taskDateLabel(dayTask, '2026-06-01T07:00', 'start', scalar),
  taskDateLabel(dayTask, '2026-06-01T16:00', 'end', scalar),
  taskDateLabel(dayTask, '2026-06-03T13:00', 'start', scalar),
], ['2026-06-01', '2026-06-01', '2026-06-03T13:00']);
same('weergave in de notatie van de app', [
  show(taskDateLabel(dayTask, '2026-06-03T13:00', 'start', standard)),
  show(taskDateLabel(dayTask, '2026-06-01T07:00', 'start', standard)),
], ['03-06-2026 13:00', '01-06-2026']);

// ── 2. De 24:00-regel en 00:00 ────────────────────────────────────────────────────────────────────
same('kalendertijd: 1 d vanaf ma 00:00 toont "einde ma 1 jun"', taskDateLabel(elapsed, '2026-06-02T00:00', 'end', standard), '2026-06-01');
same('kalendertijd: start ma 00:00 toont "ma 1 jun"', taskDateLabel(elapsed, '2026-06-01T00:00', 'start', standard), '2026-06-01');
same('kalendertijd: einde midden op de dag houdt de tijd', taskDateLabel(elapsed, '2026-06-02T09:30', 'end', standard), '2026-06-02T09:30');
same('24-uurskalender: einde di 00:00 toont "ma 1 jun"', taskDateLabel(dayTask, '2026-06-02T00:00', 'end', allDay), '2026-06-01');
same('24-uurskalender: start di 00:00 toont "di 2 jun"', taskDateLabel(dayTask, '2026-06-02T00:00', 'start', allDay), '2026-06-02');
same('nooit "24:00": het einde om 00:00 staat bij de dag ervoor zonder tijd',
  show(taskDateLabel(elapsed, '2026-06-02T00:00', 'end', standard)), '01-06-2026');

// ── 3. Nachtploeg 22:00–06:00 ─────────────────────────────────────────────────────────────────────
same('nacht: start di 22:00 toont "di 2 jun"', taskDateLabel(dayTask, '2026-06-02T22:00', 'start', night), '2026-06-02');
same('nacht: einde wo 06:00 toont "di 2 jun"', taskDateLabel(dayTask, '2026-06-03T06:00', 'end', night), '2026-06-02');
same('nacht: einde wo 02:00 toont "wo 3 jun 02:00"', taskDateLabel(dayTask, '2026-06-03T02:00', 'end', night), '2026-06-03T02:00');
same('nacht: één nacht toont "di 2 jun – di 2 jun"', [
  taskDateLabel(dayTask, '2026-06-02T22:00', 'start', night), taskDateLabel(dayTask, '2026-06-03T06:00', 'end', night),
], ['2026-06-02', '2026-06-02']);

// ── 4. De mijlpaal: geen tijd op een van beide dagranden ──────────────────────────────────────────
same('START-mijlpaal op het einde van de werkdag (16:00): alleen de datum',
  taskDateLabel(milestone('START'), '2026-06-01T16:00', 'start', standard), '2026-06-01');
same('mijlpaal zonder soort op het einde van de werkdag: alleen de datum',
  taskDateLabel(milestone(), '2026-06-01T16:00', 'start', standard), '2026-06-01');
same('FINISH-mijlpaal op het begin van de werkdag (07:00): alleen de datum',
  taskDateLabel(milestone('FINISH'), '2026-06-02T07:00', 'end', standard), '2026-06-02');
same('mijlpaal midden op de dag houdt de tijd', taskDateLabel(milestone('START'), '2026-06-03T13:00', 'start', standard), '2026-06-03T13:00');
same('FINISH-mijlpaal op een 24-uurskalender om di 00:00 hoort bij ma',
  taskDateLabel(milestone('FINISH'), '2026-06-02T00:00', 'end', allDay), '2026-06-01');
same('START-mijlpaal op een 24-uurskalender om di 00:00 hoort bij di',
  taskDateLabel(milestone('START'), '2026-06-02T00:00', 'start', allDay), '2026-06-02');
same('de mijlpaalregel geldt niet voor een beperking of deadline van de mijlpaal',
  taskDateLabel(milestone('START'), '2026-06-01T16:00', 'start', standard, { milestoneOwn: false }), '2026-06-01T16:00');
same('momentLabel zonder mijlpaal volgt alleen de eigen kant',
  momentLabel(taskDateClock(dayTask, standard), '2026-06-01T16:00', 'start'), '2026-06-01T16:00');

// ── 5. Het raster: elke datumkolom van een taak heeft een kant ────────────────────────────────────
same('kanten van de rasterkolommen', [
  'task.time.start', 'task.time.finish', 'task.time.earlyFinish', 'task.time.lateStart', 'task.time.actualFinish',
  'task.time.resume', 'task.time.stop', 'task.deadline', 'task.timephasedStartAnchor',
].map(id => gridTaskDateField(id, dayTask)), [
  { side: 'start', milestoneOwn: true }, { side: 'end', milestoneOwn: true }, { side: 'end', milestoneOwn: true },
  { side: 'start', milestoneOwn: true }, { side: 'end', milestoneOwn: true }, { side: 'start', milestoneOwn: false },
  { side: 'end', milestoneOwn: false }, { side: 'end', milestoneOwn: false }, null,
]);
same('beperkingsdatum: SNET startachtig, FNLT eindachtig', [
  gridTaskDateField('task.constraint.date', task({}, { constraint: { type: 'SNET', date: '2026-06-03T13:00' } })),
  gridTaskDateField('task.constraint2.date', task({}, { constraint2: { type: 'FNLT', date: '2026-06-03T16:00' } })),
], [{ side: 'start', milestoneOwn: false }, { side: 'end', milestoneOwn: false }]);

const registry = buildTaskColumnRegistry({ projectId: 'p', activityCodeTypes: [], customFieldDefs: [], baselines: [] });
const column = (id: string) => registry.find(d => String(d.id) === id)!;
const gridContext: TaskColumnContext = {
  projectId: 'p', tasksById: new Map(), relationIndex: { byTaskId: new Map() } as unknown as TaskColumnContext['relationIndex'],
  assignmentsByTaskId: new Map(), resourcesById: new Map(), baselinesById: new Map(), scheduleStale: false,
  effectiveHoursPerDay: () => 8, effectiveCalendar: () => standard, timeNotation: '24h',
};
const cell = (id: string, t: Task) => copyGridEditorValue(column(id), t, gridContext, 'dmy');
const midDay = task({ scheduleStart: '2026-06-03T13:00', earlyStart: '2026-06-03T13:00', scheduleFinish: '2026-06-05T16:00', earlyFinish: '2026-06-05T16:00' });
same('raster: start 13:00 met tijd, einde op de dagrand zonder tijd', [cell('task.time.start', midDay), cell('task.time.finish', midDay)],
  ['03-06-2026 13:00', '05-06-2026']);
const msTask = task({ scheduleDuration: 0, scheduleStart: '2026-06-01T16:00', earlyStart: '2026-06-01T16:00', scheduleFinish: '2026-06-01T16:00', earlyFinish: '2026-06-01T16:00' },
  { isMilestone: true, milestoneKind: 'START' });
same('raster: START-mijlpaal om 16:00 toont alleen de datum (start- en eindkolom)',
  [cell('task.time.start', msTask), cell('task.time.finish', msTask)], ['01-06-2026', '01-06-2026']);
const constrained = task({}, {
  constraint: { type: 'SNET', date: '2026-06-03T13:00' }, constraint2: { type: 'FNLT', date: '2026-06-05T16:00' }, deadline: '2026-06-05T12:00',
});
same('raster: beperkingen en deadline tonen hun tijd volgens B4', [
  cell('task.constraint.date', constrained), cell('task.constraint2.date', constrained), cell('task.deadline', constrained),
], ['03-06-2026 13:00', '05-06-2026', '05-06-2026 12:00']);
same('raster: beperking en deadline zijn datum-met-tijd-velden', [
  column('task.constraint.date').editorKind, column('task.constraint2.date').editorKind, column('task.deadline').editorKind,
], ['datetime', 'datetime', 'datetime']);
same('raster: een datum zonder tijd in de beperkingskolom leest als datum (de store normaliseert)',
  (() => { const r = column('task.constraint.date').parse!('2026-06-03', constrained, gridContext); return r.ok ? r.value : null; })(), '2026-06-03');

// ── 6. Rapporten: dezelfde regel op taak-id ───────────────────────────────────────────────────────
{
  const a = task({}, { id: 'a' });
  const b = task({}, { id: 'b', calendarId: 'nacht' });
  const label = makeTaskDateLabeler({ tasks: [a, b], calendar: standard, calendars: [night] });
  same('rapport: projectkalender', [label('a', '2026-06-03T13:00', 'start'), label('a', '2026-06-05T16:00', 'end')],
    ['2026-06-03T13:00', '2026-06-05']);
  same('rapport: eigen kalender van de taak (nachtploeg)', label('b', '2026-06-03T06:00', 'end'), '2026-06-02');
  same('rapport: onbekende taak toont alleen de datum', label('weg', '2026-06-03T13:00', 'start'), '2026-06-03');
  same('rapport: lege waarde blijft leeg', label('a', undefined, 'start'), '');
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  ${f}`);
  console.log(`\n${failures.length}/${checks} F4b-datumweergavechecks mislukt.`);
  process.exit(1);
}
console.log(`OK  F4b-datumweergave: ${checks} checks groen.`);
