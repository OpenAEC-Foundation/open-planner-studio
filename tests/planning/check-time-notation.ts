import { clockPlaceholder, displayIsoTime, formatAxisClock, formatClock, formatLocalDateTime, parseClock } from '@/utils/displayTime';
import { displayDateTime } from '@/utils/displayDate';
import { formatGridDateTime, parseGridDateTime } from '@/engine/taskGrid/editors';
import { bandEndAfterEdit, bandEndField, bandEndFromField } from '@/components/dialogs/WorkTimeEditor';
import { SETTINGS } from '@/utils/settingsRegistry';
import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { createDefaultProject } from '@/state/defaults';
import { deriveHoursPerDay } from '@/services/subdayIo';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';

const diffs: string[] = [];
let count = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  count++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

eq('24h 0:00', formatClock(0, '24h'), '00:00');
eq('24h 7:05 met voorloopnul', formatClock(425, '24h'), '07:05');
eq('24h 12:00', formatClock(720, '24h'), '12:00');
eq('24h 13:30', formatClock(810, '24h'), '13:30');
eq('24h 23:59', formatClock(1439, '24h'), '23:59');
eq('24h 1440 zonder einde-vlag valt op 00:00', formatClock(1440, '24h'), '00:00');
eq('24h 1440 als einde is 24:00', formatClock(1440, '24h', { endOfDay: true }), '24:00');
eq('24h nachtblok-einde 1800 toont 06:00', formatClock(1800, '24h'), '06:00');
eq('24h einde-vlag raakt 0 niet', formatClock(0, '24h', { endOfDay: true }), '00:00');

eq('12h 0:00 is 12:00 AM', formatClock(0, '12h'), '12:00 AM');
eq('12h 0:30 is 12:30 AM', formatClock(30, '12h'), '12:30 AM');
eq('12h 7:05 zonder voorloopnul', formatClock(425, '12h'), '7:05 AM');
eq('12h 11:59 AM', formatClock(719, '12h'), '11:59 AM');
eq('12h 12:00 is 12:00 PM', formatClock(720, '12h'), '12:00 PM');
eq('12h 13:30 is 1:30 PM', formatClock(810, '12h'), '1:30 PM');
eq('12h 23:59 is 11:59 PM', formatClock(1439, '12h'), '11:59 PM');
eq('12h 1440 als einde is 12:00 AM', formatClock(1440, '12h', { endOfDay: true }), '12:00 AM');
eq('12h nachtblok-start 22:00', formatClock(1320, '12h'), '10:00 PM');
eq('12h nachtblok-einde 1800 toont 6:00 AM', formatClock(1800, '12h'), '6:00 AM');
eq('plaatshouder 24h', clockPlaceholder('24h'), '13:30');
eq('plaatshouder 12h', clockPlaceholder('12h'), '1:30 PM');

eq('as 24h uur', formatAxisClock(780, '24h', 'hour'), '13:00');
eq('as 24h kwartier', formatAxisClock(795, '24h', 'quarterHour'), '13:15');
eq('as 12h uur middernacht', formatAxisClock(0, '12h', 'hour'), '12 AM');
eq('as 12h uur middag', formatAxisClock(720, '12h', 'hour'), '12 PM');
eq('as 12h uur 13:00', formatAxisClock(780, '12h', 'hour'), '1 PM');
eq('as 12h kwartier 13:15', formatAxisClock(795, '12h', 'quarterHour'), '1:15');
eq('as 12h kwartier 0:45', formatAxisClock(45, '12h', 'quarterHour'), '12:45');
eq('as 12h uur smal middernacht', formatAxisClock(0, '12h', 'hour', true), '12a');
eq('as 12h uur smal middag', formatAxisClock(720, '12h', 'hour', true), '12p');
eq('as 12h uur smal 22:00', formatAxisClock(1320, '12h', 'hour', true), '10p');
eq('as 24h negeert smal', formatAxisClock(780, '24h', 'hour', true), '13:00');

