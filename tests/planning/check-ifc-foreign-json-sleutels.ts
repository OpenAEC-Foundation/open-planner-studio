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
import { unknownJsonMembers, withJsonExtras, withJsonMembers } from '@/services/ifc/jsonExtras';
import {
  jsonExtrasForWriter, jsonExtrasFromIndex, jsonExtrasIndex, jsonExtrasProblem, scanJsonExtras, withJsonExtrasInDomain,
} from '@/services/ifc/foreign/jsonExtrasSource';
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
  const writer = '{"activityCodeTypes":[{"id":"b","name":"Fase","values":[]},{"id":"a","name":"Zone 2","values":[]}],"customFieldDefs":[]}';
  const back = withJsonMembers(writer, found, () => undefined);
  ok(`terugzetten: in hetzelfde object, na de bekende sleutels (${back})`, back
    === `{"activityCodeTypes":[{"id":"b","name":"Fase","values":[]},{"id":"a","name":"Zone 2","values":[],"vendorX":${big}}],"customFieldDefs":[],"vendorCoordinationId":"VC-1"}`);
  ok('terugzetten: zonder onbekende sleutels blijft de tekst van de writer', withJsonMembers(writer, [], () => undefined) === writer);
  const carried = '{"activityCodeTypes":[{"id":"a","name":"Zone","values":[],"vendorX":1.2345678901234568e+29}],"customFieldDefs":[]}';
  ok('terugzetten: draagt het domein de sleutel onveranderd, dan komt het brontoken terug',
    withJsonMembers(carried, found.slice(1), () => undefined).includes(`"vendorX":${big}`));
  const changed = '{"activityCodeTypes":[{"id":"a","name":"Zone","values":[],"vendorX":7}],"customFieldDefs":[]}';
  ok('terugzetten: draagt het domein een andere waarde onder die naam, dan geen tweede sleutel met dezelfde naam',
    withJsonMembers(changed, found.slice(1), () => undefined) === changed);
}

