// F4b, fixronde 3 (review r3 op PR #584): één tabel voor wat een planner als duur invoert.
//
// Faalgeval uit het rapport: een kalendertijdtaak, "1d 0u" in de Duur-cel. De oude minutenroute las dat
// (sinds ronde 2 terecht) als 1440 klokminuten, maar de transactie deelde ze door de WERKtijd per dag
// (8 u) en hield de eenheid dagen: 3 kalenderdagen, einde 4 juni 07:00. "1d 4u" werd 84 u in plaats van
// 28. De transactie geeft kalendertijd nu als expliciete duur door (`elapsedClockDuration`).
//
// De tabel: invoer × duurtype × profiel × route. Per rij na herberekenen: de opgeslagen eenheid, de
// opgeslagen waarde, het eindmoment en de duur in minuten (klokminuten bij kalendertijd, werkminuten
// anders). De verwachtingen staan letterlijk in `EXPECTED`, met de hand gerekend.
//  - Routes: de Duur-cel (typen + Enter: `parseGridEditorText` → `validate` → `planWrite` →
//    `runGridMutation`), plakken van de tekst op een andere taak (`planTaskGridPaste`), kopiëren van de
//    getypte cel naar een derde taak (`copyTaskGridSelection` + plakken), en paneel/dialoog (de parser
//    en de toepassing van `TaskDurationField`, hier nagebouwd, met `updateTask`).
//  - Elke taak start ma 1 juni 2026 07:00 en duurt vooraf 2 d van haar duurtype, zodat elke invoer
//    een wijziging is. Kalender: ma–vr 07–12 + 13–16 (8 u).
//
// Mutatiebewijs (2026-10-24, 177 rijen): de fix weg (stand c4bea0f21) ⇒ 30 rijen rood, met precies het
// faalgeval ("1d 0u" 3 d en einde 4 juni 07:00; "1d 4u" 3,5 d en 4 juni 19:00); kalendertijd altijd als
// urenmaat ⇒ 21 rood; dagen zonder exactheidstoets ⇒ 9 rood ("1d 4u" wordt 1,166667 d).
// Exit 0 = groen.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { createTaskGridAdapterDomain } from '@/engine/taskGrid/taskGridAdapter';
import { copyTaskGridSelection, planTaskGridPaste } from '@/engine/taskGrid/clipboard';
import { parseGridEditorText } from '@/engine/taskGrid/editors';
import { createTaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { createEmptyGridSelection, updateGridSelection } from '@/engine/taskGrid/selection';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { parseTaskDurationInput, taskDurationInputContext, type ParsedTaskDuration } from '@/utils/taskDurationInput';
import {
  effHoursPerDay, effectiveCalendarOf, effectiveDurationDisplay, hourTaskScheduleDuration, profileCountsWorkdays,
} from '@/utils/taskDuration';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { parseInstant } from '@/utils/dateUtils';
import type { WorkCalendar } from '@/types/calendar';
import type { DurationType, Task, TaskDurationUnit } from '@/types/task';
import type { CellEditIntent } from '@/types/taskGrid';
import type { ViewRow } from '@/engine/view/visibleRows';

declare const process: { exit(code: number): never };

const bands = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const week: WorkCalendar = {
  id: 'cal-week', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
  hoursPerDay: 8, holidays: [], workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
};
const engine = new CalendarEngine(calendarForEngine(week));
const DURATION = taskColumnId('task.time.scheduleDuration');
const NL_SUFFIXES: Record<string, string> = { 'duration.suffixDay': 'd', 'duration.suffixHour': 'u', 'duration.suffixMinute': 'm' };

type Profile = 'ops' | 'p6' | 'msproject';
type Route = 'cel' | 'plakken' | 'kopiëren' | 'paneel';
/** Wat er na herberekenen staat: eenheid, opgeslagen waarde (dagen of minuten), einde, duur in minuten. */
type Outcome = { unit: TaskDurationUnit; stored: number; finish: string; minutes: number };

const INPUTS = ['1d', '1,5d', '24u', '1d 0u', '1d 4u', '2,5d 3u', '5'] as const;
type Input = typeof INPUTS[number];
const COMPOUND: ReadonlySet<Input> = new Set(['1d 0u', '1d 4u', '2,5d 3u']);

const day = (stored: number, finish: string, minutes: number): Outcome => ({ unit: 'days', stored, finish, minutes });
const hour = (stored: number, finish: string): Outcome => ({ unit: 'hours', stored, finish, minutes: stored });

// Met de hand gerekend vanaf ma 1 juni 07:00.
// Werktijd OPS: "d" is de dagenmaat; samengesteld telt 1 d = 8 u en houdt de dagmaat.
// Werktijd P6/MSP (B8): "d" is de urenmaat, 1 d = 480 min; samengesteld houdt de dagmaat (8 u per dag).
// Kalendertijd, elk profiel: een dag is 24 klokuren; "1d 4u" = 28 u past niet op zes decimalen ⇒ uren.
const WORK_OPS: Record<Input, Outcome> = {
  '1d': day(1, '2026-06-01T16:00', 480),
  '1,5d': day(1.5, '2026-06-02T11:00', 720),
  '24u': hour(1440, '2026-06-03T16:00'),
  '1d 0u': day(1, '2026-06-01T16:00', 480),
  '1d 4u': day(1.5, '2026-06-02T11:00', 720),
  '2,5d 3u': day(2.875, '2026-06-03T15:00', 1380),
  '5': day(5, '2026-06-05T16:00', 2400),
};
const WORK_P6: Record<Input, Outcome> = {
  '1d': hour(480, '2026-06-01T16:00'),
  '1,5d': hour(720, '2026-06-02T11:00'),
  '24u': hour(1440, '2026-06-03T16:00'),
  '1d 0u': day(1, '2026-06-01T16:00', 480),
  '1d 4u': day(1.5, '2026-06-02T11:00', 720),
  '2,5d 3u': day(2.875, '2026-06-03T15:00', 1380),
  '5': day(5, '2026-06-05T16:00', 2400),
};
const ELAPSED: Record<Input, Outcome> = {
  '1d': day(1, '2026-06-02T07:00', 1440),
  '1,5d': day(1.5, '2026-06-02T19:00', 2160),
  '24u': hour(1440, '2026-06-02T07:00'),
  '1d 0u': day(1, '2026-06-02T07:00', 1440),
  '1d 4u': hour(1680, '2026-06-02T11:00'),
  '2,5d 3u': day(2.625, '2026-06-03T22:00', 3780),
  '5': day(5, '2026-06-06T07:00', 7200),
};
/** De beginstand (2 d): het paneel weigert samengestelde invoer, dan blijft dit staan. */
const START: Record<DurationType, Outcome> = {
  WORKTIME: day(2, '2026-06-02T16:00', 960),
  ELAPSEDTIME: day(2, '2026-06-03T07:00', 2880),
};

function expected(input: Input, type: DurationType, profile: Profile, route: Route): Outcome | 'geweigerd' {
  if (route === 'paneel' && COMPOUND.has(input)) return 'geweigerd';
  const typed = type === 'ELAPSEDTIME' ? ELAPSED[input] : profile === 'ops' ? WORK_OPS[input] : WORK_P6[input];
  // Kopiëren onder P6/MSP zet een dagmaat-werktaak als uren op het klembord (B8): de lengte blijft.
  if (route === 'kopiëren' && type === 'WORKTIME' && profile !== 'ops' && typed.unit === 'days') {
    return hour(typed.minutes, typed.finish);
  }
  return typed;
}

function fixture(profile: Profile) {
  const { store } = createAppStoreContext();
  const S = store.getState;
  S().setCalendar(week);
  S().setProject({ startDate: '2026-06-01', schedulingProfile: builtInProfile(profile) });
  const taskOf = (id: string): Task => S().tasks.find(t => t.id === id)!;
  const addTask = (name: string, type: DurationType, unit: TaskDurationUnit = 'days'): string => {
    const id = S().addTask({ name });
    const time = unit === 'days'
      ? { durationType: type, durationUnit: unit, scheduleDuration: 2, durationMinutes: undefined }
      : { durationType: type, durationUnit: unit, durationMinutes: type === 'ELAPSEDTIME' ? 2880 : 960, scheduleDuration: 2 };
    S().updateTask(id, { time: { ...taskOf(id).time, ...time } });
    return id;
  };
  const domain = () => {
    const s = S();
    const countsWorkdays = profileCountsWorkdays(s.project);
    return createTaskGridAdapterDomain({
      projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
      assignments: s.assignments, resources: s.resources, baselines: s.baselines,
      activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs, customTaskTypes: s.customTaskTypes,
      scheduleStale: s.scheduleStale, wbsAutoNumber: s.project.wbsAutoNumber === true,
      labelForColumn: key => key,
      labelForText: key => NL_SUFFIXES[key] ?? key,
      effectiveHoursPerDay: t => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
      effectiveCalendar: t => effectiveCalendarOf(t, s.calendar, s.calendars),
      durationDisplay: effectiveDurationDisplay('auto', countsWorkdays),
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
  /** Typen in de Duur-cel en Enter. */
  const typeCell = (text: string, id: string): boolean => {
    const d = domain();
    const descriptor = d.descriptorsById.get(DURATION)!;
    const task = taskOf(id);
    const parsed = parseGridEditorText(descriptor, text, task, d.context, 'dmy');
    if (!parsed.ok) return false;
    const validated = descriptor.validate!(parsed.value, task, d.context);
    if (!validated.ok) return false;
    const writes = descriptor.planWrite!(validated.value, task, d.context);
    return writes.ok && S().runGridMutation(writes.value).ok;
  };
  const paste = (text: string, id: string): boolean => {
    const planned = planTaskGridPaste(text, environment(id), { skipReadOnlyCells: true });
    return planned.ok && S().runGridMutation([planned.value]).ok;
  };
  const copy = (id: string): string => {
    const copied = copyTaskGridSelection(environment(id));
    return copied.ok ? copied.value : '';
  };
  /** Paneel en dialoog: dezelfde parser en dezelfde toepassing als `TaskDurationField`. */
  const panel = (text: string, id: string): boolean => {
    const task = taskOf(id);
    const s = S();
    const calendar = effectiveCalendarOf(task, s.calendar, s.calendars);
    const context = taskDurationInputContext(task, {
      countsWorkdays: profileCountsWorkdays(s.project), hoursPerDay: effHoursPerDay(calendar), display: 'auto',
    });
    const parsed: ParsedTaskDuration | null = parseTaskDurationInput(text, task.time.durationUnit, context);
    if (!parsed) return false;
    const time = { ...task.time, durationUnit: parsed.unit };
    if (parsed.unit === 'days') {
      time.scheduleDuration = parsed.scheduleDuration ?? 0;
      time.durationMinutes = undefined;
    } else {
      time.durationMinutes = parsed.durationMinutes ?? 0;
      time.scheduleDuration = hourTaskScheduleDuration(time.durationMinutes, calendar);
    }
    S().updateTask(id, { time });
    return true;
  };
  const outcome = (id: string): Outcome => {
    S().runCPM();
    const t = taskOf(id).time;
    const start = parseInstant(t.earlyStart!);
    const finish = parseInstant(t.earlyFinish!);
    const minutes = t.durationType === 'ELAPSEDTIME'
      ? (finish.getTime() - start.getTime()) / 60_000
      : engine.workMinutesBetween(start, finish);
    return {
      unit: t.durationUnit,
      stored: t.durationUnit === 'hours' ? t.durationMinutes! : t.scheduleDuration,
      finish: t.earlyFinish!,
      minutes,
    };
  };
  return { S, taskOf, addTask, typeCell, paste, copy, panel, outcome };
}

let rows = 0;
const failures: string[] = [];
function row(label: string, got: { accepted: boolean; outcome: Outcome }, want: Outcome | 'geweigerd', start: Outcome): void {
  rows++;
  const wantAccepted = want !== 'geweigerd';
  const wantOutcome = want === 'geweigerd' ? start : want;
  const a = JSON.stringify({ accepted: got.accepted, ...got.outcome });
  const b = JSON.stringify({ accepted: wantAccepted, ...wantOutcome });
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const type of ['WORKTIME', 'ELAPSEDTIME'] as const) {
    for (const input of INPUTS) {
      const label = (route: Route) => `${profile} ${type === 'ELAPSEDTIME' ? 'kalendertijd' : 'werktijd'} "${input}" ${route}`;
      // Duur-cel, en daarna kopiëren van die cel naar een andere taak.
      {
        const f = fixture(profile);
        const typed = f.addTask('Getypt', type);
        const other = f.addTask('Kopie', type);
        f.outcome(typed);
        const accepted = f.typeCell(input, typed);
        row(label('cel'), { accepted, outcome: f.outcome(typed) }, expected(input, type, profile, 'cel'), START[type]);
        const text = f.copy(typed);
        const pasted = f.paste(text, other);
        row(`${label('kopiëren')} (klembord "${text}")`, { accepted: pasted, outcome: f.outcome(other) },
          expected(input, type, profile, 'kopiëren'), START[type]);
      }
      // De tekst zelf plakken op een andere taak (bijvoorbeeld uit een rekenblad).
      {
        const f = fixture(profile);
        f.addTask('Andere', type);
        const target = f.addTask('Doel', type);
        f.outcome(target);
        const accepted = f.paste(input, target);
        row(label('plakken'), { accepted, outcome: f.outcome(target) }, expected(input, type, profile, 'plakken'), START[type]);
      }
      // Paneel en dialoog.
      {
        const f = fixture(profile);
        const id = f.addTask('Paneel', type);
        f.outcome(id);
        const accepted = f.panel(input, id);
        row(label('paneel'), { accepted, outcome: f.outcome(id) }, expected(input, type, profile, 'paneel'), START[type]);
      }
    }
  }
}

// Extra rijen: een kalendertijdtaak in uren, en de transactie met een los minutengetal (de oude route).
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  const startHours = hour(2880, '2026-06-03T07:00');
  {
    const f = fixture(profile);
    const id = f.addTask('Uren', 'ELAPSEDTIME', 'hours');
    f.outcome(id);
    const accepted = f.typeCell('1d 0u', id);
    row(`${profile} kalendertijd in uren "1d 0u" cel`, { accepted, outcome: f.outcome(id) }, hour(1440, '2026-06-02T07:00'), startHours);
  }
  {
    const f = fixture(profile);
    const id = f.addTask('Uren', 'ELAPSEDTIME', 'hours');
    f.outcome(id);
    const accepted = f.typeCell('1d 4u', id);
    row(`${profile} kalendertijd in uren "1d 4u" cel`, { accepted, outcome: f.outcome(id) }, hour(1680, '2026-06-02T11:00'), startHours);
  }
  {
    const f = fixture(profile);
    const id = f.addTask('Minuten', 'ELAPSEDTIME');
    f.outcome(id);
    const intent: CellEditIntent = { kind: 'cell-edit', taskId: id, columnId: DURATION, route: 'task-schedule', value: 1440 };
    const accepted = f.S().runGridMutation([intent]).ok;
    row(`${profile} kalendertijd: los minutengetal 1440 naar de transactie`, { accepted, outcome: f.outcome(id) },
      day(1, '2026-06-02T07:00', 1440), START.ELAPSEDTIME);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX  ${failure}`);
  console.log(`\n${failures.length}/${rows} rijen van de F4b-duurtabel mislukt.`);
  process.exit(1);
}
console.log(`OK  F4b review r3: ${rows} rijen van de duurtabel groen.`);
