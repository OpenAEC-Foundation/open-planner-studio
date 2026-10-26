// Uitsluitend in GitHub CI: volledige writeIFC, oude bron versus nieuwe bron op dezelfde runner.
// node docs/superpowers/evidence/ifc-ploegindex.mjs --out qa/ifc-ploegindex/resultaat.json
import { build, version as esbuildVersion } from 'esbuild';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir, totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { serialize } from 'node:v8';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const base = 'fbd4a3f9dcc7bdd308ab86b992d0b26f4670a553';
const writerPath = 'src/services/ifc/ifcWriter.ts';
const harnessPath = 'docs/superpowers/evidence/ifc-ploegindex.mjs';
const fixturePath = 'tests/planning/ifcCrewIndexFixture.ts';
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const out = arg('--out');
assert(out, '--out is verplicht; ook een fout schrijft gedeeltelijk bewijs');
mkdirSync(dirname(out), { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hash = value => createHash('sha256').update(value).digest('hex');
// V8-serialisatie bewaart ook undefined, NaN en typed arrays; vergelijkingen zijn deepStrictEqual.
const inputHash = value => hash(serialize(value));
// structuredClone verandert null-prototypewoordenboeken. Bewaar daarom de volledige data en
// de oorspronkelijke prototypes apart; de schrijver mag geen van beide veranderen.
function inputSnapshot(input) {
  const prototypes = [];
  const seen = new Set();
  const visit = value => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    prototypes.push(Object.getPrototypeOf(value));
    if (value instanceof Map) {
      for (const [key, item] of value) { visit(key); visit(item); }
    } else if (value instanceof Set) {
      for (const item of value) visit(item);
    } else if (!ArrayBuffer.isView(value) && !(value instanceof ArrayBuffer)) {
      for (const item of Object.values(value)) visit(item);
    }
  };
  visit(input);
  return { bytes: serialize(input), prototypes };
}
function assertInputPreserved(input, snapshot, label) {
  const after = inputSnapshot(input);
  assert.deepStrictEqual(after.bytes, snapshot.bytes, `${label}: volledige data`);
  assert.equal(after.prototypes.length, snapshot.prototypes.length, `${label}: objectaantal`);
  after.prototypes.forEach((prototype, i) =>
    assert.equal(prototype, snapshot.prototypes[i], `${label}: prototype ${i}`));
}
const RealDate = Date;
const realRandom = Math.random;
const fixedTime = '2026-10-26T10:00:00.000Z';
const evidence = {
  base, head: git('rev-parse', 'HEAD'), at: new RealDate().toISOString(),
  node: process.version, versions: process.versions, esbuild: esbuildVersion,
  cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalMemory: totalmem(),
  runner: process.env.ImageOS, runnerVersion: process.env.ImageVersion,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  fixedTime, normalization: 'Geen velden of uitvoer verwijderd; schrijftijd via Date vastgezet.',
  readerIdentity: 'Verse module per readIFC (id-teller begint op 0), Math.random constant 0.5; alle gegenereerde id-velden blijven in de vergelijking.',
  warmups: 2, repeats: 7, sampleTargetMs: 100, maxCallsPerSample: 5,
  parity: [], rows: [], status: 'bezig',
};
const save = () => writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
const temp = mkdtempSync(join(tmpdir(), 'ops-ifc-ploegindex-'));
try {
  // De bewaker accepteert een ongewijzigd null-prototypeobject en weigert beide soorten mutatie.
  const probe = Object.assign(Object.create(null), { nested: { value: NaN, bytes: new Uint8Array([1, 2]) } });
  const probeSnapshot = inputSnapshot(probe);
  assertInputPreserved(probe, probeSnapshot, 'bewaker zelfcontrole');
  Object.setPrototypeOf(probe, Object.prototype);
  assert.throws(() => assertInputPreserved(probe, probeSnapshot, 'gewijzigd prototype'), { code: 'ERR_ASSERTION' });
  Object.setPrototypeOf(probe, null);
  probe.nested.value = 1;
  assert.throws(() => assertInputPreserved(probe, probeSnapshot, 'gewijzigde data'), { code: 'ERR_ASSERTION' });
  const changed = git('diff', '--name-only', base, 'HEAD', '--', 'src').split('\n').filter(Boolean);
  assert.deepEqual(changed, [writerPath], 'Nulmeting geldt alleen voor deze ene productwijziging');
  assert.equal(git('status', '--porcelain', '--untracked-files=no', '--', 'src', harnessPath, fixturePath), '');
  const beforeSource = execFileSync('git', ['show', `${base}:${writerPath}`], { cwd: root, encoding: 'utf8' });
  const afterSource = readFileSync(join(root, writerPath), 'utf8');
  const withoutCrew = source => {
    const start = source.indexOf('function writeCrewNesting(');
    assert(start >= 0);
    const end = source.indexOf('\n}', start) + 2;
    assert(end > start);
    return source.slice(0, start) + source.slice(end);
  };
  assert.equal(withoutCrew(beforeSource), withoutCrew(afterSource), 'Productdiff raakt uitsluitend writeCrewNesting');
  evidence.hashes = {
    writerBefore: hash(beforeSource), writerAfter: hash(afterSource),
    harness: hash(readFileSync(join(root, harnessPath))),
    fixture: hash(readFileSync(join(root, fixturePath))),
    schemaFixture: hash(readFileSync(join(root, 'tests/planning/ifcSchemaFixture.ts'))),
    roundtripCheck: hash(readFileSync(join(root, 'tests/planning/check-ifc-roundtrip.ts'))),
    lockfile: hash(readFileSync(join(root, 'package-lock.json'))),
  };
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [fixedTime])); }
    static now() { return RealDate.parse(fixedTime); }
  };
  Math.random = () => 0.5;
  const modules = {};
  for (const version of ['before', 'after']) {
    const outfile = join(temp, `${version}.mjs`);
    await build({
      stdin: { contents: `
        export { writeIFC } from '@/services/ifc/ifcWriter';
        export { readIFC } from '@/services/ifc/ifcReader';
        export { IFC_SCHEMAS } from '@/types/project';
        export { ifcCrewIndexFixture, crewEdgeResources } from './tests/planning/ifcCrewIndexFixture';
        export { buildRichSchemaProject, buildXerSchemaProject } from './tests/planning/ifcSchemaFixture';
        export { checkIfcSchema } from './tests/planning/ifcSchemaCheck';
      `, resolveDir: root, loader: 'ts' },
      bundle: true, platform: 'node', format: 'esm', outfile,
      alias: { '@': join(root, 'src') }, logLevel: 'warning',
      define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"' },
      plugins: version === 'before' ? [{ name: 'writer-uit-vastgezette-basis', setup(api) {
        api.onLoad({ filter: /[/]src[/]services[/]ifc[/]ifcWriter\.ts$/ }, args => ({
          contents: beforeSource, loader: 'ts', resolveDir: dirname(args.path),
        }));
      } }] : [],
    });
    evidence.hashes[`bundle${version}`] = hash(readFileSync(outfile));
    modules[version] = await import(pathToFileURL(outfile).href);
  }

  // De reader maakt assignment-id's met een modulaire teller + Math.random. Een verse module
  // geeft beide teksten dezelfde id-bron; geen payloadvelden wissen of achteraf canonicaliseren.
  const readerFile = join(temp, 'reader.mjs');
  await build({
    stdin: { contents: "export { readIFC } from '@/services/ifc/ifcReader';", resolveDir: root, loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', outfile: readerFile,
    alias: { '@': join(root, 'src') }, logLevel: 'warning',
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"' },
  });
  evidence.hashes.readerBundle = hash(readFileSync(readerFile));
  let readerNumber = 0;
  async function readFresh(output) {
    const reader = await import(`${pathToFileURL(readerFile).href}?read=${readerNumber++}`);
    return reader.readIFC(output);
  }

  async function parity(label, input, schemaValid = true) {
    const snapshot = inputSnapshot(input);
    const first = {};
    const second = {};
    const payloads = {};
    for (const version of ['before', 'after']) {
      first[version] = modules[version].writeIFC(input);
      assertInputPreserved(input, snapshot, `${label}/${version}: invoerbehoud`);
      payloads[version] = await readFresh(first[version]);
      const reopened = inputSnapshot(payloads[version]);
      second[version] = modules[version].writeIFC(payloads[version]);
      assertInputPreserved(payloads[version], reopened, `${label}/${version}: heropende invoerbehoud`);
    }
    assert.equal(first.before, first.after, `${label}: volledige eerste IFC-uitvoer incl. STEP-nummers`);
    assert.deepStrictEqual(payloads.before, payloads.after, `${label}: volledige readerpayload incl. GlobalIds/bibliotheek/herkomst`);
    assert.equal(second.before, second.after, `${label}: volledige tweede IFC-uitvoer`);
    const secondPayload = await readFresh(second.after);
    assert.deepStrictEqual(await readFresh(second.before), secondPayload, `${label}: volledige tweede readerpayload`);
    if (schemaValid) {
      for (const [stage, output] of [['eerste', first.after], ['tweede', second.after]]) {
        const check = modules.after.checkIfcSchema(`${label}/${stage}`, output, undefined, input.project.ifcSchema);
        assert.deepEqual(check.failures, [], `${label}/${stage}: schema`);
      }
    }
    const row = {
      label, schema: input.project.ifcSchema, schemaValid,
      inputHash: inputHash(input), outputHash: hash(first.after), secondOutputHash: hash(second.after),
      payloadHash: inputHash(payloads.after), secondPayloadHash: inputHash(secondPayload),
    };
    evidence.parity.push(row);
    save();
    return first.after;
  }

  const rich = modules.after.buildRichSchemaProject(root);
  const edge = { ...rich, tasks: [], sequences: [], assignments: [], baselines: [], resources: modules.after.crewEdgeResources() };
  const pool = { ...edge, libraryPool: {
    companyId: 'c-crew', companyName: 'Ploegenbibliotheek', poolVersion: 7, seedVersion: 2,
    modifiedAt: '2026-10-01T12:34:56Z', calendars: structuredClone(edge.resourceCalendars), resources: structuredClone(edge.resources),
  } };
  for (const schema of modules.after.IFC_SCHEMAS) {
    for (const [label, source, valid] of [
      ['rijk', rich, true], ['randen', edge, true], ['bibliotheek', pool, true],
      ['dubbele-voorkomens', { ...edge, resources: modules.after.crewEdgeResources(true) }, false],
      ['zonder-resources', { ...edge, resources: [] }, true],
      ['xer-bronarchief', modules.after.buildXerSchemaProject(), true],
    ]) await parity(label, { ...source, project: { ...source.project, ifcSchema: schema } }, valid);
  }
  // Bewust buiten Resource's stringcontract, maar door de oude volledige schrijver geaccepteerd.
  const damaged = { ...edge, resources: [
    { ...edge.resources[0], id: NaN, type: 'CREW', parentId: undefined },
    { ...edge.resources[1], id: 'nan-lid', parentId: NaN },
    { ...edge.resources[0], id: 'onbekend-type', type: 'ONBEKEND', parentId: '__proto__' },
  ] };
  const damagedOutput = await parity('beschadigde-runtime-invoer', damaged, false);
  assert(!damagedOutput.includes('IFCRELNESTS('), 'NaN krijgt ook bij de oude schrijver geen leden');

  const mutable = structuredClone(edge);
  const original = await parity('voor-wijziging', mutable);
  mutable.resources.find(r => r.id === 'a1').parentId = 'constructor';
  const changedOutput = await parity('na-wijziging-zelfde-object', mutable);
  assert.notEqual(original, changedOutput, 'Veranderde koppeling moet uitvoer veranderen');
  const changedPayload = await readFresh(changedOutput);
  const changedMember = changedPayload.resources.find(r => r.name === 'Alfa een');
  assert.equal(changedPayload.resources.find(r => r.id === changedMember.parentId)?.name, 'Beta');
  // Een ander document tussen twee saves en herstel van de oorspronkelijke koppeling.
  await parity('ander-document', modules.after.ifcCrewIndexFixture(100, 5));
  mutable.resources.find(r => r.id === 'a1').parentId = '__proto__';
  assert.equal(await parity('herstelde-koppeling', mutable), original);

  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  for (const size of [1_000, 5_000, 10_000]) {
    for (const crews of [0, 1, 8, size / 5]) {
      const input = modules.after.ifcCrewIndexFixture(size, crews);
      const snapshot = inputSnapshot(input);
      const row = { resources: size, crews, tasks: input.tasks.length, inputHash: inputHash(input), warmupMs: { before: [], after: [] }, samples: [] };
      let expected;
      const run = version => {
        const start = performance.now();
        const output = modules[version].writeIFC(input);
        const ms = performance.now() - start;
        if (expected === undefined) expected = output;
        assert.equal(output, expected, `Schaal ${size}/${crews}/${version}: volledige uitvoer`);
        return ms;
      };
      for (let warmup = 0; warmup < evidence.warmups; warmup++) {
        for (const version of warmup % 2 ? ['after', 'before'] : ['before', 'after']) row.warmupMs[version].push(run(version));
      }
      const slowest = Math.max(...row.warmupMs.before, ...row.warmupMs.after);
      row.callsPerSample = Math.max(1, Math.min(evidence.maxCallsPerSample, Math.ceil(evidence.sampleTargetMs / slowest)));
      for (let repeat = 0; repeat < evidence.repeats; repeat++) {
        const sample = { repeat, order: repeat % 2 ? ['after', 'before'] : ['before', 'after'] };
        for (const version of sample.order) sample[version] = Array.from({ length: row.callsPerSample }, () => run(version));
        row.samples.push(sample);
      }
      assertInputPreserved(input, snapshot, 'Schaalmeting muteert geen invoer');
      // Apart van de klok: tel echte parentId-lezingen aan de volledige writergrens.
      // Alleen deze extra aanroepen gebruiken getters; geen productinstrumentatie of tijdclaim.
      row.parentIdReads = {};
      for (const version of ['before', 'after']) {
        let reads = 0;
        const counted = { ...input, resources: input.resources.map(resource => ({
          ...resource, get parentId() { reads++; return resource.parentId; },
        })) };
        assert.equal(modules[version].writeIFC(counted), expected, 'Teller verandert geen IFC-uitvoer');
        row.parentIdReads[version] = reads;
      }
      assert.equal(row.parentIdReads.before - row.parentIdReads.after,
        (crews - (crews > 0 ? 1 : 0)) * size, 'Exacte reductie van herhaalde parentId-lezingen');
      row.outputHash = hash(expected);
      row.outputBytes = Buffer.byteLength(expected);
      row.medianMs = Object.fromEntries(['before', 'after'].map(version => [version,
        median(row.samples.map(sample => sample[version].reduce((a, b) => a + b, 0) / row.callsPerSample)),
      ]));
      evidence.rows.push(row);
      console.log(JSON.stringify(row));
      save();
    }
  }
  evidence.status = 'geslaagd';
} catch (error) {
  evidence.status = 'mislukt';
  evidence.error = { message: String(error), stack: error?.stack };
  throw error;
} finally {
  globalThis.Date = RealDate;
  Math.random = realRandom;
  save();
  rmSync(temp, { recursive: true, force: true });
}
