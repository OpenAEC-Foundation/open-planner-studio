import { Task, type ExternalLink } from '@/types/task';
import { type SplitPiece, type SplitRefusal } from '@/engine/scheduler/splitEdit';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { applyTaskSplits, taskSplitRefusal } from '@/state/splitMutations';
import {
  buildNewTask, createDefaultTaskTime, deriveScheduleDurationFromMinutes, mergeTaskTime, clearTimephasedWindow,
  mergeTaskUpdate, taskTriggerChanges, invalidateForTimeBaseChange, clearLevelingGaps,
  taskCalendarHoursPerDay, taskWorkMinutesOf, applyDurationChangeRules,
  contourKeepsWork, hourInputFinishBasis, reconcileHourInputFinish, seedNewHourTaskFinish,
} from '@/utils/taskDefaults';
import { sameValue } from '@/utils/sameValue';
import { generateId } from '@/utils/id';
import { formatDate, parseDate } from '@/utils/dateUtils';
import { reconcileP6SuspendResume } from '@/utils/p6SuspendResume';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { ancestorIds, applyWbsNumbering, flattenOrder } from '@/utils/wbs';
import { applyProgressInvariants } from '@/engine/taskMutationRules';
import {
  actualStartQuestionFor, hasRecordedProgress, planProgressEntry, progressEntryStatusDate,
  type ProgressEdit, type ProgressEntryContext, type ProgressEntryResult,
} from '@/engine/progressEntry';
import { durationBelowDoneWorkNotice, statusDateSetTodayNotice } from '@/state/progressEntryNotice';
import type { WbsTemplate } from '@/utils/wbsTemplates';
import {
  detachFromParent, attachToParent, isSelfOrDescendant, removeTaskSubtrees, siblingIds,
} from '@/state/taskTree';
import { milestoneRefusal } from '@/engine/taskMilestoneTransition';
import {
  applyPhaseTransitions, firstChildGains, milestoneRefusalNotices, phaseRefusalNotice, phaseTransitionNotices,
  planPhaseTransitions, type PendingChild, type PhaseGain, type PhaseTransition,
} from '@/state/structuralTransition';
import { assignInsertedWbsCodes, insertRemappedRelations, notifyRelationsSkipped } from '@/state/insertedBranch';
import { notifyHierarchyCycle, watchAncestorRelations } from '@/state/hierarchyRelationNotice';
import {
  hierarchyChangeVerdict, NO_HIERARCHY_CHANGE, type HierarchyChangeVerdict, type HierarchyEdit,
} from '@/state/hierarchyChange';
import type { RelationTree } from '@/engine/scheduler/relationRules';
import { notifyTimephasedLoss } from '../timephasedLossNotice';
import {
  captureCalendarChange, captureTriangle, carryRemainingThroughDurationEdit, durationEditRefusal, settleCalendarChange,
  settleDurationEdit, settleRuleChange, captureProgressWork, settleProgressWork,
} from '@/engine/work/workRuleApply';
import type { WorkRule } from '@/types/workRule';
import type { AppSlice, AppSliceFactory, NotifyInput, SiblingDirection } from './types';
import type { AppState } from '../appStore';
import type { StoreRuntime } from '../runtime/storeRuntime';
import { hasConcreteWorkBlocks } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';
import { buildTaskEditPlanEnvironment } from '../gridTransaction';
import { planTaskCellEdits } from '@/engine/taskGrid/taskEditPlan';
import { buildProgressImportPlan } from '@/services/progressImport';
import type { ProgressImportPlan, ProgressOverrides, ProgressRow } from '@/services/progressImport';
import type { ProgressPlanDeps } from '@/services/progressImport';

/**
 * Zelfstandige kopie van een takenselectie (incl. subtaken), de interne
 * relaties en resource-toewijzingen. Deep-cloned bij het kopiëren, zodat
 * plakken ook werkt nadat de originelen gewijzigd of verwijderd zijn.
 * App-state, géén projectdata: rondt niet door de IFC-laag en zit niet in
 * de undo/redo-snapshots.
 */
export interface TaskSlice {
  tasks: Task[];
  /** Wordt de OUDER hierdoor een fase terwijl hij toewijzingen draagt, dan verhuizen die naar de
   *  nieuwe taak (`structuralTransition.ts`); kan dat niet — de nieuwe taak is een mijlpaal — dan
   *  voegt `addTask` NIETS toe, meldt het en geeft `''` terug. */
  addTask: (task: Partial<Task> & {
    name: string;
    /** Golf 1 (fase 2.10, Insert-sneltoets/contextmenu "invoegen boven/onder"): plaats de nieuwe
     *  taak vlak vóór/ná `anchorId` binnen diens ouder, i.p.v. achteraan. Zonder → exact het
     *  huidige gedrag (bestaande callers ONGEWIJZIGD: achteraan childIds/tasks). Een onbekende
     *  `anchorId` valt stil terug op het default-gedrag (stille tolerantie, zoals elders). */
    position?: { anchorId: string; where: 'above' | 'below' };
  }) => string;
  /** Top-level velden overschrijven, `time` samenvoegen (`mergeTaskUpdate`). Verandert de aanroep
   *  per saldo niets (structureel, `sameValue`), dan is hij een no-op: geen undo-stap, geen
   *  `isDirty`, geen melding. De gevolgregels (laag 3/4 ontkoppelen, nivelleergaten, duurgevolgen)
   *  vuren alleen op een ECHT gewijzigde waarde, niet op een meegestuurde sleutel
   *  (`taskTriggerChanges`).
   *  Wordt `isMilestone` aangezet op een fase of een taak met toewijzingen, dan weigert `updateTask`
   *  de HELE patch (geen mutatie, geen undo-stap) en meldt het — `milestoneRefusal` (#210). */
  updateTask: (id: string, updates: Partial<Task>, opts?: { coalesceKey?: string }) => void;
  /** Taaktypes-etappe (spec 2026-09-04 §5 rij 6): zet de werkregel van één taak (`undefined` = terug
   *  naar de projectstandaard). Geen getal verandert; een werkbeschermende regel legt het huidige
   *  restwerk van de werkresources vast (`workTriangle.ts`'s `applyRuleChange`). Geen
   *  `scheduleStale` (geen datum raakt). Onbekend id of ongewijzigde regel ⇒ no-op. */
  setTaskWorkRule: (id: string, rule: WorkRule | undefined) => void;
  deleteTask: (id: string) => void;
  /** Verwijder meerdere taken en hun subbomen als precies één undoable storehandeling. */
  deleteTasksBulk: (ids: readonly string[]) => void;
  /** Verplaats `id` onder een nieuwe ouder (null = root). `position` afwezig ⇒ byte-identiek aan het
   *  oude gedrag (achteraan childIds, rauwe array ongemoeid). `position` aanwezig ⇒ insert op die
   *  index — consistent in childIds (zichtbare volgorde niet-root, visibleRows.ts) ÉN in de rauwe
   *  s.tasks-array (root-volgorde + WBS via flattenOrder, dat childIds negeert); dubbele-volgorde-
   *  principe als store-`addTask` met anker. Out-of-range positie klemt naar [0, aantal siblings]. */
  moveTask: (id: string, newParentId: string | null, position?: number) => void;
  /** Issue #21 punt 1 (fase 1): verticaal taak-verslepen — verplaatst `id` naar een exacte positie
   *  (i.p.v. `moveTask`'s "altijd achteraan"). `target.parentId` = nieuwe ouder (`null` = root);
   *  `target.childIndex` = gewenste 0-based positie in diens kindlijst, geklemd op `[0..length]`.
   *  Houdt (net als `addTask`-position) ALLE drie waarheidsbronnen synchroon: `parentId`,
   *  `childIds` van oude+nieuwe ouder, én de rauwe `s.tasks`-array (enkel-node-splice, geen
   *  block-move — `flattenOrder` groepeert toch op `parentId`). Guards (in volgorde): onbekende
   *  taak/ouder, cykel (nieuwe ouder = zichzelf of een afstammeling), en no-op (zelfde ouder +
   *  zelfde effectieve index) ⇒ stil niets doen, geen undo-entry. Raakt `task.time` nergens aan.
   *  `scheduleStale` alleen bij reparent (andere ouder) — pure herordening binnen dezelfde ouder
   *  raakt geen summary-rollups, net als `reorderSibling`. */
  moveTaskTo: (id: string, target: { parentId: string | null; childIndex: number }) => void;
  /** Issue #26 (vervolgmelding op punt 6): verplaats een hele SELECTIE naar één doelpositie, met
   *  behoud van hun onderlinge (weergave)volgorde en in ÉÉN undo-stap. Gebruikt door beide
   *  sleep-hooks zodra de gesleepte rij deel uitmaakt van een meervoudige selectie; één losse rij
   *  blijft via `moveTaskTo` lopen. Regels: (a) een geselecteerde taak waarvan óók een voorouder
   *  geselecteerd is valt weg — die lift al mee met zijn ouder; (b) is `target.parentId` één van de
   *  te verplaatsen taken of een afstammeling daarvan, dan gebeurt er HELEMAAL niets (half
   *  verplaatsen is erger dan niets doen); (c) niets veranderd ⇒ geen undo-stap; (d) de selectie
   *  zelf blijft ongewijzigd. Verder identiek aan `moveTaskTo` (WBS-hernummering, `stale` alleen
   *  bij een echte reparent). */
  moveTasksTo: (ids: string[], target: { parentId: string | null; childIndex: number }) => void;
  /** Golf 1 (fase 2.10, Ctrl/Cmd+Alt+↑/↓): verwissel `taskId` met zijn vorige/volgende sibling
   *  binnen dezelfde ouder (top-level: de root-lijst). No-op aan de rand. Puur volgorde — raakt
   *  GEEN tijden/CPM, dus (in tegenstelling tot de meeste taak-acties) GEEN scheduleStale. */
  reorderSibling: (taskId: string, direction: SiblingDirection) => void;
  /** Hernummer alle WBS-codes uit de boompositie (1.2.3.4) — de expliciete variant van wbsAutoNumber. */
  renumberWbs: () => void;
  /** Inspringen (MSP Alt+Shift+→): elke taak wordt kind van zijn voorgaande zichtbare sibling. */
  indentTasks: (ids: string[]) => void;
  /** Uitspringen (MSP Alt+Shift+←): elke taak wordt sibling ná zijn huidige ouder. */
  outdentTasks: (ids: string[]) => void;
  /** Voeg een WBS-sjabloon in onder een ouder (null = rootniveau); geeft de nieuwe root-id terug. */
  insertWbsTemplate: (template: WbsTemplate, parentId: string | null) => string | null;
  /** Voortgang (fase 2.6): zet completion (0..1), dwingt de §3.2-invarianten af (auto-actualStart bij
 *  completion>0, remainingTime afgeleid, status). Een echte wijziging maakt de planning altijd
 *  stale; verandert de taak per saldo niet, dan is het een no-op (geen undo-stap, geen `isDirty`,
 *  niet stale, nivelleergaten blijven) — geldt ook voor de twee actual-setters hieronder, zie
 *  `commitProgressEdit`. Retourneert false op een VERZAMELTAAK: haar voortgang wordt afgeleid uit
 *  de bladen (`applyCpmResult`), dus geweigerd, geen mutatie en geen undo-stap — net als MCP en de
 *  voortgangsimport. Een onbekende taak is een stille no-op (`true`). */
  setTaskProgress: (taskId: string, completion: number, opts?: { coalesceKey?: string }) => boolean;
  /** Werkelijke start (fase 2.6). undefined = wissen. Retourneert false als de datum ná de
   *  statusdatum ligt, of op een verzameltaak (zie `setTaskProgress`) — geweigerd, geen mutatie
   *  (de UI toont een toast; op een verzameltaak is het veld al uitgeschakeld). `opts.coalesceKey` voegt
   *  de per-toetsaanslag-commits van het LIVE-committerende datumveld tot één undo-stap samen. */
  setActualStart: (taskId: string, date: string | undefined, opts?: { coalesceKey?: string }) => boolean;
  /** Werkelijke einde (fase 2.6): zet completion=1 + status COMPLETED. undefined = wissen.
   *  Retourneert false als de datum ná de statusdatum ligt (geweigerd). `opts.coalesceKey` als bij
   *  setActualStart. */
  setActualFinish: (taskId: string, date: string | undefined, opts?: { coalesceKey?: string }) => boolean;
  /**
   * Voortgang INVULLEN vanuit de UI (eigenschappenpaneel, contextmenu): dezelfde bewerking als de
   * drie setters hierboven, plus de invoerregels van `engine/progressEntry.ts`. Z1: staat er geen
   * statusdatum en houdt de taak na de bewerking voortgang over, dan gaat de statusdatum in DEZELFDE
   * undo-stap op `opts.today` (wat het statusdatumveld voor vandaag oplevert, `localTodayIso`) en volgt
   * één melding. Een werkelijke datum ná die (effectieve) statusdatum wordt geweigerd. Z1b: zou de
   * bewerking de werkelijke start afleiden uit een geplande start ná de statusdatum, dan verandert er
   * niets en komt `needsActualStart` terug met de vraag; de UI stelt die en roept opnieuw aan met
   * het antwoord in `opts.actualStart` (samen één undo-stap). De setters zelf blijven het vangnet
   * voor headless aanroepers, zonder deze regels.
   */
  enterTaskProgress: (
    taskId: string,
    edit: ProgressEdit,
    opts: { today: string; actualStart?: string; coalesceKey?: string },
  ) => ProgressEntryResult;
  /**
   * Issue #146 — de ENIGE schrijver van gebruikerssplits. Bewust een EIGEN, smalle mutatie en géén
   * `updateTask`-patch: die wist nivelleergaten (`clearLevelingGaps`) en herschaalt gaten
   * fractioneel, precies het tegenovergestelde van wat een splitbewerking wil. `pieces` is de
   * stukkenlijst uit `engine/scheduler/splitEdit.ts` (werk/pauze/werk in werkminuten); `null` =
   * "alle onderbrekingen opheffen", het enige pad dat óók op een niet-wélgevormde importsplit mag.
   * Retourneert `null` bij succes, anders de weigerreden (UI: gekleurd blok, MCP: weigertekst).
   * `opts.coalesceKey` voegt de per-mousemove-commits van één sleepgebaar tot één undo-stap samen,
   * net als bij `useBarDrag`.
   */
  setTaskSplits: (
    taskId: string,
    pieces: SplitPiece[] | null,
    opts?: { coalesceKey?: string },
  ) => SplitRefusal | null;
  /** Taak-kalender (fase 2.8a, §7.3): wijs een bibliotheek-kalender toe (undefined = projectkalender).
   *  Dwingt niets af — zet alleen `calendarId` + undo-snapshot + scheduleStale (datum-beïnvloedend). */
  setTaskCalendar: (taskId: string, calendarId: string | undefined) => void;
  /** Externe (cross-project) dependency (fase 2.9, §4.5/§5.5): voeg een link toe (genereert de id),
   *  geeft de nieuwe link-id terug. Datum-beïnvloedend ⇒ scheduleStale. */
  addExternalLink: (taskId: string, link: Omit<ExternalLink, 'id'>) => string;
  /** Vervang één externe link verliesloos met behoud van id; false bij verkeerde taak/link-id. */
  updateExternalLink: (taskId: string, linkId: string, link: Omit<ExternalLink, 'id'>) => boolean;
  /** Verwijder een externe link van een taak (fase 2.9). Datum-beïnvloedend ⇒ scheduleStale. */
  removeExternalLink: (taskId: string, linkId: string) => void;
  /** Issue #27 etappe 2 (T5): bouwt het voortgangsplan tegen de HUIDIGE taken. Muteert niets — de
   *  `ProgressImportDialog` toont dit als preview en herbouwt het bij elke wijziging in de
   *  handmatige koppelingen (A11: "herbouw, niet bijwerken"). Precedent voor een lezende actie:
   *  `isLocalPoolNewer` (librarySlice). */
  previewProgressImport: (
    rows: readonly ProgressRow[],
    overrides?: ProgressOverrides,
    opts?: ProgressImportEntryOptions,
  ) => ProgressImportPlan;
  /** Herberekent hetzelfde plan tegen de LIVE taken en past het in ÉÉN undo-stap toe (A4/A8): drift
   *  tussen preview en apply wordt opgelost door opnieuw te bouwen, nooit door het preview-plan te
   *  hergebruiken. Nul toepassingen ⇒ nul undo-stappen (zoals `setActualStart` bij een weigering). */
  applyProgressImport: (
    rows: readonly ProgressRow[],
    overrides?: ProgressOverrides,
    opts?: ProgressImportEntryOptions,
  ) => ProgressImportPlan;
}

