import type { Holiday } from '@/types/calendar';
import { addCalendarDays, formatDate, isoDayOfWeek } from '@/utils/dateUtils';
import { CA_SET } from './canadianHolidays';

export const HOLIDAY_COUNTRIES = [
  'NL', 'DE', 'BE', 'FR', 'UK', 'AT', 'CH', 'US', 'CA', 'BO',
  'ES', 'IT', 'PL', 'PT', 'CZ', 'SE', 'DK', 'NO', 'FI',
] as const;
export type HolidayCountry = typeof HOLIDAY_COUNTRIES[number];

export type HolidayRule =
  | { kind: 'fixed'; month: number; day: number; days?: number;
      substitute?: 'nl-kingsday' | 'weekend-to-monday' | 'us-federal' | 'sunday-to-monday' | 'ca-boxing-day' }
  | { kind: 'easter'; offset: number; days?: number }
  | { kind: 'nth-weekday'; month: number; weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
      nth: 1 | 2 | 3 | 4 | 'last' }
  | { kind: 'weekday-before'; month: number; day: number; weekday: number }
  | { kind: 'weekday-on-after'; month: number; day: number; weekday: number };

export interface HolidayDef {
  id: string;
  name: string;
  rule: HolidayRule;
  ruleByYear?: Readonly<Partial<Record<number, HolidayRule>>>;
  onlyYear?: number;
  regions?: string[];
  optional?: boolean;
  lustrumOnly?: boolean;
  fromYear?: number;
  untilYear?: number;
  excludedYears?: readonly number[];
}

export interface HolidaySet {
  country: HolidayCountry;
  regions?: { id: string; name: string }[];
  defs: HolidayDef[];
  nationalDefs?: HolidayDef[];
}

export interface RegionalBreakTable {
  id: 'nl-bouwvak';
  byRegion: Record<'noord' | 'midden' | 'zuid', {
    byYear: Record<number, { start: string; end: string }>;
    approx: (year: number) => { start: string; end: string };
  }>;
}

const utc = (y: number, month1: number, day: number) => new Date(Date.UTC(y, month1 - 1, day));
const oneDay = (name: string, d: Date): Holiday => ({ name, startDate: formatDate(d), endDate: formatDate(d) });
const range = (name: string, start: Date, days: number): Holiday =>
  ({ name, startDate: formatDate(start), endDate: formatDate(addCalendarDays(start, Math.max(1, days) - 1)) });

export function easterSunday(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}

function nthWeekday(y: number, month1: number, weekday: number, nth: 1 | 2 | 3 | 4 | 'last'): Date {
  if (nth === 'last') {
    let d = utc(y, month1 + 1, 1);
    d = addCalendarDays(d, -1);
    while (isoDayOfWeek(d) !== weekday) d = addCalendarDays(d, -1);
    return d;
  }
  let d = utc(y, month1, 1);
  while (isoDayOfWeek(d) !== weekday) d = addCalendarDays(d, 1);
  return addCalendarDays(d, (nth - 1) * 7);
}

function weekdayBefore(y: number, month1: number, day: number, weekday: number): Date {
  let d = addCalendarDays(utc(y, month1, day), -1);
  while (isoDayOfWeek(d) !== weekday) d = addCalendarDays(d, -1);
  return d;
}

function materialize(def: HolidayDef, y: number): Holiday | null {
  const r = def.ruleByYear?.[y] ?? def.rule;
  switch (r.kind) {
    case 'fixed': {
      let d = utc(y, r.month, r.day);
      if (r.substitute === 'nl-kingsday') {
        if (isoDayOfWeek(d) === 7) d = utc(y, 4, 26);
      } else if (r.substitute === 'weekend-to-monday') {
        if (isoDayOfWeek(d) === 6) d = addCalendarDays(d, 2);
        else if (isoDayOfWeek(d) === 7) d = addCalendarDays(d, 1);
      } else if (r.substitute === 'sunday-to-monday') {
        if (isoDayOfWeek(d) === 7) d = addCalendarDays(d, 1);
      } else if (r.substitute === 'ca-boxing-day') {
        const weekday = isoDayOfWeek(d);
        if (weekday === 6 || weekday === 7) d = addCalendarDays(d, 2);
        else if (weekday === 1) d = addCalendarDays(d, 1);
      } else if (r.substitute === 'us-federal') {
        if (isoDayOfWeek(d) === 6) d = addCalendarDays(d, -1);
        else if (isoDayOfWeek(d) === 7) d = addCalendarDays(d, 1);
        if (d.getUTCFullYear() !== y) return null;
      }
      return range(def.name, d, r.days ?? 1);
    }
    case 'easter':
      return range(def.name, addCalendarDays(easterSunday(y), r.offset), r.days ?? 1);
    case 'nth-weekday':
      return oneDay(def.name, nthWeekday(y, r.month, r.weekday, r.nth));
    case 'weekday-before':
      return oneDay(def.name, weekdayBefore(y, r.month, r.day, r.weekday));
    case 'weekday-on-after': {
      let d = utc(y, r.month, r.day);
      while (isoDayOfWeek(d) !== r.weekday) d = addCalendarDays(d, 1);
      return oneDay(def.name, d);
    }
  }
}

