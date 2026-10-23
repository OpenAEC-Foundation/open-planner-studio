// workRuleApply.ts — de BRUG tussen de domeinobjecten (Task/ResourceAssignment/Resource) en de pure
// rekenkern `workTriangle.ts`.
//
// Deze module weet wat de kern niet mag weten: welke regel voor een taak geldt (`Task.workRule`,
// anders `Project.defaultWorkRule`, anders FIXED_DURATION_RATE), welk deel van de taak het
// RESTANT is (voortgang), welke toewijzingen de duur sturen (materiaal niet), hoe een restduur in
// minuten exact terugvertaalt naar `TaskTime` (ook breuken in werkdagen) en wanneer de regel van
// toepassing is (alleen gewone bladtaken op werktijd en uurtaken — mijlpalen, hangmatten,
// samenvattingen en ELAPSEDTIME-taken blijven ongemoeid).
//
// Aanroepvorm (store, MCP-tweeling, taakraster — allemaal dezelfde drie stappen):
//   1. `triangleStateOf(task, toewijzingen, ctx)` VÓÓR de mutatie;
//   2. één `apply…`-functie uit `workTriangle.ts`;
//   3. `applyTriangleResult(task, toewijzingen, uitkomst, ctx)` schrijft duur, inzet en werkvelden
//      terug (in-place, Immer-draft-stijl) en zegt of de taakduur veranderde (⇒ planning verouderd).
// Geen store-import: de aanroeper bepaalt snapshot, `isDirty`, `scheduleStale` en meldingen.
import type { WorkCalendar } from '@/types/calendar';
import type { Project } from '@/types/project';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task, TaskTime } from '@/types/task';
import { applyProgressInvariants, hourRemainingDays } from '@/engine/taskMutationRules';
import { DEFAULT_WORK_RULE, type WorkRule } from '@/types/workRule';
import { storedWorkDeviates } from '@/engine/work/workDeviation';
import { contourIndexForAssignment, taskWorkMinutes } from '@/engine/contour/contourEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { effHoursPerDay, hourTaskScheduleDuration } from '@/utils/taskDuration';
// `contourKeepsWork` en `effectiveEffortDriven`
// lezen per-taak-herkomst (`mspTaskType`) van bewaarde data — bewerksemantiek, geen solverinvoer en
// geen conventie. Ze wonen daarom in `utils/taskDefaults.ts`, buiten `src/engine/` (verify:conventions).
import {
  applyDurationChangeRules, contourKeepsWork, effectiveEffortDriven,
  hourInputFinishBasis, reconcileHourInputFinish, rescaleTaskContours,
  type HourInputFinishBasis,
} from '@/utils/taskDefaults';
import {
  applyAssignmentAdded, applyAssignmentRemoved, applyDurationEdit, applyRuleChange, applySlotChange,
  applyUnitsEdit, applyWorkEdit, durationEditKeepsWork, type TriangleAssignment, type TriangleState,
} from '@/engine/work/workTriangle';

export interface WorkRuleContext {
  /** Effectieve uren per werkdag van de taak (taakkalender, anders projectkalender). */
  hoursPerDay: number;
  /** `Project.defaultWorkRule`; afwezig ⇒ FIXED_DURATION_RATE. */
  defaultWorkRule?: WorkRule;
  /** Resource-opzoek voor de materiaalgrens. Onbekend ⇒ telt als werkresource. */
  resourceById?: (id: string) => Resource | undefined;
}

/** De regel die voor deze taak geldt: eigen veld, anders projectstandaard, anders
 *  FIXED_DURATION_RATE. */
export function effectiveWorkRule(task: Pick<Task, 'workRule'>, defaultWorkRule?: WorkRule): WorkRule {
  return task.workRule ?? defaultWorkRule ?? DEFAULT_WORK_RULE;
}

/** Blijft bewaard restwerk van deze taak staan bij een duurbewerking? Dezelfde regel en dezelfde
 *  effort-driven-uitzondering als {@link triangleStateOf} → `applyDurationEdit` (besluit V10). */
export function durationEditKeepsWorkOf(
  task: Pick<Task, 'workRule' | 'mspTaskType' | 'effortDriven'>,
  defaultWorkRule?: WorkRule,
): boolean {
  return durationEditKeepsWork(effectiveWorkRule(task, defaultWorkRule), effectiveEffortDriven(task));
}

/** De regel werkt alleen op gewone bladtaken op werktijd (dag- én uurmodus). */
export function workRuleApplies(task: Task): boolean {
  return task.childIds.length === 0
    && !task.isMilestone
    && task.isHammock !== true
    && task.time.durationType !== 'ELAPSEDTIME';
}

/** Werkminuten per werkdag van de taak. */
export function slotMinutesOf(ctx: Pick<WorkRuleContext, 'hoursPerDay'>): number {
  return Math.max(1, ctx.hoursPerDay * 60);
}

/**
 * De RESTduur van de taak in werkminuten — dezelfde afleiding als de solver (`CPMSolver.ts`'s
 * voortgangstak): uurmodus `remainingMinutes ?? duur × (1 − voortgang)`, dagmodus
 * `remainingTime ?? duur × (1 − voortgang)` (dagen), beide vanuit de blijvende taak-eenheid.
 */
/** Uurtaak mét minutenbron — dezelfde test voor lezen (`remainingMinutesOf`) en schrijven
 *  (`applyTriangleResult`), zodat een 'hours'-taak zonder `durationMinutes` in beide richtingen als
 *  dagtaak wordt behandeld. */
export function isHourTask(t: Task['time']): t is Task['time'] & { durationMinutes: number } {
  return t.durationUnit === 'hours' && typeof t.durationMinutes === 'number' && Number.isFinite(t.durationMinutes);
}

export function remainingMinutesOf(task: Task, ctx: Pick<WorkRuleContext, 'hoursPerDay'>): number {
  const t = task.time;
  const slot = slotMinutesOf(ctx);
  if (isHourTask(t)) {
    const rem = t.remainingMinutes ?? t.durationMinutes * (1 - (t.completion ?? 0));
    return Math.max(0, rem);
  }
  const days = t.remainingTime ?? t.scheduleDuration * (1 - (t.completion ?? 0));
  return Math.max(0, days) * slot;
}

/** Totale werkminuten van de taak (`taskWorkMinutes`) — het verrichte deel is totaal − rest. */
export function totalMinutesOf(task: Task, ctx: Pick<WorkRuleContext, 'hoursPerDay'>): number {
  return taskWorkMinutes(task.time, ctx.hoursPerDay);
}

function drivesDuration(assignment: ResourceAssignment, ctx: WorkRuleContext): boolean {
  const resource = ctx.resourceById?.(assignment.resourceId);
  return resource ? resource.type !== 'MATERIAL' : true;
}

/** Stap 1: de resterende toestand van de taak als invoer voor de rekenkern. */
export function triangleStateOf(task: Task, assignments: readonly ResourceAssignment[], ctx: WorkRuleContext): TriangleState {
  return {
    rule: effectiveWorkRule(task, ctx.defaultWorkRule),
    effortDriven: effectiveEffortDriven(task),
    remainingMinutes: remainingMinutesOf(task, ctx),
    slotMinutes: slotMinutesOf(ctx),
    assignments: assignments
      .filter((a) => a.taskId === task.id)
      .map((a): TriangleAssignment => ({
        id: a.id,
        unitsPerDay: a.unitsPerDay,
        drivesDuration: drivesDuration(a, ctx),
        ...(a.remainingWorkMinutes !== undefined ? { remainingWorkMinutes: a.remainingWorkMinutes } : {}),
      })),
  };
}

export interface TriangleWriteBack {
  /** De taakduur is gewijzigd (⇒ de aanroeper zet de planning verouderd en herschaalt contouren). */
  durationChanged: boolean;
  /** Toewijzingen waarvan inzet, restwerk of afgeleid verricht werk is geschreven. */
  changedAssignmentIds: string[];
}

/**
 * Stap 3: de uitkomst van de kern terugschrijven. De taakduur wordt ALLEEN aangeraakt wanneer de
 * kern een andere restduur teruggeeft dan hij kreeg (`before`), en dan als
 * `verricht deel + nieuwe rest` — het verrichte deel is een feit. Beide maten houden breuken;
 * dagenmaat schrijft werkdagen, urenmaat schrijft minuten zonder afronding (T14).
 * Een aanwezig `remainingTime`/`remainingMinutes` volgt de nieuwe rest. Toewijzingen: `unitsPerDay`
 * en `remainingWorkMinutes` volgen de kern. Zodra verricht werk is vastgelegd, wordt ook het
 * restwerk opgeslagen (zonder kernveld: nieuwe restduur × nieuwe inzet), zodat een volgende
 * voortgangsboeking beide velden bijwerkt. Muteert in-place; retourneert wat er veranderde.
 */
