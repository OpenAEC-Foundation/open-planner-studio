// MCP-bridge — de tien LEESTOOLS.
//
// Elke tool draagt de `planner_`-prefix, een verplichte description (de AI kiest tools op
// beschrijving) en de leestool-annotaties (`readOnlyHint:true`, `openWorldHint:false`). De data is
// bewust COMPACT (velden die false/0/leeg zijn worden weggelaten) — deze payloads gaan als JSON over
// de bridge en de overview/list-tools kunnen op een groot project fors worden.
//
// Alle tools lopen door `runReadTool` (dialoog-guard + live envelop, GEEN drift/pauze-blokkade). Een
// tool gooit een `McpStepError` om een NETTE code terug te geven (VALIDATION bij een
// ongeldig argument, NOT_FOUND bij een onbekend id) i.p.v. de generieke INTERNAL van een kale throw.
//
// `get_resource_histogram` roept `ensureFreshSchedule` aan (herrekent ALLEEN als stale of nog nooit
// gerekend) en meldt in de data of het (her)berekend is; dat is de enige leestool die de store-cache
// raakt, en dat is een versheids-refresh, geen mutatie — de annotatie blijft `readOnlyHint:true`
// (readOnlyHint staat op ALLE leestools).
//
// `runCPM` pusht alleen een undo-snapshot bij het verlaten van "datums zoals opgeslagen", en
// "modus aan én verouderd" is onbereikbaar (zie de kop van staleGuard.ts). Daarmee blijft
// `readOnlyHint:true` verdedigbaar.

import type { AppState } from '@/state/appStore';
import { flattenOrder } from '@/utils/wbs';
import { ensureFreshSchedule } from '../staleGuard';
import { McpStepError, runReadTool } from './runtime';
import { lagLabel, seqAbbrev } from './sequenceFields';
import type { McpContext, McpToolDef } from '../contracts';
import type { Task } from '@/types/task';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { countCriticalActivities } from '@/engine/scheduler/scheduleAnalysis';
import { shownSpanOverlapsDays } from '@/utils/taskDates';
import { booleanArgReason, READ_ANNOTATIONS, unknownArgsReason } from './helpers';

function nativeDuration(task: Task): number {
  return taskDurationUnit(task) === 'hours'
    ? (task.time.durationMinutes ?? 0) / 60
    : task.time.scheduleDuration;
}
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { Baseline } from '@/types/baseline';
import { computeHistogramReport, histogramWindows } from '@/engine/scheduler/ResourceLoad';
import { computeVariance, type VarianceRow } from '@/engine/variance';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { interruptionsOf, type Interruption } from './splitFields';
// Zelfde twee bronnen als het slot in `ResourcePanel` en de weigering in `resourceTools` — één lijst.
import { RESOURCE_DIFF_FIELDS, isResourceFieldLocked } from '@/services/library/libraryOps';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { unrecordedExportGate } from '@/state/recordedDatesSelectors';
import { resolveConventions } from '@/engine/scheduler/conventions/registry';

/** De leesbare onderbrekingen van één taak (zie `splitFields.ts`). Leeg object bij een
 *  taak zonder onderbrekingen, zodat de detailrespons van gewone taken ongewijzigd blijft. */
function splitReadFields(task: Task, s: AppState): { interruptions?: Interruption[]; splitsEditable?: false } {
  if (!task.splitGaps || task.splitGaps.length === 0) return {};
  const { interruptions, editable } = interruptionsOf(task, s);
  return editable && interruptions ? { interruptions } : { splitsEditable: false };
}

// ── Compacte helpers ─────────────────────────────────────────────────────────────────────────────

// `seqAbbrev` (FS/SS/FF/SF) en `lagLabel` ("+2d"/"+50%") staan in de gedeelde veldlaag
// `sequenceFields.ts`: de SCHRIJFKANT moet exact deze notatie kunnen terugnemen, en dat lukt alleen
// met één implementatie. Zie de kop van dat bestand.

/** Voortgang 0-1 → geheel percent 0-100 (bridge-conventie completion 0-100). */
function pct(completion: number): number {
  return Math.round((completion ?? 0) * 100);
}

/** WBS van een taak-id, of het id zelf als terugval (mocht een relatie naar een onbekende taak wijzen). */
function wbsOf(taskById: Map<string, Task>, id: string): string {
  return taskById.get(id)?.wbsCode ?? id;
}

/**
 * Verkorte uitgaande relatie vanuit een voorganger: "→2.3 FS+2d #seq-7", met het SEQUENCE-ID als
 * `#`-suffix.
 *
 * Waarom het id erbij moet: de overview wordt aangeprezen als DE call voor structuur- en
 * netwerkanalyse ("één call volstaat"), maar élke mutatietool sleutelt op id — `remove_dependencies`
 * neemt letterlijk sequence-id's. Zonder id moet de agent alsnog `get_task` per taak ophalen, wat
 * vele malen duurder is dan de ~10 tekens die dit kost.
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

// ── Invoervalidatie voor de leestools ─────────────────────────────────────────────────────────────
//
// Een ongevalideerd filter is bij een leestool net zo schadelijk als bij een mutatietool, alleen
// stiller: `kritiek: "true"` matcht noch `=== true` noch `=== false`, dus de volledige takenlijst
// zou terugkomen alsof het de kritieke verzameling was; `status: 'started'` zou `{tasks: [], total: 0}`
// geven — niet te onderscheiden van "geen gestarte taken". Elke fout is daarom een NETTE
// VALIDATION-fout die de toegestane waarden noemt.

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}/;
const TASK_STATUSES = ['NOT_STARTED', 'STARTED', 'COMPLETED'];

/**
 * Weiger elke sleutel die deze leestool niet kent (`additionalProperties: false`, maar dan als
 * RUNTIME-poort in de tool zelf).
 *
 * WAAROM DIT HIER MOET STAAN EN NIET ALLEEN IN HET SCHEMA: de leestools moeten correct zijn
 * ongeacht welk pad ze aanroept. Een verschreven filter — `{kritisch: true}` i.p.v. `kritiek` — dat
 * ergens stil genegeerd wordt, geeft de volledige takenlijst terug als "de kritieke taken": een
 * plausibel-maar-ONJUIST antwoord waarop de aanroeper zijn volgende stap bouwt. Dat de dispatcher
 * hetzelfde nog eens doet is onschadelijk.
 */
