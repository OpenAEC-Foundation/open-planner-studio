// Alleen meten: dezelfde twee bestanden en dezelfde voortgangsactie als de eindtelling.
import { readFileSync } from 'node:fs';
import { installDeterminism } from '../../../../../tests/planning/ifcPariteitKern';
import { applyEdit, cloneDomain, openForeign, ordinaryEdits, tryMerge } from '../../../../../tests/planning/ifcMergeKern';
installDeterminism();
// Neem de wand letterlijk uit de telling, zonder die volledige batterij opnieuw te draaien.
const test = readFileSync('tests/planning/check-ifc-foreign-merge-telling.ts', 'utf8');
const start = test.indexOf('const REVIT_WALL = ') + 'const REVIT_WALL = '.length;
const end = test.indexOf('\n];', start) + 2;
const wall = new Function('return '+test.slice(start,end))() as string[];
for (const file of ['ifc-arity-oude-writer.ifc','b5-lopend-oude-writer.ifc']) {
 const raw=readFileSync('tests/planning/fixtures/'+file,'latin1');
 const at=raw.lastIndexOf('ENDSEC;');
 const bytes=Uint8Array.from(raw.slice(0,at)+wall.map(l=>l+'\n').join('')+raw.slice(at),c=>c.charCodeAt(0));
 const opened=await openForeign(bytes);
 const edit=ordinaryEdits(opened).find(e=>e.kind==='voortgang')!;
 const input=await applyEdit(edit,cloneDomain(opened));
 const outcome=await tryMerge(input,opened.ifcSource!);
 console.log(JSON.stringify({file,bewerking:edit.label,outcome:outcome.ok?'schrijft':'weigert',cases:outcome.ok?[]:outcome.error.cases},null,2));
}
