/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * Kalenderfabriek: poort van `MPP14CalendarFactory.java` + `AbstractCalendarFactory.java` +
 * `AbstractCalendarAndExceptionFactory.java` — `"   114"/TBkndCal` (FixedMeta itemSize=10,
 * FixedData maxExpectedSize=12, VarMeta12, Var2Data) → basiskalenders + afgeleide (resource-)
 * kalenders via de base-kalender-verwijzing, weekdag-uren → `WorkCalendar.workDays` + banden,
 * uitzonderingen → `WorkCalendar.holidays` (gematerialiseerd). Recurrente uitzonderingen (alle vier
 * types × absoluut/relatief, poort van `RecurringData`) worden geëxpandeerd; WERKENDE uitzonderingen
 * (`periodCount>0`) worden `WorkCalendar.workingExceptions`.
 *
 * Doelsemantiek is IDENTIEK aan de kalendersectie van `mspdiReader.ts` (`applyCalendarBody`/
 * `parseCalendar`) — zelfde `WorkCalendar`-vorm, dezelfde `canonicalizeBands`/
 * `registerCalendarBands`/`promoteHourCalendar`-orkestratie uit `@/services/subdayIo`.
 *
 * `buildCalendarFromDays` registreert alleen banden en promoveert NIET: promotie is een losse stap
 * (`promoteCalendarsForHourMode`) die `readTasks` (mppReader.ts) pas ná de taak-signaal-scan
 * aanroept, net als mspdiReader. Reden: `isSubDayMinutes`/de datumdiscriminator moeten de SCALAIRE
 * `cal.hoursPerDay` van vóór promotie lezen, niet de door `deriveHoursPerDay` herberekende waarde.
 *
 * Twee bewuste verschillen met `mspdiReader.ts`:
 *  a. `WorkCalendar.holidays` begint hier ALTIJD als `[]`; mspdiReader start bij
 *     `createDefaultCalendar()` (met gegenereerde NL-feestdagen) en overschrijft die alleen bij ≥1
 *     `<Exception>`. MPP-kalenders zijn altijd letterlijke bestandsdata, nooit een stille default.
 *  b. Naamloze kalenders krijgen hier `"Kalender <uid>"` (uniek per kalender); mspdiReader valt terug
 *     op `"Imported Calendar"`.
 *
 * FieldMap-vrij: MPXJ's `CalendarFactory` gebruikt GEEN data-gedreven field map (anders dan
 * taken/resources/assignments, zie `fieldMap14.ts`) — de var-data-typen voor naam (1) en
 * kalenderdata (8) zijn letterlijke constanten in `MPP14CalendarFactory.java`.
 *
 * Hardingsdiscipline: elke bestandsgestuurde lus-/allocatiegrens is geklemd — `MAX_DAY_HOUR_PERIODS`,
 * `MAX_CALENDAR_EXCEPTIONS`, `MAX_HOLIDAY_RANGE_DAYS`, `MAX_BASE_CHAIN_DEPTH`, `MAX_CALENDARS` en
 * `MAX_TOTAL_HOLIDAY_SLOTS`. Per-kalenderklemmen alleen volstaan niet: 100.001 nep-basiskalenders in
 * een 3 MB TBkndCal-blok gaven een OOM-crash. `MAX_CALENDARS` kapt de FixedData-iteratie af;
 * `MAX_TOTAL_HOLIDAY_SLOTS` is een gedeeld budget voor zowel `parseExceptions` als de
 * base→afgeleide-overerving in `materializeDerived` (die de base-array per afgeleide kalender kopieert,
 * anders O(N×M)).
 */
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { canonicalizeBands, promoteHourCalendars, registerCalendarBands } from '@/services/subdayIo';
import type { CfbFile } from './cfb';
import type { Props } from './mppContainer';
import { FixedData, FixedMeta, Var2Data, VarMeta12, getDate, getInt, getShort, getUnicodeString } from './mppPrimitives';
import { MAX_VAR_TEXT_BYTES, MAX_EXCEPTION_BAND_PERIODS } from './limits';
// De formaat-neutrale recurrentie-/precedentiekern staat in `@/services/calendarRecurrence.ts`
// (bladmodule zonder mpp-imports). Importeer die rechtstreeks van daar: een import via dit bestand
// trekt de hele MPP-parser de main-chunk in (`tests/planning/check-mpp-chunk-boundary.ts`). De namen
// worden hier alleen hergeëxporteerd voor bestaande callers.
import {
  expandRecurrence, buildContributions, resolveContributions, mergeInherited, newHolidayBudget,
  RECURRENCE_TYPES, RELATIVE_MAP, RECURRENCE_PRECEDENCE_ORDER,
  MAX_CALENDAR_EXCEPTIONS, MAX_HOLIDAY_RANGE_DAYS, MAX_TOTAL_HOLIDAY_SLOTS,
} from '@/services/calendarRecurrence';
import type { RecurrenceSpec, RecordContribution, RawException, ParsedExceptions, HolidayBudget } from '@/services/calendarRecurrence';

export {
  expandRecurrence, resolveContributions, newHolidayBudget,
  RECURRENCE_TYPES, RELATIVE_MAP, RECURRENCE_PRECEDENCE_ORDER,
  MAX_CALENDAR_EXCEPTIONS, MAX_HOLIDAY_RANGE_DAYS, MAX_TOTAL_HOLIDAY_SLOTS,
};
export type { RecurrenceSpec, RecordContribution, ParsedExceptions, HolidayBudget };

// ── PropsKey-sleutels (PropsKey.java) — gelezen uit `"   114"/Props`, net als de andere
// project-brede sleutels in mppReader.ts. ──────────────────────────────────────────────────────
const PROPS_KEY_DEFAULT_CALENDAR_NAME = 37748750;
const PROPS_KEY_DEFAULT_CALENDAR_HOURS = 37753736;

