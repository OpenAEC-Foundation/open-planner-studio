// WorkdayAxis-checks (issue #21 punt 5, fase 1 — `docs/superpowers/werkdagen-as-ontwerp.md` §2,
// §8 fase 1, met de §10-correcties). Onafhankelijk narekenen: de referentie-oracle hieronder
// implementeert "is dit een werkdag"/"welke 0-based werkdag-index hoort bij deze dag" met een
// kale dag-voor-dag-lus (geen hergebruik van CalendarEngine of workdayAxis.ts-interne code), zodat
// de check ook een verkeerde-maar-zichzelf-consistente implementatie zou opvangen.
//
// Gedekt (zie taakbrief): round-trip datum→index→datum over een raster met weekenden +
// feestdagen; kleef-rechts voor za/zo/feestdag; 5-werkdagen-span over weekend+feestdag = exact 5
// cellen; consistentie met CalendarEngine.workDaysBetween/addWorkDays; sub-dag-fracties;
// gedrag vóór de epoch/origin; lazy-groei (ver buiten het initiële venster) + het groei-plafond.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen.

import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate } from '@/utils/dateUtils';
import { buildWorkdayAxis, buildCalendarAxis } from '@/engine/renderer/workdayAxis';
import { MS_PER_DAY, dateToX as calendarDateToX } from '@/engine/renderer/timeAxis';
import type { WorkCalendar } from '@/types/calendar';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}
function close(label: string, actual: number, expected: number, tol = 1e-6): void {
  checks++;
  if (Math.abs(actual - expected) > tol) diffs.push(`${label}: kreeg ${actual}, verwacht ${expected} (Δ=${actual - expected})`);
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(`${label}: verwachte conditie was FALSE`);
}

// ── Fixture-kalender: ma-vr werkweek, één feestdag midden in de week (wo 8 juli 2026, tussen
//    de weekend-referentiedagen die de fase-2.8b-uur-batterij al geverifieerd heeft) + een
//    meerdaagse "bouwvak"-periode ~13 maanden later (dekt zowel de lazy-groei-test als een
//    meerdaags-feestdagblok). ─────────────────────────────────────────────────────────────────
const calendar: WorkCalendar = {
  id: 'wd-axis-fixture',
  name: 'wd-axis-fixture',
  description: 'wd-axis-fixture',
  workDays: [1, 2, 3, 4, 5],
  workStartHour: 8,
  workEndHour: 16,
  hoursPerDay: 8,
  holidays: [
    { name: 'Test-feestdag', startDate: '2026-07-08', endDate: '2026-07-08' }, // wo 8 juli 2026
    { name: 'Bouwvak', startDate: '2027-08-02', endDate: '2027-08-08' }, // meerdaags blok
  ],
};
const engine = new CalendarEngine(calendar);

// ── Onafhankelijke referentie-oracle (kale dag-voor-dag-lus, GEEN hergebruik van engine-code) ──
const WORK_DAYS = new Set(calendar.workDays);
const holidayDayIdxs = new Set<number>();
for (const h of calendar.holidays) {
  const sIdx = Math.floor(parseDate(h.startDate).getTime() / MS_PER_DAY);
  const eIdx = Math.floor(parseDate(h.endDate).getTime() / MS_PER_DAY);
  for (let d = sIdx; d <= eIdx; d++) holidayDayIdxs.add(d);
}
function isoDowRef(dayIdx: number): number {
  const jsDow = new Date(dayIdx * MS_PER_DAY).getUTCDay(); // 0=zo..6=za
  return jsDow === 0 ? 7 : jsDow;
}
function isWorkDayRef(dayIdx: number): boolean {
  if (!WORK_DAYS.has(isoDowRef(dayIdx))) return false;
  if (holidayDayIdxs.has(dayIdx)) return false;
  return true;
}
/** 0-based werkdag-index (epoch-relatief) van dagindex `dayIdx`, MET kleef-rechts voor
 *  niet-werkdagen: "#werkdagen strikt vóór dayIdx" is tegelijk (a) de eigen 0-based index als
 *  dayIdx zelf een werkdag is, en (b) de index van de eerstvolgende werkdag als dat niet zo is
 *  (er liggen geen werkdagen tussen dayIdx en die eerstvolgende werkdag). */
function refWorkdayIndexOfDay(dayIdx: number): number {
  let count = 0;
  for (let d = 0; d < dayIdx; d++) if (isWorkDayRef(d)) count++;
  return count;
}
function dayIdxOf(iso: string): number {
  return Math.floor(parseDate(iso).getTime() / MS_PER_DAY);
}
function d(iso: string): Date {
  return parseDate(iso);
}

