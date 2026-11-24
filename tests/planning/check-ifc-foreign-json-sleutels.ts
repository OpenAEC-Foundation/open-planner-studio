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
import { writeIFC } from '@/services/ifc/ifcWriter';
import { JSON_PROPERTIES, jsonPropertyShape, type JsonShape } from '@/services/ifc/jsonRegister';
import { unknownJsonMembers, withJsonMembers } from '@/services/ifc/jsonExtras';
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
  const noObject = (node: JsonNode): boolean => node.kind === 'object' ? false : node.kind === 'array' ? node.items.every(noObject) : true;
  const walk = (node: JsonNode, at: JsonShape, path: string): void => {
    if (at.soort === 'doorgegeven') return;
    if (at.soort === 'waarde') { if (!noObject(node)) problems.push(`${path}: een object waar het register een waarde zegt`); return; }
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
  const expected = [
    'OPS_StructureMeta.structure', 'OPS_TaskTypes.TaskTypes', 'OPS_Library.pool', 'OPS_Baselines.Baselines',
    'OPS_Baselines.TaskGuids', 'OPS_SchedulingProfile.SchedulingProfile', 'OPS_Sequences.P6StartAtPredecessorFinishBoundarySequenceGuids',
    'OPS_Calendar.LibraryOrigin', 'OPS_Resource.LibraryOrigin', 'OPS_Timephased.Windows', 'OPS_TimephasedDurationWalks.DurationWalks',
    'OPS_ExternalLink.Links', 'OPS_TaskNotes.Notes', 'OPS_Analysis.ExactFloat', 'OPS_TaskSplits.Splits', 'OPS_TimephasedContours.Contours',
  ];
  const missing = expected.filter(p => !seen.has(p));
  ok(`register: de proef zag de JSON-properties die ze moet zien (ontbreekt: ${missing.join(', ')})`, missing.length === 0);
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
  const found = unknownJsonMembers(source, shape, () => undefined)!;
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

const eigen = text(await settle(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const TASK_GUID = '06AdBvh4v8lXgXlHO1$rfO';
const R109 = '3LKE2mEiGfOR4VMIq3h_xv';
const R110 = '34SuBObt1dKPNSent0osWG';
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
  const prepared = await save('basis: codetypen en vensters toevoegen', domain, opened.ifcSource!);
  if (prepared) base = prepared.bytes;
}
ok('basis: het opgeslagen bestand heeft OPS_StructureMeta, OPS_Baselines en de vensters van #63',
  !!base && jsonIn(base, 'OPS_StructureMeta', 'structure') !== undefined && jsonIn(base, 'OPS_Baselines', 'Baselines') !== undefined
  && jsonIn(base, 'OPS_Timephased', 'Windows', TASK_GUID) !== undefined);

if (base) {
  const baseText = text(base);
  const baselines = JSON.parse(jsonIn(base, 'OPS_Baselines', 'Baselines')!) as { id: string; tasks: { taskId: string }[] }[];
  const baselineId = baselines[0].id, rowTask = baselines[0].tasks[1].taskId;
  let s = patchJson(baseText, 'structure', j => j.replace(/^\{/, '{"vendorCoordinationId":"VC-0042",')
    .replace('"id":"act-fase","name":"Fase",', `"id":"act-fase","vendorX":${BIG},"name":"Fase",`));
  s = patchJson(s, 'Baselines', j => j.replace(`"id":"${baselineId}",`, `"id":"${baselineId}","vendorBaselineRef":"BR-9",`)
    .replace(`{"taskId":"${rowTask}",`, `{"taskId":"${rowTask}","vendorRow":{"x":[1,2]},`));
  s = patchJson(s, 'Windows', j => j.replace(`"${R110}#1":{`, `"vendorMapNote":"m","${R110}#1":{"vendorW":"w-110",`));
  const withExtras = latin1(s);
  ok('bron: de proefbewerking zette de vijf onbekende sleutels erin', s !== baseText
    && memberOf(jsonIn(withExtras, 'OPS_StructureMeta', 'structure'), ['vendorCoordinationId']) === '"VC-0042"'
    && memberOf(jsonIn(withExtras, 'OPS_Timephased', 'Windows', TASK_GUID), [`${R110}#1`, 'vendorW']) === '"w-110"');

  const expectExtras = (label: string, bytes: Uint8Array, want: { fase: boolean; row: boolean; window: string | undefined }) => {
    const structure = jsonIn(bytes, 'OPS_StructureMeta', 'structure');
    const bl = jsonIn(bytes, 'OPS_Baselines', 'Baselines');
    const windows = jsonIn(bytes, 'OPS_Timephased', 'Windows', TASK_GUID);
    ok(`${label}: vendorCoordinationId bovenin OPS_StructureMeta (${structure?.slice(0, 120)})`,
      memberOf(structure, ['vendorCoordinationId']) === '"VC-0042"');
    ok(`${label}: vendorX ${want.fase ? 'bij' : 'niet meer, met'} codetype act-fase, byte-gelijk`,
      want.fase ? memberOf(structure, ['activityCodeTypes', ['id', 'act-fase'], 'vendorX']) === BIG : !structure?.includes('vendorX'));
    ok(`${label}: vendorBaselineRef bij baseline ${baselineId}`, memberOf(bl, [['id', baselineId], 'vendorBaselineRef']) === '"BR-9"');
    ok(`${label}: vendorRow ${want.row ? 'bij' : 'niet meer, met'} de baselineregel van ${rowTask}`, want.row
      ? memberOf(bl, [['id', baselineId], 'tasks', ['taskId', rowTask], 'vendorRow']) === '{"x":[1,2]}'
      : !bl?.includes('vendorRow'));
    ok(`${label}: vendorMapNote bovenin Windows (${windows})`, memberOf(windows, ['vendorMapNote']) === '"m"');
    ok(`${label}: vendorW bij de toewijzing van #110 onder ${want.window} (${windows})`,
      want.window === undefined ? !windows?.includes('vendorW') : memberOf(windows, [want.window, 'vendorW']) === '"w-110"');
  };

  type Edit = (d: Domain, o: Opened) => void | Domain | Promise<void | Domain>;
  const scenario = async (label: string, edit: Edit, want: { fase: boolean; row: boolean; window: string | undefined }) => {
    const opened = await openForeign(withExtras);
    let domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef JSON-sleutels)`;
    const edited = await edit(domain, opened);
    if (edited) domain = edited;
    const prepared = await save(label, domain, opened.ifcSource!);
    if (!prepared) return undefined;
    const problems = mergeProblems(withExtras, prepared.bytes);
    ok(`${label}: de invarianten van de merge (${problems.slice(0, 2).join(' | ')})`, problems.length === 0);
    expectExtras(label, prepared.bytes, want);
    const again = await openForeign(prepared.bytes);
    const next = cloneDomain(again);
    next.project.description = `${next.project.description} (tweede opslag)`;
    const second = await save(`${label}, heropenen en nog eens opslaan`, next, again.ifcSource!);
    if (second) expectExtras(`${label}, tweede opslag`, second.bytes, want);
    return { prepared, domain };
  };

  await scenario('alleen herschrijven', () => {}, { fase: true, row: true, window: `${R110}#1` });
  await scenario('een ander codetype hernoemen', d => {
    d.activityCodeTypes = d.activityCodeTypes!.map(t => t.id === 'act-zone' ? { ...t, name: 'Zone (nieuw)' } : t);
  }, { fase: true, row: true, window: `${R110}#1` });
  await scenario('een codewaarde toevoegen aan het codetype met de vreemde sleutel', d => {
    d.activityCodeTypes = d.activityCodeTypes!.map(t => t.id === 'act-fase' ? { id: t.id, name: t.name, values: [...t.values, { id: 'acv-f2', code: 'F2' }] } : t);
  }, { fase: true, row: true, window: `${R110}#1` });
  await scenario('het codetype met de vreemde sleutel wissen', d => {
    d.activityCodeTypes = d.activityCodeTypes!.filter(t => t.id !== 'act-fase');
  }, { fase: false, row: true, window: `${R110}#1` });
  await scenario('een baseline erbij', d => {
    const first = d.baselines![0];
    d.baselines = [...d.baselines!, { ...structuredClone(first), id: 'baseline-proef', name: 'Tweede', tasks: first.tasks.map(t => ({ taskId: t.taskId, start: t.start, finish: t.finish, duration: t.duration, isMilestone: t.isMilestone })) }];
  }, { fase: true, row: true, window: `${R110}#1` });
  await scenario('de baselines in een andere volgorde', d => { d.baselines = [...d.baselines!].reverse(); },
    { fase: true, row: true, window: `${R110}#1` });
  await scenario('de baselineregels in een andere volgorde, met de regel opnieuw opgebouwd', d => {
    d.baselines = d.baselines!.map(b => b.id === baselineId ? { ...b, tasks: [...b.tasks].reverse().map(t => ({ taskId: t.taskId, start: t.start, finish: t.finish, duration: t.duration, isMilestone: t.isMilestone })) } : b);
  }, { fase: true, row: true, window: `${R110}#1` });
  await scenario('de eerste toewijzing van #63 weg: vendorW schuift mee naar de nieuwe sleutel', (d, o) => {
    d.assignments = d.assignments.filter(a => !(a.taskId === taskOf(o).id && a.resourceId === resOf(o, 109).id));
  }, { fase: true, row: true, window: `${R110}#0` });
  await scenario('de toewijzing van #110 weg: vendorW vervalt met haar toewijzing', (d, o) => {
    d.assignments = d.assignments.filter(a => !(a.taskId === taskOf(o).id && a.resourceId === resOf(o, 110).id));
  }, { fase: true, row: true, window: undefined });
  await scenario('via de store: een codetype hernoemen', async d => storeEdit(d, st => {
    st.renameActivityCodeType('act-zone', 'Zone (store)');
  }), { fase: true, row: true, window: `${R110}#1` });

  {
    const opened = await openForeign(withExtras);
    const domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef botsing)`;
    domain.activityCodeTypes = domain.activityCodeTypes!.map(t => t.id === 'act-fase' ? { ...t, vendorX: 7 } as typeof t : t);
    const verdict = await refusal(domain, opened.ifcSource!);
    ok(`botsing: het domein draagt een andere waarde onder de naam van een vreemde sleutel: weigeren, niet twee keer dezelfde naam (${verdict})`,
      /^uitvoer-controle: .*vendorX/.test(verdict));
  }
  {
    const opened = await openForeign(withExtras);
    const domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef geen plek)`;
    domain.activityCodeTypes = [];
    domain.customFieldDefs = [];
    const verdict = await refusal(domain, opened.ifcSource!);
    ok(`geen plek: zonder codetypen en velden schrijft de writer geen OPS_StructureMeta, dan stopt opslaan (${verdict})`,
      /^uitvoer-controle: .*vendorCoordinationId|niet eenduidig/.test(verdict) && verdict.includes('OPS_StructureMeta'));
  }
  {
    const opened = await openForeign(withExtras);
    const domain = cloneDomain(opened);
    domain.project.description = `${domain.project.description} (proef nieuwe toewijzing)`;
    const task = taskOf(opened), r110 = resOf(opened, 110);
    domain.assignments = [...domain.assignments, { ...domain.assignments.find(a => a.taskId === task.id && a.resourceId === r110.id)!, id: 'asgn-dubbel' }];
    const verdict = await refusal(domain, opened.ifcSource!);
    ok(`nieuwe toewijzing van dezelfde resource: geen eenduidige plek voor vendorW, opslaan stopt (${verdict})`,
      /^uitvoer-controle: .*Windows/.test(verdict));
  }
}

{
  const own = readIFC(new TextDecoder().decode(read('public/examples/03-kantoorgebouw-zuidas.ifc'))) as unknown as Domain;
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
