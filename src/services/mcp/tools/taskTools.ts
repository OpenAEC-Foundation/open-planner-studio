// MCP-toolmodule (taak T19, spec §Tool-set Muteren + §Overig): mutatietools voor taken en relaties,
// plus undo/redo en run_cpm. Alle namen dragen de service-prefix `planner_` (spec §Naamgeving); elke
// tool draagt een beschrijving (de AI kiest tools op beschrijving) en de standaard MCP-annotaties.
//
// Alle échte mutaties lopen via `runMutateTool` → `runInMcpTransaction`: één undo-stap, één
// herberekening, géén bestands-/save-side-effects. Per-item-weigeringen zijn ZACHT (spec §batch: één
// rotte regel rolt nooit alles terug) en komen als `itemRejections` terug; structurele fouten
// (kringverwijzing, taak-niet-gevonden bij een enkelvoudige tool) zijn HARD via `McpStepError`.
//
// `undo`/`redo`/`run_cpm` lopen NIET via de transactie (ze beheren hun eigen undo-stack, resp. zijn
// een pure herberekening) maar wél via dezelfde guards (`guardNonTransactional`).
import type { McpContext, McpToolDef, McpToolOk, McpToolResult } from '../contracts';
// Alleen als TYPE geïmporteerd (SYNC-2): `import type` wordt bij het compileren volledig weggestreept,
// dus dit legt géén runtime-import naar `batchTool` (dat zelf via de leaf-module `toolIndex` opzoekt).
import type { BatchStepTool } from './batchTool';
import {
  guardNonTransactional,
  McpStepError,
  runMutateTool,
  toolError,
  type MutationOutcome,
} from './runtime';
import { enrichOk, freshDates, okDirect, okEnvelope, projectEndInfo } from './helpers';
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
import { isAncestorRelation } from '@/state/relationRules';
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
  SEQ_TYPE_SCHEMA,
  unknownTypeReason,
  type ParsedLag,
} from './sequenceFields';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { formatDate } from '@/utils/dateUtils';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';
import { deriveHoursPerDay, hasConcreteWorkBlocks } from '@/services/subdayIo';

const STD_ANNOT = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

// De gedeelde post-transactie-helpers (okEnvelope/freshDates/projectEndInfo/enrichOk/okDirect) staan
// sinds T20 in `./helpers.ts` — dezelfde conventie geldt voor de kalender-/resource-tools.

// --- batchStep-kernen (SYNC-2) -------------------------------------------------------------------
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
// STRUCTURELE stapfout die de hele batch hoort terug te rollen (spec §Compositie), geen zachte weigering.

