// Issue #691: een nulduurmijlpaal (ruit) verschuift met de muis, net als een balkbody, en houdt duur 0.
// Deze check pint
//   1. de rekenstap van die sleep (`resolveMilestoneHourDrag` bij uurzoom, `resolveMilestoneDayDrag` bij
//      dagzoom) op een kalender met een middagpauze, een korte vrijdag en een vrije dinsdag;
//   2. de landingskant (`milestoneSitsAtFinish`);
//   3. de keten met de echte store: slepen (dezelfde velden en dezelfde SNET als `useBarDrag`) → F5 → de
//      mijlpaal staat nog op het gesleepte moment (review #704 r1, punt 1). Ook onder werkdagencompressie
//      vanaf een verborgen weekend (punt 2).
// De hit-test (alleen body, geen randen, ook met één datum) staat in check-renderer-dateless.ts.
//
// Draait via run.sh. Exit 0 = alles groen.

import './domStub';
import { useAppStore } from '@/state/appStore';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { formatInstant, parseInstant } from '@/utils/dateUtils';
import {
  milestoneSitsAtFinish, resolveMilestoneDayDrag, resolveMilestoneHourDrag,
} from '@/engine/renderer/hourBarDragMath';
import { resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { constraintForDraggedStart, predecessorDrivenTaskIds } from '@/engine/startEditConstraint';
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
  return show(resolveMilestoneDayDrag({
    calendar: engine, axisCalendar: engine, compressed, original: at(original), finishSide, columns,
  }));
}

// ── 1. Landingskant ──────────────────────────────────────────────────────────────────────────────
const side = (t: string, kind: MilestoneKind | undefined, driven: boolean) => milestoneSitsAtFinish(engine, at(t), kind, driven);
eq('eindmijlpaal: altijd eindkant', side('2026-09-07T07:00', 'FINISH', true), true);
eq('zonder soort, niet gestuurd, op een blokeinde: eindkant', side('2026-09-07T16:00', undefined, false), true);
eq('beginmijlpaal, niet gestuurd, op een blokeinde (B6, losse mijlpaal): eindkant', side('2026-09-07T16:00', 'START', false), true);
eq('zonder soort, gestuurd (SNET), op een blokeinde: beginkant', side('2026-09-07T16:00', undefined, true), false);
eq('zonder soort, niet gestuurd, midden op de dag: beginkant', side('2026-09-07T10:00', undefined, false), false);

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

// ── 5. Slepen → F5 → zelfde moment (echte store, standaard- en blokkalender) ─────────────────────
const S = () => useAppStore.getState();
const blocks = [{ start: 420, end: 960 }];
for (const explicit of [false, true]) {
  for (const kind of [undefined, 'START', 'FINISH'] as (MilestoneKind | undefined)[]) {
    for (const rel of [null, 'FINISH_START', 'FINISH_FINISH'] as (SequenceType | null)[]) {
      for (const zoom of ['day', 'hour'] as const) {
        // Naar links slepen met een voorganger is een SNET vóór wat de voorganger toelaat: F5 zet hem terug,
        // net als bij een balk. Dat pint deze check niet; alleen de vrije richtingen. Zonder voorganger staat
        // de mijlpaal op de projectstart, een ondergrens: die stap begint daarom een week verder (+7).
        for (const step of rel ? [1, 2] : [1, 2, -1]) {
          S().newProject();
          S().setProject({ startDate: '2026-09-07' });
          if (explicit) {
            S().setCalendar({ ...S().calendar, workTime: { byWeekday: { 1: blocks, 2: blocks, 3: blocks, 4: blocks, 5: blocks, 6: [], 7: [] } } });
          }
          const p = S().addTask({ name: 'P' });
          const pt = S().tasks.find(t => t.id === p)!;
          S().updateTask(p, { time: { ...pt.time, scheduleDuration: 1, durationMinutes: undefined } });
          const m = S().addTask({ name: 'M', isMilestone: true, ...(kind ? { milestoneKind: kind } : {}) });
          if (rel) S().addSequence({ predecessorId: p, successorId: m, type: rel, lagDays: 0 });
          S().runCPM();
          const orig = S().tasks.find(t => t.id === m)!;
          const original = parseInstant(shownStart(orig));
          const driven = predecessorDrivenTaskIds(S().tasks, S().sequences).has(m);
          const eng = new CalendarEngine(calendarForEngine(S().calendar));
          const finishSide = milestoneSitsAtFinish(eng, original, kind, driven);
          const landed = zoom === 'day'
            ? resolveMilestoneDayDrag({ calendar: eng, axisCalendar: new CalendarEngine(S().calendar), compressed: false, original, finishSide, columns: step + (rel ? 0 : 7) })
            : resolveMilestoneHourDrag({ calendar: eng, original, finishSide, candidate: new Date(original.getTime() + (step * 3 + (rel ? 0 : 7 * 24)) * 3600_000), snapMinutes: 60 });
          const next = formatInstant(landed, 'hour');
          const snet = driven ? constraintForDraggedStart(orig, next, true) : undefined;
          S().updateTask(m, {
            time: { ...orig.time, scheduleStart: next, scheduleFinish: next, earlyStart: next, earlyFinish: next },
            ...(snet ? { constraint: snet.constraint } : {}),
          });
          S().runCPM();
          const after = S().tasks.find(t => t.id === m)!;
          const tag = `${explicit ? 'blokkalender' : 'standaardkalender'}, soort ${kind ?? '-'}, relatie ${rel ?? '-'}, ${zoom}zoom ${step}`;
          eq(`F5 na slepen (${tag}, ${shownStart(orig)} → ${next})`, shownStart(after), next);
          eq(`duur blijft 0 (${tag})`, after.time.scheduleDuration, 0);
        }
      }
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
