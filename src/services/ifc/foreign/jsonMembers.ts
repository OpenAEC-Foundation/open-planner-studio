import { ifcStr } from '../ifcPsets';
import { decodeStepText } from '../stepText';
import { jsonPropertyShape, WINDOWS_PROPERTY, type JsonShape } from '../jsonRegister';
import { jsonSlice, parseJsonTree, sameNode, type JsonMemberNode, type JsonNode } from '../jsonTokens';
import type { WriteIFCInput } from '../ifcWriter';

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

export interface WindowPlace {
  readonly owner: string;
  readonly key: string;
}

export interface JsonMemberContext {
  readonly place: (assignmentId: string) => WindowPlace | undefined;
  readonly readKey: (owner: string, key: string) => string | undefined;
  readonly exists: (owner: string, pset: string, property: string, path: readonly JsonPathStep[]) => boolean | undefined;
}

export interface JsonMembers {
  readonly read: string[];
  readonly written: string[];
  readonly expected: ReadonlyMap<string, string>;
  readonly carried: ReadonlySet<string>;
}

export const jsonPropertyKey = (owner: string, pset: string, property: string) => `${owner}\u0000${pset}\u0000${property}`;

export function windowPlaces(input: Pick<WriteIFCInput, 'assignments' | 'resources' | 'ifcGlobalIds'>): (assignmentId: string) => WindowPlace | undefined {
  const written = new Set(input.resources.map(r => r.id));
  const places = new Map<string, WindowPlace>();
  const counts = new Map<string, number>();
  for (const a of input.assignments) {
    if (!written.has(a.resourceId)) continue;
    const index = counts.get(a.taskId) ?? 0;
    counts.set(a.taskId, index + 1);
    const guid = input.ifcGlobalIds?.[`res:${a.resourceId}`];
    if (guid !== undefined) places.set(a.id, { owner: `task_${a.taskId}`, key: `${guid}#${index}` });
  }
  return id => places.get(id);
}

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

interface Member {
  readonly where: (path: readonly JsonPathStep[]) => boolean | undefined;
}