eq('parse 13:00', parseClock('13:00'), 780);
eq('parse 1300', parseClock('1300'), 780);
eq('parse 13', parseClock('13'), 780);
eq('parse 0:00', parseClock('0:00'), 0);
eq('parse 00:00', parseClock('00:00'), 0);
eq('parse 7:30', parseClock('7:30'), 450);
eq('parse 0730', parseClock('0730'), 450);
eq('parse 730 = 7:30', parseClock('730'), 450);
eq('parse 13.30', parseClock('13.30'), 810);
eq('parse 12:00 (middag)', parseClock('12:00'), 720);
eq('parse spaties rond invoer', parseClock('  13:30 '), 810);
eq('parse 24:00 zonder einde-vlag ongeldig', parseClock('24:00'), undefined);
eq('parse 24:00 als einde = 1440', parseClock('24:00', { endOfDay: true }), 1440);
eq('parse 24 als einde = 1440', parseClock('24', { endOfDay: true }), 1440);
eq('parse 0:00 als einde blijft 0', parseClock('0:00', { endOfDay: true }), 0);

eq('parse 1:00 PM', parseClock('1:00 PM'), 780);
eq('parse 1 pm', parseClock('1 pm'), 780);
eq('parse 1pm', parseClock('1pm'), 780);
eq('parse 1:30 p.m.', parseClock('1:30 p.m.'), 810);
eq('parse 7:05 am', parseClock('7:05 am'), 425);
eq('parse 7 a', parseClock('7 a'), 420);
eq('parse 12:00 AM = middernacht', parseClock('12:00 AM'), 0);
eq('parse 12:30 AM = 0:30', parseClock('12:30 AM'), 30);
eq('parse 12:00 PM = middag', parseClock('12:00 PM'), 720);
eq('parse 12:45 PM = 12:45', parseClock('12:45 PM'), 765);
eq('parse 11:59 PM', parseClock('11:59 PM'), 1439);
eq('parse 12:00 AM als einde = 1440', parseClock('12:00 AM', { endOfDay: true }), 1440);
eq('parse 12:00 PM als einde blijft middag', parseClock('12:00 PM', { endOfDay: true }), 720);
eq('parse 1:00 AM als einde = 60', parseClock('1:00 AM', { endOfDay: true }), 60);

for (const bad of ['', ' ', 'x', '25:00', '13:60', '13:5', '1:00 XM', '13:00 PM', '0:00 AM', '0 pm',
  '12:00:00', '-1:00', '1:00 PM PM', '2400', '24:30', 'PM', ':30', '1::00']) {
  eq(`parse ongeldig ${JSON.stringify(bad)}`, parseClock(bad), undefined);
}
eq('parse 24:30 als einde ongeldig', parseClock('24:30', { endOfDay: true }), undefined);

let roundTripFailures = 0;
for (let m = 0; m < 1440; m++) {
  if (parseClock(formatClock(m, '24h')) !== m) roundTripFailures++;
  if (parseClock(formatClock(m, '12h')) !== m) roundTripFailures++;
}
eq('rondgang 1440 minuten × 2 standen', roundTripFailures, 0);
eq('rondgang einde 24:00', parseClock(formatClock(1440, '24h', { endOfDay: true }), { endOfDay: true }), 1440);
eq('rondgang einde 12:00 AM', parseClock(formatClock(1440, '12h', { endOfDay: true }), { endOfDay: true }), 1440);