export function applyTriangleResult(
  task: Task,
  assignments: ResourceAssignment[],
  before: TriangleState,
  after: TriangleState,
  ctx: WorkRuleContext,
  opts?: { skipDuration?: boolean; actualWork?: ReadonlyMap<string, number> },
): TriangleWriteBack {
  const changed: string[] = [];
  const started = (task.time.completion ?? 0) > 0 || !!task.time.actualStart;
  for (const next of after.assignments) {
    const a = assignments.find((x) => x.id === next.id);
    if (!a) continue;
    const unitsChanged = Math.abs(a.unitsPerDay - next.unitsPerDay) > 1e-9;
    // De momentopname komt van vóór de mutatie: afgeleid verricht werk mag niet met de nieuwe
    // inzet of duur worden herberekend. Een nieuwe werkresource op een gestarte taak heeft geen
    // verleden; aangeleverde expliciete actuals (ook nul) blijven de bron. Dit geldt ook bij plakken.
    const newcomer = next.drivesDuration && started && !before.assignments.some(x => x.id === a.id);
    const actual = opts?.actualWork?.get(a.id) ?? (newcomer ? 0 : undefined);
    const actualChanged = a.actualWorkMinutes === undefined && actual !== undefined;
    // Vastgelegd verricht werk en onderhouden restwerk vormen één paar, onder elke regel.
    // Zonder dit restveld slaat settleProgressWork de volgende boeking over.
    const work = next.remainingWorkMinutes
      ?? (next.drivesDuration && (a.actualWorkMinutes !== undefined || actual !== undefined)
        ? after.remainingMinutes * next.unitsPerDay : undefined);
    const workChanged = (a.remainingWorkMinutes === undefined) !== (work === undefined)
      || (work !== undefined && a.remainingWorkMinutes !== undefined
        && Math.abs(a.remainingWorkMinutes - work) > 1e-6);
    if (!unitsChanged && !workChanged && !actualChanged) continue;
    if (actualChanged) a.actualWorkMinutes = actual;
    // Ook afgeleide inzet blijft exact: anders zijn W en R × I na terugschrijven ongelijk.
    if (unitsChanged) a.unitsPerDay = next.unitsPerDay;
    if (work === undefined) delete a.remainingWorkMinutes;
    else a.remainingWorkMinutes = work;
    changed.push(a.id);
  }

  reconcileContourWork(task, assignments, changed);

  let durationChanged = false;
  if (!opts?.skipDuration && Math.abs(after.remainingMinutes - before.remainingMinutes) > 1e-6) {
    const slot = slotMinutesOf(ctx);
    const total = totalMinutesOf(task, ctx);
    const doneMinutes = Math.max(0, total - before.remainingMinutes);
    const newTotal = doneMinutes + after.remainingMinutes;
    const t = task.time;
    // Gestarte taak: het verrichte deel is een feit en de REST is wat de kern teruggeeft. Zonder
    // expliciet restveld zou de solver de rest opnieuw afleiden als `nieuwe duur × (1 − completion)`
    // — en dan schuift het verrichte deel mee met de nieuwe duur en drift een heen-en-weer-bewerking.
    // Daarom wordt de rest bij voortgang > 0 (of een al aanwezig restveld) expliciet geschreven, en
    // volgt `completion` daaruit (percentage = verricht ÷ nieuwe duur — zie
    // `syncCompletionToRemaining`). Een ongestarte taak krijgt geen extra veld.
    const started = (t.completion ?? 0) > 0 || !!t.actualStart;
    if (isHourTask(t)) {
      t.durationMinutes = newTotal;
      t.scheduleDuration = t.durationMinutes / slot;
      if (started || t.remainingMinutes !== undefined) {
        t.remainingMinutes = Math.max(0, after.remainingMinutes);
        t.remainingTime = hourRemainingDays(t, t.remainingMinutes);
        syncCompletionToRemaining(task);
      }
    } else {
      t.scheduleDuration = Math.max(0, newTotal / slot);
      delete t.durationMinutes;
      if (started || t.remainingTime !== undefined) {
        t.remainingTime = Math.max(0, after.remainingMinutes / slot);
        syncCompletionToRemaining(task);
      }
    }
    durationChanged = true;
  }
  return { durationChanged, changedAssignmentIds: changed };
}

/**
 * Zodra de brug de REST expliciet
 * schrijft, volgt het voortgangspercentage daaruit — `completion` = 1 − rest ÷ duur — zodat de
 * Gantt-voortgangsbalk (tekent uit `completion`), de solver (plant op de rest) en de rapportage
 * één waarheid delen. Dezelfde formule en dezelfde randafspraken als een restbewerking in het
 * taakraster (`taskEditPlan.ts`, route `task-progress`): duur 0 ⇒ 100 %, een percentage > 0 zet
 * `actualStart` als die ontbrak, een percentage < 1 wist `actualFinish`. Niets zonder restveld.
 */
export function syncCompletionToRemaining(task: Task): void {
  const t = task.time;
  let completion: number;
  if (isHourTask(t)) {
    if (t.remainingMinutes === undefined) return;
    completion = t.durationMinutes > 0 ? Math.max(0, Math.min(1, 1 - t.remainingMinutes / t.durationMinutes)) : 1;
  } else {
    if (t.remainingTime === undefined) return;
    completion = t.scheduleDuration > 0 ? Math.max(0, Math.min(1, 1 - t.remainingTime / t.scheduleDuration)) : 1;
  }
  t.completion = completion;
  if (completion > 0 && !t.actualStart) t.actualStart = t.earlyStart || t.scheduleStart;
  if (completion < 1) t.actualFinish = undefined;
}

/**
 * "Vorm blijft, hoogte zakt": verandert de kern het RESTwerk van een
 * toewijzing die een opgeslagen contour heeft, dan schalen de `remaining`-periodes van die contour
 * in hoogte mee zodat hun som weer het nieuwe restwerk is — de as en de `actual`-periodes blijven
 * staan (de as volgt pas een duurwijziging, via `rescaleTaskContours`). Zonder contour, zonder
 * werkveld of bij een al kloppende som: niets.
 */
function reconcileContourWork(task: Task, assignments: readonly ResourceAssignment[], changedIds: readonly string[]): void {
  const contours = task.timephasedContours;
  if (!contours || contours.length === 0 || changedIds.length === 0) return;
  const siblings = assignments.filter((a) => a.taskId === task.id);
  let next = contours;
  for (const id of changedIds) {
    const a = siblings.find((x) => x.id === id);
    if (!a || a.remainingWorkMinutes === undefined) continue;
    const idx = contourIndexForAssignment(next, siblings, id);
    if (idx < 0) continue;
    const periods = next[idx].periods;
    const remainingSum = periods.reduce((s, p) => s + (p.kind === 'actual' ? 0 : p.workMinutes), 0);
    if (!(remainingSum > 0) || Math.abs(remainingSum - a.remainingWorkMinutes) < 1e-6) continue;
    const factor = a.remainingWorkMinutes / remainingSum;
    next = next.map((c, i) => (i === idx
      ? { ...c, periods: c.periods.map((p) => (p.kind === 'actual' ? p : { ...p, workMinutes: p.workMinutes * factor })) }
      : c));
  }
  if (next !== contours) task.timephasedContours = next;
}

// ── Hoog-niveau "settle"-API voor store, raster en MCP-tweeling ─────────────────────────────────
//
// Dezelfde drie stappen als hierboven, maar ingepakt per bewerking zodat de vier aanroepplekken
// (taskSlice/resourceSlice, gridTransaction, createMcpTransactions) letterlijk dezelfde regels
// delen. Elke functie muteert in-place en retourneert een `TriangleWriteBack`; `null` betekent
// "de regel is hier niet van toepassing of de kern weigerde" — de aanroeper laat dan zijn
// eigen gedrag staan.

/** De storevelden die de brug nodig heeft — bewust een `Pick`, zodat elke draft (store, MCP,
 *  geïsoleerde griddraft) 'm kan leveren zonder de hele `AppState`. */
