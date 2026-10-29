// Voor/nameting op dezelfde runner. Op deze host uitsluitend uitvoeren via GitHub CI.
// node docs/superpowers/evidence/ifc-kalenderindex.mjs --base <sha> --out <bestand.json>
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const base = arg('--base');
if (!base || !/^[a-f0-9]{40}$/.test(base)) throw new Error('--base vereist een volledige commit-SHA');
const writerPath = 'src/services/ifc/ifcWriter.ts';
const changed = git('diff', '--name-only', base, 'HEAD', '--', 'src').split('\n').filter(Boolean);
if (changed.some(path => path !== writerPath)) throw new Error('Andere productcode gewijzigd: één oude writer is geen geldige nulmeting');
if (git('status', '--porcelain', '--untracked-files=no', '--', 'src')) throw new Error('Productcode heeft niet-gecommitteerde wijzigingen');
const hash = value => createHash('sha256').update(value).digest('hex');
const normalizeTime = ifc => {
  const stamp = /^FILE_NAME\('[^']*','([^']*)'/m.exec(ifc)?.[1];
  if (!stamp) throw new Error('Schrijftijd ontbreekt in IFC-kop');
  return ifc.split(`'${stamp}'`).join("'<tijd>'")
    .replace(/^(#\d+=IFCOWNERHISTORY\((?:[^,]*,){7})\d+\)/m, '$1<tijd>)');
};
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const temp = mkdtempSync(join(tmpdir(), 'ops-ifc-kalenderindex-'));
const rows = [];
try {
  const modules = {};
  for (const version of ['before', 'after']) {
    const outfile = join(temp, `${version}.mjs`);
    await build({
      stdin: { contents: "export { writeIFC } from '@/services/ifc/ifcWriter'; export { ifcCalendarIndexFixture } from './tests/planning/ifcCalendarIndexFixture';", resolveDir: root, loader: 'ts' },
      bundle: true, platform: 'node', format: 'esm', outfile,
      alias: { '@': join(root, 'src') }, logLevel: 'warning',
      define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"' },
      plugins: version === 'before' ? [{ name: 'writer-uit-basiscommit', setup(api) {
        api.onLoad({ filter: /[/]src[/]services[/]ifc[/]ifcWriter\.ts$/ }, args => ({
          contents: execFileSync('git', ['show', `${base}:${writerPath}`], { cwd: root, encoding: 'utf8' }),
          loader: 'ts', resolveDir: resolve(args.path, '..'),
        }));
      } }] : [],
    });
    modules[version] = await import(pathToFileURL(outfile).href);
  }
  for (const size of [1_000, 5_000, 10_000]) {
    for (const calendars of [0, 64, 512]) {
      const input = modules.after.ifcCalendarIndexFixture(size, calendars);
      const inputHash = hash(JSON.stringify(input));
      let expectedOutput;
      const samplesMs = { before: [], after: [] };
      // Twee warmups, zeven afwisselende meetparen; hashing valt buiten de gemeten schrijftijd.
      for (let repeat = -2; repeat < 7; repeat++) {
        const order = repeat % 2 === 0 ? ['before', 'after'] : ['after', 'before'];
        for (const version of order) {
          const start = performance.now();
          const output = modules[version].writeIFC(input);
          const ms = performance.now() - start;
          const normalized = normalizeTime(output);
          if (expectedOutput !== undefined && normalized !== expectedOutput) throw new Error(`IFC-uitvoer verschilt: ${size}/${calendars}/${version}`);
          expectedOutput = normalized;
          if (repeat >= 0) samplesMs[version].push(ms);
        }
      }
      if (hash(JSON.stringify(input)) !== inputHash) throw new Error('Schrijven muteert de invoer');
      const row = { tasks: input.tasks.length, resources: input.resources.length, calendars,
        inputHash, outputHash: hash(expectedOutput), samplesMs,
        medianMs: { before: median(samplesMs.before), after: median(samplesMs.after) } };
      rows.push(row);
      console.log(JSON.stringify(row));
    }
  }
  const evidence = { base, head: git('rev-parse', 'HEAD'), changedProductFiles: changed,
    writerHash: { before: hash(execFileSync('git', ['show', `${base}:${writerPath}`], { cwd: root })),
      after: hash(execFileSync('git', ['show', `HEAD:${writerPath}`], { cwd: root })) },
    node: process.version, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cpu: cpus()[0].model, logicalCpus: cpus().length, at: new Date().toISOString(),
    warmups: 2, repeats: 7, rows };
  if (arg('--out')) writeFileSync(arg('--out'), `${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
