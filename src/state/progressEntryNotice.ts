import type { DateNotation } from '@/types/view';
import { displayDate } from '@/utils/displayDate';
import type { NotifyInput } from './slices/types';

/**
 * De melding bij Z1 (`engine/progressEntry.ts`): er was geen statusdatum, de app heeft hem bij het
 * invullen van voortgang op vandaag gezet. Eén vorm voor elke UI-route (paneel en contextmenu via
 * `enterTaskProgress`, het taakraster via de gridtransactie, "Taak bewerken" via het dialoog-Opslaan),
 * via het ene meldkanaal van de store. De datum in de notatie van de gebruiker; "Lees meer" opent de
 * gids die de statusdatum uitlegt.
 */
export function statusDateSetTodayNotice(date: string, notation: DateNotation): NotifyInput {
  return {
    severity: 'info',
    messageKey: 'notifications.statusDateSetToday',
    params: { date: displayDate(date, notation) },
    dedupeKey: 'status-date-set-today',
    helpArticleId: 'gids-baselines-voortgang',
  };
}

/**
 * De melding bij een geweigerde duurwijziging (besluit eigenaar, restduur): de nieuwe duur van een
 * lopende taak is korter dan het werk dat al gedaan is (`runningDurationChange`). Eén vorm voor het
 * eigenschappenpaneel, de Gantt en de extensies (via `updateTask`) en "Taak bewerken"; het raster
 * toont hem als celfout, de AI-koppeling als weigering per item.
 */
export function durationBelowDoneWorkNotice(task: { id: string; name: string; time: { completion: number } }): NotifyInput {
  return {
    severity: 'info',
    messageKey: 'notifications.durationBelowDoneWork',
    params: { name: task.name, percent: Math.round(task.time.completion * 100) },
    dedupeKey: `duration-below-done-work:${task.id}`,
    helpArticleId: 'gids-baselines-voortgang',
  };
}
