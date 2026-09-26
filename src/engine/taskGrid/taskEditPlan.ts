import { WORK_RULES, type WorkRule } from '@/types/workRule';
import { carryRemainingThroughDurationEdit } from '@/engine/work/workRuleApply';
import { validateConstraintPair, withPrimaryConstraint } from '@/engine/scheduler/constraintValidation';
import { milestoneRefusal, taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { decodeDynamicTaskColumnId } from '@/engine/taskGrid/fieldIds';
import {
  applyCompletionEdit,
  applyProgressInvariants,
  defaultActualStart,
  assignTaskActivityCode,
  assignTaskCustomField,
  fillMissingActualStart,
  isActualPastStatusDate,
} from '@/engine/taskMutationRules';
import type { ActivityCodeType, CustomFieldDef, CustomFieldValue } from '@/types/structure';
import type {
  ConstraintType,
  MilestoneKind,
  Task,
  TaskConstraint,
  TaskDurationUnit,
  TaskStatus,
  TaskTime,
  TaskType,
} from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type {
  CellEditIntent,
  CellValidationError,
  GridResult,
} from '@/types/taskGrid';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import {
  proposeTaskDurationConversion,
  type ParsedTaskDuration,
} from '@/utils/taskDurationInput';
import {
  applyDurationChangeRules,
  clearTimephasedDurationWalks,
  clearTimephasedWindow,
  clearLevelingGaps,
  taskTriggerChanges,
  timephasedDurationWalksHaveFrozenWork,
  type TaskTriggerFields,
  hourInputFinishBasis,
  reconcileHourInputFinish,
} from '@/utils/taskDefaults';
import { sameValue } from '@/utils/sameValue';
import { taskWorkMinutes } from '@/engine/contour/contourEngine';
import { shownFinish, shownStart, startAnchorAfterEdit } from '@/utils/taskDates';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { isPinnedComplete, isZeroDurationMilestone } from '@/engine/scheduler/duration';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { isFiniteNumber } from '@/utils/guards';
import { isManuallyScheduled } from '@/utils/manualScheduling';
import {
  constraintBlockingStart,
  startConstraintAfterEdit,
  type StartConstraintChange,
} from '@/engine/startEditConstraint';

const TASK_TYPES: readonly TaskType[] = [
  'CONSTRUCTION', 'INSTALLATION', 'DEMOLITION', 'LOGISTIC', 'ATTENDANCE',
  'MOVE', 'RENOVATION', 'MAINTENANCE', 'USERDEFINED',
];
const TASK_STATUSES: readonly TaskStatus[] = ['NOT_STARTED', 'STARTED', 'COMPLETED'];
const MILESTONE_KINDS: readonly MilestoneKind[] = ['START', 'FINISH'];
const CONSTRAINT_TYPES: readonly ConstraintType[] = [
  'ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO',
];

export interface TaskEditPlanEnvironment {
  projectId: string;
  wbsAutoNumber: boolean;
  statusDate?: string;
  calendarIds: ReadonlySet<string>;
  effectiveHoursPerDay: number;
  hourMode: boolean;
  effectiveCalendar?: WorkCalendar;
  /** De kalender waarin een taak met dit `calendarId` rekent (leeg ⇒ projectkalender). */
  calendarFor?: (calendarId: string | undefined) => WorkCalendar;
  enableHourPlanning?: boolean;
  customTaskTypeIds?: ReadonlySet<string>;
  activityCodeTypes: readonly ActivityCodeType[];
  customFieldDefs: readonly CustomFieldDef[];
  /** Taaktypes-etappe (2026-09): werkbehoud bij het herschalen van een contour, afgeleid van de
   *  effectieve werkregel (`utils/taskDefaults.ts`'s `contourKeepsWork`). Afwezig ⇒ de oude
   *  MSP-afleiding in `rescaleTaskContours`. */
  contourKeepsWork?: boolean;
  /** Wordt de start van DEZE taak door een voorganger bepaald (`predecessorDrivenTaskIds`)? Alleen
   *  nodig voor een getypte start (kolommen Start/Geplande start); afwezig ⇒ nee. Een getypte start
   *  wordt dan een beperking "Start niet eerder dan" (`startConstraintAfterEdit`). */
  startDrivenByPredecessor?: boolean;
}

export interface PlannedTaskEdit {
  task: Task;
  changed: boolean;
  timephasedGuidanceLost: boolean;
  scheduleStale: boolean;
  /** Zette of verzette een getypte start de beperking "Start niet eerder dan"? Afwezig ⇒ nee. De
   *  transactie meldt het (`startEditNotifications`). */
  startConstraint?: StartConstraintChange;
  /** Hield een andere constraint een getypte start tegen (`constraintBlockingStart`)? Dan is de start
   *  niet toegepast en meldt de transactie deze constraint. */
  startBlocked?: TaskConstraint;
}

/** Bijeffecten van één celwrite die de aanroeper moet kunnen melden. */
interface CellEditEffects {
  /** De getypte start zette of verzette de beperking "Start niet eerder dan". */
  startConstraint: boolean;
  /** Deze constraint hield de getypte start tegen; de start is niet toegepast. */
  startBlocked?: TaskConstraint;
}

function failure(
  code: string,
  edit: CellEditIntent,
  value: unknown = edit.value,
): GridResult<never, readonly CellValidationError[]> {
  return {
    ok: false,
    errors: [{
      code,
      messageKey: `taskGrid.validation.${code}`,
      taskId: edit.taskId,
      columnId: edit.columnId,
      value,
    }],
  };
}

function cloneTaskForEdit(task: Task): Task {
  return {
    ...task,
    time: { ...task.time },
    activityCodes: task.activityCodes ? { ...task.activityCodes } : undefined,
    customFields: task.customFields ? { ...task.customFields } : undefined,
    notes: task.notes ? task.notes.map(note => ({ ...note })) : undefined,
    constraint: task.constraint ? { ...task.constraint } : undefined,
    constraint2: task.constraint2 ? { ...task.constraint2 } : undefined,
  };
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function optionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}

function expectedRoute(columnId: string): CellEditIntent['route'] | null {
  if (columnId.startsWith('activity-code:')) return 'activity-code';
  if (columnId.startsWith('custom-field:')) return 'custom-field';
  if (columnId === 'task.status' || columnId.startsWith('task.time.actual')
    || columnId === 'task.time.remainingTime' || columnId === 'task.time.completion') {
    return 'task-progress';
  }
  if (columnId === 'task.isMilestone' || columnId === 'task.milestoneKind'
    || columnId === 'task.mandatory') return 'task-milestone';
  if (columnId.startsWith('task.constraint') || columnId === 'task.deadline') return 'task-constraint';
  if (columnId === 'task.isHammock') return 'task-hammock';
  if (columnId === 'task.calendarId' || columnId.startsWith('task.time.schedule')
    || columnId === 'task.time.start' || columnId === 'task.time.finish'
    || columnId === 'task.time.durationType' || columnId === 'task.time.durationUnit') return 'task-schedule';
  if (columnId === 'task.name' || columnId === 'task.description' || columnId === 'task.wbsCode'
    || columnId === 'task.taskType' || columnId === 'task.customTaskTypeId'
    || columnId === 'task.priority' || columnId === 'task.color'
    || columnId === 'task.notes' || columnId === 'task.workRule') {
    return 'task-field';
  }
  return null;
}

/** Een duurwijziging in het raster (duur-, eenheid-, mijlpaal- en Eindecel): dezelfde gevolgregels
 *  als `taskSlice.updateTask` en de MCP-draft, zie `applyDurationChangeRules` in taskDefaults.ts
 *  (de kern van `settleDurationAftermath`, workRuleApply.ts). `before` is een kopie van de tijd die
 *  de aanroeper vóór de mutatie vastlegde; gemeten met dezelfde uren-per-dag. Het raster meet met
 *  `environment.effectiveHoursPerDay` (bij een urenkalender de afgeleide bandsom); het ingevoerde
 *  einde van een urentaak herleidt `applyOneCellEdit` aan het eind (`reconcileGridInputFinish`).
 *  Een lopende taak houdt haar gedane werk (`carryRemainingThroughDurationEdit`, eigenaarsbesluit
 *  2026-09-26); een nieuwe duur korter dan dat werk is een celfout (`durationBelowDoneWork`). */
function finishDurationEdit(
  task: Task,
  before: TaskTime,
  environment: TaskEditPlanEnvironment,
  edit: CellEditIntent,
): GridResult<boolean, readonly CellValidationError[]> {
  const hoursPerDay = environment.effectiveHoursPerDay;
  const usableHours = Number.isFinite(hoursPerDay) && hoursPerDay > 0;
  const oldWorkMinutes = taskWorkMinutes(before, hoursPerDay);
  // Eigenaarsbesluiten 2026-09-05/26: de rest schuift mee met de duurwijziging, het percentage volgt;
  // korter dan het gedane werk wordt geweigerd.
  if (usableHours && carryRemainingThroughDurationEdit(task, before, hoursPerDay, environment.statusDate)?.refused) {
    return failure('durationBelowDoneWork', edit);
  }
  return {
    ok: true,
    value: applyDurationChangeRules(task, oldWorkMinutes, hoursPerDay, {
      // Eigen afwijking van het raster: de contour alleen herschalen bij een bruikbare uren-per-dag
      // (store en MCP roepen de herschaling onvoorwaardelijk aan).
      rescaleContours: usableHours,
      keepWork: environment.contourKeepsWork,
    }),
  };
}

/**
 * B1c-plan-2 spec §4 "Invalidatie", bedraad in de fixronde op etappe 3 (bevinding B7). De ROUTES
 * waarvan een celwrite de tijdbasis van de taak verzet — en dus een door de nivelleerder ingevoegde
 * pauzedag ongeldig maakt. Dit is de gridtegenhanger van `taskTriggerChanges(...).levelingGaps`
 * (taskDefaults.ts); het grid schrijft niet via `updateTask`, dus het heeft een eigen poort nodig.
 * Net als daar vuurt hij alleen bij een echte waardewijziging (zie `applyOneCellEdit`).
 *
 * Bewust NIET compleet gelijk aan de `scheduleStale`-lijst in `applyOneCellEdit`: `task.priority` zit
 * daar wél in (nivelleren gebruikt prioriteit als invoer) maar verzet geen enkele datum van de taak
 * zelf, dus een bestaand gat blijft daar geldig.
 */
const LEVELING_GAP_ROUTES: ReadonlySet<CellEditIntent['route']> = new Set([
  'task-schedule', 'task-progress', 'task-milestone', 'task-constraint', 'task-hammock',
]);

/** B1-vervolg (critreview 24-09): de solve schrijft `scheduleFinish` niet meer terug, dus de
 *  gridbewerking houdt het ingevoerde einde van een niet-gestarte urentaak zelf coherent — dezelfde
 *  regel als `taskSlice.updateTask`, zie `reconcileHourInputFinish` (taskDefaults.ts). `calendarFor`
 *  levert de kalender NA de bewerking (een kalenderkolom-edit verandert die); zonder valt hij terug op
 *  de effectieve kalender van vóór de bewerking. */
function reconcileGridInputFinish(before: Task, next: Task, environment: TaskEditPlanEnvironment): void {
  const calendar = environment.calendarFor?.(next.calendarId) ?? environment.effectiveCalendar;
  if (calendar) reconcileHourInputFinish(next, hourInputFinishBasis(before), calendar);
}

function clearScheduleGuidance(task: Task, clearFrozenWalks: boolean): boolean {
  const clearedWindow = clearTimephasedWindow(task);
  const clearedWalks = clearFrozenWalks && timephasedDurationWalksHaveFrozenWork(task)
    ? clearTimephasedDurationWalks(task)
    : false;
  return clearedWindow || clearedWalks;
}

function applyTaskField(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
): GridResult<void, readonly CellValidationError[]> {
  const id = String(edit.columnId);
  if (id === 'task.name') {
    if (typeof edit.value !== 'string' || !edit.value.trim()) return failure('required', edit);
    task.name = edit.value;
  } else if (id === 'task.description') {
    if (typeof edit.value !== 'string') return failure('text', edit);
    task.description = edit.value;
  } else if (id === 'task.wbsCode') {
    if (environment.wbsAutoNumber) return failure('readOnly', edit);
    if (typeof edit.value !== 'string' || !edit.value.trim()) return failure('required', edit);
    task.wbsCode = edit.value;
  } else if (id === 'task.taskType') {
    if (typeof edit.value !== 'string' || !TASK_TYPES.includes(edit.value as TaskType)) {
      return failure('enum', edit);
    }
    task.taskType = edit.value as TaskType;
    if (task.taskType !== 'USERDEFINED') task.customTaskTypeId = undefined;
  } else if (id === 'task.customTaskTypeId') {
    if (!optionalString(edit.value)) return failure('enum', edit);
    if (edit.value !== undefined && !environment.customTaskTypeIds?.has(edit.value)) {
      return failure('enum', edit);
    }
    task.customTaskTypeId = edit.value;
    if (edit.value !== undefined) task.taskType = 'USERDEFINED';
  } else if (id === 'task.priority') {
    if (!isFiniteNumber(edit.value) || !Number.isInteger(edit.value) || edit.value < 0 || edit.value > 1000) {
      return failure('range', edit);
    }
    task.priority = edit.value;
  } else if (id === 'task.color') {
    if (!optionalString(edit.value)) return failure('color', edit);
    task.color = edit.value;
  } else if (id === 'task.workRule') {
    // Taaktypes-etappe (spec §7): het VELD; de driehoekstap (restwerk vastleggen onder een
    // werkbeschermende regel) doet `gridTransaction.ts` ná het plan, met de toewijzingen erbij.
    if (edit.value === undefined || edit.value === '') delete task.workRule;
    else if (typeof edit.value === 'string' && (WORK_RULES as readonly string[]).includes(edit.value)) task.workRule = edit.value as WorkRule;
    else return failure('enum', edit);
  } else if (id === 'task.notes') {
    if (typeof edit.value !== 'string') return failure('text', edit);
    if ((task.notes?.length ?? 0) > 1) return failure('readOnly', edit);
    if (task.notes?.[0]) task.notes[0].text = edit.value;
    else if (edit.value !== '') {
      task.notes = [{ id: `grid-note:${task.id}`, text: edit.value, done: false }];
    }
  } else {
    return failure('plannerNotAvailable', edit);
  }
  return { ok: true, value: undefined };
}

/** Zet een expliciete duur (dagen of werkminuten) met alle bijeffecten van een duurwijziging —
 *  de ene weg voor de Duur-kolom en voor een nieuw Einde van een automatisch geplande taak. */
function applyParsedDuration(
  task: Task,
  parsed: ParsedTaskDuration,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
  timeBefore: TaskTime,
): GridResult<boolean, readonly CellValidationError[]> {
  // Deze functie schrijft de drie duurvelden altijd; of dat een duurWIJZIGING is, beslist dezelfde
  // waardevergelijking als store en MCP (`taskTriggerChanges`, #186).
  const before: TaskTriggerFields = { ...task, time: { ...task.time } };
  if (parsed.unit === 'hours') {
    if (environment.enableHourPlanning !== true) return failure('hourPlanningDisabled', edit);
    if (!isFiniteNumber(parsed.durationMinutes) || parsed.durationMinutes < 0) return failure('duration', edit);
    if (!Number.isFinite(environment.effectiveHoursPerDay) || environment.effectiveHoursPerDay <= 0) {
      return failure('calendarHours', edit);
    }
    task.time.durationUnit = 'hours';
    task.time.durationMinutes = parsed.durationMinutes;
    task.time.scheduleDuration = parsed.durationMinutes / (environment.effectiveHoursPerDay * 60);
  } else {
    if (!isFiniteNumber(parsed.scheduleDuration) || !Number.isInteger(parsed.scheduleDuration)
      || parsed.scheduleDuration < 0) return failure('duration', edit);
    task.time.durationUnit = 'days';
    task.time.scheduleDuration = parsed.scheduleDuration;
    task.time.durationMinutes = undefined;
  }
  if (!taskTriggerChanges(before, task).timeBase) return { ok: true, value: false };
  return finishDurationEdit(task, timeBefore, environment, edit);
}

/**
 * De duur waarmee een automatisch geplande taak op `finish` eindigt, gerekend vanaf de GETOONDE
 * start: de omkering van `CPMSolver.addDuration`, dezelfde telling als de rechterrand-sleep in de
 * Gantt (`useBarDrag`). Dagtaak: inclusieve werkdagen (`workDaysBetween`, minimaal één). Urentaak:
 * werkminuten in de effectieve uurbanden van de taakkalender (`calendarForEngine`, zoals de solver).
 * De eenheid van de taak blijft wat hij was.
 */
function durationForShownFinish(
  task: Task,
  finish: string,
  calendar: WorkCalendar,
): { ok: true; value: ParsedTaskDuration } | { ok: false; code: string } {
  if (task.time.durationUnit === 'hours') {
    const engine = new CalendarEngine(calendarForEngine(calendar));
    if (!engine.isHourMode) return { ok: false, code: 'calendarHours' };
    const start = parseInstant(shownStart(task));
    const end = parseInstant(finish);
    if (!(end.getTime() > start.getTime())) return { ok: false, code: 'finishBeforeStart' };
    return { ok: true, value: { unit: 'hours', durationMinutes: engine.workMinutesBetween(start, end), explicitUnit: true } };
  }
  const start = parseDate(shownStart(task).slice(0, 10));
  const end = parseDate(finish.slice(0, 10));
  if (!(end.getTime() >= start.getTime())) return { ok: false, code: 'finishBeforeStart' };
  const days = new CalendarEngine(calendar).workDaysBetween(start, end);
  return { ok: true, value: { unit: 'days', scheduleDuration: Math.max(1, days), explicitUnit: true } };
}

/**
 * Een getypte start (Tabel-kolom Start of Geplande start): het nieuwe anker, en op een taak waarvan
 * een voorganger de start bepaalt de beperking "Start niet eerder dan" (`startConstraintAfterEdit`,
 * dezelfde regel als paneel, Taak bewerken en Gantt-sleep). Zonder die beperking sprong de taak na F5
 * stil terug achter haar voorganger: de solver leest het anker alleen voor een taak zónder voorganger.
 * Houdt een andere constraint de start tegen (`constraintBlockingStart`), dan verandert er niets —
 * ook geen dood anker — en meldt de transactie die constraint.
 */
function applyTypedStart(
  task: Task,
  start: string,
  environment: TaskEditPlanEnvironment,
  effects: CellEditEffects,
): boolean {
  const driven = environment.startDrivenByPredecessor === true;
  const blocking = constraintBlockingStart(task, driven);
  if (blocking) {
    effects.startBlocked = blocking;
    return false;
  }
  let lost = false;
  if (task.time.scheduleStart !== start) {
    task.time.scheduleStart = start;
    lost = clearScheduleGuidance(task, true);
  }
  const snet = startConstraintAfterEdit(task, start, driven);
  if (snet) {
    task.constraint = snet.constraint;
    effects.startConstraint = true;
  }
  return lost;
}

function applyScheduleEdit(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
  effects: CellEditEffects,
): GridResult<boolean, readonly CellValidationError[]> {
  const id = String(edit.columnId);
  let lost = false;
  const timeBefore: TaskTime = { ...task.time };
  if (id === 'task.time.durationType') {
    if (edit.value !== 'WORKTIME' && edit.value !== 'ELAPSEDTIME') return failure('enum', edit);
    if (task.time.durationType !== edit.value) {
      task.time.durationType = edit.value;
      lost = clearScheduleGuidance(task, true);
    }
  } else if (id === 'task.time.durationUnit') {
    if (edit.value !== 'days' && edit.value !== 'hours') return failure('enum', edit);
    const target = edit.value as TaskDurationUnit;
    if (target === task.time.durationUnit) return { ok: true, value: false };
    if (target === 'hours' && environment.enableHourPlanning !== true) {
      return failure('hourPlanningDisabled', edit);
    }
    if (!environment.effectiveCalendar) return failure('calendarNotFound', edit);
    const proposal = proposeTaskDurationConversion(task, target, environment.effectiveCalendar);
    if (!proposal) return failure('durationConversionNotExact', edit);
    task.time.durationUnit = proposal.unit;
    if (proposal.unit === 'days') {
      task.time.scheduleDuration = proposal.scheduleDuration ?? 0;
      task.time.durationMinutes = undefined;
    } else {
      if (!Number.isFinite(environment.effectiveHoursPerDay) || environment.effectiveHoursPerDay <= 0) {
        return failure('calendarHours', edit);
      }
      const minutes = proposal.durationMinutes ?? 0;
      task.time.durationMinutes = minutes;
      task.time.scheduleDuration = minutes / (environment.effectiveHoursPerDay * 60);
    }
    const finished = finishDurationEdit(task, timeBefore, environment, edit);
    if (!finished.ok) return finished;
    lost = finished.value;
  } else if (id === 'task.time.scheduleDuration') {
    if (edit.value && typeof edit.value === 'object' && 'unit' in edit.value) {
      return applyParsedDuration(task, edit.value as ParsedTaskDuration, edit, environment, timeBefore);
    }
    if (!isFiniteNumber(edit.value) || edit.value < 0) return failure('duration', edit);
    if (task.isHammock) return failure('readOnly', edit);
    const hoursPerDay = environment.effectiveHoursPerDay;
    if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0) return failure('calendarHours', edit);
    const days = edit.value / (hoursPerDay * 60);
    if (task.time.scheduleDuration !== days
      || (environment.hourMode ? task.time.durationMinutes !== edit.value : task.time.durationMinutes !== undefined)) {
      task.time.scheduleDuration = days;
      if (environment.hourMode) task.time.durationMinutes = edit.value;
      else delete task.time.durationMinutes;
      const finished = finishDurationEdit(task, timeBefore, environment, edit);
      if (!finished.ok) return finished;
      lost = finished.value;
    }
  } else if (id === 'task.time.start') {
    // De GETOONDE start (Tabel-kolom Start): dezelfde regel als paneel en Taak bewerken — er
    // verandert alleen iets bij een echte wijziging (`startAnchorAfterEdit`). Ook als het anker al op
    // die datum stond: de beperking kan dan nog ontbreken.
    if (!optionalString(edit.value)) return failure('date', edit);
    if (edit.value === undefined) return failure('required', edit);
    const anchor = startAnchorAfterEdit(task, edit.value);
    if (anchor !== undefined) lost = applyTypedStart(task, anchor, environment, effects);
  } else if (id === 'task.time.finish') {
    if (!optionalString(edit.value)) return failure('date', edit);
    if (edit.value === undefined) return failure('required', edit);
    // Ongewijzigd teruggetypt: niets verzetten (geen duur afronden, geen tijdfasering wissen).
    if (edit.value === shownFinish(task)) return { ok: true, value: false };
    if (edit.value.slice(0, 10) < shownStart(task).slice(0, 10)) return failure('finishBeforeStart', edit);
    if (isManuallyScheduled(task)) {
      // Een handmatig geplande taak eindigt op haar ingevoerde einde (`CPMSolver.forwardPass`).
      if (task.time.scheduleFinish !== edit.value) {
        task.time.scheduleFinish = edit.value;
        lost = clearScheduleGuidance(task, true);
      }
      return { ok: true, value: lost };
    }
    // Automatisch gepland: het einde volgt uit start + duur, dus een nieuw einde is een nieuwe duur.
    // Het ingevoerde einde (`scheduleFinish`) blijft bewust ongemoeid: dat is invoer, geen afgeleide
    // van de berekende planning.
    if (isPinnedComplete(task.time)) return failure('finishIsActual', edit);
    if (isZeroDurationMilestone(task) || task.time.durationType === 'ELAPSEDTIME'
      || (task.splitGaps?.length ?? 0) > 0) return failure('finishFromDuration', edit);
    if (!environment.effectiveCalendar) return failure('calendarNotFound', edit);
    const duration = durationForShownFinish(task, edit.value, environment.effectiveCalendar);
    if (!duration.ok) return failure(duration.code, edit);
    return applyParsedDuration(task, duration.value, edit, environment, timeBefore);
  } else if (id === 'task.time.scheduleStart' || id === 'task.time.scheduleFinish') {
    if (!optionalString(edit.value)) return failure('date', edit);
    const key = id === 'task.time.scheduleStart' ? 'scheduleStart' : 'scheduleFinish';
    if (edit.value === undefined) return failure('required', edit);
    if (task.time[key] !== edit.value) {
      // Geplande start is óók een getypte start: dezelfde regel als de kolom Start.
      if (key === 'scheduleStart') lost = applyTypedStart(task, edit.value, environment, effects);
      else {
        task.time[key] = edit.value;
        lost = clearScheduleGuidance(task, true);
      }
    }
  } else if (id === 'task.calendarId') {
    if (!optionalString(edit.value)) return failure('calendar', edit);
    if (edit.value !== undefined && !environment.calendarIds.has(edit.value)) {
      return failure('calendarNotFound', edit);
    }
    if (task.calendarId !== edit.value) {
      task.calendarId = edit.value;
      lost = clearScheduleGuidance(task, false);
    }
  } else {
    return failure('plannerNotAvailable', edit);
  }
  return { ok: true, value: lost };
}

