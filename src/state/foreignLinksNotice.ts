import { applyForeignRule, goneStepIds, newForeignChangeCount, type ForeignReferences } from '@/services/ifc/foreign/changeList';
import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { AppState } from './appStore';
import { watchNotice, type NoticeStore } from './otherWorkNotice';
import { selectUndoHistoryEvent } from './sessionHistory';

export const FOREIGN_LINKS_NOTICE_KEY = 'foreign-links-dropped';

const FOREIGN_LINKS_NOTICE_MS = 12000;

export type DomainBeforeEdit = Pick<AppState, 'calendar' | 'calendars' | 'tasks' | 'resources' | 'sequences'>;

const noReferences = (): ForeignReferences => ({
  stepIds: new Int32Array(0), groupStart: Int32Array.of(0), groupSize: new Int32Array(0),
  targetStart: Int32Array.of(0), targets: new Int32Array(0),
});

function linkedSource(state: AppState): IfcSource | undefined {
  if (!ifcForeignContentEnabled(state.ui.featureFlags) || !hasForeignContent(state.ifcSource)) return undefined;
  const source = state.ifcSource!;
  return source.foreignReferences || source.unusedKeys ? source : undefined;
}

export function foreignLinksDroppedSince(state: AppState, before: DomainBeforeEdit): number {
  const source = linkedSource(state);
  if (!source) return 0;
  const references = source.foreignReferences ?? noReferences();
  const outcome = (domain: DomainBeforeEdit) => applyForeignRule(references,
    goneStepIds(source.stepIds, { ...domain, resourceCalendars: domain.calendars }), source.unusedKeys);
  return newForeignChangeCount(outcome(before), outcome(state));
}

export function notifyForeignLinksDropped(store: NoticeStore, before: DomainBeforeEdit, sequence: number): void {
  const state = store.getState();
  if (!linkedSource(state)) return;
  const event = selectUndoHistoryEvent(state.historyEvents, state.activeDocumentId);
  if (!event || event.sequence !== sequence || event.sessionKey) return;
  const count = foreignLinksDroppedSince(state, before);
  if (count === 0) return;
  state.notify({
    severity: 'info',
    messageKey: 'notifications.foreignLinksDropped',
    params: { count },
    action: { kind: 'undoHistoryEvent', eventId: event.id, labelKey: 'notifications.actions.undo' },
    dedupeKey: FOREIGN_LINKS_NOTICE_KEY,
    replaceOnDedupe: true,
    durationMs: FOREIGN_LINKS_NOTICE_MS,
  });
  watchNotice(store, event.id);
}
