// PR #559, review ronde 2 deel B (BLOKKEERT): een importlezer maakte een datum zonder tijd in uurmodus
// tot middernacht, nog vóór de laadnormalisatie. MSPDI en P6 XML (`importDateTime`) en XER
// (`sourceInstant`) gaven voor werkelijk begin "2026-06-01" het moment `2026-06-01T00:00`. De
// normalisatie (T17, D1–D7, spec §4.2) laat een moment staan, dus de fout bleef na laden, opslaan en
// heropenen staan. Deze check loopt dezelfde keten als de reviewer: lezen → laadnormalisatie → laden met
// berekening → IFC opslaan → heropenen. Een expliciet ingevoerde `T00:00` blijft wel een moment.
// Ronde 3 (onderaan): een werkelijke datum mét tijd telt mee in de uur-modus-beslissing van de lezer.
import './domStub';
import { installDOMParser } from './xmldom-shim';
import { readXerArchiveIFC } from './xerArchiveTestReader';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { readP6XML, readP6XMLDocuments } from '@/services/p6/p6xmlReader';
import { readXER } from '@/services/xer/xerReader';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { payloadFromImport } from '@/state/documentContract';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { blocksClock, dayEndInstant, dayStartInstant } from '@/engine/calendar/workdayRules';
import type { Task } from '@/types/task';
import type { Baseline } from '@/types/baseline';

installDOMParser();
let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    errors.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
  }
}

/** De datums die de review noemt: actuals, beperking (FNLT), deadline en de baseline van de taak. */
interface DateView {
  actualStart?: string;
  actualFinish?: string;
  constraint?: string;
  deadline?: string;
  baselineStart?: string;
  baselineFinish?: string;
}
interface DateSource {
  tasks: Task[];
  baselines?: Baseline[];
  activeBaselineId?: string | null;
}

function view(source: DateSource, name: string): DateView {
  const task = source.tasks.find(t => t.name === name);
  if (!task) return { actualStart: `taak "${name}" ontbreekt` };
  const baselines = source.baselines ?? [];
  const baseline = baselines.find(b => b.id === source.activeBaselineId) ?? baselines[0];
  const entry = baseline?.tasks.find(b => b.taskId === task.id);
  return {
    actualStart: task.time.actualStart,
    actualFinish: task.time.actualFinish,
    constraint: task.constraint?.date,
    deadline: task.deadline,
    baselineStart: entry?.start,
    baselineFinish: entry?.finish,
  };
}

/**
 * Loopt de keten voor één bestand. `read` leest het bronbestand telkens opnieuw, zodat geen stap de
 * uitvoer van een andere stap ziet. `reopen` leest het opgeslagen IFC.
 */
function chain(
  format: string,
  read: () => ImportResult,
  reopen: (ifc: string) => ImportResult,
  raw: Record<string, DateView>,
  normalized: Record<string, DateView>,
): void {
  const parsed = read();
  for (const [name, want] of Object.entries(raw)) eq(`${format} lezer "${name}"`, view(parsed, name), want);

  const payload = payloadFromImport(read(), null);
  for (const [name, want] of Object.entries(normalized)) {
    eq(`${format} laadnormalisatie "${name}"`, view(payload, name), want);
  }

  const loaded = createAppStoreContext();
  loaded.store.getState().applyLoadedProject(read(), { recompute: true });
  for (const [name, want] of Object.entries(normalized)) {
    eq(`${format} laden met berekening "${name}"`, view(loaded.store.getState(), name), want);
  }

  const saved = writeIFC(buildWriteIFCInput(loaded.store.getState()));
  const reopened = createAppStoreContext();
  reopened.store.getState().applyLoadedProject(reopen(saved), { recompute: true });
  for (const [name, want] of Object.entries(normalized)) {
    eq(`${format} IFC opslaan en heropenen "${name}"`, view(reopened.store.getState(), name), want);
  }
}

