import {
  computeSplitSegments, enumerateTaskWorkDays, splitDayPattern, splitGapsFromWorkDayBlocks,
} from '@/engine/scheduler/splitWalk';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { Task, TaskSplitGap } from '@/types/task';
import { splitTotalSpanDays } from '@/engine/scheduler/duration';
import type { WorkCalendar } from '@/types/calendar';
import { parseDate, formatDate, parseInstant, formatInstant } from '@/utils/dateUtils';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

const DAY_CAL: WorkCalendar = {
  id: 'cal-day-split-walk', name: 'dag', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const eng = new CalendarEngine(DAY_CAL);

const HOUR_CAL: WorkCalendar = {
  id: 'cal-hour-split-walk', name: 'uur', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: {
    1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
    4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [],
  } },
};
const hourEng = new CalendarEngine(HOUR_CAL);

const SIX_DAY_CAL: WorkCalendar = {
  id: 'cal-six-day-split-walk', name: 'zesdaags', description: '', workDays: [1, 2, 3, 4, 5, 6],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const sixDayEng = new CalendarEngine(SIX_DAY_CAL);

const gaps: TaskSplitGap[] = [
  { afterMinutes: 480, gapMinutes: 480 },
  { afterMinutes: 1440, gapMinutes: 480 },
];

console.log('-- split-walk: splitDayPattern --');
eq('patroon werk/gat-blokken', splitDayPattern(gaps, 480, 3),
   [{ work: 1, gap: 1 }, { work: 1, gap: 1 }, { work: 1, gap: 0 }]);
eq('zonder gaten: één blok', splitDayPattern(undefined, 480, 4), [{ work: 4, gap: 0 }]);
eq('durationDays=0 ⇒ gedocumenteerd leeg blok', splitDayPattern(gaps, 480, 0), [{ work: 0, gap: 0 }]);

const gapsWithNaN: TaskSplitGap[] = [...gaps.slice(0, 1), { afterMinutes: NaN, gapMinutes: 480 }];
eq('NaN-gat genegeerd: gelijk aan zonder dat gat',
   splitDayPattern(gapsWithNaN, 480, 3), splitDayPattern(gaps.slice(0, 1), 480, 3));

const overlappingDayGaps: TaskSplitGap[] = [
  { afterMinutes: 480, gapMinutes: 960 },
  { afterMinutes: 960, gapMinutes: 960 },
];
eq('overlappende gaten ⇒ samengevoegd tot één gat-blok (geen los nul-werk-blok)',
   splitDayPattern(overlappingDayGaps, 480, 4),
   [{ work: 1, gap: 3 }, { work: 3, gap: 0 }]);

console.log('-- split-walk: enumerateTaskWorkDays --');
eq('werkdagen slaan de gaten over', enumerateTaskWorkDays(gaps, eng, '2026-06-01', 3),
   ['2026-06-01', '2026-06-03', '2026-06-05']);
eq('zonder gaten: aaneengesloten werkdagen', enumerateTaskWorkDays(undefined, eng, '2026-06-01', 4),
   ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04']);
eq('gat + weekend combineren correct',
   enumerateTaskWorkDays([{ afterMinutes: 480, gapMinutes: 480 }], eng, '2026-06-04', 3),
   ['2026-06-04', '2026-06-08', '2026-06-09']);

console.log('-- split-walk: computeSplitSegments (H1-as, dag-modus) --');
const segs = computeSplitSegments(gaps, parseDate('2026-06-01'), parseDate('2026-06-05'), false, eng);
eq('drie segmenten', segs.length, 3);
if (segs.length === 3) {
  eq('segment 1 start', formatDate(segs[0].start), '2026-06-01');
  eq('segment 2 start (NIET 06-03..06-05 breed)', formatDate(segs[1].start), '2026-06-03');
  eq('segment 2 einde (exclusief)', formatDate(segs[1].end), '2026-06-04');
  eq('segment 3 start (NIET voorbij het taakeinde)', formatDate(segs[2].start), '2026-06-05');
  eq('segment 3 einde = taakeinde', formatDate(segs[2].end), '2026-06-05');
}

console.log('-- split-walk: computeSplitSegments zonder splitGaps --');
const noGapSegs = computeSplitSegments(undefined, parseDate('2026-06-01'), parseDate('2026-06-05'), false, eng);
eq('geen gaten ⇒ één segment', noGapSegs.length, 1);
ok('geen gaten ⇒ segment = volle taakspanne', noGapSegs.length === 1
  && formatDate(noGapSegs[0].start) === '2026-06-01' && formatDate(noGapSegs[0].end) === '2026-06-05');

console.log('-- split-walk: computeSplitSegments met ongesorteerde gaps --');
const reversedGaps: TaskSplitGap[] = [...gaps].reverse();
const segsFromReversed = computeSplitSegments(reversedGaps, parseDate('2026-06-01'), parseDate('2026-06-05'), false, eng);
eq('ongesorteerde gaps ⇒ zelfde segmenten als gesorteerd',
   segsFromReversed.map(s => [formatDate(s.start), formatDate(s.end)]),
   segs.map(s => [formatDate(s.start), formatDate(s.end)]));

console.log('-- split-walk: computeSplitSegments (hourMode=true, uur-modus) --');
{
  const hourGaps: TaskSplitGap[] = [{ afterMinutes: 60, gapMinutes: 30 }];
  const hourStart = parseInstant('2026-06-01T09:00');
  const hourEnd = parseInstant('2026-06-01T12:00');
  const hourSegs = computeSplitSegments(hourGaps, hourStart, hourEnd, true, hourEng);
  eq('uur-modus: twee segmenten', hourSegs.length, 2);
  if (hourSegs.length === 2) {
    eq('segment 1 start', formatInstant(hourSegs[0].start, 'hour'), '2026-06-01T09:00');
    eq('segment 1 einde (exclusief, na 60 min werk)', formatInstant(hourSegs[0].end, 'hour'), '2026-06-01T10:00');
    eq('segment 2 start (na 30 min gat)', formatInstant(hourSegs[1].start, 'hour'), '2026-06-01T10:30');
    eq('segment 2 einde = taakeinde', formatInstant(hourSegs[1].end, 'hour'), '2026-06-01T12:00');
  }
}

console.log('-- split-walk: computeSplitSegments — overlap, taakeinde-klem, vijandige invoer --');
{
  const overlapGaps: TaskSplitGap[] = [
    { afterMinutes: 120, gapMinutes: 120 },
    { afterMinutes: 180, gapMinutes: 120 },
  ];
  const overlapSegs = computeSplitSegments(
    overlapGaps, parseInstant('2026-06-01T08:00'), parseInstant('2026-06-01T14:00'), true, hourEng);
  eq('overlappende gaten ⇒ 2 werkblokken (samengevoegd tot één onderbreking)',
    overlapSegs.map(s => [formatInstant(s.start, 'hour'), formatInstant(s.end, 'hour')]),
    [['2026-06-01T08:00', '2026-06-01T10:00'], ['2026-06-01T13:00', '2026-06-01T14:00']]);
}
{
  const hostileSegs = computeSplitSegments(
    [{ afterMinutes: NaN, gapMinutes: 60 }, { afterMinutes: 120, gapMinutes: 0 },
      { afterMinutes: 60, gapMinutes: -120 }, { afterMinutes: Infinity, gapMinutes: 60 }],
    parseInstant('2026-06-01T08:00'), parseInstant('2026-06-01T16:00'), true, hourEng);
  eq('ontaarde gaten worden overgeslagen ⇒ één doorlopende balk',
    hostileSegs.map(s => [formatInstant(s.start, 'hour'), formatInstant(s.end, 'hour')]),
    [['2026-06-01T08:00', '2026-06-01T16:00']]);
}
{
  const wildEnd = parseDate('2026-06-05');
  const wild = computeSplitSegments(
    [{ afterMinutes: 480, gapMinutes: 480 }, { afterMinutes: 100000, gapMinutes: 480 }],
    parseDate('2026-06-01'), wildEnd, false, eng);
  const endMs = wildEnd.getTime();
  ok('geen enkele segmentgrens komt voorbij het taakeinde',
    wild.every(s => s.start.getTime() <= endMs && s.end.getTime() <= endMs));
  ok('geen enkel segment loopt achterstevoren', wild.every(s => s.end.getTime() >= s.start.getTime()));
}
{
  const sameInstant = parseDate('2026-06-03');
  const degenerate = computeSplitSegments(gaps, sameInstant, sameInstant, false, eng);
  eq('taskEnd === taskStart ⇒ één (nul-breed) segment, geen crash',
    degenerate, [{ start: sameInstant, end: sameInstant }]);
  const invertedEnd = parseDate('2026-06-01');
  const invertedStart = parseDate('2026-06-05');
  const inverted = computeSplitSegments(gaps, invertedStart, invertedEnd, false, eng);
  eq('taskEnd < taskStart ⇒ één segment, ongewijzigd doorgegeven',
    inverted, [{ start: invertedStart, end: invertedEnd }]);
}
{
  const zeroAxisStart = parseInstant('2026-06-01T08:00');
  const zeroAxisEnd = parseInstant('2026-06-01T12:00');
  const zeroAxisSegs = computeSplitSegments(
    [{ afterMinutes: 0, gapMinutes: 60 }], zeroAxisStart, zeroAxisEnd, true, hourEng);
  eq('gat op aspositie 0 ⇒ nul-breed openingssegment + het echte werkblok erna',
    zeroAxisSegs, [{ start: zeroAxisStart, end: zeroAxisStart }, { start: parseInstant('2026-06-01T09:00'), end: zeroAxisEnd }]);
  ok('nul-breed openingssegment start === taskStart',
    zeroAxisSegs[0].start.getTime() === zeroAxisStart.getTime() && zeroAxisSegs[0].end.getTime() === zeroAxisStart.getTime());
}
{
  const clampStart = parseDate('2026-06-01');
  const clampEnd = parseDate('2026-06-02');
  const clampSegs = computeSplitSegments(
    [{ afterMinutes: 480, gapMinutes: 99999 }], clampStart, clampEnd, false, eng);
  eq('taakeinde-klem ⇒ twee segmenten, het tweede nul-breed', clampSegs,
    [{ start: clampStart, end: clampEnd }, { start: clampEnd, end: clampEnd }]);
  ok('geen enkel segment loopt achterstevoren (klem voorkomt end < start)',
    clampSegs.every(s => s.end.getTime() >= s.start.getTime()));
}

console.log('-- splitGapsFromWorkDayBlocks (de as-conversie terug) --');
eq('blokken → H1-gaten', splitGapsFromWorkDayBlocks([{ work: 1, gap: 1 }, { work: 1, gap: 1 }, { work: 1, gap: 0 }], 480, 'leveling'),
   [{ afterMinutes: 480, gapMinutes: 480, source: 'leveling' },
    { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' }]);
eq('een slotblok zonder gat levert geen gat op', splitGapsFromWorkDayBlocks([{ work: 4, gap: 0 }], 480), []);
eq('zonder source-argument blijft het veld weg',
   splitGapsFromWorkDayBlocks([{ work: 1, gap: 1 }, { work: 1, gap: 0 }], 480), [{ afterMinutes: 480, gapMinutes: 480 }]);

for (const mpd of [480, 450, 390]) {
  for (const blocks of [
    [{ work: 1, gap: 1 }, { work: 1, gap: 0 }],
    [{ work: 2, gap: 3 }, { work: 1, gap: 1 }, { work: 2, gap: 0 }],
    [{ work: 5, gap: 0 }],
  ]) {
    const total = blocks.reduce((s, b) => s + b.work, 0);
    eq(`round-trip mpd=${mpd} ${JSON.stringify(blocks)}`,
       splitDayPattern(splitGapsFromWorkDayBlocks(blocks, mpd), mpd, total), blocks);
  }
}

eq('gaten uit blokken, geënumereerd op de taakkalender',
   enumerateTaskWorkDays(splitGapsFromWorkDayBlocks([{ work: 1, gap: 1 }, { work: 2, gap: 0 }], 480), sixDayEng, '2026-06-05', 3),
   ['2026-06-05', '2026-06-08', '2026-06-09']);

console.log('-- split-walk: computeSplitSegments in de dagenmaat (breuk, start midden op de dag) --');
{
  const wk = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
  const UNEVEN_CAL: WorkCalendar = {
    id: 'cal-uneven-split-walk', name: 'ongelijk', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
    workTime: { byWeekday: { 1: wk, 2: wk, 3: wk, 4: wk, 5: [{ start: 420, end: 720 }, { start: 780, end: 840 }], 6: [], 7: [] } },
  };
  const unevenEng = new CalendarEngine(UNEVEN_CAL);
  const splitGaps: TaskSplitGap[] = [{ afterMinutes: 240, gapMinutes: 480 }];
  const start = parseInstant('2026-06-04T11:00');
  const dayTask = { time: { durationUnit: 'days', scheduleDuration: 2.5 }, splitGaps } as unknown as Task;
  const motorEnd = unevenEng.addMeasuredWorkdays(start, splitTotalSpanDays(dayTask, unevenEng));
  eq('motor: einde di 16:00', formatInstant(motorEnd, 'hour'), '2026-06-09T16:00');
  const segs = computeSplitSegments(splitGaps, start, motorEnd, 'workdays', unevenEng);
  eq('dagenmaat: stukken do 11:00 – vr 07:00 (exclusief) en ma 07:00 – di 16:00',
     segs.map(x => [formatInstant(x.start, 'hour'), formatInstant(x.end, 'hour')]),
     [['2026-06-04T11:00', '2026-06-05T07:00'], ['2026-06-08T07:00', '2026-06-09T16:00']]);
  if (segs.length === 2) {
    eq('dagenmaat: het laatste stuk is precies de rest van 2 d (zelfde telling als de motor)',
       formatInstant(unevenEng.addMeasuredWorkdays(segs[1].start, 2), 'hour'), formatInstant(motorEnd, 'hour'));
  }
  const hourGapSegs = computeSplitSegments(
    [{ afterMinutes: 120, gapMinutes: 60 }, { afterMinutes: 300, gapMinutes: 60 }],
    parseInstant('2026-06-01T08:00'), parseInstant('2026-06-01T16:00'), 'workdays', hourEng);
  eq('dagenmaat: pauzes van een uur blijven een uur',
     hourGapSegs.map(x => [formatInstant(x.start, 'hour'), formatInstant(x.end, 'hour')]),
     [['2026-06-01T08:00', '2026-06-01T10:00'], ['2026-06-01T11:00', '2026-06-01T13:00'], ['2026-06-01T14:00', '2026-06-01T16:00']]);
}

if (diffs.length === 0) {
  console.log(`OK  split-walk: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  split-walk: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
