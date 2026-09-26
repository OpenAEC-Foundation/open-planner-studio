/**
 * Formaat-neutrale kalenderuitzondering-recurrentie/-precedentie-kern, gedeeld door de MPP- en
 * MSPDI-lezer (zie BLADMODULE hieronder).
 *
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj,
 * © Jon Iles e.a., LGPL-2.1) — structuurkennis/datumgeneratie-algoritmes geport naar TypeScript
 * voor Open Planner Studio (LGPL-3.0), zelfde vermelding als `services/mpp/mppReader.ts`/
 * `mppCalendars.ts`/`limits.ts`.
 *
 * Poort van drie MPXJ-bronnen (verifieer op INHOUD, niet op regelnummer):
 *  - `AbstractCalendarAndExceptionFactory.readRecurringData` (org.mpxj.mpp) — het RecurrenceSpec-
 *    veldenmodel (niet de byte-lezing zelf; die blijft formaat-specifiek, zie `mppCalendars.ts`'s
 *    `readRecurringData`/`readByteAt`).
 *  - `RecurringData.populateDates()`/`getDates()` (org.mpxj) — de vier datumgeneratoren
 *    (DAILY/WEEKLY/MONTHLY/YEARLY × absoluut/relatief), 1:1 geport op UTC-middernacht-`Date`'s
 *    (zelfde substraat als `@/utils/dateUtils`'s `parseDate`/`formatDate`/`addCalendarDays`).
 *  - `ProjectCalendar.populateExpandedExceptions()`/`ORDERED_RECURRENCE_TYPES` (org.mpxj) — de
 *    precedentie: recurrente uitzonderingen in de volgorde WEEKLY→MONTHLY→YEARLY→DAILY, dan
 *    niet-recurrente uitzonderingen (INCLUSIEF een recurrente uitzondering die toevallig tot precies
 *    één datum expandeert — zie de toelichting bij `buildContributions`) als hoogste-prioriteitslaag.
 *
 * BLADMODULE (patroon `services/mpp/limits.ts`/`state/slices/defaults.ts`): importeert NIETS uit
 * de mpp-laag (`services/mpp/*`) of enige andere formaat-specifieke lezer. Twee lezers hergebruiken deze module
 * rechtstreeks: `services/mpp/mppCalendars.ts` (MPP/binair — bouwt zijn EIGEN `RawException[]`
 * uit 92-byte-blokken en geeft die aan `buildContributions`/`resolveContributions` door) en
 * `services/msproject/mspdiReader.ts` (MSPDI/XML — bouwt zijn EIGEN ruwe-record-vorm uit
 * `<Exception>`-elementen en gaat rechtstreeks naar `resolveContributions`). Zonder deze bladmodule
 * zou een STATISCHE import uit de mpp-laag (`services/mpp/…`) in `mspdiReader.ts` de hele MPP-parser (CFB +
 * fieldmaps) de main-chunk in trekken (`tests/planning/check-mpp-chunk-boundary.ts`) — Rollup
 * volgt zo'n import de main-graf in, ongeacht `vite.config.ts`'s `manualChunks`-scheiding.
 *
 * ONTWERPKEUZE — de "autoriteitskaart" (BEWUST STRENGER dan MPXJ): MPXJ's eigen precedentiekaart
 * sleutelt op `getFromDate()` (één datum per uitzondering, ook als een niet-recurrente uitzondering
 * een MEERDAAGS bereik beslaat) — twee niet-recurrente uitzonderingen met VERSCHILLENDE fromDates
 * maar OVERLAPPENDE bereiken botsen daar dus niet in de kaart, en `getException(date)`'s binary
 * search kan dan een onderbepaald resultaat geven. Voor dit project is dat GEEN acceptabel randgeval:
 * `WorkCalendar`'s invariant ("een datum nooit tegelijk in `holidays` én `workingExceptions`") wordt
 * door `CalendarEngine` NIET zelf afgedwongen — een schending geeft echte fouten (negatieve float).
 * `resolveContributions` bouwt daarom een ECHTE per-datum-autoriteitskaart
 * (`authority`, sleutel = ISO-datum) die ELKE dag van ELKE uitzondering langsloopt — recurrent én
 * niet-recurrent — zodat de invariant AL BIJ CONSTRUCTIE geldt, ongeacht welke twee brondocument-
 * records elkaar overlappen.
 */
import { formatDate, parseDate, addCalendarDays } from '@/utils/dateUtils';

// ── Gedeelde hardingsklemmen (meetcommentaar per klem) ───────────────────────────────────────────

/**
 * Gedeeld TOTAALBUDGET voor gematerialiseerde `Holiday`/`WorkingException`-DAGEN over ALLE
 * kalenders in één lees-aanroep samen (basiskalenders se eigen materialisatie ÉN de
 * base→afgeleide-overerving, `mergeInherited`). Corpusbasislijn: 2968 over 49 crawl-bestanden SAMEN — zie `tests/planning/check-mpp-calendars.ts`. 100.000 is ruim boven elk
 * realistisch corpus, maar begrenst de ABSOLUTE bovengrens per bestand hard, ongeacht hoeveel
 * kalenders het claimt.
 */
export const MAX_TOTAL_HOLIDAY_SLOTS = 100_000;

