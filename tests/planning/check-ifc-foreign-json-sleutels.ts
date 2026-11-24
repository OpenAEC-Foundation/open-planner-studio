import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDeterminism } from './ifcPariteitKern';
import { cloneDomain, mergeProblems, openForeign, settle, type Domain, type Opened } from './ifcMergeKern';
import { storeEdit } from './ifcAppRoute';
import { MergeNeedsPhase2Error, prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import type { IfcSource, PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { scanStep, type StepIndex } from '@/services/ifc/foreign/stepScanner';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { JSON_PROPERTIES, jsonPropertyShape, type JsonShape } from '@/services/ifc/jsonRegister';
import {
  jsonExtrasFromIndex, jsonExtrasIndex, jsonMembersProblem, scanJsonExtras, unknownJsonMembers, withJsonInOutputForm,
} from '@/services/ifc/foreign/jsonExtrasSource';
import { jsonMembers, mergedJsonText } from '@/services/ifc/foreign/jsonMembers';
import { parseJsonTree, sameJsonValue, type JsonNode } from '@/services/ifc/jsonTokens';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reseed = installDeterminism();
const diffs: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };
const read = (rel: string) => new Uint8Array(readFileSync(join(ROOT, rel)));
const latin1 = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));
const text = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const show = (x: unknown) => JSON.stringify(x);

const JSON_VALUE = /^#(\d+)=IFCPROPERTYSINGLEVALUE\('([A-Za-z0-9_]+)',\$,IFCTEXT\('([[{](?:[^']|'')*)'\),\$\);$/gm;

function ownersOf(index: StepIndex, prop: number): { pset: string; owners: number[] }[] {
  const out: { pset: string; owners: number[] }[] = [];
  for (let k = index.inStart(prop); k < index.inEnd(prop); k++) {
    const pset = index.inSource(k);
    if (index.type(pset) !== 'IFCPROPERTYSET') continue;
    const owners: number[] = [];
    for (let j = index.inStart(pset); j < index.inEnd(pset); j++) {
      const rel = index.inSource(j);
      if (index.type(rel) === 'IFCRELDEFINESBYPROPERTIES') owners.push(...index.refsAt(rel, 4));
    }
    out.push({ pset: index.name(pset) ?? '', owners });
  }
  return out;
}

function jsonIn(bytes: Uint8Array, pset: string, property: string, ownerGuid?: string): string | undefined {
  const index = scanStep(bytes);
  const found: string[] = [];
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i) || index.type(i) !== 'IFCPROPERTYSINGLEVALUE' || index.name(i) !== property) continue;
    for (const p of ownersOf(index, i)) {
      if (p.pset !== pset) continue;
      if (ownerGuid !== undefined && !p.owners.some(o => index.globalId(o) === ownerGuid)) continue;
      found.push(index.propertyText(i) ?? '');
    }
  }
  return found.length === 1 ? found[0] : undefined;
}

function patchJson(s: string, property: string, edit: (json: string) => string): string {
  let hits = 0;
  const out = s.replace(new RegExp(`^(#\\d+=IFCPROPERTYSINGLEVALUE\\('${property}',\\$,IFCTEXT\\(')([[{](?:[^']|'')*)('\\),\\$\\);)$`, 'gm'),
    (_m, head: string, json: string, tail: string) => { hits++; return `${head}${edit(json)}${tail}`; });
  if (hits !== 1) throw new Error(`patchJson: ${hits} keer ${property}`);
  return out;
}

const rawKeys = (json: string): string[] => { const root = parseJsonTree(json); return root?.kind === 'object' ? root.members.map(m => m.key) : []; };

function memberOf(json: string | undefined, path: readonly (string | [string, string])[]): string | undefined {
  if (json === undefined) return undefined;
  let node: JsonNode | undefined = parseJsonTree(json);
  for (const step of path) {
    if (!node) return undefined;
    if (typeof step === 'string') {
      const hits: JsonNode[] = node.kind === 'object' ? node.members.filter(m => m.key === step).map(m => m.value) : [];
      node = hits.length === 1 ? hits[0] : undefined;
    } else {
      const [field, value] = step;
      const hits: JsonNode[] = node.kind === 'array' ? node.items.filter(item => item.kind === 'object'
        && item.members.some(m => m.key === field && m.value.kind === 'string' && m.value.value === value)) : [];
      node = hits.length === 1 ? hits[0] : undefined;
    }
  }
  return node ? json.slice(node.start, node.end) : undefined;
}

async function save(label: string, domain: Domain, source: IfcSource): Promise<PreparedIfcWrite | undefined> {
  try { return await prepareIfcWrite(domain, source); }
  catch (e) {
    if (!(e instanceof MergeNeedsPhase2Error)) throw e;
    ok(`${label}: verwacht schrijven, kreeg een weigering — ${e.cases.slice(0, 3).map(c => `${c.kind}: ${c.detail}`).join(' | ')}`, false);
    return undefined;
  }
}

async function refusal(domain: Domain, source: IfcSource): Promise<string> {
  try {
    await prepareIfcWrite(domain, source);
    return 'schreef';
  } catch (e) {
    if (!(e instanceof MergeNeedsPhase2Error)) throw e;
    return e.cases.map(c => `${c.kind}: ${c.detail}`).join(' | ');
  }
}

{
  const shapes: { where: string; shape: JsonShape }[] = [];
  const collect = (shape: JsonShape, where: string) => {
    shapes.push({ where, shape });
    if (shape.soort === 'object') for (const [k, s] of Object.entries(shape.sleutels)) collect(s, `${where}.${k}`);
    if (shape.soort === 'lijst') collect(shape.item, `${where}[]`);
    if (shape.soort === 'kaart') collect(shape.waarde, `${where}{}`);
  };
  for (const p of JSON_PROPERTIES) collect(p.shape, `${p.pset}.${p.property}`);
  const lists = shapes.filter(s => s.shape.soort === 'lijst' || s.shape.soort === 'kaart');
  const without = lists.filter(({ shape }) => shape.soort === 'lijst'
    ? shape.identiteit !== 'herkomstmerk' && !(typeof shape.identiteit === 'object' && shape.identiteit.veld)
    : shape.soort === 'kaart' && shape.identiteit !== 'sleutel' && shape.identiteit !== 'toewijzing');
  ok(`register: elke lijst en kaart heeft een identiteit (${without.map(s => s.where).join(', ')})`, without.length === 0 && lists.length > 10);
  const names = JSON_PROPERTIES.map(p => `${p.pset}.${p.property}`);
  ok('register: elke JSON-property staat er één keer in', new Set(names).size === names.length);
}

function shapeProblems(json: string, shape: JsonShape, where: string): string[] {
  const root = parseJsonTree(json);
  if (!root) return [`${where}: geen geldige JSON`];
  const problems: string[] = [];
  const scalar = (node: JsonNode) => node.kind !== 'object' && node.kind !== 'array';
  const walk = (node: JsonNode, at: JsonShape, path: string): void => {
    if (at.soort === 'doorgegeven') return;
    if (at.soort === 'waarde') { if (!scalar(node)) problems.push(`${path}: een ${node.kind === 'array' ? 'lijst' : 'object'} waar het register een losse waarde zegt`); return; }
    if (at.soort === 'reeks') {
      if (node.kind !== 'array' || !node.items.every(scalar)) problems.push(`${path}: geen reeks van losse waarden`);
      return;
    }
    if (at.soort === 'object') {
      if (node.kind !== 'object') { problems.push(`${path}: geen object`); return; }
      for (const m of node.members) {
        if (!Object.prototype.hasOwnProperty.call(at.sleutels, m.key)) problems.push(`${path}.${m.key}: de writer schrijft een sleutel die het register niet kent`);
        else walk(m.value, at.sleutels[m.key], `${path}.${m.key}`);
      }
      return;
    }
    if (at.soort === 'lijst') {
      if (node.kind !== 'array') { problems.push(`${path}: geen lijst`); return; }
      if (typeof at.identiteit === 'object') {
        const veld = at.identiteit.veld;
        const values = node.items.map(item => item.kind === 'object' ? item.members.find(m => m.key === veld)?.value : undefined);
        if (values.some(v => v?.kind !== 'string')) problems.push(`${path}: een item zonder sleutelveld ${veld}`);
        const keys = values.flatMap(v => v?.kind === 'string' ? [v.value] : []);
        if (new Set(keys).size !== keys.length) problems.push(`${path}: twee items met dezelfde waarde van sleutelveld ${veld}`);
      }
      node.items.forEach((item, k) => walk(item, at.item, `${path}[${k}]`));
      return;
    }
    if (node.kind !== 'object') { problems.push(`${path}: geen kaart`); return; }
    for (const m of node.members) walk(m.value, at.waarde, `${path}{${m.key}}`);
  };
  walk(root, shape, where);
  return problems;
}

