// workRuleApply.ts — de BRUG tussen de domeinobjecten (Task/ResourceAssignment/Resource) en de pure
// rekenkern `workTriangle.ts` (taaktypes-ontwerp 2026-09-04 §5/§6/§8; bouwstap 4).
//
// Deze module weet wat de kern niet mag weten: welke regel voor een taak geldt (`Task.workRule`,
// anders `Project.defaultWorkRule`, anders de standaard van vandaag), welk deel van de taak het
// RESTANT is (voortgang), welke toewijzingen de duur sturen (materiaal niet), hoe een restduur in
// minuten terugvertaalt naar `TaskTime` (hele dagen in dagmodus) en wanneer de regel überhaupt van
// toepassing is (spec §8: alleen gewone bladtaken op werktijd en uurtaken — mijlpalen, hangmatten,
// samenvattingen en ELAPSEDTIME-taken blijven byte-identiek).
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
import type { Task } from '@/types/task';
import { DEFAULT_WORK_RULE, type WorkRule } from '@/types/workRule';
import { contourIndexForAssignment, taskWorkMinutes } from '@/engine/contour/contourEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import {
  clearTimephasedDurationWalks, clearTimephasedWindow, rescaleTaskContours, timephasedDurationWalksHaveFrozenWork,
} from '@/utils/taskDefaults';
import {
  applyAssignmentAdded, applyAssignmentRemoved, applyDurationEdit, applyRuleChange, applySlotChange,
  applyUnitsEdit, applyWorkEdit, ruleProtectsWork, type TriangleAssignment, type TriangleState,
} from '@/engine/work/workTriangle';

export interface WorkRuleContext {
  /** Effectieve uren per werkdag van de taak (taakkalender, anders projectkalender). */
  hoursPerDay: number;
  /** `Project.defaultWorkRule`; afwezig ⇒ FIXED_DURATION_RATE. */
  defaultWorkRule?: WorkRule;
  /** Resource-opzoek voor de materiaalgrens (spec §4.3). Onbekend ⇒ telt als werkresource. */
  resourceById?: (id: string) => Resource | undefined;
}

/** De regel die voor deze taak geldt: eigen veld, anders projectstandaard, anders vandaag. */
export function effectiveWorkRule(task: Pick<Task, 'workRule'>, defaultWorkRule?: WorkRule): WorkRule {
  return task.workRule ?? defaultWorkRule ?? DEFAULT_WORK_RULE;
}

/** Bewaard MSP-vinkje voor beslispunt 8-B: alleen betekenisvol op een taak met MSP-herkomst
 *  (`mspTaskType`); daar is "afwezig" letterlijk "niet effort-driven". Zonder herkomst ⇒ zuiver P6. */
export function effectiveEffortDriven(task: Pick<Task, 'mspTaskType' | 'effortDriven'>): boolean | undefined {
  return task.mspTaskType ? (task.effortDriven ?? false) : undefined;
}

/** Spec §8: de regel werkt alleen op gewone bladtaken op werktijd (dag- én uurmodus). */
export function workRuleApplies(task: Task): boolean {
  return task.childIds.length === 0
    && !task.isMilestone
    && task.isHammock !== true
    && task.time.durationType !== 'ELAPSEDTIME';
}

/** Werkminuten per werkdag van de taak. */
export function slotMinutesOf(ctx: Pick<WorkRuleContext, 'hoursPerDay'>): number {
  return Math.max(1, Math.round(ctx.hoursPerDay * 60));
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
    const rem = t.remainingMinutes ?? Math.round(t.durationMinutes * (1 - (t.completion ?? 0)));
    return Math.max(0, rem);
  }
  const days = t.remainingTime ?? Math.round(t.scheduleDuration * (1 - (t.completion ?? 0)));
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
    wholeDays: task.time.durationUnit !== 'hours',
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
  /** Toewijzingen waarvan inzet of restwerk is herschreven. */
  changedAssignmentIds: string[];
}

/**
 * Stap 3: de uitkomst van de kern terugschrijven. De taakduur wordt ALLEEN aangeraakt wanneer de
 * kern een andere restduur teruggeeft dan hij kreeg (`before`), en dan als
 * `verricht deel + nieuwe rest` — het verrichte deel is een feit (spec §6.5). Dagmodus houdt hele
 * dagen (`scheduleDuration` geheel; de kern rondt al naar boven op hele slots), uurmodus minuten.
 * Een aanwezig `remainingTime`/`remainingMinutes` volgt de nieuwe rest. Toewijzingen: `unitsPerDay`
 * en `remainingWorkMinutes` (aanwezig ⇒ geschreven, afwezig ⇒ verwijderd) exact zoals de kern ze
 * teruggeeft. Muteert in-place; retourneert wat er veranderde.
 */
