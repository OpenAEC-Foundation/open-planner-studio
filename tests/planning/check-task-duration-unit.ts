import './domStub';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { durationDaysOf, durationMinutesOf } from '@/engine/scheduler/duration';
import { createDefaultTaskTime, mergeTaskTime } from '@/utils/taskDefaults';
import { formatTaskDurationDisplay, taskDurationMinutes } from '@/utils/taskDuration';
import { solveProject } from '@/engine/scheduler/solveProject';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { createAppStoreContext } from '@/state/appStore';
import {
  formatTaskDurationInput,
  parseTaskDurationInput,
  proposeTaskDurationConversion,
} from '@/utils/taskDurationInput';
import { hasConcreteWorkBlocks } from '@/services/subdayIo';
import type { Project } from '@/types/project';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Task } from '@/types/task';

const failures: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, expected: unknown): void {
  checks++;
  if (got !== expected) failures.push(`${label}: verwacht ${JSON.stringify(expected)}, kreeg ${JSON.stringify(got)}`);
}

function deepEq(label: string, got: unknown, expected: unknown): void {
  eq(label, JSON.stringify(got), JSON.stringify(expected));
}

const weekdays = (bands: { start: number; end: number }[]): WorkTimeBands => ({
  byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] },
});

function calendar(id: string, hours: number, end: number, holidays: WorkCalendar['holidays'] = []): WorkCalendar {
  return {
    id,
    name: id,
    description: id,
    workDays: [1, 2, 3, 4, 5],
    workStartHour: 8,
    workEndHour: end / 60,
    hoursPerDay: hours,
    holidays,
    workTime: weekdays([{ start: 480, end }]),
  };
}

function task(unit: 'days' | 'hours', amount: number): Task {
  const time = createDefaultTaskTime('2026-07-06', unit === 'days' ? amount : 0);
  return {
    id: `task-${unit}`,
    name: unit,
    description: '',
    wbsCode: '',
    taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED',
    isMilestone: false,
    priority: 500,
    parentId: null,
    childIds: [],
    resourceIds: [],
    time: {
      ...time,
      durationUnit: unit,
      scheduleDuration: unit === 'days' ? amount : 0,
      ...(unit === 'hours' ? { durationMinutes: amount * 60 } : {}),
    },
  } as Task;
}

function unitOf(time: Task['time']): string | undefined {
  return (time as Task['time'] & { durationUnit?: string }).durationUnit;
}

const h8 = calendar('H8', 8, 960);
const h10 = calendar('H10', 10, 1080);
const day2 = task('days', 2);
const hour12 = task('hours', 12);
const zeroDay = task('days', 0);
const zeroHour = task('hours', 0);

// De taakeenheid, niet de kalender, kiest de bron van waarheid.
eq('dagtaak op uurkalender houdt twee dagen', durationDaysOf(day2, new CalendarEngine(h8)), 2);
eq('dagtaak op 8-uurskalender omvat 16 uur', durationMinutesOf(day2, new CalendarEngine(h8)), 960);
eq('dagtaak op 10-uurskalender omvat 20 uur', durationMinutesOf(day2, new CalendarEngine(h10)), 1200);
eq('urentaak op 8-uurskalender blijft 720 minuten', durationMinutesOf(hour12, new CalendarEngine(h8)), 720);
eq('urentaak op 10-uurskalender blijft 720 minuten', durationMinutesOf(hour12, new CalendarEngine(h10)), 720);
eq('urentaak is op H8 1,5 werkdag', durationDaysOf(hour12, new CalendarEngine(h8)), 1.5);
eq('urentaak is op H10 1,2 werkdag', durationDaysOf(hour12, new CalendarEngine(h10)), 1.2);

function finishOn(t: Task, cal: WorkCalendar): string {
  const copy = { ...t, time: { ...t.time } };
  solveProject({ tasks: [copy], sequences: [], calendar: cal, calendars: [], projectStartDate: '2026-07-06' });
  return copy.time.earlyFinish;
}

function solveError(t: Task, cal: WorkCalendar): string | undefined {
  const copy = { ...t, time: { ...t.time } };
  return solveProject({ tasks: [copy], sequences: [], calendar: cal, calendars: [], projectStartDate: '2026-07-06' }).error;
}

