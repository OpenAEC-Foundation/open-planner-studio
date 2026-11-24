import { ifcGuid128, ifcObjectSeed, type IfcObjectKind, type WriteIFCInput } from '../ifcWriter';
import { DEFAULT_CALENDAR_ID } from '@/engine/calendar/defaultCalendar';

export type IfcxObjectKind = IfcObjectKind | 'baseline' | 'assignment';

export type GlobalIdOf = (kind: IfcxObjectKind, id: string) => string;

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

export function derivedGlobalId(kind: IfcxObjectKind, id: string, projectId: string): string {
  return ifcGuid128(hashSeedOf(kind, id, projectId));
}

export function stepGlobalIdsFor(input: WriteIFCInput): GlobalIdOf {
  const preserved = new Map(Object.entries(input.ifcGlobalIds ?? {}));
  const reserved = new Set(preserved.values());
  const used = new Set<string>();
  const issued = new Map<string, string>();
  const issue: GlobalIdOf = (kind, id) => {
    const key = globalIdKey(kind, id);
    const cached = issued.get(key);
    if (cached !== undefined) return cached;
    const kept = preserved.get(key);
    let guid: string;
    if (kept !== undefined && !used.has(kept)) {
      guid = kept;
    } else {
      const seed = hashSeedOf(kind, id, input.project.id);
      guid = ifcGuid128(seed);
      for (let n = 1; used.has(guid) || reserved.has(guid); n++) guid = ifcGuid128(`${seed}#dup${n}`);
    }
    issued.set(key, guid);
    used.add(guid);
    return guid;
  };
  issue('proj', input.project.id);
  issue('cal', input.calendar.id);
  issue('wp', input.project.id);
  issue('ws', input.project.id);
  for (const baseline of input.baselines ?? []) issue('baseline', baseline.id);
  for (const task of input.tasks) issue('task', task.id);
  for (const sequence of input.sequences) issue('seq', sequence.id);
  for (const resource of input.resources) issue('res', resource.id);
  for (const calendar of libraryCalendarsWrittenByStep(input)) issue('cal', calendar.id);
  for (const baseline of input.baselines ?? []) for (const row of baseline.tasks) if (row.taskId) issue('task', row.taskId);
  for (const assignment of input.assignments) issue('assignment', assignment.id);
  return issue;
}

