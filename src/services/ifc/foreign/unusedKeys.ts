import type { UnusedAssignmentKey } from '../assignmentKeys';
import { ifcObjectSeed } from '../ifcWriter';
import type { IfcSource, UnusedKeysOfTask } from './ifcSource';
import type { StepIndex } from './stepScanner';

export function unusedKeysFromRead(read: ReadonlyMap<string, readonly string[]>): readonly UnusedKeysOfTask[] | undefined {
  const keys = [...read].map(([task, properties]) => ({ taskStepId: Number(task), propertyStepIds: properties.map(Number) }));
  return keys.length > 0 ? keys : undefined;
}

function property(index: StepIndex, stepId: number): UnusedAssignmentKey {
  const chunk = index.chunkOf(String(stepId));
  if (chunk < 0) throw new Error(`unusedKeys: #${stepId} staat niet in de bron`);
  return { name: index.name(chunk) ?? '', value: index.argTokens(chunk)?.[2] ?? '$' };
}

function byTaskStepId(keys: readonly UnusedKeysOfTask[] | undefined): ReadonlyMap<number, readonly number[]> {
  return new Map((keys ?? []).map(k => [k.taskStepId, k.propertyStepIds]));
}

export function unusedKeysForWriter(source: IfcSource, index: StepIndex): ReadonlyMap<string, readonly UnusedAssignmentKey[]> {
  const byTask = byTaskStepId(source.unusedKeys);
  const out = new Map<string, readonly UnusedAssignmentKey[]>();
  if (byTask.size === 0) return out;
  const taskSeed = ifcObjectSeed('task', '');
  for (const [seed, stepId] of Object.entries(source.stepIds)) {
    const properties = seed.startsWith(taskSeed) ? byTask.get(stepId) : undefined;
    if (properties) out.set(seed.slice(taskSeed.length), properties.map(id => property(index, id)));
  }
  return out;
}

export function unusedKeysProblem(
  source: IfcSource, sourceIndex: StepIndex, taskIds: readonly string[],
  written: readonly UnusedKeysOfTask[] | undefined, outputIndex: StepIndex, outputStepIds: Readonly<Record<string, number>>,
): string | undefined {
  const before = byTaskStepId(source.unusedKeys), after = byTaskStepId(written);
  const values = (byTask: ReadonlyMap<number, readonly number[]>, index: StepIndex, stepId: number | undefined) =>
    (stepId === undefined ? [] : byTask.get(stepId) ?? []).map(id => property(index, id).value);
  for (const id of taskIds) {
    const seed = ifcObjectSeed('task', id);
    const expected = values(before, sourceIndex, source.stepIds[seed]);
    const actual = values(after, outputIndex, outputStepIds[seed]);
    if (expected.join('\u0000') !== actual.join('\u0000')) {
      return `taak ${id}: de ongebruikte sleutels in OPS_Assignments zijn in de uitvoer [${actual.join(', ')}], in de bron [${expected.join(', ')}]`;
    }
  }
  return undefined;
}
