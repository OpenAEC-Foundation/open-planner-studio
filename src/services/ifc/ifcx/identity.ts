import type { WriteIFCInput } from '../ifcWriter';
import type { WorkCalendar } from '@/types/calendar';
import { defaultGlobalId, globalIdKey, type IfcxObjectKind } from './stepGlobalIds';

export type PlanningModel = Pick<WriteIFCInput, 'project' | 'calendar' | 'tasks' | 'sequences' | 'resourceCalendars' | 'ifcGlobalIds'
  | 'resources' | 'assignments' | 'baselines' | 'activeBaselineId' | 'comparedBaselineIds'>;

type IdentityKindName = IfcxObjectKind | 'baselineTask';

export interface IdentityReference {
  readonly field: string;
  readonly kind: IdentityKindName;
  readonly id: string;
}

export interface IdentityObject {
  readonly id: string;
  readonly references: readonly IdentityReference[];
}

export interface IdentityKind {
  readonly kind: IdentityKindName;
  readonly globalIdKind?: IfcxObjectKind;
  readonly area: string;
  readonly objects: (model: PlanningModel) => readonly IdentityObject[];
}

export interface IdentityProblem {
  readonly field: string;
  readonly detail: string;
}

export function calendarsWithIdentity(model: PlanningModel): WorkCalendar[] {
  return [model.calendar, ...(model.resourceCalendars ?? []).filter(calendar => calendar.id !== model.calendar.id)];
}

export const IDENTITY_KINDS: readonly IdentityKind[] = [
  { kind: 'proj', area: 'project', objects: model => [{ id: model.project.id, references: [] }] },
  { kind: 'wp', area: 'workplan', objects: model => [{ id: model.project.id, references: [] }] },
  { kind: 'ws', area: 'schedule', objects: model => [{ id: model.project.id, references: [] }] },
  { kind: 'cal', area: 'calendar', objects: model => calendarsWithIdentity(model).map(calendar => ({ id: calendar.id, references: [] })) },
  {
    kind: 'task', area: 'task',
    objects: model => model.tasks.map(task => ({
      id: task.id,
      references: [
        ...(task.parentId !== null && task.parentId !== undefined ? [{ field: 'parentId', kind: 'task' as const, id: task.parentId }] : []),
        ...(task.childIds ?? []).map(id => ({ field: 'childIds', kind: 'task' as const, id })),
      ],
    })),
  },
  {
    kind: 'seq', area: 'sequence',
    objects: model => model.sequences.map(sequence => ({
      id: sequence.id,
      references: [
        { field: 'predecessorId', kind: 'task' as const, id: sequence.predecessorId },
        { field: 'successorId', kind: 'task' as const, id: sequence.successorId },
      ],
    })),
  },
  {
    kind: 'res', area: 'resource',
    objects: model => (model.resources ?? []).map(resource => ({
      id: resource.id,
      references: [
        ...(resource.parentId !== undefined ? [{ field: 'parentId', kind: 'res' as const, id: resource.parentId }] : []),
        ...(resource.calendarId !== undefined ? [{ field: 'calendarId', kind: 'cal' as const, id: resource.calendarId }] : []),
      ],
    })),
  },
  {
    kind: 'assignment', area: 'assignment',
    objects: model => (model.assignments ?? []).map(assignment => ({
      id: assignment.id,
      references: [
        { field: 'taskId', kind: 'task' as const, id: assignment.taskId },
        { field: 'resourceId', kind: 'res' as const, id: assignment.resourceId },
      ],
    })),
  },
  { kind: 'baseline', area: 'baseline', objects: model => (model.baselines ?? []).map(baseline => ({ id: baseline.id, references: [] })) },
  { kind: 'baselineTask', globalIdKind: 'task', area: 'baseline.tasks', objects: removedBaselineTasks },
];

function removedBaselineTasks(model: PlanningModel): IdentityObject[] {
  const live = new Set(model.tasks.map(task => task.id));
  const removed = new Set<string>();
  for (const baseline of model.baselines ?? []) for (const row of baseline.tasks) if (row.taskId && !live.has(row.taskId)) removed.add(row.taskId);
  return [...removed].map(id => ({ id, references: [] }));
}

const globalIdKindOf = (spec: IdentityKind): IfcxObjectKind => spec.globalIdKind ?? (spec.kind as IfcxObjectKind);

export type GlobalIdOfObject = (kind: IfcxObjectKind, id: string) => string;

export function intendedGlobalIds(model: PlanningModel): Map<string, string> {
  const out = new Map<string, string>();
  for (const spec of IDENTITY_KINDS) {
    for (const object of spec.objects(model)) {
      const kind = globalIdKindOf(spec);
      const seed = globalIdKey(kind, object.id);
      if (!out.has(seed)) out.set(seed, model.ifcGlobalIds?.[seed] ?? defaultGlobalId(kind, object.id, model.project.id));
    }
  }
  return out;
}

export function identityProblems(model: PlanningModel, globalIdOf: GlobalIdOfObject): IdentityProblem[] {
  const problems: IdentityProblem[] = [];
  const idsByKind = new Map<IdentityKindName, Set<string>>();
  const objectsByKind = new Map<IdentityKind, readonly IdentityObject[]>();
  for (const spec of IDENTITY_KINDS) {
    const objects = spec.objects(model);
    objectsByKind.set(spec, objects);
    const ids = new Set<string>();
    for (const object of objects) {
      if (ids.has(object.id)) problems.push({ field: `${spec.area}.id`, detail: `Twee objecten van de soort ${spec.area} hebben het id ${object.id}` });
      ids.add(object.id);
    }
    idsByKind.set(spec.kind, ids);
  }
  const owners = new Map<string, string>();
  for (const [spec, objects] of objectsByKind) {
    for (const object of objects) {
      const globalId = globalIdOf(globalIdKindOf(spec), object.id);
      const owner = owners.get(globalId);
      const self = `${spec.area} ${object.id}`;
      if (owner !== undefined && owner !== self) {
        problems.push({ field: `${spec.area}.globalId`, detail: `${self} heeft dezelfde GlobalId ${globalId} als ${owner}` });
      }
      owners.set(globalId, self);
      for (const reference of object.references) {
        if (!idsByKind.get(reference.kind)?.has(reference.id)) {
          problems.push({ field: `${spec.area}.${reference.field}`, detail: `${self} verwijst met ${reference.field} naar ${reference.id}, dat niet bestaat` });
        }
      }
    }
  }
  return problems;
}
