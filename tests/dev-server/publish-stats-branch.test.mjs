import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Draait scripts/publish-stats-branch.sh tegen een tijdelijke bare repo: eerst zonder
// stats-branch (orphan-commit), dan nog eens (commit mét parent), dan ongewijzigd (no-op).

const SCRIPT = resolve(import.meta.dirname, '../../scripts/publish-stats-branch.sh');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'ops-stats-'));
  const bare = join(root, 'remote.git');
  const work = join(root, 'work');
  git(root, 'init', '-q', '--bare', bare);
  git(root, 'init', '-q', work);
  git(work, 'remote', 'add', 'origin', bare);
  return { root, bare, work };
}

function publish(work, json) {
  const file = join(work, 'download-stats.json');
  writeFileSync(file, json);
  return execFileSync('bash', [SCRIPT, file], {
    cwd: work, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GITHUB_REPOSITORY: 'o/r' },
  }).trim();
}

test('eerste publicatie maakt een orphan stats-branch met downloads.json en README', () => {
  const { root, bare, work } = setup();
  try {
    const out = publish(work, '{"schemaVersion":1,"generatedAt":"2026-09-07T00:00:00Z"}\n');
    assert.match(out, /^OK\s+gepubliceerd/);
    assert.equal(git(bare, 'rev-list', '--count', 'stats'), '1');
    assert.deepEqual(git(bare, 'ls-tree', '--name-only', 'stats').split('\n').sort(), ['README.md', 'downloads.json']);
    assert.match(git(bare, 'show', 'stats:downloads.json'), /"schemaVersion":1/);
    assert.match(git(bare, 'show', 'stats:README.md'), /raw\.githubusercontent\.com\/o\/r\/stats\/downloads\.json/);
    assert.equal(git(bare, 'log', '-1', '--format=%an', 'stats'), 'github-actions[bot]');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('tweede publicatie bouwt voort op de bestaande top; identieke inhoud is een no-op', () => {
  const { root, bare, work } = setup();
  try {
    publish(work, '{"generatedAt":"a"}\n');
    const first = git(bare, 'rev-parse', 'stats');
    publish(work, '{"generatedAt":"b"}\n');
    assert.equal(git(bare, 'rev-list', '--count', 'stats'), '2');
    assert.equal(git(bare, 'rev-parse', 'stats^'), first, 'parent is de vorige top, geen force-push');
    assert.match(git(bare, 'show', 'stats:downloads.json'), /"b"/);
    const out = publish(work, '{"generatedAt":"b"}\n');
    assert.match(out, /al actueel/);
    assert.equal(git(bare, 'rev-list', '--count', 'stats'), '2');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ongeldige of lege JSON wordt geweigerd vóór er iets gepusht wordt', () => {
  const { root, bare, work } = setup();
  try {
    assert.throws(() => publish(work, '{not json'), /geen geldige JSON/);
    assert.throws(() => publish(work, ''), /ontbreekt of is leeg/);
    assert.throws(() => git(bare, 'rev-parse', '--verify', 'stats'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
