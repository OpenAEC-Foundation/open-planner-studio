// De welkomstdialoog is een eigen mini-laag bovenop dezelfde instellingen als SettingsPanelContent:
// taal, thema en automatisch berekenen worden met echte klikken gekozen en moeten live in de store
// én in de opslag landen, precies zoals vanuit de instellingen. De storebrug opent alleen de
// dialoog en leest de uitkomst.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, waitForOps } from './fixtures/ops';

const IFC = readFileSync(resolve(process.cwd(), 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');

test('welkomstdialoog past taal, thema en automatisch berekenen live toe en bewaart ze', async ({ page, ops: _ops }) => {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: true, uiTheme: 'dark' }));
  const dialog = page.locator('[data-ops-welcome-dialog]');
  await expect(dialog).toBeVisible();

  const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.autoCalcCPM);
  await dialog.getByRole('checkbox', { name: /^(Calculate automatically|Automatisch berekenen)/ }).click();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.autoCalcCPM)).toBe(!before);
  expect(await page.evaluate(() => localStorage.getItem('ops-autoCalcCPM'))).toBe(String(!before));

  await dialog.getByRole('button', { name: /^(Theme|Thema)$/ }).click();
  await page.getByRole('option', { name: /^(Light|Licht)$/ }).click();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe('light');
  expect(await page.evaluate(() => localStorage.getItem('ops-theme'))).toBe('light');

  await dialog.getByRole('button', { name: /^(Language|Taal)$/ }).click();
  await page.getByRole('option', { name: /Nederlands/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  expect(await page.evaluate(() => localStorage.getItem('ops-locale'))).toBe('nl');
  await expect(dialog.getByRole('button', { name: 'Taal', exact: true })).toBeVisible();
});

// Werkplek zonder localStorage (#583): de host zet `skipWelcome: true`. Bewust zonder de `ops`-fixture,
// want die wacht juist op de welkomst en schrijft localStorage. Zoals in een sandbox-iframe zonder
// `allow-same-origin` (opaque origin) gooit al het LEZEN van `localStorage` en `sessionStorage` een
// `SecurityError`; de app moet dan toch starten (IndexedDB blijft hier wel bruikbaar). Het
// startbestand van de host is het ijkpunt: `useSiteInitialFile` opent het in dezelfde ronde als de
// welkomstcheck (na de herstelcontrole). Staat het er, dan is die check voorbij en had een
// welkomstvenster al moeten verschijnen. Een onafgevangen fout faalt de test; console-fouten komen
// alleen in de log (de recovery-route is hier geen onderwerp).
test('host met skipWelcome zonder localStorage: de app start, geen welkomstvenster, ook niet na herladen', async ({ page }) => {
  await page.addInitScript((ifc) => {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, {
        configurable: true,
        get() { throw new DOMException(`${name} is niet beschikbaar (opaque origin).`, 'SecurityError'); },
      });
    }
    const file = { id: 'p1', name: 'Planning.ifc', version: '1' };
    (window as unknown as { openaecHost: unknown }).openaecHost = {
      skipWelcome: true,
      initialFileId: 'p1',
      storage: {
        list: async () => [file],
        open: async () => ({ file, data: ifc }),
        save: async () => { throw new Error('niet in deze test'); },
        versions: async () => [{ version: '1' }],
      },
    };
  }, IFC);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`[zonder localStorage] console.error: ${message.text()}`);
  });
  const welcome = page.locator('[data-ops-welcome-dialog]');
  for (const round of ['eerste start', 'na herladen']) {
    if (round === 'eerste start') await page.goto('/'); else await page.reload();
    await waitForOps(page);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().siteFileId), { timeout: 20_000, message: round })
      .toBe('p1');
    await expect(welcome, round).toHaveCount(0);
    const ui = await page.evaluate(() => {
      const u = window.__OPS__!.store.getState().ui;
      return { welcomePending: u.welcomePending, showTourOverlay: u.showTourOverlay, showTutorialOffer: u.showTutorialOffer };
    });
    expect(ui, round).toEqual({ welcomePending: false, showTourOverlay: false, showTutorialOffer: false });
  }
  expect(pageErrors, 'onafgevangen fouten zonder localStorage').toEqual([]);
});
