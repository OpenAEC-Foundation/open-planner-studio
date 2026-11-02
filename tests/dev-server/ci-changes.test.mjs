import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, touchesRust } from '../../scripts/ci-changes.mjs';

test('touchesRust: src-tauri en de pakketlijst tellen, de rest niet, ook de workflow niet', () => {
  assert.equal(touchesRust(['src-tauri/src/main.rs']), true);
  assert.equal(touchesRust(['src-tauri/Cargo.lock']), true);
  assert.equal(touchesRust(['src-tauri/Cargo.toml']), true);
  assert.equal(touchesRust(['package.json']), true);
  assert.equal(touchesRust(['package-lock.json']), true);
  assert.equal(touchesRust(['.github/workflows/ci.yml', '.github/workflows/codeql.yml']), false);
  assert.equal(touchesRust(['src/engine/renderer/GanttRenderer.ts', 'docs/x.md', 'public/docs/nl/a.md']), false);
  assert.equal(touchesRust(['headless/server/package.json']), false, 'alleen de pakketlijst in de root');
  assert.equal(touchesRust(['Cargo.toml']), true);
  assert.equal(touchesRust(['Cargo.lock']), true);
  assert.equal(touchesRust([]), false);
});

test('decide: buiten een PR draait alles; een fout bij het vergelijken laat ook alles draaien', () => {
  assert.equal(decide('push', () => []).rust, true);
  assert.equal(decide('schedule', () => []).rust, true);
  assert.equal(decide('pull_request', () => ['src/a.ts']).rust, false);
  assert.equal(decide('pull_request', () => ['src-tauri/src/lib.rs']).rust, true);
  const failed = decide('pull_request', () => { throw new Error('geen ouder'); });
  assert.equal(failed.rust, true);
  assert.match(failed.reason, /geen ouder/);
});

// Echte Git-repo's: de CLI zoals de CI hem draait, tegen een commit met één ouder (zoals de merge-commit van een PR).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

test('een leeg label-event kan de laatste echte test-check niet overschrijven (552)', () => {
  const yaml = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const job = yaml.match(/^  test:\n((?:[ \t]+[^\n]*\n|\n)*)/m)?.[1];
  assert.ok(job, 'de afsluitende test-job bestaat');
  // Deze naam gebruikt alleen veldlezingen, strings, ==/!= en &&/||: dezelfde betekenis
  // in GitHub-expressies en JavaScript. Zonder eigen naam heet de job naar zijn id: test.
  const expression = job.match(/^    name: \$\{\{ (.+) \}\}\s*$/m)?.[1] ?? "'test'";
  const name = (eventName, event) => runInNewContext(expression, { github: { event_name: eventName, event } });
  for (const action of ['opened', 'synchronize', 'reopened']) {
    assert.equal(name('pull_request', { action }), 'test');
  }
  for (const event of ['push', 'schedule', 'workflow_dispatch']) assert.equal(name(event, {}), 'test');
  assert.equal(name('pull_request', { action: 'labeled', label: { name: 'browsertests' } }), 'test');
  for (const label of ['bug', 'documentation', 'agent-ticket']) {
    assert.notEqual(name('pull_request', { action: 'labeled', label: { name: label } }), 'test',
      `${label}: een overgeslagen lege run moet een andere checknaam hebben`);
  }
});

const script = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'ci-changes.mjs');

/** Basis met een paar bestanden, daarna `change(dir)` als tweede commit; geeft de uitkomst van de CLI terug. */
function cliOn(change) {
  const dir = mkdtempSync(join(tmpdir(), 'ops-ci-changes-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    git('init', '-q');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'test');
    git('config', 'commit.gpgsign', 'false');
    for (const [file, text] of [
      ['src-tauri/icons/icon.ico', 'een icoon dat groot genoeg is om als verplaatsing herkend te worden\n'.repeat(20)],
      ['src-tauri/src/oud.rs', 'fn oud() {}\n'],
      ['docs/leesmij.md', 'tekst\n'],
    ]) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), text);
    }
    git('add', '-A');
    git('commit', '-q', '-m', 'basis');
    change(dir);
    git('add', '-A');
    git('commit', '-q', '-m', 'wijziging');
    const output = join(dir, '.output');
    execFileSync(process.execPath, [script, 'pull_request'], { cwd: dir, env: { ...process.env, GITHUB_OUTPUT: output } });
    return readFileSync(output, 'utf8').trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('git: een verplaatsing uit src-tauri/ telt als Rust-wijziging', () => {
  assert.equal(cliOn((dir) => renameSync(join(dir, 'src-tauri/icons/icon.ico'), join(dir, 'docs/icon.ico'))), 'rust=true');
});

test('git: een verwijdering in src-tauri/ telt als Rust-wijziging', () => {
  assert.equal(cliOn((dir) => unlinkSync(join(dir, 'src-tauri/src/oud.rs'))), 'rust=true');
});

test('git: een pad met een niet-ASCII-teken in src-tauri/ telt als Rust-wijziging', () => {
  assert.equal(cliOn((dir) => writeFileSync(join(dir, 'src-tauri/src/één.rs'), 'fn een() {}\n')), 'rust=true');
});

test('git: Cargo.toml in de root telt als pakketlijst', () => {
  assert.equal(cliOn((dir) => writeFileSync(join(dir, 'Cargo.toml'), '[workspace]\n')), 'rust=true');
});

test('git: alleen documentatie is geen Rust-wijziging', () => {
  assert.equal(cliOn((dir) => writeFileSync(join(dir, 'docs/leesmij.md'), 'andere tekst\n')), 'rust=false');
});
