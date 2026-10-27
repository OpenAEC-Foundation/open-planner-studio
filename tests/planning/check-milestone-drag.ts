// Issue #691: een nulduurmijlpaal (ruit) verschuift met de muis, net als een balkbody, en houdt duur 0.
// Deze check pint
//   1. de rekenstap van die sleep (`resolveMilestoneHourDrag` bij uurzoom, `resolveMilestoneDayDrag` bij
//      dagzoom) op een kalender met een middagpauze, een korte vrijdag en een vrije dinsdag;
//   2. de landingskant (`milestoneSitsAtFinish`);
//   3. de keten met de echte store: slepen (dezelfde velden, kant en SNET als `useBarDrag`) → F5 → de
//      mijlpaal staat nog op het gesleepte moment (review #704 r1 punt 1, r2: nachtploeg en B6). Ook onder
//      werkdagencompressie vanaf een verborgen weekend (r1 punt 2).
// De hit-test (alleen body, geen randen, ook met één datum) staat in check-renderer-dateless.ts.
//
// Draait via run.sh. Exit 0 = alles groen.

import './domStub';
import { useAppStore } from '@/state/appStore';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { formatInstant, parseInstant } from '@/utils/dateUtils';
import {
  milestoneDragAnchor, milestoneSitsAtFinish, resolveMilestoneDayDrag, resolveMilestoneHourDrag,
} from '@/engine/renderer/hourBarDragMath';
import { resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { constraintForDraggedStart, isLooseDayEndMilestone, predecessorDrivenTaskIds } from '@/engine/startEditConstraint';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { dragWorkdaySteps } from '@/components/canvas/hooks/timelineSnap';
import { shownStart } from '@/utils/taskDates';
import type { MilestoneKind } from '@/types/task';
import type { SequenceType } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

const failures: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, expected: unknown): void {
  checks++;
  if (got !== expected) failures.push(`${label}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(got)}`);
}

const day = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const calendar: WorkCalendar = {
  id: 'mijlpaal-sleep',
  name: 'Mijlpaal sleep',
  description: '',
  workDays: [1, 2, 3, 4, 5],
  hoursPerDay: 8,
  workStartHour: 7,
  workEndHour: 16,
  holidays: [{ name: 'Vrije dinsdag', startDate: '2026-09-08', endDate: '2026-09-08' }],
  workTime: {
    byWeekday: {
      1: day, 2: day, 3: day, 4: day,
      // Korte vrijdag: alleen de ochtend.
      5: [{ start: 420, end: 720 }],
      6: [],
      7: [],
    },
  },
};
const engine = new CalendarEngine(calendar);

const at = (s: string) => new Date(`${s}:00Z`);
const show = (d: Date) => formatInstant(d, 'hour');

function hour(original: string, deltaMinutes: number, finishSide: boolean, snapMinutes = 60): string {
  const o = at(original);
  return show(resolveMilestoneHourDrag({
    calendar: engine, original: o, finishSide, candidate: new Date(o.getTime() + deltaMinutes * 60_000), snapMinutes,
  }));
}

function dayDrag(original: string, columns: number, finishSide: boolean, compressed = false): string {
  // Zelfde naadregel als `useBarDrag`: onder compressie telt een verborgen vrije dag vanaf zijn kant.
  const o = at(original);
  const anchor = compressed && !engine.isWorkDay(o) ? (finishSide ? engine.prevWorkInstant(o) : engine.nextWorkInstant(o)) : o;
  const workdaySteps = dragWorkdaySteps(anchor, finishSide ? 'end' : 'start', columns, engine, compressed, engine, calendar);
  return show(workdaySteps === 0 ? o : resolveMilestoneDayDrag({ calendar: engine, original: anchor, finishSide, workdaySteps }));
}

// ── 1. Landingskant ──────────────────────────────────────────────────────────────────────────────
const side = (t: string, kind: MilestoneKind | undefined, driven: boolean, loose = false) =>
  milestoneSitsAtFinish(engine, at(t), kind, driven, loose);