// Referentiedagen (§9 van check-calendar-hours.ts, hergebruikt): ma 6, di 7, wo 8 (feestdag),
// do 9, vr 10, za 11, zo 12 juli 2026; ma 13 juli.
const MON06 = d('2026-07-06');
const TUE07 = d('2026-07-07');
const WED08_HOLIDAY = d('2026-07-08');
const THU09 = d('2026-07-09');
const FRI10 = d('2026-07-10');
const SAT11 = d('2026-07-11');
const SUN12 = d('2026-07-12');
const MON13 = d('2026-07-13');

const ZOOM = 22;
const TABLE_WIDTH = 300;
const SCROLL_X = 0;

const axis = buildWorkdayAxis({
  calendar: engine,
  origin: MON06,
  taskTableWidth: TABLE_WIDTH,
  zoom: ZOOM,
  scrollX: SCROLL_X,
  initialPaddingDays: 5, // klein venster — dwingt lazy-groei af voor de verre queries hieronder
});

// ═══ 1. Round-trip datum→index→datum over een raster met weekenden + feestdag ════════════════
for (const [label, date] of [
  ['ma06', MON06], ['di07', TUE07], ['do09', THU09], ['vr10', FRI10], ['ma13', MON13],
] as [string, Date][]) {
  const idx = axis.dayIndexOf(date);
  eq(`refIndex ${label}`, idx, refWorkdayIndexOfDay(dayIdxOf(date.toISOString().slice(0, 10))));
  const roundTripped = axis.dateAtIndex(idx);
  eq(`round-trip ${label}`, roundTripped.getTime(), date.getTime());
}

// ═══ 2. Kleef-rechts (naad-landing) voor za/zo/feestdag (§2.4) ════════════════════════════════
// Zaterdag/zondag landen op dezelfde x als de eerstvolgende werkdag (maandag 13).
close('dateToX(za11) == dateToX(ma13)', axis.dateToX(SAT11), axis.dateToX(MON13));
close('dateToX(zo12) == dateToX(ma13)', axis.dateToX(SUN12), axis.dateToX(MON13));
eq('dayIndexOf(za11) == dayIndexOf(ma13)', axis.dayIndexOf(SAT11), axis.dayIndexOf(MON13));
eq('dayIndexOf(zo12) == dayIndexOf(ma13)', axis.dayIndexOf(SUN12), axis.dayIndexOf(MON13));
// Feestdag (wo08) landt op de eerstvolgende werkdag (do09).
close('dateToX(wo08-feestdag) == dateToX(do09)', axis.dateToX(WED08_HOLIDAY), axis.dateToX(THU09));
eq('dayIndexOf(wo08-feestdag) == dayIndexOf(do09)', axis.dayIndexOf(WED08_HOLIDAY), axis.dayIndexOf(THU09));
// De naad-x zelf is de LINKERRAND van de volgende werkdag-kolom (geen sub-dag-interpolatie op
// een niet-werkdag, §2.3): een uur later op zaterdag verandert er niets aan de x.
close(
  'niet-werkdag: geen sub-dag-interpolatie',
  axis.dateToX(new Date(SAT11.getTime() + 13 * 3600000)),
  axis.dateToX(SAT11),
);

// ═══ 3. 5-werkdagen-span over weekend + feestdag = exact 5 cellen (user-doel, §0) ═════════════
// ma06(1) → di07(2) → [wo08 feestdag, overgeslagen] → do09(3) → vr10(4) → [za/zo, overgeslagen]
// → ma13(5): de 5e werkdag is ma13. daySpan (indexverschil) moet dus 4 zijn (5 kolommen breed).
eq('5-werkdagen-span ma06→ma13 == 4 (5 kolommen)', axis.daySpan(MON06, MON13), 4);
close('balkbreedte 5 werkdagen == 4*zoom', axis.dateToX(MON13) - axis.dateToX(MON06), 4 * ZOOM);