/**
 * Voortgangsblad inlezen als UI-route (besluiten eigenaar 26-09, herbouw #232): met `today`
 * (`localTodayIso`, meegegeven door `ProgressImportDialog`) gelden dezelfde invoerregels als in
 * paneel, contextmenu, raster en "Taak bewerken" (`engine/progressEntry.ts`):
 *  - Z1: zonder statusdatum plant het blad met vandaag; houdt een toegepaste rij voortgang over, dan
 *    gaat de statusdatum in dezelfde undo-stap op vandaag, met de melding `statusDateSetToday`;
 *  - Z1b: een rij die de werkelijke start zou AFLEIDEN uit een geplande start ná de statusdatum
 *    (`actualStartQuestionFor`) wordt geweigerd met `actualStartRequired` — het blad moet de
 *    werkelijke start zelf aanleveren.
 * Zonder `today` (headless, tests, extensies) blijven de oude regels gelden.
 */
export interface ProgressImportEntryOptions {
  today?: string;
}

/** De planner-naad van het voortgangsblad (`buildProgressImportPlan`), met de regels hierboven. */
function progressImportDeps(s: AppState, today: string | undefined): ProgressPlanDeps {
  const statusDate = progressEntryStatusDate(s.project.statusDate, today);
  return {
    planEdits: (task, edits) => {
      const environment = buildTaskEditPlanEnvironment(s, task);
      const planned = planTaskCellEdits(task, edits, statusDate ? { ...environment, statusDate } : environment);
      if (!planned.ok || !today) return planned;
      const wrote = (columnId: string) => edits.some(edit => String(edit.columnId) === columnId && !!edit.value);
      const question = actualStartQuestionFor(task, planned.value.task, statusDate, {
        actualStart: wrote('task.time.actualStart'),
        actualFinish: wrote('task.time.actualFinish'),
      });
      if (!question) return planned;
      return {
        ok: false,
        errors: [{
          code: 'actualStartRequired',
          messageKey: 'taskGrid.validation.actualStartRequired',
          taskId: task.id,
          value: { statusDate: question.statusDate, latest: question.latest },
        }],
      };
    },
  };
}

function sameExternalLink(left: ExternalLink, right: ExternalLink): boolean {
  return left.id === right.id
    && left.direction === right.direction
    && left.relType === right.relType
    && left.lagDays === right.lagDays
    && left.lagMinutes === right.lagMinutes
    && left.anchorDate === right.anchorDate
    && left.sourceMissing === right.sourceMissing
    && left.sourceRef.projectId === right.sourceRef.projectId
    && left.sourceRef.projectName === right.sourceRef.projectName
    && left.sourceRef.taskId === right.sourceRef.taskId
    && left.sourceRef.taskName === right.sourceRef.taskName
    && left.sourceRef.filePath === right.sourceRef.filePath;
}

/**
 * Uitkomst van `planTaskPlacement`: WAAR een taak na de mutatie moet staan.
 * `index` is de reeds op `[0..n]` geklemde positie in de kindlijst van de nieuwe ouder, gemeten
 * in `siblingIdsAfterRemoval` (die lijst ZÓNDER de taak zelf — de mutatie is immers
 * eerst-verwijderen-dan-invoegen). `siblingIdsAfterRemoval` wordt ook gebruikt om het juiste
 * anker in de rauwe `s.tasks`-array te vinden.
 */
interface TaskPlacement {
  parentId: string | null;
  index: number;
  siblingIdsAfterRemoval: string[];
}

/**
 * Bepaalt de doelpositie van een taak ZONDER iets te muteren. Gedeeld door `moveTaskTo`
 * (rij-slepen, issue #21) en `outdentTasks` (uitspringen, issue #26) zodat uitspringen niet
 * opnieuw uit de pas kan lopen met slepen: één plek waar de guards, het klemmen én de
 * ankerbepaling wonen.
 *
 * Guards (in volgorde) ⇒ `null`, en `null` betekent voor de aanroeper: HELEMAAL niets doen —
 * geen undo-snapshot, geen halftoegepaste state:
 *  1. onbekende taak;
 *  2. onbekende doel-ouder (`null` = root is altijd geldig);
 *  3. cykel — de nieuwe ouder is de taak zelf of een afstammeling ervan (loop omhoog door de
 *     ouderketen, met visited-set tegen corrupte parentId-cycli uit een kapot IFC);
 *  4. no-op — zelfde ouder én zelfde effectieve index; alleen wanneer `opts.rejectNoOp` aanstaat.
 *     `curIdx` (index MÉT zichzelf) en `index` (index ZONDER zichzelf) zijn rechtstreeks
 *     vergelijkbaar: alles vóór `curIdx` blijft na verwijdering ongewijzigd.
 *
 * De root-"kindlijst" bestaat niet als array: de root-siblingvolgorde is de relatieve volgorde
 * binnen de rauwe `tasks`-array (zie `flattenOrder` in utils/wbs.ts, de `!parentId`-root-scan in
 * engine/view/visibleRows.ts en de toelichting in engine/view/dropTarget.ts).
 */
