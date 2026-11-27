import { isRecord } from '@/utils/guards';
import { checkValue, hasKey, NON_EMPTY_TEXT, type IfcxValue } from './fieldTable';
import { IfcxReadError, type IfcxErrorPlace } from './ifcxErrors';
import { decodeIfcx, parseIfcx } from './ifcxInput';
import { isModelPath } from './modelReferences';
import { OWN_ATTRIBUTE_VALUES } from './nodes';
import { ATTRIBUTE, OPS_NAMESPACE, PLANNING_NAMESPACE } from './profile';

export interface ForeignPlanningLoss {
  attributes: { attribute: string; count: number }[];
  fields: { attribute: string; field: string; count: number }[];
  workplans: string[];
  linkRelations: { relation: string; count: number }[];
}

export const LABEL = 'openaec::label';
export const LINKS = 'openaec::links';

export interface SourceNode {
  path: string;
  attributes: Map<string, Record<string, unknown>>;
  label?: string;
  links: string[];
}

export function invalidField(place: IfcxErrorPlace, detail: string): never {
  throw new IfcxReadError('invalid', detail, place);
}

function foreignSpec(spec: IfcxValue, sparse = false, task = false): IfcxValue {
  if (spec.dataType === 'Reference') return NON_EMPTY_TEXT;
  if (spec.dataType === 'Array') return { ...spec, item: foreignSpec(spec.item) };
  if (spec.dataType !== 'Object') return spec;
  return { ...spec, members: Object.fromEntries(Object.entries(spec.members).map(([key, member]) =>
    [key, { optional: sparse || member.optional, value: foreignSpec(member.value, task && key === 'time') }])) };
}

const specs = new Map<string, IfcxValue>([...OWN_ATTRIBUTE_VALUES]
  .filter(([name]) => name.startsWith(PLANNING_NAMESPACE) || name.startsWith(OPS_NAMESPACE))
  .map(([name, value]) => [name, foreignSpec(value, true, name === ATTRIBUTE.opsTask)]));

function knownPart(spec: IfcxValue, raw: unknown, fields: Set<string>, prefix = ''): unknown {
  if (spec.dataType === 'Array' && Array.isArray(raw)) return raw.map(v => knownPart(spec.item, v, fields, prefix + '[]'));
  if (spec.dataType !== 'Object' || !isRecord(raw)) return raw;
  const known: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(raw)) {
    const field = prefix ? prefix + '.' + key : key;
    if (hasKey(spec.members, key)) known[key] = knownPart(spec.members[key].value, raw[key], fields, field);
    else fields.add(field);
  }
  return known;
}

function addCount(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function taskLinks(raw: unknown, path: string, other: Map<string, number>): string[] {
  if (!Array.isArray(raw)) invalidField({ path, attribute: LINKS }, 'Verwacht een lijst koppelingen');
  const targets: string[] = [];
  for (const [index, link] of raw.entries()) {
    if (!isRecord(link) || typeof link.relation !== 'string') invalidField({ path, attribute: LINKS, field: `[${index}].relation` }, 'Verwacht een soort koppeling');
    if (link.relation !== 'schedules') addCount(other, link.relation);
    else {
      if (typeof link.target !== 'string' || !isModelPath(link.target)) invalidField({ path, attribute: LINKS, field: `[${index}].target` }, 'Verwacht een doelpad');
      targets.push(link.target);
    }
  }
  return targets;
}

export function readPlanningSource(input: string | Uint8Array) {
  const { header, data } = parseIfcx(typeof input === 'string' ? input : decodeIfcx(input));
  const byPath = new Map<string, Map<string, unknown>>();
  for (const entry of data) {
    if (!isRecord(entry) || typeof entry.path !== 'string' || !entry.path) invalidField({ field: 'path' }, 'Een entry heeft geen pad');
    const attrs = byPath.get(entry.path) ?? new Map<string, unknown>();
    byPath.set(entry.path, attrs);
    if (entry.attributes === undefined) continue;
    if (!isRecord(entry.attributes)) invalidField({ path: entry.path, field: 'attributes' }, 'Verwacht attributen op dit pad');
    for (const [name, value] of Object.entries(entry.attributes)) {
      if (name.startsWith(PLANNING_NAMESPACE) || specs.has(name) || name === LINKS || name === LABEL) attrs.set(name, value);
    }
  }

  const nodes: SourceNode[] = [];
  const unknownAttributes = new Map<string, number>();
  const unknownFields = new Map<string, Map<string, number>>();
  const otherLinks = new Map<string, number>();
  let hasKnown = false;
  for (const [path, attrs] of byPath) {
    if (![...attrs.keys()].some(name => name.startsWith(PLANNING_NAMESPACE))) continue;
    const node: SourceNode = { path, attributes: new Map(), links: [] };
    for (const [attribute, raw] of attrs) {
      const shared = attribute.startsWith(PLANNING_NAMESPACE);
      const spec = specs.get(attribute);
      if (!spec) {
        if (shared) addCount(unknownAttributes, attribute);
        continue;
      }
      if (shared) hasKnown = true;
      const extra = new Set<string>();
      const known = knownPart(spec, raw, extra);
      const problem = checkValue(spec, known);
      if (problem) invalidField({ path, attribute, field: problem.field || attribute }, problem.kind === 'invalid' ? problem.detail : 'Onbekend veld');
      node.attributes.set(attribute, known as Record<string, unknown>);
      if (shared && extra.size) {
        const counts = unknownFields.get(attribute) ?? new Map<string, number>();
        for (const field of extra) addCount(counts, field);
        unknownFields.set(attribute, counts);
      }
    }
    if (node.attributes.has(ATTRIBUTE.activity)) {
      if (attrs.has(LABEL)) {
        const label = attrs.get(LABEL);
        if (typeof label !== 'string') invalidField({ path, attribute: LABEL, field: LABEL }, 'Verwacht tekst');
        node.label = label;
      }
      if (attrs.has(LINKS)) node.links = taskLinks(attrs.get(LINKS), path, otherLinks);
    }
    nodes.push(node);
  }
  const leftBehind: ForeignPlanningLoss = {
    attributes: [...unknownAttributes].map(([attribute, count]) => ({ attribute, count })),
    fields: [...unknownFields].flatMap(([attribute, counts]) => [...counts].map(([field, count]) => ({ attribute, field, count }))),
    workplans: [], linkRelations: [...otherLinks].map(([relation, count]) => ({ relation, count })),
  };
  const planningContent = hasKnown ? 'known' : unknownAttributes.size ? 'unknown-only' : 'none';
  return { header, nodes, leftBehind, planningContent } as const;
}