function applyMilestoneEdit(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
): GridResult<boolean, readonly CellValidationError[]> {
  const id = String(edit.columnId);
  let scheduleChanged = false;
  const timeBefore: TaskTime = { ...task.time };
  if (id === 'task.isMilestone') {
    if (typeof edit.value !== 'boolean') return failure('boolean', edit);
    if (task.isMilestone !== edit.value) {
      // Gedeelde "wordt mijlpaal"-regel (audit §6): een fase wordt geen ruit. Toewijzingen toetst
      // het raster na afloop over de hele transactie (`planTaskAssignmentSet`), daarom hier `false`.
      if (edit.value && milestoneRefusal({ hasChildren: task.childIds.length > 0, hasAssignments: false })) {
        return failure('milestoneUnavailable', edit);
      }
      const transition = taskMilestoneTransition(task, edit.value);
      scheduleChanged = transition.time !== undefined
        && (task.time.scheduleDuration !== transition.time.scheduleDuration
          || task.time.durationMinutes !== transition.time.durationMinutes);
      const { time, ...fields } = transition;
      Object.assign(task, fields);
      if (time) task.time = time;
    }
  } else if (id === 'task.milestoneKind') {
    if (!task.isMilestone) return failure('milestoneRequired', edit);
    if (edit.value !== undefined
      && (typeof edit.value !== 'string' || !MILESTONE_KINDS.includes(edit.value as MilestoneKind))) {
      return failure('enum', edit);
    }
    task.milestoneKind = edit.value as MilestoneKind | undefined;
  } else if (id === 'task.mandatory') {
    if (!task.isMilestone) return failure('milestoneRequired', edit);
    if (!optionalBoolean(edit.value)) return failure('boolean', edit);
    task.mandatory = edit.value || undefined;
  } else {
    return failure('plannerNotAvailable', edit);
  }
  // Mijlpaal aan ⇒ duur 0: een duurwijziging, dus dezelfde gevolgregels als de duurcel. (Uitzetten
  // verzint geen duur, zie `taskMilestoneTransition`, en raakt de tijdbasis dan niet.)
  return scheduleChanged ? finishDurationEdit(task, timeBefore, environment, edit) : { ok: true, value: false };
}