export interface WorkRuleDeps {
  calendars: readonly WorkCalendar[];
  calendar: WorkCalendar;
  project: Pick<Project, 'defaultWorkRule'>;
  resources: readonly Resource[];
}

export function workRuleContextOf(task: Task, deps: WorkRuleDeps): WorkRuleContext {
  const resources = deps.resources;
  return {
    // De EFFECTIEVE uren per dag (op een uurkalender uit de banden afgeleid), dezelfde
    // slot als het raster (`environment.effectiveHoursPerDay`) en de contourreferentie.
    hoursPerDay: effHoursPerDay(resolveCalendar(task.calendarId, deps.calendars as WorkCalendar[], deps.calendar)),
    ...(deps.project.defaultWorkRule !== undefined ? { defaultWorkRule: deps.project.defaultWorkRule } : {}),
    resourceById: (id) => resources.find((r) => r.id === id),
  };
}

export interface CapturedTriangle {
  state: TriangleState;
  ctx: WorkRuleContext;
  /** Totale werkminuten van de taak op het moment van de momentopname — de poort van
   *  `settleDurationEdit` (alleen een DUURwijziging is een duurbewerking). */
  totalMinutes: number;
  /** De basis van het ingevoerde einde (`hourInputFinishBasis`) op het moment van de momentopname —
   *  voor `settleDurationAftermath` wanneer de driehoek de duur verandert. */
  finishBasis: HourInputFinishBasis;
  /** Kopie van `task.time` op het moment van de momentopname — `settleDurationEdit` ziet daaraan of
   *  de bewerking de voortgang zelf aanraakte en of de taak nog niet gestart was. */
  time: TaskTime;
  /** De toewijzingen van DEZE taak: dezelfde objecten (in een draft: dezelfde proxies) als in de lijst
   *  bij `captureTriangle`, in die volgorde. `settleDurationEdit` schrijft hierin terug, zodat een
   *  duurbewerking niet nog eens over alle toewijzingen van het project loopt (rehab-2: 52.640 per
   *  geplakte rij). Geldig zolang de aanroeper tussen momentopname en settle geen toewijzing
   *  toevoegt, verwijdert of vervangt; alle aanroepers muteren daar alleen de taak. */
  assignments: ResourceAssignment[];
  /** Afgeleid verricht resourcewerk in de OUDE toestand, los van de pure resterende driehoek. */
  actualWork: ReadonlyMap<string, number>;
}

/** Stap 1 als momentopname VÓÓR een mutatie; `null` wanneer de regel niet op deze taak werkt. */
export function captureTriangle(task: Task, assignments: readonly ResourceAssignment[], deps: WorkRuleDeps): CapturedTriangle | null {
  if (!workRuleApplies(task)) return null;
  const ctx = workRuleContextOf(task, deps);
  // Eén keer filteren; `triangleStateOf` filtert daarna alleen deze korte lijst.
  const own = assignments.filter((a) => a.taskId === task.id);
  const state = triangleStateOf(task, own, ctx);
  const totalMinutes = totalMinutesOf(task, ctx);
  const doneMinutes = Math.max(0, totalMinutes - state.remainingMinutes);
  const actualWork = new Map<string, number>();
  for (const a of own) {
    if (a.actualWorkMinutes !== undefined || !drivesDuration(a, ctx)) continue;
    const idx = contourIndexForAssignment(task.timephasedContours, own, a.id);
    const periods = idx < 0 ? [] : task.timephasedContours![idx].periods;
    const actuals = periods.filter(p => p.kind === 'actual');
    // Bestaande actual-periodes zijn feiten; zonder zulke periodes geldt de oude duur × inzet.
    const done = actuals.length > 0
      ? actuals.reduce((sum, p) => sum + p.workMinutes, 0)
      : doneMinutes * a.unitsPerDay;
    if (done > 0 || actuals.length > 0) actualWork.set(a.id, done);
  }
  return {
    state, ctx, totalMinutes, actualWork,
    finishBasis: hourInputFinishBasis(task), time: { ...task.time }, assignments: own,
  };
}

const NO_CHANGE: TriangleWriteBack = { durationChanged: false, changedAssignmentIds: [] };

/** Een voltooide taak zonder restwerk heeft geen resterende driehoek om te herleiden.
 *  Inzet wijzigen of een resource toevoegen legt wel het oude verrichte werk en de nulrest vast.
 *  Dit pad rekent geen duur of inzet uit; ongeldige inzet en tegenstrijdig restwerk vallen erbuiten. */
function settleCompletedWork(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle,
): TriangleWriteBack | null {
  if (captured.time.completion !== 1 || captured.state.remainingMinutes !== 0) return null;
  const after = triangleStateOf(task, assignments, captured.ctx);
  if (after.assignments.some(a => !Number.isFinite(a.unitsPerDay) || a.unitsPerDay <= 0)) return null;
  if ([...captured.state.assignments, ...after.assignments]
    .some(a => a.drivesDuration && (a.remainingWorkMinutes ?? 0) !== 0)) return null;
  return applyTriangleResult(task, assignments, captured.state, after, captured.ctx, {
    skipDuration: true, actualWork: captured.actualWork,
  });
}

/** Eén toewijzing waarvan een duurbewerking een BEWAARD restwerk herschreef dat afweek van
 *  inzet × restduur (het criterium van het waarschuwingsteken, `storedWorkDeviates`). Zo'n waarde
 *  kwam uit het bestand (P6 `remain_qty`, MSP `RemainingWork`) of uit een eerdere bewerking; de
 *  aanroeper meldt het (eigenaarsbesluit 2026-10-19, spec taaktypes §3.5). */
export interface RecomputedRemainingWork {
  taskId: string;
  taskName: string;
  assignmentId: string;
  resourceId: string;
  /** Restwerk vóór en ná de bewerking, in werkminuten. */
  beforeMinutes: number;
  afterMinutes: number;
}

export interface DurationEditWriteBack extends TriangleWriteBack {
  /** De herschreven afwijkende restwerken; leeg als er niets te melden is. */
  recomputedWork: RecomputedRemainingWork[];
}

const NO_DURATION_CHANGE: DurationEditWriteBack = { ...NO_CHANGE, recomputedWork: [] };

/**
 * Duur gewijzigd — aanroepen NÁDAT de aanroeper `task.time` heeft gezet, met de momentopname van
 * daarvóór. De ENE plek voor alle routes (`taskSlice.updateTask` = paneel, dialoog, Gantt-sleep en
 * extensies; het taakraster: cel, plakken, doorvullen; de MCP-draft; splitsen). Drie stappen:
 *
 *  1. De restduur volgt de duur. Een NIET-gestarte taak (0 %, geen werkelijke datums) met een
 *     expliciet restveld krijgt rest = volledige nieuwe duur, zonder afronding (B3).
 *     Zonder deze stap bleef een uit het bestand gelezen restveld (P6
 *     `remain_drtn_hr_cnt`, MSP `RemainingDuration`) op de oude duur staan: *Resterend* en de balk
 *     liepen uiteen, de driehoek zag geen wijziging, en een latere werkelijke start op 0 % liet het
 *     restwerk alsnog springen. Een LOPENDE taak hoort dit al gehad te hebben
 *     (`carryRemainingThroughDurationEdit`, vóór deze stap: `updateTask`, raster, MCP-draft). Gaf de
 *     bewerking zelf voortgang of een restduur op, dan wint die opgave.
 *     UITZONDERING (ook op main): `applyTaskSplits` (splitMutations.ts) roept de meeschuifstap niet
 *     aan. Op een GESTARTE taak met een expliciet restveld blijft de rest bij een splitsbewerking dus
 *     staan, en volgen inzet en werk niet. VERVOLG op #380.
 *  2. De kern verdeelt inzet en werk naar de nieuwe restduur volgens de regel van de taak
 *     (`applyDurationEdit`): werk beschermd ⇒ inzet = W ÷ R'; anders wordt een aanwezig werkveld
 *     R' × inzet — óók als het uit het bestand kwam en afweek (P6 doet dat zonder vraag,
 *     eigenaarsbesluit 2026-10-19). De duur zelf wordt hier NIET herschreven (die is al gezet).
 *  3. Elk bewaard restwerk dat afweek van inzet × restduur en nu herschreven is, komt terug in
 *     `recomputedWork`; de aanroeper meldt het één keer per transactie.
 *
 * Onder FIXED_DURATION_RATE zonder werkvelden verandert er aan de toewijzingen niets.
 */
