import type { StartConstraintChange } from '@/engine/startEditConstraint';
import type { TaskConstraint } from '@/types/task';
import type { DateNotation, TimeNotation } from '@/types/view';
import { displayDateTime } from '@/utils/displayDate';
import type { NotifyInput } from './slices/types';
import { CONSTRAINTS_HELP_ARTICLE_ID } from './helpArticles';
import { refusalNotice, refusedNamesLine, refusedSetKey } from './refusalNotice';

/**
 * Eén taak waarvan een nieuwe start (getypt of gesleept) iets met de constraint deed:
 *  - `snet`: de start werd een SNET, of verzette de datum van een bestaande;
 *  - `blocked`: een andere constraint houdt de start tegen, dus de start is niet toegepast.
 */
export type StartEditNotice =
  | { kind: 'snet'; name: string; /** De nieuwe SNET-datum (ISO, zoals opgeslagen). */ date: string; change: StartConstraintChange }
  | {
    kind: 'blocked'; name: string; constraint: TaskConstraint;
    /** Voor het samenvouwen per taak: tien pogingen op dezelfde taak = één regel met een teller. */
    taskId: string;
  };

/** De gids die uitlegt hoe een nieuwe start op een taak met voorganger met constraints samenhangt. */
const HELP_ARTICLE_ID = CONSTRAINTS_HELP_ARTICLE_ID;

/**
 * De meldingen voor alle startroutes (Tabel, eigenschappenpaneel, Taak bewerken, Gantt-sleep) via
 * het ene meldkanaal: hooguit één voor de SNET-gevallen en één voor de tegengehouden starts. Eén taak
 * ⇒ naam en datum (bij een urentaak met tijd) in de weergavenotatie van de gebruiker; meer taken in
 * één bewerking (plakken, vullen) ⇒ één melding met het aantal. Het constrainttype noemt de tekst in
 * gebruikerstaal via i18next-nesting (`$t(task:constraintType.{{type}})`), zodat deze storemodule geen
 * i18n hoeft te laden. Geen taken ⇒ geen meldingen.
 */
export function startEditNotifications(
  notices: readonly StartEditNotice[],
  notation: DateNotation,
  timeNotation: TimeNotation,
): NotifyInput[] {
  const out: NotifyInput[] = [];
  const snet = notices.filter((notice): notice is Extract<StartEditNotice, { kind: 'snet' }> => notice.kind === 'snet');
  const blocked = notices.filter((notice): notice is Extract<StartEditNotice, { kind: 'blocked' }> => notice.kind === 'blocked');
  if (snet.length === 1) {
    const [notice] = snet;
    out.push({
      severity: 'info',
      messageKey: notice.change === 'created' ? 'notifications.startSnetCreated' : 'notifications.startSnetUpdated',
      params: { name: notice.name, date: displayDateTime(notice.date, notation, timeNotation) },
      helpArticleId: HELP_ARTICLE_ID,
    });
  } else if (snet.length > 1) {
    out.push({
      severity: 'info',
      messageKey: 'notifications.startSnetMany',
      params: { count: snet.length },
      helpArticleId: HELP_ARTICLE_ID,
    });
  }
  if (blocked.length === 1) {
    const [{ name, constraint, taskId }] = blocked;
    out.push(refusalNotice({
      messageKey: constraint.date ? 'notifications.startBlockedByConstraint' : 'notifications.startBlockedByConstraintNoDate',
      params: constraint.date
        ? { name, type: constraint.type, date: displayDateTime(constraint.date, notation, timeNotation) }
        : { name, type: constraint.type },
      dedupeKey: `start-blocked:${taskId}`,
      helpArticleId: HELP_ARTICLE_ID,
    }));
  } else if (blocked.length > 1) {
    // "Niet toegepast bij": bij plakken kan een andere cel van dezelfde taak wél geschreven zijn.
    out.push(refusalNotice({
      messageKey: 'notifications.startBlockedByConstraintMany',
      params: { count: blocked.length },
      detailLines: refusedNamesLine(blocked.map(b => b.name), 'notApplied'),
      dedupeKey: refusedSetKey('start-blocked-many', blocked.map(b => b.taskId)),
      helpArticleId: HELP_ARTICLE_ID,
    }));
  }
  return out;
}

/** Toon de meldingen van `startEditNotifications` via het ene meldkanaal (paneel, dialoog, Gantt). */
export function notifyStartEdit(
  notify: (notification: NotifyInput) => void,
  notices: readonly StartEditNotice[],
  notation: DateNotation,
  timeNotation: TimeNotation,
): void {
  for (const notification of startEditNotifications(notices, notation, timeNotation)) notify(notification);
}
