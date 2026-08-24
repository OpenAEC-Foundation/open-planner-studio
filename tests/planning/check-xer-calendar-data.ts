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

let unnamedRootBands: unknown = 'geweigerd';
try {
  unnamedRootBands = decodeXerCalendarData(
    '(0||()((0||DaysOfWeek()((0||2()((0||0(s|07:00|f|12:00)())))))(0||Exceptions()())))',
  ).bands.byWeekday[1];
} catch {
  // De assertion hieronder maakt een onterechte rootnaamweigering als gewone RED zichtbaar.
}
eq('1a lege hoofdrecordnaam behoudt volledig aanwezige kalenderkinderen', unnamedRootBands, [
  { start: 420, end: 720 },
]);

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

// Breuken die dit vangt: alle CALENDAR-rijen in een globale `map` laten falen op één defecte rij,
// of de twee waargenomen compacte recordvormen alleen in de test voorfilteren. De productie-ingang
// moet de compacte band/exception-vorm smal herstellen, de afgeknotte rij zichtbaar weigeren en de
// geldige zusterrij behouden.
const isolatedRows = readXerCalendars(parseXerTables(utf8([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_data',
  '%R\tcompact\tCompact\t(0||CalendarData()((0||DaysOfWeek()((0||2()((s|08:00|f|12:00)(s|13:00|f|17:00)))))(0||Exceptions()((0||d|0())))))',
  '%R\tsurplus\tSurplus\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|f|16:00)()))))))(0||Exceptions()())))',
  '%R\tbroken\tAfgekapt\t(0||CalendarData()(',
  '%R\tvalid\tGeldig\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|f|16:00)())))))(0||Exceptions()())))',
  '%E',
])));
eq('13 productie-ingang behoudt herstelde en geldige zusterkalenders per rij',
  isolatedRows.calendars.map(calendar => calendar.id), ['compact', 'surplus', 'valid']);
eq('14 rij-issues pinnen kalender-id, bronregel, code en afhandeling',
  isolatedRows.issues.map(issue => ({
    id: issue.calendarId,
    line: issue.line,
    code: issue.code,
    resolution: issue.resolution,
  })), [{
    id: 'compact',
    line: 4,
    code: 'XER_CALENDAR_COMPACT_RECORD_RECOVERED',
    resolution: 'RECOVERED',
  }, {
    id: 'surplus',
    line: 5,
    code: 'XER_CALENDAR_SURPLUS_CLOSE_RECOVERED',
    resolution: 'RECOVERED',
  }, {
    id: 'broken',
    line: 6,
    code: 'XER_CALENDAR_INVALID_STRUCTURE',
    resolution: 'REJECTED',
  }]);
eq('15 ieder rij-issue bevat een niet-lege reden',
  isolatedRows.issues.every(issue => issue.reason.trim().length > 0), true);

