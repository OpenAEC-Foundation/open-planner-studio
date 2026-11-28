import './domStub';
import { CUSTOM_TASK_TYPE_COLOR_ORDER } from '@/engine/renderer/resourcePalette';
import i18next from 'i18next';
import nlMenu from '@/i18n/locales/nl/menu.json';
import enMenu from '@/i18n/locales/en/menu.json';
import { emitExtensionEvent, HOST_EVENTS } from '@/services/extensionEvents';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IfcSchemaId, Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type {
  ExtProject, ExtCalendar, ExtTask, ExtTaskTime, ExtSequence, ExtResource, ExtAssignment,
  ExtRibbonTab, ExtFontProvider, ExtImportSourceInfo, ExtImportResult,
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
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import {
  TASK_SOURCE_FIELDS, SEQUENCE_SOURCE_FIELDS, CALENDAR_SOURCE_FIELDS, ASSIGNMENT_SOURCE_FIELDS,
  openExtensionImport, importWithExtension, retainActiveDocument,
} from '@/extensions/retainActiveDocument';
import type { CalendarGeneration } from '@/types/calendar';
import { ifcSchemaBlocksSilentWrite } from '@/services/ifc/ifcSchemaQuestion';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

function keys<T>() {
  return <K extends readonly (keyof Required<T>)[]>(
    lijst: K & ([keyof Required<T>] extends [K[number]] ? unknown : ['mist:', Exclude<keyof Required<T>, K[number]>]),
  ): readonly (keyof Required<T>)[] => lijst;
}

const EXT_PROJECT_KEYS = keys<ExtProject>()([
  'id', 'name', 'description', 'startDate', 'endDate', 'calendarId', 'createdAt', 'modifiedAt',
  'author', 'company', 'wbsAutoNumber', 'statusDate', 'progressMode', 'defaultTaskDurationUnit', 'defaultWorkRule', 'schedulingOptions',
  'schedulingProfile',
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
  'levelingDelayMinutes', 'levelingDelayElapsed', 'splitGaps', 'manuallyScheduled',
  'mspTaskType', 'effortDriven', 'timephasedContours',
  'timephasedFinishFloor', 'timephasedStartAnchor', 'timephasedDurationWalks',
  'workRule',
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
  'plannedWorkMinutes', 'actualWorkMinutes', 'remainingWorkMinutes',
  'costAmount',
] as const);

const NIET_PUBLIEK = {
  project: ['companyId', 'companyName', 'ifcSchema', 'ifcSchemaUnconfirmed',
    'p6ProjectCode',
    'dependentProjectsFolder',
    'anchorsFromOpenDocuments'] as readonly string[],
  calendar: ['generation', 'libraryOrigin', 'p6NonWorkPenaltyDatesState', 'ifcTimePeriods'] as readonly string[],
  resource: ['availability', 'libraryOrigin'] as readonly string[],
  task: [] as readonly string[],
  taskTime: ['totalFloatMinutes', 'freeFloatMinutes', 'progressBeforeRecalculation'] as readonly string[],
  sequence: [] as readonly string[],
  assignment: ['plannedUnitsPerDay'] as readonly string[],
};

const LEES_ALLEEN_EXT = {
  project: ['schedulingProfile'] as readonly string[],
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
  totalFloatMinutes: 960,
  freeFloatMinutes: 480,
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
  progressBeforeRecalculation: { status: 'STARTED', completion: 0.2, actualStart: '2026-06-01' },
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
  levelingDelayMinutes: 90,
  levelingDelayElapsed: true,
  splitGaps: [{ afterMinutes: 480, gapMinutes: 960 }],
  manuallyScheduled: true,
  mspTaskType: 'FIXED_WORK',
  effortDriven: true,
  workRule: 'FIXED_RATE',
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
  schedulingProfile: { baseId: 'msproject', id: 'eigen-1', name: 'Eigen', overrides: { clampNegativeFreeFloat: true } },
  ifcSchema: 'IFC4',
  ifcSchemaUnconfirmed: 'IFC4',
  p6ProjectCode: 'OZB-05',
  dependentProjectsFolder: '/projecten/Zuidas',
  anchorsFromOpenDocuments: true,
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
  ifcTimePeriods: [],
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
  const exposed = toExtProject({ ...VOL_PROJECT, schedulingProfile: builtInProfile('p6') });
  eq('C8-01 toExtProject toont het opgeloste profiel',
    [exposed.schedulingProfile?.id, exposed.schedulingProfile?.conventions.p6RelationFinishBoundary], ['p6', true]);
  eq('C8-02 OPS-project toont het ops-profiel', toExtProject({ ...VOL_PROJECT, schedulingProfile: undefined }).schedulingProfile?.id, 'ops');
  eq('C8-03 fromExtProject neemt NOOIT een profiel over (extensie-import ⇒ OPS)', fromExtProject(exposed).schedulingProfile, undefined);
  eq('C8-04 contractversie 1.6.0 (1.2.0 profiel + 1.3.0 taaktypes + 1.4.0 help + 1.4.1 loadProject-fix + 1.5.0 selectie + 1.6.0 kosten)', EXTENSION_API_VERSION, '1.6.0');
  eq('C8 selectie-API vereist minor 1.5 op oudere host', checkApiCompatibility('1.5', '1.4.1').ok, false);
  eq('C8 oudere extensie blijft compatibel', checkApiCompatibility('1.4', EXTENSION_API_VERSION).ok, true);
  eq('C8-04a host-events: vaste namen', getExtensionSdk().hostEvents, {
    projectLoaded: 'host:project-loaded',
    projectNew: 'host:project-new',
    scheduleCalculated: 'host:schedule-calculated',
    tutorialRequested: 'host:tutorial-requested',
  });
  const custom = toExtProject(VOL_PROJECT).schedulingProfile;
  eq('C8-05 eigen profiel: id, basis, naam en de negenentwintig opgeloste conventies (B6, dagenmaat)',
    [custom?.id, custom?.baseId, custom?.name, Object.keys(custom?.conventions ?? {}).length, custom?.conventions.clampNegativeFreeFloat],
    ['eigen-1', 'msproject', 'Eigen', 29, true]);
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
  id: 'a1', taskId: 't1', resourceId: 'r1', unitsPerDay: 0.5, plannedUnitsPerDay: 0.25, curve: 'BELL',
  workWindowStart: '2026-06-01T08:00', workWindowFinish: '2026-06-10T17:00',
  curveValues: [0, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5],
  plannedWorkMinutes: 4800, actualWorkMinutes: 1200, remainingWorkMinutes: 3000,
  costAmount: 1250.5,
} satisfies Required<ResourceAssignment>;

const aanwezig = (o: object, k: readonly (string | number | symbol)[]) => k.filter(x => !(x in o));

eq('1 toExtProject vult elk ExtProject-veld', aanwezig(toExtProject(VOL_PROJECT), EXT_PROJECT_KEYS), []);
eq('2 toExtCalendar vult elk ExtCalendar-veld', aanwezig(toExtCalendar(VOL_CALENDAR), EXT_CALENDAR_KEYS), []);
eq('3 toExtTaskTime vult elk ExtTaskTime-veld', aanwezig(toExtTaskTime(VOL_TIME), EXT_TASK_TIME_KEYS), []);
eq('4 toExtTask vult elk ExtTask-veld', aanwezig(toExtTask(VOL_TASK), EXT_TASK_KEYS), []);
eq('5 toExtSequence vult elk ExtSequence-veld', aanwezig(toExtSequence(VOL_SEQUENCE), EXT_SEQUENCE_KEYS), []);
eq('6 toExtResource vult elk ExtResource-veld', aanwezig(toExtResource(VOL_RESOURCE), EXT_RESOURCE_KEYS), []);
eq('7 toExtAssignment vult elk ExtAssignment-veld', aanwezig(toExtAssignment(VOL_ASSIGNMENT), EXT_ASSIGNMENT_KEYS), []);

for (const k of EXT_TASK_KEYS) {
  if (k === 'time') continue;
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
    if (naam === 'project' && k === 'schedulingProfile') continue;
    eq(`10 ${naam}: "${String(k)}" komt over`,
      (ext as Record<string, unknown>)[k as string],
      (bron as Record<string, unknown>)[k as string]);
  }
}

