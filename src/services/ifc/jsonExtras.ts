import { ifcStr } from './ifcPsets';
import { decodeStepText } from './stepText';
import { jsonPropertyShape, WINDOWS_PROPERTY, type JsonShape } from './jsonRegister';
import { jsonSlice, parseJsonTree, type JsonMemberNode, type JsonNode } from './jsonTokens';

export type JsonStep =
  | { readonly sleutel: string }
  | { readonly veld: string; readonly waarde: string }
  | { readonly venster: string }
  | { readonly toewijzing: string };

export interface JsonExtraMember {
  readonly key: string;
  readonly value: string;
}

export interface JsonExtrasObject {
  readonly path: readonly JsonStep[];
  readonly members: readonly JsonExtraMember[];
}

export interface JsonExtras {
  readonly owner: string;
  readonly pset: string;
  readonly property: string;
  readonly objects: readonly JsonExtrasObject[];
}

export interface WriterAssignment {
  readonly id: string;
  readonly taskId: string;
  readonly resourceId: string;
}

export const WINDOW_KEY = /^(.+)#(\d+)$/;
const has = (keys: object, key: string) => Object.prototype.hasOwnProperty.call(keys, key);

type ObjectNode = Extract<JsonNode, { kind: 'object' }>;

function uniqueKeys(node: ObjectNode): boolean {
  return new Set(node.members.map(m => m.key)).size === node.members.length;
}

function fieldValue(item: JsonNode, field: string): string | undefined {
  if (item.kind !== 'object') return undefined;
  const member = item.members.filter(m => m.key === field);
  return member.length === 1 && member[0].value.kind === 'string' ? member[0].value.value : undefined;
}

function itemsByField(node: Extract<JsonNode, { kind: 'array' }>, field: string): Map<string, JsonNode> {
  const count = new Map<string, number>();
  for (const item of node.items) {
    const v = fieldValue(item, field);
    if (v !== undefined) count.set(v, (count.get(v) ?? 0) + 1);
  }
  const out = new Map<string, JsonNode>();
  for (const item of node.items) {
    const v = fieldValue(item, field);
    if (v !== undefined && count.get(v) === 1) out.set(v, item);
  }
  return out;
}

export function unknownJsonMembers(
  text: string, shape: JsonShape, windowKnown: (key: string) => boolean,
): JsonExtrasObject[] | undefined {
  const root = parseJsonTree(text);
  if (!root) return undefined;
  const found: JsonExtrasObject[] = [];
  const raw = (m: JsonMemberNode): JsonExtraMember => ({ key: text.slice(m.keyStart, m.keyEnd), value: jsonSlice(text, m.value) });
  const walk = (node: JsonNode, at: JsonShape, path: readonly JsonStep[]): void => {
    if (at.soort === 'object' && node.kind === 'object' && uniqueKeys(node)) {
      const extra = node.members.filter(m => !has(at.sleutels, m.key));
      if (extra.length > 0) found.push({ path, members: extra.map(raw) });
      for (const m of node.members) if (has(at.sleutels, m.key)) walk(m.value, at.sleutels[m.key], [...path, { sleutel: m.key }]);
    } else if (at.soort === 'lijst' && node.kind === 'array' && at.identiteit !== 'herkomstmerk') {
      const veld = at.identiteit.veld;
      for (const [waarde, item] of itemsByField(node, veld)) walk(item, at.item, [...path, { veld, waarde }]);
    } else if (at.soort === 'kaart' && node.kind === 'object' && uniqueKeys(node)) {
      if (at.identiteit === 'sleutel') {
        for (const m of node.members) walk(m.value, at.waarde, [...path, { sleutel: m.key }]);
        return;
      }
      const extra = node.members.filter(m => !WINDOW_KEY.test(m.key));
      if (extra.length > 0) found.push({ path, members: extra.map(raw) });
      for (const m of node.members) if (WINDOW_KEY.test(m.key) && windowKnown(m.key)) walk(m.value, at.waarde, [...path, { venster: m.key }]);
    }
  };
  walk(root, shape, []);
  return found;
}

interface Target {
  readonly node: ObjectNode;
  readonly members: JsonExtraMember[];
}

interface Created {
  readonly key: string;
  readonly members: JsonExtraMember[];
}

