// MCP-bridge — de tien LEESTOOLS (taak T18, spec §Tool-set Lezen, regels 67-80 + §Naamgeving 65).
//
// Elke tool draagt de `planner_`-prefix, een verplichte description (de AI kiest tools op
// beschrijving) en de leestool-annotaties (`readOnlyHint:true`, `openWorldHint:false`). De data is
// bewust COMPACT (velden die false/0/leeg zijn worden weggelaten) — deze payloads gaan als JSON over
// de bridge en de overview/list-tools kunnen op een groot project fors worden.
//
// Alle tools lopen door de lokale `readTool`-wikkel: die DELEGEERT naar `runReadTool` (dialoog-guard
// + live envelop, GEEN drift/pauze-blokkade — spec regel 116) en laat daarbovenop een tool een NETTE
// `ToolError`-code teruggeven (VALIDATION bij een onbekend id / ontbrekende baseline) i.p.v. de
// generieke INTERNAL die een kale throw zou opleveren.
//
// `get_resource_histogram` roept `ensureFreshSchedule` aan (herrekent ALLEEN als stale of nog nooit
// gerekend) en meldt in de data of het (her)berekend is; dat is de enige leestool die de store-cache
// raakt, en dat is een versheids-refresh, geen mutatie — de annotatie blijft `readOnlyHint:true`
// (spec: readOnlyHint op ALLE leestools).
//
// SINDS ISSUE #63 pusht `runCPM` in één geval wél een undo-snapshot: het verlaten van "datums zoals
// opgeslagen". Dat raakt deze leestool NIET, en dat is geen toeval maar een afgedwongen eigenschap:
// `ensureFreshSchedule` doet alleen iets bij `scheduleStale` of `cpmResult === null`, en in de modus
// is `scheduleStale` altijd `false` (`showRecordedDates` zet hem zo, `markScheduleStale` houdt hem
// zo) én `cpmResult` altijd gevuld (de reconstructie). "Modus aan én verouderd" is dus onbereikbaar
// — vastgelegd in check-recorded-dates.ts (10.C). Daarmee blijft `readOnlyHint:true` verdedigbaar.

import type { AppState } from '@/state/appStore';
import { ensureFreshSchedule } from '../staleGuard';
import { runReadTool, toolError } from './runtime';
import { lagLabel, seqAbbrev } from './sequenceFields';
import type { McpContext, McpToolDef, McpToolResult, McpErrorCode, McpToolAnnotations } from '../contracts';
import type { Task } from '@/types/task';
import { taskDurationUnit } from '@/engine/scheduler/duration';

function nativeDuration(task: Task): number {
  return taskDurationUnit(task) === 'hours'
    ? (task.time.durationMinutes ?? 0) / 60
    : task.time.scheduleDuration;
}
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { Baseline } from '@/types/baseline';
import { computeHistogramReport } from '@/engine/scheduler/ResourceLoad';
import { computeVariance, type VarianceRow } from '@/engine/variance';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
// Zelfde twee bronnen als het slot in `ResourcePanel` en de weigering in `resourceTools` — één lijst.
import { RESOURCE_DIFF_FIELDS, isResourceFieldLocked } from '@/services/library/libraryOps';

// ── Lokale leestool-wikkel + nette fout ──────────────────────────────────────────────────────────

/** Nette, aan een code gekoppelde tool-fout die de `readTool`-wikkel op een `McpToolErr` mapt
 *  (i.p.v. de INTERNAL die een kale throw zou geven). Voor onbekende id's / ontbrekende baselines. */
class ToolError extends Error {
  constructor(public code: McpErrorCode, message: string) {
    super(message);
  }
}

/**
 * Draai een leestool-kern. De guards zijn NIET meer gespiegeld maar GEDELEGEERD aan `runReadTool`
 * (eindintegratie): er was een derde, private kopie van de dialoog-guard die — anders dan de
 * runtime-versie — niet BENOEMDE wélke dialoog blokkeert, en die bij een volgende wijziging aan de
 * guard-volgorde stil uit de pas zou lopen. Eén implementatie dus; deze wikkel voegt alleen nog het
 * enige toe wat `runReadTool` niet kent: een `ToolError` uit `fn` behoudt zijn EIGEN code
 * (VALIDATION bij een onbekend id / ontbrekende baseline) i.p.v. de generieke INTERNAL die een kale
 * throw oplevert.
 *
 * De `ToolError` wordt binnen de callback afgevangen en via een houder naar buiten gedragen: gooien
 * we hem door, dan maakt `runReadTool` er onherroepelijk INTERNAL van.
 */
function readTool(ctx: McpContext, fn: (s: AppState) => unknown): McpToolResult {
  // Houder i.p.v. een losse `let`: TypeScript's control-flow-analyse zou een in een callback
  // toegewezen variabele na de aanroep nog steeds als `null` narrowen.
  const nice: { err: ToolError | null } = { err: null };
  const res = runReadTool(ctx, (s) => {
    try {
      return fn(s);
    } catch (e) {
      if (e instanceof ToolError) {
        nice.err = e;
        return undefined;
      }
      throw e; // elke andere throw blijft INTERNAL, afgehandeld door runReadTool
    }
  });
  if (nice.err) return toolError(ctx, nice.err.code, nice.err.message);
  return res;
}

/** Leestool-annotaties (spec §Naamgeving): readOnly, niet-destructief, geen open wereld. `idempotentHint`
 *  is per MCP-conventie alleen zinvol op niet-readOnly tools ⇒ false. */
const READ_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

// ── Compacte helpers ─────────────────────────────────────────────────────────────────────────────

// `seqAbbrev` (FS/SS/FF/SF) en `lagLabel` ("+2d"/"+50%") staan sinds `planner_update_dependencies` in
// de gedeelde veldlaag `sequenceFields.ts`: de SCHRIJFKANT moet exact deze notatie kunnen terugnemen,
// en dat lukt alleen met één implementatie. Zie de kop van dat bestand.

/** Voortgang 0-1 → geheel percent 0-100 (spec-conventie completion 0-100). */
function pct(completion: number): number {
  return Math.round((completion ?? 0) * 100);
}

/** WBS van een taak-id, of het id zelf als terugval (mocht een relatie naar een onbekende taak wijzen). */
function wbsOf(taskById: Map<string, Task>, id: string): string {
  return taskById.get(id)?.wbsCode ?? id;
}

/**
 * Verkorte uitgaande relatie vanuit een voorganger: "→2.3 FS+2d #seq-7" (spec-rij
 * get_project_overview), met het SEQUENCE-ID als `#`-suffix.
 *
 * H6 — waarom het id erbij moet: de overview wordt aangeprezen als DE call voor structuur- en
 * netwerkanalyse ("één call volstaat"), maar élke mutatietool sleutelt op id — `remove_dependencies`
 * neemt letterlijk sequence-id's. Zonder id moest de agent na de overview alsnog `get_task` per taak
 * ophalen om aan een relatie-id te komen, wat vele malen duurder is dan de ~10 tekens die dit kost.
 */
function relShort(taskById: Map<string, Task>, seq: Sequence): string {
  return `→${wbsOf(taskById, seq.successorId)} ${seqAbbrev(seq.type)}${lagLabel(seq)} #${seq.id}`;
}

interface PageArgs {
  limit?: unknown;
  offset?: unknown;
}

interface Paged<T> {
  items: T[];
  total: number;
  has_more: boolean;
  next_offset: number | null;
}

