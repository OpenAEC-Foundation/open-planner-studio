import { readFileSync, realpathSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { withAllocLock } from './dev-lock.mjs';

export const PORT_LANES = Object.freeze({
  dev: Object.freeze({ min: 3007, max: 3106, marker: 'opsDevPort' }),
  browser: Object.freeze({ min: 3107, max: 3206, marker: 'opsBrowserTestPort' }),
});

export const MIN_PORT = PORT_LANES.dev.min;
export const MAX_PORT = PORT_LANES.dev.max;

function portLane(lane) {
  const config = PORT_LANES[lane];
  if (!config) {
    throw new Error(`Onbekende poortlane "${lane}"; verwacht ${Object.keys(PORT_LANES).join(' of ')}`);
  }
  return config;
}

export function chooseFreePortFor(lane, claimed, isBound) {
  const { min, max } = portLane(lane);
  for (let port = min; port <= max; port++) {
    if (!claimed.has(port) && !isBound(port)) return port;
  }
  throw new Error(`Geen vrije ${lane}-poort in ${min}-${max}`);
}

export function chooseFreePort(claimed, isBound) {
  return chooseFreePortFor('dev', claimed, isBound);
}

export function readRecordedPort(root, lane = 'dev', readFile = readFileSync) {
  if (!root) return null;
  const { min, max, marker } = portLane(lane);
  try {
    const json = JSON.parse(readFile(join(root, '.claude', 'launch.json'), 'utf8'));
    const p = json?.[marker];
    return Number.isInteger(p) && p >= min && p <= max ? p : null;
  } catch {
    return null;
  }
}

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

export function stampRecordedPort(root, lane, port) {
  const { min, max, marker } = portLane(lane);
  if (!Number.isInteger(port) || port < min || port > max) {
    throw new Error(`Ongeldige ${lane}-poort ${port}; verwacht ${min}-${max}`);
  }
  const file = join(root, '.claude', 'launch.json');
  let json;
  try { json = JSON.parse(readFileSync(file, 'utf8')); }
  catch { json = defaultLaunchJson(); }
  if (!json || typeof json !== 'object' || Array.isArray(json)) json = defaultLaunchJson();
  json[marker] = port;
  if (lane === 'dev') {
    json.configurations = Array.isArray(json.configurations) ? json.configurations : [];
    const dev = json.configurations.find((c) => c && c.name === 'dev');
    if (dev) dev.port = port;
    else json.configurations.unshift({ name: 'dev', runtimeExecutable: 'npm', runtimeArgs: ['run', 'dev'], port });
  }
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(json, null, 2)}\n`);
  renameSync(tmp, file);
}

export function stampLaunchJson(root, port) {
  return stampRecordedPort(root, 'dev', port);
}

function resolvedPath(p) {
  try { return realpathSync(p); } catch { return p; }
}

function isSameRoot(a, b) {
  return a === b || resolvedPath(a) === resolvedPath(b);
}

function listWorktreePaths(root) {
  const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  });
  return out.split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length).trim());
}

export async function allocateNamedPort(root, lane, deps = {}) {
  const { min, max } = portLane(lane);
  const {
    recorded = (path) => readRecordedPort(path, lane),
    listPaths = listWorktreePaths,
    portFree = isPortFree,
    stamp = (path, port) => stampRecordedPort(path, lane, port),
    lock = withAllocLock,
  } = deps;

  return lock(root, async () => {
    const mine = recorded(root);

    const claimed = new Set();
    for (const p of listPaths(root)) {
      if (isSameRoot(p, root)) continue;
      const port = recorded(p);
      if (port != null) claimed.add(port);
    }

    if (mine != null && !claimed.has(mine)) return mine;

    const bound = new Set();
    for (let p = min; p <= max; p++) {
      if (!claimed.has(p) && !(await portFree(p))) bound.add(p);
    }
    let port;
    try {
      port = chooseFreePortFor(lane, claimed, (p) => bound.has(p));
    } catch {
      throw new Error(
        `Geen vrije ${lane}-poort in ${min}-${max} voor worktree "${worktreeSlug(root)}"`
        + ` — ${claimed.size} poort(en) geclaimd door andere worktrees, ${bound.size} in gebruik.`
        + ' Sluit een dev-server af of verruim het bereik in scripts/dev-port.mjs.',
      );
    }
    stamp(root, port);
    return port;
  });
}

export function allocatePort(root, deps = {}) {
  return allocateNamedPort(root, 'dev', deps);
}
