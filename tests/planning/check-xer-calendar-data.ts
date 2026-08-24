import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decodeXerCalendarData,
  parseXerStructuredText,
  readXerCalendars,
} from '@/services/xer/xerCalendarData';
import { parseP6StandardWorkWeek } from '@/services/p6/p6xmlReader';
import { canonicalizeBands } from '@/services/subdayIo';
import { parseXerTables } from '@/services/xer/xerTables';
import { installDOMParser } from './xmldom-shim';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function utf8(lines: readonly string[]): Uint8Array {
  return new TextEncoder().encode(lines.join('\n'));
}

function actualDayHours(decodedCalendar: ReturnType<typeof decodeXerCalendarData>): number {
  const dayHours = Object.values(decodedCalendar.bands.byWeekday)
    .filter(dayBands => dayBands.length > 0)
    .map(dayBands => dayBands.reduce((sum, band) => sum + band.end - band.start, 0) / 60);
  return dayHours.reduce((sum, hours) => sum + hours, 0) / dayHours.length;
}

// Breuk die dit vangt: structured text als losse string-splitsingen behandelen, waardoor geneste
// records of P6's DEL-DEL-opmaak de recordgrenzen verschuiven.
const nested = parseXerStructuredText(
  '\u007f\u007f (0||CalendarData(kind|root)((1||DaysOfWeek()((2||2()((3||0(s|08:00|f|16:00)())))))))',
);
eq('1 eigen tokenizer bewaart nummer, naam, velden en geneste kinderen', nested, {
  number: '0',
  name: 'CalendarData',
  fields: { kind: 'root' },
  children: [{
    number: '1',
    name: 'DaysOfWeek',
    fields: {},
    children: [{
      number: '2',
      name: '2',
      fields: {},
      children: [{
        number: '3',
        name: '0',
        fields: { s: '08:00', f: '16:00' },
        children: [],
      }],
    }],
  }],
});

// Breuk die dit vangt: P6-dag 1 als ISO-maandag behandelen, AM/PM als 24-uursklok lezen,
// middernacht-wrap verliezen of een uitzondering met uren als vrije dag opslaan.
const decoded = decodeXerCalendarData(
  '(0||CalendarData()('
  + '(0||DaysOfWeek()('
  + '(0||1()())'
  + '(0||2()((0||0(s|08:00|f|12:00)())(0||1(s|1:00 PM|f|5:00 PM)())))'
  + '(0||3()((0||0(s|22:00|f|06:00)())))'
  + '))'
  + '(0||Exceptions()('
  + '(0||0(d|0)())'
  + '(0||1(d|1)((0||0(s|9:00 AM|f|1:30 PM)())))'
  + '))'
  + '))',
);
eq('2 DaysOfWeek zet P6 zo/ma/di om naar ISO-weekdagen en canonieke banden', decoded.bands.byWeekday, {
  1: [{ start: 480, end: 720 }, { start: 780, end: 1020 }],
  2: [{ start: 1320, end: 1800 }],
  3: [], 4: [], 5: [], 6: [], 7: [],
});
eq('3 uitzondering zonder uren is een vrije dag vanaf de P6-epoch', decoded.holidays, [{
  name: 'Kalenderuitzondering', startDate: '1899-12-30', endDate: '1899-12-30',
}]);
eq('4 uitzondering met AM/PM-uren is een werkende uitzondering', decoded.workingExceptions, [{
  name: 'Kalenderuitzondering', startDate: '1899-12-31', endDate: '1899-12-31',
  bands: [{ start: 540, end: 810 }],
}]);
eq('5 gelezen klokbanden dragen het XER-uursignaal', decoded.hasExplicitClockBands, true);

// Breuk die dit vangt: een lege clndr_data als volledig niet-werkend behandelen in plaats van P6's
// gedocumenteerde terugval ma-vr 08:00-16:00.
const empty = decodeXerCalendarData('');
eq('6 lege kalenderdata valt terug op ma-vr 08:00-16:00', empty.bands.byWeekday, {
  1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }],
  3: [{ start: 480, end: 960 }], 4: [{ start: 480, end: 960 }],
  5: [{ start: 480, end: 960 }], 6: [], 7: [],
});
eq('7 gesynthetiseerde default is geen expliciet XER-kloksignaal', empty.hasExplicitClockBands, false);

