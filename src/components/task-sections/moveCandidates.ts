import type { ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import { isLeafTask } from '@/utils/taskHierarchy';

/**
 * Kandidaat-doeltaken voor "verplaats naar…" (item 4) in `TaskAssignmentsSection`: bladtaken
 * zonder mijlpaal, niet de brontaak zelf, en waarop de resource nog niet zit.
 *
 * WAAROM EEN INDEX. De oude regel stond inline in de component en liep per toewijzingsrij, bij
 * élke render, over alle taken × alle toewijzingen (`tasks.filter(… !assignments.some(…))`). Op
 * rehab-2.xer (6.978 taken, 52.640 toewijzingen) kostte één selectie daardoor 47 s en een
 * veldwijziging 105 s (prestatiemeting 2026-10-07). Nu:
 *  - de index `resourceId → Set<taskId>` kost één doorloop over de toewijzingen (de component
 *    bouwt hem in `useMemo` op `tasks`/`assignments`);
 *  - `has` stopt bij de eerste kandidaat — dat is alles wat een render nodig heeft (toon het menu
 *    of niet);
 *  - `list` loopt alleen de taken door en draait pas als de gebruiker het menu opent.
 */
export interface MoveCandidateLookup {
  /** Is er minstens één kandidaat? Stopt bij de eerste. */
  has(sourceTaskId: string, resourceId: string): boolean;
  /** Alle kandidaten, in taakvolgorde (dezelfde volgorde als de oude `tasks.filter`). */
  list(sourceTaskId: string, resourceId: string): Task[];
}

const NONE: ReadonlySet<string> = new Set();

export function createMoveCandidateLookup(tasks: readonly Task[], assignments: readonly ResourceAssignment[]): MoveCandidateLookup {
  const taskIdsByResource = new Map<string, Set<string>>();
  for (const a of assignments) {
    let taskIds = taskIdsByResource.get(a.resourceId);
    if (!taskIds) taskIdsByResource.set(a.resourceId, taskIds = new Set());
    taskIds.add(a.taskId);
  }
  const isCandidate = (t: Task, sourceTaskId: string, taken: ReadonlySet<string>) =>
    t.id !== sourceTaskId && !t.isMilestone && isLeafTask(t) && !taken.has(t.id);
  return {
    has(sourceTaskId, resourceId) {
      const taken = taskIdsByResource.get(resourceId) ?? NONE;
      for (const t of tasks) if (isCandidate(t, sourceTaskId, taken)) return true;
      return false;
    },
    list(sourceTaskId, resourceId) {
      const taken = taskIdsByResource.get(resourceId) ?? NONE;
      return tasks.filter(t => isCandidate(t, sourceTaskId, taken));
    },
  };
}
