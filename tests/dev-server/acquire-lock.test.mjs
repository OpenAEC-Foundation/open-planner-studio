import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync, mkdtempSync, writeFileSync, writeSync, existsSync, readFileSync, renameSync, rmSync, utimesSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquireLock } from '../../scripts/dev-lock.mjs';

const DEV_LOCK = fileURLToPath(new URL('../../scripts/dev-lock.mjs', import.meta.url));

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

test('echte schrijffout (EFBIG via ulimit -f 0) laat geen leeg slot achter', { skip: process.platform === 'win32' }, () => {
  const p = lockPath();
  const child = `
    const { acquireLock } = await import(${JSON.stringify(pathToFileURL(DEV_LOCK).href)});
    try { acquireLock(${JSON.stringify(p)}, { timeoutMs: 0 }); console.log('GEEN-FOUT'); }
    catch (e) { console.log('FOUT ' + e.code); }
  `;
  const r = spawnSync('bash', ['-c', 'ulimit -f 0; exec "$0" --input-type=module -e "$1"', process.execPath, child], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'FOUT EFBIG', 'de schrijffout wordt doorgegooid');
  assert.equal(existsSync(p), false, 'het eigen, lege slot is opgeruimd');
  const release = acquireLock(p, { timeoutMs: 0 });
  release();
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('sluitfout na een geslaagde schrijf ruimt het eigen slot op en gooit door', () => {
  const p = lockPath();
  const close = () => { throw Object.assign(new Error('ENOSPC: no space left on device, close'), { code: 'ENOSPC' }); };
  assert.throws(() => acquireLock(p, { timeoutMs: 0, close }), { code: 'ENOSPC' });
  assert.equal(existsSync(p), false);
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('een onvolledige schrijf geldt als schrijffout (geen half slot van een levende houder)', () => {
  const p = lockPath();
  const write = (fd, buf) => writeSync(fd, buf, 0, 5);
  assert.throws(() => acquireLock(p, { timeoutMs: 0, write }), /onvolledig/);
  assert.equal(existsSync(p), false);
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('opruimen na een schrijffout raakt nooit een ANDER slot op hetzelfde pad', () => {
  const p = lockPath();
  const ander = JSON.stringify({ pid: process.pid, startedAt: 42 });
  const write = () => {
    renameSync(p, `${p}.weg`);
    writeFileSync(p, ander);
    throw Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' });
  };
  assert.throws(() => acquireLock(p, { timeoutMs: 0, write }), { code: 'ENOSPC' });
  assert.equal(readFileSync(p, 'utf8'), ander, 'het slot van de ander staat er nog');
  rmSync(join(p, '..'), { recursive: true, force: true });
});

function backdate(p, seconds) {
  const t = new Date(Date.now() - seconds * 1000);
  utimesSync(p, t, t);
}
test('een LEEG slot ouder dan emptyAgeMs wordt gestolen', () => {
  const p = lockPath();
  writeFileSync(p, '');
  backdate(p, 60);
  const release = acquireLock(p, { timeoutMs: 500 });
  assert.equal(JSON.parse(readFileSync(p, 'utf8')).pid, process.pid);
  release();
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('een HALF geschreven slot ouder dan emptyAgeMs wordt gestolen, ook zonder allowAgeSteal', () => {
  const p = lockPath();
  writeFileSync(p, '{"pid":12');
  backdate(p, 60);
  const release = acquireLock(p, { allowAgeSteal: false, timeoutMs: 500 });
  assert.equal(JSON.parse(readFileSync(p, 'utf8')).pid, process.pid);
  release();
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('een leeg slot jonger dan emptyAgeMs blijft levend (steelt niet)', () => {
  const p = lockPath();
  writeFileSync(p, '');
  backdate(p, 5);
  assert.throws(() => acquireLock(p, { emptyAgeMs: 10000, timeoutMs: 150, sleepMs: 25 }), /vastgehouden/);
  assert.equal(readFileSync(p, 'utf8'), '');
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('een ONLEESBAAR oud slot is geen leeg slot en wordt niet gestolen', () => {
  const p = lockPath();
  mkdirSync(p);
  backdate(p, 60);
  assert.throws(() => acquireLock(p, { timeoutMs: 150, sleepMs: 25 }), /vastgehouden/);
  assert.ok(existsSync(p), 'het onleesbare slot staat er nog');
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('een oud leeg slot dat tijdens het stelen alsnog gevuld wordt, wordt teruggezet', () => {
  const p = lockPath();
  writeFileSync(p, '');
  backdate(p, 60);
  const levend = JSON.stringify({ pid: process.pid, startedAt: Date.now() });
  let calls = 0;
  const now = () => {
    if (++calls === 2) writeFileSync(p, levend);
    return Date.now();
  };
  assert.throws(() => acquireLock(p, { now, timeoutMs: 150, sleepMs: 25 }), /vastgehouden door levende/);
  assert.equal(readFileSync(p, 'utf8'), levend, 'het gevulde slot is niet weggegooid');
  rmSync(join(p, '..'), { recursive: true, force: true });
});