// Breuken die dit vangt: `base_clndr_id` in dezelfde eerste pas opzoeken (kind staat hier vóór
// basis), lege uren als nul behandelen, of ontbrekende uren-per-dag uit een scalar/default afleiden
// in plaats van uit de werkelijk gelezen weekbanden.
const calendarTable = parseXerTables(utf8([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tbase_clndr_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tmonth_hr_cnt\tyear_hr_cnt\tclndr_data',
  '%R\t2\tAfgeleid\t1\tCA_Project\t7.5\t37.5\t162.5\t1950\t',
  '%R\t1\tBasis\t\tCA_Base\t\t\t\t\t(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|12:00)())))(0||3()((0||0(s|08:00|f|16:00)())))))(0||Exceptions()())))',
  '%R\t3\tVolledige dag\t\tCA_Rsrc\t\t\t\t\t(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|00:00|f|24:00)())))))(0||Exceptions()())))',
  '%E',
]));
const tableCalendars = readXerCalendars(calendarTable);
const child = tableCalendars.byId.get('2');
const base = tableCalendars.byId.get('1');
eq('8 kind vóór basis wordt in tweede pas gekoppeld', child?.baseCalendar?.id, '1');
eq('9 clndr_type wordt semantisch en rauw bewaard', {
  child: [child?.calendarType, child?.rawCalendarType],
  base: [base?.calendarType, base?.rawCalendarType],
}, {
  child: ['PROJECT', 'CA_Project'],
  base: ['GLOBAL', 'CA_Base'],
});
eq('10 expliciete uren-per-periode blijven ongewijzigd', {
  day: child?.hoursPerDay,
  week: child?.hoursPerWeek,
  month: child?.hoursPerMonth,
  year: child?.hoursPerYear,
}, { day: 7.5, week: 37.5, month: 162.5, year: 1950 });
eq('11 ontbrekende uren-per-periode komen uit 12 echte weekuren over 2 werkdagen', {
  day: base?.hoursPerDay,
  week: base?.hoursPerWeek,
  month: base?.hoursPerMonth,
  year: base?.hoursPerYear,
}, { day: 6, week: 12, month: 48, year: 576 });
eq('12 tabelresultaat behoudt X2-encodingrapportage', tableCalendars.encoding, 'utf-8');

// Breuk die dit vangt: XER-klokbanden alleen via de universele (a)/(b)/(b2)-regels laten lopen.
// De gewone enkelbandkalender `Basis` moet door de XER-eigen bronregel promoveren; `Volledige dag`
// promoveerde al door gedeelde regel (b2), terwijl de gesynthetiseerde lege `Afgeleid` dagmodus blijft.
eq('13 uurmodus-blast-radius is expliciet meetbaar vóór en na XER-regel c', tableCalendars.promotion, {
  sharedRules: 1,
  withXerClockRule: 2,
});
eq('14 gewone expliciete XER-klokband promoveert door bronregel c', {
  source: base?.hourModeSource,
  workTime: base?.workTime?.byWeekday[1],
}, {
  source: 'XER_CLOCK',
  workTime: [{ start: 480, end: 720 }],
});
eq('15 volledige dag blijft door de gedeelde b2-regel promoveren', {
  source: tableCalendars.byId.get('3')?.hourModeSource,
  workTime: tableCalendars.byId.get('3')?.workTime?.byWeekday[1],
}, {
  source: 'SHARED',
  workTime: [{ start: 0, end: 1440 }],
});
eq('16 lege default zonder bronklokken blijft dagmodus', {
  source: child?.hourModeSource,
  workTime: child?.workTime,
}, {});

// Breuk die dit vangt: XER en P6XML voor dezelfde P6-werkweek elk een andere dagnummering,
// klokinterpretatie of bandcanonicalisatie laten gebruiken.
installDOMParser();
const p6Calendar = new DOMParser().parseFromString(
  '<Calendar><StandardWorkWeek>'
  + '<StandardWorkHour><DayOfWeek>Monday</DayOfWeek>'
  + '<WorkTime><Start>08:00:00</Start><Finish>12:00:00</Finish></WorkTime>'
  + '<WorkTime><Start>13:00:00</Start><Finish>17:00:00</Finish></WorkTime>'
  + '</StandardWorkHour>'
  + '<StandardWorkHour><DayOfWeek>Tuesday</DayOfWeek>'
  + '<WorkTime><Start>22:00:00</Start><Finish>06:00:00</Finish></WorkTime>'
  + '</StandardWorkHour>'
  + '</StandardWorkWeek></Calendar>',
  'application/xml',
).documentElement;
const p6Week = canonicalizeBands(parseP6StandardWorkWeek(p6Calendar).rawByWeekday).bands;
eq('17 equivalente XER- en P6XML-werkweken leveren dezelfde canonieke banden', decoded.bands, p6Week);

