/**
 * Grensvertaling tussen het interne domeinmodel (`src/types/`) en het publieke extensie-contract
 * (`extTypes.ts`). ALLE conversie tussen die twee werelden loopt hierdoorheen — nergens anders in de
 * extensie-laag mag een interne `Task`/`Project`/… rechtstreeks naar buiten of naar binnen.
 *
 * Twee richtingen:
 *   • `toExt*`   — interne (Immer-BEVROREN) store-objecten → VERSE, MUTEERBARE `Ext*`-kopieën.
 *                  Diep gekopieerd, zodat een extensie z'n kopie mag muteren zónder de store te raken.
 *   • `fromExt*` — `Ext*`-invoer van een extensie → interne vorm voor de store-acties / `loadState`.
 *
 * Elke mapper bouwt zijn resultaat VELD-VOOR-VELD met een expliciet return-type. Zo geldt:
 *   (a) voeg je een VERPLICHT `Ext*`-veld toe zonder het hier te mappen → compileerfout; voor
 *       OPTIONELE velden vangt de compiler dat niet (weglaten uit een object-literal is legaal) —
 *       die moet je bij een DTO-uitbreiding zelf in álle betrokken mappers nalopen (incl. de
 *       `fromExt*Input`/`fromExt*Updates`-paden, die per veld `if (x !== undefined)` doorgeven);
 *   (b) hernoem je een INTERN veld → dat duikt alléén hier op, nooit in extensie-code.
 */
import type { Project } from '@/types/project';
import type { WorkCalendar, Holiday, WorkTimeBands } from '@/types/calendar';
import type { Task, TaskTime, TaskConstraint, ExternalLink } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment, AvailabilityStep } from '@/types/resource';
import type { ImportResult } from '@/services/importTypes';
import type {
  ExtProject,
  ExtSchedulingOptions,
  ExtCalendar,
  ExtHoliday,
  ExtWorkTimeBands,
  ExtTask,
  ExtTaskTime,
  ExtTaskConstraint,
  ExtExternalLink,
  ExtTaskNote,
  ExtSequence,
  ExtResource,
  ExtAvailabilityStep,
  ExtAssignment,
  ExtImportResult,
} from './extTypes';

// ── Kleine helpers (diepe kopie van geneste, mogelijk bevroren, waarden) ──

/** `SchedulingOptions`/`ExtSchedulingOptions` zijn structureel gelijk; één helper dekt beide
 *  richtingen. De geneste `criticalDefinition`/`floatPaths` MOETEN mee-gekopieerd worden —
 *  een kale spread zou daar bevroren store-referenties doorgeven (reviewbevinding pakket N). */
function copySchedulingOptions<T extends ExtSchedulingOptions>(o: T): T {
  const copy = { ...o };
  if (copy.criticalDefinition) copy.criticalDefinition = { ...copy.criticalDefinition };
  if (copy.floatPaths) copy.floatPaths = { ...copy.floatPaths };
  return copy;
}

function copyConstraint(c: TaskConstraint): ExtTaskConstraint {
  return { type: c.type, date: c.date, hard: c.hard };
}
function toIntConstraint(c: ExtTaskConstraint): TaskConstraint {
  return { type: c.type, date: c.date, hard: c.hard };
}

function copyExternalLink(l: ExternalLink): ExtExternalLink {
  return {
    id: l.id,
    direction: l.direction,
    relType: l.relType,
    lagDays: l.lagDays,
    lagMinutes: l.lagMinutes,
    anchorDate: l.anchorDate,
    sourceRef: { ...l.sourceRef },
    sourceMissing: l.sourceMissing,
  };
}
function toIntExternalLink(l: ExtExternalLink): ExternalLink {
  return {
    id: l.id,
    direction: l.direction,
    relType: l.relType,
    lagDays: l.lagDays,
    lagMinutes: l.lagMinutes,
    anchorDate: l.anchorDate,
    sourceRef: { ...l.sourceRef },
    sourceMissing: l.sourceMissing,
  };
}

