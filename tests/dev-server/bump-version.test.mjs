import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bumpVersion, checkVersionFiles, isoWeek, nextVersion, parseVersion } from '../../scripts/bump-version.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
// Bewust een onafhankelijke lijst: een vergeten pakket mag niet verdwijnen uit de testdekking.
const paths = ['package.json', 'package-lock.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', 'headless/server/package.json', 'headless/consumer-example/package.json', 'headless/server/openapi.yaml', 'snap/snapcraft.yaml', 'integrations/claude-desktop/manifest.json'];

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ops-bump-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const path of [...paths, 'scripts/bump-version.js']) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    copyFileSync(join(root, path), join(dir, path));
  }
  const sourceVersion = json(root, 'package.json').version;
  for (const path of paths) writeFileSync(join(dir, path), read(dir, path).replaceAll(sourceVersion, '2026.10.0'));
  return dir;
}

const read = (dir, path) => readFileSync(join(dir, path), 'utf8');
const json = (dir, path) => JSON.parse(read(dir, path));
const snapshot = dir => paths.map(path => read(dir, path));

function gitEnvironment(dir, tags, error = '') {
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  // Lokale tags zijn bewust leeg. Alleen de remote heeft de opgegeven refs, inclusief annotated tags.
  const refs = tags.flatMap(tag => ['0'.repeat(40) + `\trefs/tags/${tag}`, '1'.repeat(40) + `\trefs/tags/${tag}^{}`]).join('\n');
  writeFileSync(join(bin, 'git'), `#!${process.execPath}
import assert from 'node:assert/strict';
const args = process.argv.slice(2);
if (args[0] === 'tag' && args[1] === '--list') process.exit(0);
assert.deepEqual(args, ['ls-remote', '--tags', 'origin', 'v*']);
if (${JSON.stringify(error)}) { console.error(${JSON.stringify(error)}); process.exit(128); }
console.log(${JSON.stringify(refs)});
`, { mode: 0o755 });
  return { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` };
}

function assertVersions(dir, version) {
  for (const path of ['package.json', 'src-tauri/tauri.conf.json', 'headless/server/package.json', 'headless/consumer-example/package.json', 'integrations/claude-desktop/manifest.json']) {
    assert.equal(json(dir, path).version, version, path);
  }
  const lock = json(dir, 'package-lock.json');
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
  assert.ok(read(dir, 'src-tauri/Cargo.toml').includes(`name = "open-planner-studio"\nversion = "${version}"`));
  assert.ok(read(dir, 'src-tauri/Cargo.lock').includes(`name = "open-planner-studio"\nversion = "${version}"`));
  assert.ok(read(dir, 'headless/server/openapi.yaml').includes(`  version: ${version}\n`));
  assert.ok(read(dir, 'snap/snapcraft.yaml').includes(`version: '${version}'\n`));
}

test('gewone week begint bij nul en telt numeriek verder vanaf de hoogste stabiele weektag', () => {
  assert.deepEqual(isoWeek('2026-10-22'), { year: 2026, week: 43 });
  assert.equal(nextVersion('2026-10-22', ['v2026.10.0', 'v2026.42.99', 'v2027.43.50']), '2026.43.0');
  assert.equal(nextVersion('2026-10-22', ['v2026.43.0']), '2026.43.1');
  assert.equal(nextVersion('2026-10-22', ['v2026.43.9', 'v2026.43.99', 'v2026.43.10', 'v2026.43.100-beta', 'v2026.43.099', '2026.43.101']), '2026.43.100');
});

test('28 december 2026 t/m 3 januari 2027 horen allemaal bij ISO-weekjaar 2026, week 53', () => {
  for (const date of ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']) {
    assert.deepEqual(isoWeek(date), { year: 2026, week: 53 }, date);
    assert.equal(nextVersion(date, ['v2026.53.7', 'v2027.1.99']), '2026.53.8', date);
  }
  assert.equal(nextVersion('2027-01-04', ['v2026.53.99']), '2027.1.0');
  assert.deepEqual(isoWeek('2025-12-29'), { year: 2026, week: 1 });
});

test('foute nummers en ongeldige datums worden geweigerd', () => {
  for (const version of ['2026.03.0', '2026.43.01', '2026.0.0', '2026.54.0', '2027.53.0', '2026.43.-1', '2026.43.0-beta', 'v2026.43.0', '2026-43', '026.43.0', '2026.43.9007199254740992', '2026.43.0\n']) {
    assert.throws(() => parseVersion(version), /geen geldige versie/, version);
  }
  for (const date of ['2026-02-30', '2026-2-03', 'ongeldig']) assert.throws(() => isoWeek(date), /Ongeldige datum/, date);
  assert.deepEqual(parseVersion('2026.53.12345'), [2026, 53, 12345]);
});

test('bump houdt alle app-, Cargo- en headless-velden gelijk en bewaart dependencies en opmaak', t => {
  const dir = fixture(t);
  const before = snapshot(dir);
  const dependencies = json(dir, 'package-lock.json').packages;
  delete dependencies[''];
  assert.equal(bumpVersion({ root: dir, date: '2026-10-22', tags: [] }), '2026.43.0');
  assertVersions(dir, '2026.43.0');
  assert.equal(bumpVersion({ root: dir, date: '2026-10-22', tags: ['v2026.43.0'] }), '2026.43.1');
  assertVersions(dir, '2026.43.1');
  const afterDependencies = json(dir, 'package-lock.json').packages;
  delete afterDependencies[''];
  assert.deepEqual(afterDependencies, dependencies);
  // Uitsluitend de eigen versievelden mogen wijzigen, ook in Cargo.lock.
  for (const [index, path] of paths.entries()) {
    assert.equal(read(dir, path).replaceAll('2026.43.1', '2026.10.0'), before[index], path);
  }
  const bumped = snapshot(dir);
  checkVersionFiles('2026.43.1', dir);
  assert.deepEqual(snapshot(dir), bumped, 'de releasecontrole schrijft niets');
  assert.equal(bumpVersion({ root: dir, version: '2026.43.1' }), '2026.43.1', 'gelijk nummer is toegestaan');
  assert.equal(bumpVersion({ root: dir, version: '2026.44.1' }), '2026.44.1');
  assertVersions(dir, '2026.44.1');
});

test('een lager nummer of een ongeldig bestand laat alle bestanden ongewijzigd', t => {
  const dir = fixture(t);
  bumpVersion({ root: dir, version: '2026.43.10' });
  const before = snapshot(dir);
  for (const version of ['2026.43.9', '2026.42.99', '2025.52.99', '2026.043.11']) {
    assert.throws(() => bumpVersion({ root: dir, version }));
    assert.deepEqual(snapshot(dir), before);
  }
  assert.throws(() => bumpVersion({ root: dir, date: '2026-10-15', tags: [] }), /lager/);
  assert.deepEqual(snapshot(dir), before);
  writeFileSync(join(dir, 'src-tauri/Cargo.lock'), read(dir, 'src-tauri/Cargo.lock').replace('name = "open-planner-studio"', 'name = "ontbreekt"'));
  const broken = snapshot(dir);
  assert.throws(() => bumpVersion({ root: dir, version: '2026.44.0' }), /Cargo.lock.*vond er 0/);
  assert.deepEqual(snapshot(dir), broken, 'alles vooraf controleren voorkomt een gedeeltelijke bump');
});

test('de releasecontrole weigert ieder afwijkend versieveld afzonderlijk', t => {
  const dir = fixture(t);
  bumpVersion({ root: dir, version: '2026.43.0' });
  for (const path of paths) {
    const original = read(dir, path);
    writeFileSync(join(dir, path), original.replace('2026.43.0', '2026.42.0'));
    assert.throws(() => checkVersionFiles('2026.43.0', dir), error => error.message.includes(path), path);
    writeFileSync(join(dir, path), original);
  }
});

test('huidige weekversie is ook zonder tag een ondergrens voor de automatische bump', t => {
  const dir = fixture(t);
  bumpVersion({ root: dir, version: '2026.43.0' });
  assert.equal(bumpVersion({ root: dir, date: '2026-10-22', tags: [] }), '2026.43.1');
  assert.equal(bumpVersion({ root: dir, date: '2026-10-22', tags: ['v2026.43.0'] }), '2026.43.2');
  bumpVersion({ root: dir, version: '2026.43.10' });
  assert.equal(bumpVersion({ root: dir, date: '2026-10-22', tags: ['v2026.43.9'] }), '2026.43.11');
  assert.equal(bumpVersion({ root: dir, date: '2026-10-26', tags: [] }), '2026.44.0');
});

test('CLI: ontbrekende lokale releasetag wordt uit actuele origin-tags meegenomen', t => {
  const dir = fixture(t);
  const env = { ...gitEnvironment(dir, ['v2026.43.0']), OPS_BUMP_DATE: '2026-10-22' };
  const local = spawnSync('git', ['tag', '--list', 'v*'], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(local.status, 0);
  assert.equal(local.stdout, '', 'de lokale tags zijn leeg');
  const run = () => spawnSync(process.execPath, ['scripts/bump-version.js'], { cwd: dir, env, encoding: 'utf8' });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assertVersions(dir, '2026.43.1');
  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assertVersions(dir, '2026.43.2');
});

test('afgeschreven tag wordt niet hervat en de opvolger blijft hoger dan die tag', t => {
  const dir = fixture(t);
  const tag = 'v2026.43.0';
  bumpVersion({ root: dir, version: tag.slice(1) });
  const env = { ...gitEnvironment(dir, [tag]), TAG: tag, OPS_BUMP_DATE: '2026-10-24' };
  const reference = read(root, '.claude/skills/release/referentie.md');
  const blocks = text => [...text.matchAll(/```bash\n([\s\S]*?)\n```/g)].map(match => match[1]);
  const route = blocks(reference).find(body => body.includes('const afgeschreven ='));
  assert.ok(route, 'uitvoerbare afschrijvingscontrole ontbreekt');
  const ghTrace = join(dir, 'gh-trace.json');
  // Alleen PR-bodies lezen mag. Ook een onbedoelde rerun/publicatie blijft volledig lokaal.
  writeFileSync(join(dir, 'bin/gh'), `#!${process.execPath}
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
writeFileSync(${JSON.stringify(ghTrace)}, JSON.stringify(args));
assert.deepEqual(args, ['pr', 'list', '--repo', 'OpenAEC-Foundation/open-planner-studio',
  '--base', 'main', '--state', 'merged', '--search', '"Release v2026.43.0" in:title',
  '--limit', '1000', '--json', 'title,body,url']);
if (process.env.OPS_TEST_PR_ERROR) process.exit(1);
console.log(process.env.OPS_TEST_PR_BODIES);
`, { mode: 0o755 });
  const pr = { title: `Release ${tag}`, body: `Afgeschreven tag: ${tag}`, url: 'https://example.invalid/pull/7' };
  const run = body => spawnSync('bash', ['-e', '-c', body], { cwd: dir, env, encoding: 'utf8', timeout: 10_000 });
  const before = snapshot(dir);
  for (const [body, title, expected] of [
    ['Nog onafgerond', pr.title, 'hervatten'],
    ['Afgeschreven tag: v2026.42.0', pr.title, 'hervatten'],
    [pr.body, 'Gewone fix-PR', 'hervatten'],
    [`Reden: fout in getagde code\r\n${pr.body}\r\nFix-PR: #8`, pr.title, 'opvolger'],
    [pr.body, pr.title, 'opvolger'], // Dezelfde marker blijft ook de volgende zaterdag gelden.
  ]) {
    env.OPS_TEST_PR_BODIES = JSON.stringify([{ ...pr, body, title }]);
    const result = run(route);
    assert.equal(result.status, 0, result.stderr);
    const decision = JSON.parse(result.stdout);
    assert.equal(decision.actie, expected);
    assert.equal(decision.prev, tag, 'afschrijving verlaagt PREV niet');
    assert.equal(decision.releasePr, expected === 'opvolger' ? pr.url : undefined);
    assert.deepEqual(JSON.parse(readFileSync(ghTrace, 'utf8')).slice(0, 2), ['pr', 'list']);
    assert.deepEqual(snapshot(dir), before, 'herkenning schrijft geen versievelden');
  }
  env.OPS_TEST_PR_ERROR = '1';
  assert.notEqual(run(route).status, 0, 'een leesfout mag geen opvolgroute vrijgeven');
  delete env.OPS_TEST_PR_ERROR;

  const bumped = spawnSync(process.execPath, ['scripts/bump-version.js'], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(bumped.status, 0, bumped.stderr);
  assertVersions(dir, '2026.43.1');
  const gate = blocks(read(root, '.claude/skills/release/SKILL.md'))
    .find(body => body.includes('const [version, previous]'));
  assert.ok(gate, 'numerieke eindpoort ontbreekt');
  env.PREV = tag;
  for (const version of ['2026.42.99', '2026.43.0', '2026.43.1']) {
    env.VERSION = version;
    const checked = run(gate.slice(0, gate.indexOf('\nJS\n') + 4));
    assert.equal(checked.status === 0, version === '2026.43.1', checked.stderr);
  }
});

