# Dev-server dual-guard-preventie — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maak het fysiek onmogelijk dat twee agents/sessies per ongeluk dezelfde dev server bewaken of dat een preview de Vite van een ander worktree toont, door elk worktree één keer collision-vrij een vaste poort toe te wijzen en die overal te lezen i.p.v. te herrekenen.

**Architecture:** Eén gedeelde module (`scripts/dev-port.mjs`) wijst onder een absoluut-verankerde, gedeelde `flock` een poort toe uit het bereik 3007–3106, met `git worktree list` als registry en een eigen `opsDevPort`-markering in `<root>/.claude/launch.json` als bron van waarheid. Een tweede pidfile-slot (`scripts/dev-lock.mjs`) bewaakt per worktree tegen dubbelstart; beide sloten gebruiken een race-veilig `unlink`+`open('wx')`-steal-protocol. Twee launchers (`dev-server.mjs` voor de browser, aangepaste `tauri-dev.mjs` voor desktop) en een SessionStart-bootstrap consumeren dit; `vite.config.ts` is een defensieve lezer.

**Tech Stack:** Node.js ESM (`.mjs`, geen TypeScript in de scripts), Node-core (`fs`/`net`/`child_process`/`crypto`/`os`), `node --test` + `node:assert/strict` voor units, bash voor integratietests. Geen nieuwe dependencies.

**Spec:** [docs/superpowers/specs/2026-07-23-dev-server-dual-guard-prevention-design.md](../specs/2026-07-23-dev-server-dual-guard-prevention-design.md) (v4).

---

## Bestandsstructuur

| Bestand | Verantwoordelijkheid |
|---|---|
| `scripts/dev-port.mjs` (nieuw) | Poort-toewijzing + uitlezen. `worktreeRoot`, `worktreeSlug`, `readRecordedPort`, `chooseFreePort` (puur), `isPortFree`, `allocatePort`, `stampLaunchJson`. **Geen import-tijd-side-effects.** |
| `scripts/dev-lock.mjs` (nieuw) | Atomaire pidfile-sloten. `acquireLock` (race-veilig steal), `withAllocLock` (gedeeld, dode-pid-steal), `acquireGuardLock` (per-worktree, proces-leven). |
| `scripts/dev-server.mjs` (nieuw) | Browser-launcher: alloceer → guard-slot → stempel → spawn `vite`. |
| `scripts/dev-bootstrap.mjs` (nieuw) | Zelf-scopende SessionStart-stamper: alloceer + stempel launch.json. |
| `scripts/tauri-dev.mjs` (wijzig) | `findFreePort()` → `allocatePort()`; guard-slot; `OPS_DEV_GUARDED=1`; `OPS_DEV_INSTANCE` behouden. |
| `vite.config.ts` (wijzig) | Defensieve `readRecordedPort`-fallback i.p.v. kale `\|\| 3007`. |
| `package.json` (wijzig) | `"dev": "node scripts/dev-server.mjs"`. |
| `docs/self-test-harness.md` (wijzig) | 3007-hardcodes (regels 18/39/41/45) → poort uit launch.json/launcher-print. |
| `tests/dev-server/*.test.mjs` (nieuw) | Node-units: `chooseFreePort`, `readRecordedPort`, `acquireLock`-steal, `allocatePort` (gemockt). |
| `tests/dev-server/integration.sh` (nieuw) | Echte-git-integratie: twee worktrees → twee poorten; dubbelstart → weiger; steal-race → één winnaar. |
| `~/.claude/settings.json` (buiten repo, handmatig) | User-global SessionStart-hook. Gedocumenteerd, niet gecommit. |

Constanten: `MIN_PORT = 3007`, `MAX_PORT = 3106`.

---

## Task 1: `chooseFreePort` — pure selectiekern

**Files:**
- Create: `scripts/dev-port.mjs`
- Test: `tests/dev-server/choose-free-port.test.mjs`

- [ ] **Step 1: Schrijf de falende test**

```js
// tests/dev-server/choose-free-port.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseFreePort, MIN_PORT, MAX_PORT } from '../../scripts/dev-port.mjs';

test('kiest MIN_PORT als niets geclaimd of gebonden is', () => {
  assert.equal(chooseFreePort(new Set(), () => false), MIN_PORT);
});

test('slaat geclaimde poorten over', () => {
  assert.equal(chooseFreePort(new Set([3007, 3008]), () => false), 3009);
});

test('slaat gebonden poorten over', () => {
  assert.equal(chooseFreePort(new Set(), (p) => p === 3007), 3008);
});

test('combineert geclaimd én gebonden', () => {
  assert.equal(chooseFreePort(new Set([3007]), (p) => p === 3008), 3009);
});

test('gooit als het hele bereik vol is', () => {
  const full = new Set();
  for (let p = MIN_PORT; p <= MAX_PORT; p++) full.add(p);
  assert.throws(() => chooseFreePort(full, () => false), /Geen vrije/);
});
```

- [ ] **Step 2: Draai de test, verifieer dat hij faalt**

Run: `node --test tests/dev-server/choose-free-port.test.mjs`
Expected: FAIL — `does not provide an export named 'chooseFreePort'`.

- [ ] **Step 3: Schrijf de minimale implementatie**

```js
// scripts/dev-port.mjs
export const MIN_PORT = 3007;
export const MAX_PORT = 3106;

/**
 * Laagste poort in [MIN_PORT, MAX_PORT] die noch geclaimd noch gebonden is.
 * Puur: `claimed` is een Set<number>, `isBound` een predicaat (port) => boolean.
 */
export function chooseFreePort(claimed, isBound) {
  for (let port = MIN_PORT; port <= MAX_PORT; port++) {
    if (!claimed.has(port) && !isBound(port)) return port;
  }
  throw new Error(`Geen vrije dev-poort in ${MIN_PORT}-${MAX_PORT}`);
}
```

