// Alleen uitvoeren in CI: twee echte revisies, één fixture, afwisselende metingen op één runner.
// Gebruik: node tests/planning/measure-resource-load-reuse.mjs <uitgepakte-basis> <basis-sha> <uitvoer>
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const [beforePath, baseRef, outputPath] = process.argv.slice(2);
assert.ok(beforePath && /^[a-f0-9]{40}$/.test(baseRef) && outputPath, 'geef basispad, volledige SHA en uitvoermap');
const root = process.cwd();
const out = resolve(outputPath);
await mkdir(out, { recursive: true });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const head = git('rev-parse', 'HEAD');
// Deze smalle vergelijking geldt alleen voor deze ene productieaanpassing.
assert.equal(git('diff', '--name-only', baseRef, head, '--', 'src'), 'src/engine/scheduler/ResourceLoad.ts');
assert.equal(git('diff', '--name-only', 'HEAD', '--', 'src', 'tests/planning'), '');
const sha = value => createHash('sha256').update(value).digest('hex');
const fixturePath = join(root, 'tests/planning/resourceLoadReuseFixture.ts');
const modules = {};
const sources = {};
for (const [name, sourceRoot] of [['voor', resolve(beforePath)], ['na', root]]) {
  const outfile = join(out, `${name}.mjs`);
  await build({
    stdin: {
      contents: `export * from '@/engine/scheduler/ResourceLoad';
        export { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
        export { makeResourceLoadReuseFixture } from ${JSON.stringify(fixturePath)};`,
      resolveDir: sourceRoot,
    },
    bundle: true, platform: 'node', format: 'esm', outfile,
    alias: { '@': join(sourceRoot, 'src') }, nodePaths: [join(root, 'node_modules')],
    tsconfig: join(root, 'tsconfig.json'),
  });
  modules[name] = await import(pathToFileURL(outfile).href);
  sources[name] = {
    resourceLoadSha256: sha(await readFile(join(sourceRoot, 'src/engine/scheduler/ResourceLoad.ts'))),
    bundleSha256: sha(await readFile(outfile)),
  };
}

const result = {
  base: baseRef, head, node: process.version, platform: `${platform()} ${release()}`,
  cpu: cpus()[0]?.model, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  runUrl: process.env.GITHUB_RUN_ID
    ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
  fixtureSha256: sha(await readFile(fixturePath)), sources, warmups: 2, rounds: 5, cases: [],
};
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
for (const [taskCount, assignmentsPerTask] of [[1000, 1], [1000, 4], [1000, 8], [5000, 4]]) {
  const input = modules.na.makeResourceLoadReuseFixture(taskCount, assignmentsPerTask);
  const inputJson = JSON.stringify(input);
  for (const operation of ['belasting', 'histogram']) {
    const invoke = name => operation === 'belasting'
      ? modules[name].computeResourceLoad(input.resources, input.assignments, input.tasks, input.calendar, input.calendars)
      : modules[name].computeHistogramReport(input);
    const expected = JSON.stringify(invoke('voor'));
    const times = { voor: [], na: [] };
    const calls = {};
    for (const name of ['voor', 'na']) {
      const prototype = modules[name].CalendarEngine.prototype;
      const original = prototype.isWorkDay;
      calls[name] = 0;
      prototype.isWorkDay = function(date) { calls[name]++; return original.call(this, date); };
      try { assert.equal(JSON.stringify(invoke(name)), expected, `${name}: volledige uitvoer`); }
      finally { prototype.isWorkDay = original; }
    }
    for (let round = -result.warmups; round < result.rounds; round++) {
      const order = round % 2 === 0 ? ['voor', 'na'] : ['na', 'voor'];
      for (const name of order) {
        // GC en serialisatie vallen buiten het gemeten rekenwerk.
        globalThis.gc?.();
        const start = performance.now();
        const value = invoke(name);
        const ms = performance.now() - start;
        assert.equal(JSON.stringify(value), expected, `${name}: uitvoer in ronde ${round}`);
        if (round >= 0) times[name].push(ms);
      }
    }
    assert.equal(JSON.stringify(input), inputJson, 'geen invoermutatie');
    const row = {
      taskCount, assignmentsPerTask, operation, inputSha256: sha(inputJson), outputSha256: sha(expected),
      outputBytes: Buffer.byteLength(expected), calendarCalls: calls, milliseconds: times,
      medianBeforeMs: median(times.voor), medianAfterMs: median(times.na),
    };
    row.speedup = row.medianBeforeMs / row.medianAfterMs;
    result.cases.push(row);
    console.log(`${taskCount} × ${assignmentsPerTask} ${operation}: ${row.medianBeforeMs.toFixed(2)} → ${row.medianAfterMs.toFixed(2)} ms (${row.speedup.toFixed(2)}×); uitvoer ${row.outputSha256}`);
  }
}
await writeFile(join(out, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
const summary = [
  'Deze tekst is geplaatst door een AI-assistent.', '',
  `Basis: ${baseRef}; gemeten head: ${head}. Node ${result.node}; ${result.cpu}.`,
  'Dezelfde invoer en byte-identieke volledige uitvoer in iedere ronde. Twee opwarmrondes, vijf meetrondes; mediaan in ms.', '',
  '| Taken × toewijzingen | Berekening | Voor | Na | Factor | Kalenderaanroepen voor → na |',
  '| --- | --- | ---: | ---: | ---: | --- |',
  ...result.cases.map(r => `| ${r.taskCount} × ${r.assignmentsPerTask} | ${r.operation} | ${r.medianBeforeMs.toFixed(2)} | ${r.medianAfterMs.toFixed(2)} | ${r.speedup.toFixed(2)} | ${r.calendarCalls.voor} → ${r.calendarCalls.na} |`),
  '', 'Dit meet de twee lastlezers, niet de volledige laad-/F5-/browserroute. Geen tijdsdrempel als testpoort.',
  'Alle invoer-/uitvoer-/bronhashes en individuele meettijden staan in result.json.', '',
].join('\n');
await writeFile(join(out, 'summary.md'), summary);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary);
