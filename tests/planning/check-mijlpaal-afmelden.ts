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
// statuswerkdag mag, ook als het moment op de klokdag erna valt (`isTaskActualPastStatusDate`), ook als de
// statusdag geen werkblok heeft (weekend, feestdag: D4), en het gezondheidsrapport meldt dan geen fout.
// Sectie 8 toetst de aanvulling "einde blijft einde" (Ethan, later op 2026-10-29): het voorbeeld van Ethan, het
// nachtvoorbeeld, de automatische route en de gevallen van review ronde 3, een compacte kalenderselectie met
// letterlijk uitgeschreven verwachtingen (ook elk verschil met main), de berekende maandagroute van review
// ronde 4 (echte werktijd gaat voor een verzonnen D4-rand), de tweede aanvulling van Ethan (de dienst van de
// getypte dag eindigt vóór de geplande kloktijd, ook overdag) en de berekende SS-route van review ronde 5 (een
// echt begin van ma gaat voor het verzonnen D4-einde van zo).
//
// Kalender: de standaardkalender, ma–vr 07:00–16:00 (sectie 5: 24 uur en nachtploeg 22:00–06:00; sectie 8:
// per weekdag eigen werkblokken). Projectstart ma 1 jun 2026.
//
// Exit 0 = alles groen. De exitcode is het enige geldige oordeel.

import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { isTaskActualPastStatusDate, normalizeActualDate, normalizeLoadedActualDate } from '@/engine/taskMutationRules';
import {
  dayEndInstant, dayStartInstant, ELAPSED_CLOCK, milestoneWorkdayOf, workdayEdgeAt,
} from '@/engine/calendar/workdayRules';
import { normalizeImportedProgress } from '@/services/importNormalize';
import { progress } from '@/state/mcpValidation';
import { createTaskDialogSave, draftWithActualFinish, draftWithActualStart } from '@/state/taskDialogSave';
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
/** De statusdatum: na alle afmelddatums hieronder, zonder tijd. */
const STATUS = '2026-06-05';

/** Welke groepen `fixture` naast "Oplevering" en "Start bouw" bouwt; standaard alle. De opbouw kost de meeste
 *  tijd van deze check (ongeveer 2 ms per taak, knownbug 452); een sectie laat weg wat ze niet gebruikt. */
