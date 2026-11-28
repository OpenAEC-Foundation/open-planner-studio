import type { RecordedDatesState } from '@/engine/scheduler/recordedDates';

export type RecordedDatesActiveKey = 'recordedDates.activeCount' | 'recordedDates.activeCountNeutral';

export function recordedDatesActiveKey(origin: RecordedDatesState['origin']): RecordedDatesActiveKey {
  return isPrimaveraRecordedOrigin(origin)
    ? 'recordedDates.activeCount'
    : 'recordedDates.activeCountNeutral';
}

export type RecordedDatesTaskShownKey = 'properties.recordedDatesShown' | 'properties.recordedDatesShownNeutral';
export type RecordedDatesTaskMissingKey = 'properties.recordedDatesMissing' | 'properties.recordedDatesMissingNeutral';

export function recordedDatesTaskShownKey(origin: RecordedDatesState['origin']): RecordedDatesTaskShownKey {
  return isPrimaveraRecordedOrigin(origin)
    ? 'properties.recordedDatesShown'
    : 'properties.recordedDatesShownNeutral';
}

export function recordedDatesTaskMissingKey(origin: RecordedDatesState['origin']): RecordedDatesTaskMissingKey {
  return isPrimaveraRecordedOrigin(origin)
    ? 'properties.recordedDatesMissing'
    : 'properties.recordedDatesMissingNeutral';
}

export function isPrimaveraRecordedOrigin(origin: RecordedDatesState['origin']): boolean {
  return origin === 'xer' || origin === 'xer-archive' || origin === 'p6xml';
}
