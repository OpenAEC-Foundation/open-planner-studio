import { expect, seedProject, test } from './fixtures/ops';

test('Backstage export: annuleren blijft staan, ook bij poolbestand; succesvolle export sluit', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Exporttaak', start: '2026-09-07', finish: '2026-09-09', durationDays: 3 }]);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.bindProjectToCompany(s.addCompany('Exportbibliotheek'));
    // Alleen de browsergrens is een fixture: synthetische kiezer, zonder echte bestandstoegang.
    // Chromium kan de onbekende featurePolicy-naam als false melden; dat mag deze fixture niet overslaan.
    Object.defineProperty(document, 'featurePolicy', { configurable: true, value: undefined });
    sessionStorage.setItem('ops-test-export-picker-calls', '0');
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: async () => [] });
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async (options: { suggestedName: string }) => {
        sessionStorage.setItem('ops-test-export-suggested-name', options.suggestedName);
        sessionStorage.setItem('ops-test-export-picker-calls', String(Number(sessionStorage.getItem('ops-test-export-picker-calls')) + 1));
        throw new DOMException('Geannuleerd', 'AbortError');
      },
    });
  });
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.locator('.backstage-sidebar').getByRole('button', { name: /^(Export|Exporteren)$/ }).click();
  const cards = page.locator('.backstage-export-card');
  const csv = cards.filter({ has: page.getByRole('heading', { name: 'CSV (semicolon-separated)', exact: true }) });
  const xlsx = cards.filter({ has: page.getByRole('heading', { name: 'Progress sheet (Excel)', exact: true }) });
  const ifc = cards.filter({ has: page.getByRole('heading', { name: 'IFC', exact: true }) });
  const inExport = () => page.evaluate(() => {
    const ui = window.__OPS__!.store.getState().ui;
    return [ui.activeRibbonTab, ui.backstageSection];
  });

  let expectedCalls = 0;
  const pickerCalls = () => page.evaluate(() => Number(sessionStorage.getItem('ops-test-export-picker-calls')));
  await expect(cards.filter({ has: page.getByRole('heading', { name: 'Progress sheet (CSV)', exact: true }) })).toHaveCount(0);
  for (const card of [csv, xlsx, csv]) {
    await card.click();
    await expect.poll(pickerCalls).toBe(++expectedCalls);
    await expect.poll(inExport).toEqual(['file', 'export']);
    await expect(cards.first()).toBeVisible();
    if (card === xlsx) {
      await expect.poll(() => page.evaluate(() => sessionStorage.getItem('ops-test-export-suggested-name')))
        .toMatch(/-progress\.xlsx$/);
    }
  }

  // Twee-bestandenroute: project is al gedownload, maar de tweede kiezer wordt geannuleerd.
  await page.locator('.backstage-main input[type="checkbox"]').check();
  await page.evaluate(() => {
    let calls = 0;
    sessionStorage.setItem('ops-test-export-picker-calls', '0');
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async (options: { suggestedName: string }) => {
        sessionStorage.setItem('ops-test-export-suggested-name', options.suggestedName);
        calls++;
        sessionStorage.setItem('ops-test-export-picker-calls', String(calls));
        if (calls === 1) throw new DOMException('Eenmalig geen gebruikersactivatie', 'SecurityError');
        throw new DOMException('Pool geannuleerd', 'AbortError');
      },
    });
  });
  const projectDownload = page.waitForEvent('download');
  await ifc.click();
  await projectDownload;
  await expect.poll(pickerCalls).toBe(2);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('ops-test-export-suggested-name'))).toMatch(/-library\.ifc$/);
  await expect.poll(inExport).toEqual(['file', 'export']);

  // Nieuwe poging zonder pool: een echte download is wel succes en sluit Backstage.
  await page.locator('.backstage-main input[type="checkbox"]').uncheck();
  await page.evaluate(() => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => { throw new DOMException('Download-terugval', 'SecurityError'); },
    });
  });
  const download = page.waitForEvent('download');
  await csv.click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.activeRibbonTab)).toBe('start');
});
