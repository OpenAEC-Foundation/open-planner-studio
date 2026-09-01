import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import type { PlannedTaskEdit } from '@/engine/taskGrid/taskEditPlan';
import type { Task } from '@/types/task';
import type { CellEditIntent, CellValidationError, GridResult } from '@/types/taskGrid';
import { matchProgressRows } from './matchRows';
import type {
  ProgressFieldChange,
  ProgressImportPlan,
  ProgressOverrides,
  ProgressPlanRow,
  ProgressRow,
  ProgressRowReason,
} from './types';
import { PERCENT_EPSILON } from './types';

/** Injecteerbare naad: in productie `planTaskCellEdits` (via `taskSlice.ts`), in de test een stub. */
export interface ProgressPlanDeps {
  planEdits: (
    task: Task,
    edits: readonly CellEditIntent[],
  ) => GridResult<PlannedTaskEdit, readonly CellValidationError[]>;
}

/** Plannerfoutcodes die de preview als hun EIGEN reden toont; alle andere plannerfouten vallen op
 *  `'rejected'` terug, met de originele code in `plannerCode` (A3/T3). */
const KNOWN_PLANNER_REASONS = new Set<string>([
  'actualAfterStatusDate', 'actualFinishBeforeStart', 'conflictingProgressInputs',
]);

function taskLabel(task: Task): string {
  return `${task.wbsCode} — ${task.name}`;
}

/** Datum-only binnenkomende waarde die exact het datumdeel van de huidige waarde herhaalt, is geen
 *  wijziging (A6) — een blad mag een datetime nooit stil tot middernacht degraderen: de vergelijking
 *  gaat de ANDERE kant op (alleen een 10-tekens datum-only invoer telt als mogelijke no-op). */
function isDateNoop(before: string | undefined, incomingIso: string): boolean {
  return before !== undefined && incomingIso.length === 10 && before.slice(0, 10) === incomingIso;
}

/**
 * Bouwt het voortgangsimportplan (issue #27 etappe 2, A3/A6/A11). Puur: geen store, geen I/O.
 * `previewProgressImport`/`applyProgressImport` (`taskSlice.ts`) roepen dit LETTERLIJK dezelfde
 * functie aan — de preview is advies, apply herberekent tegen de live taken (A8).
 *
 * Volgorde per rij (elke `refused` stopt de RIJ, nooit het blad — A3):
 *   1. geen taskId uit de match ⇒ refused (unmatched/ambiguousWbs/duplicateRow)
 *   2. geen enkele voortgangswaarde ⇒ refused/noProgressColumns
 *   3. een onleesbaar veld ⇒ refused/unreadableDate resp. unreadableNumber
 *   4. verzameltaak (`childIds.length > 0`) ⇒ refused/summaryTask — `planTaskCellEdits` bewaakt dit
 *      zelf niet (alleen `mcpValidation` doet dat elders), dus dat hoort hier.
 *   5. no-op-filter (A6, `PERCENT_EPSILON` + datum-only-degradatie) — alleen ECHT veranderende
 *      velden worden een `CellEditIntent`; niets over ⇒ noop.
 *   6. `deps.planEdits(task, edits)` — `ok: false` ⇒ refused met `plannerCode`.
 *   7. `ok: true` ⇒ apply, met de volledig geplande taak en de `changes`-lijst (before uit de
 *      HUIDIGE taak, after uit de GEPLANDE taak).
 * `needsConfirmation` (⇔ `match === 'wbs'`) wordt op ELKE rij gezet die een taak trof, ongeacht de
 * outcome — ook een geweigerde WBS-match blijft "betwijfeld" totdat hij bevestigd of gecorrigeerd is.
 */