/** TBkndCal/FixedMeta-itemgrootte (AbstractCalendarFactory.java: `new FixedMeta(..., 10)`). */
const CAL_FIXED_META_ITEM_SIZE = 10;
/** TBkndCal/FixedData-itemgrootte-bovengrens (AbstractCalendarFactory.java: `new FixedData(...,
 *  12)`) — elk item draagt precies één `calendarID/baseCalendarID/resourceID`-triplet van 4 bytes. */
const CAL_FIXED_DATA_MAX_SIZE = 12;

/** MPP14CalendarFactory.java: vaste var-data-typen (geen field-map-indirectie, zie moduleheader). */
const CALENDAR_NAME_VAR_TYPE = 1;
const CALENDAR_DATA_VAR_TYPE = 8;

/** Gedeelde tekstklem uit `./limits.ts`. */
const MAX_CALENDAR_TEXT_BYTES = MAX_VAR_TEXT_BYTES;

/** Klem op het aantal werktijdperiodes per weekdag (`periodCount`, SHORT 0..65535), dat een lus op
 *  bestandsgestuurde offsets aanstuurt. Structureel passen er in het 60-byte-dagblok hoogstens 6
 *  niet-overlappende periodes: start-slot `i` staat op `8+2i` en botst vanaf `i>=6` met duur-slot 0
 *  (`+20`). MS Project's UI staat hooguit 5 periodes per dag toe, dus 5 is zowel de structurele als
 *  de productgrens. Zie `check-mpp-calendars.ts` ("MAX_DAY_HOUR_PERIODS-overlapfout"): ongeklemd
 *  materialiseert periodCount=7 een fantoomband uit de duurbytes. */
const MAX_DAY_HOUR_PERIODS = 5;

/** Bovengrens op het AANTAL kalenders dat `readCalendars` uit één `"   114"/TBkndCal`-storage
 *  materialiseert (zie de moduleheader: 100.001 nep-records ⇒ OOM). Het corpus heeft hoogstens 13
 *  kalenders per bestand; 1024 is ruim, maar begrenst een geprepareerd bestand hard — de
 *  FixedData-iteratie stopt zodra de klem is bereikt. */
export const MAX_CALENDARS = 1_024;

/** Begrenst de base-kalender-ketenvolging voor afgeleide (resource-)kalenders. Een geprepareerd
 *  bestand kan een kalender naar zichzelf of circulair laten verwijzen; MPXJ beschermt daar niet
 *  tegen (`updateBaseCalendarNames` heeft geen cyclusdetectie). De fixed-point-resolutie in
 *  `readCalendars` probeert hoogstens dit aantal ronden; wat dan nog niet opgelost is, wordt zonder
 *  overerving gematerialiseerd. */
export const MAX_BASE_CHAIN_DEPTH = 32;

/** Eén weekdag, volledig geresolveerd (geen "gebruik de default/base"-sentinel meer) — de
 *  tussenvorm die zowel de projectbrede DEFAULT_CALENDAR_HOURS-fallback, een basiskalender én een
 *  afgeleide kalender in hetzelfde format bewaart, zodat een afgeleide kalender een reeds
 *  gematerialiseerde basiskalender rechtstreeks als eigen fallback kan hergebruiken (zie
 *  `daysByUniqueId` in `readCalendars`). */
interface DayResolution {
  working: boolean;
  bands: { start: number; end: number }[];
}

/** MPPUtility/ProjectCalendarDays' eigen terugval wanneer zowel een kalenderdag als de
 *  project-brede DEFAULT_CALENDAR_HOURS-eigenschap "default" zijn: `DEFAULT_WORKING_WEEK`
 *  (ma-vr werkend) + `DEFAULT_WORKING_MORNING`/`DEFAULT_WORKING_AFTERNOON` (08:00-12:00,
 *  13:00-17:00) — AbstractCalendarFactory.java. Index 0=zondag..6=zaterdag (MPP-dagblokvolgorde,
 *  zie `resolveOneDay`). */
const STANDARD_DAY_HOURS_FALLBACK: ReadonlyArray<DayResolution> = [
  { working: false, bands: [] }, // zo
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] }, // ma
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] }, // di
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] }, // wo
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] }, // do
  { working: true, bands: [{ start: 480, end: 720 }, { start: 780, end: 1020 }] }, // vr
  { working: false, bands: [] }, // za
];

/** MPP-tijdwaarde (SHORT, tienden-van-minuut sinds middernacht) → minuten-vanaf-middernacht,
 *  spiegelt `MPPUtility.getTime`'s seconden-afronding maar dan in minuten (subdayIo's
 *  bandeenheid). */
function mppTimeToMinutes(raw: number): number {
  let minutes = Math.floor(raw / 10);
  if (minutes > 1439) minutes %= 1440;
  return minutes;
}

/** Eén weekdag-blok (60 bytes, `AbstractCalendarFactory.processCalendarHours`'s per-dag-lus) →
 *  `DayResolution`. `defaultFlag===1` ⇒ `fallback` (het "DEFAULT"-daytype — voor een basiskalender
 *  is dat de project-brede DEFAULT_CALENDAR_HOURS-fallback, voor een afgeleide kalender de
 *  resolved-base-fallback; de aanroeper kiest welke). `dayIndex` 0..6 = MPP-dagblokvolgorde
 *  (0=zondag..6=zaterdag, zie `DayOfWeekHelper.ORDERED_DAYS`). */
