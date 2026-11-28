import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import type { ImportResult } from '@/services/importTypes';
import { solveProject } from '@/engine/scheduler/solveProject';
import { opsSolveInput } from './legacySolveOptions';
import { installDOMParser } from './xmldom-shim';

declare const process: { exitCode?: number };
installDOMParser();

const fails: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
function p6File(opts: { start: string; finish: string; hpd: number; hours: number; plannedFinish: string; exceptions?: string }): string {
  const week = WEEKDAYS.map(d => `<StandardWorkHours><DayOfWeek>${d}</DayOfWeek><WorkTime><Start>${opts.start}</Start><Finish>${opts.finish}</Finish></WorkTime></StandardWorkHours>`).join('')
    + ['Saturday', 'Sunday'].map(d => `<StandardWorkHours><DayOfWeek>${d}</DayOfWeek><WorkTime xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/></StandardWorkHours>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V8.3/API/BusinessObjects">
  <Calendar><HoursPerDay>${opts.hpd}</HoursPerDay><Name>Bouw</Name><ObjectId>1</ObjectId><Type>Global</Type>
    <StandardWorkWeek>${week}</StandardWorkWeek>${opts.exceptions ?? ''}</Calendar>
  <Project><ActivityDefaultCalendarObjectId>1</ActivityDefaultCalendarObjectId><Id>P1</Id><Name>Kalender</Name><ObjectId>10</ObjectId>
    <PlannedStartDate>2026-03-02T${opts.start}</PlannedStartDate>
    <Activity><CalendarObjectId>1</CalendarObjectId><Id>A1</Id><Name>Taak</Name><ObjectId>100</ObjectId>
      <PlannedDuration>${opts.hours}</PlannedDuration><PlannedFinishDate>${opts.plannedFinish}</PlannedFinishDate>
      <PlannedStartDate>2026-03-02T${opts.start}</PlannedStartDate><ProjectObjectId>10</ProjectObjectId><Status>Not Started</Status></Activity>
  </Project>
</APIBusinessObjects>`;
}

function solvedFinish(xml: string): { band: unknown; finish: string | undefined; error?: string } {
  const r = readP6XML(xml);
  const res = solveProject(opsSolveInput({ tasks: r.tasks, sequences: r.sequences, calendar: r.calendar, calendars: r.resourceCalendars ?? [], projectStartDate: r.project.startDate }));
  const task = r.tasks.find(t => t.wbsCode === 'A1');
  return { band: r.calendar.workTime?.byWeekday[1] ?? [r.calendar.workStartHour, r.calendar.workEndHour], finish: task?.time.earlyFinish, error: res.error };
}

{
  const got = solvedFinish(p6File({ start: '08:00:00', finish: '16:29:00', hpd: 8.5, hours: 42.5, plannedFinish: '2026-03-06T16:30:00' }));
  eq('1a 08:00–16:29 ⇒ blok tot 16:30', got.band, [{ start: 480, end: 990 }]);
  eq('1a einde na herberekenen = vrijdag 16:30', [got.finish, got.error], ['2026-03-06T16:30', undefined]);
}
{
  const got = solvedFinish(p6File({ start: '07:30:00', finish: '16:29:00', hpd: 9, hours: 45, plannedFinish: '2026-03-06T16:30:00' }));
  eq('1b 07:30–16:29 ⇒ blok 07:30–16:30', got.band, [{ start: 450, end: 990 }]);
  eq('1b einde na herberekenen = vrijdag 16:30', got.finish, '2026-03-06T16:30');
}
{
  const got = solvedFinish(p6File({ start: '07:00:00', finish: '15:29:00', hpd: 8.5, hours: 42.5, plannedFinish: '2026-03-06T15:30:00' }));
  eq('1c 07:00–15:29 ⇒ blok 07:00–15:30', got.band, [{ start: 420, end: 930 }]);
  eq('1c einde na herberekenen = vrijdag 15:30', got.finish, '2026-03-06T15:30');
}
{
  const exception = '<HolidayOrExceptions><HolidayOrException><Date>2026-03-04T00:00:00</Date><WorkTime><Start>00:00:00</Start><Finish>23:59:00</Finish></WorkTime></HolidayOrException></HolidayOrExceptions>';
  const r = readP6XML(p6File({ start: '08:00:00', finish: '16:00:00', hpd: 8, hours: 8, plannedFinish: '2026-03-02T16:00:00', exceptions: exception }));
  eq('1d exact 16:00 blijft 16:00', [r.calendar.workStartHour, r.calendar.workEndHour], [8, 16]);
  eq('1d 00:00–23:59 blijft een vrije dag', r.calendar.holidays.map(h => h.startDate), ['2026-03-04']);
}
{
  const r = readP6XML(p6File({ start: '07:30:00', finish: '16:30:00', hpd: 9, hours: 9, plannedFinish: '2026-03-02T16:30:00' }));
  eq('1e exact 16:30 blijft 16:30', r.calendar.workTime?.byWeekday[1], [{ start: 450, end: 990 }]);
}

function roundTrip(r: ImportResult): { xml: string; back: ImportResult } {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const xml = writeP6XML(r.project, r.calendar, r.tasks, r.sequences, r.resources, r.assignments, r.resourceCalendars ?? []);
    return { xml, back: readP6XML(xml) };
  } finally { console.warn = warn; }
}

