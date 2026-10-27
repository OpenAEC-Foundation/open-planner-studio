// F4b, fixronde 4 (review r4 op PR #584): een duurwijziging op een LOPENDE kalendertijdtaak houdt het
// verrichte deel, ook via het paneel en "Taak bewerken" (store-route).
//
// Faalgeval: `durationEditProgress` (`src/engine/work/workRuleApply.ts`) mat bij een eenheidswissel de
// oude duur met de werktijd per dag die de aanroeper meegaf. Een kalendertijdtaak van 2 d (2880
// klokminuten) telde zo als 960 minuten. Met 12 u verricht gaf "24u" in het paneel 16,67 % (nog 4 u
// verricht), "8u" werd geaccepteerd (korter dan de 12 u), en de eenheidswissel naar uren gaf 8,33 %.
// Nu telt de functie de dag zelf uit het duurtype: 24 klokuren bij kalendertijd (besluit van de
// orkestrator 2026-10-24: de functie mag daarvoor gewijzigd worden).
//
// Routes: het paneel (de parser en de eenheidswissel van `TaskDurationField`, hier nagebouwd, met
// `updateTask`) en "Taak bewerken" (`createTaskDialogSave`, met dezelfde concepttijd). Elk profiel
// (OPS, P6, MSP), een kalendertijdtaak en een werktijdtaak als controle: werktijd verandert niet.
// Elke taak: 2 d in dagen, werkelijke start ma 1 juni 2026 07:00, 25 % gereed, statusdatum di 2 juni
// 07:00. Kalender: ma–vr 07–12 + 13–16 (8 u). Verricht: werktijd 240 werkmin, kalendertijd 720 klokmin.
// Per rij na herberekenen: eenheid, opgeslagen waarde, verricht, rest, percentage en einde; een
// geweigerde invoer laat de taak precies staan. De AI-route staat in tests/mcp/cases-duration-progress.ts.
// Exit 0 = groen.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { createTaskDialogSave } from '@/state/taskDialogSave';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { convertTaskDurationUnit, parseTaskDurationInput, taskDurationInputContext } from '@/utils/taskDurationInput';
import { effHoursPerDay, effectiveCalendarOf, hourTaskScheduleDuration, profileCountsWorkdays } from '@/utils/taskDuration';
import type { WorkCalendar } from '@/types/calendar';
import type { DurationType, Task, TaskDurationUnit, TaskTime } from '@/types/task';

declare const process: { exit(code: number): never };

const bands = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const week: WorkCalendar = {
  id: 'cal-week', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
  hoursPerDay: 8, holidays: [], workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
};

type Profile = 'ops' | 'p6' | 'msproject';
type Route = 'paneel' | 'dialoog';
type Edit = '24u' | '8u' | '1d 4u' | 'eenheid uren';
const EDITS: readonly Edit[] = ['24u', '8u', '1d 4u', 'eenheid uren'];
type Outcome = { unit: TaskDurationUnit; stored: number; done: number; rest: number; completion: number; finish: string };
type Want = Outcome | 'geweigerd';

// Met de hand gerekend. Nieuw % = verricht ÷ nieuw totaal; rest = nieuw totaal − verricht.
// Het restwerk begint op de statusdatum di 2 juni 07:00 (onder MSP is "start + verricht" eerder, A22).
//  Kalendertijd (verricht 720 klokmin): "24u" = 1440 ⇒ 50 %, rest 720 ⇒ di 19:00; "8u" = 480 < 720 ⇒
//    geweigerd; eenheid uren = 2 × 1440 = 2880 ⇒ 25 %, rest 2160 ⇒ wo 3 juni 19:00.
//  Werktijd (verricht 240 werkmin): "24u" = 1440 ⇒ 16,6667 %, rest 1200 ⇒ di 480 + wo 480 + do 240 ⇒
//    do 4 juni 11:00; "8u" = 480 ⇒ 50 %, rest 240 ⇒ di 11:00; eenheid uren = 2 × 480 = 960 ⇒ 25 %,
//    rest 720 ⇒ di 480 + wo 240 ⇒ wo 3 juni 11:00.
//  "1d 4u": het paneel en de dialoog lezen geen samengestelde duur (de parser weigert, de taak blijft).
const WANT: Record<DurationType, Record<Edit, Want>> = {
  ELAPSEDTIME: {
    '24u': { unit: 'hours', stored: 1440, done: 720, rest: 720, completion: 0.5, finish: '2026-06-02T19:00' },
    '8u': 'geweigerd',
    '1d 4u': 'geweigerd',
    'eenheid uren': { unit: 'hours', stored: 2880, done: 720, rest: 2160, completion: 0.25, finish: '2026-06-03T19:00' },
  },
  WORKTIME: {
    '24u': { unit: 'hours', stored: 1440, done: 240, rest: 1200, completion: 0.166667, finish: '2026-06-04T11:00' },
    '8u': { unit: 'hours', stored: 480, done: 240, rest: 240, completion: 0.5, finish: '2026-06-02T11:00' },
    '1d 4u': 'geweigerd',
    'eenheid uren': { unit: 'hours', stored: 960, done: 240, rest: 720, completion: 0.25, finish: '2026-06-03T11:00' },
  },
};