export function settleDurationEdit(task: Task, captured: CapturedTriangle | null): DurationEditWriteBack {
  if (!captured) return NO_DURATION_CHANGE;
  // Poort: een voortgangsbewerking (`completion`/`remainingTime`) verandert de REST maar niet
  // de duur — dat is geen duurbewerking en raakt de driehoek niet.
  if (Math.abs(totalMinutesOf(task, captured.ctx) - captured.totalMinutes) < 1e-6) return NO_DURATION_CHANGE;
  followRemainingOfUnstartedTask(task, captured.time);
  const newRemaining = remainingMinutesOf(task, captured.ctx);
  if (Math.abs(newRemaining - captured.state.remainingMinutes) < 1e-6) return NO_DURATION_CHANGE;
  const result = applyDurationEdit(captured.state, newRemaining);
  if (!result.ok) return NO_DURATION_CHANGE;
  // Alleen de toewijzingen van deze taak (uit de momentopname): de terugschrijfstap en het
  // afwijkcriterium zoeken dan in een handvol objecten, niet in alle toewijzingen van het project.
  const own = captured.assignments;
  const deviating = deviatingStoredWork(task, own, captured.state);
  const written = applyTriangleResult(task, own, captured.state, result.state, captured.ctx, { skipDuration: true, actualWork: captured.actualWork });
  const recomputedWork: RecomputedRemainingWork[] = [];
  for (const before of deviating) {
    const after = own.find((a) => a.id === before.id);
    if (!after || after.remainingWorkMinutes === undefined) continue;
    if (Math.abs(after.remainingWorkMinutes - before.minutes) <= 1e-6) continue; // werk beschermd: bleef staan
    recomputedWork.push({
      taskId: task.id, taskName: task.name, assignmentId: after.id, resourceId: after.resourceId,
      beforeMinutes: before.minutes, afterMinutes: after.remainingWorkMinutes,
    });
  }
  return { ...written, recomputedWork };
}

/**
 * Stap 1 van {@link settleDurationEdit}: een niet-gestarte taak met een expliciet restveld krijgt
 * rest = volledige nieuwe duur. Niet-gestart = 0 % en geen werkelijke start of einde, vóór én ná de
 * bewerking (een lopende taak regelt `carryRemainingThroughDurationEdit`, een voltooide houdt rest 0).
 * Niet als de bewerking zelf een voortgangsveld of restduur wijzigde (die opgave wint), en niet op een
 * mijlpaal (die blijft zonder restveld, zoals in `carryRemainingThroughDurationEdit`). Zonder
 * restveld hoeft er niets: de rest is dan al de afleiding uit de duur.
 */
function followRemainingOfUnstartedTask(task: Task, before: TaskTime): void {
  const t = task.time;
  if (task.isMilestone) return;
  if (t.remainingTime === undefined && t.remainingMinutes === undefined) return;
  const unstarted = (time: TaskTime) => !(time.completion > 0) && !time.actualStart && !time.actualFinish;
  if (!unstarted(before) || !unstarted(t)) return;
  const progressTouched = t.completion !== before.completion
    || t.remainingTime !== before.remainingTime || t.remainingMinutes !== before.remainingMinutes;
  if (progressTouched) return;
  // B3: de brug schrijft exact. De gedeelde voortgangsregel wordt door F2 aangepast.
  if (isHourTask(t)) {
    t.remainingMinutes = t.durationMinutes;
    t.remainingTime = hourRemainingDays(t, t.remainingMinutes);
  } else t.remainingTime = t.scheduleDuration;
}

/** De werkresources van de taak waarvan het BEWAARDE restwerk vóór de bewerking afweek van
 *  inzet × restduur — hetzelfde criterium als het waarschuwingsteken (`assignmentWorkDeviation`):
 *  materiaal en een toewijzing met contour tellen niet mee. `own` = de toewijzingen van de taak. */
function deviatingStoredWork(
  task: Task,
  own: readonly ResourceAssignment[],
  before: TriangleState,
): { id: string; minutes: number }[] {
  const out: { id: string; minutes: number }[] = [];
  const contoured = (task.timephasedContours?.length ?? 0) > 0;
  for (const a of before.assignments) {
    if (!a.drivesDuration || a.remainingWorkMinutes === undefined) continue;
    if (contoured && contourIndexForAssignment(task.timephasedContours, own, a.id) >= 0) continue;
    if (!storedWorkDeviates(a.remainingWorkMinutes, before.remainingMinutes * a.unitsPerDay)) continue;
    out.push({ id: a.id, minutes: a.remainingWorkMinutes });
  }
  return out;
}

/**
 * Inzet van één toewijzing gewijzigd — aanroepen NÁDAT de aanroeper de nieuwe
 * `unitsPerDay` heeft geschreven (zodat de exacte invoer staat), met de momentopname van
 * daarvóór. Kan de taakduur veranderen (FIXED_WORK/FIXED_RATE) ⇒ `durationChanged`.
 */
export function settleUnitsEdit(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle | null,
  assignmentId: string,
  newUnitsPerDay: number,
): TriangleWriteBack {
  if (!captured) return NO_CHANGE;
  const completed = settleCompletedWork(task, assignments, captured);
  if (completed) return completed;
  const result = applyUnitsEdit(captured.state, assignmentId, newUnitsPerDay);
  if (!result.ok) return NO_CHANGE;
  return applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx, { actualWork: captured.actualWork });
}

/** Een doorgerekende maar nog niet geschreven uitkomst: plannen kan vóór de undo-snapshot, zodat
 *  een weigering geen lege undo-stap achterlaat; `commitTrianglePlan` schrijft daarna. */
export interface TrianglePlan {
  captured: CapturedTriangle;
  after: TriangleState;
}

/** Resterend werk van één toewijzing gezet, zonder te schrijven.
 *  `null` ⇒ geweigerd (werk ≤ 0, onbekende toewijzing) of niet van toepassing. */
export function planWorkEdit(
  task: Task,
  assignments: readonly ResourceAssignment[],
  deps: WorkRuleDeps,
  assignmentId: string,
  newWorkMinutes: number,
): TrianglePlan | null {
  const captured = captureTriangle(task, assignments, deps);
  if (!captured) return null;
  const result = applyWorkEdit(captured.state, assignmentId, newWorkMinutes);
  if (!result.ok) return null;
  return { captured, after: result.state };
}

export function commitTrianglePlan(task: Task, assignments: ResourceAssignment[], plan: TrianglePlan): TriangleWriteBack {
  return applyTriangleResult(task, assignments, plan.captured.state, plan.after, plan.captured.ctx, { actualWork: plan.captured.actualWork });
}

/** `planWorkEdit` + `commitTrianglePlan` in één stap (raster/MCP, waar de snapshot al staat). */
export function settleWorkEdit(
  task: Task,
  assignments: ResourceAssignment[],
  deps: WorkRuleDeps,
  assignmentId: string,
  newWorkMinutes: number,
): TriangleWriteBack | null {
  const plan = planWorkEdit(task, assignments, deps, assignmentId, newWorkMinutes);
  return plan ? commitTrianglePlan(task, assignments, plan) : null;
}

/** Resource erbij — aanroepen NÁDAT de nieuwe toewijzing in `assignments` staat,
 *  met de momentopname van daarvóór (zonder de nieuwe). */
export function settleAssignmentAdded(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle | null,
  added: ResourceAssignment,
): TriangleWriteBack {
  if (!captured) return NO_CHANGE;
  const completed = settleCompletedWork(task, assignments, captured);
  if (completed) return completed;
  const resource = captured.ctx.resourceById?.(added.resourceId);
  const result = applyAssignmentAdded(captured.state, {
    id: added.id, unitsPerDay: added.unitsPerDay, drivesDuration: resource ? resource.type !== 'MATERIAL' : true,
  });
  if (!result.ok) return NO_CHANGE;
  return applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx, { actualWork: captured.actualWork });
}

/** Resource eraf — momentopname MÉT de te verwijderen toewijzing, aanroepen NÁDAT
 *  ze uit `assignments` is; de kern verdeelt haar werk over de blijvers waar de regel dat wil. */
export function settleAssignmentRemoved(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle | null,
  removedId: string,
): TriangleWriteBack {
  if (!captured) return NO_CHANGE;
  const result = applyAssignmentRemoved(captured.state, removedId);
  if (!result.ok) return NO_CHANGE;
  return applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx, { actualWork: captured.actualWork });
}

