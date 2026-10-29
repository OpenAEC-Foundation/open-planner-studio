import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  SPEC_DIR, assignShards, durationsFromJobLog, listSpecFiles, mergeJobDurations, parseShard, readDurations, shardFiles,
} from '../../scripts/browser-shards.mjs';
import { extractDurationShard, runBrowserTests } from '../../scripts/run-browser-tests.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const run = promisify(execFile);
const TOTAL = 4;

/** De specbestanden (relatief aan tests/browser) die Playwright met deze argumenten vindt. */
async function playwrightFiles(extraArgs = []) {
  const bin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'playwright.cmd' : 'playwright');
  const { stdout } = await run(bin, ['test', '--list', '--reporter=json', ...extraArgs], {
    cwd: root,
    // Alleen voor de config-check; `--list` start geen webserver.
    env: { ...process.env, OPS_BROWSER_TEST_PORT: '3999' },
    maxBuffer: 64 * 1024 * 1024,
  });
  const files = new Set();
  const walk = (suite) => {
    if (suite.specs?.length) files.add(suite.file);
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of JSON.parse(stdout).suites) walk(suite);
  return [...files].sort();
}

const inSpecDir = (files) => files.map((f) => f.slice(SPEC_DIR.length + 1)).sort();

test('assignShards verdeelt elke spec precies één keer, deterministisch, langste eerst', () => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => `${SPEC_DIR}/${n}.spec.ts`);
  const durations = { 'a.spec.ts': 10, 'b.spec.ts': 9, 'c.spec.ts': 1, 'd.spec.ts': 1, 'e.spec.ts': 8 };
  const shards = assignShards(files, durations, 3);
  assert.deepEqual(shards.flatMap((s) => s.files).sort(), files, 'samen precies alle specs');
  assert.deepEqual(assignShards([...files].reverse(), durations, 3), shards, 'volgorde van invoer telt niet');
  // f heeft geen meting en krijgt de mediaan van de bekende (gesorteerd 1,1,8,9,10 ⇒ 8).
  assert.deepEqual(shards.map((s) => s.seconds), [11, 10, 16]);
  assert.deepEqual(shards.map((s) => s.files.length), [2, 2, 2]);
});

test('durationsFromJobLog telt per spec de vensters tot de volgende start, de laatste tot "passed"', () => {
  const log = [
    '2026-10-20T09:00:00.000Z Running 3 tests using 1 worker',
    '2026-10-20T09:00:01.000Z [1/3] [chromium] › tests/browser/a.spec.ts:3:1 › eerste',
    '2026-10-20T09:00:04.500Z [2/3] [chromium] › tests/browser/sub/b.spec.ts:9:1 › tweede',
    '2026-10-20T09:00:06.000Z [3/3] [chromium] › tests/browser/a.spec.ts:20:1 › derde',
    '2026-10-20T09:00:10.000Z   3 passed (9.0s)',
  ].join('\n');
  assert.deepEqual(durationsFromJobLog(log), { 'a.spec.ts': 7.5, 'sub/b.spec.ts': 1.5 });
});

test('mergeJobDurations corrigeert per log voor de runnersnelheid en middelt per spec', () => {
  const reference = { 'a.spec.ts': 10, 'b.spec.ts': 20, 'c.spec.ts': 40 };
  // Log 1 liep op een runner die twee keer zo traag is; log 2 op normale snelheid, met een nieuwe spec d.
  const slow = { 'a.spec.ts': 20, 'b.spec.ts': 40, 'c.spec.ts': 80 };
  const normal = { 'a.spec.ts': 10, 'b.spec.ts': 20, 'd.spec.ts': 6 };
  const merged = mergeJobDurations([slow, normal], reference);
  assert.deepEqual(Object.keys(merged).sort(), ['a.spec.ts', 'b.spec.ts', 'c.spec.ts', 'd.spec.ts']);
  for (const [spec, want] of Object.entries({ 'a.spec.ts': 10, 'b.spec.ts': 20, 'c.spec.ts': 40, 'd.spec.ts': 6 })) {
    assert.ok(Math.abs(merged[spec] - want) < 1e-9, `${spec}: ${merged[spec]} ≠ ${want}`);
  }
});

test('parseShard en extractDurationShard: geldige en ongeldige vormen', () => {
  assert.deepEqual(parseShard('2/4'), { current: 2, total: 4 });
  for (const bad of ['0/4', '5/4', '1/0', '2', 'a/b', '', undefined]) assert.throws(() => parseShard(bad), /k\/n/);
  assert.equal(extractDurationShard(['--grep', 'x']), null);
  assert.deepEqual(extractDurationShard(['--duration-shard=3/4', '--grep', 'x']), { shard: { current: 3, total: 4 }, rest: ['--grep', 'x'] });
  assert.deepEqual(extractDurationShard(['--duration-shard', '1/2']), { shard: { current: 1, total: 2 }, rest: [] });
});

