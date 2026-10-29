import './domStub';
// Projectstart en -einde met tijd, door opslaan als IFC en heropenen.
//
// Na een XER-import hebben `project.startDate` en `project.endDate` een tijd (`2012-12-17T07:00`). De
// writer schreef `ProjectStartDate`/`ProjectEndDate` als IFCDATE met alleen de datum, en de lezer nam
// alleen de eerste 10 tekens. Na heropenen was de tijd weg: de P6- en MSPDI-export schreven dan 08:00, en
// met `useProjectEndDateForFloat` rekende de motor de late kant vanaf middernacht. Nu schrijft de writer
// mét tijd IFCDATETIME, en neemt de lezer de tijd alleen uit IFCDATETIME over. Zie docs/ifc-round-trip.md,
// "Projectstart en -einde met tijd".
//
//  §1 de vorm in het bestand: met tijd IFCDATETIME met seconden, zonder tijd IFCDATE (zoals main), leeg `$`,
//     een onleesbare tijd of seconden IFCTEXT, letterlijk (`ifcDateValue`; de lezer neemt daar de datum).
//  §2 round-trip van start en einde (readIFC): met tijd, middernacht, zonder tijd, leeg einde.
//  §3 oude bestanden lezen zoals main ze las: IFCDATE zonder tijd, IFCDATE mét tijd (main vóór #344),
//     en de fixture `xer-archief-herschreven.ifc`. Een IFCDATETIME van een ander pakket met een
//     onleesbare tijd geeft de datum, met een zone de kloktijd.
//  §4 de echte open- en opslaanroute (store, doorrekenen): projectdatums, alle taakdatums en speling gelijk
//     vóór en na, met `useProjectEndDateForFloat`. Controle: zonder de tijd van het einde rekent de motor
//     echt anders, dus §4 toetst iets.
//  §5 de P6- en MSPDI-export: de projectregels gelijk vóór en na.
//  §6 schemapoort: het geschreven bestand heeft 0 fouten, in IFC4X3_ADD2, IFC4X3 en IFC4.
//  §7 knownbug 109: native planomvang uit getoonde taakdatums, contractuele projectinvoer apart,
//     terugvallen zonder datums en herhaalde round-trip in elk projectschema.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { writeP6XMLWithReport } from '@/services/p6/p6xmlWriter';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import type { DocumentPayload } from '@/state/documentContract';
import type { ImportResult, OpenedImport } from '@/services/importTypes';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task } from '@/types/task';
import { checkIfcSchema, parseStep } from './ifcSchemaCheck';
import { IFC_SCHEMAS } from '@/types/project';

declare const process: { exit(code: number): never };

