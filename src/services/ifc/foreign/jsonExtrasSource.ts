import { JSON_PROPERTY_PSETS, jsonPropertyShape } from '../jsonRegister';
import {
  unknownJsonMembers, type JsonExtras, type JsonExtrasObject, type JsonStep, type WriterAssignment,
} from '../jsonExtras';
import { parseJsonTree, jsonSlice, sameJsonValue, type JsonNode } from '../jsonTokens';
import type { StepIndex } from './stepScanner';

const DEFINES = 'IFCRELDEFINESBYPROPERTIES';
const ASSIGNS_TO_PROCESS = 'IFCRELASSIGNSTOPROCESS';
const DATA_KEY = /^(.+)#(\d+)$/;

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

interface JsonSource {
  readonly index: StepIndex;
  readonly own: (chunk: number) => boolean;
  readonly stepIds: Readonly<Record<string, number>>;
  readonly projectCalendarId: string;
}

interface LocatedJson {
  readonly owner: string;
  readonly ownerChunk: number;
  readonly pset: string;
  readonly property: string;
  readonly text: string;
}

function ownerKeys(src: JsonSource): Map<number, string> {
  const out = new Map<number, string>();
  for (const [seed, id] of Object.entries(src.stepIds)) {
    const chunk = src.index.chunkOf(String(id));
    const key = writerKeyOfSeed(seed, src.projectCalendarId);
    if (chunk >= 0 && key && !out.has(chunk)) out.set(chunk, key);
  }
  return out;
}