export function applyTriangleResult(
  task: Task,
  assignments: ResourceAssignment[],
  before: TriangleState,
  after: TriangleState,
  ctx: WorkRuleContext,
  opts?: { skipDuration?: boolean },
): TriangleWriteBack {
  const changed: string[] = [];
  for (const next of after.assignments) {
    const a = assignments.find((x) => x.id === next.id);
    if (!a) continue;
    const unitsChanged = Math.abs(a.unitsPerDay - next.unitsPerDay) > 1e-9;
    const workChanged = (a.remainingWorkMinutes === undefined) !== (next.remainingWorkMinutes === undefined)
      || (next.remainingWorkMinutes !== undefined && a.remainingWorkMinutes !== undefined
        && Math.abs(a.remainingWorkMinutes - next.remainingWorkMinutes) > 1e-6);
    if (!unitsChanged && !workChanged) continue;
    // Alleen een door de KERN herleide inzet wordt afgerond; een exact geschreven gebruikersinvoer
    // (de aanroeper schrijft die vóór de settle) blijft staan.
    if (unitsChanged) a.unitsPerDay = Math.round(next.unitsPerDay * 10000) / 10000;
    if (next.remainingWorkMinutes === undefined) delete a.remainingWorkMinutes;
    else a.remainingWorkMinutes = next.remainingWorkMinutes;
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
    // Gestarte taak (spec §6.5, reviewbevinding B2): het verrichte deel is een feit en de REST is wat
    // de kern teruggeeft. Zonder expliciet restveld zou de solver de rest opnieuw afleiden als
    // `nieuwe duur × (1 − completion)` — en dan schuift het verrichte deel mee met de nieuwe duur en
    // drift een heen-en-weer-bewerking (case 31). Daarom wordt de rest bij voortgang > 0 (of een al
    // aanwezig restveld) expliciet geschreven; `completion` blijft zoals ze is. Een ongestarte taak
    // krijgt geen extra veld (byte-identiek).
    const started = (t.completion ?? 0) > 0;
    if (isHourTask(t)) {
      t.durationMinutes = Math.round(newTotal);
      t.scheduleDuration = t.durationMinutes / slot;
      if (started || t.remainingMinutes !== undefined) t.remainingMinutes = Math.max(0, Math.round(after.remainingMinutes));
    } else {
      t.scheduleDuration = Math.max(0, Math.round(newTotal / slot));
      delete t.durationMinutes;
      if (started || t.remainingTime !== undefined) t.remainingTime = Math.max(0, Math.round(after.remainingMinutes / slot));
    }
    durationChanged = true;
  }
  return { durationChanged, changedAssignmentIds: changed };
}

/**
 * Spec besluit 3 ("vorm blijft, hoogte zakt", meetlat 23): verandert de kern het RESTwerk van een
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

/**
 * Herschaalt een contour met werkbehoud onder de werkbeschermende regels (spec §6.3). Zonder eigen
 * `workRule` geldt de oude MSP-afleiding (`mspTaskType === 'FIXED_WORK'`) náást de projectstandaard,
 * zodat een vóór deze etappe opgeslagen MSP-import byte-identiek blijft herschalen.
 */
export function contourKeepsWork(task: Pick<Task, 'workRule' | 'mspTaskType'>, defaultWorkRule?: WorkRule): boolean {
  if (task.workRule !== undefined) return ruleProtectsWork(task.workRule);
  return task.mspTaskType === 'FIXED_WORK' || ruleProtectsWork(defaultWorkRule ?? DEFAULT_WORK_RULE);
}

// ── Hoog-niveau "settle"-API voor store, raster en MCP-tweeling ─────────────────────────────────
//
// Dezelfde drie stappen als hierboven, maar ingepakt per bewerking zodat de vier aanroepplekken
// (taskSlice/resourceSlice, gridTransaction, createMcpTransactions) letterlijk dezelfde regels
// delen. Elke functie muteert in-place en retourneert een `TriangleWriteBack`; `null` betekent
// "de regel is hier niet van toepassing of de kern weigerde" — de aanroeper laat dan zijn
// bestaande gedrag van vandaag staan (byte-identiek).

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
    hoursPerDay: resolveCalendar(task.calendarId, deps.calendars as WorkCalendar[], deps.calendar).hoursPerDay,
    ...(deps.project.defaultWorkRule !== undefined ? { defaultWorkRule: deps.project.defaultWorkRule } : {}),
    resourceById: (id) => resources.find((r) => r.id === id),
  };
}

