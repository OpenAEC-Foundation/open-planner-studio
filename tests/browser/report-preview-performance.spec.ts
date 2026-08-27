import { expect, seedProject, test } from './fixtures/ops';

test('rapportpreview bundelt snelle kopwijzigingen en rastert niet blind alle pagina’s', async ({ page, ops: _ops }) => {
  await seedProject(page, Array.from({ length: 140 }, (_, i) => ({
    name: `Taak ${i + 1}`,
    start: `2026-01-${String(1 + (i % 20)).padStart(2, '0')}`,
    finish: `2026-03-${String(1 + (i % 20)).padStart(2, '0')}`,
    durationDays: 20,
  })), 'Grote rapportpreview');
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toDataURL;
    let calls = 0;
    HTMLCanvasElement.prototype.toDataURL = function tracked(...args) {
      calls++;
      return original.apply(this, args);
    };
    Object.defineProperty(window, '__opsPreviewDataUrls', { configurable: true, get: () => calls });
    localStorage.setItem('ops-reportSettings', JSON.stringify({ previewZoom: '200' }));
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const preview = page.locator('[data-tour-anchor="report-panel"] img').first();
  await expect(preview).toHaveAttribute('src', /^data:image\/png/, { timeout: 20_000 });
  const previewQuality = page.getByLabel(/^(Preview quality|Previewkwaliteit)$/);
  await expect(previewQuality).toHaveText(/High \(200%\)|Hoog \(200%\)/);
  const previewPage = page.locator('[data-preview-page]').first();
  await expect(previewPage).toHaveCSS('width', '900px');
  const density = await preview.evaluate(image => {
    if (!(image instanceof HTMLImageElement)) throw new Error('preview is geen afbeelding');
    return { naturalWidth: image.naturalWidth, cssWidth: image.getBoundingClientRect().width };
  });
  expect(density.naturalWidth).toBeGreaterThanOrEqual(density.cssWidth * 1.4);
  const initialCalls = await page.evaluate(() => (
    (window as unknown as Window & { __opsPreviewDataUrls: number }).__opsPreviewDataUrls
  ));
  expect(initialCalls).toBeLessThanOrEqual(3);

  const field = page.getByPlaceholder(/^(Company name|Bedrijfsnaam)$/);
  const before = await preview.getAttribute('src');
  await field.fill('A');
  await field.fill('AB');
  await field.fill('ABC');
  await expect.poll(() => preview.getAttribute('src')).not.toBe(before);
  const afterCalls = await page.evaluate(() => (
    (window as unknown as Window & { __opsPreviewDataUrls: number }).__opsPreviewDataUrls
  ));
  expect(afterCalls - initialCalls).toBeLessThanOrEqual(3);

});

test('previewkwaliteit verhoogt rasterdichtheid zonder de papierschaal te wijzigen', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Scherpe detailtaak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Tweede detailtaak', start: '2026-09-21', finish: '2026-10-02', durationDays: 10 },
  ], 'Kwaliteit preview');
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const preview = page.locator('[data-tour-anchor="report-panel"] img').first();
  await expect(preview).toHaveAttribute('src', /^data:image\/png/, { timeout: 20_000 });
  const quality = page.getByLabel(/^(Preview quality|Previewkwaliteit)$/);
  const paper = page.locator('[data-preview-page]').first();
  await expect(quality).toHaveText(/High \(200%\)|Hoog \(200%\)/);
  await expect(paper).toHaveCSS('width', '900px');
  const high = await preview.evaluate(image => image instanceof HTMLImageElement ? image.naturalWidth : 0);
  expect(high).toBeGreaterThanOrEqual(900);
  const highSrc = await preview.getAttribute('src');

  await quality.click();
  await page.getByRole('option', { name: /^(Standard \(100%\)|Standaard \(100%\))$/ }).click();
  await expect(paper).toHaveCSS('width', '900px');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').previewQuality)).toBe('100');
  await expect(quality).toHaveText(/Standard \(100%\)|Standaard \(100%\)/);
  await expect.poll(() => preview.getAttribute('src')).not.toBe(highSrc);
  const standardSrc = await preview.getAttribute('src');
  const standard = await preview.evaluate(image => image instanceof HTMLImageElement ? image.naturalWidth : 0);
  // De browser kan met een hogere DPR draaien. De pure contracttest bewijst de
  // exacte 1×/2×/3× berekening; hier toetsen we de zichtbare, niet-dalende
  // rasterdichtheid en dat een kwaliteitswissel echt een nieuw beeld oplevert.
  expect(standard).toBeLessThanOrEqual(high);
  const standardImageSrc = standardSrc;

  await quality.click();
  await page.getByRole('option', { name: /^(Maximum \(300%\)|Maximaal \(300%\))$/ }).click();
  await expect(paper).toHaveCSS('width', '900px');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').previewQuality)).toBe('300');
  await expect.poll(() => preview.getAttribute('src')).not.toBe(standardImageSrc);
  const maximum = await preview.evaluate(image => image instanceof HTMLImageElement ? image.naturalWidth : 0);
  expect(maximum).toBeGreaterThanOrEqual(high);
  const overflow = await page.locator('[data-report-preview-viewport]').evaluate(node => node.scrollWidth - node.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').previewQuality)).toBe('300');
});
