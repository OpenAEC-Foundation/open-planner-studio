import { hasOwnOrigin } from '@/services/ifc/foreign/classify';
import type { ForeignChange } from '@/services/ifc/foreign/changeList';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { PSET } from '@/services/ifc/ifcPsets';
import { refsOutsideText } from '@/services/ifc/foreign/lossCheck';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { mappedChunks } from '@/services/ifc/foreign/sourceSlots';
import type { StepIndex } from '@/services/ifc/foreign/stepScanner';
import { relationRoles, slotTableNamed } from '@/services/ifc/ifcSlotTables';
import type { Domain } from './ifcMergeKern';

export interface ReferenceGraph {
  readonly index: StepIndex;
  readonly targets: readonly (readonly (readonly number[])[])[];
  readonly referrers: readonly (readonly (readonly [number, number, number])[])[];
  readonly dangling: readonly string[];
}

export interface EditScope {
  readonly removed: ReadonlySet<number>;
  readonly edges: ReadonlySet<string>;
  readonly added: ReadonlySet<string>;
  readonly released: ReadonlySet<string>;
}

const GUID = /^'[0-9A-Za-z_$]{22}'$/;
const PROCESS = 'IFCRELASSIGNSTOPROCESS';
const slotOf = (table: string, key: string) => slotTableNamed(table)!.slots.findIndex(s => s.key === key);
const TASK_TIME = slotOf('IfcTask', 'taskTime');
const TIME_LAG = slotOf('IfcRelSequence', 'timeLag');
const CALENDAR = slotTableNamed('IfcWorkCalendar')!;
const WORK_WEEK = ['workDays', 'workStartHour', 'workEndHour', 'hoursPerDay', 'simpleBreakStartMinute', 'simpleBreakDurationMinutes',
  'workTime', 'ifcTimePeriods', 'workingExceptions'] as const;
const edgeKey = (r: number, k: number, t: number) => `${r}.${k}>${t}`;

export function referenceGraph(bytes: Uint8Array): ReferenceGraph {
  const index = scanForeignStep(bytes);
  const referrers: [number, number, number][][] = Array.from({ length: index.count }, () => []);
  const dangling: string[] = [];
  const targets = Array.from({ length: index.count }, (_, c) => (!index.isEntity(c) ? [] : (index.argTokens(c) ?? []).map((token, k) =>
    refsOutsideText(token).map((id, at) => {
      const t = index.chunkOf(String(id));
      if (t < 0) dangling.push(`${index.type(c)} #${index.id(c)}.${k} wijst naar #${id}, dat er niet is`);
      else referrers[t].push([c, k, at]);
      return t;
    }))));
  return { index, targets, referrers, dangling };
}

function identities(self: ReferenceGraph, other: ReferenceGraph): (c: number) => string {
  const memo = new Map<number, string>();
  const key = (c: number): string => {
    const known = memo.get(c);
    if (known !== undefined) return known;
    const { index } = self;
    const id = index.id(c), type = index.type(c);
    const first = index.argTokens(c)?.[0]?.trim();
    let result: string;
    if (first && GUID.test(first)) result = first;
    else {
      const o = other.index.chunkOf(id);
      if (o >= 0 && other.index.type(o) === type) result = `#${Number(id)}`;
      else {
        memo.set(c, `?${type}#${id}`);
        const parents = self.referrers[c].map(([r, k, at]) => `${key(r)}.${k}.${at}`).sort();
        result = parents.length > 0 ? `${type}<${parents[0]}` : `?${type}#${id}`;
      }
    }
    memo.set(c, result);
    return result;
  };
  return key;
}

function ownOrigin(graph: ReferenceGraph): (c: number) => boolean {
  const { index } = graph;
  const memo = new Map<number, boolean>();
  const own = (c: number): boolean => {
    const known = memo.get(c);
    if (known !== undefined) return known;
    memo.set(c, false);
    let result: boolean;
    const second = index.refAt(c, 1);
    if (index.type(c) === 'IFCOWNERHISTORY') result = second >= 0 && index.application(second)?.identifier === 'OPS';
    else if (second >= 0 && index.type(second) === 'IFCOWNERHISTORY') result = hasOwnOrigin(index, c);
    else result = graph.referrers[c].length > 0 && graph.referrers[c].every(([r]) => own(r));
    memo.set(c, result);
    return result;
  };
  return own;
}

