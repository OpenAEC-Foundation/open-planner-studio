import { isAssignmentKeyName, unusedAssignmentKeyNames, type UnusedAssignmentKey } from '../assignmentKeys';
import { PSET } from '../ifcPsets';
import { ifcObjectSeed } from '../ifcWriter';
import type { ForeignChange } from './changeList';
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

function assignmentMembers(index: StepIndex, taskStepId: number | undefined): number[] {
  const task = taskStepId === undefined ? -1 : index.chunkOf(String(taskStepId));
  const members: number[] = [];
  if (task < 0) return members;
  for (let k = index.inStart(task); k < index.inEnd(task); k++) {
    const rel = index.inSource(k);
    if (rel < 0 || index.inArg(k) !== 4 || index.type(rel) !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const pset = index.refAt(rel, 5);
    if (pset < 0 || index.type(pset) !== 'IFCPROPERTYSET' || index.name(pset) !== PSET.Assignments) continue;
    for (const member of index.refsAt(pset, 4)) members.push(member);
  }
  return members;
}

const isOwnKey = (index: StepIndex, member: number) =>
  index.type(member) === 'IFCPROPERTYSINGLEVALUE' && isAssignmentKeyName(index.name(member) ?? '');

const foreignNamesOf = (index: StepIndex, taskStepId: number | undefined) =>
  assignmentMembers(index, taskStepId).filter(m => !isOwnKey(index, m)).map(m => index.name(m) ?? '');

function tasksWithUnusedKeys(source: IfcSource): [taskId: string, taskStepId: number, propertyStepIds: readonly number[]][] {
  const byTask = byTaskStepId(source.unusedKeys);
  if (byTask.size === 0) return [];
  const taskSeed = ifcObjectSeed('task', '');
  return Object.entries(source.stepIds).flatMap(([seed, stepId]) => {
    const properties = seed.startsWith(taskSeed) ? byTask.get(stepId) : undefined;
    return properties ? [[seed.slice(taskSeed.length), stepId, properties] as [string, number, readonly number[]]] : [];
  });
}

export function unusedKeysForWriter(source: IfcSource, index: StepIndex): ReadonlyMap<string, readonly UnusedAssignmentKey[]> {
  return new Map(tasksWithUnusedKeys(source).map(([taskId, , properties]) => [taskId, properties.map(id => property(index, id))]));
}

export function foreignAssignmentKeyNamesForWriter(source: IfcSource, index: StepIndex): ReadonlyMap<string, readonly string[]> {
  return new Map(tasksWithUnusedKeys(source).map(([taskId, taskStepId]) => [taskId, foreignNamesOf(index, taskStepId)]));
}

export function unusedKeysProblem(
  source: IfcSource, sourceIndex: StepIndex, taskIds: readonly string[],
  written: readonly UnusedKeysOfTask[] | undefined, outputIndex: StepIndex, outputStepIds: Readonly<Record<string, number>>,
): string | undefined {
  const before = byTaskStepId(source.unusedKeys), after = byTaskStepId(written);
  for (const id of taskIds) {
    const seed = ifcObjectSeed('task', id);
    const sourceStep = source.stepIds[seed], outputStep = outputStepIds[seed];
    const expected = (sourceStep === undefined ? [] : before.get(sourceStep) ?? []).map(p => property(sourceIndex, p));
    const actualIds = outputStep === undefined ? [] : after.get(outputStep) ?? [];
    const unusedChunks = new Set(actualIds.map(p => outputIndex.chunkOf(String(p))));
    const ownNames = assignmentMembers(outputIndex, outputStep)
      .filter(m => isOwnKey(outputIndex, m) && !unusedChunks.has(m)).map(m => outputIndex.name(m) ?? '');
    const names = unusedAssignmentKeyNames(ownNames, expected.map(k => k.name), foreignNamesOf(outputIndex, outputStep));
    const want = expected.map((k, i) => `${names[i]}=${k.value}`);
    const got = actualIds.map(p => property(outputIndex, p)).map(k => `${k.name}=${k.value}`);
    if (want.join('\u0000') !== got.join('\u0000')) {
      return `taak ${id}: de ongebruikte sleutels in OPS_Assignments zijn in de uitvoer [${got.join(', ')}], verwacht [${want.join(', ')}]`;
    }
  }
  return undefined;
}

export function duplicateAssignmentKeyProblem(
  source: IfcSource, sourceIndex: StepIndex, taskIds: readonly string[], outputIndex: StepIndex, outputStepIds: Readonly<Record<string, number>>,
): string | undefined {
  const namesOf = (index: StepIndex, taskStepId: number | undefined) => {
    const count = new Map<string, number>();
    for (const m of assignmentMembers(index, taskStepId)) count.set(index.name(m) ?? '', (count.get(index.name(m) ?? '') ?? 0) + 1);
    return count;
  };
  for (const id of taskIds) {
    const seed = ifcObjectSeed('task', id);
    const before = namesOf(sourceIndex, source.stepIds[seed]);
    for (const [name, times] of namesOf(outputIndex, outputStepIds[seed])) {
      if (times > 1 && times > (before.get(name) ?? 0)) {
        return `taak ${id}: dubbele naam ${name} in OPS_Assignments (${times} keer, in de bron ${before.get(name) ?? 0} keer); een pset met twee properties met dezelfde naam is ongeldige IFC`;
      }
    }
  }
  return undefined;
}

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, k) => byte === b[k]);

export function droppedUnusedKeysProblem(
  source: IfcSource, sourceIndex: StepIndex, changes: readonly ForeignChange[], outputIndex: StepIndex,
): string | undefined {
  const listed = new Map<number, ForeignChange>();
  for (const change of changes) if (change.kind === 'vervallen' && change.unusedKeyOfTask !== undefined) listed.set(change.id, change);
  for (const { taskStepId, propertyStepIds } of source.unusedKeys ?? []) {
    const taskGone = outputIndex.chunkOf(String(taskStepId)) < 0;
    for (const id of propertyStepIds) {
      const change = listed.get(id);
      listed.delete(id);
      if (!taskGone && change) return `taak #${taskStepId} bestaat nog, maar haar ongebruikte sleutel #${id} staat als vervallen op de wijzigingslijst`;
      if (!taskGone) continue;
      if (change?.kind !== 'vervallen' || change.unusedKeyOfTask !== taskStepId) {
        return `taak #${taskStepId} is verwijderd, maar haar ongebruikte sleutel #${id} staat niet als vervallen op de wijzigingslijst`;
      }
      const chunk = sourceIndex.chunkOf(String(id));
      if (chunk < 0 || !sameBytes(change.oldBytes, source.bytes.subarray(sourceIndex.start(chunk), sourceIndex.end(chunk)))) {
        return `de oude bytes van de ongebruikte sleutel #${id} op de wijzigingslijst zijn niet die van de bron`;
      }
    }
  }
  const unknown = [...listed.keys()][0];
  return unknown === undefined ? undefined : `#${unknown} staat als ongebruikte sleutel op de wijzigingslijst, maar de bron kent die sleutel niet`;
}
