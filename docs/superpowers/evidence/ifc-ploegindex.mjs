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
import { isDeepStrictEqual } from 'node:util';
import { deserialize, serialize } from 'node:v8';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const base = 'aaf77b15a5bf971b4734351df309ae2d02d3e84f';
const writerPath = 'src/services/ifc/ifcWriter.ts';
const harnessPath = 'docs/superpowers/evidence/ifc-ploegindex.mjs';
const fixturePath = 'tests/planning/ifcCrewIndexFixture.ts';
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const out = arg('--out');
assert(out, '--out is verplicht; ook een fout schrijft gedeeltelijk bewijs');
mkdirSync(dirname(out), { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hash = value => createHash('sha256').update(value).digest('hex');
// V8-hashes identificeren één snapshot; gelijke waarden hoeven geen gelijke bytes te geven.
const inputHash = value => hash(serialize(value));
// Vergelijk volledige gedeserialiseerde waarden, geen niet-canonieke V8-bytes.
// Beide snapshots krijgen dezelfde kloonbehandeling; oorspronkelijke prototypes blijven apart.
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
function assertInputPreserved(input, snapshot, label, saveFailure = true) {
  const after = inputSnapshot(input);
  const result = {
    serializedBytesEqual: after.bytes.equals(snapshot.bytes),
    valuesEqual: isDeepStrictEqual(deserialize(after.bytes), deserialize(snapshot.bytes)),
    prototypesEqual: after.prototypes.length === snapshot.prototypes.length
      && after.prototypes.every((prototype, i) => prototype === snapshot.prototypes[i]),
  };
  if ((!result.valuesEqual || !result.prototypesEqual) && saveFailure) {
    // Volledige snapshots bewaren; een compacte assertion voorkomt een enorme Buffer-diff.
    writeFileSync(join(dirname(out), 'invoer-voor.v8'), snapshot.bytes);
    writeFileSync(join(dirname(out), 'invoer-na.v8'), after.bytes);
    writeFileSync(join(dirname(out), 'invoer-afwijking.json'), `${JSON.stringify({ label, ...result }, null, 2)}\n`);
  }
  assert(result.valuesEqual, `${label}: volledige data`);
  assert(result.prototypesEqual, `${label}: oorspronkelijke prototypes en objectaantal`);
  return result;
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
  readerIdentity: 'Verse module per readIFCWithXerReconstruction (id-teller begint op 0), Math.random constant 0.5; alle gegenereerde id-velden blijven in de vergelijking.',
  warmups: 2, repeats: 7, sampleTargetMs: 100, maxCallsPerSample: 5,
  parity: [], rows: [], status: 'bezig',
};
const save = () => writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
const started = performance.now();
const progress = (phase, details = {}) => {
  evidence.progress = { phase, elapsedMs: performance.now() - started,
    memoryBytes: process.memoryUsage(), cpuMicroseconds: process.cpuUsage(), ...details };
  console.log(JSON.stringify(evidence.progress));
  save();
};
const temp = mkdtempSync(join(tmpdir(), 'ops-ifc-ploegindex-'));
try {
  progress('voorbereiding');
  // De bewaker accepteert een ongewijzigd null-prototypeobject en weigert beide soorten mutatie.
  const probe = Object.assign(Object.create(null), { nested: { value: NaN, bytes: new Uint8Array([1, 2]) } });
  const probeSnapshot = inputSnapshot(probe);
  assertInputPreserved(probe, probeSnapshot, 'bewaker zelfcontrole');
  Object.setPrototypeOf(probe, Object.prototype);
  assert.throws(() => assertInputPreserved(probe, probeSnapshot, 'gewijzigd prototype', false), { code: 'ERR_ASSERTION' });
  Object.setPrototypeOf(probe, null);
  probe.nested.value = 1;
  assert.throws(() => assertInputPreserved(probe, probeSnapshot, 'gewijzigde data', false), { code: 'ERR_ASSERTION' });
  // Gelijke waarden uit verschillende array-opbouw mogen geen datamutatie suggereren.
  const representationProbe = { values: [1.5, 2.5] };
  representationProbe.values[0] = 1;
  representationProbe.values[1] = 2;
  const representation = assertInputPreserved(representationProbe, inputSnapshot({ values: [1, 2] }),
    'gelijke waarden uit verschillende array-opbouw');
  probe.nested.value = NaN;
  probe.nested.bytes[0] = 9;
  assert.throws(() => assertInputPreserved(probe, probeSnapshot, 'gewijzigde typed array', false), { code: 'ERR_ASSERTION' });
  progress('invoerbewaker zelfcontrole geslaagd', { representation });
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
    progress('schrijver bundelen', { version });
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
  progress('lezer bundelen');
  await build({
    stdin: { contents: "export { readIFCWithXerReconstruction } from '@/services/formatRegistry';", resolveDir: root, loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', outfile: readerFile,
    alias: { '@': join(root, 'src') }, logLevel: 'warning',
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"' },
  });
  evidence.hashes.readerBundle = hash(readFileSync(readerFile));
  let readerNumber = 0;
  async function readFresh(output, context = {}) {
    const number = readerNumber++;
    progress('lezermodule laden', { ...context, readerNumber: number, outputBytes: Buffer.byteLength(output) });
    const reader = await import(`${pathToFileURL(readerFile).href}?read=${number}`);
    progress('IFC lezen', { ...context, readerNumber: number });
    const payload = await reader.readIFCWithXerReconstruction(output);
    assert(payload.xerArchiveIssue === undefined, 'Heropening mag geen XER-archiefverlies melden');
    progress('IFC gelezen', { ...context, readerNumber: number,
      tasks: payload.tasks.length, resources: payload.resources.length });
    return payload;
  }

  async function parity(label, input, schemaValid = true) {
    const context = { label, schema: input.project.ifcSchema };
    progress('invoersnapshot maken', { ...context, tasks: input.tasks.length, resources: input.resources.length });
    const snapshot = inputSnapshot(input);
    progress('invoersnapshot klaar', { ...context, inputBytes: snapshot.bytes.byteLength,
      objects: snapshot.prototypes.length });
    const first = {};
    const second = {};
    const payloads = {};
    for (const version of ['before', 'after']) {
      progress('eerste IFC schrijven', { ...context, version });
      first[version] = modules[version].writeIFC(input);
      progress('eerste IFC geschreven', { ...context, version,
        outputBytes: Buffer.byteLength(first[version]), outputHash: hash(first[version]) });
      progress('eerste invoerbehoud controleren', { ...context, version });
      const firstGuard = assertInputPreserved(input, snapshot, `${label}/${version}: invoerbehoud`);
      progress('eerste invoerbehoud gelijk', { ...context, version, ...firstGuard });
      payloads[version] = await readFresh(first[version], { ...context, version, round: 'eerste' });
      if (input.xer) assert(payloads[version].xer !== undefined, `${label}/${version}: volledig XER-archief heropend`);
      progress('heropende invoersnapshot maken', { ...context, version });
      const reopened = inputSnapshot(payloads[version]);
      progress('tweede IFC schrijven', { ...context, version, inputBytes: reopened.bytes.byteLength });
      second[version] = modules[version].writeIFC(payloads[version]);
      progress('tweede IFC geschreven', { ...context, version,
        outputBytes: Buffer.byteLength(second[version]), outputHash: hash(second[version]) });
      progress('tweede invoerbehoud controleren', { ...context, version });
      const secondGuard = assertInputPreserved(payloads[version], reopened, `${label}/${version}: heropende invoerbehoud`);
      progress('tweede invoerbehoud gelijk', { ...context, version, ...secondGuard });
    }
    progress('volledige uitvoer vergelijken', context);
    assert(first.before === first.after, `${label}: volledige eerste IFC-uitvoer incl. STEP-nummers`);
    assert(isDeepStrictEqual(payloads.before, payloads.after), `${label}: volledige readerpayload incl. GlobalIds/bibliotheek/herkomst`);
    assert(second.before === second.after, `${label}: volledige tweede IFC-uitvoer`);
    const secondPayload = await readFresh(second.after, { ...context, version: 'after', round: 'tweede' });
    assert(isDeepStrictEqual(await readFresh(second.before, { ...context, version: 'before', round: 'tweede' }),
      secondPayload), `${label}: volledige tweede readerpayload`);
    if (input.xer) assert(secondPayload.xer !== undefined, `${label}: volledig XER-archief na tweede export`);
    if (schemaValid) {
      for (const [stage, output] of [['eerste', first.after], ['tweede', second.after]]) {
        progress('schema controleren', { ...context, round: stage });
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
    progress('roundtrip gelijk', { label, schema: input.project.ifcSchema, cases: evidence.parity.length });
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
  assert(original !== changedOutput, 'Veranderde koppeling moet uitvoer veranderen');
  const changedPayload = await readFresh(changedOutput);
  const changedMember = changedPayload.resources.find(r => r.name === 'Alfa een');
  assert.equal(changedPayload.resources.find(r => r.id === changedMember.parentId)?.name, 'Beta');
  // Een ander document tussen twee saves en herstel van de oorspronkelijke koppeling.
  await parity('ander-document', modules.after.ifcCrewIndexFixture(100, 5));
  mutable.resources.find(r => r.id === 'a1').parentId = '__proto__';
  assert(await parity('herstelde-koppeling', mutable) === original, 'Herstelde koppeling herstelt de volledige IFC-uitvoer');

  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  for (const size of [1_000, 5_000, 10_000]) {
    for (const crews of [0, 1, 8, size / 5]) {
      const input = modules.after.ifcCrewIndexFixture(size, crews);
      const snapshot = inputSnapshot(input);
      const row = { resources: size, crews, tasks: input.tasks.length, status: 'bezig', inputHash: inputHash(input), warmupMs: { before: [], after: [] }, samples: [] };
      evidence.rows.push(row);
      progress('opwarmen', { resources: size, crews });
      let expected;
      const run = version => {
        const start = performance.now();
        const output = modules[version].writeIFC(input);
        const ms = performance.now() - start;
        if (expected === undefined) expected = output;
        assert(output === expected, `Schaal ${size}/${crews}/${version}: volledige uitvoer`);
        return ms;
      };
      for (let warmup = 0; warmup < evidence.warmups; warmup++) {
        for (const version of warmup % 2 ? ['after', 'before'] : ['before', 'after']) row.warmupMs[version].push(run(version));
      }
      const slowest = Math.max(...row.warmupMs.before, ...row.warmupMs.after);
      row.callsPerSample = Math.max(1, Math.min(evidence.maxCallsPerSample, Math.ceil(evidence.sampleTargetMs / slowest)));
      progress('meetparen starten', { resources: size, crews, callsPerSample: row.callsPerSample });
      for (let repeat = 0; repeat < evidence.repeats; repeat++) {
        const sample = { repeat, order: repeat % 2 ? ['after', 'before'] : ['before', 'after'] };
        for (const version of sample.order) sample[version] = Array.from({ length: row.callsPerSample }, () => run(version));
        row.samples.push(sample);
        progress('meetpaar bewaard', { resources: size, crews, pairs: row.samples.length });
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
        assert(modules[version].writeIFC(counted) === expected, 'Teller verandert geen IFC-uitvoer');
        row.parentIdReads[version] = reads;
      }
      assert.equal(row.parentIdReads.before - row.parentIdReads.after,
        (crews - (crews > 0 ? 1 : 0)) * size, 'Exacte reductie van herhaalde parentId-lezingen');
      row.outputHash = hash(expected);
      row.outputBytes = Buffer.byteLength(expected);
      row.medianMs = Object.fromEntries(['before', 'after'].map(version => [version,
        median(row.samples.map(sample => sample[version].reduce((a, b) => a + b, 0) / row.callsPerSample)),
      ]));
      row.status = 'geslaagd';
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
