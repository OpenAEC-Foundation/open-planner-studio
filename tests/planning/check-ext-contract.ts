// Het publieke extensie-contract — volledigheid van de mappers, in beide richtingen.
//
// AANLEIDING (K-item 37). `extTypes.ts` bestaat om het interne domeinmodel NIET aan extensies te
// lekken, en `extMappers.ts` is de enige grensovergang. De kop van die mapper-module zegt het zelf
// al: verplichte velden vangt de compiler, maar **optionele velden niet** — een veld weglaten uit
// een object-literal is legaal TypeScript. Voeg je dus `ExtTask.deadline` toe en vergeet je hem in
// `toExtTask`, dan compileert alles en zien extensies het veld simpelweg nooit. Precies de klasse
// fout die stil blijft tot een gebruiker hem meldt.
//
// WAT HIER STAAT, EN WAAROM IN DEZE VORM.
//
//   (a) Per DTO een SLEUTELLIJST op waardeniveau, met een compile-time assertie in beide richtingen
//       tegen `keyof Required<Ext*>`. Een nieuw (ook optioneel) veld in het contract geeft dus een
//       COMPILEERFOUT hier, niet een stille lacune. Dit is hetzelfde patroon als
//       `_assertPickCoversRoles` in `state/snapshot.ts`.
//   (b) Een MAXIMALE fixture per interne vorm — élk optioneel veld gevuld — met `satisfies` tegen
//       het interne type. Een nieuw INTERN veld breekt de fixture pas als het verplicht is; voor
//       optionele interne velden doet de sleutellijst in (c) het werk.
//   (c) Voor de terugrichting een expliciete lijst interne velden die BEWUST niet oversteken. Dat
//       is het waardevolste deel: "wat stellen we niet bloot" was tot nu toe nergens vastgelegd en
//       dus niet te onderscheiden van "vergeten".
//   (d) De isolatie-eigenschap waar de hele mapper-laag om draait: een extensie krijgt een VERSE,
//       diepe kopie en kan de (Immer-bevroren) store niet via zijn kopie raken.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type {
  ExtProject, ExtCalendar, ExtTask, ExtTaskTime, ExtSequence, ExtResource, ExtAssignment,
  ExtRibbonTab, ExtFontProvider, ExtImportSourceInfo,
} from '@/extensions/extTypes';
import { EXT_IMPORT_SOURCE_PAGE_SIZE_MAX } from '@/extensions/extTypes';
import type { ExtensionApi, ExtensionPermission } from '@/extensions/types';
import {
  createExtensionApi,
  type ExtensionHostBinding,
} from '@/extensions/extensionApi';
import type { AppStoreContext } from '@/state/appStore';
import { EXTENSION_API_VERSION, checkApiCompatibility } from '@/extensions/apiVersion';
import { KNOWN_PERMISSIONS, sanitizeManifestPermissions } from '@/extensions/permissions';
import {
  toExtProject, fromExtProject,
  toExtCalendar, fromExtCalendar,
  toExtTask, fromExtTask,
  fromExtImportResult,
  toExtTaskTime, fromExtTaskTime,
  toExtSequence, fromExtSequence,
  toExtResource, fromExtResource,
  toExtAssignment, fromExtAssignment,
  fromExtTaskInput, fromExtTaskUpdates,
  fromExtRibbonTab, fromExtFontProvider,
} from '@/extensions/extMappers';
import { getExtensionSdk } from '@/extensions/sdk';
import { appStoreContext, useAppStore } from '@/state/appStore';
import { readXER } from '@/services/xer/xerReader';
import { isMultiDocumentImport } from '@/services/importTypes';
import { decodeXerSourceArchive, sha256Hex } from '@/services/xerSourceArchive';
import { ExtImportSourceDriftError } from '@/extensions/extImportSource';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// ── (a) Sleutellijsten, compile-time vastgeklonken aan de types ──────────────
//
// `keys<T>()(lijst)` faalt te compileren zodra de lijst en `keyof Required<T>` uit elkaar lopen —
// in BEIDE richtingen. Een vergeten sleutel geeft "mist:", een verzonnen sleutel geeft "te veel:".
function keys<T>() {
  return <K extends readonly (keyof Required<T>)[]>(
    lijst: K & ([keyof Required<T>] extends [K[number]] ? unknown : ['mist:', Exclude<keyof Required<T>, K[number]>]),
  ): readonly (keyof Required<T>)[] => lijst;
}

const EXT_PROJECT_KEYS = keys<ExtProject>()([
  'id', 'name', 'description', 'startDate', 'endDate', 'calendarId', 'createdAt', 'modifiedAt',
  'author', 'company', 'wbsAutoNumber', 'statusDate', 'progressMode', 'defaultTaskDurationUnit', 'defaultWorkRule', 'schedulingOptions',
] as const);

const EXT_CALENDAR_KEYS = keys<ExtCalendar>()([
  'id', 'name', 'description', 'workDays', 'workStartHour', 'workEndHour', 'hoursPerDay',
  'simpleBreakStartMinute', 'simpleBreakDurationMinutes', 'holidays', 'workTime', 'shift', 'workingExceptions',
  'p6Source', 'p6NonWorkPenaltyDates',
] as const);

const EXT_TASK_TIME_KEYS = keys<ExtTaskTime>()([
  'durationType', 'durationUnit', 'scheduleDuration', 'durationMinutes', 'scheduleStart', 'scheduleFinish',
  'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'freeFloat', 'totalFloat', 'isCritical',
  'interferingFloat', 'isNearCritical', 'floatPath', 'actualStart', 'actualFinish',
  'actualDuration', 'remainingTime', 'remainingMinutes', 'completion', 'resume', 'stop',
] as const);

const EXT_TASK_KEYS = keys<ExtTask>()([
  'id', 'name', 'description', 'wbsCode', 'taskType', 'customTaskType', 'status', 'isMilestone', 'milestoneKind',
  'mandatory', 'priority', 'levelingDelay', 'parentId', 'childIds', 'isSummary', 'time', 'resourceIds', 'color',
  'activityCodes', 'customFields', 'constraint', 'constraint2', 'isHammock', 'externalLinks',
  'deadline', 'calendarId', 'notes',
  // fase 3.8 (.mpp-datumgetrouwheid): leeskant-velden uit de import, zie extTypes.ts
  'levelingDelayMinutes', 'levelingDelayElapsed', 'splitGaps', 'manuallyScheduled',
  'mspTaskType', 'effortDriven', 'timephasedContours',
  'timephasedFinishFloor', 'timephasedStartAnchor', 'timephasedDurationWalks',
  // taaktypes-etappe (ontwerp 2026-09-04): de neutrale werkregel
  'workRule',
  // X0 (XER-etappeplan, 2026-08-20): drie nieuwe .xer-importvelden, zelfde behandeling als de
  // .mpp-velden hierboven.
  'p6DurationType', 'p6ActivityType', 'p6ProjectId', 'p6TaskId', 'p6ExplicitTargetWindow', 'p6CompletePctType', 'p6ExpectedFinish', 'p6SuspendResume',
] as const);

const EXT_SEQUENCE_KEYS = keys<ExtSequence>()([
  'id', 'predecessorId', 'successorId', 'type', 'lagDays', 'lagMinutes', 'lagUnit', 'lagPercent',
  'p6StartAtPredecessorFinishBoundary',
] as const);

const EXT_RESOURCE_KEYS = keys<ExtResource>()([
  'id', 'name', 'type', 'description', 'costPerHour', 'maxUnits', 'calendarId',
  'availabilitySteps', 'unitOfMeasure', 'parentId', 'color',
] as const);

const EXT_ASSIGNMENT_KEYS = keys<ExtAssignment>()([
  'id', 'taskId', 'resourceId', 'unitsPerDay', 'curve', 'workWindowStart', 'workWindowFinish', 'curveValues',
  // taaktypes-etappe (spec §4.3): de drie optionele werkvelden
  'plannedWorkMinutes', 'actualWorkMinutes', 'remainingWorkMinutes',
] as const);

// ── (c) Interne velden die BEWUST niet oversteken ────────────────────────────
//
// Elke entry is een BESLISSING, geen omissie. Staat een intern veld hier niet én niet in het
// ext-contract, dan valt het onder deel 2 hieronder rood.
const NIET_PUBLIEK = {
  // Bibliotheekbinding (spec B1): de bibliotheek is app-globaal en wordt buiten het document
  // beheerd. Een extensie die deze stempels kon zetten zou een projectkopie kunnen laten dóén
  // alsof hij uit een bibliotheek komt.
  project: ['companyId', 'companyName'] as readonly string[],
  // De penaltydiagnose is een IFC-leesdiagnose, geen extensie-invoer of -uitvoer. De geldige
  // brongegevens zelf (`p6Source` + lijst) blijven wél rondtrippend beschikbaar.
  calendar: ['generation', 'libraryOrigin', 'p6NonWorkPenaltyDatesState'] as readonly string[],
  resource: ['availability', 'libraryOrigin'] as readonly string[],
  task: [] as readonly string[],
  taskTime: [] as readonly string[],
  sequence: [] as readonly string[],
  assignment: [] as readonly string[],
};

