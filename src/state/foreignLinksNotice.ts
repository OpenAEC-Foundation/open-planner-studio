import { applyForeignRule, emptyForeignReferences, goneStepIds, newForeignChangeCount } from '@/services/ifc/foreign/changeList';
import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { AppState } from './appStore';
import { watchNotice, type NoticeStore } from './otherWorkNotice';
import { selectUndoHistoryEvent } from './sessionHistory';
import { snapshotHolds } from './documentSaveState';
import type { NotifyInput } from './slices/types';

export const FOREIGN_LINKS_NOTICE_KEY = 'foreign-links-dropped';

const FOREIGN_LINKS_NOTICE_MS = 12000;

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

export function notifyForeignLinksDropped(store: NoticeStore, before: DomainBeforeEdit, sequence: number): void {
  const state = store.getState();
  if (!linkedSource(state)) return;
  const event = selectUndoHistoryEvent(state.historyEvents, state.activeDocumentId);
  if (!event || event.sequence !== sequence || event.sessionKey) return;
  let shown = foreignLinksDroppedSince(state, before);
  if (shown === 0) return;
  const notice = (count: number): NotifyInput => ({
    severity: 'info',
    messageKey: 'notifications.foreignLinksDropped',
    params: { count },
    action: { kind: 'undoHistoryEvent', eventId: event.id, labelKey: 'notifications.actions.undo' },
    dedupeKey: FOREIGN_LINKS_NOTICE_KEY,
    replaceOnDedupe: true,
    durationMs: FOREIGN_LINKS_NOTICE_MS,
  });
  state.notify(notice(shown));
  const documentId = state.activeDocumentId;
  const captured = (s: AppState) => snapshotHolds(s, documentId, event.id);
  let source = state.ifcSource;
  const stillValid = (s: AppState): boolean => {
    if (!ifcForeignContentEnabled(s.ui.featureFlags)) return false;
    if (s.ifcSource === source) return true;
    if (captured(s)) return false;
    source = s.ifcSource;
    const count = foreignLinksDroppedSince(s, before);
    if (count > 0 && count !== shown) { shown = count; s.notify(notice(count)); }
    return count > 0;
  };
  watchNotice(store, event.id, stillValid, captured);
}
