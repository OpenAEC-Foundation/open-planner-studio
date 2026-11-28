import type { WorkRule } from '@/types/workRule';

export interface TriangleAssignment {
  id: string;
  unitsPerDay: number;
  remainingWorkMinutes?: number;
  drivesDuration: boolean;
}

export interface TriangleState {
  rule: WorkRule;
  effortDriven?: boolean;
  remainingMinutes: number;
  slotMinutes: number;
  assignments: readonly TriangleAssignment[];
}

export type TriangleRejection =
  | 'invalid-duration'
  | 'invalid-units'
  | 'invalid-work'
  | 'unknown-assignment'
  | 'duplicate-assignment';

export type TriangleResult =
  | { ok: true; state: TriangleState }
  | { ok: false; reason: TriangleRejection };

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

export function ruleProtectsWork(rule: WorkRule): boolean {
  return rule === 'FIXED_WORK' || rule === 'FIXED_DURATION_WORK';
}

export function durationEditKeepsWork(rule: WorkRule, effortDriven?: boolean): boolean {
  return ruleProtectsWork(rule) && !(rule === 'FIXED_DURATION_WORK' && effortDriven === true);
}

export function ruleProtectsDuration(rule: WorkRule): boolean {
  return rule === 'FIXED_DURATION_RATE' || rule === 'FIXED_DURATION_WORK';
}

export function remainingWorkOf(a: TriangleAssignment, remainingMinutes: number): number {
  return a.remainingWorkMinutes ?? remainingMinutes * a.unitsPerDay;
}

function validated(state: TriangleState): TriangleResult {
  if (!isPositive(state.remainingMinutes)) return { ok: false, reason: 'invalid-duration' };
  for (const a of state.assignments) {
    if (!isPositive(a.unitsPerDay)) return { ok: false, reason: 'invalid-units' };
    if (a.remainingWorkMinutes !== undefined && !(Number.isFinite(a.remainingWorkMinutes) && a.remainingWorkMinutes >= 0)) {
      return { ok: false, reason: 'invalid-work' };
    }
  }
  return { ok: true, state };
}

export function assignmentRemainingMinutes(a: TriangleAssignment, remainingMinutes: number): number | null {
  if (!a.drivesDuration || !isPositive(a.unitsPerDay)) return null;
  return remainingWorkOf(a, remainingMinutes) / a.unitsPerDay;
}

function derivedRemaining(state: TriangleState, assignments: readonly TriangleAssignment[]): number {
  let max = 0;
  let any = false;
  for (const a of assignments) {
    const own = assignmentRemainingMinutes(a, state.remainingMinutes);
    if (own === null) continue;
    any = true;
    max = Math.max(max, own);
  }
  if (!any) return state.remainingMinutes;
  return max;
}

function followRule(
  state: TriangleState,
  assignments: readonly TriangleAssignment[],
  newRemaining: number,
  edited: ReadonlySet<string>,
): TriangleAssignment[] {
  const protectsWork = ruleProtectsWork(state.rule);
  return assignments.map((a) => {
    if (!a.drivesDuration || edited.has(a.id)) return a;
    if (protectsWork) {
      const w = remainingWorkOf(a, state.remainingMinutes);
      if (w <= 0) return { ...a, remainingWorkMinutes: w };
      return { ...a, remainingWorkMinutes: w, unitsPerDay: w / newRemaining };
    }
    if (Math.abs(newRemaining - state.remainingMinutes) <= 1e-6 || a.remainingWorkMinutes === undefined) return a;
    return { ...a, remainingWorkMinutes: newRemaining * a.unitsPerDay };
  });
}

function splitByUnits(assignments: readonly TriangleAssignment[], totalWork: number): TriangleAssignment[] {
  const driving = assignments.filter((a) => a.drivesDuration && isPositive(a.unitsPerDay));
  const sumUnits = driving.reduce((s, a) => s + a.unitsPerDay, 0);
  if (sumUnits <= 0) return [...assignments];
  return assignments.map((a) => (a.drivesDuration && isPositive(a.unitsPerDay)
    ? { ...a, remainingWorkMinutes: totalWork * (a.unitsPerDay / sumUnits) }
    : a));
}

function totalRemainingWork(state: TriangleState, assignments: readonly TriangleAssignment[]): number {
  return assignments.reduce((s, a) => (a.drivesDuration && isPositive(a.unitsPerDay)
    ? s + remainingWorkOf(a, state.remainingMinutes)
    : s), 0);
}

const drivingCount = (assignments: readonly TriangleAssignment[]): number =>
  assignments.filter((a) => a.drivesDuration).length;