interface Parts { midden?: boolean; los?: boolean; taak?: boolean }
/** Een planning met de mijlpalen van het besluit en één per soort, in een vers project. */
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
  // "Oplevering": eindmijlpaal na een werkdag afbouw ⇒ ma 16:00 in elk profiel.
  const oplevering = milestone('Oplevering', 'FINISH');
  fs(hours('Afbouw', 8), oplevering);
  // "Start bouw": startmijlpaal met een opvolger ⇒ ma 07:00 in elk profiel.
  const startBouw = milestone('Start bouw', 'START');
  fs(startBouw, hours('Grondwerk', 8));
  // Midden op de dag door de logica: FS na één taak van 3 u ⇒ ma 10:00, per soort.
  const midden: Record<string, string> = {};
  if (parts.midden !== false) {
    const inspectie = hours('Inspectie 3 u', 3);
    for (const kind of KINDS) {
      const m = milestone('Keuring ' + kindName(kind), kind);
      fs(inspectie, m);
      midden[kindName(kind)] = m;
    }
  }
  // Losse mijlpaal per soort: in OPS aan het einde van de werkdag (B6); in P6 en MSP alleen de
  // FINISH-mijlpaal, de andere aan het begin.
  const los: Record<string, string> = {};
  if (parts.los !== false) for (const kind of KINDS) los[kindName(kind)] = milestone('Los ' + kindName(kind), kind);
  const taak = parts.taak !== false ? hours('Metselwerk', 8) : '';
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
/** Wat `enter` van een opstelling nodig heeft: de store, de taken en de kalender. */
type Entry = Pick<Fixture, 'context' | 'S' | 'taskOf' | 'calendar'>;
function enter(f: Entry, route: Route, id: string, field: Field, value: string, status = STATUS): string | undefined {
  const S = f.S;
  const task = f.taskOf(id);
  const calendar = f.calendar();
  if (route === 'functie') {
    // De functie plus de statusregel, zoals elke invoerroute ze samen gebruikt.
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
    // Typ je zelf een tijd, dan geldt die — ook bij een mijlpaal met een andere geplande tijd. Alleen de
    // mijlpalen die dit blok gebruikt (slank, knownbug 452).
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
  f.S().setStatusDate(undefined); // anders schuift F5 het niet-afgemelde werk naar de statusdatum
  f.S().runCPM();
  f.S().setStatusDate(NIGHT_STATUS);
  const lone = profile === 'ops' ? KINDS.map(kind => ({ name: `los ${kindName(kind)} (B6)`, id: f.los[kindName(kind)] })) : [];
  return { ...f, cases: [...anchors, ...lone] };
}
/** Een slanke opstelling voor de routelussen (5b, 5d, 8b): alleen de mijlpalen van de nachtgevallen, met een
 *  eigen mijlpaal per veld (`field`), zodat één opstelling per profiel en route beide velden toetst (review
 *  ronde 4: niet voor elk veld dezelfde planning opnieuw opbouwen). Dezelfde gevallen als `nightFixture`: per
 *  soort een handmatig anker op di 2 jun 06:00 en, in OPS, een losse mijlpaal (B6, berekend op het einde van
 *  de dienst van ma). Statusdatum NIGHT_STATUS. */
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
    // Verschil met main (statusregel 4): het letterlijke moment di 06:00 is het einde van de nacht van ma en
    // hoort bij ma, ook aan de startkant. De tabel toont ma (ook op main); main weigerde het met statusdatum ma.
    for (const field of FIELDS) {
      eq(`nacht ${profile} ${c.name} ${field}: letterlijk di 06:00, statusdatum ma ⇒ mag`,
        isTaskActualPastStatusDate(t, field, '2026-06-02T06:00', '2026-06-01', calendar) ? 'geweigerd' : 'mag', 'mag');
    }
  }
}
for (const profile of PROFILES) for (const route of ROUTES) {
  // Eén opstelling per profiel en route, met een eigen mijlpaal per veld (review ronde 4: niet voor elk
  // veld dezelfde planning opnieuw opbouwen). Elk geval krijgt nog steeds elke route en beide velden.
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

// 5d. Een statusdag zonder werkblok (D4): zaterdag, zondag, of een feestdag op woensdag. Afmelden op die
// dag mag, voor elke soort, op beide velden en langs elke invoerroute. De mijlpaal op di 2 jun 06:00 (het
// einde van de nacht van ma) houdt zijn klokketijd: za 6 jun wordt zo 7 jun 06:00, het einde van de
// typische nacht van za (D4). De tabel toont "06-06-2026". Eerst werd zo'n afmelding geweigerd: de tabel
// en de statuscontrole herkenden het einde van een dag zonder werkblok niet en lazen de klokdag erna
// (review ronde 2 van #724). Een FINISH-mijlpaal had dat al op main; dezelfde dagbepaling lost het mee op.
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
  // De dag erna blijft ná de statusdatum, ook als die dag ook geen werkblok heeft.
  for (const c of f.cases) {
    eq(`D4 ${free.name} ${profile} ${c.name}: de dag erna ⇒ geweigerd`,
      enter(f, 'paneel', c.id, 'actualFinish', free.next, free.day), 'geweigerd');
  }
  eq(`D4 ${free.name} ${profile}: weergave van ${free.want} bij een mijlpaal`,
    taskDateLabel(f.taskOf(f.cases[0].id), free.want, 'start', calendar), free.day);
}
for (const free of FREE_DAYS) for (const profile of PROFILES) for (const route of ROUTES) {
  // Eén opstelling per vrije dag, profiel en route, met een eigen mijlpaal per veld (zoals 5b).
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

// 5e. Het gezondheidsrapport (`computeScheduleHealth`, de detaillijst én het foutenaantal) na een
// afmelding die de invoer goedkeurt: geen "ná de statusdatum". Eerst gaf het rapport `invalidDateReasons`
// geen taakkalender mee en las het de nachtdienst op de klokdag: twee fouten per mijlpaal (knownbug 316,
// review ronde 2 van #724). Nu één definitie met de invoer en DCMA, met de kalender van de taak.
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
/** De fouten (ernst `error`, ook in het foutenaantal) die het rapport bij deze taken meldt. */
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
  // In een project met alleen de mijlpalen is dat foutenaantal 0, zoals in de review gemeten.
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

// ── 8. Einde blijft einde (aanvulling op het besluit) ────────────────────────────────────────────
// Aanvulling van Ethan, later op 2026-10-29 (vloot-wiki, `besluiten/2026-10-29 afgemelde mijlpaal houdt de
// geplande tijd.md`, alinea "Aanvulling"): "Bij ongelijke werktijden past de geplande kloktijd soms niet in
// de getypte dag. Dan geldt: einde blijft einde. Stond de mijlpaal op het begin of einde van zijn werkdag,
// dan komt hij op hetzelfde begin of einde van de getypte dag. Daartussen geldt de geplande kloktijd."
// Tweede aanvulling (zelfde bestand, alinea "Nog een aanvulling"): "Ligt de mijlpaal midden in een dienst, en
// eindigt de dienst van de getypte dag vóór de geplande kloktijd, dan krijgt hij het einde van die dienst."
// Dat geldt ook overdag (8a). Begint de dienst van de getypte dag na die kloktijd, dan het begin van die dienst
// (uitwerking door de orkestrator, fixronde 5 van #724; 8h, kalender `vroeg`).
// De regel staat in `milestoneMomentOn` en `milestoneWorkdayOf` (`src/engine/calendar/workdayRules.ts`);
// de tabel en de statuscontrole lezen dezelfde werkdag. Elke kalender hier heeft per weekdag eigen blokken.
type Band = { start: number; end: number };
type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Week = Partial<Record<Weekday, Band[]>>;
const blocks = (...pairs: [number, number][]): Band[] => pairs.map(([start, end]) => ({ start, end }));
const weekOf = (days: Weekday[], day: Band[], extra: Week = {}): Week =>
  ({ ...Object.fromEntries(days.map(d => [d, day])), ...extra });
/** Een kalender met precies deze blokken per weekdag en precies deze feestdagen. `typical` is de typische
 *  werkdag (D4): de weekdag met de meest voorkomende dagsom, bij gelijke stand de hoogste som, dan de
 *  eerste weekdag. Sectie 8h toetst letterlijk dat de motor dezelfde dagranden ziet. */
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
const DAY = blocks([420, 720], [780, 960]); // 07:00–12:00 en 13:00–16:00: 8 uur
const NIGHT = blocks([1320, 1800]); // 22:00–06:00
const MON_THU: Weekday[] = [1, 2, 3, 4];
/** Het voorbeeld van Ethan: ma–do 07:00–16:00, vr 07:00–12:00. */
const ETHAN_WEEK = weekOf(MON_THU, DAY, { 5: blocks([420, 720]) });
/** Het nachtvoorbeeld: ma–do 22:00–06:00, vr 22:00–02:00 (ook de kalender van Sol in ronde 3). */
const NIGHT_SHORT_FRI_WEEK = weekOf(MON_THU, NIGHT, { 5: blocks([1320, 1560]) });
const ethanCal = (c: WorkCalendar) => weekCalendar(c, ETHAN_WEEK, 1);
const nightShortFri = (c: WorkCalendar) => weekCalendar(c, NIGHT_SHORT_FRI_WEEK, 1);
/** De kalender van Sol (review ronde 4): ma 04:00–08:00, di–vr 22:00–06:00, weekend vrij. De typische
 *  werkdag is de nacht van di (D4: de meest voorkomende dagsom, 8 u, en dan de eerste weekdag). */
const solCal = (c: WorkCalendar) => weekCalendar(c, weekOf([2, 3, 4, 5], NIGHT, { 1: blocks([240, 480]) }), 2);
/** De kalender van Sol (review ronde 5): ma 06:00–10:00, di–vr 22:00–06:00, weekend vrij. Typische werkdag
 *  de nacht van di, dus D4 laat zo eindigen op ma 06:00: precies het echte begin van ma. */
const sol5Cal = (c: WorkCalendar) => weekCalendar(c, weekOf([2, 3, 4, 5], NIGHT, { 1: blocks([360, 600]) }), 2);
/** Ma 04:00–08:00, di–vr 07:00–16:00, weekend vrij: het voorbeeld van de orkestrator (fixronde 5). */
const earlyCal = (c: WorkCalendar) => weekCalendar(c, weekOf([2, 3, 4, 5], blocks([420, 960]), { 1: blocks([240, 480]) }), 2);
/** Nachtploeg ma–vr 22:00–06:00 met een feestdag op wo 3 jun. */
const holidayNight = (c: WorkCalendar) => weekCalendar(c, weekOf([1, 2, 3, 4, 5], NIGHT), 1, ['2026-06-03']);
/** 24 uur ma–do, vr 00:00–12:00. */
const day24ShortFri = (c: WorkCalendar) => weekCalendar(c, weekOf(MON_THU, blocks([0, 1440]), { 5: blocks([0, 720]) }), 1);
/** 24 uur ma–vr: za 00:00 is het einde van een echte vr en het begin van een vrije za (D4). */
const day24Full = (c: WorkCalendar) => weekCalendar(c, weekOf([1, 2, 3, 4, 5], blocks([0, 1440])), 1);
const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const labelOf = (f: Entry, id: string, got: string | undefined) =>
  got && got !== 'geweigerd' ? taskDateLabel(f.taskOf(id), got, 'start', f.calendar()) : got;

/** Een vers project met losse mijlpalen: met `at` een handmatig anker op dat moment, anders berekend. */
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

// 8a. Het voorbeeld van Ethan, letterlijk, en de andere mijlpalen van de opstelling op dezelfde kalender.
// Statusdatum vr 5 jun (STATUS).
function ethanFixture(profile: Profile, calendarOf: (c: WorkCalendar) => WorkCalendar = ethanCal, laterBegin = false) {
  const f = fixture(profile, calendarOf, laterBegin ? { los: false, taak: false } : {});
  // Midden op de dag na één taak van 6 u: ma 14:00, later dan het einde van de vrijdag (alleen 8a).
  const at14: Record<string, string> = {};
  if (!laterBegin) {
    const inspectie = f.hours('Inspectie 6 u', 6);
    for (const kind of KINDS) {
      const m = f.milestone('Keuring 14:00 ' + kindName(kind), kind);
      f.fs(inspectie, m);
      at14[kindName(kind)] = m;
    }
  }
  // Een tweede startmijlpaal met een opvolger (ma 07:00), voor het tweede veld (alleen 8e).
  const startBouw2 = laterBegin ? f.milestone('Start bouw 2', 'START') : '';
  if (laterBegin) f.fs(startBouw2, f.hours('Grondwerk 2', 8));
  f.S().setStatusDate(undefined); // anders schuift F5 het niet-afgemelde werk naar de statusdatum
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
  // Eerst met statusdatum do 4 jun: dan is vr 5 jun ná de statusdatum. Een weigering laat de taak staan.
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
    // De opstelling van Sol (review ronde 5): taak van 6 u, FS-mijlpaal ma 14:00, statusdatum vr. Tweede
    // aanvulling van Ethan: de vrijdagdienst eindigt om 12:00, vóór de geplande 14:00 ⇒ het einde van die
    // dienst, vr 12:00 (fixronde 5; eerst vr 14:00, een uitwerking die met de aanvulling verviel).
    const lateId = f.at14[kindName(kind)];
    const late = enter(f, route, lateId, field, '2026-06-05');
    eq(`${tag}: Keuring 14:00 ${kindName(kind)} ⇒ vr 12:00, het einde van de vrijdagdienst`, [late, labelOf(f, lateId, late)], ['2026-06-05T12:00', '2026-06-05']);
    if (route !== 'MCP' && route !== 'functie') eq(`${tag}: de cel ${field} van Keuring 14:00 ${kindName(kind)} toont 05-06-2026`, cellText(f, lateId, `task.time.${field}`), '05-06-2026');
    const id = f.los[kindName(kind)];
    const lone = enter(f, route, id, field, '2026-06-05');
    const want = planned[id] === '2026-06-01T16:00' ? '2026-06-05T12:00' : '2026-06-05T07:00';
    eq(`${tag}: Los ${kindName(kind)} (${clockOf(planned[id])}) ⇒ ${clockOf(want)}`, [lone, labelOf(f, id, lone)], [want, '2026-06-05']);
  }
  // Een gewone taak houdt D1/D2: het begin en het einde van vr.
  eq(`${tag}: gewone taak houdt ${field === 'actualStart' ? 'D1 (07:00)' : 'D2 (12:00)'}`,
    enter(f, route, f.taak, field, '2026-06-05'), field === 'actualStart' ? '2026-06-05T07:00' : '2026-06-05T12:00');
}

