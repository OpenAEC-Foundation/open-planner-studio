import { JSON_PROPERTY_PSETS, jsonPropertyDomain, jsonPropertyShape, WINDOWS_PROPERTY, type JsonDomainView, type JsonShape } from '../jsonRegister';
import { parseJsonTree, jsonSlice, type JsonMemberNode, type JsonNode } from '../jsonTokens';
import type { WriteIFCInput } from '../ifcWriter';
import type { JsonExtrasOfProperty } from './ifcSource';
import type { StepIndex } from './stepScanner';
import { WINDOW_KEY, windowPlaces, type JsonPathStep, type JsonSourceProperty } from './jsonMembers';

const DEFINES = 'IFCRELDEFINESBYPROPERTIES';
const ASSIGNS_TO_PROCESS = 'IFCRELASSIGNSTOPROCESS';
const RELATING_PROCESS_ARG = 6;
const propertyKey = (pset: string, property: string) => `${pset}\u0000${property}`;
const has = (keys: object, key: string) => Object.prototype.hasOwnProperty.call(keys, key);

export function writerKeyOfSeed(seed: string, projectCalendarId: string): string | undefined {
  const at = seed.indexOf(':');
  const kind = seed.slice(0, at), id = seed.slice(at + 1);
  return kind === 'task' ? `task_${id}`
    : kind === 'res' ? `res_${id}`
      : kind === 'seq' ? `seq_${id}`
        : kind === 'cal' ? (id === projectCalendarId ? '_calendar' : `calendar_${id}`)
          : kind === 'proj' ? '_project'
            : kind === 'wp' ? '_workplan'
              : kind === 'ws' ? '_worksched' : undefined;
}

export interface JsonExtrasObject {
  readonly path: readonly JsonPathStep[];
  readonly members: readonly { readonly key: string; readonly value: string }[];
}

function uniqueKeys(node: Extract<JsonNode, { kind: 'object' }>): boolean {
  return new Set(node.members.map(m => m.key)).size === node.members.length;
}

function itemsByField(node: Extract<JsonNode, { kind: 'array' }>, field: string): Map<string, JsonNode> {
  const count = new Map<string, number>(), out = new Map<string, JsonNode>();
  const valueOf = (item: JsonNode) => {
    const hits = item.kind === 'object' ? item.members.filter(m => m.key === field) : [];
    return hits.length === 1 && hits[0].value.kind === 'string' ? hits[0].value.value : undefined;
  };
  for (const item of node.items) { const v = valueOf(item); if (v !== undefined) count.set(v, (count.get(v) ?? 0) + 1); }
  for (const item of node.items) { const v = valueOf(item); if (v !== undefined && count.get(v) === 1) out.set(v, item); }
  return out;
}

export function unknownJsonMembers(text: string, shape: JsonShape, windowKnown: (key: string) => boolean): JsonExtrasObject[] | undefined {
  const root = parseJsonTree(text);
  if (!root) return undefined;
  const found: JsonExtrasObject[] = [];
  const raw = (m: JsonMemberNode) => ({ key: text.slice(m.keyStart, m.keyEnd), value: jsonSlice(text, m.value) });
  const walk = (node: JsonNode, at: JsonShape, path: readonly JsonPathStep[]): void => {
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
      for (const m of node.members) if (WINDOW_KEY.test(m.key) && windowKnown(m.key)) walk(m.value, at.waarde, [...path, { sleutel: m.key }]);
    }
  };
  walk(root, shape, []);
  return found;
}

export interface StepJsonExtras {
  readonly propertyStepId: number;
  readonly ownerStepId: number;
  readonly windowKeys?: readonly string[];
}

function singleIn(index: StepIndex, chunk: number, type: string, arg: number): number {
  let found = -1;
  for (let k = index.inStart(chunk); k < index.inEnd(chunk); k++) {
    const from = index.inSource(k);
    if (index.type(from) !== type || index.inArg(k) !== arg) continue;
    if (found >= 0) return -1;
    found = from;
  }
  return found;
}

