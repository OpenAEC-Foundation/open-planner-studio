import type { Task } from '@/types/task';
import type { PlannedProgressDates } from '@/engine/taskMutationRules';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { EffectiveSchedulingOptions, ProgressMode } from '@/types/project';
import { CPMSolver, type CPMResult } from './CPMSolver';
import { applyCpmResult } from './applyCpmResult';
import { expandSummaryRelations, foldSyntheticSequenceIds, leafTasksForSolve } from './expandSummaryRelations';

export interface SolveProjectInput {
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  dataDate?: string;
  progressMode?: ProgressMode;
  schedulingOptions: EffectiveSchedulingOptions;
  projectStartDate?: string;
  projectEndDate?: string;
  traceDateDrivers?: boolean;
}

export function solveProject(input: SolveProjectInput, originalTasks?: readonly Task[]): CPMResult {
  const leafTasks = leafTasksForSolve(input.tasks);
  const { sequences: expandedSequences, droppedSequenceIds: expansionDropped } =
    expandSummaryRelations(input.tasks, input.sequences);
  const solver = new CPMSolver(leafTasks, expandedSequences, input.calendar, input.calendars, {
    dataDate: input.dataDate,
    progressMode: input.progressMode,
    schedulingOptions: input.schedulingOptions,
    projectStartDate: input.projectStartDate,
    projectEndDate: input.projectEndDate,
    traceDateDrivers: input.traceDateDrivers,
  });
  const result = solver.solve();
  foldSyntheticSequenceIds(result);
  if (expansionDropped.length > 0) {
    result.droppedSequenceIds = [...new Set([...(result.droppedSequenceIds ?? []), ...expansionDropped])];
  }

  if (result.error) return result;

  applyCpmResult(input.tasks, result, { projectCalendar: input.calendar, calendars: input.calendars });

  if (originalTasks && input.dataDate && !input.schedulingOptions.unstartedIgnoresStatusDate) {
    progressPlans.set(result, { input: { ...input, tasks: originalTasks } });
  }
  return result;
}

type ProgressPlanInput = Omit<SolveProjectInput, 'tasks'> & { tasks: readonly Task[] };
const progressPlans = new WeakMap<CPMResult, { input: ProgressPlanInput } | { dates: Map<string, PlannedProgressDates> }>();

export function plannedDatesBeforeStatusShift(result: CPMResult | null, task: Task): PlannedProgressDates | undefined {
  const computed = result?.tasks.get(task.id);
  if (!result || !computed || computed.earlyStart !== task.time.earlyStart
    || computed.earlyFinish !== task.time.earlyFinish) return undefined;
  const plan = progressPlans.get(result);
  if (!plan) return undefined;
  if ('dates' in plan) return plan.dates.get(task.id);

  const input = plan.input;
  const withoutFloor = solveProject({
    ...input,
    tasks: cloneTasksForSolve(input.tasks),
    schedulingOptions: { ...input.schedulingOptions, unstartedIgnoresStatusDate: true },
    traceDateDrivers: false,
  });
  const dates = new Map<string, PlannedProgressDates>();
  for (const [id, { earlyStart, earlyFinish }] of withoutFloor.tasks) {
    const previous = result.tasks.get(id);
    if (earlyStart !== previous?.earlyStart || earlyFinish !== previous.earlyFinish) {
      dates.set(id, { earlyStart, earlyFinish });
    }
  }
  progressPlans.set(result, { dates });
  return dates.get(task.id);
}

export function cloneTasksForSolve(tasks: readonly Task[]): Task[] {
  return tasks.map(task => ({ ...task, time: { ...task.time } }));
}