function fixture(profile: Profile) {
  const ctx = createAppStoreContext();
  const S = ctx.store.getState;
  S().setCalendar(week);
  S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-02T07:00', schedulingProfile: builtInProfile(profile) });
  const taskOf = (id: string): Task => S().tasks.find(t => t.id === id)!;
  const addTask = (type: DurationType): string => {
    const id = S().addTask({ name: 'Lopend' });
    S().updateTask(id, { time: {
      ...taskOf(id).time, durationType: type, durationUnit: 'days', scheduleDuration: 2, durationMinutes: undefined,
      actualStart: '2026-06-01T07:00', completion: 0.25,
    } });
    return id;
  };
  /** De concepttijd die `TaskDurationField` maakt: getypte duur of een eenheidswissel. `null` = geweigerd. */
  const draftTime = (id: string, edit: Edit): TaskTime | null => {
    const task = taskOf(id);
    const s = S();
    const calendar = effectiveCalendarOf(task, s.calendar, s.calendars);
    const countsWorkdays = profileCountsWorkdays(s.project);
    if (edit === 'eenheid uren') {
      const next = convertTaskDurationUnit(task, 'hours', calendar, { workdayDurationMeasure: countsWorkdays });
      if (!next || next.unit !== 'hours') return null;
      const minutes = next.durationMinutes ?? 0;
      return { ...task.time, durationUnit: 'hours', durationMinutes: minutes, scheduleDuration: hourTaskScheduleDuration(minutes, calendar) };
    }
    const context = taskDurationInputContext(task, { countsWorkdays, hoursPerDay: effHoursPerDay(calendar), display: 'auto' });
    const parsed = parseTaskDurationInput(edit, task.time.durationUnit, context);
    if (!parsed) return null;
    if (parsed.unit === 'days') {
      return { ...task.time, durationUnit: 'days', scheduleDuration: parsed.scheduleDuration ?? 0, durationMinutes: undefined };
    }
    const minutes = parsed.durationMinutes ?? 0;
    return { ...task.time, durationUnit: 'hours', durationMinutes: minutes, scheduleDuration: hourTaskScheduleDuration(minutes, calendar) };
  };
  const apply = (id: string, edit: Edit, route: Route): void => {
    const time = draftTime(id, edit);
    if (!time) return;
    if (route === 'paneel') {
      S().updateTask(id, { time });
      return;
    }
    const task = taskOf(id);
    createTaskDialogSave(ctx)({
      editingTaskId: id, draft: { ...task, time }, startDate: task.time.earlyStart || task.time.scheduleStart,
      initialDuration: { unit: task.time.durationUnit, scheduleDuration: task.time.scheduleDuration, durationMinutes: task.time.durationMinutes },
    });
  };
  const round6 = (n: number) => Number(n.toFixed(6));
  const outcome = (id: string): Outcome => {
    S().runCPM();
    const t = taskOf(id).time;
    const perDay = t.durationType === 'ELAPSEDTIME' ? 24 * 60 : 8 * 60;
    const hours = t.durationUnit === 'hours';
    const total = hours ? t.durationMinutes! : t.scheduleDuration * perDay;
    const rest = hours
      ? t.remainingMinutes ?? (1 - t.completion) * total
      : (t.remainingTime ?? (1 - t.completion) * t.scheduleDuration) * perDay;
    return {
      unit: t.durationUnit, stored: hours ? t.durationMinutes! : t.scheduleDuration,
      done: round6(t.completion * total), rest: round6(rest), completion: round6(t.completion), finish: t.earlyFinish!,
    };
  };
  const taskJson = (id: string) => JSON.stringify(taskOf(id));
  return { addTask, apply, outcome, taskJson };
}

let rows = 0;
const failures: string[] = [];
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  for (const type of ['ELAPSEDTIME', 'WORKTIME'] as const) {
    for (const edit of EDITS) {
      for (const route of ['paneel', 'dialoog'] as const) {
        rows++;
        const f = fixture(profile);
        const id = f.addTask(type);
        f.outcome(id);
        const before = f.taskJson(id);
        f.apply(id, edit, route);
        const got = f.outcome(id);
        const want = WANT[type][edit];
        const label = `${profile} ${type === 'ELAPSEDTIME' ? 'kalendertijd' : 'werktijd'} "${edit}" ${route}`;
        if (want === 'geweigerd') {
          if (f.taskJson(id) !== before) failures.push(`${label}: verwacht geweigerd en de taak ongewijzigd, kreeg ${JSON.stringify(got)}`);
        } else if (JSON.stringify(got) !== JSON.stringify(want)) {
          failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
        }
      }
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX  ${failure}`);
  console.log(`\n${failures.length}/${rows} rijen van de paneel- en dialoogtabel mislukt.`);
  process.exit(1);
}
console.log(`OK  F4b review r4: ${rows} rijen (paneel en dialoog, lopende taak) groen.`);