test('de shards samen zijn exact de specs die Playwright vindt, en elke shardlijst draait precies die specs', async () => {
  const all = await playwrightFiles();
  assert.ok(all.length > 100, `verwacht ruim honderd specs, kreeg ${all.length}`);
  assert.deepEqual(inSpecDir(listSpecFiles(root)), all, 'eigen specontdekking = Playwrights testMatch');

  const shards = Array.from({ length: TOTAL }, (_, i) => shardFiles(root, i + 1, TOTAL));
  const union = shards.flat();
  assert.equal(new Set(union).size, union.length, 'geen spec in twee shards');
  assert.deepEqual(inSpecDir(union), all, 'samen alle specs');

  // `--test-list` met deze paden laat Playwright exact de specs van de shard draaien (paden zijn exact,
  // geen regex). Zo vangt dit ook een andere uitleg van het pad door een nieuwe Playwright-versie.
  const dir = mkdtempSync(join(tmpdir(), 'ops-shard-test-'));
  try {
    const listed = await Promise.all(shards.map((files, i) => {
      const list = join(dir, `shard-${i + 1}.txt`);
      writeFileSync(list, `${inSpecDir(files).join('\n')}\n`);
      return playwrightFiles(['--test-list', list]);
    }));
    listed.forEach((found, i) => assert.deepEqual(found, inSpecDir(shards[i]), `shard ${i + 1}/${TOTAL}`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('het duurbestand noemt geen specs die niet (meer) bestaan', () => {
  const existing = new Set(inSpecDir(listSpecFiles(root)));
  const stale = Object.keys(readDurations(root)).filter((name) => !existing.has(name));
  assert.deepEqual(stale, [], 'haal verwijderde of hernoemde specs uit tests/browser/spec-durations.json');
});

test('runner: --duration-shard wordt een --test-list met precies de specs van die shard, daarna opgeruimd', async () => {
  let seen = null;
  const exitCode = await runBrowserTests({
    root: '/tmp/ops-fixture/werkboom-shard',
    allocate: async () => 3145,
    preflightHeadless: async () => ({ close: async () => {} }),
    planShard: (_root, current, total) => {
      assert.deepEqual([current, total], [2, 4]);
      return [`${SPEC_DIR}/b.spec.ts`, `${SPEC_DIR}/sub/c.spec.ts`];
    },
    spawnTest: async ({ args }) => {
      const at = args.indexOf('--test-list');
      seen = { args, list: readFileSync(args[at + 1], 'utf8'), file: args[at + 1] };
      return 0;
    },
    args: ['--duration-shard=2/4', '--reporter=line'],
  });
  assert.equal(exitCode, 0);
  assert.deepEqual(seen.args.filter((a) => a !== seen.file), ['test', '--reporter=line', '--test-list']);
  assert.equal(seen.list, 'b.spec.ts\nsub/c.spec.ts\n');
  assert.equal(existsSync(seen.file), false, 'de tijdelijke lijst is weg na de run');
});

test('runner: een lege shard is een fout, geen groene run zonder tests', async () => {
  let spawned = false;
  await assert.rejects(() => runBrowserTests({
    root: '/tmp/ops-fixture/werkboom-leeg',
    allocate: async () => 3146,
    preflightHeadless: async () => ({ close: async () => {} }),
    planShard: () => [],
    spawnTest: async () => { spawned = true; return 0; },
    args: ['--duration-shard=4/4'],
  }), /geen specs/);
  assert.equal(spawned, false);
});

test('verify-parts --check-ci: de browsershards in ci.yml zijn samen precies 1..n', async () => {
  const script = join(root, 'scripts', 'verify-parts.mjs');
  const yaml = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
  const ok = await run(process.execPath, [script, '--check-ci', join(root, '.github', 'workflows', 'ci.yml')], { cwd: root });
  assert.match(ok.stdout, /browser in 4 shards/);
  const dir = mkdtempSync(join(tmpdir(), 'ops-ci-shards-'));
  try {
    for (const [label, broken] of [
      ['dubbele shard', yaml.replace('shard: 3/4', 'shard: 2/4')],
      ['ontbrekende shard', yaml.replace(/^.*shard: 4\/4.*\n/m, '')],
      // Review PR #399: het record van shard 4/4 naar een ander deel verhuisd; de shardregels zelf kloppen nog.
      ['shard 4/4 bij een ander deel', (() => {
        const at = yaml.indexOf('shard: 4/4');
        const partAt = yaml.lastIndexOf('part: browser', at);
        return `${yaml.slice(0, partAt)}part: static${yaml.slice(partAt + 'part: browser'.length)}`;
      })()],
    ]) {
      assert.notEqual(broken, yaml, `${label}: de fixture wijzigt ci.yml`);
      const file = join(dir, 'ci.yml');
      writeFileSync(file, broken);
      await assert.rejects(run(process.execPath, [script, '--check-ci', file], { cwd: root }),
        (error) => { assert.equal(error.code, 1); assert.match(error.stdout, /browsershards/); return true; }, label);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
