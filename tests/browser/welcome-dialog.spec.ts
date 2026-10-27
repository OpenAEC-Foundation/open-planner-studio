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

// SuperCloud-werkplek (#582, #583, #706): de tool draait in een sandbox zonder `allow-same-origin`
// (CSP `sandbox allow-scripts allow-modals`), dus in een ECHTE opaque origin. Hier krijgt het document
// zelf die CSP-header, zoals in de werkplek; de browser weigert dan zelf localStorage, sessionStorage
// en IndexedDB. Een opaque origin haalt modules op met CORS, dus elk antwoord van de dev-server krijgt
// `Access-Control-Allow-Origin: *`. De host zet GEEN `skipWelcome`, net als de werkplek: zonder
// localStorage slaat de tool het venster zelf over. Bewust zonder de `ops`-fixture, want die wacht
// juist op de welkomst en schrijft localStorage. Het startbestand van de host is het ijkpunt:
// `useSiteInitialFile` opent het in dezelfde ronde als de welkomstcheck (na de herstelcontrole).
// Staat het er, dan is die check voorbij en had een welkomstvenster al moeten verschijnen. Een
// onafgevangen fout faalt de test.
test('werkplek in een opaque origin: de app start, geen welkomstvenster en geen herstelmelding, ook niet na herladen', async ({ page }) => {
  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    const headers: Record<string, string> = { ...response.headers(), 'access-control-allow-origin': '*' };
    if (route.request().resourceType() === 'document') headers['content-security-policy'] = 'sandbox allow-scripts allow-modals';
    await route.fulfill({ response, headers });
  });
  await page.addInitScript((ifc) => {
    const file = { id: 'p1', name: 'Planning.ifc', version: '1' };
    (window as unknown as { openaecHost: unknown }).openaecHost = {
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
  const recoveryOff: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Crashherstel staat uit')) recoveryOff.push(message.text());
    if (message.type() === 'error') console.log(`[opaque origin] console.error: ${message.text()}`);
  });
  const welcome = page.locator('[data-ops-welcome-dialog]');
  for (const round of ['eerste start', 'na herladen']) {
    recoveryOff.length = 0;
    if (round === 'eerste start') await page.goto('/'); else await page.reload();
    await waitForOps(page);
    // Echt een opaque origin: de browser zelf weigert de opslag.
    expect(await page.evaluate(() => {
      const refused = (read: () => unknown) => { try { read(); return 'werkt'; } catch (error) { return (error as Error).name; } };
      return { origin: self.origin, localStorage: refused(() => localStorage), sessionStorage: refused(() => sessionStorage) };
    }), round).toEqual({ origin: 'null', localStorage: 'SecurityError', sessionStorage: 'SecurityError' });
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().siteFileId), { timeout: 20_000, message: round })
      .toBe('p1');
    await expect(welcome, round).toHaveCount(0);
    const ui = await page.evaluate(() => {
      const u = window.__OPS__!.store.getState().ui;
      return { welcomePending: u.welcomePending, showTourOverlay: u.showTourOverlay, showTutorialOffer: u.showTutorialOffer };
    });
    expect(ui, round).toEqual({ welcomePending: false, showTourOverlay: false, showTutorialOffer: false });
    // Na een wijziging geen melding, en alleen de ene consoleregel van de start. Let op: de wachttijd
    // bewijst niet dat er een crashherstelronde liep (de throttle kan die tot 10 s uitstellen,
    // knownbug 407); de stille weigering zelf is bij de start al herkend.
    await page.evaluate(() => { window.__OPS__!.store.getState().addTask({ name: 'In de werkplek' }); });
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().isDirty), { message: round }).toBe(true);
    await page.waitForTimeout(2_000);
    expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications.map((n) => n.messageKey)), round).toEqual([]);
    expect(recoveryOff, round).toHaveLength(1);
  }
  expect(pageErrors, 'onafgevangen fouten in een opaque origin').toEqual([]);
});