{
  const q = (s: string) => s.replace(/'/g, "''");
  const synthetic = (n: number, vendor: boolean, changed: boolean) => {
    const stepIds: Record<string, number> = {};
    const idMap = new Map<string, number>();
    const lines: string[] = [];
    let id = 1;
    const ws = id++;
    stepIds['ws:w'] = ws; idMap.set('_worksched', ws);
    lines.push(`#${ws}=IFCWORKSCHEDULE('0000000000000000000000',$,'W',$,$,$,$,$,$,$,$,$,$,$);`);
    const rows: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = id++, p = id++, set = id++, rel = id++;
      stepIds[`task:t${i}`] = t; idMap.set(`task_t${i}`, t);
      const note = `[{"id":"n${i}","text":"${changed ? 'test2' : 'test'}","done":false${vendor ? `,"vendorN":"v${i}"` : ''}}]`;
      lines.push(`#${t}=IFCTASK('${String(i).padStart(22, '0')}',$,$,$,$,$,$,$,$,$,$,$,$);`,
        `#${p}=IFCPROPERTYSINGLEVALUE('Notes',$,IFCTEXT('${q(note)}'),$);`,
        `#${set}=IFCPROPERTYSET('${String(i).padStart(22, '1')}',$,'OPS_TaskNotes',$,(#${p}));`,
        `#${rel}=IFCRELDEFINESBYPROPERTIES('${String(i).padStart(22, '2')}',$,$,$,(#${t}),#${set});`);
      rows.push(`{"taskId":"t${i}","start":"2026-01-01"${vendor ? `,"vendorRow":${i}` : ''}}`);
    }
    const bp = id++, bs = id++, br = id++;
    lines.push(`#${bp}=IFCPROPERTYSINGLEVALUE('Baselines',$,IFCTEXT('${q(`[{"id":"b1","name":"${changed ? 'B2' : 'B'}","tasks":[${rows.join(',')}]}]`)}'),$);`,
      `#${bs}=IFCPROPERTYSET('3333333333333333333333',$,'OPS_Baselines',$,(#${bp}));`,
      `#${br}=IFCRELDEFINESBYPROPERTIES('4444444444444444444444',$,$,$,(#${ws}),#${bs});`);
    const bytes = new TextEncoder().encode(`ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\nFILE_SCHEMA(('IFC4X3_ADD2'));\nENDSEC;\nDATA;\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`);
    return { index: scanStep(bytes), lines, stepIds, idMap };
  };
  const domainOf = (n: number) => ({
    tasks: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, notes: [{ id: `n${i}`, text: 'test2', done: false }] })),
    resources: [], sequences: [], assignments: [], calendar: { id: 'c' }, resourceCalendars: [], project: {},
    baselines: [{ id: 'b1', name: 'B2', tasks: Array.from({ length: n }, (_, i) => ({ taskId: `t${i}`, start: '2026-01-01' })) }],
  }) as unknown as WriteIFCInput;
  const time = (f: () => void) => { const t = performance.now(); f(); return performance.now() - t; };
  const round = (n: number, runs: number) => {
    const best = (f: () => void) => Math.min(...Array.from({ length: runs }, () => time(f)));
    const plain = synthetic(n, false, false), src = synthetic(n, true, false), out = synthetic(n, true, true);
    const domain = domainOf(n);
    const own = () => true;
    const ms: Record<string, number> = {};
    let found = scanJsonExtras(src.index, own);
    ms['openen zonder vreemde sleutels'] = best(() => { if (scanJsonExtras(plain.index, own).length > 0) throw new Error('vreemde sleutels zonder sleutels'); });
    ms['openen'] = best(() => { found = scanJsonExtras(src.index, own); });
    const entries = jsonExtrasIndex(found, () => undefined);
    let source = jsonExtrasFromIndex(src.index, entries, src.stepIds, 'c');
    ms['een uitleesronde'] = best(() => { source = jsonExtrasFromIndex(src.index, entries, src.stepIds, 'c'); });
    const session = jsonExtrasForWriter(source, () => undefined);
    let written: string[] = [];
    ms['schrijven'] = best(() => { written = withJsonExtras(out.lines, out.idMap, [], session); });
    ms['domein aanvullen'] = best(() => { withJsonExtrasInDomain(domain, session); });
    let problem: string | undefined;
    ms['eindcontrole'] = best(() => {
      problem = jsonExtrasProblem(source, { index: out.index, stepIds: out.stepIds, projectCalendarId: 'c', assignmentKeys: new Map() }, domain).problem;
    });
    ok(`kosten bij ${n} taken: alle vreemde sleutels gevonden, geschreven en gecontroleerd (${found.length}, ${source.length}, ${problem})`,
      found.length === n + 1 && source.length === n + 1 && problem === undefined
      && written.filter(l => l.includes('vendorN')).length === n && written.some(l => l.includes(`"vendorRow":${n - 1}`)));
    return ms;
  };
  round(1000, 1);
  const small = round(1000, 3);
  let large = round(10000, 1);
  if (Object.keys(small).some(step => large[step] / Math.max(small[step], 1) >= 50)) {
    const again = round(10000, 1);
    large = Object.fromEntries(Object.keys(large).map(step => [step, Math.min(large[step], again[step])]));
  }
  for (const step of Object.keys(small)) {
    const ratio = large[step] / Math.max(small[step], 1);
    ok(`kosten: ${step} groeit lineair, 10.000 tegen 1.000 taken ${large[step].toFixed(0)} tegen ${small[step].toFixed(0)} ms (verhouding ${ratio.toFixed(1)}, grens 50)`, ratio < 50);
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
    ok(`bron: de index op de bron noemt de vier JSON-eigenschappen met onbekende sleutels, met de binding van het venster (${show(opened.ifcSource?.jsonExtras)})`,
      opened.ifcSource?.jsonExtras?.length === 4
      && opened.ifcSource.jsonExtras.some(e => e.windows?.length === 1 && e.windows[0].key === `${R110}#1`
        && e.windows[0].assignmentId === opened.assignments.find(a => a.taskId === taskOf(opened).id && a.resourceId === resOf(opened, 110).id)?.id));
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
  }, /^uitvoer-controle: _project OPS_TaskTypes\.TaskTypes .*bestaat nog in de planning/);
  {
    const opened = await openForeign(withExtras);
    const domain = cloneDomain(opened);
    domain.tasks = domain.tasks.map(t => t.customTaskTypeId === 'tt-a' ? { ...t, customTaskTypeId: 'tt-b' } : t);
    domain.customTaskTypes = domain.customTaskTypes!.filter(t => t.id !== 'tt-a');
    const prepared = await save('taaktype: type A uit de catalogus gewist', domain, opened.ifcSource!);
    if (prepared) ok('taaktype: type A uit de catalogus gewist: vendorRef vervalt met de definitie', !text(prepared.bytes).includes('opaque-aa'));
  }

  await refuses('botsing: het domein draagt een andere waarde onder de naam van een vreemde sleutel (nooit twee keer dezelfde naam)', d => {
    d.activityCodeTypes = d.activityCodeTypes!.map(t => t.id === 'act-fase' ? { ...t, vendorX: 7 } as typeof t : t);
  }, /^uitvoer-controle: .*vendorX/);
  await refuses('geen plek: zonder codetypen en velden schrijft de writer geen OPS_StructureMeta', d => {
    d.activityCodeTypes = [];
    d.customFieldDefs = [];
  }, /./);
  await refuses('geen plek: zonder vensterdata schrijft de writer geen Windows voor #63', (d, o) => {
    d.assignments = d.assignments.map(a => a.taskId === taskOf(o).id ? { ...a, plannedWorkMinutes: undefined } : a);
  }, /^uitvoer-controle: task_.* OPS_Timephased\.Windows/);

  const front = latin1(patchJson(baseText, 'structure', j => j.replace(/^\{/, '{"vendorFront":"F",')));
  {
    const opened = await openForeign(front);
    const domain = cloneDomain(opened);
    domain.activityCodeTypes = domain.activityCodeTypes!.map(t => t.id === 'act-zone' ? { ...t, values: t.values.map(v => ({ ...v, description: 'Kelder' })) } : t);
    const prepared = await save('grens: een onbekende sleutel vooraan, de omschrijving van een codewaarde', domain, opened.ifcSource!);
    if (prepared) ok('grens: een onbekende sleutel vooraan, de omschrijving van een codewaarde: de sleutel blijft, na de bekende sleutels',
      memberOf(jsonIn(prepared.bytes, 'OPS_StructureMeta', 'structure'), ['vendorFront']) === '"F"');
  }
  await refuses('grens (knownbug 2218): een onbekende sleutel vooraan en een codetype hernoemen, zoals main', d => {
    d.activityCodeTypes = d.activityCodeTypes!.map(t => t.id === 'act-zone' ? { ...t, name: 'Zone (nieuw)' } : t);
  }, /^niet-gedragen: IFCPROPERTYSETTEMPLATE/, front);

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
