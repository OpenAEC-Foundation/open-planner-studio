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
 * Precisiebewuste no-op-vergelijking op completion (voortgangsimport-review). Drie fixrondes:
 *
 * Ronde 1 (bevindingen 1+2): een vaste float-epsilon is per constructie stuk — de export rondde
 * destijds af op hele procenten, dus 0.335 kwam als "34" terug en `0.34 - 0.335 =
 * 0.005000000000000004` lag net boven elke drempel die ook "45,5" (E6) nog als echte wijziging
 * moest doorlaten. Opgelost door VORM-bewust te vergelijken i.p.v. drempel-bewust.
 *
 * Ronde 2 (N-B, Opus-hercheck): die vorm-bewuste vergelijking loste zelf een NIEUW probleem op:
 * "100" op een taak van 99,5% verdween stil in de "ongewijzigd"-teller. Ronde 2 maakte 0%/100% toen
 * een harde uitzondering (altijd wijziging bij exact 0 of 1 binnenkomend) én liet `writeCSV`
 * fractionele procenten schrijven, zodat een ongewijzigd blad voor 99,5% ook echt "99.5" terugkwam.
 *
 * Ronde 3 (besluit 2026-09-05, gebruikstest): fractionele procenten in de export bleken zelf de
 * bron van een erger probleem — een spreadsheet met een andere landinstelling leest "8,38" als 838
 * (punt/komma verwisseld als decimaal- vs. duizendtalscheider). `writeCSV` schrijft daarom weer
 * uitsluitend hele procenten (`formatCompletionPercent`). Daarmee kan het bestand "99,5%" en "100%"
 * niet meer uit elkaar houden — de 0%/100%-harde-uitzondering van ronde 2 is dus VERVALLEN. Deze
 * vergelijking is nu ALTIJD precisie-van-de-invoer-bewust, zonder uitzondering: het aantal
 * decimalen dat de invuller zelf typte (0–4, afgeleid uit de binnenkomende waarde) bepaalt de
 * vergelijkingsschaal — "33" (0 decimalen) vergelijkt op hele procenten, dus ook "100" tegen een
 * taak op 99,5% is dan een no-op (bewust: het bestand kan dat niet beter weten), terwijl "33,4"
 * (1 decimaal) op tienden vergelijkt en dus wél een echte wijziging blijft wanneer het document op
 * 33% (of iets anders) stond. Decimale INVOER blijft zo altijd op zijn eigen precisie vergeleken.
 */
function isCompletionUnchanged(before: number, incoming: number): boolean {
  const percent = Math.round(incoming * 1e6) / 1e4; // percentage, float-ruis eruit (max 4 decimalen)
  const decimalDigits = String(Math.abs(percent)).split('.')[1]?.length ?? 0;
  const scale = 100 * 10 ** decimalDigits;
  return Math.round(before * scale) === Math.round(incoming * scale);
}

/**
 * Bouwt het voortgangsimportplan (issue #27 etappe 2, A3/A6/A11). Puur: geen store, geen I/O.
 * `previewProgressImport`/`applyProgressImport` (`taskSlice.ts`) roepen dit LETTERLIJK dezelfde
 * functie aan — de preview is advies, apply herberekent tegen de live taken (A8).
 *
 * Volgorde per rij (elke `refused` stopt de RIJ, nooit het blad — A3):
 *   1. geen taskId uit de match ⇒ refused (unmatched/ambiguousWbs/duplicateRow)
 *   2. geen enkele voortgangswaarde ⇒ noop (niets ingevuld = niets te beoordelen)
 *   3. een onleesbaar veld ⇒ refused/unreadableDate resp. unreadableNumber/percentOutOfRange
 *   4. verzameltaak (`childIds.length > 0`) ⇒ refused/summaryTask — `planTaskCellEdits` bewaakt dit
 *      zelf niet (alleen `mcpValidation` doet dat elders), dus dat hoort hier.
 *   5. no-op-filter (A6, `isCompletionUnchanged` + datum-only-degradatie) — alleen ECHT veranderende
 *      velden worden een `CellEditIntent`; niets over ⇒ noop.
 *   6. `deps.planEdits(task, edits)` — `ok: false` ⇒ refused met `plannerCode`.
 *   7. `ok: true` ⇒ apply, met de volledig geplande taak en de `changes`-lijst — alleen de velden
 *      die de RIJ ZELF aanleverde (fix 2), before uit de HUIDIGE taak, after uit de GEPLANDE taak.
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

    // 2. Geen enkele voortgangswaarde ⇒ ONGEWIJZIGD, geen weigering (gebruikstest 2026-09-11,
    // fix 1): "wat niet is ingevoerd hoeft ook niet beoordeeld te worden". Hier landt ook de
    // verzameltaakrij uit het eigen exportblad, waarvan de drie invulcellen een em-dash-markering
    // dragen (zie `isMarkerCell`, sheetValues.ts) en dus als afwezig binnenkomen. `noProgressColumns`
    // bestaat daarom alleen nog als BESTANDSniveau-`fileIssue` (geen enkele voortgangskolom in het
    // hele blad) — als rij-reden is hij vervallen.
    if (row.completion === undefined && row.actualStart === undefined && row.actualFinish === undefined) {
      noopCount++;
      return {
        rowNumber: row.rowNumber, outcome: 'noop',
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
      if (!isCompletionUnchanged(task.time.completion, row.completion.value)) {
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

    // 7. `changes` toont UITSLUITEND de velden die de RIJ ZELF aanleverde (gebruikstest
    // 2026-09-11, fix 2). Letterlijke wens van de eigenaar: "waarom staat overal → actual start x
    // of y, dat heb ik niet ingevoerd en dat leidt het programma af." `applyProgressInvariants`
    // leidt bij een percentage zelf een actualStart af (en bij 100% ook een actualFinish plus de
    // status); dat gedrag blijft ongewijzigd — die waarden zitten gewoon in `plannedTask` en
    // worden ook echt geschreven — maar ze horen niet in de "dit verandert er"-lijst, want de
    // invuller herkent ze niet als iets dat hij zelf invoerde. De before/after komt nog steeds uit
    // de HUIDIGE resp. de GEPLANDE taak, zodat de preview de echte einduitkomst van dat veld
    // toont (bv. een completion die de planner zelf nog bijstelde) en niet de rauwe bladwaarde.
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