// ── Invoervalidatie voor de leestools (auditbevindingen H10 + L1) ────────────────────────────────
//
// De leestools accepteerden hun filters ONGEVALIDEERD. Dat is bij een leestool net zo schadelijk als
// bij een mutatietool, alleen stiller: `kritiek: "true"` matchte noch `=== true` noch `=== false`,
// dus het filter werd NIET toegepast en de volledige takenlijst kwam terug alsof het de kritieke
// verzameling was. `status: 'started'` gaf `{tasks: [], total: 0}` — niet te onderscheiden van "geen
// gestarte taken". `van: '01-03-2026'` werd als kale string vergeleken (rommel-lexicografie).
// Elke fout is nu een NETTE VALIDATION-fout die de toegestane waarden noemt.

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}/;
const TASK_STATUSES = ['NOT_STARTED', 'STARTED', 'COMPLETED'];

/**
 * Weiger elke sleutel die deze leestool niet kent (`additionalProperties: false`, maar dan als
 * RUNTIME-poort in de tool zelf).
 *
 * WAAROM DIT HIER MOET STAAN EN NIET ALLEEN IN HET SCHEMA. De dispatcher valideert `inputSchema`,
 * maar `planner_batch` roept leestools rechtstreeks via `def.handler(...)` aan (leestools hebben
 * geen `batchStep`) en slaat die validatie dus over. Een verschreven filter — `{kritisch: true}`
 * i.p.v. `kritiek` — werd LOS netjes geweigerd, maar als batch-stap stil genegeerd, waarna de
 * volledige takenlijst terugkwam als "de kritieke taken". Dat is de gemeenste variant van een stille
 * fout: bij een mutatie merk je later dat er niets veranderd is, maar hier krijgt de aanroeper een
 * plausibel-maar-ONJUIST antwoord en bouwt hij zijn volgende stap daarop.
 *
 * Deze poort maakt de leestools zelfdragend: ze zijn correct ongeacht welk pad ze aanroept. Dat de
 * dispatcher hetzelfde nog eens doet is onschadelijk.
 */
function requireOnlyKeys(args: unknown, allowed: readonly string[], toolName: string): void {
  if (args === undefined || args === null) return;
  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new ToolError('VALIDATION', `${toolName} verwacht een object met argumenten.`);
  }
  for (const key of Object.keys(args as Record<string, unknown>)) {
    if (allowed.includes(key)) continue;
    throw new ToolError('VALIDATION',
      allowed.length === 0
        ? `${toolName} neemt geen argumenten, maar kreeg \`${key}\`.`
        : `onbekend argument \`${key}\` voor ${toolName}; toegestaan: ${allowed.join(', ')}.`);
  }
}

const PAGE_KEYS = ['limit', 'offset'] as const;
const LIST_TASKS_KEYS = ['kritiek', 'status', 'van', 'tot', 'zonder_relaties', ...PAGE_KEYS] as const;
const HISTOGRAM_KEYS = ['resourceIds', 'van', 'tot', 'bucket'] as const;

/** Gooit een `ToolError` wanneer `v` gezet maar geen boolean is. */
function requireBool(v: unknown, name: string): void {
  if (v !== undefined && typeof v !== 'boolean') {
    throw new ToolError('VALIDATION', `\`${name}\` moet een boolean zijn (true/false), kreeg ${typeof v} '${String(v)}'.`);
  }
}

/** Gooit een `ToolError` wanneer `v` gezet maar geen ISO-datum (JJJJ-MM-DD) is. */
function requireIsoDate(v: unknown, name: string): void {
  if (v === undefined) return;
  if (typeof v !== 'string' || !ISO_DATE_ONLY.test(v)) {
    throw new ToolError('VALIDATION', `\`${name}\` moet een ISO-datum zijn (JJJJ-MM-DD), kreeg '${String(v)}'.`);
  }
}

/**
 * Valideer `limit`/`offset` i.p.v. ze stil te klemmen (L1). Een `limit: 5000` die stil 1000 wordt,
 * of een `limit: 0` die stil 1 wordt, kost de aanroeper een onnodige ronde zonder dat hij begrijpt
 * waarom hij niet kreeg wat hij vroeg.
 */
function requirePageArgs(args: PageArgs): void {
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || !Number.isInteger(args.limit) || args.limit < 1 || args.limit > 1000) {
      throw new ToolError('VALIDATION', `\`limit\` moet een geheel getal van 1 t/m 1000 zijn, kreeg '${String(args.limit)}'.`);
    }
  }
  if (args.offset !== undefined) {
    if (typeof args.offset !== 'number' || !Number.isInteger(args.offset) || args.offset < 0) {
      throw new ToolError('VALIDATION', `\`offset\` moet een geheel getal ≥ 0 zijn, kreeg '${String(args.offset)}'.`);
    }
  }
}

/** Uniforme paginering (spec §Naamgeving): limit default 50, offset default 0, retour total/has_more/
 *  next_offset. `next_offset` is null zodra er niets meer volgt (heldere "einde"-markering).
 *  De waarden zijn op dit punt al door `requirePageArgs` gevalideerd; de klemmen hieronder blijven
 *  puur als vangnet staan. */
function paginate<T>(items: T[], args: PageArgs): Paged<T> {
  const rawLimit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.floor(args.limit) : 50;
  const limit = Math.max(1, Math.min(rawLimit, 1000)); // harde bovengrens tegen een reuze-pagina
  const rawOffset = typeof args.offset === 'number' && Number.isFinite(args.offset) ? Math.floor(args.offset) : 0;
  const offset = Math.max(0, rawOffset);
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const has_more = nextOffset < items.length;
  return { items: page, total: items.length, has_more, next_offset: has_more ? nextOffset : null };
}

/** Alle taak-id's die in minstens één relatie voorkomen (als voorganger óf opvolger) — basis voor
 *  de wees-detectie (`zonder_relaties`). */
function idsInAnySequence(sequences: Sequence[]): Set<string> {
  const s = new Set<string>();
  for (const seq of sequences) {
    s.add(seq.predecessorId);
    s.add(seq.successorId);
  }
  return s;
}

/** De actieve baseline of null. */
function activeBaseline(s: AppState): Baseline | null {
  if (!s.activeBaselineId) return null;
  return s.baselines.find((b) => b.id === s.activeBaselineId) ?? null;
}

/** Compacte kalender-samenvatting (voor project_info). */
function calendarSummary(cal: WorkCalendar) {
  return {
    id: cal.id,
    name: cal.name,
    workDays: cal.workDays,
    hoursPerDay: cal.hoursPerDay,
    holidayRanges: cal.holidays.length,
    isHourCalendar: !!cal.workTime,
  };
}

// ── 1. planner_get_project_info ──────────────────────────────────────────────────────────────────

function getProjectInfo(s: AppState) {
  const tasks = s.tasks;
  const leaves = tasks.filter((t) => t.childIds.length === 0);
  const summaries = tasks.filter((t) => t.childIds.length > 0);
  const milestones = tasks.filter((t) => t.isMilestone);
  const criticalCount = tasks.filter((t) => t.time.isCritical).length;
  const p = s.project;
  return {
    project: {
      id: p.id,
      name: p.name,
      description: p.description,
      startDate: p.startDate,
      endDate: p.endDate,
      author: p.author,
      company: p.company,
      ...(p.statusDate ? { statusDate: p.statusDate } : {}),
      ...(p.progressMode ? { progressMode: p.progressMode } : {}),
    },
    statistics: {
      totalTasks: tasks.length,
      leafTasks: leaves.length,
      summaryTasks: summaries.length,
      milestones: milestones.length,
      relations: s.sequences.length,
      resources: s.resources.length,
      assignments: s.assignments.length,
      criticalTasks: criticalCount,
    },
    schedule: {
      scheduleStale: s.scheduleStale,
      projectEnd: s.cpmResult?.projectEnd ?? null,
      projectDuration: s.cpmResult?.projectDuration ?? null,
      hasResult: !!s.cpmResult && !s.cpmResult.error,
      ...(s.cpmResult?.error ? { error: s.cpmResult.error } : {}),
    },
    calendar: calendarSummary(s.calendar),
    calendarLibraryCount: s.calendars.length,
  };
}

