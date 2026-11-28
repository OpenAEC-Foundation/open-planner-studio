import type { NotificationDetailLine, NotifyInput, UIState } from './slices/types';

export function refusalNotice(notice: Omit<NotifyInput, 'severity' | 'refusal'>): NotifyInput {
  return { ...notice, severity: 'error', refusal: true };
}

export function clearRefusals(ui: UIState): void {
  if (ui.notifications.some((n) => n.refusal)) {
    ui.notifications = ui.notifications.filter((n) => !n.refusal);
  }
  ui.structureLockedClearedAt = ui.structureLockedNotice;
}

export const REFUSED_NAMES_SHOWN = 5;

export type RefusedNamesKind = 'untouched' | 'notApplied' | 'relations';

const KEYS = {
  untouched: ['notifications.refusedTaskNames', 'notifications.refusedTaskNamesMore'],
  notApplied: ['notifications.notAppliedTaskNames', 'notifications.notAppliedTaskNamesMore'],
  relations: ['notifications.refusedRelationNames', 'notifications.refusedRelationNamesMore'],
} as const;

export function refusedNamesLine(names: readonly string[], kind: RefusedNamesKind): NotificationDetailLine[] {
  if (names.length === 0) return [];
  const [key, moreKey] = KEYS[kind];
  const shown = names.slice(0, REFUSED_NAMES_SHOWN).join(', ');
  const rest = names.length - REFUSED_NAMES_SHOWN;
  return rest <= 0
    ? [{ messageKey: key, params: { names: shown } }]
    : [{ messageKey: moreKey, params: { names: shown, count: rest } }];
}

export function refusedSetKey(prefix: string, ids: readonly string[]): string {
  return `${prefix}:${[...ids].sort().join(',')}`;
}
