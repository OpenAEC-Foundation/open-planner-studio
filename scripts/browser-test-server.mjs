#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';
import { PORT_LANES, worktreeRoot, worktreeSlug } from './dev-port.mjs';
import { acquireNamedGuardLock } from './dev-lock.mjs';

const port = Number(process.env.OPS_BROWSER_TEST_PORT);
const { min, max } = PORT_LANES.browser;
if (!Number.isInteger(port) || port < min || port > max) {
  console.error(`OPS_BROWSER_TEST_PORT ontbreekt of is ongeldig; verwacht ${min}-${max}.`);
  process.exit(1);
}

const root = worktreeRoot();
if (!root) {
  console.error('Niet in een git-worktree — browser-testserver kan niet starten.');
  process.exit(1);
}

let releaseGuard;
try {
  releaseGuard = acquireNamedGuardLock(root, port, 'browser');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  releaseGuard();
};

const viteBin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
const instance = `${worktreeSlug(root)}-browser-test`;
// Playwright pollt bewust 127.0.0.1. Op sommige CI-runners resolveert Vites
// standaardhost `localhost` uitsluitend naar ::1, waardoor Vite gezond draait
// maar de webServer-poort na 60 seconden alsnog time-out. Bind beide kanten
// daarom expliciet aan hetzelfde IPv4-adres.
const child = spawn(viteBin, ['--host', '127.0.0.1'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    OPS_DEV_PORT: String(port),
    OPS_DEV_INSTANCE: instance,
  },
});

let forwardedSignal;
const forward = (signal) => {
  forwardedSignal = signal;
  if (!child.killed) child.kill(signal);
};

process.once('exit', cleanup);
process.once('SIGINT', () => forward('SIGINT'));
process.once('SIGTERM', () => forward('SIGTERM'));
child.once('error', (error) => {
  cleanup();
  console.error(`Vite starten mislukte: ${error.message}`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  cleanup();
  if (code != null) process.exitCode = code;
  else if ((signal ?? forwardedSignal) === 'SIGINT') process.exitCode = 130;
  else if ((signal ?? forwardedSignal) === 'SIGTERM') process.exitCode = 143;
  else process.exitCode = 1;
});
