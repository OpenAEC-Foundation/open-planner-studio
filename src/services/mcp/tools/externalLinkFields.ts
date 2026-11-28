import type { ExternalLink, Task } from '@/types/task';
import { formatExternalLagShort } from '@/engine/taskGrid/relationFormat';

export function externalLinkView(link: ExternalLink) {
  const ref = link.sourceRef;
  return {
    linkId: link.id,
    direction: link.direction,
    type: link.relType,
    lag: formatExternalLagShort(link, 'h'),
    anchorDate: link.anchorDate,
    sourceMissing: link.sourceMissing,
    source: {
      projectId: ref.projectId,
      ...(ref.projectName ? { projectName: ref.projectName } : {}),
      taskId: ref.taskId,
      ...(ref.taskName ? { taskName: ref.taskName } : {}),
      ...(ref.filePath ? { filePath: ref.filePath } : {}),
    },
  };
}

function ancestorsOf(task: Task, byId: ReadonlyMap<string, Task>): Task[] {
  const out: Task[] = [];
  const visited = new Set<string>([task.id]);
  let parentId = task.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    out.push(parent);
    parentId = parent.parentId;
  }
  return out;
}

export function inheritedExternalLinkViews(task: Task, byId: ReadonlyMap<string, Task>) {
  return ancestorsOf(task, byId).flatMap(phase => (phase.externalLinks ?? []).map(link => ({
    ...externalLinkView(link),
    fromTaskId: phase.id,
    fromWbs: phase.wbsCode,
  })));
}

export function externalRelationCount(task: Task, byId: ReadonlyMap<string, Task>): number {
  return (task.externalLinks?.length ?? 0)
    + ancestorsOf(task, byId).reduce((sum, phase) => sum + (phase.externalLinks?.length ?? 0), 0);
}