/** Zet een `parseX`-foutboodschap om in de harde stapfout die de batch-loop verwacht. */
function stepValidationError(message: string): McpStepError {
  return new McpStepError('VALIDATION', message);
}

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
    hasChildren: (task?.childIds.length ?? 0) > 0,
    hasAssignments: task ? s.assignments.some((a) => a.taskId === task.id) : false,
    // De projectkalender-id telt mee: op een vers document staat die alleen als cache in `s.calendar`
    // (`calendars` is dan leeg), maar hij is wel degelijk een geldige taak-kalender.
    calendarExists: (id: string) => s.calendars.some((c) => c.id === id) || id === s.calendar.id,
    customTaskTypes: s.customTaskTypes,
    durationCalendar: (requestedId) => {
      const id = requestedId === undefined ? task?.calendarId : requestedId ?? undefined;
      const calendar = id ? (s.calendars.find((c) => c.id === id) ?? s.calendar) : s.calendar;
      return {
        hoursPerDay: calendar.workTime ? deriveHoursPerDay(calendar.workTime, calendar.hoursPerDay) : calendar.hoursPerDay,
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
    return 'add_tasks vereist een niet-lege `tasks`-array';
  }
  const seenTemp = new Set<string>();
  const parsed: ParsedAddItem[] = [];
  for (const it of a.tasks) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return 'elk taak-item moet een object zijn';
    const raw = it as Record<string, unknown>;
    if (typeof raw.tempId !== 'string' || typeof raw.name !== 'string') {
      return 'elk taak-item vereist een string-`tempId` en -`name`';
    }
    // Statische toolniveau-fout: dubbele tempId ⇒ VALIDATION VÓÓR enige transactie/backup (geen
    // spurious snapshot; draft.addTasks zou dit anders pas ín de transactie als throw vangen).
    const tid = raw.tempId;
    if (seenTemp.has(tid)) return `dubbele tempId '${tid}' binnen de call`;
    seenTemp.add(tid);
    if (raw.parentId !== undefined && typeof raw.parentId !== 'string') {
      return `taak '${tid}': \`parentId\` moet een string zijn (bestaand taak-id of tempId uit deze call)`;
    }
    if (raw.position !== undefined && (typeof raw.position !== 'number' || !Number.isInteger(raw.position))) {
      return `taak '${tid}': \`position\` moet een geheel getal zijn`;
    }
    // De inhoudelijke velden lopen door DEZELFDE allowlist als `update_tasks.fields` — een onbekende
    // sleutel (`duration_days`, `time`, …) is hier een HARDE VALIDATION-fout: add_tasks kent geen
    // per-item-weigering (het contract is de volledige tempId→realId-map, alles of niets).
    const { tempId: _t, parentId: _p, position: _pos, ...fields } = raw;
    void _t; void _p; void _pos;
    const res = parseTaskFields(fields, fieldContext(state));
    if (!res.ok) return `taak '${tid}': ${res.reason}`;
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
  const anchor = st.project.startDate || formatDate(new Date());
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
      time = createDefaultTaskTime(anchor, nativeAmount, unit);
      if (tp.scheduleDuration !== undefined) time.scheduleDuration = tp.scheduleDuration;
      if (tp.durationMinutes !== undefined) time.durationMinutes = tp.durationMinutes;
      if (tp.durationType !== undefined) time.durationType = tp.durationType;
    }
    return {
      ...top,
      name: top.name as string,
      tempId: it.tempId,
      ...(it.parentId !== undefined ? { parentId: it.parentId } : {}),
      ...(it.position !== undefined ? { position: it.position } : {}),
      ...(time ? { time } : {}),
    };
  });
  const map = ctx.transactions.draft.addTasks(bulk);
  return { data: { created: Object.fromEntries(map) } };
}