function planTaskPlacement(
  tasks: Task[],
  id: string,
  target: { parentId: string | null; childIndex: number },
  opts: { rejectNoOp: boolean },
): TaskPlacement | null {
  // Guard 1: taak bestaat.
  const task = tasks.find(t => t.id === id);
  if (!task) return null;

  // Guard 2: doel-ouder bestaat (of is root = null).
  const newParentId = target.parentId;
  if (newParentId !== null && !tasks.some(t => t.id === newParentId)) return null;

  // Guard 3: cykel — de nieuwe ouder is de taak zelf of een afstammeling ervan.
  if (newParentId !== null && isSelfOrDescendant(tasks, newParentId, id)) return null;

  const oldParentId = task.parentId;
  const oldParent = oldParentId ? tasks.find(t => t.id === oldParentId) : undefined;
  const newParent = newParentId ? tasks.find(t => t.id === newParentId) : undefined;

  const siblingIdsAfterRemoval = newParent
    ? newParent.childIds.filter(cid => cid !== id)
    : tasks.filter(t => !t.parentId && t.id !== id).map(t => t.id);
  const index = Math.max(0, Math.min(target.childIndex, siblingIdsAfterRemoval.length));

  // Guard 4: no-op (alleen op verzoek — zie doc hierboven).
  if (opts.rejectNoOp && newParentId === oldParentId) {
    const curIdx = oldParent
      ? oldParent.childIds.indexOf(id)
      : tasks.filter(t => !t.parentId).map(t => t.id).indexOf(id);
    if (index === curIdx) return null;
  }

  return { parentId: newParentId, index, siblingIdsAfterRemoval };
}

/**
 * Voert een `planTaskPlacement`-plan uit en houdt ALLE drie de waarheidsbronnen synchroon:
 * `task.parentId`, de `childIds` van oude+nieuwe ouder, én de rauwe `tasks`-array.
 *
 * De rauwe array verhuist als ENKELE NODE (geen block-move van de subtree): kinderen blijven via
 * `parentId` gewoon hangen en `flattenOrder` groepeert toch op `parentId`, dus een verspreide
 * subtree is functioneel prima — exact zoals `reorderSibling`'s root-swap de array al
 * niet-aaneengesloten maakt zonder dat display/WBS breekt.
 *
 * Roep dit alleen aan met een plan dat op dezelfde (ongewijzigde) `tasks` is berekend; de
 * aanroeper doet de undo-snapshot, `applyWbsNumbering` en `finishMutation`.
 */
function applyTaskPlacement(tasks: Task[], id: string, plan: TaskPlacement): void {
  const task = tasks.find(t => t.id === id);
  if (!task) return; // kan niet: guard 1 van planTaskPlacement dekt dit al (defensief).
  // childIds (display-bron, zie visibleRows.ts): verwijderen uit oude ouder, invoegen in nieuwe.
  // Eerst detach en dán attach — bij een verplaatsing BINNEN dezelfde ouder zou de omgekeerde
  // volgorde de taak twee keer in de lijst zetten.
  detachFromParent(tasks, id);
  attachToParent(tasks, id, plan.parentId, plan.index);

  // Rauwe tasks-array (WBS/flatten + root-volgorde, zie utils/wbs.ts flattenOrder).
  const rawIdx = tasks.findIndex(t => t.id === id);
  const [node] = tasks.splice(rawIdx, 1);
  if (plan.index >= plan.siblingIdsAfterRemoval.length) {
    // Achteraan: vlak ná het laatste element van de kindgroep in de rauwe array (of, als er
    // geen enkele sibling is, gewoon achteraan de hele array).
    const lastSiblingId = plan.siblingIdsAfterRemoval[plan.siblingIdsAfterRemoval.length - 1];
    const lastSiblingRawIdx = lastSiblingId ? tasks.findIndex(t => t.id === lastSiblingId) : -1;
    if (lastSiblingRawIdx >= 0) tasks.splice(lastSiblingRawIdx + 1, 0, node);
    else tasks.push(node);
  } else {
    // Vóór het element dat nu (ná verwijdering van `id`) op `plan.index` staat.
    const anchorId = plan.siblingIdsAfterRemoval[plan.index];
    const anchorRawIdx = tasks.findIndex(t => t.id === anchorId);
    if (anchorRawIdx >= 0) tasks.splice(anchorRawIdx, 0, node);
    else tasks.push(node);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
//  Verhangen: de boomwijziging per route, en één weg om hem toe te passen
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// Elke verhangroute (`moveTask`, `moveTaskTo`, `moveTasksTo`, `indentTasks`, `outdentTasks`) is hier
// een `HierarchyEdit`: de boomwijziging zelf, als functie op een takenlijst. `applyHierarchyEdit`
// draait die functie EERST op een proefkopie (`hierarchyChangeVerdict`: maakt de uitkomst een nieuwe
// kring in de relatiegraaf zoals de solver hem uitvouwt?) en pas daarna op de draft. Zo toetst de
// kringregel exact wat de actie gaat doen, en weigert hij vóór er een undo-snapshot of mutatie is.
// De dialoog "Taak bewerken" en MCP `planner_move_task` gebruiken via `moveTaskVerdict` dezelfde
// proef.

/**
 * `moveTask`: `id` onder `newParentId` (null = root), op `position` of achteraan.
 *
 * Cykel-preventie (QA-fix P1, fase 2.10 onderdeel 2): newParentId mag niet id zelf zijn, en niet een
 * afstammeling van id — anders ontstaat een lus in de boom (oneindige loops in flattenOrder/viewRows).
 * Geweigerd ⇒ niets gewijzigd: geen snapshot, geen halftoegepaste state. Dit is de enige plek die
 * parentId/childIds voor "Taak bewerken" mag muteren (zie TaskDialog.handleSave — die haalt parentId
 * daarom uit de kale `updateTask`-patch en roept in plaats daarvan `moveTask` aan). `position`
 * verandert deze guards NIET: een geweigerde move blijft ook mét positie geweigerd.
 */
function moveTaskEdit(id: string, newParentId: string | null, position?: number): HierarchyEdit {
  return (tasks) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return NO_HIERARCHY_CHANGE;
    // Cyklusguard (review issue #21 pt. 1): de nieuwe ouder mag de taak zelf of een afstammeling
    // ervan niet zijn — corrupte parentId-cycli zijn bereikbaar via een IFC waarin `extractNesting`
    // de nesting zonder cyklusguard zet. Sinds K-item 35 de gedeelde functie; hier stond tot een
    // review een vijfde handkopie inclusief eigen bezocht-set.
    if (newParentId != null && isSelfOrDescendant(tasks, newParentId, id)) return NO_HIERARCHY_CHANGE;
    const oldParentId = task.parentId;

    // Remove from old parent
    detachFromParent(tasks, id);

    // Insert op `position` (T12), of — zonder positie — achteraan, volgens het dubbele-
    // volgorde-principe van de store-`addTask` met anker. WBS-nummering (flattenOrder) leest de
    // RAUWE array-volgorde en negeert childIds; de zichtbare volgorde van niet-root taken leest
    // juist childIds (visibleRows.ts). Daarom moet de invoegplek op BEIDE plekken kloppen — ook
    // zonder expliciete `position` (voorheen liet die tak de rauwe array ongemoeid, waardoor het
    // WBS-nummer de oude array-positie van vóór de move bleef volgen terwijl de taak zichtbaar
    // achteraan verscheen: gerapporteerde 3.1/3.2/3.3-bug, taskDialog "parent wijzigen").
    //
    // (1) childIds van de nieuwe ouder — zichtbare volgorde voor niet-root taken.
    // `attachToParent` zet parentId én voegt geklemd in — hier stond diezelfde klem-en-splice
    // tot een review nog een keer overgetypt.
    attachToParent(tasks, id, newParentId, position);
    // (2) rauwe tasks-array — root-volgorde + WBS. Haal de taak eruit en zet 'm terug zó dat
    // hij — gerekend over alléén zijn siblings (taken met dezelfde parentId, in array-volgorde)
    // — op index `position` (of, zonder positie, achteraan) staat. Nakomelingen blijven staan
    // waar ze staan; flattenOrder herbouwt de boom uit parentId, dus alleen de sibling-volgorde
    // van deze taak telt.
    const fromIdx = tasks.findIndex(t => t.id === id);
    const [moved] = tasks.splice(fromIdx, 1);
    const sibIdx: number[] = [];
    tasks.forEach((t, i) => { if (t.parentId === newParentId) sibIdx.push(i); });
    const at = position === undefined
      ? sibIdx.length
      : Math.max(0, Math.min(position, sibIdx.length)); // klem naar [0, aantal siblings]
    let insertAt: number;
    if (at < sibIdx.length) {
      insertAt = sibIdx[at];                       // vóór de huidige `at`-de sibling
    } else if (sibIdx.length > 0) {
      insertAt = sibIdx[sibIdx.length - 1] + 1;    // achter de laatste sibling
    } else if (newParentId) {
      const p = tasks.findIndex(t => t.id === newParentId);
      insertAt = p >= 0 ? p + 1 : tasks.length;    // enig kind: vlak achter de ouder
    } else {
      insertAt = tasks.length;                     // enige root: achteraan
    }
    tasks.splice(insertAt, 0, moved);
    return { changed: true, reparented: newParentId !== oldParentId };
  };
}

/**
 * `moveTaskTo` (rij slepen, issue #21): één taak naar een exacte positie. Alle guards (onbekende
 * taak/ouder, cykel, no-op) zitten in de gedeelde planner; `null` ⇒ niets gewijzigd.
 * `rejectNoOp: true` — slepen naar de eigen plek mag geen undo-entry of dirty-vlag opleveren.
 */
function moveTaskToEdit(id: string, target: { parentId: string | null; childIndex: number }): HierarchyEdit {
  return (tasks) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return NO_HIERARCHY_CHANGE;
    const oldParentId = task.parentId; // vóór de mutatie lezen (bepaalt `stale`).
    const plan = planTaskPlacement(tasks, id, target, { rejectNoOp: true });
    if (!plan) return NO_HIERARCHY_CHANGE;
    applyTaskPlacement(tasks, id, plan);
    return { changed: true, reparented: plan.parentId !== oldParentId };
  };
}

