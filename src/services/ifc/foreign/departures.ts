import { relationRoles } from '../ifcSlotTables';
import type { WriteIFCInput } from '../ifcWriter';
import { planningIdentities, planningIdentityInput } from './planningIdentity';
import type { StepIndex } from './stepScanner';

export interface PlanningChange {
  readonly stepIds: Readonly<Record<string, number>>;
  readonly before: WriteIFCInput;
  readonly after: WriteIFCInput;
}

export type Departure = { readonly leave: ReadonlySet<number> } | { readonly unknown: string };

const NOTHING: Departure = { leave: new Set() };
const NESTS = 'IFCRELNESTS', PROCESS = 'IFCRELASSIGNSTOPROCESS', CONTROL = 'IFCRELASSIGNSTOCONTROL';
const STRUCTURAL: ReadonlySet<string> = new Set([NESTS, 'IFCRELAGGREGATES', CONTROL, PROCESS, 'IFCRELDECLARES']);

interface DomainObject { readonly kind: string; readonly id: string }

function planningView(input: WriteIFCInput) {
  const d = planningIdentityInput(input);
  const tasks = new Map(d.tasks.map(t => [t.id, t])), resources = new Map(d.resources.map(r => [r.id, r]));
  const assigned = new Map<string, string[]>();
  for (const a of d.assignments) {
    const list = assigned.get(a.taskId);
    if (list) list.push(a.resourceId); else assigned.set(a.taskId, [a.resourceId]);
  }
  const has = (o: DomainObject) => (o.kind === 'task' ? tasks.has(o.id) : o.kind === 'res' ? resources.has(o.id) : true);
  return {
    has,
    parent: (o: DomainObject) => (o.kind === 'task' ? tasks.get(o.id)?.parentId : resources.get(o.id)?.parentId) ?? null,
    children: (id: string) => tasks.get(id)?.childIds ?? [],
    assigned: (id: string) => assigned.get(id) ?? [],
    calendar: (o: DomainObject) => (o.kind === 'task' ? tasks.get(o.id)?.calendarId : resources.get(o.id)?.calendarId) ?? d.calendar.id,
  };
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function keptTail(order: readonly string[], stay: readonly string[]): ReadonlySet<string> {
  const at = new Map(stay.map((id, k) => [id, k]));
  const kept = new Set<string>();
  let last = Infinity;
  for (let i = order.length - 1; i >= 0; i--) {
    const k = at.get(order[i]);
    if (k === undefined || k >= last) break;
    kept.add(order[i]);
    last = k;
  }
  return kept;
}

export function departuresOf(index: StepIndex, inD: ArrayLike<number>, planning: PlanningChange | undefined): (relation: number) => Departure {
  if (!planning) return () => NOTHING;
  const ids = planningIdentities(planning.before);
  const objects = new Map<number, DomainObject>();
  for (const [seed, stepId] of Object.entries(planning.stepIds)) {
    if (objects.has(stepId)) continue;
    const at = seed.indexOf(':'), kind = seed.slice(0, at), raw = seed.slice(at + 1);
    objects.set(stepId, { kind, id: kind === 'res' ? ids.resource.get(raw) ?? raw : kind === 'cal' ? ids.calendar.get(raw) ?? raw : raw });
  }
  const was = planningView(planning.before), now = planningView(planning.after);
  const objectOf = (chunk: number) => objects.get(Number(index.id(chunk)));
  const leave = (chunks: readonly number[]): Departure => ({ leave: new Set(chunks.map(c => Number(index.id(c)))) });
  return relation => {
    const type = index.type(relation);
    const roles = relationRoles(type);
    if (!roles || !STRUCTURAL.has(type)) return NOTHING;
    const members = index.refsAt(relation, roles.related).filter(m => inD[m] === 1);
    const present = members.map(objectOf).filter((o): o is DomainObject => o !== undefined && now.has(o));
    if (present.length === 0) return NOTHING;
    const relating = index.refAt(relation, roles.relating);
    const byObject = new Map(members.map(m => [objectOf(m), m]));
    const chunksOf = (list: readonly DomainObject[]) => list.map(o => byObject.get(o)!);
    const parentChanged = (o: DomainObject) => (o.kind === 'task' || o.kind === 'res') && was.parent(o) !== now.parent(o);
    if (relating < 0 || inD[relating] !== 1) return type === NESTS ? leave(chunksOf(present.filter(parentChanged))) : NOTHING;
    const owner = objectOf(relating), relatingType = index.type(relating);
    if (type === NESTS && relatingType === 'IFCTASK' && owner?.kind === 'task') {
      if (present.some(o => o.kind !== 'task')) return { unknown: 'een D-lid is geen taak van de planning' };
      if (same(was.children(owner.id), now.children(owner.id))) return NOTHING;
      const moved = present.filter(o => now.parent(o) !== owner.id), stay = present.filter(o => !moved.includes(o));
      const kept = keptTail(now.children(owner.id), stay.map(o => o.id));
      return leave(chunksOf([...moved, ...stay.filter(o => !kept.has(o.id))]));
    }
    if (type === NESTS && relatingType === 'IFCWORKSCHEDULE') return leave(chunksOf(present.filter(o => o.kind === 'task' && parentChanged(o))));
    if ((type === 'IFCRELAGGREGATES' && relatingType === 'IFCWORKPLAN') || (type === CONTROL && relatingType === 'IFCWORKSCHEDULE')) return NOTHING;
    if (type === CONTROL && relatingType === 'IFCWORKCALENDAR' && owner?.kind === 'cal') {
      return leave(chunksOf(present.filter(o => (o.kind === 'task' || o.kind === 'res') && was.calendar(o) !== now.calendar(o))));
    }
    if (type === PROCESS && relatingType === 'IFCTASK' && owner?.kind === 'task') {
      if (present.some(o => o.kind !== 'res')) return { unknown: 'een D-lid is geen resource van de planning' };
      if (same(was.assigned(owner.id), now.assigned(owner.id))) return NOTHING;
      const resources = present.map(o => o.id);
      if (new Set(resources).size !== resources.length) return { unknown: 'dezelfde resource staat meer dan eens in de relatie' };
      const count = (list: readonly string[], id: string) => list.filter(x => x === id).length;
      const moved = present.filter(o => count(was.assigned(owner.id), o.id) !== count(now.assigned(owner.id), o.id));
      const stay = present.filter(o => !moved.includes(o));
      if (stay.some(o => count(now.assigned(owner.id), o.id) !== 1)) return { unknown: 'een resource staat bij deze taak in meer dan één toewijzing' };
      const kept = keptTail(now.assigned(owner.id), stay.map(o => o.id));
      return leave(chunksOf([...moved, ...stay.filter(o => !kept.has(o.id))]));
    }
    return { unknown: `deze vorm kan pas in fase 2 (relating ${relatingType})` };
  };
}
