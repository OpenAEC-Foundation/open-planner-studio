import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { elementLinksByTask, scanElementLinks, type ElementLink, type StepElementLink } from '@/services/ifc/foreign/elementLinks';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { scanStep } from '@/services/ifc/foreign/stepScanner';
import { elementLinkCounts, taskElementLinks } from '@/state/taskElementLinks';
import { cloneDomain, openForeign } from './ifcMergeKern';
import { lengthen, lengthenedTask, openInStore, recalculated } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
installDeterminism();
const text = (name: string) => readFileSync(join(root, name), 'utf8');
const bytesOf = (content: string) => new TextEncoder().encode(content);
const guidOf = (content: string, stepId: number) => {
  const match = new RegExp(`^#${stepId}=IFC\\w+\\('([^']+)'`, 'm').exec(content);
  assert(match, `GlobalId van #${stepId}`);
  return match[1];
};
const output = (target: string, found = true): ElementLink => ({ direction: 'output', target, found });
const input = (target: string, found = true): ElementLink => ({ direction: 'input', target, found });

let passed = 0, failed = 0;
async function check(label: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log(`OK ${label}`); }
  catch (error) { failed++; console.error(`XX ${label}`, error); }
}

async function openedLinks(content: string) {
  const { store, snapshot } = await openInStore(bytesOf(content));
  const state = store.getState();
  const idOf = (name: string) => {
    const task = state.tasks.find(t => t.name === name);
    assert(task, `taak ${name}`);
    return task.id;
  };
  return { store, snapshot, idOf, links: state.ifcSource!.elementLinks };
}

const BONSAI = text('tests/fixtures/ifc-foreign/bonsai-4d.ifc');
const WALL_A = guidOf(BONSAI, 30), WALL_B = guidOf(BONSAI, 61);

await check('Bonsai-4D: ToProduct is uitvoer, ToProcess is invoer, per taak in de volgorde van de bron', async () => {
  const { idOf, links } = await openedLinks(BONSAI);
  assert.deepEqual(links.get(idOf('Wand A bouwen')), [output(WALL_A), input(WALL_A)]);
  assert.deepEqual(links.get(idOf('Wand B bouwen')), [output(WALL_B)]);
  assert.equal(links.get(idOf('Ruwbouw')), undefined, 'een taak zonder koppeling heeft geen regel');
  assert.equal(links.get(idOf('Stucwerk')), undefined);
  assert.deepEqual([...links.keys()].sort(), [idOf('Wand A bouwen'), idOf('Wand B bouwen')].sort(),
    'de baselinetaken en de ploeg in de gemengde ToProcess geven geen koppeling');
  assert.deepEqual(elementLinkCounts(links.get(idOf('Wand A bouwen'))!), { elements: 1, notFound: 0 },
    'dezelfde wand als invoer en uitvoer telt als één bouwdeel');
});

await check('Bonsai-4D met CRLF en commentaar in de entiteiten: dezelfde koppelingen', async () => {
  const { idOf, links } = await openedLinks(text('tests/fixtures/ifc-foreign/crlf-commentaar.ifc'));
  assert.deepEqual(links.get(idOf('Wand A bouwen')), [output(WALL_A), input(WALL_A)]);
  assert.deepEqual(links.get(idOf('Wand B bouwen')), [output(WALL_B)]);
});

await check('een doel dat niet in het bestand staat: niet gevonden, met zijn verwijzing', async () => {
  const content = BONSAI
    .replace("(#108,#160),$,#61);", "(#108,#160),$,#9999);")
    .replace("(#118,#30),$,#104,#121);", "(#118,#30,#9998),$,#104,#121);");
  assert.notEqual(content, BONSAI);
  const { idOf, links } = await openedLinks(content);
  const wallA = links.get(idOf('Wand A bouwen'))!, wallB = links.get(idOf('Wand B bouwen'))!;
  assert.deepEqual(wallA, [output(WALL_A), input(WALL_A), input('#9998', false)]);
  assert.deepEqual(wallB, [output('#9999', false)]);
  assert.deepEqual(elementLinkCounts(wallA), { elements: 2, notFound: 1 });
  assert.deepEqual(elementLinkCounts(wallB), { elements: 1, notFound: 1 });
});

const OWN = text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');
const OWN_WALL_A = guidOf(OWN, 393), OWN_WALL_B = guidOf(OWN, 354);
const LINKED_OWN = (() => {
  const end = OWN.lastIndexOf('ENDSEC;');
  return OWN.slice(0, end)
    + "#9001=IFCRELASSIGNSTOPRODUCT('1KoppelingUitvoer00001',$,$,$,(#51),$,#393);\n"
    + "#9002=IFCRELASSIGNSTOPROCESS('1KoppelingInvoer000001',$,$,$,(#354),$,#51,$);\n"
    + OWN.slice(end);
})();

