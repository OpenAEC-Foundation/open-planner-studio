import type { NotificationDetailLine, NotifyInput, UIState } from './slices/types';

/**
 * Weigeringen in het meldingenkanaal (eigenaarsbesluiten 2026-10-17).
 *
 * Een weigering is een melding dat de app een handeling van de gebruiker NIET (of niet helemaal)
 * heeft uitgevoerd ("De duur is niet gewijzigd.", "… kan geen mijlpaal worden."). Zo'n melding is
 * rood (`severity: 'error'`) en blijft staan tot het kruisje: een blauwe info verdwijnt na 5 s en is
 * zo te missen. Dat geldt ook als een DEEL van de handeling lukte ("weigering = rood"); de melding
 * noemt dan via {@link refusedNamesLine} wat niet is aangepast.
 *
 * Levensduur (eigenaarsbesluit 2026-10-19 5b): een weigering gaat ook weg bij een documentwissel en
 * na elke undo- of redo-stap — zie {@link clearRefusals}. Een echte fout blijft daar wél staan.
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

/**
 * Wis alle weigeringen (eigenaarsbesluit 2026-10-19 5b): meldingen met `refusal: true` en de strook
 * `StructureLockedNotice`. Een weigering gaat over één handeling in één document. Na een
 * documentwissel staat hij anders boven een ander document; na een undo- of redo-stap klopt hij
 * meestal niet meer met wat de gebruiker ziet.
 *
 * Aanroepers, allemaal BINNEN hun eigen `set` en vóór iets anders meldt:
 *  - elke wissel van actief document (`resetDocumentScopedUI` in documentSlice) en het laden van
 *    een project in het actieve tabblad (`applyLoadedProject`, ook via `loadState`);
 *  - elke toegepaste undo- of redo-stap (`applyHistoryEvent` in historySlice). Elke route (sneltoets,
 *    lint, titelbalk, MCP `planner_undo`) loopt via die store-actie.
 *
 * Volgorde: eerst wissen, dan melden. Een weigering die de wissel of de undo zelf oplevert, komt
 * pas ná deze `set` binnen (via `notify`) en blijft dus staan. Voor de strook geldt hetzelfde via
 * `structureLockedClearedAt`: een nieuwere poging hoogt de teller daarboven op.
 *
 * ALLEEN weigeringen. Een echte fout (bv. opslaan mislukt), een waarschuwing of een info blijft:
 * meldingen zijn verder app-globaal en staan niet in de undo-stack (`check-notifications`).
 */
export function clearRefusals(ui: UIState): void {
  if (ui.notifications.some((n) => n.refusal)) {
    ui.notifications = ui.notifications.filter((n) => !n.refusal);
  }
  ui.structureLockedClearedAt = ui.structureLockedNotice;
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