export interface RuleChangeWriteBack extends TriangleWriteBack {
  /** Feitelijke maatwijziging (B1a). De aanroeper behandelt dit als planningsbewerking (spec §5.2,
   *  geval 11c): de modus "datums zoals opgeslagen" gaat uit en de planning wordt verouderd, in
   *  dezelfde undo-stap als de wissel (`markDateMutation` via `finishMutation`). Het doorrekenen volgt
   *  daarna de gewone regel: in de UI `useExitRecordedDates` na het verlaten van de modus, in MCP de
   *  transactie zelf (`recordedDateRuleChange` telt de wissel dan niet als datumneutraal). */
  durationUnitChanged: boolean;
}

/** Typewissel: schrijft `task.workRule` en legt onder een werkbeschermende regel het
 *  huidige restwerk vast. B1a: vast werk maakt een gewone dagenmaat-taak urenmaat, met
 *  minuten = werkdagen × effectieve werktijd per dag, onafhankelijk van de plaatsing (T14).
 *  `undefined` = terug naar de projectstandaard. De maatwijziging wordt apart geretourneerd. */
export function settleRuleChange(
  task: Task,
  assignments: ResourceAssignment[],
  deps: WorkRuleDeps,
  rule: WorkRule | undefined,
): RuleChangeWriteBack {
  const captured = captureTriangle(task, assignments, deps);
  if (rule === undefined) delete task.workRule; else task.workRule = rule;
  if (!captured) return { ...NO_CHANGE, durationUnitChanged: false };
  const effectiveRule = effectiveWorkRule(task, captured.ctx.defaultWorkRule);
  const durationUnitChanged = effectiveRule === 'FIXED_WORK' && task.time.durationUnit !== 'hours';
  if (durationUnitChanged) {
    const t = task.time;
    t.durationUnit = 'hours';
    t.durationMinutes = captured.totalMinutes;
    // Rest uit de blijvende dagenbron van VÓÓR de omzetting, ook bij een voltooide taak.
    if (t.remainingTime !== undefined || t.completion > 0 || t.actualStart) {
      t.remainingMinutes = captured.state.remainingMinutes;
      t.remainingTime = hourRemainingDays(t, t.remainingMinutes);
    } else delete t.remainingMinutes;
  }
  const result = applyRuleChange(captured.state, effectiveRule);
  const written = result.ok
    ? applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx, { actualWork: captured.actualWork })
    : NO_CHANGE;
  return { ...written, durationUnitChanged };
}

/**
 * B1a (spec §3.2, §3.12): vast werk is altijd urenmaat. Een duur in werkdagen op een taak onder vast
 * werk gaat naar de urenbron: minuten = werkdagen × werktijd per dag van de taakkalender (T14), en de
 * taak blijft (of wordt) urenmaat. "5d" geeft zo 5 × de werktijd per dag; geen invoer maakt de taak
 * dagenmaat.
 *
 * Een duur in werkdagen is: de bewerking zet de maat op dagen, of verandert `scheduleDuration`
 * zonder `durationMinutes`. Een bewerking die de duur niet raakt, verandert niets (een naam
 * wijzigen zet een oude dagtaak onder vast werk dus niet om). `task` is de taak zoals de bewerking
 * haar achterlaat (de regel en de mijlpaalvlag van ná de bewerking); `after` is haar nieuwe tijd en
 * wordt hier gemuteerd, vóór het schrijven. Geeft `true` als de duur naar de urenbron ging.
 * Eén regel voor store (`updateTask`), raster (`gridTransaction`) en de MCP-draft.
 */
export function routeFixedWorkDurationToHours(
  task: Task,
  before: TaskTime,
  after: TaskTime,
  defaultWorkRule: WorkRule | undefined,
  hoursPerDay: number,
): boolean {
  if (effectiveWorkRule(task, defaultWorkRule) !== 'FIXED_WORK') return false;
  if (!workRuleApplies({ ...task, time: after })) return false;
  const daysInput = after.durationUnit === 'days'
    ? before.durationUnit !== 'days' || after.scheduleDuration !== before.scheduleDuration
    : after.durationMinutes === before.durationMinutes && after.scheduleDuration !== before.scheduleDuration;
  if (!daysInput) return false;
  return writeDaysAsHours(after, hoursPerDay);
}

/**
 * Zet een duur in werkdagen om naar de urenmaat: minuten = werkdagen × werktijd per dag × 60 (T14), en
 * `scheduleDuration` blijft het afgeleide dagengetal. Muteert `time`. Geeft `false` (en verandert niets)
 * bij een ongeldige werktijd per dag of een ongeldige duur. Gedeeld door de B1a-routering hierboven en
 * de standaardmaat van een nieuwe taak (`state/newTaskMeasure.ts`).
 */
export function writeDaysAsHours(time: TaskTime, hoursPerDay: number): boolean {
  if (!(Number.isFinite(hoursPerDay) && hoursPerDay > 0)) return false;
  if (!Number.isFinite(time.scheduleDuration) || time.scheduleDuration < 0) return false;
  const slot = hoursPerDay * 60;
  time.durationUnit = 'hours';
  time.durationMinutes = time.scheduleDuration * slot;
  time.scheduleDuration = time.durationMinutes / slot;
  return true;
}

/** De drie duurvelden van een tijd, om de urenbron van {@link routeFixedWorkDurationToHours} in een
 *  patch over te nemen. */
export function hourSourceOf(time: TaskTime): Pick<TaskTime, 'durationUnit' | 'durationMinutes' | 'scheduleDuration'> {
  return { durationUnit: time.durationUnit, durationMinutes: time.durationMinutes, scheduleDuration: time.scheduleDuration };
}

/**
 * Nazorg wanneer de werkdriehoek de TAAKduur verandert (inzet/werk/resource erbij-eraf onder
 * FIXED_WORK/FIXED_RATE, of een kalenderwissel) — dezelfde als bij een duurbewerking in
 * `taskSlice.updateTask`, in dezelfde volgorde: contour én importsplits herschalen (werkbehoud
 * volgens de regel), het timephased-venster (laag 3) en bevroren duur-walks (laag 4) wissen, dan
 * de nivelleergaten wissen (`clearLevelingGaps`: een duurwijziging verzet de werkminuten-as waar
 * ze op liggen) en pas DAARNA het ingevoerde einde van een niet-gestarte urentaak herleiden
 * (`reconcileHourInputFinish`: de solve schrijft `scheduleFinish` niet terug, dus elke
 * invoerbewerking die de duur verandert moet dat zelf doen — en ná `clearLevelingGaps`, anders telt
 * het einde gewiste gaten mee).
 *
 * `finishBasis` is `hourInputFinishBasis(task)` van VÓÓR de bewerking (vóór `applyTriangleResult`
 * of de kalenderwissel) — met een basis van ná de bewerking ziet de reconcile "geen invoer-
 * wijziging" en blijft het einde oud. Leg hem vast naast `oldWorkMinutes`, of gebruik
 * `CapturedTriangle.finishBasis`/`CalendarCapture.finishBasis`.
 *
 * Eén definitie voor store, raster en MCP. Retourneert of er timephased-sturing verloren ging
 * (⇒ de aanroeper meldt); het wissen van nivelleergaten telt daar bewust niet in mee (app-eigen
 * afgeleide uitvoer,
 * geen importverlies — zie `taskSlice.updateTask`). `scheduleStale` en de snapshot blijven aan de
 * aanroeper.
 */
export function settleDurationAftermath(
  task: Task,
  deps: WorkRuleDeps,
  oldWorkMinutes: number,
  finishBasis: HourInputFinishBasis,
): boolean {
  const hpd = workRuleContextOf(task, deps).hoursPerDay;
  // De regels zelf staan in ÉÉN kern,
  // `applyDurationChangeRules` (taskDefaults.ts) — contour/importsplits herschalen (werkbehoud
  // volgens de regel), bij een duurKRIMP zonder herschaling de gebruikersgaten afknippen,
  // laag 3 en bevroren laag 4 ontkoppelen, nivelleergaten wissen. Hier komt alleen het ingevoerde
  // uur-einde erbij, ná het wissen van de nivelleergaten.
  const lost = applyDurationChangeRules(task, oldWorkMinutes, hpd, {
    keepWork: contourKeepsWork(task, deps.project.defaultWorkRule),
  });
  reconcileHourInputFinish(task, finishBasis, resolveCalendar(task.calendarId, deps.calendars as WorkCalendar[], deps.calendar));
  return lost;
}

