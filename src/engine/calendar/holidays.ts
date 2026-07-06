// Regelgebaseerde, jaar-onafhankelijke feestdagen-engine (fase 2.8a, ontwerp §3).
//
// Bron van waarheid voor gegenereerde kalenders: `generateHolidays` materialiseert een
// `HolidaySet` naar concrete `Holiday[]`-exception-ranges (dezelfde vorm die CalendarEngine/IFC
// al lezen — géén wijziging aan het datamodel of de round-trip nodig). De solver/renderer/IFC
// lezen alleen `holidays`; deze module is puur en side-effect-vrij (keep-Rust-thin, web-safe).
//
// `easterSunday` (Meeus/Jones/Butcher) verhuisde hierheen uit `scripts/gen-core.ts`; die importeert
// hem nu vandaan zodat app én voorbeeld-generator één bron delen.
import type { Holiday } from '@/types/calendar';

export type HolidayCountry = 'NL' | 'DE' | 'BE' | 'FR' | 'UK' | 'AT' | 'CH';

export type HolidayRule =
  | { kind: 'fixed'; month: number; day: number; days?: number;
      substitute?: 'nl-kingsday' | 'uk-monday' }
  | { kind: 'easter'; offset: number; days?: number }
  | { kind: 'nth-weekday'; month: number; weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
      nth: 1 | 2 | 3 | 4 | 'last' }
  | { kind: 'weekday-before'; month: number; day: number; weekday: number };

export interface HolidayDef {
  id: string;
  name: string;
  rule: HolidayRule;
  /** Leeg/undefined = landelijk; anders alleen genereren voor deze regio-id's. */
  regions?: string[];
  /** In de UI als opt-in te markeren (dag is niet overal/altijd vrij). */
  optional?: boolean;
  /** Alleen genereren in lustrumjaren (jaar % 5 === 0) — NL Bevrijdingsdag. */
  lustrumOnly?: boolean;
}

export interface HolidaySet {
  country: HolidayCountry;
  regions?: { id: string; name: string }[];
  defs: HolidayDef[];
}

/** Aparte DATA-tabel (geen algoritme) voor advies-vakantieperiodes (NL-bouwvak). */
export interface RegionalBreakTable {
  id: 'nl-bouwvak';
  byRegion: Record<'noord' | 'midden' | 'zuid', {
    byYear: Record<number, { start: string; end: string }>;
    approx: (year: number) => { start: string; end: string };
  }>;
}

// ── Datum-helpers (UTC, jaar-onafhankelijk) ──────────────────────────────────────────────────
const utc = (y: number, month1: number, day: number) => new Date(Date.UTC(y, month1 - 1, day));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
/** ISO-weekdag 1=ma … 7=zo. */
const dow = (d: Date): number => ((d.getUTCDay() + 6) % 7) + 1;
const oneDay = (name: string, d: Date): Holiday => ({ name, startDate: iso(d), endDate: iso(d) });
const range = (name: string, start: Date, days: number): Holiday =>
  ({ name, startDate: iso(start), endDate: iso(addDays(start, Math.max(1, days) - 1)) });

/** Paaszondag (Meeus/Jones/Butcher, Gregoriaans). Verhuisd uit scripts/gen-core.ts. */
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

/** De n-de (of laatste) `weekday` in een maand. */
function nthWeekday(y: number, month1: number, weekday: number, nth: 1 | 2 | 3 | 4 | 'last'): Date {
  if (nth === 'last') {
    // laatste dag van de maand terug naar de gevraagde weekdag
    let d = utc(y, month1 + 1, 1);
    d = addDays(d, -1);
    while (dow(d) !== weekday) d = addDays(d, -1);
    return d;
  }
  let d = utc(y, month1, 1);
  while (dow(d) !== weekday) d = addDays(d, 1);
  return addDays(d, (nth - 1) * 7);
}

/** De laatste `weekday` strikt vóór `month/day` (Buß- und Bettag: woensdag vóór 23 nov). */
function weekdayBefore(y: number, month1: number, day: number, weekday: number): Date {
  let d = addDays(utc(y, month1, day), -1);
  while (dow(d) !== weekday) d = addDays(d, -1);
  return d;
}

/** Materialiseer één regel naar (meestal) één Holiday voor een jaar. */
function materialize(def: HolidayDef, y: number): Holiday | null {
  const r = def.rule;
  switch (r.kind) {
    case 'fixed': {
      let d = utc(y, r.month, r.day);
      if (r.substitute === 'nl-kingsday') {
        // Koningsdag 27/4; op zondag → 26/4.
        if (dow(d) === 7) d = utc(y, 4, 26);
      } else if (r.substitute === 'uk-monday') {
        // Weekend → eerstvolgende maandag (New Year / Christmas Day, single-day).
        if (dow(d) === 6) d = addDays(d, 2);
        else if (dow(d) === 7) d = addDays(d, 1);
      }
      return range(def.name, d, r.days ?? 1);
    }
    case 'easter':
      return range(def.name, addDays(easterSunday(y), r.offset), r.days ?? 1);
    case 'nth-weekday':
      return oneDay(def.name, nthWeekday(y, r.month, r.weekday, r.nth));
    case 'weekday-before':
      return oneDay(def.name, weekdayBefore(y, r.month, r.day, r.weekday));
  }
}

