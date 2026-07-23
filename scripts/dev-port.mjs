// scripts/dev-port.mjs
import { readFileSync, realpathSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { withAllocLock } from './dev-lock.mjs';

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
