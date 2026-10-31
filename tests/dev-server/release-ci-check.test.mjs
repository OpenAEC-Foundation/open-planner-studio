import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBrowserRun, checkPushRun, fridayEvening, gitIsAncestor } from '../../scripts/release-ci-check.mjs';

// De CI-controle van de release: dezelfde regels in de gate van release.yml en in de release-skill.
const root = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPT = join(root, 'scripts', 'release-ci-check.mjs');
const REPO = 'o/r';
const SHA = 'a'.repeat(40);
const OLDER = 'b'.repeat(40);
const NOW = Date.parse('2026-11-07T10:00:00Z');
const FRIDAY = '2026-11-06T21:00:30Z';

const shard = (n, conclusion = 'success') => ({ name: `verify (browser ${n}-4)`, status: 'completed', conclusion });
const GREEN_JOBS = [1, 2, 3, 4].map(n => shard(n)).concat(
  { name: 'build', conclusion: 'skipped' },
  { name: 'verify (${{ matrix.name }})', conclusion: 'skipped' },
  { name: 'test', conclusion: 'success' },
);
// Een run waarin de browserjobs zijn overgeslagen: GitHub toont dan de ruwe matrixnaam.
const SKIPPED_JOBS = [
  { name: 'verify (${{ matrix.name }})', conclusion: 'skipped' },
  { name: 'test', conclusion: 'success' },
];
const run = (id, over = {}) => ({
  id, event: 'schedule', head_branch: 'main', head_sha: OLDER, status: 'completed', conclusion: 'success', created_at: FRIDAY, ...over,
});

/** Een nep-`gh api`: runs per event, jobs van poging 1 per run-ID. */
function fakeApi({ schedule = [], dispatch = [], push = [], jobs = {} }) {
  return (path) => {
    if (path.includes('head_sha=')) return { workflow_runs: push };
    if (path.includes('event=schedule')) return { workflow_runs: schedule };
    if (path.includes('event=workflow_dispatch')) return { workflow_runs: dispatch };
    const m = /runs\/(\d+)\/attempts\/1\/jobs/.exec(path);
    if (m) return { jobs: jobs[m[1]] };
    throw new Error(`onverwacht pad: ${path}`);
  };
}

const browser = (state, isAncestor = () => true) =>
  checkBrowserRun({ sha: SHA, repo: REPO, now: NOW, api: fakeApi(state), isAncestor });
const pushRun = push => checkPushRun({ sha: SHA, repo: REPO, api: fakeApi({ push }) });

test('browserrun: groen op een voorouder of op de tag zelf', () => {
  const state = { schedule: [run(1)], jobs: { 1: GREEN_JOBS } };
  assert.equal(browser(state).ok, true);
  const self = { schedule: [run(1, { head_sha: SHA })], jobs: { 1: GREEN_JOBS } };
  assert.equal(browser(self, (a, b) => a === b).ok, true);
});

test('browserrun: de handmatige bewijsrun van de reparatie telt en gaat vóór de rode vrijdagrun', () => {
  const red = [shard(1, 'failure'), shard(2), shard(3), shard(4), { name: 'test', conclusion: 'failure' }];
  const state = {
    schedule: [run(1)],
    dispatch: [run(2, { event: 'workflow_dispatch', created_at: '2026-11-07T01:00:00Z' })],
    jobs: { 1: red, 2: GREEN_JOBS },
  };
  const result = browser(state);
  assert.equal(result.ok, true, result.text);
  assert.match(result.text, /run 2 /);
});

test('browserrun: rood stopt, ook als een oudere run groen was', () => {
  const red = [shard(1), shard(2, 'failure'), shard(3), shard(4), { name: 'test', conclusion: 'failure' }];
  const result = browser({
    schedule: [run(2), run(1, { created_at: '2026-11-01T21:00:00Z' })],
    jobs: { 2: red, 1: GREEN_JOBS },
  });
  assert.equal(result.ok, false);
  assert.match(result.text, /browser 2-4\) = failure/);
});