// ── 2. planner_get_project_overview ──────────────────────────────────────────────────────────────

function getProjectOverview(s: AppState) {
  const tasks = s.tasks;
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  // Uitgaande relaties per voorganger — zo verschijnt ELKE relatie precies één keer en is de
  // volledige relatiegraaf gegarandeerd in deze ene respons aanwezig (spec: één call volstaat).
  const outByPred = new Map<string, Sequence[]>();
  for (const seq of s.sequences) {
    const arr = outByPred.get(seq.predecessorId);
    if (arr) arr.push(seq);
    else outByPred.set(seq.predecessorId, [seq]);
  }
  const rows = tasks.map((t) => {
    const rels = (outByPred.get(t.id) ?? []).map((seq) => relShort(taskById, seq));
    const row: Record<string, unknown> = {
      // H6: het STABIELE Task.id staat vooraan. Zonder dit veld kon geen enkele mutatietool op de
      // overview gevoed worden (die sleutelen allemaal op id, niet op WBS) — de "één call volstaat"-
      // belofte in de beschrijving klopte daardoor niet voor structuurWERK, alleen voor -analyse.
      id: t.id,
      wbs: t.wbsCode,
      name: t.name,
      dur: nativeDuration(t),
      durUnit: taskDurationUnit(t),
      start: t.time.earlyStart,
      end: t.time.earlyFinish,
    };
    if (t.parentId) row.parent = taskById.get(t.parentId)?.wbsCode ?? t.parentId;
    const p = pct(t.time.completion);
    if (p > 0) row.prog = p;
    if (t.time.isCritical) row.crit = true;
    if (t.isMilestone) row.ms = true;
    if (rels.length > 0) row.rels = rels;
    return row;
  });
  return {
    projectName: s.project.name,
    taskCount: tasks.length,
    relationCount: s.sequences.length,
    scheduleStale: s.scheduleStale,
    tasks: rows,
  };
}

// ── 3. planner_list_tasks ────────────────────────────────────────────────────────────────────────

interface ListTasksArgs extends PageArgs {
  kritiek?: unknown;
  status?: unknown;
  van?: unknown;
  tot?: unknown;
  zonder_relaties?: unknown;
}

function listTasks(s: AppState, args: ListTasksArgs) {
  // H10 — elk filter eerst valideren; een fout filter mag NOOIT stil een andere verzameling geven.
  requireOnlyKeys(args, LIST_TASKS_KEYS, 'list_tasks');
  requireBool(args.kritiek, 'kritiek');
  requireBool(args.zonder_relaties, 'zonder_relaties');
  if (args.status !== undefined && !TASK_STATUSES.includes(args.status as string)) {
    throw new ToolError('VALIDATION',
      `\`status\` moet één van ${TASK_STATUSES.join(', ')} zijn (hoofdlettergevoelig), kreeg '${String(args.status)}'.`);
  }
  requireIsoDate(args.van, 'van');
  requireIsoDate(args.tot, 'tot');
  requirePageArgs(args);

  const inSeq = idsInAnySequence(s.sequences);
  let filtered = s.tasks;

  if (args.kritiek === true) filtered = filtered.filter((t) => t.time.isCritical);
  if (args.kritiek === false) filtered = filtered.filter((t) => !t.time.isCritical);
  if (typeof args.status === 'string') {
    const st = args.status;
    filtered = filtered.filter((t) => t.status === st);
  }
  // Datumvenster: overlap van [earlyStart, earlyFinish] met [van, tot] (ISO-string-vergelijking).
  if (typeof args.van === 'string') {
    const van = args.van;
    filtered = filtered.filter((t) => (t.time.earlyFinish || t.time.scheduleFinish) >= van);
  }
  if (typeof args.tot === 'string') {
    const tot = args.tot;
    filtered = filtered.filter((t) => (t.time.earlyStart || t.time.scheduleStart) <= tot);
  }
  // Wees-detectie: alléén LEAF-taken die in geen enkele relatie voorkomen. Verzameltaken hebben per
  // definitie geen relaties en zijn dus geen "wezen" — die worden hier bewust uitgesloten.
  if (args.zonder_relaties === true) {
    filtered = filtered.filter((t) => t.childIds.length === 0 && !inSeq.has(t.id));
  }

  const paged = paginate(filtered, args);
  const rows = paged.items.map((t) => {
    const row: Record<string, unknown> = {
      id: t.id,
      wbs: t.wbsCode,
      name: t.name,
      dur: nativeDuration(t),
      durUnit: taskDurationUnit(t),
      start: t.time.earlyStart,
      end: t.time.earlyFinish,
      status: t.status,
    };
    const p = pct(t.time.completion);
    if (p > 0) row.prog = p;
    if (t.time.isCritical) row.crit = true;
    if (t.isMilestone) row.ms = true;
    if (t.childIds.length > 0) row.summary = true;
    return row;
  });
  return {
    tasks: rows,
    total: paged.total,
    has_more: paged.has_more,
    next_offset: paged.next_offset,
  };
}

// ── 4. planner_get_task ──────────────────────────────────────────────────────────────────────────

interface GetTaskArgs {
  taskId?: unknown;
}

