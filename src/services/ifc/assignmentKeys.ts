export interface UnusedAssignmentKey {
  readonly name: string;
  readonly value: string;
}

const NUMBERED_KEY = /^(.+)#(\d+)$/;

export function isAssignmentKeyName(name: string): boolean {
  return /^[0-9A-Za-z_$]{22}(#\d+)?$/.test(name);
}

export function unusedAssignmentKeyNames(ownNames: readonly string[], unusedNames: readonly string[]): string[] {
  const firstFreeNumber = ownNames.length;
  const taken = new Set(ownNames);
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
