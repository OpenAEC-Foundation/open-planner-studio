import type {
  ConstraintType,
  DurationType,
  MilestoneKind,
  Task,
  TaskConstraint,
  TaskType,
} from '@/types/task';
import { TASK_TYPES } from '@/types/task';
import type { CustomTaskType, CustomTaskTypeDraft } from '@/types/taskType';
import { isRecord } from '@/utils/guards';
import { customTaskTypeClashes } from '@/services/taskTypes/customTaskTypeRules';
import { WORK_RULES, type WorkRule } from '@/types/workRule';
import { milestoneRefusal } from '@/engine/taskMilestoneTransition';
import {
  validateConstraintPair,
  withPrimaryConstraint,
  type ConstraintPairIssue,
} from '@/engine/scheduler/constraintValidation';

export interface TaskTimePatch {
  scheduleDuration?: number;
  durationUnit?: 'days' | 'hours';
  durationMinutes?: number;
  durationType?: DurationType;
  clearDurationMinutes?: boolean;
}

export interface TaskFieldPatch {
  top: Partial<Task>;
  time?: TaskTimePatch;
  customTaskType?: CustomTaskTypeDraft;
  workRule?: WorkRule | null;
}

export interface TaskFieldContext {
  currentIsMilestone: boolean;
  hasChildren: boolean;
  hasAssignments: boolean;
  currentConstraint2?: TaskConstraint;
  calendarExists: (id: string) => boolean;
  customTaskTypes: readonly CustomTaskType[];
  durationCalendar: (calendarId: string | null | undefined) => { hoursPerDay: number; hasWorkBlocks: boolean };
}

export const SUMMARY_DURATION_READ_ONLY =
  'a summary task duration is derived from its subtasks; change the leaf task durations instead';

const DURATION_TYPES: DurationType[] = ['WORKTIME', 'ELAPSEDTIME'];
const CONSTRAINT_TYPES: ConstraintType[] = ['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'];
const MILESTONE_KINDS: MilestoneKind[] = ['START', 'FINISH'];
const DATELESS_CONSTRAINTS: ConstraintType[] = ['ASAP', 'ALAP'];
const HARD_CONSTRAINTS: ConstraintType[] = ['MSO', 'MFO'];

export const TASK_FIELD_NAMES = [
  'name',
  'description',
  'duration',
  'durationUnit',
  'durationType',
  'taskType',
  'customTaskType',
  'isMilestone',
  'milestoneKind',
  'mandatory',
  'priority',
  'constraint',
  'deadline',
  'calendarId',
  'workRule',
] as const;

