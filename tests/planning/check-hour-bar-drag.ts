import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { formatInstant } from '@/utils/dateUtils';
import { ELAPSED_DRAG_CLOCK, resolveHourBarDrag } from '@/engine/renderer/hourBarDragMath';
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

// Kalendertijd (ELAPSEDTIME, aanval na #600 fout 2): de sleep rekent op de klok, met 1440 minuten per dag en
// zonder snap naar een werkmoment. 2 d van ma 00:00 tot wo 00:00, bij Dag één dag naar rechts: di 00:00 –
// do 00:00 (48 klokuren). Met de werkkalender werd dat di 07:00 – wo 16:00.
{
  const elapsed = (edge: 'body' | 'left' | 'right', to: string) => resolveHourBarDrag({
    calendar: ELAPSED_DRAG_CLOCK, edge,
    originalStart: new Date('2026-06-01T00:00:00Z'), originalFinish: new Date('2026-06-03T00:00:00Z'),
    originalDurationMinutes: 2880,
    pointerStart: new Date('2026-06-01T12:00:00Z'), pointerCurrent: new Date(to), snapMinutes: 1440,
  });
  const body = elapsed('body', '2026-06-02T12:00:00Z');
  eq('kalendertijd: body +1 dag begint di 00:00', formatInstant(body.start, 'hour'), '2026-06-02T00:00');
  eq('kalendertijd: body +1 dag eindigt do 00:00', formatInstant(body.finish, 'hour'), '2026-06-04T00:00');
  eq('kalendertijd: body houdt 48 klokuren', body.durationMinutes, 2880);
  const right = elapsed('right', '2026-06-02T12:00:00Z');
  eq('kalendertijd: rechterrand +1 dag eindigt do 00:00', formatInstant(right.finish, 'hour'), '2026-06-04T00:00');
  eq('kalendertijd: rechterrand +1 dag telt 72 klokuren', right.durationMinutes, 4320);
  const weekend = elapsed('body', '2026-06-06T12:00:00Z');
  eq('kalendertijd: een start op zaterdag blijft zaterdag 00:00', formatInstant(weekend.start, 'hour'), '2026-06-06T00:00');
}

// Een gesplitste urentaak (aanval na #600 fout 3): de balk spant werk plus pauzes (de splitsom van de motor), en
// een rand verandert alleen het laatste werkstuk. 1920 min met een pauze van 480 min na 480 min, in een week
// zonder de vrije dinsdag van deze kalender (14–18 september): ma werk, di pauze, wo–vr werk.
{
  const gaps = [{ afterMinutes: 480, gapMinutes: 480, source: 'user' as const }];
  const split = (edge: 'body' | 'left', to: string) => resolveHourBarDrag({
    calendar: engine, edge, splitGaps: gaps,
    originalStart: new Date('2026-09-14T07:00:00Z'), originalFinish: new Date('2026-09-18T16:00:00Z'),
    originalDurationMinutes: 1920,
    pointerStart: new Date('2026-09-14T12:00:00Z'), pointerCurrent: new Date(to), snapMinutes: 1440,
  });
  const left = split('left', '2026-09-15T12:00:00Z');
  eq('splits: linkerrand +1 dag begint di', formatInstant(left.start, 'hour'), '2026-09-15T07:00');
  eq('splits: linkerrand +1 dag houdt het einde', formatInstant(left.finish, 'hour'), '2026-09-18T16:00');
  eq('splits: linkerrand +1 dag maakt het werk een dag korter', left.durationMinutes, 1440);
  const far = split('left', '2026-09-18T12:00:00Z');
  eq('splits: de linkerrand houdt het laatste werkstuk ten minste een uur', far.durationMinutes, 480 + 60);
  const body = split('body', '2026-09-15T12:00:00Z');
  eq('splits: body +1 dag houdt de pauze in het einde', formatInstant(body.finish, 'hour'), '2026-09-21T16:00');
}

if (failures.length > 0) {
  console.error(`XX hour-bar-drag: ${failures.length} afwijking(en) van ${checks}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`OK hour-bar-drag: ${checks} checks groen`);
