#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { chromium } from '@playwright/test';
import { allocateNamedPort, worktreeRoot } from './dev-port.mjs';

const INSTALL_COMMAND = 'npx playwright install --only-shell chromium';

function localPlaywrightBin(root) {
  const bin = process.platform === 'win32' ? 'playwright.cmd' : 'playwright';
  return join(root, 'node_modules', '.bin', bin);
}

function spawnPlaywright({ executable, cwd, env, args }) {
  return new Promise((resolveCode, reject) => {
    const child = spawn(executable, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.once('error', reject);
    child.once('exit', (code) => resolveCode(code ?? 1));
  });
}

export async function runBrowserTests({ root, allocate, preflightHeadless, spawnTest, args }) {
  if (!root) throw new Error('Niet in een git-worktree — browsertests kunnen niet starten.');
  const port = await allocate(root, 'browser');

  let browser;
  try {
    browser = await preflightHeadless({ headless: true });
  } catch (cause) {
    throw new Error(`Playwright headless shell ontbreekt; voer uit: ${INSTALL_COMMAND}`, { cause });
  } finally {
    if (browser) await browser.close();
  }

  return spawnTest({
    executable: localPlaywrightBin(root),
    cwd: root,
    env: {
      OPS_BROWSER_TEST_PORT: String(port),
      OPS_DEV_INSTANCE: `${basename(root)}-browser-test`,
    },
    args: ['test', ...args],
  });
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const exitCode = await runBrowserTests({
      root: worktreeRoot(),
      allocate: allocateNamedPort,
      preflightHeadless: (options) => chromium.launch(options),
      spawnTest: spawnPlaywright,
      args: process.argv.slice(2),
    });
    process.exitCode = exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
