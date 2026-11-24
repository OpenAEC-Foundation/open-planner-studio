import { ifcGuid128, ifcObjectSeed, type IfcObjectKind, type WriteIFCInput } from '../ifcWriter';
import { DEFAULT_CALENDAR_ID } from '@/engine/calendar/defaultCalendar';

export type IfcxObjectKind = IfcObjectKind | 'baseline' | 'assignment';

export function libraryCalendarsWrittenByStep(input: Pick<WriteIFCInput, 'project' | 'resourceCalendars'>) {
  return (input.resourceCalendars ?? []).filter(calendar => calendar.id !== input.project.calendarId);
}

export function globalIdKey(kind: IfcxObjectKind, id: string): string {
  if (kind === 'baseline') return `baseline_ws_${id}`;
  if (kind === 'assignment') return `ifcx_assignment_${id}`;
  return ifcObjectSeed(kind, id);
}

function hashSeedOf(kind: IfcxObjectKind, id: string, projectId: string): string {
  const key = globalIdKey(kind, id);
  if (kind === 'baseline' || kind === 'assignment') return `${projectId}/${key}`;
  return kind === 'cal' && id === DEFAULT_CALENDAR_ID ? `${key}@${projectId}` : key;
}

export function defaultGlobalId(kind: IfcxObjectKind, id: string, projectId: string): string {
  return ifcGuid128(hashSeedOf(kind, id, projectId));
}
