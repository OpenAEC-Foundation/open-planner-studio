import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { SchedulingOptions } from '@/types/project';
import { isDefaultProfile } from '@/engine/scheduler/conventions/registry';
import { legacyOptionsToProfile } from '@/services/ifc/schedulingProfileMigration';
import type { ResourceType, ResourceCurve } from '@/types/resource';
import type { LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDuration } from '@/utils/durationFormat';
import type { WorkTimeBands, WorkingException } from '@/types/calendar';
import { computeVariance } from '@/engine/variance';
import {
  computeViewRows, isTreeMode, encodeBandKey, firstRowIndexByTask, NONE_RAWKEY,
  type ViewRow, type ViewContext,
} from '@/engine/view/visibleRows';
import type { FieldRef, FilterNode, GroupLevel, SortLevel } from '@/types/view';
import { scaleFromZoom, TIMESCALE_ZOOM } from '@/engine/renderer/timelineTiers';
import type { CustomFieldType } from '@/types/structure';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateId } from '@/utils/id';
import { isAncestorRelation, relationCycle } from '@/state/relationRules';
import { writeFileSync } from 'node:fs';
import { capturePayload } from '@/state/documentContract';
import {
  migrateToMinuteModel, normalizeTaskDate, taskDateContext, taskDateFieldSide, DayClockCache,
  MINUTE_MODEL_TIME_MODEL, type TaskDateContext, type TaskDateField,
} from '@/state/migrations/minuteModel';
import { dayStartInstant, isDateOnly, workdayOfInstant } from '@/engine/calendar/workdayRules';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { isElapsedTask, isPinnedComplete } from '@/engine/scheduler/duration';
import { isSummaryTask } from '@/utils/taskHierarchy';
import type { WorkCalendar } from '@/types/calendar';

const S = () => useAppStore.getState();
const CLEAN_WORKDAYS = [1, 2, 3, 4, 5];

const MM_RUN_ENV = process.env.OPS_MINUTE_MODEL_RUN;
const MM_RUN: 0 | 1 | 2 = MM_RUN_ENV === '1' ? 1 : MM_RUN_ENV === '2' ? 2 : 0;
if (MM_RUN_ENV !== undefined && MM_RUN_ENV !== '' && MM_RUN === 0) {
  console.log(`XX OPS_MINUTE_MODEL_RUN="${MM_RUN_ENV}": verwacht 1 of 2`);
  process.exit(1);
}
const MM_HOURS = MM_RUN === 2;
const MM_LABEL = MM_RUN === 1 ? 'run 1 (dagenmaat)' : 'run 2 (urenmaat)';
const MM_DEBUG = process.env.OPS_MINUTE_MODEL_DEBUG === '1';
const MM_DATETIME_RE = /\d{4}-\d\d-\d\dT\d\d:\d\d/;

function hourCaseReason(c: Case): string | null {
  const { minuteModel: _mm, expect: _expect, previewExpect: _preview, title: _title, note: _note, ...rest } = c;
  void _mm; void _expect; void _preview; void _title; void _note;
  const s = JSON.stringify(rest);
  if (s.includes('"workTime"')) return 'workTime';
  if (MM_DATETIME_RE.test(s)) return 'datetime';
  if (s.includes('"lagMinutes"')) return 'lagMinutes';
  if (s.includes('"remainingMinutes"')) return 'remainingMinutes';
  if (s.includes('"levelingDelayMinutes"')) return 'levelingDelayMinutes';
  for (const t of c.tasks ?? []) {
    if (typeof t.dur === 'string' && !/^\d+d$/i.test(t.dur.trim())) return `dur "${t.dur}"`;
  }
  for (const l of c.links ?? []) if (typeof l.lag === 'string') return `lag "${l.lag}"`;
  return null;
}

function minuteModelHoursProfile(): void {
  const profile = S().project.schedulingProfile;
  S().setProject({
    schedulingProfile: {
      baseId: profile?.baseId ?? 'ops',
      id: 'minutenmodel-run-2',
      name: 'run 2 (urenmaat)',
      overrides: { ...(profile?.overrides ?? {}), workdayDurationMeasure: false },
    },
  });
}

function minuteModelLoad(): void {
  const { payload } = migrateToMinuteModel(capturePayload(S()));
  const projectClock = new DayClockCache(payload.calendar, payload.calendars).calendarClock(undefined);
  const project = S().project;
  const startDate = dayStartInstant(projectClock, project.startDate) ?? project.startDate;
  const withBlocks = (cal: WorkCalendar): WorkCalendar => calendarForEngine(cal);
  useAppStore.setState((s) => {
    s.tasks = payload.tasks as typeof s.tasks;
    s.baselines = payload.baselines as typeof s.baselines;
    s.calendar = withBlocks(payload.calendar) as typeof s.calendar;
    s.calendars = payload.calendars.map(withBlocks) as typeof s.calendars;
    s.project.startDate = startDate;
  });
}

function minuteModelNormalizeInput(): void {
  const { payload } = migrateToMinuteModel(capturePayload(S()), { timeModel: MINUTE_MODEL_TIME_MODEL });
  useAppStore.setState((s) => {
    s.tasks = payload.tasks as typeof s.tasks;
    s.baselines = payload.baselines as typeof s.baselines;
  });
}

type Shift = 'FIRST' | 'SECOND' | 'THIRD' | 'USERDEFINED';
type Cal = {
  workDays?: number[]; holidays?: { name: string; startDate: string; endDate: string }[];
  workTime?: WorkTimeBands; shift?: Shift;
  workingExceptions?: WorkingException[];
  hoursPerDay?: number;
};
interface CaseResource {
  name: string; type?: ResourceType; maxUnits?: number;
  calendar?: Cal; steps?: { from: string; maxUnits: number }[];
  parent?: string;
}
type VarOp =
  | { setDuration: { task: string; dur: number } }
  | { deleteTask: { task: string } }
  | { addTask: { name: string; dur?: number; start?: string; milestone?: boolean;
      links?: { pred: string; succ: string; type: string; lag?: number }[] } };

type FieldRefSpec =
  | string
  | { code: string }
  | { field: string };
type FilterSpec =
  | { op: 'AND' | 'OR'; children: FilterSpec[] }
  | { field: FieldRefSpec; operator: string; value?: unknown; value2?: unknown };
interface GroupSpec { field: FieldRefSpec; dir?: 'asc' | 'desc'; }
interface ViewCaseSpec {
  filter?: FilterSpec | null;
  group?: GroupSpec[];
  sort?: GroupSpec[];
  collapsedTasks?: string[];
  collapsedGroups?: (string | number | boolean)[][];
  expectRows?: ExpectRow[];
  expectTreeMode?: boolean;
  expectFirstIndex?: Record<string, number>;
  timescaleRoundtrip?: boolean;
}
type ExpectRow =
  | { t: string; dim?: boolean; depth?: number }
  | { g: string; count?: number; collapsed?: boolean; level?: number };