// Breuken die dit vangt: aanwezige maar ongeldige data als "afwezig" behandelen en stil naar de
// ma-vr-default vallen, losse tokens/ongeldige dagen of epochs laten verdwijnen, seconden afkappen,
// overlappende banden doorgeven en negatieve periode-uren stil afleiden. Alleen de lege cel mag
// defaulten. Bij een dubbele exceptiondatum wint een werkende uitzondering altijd van een vrije dag.
const hostileRows = readXerCalendars(parseXerTables(utf8([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
  '%T\tCALENDAR',
  '%F\tclndr_id\tday_hr_cnt\tclndr_data',
  '%R\tabsent\t\t',
  '%R\tclock\t\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|25:00|f|26:00)())))))(0||Exceptions()())))',
  '%R\tpairs\t\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|dangling)())))))(0||Exceptions()())))',
  '%R\tday\t\t(0||CalendarData()((0||DaysOfWeek()((0||8()((0||0(s|08:00|f|16:00)())))))(0||Exceptions()())))',
  '%R\tepoch\t\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|f|16:00)())))))(0||Exceptions()((0||0(d|geen-datum)())))))',
  '%R\tseconds\t\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00:59|f|16:00:00)())))))(0||Exceptions()())))',
  '%R\toverlap\t\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|f|12:00)())(0||1(s|11:00|f|13:00)())))))(0||Exceptions()())))',
  '%R\tperiod\t-1\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|f|16:00)())))))(0||Exceptions()())))',
  '%R\tduplicate\t\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|f|16:00)())))))(0||Exceptions()((0||0(d|0)())(0||1(d|0)((0||0(s|09:00|f|13:00)())))))))',
  '%R\tduplicate-key\t\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|s|09:00|f|16:00)())))))(0||Exceptions()())))',
  '%R\tduplicate-day\t\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|f|12:00)())))(0||2()((0||0(s|13:00|f|17:00)())))))(0||Exceptions()())))',
  '%R\tempty-key\t\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(|waarde|s|08:00|f|16:00)())))))(0||Exceptions()())))',
  '%E',
])));
eq('15a alleen afwezige data en de deterministisch herstelde duplicate blijven behouden',
  hostileRows.calendars.map(calendar => calendar.id), ['absent', 'duplicate']);
eq('15b hostile semantiek levert onderscheiden issuecodes zonder stille defaults',
  hostileRows.issues.map(issue => [issue.calendarId, issue.code, issue.resolution]), [
    ['clock', 'XER_CALENDAR_INVALID_CLOCK', 'REJECTED'],
    ['pairs', 'XER_CALENDAR_ODD_FIELD_COUNT', 'REJECTED'],
    ['day', 'XER_CALENDAR_INVALID_DAY', 'REJECTED'],
    ['epoch', 'XER_CALENDAR_INVALID_EPOCH', 'REJECTED'],
    ['seconds', 'XER_CALENDAR_NONZERO_SECONDS', 'REJECTED'],
    ['overlap', 'XER_CALENDAR_OVERLAPPING_BANDS', 'REJECTED'],
    ['period', 'XER_CALENDAR_INVALID_PERIOD_HOURS', 'REJECTED'],
    ['duplicate', 'XER_CALENDAR_DUPLICATE_EXCEPTION', 'RECOVERED'],
    ['duplicate-key', 'XER_CALENDAR_DUPLICATE_FIELD', 'REJECTED'],
    ['duplicate-day', 'XER_CALENDAR_DUPLICATE_DAY', 'REJECTED'],
    ['empty-key', 'XER_CALENDAR_INVALID_FIELD_PAIR', 'REJECTED'],
  ]);
eq('15c werkende uitzondering wint op een dubbele datum en sluit holiday-dubbeling uit', {
  holidays: hostileRows.byId.get('duplicate')?.holidays,
  working: hostileRows.byId.get('duplicate')?.workingExceptions,
}, {
  holidays: [],
  working: [{
    name: 'Kalenderuitzondering',
    startDate: '1899-12-30',
    endDate: '1899-12-30',
    bands: [{ start: 540, end: 780 }],
  }],
});
eq('15d hostile issues dragen steeds bronregel en reden', hostileRows.issues.map(issue => ({
  line: issue.line,
  hasReason: issue.reason.trim().length > 0,
})), [
  { line: 5, hasReason: true },
  { line: 6, hasReason: true },
  { line: 7, hasReason: true },
  { line: 8, hasReason: true },
  { line: 9, hasReason: true },
  { line: 10, hasReason: true },
  { line: 11, hasReason: true },
  { line: 12, hasReason: true },
  { line: 13, hasReason: true },
  { line: 14, hasReason: true },
  { line: 15, hasReason: true },
]);

