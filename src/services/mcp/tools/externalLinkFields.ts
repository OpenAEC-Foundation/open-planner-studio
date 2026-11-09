// De leesvorm van externe relaties (koppelingen naar een taak in een ander projectbestand) voor de MCP-leestools
// (keuze 11, Ethan 2026-11-03; stap 1.10 in `docs/relaties-tussen-projecten.md`). Alles wat de agent leest is
// Engels; dit commentaar is Nederlands.
//
// Een externe relatie op een fase geldt voor elke bladtaak in die fase (`effectiveExternalLinks` in
// `expandSummaryRelations.ts`, zoals de berekening en de rapporten). `planner_get_task` toont daarom naast de
// eigen koppelingen ook de geërfde, met de fase erbij.
import type { ExternalLink, Task } from '@/types/task';
import { formatExternalLagShort } from '@/engine/taskGrid/relationFormat';

/** Eén koppeling zoals de agent haar leest. */
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

/** De fasen boven een taak, van dichtbij naar ver; cyclusvast. */
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

/** De koppelingen die een taak erft van haar fasen, met de fase erbij (`fromTaskId`, `fromWbs`). */
export function inheritedExternalLinkViews(task: Task, byId: ReadonlyMap<string, Task>) {
  return ancestorsOf(task, byId).flatMap(phase => (phase.externalLinks ?? []).map(link => ({
    ...externalLinkView(link),
    fromTaskId: phase.id,
    fromWbs: phase.wbsCode,
  })));
}

/** Hoeveel externe relaties gelden voor deze taak: eigen plus geërfd van haar fasen. */
export function externalRelationCount(task: Task, byId: ReadonlyMap<string, Task>): number {
  return (task.externalLinks?.length ?? 0)
    + ancestorsOf(task, byId).reduce((sum, phase) => sum + (phase.externalLinks?.length ?? 0), 0);
}
