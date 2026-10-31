import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Project } from '@/types/project';
import type { CPMResult } from './CPMSolver';
import { CalendarEngine } from './CalendarEngine';
import { isPinnedInProgress } from './duration';
import { resolveCalendar } from './resolveCalendar';
import { captureTriangle, settleAssignmentAdded, settleAssignmentRemoved } from '@/engine/work/workRuleApply';
import { parseInstant } from '@/utils/dateUtils';
import { isLeafTask } from '@/utils/taskHierarchy';
import { shownFinish, shownStart } from '@/utils/taskDates';

/**
 * Waarom een taak na F5 een ander einde kreeg (issue #742). Puur: de store geeft de taken van vóór en
 * ná de berekening, het spoor van de solver (`CPMResult.dateDriverByTaskId`) en de invoer van de
 * vorige berekening, en krijgt een lijst terug.
 *
 * Twee bronnen, met elk hun eigen zekerheid:
 *  - Wat de datum NU bepaalt, komt uit de solver zelf. Dat is geen reconstructie achteraf.
 *  - Wat er VERANDERDE, komt uit `ShiftBasis`: de invoer bij de vorige berekening. Dat is nodig als
 *    de start gelijk bleef, want dan zegt het spoor niets over het einde. Ontbreekt de basis, of
 *    verklaart hij het verschil niet, dan is de reden `unknown`. Een gok tonen we niet als feit.
 */
export type ShiftReason =
  | { kind: 'predecessor'; taskIds: string[] }
  | { kind: 'calendar'; calendarName: string }
  | { kind: 'constraint' }
  | { kind: 'statusDate'; date: string }
  | { kind: 'resource'; resourceIds: string[] }
  | { kind: 'duration' | 'ownStart' | 'plannedStart' | 'projectStart' | 'progress' | 'manual' | 'hammock' | 'unknown' };

export interface ShiftedTask {
  taskId: string;
  previousFinish: string;
  finish: string;
  reason: ShiftReason;
}

export interface ShiftReport {
  tasks: ShiftedTask[];
  /** Verschil van de oplevering in werkdagen op de projectkalender; positief is later. Afwezig als
   *  er geen vorige berekening is om mee te vergelijken. */
  projectEndWorkdays?: number;
}

/** De invoer bij de vorige berekening, voor zover de reden die nodig heeft. */
export interface ShiftBasis {
  tasks: Task[];
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  assignments: ResourceAssignment[];
  resources: Resource[];
  project: Pick<Project, 'defaultWorkRule'>;
  statusDate?: string;
}

export interface ShiftReportInput {
  tasksBefore: Task[];
  tasksAfter: Task[];
  result: CPMResult;
  /** `projectEnd` van de vorige geldige berekening. */
  previousProjectEnd?: string;
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  assignments: ResourceAssignment[];
  statusDate?: string;
  basis: ShiftBasis | null;
}

/** Hetzelfde moment? Een datum zonder tijd (een nog niet berekende taak) is gelijk aan elk moment
 *  op die dag, want zo toont de app hem ook. */
function sameMoment(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 10 || b.length === 10) return a.slice(0, 10) === b.slice(0, 10);
  return parseInstant(a).getTime() === parseInstant(b).getTime();
}

function assignmentsByTask(assignments: ResourceAssignment[]): Map<string, ResourceAssignment[]> {
  const byTask = new Map<string, ResourceAssignment[]>();
  for (const assignment of assignments) {
    const list = byTask.get(assignment.taskId);
    if (list) list.push(assignment);
    else byTask.set(assignment.taskId, [assignment]);
  }
  return byTask;
}

function sameDuration(a: Task, b: Task): boolean {
  return a.time.scheduleDuration === b.time.scheduleDuration
    && a.time.durationMinutes === b.time.durationMinutes
    && a.time.durationUnit === b.time.durationUnit
    && a.time.durationType === b.time.durationType;
}

function doneWork(task: Task): number {
  return task.time.completion * (task.time.durationMinutes ?? task.time.scheduleDuration);
}

function sameProgress(a: Task, b: Task): boolean {
  if (a.time.actualStart !== b.time.actualStart || a.time.actualFinish !== b.time.actualFinish) return false;
  // Een duurbewerking op een lopende taak herschrijft percentage en rest; het gedane werk blijft.
  if (!sameDuration(a, b)) return Math.abs(doneWork(a) - doneWork(b)) < 1e-6;
  return a.time.completion === b.time.completion
    && a.time.remainingMinutes === b.time.remainingMinutes
    && a.time.remainingTime === b.time.remainingTime;
}

class ShiftReasoner {
  private readonly basisTasks: Map<string, Task> | null;
  private readonly assignments: Map<string, ResourceAssignment[]>;
  private readonly basisAssignments: Map<string, ResourceAssignment[]> | null;
  private readonly calendarChanges = new Map<string, boolean>();
  private readonly shiftedIds: Set<string>;

