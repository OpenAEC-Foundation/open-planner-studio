import { ifcStr } from '../ifcPsets';
import { decodeStepText } from '../stepText';
import { jsonPropertyShape, WINDOWS_PROPERTY, type JsonMapIdentity, type JsonShape } from '../jsonRegister';
import { jsonSlice, parseJsonTree, sameNode, type JsonMemberNode, type JsonNode } from '../jsonTokens';
import type { ResourceAssignment } from '@/types/resource';

export const WINDOW_KEY = /^(.+)#(\d+)$/;

export type JsonPathStep = { readonly sleutel: string } | { readonly veld: string; readonly waarde: string };

export interface JsonSourceProperty {
  readonly owner: string;
  readonly pset: string;
  readonly property: string;
  readonly text: string;
  readonly windows: ReadonlyMap<string, string>;
}

export interface WriterLines {
  readonly lines: readonly string[];
  readonly idMap: ReadonlyMap<string, number>;
}

type Assignments = readonly Pick<ResourceAssignment, 'id' | 'taskId'>[];

export interface JsonMemberContext {
  readonly exists: (owner: string, pset: string, property: string, path: readonly JsonPathStep[]) => boolean | undefined;
  readonly assignments?: { readonly read: Assignments; readonly written: Assignments };
}

export interface JsonMembers {
  readonly read: readonly string[];
  readonly written: readonly string[];
  readonly expected: ReadonlyMap<string, string>;
  readonly carried: ReadonlySet<string>;
}

export const jsonPropertyKey = (owner: string, pset: string, property: string) => `${owner}\u0000${pset}\u0000${property}`;

class Refused extends Error {}
const refuse = (why: string): never => { throw new Refused(why); };

interface Side {
  readonly text: string;
  readonly node: JsonNode;
}

type ArrayNode = Extract<JsonNode, { kind: 'array' }>;

const has = (keys: object, key: string) => Object.prototype.hasOwnProperty.call(keys, key);
const slice = (side: Side) => jsonSlice(side.text, side.node);
const at = (side: Side, node: JsonNode): Side => ({ text: side.text, node });
const same = (a: Side, b: Side) => sameNode(a.text, a.node, b.text, b.node);
const pair = (side: Side, m: JsonMemberNode) => `${side.text.slice(m.keyStart, m.keyEnd)}:${jsonSlice(side.text, m.value)}`;
const EMPTY_OBJECT: Side = { text: '{}', node: { kind: 'object', start: 0, end: 2, members: [] } };
const EMPTY_ARRAY: Side = { text: '[]', node: { kind: 'array', start: 0, end: 2, items: [] } };

function byKey(side: Side, what: string): Map<string, JsonMemberNode> {
  if (side.node.kind !== 'object') return refuse(`${what}: geen object`);
  const out = new Map<string, JsonMemberNode>();
  for (const m of side.node.members) {
    if (out.has(m.key)) refuse(`${what}: sleutel ${JSON.stringify(m.key)} staat twee keer in één object`);
    out.set(m.key, m);
  }
  return out;
}

function byField(side: Side, field: string, what: string): Map<string, JsonNode> {
  if (side.node.kind !== 'array') return refuse(`${what}: geen lijst`);
  const out = new Map<string, JsonNode>();
  for (const item of (side.node as ArrayNode).items) {
    const hits = item.kind === 'object' ? item.members.filter(m => m.key === field) : [];
    const id = hits.length === 1 && hits[0].value.kind === 'string' ? hits[0].value.value : undefined;
    if (id === undefined || out.has(id)) refuse(`${what}: een item zonder eenduidig ${field}`);
    out.set(id!, item);
  }
  return out;
}

export type WindowIdentity = 'gebonden' | 'vrij';

export interface Member {
  readonly where: (path: readonly JsonPathStep[]) => boolean | undefined;
  readonly window: (key: string) => WindowIdentity | undefined;
}

