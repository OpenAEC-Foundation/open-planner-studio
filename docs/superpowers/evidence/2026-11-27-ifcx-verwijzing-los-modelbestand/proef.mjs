import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [bsiCore, modules, litePackage, modelPath, planPath] = process.argv.slice(2).map(p => resolve(p));
const rawModel = readFileSync(modelPath);
const rawPlan = readFileSync(planPath);
const model = JSON.parse(rawModel);
const plan = JSON.parse(rawPlan);
const task = plan.data.find(n => n.attributes['openaec::planning::activity']);
const links = task.attributes['openaec::links'];
const [wall, windowPath] = links.map(link => link.target);
const probe = 'd6db7bf4-9a3d-4220-901a-200000000003';
const sha = bytes => createHash('sha256').update(bytes).digest('base64');
const sri = 'sha256-' + sha(rawModel);
let fetches = 0;
globalThis.fetch = () => { fetches++; throw new Error('Netwerk uitgeschakeld tijdens de proef'); };

const { createJiti } = await import(pathToFileURL(join(modules, 'jiti/lib/jiti.mjs')));
const requireTs = createJiti(import.meta.url, { fsCache: false, tryNative: false });
const { Federate, LoadIfcxFile } = requireTs(join(bsiCore, 'workflows.ts'));
const { InMemoryLayerProvider } = requireTs(join(bsiCore, 'layers/layer-providers.ts'));
const { IfcxLayerStackBuilder } = requireTs(join(bsiCore, 'layers/layer-stack.ts'));
const { parseIfcx, parseFederatedIfcx, composeFederated } = await import(pathToFileURL(join(litePackage, 'dist/index.js')));
const liteVersion = JSON.parse(readFileSync(join(litePackage, 'package.json'))).version;

function bsiNodes(root) {
  const byPath = new Map();
  function visit(node) {
    byPath.set(node.node, node);
    for (const child of node.children.values()) visit(child);
  }
  visit(root);
  return byPath;
}

function observe(nodes) {
  const taskLinks = nodes.get(task.path)?.attributes.get('openaec::links');
  assert.deepEqual(taskLinks, links);
  const targets = taskLinks.map(link => nodes.get(link.target)?.attributes.get('bsi::ifc::class')?.code ?? null);
  return { targets, overlay: nodes.get(wall)?.attributes.get('proef::werkvak'), name: nodes.get(wall)?.attributes.get('proef::naam') ?? null };
}

function imported(uri, integrity = sri) {
  return { ...plan, imports: [{ uri, integrity }] };
}

function packed(doc) {
  if (doc === model) return rawModel;
  if (doc === plan) return rawPlan;
  return Buffer.from(JSON.stringify(doc));
}

async function liteNodes(documents) {
  const files = documents.map(doc => ({
    buffer: Uint8Array.from(packed(doc)).buffer,
    name: basename(doc.header.id === model.header.id ? modelPath : planPath),
  }));
  const parsed = await parseFederatedIfcx(files);
  return composeFederated(parsed.layerStack).composed;
}

async function bsiStack(main, available) {
  const provider = new InMemoryLayerProvider().AddAll([main, ...available]);
  return new IfcxLayerStackBuilder(provider).FromId(main.header.id).Build();
}

async function manualStack(documents) {
  const main = { header: { ...plan.header, id: 'USER_DEF' }, imports: documents.map(d => ({ uri: d.header.id })), schemas: {}, data: [] };
  return bsiStack(main, documents);
}

function stackNodes(stack) {
  if (stack instanceof Error) throw stack;
  return bsiNodes(stack.GetFullTree());
}

