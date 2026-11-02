import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, touchesRust } from '../../scripts/ci-changes.mjs';

test('touchesRust: src-tauri, de pakketlijst en de eigen workflow tellen, de rest niet', () => {
  assert.equal(touchesRust(['src-tauri/src/main.rs']), true);
  assert.equal(touchesRust(['src-tauri/Cargo.lock']), true);
  assert.equal(touchesRust(['src-tauri/Cargo.toml']), true);
  assert.equal(touchesRust(['package.json']), true);
  assert.equal(touchesRust(['package-lock.json']), true);
  assert.equal(touchesRust(['.github/workflows/ci.yml'], '.github/workflows/ci.yml'), true);
  assert.equal(touchesRust(['.github/workflows/ci.yml']), false);
  assert.equal(touchesRust(['src/engine/renderer/GanttRenderer.ts', 'docs/x.md', 'public/docs/nl/a.md']), false);
  assert.equal(touchesRust(['headless/server/package.json']), false, 'alleen de pakketlijst in de root');
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
