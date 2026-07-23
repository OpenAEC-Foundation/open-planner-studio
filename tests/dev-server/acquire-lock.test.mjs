import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock } from '../../scripts/dev-lock.mjs';

function lockPath() {
  return join(mkdtempSync(join(tmpdir(), 'ops-lock-')), 'x.lock');
}
test('verse claim slaagt en schrijft onze pid', () => {
  const p = lockPath();
  const release = acquireLock(p);
  assert.ok(existsSync(p));
  assert.equal(JSON.parse(readFileSync(p, 'utf8')).pid, process.pid);
  release();
  assert.equal(existsSync(p), false);
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('steelt een slot van een dode pid', () => {
  const p = lockPath();
  writeFileSync(p, JSON.stringify({ pid: 2147483646, startedAt: 1 }));
  const release = acquireLock(p, { timeoutMs: 500 });
  assert.equal(JSON.parse(readFileSync(p, 'utf8')).pid, process.pid);
  release();
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('weigert (throwt na timeout) als een LEVENDE pid het slot houdt', () => {
  const p = lockPath();
  writeFileSync(p, JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
  assert.throws(() => acquireLock(p, { timeoutMs: 150, sleepMs: 25 }), /vastgehouden door levende/);
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('een leeg/half-geschreven slot geldt als levend (steelt niet, throwt)', () => {
  const p = lockPath();
  writeFileSync(p, '');
  assert.throws(() => acquireLock(p, { timeoutMs: 150, sleepMs: 25 }), /vastgehouden/);
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('allowAgeSteal steelt een te oud slot', () => {
  const p = lockPath();
  writeFileSync(p, JSON.stringify({ pid: process.pid, startedAt: 1 }));
  const release = acquireLock(p, { allowAgeSteal: true, ageMs: 1000, timeoutMs: 500 });
  assert.equal(JSON.parse(readFileSync(p, 'utf8')).pid, process.pid);
  release();
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('schrijft extra velden mee (port/root)', () => {
  const p = lockPath();
  const release = acquireLock(p, { extra: { port: 3042, root: '/x' } });
  const h = JSON.parse(readFileSync(p, 'utf8'));
  assert.equal(h.port, 3042);
  assert.equal(h.root, '/x');
  release();
  rmSync(join(p, '..'), { recursive: true, force: true });
});