const REJECT_HINTS: Record<string, string> = {
  time: 'set the duration with `duration` and its measure with `durationUnit` (`days` = day measure, a fraction such as 2.5 is allowed; `hours` = hour measure) and the duration type with `durationType` (ELAPSEDTIME = calendar time, 1 d = 24 h) — the `time` branch itself is not settable (that would clear CPM dates, floats and actuals)',
  scheduleDuration: 'use `duration` with `durationUnit` (`days` = day measure, a fraction such as 2.5 is allowed; `hours` = hour measure)',
  durationMinutes: 'use `duration` with `durationUnit: "hours"`; the bridge calculates and stores the exact minute source itself',
  status: 'use `progress` (progress path), not `fields.status`',
  completion: 'use `progress.completion` (0–100)',
  actualStart: 'use `progress.actualStart`',
  actualFinish: 'use `progress.actualFinish`',
  parentId: 'use planner_move_task to re-parent a task',
  childIds: 'the WBS tree changes via planner_move_task / planner_add_tasks',
  resourceIds: 'use planner_manage_assignments',
  wbsCode: 'the WBS code is derived',
  id: 'the task id is fixed',
  constraint2: 'a secondary constraint is not settable via the bridge (P6 combination rules are not validated here)',
  isHammock: 'hammock/LOE is not settable via the bridge (the duration is then derived and ignores `duration`)',
  notes: 'task notes are not settable via the bridge',
  splitGaps: 'work interruptions (splits) are set with planner_set_task_splits (`interruptions` on the work axis: afterWorkDays/pauseDays or afterWorkHours/pauseHours), not via `fields`',
  manuallyScheduled: 'manual scheduling is not settable via the bridge (the dates then stay RAW, regardless of calendar/relationships/`duration`)',
  levelingDelayMinutes: 'sub-day leveling delay is not settable via the bridge (no read-tool counterpart, see `levelingDelay`)',
  levelingDelayElapsed: 'sub-day leveling delay is not settable via the bridge (no read-tool counterpart, see `levelingDelay`)',
  mspTaskType: 'MSP\'s own Task Type is not settable via the bridge (pure .mpp import data, no calculation behaviour — see planner_get_task)',
  effortDriven: 'MSP\'s "Effort Driven" flag is not settable via the bridge (pure .mpp import data, no calculation behaviour — see planner_get_task)',
  timephasedContours: 'the raw contour periods are not settable via the bridge (derived from an .mpp import, no agent input form — see planner_get_task)',
  remainingWorkMinutes: 'remaining work belongs to an ASSIGNMENT: planner_manage_assignments `update` with `remainingWorkMinutes`',
  plannedWorkMinutes: 'budgeted work is not settable via the bridge (reference value from an import — see planner_get_task)',
  actualWorkMinutes: 'actual work is not settable via the bridge (a fact from an import; progress goes through `progress`)',
  p6DurationType: 'P6\'s own Duration Type is not settable via the bridge (pure .xer import data, no calculation behaviour — see planner_get_task)',
  p6ActivityType: 'P6\'s own Activity Type is not settable via the bridge (pure .xer import data, no calculation behaviour — see planner_get_task)',
  p6ExplicitTargetWindow: 'the P6 XER provenance for an explicit target window is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
  p6SuspendResume: 'the P6 suspend/resume provenance flag is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
  p6ProjectId: 'P6\'s source project id is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
  p6TaskId: 'P6\'s source activity id is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
  p6CompletePctType: 'P6\'s Completion Percent Type is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
  p6ExpectedFinish: 'P6\'s Expected Finish is not settable via the bridge (pure .xer import data, no agent input form — see planner_get_task)',
};

export type TaskFieldResult =
  | { ok: true; patch: TaskFieldPatch }
  | { ok: false; reason: string };

function allowedList(): string {
  return TASK_FIELD_NAMES.join(', ');
}

function rejectUnknown(key: string): string {
  const hint = REJECT_HINTS[key];
  return hint
    ? `unknown field '${key}': ${hint}. Allowed: ${allowedList()}`
    : `unknown field '${key}'; allowed: ${allowedList()}`;
}

function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(v) && !Number.isNaN(new Date(v).getTime());
}

function parseConstraint(raw: unknown): { ok: true; value: TaskConstraint } | { ok: false; reason: string } {
  if (!isRecord(raw)) return { ok: false, reason: '`constraint` must be an object ({ type, date?, hard? }) or null to clear it' };
  const type = raw.type;
  if (typeof type !== 'string' || !(CONSTRAINT_TYPES as string[]).includes(type)) {
    return { ok: false, reason: `\`constraint.type\` must be one of ${CONSTRAINT_TYPES.join(' | ')}` };
  }
  const ct = type as ConstraintType;
  const needsDate = !DATELESS_CONSTRAINTS.includes(ct);
  if (needsDate && !isIsoDate(raw.date)) {
    return { ok: false, reason: `\`constraint.date\` (ISO date) is required for type ${ct}` };
  }
  if (raw.date !== undefined && !isIsoDate(raw.date)) {
    return { ok: false, reason: '`constraint.date` must be an ISO date (YYYY-MM-DD)' };
  }
  if (raw.hard !== undefined) {
    if (typeof raw.hard !== 'boolean') return { ok: false, reason: '`constraint.hard` must be a boolean' };
    if (raw.hard && !HARD_CONSTRAINTS.includes(ct)) {
      return { ok: false, reason: `\`constraint.hard\` only has meaning for ${HARD_CONSTRAINTS.join('/')}, not for ${ct}` };
    }
  }
  for (const k of Object.keys(raw)) {
    if (k !== 'type' && k !== 'date' && k !== 'hard') {
      return { ok: false, reason: `unknown field '${k}' in \`constraint\`; allowed: type, date, hard` };
    }
  }
  return {
    ok: true,
    value: {
      type: ct,
      ...(isIsoDate(raw.date) ? { date: raw.date } : {}),
      ...(raw.hard === true ? { hard: true } : {}),
    },
  };
}