eq('displayIsoTime 24h', displayIsoTime('2026-06-15T13:30', '24h'), '13:30');
eq('displayIsoTime 12h', displayIsoTime('2026-06-15T13:30', '12h'), '1:30 PM');
eq('displayIsoTime pure datum', displayIsoTime('2026-06-15', '12h'), '');
eq('displayDateTime 24h', displayDateTime('2026-06-15T13:30', 'dmy', '24h'), '15-06-2026 13:30');
eq('displayDateTime 12h', displayDateTime('2026-06-15T13:30', 'dmy', '12h'), '15-06-2026 1:30 PM');
eq('displayDateTime 12h middernacht', displayDateTime('2026-06-15T00:00', 'ymd', '12h'), '2026-06-15 12:00 AM');
eq('displayDateTime pure datum', displayDateTime('2026-06-15', 'dmy', '12h'), '15-06-2026');
eq('displayDateTime seconden en Z genegeerd', displayDateTime('2026-06-15T13:30:45.000Z', 'dmy', '12h'), '15-06-2026 1:30 PM');
eq('raster: weergave 12h', formatGridDateTime('2026-06-15T12:00', 'dmy', '12h'), '15-06-2026 12:00 PM');
eq('raster: invoer 1:00 PM', parseGridDateTime('15-06-2026 1:00 PM', 'dmy'), '2026-06-15T13:00');
eq('raster: invoer 1 pm', parseGridDateTime('15-06-2026 1 pm', 'dmy'), '2026-06-15T13:00');
eq('raster: invoer 12:00 AM', parseGridDateTime('15-06-2026 12:00 AM', 'dmy'), '2026-06-15T00:00');
eq('raster: invoer 1300', parseGridDateTime('15-06-2026 1300', 'dmy'), '2026-06-15T13:00');
eq('raster: invoer ISO met T', parseGridDateTime('2026-06-15T13:00', 'dmy'), '2026-06-15T13:00');
eq('raster: ongeldige tijd', parseGridDateTime('15-06-2026 13:00 PM', 'dmy'), null);
eq('raster: 24:00 geweigerd', parseGridDateTime('15-06-2026 24:00', 'dmy'), null);

{
  const local = new Date(2026, 0, 15, 13, 30);
  for (const locale of ['nl', 'en', 'ja', 'ar', 'fa', 'zh']) {
    const t12 = formatLocalDateTime(local, locale, '12h');
    const t24 = formatLocalDateTime(local, locale, '24h');
    eq(`lokaal ${locale} 12h eindigt op 1:30 PM`, t12.endsWith(' 1:30 PM'), true);
    eq(`lokaal ${locale} 24h eindigt op 13:30`, t24.endsWith(' 13:30'), true);
    eq(`lokaal ${locale} alleen Latijnse cijfers`, /[\u0660-\u0669\u06F0-\u06F9]/.test(t12), false);
    eq(`lokaal ${locale} bevat 2026`, t12.includes('2026'), true);
  }
}

eq('blok: einde 17:00 ⇒ veld', bandEndField(1020), { minutes: 1020, nextDay: false });
eq('blok: einde 24:00 ⇒ veld 1440, geen volgende dag', bandEndField(1440), { minutes: 1440, nextDay: false });
eq('blok: nachtblok 06:00 ⇒ veld 360 + volgende dag', bandEndField(1800), { minutes: 360, nextDay: true });
eq('blok: veld 17:00 ⇒ einde', bandEndFromField(1020, false), 1020);
eq('blok: veld 24:00 ⇒ middernacht', bandEndFromField(1440, false), 1440);
eq('blok: stap omlaag vanaf 24:00 ⇒ 23:45 dezelfde dag', bandEndFromField(1440 - 15, bandEndField(1440).nextDay), 1425);
eq('blok: nachtblok veld 06:00 ⇒ 1800', bandEndFromField(360, true), 1800);
eq('blok na edit: 22:00–24:00, typ 02:00 ⇒ 1560 (volgende dag)', bandEndAfterEdit(1320, 120, false), 1560);
eq('blok na edit: einde gelijk aan begin ⇒ volgende dag', bandEndAfterEdit(480, 480, false), 1920);
eq('blok na edit: 08:00, typ 17:00 ⇒ 1020', bandEndAfterEdit(480, 1020, false), 1020);
eq('blok na edit: 24:00 blijft 1440', bandEndAfterEdit(960, 1440, false), 1440);
eq('blok na edit: nachtblok, typ 24:00 ⇒ 1440', bandEndAfterEdit(1320, 1440, true), 1440);
eq('blok na edit: nachtblok, typ 0:00 ⇒ 1440', bandEndAfterEdit(1320, 0, true), 1440);
eq('blok na edit: nachtblok, typ 05:00 ⇒ 1740', bandEndAfterEdit(1320, 300, true), 1740);
eq('blok na edit: stap omlaag vanaf 24:00 ⇒ 1425', bandEndAfterEdit(960, 1425, false), 1425);
eq('blok na edit: nachtblok 22:00–06:00, typ 23:00 ⇒ 1380 (geen 25 uur)', bandEndAfterEdit(1320, 1380, true), 1380);
eq('blok na edit: 22:00, typ 02:00 ⇒ 1560', bandEndAfterEdit(1320, 120, false), 1560);
eq('blok na edit: 22:00, typ 24:00 ⇒ 1440 (dag)', bandEndAfterEdit(1320, 1440, false), 1440);
eq('blok na edit: 22:00, typ 24:00 ⇒ 1440 (nachtblok)', bandEndAfterEdit(1320, 1440, true), 1440);
eq('blok na edit: precies 24 uur blijft (08:00 tot 08:00 volgende dag)', bandEndAfterEdit(480, 480, true), 1920);
for (const start of [0, 420, 1320, 1425]) for (const typed of [0, 60, 420, 1380, 1425, 1440]) for (const nd of [false, true]) {
  const end = bandEndAfterEdit(start, typed, nd);
  eq(`blok na edit: ${start}/${typed}/${nd} ⇒ lengte 1..1440`, end - start > 0 && end - start <= 1440, true);
}
for (const end of [60, 1020, 1425, 1440, 1441, 1800, 2879]) {
  const f = bandEndField(end);
  eq(`blok: rondgang einde ${end}`, bandEndFromField(f.minutes, f.nextDay), end);
}