function leesWijzigLaadToewijzing(a: ResourceAssignment): ResourceAssignment | undefined {
  const doc = { ...useAppStore.getState(), assignments: [a] };
  const loaded = fromExtImportResult({
    project: toExtProject(doc.project), calendar: toExtCalendar(doc.calendar),
    tasks: [], sequences: [], resources: [], assignments: [toExtAssignment(a)],
  });
  return retainActiveDocument(loaded, doc).assignments.find((x) => x.id === a.id);
}

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

  for (const k of NIET_PUBLIEK.project) {
    eq(`18 project-veld "${k}" lekt niet naar het contract`, k in toExtProject(VOL_PROJECT), false);
  }
  for (const k of NIET_PUBLIEK.calendar) {
    eq(`18a kalenderveld "${k}" lekt niet naar het contract`, k in toExtCalendar(VOL_CALENDAR), false);
  }
  for (const k of NIET_PUBLIEK.resource) {
    eq(`18b resourceveld "${k}" lekt niet naar het contract`, k in toExtResource(VOL_RESOURCE), false);
  }
  for (const k of NIET_PUBLIEK.taskTime) {
    eq(`18b taakveld "${k}" lekt niet naar het contract`, k in toExtTaskTime(VOL_TIME), false);
  }
  for (const k of NIET_PUBLIEK.assignment) {
    eq(`18c toewijzingsveld "${k}" lekt niet naar het contract`, k in toExtAssignment(VOL_ASSIGNMENT), false);
    eq(`18c toewijzingsveld "${k}" blijft na lees-wijzig-laad op hetzelfde id`,
      (leesWijzigLaadToewijzing(VOL_ASSIGNMENT) as Record<string, unknown> | undefined)?.[k],
      (VOL_ASSIGNMENT as Record<string, unknown>)[k]);
  }
}

