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

// Naamkolom van de rapporttabel: de gebruiker zet "Taaknamen afkappen" uit en ziet de volledige
// naam; zet het weer aan en verstelt de slider, waarna de naam op de gekozen breedte afkapt.
test('report options: taaknamen afkappen en de naamkolom-slider sturen de tabel', async ({ page, ops: _ops }) => {
  const longName = 'Een bewust erg lange taaknaam die in de standaardkolom nooit past';
  await seedProject(page, [
    { name: longName, start: '2026-09-07', finish: '2026-10-16', durationDays: 30 },
  ], 'Naamkolom');
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const drawnText: string[] = [];
    CanvasRenderingContext2D.prototype.fillText = function fillText(text: string, x: number, y: number, maxWidth?: number) {
      drawnText.push(String(text));
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(window, '__opsReportDrawnText', { configurable: true, value: drawnText });
  });
  const drawn = () => page.evaluate(() => (
    (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText ?? []
  ));
  const clearDrawn = () => page.evaluate(() => {
    const d = (window as Window & { __opsReportDrawnText?: string[] }).__opsReportDrawnText;
    d?.splice(0, d.length);
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const preview = page.locator('[data-tour-anchor="report-panel"] img').first();
  await expect(preview).toHaveAttribute('src', /^blob:/, { timeout: 20_000 });

  // Standaard: afkappen aan op de standaardbreedte ⇒ de naam eindigt op een ellipsis.
  const truncate = page.locator('[data-ops-report-truncate-names]');
  await expect(truncate).toBeChecked();
  await expect.poll(drawn).toContainEqual(expect.stringMatching(/^Een bewust erg lange.*…$/));
  expect(await drawn()).not.toContain(longName);

  // Afkappen uit ⇒ de kolom groeit mee en de volledige naam wordt getekend.
  const srcBefore = await preview.getAttribute('src');
  await clearDrawn();
  await truncate.uncheck();
  await expect(page.locator('[data-ops-report-name-column-width]')).toHaveCount(0);
  await expect.poll(() => preview.getAttribute('src')).not.toBe(srcBefore);
  await expect.poll(drawn).toContain(longName);

  // Weer aan, slider naar het minimum ⇒ opnieuw afgekapt, en korter dan bij de standaardbreedte.
  const srcAuto = await preview.getAttribute('src');
  await clearDrawn();
  await truncate.check();
  const slider = page.locator('[data-ops-report-name-column-width]');
  await expect(slider).toBeVisible();
  await slider.fill(await slider.getAttribute('min') ?? '60');
  await expect.poll(() => preview.getAttribute('src')).not.toBe(srcAuto);
  await expect.poll(drawn).toContainEqual(expect.stringMatching(/^Een.*…$/));
  // Het aanvinken rendert eerst nog op de bewaarde breedte; de slider-render volgt daarna. De
  // kortste afgekapte variant is dus de uitkomst van het minimum.
  await expect.poll(async () => {
    const cut = (await drawn()).filter(t => t.endsWith('…') && longName.startsWith(t.slice(0, -1)));
    return cut.length ? Math.min(...cut.map(t => t.length)) : Number.POSITIVE_INFINITY;
  }).toBeLessThan('Een bewust erg lange'.length + 1);
  expect(await drawn()).not.toContain(longName);
});
