import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worktreeRoot, worktreeSlug, isPortFree } from '../../scripts/dev-port.mjs';

test('worktreeRoot geeft de absolute toplevel van een git-repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ops-wt-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  const root = worktreeRoot(dir);
  assert.equal(root, execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' }).trim());
  rmSync(dir, { recursive: true, force: true });
});
test('worktreeRoot buiten een git-repo → null (gooit niet)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ops-nogit-'));
  assert.equal(worktreeRoot(dir), null);
  rmSync(dir, { recursive: true, force: true });
});
test('worktreeSlug is de basename van de root', () => {
  assert.equal(worktreeSlug('/a/b/mijn-worktree'), 'mijn-worktree');
  assert.equal(worktreeSlug(null), 'unknown');
});
test('isPortFree geeft true voor een vrije poort en false als hij bezet is', async () => {
  const { createServer } = await import('node:net');
  assert.equal(await isPortFree(3106), true);
  const srv = createServer();
  await new Promise((r) => srv.listen(3106, '127.0.0.1', r));
  assert.equal(await isPortFree(3106), false);
  await new Promise((r) => srv.close(r));
});