export function applyDurationEdit(state: TriangleState, newRemainingMinutes: number): TriangleResult {
  if (!isPositive(newRemainingMinutes)) return { ok: false, reason: 'invalid-duration' };
  const R = newRemainingMinutes;
  const keepWork = durationEditKeepsWork(state.rule, state.effortDriven);
  const assignments = state.assignments.map((a) => {
    if (!a.drivesDuration) return a;
    if (keepWork) {
      const w = remainingWorkOf(a, state.remainingMinutes);
      if (w <= 0) return { ...a, remainingWorkMinutes: w };
      return { ...a, remainingWorkMinutes: w, unitsPerDay: w / R };
    }
    if (a.remainingWorkMinutes === undefined) return a;
    return { ...a, remainingWorkMinutes: R * a.unitsPerDay };
  });
  return validated({ ...state, remainingMinutes: R, assignments });
}

export function applyUnitsEdit(state: TriangleState, assignmentId: string, newUnitsPerDay: number): TriangleResult {
  if (!isPositive(newUnitsPerDay)) return { ok: false, reason: 'invalid-units' };
  const idx = state.assignments.findIndex((a) => a.id === assignmentId);
  if (idx < 0) return { ok: false, reason: 'unknown-assignment' };
  const target = state.assignments[idx];
  if (!target.drivesDuration || ruleProtectsDuration(state.rule)) {
    const writeWork = target.drivesDuration && (ruleProtectsWork(state.rule) || target.remainingWorkMinutes !== undefined);
    const edited: TriangleAssignment = {
      ...target,
      unitsPerDay: newUnitsPerDay,
      ...(writeWork ? { remainingWorkMinutes: state.remainingMinutes * newUnitsPerDay } : {}),
    };
    return validated({ ...state, assignments: replaceAt(state.assignments, idx, edited) });
  }
  const workBefore = remainingWorkOf(target, state.remainingMinutes);
  const edited: TriangleAssignment = { ...target, unitsPerDay: newUnitsPerDay, remainingWorkMinutes: workBefore };
  const withEdit = replaceAt(state.assignments, idx, edited);
  const R = derivedRemaining(state, withEdit);
  const assignments = followRule(state, withEdit, R, new Set([assignmentId]));
  return validated({ ...state, remainingMinutes: R, assignments });
}

export function applyWorkEdit(state: TriangleState, assignmentId: string, newWorkMinutes: number): TriangleResult {
  if (!isPositive(newWorkMinutes)) return { ok: false, reason: 'invalid-work' };
  const idx = state.assignments.findIndex((a) => a.id === assignmentId);
  if (idx < 0) return { ok: false, reason: 'unknown-assignment' };
  const target = state.assignments[idx];
  if (!target.drivesDuration) {
    return validated({ ...state, assignments: replaceAt(state.assignments, idx, { ...target, remainingWorkMinutes: newWorkMinutes }) });
  }
  if (ruleProtectsDuration(state.rule)) {
    const edited: TriangleAssignment = { ...target, remainingWorkMinutes: newWorkMinutes, unitsPerDay: newWorkMinutes / state.remainingMinutes };
    return validated({ ...state, assignments: replaceAt(state.assignments, idx, edited) });
  }
  const withEdit = replaceAt(state.assignments, idx, { ...target, remainingWorkMinutes: newWorkMinutes });
  const R = derivedRemaining(state, withEdit);
  const assignments = followRule(state, withEdit, R, new Set([assignmentId]));
  return validated({ ...state, remainingMinutes: R, assignments });
}

export function applyTaskWorkEdit(state: TriangleState, newTotalWorkMinutes: number): TriangleResult {
  if (!isPositive(newTotalWorkMinutes)) return { ok: false, reason: 'invalid-work' };
  if (drivingCount(state.assignments) === 0) return { ok: true, state };
  const oldTotal = totalRemainingWork(state, state.assignments);
  const split: TriangleAssignment[] = oldTotal > 0
    ? state.assignments.map((a) => (a.drivesDuration
      ? { ...a, remainingWorkMinutes: newTotalWorkMinutes * (remainingWorkOf(a, state.remainingMinutes) / oldTotal) }
      : a))
    : splitByUnits(state.assignments, newTotalWorkMinutes);
  if (ruleProtectsDuration(state.rule)) {
    const assignments = split.map((a) => (a.drivesDuration && a.remainingWorkMinutes !== undefined && a.remainingWorkMinutes > 0
      ? { ...a, unitsPerDay: a.remainingWorkMinutes / state.remainingMinutes }
      : a));
    return validated({ ...state, assignments });
  }
  const R = derivedRemaining(state, split);
  return validated({ ...state, remainingMinutes: R, assignments: split });
}