function memberText(shape: JsonShape, s: Side | undefined, z: Side | undefined, w: Side | undefined,
  path: readonly JsonPathStep[], m: Member): string | undefined {
  if (!s) return w ? slice(w) : undefined;
  if (shape.soort === 'kaart' && shape.identiteit === 'toewijzing') {
    for (const sm of byKey(s, 'bron').values()) {
      if (WINDOW_KEY.test(sm.key) && m.window(sm.key) === undefined) refuse(`venster ${sm.key} staat niet aantoonbaar bij dezelfde toewijzing`);
    }
  }
  if (!w) return z ? undefined : slice(s);
  if (z && same(z, w)) return slice(s);
  switch (shape.soort) {
    case 'waarde':
      return slice(w);
    case 'reeks':
      return seriesText(s, z, w);
    case 'doorgegeven':
      return s.node.kind === 'object' && w.node.kind === 'object' ? objectText(undefined, s, z, w, path, m) : s.node.kind === 'array' ? refuse('een doorgegeven lijst veranderde') : slice(w);
    case 'object':
      return objectText(shape.sleutels, s, z, w, path, m);
    case 'lijst':
      return shape.identiteit === 'herkomstmerk' ? refuse('een lijst zonder sleutelveld veranderde (herkomstmerk, PR 5)') : listText(shape.identiteit.veld, shape.item, s, z, w, path, m);
    case 'kaart':
      return mapText(shape.identiteit, shape.waarde, s, z, w, path, m);
  }
}

function seriesText(s: Side, z: Side | undefined, w: Side): string {
  if (s.node.kind !== 'array' || w.node.kind !== 'array' || !z || z.node.kind !== 'array') return refuse('een reeks veranderde zonder vaste plaatsen');
  const si = s.node.items, zi = z.node.items, wi = w.node.items;
  if (si.length !== wi.length || zi.length !== wi.length) return refuse('een reeks kreeg een andere lengte');
  return `[${wi.map((item, k) => same(at(z, zi[k]), at(w, item)) ? jsonSlice(s.text, si[k]) : jsonSlice(w.text, item)).join(',')}]`;
}

function objectText(known: Readonly<Record<string, JsonShape>> | undefined, s: Side, z: Side | undefined, w: Side,
  path: readonly JsonPathStep[], m: Member): string {
  const sMembers = byKey(s, 'bron'), wMembers = byKey(w, 'writer'), zMembers = z ? byKey(z, 'lezing') : undefined;
  const parts: string[] = [];
  for (const sm of sMembers.values()) {
    const wm = wMembers.get(sm.key), zm = zMembers?.get(sm.key);
    const shape = known === undefined ? { soort: 'doorgegeven' as const } : has(known, sm.key) ? known[sm.key] : undefined;
    if (!shape) {
      if (!wm || same(at(s, sm.value), at(w, wm.value)) || (zm && same(at(z!, zm.value), at(w, wm.value)))) parts.push(pair(s, sm));
      else if (zm) parts.push(pair(w, wm));
      else refuse(`de planning draagt ${JSON.stringify(sm.key)} met een andere waarde dan de bron`);
      continue;
    }
    const here = [...path, { sleutel: sm.key }];
    if (!wm && zm && shape.soort !== 'waarde' && shape.soort !== 'reeks' && jsonSlice(s.text, sm.value) !== jsonSlice(z!.text, zm.value)
      && m.where(here) !== false) {
      refuse(`${JSON.stringify(sm.key)} staat niet meer in de uitvoer, maar droeg wat de writer niet schrijft`);
    }
    const value = memberText(shape, at(s, sm.value), zm && at(z!, zm.value), wm && at(w, wm.value), here, m);
    if (value !== undefined) parts.push(`${s.text.slice(sm.keyStart, sm.keyEnd)}:${value}`);
  }
  for (const wm of wMembers.values()) {
    if (sMembers.has(wm.key)) continue;
    const zm = zMembers?.get(wm.key);
    if (zm && same(at(z!, zm.value), at(w, wm.value))) continue;
    parts.push(pair(w, wm));
  }
  return `{${parts.join(',')}}`;
}

