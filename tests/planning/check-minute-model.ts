// Fase F0 van "alleen uren" (spec docs/superpowers/specs/2026-10-20-alleen-uren-design.md): de dagregels
// en de migratiefunctie, nog niet aangesloten op de app.
//
//  §1 Werkdag van een moment (§0): standaardkalender, nachtblok di 22:00–wo 06:00 (einde wo 06:00 ⇒ di;
//     einde wo 02:00 ⇒ di), 24-uurskalender (einde di 00:00 ⇒ ma), kalendertijd (einde di 00:00 ⇒ ma;
//     einde di 12:00 ⇒ di), de 24:00-regel buiten de werkblokken.
//  §2 D1 en D2 met D4: eerste blokbegin en laatste blokeinde van de datum; nachtblok eindigt de dag
//     erna; weekend, feestdag en werkende uitzondering; ongelijke dagen (voorbeeldweek); kalendertijd;
//     een kalender zonder werkblokken valt terug op begin- en eindtijd.
//  §3 D3 per veld (kalendertijd: start 00:00, exclusief einde 00:00, inclusief einde 24:00) en D7
//     (mijlpaal: één moment voor zijn eigen velden; zonder soort START, met de hint AtDayEnd FINISH).
//  §4 migrateToMinuteModel: elk veld uit §4.2, baselines, externe ankers, projectdatums ongemoeid,
//     zuiver (bevroren invoer), idempotent en deterministisch, T1 alleen bij een oud bestand, de vlag
//     "omzetting open", meldingen voor wat niet om te zetten is.
import { freshPayload, type DocumentPayload } from '@/state/documentContract';
import {
  migrateToMinuteModel, normalizeTaskDate, taskDateContext, DayClockCache, constraintDateField,
  externalAnchorField, MINUTE_MODEL_TIME_MODEL, type TaskDateField, type TaskDateContext,
} from '@/state/migrations/minuteModel';
import {
  blocksClock, dayEndInstant, dayStartInstant, workdayOfInstant, ELAPSED_CLOCK, type DayClock,
} from '@/engine/calendar/workdayRules';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { makeBands } from '@/utils/effectiveWorkTime';
import { addCalendarDays, formatDate, parseDate } from '@/utils/dateUtils';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Baseline } from '@/types/baseline';

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

// ── Kalenders ──────────────────────────────────────────────────────────────────────────────────
// 2026-06-01 is een maandag. Feestdag do 4 jun; werkende uitzondering za 13 jun 08:00–12:00.
const STD: WorkCalendar = {
  id: 'cal-std', name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
  holidays: [{ name: 'Feest', startDate: '2026-06-04', endDate: '2026-06-04' }],
  workingExceptions: [{ name: 'Zaterdag', startDate: '2026-06-13', endDate: '2026-06-13', bands: [{ start: 480, end: 720 }] }],
};
const NIGHT: WorkCalendar = {
  id: 'cal-night', name: 'Nacht', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 22, workEndHour: 24, hoursPerDay: 8, holidays: [],
  workTime: makeBands([1, 2, 3, 4, 5], [{ start: 1320, end: 1800 }]),
};
const H24: WorkCalendar = {
  id: 'cal-24', name: '24 uur', description: '', workDays: [1, 2, 3, 4, 5, 6, 7],
  workStartHour: 0, workEndHour: 24, hoursPerDay: 24, holidays: [],
  workTime: makeBands([1, 2, 3, 4, 5, 6, 7], [{ start: 0, end: 1440 }]),
};
// Voorbeeldweek uit §0: ma–do 07:00–12:00 + 13:00–16:00, vr 07:00–12:00 + 13:00–14:00.
const WEEK: WorkCalendar = {
  id: 'cal-week', name: 'Voorbeeldweek', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: {
    byWeekday: {
      1: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      2: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      3: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      4: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      5: [{ start: 420, end: 720 }, { start: 780, end: 840 }],
      6: [], 7: [],
    },
  },
};
// Geen werkdagen: geen werkblokken af te leiden; D1/D2 vallen terug op begin- en eindtijd.
const NODAYS: WorkCalendar = { ...STD, id: 'cal-nodays', name: 'Geen werkdagen', workDays: [], holidays: [], workingExceptions: [] };
// Begin = einde: geen werkblokken en geen geldige tijden ⇒ geen moment.
const DEAD: WorkCalendar = { ...NODAYS, id: 'cal-dead', name: 'Dood', workStartHour: 8, workEndHour: 8 };