function copyNote(n: { id: string; text: string; done: boolean }): ExtTaskNote {
  return { id: n.id, text: n.text, done: n.done };
}

function copyWorkTime(w: WorkTimeBands): ExtWorkTimeBands {
  const src = w.byWeekday;
  return {
    byWeekday: {
      1: src[1].map((b) => ({ start: b.start, end: b.end })),
      2: src[2].map((b) => ({ start: b.start, end: b.end })),
      3: src[3].map((b) => ({ start: b.start, end: b.end })),
      4: src[4].map((b) => ({ start: b.start, end: b.end })),
      5: src[5].map((b) => ({ start: b.start, end: b.end })),
      6: src[6].map((b) => ({ start: b.start, end: b.end })),
      7: src[7].map((b) => ({ start: b.start, end: b.end })),
    },
  };
}
function toIntWorkTime(w: ExtWorkTimeBands): WorkTimeBands {
  const src = w.byWeekday;
  return {
    byWeekday: {
      1: src[1].map((b) => ({ start: b.start, end: b.end })),
      2: src[2].map((b) => ({ start: b.start, end: b.end })),
      3: src[3].map((b) => ({ start: b.start, end: b.end })),
      4: src[4].map((b) => ({ start: b.start, end: b.end })),
      5: src[5].map((b) => ({ start: b.start, end: b.end })),
      6: src[6].map((b) => ({ start: b.start, end: b.end })),
      7: src[7].map((b) => ({ start: b.start, end: b.end })),
    },
  };
}

function copyHoliday(h: Holiday): ExtHoliday {
  return { name: h.name, startDate: h.startDate, endDate: h.endDate };
}
function toIntHoliday(h: ExtHoliday): Holiday {
  return { name: h.name, startDate: h.startDate, endDate: h.endDate };
}

function copyAvailStep(s: AvailabilityStep): ExtAvailabilityStep {
  return { from: s.from, maxUnits: s.maxUnits };
}
function toIntAvailStep(s: ExtAvailabilityStep): AvailabilityStep {
  return { from: s.from, maxUnits: s.maxUnits };
}

// ── Project ──

export function toExtProject(p: Project): ExtProject {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    startDate: p.startDate,
    endDate: p.endDate,
    calendarId: p.calendarId,
    createdAt: p.createdAt,
    modifiedAt: p.modifiedAt,
    author: p.author,
    company: p.company,
    wbsAutoNumber: p.wbsAutoNumber,
    statusDate: p.statusDate,
    progressMode: p.progressMode,
    schedulingOptions: p.schedulingOptions ? copySchedulingOptions(p.schedulingOptions) : undefined,
  };
}

export function fromExtProject(p: ExtProject): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    startDate: p.startDate,
    endDate: p.endDate,
    calendarId: p.calendarId,
    createdAt: p.createdAt,
    modifiedAt: p.modifiedAt,
    author: p.author,
    company: p.company,
    wbsAutoNumber: p.wbsAutoNumber,
    statusDate: p.statusDate,
    progressMode: p.progressMode,
    schedulingOptions: p.schedulingOptions ? copySchedulingOptions(p.schedulingOptions) : undefined,
  };
}

// ── Kalender ──

export function toExtCalendar(c: WorkCalendar): ExtCalendar {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    workDays: [...c.workDays],
    workStartHour: c.workStartHour,
    workEndHour: c.workEndHour,
    hoursPerDay: c.hoursPerDay,
    holidays: c.holidays.map(copyHoliday),
    workTime: c.workTime ? copyWorkTime(c.workTime) : undefined,
    shift: c.shift,
  };
}

export function fromExtCalendar(c: ExtCalendar): WorkCalendar {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    workDays: [...c.workDays],
    workStartHour: c.workStartHour,
    workEndHour: c.workEndHour,
    hoursPerDay: c.hoursPerDay,
    holidays: c.holidays.map(toIntHoliday),
    workTime: c.workTime ? toIntWorkTime(c.workTime) : undefined,
    shift: c.shift,
  };
}

// ── Taaktijd ──