function registerProblems(bytes: Uint8Array): { problems: string[]; seen: Set<string> } {
  const s = text(bytes);
  const index = scanStep(bytes);
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const m of s.matchAll(JSON_VALUE)) {
    const chunk = index.chunkOf(m[1]);
    const json = index.propertyText(chunk) ?? '';
    for (const { pset } of ownersOf(index, chunk)) {
      if (!pset.startsWith('OPS_')) continue;
      const shape = jsonPropertyShape(pset, m[2]);
      if (!shape) { problems.push(`${pset}.${m[2]}: de writer schrijft JSON die niet in het register staat`); continue; }
      seen.add(`${pset}.${m[2]}`);
      problems.push(...shapeProblems(json, shape, `${pset}.${m[2]}`));
    }
  }
  return { problems, seen };
}

function richDomain(): Domain {
  const d = readIFC(new TextDecoder().decode(read('public/examples/03-kantoorgebouw-zuidas.ifc'))) as unknown as Domain;
  const [t1, t2] = d.tasks.filter(t => !t.isSummary);
  const resource = d.resources[0];
  const calendar = { ...d.calendar, id: 'cal-proef-res', name: 'Proefkalender' };
  d.resourceCalendars = [...(d.resourceCalendars ?? []), calendar];
  t1.splitGaps = [{ afterMinutes: 480, gapMinutes: 480, source: 'user' }];
  t1.timephasedContours = [{ resourceUid: 1, resourceId: resource.id, periods: [{ afterMinutes: 0, minutes: 480, workMinutes: 480, kind: 'actual' }] }];
  t1.timephasedDurationWalks = [{ anchor: '2027-01-04T08:00:00', resourceCalendarId: calendar.id, workMinutes: 60 }];
  t1.customTaskTypeId = 'tt-proef';
  t1.taskType = 'USERDEFINED';
  d.customTaskTypes = [{ id: 'tt-proef', name: 'Proeftype', color: '#123456' }];
  d.assignments = [...d.assignments, {
    id: 'asgn-proef', taskId: t2.id, resourceId: resource.id, unitsPerDay: 1,
    workWindowStart: '2027-01-04T08:00:00', workWindowFinish: '2027-01-05T17:00:00', plannedWorkMinutes: 960, curveValues: [1, 2],
  }];
  resource.libraryOrigin = { companyId: 'c1', libraryItemId: 'r1', poolVersion: 3 };
  d.calendar = { ...d.calendar, libraryOrigin: { companyId: 'c1', libraryItemId: 'k1', poolVersion: 3 } };
  d.project = { ...d.project, schedulingProfile: builtInProfile('p6') };
  d.sequences = d.sequences.map((s, k) => k === 0 ? { ...s, p6StartAtPredecessorFinishBoundary: true } : s);
  d.libraryPool = {
    companyId: 'c1', companyName: 'Proef', poolVersion: 3, modifiedAt: '2026-11-24T00:00:00Z',
    calendars: [{ ...d.calendar, id: 'k1' }], resources: [{ ...resource, id: 'r1' }],
  };
  const [t3, t4] = d.tasks.filter(t => !t.isSummary && !t.isMilestone && t !== t1 && t !== t2);
  t3.time = { ...t3.time, durationUnit: 'days', scheduleDuration: 1.5 };
  t4.time = { ...t4.time, durationUnit: 'hours', durationMinutes: 90.5 };
  d.sequences = d.sequences.map((s, k) => k === 1 ? { ...s, lagDays: 1.5, lagMinutes: undefined }
    : k === 2 ? { ...s, lagMinutes: 90.5 } : s);
  d.calendar = { ...d.calendar, workingExceptions: [{ name: 'Zaterdag', startDate: '2027-01-09', endDate: '2027-01-09' }] };
  d.resourceCalendars = d.resourceCalendars.map(c => c.id === calendar.id ? { ...c, p6Source: 'XER', p6NonWorkPenaltyDates: ['2027-01-11'] } : c);
  return d;
}

{
  const files = readdirSync(join(ROOT, 'public/examples')).filter(f => f.endsWith('.ifc'));
  const seen = new Set<string>();
  for (const f of files) {
    reseed(11);
    const written = writeIFC(readIFC(new TextDecoder().decode(read(`public/examples/${f}`))));
    const r = registerProblems(new TextEncoder().encode(written));
    for (const p of r.seen) seen.add(p);
    ok(`register tegen ${f}: ${r.problems.slice(0, 4).join(' | ')}`, r.problems.length === 0);
  }
  reseed(11);
  const rich = registerProblems(new TextEncoder().encode(writeIFC(richDomain())));
  for (const p of rich.seen) seen.add(p);
  ok(`register tegen een domein met de overige JSON: ${rich.problems.slice(0, 4).join(' | ')}`, rich.problems.length === 0);
  const missing = JSON_PROPERTIES.map(p => `${p.pset}.${p.property}`).filter(p => !seen.has(p));
  ok(`register: de proef zag elke JSON-property uit het register geschreven (ontbreekt: ${missing.join(', ')})`, missing.length === 0);
}