function ukChristmasBoxing(y: number): Holiday[] {
  const cdow = isoDayOfWeek(utc(y, 12, 25));
  let xmas = utc(y, 12, 25);
  let boxing = utc(y, 12, 26);
  if (cdow === 6) { xmas = utc(y, 12, 27); boxing = utc(y, 12, 28); }
  else if (cdow === 7) { xmas = utc(y, 12, 27); boxing = utc(y, 12, 26); }
  else if (cdow === 5) { boxing = utc(y, 12, 28); }
  return [oneDay('Christmas Day', xmas), oneDay('Boxing Day', boxing)];
}

function usNewYearObservedEve(y: number): Holiday[] {
  if (isoDayOfWeek(utc(y + 1, 1, 1)) !== 6) return [];
  return [oneDay("New Year's Day", utc(y, 12, 31))];
}

export function generateHolidays(
  set: HolidaySet, region: string | undefined, fromYear: number, toYear: number,
): Holiday[] {
  const out: Holiday[] = [];
  const defs = !region && set.nationalDefs ? set.nationalDefs : set.defs;
  for (let y = fromYear; y <= toYear; y++) {
    for (const def of defs) {
      if (def.regions && def.regions.length > 0) {
        if (!region || !def.regions.includes(region)) continue;
      }
      if (def.lustrumOnly && y % 5 !== 0) continue;
      if (def.fromYear !== undefined && y < def.fromYear) continue;
      if (def.untilYear !== undefined && y > def.untilYear) continue;
      if (def.excludedYears?.includes(y)) continue;
      if (def.onlyYear !== undefined && y !== def.onlyYear) continue;
      const h = materialize(def, y);
      if (h) out.push(h);
    }
    if (set.country === 'UK') out.push(...ukChristmasBoxing(y));
    if (set.country === 'US') out.push(...usNewYearObservedEve(y));
  }
  return out;
}

export const NL_SET: HolidaySet = {
  country: 'NL',
  defs: [
    { id: 'nl-nieuwjaar', name: 'Nieuwjaar', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'nl-goede-vrijdag', name: 'Goede Vrijdag', rule: { kind: 'easter', offset: -2 }, optional: true },
    { id: 'nl-pasen', name: 'Pasen', rule: { kind: 'easter', offset: 0, days: 2 } },
    { id: 'nl-koningsdag', name: 'Koningsdag', rule: { kind: 'fixed', month: 4, day: 27, substitute: 'nl-kingsday' } },
    { id: 'nl-bevrijdingsdag', name: 'Bevrijdingsdag', rule: { kind: 'fixed', month: 5, day: 5 }, lustrumOnly: true, optional: true },
    { id: 'nl-hemelvaart', name: 'Hemelvaart', rule: { kind: 'easter', offset: 39 } },
    { id: 'nl-pinksteren', name: 'Pinksteren', rule: { kind: 'easter', offset: 49, days: 2 } },
    { id: 'nl-kerst', name: 'Kerst', rule: { kind: 'fixed', month: 12, day: 25, days: 2 } },
  ],
};

