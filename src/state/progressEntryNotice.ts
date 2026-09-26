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