/** `moveTasksTo` (issue #26): een hele selectie naar één doelpositie — zie de interfacedoc. */
function moveTasksToEdit(ids: string[], target: { parentId: string | null; childIndex: number }): HierarchyEdit {
  return (tasks) => {
    // ---- 1. Onbekende ids weg, en afstammelingen van een mede-geselecteerde taak weg ----------
    // Een kind verhuist automatisch mee met zijn ouder (de subboom hangt aan `parentId`), dus
    // een apart verplaatst kind zou zichzelf uit de meeverhuisde ouder trekken. `indentTasks`/
    // `outdentTasks` lossen ditzelfde probleem op met een diepste-eerst-sortering; hier is
    // wegfilteren juist, want de groep landt op één doelpositie.
    const geselecteerd = new Set(ids.filter(id => tasks.some(t => t.id === id)));
    // `ancestorIds` is cyclusveilig tegen corrupte parentId-cycli uit een kapot IFC.
    const parentOf = (id: string) => tasks.find(t => t.id === id)?.parentId;
    /** Zit er in de ouderketen van `id` een mede-geselecteerde taak? */
    const heeftGeselecteerdeVoorouder = (id: string): boolean => {
      for (const voorouder of ancestorIds(id, parentOf)) if (geselecteerd.has(voorouder)) return true;
      return false;
    };
    const teVerplaatsen = [...geselecteerd].filter(id => !heeftGeselecteerdeVoorouder(id));
    if (teVerplaatsen.length === 0) return NO_HIERARCHY_CHANGE;

    // ---- 2. Sorteren op WEERGAVEvolgorde ----------------------------------------------------
    // Niet op selectievolgorde: de groep hoort in zijn oorspronkelijke volgorde neer te komen,
    // ook als de gebruiker eerst de onderste en daarna de bovenste rij aanklikte.
    const order = flattenOrder(tasks).map(t => t.id);
    const gesorteerd = teVerplaatsen.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    // ---- 3. Cykelguard op GROEPSniveau ------------------------------------------------------
    // `planTaskPlacement` guardt dit per taak, maar dan zou de ene helft van de groep wél en de
    // andere niet verhuizen. Een groep die je op zichzelf (of op een eigen afstammeling) dropt
    // doet daarom HELEMAAL niets.
    if (target.parentId !== null) {
      const groep = new Set(gesorteerd);
      if (groep.has(target.parentId)) return NO_HIERARCHY_CHANGE;
      for (const voorouder of ancestorIds(target.parentId, parentOf)) if (groep.has(voorouder)) return NO_HIERARCHY_CHANGE;
    }

    // ---- 4. Eén voor één plaatsen, elk direct ná zijn voorganger -----------------------------
    let changed = false;
    let reparented = false;
    /** De vorige taak van de groep die daadwerkelijk op zijn plek staat; de volgende landt er
     *  direct achter. `null` = nog geen enkele geplaatst ⇒ start op `target.childIndex`. */
    let vorigeId: string | null = null;
    for (const id of gesorteerd) {
      const task = tasks.find(t => t.id === id);
      if (!task) continue;

      // De doelindex opnieuw AFLEIDEN uit de werkelijke positie van de voorganger — niet blind
      // ophogen. `planTaskPlacement` klemt en telt tegen de siblinglijst ZÓNDER `id` zelf, dus
      // meten we hier in exact diezelfde lijst. Blind `idx + 1` gaat mis zodra `id` vóór de
      // voorganger stond (de lijst schuift dan een plek op) — dat keert de volgorde om of laat
      // gaten vallen.
      let childIndex = target.childIndex;
      if (vorigeId !== null) {
        // `id` er expliciet uit: `planTaskPlacement` klemt en telt tegen de siblinglijst ZÓNDER
        // de verplaatste taak (zie `siblingIdsAfterRemoval`). Meten we hier in de lijst MÉT `id`,
        // dan is de index één te hoog zodra `id` momenteel vóór de voorganger staat.
        const siblingsZonderId = siblingIds(tasks, target.parentId).filter(x => x !== id);
        const vorigeIdx = siblingsZonderId.indexOf(vorigeId);
        // −1 kan alleen bij een kapotte boom: dan achteraan, net als de fallbacks elders.
        childIndex = vorigeIdx >= 0 ? vorigeIdx + 1 : siblingsZonderId.length;
      }

      const oudeOuder = task.parentId;
      // `rejectNoOp: false`: de no-op-guard mag hier geen legitieme herplaatsing tegenhouden —
      // hij zou ook `vorigeId` niet bijwerken en daarmee de rest van de groep verkeerd plaatsen.
      // De no-op-detectie doen we hieronder zelf, puur om te bepalen of er iets te ondoen valt.
      const plan = planTaskPlacement(tasks, id, { parentId: target.parentId, childIndex }, { rejectNoOp: false });
      if (!plan) continue; // onbekende doel-ouder of cykel (stap 3 dekt de groep al) ⇒ overslaan.

      // Staat de taak al precies goed? Dan niets muteren (en dus ook geen undo-stap forceren),
      // maar wél als voorganger tellen — hij stáát immers op de doelpositie. `curIdx` (index MÉT
      // zichzelf) en `plan.index` (ZONDER zichzelf) zijn direct vergelijkbaar, zie guard 4.
      const curIdx = siblingIds(tasks, oudeOuder).indexOf(id);
      if (plan.parentId !== oudeOuder || plan.index !== curIdx) {
        applyTaskPlacement(tasks, id, plan);
        changed = true;
        if (plan.parentId !== oudeOuder) reparented = true;
      }
      vorigeId = id;
    }
    return { changed, reparented };
  };
}

/**
 * `indentTasks` (MSP Alt+Shift+→). Kandidaat-ouder = de voorgaande sibling in de weergavevolgorde
 * (flattenOrder). Geen voorgaande sibling => no-op voor die taak. De subboom lift mee via parentId.
 * Binnen een meervoudige selectie springt een aaneengesloten blok als geheel in: geselecteerde
 * voorgaande siblings worden overgeslagen als kandidaat-ouder, anders nest het blok trapsgewijs in
 * elkaar.
 */
function indentEdit(ids: string[]): HierarchyEdit {
  return (tasks) => {
    const selected = new Set(ids);
    let changed = false;
    const order = flattenOrder(tasks).map(t => t.id);
    for (const id of order) {
      if (!selected.has(id)) continue;
      const task = tasks.find(t => t.id === id);
      if (!task) continue;
      const idx = order.indexOf(id);
      let newParentId: string | null = null;
      for (let i = idx - 1; i >= 0; i--) {
        const cand = tasks.find(t => t.id === order[i]);
        if (!cand) continue;
        if (cand.parentId === task.parentId && !selected.has(cand.id)) {
          newParentId = cand.id;
          break;
        }
        // Voorbij het bereik van dezelfde ouder (omhoog de boom uit): stoppen.
        if (cand.id === task.parentId) break;
      }
      if (!newParentId) continue;
      detachFromParent(tasks, id);
      attachToParent(tasks, id, newParentId);
      changed = true;
    }
    return { changed, reparented: changed };
  };
}

/** `outdentTasks` (MSP Alt+Shift+←): elke taak wordt sibling direct ná haar huidige ouder. */
function outdentEdit(ids: string[]): HierarchyEdit {
  return (tasks) => {
    // Diepste taken eerst zodat een geselecteerde ouder+kind-combinatie niet dubbelt.
    const order = flattenOrder(tasks).map(t => t.id);
    const sorted = [...ids].sort((a, b) => order.indexOf(b) - order.indexOf(a));
    let changed = false;
    for (const id of sorted) {
      const task = tasks.find(t => t.id === id);
      if (!task || !task.parentId) continue;
      const parent = tasks.find(t => t.id === task.parentId);
      if (!parent) continue;

      // Doel (issue #26): sibling DIRECT ná de voormalige ouder — precies wat de
      // interface-comment belooft. Zoek daarvoor de positie van `parent` in DIENS
      // eigen siblinglijst: de childIds van de grootouder, of — als `parent` op rootniveau
      // staat — de root-volgorde uit de rauwe array (zie engine/view/dropTarget.ts).
      // Dat root-geval was het echte gat: daar werd de volgorde vroeger helemaal niet
      // bijgewerkt, waardoor de taak op zijn oude (meestal laatste) array-plek bleef staan.
      const parentSiblingIds = parent.parentId
        ? (tasks.find(t => t.id === parent.parentId)?.childIds ?? [])
        : tasks.filter(t => !t.parentId).map(t => t.id);
      const parentIdx = parentSiblingIds.indexOf(parent.id);
      // `parent` niet in zijn eigen siblinglijst (corrupte state): achteraan, zoals vroeger.
      const childIndex = parentIdx >= 0 ? parentIdx + 1 : parentSiblingIds.length;

      // Zelfde plaatsingslogica als rij-slepen (`moveTaskTo`), inclusief het synchroon houden
      // van parentId + childIds + rauwe array. `rejectNoOp: false`: uitspringen is per definitie
      // een reparent, dus de no-op-guard kan hier nooit terecht afgaan — uitgezet zodat hij een
      // legitieme herplaatsing niet per ongeluk kan tegenhouden.
      const plan = planTaskPlacement(
        tasks, id, { parentId: parent.parentId, childIndex }, { rejectNoOp: false },
      );
      if (!plan) continue; // alleen bij een kapotte boom (bv. verweesde grootouder-id).
      applyTaskPlacement(tasks, id, plan);
      changed = true;
    }
    return { changed, reparented: changed };
  };
}

/**
 * Mag `moveTask(id, newParentId, position)`? Dezelfde proef als de actie zelf doet — voor wie vóór
 * de actie moet weten of hij doorgaat: "Taak bewerken" (weigeren vóór het opslaan, zodat een
 * geweigerde ouder niet de rest van de bewerking half laat doorgaan) en MCP `planner_move_task`
 * (weigeren als stapfout vóór de mutatie, in plaats van pas bij de eindberekening).
 */
export function moveTaskVerdict(
  state: RelationTree,
  id: string,
  newParentId: string | null,
  position?: number,
): HierarchyChangeVerdict {
  return hierarchyChangeVerdict(state, moveTaskEdit(id, newParentId, position));
}

type SliceSet = Parameters<AppSlice<TaskSlice>>[0];
type SliceGet = Parameters<AppSlice<TaskSlice>>[1];

/**
 * De ene weg voor een verhanging: proef + kringtoets, en pas dan de mutatie.
 *  - kring ⇒ melding die de kring noemt, verder NIETS: geen snapshot, geen undo-stap, geen
 *    isDirty/stale (audit taakmutaties, S4);
 *  - niets te verhangen (onbekende taak, cykelguard in de boom, al op zijn plek) ⇒ niets, zoals
 *    voorheen de lazy snapshot al garandeerde;
 *  - anders: één undo-stap, WBS-hernummering, `stale` naar `staleWhen` (pure herordening binnen
 *    dezelfde ouder raakt geen summary-rollups — `moveTaskTo`/`moveTasksTo`), en de melding over
 *    relaties die door het verhangen niet meer meetellen (`watchAncestorRelations`).
 * De meldingen staan BUITEN de producer (`notify` doet zelf een `set()`).
 */
