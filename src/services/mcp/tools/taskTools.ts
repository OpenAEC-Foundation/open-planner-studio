// MCP-toolmodule: mutatietools voor taken en relaties, plus undo/redo. Alle namen dragen
// de service-prefix `planner_`; elke tool draagt een beschrijving (de AI kiest tools op
// beschrijving) en de standaard MCP-annotaties.
//
// Alle échte mutaties lopen via `runMutateTool` → `runInMcpTransaction`: één undo-stap, één
// herberekening, géén bestands-/save-side-effects. Per-item-weigeringen zijn ZACHT (één rotte regel
// rolt nooit alles terug) en komen als `itemRejections` terug; structurele fouten
// (kringverwijzing, taak-niet-gevonden bij een enkelvoudige tool) zijn HARD via `McpStepError`.
//
// `undo`/`redo` lopen NIET via de transactie (ze beheren hun eigen undo-stack) maar wél via
// dezelfde guards (`guardNonTransactional`). Een losse herberekentool is er bewust niet meer: elke
// mutatie die iets wijzigt rekent aan het eind zelf door (`createMcpTransactions.ts`).
import type { McpContext, McpToolDef, McpToolOk, McpToolResult } from '../contracts';
// Alleen als TYPE geïmporteerd: `import type` wordt bij het compileren volledig weggestreept,
// dus dit legt géén runtime-import naar `batchTool` (dat zelf via de leaf-module `toolIndex` opzoekt).
import type { BatchStepTool } from './batchTool';
import {
  guardNonTransactional,
  McpStepError,
  runMutateTool,
  toolError,
  type MutationOutcome,
} from './runtime';
import {
  enrichOk, freshDates, okDirectGuarded, okEnvelope, parsedBatchStep, projectEndInfo, WRITE_ANNOTATIONS,
} from './helpers';
import type { AppState } from '@/state/appStore';
import type { BulkTaskItem } from '@/state/runtime/createMcpTransactions';
import { validate, progress } from '@/state/mcpValidation';
import {
  parseProgress,
  parseTaskFields,
  PROGRESS_FIELD_NAMES,
  TASK_FIELDS_DOC,
  TASK_FIELD_NAMES,
  TASK_FIELD_SCHEMA_PROPERTIES,
  type ProgressPatch,
  type TaskFieldContext,
  type TaskFieldPatch,
} from './taskFields';
import type { SequenceType } from '@/types/sequence';
import type { Task } from '@/types/task';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { isAncestorRelation, relationKey } from '@/state/relationRules';
import { moveTaskVerdict } from '@/state/slices/taskSlice';
// De relatie-NOTATIE (type-aliassen, lag-vormen, schema-fragmenten) woont in de gedeelde veldlaag
// `sequenceFields.ts` — één implementatie voor `add_dependencies` hier, `update_dependencies` in
// `dependencyTools.ts` en de leeskant in `readTools.ts`. Zie de kop van dat bestand.
import {
  ANCESTOR_RELATION_REJECTION,
  LAG_DOC,
  LAG_SCHEMA,
  lagPatchOf,
  parseLag,
  normalizeSeqType,
  selfRelationReason,
  SEQ_TYPE_SCHEMA,
  unknownTypeReason,
  type ParsedLag,
} from './sequenceFields';
import type { PhaseTransitionReport } from '@/state/structuralTransition';
import { watchAncestorRelations } from '@/state/hierarchyRelationNotice';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { localTodayIso } from '@/utils/dateUtils';
import { ancestorIds } from '@/utils/wbs';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';
import { hasConcreteWorkBlocks } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';
import { markDocumentEdited } from '@/state/documentEdited';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import type { SplitPiece } from '@/engine/scheduler/splitEdit';
import { interruptionsOf, planTaskSplits } from './splitFields';

// De gedeelde post-transactie-helpers (okEnvelope/freshDates/projectEndInfo/enrichOk/okDirect) staan
// in `./helpers.ts` — dezelfde conventie geldt voor de kalender-/resource-tools.

// --- batchStep-kernen ----------------------------------------------------------------------------
//
// Elke bulk-mutatietool is opgesplitst in drie stukken, zodat hij zowel los (via `handler`) als als
// batch-stap (via `batchStep`) bruikbaar is — met exact ÉÉN implementatie van de mutatie:
//   1. `parseX(args)`  — pure vormvalidatie; geeft de geparste args terug, of een foutboodschap als
//                        string. Beide aanroepers zetten die string om in hún foutvorm.
//   2. `xCore(...)`    — de SYNCHRONE, transactie-vrije mutatie ⇒ `MutationOutcome`. Opent zelf géén
//                        transactie, pusht geen snapshot en draait geen CPM: de eigenaar (losse call
//                        = `runMutateTool`, batch = `planner_batch`) bezit die.
//   3. `handler`       — guards + backup + eigen transactie via `runMutateTool`, en verrijkt de Ok met
//                        verse datums (`enrichOk`). Die verrijking is bewust NIET in de kern gezet: in
//                        een batch is de planning midden-in nog niet herberekend, dus verse datums per
//                        stap zouden daar liegen; `planner_batch` rapporteert de kale kern-`data` en
//                        herberekent aan het eind.
// `batchStep` gooit waar de handler een `McpToolErr` teruggeeft: binnen een batch is een vormfout een
// STRUCTURELE stapfout die de hele batch hoort terug te rollen, geen zachte weigering.
// Die vorm is voor elke tool gelijk en staat daarom één keer in `helpers.ts` (`parsedBatchStep`).

/** "Wordt fase" — gedeeld door add_tasks en move_task. */
const PHASE_TRANSITION_DOC =
  'If an existing task with resource assignments thereby gets its FIRST subtask (it becomes a phase), those ' +
  'assignments move to the first new subtask that may carry them (not a milestone or phase); a milestone ' +
  'that becomes a phase this way loses its milestone flag. The answer reports this in `phaseTransitions`. If ' +
  'that cannot be done cleanly (no suitable subtask, or it already has the same resource), the whole call ' +
  'fails (VALIDATION) and nothing changes.';

// =================================================================================================
// planner_add_tasks
// =================================================================================================
/** Bouw de validatiecontext voor de veld-allowlist. `task` afwezig ⇒ een NIEUWE taak (add_tasks). */
function fieldContext(
  s: AppState,
  task?: Task,
): TaskFieldContext {
  return {
    currentIsMilestone: task?.isMilestone ?? false,
    hasChildren: isSummaryTask(task),
    hasAssignments: task ? s.assignments.some((a) => a.taskId === task.id) : false,
    currentConstraint2: task?.constraint2,
    // De projectkalender-id telt mee: op een vers document staat die alleen als cache in `s.calendar`
    // (`calendars` is dan leeg), maar hij is wel degelijk een geldige taak-kalender.
    calendarExists: (id: string) => s.calendars.some((c) => c.id === id) || id === s.calendar.id,
    customTaskTypes: s.customTaskTypes,
    durationCalendar: (requestedId) => {
      const id = requestedId === undefined ? task?.calendarId : requestedId ?? undefined;
      const calendar = resolveCalendar(id, s.calendars, s.calendar);
      return {
        hoursPerDay: effHoursPerDay(calendar),
        hasWorkBlocks: hasConcreteWorkBlocks(calendar),
      };
    },
  };
}

/** Eén geparst `add_tasks`-item: de bulk-only sleutels apart, de rest als gevalideerde veld-patch. */
interface ParsedAddItem {
  tempId: string;
  parentId?: string;
  position?: number;
  patch: TaskFieldPatch;
}

