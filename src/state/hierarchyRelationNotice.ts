// Verhangen (inspringen, rij slepen, een andere bovenliggende taak kiezen in "Taak bewerken", MCP
// `planner_move_task`) kan een BESTAANDE relatie veranderen in een relatie tussen een taak en zijn
// eigen (voor)ouder: hang Fundering onder Grondwerk en "Grondwerk → Fundering" verbindt een taak met
// haar eigen fase. Zo'n relatie telt in de berekening niet mee (`expandSummaryRelations` laat haar
// vallen) maar blijft bewaard, net als bij een import (gids relaties & constraints).
//
// Weigeren is te streng — het is een gewone herstructurering (review audit taakmutaties, bevinding
// 3) — maar stil laten gebeuren ook: bij de volgende berekening verschuift de opvolger zonder
// aanwijsbare reden. Deze module legt de toestand vóór de verhanging vast en meldt na afloop via het
// meldingenkanaal hoeveel relaties er NIEUW niet meer meetellen.
//
// Anders ligt het als verhangen een KRING maakt (rapport S4): dan rekent de hele planning niet meer,
// en wordt de verhanging vooraf geweigerd (`hierarchyChange.ts`). Die weigering meldt zich ook hier
// (`notifyHierarchyCycle`), zodat de twee meldingen over verhangen en relaties op één plek staan.
//
// De melding hoort BUITEN de Immer-producer (`notify` doet zelf een `set()`), vandaar de vorm: een
// watcher vóór `set`, de rapportage erna.
import type { RelationTree } from '@/engine/scheduler/relationRules';
import type { Task } from '@/types/task';
import { cycleLabel } from './notificationLabels';
import { isAncestorRelation } from './relationRules';
import type { NotifyInput } from './slices/types';

/** Ids van relaties die een taak met zijn eigen (voor)ouder verbinden. */
function ancestorRelationIds(state: RelationTree): Set<string> {
  if (state.sequences.length === 0) return new Set();
  const byId = new Map(state.tasks.map(task => [task.id, task] as const));
  const lookup = (id: string) => byId.get(id);
  return new Set(state.sequences.filter(sequence => isAncestorRelation(lookup, sequence)).map(sequence => sequence.id));
}

/**
 * Leg vast welke relaties nu al voorouder-relaties zijn en geef een rapportage terug die, na de
 * verhanging, meldt hoeveel er nieuw bij kwamen. Een relatie die al niet meetelde, wordt dus niet
 * opnieuw gemeld; een verhanging die niets wijzigde, kost geen tweede telling.
 */
export function watchAncestorRelations(
  before: RelationTree,
): (after: RelationTree & { notify: (notification: NotifyInput) => void }) => void {
  const alreadyExcluded = ancestorRelationIds(before);
  return (after) => {
    if (after.tasks === before.tasks) return; // niets verhangen (geweigerd of no-op)
    let count = 0;
    for (const id of ancestorRelationIds(after)) if (!alreadyExcluded.has(id)) count++;
    if (count === 0) return;
    after.notify({
      severity: 'info',
      messageKey: 'notifications.relationsExcludedByHierarchy',
      params: { count },
      dedupeKey: 'relations-excluded-by-hierarchy',
      helpArticleId: 'gids-relaties-constraints',
    });
  };
}

/**
 * Meld een geweigerde verhanging die een kring zou maken, met de taaknamen van die kring
 * ("Fundering → Keuring → Fundering"): zo ziet de gebruiker welke relatie via de nieuwe fase
 * rondloopt en eerst weg of om moet.
 */
export function notifyHierarchyCycle(
  state: { tasks: readonly Task[]; notify: (notification: NotifyInput) => void },
  cycle: readonly string[],
): void {
  state.notify({
    severity: 'info',
    messageKey: 'notifications.hierarchyCycle',
    params: { cycle: cycleLabel(state.tasks, cycle) },
    // Samenvouwen: herhaald op Alt+Shift+→ drukken levert één regel met een teller op.
    dedupeKey: 'hierarchy-cycle',
    helpArticleId: 'gids-relaties-constraints',
  });
}