const changed = structuredClone(model);
changed.data[0].attributes['proef::naam'] = 'Muur revisie B';
changed.data = changed.data.filter(n => n.path !== windowPath);
assert.notEqual(sha(packed(changed)), sha(rawModel));
const good = { targets: ['IfcWall', 'IfcWindow'], overlay: 'Vak A', name: 'Muur A' };
const alone = { targets: [null, null], overlay: 'Vak A', name: null };
const revision = { targets: ['IfcWall', null], overlay: 'Vak A', name: 'Muur revisie B' };
const byId = imported(model.header.id);
const otherHash = imported(model.header.id, 'sha256-' + sha(Buffer.from('ander bestand')));
const byName = imported(basename(modelPath));
const tests = [
  ['beide, zonder import', [model, plan], good],
  ['beide, import op ID', [model, byId], good],
  ['beide, import op bestandsnaam', [model, byName], good],
  ['beide, onjuiste integrity', [model, otherHash], good],
  ['alleen planning, zonder import', [plan], alone],
  ['alleen planning, met import', [byId], alone],
  ['nieuwe modelversie, oorspronkelijke integrity', [changed, byId], revision],
];

console.log('Node', process.version, '| IFC Lite', liteVersion, '| model', sri);
for (const [label, documents, expected] of tests) {
  const flat = bsiNodes(LoadIfcxFile(Federate(documents), true, true));
  assert.deepEqual(observe(flat), expected);
  assert.deepEqual(observe(await liteNodes(documents)), expected);
  console.log('Federate + LoadIfcxFile en IFC Lite:', label, JSON.stringify(expected));

  const stack = await manualStack(documents);
  if (documents.includes(byName) || (documents.length === 1 && documents.includes(byId))) {
    assert.ok(stack instanceof Error);
    console.log('buildingSMART-stapel zonder netwerk:', stack.message);
  } else {
    assert.deepEqual(observe(stackNodes(stack)), expected);
    console.log('buildingSMART-stapel zonder netwerk: zelfde uitkomst');
  }
}

for (const [label, root, expected] of [
  ['geen import, model beschikbaar', plan, alone],
  ['import op ID, model beschikbaar', byId, good],
]) {
  assert.deepEqual(observe(stackNodes(await bsiStack(root, [model]))), expected);
  console.log('buildingSMART vanuit de planning:', label, JSON.stringify(expected.targets));
}

for (const root of [plan, byId]) {
  const single = await parseIfcx(Uint8Array.from(packed(root)).buffer);
  assert.equal(single.schemaVersion, 'IFC5');
  console.log('IFC Lite één-bestandslezer: planning geladen, imports:', root.imports.length);
}

const competing = structuredClone(byId);
competing.schemas['proef::naam'] = model.schemas['proef::naam'];
competing.data.find(n => n.path === wall).attributes['proef::naam'] = 'Naam uit de planning';
const byImport = observe(stackNodes(await bsiStack(competing, [model]))).name;
const bySelection = observe(stackNodes(await manualStack([model, competing]))).name;
const byLite = observe(await liteNodes([model, competing])).name;
assert.equal(byImport, 'Muur A');
assert.equal(bySelection, 'Naam uit de planning');
assert.equal(byLite, 'Naam uit de planning');
console.log('Botsend attribuut, winnaar: buildingSMART vanuit import =', byImport,
  '| buildingSMART en IFC Lite met model eerst =', bySelection);

const structural = structuredClone(plan);
structural.data.push({ path: probe, children: { raam: windowPath }, inherits: { muur: wall } });
for (const [label, documents] of [['beide', [model, structural]], ['alleen planning', [structural]]]) {
  const withModel = documents.length === 2;
  const ref = stackNodes(await manualStack(documents)).get(probe);
  const lite = (await liteNodes(documents)).get(probe);
  for (const [name, node] of [['buildingSMART', ref], ['IFC Lite', lite]]) {
    const result = {
      inherited: node.attributes.get('proef::naam') ?? null,
      childExists: node.children.has('raam'),
      childClass: node.children.get('raam')?.attributes.get('bsi::ifc::class')?.code ?? null,
    };
    assert.equal(result.inherited, withModel ? 'Muur A' : null);
    assert.equal(result.childClass, withModel ? 'IfcWindow' : null);
    assert.equal(result.childExists, withModel || name === 'buildingSMART');
    console.log(name, 'children en inherits,', label, JSON.stringify(result));
  }
}
assert.equal(fetches, 0);
assert.deepEqual(readFileSync(modelPath), rawModel);
assert.deepEqual(readFileSync(planPath), rawPlan);
console.log('Netwerkaanroepen:', fetches, '| beide proefbestanden bij einde bytegelijk');