test('browserrun: een haperende test blijft rood, ook als de rerun groen is', () => {
  // De run zelf heet `success` na de rerun; poging 1 bepaalt de uitkomst.
  const firstAttempt = [shard(1), shard(2), shard(3, 'failure'), shard(4), { name: 'test', conclusion: 'failure' }];
  const result = browser({ schedule: [run(1, { conclusion: 'success', run_attempt: 2 })], jobs: { 1: firstAttempt } });
  assert.equal(result.ok, false);
  assert.match(result.text, /poging 1/);
});

test('browserrun: ontbrekend stopt', () => {
  const result = browser({});
  assert.equal(result.ok, false);
  assert.match(result.text, /geen browserrun/);
});

test('browserrun: een groene run van donderdag vervangt de ontbrekende vrijdagrun niet', () => {
  const thursday = '2026-11-05T12:00:00Z';
  const result = browser({
    dispatch: [run(1, { event: 'workflow_dispatch', created_at: thursday })],
    jobs: { 1: GREEN_JOBS },
  });
  assert.equal(result.ok, false, result.text);
  assert.match(result.text, /geen browserrun sinds vrijdag 2026-11-06T21:00:00/);
});

test('browserrun: een vrijdagrun met overgeslagen browserjobs laat een eerdere groene run niet tellen', () => {
  const result = browser({
    schedule: [run(2)],
    dispatch: [run(1, { event: 'workflow_dispatch', created_at: '2026-11-05T12:00:00Z' })],
    jobs: { 2: SKIPPED_JOBS, 1: GREEN_JOBS },
  });
  assert.equal(result.ok, false, result.text);
  assert.match(result.text, /geen browserrun sinds vrijdag/);
});

test('browserrun: het bewijs begint op vrijdag precies 22:00 Nederlandse tijd', () => {
  const dispatchAt = created_at => ({ dispatch: [run(1, { event: 'workflow_dispatch', created_at })], jobs: { 1: GREEN_JOBS } });
  assert.equal(browser(dispatchAt('2026-11-06T20:59:59Z')).ok, false);
  assert.equal(browser(dispatchAt('2026-11-06T21:00:00Z')).ok, true);
  assert.equal(browser({ dispatch: [run(1, { event: 'workflow_dispatch', created_at: 'onzin' })], jobs: { 1: GREEN_JOBS } }).ok, false);
});

test('browserrun: een latere groene bewijsrun telt, ook na een vrijdagrun met overgeslagen browserjobs', () => {
  const result = browser({
    schedule: [run(1)],
    dispatch: [run(2, { event: 'workflow_dispatch', created_at: '2026-11-07T01:00:00Z' })],
    jobs: { 1: SKIPPED_JOBS, 2: GREEN_JOBS },
  });
  assert.equal(result.ok, true, result.text);
  assert.equal(result.runId, 2);
});

test('fridayEvening: de laatste vrijdag 22:00 in Europe/Amsterdam, in winter- en zomertijd', () => {
  const iso = text => new Date(fridayEvening(Date.parse(text))).toISOString();
  assert.equal(iso('2026-11-07T10:00:00Z'), '2026-11-06T21:00:00.000Z');
  assert.equal(iso('2027-04-03T10:00:00Z'), '2027-04-02T20:00:00.000Z');
  // Vrijdag vóór 22:00 is de vrijdag ervoor nog de grens; om 22:00 precies begint de nieuwe.
  assert.equal(iso('2026-11-06T20:59:59Z'), '2026-10-30T21:00:00.000Z');
  assert.equal(iso('2026-11-06T21:00:00Z'), '2026-11-06T21:00:00.000Z');
  assert.equal(iso('2026-11-10T09:00:00Z'), '2026-11-06T21:00:00.000Z');
  // Vlak na een klokwissel staat de grens nog in de oude tijd.
  assert.equal(iso('2027-03-28T12:00:00Z'), '2027-03-26T21:00:00.000Z');
  assert.equal(iso('2027-11-01T09:00:00Z'), '2027-10-29T20:00:00.000Z');
  // Een UTC-tijd op zaterdag is in Amsterdam soms al later, nooit een andere vrijdag dan die ervoor.
  assert.equal(iso('2026-11-06T23:30:00Z'), '2026-11-06T21:00:00.000Z');
});