function listText(field: string, item: JsonShape, s: Side, z: Side | undefined, w: Side, path: readonly JsonPathStep[], m: Member): string {
  const sItems = byField(s, field, 'bron'), wItems = byField(w, field, 'writer'), zItems = z ? byField(z, field, 'lezing') : new Map<string, JsonNode>();
  const common = (from: Map<string, JsonNode>, other: Map<string, JsonNode>) => [...from.keys()].filter(id => other.has(id)).join('\u0000');
  const reordered = common(zItems, wItems) !== common(wItems, zItems);
  const gone = (id: string, si: JsonNode) => {
    const zi = zItems.get(id);
    if (!zi) return reordered ? refuse(`item ${id}: geen plaats in de nieuwe volgorde`) : false;
    if (jsonSlice(s.text, si) === jsonSlice(z!.text, zi)) return true;
    return m.where([...path, { veld: field, waarde: id }]) === false || refuse(`item ${id} staat niet meer in de uitvoer, maar bestaat nog in de planning`);
  };
  const merged = (id: string, wi: JsonNode) => {
    const si = sItems.get(id), zi = zItems.get(id);
    return memberText(item, si && at(s, si), zi && at(z!, zi), at(w, wi), [...path, { veld: field, waarde: id }], m) ?? jsonSlice(w.text, wi);
  };
  const parts: string[] = [];
  if (!reordered) {
    for (const [id, si] of sItems) {
      const wi = wItems.get(id);
      if (wi) parts.push(merged(id, wi));
      else if (!gone(id, si)) parts.push(jsonSlice(s.text, si));
    }
    for (const [id, wi] of wItems) {
      if (sItems.has(id)) continue;
      const zi = zItems.get(id);
      if (!zi || !same(at(z!, zi), at(w, wi))) parts.push(jsonSlice(w.text, wi));
    }
  } else {
    for (const [id, wi] of wItems) parts.push(merged(id, wi));
    for (const [id, si] of sItems) if (!wItems.has(id)) gone(id, si);
  }
  return `[${parts.join(',')}]`;
}

function mapText(identity: JsonMapIdentity, value: JsonShape, s: Side, z: Side | undefined, w: Side, path: readonly JsonPathStep[], m: Member): string {
  const sMembers = byKey(s, 'bron'), wMembers = byKey(w, 'writer'), zMembers = z ? byKey(z, 'lezing') : undefined;
  const parts: string[] = [];
  for (const sm of sMembers.values()) {
    const wm = wMembers.get(sm.key), zm = zMembers?.get(sm.key);
    if (identity === 'toewijzing' && (!WINDOW_KEY.test(sm.key) || m.window(sm.key) === 'vrij')) { parts.push(pair(s, sm)); continue; }
    if (identity === 'toewijzing' && !zm) refuse(`venster ${sm.key}: geen lezing`);
    if (!wm && zm && jsonSlice(s.text, sm.value) !== jsonSlice(z!.text, zm.value)) refuse(`sleutel ${JSON.stringify(sm.key)} viel weg, met een waarde die de writer anders schrijft`);
    const v = memberText(value, at(s, sm.value), zm && at(z!, zm.value), wm && at(w, wm.value), [...path, { sleutel: sm.key }], m);
    if (v !== undefined) parts.push(`${s.text.slice(sm.keyStart, sm.keyEnd)}:${v}`);
  }
  for (const wm of wMembers.values()) {
    if (sMembers.has(wm.key)) continue;
    const zm = zMembers?.get(wm.key);
    if (!zm || !same(at(z!, zm.value), at(w, wm.value))) parts.push(pair(w, wm));
  }
  return `{${parts.join(',')}}`;
}