/**
 * UK Christmas Day + Boxing Day met de gekoppelde substitutie (Boxing schuift naar dinsdag als
 * Kerst al de maandag pakte). Apart van de generieke `uk-monday` omdat de twee dagen elkaar
 * beïnvloeden. Landelijk (alle UK-regio's).
 */
function ukChristmasBoxing(y: number): Holiday[] {
  const cdow = dow(utc(y, 12, 25));
  let xmas = utc(y, 12, 25);
  let boxing = utc(y, 12, 26);
  if (cdow === 6) { xmas = utc(y, 12, 27); boxing = utc(y, 12, 28); }        // za/zo → ma/di
  else if (cdow === 7) { xmas = utc(y, 12, 27); boxing = utc(y, 12, 26); }   // zo/ma → di 27 / ma 26
  else if (cdow === 5) { boxing = utc(y, 12, 28); }                          // vr/za → boxing ma 28
  return [oneDay('Christmas Day', xmas), oneDay('Boxing Day', boxing)];
}

/** Expandeer een set naar concrete Holiday[] voor [fromYear..toYear] (inclusief). */
export function generateHolidays(
  set: HolidaySet, region: string | undefined, fromYear: number, toYear: number,
): Holiday[] {
  const out: Holiday[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (const def of set.defs) {
      if (def.regions && def.regions.length > 0) {
        if (!region || !def.regions.includes(region)) continue;
      }
      if (def.lustrumOnly && y % 5 !== 0) continue;
      const h = materialize(def, y);
      if (h) out.push(h);
    }
    if (set.country === 'UK') out.push(...ukChristmasBoxing(y));
  }
  return out;
}

// ── Landensets (regels, geen datums) — ontwerp §3.2 ──────────────────────────────────────────

export const NL_SET: HolidaySet = {
  country: 'NL',
  defs: [
    { id: 'nl-nieuwjaar', name: 'Nieuwjaar', rule: { kind: 'fixed', month: 1, day: 1 } },
    { id: 'nl-goede-vrijdag', name: 'Goede Vrijdag', rule: { kind: 'easter', offset: -2 }, optional: true },
    { id: 'nl-pasen', name: 'Pasen', rule: { kind: 'easter', offset: 0, days: 2 } },
    { id: 'nl-koningsdag', name: 'Koningsdag', rule: { kind: 'fixed', month: 4, day: 27, substitute: 'nl-kingsday' } },
    // Bevrijdingsdag: alleen in lustrumjaren algemeen erkend vrij; overige jaren opt-in in de UI.
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
    // Regionaal:
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
    // Alsace-Moselle:
    { id: 'fr-vendredi-saint', name: 'Vendredi saint', rule: { kind: 'easter', offset: -2 }, regions: ['alsace-moselle'] },
    { id: 'fr-saint-etienne', name: 'Saint Étienne', rule: { kind: 'fixed', month: 12, day: 26 }, regions: ['alsace-moselle'] },
  ],
};

