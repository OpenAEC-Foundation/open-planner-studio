import type { StartConstraintChange } from '@/engine/startEditConstraint';
import type { DateNotation } from '@/types/view';
import { displayDateTime } from '@/utils/displayDate';
import type { NotifyInput } from './slices/types';

/** Eén taak waarvan een getypte start een SNET werd of een SNET-datum verzette. */
export interface StartConstraintNotice {
  name: string;
  /** De nieuwe SNET-datum (ISO, zoals opgeslagen). */
  date: string;
  change: StartConstraintChange;
}

/** De gids die uitlegt waarom een getypte start op een taak met voorganger een beperking wordt. */
const HELP_ARTICLE_ID = 'gids-relaties-constraints';

/**
 * De ene melding voor alle startroutes (Tabel, eigenschappenpaneel, Taak bewerken) wanneer een
 * getypte start een beperking "Start niet eerder dan" zette of verzette (`startConstraintAfterEdit`).
 * Eén taak ⇒ naam en datum (bij een urentaak met tijd) in de weergavenotatie van de gebruiker;
 * meer taken in één bewerking (plakken, vullen) ⇒ één melding met het aantal. Geen taken ⇒ `null`:
 * dan valt er niets te melden.
 */
export function startConstraintNotification(
  notices: readonly StartConstraintNotice[],
  notation: DateNotation,
): NotifyInput | null {
  if (notices.length === 0) return null;
  if (notices.length > 1) {
    return {
      severity: 'info',
      messageKey: 'notifications.startSnetMany',
      params: { count: notices.length },
      helpArticleId: HELP_ARTICLE_ID,
    };
  }
  const [notice] = notices;
  return {
    severity: 'info',
    messageKey: notice.change === 'created' ? 'notifications.startSnetCreated' : 'notifications.startSnetUpdated',
    params: { name: notice.name, date: displayDateTime(notice.date, notation) },
    helpArticleId: HELP_ARTICLE_ID,
  };
}