const addTasks: BatchStepTool = {
  name: 'planner_add_tasks',
  description:
    'Maak één of meer taken aan (geneste WBS in één call). Elk item heeft een client-gekozen `tempId` ' +
    '(uniek binnen de call); `parentId` mag een bestaand taak-id of een `tempId` uit dezelfde call zijn. ' +
    'Een tempId MOET met `tmp-` of `tmp_` beginnen (bijv. `tmp-fundering`) — dat is de GERESERVEERDE ' +
    'syntax waarop latere `planner_batch`-stappen hun verwijzingen herkennen; het schema dwingt die ' +
    'vorm nu overal af, zodat dezelfde call binnen én buiten een batch werkt. ' +
    '`position` is de invoeg-index binnen de ouder en klemt stil naar [0, aantal siblings]. ' +
    'Geef de DUUR direct mee met `duration` en desgewenst `durationUnit` (`days`/`hours`; zonder duur krijgt een taak de ' +
    'standaard 5 werkdagen). Een mijlpaal (`isMilestone`) heeft per definitie duur 0 — `duration` > 0 ' +
    'is daar een fout. ' + TASK_FIELDS_DOC + ' Bij add_tasks is een onbekende sleutel een HARDE fout ' +
    '(de hele call faalt), niet een per-item-weigering. Retourneert de volledige tempId→realId-map, de ' +
    'herrekende earlyStart/earlyFinish per aangemaakte taak en het projecteinde.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT },
  inputSchema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        minItems: 1,
        description: 'De aan te maken taken (top-down aangemaakt; tempId-parents mogen in willekeurige volgorde staan).',
        items: {
          type: 'object',
          required: ['tempId', 'name'],
          properties: {
            tempId: {
              type: 'string',
              pattern: '^tmp[-_]',
              description:
                'Client-gekozen tijdelijk id, uniek binnen de call; sleutel in de terugmap. MOET met ' +
                '`tmp-` of `tmp_` beginnen (gereserveerde batch-syntax, bijv. `tmp-fundering`): alleen ' +
                'zo kan planner_batch verwijzingen in latere stappen veilig vervangen zonder ooit vrije ' +
                'tekst te raken. Deze eis geldt overal, ook buiten een batch (het schema dwingt hem af).',
            },
            parentId: { type: 'string', description: 'Bestaand taak-id of een tempId uit dezelfde call; weglaten = wortel.' },
            position: { type: 'integer', description: 'Invoeg-index binnen de ouder; klemt stil naar [0, aantal siblings].' },
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
  batchStep(args, ctx) {
    const parsed = parseAddTasks(args, ctx.app.store.getState());
    if (typeof parsed === 'string') throw stepValidationError(parsed);
    return addTasksCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsed = parseAddTasks(args, ctx.app.store.getState());
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => addTasksCore(ctx, parsed));
    return enrichOk(res, () => {
      const created = (res as McpToolOk).data as { created: Record<string, string> };
      const state = ctx.app.store.getState();
      const { projectEnd, cappedTaskIds } = projectEndInfo(state);
      return {
        created: created.created,
        tasks: freshDates(state, Object.values(created.created)),
        projectEnd,
        ...(cappedTaskIds ? { cappedTaskIds } : {}),
      };
    });
  },
};

// =================================================================================================
// planner_update_tasks
// =================================================================================================
const FORBIDDEN_PROGRESS_IN_FIELDS = (fields: any): string | null => {
  if (fields && typeof fields === 'object') {
    if ('status' in fields) return 'gebruik `progress`, niet `fields.status`, voor voortgang';
    const time = fields.time;
    if (time && typeof time === 'object' && ('completion' in time || 'actualStart' in time || 'actualFinish' in time)) {
      return 'gebruik `progress`, niet `fields.time.*`, voor voortgang/actuals';
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
        : 'geen `fields` of `progress` opgegeven';
  return { executable: false, rejection: { id: u.id, reason } };
}

/** Vormvalidatie van `update_tasks`; string = foutboodschap. */
function parseUpdateTasks(args: unknown): { id: string; fields?: any; progress?: any }[] | string {
  const a = (args ?? {}) as { updates?: unknown };
  if (!Array.isArray(a.updates) || a.updates.length === 0) {
    return 'update_tasks vereist een niet-lege `updates`-array';
  }
  return a.updates as { id: string; fields?: any; progress?: any }[];
}

/** Synchrone, transactie-vrije kern van `update_tasks`. */
function updateTasksCore(ctx: McpContext, updates: { id: string; fields?: any; progress?: any }[]): MutationOutcome {
  const statusDate = ctx.app.store.getState().project.statusDate;
  const rejections: { id: string; reason: string }[] = [];
  const applied: string[] = [];
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
        if (res.patch.customTaskType) ctx.transactions.draft.ensureCustomTaskType(res.patch.customTaskType);
        ctx.transactions.draft.patchTaskFields(id, res.patch.top, res.patch.time);
        touched = true;
      }
    }
    if (u.progress !== undefined) {
      // VORM eerst (audit-fix K3): `applyProgressUpdate` leest exact completion/actualStart/
      // actualFinish en negeert al het overige — `progress: { percent: 50 }` kwam er dus als
      // `{ applied: true }` uit terwijl er niets gebeurde. Een onbekende sleutel of een leeg blok is
      // vanaf nu een ZACHTE weigering met naam en reden.
      const shape = parseProgress(u.progress);
      if (!shape.ok) { rejections.push({ id, reason: shape.reason }); rejectedHere = true; }
      else {
        const patch: ProgressPatch = shape.value;
        let pr: { applied: true } | { applied: false; reason: string } = { applied: false, reason: 'niet-uitgevoerd' };
        ctx.app.store.setState((s) => { pr = progress.applyProgressUpdate(s, id, patch, statusDate); });
        if (pr.applied) touched = true;
        else { rejections.push({ id, reason: pr.reason }); rejectedHere = true; }
      }
    }
    if (touched) applied.push(id);
    else if (!rejectedHere) rejections.push({ id, reason: 'geen `fields` of `progress` opgegeven' });
  }
  return { data: { updated: applied }, itemRejections: rejections };
}

