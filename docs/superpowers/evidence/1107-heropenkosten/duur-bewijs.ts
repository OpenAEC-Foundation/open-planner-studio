// Alleen draaien met de nieuwe vergelijkingsweigering tijdelijk uit, voor het bewijs van de stopbevinding.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDeterminism } from '../../../../tests/planning/ifcPariteitKern';
import { canon, cloneDomain, concat, openForeign, openReadPlanning, ordinaryEdits, type Domain } from '../../../../tests/planning/ifcMergeKern';
import { writeIfcMerge } from '@/services/ifc/foreign/mergeWriter';
const reseed = installDeterminism();
const opened = await openForeign(new Uint8Array(readFileSync('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const input = cloneDomain(opened);
const edit = ordinaryEdits(input).find(e => e.kind === 'duur')!;
edit.apply(input);
let shown: Domain | undefined;
const parts = await writeIfcMerge(input, opened.ifcSource!, async parsed => {
  shown = await openReadPlanning(parsed); return shown;
});
const full = await openForeign(concat(parts));
assert(shown);
assert.equal(canon(shown, reseed), canon(full, reseed), 'naad en volledige heropening moeten gelijk zijn');
assert.notEqual(canon(input, reseed), canon(full, reseed), 'zonder toets schrijft de merge een planning die na openen afwijkt');
const differences = input.tasks.flatMap(t => {
  const back = full.tasks.find(b => b.id === t.id)!;
  return Object.keys(t.time).filter(k => t.time[k as keyof typeof t.time] !== back.time[k as keyof typeof back.time])
    .map(k => ({ taak: t.id, veld: `time.${k}`, gezien: t.time[k as keyof typeof t.time], heropend: back.time[k as keyof typeof back.time] }));
});
console.log(JSON.stringify({ bestand:'eigen-plus-model.ifc', bewerking:edit.label, uitvoerBytes: parts.reduce((n,p)=>n+p.length,0),
  naadGelijkAanBytes:true, planningWijktAf:true, differences }, null, 2));