/**
 * Bovengrens op het aantal uitzonderingsRECORDS dat één kalender (basis of afgeleid) bijdraagt —
 * gedeeld tussen `mppCalendars.ts` (92-byte-blokken, `exceptionCount`-SHORT @420) en
 * `mspdiReader.ts` (aantal `<Exception>`-elementen): allebei een telling van "hoeveel losse
 * uitzonderingsdefinities draagt deze kalender", ongeacht de onderliggende serialisatievorm. Elke
 * uitzondering kost bij MPP minstens 92 bytes (dus de MPP-lus is al begrensd door de buffergrootte
 * zelf), maar de KOST per uitzondering (dag-voor-dag-materialisatie) is proportioneel aan de
 * bereiklengte ongeacht formaat — zie `MAX_HOLIDAY_RANGE_DAYS`. Geklemd op 2000 (ruim boven elk
 * realistisch corpus: MS Project-kalenders dragen zelden meer dan enkele tientallen tot een paar
 * honderd feestdag-/afwezigheidsuitzonderingen, zelfs over jaren).
 */
export const MAX_CALENDAR_EXCEPTIONS = 2000;

/**
 * Het aantal DAGEN in één NIET-recurrente uitzonderingsbereik, geklemd tegen de dag-voor-dag-
 * materialisatie in `buildContributions` (elke dag in `[startDate, endDate]` wordt een eigen
 * `ownDates`-entry, ONGEACHT hoe lang het bereik is) — én tegen `CalendarEngine.buildHolidaySet()`'s
 * eigen dag-voor-dag-verwerking van de UITEINDELIJKE `Holiday`-range aan de consumerende kant. Een
 * geprepareerd bestand kan een enkele uitzondering tot ~65534 dagen (~179 jaar, het SHORT-datumbereik
 * van MPP; MSPDI kent een vergelijkbaar breed `xs:date`-bereik) laten claimen. Geklemd op 366 dagen
 * (ruim boven elke realistische meerdaagse sluiting — een bouwvak of jaarwisseling-shutdown duurt
 * hoogstens enkele weken) — in combinatie met `MAX_CALENDAR_EXCEPTIONS` (2000) is de absolute
 * bovengrens per kalender dus 2000 × 366 ≈ 732.000 dag-entries: lineair, in de orde van enkele
 * tientallen ms, i.p.v. onbegrensd.
 */
export const MAX_HOLIDAY_RANGE_DAYS = 366;

/**
 * Bovengrens op het aantal datums dat `expandRecurrence` uit ÉÉN recurrente uitzondering genereert
 * (poort van `RecurringData.populateDates()`). Gemeten corpuswaarde: 368 niet-geflattende recurrente records over het HELE MPP-corpus samen (YEARLY-
 * absoluut 295, YEARLY-relatief 13, MONTHLY-absoluut 7, MONTHLY-relatief 21, WEEKLY 23, DAILY-met-
 * frequentie 9) — de overgrote meerderheid (80%) is YEARLY en genereert dus hoogstens enkele
 * tientallen datums (één per jaar over een paar decennia). 3660 (≈ 10 jaar dagelijks, of ≈ 70 jaar
 * wekelijks) is ruim boven elk realistisch herhalingspatroon in een bouwplanning-kalender.
 *
 * Ergste geval ZONDER deze klem: een geprepareerd bestand kan een recurrentievenster tot het
 * volledige representeerbare datumbereik (~179 jaar voor MPP se SHORT-dagen) laten claimen. Een
 * WEEKLY-uitzondering met frequentie 1 en alle 7 dagen aangevinkt zou dan tot ~179×365 ≈ 65.000
 * datums per RECORD kunnen genereren; met `MAX_CALENDAR_EXCEPTIONS` (2000) uitzonderingen per
 * kalender zou dat zonder klem tot ~130 miljoen datums kunnen oplopen.
 *
 * VALKUIL: deze klem alleen volstaat NIET — hij telt `dates.length`, dus een generatorlus die NOOIT een datum toevoegt (twee
 * bewezen gevallen: MONTHLY-relatief waar de datumberekening structureel vóór `startDate` blijft
 * landen, en WEEKLY met een LEGE dagen-bitmap) loopt hier ONGEACHT deze klem door, want de
 * while-conditie wordt nooit `false` via de `dates.length`-kant. Zie `MAX_RECURRENCE_ITERATIONS`
 * hieronder voor de onafhankelijke tweede klem die dat afdekt.
 */
export const MAX_RECURRENCE_DATES = 3_660;