export function keptOrCarried(source: IfcSource, graph: ReferenceGraph): number[] {
  const chunks = new Set<number>();
  for (let c = 0; c < graph.index.count; c++) if (graph.index.isEntity(c) && source.classes[c] !== 1) chunks.add(c);
  for (const [c] of mappedChunks(graph.index, source.sourceSlots ?? new Map())) chunks.add(c);
  const own = ownOrigin(graph);
  return [...chunks].filter(c => !own(c)).sort((a, b) => a - b);
}

function relationsOf(graph: ReferenceGraph, type: string, relating: number): [number, number][] {
  const roles = relationRoles(type)!;
  const found: [number, number][] = [];
  for (let c = 0; c < graph.index.count; c++) {
    if (graph.index.isEntity(c) && graph.index.type(c) === type && graph.targets[c][roles.relating]?.includes(relating)) found.push([c, roles.related]);
  }
  return found;
}
const holding = (graph: ReferenceGraph, type: string, relating: number, member: number) =>
  relationsOf(graph, type, relating).filter(([c, k]) => graph.targets[c][k].includes(member));

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const lagOf = (q: Domain['sequences'][number]) => Object.fromEntries(Object.entries(q).filter(([k]) => k.startsWith('lag')).sort());

export function editScope(graph: ReferenceGraph, source: IfcSource, before: Domain, after: Domain, changes: readonly ForeignChange[] = []): EditScope {
  const step = (key: string) => {
    const id = source.stepIds[key];
    return id === undefined ? -1 : graph.index.chunkOf(String(id));
  };
  const removed = new Set<number>(), edges = new Set<string>(), added = new Set<string>(), released = new Set<string>();
  const was = new Map(before.tasks.map(t => [t.id, t]));
  type Holder = readonly [string, number] | undefined;
  const moved = (from: Holder, to: Holder, member: number) => {
    if (from?.[0] === to?.[0] && from?.[1] === to?.[1]) return;
    if (member >= 0 && from && from[1] >= 0) for (const [c, k] of holding(graph, from[0], from[1], member)) edges.add(edgeKey(c, k, member));
    if (to && to[1] >= 0) for (const [c, k] of relationsOf(graph, to[0], to[1])) added.add(member >= 0 ? edgeKey(c, k, member) : `${c}.${k}>+`);
  };
  const parentOf = (d: Domain, t: Domain['tasks'][number]): Holder => ['IFCRELNESTS', step(t.parentId === null ? `ws:${d.project.id}` : `task:${t.parentId}`)];
  const calendarOf = (d: Domain, t: Domain['tasks'][number]): Holder => ['IFCRELASSIGNSTOCONTROL', step(`cal:${t.calendarId ?? d.calendar.id}`)];
  for (const t of after.tasks) {
    const c = step(`task:${t.id}`), old = was.get(t.id);
    if (old && c < 0) continue;
    moved(old && parentOf(before, old), parentOf(after, t), c);
    moved(old && calendarOf(before, old), calendarOf(after, t), c);
  }
  const tasks = new Map(after.tasks.map(t => [t.id, t]));
  for (const t of before.tasks) {
    const c = step(`task:${t.id}`);
    if (c < 0) continue;
    const now = tasks.get(t.id);
    if (!now) removed.add(c);
    else if (!sameJson(now.time, t.time)) released.add(`${c}.${TASK_TIME}`);
  }
  const sequences = new Map(after.sequences.map(q => [q.id, q]));
  for (const q of before.sequences) {
    const c = step(`seq:${q.id}`);
    if (c < 0) continue;
    const now = sequences.get(q.id);
    if (!now) removed.add(c);
    else if (!sameJson(lagOf(now), lagOf(q))) released.add(`${c}.${TIME_LAG}`);
  }
  const calendarsOf = (d: Domain) => new Map([d.calendar, ...(d.resourceCalendars ?? [])].map(k => [k.id, k]));
  const calendars = calendarsOf(after);
  for (const [id, k] of calendarsOf(before)) {
    const c = step(`cal:${id}`), now = calendars.get(id);
    if (c < 0 || !now) continue;
    const at = CALENDAR.positions(graph.index.argTokens(c) ?? []);
    if (!sameJson(k.holidays, now.holidays)) released.add(`${c}.${at.exceptionTimes}`);
    if (WORK_WEEK.some(f => !sameJson(k[f], now[f]))) released.add(`${c}.${at.workingTimes}`);
  }
  const kept = new Set(after.assignments.map(a => a.id));
  const assigned = new Set(after.assignments.map(a => a.taskId));
  const defines = relationRoles('IFCRELDEFINESBYPROPERTIES')!;
  for (const id of new Set(before.assignments.map(a => a.taskId))) {
    const task = step(`task:${id}`);
    if (assigned.has(id) || task < 0) continue;
    for (const [c, k] of graph.referrers[task]) {
      const set = graph.index.type(c) === 'IFCRELDEFINESBYPROPERTIES' && k === defines.related ? graph.targets[c][defines.relating][0] : -1;
      if (set >= 0 && graph.index.argTokens(set)?.[2]?.trim() === `'${PSET.Assignments}'`) edges.add(edgeKey(c, k, task));
    }
  }
  for (const a of before.assignments) {
    if (kept.has(a.id)) continue;
    const task = step(`task:${a.taskId}`), resource = step(`res:${a.resourceId}`);
    if (task < 0 || resource < 0) continue;
    const relations = holding(graph, PROCESS, task, resource);
    if (relations.length === 1) edges.add(edgeKey(relations[0][0], relations[0][1], resource));
  }
  for (const change of changes) {
    const c = change.kind === 'vervallen' ? graph.index.chunkOf(String(change.id)) : -1;
    if (c >= 0) removed.add(c);
  }
  return { removed, edges, added, released };
}

