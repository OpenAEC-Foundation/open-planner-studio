import './domStub';
// MSPDI: een werkende uitzondering van een hele dag (`00:00:00`–`00:00:00`) rekent vóór en ná een
// IFC-rondgang gelijk (bevinding 2026-10-19, Miraya.xml uit de Asta-exports).
//
// MS Project en Asta schrijven een werkende uitzondering van 24 uur als `<FromTime>00:00:00</FromTime>`
// `<ToTime>00:00:00</ToTime>`. De MSPDI-lezer maakte daar de band `{ start: 0, end: 0 }` van: nul
// werkminuten in de uurrekening. De IFC-lezer canoniseert dezelfde band bij het teruglezen naar
// `{ 0, 1440 }` (`end ≤ start` ⇒ `+1440`, zie `WorkingException.bands` in `types/calendar.ts`). F5 gaf
// daardoor ná opslaan als IFC en heropenen een andere planning dan ervóór: in Miraya.xml 64 taken, één
// mijlpaal van 23-01-2027 naar 08-06-2027. Nu levert de MSPDI-lezer de canonieke vorm, net als de
// werkweek (`canonicalizeBands`), de P6 XML-, XER- en `.mpp`-lezer.
//
//  §1 lezer: hele dag (`<Exceptions>`-vorm en de oude `DayType 0`-vorm) ⇒ `{0, 1440}`; een nachtband
//     22:00–06:00 ⇒ `{1320, 1800}`; een gewone band blijft zoals hij is.
//  §2 rekenen: een taak van 24 werkuren vanaf vrijdag 08:00 eindigt op de werkende zaterdag om 16:00
//     (8 u vrijdag + 16 u zaterdag), niet pas op dinsdag.
//  §3 rondgang door de echte open- en opslaanroute (store): de kalenders zijn gelijk na opslaan als IFC
//     en heropenen, en F5 geeft vóór en ná dezelfde datums voor elke taak.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import type { DocumentPayload } from '@/state/documentContract';
import type { OpenedImport } from '@/services/importTypes';
import type { WorkCalendar } from '@/types/calendar';
import { installDOMParser } from './xmldom-shim';

declare const process: { exit(code: number): never };

