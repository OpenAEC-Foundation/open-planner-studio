import { ifcGuid128, ifcObjectSeed, type IfcObjectKind } from '../ifcWriter';
import { DEFAULT_CALENDAR_ID } from '@/engine/calendar/defaultCalendar';

export function defaultGlobalId(kind: IfcObjectKind, id: string, projectId: string): string {
  const key = ifcObjectSeed(kind, id);
  return ifcGuid128(kind === 'cal' && id === DEFAULT_CALENDAR_ID ? `${key}@${projectId}` : key);
}
