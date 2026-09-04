import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.OPS_BROWSER_TEST_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('OPS_BROWSER_TEST_PORT ontbreekt of is ongeldig; start via npm run test:browser');
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/browser-test-server.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
