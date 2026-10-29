// Reproduceerbare vergelijking van uitsluitend de IFC-reader, zonder checkoutwissel.
// Zie ifc-property-relaties.md voor de opdrachten en interpretatie.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, cpus, loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const root = process.cwd();
const option = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : process.argv[at + 1];
};
const baseline = option('--before', '522589202');
const dataDir = resolve(option('--data', 'build/ifc-property-relaties-data'));
const datasetManifest = JSON.parse(readFileSync(join(dataDir, 'datasets.json'), 'utf8'));
const out = resolve(option('--out', 'build/ifc-property-relaties.json'));
const repeats = Number(option('--repeats', '7'));
assert(Number.isInteger(repeats) && repeats > 0);
const sha = text => createHash('sha256').update(text).digest('hex');
const readerPath = 'src/services/ifc/ifcReader.ts';
const oldReader = execFileSync('git', ['show', baseline + ':' + readerPath], { encoding: 'utf8' });
const work = mkdtempSync(join(tmpdir(), 'ops-ifc-property-relaties-'));
const conditions = {
  date: new Date().toISOString(), node: process.version, cpu: cpus()[0].model, loadavg: loadavg(),
  baseline, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  readerSha256: { before: sha(oldReader), after: sha(readFileSync(readerPath)) },
  repeats, warmups: 2, gcBeforeSample: true, alternatingOrder: true,
};

async function bundle(variant, parity = false) {
  const outfile = join(work, variant + (parity ? '-parity' : '') + '.mjs');
  const contents = [
    "export { readIFCWithXerReconstruction as read } from '@/services/formatRegistry';",
    "export { writeIFC as write } from '@/services/ifc/ifcWriter';",
    ...(parity ? [
      "export { resetIds } from '@/utils/id';",
      "export { buildRichSchemaProject, buildXerSchemaProject } from './tests/planning/ifcSchemaFixture';",
    ] : []),
  ].join('\n');
  await esbuild.build({
    stdin: { contents, resolveDir: root, loader: 'ts' }, outfile,
    bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: { '@': join(root, 'src') },
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' },
    plugins: [{
      name: 'vaste-reader-en-pariteits-ids',
      setup(build) {
        if (variant === 'before') build.onLoad({ filter: /\/ifcReader\.ts$/ }, () => ({ contents: oldReader, loader: 'ts' }));
        if (parity) build.onLoad({ filter: /\/utils\/id\.ts$/ }, () => ({
          contents: "let n=0; export function resetIds(){n=0;} export function generateId(p=''){return p+'-pariteit-'+(++n);}",
          loader: 'ts',
        }));
      },
    }],
  });
  return import(pathToFileURL(outfile).href);
}

try {
  // Volledige model- én writerpariteit, inclusief bronarchieven en alle drie schrijfschema's.
  // Alleen willekeurige nieuwe ids en de lees-/schrijftijd krijgen vaste waarden; geen velden weglaten.
  const parityApis = { before: await bundle('before', true), after: await bundle('after', true) };
  const realDate = globalThis.Date;
  const frozen = 1790000000000;
  globalThis.Date = new Proxy(realDate, {
    construct: (target, args) => Reflect.construct(target, args.length ? args : [frozen]),
    get: (target, name) => name === 'now' ? () => frozen : Reflect.get(target, name),
  });
  const parity = [];
  try {
    const paths = execFileSync('git', ['ls-files', '*.ifc'], { encoding: 'utf8' }).trim().split('\n');
    const inputs = paths.map(path => [path, readFileSync(path, 'utf8')]);
    for (const size of [1000, 5000, 10000]) inputs.push(['plan-' + size, readFileSync(join(dataDir, 'plan-' + size + '.ifc'), 'utf8')]);
    for (const [name, fixture] of [
      ['rijk', parityApis.after.buildRichSchemaProject(root)],
      ['xer-archief', parityApis.after.buildXerSchemaProject()],
    ]) {
      for (const schema of ['IFC4', 'IFC4X3', 'IFC4X3_ADD2']) {
        inputs.push([name + '-' + schema, parityApis.after.write({ ...fixture, project: { ...fixture.project, ifcSchema: schema } })]);
      }
    }
    for (const [name, text] of inputs) {
      parityApis.before.resetIds();
      const before = await parityApis.before.read(text);
      parityApis.after.resetIds();
      const after = await parityApis.after.read(text);
      assert.deepStrictEqual(after, before, name + ': volledig importmodel');
      assert.equal(parityApis.after.write(after), parityApis.before.write(before), name + ': opnieuw geschreven IFC');
      parity.push({ name, inputSha256: sha(text), modelSha256: sha(JSON.stringify(after)) });
    }
  } finally {
    globalThis.Date = realDate;
  }
  console.log('Exacte import-/writerpariteit:', parity.length, 'bestanden');

  const apis = { before: await bundle('before'), after: await bundle('after') };
  const results = [];
  for (const size of [1000, 5000, 10000]) {
    const content = readFileSync(join(dataDir, 'plan-' + size + '.ifc'), 'utf8');
    const samples = { before: [], after: [] };
    for (let round = -conditions.warmups; round < repeats; round++) {
      for (const variant of round % 2 ? ['after', 'before'] : ['before', 'after']) {
        global.gc();
        const cpu = process.cpuUsage();
        const start = performance.now();
        const imported = await apis[variant].read(content);
        const wallMs = performance.now() - start;
        const usage = process.cpuUsage(cpu);
        assert.equal(imported.tasks.length, size);
        if (round >= 0) samples[variant].push({ wallMs, cpuMs: (usage.user + usage.system) / 1000 });
      }
    }
    results.push({
      size, inputSha256: sha(content), bytes: Buffer.byteLength(content),
      contentSha256: datasetManifest.datasets.find(dataset => dataset.size === size).contentSha256,
      samples,
    });
    console.log(size, JSON.stringify(samples));
  }
  writeFileSync(out, JSON.stringify({ conditions, results, parity }, null, 2) + '\n');
  console.log('Exacte import-/writerpariteit:', parity.length, 'bestanden; resultaat:', out);
} finally {
  rmSync(work, { recursive: true, force: true });
}