{
  const big = '123456789012345678901234567890';
  ok('tokens: een groot geheel getal is als waarde gelijk aan zichzelf, niet aan zijn afronding',
    sameJsonValue(big, big) && !sameJsonValue(big, String(Number(big))));
  ok('tokens: sleutelvolgorde, getalnotatie en tekstcodering tellen niet als verschil',
    sameJsonValue('{"a":1.0,"b":"\\u00e9"}', '{"b":"é","a":1}'));
  ok('tokens: een dubbele sleutel is nooit gelijk', !sameJsonValue('{"a":1,"a":1}', '{"a":1,"a":1}'));
  const shape = jsonPropertyShape('OPS_StructureMeta', 'structure')!;
  const source = `{"vendorCoordinationId":"VC-1","activityCodeTypes":[{"id":"a","name":"Zone","values":[],"vendorX":${big}},`
    + '{"id":"d","name":"D1","values":[]},{"id":"d","name":"D2","values":[],"vendorY":1}],"customFieldDefs":[]}';
  const found = unknownJsonMembers(source, shape, () => false)!;
  ok(`extractie: de bovenste sleutel en de sleutel bij id a, niet bij het dubbele id d (${show(found)})`, show(found) === show([
    { path: [], members: [{ key: '"vendorCoordinationId"', value: '"VC-1"' }] },
    { path: [{ sleutel: 'activityCodeTypes' }, { veld: 'id', waarde: 'a' }], members: [{ key: '"vendorX"', value: big }] },
  ]));
  const merge = (source: string, read: string | undefined, written: string | undefined, exists?: () => boolean | undefined) => {
    const r = mergedJsonText(shape, source, read, written, exists);
    return 'refused' in r ? `geweigerd: ${r.refused}` : r.text;
  };
  const lid = '{"vendorFront":"F","activityCodeTypes":[{"id":"a","name":"Zone","values":[],"vendorX":' + big
    + '},{"id":"b","name":"Fase","values":[{"id":"v","code":"V1","\\u0063olor":"#ABC"}]}],"customFieldDefs":[] ,"vendorTail":{"code":1,"code":2}}';
  const read = '{"activityCodeTypes":[{"id":"a","name":"Zone","values":[]},{"id":"b","name":"Fase","values":[{"id":"v","code":"V1","color":"#ABC"}]}],"customFieldDefs":[]}';
  ok('per lid: niets gewijzigd, dan de bron zelf, met witruimte en al', merge(lid, read, read) === lid);
  const renamed = read.replace('"name":"Fase"', '"name":"Fase 2"');
  ok(`per lid: één naam gewijzigd, de rest houdt de tokens van de bron, ook sleutel en plaats van de onbekende paren (${merge(lid, read, renamed)})`,
    merge(lid, read, renamed) === lid.replace('"name":"Fase"', '"name":"Fase 2"').replace(',"customFieldDefs":[] ,', ',"customFieldDefs":[],'));
  const reordered = '{"activityCodeTypes":[{"id":"b","name":"Fase","values":[{"id":"v","code":"V1","color":"#ABC"}]},{"id":"a","name":"Zone","values":[]}],"customFieldDefs":[]}';
  ok(`per lid: de planner wisselde de volgorde, dan die van de writer met de tokens van de bron (${merge(lid, read, reordered)})`,
    merge(lid, read, reordered) === `{"vendorFront":"F","activityCodeTypes":[{"id":"b","name":"Fase","values":[{"id":"v","code":"V1","\\u0063olor":"#ABC"}]},{"id":"a","name":"Zone","values":[],"vendorX":${big}}],"customFieldDefs":[],"vendorTail":{"code":1,"code":2}}`);
  const withoutA = '{"activityCodeTypes":[{"id":"b","name":"Fase","values":[{"id":"v","code":"V1","color":"#ABC"}]}],"customFieldDefs":[]}';
  ok('per lid: een item met onbekende sleutels weg terwijl het nog bestaat, weigert', String(merge(lid, read, withoutA, () => true)).startsWith('geweigerd'));
  ok('per lid: een item met onbekende sleutels weg, en ook weg uit de planning, valt mee weg',
    merge(lid, read, withoutA, () => false) === `{"vendorFront":"F","activityCodeTypes":[{"id":"b","name":"Fase","values":[{"id":"v","code":"V1","\\u0063olor":"#ABC"}]}],"customFieldDefs":[],"vendorTail":{"code":1,"code":2}}`);
  ok('per lid: een item zonder iets extra weg, ook zonder bewijs', mergedJsonText(shape, read, read, withoutA).hasOwnProperty('text'));
  const clash = renamed.replace('"name":"Zone"', '"name":"Zone","vendorX":7');
  ok('per lid: de planning draagt een onbekende naam met een andere waarde, weigert', String(merge(lid, read, clash)).startsWith('geweigerd'));
  const twice = '{"activityCodeTypes":[{"id":"a","name":"Zone","values":[]},{"id":"a","name":"Zone","values":[]}],"customFieldDefs":[]}';
  ok('per lid: dubbel id ongewijzigd, dan de bron; gewijzigd, weigert', merge(twice, twice, twice) === twice && String(merge(twice, twice, renamed)).startsWith('geweigerd'));
  const series = { soort: 'reeks' } as const;
  const merged = (s: string, r: string, w: string) => { const x = mergedJsonText(series, s, r, w); return 'refused' in x ? 'geweigerd' : x.text; };
  ok('per lid: een reeks met dezelfde lengte per plaats, met een andere lengte weigert',
    merged('[1.0,2,3e0]', '[1,2,3]', '[1,5,3]') === '[1.0,5,3e0]' && merged('[1.0,2]', '[1,2]', '[1,2,3]') === 'geweigerd');
  const windowShape = (jsonPropertyShape('OPS_Timephased', 'Windows') as Extract<JsonShape, { soort: 'kaart' }>).waarde;
  const win = mergedJsonText(windowShape, '{"plannedWorkMinutes":48e1,"costAmount":5.0,"vendorW":"w"}', '{"plannedWorkMinutes":480,"costAmount":5}',
    '{"plannedWorkMinutes":480,"costAmount":6}');
  ok(`per lid: in een gewijzigd venster houdt een ongewijzigd getal zijn spelling (${show(win)})`,
    'text' in win && win.text === '{"plannedWorkMinutes":48e1,"costAmount":6,"vendorW":"w"}');
}