function applyHierarchyEdit(
  runtime: StoreRuntime,
  set: SliceSet,
  get: SliceGet,
  edit: HierarchyEdit,
  staleWhen: 'always' | 'on-reparent',
): void {
  const before = get();
  const verdict = hierarchyChangeVerdict(before, edit);
  if (!verdict.ok) {
    notifyHierarchyCycle(before, verdict.cycle);
    return;
  }
  if (!verdict.changed) return;
  // "Wordt fase" (#210, audit §6): krijgt een taak zonder kinderen door deze verhanging haar eerste
  // kinderen, dan verhuizen haar toewijzingen naar de eerste nieuwe subtaak — of weigert de hele
  // handeling, vóór snapshot en mutatie, net als de kringtoets hierboven.
  const phasePlan = planPhaseTransitions(before, hierarchyPhaseGains(before.tasks, edit));
  if (!phasePlan.ok) {
    get().notify(phaseRefusalNotice(before, phasePlan.refusal));
    return;
  }
  const outcome = emptyOutcome();
  const reportAncestorRelations = watchAncestorRelations(before);
  set((s) => {
    runtime.beginUndoable(s); // één undo-stap, vóór de eerste draftmutatie (zie state/transaction.ts).
    edit(s.tasks);
    if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
    settlePhaseTransitions(s, phasePlan.transitions, outcome);
    // Datum-rakende mutatie (A6): planning verouderd tot F5 — behalve pure herordening.
    runtime.finishMutation(s, { stale: staleWhen === 'always' || verdict.reparented });
  });
  finishStructural(get, outcome);
  reportAncestorRelations(get());
  get().recomputeViewRows();
}

/**
 * De "wordt fase"-winst van een boomwijziging (integratie groep C: #210 × #234): welke taken hadden
 * vóór `edit` geen kinderen en erna wel, met hun nieuwe kinderen in de eindvolgorde — dezelfde vorm
 * als `firstChildGains`, maar afgelezen van DEZELFDE boomwijziging die de actie en de kringproef
 * draaien, zodat de regel voor elke verhangroute (`moveTask`, `moveTaskTo`, `moveTasksTo`,
 * `indentTasks`, `outdentTasks`) vanzelf klopt. Proef op een kopie; de state blijft onaangeroerd.
 */
function hierarchyPhaseGains(tasks: readonly Task[], edit: HierarchyEdit): PhaseGain[] {
  const trial = tasks.map(task => ({ ...task, childIds: [...task.childIds] }));
  edit(trial);
  const hadChildren = new Map(tasks.map(task => [task.id, task.childIds.length > 0]));
  return trial
    .filter(task => hadChildren.get(task.id) === false && task.childIds.length > 0)
    .map(task => ({ phaseId: task.id, childIds: [...task.childIds] }));
}

/**
 * De siblinglijst van `parentId` in DISPLAY-volgorde. Voor een echte ouder is dat gewoon zijn
 * `childIds`; op rootniveau bestaat die array niet — daar is de volgorde de relatieve volgorde
 * binnen de rauwe `tasks`-array (dezelfde afleiding als in `planTaskPlacement`, `outdentTasks` en
 * engine/view/dropTarget.ts). Gedeeld door `moveTasksTo`, dat na elke plaatsing opnieuw moet meten
 * waar een taak werkelijk geland is.
 */
// Compatibele export voor bestaande MCP-aanroepers; de ene implementatie leeft in taskEditPlan.
export { applyProgressInvariants };

/**
 * De ene commit van de voortgangssetters (`setTaskProgress`/`setActualStart`/`setActualFinish`,
 * fase 2.6) en van de UI-invoer (`enterTaskProgress`), binnen hun producer. Wat de bewerking doet,
 * beslist `planProgressEntry` (engine/progressEntry.ts) — dezelfde functies die ook de concepttaak in
 * "Taak bewerken" gebruikt (`state/taskDialogSave.ts`); deze functie legt die uitkomst alleen vast.
 *
 * Verandert de bewerking per saldo niets aan de taak, dan is ze een no-op — dezelfde regel als
 * `updateTask`: geen snapshot, geen gevolgregel (`clearLevelingGaps`), geen `isDirty`, geen stale
 * (en dus ook niet uit "datums zoals opgeslagen"). Het contextmenu zet de voortgang op de hele
 * selectie, ook op taken die al op die waarde staan; en een slider of datumveld meldt dezelfde
 * waarde soms nog eens. Beslist op de UITKOMST, niet op de invoer: een 50%-taak zonder `actualStart`
 * opnieuw op 50% zetten vult die start in, en dát is wel een wijziging. Een no-op raakt ook de
 * undo-coalescing niet aan, dus een lopende slider-sleep blijft één stap.
 *
 * Z1 (alleen met `ctx.today`, de UI): gaat de statusdatum op vandaag, dan gebeurt dat in dezelfde
 * snapshot als de voortgang — één undo-stap. Retourneert die datum, zodat de aanroeper ná `set()`
 * kan melden.
 */
function commitProgressEdit(
  runtime: StoreRuntime,
  s: AppState,
  taskId: string,
  edit: ProgressEdit,
  ctx: Omit<ProgressEntryContext, 'statusDate'>,
  opts: { coalesceKey?: string } | undefined,
): ProgressEntryResult & { statusDateToday?: string } {
  const task = s.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: true }; // onbekende taak: stille no-op, zoals voorheen
  // Voortgang op een verzameltaak is alleen-lezen: de rollup in `applyCpmResult` leidt haar af uit
  // de bladen. Weigeren vóór elke mutatie, dus zonder snapshot (transaction.ts-patroon).
  if (isSummaryTask(task)) return { ok: false, reason: 'summaryTask' };
  // Actuals liggen nooit ná de statusdatum — weigeren i.p.v. stil klemmen (§3.2, BESLIST), zonder
  // snapshot. T16-veeglijst-fix: `isActualPastStatusDate` vergelijkt geparste instanten i.p.v. rauwe
  // ISO-strings (het uur-precies-op-de-statusdatum-dag-gat).
  const plan = planProgressEntry(task, edit, { ...ctx, statusDate: s.project.statusDate });
  if (!plan.ok) return plan;
  if (!plan.change) return { ok: true };
  runtime.beginUndoable(s, opts); // `opts` = coalesceKey (slider-sleep / per-toetsaanslag-commits = 1 stap).
  // Fable-critreview #170, bevinding 1: voortgang verplaatst opgeslagen werk van rest naar verricht —
  // momentopname op de ongewijzigde taak, settle ná de mutatie. Integratie groep B (besluit 5): ná
  // de no-op-check, zodat een no-op ook het werk niet raakt.
  const progressWork = captureProgressWork(task, s);
  const { statusDateToday } = plan.change;
  if (statusDateToday) {
    s.project.statusDate = statusDateToday;
    s.project.modifiedAt = new Date().toISOString();
  }
  task.time = plan.change.task.time;
  task.status = plan.change.task.status;
  settleProgressWork(task, s.assignments, progressWork);
  // B1c-plan-2 spec §4 "Invalidatie", vierde klasse — bedraad in de fixronde op etappe 3
  // (bevinding B7). Voortgang loopt buiten `updateTask` om, dus deze setters hebben hun eigen
  // aanroep; zie `LEVELING_GAP_TIME_TRIGGERS` in taskDefaults.ts voor het waarom.
  clearLevelingGaps(task);
  // H1 (Opus-review T15-iteratie-2): ALTIJD stale — sinds `applyProgressInvariants`'s
  // completion===1-tak niet meer op een statusdatum leunt (die pint nu altijd op actuals/eigen
  // finish, zie de toelichting daar) én de IN-PROGRESS-tak in CPMSolver (M1) evenmin, is elke
  // voortgangsmutatie datum-beïnvloedend, met of zonder statusdatum. Het oude commentaar
  // ("alleen datum-beïnvloedend mét statusdatum") was juist tot vóór die fixes.
  runtime.finishMutation(s, { stale: true });
  return statusDateToday ? { ok: true, statusDateToday } : { ok: true };
}

/**
 * Wat een structuuractie (verhangen, inspringen, een kind toevoegen) na haar producer nog moet doen
 * — de "wordt fase"-regel uit `structuralTransition.ts`: meldingen (via het ene kanaal, dus BUITEN de
 * producer), het verlies van MSP-sturing door verhuisde toewijzingen, en een verse belasting.
 */
interface StructuralOutcome {
  notices: NotifyInput[];
  lostSteering: number;
  assignmentsMoved: boolean;
}
const emptyOutcome = (): StructuralOutcome => ({ notices: [], lostSteering: 0, assignmentsMoved: false });

/** Binnen de producer, NA de structuurmutatie en in dezelfde undo-stap: voer het plan uit. */
function settlePhaseTransitions(s: AppState, transitions: readonly PhaseTransition[], outcome: StructuralOutcome): void {
  if (transitions.length === 0) return;
  outcome.lostSteering += applyPhaseTransitions(s, transitions).length;
  outcome.notices.push(...phaseTransitionNotices(s, transitions));
  if (transitions.some(t => t.assignmentIds.length > 0)) outcome.assignmentsMoved = true;
}

/** Buiten de producer: meldingen en belasting. */
function finishStructural(get: () => AppState, outcome: StructuralOutcome): void {
  for (const notice of outcome.notices) get().notify(notice);
  if (outcome.lostSteering > 0) notifyTimephasedLoss(get().notify, get().activeDocumentId, outcome.lostSteering);
  if (outcome.assignmentsMoved) get().recomputeResourceLoad();
}