  constructor(private readonly input: ShiftReportInput, shiftedIds: Set<string>) {
    this.shiftedIds = shiftedIds;
    this.basisTasks = input.basis ? new Map(input.basis.tasks.map(task => [task.id, task])) : null;
    this.assignments = assignmentsByTask(input.assignments);
    this.basisAssignments = input.basis ? assignmentsByTask(input.basis.assignments) : null;
  }

  private calendarOf(task: Task): WorkCalendar {
    return resolveCalendar(task.calendarId, this.input.calendars, this.input.calendar);
  }

  private calendarChanged(task: Task, base: Task): boolean {
    const basis = this.input.basis;
    if (!basis) return false;
    const before = resolveCalendar(base.calendarId, basis.calendars, basis.calendar);
    const after = this.calendarOf(task);
    if (before === after) return false;
    // Een kalender krijgt bij elke commit een nieuw object; alleen de inhoud telt.
    const key = `${before.id}\0${after.id}`;
    let changed = this.calendarChanges.get(key);
    if (changed === undefined) {
      changed = JSON.stringify(before) !== JSON.stringify(after);
      this.calendarChanges.set(key, changed);
    }
    return changed;
  }

  /** Andere resources of een andere inzet. Restwerk telt niet: dat volgt ook uit een duurbewerking. */
  private assignmentsChanged(taskId: string): boolean {
    const before = this.basisAssignments?.get(taskId) ?? [];
    const after = this.assignments.get(taskId) ?? [];
    return before.length !== after.length || before.some(assignment =>
      after.find(now => now.id === assignment.id)?.unitsPerDay !== assignment.unitsPerDay);
  }

  /**
   * Geeft alleen de gewijzigde toewijzing precies deze duur? Daarvoor rekent de werkregel, op een
   * kopie van de vorige stand, dezelfde stappen door als de store. Pas dan is de toewijzing de oorzaak.
   * Een andere inzet op een blijvende resource bewijst niets: onder Vast werk geeft een duurbewerking
   * precies dezelfde uitkomst.
   */
  private durationFollowsAssignments(task: Task, base: Task): boolean {
    const basis = this.input.basis;
    if (!basis) return false;
    const before = this.basisAssignments?.get(task.id) ?? [];
    const after = this.assignments.get(task.id) ?? [];
    const staying = before.filter(assignment => after.some(now => now.id === assignment.id));
    if (staying.some(assignment => !after.some(now => now.id === assignment.id && now.unitsPerDay === assignment.unitsPerDay))) {
      return false;
    }
    const replay = structuredClone(base);
    const assignments = structuredClone(before);
    for (const assignment of before) {
      if (staying.includes(assignment)) continue;
      const captured = captureTriangle(replay, assignments, basis);
      assignments.splice(assignments.findIndex(item => item.id === assignment.id), 1);
      settleAssignmentRemoved(replay, assignments, captured, assignment.id);
    }
    for (const assignment of after) {
      if (before.some(item => item.id === assignment.id)) continue;
      const captured = captureTriangle(replay, assignments, basis);
      const added = structuredClone(assignment);
      assignments.push(added);
      settleAssignmentAdded(replay, assignments, captured, added);
    }
    return sameDuration(replay, task);
  }

  private assignedResourceIds(taskId: string): string[] {
    return (this.assignments.get(taskId) ?? []).map(assignment => assignment.resourceId);
  }

  /** Zelfde start, ander einde: de duur, de toewijzing of de kalender. Alleen een enkele oorzaak is
   *  zeker; met twee tegelijk weten we niet welke het verschil maakte. */
  private spanReason(task: Task): ShiftReason {
    const base = this.basisTasks?.get(task.id);
    if (!base) return { kind: 'unknown' };
    const durationChanged = !sameDuration(base, task);
    const calendarChanged = this.calendarChanged(task, base);
    if (durationChanged === calendarChanged) return { kind: 'unknown' };
    if (calendarChanged) return { kind: 'calendar', calendarName: this.calendarOf(task).name };
    if (!this.assignmentsChanged(task.id)) return { kind: 'duration' };
    return this.durationFollowsAssignments(task, base)
      ? { kind: 'resource', resourceIds: this.assignedResourceIds(task.id) }
      : { kind: 'unknown' };
  }

  /**
   * Een lopende taak: de werkelijke start staat vast, dus de start zegt niets over het einde. Het spoor
   * gaat over het resterende werk. Veranderde wat dat werk stuurt, en de taak zelf niet, dan is dat de
   * reden. Veranderden beide, dan weten we niet welke het verschil maakte.
   */
  private remainingWorkReason(task: Task, reason: ShiftReason, causeMoved: boolean): ShiftReason {
    const base = this.basisTasks?.get(task.id);
    if (!base) return { kind: 'unknown' };
    const ownChanged = !sameDuration(base, task) || !sameProgress(base, task) || this.calendarChanged(task, base);
    if (ownChanged) return causeMoved ? { kind: 'unknown' } : this.spanReason(task);
    return causeMoved ? reason : { kind: 'unknown' };
  }