{
  const q = (s: string) => s.replace(/'/g, "''");
  const step = (lines: string[]) => new TextEncoder().encode(`ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\nFILE_SCHEMA(('IFC4X3_ADD2'));\nENDSEC;\nDATA;\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`);
  const synthetic = (n: number, form: 'bron' | 'lezing' | 'nu') => {
    const stepIds: Record<string, number> = {};
    const idMap = new Map<string, number>();
    const lines: string[] = [];
    let id = 1;
    const owner = (seed: string, key: string, line: (k: number) => string) => { const k = id++; stepIds[seed] = k; idMap.set(key, k); lines.push(line(k)); return k; };
    const property = (ownerId: number, pset: string, name: string, json: string, guid: string) => {
      const p = id++, set = id++, rel = id++;
      lines.push(`#${p}=IFCPROPERTYSINGLEVALUE('${name}',$,IFCTEXT('${q(json)}'),$);`,
        `#${set}=IFCPROPERTYSET('${guid.padStart(22, '1')}',$,'${pset}',$,(#${p}));`,
        `#${rel}=IFCRELDEFINESBYPROPERTIES('${guid.padStart(22, '2')}',$,$,$,(#${ownerId}),#${set});`);
    };
    const ws = owner('ws:w', '_worksched', k => `#${k}=IFCWORKSCHEDULE('0000000000000000000000',$,'W',$,$,$,$,$,$,$,$,$,$,$);`);
    const rows: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = owner(`task:t${i}`, `task_t${i}`, k => `#${k}=IFCTASK('${String(i).padStart(22, '0')}',$,$,$,$,$,$,$,$,$,$,$,$);`);
      property(t, 'OPS_TaskNotes', 'Notes', `[{"id":"n${i}","text":"${form === 'nu' ? 'test2' : 'test'}","done":false${form === 'bron' ? `,"vendorN":"v${i}"` : ''}}]`, `n${i}`);
      rows.push(`{"taskId":"t${i}","start":"2026-01-01"${form === 'bron' ? `,"vendorRow":${i}` : ''}}`);
    }
    property(ws, 'OPS_Baselines', 'Baselines', `[{"id":"b1","name":"${form === 'nu' ? 'B2' : 'B'}","tasks":[${rows.join(',')}]}]`, 'b');
    const window = (i: number) => `{"plannedWorkMinutes":${form === 'nu' ? 960 : form === 'bron' ? '480.0' : 480}${form === 'bron' ? `,"vendorW":"w${i}"` : ''}}`;
    const keys = Array.from({ length: n }, (_, i) => `R${String(i).padStart(21, '0')}#0`);
    const big = owner('task:big', 'task_big', k => `#${k}=IFCTASK('${'B'.repeat(22)}',$,$,$,$,$,$,$,$,$,$,$,$);`);
    const big2 = owner('task:big2', 'task_big2', k => `#${k}=IFCTASK('${'C'.repeat(22)}',$,$,$,$,$,$,$,$,$,$,$,$);`);
    const resources = keys.map(k => { const r = id++; lines.push(`#${r}=IFCCREWRESOURCE('${k.split('#')[0]}',$,$,$,$,$,$,$,$,$,$);`); return r; });
    lines.push(`#${id++}=IFCRELASSIGNSTOPROCESS('${'Z'.repeat(22)}',$,$,$,(${resources.map(r => `#${r}`).join(',')}),$,#${big},$);`);
    const stays = (i: number) => form !== 'nu' || i % 2 === 0;
    property(big, 'OPS_Timephased', 'Windows', `{${keys.flatMap((k, i) => stays(i) ? [`"${k}":${window(i)}`] : []).join(',')}}`, 'w');
    if (form === 'nu') property(big2, 'OPS_Timephased', 'Windows', `{${keys.flatMap((k, i) => stays(i) ? [] : [`"${k}":${window(i)}`]).join(',')}}`, 'x');
    return { lines, stepIds, idMap, index: scanStep(step(lines)), keys };
  };
  const domainOf = (n: number) => ({
    tasks: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, notes: [{ id: `n${i}`, text: 'test2', done: false }] })),
    resources: [], sequences: [], assignments: [], calendar: { id: 'c' }, resourceCalendars: [], project: {},
    baselines: [{ id: 'b1', name: 'B2', tasks: Array.from({ length: n }, (_, i) => ({ taskId: `t${i}`, start: '2026-01-01' })) }],
  }) as unknown as WriteIFCInput;
  const ARRAY_METHODS = ['filter', 'find', 'findIndex', 'some', 'every', 'map', 'forEach', 'flatMap', 'indexOf', 'includes', 'reduce'] as const;
  const counted = (f: () => void): number => {
    let work = 0;
    const proto = Array.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    const saved = ARRAY_METHODS.map(name => [name, proto[name]] as const);
    const map = Map.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    const mapSaved = (['get', 'has', 'set'] as const).map(name => [name, map[name]] as const);
    for (const [name, fn] of saved) proto[name] = function (this: unknown[], ...a: unknown[]) { work += this.length; return fn.apply(this, a); };
    for (const [name, fn] of mapSaved) map[name] = function (this: Map<unknown, unknown>, ...a: unknown[]) { work += 1; return fn.apply(this, a); };
    try { f(); } finally {
      for (const [name, fn] of saved) proto[name] = fn;
      for (const [name, fn] of mapSaved) map[name] = fn;
    }
    return work;
  };
  const round = (n: number) => {
    const src = synthetic(n, 'bron'), read0 = synthetic(n, 'lezing'), now = synthetic(n, 'nu');
    const plain = synthetic(n, 'lezing');
    const domain = domainOf(n);
    const own = () => true;
    const binding = new Map(src.keys.map((k, i) => [k, `a${i}`]));
    const work: Record<string, number> = {};
    let found = scanJsonExtras(src.index, own);
    work['openen zonder vreemde sleutels'] = counted(() => { if (scanJsonExtras(plain.index, own).length > 0) throw new Error('vreemde sleutels zonder sleutels'); });
    work['openen'] = counted(() => { found = scanJsonExtras(src.index, own); });
    const bigStep = src.stepIds['task:big'];
    const entries = jsonExtrasIndex(found, (owner, key) => owner === bigStep ? binding.get(key) : undefined);
    let sources = jsonExtrasFromIndex(src.index, entries, src.stepIds, 'c');
    work['een uitleesronde'] = counted(() => { sources = jsonExtrasFromIndex(src.index, entries, src.stepIds, 'c'); });
    const place = (id: string) => {
      const i = Number(id.slice(1));
      return { owner: i % 2 === 0 ? 'task_big' : 'task_big2', key: src.keys[i] };
    };
    const ctx = { place, readKey: (_owner: string, key: string) => key, exists: () => true };
    let merged = jsonMembers(read0, now, sources, ctx);
    work['per lid samenvoegen'] = counted(() => { merged = jsonMembers(read0, now, sources, ctx); });
    const texts = sources.map(x => ({ ...x, text: merged.expected.get(`${x.owner}\u0000${x.pset}\u0000${x.property}`) ?? x.text }));
    work['de planning in de vorm van de uitvoer'] = counted(() => { withJsonInOutputForm(domain, texts); });
    const output = synthetic(n, 'nu');
    const written = step(merged.written);
    let problem: string | undefined;
    work['eindcontrole'] = counted(() => { problem = jsonMembersProblem(merged.expected, { index: scanStep(written), stepIds: output.stepIds, projectCalendarId: 'c' }); });
    const out = new TextDecoder().decode(written);
    ok(`kosten bij ${n}: alle vreemde sleutels gevonden, per lid samengevoegd en gecontroleerd (${found.length}, ${sources.length}, ${problem})`,
      found.length === n + 2 && sources.length === n + 2 && problem === undefined
      && (out.match(/vendorN/g) ?? []).length === n && out.includes(`"vendorRow":${n - 1}`) && (out.match(/vendorW/g) ?? []).length === n
      && (out.match(/480\.0/g) ?? []).length === 0);
    return work;
  };
  const small = round(1000), large = round(10000);
  for (const step of Object.keys(small)) {
    const ratio = large[step] / Math.max(small[step], 1);
    ok(`kosten: ${step} groeit lineair in het werk, 10.000 tegen 1.000 taken en vensters ${large[step]} tegen ${small[step]} (verhouding ${ratio.toFixed(1)}, grens 13)`, ratio < 13);
  }
}