// Zichtbare velden die een extensie uitsluitend mag LEZEN. Dit is een andere grens dan
// `NIET_PUBLIEK`: `toExt*` geeft ze bewust door, maar `fromExt*` accepteert ze niet als generieke
// solverinvoer. Alleen de native XER-reader mag de relationele P6-bronvlag afleiden.
const LEES_ALLEEN_EXT = {
  project: [] as readonly string[],
  calendar: ['p6Source', 'p6NonWorkPenaltyDates'] as readonly string[],
  resource: [] as readonly string[],
  task: [
    'p6DurationType', 'p6ActivityType', 'p6ProjectId', 'p6TaskId', 'p6ExplicitTargetWindow',
    'p6CompletePctType', 'p6ExpectedFinish', 'p6SuspendResume',
  ] as readonly string[],
  taskTime: [] as readonly string[],
  sequence: ['p6StartAtPredecessorFinishBoundary'] as readonly string[],
  assignment: [] as readonly string[],
};

const PUBLIC_SCHEDULING_OPTION_KEYS = [
  'lagCalendar', 'criticalDefinition', 'totalFloatMode', 'makeOpenEndedCritical',
  'nearCriticalThreshold', 'floatPaths',
] as const;

// ── (b) Maximale fixtures — élk optioneel veld gevuld ────────────────────────

const VOL_TIME = {
  durationType: 'WORKTIME',
  durationUnit: 'hours',
  scheduleDuration: 5,
  durationMinutes: 2400,
  scheduleStart: '2026-06-01',
  scheduleFinish: '2026-06-05',
  earlyStart: '2026-06-01',
  earlyFinish: '2026-06-05',
  lateStart: '2026-06-02',
  lateFinish: '2026-06-08',
  freeFloat: 1,
  totalFloat: 2,
  isCritical: false,
  interferingFloat: 1,
  isNearCritical: true,
  floatPath: 3,
  actualStart: '2026-06-01',
  actualFinish: '2026-06-04',
  actualDuration: 3,
  remainingTime: 2,
  remainingMinutes: 960,
  completion: 0.6,
  resume: '2026-06-05T10:00',
  stop: '2026-06-04T14:00',
} satisfies Required<TaskTime>;

const VOL_TASK = {
  id: 't1',
  name: 'Fundering',
  description: 'beschrijving',
  wbsCode: '1.2',
  taskType: 'USERDEFINED',
  customTaskTypeId: 'ops-ext-type',
  status: 'STARTED',
  isMilestone: false,
  milestoneKind: 'FINISH',
  mandatory: true,
  priority: 400,
  levelingDelay: 2,
  // fase 3.8 (.mpp-datumgetrouwheid): de import-tijd-velden, allemaal gevuld — in de VOLGORDE van
  // `fromExtTask` (de round-trip-check vergelijkt via JSON.stringify en is dus volgorde-gevoelig).
  levelingDelayMinutes: 90,
  levelingDelayElapsed: true,
  splitGaps: [{ afterMinutes: 480, gapMinutes: 960 }],
  manuallyScheduled: true,
  mspTaskType: 'FIXED_WORK',
  effortDriven: true,
  workRule: 'FIXED_RATE',
  // X0 (XER-etappeplan): drie nieuwe .xer-importvelden, allemaal gevuld — zelfde volgorde-eis als
  // de .mpp-velden hierboven (de round-trip-check vergelijkt via JSON.stringify).
  p6DurationType: 'DT_FixedDUR2',
  p6ActivityType: 'TT_Rsrc',
  p6ProjectId: 'P1', p6TaskId: 'T1', p6ExplicitTargetWindow: true, p6CompletePctType: 'CP_Phys', p6ExpectedFinish: '2026-06-11T17:00',
  p6SuspendResume: true,
  timephasedContours: [{ resourceUid: 3, periods: [{ afterMinutes: 0, minutes: 480, workMinutes: 240, kind: 'remaining' }] }],
  timephasedFinishFloor: '2026-06-10T17:00',
  timephasedStartAnchor: '2026-06-01T08:00',
  timephasedDurationWalks: [{ anchor: '2026-06-01T08:00', resourceCalendarId: 'cal2', workMinutes: 480 }],
  parentId: 'p1',
  childIds: ['c1', 'c2'],
  isSummary: true,
  time: VOL_TIME,
  resourceIds: ['r1'],
  color: '#abcdef',
  activityCodes: { ct1: 'cv1' },
  customFields: { f1: 'waarde' },
  constraint: { type: 'SNET', date: '2026-06-01', hard: true },
  constraint2: { type: 'FNLT', date: '2026-06-30', hard: false },
  isHammock: true,
  externalLinks: [{
    id: 'x1', direction: 'predecessor', relType: 'FS', lagDays: 1, lagMinutes: 480,
    anchorDate: '2026-05-30',
    sourceRef: { projectId: 'p9', projectName: 'Ander', taskId: 't9', taskName: 'Taak 9', filePath: '/a.ifc' },
    sourceMissing: false,
  }],
  deadline: '2026-07-01',
  calendarId: 'cal2',
  notes: [{ id: 'n1', text: 'let op', done: false }],
} satisfies Required<Task>;