eq('eindmijlpaal: altijd eindkant', side('2026-09-07T07:00', 'FINISH', true), true);
eq('zonder soort, niet gestuurd, op een blokeinde: eindkant', side('2026-09-07T16:00', undefined, false), true);
eq('zonder soort, gestuurd (SNET), op een blokeinde: beginkant', side('2026-09-07T16:00', undefined, true), false);
eq('zonder soort, niet gestuurd, midden op de dag: beginkant', side('2026-09-07T10:00', undefined, false), false);
eq('losse mijlpaal (B6) midden op de dag: eindkant', side('2026-09-07T10:00', undefined, false, true), true);

// ── 2. Uurzoom ───────────────────────────────────────────────────────────────────────────────────
eq('beginkant ma 07:00, +2 u', hour('2026-09-07T07:00', 120, false), '2026-09-07T09:00');
eq('beginkant ma 07:00, +5 u valt op de pauze ⇒ volgend blokbegin', hour('2026-09-07T07:00', 300, false), '2026-09-07T13:00');
eq('eindkant ma 16:00, +1 u blijft op het blokeinde', hour('2026-09-07T16:00', 60, true), '2026-09-07T16:00');
eq('eindkant ma 16:00, −1 u', hour('2026-09-07T16:00', -60, true), '2026-09-07T15:00');
eq('eindkant ma 16:00, naar de vrije dinsdag ⇒ terug naar het vorige blokeinde', hour('2026-09-07T16:00', 16 * 60, true), '2026-09-07T16:00');
eq('eindkant ma 16:00, naar wo 08:00 (werktijd) landt daar', hour('2026-09-07T16:00', 40 * 60, true), '2026-09-09T08:00');
eq('beginkant ma 16:00 (gestuurd), +1 u ⇒ volgend blokbegin (wo, di is vrij)', hour('2026-09-07T16:00', 60, false), '2026-09-09T07:00');
eq('kwartiersnap: +20 min ⇒ +15 min', hour('2026-09-07T07:00', 20, false, 15), '2026-09-07T07:15');
eq('minder dan een halve snapstap ⇒ precies het oude moment, ook op een vrije dag', hour('2026-09-12T12:00', 10, false), '2026-09-12T12:00');

// ── 3. Dagzoom ───────────────────────────────────────────────────────────────────────────────────
eq('beginkant ma 07:00, twee kolommen ⇒ wo 07:00', dayDrag('2026-09-07T07:00', 2, false), '2026-09-09T07:00');
eq('eindkant do 16:00 naar de korte vrijdag ⇒ einde van die werkdag', dayDrag('2026-09-10T16:00', 1, true), '2026-09-11T12:00');
eq('eindkant ma 16:00 naar de vrije dinsdag ⇒ woensdag (sleeprichting)', dayDrag('2026-09-07T16:00', 1, true), '2026-09-09T16:00');
eq('terugslepen naar de vrije dinsdag ⇒ maandag', dayDrag('2026-09-09T16:00', -1, true), '2026-09-07T16:00');
eq('gestuurde mijlpaal op ma 16:00, één kolom ⇒ begin van de doeldag (di vrij ⇒ wo)', dayDrag('2026-09-07T16:00', 1, false), '2026-09-09T07:00');
eq('midden op de dag houdt de kloktijd', dayDrag('2026-09-07T10:30', 3, false), '2026-09-10T10:30');
eq('mijlpaal op zaterdag, beginkant, één kolom (zondag) ⇒ maandagbegin', dayDrag('2026-09-12T12:00', 1, false), '2026-09-14T07:00');
eq('naar zaterdag terugslepen ⇒ vrijdag, eindkant ⇒ einde korte vrijdag', dayDrag('2026-09-14T16:00', -2, true), '2026-09-11T12:00');
eq('geen kolom verschoven ⇒ blijft staan', dayDrag('2026-09-12T12:00', 0, false), '2026-09-12T12:00');
eq('compressie: zaterdag-eindmijlpaal, één kolom ⇒ telt vanaf vrijdag ⇒ einde maandag',
  dayDrag('2026-09-12T12:00', 1, true, true), '2026-09-14T16:00');
eq('compressie: zaterdag-beginmijlpaal, één kolom ⇒ telt vanaf maandag ⇒ dinsdagbegin',
  dayDrag('2026-09-12T12:00', 1, false, true), '2026-09-15T07:00');

