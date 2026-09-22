// De solve-opties die de bibliotheektests vóór de rekenprofielen impliciet gebruikten: geen statusdatum,
// geen projectdatums, OPS-conventies, geen opties — byte-identiek met de oude aanroepen.
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import type { ProjectSolveOptions } from '@/engine/scheduler/solveInput';

export const neutralSolveOptions = (): ProjectSolveOptions => ({
  dataDate: undefined, progressMode: undefined, schedulingOptions: effectiveSchedulingOptions({}),
  projectStartDate: undefined, projectEndDate: undefined,
});