function applyStatus(task: Task, status: TaskStatus, statusDate: string | undefined): void {
  if (status === 'NOT_STARTED') {
    task.time.completion = 0;
    task.time.actualStart = undefined;
    task.time.actualFinish = undefined;
  } else if (status === 'STARTED') {
    if (task.time.completion >= 1) task.time.completion = 0;
    task.time.actualFinish = undefined;
    fillMissingActualStart(task.time, statusDate);
  } else {
    task.time.completion = 1;
    // Zelfde regel als setTaskProgress en de completion-cel: zonder actualStart geldt de eigen
    // geplande start, niet AS = AF (dan kromp de voltooide balk tot zijn laatste dag).
    task.time.actualStart ||= defaultActualStart(task.time);
  }
  applyProgressInvariants(task, statusDate);
}

/** Voortgang die een ingevoerde actuele (`remaining` onwaar) of resterende duur in minuten
 *  impliceert, op de as van de taak: minuten in uurmodus, werkdagen anders. Zonder duur (of met een
 *  onbruikbaar totaal) telt de taak als voltooid. */
function completionFromDuration(
  task: Task,
  minutes: number,
  remaining: boolean,
  environment: TaskEditPlanEnvironment,
): number {
  const hoursPerDay = environment.effectiveHoursPerDay;
  const total = environment.hourMode
    ? task.time.durationMinutes ?? task.time.scheduleDuration * hoursPerDay * 60
    : task.time.scheduleDuration;
  if (!(total > 0)) return 1;
  const own = (environment.hourMode ? minutes : minutes / (hoursPerDay * 60)) / total;
  return Math.max(0, Math.min(1, remaining ? 1 - own : own));
}