function getTask(s: AppState, args: GetTaskArgs) {
  requireOnlyKeys(args, ['taskId'], 'get_task');
  if (typeof args.taskId !== 'string' || args.taskId === '') {
    throw new ToolError('VALIDATION', 'get_task vereist een `taskId` (string).');
  }
  const task = s.tasks.find((t) => t.id === args.taskId);
  if (!task) {
    throw new ToolError('NOT_FOUND', `Onbekende taak-id: ${args.taskId}`);
  }
  const taskById = new Map(s.tasks.map((t) => [t.id, t]));
  const resById = new Map(s.resources.map((r) => [r.id, r]));

  const assignments = s.assignments
    .filter((a) => a.taskId === task.id)
    .map((a) => ({
      assignmentId: a.id,
      resourceId: a.resourceId,
      resourceName: resById.get(a.resourceId)?.name ?? null,
      unitsPerDay: a.unitsPerDay,
      curve: a.curve ?? 'UNIFORM',
    }));

  const predecessors = s.sequences
    .filter((seq) => seq.successorId === task.id)
    .map((seq) => ({
      seqId: seq.id,
      taskId: seq.predecessorId,
      wbs: wbsOf(taskById, seq.predecessorId),
      type: seqAbbrev(seq.type),
      lag: lagLabel(seq),
    }));
  const successors = s.sequences
    .filter((seq) => seq.predecessorId === task.id)
    .map((seq) => ({
      seqId: seq.id,
      taskId: seq.successorId,
      wbs: wbsOf(taskById, seq.successorId),
      type: seqAbbrev(seq.type),
      lag: lagLabel(seq),
    }));

  // Effectieve kalender (§5): taak-kalender uit de bibliotheek, anders de projectkalender.
  const effCal = resolveCalendar(task.calendarId, s.calendars, s.calendar);

  const tt = task.time;
  return {
    id: task.id,
    wbs: task.wbsCode,
    name: task.name,
    description: task.description,
    taskType: task.taskType,
    ...(task.customTaskTypeId ? {
      customTaskType: {
        id: task.customTaskTypeId,
        // Een beschadigd/oud project mag leesbaar blijven: de id blijft zichtbaar, naam is dan null.
        name: s.customTaskTypes.find(type => type.id === task.customTaskTypeId)?.name ?? null,
      },
    } : {}),
    status: task.status,
    isMilestone: task.isMilestone,
    ...(task.milestoneKind ? { milestoneKind: task.milestoneKind } : {}),
    ...(task.isHammock ? { isHammock: true } : {}),
    ...(task.mandatory ? { mandatory: true } : {}),
    // F5 (spec-review-fixronde op 526af9f9, plan-Z14 regel ~470) — leeskant-rand: elk veld dat de
    // .mpp-import (Z0/Z4/Z14b) op de taak zet, moet ook via de MCP-bridge leesbaar zijn, anders kan
    // een AI-client een geïmporteerd project niet inspecteren. `manuallyScheduled`/`splitGaps`/
    // `levelingDelayMinutes` bestonden al als Task-veld (Z0/Z4) maar ontbraken hier nog; `mspTaskType`/
    // `effortDriven`/`timephasedContours` zijn Z14b-nieuw. Alle zes READ-ONLY via de bridge: ook
    // `manuallyScheduled` heeft een REJECT_HINTS-entry (O3: "conform het isHammock-patroon", en
    // isHammock is zelf via de bridge afgewezen) — mutatie-bewezen door de her-check-probe.
    ...(task.manuallyScheduled ? { manuallyScheduled: true } : {}),
    ...(task.splitGaps && task.splitGaps.length > 0 ? { splitGaps: task.splitGaps } : {}),
    ...(task.levelingDelayMinutes != null ? { levelingDelayMinutes: task.levelingDelayMinutes } : {}),
    ...(task.mspTaskType ? { mspTaskType: task.mspTaskType } : {}),
    ...(task.effortDriven ? { effortDriven: true } : {}),
    ...(task.timephasedContours && task.timephasedContours.length > 0 ? { timephasedContours: task.timephasedContours } : {}),
    parentId: task.parentId,
    childIds: task.childIds,
    duration: nativeDuration(task),
    durationUnit: taskDurationUnit(task),
    durationType: tt.durationType,
    schedule: {
      earlyStart: tt.earlyStart,
      earlyFinish: tt.earlyFinish,
      lateStart: tt.lateStart,
      lateFinish: tt.lateFinish,
      totalFloat: tt.totalFloat,
      freeFloat: tt.freeFloat,
      isCritical: tt.isCritical,
    },
    progress: {
      completion: pct(tt.completion),
      ...(tt.actualStart ? { actualStart: tt.actualStart } : {}),
      ...(tt.actualFinish ? { actualFinish: tt.actualFinish } : {}),
      // Een voltooide taak wordt op zijn actuals gepind, maar de gerekende datums liggen ALTIJD op
      // een werkdag van de taakkalender. Valt de `actualFinish` in onwerkbare tijd (weekend, bouwvak,
      // feestdag), dan is `earlyFinish` de laatste werkdag daarvóór en wijkt hij zichtbaar af van het
      // geregistreerde feit. Dat verschil stil laten staan is precies wat dit oppervlak niet doet:
      // een AI die de twee velden naast elkaar ziet, concludeert anders dat de herberekening kapot is
      // (zo is deze bevinding ook binnengekomen). Alleen zichtbaar wanneer er iets te melden valt.
      ...(tt.completion >= 1 && tt.actualFinish && tt.earlyFinish && tt.earlyFinish !== tt.actualFinish
        ? {
            actualFinishAdjusted: {
              actualFinish: tt.actualFinish,
              earlyFinish: tt.earlyFinish,
              reason:
                'De `actualFinish` valt buiten de werktijd van de kalender ' +
                `"${effCal.name}" (weekend, feestdag of bouwvak). De gerekende finish is daarom de ` +
                'dichtstbijzijnde werk-moment op-of-vóór het feit; de actual zelf blijft ongewijzigd ' +
                'bewaard. Wil je dat de berekening het feit letterlijk volgt, maak die periode dan ' +
                'werkbaar in de kalender (planner_update_calendar).',
            },
          }
        : {}),
    },
    ...(task.constraint ? { constraint: task.constraint } : {}),
    ...(task.constraint2 ? { constraint2: task.constraint2 } : {}),
    ...(task.deadline ? { deadline: task.deadline } : {}),
    calendar: {
      effectiveId: effCal.id,
      effectiveName: effCal.name,
      isProjectDefault: !task.calendarId || task.calendarId === s.calendar.id,
    },
    assignments,
    predecessors,
    successors,
  };
}

// ── 5. planner_get_critical_path ─────────────────────────────────────────────────────────────────

function getCriticalPath(s: AppState) {
  const cpm = s.cpmResult;
  if (!cpm || cpm.error) {
    return {
      scheduleStale: s.scheduleStale,
      hasResult: false,
      ...(cpm?.error ? { error: cpm.error } : {}),
      note: 'Geen (geldig) planningsresultaat — draai planner_run_cpm.',
      criticalTasks: [],
      drivingRelations: [],
    };
  }
  const taskById = new Map(s.tasks.map((t) => [t.id, t]));
  const critSet = new Set(cpm.criticalPath);

  // Kritieke taken in TOPO-volgorde (cpm.criticalPath is opgebouwd in de solver-order).
  const criticalTasks = cpm.criticalPath.map((id) => {
    const t = taskById.get(id);
    const r = cpm.tasks.get(id);
    return {
      id,
      wbs: t?.wbsCode ?? id,
      name: t?.name ?? '',
      start: r?.earlyStart ?? '',
      end: r?.earlyFinish ?? '',
      totalFloat: r?.totalFloat ?? 0,
    };
  });

  // Driving-relaties GEFILTERD op paren waarvan BEIDE eindpunten kritiek zijn (spec-rij).
  const seqById = new Map(s.sequences.map((seq) => [seq.id, seq]));
  const drivingRelations = cpm.drivingSequenceIds
    .map((id) => seqById.get(id))
    .filter((seq): seq is Sequence => !!seq && critSet.has(seq.predecessorId) && critSet.has(seq.successorId))
    .map((seq) => ({
      seqId: seq.id,
      predId: seq.predecessorId,
      predWbs: wbsOf(taskById, seq.predecessorId),
      succId: seq.successorId,
      succWbs: wbsOf(taskById, seq.successorId),
      type: seqAbbrev(seq.type),
      lag: lagLabel(seq),
    }));

  // Gescheiden parallelle ketens (`criticalPaths`) bestaan ALLEEN bij floatPaths.enabled mét
  // FREE_FLOAT; in elk ander geval is criticalPaths === [criticalPath] (één samengevoegd array).
  // De respons meldt welke situatie geldt; reconstructie van de keten is client-werk.
  const fp = s.project.schedulingOptions?.floatPaths;
  const parallelAvailable = fp?.enabled === true && fp.method === 'FREE_FLOAT';
  const base = {
    scheduleStale: s.scheduleStale,
    hasResult: true,
    projectEnd: cpm.projectEnd,
    criticalTasks,
    drivingRelations,
    pathsMode: parallelAvailable ? ('parallel' as const) : ('merged' as const),
  };
  if (parallelAvailable) {
    // Naar WBS mappen zodat de client de ketens leesbaar heeft (id's blijven in criticalTasks).
    return {
      ...base,
      criticalPaths: cpm.criticalPaths.map((chain) => chain.map((id) => wbsOf(taskById, id))),
      criticalPathIds: cpm.criticalPaths,
    };
  }
  return base;
}