/** Vormvalidatie van `add_tasks`; string = foutboodschap. */
function parseAddTasks(args: unknown, state: AppState): ParsedAddItem[] | string {
  const a = (args ?? {}) as { tasks?: unknown };
  if (!Array.isArray(a.tasks) || a.tasks.length === 0) {
    return 'add_tasks requires a non-empty `tasks` array';
  }
  const seenTemp = new Set<string>();
  const parsed: ParsedAddItem[] = [];
  for (const it of a.tasks) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return 'every task item must be an object';
    const raw = it as Record<string, unknown>;
    if (typeof raw.tempId !== 'string' || typeof raw.name !== 'string') {
      return 'every task item requires a string `tempId` and `name`';
    }
    // Statische toolniveau-fout: dubbele tempId ⇒ VALIDATION VÓÓR enige transactie/backup (geen
    // spurious snapshot; draft.addTasks zou dit anders pas ín de transactie als throw vangen).
    const tid = raw.tempId;
    if (seenTemp.has(tid)) return `duplicate tempId '${tid}' within the call`;
    seenTemp.add(tid);
    if (raw.parentId !== undefined && typeof raw.parentId !== 'string') {
      return `task '${tid}': \`parentId\` must be a string (existing task id or tempId from this call)`;
    }
    if (raw.position !== undefined && (typeof raw.position !== 'number' || !Number.isInteger(raw.position))) {
      return `task '${tid}': \`position\` must be an integer`;
    }
    // De inhoudelijke velden lopen door DEZELFDE allowlist als `update_tasks.fields` — een onbekende
    // sleutel (`duration_days`, `time`, …) is hier een HARDE VALIDATION-fout: add_tasks kent geen
    // per-item-weigering (het contract is de volledige tempId→realId-map, alles of niets).
    const { tempId: _t, parentId: _p, position: _pos, ...fields } = raw;
    void _t; void _p; void _pos;
    const res = parseTaskFields(fields, fieldContext(state));
    if (!res.ok) return `task '${tid}': ${res.reason}`;
    parsed.push({
      tempId: tid,
      ...(typeof raw.parentId === 'string' ? { parentId: raw.parentId } : {}),
      ...(typeof raw.position === 'number' ? { position: raw.position } : {}),
      patch: res.patch,
    });
  }
  return parsed;
}

/**
 * Synchrone, transactie-vrije kern van `add_tasks`. Vertaalt de duur-velden naar het `time`-object
 * dat `draft.addTask` verwacht: ALTIJD via `createDefaultTaskTime` (die leidt ook een consistente
 * `scheduleFinish` af) — nooit een met de hand gevuld half `TaskTime`.
 */
function addTasksCore(ctx: McpContext, items: ParsedAddItem[]): MutationOutcome {
  const st = ctx.app.store.getState();
  for (const item of items) {
    if (item.patch.customTaskType) ctx.transactions.draft.ensureCustomTaskType(item.patch.customTaskType);
  }
  const anchor = st.project.startDate || localTodayIso();
  const bulk: BulkTaskItem[] = items.map((it) => {
    const top = it.patch.top;
    const tp = it.patch.time;
    let time: Task['time'] | undefined;
    if (tp) {
      // Geen expliciete duur ⇒ dezelfde default als draft.addTask (mijlpaal 0, anders 5 werkdagen).
      const unit = tp.durationUnit ?? 'days';
      const nativeAmount = unit === 'hours'
        ? (tp.durationMinutes ?? 0) / 60
        : (tp.scheduleDuration ?? (top.isMilestone ? 0 : 5));
      // Een urentaak krijgt haar ingevoerde einde op de echte taakkalender (start + duur).
      time = createDefaultTaskTime(anchor, nativeAmount, unit,
        resolveCalendar(typeof top.calendarId === 'string' ? top.calendarId : undefined, st.calendars, st.calendar));
      if (tp.scheduleDuration !== undefined) time.scheduleDuration = tp.scheduleDuration;
      if (tp.durationMinutes !== undefined) time.durationMinutes = tp.durationMinutes;
      if (tp.durationType !== undefined) time.durationType = tp.durationType;
    }
    return {
      ...top,
      // Een nieuwe taak heeft nog geen toewijzingen, dus de werkregel is hier een kaal veld.
      ...(it.patch.workRule ? { workRule: it.patch.workRule } : {}),
      name: top.name as string,
      tempId: it.tempId,
      ...(it.parentId !== undefined ? { parentId: it.parentId } : {}),
      ...(it.position !== undefined ? { position: it.position } : {}),
      ...(time ? { time } : {}),
    };
  });
  const phaseTransitions: PhaseTransitionReport[] = [];
  const map = ctx.transactions.draft.addTasks(bulk, phaseTransitions);
  return {
    data: {
      created: Object.fromEntries(map),
      ...(phaseTransitions.length > 0 ? { phaseTransitions } : {}),
    },
  };
}

const addTasks: BatchStepTool = {
  name: 'planner_add_tasks',
  description:
    'Create one or more tasks (nested WBS in one call). Every item has a client-chosen `tempId` (unique ' +
    'within the call); `parentId` may be an existing task id or a `tempId` from the same call. A tempId MUST ' +
    'start with `tmp-` or `tmp_` (e.g. `tmp-foundation`) — that is the RESERVED syntax by which later ' +
    '`planner_batch` steps recognize their references; the schema now enforces that form everywhere, so the ' +
    'same call works inside and outside a batch. `position` is the insertion index within the parent and is ' +
    'silently clamped to [0, number of siblings]. Give the DURATION directly with `duration` and optionally ' +
    '`durationUnit` (`days`/`hours`; without a duration a task gets the default of 5 working days). A ' +
    'milestone (`isMilestone`) has duration 0 by definition — `duration` > 0 is an error there. ' +
    `${TASK_FIELDS_DOC} For add_tasks an unknown key is a HARD error (the whole call fails), not a per-item ` +
    `refusal. ${PHASE_TRANSITION_DOC} Returns the complete tempId→realId map, the recalculated ` +
    'earlyStart/earlyFinish per created task and the project end.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        minItems: 1,
        description: 'The tasks to create (created top-down; tempId parents may appear in any order).',
        items: {
          type: 'object',
          required: ['tempId', 'name'],
          properties: {
            tempId: {
              type: 'string',
              pattern: '^tmp[-_]',
              description:
                'Client-chosen temporary id, unique within the call; key in the returned map. MUST start ' +
                'with `tmp-` or `tmp_` (reserved batch syntax, e.g. `tmp-foundation`): only then can ' +
                'planner_batch safely replace references in later steps without ever hitting free text. This ' +
                'requirement applies everywhere, also outside a batch (the schema enforces it).',
            },
            parentId: { type: 'string', description: 'Existing task id or a tempId from the same call; omitted = root.' },
            position: { type: 'integer', description: 'Insertion index within the parent; silently clamped to [0, number of siblings].' },
            // Exact dezelfde velden als `update_tasks.fields` — één allowlist voor aanmaken én wijzigen.
            ...TASK_FIELD_SCHEMA_PROPERTIES,
          },
          additionalProperties: false,
        },
      },
    },
    required: ['tasks'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseAddTasks, addTasksCore),
  async handler(args, ctx) {
    const parsed = parseAddTasks(args, ctx.app.store.getState());
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => addTasksCore(ctx, parsed));
    return enrichOk(res, () => {
      const core = (res as McpToolOk).data as { created: Record<string, string>; phaseTransitions?: PhaseTransitionReport[] };
      const state = ctx.app.store.getState();
      return {
        created: core.created,
        ...(core.phaseTransitions ? { phaseTransitions: core.phaseTransitions } : {}),
        tasks: freshDates(state, Object.values(core.created)),
        ...projectEndInfo(state),
      };
    });
  },
};

