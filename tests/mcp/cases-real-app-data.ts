import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'realApp', 'runData.mjs');
const runData = (...args: string[]) => execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' });

function readScope(bytes: Buffer): { allowed: string[]; forbidden: string[] } {
  let at = 0;
  const u64 = () => { const n = Number(bytes.readBigUInt64LE(at)); at += 8; return n; };
  const list = () => Array.from({ length: u64() }, () => {
    const n = u64(), text = bytes.toString('utf8', at, at + n);
    at += n;
    return text;
  });
  const allowed = list(), forbidden = list();
  assert.equal(at, bytes.length, 'niets na de twee lijsten');
  return { allowed, forbidden };
}

const runs: string[][] = [];
try {
  for (let i = 0; i < 2; i++) {
    const [data, opsDir, granted] = runData('create').trim().split('\n');
    runs.push([data, granted]);
    assert.equal(opsDir, join(data, 'org.openaec.planner', 'ops-test'), 'het opdrachtkanaal in de appDataDir onder XDG_DATA_HOME');
    assert.deepEqual(readdirSync(opsDir), [], `run ${i + 1}: een leeg opdrachtkanaal`);
    assert.deepEqual(readdirSync(granted), [], `run ${i + 1}: een lege vrijgegeven map`);
    assert(!granted.startsWith(`${homedir()}/`), 'de vrijgegeven map ligt buiten de thuismap');
    assert.deepEqual(readScope(readFileSync(join(data, 'org.openaec.planner', '.persisted-scope'))),
      { allowed: [granted, `${granted}/*`], forbidden: [] }, `run ${i + 1}: de scope noemt precies de eigen map, zoals de mapkiezer`);
    writeFileSync(join(opsDir, 'ready.json'), '{}');
    writeFileSync(join(granted, 'model.ifc'), 'x');
  }
  const [[dataA, grantedA], [dataB, grantedB]] = runs;
  assert.notEqual(dataA, dataB, 'elke run een eigen datamap');
  assert.notEqual(grantedA, grantedB, 'elke run een eigen vrijgegeven map');
  runData('remove', dataA, grantedA);
  assert.deepEqual([existsSync(dataA), existsSync(grantedA)], [false, false], 'de opruiming haalt de datamap en de vrijgegeven map weg');
  assert.deepEqual([existsSync(dataB), existsSync(grantedB)], [true, true], 'en raakt een andere run niet');
  runData('remove', dataA, grantedA);
  console.log('Eigen datamap per run van de echte-app-proef: OK');
} finally {
  for (const dirs of runs) runData('remove', ...dirs);
}
