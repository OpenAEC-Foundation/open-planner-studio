import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { formatInstant } from '@/utils/dateUtils';
import { resolveHourBarDrag } from '@/engine/renderer/hourBarDragMath';
import type { WorkCalendar } from '@/types/calendar';

const failures: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, expected: unknown): void {
  checks++;
  if (got !== expected) failures.push(`${label}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(got)}`);
}

const calendar: WorkCalendar = {
  id: 'uur-met-pauze',
  name: 'Uur met pauze',
  description: '',
  workDays: [1, 2, 3, 4, 5],
  hoursPerDay: 8,
  workStartHour: 7,
  workEndHour: 16,
  holidays: [{ name: 'Vrije dinsdag', startDate: '2026-09-08', endDate: '2026-09-08' }],
  workTime: {
    byWeekday: {
      1: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      2: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      3: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      4: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      5: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      6: [],
      7: [],
    },
  },
};

const engine = new CalendarEngine(calendar);
const monday7 = new Date('2026-09-07T07:00:00Z');
const monday16 = new Date('2026-09-07T16:00:00Z');

function drag(
  edge: 'body' | 'left' | 'right',
  from: string,
  to: string,
  start = monday7,
  finish = monday16,
  durationMinutes = 480,
  snapMinutes = 60,
) {
  return resolveHourBarDrag({
    calendar: engine,
    edge,
    originalStart: start,
    originalFinish: finish,
    originalDurationMinutes: durationMinutes,
    pointerStart: new Date(from),
    pointerCurrent: new Date(to),
    snapMinutes,
  });
}

// Body-drag bewaart de urenduur, maar plaatst met dezelfde werkbanden als CPM.
{
  const result = drag('body', '2026-09-07T07:00:00Z', '2026-09-07T12:00:00Z');
  eq('body over lunch start na pauze', formatInstant(result.start, 'hour'), '2026-09-07T13:00');
  eq('body over lunch eindigt na precies acht werkuren', formatInstant(result.finish, 'hour'), '2026-09-09T12:00');
  eq('body over lunch bewaart minuten', result.durationMinutes, 480);
}

// De feestdag op dinsdag telt niet als werktijd; een visuele beweging naar die dag landt woensdag.
{
  const result = drag('body', '2026-09-07T07:00:00Z', '2026-09-08T07:00:00Z');
  eq('body over feestdag start op volgende werkband', formatInstant(result.start, 'hour'), '2026-09-09T07:00');
  eq('body over feestdag eindigt acht werkuren later', formatInstant(result.finish, 'hour'), '2026-09-09T16:00');
}

// Een maandag-vrijdag kalender houdt ook de weekendnaad uit de werkduur.
{
  const friday7 = new Date('2026-09-11T07:00:00Z');
  const friday16 = new Date('2026-09-11T16:00:00Z');
  const result = drag('body', '2026-09-11T07:00:00Z', '2026-09-14T07:00:00Z', friday7, friday16);
  eq('body over weekend start maandag', formatInstant(result.start, 'hour'), '2026-09-14T07:00');
  eq('body over weekend eindigt maandag', formatInstant(result.finish, 'hour'), '2026-09-14T16:00');
}

// Rechterrand telt uitsluitend concrete werkminuten en schrijft weer een canonieke bandgrens.
{
  const result = drag('right', '2026-09-07T16:00:00Z', '2026-09-07T12:00:00Z');
  eq('rechterrand bij lunch eindigt op bandgrens', formatInstant(result.finish, 'hour'), '2026-09-07T12:00');
  eq('rechterrand bij lunch telt vijf werkuren', result.durationMinutes, 300);
}

// Linkerrand en kwartierschaal blijven uur-identiteit en precieze werkduur gebruiken.
{
  const left = drag('left', '2026-09-07T07:00:00Z', '2026-09-07T13:00:00Z');
  eq('linkerrand na pauze begint op 13:00', formatInstant(left.start, 'hour'), '2026-09-07T13:00');
  eq('linkerrand na pauze telt drie werkuren', left.durationMinutes, 180);

  const quarter = drag('body', '2026-09-07T07:00:00Z', '2026-09-07T07:16:00Z', monday7, monday16, 480, 15);
  eq('kwartiersnap start op 07:15', formatInstant(quarter.start, 'hour'), '2026-09-07T07:15');
  eq('kwartiersnap behoudt acht werkuren', quarter.durationMinutes, 480);

  const shortQuarter = drag(
    'body', '2026-09-07T07:00:00Z', '2026-09-07T07:16:00Z',
    monday7, new Date('2026-09-07T07:15:00Z'), 15, 15,
  );
  eq('kwartiersleep bewaart een bestaande kwartierduur', shortQuarter.durationMinutes, 15);
  eq('kwartiersleep verplaatst die duur zonder stil naar een uur te groeien', formatInstant(shortQuarter.finish, 'hour'), '2026-09-07T07:30');
}

if (failures.length > 0) {
  console.error(`XX hour-bar-drag: ${failures.length} afwijking(en) van ${checks}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`OK hour-bar-drag: ${checks} checks groen`);