// ── MSPDI: werkblokken 08:00–12:00 en 13:00–17:00 (de probe van de reviewer) ─────────────────────────
// "Gereed" draagt alleen datums zonder tijd; "Middernacht" draagt overal een expliciete `T00:00:00`.
const week = '<WeekDays>' + [1, 2, 3, 4, 5, 6, 7].map(d => {
  const working = d !== 1 && d !== 7;
  const times = working
    ? '<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime>'
      + '<WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>'
    : '';
  return `<WeekDay><DayType>${d}</DayType><DayWorking>${working ? 1 : 0}</DayWorking>${times}</WeekDay>`;
}).join('') + '</WeekDays>';
function mspdiTask(uid: number, name: string, d: { start: string; finish: string; fnlt: string }): string {
  return `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name><OutlineLevel>1</OutlineLevel>`
    + '<CalendarUID>1</CalendarUID><Duration>PT16H0M0S</Duration>'
    + `<Start>${d.start}</Start><Finish>${d.finish}</Finish>`
    + `<ActualStart>${d.start}</ActualStart><ActualFinish>${d.finish}</ActualFinish>`
    + '<PercentComplete>100</PercentComplete>'
    + `<ConstraintType>7</ConstraintType><ConstraintDate>${d.fnlt}</ConstraintDate><Deadline>${d.fnlt}</Deadline>`
    + `<Baseline><Number>0</Number><Start>${d.start}</Start><Finish>${d.finish}</Finish>`
    + '<Duration>PT16H0M0S</Duration></Baseline></Task>';
}
const mspdi = '<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project">'
  + '<Name>Datum zonder tijd</Name><StartDate>2026-06-01</StartDate><StatusDate>2026-06-05</StatusDate>'
  + '<CalendarUID>1</CalendarUID><MinutesPerDay>480</MinutesPerDay><Calendars><Calendar><UID>1</UID>'
  + `<Name>Standaard</Name><IsBaseCalendar>1</IsBaseCalendar><BaseCalendarUID>-1</BaseCalendarUID>${week}`
  + '</Calendar></Calendars><Tasks>'
  + mspdiTask(1, 'Gereed', { start: '2026-06-01', finish: '2026-06-02', fnlt: '2026-06-05' })
  + mspdiTask(2, 'Middernacht', {
    start: '2026-06-03T00:00:00', finish: '2026-06-04T00:00:00', fnlt: '2026-06-05T00:00:00',
  })
  + '</Tasks></Project>';

const mspdiMidnight: DateView = {
  actualStart: '2026-06-03T00:00', actualFinish: '2026-06-04T00:00',
  constraint: '2026-06-05T00:00', deadline: '2026-06-05T00:00',
  baselineStart: '2026-06-03T00:00', baselineFinish: '2026-06-04T00:00',
};
eq('mspdi voorwaarde: de kalender heeft eigen werkblokken', readMSPDI(mspdi).calendar.workTime !== undefined, true);
chain('mspdi', () => readMSPDI(mspdi), ifc => readIFC(ifc), {
  Gereed: {
    actualStart: '2026-06-01', actualFinish: '2026-06-02', constraint: '2026-06-05', deadline: '2026-06-05',
    baselineStart: '2026-06-01', baselineFinish: '2026-06-02',
  },
  Middernacht: mspdiMidnight,
}, {
  // D1 startachtig (08:00), D2 eindachtig (17:00), ook voor FNLT, deadline en het baseline-einde.
  Gereed: {
    actualStart: '2026-06-01T08:00', actualFinish: '2026-06-02T17:00',
    constraint: '2026-06-05T17:00', deadline: '2026-06-05T17:00',
    baselineStart: '2026-06-01T08:00', baselineFinish: '2026-06-02T17:00',
  },
  Middernacht: mspdiMidnight,
});