function decodedKey(raw: string): string {
  return JSON.parse(raw) as string;
}

function sameAsParsed(written: string, raw: string): boolean {
  return JSON.stringify(JSON.parse(raw)) === written;
}

export function withJsonMembers(
  text: string, objects: readonly JsonExtrasObject[], keyOfAssignment: (assignmentId: string) => string | undefined,
): string {
  const root = parseJsonTree(text);
  if (!root) return text;
  const targets = new Map<JsonNode, Target>();
  const created = new Map<JsonNode, Created[]>();
  const touched = new Set<JsonNode>();
  for (const object of objects) {
    let node: JsonNode | undefined = root;
    const trail: JsonNode[] = [root];
    let create: { parent: ObjectNode; key: string } | undefined;
    for (const [k, step] of object.path.entries()) {
      if (!node) break;
      if ('veld' in step) {
        node = node.kind === 'array' ? itemsByField(node, step.veld).get(step.waarde) : undefined;
      } else if ('venster' in step) {
        node = undefined;
      } else {
        const key = 'sleutel' in step ? step.sleutel : keyOfAssignment(step.toewijzing);
        const parent: JsonNode = node;
        const hits = key === undefined || parent.kind !== 'object' ? [] : parent.members.filter(m => m.key === key);
        node = hits.length === 1 ? hits[0].value : undefined;
        if (hits.length === 0 && key !== undefined && parent.kind === 'object' && 'toewijzing' in step && k === object.path.length - 1) {
          create = { parent, key };
        }
      }
      if (node) trail.push(node);
    }
    if (create) {
      const list = created.get(create.parent) ?? [];
      const existing = list.find(c => c.key === create!.key);
      if (existing) existing.members.push(...object.members);
      else list.push({ key: create.key, members: [...object.members] });
      created.set(create.parent, list);
      for (const t of trail) touched.add(t);
      continue;
    }
    if (!node || node.kind !== 'object' || !uniqueKeys(node)) continue;
    const target = targets.get(node) ?? { node, members: [] };
    target.members.push(...object.members);
    targets.set(node, target);
    for (const t of trail) touched.add(t);
  }
  if (targets.size === 0 && created.size === 0) return text;
  const member = (key: string, value: string) => `${key}:${value}`;
  const render = (node: JsonNode): string => {
    if (!touched.has(node)) return jsonSlice(text, node);
    if (node.kind === 'array') return `[${node.items.map(render).join(',')}]`;
    if (node.kind !== 'object') return jsonSlice(text, node);
    const extra = targets.get(node)?.members ?? [];
    const byKey = new Map(extra.map(m => [decodedKey(m.key), m]));
    const parts = node.members.map(m => {
      const raw = byKey.get(m.key);
      if (!raw) return member(text.slice(m.keyStart, m.keyEnd), render(m.value));
      byKey.delete(m.key);
      return member(text.slice(m.keyStart, m.keyEnd), sameAsParsed(jsonSlice(text, m.value), raw.value) ? raw.value : render(m.value));
    });
    for (const m of extra) if (byKey.get(decodedKey(m.key)) === m) parts.push(member(m.key, m.value));
    for (const c of created.get(node) ?? []) parts.push(member(JSON.stringify(c.key), `{${c.members.map(m => member(m.key, m.value)).join(',')}}`));
    return `{${parts.join(',')}}`;
  };
  return render(root);
}

const LINE = /^#(\d+)=([A-Z0-9_]+)\(([\s\S]*)\);$/;
const REL_TAIL = /,\(([^()]*)\),#(\d+)$/;
const PSET_HEAD = /^'(?:[^']|'')*',(?:\$|#\d+),'((?:[^']|'')*)',(?:\$|'(?:[^']|'')*'),\(([^()]*)\)$/;
const TEXT_VALUE = /^'((?:[^']|'')*)',\$,IFCTEXT\('((?:[^']|'')*)'\),\$$/;
const PROPERTY_NAME = /^'((?:[^']|'')*)',/;

const stepString = (body: string) => decodeStepText(body.replace(/''/g, "'"));
const refs = (list: string) => list.split(',').map(r => Number(r.trim().slice(1))).filter(Number.isFinite);
const placeKey = (owner: string, pset: string) => `${owner}\u0000${pset}`;

