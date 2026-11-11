// 1107: de open-stappen zijn verplicht en hun volledige uitkomst wordt getoetst.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDeterminism } from './ifcPariteitKern';
import { canon, cloneDomain, ordinaryEdits, openForeign, openReadPlanning, tryMerge } from './ifcMergeKern';
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
// Bewuste afwijking in de callback, geen echte bronfout: raakt een veld buiten sourceFormProblems.
await assert.rejects(() => writeIfcMerge(d, source, async parsed => {
  const shown = structuredClone(await openReadPlanning(parsed));
  shown.tasks[0].name += ' afwijkend na openen';
  return shown;
}), (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases.some(c => c.kind === 'planning-na-openen' && c.detail.includes('.name')));
// Een gewone duurwijziging: als deze nieuw weigert, bewijs het verschil met een volledige heropening.
const longer = cloneDomain(opened);
ordinaryEdits(longer).find(e => e.kind === 'duur')!.apply(longer);
const result = await tryMerge(longer, source);
if (!result.ok) console.log('DUUR WEIGERT', JSON.stringify(result.error.cases));
console.log('OK herleestoets: verplichte naad, bewust afwijkende callback en gelijkheid met volledige heropening');