const emptyOf = (shape: JsonShape): Side => shape.soort === 'lijst' ? EMPTY_ARRAY : EMPTY_OBJECT;
const isEmpty = (text: string | undefined) => text === undefined || text === '{}' || text === '[]';

function parsed(text: string | undefined): Side | undefined {
  if (text === undefined) return undefined;
  const node = parseJsonTree(text);
  return node ? { text, node } : refuse('geen geldige JSON');
}

const LINE = /^#(\d+)=([A-Z0-9_]+)\(([\s\S]*)\);$/;
const REL_TAIL = /,\(([^()]*)\),#(\d+)$/;
const PSET_HEAD = /^'(?:[^']|'')*',(?:\$|#\d+),'((?:[^']|'')*)',(?:\$|'(?:[^']|'')*'),\(([^()]*)\)$/;
const TEXT_VALUE = /^'((?:[^']|'')*)',\$,IFCTEXT\('((?:[^']|'')*)'\),\$$/;
const stepString = (body: string) => decodeStepText(body.replace(/''/g, "'"));
const refs = (list: string) => list.split(',').map(r => Number(r.trim().slice(1))).filter(Number.isFinite);

interface Located {
  readonly at: number;
  readonly id: string;
  readonly nameRaw: string;
  readonly text: string;
}

function lineIndex(written: WriterLines): Map<number, number> {
  const lineAt = new Map<number, number>();
  written.lines.forEach((line, k) => { const m = /^#(\d+)=/.exec(line); if (m) lineAt.set(Number(m[1]), k); });
  return lineAt;
}

const put = (lines: string[], loc: Located, text: string) => {
  lines[loc.at] = `#${loc.id}=IFCPROPERTYSINGLEVALUE('${loc.nameRaw}',$,IFCTEXT(${ifcStr(text)}),$);`;
};

function locate(written: WriterLines, lineAt: ReadonlyMap<number, number>, owners: ReadonlySet<string>): Map<string, Located> {
  const out = new Map<string, Located>();
  if (owners.size === 0) return out;
  const ownerOf = new Map<number, string>();
  for (const owner of owners) {
    const id = written.idMap.get(owner);
    if (id !== undefined) ownerOf.set(id, owner);
  }
  const parse = (id: number) => { const k = lineAt.get(id); return k === undefined ? undefined : LINE.exec(written.lines[k]) ?? undefined; };
  for (const line of written.lines) {
    if (!line.includes('=IFCRELDEFINESBYPROPERTIES(')) continue;
    const tail = REL_TAIL.exec(LINE.exec(line)?.[3] ?? '');
    const related = tail ? refs(tail[1]) : [];
    const owner = related.length === 1 ? ownerOf.get(related[0]) : undefined;
    if (owner === undefined) continue;
    const pset = parse(Number(tail![2]));
    const head = pset && pset[2] === 'IFCPROPERTYSET' ? PSET_HEAD.exec(pset[3]) : null;
    if (!head) continue;
    const psetName = stepString(head[1]);
    for (const propId of refs(head[2])) {
      const prop = parse(propId);
      const value = prop && prop[2] === 'IFCPROPERTYSINGLEVALUE' ? TEXT_VALUE.exec(prop[3]) : null;
      if (!value) continue;
      const name = stepString(value[1]);
      if (!jsonPropertyShape(psetName, name)) continue;
      out.set(jsonPropertyKey(owner, psetName, name), { at: lineAt.get(propId)!, id: prop![1], nameRaw: value[1], text: stepString(value[2]) });
    }
  }
  return out;
}

export function mergedJsonText(shape: JsonShape, source: string, read: string | undefined, written: string | undefined,
  member: Partial<Member> = {}): { readonly text: string | undefined } | { readonly refused: string } {
  const m: Member = { where: member.where ?? (() => undefined), window: member.window ?? (() => undefined) };
  try {
    return { text: memberText(shape, parsed(source), parsed(read), written === undefined ? emptyOf(shape) : parsed(written), [], m) };
  } catch (e) {
    if (e instanceof Refused) return { refused: e.message };
    throw e;
  }
}

const NAME = /^#\d+=IFCPROPERTYSINGLEVALUE\('((?:[^']|'')*)'/;

function assignmentKeys(written: WriterLines, at: ReadonlyMap<number, number>, assignments: Assignments, tasks: ReadonlySet<string>) {
  const byTask = new Map<string, Map<string, string>>();
  for (const a of assignments) {
    if (!tasks.has(a.taskId)) continue;
    const id = written.idMap.get(`_asgn_${a.taskId}_${a.id}`);
    const k = id === undefined ? undefined : at.get(id);
    const name = k === undefined ? undefined : NAME.exec(written.lines[k])?.[1];
    if (name === undefined) continue;
    const keys = byTask.get(a.taskId) ?? new Map<string, string>();
    byTask.set(a.taskId, keys.set(a.id, stepString(name)));
  }
  return byTask;
}

function windowIdentity(bound: ReadonlyMap<string, string>, before: ReadonlyMap<string, string> | undefined,
  now: ReadonlyMap<string, string> | undefined): (key: string) => WindowIdentity | undefined {
  const was = new Set(before?.values()), is = new Set(now?.values());
  return key => {
    const id = bound.get(key);
    if (id !== undefined) return now?.get(id) === key && was.has(key) ? 'gebonden' : undefined;
    return was.has(key) || is.has(key) ? undefined : 'vrij';
  };
}

export function withJsonTexts(written: WriterLines, sources: readonly JsonSourceProperty[]): string[] {
  const out = [...written.lines];
  const at = locate(written, lineIndex(written), new Set(sources.map(s => s.owner)));
  for (const s of sources) {
    const loc = at.get(jsonPropertyKey(s.owner, s.pset, s.property));
    if (loc) put(out, loc, s.text);
  }
  return out;
}

export function jsonMembers(read: WriterLines, written: WriterLines, sources: readonly JsonSourceProperty[],
  ctx: JsonMemberContext): JsonMembers {
  const expected = new Map<string, string>(), carried = new Set<string>();
  if (sources.length === 0) return { read: read.lines, written: written.lines, expected, carried };
  const readOut = [...read.lines], writtenOut = [...written.lines];
  const isWindows = (s: JsonSourceProperty) => `${s.pset}\u0000${s.property}` === WINDOWS_PROPERTY;
  const owners = new Set(sources.map(s => s.owner));
  const readAt = lineIndex(read), writtenAt = lineIndex(written);
  const reads = locate(read, readAt, owners), writes = locate(written, writtenAt, owners);
  const tasks = new Set(sources.filter(isWindows).map(s => s.owner.slice('task_'.length)));
  const keys0 = assignmentKeys(read, readAt, ctx.assignments?.read ?? [], tasks);
  const keys1 = assignmentKeys(written, writtenAt, ctx.assignments?.written ?? [], tasks);
  for (const s of sources) {
    const key = jsonPropertyKey(s.owner, s.pset, s.property);
    const r = reads.get(key), w = writes.get(key);
    if (!r) continue;
    const task = s.owner.slice('task_'.length);
    const window = isWindows(s) ? windowIdentity(s.windows, keys0.get(task), keys1.get(task)) : () => undefined;
    const merged = mergedJsonText(jsonPropertyShape(s.pset, s.property)!, s.text, r.text, w?.text,
      { where: path => ctx.exists(s.owner, s.pset, s.property, path), window });
    if ('refused' in merged || (!w && !isEmpty(merged.text))) continue;
    put(readOut, r, s.text);
    carried.add(key);
    if (w) { put(writtenOut, w, merged.text!); expected.set(key, merged.text!); }
  }
  return { read: readOut, written: writtenOut, expected, carried };
}
