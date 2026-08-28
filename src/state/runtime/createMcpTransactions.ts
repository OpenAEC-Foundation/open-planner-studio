import type { AppStoreContext } from '../appStore';
import { attachToParent, detachFromParent, collectSubtreeIds } from '@/state/taskTree';
import { createSnapshot, restoreSnapshot, type Snapshot } from '../snapshot';
import { relationVerdict } from '../relationRules';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import {
  createDefaultTaskTime, mergeTaskTime, clearTimephasedWindow, timeUpdateTouchesTimephasedWindow,
  clearTimephasedDurationWalks, timephasedDurationWalksHaveFrozenWork,
} from '@/utils/taskDefaults';
import { deriveWbsCodes, applyWbsNumbering } from '@/utils/wbs';
import { syncProjectCalendar } from '../syncProjectCalendar';
import { notifyTimephasedLoss } from '../timephasedLossNotice';
import type { McpTransactionLease } from './storeRuntime';
import type { DurationType, Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceAssignment, ResourceCurve } from '@/types/resource';
import type { Project } from '@/types/project';
import type { CustomTaskType } from '@/types/taskType';
import type { LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { clampProjectStartAnchors } from '@/engine/scheduler/projectStartAnchorClamp';

export type McpTransactionResult<T> =
  | { ok: true; value: T; timephasedGuidanceLost: number }
  | { ok: false; error: string };

type Synchronous<T> = T extends PromiseLike<unknown> ? never : T;

/** Contextgebonden MCP-transactie. De callback blijft strikt synchroon. */
export interface McpTransactions {
  run<T>(fn: () => Synchronous<T>): McpTransactionResult<T>;
  draft: McpDraft;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === 'object' && value !== null) || typeof value === 'function'
    ? typeof (value as { then?: unknown }).then === 'function'
    : false;
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

/** Geldige capaciteit/eenheden (spiegelt `isValidUnits` in resourceSlice, daar niet geëxporteerd):
 *  strikt positief en eindig. 0/negatief/NaN is nooit een geldige toewijzing. */
function isValidUnits(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

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
      const inheritedTaskType = partial.taskType || parentTask?.taskType || (s.ui.constructionMode ? 'CONSTRUCTION' : 'USERDEFINED');
      const inheritedCustomTaskTypeId = inheritedTaskType === 'USERDEFINED'
        ? (partial.customTaskTypeId ?? (partial.taskType === undefined ? parentTask?.customTaskTypeId : undefined))
        : undefined;

      const task: Task = {
        id,
        name: partial.name,
        description: partial.description || '',
        wbsCode: partial.wbsCode || '',
        // Overerving (2026-08-14): zie taskSlice.ts addTask — zelfde regel, MCP-pad (ook gebruikt
        // door draft.addTasks, die top-down per item deze functie aanroept).
        taskType: inheritedTaskType,
        customTaskTypeId: inheritedCustomTaskTypeId,
        status: partial.status || 'NOT_STARTED',
        isMilestone: partial.isMilestone || false,
        milestoneKind: partial.milestoneKind,
        mandatory: partial.mandatory,
        priority: partial.priority ?? 500,
        parentId,
        childIds: [],
        // T14b (gebruikstestbevinding, ernst hoog — dataverlies): zie taskSlice.ts addTask — zelfde
        // veld-voor-veld-merge, MCP-pad. Een ongemerged meegegeven `time` liet writeIFC crashen op
        // een ontbrekend `completion` (`time.completion.toFixed(1)` in ifcTaskSlots.ts).
        time: mergeTaskTime(createDefaultTaskTime(now, partial.isMilestone ? 0 : 5), partial.time),
        resourceIds: partial.resourceIds || [],
        color: partial.color,
        constraint: partial.constraint,
        constraint2: partial.constraint2,
        isHammock: partial.isHammock,
        externalLinks: partial.externalLinks,
        deadline: partial.deadline,
        calendarId: partial.calendarId,
        notes: partial.notes,
        // Z14 (etappe "nul afwijkingen", checklist-aanvulling): de vier Z0-typecontractvelden
        // ontbraken hier bewust (ongebruikt + MCP-zetbaarheid was nog geen besluit) — zie
        // taskSlice.ts addTask voor dezelfde regel. Nu round-trippen ze door IFC (ifcPsets.ts), dus
        // deze functie is weer de VOLLEDIGE veld-voor-veld-tweeling van de store-`addTask`. Geen van
        // de vier is via `taskFields.ts`'s allowlist zetbaar (REJECT_HINTS) — dit vult alleen aan
        // voor aanroepers die een `Partial<Task>` rechtstreeks doorgeven (bv. `draft.addTasks`-items
        // met velden buiten de allowlist om, of toekomstig intern gebruik), zodat deze twee functies
        // niet stil uit elkaar drijven (Z0-reviewbevinding 3).
        splitGaps: partial.splitGaps,
        manuallyScheduled: partial.manuallyScheduled,
        levelingDelayMinutes: partial.levelingDelayMinutes,
        levelingDelayElapsed: partial.levelingDelayElapsed,
      };

      s.tasks.push(task);
      if (parentId) attachToParent(s.tasks, id, parentId);

      // WBS: auto-nummering ⇒ hele boom; anders alleen deze taak een afgeleide code geven wanneer de
      // aanroeper er geen meegaf (lege codes breken de CSV/MSP-koppeling).
      if (s.project.wbsAutoNumber) {
        applyWbsNumbering(s.tasks);
      } else if (!partial.wbsCode) {
        task.wbsCode = deriveWbsCodes(s.tasks).get(id) ?? '';
      }

      s.isDirty = true;
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
  addTasks(items: BulkTaskItem[]): Map<string, string> {
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
        s.isDirty = true;
      });
    }

    return idMap;
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`addSequence`: dezelfde regels als de store-actie,
   * uit `relationRules.ts` (dedup op predecessor+successor+type — meerdere relatietypes tussen
   * hetzelfde paar blijven toegestaan — plus self/onbekende-taak/verzameltaak-eindpunt). Dit was een
   * handgeschreven kopie van alleen de dedup-regel; die kopie is precies waarom validatie in de
   * slice-actie de MCP-laag zou overslaan. Retourneert het nieuwe id, of `null` wanneer de relatie is
   * geweigerd.
   */
  addSequence(seq: Omit<Sequence, 'id'>): string | null {
    const id = generateId('seq');
    let result: string | null = null;
    store.setState((s) => {
      const lookup = (tid: string) => s.tasks.find((t) => t.id === tid);
      if (!relationVerdict(lookup, s.sequences, seq).ok) return; // result blijft null
      s.sequences.push({ ...seq, id });
      s.isDirty = true;
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
      const { time, ...rest } = updates;
      Object.assign(s.tasks[idx], rest);
      if (time) s.tasks[idx].time = mergeTaskTime(s.tasks[idx].time, time);
      // Z14b (eigenaarsprincipe 2026-08-18) — gedocumenteerde tweeling van taskSlice.ts's
      // `updateTask`: zelfde triggerset/uitleg in `taskDefaults.ts`.
      if (('calendarId' in rest) || timeUpdateTouchesTimephasedWindow(time)) {
        const clearedWindow = clearTimephasedWindow(s.tasks[idx]);
        // N2 (Opus-her-check, tweede ronde) — zelfde tweeling-aanroep als taskSlice.ts's `updateTask`.
        const clearedWalks = timephasedDurationWalksHaveFrozenWork(s.tasks[idx])
          && clearTimephasedDurationWalks(s.tasks[idx]);
        // mpp-nul-data-etappe, DEEL 1 — meld alleen bij een ECHT verlies via de actieve runtimelease.
        if (clearedWindow || clearedWalks) recordTimephasedLoss(id);
      }
      s.isDirty = true;
    });
  },

  /**
   * VELD-VOOR-VELD-patch op een taak (snapshot/recompute-vrij): top-level velden plus expliciet
   * benoemde `time`-SLEUTELS. Bedoeld voor de MCP-toollaag, die zijn invoer eerst door de allowlist
   * van `services/mcp/tools/taskFields.ts` haalt.
   *
   * Verschil met `updateTaskFields`: hier kan een aanroeper per constructie geen hele geneste tak
   * meegeven — `timePatch` kent alleen `scheduleDuration`, `durationType` en de expliciete
   * `clearDurationMinutes`. Dat laatste is nodig omdat `durationMinutes` op een uur-kalender de BRON
   * VAN WAARHEID is (`durationDaysOf`): een achtergebleven minutenwaarde zou een zojuist gezette
   * dag-duur stil overrulen. `delete` (niet `= undefined`) houdt het Task-object schoon voor de
   * IFC-round-trip. Onbekend id ⇒ stille no-op (zoals `updateTaskFields`).
   */
  patchTaskFields(
    id: string,
    top: Partial<Task>,
    timePatch?: { scheduleDuration?: number; durationType?: DurationType; clearDurationMinutes?: boolean },
  ): void {
    store.setState((s) => {
      const idx = s.tasks.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const task = s.tasks[idx];
      Object.assign(task, top);
      let timeTouched = false;
      if (timePatch) {
        if (timePatch.scheduleDuration !== undefined) { task.time.scheduleDuration = timePatch.scheduleDuration; timeTouched = true; }
        if (timePatch.durationType !== undefined) { task.time.durationType = timePatch.durationType; timeTouched = true; }
        if (timePatch.clearDurationMinutes) { delete task.time.durationMinutes; timeTouched = true; }
      }
      // Z14b (eigenaarsprincipe 2026-08-18) — zelfde triggerset als `updateTaskFields`, zie
      // `taskDefaults.ts`. `timePatch` heeft een eigen, smallere vorm (allowlist-gedreven) dan een
      // volledige `Partial<TaskTime>`, dus hier direct de sleutel-aanwezigheid bijhouden i.p.v.
      // `timeUpdateTouchesTimephasedWindow` (die verwacht de bredere `TaskTime`-vorm).
      if (('calendarId' in top) || timeTouched) {
        const clearedWindow = clearTimephasedWindow(task);
        // N2 (Opus-her-check, tweede ronde) — zelfde tweeling-aanroep als `updateTaskFields` hierboven.
        const clearedWalks = timephasedDurationWalksHaveFrozenWork(task) && clearTimephasedDurationWalks(task);
        // mpp-nul-data-etappe, DEEL 1 — zie `updateTaskFields` hierboven.
        if (clearedWindow || clearedWalks) recordTimephasedLoss(id);
      }
      s.isDirty = true;
    });
  },

  /** Materialiseer de snapshot tegelijk met de taakmutatie; bestaande ids zijn onveranderlijk. */
  ensureCustomTaskType(type: CustomTaskType): void {
    store.setState((s) => {
      const normalized = { id: type.id.trim(), name: type.name.trim() };
      if (!normalized.id || !normalized.name) throw new Error('draft.ensureCustomTaskType: id en naam mogen niet leeg zijn');
      const existing = s.customTaskTypes.find(candidate => candidate.id === normalized.id);
      if (existing) {
        if (existing.name !== normalized.name) throw new Error(`draft.ensureCustomTaskType: id '${normalized.id}' heeft al naam '${existing.name}'`);
        return;
      }
      const sameName = s.customTaskTypes.find(candidate => candidate.name.localeCompare(
        normalized.name, undefined, { sensitivity: 'accent' },
      ) === 0);
      if (sameName) throw new Error(`draft.ensureCustomTaskType: naam '${normalized.name}' heeft al id '${sameName.id}'`);
      s.customTaskTypes.push(normalized);
      s.isDirty = true;
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`deleteTask`: verwijdert de taak + al haar
   * (klein)kinderen recursief, en ruimt relaties, assignments, selectie én de `childIds`-verwijzing
   * bij de ouder op. Onbekend id ⇒ stille no-op (zoals de store).
   */
  deleteTask(id: string): void {
    store.setState((s) => {
      const task = s.tasks.find((t) => t.id === id);
      if (!task) return;

      detachFromParent(s.tasks, id);

      const removeIds = new Set(collectSubtreeIds(s.tasks, id));

      s.tasks = s.tasks.filter((t) => !removeIds.has(t.id));
      s.sequences = s.sequences.filter(
        (seq) => !removeIds.has(seq.predecessorId) && !removeIds.has(seq.successorId),
      );
      s.assignments = s.assignments.filter((a) => !removeIds.has(a.taskId));
      s.selectedTaskIds = s.selectedTaskIds.filter((sid) => !removeIds.has(sid));
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      s.isDirty = true;
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
      s.isDirty = true;
    });
    return id;
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`updateCalendar`: merge-t velden op een
   * bibliotheek-kalender en synct de projectkalender-cache (§9.1). Onbekend id ⇒ herkenbare fout
   * (de tool-laag WP5 valideert dat vooraf; dit is de vangrail).
   */
  updateCalendar(id: string, updates: Partial<WorkCalendar>): void {
    store.setState((s) => {
      const idx = s.calendars.findIndex((c) => c.id === id);
      if (idx < 0) throw new Error(`draft.updateCalendar: onbekende kalender-id '${id}'`);
      Object.assign(s.calendars[idx], updates);
      syncProjectCalendar(s);
      s.isDirty = true;
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`addResource`. Retourneert het nieuwe id. De
   * eenheden-guard (§2.4) is hier — net als bij `assignResource` — een FOUT i.p.v. een stille
   * terugval: een resource met 0/negatieve capaciteit is nooit bedoeld.
   */
  addResource(res: Omit<Resource, 'id'>): string {
    const id = generateId('res');
    store.setState((s) => {
      if (!isValidUnits(res.maxUnits)) {
        throw new Error(`draft.addResource: ongeldige maxUnits ${String(res.maxUnits)} (strikt positief vereist)`);
      }
      s.resources.push({ ...res, id });
      s.isDirty = true;
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
      s.isDirty = true;
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

      s.resources = s.resources.filter((r) => r.id !== id);
      s.assignments = s.assignments.filter((a) => a.resourceId !== id);
      for (const task of s.tasks) {
        const idx = task.resourceIds.indexOf(id);
        if (idx >= 0) task.resourceIds.splice(idx, 1);
      }
      // Ploeg-lidmaatschap opruimen: leden van een verwijderde CREW vallen terug op geen ouder.
      // `delete` i.p.v. `= undefined` — zie de noot bij updateResource (IFC-round-trip).
      for (const r of s.resources) {
        if (r.parentId === id) delete r.parentId;
      }
      s.isDirty = true;
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
      if (task.isMilestone || task.childIds.length > 0) {
        throw new Error(`draft.assignResource: kan geen resource toewijzen aan een mijlpaal/samenvattingstaak '${taskId}'`);
      }
      if (!isValidUnits(unitsPerDay)) {
        throw new Error(`draft.assignResource: ongeldige unitsPerDay ${String(unitsPerDay)} (strikt positief vereist)`);
      }
      s.assignments.push({ id, taskId, resourceId, unitsPerDay, curve });
      if (!task.resourceIds.includes(resourceId)) task.resourceIds.push(resourceId);
      // Z14b (eigenaarsprincipe 2026-08-18, F2-fixronde) — "toewijzingen" is expliciet onderdeel
      // van de triggerset (plan: "duur, datums, kalender, toewijzingen"): een andere resource kan
      // een andere resourcekalender betekenen, precies de Z8-laag-4-discriminator — dus BEIDE
      // lagen wissen. Zie taskDefaults.ts.
      const clearedWindow = clearTimephasedWindow(task);
      const clearedWalks = clearTimephasedDurationWalks(task);
      // mpp-nul-data-etappe, DEEL 1 — zie `updateTaskFields` hierboven.
      if (clearedWindow || clearedWalks) recordTimephasedLoss(taskId);
      s.isDirty = true;
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
      let patch = updates;
      if ('unitsPerDay' in patch && !isValidUnits(patch.unitsPerDay)) {
        patch = { ...patch };
        delete patch.unitsPerDay;
      }
      if (Object.keys(patch).length === 0) return;
      Object.assign(s.assignments[idx], patch);
      s.isDirty = true;
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
      if (newTask.isMilestone || newTask.childIds.length > 0) {
        throw new Error(`draft.moveAssignment: doeltaak '${newTaskId}' is een mijlpaal/samenvattingstaak`);
      }
      const alreadyOnTarget = s.assignments.some(
        (a) => a.taskId === newTaskId && a.resourceId === assignment.resourceId,
      );
      if (alreadyOnTarget) {
        throw new Error(`draft.moveAssignment: resource '${assignment.resourceId}' is al toegewezen aan taak '${newTaskId}'`);
      }

      const oldTaskId = assignment.taskId;
      assignment.taskId = newTaskId;

      const stillOnOld = s.assignments.some(
        (a) => a.taskId === oldTaskId && a.resourceId === assignment.resourceId,
      );
      if (!stillOnOld) {
        const oldTask = s.tasks.find((t) => t.id === oldTaskId);
        const idx = oldTask?.resourceIds.indexOf(assignment.resourceId) ?? -1;
        if (oldTask && idx >= 0) oldTask.resourceIds.splice(idx, 1);
      }
      if (!newTask.resourceIds.includes(assignment.resourceId)) {
        newTask.resourceIds.push(assignment.resourceId);
      }
      // Z14b (F2-fixronde) — "toewijzingen"-trigger raakt BEIDE taken, BEIDE lagen (zie
      // assignResource hierboven).
      const oldTask = s.tasks.find((t) => t.id === oldTaskId);
      if (oldTask) {
        const clearedOldWindow = clearTimephasedWindow(oldTask);
        const clearedOldWalks = clearTimephasedDurationWalks(oldTask);
        if (clearedOldWindow || clearedOldWalks) recordTimephasedLoss(oldTaskId);
      }
      const clearedNewWindow = clearTimephasedWindow(newTask);
      const clearedNewWalks = clearTimephasedDurationWalks(newTask);
      // mpp-nul-data-etappe, DEEL 1 — zie `updateTaskFields` hierboven.
      if (clearedNewWindow || clearedNewWalks) recordTimephasedLoss(newTaskId);
      s.isDirty = true;
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
      s.assignments = s.assignments.filter((a) => a.id !== assignmentId);
      const stillAssigned = s.assignments.some(
        (a) => a.taskId === removed.taskId && a.resourceId === removed.resourceId,
      );
      if (!stillAssigned) {
        const task = s.tasks.find((t) => t.id === removed.taskId);
        const idx = task?.resourceIds.indexOf(removed.resourceId) ?? -1;
        if (task && idx >= 0) task.resourceIds.splice(idx, 1);
      }
      // Z14b (F2-fixronde) — "toewijzingen"-trigger, beide lagen (zie assignResource hierboven).
      const removedTask = s.tasks.find((t) => t.id === removed.taskId);
      if (removedTask) {
        const clearedWindow = clearTimephasedWindow(removedTask);
        const clearedWalks = clearTimephasedDurationWalks(removedTask);
        // mpp-nul-data-etappe, DEEL 1 — zie `updateTaskFields` hierboven.
        if (clearedWindow || clearedWalks) recordTimephasedLoss(removedTask.id);
      }
      s.isDirty = true;
    });
  },

  /**
   * Snapshot/recompute-vrije variant van de store-`applyLeveling`: schrijft alle `levelingDelay`-
   * waarden (idempotent — reset eerst álles, dan de nieuwe delays). GEEN eigen `runCPM`: de transactie
   * herrekent aan het eind en verwerkt de delays dan precies één keer.
   */
  applyLeveling(result: LevelingResult): void {
    store.setState((s) => {
      for (const task of s.tasks) {
        const d = result.delays[task.id];
        task.levelingDelay = d !== undefined && d > 0 ? d : undefined;
      }
      s.isDirty = true;
    });
  },

  /** Snapshot/recompute-vrije variant van de store-`clearLeveling`: zet alle `levelingDelay` terug op
   *  undefined. GEEN eigen `runCPM` (de transactie herrekent). */
  clearLeveling(): void {
    store.setState((s) => {
      for (const task of s.tasks) task.levelingDelay = undefined;
      s.isDirty = true;
    });
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
   * hangen (headless bewezen: geen klem, geen melding). Dezelfde gedeelde `clampProjectStartAnchors`
   * (`engine/scheduler/projectStartAnchorClamp.ts`) als de UI-kant — één definitie, geen tweede die
   * kan afdrijven. GEEN eigen `runCPM`/melding hier: de gebonden transactierun herrekent precies
   * één keer aan het eind (stap 5); het AANTAL geklemde ankers gaat terug naar de AANROEPER (i.p.v.
   * naar het UI-meldingenkanaal, dat de MCP-bridge niet gebruikt) zodat `planner_update_project` het
   * in zijn tool-resultaat kan melden.
   */
  setProject(updates: Partial<Project>): number {
    let clampedAnchors = 0;
    store.setState((s) => {
      const prevStartDate = s.project.startDate;
      Object.assign(s.project, updates);
      s.project.modifiedAt = new Date().toISOString();
      if (typeof updates.startDate === 'string') {
        clampedAnchors = clampProjectStartAnchors({
          tasks: s.tasks, sequences: s.sequences, calendar: s.calendar, calendars: s.calendars,
          prevStartDate, nextStartDate: updates.startDate,
        });
      }
      s.isDirty = true;
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
      const snapshot: Snapshot = createSnapshot(store.getState());
      const prevRedo = store.getState().redoStack;
      // `runCPM` publiceert een gebruikersmelding zodra de tijdelijke solve een cyclus/fout ziet.
      // Als die solve de omvattende MCP-transactie vervolgens laat falen, hoort ook die melding bij
      // de teruggedraaide poging. Notifications zijn bewust appglobaal en zitten daarom niet in de
      // documentsnapshot; bewaar hun pre-callreferentie hier expliciet. De hele run is synchroon,
      // dus er kan tijdens dit venster geen onafhankelijke gebruikersmelding tussendoor komen.
      const prevNotifications = store.getState().ui.notifications;

      const rollback = (error: string): { ok: false; error: string } => {
        store.setState((state) => {
          restoreSnapshot(state, snapshot);
          // De ene vooraf gepushte transactie-snapshot verwijderen; restoreSnapshot raakt de
          // historiestacks niet. Redo wordt exact naar de pre-callreferentie teruggezet.
          state.undoStack.pop();
          state.redoStack = prevRedo;
          state.ui.notifications = prevNotifications;
        });
        runtime.resetUndoCoalescing();
        return { ok: false, error };
      };

      store.setState((state) => {
        state.undoStack.push(snapshot);
        state.redoStack = [];
      });

      let value: T;
      try {
        value = fn() as T;
        if (isThenable(value)) {
          throw new Error('MCP-transactiecallback moet strikt synchroon zijn en mag geen Promise/thenable retourneren');
        }

        // De volledige eindherberekening blijft binnen dezelfde lease. Dat onderdrukt ook de
        // modus-verlaat-snapshot van "datums zoals opgeslagen".
        store.getState().runCPM();
        store.getState().recomputeViewRows();
        store.getState().recomputeResourceLoad();
      } catch (error) {
        return rollback(error instanceof Error ? error.message : String(error));
      }

      const cpm = store.getState().cpmResult;
      if (cpm?.error) return rollback(cpm.error);

      runtime.resetUndoCoalescing();
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