export const createTaskSlice: AppSliceFactory<TaskSlice> = (runtime) => (set, get) => ({
  tasks: [],

  addTask: (partial) => {
    const id = generateId('task');
    const outcome = emptyOutcome();
    let refused = false;
    set((s) => {
      // Golf 1 (fase 2.10, Insert/contextmenu "invoegen boven/onder"): een geldige `position`
      // bepaalt zowel de OUDER (die van de anker) als de invoegplek — de aanroeper hoeft dan geen
      // (of een niet-matchende) `parentId` mee te geven. Onbekende anchorId ⇒ stille tolerantie:
      // terugval op het standaardgedrag (achteraan, partial.parentId).
      const anchorTask = partial.position
        ? s.tasks.find(t => t.id === partial.position!.anchorId)
        : undefined;
      const parentId = anchorTask ? anchorTask.parentId : (partial.parentId || null);
      const parentTask = parentId ? s.tasks.find(t => t.id === parentId) : undefined;

      // Wordt de ouder hierdoor een fase (audit §6)? Plan VÓÓR enige mutatie: een weigering laat
      // geen taak en geen undo-stap achter.
      const pending = new Map<string, PendingChild>([[id, {
        name: partial.name, isMilestone: !!partial.isMilestone, hasChildren: false,
      }]]);
      const phasePlan = planPhaseTransitions(s, firstChildGains(s.tasks, [{ childId: id, parentId }]), pending);
      if (!phasePlan.ok) {
        outcome.notices.push(phaseRefusalNotice(s, phasePlan.refusal, pending));
        refused = true;
        return;
      }

      runtime.beginUndoable(s);

      const now = s.project.startDate || formatDate(new Date());
      const effectiveNewTaskCalendar = resolveCalendar(partial.calendarId, s.calendars, s.calendar);
      const defaultDurationUnit = s.ui.enableHourPlanning
        && s.project.defaultTaskDurationUnit === 'hours'
        && hasConcreteWorkBlocks(effectiveNewTaskCalendar)
        ? 'hours'
        : 'days';
      const initialTime = mergeTaskTime(createDefaultTaskTime(
        now,
        partial.isMilestone ? 0 : 5,
        defaultDurationUnit,
        effectiveNewTaskCalendar,
      ), partial.time);
      deriveScheduleDurationFromMinutes(initialTime, effHoursPerDay(effectiveNewTaskCalendar));

      // Veld-voor-veld-afleiding incl. taaktype-overerving van de ouder: één definitie met het
      // MCP-pad (`draft.addTask`), zie `buildNewTask` in taskDefaults.ts.
      const task = buildNewTask(partial, {
        id, parentId, parentTask, constructionMode: s.ui.constructionMode, time: initialTime,
      });
      // B1-vervolg: de solve schrijft `scheduleFinish` niet meer terug, dus een nieuwe urentaak krijgt
      // hier haar ingevoerde einde (start + duur op de echte kalender), zie `seedNewHourTaskFinish`.
      seedNewHourTaskFinish(task, partial.time, effectiveNewTaskCalendar);
      if (partial.workRule !== undefined) s.taskTypesVisible = true; // review K3

      // Zonder `position` (of een onbekende anker): exact het bestaande gedrag — achteraan.
      // Mét een geldige anker: vlak vóór/ná de anker inserten, zowel in de rauwe array (bepaalt
      // de ROOT-siblingvolgorde, zie reorderSibling hieronder + wbs.ts/flattenOrder) als in de
      // childIds van de ouder (bepaalt de zichtbare volgorde voor niet-root taken, zie
      // engine/view/visibleRows.ts) — zo blijven beide consistent met de anker-positie.
      if (anchorTask) {
        const anchorIdx = s.tasks.findIndex(t => t.id === anchorTask.id);
        const insertAt = partial.position!.where === 'above' ? anchorIdx : anchorIdx + 1;
        s.tasks.splice(insertAt, 0, task);
      } else {
        s.tasks.push(task);
      }

      // Add to parent's children
      if (task.parentId) {
        const parent = s.tasks.find(t => t.id === task.parentId);
        if (parent) {
          if (anchorTask) {
            const anchorChildIdx = parent.childIds.indexOf(anchorTask.id);
            const insertAt = anchorChildIdx >= 0
              ? (partial.position!.where === 'above' ? anchorChildIdx : anchorChildIdx + 1)
              : parent.childIds.length;
            parent.childIds.splice(insertAt, 0, id);
          } else {
            parent.childIds.push(id);
          }
        }
      }

      // WBS-code: bij auto-nummering de hele boom; anders alleen een afgeleide code wanneer de
      // aanroeper er zelf geen meegaf.
      if (s.project.wbsAutoNumber || !partial.wbsCode) assignInsertedWbsCodes(s, [id]);

      settlePhaseTransitions(s, phasePlan.transitions, outcome);
      runtime.finishMutation(s, { stale: true }); // nieuwe taak (A6): planning verouderd tot F5.
    });
    finishStructural(get, outcome);
    if (refused) return '';
    get().recomputeViewRows();
    return id;
  },

  updateTask: (id, updates, opts) => {
    // mpp-nul-data-etappe, DEEL 1 — buiten de Immer-producer bijgehouden (zelfde discipline als
    // `fileSlice.ts`'s `applyLoadedProject`: `notify` doet zelf een `set()`, dus nooit ván bínnen
    // een lopende producer aanroepen). `true` alleen bij een ECHT verlies, zie taskDefaults.ts.
    let lostTimephasedGuidance = false;
    let refusedNotices: NotifyInput[] = [];
    set((s) => {
      const idx = s.tasks.findIndex(t => t.id === id);
      if (idx < 0) return; // onbekend id: geen snapshot, geen loze undo-stap (R3).
      const task = s.tasks[idx];
      // Start is verplicht (vangnet onder paneel, dialoog en extensie-API, #200): een onleesbare
      // `scheduleStart` (bv. `''` uit een leeggemaakt datumveld) maakt het HELE project onberekenbaar
      // ("Ongeldige startdatum") en wordt bij heropenen stil "vandaag". Het raster weigert dit al met
      // `required`; hier blijft het bestaande anker staan en gaat de rest van de patch gewoon door.
      // Bleef er daarna niets te wijzigen over, dan vangt de no-op-guard hieronder dat (R3).
      if (updates.time && 'scheduleStart' in updates.time && isNaN(parseDate(updates.time.scheduleStart ?? '').getTime())) {
        updates = { ...updates, time: { ...updates.time, scheduleStart: task.time.scheduleStart } };
      }
      // Wordt mijlpaal (audit §6): dezelfde regel als raster en MCP. Een fase of een taak met
      // toewijzingen weigert de HELE patch — een halve patch (bv. duur 0 zonder de mijlpaalvlag)
      // zou erger zijn. Paneel, dialoog en contextmenu toetsen dit al vóór ze hier komen.
      if (updates.isMilestone === true && !task.isMilestone) {
        const refusal = milestoneRefusal({
          hasChildren: isSummaryTask(task),
          hasAssignments: s.assignments.some(a => a.taskId === id),
        });
        if (refusal) {
          refusedNotices = milestoneRefusalNotices([{ name: task.name, refusal }]);
          return;
        }
      }
      // T14b-vervolg (gebruikstestbevinding): `updates.time` (indien meegegeven) apart mergen tegen
      // de BESTAANDE tijd van de taak i.p.v. 'm via Object.assign in zijn geheel te laten vervangen —
      // anders wist een PARTIEEL time-object (bv. via de publieke `api.data.updateTask`, waar de
      // `ExtTaskTime`-volledigheid niet op runtime wordt afgedwongen) stil bestaande verplichte velden
      // (completion/floats/…) tot een lege plek diezelfde writeIFC-crash weer opende. Zie
      // `mergeTaskTime` in taskDefaults.ts voor de ADD-vs-UPDATE-basissemantiek.
      const next = mergeTaskUpdate(task, updates);
      // Per saldo niets gewijzigd — "Taak bewerken" → OK zonder wijziging stuurt álle velden terug
      // (TaskDialog.handleSave) — ⇒ net als een onbekend id: geen snapshot, geen isDirty, geen
      // gevolgregel en dus ook geen melding (#186).
      if (sameValue(task, next)) return;
      // Eigenaarsbesluit 2026-09-26 (optie 2): een nieuwe duur korter dan het gedane werk van een
      // lopende taak wordt geweigerd — vóór de snapshot, dus niets veranderd, met een melding
      // (paneel, Gantt, extensie-API). Dezelfde regel die hieronder de rest laat meeschuiven, zie
      // `durationEditRefusal`/`carryRemainingThroughDurationEdit` in engine/work/workRuleApply.ts.
      if (taskTriggerChanges(task, next).timeBase) {
        const refusal = durationEditRefusal(task, next.time, taskCalendarHoursPerDay(next, s.calendars, s.calendar));
        if (refusal) {
          refusedNotices = [durationBelowDoneWorkNotice(task)];
          return;
        }
      }
      runtime.beginUndoable(s, opts); // snapshot pas ná de guards, vóór de mutatie; `opts` = coalesceKey (bv. balk-sleep = 1 stap).
      // Taaktypes-etappe (reviewbevinding K1): `workRule` loopt niet via de kale merge maar via
      // `settleRuleChange` (legt onder een werkbeschermende regel het restwerk vast — besluit 2),
      // zodat `updateTask(id, { workRule })` (extensie-`data.updateTask`, dialogen) hetzelfde doet
      // als `setTaskWorkRule`.
      // `updates` is hierboven al start-gecontroleerd (#199/#200).
      const { time, workRule, calendarId, ...rest } = updates;
      // B1-vervolg — de basis van het ingevoerde einde VÓÓR elke mutatie, dus ook vóór de K2-
      // kalenderstap hieronder (integratie #101, valkuil b): anders zit de kalenderwissel al in de
      // sleutel van de basis, ziet `reconcileHourInputFinish` "geen invoerwijziging" en blijft het
      // ingevoerde einde op de oude kalender staan.
      const finishBasis = hourInputFinishBasis(task);
      // K2 (eigenaarsbesluit 2026-09-05): een kalenderwissel EERST en apart — de slotgrootte
      // verandert en de werkregel beslist wat meebeweegt (`settleCalendarChange`); daarna pas de
      // momentopname voor een eventuele duurwijziging in dezelfde patch, zodat die op de nieuwe slot rekent.
      const calendarChanged = 'calendarId' in updates && task.calendarId !== calendarId;
      if (calendarChanged) {
        const before = captureCalendarChange(task, s.assignments, s);
        task.calendarId = calendarId;
        lostTimephasedGuidance = settleCalendarChange(task, s.assignments, before, s).timephasedLost;
      }
      // WANNEER de gevolgregels hieronder vuren: alleen als de relevante WAARDE echt verandert, niet
      // omdat de sleutel is meegestuurd — de ene definitie die dit pad deelt met het taakraster en de
      // MCP-draft, zie `taskTriggerChanges` in taskDefaults.ts (#186). Gemeten ná de kalenderstap,
      // tegen de taak zoals die er dan staat (integratie groep B × #170).
      const afterRest = mergeTaskUpdate(task, time ? { ...rest, time } : rest);
      const changes = taskTriggerChanges(task, afterRest);
      // Contour-engine (2026-09): de oude werkduur vóór de merge, voor de herschaling hieronder —
      // ná de kalenderstap, zodat een duur in dezelfde patch tegen de nieuwe slot rekent (F2-tweeling).
      const contourHpd = taskCalendarHoursPerDay(task, s.calendars, s.calendar);
      const oldWorkMinutes = taskWorkMinutesOf(task, contourHpd);
      // Taaktypes-etappe (2026-09, bouwstap 4): momentopname van de werkdriehoek VÓÓR de merge —
      // een duurwijziging laat de toewijzingen hun regel volgen (`settleDurationEdit` hieronder).
      const triangle = changes.timeBase ? captureTriangle(task, s.assignments, s) : null;
      // Fable-critreview #170, bevinding 1: een voortgangspatch (completion/rest) verplaatst opgeslagen
      // werk van rest naar verricht — `settleProgressWork` hieronder; een duurpatch laat hij liggen.
      const progressWork = time ? captureProgressWork(task, s) : null;
      // De tijd van vóór de merge (kopie): de restregel meet daaraan het gedane werk.
      const timeBefore = { ...task.time };
      Object.assign(task, rest);
      if (time) task.time = afterRest.time;
      if (changes.timeBase) {
        // Eigenaarsbesluiten 2026-09-05/26: een lopende taak houdt haar gedane werk — de rest schuift
        // mee met het duurverschil, het percentage volgt (`carryRemainingThroughDurationEdit`; de
        // weigering stond hierboven al). Vóór de driehoekstap, die de rest leest. Niet als de patch
        // zelf voortgang opgaf: die wint.
        carryRemainingThroughDurationEdit(task, timeBefore, contourHpd, s.project.statusDate);
        // Duur-/datumwijziging: contour meeschalen (werkbehoud volgens de werkregel), gebruikersgaten
        // afknippen (issue #146), laag 3/4 ontkoppelen en nivelleergaten wissen — de gevolgregels die
        // dit pad deelt met het taakraster en de MCP-draft, zie `applyDurationChangeRules` in
        // taskDefaults.ts (de kern van `settleDurationAftermath`). Een kale datumwijziging telt hier
        // mee; de werkduur blijft dan gelijk, dus meeschalen en afknippen doen niets.
        lostTimephasedGuidance = applyDurationChangeRules(task, oldWorkMinutes, contourHpd, {
          keepWork: contourKeepsWork(task, s.project.defaultWorkRule),
        }) || lostTimephasedGuidance;
        // Spec §5 rij 1: werk beschermd ⇒ inzet = W / R'; anders volgt een aanwezig werkveld de
        // nieuwe duur. Onder de standaardregel zonder werkvelden gebeurt er niets (byte-identiek).
        settleDurationEdit(task, s.assignments, triangle);
      }
      settleProgressWork(task, s.assignments, progressWork);
      if ('workRule' in updates && task.workRule !== workRule) {
        settleRuleChange(task, s.assignments, s, workRule);
        if (workRule !== undefined) s.taskTypesVisible = true; // review K3: elk schrijfpad ontsluit.
      }
      reconcileP6SuspendResume(task);
      // Z14b (eigenaarsprincipe 2026-08-18) — ook een kalenderwissel ontkoppelt het GELEZEN Z8-venster
      // van de motor; de rauwe bron (`timephasedContours`) blijft staan. Zie `taskDefaults.ts`'s
      // `clearTimephasedWindow` voor de volledige triggerset.
      // N2 (Opus-her-check, tweede ronde) — laag 4 stroomt NIET altijd live mee: een walk met
      // bevroren `workMinutes` negeert een wijziging anders stilzwijgend.
      if (calendarChanged) {
        lostTimephasedGuidance = invalidateForTimeBaseChange(task) || lostTimephasedGuidance;
      }
      // B1c-plan3 taak 3 (spec §4, "Invalidatie"): een bewerking die de tijdbasis van de taak verzet,
      // maakt ook een door de nivelleerder ingevoegde pauzedag ongeldig — het gat ligt dan op een
      // verouderde tijd-as. EIGEN POORT sinds de fixronde op etappe 3 (bevinding B7): de triggerset is
      // BREDER dan die van het Z8-venster — voortgang en constraints horen erbij. Zie
      // `LEVELING_GAP_TIME_TRIGGERS` in taskDefaults.ts. (Bij een duur-/datumwijziging deed
      // `applyDurationChangeRules` dit al; dan is deze aanroep een no-op.) De kalenderwissel is al
      // vóór `changes` doorgevoerd, dus die telt hier apart mee (integratie #101, valkuil a).
      if (changes.levelingGaps || calendarChanged) clearLevelingGaps(task);
      // B1-vervolg: het ingevoerde einde van een niet-gestarte urentaak beweegt mee met duur/start/
      // kalender — aan de INVOERKANT, nooit vanuit de solve. Zie `reconcileHourInputFinish`. BEWUST
      // NA `clearLevelingGaps`: anders telt het einde nivelleergaten mee die deze bewerking wist.
      reconcileHourInputFinish(task, finishBasis, resolveCalendar(task.calendarId, s.calendars, s.calendar));
      // Datum-rakende mutatie (duur/start/constraint/mijlpaal → planning verouderd tot F5, A6).
      runtime.finishMutation(s, { stale: true });
    });
    for (const notice of refusedNotices) get().notify(notice);
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    get().recomputeViewRows();
  },

  setTaskWorkRule: (id, rule) => {
    set((s) => {
      const task = s.tasks.find(t => t.id === id);
      if (!task || task.workRule === rule) return; // onbekend id of ongewijzigd: geen snapshot.
      runtime.beginUndoable(s);
      settleRuleChange(task, s.assignments, s, rule);
      s.taskTypesVisible = true; // spec §7: wie een regel zet, ziet de regel (documentontsluiting).
      runtime.finishMutation(s); // geen `stale`: een typewissel raakt geen datum (spec besluit 2).
    });
    get().recomputeResourceLoad(); // een vastgelegd restwerk kan de vierde bron van `assignmentDayUnits` activeren.
    get().recomputeViewRows();
  },

  setTaskSplits: (taskId, pieces, opts) => {
    // mpp-nul-data-etappe, DEEL 1 — zie `updateTask` hierboven: `notify` doet zelf een `set()`.
    let lostTimephasedGuidance = false;
    let refusal: SplitRefusal | null = null;
    set((s) => {
      // (1) Weigeren — vóór élke draftmutatie, dus geen snapshot en geen halve state.
      const task = s.tasks.find(t => t.id === taskId);
      // Onbekend id: er valt hier niets te bewerken. Bewust dezelfde reden als een niet-bewerkbare
      // split i.p.v. een extra enum-lid — de aanroepers (paneel, Gantt) lossen het taak-id
      // sowieso zelf op vóór ze hier komen.
      if (!task) { refusal = 'not-editable'; return; }
      const hoursPerDay = taskCalendarHoursPerDay(task, s.calendars, s.calendar);
      refusal = taskSplitRefusal(task, pieces, hoursPerDay);
      if (refusal) return;

      // (2) Undo-snapshot; `opts` draagt de coalesceKey van één sleepgebaar.
      runtime.beginUndoable(s, opts);

      // (3)–(7) Het gedeelde lichaam (`splitMutations.ts`, ook de MCP-draft): gaten, werkduur,
      // contour, tijdbasis-gevolgen en de eigen finish.
      lostTimephasedGuidance = applyTaskSplits(s, task, pieces, hoursPerDay);

      // (8) `markScheduleStale` via `finishMutation` — nooit de vlag rechtstreeks (issue #63).
      runtime.finishMutation(s, { stale: true });
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    get().recomputeViewRows();
    return refusal;
  },

  setTaskCalendar: (taskId, calendarId) => {
    // mpp-nul-data-etappe, DEEL 1 — zie `updateTask` hierboven.
    let lostTimephasedGuidance = false;
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.calendarId === calendarId) return; // no-op: geen snapshot, geen stale
      runtime.beginUndoable(s);
      // B1-vervolg — basis VÓÓR de wissel (integratie #101: vóór de K2-stap, anders zit de
      // kalenderwissel niet in de sleutel en blijft het ingevoerde einde oud).
      const finishBasis = hourInputFinishBasis(task);
      // K2 (eigenaarsbesluit 2026-09-05): momentopname vóór de wissel; daarna beslist de werkregel.
      const before = captureCalendarChange(task, s.assignments, s);
      task.calendarId = calendarId; // undefined = projectkalender
      const settled = settleCalendarChange(task, s.assignments, before, s);
      // Z14b — kalenderwissel is een trigger, zie taskDefaults.ts. De nazorg van de regel kan het
      // venster al gewist hebben (dan is die tweede aanroep een no-op): beide tellen als verlies.
      lostTimephasedGuidance = settled.timephasedLost || clearTimephasedWindow(task);
      // B1c-plan3 taak 3 — zie `updateTask` hierboven.
      clearLevelingGaps(task);
      // B1-vervolg — ná `clearLevelingGaps`, zie `updateTask`.
      reconcileHourInputFinish(task, finishBasis, resolveCalendar(calendarId, s.calendars, s.calendar));
      runtime.finishMutation(s, { stale: true }); // taak-kalender-toewijzing is datum-beïnvloedend (§5.4).
    });
    if (lostTimephasedGuidance) notifyTimephasedLoss(get().notify, get().activeDocumentId, 1);
    get().recomputeViewRows();
  },

  addExternalLink: (taskId, link) => {
    const id = generateId('extlink');
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return;
      runtime.beginUndoable(s);
      const full: ExternalLink = { ...link, id };
      task.externalLinks = [...(task.externalLinks ?? []), full];
      runtime.finishMutation(s, { stale: true }); // een bevroren datum-grens is datum-beïnvloedend (§4.5).
    });
    get().recomputeViewRows();
    return id;
  },

  updateExternalLink: (taskId, linkId, link) => {
    let found = false;
    let changed = false;
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      const index = task?.externalLinks?.findIndex(candidate => candidate.id === linkId) ?? -1;
      if (!task?.externalLinks || index < 0) return;
      found = true;
      const current = task.externalLinks[index];
      const next: ExternalLink = { ...link, id: linkId };
      if (sameExternalLink(current, next)) return;
      runtime.beginUndoable(s);
      task.externalLinks = task.externalLinks.map((candidate, candidateIndex) => (
        candidateIndex === index ? next : candidate
      ));
      runtime.finishMutation(s, { stale: true });
      changed = true;
    });
    if (changed) get().recomputeViewRows();
    return found;
  },

  removeExternalLink: (taskId, linkId) => {
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task || !task.externalLinks) return;
      const next = task.externalLinks.filter((l) => l.id !== linkId);
      if (next.length === task.externalLinks.length) return; // no-op: niets verwijderd
      runtime.beginUndoable(s);
      task.externalLinks = next.length > 0 ? next : undefined;
      runtime.finishMutation(s, { stale: true });
    });
    get().recomputeViewRows();
  },

  deleteTask: (id) => {
    set((s) => {
      const task = s.tasks.find(t => t.id === id);
      if (!task) return; // onbekend id: geen snapshot, geen loze undo-stap.
      runtime.beginUndoable(s);
      removeTaskSubtrees(s, [id]);
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      runtime.finishMutation(s, { stale: true }); // datum-rakende mutatie (A6): planning verouderd tot F5.
    });
    get().recomputeViewRows();
  },

  deleteTasksBulk: (ids) => {
    const frozen = [...ids];
    if (frozen.length === 0) return;
    if (frozen.length === 1) {
      get().deleteTask(frozen[0]);
      return;
    }

    set((s) => {
      const roots = frozen.filter((id) => s.tasks.some((task) => task.id === id));
      if (roots.length === 0) return;
      runtime.beginUndoable(s);
      removeTaskSubtrees(s, roots);
      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      runtime.finishMutation(s, { stale: true });
    });
    get().recomputeViewRows();
  },

  // Alle verhangroutes lopen via `applyHierarchyEdit`: eerst de proef met de kringtoets
  // (`hierarchyChangeVerdict`), dan pas de mutatie — geweigerd ⇒ melding, geen wijziging, geen
  // undo-stap. De boomwijziging zelf staat per route in een `HierarchyEdit` bovenaan dit bestand.
  moveTask: (id, newParentId, position) => {
    applyHierarchyEdit(runtime, set, get, moveTaskEdit(id, newParentId, position), 'always');
  },

  moveTaskTo: (id, target) => {
    applyHierarchyEdit(runtime, set, get, moveTaskToEdit(id, target), 'on-reparent');
  },

  moveTasksTo: (ids, target) => {
    // De selectie blijft bewust ongemoeid: de gebruiker heeft na de sleep nog dezelfde taken vast.
    applyHierarchyEdit(runtime, set, get, moveTasksToEdit(ids, target), 'on-reparent');
  },

  indentTasks: (ids) => {
    applyHierarchyEdit(runtime, set, get, indentEdit(ids), 'always');
  },

  outdentTasks: (ids) => {
    applyHierarchyEdit(runtime, set, get, outdentEdit(ids), 'always');
  },

  reorderSibling: (taskId, direction) => {
    set((s) => {
      const task = s.tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.parentId) {
        // Niet-root: sibling-volgorde = childIds-volgorde van de ouder (zie visibleRows.ts).
        const parent = s.tasks.find(t => t.id === task.parentId);
        if (!parent) return;
        const idx = parent.childIds.indexOf(taskId);
        if (idx < 0) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= parent.childIds.length) return; // rand: no-op
        const otherId = parent.childIds[swapIdx];

        runtime.beginUndoable(s);
        const tmp = parent.childIds[idx];
        parent.childIds[idx] = parent.childIds[swapIdx];
        parent.childIds[swapIdx] = tmp;

        // Rauwe s.tasks-array meeschuiven (WBS/flattenOrder-bron, zie utils/wbs.ts) —
        // ENKEL-NODE-splice, exact zoals moveTaskTo hierboven (:414-434): alleen `taskId`
        // zelf verhuist relatief t.o.v. `otherId`, subtrees blijven via parentId gewoon
        // hangen. Zonder deze stap loopt de WBS-nummering (raw-array-volgorde) uit de pas
        // met de weergave (childIds-volgorde, zie visibleRows.ts:242).
        const rawIdx = s.tasks.findIndex(t => t.id === taskId);
        const [node] = s.tasks.splice(rawIdx, 1);
        const otherRawIdx = s.tasks.findIndex(t => t.id === otherId);
        if (direction === 'up') {
          s.tasks.splice(otherRawIdx, 0, node); // vóór otherId
        } else {
          s.tasks.splice(otherRawIdx + 1, 0, node); // ná otherId
        }
      } else {
        // Root-niveau: er is geen aparte root-childIds-array — de sibling-volgorde is de
        // relatieve positie binnen de rauwe `s.tasks`-array (zie flattenOrder in utils/wbs.ts en
        // de `tasks.filter(t => !t.parentId)`-root-scan in visibleRows.ts/printPreview/ifcWriter).
        // Verwissel daarom de twee betrokken taken op hun ABSOLUTE array-slot; alle andere taken
        // (root of niet) behouden hun eigen plek.
        const rootIds = s.tasks.filter(t => !t.parentId).map(t => t.id);
        const idx = rootIds.indexOf(taskId);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= rootIds.length) return; // rand: no-op

        const otherId = rootIds[swapIdx];
        const absA = s.tasks.findIndex(t => t.id === taskId);
        const absB = s.tasks.findIndex(t => t.id === otherId);

        runtime.beginUndoable(s);
        const tmp = s.tasks[absA];
        s.tasks[absA] = s.tasks[absB];
        s.tasks[absB] = tmp;
      }

      if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);
      // Geen scheduleStale: pure volgorde-mutatie, raakt geen tijden/CPM (golf 1-spec, expliciet).
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  renumberWbs: () => {
    set((s) => {
      runtime.beginUndoable(s);
      applyWbsNumbering(s.tasks);
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  insertWbsTemplate: (template, parentId) => {
    if (template.tasks.length === 0) return null;
    let newRootId: string | null = null;
    let skippedRelations = 0;
    const outcome = emptyOutcome();
    set((s) => {
      const idMap = new Map<string, string>();
      for (const tt of template.tasks) idMap.set(tt.id, generateId('task'));

      // Wordt `parentId` hierdoor een fase (audit §6)? De sjabloonwortel is het nieuwe kind.
      const root = [...template.tasks].reverse().find(tt => tt.parentId === null);
      const pending = new Map<string, PendingChild>();
      if (root) {
        pending.set(idMap.get(root.id)!, {
          name: root.name,
          isMilestone: root.isMilestone,
          hasChildren: template.tasks.some(c => c.parentId === root.id),
        });
      }
      const phasePlan = planPhaseTransitions(
        s, firstChildGains(s.tasks, [...pending.keys()].map(childId => ({ childId, parentId }))), pending,
      );
      if (!phasePlan.ok) {
        outcome.notices.push(phaseRefusalNotice(s, phasePlan.refusal, pending));
        return;
      }

      runtime.beginUndoable(s);

      const startDate = s.project.startDate || formatDate(new Date());

      for (const tt of template.tasks) {
        const id = idMap.get(tt.id)!;
        const parent = tt.parentId ? idMap.get(tt.parentId)! : parentId;
        if (tt.parentId === null) newRootId = id;
        s.tasks.push({
          id,
          name: tt.name,
          description: tt.description,
          wbsCode: '',
          taskType: tt.taskType,
          status: 'NOT_STARTED',
          isMilestone: tt.isMilestone,
          priority: 500,
          parentId: parent ?? null,
          childIds: template.tasks.filter(c => c.parentId === tt.id).map(c => idMap.get(c.id)!),
          // Het sjablooncontract draagt expliciet `durationDays`; behandel dat niet als een
          // handmatig nieuw-taakgetal dat door de projectstandaard van betekenis mag veranderen.
          time: createDefaultTaskTime(startDate, tt.isMilestone ? 0 : tt.durationDays, 'days'),
          resourceIds: [],
        });
      }
      if (parentId && newRootId) {
        const parent = s.tasks.find(t => t.id === parentId);
        if (parent) parent.childIds.push(newRootId);
      }
      // Een sjabloon is app-niveau data uit `localStorage` (zie `utils/wbsTemplates.ts`) en kan
      // dus, net als een tak uit het klembord, relaties dragen die de relatieregels weigeren.
      skippedRelations = insertRemappedRelations(s, template.sequences, idMap);
      assignInsertedWbsCodes(s, idMap.values());

      if (newRootId) {
        s.selectedTaskIds = [newRootId];
        s.activeTaskId = newRootId;
      }
      settlePhaseTransitions(s, phasePlan.transitions, outcome);
      runtime.finishMutation(s, { stale: true }); // ingevoegd WBS-sjabloon (A6): planning verouderd tot F5.
    });
    finishStructural(get, outcome);
    get().recomputeViewRows();
    // Ná `set()`: `get().notify(...)` binnen een actieve producer aanroepen kan niet.
    notifyRelationsSkipped(get().notify, skippedRelations, 'relations-skipped-on-insert-template');
    return newRootId;
  },

  setTaskProgress: (taskId, raw, opts) => {
    let accepted = true;
    // §3.2: % > 0 ⇒ gestart (auto actualStart, nooit ná het werkelijke einde), teruggedraaid
    // onder 100% ⇒ actualFinish vervalt. Dezelfde regel als de concept in "Taak bewerken"
    // (`draftWithProgress`). Verzameltaak (alleen-lezen), snapshot, nivelleergaten, stale, de
    // no-op-regel en de werknazorg (#170): zie `commitProgressEdit`.
    set((s) => { accepted = commitProgressEdit(runtime, s, taskId, { field: 'completion', value: raw }, {}, opts).ok; });
    get().recomputeViewRows();
    return accepted;
  },

  setActualStart: (taskId, date, opts) => {
    let accepted = true;
    set((s) => { accepted = commitProgressEdit(runtime, s, taskId, { field: 'actualStart', value: date }, {}, opts).ok; });
    get().recomputeViewRows();
    return accepted;
  },

  setActualFinish: (taskId, date, opts) => {
    let accepted = true;
    set((s) => { accepted = commitProgressEdit(runtime, s, taskId, { field: 'actualFinish', value: date }, {}, opts).ok; });
    get().recomputeViewRows();
    return accepted;
  },

  enterTaskProgress: (taskId, edit, opts) => {
    let result: ReturnType<typeof commitProgressEdit> = { ok: true };
    set((s) => {
      result = commitProgressEdit(
        runtime, s, taskId, edit, { today: opts.today, actualStart: opts.actualStart }, { coalesceKey: opts.coalesceKey },
      );
    });
    get().recomputeViewRows();
    // Ná `set()`: `get().notify(...)` binnen een actieve producer aanroepen kan niet.
    if (result.ok && result.statusDateToday) {
      get().notify(statusDateSetTodayNotice(result.statusDateToday, get().ui.dateNotation));
    }
    return result.ok ? { ok: true } : result;
  },

  previewProgressImport: (rows, overrides, opts) => {
    const s = get();
    return buildProgressImportPlan(rows, s.tasks, progressImportDeps(s, opts?.today), overrides);
  },

  // A4 (issue #27 etappe 2, T5): het plan wordt HIER, binnen dezelfde `set()`, opnieuw gebouwd
  // tegen de LIVE taken — nooit het (mogelijk verouderde) preview-plan hergebruikt (A8, drift).
  // Atomair: het hele plan staat vast vóórdat er iets geschreven wordt. Nul toepassingen ⇒ geen
  // snapshot (net als een geweigerde `setActualStart`); één undo-stap voor het HELE blad, nooit één
  // per rij.
  applyProgressImport: (rows, overrides, opts) => {
    let plan!: ProgressImportPlan;
    let statusDateToday: string | undefined;
    set((s) => {
      plan = buildProgressImportPlan(rows, s.tasks, progressImportDeps(s, opts?.today), overrides);
      if (plan.appliedCount === 0) return;
      runtime.beginUndoable(s);
      // Z1 (`ProgressImportEntryOptions`): houdt een toegepaste rij voortgang over en was er geen
      // statusdatum, dan gaat die in deze undo-stap op vandaag.
      if (!s.project.statusDate && opts?.today
        && plan.rows.some(row => row.outcome === 'apply' && row.plannedTask && hasRecordedProgress(row.plannedTask.time))) {
        s.project.statusDate = opts.today;
        s.project.modifiedAt = new Date().toISOString();
        statusDateToday = opts.today;
      }
      for (const row of plan.rows) {
        if (row.outcome !== 'apply') continue;
        const index = s.tasks.findIndex((t) => t.id === row.taskId);
        if (index >= 0) {
          // Fable-critreview #170, bevinding 1 — zelfde werkverplaatsing als `setTaskProgress`.
          const progressWork = captureProgressWork(s.tasks[index], s);
          s.tasks[index] = row.plannedTask!;
          settleProgressWork(s.tasks[index], s.assignments, progressWork);
        }
      }
      runtime.finishMutation(s, { stale: true }); // datum-rakende mutatie (A6): planning verouderd tot F5.
    });
    get().recomputeViewRows();
    // Ná `set()`: `get().notify(...)` binnen een actieve producer aanroepen kan niet.
    if (statusDateToday) get().notify(statusDateSetTodayNotice(statusDateToday, get().ui.dateNotation));
    return plan;
  },
});