export function toExtTaskTime(tt: TaskTime): ExtTaskTime {
  return {
    durationType: tt.durationType,
    scheduleDuration: tt.scheduleDuration,
    durationMinutes: tt.durationMinutes,
    scheduleStart: tt.scheduleStart,
    scheduleFinish: tt.scheduleFinish,
    earlyStart: tt.earlyStart,
    earlyFinish: tt.earlyFinish,
    lateStart: tt.lateStart,
    lateFinish: tt.lateFinish,
    freeFloat: tt.freeFloat,
    totalFloat: tt.totalFloat,
    isCritical: tt.isCritical,
    interferingFloat: tt.interferingFloat,
    isNearCritical: tt.isNearCritical,
    floatPath: tt.floatPath,
    actualStart: tt.actualStart,
    actualFinish: tt.actualFinish,
    actualDuration: tt.actualDuration,
    remainingTime: tt.remainingTime,
    remainingMinutes: tt.remainingMinutes,
    completion: tt.completion,
  };
}

export function fromExtTaskTime(tt: ExtTaskTime): TaskTime {
  return {
    durationType: tt.durationType,
    scheduleDuration: tt.scheduleDuration,
    durationMinutes: tt.durationMinutes,
    scheduleStart: tt.scheduleStart,
    scheduleFinish: tt.scheduleFinish,
    earlyStart: tt.earlyStart,
    earlyFinish: tt.earlyFinish,
    lateStart: tt.lateStart,
    lateFinish: tt.lateFinish,
    freeFloat: tt.freeFloat,
    totalFloat: tt.totalFloat,
    isCritical: tt.isCritical,
    interferingFloat: tt.interferingFloat,
    isNearCritical: tt.isNearCritical,
    floatPath: tt.floatPath,
    actualStart: tt.actualStart,
    actualFinish: tt.actualFinish,
    actualDuration: tt.actualDuration,
    remainingTime: tt.remainingTime,
    remainingMinutes: tt.remainingMinutes,
    completion: tt.completion,
  };
}

// ── Taak ──

export function toExtTask(t: Task): ExtTask {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    wbsCode: t.wbsCode,
    taskType: t.taskType,
    status: t.status,
    isMilestone: t.isMilestone,
    milestoneKind: t.milestoneKind,
    mandatory: t.mandatory,
    priority: t.priority,
    levelingDelay: t.levelingDelay,
    parentId: t.parentId,
    childIds: [...t.childIds],
    time: toExtTaskTime(t.time),
    resourceIds: [...t.resourceIds],
    color: t.color,
    activityCodes: t.activityCodes ? { ...t.activityCodes } : undefined,
    customFields: t.customFields ? { ...t.customFields } : undefined,
    constraint: t.constraint ? copyConstraint(t.constraint) : undefined,
    constraint2: t.constraint2 ? copyConstraint(t.constraint2) : undefined,
    isHammock: t.isHammock,
    externalLinks: t.externalLinks ? t.externalLinks.map(copyExternalLink) : undefined,
    deadline: t.deadline,
    calendarId: t.calendarId,
    notes: t.notes ? t.notes.map(copyNote) : undefined,
  };
}

/** Volledige Ext→intern taakvertaling (bv. binnen een geladen project). */
export function fromExtTask(t: ExtTask): Task {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    wbsCode: t.wbsCode,
    taskType: t.taskType,
    status: t.status,
    isMilestone: t.isMilestone,
    milestoneKind: t.milestoneKind,
    mandatory: t.mandatory,
    priority: t.priority,
    levelingDelay: t.levelingDelay,
    parentId: t.parentId,
    childIds: [...t.childIds],
    time: fromExtTaskTime(t.time),
    resourceIds: [...t.resourceIds],
    color: t.color,
    activityCodes: t.activityCodes ? { ...t.activityCodes } : undefined,
    customFields: t.customFields ? { ...t.customFields } : undefined,
    constraint: t.constraint ? toIntConstraint(t.constraint) : undefined,
    constraint2: t.constraint2 ? toIntConstraint(t.constraint2) : undefined,
    isHammock: t.isHammock,
    externalLinks: t.externalLinks ? t.externalLinks.map(toIntExternalLink) : undefined,
    deadline: t.deadline,
    calendarId: t.calendarId,
    notes: t.notes ? t.notes.map(copyNote) : undefined,
  };
}

