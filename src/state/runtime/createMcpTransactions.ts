import type { AppState, AppStoreContext } from '../appStore';
import { attachToParent, isSelfOrDescendant, removeTaskSubtrees, reparentTask } from '@/state/taskTree';
import {
  applyPhaseTransitions, describePhaseRefusal, describePhaseTransitions, firstChildGains, planPhaseTransitions,
  type PhaseTransitionReport,
} from '../structuralTransition';
import { createSnapshot, documentDataChanged, restoreSnapshot, type Snapshot } from '../snapshot';
import { replaceSessionHistoryState } from '../sessionHistory';
import { relationVerdict } from '../relationRules';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import {
  buildNewTask, createDefaultTaskTime, mergeTaskTime, mergeTaskUpdate, taskTriggerChanges,
  taskCalendarHoursPerDay, taskWorkMinutesOf, invalidateForTimeBaseChange, clearLevelingGaps,
  writeLevelingResult, clearLevelingOutput, applyDurationChangeRules,
  contourKeepsWork, hourInputFinishBasis, reconcileHourInputFinish, seedNewHourTaskFinish, type HourInputFinishBasis,
} from '@/utils/taskDefaults';
import { sameValue } from '@/utils/sameValue';
import { applyWbsNumbering } from '@/utils/wbs';
import { assignInsertedWbsCodes } from '../insertedBranch';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { syncProjectCalendar } from '../syncProjectCalendar';
import { notifyTimephasedLoss, notifyLevelingDelayRounded } from '../timephasedLossNotice';
import { notifyWorkRuleDurationsChanged } from '../taskTypesNotice';
import { tasksOnCalendar } from '../calendarTasks';
import type { McpTransactionLease } from './storeRuntime';
import type { DurationType, Task, TimephasedContourPeriod } from '@/types/task';
import {
  acceptedAssignmentPatch, applyAssignmentPatch, contoursAfterEdit, insertAssignment, insertResource,
  purgeResource, relocateAssignment, removeAssignment,
} from '../assignmentMutations';
import { applyTaskSplits, taskSplitRefusal } from '../splitMutations';
import type { SplitPiece, SplitRefusal } from '@/engine/scheduler/splitEdit';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { isValidUnits, type Resource, type ResourceAssignment, type ResourceCurve } from '@/types/resource';
import type { Project } from '@/types/project';
import type { CustomTaskType } from '@/types/taskType';
import type { LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { applyProjectPatch } from '../projectPatch';
import { customTaskTypeClashes } from '@/services/taskTypes/customTaskTypeRules';
import { isThenable } from '@/utils/guards';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { reconcileP6SuspendResume } from '@/utils/p6SuspendResume';
import {
  captureCalendarChange, captureTriangle, carryRemainingThroughDurationEdit, planWorkEdit, commitTrianglePlan,
  captureProgressWork, settleProgressWork, syncAssignmentWorkToContour,
  settleCalendarChange, settleDurationAftermath, settleDurationEdit, settleRuleChange,
} from '@/engine/work/workRuleApply';
import type { WorkRule } from '@/types/workRule';
import { markDocumentEdited } from '@/state/documentEdited';

export type McpTransactionResult<T> =
  | { ok: true; value: T; timephasedGuidanceLost: number }
  | { ok: false; error: string };

type Synchronous<T> = T extends PromiseLike<unknown> ? never : T;

/** Contextgebonden MCP-transactie. De callback blijft strikt synchroon. */
export interface McpTransactions {
  run<T>(fn: () => Synchronous<T>): McpTransactionResult<T>;
  draft: McpDraft;
}

// =================================================================================================
// Draft-primitieven (taak T2, spec §Werkpakket 0 "draft-primitieven vereist voor het hele
// batch-oppervlak").
//
// Elk primitief is een SNAPSHOT-VRIJE, RECOMPUTE-VRIJE variant van de bijbehorende store-actie,
// bedoeld om BINNEN de gebonden `McpTransactions.run` te draaien. Ze roepen bewust NIET `beginUndoable`,
// `finishMutation` of een recompute/`runCPM` aan: de transactie neemt zelf één snapshot vooraf en
// draait éénmaal de eindherberekening. Ze zijn ONAFHANKELIJK van de T1-suppressievlag — ze pushen
// überhaupt geen snapshot, dus of de vlag aan- of uitstaat maakt niet uit (buiten een transactie
// missen ze alleen de undo-stap/recompute, wat correct is: ze horen niet los aangeroepen te worden).
//
// Elk primitief muteert via een eigen `context.store.setState(...)`-Immer-producer (de gekozen
// consistente vorm) en zet `isDirty` (de `finishMutation`-tegenhanger); `scheduleStale` wordt bewust
// NIET gezet — de eind-`runCPM` van de transactie wist die vlag hoe dan ook.
//
// GUARD-SEMANTIEK: waar de store-actie op een triviale foutconditie STIL terugvalt (onbekend id,
// mijlpaal-/samenvattings-doeltaak, ongeldige eenheden), GOOIT het draft-primitief in plaats daarvan
// een herkenbare fout. Binnen een transactie propageert die throw naar de gebonden `run`, die
// schoon terugrolt ({ ok: false, error }); de tool-laag (T4+) vangt 'm en rapporteert per item.
// Rijkere validatie (bv. leaf-only-pre-checks) hoort in T4 — deze throws zijn de laatste vangrail.
// =================================================================================================

/**
 * Eén item van een `draft.addTasks`-bulk (spec §Werkpakket 2). Alle velden die `draft.addTask`
 * accepteert (via `Partial<Task>` — `name`, `time`, `taskType`, …), plus drie bulk-only velden:
 *  - `tempId`  — door de client gekozen, UNIEK binnen de call; wordt de sleutel in de terugmap.
 *  - `parentId` — een ECHT bestaand taak-id ÓF een `tempId` uit dezelfde call (voor geneste aanmaak).
 *  - `position` — insert-index binnen de ouder (`parent.childIds`, of de wortelvolgorde bij `null`);
 *    afwezig ⇒ achteraan. Een out-of-range index klemt STIL naar `[0, lengte]` (negatief ⇒ 0,
 *    te groot ⇒ achteraan) — geen fout; de tool-schema-beschrijving (T19) leunt op deze regel.
 */
export type BulkTaskItem = Partial<Task> & {
  name: string;
  tempId: string;
  position?: number;
};

function createMcpDraft(
  context: AppStoreContext,
  activeLease: () => McpTransactionLease,
) {
  const { store, runtime } = context;
  const recordTimephasedLoss = (taskId: string): void => {
    runtime.recordMcpTimephasedLoss(activeLease(), taskId);
  };

  /** Taaktypes-etappe: nazorg bij een duur uit de werkdriehoek — `settleDurationAftermath` (één
   *  definitie voor store/raster/MCP) plus de verliesmelding via de actieve runtimelease;
   *  `scheduleStale` blijft bewust aan de transactie (zie het docblok hierboven). */
  const afterTriangleDurationChange = (
    s: { calendars: WorkCalendar[]; calendar: WorkCalendar; project: Pick<Project, 'defaultWorkRule'>; resources: Resource[] },
    task: Task,
    oldWorkMinutes: number,
    finishBasis: HourInputFinishBasis,
  ): void => {
    if (settleDurationAftermath(task, s, oldWorkMinutes, finishBasis)) recordTimephasedLoss(task.id);
  };

  const rawDraft = {
  /**
   * Snapshot/recompute-vrije variant van de store-`addTask`: zelfde veld-afleiding (TaskTime-defaults,
   * mijlpaal ⇒ duur 0 tenzij expliciete `time`, anker op `s.project.startDate`, WBS-afleiding,
   * `parent.childIds` gevuld). Retourneert het nieuwe id. Een opgegeven-maar-ONBEKENDE `parentId`
   * valt hier NIET stil op root terug (zoals de UI-`position`-tolerantie) maar GOOIT — een batch die
   * naar een niet-bestaande ouder wijst is een fout, niet een stille root-taak.
   */
  addTask(partial: Partial<Task> & { name: string }): string {
    const id = generateId('task');
    store.setState((s) => {
      const now = s.project.startDate || formatDate(new Date());
      const parentId = partial.parentId ?? null;
      // Onbekende parentId ⇒ herkenbare fout (VÓÓR enige mutatie, dus geen halve state).
      const parentTask = parentId !== null ? s.tasks.find((t) => t.id === parentId) : undefined;
      if (parentId !== null && !parentTask) {
        throw new Error(`draft.addTask: onbekende parentId '${parentId}'`);
      }
      // Zelfde veld-afleiding (incl. taaktype-overerving) als de store-`addTask`: `buildNewTask`.
      // De Z0-typecontractvelden zijn niet via de `taskFields.ts`-allowlist zetbaar (REJECT_HINTS);
      // ze gaan alleen mee voor aanroepers die een `Partial<Task>` rechtstreeks doorgeven.
      const task = buildNewTask(partial, {
        id, parentId, parentTask, constructionMode: s.ui.constructionMode,
        time: mergeTaskTime(createDefaultTaskTime(now, partial.isMilestone ? 0 : 5), partial.time),
      });
      // B1-vervolg — tweeling van taskSlice.ts addTask: het ingevoerde einde van een nieuwe urentaak.
      seedNewHourTaskFinish(task, partial.time, resolveCalendar(task.calendarId, s.calendars, s.calendar));
      if (partial.workRule !== undefined) s.taskTypesVisible = true; // review K3

      s.tasks.push(task);
      if (parentId) attachToParent(s.tasks, id, parentId);

      // WBS: auto-nummering ⇒ hele boom; anders alleen een afgeleide code wanneer de aanroeper er
      // zelf geen meegaf (zelfde regel als de store-`addTask`).
      if (s.project.wbsAutoNumber || !partial.wbsCode) assignInsertedWbsCodes(s, [id]);

      markDocumentEdited(s);
    });
    return id;
  },

  /**
   * Geneste WBS in ÉÉN aanroep (spec §Werkpakket 2). Maakt een reeks taken aan die naar elkaar mogen
   * verwijzen via client-gekozen `tempId`'s, en retourneert de VOLLEDIGE `tempId`→`realId`-map van
   * álle aangemaakte taken (ook diep genest). Bedoeld om BINNEN de gebonden `run` te draaien (net
   * als de andere draft-primitieven: geen eigen snapshot/recompute).
   *
   * PRE-VALIDATIE (VÓÓR de eerste `draft.addTask`-aanroep — een falende batch laat NUL taken achter;
   * de transactie rolt sowieso terug, maar de pre-check maakt de fout goedkoop en de message precies):
   *   - dubbele `tempId` binnen de call ⇒ throw;
   *   - `parentId` die geen bestaand taak-id én geen `tempId` uit de call is ⇒ throw (noemt de boosdoener);
   *   - mijlpaal met een expliciete `time` van duur > 0 ⇒ throw (WP7-regel, hier als aanmaak-validatie);
   *   - cykel in `tempId`-parents (a onder b, b onder a) ⇒ throw.
   *
   * AANMAAK is TOP-DOWN: de items worden topologisch gesorteerd zodat een ouder altijd vóór zijn
   * kinderen wordt aangemaakt (tempId-parents mogen in willekeurige — ook omgekeerde — inputvolgorde
   * staan). Elk item loopt via `draft.addTask` (append), met de `tempId`-parent vertaald naar het echte
   * id uit de tot dan toe opgebouwde map.
   *
   * POSITIE: `position` is de insert-index binnen `parent.childIds` (of de wortelvolgorde bij een
   * `null`-ouder). Om `childIds`-volgorde (zichtbaar, visibleRows.ts) én rauwe-array-volgorde (WBS-
   * nummering, wbs.ts/flattenOrder) consistent te houden — precies zoals de store-`addTask` met een
   * anker doet — worden BEIDE bijgewerkt. Een out-of-range `position` klemt STIL naar `[0, lengte]`
   * (negatieve index ⇒ 0, index > aantal siblings ⇒ achteraan) — dit is bewust geen fout. Items met
   * een positie worden in INPUTvolgorde toegepast (meerdere posities in dezelfde ouder stapelen dus
   * voorspelbaar).
   */
  addTasks(items: BulkTaskItem[], phaseReport?: PhaseTransitionReport[]): Map<string, string> {
    // Welke bestaande taken zijn nu nog blad? Krijgt er één in deze call kinderen, dan wordt hij
    // een fase — zie "Wordt fase" onderaan.
    const leafIdsBefore = new Set(store.getState().tasks.filter((t) => t.childIds.length === 0).map((t) => t.id));

    // ---- Pre-validatie (VÓÓR enige mutatie) ----------------------------------------------------
    // 1) Dubbele tempId's binnen de call.
    const tempIds = new Set<string>();
    for (const item of items) {
      if (tempIds.has(item.tempId)) {
        throw new Error(`draft.addTasks: dubbele tempId '${item.tempId}' binnen de call`);
      }
      tempIds.add(item.tempId);
    }

    // 2) Elke parentId moet een bestaand taak-id ÓF een tempId uit de call zijn.
    const existingIds = new Set(store.getState().tasks.map((t) => t.id));
    for (const item of items) {
      const p = item.parentId ?? null;
      if (p !== null && !existingIds.has(p) && !tempIds.has(p)) {
        throw new Error(
          `draft.addTasks: onbekende parentId '${p}' (geen bestaand taak-id en geen tempId uit de call)`,
        );
      }
    }

    // 3) Mijlpaal met expliciete duur > 0 (WP7: een mijlpaal is per definitie duur 0).
    for (const item of items) {
      if (item.isMilestone && item.time && item.time.scheduleDuration > 0) {
        throw new Error(
          `draft.addTasks: mijlpaal '${item.tempId}' mag geen duur > 0 hebben (scheduleDuration=${item.time.scheduleDuration})`,
        );
      }
    }

    // 4) Topologische sort (ouders vóór kinderen) met cykeldetectie op tempId-parents.
    const byTempId = new Map(items.map((it) => [it.tempId, it]));
    const visitState = new Map<string, 1 | 2>(); // 1 = in behandeling, 2 = klaar
    const sorted: BulkTaskItem[] = [];
    const visit = (item: BulkTaskItem) => {
      const st = visitState.get(item.tempId);
      if (st === 2) return;
      if (st === 1) throw new Error(`draft.addTasks: cykel in tempId-parents rond '${item.tempId}'`);
      visitState.set(item.tempId, 1);
      const p = item.parentId ?? null;
      if (p !== null && tempIds.has(p)) visit(byTempId.get(p)!);
      visitState.set(item.tempId, 2);
      sorted.push(item);
    };
    for (const item of items) visit(item);

    // ---- Aanmaak (top-down, via draft.addTask) -------------------------------------------------
    const idMap = new Map<string, string>();
    for (const item of sorted) {
      // tempId/position zijn bulk-only; de rest is een gewoon draft.addTask-payload.
      const { tempId, position: _position, parentId, ...taskFields } = item;
      const rawParent = parentId ?? null;
      // Een tempId-parent vertalen naar zijn echte id; een bestaand id blijft zichzelf.
      const resolvedParent =
        rawParent !== null && idMap.has(rawParent) ? idMap.get(rawParent)! : rawParent;
      const realId = rawDraft.addTask({ ...taskFields, parentId: resolvedParent });
      idMap.set(tempId, realId);
    }

    // ---- Positie (in INPUTvolgorde) ------------------------------------------------------------
    const positioned = items.filter((it) => it.position !== undefined);
    if (positioned.length > 0) {
    store.setState((s) => {
        for (const item of positioned) {
          const id = idMap.get(item.tempId)!;
          const task = s.tasks.find((t) => t.id === id);
          if (!task) continue;
          const pos = item.position!;

          if (task.parentId) {
            const parent = s.tasks.find((t) => t.id === task.parentId);
            if (!parent) continue;
            // childIds: uit de huidige slot halen en op de geklemde index herinvoegen.
            const curChild = parent.childIds.indexOf(id);
            if (curChild >= 0) parent.childIds.splice(curChild, 1);
            const clamped = Math.max(0, Math.min(pos, parent.childIds.length));
            parent.childIds.splice(clamped, 0, id);
            // Rauwe array: sibling-array-volgorde gelijktrekken met childIds (flattenOrder/WBS leest
            // array-volgorde onder de ouder). De taak vóór de opvolgende sibling inschuiven (of ná de
            // voorgaande sibling / direct ná de ouder als enig kind).
            const curArr = s.tasks.findIndex((t) => t.id === id);
            const [obj] = s.tasks.splice(curArr, 1);
            const nextId = parent.childIds[clamped + 1];
            let insertAt: number;
            if (nextId !== undefined) {
              insertAt = s.tasks.findIndex((t) => t.id === nextId);
            } else {
              const prevId = parent.childIds[clamped - 1];
              insertAt =
                prevId !== undefined
                  ? s.tasks.findIndex((t) => t.id === prevId) + 1
                  : s.tasks.findIndex((t) => t.id === task.parentId) + 1;
            }
            s.tasks.splice(insertAt, 0, obj);
          } else {
            // Wortel: de zichtbare/WBS-wortelvolgorde IS de array-volgorde onder de wortels.
            const curArr = s.tasks.findIndex((t) => t.id === id);
            const [obj] = s.tasks.splice(curArr, 1);
            const rootIds = s.tasks.filter((t) => !t.parentId).map((t) => t.id);
            const clamped = Math.max(0, Math.min(pos, rootIds.length));
            const nextRootId = rootIds[clamped];
            const insertAt =
              nextRootId !== undefined ? s.tasks.findIndex((t) => t.id === nextRootId) : s.tasks.length;
            s.tasks.splice(insertAt, 0, obj);
          }
        }
        // WBS-auto-nummering herafleiden nu de volgorde definitief is (spiegelt draft.addTask).
        if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
        markDocumentEdited(s);
      });
    }

    // ---- Wordt fase (audit taakmutaties §6) ---------------------------------------------------
    // Pas NA aanmaak en positie: dan staan alle nieuwe kinderen in hun eindvolgorde en kiest de
    // gedeelde regel (`structuralTransition.ts`) de eerste nieuwe subtaak die toewijzingen mag
    // dragen. Een weigering gooit — de transactie rolt dan alles terug. Geen UI-melding: het rapport
    // gaat via `phaseReport` naar het tool-antwoord.
    store.setState((s) => {
      const gains = s.tasks
        .filter((t) => leafIdsBefore.has(t.id) && t.childIds.length > 0)
        .map((t) => ({ phaseId: t.id, childIds: [...t.childIds] }));
      if (gains.length === 0) return;
      const plan = planPhaseTransitions(s, gains);
      if (!plan.ok) throw new Error(describePhaseRefusal(s, plan.refusal));
      for (const lostId of applyPhaseTransitions(s, plan.transitions)) recordTimephasedLoss(lostId);
      phaseReport?.push(...describePhaseTransitions(s, plan.transitions));
    });

    return idMap;
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`moveTask` (`planner_move_task`): dezelfde
   * verhanging (`reparentTask`) en dezelfde "wordt fase"-regel (`structuralTransition.ts`) — krijgt
   * de nieuwe ouder hierdoor zijn eerste kind terwijl hij toewijzingen draagt, dan verhuizen die naar
   * de verplaatste taak, of weigert de verhanging. Geen UI-melding: het rapport komt terug voor het
   * tool-antwoord. Onbekende taak/ouder of een kring GOOIT (de toollaag toetst dat al vooraf).
   */
  moveTask(id: string, newParentId: string | null, position?: number): PhaseTransitionReport[] {
    let reports: PhaseTransitionReport[] = [];
    store.setState((s) => {
      if (!s.tasks.some((t) => t.id === id)) throw new Error(`draft.moveTask: onbekende taak '${id}'`);
      if (newParentId !== null) {
        if (!s.tasks.some((t) => t.id === newParentId)) throw new Error(`draft.moveTask: onbekende ouder '${newParentId}'`);
        if (isSelfOrDescendant(s.tasks, newParentId, id)) {
          throw new Error(`draft.moveTask: '${id}' kan niet onder zichzelf of een eigen afstammeling`);
        }
      }
      const plan = planPhaseTransitions(s, firstChildGains(s.tasks, [{ childId: id, parentId: newParentId }]));
      if (!plan.ok) throw new Error(describePhaseRefusal(s, plan.refusal));
      reparentTask(s.tasks, id, newParentId, position);
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      for (const lostId of applyPhaseTransitions(s, plan.transitions)) recordTimephasedLoss(lostId);
      reports = describePhaseTransitions(s, plan.transitions);
      markDocumentEdited(s);
    });
    return reports;
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`addSequence`: dezelfde lokale regels als de
   * store-actie, uit `relationRules.ts` (`relationVerdict`: dedup op predecessor+successor+type —
   * meerdere relatietypes tussen hetzelfde paar blijven toegestaan — plus self/onbekende-taak/
   * voorouder-eindpunt). Dit was een handgeschreven kopie van alleen de dedup-regel; die kopie is
   * precies waarom validatie in de slice-actie de MCP-laag zou overslaan. De kringtoets van de
   * store-route (`relationAddVerdict`) zit hier bewust niet: de MCP-tools toetsen een kring vooraf
   * over de hele batch (`validate.noCycle`) en de eindberekening van de transactie rolt een kring
   * alsnog terug. Retourneert het nieuwe id, of `null` wanneer de relatie is geweigerd.
   */
  addSequence(seq: Omit<Sequence, 'id'>): string | null {
    const id = generateId('seq');
    let result: string | null = null;
    store.setState((s) => {
      const lookup = (tid: string) => s.tasks.find((t) => t.id === tid);
      if (!relationVerdict(lookup, s.sequences, seq).ok) return; // result blijft null
      s.sequences.push({ ...seq, id });
      markDocumentEdited(s);
      result = id;
    });
    return result;
  },

  /**
   * Kale veld-merge op een taak (snapshot/recompute-vrij), ZONDER de voortgangsinvarianten — die
   * lopen in T4 via de dedicated invariant-setters. Onbekend id ⇒ stille no-op (zoals de store-
   * `updateTask`); geen throw, want een leeg-effect-merge is geen structurele fout.
   *
   * `time` wordt bewust GEMERGED in plaats van vervangen: een `Object.assign` van de hele `time`-tak
   * wiste anders in één klap de CPM-datums, floats, actuals en completion van elke sleutel die de
   * aanroeper niet toevallig meestuurde. De MCP-toollaag zet `time` sowieso niet meer rechtstreeks
   * (zie `patchTaskFields` + `taskFields.ts`); deze merge is de vangrail voor elke andere aanroeper.
   * T14b-vervolg: `mergeTaskTime` (basis = de BESTAANDE tijd, zie de docstring daar) i.p.v. een kale
   * `Object.assign` — die liet een expliciet-`undefined`-sleutel (bv. van een ongetypeerde aanroeper)
   * nog steeds een verplicht veld overschrijven; `mergeTaskTime` beschermt die klasse expliciet.
   */
  updateTaskFields(id: string, updates: Partial<Task>): void {
    store.setState((s) => {
      const idx = s.tasks.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const task = s.tasks[idx];
      const next = mergeTaskUpdate(task, updates);
      // Per saldo niets gewijzigd ⇒ no-op, net als taskSlice.ts's `updateTask`: geen mutatie, geen
      // gevolgregel en geen `isDirty`. (De undo-stap en de herberekening zijn van de transactie.)
      if (sameValue(task, next)) return;
      // Taaktypes-etappe (reviewbevinding K1) — tweeling van taskSlice.ts's `updateTask`: `workRule`
      // loopt via `settleRuleChange`, niet via de kale merge.
      const { time, workRule, calendarId, ...rest } = updates;
      // B1-vervolg — tweeling van taskSlice.ts's `updateTask`: de basis VÓÓR de K2-kalenderstap
      // (integratie #101, valkuil b), anders ziet de reconcile de kalenderwissel niet.
      const finishBasis = hourInputFinishBasis(task);
      // K2 — tweeling van taskSlice.ts's `updateTask`: kalenderwissel eerst en apart.
      const calendarChanged = 'calendarId' in updates && task.calendarId !== calendarId;
      let lost = false;
      if (calendarChanged) {
        const before = captureCalendarChange(task, s.assignments, s);
        task.calendarId = calendarId;
        lost = settleCalendarChange(task, s.assignments, before, s).timephasedLost;
      }
      // WANNEER de gevolgregels vuren: op een ECHT gewijzigde waarde, niet op een meegestuurde
      // sleutel — dezelfde poort als taskSlice.ts's `updateTask`, zie `taskTriggerChanges`; gemeten
      // ná de kalenderstap, zoals daar.
      const afterRest = mergeTaskUpdate(task, time ? { ...rest, time } : rest);
      const changes = taskTriggerChanges(task, afterRest);
      const contourHpd = taskCalendarHoursPerDay(task, s.calendars, s.calendar);
      const oldWorkMinutes = taskWorkMinutesOf(task, contourHpd);
      // Taaktypes-etappe (bouwstap 4) — tweeling van taskSlice.ts's `updateTask`: momentopname vóór.
      const triangle = changes.timeBase ? captureTriangle(task, s.assignments, s) : null;
      const progressWork = time ? captureProgressWork(task, s) : null; // bevinding 1 — tweeling
      const restBefore = [task.time.remainingTime, task.time.remainingMinutes];
      Object.assign(task, rest);
      if (time) task.time = afterRest.time;
      if (changes.timeBase) {
        // Eigenaarsbesluit 2026-09-05 — tweeling van taskSlice.ts: rest schuift mee, tenzij de patch 'm zelf zette.
        const restUntouched = task.time.remainingTime === restBefore[0] && task.time.remainingMinutes === restBefore[1];
        if (restUntouched) carryRemainingThroughDurationEdit(task, oldWorkMinutes, contourHpd);
        // Duur-/datumwijziging: dezelfde gevolgregels als taskSlice.ts's `updateTask` en het taakraster,
        // zie `applyDurationChangeRules` in taskDefaults.ts (kern van `settleDurationAftermath`).
        lost = applyDurationChangeRules(task, oldWorkMinutes, contourHpd, {
          keepWork: contourKeepsWork(task, s.project.defaultWorkRule),
        }) || lost;
        settleDurationEdit(task, s.assignments, triangle);
      }
      settleProgressWork(task, s.assignments, progressWork);
      if ('workRule' in updates && task.workRule !== workRule) {
        settleRuleChange(task, s.assignments, s, workRule);
        if (workRule !== undefined) s.taskTypesVisible = true; // review K3
      }
      reconcileP6SuspendResume(task);
      // Z14b — een kalenderwissel ontkoppelt ook het Z8-venster (zelfde triggerset/uitleg in `taskDefaults.ts`).
      if (calendarChanged) lost = invalidateForTimeBaseChange(task) || lost;
      // mpp-nul-data-etappe, DEEL 1 — meld alleen bij een ECHT verlies via de actieve runtimelease.
      if (lost) recordTimephasedLoss(id);
      // B1c-plan3 taak 3 (spec §4, "Invalidatie"): een bewerking die de tijdbasis van de taak verzet,
      // maakt ook een door de nivelleerder ingevoegde pauzedag ongeldig — het gat ligt dan op een
      // verouderde tijd-as. Importsplits (gaten zonder `source`) zijn brondata en blijven staan;
      // `clearLevelingGaps` doet dat onderscheid. GEEN melding: anders dan de M10-afronding hierboven
      // is dit geen verlies van gebruikersdata uit een importbestand maar het opruimen van app-eigen
      // afgeleide nivelleeruitvoer op een as die de aanroeper zelf zojuist heeft verzet.
      // EIGEN, BREDERE poort sinds de fixronde op etappe 3 (bevinding B7) — gedocumenteerde tweeling
      // van taskSlice.ts's `updateTask`; zie `LEVELING_GAP_TIME_TRIGGERS` in taskDefaults.ts.
      if (changes.levelingGaps || calendarChanged) clearLevelingGaps(task);
      // B1-vervolg — tweeling van taskSlice.ts's `updateTask`: het ingevoerde einde beweegt mee,
      // bewust NA `clearLevelingGaps` (anders telt het einde gewiste nivelleergaten mee).
      reconcileHourInputFinish(task, finishBasis, resolveCalendar(task.calendarId, s.calendars, s.calendar));
      markDocumentEdited(s);
    });
  },

  /**
   * VELD-VOOR-VELD-patch op een taak (snapshot/recompute-vrij): top-level velden plus expliciet
   * benoemde `time`-SLEUTELS. Bedoeld voor de MCP-toollaag, die zijn invoer eerst door de allowlist
   * van `services/mcp/tools/taskFields.ts` haalt.
   *
   * Verschil met `updateTaskFields`: hier kan een aanroeper per constructie geen hele geneste tak
   * meegeven — `timePatch` kent alleen `scheduleDuration`, `durationType` en de expliciete
   * `durationUnit` en `clearDurationMinutes`. Dat laatste is nodig omdat `durationMinutes` bij een
   * urentaak de BRON
   * VAN WAARHEID is (`durationDaysOf`): een achtergebleven minutenwaarde zou een zojuist gezette
   * dag-duur stil overrulen. `delete` (niet `= undefined`) houdt het Task-object schoon voor de
   * IFC-round-trip. Onbekend id ⇒ stille no-op (zoals `updateTaskFields`).
   */
  patchTaskFields(
    id: string,
    top: Partial<Task>,
    timePatch?: { scheduleDuration?: number; durationUnit?: 'days' | 'hours'; durationMinutes?: number; durationType?: DurationType; clearDurationMinutes?: boolean },
  ): void {
    store.setState((s) => {
      const idx = s.tasks.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const task = s.tasks[idx];
      // `timePatch` zet losse `time`-sleutels op een kopie (`clearDurationMinutes` verwijdert de
      // sleutel — `delete`, niet `= undefined`, voor de IFC-round-trip).
      const patchTime = (base: Task['time']): Task['time'] => {
        const time = { ...base };
        if (!timePatch) return time;
        if (timePatch.scheduleDuration !== undefined) time.scheduleDuration = timePatch.scheduleDuration;
        if (timePatch.durationUnit !== undefined) time.durationUnit = timePatch.durationUnit;
        if (timePatch.durationMinutes !== undefined) time.durationMinutes = timePatch.durationMinutes;
        if (timePatch.durationType !== undefined) time.durationType = timePatch.durationType;
        if (timePatch.clearDurationMinutes) delete time.durationMinutes;
        return time;
      };
      // De taak zoals de patch haar achterlaat, eerst op een kopie (muteert niets): `top` overschrijft
      // top-level waarden, `timePatch` de losse sleutels. Per saldo niets gewijzigd ⇒ no-op, zie
      // `updateTaskFields` hierboven (geen `isDirty`).
      const next: Task = { ...task, ...top };
      next.time = patchTime(next.time);
      if (sameValue(task, next)) return;
      const { workRule, calendarId, ...topRest } = top;
      // B1-vervolg — basis VÓÓR de K2-kalenderstap (integratie #101, valkuil b), zie `updateTaskFields`.
      const finishBasis = hourInputFinishBasis(task);
      // K2 — zelfde kalenderstap als `updateTaskFields` hierboven, vóór de momentopname voor de duur.
      const calendarChanged = 'calendarId' in top && task.calendarId !== calendarId;
      let lost = false;
      if (calendarChanged) {
        const before = captureCalendarChange(task, s.assignments, s);
        task.calendarId = calendarId;
        lost = settleCalendarChange(task, s.assignments, before, s).timephasedLost;
      }
      // WANNEER de gevolgregels vuren: op een ECHT gewijzigde waarde, niet op een meegestuurde
      // sleutel — dezelfde poort als `updateTaskFields` hierboven en taskSlice.ts's `updateTask`, zie
      // `taskTriggerChanges`. `planner_update_tasks` met exact de huidige duur laat de MSP-sturing
      // dus staan. Gemeten ná de kalenderstap.
      const patchedTime = patchTime(topRest.time ?? task.time);
      const changes = taskTriggerChanges(task, { ...task, ...topRest, time: patchedTime });
      // Reviewbevinding F2: de referentie voor Δ-rest en contourherschaling ná de kalenderstap
      // (die kan de duur al verschoven hebben), precies zoals `updateTaskFields`.
      const contourHpd = taskCalendarHoursPerDay(task, s.calendars, s.calendar);
      const oldWorkMinutes = taskWorkMinutesOf(task, contourHpd);
      // Taaktypes-etappe (bouwstap 4) — zelfde momentopname als `updateTaskFields` hierboven.
      const triangle = changes.timeBase ? captureTriangle(task, s.assignments, s) : null;
      const restBefore = [task.time.remainingTime, task.time.remainingMinutes];
      Object.assign(task, topRest);
      task.time = patchedTime;
      if (changes.timeBase) {
        // Reviewbevinding F8 — zelfde `restUntouched`-poort als `updateTaskFields`: `top.time` past in
        // `Partial<Task>`, dus een aanroeper kan de rest zelf zetten; die schuift dan niet óók nog.
        const restUntouched = task.time.remainingTime === restBefore[0] && task.time.remainingMinutes === restBefore[1];
        if (restUntouched) carryRemainingThroughDurationEdit(task, oldWorkMinutes, contourHpd);
        // Duurwijziging: dezelfde gevolgregels als `updateTaskFields` hierboven, zie
        // `applyDurationChangeRules` in taskDefaults.ts (inclusief het wissen van de nivelleergaten, B7).
        lost = applyDurationChangeRules(task, oldWorkMinutes, contourHpd, {
          keepWork: contourKeepsWork(task, s.project.defaultWorkRule),
        }) || lost;
        settleDurationEdit(task, s.assignments, triangle);
      }
      // Reviewbevinding K1: `workRule` via de driehoek-bewuste route, ná de duurpatch.
      if ('workRule' in top && task.workRule !== workRule) {
        settleRuleChange(task, s.assignments, s, workRule);
        if (workRule !== undefined) s.taskTypesVisible = true; // review K3
      }
      reconcileP6SuspendResume(task);
      // Z14b — een kalenderwissel ontkoppelt het Z8-venster, zie `updateTaskFields` hierboven.
      if (calendarChanged) lost = invalidateForTimeBaseChange(task) || lost;
      if (lost) recordTimephasedLoss(id); // zie `updateTaskFields` hierboven.
      // B1c-plan3 taak 3 (spec §4, "Invalidatie") — zie `updateTaskFields` hierboven voor de
      // motivering (geen melding: app-eigen afgeleide uitvoer, geen importverlies). `timePatch` kent
      // geen voortgangsvelden; de `time`-kant zat al in `applyDurationChangeRules`, de top-level
      // triggers (`calendarId`, `constraint`, `constraint2`) lopen via dezelfde poort (B7).
      if (changes.levelingGaps || calendarChanged) clearLevelingGaps(task);
      // B1-vervolg — zie `updateTaskFields` hierboven (ná `clearLevelingGaps`).
      reconcileHourInputFinish(task, finishBasis, resolveCalendar(task.calendarId, s.calendars, s.calendar));
      markDocumentEdited(s);
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`setTaskSplits` (issue #146), met hetzelfde
   * lichaam (`splitMutations.ts`). Onbekend id ⇒ fout (guard-semantiek hierboven). Een inhoudelijke
   * weigering komt, zoals bij de store-actie, terug als `SplitRefusal` zonder dat er iets geschreven
   * is; de toollaag maakt er een VALIDATION van. Verloren MSP-sturing (laag 3/4) gaat via de actieve
   * runtimelease (zoals `patchTaskFields`), zodat de envelop `timephasedGuidanceLost` draagt en de
   * transactie pas bij succes één keer meldt.
   */
  setTaskSplits(taskId: string, pieces: SplitPiece[] | null): SplitRefusal | null {
    let refusal: SplitRefusal | null = null;
    store.setState((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error(`draft.setTaskSplits: onbekende taskId '${taskId}'`);
      const hoursPerDay = taskCalendarHoursPerDay(task, s.calendars, s.calendar);
      refusal = taskSplitRefusal(task, pieces, hoursPerDay);
      if (refusal) return;
      if (applyTaskSplits(s, task, pieces, hoursPerDay)) recordTimephasedLoss(taskId);
      markDocumentEdited(s);
    });
    return refusal;
  },

  /** Materialiseer de snapshot tegelijk met de taakmutatie; bestaande ids zijn onveranderlijk. */
  ensureCustomTaskType(type: CustomTaskType): void {
    store.setState((s) => {
      const normalized = { id: type.id.trim(), name: type.name.trim() };
      if (!normalized.id || !normalized.name) throw new Error('draft.ensureCustomTaskType: id en naam mogen niet leeg zijn');
      const { sameId, sameNameOtherId } = customTaskTypeClashes(s.customTaskTypes, normalized);
      if (sameId) {
        if (sameId.name !== normalized.name) throw new Error(`draft.ensureCustomTaskType: id '${normalized.id}' heeft al naam '${sameId.name}'`);
        return;
      }
      if (sameNameOtherId) throw new Error(`draft.ensureCustomTaskType: naam '${normalized.name}' heeft al id '${sameNameOtherId.id}'`);
      s.customTaskTypes.push(normalized);
      markDocumentEdited(s);
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`deleteTask`: verwijdert de taak + al haar
   * (klein)kinderen recursief, en ruimt relaties, assignments, selectie, actieve taak én de
   * `childIds`-verwijzing bij de ouder op (`removeTaskSubtrees`). Onbekend id ⇒ stille no-op (zoals
   * de store).
   */
  deleteTask(id: string): void {
    store.setState((s) => {
      if (!s.tasks.some((t) => t.id === id)) return;
      removeTaskSubtrees(s, [id]);
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      markDocumentEdited(s);
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`addCalendar`: voegt een bibliotheek-kalender toe
   * en houdt de gedenormaliseerde projectkalender-cache (`s.calendar`) in sync (`syncProjectCalendar`,
   * §9.1 — dat is cache-sync, geen snapshot/recompute). Retourneert het nieuwe id.
   */
  addCalendar(cal: Omit<WorkCalendar, 'id'>): string {
    const id = generateId('cal');
    store.setState((s) => {
      s.calendars.push({ ...cal, id });
      syncProjectCalendar(s);
      markDocumentEdited(s);
    });
    return id;
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`updateCalendar`: merge-t velden op een
   * bibliotheek-kalender en synct de projectkalender-cache (§9.1). Onbekend id ⇒ herkenbare fout
   * (de tool-laag WP5 valideert dat vooraf; dit is de vangrail).
   */
  updateCalendar(id: string, updates: Partial<WorkCalendar>): void {
    let changed = 0;
    store.setState((s) => {
      const idx = s.calendars.findIndex((c) => c.id === id);
      if (idx < 0) throw new Error(`draft.updateCalendar: onbekende kalender-id '${id}'`);
      // K2 — tweeling van resourceSlice.ts's `updateCalendar`: momentopnamen vóór de mutatie.
      const affected = tasksOnCalendar(s, id).map((task) => ({ task, before: captureCalendarChange(task, s.assignments, s) }));
      Object.assign(s.calendars[idx], updates);
      syncProjectCalendar(s);
      for (const { task, before } of affected) {
        const settled = settleCalendarChange(task, s.assignments, before, s);
        if (settled.durationChanged) changed++;
        if (settled.timephasedLost) recordTimephasedLoss(task.id);
      }
      markDocumentEdited(s);
    });
    if (changed > 0) notifyWorkRuleDurationsChanged(context.store.getState().notify, changed);
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`addResource`. Retourneert het nieuwe id. De
   * eenheden-guard (§2.4) is hier — net als bij `assignResource` — een FOUT i.p.v. een stille
   * terugval: een resource met 0/negatieve capaciteit is nooit bedoeld. Dezelfde paletkleur-default
   * als de store-actie (`insertResource`); vroeger kreeg een via MCP aangemaakte resource geen kleur.
   */
  addResource(res: Omit<Resource, 'id'>): string {
    const id = generateId('res');
    store.setState((s) => {
      if (!isValidUnits(res.maxUnits)) {
        throw new Error(`draft.addResource: ongeldige maxUnits ${String(res.maxUnits)} (strikt positief vereist)`);
      }
      insertResource(s, res, id);
      markDocumentEdited(s);
    });
    return id;
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`updateResource`. Onbekend id ⇒ herkenbare fout
   * (de store-actie valt stil terug; de tool-laag pre-valideert, dit is de vangrail).
   *
   * TWEE BEWUSTE AFWIJKINGEN van de store-actie:
   *   1. GEEN "weigeren-met-behoud" op `maxUnits`. De UI filtert een ongeldige capaciteit stil uit de
   *      patch (comfort bij tikken in een invoerveld); via de bridge zou dat precies het veld stil
   *      laten verdampen dat de aanroeper wilde zetten — dus fout.
   *   2. Een sleutel met waarde `undefined` VERWIJDERT het veld (`delete`) i.p.v. het op `undefined`
   *      te zetten. Zo is een gewist optioneel veld (`costPerHour`, `calendarId`, …) niet te
   *      onderscheiden van een veld dat er nooit was — dat houdt het object schoon voor de
   *      IFC-round-trip (zelfde regel als `patchTaskFields`).
   */
  updateResource(id: string, updates: Partial<Resource>): void {
    store.setState((s) => {
      const idx = s.resources.findIndex((r) => r.id === id);
      if (idx < 0) throw new Error(`draft.updateResource: onbekende resource-id '${id}'`);
      if ('maxUnits' in updates && !isValidUnits(updates.maxUnits)) {
        throw new Error(`draft.updateResource: ongeldige maxUnits ${String(updates.maxUnits)} (strikt positief vereist)`);
      }
      const target = s.resources[idx] as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) delete target[key];
        else target[key] = value;
      }
      markDocumentEdited(s);
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`removeResource`: verwijdert de resource, ÁL zijn
   * toewijzingen, de verweesde `task.resourceIds`-verwijzingen en het ploeg-lidmaatschap van zijn
   * leden (`parentId`). Onbekend id ⇒ herkenbare fout.
   *
   * Retourneert het VOLLEDIGE voor/na-verschil, zodat de tool-laag exact kan rapporteren wat er
   * meeging in plaats van het te schatten (audit-bevinding M1 bij `delete_tasks`: een cascade die
   * niet volledig gerapporteerd wordt, leest als "er is niets anders gebeurd").
   */
  removeResource(id: string): {
    removedAssignmentIds: string[];
    affectedTaskIds: string[];
    orphanedCrewMemberIds: string[];
  } {
    const report = { removedAssignmentIds: [] as string[], affectedTaskIds: [] as string[], orphanedCrewMemberIds: [] as string[] };
    store.setState((s) => {
      if (!s.resources.some((r) => r.id === id)) {
        throw new Error(`draft.removeResource: onbekende resource-id '${id}'`);
      }
      // Voor/na vastleggen VÓÓR de filters (strings uit de draft kopiëren, geen draft-referenties).
      const doomed = s.assignments.filter((a) => a.resourceId === id);
      report.removedAssignmentIds = doomed.map((a) => String(a.id));
      report.affectedTaskIds = [...new Set(doomed.map((a) => String(a.taskId)))];
      report.orphanedCrewMemberIds = s.resources.filter((r) => r.parentId === id).map((r) => String(r.id));

      // Ploeglid-`parentId` via `delete` i.p.v. `= undefined` — zie de noot bij updateResource.
      // Zelfde lichaam als de store-actie (`assignmentMutations.ts`), inclusief de werkregel-nazorg
      // (taaktypes-etappe, spec §5 rij 5) en de toewijzingen-trigger per geraakte taak; verlies via de
      // lease, zoals `unassignResource` hieronder.
      for (const lostTaskId of purgeResource(s, id, 'delete').lostTaskIds) recordTimephasedLoss(lostTaskId);
      markDocumentEdited(s);
    });
    return report;
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`assignResource`. Leaf-only/mijlpaal-guard en
   * eenheden-validatie (§2.4) worden hier tot FOUT verheven i.p.v. stil genegeerd (de tool-laag T4
   * pre-valideert; dit is de vangrail). Retourneert het nieuwe assignment-id.
   */
  assignResource(taskId: string, resourceId: string, unitsPerDay: number, curve?: ResourceCurve): string {
    const id = generateId('asgn');
    store.setState((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error(`draft.assignResource: onbekende taskId '${taskId}'`);
      if (task.isMilestone || isSummaryTask(task)) {
        throw new Error(`draft.assignResource: kan geen resource toewijzen aan een mijlpaal/samenvattingstaak '${taskId}'`);
      }
      if (!isValidUnits(unitsPerDay)) {
        throw new Error(`draft.assignResource: ongeldige unitsPerDay ${String(unitsPerDay)} (strikt positief vereist)`);
      }
      // Zelfde lichaam als de store-actie (`assignmentMutations.ts`, incl. de werkregel — spec §5
      // rij 4); verlies via de lease.
      for (const lostTaskId of insertAssignment(s, task, { id, taskId, resourceId, unitsPerDay, curve }).lostTaskIds) {
        recordTimephasedLoss(lostTaskId);
      }
      markDocumentEdited(s);
    });
    return id;
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`updateAssignment`. Onbekend id ⇒ fout. Behoudt de
   * store-"weiger-met-behoud"-semantiek: een ongeldige `unitsPerDay` wordt uit de patch gefilterd,
   * een gelijktijdige `curve`-wijziging gaat wél door.
   */
  updateAssignment(assignmentId: string, updates: Partial<Pick<ResourceAssignment, 'unitsPerDay' | 'curve'>>): void {
    store.setState((s) => {
      const idx = s.assignments.findIndex((a) => a.id === assignmentId);
      if (idx < 0) throw new Error(`draft.updateAssignment: onbekende assignmentId '${assignmentId}'`);
      const patch = acceptedAssignmentPatch(updates);
      if (!patch) return;
      // Zelfde lichaam als de store-actie (`assignmentMutations.ts`, incl. de werkregel — spec §5 rij 2).
      for (const lostTaskId of applyAssignmentPatch(s, s.assignments[idx], patch).lostTaskIds) recordTimephasedLoss(lostTaskId);
      markDocumentEdited(s);
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`setAssignmentWork` (taaktypes-etappe, spec §5
   * rij 3): zet het resterende werk (werkminuten, > 0) van één toewijzing; de werkdriehoek leidt
   * inzet of restduur af. Onbekend id, ongeldig werk of een taak buiten de regel ⇒ FOUT (de
   * toollaag pre-valideert; dit is de vangrail).
   */
  setAssignmentWork(assignmentId: string, remainingWorkMinutes: number): void {
    store.setState((s) => {
      const a = s.assignments.find((x) => x.id === assignmentId);
      if (!a) throw new Error(`draft.setAssignmentWork: onbekende assignmentId '${assignmentId}'`);
      const task = s.tasks.find((t) => t.id === a.taskId);
      if (!task) throw new Error(`draft.setAssignmentWork: toewijzing '${assignmentId}' zonder taak`);
      const oldWorkMinutes = taskWorkMinutesOf(task, taskCalendarHoursPerDay(task, s.calendars, s.calendar));
      const finishBasis = hourInputFinishBasis(task); // B1: vóór `commitTrianglePlan`.
      const plan = planWorkEdit(task, s.assignments, s, assignmentId, remainingWorkMinutes);
      if (!plan) {
        throw new Error(`draft.setAssignmentWork: werk ${String(remainingWorkMinutes)} geweigerd (strikt positief vereist; de werkregel geldt niet op mijlpalen, hangmatten, samenvattingen of ELAPSEDTIME-taken)`);
      }
      if (commitTrianglePlan(task, s.assignments, plan).durationChanged) afterTriangleDurationChange(s, task, oldWorkMinutes, finishBasis);
      s.taskTypesVisible = true; // review K3
      markDocumentEdited(s);
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`setTaskWorkRule` (spec §5 rij 6): zet de
   * werkregel van een taak (`undefined` = projectstandaard). Geen getal verandert; een
   * werkbeschermende regel legt het huidige restwerk vast. Onbekend id ⇒ fout.
   */
  setTaskWorkRule(taskId: string, rule: WorkRule | undefined): void {
    store.setState((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error(`draft.setTaskWorkRule: onbekende taskId '${taskId}'`);
      if (task.workRule === rule) return;
      settleRuleChange(task, s.assignments, s, rule);
      if (rule !== undefined) s.taskTypesVisible = true; // review K3
      markDocumentEdited(s);
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`setAssignmentContour` (contour-UI, 2026-09):
   * zet/vervangt de opgeslagen contour van één toewijzing, of laat 'm los (`null`). Onbekend id ⇒
   * fout; `null` zonder bestaande contour ⇒ no-op. Raakt geen taakdatum (zie `contourEdit.ts`).
   */
  setAssignmentContour(assignmentId: string, periods: TimephasedContourPeriod[] | null): void {
    store.setState((s) => {
      const a = s.assignments.find((x) => x.id === assignmentId);
      if (!a) throw new Error(`draft.setAssignmentContour: onbekende assignmentId '${assignmentId}'`);
      const task = s.tasks.find((t) => t.id === a.taskId);
      if (!task) throw new Error(`draft.setAssignmentContour: toewijzing '${assignmentId}' zonder taak`);
      const edit = contoursAfterEdit(s, task, a, periods);
      if (!edit) return;
      task.timephasedContours = edit.contours;
      syncAssignmentWorkToContour(a, periods); // bevinding 3 — tweeling van resourceSlice.
      markDocumentEdited(s);
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`moveAssignment`: verplaatst een toewijzing naar
   * `newTaskId` (units/curve blijven ongewijzigd) en werkt `resourceIds` op oude én nieuwe taak bij.
   * De store-guards (onbekend id, mijlpaal-/samenvattings-doel, dubbele resource-op-taak) worden hier
   * tot FOUT verheven i.p.v. `false` terug te geven.
   */
  moveAssignment(assignmentId: string, newTaskId: string): void {
    store.setState((s) => {
      const assignment = s.assignments.find((a) => a.id === assignmentId);
      if (!assignment) throw new Error(`draft.moveAssignment: onbekende assignmentId '${assignmentId}'`);
      const newTask = s.tasks.find((t) => t.id === newTaskId);
      if (!newTask) throw new Error(`draft.moveAssignment: onbekende taskId '${newTaskId}'`);
      if (newTask.isMilestone || isSummaryTask(newTask)) {
        throw new Error(`draft.moveAssignment: doeltaak '${newTaskId}' is een mijlpaal/samenvattingstaak`);
      }
      const alreadyOnTarget = s.assignments.some(
        (a) => a.taskId === newTaskId && a.resourceId === assignment.resourceId,
      );
      if (alreadyOnTarget) {
        throw new Error(`draft.moveAssignment: resource '${assignment.resourceId}' is al toegewezen aan taak '${newTaskId}'`);
      }

      for (const lostTaskId of relocateAssignment(s, assignment, newTask).lostTaskIds) recordTimephasedLoss(lostTaskId);
      markDocumentEdited(s);
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`unassignResource`: verwijdert de toewijzing en
   * schoont `task.resourceIds` op wanneer er geen andere toewijzing van dezelfde resource op de taak
   * resteert. Onbekend id ⇒ fout.
   */
  unassignResource(assignmentId: string): void {
    store.setState((s) => {
      const removed = s.assignments.find((a) => a.id === assignmentId);
      if (!removed) throw new Error(`draft.unassignResource: onbekende assignmentId '${assignmentId}'`);
      for (const lostTaskId of removeAssignment(s, removed).lostTaskIds) recordTimephasedLoss(lostTaskId);
      markDocumentEdited(s);
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`applyLeveling`: schrijft `levelingDelay`s +
   * `splitGaps` (idempotent — reset eerst álles binnen de scope, dan de nieuwe waarden). GEEN eigen
   * `runCPM`: de transactie herrekent aan het eind en verwerkt de delays dan precies één keer.
   *
   * B1c-plan-2 taak 1 (M10, eigenaarsbesluit 2026-08-31) — zelfde fix + melding als de store-
   * `applyLeveling` (`scheduleSlice.ts`): strip ook `levelingDelayMinutes`/`levelingDelayElapsed`
   * (anders overrult `CPMSolver.shiftByLevelingDelay` de zojuist geschreven delay), en meld het
   * eenmalig per document als dat écht iets wiste. De notify-aanroep staat BEWUST BUITEN
   * `store.setState`: `notify` roept zelf `set` aan, dus genest zou een tweede, nog lopende
   * Immer-produce triggeren (zelfde precedent als de eind-notify in `run()` hieronder).
   *
   * B1c-plan3 taak 2 — zelfde twee uitbreidingen als de store-variant: `write` is nu
   * `Pick<LevelingResult, 'delays' | 'gaps'>` (een volle `LevelingResult` blijft toewijsbaar) met een
   * optionele `opts.scopeTaskIds` die het resetten tot de gescopete taken beperkt. Het schrijven zelf
   * deelt deze variant met `scheduleSlice.ts`'s `applyLeveling` via `writeLevelingResult`
   * (taskDefaults.ts), zodat de twee niet uit elkaar kunnen lopen.
   */
  applyLeveling(write: Pick<LevelingResult, 'delays' | 'gaps'>, opts?: { scopeTaskIds?: string[] }): void {
    let roundedCount = 0;
    store.setState((s) => {
      roundedCount = writeLevelingResult(s.tasks, write, opts?.scopeTaskIds);
      markDocumentEdited(s);
    });
    if (roundedCount > 0) {
      const state = store.getState();
      notifyLevelingDelayRounded(state.notify, state.activeDocumentId, roundedCount);
    }
  },

  /** Snapshot/recompute-vrije variant van de store-`clearLeveling`: wist per taak alle
   *  nivelleeruitvoer via dezelfde `clearLevelingOutput`. GEEN eigen `runCPM` (de transactie
   *  herrekent). M10: zelfde melding als `applyLeveling` hierboven — zie dat docblok voor de "notify
   *  buiten setState"-motivering. */
  clearLeveling(): void {
    let roundedCount = 0;
    store.setState((s) => {
      for (const task of s.tasks) {
        if (clearLevelingOutput(task)) roundedCount++;
      }
      markDocumentEdited(s);
    });
    if (roundedCount > 0) {
      const state = store.getState();
      notifyLevelingDelayRounded(state.notify, state.activeDocumentId, roundedCount);
    }
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`setProject`: merge-t projectvelden en bumpt
   * `modifiedAt`. Ankert alleen NIEUWE taken op `startDate` (bestaande planning verschuift niet — dat
   * is `moveProject`). De store-no-op-guard (`projectChanges`) wordt hier weggelaten: binnen een
   * transactie is de snapshot al genomen, dus een leeg-effect-merge kost niets extra's.
   *
   * T7-review H1: dit AI-bewerkmoment hoort zich IDENTIEK te gedragen als de UI-variant
   * (`projectSlice.setProject`) — vóór deze fix deed dit alleen `Object.assign`, dus een LATERE
   * `startDate` liet een verouderd wortel-anker via de AI stil vóór het officiële projectbegin
   * hangen (headless bewezen: geen klem, geen melding). Dezelfde gedeelde `applyProjectPatch`
   * (`state/projectPatch.ts`) als de UI-kant — één definitie, geen tweede die kan afdrijven. GEEN
   * eigen `runCPM`/melding hier: de gebonden transactierun herrekent precies
   * één keer aan het eind (stap 5); het AANTAL geklemde ankers gaat terug naar de AANROEPER (i.p.v.
   * naar het UI-meldingenkanaal, dat de MCP-bridge niet gebruikt) zodat `planner_update_project` het
   * in zijn tool-resultaat kan melden.
   */
  setProject(updates: Partial<Project>): number {
    let clampedAnchors = 0;
    store.setState((s) => {
      clampedAnchors = applyProjectPatch(s, updates);
      markDocumentEdited(s);
    });
    return clampedAnchors;
  },
  };

  const draft = new Proxy(rawDraft, {
    get(target, property) {
      const value = Reflect.get(target, property);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        // Draftprimitieven zijn alleen geldig binnen de `run` van precies dit factoryobject. De
        // leasecheck gebeurt vóór de primitief een id genereert of de store muteert.
        activeLease();
        return Reflect.apply(value, target, args);
      };
    },
  }) as typeof rawDraft;

  return draft;
}

export type McpDraft = ReturnType<typeof createMcpDraft>;

/**
 * Bind de volledige MCP-transactiekern aan één storecontext.
 *
 * De runtimelease wordt vóór snapshot of statemutatie verkregen. Daarom kan een tweede factory op
 * dezelfde context de guard niet omzeilen. Een geweigerde nested enter valt buiten de inner
 * failure-naar-resultaatcatch, bereikt de outer callback als throw en laat de outer call volledig
 * terugrollen. De `finally` sluit uitsluitend de lease die deze call zelf verkreeg.
 */
export function createMcpTransactions(context: AppStoreContext): McpTransactions {
  const { store, runtime } = context;
  let currentLease: McpTransactionLease | null = null;

  const requireCurrentLease = (): McpTransactionLease => {
    if (!currentLease) {
      throw new Error('MCP-draft vereist een actieve run op hetzelfde factoryobject');
    }
    return currentLease;
  };

  const draft = createMcpDraft(context, requireCurrentLease);

  const run: McpTransactions['run'] = <T>(
    fn: () => Synchronous<T>,
  ): McpTransactionResult<T> => {
    // Cruciaal: buiten de try/catch. Een nested factoryrun mag zijn enterfout niet zelf in een
    // normaal `{ok:false}`-resultaat opsluiten; de outer callback moet de throw ontvangen.
    const lease = runtime.enterMcpTransaction();
    currentLease = lease;

    try {
      const initial = store.getState();
      const snapshot: Snapshot = createSnapshot(initial);
      const documentId = initial.activeDocumentId;
      const previousHistory = initial.historyEvents;
      const previousSequence = initial.nextHistorySequence;
      const previousViewRows = initial.viewRows;
      const previousResourceLoad = initial.resourceLoadResult;
      const previousDirty = initial.isDirty;
      // Critreview op ded4d8c3, bevinding 4: ook "ongewijzigd sinds import" hoort bij de poging —
      // een geweigerde AI-actie is geen bewerking en mag het heropen-beleid (optie B) niet raken.
      const previousPristine = initial.importPristine;
      // `runCPM` publiceert een gebruikersmelding zodra de tijdelijke solve een cyclus/fout ziet.
      // Als die solve de omvattende MCP-transactie vervolgens laat falen, hoort ook die melding bij
      // de teruggedraaide poging. Notifications zijn bewust appglobaal en zitten daarom niet in de
      // documentsnapshot; bewaar hun pre-callreferentie hier expliciet. De hele run is synchroon,
      // dus er kan tijdens dit venster geen onafhankelijke gebruikersmelding tussendoor komen.
      const prevNotifications = initial.ui.notifications;

      /** Het document terug op de stand van vóór de callback — gedeeld door rollback en no-op. */
      const restoreDocument = (state: AppState): void => {
        restoreSnapshot(state, snapshot, { markDirty: false, clearImportPristine: false });
        state.viewRows = previousViewRows;
        state.resourceLoadResult = previousResourceLoad;
        state.isDirty = previousDirty;
        state.importPristine = previousPristine;
      };

      const rollback = (error: string): { ok: false; error: string } => {
        store.setState((state) => {
          restoreDocument(state);
          replaceSessionHistoryState(state, previousHistory, previousSequence);
          state.ui.notifications = prevNotifications;
        });
        runtime.resetUndoCoalescing();
        return { ok: false, error };
      };

      let value: T;
      let dataChanged = false;
      try {
        value = fn() as T;
        if (isThenable(value)) {
          throw new Error('MCP-transactiecallback moet strikt synchroon zijn en mag geen Promise/thenable retourneren');
        }
        // Wijzigde de callback per saldo projectdata? Gemeten VÓÓR de eindherberekening: `runCPM`
        // alléén is nooit een wijziging. Dit is de ene plek waar elke MCP-schrijfactie langskomt — ook
        // de toollaag-producers die geen draft-primitief gebruiken (het voortgangspad van
        // `update_tasks` zette zo nooit `isDirty`, dus sluiten vroeg niet om op te slaan en de
        // crashherstel-auto-save sloeg de wijziging over). Dezelfde meting beslist over de undo-stap
        // (G5, hieronder).
        dataChanged = documentDataChanged(snapshot, createSnapshot(store.getState()));

        // De volledige eindherberekening blijft binnen dezelfde lease. Dat onderdrukt ook de
        // modus-verlaat-snapshot van "datums zoals opgeslagen". Zonder datawijziging valt er niets
        // te herrekenen.
        if (dataChanged) {
          store.getState().runCPM();
          store.getState().recomputeViewRows();
          store.getState().recomputeResourceLoad();
        }
      } catch (error) {
        return rollback(error instanceof Error ? error.message : String(error));
      }

      // G5 — per saldo niets gewijzigd ⇒ er is niets gebeurd, dezelfde regel als de no-op-guards van
      // de UI-routes. Dus geen undo-stap (die zou ook de redo-stapel van de gebruiker wissen), en
      // `cpmResult`, `scheduleStale`, "datums zoals opgeslagen" en `isDirty` blijven zoals ze waren:
      // ook wat de callback daar onderweg aan veranderde (een tussentijdse herberekening in een
      // batch, een draftprimitief dat `isDirty` zet, een nieuw object met dezelfde inhoud) gaat terug.
      // De historie en de meldingen blijven staan: die raakt een no-op niet.
      if (!dataChanged) {
        store.setState(restoreDocument);
        runtime.resetUndoCoalescing();
        return { ok: true, value, timephasedGuidanceLost: 0 };
      }

      const cpm = store.getState().cpmResult;
      if (cpm?.error) return rollback(cpm.error);

      runtime.resetUndoCoalescing();
      store.setState((state) => {
        runtime.recordDocumentDataHistory(state, snapshot, documentId, 'MCP-bewerking');
        markDocumentEdited(state);
      });
      const lostCount = runtime.countMcpTimephasedLoss(lease);
      if (lostCount > 0) {
        const state = store.getState();
        notifyTimephasedLoss(state.notify, state.activeDocumentId, lostCount);
      }
      return { ok: true, value, timephasedGuidanceLost: lostCount };
    } finally {
      currentLease = null;
      runtime.exitMcpTransaction(lease);
    }
  };

  return { run, draft };
}
