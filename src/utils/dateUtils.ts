/**
 * Parse an ISO date string to a Date object at midnight UTC.
 *
 * Het kalenderdeel wordt TEKSTUEEL uit de string gelezen en niet via `new Date(iso)`:
 * een date-only string wordt door de engine als UTC-middernacht geïnterpreteerd, en die
 * instant met LOKALE getters uitlezen levert bij elke negatieve UTC-offset (Amerika) de
 * dag ervoor op — "2026-06-01" werd dan 2026-05-31 en de hele planning schoof een dag op.
 * Tekstueel parsen maakt de uitkomst tijdzone-onafhankelijk: dezelfde datum in, dezelfde
 * datum uit, waar de machine ook staat.
 *
 * De fallback (niet-date-only invoer, bv. een volledige datetime met offset) laat `Date`
 * zelf parsen en kapt daarna met UTC-getters af, want de engine rekent overal in
 * UTC-instants (§1) — lokale getters zouden hier dezelfde dagverschuiving terugbrengen.
 * Onparsebare invoer geeft bewust de `Invalid Date` ongewijzigd terug; de guards verderop
 * (o.a. `CPMSolver`) leunen op `isNaN(getTime())` om zulke data af te vangen.
 */
export function parseDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const d = new Date(iso);
  if (isNaN(d.getTime())) return d;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Milliseconden per kalenderdag op de UTC-instant-as (de engine kent geen DST, zie `parseInstant`). */
export const MS_PER_DAY = 86_400_000;

/** UTC-middernacht van de dag waarin `d` valt. Tijdzone-onafhankelijk; een Invalid Date blijft invalid. */
export function utcDayStart(d: Date): Date {
  return new Date(utcDayIndex(d.getTime()) * MS_PER_DAY);
}