/** Een ingevoerde resterende duur (minuten, of gewist) in dagen; `remainingMinutes` alleen in uurmodus. */
function writeRemaining(task: Task, minutes: number | undefined, environment: TaskEditPlanEnvironment): void {
  task.time.remainingTime = minutes === undefined ? undefined : minutes / (environment.effectiveHoursPerDay * 60);
  task.time.remainingMinutes = environment.hourMode && minutes !== undefined ? minutes : undefined;
}

function applyProgressEdit(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
): GridResult<void, readonly CellValidationError[]> {
  const id = String(edit.columnId);
  if (id === 'task.status') {
    if (typeof edit.value !== 'string' || !TASK_STATUSES.includes(edit.value as TaskStatus)) {
      return failure('enum', edit);
    }
    applyStatus(task, edit.value as TaskStatus, environment.statusDate);
  } else if (id === 'task.time.completion') {
    if (!isFiniteNumber(edit.value) || edit.value < 0 || edit.value > 1) return failure('percentage', edit);
    // Zelfde regel als store (`setTaskProgress`) en MCP: een afgeleide werkelijke start valt
    // nooit ná het werkelijke einde (100% met een statusdatum vóór de geplande start).
    applyCompletionEdit(task.time, edit.value, environment.statusDate);
    applyProgressInvariants(task, environment.statusDate);
  } else if (id === 'task.time.actualStart' || id === 'task.time.actualFinish') {
    if (!optionalString(edit.value)) return failure('date', edit);
    if (edit.value && environment.statusDate
      && isActualPastStatusDate(edit.value, environment.statusDate)) {
      return failure('actualAfterStatusDate', edit);
    }
    if (id === 'task.time.actualStart') task.time.actualStart = edit.value || undefined;
    else {
      task.time.actualFinish = edit.value || undefined;
      if (!edit.value && task.time.completion >= 1) task.time.completion = 0;
    }
    if (task.time.actualStart && task.time.actualFinish
      && parseInstant(task.time.actualFinish).getTime() < parseInstant(task.time.actualStart).getTime()) {
      return failure('actualFinishBeforeStart', edit);
    }
    applyProgressInvariants(task, environment.statusDate);
  } else if (id === 'task.time.actualDuration' || id === 'task.time.remainingTime') {
    if (edit.value !== undefined && (!isFiniteNumber(edit.value) || edit.value < 0)) {
      return failure('duration', edit);
    }
    const hoursPerDay = environment.effectiveHoursPerDay;
    if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0) return failure('calendarHours', edit);
    const remaining = id === 'task.time.remainingTime';
    if (edit.value === undefined) {
      if (remaining) writeRemaining(task, undefined, environment);
      else task.time.actualDuration = undefined;
      applyProgressInvariants(task, environment.statusDate);
      return { ok: true, value: undefined };
    }
    if (remaining) writeRemaining(task, edit.value, environment);
    else task.time.actualDuration = edit.value / (hoursPerDay * 60);
    applyCompletionEdit(
      task.time,
      completionFromDuration(task, edit.value, remaining, environment),
      environment.statusDate,
    );
    applyProgressInvariants(task, environment.statusDate);
    if (remaining) writeRemaining(task, edit.value, environment);
  } else {
    return failure('plannerNotAvailable', edit);
  }
  return { ok: true, value: undefined };
}