{
  const stripNietPubliek = (o: object, weg: readonly string[]) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => !weg.includes(k)));
  eq('19 project round-trip',
    fromExtProject(toExtProject(VOL_PROJECT)), stripNietPubliek(VOL_PROJECT, [...NIET_PUBLIEK.project, ...LEES_ALLEEN_EXT.project]));
  eq('20 kalender round-trip',
    fromExtCalendar(toExtCalendar(VOL_CALENDAR)), stripNietPubliek(VOL_CALENDAR, [...NIET_PUBLIEK.calendar, ...LEES_ALLEEN_EXT.calendar]));
  eq('21 taak-readmodel reist alleen naar buiten; P6-herkomst komt generiek niet terug',
    fromExtTask(toExtTask(VOL_TASK)),
    {
      ...stripNietPubliek(VOL_TASK, [...NIET_PUBLIEK.task, ...LEES_ALLEEN_EXT.task]),
      time: stripNietPubliek(VOL_TIME, [...NIET_PUBLIEK.taskTime, ...LEES_ALLEEN_EXT.taskTime]),
    });
  eq('22 relatie round-trip bewaart geen native-XER-solvervlag via generieke extensie-invoer',
    fromExtSequence(toExtSequence(VOL_SEQUENCE)),
    stripNietPubliek(VOL_SEQUENCE, [...NIET_PUBLIEK.sequence, ...LEES_ALLEEN_EXT.sequence]));
  eq('23 resource round-trip',
    fromExtResource(toExtResource(VOL_RESOURCE)), stripNietPubliek(VOL_RESOURCE, NIET_PUBLIEK.resource));
  const gesorteerd = (o: object | undefined) => o && Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  eq('24 toewijzing round-trip via lees-wijzig-laad: niets gaat verloren',
    gesorteerd(leesWijzigLaadToewijzing(VOL_ASSIGNMENT)), gesorteerd(VOL_ASSIGNMENT));
}

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

  {
    const apiNoPerm = createExtensionApi('xer-source-read-contract-no-perm', [], undefined, appStoreContext, {
      app: appStoreContext,
      showNotification: () => {},
    });
    const apiOtherPerm = createExtensionApi('xer-source-read-contract-other-perm', ['ribbon', 'events'], undefined, appStoreContext, {
      app: appStoreContext,
      showNotification: () => {},
    });
    await i18next.init({
      lng: 'en', fallbackLng: 'en', ns: ['menu'],
      resources: { nl: { menu: nlMenu }, en: { menu: enMenu } },
      interpolation: { escapeValue: false },
    });
    for (const { lng, message } of [
      { lng: 'nl', message: (id: string) => `Extensie "${id}" mist permissie: importSource` },
      { lng: 'en', message: (id: string) => `Extension "${id}" is missing permission: importSource` },
    ]) {
      await i18next.changeLanguage(lng);
      const throwsWithout = (fn: () => unknown, id: string): boolean => {
        try { fn(); return false; } catch (error) {
          return error instanceof Error && error.message === message(id);
        }
      };
      eq(`P1 ${lng} zonder permissies gooien alle bronmethoden een concrete permissiefout`, [
        throwsWithout(() => apiNoPerm.data.getImportSourceInfo(), 'xer-source-read-contract-no-perm'),
        throwsWithout(() => apiNoPerm.data.getImportSourceChunk(0), 'xer-source-read-contract-no-perm'),
        throwsWithout(() => apiNoPerm.data.getImportSourceCatalogPage('taskSourceRows'), 'xer-source-read-contract-no-perm'),
        throwsWithout(() => apiNoPerm.data.getImportSourceIssue(), 'xer-source-read-contract-no-perm'),
      ], [true, true, true, true]);
      eq(`P1a ${lng} een ONgerelateerde permissie (ribbon/events) geeft geen toegang tot importSource`, [
        throwsWithout(() => apiOtherPerm.data.getImportSourceInfo(), 'xer-source-read-contract-other-perm'),
        throwsWithout(() => apiOtherPerm.data.getImportSourceChunk(0), 'xer-source-read-contract-other-perm'),
        throwsWithout(() => apiOtherPerm.data.getImportSourceCatalogPage('taskSourceRows'), 'xer-source-read-contract-other-perm'),
        throwsWithout(() => apiOtherPerm.data.getImportSourceIssue(), 'xer-source-read-contract-other-perm'),
      ], [true, true, true, true]);
    }
    apiNoPerm._cleanup();
    apiOtherPerm._cleanup();
  }
  eq('P1b importSource staat in de door de app gekende permissies (SDK-constante)',
    KNOWN_PERMISSIONS.includes('importSource'), true);
  eq('P1c een manifest dat importSource declareert behoudt hem ongewijzigd (geen filtering)',
    sanitizeManifestPermissions(['importSource', 'ribbon'], 'x'), ['importSource', 'ribbon']);

  eq('37 een niet-XER-document geeft geen broninfo', api.data.getImportSourceInfo(), null);
  eq('37b een niet-XER-document heeft ook geen archief-issue', api.data.getImportSourceIssue(), null);
  useAppStore.setState({ xerArchiveIssue: { code: 'hash-mismatch', detail: 'Ongeldig OPS_XerSourceArchive: test' } });
  eq('37c weggelaten archief: info null, issue geeft alleen de code (geen technische detail)', {
    info: api.data.getImportSourceInfo(), issue: api.data.getImportSourceIssue(),
  }, { info: null, issue: { code: 'hash-mismatch' } });
  useAppStore.setState({ xerArchiveIssue: null });
  eq('37a chunk- en catalogusroute geven zonder XER null', [
    api.data.getImportSourceChunk(0), api.data.getImportSourceCatalogPage('taskSourceRows'),
  ], [null, null]);
  const applied = useAppStore.getState().applyOpenedImport(opened, {
    filePath: null, recompute: false, fit: false, linkedOpen: true,
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
      'getImportSourceCatalogPage', 'getImportSourceChunk', 'getImportSourceInfo', 'getImportSourceIssue',
    ]);

  let invalidRange = false;
  try { api.data.getImportSourceCatalogPage('taskSourceRows', { offset: -1 }); } catch (error) { invalidRange = error instanceof RangeError; }
  let oversizedRange = false;
  try { api.data.getImportSourceCatalogPage('taskSourceRows', { limit: 501 }); } catch (error) { oversizedRange = error instanceof RangeError; }
  let invalidCollection = false;
  try { api.data.getImportSourceCatalogPage('onbekend' as never); } catch (error) { invalidCollection = error instanceof RangeError; }
  eq('44 ongeldige catalogusvragen worden fail-closed gevalideerd', [invalidRange, oversizedRange, invalidCollection], [true, true, true]);

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

  const xerDocumentId = applied.documentIds[0];
  if (xerDocumentId) useAppStore.getState().switchDocument(xerDocumentId);
  eq('48 documentwissel herstelt de XER-selector en bronroute', {
    selector: api.data.getImportSourceInfo()?.sourceProjectId,
    taskId: cell(api.data.getImportSourceCatalogPage('taskSourceRows', { limit: 1 })?.items[0], 'task_id'),
  }, { selector: 'P-1', taskId: 'T-1' });

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

