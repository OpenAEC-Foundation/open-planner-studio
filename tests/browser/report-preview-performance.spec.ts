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
  });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const preview = page.locator('[data-tour-anchor="report-panel"] img').first();
  await expect(preview).toHaveAttribute('src', /^data:image\/png/, { timeout: 20_000 });
  const previewZoom = page.getByLabel(/^(Preview size|Previewgrootte)$/);
  await expect(previewZoom).toHaveText(/Readable \(125%\)|Leesbaar \(125%\)/);
  const previewPage = page.locator('[data-preview-page]').first();
  await expect(previewPage).toHaveCSS('width', '1125px');
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

  // Deze keuze is puur voor lezen op het scherm: Passend behoudt de oude 900px-grens, Detail
  // wordt breder dan de kolom en activeert dus diens bestaande horizontale scrollbar.
  await previewZoom.click();
  await page.getByRole('option', { name: /^(Fit|Passend)$/ }).click();
  await expect(previewPage).toHaveCSS('width', '900px');
  await previewZoom.click();
  await page.getByRole('option', { name: /^(Detail \(200%\)|Detail \(200%\))$/ }).click();
  await expect(previewPage).toHaveCSS('width', '1800px');
  const overflow = await page.locator('[data-report-preview-viewport]').evaluate(node => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').previewZoom)).toBe('200');
});