/**
 * Kalenderwissel: momentopname VÓÓR de wissel — de werkdriehoek plus de werkminuten van de taak in
 * de OUDE slot (de referentie waar de contour-as tegen herschaald wordt; `oudeDagen × nieuwe slot`
 * is de verkeerde referentie).
 */
export interface CalendarCapture {
  triangle: CapturedTriangle | null;
  /** `taskWorkMinutes` in de oude slot — ook voor taken waar de regel niet op werkt (dan blijft de
   *  contour-as met rust; zie `settleCalendarChange`). */
  oldWorkMinutes: number;
  /** De basis van het ingevoerde einde VÓÓR de wissel (`settleDurationAftermath`). Uurtaken slaat
   *  `settleCalendarChange` over, dus hier is de reconcile in de praktijk een no-op; de basis staat er
   *  voor het contract (nooit een basis van ná de bewerking). */
  finishBasis: HourInputFinishBasis;
}

export function captureCalendarChange(task: Task, assignments: readonly ResourceAssignment[], deps: WorkRuleDeps): CalendarCapture {
  return {
    triangle: captureTriangle(task, assignments, deps),
    oldWorkMinutes: totalMinutesOf(task, workRuleContextOf(task, deps)),
    finishBasis: hourInputFinishBasis(task),
  };
}

export interface CalendarSettle {
  /** De regel heeft de duur (in dagen) van de taak gewijzigd (Vast werk / Vaste inzet). */
  durationChanged: boolean;
  /** De nazorg (`settleDurationAftermath`) heeft het timephased-venster of bevroren duur-walks
   *  gewist — de aanroeper meldt dat (`notifyTimephasedLoss`/`recordTimephasedLoss`). */
  timephasedLost: boolean;
}

const NO_CALENDAR_CHANGE: CalendarSettle = { durationChanged: false, timephasedLost: false };

/**
 * Kalenderwissel: aanroepen NÁDAT de kalender van de taak (of de
 * inhoud van haar kalender) is gewijzigd, met de momentopname van daarvóór. Alleen de slotgrootte
 * (uren per dag) telt; de restduur in dagen blijft, en de regel beslist (`applySlotChange`).
 * Uurtaken ⇒ alleen hun verborgen dagengetal volgt de nieuwe werktijd per dag; een ongewijzigde slot ⇒ niets. Eén definitie voor store, raster, MCP, project-
 * kalender, kalenderinhoud en de hele bibliotheek (`commitCalendarLibrary` = de kalenderdialoog,
 * `removeCalendar`; via `state/calendarTasks.ts`), inclusief de nazorg:
 *  - verandert de duur ⇒ `settleDurationAftermath` met de OUDE werkminuten als referentie (contour
 *    en importsplits herschalen, timephased-venster en bevroren walks wissen);
 *  - verandert de duur NIET maar de slot wél (FIXED_DURATION_*) ⇒ alleen de contour-as herschalen:
 *    dezelfde dagen zijn in de nieuwe slot een andere hoeveelheid werkminuten, en de as leeft op
 *    de werkminuten.
 * De rest wordt bij een gestarte taak expliciet geschreven door `applyTriangleResult` en
 * `completion` volgt daaruit, ook op dit pad. Taken buiten `workRuleApplies` (mijlpaal,
 * verzameltaak, hangmat, ELAPSEDTIME) blijven hier ongemoeid — óók hun contour-as.
 */
export function settleCalendarChange(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CalendarCapture,
  deps: WorkRuleDeps,
): CalendarSettle {
  const { triangle } = captured;
  if (isHourTask(task.time)) {
    // Een urentaak houdt haar werkminuten; alleen haar verborgen dagengetal volgt de werktijd per dag
    // van de nieuwe kalender(inhoud) — zie `hourTaskScheduleDuration`. Een verzameltaak of hangmat
    // krijgt haar duur uit de doorrekening (`writeDerivedSpan`) en blijft hier ongemoeid. (Immer
    // markeert een toewijzing met dezelfde waarde niet als wijziging; een wachter is niet nodig.)
    if (task.childIds.length === 0 && !task.isHammock) {
      task.time.scheduleDuration = hourTaskScheduleDuration(task.time.durationMinutes,
        resolveCalendar(task.calendarId, deps.calendars as WorkCalendar[], deps.calendar));
      // De restduur in dagen heeft dezelfde vorm (`hourRemainingDays`); de restminuten blijven.
      if (task.time.remainingTime !== undefined && task.time.remainingMinutes !== undefined) {
        task.time.remainingTime = hourRemainingDays(task.time, task.time.remainingMinutes);
      }
    }
    return NO_CALENDAR_CHANGE;
  }
  if (!triangle) return NO_CALENDAR_CHANGE;
  const ctx = workRuleContextOf(task, deps);
  const newSlot = slotMinutesOf(ctx);
  if (newSlot === triangle.state.slotMinutes) return NO_CALENDAR_CHANGE;
  const remainingDays = triangle.state.remainingMinutes / triangle.state.slotMinutes;
  const newRemaining = remainingDays * newSlot;
  const result = applySlotChange(triangle.state, newSlot, newRemaining);
  // Contour-as éérst naar de nieuwe slot (dezelfde dagen, andere werkminuten), met de HOOGTE die
  // meeschaalt (werk = R' × I, de afgeleide lezing). De regel-specifieke hoogte komt daarna niet uit
  // een regelconstante maar uit de toewijzingen zelf: `reconcileContourWork` zet elke contour met een
  // opgeslagen werkveld op precies dát werk (een regelvlag hier zou dubbel schalen onder de
  // standaardregel en onder FIXED_RATE contour en toewijzing laten uiteenlopen). Zonder
  // werkveld ís R' × I het werk, dus dan klopt de meegeschaalde hoogte al.
  rescaleTaskContours(task, captured.oldWorkMinutes, ctx.hoursPerDay, false);
  const slotWorkMinutes = totalMinutesOf(task, ctx);
  let durationChanged = false;
  let timephasedLost = false;
  if (result.ok) {
    const beforeInNewSlot: TriangleState = { ...triangle.state, slotMinutes: newSlot, remainingMinutes: newRemaining };
    const written = applyTriangleResult(task, assignments, beforeInNewSlot, result.state, ctx, { actualWork: triangle.actualWork });
    if (written.durationChanged) {
      durationChanged = true;
      timephasedLost = settleDurationAftermath(task, deps, slotWorkMinutes, captured.finishBasis);
    }
  }
  reconcileContourWork(task, assignments, assignments.filter((a) => a.taskId === task.id).map((a) => a.id));
  return { durationChanged, timephasedLost };
}

/**
 * Duurbewerking op een LOPENDE taak: het verrichte deel is een feit, dus wat de gebruiker aan de duur
 * toevoegt of afhaalt landt in de rest (Microsoft: Remaining Duration = Duration − Actual Duration).
 *
 * - LOPEND: gestart (werkelijke start of voortgang > 0 %) en nog niet voltooid. Ook een gestarte taak
 *   op 0 % telt mee: haar gedane werk is 0, dus haar restduur volgt de nieuwe duur. Uitgesloten zijn
 *   taken zonder eigen bewerkbare duur: verzameltaken en hangmatten (wél elk
 *   duurtype, ook ELAPSEDTIME — dit is een duur-identiteit, geen driehoeksregel).
 * - Alleen als de bewerking de voortgang zelf NIET wijzigt: geeft dezelfde bewerking ook een nieuw
 *   percentage, een nieuwe restduur of een nieuwe werkelijke datum op ("Taak bewerken" met duur én
 *   voortgang, een geplakte rij), dan wint die opgave.
 * - EXACT, zonder afrondingsdrift: de restduur schuift in de eigen eenheid van de taak met precies het
 *   duurverschil (dagtaak: `remainingTime` in werkdagen; urentaak: `remainingMinutes` in minuten met
 *   de werkdagfractie van `hourRemainingDays`). Ontbreekt een expliciet restveld, dan is de rest vóór
 *   de bewerking de exacte afleiding uit het percentage (B3) — die wordt
 *   geschreven, anders zou de solver hem opnieuw als `nieuwe duur × (1 − %)` afleiden en schuift het
 *   gedane werk mee. Het percentage wordt NIET afgerond: oud % × oude duur ÷ nieuwe duur, zodat
 *   % × duur (het gedane werk) gelijk blijft; de weergave rondt pas af (IFC schrijft verliesvrij, zie
 *   `ifcCompletionReal`).
 * - Een eenheidswissel (dagen ↔ uren) rekent via de werkminuten: het gedane werk blijft gelijk en de
 *   restduur volgt de gewone regel in de nieuwe eenheid.
 * - Nieuwe duur KORTER dan het gedane werk: geweigerd (`refused`), niets geraden. Precies gelijk
 *   ⇒ 100 %: de voortgangsinvarianten leiden dan het werkelijke einde af.
 *
 * `null` = de regel is niet van toepassing. Pure functie op de tijd van VÓÓR en NÁ de bewerking;
 * `hoursPerDay` zoals de aanroeper de werkduur meet (`taskWorkMinutes`).
 */