/**
 * Onafhankelijke ITERATIE-klem naast `MAX_RECURRENCE_DATES` — elke generatiefunctie
 * (`getDailyDates`/`getWeeklyDates`/…) telt hiermee het aantal WHILE-doorlopen, los van hoeveel
 * datums daadwerkelijk zijn toegevoegd. Zonder deze klem loopt een generator die per doorloop NUL
 * voortgang boekt op `dates.length` (dus `MAX_RECURRENCE_DATES` triggert nooit) ONEINDIG door — twee
 * reproduceerbare gevallen:
 *  (a) MONTHLY-relatief met dagnummer 1 en een weekdag-berekening die de eerste-van-de-maand-cursor
 *      structureel VÓÓR `startDate` laat landen (bv. de gevraagde weekdag valt "terug" in de vorige
 *      maand): de niet-toegevoegde datum wordt verworpen, de cursor wordt teruggezet naar
 *      eerste-van-de-maand-plus-frequentie — bij frequentie 1 is dat exact DEZELFDE maand als waar de
 *      lus al stond, dus de cursor staat stil terwijl `dates.length` op 0 blijft.
 *  (b) WEEKLY met een LEGE dagen-bitmap (`dayMask===0`, geen enkele weekdag aangevinkt) én
 *      `finishDate===null`: `moreDates()` valt dan terug op `occurrences`, maar die vergelijking
 *      (`dates.length < occurrences`) blijft voor altijd waar omdat `dates.length` nooit groeit —
 *      ongeacht hoe vaak de cursor intussen vooruitschuift.
 *
 * Elke doorloop van de generator-WHILE-lus (ongeacht of hij een datum toevoegt) decrementeert deze
 * klem; de lus breekt af zodra hij op is, met wat er tot dan toe verzameld is (typisch 0 datums voor
 * de twee gevallen hierboven — geen crash, gewoon een niet-materialiserende uitzondering, exact het
 * "minder resultaat dan het bestand claimt"-patroon dat de rest van deze module ook hanteert).
 *
 * De waarde telt per BESTAND, niet per record: een gedegenereerd record (0 datums, zoals de twee
 * gevallen hierboven) kost de VOLLE `MAX_RECURRENCE_ITERATIONS` maar trekt NIETS af van het gedeelde
 * `HolidayBudget` (`buildContributions`'s `if (dates.length === 0) continue;`). Bij
 * `MAX_CALENDAR_EXCEPTIONS` (2000) zulke records is het ergste geval 2000 × deze klem — met een los
 * getal als 100.000 gemeten 46,3s op de UI-thread.
 *
 * Daarom `MAX_RECURRENCE_DATES + 16` plus een monotone-cursorcheck in `getMonthlyRelativeDates`. Elke
 * LEGITIEME generatoraanroep voegt per doorloop minstens één datum toe (DAILY/MONTHLY-absoluut/
 * YEARLY-absoluut: exact 1; WEEKLY: minstens 1 binnen de 7-dagen-binnenlus, tenzij de bitmap leeg is
 * — precies het gedegenereerde geval dat deze klem afvangt). Een patroon dat de maandcursor niet
 * vooruitbrengt stopt na die eerste vaststelling; deze klem blijft het vangnet voor andere vormen van
 * verspilde doorlopen. Bewaakt door `check-mpp-calendars.ts` (hostile-cases en een fixture met 2000
 * gedegenereerde MONTHLY-relatief-records binnen de 5s-poort).
 */
export const MAX_RECURRENCE_ITERATIONS = MAX_RECURRENCE_DATES + 16;

/** Gedeeld, mutabel budget-object — zie `MAX_TOTAL_HOLIDAY_SLOTS`. Een `{ remaining: number }`
 *  i.p.v. een kale `number`-parameter zodat `resolveContributions`/`buildContributions`/de
 *  overervingskopie 'm in-place kunnen decrementeren zonder de nieuwe waarde expliciet terug te
 *  hoeven geven op elke aanroepplek. */
export interface HolidayBudget {
  remaining: number;
}

/** Nieuw, vol budget — één per lees-aanroep (zie `MAX_TOTAL_HOLIDAY_SLOTS`). Losse, geëxporteerde
 *  fabrieksfunctie zodat testcode `parseExceptions`/`resolveContributions` rechtstreeks kan
 *  aanroepen zonder de interne lezer-orkestratie na te hoeven bouwen. */
export function newHolidayBudget(): HolidayBudget {
  return { remaining: MAX_TOTAL_HOLIDAY_SLOTS };
}

/** Uitkomst van `resolveContributions`/`parseExceptions` — per-datum-unieke, precedentie-opgeloste
 *  uitzonderingen, verdeeld over de twee `WorkCalendar`-arrays. */
export interface ParsedExceptions {
  holidays: { name: string; startDate: string; endDate: string }[];
  workingExceptions: { name: string; startDate: string; endDate: string; bands?: { start: number; end: number }[] }[];
}

/** Eén herhalingspatroon — poort van `RecurringData` (org.mpxj.RecurringData). `frequency`/
 *  `occurrences` zijn BEWUST ongeklemd hier (spiegelt `RecurringData.setFrequency`/`setOccurrences`,
 *  die de rauwe bytewaarde bewaren zonder ze te normaliseren) — het `<1→1`-vangnet
 *  (`RecurringData.populateDates`) gebeurt pas in `moreDates`/`expandRecurrence`, bij de
 *  daadwerkelijke datumgeneratie. De flatten-beslissing (bij de aanroepende lezer, bv.
 *  `mppCalendars.ts`'s `readRawExceptions`) toetst bewust op de RAUWE `frequency`-waarde (identiek
 *  aan MPXJ's eigen volgorde: eerst de flatten-check op het ongeklemde veld, dan pas populateDates'
 *  eigen clamp). */
export interface RecurrenceSpec {
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  relative: boolean;
  startDate: Date;
  finishDate: Date | null;
  occurrences: number;
  frequency: number;
  weeklyDayMask: number;   // WEEKLY: bit0=zondag..bit6=zaterdag — MPP se eigen DAY_MASKS-bit-layout
  dayNumber: number;       // MONTHLY/YEARLY
  dayOfWeekValue: number;  // MONTHLY/YEARLY-relatief: 1=zondag..7=zaterdag (DayOfWeekHelper-schema)
  monthNumber: number;     // YEARLY: 1..12
}

/** `RECURRENCE_TYPES` (AbstractCalendarAndExceptionFactory.java) — index = het rauwe
 *  recurrentietype-veld (MPP: SHORT @+72; MSPDI: `<Type>`, letterlijk dezelfde codewaarde, zie
 *  `mspdi/MSPDIReader.java`). `null` op index 0 (geen recurrentie) én op elke index buiten dit
 *  bereik (een geprepareerd/corrupt bestand kan hier elke waarde claimen).
 *
 *  Afwijking van MPXJ: `getRecurrenceType(value)` geeft voor zo'n out-of-range waarde `null`, maar
 *  `RecurringData.populateDates()` doet daarna een Java-`switch` op dat `null` en gooit een
 *  `NullPointerException` — MPXJ CRASHT hier. Een corrupt/geprepareerd bestand mag de import nooit
 *  laten vallen, dus `readRecurringData`/`readMspdiRecurringData` (de aanroepende lezers) retourneren
 *  bewust `null`, wat de aanroeper behandelt als "0 bijgedragen datums". */
