import {
  applyForeignRule, emptyForeignReferences, foreignChangeCount, goneStepIds, newForeignChangeCount, type ForeignRuleOutcome,
} from '@/services/ifc/foreign/changeList';
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

function ruleOutcome(source: IfcSource, domain: DomainBeforeEdit): ForeignRuleOutcome {
  return applyForeignRule(source.foreignReferences ?? emptyForeignReferences(),
    goneStepIds(source.stepIds, { ...domain, resourceCalendars: domain.calendars }), source.unusedKeys);
}

export function foreignLinksDroppedSince(state: AppState, before: DomainBeforeEdit): number {
  const source = linkedSource(state);
  if (!source) return 0;
  return newForeignChangeCount(ruleOutcome(source, before), ruleOutcome(source, state));
}

export function foreignChangesIfSaved(state: AppState): number {
  const source = linkedSource(state);
  return source ? foreignChangeCount(ruleOutcome(source, state)) : 0;
}

export function notifyForeignLinksDropped(store: { getState: () => AppState }, before: DomainBeforeEdit, sequence: number): void {
  const state = store.getState();
  if (!linkedSource(state)) return;
  const event = selectUndoHistoryEvent(state.historyEvents, state.activeDocumentId);
  if (!event || event.sequence !== sequence || event.sessionKey) return;
  const count = foreignLinksDroppedSince(state, before);
  if (count > 0) state.notify({ severity: 'info', messageKey: 'notifications.foreignLinksDropped', params: { count } });
}
