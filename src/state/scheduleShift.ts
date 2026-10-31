import type { AppState } from './appStore';
import { DOCUMENT_FIELDS } from './documentContract';
import type { Snapshot } from './snapshot';
import type { NotifyInput } from './slices/types';
import type { ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { ShiftBasis, ShiftReport } from '@/engine/scheduler/shiftExplanation';

/** Hoe lang de melding na F5 blijft staan. Hij heeft twee knoppen om te lezen en te kiezen; daarna
 *  blijft de lijst bereikbaar via Beeld → Panelen. */
const SCHEDULE_SHIFT_NOTICE_MS = 15000;

export const SCHEDULE_SHIFT_NOTICE_KEY = 'schedule-shift';

/**
 * De laatste herberekening door de gebruiker (#742): de lijst plus wat Ongedaan maken nodig heeft.
 * De snapshots delen hun objecten met de store, dus dit kost alleen de verwijzingen.
 */
export interface ScheduleShift {
  documentId: string;
  report: ShiftReport;
  before: Snapshot;
  beforeResourceLoad: ResourceLoadResult | null;
  after: Snapshot;
  /** Het event dat `runCPM` zelf maakte (datums zoals opgeslagen, urenomzetting). Ongedaan maken
   *  herstelt precies dit event: het nieuwste kan een kolom of weergave zijn. */
  historyEventId: string | null;
  /** `runCPM` schreef zijn resultaat in het `after` van de vorige undo-stap; terugdraaien moet dat
   *  dan ook doen. */
  refreshedHistoryEvent: boolean;
}

/**
 * De invoer bij de vorige berekening: de voor-stand van de oudste bewerking die nog op dezelfde
 * `cpmResult` rekende. Bewerkingen raken `cpmResult` niet, dus dat is precies de stand die de solver
 * toen zag. `null` als er sinds die berekening geen bewerking in de geschiedenis staat.
 */
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

/** Is de projectdata nog die van direct na de herberekening? Alleen dan kan hij terug zonder iets
 *  anders mee te nemen. Een volgende F5 zonder verschil telt niet: die raakt alleen afgeleide velden. */
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

/** Open het paneel. Op de IFC- en Rapport-werkruimte, in Backstage en in de presentatiemodus bestaat
 *  de rail niet; spring dan mee naar de Gantt, net als de statusbalk bij de waarschuwingen. */
export function openScheduleShiftPanel(store: AppState): void {
  const tab = store.ui.activeRibbonTab;
  if (store.ui.presentationMode) store.setPresentationMode(false);
  store.setUI({
    showScheduleShiftPanel: true,
    ...(tab === 'ifc' || tab === 'report' || tab === 'file' ? { activeRibbonTab: 'start' as const } : {}),
  });
}