interface Case {
  id: string; title: string;
  calendar?: Cal; anchor?: string;
  calendars?: { name: string; workDays?: number[]; holidays?: Cal['holidays']; workTime?: WorkTimeBands; shift?: Shift; workingExceptions?: Cal['workingExceptions'] }[];
  resources?: CaseResource[];
  codes?: { name: string; values: { code: string; description?: string }[] }[];
  customFields?: { name: string; type: CustomFieldType }[];
  view?: ViewCaseSpec;
  sourceParity?: boolean;
  statusDate?: string;
  scheduleOptions?: { progressMode?: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE' };
  schedulingOptions?: SchedulingOptions;
  tasks: {
    name: string; dur?: number | string; start?: string; milestone?: boolean; milestoneKind?: 'START' | 'FINISH';
    mandatory?: boolean; parent?: string; deadline?: string;
    durationType?: 'WORKTIME' | 'ELAPSEDTIME';
    constraint?: { type: string; date?: string; hard?: boolean };
    constraint2?: { type: string; date?: string };
    hammock?: boolean;
    externalLinks?: {
      direction: 'predecessor' | 'successor'; relType: 'FS' | 'SS' | 'FF' | 'SF';
      lag?: number; lagMinutes?: number; anchorDate: string; sourceMissing?: boolean;
      sourceProject?: string; sourceTask?: string; sourceFile?: string;
    }[];
    priority?: number;
    durationMinutesRaw?: number;
    remainingMinutes?: number;
    calendar?: string;
    assign?: { res: string; units: number; curve?: ResourceCurve }[];
    completion?: number; actualStart?: string; actualFinish?: string; rawCompletion?: number;
    resume?: string; stop?: string;
    code?: Record<string, string>;
    field?: Record<string, string | number | boolean>;
    splitGaps?: { afterMinutes: number; gapMinutes: number }[];
    manuallyScheduled?: boolean;
    levelingDelayMinutes?: number;
    levelingDelayElapsed?: boolean;
    timephasedStartAnchor?: string;
    timephasedFinishFloor?: string;
  }[];
  links?: { pred: string; succ: string; type: string; lag?: number | string; lagMinutes?: number; lagUnit?: string; lagPercent?: number }[];
  level?: { constrainToFloat?: boolean; resources?: string[] };
  baseline?: boolean | { name?: string };
  varianceMutations?: VarOp[];
  levelPreview?: { constrainToFloat?: boolean; resources?: string[] };
  afterCPM?: AfterOp[];
  previewExpect?: {
    constrainToFloat?: boolean; resources?: string[];
    projectEndAfter?: string;
    shiftedTasks?: string[];
    unresolvedTasks?: string[];
    reasons?: Record<string, string>;
  };
  note?: string;
  expect?: CaseExpect;
  minuteModel?: MinuteModelCase;
}

interface MinuteModelCase {
  reason: ReasonCode;
  expect?: CaseExpect;
  note?: string;
}

interface TaskExpect {
  es?: string; ef?: string; ls?: string; lf?: string;
  tf?: number; ff?: number; intf?: number;
  crit?: boolean; nearCrit?: boolean;
  floatPath?: number;
  scheduleDuration?: number; durationMinutes?: number;
  manuallyScheduled?: boolean;
  splitGapCount?: number;
  levelingDelayMinutes?: number;
  levelingDelayElapsed?: boolean;
}

interface CaseExpect {
  error?: boolean | string;
  tasks?: Record<string, TaskExpect>;
  criticalPathSet?: string[];
  nearCriticalSet?: string[];
  hammockNoFinishDriversSet?: string[];
  violatedConstraintsSet?: string[];
  missedDeadlinesSet?: string[];
  drivingSet?: string[][];
  truncatedLeadSet?: string[][];
  outOfSequenceSet?: string[][];
  floatPaths?: Record<string, number>;
  criticalPaths?: string[][];
  projectEnd?: string;
  projectDuration?: number;
  projectStartDate?: string;
  baselineTasks?: Record<string, { start?: string; finish?: string; duration?: number }>;
  scheduleStale?: boolean;
  calendarInvariant?: boolean;
  load?: Record<string, Record<string, number>>;
  overallocatedDays?: Record<string, string[]>;
  variance?: {
    rows?: Record<string, Record<string, unknown>>;
    projectEndDelta?: number;
  };
}

type AfterOp =
  | { setDuration: { task: string; dur: number } }
  | { assign: { task: string; res: string; units: number; curve?: ResourceCurve } }
  | { runCPM: true }
  | { undo: true }
  | { applyLevel: { constrainToFloat?: boolean; resources?: string[] } }
  | { setLevelingDelay: { task: string; days: number } }
  | { addCalendarAsDefault: { name: string } }
  | { moveProject: { newStart: string; shiftBaselines?: boolean } };

function resolveResourceIds(names: string[] | undefined, resIds: Record<string, string>, ctx: string): string[] | undefined {
  return names
    ? names.map(n => {
        if (!resIds[n]) throw new Error(`${ctx}: onbekende resource "${n}"`);
        return resIds[n];
      })
    : undefined;
}

function buildAndSolve(c: Case): {
  ids: Record<string, string>;
  resIds: Record<string, string>;
  codeTypeIds: Record<string, string>;
  codeValueIds: Record<string, Record<string, string>>;
  fieldDefIds: Record<string, string>;
  previewResult: LevelingResult | null;
} {
  S().newProject();
  const base = S().calendar;
  S().setCalendar({
    ...base,
    workDays: c.calendar?.workDays ?? CLEAN_WORKDAYS,
    holidays: c.calendar?.holidays ?? [],
    ...(c.calendar?.workTime ? { workTime: c.calendar.workTime } : {}),
    ...(c.calendar?.shift ? { shift: c.calendar.shift } : {}),
    ...(c.calendar?.workingExceptions ? { workingExceptions: c.calendar.workingExceptions } : {}),
    ...(c.calendar?.hoursPerDay != null ? { hoursPerDay: c.calendar.hoursPerDay } : {}),
  } as any);
  const anchor = c.anchor ?? '2026-06-01';
  S().setProject({ startDate: anchor });

  const calByName: Record<string, string> = {};
  for (const cal of c.calendars ?? []) {
    if (calByName[cal.name]) throw new Error(`dubbele kalendernaam "${cal.name}"`);
    const { id: _cid, ...calBase } = S().calendar;
    void _cid;
    calByName[cal.name] = S().addCalendar({
      ...calBase,
      name: cal.name,
      workDays: cal.workDays ?? CLEAN_WORKDAYS,
      holidays: cal.holidays ?? [],
      ...(cal.workTime ? { workTime: cal.workTime } : {}),
      ...(cal.shift ? { shift: cal.shift } : {}),
      ...(cal.workingExceptions ? { workingExceptions: cal.workingExceptions } : {}),
    });
  }

  const effHoursPerDayFor = (calName: string | undefined): number => {
    const wc = calName ? S().calendars.find((x) => x.id === calByName[calName]) : S().calendar;
    return new CalendarEngine((wc ?? S().calendar) as any).hoursPerDay;
  };

  const resIds: Record<string, string> = {};
  for (const r of c.resources ?? []) {
    if (resIds[r.name]) throw new Error(`dubbele resourcenaam "${r.name}"`);
    if (r.parent && !resIds[r.parent]) {
      throw new Error(`resource "${r.name}": parent "${r.parent}" nog niet gedefinieerd — zet die eerder in de resources-lijst`);
    }
    let calendarId: string | undefined;
    if (r.calendar) {
      const { id: _calBaseId, ...calBase } = S().calendar;
      void _calBaseId;
      calendarId = S().addCalendar({
        ...calBase,
        name: `${r.name} kalender`,
        workDays: r.calendar.workDays ?? CLEAN_WORKDAYS,
        holidays: r.calendar.holidays ?? [],
      });
    }
    const resId = S().addResource({
      name: r.name,
      type: r.type ?? 'LABOR',
      description: '',
      maxUnits: r.maxUnits ?? 1,
      ...(calendarId ? { calendarId } : {}),
      ...(r.steps ? { availabilitySteps: r.steps } : {}),
      ...(r.parent ? { parentId: resIds[r.parent] } : {}),
    });
    resIds[r.name] = resId;
  }

  const codeTypeIds: Record<string, string> = {};
  const codeValueIds: Record<string, Record<string, string>> = {};
  for (const ct of c.codes ?? []) {
    if (codeTypeIds[ct.name]) throw new Error(`dubbel codetype "${ct.name}"`);
    const typeId = S().addActivityCodeType(ct.name);
    codeTypeIds[ct.name] = typeId;
    codeValueIds[ct.name] = {};
    for (const v of ct.values) {
      codeValueIds[ct.name][v.code] = S().addActivityCodeValue(typeId, { code: v.code, description: v.description });
    }
  }
  const fieldDefIds: Record<string, string> = {};
  for (const f of c.customFields ?? []) {
    if (fieldDefIds[f.name]) throw new Error(`dubbel custom field "${f.name}"`);
    fieldDefIds[f.name] = S().addCustomField(f.name, f.type);
  }

  const ids: Record<string, string> = {};
  for (const t of c.tasks) {
    if (ids[t.name]) throw new Error(`dubbele taaknaam "${t.name}"`);
    if (t.parent && !ids[t.parent]) {
      throw new Error(`taak "${t.name}": ouder "${t.parent}" nog niet gedefinieerd — zet de ouder eerder in de tasks-lijst`);
    }
    const start = t.start ?? anchor;
    let durDays: number;
    let durMinutes: number | undefined;
    if (t.milestone && t.dur === undefined) {
      durDays = 0;
    } else if (typeof t.dur === 'string' && /^\d+d$/i.test(t.dur.trim())) {
      durDays = Number.parseInt(t.dur, 10);
    } else if (typeof t.dur === 'string') {
      const effHpd = effHoursPerDayFor(t.calendar);
      const mins = parseDuration(t.dur, effHpd);
      if (mins == null) throw new Error(`taak "${t.name}": onparseerbare duur "${t.dur}"`);
      durMinutes = mins;
      durDays = mins / (effHpd * 60);
    } else {
      durDays = t.dur ?? 1;
    }
    const time = createDefaultTaskTime(start, durDays, durMinutes !== undefined ? 'hours' : 'days');
    if (durMinutes !== undefined) time.durationMinutes = durMinutes;
    if (t.durationMinutesRaw !== undefined) time.durationMinutes = t.durationMinutesRaw;
    if (t.durationType !== undefined) time.durationType = t.durationType;
    const id = S().addTask({
      name: t.name,
      isMilestone: !!t.milestone,
      parentId: t.parent ? ids[t.parent] : null,
      time,
      ...(t.milestoneKind ? { milestoneKind: t.milestoneKind } : {}),
      ...(t.priority !== undefined ? { priority: t.priority } : {}),
      ...(t.mandatory !== undefined ? { mandatory: t.mandatory } : {}),
      ...(t.constraint ? { constraint: t.constraint as any } : {}),
      ...(t.constraint2 ? { constraint2: t.constraint2 as any } : {}),
      ...(t.hammock ? { isHammock: true } : {}),
      ...(t.externalLinks ? {
        externalLinks: t.externalLinks.map((e, i) => ({
          id: `${t.name}-ext-${i}`,
          direction: e.direction,
          relType: e.relType,
          ...(e.lag !== undefined ? { lagDays: e.lag } : {}),
          ...(e.lagMinutes !== undefined ? { lagMinutes: e.lagMinutes } : {}),
          anchorDate: e.anchorDate,
          sourceRef: {
            projectId: e.sourceProject ?? 'ext-project',
            taskId: e.sourceTask ?? 'ext-task',
            ...(e.sourceFile !== undefined ? { filePath: e.sourceFile } : {}),
          },
          sourceMissing: e.sourceMissing ?? false,
        })),
      } : {}),
      ...(t.deadline ? { deadline: t.deadline } : {}),
      ...(t.splitGaps ? { splitGaps: t.splitGaps } : {}),
      ...(t.manuallyScheduled !== undefined ? { manuallyScheduled: t.manuallyScheduled } : {}),
      ...(t.levelingDelayMinutes !== undefined ? { levelingDelayMinutes: t.levelingDelayMinutes } : {}),
      ...(t.levelingDelayElapsed !== undefined ? { levelingDelayElapsed: t.levelingDelayElapsed } : {}),
    });
    ids[t.name] = id;
    if (t.calendar !== undefined) {
      const calId = calByName[t.calendar];
      if (!calId) throw new Error(`taak "${t.name}": onbekende kalender "${t.calendar}" (niet in Case.calendars)`);
      S().setTaskCalendar(id, calId);
    }
  }
  for (const l of c.links ?? []) {
    if (!ids[l.pred]) throw new Error(`relatie: onbekende voorganger "${l.pred}"`);
    if (!ids[l.succ]) throw new Error(`relatie: onbekende opvolger "${l.succ}"`);
    let lagMinutes = l.lagMinutes;
    const lagDaysVal = typeof l.lag === 'number' ? l.lag : undefined;
    if (typeof l.lag === 'string') {
      const predCalName = c.tasks.find((t) => t.name === l.pred)?.calendar;
      const predHpd = effHoursPerDayFor(predCalName);
      const mins = parseDuration(l.lag, predHpd);
      if (mins == null) throw new Error(`relatie ${l.pred}->${l.succ}: onparseerbare lag "${l.lag}"`);
      lagMinutes = mins;
    }
    const seqInput = {
      predecessorId: ids[l.pred], successorId: ids[l.succ], type: l.type as any,
      lagDays: lagDaysVal ?? 0,
      ...(lagMinutes !== undefined ? { lagMinutes } : {}),
      ...(l.lagUnit !== undefined ? { lagUnit: l.lagUnit as any } : {}),
      ...(l.lagPercent !== undefined ? { lagPercent: l.lagPercent } : {}),
    };
    const lookup = (id: string) => S().tasks.find((t) => t.id === id);
    if (
      seqInput.predecessorId === seqInput.successorId
      || isAncestorRelation(lookup, { predecessorId: seqInput.predecessorId, successorId: seqInput.successorId })
      || relationCycle(S().tasks, S().sequences, seqInput) !== null
    ) {
      useAppStore.setState((s) => {
        s.sequences.push({ ...seqInput, id: generateId('seq') });
      });
    } else if (S().addSequence(seqInput) === null) {
      throw new Error(`relatie ${l.pred}->${l.succ} geweigerd door de relatieregels`);
    }
  }
  for (const t of c.tasks) {
    for (const a of t.assign ?? []) {
      if (!resIds[a.res]) throw new Error(`taak "${t.name}": onbekende resource "${a.res}"`);
      S().assignResource(ids[t.name], resIds[a.res], a.units, a.curve);
    }
    for (const [typeName, code] of Object.entries(t.code ?? {})) {
      const typeId = codeTypeIds[typeName];
      if (!typeId) throw new Error(`taak "${t.name}": onbekend codetype "${typeName}"`);
      const valueId = codeValueIds[typeName]?.[code];
      if (!valueId) throw new Error(`taak "${t.name}": onbekende codewaarde "${code}" van "${typeName}"`);
      S().setTaskActivityCode(ids[t.name], typeId, valueId);
    }
    for (const [fieldName, value] of Object.entries(t.field ?? {})) {
      const defId = fieldDefIds[fieldName];
      if (!defId) throw new Error(`taak "${t.name}": onbekend custom field "${fieldName}"`);
      S().setTaskCustomField(ids[t.name], defId, value);
    }
  }

  if (c.statusDate) S().setStatusDate(c.statusDate);
  if (c.scheduleOptions?.progressMode) S().setProgressMode(c.scheduleOptions.progressMode);
  if (c.schedulingOptions) {
    const migrated = legacyOptionsToProfile(c.schedulingOptions);
    S().setProject({
      schedulingOptions: migrated.options,
      schedulingProfile: isDefaultProfile(migrated.profile) ? undefined : migrated.profile,
    });
  }
  for (const t of c.tasks) {
    const id = ids[t.name];
    if (t.rawCompletion !== undefined) {
      const task = S().tasks.find((x) => x.id === id)!;
      S().updateTask(id, { time: { ...task.time, completion: t.rawCompletion } });
    }
    if (t.actualStart !== undefined) S().setActualStart(id, t.actualStart);
    if (t.actualFinish !== undefined) S().setActualFinish(id, t.actualFinish);
    if (t.completion !== undefined) S().setTaskProgress(id, t.completion);
    if (t.remainingMinutes !== undefined) {
      const task = S().tasks.find((x) => x.id === id)!;
      S().updateTask(id, { time: { ...task.time, remainingMinutes: t.remainingMinutes } });
    }
    if (t.resume !== undefined) {
      const task = S().tasks.find((x) => x.id === id)!;
      S().updateTask(id, { time: { ...task.time, resume: t.resume } });
    }
    if (t.stop !== undefined) {
      const task = S().tasks.find((x) => x.id === id)!;
      S().updateTask(id, { time: { ...task.time, stop: t.stop } });
    }
    if (t.timephasedStartAnchor !== undefined) {
      S().updateTask(id, { timephasedStartAnchor: t.timephasedStartAnchor });
    }
    if (t.timephasedFinishFloor !== undefined) {
      S().updateTask(id, { timephasedFinishFloor: t.timephasedFinishFloor });
    }
  }

  if (MM_RUN) minuteModelLoad();
  if (MM_HOURS) minuteModelHoursProfile();

  S().runCPM();

  if (c.baseline) {
    S().saveBaseline(typeof c.baseline === 'object' ? (c.baseline.name ?? 'Baseline 1') : 'Baseline 1');
    for (const m of c.varianceMutations ?? []) {
      if ('setDuration' in m) {
        const tid = ids[m.setDuration.task];
        if (!tid) throw new Error(`varianceMutations.setDuration: onbekende taak "${m.setDuration.task}"`);
        const task = S().tasks.find((t) => t.id === tid)!;
        S().updateTask(tid, { time: { ...task.time, scheduleDuration: m.setDuration.dur } });
      } else if ('deleteTask' in m) {
        const tid = ids[m.deleteTask.task];
        if (!tid) throw new Error(`varianceMutations.deleteTask: onbekende taak "${m.deleteTask.task}"`);
        S().deleteTask(tid);
      } else if ('addTask' in m) {
        const a = m.addTask;
        if (ids[a.name]) throw new Error(`varianceMutations.addTask: dubbele taaknaam "${a.name}"`);
        const start = a.start ?? (c.anchor ?? '2026-06-01');
        const dur = a.milestone ? 0 : (a.dur ?? 1);
        const nid = S().addTask({
          name: a.name, isMilestone: !!a.milestone, parentId: null,
          time: createDefaultTaskTime(start, dur),
        });
        ids[a.name] = nid;
        for (const l of a.links ?? []) {
          if (!ids[l.pred]) throw new Error(`varianceMutations.addTask.links: onbekende voorganger "${l.pred}"`);
          if (!ids[l.succ]) throw new Error(`varianceMutations.addTask.links: onbekende opvolger "${l.succ}"`);
          S().addSequence({
            predecessorId: ids[l.pred], successorId: ids[l.succ], type: l.type as any, lagDays: l.lag ?? 0,
          });
        }
      }
    }
    if (MM_RUN) minuteModelNormalizeInput();
    S().runCPM();
  }

  if (c.level) {
    const resourceIds = c.level.resources
      ? c.level.resources.map(n => {
          if (!resIds[n]) throw new Error(`level.resources: onbekende resource "${n}"`);
          return resIds[n];
        })
      : undefined;
    const result = S().levelResources({
      constrainToFloat: !!c.level.constrainToFloat,
      ...(resourceIds ? { resourceIds } : {}),
    });
    S().applyLeveling(result);
  }

  if (c.levelPreview) {
    const resourceIds = resolveResourceIds(c.levelPreview.resources, resIds, 'levelPreview.resources');
    S().levelResources({
      constrainToFloat: !!c.levelPreview.constrainToFloat,
      ...(resourceIds ? { resourceIds } : {}),
    });
    S().runCPM();
  }

  for (const op of c.afterCPM ?? []) {
    if ('setDuration' in op) {
      const tid = ids[op.setDuration.task];
      if (!tid) throw new Error(`afterCPM.setDuration: onbekende taak "${op.setDuration.task}"`);
      const task = S().tasks.find(t => t.id === tid)!;
      S().updateTask(tid, { time: { ...task.time, scheduleDuration: op.setDuration.dur } });
    } else if ('assign' in op) {
      const tid = ids[op.assign.task];
      if (!tid) throw new Error(`afterCPM.assign: onbekende taak "${op.assign.task}"`);
      if (!resIds[op.assign.res]) throw new Error(`afterCPM.assign: onbekende resource "${op.assign.res}"`);
      S().assignResource(tid, resIds[op.assign.res], op.assign.units, op.assign.curve);
    } else if ('runCPM' in op) {
      S().runCPM();
    } else if ('undo' in op) {
      S().undo();
    } else if ('applyLevel' in op) {
      const resourceIds = resolveResourceIds(op.applyLevel.resources, resIds, 'afterCPM.applyLevel.resources');
      const r = S().levelResources({
        constrainToFloat: !!op.applyLevel.constrainToFloat,
        ...(resourceIds ? { resourceIds } : {}),
      });
      S().applyLeveling(r);
    } else if ('moveProject' in op) {
      const newStart = MM_RUN
        ? (dayStartInstant(new DayClockCache(S().calendar, S().calendars).calendarClock(undefined), op.moveProject.newStart)
          ?? op.moveProject.newStart)
        : op.moveProject.newStart;
      S().moveProject(newStart, { shiftBaselines: !!op.moveProject.shiftBaselines });
    } else if ('addCalendarAsDefault' in op) {
      const { id: _cid, ...calBase } = S().calendar;
      void _cid;
      const newId = S().addCalendar({ ...calBase, name: op.addCalendarAsDefault.name });
      S().setProjectCalendar(newId);
    } else if ('setLevelingDelay' in op) {
      const tid = ids[op.setLevelingDelay.task];
      if (!tid) throw new Error(`afterCPM.setLevelingDelay: onbekende taak "${op.setLevelingDelay.task}"`);
      S().updateTask(tid, { levelingDelay: op.setLevelingDelay.days });
    }
  }

  let previewResult: LevelingResult | null = null;
  if (c.previewExpect) {
    const resourceIds = resolveResourceIds(c.previewExpect.resources, resIds, 'previewExpect.resources');
    previewResult = S().levelResources({
      constrainToFloat: !!c.previewExpect.constrainToFloat,
      ...(resourceIds ? { resourceIds } : {}),
    });
  }

  return { ids, resIds, codeTypeIds, codeValueIds, fieldDefIds, previewResult };
}

const BUILTIN_KEYS = new Set([
  'name', 'wbsCode', 'duration', 'start', 'finish',
  'totalFloat', 'isCritical', 'completion', 'taskType', 'isMilestone',
]);

interface ViewMaps {
  ids: Record<string, string>;
  codeTypeIds: Record<string, string>;
  codeValueIds: Record<string, Record<string, string>>;
  fieldDefIds: Record<string, string>;
}

function toFieldRef(spec: FieldRefSpec, m: ViewMaps): FieldRef {
  if (typeof spec === 'string') {
    if (spec === 'resource') return { src: 'resource' };
    if (BUILTIN_KEYS.has(spec)) return { src: 'builtin', key: spec as any };
    throw new Error(`onbekende builtin-veldsleutel "${spec}"`);
  }
  if ('code' in spec) return { src: 'activityCode', typeId: m.codeTypeIds[spec.code] ?? spec.code };
  return { src: 'customField', defId: m.fieldDefIds[spec.field] ?? spec.field };
}

function toFilterValue(spec: { field: FieldRefSpec; value?: unknown }, m: ViewMaps): unknown {
  const f = spec.field;
  if (typeof f === 'object' && 'code' in f) {
    const map = m.codeValueIds[f.code] ?? {};
    const tr = (v: unknown) => (typeof v === 'string' ? (map[v] ?? v) : v);
    return Array.isArray(spec.value) ? spec.value.map(tr) : tr(spec.value);
  }
  return spec.value;
}

function toFilterNode(spec: FilterSpec, m: ViewMaps): FilterNode {
  if ('op' in spec) {
    return { kind: 'group', op: spec.op, children: spec.children.map(c => toFilterNode(c, m)) };
  }
  return {
    kind: 'rule',
    field: toFieldRef(spec.field, m),
    operator: spec.operator as any,
    value: toFilterValue(spec, m) as any,
    ...(spec.value2 !== undefined ? { value2: spec.value2 as any } : {}),
  };
}

function toGroupLevels(specs: GroupSpec[] | undefined, m: ViewMaps): GroupLevel[] {
  return (specs ?? []).map(g => ({ field: toFieldRef(g.field, m), dir: g.dir ?? 'asc' }));
}
function toSortLevels(specs: GroupSpec[] | undefined, m: ViewMaps): SortLevel[] {
  return (specs ?? []).map(g => ({ field: toFieldRef(g.field, m), dir: g.dir ?? 'asc' }));
}

const NONE_LABEL = '(geen)';

function bandRawKey(fieldSpec: FieldRefSpec, human: string | number | boolean, m: ViewMaps): string {
  if (human === NONE_LABEL) return NONE_RAWKEY;
  if (typeof fieldSpec === 'object' && 'code' in fieldSpec) {
    return m.codeValueIds[fieldSpec.code]?.[String(human)] ?? String(human);
  }
  return String(human);
}

function readTask(name: string, ids: Record<string, string>) {
  const t = S().tasks.find(x => x.id === ids[name]);
  if (!t) return null;
  return {
    es: t.time.earlyStart, ef: t.time.earlyFinish,
    ls: t.time.lateStart, lf: t.time.lateFinish,
    tf: t.time.totalFloat, ff: t.time.freeFloat, crit: t.time.isCritical,
    intf: t.time.interferingFloat, nearCrit: t.time.isNearCritical, floatPath: t.time.floatPath,
    scheduleDuration: t.time.scheduleDuration, durationMinutes: t.time.durationMinutes,
    manuallyScheduled: t.manuallyScheduled,
    splitGapCount: t.splitGaps?.length ?? 0,
    levelingDelayMinutes: t.levelingDelayMinutes,
    levelingDelayElapsed: t.levelingDelayElapsed,
  };
}

const KEYMAP: Record<string, string> = {
  es: 'es', ef: 'ef', ls: 'ls', lf: 'lf', tf: 'tf', ff: 'ff', crit: 'crit',
  intf: 'intf', nearCrit: 'nearCrit', floatPath: 'floatPath',
};

function nameOf(tid: string, ids: Record<string, string>): string {
  for (const [n, i] of Object.entries(ids)) if (i === tid) return n;
  return tid;
}

function runSourceParity(): string[] {
  const diffs: string[] = [];
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const read = (p: string) => readFileSync(join(root, p), 'utf8');
  const sources: [string, string][] = [
    ['src/components/task-grid/FullTaskGrid.tsx', read('src/components/task-grid/FullTaskGrid.tsx')],
    ['src/components/canvas/GanttCanvas.tsx', read('src/components/canvas/GanttCanvas.tsx')],
    ['src/engine/renderer/GanttRenderer.ts', read('src/engine/renderer/GanttRenderer.ts')],
  ];
  for (const name of ['FullTaskGrid.tsx', 'GanttCanvas.tsx']) {
    const [, src] = sources.find(([p]) => p.endsWith(name))!;
    if (!/useAppStore\((?:s|state) => (?:s|state)\.viewRows\)/.test(src)) {
      diffs.push(`${name}: leest niet uit de gedeelde store-cache (useAppStore(... => ...viewRows))`);
    }
  }
  for (const [path, src] of sources) {
    for (const banned of ['groupTasksByCode', 'flattenTasks', 'flattenGrouped']) {
      if (src.includes(banned)) diffs.push(`${path}: bevat nog een eigen flatten-pad ("${banned}")`);
    }
  }
  return diffs;
}

type Built = ReturnType<typeof buildAndSolve>;

interface CaseResult {
  id: string; title: string; pass: boolean; diffs: string[];
  status?: MinuteStatus;
  rawRed?: boolean;
  reason?: ReasonCode;
  notes?: string[];
}

function runCase(c: Case): CaseResult {
  if (MM_RUN) return runMinuteCase(c);
  if (c.sourceParity) {
    const diffs = runSourceParity();
    return { id: c.id, title: c.title, pass: diffs.length === 0, diffs };
  }
  let built: Built;
  try {
    built = buildAndSolve(c);
  } catch (e) {
    return { id: c.id, title: c.title, pass: false, diffs: [`THREW: ${String(e)}`] };
  }
  const dayCase = !hourCaseReason(c);
  const expected = c.expect ?? {};
  const minute = minuteComparer(built.ids);
  const cmp: Comparer = dayCase ? minute : { ...EXACT,
    taskField: (name, key, got, want) => typeof want === 'string' && isDateOnly(want)
      ? minute.taskField(name, key, got, want) : EXACT.taskField(name, key, got, want),
    projectDate: (got, want, field) => typeof want === 'string' && isDateOnly(want)
      ? minute.projectDate(got, want, field) : EXACT.projectDate(got, want, field),
    taskDate: (name, got, want, field) => typeof want === 'string' && isDateOnly(want)
      ? minute.taskDate(name, got, want, field) : EXACT.taskDate(name, got, want, field),
  };
  const diffs = evaluateCase(c, expected, built, cmp);
  return { id: c.id, title: c.title, pass: diffs.length === 0, diffs };
}

function runMinuteCase(c: Case): CaseResult {
  const why = hourCaseReason(c);
  if (why) return { id: c.id, title: c.title, pass: true, diffs: [`urencase (${why})`], status: 'UREN' };
  if (c.sourceParity) {
    const diffs = runSourceParity();
    const pass = diffs.length === 0;
    return { id: c.id, title: c.title, pass, diffs, status: pass ? 'GELIJK' : 'ROOD', rawRed: !pass };
  }
  let built: Built;
  try {
    built = buildAndSolve(c);
  } catch (e) {
    return { id: c.id, title: c.title, pass: false, diffs: [`THREW: ${String(e)}`], status: 'ROOD', rawRed: true };
  }
  const cmp = minuteComparer(built.ids);
  const rawDiffs = evaluateCase(c, c.expect ?? {}, built, cmp);
  const reason = activeReason(c);
  const diffs = reason ? evaluateCase(c, mergeExpect(c.expect ?? {}, c.minuteModel!.expect ?? {}), built, cmp) : rawDiffs;
  const pass = diffs.length === 0;
  const status: MinuteStatus = reason
    ? (pass ? (rawDiffs.length === 0 ? 'GELIJK' : 'BEWUST') : 'BEWUST_ROOD')
    : (pass ? 'GELIJK' : 'ROOD');
  const notes = [...new Set(cmp.notes)];
  if (reason && rawDiffs.length === 0) {
    notes.push(pass
      ? `redencode ${reason} is in ${MM_LABEL} niet nodig: de oorspronkelijke verwachting klopt`
      : `${MM_LABEL} geeft nog de oorspronkelijke uitkomst; het doel van ${reason} is hier nog niet gehaald`);
  }
  if (MM_DEBUG && (!pass || rawDiffs.length > 0)) {
    for (const t of S().tasks) {
      const tt = t.time;
      notes.push(`debug ${t.name}: unit=${tt.durationUnit} type=${tt.durationType} es=${tt.earlyStart} ef=${tt.earlyFinish} `
        + `ls=${tt.lateStart} lf=${tt.lateFinish} tf=${tt.totalFloat} ff=${tt.freeFloat}`
        + `${tt.actualStart ? ` as=${tt.actualStart}` : ''}${tt.actualFinish ? ` af=${tt.actualFinish}` : ''}`
        + `${t.deadline ? ` dl=${t.deadline}` : ''}${t.constraint ? ` c=${t.constraint.type}@${t.constraint.date}` : ''}`);
    }
    notes.push(`debug project: start=${S().project.startDate} status=${S().project.statusDate ?? '-'} end=${S().cpmResult?.projectEnd}`);
  }
  return {
    id: c.id, title: c.title, pass, diffs, status, rawRed: rawDiffs.length > 0,
    ...(reason ? { reason } : {}), notes,
  };
}

function evaluateCase(c: Case, exp: CaseExpect, built: Built, cmp: Comparer): string[] {
  const { ids, resIds, codeTypeIds, codeValueIds, fieldDefIds, previewResult } = built;
  const diffs: string[] = [];
  const cpm = S().cpmResult;

  if (exp.error !== undefined) {
    const gotErr = cpm?.error ?? '';
    if (exp.error === true && !gotErr) diffs.push(`error: verwacht een fout, kreeg geen`);
    if (exp.error === false && gotErr) diffs.push(`error: verwacht geen fout, kreeg "${gotErr}"`);
    if (typeof exp.error === 'string' && !gotErr.includes(exp.error)) diffs.push(`error: verwacht substring "${exp.error}", kreeg "${gotErr}"`);
  }

  if (exp.tasks) {
    for (const [name, want] of Object.entries<any>(exp.tasks)) {
      const got = readTask(name, ids);
      if (!got) { diffs.push(`taak "${name}" niet gevonden`); continue; }
      for (const [k, wv] of Object.entries<any>(want)) {
        const gk = KEYMAP[k] ?? k;
        const gv = (got as any)[gk];
        if (!cmp.taskField(name, k, gv, wv)) diffs.push(`${name}.${k}: verwacht ${JSON.stringify(wv)}, kreeg ${JSON.stringify(gv)}`);
      }
    }
  }

  const seqSetCheck = (label: string, wantTriples: string[][] | undefined, gotIds: string[]) => {
    if (!wantTriples) return;
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const seqById = new Map(S().sequences.map(q => [q.id, q]));
    const got = gotIds
      .map((sid: string) => {
        const q = seqById.get(sid);
        return q ? `${idToName[q.predecessorId] ?? q.predecessorId}|${idToName[q.successorId] ?? q.successorId}|${q.type}` : '?';
      })
      .sort();
    const want = [...wantTriples].map((t: string[]) => t.join('|')).sort();
    if (JSON.stringify(got) !== JSON.stringify(want))
      diffs.push(`${label}: verwacht {${want.join(', ')}}, kreeg {${got.join(', ')}}`);
  };
  seqSetCheck('drivingSet', exp.drivingSet, (cpm as any)?.drivingSequenceIds ?? []);
  seqSetCheck('truncatedLeadSet', exp.truncatedLeadSet, (cpm as any)?.truncatedLeadSequenceIds ?? []);
  seqSetCheck('outOfSequenceSet', exp.outOfSequenceSet, (cpm as any)?.outOfSequenceSequenceIds ?? []);

  const taskSetCheck = (label: string, wantNames: string[] | undefined, gotIds: string[]) => {
    if (!wantNames) return;
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const got = gotIds.map(tid => idToName[tid] ?? tid).sort();
    const want = [...wantNames].sort();
    if (JSON.stringify(got) !== JSON.stringify(want))
      diffs.push(`${label}: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
  };
  taskSetCheck('violatedConstraintsSet', exp.violatedConstraintsSet, (cpm as any)?.violatedConstraintTaskIds ?? []);
  taskSetCheck('missedDeadlinesSet', exp.missedDeadlinesSet, (cpm as any)?.missedDeadlineTaskIds ?? []);
  taskSetCheck('nearCriticalSet', exp.nearCriticalSet, (cpm as any)?.nearCriticalTaskIds ?? []);
  taskSetCheck('hammockNoFinishDriversSet', exp.hammockNoFinishDriversSet, (cpm as any)?.hammockNoFinishDriverTaskIds ?? []);

  if (exp.criticalPathSet) {
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const gotNames = (cpm?.criticalPath ?? []).map(i => idToName[i] ?? i).sort();
    const wantNames = [...exp.criticalPathSet].sort();
    if (JSON.stringify(gotNames) !== JSON.stringify(wantNames))
      diffs.push(`criticalPath: verwacht {${wantNames.join(',')}}, kreeg {${gotNames.join(',')}}`);
  }

  if (exp.floatPaths) {
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const got: Record<string, number> = {};
    for (const [tid, nr] of Object.entries((cpm as any)?.floatPathByTask ?? {})) got[idToName[tid] ?? tid] = nr as number;
    const norm = (o: Record<string, number>) => JSON.stringify(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
    if (norm(got) !== norm(exp.floatPaths))
      diffs.push(`floatPaths: verwacht ${norm(exp.floatPaths)}, kreeg ${norm(got)}`);
  }

  if (exp.criticalPaths) {
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const enc = (paths: string[][], map: boolean) => JSON.stringify(
      paths.map(p => [...p].map(x => (map ? (idToName[x] ?? x) : x)).sort())
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    );
    const got = enc((cpm as any)?.criticalPaths ?? [], true);
    const want = enc(exp.criticalPaths, false);
    if (got !== want) diffs.push(`criticalPaths: verwacht ${want}, kreeg ${got}`);
  }

  if (cpm && !cpm.error) {
    for (const t of S().tasks) {
      if (t.childIds.length > 0) continue;
      const it = t.time;
      const name = Object.entries(ids).find(([, i]) => i === t.id)?.[0] ?? t.name;
      if (it.interferingFloat === undefined) {
        diffs.push(`intf-invariant: leaf "${name}" mist interferingFloat`);
      } else if (!(Math.abs(it.interferingFloat - (it.totalFloat - it.freeFloat)) <= 1e-9)) {
        diffs.push(`intf-invariant: "${name}" intf=${it.interferingFloat} ≠ tf−ff=${it.totalFloat - it.freeFloat}`);
      }
    }
  }

  if (cpm && !cpm.error) {
    const cp = cpm.criticalPath ?? [];
    const cps = (cpm as any).criticalPaths ?? [];
    if (cps.length < 1) diffs.push(`critpaths-invariant: criticalPaths leeg (verwacht ≥1)`);
    else if (JSON.stringify(cps[0]) !== JSON.stringify(cp))
      diffs.push(`critpaths-invariant: criticalPaths[0]=${JSON.stringify(cps[0])} ≠ criticalPath=${JSON.stringify(cp)}`);
  }

  if (cpm && !cpm.error) {
    const fpbt = (cpm as any).floatPathByTask ?? {};
    const nearIds = new Set<string>((cpm as any).nearCriticalTaskIds ?? []);
    const cps: string[][] = (cpm as any).criticalPaths ?? [];
    for (const t of S().tasks) {
      if (t.isHammock !== true) continue;
      const name = Object.entries(ids).find(([, i]) => i === t.id)?.[0] ?? t.name;
      if (fpbt[t.id] !== undefined) diffs.push(`hammock-invariant: "${name}" heeft floatPath ${fpbt[t.id]}`);
      if (nearIds.has(t.id)) diffs.push(`hammock-invariant: "${name}" in nearCriticalTaskIds`);
      if (cps.some((p) => p.includes(t.id))) diffs.push(`hammock-invariant: "${name}" in een criticalPaths-keten`);
    }
  }

  if (exp.projectStartDate !== undefined && !cmp.projectDate(S().project.startDate, exp.projectStartDate, 'scheduleStart'))
    diffs.push(`projectStartDate: verwacht ${exp.projectStartDate}, kreeg ${S().project.startDate}`);

  if (exp.baselineTasks) {
    const active = S().baselines.find((b) => b.id === S().activeBaselineId);
    if (!active) diffs.push('baselineTasks: geen actieve baseline');
    else {
      for (const [name, want] of Object.entries<any>(exp.baselineTasks)) {
        const bt = active.tasks.find((x) => x.taskId === ids[name]);
        if (!bt) { diffs.push(`baselineTasks: taak "${name}" niet in de baseline`); continue; }
        for (const [k, wv] of Object.entries<any>(want)) {
          const gv = (bt as any)[k];
          const ok = k === 'start' ? cmp.taskDate(name, gv, wv, 'baselineStart')
            : k === 'finish' ? cmp.taskDate(name, gv, wv, cmp.shownFinishField(name))
              : k === 'duration' ? cmp.dayNumber(`baselineTasks.${name}.duration`, gv, wv)
                : gv === wv;
          if (!ok) diffs.push(`baselineTasks.${name}.${k}: verwacht ${JSON.stringify(wv)}, kreeg ${JSON.stringify(gv)}`);
        }
      }
    }
  }

  if (exp.projectEnd !== undefined && !cmp.projectDate(cpm?.projectEnd, exp.projectEnd, 'earlyFinish'))
    diffs.push(`projectEnd: verwacht ${exp.projectEnd}, kreeg ${cpm?.projectEnd}`);
  if (exp.projectDuration !== undefined && !cmp.dayNumber('projectDuration', cpm?.projectDuration, exp.projectDuration))
    diffs.push(`projectDuration: verwacht ${exp.projectDuration}, kreeg ${cpm?.projectDuration}`);

  if (exp.scheduleStale !== undefined && S().scheduleStale !== exp.scheduleStale)
    diffs.push(`scheduleStale: verwacht ${exp.scheduleStale}, kreeg ${S().scheduleStale}`);

  if (exp.calendarInvariant !== undefined) {
    const entry = S().calendars.find((c) => c.id === S().project.calendarId);
    const got = !!entry && S().calendar.id === S().project.calendarId;
    if (got !== exp.calendarInvariant)
      diffs.push(`calendarInvariant: verwacht ${exp.calendarInvariant}, kreeg ${got} (project.calendarId=${S().project.calendarId}, calendars=[${S().calendars.map(c => c.id).join(',')}], calendar.id=${S().calendar.id})`);
  }

  if (c.previewExpect) {
    const pr = previewResult;
    if (!pr) {
      diffs.push('previewExpect: geen LevelingResult (levelResources gaf niets terug)');
    } else {
      const pe = c.previewExpect;
      if (pe.projectEndAfter !== undefined && !cmp.projectDate(pr.projectEndAfter, pe.projectEndAfter, 'earlyFinish'))
        diffs.push(`preview.projectEndAfter: verwacht ${pe.projectEndAfter}, kreeg ${pr.projectEndAfter}`);
      if (pe.shiftedTasks) {
        const got = Object.keys(pr.shifts).map(tid => nameOf(tid, ids)).sort();
        const want = [...pe.shiftedTasks].sort();
        if (JSON.stringify(got) !== JSON.stringify(want))
          diffs.push(`preview.shiftedTasks: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
      }
      if (pe.unresolvedTasks) {
        const got = Object.keys(pr.unresolved).map(tid => nameOf(tid, ids)).sort();
        const want = [...pe.unresolvedTasks].sort();
        if (JSON.stringify(got) !== JSON.stringify(want))
          diffs.push(`preview.unresolvedTasks: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
      }
      if (pe.reasons) {
        for (const [name, want] of Object.entries(pe.reasons)) {
          const tid = ids[name];
          const got = tid ? pr.unresolvedReasons[tid] : undefined;
          if (got !== want) diffs.push(`preview.reasons.${name}: verwacht ${want}, kreeg ${got}`);
        }
      }
    }
  }

  if (exp.load) {
    const rlr = S().resourceLoadResult;
    for (const [resName, days] of Object.entries<Record<string, number>>(exp.load)) {
      const resId = resIds[resName];
      if (!resId) { diffs.push(`load: onbekende resource "${resName}"`); continue; }
      for (const [iso, want] of Object.entries(days)) {
        const got = rlr?.load[resId]?.[iso] ?? 0;
        if (got !== want) diffs.push(`load.${resName}.${iso}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
      }
    }
  }

  if (exp.overallocatedDays) {
    const rlr = S().resourceLoadResult;
    for (const [resName, wantDays] of Object.entries<string[]>(exp.overallocatedDays)) {
      const resId = resIds[resName];
      if (!resId) { diffs.push(`overallocatedDays: onbekende resource "${resName}"`); continue; }
      const got = [...(rlr?.overallocatedDays[resId] ?? [])].sort();
      const want = [...wantDays].sort();
      if (JSON.stringify(got) !== JSON.stringify(want))
        diffs.push(`overallocatedDays.${resName}: verwacht {${want.join(',')}}, kreeg {${got.join(',')}}`);
    }
  }

  if (exp.variance) {
    const cal = new CalendarEngine(S().calendar);
    const active = S().baselines.find((b) => b.id === S().activeBaselineId) ?? null;
    const vres = computeVariance(S().tasks, active, cal, S().cpmResult?.projectEnd);
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;
    const rowByName: Record<string, any> = {};
    for (const r of vres.rows) rowByName[idToName[r.taskId] ?? r.taskId] = r;
    if (exp.variance.rows) {
      for (const [name, want] of Object.entries<any>(exp.variance.rows)) {
        const got = rowByName[name];
        if (!got) { diffs.push(`variance-rij "${name}" niet gevonden`); continue; }
        for (const [k, wv] of Object.entries<any>(want)) {
          const ok = k === 'baselineStart' || k === 'currentStart' ? cmp.taskDate(name, got[k], wv, 'actualStart')
            : k === 'baselineFinish' || k === 'currentFinish' ? cmp.taskDate(name, got[k], wv, cmp.shownFinishField(name))
              : k === 'deltaStart' || k === 'deltaFinish' ? cmp.dayNumber(`variance.${name}.${k}`, got[k], wv)
                : got[k] === wv;
          if (!ok) diffs.push(`variance.${name}.${k}: verwacht ${JSON.stringify(wv)}, kreeg ${JSON.stringify(got[k])}`);
        }
      }
    }
    if (exp.variance.projectEndDelta !== undefined && !cmp.dayNumber('variance.projectEndDelta', vres.projectEndDelta, exp.variance.projectEndDelta))
      diffs.push(`variance.projectEndDelta: verwacht ${exp.variance.projectEndDelta}, kreeg ${vres.projectEndDelta}`);
  }

  if (c.view) {
    const v = c.view;
    const m: ViewMaps = { ids, codeTypeIds, codeValueIds, fieldDefIds };
    const idToName: Record<string, string> = {};
    for (const [n, i] of Object.entries(ids)) idToName[i] = n;

    if (v.timescaleRoundtrip) {
      for (const s of ['year', 'quarter', 'month', 'week', 'day'] as const) {
        const got = scaleFromZoom(TIMESCALE_ZOOM[s]);
        if (got !== s) diffs.push(`timescale: scaleFromZoom(${TIMESCALE_ZOOM[s]})=${got}, verwacht ${s}`);
      }
      const gotHour = scaleFromZoom(TIMESCALE_ZOOM.hour);
      if (gotHour !== 'hour') diffs.push(`timescale: scaleFromZoom(${TIMESCALE_ZOOM.hour}, true)=${gotHour}, verwacht hour`);
    }

    const groupSpecs = v.group ?? [];
    const opts = {
      filter: v.filter ? toFilterNode(v.filter, m) : null,
      group: toGroupLevels(groupSpecs, m),
      sort: toSortLevels(v.sort, m),
      collapsedTaskIds: new Set((v.collapsedTasks ?? []).map(n => ids[n]).filter(Boolean)),
      collapsedGroupKeys: new Set(
        (v.collapsedGroups ?? []).map(path =>
          encodeBandKey(path.map((val, i) => bandRawKey(groupSpecs[i].field, val, m))),
        ),
      ),
    };
    const ctx: ViewContext = {
      activityCodeTypes: S().activityCodeTypes,
      customFieldDefs: S().customFieldDefs,
      resources: S().resources,
      assignments: S().assignments,
      noneLabel: NONE_LABEL,
    };
    let rows: ViewRow[] = [];
    try {
      rows = computeViewRows(S().tasks, opts, ctx);
    } catch (e) {
      diffs.push(`computeViewRows THREW: ${String(e)}`);
    }

    if (v.expectTreeMode !== undefined) {
      const got = isTreeMode({ filter: opts.filter, group: opts.group, sort: opts.sort });
      if (got !== v.expectTreeMode) diffs.push(`treeMode: verwacht ${v.expectTreeMode}, kreeg ${got}`);
    }

    if (v.expectRows) {
      const actual = rows.map(r =>
        r.kind === 'task'
          ? { kind: 'task' as const, name: idToName[r.task.id] ?? r.task.id, dim: r.dimmed, depth: r.depth }
          : r.kind === 'milestones'
            ? { kind: 'milestones' as const, names: r.tasks.map(t => idToName[t.id] ?? t.id), depth: r.depth }
            : { kind: 'group' as const, label: r.label, count: r.count, collapsed: r.collapsed, level: r.levelIndex },
      );
      const fmt = (x: any) => x.kind === 'task' ? `T:${x.name}` : `G:${x.label}`;
      if (actual.length !== v.expectRows.length) {
        diffs.push(`rows: verwacht ${v.expectRows.length} rijen [${v.expectRows.map((e: any) => e.t ? 'T:' + e.t : 'G:' + e.g).join(', ')}], kreeg ${actual.length} [${actual.map(fmt).join(', ')}]`);
      } else {
        v.expectRows.forEach((want: any, i) => {
          const got: any = actual[i];
          if ('t' in want) {
            if (got.kind !== 'task') { diffs.push(`rows[${i}]: verwacht taak "${want.t}", kreeg band "${got.label}"`); return; }
            if (got.name !== want.t) diffs.push(`rows[${i}].t: verwacht ${want.t}, kreeg ${got.name}`);
            if (want.dim !== undefined && got.dim !== want.dim) diffs.push(`rows[${i}](${got.name}).dim: verwacht ${want.dim}, kreeg ${got.dim}`);
            if (want.depth !== undefined && got.depth !== want.depth) diffs.push(`rows[${i}](${got.name}).depth: verwacht ${want.depth}, kreeg ${got.depth}`);
          } else {
            if (got.kind !== 'group') { diffs.push(`rows[${i}]: verwacht band "${want.g}", kreeg taak "${got.name}"`); return; }
            if (got.label !== want.g) diffs.push(`rows[${i}].g: verwacht ${want.g}, kreeg ${got.label}`);
            if (want.count !== undefined && got.count !== want.count) diffs.push(`rows[${i}](${got.label}).count: verwacht ${want.count}, kreeg ${got.count}`);
            if (want.collapsed !== undefined && got.collapsed !== want.collapsed) diffs.push(`rows[${i}](${got.label}).collapsed: verwacht ${want.collapsed}, kreeg ${got.collapsed}`);
            if (want.level !== undefined && got.level !== want.level) diffs.push(`rows[${i}](${got.label}).level: verwacht ${want.level}, kreeg ${got.level}`);
          }
        });
      }
    }

    if (v.expectFirstIndex) {
      const map = firstRowIndexByTask(rows);
      for (const [name, want] of Object.entries(v.expectFirstIndex)) {
        const got = map.get(ids[name]);
        if (got !== want) diffs.push(`firstIndex.${name}: verwacht ${want}, kreeg ${got}`);
      }
    }
  }

  return diffs;
}

interface Comparer {
  taskField(name: string, key: string, got: unknown, want: unknown): boolean;
  projectDate(got: unknown, want: unknown, field: TaskDateField): boolean;
  taskDate(name: string, got: unknown, want: unknown, field: TaskDateField): boolean;
  dayNumber(label: string, got: unknown, want: unknown): boolean;
  shownFinishField(name: string): TaskDateField;
  readonly notes: string[];
}

const EXACT: Comparer = {
  taskField: (_n, _k, got, want) => got === want,
  projectDate: (got, want) => got === want,
  taskDate: (_n, got, want) => got === want,
  dayNumber: (_l, got, want) => got === want,
  shownFinishField: () => 'baselineFinish',
  notes: [],
};

const TASK_DATE_FIELD: Record<string, TaskDateField> = {
  es: 'earlyStart', ef: 'earlyFinish', ls: 'lateStart', lf: 'lateFinish',
};

function minuteComparer(ids: Record<string, string>): Comparer {
  const clocks = new DayClockCache(S().calendar, S().calendars);
  const projectCtx: TaskDateContext = { clock: clocks.calendarClock(undefined), milestoneKind: null };
  const taskOf = (name: string) => S().tasks.find((x) => x.id === ids[name]);
  const ctxOf = (name: string): TaskDateContext => {
    const t = taskOf(name);
    return t ? taskDateContext(t, clocks) : projectCtx;
  };
  const endSetterCtx = (got: unknown): TaskDateContext => {
    if (typeof got !== 'string') return projectCtx;
    const t = S().tasks.find((x) => !isSummaryTask(x) && x.time.earlyFinish === got);
    return t ? taskDateContext(t, clocks) : projectCtx;
  };
  const lateFinishFromProjectEnd = (name: string): boolean => {
    const t = taskOf(name);
    if (!t || !isElapsedTask(t) || t.deadline || t.constraint || t.constraint2) return false;
    if (t.externalLinks?.some((l) => l.direction === 'successor')) return false;
    return !S().sequences.some((q) => q.predecessorId === t.id);
  };
  const notes: string[] = [];
  const sameDay = (got: unknown, want: unknown, field: TaskDateField, ctx: TaskDateContext): boolean => {
    if (typeof want !== 'string' || typeof got !== 'string' || !isDateOnly(want)) return got === want;
    const side = taskDateFieldSide(field);
    const w = normalizeTaskDate(want, field, ctx) ?? want;
    const g = normalizeTaskDate(got, field, ctx) ?? got;
    return workdayOfInstant(ctx.clock, w, side) === workdayOfInstant(ctx.clock, g, side);
  };
  const near = (got: unknown, want: unknown): boolean =>
    (typeof got === 'number' && typeof want === 'number' ? Math.abs(got - want) <= 1e-6 : got === want);
  const dayNumber = (label: string, got: unknown, want: unknown): boolean => {
    if (typeof got === 'number' && Math.abs(got - Math.round(got)) > 1e-6) notes.push(`~ niet geheel: ${label} = ${got}`);
    return near(got, want);
  };
  return {
    notes,
    taskField(name, key, got, want) {
      const field = TASK_DATE_FIELD[key];
      if (field === 'lateFinish' && lateFinishFromProjectEnd(name))
        return sameDay(got, want, 'earlyFinish', endSetterCtx(S().cpmResult?.projectEnd));
      if (field) return sameDay(got, want, field, ctxOf(name));
      if (key === 'tf' || key === 'ff' || key === 'intf') return near(got, want);
      if (key === 'scheduleDuration') return dayNumber(`${name}.scheduleDuration`, got, want);
      return got === want;
    },
    projectDate: (got, want, field) =>
      sameDay(got, want, field, field === 'earlyFinish' ? endSetterCtx(got) : projectCtx),
    taskDate: (name, got, want, field) => sameDay(got, want, field, ctxOf(name)),
    dayNumber,
    shownFinishField(name) {
      const t = taskOf(name);
      return t && isPinnedComplete(t.time) ? 'baselineFinishCompleted' : 'baselineFinish';
    },
  };
}

const REASON_RUNS = {
  'CONV-SF': [1, 2],
  'PCT-LAG-EXACT': [1, 2],
  'REST-EXACT': [1, 2],
  'KALENDERTIJD-EINDE': [1, 2],
  'PROFIEL-URENMAAT': [2],
} as const satisfies Record<string, readonly (1 | 2)[]>;
type ReasonCode = keyof typeof REASON_RUNS;

type MinuteStatus = 'GELIJK' | 'ROOD' | 'BEWUST' | 'BEWUST_ROOD' | 'UREN';

function activeReason(c: Case): ReasonCode | null {
  const mm = c.minuteModel;
  if (!mm || !MM_RUN) return null;
  return (REASON_RUNS[mm.reason] as readonly number[]).includes(MM_RUN) ? mm.reason : null;
}

function mergeExpect(base: CaseExpect, over: CaseExpect): CaseExpect {
  const out: CaseExpect = { ...base, ...over };
  if (base.tasks || over.tasks) {
    const tasks: Record<string, TaskExpect> = { ...(base.tasks ?? {}) };
    for (const [name, t] of Object.entries(over.tasks ?? {})) tasks[name] = { ...(tasks[name] ?? {}), ...t };
    out.tasks = tasks;
  }
  if (base.baselineTasks || over.baselineTasks) {
    const bt: NonNullable<CaseExpect['baselineTasks']> = { ...(base.baselineTasks ?? {}) };
    for (const [name, t] of Object.entries(over.baselineTasks ?? {})) bt[name] = { ...(bt[name] ?? {}), ...t };
    out.baselineTasks = bt;
  }
  return out;
}

const CASE_KEYS = {
  id: true, title: true, note: true,
  calendar: true, anchor: true, calendars: true,
  resources: true, codes: true, customFields: true,
  view: true, sourceParity: true,
  statusDate: true, scheduleOptions: true, schedulingOptions: true,
  tasks: true, links: true,
  level: true, levelPreview: true,
  baseline: true, varianceMutations: true,
  afterCPM: true, previewExpect: true,
  expect: true, minuteModel: true,
} satisfies Record<keyof Case, true>;

const MINUTE_MODEL_KEYS = { reason: true, expect: true, note: true } satisfies Record<keyof MinuteModelCase, true>;

const EXPECT_KEYS = {
  error: true, tasks: true,
  criticalPathSet: true, nearCriticalSet: true, hammockNoFinishDriversSet: true,
  violatedConstraintsSet: true, missedDeadlinesSet: true,
  drivingSet: true, truncatedLeadSet: true, outOfSequenceSet: true,
  floatPaths: true, criticalPaths: true,
  projectEnd: true, projectDuration: true, projectStartDate: true,
  baselineTasks: true, scheduleStale: true, calendarInvariant: true,
  load: true, overallocatedDays: true, variance: true,
} satisfies Record<keyof CaseExpect, true>;

const TASK_EXPECT_KEYS = {
  es: true, ef: true, ls: true, lf: true,
  tf: true, ff: true, intf: true,
  crit: true, nearCrit: true, floatPath: true,
  scheduleDuration: true, durationMinutes: true,
  manuallyScheduled: true, splitGapCount: true,
  levelingDelayMinutes: true, levelingDelayElapsed: true,
} satisfies Record<keyof TaskExpect, true>;

const TASK_KEYS = {
  name: true, dur: true, start: true, milestone: true, milestoneKind: true,
  mandatory: true, parent: true, deadline: true, durationType: true,
  constraint: true, constraint2: true, hammock: true, externalLinks: true,
  priority: true, durationMinutesRaw: true, remainingMinutes: true, calendar: true,
  assign: true, completion: true, actualStart: true, actualFinish: true, rawCompletion: true,
  code: true, field: true,
  splitGaps: true, manuallyScheduled: true, levelingDelayMinutes: true, levelingDelayElapsed: true,
  resume: true, stop: true,
  timephasedStartAnchor: true, timephasedFinishFloor: true,
} satisfies Record<keyof Case['tasks'][number], true>;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const known = (table: object, key: string): boolean => Object.prototype.hasOwnProperty.call(table, key);

function validateCaseKeys(file: string, raw: unknown, index: number): string[] {
  const errs: string[] = [];
  if (!isPlainObject(raw)) return [`${file}: casus #${index} is geen object`];
  const id = typeof raw.id === 'string' ? raw.id : `#${index}`;
  const title = typeof raw.title === 'string' ? ` — ${raw.title}` : '';
  const where = `${file}: casus [${id}]${title}`;

  for (const k of Object.keys(raw)) {
    if (!known(CASE_KEYS, k)) errs.push(`${where}: onbekende sleutel "${k}" op casus-niveau`);
  }

  const rawTasks = raw.tasks;
  if (rawTasks !== undefined) {
    if (!Array.isArray(rawTasks)) {
      errs.push(`${where}: "tasks" is geen array`);
    } else {
      rawTasks.forEach((t: unknown, ti: number) => {
        if (!isPlainObject(t)) { errs.push(`${where}: tasks[${ti}] is geen object`); return; }
        for (const k of Object.keys(t)) {
          if (!known(TASK_KEYS, k)) errs.push(`${where}: onbekende sleutel "${k}" in tasks[${ti}]`);
        }
      });
    }
  }

  validateExpectKeys(where, 'expect', raw.expect, errs);

  const mm = raw.minuteModel;
  if (mm !== undefined) {
    if (!isPlainObject(mm)) {
      errs.push(`${where}: "minuteModel" is geen object`);
    } else {
      for (const k of Object.keys(mm)) {
        if (!known(MINUTE_MODEL_KEYS, k)) errs.push(`${where}: onbekende sleutel "${k}" in minuteModel`);
      }
      if (typeof mm.reason !== 'string' || !known(REASON_RUNS, mm.reason)) {
        errs.push(`${where}: minuteModel.reason ${JSON.stringify(mm.reason)} is geen redencode (${Object.keys(REASON_RUNS).join(', ')})`);
      }
      validateExpectKeys(where, 'minuteModel.expect', mm.expect, errs);
    }
  }
  return errs;
}

function validateExpectKeys(where: string, label: string, exp: unknown, errs: string[]): void {
  if (exp === undefined) return;
  if (!isPlainObject(exp)) {
    errs.push(`${where}: "${label}" is geen object`);
    return;
  }
  for (const k of Object.keys(exp)) {
    if (!known(EXPECT_KEYS, k)) errs.push(`${where}: onbekende sleutel "${k}" in ${label}`);
  }
  const tasks = exp.tasks;
  if (tasks === undefined) return;
  if (!isPlainObject(tasks)) {
    errs.push(`${where}: "${label}.tasks" is geen object`);
    return;
  }
  for (const [taskName, want] of Object.entries(tasks)) {
    if (!isPlainObject(want)) {
      errs.push(`${where}: "${label}.tasks.${taskName}" is geen object`);
      continue;
    }
    for (const k of Object.keys(want)) {
      if (!known(TASK_EXPECT_KEYS, k))
        errs.push(`${where}: onbekende sleutel "${k}" in ${label}.tasks."${taskName}"`);
    }
  }
}

const MM_RUNS_FILE = join(dirname(fileURLToPath(import.meta.url)), 'minute-model-runs.json');
const MM_VERBOSE = process.env.OPS_MINUTE_MODEL_VERBOSE === '1';
const mmNotEqual: Record<string, string[]> = {};
const mmTotals = { day: 0, rawRed: 0, GELIJK: 0, ROOD: 0, BEWUST: 0, BEWUST_ROOD: 0, UREN: 0 };

function reportMinuteBattery(name: string, results: CaseResult[]): void {
  const n = (st: MinuteStatus) => results.filter((r) => r.status === st).length;
  const dayResults = results.filter((r) => r.status !== 'UREN');
  const rawRed = dayResults.filter((r) => r.rawRed).length;
  mmTotals.day += dayResults.length;
  mmTotals.rawRed += rawRed;
  for (const st of ['GELIJK', 'ROOD', 'BEWUST', 'BEWUST_ROOD', 'UREN'] as const) mmTotals[st] += n(st);
  console.log(`MM ${MM_LABEL} ${name}: dagcases ${dayResults.length}, rood zonder redencodes ${rawRed}; `
    + `na redencodes gelijk ${n('GELIJK')}, rood ${n('ROOD')}, bewust ${n('BEWUST')}, bewust maar rood ${n('BEWUST_ROOD')}; `
    + `urencases overgeslagen ${n('UREN')}`);
  for (const r of dayResults) {
    if (r.status !== 'GELIJK' || r.rawRed) {
      console.log(`MMCASE\t${MM_RUN}\t${name}\t${r.id}\t${r.status}\t${r.rawRed ? 'rauw-rood' : 'rauw-gelijk'}\t${r.reason ?? '-'}`);
    }
    if (r.status !== 'GELIJK' && r.status !== 'BEWUST' && MM_VERBOSE) {
      for (const d of r.diffs) console.log(`       - ${d}`);
    }
    for (const note of r.notes ?? []) console.log(`   ~ [${r.id}] ${note}`);
  }
  mmNotEqual[name] = dayResults
    .filter((r) => r.status === 'ROOD' || r.status === 'BEWUST_ROOD')
    .map((r) => r.id)
    .sort();
}

function finishMinuteRun(): boolean {
  const t = mmTotals;
  console.log(`MM ${MM_LABEL} TOTAAL: dagcases ${t.day}, rood zonder redencodes ${t.rawRed}; na redencodes gelijk ${t.GELIJK}, `
    + `rood ${t.ROOD}, bewust ${t.BEWUST}, bewust maar rood ${t.BEWUST_ROOD}; urencases overgeslagen ${t.UREN}`);
  const key = `run${MM_RUN}`;
  let file: Record<string, unknown> = {};
  try {
    file = JSON.parse(readFileSync(MM_RUNS_FILE, 'utf8'));
  } catch {
    file = {};
  }
  const pinned = (file[key] ?? {}) as Record<string, string[]>;
  if (process.env.OPS_MINUTE_MODEL_UPDATE === '1') {
    const next: Record<string, string[]> = { ...pinned, ...mmNotEqual };
    file[key] = Object.fromEntries(Object.keys(next).sort().map((b) => [b, next[b]]));
    writeFileSync(MM_RUNS_FILE, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`OK  minutenmodel ${MM_LABEL}: minute-model-runs.json bijgewerkt (${Object.keys(mmNotEqual).length} batterij(en))`);
    return true;
  }
  let ok = true;
  for (const [battery, list] of Object.entries(mmNotEqual)) {
    const want = pinned[battery];
    if (!Array.isArray(want)) {
      console.log(`XX  minutenmodel ${MM_LABEL}: batterij ${battery} ontbreekt in minute-model-runs.json (zie tests/planning/README.md)`);
      ok = false;
      continue;
    }
    const added = list.filter((id) => !want.includes(id));
    const gone = want.filter((id) => !list.includes(id));
    if (added.length > 0) {
      console.log(`XX  minutenmodel ${MM_LABEL} ${battery}: nieuw niet gelijk op dagniveau: ${added.join(', ')}`);
      ok = false;
    }
    if (gone.length > 0) {
      console.log(`XX  minutenmodel ${MM_LABEL} ${battery}: nu wel gelijk, haal uit minute-model-runs.json: ${gone.join(', ')}`);
      ok = false;
    }
  }
  if (ok) console.log(`OK  minutenmodel ${MM_LABEL}: de niet-gelijke cases kloppen met minute-model-runs.json`);
  return ok;
}

const files = process.argv.slice(2);
let grandPass = 0;
let grandTotal = 0;
let anyFail = false;
for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const name = file.replace(/^.*\/cases-/, '').replace(/\.json$/, '');
  if (data?.cases !== undefined && !Array.isArray(data.cases)) {
    console.log(`XX ${name}: "cases" is geen array`);
    anyFail = true;
    continue;
  }
  const cases: Case[] = data.cases ?? [];
  if (cases.length === 0) {
    console.log(`XX ${name}: GEEN cases (leeg of ontbrekende "cases"-sleutel)`);
    anyFail = true;
    continue;
  }
  const schemaErrs = cases.flatMap((c, i) => validateCaseKeys(name, c, i));
  if (schemaErrs.length > 0) {
    console.log(`XX ${name}: ${schemaErrs.length} schemafout(en) — batterij niet gedraaid`);
    for (const e of schemaErrs) console.log(`   - ${e}`);
    anyFail = true;
    continue;
  }
  const results = cases.map(runCase);
  if (MM_RUN) {
    reportMinuteBattery(name, results);
    if (MM_RUN === 1 && results.some(result => !result.pass)) anyFail = true;
    continue;
  }
  const passed = results.filter((r) => r.pass).length;
  grandPass += passed;
  grandTotal += results.length;
  const ok = passed === results.length;
  if (!ok) anyFail = true;
  console.log(`${ok ? 'OK ' : 'XX '} ${name}: ${passed}/${results.length}`);
  for (const r of results) {
    if (r.pass) continue;
    console.log(`   x [${r.id}] ${r.title}`);
    for (const d of r.diffs) console.log(`       - ${d}`);
  }
}
if (MM_RUN) {
  if (!finishMinuteRun()) anyFail = true;
  process.exit(anyFail ? 1 : 0);
}
console.log(`\nTOTAAL: ${grandPass}/${grandTotal}${anyFail ? '  (FALEN)' : '  (alles groen)'}`);
process.exit(anyFail ? 1 : 0);