eq('2d eindigt op H8 na twee volledige werkdagen', finishOn(day2, h8), '2026-07-07T16:00');
eq('2d eindigt op H10 na twee volledige werkdagen', finishOn(day2, h10), '2026-07-07T18:00');
eq('12h verdeelt op H8 als 8+4 uur', finishOn(hour12, h8), '2026-07-07T12:00');
eq('12h verdeelt op H10 als 10+2 uur', finishOn(hour12, h10), '2026-07-07T10:00');
eq('0d zonder mijlpaalvlag blijft een nulpunt op de start', finishOn(zeroDay, h8), '2026-07-06T08:00');
eq('0h zonder mijlpaalvlag blijft een nulpunt op de start', finishOn(zeroHour, h8), '2026-07-06T08:00');
const missingHourSource = task('hours', 1);
delete missingHourSource.time.durationMinutes;
eq('urentaak zonder minutenbron wordt niet stil als nul gepland', solveError(missingHourSource, h8), 'Ongeldige urenduur voor taak "hours"');
eq('negatieve urenduur wordt voor mutatie geweigerd', solveError(task('hours', -1), h8), 'Ongeldige urenduur voor taak "hours"');
eq('negatieve dagduur wordt voor mutatie geweigerd', solveError(task('days', -1), h8), 'Ongeldige dagduur voor taak "days"');

const progressingDay = {
  ...day2,
  id: 'progressing-day',
  time: {
    ...day2.time,
    completion: 0.5,
    actualStart: '2026-07-06T08:00',
    remainingTime: 1,
    // Een oude/importspecifieke minuutwaarde mag de dagidentiteit niet overnemen.
    remainingMinutes: 60,
  },
};
eq('dagtaakvoortgang op uurkalender blijft in hele werkdagen rekenen', finishOn(progressingDay, h8), '2026-07-06T16:00');

// Kalenderwissel verandert nooit de opgeslagen identiteit of hoeveelheid.
eq('kalenderwissel bewaart dag-unit', unitOf(day2.time), 'days');
eq('kalenderwissel bewaart dag-aantal', day2.time.scheduleDuration, 2);
eq('kalenderwissel bewaart uur-unit', unitOf(hour12.time), 'hours');
eq('kalenderwissel bewaart minuten', hour12.time.durationMinutes, 720);

// Een gedeeltelijke werkdag is één dag voor een dagtaak, maar slechts haar werkminuten voor uren.
const partial = calendar('Partial', 4, 720);
eq('gedeeltelijke dag telt als één dag', durationDaysOf(task('days', 1), new CalendarEngine(partial)), 1);
eq('gedeeltelijke dag levert vier uur capaciteit', durationMinutesOf(task('days', 1), new CalendarEngine(partial)), 240);
eq('dagtaak gebruikt de hele gedeeltelijke werkdag', finishOn(task('days', 1), partial), '2026-07-06T12:00');
eq('urentaak telt alleen concrete gedeeltelijke uren', finishOn(task('hours', 6), partial), '2026-07-07T10:00');

// Feestdagen veranderen de plaatsing, niet de duur-identiteit.
const holiday = calendar('Holiday', 8, 960, [{ name: 'Feestdag', startDate: '2026-07-07', endDate: '2026-07-07' }]);
eq('twee werkdagen slaan feestdag over', holiday.id && new CalendarEngine(holiday).addWorkDays(new Date('2026-07-06T08:00:00Z'), 2).toISOString(), '2026-07-08T08:00:00.000Z');
eq('feestdag verandert dag-unit niet', unitOf(day2.time), 'days');
eq('dagtaakplanning slaat feestdag over', finishOn(day2, holiday), '2026-07-08T16:00');

// Legacy-migratie is deterministisch en blijft daarna expliciet.
const legacyDays = createDefaultTaskTime('2026-07-06', 2) as Task['time'];
const legacyHours = { ...createDefaultTaskTime('2026-07-06', 0), durationMinutes: 725 } as Task['time'];
delete (legacyDays as unknown as { durationUnit?: string }).durationUnit;
delete (legacyHours as unknown as { durationUnit?: string }).durationUnit;
eq('legacy zonder minuten migreert naar dagen', unitOf(mergeTaskTime(legacyDays, {})), 'days');
eq('legacy met minuutprecisie migreert naar uren', unitOf(mergeTaskTime(legacyHours, {})), 'hours');
eq('legacy minuutprecisie wordt niet afgerond', mergeTaskTime(legacyHours, {}).durationMinutes, 725);
const hourBase = { ...createDefaultTaskTime('2026-07-06', 0, 'hours'), durationMinutes: 240 };
eq('los wissen kan de native minutenbron van een urentaak niet verwijderen', mergeTaskTime(hourBase, { durationMinutes: undefined }).durationMinutes, 240);
eq('atomair wisselen naar dagen wist de oude minutenbron wel', mergeTaskTime(hourBase, { durationUnit: 'days', scheduleDuration: 2, durationMinutes: undefined }).durationMinutes, undefined);

