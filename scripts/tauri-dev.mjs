#!/usr/bin/env node
/**
 * Dev launcher for the Tauri desktop build.
 *
 * Why this exists: `tauri.conf.json` pins `devUrl` to a fixed port and Vite
 * would otherwise silently drift to another port when that one is taken. With
 * two git worktrees running `tauri:dev` at once, the second window then loads
 * the *first* worktree's frontend. This launcher makes the port and the
 * window's devUrl a single, self-consistent value chosen at launch:
 *
 *   1. pick the first free port >= BASE_PORT,
 *   2. derive a stable instance slug from the worktree directory name,
 *   3. start `tauri dev` with a matching `--config devUrl` and both values in
 *      the environment (OPS_DEV_PORT, OPS_DEV_INSTANCE).
 *
 * `vite.config.ts` reads OPS_DEV_PORT (strictPort), so Vite binds exactly the
 * chosen port; OPS_DEV_INSTANCE isolates the auto-save recovery file per
 * worktree (see src/App.tsx). Each worktree therefore gets its own port and
 * its own recovery file with zero manual configuration.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import process from 'node:process';

const BASE_PORT = 3007;
const MAX_PORT = BASE_PORT + 50;

/** Resolve to true if `port` can be bound on localhost, false otherwise. */
function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

/** First free port at or above BASE_PORT. */
async function findFreePort() {
  for (let port = BASE_PORT; port <= MAX_PORT; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port in range ${BASE_PORT}-${MAX_PORT}`);
}

const port = await findFreePort();
const instance = basename(process.cwd());

// eslint-disable-next-line no-console
console.log(`\n  ▶ open-planner-studio dev — worktree "${instance}" → http://localhost:${port}/\n`);

// Resolve the local Tauri CLI from node_modules/.bin so this works whether
// launched via `npm run` (bin on PATH) or directly with `node`.
const binName = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
const localBin = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.bin', binName);
const tauriBin = existsSync(localBin) ? localBin : binName;
const config = JSON.stringify({ build: { devUrl: `http://localhost:${port}` } });

const child = spawn(tauriBin, ['dev', '--config', config], {
  stdio: 'inherit',
  env: { ...process.env, OPS_DEV_PORT: String(port), OPS_DEV_INSTANCE: instance },
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('Failed to start tauri:', err.message);
  process.exit(1);
});