// ── XER: kalender van 8 u zonder `clndr_data`; een tijd op een andere taak maakt hem een urenkalender ──
// P6 kent geen deadline. De baseline komt uit het baselineproject P0 (`sum_base_proj_id`).
const xerTask = (id: string, project: string, code: string, name: string, status: string,
  start: string, finish: string, actual: boolean, fnlt: string): string => [
  '%R', id, project, 'C1', code, name, 'TT_Task', 'DT_FixedDUR', status, '16',
  status === 'TK_Complete' ? '0' : '16', start, finish, actual ? start : '', actual ? finish : '',
  fnlt ? 'CS_MEOB' : '', fnlt,
].join('\t');
const xer = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tsum_base_proj_id',
  '%R\tP1\tDatumZonderTijd\tC1\t2026-06-05\t2026-06-01\tP0',
  '%R\tP0\tBaseline\tC1\t2026-06-01\t2026-06-01\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code'
    + '\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date'
    + '\tact_end_date\tcstr_type\tcstr_date',
  xerTask('T1', 'P1', 'A1', 'Gereed', 'TK_Complete', '2026-06-01', '2026-06-02', true, '2026-06-05'),
  xerTask('T2', 'P1', 'A2', 'Uur-signaal', 'TK_NotStart', '2026-06-08 08:30', '2026-06-09 12:30', false, ''),
  xerTask('T3', 'P1', 'A3', 'Middernacht', 'TK_Complete', '2026-06-03 00:00', '2026-06-04 00:00', true,
    '2026-06-05 00:00'),
  xerTask('B1', 'P0', 'A1', 'Gereed', 'TK_NotStart', '2026-06-01', '2026-06-02', false, ''),
  xerTask('B3', 'P0', 'A3', 'Middernacht', 'TK_NotStart', '2026-06-03 00:00', '2026-06-04 00:00', false, ''),
  '%E',
].join('\n');
function readXerMain(): ImportResult {
  const opened = readXER(new TextEncoder().encode(xer));
  if (!('documents' in opened)) return opened;
  const main = opened.documents.find(document => document.projectId === 'P1');
  if (!main) throw new Error('XER: project P1 ontbreekt');
  return main.result;
}
const xerParsed = readXerMain();
eq('xer voorwaarde: de kalender is een urenkalender', xerParsed.calendar.workTime !== undefined, true);
eq('xer voorwaarde: de baseline komt uit P0', xerParsed.baselines?.length, 1);
// Projectdatums blijven zoals ingevoerd (spec §3.6); de motor leest de statusdatum met D5.
eq('xer statusdatum zonder tijd blijft een datum', xerParsed.project.statusDate, '2026-06-05');
const xerMidnight: DateView = {
  actualStart: '2026-06-03T00:00', actualFinish: '2026-06-04T00:00', constraint: '2026-06-05T00:00',
  baselineStart: '2026-06-03T00:00', baselineFinish: '2026-06-04T00:00',
};
chain('xer', readXerMain, ifc => readXerArchiveIFC(ifc), {
  Gereed: {
    actualStart: '2026-06-01', actualFinish: '2026-06-02', constraint: '2026-06-05',
    baselineStart: '2026-06-01', baselineFinish: '2026-06-02',
  },
  Middernacht: xerMidnight,
}, {
  // D1 startachtig (08:00), D2 eindachtig (16:00) op de kalender van 8 u.
  Gereed: {
    actualStart: '2026-06-01T08:00', actualFinish: '2026-06-02T16:00', constraint: '2026-06-05T16:00',
    baselineStart: '2026-06-01T08:00', baselineFinish: '2026-06-02T16:00',
  },
  Middernacht: xerMidnight,
});

// ── P6 XML: dezelfde parser als MSPDI (`importDateTimeOrUndefined`) ───────────────────────────────────
// Een geplande start om 09:00 maakt de projectkalender een urenkalender. Alleen lezer en
// laadnormalisatie: de rest van de keten deelt P6 XML met de andere formaten.
function p6Activity(id: number, name: string, start: string, finish: string, fnlt: string): string {
  return `<Activity><ObjectId>${id}</ObjectId><Id>A${id}</Id><Name>${name}</Name><Type>Task Dependent</Type>`
    + '<PlannedDuration>16</PlannedDuration><Status>Completed</Status>'
    + `<PlannedStartDate>${start}</PlannedStartDate><PlannedFinishDate>${finish}</PlannedFinishDate>`
    + `<ActualStartDate>${start}</ActualStartDate><ActualFinishDate>${finish}</ActualFinishDate>`
    + `<PrimaryConstraintType>Finish On or Before</PrimaryConstraintType><PrimaryConstraintDate>${fnlt}`
    + '</PrimaryConstraintDate></Activity>';
}
const p6 = '<?xml version="1.0"?><APIBusinessObjects><Project><ObjectId>1</ObjectId><Id>P</Id>'
  + '<Name>Datum zonder tijd</Name><PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate>'
  + p6Activity(1, 'Gereed', '2026-06-01', '2026-06-02', '2026-06-05')
  + p6Activity(2, 'Middernacht', '2026-06-03T00:00:00', '2026-06-04T00:00:00', '2026-06-05T00:00:00')
  + '<Activity><ObjectId>3</ObjectId><Id>A3</Id><Name>Uur-signaal</Name><Type>Task Dependent</Type>'
  + '<PlannedDuration>3</PlannedDuration><PlannedStartDate>2026-06-08T09:00:00</PlannedStartDate>'
  + '<PlannedFinishDate>2026-06-08T12:00:00</PlannedFinishDate></Activity>'
  + '</Project></APIBusinessObjects>';
