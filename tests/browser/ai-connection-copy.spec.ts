import { expect, type Locator } from '@playwright/test';
import { test, waitForOps } from './fixtures/ops';

const SYNTHETIC_TOKEN = 'a1-synthetic-token-not-a-secret';
const SYNTHETIC_PORT = 4319;
const ENDPOINT = `http://localhost:${SYNTHETIC_PORT}/mcp`;
const MASK = '••••••••••••••••';

type CopyLogWindow = Window & {
  __opsA1Copied?: string[];
  __opsA1RejectNextCopy?: boolean;
};

function copyInSection(dialog: Locator, heading: RegExp) {
  return dialog.getByText(heading, { exact: true }).locator('..').getByRole('button', { name: /^(Copy|Kopiëren)$/ });
}

test('AI-verbindingsgegevens maskeren de UI maar kopiëren elke bruikbare echte waarde', async ({ page, ops: _ops }) => {
  await page.addInitScript(({ token, port }) => {
    localStorage.setItem('ops-mcpToken', token);
    localStorage.setItem('ops-mcpPort', JSON.stringify(port));

    const copied: string[] = [];
    Object.defineProperty(window, '__opsA1RejectNextCopy', { configurable: true, writable: true, value: false });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (value: string) => {
          const testWindow = window as CopyLogWindow;
          if (testWindow.__opsA1RejectNextCopy) {
            testWindow.__opsA1RejectNextCopy = false;
            return Promise.reject(new Error('synthetische klembordfout'));
          }
          copied.push(value);
          return Promise.resolve();
        },
      },
    });
    Object.defineProperty(window, '__opsA1Copied', { configurable: true, value: copied });
  }, { token: SYNTHETIC_TOKEN, port: SYNTHETIC_PORT });
  await page.reload();
  await waitForOps(page);

  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({
      aiMode: true,
      activeRibbonTab: 'ai',
      ribbonCompact: false,
      showWelcomeDialog: false,
      showTourOverlay: false,
    });
  });

  const tokenControl = page.locator('input[type="password"]').locator('..');
  await expect(tokenControl).toBeVisible();
  await page.evaluate(() => { (window as CopyLogWindow).__opsA1RejectNextCopy = true; });
  await tokenControl.getByRole('button', { name: /^(Copy|Kopiëren)$/ }).click();
  await expect(tokenControl.locator('svg.lucide-check')).toHaveCount(0);
  await tokenControl.getByRole('button', { name: /^(Copy|Kopiëren)$/ }).click();

  await page.getByRole('button', { name: /^(Connect|Verbinden)$/ }).click();
  const dialog = page.locator('[data-ops-ai-connection-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText(SYNTHETIC_TOKEN);
  await expect(dialog).toContainText(MASK);

  await copyInSection(dialog, /^(Endpoint)$/).click();
  await copyInSection(dialog, /^(Authentication|Authenticatie)$/).click();
  await copyInSection(dialog, /^(Configuration snippet|Configuratiefragment)$/).click();
  await copyInSection(dialog, /^(Connection prompt|Koppelprompt)$/).click();

  const copied = await page.evaluate(() => (window as CopyLogWindow).__opsA1Copied);
  expect(copied).toHaveLength(5);
  expect(copied![0]).toBe(SYNTHETIC_TOKEN);
  expect(copied![1]).toBe(ENDPOINT);
  expect(copied![2]).toBe(`Authorization: Bearer ${SYNTHETIC_TOKEN}`);
  expect(copied![2]).not.toContain(MASK);
  expect(copied![3]).toBe(JSON.stringify({
    mcpServers: {
      'open-planner-studio': {
        type: 'http',
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${SYNTHETIC_TOKEN}` },
      },
    },
  }, null, 2));
  expect(copied![3]).not.toContain(MASK);
  expect(copied![4]).toContain(`Authorization: Bearer ${SYNTHETIC_TOKEN}`);
  expect(copied![4]).toContain(ENDPOINT);
  expect(copied![4]).not.toContain(MASK);
});