function requireOnlyKeys(args: unknown, allowed: readonly string[], toolName: string): void {
  const reason = unknownArgsReason(args, allowed, toolName);
  if (reason) throw new McpStepError('VALIDATION', `${reason}.`);
}

const PAGE_KEYS = ['limit', 'offset'] as const;
const LIST_TASKS_KEYS = ['kritiek', 'status', 'van', 'tot', 'zonder_relaties', ...PAGE_KEYS] as const;
const HISTOGRAM_KEYS = ['resourceIds', 'van', 'tot', 'bucket'] as const;

/** Gooit een `McpStepError` wanneer `v` gezet maar geen boolean is. */
function requireBool(v: unknown, name: string): void {
  if (v !== undefined && typeof v !== 'boolean') {
    throw new McpStepError('VALIDATION', `${booleanArgReason(v, name)}.`);
  }
}

/** Gooit een `McpStepError` wanneer `v` gezet maar geen ISO-datum (JJJJ-MM-DD) is. */
function requireIsoDate(v: unknown, name: string): void {
  if (v === undefined) return;
  if (typeof v !== 'string' || !ISO_DATE_ONLY.test(v)) {
    throw new McpStepError('VALIDATION', `\`${name}\` must be an ISO date (YYYY-MM-DD), got '${String(v)}'.`);
  }
}

/**
 * Valideer `limit`/`offset` i.p.v. ze stil te klemmen. Een `limit: 5000` die stil 1000 wordt,
 * of een `limit: 0` die stil 1 wordt, kost de aanroeper een onnodige ronde zonder dat hij begrijpt
 * waarom hij niet kreeg wat hij vroeg.
 */
function requirePageArgs(args: PageArgs): void {
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || !Number.isInteger(args.limit) || args.limit < 1 || args.limit > 1000) {
      throw new McpStepError('VALIDATION', `\`limit\` must be an integer from 1 to 1000, got '${String(args.limit)}'.`);
    }
  }
  if (args.offset !== undefined) {
    if (typeof args.offset !== 'number' || !Number.isInteger(args.offset) || args.offset < 0) {
      throw new McpStepError('VALIDATION', `\`offset\` must be an integer ≥ 0, got '${String(args.offset)}'.`);
    }
  }
}

