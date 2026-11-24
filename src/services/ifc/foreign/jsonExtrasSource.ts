import { JSON_PROPERTY_PSETS, jsonPropertyShape, WINDOWS_PROPERTY } from '../jsonRegister';
import { unknownJsonMembers, WINDOW_KEY, type JsonExtras, type JsonExtrasObject, type JsonStep } from '../jsonExtras';
import { parseJsonTree, jsonSlice, type JsonNode } from '../jsonTokens';
import { PROP, PSET } from '../ifcPsets';
import type { WriteIFCInput } from '../ifcWriter';
import type { JsonExtrasOfProperty } from './ifcSource';
import type { StepIndex } from './stepScanner';

const DEFINES = 'IFCRELDEFINESBYPROPERTIES';
const ASSIGNS_TO_PROCESS = 'IFCRELASSIGNSTOPROCESS';
const RELATING_PROCESS_ARG = 6;
const propertyKey = (pset: string, property: string) => `${pset}\u0000${property}`;

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
  for (const r of count.keys()) byGuid.set(index.globalId(r), [...(byGuid.get(index.globalId(r)) ?? []), r]);
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
    psets.set(key, [...(psets.get(key) ?? []), { owner: related[0], pset, name }]);
  }
  const out: StepJsonExtras[] = [];
  for (const group of psets.values()) {
    if (group.length !== 1) continue;
    const { owner, pset, name } = group[0];
    const props = index.refsAt(pset, 4).filter(p => p >= 0 && index.type(p) === 'IFCPROPERTYSINGLEVALUE');
    const names = new Map<string, number>();
    for (const p of props) names.set(index.name(p) ?? '', (names.get(index.name(p) ?? '') ?? 0) + 1);
    for (const p of props) {
      const property = index.name(p) ?? '';
      const shape = jsonPropertyShape(name, property);
      if (!shape || !own(p) || names.get(property) !== 1) continue;
      const text = index.propertyText(p);
      if (text === undefined || !/^\s*[[{]/.test(text)) continue;
      const windows = propertyKey(name, property) === WINDOWS_PROPERTY ? windowKeysOfTask(index, owner) : () => false;
      const objects = unknownJsonMembers(text, shape, windows);
      if (!objects || objects.length === 0) continue;
      const windowKeys = [...new Set(objects.flatMap(o => o.path.flatMap(s => 'venster' in s ? [s.venster] : [])))];
      out.push({ propertyStepId: Number(index.id(p)), ownerStepId: Number(index.id(owner)), ...(windowKeys.length > 0 ? { windowKeys } : {}) });
    }
  }
  return out;
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

export interface SourceJsonExtras extends JsonExtras {
  readonly ownerStepId: number;
  readonly text: string;
  readonly windows: ReadonlyMap<string, string>;
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
    const objects = unknownJsonMembers(text, shape, key => windows.has(key)) ?? [];
    if (objects.length > 0) out.push({ owner, ownerStepId, pset: psetName, property, objects, text, windows });
  }
  return out;
}

export function jsonExtrasForWriter(extras: readonly SourceJsonExtras[], assignmentOf: (e: SourceJsonExtras, key: string) => string | undefined): JsonExtras[] {
  return extras.map(e => ({
    owner: e.owner, pset: e.pset, property: e.property,
    objects: e.objects.flatMap((o): JsonExtrasObject[] => {
      const step = o.path[0];
      if (!step || !('venster' in step)) return [o];
      const assignmentId = assignmentOf(e, step.venster);
      return assignmentId === undefined ? [] : [{ path: [{ toewijzing: assignmentId }, ...o.path.slice(1)], members: o.members }];
    }),
  }));
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const ownerId = (owner: string, prefix: string) => owner.startsWith(prefix) ? owner.slice(prefix.length) : undefined;
const taskOf = (input: WriteIFCInput, owner: string) => input.tasks.find(t => t.id === ownerId(owner, 'task_'));
const calendarOf = (input: WriteIFCInput, owner: string) => {
  const id = owner === '_calendar' ? input.calendar.id : ownerId(owner, 'calendar_');
  return [input.calendar, ...(input.resourceCalendars ?? [])].find(c => c.id === id);
};

function ownerExists(input: WriteIFCInput, owner: string): boolean {
  if (owner.startsWith('task_')) return !!taskOf(input, owner);
  if (owner.startsWith('res_')) return input.resources.some(r => r.id === ownerId(owner, 'res_'));
  if (owner.startsWith('seq_')) return input.sequences.some(s => s.id === ownerId(owner, 'seq_'));
  if (owner === '_calendar' || owner.startsWith('calendar_')) return !!calendarOf(input, owner);
  return owner === '_project' || owner === '_worksched' || owner === '_workplan';
}

type Mirror = {
  readonly get: (input: WriteIFCInput, owner: string) => unknown;
  readonly set?: (input: WriteIFCInput, owner: string, value: unknown) => WriteIFCInput;
};

const onTask = (field: 'notes' | 'externalLinks'): Mirror => ({
  get: (input, owner) => taskOf(input, owner)?.[field],
  set: (input, owner, value) => ({ ...input, tasks: input.tasks.map(t => t.id === ownerId(owner, 'task_') ? { ...t, [field]: value } : t) }),
});

const DOMAIN: Readonly<Record<string, Mirror>> = {
  [propertyKey(PSET.StructureMeta, PROP.StructureMeta.structure)]: {
    get: (input, owner) => owner === '_project'
      ? { activityCodeTypes: input.activityCodeTypes ?? [], customFieldDefs: input.customFieldDefs ?? [] } : undefined,
    set: (input, _owner, value) => {
      const v = value as Pick<WriteIFCInput, 'activityCodeTypes' | 'customFieldDefs'>;
      return { ...input, activityCodeTypes: v.activityCodeTypes, customFieldDefs: v.customFieldDefs };
    },
  },
  [propertyKey(PSET.TaskTypes, PROP.TaskTypes.TaskTypes)]: {
    get: (input, owner) => owner === '_project' ? { definitions: input.customTaskTypes ?? [] } : undefined,
  },
  [propertyKey(PSET.Library, PROP.Library.pool)]: { get: (input, owner) => owner === '_project' ? input.libraryPool : undefined },
  [propertyKey(PSET.Baselines, PROP.Baselines.Baselines)]: {
    get: (input, owner) => owner === '_worksched' ? input.baselines ?? [] : undefined,
    set: (input, _owner, value) => ({ ...input, baselines: value as WriteIFCInput['baselines'] }),
  },
  [propertyKey(PSET.SchedulingOptions, PROP.SchedulingOptions.SchedulingOptions)]: {
    get: (input, owner) => owner === '_worksched' ? input.project.schedulingOptions : undefined,
  },
  [propertyKey(PSET.TaskNotes, PROP.TaskNotes.Notes)]: onTask('notes'),
  [propertyKey(PSET.ExternalLink, PROP.ExternalLink.Links)]: onTask('externalLinks'),
  [propertyKey(PSET.Resource, PROP.Resource.LibraryOrigin)]: {
    get: (input, owner) => input.resources.find(r => r.id === ownerId(owner, 'res_'))?.libraryOrigin,
    set: (input, owner, value) => ({ ...input, resources: input.resources.map(r => r.id === ownerId(owner, 'res_')
      ? { ...r, libraryOrigin: value as typeof r.libraryOrigin } : r) }),
  },
  [propertyKey(PSET.Calendar, PROP.Calendar.LibraryOrigin)]: {
    get: (input, owner) => calendarOf(input, owner)?.libraryOrigin,
    set: (input, owner, value) => {
      const id = calendarOf(input, owner)?.id;
      const put = <C extends { id: string }>(c: C) => c.id === id ? { ...c, libraryOrigin: value } : c;
      return { ...input, calendar: put(input.calendar), ...(input.resourceCalendars ? { resourceCalendars: input.resourceCalendars.map(put) } : {}) };
    },
  },
};

function domainObject(root: unknown, path: readonly JsonStep[]): Record<string, unknown> | undefined {
  let node: unknown = root;
  for (const step of path) {
    if ('veld' in step) {
      const hits = Array.isArray(node) ? byField(node, node as unknown[], step.veld, item => isRecord(item) ? item[step.veld] : undefined).get(step.waarde) ?? [] : [];
      node = hits.length === 1 ? hits[0] : undefined;
    } else if ('sleutel' in step) {
      node = isRecord(node) ? node[step.sleutel] : undefined;
    } else {
      return undefined;
    }
  }
  return isRecord(node) ? node : undefined;
}

export function withJsonExtrasInDomain(input: WriteIFCInput, extras: readonly JsonExtras[]): WriteIFCInput {
  let out = input;
  for (const e of extras) {
    const mirror = DOMAIN[propertyKey(e.pset, e.property)];
    const value = mirror?.set ? mirror.get(out, e.owner) : undefined;
    if (value === undefined) continue;
    const missing = e.objects.flatMap(o => {
      const target = domainObject(value, o.path);
      return target ? o.members.filter(m => !(JSON.parse(m.key) in target)).map(m => ({ path: o.path, member: m })) : [];
    });
    if (missing.length === 0) continue;
    const copy = structuredClone(value);
    for (const { path, member } of missing) domainObject(copy, path)![JSON.parse(member.key) as string] = JSON.parse(member.value);
    out = mirror.set!(out, e.owner, copy);
  }
  return out;
}

export interface JsonExtrasOutput {
  readonly index: StepIndex;
  readonly stepIds: Readonly<Record<string, number>>;
  readonly projectCalendarId: string;
  readonly assignmentKeys: ReadonlyMap<string, string>;
}

export interface WindowBinding {
  readonly ownerStepId: number;
  readonly key: string;
  readonly assignmentId: string;
}

type Found = { readonly node: JsonNode } | 'absent' | 'onzeker';

const fieldIndexes = new WeakMap<object, Map<string, Map<unknown, unknown[]>>>();
function byField<T>(list: object, items: readonly T[], field: string, valueOf: (item: T) => unknown): Map<unknown, T[]> {
  let perField = fieldIndexes.get(list);
  if (!perField) fieldIndexes.set(list, perField = new Map());
  let map = perField.get(field) as Map<unknown, T[]> | undefined;
  if (!map) {
    map = new Map();
    for (const item of items) {
      const v = valueOf(item);
      if (v !== undefined) map.set(v, [...(map.get(v) ?? []), item]);
    }
    perField.set(field, map as Map<unknown, unknown[]>);
  }
  return map;
}
const jsonFieldValue = (field: string) => (item: JsonNode): unknown => {
  if (item.kind !== 'object') return undefined;
  const hits = item.members.filter(m => m.key === field && m.value.kind === 'string');
  return hits.length === 1 && hits[0].value.kind === 'string' ? hits[0].value.value : hits.length > 1 ? {} : undefined;
};

function follow(root: JsonNode | undefined, path: readonly JsonStep[]): Found {
  let node = root;
  for (const step of path) {
    if (!node) return 'absent';
    if ('veld' in step) {
      if (node.kind !== 'array') return 'onzeker';
      const hits = byField(node, node.items, step.veld, jsonFieldValue(step.veld)).get(step.waarde) ?? [];
      if (hits.length > 1) return 'onzeker';
      node = hits[0];
    } else if ('sleutel' in step) {
      if (node.kind !== 'object') return 'onzeker';
      const hits: JsonNode[] = node.members.filter(m => m.key === step.sleutel).map(m => m.value);
      if (hits.length > 1) return 'onzeker';
      node = hits[0];
    } else {
      return 'onzeker';
    }
  }
  return node ? { node } : 'absent';
}

const describe = (e: JsonExtras, o: JsonExtrasObject) => `${e.owner} ${e.pset}.${e.property} ${JSON.stringify(o.path)}`;

export function jsonExtrasProblem(before: readonly SourceJsonExtras[], output: JsonExtrasOutput, input: WriteIFCInput,
): { problem?: string; windows: WindowBinding[] } {
  const windows: WindowBinding[] = [];
  if (before.length === 0) return { windows };
  const { index } = output;
  const ownerStep = new Map<string, number>();
  for (const [seed, id] of Object.entries(output.stepIds)) {
    const key = writerKeyOfSeed(seed, output.projectCalendarId);
    if (key && !ownerStep.has(key)) ownerStep.set(key, id);
  }
  const located = new Map<string, { text: string; root: JsonNode | undefined; ownerStepId: number } | undefined>();
  const at = (owner: string, pset: string, property: string) => {
    const key = `${owner}\u0000${propertyKey(pset, property)}`;
    if (located.has(key)) return located.get(key);
    let found: { text: string; root: JsonNode | undefined; ownerStepId: number } | undefined;
    const ownerChunk = ownerStep.has(owner) ? index.chunkOf(String(ownerStep.get(owner))) : -1;
    for (let k = ownerChunk < 0 ? 0 : index.inStart(ownerChunk); ownerChunk >= 0 && k < index.inEnd(ownerChunk); k++) {
      const rel = index.inSource(k);
      if (index.type(rel) !== DEFINES || index.inArg(k) !== 4) continue;
      const set = index.refAt(rel, 5);
      if (set < 0 || index.type(set) !== 'IFCPROPERTYSET' || index.name(set) !== pset) continue;
      const props = index.refsAt(set, 4).filter(p => p >= 0 && index.name(p) === property);
      if (props.length !== 1 || found) { found = undefined; break; }
      const text = index.propertyText(props[0]);
      if (text !== undefined) found = { text, root: undefined, ownerStepId: Number(index.id(ownerChunk)) };
    }
    located.set(key, found);
    return found;
  };
  const tree = (place: { text: string; root: JsonNode | undefined }) => (place.root ??= parseJsonTree(place.text));
  const assignments = new Map(input.assignments.map(a => [a.id, a]));
  const membersProblem = (e: SourceJsonExtras, o: JsonExtrasObject, text: string, node: JsonNode): string | undefined => {
    if (node.kind !== 'object') return `${describe(e, o)}: het object met onbekende JSON-sleutels staat niet eenduidig in de uitvoer`;
    for (const m of o.members) {
      const key = JSON.parse(m.key) as string;
      const hits = node.members.filter(x => x.key === key);
      if (hits.length !== 1 || jsonSlice(text, hits[0].value) !== m.value) {
        return `${describe(e, o)}: de onbekende sleutel ${m.key} staat in de uitvoer als `
          + `${hits.length === 0 ? '(ontbreekt)' : hits.map(h => jsonSlice(text, h.value)).join(' en ')}, in de bron als ${m.value}`;
      }
    }
    return undefined;
  };
  for (const e of before) {
    const place = at(e.owner, e.pset, e.property);
    const unchanged = place?.text === e.text;
    for (const o of e.objects) {
      const step = o.path[0];
      if (step && 'venster' in step) {
        const assignmentId = e.windows.get(step.venster);
        const assignment = assignmentId === undefined ? undefined : assignments.get(assignmentId);
        if (unchanged && place) {
          if (assignmentId !== undefined) windows.push({ ownerStepId: place.ownerStepId, key: step.venster, assignmentId });
          continue;
        }
        if (!assignment) {
          if (!ownerExists(input, e.owner)) continue;
          return { problem: `${describe(e, o)}: de toewijzing met onbekende JSON-sleutels is niet aantoonbaar dezelfde als in de bron`, windows };
        }
        const target = at(`task_${assignment.taskId}`, e.pset, e.property);
        const key = output.assignmentKeys.get(assignment.id);
        const found = target && key !== undefined ? follow(tree(target), [{ sleutel: key }, ...o.path.slice(1)]) : 'onzeker';
        if (typeof found === 'string') return { problem: `${describe(e, o)}: het venster van toewijzing ${assignment.id} met onbekende JSON-sleutels staat niet eenduidig in de uitvoer`, windows };
        const problem = membersProblem(e, o, target!.text, found.node);
        if (problem) return { problem, windows };
        windows.push({ ownerStepId: target!.ownerStepId, key: key!, assignmentId: assignment.id });
        continue;
      }
      if (!ownerExists(input, e.owner)) continue;
      if (unchanged) continue;
      const found = place ? follow(tree(place), o.path) : 'absent';
      if (found === 'onzeker') return { problem: `${describe(e, o)}: het object met onbekende JSON-sleutels staat niet eenduidig in de uitvoer`, windows };
      if (found === 'absent') {
        const mirror = DOMAIN[propertyKey(e.pset, e.property)];
        if (mirror && !domainObject(mirror.get(input, e.owner), o.path)) continue;
        return { problem: `${describe(e, o)}: het object met onbekende JSON-sleutels bestaat nog in de planning, maar ontbreekt in de uitvoer`, windows };
      }
      const problem = membersProblem(e, o, place!.text, found.node);
      if (problem) return { problem, windows };
    }
  }
  return { windows };
}

export function jsonExtrasNext(found: readonly StepJsonExtras[], windows: readonly WindowBinding[]): JsonExtrasOfProperty[] | undefined {
  const bound = new Map(windows.map(w => [`${w.ownerStepId}\u0000${w.key}`, w.assignmentId]));
  return jsonExtrasIndex(found, (owner, key) => bound.get(`${owner}\u0000${key}`));
}

