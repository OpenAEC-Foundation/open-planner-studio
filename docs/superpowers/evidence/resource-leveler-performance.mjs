// Reproductie: node docs/superpowers/evidence/resource-leveler-performance.mjs [--base ref] [--sizes 1000,5000,10000] [--warmups 2] [--repeats 3] [--out pad.json]
// Alleen de twee gewijzigde motorbestanden komen voor de oude bundel uit de basiscommit.
// Alle overige bronnen zijn op deze branch gelijk. Geen checkout, store of browser nodig.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, cpus, loadavg, freemem } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const sizes = (arg('--sizes') ?? '1000,5000,10000').split(',').map(Number);
const repeats = Number(arg('--repeats') ?? 3);
const warmups = Number(arg('--warmups') ?? 0);
if (!Number.isInteger(repeats) || repeats < 1 || !Number.isInteger(warmups) || warmups < 0 || sizes.some(n => !Number.isInteger(n) || n < 10)) throw new Error('ongeldige groottes/herhalingen');
const base = execFileSync('git', ['rev-parse', arg('--base') ?? '522589202727a4a519b25b94aed196d844dc6ab8'], { cwd: root, encoding: 'utf8' }).trim();
const paths = ['src/engine/scheduler/CPMSolver.ts', 'src/engine/scheduler/ResourceLeveler.ts'];
const changed = execFileSync('git', ['diff', '--name-only', base, '--', 'src/'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
if (changed.some(path => !paths.includes(path))) throw new Error(`Deze meetroute isoleert alleen ${paths.join(', ')}; overige productwijzigingen: ${changed.join(', ')}`);
execFileSync('git', ['diff', '--quiet', base, '--', 'package.json', 'package-lock.json'], { cwd: root });
const temp = mkdtempSync(join(tmpdir(), 'ops-leveler-perf-'));
const rows = [];
try {
  const modules = {};
  for (const version of ['before', 'after']) {
    const outfile = join(temp, `${version}.mjs`);
    await build({ entryPoints: [join(root, 'tests/planning/measure-leveler.ts')], bundle: true,
      platform: 'node', format: 'esm', outfile, alias: { '@': join(root, 'src') }, logLevel: 'warning',
      plugins: version === 'before' ? [{ name: 'basiscommit', setup(api) {
        api.onLoad({ filter: /[/]src[/]engine[/]scheduler[/](CPMSolver|ResourceLeveler)\.ts$/ }, args => ({
          contents: execFileSync('git', ['show', `${base}:${args.path.slice(root.length + 1)}`], { cwd: root, encoding: 'utf8' }),
          loader: 'ts', resolveDir: resolve(args.path, '..'),
        }));
      } }] : [],
    });
    modules[version] = await import(pathToFileURL(outfile).href);
  }
  for (const size of sizes) {
    const runs = Object.fromEntries(['before', 'after'].map(v => [v, modules[v].createMeasurement(size)]));
    let expected;
    for (let repeat = -warmups; repeat < repeats; repeat++) {
      for (const version of repeat % 2 ? ['after', 'before'] : ['before', 'after']) {
        const load = loadavg();
        const result = runs[version]();
        const { ms, ...parity } = result;
        if (expected && JSON.stringify(parity) !== JSON.stringify(expected)) throw new Error(`pariteit faalt bij ${size}/${version}`);
        expected = parity;
        const row = { size, repeat: repeat + 1, warmup: repeat < 0, version, ...result, loadBefore: load };
        rows.push(row);
        console.log(JSON.stringify(row));
      }
    }
  }
  const sourceHashes = Object.fromEntries(paths.map(path => [path, {
    before: execFileSync('git', ['rev-parse', `${base}:${path}`], { cwd: root, encoding: 'utf8' }).trim(),
    after: execFileSync('git', ['hash-object', path], { cwd: root, encoding: 'utf8' }).trim(),
  }]));
  const evidence = { base, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sourceHashes, warmups, repeats, node: process.version, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cpu: cpus()[0].model, logicalCpus: cpus().length, freeMemoryAtEnd: freemem(), at: new Date().toISOString(), rows };
  if (arg('--out')) writeFileSync(arg('--out'), JSON.stringify(evidence, null, 2) + '\n');
} finally { rmSync(temp, { recursive: true, force: true }); }