await check('eigen planning met model: de bron na opslaan komt van de writer en is gelijk aan heropenen', async () => {
  const { store, snapshot, idOf, links } = await openedLinks(LINKED_OWN);
  const id = idOf('Set up site');
  const expected = [output(OWN_WALL_A), input(OWN_WALL_B)];
  assert.deepEqual(links.get(id), expected);
  const source = store.getState().ifcSource!;

  const unchanged = await prepareIfcWrite(cloneDomain(snapshot(store)), source);
  assert.strictEqual(unchanged.source, source, 'ongewijzigd: dezelfde bron, met haar koppelingen');

  const domain = cloneDomain(snapshot(store));
  const written = await prepareIfcWrite(await recalculated(await lengthen(domain, lengthenedTask(domain).id)), source);
  assert.notStrictEqual(written.source, source, 'de bewerking schrijft een nieuwe bron');
  const outputText = new TextDecoder().decode(written.bytes);
  assert(outputText.includes("#9001=IFCRELASSIGNSTOPRODUCT('1KoppelingUitvoer00001',$,$,$,(#51),$,#393);"));
  assert(outputText.includes("#9002=IFCRELASSIGNSTOPROCESS('1KoppelingInvoer000001',$,$,$,(#354),$,#51,$);"));
  assert.deepEqual(written.source.elementLinks, new Map([[id, expected]]), 'de nieuwe bron: de sessiekaart van de writer');
  const reopened = await openForeign(written.bytes);
  assert.deepEqual(reopened.ifcSource!.elementLinks, written.source.elementLinks, 'heropenen geeft dezelfde koppelingen');
});

await check('alleen met de flag: zonder flag ziet paneel en MCP geen koppeling', async () => {
  const { store, idOf } = await openedLinks(BONSAI);
  const id = idOf('Wand A bouwen');
  assert.deepEqual(taskElementLinks(store.getState(), id), [output(WALL_A), input(WALL_A)]);
  assert.strictEqual(taskElementLinks(store.getState(), id), store.getState().ifcSource!.elementLinks.get(id),
    'de lijst uit de bron zelf, zodat een selector stabiel blijft');
  store.setState(s => { s.ui.featureFlags = {}; });
  assert.equal(taskElementLinks(store.getState(), id), undefined);
  assert.equal(taskElementLinks(store.getState(), 'onbekend'), undefined);
});

await check('een planning zonder vreemd deel: een bron zonder koppelingen', async () => {
  const { links } = await openedLinks(text('public/examples/03-kantoorgebouw-zuidas.ifc'));
  assert.equal(links.size, 0);
});

await check('taak-id constructor en __proto__: veilig in de kaart, na klonen zoals in de Worker, en in de selector', async () => {
  const links: StepElementLink[] = [
    { taskStepId: 1, direction: 'output', target: 'A', found: true },
    { taskStepId: 2, direction: 'input', target: 'B', found: true },
  ];
  const map = elementLinksByTask(links, { 'task:constructor': 1, 'task:__proto__': 2, 'task:toString': 3 });
  for (const [label, kaart] of [['opgebouwd', map], ['gekloond', structuredClone(map)]] as const) {
    assert.deepEqual(kaart.get('constructor'), [output('A')], label);
    assert.deepEqual(kaart.get('__proto__'), [input('B')], label);
    assert.equal(kaart.get('toString'), undefined, `${label}: een taak zonder koppeling`);
    assert.equal(kaart.size, 2, label);
    const state = { ui: { featureFlags: { ifcForeignContent: true } }, ifcSource: { elementLinks: kaart } as IfcSource };
    assert.deepEqual(taskElementLinks(state, 'constructor'), [output('A')], label);
    assert.deepEqual(taskElementLinks(state, '__proto__'), [input('B')], label);
    for (const inherited of ['toString', 'hasOwnProperty', 'valueOf']) {
      assert.equal(taskElementLinks(state, inherited), undefined, `${label}: ${inherited} is geen eigen sleutel`);
    }
  }
});

