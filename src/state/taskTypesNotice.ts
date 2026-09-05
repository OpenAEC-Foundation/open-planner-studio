import type { NotifyInput } from './slices/types';

/**
 * Taaktypes-etappe (spec §7, "automatische ontsluiting"): één informatieve melding per document
 * per sessie wanneer een geladen bestand taaktypedata draagt terwijl de instelling "Toon
 * taaktypes" uit staat — dezelfde sessie-gate als `timephasedLossNotice.ts` (module-state, geen
 * documentveld: sessie-UI-gedrag, overleeft een documentwissel-en-terug). Zichtbaar wordt de
 * werkregel voor dát document sowieso (`taskTypesVisible`); de melding vertelt dat en linkt naar de
 * gids.
 */
const notifiedDocIds = new Set<string>();

export const TASK_TYPES_HELP_ARTICLE_ID = 'gids-taaktypes';

export function claimTaskTypesNotice(docId: string): boolean {
  if (notifiedDocIds.has(docId)) return false;
  notifiedDocIds.add(docId);
  return true;
}

/** Wis de registratie voor ÉÉN document-id — zelfde reden als `clearTimephasedLossNoticeForDoc`:
 *  `newProject`/`createNewProject` hergebruiken het actieve docId voor een vers document (review K1). */
export function clearTaskTypesNoticeForDoc(docId: string): void {
  notifiedDocIds.delete(docId);
}

/** Test-only reset (zelfde reden als `__resetTimephasedLossNoticeForTests`). */
export function __resetTaskTypesNoticeForTests(): void {
  notifiedDocIds.clear();
}

/**
 * K2 (eigenaarsbesluit 2026-09-05): een project- of kalenderwijziging heeft via de werkregel de duur
 * van `count` taken veranderd (minder/meer uren per dag ⇒ langer/korter onder Vast werk en Vaste
 * inzet). Geen sessie-gate en bewust GEEN `dedupeKey` (reviewbevinding F10): de dedupe vervangt
 * `params` en telt alleen een badge op, zodat twee bewerkingen van 5 en daarna 2 taken als
 * "2 taken ×2" zouden lezen. Eén melding per bewerking met het echte aantal; `MAX_NOTIFICATIONS`
 * begrenst de stapel. `docId` blijft in de signatuur voor de aanroepers (één plek om later toch
 * per document te vouwen).
 */
export function notifyWorkRuleDurationsChanged(notify: (n: NotifyInput) => void, _docId: string, count: number): void {
  if (count <= 0) return;
  notify({
    severity: 'info',
    messageKey: 'notifications.workRuleDurationsChanged',
    params: { count },
    helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
  });
}

export function notifyTaskTypesUnlocked(notify: (n: NotifyInput) => void, docId: string): void {
  if (!claimTaskTypesNotice(docId)) return;
  notify({
    severity: 'info',
    messageKey: 'notifications.taskTypesUnlocked',
    dedupeKey: 'task-types-unlocked',
    helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
  });
}