function resolveOneDay(data: Uint8Array, dayIndex: number, fallback: DayResolution, ctx: string): DayResolution {
  const offset = dayIndex * 60;
  if (data.length < offset + 4) return fallback;
  const defaultFlag = getShort(data, offset, ctx);
  if (defaultFlag === 1) return fallback;

  const rawPeriodCount = getShort(data, offset + 2, ctx);
  const periodCount = Math.min(Math.max(rawPeriodCount, 0), MAX_DAY_HOUR_PERIODS); // zie MAX_DAY_HOUR_PERIODS
  const bands: { start: number; end: number }[] = [];
  for (let i = 0; i < periodCount; i++) {
    const startOffset = offset + 8 + i * 2;
    const durationOffset = offset + 20 + i * 4;
    if (data.length < startOffset + 2 || data.length < durationOffset + 2) break;
    const startMinutes = mppTimeToMinutes(getShort(data, startOffset, ctx));
    // MPPUtility.getDuration(byte[],offset): tienden-van-minuut, ondanks de 4-byte-stride ZELF een
    // SHORT-read (de hoge 2 bytes van elke 4-byte-periode-slot zijn ongebruikt/gereserveerd).
    const durationMinutes = Math.floor(getShort(data, durationOffset, ctx) / 10);
    if (durationMinutes > 0) bands.push({ start: startMinutes, end: startMinutes + durationMinutes });
  }
  return { working: bands.length > 0, bands };
}

/** Alle 7 weekdagen van één kalenderdata-blok resolven — `data === null` (kalender zonder eigen
 *  Var2Data-record) ⇒ het volledige `fallback`-patroon overnemen, zoals MPXJ's eigen
 *  `varData == null`-terugval. */
function resolveDays(data: Uint8Array | null, fallback: ReadonlyArray<DayResolution>, ctx: string): DayResolution[] {
  const result: DayResolution[] = [];
  for (let index = 0; index < 7; index++) {
    result.push(data ? resolveOneDay(data, index, fallback[index], ctx) : fallback[index]);
  }
  return result;
}

/** `DayResolution[7]` (index 0=zo..6=za) → een verse `WorkCalendar` met `workDays`/scalar-uren/
 *  banden gezet — spiegelt `mspdiReader.ts`'s `applyCalendarBody`. `holidays` wordt HIER altijd
 *  leeggemaakt (`createDefaultCalendar()`'s NL-feestdagen horen bij een NIEUW project); de aanroeper
 *  zet de echte, gematerialiseerde `holidays` erna. `description` wordt eveneens leeggemaakt: MPP kent
 *  geen per-kalender-omschrijving, en de hardgecodeerde default-tekst zou stil onwaar worden.
 *
 *  `hoursPerDayOverride` (niet-`null`) overschrijft de scalar-afgeleide `hoursPerDay` VÓÓR promotie,
 *  zodat promotie (die `hoursPerDay` via `deriveHoursPerDay` opnieuw kan afleiden) het laatste woord
 *  houdt — dezelfde volgorde als mspdiReader. */
