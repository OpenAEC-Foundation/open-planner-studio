import type { BaselineTask } from '@/types/baseline';
import type { Task } from '@/types/task';
import { isLeafTask } from '@/utils/taskHierarchy';
import { shownFinish, shownStart } from '@/utils/taskDates';

function uniqueTaskByCode(tasks: readonly Task[]): Map<string, Task> {
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.wbsCode) continue;
    const matches = grouped.get(task.wbsCode) ?? [];
    matches.push(task);
    grouped.set(task.wbsCode, matches);
  }
  return new Map(
    [...grouped]
      .filter(([, matches]) => matches.length === 1)
      .map(([code, matches]) => [code, matches[0]]),
  );
}

export function baselineTasksFromSource(
  ownerTasks: readonly Task[],
  sourceTasks: readonly Task[],
): { tasks: BaselineTask[]; projectEnd: string } {
  const ownerLeaves = ownerTasks.filter(isLeafTask);
  const ownerById = new Map(ownerLeaves.map(task => [task.id, task]));
  const ownerByCode = uniqueTaskByCode(ownerLeaves);
  const tasks = sourceTasks.filter(isLeafTask).map(task => {
    const matched = ownerById.get(task.id) ?? ownerByCode.get(task.wbsCode);
    return {
      taskId: matched?.id ?? task.id,
      sourceTaskId: task.id,
      sourceTaskCode: task.wbsCode,
      start: shownStart(task),
      finish: shownFinish(task),
      duration: task.time.scheduleDuration,
      isMilestone: task.isMilestone,
      ...(task.milestoneKind ? { milestoneKind: task.milestoneKind } : {}),
    };
  });
  const finishes = tasks.map(task => task.finish).filter(Boolean).sort();
  return { tasks, projectEnd: finishes[finishes.length - 1] ?? '' };
}
