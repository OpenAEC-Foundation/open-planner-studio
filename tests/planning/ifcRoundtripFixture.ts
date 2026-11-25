import type { Task, TaskTime, ExternalLink, TaskSplitGap, TaskTimephasedContour } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Project, ProjectSchedulingOptions } from '@/types/project';
import type { WorkCalendar, CalendarGeneration } from '@/types/calendar';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { Baseline } from '@/types/baseline';
import type { ImportResult } from '@/services/importTypes';

const PROJ_GEN: Required<CalendarGeneration> = {
  ruleSetId: 'NL', region: 'NB', breakChoice: 'zuid', generatedFromYear: 2025, generatedToYear: 2028,
};
const LIB_GEN: Required<CalendarGeneration> = {
  ruleSetId: 'DE', region: 'BY', breakChoice: 'noord', generatedFromYear: 2024, generatedToYear: 2027,
};
const projCal = {
  id: 'projcal', name: 'Projectkalender', description: 'Ma-vr 07-16 dag (lunchuur)',
  workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
  holidays: [
    { name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' },
    { name: 'Nieuwjaar', startDate: '2027-01-01', endDate: '2027-01-01' },
  ],
  workingExceptions: [],
  ifcTimePeriods: [],
  p6Source: 'XER',
  p6NonWorkPenaltyDates: ['2026-12-27'],
  p6NonWorkPenaltyDatesState: 'VALID_VALUES',
  generation: PROJ_GEN, shift: 'SECOND',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-projcal', poolVersion: 4 },
} satisfies Omit<Required<WorkCalendar>, 'workTime' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>;
const libCal = {
  id: 'libcal', name: 'Sublokatie kalender', description: 'Ma-za 07-15',
  workDays: [1, 2, 3, 4, 5, 6], workStartHour: 7, workEndHour: 15, hoursPerDay: 8,
  holidays: [{ name: 'Bouwvakdag', startDate: '2026-07-27', endDate: '2026-07-31' }],
  workingExceptions: [
    { name: 'Overwerkdag', startDate: '2026-08-08', endDate: '2026-08-08', bands: [{ start: 360, end: 720 }] },
    { name: 'Verschoven werkdag', startDate: '2026-08-15', endDate: '2026-08-15' },
  ],
  ifcTimePeriods: [],
  p6Source: 'XER',
  p6NonWorkPenaltyDates: [],
  p6NonWorkPenaltyDatesState: 'VALID_EMPTY',
  generation: LIB_GEN, shift: 'THIRD',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-libcal', poolVersion: 4 },
} satisfies Omit<Required<WorkCalendar>, 'workTime' | 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>;

const MA_DO = [{ start: 420, end: 720 }, { start: 750, end: 930 }];
const hourCal = {
  id: 'hourcal', name: 'Uurkalender korte vrijdag', description: 'Ma-do 07:00-12:00 + 12:30-15:30, vr 07:00-11:00',
  workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15.5, hoursPerDay: 8,
  holidays: [{ name: 'Koningsdag', startDate: '2026-04-27', endDate: '2026-04-27' }],
  workingExceptions: [],
  ifcTimePeriods: [],
  p6Source: 'XER',
  p6NonWorkPenaltyDates: [],
  p6NonWorkPenaltyDatesState: 'VALID_EMPTY',
  generation: LIB_GEN, shift: 'USERDEFINED',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-hourcal', poolVersion: 4 },
  workTime: { byWeekday: { 1: MA_DO, 2: MA_DO, 3: MA_DO, 4: MA_DO, 5: [{ start: 420, end: 660 }], 6: [], 7: [] } },
} satisfies Omit<Required<WorkCalendar>, 'simpleBreakStartMinute' | 'simpleBreakDurationMinutes'>;

const _CALENDAR_FIELD_WITNESS = {
  id: 'w', name: 'w', description: 'w', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 30,
  workingExceptions: [{ name: 'w', startDate: '2026-01-01', endDate: '2026-01-01', bands: [{ start: 0, end: 60 }] }],
  ifcTimePeriods: [],
  p6Source: 'XER',
  p6NonWorkPenaltyDates: [],
  p6NonWorkPenaltyDatesState: 'VALID_EMPTY',
  generation: PROJ_GEN, shift: 'FIRST',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-witness', poolVersion: 1 },
  workTime: { byWeekday: { 1: [{ start: 480, end: 960 }], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } },
} satisfies Required<WorkCalendar>;
void _CALENDAR_FIELD_WITNESS;

const activityCodeTypes = [
  {
    id: 'act-loc', name: 'Locatie', values: [
      { id: 'v-b1', code: 'B1', description: 'Blok 1', color: '#ff0000' },
      { id: 'v-b2', code: 'B2', description: 'Blok 2', color: '#00ff00' },
    ],
  },
  {
    id: 'act-dis', name: 'Discipline', values: [
      { id: 'v-ruw', code: 'RUW', description: 'Ruwbouw', color: '#0000ff' },
      { id: 'v-afb', code: 'AFB', description: 'Afbouw', color: '#ffff00' },
    ],
  },
] satisfies ActivityCodeType[];
const customFieldDefs = [
  { id: 'cf-text', name: 'Tekstveld', type: 'text' },
  { id: 'cf-num', name: 'Getalveld', type: 'number' },
  { id: 'cf-int', name: 'Integerveld', type: 'integer' },
  { id: 'cf-cost', name: 'Kostenveld', type: 'cost' },
  { id: 'cf-date', name: 'Datumveld', type: 'date' },
  { id: 'cf-bool', name: 'Booleanveld', type: 'boolean' },
] satisfies CustomFieldDef[];

export const plainTime = (start: string, finish: string, dur: number): TaskTime => ({
  durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: dur,
  scheduleStart: start, scheduleFinish: finish,
  earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish,
  freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
});

const TP: Task = {
  id: 't-p', name: 'Fasering', description: 'Hoofdfase', wbsCode: '1',
  taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
  parentId: null, childIds: ['t-m', 't-x', 't-y'], resourceIds: [],
  time: plainTime('2026-07-06', '2026-07-24', 14),
};

export const TM = {
  id: 't-m', name: 'Oplevering', description: 'Contractuele opleverdatum', wbsCode: '1.1',
  taskType: 'INSTALLATION', status: 'COMPLETED', isMilestone: true, milestoneKind: 'FINISH',
  customTaskTypeId: '',
  mandatory: true, priority: 700, levelingDelay: 3,
  levelingDelayMinutes: 45, levelingDelayElapsed: true,
  splitGaps: [
    { afterMinutes: 120, gapMinutes: 60 } satisfies TaskSplitGap,
    { afterMinutes: 480, gapMinutes: 480, source: 'leveling' } satisfies TaskSplitGap,
    { afterMinutes: 1440, gapMinutes: 480, source: 'user' } satisfies TaskSplitGap,
  ],
  manuallyScheduled: true,
  timephasedFinishFloor: '2026-07-24T17:00', timephasedStartAnchor: '2026-07-24T08:00',
  timephasedDurationWalks: [
    { anchor: '2026-07-24T08:00', resourceCalendarId: 'libcal' },
    { anchor: '2026-07-24T09:00', resourceCalendarId: 'libcal', workMinutes: 1440 },
  ],
  timephasedContours: [
    { resourceUid: 501, periods: [
      { afterMinutes: 0, minutes: 240, workMinutes: 240, kind: 'actual' },
      { afterMinutes: 240, minutes: 60, workMinutes: 0, kind: 'actual' },
    ] },
    { resourceUid: null, periods: [
      { afterMinutes: 300, minutes: 180, workMinutes: 180, kind: 'remaining' },
    ] },
  ] satisfies TaskTimephasedContour[],
  mspTaskType: 'FIXED_WORK', effortDriven: true,
  workRule: 'FIXED_DURATION_WORK',
  p6DurationType: 'DT_FixedDUR2', p6ActivityType: 'TT_Rsrc',
  p6ProjectId: 'P1', p6TaskId: 'T1', p6ExplicitTargetWindow: true, p6CompletePctType: 'CP_Phys', p6ExpectedFinish: '2026-07-31T17:00',
  p6SuspendResume: true,
  isSummary: false,
  parentId: 't-p', childIds: [],
  resourceIds: ['r-cost'],
  color: '#abcdef',
  isHammock: true,
  activityCodes: { 'act-loc': 'v-b1', 'act-dis': 'v-ruw' },
  customFields: {
    'cf-text': 'hallo', 'cf-num': 3.14, 'cf-int': 7, 'cf-cost': 1250.5, 'cf-date': '2026-08-01', 'cf-bool': true,
  },
  constraint: { type: 'MSO', date: '2026-07-15', hard: true },
  constraint2: { type: 'FNLT', date: '2026-07-20' },
  externalLinks: [{
    id: 'e1', direction: 'predecessor', relType: 'FS', lagDays: 2, lagMinutes: 120,
    anchorDate: '2026-07-01',
    sourceRef: { projectId: 'p2', projectName: 'Ander project', taskId: 't9', taskName: 'Levering', filePath: '/x/ander.ifc', siteFileId: 'site-b7c1' },
    sourceMissing: false,
    sourceVersion: '12', anchorReadAt: '2026-11-02T14:10:00.000Z',
  } satisfies Required<ExternalLink>],
  deadline: '2026-07-22',
  calendarId: 'libcal',
  notes: [{ id: 'n1', text: 'Keuring', done: true }, { id: 'n2', text: 'Sleuteloverdracht', done: false }],
  time: {
    durationType: 'WORKTIME', durationUnit: 'hours', scheduleDuration: 1,
    durationMinutes: 480,
    scheduleStart: '2026-07-24T00:00', scheduleFinish: '2026-07-24T00:00',
    earlyStart: '2026-07-24T00:00', earlyFinish: '2026-07-24T00:00', lateStart: '2026-07-24T00:00', lateFinish: '2026-07-24T00:00',
    freeFloat: 2, totalFloat: 3, isCritical: true,
    totalFloatMinutes: 1440, freeFloatMinutes: 960,
    interferingFloat: 1.5, isNearCritical: true, floatPath: 1,
    actualStart: '2026-07-24T00:00', actualFinish: '2026-07-24T00:00', actualDuration: 0,
    remainingTime: 0, remainingMinutes: 0,
    completion: 1,
    progressBeforeRecalculation: { status: 'STARTED', completion: 0.2, actualStart: '2026-07-24T00:00' },
    resume: '2026-07-24', stop: '2026-07-24',
  },
} satisfies Required<Task> & { time: Required<TaskTime> };

export const TX: Task = {
  id: 't-x', name: 'Ruwbouw', description: 'Casco', wbsCode: '1.2',
  taskType: 'DEMOLITION', status: 'NOT_STARTED', isMilestone: false, priority: 500,
  parentId: 't-p', childIds: [], resourceIds: ['r-mem', 'r-cost'],
  time: plainTime('2026-07-06', '2026-07-10', 5),
};
const TY: Task = {
  id: 't-y', name: 'Installaties', description: 'E+W', wbsCode: '1.3',
  taskType: 'LOGISTIC', status: 'NOT_STARTED', isMilestone: false, priority: 500,
  parentId: 't-p', childIds: [], resourceIds: ['r-eq', 'r-cost'],
  time: plainTime('2026-07-13', '2026-07-17', 5),
};
const tasks: Task[] = [TP, TM, TX, TY];

const sequences: Sequence[] = [
  { id: 's1', predecessorId: 't-x', successorId: 't-m', type: 'FINISH_START', lagDays: 2, lagUnit: 'ELAPSEDTIME', p6StartAtPredecessorFinishBoundary: true },
  { id: 's2', predecessorId: 't-x', successorId: 't-y', type: 'START_START', lagDays: 0, lagPercent: 50 },
  { id: 's3', predecessorId: 't-y', successorId: 't-m', type: 'FINISH_FINISH', lagDays: 1 },
  { id: 's4', predecessorId: 't-x', successorId: 't-m', type: 'START_FINISH', lagDays: 0 },
];
const _SEQUENCE_FIELD_WITNESS = {
  id: 'w', predecessorId: 'a', successorId: 'b', type: 'FINISH_START',
  lagDays: 1, lagMinutes: 60, lagUnit: 'WORKTIME', lagPercent: 25,
  p6StartAtPredecessorFinishBoundary: false,
} satisfies Required<Sequence>;
void _SEQUENCE_FIELD_WITNESS;

const RCrew: Resource = { id: 'r-crew', name: 'Ploeg Alpha', type: 'CREW', description: 'Hoofdploeg', maxUnits: 1 };
export const RMember = {
  id: 'r-mem', name: 'Timmerman Jan', type: 'LABOR', description: 'Ervaren timmerman',
  costPerHour: 42.5, availability: 0.9,
  maxUnits: 3, calendarId: 'libcal',
  availabilitySteps: [{ from: '2026-07-06', maxUnits: 3 }, { from: '2026-07-20', maxUnits: 2 }],
  unitOfMeasure: 'uur', parentId: 'r-crew', color: '#0EA5E9',
  libraryOrigin: { companyId: 'c-fixture', libraryItemId: 'lib-res1', poolVersion: 4 },
} satisfies Required<Resource>;
const REquip: Resource = { id: 'r-eq', name: 'Torenkraan', type: 'EQUIPMENT', description: 'Liebherr 200', maxUnits: 2 };
const RMat: Resource = { id: 'r-mat', name: 'Beton C30', type: 'MATERIAL', description: 'Stortbeton', maxUnits: 1, unitOfMeasure: 'm3' };
const RSub: Resource = { id: 'r-sub', name: 'Installateur BV', type: 'SUBCONTRACTOR', description: 'Onderaannemer', maxUnits: 1 };
const RCost: Resource = { id: 'r-cost', name: 'Leges vergunning', type: 'COST', description: 'Vast bedrag', maxUnits: 1 };
const RCrewBeta: Resource = { ...RCrew, id: 'r-beta', name: 'Ploeg Beta' };
const RCrewEmpty: Resource = { ...RCrew, id: 'r-empty', name: 'Lege ploeg' };
const resources: Resource[] = [
  { ...RMember, id: 'r-beta-lid', name: 'Lid Beta', parentId: RCrewBeta.id }, RCrewBeta,
  RMember, RCrewEmpty, RCrew, REquip, RMat, RSub, RCost,
  { ...RMember, id: 'r-alpha-tweede', name: 'Tweede lid Alpha' },
];
export const COST_RESOURCE_NAMES = new Set([RCost.name]);

const A1 = {
  id: 'a1', taskId: 't-x', resourceId: 'r-mem', unitsPerDay: 2, curve: 'BELL',
  plannedUnitsPerDay: 1.111,
  workWindowStart: '2026-07-06', workWindowFinish: '2026-07-08',
  curveValues: [0, 1.3, 2.5, 3.8, 5.1, 7.6, 10.1, 7.6, 5.1, 3.8, 2.5, 2.5, 2.5, 3.8, 5.1, 7.6, 10.1, 7.6, 5.1, 3.8, 2.5],
  plannedWorkMinutes: 9600, actualWorkMinutes: 4800, remainingWorkMinutes: 7200,
  costAmount: 99,
} satisfies Required<ResourceAssignment>;
const assignments: ResourceAssignment[] = [
  A1,
  { id: 'a2', taskId: 't-x', resourceId: 'r-mem', unitsPerDay: 1, curve: 'LATE_PEAK' },
  { id: 'a3', taskId: 't-y', resourceId: 'r-eq', unitsPerDay: 1 },
  { id: 'a4', taskId: 't-x', resourceId: 'r-cost', unitsPerDay: 1, costAmount: 1250.55 },
  { id: 'a5', taskId: 't-m', resourceId: 'r-cost', unitsPerDay: 1, costAmount: 0 },
  { id: 'a6', taskId: 't-y', resourceId: 'r-cost', unitsPerDay: 1 },
];

const SCHED_OPTS = {
  lagCalendar: 'successor',
  criticalDefinition: { mode: 'longestPath', threshold: -1, thresholdHours: -8 },
  totalFloatMode: 'finish',
  makeOpenEndedCritical: true,
  useExpectedFinishDates: false,
  p6CompletedLateFromRemainingWindow: true,
  useProjectEndDateForFloat: true,
  nearCriticalThreshold: 3,
  floatPaths: { enabled: true, method: 'TOTAL_FLOAT', maxPaths: 5 },
  startToStartLagFrom: 'actualStart',
  leveling: {
    preserveScheduledDates: false, levelAllResources: false,
    priority: [{ field: 'priority_type', direction: 'DESC' }, { field: 'task_code', direction: 'ASC' }],
    resources: [{ resourceId: 'r-mem', maxUnitsPerHour: 1 }, { resourceId: 'r-eq' }, { resourceId: 'r-verwijderd', maxUnitsPerHour: 0.5 }],
  },
} satisfies Required<ProjectSchedulingOptions>;
const project = {
  id: 'proj-1', name: 'Nieuwbouw Testtoren', description: 'Beschrijving X',
  startDate: '2026-06-15', endDate: '2026-09-30', calendarId: 'projcal',
  createdAt: '2026-01-01T00:00:00.000Z', modifiedAt: '2026-06-01T00:00:00.000Z',
  author: 'Ir. Testz', company: 'Bouw BV',
  wbsAutoNumber: true, statusDate: '2026-07-25', progressMode: 'PROGRESS_OVERRIDE',
  defaultTaskDurationUnit: 'days',
  defaultWorkRule: 'FIXED_RATE',
  companyId: 'c-fixture', companyName: 'Fixture Bouw BV',
  p6ProjectCode: 'OZB-14 1st Update',
  dependentProjectsFolder: '/projecten/Zuidas \\ fase \'2\'',
  anchorsFromOpenDocuments: true,
  schedulingOptions: SCHED_OPTS,
  schedulingProfile: {
    baseId: 'p6', id: 'prof-fixture', name: 'Fixtureprofiel',
    overrides: { clampNegativeFreeFloat: false, p6UseRemainingStartForProgress: true },
  },
  ifcSchema: 'IFC4',
  ifcSchemaUnconfirmed: 'IFC4',
} satisfies Required<Project> & { schedulingOptions: Required<ProjectSchedulingOptions> };

const baselines = [{
  id: 'bl-1', name: 'Nulmeting', createdAt: '2026-07-01T09:00:00.000Z',
  tasks: [
    { taskId: 't-m', start: '2026-07-24', finish: '2026-07-24', duration: 0, isMilestone: true, milestoneKind: 'FINISH' },
    { taskId: 't-x', start: '2026-07-06', finish: '2026-07-10', duration: 5, isMilestone: false, milestoneKind: 'START' },
  ],
  projectEnd: '2026-07-24', projectDuration: 14,
}] satisfies Baseline[];

export const fixture: ImportResult = {
  project, calendar: projCal, tasks, sequences, resources, assignments,
  resourceCalendars: [projCal, libCal, hourCal],
  activityCodeTypes, customFieldDefs, baselines, activeBaselineId: 'bl-1',
  importPristine: true,
  recordedSourceFormat: 'mspdi',
};