installDOMParser();

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want)}\n        kreeg    ${JSON.stringify(got)}`);
  }
}

// ── Bouwstenen ─────────────────────────────────────────────────────────────────────────────────
const WT = '<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime>'
  + '<WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>';
const times = (pairs: [string, string][]) => '<WorkingTimes>'
  + pairs.map(([f, t]) => `<WorkingTime><FromTime>${f}</FromTime><ToTime>${t}</ToTime></WorkingTime>`).join('')
  + '</WorkingTimes>';
/** Werkweek ma–vr 08–12 + 13–17 (MSP-DayType 1 = zondag … 7 = zaterdag); `extra` komt erbij in
 *  `<WeekDays>` (de oude uitzonderingsvorm). */
const week = (extra = '') => '<WeekDays>'
  + [1, 2, 3, 4, 5, 6, 7].map((d) => (d >= 2 && d <= 6
    ? `<WeekDay><DayType>${d}</DayType><DayWorking>1</DayWorking>${WT}</WeekDay>`
    : `<WeekDay><DayType>${d}</DayType><DayWorking>0</DayWorking></WeekDay>`)).join('')
  + extra + '</WeekDays>';
const exc = (date: string, name: string, wt: string) =>
  `<Exception><EnteredByOccurrences>0</EnteredByOccurrences><TimePeriod><FromDate>${date}T00:00:00</FromDate>`
  + `<ToDate>${date}T23:59:00</ToDate></TimePeriod><Occurrences>1</Occurrences><Name>${name}</Name><Type>1</Type>`
  + `<DayWorking>1</DayWorking>${wt}</Exception>`;
/** De oude vorm (Project 2003, ook Asta): `<WeekDay>` met `DayType` 0 en een `<TimePeriod>`. */
const legacyDay = (date: string, wt: string) =>
  `<WeekDay><DayType>0</DayType><DayWorking>1</DayWorking><TimePeriod><FromDate>${date}T00:00:00</FromDate>`
  + `<ToDate>${date}T23:59:59</ToDate></TimePeriod>${wt}</WeekDay>`;
const cal = (uid: number, name: string, body: string) =>
  `<Calendar><UID>${uid}</UID><Name>${name}</Name><IsBaseCalendar>1</IsBaseCalendar><BaseCalendarUID>-1</BaseCalendarUID>${body}</Calendar>`;
/** Taak van `hours` werkuren vanaf vrijdag 23 oktober 2026 08:00 (SNET), op kalender `calUid`. */
const task = (uid: number, name: string, calUid: number, hours: number) =>
  `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name><OutlineLevel>1</OutlineLevel><CalendarUID>${calUid}</CalendarUID>`
  + `<Duration>PT${hours}H0M0S</Duration><Start>2026-10-23T08:00:00</Start><Finish>2026-10-24T16:00:00</Finish>`
  + '<ConstraintType>4</ConstraintType><ConstraintDate>2026-10-23T08:00:00</ConstraintDate></Task>';

const HELE_DAG = times([['00:00:00', '00:00:00']]);
const XML = '<?xml version="1.0" encoding="UTF-8"?><Project xmlns="http://schemas.microsoft.com/project">'
  + '<Name>Hele dag</Name><StartDate>2026-10-19T08:00:00</StartDate><CalendarUID>1</CalendarUID><MinutesPerDay>480</MinutesPerDay>'
  + '<Calendars>'
  // Nieuwe vorm: zaterdag 24 oktober werkt de hele dag; zaterdag 31 oktober een nachtband; zaterdag
  // 7 november een gewone band.
  + cal(1, 'Nieuw', week() + '<Exceptions>'
    + exc('2026-10-24', 'Hele dag', HELE_DAG)
    + exc('2026-10-31', 'Nacht', times([['22:00:00', '06:00:00']]))
    + exc('2026-11-07', 'Ochtend', times([['08:00:00', '12:00:00']]))
    + '</Exceptions>')
  // Oude vorm: dezelfde hele zaterdag als `DayType 0` (geen `<Exceptions>`).
  + cal(2, 'Oud', week(legacyDay('2026-10-24', HELE_DAG)))
  + '</Calendars><Tasks>'
  + task(1, 'Over de werkende zaterdag (nieuw)', 1, 24)
  + task(2, 'Over de werkende zaterdag (oud)', 2, 24)
  + '</Tasks></Project>';

const byName = (cals: WorkCalendar[], name: string): WorkCalendar | undefined => cals.find((c) => c.name === name);
const bandsOf = (c: WorkCalendar | undefined) =>
  (c?.workingExceptions ?? []).map((w) => [w.startDate, (w.bands ?? []).map((b) => [b.start, b.end])]);

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §1 De lezer levert de canonieke vorm
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const r = readMSPDI(XML);
  const cals = [r.calendar, ...(r.resourceCalendars ?? [])];
  same('§1 voorwaarde: kalender "Nieuw" is een uurkalender (de banden tellen mee in de rekening)',
    Boolean(byName(cals, 'Nieuw')?.workTime), true);
  same('§1 <Exceptions>: hele dag ⇒ 0–1440, nachtband ⇒ 1320–1800, gewone band ongewijzigd', bandsOf(byName(cals, 'Nieuw')), [
    ['2026-10-24', [[0, 1440]]],
    ['2026-10-31', [[1320, 1800]]],
    ['2026-11-07', [[480, 720]]],
  ]);
  same('§1 oude DayType 0-vorm: hele dag ⇒ 0–1440', bandsOf(byName(cals, 'Oud')), [['2026-10-24', [[0, 1440]]]]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §2 + §3 De echte open- en opslaanroute: F5 vóór en ná een IFC-rondgang
// ════════════════════════════════════════════════════════════════════════════════════════════════
const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
function openAndRecalc(parsed: OpenedImport): DocumentPayload {
  const store = createAppStoreContext().store;
  store.getState().applyOpenedImport(parsed, OPEN);
  store.getState().runCPM(); // F5
  return store.getState().getOpenDocumentPayloads()[0].payload;
}
const dates = (p: DocumentPayload) => Object.fromEntries(p.tasks.map((t) => [t.name, [t.time.earlyStart, t.time.earlyFinish]]));
const calView = (p: DocumentPayload) => Object.fromEntries([p.calendar, ...p.calendars]
  .map((c) => [c.name, { workDays: c.workDays, hoursPerDay: c.hoursPerDay, exceptions: bandsOf(c) }]));
{
  const before = openAndRecalc(await parseOpenedFile({ name: 'hele-dag.xml', text: XML }));
  // §2: 8 u op vrijdag 23 oktober, dan 16 u op de werkende zaterdag ⇒ klaar zaterdag 16:00. Met de oude
  // band `{0, 0}` telde de zaterdag nul uur en liep de taak door tot dinsdag 27 oktober.
  same('§2 F5 na MSPDI-import: de werkende zaterdag telt 24 uur', dates(before), {
    'Over de werkende zaterdag (nieuw)': ['2026-10-23T08:00', '2026-10-24T16:00'],
    'Over de werkende zaterdag (oud)': ['2026-10-23T08:00', '2026-10-24T16:00'],
  });
  const ifc = writeIFC(buildWriteIFCInput(before));
  const after = openAndRecalc(await parseOpenedFile({ name: 'hele-dag.ifc', text: ifc }));
  same('§3 kalenders gelijk na opslaan als IFC en heropenen', calView(after), calView(before));
  same('§3 F5 ná de IFC-rondgang = F5 ervóór', dates(after), dates(before));
  // Tweede ronde: de canonieke vorm is een vast punt.
  const again = openAndRecalc(await parseOpenedFile({ name: 'hele-dag-2.ifc', text: writeIFC(buildWriteIFCInput(after)) }));
  same('§3 tweede rondgang: kalenders en F5 ongewijzigd', [calView(again), dates(again)], [calView(before), dates(before)]);
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  ${f}`);
  console.log(`XX  check-mspdi-uitzondering-hele-dag: ${failures.length} van ${checks} controles mislukt`);
  process.exit(1);
}
console.log(`OK  check-mspdi-uitzondering-hele-dag: ${checks} controles groen`);
