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
// De melding hoort BUITEN de Immer-producer (`notify` doet zelf een `set()`), vandaar de vorm: een
// watcher vóór `set`, de rapportage erna.
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import { isAncestorRelation } from './relationRules';
import type { NotifyInput } from './slices/types';

interface RelationTree {
  tasks: readonly Task[];
  sequences: readonly Sequence[];
}

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
