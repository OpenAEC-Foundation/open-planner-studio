import type { NotificationDetailLine, NotifyInput } from './slices/types';

/**
 * Weigeringen in het meldingenkanaal (eigenaarsbesluiten 2026-10-17).
 *
 * Een weigering is een melding dat de app een handeling van de gebruiker NIET (of niet helemaal)
 * heeft uitgevoerd ("De duur is niet gewijzigd.", "… kan geen mijlpaal worden."). Zo'n melding is
 * rood (`severity: 'error'`) en blijft staan tot het kruisje: een blauwe info verdwijnt na 5 s en is
 * zo te missen. Dat geldt ook als een DEEL van de handeling lukte ("weigering = rood"); de melding
 * noemt dan via {@link refusedNamesLine} wat niet is aangepast.
 *
 * De vlag `refusal` onderscheidt een weigering van een echte fout (bv. opslaan mislukt): bij een
 * volle stapel gaat een weigering eerder weg (`notify` in uiSlice). Zo duwen herhaalde weigeringen
 * een echte fout nooit weg.
 *
 * Maak elke weigering via {@link refusalNotice}, zodat de regel op één plek staat
 * (`tests/planning/check-refusal-notices.ts` bewaakt dat).
 */
export function refusalNotice(notice: Omit<NotifyInput, 'severity' | 'refusal'>): NotifyInput {
  return { ...notice, severity: 'error', refusal: true };
}

/** Hoeveel namen een detailregel hooguit noemt; de rest telt als "en nog N". */
export const REFUSED_NAMES_SHOWN = 5;

/**
 * Welke detailregel:
 *  - `untouched`: taken waarin niets is aangepast ("Niet aangepast: …");
 *  - `notApplied`: taken waar de geweigerde wijziging niet is toegepast, terwijl een andere wijziging
 *    aan dezelfde taak mogelijk wél lukte ("Niet toegepast bij: …");
 *  - `relations`: relaties die niet zijn aangemaakt ("Niet aangemaakt: A → B").
 */
export type RefusedNamesKind = 'untouched' | 'notApplied' | 'relations';

const KEYS = {
  untouched: ['notifications.refusedTaskNames', 'notifications.refusedTaskNamesMore'],
  notApplied: ['notifications.notAppliedTaskNames', 'notifications.notAppliedTaskNamesMore'],
  relations: ['notifications.refusedRelationNames', 'notifications.refusedRelationNamesMore'],
} as const;

/**
 * De detailregel onder een weigering die meer taken (of relaties) raakt. Hooguit
 * {@link REFUSED_NAMES_SHOWN} namen, daarna "en nog N". Geen namen ⇒ geen regel.
 */
export function refusedNamesLine(names: readonly string[], kind: RefusedNamesKind): NotificationDetailLine[] {
  if (names.length === 0) return [];
  const [key, moreKey] = KEYS[kind];
  const shown = names.slice(0, REFUSED_NAMES_SHOWN).join(', ');
  const rest = names.length - REFUSED_NAMES_SHOWN;
  return rest <= 0
    ? [{ messageKey: key, params: { names: shown } }]
    : [{ messageKey: moreKey, params: { names: shown, count: rest } }];
}

/** Samenvouwsleutel voor een weigering over een SET taken: alleen precies dezelfde set vouwt samen.
 *  Een vaste sleutel zou "3 taken" overschrijven met "2 taken ×2" (zie `taskTypesNotice.ts`). */
export function refusedSetKey(prefix: string, ids: readonly string[]): string {
  return `${prefix}:${[...ids].sort().join(',')}`;
}
