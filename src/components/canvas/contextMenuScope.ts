import type { PlannedProgressDates } from '@/engine/taskMutationRules';
import { useAppStore } from '@/state/appStore';
import { appTaskBulkActions } from '@/state/taskBulkActions';
import { addTaskNearSelection, insertTaskRelativeToScope } from '@/state/taskInsertActions';
import type { Task } from '@/types/task';
import { hasMilestoneBlockingAssignments, milestoneRefusal, taskMilestoneTransition, type MilestoneRefusal } from '@/engine/taskMilestoneTransition';
import { milestoneRefusalNotices } from '@/state/structuralTransition';
import { descendantLeaves } from '@/engine/scheduler/summaryProgress';
import { isLeafTask } from '@/utils/taskHierarchy';
import { localTodayIso } from '@/utils/dateUtils';
import { planStoredProgressEdit } from '@/state/slices/taskSlice';
import { progressPlacementForBatch, progressPlannedDates } from '@/state/progressPlannedDates';
import { askActualStart, type ActualStartAnswers } from '@/state/actualStartQuestion';

export function contextMenuOutlineScope(taskId: string): string[] {
  const selected = useAppStore.getState().selectedTaskIds;
  return selected.includes(taskId) ? selected : [taskId];
}

export const contextMenuBulk = {
  indent(taskId: string): void {
    useAppStore.getState().indentTasks(contextMenuOutlineScope(taskId));
  },

  outdent(taskId: string): void {
    useAppStore.getState().outdentTasks(contextMenuOutlineScope(taskId));
  },

  insert(taskId: string, where: 'above' | 'below', name: string): void {
    insertTaskRelativeToScope(contextMenuOutlineScope(taskId), where, { name });
  },

  addNearSelection(name: string): void {
    addTaskNearSelection({ name });
  },

  toggleMilestone(task: Task): void {
    const isMilestone = !task.isMilestone;
    const { tasks, assignments, resources } = useAppStore.getState();
    const refused: { id: string; name: string; refusal: MilestoneRefusal }[] = [];
    const scope = contextMenuOutlineScope(task.id).filter((id) => {
      const current = tasks.find(candidate => candidate.id === id);
      if (!isMilestone || !current || current.isMilestone) return true;
      const refusal = milestoneRefusal({
        hasChildren: current.childIds.length > 0,
        hasAssignments: hasMilestoneBlockingAssignments(id, assignments, resources),
      });
      if (refusal) refused.push({ id, name: current.name, refusal });
      return !refusal;
    });
    appTaskBulkActions.applyToTaskIds(
      scope,
      (state, id) => {
        const current = state.tasks.find(candidate => candidate.id === id);
        if (current) state.updateTask(id, taskMilestoneTransition(current, isMilestone));
      },
    );
    for (const notice of milestoneRefusalNotices(refused)) useAppStore.getState().notify(notice);
  },

  setCalendar(taskId: string, calendarId: string | undefined): void {
    const { tasks } = useAppStore.getState();
    const ids = contextMenuOutlineScope(taskId)
      .filter((id) => tasks.find((t) => t.id === id)?.calendarId !== calendarId);
    appTaskBulkActions.applyToTaskIds(ids, (state, id) => state.setTaskCalendar(id, calendarId));
  },

  async setProgress(taskId: string, completion: number): Promise<void> {
    const today = localTodayIso();
    const state = useAppStore.getState();
    const byId = new Map(state.tasks.map((t) => [t.id, t]));
    const leafIds = new Set<string>();
    for (const id of contextMenuOutlineScope(taskId)) {
      const task = byId.get(id);
      if (!task) continue;
      if (isLeafTask(task)) leafIds.add(task.id);
      else for (const leaf of descendantLeaves(task, byId)) leafIds.add(leaf.id);
    }
    const ids = [...leafIds];
    const edit = { field: 'completion', value: completion } as const;
    const dates = new Map<string, PlannedProgressDates | undefined>();
    const baseDates = progressPlannedDates(state);
    let answers: ActualStartAnswers = {};
    while (true) {
      const batch = completion > 0
        ? progressPlacementForBatch(state, leafIds, state.project.statusDate || today)
        : undefined;
      const plannedDates = batch?.plannedDates ?? baseDates;
      const questions = [];
      dates.clear();
      for (const id of batch?.order ?? ids) {
        const task = byId.get(id)!;
        const plan = planStoredProgressEdit(state, task, edit, {
          today, actualStart: answers[id],
          plannedDates: () => {
            const placement = plannedDates(task);
            dates.set(id, placement);
            return placement;
          },
        });
        if (plan.ok && plan.change) batch?.accept(task, plan.change.task);
        if (!plan.ok && plan.reason === 'needsActualStart') questions.push({ ...plan.question, taskName: task.name });
      }
      if (questions.length === 0) break;
      const given = await askActualStart(questions);
      if (!given) return;
      answers = { ...answers, ...given };
    }
    appTaskBulkActions.applyToTaskIds(ids, (current, id) => {
      current.enterTaskProgress(id, edit, { today, actualStart: answers[id],
        plannedDates: () => dates.get(id) });
    });
  },

  setPriority(taskId: string, priority: number): void {
    appTaskBulkActions.applyToTaskIds(
      contextMenuOutlineScope(taskId),
      (state, id) => state.updateTask(id, { priority }),
    );
  },

  remove(taskId: string): void {
    appTaskBulkActions.deleteTasksBulk(contextMenuOutlineScope(taskId));
  },

  dissolve(taskId: string): void {
    appTaskBulkActions.dissolveTasksBulk(contextMenuOutlineScope(taskId));
  },
};
