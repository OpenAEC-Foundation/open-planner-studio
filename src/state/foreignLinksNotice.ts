import {
  applyForeignRule, emptyForeignReferences, foreignChangeCount, goneStepIds, newForeignChangeCount, type ForeignRuleOutcome,
} from '@/services/ifc/foreign/changeList';
import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { AppState } from './appStore';
import { OTHER_WORK_NOTICE_MS, watchNotice } from './otherWorkNotice';
import { selectUndoHistoryEvent } from './sessionHistory';

export type DomainBeforeEdit = Pick<AppState, 'calendar' | 'calendars' | 'tasks' | 'resources' | 'sequences'>;

type NoticeStore = Parameters<typeof watchNotice>[0];

function linkedSource(state: AppState): IfcSource | undefined {
  if (!ifcForeignContentEnabled(state.ui.featureFlags) || !hasForeignContent(state.ifcSource)) return undefined;
  const source = state.ifcSource!;
  return source.foreignReferences || source.unusedKeys ? source : undefined;
}

function ruleOutcome(source: IfcSource, domain: DomainBeforeEdit): ForeignRuleOutcome {
  return applyForeignRule(source.foreignReferences ?? emptyForeignReferences(),
    goneStepIds(source.stepIds, { ...domain, resourceCalendars: domain.calendars }), source.unusedKeys);
}

export function foreignChangesIfSaved(state: AppState): number {
  const source = linkedSource(state);
  return source ? foreignChangeCount(ruleOutcome(source, state)) : 0;
}

export function notifyForeignLinksDropped(store: NoticeStore, before: DomainBeforeEdit, sequence: number): void {
  const state = store.getState();
  const source = linkedSource(state);
  if (!source) return;
  const event = selectUndoHistoryEvent(state.historyEvents, state.activeDocumentId);
  if (!event || event.sequence !== sequence || event.sessionKey) return;
  const count = newForeignChangeCount(ruleOutcome(source, before), ruleOutcome(source, state));
  if (count === 0) return;
  state.notify({
    severity: 'info', messageKey: 'notifications.foreignLinksDropped', params: { count },
    action: { kind: 'undoHistoryEvent', eventId: event.id, labelKey: 'notifications.actions.undo' },
    durationMs: OTHER_WORK_NOTICE_MS,
  });
  watchNotice(store, event.id, s => ifcForeignContentEnabled(s.ui.featureFlags));
}
