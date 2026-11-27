import type { ResourceAssignment } from '@/types/resource';

export interface UnusedAssignmentKey {
  readonly name: string;
  readonly value: string;
}

const NUMBERED_KEY = /^(.+)#(\d+)$/;

export function assignmentKeyName(resourceGuid: string, place: number): string {
  return `${resourceGuid}#${place}`;
}

export function stepAssignmentIds(assignments: readonly ResourceAssignment[], resourceGuid: (id: string) => string): string[] {
  const places = new Map<string, number>();
  return assignments.map(assignment => {
    const place = places.get(assignment.taskId) ?? 0;
    places.set(assignment.taskId, place + 1);
    return `asgn-${assignment.taskId}/${assignmentKeyName(resourceGuid(assignment.resourceId), place)}`;
  });
}

export function isAssignmentKeyName(name: string): boolean {
  return /^[0-9A-Za-z_$]{22}(#\d+)?$/.test(name);
}

export function unusedAssignmentKeyNames(ownNames: readonly string[], unusedNames: readonly string[],
  foreignMemberNames: readonly string[] = []): string[] {
  const firstFreeNumber = ownNames.length;
  const taken = new Set([...ownNames, ...foreignMemberNames]);
  const names: (string | undefined)[] = unusedNames.map(name => {
    const numbered = NUMBERED_KEY.exec(name);
    if (!numbered) return name;
    if (Number(numbered[2]) < firstFreeNumber || taken.has(name)) return undefined;
    taken.add(name);
    return name;
  });
  return names.map((name, k) => {
    if (name !== undefined) return name;
    const resourceGuid = NUMBERED_KEY.exec(unusedNames[k])![1];
    let n = firstFreeNumber;
    while (taken.has(`${resourceGuid}#${n}`)) n++;
    const renumbered = `${resourceGuid}#${n}`;
    taken.add(renumbered);
    return renumbered;
  });
}