- [ ] **Step 4: Draai de test, verifieer dat hij slaagt**

Run: `node --test tests/dev-server/choose-free-port.test.mjs`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/dev-port.mjs tests/dev-server/choose-free-port.test.mjs
git commit -m "feat(dev-port): pure chooseFreePort selectiekern (dual-guard T1)"
```

---

## Task 2: `readRecordedPort` — opsDevPort-markering, defensief

**Files:**
- Modify: `scripts/dev-port.mjs`
- Test: `tests/dev-server/read-recorded-port.test.mjs`

- [ ] **Step 1: Schrijf de falende test**

```js
// tests/dev-server/read-recorded-port.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRecordedPort } from '../../scripts/dev-port.mjs';

function fixture(launchJson) {
  const root = mkdtempSync(join(tmpdir(), 'ops-rrp-'));
  mkdirSync(join(root, '.claude'));
  if (launchJson !== undefined) {
    writeFileSync(join(root, '.claude', 'launch.json'), launchJson);
  }
  return root;
}

test('leest opsDevPort als geldig getal in bereik', () => {
  const root = fixture(JSON.stringify({ opsDevPort: 3042, configurations: [] }));
  assert.equal(readRecordedPort(root), 3042);
  rmSync(root, { recursive: true, force: true });
});

test('negeert het configurations[].port-veld (template-3007) zonder opsDevPort', () => {
  const root = fixture(JSON.stringify({ configurations: [{ name: 'dev', port: 3007 }] }));
  assert.equal(readRecordedPort(root), null);
  rmSync(root, { recursive: true, force: true });
});

test('ontbrekend bestand → null (gooit niet)', () => {
  const root = fixture(undefined);
  assert.equal(readRecordedPort(root), null);
  rmSync(root, { recursive: true, force: true });
});

test('kapotte JSON → null (gooit niet)', () => {
  const root = fixture('{ niet-json');
  assert.equal(readRecordedPort(root), null);
  rmSync(root, { recursive: true, force: true });
});

test('opsDevPort buiten bereik → null', () => {
  const root = fixture(JSON.stringify({ opsDevPort: 9999 }));
  assert.equal(readRecordedPort(root), null);
  rmSync(root, { recursive: true, force: true });
});

