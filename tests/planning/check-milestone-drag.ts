// Issue #691: een nulduurmijlpaal (ruit) verschuift met de muis, net als een balkbody, en houdt duur 0.
// Deze check pint de rekenstap van die sleep (`resolveMilestoneHourDrag` bij uurzoom,
// `resolveMilestoneDayDrag` bij dagzoom) op een kalender met een middagpauze, een korte vrijdag en een
// vrije dinsdag. De hit-test (alleen body, geen randen) staat in check-renderer-dateless.ts.
//
// Draait via run.sh. Exit 0 = alles groen.

import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { formatInstant } from '@/utils/dateUtils';
import { resolveMilestoneDayDrag, resolveMilestoneHourDrag } from '@/engine/renderer/hourBarDragMath';
import type { MilestoneKind } from '@/types/task';
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

function hour(original: string, deltaMinutes: number, kind?: MilestoneKind, snapMinutes = 60): string {
  const from = at('2026-09-07T10:00');
  return show(resolveMilestoneHourDrag({
    calendar: engine,
    original: at(original),
    milestoneKind: kind,
    pointerStart: from,
    pointerCurrent: new Date(from.getTime() + deltaMinutes * 60_000),
    snapMinutes,
  }));
}

function dayDrag(original: string, targetDay: string, direction: number, kind?: MilestoneKind): string {
  return show(resolveMilestoneDayDrag({
    calendar: engine,
    original: at(original),
    milestoneKind: kind,
    targetDay: new Date(`${targetDay}T00:00:00Z`),
    direction,
  }));
}

// ── Uurzoom ──────────────────────────────────────────────────────────────────────────────────────
eq('begin-mijlpaal ma 07:00, +2 u', hour('2026-09-07T07:00', 120, 'START'), '2026-09-07T09:00');
eq('begin-mijlpaal ma 07:00, +5 u valt op de pauze ⇒ volgend blokbegin', hour('2026-09-07T07:00', 300, 'START'), '2026-09-07T13:00');
eq('eind-mijlpaal ma 16:00, +1 u blijft op het blokeinde', hour('2026-09-07T16:00', 60, 'FINISH'), '2026-09-07T16:00');
eq('eind-mijlpaal ma 16:00, −1 u', hour('2026-09-07T16:00', -60, 'FINISH'), '2026-09-07T15:00');
eq('eind-mijlpaal ma 16:00, naar de vrije dinsdag ⇒ terug naar het vorige blokeinde',
  hour('2026-09-07T16:00', 16 * 60, 'FINISH'), '2026-09-07T16:00');
eq('eind-mijlpaal ma 16:00, naar wo 08:00 (werktijd) landt daar', hour('2026-09-07T16:00', 40 * 60, 'FINISH'), '2026-09-09T08:00');
eq('mijlpaal zonder soort op een blokeinde gedraagt zich als eind-mijlpaal', hour('2026-09-07T16:00', 60), '2026-09-07T16:00');
eq('mijlpaal zonder soort midden op de dag, op de pauze ⇒ volgend blokbegin', hour('2026-09-07T10:00', 120), '2026-09-07T13:00');
eq('kwartiersnap: +20 min ⇒ +15 min', hour('2026-09-07T07:00', 20, 'START', 15), '2026-09-07T07:15');
eq('geen verschuiving ⇒ precies het oude moment, ook op een vrije dag', hour('2026-09-12T12:00', 10, undefined, 60), '2026-09-12T12:00');

// ── Dagzoom ──────────────────────────────────────────────────────────────────────────────────────
eq('begin-mijlpaal ma 07:00 naar woensdag', dayDrag('2026-09-07T07:00', '2026-09-09', 1, 'START'), '2026-09-09T07:00');
eq('eind-mijlpaal do 16:00 naar de korte vrijdag ⇒ einde van die werkdag', dayDrag('2026-09-10T16:00', '2026-09-11', 1, 'FINISH'), '2026-09-11T12:00');
eq('eind-mijlpaal ma 16:00 naar de vrije dinsdag ⇒ woensdag (sleeprichting)', dayDrag('2026-09-07T16:00', '2026-09-08', 1, 'FINISH'), '2026-09-09T16:00');
eq('terugslepen naar de vrije dinsdag ⇒ maandag', dayDrag('2026-09-09T16:00', '2026-09-08', -1, 'FINISH'), '2026-09-07T16:00');
eq('mijlpaal midden op de dag houdt zijn kloktijd', dayDrag('2026-09-07T10:30', '2026-09-10', 1), '2026-09-10T10:30');
eq('mijlpaal zonder soort op het dagbegin landt op het nieuwe dagbegin', dayDrag('2026-09-10T07:00', '2026-09-11', 1), '2026-09-11T07:00');
eq('mijlpaal op zaterdag 12:00, naar zondag ⇒ maandag, kloktijd blijft', dayDrag('2026-09-12T12:00', '2026-09-13', 1), '2026-09-14T12:00');
eq('begin-mijlpaal op zaterdag naar maandag ⇒ dagbegin', dayDrag('2026-09-12T00:00', '2026-09-14', 1, 'START'), '2026-09-14T07:00');
eq('naar zaterdag terugslepen ⇒ vrijdag', dayDrag('2026-09-14T07:00', '2026-09-12', -1, 'START'), '2026-09-11T07:00');
eq('geen kolom verschoven ⇒ blijft staan', dayDrag('2026-09-12T12:00', '2026-09-12', 0), '2026-09-12T12:00');

if (failures.length === 0) {
  console.log(`OK  milestone-drag: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  milestone-drag: ${failures.length} afwijking(en) van ${checks}`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}
