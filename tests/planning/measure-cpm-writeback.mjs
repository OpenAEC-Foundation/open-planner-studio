// Handmatige voor/nameting met de echte oude en nieuwe runCPM, om en om in dezelfde Node-runtime.
// node tests/planning/measure-cpm-writeback.mjs [baseline-ref] [uitvoer.json]
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deepStrictEqual } from 'node:assert';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseline = process.argv[2] ?? '522589202';
const out = resolve(process.argv[3] ?? 'qa/cpm-writeback.json');
const path = 'src/state/slices/scheduleSlice.ts';
const oldSource = execFileSync('git', ['show', `${baseline}:${path}`], { cwd: root, encoding: 'utf8' });
const newSource = readFileSync(join(root, path), 'utf8');
const temp = mkdtempSync(join(tmpdir(), 'ops-cpm-writeback-'));
const rows = [];
try {
  const versions = [];
  // Alleen scheduleSlice verschilt: dezelfde solver, invoer, Immer-versie en bundelopties.
  for (const [name, source] of [['before', oldSource], ['after', newSource]]) {
    const outfile = join(temp, `${name}.mjs`);
    await build({
      entryPoints: [join(root, 'tests/planning/cpmWritebackMeasure.ts')],
      bundle: true, platform: 'node', format: 'esm', outfile,
      alias: { '@': join(root, 'src') }, logLevel: 'error',
      define: {
        'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true',
        'import.meta.env.MODE': '"production"', '__OPS_DEV_INSTANCE__': '"measure"',
      },
      plugins: [{ name: 'schedule-slice', setup(b) {
        b.onLoad({ filter: /\/state\/slices\/scheduleSlice\.ts$/ }, () => ({
          contents: source, loader: 'ts', resolveDir: join(root, 'src/state/slices'),
        }));
      } }],
    });
    versions.push(await import(pathToFileURL(outfile).href));
  }
  for (const size of [1000, 5000, 10000]) {
    for (const changed of [false, true]) {
      const fixtures = versions.map(v => v.createMeasurement(size));
      const samples = [];
      for (let i = 0; i < 9; i++) {
        const order = i % 2 ? [1, 0] : [0, 1];
        const pair = [];
        const load = loadavg();
        for (const v of order) pair[v] = fixtures[v].run(changed);
        deepStrictEqual(pair[0].sha256, pair[1].sha256, `${size}/${changed}/${i}: uitkomstpariteit`);
        if (i >= 2) samples.push({ beforeMs: pair[0].ms, afterMs: pair[1].ms, sha256: pair[0].sha256, order, load });
      }
      rows.push({ size, changed, samples });
      console.log(`${size}, ${changed ? 'na duurwijziging' : 'ongewijzigd'}: ${JSON.stringify(samples.map(s => [s.beforeMs, s.afterMs]))}`);
    }
  }
  const sha = source => createHash('sha256').update(source).digest('hex');
  writeFileSync(out, JSON.stringify({
    date: new Date().toISOString(), baseline, node: process.version, v8: process.versions.v8,
    cpu: cpus()[0].model, seed: '0x5eed', warmups: 2, runs: 7,
    beforeSourceSha256: sha(oldSource), afterSourceSha256: sha(newSource), rows,
  }, null, 2) + '\n');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
