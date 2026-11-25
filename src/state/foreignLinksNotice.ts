import { applyForeignRule, emptyForeignReferences, goneStepIds, newForeignChangeCount } from '@/services/ifc/foreign/changeList';
import { hasForeignContent } from '@/services/ifc/foreign/ifcSource';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { AppState } from './appStore';
import { OTHER_WORK_NOTICE_MS, watchNotice } from './otherWorkNotice';
import { selectUndoHistoryEvent } from './sessionHistory';

export type DomainBeforeEdit = Pick<AppState, 'calendar' | 'calendars' | 'tasks' | 'resources' | 'sequences'>;

type NoticeStore = Parameters<typeof watchNotice>[0];

export function notifyForeignLinksDropped(store: NoticeStore, before: DomainBeforeEdit, sequence: number): void {
  const state = store.getState();
  const source = state.ifcSource;
  if (!ifcForeignContentEnabled(state.ui.featureFlags) || !hasForeignContent(source) || (!source!.foreignReferences && !source!.unusedKeys)) return;
  const event = selectUndoHistoryEvent(state.historyEvents, state.activeDocumentId);
  if (!event || event.sequence !== sequence || event.sessionKey) return;
  const references = source!.foreignReferences ?? emptyForeignReferences();
  const outcome = (domain: DomainBeforeEdit) => applyForeignRule(references,
    goneStepIds(source!.stepIds, { ...domain, resourceCalendars: domain.calendars }), source!.unusedKeys);
  const count = newForeignChangeCount(outcome(before), outcome(state));
  if (count === 0) return;
  state.notify({
    severity: 'info', messageKey: 'notifications.foreignLinksDropped', params: { count },
    action: { kind: 'undoHistoryEvent', eventId: event.id, labelKey: 'notifications.actions.undo' },
    durationMs: OTHER_WORK_NOTICE_MS,
  });
  watchNotice(store, event.id, s => ifcForeignContentEnabled(s.ui.featureFlags));
}