// ═══ 4. Consistentie met CalendarEngine.workDaysBetween/addWorkDays ═══════════════════════════
// workDaysBetween telt INCLUSIEF beide uiteinden; axis.daySpan is een indexverschil (exclusief
// het startpunt) — voor twee werkdagen geldt dus `daySpan == workDaysBetween-1`.
for (const [label, from, to] of [
  ['ma06→di07', MON06, TUE07],
  ['ma06→do09', MON06, THU09],
  ['ma06→vr10', MON06, FRI10],
  ['ma06→ma13', MON06, MON13],
  ['di07→vr10', TUE07, FRI10],
] as [string, Date, Date][]) {
  eq(`daySpan(${label}) == workDaysBetween-1`, axis.daySpan(from, to), engine.workDaysBetween(from, to) - 1);
}
// addWorkDays(origin, n) moet dezelfde datum geven als dateAtIndex(dayIndexOf(origin)+(n-1)).
const originIdx = axis.dayIndexOf(MON06);
for (const n of [1, 3, 5, 8, 13]) {
  const viaEngine = engine.addWorkDays(MON06, n);
  const viaAxis = axis.dateAtIndex(originIdx + (n - 1));
  eq(`addWorkDays(ma06,${n}) == axis.dateAtIndex`, viaAxis.getTime(), viaEngine.getTime());
}

// ═══ 5. Sub-dag-fracties (§2.3): 12:00 op een werkdag = celmidden ═════════════════════════════
const thu09Noon = new Date(THU09.getTime() + 12 * 3600000);
close('do09 12:00 == celmidden (fractie 0.5)', axis.dayIndexOf(thu09Noon), axis.dayIndexOf(THU09) + 0.5);
close('dateToX(do09 12:00) == dateToX(do09)+0.5*zoom', axis.dateToX(thu09Noon), axis.dateToX(THU09) + 0.5 * ZOOM);
// xToDate is de inverse binnen een werkdag-kolom (sub-dag-precisie behouden).
const xAtNoon = axis.dateToX(thu09Noon);
close('xToDate∘dateToX(do09 12:00) inverteert', axis.xToDate(xAtNoon).getTime(), thu09Noon.getTime(), 1);

// Sectie 6-8 gebruiken elk een VERSE axis-instantie (i.p.v. de gedeelde `axis` van boven) —
// bewust geïsoleerd: dit zijn stuk voor stuk extreme randgevallen die het venster desnoods tot
// aan `MAX_WINDOW_DAYS` opblazen, en die interne vensterstaat mag de daaropvolgende secties niet
// besmetten (§2.5: een axis is toch al goedkoop genoeg om weg te gooien; een "vers exemplaar per
// scenario" is dus ook hoe een echte aanroeper dit in fase 2/3 zou gebruiken, niet één axis door
// alle uitersten heen jagen).

// ═══ 6. Gedrag vóór de origin/epoch (§9.3/§9.5) ═══════════════════════════════════════════════
{
  const axis6 = buildWorkdayAxis({ calendar: engine, origin: MON06, taskTableWidth: TABLE_WIDTH, zoom: ZOOM, scrollX: SCROLL_X, initialPaddingDays: 5 });
  // Een datum ruim vóór `origin` blijft consistent met de referentie-oracle (kleinere, nog steeds
  // correcte epoch-relatieve index — geen speciaal geval nodig, alleen ver "naar links" op de as).
  const beforeOrigin = d('2026-06-01'); // ma06 juli minus ~5 weken
  eq(
    'dayIndexOf(vóór origin) == refIndex',
    axis6.dayIndexOf(beforeOrigin),
    refWorkdayIndexOfDay(dayIdxOf('2026-06-01')),
  );
  ok('dayIndexOf(vóór origin) < dayIndexOf(origin)', axis6.dayIndexOf(beforeOrigin) < axis6.dayIndexOf(MON06));
  // Extreme "vóór de epoch"-clamp: `dateAtIndex` met een absurd negatieve index mag niet vastlopen
  // en clamt (gedocumenteerd, §9.5) naar de epoch zelf — dezelfde semantiek als
  // `CalendarEngine.addWorkDays` voor `workDays<=0`.
  eq('dateAtIndex(extreem negatief) clamt op epoch', axis6.dateAtIndex(-1_000_000).getTime(), new Date(0).getTime());
}

