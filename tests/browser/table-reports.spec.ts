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
  // Beide taken raken het 4-wekenvenster vanaf de statusdatum (14 sep – 11 okt): twee echte rijen
  // (op naam, niet op aantal — de lege-staat is óók één <tr>).
  const rows = report.locator('[data-ops-report-section="rows"] tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Fundering');
  await expect(rows.nth(1)).toContainText('Casco');
  // Samenvatting: "Activities 2" als label-waardepaar, niet een los cijfer ergens in het blok.
  await expect(report.locator('[data-ops-report-summary] > div').first()).toHaveText(/^(Activities|Activiteiten)2$/);

  // Venster naar 1 week: alleen de lopende taak (Fundering) blijft over; Casco valt eruit.
  await page.getByLabel(/^(Window \(weeks\):|Venster \(weken\):)$/).first().click();
  await page.getByRole('option', { name: /^1$/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Fundering');
  await expect(report).not.toContainText('Casco');

  // Review-bevinding 1: een export op een VEROUDERDE planning rekent eerst door én exporteert pas
  // ná de re-render — het rapport op het scherm draagt dan geen "planning gewijzigd"-melding meer
  // en de store staat niet meer op stale wanneer het bestand komt.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const casco = s.tasks.find(t => t.name === 'Casco')!;
    s.updateTask(casco.id, { time: { ...casco.time, scheduleDuration: 40 } });
  });
  await expect(report.locator('[role=note]')).toHaveCount(1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-look-ahead\.pdf$/);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  await expect(report.locator('[role=note]')).toHaveCount(0);
});