// =================================================================================================
// planner_update_tasks
// =================================================================================================
const FORBIDDEN_PROGRESS_IN_FIELDS = (fields: any): string | null => {
  if (fields && typeof fields === 'object') {
    if ('status' in fields) return 'use `progress`, not `fields.status`, for progress';
    const time = fields.time;
    if (time && typeof time === 'object' && ('completion' in time || 'actualStart' in time || 'actualFinish' in time)) {
      return 'use `progress`, not `fields.time.*`, for progress/actuals';
    }
  }
  return null;
};

/**
 * Valideer `fields` van één update-item tegen de allowlist (`taskFields.ts`), ná het
 * voortgangs-verbod. Retourneert de te schrijven patch of een reden. ALLES-OF-NIETS per item: is er
 * ook maar één onbekende/ongeldige sleutel, dan wordt het hele `fields`-blok geweigerd en blijft de
 * taak ONGEWIJZIGD (een `progress` in hetzelfde item loopt wél gewoon door — bewuste granulariteit).
 */
function resolveFieldsPatch(
  state: AppState,
  id: string,
  fields: unknown,
): { ok: true; patch: TaskFieldPatch } | { ok: false; reason: string } {
  const forbidden = FORBIDDEN_PROGRESS_IN_FIELDS(fields);
  if (forbidden) return { ok: false, reason: forbidden };
  const task = state.tasks.find((t) => t.id === id);
  const res = parseTaskFields(fields, fieldContext(state, task));
  return res.ok ? { ok: true, patch: res.patch } : { ok: false, reason: res.reason };
}

/** Statische pre-classificatie van één update-item (existentie + fields- én progress-VORMvalidatie),
 *  gedeeld door het lege-batch-snelpad en (impliciet) de transactie-fn. De INHOUDELIJKE
 *  progress-checks (bereik, statusdatum, verzameltaak) blijven dynamisch — die kent alleen
 *  `applyProgressUpdate` (zie de restgeval-noot bij de handler). */
function classifyUpdate(
  state: AppState,
  u: { id: string; fields?: any; progress?: any },
): { executable: true } | { executable: false; rejection: { id: string; reason: string } } {
  const missing = validate.taskExists(state, u.id);
  if (missing) return { executable: false, rejection: missing };
  const hasFields = u.fields !== undefined;
  const fieldsRes = hasFields ? resolveFieldsPatch(state, u.id, u.fields) : null;
  const progRes = u.progress !== undefined ? parseProgress(u.progress) : null;
  if ((fieldsRes && fieldsRes.ok) || (progRes && progRes.ok)) return { executable: true };
  const reason =
    fieldsRes && !fieldsRes.ok
      ? fieldsRes.reason
      : progRes && !progRes.ok
        ? progRes.reason
        : 'no `fields` or `progress` given';
  return { executable: false, rejection: { id: u.id, reason } };
}

/** Vormvalidatie van `update_tasks`; string = foutboodschap. */
function parseUpdateTasks(args: unknown): { id: string; fields?: any; progress?: any }[] | string {
  const a = (args ?? {}) as { updates?: unknown };
  if (!Array.isArray(a.updates) || a.updates.length === 0) {
    return 'update_tasks requires a non-empty `updates` array';
  }
  return a.updates as { id: string; fields?: any; progress?: any }[];
}

/** Een duurwijziging van een lopende taak past het percentage en de restduur aan
 *  (`runningDurationChange`): wat `update_tasks` daarover terugmeldt. */