/**
 * Ext-taakINVOER voor `api.data.addTask` → interne invoer voor de store-actie. Alleen de door de
 * extensie gezette velden worden doorgegeven; de store-actie vult zelf de defaults aan. `name` is
 * verplicht (zoals de store-actie eist); `time` wordt naar interne vorm gemapt indien meegegeven.
 */
export function fromExtTaskInput(
  input: Partial<ExtTask> & { name: string },
): Partial<Task> & { name: string } {
  const out: Partial<Task> & { name: string } = { name: input.name };
  if (input.id !== undefined) out.id = input.id;
  if (input.description !== undefined) out.description = input.description;
  if (input.wbsCode !== undefined) out.wbsCode = input.wbsCode;
  if (input.taskType !== undefined) out.taskType = input.taskType;
  if (input.status !== undefined) out.status = input.status;
  if (input.isMilestone !== undefined) out.isMilestone = input.isMilestone;
  if (input.milestoneKind !== undefined) out.milestoneKind = input.milestoneKind;
  if (input.mandatory !== undefined) out.mandatory = input.mandatory;
  if (input.priority !== undefined) out.priority = input.priority;
  if (input.levelingDelay !== undefined) out.levelingDelay = input.levelingDelay;
  if (input.parentId !== undefined) out.parentId = input.parentId;
  if (input.childIds !== undefined) out.childIds = [...input.childIds];
  if (input.time !== undefined) out.time = fromExtTaskTime(input.time);
  if (input.resourceIds !== undefined) out.resourceIds = [...input.resourceIds];
  if (input.color !== undefined) out.color = input.color;
  if (input.activityCodes !== undefined) out.activityCodes = { ...input.activityCodes };
  if (input.customFields !== undefined) out.customFields = { ...input.customFields };
  if (input.constraint !== undefined) out.constraint = toIntConstraint(input.constraint);
  if (input.constraint2 !== undefined) out.constraint2 = toIntConstraint(input.constraint2);
  if (input.isHammock !== undefined) out.isHammock = input.isHammock;
  if (input.externalLinks !== undefined) out.externalLinks = input.externalLinks.map(toIntExternalLink);
  if (input.deadline !== undefined) out.deadline = input.deadline;
  if (input.calendarId !== undefined) out.calendarId = input.calendarId;
  if (input.notes !== undefined) out.notes = input.notes.map(copyNote);
  return out;
}

/** Ext-taakWIJZIGINGEN voor `api.data.updateTask` → interne `Partial<Task>`. */
export function fromExtTaskUpdates(updates: Partial<ExtTask>): Partial<Task> {
  const out: Partial<Task> = {};
  if (updates.name !== undefined) out.name = updates.name;
  if (updates.description !== undefined) out.description = updates.description;
  if (updates.wbsCode !== undefined) out.wbsCode = updates.wbsCode;
  if (updates.taskType !== undefined) out.taskType = updates.taskType;
  if (updates.status !== undefined) out.status = updates.status;
  if (updates.isMilestone !== undefined) out.isMilestone = updates.isMilestone;
  if (updates.milestoneKind !== undefined) out.milestoneKind = updates.milestoneKind;
  if (updates.mandatory !== undefined) out.mandatory = updates.mandatory;
  if (updates.priority !== undefined) out.priority = updates.priority;
  if (updates.levelingDelay !== undefined) out.levelingDelay = updates.levelingDelay;
  if (updates.parentId !== undefined) out.parentId = updates.parentId;
  if (updates.childIds !== undefined) out.childIds = [...updates.childIds];
  if (updates.time !== undefined) out.time = fromExtTaskTime(updates.time);
  if (updates.resourceIds !== undefined) out.resourceIds = [...updates.resourceIds];
  if (updates.color !== undefined) out.color = updates.color;
  if (updates.activityCodes !== undefined) out.activityCodes = { ...updates.activityCodes };
  if (updates.customFields !== undefined) out.customFields = { ...updates.customFields };
  if (updates.constraint !== undefined) out.constraint = toIntConstraint(updates.constraint);
  if (updates.constraint2 !== undefined) out.constraint2 = toIntConstraint(updates.constraint2);
  if (updates.isHammock !== undefined) out.isHammock = updates.isHammock;
  if (updates.externalLinks !== undefined) out.externalLinks = updates.externalLinks.map(toIntExternalLink);
  if (updates.deadline !== undefined) out.deadline = updates.deadline;
  if (updates.calendarId !== undefined) out.calendarId = updates.calendarId;
  if (updates.notes !== undefined) out.notes = updates.notes.map(copyNote);
  return out;
}