export const RECURRENCE_TYPES: ReadonlyArray<RecurrenceSpec['type'] | null> = [
  null, 'DAILY', 'YEARLY', 'YEARLY', 'MONTHLY', 'MONTHLY', 'WEEKLY', 'DAILY',
];
/** `RELATIVE_MAP` (idem) — index 3 (YEARLY-relatief) en 5 (MONTHLY-relatief) zijn `true`; alles
 *  erbuiten (incl. WEEKLY=6, DAILY=7, en elke out-of-range index) `false` — spiegelt Java's eigen
 *  `value>=RELATIVE_MAP.length ⇒ false`-terugval (het array is bewust maar 6 lang). */
export const RELATIVE_MAP: ReadonlyArray<boolean> = [false, false, false, true, false, true];
/** `ORDERED_RECURRENCE_TYPES` (ProjectCalendar.java) — de precedentie-volgorde waarin recurrente
 *  uitzonderingsGROEPEN over elkaar heen worden gelegd (latere groep wint per datum) vóórdat de
 *  niet-recurrente-equivalente uitzonderingen (zie `buildContributions`) als hoogste-prioriteitslaag
 *  overheen gaan. */
export const RECURRENCE_PRECEDENCE_ORDER: ReadonlyArray<RecurrenceSpec['type']> = ['WEEKLY', 'MONTHLY', 'YEARLY', 'DAILY'];

// ── Datumrekenkunde op UTC-middernacht-`Date`'s — poort van `RecurringData`'s
// `java.time.LocalDate`-rekenkunde. ─────────────────────────────────────────────────────────────

function daysInMonthUtc(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** MPXJ se `DayOfWeekHelper.getValue` (1=zondag..7=zaterdag) toegepast op een UTC-`Date` via
 *  `getUTCDay()` (0=zondag..6=zaterdag) — `+1` is exact de vertaling tussen de twee schema's. */
function mpxjDayValue(d: Date): number {
  return d.getUTCDay() + 1;
}

/** MPXJ se `moreDates(date, dates)` (RecurringData.java): zonder `finishDate` bepaalt `occurrences`
 *  (geklemd op minimaal 1, net als Java) de grens; mét `finishDate` geldt `!date.isAfter(finish)`. */
function moreDates(date: Date, generatedCount: number, finishDate: Date | null, occurrences: number): boolean {
  if (!finishDate) {
    const occ = occurrences < 1 ? 1 : occurrences;
    return generatedCount < occ;
  }
  return date.getTime() <= finishDate.getTime();
}

/** MPXJ se `getOrdinalRelativeDay` — de n-de gevraagde weekdag vanaf `date`. */
function ordinalRelativeDay(date: Date, dayNumber: number, dayOfWeekValue: number): Date {
  const currentDayOfWeek = mpxjDayValue(date);
  let offset = 0;
  if (dayOfWeekValue > currentDayOfWeek) offset = dayOfWeekValue - currentDayOfWeek;
  else if (dayOfWeekValue < currentDayOfWeek) offset = 7 - (currentDayOfWeek - dayOfWeekValue);
  let d = offset !== 0 ? addCalendarDays(date, offset) : date;
  if (dayNumber > 1) d = addCalendarDays(d, 7 * (dayNumber - 1));
  return d;
}

/** MPXJ se `getLastRelativeDay` — de laatste gevraagde weekdag van de maand van `date`. */
function lastRelativeDay(date: Date, dayOfWeekValue: number): Date {
  const year = date.getUTCFullYear();
  const month0 = date.getUTCMonth();
  let d = new Date(Date.UTC(year, month0, daysInMonthUtc(year, month0)));
  const currentDayOfWeek = mpxjDayValue(d);
  let offset = 0;
  if (currentDayOfWeek > dayOfWeekValue) offset = dayOfWeekValue - currentDayOfWeek;
  else if (currentDayOfWeek < dayOfWeekValue) offset = -7 + (dayOfWeekValue - currentDayOfWeek);
  if (offset !== 0) d = addCalendarDays(d, offset);
  return d;
}

/** MPXJ se `getDailyDates`. Zie `MAX_RECURRENCE_DATES`/`MAX_RECURRENCE_ITERATIONS` voor de dubbele
 *  (output- én iteratie-)klem — hier structureel niet vereist (elke doorloop voegt precies 1 datum
 *  toe), maar aangehouden voor uniformiteit met de andere vijf generatoren. */
function getDailyDates(startDate: Date, frequency: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  let date = startDate;
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    dates.push(date);
    date = addCalendarDays(date, frequency);
  }
  return dates;
}

/** MPXJ se `getWeeklyDates`. `currentDay` cyclet 0=zo..6=za (JS `getUTCDay()`), wat toevallig
 *  identiek is aan `dayMask`'s bit-layout — geen aparte vertaaltabel nodig. De "terug naar
 *  zondag"-aanpassing gebruikt eveneens plain `jsDay` (Java se `currentDay.getValue()` — STANDAARD
 *  `java.time.DayOfWeek` 1=ma..7=zo, NIET DayOfWeekHelper se schema — komt toevallig 1:1 overeen met
 *  JS se `getUTCDay()` voor elke niet-zondag-waarde: ma=1..za=6 in beide schema's).
 *
 *  `iterations` is hier GEEN cosmetische toevoeging — een lege `dayMask` (geen enkele weekdag
 *  aangevinkt) met `finishDate===null` laat deze lus anders ONEINDIG doorlopen (`dates.length` blijft
 *  0, dus zowel `MAX_RECURRENCE_DATES` als een `occurrences`-gebaseerde `moreDates()`-grens triggeren
 *  nooit). Zie `check-mpp-calendars.ts`'s "HOOG-1b" rode-pad-fixture. */