{
  eq('32 de host-API-versie is een geldige semver', /^\d+\.\d+\.\d+$/.test(EXTENSION_API_VERSION), true);

  eq('31 geen apiVersion ⇒ toegestaan', checkApiCompatibility(undefined, '1.2.0').ok, true);
  eq('31a en gemarkeerd als legacy', checkApiCompatibility(undefined, '1.2.0').legacy, true);
  eq('31b lege string telt als geen', checkApiCompatibility('', '1.2.0').legacy, true);
  eq('31c spaties ook', checkApiCompatibility('   ', '1.2.0').legacy, true);

  eq('32 gelijke versie mag', checkApiCompatibility('1.2.0', '1.2.0').ok, true);
  eq('32a oudere minor mag (toevoegingen zijn achterwaarts compatibel)', checkApiCompatibility('1.0.0', '1.2.0').ok, true);
  eq('32b nieuwere minor mag NIET', checkApiCompatibility('1.3.0', '1.2.0').ok, false);
  eq('32c patch doet niet mee — hoger', checkApiCompatibility('1.2.9', '1.2.0').ok, true);
  eq('32d patch doet niet mee — lager', checkApiCompatibility('1.2.0', '1.2.9').ok, true);
  eq('32e major.minor zonder patch mag', checkApiCompatibility('1.2', '1.2.0').ok, true);

  eq('33 oudere major mag niet', checkApiCompatibility('0.9.0', '1.2.0').ok, false);
  eq('33a nieuwere major mag niet', checkApiCompatibility('2.0.0', '1.2.0').ok, false);

  for (const onzin of ['abc', '1.x', 'v1.0.0', '1', '1..0', '-1.0.0']) {
    eq(`34 onzin-apiVersion "${onzin}" wordt geweigerd`, checkApiCompatibility(onzin, '1.2.0').ok, false);
  }

  for (const slecht of ['0.9.0', '2.0.0', '1.3.0', 'abc']) {
    const r = checkApiCompatibility(slecht, '1.2.0');
    eq(`35 weigering van "${slecht}" draagt een reden`, typeof r.reason === 'string' && r.reason.length > 10, true);
  }
  eq('35a een toestemming draagt géén reden', checkApiCompatibility('1.0.0', '1.2.0').reason, undefined);

  eq('36 de host accepteert zijn eigen versie', checkApiCompatibility(EXTENSION_API_VERSION).ok, true);
}

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
  eq('39 productiehost bindt de meldingen aan het kanaal van de app-context',
    /showNotification: createExtensionNotifier\(appStoreContext\)/.test(loaderSource), true);
  const notifierSource = readFileSync(join(process.cwd(), 'src/extensions/extensionNotifications.ts'), 'utf8');
  eq('39a de notifier importeert geen app-singleton',
    /^import[^;]*\b(useAppStore|appStoreContext)\b[^;]*from/m.test(notifierSource), false);
}

{
  const p6Options: Project['schedulingOptions'] = {
    p6CompletedLateFromRemainingWindow: true,
    startToStartLagFrom: 'actualStart',
    useExpectedFinishDates: true,
    useProjectEndDateForFloat: true,
    leveling: { preserveScheduledDates: true },
    totalFloatMode: 'smallest',
    criticalDefinition: { mode: 'totalFloat', threshold: 0, thresholdHours: 8 },
  };
  const zetP6 = () => {
    useAppStore.getState().newProject();
    useAppStore.setState((s) => {
      s.project.schedulingProfile = builtInProfile('p6');
      s.project.schedulingOptions = structuredClone(p6Options);
    });
  };
  const api = createExtensionApi('n3-loadproject-profiel', [], undefined, appStoreContext, {
    app: appStoreContext,
    showNotification: () => {},
  });
  const herladen = (wijzig?: (project: ReturnType<typeof api.data.getProject>) => void) => {
    const project = api.data.getProject();
    wijzig?.(project);
    api.data.loadProject({
      project, calendar: api.data.getCalendar(), tasks: api.data.getTasks(), sequences: api.data.getSequences(),
      resources: api.data.getResources(), assignments: api.data.getAssignments(),
    });
    return useAppStore.getState().project;
  };

  zetP6();
  const na = herladen();
  eq('N3-01 loadProject(getProject()) houdt het P6-profiel', na.schedulingProfile, builtInProfile('p6'));
  eq('N3-02 de vier P6-opties en leveling blijven', [
    na.schedulingOptions?.p6CompletedLateFromRemainingWindow, na.schedulingOptions?.startToStartLagFrom,
    na.schedulingOptions?.useExpectedFinishDates, na.schedulingOptions?.useProjectEndDateForFloat,
    na.schedulingOptions?.leveling,
  ], [true, 'actualStart', true, true, { preserveScheduledDates: true }]);
  eq('N3-04 het opgeloste profiel via getProject blijft p6', api.data.getProject().schedulingProfile?.id, 'p6');

  zetP6();
  const gewijzigd = herladen((project) => {
    project.schedulingOptions = { ...project.schedulingOptions, totalFloatMode: 'finish', nearCriticalThreshold: 5 };
  });
  eq('N3-05 gewijzigde publieke opties volgen de extensie, P6-opties blijven', [
    gewijzigd.schedulingOptions?.totalFloatMode, gewijzigd.schedulingOptions?.nearCriticalThreshold,
    gewijzigd.schedulingOptions?.useExpectedFinishDates, gewijzigd.schedulingProfile?.id,
  ], ['finish', 5, true, 'p6']);

  zetP6();
  const vreemdProfiel = herladen((project) => {
    (project as unknown as { schedulingProfile: unknown }).schedulingProfile = builtInProfile('msproject');
  });
  eq('N3-06 een profiel van de extensie wint niet van het documentprofiel', vreemdProfiel.schedulingProfile?.id, 'p6');

  zetP6();
  const weggehaald = herladen((project) => {
    const { totalFloatMode: _weg, ...rest } = project.schedulingOptions ?? {};
    project.schedulingOptions = rest;
  });
  eq('N3-08a een weggehaalde publieke optie is weg; P6-opties blijven', [
    weggehaald.schedulingOptions?.totalFloatMode, weggehaald.schedulingOptions?.useExpectedFinishDates,
  ], [undefined, true]);

  zetP6();
  const ander = herladen((project) => { project.id = 'ander-project'; });
  eq('N3-08 ander project-id ⇒ OPS en alleen publieke opties', [
    ander.id, ander.schedulingProfile, ander.schedulingOptions?.useExpectedFinishDates,
    ander.schedulingOptions?.leveling, ander.schedulingOptions?.totalFloatMode,
  ], ['ander-project', undefined, undefined, undefined, 'smallest']);
}

