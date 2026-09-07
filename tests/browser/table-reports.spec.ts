// Tabelrapporten (discussie #31): de gebruiker kiest een rapporttype in het Rapport-tabblad en
// krijgt een gerenderde tabel met samenvatting; een optiewijziging ververst het rapport live en de
// PDF-export levert een bestand met het rapport-eigen suffix. De rekenkant wordt headless bewaakt
// (tests/planning/check-reports.ts); hier alleen de echte gebruikersflow door de DOM.
import { expect, seedProject, test } from './fixtures/ops';

test('table reports: rapporttype kiezen rendert tabel, optie ververst live, PDF-export gebruikt eigen suffix', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Casco', start: '2026-09-21', finish: '2026-10-16', durationDays: 20 },
  ], 'Tabelrapporten');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setStatusDate('2026-09-14');
    s.runCPM();
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const typePicker = page.getByLabel(/^(Report type|Rapporttype)$/).first();
  await typePicker.click();
  await page.getByRole('option', { name: /^Look-ahead$/ }).click();

  const report = page.locator('[data-ops-table-report="look-ahead"]');
  await expect(report).toBeVisible();
  // Beide taken raken het 4-wekenvenster vanaf de statusdatum (14 sep – 11 okt).
  await expect(report.locator('[data-ops-report-section="rows"] tbody tr')).toHaveCount(2);
  await expect(report.locator('[data-ops-report-summary]')).toContainText(/2/);

  // Venster naar 1 week: alleen de lopende taak (Fundering) blijft over.
  await page.getByLabel(/^(Window \(weeks\):|Venster \(weken\):)$/).first().click();
  await page.getByRole('option', { name: /^1$/ }).click();
  await expect(report.locator('[data-ops-report-section="rows"] tbody tr')).toHaveCount(1);
  await expect(report).toContainText('Fundering');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-look-ahead\.pdf$/);
});