export function applyAssignmentAdded(
  state: TriangleState,
  added: { id: string; unitsPerDay: number; drivesDuration?: boolean },
): TriangleResult {
  if (!isPositive(added.unitsPerDay)) return { ok: false, reason: 'invalid-units' };
  if (state.assignments.some((a) => a.id === added.id)) return { ok: false, reason: 'duplicate-assignment' };
  const newcomer: TriangleAssignment = { id: added.id, unitsPerDay: added.unitsPerDay, drivesDuration: added.drivesDuration ?? true };
  const plain = validated({ ...state, assignments: [...state.assignments, newcomer] });
  if (!newcomer.drivesDuration || drivingCount(state.assignments) === 0) return plain;
  if (state.rule === 'FIXED_DURATION_RATE') return plain;
  if (state.rule === 'FIXED_RATE' && state.effortDriven === false) return plain;
  const total = totalRemainingWork(state, state.assignments);
  const split = splitByUnits([...state.assignments, newcomer], total);
  if (state.rule === 'FIXED_DURATION_WORK') {
    const assignments = split.map((a) => (a.drivesDuration && a.remainingWorkMinutes !== undefined && a.remainingWorkMinutes > 0
      ? { ...a, unitsPerDay: a.remainingWorkMinutes / state.remainingMinutes }
      : a));
    return validated({ ...state, assignments });
  }
  const R = derivedRemaining(state, split);
  return validated({ ...state, remainingMinutes: R, assignments: split });
}

export function applyAssignmentRemoved(state: TriangleState, assignmentId: string): TriangleResult {
  const idx = state.assignments.findIndex((a) => a.id === assignmentId);
  if (idx < 0) return { ok: false, reason: 'unknown-assignment' };
  const removed = state.assignments[idx];
  const rest = state.assignments.filter((a) => a.id !== assignmentId);
  const plain = validated({ ...state, assignments: rest });
  if (!removed.drivesDuration || drivingCount(rest) === 0) return plain;
  if (state.rule === 'FIXED_DURATION_RATE') return plain;
  if (state.rule === 'FIXED_RATE' && state.effortDriven === false) return plain;
  const total = totalRemainingWork(state, state.assignments);
  const split = splitByUnits(rest, total);
  if (state.rule === 'FIXED_DURATION_WORK') {
    const assignments = split.map((a) => (a.drivesDuration && a.remainingWorkMinutes !== undefined && a.remainingWorkMinutes > 0
      ? { ...a, unitsPerDay: a.remainingWorkMinutes / state.remainingMinutes }
      : a));
    return validated({ ...state, assignments });
  }
  const R = derivedRemaining(state, split);
  return validated({ ...state, remainingMinutes: R, assignments: split });
}

export function applyRuleChange(state: TriangleState, rule: WorkRule): TriangleResult {
  const assignments = ruleProtectsWork(rule)
    ? state.assignments.map((a) => (a.drivesDuration && a.remainingWorkMinutes === undefined
      ? { ...a, remainingWorkMinutes: remainingWorkOf(a, state.remainingMinutes) }
      : a))
    : [...state.assignments];
  return validated({ ...state, rule, assignments });
}

export function applySlotChange(state: TriangleState, newSlotMinutes: number, newRemainingMinutes: number): TriangleResult {
  if (!isPositive(newSlotMinutes)) return { ok: false, reason: 'invalid-duration' };
  if (!isPositive(newRemainingMinutes)) return { ok: false, reason: 'invalid-duration' };
  const anchored: TriangleAssignment[] = state.assignments.map((a) => (a.drivesDuration
    ? { ...a, remainingWorkMinutes: remainingWorkOf(a, state.remainingMinutes) }
    : a));
  const next: TriangleState = { ...state, slotMinutes: newSlotMinutes, remainingMinutes: newRemainingMinutes };
  if (state.rule === 'FIXED_DURATION_RATE') {
    const assignments = state.assignments.map((a) => (a.drivesDuration && a.remainingWorkMinutes !== undefined
      ? { ...a, remainingWorkMinutes: newRemainingMinutes * a.unitsPerDay }
      : a));
    return validated({ ...next, assignments });
  }
  if (state.rule === 'FIXED_DURATION_WORK') {
    const assignments = anchored.map((a) => (a.drivesDuration && a.remainingWorkMinutes !== undefined && a.remainingWorkMinutes > 0
      ? { ...a, unitsPerDay: a.remainingWorkMinutes / newRemainingMinutes }
      : a));
    return validated({ ...next, assignments });
  }
  const R = derivedRemaining(next, anchored);
  return validated({ ...next, remainingMinutes: R, assignments: anchored });
}

function replaceAt(list: readonly TriangleAssignment[], idx: number, item: TriangleAssignment): TriangleAssignment[] {
  const out = [...list];
  out[idx] = item;
  return out;
}
