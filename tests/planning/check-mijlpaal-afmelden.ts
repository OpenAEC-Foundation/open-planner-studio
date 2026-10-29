// Een afgemelde mijlpaal houdt de klokketijd uit de planning.
//
// Besluit van Ethan, 2026-10-29 (vloot-wiki, `besluiten/2026-10-29 afgemelde mijlpaal houdt de geplande
// tijd.md`): "Meld je een mijlpaal af met alleen een datum, dan houdt hij de klokketijd die hij in de
// planning had. De dag komt van wat je typt, de tijd uit de planning. Typ je zelf een tijd, dan geldt die."
// Het vervangt regel D7 (spec `docs/superpowers/specs/2026-10-20-alleen-uren-design.md` §4.2) voor afmelden.
// Voorbeelden uit het besluit: "Oplevering", gepland ma 1 jun 16:00, afgemeld op 3-6-2026 ⇒ wo 3 jun 16:00;
// "Start bouw", gepland ma 1 jun 07:00, afgemeld op 2-6-2026 ⇒ di 2 jun 07:00.
//
// Deze check toetst de regel in elk profiel (OPS, P6, MSP), voor elke soort mijlpaal (START, FINISH, zonder
// soort), op beide velden (werkelijke start en werkelijk einde) en langs elke invoerroute: de functie zelf,
// het eigenschappenpaneel (store-setters), de UI-invoer (`enterTaskProgress`, ook contextmenu en Taak
// bewerken), de tabel (celbewerking, de echte celeditor met getypte tekst, en plakken), Taak bewerken
// (concept + Opslaan), MCP (`progress.applyProgressUpdate`) en de voortgangsimport. Een gewone taak houdt
// D1/D2, en de laadgrens houdt D7. Sectie 5 toetst de nachtploeg met een statusdatum: afmelden op de
// statuswerkdag mag, ook als het moment op de klokdag erna valt (`isTaskActualPastStatusDate`).
//
// Kalender: de standaardkalender, ma–vr 07:00–16:00 (sectie 5: 24 uur en nachtploeg 22:00–06:00).
// Projectstart ma 1 jun 2026.
//
// Exit 0 = alles groen. De exitcode is het enige geldige oordeel.

import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { normalizeActualDate, normalizeLoadedActualDate } from '@/engine/taskMutationRules';
import { normalizeImportedProgress } from '@/services/importNormalize';
import { progress } from '@/state/mcpValidation';
import { createTaskDialogSave, draftWithActualFinish, draftWithActualStart } from '@/state/taskDialogSave';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { makeBands } from '@/utils/effectiveWorkTime';
import { taskDateLabel } from '@/utils/taskDateLabel';
import { shownStart } from '@/utils/taskDates';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { commitTaskCellEditorValue } from '@/components/task-grid/TaskCellEditor';
import { profileCountsWorkdays } from '@/utils/taskDuration';
import { invalidDateReasons } from '@/engine/reports/dcmaAssessment';
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
/** De statusdatum: na alle afmelddatums hieronder, zonder tijd. */
const STATUS = '2026-06-05';

/** Een planning met de mijlpalen van het besluit en één per soort, in een vers project. */
function fixture(profile: Profile, calendarOf?: (c: WorkCalendar) => WorkCalendar) {
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
  // "Oplevering": eindmijlpaal na een werkdag afbouw ⇒ ma 16:00 in elk profiel.
  const oplevering = milestone('Oplevering', 'FINISH');
  fs(hours('Afbouw', 8), oplevering);
  // "Start bouw": startmijlpaal met een opvolger ⇒ ma 07:00 in elk profiel.
  const startBouw = milestone('Start bouw', 'START');
  fs(startBouw, hours('Grondwerk', 8));
  // Midden op de dag door de logica: FS na een taak van 3 u ⇒ ma 10:00, per soort.
  const midden: Record<string, string> = {};
  for (const kind of KINDS) {
    const m = milestone('Keuring ' + kindName(kind), kind);
    fs(hours('Inspectie ' + kindName(kind), 3), m);
    midden[kindName(kind)] = m;
  }
  // Losse mijlpaal per soort: in OPS aan het einde van de werkdag (B6); in P6 en MSP alleen de
  // FINISH-mijlpaal, de andere aan het begin.
  const los: Record<string, string> = {};
  for (const kind of KINDS) los[kindName(kind)] = milestone('Los ' + kindName(kind), kind);
  const taak = hours('Metselwerk', 8);
  S().runCPM();
  // Zoals een planner werkt: eerst de planning, dan de statusdatum zetten en afmelden, daarna pas F5.
  // (Na F5 met deze statusdatum staat niet-afgemeld werk in OPS en P6 op de statusdatum.)
  S().setStatusDate(STATUS);
  const calendar = () => resolveCalendar(undefined, S().calendars, S().calendar);
  return { context, S, taskOf, milestone, hours, fs, oplevering, startBouw, midden, los, taak, calendar };
}
type Fixture = ReturnType<typeof fixture>;