// Openbare corpuspins worden uitsluitend met inhoudshashes aangeduid: geen lokale paden, namen of
// veldinhoud in broncode of foutmeldingen. Zonder corpus blijft de corpusloze gedragsset groen.
const corpusRoot = process.env.OPS_XER_CORPUS;
if (!corpusRoot) {
  console.log('OK  xer-calendar-data-corpus: openbare bron niet ingesteld — corpuspins overgeslagen');
} else if (!existsSync(corpusRoot)) {
  diffs.push('OPS_XER_CORPUS wijst niet naar een bestaande map');
} else {
  const manifest = JSON.parse(
    readFileSync(join(import.meta.dirname, 'xer-corpus-manifest.json'), 'utf8'),
  ) as { files: Record<string, { sha256: string }> };
  const observed: Record<string, {
    calendars: number;
    decoded: number;
    malformed: number;
    sharedRules: number;
    withXerClockRule: number;
  }> = {};
  for (const [relativePath, entry] of Object.entries(manifest.files)) {
    if (observed[entry.sha256]) continue;
    let tables;
    try {
      tables = parseXerTables(new Uint8Array(readFileSync(join(corpusRoot, relativePath))));
    } catch {
      continue;
    }
    const calendarTable = tables.tables.get('CALENDAR');
    const calendarCount = calendarTable?.rows.length ?? 0;
    if (calendarCount === 0) continue;
    const validRows = calendarTable!.rows.filter(row => {
      try {
        decodeXerCalendarData(row.cells.clndr_data ?? '');
        return true;
      } catch {
        return false;
      }
    });
    const scopedTables = new Map(tables.tables);
    scopedTables.set('CALENDAR', { ...calendarTable!, rows: validRows });
    const result = readXerCalendars({ ...tables, tables: scopedTables });
    observed[entry.sha256] = {
      calendars: calendarCount,
      decoded: validRows.length,
      malformed: calendarCount - validRows.length,
      ...result.promotion,
    };
  }
  const promotionBaseline = JSON.parse(
    readFileSync(join(import.meta.dirname, 'xer-calendar-hour-mode-baseline.json'), 'utf8'),
  ) as { pins: Record<string, string[]> };
  const groupedPins: Record<string, string[]> = {};
  for (const [hash, pin] of Object.entries(observed)) {
    const key = [
      pin.calendars,
      pin.decoded,
      pin.malformed,
      pin.sharedRules,
      pin.withXerClockRule,
    ].join('/');
    (groupedPins[key] ??= []).push(hash);
  }
  for (const hashes of Object.values(groupedPins)) hashes.sort();
  eq(
    '18 uurmoduspromoties zijn per openbaar bestand vóór en na XER-regel c gepind',
    groupedPins,
    promotionBaseline.pins,
  );

  const dossierHash = '2c1dce175b9f078111a48dc13fd1777f5fbd4cd7ab6623e647e7437330c60b7f';
  const dossierPath = Object.entries(manifest.files)
    .find(([, entry]) => entry.sha256 === dossierHash)?.[0];
  let dossierPin: unknown = { hashFound: false };
  if (dossierPath) {
    const dossierTables = parseXerTables(new Uint8Array(readFileSync(join(corpusRoot, dossierPath))));
    const rows = dossierTables.tables.get('CALENDAR')?.rows ?? [];
    const result = readXerCalendars(dossierTables);
    dossierPin = {
      calendars: rows.length,
      dayHourFieldsPresent: rows.filter(
        row => Object.prototype.hasOwnProperty.call(row.cells, 'day_hr_cnt'),
      ).length,
      derivedWeekHours: rows.filter((row, index) => {
        const decodedRow = decodeXerCalendarData(row.cells.clndr_data ?? '');
        const expected = Object.values(decodedRow.bands.byWeekday)
          .flat()
          .reduce((sum, band) => sum + band.end - band.start, 0) / 60;
        return Math.abs(result.calendars[index].hoursPerWeek - expected) < 1e-9;
      }).length,
      derivedFromActualWeek: rows.filter((row, index) => {
        const expected = actualDayHours(decodeXerCalendarData(row.cells.clndr_data ?? ''));
        return Math.abs(result.calendars[index].hoursPerDay - expected) < 1e-9;
      }).length,
    };
  }
  eq('19 inhoudshash-dossier leidt alle ontbrekende daguren uit echte weekbanden af', dossierPin, {
    calendars: 124,
    dayHourFieldsPresent: 0,
    derivedWeekHours: 124,
    derivedFromActualWeek: 124,
  });
}

if (diffs.length === 0) {
  console.log(`OK  xer-calendar-data: ${checks} checks groen`);
  process.exit(0);
}

console.log(`XX  xer-calendar-data: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
