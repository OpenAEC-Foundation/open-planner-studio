import type { RecomputedRemainingWork } from '@/engine/work/workRuleApply';
import type { NotifyInput } from './slices/types';
import { TASK_TYPES_HELP_ARTICLE_ID } from './helpArticles';

/** Twee zinnen met getallen en een sneltoets: de standaard 5 s is te kort om ze te lezen. */
const READ_TIME_MS = 10_000;

/**
 * De melding wanneer een duurbewerking een bewaard restwerk opnieuw uitrekende dat afweek van
 * inzet × restduur (eigenaarsbesluit 2026-10-19, spec taaktypes §3.5; criterium en verzameling:
 * `settleDurationEdit` in engine/work/workRuleApply.ts). Eén melding per transactie, voor elke route:
 * `updateTask` (paneel, dialoog, Gantt, extensies), `setTaskSplits`, het taakraster (cel, plakken,
 * doorvullen) en de MCP-transactie. Eén taak ⇒ naam en oud → nieuw in uren (som over haar
 * herschreven toewijzingen, in de getalnotatie van de app-taal via `numberParams`); meer taken ⇒
 * alleen het aantal. Geen melding als er niets herschreven is. Ctrl+Z zet de bewaarde waarde terug,
 * want de herschrijving zit in dezelfde undo-stap als de duurbewerking.
 */
export function remainingWorkRecomputedNotice(
  items: readonly RecomputedRemainingWork[],
  opts?: { dedupeKey?: string },
): NotifyInput | null {
  if (items.length === 0) return null;
  // Binnen één sleepgebaar werkt elke stap dezelfde melding bij (geen "×N"), zie `mergeStepRecomputedWork`.
  const dedupe = opts?.dedupeKey ? { dedupeKey: opts.dedupeKey, replaceOnDedupe: true } : {};
  const byTask = new Map<string, { name: string; before: number; after: number }>();
  for (const item of items) {
    const sum = byTask.get(item.taskId) ?? { name: item.taskName, before: 0, after: 0 };
    sum.before += item.beforeMinutes;
    sum.after += item.afterMinutes;
    byTask.set(item.taskId, sum);
  }
  if (byTask.size === 1) {
    const [only] = byTask.values();
    return {
      severity: 'info',
      messageKey: 'notifications.remainingWorkRecomputed',
      params: { name: only.name },
      numberParams: { before: only.before / 60, after: only.after / 60 },
      helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
      durationMs: READ_TIME_MS,
      ...dedupe,
    };
  }
  return {
    severity: 'info',
    messageKey: 'notifications.remainingWorkRecomputedMany',
    params: { count: byTask.size },
    helpArticleId: TASK_TYPES_HELP_ARTICLE_ID,
    durationMs: READ_TIME_MS,
    ...dedupe,
  };
}

/**
 * Eén gecoalesceerde undo-stap (een balksleep, toetsaanslagen in het paneel) bestaat uit meer
 * duurbewerkingen. Alleen de EERSTE ziet een afwijkend restwerk (320 h bij 80 h); daarna klopt het
 * restwerk al met inzet × restduur en meldt `settleDurationEdit` niets meer. De melding moet toch de
 * EINDWAARDE tonen (review #380, V1). `carried` = de items van de undo-stap tot nu toe (met het
 * "vóór" dat Ctrl+Z terugzet), `fresh` = die van deze stap; het "ná" wordt het huidige restwerk.
 * `items` = de nieuwe lijst voor de undo-stap; `notify` = wat de melding nu moet tonen (leeg als
 * deze stap niets veranderde, of als het restwerk weer precies op het "vóór" staat).
 */
export function mergeStepRecomputedWork(
  carried: readonly RecomputedRemainingWork[],
  fresh: readonly RecomputedRemainingWork[],
  currentWork: (assignmentId: string) => number | undefined,
): { items: RecomputedRemainingWork[]; notify: RecomputedRemainingWork[] } {
  let changed = fresh.length > 0;
  const items = carried.map((item) => {
    const now = currentWork(item.assignmentId);
    if (now === undefined || Math.abs(now - item.afterMinutes) <= 1e-6) return item;
    changed = true;
    return { ...item, afterMinutes: now };
  });
  for (const f of fresh) {
    const i = items.findIndex((x) => x.assignmentId === f.assignmentId);
    if (i >= 0) items[i] = { ...items[i], afterMinutes: f.afterMinutes };
    else items.push(f);
  }
  const notify = changed ? items.filter((x) => Math.abs(x.afterMinutes - x.beforeMinutes) > 1e-6) : [];
  return { items, notify };
}