const CONSTRAINT_PAIR_REASONS: Record<ConstraintPairIssue, string> = {
  'no-secondary-with-mandatory-or-on': 'MSO/MFO (or a hard pin) already fixes start and finish and tolerates no secondary constraint',
  'no-secondary-with-asap-alap': 'ASAP/ALAP carries no date bound and tolerates no secondary constraint',
  'secondary-same-side': 'primary and secondary would then both be a lower bound (SNET/FNET) or both an upper bound (SNLT/FNLT)',
  'secondary-type-invalid': 'the secondary constraint must be SNET, FNET, SNLT or FNLT',
  'secondary-hard-forbidden': 'a secondary constraint may never be hard',
};

function constraintPairReason(
  pair: { constraint: TaskConstraint | undefined; constraint2: TaskConstraint | undefined },
  issues: readonly ConstraintPairIssue[],
): string {
  const primary = pair.constraint?.type ?? 'ASAP';
  const secondary = pair.constraint2 ? `${pair.constraint2.type} ${pair.constraint2.date ?? ''}`.trim() : '?';
  return `\`constraint\` ${primary} does not form a valid pair with the existing secondary constraint (` +
    `${secondary}): ${issues.map(issue => CONSTRAINT_PAIR_REASONS[issue]).join('; ')}. The secondary ` +
    'constraint is not settable via the bridge; `constraint: null` clears both, or choose a primary type on ' +
    'the other side of the bound';
}