// 8b. Het nachtvoorbeeld: ma–do 22:00–06:00, vr 22:00–02:00. De mijlpalen staan op di 2 jun 06:00, het einde
// van de dienst van ma (handmatig anker in elk profiel, en de losse mijlpalen in OPS, B6).
for (const profile of PROFILES) {
  const f = nightFixture(profile, undefined, nightShortFri);
  for (const c of f.cases) {
    eq(`nacht vr ${profile} voorwaarde: ${c.name} gepland di 2 jun 06:00`, shownStart(f.taskOf(c.id)), '2026-06-02T06:00');
    eq(`nacht vr ${profile} voorwaarde: ${c.name} toont 01-06-2026`, labelOf(f, c.id, shownStart(f.taskOf(c.id))), '2026-06-01');
  }
}
for (const profile of PROFILES) for (const route of ROUTES) {
  // Eén opstelling per profiel en route, met een eigen mijlpaal per veld (zoals 5b).
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

// 8c. De automatische route van Sol (review ronde 3): projectstart vr 5 jun, Berekenen, statusdatum za 6 jun,
// `06-06-2026` typen. In OPS staat een losse mijlpaal op het einde van de werkdag (B6): za 02:00, het einde
// van de vrijdagdienst; in P6 en MSP alleen FINISH, de andere op het begin (vr 22:00). Einde blijft einde:
// za heeft geen werkblok, dus de typische nacht (D4): einde zo 06:00, begin za 22:00. De tabel toont za.
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

// 8d. De gevallen uit de meting van ronde 3 (`meet-gevallen.ts`), op dezelfde kalender, met de uitkomst van
// optie 2 (`gevallen-proto-E.txt`) als verwachting, voor elke soort. Het veld wisselt per mijlpaal, zodat elk
// geval en elke soort beide velden krijgt.
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

// 8e. Een beginmijlpaal op het begin van zijn werkdag, afgemeld op een dag die later begint: het begin van
// de getypte dag. Kalender ma–do 07:00–16:00, vr 09:00–13:00.
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

// 8f. De uitwerking door de orkestrator, de aanvulling van Ethan voor een dienst die vóór de geplande kloktijd
// eindigt (voorheen knownbug 450, geval 1; zie ook 8j) en het geval dat besluit en uitwerking niet dekken
// (knownbug 454, gemeld in PR #724). Steeds geldt "de dag komt van wat je typt": het moment hoort bij de getypte
// werkdag.
{
  // Uitwerking (fixronde 3): de kloktijd valt in de dienst van een andere werkdag ⇒ de dichtstbijzijnde rand.
  // Ma–do 22:00–06:00, vr 22:00–02:00, za 04:00–12:00; di 05:00 (midden in de nacht van ma) op vr. Za 05:00 ligt
  // in de dienst van za én na het einde van de vrijdagdienst; sinds fixronde 5 beslist daar eerst de tweede
  // aanvulling van Ethan (het einde van die dienst). De uitkomst blijft za 02:00.
  const satShift = (c: WorkCalendar) => weekCalendar(c, weekOf(MON_THU, NIGHT, { 5: blocks([1320, 1560]), 6: blocks([240, 720]) }), 1);
  // Aanvulling van Ethan: de dienst van vr eindigt vóór de geplande kloktijd (za 05:00) ⇒ het einde van vr.
  // Knownbug 454 (ook zo op main): 24 uur ma–do, vr 00:00–12:00; START op vr 12:00, afgemeld op ma ⇒ di 00:00
  // leest START als di, dus het begin van ma.
  const SPECIAL = [
    { name: 'uitwerking: za-dienst', cal: satShift, kind: undefined, planned: '2026-06-02T05:00', typed: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05' },
    { name: 'uitwerking: za-dienst FINISH', cal: satShift, kind: 'FINISH' as const, planned: '2026-06-02T05:00', typed: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05' },
    { name: 'aanvulling 450: de vrijdagdienst eindigt vóór 05:00', cal: nightShortFri, kind: undefined, planned: '2026-06-02T05:00', typed: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05' },
    { name: 'aanvulling 450: de vrijdagdienst eindigt vóór 05:00, START', cal: nightShortFri, kind: 'START' as const, planned: '2026-06-02T05:00', typed: '2026-06-05', want: '2026-06-06T02:00', label: '2026-06-05' },
    { name: 'knownbug 454: START op het einde van een 24-uursvrijdag', cal: day24ShortFri, kind: 'START' as const, planned: '2026-06-05T12:00', typed: '2026-06-08', want: '2026-06-08T00:00', label: '2026-06-08' },
    { name: 'knownbug 454: FINISH houdt het einde', cal: day24ShortFri, kind: 'FINISH' as const, planned: '2026-06-05T12:00', typed: '2026-06-08', want: '2026-06-09T00:00', label: '2026-06-08' },
  ];
  // De gevallen van één kalender staan samen in één opstelling per profiel en route (review ronde 4: niet
  // voor elk geval dezelfde planning opnieuw opbouwen); ze hebben per kalender dezelfde getypte dag.
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

// 8g. De 48-uursrand (de proef `dagranden` van Sol toetste die op de verwijderde helper `freeDayEndingAt`):
// een blok ma 22:00–wo 00:00, de rest vrij. Het einde van za (D4) is ma 00:00; 23:59 en 00:01 zijn geen rand.
{
  const c48 = weekCalendar(createAppStoreContext().store.getState().calendar, { 1: blocks([1320, 2880]) }, 1);
  const clock = calendarClock(c48);
  eq('48 u: ma 00:00 is het einde van za', [milestoneWorkdayOf(clock, '2026-06-08T00:00', 'end'), workdayEdgeAt(clock, '2026-06-06', '2026-06-08T00:00')], ['2026-06-06', 'end']);
  eq('48 u: zo 23:59 is geen rand van za', workdayEdgeAt(clock, '2026-06-06', '2026-06-07T23:59'), null);
  eq('48 u: ma 00:01 is geen rand van za', workdayEdgeAt(clock, '2026-06-06', '2026-06-08T00:01'), null);
  eq('kalendertijd geen D4: zo 06:00 is zo, geen rand van za',
    [milestoneWorkdayOf(ELAPSED_CLOCK, '2026-06-07T06:00', 'end'), workdayEdgeAt(ELAPSED_CLOCK, '2026-06-06', '2026-06-07T06:00')], ['2026-06-07', null]);
}

// 8h. Een compacte kalenderselectie met vaste verwachtingen. Elke waarde hieronder is met de hand uit de
// regel afgeleid en letterlijk uitgeschreven; de test rekent niets na met een kopie van de zoeklus (review
// ronde 4 van #724: het vorige orakel speelde de productieregel na en bleef zo groen bij een fout). Per geval:
// de tabel bij de planning, het moment na afmelden, de tabel daarna, en de statuscontrole (de dag vóór de
// getypte dag geweigerd, de getypte dag zelf mag). Op helperniveau één veld en per kant één soort: START en
// zonder soort lezen allebei de startkant, en een nulduur-mijlpaal geeft beide velden dezelfde kant
// (`actualDateSide`). De routes hieronder toetsen alle soorten en beide velden.
//  - sol: ma 04:00–08:00, di–vr 22:00–06:00, weekend vrij (`solCal`); D4 geeft zo een verzonnen nacht tot
//    ma 06:00, midden in de echte maandagdienst;
//  - nacht: ma–do 22:00–06:00, vr 22:00–02:00;
//  - dag: ma–do 07:00–12:00 en 13:00–16:00, vr 07:00–12:00 (het voorbeeld van Ethan);
//  - 24u: ma–do 00:00–24:00, vr 00:00–12:00;
//  - 24u vol: ma–vr 00:00–24:00 (za 00:00 is een rand van een echte vr en een vrije za);
//  - sol5: ma 06:00–10:00, di–vr 22:00–06:00 (`sol5Cal`, review ronde 5): het D4-einde van zo valt op het echte
//    begin van ma;
//  - vroeg: ma 04:00–08:00, di–vr 07:00–16:00 (`earlyCal`, het voorbeeld van de orkestrator in fixronde 5);
//  - feestdag: ma–vr 22:00–06:00 met een feestdag op wo 3 jun (`holidayNight`).
// Elk verschil met main uit de vergelijking van fixronde 5 (main `14020335b`, alle kalenders hierboven, elke soort,
// de tabeldag van een geplande mijlpaal en de statuscontrole van een letterlijk getypte tijd) staat hieronder als
// vaste uitkomst, gemerkt "verschil met main" met de regel die het vraagt.
const FIXED_CALS = {
  sol: solCal, nacht: nightShortFri, dag: ethanCal, '24u': day24ShortFri, '24u vol': day24Full,
  sol5: sol5Cal, vroeg: earlyCal, feestdag: holidayNight,
} as const;
type FixedCal = keyof typeof FIXED_CALS;
const fixedCalendar = Object.fromEntries(Object.entries(FIXED_CALS)
  .map(([name, of]) => [name, of(createAppStoreContext().store.getState().calendar)])) as Record<FixedCal, WorkCalendar>;
/** De dagranden die de motor ziet (D1/D2, en D4 op een vrije dag), letterlijk. */
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
  { cal: 'sol', side: 'end', planned: '2026-06-03T02:00', plannedLabel: '2026-06-03T02:00', typed: '2026-06-03', want: '2026-06-04T02:00', label: '2026-06-04T02:00', why: 'midden in de nacht van di ⇒ midden in de nacht van wo (knownbug 451)' },
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
  { cal: 'dag', side: 'start', planned: '2026-06-01T18:00', plannedLabel: '2026-06-01T18:00', typed: '2026-06-05', want: '2026-06-05T18:00', label: '2026-06-05T18:00', why: 'buiten de werkspanne van ma (een handmatig anker): de geplande kloktijd blijft (B10); de aanvullingen gelden op een rand of midden in de dienst' },
  { cal: 'dag', side: 'end', planned: '2026-06-01T05:00', plannedLabel: '2026-06-01T05:00', typed: '2026-06-03', want: '2026-06-03T05:00', label: '2026-06-03T05:00', why: 'vóór de werkspanne van ma: de geplande kloktijd blijft (B10)' },
  { cal: 'dag', side: 'start', planned: '2026-06-01T12:30', plannedLabel: '2026-06-01T12:30', typed: '2026-06-02', want: '2026-06-02T12:30', label: '2026-06-02T12:30', why: 'in de pauze ⇒ dezelfde kloktijd' },
  { cal: '24u', side: 'end', planned: '2026-06-02T00:00', plannedLabel: '2026-06-01', typed: '2026-06-03', want: '2026-06-04T00:00', label: '2026-06-03', why: 'gedeelde rand, FINISH: einde van ma ⇒ einde van wo' },
  { cal: '24u', side: 'start', planned: '2026-06-02T00:00', plannedLabel: '2026-06-02', typed: '2026-06-03', want: '2026-06-03T00:00', label: '2026-06-03', why: 'gedeelde rand, START: begin van di ⇒ begin van wo' },
  { cal: '24u', side: 'end', planned: '2026-06-05T12:00', plannedLabel: '2026-06-05', typed: '2026-06-08', want: '2026-06-09T00:00', label: '2026-06-08', why: 'einde van vr ⇒ einde van ma' },
  { cal: '24u', side: 'start', planned: '2026-06-05T12:00', plannedLabel: '2026-06-05', typed: '2026-06-08', want: '2026-06-08T00:00', label: '2026-06-08', why: 'het einde van ma leest START als di ⇒ het begin van ma (knownbug 454, ook zo op main)' },
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
/** Letterlijk getypte momenten met een statusdatum zonder tijd. */
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
  // Review ronde 5: het echte begin van ma gaat voor het D4-einde van zo, zoals op main.
  { cal: 'sol5', side: 'end', value: '2026-06-01T06:00', status: '2026-05-31', want: 'geweigerd', label: '2026-06-01', why: 'FINISH op ma 06:00 is het echte begin van ma, niet het D4-einde van zo' },
  { cal: 'sol5', side: 'start', value: '2026-06-01T06:00', status: '2026-05-31', want: 'geweigerd', label: '2026-06-01', why: 'idem, startkant' },
  { cal: 'sol5', side: 'end', value: '2026-06-01T06:00', status: '2026-06-01', want: 'mag', why: 'op de statusdag ma' },
  // De verschillen met main. Statusregel 4: de tabel, het afmelden en de statuscontrole lezen één werkdag.
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
/** Een mijlpaal per soort als sjabloon; per geval krijgt hij het geplande moment. */
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
/** Zonder soort voor de startkant, FINISH voor de eindkant. */
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
// Dezelfde vaste gevallen langs vijf echte routes. Per kalender en route één berekende opstelling met alle
// gevallen van die kalender: per geval een anker per soort (de startkant: zonder soort en START; de eindkant:
// FINISH) en per statusdatum (de getypte dag: mag; de dag ervoor: geweigerd). Het profiel wisselt per
// kalender en route, zodat elke kalender alle drie de profielen krijgt; het veld wisselt per mijlpaal.
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

// 8i. Echte werktijd gaat voor een verzonnen D4-rand (review ronde 4 van #724, de berekende route van Sol).
// Kalender `solCal`: ma 04:00–08:00, di–vr 22:00–06:00, weekend vrij. Projectstart ma 1 jun, een taak van
// 2 u met FS-opvolgers als nulduur-mijlpaal, Berekenen. De voorganger begint ma 04:00; de mijlpalen staan
// ma 06:00, midden in de echte maandagdienst. De tabel toont "01-06-2026 06:00" (eerst "31-05-2026": D4 laat
// de vrije zo tot ma 06:00 lopen, en die rand won). Met statusdatum zo wordt `01-06-2026 06:00` geweigerd.
// Afgemeld met `02-06-2026` (statusdatum di) wordt het di 22:00: de dienst van di begint na de geplande 06:00,
// dus het begin van die dienst (uitwerking door de orkestrator, fixronde 5; eerst di 06:00). Elk profiel, elke
// soort, beide velden, elke route, en het gezondheidsrapport.
/** Een slanke opstelling: één voorganger van 2 u, en per soort en veld een nulduur-mijlpaal als opvolger
 *  (`type`); per element van `purposes` een eigen set. Projectstart ma 1 jun, Berekenen. */
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
/** DCMA en het gezondheidsrapport: dezelfde actuals `at` uit een bestand, rechtstreeks op de taak, daarna
 *  Berekenen. Met statusdatum zo liggen ze ná de statusdatum, met statusdatum ma niet. */
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

// 8j. Tweede aanvulling van Ethan op B10 (2026-10-29, vloot-wiki, alinea "Nog een aanvulling"; voorheen knownbug
// 450, geval 1): "Ligt de mijlpaal midden in een dienst, en eindigt de dienst van de getypte dag vóór de geplande
// kloktijd, dan krijgt hij het einde van die dienst. Voorbeeld: nachtdienst 22:00–06:00, op vrijdag 22:00–02:00.
// Een mijlpaal op dinsdag 05:00, afgemeld met "vrijdag", wordt zaterdag 02:00." (Het daggeval staat in 8a.)
// Kalender ma–do 22:00–06:00, vr 22:00–02:00, weekend vrij. De mijlpaal staat op di 2 jun 05:00 (handmatig
// anker, midden in de nacht van ma). Afgemeld met 05-06-2026: za 6 jun 02:00, het einde van de vrijdagdienst
// (letterlijk zou het za 05:00 zijn). De tabel toont "05-06-2026". Statusdatum do 4 jun ⇒ geweigerd; statusdatum
// vr 5 jun ⇒ geaccepteerd. Elk profiel, elke soort, beide velden, elke route (ook de celeditor met getypte tekst
// en het paneel, de setter). Eén opstelling per profiel en route, met een eigen mijlpaal per soort en veld.
/** De tekst van een cel in de tabel, zoals de planner hem ziet (notatie dmy, 24 uur). */
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
    // MCP schrijft op een losse kopie; daar toont de echte tabel niets nieuws.
    if (route !== 'MCP' && route !== 'functie') eq(`${tag}: de cel ${a.field} toont 05-06-2026`, cellText(f, id, `task.time.${a.field}`), '05-06-2026');
  });
}
// 8k. Een echt begin van ma gaat voor het verzonnen D4-einde van zo (review ronde 5 van #724, de berekende
// SS-route van Sol). Kalender `sol5Cal`: ma 06:00–10:00, di–vr 22:00–06:00, weekend vrij. Een taak van 2 u
// begint ma 06:00; nulduur-mijlpalen als SS-opvolger staan na Berekenen ma 06:00, ook FINISH, in elk profiel.
// Dat is het begin van ma en ook het D4-einde van de vrije zo. De tabel, de rapportformatter en de
// PDF-tekenroute tonen "01-06-2026" (B4: alleen de datum op het begin van de werkdag), zoals op main; eerst
// toonde FINISH "31-05-2026". Met statusdatum zo wordt `01-06-2026 06:00` geweigerd (eerst bij FINISH
// geaccepteerd), met statusdatum ma mag het. Afgemeld met `08-06-2026` wordt het ma 8 jun 06:00: begin blijft
// begin (eerst bij FINISH 10:00, het einde). Elk profiel, elke soort, beide velden, elke route, het
// gezondheidsrapport.
/** De datums die de PDF-tekenroute (`renderReport`, ook het afdrukvoorbeeld) in de tabelrij van elke taak
 *  tekent, per taak-id, van links naar rechts. */
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
    // MCP schrijft op een losse kopie; daar toont de echte tabel niets nieuws.
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

for (const failure of failures) console.log('XX ' + failure);
console.log(`Mijlpaal afmelden met de geplande tijd: ${checks} controles, ${failures.length} fouten`);
if (failures.length) process.exit(1);