{
  const src = readP6XML(p6File({ start: '08:00:00', finish: '15:59:00', hpd: 8, hours: 8, plannedFinish: '2026-03-02T16:00:00' }));
  src.calendar.workingExceptions = [
    { name: 'Doorwerken', startDate: '2026-03-07', endDate: '2026-03-07', bands: [{ start: 0, end: 1440 }] },
    { name: 'Lange dag', startDate: '2026-03-08', endDate: '2026-03-08', bands: [{ start: 360, end: 720 }, { start: 720, end: 1320 }] },
  ];
  const { xml, back } = roundTrip(src);
  eq('3a geen blok 00:00–23:59 in de export', /<Start>00:00:00<\/Start>\s*<Finish>23:59:00<\/Finish>/.test(xml), false);
  eq('3b 24 uur blijft een werkende uitzondering', (back.calendar.workingExceptions ?? []).map(w => [w.startDate, w.bands]),
    [['2026-03-07', [{ start: 0, end: 1440 }]], ['2026-03-08', [{ start: 360, end: 1320 }]]]);
  eq('3c en wordt geen feestdag', back.calendar.holidays.map(h => h.startDate), []);
}

{
  const day = (date: string, work = '') => `<HolidayOrException><Date>${date}T00:00:00</Date>${work || '<WorkTime xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>'}</HolidayOrException>`;
  const wt = (s: string, f: string) => `<WorkTime><Start>${s}</Start><Finish>${f}</Finish></WorkTime>`;
  const exceptions = '<HolidayOrExceptions>'
    + day('2026-07-27') + day('2026-07-28') + day('2026-07-29')
    + day('2026-07-31')
    + day('2026-08-01', wt('08:00:00', '12:59:00')) + day('2026-08-02', wt('08:00:00', '12:59:00'))
    + day('2026-08-03', wt('08:00:00', '15:59:00'))
    + '</HolidayOrExceptions>';
  const r = readP6XML(p6File({ start: '08:00:00', finish: '15:59:00', hpd: 8, hours: 8, plannedFinish: '2026-03-02T16:00:00', exceptions }));
  eq('4a vrije dagen: reeks + losse dag', r.calendar.holidays.map(h => [h.name, h.startDate, h.endDate]),
    [['Holiday', '2026-07-27', '2026-07-29'], ['Holiday', '2026-07-31', '2026-07-31']]);
  eq('4b werkende dagen: alleen bij gelijke werktijd samen', (r.calendar.workingExceptions ?? []).map(w => [w.name, w.startDate, w.endDate]),
    [['Working exception', '2026-08-01', '2026-08-02'], ['Working exception', '2026-08-03', '2026-08-03']]);
}

if (fails.length > 0) {
  for (const f of fails) console.log(`XX  p6xml-calendar-rules: ${f}`);
  process.exitCode = 1;
} else {
  console.log(`OK  p6xml-calendar-rules: ${checks} controles groen`);
}