test('root === null → null', () => {
  assert.equal(readRecordedPort(null), null);
});
```

- [ ] **Step 2: Draai de test, verifieer dat hij faalt**

Run: `node --test tests/dev-server/read-recorded-port.test.mjs`
Expected: FAIL — `does not provide an export named 'readRecordedPort'`.

- [ ] **Step 3: Voeg de implementatie toe aan `scripts/dev-port.mjs`**

Voeg bovenaan toe (imports) en de functie:

```js
import { readFileSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
```

```js
/** De opsDevPort-markering uit <root>/.claude/launch.json, of null. Gooit nooit. */
export function readRecordedPort(root, readFile = readFileSync) {
  if (!root) return null;
  try {
    const json = JSON.parse(readFile(join(root, '.claude', 'launch.json'), 'utf8'));
    const p = json?.opsDevPort;
    return Number.isInteger(p) && p >= MIN_PORT && p <= MAX_PORT ? p : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Draai de test, verifieer dat hij slaagt**

Run: `node --test tests/dev-server/read-recorded-port.test.mjs`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/dev-port.mjs tests/dev-server/read-recorded-port.test.mjs
git commit -m "feat(dev-port): readRecordedPort keyt op opsDevPort, defensief (dual-guard T2)"
```

---

## Task 3: `worktreeRoot`/`worktreeSlug`/`isPortFree` — omgevingshelpers

**Files:**
- Modify: `scripts/dev-port.mjs`
- Test: `tests/dev-server/worktree-root.test.mjs`

- [ ] **Step 1: Schrijf de falende test**

```js
// tests/dev-server/worktree-root.test.mjs
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
```

- [ ] **Step 2: Draai de test, verifieer dat hij faalt**

Run: `node --test tests/dev-server/worktree-root.test.mjs`
Expected: FAIL — ontbrekende exports.

- [ ] **Step 3: Voeg de implementaties toe aan `scripts/dev-port.mjs`**

```js
/** Absolute, symlink-resolved worktree-root, of null buiten een git-worktree. */
export function worktreeRoot(cwd = process.cwd()) {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return top ? realpathSync(top) : null;
  } catch {
    return null;
  }
}

export function worktreeSlug(root) {
  return root ? basename(root) : 'unknown';
}

/** Resolvet true als `port` op 127.0.0.1 gebonden kan worden. */
export function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}
```

- [ ] **Step 4: Draai de test, verifieer dat hij slaagt**

Run: `node --test tests/dev-server/worktree-root.test.mjs`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/dev-port.mjs tests/dev-server/worktree-root.test.mjs
git commit -m "feat(dev-port): worktreeRoot (realpath, defensief) + isPortFree (dual-guard T3)"
```

---

## Task 4: `acquireLock` — race-veilig pidfile-slot met steal

**Files:**
- Create: `scripts/dev-lock.mjs`
- Test: `tests/dev-server/acquire-lock.test.mjs`

- [ ] **Step 1: Schrijf de falende test**

```js
// tests/dev-server/acquire-lock.test.mjs
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
```

- [ ] **Step 2: Draai de test, verifieer dat hij faalt**

Run: `node --test tests/dev-server/acquire-lock.test.mjs`
Expected: FAIL — module `scripts/dev-lock.mjs` bestaat niet.

- [ ] **Step 3: Schrijf `scripts/dev-lock.mjs`**

> **Correctie tijdens uitvoering:** een naïeve `unlink`+`open('wx')`-steal bleek NIET
> race-veilig (eigen 8-stelers-stresstest gaf meerdere winnaars: een steler unlinkt de
> verse lock van een winnaar). De steal claimt de stale inode nu atomair via `rename`,
> verifieert `sameHolder`, en herstelt bij een refresh-race via `link` (nooit
> overschrijven). Single-winner voor realistische gelijktijdigheid; de harde
> garantie tegen twee-servers-één-poort is `strictPort` (kernel-bind). De
> deterministische verse-acquire-mutex is getest in `tests/dev-server/lock-mutex.sh`.

```js
// scripts/dev-lock.mjs
import { openSync, writeSync, closeSync, readFileSync, unlinkSync, renameSync, linkSync } from 'node:fs';

let stealSeq = 0;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code === 'EPERM'; } // bestaat wel, maar geen permissie
}

function readHolder(lockPath) {
  try {
    const raw = readFileSync(lockPath, 'utf8');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function sameHolder(a, b) {
  return Boolean(a && b && a.pid === b.pid && a.startedAt === b.startedAt);
}

/**
 * Atomair pidfile-slot. Returnt release(); throwt bij timeout met een levende houder.
 * Verse claim = open('wx') (O_EXCL, één winnaar). Steal van een verweesd slot is
 * race-veilig via rename-claim + sameHolder-verify + link-herstel (nooit overschrijven).
 * Een leeg/half-geschreven slot (null holder) geldt als levend → niet stelen.
 */
export function acquireLock(lockPath, opts = {}) {
  const {
    allowAgeSteal = false, ageMs = 60000,
    timeoutMs = 15000, sleepMs = 50,
    extra = {}, now = Date.now,
  } = opts;
  const deadline = now() + timeoutMs;
  for (;;) {
    try {
      const fd = openSync(lockPath, 'wx'); // O_EXCL — de mutex
      writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: now(), ...extra }));
      closeSync(fd);
      return () => { try { unlinkSync(lockPath); } catch { /* al weg */ } };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const h = readHolder(lockPath); // null → behandel als levend
      const dead = h && typeof h.pid === 'number' && !pidAlive(h.pid);
      const aged = allowAgeSteal && h && typeof h.startedAt === 'number' && (now() - h.startedAt) > ageMs;
      if (dead || aged) {
        const mine = `${lockPath}.steal.${process.pid}.${stealSeq++}`;
        try {
          renameSync(lockPath, mine); // atomair; slechts één steler verplaatst de inode
        } catch (e2) {
          if (e2.code === 'ENOENT') continue; // andere steler/creator was ons voor
          throw e2;
        }
        const grabbed = readHolder(mine);
        if (sameHolder(grabbed, h)) {
          try { unlinkSync(mine); } catch { /* al weg */ }
        } else {
          // Refresh-race: we grepen een ánder (mogelijk levend) slot → zet terug
          // zonder een vers-gemaakt slot te overschrijven (link faalt op EEXIST).
          try { linkSync(mine, lockPath); } catch { /* al opnieuw geclaimd */ }
          try { unlinkSync(mine); } catch { /* al weg */ }
        }
        continue; // her-lus: open('wx') kiest één winnaar
      }
      if (now() >= deadline) {
        throw new Error(`lock ${lockPath} vastgehouden door levende PID ${h?.pid ?? 'onbekend'} > ${timeoutMs}ms — afgebroken`);
      }
      sleepSync(sleepMs);
    }
  }
}
```

- [ ] **Step 4: Draai de test, verifieer dat hij slaagt**

Run: `node --test tests/dev-server/acquire-lock.test.mjs`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/dev-lock.mjs tests/dev-server/acquire-lock.test.mjs
git commit -m "feat(dev-lock): race-veilig acquireLock met unlink+O_EXCL-steal (dual-guard T4)"
```

---

## Task 5: `withAllocLock` + `acquireGuardLock` — de twee slot-varianten

**Files:**
- Modify: `scripts/dev-lock.mjs`
- Test: `tests/dev-server/lock-variants.test.mjs`

- [ ] **Step 1: Schrijf de falende test**

```js
// tests/dev-server/lock-variants.test.mjs
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
```

- [ ] **Step 2: Draai de test, verifieer dat hij faalt**

Run: `node --test tests/dev-server/lock-variants.test.mjs`
Expected: FAIL — ontbrekende exports `withAllocLock`/`acquireGuardLock`/`allocLockPath`.

- [ ] **Step 3: Voeg toe aan `scripts/dev-lock.mjs`**

Voeg imports en functies toe:

```js
import { execFileSync } from 'node:child_process';
import { resolve, join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
```

```js
/** Absoluut verankerd pad naar de gedeelde toewijzings-flock. */
export function allocLockPath(root) {
  const gcd = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  return join(resolve(root, gcd), 'ops-dev-alloc.lock');
}

/**
 * Serialiseert poort-toewijzing over alle worktrees. Kort vastgehouden.
 * allowAgeSteal=false: nooit een trage-maar-levende allocator bestelen.
 */
export async function withAllocLock(root, fn) {
  const release = acquireLock(allocLockPath(root), { allowAgeSteal: false, timeoutMs: 15000 });
  try { return await fn(); }
  finally { release(); }
}

/** Per-worktree runtime-slot voor proces-leven. No-op onder OPS_DEV_GUARDED. */
export function acquireGuardLock(root, port) {
  if (process.env.OPS_DEV_GUARDED) return () => {};
  const key = createHash('sha1').update(root).digest('hex').slice(0, 16);
  const lockPath = join(tmpdir(), `ops-dev-guard-${key}.lock`);
  try {
    return acquireLock(lockPath, {
      allowAgeSteal: true, ageMs: 24 * 3600 * 1000,
      timeoutMs: 0, extra: { port, root },
    });
  } catch {
    const h = readHolder(lockPath);
    throw new Error(
      `dev server voor "${basename(root)}" draait al (PID ${h?.pid ?? '?'}, poort ${h?.port ?? '?'}) — tweede bewaker geweigerd`,
    );
  }
}
```

> Maak `readHolder` exporteerbaar/bereikbaar voor `acquireGuardLock` (verplaats 'm boven de functies of laat 'm module-privé maar in hetzelfde bestand staan — hij bestaat al uit Task 4). `timeoutMs: 0` betekent: bij een levende houder throwt `acquireLock` na de eerste mislukte poging → precies de "weiger direct"-semantiek.

- [ ] **Step 4: Draai de test, verifieer dat hij slaagt**

Run: `node --test tests/dev-server/lock-variants.test.mjs`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/dev-lock.mjs tests/dev-server/lock-variants.test.mjs
git commit -m "feat(dev-lock): withAllocLock (absoluut verankerd) + acquireGuardLock (dual-guard T5)"
```

---

## Task 6: `allocatePort` + `stampLaunchJson` — de toewijzer

**Files:**
- Modify: `scripts/dev-port.mjs`
- Test: `tests/dev-server/allocate-port.test.mjs`

- [ ] **Step 1: Schrijf de falende test** (met dependency-injectie, geen echte git/poorten)

```js
// tests/dev-server/allocate-port.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allocatePort } from '../../scripts/dev-port.mjs';

function wt(name) {
  const root = join(mkdtempSync(join(tmpdir(), 'ops-alloc-')), name);
  mkdirSync(join(root, '.claude'), { recursive: true });
  return root;
}

function deps({ paths }) {
  return {
    listPaths: () => paths,
    portFree: async () => true,      // niets gebonden
    lock: async (_root, fn) => fn(), // geen echte flock
  };
}

test('idempotent: bestaande opsDevPort wordt teruggegeven zonder toewijzen', async () => {
  const root = wt('a');
  writeFileSync(join(root, '.claude', 'launch.json'), JSON.stringify({ opsDevPort: 3050 }));
  assert.equal(await allocatePort(root, deps({ paths: [root] })), 3050);
  rmSync(join(root, '..'), { recursive: true, force: true });
});

test('kiest de laagste vrije poort en legt opsDevPort + configurations[dev].port vast', async () => {
  const root = wt('b');
  assert.equal(await allocatePort(root, deps({ paths: [root] })), 3007);
  const json = JSON.parse(readFileSync(join(root, '.claude', 'launch.json'), 'utf8'));
  assert.equal(json.opsDevPort, 3007);
  assert.equal(json.configurations.find((c) => c.name === 'dev').port, 3007);
  rmSync(join(root, '..'), { recursive: true, force: true });
});

test('vermijdt poorten die al door een sibling-worktree geclaimd zijn', async () => {
  const me = wt('me');
  const sib = wt('sib');
  writeFileSync(join(sib, '.claude', 'launch.json'), JSON.stringify({ opsDevPort: 3007 }));
  assert.equal(await allocatePort(me, deps({ paths: [me, sib] })), 3008);
  rmSync(join(me, '..'), { recursive: true, force: true });
  rmSync(join(sib, '..'), { recursive: true, force: true });
});

test('behoudt een bestaande preview-configuratie bij het stempelen', async () => {
  const root = wt('c');
  writeFileSync(join(root, '.claude', 'launch.json'), JSON.stringify({
    version: '0.0.1',
    configurations: [
      { name: 'dev', runtimeExecutable: 'npm', runtimeArgs: ['run', 'dev'], port: 3007 },
      { name: 'preview', runtimeExecutable: 'npm', runtimeArgs: ['run', 'preview'], port: 4173 },
    ],
  }));
  await allocatePort(root, deps({ paths: [root] }));
  const json = JSON.parse(readFileSync(join(root, '.claude', 'launch.json'), 'utf8'));
  const prev = json.configurations.find((c) => c.name === 'preview');
  assert.ok(prev);
  assert.equal(prev.port, 4173);
  rmSync(join(root, '..'), { recursive: true, force: true });
});
```

- [ ] **Step 2: Draai de test, verifieer dat hij faalt**

Run: `node --test tests/dev-server/allocate-port.test.mjs`
Expected: FAIL — `does not provide an export named 'allocatePort'`.

- [ ] **Step 3: Voeg `stampLaunchJson` + `allocatePort` toe aan `scripts/dev-port.mjs`**

Extra imports:

```js
import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { withAllocLock } from './dev-lock.mjs';
```

```js
function defaultLaunchJson() {
  return {
    version: '0.0.1',
    configurations: [
      { name: 'dev', runtimeExecutable: 'npm', runtimeArgs: ['run', 'dev'], port: MIN_PORT },
      { name: 'preview', runtimeExecutable: 'npm', runtimeArgs: ['run', 'preview'], port: 4173 },
    ],
  };
}

/** Schrijf opsDevPort (bron van waarheid) + configurations[dev].port (voor preview_start), atomair. */
export function stampLaunchJson(root, port) {
  const file = join(root, '.claude', 'launch.json');
  let json;
  try { json = JSON.parse(readFileSync(file, 'utf8')); }
  catch { json = defaultLaunchJson(); }
  if (!json || typeof json !== 'object') json = defaultLaunchJson();
  json.opsDevPort = port;
  json.configurations = Array.isArray(json.configurations) ? json.configurations : [];
  const dev = json.configurations.find((c) => c && c.name === 'dev');
  if (dev) dev.port = port;
  else json.configurations.unshift({ name: 'dev', runtimeExecutable: 'npm', runtimeArgs: ['run', 'dev'], port });
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(json, null, 2)}\n`);
  renameSync(tmp, file);
}