{
  const api = createExtensionApi('n3-loadproject-document', [], undefined, appStoreContext, {
    app: appStoreContext,
    showNotification: () => {},
  });
  const herladen = (wijzig?: (r: ExtImportResult) => void) => {
    const r: ExtImportResult = {
      project: api.data.getProject(), calendar: api.data.getCalendar(), tasks: api.data.getTasks(),
      sequences: api.data.getSequences(), resources: api.data.getResources(), assignments: api.data.getAssignments(),
    };
    wijzig?.(r);
    api.data.loadProject(r);
    return useAppStore.getState();
  };
  const zetDocument = () => {
    useAppStore.getState().newProject();
    const taakId = api.data.addTask({ name: 'Op ploegkalender' });
    const basis = useAppStore.getState().calendar;
    const ploeg: WorkCalendar = { ...structuredClone(basis), id: 'cal-ploeg', name: 'Ploeg' };
    useAppStore.setState((s) => {
      s.calendars = [
        ...s.calendars.map((c) => (c.id === s.project.calendarId ? { ...c, p6NonWorkPenaltyDates: ['2026-01-05'] } : c)),
        ploeg,
      ];
      s.calendar = s.calendars.find((c) => c.id === s.project.calendarId)!;
      s.resources = [{ ...VOL_RESOURCE, parentId: undefined, libraryOrigin: undefined, calendarId: 'cal-ploeg' }];
      const taak = s.tasks.find((t) => t.id === taakId);
      if (taak) taak.calendarId = 'cal-ploeg';
      s.baselines = [{ id: 'bl-1', name: 'Start', createdAt: '2026-01-01T00:00:00Z', tasks: [], projectEnd: '2026-02-01T16:00', projectDuration: 20 }];
      s.activeBaselineId = 'bl-1';
      s.activityCodeTypes = [{ id: 'act-fase', name: 'Fase', values: [{ id: 'v-ruw', code: 'RUW' }] }];
      s.customFieldDefs = [{ id: 'cf-kosten', name: 'Kosten', type: 'cost' }];
      s.ifcGlobalIds = { 'task:x': '0123456789abcdefghijkl' };
    });
    return taakId;
  };

  const taakId = zetDocument();
  const voor = useAppStore.getState();
  const na = herladen();
  eq('N3D-12 vastgehouden documentobjecten zijn bevroren en gaan zonder kopie mee', [
    Object.isFrozen(voor.baselines[0]), Object.isFrozen(voor.activityCodeTypes[0]), Object.isFrozen(voor.customFieldDefs[0]),
    Object.isFrozen(voor.calendars.find((c) => c.id === 'cal-ploeg')),
    na.baselines[0] === voor.baselines[0], na.activityCodeTypes[0] === voor.activityCodeTypes[0],
  ], [true, true, true, true, true, true]);
  eq('N3D-01 baselines blijven', na.baselines.map((b) => b.id), ['bl-1']);
  eq('N3D-02 activeBaselineId blijft', na.activeBaselineId, 'bl-1');
  eq('N3D-03 resourcekalenders blijven, zonder dubbele projectkalender',
    na.calendars.map((c) => c.id).sort(), [na.project.calendarId, 'cal-ploeg'].sort());
  eq('N3D-04 activityCodeTypes blijven', na.activityCodeTypes.map((t) => t.id), ['act-fase']);
  eq('N3D-05 customFieldDefs blijven', na.customFieldDefs.map((d) => d.id), ['cf-kosten']);
  eq('N3D-06 ifcGlobalIds blijven', na.ifcGlobalIds, { 'task:x': '0123456789abcdefghijkl' });
  eq('N3D-07 resource en taak houden hun verwijzing naar de ploegkalender', [
    na.resources[0]?.calendarId, na.tasks.find((t) => t.id === taakId)?.calendarId,
  ], ['cal-ploeg', 'cal-ploeg']);
  eq('N3D-07a ongewijzigde projectkalender houdt velden die ExtCalendar niet naar binnen draagt',
    na.calendar.p6NonWorkPenaltyDates, ['2026-01-05']);

  const schemaGevallen: [string, string | undefined, string | undefined][] = [
    ['IFC4-bestand met open vraag', 'IFC4', 'IFC4'],
    ['IFC2X3-bestand met open vraag', undefined, 'IFC2X3'],
    ['bevestigd IFC 4.3', 'IFC4X3', undefined],
  ];
  for (const [label, schema, open] of schemaGevallen) {
    zetDocument();
    useAppStore.setState((s) => {
      if (schema) s.project.ifcSchema = schema as IfcSchemaId; else delete s.project.ifcSchema;
      if (open) s.project.ifcSchemaUnconfirmed = open; else delete s.project.ifcSchemaUnconfirmed;
    });
    const terug = herladen();
    eq(`N3D-14 ${label}: schema en open vraag blijven na loadProject`,
      [terug.project.ifcSchema, terug.project.ifcSchemaUnconfirmed, ifcSchemaBlocksSilentWrite(terug.project)],
      [schema, open, open === 'IFC2X3']);
  }
  zetDocument();
  useAppStore.setState((s) => { s.project.ifcSchema = 'IFC4'; s.project.ifcSchemaUnconfirmed = 'IFC4'; });
  const nieuwId = herladen((r) => { r.project = { ...r.project, id: 'ander-project-schema' }; });
  eq('N3D-15 ander id ⇒ nieuw project: geen schema en geen open vraag van het vorige bestand',
    [nieuwId.project.ifcSchema, nieuwId.project.ifcSchemaUnconfirmed, nieuwId.filePath], [undefined, undefined, null]);

  zetDocument();
  useAppStore.setState((s) => {
    const meta = {
      p6Source: 'XER' as const, p6NonWorkPenaltyDatesState: 'VALID_VALUES' as const,
      generation: { ruleSetId: 'NL', generatedFromYear: 2026, generatedToYear: 2026 } as CalendarGeneration,
    };
    s.calendars = s.calendars.map((c) => (c.id === s.project.calendarId ? { ...c, ...meta } : c));
    s.calendar = s.calendars.find((c) => c.id === s.project.calendarId)!;
  });
  const kalender = herladen((r) => {
    r.calendar = { ...r.calendar, holidays: [...r.calendar.holidays, { name: 'Extensievrij', startDate: '2026-07-01', endDate: '2026-07-01' }] };
  });
  eq('N3D-09 een gewijzigde projectkalender volgt de extensie (cache én bibliotheek)', [
    kalender.calendar.holidays.some((h) => h.name === 'Extensievrij'),
    kalender.calendars.find((c) => c.id === kalender.project.calendarId)?.holidays.some((h) => h.name === 'Extensievrij'),
    kalender.calendars.map((c) => c.id).sort(),
  ], [true, true, [kalender.project.calendarId, 'cal-ploeg'].sort()]);
  eq('N3D-22 een gewijzigde projectkalender houdt de bronvelden van de documentkalender', [
    kalender.calendar.p6Source, kalender.calendar.p6NonWorkPenaltyDates, kalender.calendar.p6NonWorkPenaltyDatesState,
    kalender.calendar.generation?.ruleSetId,
  ], ['XER', ['2026-01-05'], 'VALID_VALUES', 'NL']);

  zetDocument();
  const oudeKalender = useAppStore.getState().project.calendarId;
  const expliciet = api.data.addTask({ name: 'Expliciet op projectkalender' });
  useAppStore.setState((s) => {
    const t = s.tasks.find((x) => x.id === expliciet);
    if (t) t.calendarId = oudeKalender;
  });
  const wissel = herladen((r) => { r.project = { ...r.project, calendarId: 'cal-ploeg' }; });
  eq('N3D-16 kalenderwissel houdt de oude projectkalender en de verwijzing ernaar', [
    wissel.project.calendarId, wissel.calendar.id, wissel.calendars.map((c) => c.id).sort(),
    wissel.tasks.find((t) => t.id === expliciet)?.calendarId,
  ], ['cal-ploeg', 'cal-ploeg', [oudeKalender, 'cal-ploeg'].sort(), oudeKalender]);

  zetDocument();
  const vorigeKalender = useAppStore.getState().project.calendarId;
  const vierdaags = herladen((r) => {
    r.calendar = { ...getExtensionSdk().factory.createCalendar(), id: 'cal-vierdaags', workDays: [1, 2, 3, 4] };
  });
  eq('N3D-20 meegestuurde kalender met ander id wordt de projectkalender', [
    vierdaags.project.calendarId, vierdaags.calendar.id, vierdaags.calendar.workDays,
    vierdaags.calendars.map((c) => c.id).sort(),
  ], ['cal-vierdaags', 'cal-vierdaags', [1, 2, 3, 4], [vorigeKalender, 'cal-ploeg', 'cal-vierdaags'].sort()]);

  zetDocument();
  const beide = herladen((r) => {
    r.project = { ...r.project, calendarId: 'cal-ploeg' };
    r.calendar = { ...getExtensionSdk().factory.createCalendar(), id: 'cal-nieuw' };
  });
  eq('N3D-21 wissel plus nieuwe kalender: projectkalender is de gekozen, de nieuwe staat in de bibliotheek', [
    beide.project.calendarId, beide.calendars.some((c) => c.id === 'cal-nieuw'),
  ], ['cal-ploeg', true]);

  zetDocument();
  useAppStore.setState((s) => {
    s.customTaskTypes = [
      { id: 'ops-ongebruikt', name: 'Ongebruikt', color: '#111111' },
      { id: 'zelfde-id', name: 'Oude naam', color: '#222222' },
      { id: 'doc-ruwbouw', name: 'Ruwbouw', color: '#333333' },
    ];
  });
  const typen = herladen((r) => {
    r.customTaskTypes = [{ id: 'zelfde-id', name: 'Nieuwe naam' }, { id: 'ext-ruwbouw', name: 'ruwbouw' }];
  });
  eq('N3D-17 ongebruikte eigen taaktypes blijven; de extensie wint bij een botsing op id of naam',
    typen.customTaskTypes, [
      { id: 'zelfde-id', name: 'Nieuwe naam', color: '#222222' },
      { id: 'ext-ruwbouw', name: 'ruwbouw', color: CUSTOM_TASK_TYPE_COLOR_ORDER[0] },
      { id: 'ops-ongebruikt', name: 'Ongebruikt', color: '#111111' },
    ]);

  const onbekendTaakId = zetDocument();
  const onbekend = herladen((r) => {
    r.resources = r.resources.map((x) => ({ ...x, calendarId: 'bestaat-niet' }));
    r.tasks = r.tasks.map((x) => (x.id === onbekendTaakId ? { ...x, calendarId: 'bestaat-niet' } : x));
  });
  eq('N3D-10 onbekende kalender op resource en taak valt terug op de projectkalender', [
    onbekend.resources[0]?.calendarId, onbekend.tasks.find((t) => t.id === onbekendTaakId)?.calendarId,
  ], [undefined, undefined]);

  const anderTaakId = zetDocument();
  const ander = herladen((r) => { r.project = { ...r.project, id: 'ander-project-2' }; });
  eq('N3D-11 ander id ⇒ baselines, resourcekalenders, codes, velden en GlobalIds weg', [
    ander.baselines.length, ander.activeBaselineId, ander.calendars.some((c) => c.id === 'cal-ploeg'),
    ander.activityCodeTypes.length, ander.customFieldDefs.length, ander.ifcGlobalIds,
  ], [0, null, false, 0, 0, null]);
  eq('N3D-08 ander id ⇒ geen opschoning: de verwijzingen blijven zoals op main', [
    ander.resources[0]?.calendarId, ander.tasks.find((t) => t.id === anderTaakId)?.calendarId,
  ], ['cal-ploeg', 'cal-ploeg']);
}