function nextConstraintType(
  task: Task,
  edit: CellEditIntent,
  secondary: boolean,
): GridResult<void, readonly CellValidationError[]> {
  if (edit.value !== undefined
    && (typeof edit.value !== 'string' || !CONSTRAINT_TYPES.includes(edit.value as ConstraintType))) {
    return failure('enum', edit);
  }
  const value = edit.value as ConstraintType | undefined;
  if (secondary) {
    task.constraint2 = value === undefined
      ? undefined
      : { type: value, date: task.constraint2?.date ?? task.time.scheduleStart };
  } else {
    // Gedeelde canonicalisatie met paneel en MCP (`withPrimaryConstraint`): ASAP/leeg wist beide,
    // ALAP wist de secundaire; de paartoets volgt in `applyConstraintEdit`.
    const hard = value === 'MSO' || value === 'MFO' ? task.constraint?.hard : undefined;
    const next = value === undefined
      ? undefined
      : { type: value, date: task.constraint?.date ?? task.time.scheduleStart, hard };
    Object.assign(task, withPrimaryConstraint(next, task.constraint2));
  }
  return { ok: true, value: undefined };
}

function applyConstraintEdit(
  task: Task,
  edit: CellEditIntent,
  validatePair = true,
): GridResult<void, readonly CellValidationError[]> {
  const id = String(edit.columnId);
  let result: GridResult<void, readonly CellValidationError[]> = { ok: true, value: undefined };
  if (id === 'task.constraint.type') result = nextConstraintType(task, edit, false);
  else if (id === 'task.constraint2.type') result = nextConstraintType(task, edit, true);
  else if (id === 'task.constraint.date') {
    if (!task.constraint || task.constraint.type === 'ASAP' || task.constraint.type === 'ALAP') {
      return failure('constraintDateUnavailable', edit);
    }
    if (!optionalString(edit.value) || edit.value === undefined) return failure('required', edit);
    task.constraint.date = edit.value;
  } else if (id === 'task.constraint2.date') {
    if (!task.constraint2) return failure('constraintDateUnavailable', edit);
    if (!optionalString(edit.value) || edit.value === undefined) return failure('required', edit);
    task.constraint2.date = edit.value;
  } else if (id === 'task.constraint.hard') {
    if (typeof edit.value !== 'boolean') return failure('boolean', edit);
    if (!task.constraint || (task.constraint.type !== 'MSO' && task.constraint.type !== 'MFO')) {
      return failure('constraintHardUnavailable', edit);
    }
    task.constraint.hard = edit.value || undefined;
  } else if (id === 'task.deadline') {
    if (!optionalString(edit.value)) return failure('date', edit);
    task.deadline = edit.value;
  } else return failure('plannerNotAvailable', edit);
  if (!result.ok) return result;
  if (validatePair) {
    const pair = validateConstraintPair(task.constraint, task.constraint2);
    if (!pair.ok) return failure(`constraintPair.${pair.issues[0]}`, edit, pair.issues);
  }
  return { ok: true, value: undefined };
}