// ── 6. planner_list_resources ────────────────────────────────────────────────────────────────────

function listResources(s: AppState, args: PageArgs) {
  requireOnlyKeys(args, PAGE_KEYS, 'list_resources');
  requirePageArgs(args);
  // Toewijzings-samenvatting per resource (aantal toewijzingen, aantal betrokken taken, som units/dag).
  const byRes = new Map<string, { assignments: number; tasks: Set<string>; totalUnits: number }>();
  for (const a of s.assignments) {
    let e = byRes.get(a.resourceId);
    if (!e) { e = { assignments: 0, tasks: new Set(), totalUnits: 0 }; byRes.set(a.resourceId, e); }
    e.assignments += 1;
    e.tasks.add(a.taskId);
    e.totalUnits += a.unitsPerDay;
  }
  const paged = paginate(s.resources, args);
  const rows = paged.items.map((r) => {
    const e = byRes.get(r.id);
    const row: Record<string, unknown> = {
      id: r.id,
      name: r.name,
      type: r.type,
      maxUnits: r.maxUnits,
      assignmentCount: e ? e.assignments : 0,
      assignedTaskCount: e ? e.tasks.size : 0,
      totalUnitsPerDay: e ? Math.round(e.totalUnits * 100) / 100 : 0,
    };
    if (typeof r.costPerHour === 'number') row.costPerHour = r.costPerHour;
    if (r.unitOfMeasure) row.unitOfMeasure = r.unitOfMeasure;
    if (r.calendarId) row.calendarId = r.calendarId;
    // LEESKANT ↔ SCHRIJFKANT (planner_manage_resources): elk veld dat schrijfbaar is, moet ook
    // leesbaar zijn — anders kan een AI een resource niet lezen, aanpassen en terugschrijven zonder
    // te raden. Deze drie ontbraken: ze zijn in het resourcepaneel gewoon zichtbaar/bewerkbaar en
    // round-trippen door IFC (`OPS_Resource`-pset + IFCRELNESTS), maar kwamen hier nooit terug.
    if (r.description) row.description = r.description;
    if (r.parentId) row.parentId = r.parentId;
    if (r.availabilitySteps && r.availabilitySteps.length > 0) row.availabilitySteps = r.availabilitySteps;
    // HERKOMST UIT EEN BEDRIJFSBIBLIOTHEEK (B1.1, issue #19). `planner_manage_resources` weigert een
    // wijziging op de velden die de bibliotheek bepaalt — dan moet de aanroeper dát hier kunnen ZIEN
    // in plaats van het pas bij de weigering te ontdekken (leeskant ↔ schrijfkant). `status: null`
    // betekent een stempel van een ander/onbekend bedrijf: dan geldt er géén slot en is de rij, net
    // als in het resourcepaneel, gewoon bewerkbaar. `lockedFields` is dan leeg.
    if (r.libraryOrigin) {
      const st = s.onOpenStatusForResource(r.id);
      row.library = {
        company: s.companies.find((c) => c.id === r.libraryOrigin!.companyId)?.name ?? null,
        status: st,
        lockedFields: isResourceFieldLocked(st) ? [...RESOURCE_DIFF_FIELDS] : [],
      };
    }
    return row;
  });
  return {
    resources: rows,
    total: paged.total,
    has_more: paged.has_more,
    next_offset: paged.next_offset,
  };
}

// ── 7. planner_get_resource_histogram ────────────────────────────────────────────────────────────

interface HistogramArgs {
  resourceIds?: unknown;
  van?: unknown;
  tot?: unknown;
  bucket?: unknown;
}

function getResourceHistogram(ctx: McpContext, args: HistogramArgs) {
  // H10 — VALIDEREN VÓÓR DE (potentieel dure) RECOMPUTE. Drie stille faalgevallen zaten hier:
  //   - `bucket` werd gecoërceerd (`bucket: 'day'` werd stil 'week');
  //   - niet-string `resourceIds` werden weggefilterd; viel alles weg, dan werd `scoped` false en
  //     schakelde de tool stil naar de AGGREGAAT-modus — een heel andere respons dan gevraagd;
  //   - een onbekend resource-id gaf een lege reeks die leest als "geen belasting".
  requireOnlyKeys(args, HISTOGRAM_KEYS, 'get_resource_histogram');
  if (args.bucket !== undefined && args.bucket !== 'dag' && args.bucket !== 'week') {
    throw new ToolError('VALIDATION',
      `\`bucket\` moet 'dag' of 'week' zijn (Nederlandse waarden), kreeg '${String(args.bucket)}'.`);
  }
  requireIsoDate(args.van, 'van');
  requireIsoDate(args.tot, 'tot');
  let resourceIds: string[] | undefined;
  if (args.resourceIds !== undefined) {
    if (!Array.isArray(args.resourceIds)) {
      throw new ToolError('VALIDATION', "`resourceIds` moet een array van resource-id-strings zijn.");
    }
    if (args.resourceIds.some((x) => typeof x !== 'string' || x === '')) {
      throw new ToolError('VALIDATION', '`resourceIds` mag alleen niet-lege resource-id-strings bevatten.');
    }
    const known = new Set(ctx.app.store.getState().resources.map((r) => r.id));
    const unknown = (args.resourceIds as string[]).filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new ToolError('VALIDATION',
        `onbekende resource-id(s): ${unknown.join(', ')} — haal geldige id's op met planner_list_resources.`);
    }
    resourceIds = args.resourceIds as string[];
  }

  // Vers herrekenen wanneer stale of nog nooit gerekend. Dit is de enige leestool die de cache
  // raakt; het is een versheids-refresh, geen mutatie — en hij kan de undo-stack niet raken, want
  // "datums zoals opgeslagen" is onbereikbaar in combinatie met stale/nooit-gerekend (zie de kop).
  const fresh = ensureFreshSchedule(ctx.app);
  const s = ctx.app.store.getState(); // verse contextstate ná een eventuele recompute

  const bucket: 'dag' | 'week' = args.bucket === 'dag' ? 'dag' : 'week';
  const from = typeof args.van === 'string' ? args.van : undefined;
  const to = typeof args.tot === 'string' ? args.tot : undefined;

  const resNameById = new Map(s.resources.map((r) => [r.id, r.name]));
  // Versheids-melding, gedeeld door beide paden: was de planning stale, dan is die vers herrekend.
  const freshMeta = {
    recomputed: fresh.recomputed,
    ...(fresh.error ? { scheduleError: fresh.error } : {}),
    ...(fresh.recomputed
      ? { warning: 'De planning was verouderd; het histogram is vers herrekend vóór dit rapport.' }
      : {}),
  };

  const scoped = (resourceIds && resourceIds.length > 0) || from !== undefined || to !== undefined;

  // ── Ongescopt (geen venster ÉN geen resourceIds) ⇒ AGGREGAAT-default ───────────────────────────
  // Een naïeve eerste call over een groot project zou anders per resource honderden bucket-rijen
  // opleveren (fors payload/token-verbruik). We geven dan per resource een compacte samenvatting die
  // de PIEKEN NOOIT verbergt (peakLoad + datum, aantal overbelaste dagen, spanne, capaciteits-/
  // belastingssom), met `detailAvailable: true` + hint zodat de client gericht kan inzoomen. Intern
  // rekenen we in DAG-granulariteit zodat de piekdatum exact is; er gaan géén bucket-arrays over.
  if (!scoped) {
    const dayReport = computeHistogramReport({
      tasks: s.tasks,
      sequences: s.sequences,
      assignments: s.assignments,
      resources: s.resources,
      calendar: s.calendar,
      calendars: s.calendars,
      cpmResult: s.cpmResult,
      bucket: 'dag',
    });
    const round2 = (v: number) => Math.round(v * 100) / 100;
    const resources = dayReport.resources.map((r) => {
      let peakLoad = 0;
      let peakDate: string | null = null;
      let loadSum = 0;
      let capacitySum = 0;
      let overallocatedDayCount = 0;
      let spanStart: string | null = null;
      let spanEnd: string | null = null;
      for (const b of r.buckets) {
        if (b.peakDayLoad > peakLoad) { peakLoad = b.peakDayLoad; peakDate = b.start; }
        loadSum += b.load;
        capacitySum += b.capacity;
        overallocatedDayCount += b.overallocatedDays.length;
        if (b.load > 0) {
          if (spanStart === null) spanStart = b.start;
          spanEnd = b.end;
        }
      }
      return {
        resourceId: r.resourceId,
        resourceName: resNameById.get(r.resourceId) ?? null,
        peakLoad: round2(peakLoad),
        peakDate,
        overallocatedDayCount,
        loadSum: round2(loadSum),
        capacitySum: round2(capacitySum),
        spanStart,
        spanEnd,
      };
    });
    return {
      mode: 'aggregate' as const,
      detailAvailable: true,
      hint: 'Aggregaat per resource (pieken zichtbaar via peakLoad/overallocatedDayCount). Geef `resourceIds` en/of een venster (`van`/`tot`) voor volledig bucket-detail.',
      ...freshMeta,
      resources,
    };
  }

  // ── Gescopt (venster en/of resourceIds) ⇒ VOLLEDIG bucket-detail (bestaand gedrag) ─────────────
  const report = computeHistogramReport({
    tasks: s.tasks,
    sequences: s.sequences,
    assignments: s.assignments,
    resources: s.resources,
    calendar: s.calendar,
    calendars: s.calendars,
    cpmResult: s.cpmResult,
    resourceIds,
    from,
    to,
    bucket,
  });
  const resources = report.resources.map((r) => ({
    resourceId: r.resourceId,
    resourceName: resNameById.get(r.resourceId) ?? null,
    buckets: r.buckets,
  }));
  return {
    mode: 'detail' as const,
    bucket,
    ...freshMeta,
    resources,
  };
}

