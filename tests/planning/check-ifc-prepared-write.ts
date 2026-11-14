// #804 fase 1c PR 8a: één gecontroleerd schrijfresultaat, met de sessiekaart voor de volgende opslag.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { prepareIfcWrite, MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import type { PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { classify } from '@/services/ifc/foreign/classify';
import { cloneDomain, concat, mergeProblems, openForeign, sameBytes } from './ifcMergeKern';
import { openInStore, storeEdit, lengthen, lengthenedTask, TRIAS_FILES } from './ifcAppRoute';
import { generatedModel } from './ifcGeneratedModel';
import { installDeterminism } from './ifcPariteitKern';
import { readbackDifference } from './ifcReadbackEquality';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const reseed = installDeterminism();
const read = (name: string) => new Uint8Array(readFileSync(join(root, name)));
const withModel = (name: string) => generatedModel(root, readFileSync(join(root, name), 'latin1'), 0);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
let passed = 0, failed = 0;
async function check(label: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log(`OK ${label}`); }
  catch (error) { failed++; console.error(`XX ${label}`, error); }
}

async function sourceProof(result: PreparedIfcWrite, input: WriteIFCInput) {
  const bytes = concat(result.parts), source = result.source;
  assert.deepEqual(source.bytes, bytes);
  assert.equal(result.sha256, hash(bytes));
  assert.equal(source.sha256, result.sha256);
  assert(Object.isFrozen(source.opened));
  assert(Object.isFrozen(source.opened!.tasks));
  assert.deepEqual(source.opened, input, 'opened is de bevroren schrijfinvoer');
  const index = scanForeignStep(bytes), classified = classify(index);
  assert.deepEqual(source.classes, classified.classes, 'writerklassen = onafhankelijk ingedeelde uitvoer');
  assert.deepEqual(source.foreignMembers.map(c => source.chunkIds[c]), classified.foreignMembers.map(c => Number(index.id(c))));
  for (const task of input.tasks) {
    const step = source.stepIds[`task:${task.id}`];
    assert.equal(typeof step, 'number', `sessietaak ${task.id} heeft een uitvoer-id`);
    assert.equal(index.type(index.chunkOf(String(step))), 'IFCTASK');
  }
  const reopened = (await openForeign(bytes)).ifcSource!;
  assert.deepEqual(source.chunkStarts, reopened.chunkStarts);
  assert.deepEqual(source.chunkIds, reopened.chunkIds);
  assert.deepEqual(source.stepIds, reopened.stepIds, 'deze gevallen behouden de sessie-ids ook bij openen');
  assert.equal(source.schemaName, reopened.schemaName);
  assert.equal(source.foreign, reopened.foreign);
  assert.equal(source.foreignObjectCount, reopened.foreignObjectCount);
  assert.equal(source.lineEnding, reopened.lineEnding);
  assert(result.parts.every(part => part.buffer === source.bytes.buffer), 'delen houden alleen de nieuwe bronbuffer vast');
}