export function buildProgressImportPlan(
  rows: readonly ProgressRow[],
  tasks: readonly Task[],
  deps: ProgressPlanDeps,
  overrides?: ProgressOverrides,
): ProgressImportPlan {
  const { matches, ignoredOverrideRows } = matchProgressRows(rows, tasks, overrides);
  const tasksById = new Map(tasks.map(task => [task.id, task] as const));
  const matchByRowNumber = new Map(matches.map(match => [match.rowNumber, match] as const));

  let appliedCount = 0;
  let noopCount = 0;
  let refusedCount = 0;
  let needsLinkCount = 0;
  let needsConfirmationCount = 0;
  const claimedTaskIds = new Set<string>();

  const planRows: ProgressPlanRow[] = rows.map((row): ProgressPlanRow => {
    const match = matchByRowNumber.get(row.rowNumber);
    const needsConfirmation = match?.match === 'wbs' ? true : undefined;
    if (needsConfirmation) needsConfirmationCount++;

    // 1. Geen taskId uit de match.
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

    // 2. Geen enkele voortgangswaarde.
    if (row.completion === undefined && row.actualStart === undefined && row.actualFinish === undefined) {
      refusedCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'refused', reason: 'noProgressColumns',
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [],
      };
    }

    // 3. Een onleesbaar veld.
    if (row.completion?.kind === 'unreadable') {
      refusedCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'refused', reason: 'unreadableNumber',
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

    // 4. Verzameltaak.
    if (task.childIds.length > 0) {
      refusedCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'refused', reason: 'summaryTask',
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [],
      };
    }

    // 5. No-op-filter (A6) — alleen velden die het BLAD zelf echt anders zet, worden een
    // `CellEditIntent`. Dat voorkomt óók dat een ongewijzigde actualStart alsnog
    // `actualAfterStatusDate` triggert nadat de statusdatum naar voren is gezet.
    const edits: CellEditIntent[] = [];
    if (row.completion?.kind === 'value') {
      if (Math.abs(task.time.completion - row.completion.value) >= PERCENT_EPSILON) {
        edits.push({
          kind: 'cell-edit', taskId, columnId: taskColumnId('task.time.completion'),
          route: 'task-progress', value: row.completion.value,
        });
      }
    }
    if (row.actualStart?.kind === 'value') {
      const before = task.time.actualStart;
      const incoming = row.actualStart.iso;
      if (before !== incoming && !isDateNoop(before, incoming)) {
        edits.push({
          kind: 'cell-edit', taskId, columnId: taskColumnId('task.time.actualStart'),
          route: 'task-progress', value: incoming,
        });
      }
    }
    if (row.actualFinish?.kind === 'value') {
      const before = task.time.actualFinish;
      const incoming = row.actualFinish.iso;
      if (before !== incoming && !isDateNoop(before, incoming)) {
        edits.push({
          kind: 'cell-edit', taskId, columnId: taskColumnId('task.time.actualFinish'),
          route: 'task-progress', value: incoming,
        });
      }
    }

    if (edits.length === 0) {
      noopCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'noop',
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [],
      };
    }

    // 6. De echte (of gestubde) planner.
    const planned = deps.planEdits(task, edits);
    if (!planned.ok) {
      const plannerCode = planned.errors[0]?.code;
      const reason: ProgressRowReason = plannerCode && KNOWN_PLANNER_REASONS.has(plannerCode)
        ? plannerCode as ProgressRowReason
        : 'rejected';
      refusedCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'refused', reason, plannerCode,
        match: match.match, needsConfirmation, taskId, taskLabel: label, changes: [],
      };
    }

    // 7. `changes` is een VOLLEDIGE before/after-diff over alle drie de velden op de GEPLANDE taak
    // — niet alleen de velden die het blad zelf aanleverde. `applyProgressInvariants` kan bv. bij
    // 100% completion zelf een actualStart/actualFinish afleiden zonder dat het blad die kolom
    // droeg; die afgeleide wijziging moet net zo goed in de preview staan (T3 Deel 3).
    const changes: ProgressFieldChange[] = [];
    const plannedTime = planned.value.task.time;
    if (Math.abs(task.time.completion - plannedTime.completion) >= PERCENT_EPSILON) {
      changes.push({ field: 'completion', before: task.time.completion, after: plannedTime.completion });
    }
    if (task.time.actualStart !== plannedTime.actualStart) {
      changes.push({ field: 'actualStart', before: task.time.actualStart, after: plannedTime.actualStart });
    }
    if (task.time.actualFinish !== plannedTime.actualFinish) {
      changes.push({ field: 'actualFinish', before: task.time.actualFinish, after: plannedTime.actualFinish });
    }

    appliedCount++;
    return {
      rowNumber: row.rowNumber, outcome: 'apply',
      match: match.match, needsConfirmation, taskId, taskLabel: label,
      changes, plannedTask: planned.value.task,
    };
  });

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
  };
}
