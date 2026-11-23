import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTSIDE_FILE_NAME, readScope } from './realApp/persistedScope.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'realApp', 'runData.mjs');
const runData = (...args: string[]) => execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' });

const runs: string[][] = [];
try {
  for (let i = 0; i < 2; i++) {
    const [data, opsDir, outside] = runData('create').trim().split('\n');
    runs.push([data, outside]);
    assert.equal(opsDir, join(data, 'org.openaec.planner', 'ops-test'), 'het opdrachtkanaal in de appDataDir onder XDG_DATA_HOME');
    assert.deepEqual(readdirSync(opsDir), [], `run ${i + 1}: een leeg opdrachtkanaal`);
    assert.deepEqual(readdirSync(outside), [], `run ${i + 1}: een lege map buiten de thuismap`);
    assert(!outside.startsWith(`${homedir()}/`), 'de map ligt buiten de thuismap');
    assert.deepEqual(readScope(readFileSync(join(data, 'org.openaec.planner', '.persisted-scope'))),
      { allowed: [join(outside, OUTSIDE_FILE_NAME)], forbidden: [] }, `run ${i + 1}: de scope noemt alleen het bestand, zoals de bestandskiezer`);
    writeFileSync(join(opsDir, 'ready.json'), '{}');
    writeFileSync(join(outside, OUTSIDE_FILE_NAME), 'x');
  }
  const [[dataA, outsideA], [dataB, outsideB]] = runs;
  assert.notEqual(dataA, dataB, 'elke run een eigen datamap');
  assert.notEqual(outsideA, outsideB, 'elke run een eigen map buiten de thuismap');
  runData('remove', dataA, outsideA);
  assert.deepEqual([existsSync(dataA), existsSync(outsideA)], [false, false], 'de opruiming haalt de datamap en de map buiten de thuismap weg');
  assert.deepEqual([existsSync(dataB), existsSync(outsideB)], [true, true], 'en raakt een andere run niet');
  runData('remove', dataA, outsideA);
  console.log('Eigen datamap per run van de echte-app-proef: OK');
} finally {
  for (const dirs of runs) runData('remove', ...dirs);
}