function listWorktreePaths(root) {
  const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  });
  return out.split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length).trim());
}

/**
 * Wijst dit worktree één keer een unieke poort toe en legt 'm vast. Idempotent.
 * deps injecteerbaar voor tests: { recorded, listPaths, portFree, stamp, lock }.
 */
export async function allocatePort(root, deps = {}) {
  const {
    recorded = readRecordedPort,
    listPaths = listWorktreePaths,
    portFree = isPortFree,
    stamp = stampLaunchJson,
    lock = withAllocLock,
  } = deps;

  const existing = recorded(root);
  if (existing != null) return existing;

  return lock(root, async () => {
    const again = recorded(root); // her-check binnen de flock
    if (again != null) return again;

    const claimed = new Set();
    for (const p of listPaths(root)) {
      const port = recorded(p);
      if (port != null) claimed.add(port);
    }
    const bound = new Set();
    for (let p = MIN_PORT; p <= MAX_PORT; p++) {
      if (!claimed.has(p) && !(await portFree(p))) bound.add(p);
    }
    const port = chooseFreePort(claimed, (p) => bound.has(p));
    stamp(root, port);
    return port;
  });
}
```

- [ ] **Step 4: Draai alle dev-port-tests, verifieer dat ze slagen**

Run: `node --test tests/dev-server/*.test.mjs`
Expected: PASS — alle units (T1-T6) groen.

- [ ] **Step 5: Commit**

```bash
git add scripts/dev-port.mjs tests/dev-server/allocate-port.test.mjs
git commit -m "feat(dev-port): allocatePort + stampLaunchJson (opsDevPort, idempotent) (dual-guard T6)"
```

---

## Task 7: `dev-server.mjs` — browser-launcher + `package.json`

**Files:**
- Create: `scripts/dev-server.mjs`
- Modify: `package.json:7` (`"dev"`)
- Test: `tests/dev-server/integration.sh` (deel 1)

- [ ] **Step 1: Schrijf het integratie-testscript (faalt tot de launcher bestaat)**

```bash
# tests/dev-server/integration.sh
#!/usr/bin/env bash
set -uo pipefail
ROOT_REPO="$(cd "$(dirname "$0")/../.." && pwd)"
fail() { echo "XX FAIL: $1"; exit 1; }
pass() { echo "OK: $1"; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git init -q "$TMP/main"
( cd "$TMP/main" && git commit -q --allow-empty -m init )
mkdir -p "$TMP/main/scripts"
cp "$ROOT_REPO"/scripts/dev-port.mjs "$ROOT_REPO"/scripts/dev-lock.mjs "$ROOT_REPO"/scripts/dev-server.mjs "$TMP/main/scripts/"

# Deel 1: --print-plan alloceert + claimt slot + print poort, zonder vite te spawnen
node "$TMP/main/scripts/dev-server.mjs" --print-plan >"$TMP/p1.txt" 2>&1 || fail "dev-server --print-plan gaf een fout: $(cat "$TMP/p1.txt")"
grep -q "worktree" "$TMP/p1.txt" || fail "dev-server --print-plan printte geen worktree/poort-plan"
pass "dev-server --print-plan werkt en kiest een poort"

echo "TOTAAL: dev-server integratie deel 1 groen"
```

> `--print-plan` laat de launcher alloceren + het slot claimen + de gekozen poort printen zónder `vite` te spawnen — zo blijft de test headless en snel.

- [ ] **Step 2: Draai het script, verifieer dat het faalt**

Run: `bash tests/dev-server/integration.sh`
Expected: FAIL — `dev-server.mjs` bestaat nog niet (cp faalt / node-fout).

- [ ] **Step 3: Schrijf `scripts/dev-server.mjs`**

```js
#!/usr/bin/env node
// Browser-dev-launcher: wijst deze worktree een vaste poort toe, bewaakt tegen
// dubbelstart, stempelt launch.json, en spawnt vite op die poort.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { worktreeRoot, worktreeSlug, allocatePort } from './dev-port.mjs';
import { acquireGuardLock } from './dev-lock.mjs';

const printOnly = process.argv.includes('--print-plan');

const root = worktreeRoot();
if (!root) {
  console.error('Niet in een git-worktree — kan geen dev-poort toewijzen.');
  process.exit(1);
}
const slug = worktreeSlug(root);

// Geneste start onder tauri-dev: die heeft al toegewezen + het slot geclaimd.
const guarded = Boolean(process.env.OPS_DEV_GUARDED);
const port = guarded ? Number(process.env.OPS_DEV_PORT) : await allocatePort(root);

let releaseGuard = () => {};
if (!guarded) {
  try {
    releaseGuard = acquireGuardLock(root, port);
  } catch (e) {
    console.error(`\n  ✋ ${e.message}\n`);
    process.exit(1);
  }
}

console.log(`\n  ▶ open-planner-studio dev — worktree "${slug}" → http://localhost:${port}/\n`);

if (printOnly) {
  releaseGuard();
  process.exit(0);
}

const binName = process.platform === 'win32' ? 'vite.cmd' : 'vite';
const localBin = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.bin', binName);
const viteBin = existsSync(localBin) ? localBin : binName;

const child = spawn(viteBin, [], {
  stdio: 'inherit',
  env: { ...process.env, OPS_DEV_PORT: String(port) },
});

const cleanup = () => releaseGuard();
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });
child.on('exit', (code) => { cleanup(); process.exit(code ?? 0); });
child.on('error', (err) => { cleanup(); console.error('Vite starten mislukte:', err.message); process.exit(1); });
```

- [ ] **Step 4: Wijzig `package.json` regel 7**

Van `"dev": "vite",` naar `"dev": "node scripts/dev-server.mjs",`.

- [ ] **Step 5: Draai het integratiescript, verifieer dat het slaagt**

Run: `bash tests/dev-server/integration.sh`
Expected: PASS — `TOTAAL: dev-server integratie deel 1 groen`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/dev-server.mjs package.json tests/dev-server/integration.sh
git commit -m "feat(dev-server): browser-launcher met poort-toewijzing + guard-slot (dual-guard T7)"
```

---

## Task 8: Integratie — twee worktrees, dubbelstart, steal-race

**Files:**
- Modify: `tests/dev-server/integration.sh`

- [ ] **Step 1: Breid `integration.sh` uit** (voeg vóór de laatste `echo "TOTAAL..."` toe)

```bash
# Deel 2: twee worktrees → twee VERSCHILLENDE poorten
git -C "$TMP/main" worktree add -q "$TMP/wt-a" -b wt-a
git -C "$TMP/main" worktree add -q "$TMP/wt-b" -b wt-b
for w in wt-a wt-b; do mkdir -p "$TMP/$w/scripts"; cp "$TMP/main/scripts/"*.mjs "$TMP/$w/scripts/"; done
PA=$(node "$TMP/wt-a/scripts/dev-server.mjs" --print-plan 2>&1 | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
PB=$(node "$TMP/wt-b/scripts/dev-server.mjs" --print-plan 2>&1 | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
[ -n "$PA" ] && [ -n "$PB" ] || fail "kon poorten niet uitlezen (A=$PA B=$PB)"
[ "$PA" != "$PB" ] || fail "twee worktrees kregen dezelfde poort ($PA)"
pass "twee worktrees → twee poorten (A=$PA, B=$PB)"

PA2=$(node "$TMP/wt-a/scripts/dev-server.mjs" --print-plan 2>&1 | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
[ "$PA" = "$PA2" ] || fail "wt-a poort niet stabiel ($PA vs $PA2)"
pass "toewijzing is idempotent (wt-a blijft $PA)"

# Deel 3: dubbelstart-weigering (levend guard-slot → tweede claim gooit)
node -e '
import("'"$TMP"'/wt-a/scripts/dev-lock.mjs").then(async (m) => {
  const p = await import("'"$TMP"'/wt-a/scripts/dev-port.mjs");
  const root = p.worktreeRoot("'"$TMP"'/wt-a");
  const rel = m.acquireGuardLock(root, 3099);
  try { m.acquireGuardLock(root, 3099); console.log("GEEN-WEIGERING"); process.exit(2); }
  catch { console.log("WEIGERING-OK"); rel(); process.exit(0); }
});
' >"$TMP/dbl.txt" 2>&1
grep -q "WEIGERING-OK" "$TMP/dbl.txt" || fail "tweede bewaker werd niet geweigerd: $(cat "$TMP/dbl.txt")"
pass "dubbelstart in hetzelfde worktree wordt geweigerd"

# Deel 4: steal-race — twee processen stelen tegelijk een verweesd slot → één winnaar
LOCK="$TMP/steal.lock"
printf '{"pid":2147483646,"startedAt":1}' > "$LOCK"
node -e 'import("'"$TMP"'/wt-a/scripts/dev-lock.mjs").then(m=>{try{const r=m.acquireLock("'"$LOCK"'",{timeoutMs:800});console.log("WIN");setTimeout(()=>r(),300);}catch{console.log("LOSE");}})' >"$TMP/s1.txt" 2>&1 &
node -e 'import("'"$TMP"'/wt-a/scripts/dev-lock.mjs").then(m=>{try{const r=m.acquireLock("'"$LOCK"'",{timeoutMs:800});console.log("WIN");setTimeout(()=>r(),300);}catch{console.log("LOSE");}})' >"$TMP/s2.txt" 2>&1 &
wait
WINS=$(cat "$TMP/s1.txt" "$TMP/s2.txt" | grep -c WIN)
[ "$WINS" = "1" ] || fail "steal-race: verwachtte 1 winnaar, kreeg $WINS ($(cat "$TMP/s1.txt" "$TMP/s2.txt" | tr '\n' ' '))"
pass "steal-race: precies één winnaar"
```

- [ ] **Step 2: Draai het volledige script, verifieer dat het slaagt**

Run: `bash tests/dev-server/integration.sh; echo "exit=$?"`
Expected: alle `OK:`-regels, geen `XX FAIL`, `exit=0`.

- [ ] **Step 3: Commit**

```bash
git add tests/dev-server/integration.sh
git commit -m "test(dev-server): twee-worktrees, dubbelstart-weigering, steal-race (dual-guard T8)"
```

---

## Task 9: `tauri-dev.mjs` — gebruik de toewijzer, claim het slot, zet de vlag

**Files:**
- Modify: `scripts/tauri-dev.mjs`

- [ ] **Step 1: Vervang de inhoud van `scripts/tauri-dev.mjs`**

```js
#!/usr/bin/env node
/**
 * Dev launcher voor de Tauri-desktopbuild.
 *
 * Wijst deze worktree dezelfde vaste poort toe als de browser-dev (via
 * scripts/dev-port.mjs, gedeelde flock + git worktree list), claimt het
 * runtime-bewakingsslot, en start `tauri dev` met een matchende --config devUrl.
 * OPS_DEV_GUARDED=1 zorgt dat de geneste `npm run dev` (Tauri's beforeDevCommand)
 * niet nóg een keer alloceert of het slot claimt — dat zou deadlocken.
 * OPS_DEV_INSTANCE isoleert de recovery-auto-save per worktree (zie src/App.tsx).
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { worktreeRoot, worktreeSlug, allocatePort } from './dev-port.mjs';
import { acquireGuardLock } from './dev-lock.mjs';

const root = worktreeRoot();
if (!root) {
  console.error('Niet in een git-worktree — kan geen dev-poort toewijzen.');
  process.exit(1);
}
const instance = worktreeSlug(root);
const port = await allocatePort(root);

let releaseGuard;
try {
  releaseGuard = acquireGuardLock(root, port);
} catch (e) {
  console.error(`\n  ✋ ${e.message}\n`);
  process.exit(1);
}

console.log(`\n  ▶ open-planner-studio dev — worktree "${instance}" → http://localhost:${port}/\n`);

const binName = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
const localBin = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.bin', binName);
const tauriBin = existsSync(localBin) ? localBin : binName;
const config = JSON.stringify({ build: { devUrl: `http://localhost:${port}` } });

const child = spawn(tauriBin, ['dev', '--config', config], {
  stdio: 'inherit',
  env: {
    ...process.env,
    OPS_DEV_PORT: String(port),
    OPS_DEV_INSTANCE: instance,
    OPS_DEV_GUARDED: '1',
  },
});

const cleanup = () => releaseGuard?.();
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });
child.on('exit', (code) => { cleanup(); process.exit(code ?? 0); });
child.on('error', (err) => { cleanup(); console.error('Tauri starten mislukte:', err.message); process.exit(1); });
```

- [ ] **Step 2: Statische controle**

Run: `node --check scripts/tauri-dev.mjs`
Expected: geen syntaxfout (exit 0).

- [ ] **Step 3: Handmatige Tauri-verificatie (de laatste [VERMOED] uit de spec)**

> Vereist een echte desktop-run; kan niet headless. Voer uit vóór je de feature "af" noemt.

Voeg tijdelijk in `scripts/dev-server.mjs` na de imports toe:
`if (process.env.OPS_DEV_GUARDED) console.error('[nested] OPS_DEV_GUARDED=%s OPS_DEV_PORT=%s', process.env.OPS_DEV_GUARDED, process.env.OPS_DEV_PORT);`

Run: `npm run tauri:dev`
Expected: in de output verschijnt `[nested] OPS_DEV_GUARDED=1 OPS_DEV_PORT=<poort>`, het venster laadt de Vite (geen deadlock/leeg venster), geen "tweede bewaker geweigerd". Verwijder de debug-print daarna.

- [ ] **Step 4: Commit**

```bash
git add scripts/tauri-dev.mjs
git commit -m "refactor(tauri-dev): allocatePort + guard-slot + OPS_DEV_GUARDED, behoud OPS_DEV_INSTANCE (dual-guard T9)"
```

---

## Task 10: `vite.config.ts` — defensieve lezer

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Bekijk de huidige regels 18-26**

Run: `sed -n '1,6p;18,26p' vite.config.ts`
Expected: je ziet de imports bovenaan en `port: Number(process.env.OPS_DEV_PORT) || 3007,` met `strictPort: true`.

- [ ] **Step 2: Voeg de import toe en vervang de poort-regel**

Bij de imports bovenaan:
```ts
// @ts-expect-error — dev-port.mjs is plain JS zonder types
import { worktreeRoot, readRecordedPort } from './scripts/dev-port.mjs';
```

Vervang `port: Number(process.env.OPS_DEV_PORT) || 3007,` door:
```ts
    // Poort: launcher zet OPS_DEV_PORT; anders de vastgelegde opsDevPort van dit
    // worktree; anders 3007. readRecordedPort/worktreeRoot gooien nooit (CI: vite
    // build in een .claude-loze checkout). strictPort maakt een clash luid.
    port: Number(process.env.OPS_DEV_PORT) || readRecordedPort(worktreeRoot()) || 3007,
```

- [ ] **Step 3: Verifieer dat `dev-port.mjs` geen import-tijd git-crash geeft**

Run: `node --input-type=module -e "import('./scripts/dev-port.mjs').then(m=>console.log('port=', m.readRecordedPort(m.worktreeRoot())))"`
Expected: print `port= <getal>` of `port= null`, gooit niet.

- [ ] **Step 4: Volledige typecheck/build**

Run: `npm run build`
Expected: `tsc && vite build` slaagt. Als `tsc` alsnog over de `.mjs`-import klaagt, voeg een `scripts/dev-port.d.ts` toe met de gebruikte signaturen:
```ts
export function worktreeRoot(cwd?: string): string | null;
export function readRecordedPort(root: string | null): number | null;
```

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts scripts/dev-port.d.ts 2>/dev/null; git add -A
git commit -m "feat(vite): defensieve readRecordedPort-fallback i.p.v. kale 3007 (dual-guard T10)"
```

---

## Task 11: `dev-bootstrap.mjs` + hook-documentatie

**Files:**
- Create: `scripts/dev-bootstrap.mjs`
- Modify: `docs/self-test-harness.md`

- [ ] **Step 1: Bevestig de package-naam**

Run: `node -e "console.log(require('./package.json').name)"`
Expected: een naam (bijv. `open-planner-studio`). Gebruik die exact in Step 2.

- [ ] **Step 2: Schrijf `scripts/dev-bootstrap.mjs`** (vervang `open-planner-studio` door de naam uit Step 1 als die afwijkt)

```js
#!/usr/bin/env node
// SessionStart-bootstrap: stempelt dit worktree z'n vaste dev-poort in
// .claude/launch.json zodat preview_start meteen de juiste worktree opent.
// Zelf-scopend: doet niets buiten deze app. Idempotent. Faalt zacht.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

try {
  const root = process.cwd();
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'open-planner-studio') process.exit(0); // ander project → no-op
  const { worktreeRoot, allocatePort } = await import(join(root, 'scripts', 'dev-port.mjs'));
  const wt = worktreeRoot(root);
  if (!wt) process.exit(0);
  const port = await allocatePort(wt);
  console.error(`[ops dev-bootstrap] worktree "${wt.split('/').pop()}" → poort ${port}`);
} catch (e) {
  console.error(`[ops dev-bootstrap] overgeslagen: ${e.message}`);
  process.exit(0); // ergonomie, geen correctheidsvereiste — nooit de sessie blokkeren
}
```

- [ ] **Step 3: Test dat de bootstrap zelf-scopet, idempotent is en niet gooit**

Run: `node scripts/dev-bootstrap.mjs; echo "exit=$?"; node scripts/dev-bootstrap.mjs; echo "exit=$?"`
Expected: twee keer `exit=0` met een `[ops dev-bootstrap] worktree "…" → poort <n>`-regel, tweede keer dezelfde poort.

- [ ] **Step 4: Werk `docs/self-test-harness.md` bij**

Vervang de 3007-hardcodes (regels ~18/39/41/45):
- Regel 18: `... op \`http://localhost:3007\`` → `... op de aan dit worktree toegewezen poort (zie de \`▶\`-print van \`npm run dev\` of \`.claude/launch.json\` → \`opsDevPort\`)`.
- Regel 39: `npm run dev      # Vite op http://localhost:3007` → `npm run dev      # Vite op de toegewezen poort (zie de ▶-print)`.
- Regel 41: de "Draait er al een Vite op 3007"-noot → `Elk worktree krijgt via scripts/dev-port.mjs een eigen vaste poort; een tweede start in hetzelfde worktree wordt bewust geweigerd.`
- Regel 45: `browser_navigate → http://localhost:3007` → `browser_navigate → http://localhost:<toegewezen poort> (lees 'm uit .claude/launch.json → opsDevPort of de ▶-print)`.

Voeg een sectie toe (h3, geen tabellen/blockquotes i.v.m. `verify:docs`):

```markdown
### Automatische poort-sync (dual-guard)

Installeer eenmalig een user-global SessionStart-hook zodat `preview_start` altijd
de juiste worktree-poort opent (buiten de repo, want `.claude/` is gitignored). In
`~/.claude/settings.json`:

    { "hooks": { "SessionStart": [
        { "hooks": [ { "type": "command", "command": "node scripts/dev-bootstrap.mjs || true" } ] }
    ] } }

De hook her-stempelt `.claude/launch.json` bij sessiestart. Hij is ergonomie, geen
correctheidsvereiste: de harde garantie tegen "verkeerde build" zit in de
vastgelegde `opsDevPort` + de launcher.
```

- [ ] **Step 5: Verifieer de docs-check**

Run: `npm run verify:docs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/dev-bootstrap.mjs docs/self-test-harness.md
git commit -m "feat(dev-bootstrap): zelf-scopende launch.json-stamper + hook-docs (dual-guard T11)"
```

---

## Task 12: Volledige suite-run + eindverificatie

**Files:** geen (verificatie)

- [ ] **Step 1: Alle nieuwe units groen**

Run: `node --test tests/dev-server/*.test.mjs`
Expected: alle tests PASS.

- [ ] **Step 2: Integratie groen, exit 0, geen XX**

Run: `bash tests/dev-server/integration.sh; echo "exit=$?"`
Expected: `exit=0`, geen `XX`-regel.

- [ ] **Step 3: CPM-suite niet geraakt (regressie-poort)**

Run: `bash tests/planning/run.sh; echo "exit=$?"; bash tests/planning/run.sh 2>&1 | grep "^XX" || echo "geen XX"`
Expected: `exit=0` en `geen XX`. (Faalt `run.sh` op esbuild-127 in dit worktree: symlink de parent-esbuild erin — zie het projectgeheugen — en draai opnieuw.)

- [ ] **Step 4: Build groen**

Run: `npm run build`
Expected: `tsc && vite build` slaagt.

- [ ] **Step 5: Handmatige browser-rooktest (bewijs voor de user)**

- `preview_start` met `{ name: "dev" }` (leest de gestempelde poort uit `.claude/launch.json`).
- `read_console_messages` / `read_page` → geen errors, app rendert.
- Screenshot als bewijs.

- [ ] **Step 6: Eind-commit (indien nog losse wijzigingen)**

```bash
git add -A && git commit -m "chore(dev-server): dual-guard-preventie afgerond + geverifieerd (dual-guard T12)" || echo "niets te committen"
```

---

## Zelf-review (uitgevoerd bij het schrijven)

- **Spec-dekking:** opsDevPort-markering (T2/T6), absolute flock (T5), race-veilige steal (T4, getest T8-deel4), tauri OPS_DEV_GUARDED + guard-slot + OPS_DEV_INSTANCE (T9), defensieve reader + CI (T10), verweesde-worktree-opvang (T3, `worktreeRoot`→null), bootstrap + user-global hook (T11), self-test-harness 3007-fix (T11), geen import-tijd-side-effects (modulestructuur T1-T6). Alle v4-secties hebben een taak.
- **Geen placeholders:** elke code-stap bevat volledige broncode; elke test-stap echte asserts; elk commando een verwacht resultaat.
- **Type-/naamconsistentie:** `worktreeRoot`/`worktreeSlug`/`readRecordedPort`/`chooseFreePort`/`isPortFree`/`allocatePort`/`stampLaunchJson` (dev-port.mjs) en `acquireLock`/`withAllocLock`/`allocLockPath`/`acquireGuardLock` (dev-lock.mjs) consistent over T6-T11. `OPS_DEV_PORT`/`OPS_DEV_GUARDED`/`OPS_DEV_INSTANCE` en de `--print-plan`-vlag consistent tussen launcher en tests.

## Openstaand risico dat alleen een echte run afvinkt

- **Tauri env-overerving** van `OPS_DEV_GUARDED` (T9-step3) — [VERMOED] tot gedraaid; leunt op hetzelfde kanaal waarlangs `OPS_DEV_PORT` vandaag al erft.
- **SessionStart-cwd** voor de hook (T11) — verifieer dat de cwd de worktree-root is; zo niet, geef het hook-commando een absoluut scriptpad.