export interface CapturedTriangle {
  state: TriangleState;
  ctx: WorkRuleContext;
  /** Totale werkminuten van de taak op het moment van de momentopname — de poort van
   *  `settleDurationEdit` (reviewbevinding B1: alleen een DUURwijziging is een duurbewerking). */
  totalMinutes: number;
}

/** Stap 1 als momentopname VÓÓR een mutatie; `null` wanneer de regel niet op deze taak werkt. */
export function captureTriangle(task: Task, assignments: readonly ResourceAssignment[], deps: WorkRuleDeps): CapturedTriangle | null {
  if (!workRuleApplies(task)) return null;
  const ctx = workRuleContextOf(task, deps);
  return { state: triangleStateOf(task, assignments, ctx), ctx, totalMinutes: totalMinutesOf(task, ctx) };
}

const NO_CHANGE: TriangleWriteBack = { durationChanged: false, changedAssignmentIds: [] };

/**
 * Duur gewijzigd (spec §5 rij 1) — aanroepen NÁDAT de aanroeper `task.time` heeft gezet, met de
 * momentopname van daarvóór. De nieuwe restduur wordt uit de taak zelf gelezen; de kern verdeelt
 * er inzet en werk naar. De duur zelf wordt hier NIET herschreven (die is al gezet; in dagmodus is
 * ze al geheel, in uurmodus al in minuten). Onder FIXED_DURATION_RATE zonder werkvelden verandert
 * niets — byte-identiek aan vandaag.
 */
export function settleDurationEdit(task: Task, assignments: ResourceAssignment[], captured: CapturedTriangle | null): TriangleWriteBack {
  if (!captured) return NO_CHANGE;
  // Poort (B1): een voortgangsbewerking (`completion`/`remainingTime`) verandert de REST maar niet
  // de duur — dat is geen duurbewerking (spec §6.5) en raakt de driehoek niet.
  if (Math.abs(totalMinutesOf(task, captured.ctx) - captured.totalMinutes) < 1e-6) return NO_CHANGE;
  const newRemaining = remainingMinutesOf(task, captured.ctx);
  if (Math.abs(newRemaining - captured.state.remainingMinutes) < 1e-6) return NO_CHANGE;
  const result = applyDurationEdit(captured.state, newRemaining);
  if (!result.ok) return NO_CHANGE;
  return applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx, { skipDuration: true });
}

/**
 * Inzet van één toewijzing gewijzigd (spec §5 rij 2) — aanroepen NÁDAT de aanroeper de nieuwe
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
  const result = applyUnitsEdit(captured.state, assignmentId, newUnitsPerDay);
  if (!result.ok) return NO_CHANGE;
  return applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx);
}

/** Een doorgerekende maar nog niet geschreven uitkomst: plannen kan vóór de undo-snapshot, zodat
 *  een weigering geen lege undo-stap achterlaat; `commitTrianglePlan` schrijft daarna. */
export interface TrianglePlan {
  captured: CapturedTriangle;
  after: TriangleState;
}

/** Resterend werk van één toewijzing gezet (spec §5 rij 3), zonder te schrijven.
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
  return applyTriangleResult(task, assignments, plan.captured.state, plan.after, plan.captured.ctx);
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

/** Resource erbij (spec §5 rij 4) — aanroepen NÁDAT de nieuwe toewijzing in `assignments` staat,
 *  met de momentopname van daarvóór (zonder de nieuwe). */
export function settleAssignmentAdded(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle | null,
  added: ResourceAssignment,
): TriangleWriteBack {
  if (!captured) return NO_CHANGE;
  const resource = captured.ctx.resourceById?.(added.resourceId);
  const result = applyAssignmentAdded(captured.state, {
    id: added.id, unitsPerDay: added.unitsPerDay, drivesDuration: resource ? resource.type !== 'MATERIAL' : true,
  });
  if (!result.ok) return NO_CHANGE;
  return applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx);
}

/** Resource eraf (spec §5 rij 5) — momentopname MÉT de te verwijderen toewijzing, aanroepen NÁDAT
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
  return applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx);
}

/** Typewissel (spec §5 rij 6): schrijft `task.workRule` en legt onder een werkbeschermende regel het
 *  huidige restwerk vast; verder verandert geen getal. `undefined` = terug naar de projectstandaard. */
export function settleRuleChange(
  task: Task,
  assignments: ResourceAssignment[],
  deps: WorkRuleDeps,
  rule: WorkRule | undefined,
): TriangleWriteBack {
  const captured = captureTriangle(task, assignments, deps);
  if (rule === undefined) delete task.workRule; else task.workRule = rule;
  if (!captured) return NO_CHANGE;
  const result = applyRuleChange(captured.state, effectiveWorkRule(task, captured.ctx.defaultWorkRule));
  if (!result.ok) return NO_CHANGE;
  return applyTriangleResult(task, assignments, captured.state, result.state, captured.ctx);
}