// Compacte weergave houdt de native uuridentiteit zichtbaar.
eq('auto toont dagtaak in dagen', formatTaskDurationDisplay(day2, h8, 'auto', true), '2d');
eq('auto toont 12 uur als uren', formatTaskDurationDisplay(hour12, h8, 'auto', true), '12h');
eq('auto toont ook een exact volle urentaak in haar gekozen eenheid', formatTaskDurationDisplay(task('hours', 16), h8, 'auto', true), '16h');
eq('pure helper respecteert urenbron ook na kalenderwissel', taskDurationMinutes(hour12, h10), 720);
eq('geforceerde dagenweergave houdt uurbron herkenbaar', formatTaskDurationDisplay(hour12, h8, 'days', true), '1.5d(12h)');
eq('geforceerde urenweergave houdt dagbron herkenbaar', formatTaskDurationDisplay(day2, h8, 'hours', true), '16h(2d)');

// Dialoog en paneel delen deze ene parser/conversielaag.
deepEq('suffix d kiest dagen', parseTaskDurationInput('2d', 'hours'), { unit: 'days', scheduleDuration: 2, explicitUnit: true });
deepEq('suffix h kiest uren', parseTaskDurationInput('12h', 'days'), { unit: 'hours', durationMinutes: 720, explicitUnit: true });
deepEq('Nederlandse u blijft invoeralias', parseTaskDurationInput('12u', 'days'), { unit: 'hours', durationMinutes: 720, explicitUnit: true });
eq('negatieve dagen worden geweigerd', parseTaskDurationInput('-2d', 'days'), null);
eq('negatieve uren worden geweigerd', parseTaskDurationInput('-2h', 'hours'), null);
eq('compacte invoerweergave gebruikt universeel h', formatTaskDurationInput(hour12), '12h');
eq('bestaande minuutprecisie blijft zichtbaar', formatTaskDurationInput({ ...hour12, time: { ...hour12.time, durationMinutes: 725 } }), '12h 5m');
eq('kalender zonder werkblokken wordt herkend', hasConcreteWorkBlocks({ ...h8, workTime: undefined }), false);
eq('uurkeuze zonder werkblokken heeft geen conversievoorstel', proposeTaskDurationConversion(day2, 'hours', { ...h8, workTime: undefined }), null);
const hourWithoutBlocks = { ...hour12, time: { ...hour12.time } };
const hourWithoutBlocksResult = solveProject({
  tasks: [hourWithoutBlocks], sequences: [], calendar: { ...h8, workTime: undefined }, calendars: [],
  projectStartDate: '2026-07-06',
});
eq('bestaande urentaak zonder werkblokken krijgt geen dagfallback', hourWithoutBlocksResult.error?.includes('concrete werkblokken'), true);
eq('geblokkeerde solve bewaart uur-unit', hourWithoutBlocks.time.durationUnit, 'hours');
eq('geblokkeerde solve bewaart exacte minuten', hourWithoutBlocks.time.durationMinutes, 720);
deepEq('2d op H8 krijgt exact 16h als voorstel', proposeTaskDurationConversion(day2, 'hours', h8), { unit: 'hours', durationMinutes: 960, explicitUnit: true });
eq('12h wordt niet stil naar 1,5d afgerond', proposeTaskDurationConversion(hour12, 'days', h8), null);
deepEq('16h wordt exact naar 2d voorgesteld', proposeTaskDurationConversion(task('hours', 16), 'days', h8), { unit: 'days', scheduleDuration: 2, explicitUnit: true });

// Storecontract: projectdefault, normale mutatie, undo/redo, clipboard en documentwissel.
const context = createAppStoreContext();
const store = context.store;
store.getState().setUI({ enableHourPlanning: true });
store.getState().setCalendar(h8);
store.getState().setProject({ defaultTaskDurationUnit: 'hours' });
const storeTaskId = store.getState().addTask({ name: 'Nieuwe urentaak' });
eq('projectdefault maakt nieuwe handmatige taak uren', store.getState().tasks[0]?.time.durationUnit, 'hours');
eq('standaardhoeveelheid wordt als vijf uur opgeslagen', store.getState().tasks[0]?.time.durationMinutes, 300);
eq('vijf uur krijgt op H8 een coherent dagequivalent', store.getState().tasks[0]?.time.scheduleDuration, 0.625);
const noBandsContext = createAppStoreContext();
noBandsContext.store.getState().setUI({ enableHourPlanning: true });
noBandsContext.store.getState().setProject({ defaultTaskDurationUnit: 'hours' });
noBandsContext.store.getState().addTask({ name: 'Veilige dagtaak zonder werkblokken' });
eq('urenprojectdefault maakt zonder concrete werkblokken geen onplanbare urentaak',
  noBandsContext.store.getState().tasks[0]?.time.durationUnit, 'days');
