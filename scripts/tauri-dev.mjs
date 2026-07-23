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
