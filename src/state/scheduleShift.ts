import type { AppState } from './appStore';
import { DOCUMENT_FIELDS } from './documentContract';
import type { Snapshot } from './snapshot';
import type { NotifyInput } from './slices/types';
import type { ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { ShiftBasis, ShiftReport } from '@/engine/scheduler/shiftExplanation';

const SCHEDULE_SHIFT_NOTICE_MS = 15000;

export const SCHEDULE_SHIFT_NOTICE_KEY = 'schedule-shift';

export interface ScheduleShift {
  documentId: string;
  report: ShiftReport;
  before: Snapshot;
  beforeResourceLoad: ResourceLoadResult | null;
  after: Snapshot;
  historyEventId: string | null;
  refreshedHistoryEvent: boolean;
}

export function previousSolveBasis(state: AppState): ShiftBasis | null {
  const { cpmResult, activeDocumentId, historyEvents } = state;
  if (!cpmResult) return null;
  let basis: Snapshot | null = null;
  let oldest = Infinity;
  for (const event of historyEvents) {
    if (event.state !== 'applied' || event.sequence >= oldest) continue;
    for (const delta of event.deltas) {
      if (delta.kind !== 'document-data' || delta.documentId !== activeDocumentId) continue;
      if (delta.before.cpmResult !== cpmResult) continue;
      basis = delta.before;
      oldest = event.sequence;
    }
  }
  if (!basis) return null;
  return {
    tasks: basis.tasks,
    calendar: basis.calendar,
    calendars: basis.calendars,
    assignments: basis.assignments,
    resources: basis.resources,
    project: basis.project,
    statusDate: basis.project.statusDate,
  };
}

export function canUndoScheduleShift(state: AppState): boolean {
  const shift = state.scheduleShift;
  if (!shift || shift.documentId !== state.activeDocumentId || shift.report.tasks.length === 0) return false;
  if (shift.historyEventId !== null
    && !state.historyEvents.some(event => event.id === shift.historyEventId && event.state === 'applied')) return false;
  const after = shift.after as unknown as Record<string, unknown>;
  return DOCUMENT_FIELDS.every(field => field.snapshot !== 'data' || Object.is(field.get(state), after[field.key]));
}

export function scheduleShiftNotice(report: ShiftReport): NotifyInput {
  const days = report.projectEndWorkdays;
  return {
    severity: 'info',
    messageKey: 'scheduleShift.notice',
    params: { count: report.tasks.length },
    ...(days === undefined ? {} : {
      detailLines: [days === 0
        ? { messageKey: 'scheduleShift.deliveryUnchanged' as const }
        : {
            messageKey: days > 0 ? 'scheduleShift.deliveryLater' as const : 'scheduleShift.deliveryEarlier' as const,
            params: { count: Math.abs(days) },
            numberParams: { days: Math.abs(days) },
          }],
    }),
    action: { kind: 'showScheduleShift', labelKey: 'scheduleShift.why' },
    secondaryAction: { kind: 'undoScheduleShift', labelKey: 'scheduleShift.undo' },
    dedupeKey: SCHEDULE_SHIFT_NOTICE_KEY,
    replaceOnDedupe: true,
    atEnd: true,
    durationMs: SCHEDULE_SHIFT_NOTICE_MS,
  };
}

export function openScheduleShiftPanel(store: AppState): void {
  const tab = store.ui.activeRibbonTab;
  if (store.ui.presentationMode) store.setPresentationMode(false);
  store.setUI({
    showScheduleShiftPanel: true,
    ...(tab === 'ifc' || tab === 'report' || tab === 'file' ? { activeRibbonTab: 'start' as const } : {}),
  });
}
