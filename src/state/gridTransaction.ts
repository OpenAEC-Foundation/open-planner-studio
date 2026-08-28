import { produce } from 'immer';
import { computeReliableResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import { deriveViewRows } from './slices/viewSlice';
import { buildTaskRelationIndex, type TaskRelationIndex } from '@/engine/taskGrid/relationIndex';
import { buildTaskColumnRegistry, canonicalGridJson } from '@/engine/taskGrid/taskColumnRegistry';
import {
  planTaskCellEdits,
  type TaskEditPlanEnvironment,
} from '@/engine/taskGrid/taskEditPlan';
import {
  applyTaskAssignmentPlan,
  planTaskAssignmentSet,
  type TaskAssignmentApplyIndexes,
} from '@/engine/taskGrid/assignmentPlan';
import { isHourCalendar } from '@/services/subdayIo';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { createSnapshot, restoreSnapshot, type Snapshot } from './snapshot';
import { recordDocumentDataHistoryDelta } from './sessionHistory';
import { notifyTimephasedLoss } from './timephasedLossNotice';
import { markScheduleStale } from './transaction';
import { generateId } from '@/utils/id';
import {
  applyRelationMutationPlan,
  isParsedRelationTokenArray,
  planRelationSet,
  planRelationSetInBatch,
  validateFinalRelationGraph,
} from '@/engine/taskGrid/relationPlan';
import type { AppState } from './appStore';
import type { AppSlice, DeferredNotification } from './slices/types';
import type {
  CellEditIntent,
  CellValidationError,
  GridIntent,
  GridResult,
  GridWriteIntent,
  AssignmentSetIntent,
  RelationSetIntent,
  TaskColumnContext,
  TaskColumnDescriptor,
} from '@/types/taskGrid';
import type { ViewRow } from '@/engine/view/visibleRows';

export interface PreparedGridMutation {
  documentId: string;
  before: Snapshot;
  after: Snapshot;
  derivedAfter: {
    viewRows: readonly ViewRow[];
    resourceLoadResult: ResourceLoadResult | null;
  };
  notifications: readonly DeferredNotification[];
  timephasedLossCount: number;
  label: string;
}

export interface GridMutationError {
  code: 'documentChanged' | 'stateChanged' | 'commitFailed' | 'reentrant';
  message: string;
}

export interface GridTransactionSlice {
  runGridMutation: (
    intents: readonly GridIntent[],
  ) => GridResult<void, readonly CellValidationError[]>;
}

type StoreGet = () => AppState;
type StoreSet = (recipe: (state: AppState) => void) => void;

let defaultStore: { get: StoreGet; set: StoreSet } | null = null;

/** Bind uitsluitend de publieke singletonwrappers; iedere storeslice houdt zijn eigen get/set. */
export function bindDefaultGridTransactionStore(get: StoreGet, set: StoreSet): void {
  defaultStore = { get, set };
}

function getDefaultStore(): { get: StoreGet; set: StoreSet } {
  if (!defaultStore) throw new Error('De standaard gridtransactiestore is nog niet gekoppeld');
  return defaultStore;
}

function validationError(
  code: string,
  intent?: { taskId?: string; columnId?: CellEditIntent['columnId'] },
  value?: unknown,
): CellValidationError {
  return {
    code,
    messageKey: `taskGrid.validation.${code}`,
    taskId: intent?.taskId,
    columnId: intent?.columnId,
    value,
  };
}

function flattenIntents(intents: readonly GridIntent[]): GridWriteIntent[] {
  const writes: GridWriteIntent[] = [];
  for (const intent of intents) {
    if (intent.kind === 'paste') writes.push(...intent.writes);
    else writes.push(intent);
  }
  return writes;
}

interface GridColumnRuntime {
  descriptors: ReadonlyMap<string, TaskColumnDescriptor>;
  context: TaskColumnContext;
}

function buildGridColumnRuntime(state: Readonly<AppState>): GridColumnRuntime {
  const assignmentsByTaskId = new Map<string, AppState['assignments']>();
  for (const assignment of state.assignments) {
    const values = assignmentsByTaskId.get(assignment.taskId);
    if (values) values.push(assignment);
    else assignmentsByTaskId.set(assignment.taskId, [assignment]);
  }
  const context: TaskColumnContext = {
    projectId: state.project.id,
    tasksById: new Map(state.tasks.map(task => [task.id, task])),
    relationIndex: buildTaskRelationIndex(state.tasks, state.sequences, state.cpmResult),
    assignmentsByTaskId,
    resourcesById: new Map(state.resources.map(resource => [resource.id, resource])),
    baselinesById: new Map(state.baselines.map(baseline => [baseline.id, baseline])),
    scheduleStale: state.scheduleStale,
    wbsAutoNumber: state.project.wbsAutoNumber === true,
    effectiveHoursPerDay: task => effHoursPerDay(effectiveCalendarOf(
      task, state.calendar, state.calendars,
    )),
  };
  const descriptors = buildTaskColumnRegistry({
    projectId: state.project.id,
    activityCodeTypes: state.activityCodeTypes,
    customFieldDefs: state.customFieldDefs,
    baselines: state.baselines,
  });
  return { descriptors: new Map(descriptors.map(descriptor => [descriptor.id, descriptor])), context };
}

function normalizeWrites(writes: readonly GridWriteIntent[]): GridResult<readonly GridWriteIntent[], readonly CellValidationError[]> {
  const unique: GridWriteIntent[] = [];
  const byTarget = new Map<string, GridWriteIntent>();
  const errors: CellValidationError[] = [];
  for (const write of writes) {
    const key = write.kind === 'cell-edit'
      ? `cell\u0000${write.taskId}\u0000${write.columnId}`
      : write.kind === 'assignment-set'
        ? `assignment\u0000${write.taskId}\u0000${write.columnId}`
        : `relation\u0000${write.taskId}\u0000${write.direction}`;
    const previous = byTarget.get(key);
    if (!previous) {
      byTarget.set(key, write);
      unique.push(write);
    } else if (canonicalGridJson(previous) !== canonicalGridJson(write)) {
      errors.push(validationError('conflictingDuplicate', { taskId: write.taskId }, write));
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: unique };
}

/**
 * Een paste volgt de visuele kolomvolgorde, maar domeincontrollers zoals mijlpaal- en
 * constrainttype veranderen tijdens dezelfde transactie welke cellen schrijfbaar zijn. Orden
 * alleen writes van dezelfde taak rond zulke overgangen; onafhankelijke writes behouden hun
 * oorspronkelijke volgorde.
 */
function orderWritesForDependentTransitions(
  writes: readonly GridWriteIntent[],
): readonly GridWriteIntent[] {
  const targets = new Map<string, boolean>();
  const hammockTargets = new Map<string, boolean>();
  const primaryConstraintTargets = new Map<string, string>();
  const secondaryConstraintTargets = new Map<string, string | undefined>();
  for (const write of writes) {
    if (write.kind !== 'cell-edit') continue;
    const columnId = String(write.columnId);
    if (columnId === 'task.isMilestone' && typeof write.value === 'boolean') {
      targets.set(write.taskId, write.value);
    } else if (columnId === 'task.isHammock' && typeof write.value === 'boolean') {
      hammockTargets.set(write.taskId, write.value);
    } else if (columnId === 'task.constraint.type' && typeof write.value === 'string') {
      primaryConstraintTargets.set(write.taskId, write.value);
    } else if (columnId === 'task.constraint2.type'
      && (write.value === undefined || typeof write.value === 'string')) {
      secondaryConstraintTargets.set(write.taskId, write.value);
    }
  }
  const assignmentTaskIds = new Set(writes.flatMap(write => (
    write.kind === 'assignment-set' ? [write.taskId] : []
  )));
  if (targets.size === 0 && hammockTargets.size === 0 && primaryConstraintTargets.size === 0
    && secondaryConstraintTargets.size === 0 && assignmentTaskIds.size === 0) return writes;

  // Lege afhankelijke cellen uit een volledige taakrij zijn redundant wanneer de geplakte
  // controller ze in de eindtoestand juist uitschakelt. Niet-lege tegenstrijdige waarden blijven
  // staan en worden door de domeinplanner atomair geweigerd.
  const isEmptyDependentValue = (value: unknown): boolean => (
    value === undefined || value === '' || value === false
  );
  const filtered = writes.filter(write => {
    if (write.kind !== 'cell-edit' || !isEmptyDependentValue(write.value)) return true;
    const columnId = String(write.columnId);
    const primary = primaryConstraintTargets.get(write.taskId);
    if ((primary === 'ASAP' || primary === 'ALAP')
      && (columnId === 'task.constraint.date' || columnId === 'task.constraint.hard')) return false;
    if (primary !== undefined && primary !== 'MSO' && primary !== 'MFO'
      && columnId === 'task.constraint.hard') return false;
    const secondary = secondaryConstraintTargets.get(write.taskId);
    if ((secondary === undefined || secondary === 'ASAP' || secondary === 'ALAP')
      && secondaryConstraintTargets.has(write.taskId)
      && columnId === 'task.constraint2.date') return false;
    return true;
  });

  const ordered = [...filtered];
  const affectedTaskIds = new Set([
    ...targets.keys(), ...hammockTargets.keys(),
    ...primaryConstraintTargets.keys(), ...secondaryConstraintTargets.keys(),
    ...assignmentTaskIds,
  ]);
  // PRESTATIE (bevinding uit de eindreview): hieronder liep vroeger `ordered.forEach(...)` — een
  // scan over ALLE writes van de HELE paste — voor iedere taak in `affectedTaskIds` apart. Bij
  // 2.000 taken × 27 kolommen is dat tot ~2.000 volledige scans van ~50.000 writes: verreweg de
  // duurste stap van de bulk-plak-bevriezing uit de eindreview. Eén vooraf gebouwde index
  // (taakid → posities) maakt dit één keer O(writes) in plaats van O(taken × writes).
  const positionsByTaskId = new Map<string, number[]>();
  ordered.forEach((write, index) => {
    const existing = positionsByTaskId.get(write.taskId);
    if (existing) existing.push(index);
    else positionsByTaskId.set(write.taskId, [index]);
  });
  for (const taskId of affectedTaskIds) {
    const targetMilestone = targets.get(taskId);
    const targetHammock = hammockTargets.get(taskId);
    const positions = positionsByTaskId.get(taskId) ?? [];
    const taskWrites = positions.map(position => ordered[position]);
    const rank = (write: GridWriteIntent): number => {
      let value = 0;
      if (targetMilestone === true) {
        // Alle celwrites van één taak worden als één gezamenlijke eindtoestand toegepast zodra
        // de eerste celwrite aan de beurt is. Een lege assignmentwrite moet daarom vóór iedere
        // cel uit die groep staan: hij wist bestaande assignments voordat de mijlpaalovergang ze
        // conditioneel onbeschikbaar maakt. Niet-lege assignments blijven na de overgang staan
        // en worden als een tegenstrijdige eindtoestand atomair geweigerd.
        if (write.kind === 'assignment-set') value += write.tokens.length === 0 ? -100 : 10;
        if (write.kind === 'cell-edit' && String(write.columnId) === 'task.isHammock') {
          value += write.value === false || write.value === undefined ? -30 : 10;
        }
      }
      if (targetMilestone === undefined && targetHammock === true
        && write.kind === 'assignment-set') {
        value += write.tokens.length === 0 ? -30 : 10;
      }
      if ((targetMilestone === false || (targetMilestone === undefined && targetHammock === false))
        && write.kind === 'assignment-set') value += 10;
      if (write.kind === 'assignment-set') {
        if (String(write.columnId) === 'assignment.resources') value -= 20;
        else value += 20;
      }
      if (write.kind !== 'cell-edit') return value;
      const columnId = String(write.columnId);
      const isMilestoneMetadata = columnId === 'task.milestoneKind'
        || columnId === 'task.mandatory';
      if (targetMilestone === true) {
        if (columnId === 'task.time.scheduleDuration') value -= 30;
        if (columnId === 'task.isHammock' && (write.value === false || write.value === undefined)) value -= 40;
        if (columnId === 'task.isMilestone') value -= 20;
        if (isMilestoneMetadata) value += 10;
      } else if (targetMilestone === false) {
        // Metadata is in de beginstaat nog schrijfbaar. Verwerk die eerst; de overgang ruimt
        // metadata daarna volgens het domeincontract op. Duur volgt juist ná de overgang.
        if (isMilestoneMetadata) value -= 30;
        if (columnId === 'task.isMilestone') value -= 20;
      }
      // Een expliciete mijlpaalovergang heeft al de strengere gecombineerde volgorde hierboven.
      // Zonder zo'n overgang moet duur vóór "hangmat aan" en juist ná "hangmat uit" landen.
      if (targetMilestone === undefined && targetHammock !== undefined) {
        if (targetHammock === true && columnId === 'task.time.scheduleDuration') value -= 30;
        if (columnId === 'task.isHammock') value -= 20;
      }
      if (primaryConstraintTargets.has(taskId)) {
        if (columnId === 'task.constraint.type') value -= 10;
      }
      if (secondaryConstraintTargets.has(taskId)) {
        if (columnId === 'task.constraint2.type') value -= 10;
      }
      return value;
    };
    const ranked = taskWrites
      .map((write, index) => ({ write, index, rank: rank(write) }))
      .sort((left, right) => left.rank - right.rank || left.index - right.index)
      .map(item => item.write);
    positions.forEach((position, index) => { ordered[position] = ranked[index]; });
  }
  return ordered;
}

function applyAssignmentSet(
  state: AppState,
  intent: AssignmentSetIntent,
  assignmentsForTask: readonly AppState['assignments'][number][],
  tasksById: ReadonlyMap<string, AppState['tasks'][number]>,
  resourcesById: GridColumnRuntime['context']['resourcesById'],
  applyIndexes: TaskAssignmentApplyIndexes,
): GridResult<{ timephasedGuidanceLostTaskIds: readonly string[] }, readonly CellValidationError[]> {
  const columnId = String(intent.columnId);
  if (columnId !== 'assignment.resources'
    && columnId !== 'assignment.unitsPerDay'
    && columnId !== 'assignment.curve') {
    return { ok: false, errors: [validationError('plannerNotAvailable', intent, intent.tokens)] };
  }
  let tokens = intent.tokens;
  if (columnId !== 'assignment.resources') {
    const currentByResourceId = new Map(assignmentsForTask.map(assignment => [assignment.resourceId, assignment] as const));
    const incomingByResourceId = new Map(tokens.map(token => [token.resourceId, token] as const));
    if (currentByResourceId.size !== incomingByResourceId.size
      || [...currentByResourceId.keys()].some(resourceId => !incomingByResourceId.has(resourceId))) {
      return { ok: false, errors: [validationError('readOnly', intent, intent.tokens)] };
    }
    tokens = assignmentsForTask.map(assignment => {
      const incoming = incomingByResourceId.get(assignment.resourceId)!;
      return {
        assignmentId: assignment.id,
        resourceId: assignment.resourceId,
        unitsPerDay: columnId === 'assignment.unitsPerDay' ? incoming.unitsPerDay : assignment.unitsPerDay,
        ...(columnId === 'assignment.curve'
          ? (incoming.curve ? { curve: incoming.curve } : {})
          : (assignment.curve ? { curve: assignment.curve } : {})),
      };
    });
  }
  const planned = planTaskAssignmentSet({
    taskId: intent.taskId,
    tokens,
    tasks: state.tasks,
    resources: state.resources,
    assignments: state.assignments,
    assignmentsForTask,
    tasksById,
    resourcesById,
  });
  if (!planned.ok) return planned;
  return {
    ok: true,
    value: applyTaskAssignmentPlan(
      state, planned.value, () => generateId('asgn'), applyIndexes,
    ),
  };
}

function applyRelationSet(
  state: AppState,
  intent: RelationSetIntent,
  inBatch = false,
  relationIndex?: TaskRelationIndex,
): GridResult<{ changed: boolean }, readonly CellValidationError[]> {
  if (!isParsedRelationTokenArray(intent.value)) {
    return { ok: false, errors: [validationError('invalidRelationTokens', { taskId: intent.taskId }, intent.value)] };
  }
  const planned = (inBatch ? planRelationSetInBatch : planRelationSet)({
    tasks: state.tasks,
    sequences: state.sequences,
    ownerTaskId: intent.taskId,
    direction: intent.direction,
    tokens: intent.value,
    relationIndex,
  });
  if (!planned.ok) {
    return {
      ok: false,
      errors: planned.errors.map(error => ({
        code: error.code,
        messageKey: error.messageKey,
        taskId: intent.taskId,
        tokenIndex: error.tokenIndex,
        start: error.start,
        end: error.end,
        cycle: error.cycle,
        value: error.value,
      })),
    };
  }
  applyRelationMutationPlan(state, planned.value, {
    sequenceId: () => generateId('seq'),
    externalLinkId: () => generateId('extlink'),
  });
  if (planned.value.changed) {
    if (state.datesAsRecorded) {
      state.datesAsRecorded = false;
      state.recordedDates = null;
    }
    markScheduleStale(state);
  }
  return { ok: true, value: { changed: planned.value.changed } };
}

function applyCellEdits(
  state: AppState,
  edits: readonly CellEditIntent[],
  runtime: GridColumnRuntime,
  // PRESTATIE (bevinding uit de eindreview): een `state.tasks.findIndex(...)` hier was een
  // lineaire scan over het VOLLEDIGE document, per taak opnieuw. De caller bouwt die index al
  // één keer (`draftTaskIndexById` in prepareGridMutation); hem hier meegeven maakt dit O(1) in
  // plaats van O(document). De caller vervangt nooit posities in `state.tasks` (alleen elementen
  // op dezelfde index), dus deze kaart blijft geldig zolang deze functie draait.
  taskIndexById: ReadonlyMap<string, number>,
): GridResult<{ timephasedGuidanceLost: boolean }, readonly CellValidationError[]> {
  const first = edits[0];
  if (!first) return { ok: true, value: { timephasedGuidanceLost: false } };
  const taskIndex = taskIndexById.get(first.taskId) ?? -1;
  const task = taskIndex >= 0 ? state.tasks[taskIndex] : undefined;
  if (!task) return { ok: false, errors: [validationError('taskNotFound', first, first.value)] };
  const validatedEdits: CellEditIntent[] = [];
  for (const edit of edits) {
    const descriptor = runtime.descriptors.get(String(edit.columnId));
    if (!descriptor || !descriptor.available(runtime.context)) {
      return { ok: false, errors: [validationError('plannerNotAvailable', edit, edit.value)] };
    }
    // Statisch berekende kolommen zijn nooit onderdeel van een gezamenlijke eindtoestand.
    if (descriptor.readOnly === true) {
      return { ok: false, errors: [validationError('readOnly', edit, edit.value)] };
    }
    let value = edit.value;
    if (descriptor.validate) {
      const validated = descriptor.validate(value, task, runtime.context);
      if (!validated.ok) {
        const error = validated.errors[0] ?? validationError('invalid', edit, value);
        return { ok: false, errors: [{ ...error, taskId: edit.taskId, columnId: edit.columnId, value }] };
      }
      value = validated.value;
    }
    validatedEdits.push({ ...edit, value });
  }

  const calendarEdit = validatedEdits.find(edit => String(edit.columnId) === 'task.calendarId');
  const taskForCalendar = calendarEdit
    ? { ...task, calendarId: calendarEdit.value as string | undefined }
    : task;
  const effectiveCalendar = effectiveCalendarOf(taskForCalendar, state.calendar, state.calendars);
  const environment: TaskEditPlanEnvironment = {
    projectId: state.project.id,
    wbsAutoNumber: state.project.wbsAutoNumber === true,
    statusDate: state.project.statusDate,
    calendarIds: new Set([state.calendar.id, ...state.calendars.map(calendar => calendar.id)]),
    effectiveHoursPerDay: effHoursPerDay(effectiveCalendar),
    hourMode: isHourCalendar(effectiveCalendar) === true,
    activityCodeTypes: state.activityCodeTypes,
    customFieldDefs: state.customFieldDefs,
  };

  // Algemene gezamenlijke-eindtoestandvalidatie voor conditioneel schrijfbare cellen. Een cel mag
  // worden geschreven wanneer zij in de beginstaat al schrijfbaar is, of wanneer de OVERIGE
  // writes van dezelfde taak haar controller in een schrijfbare toestand zetten. De eigen write
  // telt bewust niet mee: zo kan een compacte notitiecel zichzelf niet openzetten door eerst de
  // meerdere notities te overschrijven. Dit vervangt de oude kolom-id-whitelist volledig.
  //
  // PRESTATIE (bevinding uit de eindreview): dit kopieerde vroeger `runtime.context.tasksById` —
  // de VOLLEDIGE documentkaart — voor iedere combinatie van (conditioneel schrijfbare cel ×
  // prefixlengte). Gemeten: 2.000 taken × 27 kolommen plakken deed dat tot ~2.000× per taak,
  // resulterend in 4.446 ms synchrone bevriezing. De kaart hoeft maar ÉÉN keer per taak te worden
  // gekopieerd — alleen `task.id` verandert tussen de projecties, de rest van het document niet —
  // dus hij wordt hier eenmalig aangemaakt en daarna alleen die ene entry bijgewerkt (structureel
  // gedeeld tussen alle conditioneel schrijfbare cellen en alle prefixlengtes van deze taak).
  // Zelfde semantiek, zelfde alles-of-niets-uitkomst: op het moment dat `descriptor.readOnly`
  // wordt aangeroepen bevat de kaart precies dezelfde waarden als de oude per-aanroep-kopie.
  let sharedProjectedTasksById: Map<string, AppState['tasks'][number]> | null = null;
  let sharedProjectedContext: TaskColumnContext | null = null;
  const ensureProjectedContext = (): { tasksById: Map<string, AppState['tasks'][number]>; context: TaskColumnContext } => {
    if (!sharedProjectedTasksById || !sharedProjectedContext) {
      sharedProjectedTasksById = new Map(runtime.context.tasksById);
      sharedProjectedContext = { ...runtime.context, tasksById: sharedProjectedTasksById };
    }
    return { tasksById: sharedProjectedTasksById, context: sharedProjectedContext };
  };

  // Alleen deze vier velden bepalen ooit de conditionele readOnly-uitkomst van een ANDERE cel
  // (zie descriptor.readOnly hierboven in taskColumnRegistry.ts: wbsCode/milestoneKind/mandatory/
  // constraint.hard/isHammock/scheduleDuration lezen uitsluitend `ctx.wbsAutoNumber`,
  // `task.isMilestone`, `task.constraint?.type` of `task.isHammock`; alleen `task.notes` leest een
  // veld dat het zelf schrijft, en heeft dus per definitie geen ANDERE write die het beïnvloedt).
  // Tussenliggende, niet-controller writes kunnen de conditionele uitkomst dus nooit veranderen:
  // het is voldoende ELKE controllerGRENS te bekijken, niet elke prefixlengte van ALLE overige
  // writes. `orderWritesForDependentTransitions` heeft de controllers al in hun canonieke
  // onderlinge volgorde gezet, dus filteren op deze vier id's uit `validatedEdits` behoudt precies
  // die volgorde.
  const CONTROLLER_COLUMN_IDS = new Set([
    'task.isMilestone', 'task.isHammock', 'task.constraint.type', 'task.constraint2.type',
  ]);
  let sharedControllerStates: readonly { task: AppState['tasks'][number] }[] | null = null;
  const buildControllerStates = (excludeEdit: CellEditIntent): readonly { task: AppState['tasks'][number] }[] => {
    const controllerEdits = validatedEdits.filter(
      candidate => candidate !== excludeEdit && CONTROLLER_COLUMN_IDS.has(String(candidate.columnId)),
    );
    const states: { task: AppState['tasks'][number] }[] = [{ task }];
    for (let prefixLength = 1; prefixLength <= controllerEdits.length; prefixLength++) {
      const projected = planTaskCellEdits(task, controllerEdits.slice(0, prefixLength), environment);
      if (projected.ok) states.push({ task: projected.value.task });
    }
    return states;
  };

  for (const edit of validatedEdits) {
    const descriptor = runtime.descriptors.get(String(edit.columnId));
    if (!descriptor || typeof descriptor.readOnly !== 'function'
      || !descriptor.readOnly(task, runtime.context)) continue;
    const { tasksById: projectedTasksById, context: projectedContext } = ensureProjectedContext();

    // De vrijwel altijd genomen, snelle tak: de gecontroleerde cel is zelf geen controllerveld
    // (dat zijn wbsCode/milestoneKind/mandatory/constraint.hard/isHammock/scheduleDuration/notes),
    // dus de gedeelde controller-alleen-toestandenreeks van deze taak dekt precies dezelfde
    // uitkomsten als de oude, uitputtende prefixlus — nu zonder ze telkens opnieuw te herplannen.
    if (!CONTROLLER_COLUMN_IDS.has(String(edit.columnId))) {
      if (!sharedControllerStates) sharedControllerStates = buildControllerStates(edit);
      let jointlyWritable = false;
      for (const state of sharedControllerStates) {
        projectedTasksById.set(task.id, state.task);
        if (!descriptor.readOnly(state.task, projectedContext)) { jointlyWritable = true; break; }
      }
      if (!jointlyWritable) return { ok: false, errors: [validationError('readOnly', edit, edit.value)] };
      continue;
    }

    // Zeldzame/toekomstige uitzondering: de gecontroleerde cel is zelf (ook) een controllerveld.
    // Geen enkele huidige descriptor doet dit, maar mocht dat ooit veranderen, dan valt dit terug
    // op de oorspronkelijke, uitputtende prefixcontrole — zelfde semantiek, geen snelkoppeling.
    const otherEdits = validatedEdits.filter(candidate => candidate !== edit);
    let jointlyWritable = false;
    for (let prefixLength = 1; prefixLength <= otherEdits.length; prefixLength++) {
      const projected = planTaskCellEdits(task, otherEdits.slice(0, prefixLength), environment);
      if (!projected.ok) continue;
      projectedTasksById.set(task.id, projected.value.task);
      if (!descriptor.readOnly(projected.value.task, projectedContext)) {
        jointlyWritable = true;
        break;
      }
    }
    if (!jointlyWritable) {
      return { ok: false, errors: [validationError('readOnly', edit, edit.value)] };
    }
  }

  const planned = planTaskCellEdits(task, validatedEdits, environment);
  if (!planned.ok) return planned;
  if (planned.value.changed) {
    state.tasks[taskIndex] = planned.value.task;
    if (planned.value.scheduleStale) {
      if (state.datesAsRecorded) {
        state.datesAsRecorded = false;
        state.recordedDates = null;
      }
      markScheduleStale(state);
    }
  }
  return {
    ok: true,
    value: { timephasedGuidanceLost: planned.value.timephasedGuidanceLost },
  };
}

function snapshotsShareAllFields(left: Snapshot, right: Snapshot): boolean {
  for (const key of Object.keys(left) as (keyof Snapshot)[]) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

export function prepareGridMutation(
  state: Readonly<AppState>,
  intents: readonly GridIntent[],
): GridResult<PreparedGridMutation, readonly CellValidationError[]> {
  const flattened = flattenIntents(intents);
  const normalized = normalizeWrites(flattened);
  if (!normalized.ok) return normalized;
  const orderedWrites = orderWritesForDependentTransitions(normalized.value);

  const runtime = buildGridColumnRuntime(state);
  let relationWriteCount = 0;
  for (const write of orderedWrites) {
    if (write.kind === 'relation-set') relationWriteCount++;
  }
  const before = createSnapshot(state as AppState);
  let errors: CellValidationError[] = [];
  const timephasedLossTaskIds = new Set<string>();
  const assignmentValidationTaskIds = new Set<string>();
  const appliedRelationWrites: RelationSetIntent[] = [];
  const isolated = produce(state as AppState, draft => {
    const draftTasksById = new Map(draft.tasks.map(task => [task.id, task] as const));
    const draftTaskIndexById = new Map(draft.tasks.map((task, index) => [task.id, index] as const));
    const draftAssignmentsByTaskId = new Map<string, AppState['assignments']>();
    for (const assignment of draft.assignments) {
      const current = draftAssignmentsByTaskId.get(assignment.taskId);
      if (current) current.push(assignment);
      else draftAssignmentsByTaskId.set(assignment.taskId, [assignment]);
    }
    const assignmentApplyIndexes: TaskAssignmentApplyIndexes = {
      assignmentsByTaskId: draftAssignmentsByTaskId,
      assignmentsById: new Map(draft.assignments.map(assignment => [assignment.id, assignment] as const)),
      usedAssignmentIds: new Set(draft.assignments.map(assignment => assignment.id)),
      tasksById: draftTasksById,
    };
    const cellWritesByTaskId = new Map<string, CellEditIntent[]>();
    for (const write of orderedWrites) {
      if (write.kind !== 'cell-edit') continue;
      const current = cellWritesByTaskId.get(write.taskId);
      if (current) current.push(write);
      else cellWritesByTaskId.set(write.taskId, [write]);
    }
    const appliedCellTaskIds = new Set<string>();
    for (const write of orderedWrites) {
      if (write.kind === 'cell-edit') {
        if (appliedCellTaskIds.has(write.taskId)) continue;
        appliedCellTaskIds.add(write.taskId);
        const taskWrites = cellWritesByTaskId.get(write.taskId) ?? [write];
        const applied = applyCellEdits(draft, taskWrites, runtime, draftTaskIndexById);
        if (!applied.ok) errors.push(...applied.errors);
        else {
          const currentTaskIndex = draftTaskIndexById.get(write.taskId);
          if (currentTaskIndex !== undefined) {
            draftTasksById.set(write.taskId, draft.tasks[currentTaskIndex]);
          }
          if (applied.value.timephasedGuidanceLost) timephasedLossTaskIds.add(write.taskId);
        }
        if (taskWrites.some(item => String(item.columnId) === 'task.isMilestone')) {
          assignmentValidationTaskIds.add(write.taskId);
        }
      } else if (write.kind === 'assignment-set') {
        assignmentValidationTaskIds.add(write.taskId);
        const applied = applyAssignmentSet(
          draft,
          write,
          draftAssignmentsByTaskId.get(write.taskId) ?? [],
          draftTasksById,
          runtime.context.resourcesById,
          assignmentApplyIndexes,
        );
        if (!applied.ok) errors.push(...applied.errors);
        else for (const taskId of applied.value.timephasedGuidanceLostTaskIds) {
          timephasedLossTaskIds.add(taskId);
        }
      } else {
        const applied = applyRelationSet(
          draft as AppState,
          write,
          true,
          relationWriteCount === 1 ? runtime.context.relationIndex : undefined,
        );
        if (!applied.ok) errors.push(...applied.errors);
        else appliedRelationWrites.push(write);
      }
    }
    if (errors.length === 0 && appliedRelationWrites.length > 0) {
      const finalGraph = validateFinalRelationGraph({ tasks: draft.tasks, sequences: draft.sequences });
      if (!finalGraph.ok) {
        errors.push(...finalGraph.errors.map(error => ({
          code: error.code,
          messageKey: error.messageKey,
          tokenIndex: error.tokenIndex,
          start: error.start,
          end: error.end,
          cycle: error.cycle,
          value: error.value,
        })));
      }
    }
    if (errors.length === 0 && appliedRelationWrites.length > 1) {
      const finalRelationIndex = buildTaskRelationIndex(draft.tasks, draft.sequences, draft.cpmResult);
      for (const write of appliedRelationWrites) {
        if (!isParsedRelationTokenArray(write.value)) continue;
        const replay = planRelationSetInBatch({
          tasks: draft.tasks,
          sequences: draft.sequences,
          ownerTaskId: write.taskId,
          direction: write.direction,
          tokens: write.value,
          relationIndex: finalRelationIndex,
        });
        if (!replay.ok) {
          errors.push(...replay.errors.map(error => ({
            code: error.code,
            messageKey: error.messageKey,
            taskId: write.taskId,
            tokenIndex: error.tokenIndex,
            start: error.start,
            end: error.end,
            cycle: error.cycle,
            value: error.value,
          })));
        } else if (replay.value.changed) {
          errors.push(validationError('relationSetConflict', { taskId: write.taskId }, {
            direction: write.direction,
          }));
        }
      }
    }
    if (errors.length === 0) {
      for (const taskId of assignmentValidationTaskIds) {
        const finalAssignments = draftAssignmentsByTaskId.get(taskId) ?? [];
        if (finalAssignments.length === 0) continue;
        const validated = planTaskAssignmentSet({
          taskId,
          tokens: finalAssignments.map(assignment => ({
            assignmentId: assignment.id,
            resourceId: assignment.resourceId,
            unitsPerDay: assignment.unitsPerDay,
            curve: assignment.curve,
          })),
          tasks: draft.tasks,
          resources: draft.resources,
          assignments: draft.assignments,
          tasksById: draftTasksById,
          resourcesById: runtime.context.resourcesById,
        });
        if (!validated.ok) errors.push(...validated.errors);
      }
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  const after = createSnapshot(isolated);
  let viewRows: readonly ViewRow[];
  let resourceLoadResult: ResourceLoadResult | null;
  try {
    viewRows = deriveViewRows(isolated);
    resourceLoadResult = computeReliableResourceLoad(
      after.cpmResult,
      isolated.resources,
      isolated.assignments,
      isolated.tasks,
      isolated.calendar,
      isolated.calendars,
    );
  } catch (error) {
    return { ok: false, errors: [validationError('derivedCalculation', undefined, String(error))] };
  }
  return {
    ok: true,
    value: {
      documentId: state.activeDocumentId,
      before,
      after,
      derivedAfter: { viewRows, resourceLoadResult },
      notifications: [],
      timephasedLossCount: timephasedLossTaskIds.size,
      label: normalized.value.length === 1 ? 'Cel bewerken' : 'Cellen bewerken',
    },
  };
}

function commitPreparedAgainstStore(
  get: StoreGet,
  set: StoreSet,
  prepared: PreparedGridMutation,
  requireFreshBefore = false,
): GridResult<void, readonly GridMutationError[]> {
  if (get().activeDocumentId !== prepared.documentId) {
    return { ok: false, errors: [{ code: 'documentChanged', message: 'Het actieve document is gewijzigd' }] };
  }
  // Alleen de rechtstreeks geëxporteerde test-/diagnosenaad kan tussen prepare en commit worden
  // vastgehouden. De normale wrapper is synchroon en slaat deze onnodige hotpathcheck over.
  if (requireFreshBefore && !snapshotsShareAllFields(createSnapshot(get()), prepared.before)) {
    return { ok: false, errors: [{ code: 'stateChanged', message: 'De documentdata is na prepare gewijzigd' }] };
  }
  const changed = !snapshotsShareAllFields(prepared.before, prepared.after);
  if (changed) {
    try {
      set(state => {
        if (state.activeDocumentId !== prepared.documentId) throw new Error('Het actieve document is gewijzigd');
        restoreSnapshot(state, prepared.after);
        state.viewRows = [...prepared.derivedAfter.viewRows];
        state.resourceLoadResult = prepared.derivedAfter.resourceLoadResult;
        state.isDirty = true;
        recordDocumentDataHistoryDelta(
          state, prepared.label, prepared.documentId, prepared.before, prepared.after,
        );
      });
    } catch (error) {
      return { ok: false, errors: [{ code: 'commitFailed', message: (error as Error).message }] };
    }
  }
  for (const notification of prepared.notifications) get().notify(notification);
  if (changed && prepared.timephasedLossCount > 0) {
    notifyTimephasedLoss(get().notify, prepared.documentId, prepared.timephasedLossCount);
  }
  return { ok: true, value: undefined };
}

export function commitPreparedGridMutation(
  prepared: PreparedGridMutation,
): GridResult<void, readonly GridMutationError[]> {
  const store = getDefaultStore();
  return commitPreparedAgainstStore(store.get, store.set, prepared, true);
}

const runningStores = new WeakSet<StoreGet>();

function runGridMutationAgainstStore(
  get: StoreGet,
  set: StoreSet,
  intents: readonly GridIntent[],
): GridResult<void, readonly CellValidationError[]> {
  if (runningStores.has(get)) {
    return { ok: false, errors: [validationError('reentrant')] };
  }
  runningStores.add(get);
  try {
    if (intents.length === 0) return { ok: true, value: undefined };
    const prepared = prepareGridMutation(get(), intents);
    if (!prepared.ok) return prepared;
    const committed = commitPreparedAgainstStore(get, set, prepared.value);
    return committed.ok
      ? { ok: true, value: undefined }
      : { ok: false, errors: committed.errors.map(error => validationError(error.code)) };
  } finally {
    runningStores.delete(get);
  }
}

export function runGridMutation(
  intents: readonly GridIntent[],
): GridResult<void, readonly CellValidationError[]> {
  const store = getDefaultStore();
  return runGridMutationAgainstStore(store.get, store.set, intents);
}

export const createGridTransactionSlice: AppSlice<GridTransactionSlice> = (set, get) => ({
  runGridMutation: intents => runGridMutationAgainstStore(get, set as StoreSet, intents),
});