// ── 8. planner_get_calendars ─────────────────────────────────────────────────────────────────────

function getCalendars(s: AppState) {
  // Unie cache (projectkalender) + bibliotheek, gededupt op id; projectkalender eerst.
  const byId = new Map<string, WorkCalendar>();
  byId.set(s.calendar.id, s.calendar);
  for (const c of s.calendars) if (!byId.has(c.id)) byId.set(c.id, c);

  // Gebruikt-door tellingen. Voor de projectdefault tellen ook taken/resources ZONDER expliciete
  // calendarId mee (die vallen terug op de projectkalender).
  const projectDefaultId = s.calendar.id;
  const list = [...byId.values()].map((cal) => {
    const isDefault = cal.id === projectDefaultId;
    const usedByTasks = s.tasks.filter((t) =>
      isDefault ? (!t.calendarId || t.calendarId === cal.id) : t.calendarId === cal.id,
    ).length;
    const usedByResources = s.resources.filter((r) =>
      isDefault ? (!r.calendarId || r.calendarId === cal.id) : r.calendarId === cal.id,
    ).length;
    // Volledige WorkCalendar-definitie (spec-eis: cross-document-herbouw) + de afgeleide velden.
    return {
      ...cal,
      isProjectDefault: isDefault,
      usedByTasks,
      usedByResources,
    };
  });
  return { calendars: list, count: list.length, projectDefaultId };
}

// ── 9. planner_compare_baseline ──────────────────────────────────────────────────────────────────

function compareBaseline(s: AppState) {
  const baseline = activeBaseline(s);
  if (!baseline) {
    // De weigering moet naar een BESTAANDE weg wijzen: "activeer er een" was tot de komst van
    // `baselineTools.ts` een instructie zonder tool om hem uit te voeren.
    throw new ToolError('VALIDATION',
      'Geen actieve baseline. Sla er een op met planner_save_baseline, of kies een bestaande met ' +
      'planner_activate_baseline (planner_list_baselines toont welke er zijn).');
  }
  const cal = new CalendarEngine(s.calendar);
  const currentEnd = s.cpmResult?.projectEnd || undefined;
  const variance = computeVariance(s.tasks, baseline, cal, currentEnd);
  const deviations = variance.rows.filter((r) => r.status !== 'onSchedule');
  return {
    baselineId: baseline.id,
    baselineName: baseline.name,
    baselineCreatedAt: baseline.createdAt,
    scheduleStale: s.scheduleStale,
    projectEndDelta: variance.projectEndDelta ?? null,
    deviationCount: deviations.length,
    deviations: deviations.map(compactVarianceRow),
  };
}

/** Compacte variance-rij: laat undefined-velden weg. */
function compactVarianceRow(r: VarianceRow) {
  const row: Record<string, unknown> = {
    taskId: r.taskId,
    wbs: r.wbs,
    name: r.name,
    status: r.status,
  };
  if (r.baselineStart !== undefined) row.baselineStart = r.baselineStart;
  if (r.baselineFinish !== undefined) row.baselineFinish = r.baselineFinish;
  if (r.currentStart !== undefined) row.currentStart = r.currentStart;
  if (r.currentFinish !== undefined) row.currentFinish = r.currentFinish;
  if (r.deltaStart !== undefined) row.deltaStart = r.deltaStart;
  if (r.deltaFinish !== undefined) row.deltaFinish = r.deltaFinish;
  return row;
}

// ── 10. planner_analyze_delay ────────────────────────────────────────────────────────────────────

function analyzeDelay(s: AppState) {
  const baseline = activeBaseline(s);
  if (!baseline) {
    throw new ToolError('VALIDATION',
      'Geen actieve baseline. planner_analyze_delay vereist een baseline van vóór de vertraging: ' +
      'activeer er een met planner_activate_baseline (planner_list_baselines toont welke er zijn), ' +
      'of leg er nu een vast met planner_save_baseline — die meet dan pas vanaf nu.');
  }
  const cpm = s.cpmResult;
  const cal = new CalendarEngine(s.calendar);
  const currentEnd = cpm?.projectEnd || undefined;
  const variance = computeVariance(s.tasks, baseline, cal, currentEnd);

  // Kritieke schuivers = variance-afwijkers die OP het huidige kritieke pad liggen — lokalisatie/
  // verklaring, met individuele delta's. De opleverings-impact is NOOIT hun som (cascade-dubbeltelling).
  const critSet = new Set(cpm?.criticalPath ?? []);
  const shifters = variance.rows
    .filter((r) => r.status !== 'onSchedule' && critSet.has(r.taskId))
    .map((r) => ({
      taskId: r.taskId,
      wbs: r.wbs,
      name: r.name,
      status: r.status,
      deltaFinish: r.deltaFinish ?? null,
      deltaStart: r.deltaStart ?? null,
      baselineFinish: r.baselineFinish ?? null,
      currentFinish: r.currentFinish ?? null,
    }));

  const hasDelta = variance.projectEndDelta !== undefined;
  return {
    baselineId: baseline.id,
    baselineName: baseline.name,
    scheduleStale: s.scheduleStale,
    // DE opleverings-impact: projectEndDelta (werkdagen, signed). Nooit een som van taakdelta's.
    projectEndDeltaAvailable: hasDelta,
    projectEndDelta: hasDelta ? variance.projectEndDelta : null,
    ...(hasDelta
      ? {}
      : { note: 'De baseline heeft geen doorgerekend projecteinde — de opleverings-impact is onbekend (niet 0). Sla een baseline op ná een run_cpm om dit te meten.' }),
    criticalShifterCount: shifters.length,
    criticalShifters: shifters,
  };
}