const std = blocksClock(STD);
const night = blocksClock(NIGHT);
const h24 = blocksClock(H24);
const week = blocksClock(WEEK);

// ── §1 Werkdag van een moment ─────────────────────────────────────────────────────────────────
{
  const w = (clock: DayClock, v: string, side: 'start' | 'end') => workdayOfInstant(clock, v, side);
  same('§1 std: einde di 16:00 ⇒ di', w(std, '2026-06-02T16:00', 'end'), '2026-06-02');
  same('§1 std: start di 07:00 ⇒ di', w(std, '2026-06-02T07:00', 'start'), '2026-06-02');
  same('§1 std: start di 16:00 (buiten blok) ⇒ di', w(std, '2026-06-02T16:00', 'start'), '2026-06-02');
  same('§1 std: einde di 07:00 (blokbegin, geen 00:00) ⇒ di', w(std, '2026-06-02T07:00', 'end'), '2026-06-02');
  same('§1 std: einde za 00:00 ⇒ vr (24:00-regel)', w(std, '2026-06-06T00:00', 'end'), '2026-06-05');
  same('§1 std: start za 00:00 ⇒ za', w(std, '2026-06-06T00:00', 'start'), '2026-06-06');
  same('§1 std: einde di 12:00 (einde ochtendblok) ⇒ di', w(std, '2026-06-02T12:00', 'end'), '2026-06-02');
  same('§1 std: einde za 12:00 zonder werkblok ⇒ za', w(std, '2026-06-06T12:00', 'end'), '2026-06-06');
  same('§1 std: einde feestdag do 12:00 zonder werkblok ⇒ do', w(std, '2026-06-04T12:00', 'end'), '2026-06-04');
  same('§1 std: einde ma 24:00 ⇒ ma', w(std, '2026-06-01T24:00', 'end'), '2026-06-01');

  same('§1 nacht: einde wo 06:00 ⇒ di', w(night, '2026-06-03T06:00', 'end'), '2026-06-02');
  same('§1 nacht: einde wo 02:00 ⇒ di', w(night, '2026-06-03T02:00', 'end'), '2026-06-02');
  same('§1 nacht: start wo 02:00 ⇒ di', w(night, '2026-06-03T02:00', 'start'), '2026-06-02');
  same('§1 nacht: start di 22:00 ⇒ di', w(night, '2026-06-02T22:00', 'start'), '2026-06-02');
  same('§1 nacht: start wo 06:00 (na het blok) ⇒ wo', w(night, '2026-06-03T06:00', 'start'), '2026-06-03');
  same('§1 nacht: einde wo 00:00 (midden in het blok van di) ⇒ di', w(night, '2026-06-03T00:00', 'end'), '2026-06-02');
  same('§1 nacht: einde za 06:00 (blok van vr) ⇒ vr', w(night, '2026-06-06T06:00', 'end'), '2026-06-05');
  same('§1 nacht: einde zo 02:00 zonder blok van za ⇒ zo', w(night, '2026-06-07T02:00', 'end'), '2026-06-07');
  same('§1 nacht: start zo 02:00 zonder blok van za ⇒ zo', w(night, '2026-06-07T02:00', 'start'), '2026-06-07');

  same('§1 24 uur: einde di 00:00 ⇒ ma', w(h24, '2026-06-02T00:00', 'end'), '2026-06-01');
  same('§1 24 uur: start di 00:00 ⇒ di', w(h24, '2026-06-02T00:00', 'start'), '2026-06-02');
  same('§1 24 uur: einde di 12:00 ⇒ di', w(h24, '2026-06-02T12:00', 'end'), '2026-06-02');

  same('§1 kalendertijd: einde di 00:00 ⇒ ma', w(ELAPSED_CLOCK, '2026-06-02T00:00', 'end'), '2026-06-01');
  same('§1 kalendertijd: einde di 12:00 ⇒ di', w(ELAPSED_CLOCK, '2026-06-02T12:00', 'end'), '2026-06-02');
  same('§1 kalendertijd: start di 00:00 ⇒ di', w(ELAPSED_CLOCK, '2026-06-02T00:00', 'start'), '2026-06-02');

  same('§1 datum zonder tijd blijft zoals hij is', w(std, '2026-06-02', 'end'), '2026-06-02');
  same('§1 onleesbaar ⇒ leeg', w(std, 'geen datum', 'end'), '');
  same('§1 moment met seconden telt als moment', w(std, '2026-06-02T16:00:00', 'end'), '2026-06-02');
}