interface ProgressAdjusted {
  id: string;
  /** Nieuw percentage voltooid (0–100, op twee decimalen; intern onafgerond). */
  completion: number;
  /** Nieuwe restduur in de eigen eenheid van de taak (`durationUnit`). */
  remaining: number;
  durationUnit: 'days' | 'hours';
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Weigeringsreden bij een duur korter dan het gedane werk van een lopende taak. */
function durationBelowDoneWorkReason(refused: { done: number; unit: 'days' | 'hours' }, completion: number): string {
  const unit = refused.unit === 'hours' ? 'hours' : 'working days';
  return `the task is already ${Math.round(completion * 100)}% done (${round2(refused.done)} ${unit} of work ` +
    'done): a new duration shorter than the work done is not possible — the work done stays the same on a ' +
    `duration change. Choose a duration of at least ${round2(refused.done)} ${unit}, or adjust the progress ` +
    'first (`progress`)';
}

/** Synchrone, transactie-vrije kern van `update_tasks`. */
function updateTasksCore(ctx: McpContext, updates: { id: string; fields?: any; progress?: any }[]): MutationOutcome {
  const statusDate = ctx.app.store.getState().project.statusDate;
  const rejections: { id: string; reason: string }[] = [];
  const applied: string[] = [];
  const progressAdjusted: ProgressAdjusted[] = [];
  for (const u of updates) {
    const id = u.id;
    const exists = validate.taskExists(ctx.app.store.getState(), id);
    if (exists) { rejections.push(exists); continue; }
    let touched = false;
    let rejectedHere = false;
    if (u.fields !== undefined) {
      const res = resolveFieldsPatch(ctx.app.store.getState(), id, u.fields);
      if (!res.ok) { rejections.push({ id, reason: res.reason }); rejectedHere = true; }
      else {
        // Eerst de patch: weigert die (duur korter dan het gedane werk van een lopende taak), dan blijft
        // ook het persoonlijke taaktype weg — geen halve merge.
        const completionBefore = ctx.app.store.getState().tasks.find(t => t.id === id)?.time.completion ?? 0;
        const outcome = ctx.transactions.draft.patchTaskFields(id, res.patch.top, res.patch.time);
        if (outcome && 'refused' in outcome) {
          rejections.push({ id, reason: durationBelowDoneWorkReason(outcome.refused, completionBefore) });
          rejectedHere = true;
        } else {
          if (res.patch.customTaskType) ctx.transactions.draft.ensureCustomTaskType(res.patch.customTaskType);
          // De werkregel via de driehoek-bewuste draft-actie, ná de duurpatch (zodat een gelijktijdige
          // `duration` onder de OUDE regel wordt verwerkt en de nieuwe regel het restwerk van dát moment
          // vastlegt).
          if (res.patch.workRule !== undefined) ctx.transactions.draft.setTaskWorkRule(id, res.patch.workRule ?? undefined);
          if (outcome && 'progress' in outcome) {
            const hours = outcome.progress.remainingMinutes !== undefined;
            progressAdjusted.push({
              id,
              completion: round2(outcome.progress.completion * 100),
              remaining: hours ? round2(outcome.progress.remainingMinutes! / 60) : round2(outcome.progress.remainingTime),
              durationUnit: hours ? 'hours' : 'days',
            });
          }
          touched = true;
        }
      }
    }
    if (u.progress !== undefined) {
      // VORM eerst: `applyProgressUpdate` leest exact completion/actualStart/actualFinish en negeert
      // al het overige — `progress: { percent: 50 }` zou als `{ applied: true }` terugkomen terwijl er
      // niets gebeurt. Een onbekende sleutel of een leeg blok is daarom een ZACHTE weigering met naam
      // en reden.
      const shape = parseProgress(u.progress);
      if (!shape.ok) { rejections.push({ id, reason: shape.reason }); rejectedHere = true; }
      else {
        const patch: ProgressPatch = shape.value;
        let pr: { applied: true } | { applied: false; reason: string } = { applied: false, reason: 'not executed' };
        ctx.app.store.setState((s) => { pr = progress.applyProgressUpdate(s, id, patch, statusDate); });
        if (pr.applied) touched = true;
        else { rejections.push({ id, reason: pr.reason }); rejectedHere = true; }
      }
    }
    if (touched) applied.push(id);
    else if (!rejectedHere) rejections.push({ id, reason: 'no `fields` or `progress` given' });
  }
  return {
    data: { updated: applied, ...(progressAdjusted.length > 0 ? { progressAdjusted } : {}) },
    itemRejections: rejections,
  };
}

const updateTasks: BatchStepTool = {
  name: 'planner_update_tasks',
  description:
    'Change existing tasks. Per item: `fields` (name, DURATION plus `durationUnit`, constraints, deadline, ' +
    'calendar, …; NO progress fields) and/or `progress` (progress path: ONLY `completion` in PERCENT 0–100, ' +
    '`actualStart` and `actualFinish` as ISO dates — any other key, and an empty `progress` object, is ' +
    `softly REFUSED per item, never silently ignored). ${TASK_FIELDS_DOC} A refused \`fields\` block leaves ` +
    'the task completely UNCHANGED (never a half merge). Progress requires a project status date: without a ' +
    'status date `progress` is refused per item — set it first with planner_update_project → `statusDate` ' +
    '(the reporting date); the AI connection does not choose it itself. Progress > 0 derives the actualStart ' +
    'from the planned start, EXCEPT when that planned start lies after the status date: then the item is ' +
    'refused and you pass `actualStart` (≤ status date) yourself. Actuals after the project status date or ' +
    'outside 0–100 are softly refused per item — valid items stay. A SUMMARY TASK (phase) has no progress of ' +
    'its own: its completion, status, actualStart (earliest of the leaf tasks) and actualFinish (latest, ' +
    'only once all leaf tasks are done) are derived on every recalculation, so `progress` on a phase is ' +
    'softly refused — set it on the leaf tasks. A DURATION CHANGE on a running task (started, not yet ' +
    'completed) keeps the work done the same, like MS Project: remaining duration = new duration − work done ' +
    'and the percentage adjusts (10 d at 40% → 12 d ⇒ 8 d left, 33%); the result reports those tasks in ' +
    '`progressAdjusted` (completion in percent, remaining in the task\'s own unit). A duration shorter than ' +
    'the work done is softly refused per item. Lever tip: hypothetical overrun = duration or SNET constraint ' +
    '(via `fields`); recorded progress = actuals with a status date (via `progress`). Note: one task id can ' +
    'appear in both `updated` and the refusals at the same time (e.g. `fields` refused but `progress` ' +
    'applied) — deliberate granularity.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      updates: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
            fields: {
              type: 'object',
              description:
                `Fields to change (explicit allowlist: ${TASK_FIELD_NAMES.join(', ')}). Names mirror ` +
                'planner_get_task. An unknown key is refused — never silently ignored.',
              properties: { ...TASK_FIELD_SCHEMA_PROPERTIES },
              additionalProperties: false,
            },
            progress: {
              type: 'object',
              description:
                `Progress path (explicit allowlist: ${PROGRESS_FIELD_NAMES.join(', ')}). An unknown key ` +
                '(`percent`, `status`, …) is refused with a reason — never silently ignored — and so is an ' +
                'empty `progress` object: give at least one of the three.',
              properties: {
                completion: { type: 'number', minimum: 0, maximum: 100, description: 'Completion in PERCENT (0–100).' },
                actualStart: { type: ['string', 'null'], description: 'ISO date; must not lie after the status date. null clears it. Required for progress on a task without an actual start whose planned start lies after the status date.' },
                actualFinish: { type: ['string', 'null'], description: 'ISO date; ≥ actualStart and not after the status date. null clears it.' },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
    },
    required: ['updates'],
    additionalProperties: false,
  },
  // Géén lege-batch-snelpad nodig: dat snelpad bestaat alleen om een overbodige TRANSACTIE (snapshot +
  // redo-wipe + backup) te vermijden, en binnen een batch bezit `planner_batch` die al. Zijn er nul
  // uitvoerbare items, dan levert de kern gewoon `updated: []` met alle weigeringen.
  batchStep: parsedBatchStep(parseUpdateTasks, updateTasksCore),
  async handler(args, ctx) {
    const parsed = parseUpdateTasks(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const updates = parsed;
    // Lege-batch-snelpad: zijn er statisch nul uitvoerbare items (alle id's
    // onbekend / alleen verboden fields / niets opgegeven), return dan direct Ok mét de weigeringen —
    // zónder transactie/backup/snapshot/redo-wipe. RESTGEVAL: een item dat pas DYNAMISCH wordt
    // geweigerd (bv. progress buiten 0–100 op een bestaande taak) telt hier wél als uitvoerbaar en
    // betreedt de transactie; is er verder nul effect, dan kan die ene transactie nog een snapshot
    // pushen. Bewuste rest — de meest voorkomende klasse (existentie/statische fouten) valt hier vooraf af.
    {
      const st = ctx.app.store.getState();
      const staticRej: { id: string; reason: string }[] = [];
      let anyExecutable = false;
      for (const u of updates) {
        const c = classifyUpdate(st, u);
        if (c.executable) anyExecutable = true;
        else staticRej.push(c.rejection);
      }
      if (!anyExecutable) {
        return okDirectGuarded(ctx, { updated: [], tasks: [], projectEnd: projectEndInfo(st).projectEnd }, staticRej);
      }
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => updateTasksCore(ctx, updates));
    return enrichOk(res, () => {
      const { updated, progressAdjusted } = (res as McpToolOk).data as { updated: string[]; progressAdjusted?: ProgressAdjusted[] };
      const state = ctx.app.store.getState();
      return {
        updated, tasks: freshDates(state, updated), projectEnd: projectEndInfo(state).projectEnd,
        ...(progressAdjusted ? { progressAdjusted } : {}),
      };
    });
  },
};

// =================================================================================================
// planner_delete_tasks
// =================================================================================================
/** Vormvalidatie van `delete_tasks`; string = foutboodschap. */
function parseIdList(args: unknown, toolLabel: string): string[] | string {
  const a = (args ?? {}) as { ids?: unknown };
  if (!Array.isArray(a.ids) || a.ids.length === 0) {
    return `${toolLabel} requires a non-empty \`ids\` array`;
  }
  return a.ids as string[];
}

/**
 * Synchrone, transactie-vrije kern van `delete_tasks`.
 *
 * `draft.deleteTask` verwijdert de héle subboom plus de relaties en toewijzingen daarvan. Eén
 * verzameltaak wissen kan zo dertig taken meenemen; daarom wordt het volledige VOOR/NA-verschil
 * gerapporteerd (`deletedTaskIds`, `deletedTaskCount`, `cascadedTaskIds` + de meegewiste
 * relaties/toewijzingen), en een id dat al door een eerdere cascade
 * verdween telt als SUCCES (`deleted`), niet als weigering.
 */
function deleteTasksCore(ctx: McpContext, ids: string[]): MutationOutcome {
  const before = ctx.app.store.getState();
  const existedBefore = new Set(before.tasks.map((t) => t.id));
  const seqBefore = before.sequences.length;
  const asgBefore = before.assignments.length;

  const rejections: { id: string; reason: string }[] = [];
  // Set: een id dat tweemaal in `ids` staat mag niet tweemaal in het rapport belanden.
  const deletedSet = new Set<string>();
  for (const id of ids) {
    const exists = validate.taskExists(ctx.app.store.getState(), id);
    if (exists) {
      // Al meegenomen door de cascade van een eerder id in DEZELFDE call (of een dubbel id) ⇒ succes.
      if (existedBefore.has(id)) { deletedSet.add(id); continue; }
      rejections.push(exists);
      continue;
    }
    ctx.transactions.draft.deleteTask(id);
    deletedSet.add(id);
  }
  const deleted = [...deletedSet];

  const after = ctx.app.store.getState();
  const stillThere = new Set(after.tasks.map((t) => t.id));
  const deletedTaskIds = [...existedBefore].filter((id) => !stillThere.has(id));
  const requested = new Set(ids);
  return {
    data: {
      deleted,
      deletedTaskIds,
      deletedTaskCount: deletedTaskIds.length,
      cascadedTaskIds: deletedTaskIds.filter((id) => !requested.has(id)),
      removedDependencyCount: seqBefore - after.sequences.length,
      removedAssignmentCount: asgBefore - after.assignments.length,
    },
    itemRejections: rejections,
  };
}

const deleteTasks: BatchStepTool = {
  name: 'planner_delete_tasks',
  description:
    'Delete tasks by id INCLUDING THEIR COMPLETE SUBTREE, plus all their relationships and assignments — ' +
    'deleting one summary task can therefore take many more tasks with it than you gave. That is why the ' +
    'tool reports what is REALLY gone: `deletedTaskIds` (all deleted tasks), `deletedTaskCount`, ' +
    '`cascadedTaskIds` (the tasks deleted along without being asked) and ' +
    '`removedDependencyCount`/`removedAssignmentCount`; `deleted` stays the requested ids. An id that ' +
    'already disappeared through the cascade of another id from the same call counts as success. An id that ' +
    'never existed is softly refused per item.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: { ids: { type: 'array', minItems: 1, items: { type: 'string' } } },
    required: ['ids'],
    additionalProperties: false,
  },
  // Zie de noot bij update_tasks: het lege-batch-snelpad is puur transactie-vermijding en dus
  // overbodig binnen een batch.
  batchStep: parsedBatchStep((args: unknown) => parseIdList(args, 'delete_tasks'), deleteTasksCore),
  async handler(args, ctx) {
    const parsed = parseIdList(args, 'delete_tasks');
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const ids = parsed;
    // Lege-batch-snelpad: bestaat geen enkel id, return dan direct Ok mét de
    // weigeringen — zónder transactie/backup/snapshot/redo-wipe.
    {
      const st = ctx.app.store.getState();
      const staticRej = validate.tasksExist(st, ids);
      if (staticRej.length === ids.length) {
        return okDirectGuarded(
          ctx,
          {
            deleted: [],
            deletedTaskIds: [],
            deletedTaskCount: 0,
            cascadedTaskIds: [],
            removedDependencyCount: 0,
            removedAssignmentCount: 0,
            projectEnd: projectEndInfo(st).projectEnd,
          },
          staticRej,
        );
      }
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => deleteTasksCore(ctx, ids));
    return enrichOk(res, () => ({
      // Het volledige cascade-rapport uit de kern doorgeven — niet alleen `deleted`.
      ...((res as McpToolOk).data as object),
      projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd,
    }));
  },
};

// =================================================================================================
// planner_move_task — via `draft.moveTask`: dezelfde verhanging als de slice-actie `moveTask`
// (`reparentTask`) plus de gedeelde "wordt fase"-regel, maar zonder UI-melding; een verhuisde
// toewijzing staat als `phaseTransitions` in het antwoord.
// =================================================================================================
/** Vormvalidatie van `move_task`; string = foutboodschap. */
function parseMoveTask(args: unknown): { id: string; newParentId: string | null; position?: number } | string {
  const a = (args ?? {}) as { id?: unknown; newParentId?: unknown; position?: unknown };
  if (typeof a.id !== 'string') return 'move_task requires a string `id`';
  if (!(a.newParentId === null || typeof a.newParentId === 'string')) {
    return '`newParentId` must be a string or null';
  }
  // Een niet-numerieke `position` hard weigeren: stil weggooien zou verderop `Math.min(NaN, …)` ⇒
  // `splice(NaN)` ⇒ gedrag als index 0 geven. De stille klem naar [0, aantal siblings] is
  // gedocumenteerd en blijft; niet-numerieke invoer is dat niet.
  if (a.position !== undefined && (typeof a.position !== 'number' || !Number.isInteger(a.position))) {
    return '`position` must be an integer (insertion index within the parent)';
  }
  return {
    id: a.id,
    newParentId: a.newParentId as string | null,
    ...(typeof a.position === 'number' ? { position: a.position } : {}),
  };
}

/** Synchrone, transactie-vrije kern van `move_task`. Structurele fouten (onbekend id, kringouder,
 *  een kring in de relaties via de nieuwe fase) gooien een `McpStepError` — die code overleeft de
 *  rollback van beide aanroepers. */
function moveTaskCore(ctx: McpContext, p: { id: string; newParentId: string | null; position?: number }): MutationOutcome {
  const { id, newParentId, position } = p;
  const st = ctx.app.store.getState();
  if (!st.tasks.some((t) => t.id === id)) throw new McpStepError('NOT_FOUND', `task '${id}' does not exist`);
  if (newParentId !== null) {
    if (!st.tasks.some((t) => t.id === newParentId)) {
      throw new McpStepError('NOT_FOUND', `new parent '${newParentId}' does not exist`);
    }
    // Cykel-preventie: newParentId mag niet id zelf of een afstammeling van id zijn. `ancestorIds`
    // is cyclusveilig: een corrupte parentId-cyclus elders in de boom liet deze wandeling hangen.
    const parentById = new Map(st.tasks.map((t) => [t.id, t.parentId]));
    const ownDescendant = newParentId === id
      || [...ancestorIds(newParentId, (tid) => parentById.get(tid))].includes(id);
    if (ownDescendant) throw new McpStepError('VALIDATION', 'cannot place a task under itself or one of its own descendants');
  }
  // Zelfde voorafregel als de UI: een relatie op een fase geldt voor elke taak erin, dus verhangen
  // kan een kring maken. Zonder deze toets vangt pas de eindberekening dat, met de Engelse
  // solvertekst en — in een batch — zonder te zeggen wélke stap het was.
  const verdict = moveTaskVerdict(st, id, newParentId, position);
  if (!verdict.ok) {
    throw new McpStepError(
      'CYCLE',
      `circular dependency detected: ${verdict.cycle.join(' → ')} — the relationships of a summary task ` +
      'apply to all its subtasks, so this move would deadlock the schedule; the task has not been moved',
    );
  }
  // Dezelfde relatiemelding als de store-`moveTask`: een bestaande relatie die
  // hierdoor een voorouder-relatie wordt, telt niet meer mee. Rolt de transactie terug, dan gaat de
  // melding mee terug (de run herstelt de meldingen van vóór de call).
  const reportAncestorRelations = watchAncestorRelations(ctx.app.store.getState());
  const phaseTransitions = ctx.transactions.draft.moveTask(id, newParentId, position);
  reportAncestorRelations(ctx.app.store.getState());
  return { data: { moved: id, ...(phaseTransitions.length > 0 ? { phaseTransitions } : {}) } };
}

const moveTask: BatchStepTool = {
  name: 'planner_move_task',
  description:
    'Move a task to a new parent (`newParentId: null` = root) and optionally a `position` (insertion index ' +
    'within the parent; silently clamped to [0, number of siblings]). Placing a task under itself or one of ' +
    'its own descendants is a hard error. A relationship on a summary task applies to all its subtasks: a ' +
    'move that creates a circular dependency this way is a hard error (CYCLE) that rolls back the whole ' +
    `call. ${PHASE_TRANSITION_DOC}`,
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      newParentId: { type: ['string', 'null'], description: 'New parent id, or null for root level.' },
      position: { type: 'integer', description: 'Insertion index within the parent; silently clamped to [0, number of siblings].' },
    },
    required: ['id', 'newParentId'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseMoveTask, moveTaskCore),
  async handler(args, ctx) {
    const parsed = parseMoveTask(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const id = parsed.id;
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => moveTaskCore(ctx, parsed));
    return enrichOk(res, () => ({
      ...((res as McpToolOk).data as { moved: string; phaseTransitions?: PhaseTransitionReport[] }),
      moved: id,
      tasks: freshDates(ctx.app.store.getState(), [id]),
      projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd,
    }));
  },
};