const p6Parsed = readP6XML(p6);
eq('p6xml voorwaarde: de kalender is een urenkalender', p6Parsed.calendar.workTime !== undefined, true);
eq('p6xml lezer "Gereed"', view(p6Parsed, 'Gereed'),
  { actualStart: '2026-06-01', actualFinish: '2026-06-02', constraint: '2026-06-05' });
const p6Midnight: DateView = {
  actualStart: '2026-06-03T00:00', actualFinish: '2026-06-04T00:00', constraint: '2026-06-05T00:00',
};
eq('p6xml lezer "Middernacht"', view(p6Parsed, 'Middernacht'), p6Midnight);
const p6Payload = payloadFromImport(readP6XML(p6), null);
const p6Clock = blocksClock(p6Payload.calendar);
const p6Want = {
  actualStart: dayStartInstant(p6Clock, '2026-06-01'),
  actualFinish: dayEndInstant(p6Clock, '2026-06-02'),
  constraint: dayEndInstant(p6Clock, '2026-06-05'),
};
eq('p6xml werkdag begint niet om middernacht', [p6Want.actualStart, p6Want.actualFinish, p6Want.constraint]
  .some(v => v?.endsWith('T00:00')), false);
eq('p6xml laadnormalisatie "Gereed"', view(p6Payload, 'Gereed'), p6Want);
eq('p6xml laadnormalisatie "Middernacht"', view(p6Payload, 'Middernacht'), p6Midnight);

// ── Ronde 3: een werkelijke datum MET tijd op een scalaire kalender ───────────────────────────────────
// Review ronde 3 van PR #559, deel B (BLOKKEERT): de uur-modus-beslissing keek alleen naar de geplande
// datums. Staan die op het anker (08:00) of zonder tijd, dan bleef de kalender scalair en kapte de lezer
// een werkelijk einde "11:00" (of een expliciete "00:00") af tot de datum; de normalisatie maakte er
// 16:00 van. Elk bestand hieronder heeft één taak; alleen haar werkelijke datums dragen een tijd.
const workWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day =>
  `<StandardWorkHours><DayOfWeek>${day}</DayOfWeek><WorkTime><Start>08:00:00</Start><Finish>16:00:00</Finish>`
  + '</WorkTime></StandardWorkHours>').join('');
