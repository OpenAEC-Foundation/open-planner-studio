// check-split-walk.ts — H1-as-wandeling en dag-enumeratie van gesplitste taken (B1c-W0.4/W0.1).
//
// Reproduceert de dubbeltel-bug van de pre-H1-lezing: voor het referentiegeval hieronder (taak
// 2026-06-01..2026-06-05, twee gaten van 1 werkdag na resp. dag 1 en aspositie 1440 = 480 werk +
// 480 gat + 480 werk) gaf het pre-H1-algoritme (dat `prevAxis = gap.afterMinutes` bijhield in
// plaats van `gap.afterMinutes + gap.gapMinutes`) de segmenten [06-01..06-02], [06-03..06-05],
// [06-08..06-05] — het derde segment loopt zelfs terug in de tijd. Correct is 06-01 / 06-03 / 06-05.
//
// Draait via run.sh. Exit 0 = alles groen.

import { computeSplitSegments, enumerateTaskWorkDays, splitDayPattern } from '@/engine/scheduler/splitWalk';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { TaskSplitGap } from '@/types/task';
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

// Dag-kalender: ma-vr, 8u/dag, GEEN workTime — zelfde vorm als `check-split-bar-render.ts`s
// `DAY_CAL` (dwingt het `addWorkingDaysSigned`-pad af i.p.v. `addWorkMinutes`, dat op een
// dag-kalender crasht omdat `workTime` daar `undefined` is).
const DAY_CAL: WorkCalendar = {
  id: 'cal-day-split-walk', name: 'dag', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const eng = new CalendarEngine(DAY_CAL);

// Uur-kalender: ma-vr 08:00-16:00 (8u/dag) — zelfde vorm als `check-split-bar-render.ts`s
// `HOUR_CAL`, nodig om het `hourMode=true`-pad (`CalendarEngine.addWorkMinutes`) direct te toetsen.
const HOUR_CAL: WorkCalendar = {
  id: 'cal-hour-split-walk', name: 'uur', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: {
    1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
    4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [],
  } },
};
const hourEng = new CalendarEngine(HOUR_CAL);

// Referentiegeval (zie moduleheader): na dag 1 een gat van 1 dag; het tweede gat ligt op
// aspositie 1440 = 480 (dag 1 werk) + 480 (gat 1) + 480 (dag 2 werk).
const gaps: TaskSplitGap[] = [
  { afterMinutes: 480, gapMinutes: 480 },   // na dag 1: 1 dag pauze
  { afterMinutes: 1440, gapMinutes: 480 },  // aspositie 1440 = 480 werk + 480 gat + 480 werk
];

// ═══════════════════════════════════════════════════════════════════════════
// splitDayPattern
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- split-walk: splitDayPattern --');
eq('patroon werk/gat-blokken', splitDayPattern(gaps, 480, 3),
   [{ work: 1, gap: 1 }, { work: 1, gap: 1 }, { work: 1, gap: 0 }]);
eq('zonder gaten: één blok', splitDayPattern(undefined, 480, 4), [{ work: 4, gap: 0 }]);
eq('durationDays=0 ⇒ gedocumenteerd leeg blok', splitDayPattern(gaps, 480, 0), [{ work: 0, gap: 0 }]);

// Defensief: een gat met een niet-eindige `afterMinutes` (bv. via MCP/hand-IFC-invoer) wordt
// genegeerd — de uitkomst is byte-identiek aan dezelfde `gaps` ZONDER dat kapotte gat. Dekt ook
// het NaN-doorsijpel-punt (`Math.max(0, NaN) = NaN` zonder de guard).
const gapsWithNaN: TaskSplitGap[] = [...gaps.slice(0, 1), { afterMinutes: NaN, gapMinutes: 480 }];
eq('NaN-gat genegeerd: gelijk aan zonder dat gat',
   splitDayPattern(gapsWithNaN, 480, 3), splitDayPattern(gaps.slice(0, 1), 480, 3));

// ═══════════════════════════════════════════════════════════════════════════
// enumerateTaskWorkDays
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- split-walk: enumerateTaskWorkDays --');
eq('werkdagen slaan de gaten over', enumerateTaskWorkDays(gaps, eng, '2026-06-01', 3),
   ['2026-06-01', '2026-06-03', '2026-06-05']);
eq('zonder gaten: aaneengesloten werkdagen', enumerateTaskWorkDays(undefined, eng, '2026-06-01', 4),
   ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04']);
// Weekend-overspanning: gat van 1 werkdag vanaf donderdag: do werk, vr gat, ma+di werk
eq('gat + weekend combineren correct',
   enumerateTaskWorkDays([{ afterMinutes: 480, gapMinutes: 480 }], eng, '2026-06-04', 3),
   ['2026-06-04', '2026-06-08', '2026-06-09']);

// ═══════════════════════════════════════════════════════════════════════════
// computeSplitSegments (H1-as)
// ═══════════════════════════════════════════════════════════════════════════
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

// Negatieve controle: zonder gaten blijft het één segment, ongewijzigd taakbegin/-einde.
console.log('-- split-walk: computeSplitSegments zonder splitGaps --');
const noGapSegs = computeSplitSegments(undefined, parseDate('2026-06-01'), parseDate('2026-06-05'), false, eng);
eq('geen gaten ⇒ één segment', noGapSegs.length, 1);
ok('geen gaten ⇒ segment = volle taakspanne', noGapSegs.length === 1
  && formatDate(noGapSegs[0].start) === '2026-06-01' && formatDate(noGapSegs[0].end) === '2026-06-05');

// Ongesorteerde `gaps` (aanroeper mag geen volgorde garanderen): dezelfde referentiegaten in
// omgekeerde volgorde moeten IDENTIEK aan `segs` hierboven uitkomen (defensief gesorteerd op
// `afterMinutes`, zelfde conventie als `splitTotalSpanMinutes`).
console.log('-- split-walk: computeSplitSegments met ongesorteerde gaps --');
const reversedGaps: TaskSplitGap[] = [...gaps].reverse();
const segsFromReversed = computeSplitSegments(reversedGaps, parseDate('2026-06-01'), parseDate('2026-06-05'), false, eng);
eq('ongesorteerde gaps ⇒ zelfde segmenten als gesorteerd',
   segsFromReversed.map(s => [formatDate(s.start), formatDate(s.end)]),
   segs.map(s => [formatDate(s.start), formatDate(s.end)]));

// ═══════════════════════════════════════════════════════════════════════════
// computeSplitSegments (hourMode=true, uur-modus — CalendarEngine.addWorkMinutes-pad)
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- split-walk: computeSplitSegments (hourMode=true, uur-modus) --');
{
  // Binnen één werkdag (08:00-16:00), ruim weg van de bandgrenzen, zodat `addWorkMinutes` gewoon
  // minuten optelt zonder over een bandgrens te hoeven springen: 09:00 start, 1u werk, 30 min gat,
  // dan door tot het (ongewandelde) taakeinde 12:00.
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

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  split-walk: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  split-walk: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
