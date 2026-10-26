import './domStub';
// MSPDI: de werktijd van een kalender komt op de minuut en mét pauze heen en terug (review PR #384,
// 2026-10-19; 0402ScheduleMSP.xml).
//
// Wat er mis was:
//  - De lezer las de blokken van `<WeekDays><WeekDay><WorkingTimes>` al op de minuut (`clockToMinutes`),
//    maar de enkelvoudige werkdag (`workStartHour`/`workEndHour`, en daaruit `hoursPerDay`) kwam uit het
//    uurdeel van de kloktijd: 07:30–16:00 werd 7–16 met 9 uur per dag.
//  - De schrijver zette voor een dagkalender één blok begin–einde; de pauze viel weg. MSPDI kent
//    `<MinutesPerDay>` alleen voor de projectkalender, dus een bibliotheekkalender van 07:00–16:00 met
//    8 uur kwam terug met 9 uur per dag, en een dagtaak van 20 d werd 18 d. Nu schrijft hij de effectieve
//    blokken (met de pauze), zoals MS Project zelf, en leest de lezer twee gelijke blokken per werkdag
//    in een eigen export (OPS-marker) terug als dagkalender met pauze.
//  - Een kalender met per werkdag een ander blok (0402: zondag en zaterdag 00:08–00:16, ma–vr
//    08:00–16:00) werd een dagkalender met de werktijd van zondag op alle zeven dagen. Nu een
//    uurkalender met de blokken per dag. De scalaire werkdag blijft de eerste werkdag in MS
//    Project-volgorde (`SCALAR_DAY_ORDER`, zondag eerst), ook als het bestand maandag eerst zet.
//  - Een oudere eigen export schreef 07:30 als `7.5:00:00`; de terugval leest dat nu als 7,5.
//
//  §1 lezer: één blok op de minuut; per dag verschillend ⇒ uurkalender; hele uren, nachtblok, 24 uur en
//     een bestand van MS Project met twee blokken ongewijzigd; de terugval `7.5:00:00`.
//  §2 rekenen: 90 werkuren op een kalender van 8,5 uur per dag eindigen maandag 13:00.
//  §3 rondgang van een MSPDI-bestand via de store: kalenders en F5 gelijk na opslaan en heropenen.
//  §4 rondgang van een eigen document met een bibliotheek-dagkalender (met en zonder pauze): MSPDI ⇒
//     MSPDI (twee keer) en IFC ⇒ heropenen geven dezelfde werktijd, uren per dag, modus en F5.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { getCalendarBands } from '@/services/subdayIo';
import { effectiveWorkTimeBands } from '@/utils/effectiveWorkTime';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { DocumentPayload } from '@/state/documentContract';
import type { ImportResult, OpenedImport } from '@/services/importTypes';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Project } from '@/types/project';
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
function quiet<T>(fn: () => T): T {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
}

// ── Bouwstenen ─────────────────────────────────────────────────────────────────────────────────
/** Werkweek met per MSP-DayType (1 = zondag … 7 = zaterdag) een lijst blokken, of vrij. */
const week = (perDay: Record<number, [string, string][] | undefined>) => '<WeekDays>'
  + [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const blocks = perDay[d];
    return blocks
      ? `<WeekDay><DayType>${d}</DayType><DayWorking>1</DayWorking><WorkingTimes>`
        + blocks.map(([f, t]) => `<WorkingTime><FromTime>${f}</FromTime><ToTime>${t}</ToTime></WorkingTime>`).join('')
        + '</WorkingTimes></WeekDay>'
      : `<WeekDay><DayType>${d}</DayType><DayWorking>0</DayWorking></WeekDay>`;
  }).join('') + '</WeekDays>';
const maVr = (...blocks: [string, string][]) => ({ 2: blocks, 3: blocks, 4: blocks, 5: blocks, 6: blocks } as Record<number, [string, string][]>);
const cal = (uid: number, name: string, body: string) =>
  `<Calendar><UID>${uid}</UID><Name>${name}</Name><IsBaseCalendar>1</IsBaseCalendar><BaseCalendarUID>-1</BaseCalendarUID>${body}<Exceptions/></Calendar>`;
/** Taak van `hours` werkuren vanaf maandag 19 oktober 2026 08:00 op kalender `calUid`. Begin en einde op
 *  het dag-anker 08:00, zodat alleen de duur beslist of het een urentaak is. */