function getWeeklyDates(startDate: Date, frequency: number, dayMask: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  let date = startDate;
  let currentDay = date.getUTCDay();
  if (currentDay !== 0) {
    date = addCalendarDays(date, -currentDay);
    currentDay = 0;
  }
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    let offset = 0;
    for (let dayIndex = 0; dayIndex < 7 && dates.length < MAX_RECURRENCE_DATES; dayIndex++) {
      if ((dayMask & (1 << currentDay)) !== 0) {
        if (offset !== 0) {
          date = addCalendarDays(date, offset);
          offset = 0;
        }
        if (!moreDates(date, dates.length, finishDate, occurrences)) break;
        if (date.getTime() >= startDate.getTime()) dates.push(date);
      }
      offset++;
      currentDay = (currentDay + 1) % 7;
    }
    if (frequency > 1) offset += 7 * (frequency - 1);
    date = addCalendarDays(date, offset);
  }
  return dates;
}

/** MPXJ se `getMonthlyAbsoluteDates`. Zie `getDailyDates`'s toelichting — `iterations` hier ook
 *  structureel overbodig (elke doorloop voegt 1 datum toe) maar aangehouden voor uniformiteit. */
function getMonthlyAbsoluteDates(startDate: Date, frequency: number, dayNumber: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  const currentDayNumber = startDate.getUTCDate();
  let date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  if (dayNumber < currentDayNumber) date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    const year = date.getUTCFullYear();
    const month0 = date.getUTCMonth();
    const useDay = Math.min(dayNumber, daysInMonthUtc(year, month0));
    date = new Date(Date.UTC(year, month0, useDay));
    dates.push(date);
    date = new Date(Date.UTC(year, month0, 1));
    date = new Date(Date.UTC(year, month0 + frequency, 1));
  }
  return dates;
}

/** MPXJ se `getMonthlyRelativeDates`.
 *
 *  VALKUIL: dagnummer 1 met een `dayOfWeekValue` zodanig dat `ordinalRelativeDay` de
 *  eerste-van-de-maand-cursor TERUGZET in de vorige maand (een negatieve dag-offset). Die datum wordt
 *  afgewezen (`< startDate`), waarna de cursor terugvalt op eerste-van-de-VORIGE-maand-plus-`frequency`
 *  — bij frequentie 1 exact de maand waar de lus al stond: de cursor staat STIL en `dates.length`
 *  blijft 0. Zonder `iterations` en de monotone-cursorcheck loopt de lus ONEINDIG. Zie
 *  `check-mpp-calendars.ts`'s "HOOG-1a" rode-pad-fixture. */
function getMonthlyRelativeDates(startDate: Date, frequency: number, dayOfWeekValue: number, dayNumber: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  let date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    const cursor = date;
    date = dayNumber > 4 ? lastRelativeDay(date, dayOfWeekValue) : ordinalRelativeDay(date, dayNumber, dayOfWeekValue);
    if (date.getTime() >= startDate.getTime()) {
      dates.push(date);
      if (!moreDates(date, dates.length, finishDate, occurrences)) break;
    }
    // Eén allocatie i.p.v. twee: jaar/maand hier vastleggen en in één stap doorschuiven, zonder
    // tussentijdse "dag 1 van dezelfde maand"-Date. Relevant op de gedegenereerde lus-paden, waar
    // deze reset duizenden keren per record kan draaien.
    const nextDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + frequency, 1));
    if (nextDate.getTime() <= cursor.getTime()) break;
    date = nextDate;
  }
  return dates;
}

/** MPXJ se `getYearlyAbsoluteDates`. LET OP (letterlijk overgenomen MPXJ-gedrag, geen eigen bug):
 *  de WHILE-conditie toetst de cursor VÓÓR de `date.isBefore(startDate) ⇒ +1 jaar`-correctie, dus
 *  het laatst toegevoegde datum kan net BUITEN het nominale `[startDate,finishDate]`-venster vallen
 *  (spiegelt `getCalculatedLastDate`'s eigen documentatie: "de finish-datum hoeft niet exact op een
 *  gegenereerde datum te liggen").
 *
 *  Schrikkeljaar-rollover: de `+1-jaar`-correctie spiegelt `LocalDate.plusYears`'s ECHTE semantiek —
 *  Java construeert het brondatum-object EERST met het AL-GEKLEMDE dagnummer van het ORIGINELE jaar
 *  (`useDay`, bv. 28 in een niet-schrikkeljaar), en `plusYears(1)` klemt DÁT getal (via
 *  `resolvePreviousValid`) opnieuw tegen de nieuwe maandlengte — het rauwe `dayNumber` (bv. 29) komt
 *  daar nooit meer aan te pas, ook niet als het doeljaar weer een schrikkeljaar is. Voorbeeld: dag 29
 *  maand 2, startDate 2019-06-01 ⇒ `useDay=min(29,28)=28` ⇒ Feb28-2019, vóór startDate ⇒ correctie
 *  naar 2020: `min(28,29)=28` ⇒ Feb28-2020, NIET Feb29-2020. Daarom wordt `useDay` (niet
 *  `dayNumber`) opnieuw geklemd tegen de maandlengte van het GECORRIGEERDE jaar. */
