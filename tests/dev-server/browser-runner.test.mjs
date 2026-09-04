import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { runBrowserTests } from '../../scripts/run-browser-tests.mjs';

test('runner alloceert de browserlane, sluit de headless preflight en forwardt CLI-contract', async () => {
  const root = '/tmp/ops-fixture/werkboom-a';
  const events = [];
  const args = ['--grep', 'kritieke flow', 'tests/browser/smoke.spec.ts'];
  const exitCode = await runBrowserTests({
    root,
    allocate: async (actualRoot, lane) => {
      events.push(['allocate', actualRoot, lane]);
      return 3142;
    },
    preflightHeadless: async (options) => {
      events.push(['launch', options]);
      return {
        close: async () => events.push(['close']),
      };
    },
    spawnTest: async ({ executable, cwd, env, args: actualArgs }) => {
      events.push(['spawn', executable, cwd, env, actualArgs]);
      return 17;
    },
    args,
  });

  assert.equal(exitCode, 17, 'de Playwright-exitcode blijft ongewijzigd');
  assert.deepEqual(events, [
    ['allocate', root, 'browser'],
    ['launch', { headless: true }],
    ['close'],
    [
      'spawn',
      join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'playwright.cmd' : 'playwright'),
      root,
      {
        OPS_BROWSER_TEST_PORT: '3142',
        OPS_DEV_INSTANCE: 'werkboom-a-browser-test',
      },
      ['test', ...args],
    ],
  ]);
});

test('runner noemt het exacte herstelcommando als de headless shell ontbreekt', async () => {
  let spawnCalled = false;
  await assert.rejects(
    () => runBrowserTests({
      root: '/tmp/ops-fixture/werkboom-b',
      allocate: async () => 3143,
      preflightHeadless: async () => {
        throw new Error('browserType.launch: executable does not exist');
      },
      spawnTest: async () => {
        spawnCalled = true;
        return 0;
      },
      args: [],
    }),
    (error) => {
      assert.match(error.message, /npx playwright install --only-shell chromium/);
      return true;
    },
  );
  assert.equal(spawnCalled, false, 'zonder headless shell mag de testsuite niet starten');
});

test('een geslaagde headless launch volstaat zonder full-Chromiumpad', async () => {
  const browser = { close: async () => {} };
  const exitCode = await runBrowserTests({
    root: '/tmp/ops-fixture/werkboom-c',
    allocate: async () => 3144,
    preflightHeadless: async () => browser,
    spawnTest: async () => 0,
    args: ['--list'],
  });

  assert.equal(exitCode, 0);
});
