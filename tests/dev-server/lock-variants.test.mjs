import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { withAllocLock, acquireGuardLock, allocLockPath } from '../../scripts/dev-lock.mjs';
import { worktreeRoot } from '../../scripts/dev-port.mjs';

function gitRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ops-alloc-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' }).trim();
}
test('allocLockPath verankert absoluut aan de git-common-dir', () => {
  const root = gitRepo();
  const gcd = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(allocLockPath(root), join(resolve(root, gcd), 'ops-dev-alloc.lock'));
  rmSync(root, { recursive: true, force: true });
});
test('withAllocLock draait de fn en geeft z\'n resultaat terug', async () => {
  const root = gitRepo();
  assert.equal(await withAllocLock(root, async () => 42), 42);
  rmSync(root, { recursive: true, force: true });
});
test('acquireGuardLock met OPS_DEV_GUARDED gezet is een no-op', () => {
  const prev = process.env.OPS_DEV_GUARDED;
  process.env.OPS_DEV_GUARDED = '1';
  try {
    const release = acquireGuardLock('/some/root', 3042);
    assert.equal(typeof release, 'function');
    release();
  } finally {
    if (prev === undefined) delete process.env.OPS_DEV_GUARDED; else process.env.OPS_DEV_GUARDED = prev;
  }
});
test('acquireGuardLock weigert direct als het slot al door een levende pid gehouden wordt', () => {
  const prev = process.env.OPS_DEV_GUARDED;
  delete process.env.OPS_DEV_GUARDED;
  const root = gitRepo();
  try {
    const first = acquireGuardLock(root, 3042);
    assert.throws(() => acquireGuardLock(root, 3042), /draait al/);
    first();
  } finally {
    if (prev !== undefined) process.env.OPS_DEV_GUARDED = prev;
    rmSync(root, { recursive: true, force: true });
  }
});