const task = (uid: number, name: string, calUid: number, hours: number, finishDate: string) =>
  `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name><OutlineLevel>1</OutlineLevel><CalendarUID>${calUid}</CalendarUID>`
  + `<Duration>PT${hours}H0M0S</Duration><Start>2026-10-19T08:00:00</Start><Finish>${finishDate}T08:00:00</Finish></Task>`;

const XML = '<?xml version="1.0" encoding="UTF-8"?><Project xmlns="http://schemas.microsoft.com/project">'
  + '<Name>Werktijd op de minuut</Name><StartDate>2026-10-19T08:00:00</StartDate><CalendarUID>1</CalendarUID>'
  + '<MinutesPerDay>480</MinutesPerDay><Calendars>'
  // De kalender "global" uit 0402ScheduleMSP.xml: zondag eerst, met een blok van 8 minuten.
  + cal(1, 'Weekend kort', week({ ...maVr(['08:00:00', '16:00:00']), 1: [['00:08:00', '00:16:00']], 7: [['00:08:00', '00:16:00']] }))
  + cal(2, 'Halfuur', week(maVr(['07:30:00', '16:00:00'])))
  + cal(3, 'Halfuur uren', week(maVr(['07:30:00', '16:00:00'])))
  + cal(4, 'Kwartier', week(maVr(['08:15:00', '16:45:00'])))
  // Ongewijzigd gedrag: hele uren, een nachtblok over middernacht, een hele dag, en de standaardkalender
  // van MS Project (twee blokken, geen OPS-marker ⇒ uurkalender, zoals de `.mpp`-lezer).
  + cal(5, 'Hele uren', week(maVr(['07:00:00', '16:00:00'])))
  + cal(6, 'Nacht', week(maVr(['22:00:00', '06:00:00'])))
  + cal(7, '24 uur', week({ ...maVr(['00:00:00', '00:00:00']), 1: [['00:00:00', '00:00:00']], 7: [['00:00:00', '00:00:00']] }))
  + cal(8, 'MS Project standaard', week(maVr(['08:00:00', '12:00:00'], ['13:00:00', '17:00:00'])))
  // Een oudere eigen export schreef 07:30 als `7.5:00:00` (geen geldige kloktijd ⇒ geen blok).
  + cal(9, 'Oude export', week(maVr(['7.5:00:00', '16:00:00'])))
  + '</Calendars><Tasks>'
  // 85 u = precies 10 dagen van 8,5 u ⇒ dagtaak, 10 werkdagen.
  + task(1, 'Dagtaak halfuur', 2, 85, '2026-10-30')
  // 90 u = 10 dagen en 5 u van 8,5 u ⇒ urentaak. Met 9 u per dag was het precies 10 dagen.
  + task(2, 'Urentaak halfuur', 3, 90, '2026-11-02')
  + '</Tasks></Project>';