export function parseTaskFields(raw: unknown, ctx: TaskFieldContext): TaskFieldResult {
  if (!isRecord(raw)) return { ok: false, reason: '`fields` must be an object' };
  const keys = Object.keys(raw);
  if (keys.length === 0) return { ok: false, reason: '`fields` is empty' };

  for (const k of keys) {
    if (!(TASK_FIELD_NAMES as readonly string[]).includes(k)) return { ok: false, reason: rejectUnknown(k) };
  }

  const top: Partial<Task> = {};
  const time: TaskTimePatch = {};
  let customTaskType: CustomTaskTypeDraft | undefined;

  const effMilestone = 'isMilestone' in raw ? raw.isMilestone === true : ctx.currentIsMilestone;

  if ('name' in raw) {
    if (typeof raw.name !== 'string' || raw.name.trim() === '') return { ok: false, reason: '`name` must be a non-empty string' };
    top.name = raw.name;
  }
  if ('description' in raw) {
    if (typeof raw.description !== 'string') return { ok: false, reason: '`description` must be a string' };
    top.description = raw.description;
  }
  if ('duration' in raw) {
    if (ctx.hasChildren) return { ok: false, reason: SUMMARY_DURATION_READ_ONLY };
    const d = raw.duration;
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 0) {
      return { ok: false, reason: '`duration` must be a finite number ≥ 0 in the unit of `durationUnit`' };
    }
    if (effMilestone && d > 0) {
      return { ok: false, reason: `a milestone has duration 0 by definition; \`duration\`=${d} is not allowed` };
    }
    const unit = raw.durationUnit ?? 'days';
    if (unit !== 'days' && unit !== 'hours') {
      return { ok: false, reason: '`durationUnit` must be `days` or `hours`' };
    }
    if (unit === 'hours') {
      const cal = ctx.durationCalendar(
        typeof raw.calendarId === 'string' || raw.calendarId === null ? raw.calendarId : undefined,
      );
      if (!cal.hasWorkBlocks) {
        return { ok: false, reason: 'an hour task requires a task calendar with concrete work blocks' };
      }
      const minutes = Math.round(d * 60);
      time.durationUnit = 'hours';
      time.durationMinutes = minutes;
      time.scheduleDuration = cal.hoursPerDay > 0 ? minutes / (cal.hoursPerDay * 60) : 0;
    } else {
      time.scheduleDuration = d;
      time.durationUnit = 'days';
      time.clearDurationMinutes = true;
    }
  } else if ('durationUnit' in raw) {
    return { ok: false, reason: '`durationUnit` must be given together with `duration`; the bridge does not reinterpret an existing number' };
  }
  if ('durationType' in raw) {
    if (typeof raw.durationType !== 'string' || !(DURATION_TYPES as string[]).includes(raw.durationType)) {
      return { ok: false, reason: `\`durationType\` must be ${DURATION_TYPES.join(' or ')}` };
    }
    time.durationType = raw.durationType as DurationType;
  }
  if ('taskType' in raw) {
    if (typeof raw.taskType !== 'string' || !(TASK_TYPES as string[]).includes(raw.taskType)) {
      return { ok: false, reason: `\`taskType\` must be one of ${TASK_TYPES.join(' | ')}` };
    }
    top.taskType = raw.taskType as TaskType;
    if (raw.taskType !== 'USERDEFINED') top.customTaskTypeId = undefined;
  }
  if ('customTaskType' in raw) {
    const value = raw.customTaskType;
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string'
      || value.id.trim() === '' || value.name.trim() === '') {
      return { ok: false, reason: '`customTaskType` must be { id, name } with non-empty strings' };
    }
    if ('taskType' in raw && raw.taskType !== 'USERDEFINED') {
      return { ok: false, reason: '`customTaskType` requires taskType USERDEFINED (or leave taskType out)' };
    }
    const candidate = { id: value.id.trim(), name: value.name.trim() };
    const { sameId, sameNameOtherId } = customTaskTypeClashes(ctx.customTaskTypes, candidate);
    if (sameId && sameId.name !== candidate.name) {
      return { ok: false, reason: `customTaskType id '${candidate.id}' already exists with project snapshot '${sameId.name}'` };
    }
    if (sameNameOtherId) {
      return { ok: false, reason: `customTaskType name '${candidate.name}' already exists with id '${sameNameOtherId.id}'` };
    }
    customTaskType = candidate;
    top.taskType = 'USERDEFINED';
    top.customTaskTypeId = candidate.id;
  }
  if ('isMilestone' in raw) {
    if (typeof raw.isMilestone !== 'boolean') return { ok: false, reason: '`isMilestone` must be a boolean' };
    if (raw.isMilestone) {
      const refusal = milestoneRefusal(ctx);
      if (refusal === 'summary') return { ok: false, reason: 'a summary task (with children) cannot become a milestone' };
      if (refusal === 'assignments') return { ok: false, reason: 'a task with work or material assignments cannot become a milestone; remove those assignments first (assignments to a COST resource may stay on a milestone)' };
      time.scheduleDuration = 0;
      time.durationUnit = 'days';
      time.clearDurationMinutes = true;
    }
    top.isMilestone = raw.isMilestone;
  }
  if ('milestoneKind' in raw) {
    const mk = raw.milestoneKind;
    if (mk === null) top.milestoneKind = undefined;
    else if (typeof mk === 'string' && (MILESTONE_KINDS as string[]).includes(mk)) top.milestoneKind = mk as MilestoneKind;
    else return { ok: false, reason: `\`milestoneKind\` must be ${MILESTONE_KINDS.join(' or ')} (or null to clear it)` };
  }
  if ('mandatory' in raw) {
    if (typeof raw.mandatory !== 'boolean') return { ok: false, reason: '`mandatory` must be a boolean' };
    top.mandatory = raw.mandatory;
  }
  if ('priority' in raw) {
    const p = raw.priority;
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 0 || p > 1000) {
      return { ok: false, reason: '`priority` must be an integer 0–1000 (500 = normal, 1000 = do not level)' };
    }
    top.priority = p;
  }
  if ('constraint' in raw) {
    let next: TaskConstraint | undefined;
    if (raw.constraint !== null) {
      const c = parseConstraint(raw.constraint);
      if (!c.ok) return { ok: false, reason: c.reason };
      next = c.value;
    }
    const pair = withPrimaryConstraint(next, ctx.currentConstraint2);
    const validation = validateConstraintPair(pair.constraint, pair.constraint2);
    if (!validation.ok) return { ok: false, reason: constraintPairReason(pair, validation.issues) };
    top.constraint = pair.constraint;
    if (ctx.currentConstraint2 && !pair.constraint2) top.constraint2 = undefined;
  }
  if ('deadline' in raw) {
    if (raw.deadline === null) top.deadline = undefined;
    else if (isIsoDate(raw.deadline)) top.deadline = raw.deadline;
    else return { ok: false, reason: '`deadline` must be an ISO date (YYYY-MM-DD) or null to clear it' };
  }
  let workRule: WorkRule | null | undefined;
  if ('workRule' in raw) {
    if (raw.workRule === null) workRule = null;
    else if (typeof raw.workRule === 'string' && (WORK_RULES as readonly string[]).includes(raw.workRule)) workRule = raw.workRule as WorkRule;
    else return { ok: false, reason: `\`workRule\` must be one of ${WORK_RULES.join(' | ')} (or null for the project default)` };
  }
  if ('calendarId' in raw) {
    if (raw.calendarId === null) top.calendarId = undefined;
    else if (typeof raw.calendarId !== 'string') return { ok: false, reason: '`calendarId` must be a string (or null for the project calendar)' };
    else if (!ctx.calendarExists(raw.calendarId)) {
      return { ok: false, reason: `unknown calendarId '${raw.calendarId}' (see planner_get_calendars)` };
    } else top.calendarId = raw.calendarId;
  }

  const hasTime = Object.keys(time).length > 0;
  return {
    ok: true,
    patch: {
      top,
      ...(hasTime ? { time } : {}),
      ...(customTaskType ? { customTaskType } : {}),
      ...(workRule !== undefined ? { workRule } : {}),
    },
  };
}

