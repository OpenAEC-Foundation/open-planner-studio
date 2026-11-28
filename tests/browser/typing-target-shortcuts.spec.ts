import { expect, test } from './fixtures/ops';

const zoom = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__OPS__!.store.getState().view.zoom);

test('zoomtoetsen worden genegeerd met de focus op een native keuzelijst', async ({ page, ops: _ops }) => {
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const start = await zoom(page);
  await page.keyboard.press('-');
  await expect.poll(() => zoom(page)).toBeLessThan(start);

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showFilterDialog: true }));
  const select = page.getByRole('dialog').locator('select').first();
  await select.focus();
  const before = await zoom(page);
  for (const key of ['-', '+', '=', '0']) await page.keyboard.press(key);
  expect(await zoom(page)).toBe(before);
});
