// Alleen in GitHub CI: begrensde voor/nameting van echte storeacties op dezelfde runner.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { deepStrictEqual } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseline = 'fbd4a3f9dcc7bdd308ab86b992d0b26f4670a553';
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const path = 'src/state/insertedBranch.ts';
const oldSource = execFileSync('git', ['show', `${baseline}:${path}`], { cwd: root, encoding: 'utf8' });
const newSource = readFileSync(join(root, path), 'utf8');
const sha = data => createHash('sha256').update(data).digest('hex');
const out = resolve(process.argv[2] ?? 'qa/inserted-branch.json');
const temp = mkdtempSync(join(tmpdir(), 'ops-inserted-branch-'));
const result = { baseline, head, changedProductFile: path,
  beforeSourceSha256: sha(oldSource), afterSourceSha256: sha(newSource),
  node: process.version, cpu: cpus()[0].model, timezone: process.env.TZ,
  warmups: 1, samples: 3, maxSampleMs: 10000, parity: [], rows: [], skipped: [] };
const NativeDate = Date;
const fixedTime = NativeDate.parse('2026-10-26T10:00:00Z');
// Tijd en toeval zijn gelijk; de twee geïsoleerde bundels hebben hun eigen id-/meldingentellers.
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [fixedTime])); }
  static now() { return fixedTime; }
};
const nativeRandom = Math.random;
function resetRandom() {
  let state = 0x5eed;
  Math.random = () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296);
}
try {
  const versions = [];
  for (const [name, source] of [['before', oldSource], ['after', newSource]]) {
    const outfile = join(temp, `${name}.mjs`);
    await build({
      entryPoints: [join(root, 'tests/planning/insertedBranchMeasure.ts')],
      bundle: true, platform: 'node', format: 'esm', outfile,
      alias: { '@': join(root, 'src') }, logLevel: 'error',
      define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true',
        'import.meta.env.MODE': '"production"', '__OPS_DEV_INSTANCE__': '"measure-inserted-branch"' },
      plugins: [{ name: 'inserted-branch', setup(b) {
        b.onLoad({ filter: /\/state\/insertedBranch\.ts$/ }, () => ({
          contents: source, loader: 'ts', resolveDir: join(root, 'src/state'),
        }));
      } }],
    });
    resetRandom();
    versions.push(await import(pathToFileURL(outfile).href));
  }
  function pair(size, count, route, auto, corrupt, history, reverse) {
    const values = [];
    for (const v of reverse ? [1, 0] : [0, 1]) {
      resetRandom();
      values[v] = versions[v].createFixture(size, count, route, auto, corrupt).run(history);
    }
    for (const phase of Object.keys(values[0].hashes)) {
      deepStrictEqual(values[0].hashes[phase], values[1].hashes[phase], `${size}/${count}/${route}/${auto}/${phase}`);
    }
    deepStrictEqual(values[0].returned, values[1].returned, 'teruggegeven ids');
    return { beforeMs: values[0].ms, afterMs: values[1].ms, hashes: values[0].hashes,
      order: reverse ? ['after', 'before'] : ['before', 'after'] };
  }
  // Uitvoerpariteit van de hele store, inclusief ongeldige data en weigeringmeldingen.
  // De bestaande invoegroute doet geen kringcheck per relatie; ook dát gedrag moet gelijk blijven.
  for (const route of ['paste', 'cross-document', 'template']) {
    for (const auto of [false, true]) {
      const sample = pair(20, 6, route, auto, true, true, false);
      result.parity.push({ route, auto, ...sample });
    }
  }
  // Eerst 100, pas daarna 500/1000. Een traag klein geval slaat grotere gevallen expliciet over.
  const started = performance.now();
  for (const size of [5000, 10000]) {
    for (const route of ['paste', 'cross-document', 'template']) {
      let priorMs = 0;
      for (const count of [100, 500, 1000]) {
        if (priorMs > 2500 || performance.now() - started > 240000) {
          result.skipped.push({ size, route, count, reason: 'vooraf afgesproken tijdlimiet' });
          continue;
        }
        const samples = [];
        for (let i = 0; i < 4; i++) {
          const sample = pair(size, count, route, false, false, false, i % 2 === 1);
          priorMs = Math.max(sample.beforeMs, sample.afterMs);
          if (i > 0) samples.push(sample);
          if (priorMs > result.maxSampleMs) break;
        }
        result.rows.push({ size, route, count, auto: false, samples });
        console.log(JSON.stringify(result.rows.at(-1)));
      }
    }
  }
} finally {
  globalThis.Date = NativeDate;
  Math.random = nativeRandom;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  rmSync(temp, { recursive: true, force: true });
}
