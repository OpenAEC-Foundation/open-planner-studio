// Verhangen dat een kring maakt, vooraf weigeren (audit taakmutaties, rapport S4).
//
// Een relatie op een fase geldt voor elke taak in die fase (`expandSummaryRelations`). Verhangen
// verandert dus niet alleen de boom maar ook welke relaties er in de berekening gelden:
//   - Grondwerk → Keuring en Keuring → Fundering. Hang Fundering onder Grondwerk en Grondwerk wordt
//     een fase: Grondwerk → Keuring geldt dan ook als Fundering → Keuring — met Keuring → Fundering
//     een kring.
//   - Een relatie tussen een taak en haar eigen fase telt niet mee (`hierarchyRelationNotice.ts`).
//     Spring je die taak uit, dan telt zo'n relatie weer, en ook dat kan een kring sluiten.
// Voorheen voerde elke verhangroute dat stil uit; pas F5 liep vast op "Circular dependency" en de
// hele planning bleef bevroren.
//
// DE REGEL, één keer: `hierarchyChangeVerdict` voert de boomwijziging van een route eerst uit op een
// proefkopie van de taken en toetst de uitkomst met `introducedCycle` — dezelfde uitvouwing als de
// solver, en alleen een kring die er vóór de handeling nog niet was (zoals de relatieregel van #207;
// een geïmporteerde kring blokkeert dus geen onschuldige verhanging). Alle routes delen hem: de
// store-acties (`indentTasks`, `outdentTasks`, `moveTaskTo`, `moveTasksTo`, `moveTask` — samen
// inspringen/uitspringen via sneltoets, lint en contextmenu, rij slepen in raster en Gantt, en het
// ouderveld van "Taak bewerken"), de dialoog zelf (die vóór het opslaan toetst, zodat een geweigerde
// ouder niet de rest van de bewerking half laat doorgaan) en MCP `planner_move_task`.
//
// De proef draait DEZELFDE boomwijziging als de echte actie (een `HierarchyEdit`, gedefinieerd naast
// de actie in `taskSlice.ts`), niet een nagebouwde versie: zo kan de toets niet uit de pas lopen met
// wat de actie werkelijk doet. Meerdere taken tegelijk (meervoudig inspringen, een blok slepen)
// worden als één uitkomst getoetst en dus als geheel geweigerd — half inspringen zou de structuur
// anders achterlaten dan de gebruiker vroeg.
import { introducedCycle, type RelationTree } from '@/engine/scheduler/relationRules';
import type { Task } from '@/types/task';

/** Wat een boomwijziging deed: iets veranderd, en kreeg minstens één taak een andere ouder. */
export interface HierarchyEditResult {
  changed: boolean;
  reparented: boolean;
}

/**
 * Eén boomwijziging (verhangen/herordenen) op een takenlijst. MUTEERT de meegegeven lijst en zijn
 * taken — `parentId`, `childIds` en de arrayvolgorde, niets anders — zonder undo-snapshot,
 * WBS-hernummering of `finishMutation`: dat doet de aanroepende actie.
 */
export type HierarchyEdit = (tasks: Task[]) => HierarchyEditResult;

export const NO_HIERARCHY_CHANGE: HierarchyEditResult = { changed: false, reparented: false };

export type HierarchyChangeVerdict =
  | ({ ok: true } & HierarchyEditResult)
  | { ok: false; reason: 'cycle'; cycle: string[] };

/**
 * Mag deze boomwijziging? Voert `edit` uit op een proefkopie (de state zelf blijft onaangeroerd) en
 * weigert als de uitkomst een NIEUWE kring in de uitgevouwen relatiegraaf heeft.
 *
 * @returns `ok` met wat de wijziging zou doen, of de kring (bladtaak-ids, begin = eind).
 */
export function hierarchyChangeVerdict(state: RelationTree, edit: HierarchyEdit): HierarchyChangeVerdict {
  // Een boomwijziging raakt alleen `parentId`, `childIds` en de volgorde: een ondiepe kopie per taak
  // met een eigen `childIds` volstaat. De rest (tijd, notities, …) blijft gedeeld en onaangeraakt.
  const trial = state.tasks.map(task => ({ ...task, childIds: [...task.childIds] }));
  const result = edit(trial);
  if (!result.changed) return { ok: true, ...result };
  const cycle = introducedCycle(state, { tasks: trial, sequences: state.sequences });
  return cycle ? { ok: false, reason: 'cycle', cycle } : { ok: true, ...result };
}
