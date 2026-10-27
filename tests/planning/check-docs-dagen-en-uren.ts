// De getallen van de gids "Dagen en uren" (`public/docs/{nl,en}/uitleg-dagen-en-uren.md`) en van de
// lagvoorbeelden in "Relaties" en "Relaties leggen", doorgerekend met de ECHTE store.
//
// Waarom: na de urenomzetting (#600) beschreef de gids nog de oude regels — een dagtaak die nooit
// midden op een dag begint, een lag in uren die na een dagtaak op hele dagen afrondt, en `1.5d` dat
// geweigerd wordt. Niemand merkte het, want geen check rekende de gids na (aanval a11). Verandert de
// rekenkern, dan wordt deze check rood en moet de gids mee.
//
// Profiel: Open Planner Studio (de standaard), tenzij een blok iets anders zegt. Kalender: de
// standaardkalender, ma–vr 07:00–12:00 en 13:00–16:00 (8 uur). Projectstart ma 7 juni 2027.
//
// Exit 0 = alles groen. De exitcode is het enige geldige oordeel.

import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { convertTaskDurationUnit, parseTaskDurationInput } from '@/utils/taskDurationInput';
import { profileCountsWorkdays } from '@/utils/taskDuration';
import { parseLagInput } from '@/utils/lagFormat';
import type { Sequence } from '@/types/sequence';

declare const process: { exit(code: number): never };

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

type Profile = 'ops' | 'p6' | 'msproject';
function fixture(profile: Profile = 'ops', start = '2027-06-07') {
  const ctx = createAppStoreContext();
  const S = ctx.store.getState;
  S().setProject({ startDate: start, schedulingProfile: builtInProfile(profile) });
  const taskOf = (id: string) => S().tasks.find(t => t.id === id)!;
  const day = (name: string, days: number): string => {
    const id = S().addTask({ name });
    S().updateTask(id, { time: { ...taskOf(id).time, durationUnit: 'days', scheduleDuration: days, durationMinutes: undefined } });
    return id;
  };
  const hour = (name: string, hours: number): string => {
    const id = S().addTask({ name });
    S().updateTask(id, { time: { ...taskOf(id).time, durationUnit: 'hours', durationMinutes: hours * 60, scheduleDuration: hours / 8 } });
    return id;
  };
  const fs = (a: string, b: string, lag: Partial<Sequence> = {}) =>
    S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0, ...lag });
  /** Vroeg begin en vroeg einde na Bereken. */
  const span = (id: string) => [taskOf(id).time.earlyStart, taskOf(id).time.earlyFinish];
  const measure = () => ({ workdayDurationMeasure: profileCountsWorkdays(S().project) });
  return { S, taskOf, day, hour, fs, span, measure };
}

/** Kalender met een vrije vrijdagmiddag: ma–do 8 uur, vr 07:00–12:00. */
function freeFridayAfternoon(f: ReturnType<typeof fixture>): void {
  const full = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
  f.S().setCalendar({ ...f.S().calendar, workTime: { byWeekday: { 1: full, 2: full, 3: full, 4: full, 5: [{ start: 420, end: 720 }], 6: [], 7: [] } } });
}

// ── Het begrip: een dagtaak mag een deel van een dag duren ─────────────────────────────────
{
  same('1.5d wordt gelezen als 1,5 dag', parseTaskDurationInput('1.5d', 'days'), { unit: 'days', scheduleDuration: 1.5, explicitUnit: true });
  same('1,5d ook', parseTaskDurationInput('1,5d', 'days'), { unit: 'days', scheduleDuration: 1.5, explicitUnit: true });
  const f = fixture();
  const id = f.day('Anderhalf', 1.5);
  f.S().runCPM();
  same('1,5d vanaf ma 07:00 eindigt di 11:00', f.span(id), ['2027-06-07T07:00', '2027-06-08T11:00']);
}

// ── Een taak in dagen: 5 dagen eindigt op dezelfde dag bij 6 of 8 uur per dag ─────────────
{
  for (const end of [16, 14]) {
    const f = fixture();
    f.S().setCalendar({ ...f.S().calendar, workEndHour: end, hoursPerDay: end === 16 ? 8 : 6 });
    const id = f.day('Vijf dagen', 5);
    f.S().runCPM();
    same(`5d op een dag tot ${end}:00 eindigt vrijdag 11 juni`, f.span(id)[1]?.slice(0, 10), '2027-06-11');
  }
}

// ── Eenheidswissel ──────────────────────────────────────────────────────────────────────────
{
  const f = fixture();
  const d = f.day('Twee dagen', 2);
  const h = f.hour('Twaalf uur', 12);
  f.S().runCPM();
  same('2d wordt 16u', convertTaskDurationUnit(f.taskOf(d), 'hours', f.S().calendar, f.measure()), { unit: 'hours', durationMinutes: 960, explicitUnit: true });
  same('12u wordt 1,5d', convertTaskDurationUnit(f.taskOf(h), 'days', f.S().calendar, f.measure()), { unit: 'days', scheduleDuration: 1.5, explicitUnit: true });
}

