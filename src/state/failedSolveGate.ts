import type { AppState } from './appStore';
import type { SolveProjectFields } from '@/engine/scheduler/solveInput';

type GateState = Pick<AppState, 'cpmResult' | 'tasks' | 'sequences' | 'calendar' | 'calendars' | 'project'>;

interface PlanningInput {
  tasks: GateState['tasks'];
  sequences: GateState['sequences'];
  calendar: GateState['calendar'];
  calendars: GateState['calendars'];
  statusDate: SolveProjectFields['statusDate'];
  progressMode: SolveProjectFields['progressMode'];
  schedulingOptions: SolveProjectFields['schedulingOptions'];
  schedulingProfile: SolveProjectFields['schedulingProfile'];
  startDate: SolveProjectFields['startDate'];
  endDate: SolveProjectFields['endDate'];
}

export const planningInputOf = (s: GateState): PlanningInput => ({
  tasks: s.tasks,
  sequences: s.sequences,
  calendar: s.calendar,
  calendars: s.calendars,
  statusDate: s.project.statusDate,
  progressMode: s.project.progressMode,
  schedulingOptions: s.project.schedulingOptions,
  schedulingProfile: s.project.schedulingProfile,
  startDate: s.project.startDate,
  endDate: s.project.endDate,
});

function samePlanningInput(a: PlanningInput, b: PlanningInput): boolean {
  const keys = Object.keys(a) as (keyof PlanningInput)[];
  return keys.length === Object.keys(b).length && keys.every((k) => Object.is(a[k], b[k]));
}

export interface FailedSolveGate {
  blocks(state: GateState): boolean;
}

export function createFailedSolveGate(initial: GateState): FailedSolveGate {
  let seen = initial.cpmResult;
  let failedInput = initial.cpmResult?.error ? planningInputOf(initial) : null;
  return {
    blocks(state) {
      if (state.cpmResult !== seen) {
        seen = state.cpmResult;
        failedInput = state.cpmResult?.error ? planningInputOf(state) : null;
      }
      return failedInput !== null && samePlanningInput(failedInput, planningInputOf(state));
    },
  };
}