/** Statische classificatie van een relatie-batch (type-geldigheid + endpoint-bestaan + dedup
 *  incrementeel tegen de bestaande relaties én de groeiende kandidatenset). Gedeeld door het
 *  lege-batch-snelpad en de transactie-fn; de kring-check is GEEN onderdeel (die draait alleen op de
 *  kandidaten, ín de transactie, als harde stap-fout). */
function classifyDeps(
  st: AppState,
  deps: { predecessorId: string; successorId: string; type: string; lag?: unknown }[],
): {
  candidates: { predecessorId: string; successorId: string; type: SequenceType; lag: ParsedLag }[];
  rejections: { id: string; reason: string }[];
} {
  const rejections: { id: string; reason: string }[] = [];
  const candidates: { predecessorId: string; successorId: string; type: SequenceType; lag: ParsedLag }[] = [];
  const seen = new Set(st.sequences.map(relationKey));
  // Eén Map ipv. `st.tasks.some(...)` per dep: `st.tasks` is hier een gewone (niet-draft) array, dus
  // een Map bouwen kost geen Immer-proxy-overhead en scheelt bij N deps N× een lineaire scan.
  const byId = new Map(st.tasks.map((t) => [t.id, t]));
  const lookup = (id: string) => byId.get(id);
  for (const d of deps) {
    const label = `${d.predecessorId}->${d.successorId}`;
    // Type: lange én korte (leeskant-)notatie, hoofdletterongevoelig — zie `sequenceFields`.
    const type = normalizeSeqType(d.type);
    if (!type) {
      rejections.push({ id: label, reason: unknownTypeReason(d.type) });
      continue;
    }
    // Lag: nooit stil naar 0 terugvallen.
    const lag = parseLag(d.lag);
    if (!lag.ok) { rejections.push({ id: label, reason: lag.reason }); continue; }
    if (!byId.has(d.predecessorId)) { rejections.push({ id: label, reason: `predecessor '${d.predecessorId}' does not exist` }); continue; }
    if (!byId.has(d.successorId)) { rejections.push({ id: label, reason: `successor '${d.successorId}' does not exist` }); continue; }
    // Zelfrelatie: per item zacht weigeren, net als `update_dependencies` — anders ziet de kring-
    // check hieronder een a→a-lus en rolt de HELE call terug als harde CYCLE.
    if (d.predecessorId === d.successorId) {
      rejections.push({ id: label, reason: selfRelationReason(d.predecessorId) });
      continue;
    }
    // Een verzameltaak-eindpunt is legaal (expandSummaryRelations rekent zo'n
    // relatie door naar de onderliggende bladtaken — MS Project-semantiek). Alleen een relatie
    // tussen een taak en zijn EIGEN (voor)ouder-samenvatting blijft zinloos (directe cyclus na
    // expansie). Mijlpalen zijn bladtaken en blijven dus sowieso gewoon toegestaan.
    if (isAncestorRelation(lookup, d)) {
      rejections.push({ id: label, reason: ANCESTOR_RELATION_REJECTION });
      continue;
    }
    const key = relationKey({ predecessorId: d.predecessorId, successorId: d.successorId, type });
    if (seen.has(key)) { rejections.push({ id: label, reason: 'relationship already existed' }); continue; }
    seen.add(key);
    candidates.push({ predecessorId: d.predecessorId, successorId: d.successorId, type, lag: lag.value });
  }
  return { candidates, rejections };
}

