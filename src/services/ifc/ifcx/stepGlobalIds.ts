import { ifcGuid128, ifcObjectSeed, type IfcObjectKind, type WriteIFCInput } from '../ifcWriter';
import { DEFAULT_CALENDAR_ID } from '@/engine/calendar/defaultCalendar';

export type GlobalIdOf = (kind: IfcObjectKind, id: string) => string;

export function libraryCalendarsWrittenByStep(input: Pick<WriteIFCInput, 'project' | 'resourceCalendars'>) {
  return (input.resourceCalendars ?? []).filter(calendar => calendar.id !== input.project.calendarId);
}

export function stepGlobalIdsFor(input: WriteIFCInput): GlobalIdOf {
  const preserved = new Map(Object.entries(input.ifcGlobalIds ?? {}));
  const reserved = new Set(preserved.values());
  const used = new Set<string>();
  const issued = new Map<string, string>();
  const issue: GlobalIdOf = (kind, id) => {
    const key = ifcObjectSeed(kind, id);
    const cached = issued.get(key);
    if (cached !== undefined) return cached;
    const kept = preserved.get(key);
    let guid: string;
    if (kept !== undefined && !used.has(kept)) {
      guid = kept;
    } else {
      const hashSeed = kind === 'cal' && id === DEFAULT_CALENDAR_ID ? `${key}@${input.project.id}` : key;
      guid = ifcGuid128(hashSeed);
      for (let n = 1; used.has(guid) || reserved.has(guid); n++) guid = ifcGuid128(`${hashSeed}#dup${n}`);
    }
    issued.set(key, guid);
    used.add(guid);
    return guid;
  };
  issue('proj', input.project.id);
  issue('cal', input.calendar.id);
  issue('wp', input.project.id);
  issue('ws', input.project.id);
  for (const task of input.tasks) issue('task', task.id);
  for (const sequence of input.sequences) issue('seq', sequence.id);
  for (const calendar of libraryCalendarsWrittenByStep(input)) issue('cal', calendar.id);
  return issue;
}