function applyProgressEdits(
  task: Task,
  edits: readonly CellEditIntent[],
  environment: TaskEditPlanEnvironment,
): GridResult<void, readonly CellValidationError[]> {
  const byId = new Map(edits.map(edit => [String(edit.columnId), edit] as const));
  const first = edits[0]!;
  const statusEdit = byId.get('task.status');
  const completionEdit = byId.get('task.time.completion');
  const actualStartEdit = byId.get('task.time.actualStart');
  const actualFinishEdit = byId.get('task.time.actualFinish');
  const actualDurationEdit = byId.get('task.time.actualDuration');
  const remainingEdit = byId.get('task.time.remainingTime');

  if (statusEdit && (typeof statusEdit.value !== 'string'
    || !TASK_STATUSES.includes(statusEdit.value as TaskStatus))) return failure('enum', statusEdit);
  if (completionEdit && (!isFiniteNumber(completionEdit.value)
    || completionEdit.value < 0 || completionEdit.value > 1)) return failure('percentage', completionEdit);
  for (const edit of [actualStartEdit, actualFinishEdit]) {
    if (!edit) continue;
    if (!optionalString(edit.value)) return failure('date', edit);
    if (edit.value && environment.statusDate && isActualPastStatusDate(edit.value, environment.statusDate)) {
      return failure('actualAfterStatusDate', edit);
    }
  }
  for (const edit of [actualDurationEdit, remainingEdit]) {
    if (edit && edit.value !== undefined && (!isFiniteNumber(edit.value) || edit.value < 0)) {
      return failure('duration', edit);
    }
  }
  if ((actualDurationEdit || remainingEdit)
    && (!Number.isFinite(environment.effectiveHoursPerDay) || environment.effectiveHoursPerDay <= 0)) {
    return failure('calendarHours', actualDurationEdit ?? remainingEdit ?? first);
  }

  let desiredCompletion = completionEdit ? completionEdit.value as number : undefined;
  const derivedCompletions: number[] = [];
  if (actualDurationEdit?.value !== undefined) {
    derivedCompletions.push(completionFromDuration(task, actualDurationEdit.value as number, false, environment));
  }
  if (remainingEdit?.value !== undefined) {
    derivedCompletions.push(completionFromDuration(task, remainingEdit.value as number, true, environment));
  }
  if (derivedCompletions.some(value => Math.abs(value - derivedCompletions[0]!) > 1e-9)
    || (desiredCompletion !== undefined
      && derivedCompletions.some(value => Math.abs(value - desiredCompletion!) > 1e-9))) {
    return failure('conflictingProgressInputs', completionEdit ?? actualDurationEdit ?? remainingEdit ?? first);
  }
  desiredCompletion ??= derivedCompletions[0];

  const desiredStatus = statusEdit?.value as TaskStatus | undefined;
  let desiredActualStart = actualStartEdit ? (actualStartEdit.value as string | undefined) || undefined : task.time.actualStart;
  let desiredActualFinish = actualFinishEdit ? (actualFinishEdit.value as string | undefined) || undefined : task.time.actualFinish;
  // Een gewiste Actual Finish heropent een voltooide taak, net als bij een enkele celwrite — tenzij
  // dezelfde rij zelf een voortgang of status opgeeft. Anders zette `applyProgressInvariants` de
  // einddatum bij completion 1 meteen terug en deed het wissen niets.
  if (actualFinishEdit && !desiredActualFinish && desiredCompletion === undefined
    && desiredStatus === undefined && task.time.completion >= 1) {
    desiredCompletion = 0;
  }
  // Niet meegeschreven actuals zijn geen expliciete gewenste invoer. Een completion/status-write
  // moet ze in een brede paste precies zo kunnen canonicaliseren als bij een enkelvoudige edit.
  if (!actualFinishEdit && ((desiredCompletion !== undefined && desiredCompletion < 1)
    || desiredStatus === 'STARTED' || desiredStatus === 'NOT_STARTED')) {
    desiredActualFinish = undefined;
  }
  if (!actualStartEdit && desiredStatus === 'NOT_STARTED') desiredActualStart = undefined;
  if (desiredActualFinish) {
    if ((desiredCompletion !== undefined && desiredCompletion !== 1)
      || (desiredStatus !== undefined && desiredStatus !== 'COMPLETED')) {
      return failure('conflictingProgressInputs', actualFinishEdit ?? completionEdit ?? statusEdit ?? first);
    }
    desiredCompletion = 1;
  }
  if (desiredStatus === 'COMPLETED') {
    if ((desiredCompletion !== undefined && desiredCompletion !== 1)
      || (actualFinishEdit && !desiredActualFinish)) {
      return failure('conflictingProgressInputs', statusEdit!);
    }
    desiredCompletion = 1;
  } else if (desiredStatus === 'NOT_STARTED') {
    if ((desiredCompletion !== undefined && desiredCompletion !== 0)
      || (actualStartEdit && !!desiredActualStart) || (actualFinishEdit && !!desiredActualFinish)) {
      return failure('conflictingProgressInputs', statusEdit!);
    }
    desiredCompletion = 0;
  } else if (desiredStatus === 'STARTED') {
    if ((desiredCompletion !== undefined && desiredCompletion >= 1) || desiredActualFinish) {
      return failure('conflictingProgressInputs', statusEdit!);
    }
    desiredCompletion ??= task.time.completion >= 1 ? 0 : task.time.completion;
  }
  if (desiredActualStart && desiredActualFinish
    && parseInstant(desiredActualFinish).getTime() < parseInstant(desiredActualStart).getTime()) {
    return failure('actualFinishBeforeStart', actualFinishEdit ?? actualStartEdit ?? first);
  }

  if (actualDurationEdit) {
    task.time.actualDuration = actualDurationEdit.value === undefined
      ? undefined
      : (actualDurationEdit.value as number) / (environment.effectiveHoursPerDay * 60);
  }
  if (remainingEdit) writeRemaining(task, remainingEdit.value as number | undefined, environment);
  if (actualStartEdit) task.time.actualStart = desiredActualStart;
  if (actualFinishEdit) task.time.actualFinish = desiredActualFinish;
  if (desiredCompletion !== undefined) {
    task.time.completion = desiredCompletion;
    if (desiredCompletion < 1 && !actualFinishEdit) task.time.actualFinish = undefined;
    // Pas ná het vastleggen van het einde: een afgeleide werkelijke start valt nooit ná het
    // (opgegeven of straks afgeleide) werkelijke einde — zelfde uitkomst als het enkele-celpad.
    // Een in deze rij opgegeven Actual Start staat er dan al en blijft ongemoeid.
    if (desiredCompletion > 0) fillMissingActualStart(task.time, environment.statusDate);
  }
  if (desiredStatus === 'NOT_STARTED') {
    task.time.actualStart = undefined;
    task.time.actualFinish = undefined;
  } else if (desiredStatus === 'STARTED') {
    task.time.actualFinish = undefined;
    fillMissingActualStart(task.time, environment.statusDate);
  }
  applyProgressInvariants(task, environment.statusDate);
  if (remainingEdit) writeRemaining(task, remainingEdit.value as number | undefined, environment);
  if (desiredStatus !== undefined && task.status !== desiredStatus) {
    return failure('conflictingProgressInputs', statusEdit!);
  }
  return { ok: true, value: undefined };
}

