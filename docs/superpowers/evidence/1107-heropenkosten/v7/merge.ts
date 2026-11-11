import { readFileSync, writeFileSync } from 'node:fs';
import { entered, routes, TRIAS_FILES, modelBytes } from './duuractie';
import { canon, openForeign, shownAfterOpen, tryMerge, firstDiff } from '../../../../../tests/planning/ifcMergeKern';
import { installDeterminism } from '../../../../../tests/planning/ifcPariteitKern';
const [root, mainFile, out] = process.argv.slice(2);
const main = JSON.parse(readFileSync(mainFile, 'utf8'));
const reseed = installDeterminism();
const results = [];
for (const bestand of TRIAS_FILES) for (const route of routes) {
  const e = await entered(modelBytes(root, bestand), route);
  const normalized = await shownAfterOpen(e.domain);
  const r = await tryMerge(e.domain, e.domain.ifcSource!);
  const back = r.ok ? await openForeign(r.bytes) : undefined;
  const reference = main.results.find((x: {bestand:string;route:string}) => x.bestand === bestand && x.route === route);
  const same = back ? canon(back, reseed) === canon(reference.planning, reseed) : undefined;
  const record = { bestand, route, taskId: e.taskId, taskName: e.taskName, args: e.args,
    before: e.before, afterEntry: e.afterEntry, afterF5: e.afterF5,
    afterDomainOpen: normalized.tasks.find(t => t.id === e.taskId)!.time,
    merge: r.ok ? 'schrijft' : 'weigert', melding: r.ok ? [] : r.error.cases,
    afterFullOpen: back?.tasks.find(t => t.id === e.taskId)?.time,
    sameAsMain: same, firstDifference: back && !same ? firstDiff(canon(reference.planning, reseed), canon(back, reseed)) : undefined };
  results.push(record);
  console.log(JSON.stringify({ bestand, route, merge: record.merge, melding: record.melding, sameAsMain: same, firstDifference: record.firstDifference }));
}
writeFileSync(out, JSON.stringify({ basis: 'd6549d03271a3a2cc77220bf6d150ae2836c6536', main: main.basis, results }, null, 2) + '\n');