test('CLI: onbereikbare of ontbrekende origin blokkeert zonder lokale terugval en zonder schrijven', t => {
  for (const error of ['Could not resolve host: github.com', "'origin' does not appear to be a git repository"]) {
    const dir = fixture(t);
    const before = snapshot(dir);
    const env = { ...gitEnvironment(dir, [], error), OPS_BUMP_DATE: '2026-10-22' };
    const run = args => spawnSync(process.execPath, ['scripts/bump-version.js', ...args], { cwd: dir, env, encoding: 'utf8' });
    const failed = run([]);
    assert.equal(failed.status, 1, error);
    assert.match(failed.stderr, /Kan de actuele tags van origin niet lezen/);
    assert.deepEqual(snapshot(dir), before);
    assert.equal(run(['2026.43.0']).status, 0, 'een expliciete versie heeft geen remote nodig');
    assertVersions(dir, '2026.43.0');
  }
});

test('CLI zonder argument leest origin-tags, gebruikt OPS_BUMP_DATE en ondersteunt --check', t => {
  for (const TZ of ['Europe/Amsterdam', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
    const dir = fixture(t);
    const env = { ...gitEnvironment(dir, ['v2026.53.2', 'v2026.53.10']), OPS_BUMP_DATE: '2027-01-01', TZ };
    const run = args => spawnSync(process.execPath, ['scripts/bump-version.js', ...args], { cwd: dir, env, encoding: 'utf8' });
    const result = run([]);
    assert.equal(result.status, 0, result.stderr);
    assertVersions(dir, '2026.53.11');
    assert.equal(run(['--check', '2026.53.11']).status, 0);
    assert.equal(run(['--check', '2026.53.12']).status, 1);
    assert.equal(run(['2026.52.0']).status, 1);
    assert.equal(run(['2027.01.0']).status, 1);
    assert.equal(run(['2027.1.0', 'extra']).status, 1);
  }
});