test('browserrun: elke uitkomst noemt de beoordeelde run, zodat gate, release en reparatie dezelfde lezen', () => {
  // Vrijdag groen, daarna een handmatige run: rood in poging 1, groen in de rerun.
  const firstAttempt = [shard(1, 'failure'), shard(2), shard(3), shard(4), { name: 'test', conclusion: 'failure' }];
  const state = {
    schedule: [run(1)],
    dispatch: [run(2, { event: 'workflow_dispatch', created_at: '2026-11-07T01:00:00Z', run_attempt: 2 })],
    jobs: { 1: GREEN_JOBS, 2: firstAttempt },
  };
  const result = browser(state);
  assert.equal(result.ok, false);
  assert.equal(result.runId, 2);
  assert.equal(browser({ schedule: [run(1)], jobs: { 1: GREEN_JOBS } }).runId, 1);
  assert.equal(browser({}).runId, null);
});

test('browserrun: een rode huidige conclusie stopt, ook als poging 1 groen was', () => {
  const result = browser({ schedule: [run(1, { conclusion: 'failure', run_attempt: 2 })], jobs: { 1: GREEN_JOBS } });
  assert.equal(result.ok, false, result.text);
  assert.match(result.text, /conclusie failure/);
  assert.equal(result.runId, 1);
});

test('browserrun: overgeslagen browserjobs tellen niet als browserrun', () => {
  const alleen = browser({ schedule: [run(1)], jobs: { 1: SKIPPED_JOBS } });
  assert.equal(alleen.ok, false);
  assert.match(alleen.text, /geen browserrun/);
  // Na de overgeslagen run blijft een eerdere run binnen het venster de laatste browserrun.
  const eerder = browser({
    schedule: [run(2, { created_at: '2026-11-07T02:00:00Z' }), run(1)],
    jobs: { 2: SKIPPED_JOBS, 1: GREEN_JOBS },
  });
  assert.equal(eerder.ok, true, eerder.text);
  assert.equal(eerder.runId, 1);
  // Ook een shard die `skipped` meldt onder zijn eigen naam telt niet.
  const opNaam = [1, 2, 3, 4].map(n => shard(n, 'skipped')).concat({ name: 'test', conclusion: 'success' });
  assert.equal(browser({ schedule: [run(1)], jobs: { 1: opNaam } }).ok, false);
});

test('browserrun: niet klaar, onvolledig of geannuleerd stopt', () => {
  assert.match(browser({ schedule: [run(1, { status: 'in_progress', conclusion: null })] }).text, /niet klaar/);
  const drie = [shard(1), shard(2), shard(4), { name: 'test', conclusion: 'success' }];
  assert.match(browser({ schedule: [run(1)], jobs: { 1: drie } }).text, /shards onvolledig/);
  const geannuleerd = [shard(1, 'cancelled'), shard(2), shard(3), shard(4), { name: 'test', conclusion: 'cancelled' }];
  assert.equal(browser({ schedule: [run(1)], jobs: { 1: geannuleerd } }).ok, false);
  const zonderTest = GREEN_JOBS.filter(job => job.name !== 'test');
  assert.match(browser({ schedule: [run(1)], jobs: { 1: zonderTest } }).text, /job test/);
});

test('browserrun: een run op een commit die geen voorouder is, stopt', () => {
  const result = browser({ schedule: [run(1)], jobs: { 1: GREEN_JOBS } }, () => false);
  assert.equal(result.ok, false);
  assert.match(result.text, /geen voorouder/);
});

test('browserrun: een run op een andere branch telt niet', () => {
  const result = browser({ dispatch: [run(1, { event: 'workflow_dispatch', head_branch: 'fix/x' })], jobs: { 1: GREEN_JOBS } });
  assert.equal(result.ok, false);
  assert.match(result.text, /geen browserrun/);
});

test('pushrun: groen, ontbrekend, niet klaar, rood en de verkeerde commit', () => {
  const push = (over = {}) => run(9, { event: 'push', head_sha: SHA, ...over });
  assert.equal(pushRun([push()]).ok, true);
  assert.match(pushRun([]).text, /geen ci\.yml-pushrun/);
  assert.match(pushRun([push({ status: 'in_progress', conclusion: null })]).text, /niet klaar/);
  assert.match(pushRun([push({ conclusion: 'failure' })]).text, /conclusie failure/);
  assert.match(pushRun([push({ conclusion: 'cancelled' })]).text, /conclusie cancelled/);
  assert.match(pushRun([push({ head_sha: OLDER })]).text, /geen ci\.yml-pushrun/);
  assert.match(pushRun([push({ event: 'workflow_dispatch' })]).text, /geen ci\.yml-pushrun/);
});