const byName = (cals: WorkCalendar[], name: string): WorkCalendar => {
  const c = cals.find((x) => x.name === name);
  if (!c) throw new Error(`kalender ${name} ontbreekt`);
  return c;
};
/** Werkdagen, begin en einde in minuten (geen afrondingsruis van 8/60 uur), uren per dag, modus. */
const scalar = (c: WorkCalendar) => ({
  workDays: c.workDays, start: Math.round(c.workStartHour * 60), end: Math.round(c.workEndHour * 60),
  hoursPerDay: c.hoursPerDay, uurkalender: !!c.workTime,
});
const blocks = (c: WorkCalendar | undefined, wd: 1 | 2 | 3 | 4 | 5 | 6 | 7) =>
  (c && effectiveWorkTimeBands(c)?.byWeekday[wd] || []).map((b) => `${b.start}-${b.end}`);

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §1 De lezer
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const r = readMSPDI(XML);
  const cals = [r.calendar, ...(r.resourceCalendars ?? [])];
  // Per werkdag een ander blok ⇒ uurkalender met de blokken per dag; die rekenen (de effectieve blokken
  // zijn de blokken, ook voor een urentaak op de projectkalender). Uren per dag 8 uit `<MinutesPerDay>`.
  // De scalaire werkdag volgt de vaste regel (eerste werkdag in MS Project-volgorde: zondag, 00:08–00:16);
  // bij een uurkalender rekent hij niet mee.
  const weekend = byName(cals, 'Weekend kort');
  same('§1 "Weekend kort": uurkalender, 8 uur per dag', scalar(weekend),
    { workDays: [1, 2, 3, 4, 5, 6, 7], start: 8, end: 16, hoursPerDay: 8, uurkalender: true });
  same('§1 "Weekend kort": de blokken per dag op de minuut (ma, za, zo)',
    [blocks(weekend, 1), blocks(weekend, 6), blocks(weekend, 7)], [['480-960'], ['8-16'], ['8-16']]);
  same('§1 "Halfuur": 07:30–16:00 met 8,5 uur per dag (was 7–16 met 9)', scalar(byName(cals, 'Halfuur')),
    { workDays: [1, 2, 3, 4, 5], start: 450, end: 960, hoursPerDay: 8.5, uurkalender: false });
  same('§1 "Kwartier": 08:15–16:45 met 8,5 uur per dag (was 8–16 met 8)', scalar(byName(cals, 'Kwartier')),
    { workDays: [1, 2, 3, 4, 5], start: 495, end: 1005, hoursPerDay: 8.5, uurkalender: false });
  same('§1 "Hele uren": 07:00–16:00 ongewijzigd', scalar(byName(cals, 'Hele uren')),
    { workDays: [1, 2, 3, 4, 5], start: 420, end: 960, hoursPerDay: 9, uurkalender: false });
  same('§1 "Nacht": 22:00–06:00 ⇒ 22–30, uurkalender, ongewijzigd', scalar(byName(cals, 'Nacht')),
    { workDays: [1, 2, 3, 4, 5], start: 1320, end: 1800, hoursPerDay: 8, uurkalender: true });
  same('§1 "24 uur": 00:00–00:00 ⇒ 0–24, uurkalender, ongewijzigd', scalar(byName(cals, '24 uur')),
    { workDays: [1, 2, 3, 4, 5, 6, 7], start: 0, end: 1440, hoursPerDay: 24, uurkalender: true });
  same('§1 MS Project-bestand met 08:00–12:00 + 13:00–17:00: uurkalender, ongewijzigd',
    [scalar(byName(cals, 'MS Project standaard')), byName(cals, 'MS Project standaard').simpleBreakDurationMinutes],
    [{ workDays: [1, 2, 3, 4, 5], start: 480, end: 1020, hoursPerDay: 8, uurkalender: true }, undefined]);
  same('§1 terugval: een oude eigen export `7.5:00:00` ⇒ 7,5 (was 7)', scalar(byName(cals, 'Oude export')),
    { workDays: [1, 2, 3, 4, 5], start: 450, end: 960, hoursPerDay: 8.5, uurkalender: false });
  same('§1 T15: 85 u en 90 u zijn urentaken, ook zonder subdagsignaal',
    r.tasks.map((t) => [t.name, t.time.durationUnit, t.time.scheduleDuration]),
    [['Dagtaak halfuur', 'hours', 10], ['Urentaak halfuur', 'hours', 90 / 8.5]]);
  same('§1 de geregistreerde blokken van "Weekend kort" zijn de bron (za/zo 8 minuten)',
    getCalendarBands(weekend)?.canonical.byWeekday[7], [{ start: 8, end: 16 }]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §2 + §3 De echte open- en exportroute voor het MSPDI-bestand hierboven
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
  .map((c) => [c.name, { ...scalar(c), ma: blocks(c, 1), za: blocks(c, 6) }]));
const exportMSPDI = (p: DocumentPayload) => quiet(() => writeMSPDI(p.project, p.calendar, p.tasks, p.sequences,
  p.resources, p.assignments, p.calendars, p.baselines, p.activeBaselineId, p.customTaskTypes));