// ═══ 7. Lazy-groei: query ver voorbij het initiële venster (±5 dagen) ═════════════════════════
{
  const axis7 = buildWorkdayAxis({ calendar: engine, origin: MON06, taskTableWidth: TABLE_WIDTH, zoom: ZOOM, scrollX: SCROLL_X, initialPaddingDays: 5 });
  // De "Bouwvak"-feestdag (2027-08-02..08) ligt ~13 maanden na `origin` — ver buiten het initiële
  // venster, dwingt dus `ensureContainsDay`/`dayAtWorkdayIndex` te groeien (GROWTH_CHUNK_DAYS=400).
  const bouwvakStart = d('2027-08-02');
  const bouwvakEnd = d('2027-08-08');
  const dayAfterBouwvak = d('2027-08-09'); // ma (werkdag, ná de meerdaagse feestdag)
  eq(
    'lazy-groei: dayIndexOf(bouwvak-start) == refIndex',
    axis7.dayIndexOf(bouwvakStart),
    refWorkdayIndexOfDay(dayIdxOf('2027-08-02')),
  );
  // Het hele meerdaagse blok landt op DEZELFDE naad-x (eerstvolgende werkdag ná het blok).
  close('lazy-groei: bouwvak-start/eind zelfde naad-x', axis7.dateToX(bouwvakStart), axis7.dateToX(bouwvakEnd));
  close('lazy-groei: bouwvak-naad == eerste werkdag erna', axis7.dateToX(bouwvakStart), axis7.dateToX(dayAfterBouwvak));
  // Round-trip blijft correct ná de groei.
  const idx7 = axis7.dayIndexOf(dayAfterBouwvak);
  eq('lazy-groei: round-trip ná groei', axis7.dateAtIndex(idx7).getTime(), dayAfterBouwvak.getTime());
}

// ═══ 8. Groei-plafond: query zó ver weg dat het venster het `MAX_WINDOW_DAYS`(=50.000)-plafond
//        passeert (queries hier vallen terug op de rekenkundige fallback — trager maar, per
//        ontwerp, altijd correct). Bewust GEEN veelvoud van `CalendarEngine.workDaysBetween`'s
//        EIGEN veiligheidsplafond (`MAX_DAYS=200.000` dagen SINDS DE EPOCH, niet sinds origin) —
//        anders test je onbedoeld die andere, al-bestaande cap i.p.v. de as-eigen groei-cap.
//        Dagindex ~150.000 (≈ jaar 2380, ~356 jaar ná origin) blaast het 50k-vensterplafond ruim
//        op, terwijl de TOTALE epoch→doel-afstand (~150.640 dagen) ruim onder de 200k-cap blijft.
{
  const axis8 = buildWorkdayAxis({ calendar: engine, origin: MON06, taskTableWidth: TABLE_WIDTH, zoom: ZOOM, scrollX: SCROLL_X, initialPaddingDays: 5 });
  const farDayIdx = 150_000;
  const farDate = new Date(farDayIdx * MS_PER_DAY);
  eq('groei-plafond: dayIndexOf(ver-weg) == refIndex', axis8.dayIndexOf(farDate), refWorkdayIndexOfDay(farDayIdx));
  const farIdx = axis8.dayIndexOf(farDate);
  const farRoundTripped = axis8.dateAtIndex(farIdx);
  eq('groei-plafond: round-trip blijft correct', farRoundTripped.getTime(), farDate.getTime());
}

// ═══ 9. Randgeval §9.4: lege werkweek → buildWorkdayAxis moet gooien (as mag niet "instorten") ═
{
  const emptyCal: WorkCalendar = { ...calendar, id: 'empty', name: 'empty', workDays: [] };
  const emptyEngine = new CalendarEngine(emptyCal);
  let threw = false;
  try {
    buildWorkdayAxis({ calendar: emptyEngine, origin: MON06, taskTableWidth: TABLE_WIDTH, zoom: ZOOM, scrollX: SCROLL_X });
  } catch {
    threw = true;
  }
  ok('lege werkweek: buildWorkdayAxis gooit', threw);
}

// ═══ 10. CalendarAxis-tegenhanger: byte-identiek aan de bestaande fase-0-`dateToX` ═════════════
{
  const calAxis = buildCalendarAxis({ origin: MON06, taskTableWidth: TABLE_WIDTH, zoom: ZOOM, scrollX: SCROLL_X });
  for (const [label, date] of [['ma06', MON06], ['do09', THU09], ['ma13', MON13]] as [string, Date][]) {
    eq(`CalendarAxis.dateToX(${label}) == oude dateToX`, calAxis.dateToX(date), calendarDateToX(date, MON06, TABLE_WIDTH, ZOOM, SCROLL_X));
  }
  eq('CalendarAxis.daySpan == kalenderdagen', calAxis.daySpan(MON06, MON13), 7);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  workday-axis: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  workday-axis: ${diffs.length} afwijking(en) van ${checks}`);
  for (const dd of diffs.slice(0, 40)) console.log(`   - ${dd}`);
  process.exit(1);
}