export const NOTHING: EditScope = { removed: new Set(), edges: new Set(), added: new Set(), released: new Set() };

function mayVanish(graph: ReferenceGraph, scope: EditScope): { gone: (r: number, k: number, t: number) => boolean; vanish: ReadonlySet<number> } {
  const vanish = new Set(scope.removed);
  const gone = (r: number, k: number, t: number) => vanish.has(r) || vanish.has(t) || scope.edges.has(edgeKey(r, k, t)) || scope.released.has(`${r}.${k}`);
  for (let changed = true; changed;) {
    changed = false;
    for (let n = 0; n < graph.index.count; n++) {
      if (!graph.index.isEntity(n) || vanish.has(n)) continue;
      const incoming = graph.referrers[n];
      let orphan = incoming.length > 0 && incoming.every(([r, k]) => gone(r, k, n));
      const roles = relationRoles(graph.index.type(n));
      if (!orphan && roles) {
        const relating = graph.targets[n][roles.relating] ?? [];
        const related = graph.targets[n][roles.related] ?? [];
        orphan = relating.some(t => t >= 0 && gone(n, roles.relating, t)) || (related.length > 0 && related.every(t => t >= 0 && gone(n, roles.related, t)));
      }
      if (orphan) { vanish.add(n); changed = true; }
    }
  }
  return { gone, vanish };
}

