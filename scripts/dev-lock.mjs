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
  catch (e) { return e.code === 'EPERM'; }
}

function readText(lockPath) {
  try { return readFileSync(lockPath, 'utf8'); } catch { return null; }
}

function parseHolder(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function readHolder(lockPath) {
  return parseHolder(readText(lockPath));
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

function unchangedFile(path, before) {
  const after = statOrNull(path);
  return sameFile(after, before) && after.size === before.size && after.mtimeMs === before.mtimeMs;
}

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
    try { close(fd); } catch { }
    removeOwnLock(lockPath, own);
    throw e;
  }
  try { close(fd); } catch (e) { removeOwnLock(lockPath, own); throw e; }
}

function removeOwnLock(lockPath, own) {
  if (own && !sameFile(statOrNull(lockPath), own)) return;
  try { unlinkSync(lockPath); } catch { }
}

export function acquireLock(lockPath, opts = {}) {
  const {
    allowAgeSteal = false, ageMs = 60000,
    emptyAgeMs = 10000,
    timeoutMs = 15000, sleepMs = 50,
    extra = {}, now = Date.now,
    write = writeSync, close = closeSync,
  } = opts;
  const deadline = now() + timeoutMs;
  for (;;) {
    let fd = null;
    try {
      fd = openSync(lockPath, 'wx');
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    if (fd !== null) {
      fillOwnLock(lockPath, fd, JSON.stringify({ pid: process.pid, startedAt: now(), ...extra }), write, close);
      return () => { try { unlinkSync(lockPath); } catch { } };
    }
    const raw = readText(lockPath);
    const h = parseHolder(raw);
    const dead = h && typeof h.pid === 'number' && !pidAlive(h.pid);
    const aged = allowAgeSteal && h && typeof h.startedAt === 'number' && (now() - h.startedAt) > ageMs;
    const emptySnap = raw !== null && h === null ? statOrNull(lockPath) : null;
    const orphanEmpty = emptySnap !== null && (now() - emptySnap.mtimeMs) > emptyAgeMs;
    if (dead || aged || orphanEmpty) {
      const mine = `${lockPath}.steal.${process.pid}.${stealSeq++}`;
      try {
        renameSync(lockPath, mine);
      } catch (e2) {
        if (e2.code === 'ENOENT') continue;
        throw e2;
      }
      const exact = orphanEmpty
        ? unchangedFile(mine, emptySnap) && readText(mine) === raw
        : sameHolder(readHolder(mine), h);
      if (exact) {
        try { unlinkSync(mine); } catch { }
      } else {
        try { linkSync(mine, lockPath); } catch { }
        try { unlinkSync(mine); } catch { }
      }
      continue;
    }
    if (now() >= deadline) {
      throw new Error(`lock ${lockPath} vastgehouden door levende PID ${h?.pid ?? 'onbekend'} > ${timeoutMs}ms — afgebroken`);
    }
    sleepSync(sleepMs);
  }
}

export function allocLockPath(root) {
  const gcd = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  return join(resolve(root, gcd), 'ops-dev-alloc.lock');
}

export async function withAllocLock(root, fn) {
  const release = acquireLock(allocLockPath(root), { allowAgeSteal: false, timeoutMs: 15000 });
  try { return await fn(); }
  finally { release(); }
}

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

export function acquireGuardLock(root, port) {
  return acquireNamedGuardLock(root, port, 'dev');
}