// =================================================================================================
// planner_add_dependencies — pre-validatie (bestaan + dedup incrementeel + kring over de UNIE);
// kring ⇒ harde CYCLE + volledige rollback; duplicaat ⇒ zachte weigering.
// =================================================================================================
/** Vormvalidatie van `add_dependencies`; string = foutboodschap. */
function parseAddDeps(args: unknown): { predecessorId: string; successorId: string; type: string; lag?: unknown }[] | string {
  const a = (args ?? {}) as { dependencies?: unknown };
  if (!Array.isArray(a.dependencies) || a.dependencies.length === 0) {
    return 'add_dependencies requires a non-empty `dependencies` array';
  }
  return a.dependencies as { predecessorId: string; successorId: string; type: string; lag?: unknown }[];
}

/** Synchrone, transactie-vrije kern van `add_dependencies`. Een kring is een HARDE stapfout. */
function addDependenciesCore(
  ctx: McpContext,
  deps: { predecessorId: string; successorId: string; type: string; lag?: unknown }[],
): MutationOutcome {
  const st = ctx.app.store.getState();
  const { candidates, rejections } = classifyDeps(st, deps);
  // Kring over de UNIE (bestaande + alle kandidaten) ⇒ harde stap-fout.
  const cyc = validate.noCycle(st, candidates.map((c) => ({ predecessorId: c.predecessorId, successorId: c.successorId })));
  if (cyc) throw new McpStepError('CYCLE', `circular dependency detected: ${cyc.join(' → ')}`);
  const added: string[] = [];
  for (const c of candidates) {
    // `c.lag` is hier al door `parseLag` gegaan: een niet-numerieke lag heeft de relatie
    // hierboven geweigerd en komt nooit als stille 0 binnen. `lagPatchOf` kiest de representatie
    // (dagen óf procent) — één bron, gedeeld met `update_dependencies`. Op een NIEUWE relatie laten
    // we de lege sleutels weg (er valt niets te wissen); de update-kant zet ze bewust wél expliciet.
    const lp = lagPatchOf(c.lag);
    const newId = ctx.transactions.draft.addSequence({
      predecessorId: c.predecessorId,
      successorId: c.successorId,
      type: c.type,
      lagDays: lp.lagDays,
      ...(lp.lagPercent !== undefined ? { lagPercent: lp.lagPercent } : {}),
    });
    if (newId) added.push(newId);
    else {
      // Backstop, niet de precieze reden: `classifyDeps` hierboven hoort elke afkeuring (dedup,
      // verzameltaak-eindpunt, self, onbekende taak) al zelf te vangen, dus dit pad is vandaag
      // onbereikbaar. Mocht een toekomstig gemist geval hier tóch belanden, dan mag de tekst niet
      // meer beloven dan hij weet — "bestond al" zou een agent een niet-bestaande relatie laten
      // zoeken en laten hercirkelen.
      rejections.push({
        id: `${c.predecessorId}->${c.successorId}`,
        reason: 'relationship refused by the relationship rules (duplicate, or an end point that has no effect)',
      });
    }
  }
  return { data: { added }, itemRejections: rejections };
}