export type DurationEditProgress =
  | { refused: true; done: number; unit: 'days' | 'hours' }
  | { refused: false; completion: number; remainingTime: number; remainingMinutes?: number };

export function durationEditProgress(
  task: Pick<Task, 'childIds' | 'isHammock'>,
  before: TaskTime,
  after: TaskTime,
  hoursPerDay: number,
): DurationEditProgress | null {
  if (task.childIds.length > 0 || task.isHammock === true) return null;
  if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0) return null;
  const running = (before.completion > 0 || !!before.actualStart) && before.completion < 1 && !before.actualFinish;
  if (!running) return null;
  const progressTouched = after.completion !== before.completion
    || after.remainingTime !== before.remainingTime || after.remainingMinutes !== before.remainingMinutes
    || after.actualStart !== before.actualStart || after.actualFinish !== before.actualFinish;
  if (progressTouched) return null;
  const unitBefore = timeUnit(before);
  const unitAfter = timeUnit(after);
  const oldWork = taskWorkMinutes(before, hoursPerDay);
  const newWork = taskWorkMinutes(after, hoursPerDay);
  if (unitBefore === unitAfter && Math.abs(newWork - oldWork) < 1e-9) return null;
  const c = before.completion;
  const doneDays = c * before.scheduleDuration;
  const doneMinutes = c * (before.durationMinutes ?? 0);
  const refusal: DurationEditProgress = unitBefore === 'hours'
    ? { refused: true, done: doneMinutes / 60, unit: 'hours' }
    : { refused: true, done: doneDays, unit: 'days' };
  if (newWork < c * oldWork - 1e-6) return refusal;
  const cap = (value: number) => (value >= 1 - 1e-12 ? 1 : value);

  if (unitBefore === 'days' && unitAfter === 'days') {
    const remaining = (before.remainingTime ?? before.scheduleDuration * (1 - c))
      + (after.scheduleDuration - before.scheduleDuration);
    if (remaining < -1e-9) return refusal;
    const completion = after.scheduleDuration > 0 ? cap(doneDays / after.scheduleDuration) : c;
    return { refused: false, completion, remainingTime: Math.max(0, remaining) };
  }
  if (unitBefore === 'hours' && unitAfter === 'hours') {
    const oldMinutes = before.durationMinutes ?? 0;
    const newMinutes = after.durationMinutes ?? 0;
    const remainingMinutes = (before.remainingMinutes ?? oldMinutes * (1 - c)) + (newMinutes - oldMinutes);
    if (remainingMinutes < -1e-9) return refusal;
    const completion = newMinutes > 0 ? cap(doneMinutes / newMinutes) : c;
    const minutes = Math.max(0, remainingMinutes);
    return { refused: false, completion, remainingMinutes: minutes, remainingTime: hourRemainingDays(after, minutes) };
  }
  // Eenheidswissel: via de werkminuten; de restduur volgt de gewone regel in de nieuwe eenheid.
  const completion = newWork > 0 ? cap((c * oldWork) / newWork) : c;
  if (unitAfter === 'hours') {
    const remainingMinutes = (after.durationMinutes ?? 0) * (1 - completion);
    return { refused: false, completion, remainingMinutes, remainingTime: hourRemainingDays(after, remainingMinutes) };
  }
  return { refused: false, completion, remainingTime: after.scheduleDuration * (1 - completion) };
}

function timeUnit(time: TaskTime): 'days' | 'hours' {
  return taskDurationUnit({ time } as Task);
}

/**
 * De weigering vooraf: zou deze duurbewerking de duur van een
 * lopende taak korter maken dan het gedane werk? Store (`updateTask`, met melding), "Taak bewerken"
 * (niets opgeslagen), MCP-draft (zachte weigering per item) en extensie-API (via `updateTask`)
 * vragen dit VÓÓR de mutatie — dus zonder snapshot; het raster krijgt dezelfde uitkomst uit
 * {@link carryRemainingThroughDurationEdit} als celfout `durationBelowDoneWork`.
 */
export function durationEditRefusal(
  task: Pick<Task, 'childIds' | 'isHammock' | 'time'>,
  after: TaskTime,
  hoursPerDay: number,
): Extract<DurationEditProgress, { refused: true }> | null {
  const change = durationEditProgress(task, task.time, after, hoursPerDay);
  return change?.refused ? change : null;
}

/**
 * Past {@link durationEditProgress} toe op `task` (muteert), NÁDAT de nieuwe duur is gezet, met een
 * kopie van de tijd van VÓÓR de bewerking. Eén definitie voor store (`updateTask`), raster
 * (`finishDurationEdit`) en MCP-draft (`updateTaskFields`/`patchTaskFields`); vóór de driehoekstap
 * (`settleDurationEdit` leest de rest) en vóór `applyDurationChangeRules`.
 *
 * Retourneert de uitkomst: `refused` ⇒ er is NIETS gemuteerd (het raster maakt er een celfout van;
 * store en MCP hebben al vooraf geweigerd via {@link durationEditRefusal}), anders het nieuwe
 * percentage en de nieuwe rest (de AI-koppeling meldt die als `progressAdjusted`). Bereikt het gedane
 * werk precies de nieuwe duur, dan is de taak voltooid en leiden de voortgangsinvarianten het
 * werkelijke einde af (`statusDate`). `calendar` is de effectieve kalender van de taak: daarmee wordt
 * dat einde eerst een moment (D6: het einde van de statuswerkdag) en pas daarna vergeleken met de
 * werkelijke start. Zonder kalender werd een start om 07:00 op de statusdag ook het einde.
 */
export function carryRemainingThroughDurationEdit(
  task: Task,
  before: TaskTime,
  hoursPerDay: number,
  statusDate: string | undefined,
  calendar: WorkCalendar | undefined,
): DurationEditProgress | null {
  const change = durationEditProgress(task, before, task.time, hoursPerDay);
  if (!change || change.refused) return change;
  // Mijlpaal aan op een gestarte taak zonder gedaan werk: niets mee te schuiven (duur 0; een
  // mijlpaal blijft zonder restveld). Met gedaan werk weigerde de regel hierboven al.
  if (task.isMilestone) return null;
  const t = task.time;
  t.completion = change.completion;
  t.remainingTime = change.remainingTime;
  if (change.remainingMinutes !== undefined) t.remainingMinutes = change.remainingMinutes;
  else delete t.remainingMinutes;
  if (change.completion >= 1) applyProgressInvariants(task, statusDate, calendar);
  return change;
}

/**
 * Voortgangsbewerking en opgeslagen werk.
 * Een voortgangsbewerking is geen duurbewerking (de driehoek blijft erbuiten), maar ze verplaatst
 * wél werk van RESTANT naar VERRICHT: de identiteit rest = begroot − verricht (P6: Remaining Units =
 * At Completion − Actual bij elke actual) moet in beide richtingen blijven gelden. Zonder
 * deze stap blijft `remainingWorkMinutes` op de oude waarde staan terwijl `assignmentDayUnits` het
 * verrichte deel óók uit de voortgang afleidt — het histogram telt dan dubbel (10 d, W 4800, 50 %
 * ⇒ 15 eenheid-dagen) en de driehoek rekent daarna met het te grote restwerk.
 *
 * Regel per toewijzing MET een opgeslagen restveld (zonder veld verandert er niets — dan is alles
 * afgeleid en schuift het vanzelf mee):
 *  - verricht vóór = `actualWorkMinutes` als dat er is, anders afgeleid als verrichte duur × inzet
 *    (dezelfde afleiding als laag 3 van `assignmentDayUnits`);
 *  - nieuw restwerk = restwerk × nieuwe restduur ÷ oude restduur (het resttempo per restdag blijft —
 *    ook voor een niet-sturende toewijzing met W_i / I_i < R); stond de rest op 0 (heropenen na
 *    100 %), dan is er geen tempo en wordt het totaal (verricht + rest) naar rato van de restduur
 *    over de hele duur verdeeld;
 *  - nieuw verricht = verricht vóór + (restwerk − nieuw restwerk): het TOTAAL blijft, er schuift
 *    alleen werk tussen de twee velden. Het verrichte veld wordt dus geschreven, ook als het er nog
 *    niet stond — een voortgangsboeking is verricht-werkinvoer.
 * De contour blijft ongemoeid: haar periodes zijn de vorm en worden door een voortgangsboeking niet
 * hertypeerd; het histogram leest bij een contour laag 1, niet de velden.
 * Poort: alleen wanneer de TOTALE duur gelijk bleef en de rest veranderde (anders is het een
 * duurbewerking en regelt `settleDurationEdit`/`carryRemainingThroughDurationEdit` de rest).
 * Eén definitie voor store (`setTaskProgress`/`setActualStart`/`setActualFinish`/`updateTask`/
 * `applyProgressImport`), taakraster, MCP-`updateTaskFields` en MCP-`progress.applyProgressUpdate`.
 */