for (const [label, bytes] of [
  ['kantoor', withModel('public/examples/03-kantoorgebouw-zuidas.ifc')],
  ['eigen-plus-model', read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')],
  ['oude-villa', withModel(TRIAS_FILES[3])],
] as const) {
  await check(`${label}: drie saves met de nieuwe bron = heropenen, vreemd deel blijft bytegelijk`, async () => {
    const initial = await openForeign(bytes);
    let source = initial.ifcSource!, input = cloneDomain(initial), previous = bytes;
    let newId = '';
    for (let step = 0; step < 3; step++) {
      const reopened = await openForeign(previous);
      const edit = async (d: WriteIFCInput) => step === 0 ? lengthen(d, lengthenedTask(d).id)
        : step === 1 ? storeEdit(d, state => {
          state.addTask({ name: 'Nieuwe taak PR 8a' }, { phaseAssignments: 'move', answered: true });
        }) : storeEdit(d, state => { state.deleteTask(newId); });
      reseed(0x8a + step);
      input = await edit(input);
      if (step === 1) newId = input.tasks.find(t => t.name === 'Nieuwe taak PR 8a')!.id;
      const frozenBefore = structuredClone(input);
      const result = await prepareIfcWrite(input, source);
      await sourceProof(result, frozenBefore);
      assert.deepEqual(mergeProblems(bytes, result.source.bytes), []);
      reseed(0x8a + step);
      const inputReopen = await edit(cloneDomain(reopened));
      const viaReopen = await prepareIfcWrite(inputReopen, reopened.ifcSource!);
      const left = new TextDecoder().decode(concat(result.parts)).split('\n');
      const right = new TextDecoder().decode(concat(viaReopen.parts)).split('\n');
      const at = left.findIndex((line, i) => line !== right[i]);
      assert(sameBytes(concat(result.parts), concat(viaReopen.parts)), `${label}, stap ${step}: ${left[at]} != ${right[at]}; invoer: ${readbackDifference(input, inputReopen)}`);
      source = result.source;
      previous = source.bytes;
      assert.deepEqual(input, frozenBefore, 'de aanroeper is niet gewijzigd');
    }
  });
  await check(`${label}: zonder bewerking zijn bytes en bron dezelfde`, async () => {
    const opened = await openForeign(bytes);
    const result = await prepareIfcWrite(cloneDomain(opened), opened.ifcSource!);
    assert.strictEqual(result.source, opened.ifcSource);
    assert.deepEqual(concat(result.parts), bytes);
    assert.equal(result.sha256, hash(bytes));
  });
}

await check('vreemde herkomst: niets wijzigen bewaart de bron; wijzigen blijft veilig geweigerd', async () => {
  const bytes = read('tests/fixtures/ifc-foreign/bonsai-4d.ifc');
  const opened = await openForeign(bytes), input = cloneDomain(opened);
  const result = await prepareIfcWrite(input, opened.ifcSource!);
  assert.strictEqual(result.source, opened.ifcSource);
  assert.deepEqual(concat(result.parts), bytes);
  const edited = await storeEdit(input, state => { state.setProject({ name: 'Bewerkt' }); });
  await assert.rejects(prepareIfcWrite(edited, opened.ifcSource!), (e: unknown) => e instanceof MergeNeedsPhase2Error
    && e.cases.some(c => c.kind === 'vreemde-herkomst'));
});

await check('bewerking en undo: de oorspronkelijke bytes terug', async () => {
  const bytes = read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');
  const { store, snapshot } = await openInStore(bytes);
  const task = lengthenedTask(snapshot(store));
  store.getState().updateTask(task.id, { name: 'Tijdelijk' });
  store.getState().undo();
  const opened = snapshot(store), result = await prepareIfcWrite(cloneDomain(opened), opened.ifcSource!);
  assert.strictEqual(result.source, opened.ifcSource);
  assert.deepEqual(concat(result.parts), bytes);
});

await check('stuk 1 doorloopt dezelfde vaste uitvoercontrole', async () => {
  const opened = await openForeign(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
  await assert.rejects(prepareIfcWrite(cloneDomain(opened), opened.ifcSource!, async input => input),
    (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases.some(c => c.kind === 'open-stappen-ontbreken'));
});

await check('zonder vreemd deel: gewone writer met en zonder bewerking, ook op oud bestand', async () => {
  for (const file of ['public/examples/03-kantoorgebouw-zuidas.ifc', TRIAS_FILES[3]]) {
    const bytes = read(file), opened = await openForeign(bytes);
    assert.equal(opened.ifcSource!.foreign, false);
    for (const input of [cloneDomain(opened), await lengthen(cloneDomain(opened), lengthenedTask(opened).id)]) {
      const result = await prepareIfcWrite(input, opened.ifcSource!);
      assert.deepEqual(concat(result.parts), new TextEncoder().encode(writeIFC(input)));
      assert.notStrictEqual(result.source, opened.ifcSource);
      await sourceProof(result, input);
    }
  }
});

console.log(`Voorbereid schrijfresultaat: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