/** Uniforme paginering: limit default 50, offset default 0, retour total/has_more/
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
  const leaves = tasks.filter(isLeafTask);
  const summaries = tasks.filter(isSummaryTask);
  const milestones = tasks.filter((t) => t.isMilestone);
  // "Datums zoals opgeslagen": in de modus is `isCritical` van
  // een taak zonder vastgelegde speling de `?? false`-terugval — die telt hier niet als "niet
  // kritiek" maar als onbekend, apart gerapporteerd zodat een AI-client geen "0 kritieke taken"
  // uit een verzwegen as leest. Buiten de modus is `unrecordedOf` undefined ⇒ ongewijzigde respons.
  const unrecordedOf = unrecordedExportGate(s.recordedDates, s.datesAsRecorded);
  const criticalUnknown = leaves.filter((t) => unrecordedOf?.(t).includes('isCritical')).length;
  // Alleen bladtaken: een verzameltaak draagt een opgerolde kritiek-vlag maar is geen activiteit.
  // Dezelfde teller als de statusbalk en het Rapportpaneel.
  const criticalCount = countCriticalActivities(tasks.filter((t) => !unrecordedOf?.(t).includes('isCritical')));
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
      ...(p.defaultWorkRule ? { defaultWorkRule: p.defaultWorkRule } : {}),
      // Rekenprofiel: altijd expliciet, ook een OPS-project; `conventions` is de opgeloste
      // set waarmee de solver rekent, `overrides` de letterlijke afwijkingen van de basis.
      schedulingProfile: {
        id: p.schedulingProfile?.id ?? 'ops',
        baseId: p.schedulingProfile?.baseId ?? 'ops',
        name: p.schedulingProfile?.name ?? '',
        overrides: { ...(p.schedulingProfile?.overrides ?? {}) },
        conventions: resolveConventions(p.schedulingProfile),
      },
      // De elf projectopties letterlijk zoals het bestand ze draagt, plus `startToStartLagFrom` altijd
      // expliciet: afwezig rekent de solver als 'earlyStart'. Het
      // nivelleerblok (`leveling`) komt zo alleen-lezen mee; het heeft (nog) geen rekeneffect.
      schedulingOptions: {
        ...(p.schedulingOptions ?? {}),
        startToStartLagFrom: p.schedulingOptions?.startToStartLagFrom ?? 'earlyStart',
      },
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
      ...(criticalUnknown > 0 ? { criticalUnrecordedTasks: criticalUnknown } : {}),
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
  // volledige relatiegraaf gegarandeerd in deze ene respons aanwezig (één call volstaat).
  const outByPred = new Map<string, Sequence[]>();
  for (const seq of s.sequences) {
    const arr = outByPred.get(seq.predecessorId);
    if (arr) arr.push(seq);
    else outByPred.set(seq.predecessorId, [seq]);
  }
  const unrecordedOverview = unrecordedExportGate(s.recordedDates, s.datesAsRecorded);
  const critUnrecorded = unrecordedOverview
    ? (t: Task) => unrecordedOverview(t).includes('isCritical')
    : undefined;
  // Rijen in BOOMVOLGORDE met expliciete diepte: de store-volgorde is na een
  // P6-/IFC-import "samenvattingen eerst", en `parent` (een WBS-code) is bij vrije of dubbele codes
  // niet eenduidig — `parentId` en `depth` zijn dat wel. `parent` blijft staan voor bestaande clients.
  const ordered = flattenOrder(tasks);
  // Diepte uit de ouderketen; `flattenOrder` levert ouders vóór hun kinderen, dus één pass volstaat.
  const depthById = new Map<string, number>();
  for (const t of ordered) {
    const parentDepth = t.parentId ? depthById.get(t.parentId) : undefined;
    depthById.set(t.id, parentDepth === undefined ? 1 : parentDepth + 1);
  }
  const rows = ordered.map((t) => {
    const rels = (outByPred.get(t.id) ?? []).map((seq) => relShort(taskById, seq));
    const row: Record<string, unknown> = {
      // Het STABIELE Task.id staat vooraan. Zonder dit veld kan geen enkele mutatietool op de overview
      // gevoed worden (die sleutelen allemaal op id, niet op WBS) — de "één call volstaat"-belofte geldt
      // dan niet voor structuurWERK, alleen voor -analyse.
      id: t.id,
      wbs: t.wbsCode,
      name: t.name,
      dur: nativeDuration(t),
      durUnit: taskDurationUnit(t),
      start: t.time.earlyStart,
      end: t.time.earlyFinish,
    };
    // `depth`/`parent`/`parentId` alleen op geneste rijen — een wortel is impliciet diepte 1 (compact).
    if (t.parentId) {
      row.depth = depthById.get(t.id) ?? 1;
      row.parent = taskById.get(t.parentId)?.wbsCode ?? t.parentId;
      row.parentId = t.parentId;
    }
    const p = pct(t.time.completion);
    if (p > 0) row.prog = p;
    // Zelfde poort als `getTask`: een niet-vastgelegde
    // kritiekas in de modus is onbekend, geen `false` — dan `crit: null` i.p.v. weglaten.
    if (critUnrecorded?.(t)) row.crit = null;
    else if (t.time.isCritical) row.crit = true;
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
  // Elk filter eerst valideren; een fout filter mag NOOIT stil een andere verzameling geven.
  requireOnlyKeys(args, LIST_TASKS_KEYS, 'list_tasks');
  requireBool(args.kritiek, 'kritiek');
  requireBool(args.zonder_relaties, 'zonder_relaties');
  if (args.status !== undefined && !TASK_STATUSES.includes(args.status as string)) {
    throw new McpStepError('VALIDATION',
      `\`status\` must be one of ${TASK_STATUSES.join(', ')} (case-sensitive), got '${String(args.status)}'.`);
  }
  requireIsoDate(args.van, 'van');
  requireIsoDate(args.tot, 'tot');
  requirePageArgs(args);

  const inSeq = idsInAnySequence(s.sequences);
  let filtered = s.tasks;

  // Onbekende kritiekas (modus "datums zoals opgeslagen"): hoort bij
  // GEEN van beide filters — niet-vastgelegd is niet hetzelfde als niet-kritiek.
  const critUnknown = unrecordedExportGate(s.recordedDates, s.datesAsRecorded);
  if (args.kritiek === true) filtered = filtered.filter((t) => t.time.isCritical && !critUnknown?.(t).includes('isCritical'));
  if (args.kritiek === false) filtered = filtered.filter((t) => !t.time.isCritical && !critUnknown?.(t).includes('isCritical'));
  if (typeof args.status === 'string') {
    const st = args.status;
    filtered = filtered.filter((t) => t.status === st);
  }
  // Datumvenster: overlap van de getoonde spanne met [van, tot], op DAGniveau — dezelfde gedeelde
  // test als het filter "Actief tussen" en de rapportvensters. Een ruwe stringvergelijking miste een
  // urentaak die op de tot-dag begint: als tekst is "2026-06-03T08:00" groter dan "2026-06-03".
  // Een open kant van het venster begrenst niets.
  if (typeof args.van === 'string' || typeof args.tot === 'string') {
    const van = typeof args.van === 'string' ? args.van : '0000-01-01';
    const tot = typeof args.tot === 'string' ? args.tot : '9999-12-31';
    filtered = filtered.filter((t) => shownSpanOverlapsDays(t, van, tot));
  }
  // Wees-detectie: alléén LEAF-taken die in geen enkele relatie voorkomen. Verzameltaken hebben per
  // definitie geen relaties en zijn dus geen "wezen" — die worden hier bewust uitgesloten.
  if (args.zonder_relaties === true) {
    filtered = filtered.filter((t) => isLeafTask(t) && !inSeq.has(t.id));
  }

  const paged = paginate(filtered, args);
  const critUnrecorded = critUnknown ? (t: Task) => critUnknown(t).includes('isCritical') : undefined;
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
    // Zelfde poort als `getTask`: een niet-vastgelegde
    // kritiekas in de modus is onbekend, geen `false` — dan `crit: null` i.p.v. weglaten.
    if (critUnrecorded?.(t)) row.crit = null;
    else if (t.time.isCritical) row.crit = true;
    if (t.isMilestone) row.ms = true;
    if (isSummaryTask(t)) row.summary = true;
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
    throw new McpStepError('VALIDATION', 'get_task requires a `taskId` (string).');
  }
  const task = s.tasks.find((t) => t.id === args.taskId);
  if (!task) {
    throw new McpStepError('NOT_FOUND', `Unknown task id: ${args.taskId}`);
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
      // De drie werkvelden, alleen wanneer gezet (afwezig ⇒ afgeleid).
      ...(a.plannedWorkMinutes !== undefined ? { plannedWorkMinutes: a.plannedWorkMinutes } : {}),
      ...(a.actualWorkMinutes !== undefined ? { actualWorkMinutes: a.actualWorkMinutes } : {}),
      ...(a.remainingWorkMinutes !== undefined ? { remainingWorkMinutes: a.remainingWorkMinutes } : {}),
    }));

  const predecessors = s.sequences
    .filter((seq) => seq.successorId === task.id)
    .map((seq) => ({
      seqId: seq.id,
      taskId: seq.predecessorId,
      wbs: wbsOf(taskById, seq.predecessorId),
      type: seqAbbrev(seq.type),
      lag: lagLabel(seq),
      ...(seq.p6StartAtPredecessorFinishBoundary !== undefined
        ? { p6StartAtPredecessorFinishBoundary: seq.p6StartAtPredecessorFinishBoundary }
        : {}),
    }));
  const successors = s.sequences
    .filter((seq) => seq.predecessorId === task.id)
    .map((seq) => ({
      seqId: seq.id,
      taskId: seq.successorId,
      wbs: wbsOf(taskById, seq.successorId),
      type: seqAbbrev(seq.type),
      lag: lagLabel(seq),
      ...(seq.p6StartAtPredecessorFinishBoundary !== undefined
        ? { p6StartAtPredecessorFinishBoundary: seq.p6StartAtPredecessorFinishBoundary }
        : {}),
    }));

  // Effectieve kalender: taak-kalender uit de bibliotheek, anders de projectkalender.
  const effCal = resolveCalendar(task.calendarId, s.calendars, s.calendar);

  const tt = task.time;
  const unrecorded = unrecordedExportGate(s.recordedDates, s.datesAsRecorded)?.(task);
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
    // Leeskant-rand: elk veld dat de .mpp-import op de taak zet, moet ook via de MCP-bridge leesbaar
    // zijn, anders kan een AI-client een geïmporteerd project niet inspecteren. Geen van deze zes is via
    // `fields` zetbaar (REJECT_HINTS in `taskFields.ts`, net als `isHammock`); onderbrekingen lopen via
    // `planner_set_task_splits`.
    ...(task.manuallyScheduled ? { manuallyScheduled: true } : {}),
    ...(task.splitGaps && task.splitGaps.length > 0 ? { splitGaps: task.splitGaps } : {}),
    // Naast de rauwe `splitGaps` de leesbare werk-as-vorm, in exact de eenheden die
    // `planner_set_task_splits` accepteert (de schrijfkant spreekt de leeskant, zie `splitFields.ts`).
    // Een niet-wélgevormde importsplit heeft geen leesbare vorm: `splitsEditable: false`.
    ...splitReadFields(task, s),
    ...(task.levelingDelayMinutes != null ? { levelingDelayMinutes: task.levelingDelayMinutes } : {}),
    ...(task.mspTaskType ? { mspTaskType: task.mspTaskType } : {}),
    ...(task.effortDriven ? { effortDriven: true } : {}),
    ...(task.timephasedContours && task.timephasedContours.length > 0 ? { timephasedContours: task.timephasedContours } : {}),
    // De neutrale werkregel, leesbaar zodra gezet.
    ...(task.workRule ? { workRule: task.workRule } : {}),
    ...(task.p6DurationType !== undefined ? { p6DurationType: task.p6DurationType } : {}),
    ...(task.p6ActivityType !== undefined ? { p6ActivityType: task.p6ActivityType } : {}),
    ...(task.p6ProjectId !== undefined ? { p6ProjectId: task.p6ProjectId } : {}),
    ...(task.p6TaskId !== undefined ? { p6TaskId: task.p6TaskId } : {}),
    ...(task.p6ExplicitTargetWindow !== undefined ? { p6ExplicitTargetWindow: task.p6ExplicitTargetWindow } : {}),
    ...(task.p6CompletePctType !== undefined ? { p6CompletePctType: task.p6CompletePctType } : {}),
    ...(task.p6ExpectedFinish !== undefined ? { p6ExpectedFinish: task.p6ExpectedFinish } : {}),
    ...(task.p6SuspendResume !== undefined ? { p6SuspendResume: task.p6SuspendResume } : {}),
    parentId: task.parentId,
    childIds: task.childIds,
    duration: nativeDuration(task),
    durationUnit: taskDurationUnit(task),
    durationType: tt.durationType,
    // "Datums zoals opgeslagen": staat de modus aan, dan draagt
    // `task.time` de vastlegging van het bronbestand, mét de bewuste terugvallen voor assen die het
    // bestand NIET vastlegde (`lateStart ?? rec.start`, `totalFloat ?? 0`, `isCritical ?? false`).
    // In de tabel staat daar "Niet vastgelegd"; hier is `null` het equivalent. Zonder dit leest een
    // AI-client een verzonnen nulspeling als feit — en anders dan een gebruiker ziet hij de strook
    // boven de planning niet. `unrecorded` is `undefined` buiten de modus ⇒ ongewijzigde respons.
    schedule: {
      earlyStart: tt.earlyStart,
      earlyFinish: tt.earlyFinish,
      lateStart: unrecorded?.includes('lateStart') ? null : tt.lateStart,
      lateFinish: unrecorded?.includes('lateFinish') ? null : tt.lateFinish,
      totalFloat: unrecorded?.includes('totalFloat') ? null : tt.totalFloat,
      freeFloat: unrecorded?.includes('freeFloat') ? null : tt.freeFloat,
      isCritical: unrecorded?.includes('isCritical') ? null : tt.isCritical,
      ...(unrecorded && unrecorded.length > 0 ? {
        // Expliciet, want `null` alleen is dubbelzinnig ("onbekend" vs "leeg gelaten").
        datesAsRecordedUnrecordedFields: unrecorded,
      } : {}),
    },
    progress: {
      completion: pct(tt.completion),
      ...(tt.actualStart ? { actualStart: tt.actualStart } : {}),
      ...(tt.actualFinish ? { actualFinish: tt.actualFinish } : {}),
      // Een voltooide taak wordt op zijn actuals gepind, maar de gerekende datums liggen ALTIJD op
      // een werkdag van de taakkalender. Valt de `actualFinish` in onwerkbare tijd (weekend, bouwvak,
      // feestdag), dan is `earlyFinish` de laatste werkdag daarvóór en wijkt hij zichtbaar af van het
      // geregistreerde feit. Dat verschil stil laten staan is precies wat dit oppervlak niet doet:
      // een AI die de twee velden naast elkaar ziet, concludeert anders dat de herberekening kapot is.
      // Alleen zichtbaar wanneer er iets te melden valt.
      ...(tt.completion >= 1 && tt.actualFinish && tt.earlyFinish && tt.earlyFinish !== tt.actualFinish
        ? {
            actualFinishAdjusted: {
              actualFinish: tt.actualFinish,
              earlyFinish: tt.earlyFinish,
              reason:
                `The \`actualFinish\` falls outside the working time of the calendar "${effCal.name}" ` +
                '(weekend, holiday or construction holiday). The calculated finish is therefore the nearest ' +
                'working moment on or before the fact; the actual itself stays stored unchanged. If you want ' +
                'the calculation to follow the fact literally, make that period workable in the calendar ' +
                '(planner_update_calendar).',
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
      note: 'No (valid) schedule result. If `error` is set, resolve that first (for example break the ' +
        'circular dependency); every mutating tool that changes something recalculates the schedule at the ' +
        'end.',
      criticalTasks: [],
      drivingRelations: [],
    };
  }
  const taskById = new Map(s.tasks.map((t) => [t.id, t]));
  const critSet = new Set(cpm.criticalPath);

  // Kritieke taken in TOPO-volgorde (cpm.criticalPath is opgebouwd in de solver-order).
  // Zelfde poort als in `getTask`: in "datums zoals opgeslagen" is de
  // speling van een taak zonder vastgelegde `totalFloat` een `?? 0`-terugval, geen meting.
  const unrecordedOf = unrecordedExportGate(s.recordedDates, s.datesAsRecorded);
  const criticalTasks = cpm.criticalPath.map((id) => {
    const t = taskById.get(id);
    const r = cpm.tasks.get(id);
    const unrecorded = t ? unrecordedOf?.(t) : undefined;
    return {
      id,
      wbs: t?.wbsCode ?? id,
      name: t?.name ?? '',
      start: r?.earlyStart ?? '',
      end: r?.earlyFinish ?? '',
      totalFloat: unrecorded?.includes('totalFloat') ? null : (r?.totalFloat ?? 0),
    };
  });

  // Driving-relaties GEFILTERD op paren waarvan BEIDE eindpunten kritiek zijn.
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
    // te raden. Deze drie zijn in het resourcepaneel zichtbaar/bewerkbaar en round-trippen door IFC
    // (`OPS_Resource`-pset + IFCRELNESTS).
    if (r.description) row.description = r.description;
    if (r.parentId) row.parentId = r.parentId;
    if (r.availabilitySteps && r.availabilitySteps.length > 0) row.availabilitySteps = r.availabilitySteps;
    // HERKOMST UIT EEN RESOURCEBIBLIOTHEEK. `planner_manage_resources` weigert een
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

/** Bovengrens voor het gescopte detail (buckets × resources): ruim genoeg voor 25 resources × een
 *  jaar in dagbuckets of 190 resources × een jaar in weken, klein genoeg voor een bruikbare respons. */
