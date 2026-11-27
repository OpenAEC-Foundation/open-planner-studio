import type { ExternalLink, Task } from '@/types/task';
import { parseInstant } from '@/utils/dateUtils';
import { sourceAnchorDate, type ExternalSourceDoc } from '@/engine/externalLinks';

export interface DependentCandidate {
  projectId: string;
  projectName: string;
  fileName?: string;
  opened: boolean;
  tasks: readonly Pick<Task, 'id' | 'name' | 'externalLinks'>[];
}

export interface DependentLink {
  projectId: string;
  projectName: string;
  fileName?: string;
  taskId: string;
  taskName: string;
  ownTaskId: string;
  linkId: string;
  direction: ExternalLink['direction'];
  relType: ExternalLink['relType'];
  lagDays?: number;
  lagMinutes?: number;
  anchorDate: string;
}

export interface DependentSearchSummary {
  projects: number;
  links: number;
}

export function findDependentLinks(
  candidates: readonly DependentCandidate[],
  ownProjectId: string,
): DependentLink[] {
  const own = ownProjectId.trim();
  if (!own) return [];
  const chosen = new Map<string, DependentCandidate>();
  for (const c of candidates) {
    const id = c.projectId.trim();
    if (!id || id === own) continue;
    const prev = chosen.get(id);
    if (!prev || (c.opened && !prev.opened)) chosen.set(id, c);
  }
  const out: DependentLink[] = [];
  for (const c of chosen.values()) {
    for (const task of c.tasks) {
      for (const link of task.externalLinks ?? []) {
        if (link.sourceRef.projectId.trim() !== own) continue;
        out.push({
          projectId: c.projectId,
          projectName: c.projectName,
          ...(c.fileName ? { fileName: c.fileName } : {}),
          taskId: task.id,
          taskName: task.name,
          ownTaskId: link.sourceRef.taskId,
          linkId: link.id,
          direction: link.direction,
          relType: link.relType,
          ...(link.lagDays !== undefined ? { lagDays: link.lagDays } : {}),
          ...(link.lagMinutes !== undefined ? { lagMinutes: link.lagMinutes } : {}),
          anchorDate: link.anchorDate,
        });
      }
    }
  }
  return out;
}

export function summarizeDependentLinks(links: readonly DependentLink[]): DependentSearchSummary {
  return { projects: new Set(links.map(l => l.projectId)).size, links: links.length };
}

export function isAnchorTighter(direction: ExternalLink['direction'], oldAnchor: string, newAnchor: string): boolean {
  if (!oldAnchor || !newAnchor) return false;
  const a = parseInstant(oldAnchor).getTime();
  const b = parseInstant(newAnchor).getTime();
  if (isNaN(a) || isNaN(b)) return false;
  return direction === 'predecessor' ? b > a : b < a;
}

export interface TightAnchor extends DependentLink {
  ownTaskName: string;
  newAnchorDate: string;
}

export function tightDependentAnchors(
  links: readonly DependentLink[],
  tasks: readonly Task[],
  source?: Pick<ExternalSourceDoc, 'lateDatesInFile'>,
): TightAnchor[] {
  const byId = new Map(tasks.map(t => [t.id, t] as const));
  const out: TightAnchor[] = [];
  for (const link of links) {
    const task = byId.get(link.ownTaskId);
    if (!task) continue;
    const next = sourceAnchorDate(link, task, source);
    if (!isAnchorTighter(link.direction, link.anchorDate, next)) continue;
    out.push({ ...link, ownTaskName: task.name, newAnchorDate: next });
  }
  return out;
}