  /** Bleef de aanleiding zelf gelijk terwijl de kalender veranderde, dan is de nieuwe start het
   *  gevolg van de kalender: de start viel in tijd die nu niet meer werkbaar is. */
  private startReason(task: Task, reason: ShiftReason, unchangedCause: (base: Task) => boolean): ShiftReason {
    const base = this.basisTasks?.get(task.id);
    if (base && unchangedCause(base) && this.calendarChanged(task, base)) {
      return { kind: 'calendar', calendarName: this.calendarOf(task).name };
    }
    return reason;
  }

  reasonFor(task: Task, previous: Task): ShiftReason {
    const driver = this.input.result.dateDriverByTaskId?.[task.id];
    if (!driver) return { kind: 'unknown' };
    const base = this.basisTasks?.get(task.id);
    const startMoved = !sameMoment(shownStart(previous), shownStart(task));
    const inProgress = isPinnedInProgress(task.time);
    switch (driver.kind) {
      case 'constraint': {
        const reason: ShiftReason = { kind: 'constraint' };
        if (inProgress) {
          return this.remainingWorkReason(task, reason, JSON.stringify(base?.constraint) !== JSON.stringify(task.constraint));
        }
        return startMoved ? reason : this.spanReason(task);
      }
      case 'manual': return { kind: 'manual' };
      case 'hammock': return { kind: 'hammock' };
      case 'other': return { kind: 'unknown' };
      case 'progress': return base && sameProgress(base, task) ? this.spanReason(task) : { kind: 'progress' };
      case 'statusDate': {
        const basis = this.input.basis;
        const statusDateMoved = !!basis && basis.statusDate !== this.input.statusDate;
        if (base && !statusDateMoved && !sameProgress(base, task) && base.time.scheduleStart === task.time.scheduleStart) {
          return { kind: 'progress' };
        }
        const reason: ShiftReason = { kind: 'statusDate', date: this.input.statusDate ?? '' };
        if (inProgress) return this.remainingWorkReason(task, reason, statusDateMoved);
        return startMoved ? reason : this.spanReason(task);
      }
      case 'leveling': {
        if (!startMoved) return this.spanReason(task);
        // De vertraging zegt niet door welke resource hij ontstond; met één toewijzing is dat zeker.
        const resourceIds = this.assignedResourceIds(task.id);
        return { kind: 'resource', resourceIds: resourceIds.length === 1 ? resourceIds : [] };
      }
      case 'relation':
        if (inProgress) {
          return this.remainingWorkReason(
            task,
            { kind: 'predecessor', taskIds: driver.predecessorIds },
            driver.predecessorIds.some(id => this.shiftedIds.has(id)),
          );
        }
        if (!startMoved) return this.spanReason(task);
        return this.startReason(
          task,
          { kind: 'predecessor', taskIds: driver.predecessorIds },
          () => !driver.predecessorIds.some(id => this.shiftedIds.has(id)),
        );
      case 'ownStart':
      case 'plannedStart':
      case 'projectStart':
        if (!startMoved) return this.spanReason(task);
        return this.startReason(
          task,
          { kind: driver.kind },
          base => base.time.scheduleStart === task.time.scheduleStart,
        );
    }
  }
}

/** Verschil van de oplevering, tot op een tiende werkdag: meer zegt de melding niet. */
function projectEndWorkdays(input: ShiftReportInput): number | undefined {
  const { previousProjectEnd, result, calendar } = input;
  if (!previousProjectEnd || !result.projectEnd) return undefined;
  const before = parseInstant(previousProjectEnd);
  const after = parseInstant(result.projectEnd);
  if (Number.isNaN(before.getTime()) || Number.isNaN(after.getTime())) return undefined;
  return Math.round(new CalendarEngine(calendar).measuredWorkdaysBetween(before, after) * 10) / 10;
}

/**
 * Welke bladtaken kregen een ander einde, en waarom. De volgorde is die van de takenlijst. Een
 * verzameltaak telt niet mee: haar datums volgen uit de kinderen en zouden die dubbel tellen.
 */
export function buildShiftReport(input: ShiftReportInput): ShiftReport {
  const previousById = new Map(input.tasksBefore.map(task => [task.id, task]));
  const shifted: { task: Task; previous: Task }[] = [];
  for (const task of input.tasksAfter) {
    if (!isLeafTask(task)) continue;
    const previous = previousById.get(task.id);
    if (!previous) continue;
    const before = shownFinish(previous);
    const after = shownFinish(task);
    if (before && after && !sameMoment(before, after)) shifted.push({ task, previous });
  }
  const reasoner = new ShiftReasoner(input, new Set(shifted.map(entry => entry.task.id)));
  const workdays = projectEndWorkdays(input);
  return {
    tasks: shifted.map(({ task, previous }) => ({
      taskId: task.id,
      previousFinish: shownFinish(previous),
      finish: shownFinish(task),
      reason: reasoner.reasonFor(task, previous),
    })),
    ...(workdays === undefined ? {} : { projectEndWorkdays: workdays }),
  };
}