/** De klokketijd (`HH:mm`) van een moment. */
const clockOf = (moment: string | undefined) => moment?.slice(11, 16);

// ── 0. Voorwaarden: de planning staat waar het besluit zegt ───────────────────────────────────────
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

// ── 1. De invoerroutes ───────────────────────────────────────────────────────────────────────────
type Route = 'functie' | 'paneel' | 'UI-invoer' | 'tabel' | 'celeditor' | 'plakken' | 'dialoog' | 'MCP' | 'voortgangsimport';
const ROUTES: Route[] = ['functie', 'paneel', 'UI-invoer', 'tabel', 'celeditor', 'plakken', 'dialoog', 'MCP', 'voortgangsimport'];

/** Wat een planner in de celeditor typt (notatie dmy, 24 uur): `2026-06-03` ⇒ `03-06-2026`,
 *  `2026-06-03T09:30` ⇒ `03-06-2026 09:30`. */
function typedText(iso: string): string {
  const day = `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
  return iso.length > 10 ? `${day} ${iso.slice(11, 16)}` : day;
}

/** Meld `value` af op `field` van taak `id` langs `route`, met statusdatum `status` (staat ook in het
 *  project). Geeft het opgeslagen moment terug, of `'geweigerd'`. */
function enter(f: Fixture, route: Route, id: string, field: Field, value: string, status = STATUS): string | undefined {
  const S = f.S;
  const task = f.taskOf(id);
  const calendar = f.calendar();
  if (route === 'functie') return normalizeActualDate(task, field, value, status, calendar);
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
    // De echte rastercommit: de tekst gaat door de parser van de cel en dan door `runGridMutation`.
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
    const draft = field === 'actualStart'
      ? draftWithActualStart(task, value, status, calendar)
      : draftWithActualFinish(task, value, status, calendar);
    if (!draft) return 'geweigerd';
    const ok = createTaskDialogSave(f.context)({ editingTaskId: id, draft, startDate: task.time.scheduleStart });
    return ok ? f.taskOf(id).time[field] : 'geweigerd';
  }
  if (route === 'MCP') {
    // De tool roept deze validatie aan op zijn geïsoleerde mutatiedraft.
    const draft = structuredClone({
      tasks: S().tasks, sequences: S().sequences, assignments: S().assignments, resources: S().resources,
      calendars: S().calendars, calendar: S().calendar, project: S().project,
    });
    const update = field === 'actualStart' ? { actualStart: value } : { actualFinish: value };
    const result = progress.applyProgressUpdate(draft, id, update, status);
    return result.applied ? draft.tasks.find(t => t.id === id)!.time[field] : 'geweigerd';
  }
  // voortgangsimport: één rij van een ingevuld voortgangsblad.
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
    // Het besluit, letterlijk.
    eq(`${tag}: Oplevering (ma 16:00) op 3-6-2026 ⇒ wo 3 jun 16:00`,
      enter(f, route, f.oplevering, field, '2026-06-03'), '2026-06-03T16:00');
    eq(`${tag}: Start bouw (ma 07:00) op 2-6-2026 ⇒ di 2 jun 07:00`,
      enter(f, route, f.startBouw, field, '2026-06-02'), '2026-06-02T07:00');
    // Het nadeel uit het besluit: midden op de dag ⇒ de afgemelde datum krijgt die tijd.
    for (const kind of KINDS) {
      const id = f.midden[kindName(kind)];
      eq(`${tag}: Keuring ${kindName(kind)} (ma 10:00) op 3-6-2026 ⇒ 10:00`,
        enter(f, route, id, field, '2026-06-03'), '2026-06-03T10:00');
    }
    // Elke soort, losse mijlpaal: de tijd die hij in de planning had (OPS 16:00, P6 en MSP 07:00).
    for (const kind of KINDS) {
      const id = f.los[kindName(kind)];
      const clock = clockOf(planned(id));
      eq(`${tag}: Los ${kindName(kind)} (${clock}) op 4-6-2026 ⇒ ${clock}`,
        enter(f, route, id, field, '2026-06-04'), `2026-06-04T${clock}`);
    }
    // Een gewone taak houdt D1 (start 07:00) en D2 (einde 16:00).
    eq(`${tag}: gewone taak houdt ${field === 'actualStart' ? 'D1' : 'D2'}`,
      enter(f, route, f.taak, field, '2026-06-03'), field === 'actualStart' ? '2026-06-03T07:00' : '2026-06-03T16:00');
  }
  {
    // Typ je zelf een tijd, dan geldt die — ook bij een mijlpaal met een andere geplande tijd.
    const f = fixture(profile);
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

// ── 2. Een al afgemelde mijlpaal: zijn werkelijke datum is de planning ──────────────────────────
// In P6 zet C5 de vroege start van een voltooide taak op de statusdatum. De regel leest daarom de
// GETOONDE start (`shownStart`): een nieuwe datum zonder tijd houdt de afgemelde 09:30, niet de tijd van
// de statusdatum.
for (const profile of PROFILES) {
  const f = fixture(profile);
  f.S().setActualFinish(f.oplevering, '2026-06-03T09:30');
  f.S().runCPM();
  eq(`${profile}: opnieuw afmelden op 4-6-2026 houdt 09:30`, enter(f, 'paneel', f.oplevering, 'actualFinish', '2026-06-04'), '2026-06-04T09:30');
  f.S().runCPM();
  eq(`${profile}: en via MCP op 5-6-2026 ook`, enter(f, 'MCP', f.oplevering, 'actualFinish', '2026-06-05'), '2026-06-05T09:30');
}

// ── 3. 100 % zonder datum (contextmenu Voltooid, schuif): het afgeleide einde is de statusdatum, met de
// klokketijd uit de planning.
for (const profile of PROFILES) {
  const f = fixture(profile);
  const lone = f.los['zonder soort'];
  const clock = clockOf(f.taskOf(lone).time.earlyStart);
  eq(`${profile}: 100 % op een losse mijlpaal zonder soort`, f.S().setTaskProgress(lone, 1), true);
  eq(`${profile}: werkelijk einde = statusdatum om ${clock}`, f.taskOf(lone).time.actualFinish, `${STATUS}T${clock}`);
  eq(`${profile}: 100 % op Oplevering`, f.S().setTaskProgress(f.oplevering, 1), true);
  eq(`${profile}: werkelijk einde = statusdatum om 16:00`, f.taskOf(f.oplevering).time.actualFinish, `${STATUS}T16:00`);
}

// ── 4. De klem op het statusmoment blijft ───────────────────────────────────────────────────────
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

// ── 5. "De dag" is de dag die de tabel toont, ook bij een blokeinde na middernacht ────────────────
const day24 = (c: WorkCalendar): WorkCalendar => ({
  ...c, workStartHour: 0, workEndHour: 24, hoursPerDay: 24, workTime: makeBands([1, 2, 3, 4, 5], [{ start: 0, end: 1440 }]),
});
const night = (c: WorkCalendar): WorkCalendar => ({
  ...c, workStartHour: 22, workEndHour: 30, hoursPerDay: 8, workTime: makeBands([1, 2, 3, 4, 5], [{ start: 1320, end: 1800 }]),
});
{
  // 5a. De regel zelf, zonder statusdatum. Een FINISH-mijlpaal na een volle werkdag staat op het
  // blokeinde: om 00:00 (24 uur) of 06:00 (nachtploeg 22:00–06:00) van de klokdag erna. De tabel toont
  // de werkdag zelf (ma 1 jun).
  for (const [name, cal, h, want] of [['24 uur', day24, 24, '2026-06-04T00:00'], ['nachtploeg', night, 8, '2026-06-04T06:00']] as const) {
    const f = fixture('ops', cal);
    const id = f.milestone('Oplevering ' + name, 'FINISH');
    f.fs(f.hours('Werkdag ' + name, h), id);
    f.S().setStatusDate(undefined); // anders schuift F5 het niet-afgemelde werk naar de statusdatum
    f.S().runCPM();
    const calendar = f.calendar();
    eq(`${name}: voorwaarde: de tabel toont ma 1 jun`, taskDateLabel(f.taskOf(id), f.taskOf(id).time.earlyStart, 'end', calendar), '2026-06-01');
    const value = normalizeActualDate(f.taskOf(id), 'actualFinish', '2026-06-03', undefined, calendar)!;
    eq(`${name}: afgemeld op 3-6-2026 ⇒ het blokeinde van wo 3 jun`, value, want);
    eq(`${name}: en de tabel toont wo 3 jun`, taskDateLabel(f.taskOf(id), value, 'end', calendar), '2026-06-03');
  }
}

// 5b. Nachtploeg 22:00–06:00 mét statusdatum wo 3 jun (zonder tijd): afmelden met 03-06-2026 mag, voor
// elke soort, op beide velden en langs elke invoerroute (voorheen knownbug 445). Een mijlpaal op di 2 jun
// 06:00, het einde van de nacht van ma, toont "01-06-2026". Afmelden met 03-06-2026 geeft do 4 jun 06:00,
// het einde van de nacht van wo; de tabel toont "03-06-2026". De statuscontrole las een mijlpaal zonder
// soort of START eerst aan de startkant: klokdag do, dus ná de statusdatum, en weigerde. Nu telt de dag die
// de tabel toont (`isTaskActualPastStatusDate`). Twee opstellingen: de losse mijlpaal in OPS (B6, berekend
// op het einde van de werkdag) en een handmatig anker op di 06:00 in elk profiel.
const NIGHT_STATUS = '2026-06-03';
function nightFixture(profile: Profile) {
  const f = fixture(profile, night);
  const anchors = KINDS.map(kind => {
    const id = f.milestone('Nachtanker ' + kindName(kind), kind);
    const at = '2026-06-02T06:00';
    f.S().updateTask(id, { manuallyScheduled: true, time: { ...f.taskOf(id).time, scheduleStart: at, scheduleFinish: at, earlyStart: at, earlyFinish: at } });
    return { name: `anker ${kindName(kind)}`, id };
  });
  f.S().setStatusDate(undefined); // anders schuift F5 het niet-afgemelde werk naar de statusdatum
  f.S().runCPM();
  f.S().setStatusDate(NIGHT_STATUS);
  const lone = profile === 'ops' ? KINDS.map(kind => ({ name: `los ${kindName(kind)} (B6)`, id: f.los[kindName(kind)] })) : [];
  return { ...f, cases: [...anchors, ...lone] };
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
  }
}
for (const profile of PROFILES) for (const route of ROUTES) for (const field of FIELDS) {
  const f = nightFixture(profile);
  const calendar = f.calendar();
  for (const c of f.cases) {
    const tag = `nacht ${profile} ${route} ${field} ${c.name}`;
    const got = enter(f, route, c.id, field, '2026-06-03', NIGHT_STATUS);
    eq(`${tag}: 03-06-2026 op de statuswerkdag ⇒ do 4 jun 06:00`, got, '2026-06-04T06:00');
    eq(`${tag}: de tabel toont 03-06-2026`, got && got !== 'geweigerd' ? taskDateLabel(f.taskOf(c.id), got, 'start', calendar) : got, '2026-06-03');
  }
}

// 5c. De grenzen van die regel, op dezelfde nachtploeg.
for (const profile of PROFILES) {
  // Het rapport (DCMA punt 9, `invalidDateReasons`) gebruikt dezelfde dag: geen "ná de statusdatum".
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
    // Los van de invoer: dezelfde datums uit een bestand, rechtstreeks op de taak.
    const read: Task = { ...t, time: { ...t.time, actualStart: '2026-06-04T06:00', actualFinish: '2026-06-04T06:00', completion: 1 } };
    eq(`nacht ${profile} ${c.name}: DCMA, actuals do 06:00 uit een bestand ⇒ geen datum ná de statusdatum`,
      invalidDateReasons(read, NIGHT_STATUS, NIGHT_STATUS, false, calendar), []);
  }
}
for (const profile of PROFILES) {
  // Een statusdatum mét tijd blijft een tijdstipcontrole. Datumloos op de statuswerkdag klemt op het
  // statusmoment; een getypt moment ná het statusmoment wordt geweigerd, ook als de tabel het op de
  // statusdag zou tonen.
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
  // Een gewone taak verandert niet: haar werkelijke start op do 06:00 leest de startkant (klokdag do) en
  // valt ná de statusdatum; haar werkelijke einde op do 06:00 is het einde van de nacht van wo en mag.
  // Een mijlpaal op hetzelfde moment toont wo en mag (5b).
  const f = nightFixture(profile);
  for (const route of ['paneel', 'MCP', 'celeditor'] as const) {
    eq(`nacht ${profile} ${route}: gewone taak, werkelijke start do 06:00 ⇒ geweigerd`,
      enter(f, route, f.taak, 'actualStart', '2026-06-04T06:00', NIGHT_STATUS), 'geweigerd');
  }
  eq(`nacht ${profile}: gewone taak, werkelijk einde do 06:00 mag`,
    enter(f, 'MCP', f.taak, 'actualFinish', '2026-06-04T06:00', NIGHT_STATUS), '2026-06-04T06:00');
  eq(`nacht ${profile}: gewone taak, werkelijke start 03-06-2026 ⇒ D1 wo 22:00`,
    enter(f, 'MCP', f.taak, 'actualStart', '2026-06-03', NIGHT_STATUS), '2026-06-03T22:00');
  // De laadgrens houdt D7: een mijlpaal zonder soort krijgt D1 (wo 22:00), niet do 06:00.
  eq(`nacht ${profile}: laadgrens, mijlpaal zonder soort ⇒ D1 wo 22:00`,
    normalizeLoadedActualDate(f.taskOf(f.cases[0].id), 'actualFinish', '2026-06-03', NIGHT_STATUS, f.calendar()), '2026-06-03T22:00');
}
{
  // De soort blijft gelden. Op een 24-uurskalender is di 00:00 het einde van ma én het begin van di; de
  // tabel toont een START-mijlpaal daar als "di" en een FINISH-mijlpaal als "ma". Met statusdatum ma
  // 1 jun mag FINISH daar dus wel, START niet.
  const f = fixture('ops', day24);
  f.S().setStatusDate('2026-06-01');
  eq('24 uur: START-mijlpaal op di 00:00 met statusdatum ma ⇒ geweigerd',
    enter(f, 'paneel', f.los.START, 'actualStart', '2026-06-02T00:00', '2026-06-01'), 'geweigerd');
  eq('24 uur: FINISH-mijlpaal op di 00:00 met statusdatum ma ⇒ mag',
    enter(f, 'paneel', f.los.FINISH, 'actualFinish', '2026-06-02T00:00', '2026-06-01'), '2026-06-02T00:00');
}

// ── 6. De laadgrens houdt D7 ──────────────────────────────────────────────────────────────────────
{
  const f = fixture('ops');
  const calendar = f.calendar();
  const lone = f.taskOf(f.los['zonder soort']);
  eq('laadgrens: losse mijlpaal zonder soort ⇒ D1 (07:00), niet de geplande 16:00',
    normalizeLoadedActualDate(lone, 'actualFinish', '2026-06-03', undefined, calendar), '2026-06-03T07:00');
  eq('laadgrens: FINISH ⇒ D2 (16:00)',
    normalizeLoadedActualDate(f.taskOf(f.midden.FINISH), 'actualFinish', '2026-06-03', undefined, calendar), '2026-06-03T16:00');
  // De lezer (`normalizeImportedProgress`): voltooid, start met tijd, geen einde ⇒ het einde volgt D7.
  const read: Task = { ...structuredClone(lone), time: { ...structuredClone(lone.time), completion: 1, actualStart: '2026-06-01T16:00', actualFinish: undefined } };
  normalizeImportedProgress([read], '2026-06-03', undefined, calendar);
  eq('lezer: afgeleid einde volgt D7 (07:00)', read.time.actualFinish, '2026-06-03T07:00');
}

// ── 7. Zonder bruikbaar gepland moment: terugval op D7 ───────────────────────────────────────────
{
  const f = fixture('ops');
  const calendar = f.calendar();
  const base = f.taskOf(f.los['zonder soort']);
  const unplanned: Task = { ...base, time: { ...base.time, earlyStart: '', scheduleStart: '2026-06-01' } };
  eq('geen moment met tijd in de planning ⇒ D1 (07:00)', normalizeActualDate(unplanned, 'actualFinish', '2026-06-03', undefined, calendar), '2026-06-03T07:00');
  const unplannedFinish: Task = { ...unplanned, milestoneKind: 'FINISH' };
  eq('geen moment met tijd, FINISH ⇒ D2 (16:00)', normalizeActualDate(unplannedFinish, 'actualFinish', '2026-06-03', undefined, calendar), '2026-06-03T16:00');
}

for (const failure of failures) console.log('XX ' + failure);
console.log(`Mijlpaal afmelden met de geplande tijd: ${checks} controles, ${failures.length} fouten`);
if (failures.length) process.exit(1);
