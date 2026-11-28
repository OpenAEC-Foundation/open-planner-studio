import {
  decodeXerCalendarData,
  parseXerStructuredText,
  readXerCalendars,
  type XerCalendar,
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

function structuredRecord(
  number: string,
  name: string,
  fields: string,
  children: readonly string[],
): string {
  return `(${number}||${name}(${fields})(${children.join('')}))`;
}

const nested = parseXerStructuredText(
  '\u007f\u007f (0||CalendarData(kind|root)((1||DaysOfWeek()((2||2()((3||0(s|08:00|f|16:00)())))))))',
);
eq('1 eigen tokenizer bewaart nummer, naam, velden en geneste kinderen', nested, {
  role: 'ROOT',
  number: '0',
  name: 'CalendarData',
  fields: { kind: 'root' },
  children: [{
    role: 'CONTAINER',
    number: '1',
    name: 'DaysOfWeek',
    fields: {},
    children: [{
      role: 'DAY',
      number: '2',
      name: '2',
      fields: {},
      children: [{
        role: 'BAND',
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
}
eq('1a lege hoofdrecordnaam behoudt volledig aanwezige kalenderkinderen', unnamedRootBands, [
  { start: 420, end: 720 },
]);

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
  name: 'Calendar exception', startDate: '1899-12-30', endDate: '1899-12-30',
}]);
eq('4 uitzondering met AM/PM-uren is een werkende uitzondering', decoded.workingExceptions, [{
  name: 'Calendar exception', startDate: '1899-12-31', endDate: '1899-12-31',
  bands: [{ start: 540, end: 810 }],
}]);
eq('5 gelezen klokbanden dragen het XER-uursignaal', decoded.hasExplicitClockBands, true);

const empty = decodeXerCalendarData('');
eq('6 lege kalenderdata valt terug op ma-vr 08:00-16:00', empty.bands.byWeekday, {
  1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }],
  3: [{ start: 480, end: 960 }], 4: [{ start: 480, end: 960 }],
  5: [{ start: 480, end: 960 }], 6: [], 7: [],
});
eq('7 gesynthetiseerde default is geen expliciet XER-kloksignaal', empty.hasExplicitClockBands, false);

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

const nestedCompactExceptions = structuredRecord('0', 'CalendarData', '', [
  structuredRecord('0', 'DaysOfWeek', '', [
    structuredRecord('0', '2', '', [structuredRecord('0', '0', 's|08:00|f|12:00', [])]),
  ]),
  structuredRecord('0', 'Wrapper', '', [
    structuredRecord('0', 'Exceptions', '', ['(0||d|2())']),
  ]),
]);
const misplacedCompactRows = readXerCalendars(parseXerTables(utf8([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_data',
  '%R\texception-under-days\t(0||CalendarData()((0||DaysOfWeek()((2||d|123((s|08:00|f|16:00)))))(0||Exceptions()())))',
  '%R\tday-under-exceptions\t(0||CalendarData()((0||DaysOfWeek()((0||2()())))(0||Exceptions()((0||2()((s|08:00|f|16:00)))))))',
  '%R\tnested-compact\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||Wrapper()((s|08:00|f|16:00)))))))(0||Exceptions()())))',
  `%R\tnested-exceptions\t${nestedCompactExceptions}`,
  '%R\twrong-parent\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|f|12:00)())))))(0||Wrong()((s|13:00|f|17:00)))(0||Exceptions()())))',
  '%R\tvalid-sister\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|07:00|f|11:00)())))))(0||Exceptions()())))',
  '%E',
])));
eq('15a compacte recovery behoudt alleen de geldige zusterkalender',
  misplacedCompactRows.calendars.map(calendar => ({
    id: calendar.id,
    workTime: calendar.workTime?.byWeekday[1],
  })), [{ id: 'valid-sister', workTime: [{ start: 420, end: 660 }] }]);
eq('15b verkeerde compactcontext wordt per rij typed geweigerd zonder default of deelkalender',
  misplacedCompactRows.issues.map(issue => [issue.calendarId, issue.code, issue.resolution]), [
    ['exception-under-days', 'XER_CALENDAR_INVALID_COMPACT_CONTEXT', 'REJECTED'],
    ['day-under-exceptions', 'XER_CALENDAR_INVALID_COMPACT_CONTEXT', 'REJECTED'],
    ['nested-compact', 'XER_CALENDAR_INVALID_COMPACT_CONTEXT', 'REJECTED'],
    ['nested-exceptions', 'XER_CALENDAR_INVALID_COMPACT_CONTEXT', 'REJECTED'],
    ['wrong-parent', 'XER_CALENDAR_INVALID_COMPACT_CONTEXT', 'REJECTED'],
  ]);

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
    name: 'Calendar exception',
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

const multipleExceptionContainers = readXerCalendars(parseXerTables(utf8([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_data',
  '%R\tmulti-exceptions\t(0||CalendarData()((0||DaysOfWeek()((0||2()((0||0(s|08:00|f|16:00)())))))(0||Exceptions()((0||0(d|0)())))(0||Exceptions()((0||1(d|1)((0||0(s|09:00|f|13:00)())))))))',
  '%E',
])));
eq('15e meerdere Exceptions-containers behouden vrije en werkende datums in bronvolgorde', {
  holidays: multipleExceptionContainers.calendars[0]?.holidays,
  working: multipleExceptionContainers.calendars[0]?.workingExceptions,
}, {
  holidays: [{
    name: 'Calendar exception', startDate: '1899-12-30', endDate: '1899-12-30',
  }],
  working: [{
    name: 'Calendar exception', startDate: '1899-12-31', endDate: '1899-12-31',
    bands: [{ start: 540, end: 780 }],
  }],
});
eq('15f meerdere Exceptions-containers leveren een expliciet recovery-issue',
  multipleExceptionContainers.issues.map(issue => ({
    id: issue.calendarId,
    line: issue.line,
    code: issue.code,
    resolution: issue.resolution,
  })), [{
    id: 'multi-exceptions',
    line: 4,
    code: 'XER_CALENDAR_MULTIPLE_EXCEPTIONS_MERGED',
    resolution: 'RECOVERED',
  }]);

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
eq('15g ruwe base-id blijft staan maar alleen de acyclische geldige rand wordt gekoppeld',
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
eq('15h basegraaf rapporteert cyclusleden, self en dangling onderscheiden',
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
eq('15i kalenderresultaat blijft serialiseerbaar zonder cyclische objectgraaf',
  baseGraphSerializable, true);

const deepAcyclicRows = Array.from({ length: 10_000 }, (_, index) => (
  `%R\ta-${index}\t${index === 9_999 ? '' : `a-${index + 1}`}\t`
));
let deepAcyclic: ReturnType<typeof readXerCalendars> | undefined;
let deepAcyclicError = '';
try {
  deepAcyclic = readXerCalendars(parseXerTables(utf8([
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
    '%T\tCALENDAR',
    '%F\tclndr_id\tbase_clndr_id\tclndr_data',
    ...deepAcyclicRows,
    '%E',
  ])));
} catch (error) {
  deepAcyclicError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
let deepAcyclicJsonError = '';
let deepAcyclicTransfer: XerCalendar[] | undefined;
if (deepAcyclic) {
  const result = deepAcyclic;
  try {
    deepAcyclicTransfer = JSON.parse(JSON.stringify(result.calendars)) as XerCalendar[];
  } catch (error) {
    deepAcyclicJsonError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
}
eq('15j iteratieve basegraaf verwerkt 10.000 acyclische vooruitverwijzingen zonder stackfout', {
  error: deepAcyclicError,
  jsonError: deepAcyclicJsonError,
  calendars: deepAcyclic?.calendars.length,
  issues: deepAcyclic?.issues.length,
  firstBase: deepAcyclic?.byId.get('a-0')?.baseCalendar?.id,
  firstBaseIdentity: deepAcyclic?.byId.get('a-0')?.baseCalendar
    === deepAcyclic?.byId.get('a-1'),
  penultimateBase: deepAcyclic?.byId.get('a-9998')?.baseCalendar?.id,
  rootBase: deepAcyclic?.byId.get('a-9999')?.baseCalendar?.id,
  transferCount: deepAcyclicTransfer?.length,
  transferFirstBaseId: deepAcyclicTransfer?.[0]?.baseCalendarId,
  transferContainsConvenienceLink: Object.prototype.hasOwnProperty.call(
    deepAcyclicTransfer?.[0] ?? {}, 'baseCalendar',
  ),
}, {
  error: '',
  jsonError: '',
  calendars: 10_000,
  issues: 0,
  firstBase: 'a-1',
  firstBaseIdentity: true,
  penultimateBase: 'a-9999',
  transferCount: 10_000,
  transferFirstBaseId: 'a-1',
  transferContainsConvenienceLink: false,
});

const deepCycleRows = Array.from({ length: 10_000 }, (_, index) => (
  `%R\tc-${index}\tc-${(index + 1) % 10_000}\t`
));
let deepCycle: ReturnType<typeof readXerCalendars> | undefined;
let deepCycleError = '';
try {
  deepCycle = readXerCalendars(parseXerTables(utf8([
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
    '%T\tCALENDAR',
    '%F\tclndr_id\tbase_clndr_id\tclndr_data',
    '%R\tt-0\tt-1\t',
    '%R\tt-1\tt-2\t',
    '%R\tt-2\tc-0\t',
    ...deepCycleRows,
    '%E',
  ])));
} catch (error) {
  deepCycleError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
const deepCycleIssues = deepCycle?.issues.filter(
  issue => issue.code === 'XER_CALENDAR_BASE_CYCLE',
) ?? [];
let deepCycleSerializable = true;
try {
  JSON.stringify(deepCycle?.calendars);
} catch {
  deepCycleSerializable = false;
}
eq('15k diepe cyclus markeert alleen 10.000 echte leden en laat de tail veilig gekoppeld', {
  error: deepCycleError,
  cycleIssues: deepCycleIssues.length,
  firstCycleId: deepCycleIssues[0]?.calendarId,
  lastCycleId: deepCycleIssues.at(-1)?.calendarId,
  tailCycleIssues: deepCycleIssues.filter(issue => issue.calendarId.startsWith('t-')).length,
  tailLinks: ['t-0', 't-1', 't-2'].map(id => deepCycle?.byId.get(id)?.baseCalendar?.id),
  cycleLink: deepCycle?.byId.get('c-0')?.baseCalendar?.id,
  serializable: deepCycleSerializable,
}, {
  error: '',
  cycleIssues: 10_000,
  firstCycleId: 'c-0',
  lastCycleId: 'c-9999',
  tailCycleIssues: 0,
  tailLinks: ['t-1', 't-2', 'c-0'],
  serializable: true,
});

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

function exceptionBlock(serials: readonly number[]): string {
  return structuredRecord('0', 'Exceptions', '', serials.map(
    (serial, index) => structuredRecord('0', String(index), `d|${serial}`, []),
  ));
}
function calendarData(p6Days: readonly number[], serials: readonly number[]): string {
  return structuredRecord('0', 'CalendarData', '', [
    structuredRecord('0', 'DaysOfWeek', '', p6Days.map(day => structuredRecord('0', String(day), '', [
      structuredRecord('0', '0', 's|08:00|f|12:00', []),
      structuredRecord('0', '1', 's|13:00|f|17:00', []),
    ]))),
    exceptionBlock(serials),
  ]);
}
const holidayDates = (data: string): string[] =>
  decodeXerCalendarData(data).holidays.map(holiday => holiday.startDate).sort();
const FRIDAY_OFF_WEEK = [1, 2, 3, 4, 5, 7];
const MON_FRI_WEEK = [2, 3, 4, 5, 6];
const SEVEN_DAY_WEEK = [1, 2, 3, 4, 5, 6, 7];

const CLAMPED_BLOCK = [40143, 40144, 40144, 40147, 40147, 40148, 40149, 40150, 40151, 40151];
const clamped = decodeXerCalendarData(calendarData(FRIDAY_OFF_WEEK, CLAMPED_BLOCK));
eq('22a het geklemde blok wordt tot tien aaneengesloten vrije dagen hersteld',
  clamped.holidays.map(holiday => holiday.startDate).sort(), [
    '2009-11-26', '2009-11-27', '2009-11-28', '2009-11-29', '2009-11-30',
    '2009-12-01', '2009-12-02', '2009-12-03', '2009-12-04', '2009-12-05',
  ]);
eq('22a een herstelde dag telt niet ook nog als virtuele P6-niet-werkdag',
  clamped.p6NonWorkPenaltyDates, []);
eq('22a het herstel laat een herstelcode achter', clamped.recoveries.includes('WEEKEND_CLAMP_RECONSTRUCTED'), true);
eq('22a de gereconstrueerde dag is als zodanig benoemd',
  clamped.holidays.find(holiday => holiday.startDate === '2009-12-05')?.name,
  'Calendar exception (weekend reconstruction)');

const JUMP_BLOCK = [40074, 40077, 40077, 40078, 40079, 40080];
eq('22b de sprong vrijdag→maandag herstelt het weekend ook zonder duplicaat op de vrijdag',
  holidayDates(calendarData(FRIDAY_OFF_WEEK, JUMP_BLOCK)), [
    '2009-09-18', '2009-09-19', '2009-09-20', '2009-09-21',
    '2009-09-22', '2009-09-23', '2009-09-24',
  ]);

eq('22c een los dubbel vrijdagrecord maakt geen zaterdag vrij',
  holidayDates(calendarData(SEVEN_DAY_WEEK, [40151, 40151])), ['2009-12-04']);
eq('22c zonder herstel geen herstelcode',
  decodeXerCalendarData(calendarData(SEVEN_DAY_WEEK, [40151, 40151])).recoveries.includes('WEEKEND_CLAMP_RECONSTRUCTED'), false);

eq('22d een duplicaat elders laat losse vrijdagrecords ongemoeid',
  holidayDates(calendarData(FRIDAY_OFF_WEEK, [40149, 40149, 40151, 40158])),
  ['2009-12-02', '2009-12-04', '2009-12-11']);

eq('22f twee losse feestdagen drie dagen uit elkaar vormen geen geklemd blok',
  holidayDates(calendarData(FRIDAY_OFF_WEEK, [40151, 40154])), ['2009-12-04', '2009-12-07']);

eq('22g een tweedaags blok met een dubbel vrijdagrecord maakt geen zaterdag vrij',
  holidayDates(calendarData(SEVEN_DAY_WEEK, [40150, 40151, 40151])), ['2009-12-03', '2009-12-04']);

eq('22e op een ma-vr-kalender wordt er niets hersteld',
  holidayDates(calendarData(MON_FRI_WEEK, CLAMPED_BLOCK)), [
    '2009-11-26', '2009-11-27', '2009-11-30', '2009-12-01', '2009-12-02', '2009-12-03', '2009-12-04',
  ]);
eq('22e op een ma-vr-kalender blijven de aangrenzende duplicaten P6-niet-werkdagen',
  decodeXerCalendarData(calendarData(MON_FRI_WEEK, CLAMPED_BLOCK)).p6NonWorkPenaltyDates,
  ['2009-11-27', '2009-11-30', '2009-12-04']);
eq('22e op een ma-vr-kalender geen herstelcode',
  decodeXerCalendarData(calendarData(MON_FRI_WEEK, CLAMPED_BLOCK)).recoveries.includes('WEEKEND_CLAMP_RECONSTRUCTED'), false);

if (diffs.length === 0) {
  console.log(`OK  xer-calendar-data: ${checks} checks groen`);
  process.exit(0);
}

console.log(`XX  xer-calendar-data: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
