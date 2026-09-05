/**
 * Decoder voor Primavera XER-kalenderdata, zelfstandig hergeïmplementeerd.
 *
 * Voor begrip van de structured-text-recordvorm en P6-kalendersemantiek is MPXJ geraadpleegd:
 * https://github.com/joniles/mpxj (`StructuredTextParser` en `TableContextReader`, LGPL-2.1,
 * Jon Iles e.a.). Er is geen MPXJ-code overgenomen; tokenizer, typen en mapping hieronder zijn eigen.
 */

import {
  canonicalizeBands,
  promoteHourCalendar,
  registerCalendarBands,
} from '@/services/subdayIo';
import type { Holiday, WorkingException, WorkCalendar, WorkTimeBands } from '@/types/calendar';
import {
  parseXerNumber,
  type XerEncoding,
  type XerImportReport,
  type XerRow,
  type XerTables,
} from './xerTables';

export interface XerStructuredRecord {
  role: XerStructuredRecordRole;
  number: string;
  name: string;
  fields: Record<string, string>;
  children: XerStructuredRecord[];
}

export type XerStructuredRecordRole =
  | 'ROOT'
  | 'CONTAINER'
  | 'DAY'
  | 'EXCEPTION'
  | 'BAND'
  | 'RECORD';

export interface DecodedXerCalendarData {
  bands: WorkTimeBands;
  holidays: Holiday[];
  workingExceptions: WorkingException[];
  p6NonWorkPenaltyDates: string[];
  hasExplicitClockBands: boolean;
  deviates: boolean;
  recoveries: XerCalendarRecovery[];
}

export type XerCalendarRecovery =
  | 'COMPACT_RECORD'
  | 'SURPLUS_CLOSE'
  | 'MULTIPLE_EXCEPTIONS'
  | 'DUPLICATE_EXCEPTION';

export type XerCalendarIssueCode =
  | 'XER_CALENDAR_COMPACT_RECORD_RECOVERED'
  | 'XER_CALENDAR_SURPLUS_CLOSE_RECOVERED'
  | 'XER_CALENDAR_INVALID_STRUCTURE'
  | 'XER_CALENDAR_INVALID_COMPACT_CONTEXT'
  | 'XER_CALENDAR_ODD_FIELD_COUNT'
  | 'XER_CALENDAR_INVALID_FIELD_PAIR'
  | 'XER_CALENDAR_DUPLICATE_FIELD'
  | 'XER_CALENDAR_INVALID_DAY'
  | 'XER_CALENDAR_DUPLICATE_DAY'
  | 'XER_CALENDAR_INVALID_CLOCK'
  | 'XER_CALENDAR_NONZERO_SECONDS'
  | 'XER_CALENDAR_OVERLAPPING_BANDS'
  | 'XER_CALENDAR_INVALID_EPOCH'
  | 'XER_CALENDAR_INVALID_PERIOD_HOURS'
  | 'XER_CALENDAR_MULTIPLE_EXCEPTIONS_MERGED'
  | 'XER_CALENDAR_DUPLICATE_EXCEPTION'
  | 'XER_CALENDAR_DANGLING_BASE'
  | 'XER_CALENDAR_SELF_BASE'
  | 'XER_CALENDAR_BASE_CYCLE';

export interface XerCalendarIssue {
  code: XerCalendarIssueCode;
  calendarId: string;
  line: number;
  reason: string;
  resolution: 'RECOVERED' | 'REJECTED' | 'UNLINKED';
}

export type XerCalendarType = 'GLOBAL' | 'PROJECT' | 'RESOURCE' | 'UNKNOWN';

export interface XerCalendar extends WorkCalendar {
  calendarType: XerCalendarType;
  rawCalendarType: string;
  hoursPerWeek: number;
  hoursPerMonth: number;
  hoursPerYear: number;
  /** Serialiseerbare bron van waarheid voor de optionele basiskalender. */
  baseCalendarId?: string;
  /**
   * Afgeleide gemakskoppeling binnen een leesresultaat. `readXerCalendars` installeert deze
   * bewust niet-enumerable: overdracht en persistentie gebruiken uitsluitend `baseCalendarId`.
   */
  baseCalendar?: XerCalendar;
  hourModeSource?: 'SHARED' | 'XER_CLOCK';
}

