// check-split-walk.ts — H1-as-wandeling en dag-enumeratie van gesplitste taken (B1c-W0.4/W0.1).
//
// Reproduceert de dubbeltel-bug van de pre-H1-lezing: voor het referentiegeval hieronder (taak
// 2026-06-01..2026-06-05, twee gaten van 1 werkdag na resp. dag 1 en aspositie 1440 = 480 werk +
// 480 gat + 480 werk) gaf het pre-H1-algoritme (dat `prevAxis = gap.afterMinutes` bijhield in
// plaats van `gap.afterMinutes + gap.gapMinutes`) de segmenten [06-01..06-02], [06-03..06-05],
// [06-08..06-05] — het derde segment loopt zelfs terug in de tijd. Correct is 06-01 / 06-03 / 06-05.
//
// Draait via run.sh. Exit 0 = alles groen.

import {
  computeSplitSegments, enumerateTaskWorkDays, splitDayPattern, splitGapsFromWorkDayBlocks,
} from '@/engine/scheduler/splitWalk';
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

// Zesdaagse kalender: ma-za, 8u/dag — zelfde vorm als `check-leveler-splits.ts`s `SIX_DAY_CAL`, hier
// hergebruikt om `splitGapsFromWorkDayBlocks`s uitkomst op een AFWIJKENDE taakkalender te toetsen
// (B1c-plan-2 taak 8, spec-testplicht "taakkalender ≠ projectkalender").
const SIX_DAY_CAL: WorkCalendar = {
  id: 'cal-six-day-split-walk', name: 'zesdaags', description: '', workDays: [1, 2, 3, 4, 5, 6],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const sixDayEng = new CalendarEngine(SIX_DAY_CAL);

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

// Overlappende gaten vallen samen tot ÉÉN blok (zelfde klemregel als `computeSplitSegments` en
// `splitTotalSpanMinutes`): gat 1 beslaat de as [480,1440) (1 werkdag na dag 1, 2 dagen gat), gat 2
// begint op 960 — middenin gat 1 — en ligt dus geklemd op 1440, doorlopend tot 1920 (nog 1 dag
// gat). Zonder samenvoeging zou dit een apart `{work:0, gap:1}`-blok opleveren; met samenvoeging
// wordt het gat van het eerste blok verlengd tot 3 dagen in plaats van een los nul-werk-blok.
const overlappingDayGaps: TaskSplitGap[] = [
  { afterMinutes: 480, gapMinutes: 960 },  // as [480,1440) — 2 dagen gat na dag 1
  { afterMinutes: 960, gapMinutes: 960 },  // begint middenin gat 1 ⇒ geklemd op 1440, tot 1920
];
eq('overlappende gaten ⇒ samengevoegd tot één gat-blok (geen los nul-werk-blok)',
   splitDayPattern(overlappingDayGaps, 480, 4),
   [{ work: 1, gap: 3 }, { work: 3, gap: 0 }]);

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

// ═══════════════════════════════════════════════════════════════════════════
// computeSplitSegments — overlappende gaten, taakeinde-klem, vijandige invoer
// (geport uit `check-split-bar-render.ts`s Deel 0e/0f — zelfde referentiegevallen)
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- split-walk: computeSplitSegments — overlap, taakeinde-klem, vijandige invoer --');
{
  // Overlappende gaten vallen samen tot ÉÉN werkonderbreking: gat 1 beslaat de as [120,240), gat 2
  // begint op 180 — middenin gat 1 — en ligt dus geklemd op 240, doorlopend tot 300. Samen één
  // onderbreking over de as [120,300) ⇒ 10:00-13:00, dus TWEE werkblokken, niet drie (een naïeve
  // wandeling die het tweede gat een eigen — nul-brede — segment geeft zou er drie tellen).
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
  // Vijandige invoer (NaN/Infinity/gapMinutes<=0) wordt overgeslagen ⇒ één doorlopende balk.
  const hostileSegs = computeSplitSegments(
    [{ afterMinutes: NaN, gapMinutes: 60 }, { afterMinutes: 120, gapMinutes: 0 },
      { afterMinutes: 60, gapMinutes: -120 }, { afterMinutes: Infinity, gapMinutes: 60 }],
    parseInstant('2026-06-01T08:00'), parseInstant('2026-06-01T16:00'), true, hourEng);
  eq('ontaarde gaten worden overgeslagen ⇒ één doorlopende balk',
    hostileSegs.map(s => [formatInstant(s.start, 'hour'), formatInstant(s.end, 'hour')]),
    [['2026-06-01T08:00', '2026-06-01T16:00']]);
}
{
  // Een gat ver voorbij het taakeinde (corrupte `afterMinutes`) mag geen segmentgrens ná
  // `taskEnd` opleveren en al helemaal geen achterstevoren lopend segment.
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
  // `taskEnd <= taskStart` (corrupte input) kortsluit meteen naar één segment — de gaten-as wordt
  // niet eens aangeraakt.
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
  // Gat op aspositie 0 (begint DIRECT bij taakstart): `workBefore === 0` voor het állereerste gat
  // wordt — anders dan bij een later gat — WEL gepusht (het gedocumenteerde "eerste segment altijd
  // erbij"-uitzondering), dus dit levert een nul-breed openingssegment op met `start === taskStart`.
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
  // Taakeinde-klem die een segment TOT NUL BREEDTE reduceert: 1 werkdag werk (06-01→06-02, exact
  // het taakeinde), gevolgd door een enorm gat dat de wandeling ver voorbij `taskEnd` zou duwen.
  // Zonder de klem zou het slotsegment `{cursor(ver in de toekomst), taskEnd}` zijn — een
  // ACHTERSTEVOREN lopend segment (`end < start`). Met de klem wordt `cursor` op `taskEnd`
  // vastgezet, dus het slotsegment is nul-breed (`taskEnd → taskEnd`), nooit omgekeerd.
  const clampStart = parseDate('2026-06-01');
  const clampEnd = parseDate('2026-06-02');
  const clampSegs = computeSplitSegments(
    [{ afterMinutes: 480, gapMinutes: 99999 }], clampStart, clampEnd, false, eng);
  eq('taakeinde-klem ⇒ twee segmenten, het tweede nul-breed', clampSegs,
    [{ start: clampStart, end: clampEnd }, { start: clampEnd, end: clampEnd }]);
  ok('geen enkel segment loopt achterstevoren (klem voorkomt end < start)',
    clampSegs.every(s => s.end.getTime() >= s.start.getTime()));
}

// ═══════════════════════════════════════════════════════════════════════════
// splitGapsFromWorkDayBlocks (B1c-plan-2 taak 8) — de as-conversie terug: werk/gat-blokken (hele
// werkdagen) → `TaskSplitGap[]` op de H1-as. De EXACTE inverse van `splitDayPattern`.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- splitGapsFromWorkDayBlocks (de as-conversie terug) --');
// Referentiegeval, spiegelt het `splitDayPattern`-geval bovenaan dit bestand:
// blokken [{work:1,gap:1},{work:1,gap:1},{work:1,gap:0}] bij 480 min/dag ⇒ de H1-as-gaten
// {480,480} en {1440,480}. Let op de CUMULATIE: 1440 = 480 werk + 480 gat + 480 werk.
eq('blokken → H1-gaten', splitGapsFromWorkDayBlocks([{ work: 1, gap: 1 }, { work: 1, gap: 1 }, { work: 1, gap: 0 }], 480, 'leveling'),
   [{ afterMinutes: 480, gapMinutes: 480, source: 'leveling' },
    { afterMinutes: 1440, gapMinutes: 480, source: 'leveling' }]);
eq('een slotblok zonder gat levert geen gat op', splitGapsFromWorkDayBlocks([{ work: 4, gap: 0 }], 480), []);
eq('zonder source-argument blijft het veld weg',
   splitGapsFromWorkDayBlocks([{ work: 1, gap: 1 }, { work: 1, gap: 0 }], 480), [{ afterMinutes: 480, gapMinutes: 480 }]);

// ── ROUND-TRIP-INVARIANT: de conversie is de exacte inverse van `splitDayPattern` ────────────────
// Voor elk van deze blokpatronen (en elke minutesPerDay uit de lijst) moet gelden:
//   splitDayPattern(splitGapsFromWorkDayBlocks(b, mpd), mpd, Σwork) === b
// Neem mpd-waarden die een NIET-GEHELE hoursPerDay dekken (spec-testplicht): 480 (8u), 450 (7,5u),
// 390 (6,5u). Elke blokreeks eindigt op een blok met gap 0 — dat is de vorm die splitDayPattern
// oplevert (zie de INVARIANT-alinea in zijn docblok).
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

// ── En de dagen die eruit rollen kloppen op een AFWIJKENDE taakkalender (spec-testplicht) ────────
// Zesdaagse kalender (ma-za): 3 werkdagen met een gat van 1 werkdag na dag 1, vanaf vr 2026-06-05
// ⇒ vr, (za = gat), ma, di.
eq('gaten uit blokken, geënumereerd op de taakkalender',
   enumerateTaskWorkDays(splitGapsFromWorkDayBlocks([{ work: 1, gap: 1 }, { work: 2, gap: 0 }], 480), sixDayEng, '2026-06-05', 3),
   ['2026-06-05', '2026-06-08', '2026-06-09']);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  split-walk: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  split-walk: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