const exportIFC = (p: DocumentPayload) => quiet(() => writeIFC(buildWriteIFCInput(p)));
{
  const before = openAndRecalc(await parseOpenedFile({ name: 'werktijd-minuten.xml', text: XML }));
  // §2: T15 maakt ook de taak van 85 u een urentaak. Op de scalaire kalender telt 08:00 nog als
  // daganker: de solve begint om 07:30 en eindigt na 10 werkdagen op 30 oktober 16:00. Het behoud
  // van de brontijd 08:00 valt buiten F5a-1 (datumprecisie, F5b/F2).
  // Urentaak: ma 19 okt 08:00–16:00 (8 u), di–vr 4 × 8,5 u, de week erna 5 × 8,5 u = 84,5 u op vrijdag
  // 30 oktober 16:00; de laatste 5,5 u op maandag 2 november van 07:30 tot 13:00. Met 9 u per dag was het
  // een dagtaak die vrijdag 30 oktober eindigde.
  same('§2 F5 na MSPDI-import', dates(before), {
    'Dagtaak halfuur': ['2026-10-19T07:30', '2026-10-30T16:00'],
    'Urentaak halfuur': ['2026-10-19T08:00', '2026-11-02T13:00'],
  });

  const xml = exportMSPDI(before);
  const fromTimes = [...xml.matchAll(/<FromTime>([^<]*)<\/FromTime>/g)].map((m) => m[1]);
  same('§3 schrijver: elke <FromTime> is een geldige kloktijd HH:MM:SS', fromTimes.filter((t) => !/^\d\d:\d\d:\d\d$/.test(t)), []);
  same('§3 schrijver: de dagkalender "Halfuur" begint om 07:30:00', fromTimes.includes('07:30:00'), true);

  const after = openAndRecalc(await parseOpenedFile({ name: 'werktijd-minuten-terug.xml', text: xml }));
  // Eén bekende uitzondering: "MS Project standaard" (uurkalender met twee gelijke blokken per werkdag,
  // zonder taken) komt terug als dagkalender met pauze. MSPDI heeft geen veld voor de modus van een
  // kalender; de eigen export van een dagkalender met pauze ziet er precies zo uit. Werktijd, blokken en
  // uren per dag blijven gelijk. Met taken erop blijft hij een uurkalender (§4b).
  const wantAfter = calView(before);
  wantAfter['MS Project standaard'] = { ...wantAfter['MS Project standaard'], uurkalender: false };
  // De nieuwe urentaak houdt na F5 haar echte 07:30/16:00; dat tijdsignaal promoveert de kalender.
  wantAfter['Halfuur'] = { ...wantAfter['Halfuur'], uurkalender: true };
  same('§3 kalenders gelijk; alleen de verklaarde moduswissels voor "MS Project standaard" en "Halfuur"',
    calView(after), wantAfter);
  same('§3 F5 ná de MSPDI-rondgang = F5 ervóór', dates(after), dates(before));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §4 Rondgang van een eigen document: bibliotheek-dagkalender met en zonder pauze
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Dagtaak van 20 d op de bibliotheekkalender en een opvolger van 5 d (FS). Vóór de fix (gemeten door de
// reviewer, 2026-10-19): 07:00–16:00 met 60 min pauze werd na MSPDI 18 d; 08:00–16:30 met 30 min werd
// met PR #384 (eerste ronde) 19 d.
const PROJECT: Project = {
  id: 'p-pauze', name: 'Pauze', description: '', startDate: '2026-11-02', endDate: '2026-12-31',
  calendarId: 'cal-default', createdAt: '2026-11-02T00:00', modifiedAt: '2026-11-02T00:00', author: 'T', company: 'C',
};
const dayTask = (id: string, name: string, days: number, calendarId: string): Task => ({
  id, name, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [],
  time: {
    durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: days,
    scheduleStart: '2026-11-02', scheduleFinish: '2026-11-02', earlyStart: '2026-11-02', earlyFinish: '2026-11-02',
    lateStart: '2026-11-02', lateFinish: '2026-11-02', freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
  },
  resourceIds: [],
  calendarId,
});
const SHAPES: { name: string; cal: Partial<WorkCalendar> }[] = [
  { name: '08:00–16:30, 30 min pauze', cal: { workStartHour: 8, workEndHour: 16.5, hoursPerDay: 8 } },
  { name: '08:00–16:30, pauzevelden 12:00 + 30 min', cal: { workStartHour: 8, workEndHour: 16.5, hoursPerDay: 8, simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 30 } },
  { name: '07:00–15:30, 30 min pauze', cal: { workStartHour: 7, workEndHour: 15.5, hoursPerDay: 8 } },
  { name: '07:30–16:00, 30 min pauze', cal: { workStartHour: 7.5, workEndHour: 16, hoursPerDay: 8 } },
  { name: '07:00–16:00, 60 min pauze (standaard)', cal: { workStartHour: 7, workEndHour: 16, hoursPerDay: 8 } },
  { name: '07:00–16:00, pauzevelden 12:30 + 60 min', cal: { workStartHour: 7, workEndHour: 16, hoursPerDay: 8, simpleBreakStartMinute: 750, simpleBreakDurationMinutes: 60 } },
  { name: '08:00–16:00 zonder pauze', cal: { workStartHour: 8, workEndHour: 16, hoursPerDay: 8 } },
  { name: '07:30–16:00 zonder pauze (8,5 u)', cal: { workStartHour: 7.5, workEndHour: 16, hoursPerDay: 8.5 } },
];
/** Wat telt: de taakduur in dagen, F5, en van de bibliotheekkalender begin, einde, uren per dag, modus
 *  en de effectieve blokken op maandag (met de pauze). De pauzevelden zelf niet: 12:00 + 30 min op
 *  08:00–16:30 komt terug zonder velden (dezelfde blokken, zie `applyCalendarBody`). */
const view = (p: DocumentPayload) => {
  const lib = p.calendars.find((c) => c.name === 'Bouwdag');
  return {
    kalender: lib && { ...scalar(lib), ma: blocks(lib, 1) },
    taken: p.tasks.map((t) => [t.name, t.time.durationUnit, t.time.scheduleDuration, t.time.earlyStart, t.time.earlyFinish]),
  };
};
for (const shape of SHAPES) {
  const lib: WorkCalendar = { ...createDefaultCalendar(), id: 'cal-bouwdag', name: 'Bouwdag', holidays: [], ...shape.cal };
  delete lib.generation;
  const start: ImportResult = {
    project: PROJECT,
    calendar: { ...createDefaultCalendar(), holidays: [] },
    tasks: [dayTask('a', 'Dagtaak 20 d', 20, lib.id), dayTask('b', 'Opvolger 5 d', 5, lib.id)],
    sequences: [{ id: 's1', predecessorId: 'a', successorId: 'b', type: 'FINISH_START', lagDays: 0 }],
    resources: [], assignments: [], resourceCalendars: [lib],
  };
  const original = openAndRecalc(start);
  same(`§4 ${shape.name}: voorwaarde — dagkalender, dagtaak 20 d`, [view(original).kalender?.uurkalender, view(original).taken[0][2]], [false, 20]);
  const viaMspdi = openAndRecalc(await parseOpenedFile({ name: 'pauze.xml', text: exportMSPDI(original) }));
  same(`§4 ${shape.name}: MSPDI ⇒ heropenen gelijk`, view(viaMspdi), view(original));
  // Pauzevelden alleen als de afleiding zonder velden (het verschil rond 12:00) een andere pauze geeft:
  // de standaardkalender komt zonder velden terug, een pauze om 12:30 met.
  const backLib = viaMspdi.calendars.find((c) => c.name === 'Bouwdag');
  same(`§4 ${shape.name}: pauzevelden na MSPDI`,
    [backLib?.simpleBreakStartMinute, backLib?.simpleBreakDurationMinutes],
    shape.cal.simpleBreakStartMinute === 750 ? [750, 60] : [undefined, undefined]);
  const tweedeRonde = openAndRecalc(await parseOpenedFile({ name: 'pauze-2.xml', text: exportMSPDI(viaMspdi) }));
  same(`§4 ${shape.name}: tweede MSPDI-ronde gelijk`, view(tweedeRonde), view(original));
  const viaIfc = openAndRecalc(await parseOpenedFile({ name: 'pauze.ifc', text: exportIFC(viaMspdi) }));
  same(`§4 ${shape.name}: MSPDI ⇒ IFC ⇒ heropenen gelijk`, view(viaIfc), view(original));
}

// §4b Een UURkalender met dezelfde vorm (twee gelijke blokken per werkdag) en dagtaken blijft een
// uurkalender: op een uurkalender dragen de taken kloktijden (07:00, 16:00), en dat is het signaal (c)
// dat de kalender weer uurkalender maakt. Zonder taken wisselt hij wel (zie §3, "MS Project standaard").
{
  const hourLib: WorkCalendar = {
    ...createDefaultCalendar(), id: 'cal-bouwdag', name: 'Bouwdag', holidays: [], workStartHour: 7, workEndHour: 16,
    hoursPerDay: 8, workTime: { byWeekday: { 1: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      2: [{ start: 420, end: 720 }, { start: 780, end: 960 }], 3: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
      4: [{ start: 420, end: 720 }, { start: 780, end: 960 }], 5: [{ start: 420, end: 720 }, { start: 780, end: 960 }], 6: [], 7: [] } },
  };
  delete hourLib.generation;
  const original = openAndRecalc({
    project: PROJECT, calendar: { ...createDefaultCalendar(), holidays: [] },
    tasks: [dayTask('a', 'Dagtaak 20 d', 20, hourLib.id), dayTask('b', 'Opvolger 5 d', 5, hourLib.id)],
    sequences: [{ id: 's1', predecessorId: 'a', successorId: 'b', type: 'FINISH_START', lagDays: 0 }],
    resources: [], assignments: [], resourceCalendars: [hourLib],
  });
  const viaMspdi = openAndRecalc(await parseOpenedFile({ name: 'uurkalender.xml', text: exportMSPDI(original) }));
  const o = view(original);
  same('§4b voorwaarde — uurkalender', o.kalender?.uurkalender, true);
  same('§4b uurkalender met twee gelijke blokken en dagtaken: na MSPDI gelijk (modus, taken en F5)',
    view(viaMspdi), o);
}

// §4c Een dagkalender zonder geldige effectieve blokken (9 uur per dag op een werkdag van 07:30–16:00)
// schrijft één blok begin–einde, op de minuut: `07:30:00`, niet `7.5:00:00`.
{
  const lib: WorkCalendar = { ...createDefaultCalendar(), id: 'cal-bouwdag', name: 'Bouwdag', holidays: [], workStartHour: 7.5, workEndHour: 16, hoursPerDay: 9 };
  delete lib.generation;
  const original = openAndRecalc({
    project: PROJECT, calendar: { ...createDefaultCalendar(), holidays: [] },
    tasks: [dayTask('a', 'Dagtaak 20 d', 20, lib.id)], sequences: [], resources: [], assignments: [], resourceCalendars: [lib],
  });
  // T1 herstelt de oude onmogelijke spanne: 07:30 + 9 u = 16:30.
  same('§4c T1: effectieve blokken na kalenderherstel',
    blocks(original.calendars.find((c) => c.name === 'Bouwdag'), 1), ['450-990']);
  const xml = exportMSPDI(original);
  const bouwdag = xml.slice(xml.indexOf('<Name>Bouwdag</Name>'));
  same('§4c schrijver: één hersteld blok 07:30:00–16:30:00 op maandag',
    bouwdag.match(/<FromTime>([^<]*)<\/FromTime>\s*<ToTime>([^<]*)<\/ToTime>/)?.slice(1), ['07:30:00', '16:30:00']);
}

// §4d Een dagkalender met pauze waar een URENtaak op staat, wordt na MSPDI een uurkalender (signaal (c),
// zoals op main). Dan horen de pauzevelden er niet bij: de blokken dragen de pauze.
{
  const lib: WorkCalendar = { ...createDefaultCalendar(), id: 'cal-bouwdag', name: 'Bouwdag', holidays: [], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, simpleBreakStartMinute: 750, simpleBreakDurationMinutes: 60 };
  delete lib.generation;
  const hourTask: Task = { ...dayTask('u', 'Urentaak', 1.5, lib.id) };
  hourTask.time = { ...hourTask.time, durationUnit: 'hours', durationMinutes: 720, scheduleDuration: 1.5 };
  const original = openAndRecalc({
    project: PROJECT, calendar: { ...createDefaultCalendar(), holidays: [] },
    tasks: [hourTask], sequences: [], resources: [], assignments: [], resourceCalendars: [lib],
  });
  const back = openAndRecalc(await parseOpenedFile({ name: 'urentaak.xml', text: exportMSPDI(original) }));
  const c = back.calendars.find((x) => x.name === 'Bouwdag')!;
  same('§4d uurkalender met de blokken, zonder pauzevelden; urentaak en F5 gelijk',
    [!!c.workTime, blocks(c, 1), c.simpleBreakStartMinute, c.simpleBreakDurationMinutes, dates(back)],
    [true, ['420-750', '810-960'], undefined, undefined, dates(original)]);
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  ${f}`);
  console.log(`XX  check-mspdi-werktijd-minuten: ${failures.length} van ${checks} controles mislukt`);
  process.exit(1);
}
console.log(`OK  check-mspdi-werktijd-minuten: ${checks} controles groen`);