function memberText(shape: JsonShape, s: Side | undefined, z: Side | undefined, w: Side | undefined,
  path: readonly JsonPathStep[], m: Member): string | undefined {
  if (!s) return w ? slice(w) : undefined;
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
      return shape.identiteit === 'sleutel' ? mapText(shape.waarde, s, z, w, path, m) : refuse('een vensterkaart hoort bij haar eigenschap');
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

function mapText(value: JsonShape, s: Side, z: Side | undefined, w: Side, path: readonly JsonPathStep[], m: Member): string {
  const sMembers = byKey(s, 'bron'), wMembers = byKey(w, 'writer'), zMembers = z ? byKey(z, 'lezing') : undefined;
  const parts: string[] = [];
  for (const sm of sMembers.values()) {
    const wm = wMembers.get(sm.key), zm = zMembers?.get(sm.key);
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

function locate(written: WriterLines, owners: ReadonlySet<string>): Map<string, Located> {
  const out = new Map<string, Located>();
  if (owners.size === 0) return out;
  const ownerOf = new Map<number, string>();
  for (const owner of owners) {
    const id = written.idMap.get(owner);
    if (id !== undefined) ownerOf.set(id, owner);
  }
  const lineAt = new Map<number, number>();
  written.lines.forEach((line, k) => { const m = /^#(\d+)=/.exec(line); if (m) lineAt.set(Number(m[1]), k); });
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
  exists: (path: readonly JsonPathStep[]) => boolean | undefined = () => undefined): { readonly text: string | undefined } | { readonly refused: string } {
  try {
    return { text: memberText(shape, parsed(source), parsed(read), written === undefined ? emptyOf(shape) : parsed(written), [], { where: exists }) };
  } catch (e) {
    if (e instanceof Refused) return { refused: e.message };
    throw e;
  }
}

interface WindowMap {
  readonly side: Side;
  readonly members: ReadonlyMap<string, JsonMemberNode>;
}

function windowMap(text: string | undefined, what: string): WindowMap | undefined {
  const side = parsed(text);
  return side && { side, members: byKey(side, what) };
}

interface WindowSource {
  readonly property: JsonSourceProperty;
  readonly map: WindowMap;
  readonly read: WindowMap | undefined;
  readonly keyOf: ReadonlyMap<string, string>;
}

function windowsText(owner: string, source: WindowSource | undefined, written: WindowMap | undefined,
  arrivals: readonly { readonly assignmentId: string; readonly from: WindowSource; readonly key: string }[],
  ctx: JsonMemberContext, windowShape: JsonShape, m: Member): string | undefined {
  const parts: string[] = [];
  const done = new Set<string>();
  const windowAt = (from: WindowSource, key: string, keyToken: string | undefined, place: WindowPlace) => {
    const zKey = ctx.readKey(from.property.owner, key);
    const zm = zKey === undefined ? undefined : from.read?.members.get(zKey);
    if (!zm) return refuse(`venster ${key}: geen lezing`);
    const wm = written?.members.get(place.key);
    const value = memberText(windowShape, at(from.map.side, from.map.members.get(key)!.value), at(from.read!.side, zm.value),
      wm ? at(written!.side, wm.value) : EMPTY_OBJECT, [{ sleutel: key }], m);
    done.add(place.key);
    if (!wm && isEmpty(value)) return;
    parts.push(`${keyToken ?? JSON.stringify(place.key)}:${value}`);
  };
  if (source) {
    const s = source.map.side;
    for (const sm of source.map.members.values()) {
      if (!WINDOW_KEY.test(sm.key)) { parts.push(pair(s, sm)); continue; }
      const id = source.property.windows.get(sm.key);
      if (id === undefined) refuse(`venster ${sm.key} hoort niet aantoonbaar bij één toewijzing`);
      const place = ctx.place(id!);
      if (!place) {
        const zKey = ctx.readKey(owner, sm.key);
        const zm = zKey === undefined ? undefined : source.read?.members.get(zKey);
        if (zm && jsonSlice(s.text, sm.value) === jsonSlice(source.read!.side.text, zm.value)) continue;
        refuse(`venster ${sm.key}: de toewijzing bestaat niet meer`);
      }
      if (place!.owner !== owner) continue;
      windowAt(source, sm.key, place!.key === sm.key ? s.text.slice(sm.keyStart, sm.keyEnd) : undefined, place!);
    }
  }
  const order = new Map([...(written?.members.keys() ?? [])].map((k, i) => [k, i]));
  for (const a of [...arrivals].sort((x, y) => (order.get(x.key) ?? Infinity) - (order.get(y.key) ?? Infinity))) {
    windowAt(a.from, a.from.keyOf.get(a.assignmentId)!, undefined, { owner, key: a.key });
  }
  if (written) for (const wm of written.members.values()) if (!done.has(wm.key)) parts.push(pair(written.side, wm));
  if (!written) return parts.length === 0 ? undefined : refuse('vensters met onbekende sleutels hebben geen plek: de writer schrijft voor deze taak geen vensters');
  const text = `{${parts.join(',')}}`;
  return source && text === `{${[...source.map.members.values()].map(x => pair(source.map.side, x)).join(',')}}` ? slice(source.map.side) : text;
}

export function jsonMembers(read: WriterLines, written: WriterLines, sources: readonly JsonSourceProperty[],
  ctx: JsonMemberContext): JsonMembers {
  const readOut = [...read.lines], writtenOut = [...written.lines];
  const expected = new Map<string, string>(), carried = new Set<string>();
  if (sources.length === 0) return { read: readOut, written: writtenOut, expected, carried };
  const isWindows = (s: JsonSourceProperty) => `${s.pset}\u0000${s.property}` === WINDOWS_PROPERTY;
  const owners = new Set<string>(sources.map(s => s.owner));
  const placesOf = new Map<string, { from: JsonSourceProperty; place: WindowPlace | undefined }>();
  for (const s of sources) if (isWindows(s)) for (const [, id] of s.windows) placesOf.set(id, { from: s, place: ctx.place(id) });
  for (const { place } of placesOf.values()) if (place) owners.add(place.owner);
  const reads = locate(read, owners), writes = locate(written, owners);
  const put = (lines: string[], loc: Located, text: string) => {
    lines[loc.at] = `#${loc.id}=IFCPROPERTYSINGLEVALUE('${loc.nameRaw}',$,IFCTEXT(${ifcStr(text)}),$);`;
  };

  for (const s of sources) {
    if (isWindows(s)) continue;
    const key = jsonPropertyKey(s.owner, s.pset, s.property);
    const r = reads.get(key), w = writes.get(key);
    if (!r) continue;
    const merged = mergedJsonText(jsonPropertyShape(s.pset, s.property)!, s.text, r.text, w?.text, path => ctx.exists(s.owner, s.pset, s.property, path));
    if ('refused' in merged || (!w && !isEmpty(merged.text))) continue;
    put(readOut, r, s.text);
    carried.add(key);
    if (w) { put(writtenOut, w, merged.text!); expected.set(key, merged.text!); }
  }

  const windowSources = sources.filter(isWindows);
  if (windowSources.length === 0) return { read: readOut, written: writtenOut, expected, carried };
  const [pset, property] = WINDOWS_PROPERTY.split('\u0000');
  const windowShape = (jsonPropertyShape(pset, property) as Extract<JsonShape, { soort: 'kaart' }>).waarde;
  const keyOf = (owner: string) => jsonPropertyKey(owner, pset, property);
  const fallback = new Set<string>();
  const bySource = new Map<string, WindowSource>();
  for (const s of windowSources) {
    try {
      bySource.set(s.owner, { property: s, map: windowMap(s.text, 'bron')!, read: windowMap(reads.get(keyOf(s.owner))?.text, 'lezing'),
        keyOf: new Map([...s.windows].map(([k, id]) => [id, k])) });
      if (!reads.get(keyOf(s.owner))) fallback.add(s.owner);
    } catch (e) {
      if (!(e instanceof Refused)) throw e;
      fallback.add(s.owner);
    }
  }
  const writtenMaps = new Map<string, WindowMap | undefined>();
  const writtenMap = (owner: string) => {
    if (!writtenMaps.has(owner)) {
      try { writtenMaps.set(owner, windowMap(writes.get(keyOf(owner))?.text, 'writer')); }
      catch (e) { if (!(e instanceof Refused)) throw e; writtenMaps.set(owner, undefined); fallback.add(owner); }
    }
    return writtenMaps.get(owner);
  };
  const windowOwners = new Set<string>([...bySource.keys()]);
  for (const { place } of placesOf.values()) if (place) windowOwners.add(place.owner);
  const member: Member = { where: () => undefined };
  const results = new Map<string, string | undefined>();
  for (;;) {
    results.clear();
    const arrivals = new Map<string, { assignmentId: string; from: WindowSource; key: string }[]>();
    for (const [assignmentId, p] of placesOf) {
      const from = bySource.get(p.from.owner);
      if (!p.place || p.place.owner === p.from.owner || !from || fallback.has(p.from.owner)) continue;
      const list = arrivals.get(p.place.owner);
      const entry = { assignmentId, from, key: p.place.key };
      if (list) list.push(entry); else arrivals.set(p.place.owner, [entry]);
    }
    for (const owner of windowOwners) {
      if (fallback.has(owner)) continue;
      try {
        results.set(owner, windowsText(owner, bySource.get(owner), writtenMap(owner), arrivals.get(owner) ?? [], ctx, windowShape, member));
      } catch (e) {
        if (!(e instanceof Refused)) throw e;
        fallback.add(owner);
      }
    }
    const before = fallback.size;
    for (const { from, place } of placesOf.values()) if (place && place.owner !== from.owner && fallback.has(place.owner)) fallback.add(from.owner);
    if (fallback.size === before) break;
  }
  for (const [owner, text] of results) {
    if (fallback.has(owner)) continue;
    const r = reads.get(keyOf(owner)), w = writes.get(keyOf(owner)), source = bySource.get(owner);
    if (r && source) { put(readOut, r, source.property.text); carried.add(keyOf(owner)); }
    if (w && text !== undefined) { put(writtenOut, w, text); expected.set(keyOf(owner), text); }
  }
  return { read: readOut, written: writtenOut, expected, carried };
}