// ── 4. Uurzoom onder compressie vanaf een verborgen weekend (review #704 r1, punt 2) ─────────────
{
  const axis = resolveGanttAxis({
    calendar: engine, compressNonWorkdays: true, origin: at('2026-09-07T00:00'), chartOriginX: 0, zoom: 480, scrollX: 0,
  });
  const original = at('2026-09-12T12:00');
  const pixelDelta = axis.dateToX(at('2026-09-14T08:00')) - axis.dateToX(original);
  const landed = resolveMilestoneHourDrag({
    calendar: engine, original, finishSide: true, candidate: axis.xToDate(axis.dateToX(original) + pixelDelta), snapMinutes: 60,
  });
  eq('compressie, uurzoom: eindmijlpaal op zaterdag naar ma 08:00 ⇒ ma 08:00, niet vrijdag 16:00', show(landed), '2026-09-14T08:00');
}

// ── 5. Slepen → F5 → zelfde moment (echte store) ─────────────────────────────────────────────────
const S = () => useAppStore.getState();

/** Precies wat `useBarDrag` bij één gebaar doet (zonder compressie), gevolgd door F5. Geeft het neergezette
 *  en het berekende moment terug. `amount` is kolommen (dagzoom) of uren (uurzoom). */
function dragThenCalculate(id: string, zoom: 'day' | 'hour', amount: number): { dropped: string; calculated: string } {
  const orig = S().tasks.find(t => t.id === id)!;
  const original = parseInstant(shownStart(orig));
  const driven = predecessorDrivenTaskIds(S().tasks, S().sequences).has(id);
  const loose = isLooseDayEndMilestone(orig, S().tasks, S().sequences,
    effectiveSchedulingOptions(S().project).milestoneWithoutPredecessorAtDayEnd);
  const eng = new CalendarEngine(calendarForEngine(S().calendar));
  const finishSide = milestoneSitsAtFinish(eng, original, orig.milestoneKind, driven, loose);
  const landed = zoom === 'day'
    ? resolveMilestoneDayDrag({
      calendar: eng, original, finishSide,
      workdaySteps: dragWorkdaySteps(original, finishSide ? 'end' : 'start', amount, new CalendarEngine(S().calendar), false, eng, S().calendar),
    })
    : resolveMilestoneHourDrag({ calendar: eng, original, finishSide, candidate: new Date(original.getTime() + amount * 3600_000), snapMinutes: 60 });
  const dropped = formatInstant(landed, 'hour');
  const anchor = formatInstant(milestoneDragAnchor(eng, landed, loose), 'hour');
  const snet = driven ? constraintForDraggedStart(orig, dropped, true) : undefined;
  S().updateTask(id, {
    time: { ...orig.time, scheduleStart: anchor, scheduleFinish: anchor, earlyStart: dropped, earlyFinish: dropped },
    ...(snet ? { constraint: snet.constraint } : {}),
  });
  S().runCPM();
  const after = S().tasks.find(t => t.id === id)!;
  eq(`duur blijft 0 (${orig.name})`, after.time.scheduleDuration, 0);
  return { dropped, calculated: shownStart(after) };
}

function project(byWeekday?: Record<number, { start: number; end: number }[]>): void {
  S().newProject();
  S().setProject({ startDate: '2026-09-07' });
  if (byWeekday) S().setCalendar({ ...S().calendar, workTime: { byWeekday } });
}
function milestone(name: string, kind: MilestoneKind | undefined, rel: SequenceType | null): string {
  const p = S().addTask({ name: `${name} voorganger` });
  const pt = S().tasks.find(t => t.id === p)!;
  S().updateTask(p, { time: { ...pt.time, scheduleDuration: 1, durationMinutes: undefined } });
  const m = S().addTask({ name, isMilestone: true, ...(kind ? { milestoneKind: kind } : {}) });
  if (rel) S().addSequence({ predecessorId: p, successorId: m, type: rel, lagDays: 0 });
  S().runCPM();
  return m;
}