// ── Rekenvoorbeeld: de kraan ────────────────────────────────────────────────────────────────
{
  const f = fixture();
  const crane = f.hour('Kraan plaatsen', 12);
  const adjust = f.hour('Stelwerk', 8);
  const finish = f.day('Afwerken', 2);
  f.fs(crane, adjust);
  f.fs(adjust, finish);
  f.S().runCPM();
  same('Kraan plaatsen 12u', f.span(crane), ['2027-06-07T07:00', '2027-06-08T11:00']);
  same('Stelwerk 8u', f.span(adjust), ['2027-06-08T11:00', '2027-06-09T11:00']);
  same('Afwerken 2d begint wo 11:00', f.span(finish), ['2027-06-09T11:00', '2027-06-11T11:00']);
}
{
  const f = fixture();
  const crane = f.hour('Kraan plaatsen', 12);
  const finish = f.day('Afwerken', 2);
  f.fs(crane, finish);
  f.S().runCPM();
  same('Afwerken direct na de kraan', f.span(finish), ['2027-06-08T11:00', '2027-06-10T11:00']);
  same('…en de kraan houdt geen speling', f.taskOf(crane).time.totalFloat, 0);
}
{
  const f = fixture();
  const pour = f.day('Storten fundering', 2);
  const crane = f.hour('Kraan plaatsen', 4);
  f.fs(pour, crane);
  f.S().runCPM();
  same('Storten fundering 2d', f.span(pour), ['2027-06-07T07:00', '2027-06-08T16:00']);
  same('Kraan 4u daarna', f.span(crane), ['2027-06-09T07:00', '2027-06-09T11:00']);
}
{
  const f = fixture();
  const crane = f.hour('Kraan plaatsen', 12);
  const adjust = f.hour('Stelwerk', 8);
  f.fs(crane, adjust, parseLagInput('2u')!);
  f.S().runCPM();
  same('Stelwerk met lag 2u', f.span(adjust), ['2027-06-08T14:00', '2027-06-09T14:00']);
}
for (const [lag, want] of [
  ['', ['2027-06-09T07:00', '2027-06-10T16:00']],
  ['4u', ['2027-06-09T11:00', '2027-06-11T11:00']],
  ['1u', ['2027-06-09T08:00', '2027-06-11T08:00']],
] as const) {
  const f = fixture();
  const pour = f.day('Storten fundering', 2);
  const finish = f.day('Afwerken', 2);
  f.fs(pour, finish, parseLagInput(lag)!);
  f.S().runCPM();
  same(`Afwerken na Storten fundering, lag '${lag}'`, f.span(finish), want);
}

// ── Een vrijdagmiddag vrij, onder OPS, P6 en MSP ──────────────────────────────────────────
for (const [profile, fiveDays, switched] of [
  ['ops', ['2027-06-07T07:00', '2027-06-11T12:00'], 2220],
  ['p6', ['2027-06-07T07:00', '2027-06-14T10:00'], 2400],
  ['msproject', ['2027-06-07T07:00', '2027-06-14T10:00'], 2400],
] as const) {
  const f = fixture(profile);
  freeFridayAfternoon(f);
  const forty = f.hour('Veertig uur', 40);
  const five = f.day('Vijf dagen', 5);
  f.S().runCPM();
  same(`${profile}: 40u eindigt ma 14 juni 10:00`, f.span(forty), ['2027-06-07T07:00', '2027-06-14T10:00']);
  same(`${profile}: 5d`, f.span(five), fiveDays);
  same(`${profile}: 5d naar uren`, convertTaskDurationUnit(f.taskOf(five), 'hours', f.S().calendar, f.measure())?.durationMinutes, switched);
}

// ── Lag in "Relaties": Fundering storten (5 wd) klaar vr 18 juni 2027, Wanden metselen (2 wd) ─
for (const [lag, want] of [
  ['', '2027-06-21T07:00'],
  ['3', '2027-06-24T07:00'],
  ['3ed', '2027-06-22T07:00'],
  ['-1', '2027-06-18T07:00'],
  ['40%', '2027-06-23T07:00'],
  ['50%', '2027-06-23T11:00'],
  ['2u', '2027-06-21T09:00'],
  ['4u', '2027-06-21T11:00'],
  ['12u', '2027-06-22T11:00'],
  ['1,5', '2027-06-22T11:00'],
] as const) {
  const f = fixture('ops', '2027-06-14');
  const pour = f.day('Fundering storten', 5);
  const walls = f.day('Wanden metselen', 2);
  f.fs(pour, walls, parseLagInput(lag)!);
  f.S().runCPM();
  same(`Wanden metselen, lag '${lag}'`, f.span(walls)[0], want);
}
same('lag 1,5 blijft 1,5 werkdag', parseLagInput('1,5')?.lagDays, 1.5);

// ── Rest bij voortgang: niet afgerond op hele dagen ────────────────────────────────────────
{
  const f = fixture();
  const id = f.day('Twee dagen', 2);
  f.S().runCPM();
  f.S().setProject({ statusDate: '2027-06-08' });
  f.S().setTaskProgress(id, 0.75);
  f.S().runCPM();
  same('2d op 75 % heeft 0,5d rest', f.taskOf(id).time.remainingTime, 0.5);
}

if (failures.length > 0) {
  for (const line of failures) console.log(`XX ${line}`);
  console.log(`check-docs-dagen-en-uren: ${failures.length} van ${checks} controles ROOD`);
  process.exit(1);
}
console.log(`OK  check-docs-dagen-en-uren: ${checks} controles groen`);