{
  eq('N3D-14 de bronveldlijsten zijn precies de velden die niet naar binnen oversteken', [
    [...TASK_SOURCE_FIELDS], [...SEQUENCE_SOURCE_FIELDS], [...CALENDAR_SOURCE_FIELDS].sort(),
    [...ASSIGNMENT_SOURCE_FIELDS].sort(),
  ], [
    LEES_ALLEEN_EXT.task, LEES_ALLEEN_EXT.sequence,
    [...LEES_ALLEEN_EXT.calendar, ...NIET_PUBLIEK.calendar.filter((k) => k !== 'libraryOrigin')].sort(),
    [...LEES_ALLEEN_EXT.assignment, ...NIET_PUBLIEK.assignment].sort(),
  ]);

  const xer = [
    'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    '%R\tP1\tVoortgang\tC1\t2026-08-10 08:00',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tsuspend_date\tresume_date\texpect_end_date',
    '%R\tA\tP1\tC1\tA\tVerwacht einde\tTT_Task\tTK_Active\tCP_Phys\t10\t75\t8\t2\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t\t\t\t2026-08-12 16:00',
    '%E',
  ].join('\n');
  const parsedXer = readXER(new TextEncoder().encode(xer));
  if (isMultiDocumentImport(parsedXer)) throw new Error('N3D-13: verwacht één XER-project');
  useAppStore.getState().newProject();
  useAppStore.getState().openAsDocument(parsedXer, { name: 'n3d-13.xer', ref: null });
  useAppStore.getState().runCPM();
  const api = createExtensionApi('n3d-p6-bronvelden', [], undefined, appStoreContext, {
    app: appStoreContext,
    showNotification: () => {},
  });
  const taak = () => useAppStore.getState().tasks.find((t) => t.name === 'Verwacht einde');
  const voor = { earlyFinish: taak()?.time.earlyFinish, p6ExpectedFinish: taak()?.p6ExpectedFinish };
  api.data.loadProject({
    project: api.data.getProject(), calendar: api.data.getCalendar(), tasks: api.data.getTasks(),
    sequences: api.data.getSequences(), resources: api.data.getResources(), assignments: api.data.getAssignments(),
  });
  eq('N3D-13 earlyFinish en P6-bronvelden blijven exact gelijk na loadProject(get*())', [
    taak()?.time.earlyFinish, taak()?.p6ExpectedFinish, taak()?.p6CompletePctType, taak()?.p6ProjectId,
  ], [voor.earlyFinish, voor.p6ExpectedFinish, 'CP_Phys', 'P1']);
  eq('N3D-13a de fixture zelf rekent met het verwachte einde', voor.earlyFinish, '2026-08-12T16:00');

  useAppStore.getState().newProject();
  const a = api.data.addTask({ name: 'A' });
  const b = api.data.addTask({ name: 'B' });
  const relatie = api.data.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  useAppStore.setState((s) => {
    const seq = s.sequences.find((x) => x.id === relatie);
    if (seq) seq.p6StartAtPredecessorFinishBoundary = true;
  });
  api.data.loadProject({
    project: api.data.getProject(), calendar: api.data.getCalendar(), tasks: api.data.getTasks(),
    sequences: api.data.getSequences(), resources: api.data.getResources(), assignments: api.data.getAssignments(),
  });
  eq('N3D-15 p6StartAtPredecessorFinishBoundary blijft op de relatie',
    useAppStore.getState().sequences.find((x) => x.id === relatie)?.p6StartAtPredecessorFinishBoundary, true);
}