// ── §2 D1 en D2 (met D4) ───────────────────────────────────────────────────────────────────────
{
  same('§2 std D1 ma ⇒ 07:00', dayStartInstant(std, '2026-06-01'), '2026-06-01T07:00');
  same('§2 std D2 ma ⇒ 16:00', dayEndInstant(std, '2026-06-01'), '2026-06-01T16:00');
  same('§2 std D4 feestdag do: D1 ⇒ 07:00', dayStartInstant(std, '2026-06-04'), '2026-06-04T07:00');
  same('§2 std D4 feestdag do: D2 ⇒ 16:00', dayEndInstant(std, '2026-06-04'), '2026-06-04T16:00');
  same('§2 std D4 za 6 jun: D2 ⇒ za 16:00, niet zo 00:00', dayEndInstant(std, '2026-06-06'), '2026-06-06T16:00');
  same('§2 std werkende uitzondering za 13 jun: D1 ⇒ 08:00', dayStartInstant(std, '2026-06-13'), '2026-06-13T08:00');
  same('§2 std werkende uitzondering za 13 jun: D2 ⇒ 12:00', dayEndInstant(std, '2026-06-13'), '2026-06-13T12:00');
  same('§2 nacht D1 di ⇒ di 22:00', dayStartInstant(night, '2026-06-02'), '2026-06-02T22:00');
  same('§2 nacht D2 di ⇒ wo 06:00', dayEndInstant(night, '2026-06-02'), '2026-06-03T06:00');
  same('§2 24 uur D2 ma ⇒ di 00:00 (24:00)', dayEndInstant(h24, '2026-06-01'), '2026-06-02T00:00');
  same('§2 voorbeeldweek D2 vr ⇒ 14:00', dayEndInstant(week, '2026-06-05'), '2026-06-05T14:00');
  same('§2 voorbeeldweek D4 za: blokken van ma–do (typische werkdag) ⇒ 16:00', dayEndInstant(week, '2026-06-06'), '2026-06-06T16:00');
  same('§2 voorbeeldweek D4 za: D1 ⇒ 07:00', dayStartInstant(week, '2026-06-06'), '2026-06-06T07:00');
  same('§2 kalendertijd D1 ⇒ 00:00', dayStartInstant(ELAPSED_CLOCK, '2026-06-02'), '2026-06-02T00:00');
  same('§2 kalendertijd D2 ⇒ 24:00', dayEndInstant(ELAPSED_CLOCK, '2026-06-02'), '2026-06-03T00:00');
  same('§2 geen werkdagen: D1 ⇒ begintijd', dayStartInstant(blocksClock(NODAYS), '2026-06-02'), '2026-06-02T07:00');
  same('§2 geen werkdagen: D2 ⇒ eindtijd', dayEndInstant(blocksClock(NODAYS), '2026-06-02'), '2026-06-02T16:00');
  same('§2 geen werkblokken en geen geldige tijd ⇒ null', dayEndInstant(blocksClock(DEAD), '2026-06-02'), null);
  same('§2 een moment is geen datum zonder tijd ⇒ null', dayStartInstant(std, '2026-06-02T07:00'), null);

  // De 24:00-regel (§4.2, T3): urentaak 24 u op een 24-uurskalender eindigt 2026-06-02T00:00, de dagtaak
  // van 1 d op 2026-06-01; op dagniveau gelijk.
  same('§2 24:00-regel: 24 u en 1 d gelijk op dagniveau',
    workdayOfInstant(h24, '2026-06-02T00:00', 'end'), workdayOfInstant(h24, '2026-06-01', 'end'));

  // Terug en heen: de werkdag van D1(d) en D2(d) is d, voor elke dag van drie weken (ook weekend,
  // feestdag en uitzondering via D4), op de kalenders zonder nachtblok. Het nachtblok met D4 op een
  // niet-werkdag valt buiten deze eigenschap (zie het rapport van F0).
  for (const [label, clock] of [['std', std], ['24 uur', h24], ['voorbeeldweek', week], ['kalendertijd', ELAPSED_CLOCK]] as const) {
    const bad: string[] = [];
    for (let i = 0; i < 21; i++) {
      const d = formatDate(addCalendarDays(parseDate('2026-06-01'), i));
      if (workdayOfInstant(clock, dayStartInstant(clock, d)!, 'start') !== d) bad.push(`D1 ${d}`);
      if (workdayOfInstant(clock, dayEndInstant(clock, d)!, 'end') !== d) bad.push(`D2 ${d}`);
    }
    same(`§2 ${label}: werkdag(D1(d)) = werkdag(D2(d)) = d`, bad, []);
  }
  const nightBad: string[] = [];
  for (let i = 0; i < 21; i++) {
    const d = formatDate(addCalendarDays(parseDate('2026-06-01'), i));
    const wd = new Date(`${d}T00:00Z`).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (workdayOfInstant(night, dayStartInstant(night, d)!, 'start') !== d) nightBad.push(`D1 ${d}`);
    if (workdayOfInstant(night, dayEndInstant(night, d)!, 'end') !== d) nightBad.push(`D2 ${d}`);
  }
  same('§2 nacht: werkdag(D1(d)) = werkdag(D2(d)) = d op werkdagen', nightBad, []);
}

