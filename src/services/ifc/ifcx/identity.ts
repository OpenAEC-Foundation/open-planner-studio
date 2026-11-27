import { ifcObjectSeed, type IfcObjectKind, type WriteIFCInput } from '../ifcWriter';
import type { WorkCalendar } from '@/types/calendar';
import { defaultGlobalId } from './stepGlobalIds';

export type PlanningModel = Pick<WriteIFCInput,
  | 'project' | 'calendar' | 'tasks' | 'sequences' | 'resourceCalendars' | 'ifcGlobalIds' | 'timeModel' | 'importPristine'
  | 'ifcLiteralCalendarIds' | 'minuteModelPending' | 'recordedFields' | 'activityCodeTypes' | 'customFieldDefs' | 'customTaskTypes'
  | 'recordedSourceFormat' | 'resources' | 'assignments' | 'baselines' | 'activeBaselineId' | 'comparedBaselineIds' | 'baselineOrphanGuids'>;

export interface IdentityReference {
  readonly field: string;
  readonly kind: IfcObjectKind;
  readonly id: string;
}

export interface IdentityObject {
  readonly id: string;
  readonly references: readonly IdentityReference[];
}

export interface IdentityKind {
  readonly kind: IfcObjectKind;
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
  { kind: 'task', area: 'task', objects: model => model.tasks.map(task => ({ id: task.id, references: [] })) },
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
  { kind: 'res', area: 'resource', objects: model => (model.resources ?? []).map(resource => ({ id: resource.id, references: [] })) },
  {
    kind: 'asgn', area: 'assignment',
    objects: model => (model.assignments ?? []).map(assignment => ({
      id: assignment.id,
      references: [
        { field: 'taskId', kind: 'task' as const, id: assignment.taskId },
        { field: 'resourceId', kind: 'res' as const, id: assignment.resourceId },
      ],
    })),
  },
  { kind: 'bl', area: 'baseline', objects: model => (model.baselines ?? []).map(baseline => ({ id: baseline.id, references: [] })) },
];

export type GlobalIdOfObject = (kind: IfcObjectKind, id: string) => string;

export function intendedGlobalIds(model: PlanningModel): Map<string, string> {
  const out = new Map<string, string>();
  for (const spec of IDENTITY_KINDS) {
    for (const object of spec.objects(model)) {
      const seed = ifcObjectSeed(spec.kind, object.id);
      if (!out.has(seed)) out.set(seed, model.ifcGlobalIds?.[seed] || defaultGlobalId(spec.kind, object.id, model.project.id));
    }
  }
  return out;
}

export function identityProblems(model: PlanningModel, globalIdOf: GlobalIdOfObject): IdentityProblem[] {
  const problems: IdentityProblem[] = [];
  const libraryIds = new Set<string>();
  for (const calendar of model.resourceCalendars ?? []) {
    if (libraryIds.has(calendar.id)) problems.push({ field: 'calendar.id', detail: `Twee kalenders in de bibliotheek hebben het id ${calendar.id}` });
    libraryIds.add(calendar.id);
  }
  const idsByKind = new Map<IfcObjectKind, Set<string>>();
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
  const owners = new Map<string, { readonly spec: IdentityKind; readonly id: string }>();
  for (const [spec, objects] of objectsByKind) {
    for (const object of objects) {
      const globalId = globalIdOf(spec.kind, object.id);
      const owner = owners.get(globalId);
      if (owner !== undefined && (owner.spec.area !== spec.area || owner.id !== object.id)) {
        problems.push({
          field: `${spec.area}.globalId`,
          detail: `${spec.area} ${object.id} heeft dezelfde GlobalId ${globalId} als ${owner.spec.area} ${owner.id}`,
        });
      }
      owners.set(globalId, { spec, id: object.id });
      for (const reference of object.references) {
        if (!idsByKind.get(reference.kind)?.has(reference.id)) {
          problems.push({ field: `${spec.area}.${reference.field}`, detail: `${spec.area} ${object.id} verwijst met ${reference.field} naar ${reference.id}, dat niet bestaat` });
        }
      }
    }
  }
  const parentOf = new Map<string, string>();
  const tasks = idsByKind.get('task')!;
  for (const task of model.tasks) {
    for (const child of new Set(task.childIds ?? [])) {
      if (!tasks.has(child)) continue;
      const first = parentOf.get(child);
      if (first === undefined) parentOf.set(child, task.id);
      else problems.push({ field: 'task.childIds', detail: `Taak ${child} staat in de kinderlijst van twee ouders: ${first} en ${task.id}` });
    }
  }
  return problems;
}