{
  const api = createExtensionApi('n3d-dirty', [], undefined, appStoreContext, {
    app: appStoreContext,
    showNotification: () => {},
  });
  const lees = (): ExtImportResult => ({
    project: api.data.getProject(), calendar: api.data.getCalendar(), tasks: api.data.getTasks(),
    sequences: api.data.getSequences(), resources: api.data.getResources(), assignments: api.data.getAssignments(),
  });
  const opgeslagen = () => {
    useAppStore.getState().newProject();
    api.data.addTask({ name: 'Bewaard' });
    useAppStore.setState((s) => { s.filePath = 'bewaard.ifc'; s.isDirty = false; s.autoSaveToFile = true; });
  };

  opgeslagen();
  api.data.loadProject(lees());
  eq('N3D-18 zelfde id ⇒ opslagdoel blijft, document is gewijzigd', [
    useAppStore.getState().filePath, useAppStore.getState().isDirty,
  ], ['bewaard.ifc', true]);
  eq('N3D-23 zelfde id ⇒ AutoSave naar bestand blijft aan', useAppStore.getState().autoSaveToFile, true);

  opgeslagen();
  const ander = lees();
  ander.project = { ...ander.project, id: 'nieuw-project-n3d-19' };
  api.data.loadProject(ander);
  eq('N3D-19 ander id ⇒ geen opslagdoel, document is gewijzigd', [
    useAppStore.getState().filePath, useAppStore.getState().fileHandle, useAppStore.getState().siteFileId,
    useAppStore.getState().isDirty,
  ], [null, null, null, true]);
  eq('N3D-23a ander id ⇒ geen AutoSave naar bestand (er is geen bestand)', useAppStore.getState().autoSaveToFile, false);
}