// ── §3 D3 per veld en D7 ───────────────────────────────────────────────────────────────────────
function task(id: string, patch: Omit<Partial<Task>, 'time'> & { time?: Partial<Task['time']> } = {}): Task {
  const { time, ...rest } = patch;
  return {
    id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [],
    ...rest,
    time: { ...createDefaultTaskTime('2026-06-01', 1), ...time },
  } as Task;
}
{
  const elapsed: TaskDateContext = { clock: ELAPSED_CLOCK, milestoneKind: null };
  const d = '2026-06-02';
  const e = (field: TaskDateField) => normalizeTaskDate(d, field, elapsed);
  for (const f of ['scheduleStart', 'earlyStart', 'lateStart', 'actualStart', 'resume', 'constraintStart', 'baselineStart'] as const) {
    same(`§3 D3 ${f} ⇒ 00:00`, e(f), '2026-06-02T00:00');
  }
  for (const f of ['earlyFinish', 'scheduleFinish', 'baselineFinish'] as const) {
    same(`§3 D3 ${f} (exclusief) ⇒ 00:00 van die datum`, e(f), '2026-06-02T00:00');
  }
  for (const f of ['lateFinish', 'actualFinish', 'stop', 'deadline', 'constraintFinish', 'baselineFinishCompleted', 'externalAnchorFinish'] as const) {
    same(`§3 D3 ${f} (inclusief) ⇒ 24:00`, e(f), '2026-06-03T00:00');
  }

  const plain: TaskDateContext = { clock: std, milestoneKind: null };
  same('§3 gewone taak: earlyFinish ⇒ D2', normalizeTaskDate(d, 'earlyFinish', plain), '2026-06-02T16:00');
  same('§3 gewone taak: lateStart ⇒ D1', normalizeTaskDate(d, 'lateStart', plain), '2026-06-02T07:00');
  same('§3 gewone taak: baselineFinish ⇒ D2', normalizeTaskDate(d, 'baselineFinish', plain), '2026-06-02T16:00');
  same('§3 een moment blijft een moment', normalizeTaskDate('2026-06-02T11:00', 'earlyStart', plain), '2026-06-02T11:00');
  same('§3 leeg blijft leeg', normalizeTaskDate('', 'earlyStart', plain), '');

  const fin: TaskDateContext = { clock: std, milestoneKind: 'FINISH' };
  const sta: TaskDateContext = { clock: std, milestoneKind: 'START' };
  for (const f of ['scheduleStart', 'earlyStart', 'lateStart', 'actualStart', 'earlyFinish', 'lateFinish', 'baselineStart'] as const) {
    same(`§3 D7 FINISH: ${f} ⇒ D2`, normalizeTaskDate(d, f, fin), '2026-06-02T16:00');
    same(`§3 D7 START: ${f} ⇒ D1`, normalizeTaskDate(d, f, sta), '2026-06-02T07:00');
  }
  same('§3 D7 geldt niet voor een beperking (START-mijlpaal, FNLT ⇒ D2)', normalizeTaskDate(d, 'constraintFinish', sta), '2026-06-02T16:00');
  same('§3 D7 geldt niet voor een deadline (START-mijlpaal ⇒ D2)', normalizeTaskDate(d, 'deadline', sta), '2026-06-02T16:00');

  const clocks = new DayClockCache(STD, [STD, NIGHT]);
  same('§3 context: mijlpaal zonder soort ⇒ START',
    taskDateContext(task('m', { isMilestone: true, time: { scheduleDuration: 0 } }), clocks).milestoneKind, 'START');
  same('§3 context: mijlpaal zonder soort met hint AtDayEnd ⇒ FINISH',
    taskDateContext(task('m', { isMilestone: true, time: { scheduleDuration: 0 } }), clocks, new Set(['m'])).milestoneKind, 'FINISH');
  same('§3 context: FINISH-mijlpaal ⇒ FINISH',
    taskDateContext(task('m', { isMilestone: true, milestoneKind: 'FINISH', time: { scheduleDuration: 0 } }), clocks).milestoneKind, 'FINISH');
  same('§3 context: mijlpaal met duur ⇒ geen D7',
    taskDateContext(task('m', { isMilestone: true, time: { scheduleDuration: 2 } }), clocks).milestoneKind, null);
  same('§3 context: kalendertijd-taak ⇒ kalendertijd',
    taskDateContext(task('e', { time: { durationType: 'ELAPSEDTIME', scheduleDuration: 2 } }), clocks).clock.kind, 'elapsed');
  same('§3 context: kalendertijd-mijlpaal (duur 0) ⇒ werkblokken',
    taskDateContext(task('e', { isMilestone: true, time: { durationType: 'ELAPSEDTIME', scheduleDuration: 0 } }), clocks).clock.kind, 'blocks');
  const nightCtx = taskDateContext(task('n', { calendarId: 'cal-night' }), clocks);
  same('§3 context: taakkalender nacht ⇒ D2 di = wo 06:00', normalizeTaskDate(d, 'earlyFinish', nightCtx), '2026-06-03T06:00');

  same('§3 beperkingen: SNET/SNLT/MSO start, FNET/FNLT/MFO einde, ASAP/ALAP geen',
    ['SNET', 'SNLT', 'MSO', 'FNET', 'FNLT', 'MFO', 'ASAP', 'ALAP'].map(constraintDateField),
    ['constraintStart', 'constraintStart', 'constraintStart', 'constraintFinish', 'constraintFinish', 'constraintFinish', null, null]);
  same('§3 externe voorganger: eerste letter; externe opvolger: tweede letter',
    [externalAnchorField('predecessor', 'FS'), externalAnchorField('predecessor', 'FF'), externalAnchorField('predecessor', 'SS'),
      externalAnchorField('predecessor', 'SF'), externalAnchorField('successor', 'FS'), externalAnchorField('successor', 'FF'),
      externalAnchorField('successor', 'SF'), externalAnchorField('successor', 'SS')],
    ['externalAnchorFinish', 'externalAnchorFinish', 'externalAnchorStart', 'externalAnchorStart',
      'externalAnchorStart', 'externalAnchorFinish', 'externalAnchorFinish', 'externalAnchorStart']);
}

