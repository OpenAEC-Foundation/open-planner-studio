import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

async function pushError(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__OPS__!.store.getState().notify({ severity: 'error', messageKey: 'notifications.librarySaveFailed' });
  });
}

test('klik op de melding sluit hem niet; het kruisje wel', async ({ page, ops: _ops }) => {
  await pushError(page);
  const toast = page.locator('.ops-toast', { hasText: 'Library could not be saved' });
  await expect(toast).toBeVisible();

  await toast.locator('.ops-toast-message').click();
  await page.waitForTimeout(300);
  await expect(toast).toBeVisible();

  const close = toast.getByRole('button', { name: 'Close notification' });
  await expect(close).toBeVisible();
  await close.click();
  await expect(toast).toHaveCount(0);
});

test('het kruisje werkt met het toetsenbord', async ({ page, ops: _ops }) => {
  await pushError(page);
  const toast = page.locator('.ops-toast', { hasText: 'Library could not be saved' });
  await toast.locator('[data-ops-toast-close]').focus();
  await page.keyboard.press('Enter');
  await expect(toast).toHaveCount(0);
});

test('een info verdwijnt vanzelf, ook zonder klik', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    window.__OPS__!.store.getState().notify({ severity: 'info', messageKey: 'notifications.librarySaveFailed', durationMs: 600 });
  });
  const toast = page.locator('.ops-toast', { hasText: 'Library could not be saved' });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCount(0, { timeout: 5000 });
});

test('in RTL staat het kruisje links, in LTR rechts', async ({ page, ops: _ops }) => {
  await pushError(page);
  const toast = page.locator('.ops-toast', { hasText: 'Library could not be saved' });
  const close = toast.locator('[data-ops-toast-close]');
  const side = async () => {
    const t = (await toast.boundingBox())!;
    const c = (await close.boundingBox())!;
    return c.x + c.width / 2 > t.x + t.width / 2 ? 'right' : 'left';
  };
  expect(await side()).toBe('right');
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  await expect.poll(side).toBe('left');
});
