// De TS-runner ruimt uitsluitend zijn eigen bundelmap op, ook na build- en uitvoerfouten.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let passed = 0;
let failed = 0;
function check(ok: boolean, label: string) {
  if (ok) { passed++; console.log('OK', label); }
  else { failed++; console.error('XX', label); }
}
// run.sh bundelt naast deze bron; de aanroeper hoeft niet in de repository te staan.
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '');
const dir = mkdtempSync(join(tmpdir(), 'ops-runts-check-'));
function run(name: string, source: string | null, args: string[] = []) {
  const temp = join(dir, name);
  mkdirSync(temp);
  const sentinel = join(temp, 'ops-runts-existing');
  mkdirSync(sentinel);
  writeFileSync(join(sentinel, 'keep.txt'), 'bewaren');

  const entry = join(dir, name + '.ts');
  if (source !== null) writeFileSync(entry, source);
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/run-ts.mjs'), ...(source === null ? [] : [entry]), ...args], {
    cwd: root, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, TMPDIR: temp, TMP: temp, TEMP: temp },
  });
  check(!result.error, name + ': proces kon draaien');
  check(JSON.stringify(readdirSync(temp)) === JSON.stringify(['ops-runts-existing']), name + ': geen achtergebleven bundelmap');
  check(readFileSync(join(sentinel, 'keep.txt'), 'utf8') === 'bewaren', name + ': bestaande map blijft intact');
  return result;
}
try {
  const good = run('success', 'console.log(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));', ['een', 'twee woorden']);
  check(good.status === 0, 'succes behoudt exitcode 0');
  const data = JSON.parse(good.stdout);
  check(JSON.stringify(data.args) === JSON.stringify(['een', 'twee woorden']), 'argumenten ongewijzigd doorgegeven');
  check(data.cwd === root, 'werkmap blijft de repository');
  const exit = run('exit', 'process.exit(7);');
  check(exit.status === 7, 'expliciete exitcode van de entry blijft behouden');
  const runtime = run('runtime', "throw new Error('fixture-runtime-failure');");
  check(runtime.status === 1 && runtime.stderr.includes('fixture-runtime-failure'), 'uitvoerfout blijft zichtbaar');
  const build = run('build', 'const invalid = ;');
  check(build.status !== 0 && build.stderr.includes('ERROR'), 'buildfout blijft zichtbaar');
  const usage = run('usage', null);
  check(usage.status === 2 && usage.stderr.includes('gebruik:'), 'ontbrekende entry behoudt gebruiksmelding');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(passed + ' groen, ' + failed + ' rood');
if (failed) process.exit(1);