// ── Relatie ──

export function toExtSequence(s: Sequence): ExtSequence {
  return {
    id: s.id,
    predecessorId: s.predecessorId,
    successorId: s.successorId,
    type: s.type,
    lagDays: s.lagDays,
    lagMinutes: s.lagMinutes,
    lagUnit: s.lagUnit,
    lagPercent: s.lagPercent,
  };
}

export function fromExtSequence(s: ExtSequence): Sequence {
  return {
    id: s.id,
    predecessorId: s.predecessorId,
    successorId: s.successorId,
    type: s.type,
    lagDays: s.lagDays,
    lagMinutes: s.lagMinutes,
    lagUnit: s.lagUnit,
    lagPercent: s.lagPercent,
  };
}

/** Ext-relatieINVOER voor `api.data.addSequence` (zonder id) → interne invoer. */
export function fromExtSequenceInput(seq: Omit<ExtSequence, 'id'>): Omit<Sequence, 'id'> {
  return {
    predecessorId: seq.predecessorId,
    successorId: seq.successorId,
    type: seq.type,
    lagDays: seq.lagDays,
    lagMinutes: seq.lagMinutes,
    lagUnit: seq.lagUnit,
    lagPercent: seq.lagPercent,
  };
}

// ── Resource + toewijzing ──

export function toExtResource(r: Resource): ExtResource {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
    costPerHour: r.costPerHour,
    maxUnits: r.maxUnits,
    calendarId: r.calendarId,
    availabilitySteps: r.availabilitySteps ? r.availabilitySteps.map(copyAvailStep) : undefined,
    unitOfMeasure: r.unitOfMeasure,
    parentId: r.parentId,
  };
}

export function fromExtResource(r: ExtResource): Resource {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
    costPerHour: r.costPerHour,
    maxUnits: r.maxUnits,
    calendarId: r.calendarId,
    availabilitySteps: r.availabilitySteps ? r.availabilitySteps.map(toIntAvailStep) : undefined,
    unitOfMeasure: r.unitOfMeasure,
    parentId: r.parentId,
  };
}

export function toExtAssignment(a: ResourceAssignment): ExtAssignment {
  return {
    id: a.id,
    taskId: a.taskId,
    resourceId: a.resourceId,
    unitsPerDay: a.unitsPerDay,
    curve: a.curve,
  };
}

export function fromExtAssignment(a: ExtAssignment): ResourceAssignment {
  return {
    id: a.id,
    taskId: a.taskId,
    resourceId: a.resourceId,
    unitsPerDay: a.unitsPerDay,
    curve: a.curve,
  };
}

// ── Importresultaat ──

/**
 * Ext-importresultaat → interne `ImportResult` (de vorm die `loadState`/de open-paden verwachten).
 * De rijkere optionele velden (resourceCalendars, activityCodeTypes, …) zet een extensie niet; die
 * blijven `undefined` en de store valt terug op zijn defaults.
 */
export function fromExtImportResult(r: ExtImportResult): ImportResult {
  return {
    project: fromExtProject(r.project),
    calendar: fromExtCalendar(r.calendar),
    tasks: r.tasks.map(fromExtTask),
    sequences: r.sequences.map(fromExtSequence),
    resources: r.resources.map(fromExtResource),
    assignments: r.assignments.map(fromExtAssignment),
  };
}
