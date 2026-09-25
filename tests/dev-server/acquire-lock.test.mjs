import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, writeFileSync, writeSync, existsSync, readFileSync, renameSync, rmSync,
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

// ── Schrijffout na open('wx') (incident 25-09: schijf vol) ──────────────────
// open('wx') lukte, het schrijven van de houder niet. Het lege slotbestand bleef
// staan, gold als levend en blokkeerde elke worktree tot iemand het met de hand
// weghaalde. Regel: wie het slot aanmaakte en het niet kan vullen, ruimt het op
// en gooit de fout door.
test('echte schrijffout (EFBIG via ulimit -f 0) laat geen leeg slot achter', { skip: process.platform === 'win32' }, () => {
  const p = lockPath();
  // Node negeert SIGXFSZ, dus write() geeft EFBIG, net als ENOSPC bij een volle schijf.
  const child = `
    const { acquireLock } = await import(${JSON.stringify(pathToFileURL(DEV_LOCK).href)});
    try { acquireLock(${JSON.stringify(p)}, { timeoutMs: 0 }); console.log('GEEN-FOUT'); }
    catch (e) { console.log('FOUT ' + e.code); }
  `;
  const r = spawnSync('bash', ['-c', 'ulimit -f 0; exec "$0" --input-type=module -e "$1"', process.execPath, child], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'FOUT EFBIG', 'de schrijffout wordt doorgegooid');
  assert.equal(existsSync(p), false, 'het eigen, lege slot is opgeruimd');
  const release = acquireLock(p, { timeoutMs: 0 }); // vrij: geen 15 s wachten
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
  const write = (fd, buf) => writeSync(fd, buf, 0, 5); // schrijft maar 5 bytes, zonder fout
  assert.throws(() => acquireLock(p, { timeoutMs: 0, write }), /onvolledig/);
  assert.equal(existsSync(p), false);
  rmSync(join(p, '..'), { recursive: true, force: true });
});
test('opruimen na een schrijffout raakt nooit een ANDER slot op hetzelfde pad', () => {
  const p = lockPath();
  const ander = JSON.stringify({ pid: process.pid, startedAt: 42 });
  const write = () => {
    // Race nagebootst: ons lege slot is intussen weg (steler) en een ander proces
    // heeft een vers slot op hetzelfde pad. Dat mag ons opruimen niet wegvegen.
    renameSync(p, `${p}.weg`);
    writeFileSync(p, ander);
    throw Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' });
  };
  assert.throws(() => acquireLock(p, { timeoutMs: 0, write }), { code: 'ENOSPC' });
  assert.equal(readFileSync(p, 'utf8'), ander, 'het slot van de ander staat er nog');
  rmSync(join(p, '..'), { recursive: true, force: true });
});
