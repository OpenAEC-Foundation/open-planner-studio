import type { PlannedProgressDates } from '@/engine/taskMutationRules';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import type { PlannedTaskEdit } from '@/engine/taskGrid/taskEditPlan';
import type { Task } from '@/types/task';
import type { CellEditIntent, CellValidationError, GridResult } from '@/types/taskGrid';
import { computedFinish, computedStart } from '@/utils/taskDates';
import { matchProgressRows } from './matchRows';
import type {
  ProgressConflictChoices,
  ProgressExportState,
  ProgressField,
  ProgressFieldChange,
  ProgressFieldConflict,
  ProgressFieldKept,
  ProgressImportPlan,
  ProgressOverrides,
  ProgressPlannedShift,
  ProgressPlanRow,
  ProgressRow,
  ProgressRowReason,
} from './types';

export interface ProgressPlanDeps {
  planEdits: (
    task: Task,
    edits: readonly CellEditIntent[],
    plannedDates?: (task: Task) => PlannedProgressDates | undefined,
  ) => GridResult<PlannedTaskEdit, readonly CellValidationError[]>;
  preparePlacement?: (ids: ReadonlySet<string>) => {
    order: readonly string[];
    plannedDates: (task: Task) => PlannedProgressDates | undefined;
    accept: (before: Task, after: Task) => void;
  } | undefined;
}

const KNOWN_PLANNER_REASONS = new Set<string>([
  'actualAfterStatusDate', 'actualFinishBeforeStart', 'conflictingProgressInputs',
  'actualStartRequired',
]);

function taskLabel(task: Task): string {
  return `${task.wbsCode} ${task.name}`;
}

function isDateNoop(before: string | undefined, incomingIso: string): boolean {
  return before !== undefined && incomingIso.length === 10 && before.slice(0, 10) === incomingIso;
}

function isCompletionUnchanged(before: number, incoming: number): boolean {
  const percent = Math.round(incoming * 1e6) / 1e4;
  const decimalDigits = String(Math.abs(percent)).split('.')[1]?.length ?? 0;
  const scale = 100 * 10 ** decimalDigits;
  return Math.round(before * scale) === Math.round(incoming * scale);
}

function isCompletionAsExported(app: number, exported: number): boolean {
  return Math.round(app * 1e6) === Math.round(exported * 1e6);
}

function minuteKey(iso: string): string {
  return iso.replace(' ', 'T').slice(0, 16);
}

function isSheetDateAsExported(exported: string | undefined, incoming: string): boolean {
  if (exported === undefined) return false;
  return minuteKey(exported) === minuteKey(incoming) || isDateNoop(exported, incoming);
}

function isAppDateAsExported(app: string | undefined, exported: string | undefined): boolean {
  if (app === undefined || exported === undefined) return app === exported;
  return minuteKey(app) === minuteKey(exported);
}

function verdictFor(
  sheetAsExported: boolean | undefined,
  appAsExported: boolean | undefined,
): 'edit' | 'kept' | 'conflict' {
  if (sheetAsExported === undefined) return 'edit';
  if (sheetAsExported) return 'kept';
  return appAsExported ? 'edit' : 'conflict';
}

function keepsAppValue(app: Task['time'], planned: Task['time'], field: ProgressField): boolean {
  return field === 'completion'
    ? isCompletionAsExported(planned.completion, app.completion)
    : isAppDateAsExported(planned[field] || undefined, app[field] || undefined);
}

function plannedShifts(task: Task, state: ProgressExportState): ProgressPlannedShift[] {
  const shifts: ProgressPlannedShift[] = [];
  const add = (field: ProgressPlannedShift['field'], exported: string | undefined, current: string) => {
    if (exported && current && exported.slice(0, 10) !== current.slice(0, 10)) {
      shifts.push({ field, exported, current });
    }
  };
  add('start', state.plannedStart, computedStart(task));
  add('finish', state.plannedFinish, computedFinish(task));
  return shifts;
}