function getYearlyAbsoluteDates(startDate: Date, dayNumber: number, monthNumber: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  let date = new Date(Date.UTC(startDate.getUTCFullYear(), monthNumber - 1, 1));
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    const year = date.getUTCFullYear();
    const month0 = date.getUTCMonth();
    const useDay = Math.min(dayNumber, daysInMonthUtc(year, month0));
    date = new Date(Date.UTC(year, month0, useDay));
    if (date.getTime() < startDate.getTime()) {
      const bumpedYear = year + 1;
      const bumpedDay = Math.min(useDay, daysInMonthUtc(bumpedYear, month0)); // het AL-GEKLEMDE useDay her-klemmen, niet het rauwe dayNumber
      date = new Date(Date.UTC(bumpedYear, month0, bumpedDay));
    }
    dates.push(date);
    date = new Date(Date.UTC(date.getUTCFullYear(), month0, 1));
    date = new Date(Date.UTC(date.getUTCFullYear() + 1, month0, 1));
  }
  return dates;
}

/** MPXJ se `getYearlyRelativeDates`. */
function getYearlyRelativeDates(startDate: Date, dayOfWeekValue: number, dayNumber: number, monthNumber: number, finishDate: Date | null, occurrences: number): Date[] {
  const dates: Date[] = [];
  let date = new Date(Date.UTC(startDate.getUTCFullYear(), monthNumber - 1, 1));
  let iterations = 0;
  while (dates.length < MAX_RECURRENCE_DATES && iterations < MAX_RECURRENCE_ITERATIONS && moreDates(date, dates.length, finishDate, occurrences)) {
    iterations++;
    date = dayNumber > 4 ? lastRelativeDay(date, dayOfWeekValue) : ordinalRelativeDay(date, dayNumber, dayOfWeekValue);
    if (date.getTime() >= startDate.getTime()) {
      dates.push(date);
      if (!moreDates(date, dates.length, finishDate, occurrences)) break;
    }
    date = new Date(Date.UTC(date.getUTCFullYear() + 1, date.getUTCMonth(), 1));
  }
  return dates;
}

/** Poort van `RecurringData.populateDates()`/`getDates()` — dispatcht naar de generatiefunctie voor
 *  `spec.type`. `frequency<1 ⇒ 1` (Java se eigen `NumberHelper.getInt(m_frequency)<1 ⇒ 1`-vangnet in
 *  `populateDates`, hier vlak vóór dispatch i.p.v. in elke generatiefunctie apart). */
export function expandRecurrence(spec: RecurrenceSpec): Date[] {
  const frequency = spec.frequency < 1 ? 1 : spec.frequency;
  switch (spec.type) {
    case 'DAILY':
      return getDailyDates(spec.startDate, frequency, spec.finishDate, spec.occurrences);
    case 'WEEKLY':
      return getWeeklyDates(spec.startDate, frequency, spec.weeklyDayMask, spec.finishDate, spec.occurrences);
    case 'MONTHLY':
      return spec.relative
        ? getMonthlyRelativeDates(spec.startDate, frequency, spec.dayOfWeekValue, spec.dayNumber, spec.finishDate, spec.occurrences)
        : getMonthlyAbsoluteDates(spec.startDate, frequency, spec.dayNumber, spec.finishDate, spec.occurrences);
    case 'YEARLY':
      return spec.relative
        ? getYearlyRelativeDates(spec.startDate, spec.dayOfWeekValue, spec.dayNumber, spec.monthNumber, spec.finishDate, spec.occurrences)
        : getYearlyAbsoluteDates(spec.startDate, spec.dayNumber, spec.monthNumber, spec.finishDate, spec.occurrences);
  }
}

/** Eén RUW gelezen uitzonderingsrecord — vóór precedentie-resolutie, formaat-neutraal (geen
 *  byte-offsets/XML-elementnamen). `recurring` is gezet voor een NIET-geflattende recurrente
 *  uitzondering; anders `null` en geldt het venster als een letterlijk [fromDate,toDate]-bereik
 *  (spiegelt mspdiReader's `DayWorking`-exceptions). Elke lezer (mppCalendars.ts, mspdiReader.ts)
 *  bouwt zijn EIGEN `RawException[]` uit zijn eigen serialisatievorm en geeft die aan
 *  `buildContributions` door. */
export interface RawException {
  fromDate: Date;
  toDate: Date | null;
  periodCount: number;
  bands: { start: number; end: number }[];
  name: string;
  recurring: RecurrenceSpec | null;
}

/** Eén brondocument-record se EIGEN, geordende datumlijst — voor recurrente records de geëxpandeerde
 *  datums (`expandRecurrence`), voor niet-recurrente records het (geklemde) dag-voor-dag-bereik
 *  [fromDate,clampedToDate]. Draagt tevens de WAARDE die deze bron voor elke dag in die lijst claimt
 *  (`working`/`bands`/`name`) — `resolveContributions` beslist per datum of die claim de
 *  autoriteitskaart wint. */
export interface RecordContribution {
  ownDates: Date[];
  working: boolean;
  bands: { start: number; end: number }[];
  name: string;
}

