import { writeFileSync } from 'node:fs';
import { entered, routes, TRIAS_FILES, bareBytes, openInStore } from './duuractie';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { installDeterminism } from '../../../../../tests/planning/ifcPariteitKern';
installDeterminism();
const [root, out] = process.argv.slice(2);
const results = [];
for (const rel of TRIAS_FILES) for (const route of routes) {
  const e = await entered(bareBytes(root, rel), route);
  const saved = writeIFC(e.domain);
  const { store, snapshot } = await openInStore(new TextEncoder().encode(saved));
  const { ifcSource: _source, ...planning } = snapshot(store);
  results.push({ bestand: rel, route, before: e.before, afterEntry: e.afterEntry, afterF5: e.afterF5, planning });
}
writeFileSync(out, JSON.stringify({ basis: '20b9af79a74e7d886c2a38f93bba1adbcbb2ba5c', results }, null, 2) + '\n');
console.log(`MAIN: ${results.length} echte duuracties en gewone opslagen zonder model gemeten`);
