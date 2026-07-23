// scripts/dev-lock.mjs
import { openSync, writeSync, closeSync, readFileSync, unlinkSync } from 'node:fs';

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

/**
 * Atomair pidfile-slot. Returnt release(); throwt bij timeout met een levende houder.
 * Steal is race-veilig: unlink → open('wx') laat precies één O_EXCL-winnaar toe.
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
        try { unlinkSync(lockPath); } catch { /* andere steler was ons voor */ }
        continue; // her-lus: open('wx') kiest één winnaar
      }
      if (now() >= deadline) {
        throw new Error(`lock ${lockPath} vastgehouden door levende PID ${h?.pid ?? 'onbekend'} > ${timeoutMs}ms — afgebroken`);
      }
      sleepSync(sleepMs);
    }
  }
}