const addDependencies: BatchStepTool = {
  name: 'planner_add_dependencies',
  description:
    'Add NEW relationships between tasks. Per item: `predecessorId`, `successorId`, `type` (FINISH_START | ' +
    'FINISH_FINISH | START_START | START_FINISH — the SHORT form FS/FF/SS/SF that the read tools return is ' +
    `allowed too) and optionally \`lag\`. ${LAG_DOC} A summary task (a task WITH subtasks) as ` +
    'predecessor/successor is ALLOWED — that relationship is passed on to the underlying leaf tasks in the ' +
    'calculation. Unknown task ids, an already existing relationship, or an ancestor relationship (a task ' +
    'linked to its own ancestor summary task) are softly refused per item; a circular dependency (across the ' +
    'existing and proposed relationships, also via the subtasks of a summary task) is a hard error that ' +
    'rolls back the whole call. DO YOU WANT TO CHANGE AN EXISTING RELATIONSHIP (other type, other lag, other ' +
    'predecessor/successor)? Use planner_update_dependencies with the sequence id — NOT ' +
    'remove-and-add-again: that loses the id and produces two undo steps.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: {
    type: 'object',
    properties: {
      dependencies: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['predecessorId', 'successorId', 'type'],
          properties: {
            predecessorId: { type: 'string' },
            successorId: { type: 'string' },
            // Gedeelde schema-fragmenten (sequenceFields.ts): identiek aan update_dependencies.
            type: SEQ_TYPE_SCHEMA,
            lag: LAG_SCHEMA,
          },
          additionalProperties: false,
        },
      },
    },
    required: ['dependencies'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseAddDeps, addDependenciesCore),
  async handler(args, ctx) {
    const parsed = parseAddDeps(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const deps = parsed;
    // Lege-batch-snelpad: levert de statische classificatie nul kandidaten (alle
    // items onbekend/dubbel/verkeerd type), return dan direct Ok mét de weigeringen — zónder
    // transactie/backup/snapshot/redo-wipe.
    {
      const state = ctx.app.store.getState();
      const pre = classifyDeps(state, deps);
      if (pre.candidates.length === 0) {
        return okDirectGuarded(ctx, { added: [], projectEnd: projectEndInfo(state).projectEnd }, pre.rejections);
      }
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => addDependenciesCore(ctx, deps));
    return enrichOk(res, () => ({
      added: ((res as McpToolOk).data as { added: string[] }).added,
      projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd,
    }));
  },
};

// =================================================================================================
// planner_remove_dependencies — gekozen vorm: `{ ids }` = sequence-id's (zoals get_project_overview /
// get_task ze teruggeven). Geen dedicated draft-primitief; verwijderen via een draft-stijl setState
// binnen de transactie (snapshot-/recompute-vrij — de suppressievlag + eind-runCPM dekken hem).
// =================================================================================================
/** Synchrone, transactie-vrije kern van `remove_dependencies`. */
function removeDependenciesCore(ctx: McpContext, ids: string[]): MutationOutcome {
  const st = ctx.app.store.getState();
  const rejections: { id: string; reason: string }[] = [];
  const toRemove = new Set<string>();
  const removed: string[] = [];
  for (const id of ids) {
    if (st.sequences.some((s) => s.id === id)) { toRemove.add(id); removed.push(id); }
    else rejections.push({ id, reason: `relationship '${id}' does not exist` });
  }
  if (toRemove.size > 0) {
    ctx.app.store.setState((s) => {
      s.sequences = s.sequences.filter((x) => !toRemove.has(x.id));
      markDocumentEdited(s);
    });
  }
  return { data: { removed }, itemRejections: rejections };
}

const removeDependencies: BatchStepTool = {
  name: 'planner_remove_dependencies',
  description:
    'Delete relationships PERMANENTLY by their sequence id (as get_project_overview / get_task return them). ' +
    'An unknown id is softly refused per item. Returns the deleted ids and the new project end. Do you only ' +
    'want to CHANGE a relationship (type, lag, predecessor/successor)? Use planner_update_dependencies — ' +
    'deleting and adding again is not the route for that.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: { ids: { type: 'array', minItems: 1, items: { type: 'string' }, description: 'Sequence-id\'s.' } },
    required: ['ids'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep((args: unknown) => parseIdList(args, 'remove_dependencies'), removeDependenciesCore),
  async handler(args, ctx) {
    const parsed = parseIdList(args, 'remove_dependencies');
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const ids = parsed;
    // Lege-batch-snelpad: bestaat geen enkele opgegeven relatie, return dan direct
    // Ok mét de weigeringen — zónder transactie/backup/snapshot/redo-wipe.
    {
      const st = ctx.app.store.getState();
      const existing = new Set(st.sequences.map((s) => s.id));
      if (!ids.some((id) => existing.has(id))) {
        const rej = ids.map((id) => ({ id, reason: `relationship '${id}' does not exist` }));
        return okDirectGuarded(ctx, { removed: [], projectEnd: projectEndInfo(st).projectEnd }, rej);
      }
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => removeDependenciesCore(ctx, ids));
    return enrichOk(res, () => ({
      removed: ((res as McpToolOk).data as { removed: string[] }).removed,
      projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd,
    }));
  },
};

// =================================================================================================
// planner_undo / planner_redo — de gedeelde sessiegeschiedenis, toegepast op het ACTIEVE document
// (ook de user schrijft erin). Één tool-mutatie = één stap. Niet-transactioneel: de store-acties
// beheren de geschiedenis zelf.
// =================================================================================================
/**
 * Gedeelde kern van undo/redo.
 *
 * Zonder toepasbaar sessie-event is `undo`/`redo` in de store een STILLE no-op; een kale `ok` zou een
 * agent dan laten geloven dat er iets is teruggedraaid. Daarom meldt de respons of er daadwerkelijk
 * iets is teruggedraaid (diepte vóór > 0) én hoe diep beide nog zijn.
 */
function historyStep(ctx: Parameters<McpToolDef['handler']>[1], dir: 'undo' | 'redo'): McpToolResult {
  const g = guardNonTransactional(ctx);
  if (g) return g;
  const before = ctx.app.store.getState();
  const depthsBefore = historyDepthsForActiveScope(before);
  const depthBefore = dir === 'undo' ? depthsBefore.undoDepth : depthsBefore.redoDepth;
  if (dir === 'undo') ctx.app.store.getState().undo();
  else ctx.app.store.getState().redo();
  const after = ctx.app.store.getState();
  const depthsAfter = historyDepthsForActiveScope(after);
  const done = depthBefore > 0;
  return {
    ok: true,
    envelope: okEnvelope(ctx),
    data: {
      [dir === 'undo' ? 'undone' : 'redone']: done,
      undoDepth: depthsAfter.undoDepth,
      redoDepth: depthsAfter.redoDepth,
      projectEnd: after.cpmResult?.projectEnd ?? '',
      ...(done ? {} : { reason: `the applicable ${dir} history is empty; nothing was ${dir === 'undo' ? 'undone' : 'redone'}` }),
    },
  };
}