const HERE = fileURLToPath(new URL('.', import.meta.url));

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want)}\n        kreeg    ${JSON.stringify(got)}`);
  }
}
function differs(label: string, a: unknown, b: unknown): void {
  checks++;
  if (JSON.stringify(a) === JSON.stringify(b)) failures.push(`${label}\n        beide ${JSON.stringify(a)}`);
}

// Uurkalender ma–vr 07:00–16:00 (9 klokuren), zoals de XER-lezer een P6-kalender met blokken zet.
const bands = (s: number, e: number) => [{ start: s, end: e }];
const WEEK: WorkTimeBands = { byWeekday: { 1: bands(420, 960), 2: bands(420, 960), 3: bands(420, 960), 4: bands(420, 960), 5: bands(420, 960), 6: [], 7: [] } };
const CAL: WorkCalendar = {
  id: 'cal-uur', name: 'Uur 07-16', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 16, hoursPerDay: 9, holidays: [], workTime: WEEK,
};

function hourTask(id: string, start: string, minutes: number): Task {
  const time = createDefaultTaskTime(start, minutes / 60, 'hours', CAL);
  time.durationMinutes = minutes;
  time.scheduleDuration = minutes / (CAL.hoursPerDay * 60);
  return {
    id, name: `Taak ${id}`, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [], time,
  } as Task;
}

/** Twee urentaken in serie en één losse, plus een resource met tarief (P6 `ResourceRate.EffectiveDate`
 *  is de projectstart). Het einde ligt ná het netwerkeinde, zodat het de late kant bepaalt. */
function buildProject(startDate: string, endDate: string): ImportResult {
  const project = {
    ...createDefaultProject(), id: 'proj-projectdatum', calendarId: CAL.id, startDate, endDate,
    schedulingOptions: { useProjectEndDateForFloat: true },
  };
  const tasks = [hourTask('a', '2026-03-02T07:00', 1080), hourTask('b', '2026-03-04T07:00', 540), hourTask('c', '2026-03-02T07:00', 270)];
  return {
    project, calendar: CAL, tasks,
    sequences: [{ id: 's-ab', predecessorId: 'a', successorId: 'b', type: 'FINISH_START', lagDays: 0 }],
    resources: [{ id: 'r1', name: 'Ploeg', type: 'LABOR', description: '', costPerHour: 55, maxUnits: 1 }],
    assignments: [],
  } as ImportResult;
}

/** De twee projectdatums in `OPS_ProjectSettings`, als ruwe STEP-waarde. */
function contractDates(ifc: string): { start?: string; end?: string } {
  const value = (name: string) => new RegExp(`IFCPROPERTYSINGLEVALUE\\('${name}',\\$,(.*),\\$\\);$`, 'm').exec(ifc)?.[1];
  return { start: value('ProjectStartDate'), end: value('ProjectEndDate') };
}

const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
function openInStore(parsed: OpenedImport): DocumentPayload {
  const store = createAppStoreContext().store;
  store.getState().applyOpenedImport(parsed, OPEN);
  return store.getState().getOpenDocumentPayloads()[0].payload;
}
async function reopen(p: DocumentPayload): Promise<DocumentPayload> {
  return openInStore(await parseOpenedFile({ name: 'rondgang.ifc', text: writeIFC(buildWriteIFCInput(p)) }));
}
const taskDates = (p: DocumentPayload) => p.tasks.map((t) => {
  const x = t.time;
  return [t.id, x.earlyStart, x.earlyFinish, x.lateStart, x.lateFinish, x.totalFloat, x.isCritical];
});
// De console van de exportschrijvers (meldingen over niet-exporteerbare opties) hoort niet in de log.
const quiet = <T>(fn: () => T): T => {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
};
/** Alleen de projectregels: P6 `<Project>`-velden en `ResourceRate`, MSPDI de kop vóór `<Calendars>`. */
function projectExportLines(p: DocumentPayload): string[] {
  const p6 = quiet(() => writeP6XMLWithReport(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments,
    p.calendars, p.customTaskTypes).xml);
  const msp = quiet(() => writeMSPDI(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments, p.calendars,
    p.baselines, p.activeBaselineId, p.customTaskTypes));
  const p6Project = /<Project>[\s\S]*?<\/Project>/.exec(p6)?.[0] ?? '';
  const p6Own = p6Project.replace(/<(WBS|Activity|Relationship|ResourceAssignment|Calendar)>[\s\S]*?<\/\1>/g, '');
  const p6Rates = [...p6.matchAll(/<ResourceRate>[\s\S]*?<\/ResourceRate>/g)].map((m) => m[0]).join('');
  const mspHead = msp.slice(0, Math.max(0, msp.indexOf('<Calendars>')));
  const pick = (src: string, tags: string) => [...src.matchAll(new RegExp(`<(${tags})>([^<]*)</\\1>`, 'g'))].map((m) => `${m[1]}=${m[2]}`);
  return [...pick(p6Own, 'PlannedStartDate|MustFinishByDate').map((l) => `P6 ${l}`),
    ...pick(p6Rates, 'EffectiveDate').map((l) => `P6 rate ${l}`),
    ...pick(mspHead, 'StartDate|FinishDate').map((l) => `MSPDI ${l}`)];
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §1 De vorm in het bestand
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  same('§1 start en einde met tijd: IFCDATETIME met seconden',
    contractDates(writeIFC(buildProject('2026-03-02T07:00', '2026-03-13T12:00'))),
    { start: "IFCDATETIME('2026-03-02T07:00:00')", end: "IFCDATETIME('2026-03-13T12:00:00')" });
  same('§1 middernacht is een tijd: IFCDATETIME',
    contractDates(writeIFC(buildProject('2026-03-02T00:00', '2026-03-13T00:00'))),
    { start: "IFCDATETIME('2026-03-02T00:00:00')", end: "IFCDATETIME('2026-03-13T00:00:00')" });
  same('§1 zonder tijd: IFCDATE, zoals main', contractDates(writeIFC(buildProject('2026-03-02', '2026-03-13'))),
    { start: "IFCDATE('2026-03-02')", end: "IFCDATE('2026-03-13')" });
  same('§1 leeg einde: `$`', contractDates(writeIFC(buildProject('2026-03-02T07:00', ''))),
    { start: "IFCDATETIME('2026-03-02T07:00:00')", end: '$' });
  // Seconden zijn geen vorm van de store (alleen uit een extensie): tekst, letterlijk. De lezer neemt de
  // datum, zoals main vóór #353.
  const withSeconds = writeIFC(buildProject('2026-03-02T07:00:30', ''));
  same('§1 met seconden: IFCTEXT, letterlijk', contractDates(withSeconds).start, "IFCTEXT('2026-03-02T07:00:30')");
  same('§1 met seconden: de lezer neemt de datum', readIFC(withSeconds).project.startDate, '2026-03-02');
  // Geen geldige IfcDateTime: tekst, letterlijk (het bestand blijft schemageldig). De lezer neemt er de
  // datum uit, zoals main.
  const unreadable = writeIFC(buildProject('2026-03-02T7:00', ''));
  same('§1 onleesbare tijd: IFCTEXT, letterlijk', contractDates(unreadable).start, "IFCTEXT('2026-03-02T7:00')");
  same('§1 onleesbare tijd: de lezer neemt de datum', readIFC(unreadable).project.startDate, '2026-03-02');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §2 Round-trip van start en einde
// ════════════════════════════════════════════════════════════════════════════════════════════════
for (const [start, end] of [
  ['2026-03-02T07:00', '2026-03-13T12:00'],
  ['2026-03-02T00:00', '2026-03-13T00:00'],
  ['2026-03-02T16:30', '2026-03-13T17:00'],
  ['2026-03-02', '2026-03-13'],
  ['2026-03-02T07:00', ''],
] as const) {
  const once = readIFC(writeIFC(buildProject(start, end)));
  same(`§2 ${start} / ${end || 'leeg'}: start`, once.project.startDate, start);
  same(`§2 ${start} / ${end || 'leeg'}: einde`, once.project.endDate, end);
  const twice = readIFC(writeIFC({ ...buildProject(start, end), project: once.project }));
  same(`§2 ${start} / ${end || 'leeg'}: tweede round-trip`, [twice.project.startDate, twice.project.endDate], [start, end]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §3 Oude bestanden lezen zoals main
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const ifc = writeIFC(buildProject('2026-03-02T07:00', '2026-03-13T12:00'));
  const asMain = ifc.replace("IFCDATETIME('2026-03-02T07:00:00')", "IFCDATE('2026-03-02')")
    .replace("IFCDATETIME('2026-03-13T12:00:00')", "IFCDATE('2026-03-13')");
  const preB5 = ifc.replace("IFCDATETIME('2026-03-02T07:00:00')", "IFCDATE('2026-03-02T07:00')")
    .replace("IFCDATETIME('2026-03-13T12:00:00')", "IFCDATE('2026-03-13T12:00')");
  same('§3 controle: de vervanging raakt beide regels', [asMain, preB5].map((t) => t.includes('IFCDATETIME(\'2026-03-')), [false, false]);
  const m = readIFC(asMain).project;
  same('§3 main (IFCDATE zonder tijd): datum', [m.startDate, m.endDate], ['2026-03-02', '2026-03-13']);
  const o = readIFC(preB5).project;
  same('§3 main vóór #344 (IFCDATE met tijd): datum, zoals main hem las', [o.startDate, o.endDate], ['2026-03-02', '2026-03-13']);
  const fixture = readFileSync(join(HERE, 'fixtures', 'xer-archief-herschreven.ifc'), 'utf8');
  same('§3 controle: de fixture draagt IFCDATE met tijd', fixture.includes("'ProjectStartDate',$,IFCDATE('2026-08-03T08:00')"), true);
  same('§3 fixture xer-archief-herschreven.ifc: projectstart zoals main', readIFC(fixture).project.startDate, '2026-08-03');
  // IFCDATETIME van een ander pakket: een onleesbare tijd geeft de datum (niet de eerste 16 tekens), een
  // zone valt weg en de kloktijd blijft (`importStatusDate`, zoals bij StatusDate).
  const foreign = (value: string) => readIFC(ifc.replace("IFCDATETIME('2026-03-02T07:00:00')", `IFCDATETIME('${value}')`)).project.startDate;
  same('§3 IFCDATETIME met een onleesbare tijd: de datum', foreign('2026-03-02T7:00:00'), '2026-03-02');
  same('§3 IFCDATETIME met een uur 25: de datum', foreign('2026-03-02T25:00:00'), '2026-03-02');
  same('§3 IFCDATETIME met een zone: de kloktijd', foreign('2026-03-02T07:00:00+02:00'), '2026-03-02T07:00');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §4 De echte open- en opslaanroute, met de motor
// §5 De P6- en MSPDI-export
// ════════════════════════════════════════════════════════════════════════════════════════════════
for (const [start, end] of [
  ['2026-03-02T07:00', '2026-03-13T12:00'],
  ['2026-03-02T00:00', '2026-03-13T16:00'],
] as const) {
  const label = `${start} / ${end}`;
  const before = openInStore(buildProject(start, end));
  same(`§4 ${label}: controle, de optie staat aan`, before.project.schedulingOptions?.useProjectEndDateForFloat, true);
  const after = await reopen(before);
  same(`§4 ${label}: projectdatums`, [after.project.startDate, after.project.endDate], [start, end]);
  same(`§4 ${label}: taakdatums, speling en kritiek`, taskDates(after), taskDates(before));
  const again = await reopen(after);
  same(`§4 ${label}: taakdatums na een tweede round-trip`, taskDates(again), taskDates(before));
  // Controle: zonder de tijd van het einde (wat main na heropenen had) rekent de motor anders.
  const dateOnly = openInStore(buildProject(start.slice(0, 10), end.slice(0, 10)));
  if (end.endsWith('T16:00')) {
    same(`§4 ${label}: D2 leest het datumloze projecteinde op het laatste blokeinde`, taskDates(dateOnly), taskDates(before));
  } else {
    differs(`§4 ${label}: controle, de tijd van het einde verandert de late kant`, taskDates(dateOnly), taskDates(before));
  }

  const lines = projectExportLines(before);
  same(`§5 ${label}: controle, de export heeft de projectregels`, lines.map((l) => l.split('=')[0]),
    ['P6 MustFinishByDate', 'P6 PlannedStartDate', 'P6 rate EffectiveDate', 'MSPDI StartDate', 'MSPDI FinishDate']);
  same(`§5 ${label}: projectregels in de P6- en MSPDI-export`, projectExportLines(after), lines);
  differs(`§5 ${label}: controle, zonder tijd schrijft de export andere regels`, projectExportLines(dateOnly), lines);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §6 Schemapoort
// ════════════════════════════════════════════════════════════════════════════════════════════════
for (const schema of ['IFC4X3_ADD2', 'IFC4X3', 'IFC4'] as const) {
  for (const [start, end] of [['2026-03-02T07:00', '2026-03-13T12:00'], ['2026-03-02', ''], ['2026-03-02T7:00', '2026-03-13 12:00']] as const) {
    const input = buildProject(start, end);
    const r = checkIfcSchema(`projectdatum ${start} / ${end || 'leeg'}`, writeIFC({ ...input, project: { ...input.project, ifcSchema: schema } }), undefined, schema);
    checks += r.checks;
    failures.push(...r.failures.map((f) => `§6 ${f}`));
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §7 Planomvang voor andere IFC-programma's (knownbug 109)
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  // Een onafhankelijke STEP-parser leest de schema-slots 11/12; geen productiedatumhelper als orakel.
  const controls = (text: string) => parseStep(text)
    .filter(e => e.type === 'IFCWORKPLAN' || e.type === 'IFCWORKSCHEDULE');
  const spans = (text: string) => controls(text).map(e =>
    [e.type, ...[11, 12].map(i => { const v = e.args[i]; return v.k === 'str' ? v.raw : '$'; })]);
  const task = (id: string, time: Partial<Task['time']> = {}, extra: Partial<Task> = {}): Task => {
    const t = hourTask(id, '2026-03-02T07:00', 540);
    return { ...t, ...extra, time: { ...t.time, scheduleFinish: '2026-03-02T16:00',
      earlyStart: '2026-04-06T07:00', earlyFinish: '2026-04-10T16:00', ...time } };
  };
  const noDates: Partial<Task['time']> = {
    scheduleStart: '', scheduleFinish: '', earlyStart: '', earlyFinish: '', lateStart: '', lateFinish: '',
  };
  const cases: {
    label: string; tasks: Task[]; start: string; end: string; repeat?: boolean;
    taskTimeSlots?: readonly [number, number];
    inputDates?: Record<string, readonly [string, string]>;
    projectDates?: readonly [string, string];
  }[] = [
    { label: 'voltooid: werkelijke datums winnen van early én invoer', tasks: [task('a', {
      actualStart: '2026-02-24T09:00', actualFinish: '2026-02-26T15:00', completion: 1, remainingTime: 0,
    }, { status: 'COMPLETED' })], start: "'2026-02-24T09:00:00'", end: "'2026-02-26T15:00:00'" },
    { label: 'voltooid zonder werkelijke start valt terug op werkelijk einde', tasks: [task('a', {
      actualFinish: '2026-02-26T15:00', completion: 1, remainingTime: 0,
    }, { status: 'COMPLETED' })], start: "'2026-02-26T15:00:00'", end: "'2026-02-26T15:00:00'" },
    { label: 'lopend: werkelijke start en berekend resteinde', tasks: [task('a', {
      actualStart: '2026-02-25T11:00', completion: 0.5,
    }, { status: 'STARTED' })], start: "'2026-02-25T11:00:00'", end: "'2026-04-10T16:00:00'" },
    // Review P2: een urentaak kan kale actuals/early/invoer dragen. De eerste save moet al
    // dezelfde kloktijd als IfcTaskTime hebben, vóór readIFC die velden tot uur-instants aanvult.
    { label: 'uurtaak: kale werkelijke start is middernacht', tasks: [task('a', {
      actualStart: '2026-02-24', completion: 0.5,
    }, { status: 'STARTED' })], start: "'2026-02-24T00:00:00'", end: "'2026-04-10T16:00:00'", taskTimeSlots: [16, 8] },
    // Knownbug 279 (B3): een kaal EINDveld krijgt op deze letterlijke kalender het einde van zijn werkdag
    // (16:00), zoals op de laadgrens. Eerst ging het als 00:00 (urentaak) of 07:00 (dagtaak) en las het
    // terug als het begin van die dag. Een kale start blijft 00:00 of het 07:00-anker.
    { label: 'uurtaak: kale werkelijke start is middernacht, het kale einde het werkdageinde', tasks: [task('a', {
      actualStart: '2026-02-24', actualFinish: '2026-02-26', completion: 1, remainingTime: 0,
    }, { status: 'COMPLETED' })], start: "'2026-02-24T00:00:00'", end: "'2026-02-26T16:00:00'", taskTimeSlots: [16, 17] },
    { label: 'uurtaak: kale finish als startterugval is het werkdageinde', tasks: [task('a', {
      actualFinish: '2026-02-26', completion: 1, remainingTime: 0,
    }, { status: 'COMPLETED' })], start: "'2026-02-26T16:00:00'", end: "'2026-02-26T16:00:00'", taskTimeSlots: [17, 17] },
    { label: 'uurtaak: kale early-start is middernacht, het kale early-einde het werkdageinde', tasks: [task('a', {
      earlyStart: '2026-04-06', earlyFinish: '2026-04-10',
    })], start: "'2026-04-06T00:00:00'", end: "'2026-04-10T16:00:00'", taskTimeSlots: [7, 8] },
    { label: 'uurtaak: kale invoerterugval: start middernacht, einde werkdageinde', tasks: [task('a', {
      scheduleStart: '2026-03-02', scheduleFinish: '2026-03-03', earlyStart: '', earlyFinish: '',
    })], start: "'2026-03-02T00:00:00'", end: "'2026-03-03T16:00:00'", taskTimeSlots: [5, 6],
      inputDates: { a: ['2026-03-02T00:00', '2026-03-03T16:00'] } },
    { label: 'uurtaak: alleen het kale invoereinde valt terug', tasks: [task('a', {
      earlyStart: '2026-03-06T11:00', earlyFinish: '', scheduleFinish: '2026-03-10',
    })], start: "'2026-03-06T11:00:00'", end: "'2026-03-10T16:00:00'", taskTimeSlots: [7, 6],
      inputDates: { a: ['2026-03-02T07:00', '2026-03-10T16:00'] } },
    { label: 'dagtaak: kale werkelijke start houdt het daganker, het kale einde het werkdageinde', tasks: [task('a', {
      durationUnit: 'days', durationMinutes: undefined, scheduleDuration: 1,
      actualStart: '2026-02-24', actualFinish: '2026-02-26', completion: 1, remainingTime: 0,
    }, { status: 'COMPLETED' })], start: "'2026-02-24T07:00:00'", end: "'2026-02-26T16:00:00'", taskTimeSlots: [16, 17] },
    { label: 'dagtaak: kale early-start houdt het daganker, het kale early-einde het werkdageinde', tasks: [task('a', {
      durationUnit: 'days', durationMinutes: undefined, scheduleDuration: 1,
      earlyStart: '2026-04-06', earlyFinish: '2026-04-10',
    })], start: "'2026-04-06T07:00:00'", end: "'2026-04-10T16:00:00'", taskTimeSlots: [7, 8] },
    { label: 'dagtaak: kale invoerterugval: start daganker, einde werkdageinde', tasks: [task('a', {
      durationUnit: 'days', durationMinutes: undefined, scheduleDuration: 1,
      scheduleStart: '2026-03-02', scheduleFinish: '2026-03-03', earlyStart: '', earlyFinish: '',
    })], start: "'2026-03-02T07:00:00'", end: "'2026-03-03T16:00:00'", taskTimeSlots: [5, 6],
      inputDates: { a: ['2026-03-02T07:00', '2026-03-03T16:00'] } },
    { label: '100 procent zonder werkelijk einde blijft lopend', tasks: [task('a', {
      actualStart: '2026-02-26T11:00', completion: 1, remainingTime: 1,
    }, { status: 'STARTED' })], start: "'2026-02-26T11:00:00'", end: "'2026-04-10T16:00:00'" },
    { label: 'early wijkt af van broninvoer', tasks: [task('a')],
      start: "'2026-04-06T07:00:00'", end: "'2026-04-10T16:00:00'" },
    { label: 'zonder early terug op invoer', tasks: [task('a', { earlyStart: '', earlyFinish: '' })],
      start: "'2026-03-02T07:00:00'", end: "'2026-03-02T16:00:00'" },
    { label: 'terugval per as', tasks: [task('a', { earlyStart: '', earlyFinish: '2026-04-10T16:00' })],
      start: "'2026-03-02T07:00:00'", end: "'2026-04-10T16:00:00'" },
    { label: 'samenvatting: eerdere berekende start omsluit de fase', tasks: [
      task('f', { actualStart: '2026-03-09T07:00', earlyStart: '2026-02-23T07:00',
        earlyFinish: '2026-04-17T16:00', completion: 0.5 }, { status: 'STARTED', childIds: ['a'] }),
      task('a', {}, { parentId: 'f' }),
    ], start: "'2026-02-23T07:00:00'", end: "'2026-04-17T16:00:00'" },
    { label: 'dagfase: early om 06:00 wint vóór de kale actual om 07:00', tasks: [
      task('f', { durationUnit: 'days', durationMinutes: undefined, scheduleDuration: 1,
        actualStart: '2026-03-06', earlyStart: '2026-03-06T06:00', completion: 0.5 },
      { status: 'STARTED', childIds: ['a'] }),
      task('a', {}, { parentId: 'f' }),
    ], start: "'2026-03-06T06:00:00'", end: "'2026-04-10T16:00:00'", taskTimeSlots: [7, 8] },
    { label: 'dagfase: invoer om 06:00 wint vóór de kale actual om 07:00', tasks: [
      task('f', { durationUnit: 'days', durationMinutes: undefined, scheduleDuration: 1,
        actualStart: '2026-03-06', earlyStart: '', scheduleStart: '2026-03-06T06:00', completion: 0.5 },
      { status: 'STARTED', childIds: ['a'] }),
      task('a', {}, { parentId: 'f' }),
    ], start: "'2026-03-06T06:00:00'", end: "'2026-04-10T16:00:00'", taskTimeSlots: [5, 8] },
    { label: 'bladen bepalen beide grenzen buiten hun samenvatting', tasks: [
      task('a', {}, { parentId: 'f' }),
      task('f', { earlyStart: '2026-03-02T07:00', earlyFinish: '2026-03-06T16:00' }, { childIds: ['a', 'b'] }),
      task('b', { earlyStart: '2026-02-23T07:00', earlyFinish: '2026-02-27T16:00' }, { parentId: 'f' }),
    ], start: "'2026-02-23T07:00:00'", end: "'2026-04-10T16:00:00'" },
    { label: 'dag- en uurdatums behouden hun native IFC-datetimevorm', tasks: [
      task('a', { earlyStart: '2026-03-06T10:00', earlyFinish: '2026-03-06T13:00' }),
      task('d', { durationUnit: 'days', durationMinutes: undefined, scheduleDuration: 1,
        scheduleStart: '2026-03-06', scheduleFinish: '2026-03-06', earlyStart: '2026-03-06', earlyFinish: '2026-03-06' }),
    ], start: "'2026-03-06T07:00:00'", end: "'2026-03-06T16:00:00'",
      inputDates: { d: ['2026-03-06T07:00', '2026-03-06T16:00'] } },
    { label: 'daganker en uurgrenzen worden vóór min/max genormaliseerd', tasks: [
      task('a', { earlyStart: '2026-03-06T06:00', earlyFinish: '2026-03-06T06:30' }),
      task('d', { durationUnit: 'days', durationMinutes: undefined, scheduleDuration: 1,
        scheduleStart: '2026-03-06', scheduleFinish: '2026-03-06', earlyStart: '2026-03-06', earlyFinish: '2026-03-06' }),
    ], start: "'2026-03-06T06:00:00'", end: "'2026-03-06T16:00:00'",
      inputDates: { d: ['2026-03-06T07:00', '2026-03-06T16:00'] } },
    { label: 'lege taakdatums verdringen geen aanwezige taakdatums', tasks: [task('leeg', noDates), task('a')],
      start: "'2026-04-06T07:00:00'", end: "'2026-04-10T16:00:00'", repeat: false },
    // Ontbrekende taakdatums krijgen bij LEZEN de gedeelde importterugvallen. Hier toetsen we de
    // writer vóór die aanvulling; dat is geen opdracht om invoer of solvergedrag te veranderen.
    { label: 'taak zonder datums valt terug op projectinvoer', tasks: [task('a', noDates)],
      start: "'2026-01-05T08:00:00'", end: "'2026-12-31T17:00:00'", repeat: false },
    { label: 'alleen taakstart ontbreekt', tasks: [task('a', { scheduleStart: '', earlyStart: '' })],
      start: "'2026-01-05T08:00:00'", end: "'2026-04-10T16:00:00'", repeat: false },
    { label: 'alleen taakeinde ontbreekt', tasks: [task('a', { scheduleFinish: '', earlyFinish: '' })],
      start: "'2026-04-06T07:00:00'", end: "'2026-12-31T17:00:00'", repeat: false },
    { label: 'kale projectterugval behoudt het daganker', tasks: [], projectDates: ['2026-01-05', '2026-12-31'],
      start: "'2026-01-05T07:00:00'", end: "'2026-12-31T07:00:00'" },
    { label: 'leeg plan valt terug op projectinvoer', tasks: [],
      start: "'2026-01-05T08:00:00'", end: "'2026-12-31T17:00:00'" },
  ];
  for (const schema of IFC_SCHEMAS) {
    for (const c of cases) {
      const projectDates = c.projectDates ?? ['2026-01-05T08:00', '2026-12-31T17:00'];
      let input: ImportResult = { ...buildProject(projectDates[0], projectDates[1]),
        tasks: c.tasks, sequences: [], resources: [], assignments: [] };
      input.project = { ...input.project, ifcSchema: schema };
      // De uurkalender leest kale taakdatums als expliciete tijden terug: een kale start 00:00 voor
      // uurtaken en het 07:00-anker voor dagtaken, een kaal eindveld het einde van zijn werkdag
      // (knownbug 279). De verwachte normalisatie staat per geval letterlijk vast.
      const originalInput = c.tasks.map(t => [t.id, ...(c.inputDates?.[t.id]
        ?? [t.time.scheduleStart, t.time.scheduleFinish])]);
      for (let round = 1; round <= (c.repeat === false ? 1 : 3); round++) {
        const label = `§7 ${schema}, ${c.label}, ronde ${round}`;
        const before = JSON.stringify(input);
        const text = writeIFC(input);
        same(`${label}: opslaan muteert of berekent niets`, JSON.stringify(input), before);
        same(`${label}: workplan en schema hebben dezelfde getoonde omvang`, spans(text),
          [['IFCWORKPLAN', c.start, c.end], ['IFCWORKSCHEDULE', c.start, c.end]]);
        if (c.taskTimeSlots) {
          const taskTime = parseStep(text).find(e => e.type === 'IFCTASKTIME')!;
          same(`${label}: headergrenzen zijn exact de gekozen IfcTaskTime-slots`,
            c.taskTimeSlots.map(i => taskTime.args[i]),
            [{ k: 'str', raw: c.start }, { k: 'str', raw: c.end }]);
        }
        const parsed = readIFC(text);
        same(`${label}: projectschema behouden`, parsed.project.ifcSchema, schema);
        same(`${label}: contractuele projectinvoer behouden`, [parsed.project.startDate, parsed.project.endDate],
          projectDates);
        if (c.repeat !== false) same(`${label}: broninvoer niet vervangen door planomvang`,
          parsed.tasks.map(t => [t.id, t.time.scheduleStart, t.time.scheduleFinish]), originalInput);
        if (round === 1) {
          const result = checkIfcSchema(label, text, undefined, schema);
          checks += result.checks;
          failures.push(...result.failures);
        }
        input = parsed;
      }
    }
    // StartTime is verplicht: zonder enige start geldt CreationDate. FinishTime mag leeg blijven.
    for (const tasks of [[], [task('a', noDates)]]) {
      const input = { ...buildProject('', ''), tasks, sequences: [], resources: [], assignments: [] };
      input.project = { ...input.project, ifcSchema: schema };
      const text = writeIFC(input);
      const entities = controls(text);
      same(`§7 ${schema}: zonder datums blijven er twee planheaders`, entities.length, 2);
      for (const e of entities) {
        same(`§7 ${schema} ${e.type}: verplichte start valt terug op schrijfmoment`, e.args[11], e.args[6]);
        same(`§7 ${schema} ${e.type}: schrijfmoment is een datumstring`, e.args[11].k, 'str');
        same(`§7 ${schema} ${e.type}: optioneel einde blijft leeg`, e.args[12].k, 'null');
      }
      const parsed = readIFC(text);
      same(`§7 ${schema}: schrijfmoment vult geen expliciet lege projectinvoer`,
        [parsed.project.startDate, parsed.project.endDate], ['', '']);
    }
  }
}

if (failures.length) {
  console.log(`XX  ifc-projectdatum-tijd: ${failures.length} van ${checks} checks faalden`);
  for (const f of failures) console.log(`    - ${f}`);
  process.exit(1);
}
console.log(`OK  ifc-projectdatum-tijd: ${checks} checks`);