function applyDynamicEdit(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
): GridResult<void, readonly CellValidationError[]> {
  const decoded = decodeDynamicTaskColumnId(String(edit.columnId));
  if (!decoded || decoded.projectId !== environment.projectId) return failure('projectMismatch', edit);
  if (decoded.kind === 'activity-code') {
    if (edit.route !== 'activity-code') return failure('routeMismatch', edit);
    const type = environment.activityCodeTypes.find(candidate => candidate.id === decoded.typeId);
    if (!type) return failure('activityCodeTypeNotFound', edit);
    if (edit.value !== undefined
      && (typeof edit.value !== 'string' || !type.values.some(value => value.id === edit.value))) {
      return failure('activityCode', edit);
    }
    assignTaskActivityCode(task, decoded.typeId, edit.value);
    return { ok: true, value: undefined };
  }
  if (decoded.kind === 'custom-field') {
    if (edit.route !== 'custom-field') return failure('routeMismatch', edit);
    const def = environment.customFieldDefs.find(candidate => candidate.id === decoded.defId);
    if (!def) return failure('customFieldNotFound', edit);
    if (!validCustomFieldValue(def, edit.value)) return failure('customFieldType', edit);
    assignTaskCustomField(task, decoded.defId, edit.value as CustomFieldValue | undefined);
    return { ok: true, value: undefined };
  }
  return failure('readOnly', edit);
}

function validCustomFieldValue(def: CustomFieldDef, value: unknown): boolean {
  if (value === undefined) return true;
  if (def.type === 'text' || def.type === 'date') return typeof value === 'string';
  if (def.type === 'boolean') return typeof value === 'boolean';
  if (def.type === 'integer') return isFiniteNumber(value) && Number.isInteger(value);
  return isFiniteNumber(value);
}

/**
 * Plant één reeds door de descriptor geparseerde celwrite tegen een losstaande taakkopie.
 * De invoertaak blijft byte-voor-byte ongemoeid; de transactie publiceert de uitkomst pas nadat
 * alle intents in dezelfde geïsoleerde draft geldig zijn bevonden.
 */
/** Alles wat één celwrite oplevert, BEHALVE `changed` — die vergelijking is een volledige
 * `JSON.stringify(task)` van beide kanten en dus verreweg de duurste stap hier. Losgetrokken van
 * `planTaskCellEdit` omdat `planTaskCellEdits` (meervoud) deze functie per deelwrite in een lus
 * aanroept zonder ooit naar `changed` te kijken (zie daar) — die tussentijdse `changed`-berekening
 * was dus zuiver verspilde rekentijd, gemeten als de dominante kost achter de bulk-plak-bevriezing
 * uit de eindreview (2.000 taken × 27 kolommen). `planTaskCellEdit` blijft voor externe aanroepers
 * de volledige, ongewijzigde vorm — inclusief `changed` — leveren. */
function applyOneCellEdit(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
  /** `false` in `planTaskCellEdits`: die houdt het einde één keer voor de hele groep coherent. */
  reconcileFinish = true,
): GridResult<
  Omit<PlannedTaskEdit, 'changed' | 'startConstraint'> & { startConstraintTouched: boolean },
  readonly CellValidationError[]
> {
  if (task.id !== edit.taskId) return failure('taskMismatch', edit);
  const id = String(edit.columnId);
  const expected = expectedRoute(id);
  if (!expected) return failure('plannerNotAvailable', edit);
  if (expected !== edit.route) return failure('routeMismatch', edit);
  if (edit.route === 'task-progress' && task.childIds.length > 0) return failure('summaryProgress', edit);
  const next = cloneTaskForEdit(task);
  let result: GridResult<unknown, readonly CellValidationError[]>;
  let timephasedGuidanceLost = false;
  const effects: CellEditEffects = { startConstraint: false };
  if (edit.route === 'task-field') result = applyTaskField(next, edit, environment);
  else if (edit.route === 'task-schedule') {
    const scheduleResult = applyScheduleEdit(next, edit, environment, effects);
    result = scheduleResult;
    if (scheduleResult.ok) timephasedGuidanceLost = scheduleResult.value;
  } else if (edit.route === 'task-milestone') {
    const milestoneResult = applyMilestoneEdit(next, edit, environment);
    result = milestoneResult;
    if (milestoneResult.ok) timephasedGuidanceLost = milestoneResult.value;
  } else if (edit.route === 'task-progress') result = applyProgressEdit(next, edit, environment);
  else if (edit.route === 'task-constraint') result = applyConstraintEdit(next, edit);
  else if (edit.route === 'task-hammock') {
    if (typeof edit.value !== 'boolean') result = failure('boolean', edit);
    else if (edit.value && (next.isMilestone || next.childIds.length > 0)) {
      result = failure('hammockUnavailable', edit);
    } else {
      next.isHammock = edit.value || undefined;
      result = { ok: true, value: undefined };
    }
  } else result = applyDynamicEdit(next, edit, environment);
  if (!result.ok) return result;
  // B7 — zie `LEVELING_GAP_ROUTES`. Ná de faalpoort: een geweigerde write laat `next` weg. De ROUTE
  // bepaalt welke velden meetellen (ongewijzigd); WANNEER is een echte waardewijziging, met dezelfde
  // structurele vergelijking als store en MCP (`sameValue`): een celwrite die de taak niet veranderde
  // — dezelfde waarde teruggeschreven — laat een nivelleergat staan.
  if (LEVELING_GAP_ROUTES.has(edit.route) && !sameValue(task, next)) clearLevelingGaps(next);
  if (reconcileFinish) reconcileGridInputFinish(task, next, environment);
  const scheduleStale = edit.route === 'task-schedule'
    || edit.route === 'task-progress'
    || edit.route === 'task-milestone'
    || edit.route === 'task-constraint'
    || edit.route === 'task-hammock'
    || String(edit.columnId) === 'task.priority';
  return {
    ok: true,
    value: {
      task: next, timephasedGuidanceLost, scheduleStale,
      startConstraintTouched: effects.startConstraint, startBlocked: effects.startBlocked,
    },
  };
}