const undo: McpToolDef = {
  name: 'planner_undo',
  description:
    'Undo the last undoable change in the ACTIVE document (one step). ALWAYS check `undone` in the answer: ' +
    'without an applicable session event the call stays `ok` but `undone` is false (with `reason`) — so `ok` ' +
    'alone does not mean that anything was undone. `undoDepth`/`redoDepth` only give the remaining session ' +
    'depth applicable to the active document. Global grid preferences count; events of other open documents ' +
    'do not. The history is SHARED with the user. For what-if work: use duplicate_document, not undo.',
  kind: 'other',
  batchable: false,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: (_args, ctx): McpToolResult => historyStep(ctx, 'undo'),
};

const redo: McpToolDef = {
  name: 'planner_redo',
  description:
    'Redo the last undone change in the ACTIVE document (one step). ALWAYS check `redone` in the answer: ' +
    'with an empty redo stack the call stays `ok` but `redone` is false (with `reason`). ' +
    '`undoDepth`/`redoDepth` give the remaining session depth applicable to the active document. Global grid ' +
    'preferences count; events of other documents do not. A new change only clears conflicting redo scopes.',
  kind: 'other',
  batchable: false,
  annotations: { ...WRITE_ANNOTATIONS },
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: (_args, ctx): McpToolResult => historyStep(ctx, 'redo'),
};

// =================================================================================================
// planner_set_task_splits
// =================================================================================================
/** Vormvalidatie van `set_task_splits`; string = foutboodschap. De inhoud van `interruptions` keurt
 *  `planTaskSplits` (die kent de taak, en dus de eenheid). */
function parseSetTaskSplits(args: unknown): { taskId: string; interruptions: unknown[] } | string {
  const a = (args ?? {}) as { taskId?: unknown; interruptions?: unknown };
  if (typeof a.taskId !== 'string' || a.taskId === '') return 'set_task_splits requires a `taskId`';
  if (!Array.isArray(a.interruptions)) return 'set_task_splits requires an `interruptions` array (empty = clear all interruptions)';
  return { taskId: a.taskId, interruptions: a.interruptions };
}

/** Het stukkenplan tegen de LIVE state: onbekende taak ⇒ NOT_FOUND, elke andere weigering ⇒
 *  VALIDATION (alles-of-niets; `planTaskSplits` noemt het item-index). */
function planSplitsFor(
  st: AppState,
  p: { taskId: string; interruptions: unknown[] },
): { ok: true; pieces: SplitPiece[] | null } | { ok: false; code: 'NOT_FOUND' | 'VALIDATION'; reason: string } {
  const task = st.tasks.find((t) => t.id === p.taskId);
  if (!task) return { ok: false, code: 'NOT_FOUND', reason: `task '${p.taskId}' does not exist` };
  const plan = planTaskSplits(task, p.interruptions, st);
  return plan.ok ? plan : { ok: false, code: 'VALIDATION', reason: plan.reason };
}

/** Synchrone kern: schrijft via het draft-primitief `setTaskSplits` (zelfde lichaam als de
 *  store-actie, `splitMutations.ts`). De omvattende transactie bezit de ene undo-stap en de
 *  eindherberekening, en verloren MSP-sturing landt op de lease (envelop `timephasedGuidanceLost`)
 *  — dezelfde regel als `planner_update_tasks`. */
function setTaskSplitsCore(ctx: McpContext, p: { taskId: string; interruptions: unknown[] }): MutationOutcome {
  const plan = planSplitsFor(ctx.app.store.getState(), p);
  if (!plan.ok) throw new McpStepError(plan.code, plan.reason);
  const refusal = ctx.transactions.draft.setTaskSplits(p.taskId, plan.pieces);
  if (refusal) throw new McpStepError('VALIDATION', `task '${p.taskId}': interruption refused (${refusal})`);
  return { data: splitsReport(ctx.app.store.getState(), p.taskId) };
}

function splitsReport(st: AppState, taskId: string) {
  const task = st.tasks.find((t) => t.id === taskId);
  if (!task) return { taskId };
  const { interruptions } = interruptionsOf(task, st);
  return {
    taskId,
    interruptions: interruptions ?? [],
    durationUnit: taskDurationUnit(task),
    scheduleDuration: task.time.scheduleDuration,
  };
}

const setTaskSplits: BatchStepTool = {
  name: 'planner_set_task_splits',
  description:
    'Set the INTERRUPTIONS of one task (work that is suspended and resumed later, e.g. two projects that ' +
    'alternate) — rather than cutting the task into separate tasks. `interruptions` replaces the whole list; ' +
    'an EMPTY list clears all interruptions. Positions are on the WORK axis, without pauses: `afterWorkDays: ' +
    '5` = after five working days of work from the task start, `pauseDays: 3` = three working days of ' +
    'standstill. An hour task (`durationUnit: "hours"`) uses `afterWorkHours`/`pauseHours`; the unit follows ' +
    'the task and mixing day and hour keys is refused. Whole units only, no silent rounding. The work ' +
    'duration stays the same; the task gets longer by the pauses. Not splittable: milestones, summary tasks, ' +
    'hammocks, ELAPSEDTIME tasks, manually scheduled tasks, tasks shorter than two units, and non-editable ' +
    'imported splits (those you can only clear). A position in work already performed is refused. ' +
    'All-or-nothing: one wrong item ⇒ error answer with the index, nothing written. Read form: ' +
    'planner_get_task returns the same `interruptions`.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      interruptions: {
        type: 'array',
        description: 'The complete new list of interruptions (empty = clear all), in any order.',
        items: {
          type: 'object',
          properties: {
            afterWorkDays: { type: 'number', minimum: 0, description: 'Working days of work before the interruption (day task).' },
            afterWorkHours: { type: 'number', minimum: 0, description: 'Working hours of work before the interruption (hour task).' },
            pauseDays: { type: 'number', minimum: 0, description: 'Length of the interruption in working days (day task).' },
            pauseHours: { type: 'number', minimum: 0, description: 'Length of the interruption in working hours (hour task).' },
          },
          additionalProperties: false,
        },
      },
    },
    required: ['taskId', 'interruptions'],
    additionalProperties: false,
  },
  batchStep: parsedBatchStep(parseSetTaskSplits, setTaskSplitsCore),
  async handler(args, ctx) {
    const parsed = parseSetTaskSplits(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    // Statisch vooraf keuren: een geweigerd plan hoort geen AI-backup of transactie te starten.
    // De guards (pauze/alleen-lezen/dialoog/drift) gaan vóór: een geblokkeerde bridge verklapt
    // niets, en een gedrift document wordt niet eerst tegen de verkeerde taken gekeurd.
    const pre = guardNonTransactional(ctx);
    if (pre) return pre;
    const plan = planSplitsFor(ctx.app.store.getState(), parsed);
    if (!plan.ok) return toolError(ctx, plan.code, plan.reason);
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => setTaskSplitsCore(ctx, parsed));
    return enrichOk(res, () => {
      const state = ctx.app.store.getState();
      return {
        ...splitsReport(state, parsed.taskId),
        tasks: freshDates(state, [parsed.taskId]),
        projectEnd: projectEndInfo(state).projectEnd,
      };
    });
  },
};

/** Alle tools van deze module als vlakke array (registreer via één regel in toolRegistry.MODULES). */
export const taskTools: McpToolDef[] = [
  addTasks,
  updateTasks,
  deleteTasks,
  moveTask,
  addDependencies,
  removeDependencies,
  undo,
  redo,
  setTaskSplits,
];
