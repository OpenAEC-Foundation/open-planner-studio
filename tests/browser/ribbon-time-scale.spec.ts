import { expect, test } from './fixtures/ops';

test('tijdschaal: reset en passend op project staan naast de zoomknoppen', async ({ page, ops: _ops }) => {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'beeld' }));

  const zoomIn = page.getByRole('button', { name: /^(Zoom in|Inzoomen)/ });
  const zoomOut = page.getByRole('button', { name: /^(Zoom out|Uitzoomen)/ });
  const reset = page.getByRole('button', { name: /Default zoom|Standaard zoom/ });
  const fit = page.getByRole('button', { name: /Fit to project|Passend maken op project/ });
  const group = fit.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ribbon-group ")][1]');

  await expect(group).toBeVisible();
  const [zoomInBox, zoomOutBox, resetBox, fitBox, labelBox] = await Promise.all([
    zoomIn.boundingBox(), zoomOut.boundingBox(), reset.boundingBox(), fit.boundingBox(),
    group.locator('.ribbon-group-label').boundingBox(),
  ]);
  expect(zoomInBox).not.toBeNull();
  expect(zoomOutBox).not.toBeNull();
  expect(resetBox).not.toBeNull();
  expect(fitBox).not.toBeNull();
  expect(labelBox).not.toBeNull();

  expect(zoomInBox!.x).toBeLessThan(resetBox!.x);
  expect(Math.abs(zoomInBox!.x - zoomOutBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(resetBox!.x - fitBox!.x)).toBeLessThanOrEqual(1);
  expect(labelBox!.y).toBeGreaterThan(Math.max(zoomOutBox!.y + zoomOutBox!.height, fitBox!.y + fitBox!.height));
});