/**
 * Groepeert `raw` in `RecordContribution`'s, in PRECEDENTIE-VOLGORDE: eerst recurrente records per
 * `RECURRENCE_PRECEDENCE_ORDER`-groep (WEEKLY→MONTHLY→YEARLY→DAILY; binnen één groep in
 * brondocument-volgorde), dan niet-recurrent-equivalente records (in brondocument-volgorde) — exact
 * de volgorde waarin `resolveContributions` ze over de autoriteitskaart legt (latere contributie
 * wint per datum).
 *
 * MPXJ-regel: `ProjectCalendar.populateExpandedExceptions()` classificeert een uitzondering NIET op
 * haar recurrentietype, maar op `exception.getExpandedExceptions().size()` — expandeert ze (ONGEACHT
 * het type) tot exact één datum, dan geldt ze als NIET-recurrent (hoogste prioriteit, dezelfde
 * `nonRecurring`-lijst als een letterlijk niet-recurrente uitzondering), NIET via de type-gebaseerde
 * precedentie. Voorbeeld: een YEARLY-absolute uitzondering met een venster dat maar één datum
 * oplevert wint op die dag van een DAILY-frequentie-2-uitzondering (normaliter HOGERE precedentie).
 *
 * `budget` (het GEDEELDE `HolidayBudget` over alle kalenders) begrenst hier AL de TOTALE hoeveelheid
 * gegenereerde `ownDates` — niet pas achteraf in `resolveContributions`. `expandRecurrence` klemt per
 * record (`MAX_RECURRENCE_DATES`), maar zonder deze klem is de SOM over records onbegrensd (gemeten:
 * 2000 WEEKLY-records × bijna `MAX_RECURRENCE_DATES` datums ≈ 5,2s / ~1 GB). Een LOKALE aftelling
 * (`remaining`, begonnen bij `budget.remaining`, dus een READ-ONLY snapshot — het GEDEELDE object
 * wordt pas in `resolveContributions` gedecrementeerd) daalt per gegenereerde dag; zodra hij op is
 * stopt de opbouw (lopende record afgekapt, resterende records overgeslagen). Zo is de
 * PIEK-allocatie gebonden aan het budget, ongeacht hoeveel records het bestand claimt.
 */
export function buildContributions(raw: RawException[], budget: HolidayBudget): RecordContribution[] {
  const contributions: RecordContribution[] = [];
  const recurringByType = new Map<RecurrenceSpec['type'], { dates: Date[]; working: boolean; bands: { start: number; end: number }[]; name: string }[]>();
  const nonRecurringEquivalent: RecordContribution[] = [];
  let remaining = budget.remaining;

  for (const exc of raw) {
    if (remaining <= 0) break;

    if (exc.recurring) {
      const dates = expandRecurrence(exc.recurring);
      if (dates.length === 0) continue; // geen bijdrage, geen budget nodig

      if (dates.length === 1) {
        // Een tot-1-datum-ingeklapte recurrente uitzondering is NIET-recurrent-equivalent
        // (hoogste prioriteit), ongeacht het recurrentietype — zie de functietoelichting hierboven.
        nonRecurringEquivalent.push({ ownDates: dates, working: exc.periodCount > 0, bands: exc.bands, name: exc.name });
        remaining -= 1;
        continue;
      }

      const clamped = dates.length <= remaining ? dates : dates.slice(0, remaining);
      remaining -= clamped.length;
      if (clamped.length === 0) continue;
      const entry = { dates: clamped, working: exc.periodCount > 0, bands: exc.bands, name: exc.name };
      const bucket = recurringByType.get(exc.recurring.type);
      if (bucket) bucket.push(entry);
      else recurringByType.set(exc.recurring.type, [entry]);
    } else if (exc.toDate) {
      // Niet-recurrent ZONDER toDate (sentinel) wordt overgeslagen.
      let clampedTo = exc.toDate;
      const rangeDays = Math.round((exc.toDate.getTime() - exc.fromDate.getTime()) / 86_400_000);
      // `>=` i.p.v. `>` maakt
      // `MAX_HOLIDAY_RANGE_DAYS` de ECHTE (inclusieve) bovengrens op het aantal dagen.
      if (rangeDays >= MAX_HOLIDAY_RANGE_DAYS) {
        clampedTo = addCalendarDays(exc.fromDate, MAX_HOLIDAY_RANGE_DAYS - 1);
      } else if (rangeDays < 0) {
        clampedTo = exc.fromDate; // omgekeerd bereik: degradeer naar 1 dag i.p.v. een lege/negatieve marge
      }
      const ownDates: Date[] = [];
      let cursor = exc.fromDate;
      while (cursor.getTime() <= clampedTo.getTime() && remaining > 0) {
        ownDates.push(cursor);
        remaining--;
        cursor = addCalendarDays(cursor, 1);
      }
      if (ownDates.length > 0) nonRecurringEquivalent.push({ ownDates, working: exc.periodCount > 0, bands: exc.bands, name: exc.name });
    }
  }

  for (const type of RECURRENCE_PRECEDENCE_ORDER) {
    for (const entry of recurringByType.get(type) ?? []) {
      contributions.push({ ownDates: entry.dates, working: entry.working, bands: entry.bands, name: entry.name });
    }
  }
  contributions.push(...nonRecurringEquivalent);

  return contributions;
}

function isNextCalendarDay(prevIso: string, iso: string): boolean {
  return formatDate(addCalendarDays(parseDate(prevIso), 1)) === iso;
}