export function buildProgressImportPlan(
  rows: readonly ProgressRow[],
  tasks: readonly Task[],
  deps: ProgressPlanDeps,
  overrides?: ProgressOverrides,
  conflictChoices?: ProgressConflictChoices,
): ProgressImportPlan {
  const { matches, ignoredOverrideRows } = matchProgressRows(rows, tasks, overrides);
  const tasksById = new Map(tasks.map(task => [task.id, task] as const));
  const matchByRowNumber = new Map(matches.map(match => [match.rowNumber, match] as const));

  let appliedCount = 0;
  let noopCount = 0;
  let refusedCount = 0;
  let needsLinkCount = 0;
  let needsConfirmationCount = 0;
  let conflictCount = 0;
  let unresolvedConflictCount = 0;
  let appNewerCount = 0;
  let plannedShiftCount = 0;
  let withoutExportStateCount = 0;
  let latestExportedAt: string | undefined;
  const claimedTaskIds = new Set<string>();

  const candidates = new Set<string>();
  if (deps.preparePlacement) {
    for (const row of rows) {
      const id = matchByRowNumber.get(row.rowNumber)?.taskId;
      if (id && (row.completion?.kind === 'value' || row.actualStart?.kind === 'value' || row.actualFinish?.kind === 'value')) {
        candidates.add(id);
      }
    }
  }
  const placement = deps.preparePlacement?.(candidates);
  const planRow = (row: ProgressRow): ProgressPlanRow => {
    const match = matchByRowNumber.get(row.rowNumber);
    const needsConfirmation = match?.match === 'wbs' ? true : undefined;
    if (needsConfirmation) needsConfirmationCount++;

    if (!match?.taskId) {
      const reason: ProgressRowReason = match?.reason ?? 'unmatched';
      if (reason === 'unmatched' || reason === 'ambiguousWbs') needsLinkCount++;
      refusedCount++;
      return { rowNumber: row.rowNumber, outcome: 'refused', reason, changes: [] };
    }
    const taskId = match.taskId;
    claimedTaskIds.add(taskId);
    const task = tasksById.get(taskId)!;
    const label = taskLabel(task);

    if (row.completion === undefined && row.actualStart === undefined && row.actualFinish === undefined) {
      noopCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'noop',
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [],
      };
    }

    if (row.completion?.kind === 'unreadable') {
      refusedCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'refused', reason: 'unreadableNumber',
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [],
      };
    }
    if (row.completion?.kind === 'outOfRange') {
      refusedCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'refused', reason: 'percentOutOfRange',
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [],
      };
    }
    if (row.actualStart?.kind === 'unreadable' || row.actualFinish?.kind === 'unreadable') {
      refusedCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'refused', reason: 'unreadableDate',
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [],
      };
    }

    if (task.childIds.length > 0) {
      refusedCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'refused', reason: 'summaryTask',
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [],
      };
    }

    const exported = row.exportState !== undefined && row.taskId === taskId ? row.exportState : undefined;
    if (exported !== undefined) {
      if (latestExportedAt === undefined || exported.exportedAt > latestExportedAt) latestExportedAt = exported.exportedAt;
    } else if (row.completion !== undefined || row.actualStart !== undefined || row.actualFinish !== undefined) {
      withoutExportStateCount++;
    }
    const shifts = exported !== undefined ? plannedShifts(task, exported) : [];

    const choice = conflictChoices?.get(row.rowNumber);
    const fieldEdits: { edit: CellEditIntent; conflict: boolean }[] = [];
    const conflicts: ProgressFieldConflict[] = [];
    const keptApp: ProgressFieldKept[] = [];
    const routeField = (
      field: ProgressField,
      value: string | number,
      app: string | number | undefined,
      exportedValue: string | number | undefined,
      verdict: 'edit' | 'kept' | 'conflict',
    ) => {
      if (verdict === 'kept') {
        keptApp.push({ field, exported: exportedValue, app });
        return;
      }
      if (verdict === 'conflict') conflicts.push({ field, exported: exportedValue, app, sheet: value });
      fieldEdits.push({
        edit: {
          kind: 'cell-edit', taskId, columnId: taskColumnId(`task.time.${field}`),
          route: 'task-progress', value,
        },
        conflict: verdict === 'conflict',
      });
    };

    if (row.completion?.kind === 'value') {
      const app = task.time.completion;
      const incoming = row.completion.value;
      if (!isCompletionUnchanged(app, incoming)) {
        routeField('completion', incoming, app, exported?.completion, verdictFor(
          exported && isCompletionUnchanged(exported.completion, incoming),
          exported && isCompletionAsExported(app, exported.completion),
        ));
      }
    }
    if (row.actualStart?.kind === 'value') {
      const before = task.time.actualStart;
      const incoming = row.actualStart.iso;
      if (before !== incoming && !isDateNoop(before, incoming)) {
        routeField('actualStart', incoming, before || undefined, exported?.actualStart, verdictFor(
          exported && isSheetDateAsExported(exported.actualStart, incoming),
          exported && isAppDateAsExported(before || undefined, exported.actualStart),
        ));
      }
    }
    if (row.actualFinish?.kind === 'value') {
      const before = task.time.actualFinish;
      const incoming = row.actualFinish.iso;
      if (before !== incoming && !isDateNoop(before, incoming)) {
        routeField('actualFinish', incoming, before || undefined, exported?.actualFinish, verdictFor(
          exported && isSheetDateAsExported(exported.actualFinish, incoming),
          exported && isAppDateAsExported(before || undefined, exported.actualFinish),
        ));
      }
    }

    const sinceExport = {
      ...(conflicts.length > 0 ? { conflicts } : {}),
      ...(choice !== undefined && conflicts.length > 0 ? { conflictChoice: choice } : {}),
      ...(keptApp.length > 0 ? { keptApp } : {}),
      ...(shifts.length > 0 ? { plannedShifts: shifts } : {}),
    };
    if (conflicts.length > 0) conflictCount++;
    if (keptApp.length > 0) appNewerCount++;
    if (shifts.length > 0) plannedShiftCount++;

    if (conflicts.length > 0 && choice === undefined) {
      unresolvedConflictCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'unresolved',
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [], ...sinceExport,
      };
    }

    const edits = fieldEdits
      .filter(entry => !entry.conflict || choice === 'sheet')
      .map(entry => entry.edit);

    if (edits.length === 0) {
      noopCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'noop',
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [], ...sinceExport,
      };
    }

    const planned = deps.planEdits(task, edits, placement?.plannedDates);
    if (!planned.ok) {
      const plannerCode = planned.errors[0]?.code;
      const reason: ProgressRowReason = plannerCode && KNOWN_PLANNER_REASONS.has(plannerCode)
        ? plannerCode as ProgressRowReason
        : 'rejected';
      refusedCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'refused', reason, plannerCode,
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [], ...sinceExport,
      };
    }

    const appFields = [...keptApp.map(kept => kept.field), ...(choice === 'app' ? conflicts.map(c => c.field) : [])];
    if (appFields.some(field => !keepsAppValue(task.time, planned.value.task.time, field))) {
      refusedCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'refused', reason: 'conflictingProgressInputs',
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [], ...sinceExport,
      };
    }

    const changes: ProgressFieldChange[] = [];
    const plannedTime = planned.value.task.time;
    if (row.completion?.kind === 'value'
      && !isCompletionUnchanged(task.time.completion, plannedTime.completion)) {
      changes.push({ field: 'completion', before: task.time.completion, after: plannedTime.completion });
    }
    if (row.actualStart?.kind === 'value' && task.time.actualStart !== plannedTime.actualStart) {
      changes.push({ field: 'actualStart', before: task.time.actualStart, after: plannedTime.actualStart });
    }
    if (row.actualFinish?.kind === 'value' && task.time.actualFinish !== plannedTime.actualFinish) {
      changes.push({ field: 'actualFinish', before: task.time.actualFinish, after: plannedTime.actualFinish });
    }

    appliedCount++;
    placement?.accept(task, planned.value.task);
    return {
      rowNumber: row.rowNumber, outcome: 'apply',
      match: match.match, needsConfirmation, taskId, taskLabel: label,
      changes, plannedTask: planned.value.task, ...sinceExport,
    };
  };
  let planRows: ProgressPlanRow[];
  if (placement) {
    const rank = new Map(placement.order.map((id, index) => [id, index]));
    const orderOf = (row: ProgressRow) => rank.get(matchByRowNumber.get(row.rowNumber)?.taskId ?? '') ?? rank.size;
    const ordered = rows.map((row, index) => ({ row, index }))
      .sort((left, right) => orderOf(left.row) - orderOf(right.row));
    planRows = new Array(rows.length);
    for (const { row, index } of ordered) planRows[index] = planRow(row);
  } else planRows = rows.map(planRow);

  const untouchedTaskCount = tasks.reduce(
    (count, task) => count + (claimedTaskIds.has(task.id) ? 0 : 1), 0,
  );

  return {
    rows: planRows,
    appliedCount,
    noopCount,
    refusedCount,
    needsLinkCount,
    needsConfirmationCount,
    ignoredOverrideRows,
    untouchedTaskCount,
    conflictCount,
    unresolvedConflictCount,
    appNewerCount,
    plannedShiftCount,
    withoutExportStateCount,
    ...(latestExportedAt !== undefined ? { exportedAt: latestExportedAt } : {}),
  };
}