/** Dagnummer op de UTC-as (dagen sinds 1970-01-01) van een instant in milliseconden. */
export function utcDayIndex(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

/** Twee cijfers zonder `padStart` — deze helper draait per dag per taak per toewijzing. */
const pad2 = (n: number) => (n < 10 ? '0' + n : String(n));

/**
 * Format a Date as ISO date string (YYYY-MM-DD).
 *
 * PRESTATIE. Hier stond `d.toISOString().split('T')[0]`, wat per aanroep een string van 24 tekens
 * én een array van twee strings alloceert om er één van 10 tekens uit te houden. Dat is duur op de
 * plek waar deze functie werkelijk draait: de werkdagen-enumeraties in de solver en de
 * resourcebelasting roepen hem per DAG per taak aan. Gemeten op een project van 5.000 taken met
 * 5.000 toewijzingen: `runCPM` 677 → 604 ms, `recomputeResourceLoad` 126 → 90 ms, `assignResource`
 * 133 → 106 ms, `writeIFC` 212 → 201 ms.
 *
 * BYTE-IDENTIEK, ook aan de randen. Voor jaren 0…9999 geeft `toISOString` een viercijferig jaartal
 * met UTC-velden — precies wat de snelle tak opbouwt. Daarbuiten (negatieve of uitgebreide jaren,
 * waar `toISOString` `-000001-…` respectievelijk `+275760-…` schrijft) valt hij terug op het
 * origineel, en een Invalid Date valt daar óók in en gooit dus dezelfde `RangeError` als voorheen —
 * `getUTCFullYear()` is dan NaN, en `NaN >= 0` is onwaar. `check-date-format.ts` toetst dat tegen de
 * oude implementatie als orakel, over ruim tienduizend datums plus de randgevallen.
 */
export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  if (y >= 0 && y <= 9999) {
    return `${String(y).padStart(4, '0')}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  return d.toISOString().split('T')[0];
}

/**
 * "Vandaag" als datum zonder tijd (`YYYY-MM-DD`): de KALENDERDAG van de gebruiker, dus met de lokale
 * getters en niet `formatDate(new Date())` (dat leest de UTC-dag en geeft in Nederland tussen 00:00
 * en 02:00 nog gisteren). Precies wat het statusdatumveld in het lint oplevert als de gebruiker daar
 * de datum van vandaag intypt: dezelfde vorm, geen tijd. Gebruikt waar de app zelf de statusdatum op
 * vandaag zet (voortgang zonder statusdatum, `engine/progressEntry.ts`). `now` alleen voor tests.
 */
export function localTodayIso(now: Date = new Date()): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * "Nu" als instant op de UTC-dag-as van de Gantt (de as rekent in UTC-middernachten, §1): de
 * LOKALE wandkloktijd van de gebruiker, genoteerd als UTC-velden. `new Date()` zelf is het echte
 * UTC-moment en landt daardoor in Nederland tussen 00:00 en 02:00 nog in de kolom van gisteren (en
 * in de VS 's avonds al in die van morgen). Voor de vandaag-lijn in scherm en print. `now` alleen
 * voor tests.
 */
export function localNowOnDayAxis(now: Date = new Date()): Date {
  const d = new Date(0);
  d.setUTCFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  d.setUTCHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return d;
}

/**
 * Serialisatie-modus van een datum-instant (fase 2.8b, §2.4). De MODUS is de enige
 * discriminator voor de output-vorm — niet de waarde van de instant.
 */
export type DateMode = 'day' | 'hour';

/**
 * Parse een ISO-string naar een Date die de TIJD-VAN-DE-DAG behoudt (fase 2.8b, §2.4).
 * Tegenhanger van `parseInstant` t.o.v. `parseDate`: `parseDate` kapt altijd naar
 * middernacht (dag-substraat, ongewijzigd); `parseInstant` houdt uren/minuten vast.
 *
 * - Date-only ("YYYY-MM-DD") ⇒ delegeer aan `parseDate` (byte-identiek dag-substraat,
 *   middernacht UTC).
 * - Datetime ("...THH:mm") zonder tijdzone ⇒ interpreteer als UTC (de engine rekent in
 *   UTC-instants zonder DST, §1); een expliciete Z/offset wordt gerespecteerd.
 */
export function parseInstant(iso: string): Date {
  if (iso.includes('T')) {
    const hasTz = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
    return new Date(hasTz ? iso : `${iso}Z`);
  }
  return parseDate(iso);
}

/**
 * Formatteer een instant volgens de MODUS (fase 2.8b, §2.4). De modus is de ENIGE
 * discriminator; er is geen middernacht-uitzondering:
 * - `'day'`  ⇒ altijd `YYYY-MM-DD` via het bestaande `formatDate` (byte-identiek).
 * - `'hour'` ⇒ altijd `YYYY-MM-DDTHH:mm` (minuut-precisie), óók op een rond uur en óók
 *   om middernacht (een uur-taak die op `T00:00` landt behoudt zijn tijd-component).
 */
export function formatInstant(d: Date, mode: DateMode): string {
  return mode === 'hour' ? d.toISOString().slice(0, 16) : formatDate(d);
}

/** Get the ISO day of week (1=Monday, 7=Sunday) */
export function isoDayOfWeek(d: Date): number {
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

/** Get the difference in calendar days between two dates */
export function diffCalendarDays(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

/** Add calendar days to a date */
export function addCalendarDays(d: Date, days: number): Date {
  const result = new Date(d.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Get the Monday of the week containing the given date */
export function getWeekStart(d: Date): Date {
  const result = new Date(d.getTime());
  const day = isoDayOfWeek(result);
  result.setUTCDate(result.getUTCDate() - (day - 1));
  return result;
}

/** Get the Sunday of the week containing the given date (used when weekStartDay='sunday') */
export function getWeekStartSunday(d: Date): Date {
  const result = new Date(d.getTime());
  const dow = result.getUTCDay(); // 0=Sun..6=Sat
  result.setUTCDate(result.getUTCDate() - dow);
  return result;
}

/** Get the start of the week respecting the week-start-day preference */
export function getWeekStartFor(d: Date, startDay: 'monday' | 'sunday'): Date {
  return startDay === 'sunday' ? getWeekStartSunday(d) : getWeekStart(d);
}

/** Get the first day of the month */
export function getMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Kalendermaanden optellen met klem op de maandlengte: 31 jan + 1 maand = 28/29 feb, niet 3 mrt.
 * Zo blijft "een maand vanaf de statusdatum" altijd één kalendermaand en lekt de rapportageperiode
 * (issue #120) nooit een paar dagen de volgende maand in. UTC-velden, net als de rest van dit bestand.
 */
export function addCalendarMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const lastDayOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDayOfTarget)));
}

/**
 * Bestaat deze dag in de (proleptische) Gregoriaanse kalender? Puur rekenkundig, dus onafhankelijk
 * van hoe de JS-engine datums parseert: V8 rolt `2026-02-31` stil door naar 3 maart, WebKit weigert.
 * Het jaarbereik bepaalt de aanroeper.
 */
export function isExistingYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:Z|[+-](\d{2})(:?)(\d{2}))?)?$/;

/**
 * Strikte ISO-datum of -datumtijd `YYYY-MM-DD[THH:mm[:ss[.f]]][Z|±HH:mm]`: een bestaande dag
 * ({@link isExistingYmd}), uren 00–23, minuten en seconden 00–59 en een offset tot ±14:00. Hoeveel
 * fractiecijfers en of de offset zonder dubbele punt mag, volgt het invoerformaat van de aanroeper.
 */
export function isStrictIsoDateTime(
  value: string,
  format: { maxFractionDigits: number; offsetColonOptional?: boolean },
): boolean {
  const m = ISO_DATE_TIME.exec(value);
  if (!m || !isExistingYmd(Number(m[1]), Number(m[2]), Number(m[3]))) return false;
  if (m[4] === undefined) return true;
  if (Number(m[4]) > 23 || Number(m[5]) > 59 || (m[6] !== undefined && Number(m[6]) > 59)) return false;
  if (m[7] !== undefined && m[7].length > format.maxFractionDigits) return false;
  if (m[8] !== undefined) {
    if (m[9] === '' && !format.offsetColonOptional) return false;
    const offsetHour = Number(m[8]);
    const offsetMinute = Number(m[10]);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return true;
}

/** Difference in calendar days between two ISO date strings */
export function diffDays(a: string, b: string): number {
  return diffCalendarDays(parseDate(a), parseDate(b));
}

/** Get week number (ISO 8601) */
export function getWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((target.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

/**
 * Add work days to a date counting only weekends as non-working (Mon–Fri),
 * with the start day counting as day 1. Mirrors CalendarEngine.addWorkDays but
 * without holiday awareness — used for placeholder/default finish dates before
 * CPM runs. The real, calendar-aware schedule is computed by runCPM (F5).
 */
export function addBusinessDays(start: Date, workDays: number): Date {
  // Guard tegen een ongeldige datum (bv. uit een corrupte import): isoDayOfWeek(Invalid)=NaN,
  // NaN<=5 is altijd false → `remaining` daalt nooit → oneindige lus. Geef de (ongeldige) datum
  // gewoon terug; de CPM-solver vangt de ongeldige startdatum verderop netjes af.
  if (workDays <= 0 || isNaN(start.getTime())) return new Date(start.getTime());
  let current = new Date(start.getTime());
  // Ensure we start on a weekday (met scan-grens tegen vastlopen)
  let scan = 0;
  while (isoDayOfWeek(current) > 5) {
    current = addCalendarDays(current, 1);
    if (++scan > 366) break;
  }
  let remaining = workDays - 1; // the start day counts as day 1
  let steps = 0;
  while (remaining > 0) {
    current = addCalendarDays(current, 1);
    if (isoDayOfWeek(current) <= 5) remaining--;
    if (++steps > 200_000) break;
  }
  return current;
}

/** Get week number with configurable week start. ISO 8601 when 'monday', US-style when 'sunday'. */
export function getWeekNumberFor(d: Date, startDay: 'monday' | 'sunday' = 'monday'): number {
  if (startDay === 'monday') return getWeekNumber(d);
  // US-style: week 1 contains Jan 1; weeks start Sunday.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const jan1 = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((target.getTime() - jan1.getTime()) / 86400000);
  return Math.floor((dayOfYear + jan1.getUTCDay()) / 7) + 1;
}