const dayBlocks = [{ start: 420, end: 960 }];
const weekBlocks = { 1: dayBlocks, 2: dayBlocks, 3: dayBlocks, 4: dayBlocks, 5: dayBlocks, 6: [], 7: [] };
for (const explicit of [false, true]) {
  for (const kind of [undefined, 'START', 'FINISH'] as (MilestoneKind | undefined)[]) {
    for (const rel of [null, 'FINISH_START', 'FINISH_FINISH'] as (SequenceType | null)[]) {
      for (const zoom of ['day', 'hour'] as const) {
        // Naar links slepen met een voorganger is een SNET vóór wat de voorganger toelaat: F5 zet hem terug,
        // net als bij een balk. Dat pint deze check niet; alleen de vrije richtingen. Zonder voorganger staat
        // de mijlpaal op de projectstart, een ondergrens: die stap begint daarom een week verder (+7).
        for (const step of rel ? [1, 2] : [1, 2, -1]) {
          project(explicit ? weekBlocks : undefined);
          const m = milestone('M', kind, rel);
          const before = shownStart(S().tasks.find(t => t.id === m)!);
          const amount = zoom === 'day' ? step + (rel ? 0 : 7) : step * 3 + (rel ? 0 : 7 * 24);
          const { dropped, calculated } = dragThenCalculate(m, zoom, amount);
          const tag = `${explicit ? 'blokkalender' : 'standaardkalender'}, soort ${kind ?? '-'}, relatie ${rel ?? '-'}, ${zoom}zoom ${amount}`;
          eq(`F5 na slepen (${tag}, ${before} → ${dropped})`, calculated, dropped);
        }
      }
    }
  }
}

// Nachtploeg (review #704 r2, punt 1): blok ma–vr 22:00–06:00. Een losse mijlpaal staat na F5 op di 06:00
// (einde van het maandagblok). Eén kolom verder hoort wo 06:00 te zijn, niet wo 22:00 of do 06:00.
for (const kind of [undefined, 'START'] as (MilestoneKind | undefined)[]) {
  const night = [{ start: 1320, end: 1800 }];
  project({ 1: night, 2: night, 3: night, 4: night, 5: night, 6: [], 7: [] });
  const m = milestone(`nacht ${kind ?? '-'}`, kind, null);
  eq(`nachtploeg (${kind ?? '-'}): uitgangspunt na F5`, shownStart(S().tasks.find(t => t.id === m)!), '2026-09-08T06:00');
  const { dropped, calculated } = dragThenCalculate(m, 'day', 1);
  eq(`nachtploeg (${kind ?? '-'}): één kolom ⇒ einde van het volgende blok`, dropped, '2026-09-09T06:00');
  eq(`nachtploeg (${kind ?? '-'}): F5 houdt het`, calculated, dropped);
  const hour1 = dragThenCalculate(m, 'hour', -2);
  eq(`nachtploeg (${kind ?? '-'}): uurzoom −2 u, F5 houdt het`, hour1.calculated, hour1.dropped);
}

// Nachtploeg zonder B6 (P6-profiel): een mijlpaal met een ingevoerd moment op het einde van het maandagblok
// (di 06:00) staat aan de eindkant, ook al begint dat blok de dag ervoor. Zo telt de herkenning van het
// blokeinde (`milestoneSitsAtFinish`), niet B6.
{
  const night = [{ start: 1320, end: 1800 }];
  project({ 1: night, 2: night, 3: night, 4: night, 5: night, 6: [], 7: [] });
  S().setProject({ schedulingProfile: builtInProfile('p6') });
  const m = S().addTask({ name: 'nacht p6', isMilestone: true });
  const mt = S().tasks.find(t => t.id === m)!;
  S().updateTask(m, { time: { ...mt.time, scheduleStart: '2026-09-08T06:00', scheduleFinish: '2026-09-08T06:00' } });
  S().runCPM();
  eq('nachtploeg P6: uitgangspunt di 06:00', shownStart(S().tasks.find(t => t.id === m)!), '2026-09-08T06:00');
  const hourDrag = dragThenCalculate(m, 'hour', 3);
  eq('nachtploeg P6: +3 u (vrije tijd) blijft op het blokeinde', hourDrag.dropped, '2026-09-08T06:00');
  const { dropped, calculated } = dragThenCalculate(m, 'day', 1);
  eq('nachtploeg P6: één kolom ⇒ wo 06:00', dropped, '2026-09-09T06:00');
  eq('nachtploeg P6: F5 houdt het', calculated, dropped);
}