test('onverwachte uitvoer stopt hard', () => {
  assert.throws(() => checkPushRun({ sha: SHA, repo: REPO, api: () => ({}) }), /geen workflow_runs/);
  assert.throws(() => browser({ schedule: [run(1)], jobs: {} }), /geen jobs/);
});

test('git: een onbekende commit is een harde fout, geen "nee"', () => {
  assert.throws(() => gitIsAncestor('0'.repeat(40), 'HEAD'), /merge-base/);
});

/** Draait het echte script met een nep-`gh` op het PATH. */
function cli(t, ghBody, args = [SHA]) {
  const dir = mkdtempSync(join(tmpdir(), 'release-ci-check-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\n${ghBody}\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
  });
}

test('commando: een andere foutcode, lege uitvoer of ongeldige JSON van gh geeft ::error:: en exit 1', (t) => {
  for (const [body, expected] of [
    ['echo "HTTP 403" >&2; exit 4', /HTTP 403/],
    ['exit 0', /lege uitvoer/],
    ['echo "<html>"', /geen geldige JSON/],
    ['echo "{}"', /geen workflow_runs/],
  ]) {
    const r = cli(t, body);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /^::error::release-ci-check: /m);
    assert.match(r.stdout, expected);
  }
});

test('commando: geen runs noemt beide ontbrekende runs, elk met ::error::', (t) => {
  const r = cli(t, `echo '{"workflow_runs":[]}'`);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /::error::.*geen ci\.yml-pushrun/);
  assert.match(r.stdout, /::error::.*geen browserrun/);
});

test('commando: --browser doet alleen de browsercontrole en noemt de run', (t) => {
  const r = cli(t, `echo '{"workflow_runs":[]}'`, ['--browser', SHA]);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /::error::.*geen browserrun/);
  assert.doesNotMatch(r.stdout, /pushrun/);
  assert.match(r.stdout, /^BROWSERRUN=$/m);
});

test('de release en de reparatie gebruiken dezelfde browsercontrole als de gate', () => {
  for (const file of ['.claude/skills/release/SKILL.md', '.claude/skills/browsertests-repareren/SKILL.md']) {
    assert.match(readFileSync(join(root, file), 'utf8'), /node scripts\/release-ci-check\.mjs --browser "\$SHA"/, file);
  }
  const repair = readFileSync(join(root, '.claude/skills/browsertests-repareren/SKILL.md'), 'utf8');
  assert.doesNotMatch(repair, /--event schedule/, 'de reparatie kiest geen eigen run');
  assert.match(repair, /BROWSERRUN/);
});

test('commando: een ontbrekende of ongeldige SHA stopt', (t) => {
  for (const args of [[], [''], ['HEAD'], ['abc'], ['--browser'], ['--browser', 'abc']]) {
    const r = cli(t, 'exit 1', args);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error::/);
  }
});

test('de gate in release.yml draait deze controle, zonder verify en Playwright, met alleen leesrechten', () => {
  const yaml = readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8');
  const gate = yaml.slice(yaml.indexOf('\n  gate:\n'), yaml.indexOf('\n  create-release:\n'));
  assert.match(gate, /run: node scripts\/release-ci-check\.mjs "\$\(git rev-parse 'HEAD\^\{commit\}'\)"/);
  assert.match(gate, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(gate, /permissions:\n\s+contents: read\n(\s+#.*\n)?\s+actions: read\n/);
  assert.doesNotMatch(gate, /: write/);
  assert.match(gate, /run: npm run verify:translations/);
  assert.doesNotMatch(gate, /npm run verify\n/);
  assert.doesNotMatch(gate, /playwright install/i);
  assert.match(gate, /fetch-depth: 0/, 'de voorouderscontrole heeft de volledige historie nodig');
});
