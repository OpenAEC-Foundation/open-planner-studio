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
  number: string;
  name: string;
  fields: Record<string, string>;
  children: XerStructuredRecord[];
}

export interface DecodedXerCalendarData {
  bands: WorkTimeBands;
  holidays: Holiday[];
  workingExceptions: WorkingException[];
  hasExplicitClockBands: boolean;
  deviates: boolean;
}

export type XerCalendarType = 'GLOBAL' | 'PROJECT' | 'RESOURCE' | 'UNKNOWN';

export interface XerCalendar extends WorkCalendar {
  calendarType: XerCalendarType;
  rawCalendarType: string;
  hoursPerWeek: number;
  hoursPerMonth: number;
  hoursPerYear: number;
  baseCalendarId?: string;
  baseCalendar?: XerCalendar;
  hourModeSource?: 'SHARED' | 'XER_CLOCK';
}

export interface XerCalendarReadResult {
  calendars: XerCalendar[];
  byId: Map<string, XerCalendar>;
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

function parseXerClock(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (meridiem === 'PM' ? 12 : 0);
  } else if (hour > 24 || (hour === 24 && minute !== 0)) {
    return null;
  }
  return hour * 60 + minute;
}

function bandsFromRecords(records: readonly XerStructuredRecord[]): { start: number; end: number }[] {
  const result: { start: number; end: number }[] = [];
  for (const record of records) {
    const start = parseXerClock(record.fields.s ?? '');
    const end = parseXerClock(record.fields.f ?? '');
    if (start === null || end === null) continue;
    result.push({ start, end });
  }
  return result;
}

function dateFromP6Epoch(raw: string): string | null {
  if (!/^-?\d+$/.test(raw.trim())) return null;
  const date = new Date(Date.UTC(1899, 11, 30));
  date.setUTCDate(date.getUTCDate() + Number(raw));
  return date.toISOString().slice(0, 10);
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
  const value = parseXerNumber(raw, tables.numberFormat);
  return value === null || value < 0 ? undefined : value;
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

class StructuredTextTokenizer {
  private index = 0;

  constructor(private readonly text: string) {}

  parse(): XerStructuredRecord {
    this.skipFormatting();
    const record = this.readRecord();
    this.skipFormatting();
    if (this.index !== this.text.length) {
      throw new Error('Ongeldige XER-kalenderdata: onverwachte tekst na het hoofdrecord.');
    }
    return record;
  }

  private readRecord(): XerStructuredRecord {
    this.expect('(');
    const number = this.readWhile(char => /\d/.test(char));
    if (!number) throw new Error('Ongeldige XER-kalenderdata: recordnummer ontbreekt.');
    this.expect('||');
    const name = this.readUntil('(');
    this.expect('(');
    const fields = this.readFields();
    this.expect(')');
    this.skipFormatting();
    this.expect('(');
    const children: XerStructuredRecord[] = [];
    this.skipFormatting();
    while (this.peek() === '(') {
      children.push(this.readRecord());
      this.skipFormatting();
    }
    this.expect(')');
    this.expect(')');
    return { number, name, fields, children };
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
    for (let index = 0; index + 1 < tokens.length; index += 2) {
      result[tokens[index]] = tokens[index + 1];
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

/** Decodeer de structured-text-inhoud van één `CALENDAR.clndr_data`-cel. */
export function decodeXerCalendarData(text: string): DecodedXerCalendarData {
  if (!text.trim()) {
    return {
      bands: defaultXerBands(),
      holidays: [],
      workingExceptions: [],
      hasExplicitClockBands: false,
      deviates: false,
    };
  }

  const root = parseXerStructuredText(text);
  const days = root.children.find(record => record.name === 'DaysOfWeek');
  const raw: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>> = {};
  let hasExplicitClockBands = false;
  for (const day of days?.children ?? []) {
    const p6Day = Number(day.name);
    if (!WEEKDAYS.includes(p6Day as (typeof WEEKDAYS)[number])) continue;
    const dayBands = bandsFromRecords(day.children);
    if (dayBands.length > 0) hasExplicitClockBands = true;
    raw[p6DayToIso(p6Day)] = dayBands;
  }
  const canonical = canonicalizeBands(raw);
  let bands = canonical.bands;
  if (!hasExplicitClockBands) bands = defaultXerBands();

  const holidays: Holiday[] = [];
  const workingExceptions: WorkingException[] = [];
  const exceptions = root.children.find(record => record.name === 'Exceptions');
  for (const exception of exceptions?.children ?? []) {
    const date = dateFromP6Epoch(exception.fields.d ?? '');
    if (!date) continue;
    const exceptionBands = canonicalizeBands({ 1: bandsFromRecords(exception.children) }).bands.byWeekday[1];
    if (exceptionBands.length > 0) {
      workingExceptions.push({
        name: 'Kalenderuitzondering', startDate: date, endDate: date, bands: exceptionBands,
      });
    } else {
      holidays.push({ name: 'Kalenderuitzondering', startDate: date, endDate: date });
    }
  }

  return {
    bands,
    holidays,
    workingExceptions,
    hasExplicitClockBands,
    deviates: hasExplicitClockBands && canonical.deviates,
  };
}

/** Bouw XER-kalenders uitsluitend uit X2's reeds gedecodeerde `CALENDAR`-tabel. */
export function readXerCalendars(tables: XerTables): XerCalendarReadResult {
  const rows = tables.tables.get('CALENDAR')?.rows ?? [];
  const calendars: XerCalendar[] = rows.map(row => {
    const decoded = decodeXerCalendarData(row.cells.clndr_data ?? '');
    const actual = actualWeekHours(decoded.bands);
    const explicitDay = periodHours(row, 'day_hr_cnt', tables);
    const explicitWeek = periodHours(row, 'week_hr_cnt', tables);
    const explicitMonth = periodHours(row, 'month_hr_cnt', tables);
    const explicitYear = periodHours(row, 'year_hr_cnt', tables);
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
    return calendar;
  });

  const byId = new Map(calendars.map(calendar => [calendar.id, calendar]));
  for (const calendar of calendars) {
    const base = calendar.baseCalendarId ? byId.get(calendar.baseCalendarId) : undefined;
    if (base && base !== calendar) calendar.baseCalendar = base;
  }

  return {
    calendars,
    byId,
    encoding: tables.report.encoding,
    report: tables.report,
    promotion: {
      sharedRules: calendars.filter(calendar => calendar.hourModeSource === 'SHARED').length,
      withXerClockRule: calendars.filter(calendar => calendar.workTime !== undefined).length,
    },
  };
}