/** `created` of `updated`, gezien vanaf de taak VÓÓR de hele bewerking: ook als twee startkolommen in
 *  één rij de beperking eerst zetten en dan verzetten, telt voor de gebruiker alleen het netto. */
function startConstraintChangeOf(before: Task, touched: boolean): StartConstraintChange | undefined {
  if (!touched) return undefined;
  return before.constraint?.type === 'SNET' ? 'updated' : 'created';
}

export function planTaskCellEdit(
  task: Task,
  edit: CellEditIntent,
  environment: TaskEditPlanEnvironment,
): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
  const applied = applyOneCellEdit(task, edit, environment);
  if (!applied.ok) return applied;
  const { startConstraintTouched, ...planned } = applied.value;
  return {
    ok: true,
    value: {
      ...planned,
      changed: JSON.stringify(task) !== JSON.stringify(planned.task),
      startConstraint: startConstraintChangeOf(task, startConstraintTouched),
    },
  };
}

/**
 * Plant alle celwrites van één taak als één gewenste taaktoestand. Constraintparen en
 * voortgangsvelden worden pas na de volledige groep gecanonicaliseerd en gevalideerd; hun
 * tijdelijke tussenstanden zijn geen gebruikersdata en mogen de uitkomst niet bepalen.
 */
export function planTaskCellEdits(
  task: Task,
  edits: readonly CellEditIntent[],
  environment: TaskEditPlanEnvironment,
): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
  if (edits.length === 0) {
    return {
      ok: true,
      value: { task, changed: false, timephasedGuidanceLost: false, scheduleStale: false },
    };
  }
  if (edits.length === 1) return planTaskCellEdit(task, edits[0], environment);
  for (const edit of edits) {
    if (task.id !== edit.taskId) return failure('taskMismatch', edit);
    const expected = expectedRoute(String(edit.columnId));
    if (!expected) return failure('plannerNotAvailable', edit);
    if (expected !== edit.route) return failure('routeMismatch', edit);
  }

  let next = cloneTaskForEdit(task);
  let timephasedGuidanceLost = false;
  let scheduleStale = false;
  let startConstraintTouched = false;
  let startBlocked: TaskConstraint | undefined;
  const constraintEdits = edits.filter(edit => edit.route === 'task-constraint');
  const progressEdits = edits.filter(edit => edit.route === 'task-progress');
  // Zet dezelfde rij de beperking zelf (bv. een geplakte rij met een Constraint-kolom), dan wint die
  // expliciete keuze: een getypte start maakt er dan geen "Start niet eerder dan" van.
  const loopEnvironment = environment.startDrivenByPredecessor === true
    && constraintEdits.some(edit => String(edit.columnId).startsWith('task.constraint'))
    ? { ...environment, startDrivenByPredecessor: false }
    : environment;
  for (const edit of edits) {
    if (edit.route === 'task-constraint' || edit.route === 'task-progress') continue;
    // applyOneCellEdit, niet planTaskCellEdit: deze lus keek nooit naar `.changed` van een
    // tussenstap, dus de dure JSON.stringify-vergelijking hierboven was hier pure verspilling.
    const planned = applyOneCellEdit(next, edit, loopEnvironment, false);
    if (!planned.ok) return planned;
    next = planned.value.task;
    timephasedGuidanceLost ||= planned.value.timephasedGuidanceLost;
    scheduleStale ||= planned.value.scheduleStale;
    startConstraintTouched ||= planned.value.startConstraintTouched;
    startBlocked ??= planned.value.startBlocked;
  }
  if (constraintEdits.length > 0) {
    // Voor de nivelleergat-poort hieronder: de taak vóór deze groep (die muteert `next` in-place).
    const beforeGroup = cloneTaskForEdit(next);
    const constraintRank = (edit: CellEditIntent): number => {
      const id = String(edit.columnId);
      if (id === 'task.constraint.type') return 0;
      if (id === 'task.constraint2.type') return 1;
      if (id === 'task.constraint.date') return 2;
      if (id === 'task.constraint2.date') return 3;
      if (id === 'task.constraint.hard') return 4;
      return 5;
    };
    const ordered = constraintEdits
      .map((edit, index) => ({ edit, index, rank: constraintRank(edit) }))
      .sort((left, right) => left.rank - right.rank || left.index - right.index)
      .map(item => item.edit);
    for (const edit of ordered) {
      const applied = applyConstraintEdit(next, edit, false);
      if (!applied.ok) return applied;
    }
    const pair = validateConstraintPair(next.constraint, next.constraint2);
    if (!pair.ok) {
      return failure(`constraintPair.${pair.issues[0]}`, ordered[ordered.length - 1], pair.issues);
    }
    // B7 — deze twee groepen omzeilen `applyOneCellEdit` (ze worden pas ná de volledige groep
    // gecanonicaliseerd), dus de poort staat hier apart. Pas ná de validatie: een geweigerde groep
    // laat de taak ongemoeid. En net als daar alleen bij een echte waardewijziging (`sameValue`).
    if (!sameValue(beforeGroup, next)) clearLevelingGaps(next);
    scheduleStale = true;
  }
  if (progressEdits.length > 0) {
    // Een verzameltaak draagt geen eigen voortgang: de rollup in `applyCpmResult` leidt die af uit de
    // bladen. Deze poort geldt voor élke route die hier langs komt (raster, plakken, voortgangsimport),
    // net als de weigering in MCP (`mcpValidation`) en in `setTaskProgress`.
    if (task.childIds.length > 0) return failure('summaryProgress', progressEdits[0]);
    const beforeGroup = cloneTaskForEdit(next);
    const applied = applyProgressEdits(next, progressEdits, environment);
    if (!applied.ok) return applied;
    if (!sameValue(beforeGroup, next)) clearLevelingGaps(next); // B7 — zie de constraintgroep hierboven.
    scheduleStale = true;
  }
  // B1-vervolg — één keer voor de hele groep, tegen de taak van vóór de groep: zo wint een in dezelfde
  // plak meegegeven "Gepland einde" ongeacht de kolomvolgorde, en telt voortgang (gestart ⇒ niet meer
  // meebewegen) mee.
  reconcileGridInputFinish(task, next, environment);
  return {
    ok: true,
    value: {
      task: next,
      changed: JSON.stringify(task) !== JSON.stringify(next),
      timephasedGuidanceLost,
      scheduleStale,
      startConstraint: startConstraintChangeOf(task, startConstraintTouched),
      startBlocked,
    },
  };
}