// ── §4 migrateToMinuteModel ────────────────────────────────────────────────────────────────────
function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}
function payloadWith(tasks: Task[], extra: Partial<DocumentPayload> = {}): DocumentPayload {
  const base = freshPayload();
  return {
    ...base,
    project: { ...base.project, calendarId: STD.id, startDate: '2026-06-01', statusDate: '2026-06-03', endDate: '2026-06-30' },
    calendar: STD,
    calendars: [STD, NIGHT, H24],
    tasks,
    ...extra,
  };
}
{
  // Een taak met elk startachtig en eindachtig veld uit §4.2 als datum zonder tijd.
  const full = task('A', {
    time: {
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-03', earlyStart: '2026-06-01', earlyFinish: '2026-06-03',
      lateStart: '2026-06-02', lateFinish: '2026-06-04', actualStart: '2026-06-01', actualFinish: '2026-06-06',
      resume: '2026-06-02', stop: '2026-06-02', completion: 1,
    },
    deadline: '2026-06-05',
    constraint: { type: 'SNET', date: '2026-06-01' },
    constraint2: { type: 'FNLT', date: '2026-06-05' },
    externalLinks: [
      { id: 'x1', direction: 'predecessor', relType: 'FS', anchorDate: '2026-05-29', sourceRef: { projectId: 'p', taskId: 't' }, sourceMissing: false },
      { id: 'x2', direction: 'successor', relType: 'SS', anchorDate: '2026-06-08', sourceRef: { projectId: 'p', taskId: 't' }, sourceMissing: false },
      { id: 'x3', direction: 'successor', relType: 'FS', anchorDate: '2026-06-08T09:00', sourceRef: { projectId: 'p', taskId: 't' }, sourceMissing: false },
    ],
  });
  const elapsedTask = task('E', {
    time: { durationType: 'ELAPSEDTIME', scheduleDuration: 1, earlyStart: '2026-06-01', earlyFinish: '2026-06-02', lateFinish: '2026-06-01' },
  });
  const ms = task('M', { isMilestone: true, milestoneKind: 'FINISH', time: { scheduleDuration: 0, earlyStart: '2026-06-05', earlyFinish: '2026-06-05' } });
  const msHint = task('H', { isMilestone: true, time: { scheduleDuration: 0, earlyStart: '2026-06-05', earlyFinish: '2026-06-05' } });
  const onNight = task('N', { calendarId: 'cal-night', time: { scheduleStart: '2026-06-02', scheduleFinish: '2026-06-02' } });
  const already = task('K', {
    time: { scheduleStart: '2026-06-01T07:00', scheduleFinish: '2026-06-01T16:00', earlyStart: '2026-06-01T07:00', earlyFinish: '2026-06-01T16:00', lateStart: '', lateFinish: '' },
  });
  const odd = task('O', { time: { scheduleStart: '2026-06-01T07:00', scheduleFinish: 'morgen', earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '' } });
  const baselines: Baseline[] = [{
    id: 'bl1', name: 'B1', createdAt: '2026-05-01T10:00', projectEnd: '2026-06-10', projectDuration: 8,
    tasks: [
      { taskId: 'A', start: '2026-06-01', finish: '2026-06-03', duration: 3, isMilestone: false },
      { taskId: 'E', start: '2026-06-01', finish: '2026-06-02', duration: 1, isMilestone: false },
      { taskId: 'M', start: '2026-06-05', finish: '2026-06-05', duration: 0, isMilestone: true, milestoneKind: 'FINISH' },
      { taskId: 'weg', start: '2026-06-02', finish: '2026-06-02', duration: 1, isMilestone: false },
    ],
  }];
  const input = deepFreeze(payloadWith([full, elapsedTask, ms, msHint, onNight, already, odd], { baselines }));
  const before = JSON.stringify(input);
  const { payload: out, report } = migrateToMinuteModel(input, { milestonesAtDayEnd: new Set(['H']) });
  same('§4 invoer onveranderd (zuiver, bevroren payload)', JSON.stringify(input), before);

  const A = out.tasks.find((t) => t.id === 'A')!;
  same('§4 A: startachtige velden ⇒ D1', [A.time.scheduleStart, A.time.earlyStart, A.time.lateStart, A.time.actualStart, A.time.resume],
    ['2026-06-01T07:00', '2026-06-01T07:00', '2026-06-02T07:00', '2026-06-01T07:00', '2026-06-02T07:00']);
  same('§4 A: eindachtige velden ⇒ D2', [A.time.scheduleFinish, A.time.earlyFinish, A.time.lateFinish, A.time.stop],
    ['2026-06-03T16:00', '2026-06-03T16:00', '2026-06-04T16:00', '2026-06-02T16:00']);
  same('§4 A: werkelijk einde op za 6 jun ⇒ za 16:00 (D4)', A.time.actualFinish, '2026-06-06T16:00');
  same('§4 A: deadline ⇒ D2', A.deadline, '2026-06-05T16:00');
  same('§4 A: SNET ⇒ D1, FNLT ⇒ D2', [A.constraint?.date, A.constraint2?.date], ['2026-06-01T07:00', '2026-06-05T16:00']);
  same('§4 A: externe ankers volgen de kant; een moment blijft', A.externalLinks?.map((x) => x.anchorDate),
    ['2026-05-29T16:00', '2026-06-08T07:00', '2026-06-08T09:00']);

  const E = out.tasks.find((t) => t.id === 'E')!;
  // Probe uit §4.2: kalendertijd-taak van 1 d vanaf ma 1 jun, earlyFinish 2 jun ⇒ di 00:00 (werkdag ma);
  // FNLT/late finish ma 1 jun ⇒ di 00:00 (24:00 van ma).
  same('§4 E (kalendertijd): earlyStart 00:00, earlyFinish exclusief, lateFinish inclusief',
    [E.time.earlyStart, E.time.earlyFinish, E.time.lateFinish], ['2026-06-01T00:00', '2026-06-02T00:00', '2026-06-02T00:00']);
  same('§4 E: werkdag van earlyFinish ⇒ ma', workdayOfInstant(ELAPSED_CLOCK, E.time.earlyFinish, 'end'), '2026-06-01');

  const M = out.tasks.find((t) => t.id === 'M')!;
  same('§4 M (FINISH-mijlpaal): één moment, D2', [M.time.earlyStart, M.time.earlyFinish], ['2026-06-05T16:00', '2026-06-05T16:00']);
  const H = out.tasks.find((t) => t.id === 'H')!;
  same('§4 H (zonder soort, hint AtDayEnd): D2', [H.time.earlyStart, H.time.earlyFinish], ['2026-06-05T16:00', '2026-06-05T16:00']);
  const N = out.tasks.find((t) => t.id === 'N')!;
  same('§4 N (nachtblok): start di 22:00, einde wo 06:00', [N.time.scheduleStart, N.time.scheduleFinish], ['2026-06-02T22:00', '2026-06-03T06:00']);
  same('§4 K (alleen momenten): dezelfde taak (identiteit)', out.tasks.find((t) => t.id === 'K') === already, true);

  const bl = out.baselines[0];
  same('§4 baseline: A start D1, einde D2', [bl.tasks[0].start, bl.tasks[0].finish], ['2026-06-01T07:00', '2026-06-03T16:00']);
  same('§4 baseline: E (kalendertijd, niet voltooid) einde 00:00', [bl.tasks[1].start, bl.tasks[1].finish], ['2026-06-01T00:00', '2026-06-02T00:00']);
  same('§4 baseline: M (FINISH-mijlpaal in de baseline) D2', [bl.tasks[2].start, bl.tasks[2].finish], ['2026-06-05T16:00', '2026-06-05T16:00']);
  same('§4 baseline: taak bestaat niet meer ⇒ projectkalender', [bl.tasks[3].start, bl.tasks[3].finish], ['2026-06-02T07:00', '2026-06-02T16:00']);
  same('§4 baseline: projectEnd ⇒ D2 op de projectkalender', bl.projectEnd, '2026-06-10T16:00');

  same('§4 projectdatums blijven zoals ingevoerd', [out.project.startDate, out.project.statusDate, out.project.endDate],
    ['2026-06-01', '2026-06-03', '2026-06-30']);
  same('§4 rapport: oud bestand ⇒ schemamigratie en vlag "omzetting open"', [report.legacyFile, report.conversionPending], [true, true]);
  // A: 10 tijdvelden + deadline + 2 beperkingen + 2 ankers = 15. E, M, H en N: elk de zes plan- en
  // rekendatums van `createDefaultTaskTime` = 4 × 6. K en O: geen. Baseline: 4 taken × 2 + projectEnd = 9.
  const expectedCount = 15 + 4 * 6 + 9;
  same('§4 rapport: aantal omgezette waarden', report.normalizedCount, expectedCount);
  same('§4 rapport: onleesbare waarde gemeld en ongemoeid', [report.unresolved.map((u) => [u.id, u.field, u.reason]),
    out.tasks.find((t) => t.id === 'O')!.time.scheduleFinish], [[['O', 'scheduleFinish', 'notADate']], 'morgen']);

  // Idempotent: nog een keer draaien verandert niets en telt niets.
  const again = migrateToMinuteModel(out, { milestonesAtDayEnd: new Set(['H']) });
  same('§4 idempotent: tweede keer dezelfde inhoud', JSON.stringify(again.payload), JSON.stringify(out));
  same('§4 idempotent: tweede keer niets omgezet', again.report.normalizedCount, 0);
  // Deterministisch: dezelfde invoer, dezelfde uitvoer.
  same('§4 deterministisch', JSON.stringify(migrateToMinuteModel(input, { milestonesAtDayEnd: new Set(['H']) }).payload), JSON.stringify(out));
  // Alleen momenten: dezelfde payload terug.
  const momentsOnly = payloadWith([already]);
  same('§4 niets om te zetten ⇒ dezelfde payload', migrateToMinuteModel(momentsOnly, { timeModel: MINUTE_MODEL_TIME_MODEL }).payload === momentsOnly, true);
}
{
  // §5.2 geval 9: een bestand mét TimeModel en een datum zonder tijd uit een ander programma ⇒ moment,
  // geen schemamigratie en geen vlag.
  const p = payloadWith([task('A', { time: { scheduleStart: '2026-06-02', scheduleFinish: '2026-06-02', earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '' } })]);
  const { payload: out, report } = migrateToMinuteModel(p, { timeModel: MINUTE_MODEL_TIME_MODEL });
  same('§4 met TimeModel: datum wordt moment', [out.tasks[0].time.scheduleStart, out.tasks[0].time.scheduleFinish], ['2026-06-02T07:00', '2026-06-02T16:00']);
  same('§4 met TimeModel: geen schemamigratie, geen vlag', [report.legacyFile, report.conversionPending, report.calendarRepairs.length], [false, false, 0]);
}
{
  // T1: uren per dag groter dan de spanne (08:00–16:00 met 10 u) ⇒ einde 18:00, één melding, ook al staat
  // de projectkalender twee keer in de payload. Daarna rekent de normalisatie met het herstelde einde.
  const LONG: WorkCalendar = { ...STD, id: 'cal-long', name: 'Lang', workStartHour: 8, workEndHour: 16, hoursPerDay: 10, holidays: [], workingExceptions: [] };
  const t = task('A', { time: { scheduleStart: '2026-06-02', scheduleFinish: '2026-06-02', earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '' } });
  const p = payloadWith([t], { calendar: LONG, calendars: [LONG] });
  const { payload: out, report } = migrateToMinuteModel(p);
  same('§4 T1: einde verlengd tot begin + uren per dag', [out.calendar.workEndHour, out.calendars[0].workEndHour], [18, 18]);
  same('§4 T1: één melding per kalender', report.calendarRepairs.map((r) => [r.calendarId, r.kind, r.before.workEndHour, r.after.workEndHour]),
    [['cal-long', 'extendEnd', 16, 18]]);
  same('§4 T1: normalisatie rekent met het herstelde einde', [out.tasks[0].time.scheduleStart, out.tasks[0].time.scheduleFinish],
    ['2026-06-02T08:00', '2026-06-02T18:00']);
  const withModel = migrateToMinuteModel(p, { timeModel: MINUTE_MODEL_TIME_MODEL });
  same('§4 T1 alleen bij een oud bestand', [withModel.payload.calendar.workEndHour, withModel.report.calendarRepairs.length], [16, 0]);
  same('§4 T1 idempotent', migrateToMinuteModel(out).report.calendarRepairs.length, 0);

  // Een ongeldige pauze (begin buiten de werkdag) vervalt, met melding; daarna de gewone afleiding.
  const BADBREAK: WorkCalendar = { ...STD, id: 'cal-break', name: 'Pauze', simpleBreakStartMinute: 1200, simpleBreakDurationMinutes: 30, holidays: [], workingExceptions: [] };
  const pb = migrateToMinuteModel(payloadWith([], { calendar: BADBREAK, calendars: [BADBREAK] }));
  same('§4 T1: ongeldige pauze vervalt', [pb.payload.calendar.simpleBreakStartMinute, pb.payload.calendar.simpleBreakDurationMinutes,
    'simpleBreakStartMinute' in pb.payload.calendar], [undefined, undefined, false]);
  same('§4 T1: melding dropBreak', pb.report.calendarRepairs.map((r) => r.kind), ['dropBreak']);

  // Uren per dag past niet vóór middernacht ⇒ geen herstel, wel een melding.
  const LATE: WorkCalendar = { ...STD, id: 'cal-late', name: 'Laat', workStartHour: 20, workEndHour: 22, hoursPerDay: 8, holidays: [], workingExceptions: [] };
  const pl = migrateToMinuteModel(payloadWith([], { calendar: LATE, calendars: [LATE] }));
  same('§4 T1: einde voorbij middernacht ⇒ melding, kalender ongemoeid',
    [pl.payload.calendar.workEndHour, pl.report.unresolved.map((u) => [u.where, u.id, u.reason])], [22, [['calendar', 'cal-late', 'endPastMidnight']]]);

  // Een kalender zonder werkblokken en zonder geldige tijden ⇒ de datum blijft, met melding.
  const pd = migrateToMinuteModel(payloadWith([task('Z', { time: { scheduleStart: '2026-06-02', scheduleFinish: '', earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '' } })],
    { calendar: DEAD, calendars: [DEAD] }), { timeModel: MINUTE_MODEL_TIME_MODEL });
  same('§4 geen werktijd: datum blijft, melding noWorkTime',
    [pd.payload.tasks[0].time.scheduleStart, pd.report.unresolved.map((u) => [u.id, u.field, u.reason])],
    ['2026-06-02', [['Z', 'scheduleStart', 'noWorkTime']]]);
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX ${f}`);
  console.log(`\n${failures.length}/${checks} minutenmodel-checks mislukt.`);
  process.exitCode = 1;
} else {
  console.log(`OK  minutenmodel (dagregels en migratie): ${checks} checks groen.`);
}