const beforeUnitChange = store.getState().tasks[0]!;
store.getState().updateTask(storeTaskId, {
  time: { ...beforeUnitChange.time, durationUnit: 'days', scheduleDuration: 2, durationMinutes: undefined },
});
eq('normale mutatie kan expliciet naar dagen', store.getState().tasks[0]?.time.durationUnit, 'days');
store.getState().undo();
eq('undo herstelt uur-unit', store.getState().tasks[0]?.time.durationUnit, 'hours');
eq('undo herstelt exacte minuten', store.getState().tasks[0]?.time.durationMinutes, 300);
store.getState().redo();
eq('redo herstelt dag-unit', store.getState().tasks[0]?.time.durationUnit, 'days');
store.getState().undo();
store.getState().copyTasks([storeTaskId]);
store.getState().pasteTasks();
eq('clipboardkopie bewaart uur-unit', store.getState().tasks[1]?.time.durationUnit, 'hours');
eq('clipboardkopie bewaart minuten', store.getState().tasks[1]?.time.durationMinutes, 300);
const sourceDocumentId = store.getState().activeDocumentId;
const secondDocumentId = store.getState().newDocument();
eq('nieuw document erft projectdefault niet stil', store.getState().project.defaultTaskDurationUnit, 'days');
store.getState().switchDocument(sourceDocumentId);
eq('documentwissel herstelt uur-unit', store.getState().tasks[0]?.time.durationUnit, 'hours');
eq('documentwissel herstelt minuten', store.getState().tasks[0]?.time.durationMinutes, 300);
eq('recovery-payload houdt uur-unit', store.getState().getOpenDocumentPayloads().find((d) => d.id === sourceDocumentId)?.payload.tasks[0]?.time.durationUnit, 'hours');
eq('tweede document blijft geopend', store.getState().documents.some((d) => d.id === secondDocumentId), true);

const project: Project = {
  id: 'project-duration-unit', name: 'Duur', description: '', startDate: '2026-07-06', endDate: '',
  calendarId: h8.id, createdAt: '2026-07-01T00:00:00Z', modifiedAt: '2026-07-01T00:00:00Z',
  author: '', company: '', defaultTaskDurationUnit: 'hours',
};
const ifc = writeIFC({
  project,
  calendar: h8,
  tasks: [day2, hour12],
  sequences: [],
  resources: [],
  assignments: [],
});
eq('IFC schrijft dagtaak als P-duur zonder tijdcomponent', /IFCTASKTIME\([^\n]*'P0Y0M2D'/.test(ifc), true);
eq('IFC schrijft urentaak als PT-duur', /IFCTASKTIME\([^\n]*'PT12H0M0S'/.test(ifc), true);
const reloaded = readIFC(ifc);
const reloadedDay = reloaded.tasks.find((candidate) => candidate.name === 'days')!;
const reloadedHour = reloaded.tasks.find((candidate) => candidate.name === 'hours')!;
eq('IFC roundtrip bewaart dag-unit', reloadedDay.time.durationUnit, 'days');
eq('IFC roundtrip bewaart dagaantal', reloadedDay.time.scheduleDuration, 2);
eq('IFC roundtrip maakt geen concurrerende minutenbron op dagtaak', reloadedDay.time.durationMinutes, undefined);
eq('IFC roundtrip bewaart uur-unit', reloadedHour.time.durationUnit, 'hours');
eq('IFC roundtrip bewaart minuten exact', reloadedHour.time.durationMinutes, 720);
eq('IFC roundtrip bewaart projectstandaard', reloaded.project.defaultTaskDurationUnit, 'hours');

if (failures.length > 0) {
  for (const failure of failures) console.log(`XX  ${failure}`);
  console.log(`\n${failures.length}/${checks} T1-duureenheidchecks mislukt.`);
  process.exit(1);
}

console.log(`OK  T1-duureenheid: ${checks} checks groen.`);
