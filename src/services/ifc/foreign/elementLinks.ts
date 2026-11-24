import { IFC_BUILDING_MODEL_TYPES } from '../ifcBuildingModelTypes';
import { ifcObjectSeed } from '../ifcWriter';
import { splitStepArgs, type StepIndex } from './stepScanner';

export type ElementLinkDirection = 'input' | 'output';

export interface ElementLink {
  readonly direction: ElementLinkDirection;
  readonly target: string;
  readonly found: boolean;
}

export interface StepElementLink extends ElementLink {
  readonly taskStepId: number;
}

export type TaskElementLinks = ReadonlyMap<string, readonly ElementLink[]>;

const RELATED_OBJECTS_ARG = 4;
const RELATING_ARG = 6;
const TASK_SEED_PREFIX = ifcObjectSeed('task', '');

function stepRefs(token: string | undefined): string[] {
  const value = (token ?? '').trim();
  const items = value.startsWith('(') && value.endsWith(')') ? splitStepArgs(value.slice(1, -1)) : [value];
  return items.flatMap(item => /^#(\d+)$/.exec(item)?.[1] ?? []);
}

function taskStepId(index: StepIndex, id: string | undefined): number | undefined {
  if (id === undefined) return undefined;
  const chunk = index.chunkOf(id);
  return chunk >= 0 && index.type(chunk) === 'IFCTASK' ? Number(id) : undefined;
}

function elementTarget(index: StepIndex, id: string | undefined): Omit<ElementLink, 'direction'> | undefined {
  if (id === undefined) return undefined;
  const chunk = index.chunkOf(id);
  if (chunk < 0) return { target: `#${id}`, found: false };
  if (!IFC_BUILDING_MODEL_TYPES.has(index.type(chunk))) return undefined;
  return { target: index.globalId(chunk) || `#${id}`, found: true };
}

export function scanElementLinks(index: StepIndex): StepElementLink[] {
  const links: StepElementLink[] = [];
  for (let i = 0; i < index.count; i++) {
    const type = index.type(i);
    if (type !== 'IFCRELASSIGNSTOPROCESS' && type !== 'IFCRELASSIGNSTOPRODUCT') continue;
    const args = index.argTokens(i);
    if (!args) continue;
    const related = stepRefs(args[RELATED_OBJECTS_ARG]);
    const relating = stepRefs(args[RELATING_ARG])[0];
    if (type === 'IFCRELASSIGNSTOPROCESS') {
      const task = taskStepId(index, relating);
      if (task === undefined) continue;
      for (const id of related) {
        const target = elementTarget(index, id);
        if (target) links.push({ taskStepId: task, direction: 'input', ...target });
      }
    } else {
      const target = elementTarget(index, relating);
      if (!target) continue;
      for (const id of related) {
        const task = taskStepId(index, id);
        if (task !== undefined) links.push({ taskStepId: task, direction: 'output', ...target });
      }
    }
  }
  return links;
}

export function elementLinksByTask(links: readonly StepElementLink[], stepIds: Readonly<Record<string, number>>): TaskElementLinks {
  const taskIdByStepId = new Map<number, string>();
  for (const [seed, stepId] of Object.entries(stepIds)) {
    if (seed.startsWith(TASK_SEED_PREFIX)) taskIdByStepId.set(stepId, seed.slice(TASK_SEED_PREFIX.length));
  }
  const byTask = new Map<string, ElementLink[]>();
  const seen = new Set<string>();
  for (const { taskStepId: stepId, direction, target, found } of links) {
    const taskId = taskIdByStepId.get(stepId);
    if (taskId === undefined) continue;
    const key = `${stepId}:${direction}:${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = byTask.get(taskId);
    if (list) list.push({ direction, target, found });
    else byTask.set(taskId, [{ direction, target, found }]);
  }
  return byTask;
}