// Breuken die dit vangt: een dangling/self-base stil laten staan of A↔B als echte circulaire
// objectgraaf koppelen. De ruwe id blijft diagnostisch bewaard; alleen veilige randen worden objecten.
const baseGraph = readXerCalendars(parseXerTables(utf8([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
  '%T\tCALENDAR',
  '%F\tclndr_id\tbase_clndr_id\tclndr_data',
  '%R\tA\tB\t',
  '%R\tB\tA\t',
  '%R\tself\tself\t',
  '%R\tdangling\tmissing\t',
  '%R\troot\t\t',
  '%R\tchild\troot\t',
  '%E',
])));
eq('15e ruwe base-id blijft staan maar alleen de acyclische geldige rand wordt gekoppeld',
  baseGraph.calendars.map(calendar => ({
    id: calendar.id,
    rawBase: calendar.baseCalendarId,
    linkedBase: calendar.baseCalendar?.id,
  })), [
    { id: 'A', rawBase: 'B' },
    { id: 'B', rawBase: 'A' },
    { id: 'self', rawBase: 'self' },
    { id: 'dangling', rawBase: 'missing' },
    { id: 'root' },
    { id: 'child', rawBase: 'root', linkedBase: 'root' },
  ]);
eq('15f basegraaf rapporteert cyclusleden, self en dangling onderscheiden',
  baseGraph.issues.map(issue => [issue.calendarId, issue.code, issue.resolution]), [
    ['A', 'XER_CALENDAR_BASE_CYCLE', 'UNLINKED'],
    ['B', 'XER_CALENDAR_BASE_CYCLE', 'UNLINKED'],
    ['self', 'XER_CALENDAR_SELF_BASE', 'UNLINKED'],
    ['dangling', 'XER_CALENDAR_DANGLING_BASE', 'UNLINKED'],
  ]);
let baseGraphSerializable = true;
try {
  JSON.stringify(baseGraph.calendars);
} catch {
  baseGraphSerializable = false;
}
eq('15g kalenderresultaat blijft serialiseerbaar zonder cyclische objectgraaf',
  baseGraphSerializable, true);

// Breuk die dit vangt: XER-klokbanden alleen via de universele (a)/(b)/(b2)-regels laten lopen.
// De gewone enkelbandkalender `Basis` moet door de XER-eigen bronregel promoveren; `Volledige dag`
// promoveerde al door gedeelde regel (b2), terwijl de gesynthetiseerde lege `Afgeleid` dagmodus blijft.
eq('16 uurmodus-blast-radius is expliciet meetbaar vóór en na XER-regel c', tableCalendars.promotion, {
  sharedRules: 1,
  withXerClockRule: 2,
});
eq('17 gewone expliciete XER-klokband promoveert door bronregel c', {
  source: base?.hourModeSource,
  workTime: base?.workTime?.byWeekday[1],
}, {
  source: 'XER_CLOCK',
  workTime: [{ start: 480, end: 720 }],
});
eq('18 volledige dag blijft door de gedeelde b2-regel promoveren', {
  source: tableCalendars.byId.get('3')?.hourModeSource,
  workTime: tableCalendars.byId.get('3')?.workTime?.byWeekday[1],
}, {
  source: 'SHARED',
  workTime: [{ start: 0, end: 1440 }],
});
eq('19 lege default zonder bronklokken blijft dagmodus', {
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
const p6RawWeek = parseP6StandardWorkWeek(p6Calendar).rawByWeekday;
eq('20 P6XML levert vóór gedeelde canonicalisatie de letterlijk verwachte ruwe banden', p6RawWeek, {
  1: [{ start: 480, end: 720 }, { start: 780, end: 1020 }],
  2: [{ start: 1320, end: 360 }],
});
const p6Week = canonicalizeBands(p6RawWeek).bands;
eq('21 equivalente XER- en P6XML-werkweken leveren dezelfde canonieke banden', decoded.bands, p6Week);

if (diffs.length === 0) {
  console.log(`OK  xer-calendar-data: ${checks} checks groen`);
  process.exit(0);
}

console.log(`XX  xer-calendar-data: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