{
  const project = { ...createDefaultProject(), id: 'proj-tn', calendarId: 'cal-tn', startDate: '2026-01-05' };
  const roundTrip = (cal: WorkCalendar): WorkCalendar => readIFC(writeIFC({
    project, calendar: cal, tasks: [], sequences: [], resources: [], assignments: [],
  })).calendar;
  const facts = (c: WorkCalendar) => ({ byWeekday: c.workTime?.byWeekday, hoursPerDay: c.hoursPerDay, workDays: [...c.workDays] });
  const mk = (name: string, workTime: WorkTimeBands, hoursPerDay: number, start: number, end: number): WorkCalendar => ({
    id: 'cal-tn', name, description: '', holidays: [], workTime, hoursPerDay, workStartHour: start, workEndHour: end,
    workDays: ([1, 2, 3, 4, 5, 6, 7] as const).filter(d => workTime.byWeekday[d].length > 0),
  });
  const mixed: WorkTimeBands = { byWeekday: {
    1: [{ start: 960, end: 1440 }], 2: [{ start: 1320, end: 1800 }], 3: [{ start: 960, end: 1425 }],
    4: [{ start: 480, end: 720 }, { start: 780, end: 1440 }], 5: [{ start: 1320, end: 1800 }], 6: [], 7: [],
  } };
  const late: WorkTimeBands = { byWeekday: {
    1: [{ start: 840, end: 1440 }], 2: [{ start: 840, end: 1440 }], 3: [{ start: 840, end: 1440 }],
    4: [{ start: 840, end: 1440 }], 5: [{ start: 840, end: 1440 }], 6: [], 7: [],
  } };
  for (const cal of [
    mk('24:00, 23:45 en nachtblok', mixed, deriveHoursPerDay(mixed, 8), 16, 24),
    mk('Late ploeg (hoursPerDay 8 bij 10 klokuren)', late, 8, 14, 24),
  ]) {
    const rt1 = roundTrip(cal);
    eq(`IFC ${cal.name}: workTime en hoursPerDay na opslaan en heropenen`, facts(rt1), facts(cal));
    eq(`IFC ${cal.name}: tweede round-trip gelijk`, facts(roundTrip({ ...rt1, id: cal.id })), facts(cal));
  }
}

const descriptor = SETTINGS.find(d => d.field === 'timeNotation');
eq('instelling: descriptor bestaat met sleutel timeNotation', descriptor?.key, 'timeNotation');
eq('instelling: 12h geldig', descriptor?.parse('12h'), '12h');
eq('instelling: 24h geldig', descriptor?.parse('24h'), '24h');
eq('instelling: onzin ⇒ undefined (default blijft)', descriptor?.parse('ampm'), undefined);
eq('instelling: default in de store is 24 uur', useAppStore.getState().ui.timeNotation, '24h');

if (diffs.length === 0) {
  console.log(`OK  tijdnotatie-check: alle checks groen (${count})`);
  process.exit(0);
} else {
  console.log(`XX  tijdnotatie-check: ${diffs.length} afwijking(en)`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