/** Precedentie-resolutie over `contributions` (al in de juiste volgorde — zie `buildContributions`):
 *  bouwt EERST een per-datum-autoriteitskaart (`authority`) door ELKE dag van ELKE contributie in
 *  volgorde te zetten (latere `.set()` wint) — dit IS de invariant-garantie: per datum bestaat er
 *  precies één beslissing, ongeacht hoeveel brondocument-records diezelfde dag claimen of via welke
 *  twee-verschillende-fromDates-botsing MPXJ's eigen kaart dat zou missen. De kaart bewaart de
 *  WINNENDE CONTRIBUTIE-INDEX (niet de waarde zelf) — BLOKKEREND detail: twee VERSCHILLENDE
 *  contributies kunnen toevallig een IDENTIEKE waarde claimen voor dezelfde dag (bv. twee
 *  ongenaamde, bandloze feestdag-records) — een waarde-gelijkheids-toets zou dan niet kunnen
 *  onderscheiden welke van de twee "gewonnen" heeft, en zou de dag bij BEIDE contributies als
 *  "overleefd" laten gelden (dubbele output-entries voor dezelfde dag). Identiteit via index sluit
 *  dat expliciet uit. `budget` wordt hier verbruikt (één slot per dag die de kaart daadwerkelijk
 *  bereikt) — dit is STRIKTER dan "één slot per output-entry" (een lange reeks wordt hier per DAG
 *  afgeboekt, niet per bereik), bewust conservatief: het bindt de kaart se eigen geheugengrootte,
 *  niet alleen de uiteindelijke entry-telling. (`buildContributions` heeft de TOTALE hoeveelheid
 *  `ownDates` hierboven al tegen hetzelfde budget begrensd — deze decrementatie kan dus nooit meer
 *  dagen tellen dan daar al is toegestaan.)
 *
 *  DAARNA worden de OORSPRONKELIJKE contributies opnieuw doorlopen (zelfde volgorde) om de
 *  outputvorm te bepalen: voor elke contributie (op INDEX) wordt gekeken welke van haar EIGEN dagen
 *  de autoriteitskaart nog steeds aan HAAR (exact díe index) toekent — aaneengesloten overlevende
 *  dagen worden samengevoegd tot één bereik-entry. Een record wiens dagen NOOIT door iets anders
 *  geclaimd worden (het overgrote-merendeel-geval) levert dus één entry per record, ONGEACHT of een
 *  ANDER, ongerelateerd record toevallig een aangrenzende datum claimt (dat wordt NOOIT meegenomen in
 *  dezelfde entry — samenvoeging gebeurt uitsluitend BINNEN de dagenlijst van ÉÉN contributie, nooit
 *  ACROSS records). */
export function resolveContributions(contributions: RecordContribution[], budget: HolidayBudget): ParsedExceptions {
  const authority = new Map<string, number>(); // ISO-datum → winnende contributie-index
  outer: for (let i = 0; i < contributions.length; i++) {
    for (const date of contributions[i].ownDates) {
      if (budget.remaining <= 0) break outer;
      authority.set(formatDate(date), i);
      budget.remaining--;
    }
  }

  const holidays: ParsedExceptions['holidays'] = [];
  const workingExceptions: ParsedExceptions['workingExceptions'] = [];
  for (let i = 0; i < contributions.length; i++) {
    const c = contributions[i];
    let runStart: string | null = null;
    let runEnd: string | null = null;
    const flush = (): void => {
      if (runStart === null || runEnd === null) return;
      const name = c.name || (c.working ? 'Working exception' : 'Holiday');
      if (c.working) workingExceptions.push({ name, startDate: runStart, endDate: runEnd, bands: c.bands.length ? c.bands : undefined });
      else holidays.push({ name, startDate: runStart, endDate: runEnd });
    };
    for (const date of c.ownDates) {
      const iso = formatDate(date);
      const survives = authority.get(iso) === i;
      if (!survives) {
        flush();
        runStart = null;
        runEnd = null;
        continue;
      }
      if (runStart === null) {
        runStart = iso;
      } else if (runEnd !== null && !isNextCalendarDay(runEnd, iso)) {
        flush();
        runStart = iso;
      }
      runEnd = iso;
    }
    flush();
  }

  return { holidays, workingExceptions };
}

/** Herexpandeert een AL GERESOLVEDE (compacte) `Holiday`/`WorkingException`-reeks — voor
 *  overervingsdoeleinden (`mergeInherited` hieronder): de basiskalender se holidays/
 *  workingExceptions zijn zelf al `resolveContributions`-uitvoer (dus al binnen alle bestaande
 *  klemmen gematerialiseerd), maar moeten opnieuw dag-voor-dag beschikbaar zijn om tegen de EIGEN
 *  uitzonderingen van de afgeleide kalender te kunnen prioriteren (`resolveContributions` beslist
 *  per DAG, niet per bereik). Geklemd op `MAX_RECURRENCE_DATES` als eigen veiligheidsgrens
 *  (onafhankelijk van `budget` — dit is een HER-expansie van reeds-gematerialiseerde, dus al
 *  geklemde, data, geen nieuwe bestandsgestuurde lus, maar een dubbele klem kost niets en voorkomt
 *  een verrassing als een toekomstige wijziging die garantie ooit verzwakt). */
function reExpandRange(startIso: string, endIso: string): Date[] {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  const rangeDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const cappedDays = Math.min(rangeDays, MAX_RECURRENCE_DATES - 1);
  const out: Date[] = [];
  for (let i = 0; i <= cappedDays; i++) out.push(addCalendarDays(start, i));
  return out;
}

/** Overervingsregel afgeleide kalender: "eigen uitzondering wint per datum van de basiskalender" —
 *  MPXJ valt pas op de ouder terug als de eigen kalender die datum niet kent. Herbruikt
 *  `resolveContributions`'s autoriteitskaart-mechanisme: de basiskalender se ALREADY-gematerialiseerde
 *  `holidays`/`workingExceptions` worden als LAAGSTE-prioriteit-contributies aangeboden (herexpansie
 *  via `reExpandRange`), gevolgd door de afgeleide kalender se EIGEN contributies — exact dezelfde
 *  "latere-contributie-wint-per-datum"-mechaniek als binnen één kalender, nu toegepast over de
 *  basis→afgeleide-grens heen. */
export function mergeInherited(base: ParsedExceptions, ownContributions: RecordContribution[], budget: HolidayBudget): ParsedExceptions {
  const baseContributions: RecordContribution[] = [
    ...base.holidays.map((h) => ({ ownDates: reExpandRange(h.startDate, h.endDate), working: false, bands: [], name: h.name })),
    ...base.workingExceptions.map((w) => ({ ownDates: reExpandRange(w.startDate, w.endDate), working: true, bands: w.bands ?? [], name: w.name })),
  ];
  return resolveContributions([...baseContributions, ...ownContributions], budget);
}
