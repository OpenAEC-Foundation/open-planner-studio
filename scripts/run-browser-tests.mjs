#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { chromium } from '@playwright/test';
import { allocateNamedPort, worktreeRoot } from './dev-port.mjs';
import { SPEC_DIR, parseShard, shardFiles } from './browser-shards.mjs';

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

const DURATION_SHARD = '--duration-shard';

/**
 * `--duration-shard=k/n` (of `--duration-shard k/n`): draai alleen de specs die `browser-shards.mjs` op
 * gemeten duur aan shard k van n toewijst, via Playwrights `--test-list` (exacte paden, geen regex).
 * Geeft de overige argumenten plus de lijst terug; zonder die vlag `null`.
 */
export function extractDurationShard(args) {
  const rest = [];
  let value = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === DURATION_SHARD) {
      value = args[++i] ?? '';
    } else if (arg.startsWith(`${DURATION_SHARD}=`)) {
      value = arg.slice(DURATION_SHARD.length + 1);
    } else {
      rest.push(arg);
    }
  }
  return value === null ? null : { shard: parseShard(value), rest };
}

export async function runBrowserTests({
  root, allocate, preflightHeadless, spawnTest, args, planShard = shardFiles,
}) {
  if (!root) throw new Error('Niet in een git-worktree — browsertests kunnen niet starten.');

  // De shardlijst vóór de poort en de preflight: een fout in de vlag kost dan geen browserstart.
  const durationShard = extractDurationShard(args);
  let shardSpecs = null;
  if (durationShard) {
    const { current, total } = durationShard.shard;
    shardSpecs = planShard(root, current, total);
    if (shardSpecs.length === 0) throw new Error(`--duration-shard ${current}/${total}: deze shard heeft geen specs`);
  }
  const port = await allocate(root, 'browser');

  let browser;
  try {
    browser = await preflightHeadless({ headless: true });
  } catch (cause) {
    throw new Error(`Playwright headless shell ontbreekt; voer uit: ${INSTALL_COMMAND}`, { cause });
  } finally {
    if (browser) await browser.close();
  }

  let listDir = null;
  let playwrightArgs = args;
  if (durationShard) {
    const { current, total } = durationShard.shard;
    listDir = mkdtempSync(join(tmpdir(), 'ops-browser-shard-'));
    const listFile = join(listDir, `shard-${current}-of-${total}.txt`);
    // `--test-list` rekent paden relatief aan testDir (tests/browser).
    writeFileSync(listFile, `${shardSpecs.map((f) => f.slice(SPEC_DIR.length + 1)).join('\n')}\n`);
    console.log(`browser-shard ${current}/${total} op duur: ${shardSpecs.length} specs`);
    playwrightArgs = [...durationShard.rest, '--test-list', listFile];
  }
  try {
    return await spawnTest({
      executable: localPlaywrightBin(root),
      cwd: root,
      env: {
        OPS_BROWSER_TEST_PORT: String(port),
        OPS_DEV_INSTANCE: `${basename(root)}-browser-test`,
      },
      args: ['test', ...playwrightArgs],
    });
  } finally {
    if (listDir) rmSync(listDir, { recursive: true, force: true });
  }
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
