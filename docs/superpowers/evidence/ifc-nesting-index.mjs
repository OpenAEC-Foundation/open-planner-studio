// Alleen in CI: node docs/superpowers/evidence/ifc-nesting-index.mjs --out resultaat.json
// De oude/nieuwe VOLLEDIGE readIFC draait afwisselend op dezelfde runner en dezelfde IFC-bytes.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deepStrictEqual } from 'node:assert';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const base = process.env.PERF_BASE_REVISION;
if (!/^[a-f0-9]{40}$/.test(base ?? '')) throw new Error('PERF_BASE_REVISION moet de gecontroleerde PR-basis zijn');
const head = git('rev-parse', 'HEAD');
git('merge-base', '--is-ancestor', base, head);
const reader = 'src/services/ifc/ifcReader.ts';
const changedProductFiles = git('diff', '--name-only', base, head, '--', 'src').split('\n');
deepStrictEqual(changedProductFiles, [reader], 'deze vergelijking is uitsluitend geldig voor de zelfstandige reader-PR');
if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('de meting vereist schone gecommitte bronnen');
const hash = value => createHash('sha256').update(value).digest('hex');
const baseSource = execFileSync('git', ['show', `${base}:${reader}`], { cwd: root, encoding: 'utf8' });
const sourceHashes = {
  baseReader: hash(baseSource), headReader: hash(readFileSync(join(root, reader))),
  fixture: hash(readFileSync(join(root, 'tests/planning/ifcNestingFixture.ts'))),
  measurement: hash(readFileSync(fileURLToPath(import.meta.url))),
};
const temp = mkdtempSync(join(tmpdir(), 'ops-ifc-nesting-'));
const rows = [];
const NativeDate = globalThis.Date;
const nativeRandom = Math.random;
const fixedNow = NativeDate.parse('2026-10-26T08:00:00Z');
// Alleen de klok en toeval staan vast. generateId blijft echte productiecode, inclusief zijn
// teller. Elke versie doet evenveel imports; de volledige payloads blijven exact vergelijkbaar.
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
  static now() { return fixedNow; }
};
function resetRandom() {
  let state = 0x1fc2026;
  Math.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
try {
  const modules = {};
  for (const version of ['basis', 'nieuw']) {
    const outfile = join(temp, `${version}.mjs`);
    await build({
      entryPoints: [join(root, 'tests/planning/measure-ifc-nesting.ts')],
      bundle: true, platform: 'node', format: 'esm', outfile,
      alias: { '@': join(root, 'src') }, logLevel: 'warning',
      plugins: version === 'basis' ? [{ name: 'vastgepinde-basis', setup(api) {
        api.onLoad({ filter: /[/]src[/]services[/]ifc[/]ifcReader\.ts$/ }, args => ({
          contents: baseSource, loader: 'ts', resolveDir: dirname(args.path),
        }));
      } }] : [],
    });
    modules[version] = await import(pathToFileURL(outfile).href);
  }
  for (const shape of ['breed', 'verdeeld']) {
    for (const size of [1000, 5000, 10000]) {
      const input = modules.nieuw.createIfcNestingFixture(size, shape);
      const text = modules.nieuw.writeIFC(input);
      const inputSha256 = hash(text);
      const maxChildren = Math.max(...input.tasks.map(t => t.childIds.length));
      const oldMembershipComparisons = input.tasks.reduce((n, t) => n + t.childIds.length * (t.childIds.length - 1) / 2, 0);
      for (let repeat = -2; repeat < 7; repeat++) {
        const versions = repeat % 2 === 0 ? ['basis', 'nieuw'] : ['nieuw', 'basis'];
        const results = {};
        for (const version of versions) {
          resetRandom();
          const api = modules[version];
          const start = performance.now();
          const imported = api.readIFC(text);
          const ms = performance.now() - start;
          // Deze keten en alle hashes vallen BUITEN het tijdvenster. Geen velden weglaten:
          // ook provenance, kalenders, GlobalIds, baseline en de assignment-id's tellen mee.
          const saved = api.writeIFC(imported);
          const reopened = api.readIFC(saved);
          const exportedAgain = api.writeIFC(reopened);
          results[version] = {
            ms, imported, reopened, saved, exportedAgain,
            hashes: {
              import: hash(JSON.stringify(imported)), save: hash(saved),
              reopen: hash(JSON.stringify(reopened)), secondExport: hash(exportedAgain),
            },
          };
        }
        deepStrictEqual(results.nieuw.imported, results.basis.imported, `${shape}/${size}: volledige ImportResult`);
        deepStrictEqual(results.nieuw.reopened, results.basis.reopened, `${shape}/${size}: volledige heropening`);
        deepStrictEqual(results.nieuw.hashes, results.basis.hashes, `${shape}/${size}: opslaan en tweede export bytegelijk`);
        if (repeat >= 0) {
          const row = {
            shape, size, repeat: repeat + 1, order: versions, inputSha256,
            inputBytes: Buffer.byteLength(text), maxChildren, oldMembershipComparisons,
            basisMs: results.basis.ms, nieuwMs: results.nieuw.ms,
            basisHashes: results.basis.hashes, nieuwHashes: results.nieuw.hashes,
          };
          rows.push(row);
          console.log(JSON.stringify(row));
        }
      }
    }
  }
  const summary = [];
  for (const shape of ['breed', 'verdeeld']) {
    for (const size of [1000, 5000, 10000]) {
      const samples = rows.filter(row => row.shape === shape && row.size === size);
      const basisMedianMs = median(samples.map(row => row.basisMs));
      const nieuwMedianMs = median(samples.map(row => row.nieuwMs));
      summary.push({ shape, size, basisMedianMs, nieuwMedianMs,
        improvementPercent: 100 * (basisMedianMs - nieuwMedianMs) / basisMedianMs });
    }
  }
  const evidence = {
    base, head, sourceHashes, node: process.version,
    runner: { name: process.env.RUNNER_NAME, os: process.env.RUNNER_OS,
      image: process.env.ImageOS, imageVersion: process.env.ImageVersion,
      runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT },
    cpu: cpus()[0].model, logicalCpus: cpus().length,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    clock: new NativeDate(fixedNow).toISOString(), warmups: 2, repeats: 7,
    measured: 'Alleen readIFC: STEP-parsing en alle extractors; geen UI, schijf-I/O, store of F5',
    summary, rows,
  };
  const outIndex = process.argv.indexOf('--out');
  if (outIndex < 0 || !process.argv[outIndex + 1]) throw new Error('--out ontbreekt');
  writeFileSync(process.argv[outIndex + 1], JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ summary, parity: 'volledige payloads en beide exports identiek', exit: 0 }));
} finally {
  globalThis.Date = NativeDate;
  Math.random = nativeRandom;
  rmSync(temp, { recursive: true, force: true });
}