export const PROGRESS_FIELD_NAMES = ['completion', 'actualStart', 'actualFinish'] as const;

const PROGRESS_REJECT_HINTS: Record<string, string> = {
  percent: 'use `completion` (PERCENT 0–100)',
  percentage: 'use `completion` (PERCENT 0–100)',
  percentComplete: 'use `completion` (PERCENT 0–100)',
  percent_complete: 'use `completion` (PERCENT 0–100)',
  progress: 'use `completion` (PERCENT 0–100)',
  complete: 'use `completion` (PERCENT 0–100)',
  completed: 'use `completion` (PERCENT 0–100)',
  status: 'the status is DERIVED from `completion` and the actuals; it is not directly settable',
  start: 'use `actualStart` (ISO date)',
  finish: 'use `actualFinish` (ISO date)',
  end: 'use `actualFinish` (ISO date)',
  actual_start: 'use `actualStart` (ISO date)',
  actual_finish: 'use `actualFinish` (ISO date)',
  remaining: 'the remaining duration is derived from `completion`',
  remainingTime: 'the remaining duration is derived from `completion`',
};

export interface ProgressPatch {
  completion?: number;
  actualStart?: string;
  actualFinish?: string;
}

export type ProgressParseResult =
  | { ok: true; value: ProgressPatch }
  | { ok: false; reason: string };

export function parseProgress(raw: unknown): ProgressParseResult {
  if (!isRecord(raw)) return { ok: false, reason: '`progress` must be an object ({ completion?, actualStart?, actualFinish? })' };
  const keys = Object.keys(raw);
  const allowed = PROGRESS_FIELD_NAMES.join(', ');
  if (keys.length === 0) {
    return { ok: false, reason: `\`progress\` is empty; give at least one of: ${allowed}` };
  }
  for (const k of keys) {
    if (!(PROGRESS_FIELD_NAMES as readonly string[]).includes(k)) {
      const hint = PROGRESS_REJECT_HINTS[k];
      return {
        ok: false,
        reason: hint
          ? `unknown field '${k}' in \`progress\`: ${hint}. Allowed: ${allowed}`
          : `unknown field '${k}' in \`progress\`; allowed: ${allowed}`,
      };
    }
  }

  const value: ProgressPatch = {};
  if ('completion' in raw) {
    const c = raw.completion;
    if (typeof c !== 'number' || !Number.isFinite(c)) {
      return { ok: false, reason: '`progress.completion` must be a number (PERCENT 0–100)' };
    }
    value.completion = c;
  }
  for (const k of ['actualStart', 'actualFinish'] as const) {
    if (!(k in raw)) continue;
    const v = raw[k];
    if (v === null || v === undefined || v === '') {
      value[k] = undefined;
      continue;
    }
    if (!isIsoDate(v)) {
      return { ok: false, reason: `\`progress.${k}\` must be an ISO date (YYYY-MM-DD) or null to clear it` };
    }
    value[k] = v;
  }
  return { ok: true, value };
}