export interface XerCalendarReadResult {
  calendars: XerCalendar[];
  byId: Map<string, XerCalendar>;
  issues: XerCalendarIssue[];
  encoding: XerEncoding;
  report: XerImportReport;
  promotion: {
    sharedRules: number;
    withXerClockRule: number;
  };
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

function defaultXerBands(): WorkTimeBands {
  return canonicalizeBands({
    1: [{ start: 480, end: 960 }],
    2: [{ start: 480, end: 960 }],
    3: [{ start: 480, end: 960 }],
    4: [{ start: 480, end: 960 }],
    5: [{ start: 480, end: 960 }],
  }).bands;
}

function p6DayToIso(day: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return (day === 1 ? 7 : day - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

class XerCalendarDataError extends Error {
  constructor(readonly code: XerCalendarIssueCode, message: string) {
    super(message);
    this.name = 'XerCalendarDataError';
  }
}

function parseXerClock(value: string, position: 'start' | 'finish'): number {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) {
    throw new XerCalendarDataError(
      'XER_CALENDAR_INVALID_CLOCK',
      'Een aanwezige kalenderband bevat geen geldige klokwaarde.',
    );
  }
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  const meridiem = match[4]?.toUpperCase();
  if (second !== 0) {
    throw new XerCalendarDataError(
      'XER_CALENDAR_NONZERO_SECONDS',
      'Niet-nul seconden worden niet stil naar hele minuten afgerond.',
    );
  }
  if (minute > 59) {
    throw new XerCalendarDataError(
      'XER_CALENDAR_INVALID_CLOCK',
      'Een aanwezige kalenderband bevat geen geldige klokwaarde.',
    );
  }
  if (meridiem) {
    if (hour < 1 || hour > 12) {
      throw new XerCalendarDataError(
        'XER_CALENDAR_INVALID_CLOCK',
        'Een aanwezige kalenderband bevat geen geldige klokwaarde.',
      );
    }
    hour = hour % 12 + (meridiem === 'PM' ? 12 : 0);
  } else if (hour > 24 || (hour === 24 && (minute !== 0 || position === 'start'))) {
    throw new XerCalendarDataError(
      'XER_CALENDAR_INVALID_CLOCK',
      'Een aanwezige kalenderband bevat geen geldige klokwaarde.',
    );
  }
  return hour * 60 + minute;
}

function bandsFromRecords(records: readonly XerStructuredRecord[]): { start: number; end: number }[] {
  const result: { start: number; end: number }[] = [];
  for (const record of records) {
    const start = parseXerClock(record.fields.s ?? '', 'start');
    const end = parseXerClock(record.fields.f ?? '', 'finish');
    result.push({ start, end });
  }
  return result;
}

function assertNoBandOverlap(bands: WorkTimeBands): void {
  for (const day of WEEKDAYS) {
    const dayBands = bands.byWeekday[day];
    for (let index = 1; index < dayBands.length; index++) {
      if (dayBands[index - 1].end <= dayBands[index].start) continue;
      throw new XerCalendarDataError(
        'XER_CALENDAR_OVERLAPPING_BANDS',
        'Overlappende kalenderbanden worden niet stil doorgegeven.',
      );
    }
  }
}

function dateFromP6Epoch(raw: string): string {
  if (!/^-?\d+$/.test(raw.trim())) {
    throw new XerCalendarDataError(
      'XER_CALENDAR_INVALID_EPOCH',
      'Een aanwezige kalenderuitzondering bevat geen geldige P6-epochdag.',
    );
  }
  const days = Number(raw);
  if (!Number.isSafeInteger(days)) {
    throw new XerCalendarDataError(
      'XER_CALENDAR_INVALID_EPOCH',
      'Een aanwezige kalenderuitzondering bevat geen geldige P6-epochdag.',
    );
  }
  const date = new Date(Date.UTC(1899, 11, 30));
  date.setUTCDate(date.getUTCDate() + days);
  if (!Number.isFinite(date.getTime())) {
    throw new XerCalendarDataError(
      'XER_CALENDAR_INVALID_EPOCH',
      'Een aanwezige kalenderuitzondering bevat geen geldige P6-epochdag.',
    );
  }
  return date.toISOString().slice(0, 10);
}

/** ISO-weekdag (1=ma … 7=zo) van een `YYYY-MM-DD`-datum. */
function isoWeekdayOf(date: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** `date` verschoven met `offset` kalenderdagen, weer als `YYYY-MM-DD`. */
function shiftIsoDate(date: string, offset: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
}

/**
 * WEEKEND-KLEMHERSTEL (etappe 7b-1) — welke ECHTE vrije dag zit er achter een redundant
 * vrije-uitzonderingsrecord, en wanneer mag je dat concluderen?
 *
 * HET VERSCHIJNSEL (corpus `crawl-xer-extra/jailaff-xer-splitter/rehab-2.xer`, kalenderdata gedeeld
 * door 44 kalenders met `842` `R111 - 1` en 75 met `896` `B25 - Cal`: ma-do + za + zo werkend,
 * vrijdag vrij). De negen feestdagenblokken zijn aaneengesloten vrije reeksen, maar de opgeslagen
 * epochdagen missen elke zaterdag en zondag en herhalen in plaats daarvan de aangrenzende vrijdag of
 * maandag. Blok 2008-09-29 … 2008-10-09 staat er letterlijk als `39720 39721 39722 39723 39724
 * 39724 39727 39727 39728 39729 39730` — 10-04 (za) en 10-05 (zo) ontbreken, terwijl 10-03 (vr) en
 * 10-06 (ma) er twee keer staan. De schrijver heeft de blokdagen op de MA-VR-as geklemd:
 * **zaterdag → de vrijdag ervóór, zondag → de maandag erná.**
 *
 * DE BRONTOETS. P6's eigen opgeslagen datums bevestigen dat. Meetdefinitie: tel over de 6.548 taken
 * die op deze kalenderdata staan alle vier de datumassen (ES, EF, LS én LF), waarbij "IN het blok"
 * de kalenderdagen van de GERECONSTRUEERDE blokspanne zijn en "de rand" de drie kalenderdagen direct
 * vóór de eerste blokdag plus de drie direct ná de laatste. Uitkomst:
 *
 *   blok (gereconstrueerde spanne)   IN   RAND (unieke taken)
 *   2008-09-29 … 2008-10-09           0   167 (153)
 *   2008-12-07 … 2008-12-18           0   214 (193)
 *   2009-09-18 … 2009-09-24           0   178 (157)
 *   2009-11-26 … 2009-12-05           0   252 (204)
 *   de vijf blokken buiten de projectperiode
 *                                     0     0 (niet-informatief, en nul effect op de fidelity)
 *
 * Nul datums ín de blokken tegen 811 eromheen: de weekenddagen ín die blokken zijn dus aantoonbaar
 * niet-werkend. (De 14 EF's die op 2008-12-14 te vinden zijn horen bij kalender `893` `R111 - 2`,
 * een 7-daagse kalender zonder uitzonderingen — die wordt hier niet geraakt.)
 *
 * Tweede, onafhankelijke bevestiging: P6's eigen ES→EF-vensters. Op de OUDE kalender overspande
 * `V3109400` (7 dagen duur) 10,00 werkdagen en `V3109300` (21 dagen) 24,00 — intern inconsistent.
 * Op de gereconstrueerde kalender tellen ze exact 7,00 en 21,00.
 *
 * n=1. Deze regel is afgeleid uit één bestand van 93. MPXJ, de referentie-implementatie, kent het
 * verschijnsel niet en leest de `Exceptions`-lijst letterlijk
 * (`TableContextReader.processCalendarExceptions`). De poort hieronder is daarom bewust
 * record-lokaal en conservatief; een tweede bestand moet de regel bevestigen of ontkrachten, niet
 * er stil op meeliften. Zie dossier 7b-4 in `docs/superpowers/plans/2026-08-20-plan-xer-p6-lezer.md`.
 *
 * DE POORT IS PER RECORD, NIET PER KALENDER. Een klemherstel mag alleen volgen uit bewijs op het
 * record zelf, anders maakt één toevallig dubbel record ergens in de lijst stilzwijgend verre
 * weekenddagen vrij. Er zijn precies twee lokale bewijsvormen, en beide eisen dat het blok aan de
 * andere kant van het weekend doorloopt:
 *
 *  1. **Sprong** — het record staat op een vrijdag en er is óók een uitzondering op de maandag
 *     erná (of andersom). Het blok loopt dan over het weekend heen terwijl za/zo niet opgeslagen
 *     zijn: precies de klemvorm. Dit dekt ook de twee blokken waarvan de openings-vrijdag géén
 *     duplicaat draagt (2006-12-29 en 2009-09-18).
 *  2. **Duplicaat mét blokvervolg** — het record is een aangrenzend duplicaat (twee opeenvolgende
 *     records met dezelfde epochdag, iets wat in het hele corpus van 93 bestanden alleen in dit
 *     bestand voorkomt) én het blok loopt aan de binnenzijde door (de dag vóór een vrijdag, of de
 *     dag ná een maandag, draagt zelf ook een uitzondering). Dit dekt de blokranden waar het
 *     weekend buiten de opgeslagen reeks valt (2008-12-07 vóór het blok, 2009-12-05 erná).
 *
 * Een op zichzelf staand dubbel record — de gewone P6-invoerfout waar deze decoder al een
 * `DUPLICATE_EXCEPTION`-herstel voor kent — draagt géén blokvervolg en levert dus niets op. Zie de
 * negatieve fixtures in `tests/planning/check-xer-calendar-data.ts` sectie 22.
 *
 * Daarnaast eist `weekendClampTarget` dat het klemdoel (a) daadwerkelijk een zaterdag of zondag is,
 * (b) op déze kalender een WERKdag is — anders verandert vrij maken niets — en (c) niet zelf al een
 * uitzonderingsrecord heeft.
 */
function weekendClampTarget(
  date: string, bands: WorkTimeBands, exceptionDates: ReadonlySet<string>,
): string | null {
  const weekday = isoWeekdayOf(date);
  // Vrijdag draagt de geklemde zaterdag; maandag draagt de geklemde zondag.
  const target = weekday === 5 ? shiftIsoDate(date, 1)
    : weekday === 1 ? shiftIsoDate(date, -1)
      : null;
  if (target === null) return null;
  const targetWeekday = isoWeekdayOf(target);
  if (targetWeekday !== 6 && targetWeekday !== 7) return null;
  if (bands.byWeekday[targetWeekday].length === 0) return null;
  if (exceptionDates.has(target)) return null;
  return target;
}

/**
 * Hoeveel LOSSE uitzonderingsdatums telt de aaneengesloten reeks rond `date`? Een gat van hoogstens
 * drie kalenderdagen breekt de reeks niet — dat gat is nu juist het geklemde weekend. Maximaal
 * `LIMIT` stappen per richting, zodat een kalender met honderden losse feestdagen deze telling niet
 * tot een volledige scan maakt; het antwoord wordt alleen tegen een ondergrens van 3 getoetst.
 */
function exceptionRunLength(date: string, exceptionDates: ReadonlySet<string>): number {
  const LIMIT = 8;
  let total = 1;
  for (const direction of [-1, 1]) {
    let current = date;
    for (let step = 0; step < LIMIT; step++) {
      const next = [1, 2, 3]
        .map(gap => shiftIsoDate(current, direction * gap))
        .find(candidate => exceptionDates.has(candidate));
      if (next === undefined) break;
      total++;
      current = next;
    }
  }
  return total;
}

/**
 * Draagt DIT record zelf het bewijs van een geklemde weekenddag? Zie `weekendClampTarget`.
 *
 * Drie eisen, alle drie lokaal op het record en zijn directe omgeving:
 *
 *  1. **Meerdaags blok.** Een geklemd weekend zit per definitie ín een meerdaags vrij blok; de reeks
 *     rond dit record telt minstens drie losse uitzonderingsdatums. Zonder deze eis maakt een
 *     tweedaags feestdagblokje met een per ongeluk verdubbeld vrijdagrecord al een zaterdag vrij
 *     (fixture 22g), en twee losse feestdagen die toevallig drie dagen uit elkaar liggen ook
 *     (fixture 22f). In `rehab-2.xer` tellen alle negen blokken 5 tot 11 datums.
 *  2. **Blokvervolg aan de van-het-weekend-AFGEKEERDE zijde** — de dag vóór een vrijdag, of de dag
 *     ná een maandag, draagt zelf ook een uitzondering. Bij de sprongvorm volstaat het dat één van
 *     de twee sprongpartners dat doet: blok 2006-12-29 … 2007-01-13 opent met een vrijdag zonder
 *     voorganger maar zijn maandagpartner 2007-01-01 heeft 01-02 naast zich, en blok
 *     2009-09-18 … 09-24 idem via maandag 09-21.
 *  3. **Een van de twee bewijsvormen**: de sprong over het weekend (vrijdag ↔ maandag, drie
 *     kalenderdagen uit elkaar), of een aangrenzend duplicaat op het record zelf.
 */
function hasWeekendClampEvidence(
  date: string, exceptionDates: ReadonlySet<string>, adjacentDuplicates: ReadonlySet<string>,
): boolean {
  const weekday = isoWeekdayOf(date);
  if (weekday !== 1 && weekday !== 5) return false;
  if (exceptionRunLength(date, exceptionDates) < 3) return false;
  const continuesAwayFromWeekend = (candidate: string): boolean =>
    exceptionDates.has(shiftIsoDate(candidate, isoWeekdayOf(candidate) === 5 ? -1 : 1));
  // Bewijsvorm 1 — de sprong over het weekend, mits het blok aan minstens één afgekeerde zijde doorloopt.
  const partner = shiftIsoDate(date, weekday === 5 ? 3 : -3);
  if (exceptionDates.has(partner)
    && (continuesAwayFromWeekend(date) || continuesAwayFromWeekend(partner))) return true;
  // Bewijsvorm 2 — aangrenzend duplicaat, mits het blok aan de eigen afgekeerde zijde doorloopt.
  return adjacentDuplicates.has(date) && continuesAwayFromWeekend(date);
}

function calendarType(raw: string): XerCalendarType {
  switch (raw.trim().toLowerCase()) {
    case 'ca_base': return 'GLOBAL';
    case 'ca_project': return 'PROJECT';
    case 'ca_rsrc': return 'RESOURCE';
    default: return 'UNKNOWN';
  }
}

function periodHours(row: XerRow, field: string, tables: XerTables): number | undefined {
  const raw = row.cells[field]?.trim() ?? '';
  if (!raw) return undefined;
  try {
    const value = parseXerNumber(raw, tables.numberFormat);
    if (value !== null && value >= 0) return value;
  } catch {
    // De kalenderlaag vertaalt getalfouten naar één rijgebonden semantisch issue.
  }
  throw new XerCalendarDataError(
    'XER_CALENDAR_INVALID_PERIOD_HOURS',
    'Aanwezige uren-per-periode zijn ongeldig en worden niet stil afgeleid.',
  );
}

function actualWeekHours(bands: WorkTimeBands): { week: number; workingDays: number } {
  let minutes = 0;
  let workingDays = 0;
  for (const day of WEEKDAYS) {
    const dayBands = bands.byWeekday[day];
    if (dayBands.length === 0) continue;
    workingDays++;
    minutes += dayBands.reduce((sum, band) => sum + band.end - band.start, 0);
  }
  return { week: minutes / 60, workingDays };
}

function scalarBounds(bands: WorkTimeBands): { start: number; end: number } {
  for (const day of WEEKDAYS) {
    const dayBands = bands.byWeekday[day];
    if (dayBands.length === 0) continue;
    return {
      start: Math.floor(dayBands[0].start / 60),
      end: Math.floor((dayBands[dayBands.length - 1].end % 1440) / 60),
    };
  }
  return { start: 8, end: 16 };
}

type XerStructuredParseContext =
  | 'ROOT'
  | 'ROOT_CHILD'
  | 'DAY'
  | 'EXCEPTION'
  | 'BAND'
  | 'GENERIC';

class StructuredTextTokenizer {
  private index = 0;
  usedCompactRecord = false;

  constructor(
    private readonly text: string,
    private readonly allowCompactRecords = false,
  ) {}

  parse(): XerStructuredRecord {
    this.skipFormatting();
    const record = this.readRecord('ROOT');
    this.skipFormatting();
    if (this.index !== this.text.length) {
      throw new Error('Ongeldige XER-kalenderdata: onverwachte tekst na het hoofdrecord.');
    }
    return record;
  }

  private readRecord(context: XerStructuredParseContext): XerStructuredRecord {
    this.expect('(');
    if (this.allowCompactRecords && this.text.startsWith('s|', this.index)) {
      if (context !== 'BAND') this.invalidCompactContext();
      this.usedCompactRecord = true;
      this.expect('s|');
      const start = this.readUntil('|');
      this.expect('|f|');
      const finish = this.readUntil(')');
      this.expect(')');
      return { role: 'BAND', number: '', name: '', fields: { s: start, f: finish }, children: [] };
    }
    const number = this.readWhile(char => /\d/.test(char));
    if (!number) throw new Error('Ongeldige XER-kalenderdata: recordnummer ontbreekt.');
    this.expect('||');
    if (this.allowCompactRecords && this.text.startsWith('d|', this.index)) {
      if (context !== 'EXCEPTION') this.invalidCompactContext();
      this.usedCompactRecord = true;
      this.expect('d|');
      const epoch = this.readUntil('(');
      this.expect('(');
      const children: XerStructuredRecord[] = [];
      this.skipFormatting();
      while (this.peek() === '(') {
        children.push(this.readRecord('BAND'));
        this.skipFormatting();
      }
      this.expect(')');
      this.expect(')');
      return { role: 'EXCEPTION', number, name: '', fields: { d: epoch }, children };
    }
    const name = this.readUntil('(');
    this.expect('(');
    const fields = this.readFields();
    this.expect(')');
    this.skipFormatting();
    this.expect('(');
    const children: XerStructuredRecord[] = [];
    const childContext: XerStructuredParseContext = context === 'ROOT'
      ? 'ROOT_CHILD'
      : context === 'ROOT_CHILD' && name === 'DaysOfWeek'
        ? 'DAY'
        : context === 'ROOT_CHILD' && name === 'Exceptions'
          ? 'EXCEPTION'
          : context === 'DAY' || context === 'EXCEPTION'
            ? 'BAND'
            : 'GENERIC';
    this.skipFormatting();
    while (this.peek() === '(') {
      children.push(this.readRecord(childContext));
      this.skipFormatting();
    }
    this.expect(')');
    this.expect(')');
    if (this.allowCompactRecords && context === 'EXCEPTION'
      && !Object.prototype.hasOwnProperty.call(fields, 'd')) {
      this.invalidCompactContext();
    }
    const role: XerStructuredRecordRole = context === 'ROOT'
      ? 'ROOT'
      : context === 'ROOT_CHILD' && (name === 'DaysOfWeek' || name === 'Exceptions')
        ? 'CONTAINER'
        : context === 'DAY' || context === 'EXCEPTION' || context === 'BAND'
          ? context
          : 'RECORD';
    return { role, number, name, fields, children };
  }

  private invalidCompactContext(): never {
    throw new XerCalendarDataError(
      'XER_CALENDAR_INVALID_COMPACT_CONTEXT',
      'Een compact kalenderrecord staat niet op zijn toegestane grammaticale positie.',
    );
  }

  private readFields(): Record<string, string> {
    const result: Record<string, string> = {};
    if (this.peek() === ')') return result;
    const tokens: string[] = [];
    while (true) {
      tokens.push(this.readUntil('|', ')'));
      if (this.peek() === ')') break;
      this.expect('|');
    }
    if (tokens.length % 2 !== 0) {
      throw new XerCalendarDataError(
        'XER_CALENDAR_ODD_FIELD_COUNT',
        'Een kalenderrecord bevat geen volledige key/value-paren.',
      );
    }
    for (let index = 0; index + 1 < tokens.length; index += 2) {
      const field = tokens[index];
      if (!field) {
        throw new XerCalendarDataError(
          'XER_CALENDAR_INVALID_FIELD_PAIR',
          'Een kalenderrecord bevat een key/value-paar zonder sleutel.',
        );
      }
      if (Object.prototype.hasOwnProperty.call(result, field)) {
        throw new XerCalendarDataError(
          'XER_CALENDAR_DUPLICATE_FIELD',
          'Een kalenderrecord bevat dezelfde veldsleutel meer dan eenmaal.',
        );
      }
      result[field] = tokens[index + 1];
    }
    return result;
  }

  private readUntil(...stops: string[]): string {
    const start = this.index;
    while (this.index < this.text.length && !stops.includes(this.text[this.index])) this.index++;
    if (this.index >= this.text.length) {
      throw new Error('Ongeldige XER-kalenderdata: onverwacht einde van structured text.');
    }
    return this.text.slice(start, this.index).trim();
  }

  private readWhile(predicate: (char: string) => boolean): string {
    const start = this.index;
    while (this.index < this.text.length && predicate(this.text[this.index])) this.index++;
    return this.text.slice(start, this.index);
  }

  private skipFormatting(): void {
    while (this.index < this.text.length) {
      const code = this.text.charCodeAt(this.index);
      if (!/\s/.test(this.text[this.index]) && code > 31 && code !== 127) break;
      this.index++;
    }
  }

  private peek(): string {
    return this.text[this.index] ?? '';
  }

  private expect(token: string): void {
    if (!this.text.startsWith(token, this.index)) {
      throw new Error(`Ongeldige XER-kalenderdata: ${JSON.stringify(token)} verwacht.`);
    }
    this.index += token.length;
  }
}

/** Tokenize en parse één Primavera structured-text-hoofdrecord. */
export function parseXerStructuredText(text: string): XerStructuredRecord {
  return new StructuredTextTokenizer(text).parse();
}

function parseCalendarDataWithRecovery(text: string): {
  root: XerStructuredRecord;
  recoveries: XerCalendarRecovery[];
} {
  try {
    return { root: parseXerStructuredText(text), recoveries: [] };
  } catch (strictError) {
    if (strictError instanceof XerCalendarDataError) throw strictError;
    const compact = new StructuredTextTokenizer(text, true);
    try {
      const root = compact.parse();
      if (compact.usedCompactRecord) return { root, recoveries: ['COMPACT_RECORD'] };
    } catch (compactError) {
      if (compactError instanceof XerCalendarDataError) throw compactError;
      // De compacte herstelroute is exact begrensd; de oorspronkelijke fout blijft leidend.
    }
    const surplusCloseMatches = Array.from(text.matchAll(/\)(\s*)(?=\(0\|\|Exceptions\()/g));
    if (surplusCloseMatches.length === 1) {
      const matchIndex = surplusCloseMatches[0].index;
      const recovered = `${text.slice(0, matchIndex)}${text.slice(matchIndex + 1)}`;
      try {
        return { root: parseXerStructuredText(recovered), recoveries: ['SURPLUS_CLOSE'] };
      } catch {
        // Alleen exact één surplus-haak die daarna volledig strikt parseert, wordt hersteld.
      }
    }
    throw new XerCalendarDataError(
      'XER_CALENDAR_INVALID_STRUCTURE',
      strictError instanceof Error ? strictError.message : 'Ongeldige XER-kalenderdata.',
    );
  }
}

/** Decodeer de structured-text-inhoud van één `CALENDAR.clndr_data`-cel. */
export function decodeXerCalendarData(text: string): DecodedXerCalendarData {
  if (!text.trim()) {
    return {
      bands: defaultXerBands(),
      holidays: [],
      workingExceptions: [],
      p6NonWorkPenaltyDates: [],
      hasExplicitClockBands: false,
      deviates: false,
      recoveries: [],
    };
  }

  const { root, recoveries } = parseCalendarDataWithRecovery(text);
  const dayContainers = root.children.filter(record => record.name === 'DaysOfWeek');
  if (dayContainers.length !== 1) {
    throw new XerCalendarDataError(
      'XER_CALENDAR_INVALID_STRUCTURE',
      'Aanwezige kalenderdata mist precies één DaysOfWeek-record.',
    );
  }
  const days = dayContainers[0];
  const raw: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  let hasExplicitClockBands = false;
  const seenDays = new Set<number>();
  for (const day of days.children) {
    if (!/^\d+$/.test(day.name)) {
      throw new XerCalendarDataError(
        'XER_CALENDAR_INVALID_DAY',
        'Een aanwezige weekdag is geen P6-dagnummer van 1 tot en met 7.',
      );
    }
    const p6Day = Number(day.name);
    if (!WEEKDAYS.includes(p6Day as (typeof WEEKDAYS)[number])) {
      throw new XerCalendarDataError(
        'XER_CALENDAR_INVALID_DAY',
        'Een aanwezige weekdag is geen P6-dagnummer van 1 tot en met 7.',
      );
    }
    if (seenDays.has(p6Day)) {
      throw new XerCalendarDataError(
        'XER_CALENDAR_DUPLICATE_DAY',
        'Een P6-weekdag komt meer dan eenmaal voor in dezelfde kalender.',
      );
    }
    seenDays.add(p6Day);
    const dayBands = bandsFromRecords(day.children);
    if (dayBands.length > 0) hasExplicitClockBands = true;
    raw[p6DayToIso(p6Day)] = dayBands;
  }
  const canonical = canonicalizeBands(raw);
  const bands = canonical.bands;
  assertNoBandOverlap(bands);

  const holidaysByDate = new Map<string, Holiday>();
  const workingByDate = new Map<string, WorkingException>();
  const p6NonWorkPenaltyDates = new Set<string>();
  const exceptionDates = new Set<string>();
  const adjacentDuplicateDates = new Set<string>();
  let duplicateException = false;
  let previousNonWorkDate: string | undefined;
  const exceptionContainers = root.children.filter(record => record.name === 'Exceptions');
  if (exceptionContainers.length > 1) recoveries.push('MULTIPLE_EXCEPTIONS');
  for (const exception of exceptionContainers.flatMap(container => container.children)) {
    const date = dateFromP6Epoch(exception.fields.d ?? '');
    exceptionDates.add(date);
    const canonicalException = canonicalizeBands({ 1: bandsFromRecords(exception.children) }).bands;
    assertNoBandOverlap(canonicalException);
    const exceptionBands = canonicalException.byWeekday[1];
    const nonWork = exceptionBands.length === 0;
    if (nonWork) {
      const day = new Date(`${date}T00:00:00Z`).getUTCDay();
      const isoDay = (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      // P6 6.x/7.x rekent twee redundante recordvormen als één extra niet-werkdag: een vrije
      // uitzondering op een weekdag die al geen banden draagt, en een DIRECT aangrenzende vrije
      // herhaling. Een later opnieuw voorkomende datum telt niet: rehab-2 bevat zo'n herhaald
      // overlappend exceptionblok en P6 telt uitsluitend de aangrenzende duplicaten daarin.
      if (bands.byWeekday[isoDay].length === 0 || previousNonWorkDate === date) {
        p6NonWorkPenaltyDates.add(date);
      }
      if (previousNonWorkDate === date) adjacentDuplicateDates.add(date);
      previousNonWorkDate = date;
    } else {
      previousNonWorkDate = undefined;
    }
    if (holidaysByDate.has(date) || workingByDate.has(date)) duplicateException = true;
    if (exceptionBands.length > 0) {
      holidaysByDate.delete(date);
      if (!workingByDate.has(date)) {
        workingByDate.set(date, {
          name: 'Kalenderuitzondering', startDate: date, endDate: date, bands: exceptionBands,
        });
      }
    } else if (!workingByDate.has(date) && !holidaysByDate.has(date)) {
      holidaysByDate.set(date, { name: 'Kalenderuitzondering', startDate: date, endDate: date });
    }
  }
  // Een werkende uitzondering wint ook voor de brongebonden P6-straf. De datum draagt dan echte
  // banden en is geen redundante vrije-dagrecord meer.
  for (const date of workingByDate.keys()) p6NonWorkPenaltyDates.delete(date);
  // Weekend-klemherstel (7b-1), poort per RECORD. Zie `weekendClampTarget`/`hasWeekendClampEvidence`
  // voor de twee lokale bewijsvormen en de brontoets. Zonder bewijs op het record zelf gebeurt er
  // niets, dus 92 van de 93 corpusbestanden zijn hier byte-identiek.
  for (const date of [...p6NonWorkPenaltyDates]) {
    if (!hasWeekendClampEvidence(date, exceptionDates, adjacentDuplicateDates)) continue;
    const target = weekendClampTarget(date, bands, exceptionDates);
    if (target === null) continue;
    holidaysByDate.set(target, {
      name: 'Kalenderuitzondering (weekendherstel)', startDate: target, endDate: target,
    });
    // De dag is nu ECHT vrij; hem daarnaast nog als virtuele extra niet-werkdag laten meetellen zou
    // dezelfde afwezigheid twee keer verrekenen in elke duur- en floatwandeling.
    p6NonWorkPenaltyDates.delete(date);
  }
  if (duplicateException) recoveries.push('DUPLICATE_EXCEPTION');

  return {
    bands,
    holidays: Array.from(holidaysByDate.values()),
    workingExceptions: Array.from(workingByDate.values()),
    p6NonWorkPenaltyDates: Array.from(p6NonWorkPenaltyDates).sort(),
    hasExplicitClockBands,
    deviates: hasExplicitClockBands && canonical.deviates,
    recoveries,
  };
}

function cyclicCalendarIds(
  calendars: readonly XerCalendar[],
  byId: ReadonlyMap<string, XerCalendar>,
): Set<string> {
  const state = new Map<string, 'VISITING' | 'DONE'>();
  const cycles = new Set<string>();
  for (const start of calendars) {
    if (state.get(start.id) === 'DONE') continue;
    const path: XerCalendar[] = [];
    const pathIndex = new Map<string, number>();
    let current: XerCalendar | undefined = start;
    while (current) {
      const currentState = state.get(current.id);
      if (currentState === 'DONE') break;
      if (currentState === 'VISITING') {
        const cycleStart = pathIndex.get(current.id);
        if (cycleStart !== undefined) {
          for (let index = cycleStart; index < path.length; index++) {
            cycles.add(path[index].id);
          }
        }
        break;
      }
      state.set(current.id, 'VISITING');
      pathIndex.set(current.id, path.length);
      path.push(current);
      const baseId: string | undefined = current.baseCalendarId;
      current = baseId && baseId !== current.id ? byId.get(baseId) : undefined;
    }
    for (const calendar of path) state.set(calendar.id, 'DONE');
  }
  return cycles;
}

function linkBaseCalendar(calendar: XerCalendar, base: XerCalendar): void {
  Object.defineProperty(calendar, 'baseCalendar', {
    configurable: true,
    enumerable: false,
    value: base,
    writable: true,
  });
}

/** Bouw XER-kalenders uitsluitend uit X2's reeds gedecodeerde `CALENDAR`-tabel. */
export function readXerCalendars(tables: XerTables): XerCalendarReadResult {
  const rows = tables.tables.get('CALENDAR')?.rows ?? [];
  const calendars: XerCalendar[] = [];
  const lineByCalendarId = new Map<string, number>();
  const issues: XerCalendarIssue[] = [];
  for (const row of rows) {
    const calendarId = row.cells.clndr_id.trim();
    let decoded: DecodedXerCalendarData;
    try {
      decoded = decodeXerCalendarData(row.cells.clndr_data ?? '');
    } catch (error) {
      if (!(error instanceof XerCalendarDataError)) throw error;
      issues.push({
        code: error.code,
        calendarId,
        line: row.line,
        reason: error.message,
        resolution: 'REJECTED',
      });
      continue;
    }
    const actual = actualWeekHours(decoded.bands);
    let explicitDay: number | undefined;
    let explicitWeek: number | undefined;
    let explicitMonth: number | undefined;
    let explicitYear: number | undefined;
    try {
      explicitDay = periodHours(row, 'day_hr_cnt', tables);
      explicitWeek = periodHours(row, 'week_hr_cnt', tables);
      explicitMonth = periodHours(row, 'month_hr_cnt', tables);
      explicitYear = periodHours(row, 'year_hr_cnt', tables);
    } catch (error) {
      if (!(error instanceof XerCalendarDataError)) throw error;
      issues.push({
        code: error.code,
        calendarId,
        line: row.line,
        reason: error.message,
        resolution: 'REJECTED',
      });
      continue;
    }
    const hoursPerWeek = explicitWeek ?? actual.week;
    const hoursPerDay = explicitDay
      ?? (actual.workingDays > 0 ? actual.week / actual.workingDays : 8);
    const hoursPerMonth = explicitMonth ?? hoursPerWeek * 4;
    const hoursPerYear = explicitYear ?? hoursPerMonth * 12;
    const bounds = scalarBounds(decoded.bands);
    const workDays = WEEKDAYS.filter(day => decoded.bands.byWeekday[day].length > 0);
    const baseCalendarId = row.cells.base_clndr_id?.trim() || undefined;
    const rawCalendarType = row.cells.clndr_type?.trim() ?? '';
    const calendar: XerCalendar = {
      id: row.cells.clndr_id.trim(),
      name: row.cells.clndr_name?.trim() || 'Kalender',
      description: '',
      workDays: [...workDays],
      workStartHour: bounds.start,
      workEndHour: bounds.end,
      hoursPerDay,
      holidays: decoded.holidays,
      ...(decoded.workingExceptions.length > 0
        ? { workingExceptions: decoded.workingExceptions }
        : {}),
      ...(explicitDay === undefined && decoded.p6NonWorkPenaltyDates.length > 0
        ? {
          p6Source: 'XER' as const,
          p6NonWorkPenaltyDates: decoded.p6NonWorkPenaltyDates,
          p6NonWorkPenaltyDatesState: 'VALID_VALUES' as const,
        }
        : {}),
      calendarType: calendarType(rawCalendarType),
      rawCalendarType,
      hoursPerWeek,
      hoursPerMonth,
      hoursPerYear,
      ...(baseCalendarId ? { baseCalendarId } : {}),
    };
    const bandInfo = { canonical: decoded.bands, deviates: decoded.deviates };
    registerCalendarBands(calendar, bandInfo);
    const hourModeSource = decoded.deviates
      ? 'SHARED'
      : decoded.hasExplicitClockBands
        ? 'XER_CLOCK'
        : undefined;
    if (hourModeSource && promoteHourCalendar(calendar, bandInfo, true, false)) {
      calendar.hourModeSource = hourModeSource;
      // Periodevelden in XER zijn leidend; promotie mag alleen de uurweergave toevoegen.
      calendar.hoursPerDay = hoursPerDay;
    }
    calendars.push(calendar);
    lineByCalendarId.set(calendarId, row.line);
    if (decoded.recoveries.includes('COMPACT_RECORD')) {
      issues.push({
        code: 'XER_CALENDAR_COMPACT_RECORD_RECOVERED',
        calendarId,
        line: row.line,
        reason: 'De exact ondersteunde compacte band- en exceptionrecords zijn hersteld.',
        resolution: 'RECOVERED',
      });
    }
    if (decoded.recoveries.includes('SURPLUS_CLOSE')) {
      issues.push({
        code: 'XER_CALENDAR_SURPLUS_CLOSE_RECOVERED',
        calendarId,
        line: row.line,
        reason: 'Precies één surplus-sluithaak vóór het Exceptions-record is verwijderd.',
        resolution: 'RECOVERED',
      });
    }
    if (decoded.recoveries.includes('DUPLICATE_EXCEPTION')) {
      issues.push({
        code: 'XER_CALENDAR_DUPLICATE_EXCEPTION',
        calendarId,
        line: row.line,
        reason: 'Een werkende uitzondering wint van een vrije dag; binnen dezelfde klasse blijft de eerste staan.',
        resolution: 'RECOVERED',
      });
    }
    if (decoded.recoveries.includes('MULTIPLE_EXCEPTIONS')) {
      issues.push({
        code: 'XER_CALENDAR_MULTIPLE_EXCEPTIONS_MERGED',
        calendarId,
        line: row.line,
        reason: 'Meerdere Exceptions-containers zijn deterministisch in bronvolgorde samengevoegd.',
        resolution: 'RECOVERED',
      });
    }
  }

  const byId = new Map(calendars.map(calendar => [calendar.id, calendar]));
  const cycleIds = cyclicCalendarIds(calendars, byId);
  for (const calendar of calendars) {
    const baseId = calendar.baseCalendarId;
    if (!baseId) continue;
    const line = lineByCalendarId.get(calendar.id) ?? 0;
    if (baseId === calendar.id) {
      issues.push({
        code: 'XER_CALENDAR_SELF_BASE',
        calendarId: calendar.id,
        line,
        reason: 'Een kalender kan zichzelf niet als basiskalender koppelen.',
        resolution: 'UNLINKED',
      });
      continue;
    }
    const base = byId.get(baseId);
    if (!base) {
      issues.push({
        code: 'XER_CALENDAR_DANGLING_BASE',
        calendarId: calendar.id,
        line,
        reason: 'De opgegeven basiskalender ontbreekt in het gelezen kalenderresultaat.',
        resolution: 'UNLINKED',
      });
      continue;
    }
    if (cycleIds.has(calendar.id)) {
      issues.push({
        code: 'XER_CALENDAR_BASE_CYCLE',
        calendarId: calendar.id,
        line,
        reason: 'De basiskalenderverwijzing maakt deel uit van een cyclus en blijft ongekoppeld.',
        resolution: 'UNLINKED',
      });
      continue;
    }
    linkBaseCalendar(calendar, base);
  }

  return {
    calendars,
    byId,
    issues,
    encoding: tables.report.encoding,
    report: tables.report,
    promotion: {
      sharedRules: calendars.filter(calendar => calendar.hourModeSource === 'SHARED').length,
      withXerClockRule: calendars.filter(calendar => calendar.workTime !== undefined).length,
    },
  };
}
