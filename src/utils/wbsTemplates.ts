import type { Task } from '@/types/task';
import { collectSubtreeIds } from '@/state/taskTree';
import type { Sequence } from '@/types/sequence';
import { generateId } from '@/utils/id';
import { noteSiteHostSettingChanged } from '@/services/fileAccess/siteHostSettings';

export interface WbsTemplateTask {
  id: string;
  parentId: string | null;
  name: string;
  description: string;
  taskType: Task['taskType'];
  isMilestone: boolean;
  durationDays: number;
}

export interface WbsTemplateSequence {
  predecessorId: string;
  successorId: string;
  type: Sequence['type'];
  lagDays: number;
  lagMinutes?: Sequence['lagMinutes'];
  lagUnit?: Sequence['lagUnit'];
  lagPercent?: number;
}

export interface WbsTemplate {
  id: string;
  name: string;
  createdAt: string;
  tasks: WbsTemplateTask[];
  sequences: WbsTemplateSequence[];
}

const STORAGE_KEY = 'ops-wbs-templates';

export function listWbsTemplates(): WbsTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(templates: WbsTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    noteSiteHostSettingChanged(STORAGE_KEY);
  } catch { }
}

export function deleteWbsTemplate(id: string): void {
  persist(listWbsTemplates().filter(t => t.id !== id));
}

export function saveBranchAsWbsTemplate(
  name: string,
  rootId: string,
  allTasks: Task[],
  allSequences: Sequence[],
): WbsTemplate {
  const byId = new Map(allTasks.map(t => [t.id, t]));
  const branchIds = collectSubtreeIds(allTasks, rootId).filter(id => byId.has(id));
  const branchSet = new Set(branchIds);

  const localId = new Map(branchIds.map((id, i) => [id, `t${i + 1}`]));
  const tasks: WbsTemplateTask[] = branchIds.map(id => {
    const task = byId.get(id)!;
    const parentLocal = id === rootId ? null : localId.get(task.parentId ?? '') ?? null;
    return {
      id: localId.get(id)!,
      parentId: parentLocal,
      name: task.name,
      description: task.description,
      taskType: task.taskType,
      isMilestone: task.isMilestone,
      durationDays: task.isMilestone ? 0 : task.time.scheduleDuration,
    };
  });
  const sequences: WbsTemplateSequence[] = allSequences
    .filter(q => branchSet.has(q.predecessorId) && branchSet.has(q.successorId))
    .map(q => ({
      predecessorId: localId.get(q.predecessorId)!,
      successorId: localId.get(q.successorId)!,
      type: q.type,
      lagDays: q.lagDays,
      ...(q.lagMinutes !== undefined ? { lagMinutes: q.lagMinutes } : {}),
      ...(q.lagUnit !== undefined ? { lagUnit: q.lagUnit } : {}),
      ...(q.lagPercent !== undefined ? { lagPercent: q.lagPercent } : {}),
    }));

  const template: WbsTemplate = {
    id: generateId('wtpl'),
    name,
    createdAt: new Date().toISOString(),
    tasks,
    sequences,
  };
  persist([...listWbsTemplates(), template]);
  return template;
}