export const TASK_FIELD_SCHEMA_PROPERTIES: Record<string, unknown> = {
  name: { type: 'string' },
  description: { type: 'string' },
  duration: {
    type: 'number',
    minimum: 0,
    description:
      'In `durationUnit` (default days = working days on the task calendar; a fraction such as 2.5 is kept). ' +
      'FIXED_WORK tasks are stored in hours (days × hours per day). Milestone: 0 (more is refused). Summary task: ' +
      'derived, omit it.',
  },
  durationUnit: {
    type: 'string', enum: ['days', 'hours'],
    description: 'Always send it with `duration` (omitted = days). `hours` needs a task calendar with working hours.',
  },
  durationType: { type: 'string', enum: ['WORKTIME', 'ELAPSEDTIME'], description: 'Default WORKTIME; ELAPSEDTIME = calendar time (1 d = 24 h).' },
  taskType: {
    type: 'string',
    enum: TASK_TYPES,
    description: 'Work category (IFC PredefinedType), not the scheduling task type (`workRule`).',
  },
  customTaskType: {
    type: 'object',
    description: 'Own work category; sets taskType USERDEFINED. An existing id keeps its name.',
    properties: { id: { type: 'string' }, name: { type: 'string' } },
    required: ['id', 'name'], additionalProperties: false,
  },
  isMilestone: {
    type: 'boolean',
    description:
      'true sets duration 0 (not on a summary task or a task with work/material assignments; COST may stay); false keeps 0 until you send `duration`.',
  },
  milestoneKind: { type: ['string', 'null'], enum: ['START', 'FINISH', null], description: 'null = automatic.' },
  mandatory: { type: 'boolean', description: 'Reporting marker only.' },
  priority: { type: 'integer', minimum: 0, maximum: 1000, description: 'Leveling priority; default 500, 1000 = never shift.' },
  constraint: {
    type: ['object', 'null'],
    description: 'The only way to fix a date; null clears. `date` (ISO) is required except for ASAP/ALAP; `hard` (P6 Mandatory) only for ' +
      'MSO/MFO. null/ASAP/ALAP also clear a secondary constraint; a type that cannot pair with it is refused.',
    properties: {
      type: { type: 'string', enum: ['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'] },
      date: { type: 'string' },
      hard: { type: 'boolean' },
    },
    required: ['type'],
    additionalProperties: false,
  },
  deadline: { type: ['string', 'null'], description: 'Soft (ISO date); only bounds the late finish. null clears.' },
  calendarId: { type: ['string', 'null'], description: 'Library calendar (planner_get_calendars); null = project calendar.' },
  workRule: {
    type: ['string', 'null'],
    enum: [...WORK_RULES, null],
    description:
      'Task type: what stays fixed in work = remaining duration × units. ' +
      'FIXED_DURATION_RATE (default) = MSP Fixed Duration; FIXED_DURATION_WORK = P6 Fixed Duration & Units; ' +
      'FIXED_WORK = MSP Fixed Work, P6 Fixed Units; FIXED_RATE = MSP Fixed Units, P6 Fixed Units/Time. ' +
      'Switching changes no number; null = project default. No effect on milestones, summary, hammock or ' +
      'ELAPSEDTIME tasks.',
  },
};

export const TASK_FIELD_SCHEMA_PROPERTIES_BARE: Record<string, unknown> = withoutDescriptions(TASK_FIELD_SCHEMA_PROPERTIES);

function withoutDescriptions(value: unknown): Record<string, unknown> {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v === null || typeof v !== 'object') return v;
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k, x]) => !(k === 'description' && typeof x === 'string'))
        .map(([k, x]) => [k, strip(x)]),
    );
  };
  return strip(value) as Record<string, unknown>;
}

export const TASK_FIELDS_DOC =
  '`status`/`parentId`/`resourceIds`: use `progress`/planner_move_task/planner_manage_assignments.';