export interface ProgressWorkCapture {
  restMinutes: number;
  totalMinutes: number;
  ctx: WorkRuleContext;
}

/** Momentopname VÓÓR een voortgangsbewerking; `null` voor een verzameltaak (afgeleide voortgang). */
export function captureProgressWork(task: Task, deps: WorkRuleDeps): ProgressWorkCapture | null {
  if (task.childIds.length > 0) return null;
  const ctx = workRuleContextOf(task, deps);
  return { restMinutes: remainingMinutesOf(task, ctx), totalMinutes: totalMinutesOf(task, ctx), ctx };
}

/** Aanroepen NÁDAT de voortgang (en `applyProgressInvariants`) op de taak staat. Retourneert de ids
 *  van de toewijzingen waarvan de werkvelden zijn herschreven. */
export function settleProgressWork(task: Task, assignments: ResourceAssignment[], captured: ProgressWorkCapture | null): string[] {
  if (!captured) return [];
  const total = totalMinutesOf(task, captured.ctx);
  if (Math.abs(total - captured.totalMinutes) > 1e-6) return [];
  const restAfter = remainingMinutesOf(task, captured.ctx);
  const restBefore = captured.restMinutes;
  if (Math.abs(restAfter - restBefore) < 1e-6) return [];
  const changed: string[] = [];
  for (const a of assignments) {
    if (a.taskId !== task.id) continue;
    const w = a.remainingWorkMinutes;
    if (w === undefined || !Number.isFinite(w)) continue;
    const work = Math.max(0, w);
    const doneBefore = a.actualWorkMinutes !== undefined && Number.isFinite(a.actualWorkMinutes)
      ? Math.max(0, a.actualWorkMinutes)
      : Math.max(0, total - restBefore) * a.unitsPerDay;
    const nextRest = restBefore > 1e-6
      ? work * restAfter / restBefore
      : (total > 0 ? (doneBefore + work) * restAfter / total : 0);
    const nextDone = Math.max(0, doneBefore + work - nextRest);
    a.remainingWorkMinutes = nextRest;
    a.actualWorkMinutes = nextDone;
    changed.push(a.id);
  }
  return changed;
}

/**
 * Contourbewerking en opgeslagen werk. Invariant: staan contour en werkveld allebei, dan is de som
 * van de `remaining`-periodes gelijk aan `remainingWorkMinutes`, idem actual. Zet de gebruiker een
 * eigen urenverdeling (`setAssignmentContour`), dan IS die som het werk: een aanwezig restveld wordt
 * de som van de `remaining`-periodes, een aanwezig verricht-veld de som van de `actual`-periodes.
 * Zonder die stap blijft het oude veld staan, wint het bij de volgende duurwijziging
 * (`applyDurationEdit` rekent I = W_oud / R) en zet `reconcileContourWork` de
 * contour stil terug naar het oude werkgetal. Afwezige velden blijven afwezig (zonder veld is de
 * contoursom al het afgeleide werk); loslaten (`null`) raakt de velden niet: de
 * laatst bewerkte som blijft het werk. Geen duurwijziging (een contour raakt geen datum).
 */
export function syncAssignmentWorkToContour(
  assignment: ResourceAssignment,
  periods: readonly { kind?: string; workMinutes: number }[] | null,
): boolean {
  if (periods === null) return false;
  let changed = false;
  // Een EERSTE urenverdeling op een gestarte taak heeft nog geen
  // `actual`-periodes — `ContourDialog` vult een nieuwe verdeling met de hele belasting en
  // `buildEditedContourPeriods` neemt alleen bestaande actual-periodes over. Dan is de contoursom
  // het TOTAAL: het verricht-veld blijft staan en de rest = som − verricht (geklemd op 0). Zonder
  // deze tak wordt verricht 0 en rest het hele totaal, en verdubbelt Vast werk de restduur.
  const hasActualPeriods = periods.some((p) => p.kind === 'actual');
  if (!hasActualPeriods && assignment.actualWorkMinutes !== undefined && assignment.actualWorkMinutes > 0) {
    if (assignment.remainingWorkMinutes !== undefined) {
      const total = periods.reduce((acc, p) => acc + p.workMinutes, 0);
      const rest = Math.max(0, total - assignment.actualWorkMinutes);
      if (Math.abs(rest - assignment.remainingWorkMinutes) > 1e-6) { assignment.remainingWorkMinutes = rest; changed = true; }
    }
    return changed;
  }
  if (assignment.remainingWorkMinutes !== undefined) {
    const rest = periods.reduce((acc, p) => acc + (p.kind === 'actual' ? 0 : p.workMinutes), 0);
    if (Math.abs(rest - assignment.remainingWorkMinutes) > 1e-6) { assignment.remainingWorkMinutes = rest; changed = true; }
  }
  if (assignment.actualWorkMinutes !== undefined) {
    const done = periods.reduce((acc, p) => acc + (p.kind === 'actual' ? p.workMinutes : 0), 0);
    if (Math.abs(done - assignment.actualWorkMinutes) > 1e-6) { assignment.actualWorkMinutes = done; changed = true; }
  }
  return changed;
}

/** Eén taakraster-/MCP-batchwijziging op de toewijzingen van één taak, als reeks kernstappen. */
export type AssignmentSettleOp =
  | { kind: 'remove'; assignmentId: string }
  | { kind: 'update'; assignmentId: string; unitsPerDay: number }
  | { kind: 'add'; assignmentId: string; unitsPerDay: number; resourceId: string };

/**
 * Meerdere toewijzingsbewerkingen op één taak in één keer (taakraster: de cel "Resources" kan
 * tegelijk verwijderen, inzet wijzigen en toevoegen; `assignmentPlan.ts`). Aanroepen NÁDAT het
 * plan op `assignments` is toegepast, met de momentopname van daarvóór: de kern loopt de stappen
 * in de toepassingsvolgorde (verwijderen → inzet → toevoegen) door en er volgt één terugschrijf.
 */
export function settleAssignmentPlan(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle | null,
  ops: readonly AssignmentSettleOp[],
): TriangleWriteBack {
  if (!captured || ops.length === 0) return NO_CHANGE;
  let state = captured.state;
  // Volgorde = de toepassingsvolgorde van `applyTaskAssignmentPlan` (verwijderen → inzet →
  // toevoegen). Dat is een BEREDENEERDE keuze: bij "r1 eraf + r2 erbij" in
  // één Resources-cel onder FIXED_WORK gaat het werk van r1 eerst naar de blijvers en wordt daarna
  // naar rato met r2 gedeeld — hetzelfde als twee losse bewerkingen in die volgorde. Bewaakt in
  // `check-work-rule-store.ts` (sectie e).
  const order = { remove: 0, update: 1, add: 2 } as const;
  for (const op of [...ops].sort((a, b) => order[a.kind] - order[b.kind])) {
    let result;
    if (op.kind === 'remove') result = applyAssignmentRemoved(state, op.assignmentId);
    else if (op.kind === 'update') result = applyUnitsEdit(state, op.assignmentId, op.unitsPerDay);
    else {
      const resource = captured.ctx.resourceById?.(op.resourceId);
      result = applyAssignmentAdded(state, {
        id: op.assignmentId, unitsPerDay: op.unitsPerDay, drivesDuration: resource ? resource.type !== 'MATERIAL' : true,
      });
    }
    if (!result.ok) return NO_CHANGE;
    state = result.state;
  }
  return applyTriangleResult(task, assignments, captured.state, state, captured.ctx, { actualWork: captured.actualWork });
}
