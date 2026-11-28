import type { AppState } from '@/state/appStore';
import { knownDrivingSequenceIds } from '@/engine/scheduler/drivingInfo';

export type RelationStepDirection = 'predecessor' | 'successor';

export function relationStepTarget(
  state: Pick<AppState, 'tasks' | 'sequences' | 'cpmResult'>,
  taskId: string,
  direction: RelationStepDirection,
): string | null {
  const tasksById = new Map(state.tasks.map(task => [task.id, task] as const));
  const freeFloatKnown = knownDrivingSequenceIds(state.cpmResult) !== undefined;
  const candidates = state.sequences.flatMap(seq => {
    const otherId = direction === 'predecessor'
      ? (seq.successorId === taskId ? seq.predecessorId : undefined)
      : (seq.predecessorId === taskId ? seq.successorId : undefined);
    const other = otherId === undefined ? undefined : tasksById.get(otherId);
    if (!other) return [];
    const freeFloat = freeFloatKnown ? state.cpmResult?.sequenceFreeFloat[seq.id] : undefined;
    return [{
      id: other.id,
      freeFloat: freeFloat ?? Infinity,
      totalFloat: other.time?.totalFloat ?? Infinity,
      wbs: other.wbsCode,
    }];
  });
  candidates.sort((a, b) => (a.freeFloat - b.freeFloat)
    || (a.totalFloat - b.totalFloat)
    || a.wbs.localeCompare(b.wbs, undefined, { numeric: true }));
  return candidates[0]?.id ?? null;
}