function buildCalendarFromDays(name: string, days: ReadonlyArray<DayResolution>, hoursPerDayOverride: number | null): WorkCalendar {
  const cal = createDefaultCalendar();
  cal.id = generateId('mppcal');
  delete cal.generation; // MPP kent geen regelset-herkomst, net als MSPDI (zie mspdiReader.ts)
  cal.holidays = [];
  cal.description = '';
  cal.name = name;

  const rawByWeekday: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  const workDays: number[] = [];
  let scalar: { start: number; end: number } | null = null;
  for (let index = 0; index < 7; index++) {
    const isoDay = (index === 0 ? 7 : index) as 1 | 2 | 3 | 4 | 5 | 6 | 7; // MSP 1=zo..7=za → ISO 1=ma..7=zo
    const d = days[index];
    if (d && d.working && d.bands.length > 0) {
      workDays.push(isoDay);
      rawByWeekday[isoDay] = d.bands;
      if (!scalar) scalar = d.bands[0];
    }
  }
  if (workDays.length > 0) cal.workDays = workDays.sort((a, b) => a - b);
  if (scalar) {
    // FLOOR op beide grenzen — spiegelt mspdiReader's `parseInt(toTime.split(':')[0])` (het
    // hele-uurdeel van de kloktijd); `Math.ceil` gaf bij 17:30 een te hoge `hoursPerDay`.
    cal.workStartHour = Math.floor(scalar.start / 60);
    cal.workEndHour = Math.floor(scalar.end / 60);
    cal.hoursPerDay = cal.workEndHour - cal.workStartHour;
    if (cal.hoursPerDay <= 0) cal.hoursPerDay = 8;
  }
  if (hoursPerDayOverride !== null) cal.hoursPerDay = hoursPerDayOverride;

  const { bands, deviates } = canonicalizeBands(rawByWeekday);
  registerCalendarBands(cal, { canonical: bands, deviates });
  // Geen promotie hier (zie de moduleheader): `cal.hoursPerDay` blijft de SCALAIRE waarde tot
  // `promoteCalendarsForHourMode`, want `readTasks` heeft precies die nodig voor het (c)-signaal.
  return cal;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Recurrente uitzonderingen expanderen + werkende uitzonderingen lezen. Hier alleen het
// BYTE-SPECIFIEKE deel (het 92-byte-uitzonderingsblok,
// `AbstractCalendarAndExceptionFactory.processCalendarExceptions`/`readRecurringData`); de
// formaat-neutrale kern staat in `@/services/calendarRecurrence.ts`.
//
// Datumsubstraat: UTC-middernacht-`Date`'s (zelfde als `getDate` hier en `formatDate`/`parseDate`/
// `addCalendarDays` in `calendarRecurrence.ts`).

/** Losse, grens-gecontroleerde ENKELE-byte-lezer — `mppPrimitives.ts` exporteert alleen
 *  `getShort`/`getInt` (2/4 bytes); de MONTHLY/YEARLY-recurrentievelden (`+76`/`+77`/`+78`) zijn
 *  losse BYTES (`MPPUtility.getByte`). Zelfde grenscontrolediscipline als de gedeelde primitieven. */
function getByteAt(data: Uint8Array, offset: number, ctx: string): number {
  if (offset < 0 || offset + 1 > data.length) {
    throw new Error(`MPP: getByte buiten grenzen (offset=${offset}, bufferlengte=${data.length}) [${ctx}]`);
  }
  return data[offset];
}

/** Poort van `AbstractCalendarAndExceptionFactory.readRecurringData` (het deel van het 92-byte-
 *  uitzonderingsblok vanaf `+72`) — alle vier recurrentietypes × absoluut/relatief: WEEKLY
 *  dagen-bitmap `+76`/frequentie `+78`; MONTHLY absoluut dagnummer `+76`/frequentie `+78`, relatief
 *  weekdag `+77-2`/dagnummer `+76+1`/frequentie `+78` (SHORT); YEARLY absoluut dagnummer `+77`/maand
 *  `+76+1`, relatief weekdag `+78-2`/dagnummer `+77+1`/maand `+76+1`. Retourneert `null` voor een
 *  out-of-range `recurrenceTypeValue` (zie `RECURRENCE_TYPES`). */
function readRecurringData(data: Uint8Array, offset: number, fromDate: Date, toDate: Date | null, ctx: string): RecurrenceSpec | null {
  const recurrenceTypeValue = getShort(data, offset + 72, ctx);
  const type = recurrenceTypeValue >= 0 && recurrenceTypeValue < RECURRENCE_TYPES.length ? RECURRENCE_TYPES[recurrenceTypeValue] : null;
  if (type === null) return null;
  const relative = recurrenceTypeValue < RELATIVE_MAP.length ? RELATIVE_MAP[recurrenceTypeValue] : false;
  const occurrences = getShort(data, offset + 4, ctx);

  let frequency = 1;
  let weeklyDayMask = 0;
  let dayNumber = 0;
  let dayOfWeekValue = 0;
  let monthNumber = 0;

  switch (type) {
    case 'DAILY':
      // `@76` telt UITSLUITEND mee bij recurrenceTypeValue===7 — bij ===1 hardcodeert MPXJ
      // frequency=1 (ongeacht `@76`).
      frequency = recurrenceTypeValue === 1 ? 1 : getShort(data, offset + 76, ctx);
      break;
    case 'WEEKLY':
      // De rauwe byte IS al de bitmap in DAY_MASKS-layout (bit0=zondag..bit6=zaterdag) — MPXJ's
      // `setWeeklyDaysFromBitmap(byte, DAY_MASKS)` past exact dezelfde bit-per-index-toewijzing toe
      // (DAY_MASKS = {0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40}, index 1..7 = zo..za), dus geen
      // vertaalslag nodig — `getWeeklyDates` hieronder toetst met `1 << jsGetUTCDay()`, dezelfde
      // bit-per-weekdag-conventie (JS: 0=zo..6=za).
      weeklyDayMask = getByteAt(data, offset + 76, ctx);
      frequency = getShort(data, offset + 78, ctx);
      break;
    case 'MONTHLY':
      if (relative) {
        dayOfWeekValue = getByteAt(data, offset + 77, ctx) - 2;
        dayNumber = getByteAt(data, offset + 76, ctx) + 1;
        frequency = getShort(data, offset + 78, ctx);
      } else {
        dayNumber = getByteAt(data, offset + 76, ctx);
        frequency = getByteAt(data, offset + 78, ctx);
      }
      break;
    case 'YEARLY':
      if (relative) {
        dayOfWeekValue = getByteAt(data, offset + 78, ctx) - 2;
        dayNumber = getByteAt(data, offset + 77, ctx) + 1;
      } else {
        dayNumber = getByteAt(data, offset + 77, ctx);
      }
      monthNumber = getByteAt(data, offset + 76, ctx) + 1;
      break;
  }

  return { type, relative, startDate: fromDate, finishDate: toDate, occurrences, frequency, weeklyDayMask, dayNumber, dayOfWeekValue, monthNumber };
}

/** De werktijd-BANDEN van één uitzonderingsblok (`+20+i*2` start, `+32+i*4` duur), gezet wanneer
 *  `periodCount>0` ("werkende uitzondering": een anders niet-werkende dag krijgt eigen uren).
 *  `MAX_EXCEPTION_BAND_PERIODS` (limits.ts) is de structurele capaciteit van het 92-byte-blok. */
function readExceptionBands(data: Uint8Array, offset: number, periodCountRaw: number, ctx: string): { start: number; end: number }[] {
  const periodCount = Math.min(Math.max(periodCountRaw, 0), MAX_EXCEPTION_BAND_PERIODS);
  const bands: { start: number; end: number }[] = [];
  for (let i = 0; i < periodCount; i++) {
    const startOffset = offset + 20 + i * 2;
    const durationOffset = offset + 32 + i * 4;
    if (data.length < startOffset + 2 || data.length < durationOffset + 2) break;
    const startMinutes = mppTimeToMinutes(getShort(data, startOffset, ctx));
    const durationMinutes = Math.floor(getShort(data, durationOffset, ctx) / 10);
    if (durationMinutes > 0) bands.push({ start: startMinutes, end: startMinutes + durationMinutes });
  }
  return bands;
}

/** Eén uitzonderingenblok (`AbstractCalendarAndExceptionFactory.processCalendarExceptions`) →
 *  RUWE `RawException[]` — nog GEEN precedentie-resolutie (die doet `resolveExceptions`). Elk
 *  record met een leesbare `fromDate` (sentinel `65535 ⇒ null` — zie `getDate`) én ofwel een geldig
 *  recurrentiepatroon ofwel géén recurrentie wordt bewaard; een out-of-range `recurrenceTypeValue`
 *  (`readRecurringData` retourneert dan `null` terwijl `isFlattenedNonRecurring` ook `false` is)
 *  wordt STIL OVERGESLAGEN — spiegelt MPXJ's eigen uitkomst van 0 geëxpandeerde datums voor zo'n
 *  record (zie `RECURRENCE_TYPES`'s toelichting), functioneel gelijk zonder een nutteloos
 *  `RawException` met een lege datumlijst te hoeven dragen. */
function readRawExceptions(data: Uint8Array, ctx: string): RawException[] {
  const out: RawException[] = [];
  // `< 422`: 422 bytes is het minimum om de 2-byte `exceptionCount` op offset 420 te lezen; een
  // kortere grens liet een grensfout de hele kalenderlezing laten falen.
  if (data.length < 422) return out;
  const rawExceptionCount = getShort(data, 420, ctx);
  if (rawExceptionCount === 0) return out;
  const exceptionCount = Math.min(Math.max(rawExceptionCount, 0), MAX_CALENDAR_EXCEPTIONS); // zie MAX_CALENDAR_EXCEPTIONS

  let offset = 424;
  for (let index = 0; index < exceptionCount; index++) {
    if (offset + 92 > data.length) break; // afgekapt blok — MPP14Reader.java breekt hier ook af

    const fromDate = getDate(data, offset, ctx);
    const toDate = getDate(data, offset + 2, ctx);
    const periodCountRaw = getShort(data, offset + 14, ctx);
    const recurrenceTypeValue = getShort(data, offset + 72, ctx);

    let exceptionNameLength = getInt(data, offset + 88, ctx);
    if (exceptionNameLength % 4 !== 0) exceptionNameLength = (Math.floor(exceptionNameLength / 4) + 1) * 4;
    // Klem (zie MAX_CALENDAR_TEXT_BYTES): begrenst zowel het decodeerwerk als, op een vijandig
    // bestand, de offset-opschuiving naar de volgende uitzondering.
    exceptionNameLength = Math.max(0, Math.min(exceptionNameLength, MAX_CALENDAR_TEXT_BYTES));

    if (fromDate) {
      // `@76` telt UITSLUITEND mee bij recurrenceTypeValue===7 — bij ===1 hardcodeert MPXJ
      // frequency=1 (ongeacht `@76`).
      const isDaily = recurrenceTypeValue === 1 || recurrenceTypeValue === 7;
      const rawFrequency = recurrenceTypeValue === 1 ? 1 : getShort(data, offset + 76, ctx);
      const isFlattenedNonRecurring = recurrenceTypeValue === 0 || (isDaily && rawFrequency === 1);

      let recurring: RecurrenceSpec | null = null;
      let contributesNothing = false;
      if (!isFlattenedNonRecurring) {
        recurring = readRecurringData(data, offset, fromDate, toDate, ctx);
        contributesNothing = recurring === null; // out-of-range recurrenceTypeValue — zie RECURRENCE_TYPES
      }

      if (!contributesNothing) {
        const bands = readExceptionBands(data, offset, periodCountRaw, ctx);
        let name = '';
        if (exceptionNameLength > 0 && data.length >= offset + 92 + exceptionNameLength) {
          const decoded = getUnicodeString(data, offset + 92, exceptionNameLength, ctx);
          if (decoded) name = decoded;
        }
        out.push({
          fromDate,
          toDate,
          periodCount: Math.min(Math.max(periodCountRaw, 0), MAX_EXCEPTION_BAND_PERIODS),
          bands,
          name,
          recurring,
        });
      }
    }
    offset += 92 + exceptionNameLength;
  }
  return out;
}

/** Poort van `AbstractCalendarAndExceptionFactory.processCalendarExceptions`, plus recurrente
 *  expansie en werkende uitzonderingen. `buildContributions`/`resolveContributions`
 *  (`@/services/calendarRecurrence`) doen de precedentie-/invariantresolutie; hier alleen de
 *  byte-specifieke ruwe-recordopbouw. `budget` is het gedeelde `HolidayBudget` over ALLE kalenders
 *  in de `readCalendars`-run, voor zowel `holidays` als `workingExceptions`. */
export function parseExceptions(data: Uint8Array, ctx: string, budget: HolidayBudget): ParsedExceptions {
  return resolveContributions(buildContributions(readRawExceptions(data, ctx), budget), budget);
}

/** Eén ruwe TBkndCal/FixedData-record (12 bytes): kalender-uniqueID + base-kalender-uniqueID +
 *  resource-uniqueID. Veldvolgorde is versie-afhankelijk (`MPP14CalendarFactory.java`'s
 *  constructor) — zie `readCalendars`'s `calendarIdOffset`/`baseIdOffset`/`resourceIdOffset`. */
interface RawCalendarEntry {
  calendarUniqueId: number;
  baseCalendarUniqueId: number;
  resourceUniqueId: number;
}

export interface CalendarReadResult {
  /** Alle gematerialiseerde kalenders (basis + afgeleide), MPP-uniqueID → `WorkCalendar`. */
  calendarByUniqueId: ReadonlyMap<number, WorkCalendar>;
  /** De gekozen PROJECTkalender (DEFAULT_CALENDAR_NAME-lookup, met terugval — zie onderaan
   *  `readCalendars`). Altijd gezet; bij een lege/onleesbare TBkndCal-storage de generieke
   *  `createDefaultCalendar()`. */
  projectCalendar: WorkCalendar;
  /** Alle overige kalenders (alles behalve `projectCalendar`) — spiegelt mspdiReader's
   *  `resourceCalendars` (elk `<Calendar>`-element behalve UID 1). */
  resourceCalendars: WorkCalendar[];
  /** MPP resource-uniqueID → kalender-uniqueID (`AbstractCalendarFactory`'s `resourceMap`), voor de
   *  `Resource.calendarId`-koppeling in `readResources`. */
  resourceCalendarUniqueIdByResourceUniqueId: ReadonlyMap<number, number>;
  /** DIAGNOSTISCH, alleen voor testcode (`check-mpp-calendars.ts`): MPP-uniqueID → aantal EIGEN
   *  uitzonderingen van die kalender. Een afgeleide kalender bevat
   *  `[...baseCal.holidays, ...ownHolidays]`; simpelweg `.holidays.length` optellen telt de
   *  base-feestdagen per afgeleide kalender dubbel. */
  ownHolidayCountByUniqueId: ReadonlyMap<number, number>;
}

/** Terugval bij een ontbrekende/onleesbare TBkndCal-storage: `createDefaultCalendar()`, geen
 *  kalenders. */
function fallbackResult(): CalendarReadResult {
  return {
    calendarByUniqueId: new Map(),
    projectCalendar: createDefaultCalendar(),
    resourceCalendars: [],
    resourceCalendarUniqueIdByResourceUniqueId: new Map(),
    ownHolidayCountByUniqueId: new Map(),
  };
}

/**
 * Entry point. Poort van `AbstractCalendarFactory.processCalendarData` + `MPP14CalendarFactory`'s
 * versie-afhankelijke veldoffsets. `applicationVersion` komt uit `detectApplicationVersion`
 * (mppContainer.ts) — `null`/laag ⇒ de ≤2010-veldlayout, zoals MPXJ's
 * `NumberHelper.getInt(null) === 0`-terugval.
 *
 * `hoursPerDayOverride` is de MINUTES_PER_DAY-projecteigenschap (of `null`) en geldt UITSLUITEND
 * voor de kalender die de PROJECTkalender wordt — zoals mspdiReader, waar de override alleen in
 * `parseCalendar` zit. Omdat hij vóór promotie moet landen, wordt de projectkalender-identiteit al
 * vóór de materialisatielussen bepaald.
 *
 * Altijd-vangende wrapper rond `readCalendarsUnsafe`: een kapotte kalendersectie blokkeert de import
 * niet.
 */
export function readCalendars(
  cfb: CfbFile,
  projectProps: Props,
  applicationVersion: number | null,
  hoursPerDayOverride: number | null = null,
): CalendarReadResult {
  try {
    return readCalendarsUnsafe(cfb, projectProps, applicationVersion, hoursPerDayOverride);
  } catch {
    return fallbackResult();
  }
}

function readCalendarsUnsafe(
  cfb: CfbFile,
  projectProps: Props,
  applicationVersion: number | null,
  hoursPerDayOverride: number | null,
): CalendarReadResult {
  const label = '"   114"/TBkndCal';
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndCal', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndCal', 'FixedData']);
  const varMetaBytes = cfb.getStream(['   114', 'TBkndCal', 'VarMeta']);
  const var2DataBytes = cfb.getStream(['   114', 'TBkndCal', 'Var2Data']); // legitiem afwezig (mppPrimitives.ts)

  if (!fixedMetaBytes || !fixedDataBytes || !varMetaBytes) {
    // Geen (volledige) TBkndCal-storage: terugval op de generieke standaardkalender.
    return fallbackResult();
  }

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, CAL_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.fromMeta(fixedMeta, fixedDataBytes, CAL_FIXED_DATA_MAX_SIZE, 0, `${label}/FixedData`);
  const varMeta = new VarMeta12(varMetaBytes, `${label}/VarMeta`);
  const varData = new Var2Data(varMeta, var2DataBytes);

  // MPP14CalendarFactory.java: > ApplicationVersion.PROJECT_2010 (14) ⇒ 2013+-veldlayout.
  const useModernOffsets = (applicationVersion ?? 0) > 14;
  const calendarIdOffset = useModernOffsets ? 8 : 0;
  const baseIdOffset = useModernOffsets ? 0 : 4;
  const resourceIdOffset = useModernOffsets ? 4 : 8;

  // ── Ruwe FixedData-records → uniek per calendarUniqueId (eerste wint, spiegelt Java's
  // `!calendarMap.containsKey(calendarID)`-guard). Stopt bij `MAX_CALENDARS`. ─────────────────────
  const rawByUniqueId = new Map<number, RawCalendarEntry>();
  const itemCount = fixedData.getItemCount();
  for (let index = 0; index < itemCount && rawByUniqueId.size < MAX_CALENDARS; index++) {
    const item = fixedData.getByteArrayValue(index);
    if (!item || item.length < 12) continue; // 12 bytes = max(calendarIdOffset,baseIdOffset,resourceIdOffset)+4
    const calendarUniqueId = getInt(item, calendarIdOffset, `${label}/FixedData calendarId`);
    if (calendarUniqueId <= 0 || rawByUniqueId.has(calendarUniqueId)) continue;
    const baseCalendarUniqueId = getInt(item, baseIdOffset, `${label}/FixedData baseId`);
    const resourceUniqueId = getInt(item, resourceIdOffset, `${label}/FixedData resourceId`);
    rawByUniqueId.set(calendarUniqueId, { calendarUniqueId, baseCalendarUniqueId, resourceUniqueId });
  }
  if (rawByUniqueId.size === 0) return fallbackResult();

  const defaultCalendarHoursBytes = projectProps.getByteArray(PROPS_KEY_DEFAULT_CALENDAR_HOURS);
  const projectDefaultDays = resolveDays(defaultCalendarHoursBytes, STANDARD_DAY_HOURS_FALLBACK, `${label}/defaultCalendarHours`);

  const calendarByUniqueId = new Map<number, WorkCalendar>();
  const daysByUniqueId = new Map<number, DayResolution[]>();
  const resourceCalendarUniqueIdByResourceUniqueId = new Map<number, number>();
  const ownHolidayCountByUniqueId = new Map<number, number>();
  const baseCalendarUniqueIds = new Set<number>();
  // ÉÉN gedeeld budget over ALLE kalenders in deze aanroep (`MAX_TOTAL_HOLIDAY_SLOTS`). Elke
  // `parseExceptions`-aanroep en de base→afgeleide-overervingskopie (`mergeInherited` →
  // `resolveContributions`) decrementeren het, voor holidays én `workingException`-dagen.
  const holidayBudget = newHolidayBudget();

  // Cache per uniqueID (ook `null`): `nameOf` wordt per kalender twee keer gevraagd, en een gedeelde
  // naam-var-data-offset van 64 KiB maakt dat duur (8.000 kalenders ≈ 5,9 s zonder cache).
  const nameCache = new Map<number, string | null>();
  const nameOf = (uid: number): string | null => {
    if (nameCache.has(uid)) return nameCache.get(uid) ?? null;
    const name = varData.getUnicodeString(uid, CALENDAR_NAME_VAR_TYPE, MAX_CALENDAR_TEXT_BYTES, `${label}/name[uid=${uid}]`);
    nameCache.set(uid, name);
    return name;
  };
  // Een kalender zonder eigen naam-var-data (vooral afgeleide/resource-kalenders — MPP koppelt de naam
  // meestal aan de resource) krijgt "Kalender <uid>" i.p.v. de defaultnaam van `createDefaultCalendar()`.
  const nameOfOrFallback = (uid: number): string => nameOf(uid) ?? `Kalender ${uid}`;

  // AbstractCalendarFactory.java kent TWEE regels voor `resourceMap`: basiskalenders (r. 157-160)
  // linken alleen bij een POSITIEVE, nog niet gekoppelde resource-ID; afgeleide kalenders
  // (r. 174-176) linken ONVOORWAARDELIJK, ook bij resource-ID 0. Resource-uniqueID 0 is geldig
  // (corpus: 870d339f60603f71's afgeleide kalenders dragen 0,1,2,3,4,5,7,8,9).
  const linkBaseResource = (rec: RawCalendarEntry): void => {
    if (rec.resourceUniqueId > 0 && !resourceCalendarUniqueIdByResourceUniqueId.has(rec.resourceUniqueId)) {
      resourceCalendarUniqueIdByResourceUniqueId.set(rec.resourceUniqueId, rec.calendarUniqueId);
    }
  };
  const linkDerivedResource = (rec: RawCalendarEntry): void => {
    resourceCalendarUniqueIdByResourceUniqueId.set(rec.resourceUniqueId, rec.calendarUniqueId);
  };

  // ── Projectkalender-IDENTITEIT vooraf bepalen — DEFAULT_CALENDAR_NAME-lookup
  // (AbstractCalendarFactory.java r. 205-210), terugval op de eerste basiskalender, dan de eerste
  // kalender (Map-volgorde === FixedData-volgorde). Vóór Fase 1/2, zodat `hoursPerDayOverride`
  // tijdens de materialisatie van precies deze kalender kan worden toegepast.
  const defaultNameBytes = projectProps.getByteArray(PROPS_KEY_DEFAULT_CALENDAR_NAME);
  const defaultName = defaultNameBytes
    ? getUnicodeString(defaultNameBytes, 0, MAX_CALENDAR_TEXT_BYTES, `${label}/defaultCalendarName`)
    : null;
  let projectCalendarUid: number | null = null;
  if (defaultName) {
    for (const uid of rawByUniqueId.keys()) {
      if (nameOf(uid) === defaultName) {
        projectCalendarUid = uid;
        break;
      }
    }
  }
  if (projectCalendarUid === null) {
    for (const rec of rawByUniqueId.values()) {
      if (rec.baseCalendarUniqueId <= 0 || rec.baseCalendarUniqueId === rec.calendarUniqueId) {
        projectCalendarUid = rec.calendarUniqueId;
        break;
      }
    }
  }
  if (projectCalendarUid === null) {
    projectCalendarUid = rawByUniqueId.keys().next().value ?? null;
  }
  const overrideFor = (uid: number): number | null => (uid === projectCalendarUid ? hoursPerDayOverride : null);

  // ── Fase 1: basiskalenders (baseCalendarUniqueId<=0 of ===zichzelf, AbstractCalendarFactory.java
  // r. 136). Zonder eigen CALENDAR_DATA-var-data (in het corpus o.a. de "Standaard"-basiskalender)
  // substitueert MPXJ de projectbrede DEFAULT_CALENDAR_HOURS-prop als bron voor ZOWEL uren ALS
  // uitzonderingen (r. 138-144: `if (varData == null) varData = defaultCalendarData;`). Die
  // substitutie geldt UITSLUITEND voor basiskalenders; afgeleide kalenders vallen terug op hun
  // resolved base (Fase 2). `effectiveData` is die substitutie. ──────────────────────────────────
  for (const rec of rawByUniqueId.values()) {
    if (!(rec.baseCalendarUniqueId <= 0 || rec.baseCalendarUniqueId === rec.calendarUniqueId)) continue;
    baseCalendarUniqueIds.add(rec.calendarUniqueId);

    const ownData = varData.getByteArray(rec.calendarUniqueId, CALENDAR_DATA_VAR_TYPE);
    const effectiveData = ownData ?? defaultCalendarHoursBytes;
    const days = ownData ? resolveDays(ownData, projectDefaultDays, `${label}/hours[uid=${rec.calendarUniqueId}]`) : projectDefaultDays;
    daysByUniqueId.set(rec.calendarUniqueId, days);

    const cal = buildCalendarFromDays(nameOfOrFallback(rec.calendarUniqueId), days, overrideFor(rec.calendarUniqueId));
    // Uid in de ctx, voor diagnoseerbare grensfouten per kalender.
    const parsed: ParsedExceptions = effectiveData
      ? parseExceptions(effectiveData, `${label}/exceptions[uid=${rec.calendarUniqueId}]`, holidayBudget)
      : { holidays: [], workingExceptions: [] };
    cal.holidays = parsed.holidays;
    // `workingExceptions` blijft AFWEZIG (niet `[]`) wanneer leeg.
    if (parsed.workingExceptions.length > 0) cal.workingExceptions = parsed.workingExceptions;
    calendarByUniqueId.set(rec.calendarUniqueId, cal);
    ownHolidayCountByUniqueId.set(rec.calendarUniqueId, cal.holidays.length); // basiskalender: alles is "eigen", geen overerving
    linkBaseResource(rec);
  }

  // ── Fase 2: afgeleide (resource-)kalenders — fixed-point-resolutie tegen de base-keten (die zelf
  // weer naar een afgeleide kalender kan wijzen), met cyclus-/dieptebescherming
  // (MAX_BASE_CHAIN_DEPTH). Neemt het dagpatroon van de base over voor DEFAULT-dagen en voegt de
  // base-feestdagen samen met de eigen uitzonderingen. Alles wordt hard gematerialiseerd: er is geen
  // parent-ketenmodel zoals MPXJ's `ProjectCalendar.getParent()`. ─────────────────────────────────
  const materializeDerived = (rec: RawCalendarEntry, fallbackDays: DayResolution[], baseCal: WorkCalendar | null): void => {
    const ownData = varData.getByteArray(rec.calendarUniqueId, CALENDAR_DATA_VAR_TYPE);
    const days = resolveDays(ownData, fallbackDays, `${label}/hours[uid=${rec.calendarUniqueId}]`);
    daysByUniqueId.set(rec.calendarUniqueId, days);

    const cal = buildCalendarFromDays(nameOfOrFallback(rec.calendarUniqueId), days, overrideFor(rec.calendarUniqueId));
    const ownRaw = ownData ? readRawExceptions(ownData, `${label}/exceptions[uid=${rec.calendarUniqueId}]`) : [];
    // `buildContributions` leest `holidayBudget.remaining` als momentopname om de totale generatie
    // te begrenzen; het gedeelde budget wordt pas in `resolveContributions`/`mergeInherited`
    // gedecrementeerd, dus dit is de strakst mogelijke bovengrens.
    const ownContributions = buildContributions(ownRaw, holidayBudget);
    // Diagnostische eigen-telling op een EIGEN budget: mag niet concurreren met het gedeelde
    // `holidayBudget` (de eigen data is al begrensd door `MAX_CALENDAR_EXCEPTIONS`).
    const ownParsed = resolveContributions(ownContributions, newHolidayBudget());
    const baseParsed: ParsedExceptions = baseCal
      ? { holidays: baseCal.holidays, workingExceptions: baseCal.workingExceptions ?? [] }
      : { holidays: [], workingExceptions: [] };
    const merged = baseCal ? mergeInherited(baseParsed, ownContributions, holidayBudget) : resolveContributions(ownContributions, holidayBudget);
    cal.holidays = merged.holidays;
    if (merged.workingExceptions.length > 0) cal.workingExceptions = merged.workingExceptions;
    calendarByUniqueId.set(rec.calendarUniqueId, cal);
    ownHolidayCountByUniqueId.set(rec.calendarUniqueId, ownParsed.holidays.length); // NIET de geërfde base-holidays meetellen
    linkDerivedResource(rec);
  };

  const pending = new Map<number, RawCalendarEntry>();
  for (const rec of rawByUniqueId.values()) {
    if (!baseCalendarUniqueIds.has(rec.calendarUniqueId)) pending.set(rec.calendarUniqueId, rec);
  }
  for (let pass = 0; pass < MAX_BASE_CHAIN_DEPTH && pending.size > 0; pass++) {
    let progressed = false;
    for (const [uid, rec] of Array.from(pending)) {
      const baseDays = daysByUniqueId.get(rec.baseCalendarUniqueId);
      if (!baseDays) continue; // base nog niet opgelost (of bestaat niet) — volgende ronde proberen
      materializeDerived(rec, baseDays, calendarByUniqueId.get(rec.baseCalendarUniqueId) ?? null);
      pending.delete(uid);
      progressed = true;
    }
    if (!progressed) break; // geen vooruitgang meer: resterende entries zijn een cyclus of hebben een onbestaande base
  }
  // Restanten (cyclus/onbereikbare base/klem geraakt): materialiseer ZONDER basis-overerving i.p.v.
  // de kalender stilzwijgend te laten vallen — eigen data (indien aanwezig) op de project-brede
  // DEFAULT_CALENDAR_HOURS-fallback.
  for (const rec of pending.values()) materializeDerived(rec, projectDefaultDays, null);

  const projectCalendar = (projectCalendarUid !== null ? calendarByUniqueId.get(projectCalendarUid) : undefined)
    ?? calendarByUniqueId.values().next().value;
  if (!projectCalendar) return fallbackResult(); // defensief onbereikbaar (rawByUniqueId.size>0 hierboven al gecontroleerd)

  const resourceCalendars: WorkCalendar[] = [];
  for (const cal of calendarByUniqueId.values()) {
    if (cal !== projectCalendar) resourceCalendars.push(cal);
  }

  return {
    calendarByUniqueId,
    projectCalendar,
    resourceCalendars,
    resourceCalendarUniqueIdByResourceUniqueId,
    ownHolidayCountByUniqueId,
  };
}

