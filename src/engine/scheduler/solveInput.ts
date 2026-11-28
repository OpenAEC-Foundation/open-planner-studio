import type { EffectiveSchedulingOptions, Project, ProgressMode } from '@/types/project';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { effectiveSchedulingOptions } from './conventions/registry';
import type { SolveProjectInput } from './solveProject';

export type SolveProjectFields = Pick<Project,
  'statusDate' | 'progressMode' | 'schedulingOptions' | 'schedulingProfile' | 'startDate' | 'endDate'>;

export interface ProjectSolveOptions {
  dataDate: string | undefined;
  progressMode: ProgressMode | undefined;
  schedulingOptions: EffectiveSchedulingOptions;
  projectStartDate: string | undefined;
  projectEndDate: string | undefined;
}

export function solveOptionsFor(project: SolveProjectFields): ProjectSolveOptions {
  return {
    dataDate: project.statusDate,
    progressMode: project.progressMode,
    schedulingOptions: effectiveSchedulingOptions(project),
    projectStartDate: project.startDate,
    projectEndDate: project.endDate,
  };
}

export function solveInputFor(
  project: SolveProjectFields, tasks: Task[], sequences: Sequence[],
  calendar: WorkCalendar, calendars: WorkCalendar[],
): SolveProjectInput {
  return { tasks, sequences, calendar, calendars, ...solveOptionsFor(project) };
}
