// Rapportkarakterisering: de gebruiker wijzigt de kop en een concrete tekenoptie, waarna zowel de
// levende preview als de echte PDF-export dezelfde actuele waarden moeten gebruiken.
import { expect, seedProject, test } from './fixtures/ops';

test('report options: preview en export gebruiken dezelfde actuele kop en legendaoptie', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    // Het CJK-teken dwingt de bestaande vector-export gecontroleerd naar zijn rasterfallback, zodat
    // dezelfde Canvas-tekengrens als de preview observeerbaar is zonder productcode te instrumenteren.
    { name: '施工 – rapporttaak', start: '2026-09-07', finish: '2026-10-16', durationDays: 30 },
  ], 'Rapportopties');
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const drawnText: string[] = [];
    CanvasRenderingContext2D.prototype.fillText = function fillText(
      text: string,
      x: number,
      y: number,
      maxWidth?: number,
    ) {
      drawnText.push(String(text));
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(window, '__opsReportDrawnText', {
      configurable: true,
      value: drawnText,
    });
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const preview = page.locator('[data-tour-anchor="report-panel"] img').first();
  // De preview gebruikt bewust revocable Blob-URL's: een dataURL hield grote base64-strings na
  // snelle her-renders onnodig in het geheugen. Dit contract test alleen dat er een verse PNG-
  // preview staat; de P1-performanceflow bewaakt apart dat vervangen URL's worden ingetrokken.
  await expect(preview).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });
  const previewBefore = await preview.getAttribute('src');

  const legend = page.getByLabel(/^(Legend|Legenda)$/);
  if (await legend.isChecked()) await legend.uncheck();
  await page.evaluate(() => {
    const drawn = (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText;
    drawn?.splice(0, drawn.length);
  });
  const companyName = `Actuele rapportkop ${Date.now()}`;
  await page.getByPlaceholder(/^(Company name|Bedrijfsnaam)$/).fill(companyName);

  await expect.poll(() => preview.getAttribute('src')).not.toBe(previewBefore);
  await expect.poll(() => page.evaluate((header) => (
    ((window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText ?? [])
      .some(text => text.includes(header))
  ), companyName)).toBe(true);
  const previewText = await page.evaluate(() => (
    (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText ?? []
  ));
  expect(previewText).not.toContain('Critical path');
  expect(previewText).not.toContain('Kritieke pad');

  await page.evaluate(() => {
    const drawn = (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText;
    drawn?.splice(0, drawn.length);
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  await expect.poll(() => page.evaluate((header) => (
    ((window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText ?? [])
      .some(text => text.includes(header))
  ), companyName)).toBe(true);
  const exportText = await page.evaluate(() => (
    (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText ?? []
  ));
  expect(exportText).not.toContain('Critical path');
  expect(exportText).not.toContain('Kritieke pad');
});
