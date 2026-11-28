import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import type { ProjectSolveOptions } from '@/engine/scheduler/solveInput';

export const neutralSolveOptions = (): ProjectSolveOptions => ({
  dataDate: undefined, progressMode: undefined, schedulingOptions: effectiveSchedulingOptions({}),
  projectStartDate: undefined, projectEndDate: undefined,
});
