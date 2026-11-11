// 1107: de open-stappen zijn verplicht en hun volledige uitkomst wordt getoetst.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedModel } from './ifcGeneratedModel';
import { storeWith } from './ifcAppRoute';
import { readFileSync } from 'node:fs';
import { installDeterminism } from './ifcPariteitKern';
import { canon, cloneDomain, applyEdit, ordinaryEdits, openForeign, openReadPlanning, shownAfterOpen, tryMerge } from './ifcMergeKern';
import { writeIfcMerge, MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';

const reseed = installDeterminism();
const bytes = new Uint8Array(readFileSync(new URL('../fixtures/ifc-foreign/eigen-plus-model.ifc', import.meta.url)));
const opened = await openForeign(bytes);
const source = opened.ifcSource!;
const d = cloneDomain(opened);
await assert.rejects(async () => {
  // Ook voor JS-aanroepers: zonder functie geen uitvoer, vóór de writer iets opbouwt.
  // @ts-expect-error De derde parameter is verplicht.
  await writeIfcMerge(d, source);
}, (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases[0].kind === 'open-stappen-ontbreken');

const saved = await tryMerge(d, source);
assert(saved.ok, saved.ok ? '' : JSON.stringify(saved.error.cases));
assert.equal(canon(await openForeign(saved.bytes), reseed), canon(saved.shown, reseed), 'naad = bytes-route');
// Gemaakte proef van Trias: alleen aan de uitvoerkant verandert een invoerveld vóór de echte herberekening.
await assert.rejects(() => writeIfcMerge(d, source, async (parsed, side) => {
  const input = structuredClone(parsed);
  if (side === 'uitvoer') await ordinaryEdits(input).find(e => e.kind === 'duur')!.apply(input);
  return openReadPlanning(input, side);
}), (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases.some(c => c.kind === 'planning-na-openen' && c.detail.includes('.time.')));
// Blijvende proef: een duurwijziging zonder F5 schrijft; de twaalf tijdvelden normaliseren gelijk.
const longer = cloneDomain(opened);
await ordinaryEdits(longer).find(e => e.kind === 'duur')!.apply(longer);
const result = await tryMerge(longer, source);
assert(result.ok, result.ok ? '' : JSON.stringify(result.error.cases));
const wanted = await shownAfterOpen(longer);
const full = await openForeign(result.bytes);
assert.equal(canon(wanted, reseed), canon(full, reseed));
assert.equal(canon(result.shown, reseed), canon(full, reseed));
let fields = 0;
for (const task of longer.tasks) {
  const back = full.tasks.find(t => t.id === task.id)!;
  for (const key of Object.keys(task.time) as (keyof typeof task.time)[]) if (task.time[key] !== back.time[key]) fields++;
}
assert.equal(fields, 12, 'de twaalf opnieuw berekende tijdvelden van de eerdere stop');
// De gedeelde voortgangsbewerking gebruikt enterTaskProgress, inclusief bevestigen van een startvraag.
const progressed = await applyEdit(ordinaryEdits(opened).find(e => e.kind === 'voortgang')!, cloneDomain(opened));
const progressTask = progressed.tasks.find(t => t.childIds.length === 0 && !t.isMilestone)!;
assert.equal(progressTask.time.completion, 0.5);
assert.equal(progressTask.status, 'STARTED');
assert(progressTask.time.actualStart);
const progressMerge = await tryMerge(progressed, source);
assert(progressMerge.ok, progressMerge.ok ? '' : JSON.stringify(progressMerge.error.cases));
assert.equal(canon(progressMerge.shown, reseed), canon(await openForeign(progressMerge.bytes), reseed));
console.log('OK herleestoets: verplichte naad, afwijkende herberekening van de uitvoer en gelijkheid met volledige heropening');

// Observatie van 1113 via de echte setter: de rest hoort vóór opslaan al 0 te zijn.
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const raw = readFileSync(join(root, 'tests/planning/fixtures/oude-tags/v2026.9.0-17-cijfers-10-villa-wassenaar.ifc'), 'utf8');
  const o = await openForeign(generatedModel(root, raw, 0));
  const { store, buildWriteIFCInput } = await storeWith(cloneDomain(o));
  const task = store.getState().tasks.find(t => t.name === 'Set up site')!;
  const before = task.time.remainingTime;
  assert.equal(store.getState().setActualFinish(task.id, task.time.scheduleFinish), true);
  const input = buildWriteIFCInput(store.getState());
  const afterEntry = input.tasks.find(t => t.id === task.id)!.time.remainingTime;
  assert.equal(afterEntry, 0, 'de echte invoer zet de rest al vóór opslaan op 0');
  const shown = await shownAfterOpen(input);
  const normalized = shown.tasks.find(t => t.id === task.id)!.time.remainingTime;
  const merge = await tryMerge(input, o.ifcSource!);
  console.log('1113', JSON.stringify({ route: 'setActualFinish', before, afterEntry, normalized, merge: merge.ok ? 'schrijft' : merge.error.cases }));
  if (merge.ok) {
    const full = await openForeign(merge.bytes);
    console.log('1113 naad/bytes', merge.shown.tasks.find(t => t.id === task.id)!.time.remainingTime, full.tasks.find(t => t.id === task.id)!.time.remainingTime);
    assert.equal(canon(merge.shown, reseed), canon(full, reseed));
  }
}
