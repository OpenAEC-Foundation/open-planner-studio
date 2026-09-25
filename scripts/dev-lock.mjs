// scripts/dev-lock.mjs
import {
  openSync, writeSync, closeSync, fstatSync, statSync, readFileSync, unlinkSync, renameSync, linkSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

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

function statOrNull(path) {
  try { return statSync(path); } catch { return null; }
}

function sameFile(a, b) {
  return Boolean(a && b && a.dev === b.dev && a.ino === b.ino);
}

/**
 * Vult een net met open('wx') aangemaakt slot. Lukt schrijven of sluiten niet
 * (ENOSPC, EFBIG, EIO, of een onvolledige schrijf), dan ruimen we ONS slot op en
 * gooien de fout door. Anders blijft een leeg of half slot staan dat iedereen als
 * levend ziet (incident 25-09: schijf vol, alle worktrees geblokkeerd).
 *
 * "Ons" betekent: het pad wijst nog naar de inode die wij aanmaakten. Zo vegen we
 * nooit een slot weg dat een ander intussen op hetzelfde pad heeft gezet.
 */
function fillOwnLock(lockPath, fd, payload, write, close) {
  let own = null;
  try {
    own = fstatSync(fd);
    const buf = Buffer.from(payload);
    const n = write(fd, buf);
    if (n !== buf.length) {
      throw Object.assign(
        new Error(`slot ${lockPath} onvolledig geschreven (${n} van ${buf.length} bytes)`),
        { code: 'EIO' },
      );
    }
  } catch (e) {
    try { close(fd); } catch { /* de schrijffout is de echte oorzaak */ }
    removeOwnLock(lockPath, own);
    throw e;
  }
  try { close(fd); } catch (e) { removeOwnLock(lockPath, own); throw e; }
}

function removeOwnLock(lockPath, own) {
  // Zonder fstat (faalt in de praktijk niet) is het pad vrijwel zeker nog van ons:
  // we maakten het net aan en een leeg slot wordt niet gestolen.
  if (own && !sameFile(statOrNull(lockPath), own)) return;
  try { unlinkSync(lockPath); } catch { /* al weg */ }
}

/**
 * Atomair pidfile-slot. Returnt release(); throwt bij timeout met een levende houder.
 *
 * Verse claim = `open('wx')` (O_EXCL) → altijd precies één winnaar.
 *
 * Een verweesd slot (dode pid, of te oud onder allowAgeSteal) stelen is race-veilig
 * via claim-en-verifieer: `rename(lock → privé)` is atomair, dus bij N gelijktijdige
 * stelers verplaatst maar ÉÉN de inode (de rest krijgt ENOENT → her-lus). Vervolgens
 * verifiëren we dat we exact de beoordeelde dode holder grepen (`sameHolder`); greep
 * een refresh-race een ánder (mogelijk levend) slot, dan zetten we dat terug via
 * `link` (nooit overschrijven) i.p.v. het te klobberen. Een naïeve `unlink`+`open`
 * zou een net-gewonnen vers slot kunnen wegvegen → meerdere winnaars.
 *
 * Een leeg/half-geschreven slot (null holder) geldt als levend → niet stelen.
 * Daarom ruimt de maker zijn slot zelf op als schrijven of sluiten faalt
 * (fillOwnLock); anders blokkeert een leeg slot iedereen voorgoed.
 *
 * `write`/`close`/`now` zijn injecteerbaar voor tests.
 */
export function acquireLock(lockPath, opts = {}) {
  const {
    allowAgeSteal = false, ageMs = 60000,
    timeoutMs = 15000, sleepMs = 50,
    extra = {}, now = Date.now,
    write = writeSync, close = closeSync,
  } = opts;
  const deadline = now() + timeoutMs;
  for (;;) {
    let fd = null;
    try {
      fd = openSync(lockPath, 'wx'); // O_EXCL — de mutex
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    if (fd !== null) {
      fillOwnLock(lockPath, fd, JSON.stringify({ pid: process.pid, startedAt: now(), ...extra }), write, close);
      return () => { try { unlinkSync(lockPath); } catch { /* al weg */ } };
    }
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
        try { unlinkSync(mine); } catch { /* al weg */ } // exact de dode holder → weggooien
      } else {
        // Refresh-race: we grepen een ánder (mogelijk levend) slot. Zet het terug
        // zónder een intussen vers-gemaakt slot te overschrijven (link faalt op EEXIST).
        try { linkSync(mine, lockPath); } catch { /* slot al opnieuw geclaimd */ }
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

/** Per-worktree en per-lane runtime-slot voor proces-leven. */
export function acquireNamedGuardLock(root, port, lane) {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(lane)) {
    throw new Error(`Ongeldige guard-lane identifier "${lane}"`);
  }
  if (process.env.OPS_DEV_GUARDED) return () => {};
  const key = createHash('sha1').update(root).digest('hex').slice(0, 16);
  const lockPath = join(tmpdir(), `ops-${lane}-guard-${key}.lock`);
  try {
    return acquireLock(lockPath, {
      allowAgeSteal: true, ageMs: 24 * 3600 * 1000,
      timeoutMs: 0, extra: { port, root, lane },
    });
  } catch {
    const h = readHolder(lockPath);
    throw new Error(
      `${lane} server voor "${basename(root)}" draait al (PID ${h?.pid ?? '?'}, poort ${h?.port ?? '?'}) — tweede bewaker geweigerd`,
    );
  }
}

/** Compatibiliteitswrapper voor de bestaande devlaunchers. */
export function acquireGuardLock(root, port) {
  return acquireNamedGuardLock(root, port, 'dev');
}
