import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  countProblems,
  durationsFromManifests,
  expectedLines,
  expectedRuns,
  itemsOfShard,
  parseExpected,
  parsePlan,
  parseShard,
  planProblems,
  runsAlone,
} from '../../scripts/planning-pool.mjs';

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(root, 'scripts', 'planning-pool.mjs');
const SEP = '\x1f';

/** Een plan met kleine scripts in plaats van bundels, zodat niets gebundeld hoeft te worden. */
function fixture(checks, zones = ['UTC', 'Pacific/Auckland']) {
  const dir = mkdtempSync(join(tmpdir(), 'ops-pool-test-'));
  const lines = [`zones\t${zones.join('\t')}`];
  for (const [i, c] of checks.entries()) {
    const file = join(dir, `c${i}.mjs`);
    writeFileSync(file, c.body);
    lines.push(['check', c.id, '', '', c.matrix ? '1' : '0', c.env ?? '', file].join('\t'));
  }
  const text = `${lines.join('\n')}\n`;
  const planPath = join(dir, 'plan');
  const expectedPath = join(dir, 'expected.txt');
  writeFileSync(planPath, text);
  writeFileSync(expectedPath, `${expectedLines(parsePlan(text)).join('\n')}\n`);
  writeFileSync(join(dir, 'check-durations.json'), '{}');
  return { dir, planPath, expectedPath };
}

const exec = async (args, env = {}) => {
  try {
    const { stdout } = await run(process.execPath, [script, ...args], { env: { ...process.env, ...env } });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.code, stdout: error.stdout };
  }
};

