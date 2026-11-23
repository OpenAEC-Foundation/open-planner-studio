import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import type { ElementLink } from '@/services/ifc/foreign/elementLinks';
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
  assert.deepEqual(links[idOf('Wand A bouwen')], [output(WALL_A), input(WALL_A)]);
  assert.deepEqual(links[idOf('Wand B bouwen')], [output(WALL_B)]);
  assert.equal(links[idOf('Ruwbouw')], undefined, 'een taak zonder koppeling heeft geen regel');
  assert.equal(links[idOf('Stucwerk')], undefined);
  assert.deepEqual(Object.keys(links).sort(), [idOf('Wand A bouwen'), idOf('Wand B bouwen')].sort(),
    'de baselinetaken en de ploeg in de gemengde ToProcess geven geen koppeling');
  assert.deepEqual(elementLinkCounts(links[idOf('Wand A bouwen')]), { elements: 1, notFound: 0 },
    'dezelfde wand als invoer en uitvoer telt als één bouwdeel');
});

await check('Bonsai-4D met CRLF en commentaar in de entiteiten: dezelfde koppelingen', async () => {
  const { idOf, links } = await openedLinks(text('tests/fixtures/ifc-foreign/crlf-commentaar.ifc'));
  assert.deepEqual(links[idOf('Wand A bouwen')], [output(WALL_A), input(WALL_A)]);
  assert.deepEqual(links[idOf('Wand B bouwen')], [output(WALL_B)]);
});

await check('een doel dat niet in het bestand staat: niet gevonden, met zijn verwijzing', async () => {
  const content = BONSAI
    .replace("(#108,#160),$,#61);", "(#108,#160),$,#9999);")
    .replace("(#118,#30),$,#104,#121);", "(#118,#30,#9998),$,#104,#121);");
  assert.notEqual(content, BONSAI);
  const { idOf, links } = await openedLinks(content);
  const wallA = links[idOf('Wand A bouwen')], wallB = links[idOf('Wand B bouwen')];
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
  assert.deepEqual(links[id], expected);
  const source = store.getState().ifcSource!;

  const unchanged = await prepareIfcWrite(cloneDomain(snapshot(store)), source);
  assert.strictEqual(unchanged.source, source, 'ongewijzigd: dezelfde bron, met haar koppelingen');

  const domain = cloneDomain(snapshot(store));
  const written = await prepareIfcWrite(await recalculated(await lengthen(domain, lengthenedTask(domain).id)), source);
  assert.notStrictEqual(written.source, source, 'de bewerking schrijft een nieuwe bron');
  const outputText = new TextDecoder().decode(written.bytes);
  assert(outputText.includes("#9001=IFCRELASSIGNSTOPRODUCT('1KoppelingUitvoer00001',$,$,$,(#51),$,#393);"));
  assert(outputText.includes("#9002=IFCRELASSIGNSTOPROCESS('1KoppelingInvoer000001',$,$,$,(#354),$,#51,$);"));
  assert.deepEqual(written.source.elementLinks, { [id]: expected }, 'de nieuwe bron: de sessiekaart van de writer');
  const reopened = await openForeign(written.bytes);
  assert.deepEqual(reopened.ifcSource!.elementLinks, written.source.elementLinks, 'heropenen geeft dezelfde koppelingen');
});

await check('alleen met de flag: zonder flag ziet paneel en MCP geen koppeling', async () => {
  const { store, idOf } = await openedLinks(BONSAI);
  const id = idOf('Wand A bouwen');
  assert.deepEqual(taskElementLinks(store.getState(), id), [output(WALL_A), input(WALL_A)]);
  assert.strictEqual(taskElementLinks(store.getState(), id), store.getState().ifcSource!.elementLinks[id],
    'de lijst uit de bron zelf, zodat een selector stabiel blijft');
  store.setState(s => { s.ui.featureFlags = {}; });
  assert.equal(taskElementLinks(store.getState(), id), undefined);
  assert.equal(taskElementLinks(store.getState(), 'onbekend'), undefined);
});

await check('een planning zonder vreemd deel: een bron zonder koppelingen', async () => {
  const { links } = await openedLinks(text('public/examples/03-kantoorgebouw-zuidas.ifc'));
  assert.deepEqual(links, {});
});

console.log(`Koppelingen taak↔bouwdeel: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