function locatedJson(src: JsonSource): LocatedJson[] {
  const { index, own } = src;
  const owners = ownerKeys(src);
  const psets = new Map<string, { owner: string; ownerChunk: number; pset: number; name: string }[]>();
  for (let r = 0; r < index.count; r++) {
    if (!index.isEntity(r) || index.type(r) !== DEFINES || !own(r)) continue;
    const related = index.refsAt(r, 4);
    const owner = related.length === 1 ? owners.get(related[0]) : undefined;
    const pset = index.refAt(r, 5);
    if (!owner || pset < 0 || index.type(pset) !== 'IFCPROPERTYSET' || !own(pset)) continue;
    const name = index.name(pset) ?? '';
    if (!JSON_PROPERTY_PSETS.has(name)) continue;
    let rels = 0;
    for (let k = index.inStart(pset); k < index.inEnd(pset); k++) {
      if (index.type(index.inSource(k)) === DEFINES) rels++;
    }
    if (rels !== 1) continue;
    const key = `${owner}\u0000${name}`;
    psets.set(key, [...(psets.get(key) ?? []), { owner, ownerChunk: related[0], pset, name }]);
  }
  const out: LocatedJson[] = [];
  for (const group of psets.values()) {
    if (group.length !== 1) continue;
    const { owner, ownerChunk, pset, name } = group[0];
    const props = index.refsAt(pset, 4).filter(p => p >= 0 && index.type(p) === 'IFCPROPERTYSINGLEVALUE');
    for (const p of props) {
      const property = index.name(p) ?? '';
      if (!jsonPropertyShape(name, property) || !own(p)) continue;
      if (props.filter(q => index.name(q) === property).length !== 1) continue;
      const text = index.propertyText(p);
      if (text !== undefined && /^\s*[[{]/.test(text)) out.push({ owner, ownerChunk, pset: name, property, text });
    }
  }
  return out;
}

function resourceResolver(src: JsonSource, taskChunk: number): (key: string) => string | undefined {
  const { index } = src;
  const byGuid = new Map<string, { chunk: number; id: string } | null>();
  for (const [seed, id] of Object.entries(src.stepIds)) {
    if (!seed.startsWith('res:')) continue;
    const chunk = index.chunkOf(String(id));
    if (chunk < 0) continue;
    const guid = index.globalId(chunk);
    byGuid.set(guid, byGuid.has(guid) ? null : { chunk, id: seed.slice('res:'.length) });
  }
  return key => {
    const guid = DATA_KEY.exec(key)?.[1];
    const resource = guid === undefined ? undefined : byGuid.get(guid);
    if (!resource) return undefined;
    let count = 0;
    for (let k = index.inStart(taskChunk); k < index.inEnd(taskChunk); k++) {
      const rel = index.inSource(k);
      if (index.type(rel) !== ASSIGNS_TO_PROCESS || index.inArg(k) !== 6) continue;
      count += index.refsAt(rel, 4).filter(r => r === resource.chunk).length;
    }
    return count === 1 ? resource.id : undefined;
  };
}

export function jsonExtrasOf(src: JsonSource): JsonExtras[] {
  const out: JsonExtras[] = [];
  for (const at of locatedJson(src)) {
    const shape = jsonPropertyShape(at.pset, at.property)!;
    const objects = unknownJsonMembers(at.text, shape, resourceResolver(src, at.ownerChunk));
    if (objects && objects.length > 0) out.push({ owner: at.owner, pset: at.pset, property: at.property, objects });
  }
  return out;
}

type Found = { readonly node: JsonNode } | 'weg' | 'onzeker';

function findObject(text: string | undefined, path: readonly JsonStep[], resourceOfKey: (key: string) => string | undefined,
  assignmentExists: (resourceId: string) => boolean): Found {
  let node: JsonNode | undefined = text === undefined ? undefined : parseJsonTree(text);
  if (text !== undefined && !node) return 'onzeker';
  for (const step of path) {
    if ('veld' in step) {
      if (!node) return 'weg';
      if (node.kind !== 'array') return 'onzeker';
      const hits: JsonNode[] = node.items.filter(item => item.kind === 'object'
        && item.members.some(m => m.key === step.veld && m.value.kind === 'string' && m.value.value === step.waarde));
      if (hits.length === 0) return 'weg';
      if (hits.length > 1) return 'onzeker';
      node = hits[0];
    } else if ('toewijzing' in step) {
      if (!assignmentExists(step.toewijzing)) return 'weg';
      if (!node) return 'onzeker';
      if (node.kind !== 'object') return 'onzeker';
      const hits: JsonNode[] = node.members.filter(m => resourceOfKey(m.key) === step.toewijzing).map(m => m.value);
      if (hits.length !== 1) return 'onzeker';
      node = hits[0];
    } else {
      if (!node) continue;
      if (node.kind !== 'object') return 'onzeker';
      const hits: JsonNode[] = node.members.filter(m => m.key === step.sleutel).map(m => m.value);
      if (hits.length > 1) return 'onzeker';
      node = hits[0];
    }
  }
  return node ? { node } : 'onzeker';
}

const describe = (e: JsonExtras, o: JsonExtrasObject) =>
  `${e.owner} ${e.pset}.${e.property} ${JSON.stringify(o.path)}`;

export function jsonExtrasProblem(
  before: readonly JsonExtras[], output: JsonSource, assignments: readonly WriterAssignment[],
): string | undefined {
  if (before.length === 0) return undefined;
  const present = new Set(ownerKeys(output).values());
  const located = locatedJson(output);
  for (const e of before) {
    if (!present.has(e.owner)) continue;
    const at = located.find(l => l.owner === e.owner && l.pset === e.pset && l.property === e.property);
    const taskId = e.owner.startsWith('task_') ? e.owner.slice('task_'.length) : undefined;
    const resolver = at ? resourceResolver(output, at.ownerChunk) : () => undefined;
    const exists = (resourceId: string) => assignments.some(a => a.taskId === taskId && a.resourceId === resourceId);
    for (const o of e.objects) {
      const found = findObject(at?.text, o.path, resolver, exists);
      if (found === 'weg') continue;
      if (found === 'onzeker' || found.node.kind !== 'object') {
        return `${describe(e, o)}: het object met onbekende JSON-sleutels staat niet eenduidig in de uitvoer`;
      }
      const node = found.node;
      for (const m of o.members) {
        const key = JSON.parse(m.key) as string;
        const hits = node.members.filter(x => x.key === key);
        if (hits.length !== 1 || !sameJsonValue(m.value, jsonSlice(at!.text, hits[0].value))) {
          return `${describe(e, o)}: de onbekende sleutel ${m.key} staat in de uitvoer als `
            + `${hits.length === 0 ? '(ontbreekt)' : hits.map(h => jsonSlice(at!.text, h.value)).join(' en ')}, in de bron als ${m.value}`;
        }
      }
    }
  }
  return undefined;
}