const ELEMENT_GUID = (n: number) => `W${String(n).padStart(21, '0')}`;
function oneTaskWithElements(elements: number): Uint8Array {
  const wall = (n: number) => `#${100 + n}`;
  const lines = [
    'ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION((''),'2;1');", "FILE_NAME('','',(''),(''),'','','');",
    "FILE_SCHEMA(('IFC4X3_ADD2'));", 'ENDSEC;', 'DATA;',
    "#1=IFCTASK('T000000000000000000000',$,'Gevel',$,$,$,$,$,$,.F.,$,$,.NOTDEFINED.);",
    `#99=IFCRELASSIGNSTOPROCESS('I000000000000000000000',$,$,$,(${Array.from({ length: elements }, (_, n) => `${wall(n)},${wall(n)}`).join(',')}),$,#1,$);`,
  ];
  for (let n = 0; n < elements; n++) lines.push(`${wall(n)}=IFCWALL('${ELEMENT_GUID(n)}',$,$,$,$,$,$,$,$);`);
  for (let n = 0; n < elements; n++) {
    lines.push(`#${1_000_000 + n}=IFCRELASSIGNSTOPRODUCT('P${String(n).padStart(21, '0')}',$,$,$,(#1,#1),$,${wall(n)});`);
  }
  lines.push('ENDSEC;', 'END-ISO-10303-21;', '');
  return bytesOf(lines.join('\n'));
}

type Counted = Record<string, (...args: unknown[]) => unknown>;
function arrayAndCollectionOperations<T>(run: () => T): { result: T; operations: number } {
  let operations = 0;
  const restore: Array<() => void> = [];
  const replace = (proto: object, name: string, wrap: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown) => {
    const target = proto as Counted, original = target[name];
    target[name] = wrap(original);
    restore.push(() => { target[name] = original; });
  };
  for (const name of ['some', 'every', 'find', 'findIndex', 'findLast', 'findLastIndex', 'filter', 'map', 'flatMap', 'forEach', 'reduce']) {
    replace(Array.prototype, name, original => function (this: unknown, callback: unknown, ...rest: unknown[]) {
      const counted = (...args: unknown[]) => { operations++; return (callback as (...a: unknown[]) => unknown)(...args); };
      return original.call(this, counted, ...rest);
    });
  }
  for (const name of ['indexOf', 'lastIndexOf', 'includes']) {
    replace(Array.prototype, name, original => function (this: unknown[], ...args: unknown[]) {
      operations += this.length;
      return original.apply(this, args);
    });
  }
  for (const [proto, names] of [[Set.prototype, ['has', 'add', 'delete']], [Map.prototype, ['get', 'set', 'has', 'delete']]] as const) {
    for (const name of names) {
      replace(proto, name, original => function (this: unknown, ...args: unknown[]) { operations++; return original.apply(this, args); });
    }
  }
  try { return { result: run(), operations }; }
  finally { for (const undo of restore.reverse()) undo(); }
}

function linksOfOneTask(elements: number) {
  const index = scanStep(oneTaskWithElements(elements));
  const counted = arrayAndCollectionOperations(() => elementLinksByTask(scanElementLinks(index), { 'task:gevel': 1 }));
  const list = counted.result.get('gevel')!;
  assert.equal(list.length, 2 * elements, `${elements} bouwdelen: elk één keer als invoer en één keer als uitvoer`);
  for (let n = 0; n < elements; n++) {
    assert.deepEqual(list[n], input(ELEMENT_GUID(n)), `invoer ${n} in de volgorde van de bron`);
    assert.deepEqual(list[elements + n], output(ELEMENT_GUID(n)), `uitvoer ${n} in de volgorde van de bron`);
  }
  assert.deepEqual(elementLinkCounts(list), { elements, notFound: 0 });
  return counted.operations;
}

await check('één taak met veel bouwdelen en herhaalde koppelingen: volgorde en telling gelijk, het werk groeit lineair', async () => {
  const small = linksOfOneTask(1_000), large = linksOfOneTask(4_000);
  const growth = large / small;
  console.log(`   werk (array- en verzamelingsbewerkingen): 1.000 bouwdelen ${small}, 4.000 bouwdelen ${large}, groei ${growth.toFixed(2)}`);
  assert(growth < 6, `vier keer zoveel bouwdelen geeft ${growth.toFixed(2)} keer zoveel werk; lineair is 4, kwadratisch 16`);
  const many = linksOfOneTask(50_000);
  const perRawLink = many / (4 * 50_000);
  console.log(`   werk bij 50.000 bouwdelen (200.000 koppelingen in de bron): ${many}, ${perRawLink.toFixed(2)} per koppeling`);
  assert(perRawLink < 20, `${perRawLink.toFixed(2)} bewerkingen per koppeling in de bron`);
});

console.log(`Koppelingen taak↔bouwdeel: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
