import { current, isDraft } from 'immer';
import type { Task } from '@/types/task';
import type { AppStoreContext } from './appStore';
import type { Snapshot } from './snapshot';
import { sameValue } from '@/utils/sameValue';
import { changesOnlyDateNeutralFields } from './taskDateChanges';
import { planningInputOf } from './failedSolveGate';

interface Gate { snapshot: Snapshot; expected: Map<string, Task> }
const gates = new WeakMap<AppStoreContext, Gate>();
export function beginRecordedDateEdit(context: AppStoreContext, snapshot: Snapshot): void {
  gates.set(context, { snapshot, expected: new Map(snapshot.tasks.map(t => [t.id, t])) });
}
export function endRecordedDateEdit(context: AppStoreContext): void { gates.delete(context); }

/** Classificeer vóór de brug. Een eerder planningsverschil mag nooit in de overlay verdwijnen. */
export function recordedDateRuleChange(context: AppStoreContext, task: Task, requestedNeutral: boolean, apply: () => void): void {
  const gate = gates.get(context);
  const expected = gate?.expected.get(task.id);
  const before = isDraft(task) ? current(task) : task;
  const connected = expected && requestedNeutral && changesOnlyDateNeutralFields(expected, before);
  apply();
  const after = isDraft(task) ? current(task) : task;
  if (!connected || before.time.durationUnit !== after.time.durationUnit) return;
  const accepted: Task = { ...expected };
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof Task>) {
    if (!sameValue(before[key], after[key])) Object.assign(accepted, { [key]: after[key] });
  }
  gate!.expected.set(task.id, accepted);
}

/** Eén eindtoets voor de transactie én een leesstap midden in een batch. */
export function keepsRecordedDates(context: AppStoreContext): boolean {
  const gate = gates.get(context);
  const state = context.store.getState();
  if (!gate?.snapshot.datesAsRecorded || !state.datesAsRecorded) return false;
  const before = gate.snapshot;
  if (before.tasks.length !== state.tasks.length) return false;
  if (!state.tasks.every((task, i) => before.tasks[i].id === task.id
    && changesOnlyDateNeutralFields(gate.expected.get(task.id)!, task))) return false;
  const { tasks: _oldTasks, ...oldInput } = planningInputOf(before);
  const { tasks: _newTasks, ...newInput } = planningInputOf(state);
  return sameValue(oldInput, newInput);
}