// ── Tool-definities ──────────────────────────────────────────────────────────────────────────────

const NO_ARGS_SCHEMA = { type: 'object', properties: {}, additionalProperties: false } as const;

export const readTools: McpToolDef[] = [
  {
    name: 'planner_get_project_info',
    description:
      'Projectmetadata + statistieken: taak-/relatie-/resource-/toewijzingsaantallen, mijlpalen, ' +
      'kritieke-taak-aantal, statusdatum, projecteinde/-duur, `scheduleStale` (planning verouderd?), ' +
      'en een kalender-samenvatting. Goede eerste call om een project te leren kennen. ' +
      'LET OP bij `project.statusDate`: dat is niet zomaar een peildatum-label maar de DATA DATE uit ' +
      'P6/MSP, en die stuurt de berekening. Werk met completion 0 kan niet vóór die datum starten en ' +
      'wordt erheen vooruitgeschoven — staat er een statusdatum, dan is `schedule.projectEnd` dus ' +
      'mede dóór die datum bepaald, ook als er nog geen enkele voortgang geregistreerd is. Ontbreekt ' +
      'het veld, dan geldt die vloer niet en zijn reeds geregistreerde actuals inert.',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => readTool(ctx, (s) => { requireOnlyKeys(args, [], 'get_project_info'); return getProjectInfo(s); }),
  },
  {
    name: 'planner_get_project_overview',
    description:
      'Complete WBS-boom, compact: per taak `id` (het stabiele Task.id — precies wat elke mutatietool ' +
      'nodig heeft), wbs, naam, dur(werkdagen), start/end (vroege datums), ' +
      'prog(0-100), crit, ms(mijlpaal), parent(wbs) en uitgaande relaties in verkorte notatie ' +
      '"→2.3 FS+2d #seq-7", waarbij het deel achter `#` het SEQUENCE-ID is (voer dat rechtstreeks aan ' +
      'planner_update_dependencies om de relatie te WIJZIGEN, of aan planner_remove_dependencies om ' +
      'hem te verwijderen). Type en lag staan hier in exact de notatie die die tools ACCEPTEREN ' +
      '(FS/SS/FF/SF, "+2d", "+50%"). BEWUST ONGELIMITEERD: de volledige relatiegraaf zit gegarandeerd ' +
      'in deze ENE respons (elke relatie staat één keer, bij zijn voorganger), dus één call volstaat ' +
      'voor structuur- én netwerkWERK — je hebt er geen tweede call voor id\'s bij nodig. ' +
      'NAAMDRIFT LEZEN↔SCHRIJVEN: het veld heet hier `wbs`, bij het schrijven (add_tasks/update_tasks) ' +
      '`wbsCode`; `id` heet daar `taskId`. Voor grote projecten fors; gebruik list_tasks als je ' +
      'paginering wilt.',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => readTool(ctx, (s) => { requireOnlyKeys(args, [], 'get_project_overview'); return getProjectOverview(s); }),
  },
  {
    name: 'planner_list_tasks',
    description:
      'Gepagineerde taaklijst met filters. Filters (alle optioneel, gecombineerd via EN): ' +
      '`kritiek` (bool), `status` (NOT_STARTED|STARTED|COMPLETED), `van`/`tot` (ISO-datumvenster: ' +
      'taken die met [van,tot] overlappen), `zonder_relaties` (bool — wees-detectie: alléén ' +
      'LEAF-taken die in geen enkele relatie voorkomen; verzameltaken worden uitgesloten). ' +
      'Paginering: `limit` (geheel getal 1..1000, default 50), `offset` (≥ 0); retourneert `total`, ' +
      '`has_more`, `next_offset`. Elk filter wordt STRIKT gevalideerd: een verkeerd getypeerde of ' +
      'buiten-domein waarde geeft een nette fout met de toegestane waarden erbij — nooit stilzwijgend ' +
      'een andere verzameling.',
    kind: 'read',
    batchable: true,
    inputSchema: {
      type: 'object',
      properties: {
        kritiek: { type: 'boolean' },
        status: { type: 'string', enum: ['NOT_STARTED', 'STARTED', 'COMPLETED'] },
        van: { type: 'string', description: 'ISO-datum ondergrens van het venster' },
        tot: { type: 'string', description: 'ISO-datum bovengrens van het venster' },
        zonder_relaties: { type: 'boolean', description: 'Alleen leaf-taken zonder enige relatie (wezen)' },
        limit: { type: 'number', description: 'Aantal per pagina (default 50)' },
        offset: { type: 'number', description: 'Startindex (default 0)' },
      },
      additionalProperties: false,
    },
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => readTool(ctx, (s) => listTasks(s, (args ?? {}) as ListTasksArgs)),
  },
  {
    name: 'planner_get_task',
    description:
      'Detail van één taak (`taskId` verplicht): metadata, duur/durationType, vroege/late datums, ' +
      'total/free float, kritiek-vlag, voortgang (+actuals), constraints (primair/secundair) en ' +
      'deadline, de effectieve kalender, ouder/kinderen, alle toewijzingen (resource, units/dag, ' +
      'curve) en voorgangers/opvolgers (met type + lag). Bij een uit .mpp geïmporteerde taak, indien ' +
      'aanwezig: READ-ONLY `manuallyScheduled` (handmatig gepland), ' +
      'READ-ONLY `splitGaps` (werkonderbrekingen), `levelingDelayMinutes`, `mspTaskType` (MSP Task ' +
      'Type: FIXED_UNITS/FIXED_DURATION/FIXED_WORK), `effortDriven` en `timephasedContours` (rauwe ' +
      'contourperiodes — puur data, geen rekengedrag). Onbekend id ⇒ nette NOT_FOUND. ' +
      'NAAMDRIFT LEZEN↔SCHRIJVEN: `wbs` heet bij het schrijven `wbsCode`, en `calendar.effectiveId` ' +
      'heet daar `calendarId` (let op: `effectiveId` kan de PROJECTkalender zijn — dan staat er geen ' +
      'eigen `calendarId` op de taak, zie `calendar.isProjectDefault`). ' +
      'TWEE DATUMS DIE ER FOUT UITZIEN MAAR HET NIET ZIJN: (1) bij NEGATIEVE `totalFloat` liggen de ' +
      'late datums per definitie vóór de vroege — bij tf −33 dus 33 werkdagen terug, desnoods vóór de ' +
      'projectstart; dat is de maat van de deadline-overschrijding, geen rekenfout. (2) een VOLTOOIDE ' +
      'taak (completion 100) wordt op zijn actuals gepind, maar de gerekende datums liggen altijd op ' +
      'een WERKdag van de taakkalender; valt de `actualFinish` in onwerkbare tijd (weekend, bouwvak, ' +
      'feestdag), dan is `schedule.earlyFinish` de laatste werkdag daarvóór en wijkt hij dus af van ' +
      'de `actualFinish` — de respons meldt dat expliciet onder `progress.actualFinishAdjusted`. ' +
      'Beide zijn stabiel: een extra planner_run_cpm verandert er niets aan.',
    kind: 'read',
    batchable: true,
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'Stabiele Task.id' } },
      required: ['taskId'],
      additionalProperties: false,
    },
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => readTool(ctx, (s) => getTask(s, (args ?? {}) as GetTaskArgs)),
  },
  {
    name: 'planner_get_critical_path',
    description:
      'Afgeplatte kritieke-taak-set (topo-volgorde) met per taak total float, plus de driving-relaties ' +
      'GEFILTERD op paren waarvan BEIDE eindpunten kritiek zijn. Reconstructie van de keten uit deze ' +
      'taken+relaties is client-werk. `pathsMode` meldt de situatie: "merged" (één samengevoegd ' +
      'kritiek pad — het normale geval) of "parallel". Gescheiden parallelle ketens (`criticalPaths`) ' +
      'worden ALLEEN meegegeven als floatPaths mét methode FREE_FLOAT actief is; anders is er per ' +
      'definitie één samengevoegd pad en ontbreekt `criticalPaths`.',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => readTool(ctx, (s) => { requireOnlyKeys(args, [], 'get_critical_path'); return getCriticalPath(s); }),
  },
  {
    name: 'planner_list_resources',
    description:
      'Gepagineerde resourcelijst met capaciteit (maxUnits, kostenuurtarief, meeteenheid, kalender, ' +
      'ploeg, tijd-gefaseerde beschikbaarheid) en een toewijzings-samenvatting per resource (aantal ' +
      'toewijzingen, aantal betrokken taken, som units/dag). De veldnamen zijn exact die van ' +
      'planner_manage_resources, dus je kunt gelezen waarden rechtstreeks terugschrijven; velden ' +
      'zonder waarde ontbreken in de rij. Komt een resource uit een bedrijfsbibliotheek, dan draagt ' +
      'de rij een `library`-blok: `company` (bedrijfsnaam), `status` (`in-sync` | `behind` | ' +
      '`deviated` | `removed`, of `null` bij een stempel van een ander bedrijf) en `lockedFields` — ' +
      'de velden die de bibliotheek bepaalt en die planner_manage_resources op deze rij dus weigert. ' +
      'Is `lockedFields` leeg, dan is de rij volledig bewerkbaar. Paginering identiek aan list_tasks: ' +
      '`limit` (default 50), `offset`; retour `total`, `has_more`, `next_offset`.',
    kind: 'read',
    batchable: true,
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Aantal per pagina (default 50)' },
        offset: { type: 'number', description: 'Startindex (default 0)' },
      },
      additionalProperties: false,
    },
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => readTool(ctx, (s) => listResources(s, (args ?? {}) as PageArgs)),
  },
  {
    name: 'planner_get_resource_histogram',
    description:
      'Belasting/capaciteit-histogram per resource. Params: `resourceIds` (weglaten = alle; een ' +
      'onbekend id geeft een nette fout, geen lege reeks), `van`/`tot` (ISO-venster), `bucket` (exact ' +
      '"dag" of "week" — Nederlandse waarden, default "week"). HERREKENT de planning vers wanneer die ' +
      'verouderd is of nog nooit is doorgerekend (en meldt dat via `recomputed`/`warning`). ' +
      'DETAIL-OP-AANVRAAG: zónder venster ' +
      'ÉN zónder resourceIds (de naïeve eerste call) levert de tool `mode:"aggregate"` — per resource ' +
      'een samenvatting (peakLoad + peakDate, overallocatedDayCount, spanStart/spanEnd, loadSum, ' +
      'capacitySum) mét `detailAvailable:true`; pieken blijven zo zichtbaar maar de respons is klein. ' +
      'Geef `resourceIds` en/of `van`/`tot` voor `mode:"detail"` met de volledige bucket-arrays: per ' +
      'bucket `load` (weekbucket = som over de week), `peakDayLoad`, `capacity`, dag-granulaire ' +
      '`overallocatedDays` en per overbelaste bucket de veroorzakende toewijzingen (`causes`). ' +
      'LET OP — WEEKMODUS-OVERHANG: weekvensters snappen naar hele ISO-weken (ma..zo), dus een venster ' +
      'kan aan de randen dagen buiten [van,tot] meenemen; de capaciteit telt álle werkdagen van het ' +
      '(gesnapte) weekvenster.',
    kind: 'read',
    batchable: true,
    inputSchema: {
      type: 'object',
      properties: {
        resourceIds: { type: 'array', items: { type: 'string' } },
        van: { type: 'string', description: 'ISO-datum vensterstart' },
        tot: { type: 'string', description: 'ISO-datum venstereinde' },
        bucket: { type: 'string', enum: ['dag', 'week'], description: 'Bucketbreedte (default week)' },
      },
      additionalProperties: false,
    },
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => readTool(ctx, () => getResourceHistogram(ctx, (args ?? {}) as HistogramArgs)),
  },
  {
    name: 'planner_get_calendars',
    description:
      'Alle kalenders: de UNIE van de projectkalender-cache en de bibliotheek (gededupt op id), elk ' +
      'met `isProjectDefault`, gebruikt-door-tellingen (taken/resources) én de VOLLEDIGE ' +
      'WorkCalendar-definitie (werkdagen, werkuren, `workTime`-uurbanden, `shift`, `holidays`, ' +
      '`generation`). Een kalenderobject hieruit is LETTERLIJK terug te schrijven met ' +
      'planner_update_calendar en zo in een ANDER document te herbouwen — kalender-id\'s zijn ' +
      'per-document, dus gebruik daar `create: true` (het echte nieuwe id komt terug in de respons) en ' +
      'hang taken eraan met `update_tasks.calendarId`. Wil je de PROJECTkalender van een ander document ' +
      'gelijkmaken, schrijf de velden dan op het id uit de `projectDefaultId` van dát document: WELKE ' +
      'kalender de projectdefault IS kan de bridge niet wisselen (dat doe je in de app). De afgeleide ' +
      'velden `isProjectDefault`/`usedByTasks`/`usedByResources` mogen bij het terugschrijven meekomen ' +
      'maar doen daar niets.',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => readTool(ctx, (s) => { requireOnlyKeys(args, [], 'get_calendars'); return getCalendars(s); }),
  },
  {
    name: 'planner_compare_baseline',
    description:
      'Vergelijk het huidige plan met de ACTIEVE baseline; levert alléén de afwijkers (status ≠ ' +
      'onSchedule: late/early/new/dropped) plus `projectEndDelta`. Geen actieve baseline ⇒ nette ' +
      'VALIDATION-fout. MEETLAT-DISCLOSURE: delta\'s zijn werkdagen op de HUIDIGE projectkalender — ' +
      'na een kalenderwijziging is de meetlat zelf veranderd (magnitudes met een korrel zout; ' +
      'richting en selectie blijven betrouwbaar).',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => readTool(ctx, (s) => { requireOnlyKeys(args, [], 'compare_baseline'); return compareBaseline(s); }),
  },
  {
    name: 'planner_analyze_delay',
    description:
      'Vertragingsanalyse tegen de actieve baseline (vereist er één, anders nette VALIDATION-fout). De ' +
      'OPLEVERINGS-IMPACT is `projectEndDelta` (werkdagen, signed) — NOOIT een som van per-taak-delta\'s ' +
      '(dat zou een cascade dubbeltellen). De kritieke schuivers (variance ∩ kritiek pad) met hun ' +
      'individuele delta\'s dienen als lokalisatie/verklaring, niet om op te tellen. Heeft de baseline ' +
      'geen doorgerekend projecteinde, dan meldt de tool dat expliciet (`projectEndDeltaAvailable:false`) ' +
      'i.p.v. 0 te suggereren.',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => readTool(ctx, (s) => { requireOnlyKeys(args, [], 'analyze_delay'); return analyzeDelay(s); }),
  },
];