// B6 (review #704 r2, punt 2): een losse mijlpaal ma 16:00 → di 10:00 (uurzoom) → F5 → naar wo 07:00 → F5.
{
  project(weekBlocks);
  const m = milestone('los', undefined, null);
  eq('B6: uitgangspunt ma 16:00', shownStart(S().tasks.find(t => t.id === m)!), '2026-09-07T16:00');
  const first = dragThenCalculate(m, 'hour', 18);
  eq('B6: naar di 10:00', first.dropped, '2026-09-08T10:00');
  eq('B6: F5 houdt di 10:00', first.calculated, first.dropped);
  const second = dragThenCalculate(m, 'hour', 21);
  eq('B6: F5 houdt het moment na slepen naar wo 07:00', second.calculated, second.dropped);
}

// Handmatig gepland (review #704 r4): de motor neemt de opgeslagen datums letterlijk over, zonder B6. De sleep
// mag dan geen dagbegin als anker schrijven; het neergezette moment blijft na F5 staan.
for (const allDay of [false, true]) {
  S().newProject();
  S().setProject({ startDate: '2026-09-07' });
  if (allDay) {
    const b = [{ start: 0, end: 1440 }];
    S().setCalendar({
      ...S().calendar, workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 24,
      simpleBreakStartMinute: undefined, simpleBreakDurationMinutes: undefined,
      workTime: { byWeekday: { 1: b, 2: b, 3: b, 4: b, 5: b, 6: b, 7: b } },
    });
  } else {
    S().setCalendar({ ...S().calendar, workTime: { byWeekday: weekBlocks } });
  }
  const m = S().addTask({ name: `handmatig ${allDay ? '24/7' : 'blok'}`, isMilestone: true });
  S().runCPM();
  S().updateTask(m, { manuallyScheduled: true });
  S().runCPM();
  eq(`handmatig ${allDay ? '24/7' : 'blok'}: geen B6-mijlpaal`,
    isLooseDayEndMilestone(S().tasks.find(t => t.id === m)!, S().tasks, S().sequences, true), false);
  for (const zoom of ['day', 'hour'] as const) {
    const { dropped, calculated } = dragThenCalculate(m, zoom, zoom === 'day' ? 1 : 24);
    eq(`handmatig ${allDay ? '24/7' : 'blok'}, ${zoom}zoom: F5 houdt ${dropped}`, calculated, dropped);
    S().runCPM();
    eq(`handmatig ${allDay ? '24/7' : 'blok'}, ${zoom}zoom: tweede F5 houdt het`, shownStart(S().tasks.find(t => t.id === m)!), dropped);
  }
}

// 24/7 (review #704 r3): het dageinde om middernacht is ook het volgende blokbegin. Een losse mijlpaal blijft
// na slepen en F5 op het neergezette moment, met een scalaire en met een expliciete kalender, onder OPS (B6)
// en P6.
for (const profile of ['ops', 'p6'] as const) {
  for (const explicit of [false, true]) {
    for (const zoom of ['day', 'hour'] as const) {
      S().newProject();
      S().setProject({ startDate: '2026-09-07', schedulingProfile: builtInProfile(profile) });
      const allDay = [{ start: 0, end: 1440 }];
      S().setCalendar({
        ...S().calendar, workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 24,
        simpleBreakStartMinute: undefined, simpleBreakDurationMinutes: undefined,
        workTime: explicit ? { byWeekday: { 1: allDay, 2: allDay, 3: allDay, 4: allDay, 5: allDay, 6: allDay, 7: allDay } } : undefined,
      });
      const m = S().addTask({ name: `24/7 ${profile}`, isMilestone: true });
      S().runCPM();
      const before = shownStart(S().tasks.find(t => t.id === m)!);
      const tag = `24/7 ${profile}, ${explicit ? 'expliciet' : 'scalair'}, ${zoom}zoom`;
      const { dropped, calculated } = dragThenCalculate(m, zoom, zoom === 'day' ? 1 : 24);
      eq(`${tag}: één dag verder (${before} → ${dropped})`, parseInstant(dropped).getTime() - parseInstant(before).getTime(), 86_400_000);
      eq(`${tag}: F5 houdt het`, calculated, dropped);
      S().runCPM();
      eq(`${tag}: tweede F5 houdt het`, shownStart(S().tasks.find(t => t.id === m)!), dropped);
    }
  }
}

if (failures.length === 0) {
  console.log(`OK  milestone-drag: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  milestone-drag: ${failures.length} afwijking(en) van ${checks}`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}