function windowKeysOfTask(index: StepIndex, task: number): (key: string) => boolean {
  const count = new Map<number, number>();
  for (let k = index.inStart(task); k < index.inEnd(task); k++) {
    const rel = index.inSource(k);
    if (index.type(rel) !== ASSIGNS_TO_PROCESS || index.inArg(k) !== RELATING_PROCESS_ARG) continue;
    for (const r of index.refsAt(rel, 4)) if (r >= 0) count.set(r, (count.get(r) ?? 0) + 1);
  }
  const byGuid = new Map<string, number[]>();
  for (const r of count.keys()) {
    const list = byGuid.get(index.globalId(r));
    if (list) list.push(r); else byGuid.set(index.globalId(r), [r]);
  }
  return key => {
    const resources = byGuid.get(WINDOW_KEY.exec(key)?.[1] ?? '\u0000') ?? [];
    return resources.length === 1 && count.get(resources[0]) === 1;
  };
}

export function scanJsonExtras(index: StepIndex, own: (chunk: number) => boolean): StepJsonExtras[] {
  const psets = new Map<string, { owner: number; pset: number; name: string }[]>();
  for (let r = 0; r < index.count; r++) {
    if (!index.isEntity(r) || index.type(r) !== DEFINES || !own(r)) continue;
    const related = index.refsAt(r, 4);
    const pset = index.refAt(r, 5);
    if (related.length !== 1 || related[0] < 0 || pset < 0 || index.type(pset) !== 'IFCPROPERTYSET' || !own(pset)) continue;
    const name = index.name(pset) ?? '';
    if (!JSON_PROPERTY_PSETS.has(name) || singleIn(index, pset, DEFINES, 5) !== r) continue;
    const key = `${related[0]}\u0000${name}`;
    const list = psets.get(key);
    if (list) list.push({ owner: related[0], pset, name }); else psets.set(key, [{ owner: related[0], pset, name }]);
  }
  const out: StepJsonExtras[] = [], windowMaps: StepJsonExtras[] = [];
  let windowExtras = false;
  for (const group of psets.values()) {
    if (group.length !== 1) continue;
    const { owner, pset, name } = group[0];
    const props = index.refsAt(pset, 4).filter(p => p >= 0 && index.type(p) === 'IFCPROPERTYSINGLEVALUE')
      .map(p => ({ p, property: index.name(p) ?? '' }));
    const names = new Map<string, number>();
    for (const { property } of props) names.set(property, (names.get(property) ?? 0) + 1);
    for (const { p, property } of props) {
      const shape = jsonPropertyShape(name, property);
      if (!shape || !own(p) || names.get(property) !== 1) continue;
      const text = index.propertyText(p);
      if (text === undefined || !/^\s*[[{]/.test(text)) continue;
      const isWindows = propertyKey(name, property) === WINDOWS_PROPERTY;
      const known = isWindows ? windowKeysOfTask(index, owner) : () => false;
      const objects = unknownJsonMembers(text, shape, known);
      if (!objects) continue;
      const entry = { propertyStepId: Number(index.id(p)), ownerStepId: Number(index.id(owner)) };
      if (!isWindows) { if (objects.length > 0) out.push(entry); continue; }
      const root = parseJsonTree(text);
      const windowKeys = root?.kind === 'object' ? root.members.map(m => m.key).filter(k => WINDOW_KEY.test(k) && known(k)) : [];
      windowMaps.push({ ...entry, ...(windowKeys.length > 0 ? { windowKeys } : {}) });
      if (objects.length > 0) windowExtras = true;
    }
  }
  return windowExtras ? [...out, ...windowMaps] : out;
}

export function jsonExtrasIndex(found: readonly StepJsonExtras[], windowAssignments: (ownerStepId: number, key: string) => string | undefined,
): JsonExtrasOfProperty[] | undefined {
  const out = found.map(f => {
    const windows = (f.windowKeys ?? []).flatMap(key => {
      const assignmentId = windowAssignments(f.ownerStepId, key);
      return assignmentId === undefined ? [] : [{ key, assignmentId }];
    });
    return { propertyStepId: f.propertyStepId, ...(windows.length > 0 ? { windows } : {}) };
  });
  return out.length > 0 ? out : undefined;
}

export interface SourceJsonExtras extends JsonSourceProperty {
  readonly ownerStepId: number;
  readonly propertyStepId: number;
}

export function jsonExtrasFromIndex(index: StepIndex, entries: readonly JsonExtrasOfProperty[] | undefined,
  stepIds: Readonly<Record<string, number>>, projectCalendarId: string): SourceJsonExtras[] {
  if (!entries?.length) return [];
  const ownerKey = new Map<number, string>();
  for (const [seed, id] of Object.entries(stepIds)) {
    const key = writerKeyOfSeed(seed, projectCalendarId);
    if (key && !ownerKey.has(id)) ownerKey.set(id, key);
  }
  const out: SourceJsonExtras[] = [];
  for (const entry of entries) {
    const p = index.chunkOf(String(entry.propertyStepId));
    if (p < 0 || index.type(p) !== 'IFCPROPERTYSINGLEVALUE') continue;
    const pset = singleIn(index, p, 'IFCPROPERTYSET', 4);
    const rel = pset < 0 ? -1 : singleIn(index, pset, DEFINES, 5);
    const related = rel < 0 ? [] : index.refsAt(rel, 4);
    if (related.length !== 1 || related[0] < 0) continue;
    const ownerStepId = Number(index.id(related[0]));
    const owner = ownerKey.get(ownerStepId) ?? (index.type(related[0]) === 'IFCPROJECT' ? '_project' : undefined);
    const psetName = index.name(pset) ?? '', property = index.name(p) ?? '';
    const shape = jsonPropertyShape(psetName, property);
    const text = index.propertyText(p);
    if (!owner || !shape || text === undefined) continue;
    const windows = new Map((entry.windows ?? []).map(w => [w.key, w.assignmentId]));
    out.push({ owner, ownerStepId, propertyStepId: entry.propertyStepId, pset: psetName, property, text, windows });
  }
  return out;
}

export function windowsInPlace(sources: readonly JsonSourceProperty[], input: WriteIFCInput): boolean {
  if (!sources.some(s => s.windows.size > 0)) return true;
  const place = windowPlaces(input);
  return sources.every(s => [...s.windows].every(([key, id]) => {
    const p = place(id);
    return p !== undefined && p.owner === s.owner && p.key === key;
  }));
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const calendarKey = (input: WriteIFCInput, id: string) => id === input.calendar.id ? '_calendar' : `calendar_${id}`;

type FieldCache = Map<object, Map<string, Map<unknown, unknown[]>>>;
function byField<T>(cache: FieldCache, list: readonly T[], field: string, valueOf: (item: T) => unknown): Map<unknown, T[]> {
  let perField = cache.get(list);
  if (!perField) cache.set(list, perField = new Map());
  let map = perField.get(field) as Map<unknown, T[]> | undefined;
  if (!map) {
    map = new Map();
    for (const item of list) {
      const v = valueOf(item);
      if (v === undefined) continue;
      const hits = map.get(v);
      if (hits) hits.push(item); else map.set(v, [item]);
    }
    perField.set(field, map as Map<unknown, unknown[]>);
  }
  return map;
}

function domainView(input: WriteIFCInput): JsonDomainView {
  const owners = new Map<string, unknown>();
  for (const t of input.tasks) owners.set(`task_${t.id}`, t);
  for (const r of input.resources) owners.set(`res_${r.id}`, r);
  for (const q of input.sequences) owners.set(`seq_${q.id}`, q);
  for (const c of [...(input.resourceCalendars ?? []), input.calendar]) owners.set(calendarKey(input, c.id), c);
  for (const key of ['_project', '_worksched', '_workplan']) owners.set(key, input);
  return { input, owners };
}

function domainNode(fields: FieldCache, root: unknown, path: readonly JsonPathStep[]): unknown {
  let node: unknown = root;
  for (const step of path) {
    if ('veld' in step) {
      const hits = Array.isArray(node) ? byField(fields, node as unknown[], step.veld, item => isRecord(item) ? item[step.veld] : undefined).get(step.waarde) ?? [] : [];
      node = hits.length === 1 ? hits[0] : undefined;
    } else {
      node = isRecord(node) ? node[step.sleutel] : undefined;
    }
  }
  return node;
}

export function jsonObjectExists(input: WriteIFCInput): (owner: string, pset: string, property: string, path: readonly JsonPathStep[]) => boolean | undefined {
  let view: JsonDomainView | undefined;
  const fields: FieldCache = new Map();
  return (owner, pset, property, path) => {
    const domain = jsonPropertyDomain(pset, property);
    if (!domain) return undefined;
    view ??= domainView(input);
    if (!view.owners.has(owner)) return false;
    return domainNode(fields, domain.get(view, owner), path) !== undefined;
  };
}

function arrangedLike(domain: unknown, output: unknown): unknown {
  if (isRecord(domain) && isRecord(output)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(output)) out[key] = key in domain ? arrangedLike(domain[key], output[key]) : output[key];
    for (const key of Object.keys(domain)) if (!(key in out)) out[key] = domain[key];
    return out;
  }
  if (Array.isArray(domain) && Array.isArray(output) && domain.length === output.length) return domain.map((v, k) => arrangedLike(v, output[k]));
  return domain;
}

export interface JsonPropertyText {
  readonly owner: string;
  readonly pset: string;
  readonly property: string;
  readonly text: string;
}

export function withJsonInOutputForm(input: WriteIFCInput, texts: readonly JsonPropertyText[]): WriteIFCInput {
  if (texts.length === 0) return input;
  const d = domainView(input);
  const values = new Map<string, Map<string, unknown>>();
  for (const t of texts) {
    const domain = jsonPropertyDomain(t.pset, t.property);
    const value = domain?.set ? domain.get(d, t.owner) : undefined;
    if (value === undefined) continue;
    let output: unknown;
    try { output = JSON.parse(t.text); } catch { continue; }
    const key = propertyKey(t.pset, t.property);
    values.set(key, (values.get(key) ?? new Map<string, unknown>()).set(t.owner, arrangedLike(value, output)));
  }
  let out = input;
  for (const [key, byOwner] of values) {
    const [pset, property] = key.split('\u0000');
    out = jsonPropertyDomain(pset, property)!.set!(out, byOwner);
  }
  return out;
}

export interface JsonExtrasOutput {
  readonly index: StepIndex;
  readonly stepIds: Readonly<Record<string, number>>;
  readonly projectCalendarId: string;
}

export function jsonMembersProblem(expected: ReadonlyMap<string, string>, output: JsonExtrasOutput): string | undefined {
  if (expected.size === 0) return undefined;
  const { index } = output;
  const ownerStep = new Map<string, number>();
  for (const [seed, id] of Object.entries(output.stepIds)) {
    const key = writerKeyOfSeed(seed, output.projectCalendarId);
    if (key && !ownerStep.has(key)) ownerStep.set(key, id);
  }
  for (const [key, text] of expected) {
    const [owner, pset, property] = key.split('\u0000');
    const ownerChunk = ownerStep.has(owner) ? index.chunkOf(String(ownerStep.get(owner))) : -1;
    const found: string[] = [];
    for (let k = ownerChunk < 0 ? 0 : index.inStart(ownerChunk); ownerChunk >= 0 && k < index.inEnd(ownerChunk); k++) {
      const rel = index.inSource(k);
      if (index.type(rel) !== DEFINES || index.inArg(k) !== 4) continue;
      const set = index.refAt(rel, 5);
      if (set < 0 || index.type(set) !== 'IFCPROPERTYSET' || index.name(set) !== pset) continue;
      for (const p of index.refsAt(set, 4)) if (p >= 0 && index.name(p) === property) found.push(index.propertyText(p) ?? '');
    }
    if (found.length !== 1 || found[0] !== text) {
      return `${owner} ${pset}.${property}: de uitvoer heeft ${found.length === 1 ? 'een andere tekst' : `${found.length} keer deze eigenschap`} dan de beslissing per lid`;
    }
  }
  return undefined;
}