export const UK_SET: HolidaySet = {
  // Christmas + Boxing Day worden landelijk toegevoegd door generateHolidays (gekoppelde substitutie).
  country: 'UK',
  regions: [
    { id: 'EAW', name: 'England & Wales' }, { id: 'SCT', name: 'Scotland' }, { id: 'NIR', name: 'Northern Ireland' },
  ],
  defs: [
    { id: 'uk-new-year', name: "New Year's Day", rule: { kind: 'fixed', month: 1, day: 1, substitute: 'uk-monday' } },
    { id: 'uk-jan2', name: '2 January', rule: { kind: 'fixed', month: 1, day: 2, substitute: 'uk-monday' }, regions: ['SCT'] },
    { id: 'uk-st-patrick', name: "St Patrick's Day", rule: { kind: 'fixed', month: 3, day: 17, substitute: 'uk-monday' }, regions: ['NIR'] },
    { id: 'uk-good-friday', name: 'Good Friday', rule: { kind: 'easter', offset: -2 } },
    { id: 'uk-easter-monday', name: 'Easter Monday', rule: { kind: 'easter', offset: 1 }, regions: ['EAW', 'NIR'] },
    { id: 'uk-early-may', name: 'Early May bank holiday', rule: { kind: 'nth-weekday', month: 5, weekday: 1, nth: 1 } },
    { id: 'uk-spring', name: 'Spring bank holiday', rule: { kind: 'nth-weekday', month: 5, weekday: 1, nth: 'last' } },
    { id: 'uk-summer-eaw', name: 'Summer bank holiday', rule: { kind: 'nth-weekday', month: 8, weekday: 1, nth: 'last' }, regions: ['EAW', 'NIR'] },
    { id: 'uk-summer-sct', name: 'Summer bank holiday', rule: { kind: 'nth-weekday', month: 8, weekday: 1, nth: 1 }, regions: ['SCT'] },
    { id: 'uk-boyne', name: 'Battle of the Boyne', rule: { kind: 'fixed', month: 7, day: 12, substitute: 'uk-monday' }, regions: ['NIR'] },
    { id: 'uk-st-andrew', name: "St Andrew's Day", rule: { kind: 'fixed', month: 11, day: 30, substitute: 'uk-monday' }, regions: ['SCT'] },
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
  // "Algemeen gangbare" federale/brede set; de 26 kantons variëren sterk (kanton-parameter, disclaimer).
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

/** Alle landensets, geïndexeerd op land-code (voor de wizard/dialoog). */
export const HOLIDAY_SETS: Record<HolidayCountry, HolidaySet> = {
  NL: NL_SET, DE: DE_SET, BE: BE_SET, FR: FR_SET, UK: UK_SET, AT: AT_SET, CH: CH_SET,
};

// ── Bouwvak-datatabel (opt-in, default GEEN — harde eis TODO.md r192-194) ─────────────────────
//
// ADVIESDATUMS (Bouwend Nederland), gekoppeld aan de OCW-zomerschoolvakantie-regio's
// (Noord/Midden/Zuid). LET OP: de volgorde van de regio's ROTEERT elk jaar — er is GEEN vaste
// "Noord eerst, dan Midden, dan Zuid"-stagger. Elk jaar hieronder is Mon-Fri, 3 kalenderweken
// (18 dagen), geverifieerd tegen minstens 2 onafhankelijke bronnen (7-7-2026):
//   2025: Zuid 21/7-8/8, Midden 28/7-15/8, Noord 4/8-22/8 (volgorde Z-M-N)
//     bronnen: businessgids.nl/nieuws/bouwvak-2025-data-en-uitleg (alle 3 regio's, zelfconsistent),
//     hello-office.nl/verlofregistratie/bouwvak-2025-zuid (Zuid), shiftbase.com/nl/woordenboek/bouwvak
//     (Midden) — meerdere andere sites (vakantiedagennederland.nl, bouwvaknl.nl) verwarren Noord/Midden
//     onderling; hierboven gekozen op meerderheid + interne consistentie (geen regio-overlap).
//   2026: Noord 20/7-7/8, Zuid 27/7-14/8, Midden 3/8-21/8 (volgorde N-Z-M)
//     bronnen: fnv.nl/cao-sector/bouwen-wonen/meer-informatie/bouwvak, vakantie-data.nl/bouwvak-2026
//     (beide exact gelijk, geen conversie nodig — FNV/Bouwend Nederland is de brondata zelf).
//   2027: Noord 26/7-13/8, Midden 2/8-20/8, Zuid 9/8-27/8 (volgorde N-M-Z)
//     bron: vakantie-data.nl/bouwvak/ (kalenderweek-notatie za-zo; -/+2 dagen naar ma-vr geeft
//     exact deze datums — intern consistent met de 2026-rij van dezelfde bron).
//   2028: Midden 24/7-11/8, Noord 31/7-18/8, Zuid 7/8-25/8 (volgorde M-N-Z)
//     bronnen: beaks.nl/bouwvak (ma-vr, met een vaste -2d-afwijking op de startdatum die ook bij
//     hun 2026/2027-rijen optreedt — einddatum wél exact) en wanneerbouwvak.nl/bouwvak-2028-* (za-zo
//     kalenderweek-notatie); beide geven na normalisatie dezelfde ma-vr-periodes.
// Verre/ontbrekende jaren vallen terug op `approx` — die kent de rotatie niet en is dus grof
// (UI-hint "adviesdatums — controleer" dekt dit al).
function bouwvakApprox(year: number, weekOffset: number): { start: string; end: string } {
  // 4e maandag van juli + regio-offset (weken), 3 weken lang (ma t/m vr van week 3). Simplistisch:
  // neemt GEEN rotatie mee (die wisselt elk jaar onvoorspelbaar) — alle regio's krijgen dezelfde
  // vaste ±1-week-stagger rond dezelfde basisperiode, wat voor jaren buiten de tabel hierboven een
  // grove benadering is, geen matched-aan-de-echte-rotatie voorspelling.
  let d = utc(year, 7, 1);
  while (dow(d) !== 1) d = addDays(d, 1);   // 1e maandag
  d = addDays(d, 21 + weekOffset * 7);      // 4e maandag (+/- regio-offset)
  return { start: iso(d), end: iso(addDays(d, 18)) }; // ma week1 → vr week3
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

/** Materialiseer de bouwvak-keuze naar Holiday[] (leeg bij een onbekende keuze). */
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

