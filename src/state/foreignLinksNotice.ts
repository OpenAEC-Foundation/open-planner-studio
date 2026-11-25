import { applyForeignRule, emptyForeignReferences, goneStepIds, newForeignChangeCount } from '@/services/ifc/foreign/changeList';
import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { AppState } from './appStore';
import { selectUndoHistoryEvent } from './sessionHistory';

export type DomainBeforeEdit = Pick<AppState, 'calendar' | 'calendars' | 'tasks' | 'resources' | 'sequences'>;

function linkedSource(state: AppState): IfcSource | undefined {
  if (!ifcForeignContentEnabled(state.ui.featureFlags) || !hasForeignContent(state.ifcSource)) return undefined;
  const source = state.ifcSource!;
  return source.foreignReferences || source.unusedKeys ? source : undefined;
}

export function foreignLinksDroppedSince(state: AppState, before: DomainBeforeEdit): number {
  const source = linkedSource(state);
  if (!source) return 0;
  const references = source.foreignReferences ?? emptyForeignReferences();
  const outcome = (domain: DomainBeforeEdit) => applyForeignRule(references,
    goneStepIds(source.stepIds, { ...domain, resourceCalendars: domain.calendars }), source.unusedKeys);
  return newForeignChangeCount(outcome(before), outcome(state));
}

export function notifyForeignLinksDropped(store: { getState: () => AppState }, before: DomainBeforeEdit, sequence: number): void {
  const state = store.getState();
  if (!linkedSource(state)) return;
  const event = selectUndoHistoryEvent(state.historyEvents, state.activeDocumentId);
  if (!event || event.sequence !== sequence || event.sessionKey) return;
  const count = foreignLinksDroppedSince(state, before);
  if (count > 0) state.notify({ severity: 'info', messageKey: 'notifications.foreignLinksDropped', params: { count } });
}