export function regelC(source: IfcSource, graph: ReferenceGraph, out: ReferenceGraph, scope: EditScope = NOTHING,
  checked: readonly number[] = keptOrCarried(source, graph)): string[] {
  const sk = identities(graph, out), ok = identities(out, graph);
  const label = (g: ReferenceGraph, c: number) => (c < 0 ? 'een ontbrekend stuk' : `${g.index.type(c)} #${g.index.id(c)}`);
  const byKey = new Map<string, number[]>();
  for (let c = 0; c < out.index.count; c++) {
    if (!out.index.isEntity(c)) continue;
    const list = byKey.get(ok(c));
    if (list) list.push(c); else byKey.set(ok(c), [c]);
  }
  const sourceByKey = new Map<string, number>();
  for (let c = 0; c < graph.index.count; c++) if (graph.index.isEntity(c)) sourceByKey.set(sk(c), c);
  const { gone, vanish } = mayVanish(graph, scope);
  const touched = (x: number, k: number) => scope.released.has(`${x}.${k}`)
    || [...scope.edges, ...scope.added].some(e => e.startsWith(`${x}.${k}>`));
  const own = ownOrigin(graph);
  const problems = [...out.dangling];
  for (const x of checked) {
    const found = byKey.get(sk(x)) ?? [];
    if (found.length === 0) {
      if (!vanish.has(x)) problems.push(`${label(graph, x)} is verdwenen`);
      continue;
    }
    if (found.length > 1) problems.push(`${label(graph, x)} staat ${found.length} keer in de uitvoer`);
    const y = found[0];
    const inOut = new Set(out.referrers[y].map(([r, k]) => `${ok(r)}.${k}`));
    const inSource = new Set(graph.referrers[x].map(([r, k]) => `${sk(r)}.${k}`));
    const roleOf = (g: ReferenceGraph, key: (c: number) => string, r: number, k: number) => {
      const roles = relationRoles(g.index.type(r));
      const relating = roles && roles.relating !== k ? g.targets[r][roles.relating]?.[0] ?? -1 : -1;
      return `${g.index.type(r)}.${k}.${relating >= 0 ? key(relating) : ''}`;
    };
    const reissued = new Map<string, number>();
    for (const [r, k] of out.referrers[y]) {
      if (sourceByKey.has(ok(r))) continue;
      const role = roleOf(out, ok, r, k);
      reissued.set(role, (reissued.get(role) ?? 0) + 1);
    }
    for (const [r, k] of graph.referrers[x]) {
      if (inOut.has(`${sk(r)}.${k}`) || gone(r, k, x)) continue;
      const role = roleOf(graph, sk, r, k);
      if (own(r) && !byKey.has(sk(r)) && (reissued.get(role) ?? 0) > 0) { reissued.set(role, reissued.get(role)! - 1); continue; }
      problems.push(`${label(graph, x)} verliest verwijzer ${label(graph, r)} (slot ${k})`);
    }
    for (const [r, k] of out.referrers[y]) {
      const was = sourceByKey.get(ok(r));
      if (was === undefined || inSource.has(`${ok(r)}.${k}`) || scope.released.has(`${was}.${k}`) || scope.added.has(edgeKey(was, k, x))) continue;
      problems.push(`${label(graph, x)} krijgt verwijzer ${label(graph, was)} (slot ${k}) erbij`);
    }
    const toOut = new Set(out.targets[y].flatMap((ts, k) => ts.map(t => `${k}>${t < 0 ? '-' : ok(t)}`)));
    const toSource = new Set(graph.targets[x].flatMap((ts, k) => ts.map(t => `${k}>${t < 0 ? '-' : sk(t)}`)));
    graph.targets[x].forEach((ts, k) => ts.forEach(t => {
      if (t >= 0 && !toOut.has(`${k}>${sk(t)}`) && !gone(x, k, t)) problems.push(`${label(graph, x)} wijst in slot ${k} niet meer naar ${label(graph, t)}`);
    }));
    out.targets[y].forEach((ts, k) => ts.forEach(t => {
      if (t < 0 || toSource.has(`${k}>${ok(t)}`) || scope.released.has(`${x}.${k}`)) return;
      const target = sourceByKey.get(ok(t));
      if (target === undefined && (graph.targets[x][k]?.length ?? 0) === 0) return;
      if (!scope.added.has(target === undefined ? `${x}.${k}>+` : edgeKey(x, k, target))) problems.push(`${label(graph, x)} wijst in slot ${k} nu ook naar ${label(out, t)}`);
    }));
    graph.targets[x].forEach((ts, k) => {
      if (ts.length < 2 || touched(x, k)) return;
      const after = out.targets[y][k]?.filter(t => t >= 0).map(ok) ?? [];
      const common = new Set(after);
      const was = ts.filter(t => t >= 0).map(sk).filter(key => common.has(key));
      const kept = new Set(was);
      const now = after.filter(key => kept.has(key));
      if (was.join('\u0000') !== now.join('\u0000')) problems.push(`${label(graph, x)} heeft in slot ${k} een andere volgorde`);
    });
  }
  return problems;
}

export function regelCOf(sourceBytes: Uint8Array, source: IfcSource, out: Uint8Array, before?: Domain, after?: Domain,
  changes: readonly ForeignChange[] = []): string[] {
  const graph = referenceGraph(sourceBytes);
  return regelC(source, graph, referenceGraph(out), before && after ? editScope(graph, source, before, after, changes) : NOTHING);
}