/**
 * De losse promotiestap. `readTasks` (mppReader.ts) roept dit precies één keer aan, ná de volledige
 * taak-signaal-scan (zoals mspdiReader's `hourModeCalIds`-lus). `signaledCalendars` = de
 * kalender-OBJECTEN (identiteit; per parse uniek, net als de `bandRegistry`-WeakMap in `subdayIo.ts`)
 * met minstens één (c)-signaal: een sub-dag-duur (`isSubDayMinutes`) of een Start/Finish die van het
 * kalender-eigen anker afwijkt (`hasNonAnchorTime`, zie `mppAnchorClock`).
 *
 * Itereert over ALLE kalenders: een kalender zonder taak-signaal promoveert nog steeds op haar eigen
 * banden (discriminator (a)/(b), bv. een lunchpauze-kalender), zoals mspdiReader's `calById`-lus.
 * Retourneert de uur-modus-kalenders als `Set` (identiteit); `readTasks` bepaalt daarmee per taak
 * `isHour`.
 */
export function promoteCalendarsForHourMode(
  calendarByUniqueId: ReadonlyMap<number, WorkCalendar>,
  signaledCalendars: ReadonlySet<WorkCalendar>,
): Set<WorkCalendar> {
  return promoteHourCalendars(
    [...calendarByUniqueId.values()].map(cal => [cal, cal] as const), cal => signaledCalendars.has(cal), false,
  );
}
