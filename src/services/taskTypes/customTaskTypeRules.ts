import type { CustomTaskType } from '@/types/taskType';

export function sameTaskTypeName(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
}

export function customTaskTypeClashes(
  types: readonly CustomTaskType[],
  candidate: Pick<CustomTaskType, 'id' | 'name'>,
): { sameId?: CustomTaskType; sameNameOtherId?: CustomTaskType } {
  return {
    sameId: types.find(type => type.id === candidate.id),
    sameNameOtherId: types.find(type => type.id !== candidate.id && sameTaskTypeName(type.name, candidate.name)),
  };
}

export function savedCustomTaskTypes(
  tasks: readonly { customTaskTypeId?: string }[],
  types: readonly CustomTaskType[],
): CustomTaskType[] {
  const used = new Set(tasks.map(task => task.customTaskTypeId).filter((id): id is string => !!id));
  return types.filter(type => used.has(type.id));
}

export function customTaskTypeInUse(tasks: readonly { customTaskTypeId?: string }[], id: string): boolean {
  return tasks.some(task => task.customTaskTypeId === id);
}

export function renamedCustomTaskTypes(
  types: readonly CustomTaskType[],
  id: string,
  name: string,
): CustomTaskType[] | null {
  const { sameId, sameNameOtherId } = customTaskTypeClashes(types, { id, name });
  if (!sameId || sameNameOtherId || sameId.name === name) return null;
  return types.map(type => type.id === id ? { ...type, name } : type);
}
