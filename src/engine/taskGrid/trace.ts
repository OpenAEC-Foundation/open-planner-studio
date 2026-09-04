import { traceFrom } from '@/engine/scheduler/graphWalk';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { Sequence } from '@/types/sequence';

export type TaskTraceMode = 'off' | 'predecessors' | 'successors' | 'both';

export interface TaskTrace {
  focusId: string;
  predecessors: readonly string[];
  drivingPredecessors: readonly string[];
  successors: readonly string[];
  drivenSuccessors: readonly string[];
}

export type TaskTraceRole =
  | 'focus'
  | 'predecessor-driving'
  | 'predecessor'
  | 'successor-driving'
  | 'successor'
  | 'dimmed';

const traceRoles = new WeakMap<TaskTrace, ReadonlyMap<string, TaskTraceRole>>();

function roleMap(trace: TaskTrace): ReadonlyMap<string, TaskTraceRole> {
  const cached = traceRoles.get(trace);
  if (cached) return cached;
  const roles = new Map<string, TaskTraceRole>();
  for (const id of trace.successors) roles.set(id, 'successor');
  for (const id of trace.drivenSuccessors) roles.set(id, 'successor-driving');
  for (const id of trace.predecessors) roles.set(id, 'predecessor');
  for (const id of trace.drivingPredecessors) roles.set(id, 'predecessor-driving');
  roles.set(trace.focusId, 'focus');
  traceRoles.set(trace, roles);
  return roles;
}

/** De ene pure traceprojectie voor canvas én beide taakrasters. */
export function buildTrace(
  traceMode: TaskTraceMode,
  selectedTaskIds: readonly string[],
  sequences: Sequence[],
  cpmResult: CPMResult | null | undefined,
): TaskTrace | undefined {
  if (traceMode === 'off' || selectedTaskIds.length === 0) return undefined;
  const focusId = selectedTaskIds[0];
  const drivingIds = cpmResult && !cpmResult.error
    ? new Set(cpmResult.drivingSequenceIds)
    : undefined;
  const traced = traceFrom(focusId, sequences, drivingIds);
  return {
    focusId,
    predecessors: traceMode !== 'successors' ? [...traced.predecessors] : [],
    drivingPredecessors: traceMode !== 'successors' ? [...traced.drivingPredecessors] : [],
    successors: traceMode !== 'predecessors' ? [...traced.successors] : [],
    drivenSuccessors: traceMode !== 'predecessors' ? [...traced.drivenSuccessors] : [],
  };
}

/** Eén classificatievolgorde voorkomt verschil tussen raster en canvas bij vreemde grafen. */
export function classifyTraceTask(
  trace: TaskTrace | null | undefined,
  taskId: string,
): TaskTraceRole | null {
  if (!trace) return null;
  return roleMap(trace).get(taskId) ?? 'dimmed';
}

export function taskGridTraceClass(role: TaskTraceRole | null): string | null {
  return role ? `task-grid-trace-${role}` : null;
}

export function isRelationOutsideTrace(
  trace: TaskTrace | null | undefined,
  predecessorId: string,
  successorId: string,
): boolean {
  return !!trace
    && (classifyTraceTask(trace, predecessorId) === 'dimmed'
      || classifyTraceTask(trace, successorId) === 'dimmed');
}
