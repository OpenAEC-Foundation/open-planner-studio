import { expect, test } from './fixtures/ops';

test('update-highlights volgen de app-ready route en houden externe link open', async ({ page, ops: _ops }) => {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ justUpdated: { from: '2026.8.0', to: '2026.8.1' } }));
  const dialog = page.locator('[data-ops-just-updated-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('pre')).toHaveCount(0);
  await expect(dialog.locator('article')).toHaveCount(5);
  await page.getByText('See full release notes').click({ noWaitAfter: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('update-highlights werken smal, licht/donker en RTL', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiTheme: 'light', justUpdated: { from: null, to: '2026.8.1' } }));
  await expect(page.locator('[data-ops-just-updated-dialog]')).toBeVisible();
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; window.__OPS__!.store.getState().setUI({ uiTheme: 'dark' }); });
  await expect(page.locator('[data-ops-just-updated-dialog]')).toBeVisible();
});