const VOL_PROJECT = {
  id: 'proj', name: 'Project', description: 'omschrijving',
  startDate: '2026-01-05', endDate: '2026-12-31', calendarId: 'cal1',
  createdAt: '2026-01-01T00:00:00', modifiedAt: '2026-01-02T00:00:00',
  author: 'Auteur', company: 'Bedrijf',
  wbsAutoNumber: true, statusDate: '2026-06-01', progressMode: 'PROGRESS_OVERRIDE',
  defaultTaskDurationUnit: 'days',
  defaultWorkRule: 'FIXED_DURATION_WORK',
  schedulingOptions: {
    lagCalendar: 'successor',
    criticalDefinition: { mode: 'longestPath', threshold: -1 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: true,
    nearCriticalThreshold: 3,
    floatPaths: { enabled: true, method: 'TOTAL_FLOAT', maxPaths: 5 },
  },
  companyId: 'bedrijf-1', companyName: 'Bibliotheek BV',
} satisfies Required<Project>;

const VOL_CALENDAR = {
  id: 'cal1', name: 'Kalender', description: 'omschrijving',
  workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
  simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60,
  holidays: [{ name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' }],
  generation: { ruleSetId: 'NL', generatedFromYear: 2026, generatedToYear: 2028, region: 'noord', breakChoice: 'noord' },
  workTime: { byWeekday: { 1: [{ start: 420, end: 960 }], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } },
  shift: 'SECOND',
  workingExceptions: [{ name: 'Inhaaldag', startDate: '2026-06-06', endDate: '2026-06-06' }],
  p6Source: 'XER',
  p6NonWorkPenaltyDates: ['2026-06-07'],
  p6NonWorkPenaltyDatesState: 'VALID_VALUES',
  libraryOrigin: { companyId: 'b1', libraryItemId: 'i1', poolVersion: 2, syncedHash: 'h1' },
} satisfies Required<WorkCalendar>;

const VOL_SEQUENCE = {
  id: 's1', predecessorId: 'a', successorId: 'b', type: 'START_START',
  lagDays: 2, lagMinutes: 960, lagUnit: 'ELAPSEDTIME', lagPercent: 50,
  p6StartAtPredecessorFinishBoundary: false,
} satisfies Required<Sequence>;

// X12-fixronde: P6-relatieherkomst is uitleesbaar voor analyse, maar een gewone extensie-import
// of `addSequence` mag nooit zelf P6-solvergedrag inschakelen. Alleen de native XER-lezer heeft
// een expliciete bronmodus die deze vlag mag materialiseren.
eq('X12 extensie leest de P6-relatievlag uit maar voert haar niet generiek terug in', {
  exposed: toExtSequence({ ...VOL_SEQUENCE, p6StartAtPredecessorFinishBoundary: true })
    .p6StartAtPredecessorFinishBoundary,
  imported: fromExtSequence({ ...VOL_SEQUENCE, p6StartAtPredecessorFinishBoundary: true })
    .p6StartAtPredecessorFinishBoundary,
}, { exposed: true, imported: undefined });

{
  const hostileOptions = {
    ...VOL_PROJECT.schedulingOptions,
    p6Source: 'XER' as const,
    useExpectedFinishDates: true,
    preserveActualDatesInBackwardPass: true,
    clampNegativeFreeFloat: true,
    p6ZeroDurationUsesPlannedBoundary: true,
    p6UseTaskPlannedStartFloor: true,
    p6FinishMilestoneBoundaryWindow: true,
    p6PreserveActualInstants: true,
    p6UseRemainingStartForProgress: true,
    p6PreserveZeroDurationConstraintInstants: true,
    useProjectEndDateForFloat: true,
    resumeFromActualElapsed: true,
    unstartedIgnoresStatusDate: true,
  };
  const imported = fromExtProject({
    ...toExtProject(VOL_PROJECT),
    schedulingOptions: hostileOptions,
  } as ExtProject);
  eq('X12 generieke extensie-invoer reconstrueert uitsluitend de publieke schedulingOptions-whitelist',
    Object.keys(imported.schedulingOptions ?? {}).sort(), [...PUBLIC_SCHEDULING_OPTION_KEYS].sort());
  eq('X12 toExtProject toont evenmin interne runtime-opties uit een intern project',
    Object.keys(toExtProject({ ...VOL_PROJECT, schedulingOptions: hostileOptions }).schedulingOptions ?? {}).sort(),
    [...PUBLIC_SCHEDULING_OPTION_KEYS].sort());
}

{
  const exposed = toExtCalendar(VOL_CALENDAR);
  const imported = fromExtCalendar({
    ...exposed,
    p6Source: 'XER',
    p6NonWorkPenaltyDates: ['2026-06-07'],
    p6NonWorkPenaltyDatesState: 'VALID_VALUES',
  } as ExtCalendar & { p6NonWorkPenaltyDatesState: string });
  eq('X12 kalenderherkomst is zichtbaar in het read-model maar generieke invoer activeert haar niet', {
    exposedSource: exposed.p6Source,
    exposedDates: exposed.p6NonWorkPenaltyDates,
    importedSource: imported.p6Source,
    importedDates: imported.p6NonWorkPenaltyDates,
    importedState: imported.p6NonWorkPenaltyDatesState,
  }, {
    exposedSource: 'XER', exposedDates: ['2026-06-07'],
    importedSource: undefined, importedDates: undefined, importedState: undefined,
  });
}

{
  const exposed = toExtTask(VOL_TASK);
  const imported = fromExtTask(exposed);
  eq('X12 P6-taakherkomst is zichtbaar in het read-model maar generieke invoer activeert haar niet', {
    exposed: {
      p6DurationType: exposed.p6DurationType,
      p6ActivityType: exposed.p6ActivityType,
      p6ProjectId: exposed.p6ProjectId,
      p6TaskId: exposed.p6TaskId,
      p6ExplicitTargetWindow: exposed.p6ExplicitTargetWindow,
      p6CompletePctType: exposed.p6CompletePctType,
      p6ExpectedFinish: exposed.p6ExpectedFinish,
      p6SuspendResume: exposed.p6SuspendResume,
    },
    imported: {
      p6DurationType: imported.p6DurationType,
      p6ActivityType: imported.p6ActivityType,
      p6ProjectId: imported.p6ProjectId,
      p6TaskId: imported.p6TaskId,
      p6ExplicitTargetWindow: imported.p6ExplicitTargetWindow,
      p6CompletePctType: imported.p6CompletePctType,
      p6ExpectedFinish: imported.p6ExpectedFinish,
      p6SuspendResume: imported.p6SuspendResume,
    },
  }, {
    exposed: {
      p6DurationType: 'DT_FixedDUR2', p6ActivityType: 'TT_Rsrc',
      p6ProjectId: 'P1', p6TaskId: 'T1', p6ExplicitTargetWindow: true, p6CompletePctType: 'CP_Phys',
      p6ExpectedFinish: '2026-06-11T17:00', p6SuspendResume: true,
    },
    imported: {},
  });

  const p6Keys = [
    'p6DurationType', 'p6ActivityType', 'p6ProjectId', 'p6TaskId', 'p6ExplicitTargetWindow',
    'p6CompletePctType', 'p6ExpectedFinish', 'p6SuspendResume',
  ];
  const hostileTask = { ...exposed } as ExtTask;
  const added = fromExtTaskInput({ ...hostileTask, name: 'kwaadaardige extensietaak' });
  const updated = fromExtTaskUpdates(hostileTask);
  const importedResult = fromExtImportResult({
    project: toExtProject(VOL_PROJECT),
    calendar: toExtCalendar(VOL_CALENDAR),
    tasks: [hostileTask], sequences: [], resources: [], assignments: [],
  });
  const presentP6Keys = (value: object): string[] =>
    p6Keys.filter(key => Object.prototype.hasOwnProperty.call(value, key));
  eq('X12 geen enkel from-extensionpad accepteert P6-taakprovenance', {
    full: presentP6Keys(imported),
    add: presentP6Keys(added),
    update: presentP6Keys(updated),
    importResult: presentP6Keys(importedResult.tasks[0]),
  }, { full: [], add: [], update: [], importResult: [] });
}

const VOL_RESOURCE = {
  id: 'r1', name: 'Kraan', type: 'EQUIPMENT', description: 'omschrijving',
  color: '#2563EB',
  costPerHour: 120, availability: 1, maxUnits: 2, calendarId: 'cal2',
  availabilitySteps: [{ from: '2026-03-01', maxUnits: 3 }],
  unitOfMeasure: 'stuks', parentId: 'crew1',
  libraryOrigin: { companyId: 'b1', libraryItemId: 'i2', poolVersion: 1, syncedHash: 'h2' },
} satisfies Required<Resource>;

const VOL_ASSIGNMENT = {
  id: 'a1', taskId: 't1', resourceId: 'r1', unitsPerDay: 0.5, curve: 'BELL',
  workWindowStart: '2026-06-01T08:00', workWindowFinish: '2026-06-10T17:00',
  curveValues: [0, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5],
  plannedWorkMinutes: 4800, actualWorkMinutes: 1200, remainingWorkMinutes: 3000,
} satisfies Required<ResourceAssignment>;

// ── 1. `toExt*` laat geen contractveld vallen ────────────────────────────────
const aanwezig = (o: object, k: readonly (string | number | symbol)[]) => k.filter(x => !(x in o));

eq('1 toExtProject vult elk ExtProject-veld', aanwezig(toExtProject(VOL_PROJECT), EXT_PROJECT_KEYS), []);
eq('2 toExtCalendar vult elk ExtCalendar-veld', aanwezig(toExtCalendar(VOL_CALENDAR), EXT_CALENDAR_KEYS), []);
eq('3 toExtTaskTime vult elk ExtTaskTime-veld', aanwezig(toExtTaskTime(VOL_TIME), EXT_TASK_TIME_KEYS), []);
eq('4 toExtTask vult elk ExtTask-veld', aanwezig(toExtTask(VOL_TASK), EXT_TASK_KEYS), []);
eq('5 toExtSequence vult elk ExtSequence-veld', aanwezig(toExtSequence(VOL_SEQUENCE), EXT_SEQUENCE_KEYS), []);
eq('6 toExtResource vult elk ExtResource-veld', aanwezig(toExtResource(VOL_RESOURCE), EXT_RESOURCE_KEYS), []);
eq('7 toExtAssignment vult elk ExtAssignment-veld', aanwezig(toExtAssignment(VOL_ASSIGNMENT), EXT_ASSIGNMENT_KEYS), []);

// De waarden moeten óók echt overkomen, niet alleen de sleutels — een mapper die overal
// `undefined` neerzet zou de check hierboven passeren.
for (const k of EXT_TASK_KEYS) {
  if (k === 'time') continue; // apart, hieronder
  if (k === 'customTaskType') {
    eq('8 toExtTask draagt de stabiele custom-type-id over', toExtTask(VOL_TASK).customTaskType, { id: VOL_TASK.customTaskTypeId });
    continue;
  }
  eq(`8 toExtTask draagt "${String(k)}" over`,
    (toExtTask(VOL_TASK) as unknown as Record<string, unknown>)[k as string],
    (VOL_TASK as unknown as Record<string, unknown>)[k as string]);
}
for (const k of EXT_TASK_TIME_KEYS) {
  eq(`9 toExtTaskTime draagt "${String(k)}" over`,
    (toExtTaskTime(VOL_TIME) as unknown as Record<string, unknown>)[k as string],
    (VOL_TIME as unknown as Record<string, unknown>)[k as string]);
}
for (const [naam, ext, bron, sleutels] of [
  ['project', toExtProject(VOL_PROJECT), VOL_PROJECT, EXT_PROJECT_KEYS],
  ['calendar', toExtCalendar(VOL_CALENDAR), VOL_CALENDAR, EXT_CALENDAR_KEYS],
  ['sequence', toExtSequence(VOL_SEQUENCE), VOL_SEQUENCE, EXT_SEQUENCE_KEYS],
  ['resource', toExtResource(VOL_RESOURCE), VOL_RESOURCE, EXT_RESOURCE_KEYS],
  ['assignment', toExtAssignment(VOL_ASSIGNMENT), VOL_ASSIGNMENT, EXT_ASSIGNMENT_KEYS],
] as [string, object, object, readonly (string | number | symbol)[]][]) {
  for (const k of sleutels) {
    eq(`10 ${naam}: "${String(k)}" komt over`,
      (ext as Record<string, unknown>)[k as string],
      (bron as Record<string, unknown>)[k as string]);
  }
}

// ── 2. `fromExt*` laat geen intern veld vallen (op de bewuste uitzonderingen na) ──
{
  const controle = (
    label: string,
    intern: object,
    bron: object,
    nietSchrijfbaar: readonly string[],
  ) => {
    const verwacht = Object.keys(bron).filter(k => !nietSchrijfbaar.includes(k));
    eq(label, verwacht.filter(k => !(k in intern)), []);
  };
  controle('11 fromExtProject vult elk intern Project-veld',
    fromExtProject(toExtProject(VOL_PROJECT)), VOL_PROJECT, [...NIET_PUBLIEK.project, ...LEES_ALLEEN_EXT.project]);
  controle('12 fromExtCalendar vult elk intern WorkCalendar-veld',
    fromExtCalendar(toExtCalendar(VOL_CALENDAR)), VOL_CALENDAR, [...NIET_PUBLIEK.calendar, ...LEES_ALLEEN_EXT.calendar]);
  controle('13 fromExtTask vult elk intern Task-veld',
    fromExtTask(toExtTask(VOL_TASK)), VOL_TASK, [...NIET_PUBLIEK.task, ...LEES_ALLEEN_EXT.task]);
  controle('14 fromExtTaskTime vult elk intern TaskTime-veld',
    fromExtTaskTime(toExtTaskTime(VOL_TIME)), VOL_TIME, [...NIET_PUBLIEK.taskTime, ...LEES_ALLEEN_EXT.taskTime]);
  controle('15 fromExtSequence vult elk intern Sequence-veld',
    fromExtSequence(toExtSequence(VOL_SEQUENCE)), VOL_SEQUENCE, [...NIET_PUBLIEK.sequence, ...LEES_ALLEEN_EXT.sequence]);
  controle('16 fromExtResource vult elk intern Resource-veld',
    fromExtResource(toExtResource(VOL_RESOURCE)), VOL_RESOURCE, [...NIET_PUBLIEK.resource, ...LEES_ALLEEN_EXT.resource]);
  controle('17 fromExtAssignment vult elk intern ResourceAssignment-veld',
    fromExtAssignment(toExtAssignment(VOL_ASSIGNMENT)), VOL_ASSIGNMENT, [...NIET_PUBLIEK.assignment, ...LEES_ALLEEN_EXT.assignment]);

  // En de keerzijde: de niet-publieke velden moeten óók echt WEG zijn aan de ext-kant. Zonder deze
  // check zou "niet publiek" een lijst worden die je vult zodra iets rood wordt.
  for (const k of NIET_PUBLIEK.project) {
    eq(`18 project-veld "${k}" lekt niet naar het contract`, k in toExtProject(VOL_PROJECT), false);
  }
  for (const k of NIET_PUBLIEK.calendar) {
    eq(`18a kalenderveld "${k}" lekt niet naar het contract`, k in toExtCalendar(VOL_CALENDAR), false);
  }
  for (const k of NIET_PUBLIEK.resource) {
    eq(`18b resourceveld "${k}" lekt niet naar het contract`, k in toExtResource(VOL_RESOURCE), false);
  }
}

// ── 3. Round-trip behoudt de waarden ─────────────────────────────────────────
{
  const stripNietPubliek = (o: object, weg: readonly string[]) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => !weg.includes(k)));
  eq('19 project round-trip',
    fromExtProject(toExtProject(VOL_PROJECT)), stripNietPubliek(VOL_PROJECT, [...NIET_PUBLIEK.project, ...LEES_ALLEEN_EXT.project]));
  eq('20 kalender round-trip',
    fromExtCalendar(toExtCalendar(VOL_CALENDAR)), stripNietPubliek(VOL_CALENDAR, [...NIET_PUBLIEK.calendar, ...LEES_ALLEEN_EXT.calendar]));
  eq('21 taak-readmodel reist alleen naar buiten; P6-herkomst komt generiek niet terug',
    fromExtTask(toExtTask(VOL_TASK)),
    stripNietPubliek(VOL_TASK, [...NIET_PUBLIEK.task, ...LEES_ALLEEN_EXT.task]));
  eq('22 relatie round-trip bewaart geen native-XER-solvervlag via generieke extensie-invoer',
    fromExtSequence(toExtSequence(VOL_SEQUENCE)),
    stripNietPubliek(VOL_SEQUENCE, [...NIET_PUBLIEK.sequence, ...LEES_ALLEEN_EXT.sequence]));
  eq('23 resource round-trip',
    fromExtResource(toExtResource(VOL_RESOURCE)), stripNietPubliek(VOL_RESOURCE, NIET_PUBLIEK.resource));
  eq('24 toewijzing round-trip', fromExtAssignment(toExtAssignment(VOL_ASSIGNMENT)), VOL_ASSIGNMENT);
}

// ── 4. Isolatie: de extensie krijgt een verse, DIEPE kopie ───────────────────
// Dit is de belofte in de kop van extMappers: een extensie mag zijn kopie muteren zonder de store
// te raken. De store is Immer-bevroren, dus een gedeelde geneste referentie zou hier gooien in
// plaats van stil te corrumperen — maar een test die pas in productie afgaat is geen test.
{
  const bevroren = JSON.parse(JSON.stringify(VOL_TASK)) as Task;
  Object.freeze(bevroren);
  Object.freeze(bevroren.time);
  Object.freeze(bevroren.childIds);
  Object.freeze(bevroren.resourceIds);
  if (bevroren.constraint) Object.freeze(bevroren.constraint);
  if (bevroren.externalLinks) { Object.freeze(bevroren.externalLinks); bevroren.externalLinks.forEach(l => { Object.freeze(l); Object.freeze(l.sourceRef); }); }
  if (bevroren.notes) { Object.freeze(bevroren.notes); bevroren.notes.forEach(n => Object.freeze(n)); }

  const kopie = toExtTask(bevroren);
  let gooide = false;
  try {
    kopie.childIds.push('nieuw');
    kopie.time.totalFloat = 99;
    kopie.resourceIds.push('r9');
    if (kopie.constraint) kopie.constraint.date = '2099-01-01';
    if (kopie.externalLinks?.[0]) kopie.externalLinks[0].sourceRef.taskName = 'gewijzigd';
    if (kopie.notes?.[0]) kopie.notes[0].done = true;
  } catch { gooide = true; }
  eq('25 de ext-kopie is muteerbaar (geen gedeelde bevroren referentie)', gooide, false);
  eq('25a en de bron is onaangeroerd', bevroren.childIds.length, 2);
  eq('25b idem de geneste tijd', bevroren.time.totalFloat, 2);
  eq('25c idem de geneste sourceRef', bevroren.externalLinks?.[0]?.sourceRef.taskName, 'Taak 9');
  eq('25d idem de notities', bevroren.notes?.[0]?.done, false);

  // Kalender: holidays en de weekdag-banden zijn de geneste gevallen daar.
  const bevrorenCal = JSON.parse(JSON.stringify(VOL_CALENDAR)) as WorkCalendar;
  Object.freeze(bevrorenCal); Object.freeze(bevrorenCal.holidays);
  bevrorenCal.holidays.forEach(h => Object.freeze(h));
  Object.freeze(bevrorenCal.workTime);
  const calKopie = toExtCalendar(bevrorenCal);
  let calGooide = false;
  try {
    calKopie.holidays[0].name = 'Anders';
    calKopie.workDays.push(6);
  } catch { calGooide = true; }
  eq('26 de kalender-kopie is muteerbaar', calGooide, false);
  eq('26a en de bron-feestdag is onaangeroerd', bevrorenCal.holidays[0].name, 'Kerst');
  eq('26b en de bron-werkdagen ook', bevrorenCal.workDays.length, 5);
}

// ── 5. De twee nieuwe UI-grenzen ─────────────────────────────────────────────
{
  const TABS: readonly ExtRibbonTab[] = [
    'file', 'start', 'planning', 'resources', 'relations',
    'beeld', 'instellingen', 'table', 'ifc', 'report', 'ai',
  ];
  for (const t of TABS) {
    eq(`27 ribbontabblad "${t}" mapt naar iets`, typeof fromExtRibbonTab(t), 'string');
  }
  eq('27a bestaande extensies met relations landen na de overhaul op de volledige Tabel',
    TABS.map(fromExtRibbonTab),
    ['file', 'start', 'planning', 'resources', 'table', 'beeld', 'instellingen', 'table', 'ifc', 'report', 'ai']);

  // Font-provider: de host mag NIET het object van de extensie bewaren, en `getBoldBytes` mag niet
  // als `undefined`-sleutel doorlekken (de pagineerder test op aanwezigheid).
  const bytes = new Uint8Array([1, 2, 3]);
  const zonderBold: ExtFontProvider = {
    id: 'p1',
    covers: (cp) => cp === 65,
    getRegularBytes: () => Promise.resolve(bytes),
  };
  const gemapt = fromExtFontProvider(zonderBold);
  eq('28 de provider is een NIEUW object', gemapt === (zonderBold as unknown), false);
  eq('28a id komt over', gemapt.id, 'p1');
  eq('28b covers werkt', gemapt.covers(65), true);
  eq('28c en zegt nee waar het hoort', gemapt.covers(66), false);
  eq('28d geen getBoldBytes-sleutel als de bron hem niet heeft', 'getBoldBytes' in gemapt, false);

  const metBold: ExtFontProvider = {
    id: 'p2',
    covers: () => true,
    getRegularBytes: () => Promise.resolve(bytes),
    getBoldBytes: () => Promise.resolve(new Uint8Array([9])),
  };
  const gemapt2 = fromExtFontProvider(metBold);
  eq('28e getBoldBytes komt wél mee als hij bestaat', typeof gemapt2.getBoldBytes, 'function');

  // `this`-binding: een provider met interne state moet blijven werken door de mapper heen.
  class Provider implements ExtFontProvider {
    id = 'p3';
    private hits = 0;
    covers() { this.hits++; return true; }
    getRegularBytes() { return Promise.resolve(new Uint8Array([this.hits])); }
    getBoldBytes() { return Promise.resolve(new Uint8Array([this.hits + 100])); }
  }
  const inst = new Provider();
  const gemapt3 = fromExtFontProvider(inst);
  let bindGooide = false;
  try { gemapt3.covers(65); void gemapt3.getBoldBytes?.(); } catch { bindGooide = true; }
  eq('29 een class-provider overleeft de mapping (this blijft gebonden)', bindGooide, false);
}

// ── 6. Publieke create-/updatepaden bewaren expliciete samenvattingsidentiteit ────────────────
// Breuk die dit vangt: `ExtTask.isSummary` staat in het publieke type, maar één van de input- of
// updatemappers, de SDK-factory of `api.data.addTask/updateTask` laat true/false stil vallen. Een
// lege summary zou dan als gewone CPM-knoop terugkomen.
{
  const mappedInput = fromExtTaskInput({ name: 'Mapper-summary', isSummary: true });
  const mappedRegular = fromExtTaskInput({ name: 'Mapper-gewoon' });
  eq('30 fromExtTaskInput draagt expliciet true', mappedInput.isSummary, true);
  eq('30a fromExtTaskInput maakt invoer zonder marker niet per ongeluk summary',
    'isSummary' in mappedRegular, false);
  eq('30b fromExtTaskUpdates draagt expliciet true', fromExtTaskUpdates({ isSummary: true }).isSummary, true);
  eq('30c fromExtTaskUpdates draagt expliciet false als bewuste reset',
    fromExtTaskUpdates({ isSummary: false }).isSummary, false);
  eq('30d fromExtTaskUpdates voegt bij een ongenoemde marker geen update toe',
    'isSummary' in fromExtTaskUpdates({ name: 'Alleen naam' }), false);

  useAppStore.getState().newProject();
  const sdkSummary = getExtensionSdk().factory.createTask({ name: 'SDK lege summary', isSummary: true });
  eq('31 SDK-factory bewaart de expliciete lege summary', sdkSummary.isSummary, true);

  const api = createExtensionApi('x4a-summary-contract', [], undefined, appStoreContext, {
    app: appStoreContext,
    showNotification: () => {},
  });
  const id = api.data.addTask(sdkSummary);
  api.data.recalculate();
  eq('31a extension addTask bewaart de marker in de store',
    useAppStore.getState().tasks.find(task => task.id === id)?.isSummary, true);
  eq('31b extension addTask houdt de lege summary buiten CPMResult.tasks',
    useAppStore.getState().cpmResult?.tasks.has(id), false);

  api.data.updateTask(id, { isSummary: false });
  api.data.recalculate();
  eq('31c extension updateTask kan de marker bewust naar false terugzetten',
    useAppStore.getState().tasks.find(task => task.id === id)?.isSummary, false);
  eq('31d een bewust teruggezette lege summary wordt weer een solvertaak',
    useAppStore.getState().cpmResult?.tasks.has(id), true);

  api.data.updateTask(id, { isSummary: true });
  api.data.recalculate();
  eq('31e extension updateTask kan de samenvattingsidentiteit opnieuw aanzetten',
    useAppStore.getState().tasks.find(task => task.id === id)?.isSummary, true);
  eq('31f opnieuw aangezette summary blijft buiten CPMResult.tasks',
    useAppStore.getState().cpmResult?.tasks.has(id), false);
  api._cleanup();
}

// ── 7. Read-only XER-bronroute ──────────────────────────────────────────────
// Synthetische, privacyveilige fixture: twee generieke projecten en drie generieke taken. De test
// gebruikt de echte XER-reader zodat de API bovenop precies dezelfde retained archive-grafiek werkt
// als de gebruikersroute. Geen corpusnaam, bestandspad of privélabel komt in deze bron voor.
{
  const source = [
    'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tCAL-1\tWerkweek\tCA_Project\t8\t40\t',
    '%R\tCAL-2\tWerkweek\tCA_Project\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    '%R\tP-1\tSynthese A\tCAL-1\t2026-09-01 08:00',
    '%R\tP-2\tSynthese B\tCAL-2\t2026-09-02 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tT-1\tP-1\tCAL-1\tA-1\tTaak A\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-09-01 08:00\t2026-09-01 16:00',
    '%R\tT-2\tP-2\tCAL-2\tB-1\tTaak B\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t8\t8\t2026-09-02 08:00\t2026-09-02 16:00',
    '%R\tT-3\tP-2\tCAL-2\tB-2\tTaak C\tTT_Task\tDT_FixedDUR2\tTK_NotStart\t16\t16\t2026-09-03 08:00\t2026-09-04 16:00',
    '%T\tACTVTYPE',
    '%F\tactv_code_type_id\tactv_code_type\tseq_num',
    '%R\tTYPE\tFase\t1',
    '%T\tACTVCODE',
    '%F\tactv_code_id\tactv_code_type_id\tshort_name\tseq_num',
    '%R\tVALUE\tTYPE\tFase 1\t1',
    '%T\tTASKACTV',
    '%F\tproj_id\ttask_id\tactv_code_type_id\tactv_code_id',
    '%R\tP-2\tT-2\tTYPE\tVALUE',
    '%E',
  ].join('\r\n');
  const opened = readXER(new TextEncoder().encode(`\ufeff${source}`));
  if (!isMultiDocumentImport(opened)) throw new Error('Bronfixture moet twee XER-documenten opleveren');

  useAppStore.getState().newProject();
  const api = createExtensionApi('xer-source-read-contract', ['importSource'], undefined, appStoreContext, {
    app: appStoreContext,
    showNotification: () => {},
  });

  // ── P1-privacyfix: 'importSource' is default-deny, geen kern-API ──────────
  // Zonder de permissie moet elke methode GOOIEN vóórdat er data gelezen wordt — geen stille null,
  // geen gedeeltelijk antwoord. `apiNoPerm` deelt hetzelfde document als `api`; het enige verschil
  // is de permissielijst. Mutatiebewijs: verwijder de drie 'importSource'-entries uit
  // `API_PERMISSIONS` (permissions.ts) en dit blok kleurt rood (de calls slagen dan gewoon).
  {
    const apiNoPerm = createExtensionApi('xer-source-read-contract-no-perm', [], undefined, appStoreContext, {
      app: appStoreContext,
      showNotification: () => {},
    });
    const apiOtherPerm = createExtensionApi('xer-source-read-contract-other-perm', ['ribbon', 'events'], undefined, appStoreContext, {
      app: appStoreContext,
      showNotification: () => {},
    });
    const throwsWithout = (fn: () => unknown): boolean => {
      try { fn(); return false; } catch (error) {
        return error instanceof Error && /mist permissie: importSource/.test(error.message);
      }
    };
    eq('P1 zonder permissies gooien alle drie de bronmethoden een permissiefout', [
      throwsWithout(() => apiNoPerm.data.getImportSourceInfo()),
      throwsWithout(() => apiNoPerm.data.getImportSourceChunk(0)),
      throwsWithout(() => apiNoPerm.data.getImportSourceCatalogPage('taskSourceRows')),
    ], [true, true, true]);
    eq('P1a een ONgerelateerde permissie (ribbon/events) geeft geen toegang tot importSource', [
      throwsWithout(() => apiOtherPerm.data.getImportSourceInfo()),
      throwsWithout(() => apiOtherPerm.data.getImportSourceChunk(0)),
      throwsWithout(() => apiOtherPerm.data.getImportSourceCatalogPage('taskSourceRows')),
    ], [true, true, true]);
    apiNoPerm._cleanup();
    apiOtherPerm._cleanup();
  }
  // Let op: dit toetst alléén de SDK-constante, NIET dat een echt manifest de permissie ook door
  // de installatievalidatie krijgt — dat gat (een tweede, ontkoppelde permissielijst in
  // validation.ts) was precies waar her-review 2 'importSource' onbereikbaar voor elke extensie
  // vond. Die dekking staat in tests/planning/check-extension-validation.ts (KNOWN_PERMISSIONS
  // door parseExtensionManifest(..., 'fresh') gehaald), niet hier.
  eq('P1b importSource staat in de door de app gekende permissies (SDK-constante)',
    KNOWN_PERMISSIONS.includes('importSource'), true);
  eq('P1c een manifest dat importSource declareert behoudt hem ongewijzigd (geen filtering)',
    sanitizeManifestPermissions(['importSource', 'ribbon'], 'x'), ['importSource', 'ribbon']);

  eq('37 een niet-XER-document geeft geen broninfo', api.data.getImportSourceInfo(), null);
  eq('37a chunk- en catalogusroute geven zonder XER null', [
    api.data.getImportSourceChunk(0), api.data.getImportSourceCatalogPage('taskSourceRows'),
  ], [null, null]);
  const applied = useAppStore.getState().applyOpenedImport(opened, {
    filePath: null, recompute: false, fit: false, hourDataNotice: false, linkedOpen: true,
  });
  const p2DocumentId = applied.documentIds[1];
  if (p2DocumentId) useAppStore.getState().switchDocument(p2DocumentId);
  const archive = opened.results[0]?.xerSourceArchive;
  if (!archive) throw new Error('Bronfixture mist het retained XER-archive');

  const info = api.data.getImportSourceInfo();
  const expectedReport = {
    projectsSeen: 2, documentsOpened: 2, emptyProjectsSkipped: 0, baselineProjectsExcluded: 0,
    baselinesMaterialized: 0, danglingBaselineReferences: 0, externalLinksPreserved: 0,
    baselineExclusionReverted: false, baselineFallbackReasons: [],
  };
  eq('37 XER-bronsamenvatting is aanwezig op het actieve document', Boolean(info), true);
  eq('38 XER-bronsamenvatting heeft exact de actieve selector en archive-identiteit', info && {
    sourceFormat: info.sourceFormat,
    sourceProjectId: info.sourceProjectId,
    selector: info.selector,
    archive: info.archive,
    numberFormat: info.numberFormat,
    importReport: info.importReport,
  }, info && {
    sourceFormat: 'primavera-p6-xer',
    sourceProjectId: 'P-2',
    selector: { kind: 'sourceProjectId', value: 'P-2' },
    archive: {
      schemaVersion: 1, byteLength: archive.byteLength, sha256: archive.sha256,
      encoding: 'utf-8', bom: 'utf-8', newline: 'crlf', chunkSize: 196608, chunkCount: 1,
    },
    numberFormat: { decimal: '.', group: null, source: 'default', currencyCode: 'EUR' },
    importReport: expectedReport,
  });
  eq('39 XER-samenvatting bevat diagnostics/schedule-options/catalogustellingen', info && {
    diagnostics: info.diagnostics,
    scheduleOptions: info.scheduleOptions,
    catalogs: info.catalogs,
  }, {
    diagnostics: {
      file: {
        tableReport: { encoding: 'utf-8', endMarkerSeen: true, issueCount: 0, unknownTableCount: 0, unknownFieldCount: 0 },
        scheduleOptionsDiagnosticCount: 0, relationResolutionIssueCount: 0,
        resourceCatalogIssueCount: 0, metadataCatalogIssueCount: 0,
      },
      document: {
        calendarIssueCount: 0, enumFallbackCount: 0, scheduleOptionsFallbackCount: 0,
        scheduleOptionsDiagnosticCount: 0, externalRelationCount: 0, externalLinkCount: 0,
        resourceAssignmentCount: 0, resourceIssueCount: 0,
      },
    },
    scheduleOptions: {
      source: 'xer-defaults', retainedSource: {}, fallbackCount: 0, diagnosticCount: 0,
      sourceRowCount: 1, unmatchedSourceRowCount: 0,
    },
    catalogs: {
      scheduleOptions: { sourceRows: 2, unmatchedRows: 0, diagnostics: 0 },
      resources: {
        resources: 0, identities: 0,
        rows: { resources: 0, roles: 0, rates: 0, curves: 0, assignments: 0 }, issues: 0,
      },
      metadata: {
        activityCodeTypes: 1, customFieldDefs: 0, taskProjections: 1,
        currentProjectTaskProjections: 1, issues: 0,
        issueCounts: Object.fromEntries(Object.keys(info?.catalogs.metadata.issueCounts ?? {}).map(key => [key, 0])),
        sourceData: Object.fromEntries(Object.entries(info?.catalogs.metadata.sourceData ?? {}).map(([key, count]) => [key, key === 'ACTVTYPE' || key === 'ACTVCODE' || key === 'TASKACTV' ? 1 : count])),
      },
      taskSourceRows: { projectCount: 2, totalRows: 3, currentProjectRows: 2 },
    },
  });

  const chunks: Uint8Array[] = [];
  for (let index = 0; index < (info?.archive.chunkCount ?? 0); index += 1) {
    const chunk = api.data.getImportSourceChunk(index);
    if (chunk) chunks.push(chunk);
  }
  const reconstructed = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  chunks.reduce((offset, chunk) => { reconstructed.set(chunk, offset); return offset + chunk.byteLength; }, 0);
  eq('40 bronchunks reconstrueren exact de XER-bytes en digest', {
    byteLength: reconstructed.byteLength, sha256: sha256Hex(reconstructed), bytes: [...reconstructed],
  }, { byteLength: archive.byteLength, sha256: archive.sha256, bytes: [...decodeXerSourceArchive(archive)] });

  let invalidIndex = false;
  try { api.data.getImportSourceChunk(-1); } catch (error) { invalidIndex = error instanceof RangeError; }
  let invalidFraction = false;
  try { api.data.getImportSourceChunk(0.5); } catch (error) { invalidFraction = error instanceof RangeError; }
  eq('41 ongeldige chunkindexen worden fail-closed gevalideerd', [invalidIndex, invalidFraction], [true, true]);

  const firstPage = api.data.getImportSourceCatalogPage('taskSourceRows', { offset: 0, limit: 1 });
  const secondPage = api.data.getImportSourceCatalogPage('taskSourceRows', { offset: 1, limit: 1 });
  const cell = (row: { cells?: unknown } | undefined, key: string): unknown => {
    const cells = row?.cells;
    return cells && typeof cells === 'object' ? (cells as Record<string, unknown>)[key] : undefined;
  };
  eq('42 task-bronrijen zijn pagineerbaar en documentgebonden', {
    first: firstPage && { offset: firstPage.offset, limit: firstPage.limit, total: firstPage.total, ids: firstPage.items.map(row => cell(row, 'task_id')) },
    second: secondPage && { offset: secondPage.offset, limit: secondPage.limit, total: secondPage.total, ids: secondPage.items.map(row => cell(row, 'task_id')) },
  }, {
    first: { offset: 0, limit: 1, total: 2, ids: ['T-2'] },
    second: { offset: 1, limit: 1, total: 2, ids: ['T-3'] },
  });
  const schedulePage = api.data.getImportSourceCatalogPage('scheduleOptionsSourceRows', { limit: 500 });
  eq('43 schedule-options-pagina gebruikt alleen de actieve projectbronrij', schedulePage?.items.map(row => cell(row, 'proj_id')), ['P-2']);
  const metadataPage = api.data.getImportSourceCatalogPage('metadataSourceActvtypeRows');
  const activityTypePage = api.data.getImportSourceCatalogPage('metadataActivityCodeTypes');
  eq('43b retained metadata-catalogi en bronrijen zijn gekopieerd pagineerbaar', {
    raw: metadataPage && { total: metadataPage.total, id: cell(metadataPage.items[0], 'actv_code_type_id') },
    normalized: activityTypePage && { total: activityTypePage.total, id: activityTypePage.items[0]?.id },
  }, { raw: { total: 1, id: 'TYPE' }, normalized: { total: 1, id: 'TYPE' } });
  eq('43a bronroute bevat geen generiek bron-writepad', Object.keys(api.data)
    .filter(key => key.toLowerCase().includes('importsource')).sort(), [
      'getImportSourceCatalogPage', 'getImportSourceChunk', 'getImportSourceInfo',
    ]);

  let invalidRange = false;
  try { api.data.getImportSourceCatalogPage('taskSourceRows', { offset: -1 }); } catch (error) { invalidRange = error instanceof RangeError; }
  let oversizedRange = false;
  try { api.data.getImportSourceCatalogPage('taskSourceRows', { limit: 501 }); } catch (error) { oversizedRange = error instanceof RangeError; }
  let invalidCollection = false;
  try { api.data.getImportSourceCatalogPage('onbekend' as never); } catch (error) { invalidCollection = error instanceof RangeError; }
  eq('44 ongeldige catalogusvragen worden fail-closed gevalideerd', [invalidRange, oversizedRange, invalidCollection], [true, true, true]);

  // ── P2-fix: offset + limit blijft een safe integer, ook aan de rand ──────
  // Vóór de fix duwde `records.slice(offset, offset + limit)` een losstaand grote offset zo het
  // safe integer-bereik uit. `taskSourceRows` op het actieve document (P-2) telt 2 rijen; een
  // offset voorbij het eind moet canoniseren naar `total` — een lege, geldige laatste pagina — in
  // plaats van te gooien of een numeriek onveilige slice te maken. Mutatiebewijs: verwijder
  // `resolvePageOffset` (of geef `rawOffset` rechtstreeks aan `records.slice` mee) en de eerste
  // vier `total`-asserties hieronder wijken af van `2`, terwijl de oude code hier ook geen fout gaf
  // — precies de stille modus die de review aanwees.
  const maxSafeOffsetPage = api.data.getImportSourceCatalogPage('taskSourceRows', { offset: Number.MAX_SAFE_INTEGER });
  eq('P2 offset Number.MAX_SAFE_INTEGER canoniseert naar total i.p.v. te gooien of te overflowen', {
    offset: maxSafeOffsetPage?.offset, total: maxSafeOffsetPage?.total, items: maxSafeOffsetPage?.items,
  }, { offset: 2, total: 2, items: [] });

  const nearOverflowOffset = Number.MAX_SAFE_INTEGER - EXT_IMPORT_SOURCE_PAGE_SIZE_MAX + 1;
  const nearOverflowPage = api.data.getImportSourceCatalogPage('taskSourceRows', {
    offset: nearOverflowOffset, limit: EXT_IMPORT_SOURCE_PAGE_SIZE_MAX,
  });
  eq('P2a offset Number.MAX_SAFE_INTEGER - limit + 1 (net over de overflowgrens van offset+limit) canoniseert ook', {
    offset: nearOverflowPage?.offset, total: nearOverflowPage?.total, items: nearOverflowPage?.items,
  }, { offset: 2, total: 2, items: [] });

  // Zelfde twee grenzen, maar dan op een lege (bestaande maar 0-record) collectie: `total` is 0, dus
  // canoniseren moet naar 0 gaan — niet naar de offset zelf en niet naar een negatief getal.
  const emptyCollectionAtMax = api.data.getImportSourceCatalogPage('resourceCatalogIssues', { offset: Number.MAX_SAFE_INTEGER });
  eq('P2b een offset voorbij het eind van een LEGE collectie canoniseert naar 0, niet naar de offset',
    emptyCollectionAtMax && { offset: emptyCollectionAtMax.offset, total: emptyCollectionAtMax.total },
    { offset: 0, total: 0 });

  const beforeMutation = api.data.getImportSourceInfo() as ExtImportSourceInfo;
  const mutableInfo = api.data.getImportSourceInfo() as unknown as { archive: { sha256: string }; catalogs: { taskSourceRows: { totalRows: number } } };
  mutableInfo.archive.sha256 = 'veranderd';
  mutableInfo.catalogs.taskSourceRows.totalRows = 999;
  const mutablePage = api.data.getImportSourceCatalogPage('taskSourceRows', { limit: 1 });
  if (mutablePage?.items[0]?.cells) (mutablePage.items[0].cells as Record<string, unknown>).task_id = 'veranderd';
  const mutableChunk = api.data.getImportSourceChunk(0);
  if (mutableChunk) mutableChunk[0] ^= 0xff;
  eq('45 info/page/chunk zijn verse kopieën zonder mutabele alias', {
    info: api.data.getImportSourceInfo(),
    taskId: cell(api.data.getImportSourceCatalogPage('taskSourceRows', { limit: 1 })?.items[0], 'task_id'),
    digest: api.data.getImportSourceInfo()?.archive.sha256,
    chunkDigest: (() => { const chunk = api.data.getImportSourceChunk(0); return chunk ? sha256Hex(chunk) : null; })(),
  }, {
    info: beforeMutation,
    taskId: 'T-2',
    digest: archive.sha256,
    chunkDigest: sha256Hex(decodeXerSourceArchive(archive).subarray(0, archive.byteLength)),
  });

  const visible = api.data.getTasks()[0];
  eq('46 alle acht P6-taakvelden blijven zichtbaar via toExtTask', visible && [
    visible.p6DurationType, visible.p6ActivityType, visible.p6ProjectId, visible.p6TaskId,
    visible.p6ExplicitTargetWindow, visible.p6CompletePctType, visible.p6ExpectedFinish,
    visible.p6SuspendResume,
  ], ['DT_FixedDUR2', 'TT_Task', 'P-2', 'T-2', true, undefined, undefined, undefined]);

  const hostileImportTask = { ...toExtTask(VOL_TASK), id: 'T-foreign', name: 'Generieke import' };
  api.data.loadProject({
    project: toExtProject(VOL_PROJECT), calendar: toExtCalendar(VOL_CALENDAR), tasks: [hostileImportTask],
    sequences: [], resources: [], assignments: [],
  });
  eq('47 generieke loadProject activeert geen P6-provenance', [
    useAppStore.getState().tasks[0]?.p6DurationType, useAppStore.getState().tasks[0]?.p6ActivityType,
    useAppStore.getState().tasks[0]?.p6ProjectId, useAppStore.getState().tasks[0]?.p6TaskId,
    useAppStore.getState().tasks[0]?.p6ExplicitTargetWindow, useAppStore.getState().tasks[0]?.p6CompletePctType,
    useAppStore.getState().tasks[0]?.p6ExpectedFinish, useAppStore.getState().tasks[0]?.p6SuspendResume,
  ], [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);

  // ── P2-fix: fail-closed documentdrift bij pagineren (her-review 2) ────────
  // Zonder bewaking geeft een pagineersessie na een `switchDocument` stil een lege pagina van het
  // VERKEERDE project terug: page 1 op P-2, wisselen naar P-1, page 2 (offset:1) levert dan
  // {sourceProjectId:'P-1', total:1, items:[]} zonder enige waarschuwing — een extensie die dat als
  // "klaar, geen records meer" leest, heeft in werkelijkheid twee projecten door elkaar gehaald.
  // `expectedSourceProjectId` maakt dit fail-closed. Casus (a) hieronder: het actieve document heeft
  // ná de hostile `loadProject` hierboven HELEMAAL geen XER-bron meer (`archive === null`) — de
  // andere risicoklasse (drift naar een niet-XER-document, niet alleen naar een ander XER-project).
  {
    let noArchiveDrift: ExtImportSourceDriftError | null = null;
    try {
      api.data.getImportSourceCatalogPage('taskSourceRows', { expectedSourceProjectId: 'P-2' });
    } catch (error) { noArchiveDrift = error instanceof ExtImportSourceDriftError ? error : null; }
    eq('D1 drift naar een document ZONDER XER-bron gooit i.p.v. stil null terug te geven', {
      isDriftError: noArchiveDrift !== null,
      message: noArchiveDrift && [/P-2/.test(noArchiveDrift.message), /geen XER-document/.test(noArchiveDrift.message)],
    }, { isDriftError: true, message: [true, true] });
    eq('D1a zonder expectedSourceProjectId blijft "geen archief" gewoon null geven (ongewijzigd gedrag)',
      api.data.getImportSourceCatalogPage('taskSourceRows'), null);
  }

  // loadProject is deliberately a normal generic load and must not erase/overwrite the XER source
  // route through an implicit write API. The route is gone with the replaced document; a later
  // document switch must still restore the retained source of the other XER document.
  const xerDocumentId = applied.documentIds[0];
  if (xerDocumentId) useAppStore.getState().switchDocument(xerDocumentId);
  eq('48 documentwissel herstelt de XER-selector en bronroute', {
    selector: api.data.getImportSourceInfo()?.sourceProjectId,
    taskId: cell(api.data.getImportSourceCatalogPage('taskSourceRows', { limit: 1 })?.items[0], 'task_id'),
  }, { selector: 'P-1', taskId: 'T-1' });

  // Casus (b): het actieve document heeft nu weer een archief (P-1) — vraag alsnog om een pagina
  // met de VERWACHTING van het vorige project (P-2). Mutatiebewijs: verwijder de
  // `assertNoImportSourceDrift`-aanroep uit `getExtImportSourceCatalogPage`/de wrapper in
  // extensionApi.ts en D2/D2a kleuren rood (de aanroep slaagt dan gewoon met een pagina van P-1).
  {
    let wrongProjectDrift: ExtImportSourceDriftError | null = null;
    try {
      api.data.getImportSourceCatalogPage('taskSourceRows', { offset: 1, expectedSourceProjectId: 'P-2' });
    } catch (error) { wrongProjectDrift = error instanceof ExtImportSourceDriftError ? error : null; }
    eq('D2 drift tussen twee XER-documenten gooit i.p.v. een lege pagina van het verkeerde project', {
      isDriftError: wrongProjectDrift !== null,
      message: wrongProjectDrift && [/P-2/.test(wrongProjectDrift.message), /P-1/.test(wrongProjectDrift.message)],
    }, { isDriftError: true, message: [true, true] });

    const withExpectation = api.data.getImportSourceCatalogPage('taskSourceRows', { expectedSourceProjectId: 'P-1' });
    const withoutExpectation = api.data.getImportSourceCatalogPage('taskSourceRows');
    eq('D3 een KLOPPENDE expectedSourceProjectId gedraagt zich identiek aan zonder de optie', {
      withExpectation: withExpectation && { sourceProjectId: withExpectation.sourceProjectId, total: withExpectation.total },
      withoutExpectation: withoutExpectation && { sourceProjectId: withoutExpectation.sourceProjectId, total: withoutExpectation.total },
    }, {
      withExpectation: { sourceProjectId: 'P-1', total: 1 },
      withoutExpectation: { sourceProjectId: 'P-1', total: 1 },
    });
  }
  api._cleanup();
}

// ── 8. De contract-versiepoort (los van minAppVersion) ───────────────────────
// CalVer draagt geen breaking-change-signaal; `apiVersion` doet dat wel. De poort moet in BEIDE
// richtingen dicht: een extensie voor een oudere major mist de brekende wijziging, een voor een
// nieuwere rekent op iets dat er niet is.
{
  eq('32 de host-API-versie is een geldige semver', /^\d+\.\d+\.\d+$/.test(EXTENSION_API_VERSION), true);

  // Legacy: geen apiVersion ⇒ toegestaan, maar herkenbaar als legacy.
  eq('31 geen apiVersion ⇒ toegestaan', checkApiCompatibility(undefined, '1.2.0').ok, true);
  eq('31a en gemarkeerd als legacy', checkApiCompatibility(undefined, '1.2.0').legacy, true);
  eq('31b lege string telt als geen', checkApiCompatibility('', '1.2.0').legacy, true);
  eq('31c spaties ook', checkApiCompatibility('   ', '1.2.0').legacy, true);

  // Zelfde major.
  eq('32 gelijke versie mag', checkApiCompatibility('1.2.0', '1.2.0').ok, true);
  eq('32a oudere minor mag (toevoegingen zijn achterwaarts compatibel)', checkApiCompatibility('1.0.0', '1.2.0').ok, true);
  eq('32b nieuwere minor mag NIET', checkApiCompatibility('1.3.0', '1.2.0').ok, false);
  eq('32c patch doet niet mee — hoger', checkApiCompatibility('1.2.9', '1.2.0').ok, true);
  eq('32d patch doet niet mee — lager', checkApiCompatibility('1.2.0', '1.2.9').ok, true);
  eq('32e major.minor zonder patch mag', checkApiCompatibility('1.2', '1.2.0').ok, true);

  // Andere major — beide richtingen dicht.
  eq('33 oudere major mag niet', checkApiCompatibility('0.9.0', '1.2.0').ok, false);
  eq('33a nieuwere major mag niet', checkApiCompatibility('2.0.0', '1.2.0').ok, false);

  // Onzin is geen "0.0.0". Stil naar nul afronden zou een typefout laten passeren als
  // "compatibel met alles" — precies de stille modus die dit item wil wegnemen.
  for (const onzin of ['abc', '1.x', 'v1.0.0', '1', '1..0', '-1.0.0']) {
    eq(`34 onzin-apiVersion "${onzin}" wordt geweigerd`, checkApiCompatibility(onzin, '1.2.0').ok, false);
  }

  // Elke weigering moet een reden meegeven — een lege foutmelding in de extensielijst helpt niemand.
  for (const slecht of ['0.9.0', '2.0.0', '1.3.0', 'abc']) {
    const r = checkApiCompatibility(slecht, '1.2.0');
    eq(`35 weigering van "${slecht}" draagt een reden`, typeof r.reason === 'string' && r.reason.length > 10, true);
  }
  eq('35a een toestemming draagt géén reden', checkApiCompatibility('1.0.0', '1.2.0').reason, undefined);

  // En tegen de ECHTE hostversie: de huidige waarde moet zichzelf accepteren.
  eq('36 de host accepteert zijn eigen versie', checkApiCompatibility(EXTENSION_API_VERSION).ok, true);
}

// ── 7. De API-factory maakt document- en hostbinding constructief expliciet ─
{
  type IsExact<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
      ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2)
        ? true
        : false
      : false;
  type ExpectedCreateExtensionApiParameters = [
    extensionId: string,
    permissions: ExtensionPermission[],
    assets: Record<string, Uint8Array> | undefined,
    document: AppStoreContext,
    host: ExtensionHostBinding,
  ];
  const exacteParameters: IsExact<
    Parameters<typeof createExtensionApi>,
    ExpectedCreateExtensionApiParameters
  > = true;
  const exactResultaat: IsExact<ReturnType<typeof createExtensionApi>, ExtensionApi> = true;
  eq('37 createExtensionApi heeft exact vijf contextvaste parameters', exacteParameters, true);
  eq('37a createExtensionApi retourneert exact ExtensionApi', exactResultaat, true);
  eq('37b createExtensionApi heeft runtime-arity vijf', createExtensionApi.length, 5);

  const source = readFileSync(join(process.cwd(), 'src/extensions/extensionApi.ts'), 'utf8');
  const verbodenImports = [
    ['useAppStore', /import[^;]*\buseAppStore\b[^;]*from/],
    ['appStoreContext', /import[^;]*\bappStoreContext\b[^;]*from/],
    ['appLog', /import[^;]*\bappLog\b[^;]*from/],
    ['globale withTransaction', /import[^;]*\bwithTransaction\b[^;]*from/],
  ].filter(([, patroon]) => (patroon as RegExp).test(source)).map(([naam]) => naam);
  eq('38 extensionApi importeert geen singleton-, log- of globale transactiebinding',
    verbodenImports, []);

  const loaderSource = readFileSync(join(process.cwd(), 'src/extensions/extensionLoader.ts'), 'utf8');
  eq('39 productiehost bindt warning exact aan warn',
    /type === 'warning' \? 'warn' : 'info'/.test(loaderSource), true);
  eq('39a productiehost behoudt source ext:extensionId en ongewijzigde message',
    /appLog\.emit\(level, `ext:\$\{extensionId\}`, message\)/.test(loaderSource), true);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: extensie-contract — ${checks} checks groen`);
} else {
  console.log(`XX extensie-contract — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