const updateTasks: BatchStepTool = {
  name: 'planner_update_tasks',
  description:
    'Wijzig bestaande taken. Per item: `fields` (naam, DUUR plus `durationUnit`, constraints, deadline, ' +
    'kalender, …; GEEN voortgangsvelden) en/of `progress` (voortgangspad: UITSLUITEND `completion` in ' +
    'PROCENTEN 0–100, `actualStart` en `actualFinish` als ISO-datum — elke andere sleutel, en een leeg ' +
    '`progress`-object, wordt per item zacht GEWEIGERD, nooit stil genegeerd). ' + TASK_FIELDS_DOC + ' Een ' +
    'geweigerd `fields`-blok laat de taak volledig ONGEWIJZIGD (nooit een halve merge). ' +
    'Voortgang > 0 leidt de actualStart af; actuals ná de ' +
    'projectstatusdatum of buiten 0–100 worden per item zacht geweigerd — geldige items blijven staan. ' +
    'Hefboom-tip: hypothetische uitloop = duur of SNET-constraint (via `fields`); geregistreerde voortgang ' +
    '= actuals mét statusdatum (via `progress`). Merk op: één taak-id kan tegelijk in `updated` én in de ' +
    'weigeringen verschijnen (bijv. `fields` geweigerd maar `progress` toegepast) — bewuste granulariteit.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT },
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
                `Te wijzigen velden (expliciete allowlist: ${TASK_FIELD_NAMES.join(', ')}). Namen ` +
                'spiegelen planner_get_task. Een onbekende sleutel wordt geweigerd — nooit stil genegeerd.',
              properties: { ...TASK_FIELD_SCHEMA_PROPERTIES },
              additionalProperties: false,
            },
            progress: {
              type: 'object',
              description:
                `Voortgangspad (expliciete allowlist: ${PROGRESS_FIELD_NAMES.join(', ')}). Een onbekende ` +
                'sleutel (`percent`, `status`, …) wordt geweigerd met een reden — nooit stil genegeerd — ' +
                'en een leeg `progress`-object ook: geef minstens één van de drie.',
              properties: {
                completion: { type: 'number', minimum: 0, maximum: 100, description: 'Voltooiing in PROCENTEN (0–100).' },
                actualStart: { type: ['string', 'null'], description: 'ISO-datum; mag niet ná de statusdatum liggen. null wist hem.' },
                actualFinish: { type: ['string', 'null'], description: 'ISO-datum; ≥ actualStart en niet ná de statusdatum. null wist hem.' },
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
  batchStep(args, ctx) {
    const parsed = parseUpdateTasks(args);
    if (typeof parsed === 'string') throw stepValidationError(parsed);
    return updateTasksCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsed = parseUpdateTasks(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const updates = parsed;
    // Lege-batch-snelpad (reviewfix Issue 2): zijn er statisch nul uitvoerbare items (alle id's
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
        const g = guardNonTransactional(ctx);
        if (g) return g;
        return okDirect(ctx, { updated: [], tasks: [], projectEnd: projectEndInfo(st).projectEnd }, staticRej);
      }
    }
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => updateTasksCore(ctx, updates));
    return enrichOk(res, () => {
      const updated = ((res as McpToolOk).data as { updated: string[] }).updated;
      const state = ctx.app.store.getState();
      return { updated, tasks: freshDates(state, updated), projectEnd: projectEndInfo(state).projectEnd };
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
    return `${toolLabel} vereist een niet-lege \`ids\`-array`;
  }
  return a.ids as string[];
}

/**
 * Synchrone, transactie-vrije kern van `delete_tasks`.
 *
 * ONDERRAPPORTAGE-FIX (audit-bevinding M1). `draft.deleteTask` verwijdert de héle subboom plus de
 * relaties en toewijzingen daarvan; de kern zette alleen de GEVRAAGDE id's in `deleted`. Eén
 * verzameltaak wissen kon zo stil dertig taken meenemen terwijl de respons `deleted: ['t5']` zei.
 * En gaf je een ouder én haar kind in dezelfde `ids`-array, dan faalde het kind daarna op de
 * existentiecheck met "taak 'x' bestaat niet" — verwarrend voor een volstrekt redelijk verzoek.
 *
 * Vanaf nu: het volledige VOOR/NA-verschil wordt gerapporteerd (`deletedTaskIds`, `deletedTaskCount`,
 * `cascadedTaskIds` + de meegewiste relaties/toewijzingen), en een id dat al door een eerdere cascade
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
    'Verwijder taken op id INCLUSIEF HUN VOLLEDIGE SUBBOOM, plus alle relaties en toewijzingen daarvan — ' +
    'één verzameltaak wissen kan dus veel meer taken meenemen dan je opgaf. Daarom rapporteert de tool ' +
    'wat er ECHT weg is: `deletedTaskIds` (alle verwijderde taken), `deletedTaskCount`, `cascadedTaskIds` ' +
    '(de niet-gevraagde meegewiste taken) en `removedDependencyCount`/`removedAssignmentCount`; ' +
    '`deleted` blijft de gevraagde id\'s. Een id dat al door de cascade van een ander id uit dezelfde ' +
    'call verdween telt als succes. Een id dat nooit bestond wordt per item zacht geweigerd.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: { ids: { type: 'array', minItems: 1, items: { type: 'string' } } },
    required: ['ids'],
    additionalProperties: false,
  },
  // Zie de noot bij update_tasks: het lege-batch-snelpad is puur transactie-vermijding en dus
  // overbodig binnen een batch.
  batchStep(args, ctx) {
    const parsed = parseIdList(args, 'delete_tasks');
    if (typeof parsed === 'string') throw stepValidationError(parsed);
    return deleteTasksCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsed = parseIdList(args, 'delete_tasks');
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const ids = parsed;
    // Lege-batch-snelpad (reviewfix Issue 2): bestaat geen enkel id, return dan direct Ok mét de
    // weigeringen — zónder transactie/backup/snapshot/redo-wipe.
    {
      const st = ctx.app.store.getState();
      const staticRej = validate.tasksExist(st, ids);
      if (staticRej.length === ids.length) {
        const g = guardNonTransactional(ctx);
        if (g) return g;
        return okDirect(
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
      // Het volledige cascade-rapport uit de kern doorgeven (M1) — niet alleen `deleted`.
      ...((res as McpToolOk).data as object),
      projectEnd: projectEndInfo(ctx.app.store.getState()).projectEnd,
    }));
  },
};

// =================================================================================================
// planner_move_task — roept de slice-actie `moveTask` DIRECT binnen de transactie aan; de
// suppressievlag dekt de `beginUndoable`, de trailing `recomputeViewRows` is redundant maar onschadelijk.
// =================================================================================================
/** Vormvalidatie van `move_task`; string = foutboodschap. */
function parseMoveTask(args: unknown): { id: string; newParentId: string | null; position?: number } | string {
  const a = (args ?? {}) as { id?: unknown; newParentId?: unknown; position?: unknown };
  if (typeof a.id !== 'string') return 'move_task vereist een string-`id`';
  if (!(a.newParentId === null || typeof a.newParentId === 'string')) {
    return '`newParentId` moet een string of null zijn';
  }
  // Audit-bevinding L3: een niet-numerieke `position` werd hier STIL WEGGEGOOID (de taak belandde dan
  // achteraan) en gaf verderop `Math.min(NaN, …)` ⇒ `splice(NaN)` ⇒ gedrag als index 0. De stille klem
  // naar [0, aantal siblings] is gedocumenteerd en blijft; niet-numerieke invoer is dat niet.
  if (a.position !== undefined && (typeof a.position !== 'number' || !Number.isInteger(a.position))) {
    return '`position` moet een geheel getal zijn (invoeg-index binnen de ouder)';
  }
  return {
    id: a.id,
    newParentId: a.newParentId as string | null,
    ...(typeof a.position === 'number' ? { position: a.position } : {}),
  };
}

/** Synchrone, transactie-vrije kern van `move_task`. Structurele fouten (onbekend id, kringouder)
 *  gooien een `McpStepError` — die code overleeft de rollback van beide aanroepers. */
function moveTaskCore(ctx: McpContext, p: { id: string; newParentId: string | null; position?: number }): MutationOutcome {
  const { id, newParentId, position } = p;
  const st = ctx.app.store.getState();
  if (!st.tasks.some((t) => t.id === id)) throw new McpStepError('NOT_FOUND', `taak '${id}' bestaat niet`);
  if (newParentId !== null) {
    if (!st.tasks.some((t) => t.id === newParentId)) {
      throw new McpStepError('NOT_FOUND', `nieuwe ouder '${newParentId}' bestaat niet`);
    }
    // Cykel-preventie: newParentId mag niet id zelf of een afstammeling van id zijn.
    let cur = st.tasks.find((t) => t.id === newParentId);
    while (cur) {
      if (cur.id === id) throw new McpStepError('VALIDATION', 'kan een taak niet onder zichzelf of een eigen afstammeling plaatsen');
      cur = cur.parentId ? st.tasks.find((t) => t.id === cur!.parentId) : undefined;
    }
  }
  ctx.app.store.getState().moveTask(id, newParentId, position);
  return { data: { moved: id } };
}

const moveTask: BatchStepTool = {
  name: 'planner_move_task',
  description:
    'Verplaats een taak naar een nieuwe ouder (`newParentId: null` = wortel) en optioneel een `position` ' +
    '(invoeg-index binnen de ouder; klemt stil naar [0, aantal siblings]). Een taak onder zichzelf of een ' +
    'eigen afstammeling plaatsen is een harde fout.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT },
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      newParentId: { type: ['string', 'null'], description: 'Nieuw ouder-id, of null voor wortelniveau.' },
      position: { type: 'integer', description: 'Invoeg-index binnen de ouder; klemt stil naar [0, aantal siblings].' },
    },
    required: ['id', 'newParentId'],
    additionalProperties: false,
  },
  batchStep(args, ctx) {
    const parsed = parseMoveTask(args);
    if (typeof parsed === 'string') throw stepValidationError(parsed);
    return moveTaskCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsed = parseMoveTask(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const id = parsed.id;
    const res = await runMutateTool(ctx, 'mutate', (): MutationOutcome => moveTaskCore(ctx, parsed));
    return enrichOk(res, () => ({
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
  const seen = new Set(st.sequences.map((s) => `${s.predecessorId}|${s.successorId}|${s.type}`));
  // Eén Map ipv. `st.tasks.some(...)` per dep: `st.tasks` is hier een gewone (niet-draft) array, dus
  // een Map bouwen kost geen Immer-proxy-overhead en scheelt bij N deps N× een lineaire scan.
  const byId = new Map(st.tasks.map((t) => [t.id, t]));
  const lookup = (id: string) => byId.get(id);
  for (const d of deps) {
    const label = `${d.predecessorId}->${d.successorId}`;
    // Type: lange én korte (leeskant-)notatie, hoofdletterongevoelig — zie `sequenceFields` (H1).
    const type = normalizeSeqType(d.type);
    if (!type) {
      rejections.push({ id: label, reason: unknownTypeReason(d.type) });
      continue;
    }
    // Lag: nooit meer stil naar 0 terugvallen (K4/H2).
    const lag = parseLag(d.lag);
    if (!lag.ok) { rejections.push({ id: label, reason: lag.reason }); continue; }
    if (!byId.has(d.predecessorId)) { rejections.push({ id: label, reason: `voorganger '${d.predecessorId}' bestaat niet` }); continue; }
    if (!byId.has(d.successorId)) { rejections.push({ id: label, reason: `opvolger '${d.successorId}' bestaat niet` }); continue; }
    // Een verzameltaak-eindpunt is sinds 2026-08-15 legaal (expandSummaryRelations rekent zo'n
    // relatie door naar de onderliggende bladtaken — MS Project-semantiek). Alleen een relatie
    // tussen een taak en zijn EIGEN (voor)ouder-samenvatting blijft zinloos (directe cyclus na
    // expansie). Mijlpalen zijn bladtaken en blijven dus sowieso gewoon toegestaan.
    if (isAncestorRelation(lookup, d)) {
      rejections.push({ id: label, reason: ANCESTOR_RELATION_REJECTION });
      continue;
    }
    const key = `${d.predecessorId}|${d.successorId}|${type}`;
    if (seen.has(key)) { rejections.push({ id: label, reason: 'relatie bestond al' }); continue; }
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
    return 'add_dependencies vereist een niet-lege `dependencies`-array';
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
  if (cyc) throw new McpStepError('CYCLE', `kringverwijzing gedetecteerd: ${cyc.join(' → ')}`);
  const added: string[] = [];
  for (const c of candidates) {
    // `c.lag` is hier al door `parseLag` gegaan (K4): een niet-numerieke lag heeft de relatie
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
        reason: 'relatie geweigerd door de relatieregels (duplicaat, of een eindpunt dat geen effect heeft)',
      });
    }
  }
  return { data: { added }, itemRejections: rejections };
}

const addDependencies: BatchStepTool = {
  name: 'planner_add_dependencies',
  description:
    'Voeg NIEUWE relaties tussen taken toe. Per item: `predecessorId`, `successorId`, `type` ' +
    '(FINISH_START | FINISH_FINISH | START_START | START_FINISH — de KORTE vorm FS/FF/SS/SF die de ' +
    'leestools teruggeven mag ook) en optioneel `lag`. ' + LAG_DOC + ' ' +
    'Een verzameltaak (taak MET subtaken) als voorganger/opvolger is TOEGESTAAN — die relatie wordt ' +
    'doorgerekend naar de onderliggende bladtaken. Onbekende taak-id\'s, een reeds bestaande relatie, ' +
    'of een voorouder-relatie (een taak gekoppeld aan zijn eigen (voor)ouder-samenvattingstaak) ' +
    'worden per item zacht geweigerd; een kringverwijzing (over de bestaande én voorgestelde ' +
    'relaties) is een harde fout die de hele call terugrolt. ' +
    'WIL JE EEN BESTAANDE RELATIE WIJZIGEN (ander type, andere lag, andere voorganger/opvolger)? ' +
    'Gebruik planner_update_dependencies met het sequence-id — NIET verwijderen-en-opnieuw-toevoegen: ' +
    'dat verliest het id en levert twee undo-stappen op.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT },
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
  batchStep(args, ctx) {
    const parsed = parseAddDeps(args);
    if (typeof parsed === 'string') throw stepValidationError(parsed);
    return addDependenciesCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsed = parseAddDeps(args);
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const deps = parsed;
    // Lege-batch-snelpad (reviewfix Issue 2): levert de statische classificatie nul kandidaten (alle
    // items onbekend/dubbel/verkeerd type), return dan direct Ok mét de weigeringen — zónder
    // transactie/backup/snapshot/redo-wipe.
    {
      const state = ctx.app.store.getState();
      const pre = classifyDeps(state, deps);
      if (pre.candidates.length === 0) {
        const g = guardNonTransactional(ctx);
        if (g) return g;
        return okDirect(ctx, { added: [], projectEnd: projectEndInfo(state).projectEnd }, pre.rejections);
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
    else rejections.push({ id, reason: `relatie '${id}' bestaat niet` });
  }
  if (toRemove.size > 0) {
    ctx.app.store.setState((s) => {
      s.sequences = s.sequences.filter((x) => !toRemove.has(x.id));
      s.isDirty = true;
    });
  }
  return { data: { removed }, itemRejections: rejections };
}

const removeDependencies: BatchStepTool = {
  name: 'planner_remove_dependencies',
  description:
    'Verwijder relaties DEFINITIEF op hun sequence-id (zoals get_project_overview / get_task die ' +
    'teruggeven). Een onbekend id wordt per item zacht geweigerd. Retourneert de verwijderde id\'s en ' +
    'het nieuwe projecteinde. Wil je een relatie alleen AANPASSEN (type, lag, voorganger/opvolger)? ' +
    'Gebruik planner_update_dependencies — verwijderen en opnieuw toevoegen is daarvoor niet de route.',
  kind: 'mutate',
  batchable: true,
  annotations: { ...STD_ANNOT, destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: { ids: { type: 'array', minItems: 1, items: { type: 'string' }, description: 'Sequence-id\'s.' } },
    required: ['ids'],
    additionalProperties: false,
  },
  batchStep(args, ctx) {
    const parsed = parseIdList(args, 'remove_dependencies');
    if (typeof parsed === 'string') throw stepValidationError(parsed);
    return removeDependenciesCore(ctx, parsed);
  },
  async handler(args, ctx) {
    const parsed = parseIdList(args, 'remove_dependencies');
    if (typeof parsed === 'string') return toolError(ctx, 'VALIDATION', parsed);
    const ids = parsed;
    // Lege-batch-snelpad (reviewfix Issue 2): bestaat geen enkele opgegeven relatie, return dan direct
    // Ok mét de weigeringen — zónder transactie/backup/snapshot/redo-wipe.
    {
      const st = ctx.app.store.getState();
      const existing = new Set(st.sequences.map((s) => s.id));
      if (!ids.some((id) => existing.has(id))) {
        const g = guardNonTransactional(ctx);
        if (g) return g;
        const rej = ids.map((id) => ({ id, reason: `relatie '${id}' bestaat niet` }));
        return okDirect(ctx, { removed: [], projectEnd: projectEndInfo(st).projectEnd }, rej);
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
// planner_undo / planner_redo — gedeelde undo-stack PER DOCUMENT (ook de user schrijft erin). Één
// tool-mutatie = één stap. Niet-transactioneel: de store-acties beheren de stack zelf.
// =================================================================================================
/**
 * Gedeelde kern van undo/redo (audit-fix K5).
 *
 * `historySlice.undo/redo` doen `if (stack.length === 0) return;` — een STILLE no-op. Beide tools
 * gaven daarna onvoorwaardelijk `{ ok: true, data: { projectEnd } }` terug, dus een agent die drie
 * stappen terugdraaide kreeg drie identieke `ok`'s, of er nu één, geen of alle drie landden. Vanaf nu
 * meldt de respons of er daadwerkelijk iets is teruggedraaid én hoe diep beide stacks nog zijn.
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
      ...(done ? {} : { reason: `de toepasbare ${dir}-geschiedenis is leeg; er is niets ${dir === 'undo' ? 'teruggedraaid' : 'opnieuw uitgevoerd'}` }),
    },
  };
}

const undo: McpToolDef = {
  name: 'planner_undo',
  description:
    'Maak de laatste ongedaan-maakbare wijziging in het ACTIEVE document ongedaan (één stap). Controleer ' +
    'ALTIJD `undone` in het antwoord: zonder toepasbaar sessie-event blijft de call `ok` maar is `undone` false ' +
    '(met `reason`) — `ok` alleen betekent dus niet dat er iets is teruggedraaid. `undoDepth`/`redoDepth` ' +
    'geven alleen de resterende, voor het actieve document toepasbare sessiediepte. Globale gridvoorkeuren ' +
    'tellen mee; events van andere geopende documenten niet. De geschiedenis wordt GEDEELD met de gebruiker. Voor ' +
    'wat-als-werk: gebruik duplicate_document, niet undo.',
  kind: 'other',
  batchable: false,
  annotations: { ...STD_ANNOT },
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: (_args, ctx): McpToolResult => historyStep(ctx, 'undo'),
};

const redo: McpToolDef = {
  name: 'planner_redo',
  description:
    'Herhaal de laatst ongedaan gemaakte wijziging in het ACTIEVE document (één stap). Controleer ALTIJD ' +
    '`redone` in het antwoord: bij een lege redo-stack blijft de call `ok` maar is `redone` false (met ' +
    '`reason`). `undoDepth`/`redoDepth` geven de resterende, voor het actieve document toepasbare ' +
    'sessiediepte. Globale gridvoorkeuren tellen mee; events van andere documenten niet. Een nieuwe ' +
    'wijziging wist alleen botsende redo-scopes.',
  kind: 'other',
  batchable: false,
  annotations: { ...STD_ANNOT },
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: (_args, ctx): McpToolResult => historyStep(ctx, 'redo'),
};

// =================================================================================================
// planner_run_cpm — expliciete, geforceerde herberekening (CPM + kalender). Niet-transactioneel:
// runCPM pusht geen undo-snapshot, dus geen eigen undo-stap — behalve wanneer hij "datums zoals
// opgeslagen" verlaat (issue #63); dat overschrijft de opgeslagen datums en hoort ongedaan te kunnen.
// =================================================================================================
const runCpm: McpToolDef = {
  name: 'planner_run_cpm',
  description:
    'Herbereken de planning expliciet (kritieke-pad-methode + kalender) en wis daarmee `scheduleStale`. ' +
    'Retourneert het projecteinde, de projectduur (werkdagen) en een kritieke-pad-samenvatting. Mutaties ' +
    'herrekenen zelf al; gebruik dit om een verouderde planning te verversen of het resultaat op te vragen.',
  kind: 'other',
  batchable: false,
  annotations: { ...STD_ANNOT, idempotentHint: true },
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler(_args, ctx): McpToolResult {
    const g = guardNonTransactional(ctx);
    if (g) return g;
    ctx.app.store.getState().runCPM();
    const cpm = ctx.app.store.getState().cpmResult;
    return {
      ok: true,
      envelope: okEnvelope(ctx),
      data: {
        projectEnd: cpm?.projectEnd ?? '',
        projectDuration: cpm?.projectDuration ?? 0,
        criticalTaskCount: cpm?.criticalPath.length ?? 0,
        criticalPathTaskIds: cpm?.criticalPath ?? [],
        ...(cpm?.error ? { error: cpm.error } : {}),
      },
    };
  },
};

/** Alle T19-tools als vlakke module-array (registreer via één regel in toolRegistry.MODULES). */
export const taskTools: McpToolDef[] = [
  addTasks,
  updateTasks,
  deleteTasks,
  moveTask,
  addDependencies,
  removeDependencies,
  undo,
  redo,
  runCpm,
];
