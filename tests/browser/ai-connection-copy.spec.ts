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

  await dialog.getByRole('button', { name: /^(Close|Sluiten)$/ }).last().click();
  // knownbugs #26: een mislukte start bindt geen poort. Na fouten kan de gebruiker herstellen,
  // in zowel het volle lint als de compacte popover, zonder een echte bridge te starten.
  for (const compact of [false, true]) {
    await page.evaluate(compact => window.__OPS__!.store.getState().setUI({ ribbonCompact: compact }), compact);
    if (compact) await page.getByRole('button', { name: /^(Connect|Verbinden)$/ }).click();
    const port = page.getByRole('spinbutton', { name: /^(Port|Poort)$/ });
    for (const serverState of ['port-busy', 'error'] as const) {
      await page.evaluate(state => window.__OPS__!.store.getState().setAiServerStatus({ state, port: 4319 }), serverState);
      await expect(port).toBeEnabled();
      const chosen = String((compact ? 4322 : 4320) + (serverState === 'error' ? 1 : 0));
      await port.fill(chosen);
      await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.aiServerStatus))
        .toEqual({ state: 'off', port: Number(chosen) });
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-mcpPort')!))).toBe(Number(chosen));
    }
    await page.evaluate(() => window.__OPS__!.store.getState().setAiServerStatus({ state: 'live', port: 4321 }));
    await expect(port).toBeDisabled();
    await page.evaluate(() => window.__OPS__!.store.getState().setAiServerStatus({ state: 'off', port: 4321 }));
    await expect(port).toBeEnabled();
    if (compact) await page.keyboard.press('Escape');
  }

  // De setup-prompt (extensie voor Claude, zonder token) staat bovenaan het venster, met dezelfde knop
  // en tekst als in Help: één bron, het promptblok van het artikel. Uit elkaar gelopen ⇒ deze stap faalt.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ ribbonCompact: false }));
  await page.getByRole('button', { name: /^(Connect|Verbinden)$/ }).click();
  await expect(dialog).toBeVisible();
  const setup = dialog.locator('[data-ops-ai-setup-prompt]');
  const setupText = await setup.locator('[data-help-prompt] pre').textContent();
  expect(setupText).toContain('Open Planner Studio');
  expect(setupText).not.toContain(SYNTHETIC_TOKEN);
  await setup.getByRole('button', { name: /^(Copy prompt|Prompt kopiëren)$/ }).click();
  await expect(setup.getByRole('status')).toHaveText(/^(Copied|Gekopieerd)\./);
  const afterDialog = await page.evaluate(() => (window as CopyLogWindow).__opsA1Copied!.slice());
  expect(afterDialog[afterDialog.length - 1]).toBe(setupText);

  // De ?-knop van het venster opent het artikel; Help toont en kopieert precies dezelfde prompt.
  await dialog.locator('[data-ops-help-button="howto-ai-assistent-koppelen"]').click();
  await expect(dialog).toHaveCount(0);
  const article = page.locator('.help-article-body');
  await expect(article).toHaveAttribute('data-help-current', 'howto-ai-assistent-koppelen');
  const helpPrompt = article.locator('[data-help-prompt]');
  expect(await helpPrompt.locator('pre').textContent()).toBe(setupText);
  await helpPrompt.getByRole('button', { name: /^(Copy prompt|Prompt kopiëren)$/ }).click();
  await expect(helpPrompt.getByRole('status')).toHaveText(/^(Copied|Gekopieerd)\./);
  const afterHelp = await page.evaluate(() => (window as CopyLogWindow).__opsA1Copied!.slice());
  expect(afterHelp).toHaveLength(afterDialog.length + 1);
  expect(afterHelp[afterHelp.length - 1]).toBe(setupText);

  // Omgevingsbeheer houdt poort/token vast, ook als de bridge uitstaat. De omgeving is de fixture;
  // de echte invoervelden en knoppen moeten de planner vervolgens geen onwerkzame wijziging bieden.
  await page.evaluate(() => {
    Object.assign(window, { __TAURI_INTERNALS__: {}, __OPS_LINUX__: {
      managed: true, directory: '/openaec', initialFile: null,
      mcp: { port: 4319, token: 'synthetisch-beheerd-testtoken-1234567890' },
    } });
    window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'ai', ribbonCompact: false });
    window.__OPS__!.store.getState().setAiServerStatus({ state: 'off', port: 4319 });
  });
  try {
    await expect(page.getByRole('spinbutton', { name: /^(Port|Poort)$/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^(New token|Nieuw token)$/ })).toBeDisabled();
  } finally {
    await page.evaluate(() => {
      delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
      delete (window as Window & { __OPS_LINUX__?: unknown }).__OPS_LINUX__;
    });
  }
});