/**
 * Nazorg wanneer de werkdriehoek de TAAKduur verandert (inzet/werk/resource erbij-eraf onder
 * FIXED_WORK/FIXED_RATE) — dezelfde als bij een duurbewerking in `taskSlice.updateTask`: contour én
 * importsplits herschalen (werkbehoud volgens de regel), Z8-venster en bevroren duur-walks wissen.
 * Eén definitie voor store, raster en MCP (reviewbevinding K5). Retourneert of er timephased-
 * sturing verloren ging (⇒ de aanroeper meldt). `scheduleStale` en de snapshot blijven aan de
 * aanroeper.
 */
export function settleDurationAftermath(task: Task, deps: WorkRuleDeps, oldWorkMinutes: number): boolean {
  const hpd = workRuleContextOf(task, deps).hoursPerDay;
  rescaleTaskContours(task, oldWorkMinutes, hpd, contourKeepsWork(task, deps.project.defaultWorkRule));
  const clearedWindow = clearTimephasedWindow(task);
  const clearedWalks = timephasedDurationWalksHaveFrozenWork(task) && clearTimephasedDurationWalks(task);
  return clearedWindow || clearedWalks;
}

/**
 * Kalenderwissel (eigenaarsbesluit 2026-09-05): aanroepen NÁDAT de kalender van de taak (of de
 * inhoud van haar kalender) is gewijzigd, met de momentopname van daarvóór. Alleen de slotgrootte
 * (uren per dag) telt; de restduur in dagen blijft, en de regel beslist (`applySlotChange`).
 * Uurtaken en een ongewijzigde slot ⇒ niets. Een gewijzigde duur komt terug als `durationChanged`.
 */
export function settleCalendarChange(
  task: Task,
  assignments: ResourceAssignment[],
  captured: CapturedTriangle | null,
  deps: WorkRuleDeps,
): TriangleWriteBack {
  if (!captured || isHourTask(task.time)) return NO_CHANGE;
  const ctx = workRuleContextOf(task, deps);
  const newSlot = slotMinutesOf(ctx);
  if (newSlot === captured.state.slotMinutes) return NO_CHANGE;
  const remainingDays = captured.state.remainingMinutes / captured.state.slotMinutes;
  const newRemaining = remainingDays * newSlot;
  const result = applySlotChange(captured.state, newSlot, newRemaining);
  if (!result.ok) return NO_CHANGE;
  const beforeInNewSlot: TriangleState = { ...captured.state, slotMinutes: newSlot, remainingMinutes: newRemaining };
  return applyTriangleResult(task, assignments, beforeInNewSlot, result.state, ctx);
}

/**
 * Duurbewerking op een taak met EXPLICIETE restduur (eigenaarsbesluit 2026-09-05, spec §6.5): het
 * verrichte deel is een feit, dus wat de gebruiker aan de duur toevoegt of afhaalt landt in de rest
 * (Microsoft: Remaining Duration = Duration − Actual Duration). Rest = max(0, rest + Δ), in dagen
 * (dagmodus, `remainingTime`) of minuten (uurmodus, `remainingMinutes`). `completion` blijft zoals
 * ze is. Aanroepen NÁDAT de nieuwe duur is gezet, met de oude werkminuten (`taskWorkMinutes` vóór
 * de bewerking). Zonder expliciet restveld gebeurt niets (de rest wordt dan afgeleid en schuift
 * vanzelf mee).
 */
export function carryRemainingThroughDurationEdit(task: Task, oldWorkMinutes: number, hoursPerDay: number): boolean {
  const t = task.time;
  const slot = slotMinutesOf({ hoursPerDay });
  if (isHourTask(t)) {
    if (t.remainingMinutes === undefined) return false;
    const delta = t.durationMinutes - oldWorkMinutes;
    if (Math.abs(delta) < 1e-6) return false;
    t.remainingMinutes = Math.max(0, Math.round(t.remainingMinutes + delta));
    return true;
  }
  if (t.remainingTime === undefined) return false;
  const oldDays = Math.round(oldWorkMinutes / slot);
  const delta = t.scheduleDuration - oldDays;
  if (Math.abs(delta) < 1e-6) return false;
  t.remainingTime = Math.max(0, Math.round(t.remainingTime + delta));
  return true;
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
  // toevoegen). Dat is een BEREDENEERDE keuze (reviewbevinding K6): bij "r1 eraf + r2 erbij" in
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
  return applyTriangleResult(task, assignments, captured.state, state, captured.ctx);
}