test('een rode check maakt de run rood, de rest draait door en de uitvoer blijft bij zijn check', async () => {
  const { dir, planPath, expectedPath } = fixture([
    { id: 'check-a.ts', matrix: true, body: "console.log('uitvoer-van-a');" },
    { id: 'check-b.ts', matrix: true, body: "console.log('uitvoer-van-b'); console.error('fout-van-b'); process.exit(3);" },
    { id: 'check-c.ts', matrix: false, body: "console.log('uitvoer-van-c');" },
  ]);
  try {
    const manifest = join(dir, 'manifest.tsv');
    const result = await exec(['run', planPath, expectedPath, `--manifest=${manifest}`], { OPS_PLANNING_JOBS: '2' });
    assert.equal(result.code, 1);
    assert.match(result.stdout, /uitvoer-van-b\nfout-van-b\nXX {2}check-b\.ts: exit 3/);
    assert.match(result.stdout, /uitvoer-van-c/, 'de check na de rode draaide ook');
    assert.match(result.stdout, /TZ UTC: ROOD — 1 check/);
    assert.match(result.stdout, /--- check-b\.ts \[TZ Pacific\/Auckland\]: exit 3 ---\nuitvoer-van-b/);
    assert.ok(result.stdout.indexOf('uitvoer-van-a') < result.stdout.indexOf('uitvoer-van-b'), 'uitvoer in planvolgorde');
    assert.match(result.stdout, /telling: 7 runs gedraaid, 7 verwacht/);
    assert.equal(readFileSync(manifest, 'utf8').trim().split('\n').length, 7);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('elk proces krijgt zijn eigen TMPDIR, zijn zone en de omgeving van zijn regel', async () => {
  const body = `import { tmpdir } from 'node:os';
    import { writeFileSync } from 'node:fs';
    import { join } from 'node:path';
    writeFileSync(join(tmpdir(), 'zelfde-naam'), 'x', { flag: 'wx' });
    console.log('ZONE=' + (process.env.TZ ?? 'geen'), 'EXTRA=' + (process.env.OPS_RELAX_PERF ?? 'geen'), 'TMP=' + tmpdir());
    process.exit(process.env.TZ === 'UTC' ? 7 : 0);`;
  const { dir, planPath, expectedPath } = fixture([
    { id: 'check-z.ts', matrix: true, body },
    { id: 'check-p.ts', matrix: false, env: 'OPS_RELAX_PERF=0', body },
  ]);
  try {
    const { TZ: _tz, ...withoutZone } = process.env;
    const result = await new Promise((resolve) => {
      execFile(process.execPath, [script, 'run', planPath, expectedPath],
        { env: { ...withoutZone, OPS_PLANNING_JOBS: '4' } },
        (error, stdout) => resolve({ code: error?.code ?? 0, stdout }));
    });
    // Rood alleen in de zone UTC: zo komt de uitvoer van die zone in de log.
    assert.equal(result.code, 1, result.stdout);
    assert.match(result.stdout, /ZONE=UTC EXTRA=geen/);
    assert.match(result.stdout, /ZONE=geen EXTRA=0/);
    assert.doesNotMatch(result.stdout, /EEXIST/, 'geen twee processen op hetzelfde tijdelijke bestand');
    const tmps = [...result.stdout.matchAll(/TMP=(\S+)/g)].map(m => m[1]);
    assert.equal(new Set(tmps).size, tmps.length, 'elk proces een eigen map');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('een weggevallen, nieuwe of verplaatste check is rood, ook als alles wat draait groen is', async () => {
  const { dir, planPath, expectedPath } = fixture([
    { id: 'check-a.ts', matrix: true, body: '' },
    { id: 'check-b.ts', matrix: true, body: '' },
  ]);
  try {
    assert.equal((await exec(['run', planPath, expectedPath])).code, 0);
    const text = readFileSync(expectedPath, 'utf8');

    writeFileSync(expectedPath, `${text}check-weg.ts matrix\n`);
    let result = await exec(['run', planPath, expectedPath]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /check-weg\.ts staat in de verwachte lijst maar draait niet meer/);

    writeFileSync(expectedPath, text.replace('check-b.ts matrix\n', ''));
    result = await exec(['run', planPath, expectedPath]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /check-b\.ts staat niet in de verwachte lijst/);

    writeFileSync(expectedPath, text.replace('check-b.ts matrix', 'check-b.ts los'));
    result = await exec(['run', planPath, expectedPath]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /check-b\.ts: de lijst zegt "los", run\.sh zegt "matrix"/);

    writeFileSync(expectedPath, text.replace('zones UTC ', 'zones '));
    result = await exec(['run', planPath, expectedPath]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /zones: de lijst zegt/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('de delen samen draaien alles precies één keer, en count ziet elk gat', async () => {
  const { dir, planPath, expectedPath } = fixture(['a', 'b', 'c', 'd', 'e'].map(l => ({ id: `check-${l}.ts`, matrix: l !== 'e', body: '' })));
  try {
    const manifests = [];
    for (const k of [1, 2, 3]) {
      const manifest = join(dir, `m${k}.tsv`);
      const result = await exec(['run', planPath, expectedPath, `--shard=${k}/3`, `--manifest=${manifest}`]);
      assert.equal(result.code, 0, result.stdout);
      manifests.push(manifest);
    }
    const ok = await exec(['count', expectedPath, ...manifests]);
    assert.equal(ok.code, 0, ok.stdout);
    assert.match(ok.stdout, /telling: 13 runs gedraaid in 3 delen, 13 verwacht/);

    const missing = await exec(['count', expectedPath, manifests[0], manifests[1]]);
    assert.equal(missing.code, 1);
    assert.match(missing.stdout, /XX {2}telling: niet gedraaid: /);

    const twice = await exec(['count', expectedPath, ...manifests, manifests[0]]);
    assert.equal(twice.code, 1);
    assert.match(twice.stdout, /2 keer gedraaid: /);

    const redText = readFileSync(manifests[0], 'utf8').replace(/\t0\t/, '\t1\t');
    writeFileSync(manifests[0], redText);
    const red = await exec(['count', expectedPath, ...manifests]);
    assert.equal(red.code, 1);
    assert.match(red.stdout, /: exit 1/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('een check die niet bundelt is rood en houdt de andere checks niet tegen', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ops-pool-bundel-'));
  try {
    const good = join(dir, 'goed.ts');
    const broken = join(dir, 'kapot.ts');
    writeFileSync(good, "console.log('bundel-werkt');\n");
    writeFileSync(broken, 'const = ;\n');
    const goodOut = join(dir, '.goed.mjs');
    const lines = [
      'esbuild\t--log-level=error\t--bundle\t--platform=node\t--format=esm',
      'zones',
      `check\tcheck-goed.ts\t${good}\t${goodOut}\t0\t\t${goodOut}`,
      `check\tcheck-kapot.ts\t${broken}\t${join(dir, '.kapot.mjs')}\t0\t\t${join(dir, '.kapot.mjs')}`,
    ];
    const planPath = join(dir, 'plan');
    const expectedPath = join(dir, 'expected.txt');
    writeFileSync(planPath, `${lines.join('\n')}\n`);
    writeFileSync(expectedPath, `${expectedLines(parsePlan(`${lines.join('\n')}\n`)).join('\n')}\n`);
    writeFileSync(join(dir, 'check-durations.json'), '{}');
    const result = await exec(['run', planPath, expectedPath]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /XX {2}bundelen mislukt: kapot\.ts/);
    assert.match(result.stdout, /bundel-werkt/);
    assert.match(result.stdout, /XX {2}telling: niet gedraaid: check-kapot\.ts/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('itemsOfShard verdeelt elke check over precies één deel, onafhankelijk van de planvolgorde', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ id: `check-${String(i).padStart(2, '0')}.ts` }));
  const parts = [1, 2, 3].map(k => itemsOfShard(items, k, 3).map(item => item.id));
  assert.equal(new Set(parts.flat()).size, 50);
  assert.equal(parts.flat().length, 50);
  assert.deepEqual(itemsOfShard([...items].reverse(), 2, 3).map(item => item.id), parts[1]);
});

test('itemsOfShard zet zware checks in verschillende delen, en een check zonder meting draait ook', () => {
  const items = ['check-a.ts', 'check-b.ts', 'check-c.ts', 'check-d.ts', 'check-nieuw.ts'].map(id => ({ id }));
  const durations = { 'check-a.ts': 300, 'check-b.ts': 300, 'check-c.ts': 1, 'check-d.ts': 1 };
  const parts = [1, 2].map(k => itemsOfShard(items, k, 2, durations).map(item => item.id));
  assert.equal(parts.flat().length, 5);
  assert.equal(new Set(parts.flat()).size, 5);
  assert.notEqual(parts[0].includes('check-a.ts'), parts[0].includes('check-b.ts'));
});

test('durationsFromManifests telt alle runs van een check op, in hele seconden', () => {
  const durations = durationsFromManifests(['check-b.ts\t-\t0\t1400\ncheck-b.ts\tUTC\t0\t1400\n', 'check-a.ts\t-\t0\t10\n']);
  assert.deepEqual(durations, { 'check-a.ts': 1, 'check-b.ts': 3 });
});

test('parseShard weigert onzin, planProblems ziet twee checks op één uitvoerpad', () => {
  assert.deepEqual(parseShard('2/3'), [2, 3]);
  for (const bad of ['0/3', '4/3', '1', 'a/b']) assert.throws(() => parseShard(bad));
  const plan = parsePlan([
    'zones\tUTC',
    `check\tcheck-a.ts\t/a.ts\t/uit.mjs\t1\t\t/uit.mjs`,
    `check\tcheck-b.ts\t/b.ts\t/uit.mjs\t1\tA=1${SEP}B=2\t--expose-gc${SEP}/uit.mjs`,
  ].join('\n'));
  assert.deepEqual(plan.items[1].env, ['A=1', 'B=2']);
  assert.deepEqual(plan.items[1].argv, ['--expose-gc', '/uit.mjs']);
  const problems = planProblems(plan, parseExpected(expectedLines(plan).join('\n')));
  assert.deepEqual(problems, ['twee checks schrijven naar hetzelfde uitvoerpad: uit.mjs']);
});

test('een regel met OPS_RELAX_PERF=0 draait alleen; expectedRuns telt gewoon plus elke zone', () => {
  assert.equal(runsAlone({ env: ['OPS_RELAX_PERF=0'] }), true);
  assert.equal(runsAlone({ env: [] }), false);
  const expected = parseExpected('zones UTC Asia/Tokyo\ncheck-a.ts matrix\ncheck-b.ts los\n');
  assert.equal(expectedRuns(expected).length, 4);
  assert.deepEqual(countProblems(expected, []).problems.length, 4);
});

test('de vastgelegde lijst staat er, en noemt geen check die niet bestaat', () => {
  const path = join(root, 'tests', 'planning', 'expected-checks.txt');
  assert.ok(existsSync(path));
  const expected = parseExpected(readFileSync(path, 'utf8'));
  for (const id of expected.kinds.keys()) {
    if (id.startsWith('check-')) assert.ok(existsSync(join(root, 'tests', 'planning', id)), `${id} staat in de lijst maar niet op schijf`);
  }
  assert.equal(expected.zones.length, 5);
});