/** De probe van de reviewer: voltooide eindmijlpaal, geplande datums op 1 juni 08:00. */
function p6Milestone(actualFinish: string): string {
  return '<?xml version="1.0"?><APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V8.3/API/BusinessObjects">'
    + `<Calendar><ObjectId>1</ObjectId><Name>Bouw</Name><Type>Global</Type><HoursPerDay>8</HoursPerDay>`
    + `<StandardWorkWeek>${workWeek}</StandardWorkWeek></Calendar>`
    + '<Project><ObjectId>10</ObjectId><Id>P</Id><Name>Oplevering</Name>'
    + '<ActivityDefaultCalendarObjectId>1</ActivityDefaultCalendarObjectId>'
    + '<PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate><DataDate>2026-06-02T08:00:00</DataDate>'
    + '<Activity><ObjectId>100</ObjectId><ProjectObjectId>10</ProjectObjectId><Id>M1</Id><Name>Oplevering</Name>'
    + '<Type>Finish Milestone</Type><CalendarObjectId>1</CalendarObjectId><PlannedDuration>0</PlannedDuration>'
    + '<PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate><PlannedFinishDate>2026-06-01T08:00:00</PlannedFinishDate>'
    + `<ActualFinishDate>${actualFinish}</ActualFinishDate><Status>Completed</Status></Activity>`
    + '</Project></APIBusinessObjects>';
}
function readP6Opened(xml: string): ImportResult {
  const opened = readP6XMLDocuments(xml);
  return 'kind' in opened ? opened.results[opened.activeDocumentIndex] : opened;
}
/** MSPDI: één werkblok 08:00–16:00 (scalair), geplande datums op het anker 08:00. */
function mspdiScalar(actualStart: string, actualFinish: string): string {
  const days = [1, 2, 3, 4, 5, 6, 7].map(d => {
    const working = d !== 1 && d !== 7;
    const times = working
      ? '<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>16:00:00</ToTime></WorkingTime></WorkingTimes>'
      : '';
    return `<WeekDay><DayType>${d}</DayType><DayWorking>${working ? 1 : 0}</DayWorking>${times}</WeekDay>`;
  }).join('');
  return '<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project">'
    + '<Name>Werkelijke tijd</Name><StartDate>2026-06-01T08:00:00</StartDate><CalendarUID>1</CalendarUID>'
    + '<MinutesPerDay>480</MinutesPerDay><Calendars><Calendar><UID>1</UID><Name>Standaard</Name>'
    + `<IsBaseCalendar>1</IsBaseCalendar><BaseCalendarUID>-1</BaseCalendarUID><WeekDays>${days}</WeekDays>`
    + '</Calendar></Calendars><Tasks><Task><UID>1</UID><ID>1</ID><Name>Werkelijk</Name><OutlineLevel>1</OutlineLevel>'
    + '<CalendarUID>1</CalendarUID><Duration>PT16H0M0S</Duration>'
    + '<Start>2026-06-01T08:00:00</Start><Finish>2026-06-02T08:00:00</Finish>'
    + `<ActualStart>${actualStart}</ActualStart><ActualFinish>${actualFinish}</ActualFinish>`
    + '<PercentComplete>100</PercentComplete></Task></Tasks></Project>';
}
/** XER: kalender van 8 u zonder `clndr_data`, geplande datums zonder tijd. */
function xerScalar(actualStart: string, actualFinish: string): string {
  return [
    'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP1\tWerkelijkeTijd\tC1\t2026-06-05\t2026-06-01',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code'
      + '\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
    ['%R', 'T1', 'P1', 'C1', 'A1', 'Werkelijk', 'TT_Task', 'DT_FixedDUR', 'TK_Complete', '16', '0',
      '2026-06-01', '2026-06-02', actualStart, actualFinish].join('\t'),
    '%E',
  ].join('\n');
}
function readXerSingle(xer: string): ImportResult {
  const opened = readXER(new TextEncoder().encode(xer));
  return 'documents' in opened ? opened.documents[0].result : opened;
}

// Voorwaarde: zonder tijd op de werkelijke datums blijft elke kalender scalair. Zo toetst ronde 3 precies
// het geval van de review, en niet een kalender die al om een andere reden een urenkalender is.
eq('ronde 3 p6xml voorwaarde: scalair zonder werkelijke tijd',
  readP6Opened(p6Milestone('2026-06-01T08:00:00')).calendar.workTime, undefined);
eq('ronde 3 mspdi voorwaarde: scalair zonder werkelijke tijd',
  readMSPDI(mspdiScalar('2026-06-01T08:00:00', '2026-06-02T08:00:00')).calendar.workTime, undefined);
eq('ronde 3 xer voorwaarde: scalair zonder werkelijke tijd',
  readXerSingle(xerScalar('2026-06-01', '2026-06-02')).calendar.workTime, undefined);

for (const clock of ['11:00', '00:00']) {
  // Eindmijlpaal: het werkelijke begin volgt het werkelijke einde.
  const p6Want: DateView = { actualStart: `2026-06-01T${clock}`, actualFinish: `2026-06-01T${clock}` };
  const p6Xml = p6Milestone(`2026-06-01T${clock}:00`);
  chain(`ronde 3 p6xml ${clock}`, () => readP6Opened(p6Xml), ifc => readIFC(ifc),
    { Oplevering: p6Want }, { Oplevering: p6Want });

  const want: DateView = { actualStart: `2026-06-01T${clock}`, actualFinish: `2026-06-02T${clock}` };
  const mspdiXml = mspdiScalar(`2026-06-01T${clock}:00`, `2026-06-02T${clock}:00`);
  chain(`ronde 3 mspdi ${clock}`, () => readMSPDI(mspdiXml), ifc => readIFC(ifc),
    { Werkelijk: want }, { Werkelijk: want });

  const xerText = xerScalar(`2026-06-01 ${clock}`, `2026-06-02 ${clock}`);
  chain(`ronde 3 xer ${clock}`, () => readXerSingle(xerText), ifc => readXerArchiveIFC(ifc),
    { Werkelijk: want }, { Werkelijk: want });
}

if (errors.length) {
  for (const e of errors) console.log(`XX import-datum-zonder-tijd: ${e}`);
  process.exitCode = 1;
}
console.log(`import-datum-zonder-tijd: ${checks - errors.length}/${checks} groen`);