export const DE_SET: HolidaySet = {
  country: 'DE',
  regions: [
    { id: 'BW', name: 'Baden-Württemberg' }, { id: 'BY', name: 'Bayern' },
    { id: 'BE', name: 'Berlin' }, { id: 'BB', name: 'Brandenburg' },
    { id: 'HB', name: 'Bremen' }, { id: 'HH', name: 'Hamburg' },
    { id: 'HE', name: 'Hessen' }, { id: 'MV', name: 'Mecklenburg-Vorpommern' },
    { id: 'NI', name: 'Niedersachsen' }, { id: 'NW', name: 'Nordrhein-Westfalen' },
    { id: 'RP', name: 'Rheinland-Pfalz' }, { id: 'SL', name: 'Saarland' },
    { id: 'SN', name: 'Sachsen' }, { id: 'ST', name: 'Sachsen-Anhalt' },
    { id: 'SH', name: 'Schleswig-Holstein' }, { id: 'TH', name: 'Thüringen' },
  ],
  defs: [
    { id: 'de-neujahr', name: 'Neujahr', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'de-karfreitag', name: 'Karfreitag', rule: { kind: 'easter', offset: -2 } },
    { id: 'de-ostermontag', name: 'Ostermontag', rule: { kind: 'easter', offset: 1 } },
    { id: 'de-arbeit', name: 'Tag der Arbeit', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'de-himmelfahrt', name: 'Christi Himmelfahrt', rule: { kind: 'easter', offset: 39 } },
    { id: 'de-pfingstmontag', name: 'Pfingstmontag', rule: { kind: 'easter', offset: 50 } },
    { id: 'de-einheit', name: 'Tag der Deutschen Einheit', rule: { kind: 'fixed', month: 10, day: 3 } },
    { id: 'de-weihnachten', name: 'Weihnachten', rule: { kind: 'fixed', month: 12, day: 25, days: 2 } },
    { id: 'de-dreikoenige', name: 'Heilige Drei Könige', rule: { kind: 'fixed', month: 1, day: 6 }, regions: ['BW', 'BY', 'ST'] },
    { id: 'de-frauentag', name: 'Internationaler Frauentag', rule: { kind: 'fixed', month: 3, day: 8 }, regions: ['BE', 'MV'] },
    { id: 'de-fronleichnam', name: 'Fronleichnam', rule: { kind: 'easter', offset: 60 }, regions: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL', 'SN', 'TH'] },
    { id: 'de-mariae-himmelfahrt', name: 'Mariä Himmelfahrt', rule: { kind: 'fixed', month: 8, day: 15 }, regions: ['SL', 'BY'] },
    { id: 'de-weltkindertag', name: 'Weltkindertag', rule: { kind: 'fixed', month: 9, day: 20 }, regions: ['TH'] },
    { id: 'de-reformationstag', name: 'Reformationstag', rule: { kind: 'fixed', month: 10, day: 31 }, regions: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'] },
    { id: 'de-allerheiligen', name: 'Allerheiligen', rule: { kind: 'fixed', month: 11, day: 1 }, regions: ['BW', 'BY', 'NW', 'RP', 'SL'] },
    { id: 'de-buss-bettag', name: 'Buß- und Bettag', rule: { kind: 'weekday-before', month: 11, day: 23, weekday: 3 }, regions: ['SN'] },
  ],
};

export const BE_SET: HolidaySet = {
  country: 'BE',
  defs: [
    { id: 'be-nieuwjaar', name: 'Nieuwjaar', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'be-paasmaandag', name: 'Paasmaandag', rule: { kind: 'easter', offset: 1 } },
    { id: 'be-arbeid', name: 'Dag van de Arbeid', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'be-hemelvaart', name: 'Hemelvaart', rule: { kind: 'easter', offset: 39 } },
    { id: 'be-pinkstermaandag', name: 'Pinkstermaandag', rule: { kind: 'easter', offset: 50 } },
    { id: 'be-nationale', name: 'Nationale feestdag', rule: { kind: 'fixed', month: 7, day: 21 } },
    { id: 'be-olv-hemelvaart', name: 'O.L.V.-Hemelvaart', rule: { kind: 'fixed', month: 8, day: 15 } },
    { id: 'be-allerheiligen', name: 'Allerheiligen', rule: { kind: 'fixed', month: 11, day: 1 } },
    { id: 'be-wapenstilstand', name: 'Wapenstilstand', rule: { kind: 'fixed', month: 11, day: 11 } },
    { id: 'be-kerstmis', name: 'Kerstmis', rule: { kind: 'fixed', month: 12, day: 25 } },
  ],
};

export const FR_SET: HolidaySet = {
  country: 'FR',
  regions: [{ id: 'alsace-moselle', name: 'Alsace-Moselle' }],
  defs: [
    { id: 'fr-jour-an', name: "Jour de l'an", rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'fr-lundi-paques', name: 'Lundi de Pâques', rule: { kind: 'easter', offset: 1 } },
    { id: 'fr-travail', name: 'Fête du Travail', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'fr-victoire', name: 'Victoire 1945', rule: { kind: 'fixed', month: 5, day: 8 } },
    { id: 'fr-ascension', name: 'Ascension', rule: { kind: 'easter', offset: 39 } },
    { id: 'fr-lundi-pentecote', name: 'Lundi de Pentecôte', rule: { kind: 'easter', offset: 50 } },
    { id: 'fr-nationale', name: 'Fête nationale', rule: { kind: 'fixed', month: 7, day: 14 } },
    { id: 'fr-assomption', name: 'Assomption', rule: { kind: 'fixed', month: 8, day: 15 } },
    { id: 'fr-toussaint', name: 'Toussaint', rule: { kind: 'fixed', month: 11, day: 1 } },
    { id: 'fr-armistice', name: 'Armistice 1918', rule: { kind: 'fixed', month: 11, day: 11 } },
    { id: 'fr-noel', name: 'Noël', rule: { kind: 'fixed', month: 12, day: 25 } },
    { id: 'fr-vendredi-saint', name: 'Vendredi saint', rule: { kind: 'easter', offset: -2 }, regions: ['alsace-moselle'] },
    { id: 'fr-saint-etienne', name: 'Saint Étienne', rule: { kind: 'fixed', month: 12, day: 26 }, regions: ['alsace-moselle'] },
  ],
};

export const UK_SET: HolidaySet = {
  country: 'UK',
  regions: [
    { id: 'EAW', name: 'England & Wales' }, { id: 'SCT', name: 'Scotland' }, { id: 'NIR', name: 'Northern Ireland' },
  ],
  defs: [
    { id: 'uk-new-year', name: "New Year's Day", rule: { kind: 'fixed', month: 1, day: 1, substitute: 'weekend-to-monday' } },
    { id: 'uk-jan2', name: '2 January', rule: { kind: 'fixed', month: 1, day: 2, substitute: 'weekend-to-monday' }, regions: ['SCT'] },
    { id: 'uk-st-patrick', name: "St Patrick's Day", rule: { kind: 'fixed', month: 3, day: 17, substitute: 'weekend-to-monday' }, regions: ['NIR'] },
    { id: 'uk-good-friday', name: 'Good Friday', rule: { kind: 'easter', offset: -2 } },
    { id: 'uk-easter-monday', name: 'Easter Monday', rule: { kind: 'easter', offset: 1 }, regions: ['EAW', 'NIR'] },
    { id: 'uk-early-may', name: 'Early May bank holiday', rule: { kind: 'nth-weekday', month: 5, weekday: 1, nth: 1 } },
    { id: 'uk-spring', name: 'Spring bank holiday', rule: { kind: 'nth-weekday', month: 5, weekday: 1, nth: 'last' } },
    { id: 'uk-summer-eaw', name: 'Summer bank holiday', rule: { kind: 'nth-weekday', month: 8, weekday: 1, nth: 'last' }, regions: ['EAW', 'NIR'] },
    { id: 'uk-summer-sct', name: 'Summer bank holiday', rule: { kind: 'nth-weekday', month: 8, weekday: 1, nth: 1 }, regions: ['SCT'] },
    { id: 'uk-boyne', name: 'Battle of the Boyne', rule: { kind: 'fixed', month: 7, day: 12, substitute: 'weekend-to-monday' }, regions: ['NIR'] },
    { id: 'uk-st-andrew', name: "St Andrew's Day", rule: { kind: 'fixed', month: 11, day: 30, substitute: 'weekend-to-monday' }, regions: ['SCT'] },
  ],
};

export const AT_SET: HolidaySet = {
  country: 'AT',
  defs: [
    { id: 'at-neujahr', name: 'Neujahr', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'at-dreikoenige', name: 'Heilige Drei Könige', rule: { kind: 'fixed', month: 1, day: 6 } },
    { id: 'at-ostermontag', name: 'Ostermontag', rule: { kind: 'easter', offset: 1 } },
    { id: 'at-staatsfeiertag', name: 'Staatsfeiertag', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'at-himmelfahrt', name: 'Christi Himmelfahrt', rule: { kind: 'easter', offset: 39 } },
    { id: 'at-pfingstmontag', name: 'Pfingstmontag', rule: { kind: 'easter', offset: 50 } },
    { id: 'at-fronleichnam', name: 'Fronleichnam', rule: { kind: 'easter', offset: 60 } },
    { id: 'at-mariae-himmelfahrt', name: 'Mariä Himmelfahrt', rule: { kind: 'fixed', month: 8, day: 15 } },
    { id: 'at-nationalfeiertag', name: 'Nationalfeiertag', rule: { kind: 'fixed', month: 10, day: 26 } },
    { id: 'at-allerheiligen', name: 'Allerheiligen', rule: { kind: 'fixed', month: 11, day: 1 } },
    { id: 'at-mariae-empfaengnis', name: 'Mariä Empfängnis', rule: { kind: 'fixed', month: 12, day: 8 } },
    { id: 'at-christtag', name: 'Christtag', rule: { kind: 'fixed', month: 12, day: 25 } },
    { id: 'at-stefanitag', name: 'Stefanitag', rule: { kind: 'fixed', month: 12, day: 26 } },
  ],
};

export const CH_SET: HolidaySet = {
  country: 'CH',
  regions: [
    { id: 'ZH', name: 'Zürich' }, { id: 'BE', name: 'Bern' }, { id: 'LU', name: 'Luzern' },
    { id: 'GE', name: 'Genève' }, { id: 'TI', name: 'Ticino' }, { id: 'VD', name: 'Vaud' },
  ],
  defs: [
    { id: 'ch-neujahr', name: 'Neujahr', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'ch-karfreitag', name: 'Karfreitag', rule: { kind: 'easter', offset: -2 } },
    { id: 'ch-ostermontag', name: 'Ostermontag', rule: { kind: 'easter', offset: 1 } },
    { id: 'ch-auffahrt', name: 'Auffahrt', rule: { kind: 'easter', offset: 39 } },
    { id: 'ch-pfingstmontag', name: 'Pfingstmontag', rule: { kind: 'easter', offset: 50 } },
    { id: 'ch-bundesfeier', name: 'Bundesfeier', rule: { kind: 'fixed', month: 8, day: 1 } },
    { id: 'ch-weihnachten', name: 'Weihnachten', rule: { kind: 'fixed', month: 12, day: 25 } },
    { id: 'ch-stephanstag', name: 'Stephanstag', rule: { kind: 'fixed', month: 12, day: 26 } },
  ],
};

export const US_SET: HolidaySet = {
  country: 'US',
  defs: [
    { id: 'us-new-year', name: "New Year's Day", rule: { kind: 'fixed', month: 1, day: 1, substitute: 'us-federal' } },
    { id: 'us-mlk', name: 'Martin Luther King Jr. Day', rule: { kind: 'nth-weekday', month: 1, weekday: 1, nth: 3 } },
    { id: 'us-presidents', name: "Washington's Birthday (Presidents' Day)", rule: { kind: 'nth-weekday', month: 2, weekday: 1, nth: 3 } },
    { id: 'us-memorial', name: 'Memorial Day', rule: { kind: 'nth-weekday', month: 5, weekday: 1, nth: 'last' } },
    { id: 'us-juneteenth', name: 'Juneteenth', rule: { kind: 'fixed', month: 6, day: 19, substitute: 'us-federal' }, fromYear: 2021 },
    { id: 'us-independence', name: 'Independence Day', rule: { kind: 'fixed', month: 7, day: 4, substitute: 'us-federal' } },
    { id: 'us-labor', name: 'Labor Day', rule: { kind: 'nth-weekday', month: 9, weekday: 1, nth: 1 } },
    { id: 'us-columbus', name: 'Columbus Day', rule: { kind: 'nth-weekday', month: 10, weekday: 1, nth: 2 } },
    { id: 'us-veterans', name: 'Veterans Day', rule: { kind: 'fixed', month: 11, day: 11, substitute: 'us-federal' } },
    { id: 'us-thanksgiving', name: 'Thanksgiving Day', rule: { kind: 'nth-weekday', month: 11, weekday: 4, nth: 4 } },
    { id: 'us-christmas', name: 'Christmas Day', rule: { kind: 'fixed', month: 12, day: 25, substitute: 'us-federal' } },
  ],
};

const BO_SET: HolidaySet = {
  country: 'BO',
  regions: [{ id: 'L', name: 'La Paz' }, { id: 'P', name: 'Potosí' }, { id: 'S', name: 'Santa Cruz' }],
  defs: [
    { id: 'bo-new-year', name: 'Año Nuevo', rule: { kind: 'fixed', month: 1, day: 1, substitute: 'sunday-to-monday' } },
    { id: 'bo-new-year-2026', name: 'Feriado adicional de Año Nuevo', rule: { kind: 'fixed', month: 1, day: 2 }, onlyYear: 2026 },
    { id: 'bo-state', name: 'Día de la Creación del Estado Plurinacional de Bolivia',
      rule: { kind: 'fixed', month: 1, day: 22, substitute: 'sunday-to-monday' },
      ruleByYear: { 2026: { kind: 'fixed', month: 1, day: 23 } } },
    { id: 'bo-carnaval', name: 'Carnaval', rule: { kind: 'easter', offset: -48, days: 2 } },
    { id: 'bo-viernes-santo', name: 'Viernes Santo', rule: { kind: 'easter', offset: -2 } },
    { id: 'bo-trabajo', name: 'Día del Trabajo', rule: { kind: 'fixed', month: 5, day: 1, substitute: 'sunday-to-monday' } },
    { id: 'bo-corpus', name: 'Corpus Christi', rule: { kind: 'easter', offset: 60 } },
    { id: 'bo-corpus-2026', name: 'Feriado adicional de Corpus Christi', rule: { kind: 'fixed', month: 6, day: 5 }, onlyYear: 2026 },
    { id: 'bo-andino', name: 'Año Nuevo Andino Amazónico Chaqueño',
      rule: { kind: 'fixed', month: 6, day: 21, substitute: 'sunday-to-monday' } },
    { id: 'bo-independencia', name: 'Día de la Independencia de Bolivia',
      rule: { kind: 'fixed', month: 8, day: 6, substitute: 'sunday-to-monday' } },
    { id: 'bo-independencia-2026', name: 'Feriado adicional de la Independencia', rule: { kind: 'fixed', month: 8, day: 7 }, onlyYear: 2026 },
    { id: 'bo-difuntos', name: 'Día de Todos los Difuntos', rule: { kind: 'fixed', month: 11, day: 2 } },
    { id: 'bo-navidad', name: 'Navidad', rule: { kind: 'fixed', month: 12, day: 25, substitute: 'sunday-to-monday' } },
    { id: 'bo-la-paz', name: 'Gesta Libertaria de La Paz',
      rule: { kind: 'fixed', month: 7, day: 16, substitute: 'sunday-to-monday' }, regions: ['L'] },
    { id: 'bo-potosi', name: 'Gesta Libertaria de Potosí',
      rule: { kind: 'fixed', month: 11, day: 10, substitute: 'sunday-to-monday' }, regions: ['P'] },
    { id: 'bo-santa-cruz', name: 'Gesta Libertaria de Santa Cruz',
      rule: { kind: 'fixed', month: 9, day: 24, substitute: 'sunday-to-monday' }, regions: ['S'] },
    { id: 'bo-santa-cruz-2026', name: 'Feriado adicional de Santa Cruz',
      rule: { kind: 'fixed', month: 9, day: 25 }, regions: ['S'], onlyYear: 2026 },
  ],
};

export const ES_SET: HolidaySet = {
  country: 'ES',
  defs: [
    { id: 'es-ano-nuevo', name: 'Año Nuevo', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'es-epifania', name: 'Epifanía del Señor', rule: { kind: 'fixed', month: 1, day: 6 } },
    { id: 'es-viernes-santo', name: 'Viernes Santo', rule: { kind: 'easter', offset: -2 } },
    { id: 'es-fiesta-trabajo', name: 'Fiesta del Trabajo', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'es-asuncion', name: 'Asunción de la Virgen', rule: { kind: 'fixed', month: 8, day: 15 } },
    { id: 'es-fiesta-nacional', name: 'Fiesta Nacional de España', rule: { kind: 'fixed', month: 10, day: 12 } },
    { id: 'es-todos-santos', name: 'Todos los Santos', rule: { kind: 'fixed', month: 11, day: 1 } },
    { id: 'es-constitucion', name: 'Día de la Constitución', rule: { kind: 'fixed', month: 12, day: 6 } },
    { id: 'es-inmaculada', name: 'Inmaculada Concepción', rule: { kind: 'fixed', month: 12, day: 8 } },
    { id: 'es-navidad', name: 'Navidad', rule: { kind: 'fixed', month: 12, day: 25 } },
  ],
};

export const IT_SET: HolidaySet = {
  country: 'IT',
  defs: [
    { id: 'it-capodanno', name: 'Capodanno', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'it-epifania', name: 'Epifania', rule: { kind: 'fixed', month: 1, day: 6 } },
    { id: 'it-pasqua', name: 'Pasqua', rule: { kind: 'easter', offset: 0, days: 2 } },
    { id: 'it-liberazione', name: 'Festa della Liberazione', rule: { kind: 'fixed', month: 4, day: 25 } },
    { id: 'it-lavoratori', name: 'Festa dei Lavoratori', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'it-repubblica', name: 'Festa della Repubblica', rule: { kind: 'fixed', month: 6, day: 2 } },
    { id: 'it-ferragosto', name: 'Ferragosto', rule: { kind: 'fixed', month: 8, day: 15 } },
    { id: 'it-san-francesco', name: "San Francesco d'Assisi", rule: { kind: 'fixed', month: 10, day: 4 }, fromYear: 2026 },
    { id: 'it-ognissanti', name: 'Ognissanti', rule: { kind: 'fixed', month: 11, day: 1 } },
    { id: 'it-immacolata', name: 'Immacolata Concezione', rule: { kind: 'fixed', month: 12, day: 8 } },
    { id: 'it-natale', name: 'Natale', rule: { kind: 'fixed', month: 12, day: 25, days: 2 } },
  ],
};

export const PL_SET: HolidaySet = {
  country: 'PL',
  defs: [
    { id: 'pl-nowy-rok', name: 'Nowy Rok', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'pl-trzech-kroli', name: 'Trzech Króli', rule: { kind: 'fixed', month: 1, day: 6 }, fromYear: 2011 },
    { id: 'pl-wielkanoc', name: 'Wielkanoc', rule: { kind: 'easter', offset: 0, days: 2 } },
    { id: 'pl-swieto-pracy', name: 'Święto Pracy', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'pl-konstytucja-3-maja', name: 'Święto Konstytucji 3 Maja', rule: { kind: 'fixed', month: 5, day: 3 } },
    { id: 'pl-zielone-swiatki', name: 'Zielone Świątki', rule: { kind: 'easter', offset: 49 } },
    { id: 'pl-boze-cialo', name: 'Boże Ciało', rule: { kind: 'easter', offset: 60 } },
    { id: 'pl-wniebowziecie', name: 'Wniebowzięcie Najświętszej Maryi Panny', rule: { kind: 'fixed', month: 8, day: 15 } },
    { id: 'pl-wszystkich-swietych', name: 'Wszystkich Świętych', rule: { kind: 'fixed', month: 11, day: 1 } },
    { id: 'pl-niepodleglosci', name: 'Narodowe Święto Niepodległości', rule: { kind: 'fixed', month: 11, day: 11 } },
    { id: 'pl-wigilia', name: 'Wigilia Bożego Narodzenia', rule: { kind: 'fixed', month: 12, day: 24 }, fromYear: 2025 },
    { id: 'pl-boze-narodzenie', name: 'Boże Narodzenie', rule: { kind: 'fixed', month: 12, day: 25, days: 2 } },
  ],
};

const PT_SUSPENDED_HOLIDAY_YEARS = [2013, 2014, 2015] as const;

export const PT_SET: HolidaySet = {
  country: 'PT',
  defs: [
    { id: 'pt-ano-novo', name: 'Ano Novo', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'pt-sexta-feira-santa', name: 'Sexta-feira Santa', rule: { kind: 'easter', offset: -2 } },
    { id: 'pt-domingo-de-pascoa', name: 'Domingo de Páscoa', rule: { kind: 'easter', offset: 0 } },
    { id: 'pt-25-de-abril', name: 'Dia da Liberdade', rule: { kind: 'fixed', month: 4, day: 25 } },
    { id: 'pt-dia-do-trabalhador', name: 'Dia do Trabalhador', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'pt-dia-de-portugal', name: 'Dia de Portugal, de Camões e das Comunidades', rule: { kind: 'fixed', month: 6, day: 10 } },
    { id: 'pt-corpo-de-deus', name: 'Corpo de Deus', rule: { kind: 'easter', offset: 60 }, excludedYears: PT_SUSPENDED_HOLIDAY_YEARS },
    { id: 'pt-assuncao', name: 'Assunção de Nossa Senhora', rule: { kind: 'fixed', month: 8, day: 15 } },
    { id: 'pt-implantacao-republica', name: 'Implantação da República', rule: { kind: 'fixed', month: 10, day: 5 }, excludedYears: PT_SUSPENDED_HOLIDAY_YEARS },
    { id: 'pt-todos-os-santos', name: 'Todos os Santos', rule: { kind: 'fixed', month: 11, day: 1 }, excludedYears: PT_SUSPENDED_HOLIDAY_YEARS },
    { id: 'pt-restauracao-independencia', name: 'Restauração da Independência', rule: { kind: 'fixed', month: 12, day: 1 }, excludedYears: PT_SUSPENDED_HOLIDAY_YEARS },
    { id: 'pt-imaculada-conceicao', name: 'Imaculada Conceição', rule: { kind: 'fixed', month: 12, day: 8 } },
    { id: 'pt-natal', name: 'Natal', rule: { kind: 'fixed', month: 12, day: 25 } },
  ],
};

export const CZ_SET: HolidaySet = {
  country: 'CZ',
  defs: [
    { id: 'cs-den-vzniku-statu', name: 'Den vzniku samostatného českého státu', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'cs-velky-patek', name: 'Velký pátek', rule: { kind: 'easter', offset: -2 }, fromYear: 2016 },
    { id: 'cs-velikonocni-pondeli', name: 'Velikonoční pondělí', rule: { kind: 'easter', offset: 1 } },
    { id: 'cs-svatek-prace', name: 'Svátek práce', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'cs-den-vitezstvi', name: 'Den vítězství', rule: { kind: 'fixed', month: 5, day: 8 } },
    { id: 'cs-cyril-metodej', name: 'Den slovanských věrozvěstů Cyrila a Metoděje', rule: { kind: 'fixed', month: 7, day: 5 } },
    { id: 'cs-jan-hus', name: 'Den upálení mistra Jana Husa', rule: { kind: 'fixed', month: 7, day: 6 } },
    { id: 'cs-den-statnosti', name: 'Den české státnosti', rule: { kind: 'fixed', month: 9, day: 28 } },
    { id: 'cs-den-nezavislosti', name: 'Den vzniku samostatného československého státu', rule: { kind: 'fixed', month: 10, day: 28 } },
    { id: 'cs-den-svobody', name: 'Den boje za svobodu a demokracii', rule: { kind: 'fixed', month: 11, day: 17 } },
    { id: 'cs-stedry-den', name: 'Štědrý den', rule: { kind: 'fixed', month: 12, day: 24 } },
    { id: 'cs-vanocni-svatek', name: '1. a 2. svátek vánoční', rule: { kind: 'fixed', month: 12, day: 25, days: 2 } },
  ],
};

export const SE_SET: HolidaySet = {
  country: 'SE',
  defs: [
    { id: 'sv-nyarsdagen', name: 'Nyårsdagen', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'sv-trettondedag-jul', name: 'Trettondedag jul', rule: { kind: 'fixed', month: 1, day: 6 } },
    { id: 'sv-langfredag', name: 'Långfredagen', rule: { kind: 'easter', offset: -2 } },
    { id: 'sv-paskdagen', name: 'Påskdagen', rule: { kind: 'easter', offset: 0, days: 2 } },
    { id: 'sv-forsta-maj', name: 'Första maj', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'sv-kristi-himmelsfard', name: 'Kristi himmelsfärdsdag', rule: { kind: 'easter', offset: 39 } },
    { id: 'sv-pingstdagen', name: 'Pingstdagen', rule: { kind: 'easter', offset: 49 } },
    { id: 'sv-annandag-pingst', name: 'Annandag pingst', rule: { kind: 'easter', offset: 50 }, untilYear: 2004 },
    { id: 'sv-nationaldag', name: 'Sveriges nationaldag', rule: { kind: 'fixed', month: 6, day: 6 }, fromYear: 2005 },
    { id: 'sv-midsommardagen', name: 'Midsommardagen', rule: { kind: 'weekday-on-after', month: 6, day: 20, weekday: 6 } },
    { id: 'sv-alla-helgons-dag', name: 'Alla helgons dag', rule: { kind: 'weekday-on-after', month: 10, day: 31, weekday: 6 } },
    { id: 'sv-juldagen', name: 'Juledagen', rule: { kind: 'fixed', month: 12, day: 25, days: 2 } },
  ],
};

export const DK_SET: HolidaySet = {
  country: 'DK',
  defs: [
    { id: 'dk-nytaarsdag', name: 'Nytårsdag', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'dk-skaertorsdag', name: 'Skærtorsdag', rule: { kind: 'easter', offset: -3 } },
    { id: 'dk-langfredag', name: 'Langfredag', rule: { kind: 'easter', offset: -2 } },
    { id: 'dk-paaskedag', name: 'Påskedag', rule: { kind: 'easter', offset: 0, days: 2 } },
    { id: 'dk-store-bededag', name: 'Store bededag', rule: { kind: 'easter', offset: 26 }, untilYear: 2023 },
    { id: 'dk-kristi-himmelfartsdag', name: 'Kristi himmelfartsdag', rule: { kind: 'easter', offset: 39 } },
    { id: 'dk-pinsedag', name: 'Pinsedag', rule: { kind: 'easter', offset: 49 } },
    { id: 'dk-anden-pinsedag', name: '2. pinsedag', rule: { kind: 'easter', offset: 50 } },
    { id: 'dk-juledag', name: 'Juledag', rule: { kind: 'fixed', month: 12, day: 25, days: 2 } },
  ],
};

export const NO_SET: HolidaySet = {
  country: 'NO',
  defs: [
    { id: 'no-nyttaarsdag', name: 'Nyttårsdag', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'no-skjaertorsdag', name: 'Skjærtorsdag', rule: { kind: 'easter', offset: -3 } },
    { id: 'no-langfredag', name: 'Langfredag', rule: { kind: 'easter', offset: -2 } },
    { id: 'no-paskedag', name: 'Påskedag', rule: { kind: 'easter', offset: 0, days: 2 } },
    { id: 'no-arbeidernes-dag', name: 'Arbeidernes dag', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'no-grunnlovsdag', name: 'Grunnlovsdag', rule: { kind: 'fixed', month: 5, day: 17 } },
    { id: 'no-kristi-himmelfartsdag', name: 'Kristi himmelfartsdag', rule: { kind: 'easter', offset: 39 } },
    { id: 'no-pinsedag', name: 'Pinsedag', rule: { kind: 'easter', offset: 49 } },
    { id: 'no-anden-pinsedag', name: 'Andre pinsedag', rule: { kind: 'easter', offset: 50 } },
    { id: 'no-juledag', name: 'Juledag', rule: { kind: 'fixed', month: 12, day: 25, days: 2 } },
  ],
};

export const FI_SET: HolidaySet = {
  country: 'FI',
  defs: [
    { id: 'fi-uudenvuodenpaiva', name: 'Uudenvuodenpäivä', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'fi-loppiainen', name: 'Loppiainen', rule: { kind: 'fixed', month: 1, day: 6 } },
    { id: 'fi-pitkaperjantai', name: 'Pitkäperjantai', rule: { kind: 'easter', offset: -2 } },
    { id: 'fi-paasiainen', name: 'Pääsiäinen', rule: { kind: 'easter', offset: 0, days: 2 } },
    { id: 'fi-vappu', name: 'Vappu', rule: { kind: 'fixed', month: 5, day: 1 } },
    { id: 'fi-helatorstai', name: 'Helatorstai', rule: { kind: 'easter', offset: 39 } },
    { id: 'fi-helluntai', name: 'Helluntai', rule: { kind: 'easter', offset: 49 } },
    { id: 'fi-juhannuspaiva', name: 'Juhannuspäivä', rule: { kind: 'weekday-on-after', month: 6, day: 20, weekday: 6 } },
    { id: 'fi-pyhainpaiva', name: 'Pyhäinpäivä', rule: { kind: 'weekday-on-after', month: 10, day: 31, weekday: 6 } },
    { id: 'fi-itsenaisyyspaiva', name: 'Itsenäisyyspäivä', rule: { kind: 'fixed', month: 12, day: 6 } },
    { id: 'fi-joulupaiva', name: 'Joulupäivä', rule: { kind: 'fixed', month: 12, day: 25, days: 2 } },
  ],
};

export const HOLIDAY_SETS: Record<HolidayCountry, HolidaySet> = {
  NL: NL_SET, DE: DE_SET, BE: BE_SET, FR: FR_SET, UK: UK_SET, AT: AT_SET, CH: CH_SET, US: US_SET, CA: CA_SET, BO: BO_SET,
  ES: ES_SET, IT: IT_SET, PL: PL_SET, PT: PT_SET, CZ: CZ_SET, SE: SE_SET, DK: DK_SET, NO: NO_SET, FI: FI_SET,
};

function bouwvakApprox(year: number, weekOffset: number): { start: string; end: string } {
  let d = utc(year, 7, 1);
  while (isoDayOfWeek(d) !== 1) d = addCalendarDays(d, 1);
  d = addCalendarDays(d, 21 + weekOffset * 7);
  return { start: formatDate(d), end: formatDate(addCalendarDays(d, 18)) };
}

export const NL_BOUWVAK: RegionalBreakTable = {
  id: 'nl-bouwvak',
  byRegion: {
    noord: {
      byYear: {
        2025: { start: '2025-08-04', end: '2025-08-22' },
        2026: { start: '2026-07-20', end: '2026-08-07' },
        2027: { start: '2027-07-26', end: '2027-08-13' },
        2028: { start: '2028-07-31', end: '2028-08-18' },
      },
      approx: (y) => bouwvakApprox(y, 0),
    },
    midden: {
      byYear: {
        2025: { start: '2025-07-28', end: '2025-08-15' },
        2026: { start: '2026-08-03', end: '2026-08-21' },
        2027: { start: '2027-08-02', end: '2027-08-20' },
        2028: { start: '2028-07-24', end: '2028-08-11' },
      },
      approx: (y) => bouwvakApprox(y, 1),
    },
    zuid: {
      byYear: {
        2025: { start: '2025-07-21', end: '2025-08-08' },
        2026: { start: '2026-07-27', end: '2026-08-14' },
        2027: { start: '2027-08-09', end: '2027-08-27' },
        2028: { start: '2028-08-07', end: '2028-08-25' },
      },
      approx: (y) => bouwvakApprox(y, -1),
    },
  },
};

export function generateRegionalBreak(
  choice: 'noord' | 'midden' | 'zuid', fromYear: number, toYear: number,
): Holiday[] {
  const region = NL_BOUWVAK.byRegion[choice];
  if (!region) return [];
  const label = choice === 'noord' ? 'Noord' : choice === 'midden' ? 'Midden' : 'Zuid';
  const out: Holiday[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    const span = region.byYear[y] ?? region.approx(y);
    out.push({ name: `Bouwvak (${label})`, startDate: span.start, endDate: span.end });
  }
  return out;
}