function rehomedWindows(extras: readonly JsonExtras[], assignments: ReadonlyMap<string, WriterAssignment>): JsonExtras[] {
  const out: JsonExtras[] = [];
  const moved = new Map<string, JsonExtrasObject[]>();
  for (const e of extras) {
    if (`${e.pset}\u0000${e.property}` !== WINDOWS_PROPERTY) { out.push(e); continue; }
    const stay: JsonExtrasObject[] = [];
    for (const o of e.objects) {
      const step = o.path[0];
      if (!step || !('toewijzing' in step)) { stay.push(o); continue; }
      const assignment = assignments.get(step.toewijzing);
      if (!assignment) continue;
      const owner = `task_${assignment.taskId}`;
      moved.set(owner, [...(moved.get(owner) ?? []), o]);
    }
    if (stay.length > 0) out.push({ ...e, objects: stay });
  }
  const [pset, property] = WINDOWS_PROPERTY.split('\u0000');
  for (const [owner, objects] of moved) out.push({ owner, pset, property, objects });
  return out;
}

export function withJsonExtras(
  lines: string[], idMap: ReadonlyMap<string, number>, assignments: readonly WriterAssignment[],
  extras: readonly JsonExtras[],
): string[] {
  if (extras.length === 0) return lines;
  const byAssignment = new Map(assignments.map(a => [a.id, a]));
  const placed = new Map<string, JsonExtras[]>();
  for (const e of rehomedWindows(extras, byAssignment)) placed.set(placeKey(e.owner, e.pset), [...(placed.get(placeKey(e.owner, e.pset)) ?? []), e]);
  const out = [...lines];
  const at = new Map<number, number>();
  out.forEach((line, k) => { const m = /^#(\d+)=/.exec(line); if (m) at.set(Number(m[1]), k); });
  const ownerOf = new Map<number, string>();
  for (const e of placed.values()) {
    const id = idMap.get(e[0].owner);
    if (id !== undefined) ownerOf.set(id, e[0].owner);
  }
  const lineOf = (id: number) => { const k = at.get(id); return k === undefined ? undefined : LINE.exec(out[k]) ?? undefined; };
  const keyOfAssignment = (assignmentId: string): string | undefined => {
    const a = byAssignment.get(assignmentId);
    const line = a ? lineOf(idMap.get(`_asgn_${a.taskId}_${a.id}`) ?? -1) : undefined;
    const named = line ? PROPERTY_NAME.exec(line[3]) : null;
    return named ? stepString(named[1]) : undefined;
  };
  for (const line of lines) {
    if (!line.includes('=IFCRELDEFINESBYPROPERTIES(')) continue;
    const rel = LINE.exec(line);
    const tail = rel ? REL_TAIL.exec(rel[3]) : null;
    if (!tail) continue;
    const related = refs(tail[1]);
    const owner = related.length === 1 ? ownerOf.get(related[0]) : undefined;
    if (owner === undefined) continue;
    const pset = lineOf(Number(tail[2]));
    const head = pset && pset[2] === 'IFCPROPERTYSET' ? PSET_HEAD.exec(pset[3]) : null;
    if (!head) continue;
    const psetName = stepString(head[1]);
    const wanted = placed.get(placeKey(owner, psetName));
    if (!wanted) continue;
    for (const propId of refs(head[2])) {
      const k = at.get(propId);
      const prop = k === undefined ? null : LINE.exec(out[k]);
      const value = prop && prop[2] === 'IFCPROPERTYSINGLEVALUE' ? TEXT_VALUE.exec(prop[3]) : null;
      if (!value) continue;
      const name = stepString(value[1]);
      const these = wanted.filter(e => e.property === name);
      if (these.length === 0 || !jsonPropertyShape(psetName, name)) continue;
      const json = stepString(value[2]);
      const next = withJsonMembers(json, these.flatMap(e => e.objects), keyOfAssignment);
      if (next === json) continue;
      out[k!] = `#${prop![1]}=IFCPROPERTYSINGLEVALUE('${value[1]}',$,IFCTEXT(${ifcStr(next)}),$);`;
    }
  }
  return out;
}