const MAX_HISTOGRAM_BUCKETS = 10_000;

interface HistogramArgs {
  resourceIds?: unknown;
  van?: unknown;
  tot?: unknown;
  bucket?: unknown;
}

function getResourceHistogram(ctx: McpContext, args: HistogramArgs) {
  // VALIDEREN VÓÓR DE (potentieel dure) RECOMPUTE. Drie stille faalgevallen die zo uitgesloten zijn:
  //   - `bucket` gecoërceerd (`bucket: 'day'` stil 'week');
  //   - niet-string `resourceIds` weggefilterd; valt alles weg, dan wordt `scoped` false en schakelt
  //     de tool stil naar de AGGREGAAT-modus — een heel andere respons dan gevraagd;
  //   - een onbekend resource-id als lege reeks, die leest als "geen belasting".
  requireOnlyKeys(args, HISTOGRAM_KEYS, 'get_resource_histogram');
  if (args.bucket !== undefined && args.bucket !== 'dag' && args.bucket !== 'week' && args.bucket !== 'maand') {
    throw new McpStepError('VALIDATION',
      `\`bucket\` must be 'dag', 'week' or 'maand' (Dutch values for day, week, month), got '${String(args.bucket)}'.`);
  }
  requireIsoDate(args.van, 'van');
  requireIsoDate(args.tot, 'tot');
  let resourceIds: string[] | undefined;
  if (args.resourceIds !== undefined) {
    if (!Array.isArray(args.resourceIds)) {
      throw new McpStepError('VALIDATION', '`resourceIds` must be an array of resource id strings.');
    }
    if (args.resourceIds.some((x) => typeof x !== 'string' || x === '')) {
      throw new McpStepError('VALIDATION', '`resourceIds` may only contain non-empty resource id strings.');
    }
    const known = new Set(ctx.app.store.getState().resources.map((r) => r.id));
    const unknown = (args.resourceIds as string[]).filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new McpStepError('VALIDATION',
        `unknown resource id(s): ${unknown.join(', ')} — get valid ids with planner_list_resources.`);
    }
    resourceIds = args.resourceIds as string[];
  }

  // Vers herrekenen wanneer stale of nog nooit gerekend. Dit is de enige leestool die de cache
  // raakt; het is een versheids-refresh, geen mutatie — en hij kan de undo-stack niet raken, want
  // "datums zoals opgeslagen" is onbereikbaar in combinatie met stale/nooit-gerekend (zie de kop).
  const fresh = ensureFreshSchedule(ctx.app);
  const s = ctx.app.store.getState(); // verse contextstate ná een eventuele recompute

  const bucket: 'dag' | 'week' | 'maand' = args.bucket === 'dag' ? 'dag' : args.bucket === 'maand' ? 'maand' : 'week';
  const from = typeof args.van === 'string' ? args.van : undefined;
  const to = typeof args.tot === 'string' ? args.tot : undefined;

  const resNameById = new Map(s.resources.map((r) => [r.id, r.name]));
  // Versheids-melding, gedeeld door beide paden: was de planning stale, dan is die vers herrekend.
  const freshMeta = {
    recomputed: fresh.recomputed,
    ...(fresh.error ? { scheduleError: fresh.error } : {}),
    ...(fresh.recomputed
      ? { warning: 'The schedule was out of date; the histogram was freshly recalculated before this report.' }
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
      hint: 'Aggregate per resource (peaks visible via peakLoad/overallocatedDayCount). Pass `resourceIds` and/or a window (`van`/`tot`) for full bucket detail.',
      ...freshMeta,
      resources,
    };
  }

  // ── Gescopt (venster en/of resourceIds) ⇒ VOLLEDIG bucket-detail (bestaand gedrag) ─────────────
  // Omvang begrenzen vóór het rekenen: een ruim venster in dagbuckets over alle resources (bv.
  // `van` 1900 … `tot` 2100) leverde tienduizenden buckets per resource op — megabytes JSON die geen
  // client kan gebruiken. Boven de grens een VALIDATION-fout met de uitweg.
  const bucketCount = histogramWindows(s.tasks, from, to, bucket).length
    * (resourceIds && resourceIds.length > 0 ? resourceIds.length : s.resources.length);
  if (bucketCount > MAX_HISTOGRAM_BUCKETS) {
    throw new McpStepError('VALIDATION',
      `this histogram would produce ${bucketCount} buckets (limit ${MAX_HISTOGRAM_BUCKETS}); choose a ` +
      'smaller window (`van`/`tot`), fewer `resourceIds` or a coarser `bucket` (\'week\'/\'maand\'), or ' +
      'leave everything out for the aggregate.');
  }
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
    // Volledige WorkCalendar-definitie (eis: cross-document-herbouw) + de afgeleide velden.
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
    // De weigering moet naar een BESTAANDE weg wijzen (de baselinetools in `baselineTools.ts`).
    throw new McpStepError('VALIDATION',
      'No active baseline. Save one with planner_save_baseline, or choose an existing one with ' +
      'planner_activate_baseline (planner_list_baselines shows which exist).');
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
    throw new McpStepError('VALIDATION',
      'No active baseline. planner_analyze_delay requires a baseline from before the delay: activate one ' +
      'with planner_activate_baseline (planner_list_baselines shows which exist), or record one now with ' +
      'planner_save_baseline — that one then only measures from now on.');
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
      : { note: 'The baseline has no calculated project end — the delivery impact is unknown (not 0). Save a new ' +
          'baseline (planner_save_baseline recalculates the schedule first) to measure this.' }),
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
      'Project metadata + statistics: task/relationship/resource/assignment counts, milestones, critical ' +
      'task count (`criticalTasks`: only leaf tasks/activities, like the status bar — summary tasks with a ' +
      'rolled-up critical flag do not count), status date, project end/duration, `scheduleStale` (schedule ' +
      'out of date?), and a calendar summary. A good first call to get to know a project. NOTE on ' +
      '`project.statusDate`: it is not just a reporting-date label but the DATA DATE from P6/MSP, and it ' +
      'drives the calculation. Work with completion 0 cannot start before that date and is pushed forward to ' +
      'it — so if a status date is set, `schedule.projectEnd` is partly determined BY that date, even if no ' +
      'progress has been recorded yet. If the field is missing, that floor does not apply and actuals ' +
      'already recorded are inert. `project.schedulingProfile` is the calculation profile with the resolved ' +
      'conventions, `project.schedulingOptions` the project options of the file (read-only via the bridge); ' +
      '`startToStartLagFrom` (`earlyStart` | `actualStart`, P6 "Calculate Start-to-Start lag from") selects ' +
      'the variant of convention `p6InProgressStartLagElapsed` and is always present. ' +
      '`schedulingOptions.leveling` (only for a file that carries them, e.g. a P6 XER) are the leveling ' +
      'settings of the source file: read and kept, NOT applied yet (no effect on the calculation); manual ' +
      'leveling remains `planner_level_resources`.',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => runReadTool(ctx, (s) => { requireOnlyKeys(args, [], 'get_project_info'); return getProjectInfo(s); }),
  },
  {
    name: 'planner_get_project_overview',
    description:
      'Complete WBS tree, compact: per task `id` (the stable Task.id — exactly what every mutating tool ' +
      'needs), wbs, name, dur (working days), start/end (early dates), prog (0-100), crit, ms (milestone), ' +
      'and on nested rows depth (2+; root = 1), parent (wbs), parentId (stable; use this and not `parent` to ' +
      'reconstruct the tree — WBS codes can be free text or duplicated) and outgoing relationships in short ' +
      'notation "→2.3 FS+2d #seq-7", where the part after `#` is the SEQUENCE ID (pass that straight to ' +
      'planner_update_dependencies to CHANGE the relationship, or to planner_remove_dependencies to remove ' +
      'it). Type and lag appear here in exactly the notation those tools ACCEPT (FS/SS/FF/SF, "+2d", ' +
      '"+50%"). DELIBERATELY UNLIMITED: the complete relationship graph is guaranteed to be in this ONE ' +
      'response (every relationship appears once, at its predecessor), so one call is enough for structure ' +
      'AND network WORK — you do not need a second call for ids. NAME DRIFT READ↔WRITE: the field is called ' +
      '`wbs` here and `wbsCode` when writing (add_tasks/update_tasks); `id` is called `taskId` there. Hefty ' +
      'for large projects; use list_tasks if you want pagination.',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => runReadTool(ctx, (s) => { requireOnlyKeys(args, [], 'get_project_overview'); return getProjectOverview(s); }),
  },
  {
    name: 'planner_list_tasks',
    description:
      'Paginated task list with filters. Filters (all optional, combined with AND): `kritiek` (critical; ' +
      'bool — note: summary tasks/phases also carry a critical flag rolled up from their children and count ' +
      'here; such rows have `summary: true`, so `total` can be higher than `criticalTasks` from ' +
      'get_project_info), `status` (NOT_STARTED|STARTED|COMPLETED), `van`/`tot` (from/to; ISO date window: ' +
      'tasks overlapping [van,tot], per day and with both bounds inclusive — also an hour task that starts ' +
      'on the `tot` day), `zonder_relaties` (without relationships; bool — orphan detection: ONLY LEAF tasks ' +
      'that appear in no relationship at all; summary tasks are excluded). Pagination: `limit` (integer ' +
      '1..1000, default 50), `offset` (≥ 0); returns `total`, `has_more`, `next_offset`. Every filter is ' +
      'validated STRICTLY: a wrongly typed or out-of-domain value gives a clean error listing the allowed ' +
      'values — never silently a different set.',
    kind: 'read',
    batchable: true,
    inputSchema: {
      type: 'object',
      properties: {
        kritiek: { type: 'boolean' },
        status: { type: 'string', enum: ['NOT_STARTED', 'STARTED', 'COMPLETED'] },
        van: { type: 'string', description: 'ISO date lower bound of the window' },
        tot: { type: 'string', description: 'ISO date upper bound of the window' },
        zonder_relaties: { type: 'boolean', description: 'Only leaf tasks without any relationship (orphans)' },
        limit: { type: 'number', description: 'Number per page (default 50)' },
        offset: { type: 'number', description: 'Start index (default 0)' },
      },
      additionalProperties: false,
    },
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => runReadTool(ctx, (s) => listTasks(s, (args ?? {}) as ListTasksArgs)),
  },
  {
    name: 'planner_get_task',
    description:
      'Detail of one task (`taskId` required): metadata, duration/durationType, early/late dates, total/free ' +
      'float, critical flag, progress (+actuals), constraints (primary/secondary) and deadline, the ' +
      'effective calendar, parent/children, all assignments (resource, units/day, curve) and ' +
      'predecessors/successors (with type + lag). On a summary task (phase), progress, status and actuals ' +
      'are DERIVED from the leaf tasks (read-only): actualStart = the earliest, actualFinish = the latest ' +
      'once all leaf tasks are done. An interrupted task carries `splitGaps` (raw) plus the readable ' +
      '`interruptions` — the same shape that planner_set_task_splits accepts; `splitsEditable: false` = an ' +
      'imported split that can only be cleared. For a task imported from .mpp, if present: READ-ONLY ' +
      '`manuallyScheduled` (manually scheduled), `levelingDelayMinutes`, `mspTaskType` (MSP Task Type: ' +
      'FIXED_UNITS/FIXED_DURATION/FIXED_WORK), `effortDriven` and `timephasedContours` (raw contour periods ' +
      '— pure data, no calculation behaviour). For XER/P6, if present, the eight read-only source fields ' +
      '`p6DurationType`, `p6ActivityType`, `p6ProjectId`, `p6TaskId`, `p6ExplicitTargetWindow` (also false), ' +
      '`p6CompletePctType`, `p6ExpectedFinish` and `p6SuspendResume` are visible as well. Relationship ' +
      'objects additionally show `p6StartAtPredecessorFinishBoundary`, if present. Unknown id ⇒ clean ' +
      'NOT_FOUND. NAME DRIFT READ↔WRITE: `wbs` is called `wbsCode` when writing, and `calendar.effectiveId` ' +
      'is called `calendarId` there (note: `effectiveId` can be the PROJECT calendar — then the task has no ' +
      'own `calendarId`, see `calendar.isProjectDefault`). TWO DATES THAT LOOK WRONG BUT ARE NOT: (1) with ' +
      'NEGATIVE `totalFloat` the late dates lie before the early ones by definition — with tf −33 that is 33 ' +
      'working days back, before the project start if need be; that is the measure of the deadline overrun, ' +
      'not a calculation error. (2) a COMPLETED task (completion 100) is pinned to its actuals, but the ' +
      'calculated dates always lie on a WORKING day of the task calendar; if the `actualFinish` falls in ' +
      'non-working time (weekend, construction holiday, public holiday), `schedule.earlyFinish` is the last ' +
      'working day before it and therefore differs from the `actualFinish` — the response reports that ' +
      'explicitly under `progress.actualFinishAdjusted`. Both are stable: recalculating again does not ' +
      'change them.',
    kind: 'read',
    batchable: true,
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'Stable Task.id' } },
      required: ['taskId'],
      additionalProperties: false,
    },
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => runReadTool(ctx, (s) => getTask(s, (args ?? {}) as GetTaskArgs)),
  },
  {
    name: 'planner_get_critical_path',
    description:
      'Flattened critical task set (topological order) with total float per task, plus the driving ' +
      'relationships FILTERED to pairs whose BOTH end points are critical. Reconstructing the chain from ' +
      'these tasks+relationships is client work. `pathsMode` reports the situation: "merged" (one merged ' +
      'critical path — the normal case) or "parallel". Separate parallel chains (`criticalPaths`) are ONLY ' +
      'included when floatPaths with method FREE_FLOAT is active; otherwise there is by definition one ' +
      'merged path and `criticalPaths` is missing.',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => runReadTool(ctx, (s) => { requireOnlyKeys(args, [], 'get_critical_path'); return getCriticalPath(s); }),
  },
  {
    name: 'planner_list_resources',
    description:
      'Paginated resource list with capacity (maxUnits, hourly cost rate, unit of measure, calendar, crew, ' +
      'time-phased availability) and an assignment summary per resource (number of assignments, number of ' +
      'tasks involved, sum of units/day). The field names are exactly those of planner_manage_resources, so ' +
      'you can write read values straight back; fields without a value are missing from the row. If a ' +
      'resource comes from a resource library, the row carries a `library` block: `company` (library name), ' +
      '`status` (`in-sync` | `behind` | `deviated` | `removed`, or `null` for a stamp from another library) ' +
      'and `lockedFields` — the fields the library determines and that planner_manage_resources therefore ' +
      'refuses on this row. If `lockedFields` is empty, the row is fully editable. Pagination identical to ' +
      'list_tasks: `limit` (default 50), `offset`; returns `total`, `has_more`, `next_offset`.',
    kind: 'read',
    batchable: true,
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number per page (default 50)' },
        offset: { type: 'number', description: 'Start index (default 0)' },
      },
      additionalProperties: false,
    },
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => runReadTool(ctx, (s) => listResources(s, (args ?? {}) as PageArgs)),
  },
  {
    name: 'planner_get_resource_histogram',
    description:
      'Load/capacity histogram per resource. Params: `resourceIds` (omitted = all; an unknown id gives a ' +
      'clean error, not an empty series), `van`/`tot` (from/to; ISO window), `bucket` (exactly "dag" (day), ' +
      '"week" or "maand" (month) — Dutch values, default "week"). RECALCULATES the schedule when it is out ' +
      'of date or has never been calculated (and reports that via `recomputed`/`warning`). DETAIL ON ' +
      'REQUEST: WITHOUT a window AND WITHOUT resourceIds (the naive first call) the tool returns ' +
      '`mode:"aggregate"` — per resource a summary (peakLoad + peakDate, overallocatedDayCount, ' +
      'spanStart/spanEnd, loadSum, capacitySum) with `detailAvailable:true`; peaks stay visible this way but ' +
      'the response is small. Pass `resourceIds` and/or `van`/`tot` for `mode:"detail"` with the full bucket ' +
      'arrays: per bucket `load` (week/month bucket = sum over the period), `peakDayLoad`, `capacity`, ' +
      'day-granular `overallocatedDays` and per overallocated bucket the causing assignments (`causes`). ' +
      'NOTE — WEEK MODE OVERHANG: week windows snap to whole ISO weeks (Mon..Sun), so a window can include ' +
      'days outside [van,tot] at its edges; capacity counts ALL working days of the (snapped) week window. ' +
      'Detail is capped at 10000 buckets (windows × resources); above that a VALIDATION error with the way ' +
      'out.',
    kind: 'read',
    batchable: true,
    inputSchema: {
      type: 'object',
      properties: {
        resourceIds: { type: 'array', items: { type: 'string' } },
        van: { type: 'string', description: 'ISO date window start' },
        tot: { type: 'string', description: 'ISO date window end' },
        bucket: { type: 'string', enum: ['dag', 'week', 'maand'], description: 'Bucket width (default week)' },
      },
      additionalProperties: false,
    },
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => runReadTool(ctx, () => getResourceHistogram(ctx, (args ?? {}) as HistogramArgs)),
  },
  {
    name: 'planner_get_calendars',
    description:
      'All calendars: the UNION of the project calendar cache and the library (deduplicated by id), each ' +
      'with `isProjectDefault`, used-by counts (tasks/resources) AND the COMPLETE WorkCalendar definition ' +
      '(working days, working hours, break pattern `simpleBreakStartMinute`/`simpleBreakDurationMinutes`, ' +
      '`workTime` hour bands, `shift`, `holidays`, `workingExceptions`, `generation`, and for a library copy ' +
      '`libraryOrigin`). A calendar object from here can be written back LITERALLY with ' +
      'planner_update_calendar and so rebuilt in ANOTHER document — calendar ids are per document, so use ' +
      '`create: true` there (the real new id comes back in the response) and attach tasks to it with ' +
      '`update_tasks.calendarId`. To align the PROJECT calendar of another document, write the fields to the ' +
      'id from THAT document\'s `projectDefaultId`: WHICH calendar IS the project default cannot be switched ' +
      'via the bridge (you do that in the app). The derived fields ' +
      '`isProjectDefault`/`usedByTasks`/`usedByResources` and the library stamp `libraryOrigin` may come ' +
      'along when writing back but do nothing there.',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => runReadTool(ctx, (s) => { requireOnlyKeys(args, [], 'get_calendars'); return getCalendars(s); }),
  },
  {
    name: 'planner_compare_baseline',
    description:
      'Compare the current plan with the ACTIVE baseline; returns ONLY the deviating tasks (status ≠ ' +
      'onSchedule: late/early/new/dropped) plus `projectEndDelta`. No active baseline ⇒ clean VALIDATION ' +
      'error. YARDSTICK DISCLOSURE: deltas are working days on the CURRENT project calendar — after a ' +
      'calendar change the yardstick itself has changed (take magnitudes with a grain of salt; direction and ' +
      'selection stay reliable).',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => runReadTool(ctx, (s) => { requireOnlyKeys(args, [], 'compare_baseline'); return compareBaseline(s); }),
  },
  {
    name: 'planner_analyze_delay',
    description:
      'Delay analysis against the active baseline (requires one, otherwise a clean VALIDATION error). The ' +
      'DELIVERY IMPACT is `projectEndDelta` (working days, signed) — NEVER a sum of per-task deltas (that ' +
      'would double-count a cascade). The critical shifters (variance ∩ critical path) with their individual ' +
      'deltas serve as localisation/explanation, not to be added up. If the baseline has no calculated ' +
      'project end, the tool reports that explicitly (`projectEndDeltaAvailable:false`) instead of ' +
      'suggesting 0. ',
    kind: 'read',
    batchable: true,
    inputSchema: NO_ARGS_SCHEMA,
    annotations: READ_ANNOTATIONS,
    handler: (args, ctx) => runReadTool(ctx, (s) => { requireOnlyKeys(args, [], 'analyze_delay'); return analyzeDelay(s); }),
  },
];