{
  const api = createExtensionApi('n3d-importer', [], undefined, appStoreContext, {
    app: appStoreContext,
    showNotification: () => {},
  });
  useAppStore.getState().newProject();
  api.data.addTask({ name: 'Niet-opgeslagen werk' });
  useAppStore.setState((s) => { s.filePath = 'eigen-project.ifc'; });
  const voor = useAppStore.getState();
  const oudDocument = voor.activeDocumentId;
  const oudeTaken = voor.tasks.map((t) => t.name);
  const aantalDocumenten = voor.documents.length;

  const importResultaat = getExtensionSdk().factory.emptyImportResult();
  importResultaat.project = { ...importResultaat.project, id: 'import-vreemd', name: 'Uit importer' };
  importResultaat.tasks = [getExtensionSdk().factory.createTask({ name: 'Geïmporteerd' })];
  openExtensionImport(useAppStore, importResultaat, 'planning.foo');

  const na = useAppStore.getState();
  const oud = na.documents.find((d) => d.id === oudDocument);
  eq('N3D-24 importer ⇒ nieuw actief document; het actieve document met niet-opgeslagen werk blijft gelijk', [
    na.documents.length, na.activeDocumentId !== oudDocument, na.project.id, na.tasks.map((t) => t.name),
    oud?.payload?.tasks.map((t) => t.name), oud?.payload?.isDirty, oud?.payload?.filePath,
  ], [aantalDocumenten + 1, true, 'import-vreemd', ['Geïmporteerd'], oudeTaken, true, 'eigen-project.ifc']);
  eq('N3D-24a nieuw document zoals na een verse import: geen opslagdoel, niet gewijzigd', [
    na.filePath, na.fileHandle, na.siteFileId, na.isDirty,
  ], [null, null, null, false]);

  useAppStore.setState((s) => { s.ui.formatNoticeHidden = []; s.ui.pendingFormatNotice = null; });
  openExtensionImport(useAppStore, importResultaat, 'planning.xer');
  eq('N3D-24b importer met een .xer-naam ⇒ geen formaatuitleg', useAppStore.getState().ui.pendingFormatNotice, null);

  const backstage = readFileSync(join(process.cwd(), 'src/components/backstage/Backstage.tsx'), 'utf8');
  eq('N3D-25 Backstage → Importeren opent via importWithExtension, niet via loadState', [
    /importWithExtension\(useAppStore, imp, file\)/.test(backstage),
    /\bloadState\b/.test(backstage),
  ], [true, false]);

  const voorFout = useAppStore.getState();
  const importFouten = (s: typeof voorFout) => s.ui.notifications.filter((n) => n.messageKey === 'notifications.extImportFailed');
  const meldingenVoor = importFouten(voorFout).length;
  const gelukt = await importWithExtension(useAppStore, {
    name: 'Kapotte importer',
    handler: async () => { throw new Error('Kolom "Start" ontbreekt'); },
  }, new File(['x'], 'kapot.foo'));
  const naFout = useAppStore.getState();
  const melding = importFouten(naFout).at(-1);
  eq('N3D-26 mislukte importer ⇒ foutmelding met naam en boodschap; document ongemoeid', [
    gelukt, importFouten(naFout).length - meldingenVoor, melding?.severity, melding?.messageKey,
    melding?.params, melding?.detail, naFout.activeDocumentId === voorFout.activeDocumentId,
    naFout.documents.length === voorFout.documents.length,
  ], [false, 1, 'error', 'notifications.extImportFailed', { name: 'Kapotte importer' }, 'Kolom "Start" ontbreekt', true, true]);
}

{
  const host = { app: appStoreContext, showNotification: () => {} };
  const api = createExtensionApi('host-event-isolatie', ['events'], undefined, appStoreContext, host);
  const withoutPermission = createExtensionApi('zonder-events', [], undefined, appStoreContext, host);
  const seen: unknown[] = [];
  for (const event of [...Object.values(HOST_EVENTS), 'host:future-event', 'host:']) {
    const unsubscribe = api.events.on(event, value => seen.push(value));
    const before = seen.length;
    let error = '';
    try { api.events.emit(event, 'vervalst'); } catch (e) { error = String(e); }
    eq(event + ': duidelijke weigering voor gereserveerde naam', error.includes('reserved'), true);
    eq(event + ': geweigerde emissie bereikt geen luisteraar', seen.length, before);
    emitExtensionEvent(event, 'echte host');
    eq(event + ': echte host-emissie blijft werken', seen.slice(before), ['echte host']);
    unsubscribe();
    emitExtensionEvent(event, 'afgemeld');
    eq(event + ': afmelden blijft werken', seen.length, before + 1);
  }
  const custom: unknown[] = [];
  const listener = (value: unknown) => { custom.push(value); };
  api.events.on('fixture:custom', listener);
  api.events.emit('fixture:custom', { ok: true });
  eq('eigen extensie-event blijft toegestaan', custom, [{ ok: true }]);
  let denied = false;
  try { withoutPermission.events.emit('fixture:custom', 'geen permissie'); } catch { denied = true; }
  eq('events-permissie blijft verplicht', denied, true);
  eq('geen permissie betekent geen verzending', custom.length, 1);
  api.events.off('fixture:custom', listener);
  api.events.emit('fixture:custom', 'afgemeld');
  eq('off werkt voor eigen events', custom.length, 1);
  api.events.on(HOST_EVENTS.projectNew, listener);
  api._cleanup();
  emitExtensionEvent(HOST_EVENTS.projectNew, 'na cleanup');
  eq('cleanup verwijdert ook host-abonnementen', custom.length, 1);
  withoutPermission._cleanup();
}

if (diffs.length === 0) {
  console.log(`OK: extensie-contract — ${checks} checks groen`);
} else {
  console.log(`XX extensie-contract — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
