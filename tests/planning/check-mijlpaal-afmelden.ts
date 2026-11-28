import './domStub';
import { actualStartQuestionFor, planProgressEntry } from '@/engine/progressEntry';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { isTaskActualPastStatusDate, normalizeActualDate, normalizeLoadedActualDate } from '@/engine/taskMutationRules';
import {
  dayEndInstant, dayStartInstant, ELAPSED_CLOCK, milestoneWorkdayOf, workdayEdgeAt,
} from '@/engine/calendar/workdayRules';
import { normalizeImportedProgress } from '@/services/importNormalize';
import { progress } from '@/state/mcpValidation';
import { createTaskDialogSave, planTaskDialogProgress } from '@/state/taskDialogSave';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { makeBands } from '@/utils/effectiveWorkTime';
import { calendarClock, taskDateLabel } from '@/utils/taskDateLabel';
import { shownStart } from '@/utils/taskDates';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { commitTaskCellEditorValue } from '@/components/task-grid/TaskCellEditor';
import { profileCountsWorkdays } from '@/utils/taskDuration';
import { invalidDateReasons } from '@/engine/reports/dcmaAssessment';
import { computeScheduleHealth } from '@/engine/reports/scheduleHealth';
import { makeTaskDateLabeler } from '@/engine/reports/reportCommon';
import { renderReport, type PrintOptions } from '@/services/print/printPreview';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import type { Draw2D } from '@/services/pdf/draw2d';
import type { MilestoneKind, Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { CellEditIntent } from '@/types/taskGrid';

declare const process: { exit(code: number): never };

let checks = 0;
const failures: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

type Profile = 'ops' | 'p6' | 'msproject';
type Field = 'actualStart' | 'actualFinish';
const PROFILES: Profile[] = ['ops', 'p6', 'msproject'];
const FIELDS: Field[] = ['actualStart', 'actualFinish'];
const KINDS: (MilestoneKind | undefined)[] = [undefined, 'START', 'FINISH'];
const kindName = (kind: MilestoneKind | undefined) => kind ?? 'zonder soort';
const STATUS = '2026-06-05';

interface Parts { midden?: boolean; los?: boolean; taak?: boolean }
function fixture(profile: Profile, calendarOf?: (c: WorkCalendar) => WorkCalendar, parts: Parts = {}) {
  const context = createAppStoreContext();
  const S = () => context.store.getState();
  if (calendarOf) S().setCalendar(calendarOf(S().calendar));
  S().setProject({ startDate: '2026-06-01', schedulingProfile: builtInProfile(profile) });
  const taskOf = (id: string) => S().tasks.find(t => t.id === id)!;
  const milestone = (name: string, kind?: MilestoneKind) => S().addTask({
    name, isMilestone: true, ...(kind ? { milestoneKind: kind } : {}), time: { scheduleDuration: 0 } as Task['time'],
  });
  const hours = (name: string, h: number) => {
    const id = S().addTask({ name });
    S().updateTask(id, { time: { ...taskOf(id).time, durationUnit: 'hours', durationMinutes: h * 60, scheduleDuration: h / 8 } });
    return id;
  };
  const fs = (a: string, b: string) => S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  const oplevering = milestone('Oplevering', 'FINISH');
  fs(hours('Afbouw', 8), oplevering);
  const startBouw = milestone('Start bouw', 'START');
  fs(startBouw, hours('Grondwerk', 8));
  const midden: Record<string, string> = {};
  if (parts.midden !== false) {
    const inspectie = hours('Inspectie 3 u', 3);
    for (const kind of KINDS) {
      const m = milestone('Keuring ' + kindName(kind), kind);
      fs(inspectie, m);
      midden[kindName(kind)] = m;
    }
  }
  const los: Record<string, string> = {};
  if (parts.los !== false) for (const kind of KINDS) los[kindName(kind)] = milestone('Los ' + kindName(kind), kind);
  const taak = parts.taak !== false ? hours('Metselwerk', 8) : '';
  S().runCPM();
  S().setStatusDate(STATUS);
  const calendar = () => resolveCalendar(undefined, S().calendars, S().calendar);
  return { context, S, taskOf, milestone, hours, fs, oplevering, startBouw, midden, los, taak, calendar };
}
type Fixture = ReturnType<typeof fixture>;

const clockOf = (moment: string | undefined) => moment?.slice(11, 16);

for (const profile of PROFILES) {
  const f = fixture(profile);
  eq(`${profile} voorwaarde: Oplevering gepland ma 1 jun 16:00`, f.taskOf(f.oplevering).time.earlyStart, '2026-06-01T16:00');
  eq(`${profile} voorwaarde: Start bouw gepland ma 1 jun 07:00`, f.taskOf(f.startBouw).time.earlyStart, '2026-06-01T07:00');
  for (const kind of KINDS) {
    eq(`${profile} voorwaarde: Keuring ${kindName(kind)} midden op de dag (10:00)`,
      f.taskOf(f.midden[kindName(kind)]).time.earlyStart, '2026-06-01T10:00');
    eq(`${profile} voorwaarde: Los ${kindName(kind)} (OPS: B6 einde van de werkdag)`,
      f.taskOf(f.los[kindName(kind)]).time.earlyStart,
      profile === 'ops' || kind === 'FINISH' ? '2026-06-01T16:00' : '2026-06-01T07:00');
  }
  eq(`${profile} voorwaarde: de statusdatum heeft geen tijd`, f.S().project.statusDate, STATUS);
}

type Route = 'functie' | 'paneel' | 'UI-invoer' | 'tabel' | 'celeditor' | 'plakken' | 'dialoog' | 'MCP' | 'voortgangsimport';
const ROUTES: Route[] = ['functie', 'paneel', 'UI-invoer', 'tabel', 'celeditor', 'plakken', 'dialoog', 'MCP', 'voortgangsimport'];

function typedText(iso: string): string {
  const day = `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
  return iso.length > 10 ? `${day} ${iso.slice(11, 16)}` : day;
}

type Entry = Pick<Fixture, 'context' | 'S' | 'taskOf' | 'calendar'>;
function enter(f: Entry, route: Route, id: string, field: Field, value: string, status = STATUS): string | undefined {
  const S = f.S;
  const task = f.taskOf(id);
  const calendar = f.calendar();
  if (route === 'functie') {
    const moment = normalizeActualDate(task, field, value, status, calendar);
    return moment && isTaskActualPastStatusDate(task, field, moment, status, calendar) ? 'geweigerd' : moment;
  }
  if (route === 'paneel') {
    const ok = field === 'actualStart' ? S().setActualStart(id, value) : S().setActualFinish(id, value);
    return ok ? f.taskOf(id).time[field] : 'geweigerd';
  }
  if (route === 'UI-invoer') {
    const result = S().enterTaskProgress(id, { field, value }, { today: '2026-06-10' });
    return result.ok ? f.taskOf(id).time[field] : 'geweigerd';
  }
  if (route === 'tabel' || route === 'plakken') {
    const edit: CellEditIntent = {
      kind: 'cell-edit', taskId: id, columnId: `task.time.${field}` as CellEditIntent['columnId'],
      route: 'task-progress', value,
    };
    const ok = S().runGridMutation(route === 'plakken' ? [{ kind: 'paste', writes: [edit] }] : [edit]).ok;
    return ok ? f.taskOf(id).time[field] : 'geweigerd';
  }
  if (route === 'celeditor') {
    const adapter = createTaskGridAdapter({
      projectId: S().project.id, tasks: S().tasks,
      rows: S().tasks.map(t => ({ kind: 'task', rowKey: t.id, task: t, depth: 0, dimmed: false })),
      sequences: S().sequences, assignments: S().assignments, resources: S().resources, baselines: S().baselines,
      activityCodeTypes: [], customFieldDefs: [], scheduleStale: S().scheduleStale, wbsAutoNumber: false,
      surfaceId: 'full-task-grid', selectedTaskIds: [], labelForColumn: k => k,
      effectiveCalendar: () => calendar, effectiveHoursPerDay: () => 8, dateNotation: 'dmy', timeNotation: '24h',
      workdayDurationMeasure: profileCountsWorkdays(S().project), numberLocale: 'nl',
      callbacks: { onCommitEdit: (_target, intents) => S().runGridMutation(intents) },
    });
    const result = commitTaskCellEditorValue({
      adapter, cell: { rowKey: id, columnId: taskColumnId(`task.time.${field}`) }, text: typedText(value), messageForError: k => k,
    });
    return result.ok ? f.taskOf(id).time[field] : 'geweigerd';
  }
  if (route === 'dialoog') {
    const plan = planTaskDialogProgress(S(), task, undefined, { field, value }, { today: '2026-06-10' });
    if (!plan.ok) return 'geweigerd';
    const ok = !plan.change || createTaskDialogSave(f.context)({
      editingTaskId: id, draft: plan.change.task, today: '2026-06-10',
    });
    return ok ? f.taskOf(id).time[field] : 'geweigerd';
  }
  if (route === 'MCP') {
    const draft = structuredClone({
      tasks: S().tasks, sequences: S().sequences, assignments: S().assignments, resources: S().resources,
      calendars: S().calendars, calendar: S().calendar, project: S().project,
    });
    const update = field === 'actualStart' ? { actualStart: value } : { actualFinish: value };
    const result = progress.applyProgressUpdate(draft, id, update, status);
    return result.applied ? draft.tasks.find(t => t.id === id)!.time[field] : 'geweigerd';
  }
  const cell = { kind: 'value' as const, iso: value };
  const plan = S().applyProgressImport([field === 'actualStart'
    ? { rowNumber: 2, taskId: id, actualStart: cell }
    : { rowNumber: 2, taskId: id, actualFinish: cell }]);
  return plan.appliedCount === 1 ? f.taskOf(id).time[field] : 'geweigerd';
}

for (const profile of PROFILES) for (const route of ROUTES) for (const field of FIELDS) {
  const tag = `${profile} ${route} ${field}`;
  {
    const f = fixture(profile);
    const planned = (id: string) => f.taskOf(id).time.earlyStart;
    eq(`${tag}: Oplevering (ma 16:00) op 3-6-2026 ⇒ wo 3 jun 16:00`,
      enter(f, route, f.oplevering, field, '2026-06-03'), '2026-06-03T16:00');
    eq(`${tag}: Start bouw (ma 07:00) op 2-6-2026 ⇒ di 2 jun 07:00`,
      enter(f, route, f.startBouw, field, '2026-06-02'), '2026-06-02T07:00');
    for (const kind of KINDS) {
      const id = f.midden[kindName(kind)];
      eq(`${tag}: Keuring ${kindName(kind)} (ma 10:00) op 3-6-2026 ⇒ 10:00`,
        enter(f, route, id, field, '2026-06-03'), '2026-06-03T10:00');
    }
    for (const kind of KINDS) {
      const id = f.los[kindName(kind)];
      const clock = clockOf(planned(id));
      eq(`${tag}: Los ${kindName(kind)} (${clock}) op 4-6-2026 ⇒ ${clock}`,
        enter(f, route, id, field, '2026-06-04'), `2026-06-04T${clock}`);
    }
    eq(`${tag}: gewone taak houdt ${field === 'actualStart' ? 'D1' : 'D2'}`,
      enter(f, route, f.taak, field, '2026-06-03'), field === 'actualStart' ? '2026-06-03T07:00' : '2026-06-03T16:00');
  }
  {
    const f = fixture(profile, undefined, { midden: false, taak: false });
    eq(`${tag}: getypte tijd 09:30 gaat voor (Oplevering)`,
      enter(f, route, f.oplevering, field, '2026-06-03T09:30'), '2026-06-03T09:30');
    eq(`${tag}: getypte tijd 13:15 gaat voor (Start bouw)`,
      enter(f, route, f.startBouw, field, '2026-06-02T13:15'), '2026-06-02T13:15');
    for (const kind of KINDS) {
      eq(`${tag}: getypte tijd 15:00 gaat voor (Los ${kindName(kind)})`,
        enter(f, route, f.los[kindName(kind)], field, '2026-06-04T15:00'), '2026-06-04T15:00');
    }
  }
}

for (const profile of PROFILES) {
  const f = fixture(profile);
  f.S().setActualFinish(f.oplevering, '2026-06-03T09:30');
  f.S().runCPM();
  eq(`${profile}: opnieuw afmelden op 4-6-2026 houdt 09:30`, enter(f, 'paneel', f.oplevering, 'actualFinish', '2026-06-04'), '2026-06-04T09:30');
  f.S().runCPM();
  eq(`${profile}: en via MCP op 5-6-2026 ook`, enter(f, 'MCP', f.oplevering, 'actualFinish', '2026-06-05'), '2026-06-05T09:30');
}

for (const profile of PROFILES) {
  const f = fixture(profile);
  const lone = f.los['zonder soort'];
  const clock = clockOf(f.taskOf(lone).time.earlyStart);
  eq(`${profile}: 100 % op een losse mijlpaal zonder soort`, f.S().setTaskProgress(lone, 1), true);
  eq(`${profile}: losse mijlpaal houdt het geplande moment`,
    [f.taskOf(lone).time.actualStart, f.taskOf(lone).time.actualFinish],
    [`2026-06-01T${clock}`, `2026-06-01T${clock}`]);
  eq(`${profile}: 100 % op Oplevering`, f.S().setTaskProgress(f.oplevering, 1), true);
  eq(`${profile}: Oplevering houdt het geplande moment`,
    [f.taskOf(f.oplevering).time.actualStart, f.taskOf(f.oplevering).time.actualFinish],
    ['2026-06-01T16:00', '2026-06-01T16:00']);
}

for (const profile of PROFILES) {
  const f = fixture(profile);
  f.S().setStatusDate('2026-06-03T12:00');
  const calendar = f.calendar();
  const opl = f.taskOf(f.oplevering);
  eq(`${profile}: datumloos op de statuswerkdag na het statusmoment ⇒ geklemd op 12:00`,
    normalizeActualDate(opl, 'actualFinish', '2026-06-03', '2026-06-03T12:00', calendar), '2026-06-03T12:00');
  eq(`${profile}: de dag ervoor houdt 16:00`,
    normalizeActualDate(opl, 'actualFinish', '2026-06-02', '2026-06-03T12:00', calendar), '2026-06-02T16:00');
  eq(`${profile}: paneel op de statuswerkdag ⇒ 12:00`, f.S().setActualFinish(f.oplevering, '2026-06-03') && f.taskOf(f.oplevering).time.actualFinish, '2026-06-03T12:00');
}

const day24 = (c: WorkCalendar): WorkCalendar => ({
  ...c, workStartHour: 0, workEndHour: 24, hoursPerDay: 24, workTime: makeBands([1, 2, 3, 4, 5], [{ start: 0, end: 1440 }]),
});
const night = (c: WorkCalendar): WorkCalendar => ({
  ...c, workStartHour: 22, workEndHour: 30, hoursPerDay: 8, workTime: makeBands([1, 2, 3, 4, 5], [{ start: 1320, end: 1800 }]),
});
{
  for (const [name, cal, h, want] of [['24 uur', day24, 24, '2026-06-04T00:00'], ['nachtploeg', night, 8, '2026-06-04T06:00']] as const) {
    const f = fixture('ops', cal);
    const id = f.milestone('Oplevering ' + name, 'FINISH');
    f.fs(f.hours('Werkdag ' + name, h), id);
    f.S().setStatusDate(undefined);
    f.S().runCPM();
    const calendar = f.calendar();
    eq(`${name}: voorwaarde: de tabel toont ma 1 jun`, taskDateLabel(f.taskOf(id), f.taskOf(id).time.earlyStart, 'end', calendar), '2026-06-01');
    const value = normalizeActualDate(f.taskOf(id), 'actualFinish', '2026-06-03', undefined, calendar)!;
    eq(`${name}: afgemeld op 3-6-2026 ⇒ het blokeinde van wo 3 jun`, value, want);
    eq(`${name}: en de tabel toont wo 3 jun`, taskDateLabel(f.taskOf(id), value, 'end', calendar), '2026-06-03');
  }
}

const NIGHT_STATUS = '2026-06-03';
function nightFixture(profile: Profile, holiday?: string, base: (c: WorkCalendar) => WorkCalendar = night) {
  const f = fixture(profile, c => ({
    ...base(c), holidays: holiday ? [{ name: 'Vrije dag', startDate: holiday, endDate: holiday }] : base(c).holidays,
  }));
  const anchors = KINDS.map(kind => {
    const id = f.milestone('Nachtanker ' + kindName(kind), kind);
    const at = '2026-06-02T06:00';
    f.S().updateTask(id, { manuallyScheduled: true, time: { ...f.taskOf(id).time, scheduleStart: at, scheduleFinish: at, earlyStart: at, earlyFinish: at } });
    return { name: `anker ${kindName(kind)}`, id };
  });
  f.S().setStatusDate(undefined);
  f.S().runCPM();
  f.S().setStatusDate(NIGHT_STATUS);
  const lone = profile === 'ops' ? KINDS.map(kind => ({ name: `los ${kindName(kind)} (B6)`, id: f.los[kindName(kind)] })) : [];
  return { ...f, cases: [...anchors, ...lone] };
}
function nightFieldsFixture(profile: Profile, holiday?: string, base: (c: WorkCalendar) => WorkCalendar = night) {
  const anchors = FIELDS.flatMap(field => [
    ...KINDS.map(kind => ({ name: `anker ${kindName(kind)}`, kind, at: '2026-06-02T06:00', field })),
    ...(profile === 'ops' ? KINDS.map(kind => ({ name: `los ${kindName(kind)} (B6)`, kind, field })) : []),
  ]);
  const f = anchorFixture(profile, c => ({
    ...base(c), holidays: holiday ? [{ name: 'Vrije dag', startDate: holiday, endDate: holiday }] : base(c).holidays,
  }), '2026-06-01', anchors);
  f.S().setStatusDate(NIGHT_STATUS);
  return { ...f, cases: anchors.map((a, i) => ({ name: a.name, field: a.field, id: f.ids[i] })) };
}
for (const profile of PROFILES) {
  const f = nightFixture(profile);
  const calendar = f.calendar();
  eq(`nacht ${profile} voorwaarde: de statusdatum is wo 3 jun zonder tijd`, f.S().project.statusDate, NIGHT_STATUS);
  eq(`nacht ${profile} voorwaarde: ${profile === 'ops' ? 'zes' : 'drie'} mijlpalen`, f.cases.length, profile === 'ops' ? 6 : 3);
  for (const c of f.cases) {
    const t = f.taskOf(c.id);
    eq(`nacht ${profile} voorwaarde: ${c.name} gepland di 2 jun 06:00`, shownStart(t), '2026-06-02T06:00');
    eq(`nacht ${profile} voorwaarde: ${c.name} toont 01-06-2026`, taskDateLabel(t, shownStart(t)!, 'start', calendar), '2026-06-01');
    for (const field of FIELDS) {
      eq(`nacht ${profile} ${c.name} ${field}: letterlijk di 06:00, statusdatum ma ⇒ mag`,
        isTaskActualPastStatusDate(t, field, '2026-06-02T06:00', '2026-06-01', calendar) ? 'geweigerd' : 'mag', 'mag');
    }
  }
}
for (const profile of PROFILES) for (const route of ROUTES) {
  const f = nightFieldsFixture(profile);
  const calendar = f.calendar();
  for (const c of f.cases) {
    const field = c.field;
    const tag = `nacht ${profile} ${route} ${field} ${c.name}`;
    eq(`${tag}: voorwaarde: gepland di 2 jun 06:00`, shownStart(f.taskOf(c.id)), '2026-06-02T06:00');
    const got = enter(f, route, c.id, field, '2026-06-03', NIGHT_STATUS);
    eq(`${tag}: 03-06-2026 op de statuswerkdag ⇒ do 4 jun 06:00`, got, '2026-06-04T06:00');
    eq(`${tag}: de tabel toont 03-06-2026`, got && got !== 'geweigerd' ? taskDateLabel(f.taskOf(c.id), got, 'start', calendar) : got, '2026-06-03');
  }
}

for (const profile of PROFILES) {
  const f = nightFixture(profile);
  const calendar = f.calendar();
  for (const c of f.cases) {
    eq(`nacht ${profile} ${c.name}: afmelden via het paneel`, f.S().setActualFinish(c.id, '2026-06-03'), true);
  }
  f.S().runCPM();
  for (const c of f.cases) {
    const t = f.taskOf(c.id);
    eq(`nacht ${profile} ${c.name}: na F5 nog afgemeld op do 4 jun 06:00`, [t.time.actualStart, t.time.actualFinish, t.time.completion],
      ['2026-06-04T06:00', '2026-06-04T06:00', 1]);
    eq(`nacht ${profile} ${c.name}: DCMA meldt geen datum ná de statusdatum`, invalidDateReasons(t, NIGHT_STATUS, NIGHT_STATUS, false, calendar), []);
    const read: Task = { ...t, time: { ...t.time, actualStart: '2026-06-04T06:00', actualFinish: '2026-06-04T06:00', completion: 1 } };
    eq(`nacht ${profile} ${c.name}: DCMA, actuals do 06:00 uit een bestand ⇒ geen datum ná de statusdatum`,
      invalidDateReasons(read, NIGHT_STATUS, NIGHT_STATUS, false, calendar), []);
  }
}
for (const profile of PROFILES) {
  const f = nightFixture(profile);
  f.S().setStatusDate('2026-06-03T23:00');
  for (const c of f.cases) {
    eq(`nacht ${profile} ${c.name}: statusmoment wo 23:00, datumloos ⇒ geklemd op 23:00`,
      enter(f, 'paneel', c.id, 'actualStart', '2026-06-03', '2026-06-03T23:00'), '2026-06-03T23:00');
  }
  const g = nightFixture(profile);
  g.S().setStatusDate('2026-06-03T23:00');
  for (const c of g.cases) {
    eq(`nacht ${profile} ${c.name}: statusmoment wo 23:00, getypt do 06:00 ⇒ geweigerd`,
      enter(g, 'paneel', c.id, 'actualFinish', '2026-06-04T06:00', '2026-06-03T23:00'), 'geweigerd');
  }
}
for (const profile of PROFILES) {
  const f = nightFixture(profile);
  for (const route of ['paneel', 'MCP', 'celeditor'] as const) {
    eq(`nacht ${profile} ${route}: gewone taak, werkelijke start do 06:00 ⇒ geweigerd`,
      enter(f, route, f.taak, 'actualStart', '2026-06-04T06:00', NIGHT_STATUS), 'geweigerd');
  }
  eq(`nacht ${profile}: gewone taak, werkelijk einde do 06:00 mag`,
    enter(f, 'MCP', f.taak, 'actualFinish', '2026-06-04T06:00', NIGHT_STATUS), '2026-06-04T06:00');
  eq(`nacht ${profile}: gewone taak, werkelijke start 03-06-2026 ⇒ D1 wo 22:00`,
    enter(f, 'MCP', f.taak, 'actualStart', '2026-06-03', NIGHT_STATUS), '2026-06-03T22:00');
  eq(`nacht ${profile}: laadgrens, mijlpaal zonder soort ⇒ D1 wo 22:00`,
    normalizeLoadedActualDate(f.taskOf(f.cases[0].id), 'actualFinish', '2026-06-03', NIGHT_STATUS, f.calendar()), '2026-06-03T22:00');
}
{
  const f = fixture('ops', day24);
  f.S().setStatusDate('2026-06-01');
  eq('24 uur: START-mijlpaal op di 00:00 met statusdatum ma ⇒ geweigerd',
    enter(f, 'paneel', f.los.START, 'actualStart', '2026-06-02T00:00', '2026-06-01'), 'geweigerd');
  eq('24 uur: FINISH-mijlpaal op di 00:00 met statusdatum ma ⇒ mag',
    enter(f, 'paneel', f.los.FINISH, 'actualFinish', '2026-06-02T00:00', '2026-06-01'), '2026-06-02T00:00');
}

const FREE_DAYS = [
  { name: 'za 6 jun', day: '2026-06-06', holiday: undefined, want: '2026-06-07T06:00', next: '2026-06-07' },
  { name: 'zo 7 jun', day: '2026-06-07', holiday: undefined, want: '2026-06-08T06:00', next: '2026-06-08' },
  { name: 'wo 3 jun, feestdag', day: '2026-06-03', holiday: '2026-06-03', want: '2026-06-04T06:00', next: '2026-06-04' },
] as const;
for (const free of FREE_DAYS) for (const profile of PROFILES) {
  const f = nightFixture(profile, free.holiday);
  f.S().setStatusDate(free.day);
  const calendar = f.calendar();
  eq(`D4 ${free.name} ${profile} voorwaarde: statusdatum zonder tijd`, f.S().project.statusDate, free.day);
  for (const c of f.cases) {
    eq(`D4 ${free.name} ${profile} voorwaarde: ${c.name} gepland di 2 jun 06:00`, shownStart(f.taskOf(c.id)), '2026-06-02T06:00');
  }
  for (const c of f.cases) {
    eq(`D4 ${free.name} ${profile} ${c.name}: de dag erna ⇒ geweigerd`,
      enter(f, 'paneel', c.id, 'actualFinish', free.next, free.day), 'geweigerd');
  }
  eq(`D4 ${free.name} ${profile}: weergave van ${free.want} bij een mijlpaal`,
    taskDateLabel(f.taskOf(f.cases[0].id), free.want, 'start', calendar), free.day);
}
for (const free of FREE_DAYS) for (const profile of PROFILES) for (const route of ROUTES) {
  const f = nightFieldsFixture(profile, free.holiday);
  f.S().setStatusDate(free.day);
  const calendar = f.calendar();
  for (const c of f.cases) {
    const field = c.field;
    const tag = `D4 ${free.name} ${profile} ${route} ${field} ${c.name}`;
    eq(`${tag}: voorwaarde: gepland di 2 jun 06:00`, shownStart(f.taskOf(c.id)), '2026-06-02T06:00');
    const got = enter(f, route, c.id, field, free.day, free.day);
    eq(`${tag}: afmelden op de statusdag ⇒ ${free.want}`, got, free.want);
    eq(`${tag}: de tabel toont de statusdag`, got && got !== 'geweigerd' ? taskDateLabel(f.taskOf(c.id), got, 'start', calendar) : got, free.day);
  }
}

const HEALTH_OPTS = { highFloatDays: 44, longDurationDays: 44, lagDays: 10, nearCriticalDays: 5 };
const healthOf = (f: Fixture) => {
  const s = f.S();
  return computeScheduleHealth({
    tasks: s.tasks, sequences: s.sequences, resources: s.resources, assignments: s.assignments,
    calendar: s.calendar, calendars: s.calendars, cpmResult: s.cpmResult, baseline: null,
    statusDate: s.project.statusDate, today: '2026-06-10', datesAsRecorded: s.datesAsRecorded,
    solveOptions: solveOptionsFor(s.project),
  }, HEALTH_OPTS);
};
const progressExceptions = (f: Fixture, ids: string[]) => healthOf(f).checks.find(c => c.id === 'progressException')!.items
  .filter(item => ids.includes(item.taskId ?? '')).map(item => `${item.name}: ${item.detail.reason}`);
const errorsAt = (f: Fixture, ids: string[]) => healthOf(f).checks.filter(c => c.severity === 'error')
  .flatMap(c => c.items.filter(item => ids.includes(item.taskId ?? '')).map(item => `${c.id} ${item.name}`));
for (const status of [{ name: 'wo 3 jun', day: NIGHT_STATUS, holiday: undefined as string | undefined }, ...FREE_DAYS])
  for (const profile of PROFILES) for (const route of ['celeditor', 'paneel'] as const) {
    const f = nightFixture(profile, status.holiday);
    f.S().setStatusDate(status.day);
    const ids = f.cases.map(c => c.id);
    for (const c of f.cases) {
      eq(`rapport ${status.name} ${profile} ${route} ${c.name}: afmelden geaccepteerd`,
        enter(f, route, c.id, 'actualFinish', status.day, status.day) !== 'geweigerd', true);
    }
    f.S().runCPM();
    eq(`rapport ${status.name} ${profile} ${route}: geen voortgangsuitzondering bij de mijlpalen`, progressExceptions(f, ids), []);
    eq(`rapport ${status.name} ${profile} ${route}: geen fout bij de mijlpalen`, errorsAt(f, ids), []);
  }
{
  for (const profile of PROFILES) {
    const context = createAppStoreContext();
    const S = () => context.store.getState();
    S().setCalendar(night(S().calendar));
    S().setProject({ startDate: '2026-06-01', schedulingProfile: builtInProfile(profile) });
    const ids = KINDS.map(kind => {
      const at = '2026-06-02T06:00';
      const id = S().addTask({ name: 'Mijlpaal ' + kindName(kind), isMilestone: true, ...(kind ? { milestoneKind: kind } : {}),
        time: { scheduleDuration: 0, scheduleStart: at } as Task['time'] });
      const t = S().tasks.find(x => x.id === id)!;
      S().updateTask(id, { manuallyScheduled: true, time: { ...t.time, scheduleStart: at, scheduleFinish: at, earlyStart: at, earlyFinish: at } });
      return id;
    });
    S().runCPM();
    S().setStatusDate(NIGHT_STATUS);
    for (const id of ids) eq(`rapport ${profile} alleen mijlpalen: afmelden 03-06-2026`, S().setActualFinish(id, '2026-06-03'), true);
    S().runCPM();
    const health = computeScheduleHealth({
      tasks: S().tasks, sequences: S().sequences, resources: S().resources, assignments: S().assignments,
      calendar: S().calendar, calendars: S().calendars, cpmResult: S().cpmResult, baseline: null,
      statusDate: S().project.statusDate, today: '2026-06-10',
    }, HEALTH_OPTS);
    eq(`rapport ${profile} alleen mijlpalen: 0 fouten`, health.totals.errors, 0);
  }
}

{
  const f = fixture('ops');
  const calendar = f.calendar();
  const lone = f.taskOf(f.los['zonder soort']);
  eq('laadgrens: losse mijlpaal zonder soort ⇒ D1 (07:00), niet de geplande 16:00',
    normalizeLoadedActualDate(lone, 'actualFinish', '2026-06-03', undefined, calendar), '2026-06-03T07:00');
  eq('laadgrens: FINISH ⇒ D2 (16:00)',
    normalizeLoadedActualDate(f.taskOf(f.midden.FINISH), 'actualFinish', '2026-06-03', undefined, calendar), '2026-06-03T16:00');
  const read: Task = { ...structuredClone(lone), time: { ...structuredClone(lone.time), completion: 1, actualStart: '2026-06-01T16:00', actualFinish: undefined } };
  normalizeImportedProgress([read], '2026-06-03', undefined, calendar);
  eq('lezer: afgeleid einde volgt D7 (07:00)', read.time.actualFinish, '2026-06-03T07:00');
}

{
  const f = fixture('ops');
  const calendar = f.calendar();
  const base = f.taskOf(f.los['zonder soort']);
  const unplanned: Task = { ...base, time: { ...base.time, earlyStart: '', scheduleStart: '2026-06-01' } };
  eq('geen moment met tijd in de planning ⇒ D1 (07:00)', normalizeActualDate(unplanned, 'actualFinish', '2026-06-03', undefined, calendar), '2026-06-03T07:00');
  const unplannedFinish: Task = { ...unplanned, milestoneKind: 'FINISH' };
  eq('geen moment met tijd, FINISH ⇒ D2 (16:00)', normalizeActualDate(unplannedFinish, 'actualFinish', '2026-06-03', undefined, calendar), '2026-06-03T16:00');
}

type Band = { start: number; end: number };
type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Week = Partial<Record<Weekday, Band[]>>;
const blocks = (...pairs: [number, number][]): Band[] => pairs.map(([start, end]) => ({ start, end }));
const weekOf = (days: Weekday[], day: Band[], extra: Week = {}): Week =>
  ({ ...Object.fromEntries(days.map(d => [d, day])), ...extra });
function weekCalendar(c: WorkCalendar, week: Week, typical: Weekday, holidays: string[] = []): WorkCalendar {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as Record<Weekday, Band[]>;
  for (const [day, list] of Object.entries(week)) byWeekday[Number(day) as Weekday] = list!.map(b => ({ ...b }));
  const workDays = ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).filter(d => byWeekday[d].length > 0);
  const t = byWeekday[typical];
  return {
    ...c, workDays, workStartHour: t[0].start / 60, workEndHour: t[t.length - 1].end / 60,
    hoursPerDay: t.reduce((sum, b) => sum + b.end - b.start, 0) / 60, workTime: { byWeekday },
    holidays: holidays.map(d => ({ name: 'Feestdag', startDate: d, endDate: d })), workingExceptions: [],
  };
}
const DAY = blocks([420, 720], [780, 960]);
const NIGHT = blocks([1320, 1800]);
const MON_THU: Weekday[] = [1, 2, 3, 4];
const ETHAN_WEEK = weekOf(MON_THU, DAY, { 5: blocks([420, 720]) });
const NIGHT_SHORT_FRI_WEEK = weekOf(MON_THU, NIGHT, { 5: blocks([1320, 1560]) });
const ethanCal = (c: WorkCalendar) => weekCalendar(c, ETHAN_WEEK, 1);
const nightShortFri = (c: WorkCalendar) => weekCalendar(c, NIGHT_SHORT_FRI_WEEK, 1);
const solCal = (c: WorkCalendar) => weekCalendar(c, weekOf([2, 3, 4, 5], NIGHT, { 1: blocks([240, 480]) }), 2);
const sol5Cal = (c: WorkCalendar) => weekCalendar(c, weekOf([2, 3, 4, 5], NIGHT, { 1: blocks([360, 600]) }), 2);
const earlyCal = (c: WorkCalendar) => weekCalendar(c, weekOf([2, 3, 4, 5], blocks([420, 960]), { 1: blocks([240, 480]) }), 2);
const holidayNight = (c: WorkCalendar) => weekCalendar(c, weekOf([1, 2, 3, 4, 5], NIGHT), 1, ['2026-06-03']);
const day24ShortFri = (c: WorkCalendar) => weekCalendar(c, weekOf(MON_THU, blocks([0, 1440]), { 5: blocks([0, 720]) }), 1);
const day24Full = (c: WorkCalendar) => weekCalendar(c, weekOf([1, 2, 3, 4, 5], blocks([0, 1440])), 1);
const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const labelOf = (f: Entry, id: string, got: string | undefined) =>
  got && got !== 'geweigerd' ? taskDateLabel(f.taskOf(id), got, 'start', f.calendar()) : got;

function anchorFixture(
  profile: Profile, calendarOf: (c: WorkCalendar) => WorkCalendar, startDate: string,
  anchors: { name: string; kind: MilestoneKind | undefined; at?: string }[],
) {
  const context = createAppStoreContext();
  const S = () => context.store.getState();
  S().setCalendar(calendarOf(S().calendar));
  S().setProject({ startDate, schedulingProfile: builtInProfile(profile) });
  const taskOf = (id: string) => S().tasks.find(t => t.id === id)!;
  const ids = anchors.map(a => {
    const id = S().addTask({ name: a.name, isMilestone: true, ...(a.kind ? { milestoneKind: a.kind } : {}), time: { scheduleDuration: 0 } as Task['time'] });
    if (a.at) {
      const at = a.at;
      S().updateTask(id, { manuallyScheduled: true, time: { ...taskOf(id).time, scheduleStart: at, scheduleFinish: at, earlyStart: at, earlyFinish: at } });
    }
    return id;
  });
  S().runCPM();
  const calendar = () => resolveCalendar(undefined, S().calendars, S().calendar);
  return { context, S, taskOf, calendar, ids };
}

function ethanFixture(profile: Profile, calendarOf: (c: WorkCalendar) => WorkCalendar = ethanCal, laterBegin = false) {
  const f = fixture(profile, calendarOf, laterBegin ? { los: false, taak: false } : {});
  const at14: Record<string, string> = {};
  if (!laterBegin) {
    const inspectie = f.hours('Inspectie 6 u', 6);
    for (const kind of KINDS) {
      const m = f.milestone('Keuring 14:00 ' + kindName(kind), kind);
      f.fs(inspectie, m);
      at14[kindName(kind)] = m;
    }
  }
  const startBouw2 = laterBegin ? f.milestone('Start bouw 2', 'START') : '';
  if (laterBegin) f.fs(startBouw2, f.hours('Grondwerk 2', 8));
  f.S().setStatusDate(undefined);
  f.S().runCPM();
  f.S().setStatusDate(STATUS);
  return { ...f, at14, startBouw2 };
}
for (const profile of PROFILES) {
  const f = ethanFixture(profile);
  const planned = (id: string) => f.taskOf(id).time.earlyStart;
  eq(`Ethan ${profile} voorwaarde: Oplevering gepland ma 1 jun 16:00`, planned(f.oplevering), '2026-06-01T16:00');
  eq(`Ethan ${profile} voorwaarde: de tabel toont 01-06-2026`, labelOf(f, f.oplevering, planned(f.oplevering)), '2026-06-01');
  eq(`Ethan ${profile} voorwaarde: Start bouw gepland ma 07:00`, planned(f.startBouw), '2026-06-01T07:00');
  for (const kind of KINDS) {
    eq(`Ethan ${profile} voorwaarde: Keuring ${kindName(kind)} 10:00`, planned(f.midden[kindName(kind)]), '2026-06-01T10:00');
    eq(`Ethan ${profile} voorwaarde: Keuring 14:00 ${kindName(kind)}`, planned(f.at14[kindName(kind)]), '2026-06-01T14:00');
  }
}
for (const profile of PROFILES) for (const route of ROUTES) for (const field of FIELDS) {
  const tag = `Ethan ${profile} ${route} ${field}`;
  const f = ethanFixture(profile);
  const planned = Object.fromEntries(Object.values(f.los).map(id => [id, f.taskOf(id).time.earlyStart]));
  f.S().setStatusDate('2026-06-04');
  eq(`${tag}: statusdatum do 4 jun ⇒ Oplevering op vr geweigerd`, enter(f, route, f.oplevering, field, '2026-06-05', '2026-06-04'), 'geweigerd');
  eq(`${tag}: statusdatum do 4 jun ⇒ Keuring 14:00 op vr geweigerd`, enter(f, route, f.at14.FINISH, field, '2026-06-05', '2026-06-04'), 'geweigerd');
  eq(`${tag}: na de weigering nog gepland ma 16:00`, shownStart(f.taskOf(f.oplevering)), '2026-06-01T16:00');
  f.S().setStatusDate(STATUS);
  const got = enter(f, route, f.oplevering, field, '2026-06-05');
  eq(`${tag}: Oplevering (ma 16:00) afgemeld op vr 5 jun ⇒ vr 12:00`, got, '2026-06-05T12:00');
  eq(`${tag}: de tabel toont alleen de datum, 05-06-2026`, labelOf(f, f.oplevering, got), '2026-06-05');
  const start = enter(f, route, f.startBouw, field, '2026-06-05');
  eq(`${tag}: Start bouw (ma 07:00) ⇒ vr 07:00, het begin van vr`, [start, labelOf(f, f.startBouw, start)], ['2026-06-05T07:00', '2026-06-05']);
  for (const kind of KINDS) {
    const mid = enter(f, route, f.midden[kindName(kind)], field, '2026-06-05');
    eq(`${tag}: Keuring ${kindName(kind)} (ma 10:00) ⇒ vr 10:00, de geplande kloktijd`, mid, '2026-06-05T10:00');
    const lateId = f.at14[kindName(kind)];
    const late = enter(f, route, lateId, field, '2026-06-05');
    eq(`${tag}: Keuring 14:00 ${kindName(kind)} ⇒ vr 12:00, het einde van de vrijdagdienst`, [late, labelOf(f, lateId, late)], ['2026-06-05T12:00', '2026-06-05']);
    if (route !== 'MCP' && route !== 'functie') eq(`${tag}: de cel ${field} van Keuring 14:00 ${kindName(kind)} toont 05-06-2026`, cellText(f, lateId, `task.time.${field}`), '05-06-2026');
    const id = f.los[kindName(kind)];
    const lone = enter(f, route, id, field, '2026-06-05');
    const want = planned[id] === '2026-06-01T16:00' ? '2026-06-05T12:00' : '2026-06-05T07:00';
    eq(`${tag}: Los ${kindName(kind)} (${clockOf(planned[id])}) ⇒ ${clockOf(want)}`, [lone, labelOf(f, id, lone)], [want, '2026-06-05']);
  }
  eq(`${tag}: gewone taak houdt ${field === 'actualStart' ? 'D1 (07:00)' : 'D2 (12:00)'}`,
    enter(f, route, f.taak, field, '2026-06-05'), field === 'actualStart' ? '2026-06-05T07:00' : '2026-06-05T12:00');
}

for (const profile of PROFILES) {
  const f = nightFixture(profile, undefined, nightShortFri);
  for (const c of f.cases) {
    eq(`nacht vr ${profile} voorwaarde: ${c.name} gepland di 2 jun 06:00`, shownStart(f.taskOf(c.id)), '2026-06-02T06:00');
    eq(`nacht vr ${profile} voorwaarde: ${c.name} toont 01-06-2026`, labelOf(f, c.id, shownStart(f.taskOf(c.id))), '2026-06-01');
  }
}
for (const profile of PROFILES) for (const route of ROUTES) {
  const f = nightFieldsFixture(profile, undefined, nightShortFri);
  f.S().setStatusDate('2026-06-04');
  for (const c of f.cases) {
    const tag = `nacht vr ${profile} ${route} ${c.field} ${c.name}`;
    eq(`${tag}: voorwaarde: gepland di 2 jun 06:00`, shownStart(f.taskOf(c.id)), '2026-06-02T06:00');
    eq(`${tag}: statusdatum do ⇒ geweigerd`, enter(f, route, c.id, c.field, '2026-06-05', '2026-06-04'), 'geweigerd');
  }
  f.S().setStatusDate('2026-06-05');
  for (const c of f.cases) {
    const field = c.field;
    const tag = `nacht vr ${profile} ${route} ${field} ${c.name}`;
    const got = enter(f, route, c.id, field, '2026-06-05', '2026-06-05');
    eq(`${tag}: statusdatum vr, afgemeld op vr ⇒ za 02:00, het einde van de vrijdagdienst`, got, '2026-06-06T02:00');
    eq(`${tag}: de tabel toont 05-06-2026`, labelOf(f, c.id, got), '2026-06-05');
  }
}

for (const profile of PROFILES) for (const route of ROUTES) for (const field of FIELDS) {
  const f = anchorFixture(profile, nightShortFri, '2026-06-05', KINDS.map(kind => ({ name: 'Los ' + kindName(kind), kind })));
  f.S().setStatusDate('2026-06-06');
  for (const [i, kind] of KINDS.entries()) {
    const id = f.ids[i];
    const tag = `automatisch ${profile} ${route} ${field} ${kindName(kind)}`;
    const end = profile === 'ops' || kind === 'FINISH';
    eq(`${tag}: voorwaarde: berekend op ${end ? 'za 02:00' : 'vr 22:00'}`, shownStart(f.taskOf(id)), end ? '2026-06-06T02:00' : '2026-06-05T22:00');
    eq(`${tag}: voorwaarde: de tabel toont vr`, labelOf(f, id, shownStart(f.taskOf(id))), '2026-06-05');
    const got = enter(f, route, id, field, '2026-06-06', '2026-06-06');
    eq(`${tag}: 06-06-2026 op de statusdag ⇒ ${end ? 'zo 06:00' : 'za 22:00'}`, got, end ? '2026-06-07T06:00' : '2026-06-06T22:00');
    eq(`${tag}: de tabel toont 06-06-2026`, labelOf(f, id, got), '2026-06-06');
  }
}

const CASES_R3 = [
  { name: 'A', planned: '2026-06-06T02:00', typed: '2026-06-06', status: '2026-06-06', want: '2026-06-07T06:00', label: '2026-06-06' },
  { name: 'A-', planned: '2026-06-06T02:00', typed: '2026-06-06', status: '2026-06-05', want: 'geweigerd', label: 'geweigerd' },
  { name: 'B', planned: '2026-06-02T06:00', typed: '2026-06-05', status: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05' },
  { name: 'B-', planned: '2026-06-02T06:00', typed: '2026-06-05', status: '2026-06-04', want: 'geweigerd', label: 'geweigerd' },
  { name: 'C', planned: '2026-06-06T02:00', typed: '2026-06-08', status: '2026-06-08', want: '2026-06-09T06:00', label: '2026-06-08' },
  { name: 'D', planned: '2026-06-02T02:00', typed: '2026-06-03', status: '2026-06-03', want: '2026-06-04T02:00', label: '2026-06-04T02:00' },
  { name: 'D-', planned: '2026-06-02T02:00', typed: '2026-06-03', status: '2026-06-02', want: 'geweigerd', label: 'geweigerd' },
  { name: 'M1', planned: '2026-06-02T06:00', typed: '2026-06-06T02:00', status: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05' },
  { name: 'M2', planned: '2026-06-02T06:00', typed: '2026-06-06T02:01', status: '2026-06-05', want: 'geweigerd', label: 'geweigerd' },
] as const;
for (const profile of PROFILES) for (const route of ROUTES) {
  const anchors = CASES_R3.flatMap(c => KINDS.map(kind => ({ name: `${c.name} ${kindName(kind)}`, kind, at: c.planned })));
  const f = anchorFixture(profile, nightShortFri, '2026-06-01', anchors);
  CASES_R3.forEach((c, ci) => KINDS.forEach((kind, ki) => {
    const id = f.ids[ci * KINDS.length + ki];
    const field = FIELDS[(ci + ki) % 2];
    const tag = `geval ${c.name} ${profile} ${route} ${field} ${kindName(kind)}`;
    eq(`${tag}: voorwaarde: gepland ${c.planned}`, shownStart(f.taskOf(id)), c.planned);
    f.S().setStatusDate(c.status);
    const got = enter(f, route, id, field, c.typed, c.status);
    eq(`${tag}: ${c.typed} met statusdatum ${c.status}`, got, c.want);
    eq(`${tag}: de tabel`, labelOf(f, id, got), c.label);
  }));
}

const laterFri = (c: WorkCalendar) => weekCalendar(c, weekOf(MON_THU, DAY, { 5: blocks([540, 780]) }), 1);
for (const profile of PROFILES) for (const route of ROUTES) {
  const f = ethanFixture(profile, laterFri, true);
  for (const field of FIELDS) {
    const tag = `later begin ${profile} ${route} ${field}`;
    const startId = field === 'actualStart' ? f.startBouw : f.startBouw2;
    eq(`${tag}: voorwaarde: START op ma 07:00`, shownStart(f.taskOf(startId)), '2026-06-01T07:00');
    const start = enter(f, route, startId, field, '2026-06-05');
    eq(`${tag}: START (ma 07:00, het begin) ⇒ vr 09:00, het begin van vr`, [start, labelOf(f, startId, start)], ['2026-06-05T09:00', '2026-06-05']);
  }
  const end = enter(f, route, f.oplevering, 'actualFinish', '2026-06-05');
  eq(`later begin ${profile} ${route}: Oplevering (ma 16:00) ⇒ vr 13:00, het einde van vr`, [end, labelOf(f, f.oplevering, end)], ['2026-06-05T13:00', '2026-06-05']);
  eq(`later begin ${profile} ${route}: Keuring FINISH (ma 10:00) ⇒ vr 10:00`, enter(f, route, f.midden.FINISH, 'actualStart', '2026-06-05'), '2026-06-05T10:00');
}

{
  const satShift = (c: WorkCalendar) => weekCalendar(c, weekOf(MON_THU, NIGHT, { 5: blocks([1320, 1560]), 6: blocks([240, 720]) }), 1);
  const SPECIAL = [
    { name: 'uitwerking: za-dienst', cal: satShift, kind: undefined, planned: '2026-06-02T05:00', typed: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05' },
    { name: 'uitwerking: za-dienst FINISH', cal: satShift, kind: 'FINISH' as const, planned: '2026-06-02T05:00', typed: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05' },
    { name: 'aanvulling 450: de vrijdagdienst eindigt vóór 05:00', cal: nightShortFri, kind: undefined, planned: '2026-06-02T05:00', typed: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05' },
    { name: 'aanvulling 450: de vrijdagdienst eindigt vóór 05:00, START', cal: nightShortFri, kind: 'START' as const, planned: '2026-06-02T05:00', typed: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05' },
    { name: 'knownbug 501: START op het einde van een 24-uursvrijdag', cal: day24ShortFri, kind: 'START' as const, planned: '2026-06-05T12:00', typed: '2026-06-08', want: '2026-06-08T00:00', label: '2026-06-08' },
    { name: 'knownbug 501: FINISH houdt het einde', cal: day24ShortFri, kind: 'FINISH' as const, planned: '2026-06-05T12:00', typed: '2026-06-08', want: '2026-06-09T00:00', label: '2026-06-08' },
  ];
  const groups = [...new Set(SPECIAL.map(c => c.cal))].map(cal => SPECIAL.flatMap((c, ci) => c.cal === cal ? [{ c, ci }] : []));
  for (const profile of PROFILES) for (const [ri, route] of ROUTES.entries()) for (const group of groups) {
    const f = anchorFixture(profile, group[0].c.cal, '2026-06-01', group.map(({ c }) => ({ name: c.name, kind: c.kind, at: c.planned })));
    f.S().setStatusDate(group[0].c.typed);
    group.forEach(({ c, ci }, gi) => {
      const field = FIELDS[(ri + ci) % 2];
      const id = f.ids[gi];
      const tag = `${c.name} ${profile} ${route} ${field}`;
      eq(`${tag}: voorwaarde: gepland ${c.planned}`, shownStart(f.taskOf(id)), c.planned);
      eq(`${tag}: voorwaarde: dezelfde getypte dag in de groep`, c.typed, group[0].c.typed);
      const got = enter(f, route, id, field, c.typed, c.typed);
      eq(`${tag}: ${c.typed} op de statusdag ⇒ ${c.want}`, [got, labelOf(f, id, got)], [c.want, c.label]);
    });
  }
}

{
  const c48 = weekCalendar(createAppStoreContext().store.getState().calendar, { 1: blocks([1320, 2880]) }, 1);
  const clock = calendarClock(c48);
  eq('48 u: ma 00:00 is het einde van za', [milestoneWorkdayOf(clock, '2026-06-08T00:00', 'end'), workdayEdgeAt(clock, '2026-06-06', '2026-06-08T00:00')], ['2026-06-06', 'end']);
  eq('48 u: zo 23:59 is geen rand van za', workdayEdgeAt(clock, '2026-06-06', '2026-06-07T23:59'), null);
  eq('48 u: ma 00:01 is geen rand van za', workdayEdgeAt(clock, '2026-06-06', '2026-06-08T00:01'), null);
  eq('kalendertijd geen D4: zo 06:00 is zo, geen rand van za',
    [milestoneWorkdayOf(ELAPSED_CLOCK, '2026-06-07T06:00', 'end'), workdayEdgeAt(ELAPSED_CLOCK, '2026-06-06', '2026-06-07T06:00')], ['2026-06-07', null]);
}

const FIXED_CALS = {
  sol: solCal, nacht: nightShortFri, dag: ethanCal, '24u': day24ShortFri, '24u vol': day24Full,
  sol5: sol5Cal, vroeg: earlyCal, feestdag: holidayNight,
} as const;
type FixedCal = keyof typeof FIXED_CALS;
const fixedCalendar = Object.fromEntries(Object.entries(FIXED_CALS)
  .map(([name, of]) => [name, of(createAppStoreContext().store.getState().calendar)])) as Record<FixedCal, WorkCalendar>;
const FIXED_EDGES: [FixedCal, string, string, string][] = [
  ['sol', '2026-05-31', '2026-05-31T22:00', '2026-06-01T06:00'],
  ['sol', '2026-06-01', '2026-06-01T04:00', '2026-06-01T08:00'],
  ['sol', '2026-06-02', '2026-06-02T22:00', '2026-06-03T06:00'],
  ['sol', '2026-06-07', '2026-06-07T22:00', '2026-06-08T06:00'],
  ['nacht', '2026-06-05', '2026-06-05T22:00', '2026-06-06T02:00'],
  ['nacht', '2026-06-06', '2026-06-06T22:00', '2026-06-07T06:00'],
  ['dag', '2026-06-05', '2026-06-05T07:00', '2026-06-05T12:00'],
  ['dag', '2026-06-06', '2026-06-06T07:00', '2026-06-06T16:00'],
  ['24u', '2026-06-05', '2026-06-05T00:00', '2026-06-05T12:00'],
  ['24u', '2026-06-06', '2026-06-06T00:00', '2026-06-07T00:00'],
  ['24u vol', '2026-06-05', '2026-06-05T00:00', '2026-06-06T00:00'],
  ['24u vol', '2026-06-06', '2026-06-06T00:00', '2026-06-07T00:00'],
  ['sol5', '2026-05-31', '2026-05-31T22:00', '2026-06-01T06:00'],
  ['sol5', '2026-06-01', '2026-06-01T06:00', '2026-06-01T10:00'],
  ['vroeg', '2026-06-01', '2026-06-01T04:00', '2026-06-01T08:00'],
  ['vroeg', '2026-06-02', '2026-06-02T07:00', '2026-06-02T16:00'],
  ['feestdag', '2026-06-03', '2026-06-03T22:00', '2026-06-04T06:00'],
];
for (const [cal, date, start, end] of FIXED_EDGES) {
  const clock = calendarClock(fixedCalendar[cal]);
  eq(`vast ${cal}: dagranden van ${date}`, [dayStartInstant(clock, date), dayEndInstant(clock, date)], [start, end]);
}
interface FixedCase { cal: FixedCal; side: 'start' | 'end'; planned: string; plannedLabel: string; typed: string; want: string; label: string; why: string }
const FIXED: FixedCase[] = [
  { cal: 'sol', side: 'start', planned: '2026-06-01T06:00', plannedLabel: '2026-06-01T06:00', typed: '2026-06-02', want: '2026-06-02T22:00', label: '2026-06-02', why: 'midden in de echte maandagdienst, niet het D4-einde van zo; de dienst van di begint pas om 22:00, na 06:00 ⇒ het begin van die dienst (uitwerking door de orkestrator, fixronde 5)' },
  { cal: 'sol', side: 'end', planned: '2026-06-01T06:00', plannedLabel: '2026-06-01T06:00', typed: '2026-06-02', want: '2026-06-02T22:00', label: '2026-06-02', why: 'idem, FINISH' },
  { cal: 'sol', side: 'end', planned: '2026-06-01T06:00', plannedLabel: '2026-06-01T06:00', typed: '2026-06-08', want: '2026-06-08T06:00', label: '2026-06-08T06:00', why: 'de kloktijd ligt midden in de dienst van de getypte ma' },
  { cal: 'sol', side: 'end', planned: '2026-06-01T08:00', plannedLabel: '2026-06-01', typed: '2026-06-02', want: '2026-06-03T06:00', label: '2026-06-02', why: 'einde van ma ⇒ einde van di' },
  { cal: 'sol', side: 'start', planned: '2026-06-01T08:00', plannedLabel: '2026-06-01', typed: '2026-06-07', want: '2026-06-07T22:00', label: '2026-06-07', why: 'einde van ma op de vrije zo: het D4-einde (ma 06:00) ligt midden in echte werktijd, dus het begin van zo' },
  { cal: 'sol', side: 'start', planned: '2026-06-01T04:00', plannedLabel: '2026-06-01', typed: '2026-06-02', want: '2026-06-02T22:00', label: '2026-06-02', why: 'begin van ma ⇒ begin van di' },
  { cal: 'sol', side: 'start', planned: '2026-06-03T02:00', plannedLabel: '2026-06-03T02:00', typed: '2026-06-08', want: '2026-06-08T08:00', label: '2026-06-08', why: 'midden in de nacht van di; dezelfde afstand op ma 8 jun is di 9 jun 02:00, na het einde van de maandagdienst (08:00) ⇒ het einde van die dienst (tweede aanvulling van Ethan)' },
  { cal: 'sol', side: 'end', planned: '2026-06-03T02:00', plannedLabel: '2026-06-03T02:00', typed: '2026-06-03', want: '2026-06-04T02:00', label: '2026-06-04T02:00', why: 'midden in de nacht van di ⇒ midden in de nacht van wo (knownbug 499)' },
  { cal: 'nacht', side: 'start', planned: '2026-06-02T06:00', plannedLabel: '2026-06-01', typed: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05', why: 'het nachtvoorbeeld: einde van de dienst ⇒ einde van de vrijdagdienst' },
  { cal: 'nacht', side: 'end', planned: '2026-06-02T06:00', plannedLabel: '2026-06-01', typed: '2026-06-06', want: '2026-06-07T06:00', label: '2026-06-06', why: 'einde ⇒ D4-einde van de vrije za' },
  { cal: 'nacht', side: 'start', planned: '2026-06-06T02:00', plannedLabel: '2026-06-05', typed: '2026-06-08', want: '2026-06-09T06:00', label: '2026-06-08', why: 'einde van de korte vr ⇒ einde van ma' },
  { cal: 'nacht', side: 'end', planned: '2026-06-01T22:00', plannedLabel: '2026-06-01', typed: '2026-06-05', want: '2026-06-05T22:00', label: '2026-06-05', why: 'begin ⇒ begin' },
  { cal: 'nacht', side: 'start', planned: '2026-06-02T05:00', plannedLabel: '2026-06-02T05:00', typed: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05', why: 'aanvulling van Ethan: de vrijdagdienst eindigt vóór 05:00 ⇒ het einde van die dienst (voorheen knownbug 450, geval 1)' },
  { cal: 'nacht', side: 'end', planned: '2026-06-02T05:00', plannedLabel: '2026-06-02T05:00', typed: '2026-06-03', want: '2026-06-04T05:00', label: '2026-06-04T05:00', why: 'midden in de nacht ⇒ dezelfde afstand' },
  { cal: 'dag', side: 'end', planned: '2026-06-01T16:00', plannedLabel: '2026-06-01', typed: '2026-06-05', want: '2026-06-05T12:00', label: '2026-06-05', why: 'het voorbeeld van Ethan' },
  { cal: 'dag', side: 'start', planned: '2026-06-01T16:00', plannedLabel: '2026-06-01', typed: '2026-06-06', want: '2026-06-06T16:00', label: '2026-06-06', why: 'einde ⇒ D4-einde van de vrije za' },
  { cal: 'dag', side: 'start', planned: '2026-06-01T07:00', plannedLabel: '2026-06-01', typed: '2026-06-05', want: '2026-06-05T07:00', label: '2026-06-05', why: 'begin ⇒ begin' },
  { cal: 'dag', side: 'end', planned: '2026-06-01T14:00', plannedLabel: '2026-06-01T14:00', typed: '2026-06-05', want: '2026-06-05T12:00', label: '2026-06-05', why: 'tweede aanvulling van Ethan, overdag: de vrijdagdienst eindigt om 12:00, vóór 14:00 ⇒ het einde van die dienst (de opstelling van Sol, review ronde 5)' },
  { cal: 'dag', side: 'start', planned: '2026-06-01T14:00', plannedLabel: '2026-06-01T14:00', typed: '2026-06-05', want: '2026-06-05T12:00', label: '2026-06-05', why: 'idem, startkant' },
  { cal: 'dag', side: 'start', planned: '2026-06-01T18:00', plannedLabel: '2026-06-01T18:00', typed: '2026-06-05', want: '2026-06-05T12:00', label: '2026-06-05', why: 'besluit van Ethan, 2 november 2026 (knownbug 503): buiten de werkspanne van ma (een handmatig anker), na de dienst ⇒ het einde van de dienst van de getypte dag (het voorbeeld van Ethan)' },
  { cal: 'dag', side: 'end', planned: '2026-06-01T05:00', plannedLabel: '2026-06-01T05:00', typed: '2026-06-05', want: '2026-06-05T07:00', label: '2026-06-05', why: 'besluit van Ethan, 2 november 2026 (knownbug 503): vóór de werkspanne van ma ⇒ het begin van de dienst van de getypte dag (het voorbeeld van Ethan)' },
  { cal: 'dag', side: 'start', planned: '2026-06-01T10:00', plannedLabel: '2026-06-01T10:00', typed: '2026-06-03', want: '2026-06-03T10:00', label: '2026-06-03T10:00', why: 'binnen de dienst en de dienst van de getypte dag omvat die kloktijd ⇒ dezelfde kloktijd (B10); 503 en 504 raken dit niet' },
  { cal: 'dag', side: 'start', planned: '2026-06-01T12:30', plannedLabel: '2026-06-01T12:30', typed: '2026-06-02', want: '2026-06-02T12:30', label: '2026-06-02T12:30', why: 'in de pauze ⇒ dezelfde kloktijd' },
  { cal: '24u', side: 'end', planned: '2026-06-02T00:00', plannedLabel: '2026-06-01', typed: '2026-06-03', want: '2026-06-04T00:00', label: '2026-06-03', why: 'gedeelde rand, FINISH: einde van ma ⇒ einde van wo' },
  { cal: '24u', side: 'start', planned: '2026-06-02T00:00', plannedLabel: '2026-06-02', typed: '2026-06-03', want: '2026-06-03T00:00', label: '2026-06-03', why: 'gedeelde rand, START: begin van di ⇒ begin van wo' },
  { cal: '24u', side: 'end', planned: '2026-06-05T12:00', plannedLabel: '2026-06-05', typed: '2026-06-08', want: '2026-06-09T00:00', label: '2026-06-08', why: 'einde van vr ⇒ einde van ma' },
  { cal: '24u', side: 'start', planned: '2026-06-05T12:00', plannedLabel: '2026-06-05', typed: '2026-06-08', want: '2026-06-08T00:00', label: '2026-06-08', why: 'het einde van ma leest START als di ⇒ het begin van ma (knownbug 501, ook zo op main)' },
  { cal: '24u', side: 'start', planned: '2026-06-01T10:00', plannedLabel: '2026-06-01T10:00', typed: '2026-06-05', want: '2026-06-05T10:00', label: '2026-06-05T10:00', why: 'midden op de dag' },
  { cal: '24u vol', side: 'start', planned: '2026-06-01T00:00', plannedLabel: '2026-06-01', typed: '2026-06-06', want: '2026-06-06T00:00', label: '2026-06-06', why: 'START op za 00:00 is het begin van de vrije za (D4), niet het einde van vr' },
  { cal: '24u vol', side: 'end', planned: '2026-06-01T00:00', plannedLabel: '2026-05-31', typed: '2026-06-03', want: '2026-06-04T00:00', label: '2026-06-03', why: 'FINISH op ma 00:00 is het D4-einde van zo, zoals op main; einde ⇒ einde van wo' },
  { cal: 'sol5', side: 'end', planned: '2026-06-01T06:00', plannedLabel: '2026-06-01', typed: '2026-06-08', want: '2026-06-08T06:00', label: '2026-06-08', why: 'FINISH op het echte begin van ma, niet op het D4-einde van zo (review ronde 5); begin ⇒ begin' },
  { cal: 'sol5', side: 'start', planned: '2026-06-01T06:00', plannedLabel: '2026-06-01', typed: '2026-06-02', want: '2026-06-02T22:00', label: '2026-06-02', why: 'begin van ma ⇒ begin van di' },
  { cal: 'vroeg', side: 'start', planned: '2026-06-01T06:00', plannedLabel: '2026-06-01T06:00', typed: '2026-06-02', want: '2026-06-02T07:00', label: '2026-06-02', why: 'het voorbeeld van de orkestrator (fixronde 5): de dienst van di begint om 07:00, na 06:00 ⇒ het begin van die dienst' },
  { cal: 'vroeg', side: 'end', planned: '2026-06-01T06:00', plannedLabel: '2026-06-01T06:00', typed: '2026-06-02', want: '2026-06-02T07:00', label: '2026-06-02', why: 'idem, FINISH' },
  { cal: 'vroeg', side: 'end', planned: '2026-06-02T15:00', plannedLabel: '2026-06-02T15:00', typed: '2026-06-08', want: '2026-06-08T08:00', label: '2026-06-08', why: 'tweede aanvulling van Ethan, overdag: de dienst van ma eindigt om 08:00, vóór 15:00 ⇒ het einde van die dienst' },
  { cal: 'feestdag', side: 'start', planned: '2026-06-02T06:00', plannedLabel: '2026-06-01', typed: '2026-06-03', want: '2026-06-04T06:00', label: '2026-06-03', why: 'einde van de nacht van ma ⇒ het D4-einde van de feestdag wo (fixronde 2)' },
];
const FIXED_LITERAL: { cal: FixedCal; side: 'start' | 'end'; value: string; status: string; want: 'mag' | 'geweigerd'; label?: string; why: string }[] = [
  { cal: 'sol', side: 'start', value: '2026-06-01T06:00', status: '2026-05-31', want: 'geweigerd', why: 'ma 06:00 is ma, niet het D4-einde van de vrije zo' },
  { cal: 'sol', side: 'end', value: '2026-06-01T06:00', status: '2026-05-31', want: 'geweigerd', why: 'idem, FINISH' },
  { cal: 'sol', side: 'end', value: '2026-06-01T06:00', status: '2026-06-01', want: 'mag', why: 'op de statusdag ma' },
  { cal: 'sol', side: 'start', value: '2026-06-03T06:00', status: '2026-06-02', want: 'mag', why: 'het einde van de nacht van di' },
  { cal: 'sol', side: 'start', value: '2026-06-03T06:01', status: '2026-06-02', want: 'geweigerd', why: 'één minuut na het einde van di' },
  { cal: 'nacht', side: 'start', value: '2026-06-06T02:00', status: '2026-06-05', want: 'mag', why: 'het einde van de korte vr' },
  { cal: 'nacht', side: 'end', value: '2026-06-06T02:01', status: '2026-06-05', want: 'geweigerd', why: 'één minuut na het einde van vr' },
  { cal: 'dag', side: 'end', value: '2026-06-06T00:00', status: '2026-06-05', want: 'mag', why: '24:00-regel: FINISH om za 00:00 is vr' },
  { cal: 'dag', side: 'start', value: '2026-06-06T00:00', status: '2026-06-05', want: 'geweigerd', why: 'START om za 00:00 is za' },
  { cal: '24u', side: 'start', value: '2026-06-02T00:00', status: '2026-06-01', want: 'geweigerd', why: 'gedeelde rand: START leest di' },
  { cal: '24u', side: 'end', value: '2026-06-02T00:00', status: '2026-06-01', want: 'mag', why: 'gedeelde rand: FINISH leest ma' },
  { cal: '24u vol', side: 'start', value: '2026-06-06T00:00', status: '2026-06-05', want: 'geweigerd', label: '2026-06-06', why: 'START op za 00:00 is za (D4), zoals op main' },
  { cal: '24u vol', side: 'end', value: '2026-06-06T00:00', status: '2026-06-05', want: 'mag', label: '2026-06-05', why: 'FINISH op za 00:00 is het einde van de echte vr, zoals op main: hier beslist de soort' },
  { cal: '24u vol', side: 'end', value: '2026-06-01T00:00', status: '2026-05-31', want: 'mag', why: 'FINISH op ma 00:00 is zo (D4), zoals op main' },
  { cal: 'sol5', side: 'end', value: '2026-06-01T06:00', status: '2026-05-31', want: 'geweigerd', label: '2026-06-01', why: 'FINISH op ma 06:00 is het echte begin van ma, niet het D4-einde van zo' },
  { cal: 'sol5', side: 'start', value: '2026-06-01T06:00', status: '2026-05-31', want: 'geweigerd', label: '2026-06-01', why: 'idem, startkant' },
  { cal: 'sol5', side: 'end', value: '2026-06-01T06:00', status: '2026-06-01', want: 'mag', why: 'op de statusdag ma' },
  { cal: 'nacht', side: 'start', value: '2026-06-02T06:00', status: '2026-06-01', want: 'mag', label: '2026-06-01', why: 'verschil met main: het echte einde van de nacht van ma is ma, ook aan de startkant; de tabel toont ma, ook op main, maar main weigerde (fixronde 1, knownbug 445)' },
  { cal: 'nacht', side: 'start', value: '2026-06-07T06:00', status: '2026-06-06', want: 'mag', label: '2026-06-06', why: 'verschil met main: het D4-einde van de vrije za is za; main toonde "07-06-2026 06:00" en weigerde (B10, fixronde 2)' },
  { cal: 'nacht', side: 'end', value: '2026-06-07T06:00', status: '2026-06-06', want: 'mag', label: '2026-06-06', why: 'idem, FINISH' },
  { cal: 'feestdag', side: 'end', value: '2026-06-04T06:00', status: '2026-06-03', want: 'mag', label: '2026-06-03', why: 'verschil met main: het D4-einde van de feestdag wo is wo; main toonde "04-06-2026 06:00" en weigerde (B10, fixronde 2)' },
  { cal: 'feestdag', side: 'end', value: '2026-06-04T06:00', status: '2026-06-02', want: 'geweigerd', why: 'de dag vóór de feestdag' },
  { cal: 'nacht', side: 'start', value: '2026-06-07T01:00', status: '2026-06-06', want: 'mag', label: '2026-06-07T01:00', why: 'verschil met main: binnen de D4-nacht van de vrije za, na middernacht; de tabel toont het moment, ook op main, maar main las zo (B10: afmelden op een vrije statusdag mag)' },
  { cal: 'nacht', side: 'end', value: '2026-06-07T01:00', status: '2026-06-06', want: 'mag', label: '2026-06-07T01:00', why: 'idem, FINISH' },
  { cal: 'sol5', side: 'start', value: '2026-06-01T05:00', status: '2026-05-31', want: 'mag', label: '2026-06-01T05:00', why: 'verschil met main: binnen de D4-nacht van de vrije zo, vóór het echte begin van ma om 06:00; main las ma' },
  { cal: '24u', side: 'end', value: '2026-06-06T00:00', status: '2026-06-05', want: 'geweigerd', label: '2026-06-06', why: 'verschil met main: FINISH op za 00:00 ligt buiten de korte vr (00:00–12:00) en is het begin van de vrije za (D4); de tabel toont za, ook op main, maar main las vr' },
  { cal: '24u', side: 'end', value: '2026-06-06T00:00', status: '2026-06-06', want: 'mag', why: 'op de statusdag za' },
];
const milestoneTemplates = (() => {
  const context = createAppStoreContext();
  const S = () => context.store.getState();
  return KINDS.map(kind => {
    const id = S().addTask({ name: 'Vast ' + kindName(kind), isMilestone: true, ...(kind ? { milestoneKind: kind } : {}), time: { scheduleDuration: 0 } as Task['time'] });
    return S().tasks.find(t => t.id === id)!;
  });
})();
const plannedAt = (template: Task, at: string): Task => ({
  ...template, time: { ...template.time, scheduleStart: at, scheduleFinish: at, earlyStart: at, earlyFinish: at, actualStart: undefined, actualFinish: undefined },
});
const helperTask = (side: 'start' | 'end', at: string) => plannedAt(milestoneTemplates[side === 'end' ? 2 : 0], at);
for (const c of FIXED) {
  const cal = fixedCalendar[c.cal];
  const task = helperTask(c.side, c.planned);
  const tag = `vast ${c.cal} ${c.side === 'end' ? 'FINISH' : 'zonder soort'} gepland ${c.planned}, getypt ${c.typed} (${c.why})`;
  eq(`${tag}: de tabel bij de planning`, taskDateLabel(task, c.planned, 'start', cal), c.plannedLabel);
  const got = normalizeActualDate(task, 'actualFinish', c.typed, c.typed, cal);
  eq(`${tag}: moment`, got, c.want);
  eq(`${tag}: de tabel`, got ? taskDateLabel(task, got, 'start', cal) : got, c.label);
  for (const [status, want] of [[shiftDate(c.typed, -1), 'geweigerd'], [c.typed, 'mag']] as const) {
    eq(`${tag}: statusdatum ${status}`, got && isTaskActualPastStatusDate(task, 'actualFinish', got, status, cal) ? 'geweigerd' : 'mag', want);
  }
}
for (const c of FIXED_LITERAL) {
  const task = helperTask(c.side, '2026-06-01T12:00');
  const tag = `vast ${c.cal} ${c.side === 'end' ? 'FINISH' : 'zonder soort'}: letterlijk ${c.value}`;
  eq(`${tag}, statusdatum ${c.status} (${c.why})`,
    isTaskActualPastStatusDate(task, 'actualFinish', c.value, c.status, fixedCalendar[c.cal]) ? 'geweigerd' : 'mag', c.want);
  if (c.label) eq(`${tag}: de tabel`, taskDateLabel(task, c.value, 'start', fixedCalendar[c.cal]), c.label);
}
const FIXED_ROUTES: Route[] = ['celeditor', 'paneel', 'dialoog', 'MCP', 'voortgangsimport'];
let fixedRouteCases = 0;
for (const [ci, name] of (Object.keys(FIXED_CALS) as FixedCal[]).entries()) {
  const combos = FIXED.filter(c => c.cal === name).flatMap(c => (c.side === 'end' ? ['FINISH' as const] : [undefined, 'START' as const])
    .flatMap(kind => [c.typed, shiftDate(c.typed, -1)].map(status => ({ c, kind, status }))));
  for (const [ri, route] of FIXED_ROUTES.entries()) {
    const profile = PROFILES[(ci + ri) % PROFILES.length];
    const f = anchorFixture(profile, FIXED_CALS[name], '2026-06-01', combos.map((x, i) => ({ name: `V${i}`, kind: x.kind, at: x.c.planned })));
    combos.forEach((x, i) => {
      const id = f.ids[i];
      const field = FIELDS[i % 2];
      const tag = `vast route ${name} ${profile} ${route} ${field} ${kindName(x.kind)} gepland ${x.c.planned}, getypt ${x.c.typed}, status ${x.status}`;
      eq(`${tag}: voorwaarde`, shownStart(f.taskOf(id)), x.c.planned);
      fixedRouteCases++;
      f.S().setStatusDate(x.status);
      const got = enter(f, route, id, field, x.c.typed, x.status);
      eq(tag, got, x.status < x.c.typed ? 'geweigerd' : x.c.want);
      if (x.status === x.c.typed) eq(`${tag}: de tabel`, labelOf(f, id, got), x.c.label);
    });
  }
}

function mondayFixture(
  profile: Profile, calendarOf: (c: WorkCalendar) => WorkCalendar, type: 'FINISH_START' | 'START_START', purposes: string[] = [''],
) {
  const context = createAppStoreContext();
  const S = () => context.store.getState();
  S().setCalendar(calendarOf(S().calendar));
  S().setProject({ startDate: '2026-06-01', schedulingProfile: builtInProfile(profile) });
  const taskOf = (id: string) => S().tasks.find(t => t.id === id)!;
  const pred = S().addTask({ name: 'Voorbereiding 2 u' });
  S().updateTask(pred, { time: { ...taskOf(pred).time, durationUnit: 'hours', durationMinutes: 120, scheduleDuration: 0.25 } });
  const pairs = purposes.flatMap(purpose => KINDS.flatMap(kind => FIELDS.map(field => {
    const name = `Mijlpaal ${purpose}${kindName(kind)} ${field}`;
    const id = S().addTask({ name, isMilestone: true, ...(kind ? { milestoneKind: kind } : {}), time: { scheduleDuration: 0 } as Task['time'] });
    S().addSequence({ predecessorId: pred, successorId: id, type, lagDays: 0 });
    return { kind, field, id, name, purpose };
  })));
  S().runCPM();
  const calendar = () => resolveCalendar(undefined, S().calendars, S().calendar);
  return { context, S, taskOf, calendar, pred, pairs };
}
function mondayHealth(name: string, profile: Profile, make: () => ReturnType<typeof mondayFixture>, at: string) {
  for (const status of ['2026-05-31', '2026-06-01']) {
    const f = make();
    for (const p of f.pairs) {
      f.S().updateTask(p.id, { time: { ...f.taskOf(p.id).time, actualStart: at, actualFinish: at, completion: 1 } });
    }
    f.S().setStatusDate(status);
    f.S().runCPM();
    const late = status === '2026-05-31';
    const ids = f.pairs.map(p => p.id);
    for (const p of f.pairs) {
      eq(`${name} ${profile} ${p.name}: DCMA, actuals ${at}, statusdatum ${status}`, invalidDateReasons(f.taskOf(p.id), status, status, false, f.calendar()),
        late ? ['actualStartAfterStatusDate', 'actualFinishAfterStatusDate'] : []);
    }
    const fixtureLike = f as unknown as Fixture;
    eq(`${name} ${profile} gezondheidsrapport, statusdatum ${status}: voortgangsuitzonderingen`, progressExceptions(fixtureLike, ids),
      late ? f.pairs.flatMap(p => [`${p.name}: actualStartAfterStatusDate`, `${p.name}: actualFinishAfterStatusDate`]) : []);
    eq(`${name} ${profile} gezondheidsrapport, statusdatum ${status}: fouten`, errorsAt(fixtureLike, ids),
      late ? f.pairs.flatMap(p => [`progressException ${p.name}`, `progressException ${p.name}`]) : []);
  }
}
for (const profile of PROFILES) {
  const f = mondayFixture(profile, solCal, 'FINISH_START');
  eq(`maandag ${profile}: voorganger begint ma 04:00`, shownStart(f.taskOf(f.pred)), '2026-06-01T04:00');
  for (const p of f.pairs) {
    const tag = `maandag ${profile} ${p.name}`;
    eq(`${tag}: mijlpaal berekend op ma 06:00`, shownStart(f.taskOf(p.id)), '2026-06-01T06:00');
    eq(`${tag}: de tabel toont 01-06-2026 06:00 (Start en Vroegste start)`,
      [cellText(f, p.id, 'task.time.start'), cellText(f, p.id, 'task.time.earlyStart')], ['01-06-2026 06:00', '01-06-2026 06:00']);
  }
}
for (const profile of PROFILES) for (const route of ROUTES) {
  const f = mondayFixture(profile, solCal, 'FINISH_START');
  f.S().setStatusDate('2026-05-31');
  for (const p of f.pairs) {
    const tag = `maandag ${profile} ${route} ${p.field} ${kindName(p.kind)}`;
    eq(`${tag}: voorwaarde: gepland ma 06:00`, shownStart(f.taskOf(p.id)), '2026-06-01T06:00');
    eq(`${tag}: statusdatum zo, letterlijk 01-06-2026 06:00 ⇒ geweigerd`, enter(f, route, p.id, p.field, '2026-06-01T06:00', '2026-05-31'), 'geweigerd');
    eq(`${tag}: statusdatum zo, 01-06-2026 ⇒ geweigerd`, enter(f, route, p.id, p.field, '2026-06-01', '2026-05-31'), 'geweigerd');
  }
  f.S().setStatusDate('2026-06-02');
  for (const p of f.pairs) {
    const tag = `maandag ${profile} ${route} ${p.field} ${kindName(p.kind)}`;
    const got = enter(f, route, p.id, p.field, '2026-06-02', '2026-06-02');
    eq(`${tag}: statusdatum di, 02-06-2026 ⇒ di 22:00, het begin van de dienst van di (die begint na 06:00)`, got, '2026-06-02T22:00');
    eq(`${tag}: de tabel toont 02-06-2026`, labelOf(f, p.id, got), '2026-06-02');
  }
}
for (const profile of PROFILES) mondayHealth('maandag', profile, () => mondayFixture(profile, solCal, 'FINISH_START'), '2026-06-01T06:00');

function cellText(f: Entry, id: string, field: string): string | undefined {
  const S = f.S;
  const adapter = createTaskGridAdapter({
    projectId: S().project.id, tasks: S().tasks,
    rows: S().tasks.map(t => ({ kind: 'task', rowKey: t.id, task: t, depth: 0, dimmed: false })),
    sequences: S().sequences, assignments: S().assignments, resources: S().resources, baselines: S().baselines,
    activityCodeTypes: [], customFieldDefs: [], scheduleStale: S().scheduleStale, wbsAutoNumber: false,
    surfaceId: 'full-task-grid', selectedTaskIds: [], labelForColumn: k => k,
    effectiveCalendar: () => f.calendar(), effectiveHoursPerDay: () => 8, dateNotation: 'dmy', timeNotation: '24h',
    workdayDurationMeasure: profileCountsWorkdays(S().project), numberLocale: 'nl',
    callbacks: { onCommitEdit: (_target, intents) => S().runGridMutation(intents) },
  });
  return adapter.getCell(id, taskColumnId(field))?.text;
}
for (const profile of PROFILES) for (const route of ROUTES) {
  const anchors = FIELDS.flatMap(field => KINDS.map(kind => ({ name: `Aanvulling ${kindName(kind)} ${field}`, kind, at: '2026-06-02T05:00', field })));
  const f = anchorFixture(profile, nightShortFri, '2026-06-01', anchors);
  f.S().setStatusDate('2026-06-04');
  anchors.forEach((a, i) => {
    const id = f.ids[i];
    const tag = `aanvulling 450 ${profile} ${route} ${a.field} ${kindName(a.kind)}`;
    eq(`${tag}: voorwaarde: gepland di 2 jun 05:00, de tabel toont 02-06-2026 05:00`,
      [shownStart(f.taskOf(id)), cellText(f, id, 'task.time.start')], ['2026-06-02T05:00', '02-06-2026 05:00']);
    eq(`${tag}: statusdatum do 4 jun, 05-06-2026 ⇒ geweigerd`, enter(f, route, id, a.field, '2026-06-05', '2026-06-04'), 'geweigerd');
  });
  f.S().setStatusDate('2026-06-05');
  anchors.forEach((a, i) => {
    const id = f.ids[i];
    const tag = `aanvulling 450 ${profile} ${route} ${a.field} ${kindName(a.kind)}`;
    const got = enter(f, route, id, a.field, '2026-06-05', '2026-06-05');
    eq(`${tag}: statusdatum vr 5 jun, 05-06-2026 ⇒ za 6 jun 02:00, het einde van de vrijdagdienst`, got, '2026-06-06T02:00');
    eq(`${tag}: de tabel toont 05-06-2026`, labelOf(f, id, got), '2026-06-05');
    if (route !== 'MCP' && route !== 'functie') eq(`${tag}: de cel ${a.field} toont 05-06-2026`, cellText(f, id, `task.time.${a.field}`), '05-06-2026');
  });
}
function reportRowDates(f: Pick<Entry, 'S' | 'calendar'>): Map<string, string[]> {
  const texts: { text: string; x: number; y: number }[] = [];
  const state: Record<string | symbol, unknown> = { font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left', textBaseline: 'alphabetic' };
  const d2d = new Proxy(state, {
    get: (obj, key) => key === 'fillText' ? (text: string, x: number, y: number) => { texts.push({ text, x, y }); }
      : key === 'measureText' ? (text: string) => ({ width: text.length * 6 })
      : key in obj ? obj[key] : () => {},
    set: (obj, key, value) => { obj[key] = value; return true; },
  }) as unknown as Draw2D;
  const options = {
    showCritical: false, showFloat: false, showDeps: false, showWeekends: true, showLegend: false, showTaskNames: false,
    showCompletion: false, autoFit: true, customZoom: 10, paperSize: 'A3', orientation: 'landscape', companyName: '',
    dateNotation: 'dmy', timeNotation: '24h', taskNameColumnWidth: 400, columnWidths: { start: 160, end: 160 },
    calendars: f.S().calendars,
  } as unknown as PrintOptions;
  const result = renderReport(() => d2d, f.S().tasks, f.S().sequences, f.calendar(), 'P', options);
  const rows = new Map<string, string[]>();
  for (const task of f.S().tasks) {
    const name = texts.find(t => t.text === task.name && t.x < result.tableWidth);
    if (!name) continue;
    rows.set(task.id, texts.filter(t => Math.abs(t.y - name.y) < 0.5 && t.x < result.tableWidth && /^\d\d-\d\d-\d{4}/.test(t.text))
      .sort((a, b) => a.x - b.x).map(t => t.text));
  }
  return rows;
}
const SHARED_EDGE = '2026-06-01T06:00';
for (const profile of PROFILES) {
  const f = mondayFixture(profile, sol5Cal, 'START_START');
  const report = makeTaskDateLabeler(f.S());
  const drawn = reportRowDates(f);
  eq(`gedeelde rand ${profile}: voorganger begint ma 06:00`, shownStart(f.taskOf(f.pred)), SHARED_EDGE);
  for (const p of f.pairs) {
    const tag = `gedeelde rand ${profile} ${p.name}`;
    eq(`${tag}: mijlpaal berekend op ma 06:00`, shownStart(f.taskOf(p.id)), SHARED_EDGE);
    eq(`${tag}: de tabel toont 01-06-2026 (Start en Vroegste start)`,
      [cellText(f, p.id, 'task.time.start'), cellText(f, p.id, 'task.time.earlyStart')], ['01-06-2026', '01-06-2026']);
    eq(`${tag}: de rapportformatter toont ma (start- en eindkolom)`,
      [report(p.id, SHARED_EDGE, 'start'), report(p.id, SHARED_EDGE, 'end')], ['2026-06-01', '2026-06-01']);
    eq(`${tag}: de PDF-tekenroute toont 01-06-2026 (start en einde)`, drawn.get(p.id), ['01-06-2026', '01-06-2026']);
  }
}
for (const profile of PROFILES) for (const route of ROUTES) {
  const f = mondayFixture(profile, sol5Cal, 'START_START', ['grens ', 'B10 ']);
  f.S().setStatusDate('2026-05-31');
  for (const p of f.pairs) {
    const tag = `gedeelde rand ${profile} ${route} ${p.name}`;
    eq(`${tag}: voorwaarde: gepland ma 06:00`, shownStart(f.taskOf(p.id)), SHARED_EDGE);
    eq(`${tag}: statusdatum zo, letterlijk 01-06-2026 06:00 ⇒ geweigerd`, enter(f, route, p.id, p.field, SHARED_EDGE, '2026-05-31'), 'geweigerd');
  }
  f.S().setStatusDate('2026-06-01');
  for (const p of f.pairs.filter(x => x.purpose === 'grens ')) {
    const tag = `gedeelde rand ${profile} ${route} ${p.name}`;
    const got = enter(f, route, p.id, p.field, SHARED_EDGE, '2026-06-01');
    eq(`${tag}: statusdatum ma, letterlijk 01-06-2026 06:00 ⇒ mag, de tabel toont 01-06-2026`, [got, labelOf(f, p.id, got)], [SHARED_EDGE, '2026-06-01']);
    if (route !== 'MCP' && route !== 'functie') eq(`${tag}: de cel ${p.field} toont 01-06-2026`, cellText(f, p.id, `task.time.${p.field}`), '01-06-2026');
  }
  f.S().setStatusDate('2026-06-08');
  for (const p of f.pairs.filter(x => x.purpose === 'B10 ')) {
    const tag = `gedeelde rand ${profile} ${route} ${p.name}`;
    const got = enter(f, route, p.id, p.field, '2026-06-08', '2026-06-08');
    eq(`${tag}: statusdatum ma 8 jun, 08-06-2026 ⇒ ma 8 jun 06:00 (begin blijft begin)`, [got, labelOf(f, p.id, got)], ['2026-06-08T06:00', '2026-06-08']);
  }
}
for (const profile of PROFILES) mondayHealth('gedeelde rand', profile, () => mondayFixture(profile, sol5Cal, 'START_START'), SHARED_EDGE);
console.log(`Vaste gevallen: ${FIXED.length} op helperniveau, ${FIXED_LITERAL.length} letterlijk, ${fixedRouteCases} langs de routes`);

for (const [label, cal, predecessorHours, moment, nextStart] of [
  ['24 uur', day24, 72, '2026-06-04T00:00', '2026-06-04T00:00'],
  ['nacht', night, 24, '2026-06-04T06:00', '2026-06-04T22:00'],
] as const) {
  const f = fixture('ops', cal, { midden: false, los: false, taak: false });
  const id = f.milestone('Test einde', 'FINISH');
  f.fs(f.hours('Werk voor de eindmijlpaal', predecessorHours), id);
  f.S().setStatusDate(undefined);
  f.S().runCPM();
  const before = f.taskOf(id);
  eq(`317 ${label}: de berekende mijlpaal valt op de eindrand`, shownStart(before), moment);
  const after: Task = { ...before, time: { ...before.time, completion: 1, actualStart: moment, actualFinish: moment } };
  const status = '2026-06-03';
  eq(`317 ${label}: FINISH op einde statuswerkdag vraagt geen start`,
    actualStartQuestionFor(before, after, status, {}, f.calendar()), null);
  const start: Task = { ...after, milestoneKind: 'START', time: { ...after.time, earlyStart: nextStart, scheduleStart: nextStart } };
  eq(`317 ${label}: START op volgende klokdag blijft vragen`,
    actualStartQuestionFor(before, start, status, {}, f.calendar()) !== null, true);
  eq(`317 ${label}: status met tijd vóór moment vraagt wél start`,
    actualStartQuestionFor(before, after, '2026-06-03T23:59', {}, f.calendar()) !== null, true);
  const result = planProgressEntry(before, { field: 'completion', value: 1 },
    { statusDate: status, today: '2026-06-05', calendar: f.calendar() });
  eq(`317 ${label}: 100 procent UI-invoer wordt niet geweigerd`, result.ok, true);
  f.S().setStatusDate(status);
  const draft = structuredClone({ tasks: f.S().tasks, sequences: f.S().sequences, assignments: f.S().assignments, resources: f.S().resources, calendars: f.S().calendars, calendar: f.S().calendar, project: f.S().project });
  eq(`317 ${label}: MCP 100 procent slaagt`, progress.applyProgressUpdate(draft, id, { completion: 100 }, status).applied, true);
  eq(`317 ${label}: echte UI-invoer slaagt`, f.S().enterTaskProgress(id, { field: 'completion', value: 1 }, { today: '2026-06-05' }).ok, true);
  const reset = () => f.context.store.setState(state => { const target = state.tasks.find(t => t.id === id)!; target.time = { ...before.time }; target.status = before.status; });
  reset();
  const grid = f.S().runGridMutation([{ kind: 'cell-edit', taskId: id, columnId: 'task.time.completion' as CellEditIntent['columnId'], route: 'task-progress', value: 1 }], { progressEntry: { today: '2026-06-05' } });
  eq(`317 ${label}: raster 100 procent slaagt`, grid.ok, true);
  reset();
  const dialogPlan = planTaskDialogProgress(f.S(), f.taskOf(id), undefined, { field: 'completion', value: 1 }, { today: '2026-06-05' });
  eq(`317 ${label}: dialoog vraagt geen start`, dialogPlan.ok, true);
  const dialogSaved = dialogPlan.ok && dialogPlan.change !== null
    && createTaskDialogSave(f.context)({ editingTaskId: id, draft: dialogPlan.change.task, today: '2026-06-05' });
  eq(`317 ${label}: dialoog 100 procent slaagt`, dialogSaved, true);
}

for (const failure of failures) console.log('XX ' + failure);
console.log(`Mijlpaal afmelden met de geplande tijd: ${checks} controles, ${failures.length} fouten`);
if (failures.length) process.exit(1);