const eigen = text(await settle(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const TASK_GUID = '06AdBvh4v8lXgXlHO1$rfO';
const R109 = '3LKE2mEiGfOR4VMIq3h_xv';
const R110 = '34SuBObt1dKPNSent0osWG';
const R111 = '1XVcwxvomwVx$qDRoCxjQu';
const TASK_65_GUID = '2kDzoebYmR6NjQ7T17ccu7';
const BIG = '98765432109876543210987654321';

const taskOf = (o: Opened) => o.tasks.find(t => o.ifcSource!.stepIds[`task:${t.id}`] === 63)!;
const resOf = (o: Opened, step: number) => o.resources.find(r => o.ifcSource!.stepIds[`res:${r.id}`] === step)!;

let base: Uint8Array | undefined;
{
  const opened = await openForeign(latin1(eigen));
  const domain = cloneDomain(opened);
  domain.activityCodeTypes = [
    { id: 'act-zone', name: 'Zone', values: [{ id: 'acv-z1', code: 'Z1' }] },
    { id: 'act-fase', name: 'Fase', values: [{ id: 'acv-f1', code: 'F1' }] },
  ];
  const task = taskOf(opened);
  for (const a of domain.assignments.filter(x => x.taskId === task.id)) a.plannedWorkMinutes = 480;
  domain.tasks = domain.tasks.map(t => t.id === task.id ? { ...t, splitGaps: [{ afterMinutes: 480, gapMinutes: 480 }] } : t);
  domain.customTaskTypes = [{ id: 'tt-a', name: 'Type A', color: '#112233' }, { id: 'tt-b', name: 'Type B', color: '#445566' }];
  const typed = domain.tasks.filter(t => !t.isSummary && t.id !== task.id).slice(0, 3);
  domain.tasks = domain.tasks.map(t => {
    const k = typed.indexOf(t);
    return k < 0 ? t : { ...t, taskType: 'USERDEFINED', customTaskTypeId: k < 2 ? 'tt-a' : 'tt-b' };
  });
  const prepared = await save('basis: codetypen en vensters toevoegen', domain, opened.ifcSource!);
  if (prepared) base = prepared.bytes;
}
ok('basis: het opgeslagen bestand heeft OPS_StructureMeta, OPS_Baselines, de vensters en de onderbreking van #63',
  !!base && jsonIn(base, 'OPS_StructureMeta', 'structure') !== undefined && jsonIn(base, 'OPS_Baselines', 'Baselines') !== undefined
  && jsonIn(base, 'OPS_Timephased', 'Windows', TASK_GUID) !== undefined && jsonIn(base, 'OPS_TaskSplits', 'Splits', TASK_GUID) !== undefined);

if (base) {
  const baseText = text(base);
  const baselines = JSON.parse(jsonIn(base, 'OPS_Baselines', 'Baselines')!) as { id: string; tasks: { taskId: string }[] }[];
  const baselineId = baselines[0].id, rowTask = baselines[0].tasks[1].taskId;
  let s = patchJson(baseText, 'structure', j => j.replace(/\}$/, ',"vendorCoordinationId":"VC-0042"}')
    .replace('"id":"act-fase","name":"Fase",', `"id":"act-fase","vendorX":${BIG},"name":"Fase",`));
  s = patchJson(s, 'Baselines', j => j.replace(`"id":"${baselineId}",`, `"id":"${baselineId}","vendorBaselineRef":"BR-9",`)
    .replace(`{"taskId":"${rowTask}",`, `{"taskId":"${rowTask}","vendorRow":{"x":[1,2]},`));
  s = patchJson(s, 'Windows', j => j.replace(`"${R110}#1":{`, `"vendorMapNote":"m","${R110}#1":{"vendorW":"w-110",`));
  s = patchJson(s, 'TaskTypes', j => j.replace('"id":"tt-a","name":"Type A","color":"#112233"}', '"id":"tt-a","name":"Type A","color":"#112233","vendorRef":"opaque-aa"}'));
  const withExtras = latin1(s);
  ok('bron: de proefbewerking zette de onbekende sleutels erin', s !== baseText
    && memberOf(jsonIn(withExtras, 'OPS_StructureMeta', 'structure'), ['vendorCoordinationId']) === '"VC-0042"'
    && memberOf(jsonIn(withExtras, 'OPS_Timephased', 'Windows', TASK_GUID), [`${R110}#1`, 'vendorW']) === '"w-110"'
    && memberOf(jsonIn(withExtras, 'OPS_TaskTypes', 'TaskTypes'), ['definitions', ['id', 'tt-a'], 'vendorRef']) === '"opaque-aa"');
  {
    const opened = await openForeign(withExtras);
    const bound = (step: number) => opened.assignments.find(a => a.taskId === taskOf(opened).id && a.resourceId === resOf(opened, step).id)?.id;
    ok(`bron: de index noemt de JSON-eigenschappen met onbekende sleutels en elke vensterkaart, met de binding van elk venster (${show(opened.ifcSource?.jsonExtras)})`,
      opened.ifcSource?.jsonExtras?.length === 4
      && opened.ifcSource.jsonExtras.some(e => e.windows?.length === 2 && e.windows.some(w => w.key === `${R110}#1` && w.assignmentId === bound(110))
        && e.windows.some(w => w.key === `${R109}#0` && w.assignmentId === bound(109))));
  }

  type Want = { fase: boolean; baseline: boolean; window: readonly [string, string] | undefined };
  const all: Want = { fase: true, baseline: true, window: [TASK_GUID, `${R110}#1`] };
  const expectExtras = (label: string, bytes: Uint8Array, want: Want) => {
    const structure = jsonIn(bytes, 'OPS_StructureMeta', 'structure');
    const bl = jsonIn(bytes, 'OPS_Baselines', 'Baselines');
    const windows = jsonIn(bytes, 'OPS_Timephased', 'Windows', TASK_GUID);
    ok(`${label}: vendorCoordinationId in OPS_StructureMeta (${structure?.slice(-120)})`,
      memberOf(structure, ['vendorCoordinationId']) === '"VC-0042"');
    ok(`${label}: vendorX ${want.fase ? 'bij' : 'niet meer, met'} codetype act-fase, byte-gelijk`,
      want.fase ? memberOf(structure, ['activityCodeTypes', ['id', 'act-fase'], 'vendorX']) === BIG : !structure?.includes('vendorX'));
    ok(`${label}: vendorBaselineRef ${want.baseline ? 'bij' : 'niet meer, met'} baseline ${baselineId}`, want.baseline
      ? memberOf(bl, [['id', baselineId], 'vendorBaselineRef']) === '"BR-9"' : !bl?.includes('vendorBaselineRef'));
    ok(`${label}: vendorRow ${want.baseline ? 'bij' : 'niet meer, met'} de baselineregel van ${rowTask}`, want.baseline
      ? memberOf(bl, [['id', baselineId], 'tasks', ['taskId', rowTask], 'vendorRow']) === '{"x":[1,2]}'
      : !bl?.includes('vendorRow'));
    ok(`${label}: vendorMapNote bovenin Windows van #63 (${windows})`, memberOf(windows, ['vendorMapNote']) === '"m"');
    const target = want.window && jsonIn(bytes, 'OPS_Timephased', 'Windows', want.window[0]);
    ok(`${label}: vendorW bij de toewijzing van #110 onder ${want.window?.join(' ')} (${target})`,
      want.window === undefined ? !text(bytes).includes('vendorW') : memberOf(target, [want.window[1], 'vendorW']) === '"w-110"'
        && text(bytes).split('vendorW').length === 2);
    ok(`${label}: vendorRef bij taaktype A`, memberOf(jsonIn(bytes, 'OPS_TaskTypes', 'TaskTypes'), ['definitions', ['id', 'tt-a'], 'vendorRef']) === '"opaque-aa"');
  };

  type Edit = (d: Domain, o: Opened) => void | Domain | Promise<void | Domain>;
  const scenario = async (label: string, edit: Edit, want: Want, source = withExtras) => {
    const opened = await openForeign(source);
    let domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef JSON-sleutels)`;
    const edited = await edit(domain, opened);
    if (edited) domain = edited;
    const prepared = await save(label, domain, opened.ifcSource!);
    if (!prepared) return undefined;
    const problems = mergeProblems(source, prepared.bytes);
    ok(`${label}: de invarianten van de merge (${problems.slice(0, 2).join(' | ')})`, problems.length === 0);
    expectExtras(label, prepared.bytes, want);
    const again = await openForeign(prepared.bytes);
    const next = cloneDomain(again);
    next.project.description = `${next.project.description} (tweede opslag)`;
    const second = await save(`${label}, heropenen en nog eens opslaan`, next, again.ifcSource!);
    if (second) expectExtras(`${label}, tweede opslag`, second.bytes, want);
    return { prepared, domain };
  };
  const refuses = async (label: string, edit: Edit, pattern: RegExp, source = withExtras) => {
    const opened = await openForeign(source);
    let domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef weigering)`;
    const edited = await edit(domain, opened);
    if (edited) domain = edited;
    const verdict = await refusal(domain, opened.ifcSource!);
    ok(`${label}: weigert (${verdict.slice(0, 260)})`, pattern.test(verdict));
  };
  const asgn = (d: Domain, o: Opened, step: number) => d.assignments.find(a => a.taskId === taskOf(o).id && a.resourceId === resOf(o, step).id)!;

  await scenario('alleen herschrijven', () => {}, all);
  await scenario('de omschrijving van een codewaarde van een ander codetype', d => {
    d.activityCodeTypes = d.activityCodeTypes!.map(t => t.id === 'act-zone'
      ? { ...t, values: t.values.map(v => ({ ...v, description: 'Kelder' })) } : t);
  }, all);
  await scenario('het codetype met de vreemde sleutel opnieuw opgebouwd, met een omschrijving bij zijn waarde', d => {
    d.activityCodeTypes = d.activityCodeTypes!.map(t => t.id === 'act-fase'
      ? { id: t.id, name: t.name, values: t.values.map(v => ({ id: v.id, code: v.code, description: 'Ruwbouw' })) } : t);
  }, all);
  await scenario('via de store: de omschrijving van een codewaarde', async d => storeEdit(d, st => {
    st.updateActivityCodeValue('act-fase', 'acv-f1', { description: 'Afbouw' });
  }), all);
  await scenario('een ander codetype hernoemen', d => {
    d.activityCodeTypes = d.activityCodeTypes!.map(t => t.id === 'act-zone' ? { ...t, name: 'Zone (nieuw)' } : t);
  }, all);
  await scenario('via de store: een ander codetype hernoemen', async d => storeEdit(d, st => {
    st.renameActivityCodeType('act-zone', 'Zone (store)');
  }), all);
  await scenario('via de store: het codetype met de vreemde sleutel wissen', async d => storeEdit(d, st => {
    st.removeActivityCodeType('act-fase');
  }), { ...all, fase: false });
  await scenario('via de store: de baseline met de vreemde sleutels hernoemen', async d => storeEdit(d, st => {
    st.renameBaseline(baselineId, 'Baseline plan (hernoemd)');
  }), all);
  await scenario('via de store: de baseline met de vreemde sleutels wissen', async d => storeEdit(d, st => {
    st.deleteBaseline(baselineId);
  }), { ...all, baseline: false });
  await scenario('een baseline erbij', d => {
    const first = d.baselines![0];
    d.baselines = [...d.baselines!, { ...structuredClone(first), id: 'baseline-proef', name: 'Tweede', tasks: first.tasks.map(t => ({ taskId: t.taskId, start: t.start, finish: t.finish, duration: t.duration, isMilestone: t.isMilestone })) }];
  }, all);
  await scenario('de baselineregels in een andere volgorde, met de regels opnieuw opgebouwd', d => {
    d.baselines = d.baselines!.map(b => b.id === baselineId ? { ...b, tasks: [...b.tasks].reverse().map(t => ({ taskId: t.taskId, start: t.start, finish: t.finish, duration: t.duration, isMilestone: t.isMilestone, ...(t.milestoneKind ? { milestoneKind: t.milestoneKind } : {}) })) } : b);
  }, all);

  await scenario('toewijzing: de eerste toewijzing van #63 weg, vendorW schuift mee naar de nieuwe sleutel', (d, o) => {
    d.assignments = d.assignments.filter(a => a !== asgn(d, o, 109));
  }, { ...all, window: [TASK_GUID, `${R110}#0`] });
  await scenario('toewijzing: Verplaats naar… taak #65, vendorW gaat mee met de toewijzing', async (d, o) => {
    const id = asgn(d, o, 110).id;
    return storeEdit(d, st => { st.moveAssignment(id, o.tasks.find(t => o.ifcSource!.stepIds[`task:${t.id}`] === 65)!.id); });
  }, { ...all, window: [TASK_65_GUID, `${R110}#0`] });
  await scenario('toewijzing: een andere resource met behoud van de toewijzing, vendorW blijft bij de toewijzing', (d, o) => {
    const a = asgn(d, o, 110);
    d.assignments = d.assignments.map(x => x === a ? { ...x, resourceId: resOf(o, 111).id } : x);
  }, { ...all, window: [TASK_GUID, `${R111}#1`] });
  await scenario('toewijzing: een tweede toewijzing van dezelfde resource erbij, vendorW blijft bij de eerste', (d, o) => {
    d.assignments = [...d.assignments, { ...asgn(d, o, 110), id: 'asgn-tweede' }];
  }, all);
  await refuses('toewijzing: de toewijzing van #110 wissen (zoals main, nooit raden)', (d, o) => {
    d.assignments = d.assignments.filter(a => a !== asgn(d, o, 110));
  }, /^(uitvoer-controle|niet-gedragen): .*Windows/);
  await refuses('toewijzing: via de store wissen en dezelfde resource opnieuw toewijzen (zoals main, nooit raden)', async (d, o) => {
    const a = asgn(d, o, 110);
    return storeEdit(d, st => { st.unassignResource(a.id); st.assignResource(a.taskId, a.resourceId, a.unitsPerDay); });
  }, /^(uitvoer-controle|niet-gedragen): .*Windows/);
  {
    const opened = await openForeign(withExtras);
    const domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef zelfde data)`;
    const a = asgn(domain, opened, 110);
    domain.assignments = [...domain.assignments.filter(x => x !== a), { ...a, id: 'asgn-opnieuw' }];
    const verdict = await refusal(domain, opened.ifcSource!);
    const prepared = verdict === 'schreef' ? await prepareIfcWrite(domain, opened.ifcSource!) : undefined;
    ok(`toewijzing: een vervangende toewijzing met exact dezelfde vensterdata: het ongewijzigde venster blijft byte-gelijk staan, zoals main (${verdict.slice(0, 160)})`,
      verdict === 'schreef'
        && jsonIn(prepared!.bytes, 'OPS_Timephased', 'Windows', TASK_GUID) === jsonIn(withExtras, 'OPS_Timephased', 'Windows', TASK_GUID));
  }
  await refuses('toewijzing: een ander toewijzings-id (zoals na herstel) en een bewerking van het venster', (d, o) => {
    const a = asgn(d, o, 110);
    d.assignments = d.assignments.map(x => x === a ? { ...x, id: 'asgn-na-herstel', plannedWorkMinutes: 960 } : x);
  }, /^(uitvoer-controle|niet-gedragen): .*Windows/);
  {
    const opened = await openForeign(withExtras);
    const domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef ander id)`;
    const a = asgn(domain, opened, 110);
    domain.assignments = domain.assignments.map(x => x === a ? { ...x, id: 'asgn-na-herstel' } : x);
    const verdict = await refusal(domain, opened.ifcSource!);
    const prepared = verdict === 'schreef' ? await prepareIfcWrite(domain, opened.ifcSource!) : undefined;
    const windows = prepared && jsonIn(prepared.bytes, 'OPS_Timephased', 'Windows', TASK_GUID);
    ok(`toewijzing: een ander toewijzings-id (zoals na herstel) zonder bewerking van het venster: het venster blijft byte-gelijk, zoals main (${verdict.slice(0, 160)})`,
      verdict === 'schreef' && windows === jsonIn(withExtras, 'OPS_Timephased', 'Windows', TASK_GUID));
  }

  await refuses('taaktype: het laatste gebruik van type A weg, terwijl A in de catalogus blijft (zoals main)', d => {
    d.tasks = d.tasks.map(t => t.customTaskTypeId === 'tt-a' ? { ...t, customTaskTypeId: 'tt-b' } : t);
  }, /^niet-gedragen: IFCPROPERTYSINGLEVALUE #\d+ \(TaskTypes\)/);
  {
    const opened = await openForeign(withExtras);
    const domain = cloneDomain(opened);
    domain.tasks = domain.tasks.map(t => t.customTaskTypeId === 'tt-a' ? { ...t, customTaskTypeId: 'tt-b' } : t);
    domain.customTaskTypes = domain.customTaskTypes!.filter(t => t.id !== 'tt-a');
    const prepared = await save('taaktype: type A uit de catalogus gewist', domain, opened.ifcSource!);
    if (prepared) ok('taaktype: type A uit de catalogus gewist: vendorRef vervalt met de definitie', !text(prepared.bytes).includes('opaque-aa'));
  }

  {
    const opened = await openForeign(withExtras);
    const domain = cloneDomain(opened);
    domain.activityCodeTypes = domain.activityCodeTypes!.map(t => t.id === 'act-fase' ? { ...t, vendorX: 7 } as typeof t : t);
    const prepared = await save('de planning wijzigde de waarde van een gedragen vreemde sleutel', domain, opened.ifcSource!);
    const structure = prepared && jsonIn(prepared.bytes, 'OPS_StructureMeta', 'structure');
    if (prepared) ok(`de planning wijzigde de waarde van een gedragen vreemde sleutel: één keer, met de nieuwe waarde (${structure})`,
      memberOf(structure, ['activityCodeTypes', ['id', 'act-fase'], 'vendorX']) === '7' && (structure!.match(/vendorX/g) ?? []).length === 1);
  }
  await refuses('geen plek: zonder codetypen en velden schrijft de writer geen OPS_StructureMeta', d => {
    d.activityCodeTypes = [];
    d.customFieldDefs = [];
  }, /./);
  await refuses('geen plek: zonder vensterdata schrijft de writer geen Windows voor #63', (d, o) => {
    d.assignments = d.assignments.map(a => a.taskId === taskOf(o).id ? { ...a, plannedWorkMinutes: undefined } : a);
  }, /^niet-gedragen: IFCPROPERTYSINGLEVALUE #\d+ \(Windows\)/);

  const front = latin1(patchJson(baseText, 'structure', j => j.replace(/^\{/, '{"vendorFront":"F",')));
  {
    const opened = await openForeign(front);
    const domain = cloneDomain(opened);
    domain.activityCodeTypes = domain.activityCodeTypes!.map(t => t.id === 'act-zone' ? { ...t, values: t.values.map(v => ({ ...v, description: 'Kelder' })) } : t);
    const prepared = await save('grens: een onbekende sleutel vooraan, de omschrijving van een codewaarde', domain, opened.ifcSource!);
    if (prepared) ok('een onbekende sleutel vooraan, de omschrijving van een codewaarde: de sleutel blijft vooraan, zoals in de bron',
      jsonIn(prepared.bytes, 'OPS_StructureMeta', 'structure')?.startsWith('{"vendorFront":"F",') === true);
  }
  {
    const opened = await openForeign(front);
    const domain = cloneDomain(opened);
    domain.activityCodeTypes = domain.activityCodeTypes!.map(t => t.id === 'act-zone' ? { ...t, name: 'Zone (nieuw)' } : t);
    const prepared = await save('een onbekende sleutel vooraan en een codetype hernoemen', domain, opened.ifcSource!);
    const structure = prepared && jsonIn(prepared.bytes, 'OPS_StructureMeta', 'structure');
    if (prepared) ok(`een onbekende sleutel vooraan en een codetype hernoemen: de sleutel blijft vooraan, de nieuwe naam staat erin (${structure})`,
      structure!.startsWith('{"vendorFront":"F",') && memberOf(structure, ['activityCodeTypes', ['id', 'act-zone'], 'name']) === '"Zone (nieuw)"');
  }

  const minusZero = latin1(patchJson(baseText, 'Windows', j => j.replace(`"${R109}#0":{"plannedWorkMinutes":480}`, `"${R109}#0":{"plannedWorkMinutes":-0}`)));
  {
    ok('-0: de proefbewerking zette -0 in het venster van #109', text(minusZero).includes('"plannedWorkMinutes":-0'));
    const opened = await openForeign(minusZero);
    const domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef -0)`;
    const prepared = await save('-0: alleen de projectbeschrijving', domain, opened.ifcSource!);
    if (prepared) ok(`-0: het ongewijzigde venster houdt -0 (${jsonIn(prepared.bytes, 'OPS_Timephased', 'Windows', TASK_GUID)})`,
      jsonIn(prepared.bytes, 'OPS_Timephased', 'Windows', TASK_GUID)?.includes('"plannedWorkMinutes":-0') === true);
  }
  {
    const opened = await openForeign(minusZero);
    const domain = cloneDomain(opened);
    const a = asgn(domain, opened, 110);
    domain.assignments = domain.assignments.map(x => x === a ? { ...x, plannedWorkMinutes: 960 } : x);
    const verdict = await refusal(domain, opened.ifcSource!);
    const prepared = verdict === 'schreef' ? await prepareIfcWrite(domain, opened.ifcSource!) : undefined;
    const windows = prepared && jsonIn(prepared.bytes, 'OPS_Timephased', 'Windows', TASK_GUID);
    ok(`-0: een ander venster in dezelfde eigenschap gewijzigd: weigert, of het venster van #109 houdt -0 (${verdict.slice(0, 160)} ${windows ?? ''})`,
      verdict === 'schreef' ? windows?.includes(`"${R109}#0":{"plannedWorkMinutes":-0}`) === true : /Windows/.test(verdict));
  }

  {
    const opened = await openForeign(base);
    const domain = cloneDomain(opened);
    const a = asgn(domain, opened, 110);
    const task65 = domain.tasks.find(t => opened.ifcSource!.stepIds[`task:${t.id}`] === 65)!;
    domain.assignments = [...domain.assignments, { ...a, id: 'asgn-op-65', taskId: task65.id }];
    const grown = await save('omwisselen: bron met #110 op #63 en #65', domain, opened.ifcSource!);
    if (grown) {
      let swapText = text(grown.bytes);
      for (const [guid, mark] of [[TASK_GUID, 'proef-63'], [TASK_65_GUID, 'proef-65']] as const) {
        const json = jsonIn(grown.bytes, 'OPS_Timephased', 'Windows', guid)!;
        const key = rawKeys(json).find(k => k.startsWith(`${R110}#`))!;
        const step = (v: string) => v.replace(/'/g, "''");
        swapText = swapText.replace(`IFCTEXT('${step(json)}')`, `IFCTEXT('${step(json.replace(`"${key}":{`, `"${key}":{"vendorOpaque":"${mark}",`))}')`);
      }
      for (const split of [true, false]) {
        let extra = '';
        const original = swapText;
        if (split) swapText = swapText.replace(/^(#\d+)=IFCRELASSIGNSTOPROCESS\('([^']+)',(#\d+),\$,\$,\(([^)]*)\),\$,#(63|65),\$\);$/gm,
          (line, id: string, guid: string, history: string, members: string, task: string) => {
            const list = members.split(',');
            if (!list.includes('#110') || list.length < 2) return line;
            extra += `\n#300${task}=IFCRELASSIGNSTOPROCESS('${task === '63' ? '2zzzzzzzzzzzzzzzzzzzzz' : '2yyyyyyyyyyyyyyyyyyyyy'}',${history},$,$,(#110),$,#${task},$);`;
            return `${id}=IFCRELASSIGNSTOPROCESS('${guid}',${history},$,$,(${list.filter(m => m !== '#110').join(',')}),$,#${task},$);`;
          });
        const swapBytes = latin1(swapText.replace(/\nENDSEC;\nEND-ISO-10303-21;/, `${extra}\nENDSEC;\nEND-ISO-10303-21;`));
        swapText = original;
        const label = split ? 'omwisselen met gesplitste relaties' : 'omwisselen';
        const start = await openForeign(swapBytes);
        const a63 = start.assignments.find(x => x.taskId === taskOf(start).id && x.resourceId === resOf(start, 110).id)!;
        const t65 = start.tasks.find(t => start.ifcSource!.stepIds[`task:${t.id}`] === 65)!;
        const b65 = start.assignments.find(x => x.taskId === t65.id && x.resourceId === a63.resourceId)!;
        const third = start.tasks.find(t => t.id !== a63.taskId && t.id !== t65.id && !t.isMilestone && t.childIds.length === 0
          && !start.assignments.some(x => x.taskId === t.id && x.resourceId === a63.resourceId))!;
        ok(`${label}: de bron heeft beide markeringen en beide bindingen`, text(swapBytes).includes('proef-63') && text(swapBytes).includes('proef-65')
          && (start.ifcSource?.jsonExtras ?? []).flatMap(e => e.windows ?? []).some(w => w.assignmentId === a63.id)
          && (start.ifcSource?.jsonExtras ?? []).flatMap(e => e.windows ?? []).some(w => w.assignmentId === b65.id));
        const swapped = await storeEdit(cloneDomain(start), st => {
          if (!st.moveAssignment(a63.id, third.id)) throw new Error('omwisselen: stap 1');
        }).then(d => storeEdit(d, st => { if (!st.moveAssignment(b65.id, a63.taskId)) throw new Error('omwisselen: stap 2'); }))
          .then(d => storeEdit(d, st => { if (!st.moveAssignment(a63.id, t65.id)) throw new Error('omwisselen: stap 3'); }));
        const verdict = await refusal(swapped, start.ifcSource!);
        const out = verdict === 'schreef' ? await prepareIfcWrite(swapped, start.ifcSource!) : undefined;
        const w63 = out && jsonIn(out.bytes, 'OPS_Timephased', 'Windows', TASK_GUID), w65 = out && jsonIn(out.bytes, 'OPS_Timephased', 'Windows', TASK_65_GUID);
        const follows = w65?.includes('proef-63') === true && w63?.includes('proef-65') === true && !w63.includes('proef-63') && !w65.includes('proef-65');
        ok(`${label} (ronde 2, blokkade 1): ${split ? 'elke markering volgt haar toewijzing, of het opslaan weigert zoals main bij elke wijziging' : 'elke markering volgt haar toewijzing'} (${verdict.slice(0, 160)} | ${w63} | ${w65})`,
          split ? (verdict === 'schreef' ? follows : /^(niet-eenduidig|niet-gedragen|uitvoer-controle):/.test(verdict)) : follows);
      }
    }
  }
  {
    const opened = await openForeign(base);
    const t63 = taskOf(opened).id;
    let costId = '';
    const withCost = await storeEdit(cloneDomain(opened), st => {
      const res = st.addResource({ name: 'Leges', type: 'COST', description: '', maxUnits: 1 } as never);
      st.assignResource(t63, res, 1, undefined, 50);
    });
    const grown = await save('kosten: bron met een kostentoewijzing op #63', withCost, opened.ifcSource!);
    if (grown) {
      for (const vendor of [false, true]) {
        const patched = latin1(patchJson(text(grown.bytes), 'Windows', j => {
          const next = j.replace(`"${R109}#0":{"plannedWorkMinutes":480}`, `"${R109}#0":{"plannedWorkMinutes":480.0}`);
          return vendor ? next.replace(`"${R110}#1":{`, `"${R110}#1":{"vendorW":"w",`) : next;
        }));
        const start = await openForeign(patched);
        costId = start.assignments.find(x => x.taskId === taskOf(start).id && x.costAmount === 50)!.id;
        const edited = await storeEdit(cloneDomain(start), st => st.setAssignmentCost(costId, 75));
        const verdict = await refusal(edited, start.ifcSource!);
        const out = verdict === 'schreef' ? await prepareIfcWrite(edited, start.ifcSource!) : undefined;
        const windows = out && jsonIn(out.bytes, 'OPS_Timephased', 'Windows', TASK_GUID);
        if (!vendor) {
          ok(`kosten 50 → 75 naast 480.0, zonder vreemde sleutel (ronde 2, blokkade 2): weigert zoals main, of houdt 480.0 (${verdict.slice(0, 160)} ${windows ?? ''})`,
            verdict === 'schreef' ? windows?.includes('"plannedWorkMinutes":480.0') === true : /^niet-gedragen: .*Windows/.test(verdict));
        } else {
          ok(`kosten 50 → 75 naast 480.0, met een vreemde sleutel in de kaart: schrijft 75 en houdt 480.0 en de sleutel (${verdict.slice(0, 160)} ${windows ?? ''})`,
            windows !== undefined && windows.includes('"plannedWorkMinutes":480.0') && windows.includes('"costAmount":75') && windows.includes('"vendorW":"w"'));
        }
      }
    }
  }
  {
    const opened = await openForeign(base);
    const t63 = taskOf(opened).id;
    const noted = cloneDomain(opened);
    noted.tasks = noted.tasks.map(t => t.id === t63 ? { ...t, notes: [{ id: 'n1', text: 'eerste', done: false }] } : t);
    const grown = await save('notitie: bron met een notitie op #63', noted, opened.ifcSource!);
    if (grown) {
      const patched = latin1(patchJson(text(grown.bytes), 'Notes', j => j.replace('[{"id":"n1"', '[{"\\\\u0076endorFlag":true,"id":"n1"')));
      ok('notitie: de proefbewerking zette de sleutel als escape vooraan', text(patched).includes('"\\\\u0076endorFlag"'));
      const start = await openForeign(patched);
      const edited = await storeEdit(cloneDomain(start), st => {
        const id = taskOf(start).id;
        st.updateTask(id, { notes: st.tasks.find(t => t.id === id)!.notes!.map(n => ({ ...n, done: true })) });
      });
      const out = await save('notitie afvinken met een vreemde sleutel als escape', edited, start.ifcSource!);
      const notes = out && jsonIn(out.bytes, 'OPS_TaskNotes', 'Notes', TASK_GUID);
      if (out) ok(`notitie afvinken (ronde 2, vervolg): het sleuteltoken en zijn plaats blijven (${notes})`, notes === '[{"\\u0076endorFlag":true,"id":"n1","text":"eerste","done":true}]');
    }
  }

  const opaque = latin1(patchJson(baseText, 'structure', j => j.replace(/\}$/, ',"vendorOpaque":{"code":1,"code":2},"vendorText":"\\X2\\00E9\\X0\\"}')));
  for (const [label, edit] of [
    ['alleen de projectbeschrijving', (_d: Domain) => {}],
    ['een ander codetype hernoemen', (d: Domain) => { d.activityCodeTypes = d.activityCodeTypes!.map(t => t.id === 'act-zone' ? { ...t, name: 'Zone (nieuw)' } : t); }],
  ] as const) {
    const opened = await openForeign(opaque);
    const domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef dubbele sleutels)`;
    edit(domain);
    const prepared = await save(`dubbele sleutels in een onbekend token, ${label}`, domain, opened.ifcSource!);
    if (prepared) ok(`dubbele sleutels in een onbekend token, ${label}: het token komt byte-gelijk terug`,
      memberOf(jsonIn(prepared.bytes, 'OPS_StructureMeta', 'structure'), ['vendorOpaque']) === '{"code":1,"code":2}');
    if (prepared) ok(`een letterlijk teken in een onbekend token, ${label}: geschreven zoals in de bron, niet als escape (${memberOf(jsonIn(prepared.bytes, 'OPS_StructureMeta', 'structure'), ['vendorText'])})`,
      memberOf(jsonIn(prepared.bytes, 'OPS_StructureMeta', 'structure'), ['vendorText']) === '"\u00e9"');
  }
}

if (base) {
  const splits = latin1(patchJson(text(base), 'Splits', j => j.replace('{"afterMinutes":480,', '{"vendorReason":"R1","afterMinutes":480,')));
  const reason = (bytes: Uint8Array) => jsonIn(bytes, 'OPS_TaskSplits', 'Splits', TASK_GUID);
  ok(`grens (knownbug 2218), Splits: de proefbewerking zette vendorReason in de onderbreking (${reason(splits)})`, !!reason(splits)?.includes('vendorReason'));
  {
    const opened = await openForeign(splits);
    const domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef Splits)`;
    const prepared = await save('grens (knownbug 2218), Splits: een andere bewerking', domain, opened.ifcSource!);
    if (prepared) ok(`grens (knownbug 2218), Splits: zonder bewerking van de onderbreking blijft de bron staan (${reason(prepared.bytes)})`,
      reason(prepared.bytes) === reason(splits));
  }
  {
    const opened = await openForeign(splits);
    const domain = cloneDomain(opened);
    domain.tasks = domain.tasks.map(t => t.id === taskOf(opened).id ? { ...t, splitGaps: [{ afterMinutes: 480, gapMinutes: 960 }] } : t);
    const verdict = await refusal(domain, opened.ifcSource!);
    ok(`grens (knownbug 2218), Splits: een lijst zonder sleutelveld heeft nog geen identiteit, een bewerking weigert zoals op main (${verdict.slice(0, 200)})`,
      /^niet-gedragen: IFCPROPERTYSINGLEVALUE #\d+ \(Splits\)/.test(verdict));
  }
}

{
  const own = readIFC(new TextDecoder().decode(read('public/examples/showcase-rijwoningen-de-akkers.ifc'))) as unknown as Domain;
  reseed(5);
  const ownText = writeIFC(own);
  const withKey = patchJson(ownText, 'structure', j => j.replace(/^\{/, '{"vendorCoordinationId":"VC-1",'));
  reseed(5);
  const plainWithout = writeIFC(readIFC(ownText));
  reseed(5);
  const plainWith = writeIFC(readIFC(withKey));
  ok('flag uit (de route van main): met de onbekende sleutel dezelfde bytes als zonder, zoals op main', plainWith === plainWithout);
  const opened = await openForeign(new TextEncoder().encode(withKey));
  ok('flag aan zonder vreemd deel: geen vreemd deel, en de bron heeft geen veld voor onbekende JSON-sleutels',
    opened.ifcSource?.foreign === false && !('jsonExtras' in (opened.ifcSource ?? {})));
  const domain = cloneDomain(opened);
  const prepared = await prepareIfcWrite(domain, opened.ifcSource!);
  ok('flag aan zonder vreemd deel: opslaan geeft de bytes van de gewone writer, zonder de onbekende sleutel',
    new TextDecoder().decode(prepared.bytes) === writeIFC(domain) && !new TextDecoder().decode(prepared.bytes).includes('vendorCoordinationId'));
}

if (diffs.length > 0) {
  console.log(`XX  ifc-foreign-json-sleutels: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 60)) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-json-sleutels: alle checks groen (${checks})`);
process.exit(0);
