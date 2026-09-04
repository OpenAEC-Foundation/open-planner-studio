import { expect, test } from './fixtures/ops';
import type { Page } from '@playwright/test';

declare global {
  interface Window {
    openedReleaseUrls?: string[];
  }
}

async function selectLocale(page: Page, option: string, expectedLocale: string): Promise<void> {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settings = page.locator('.settings-dialog');
  await expect(settings).toBeVisible();
  await settings.locator('.settings-tab').nth(1).click();
  await settings.locator('button[aria-haspopup="listbox"]').click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(expectedLocale);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: false }));
}

test('update-highlights volgen de app-ready route en houden externe link open', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    window.openedReleaseUrls = [];
    window.open = ((url?: string | URL) => {
      window.openedReleaseUrls!.push(String(url));
      return window;
    }) as typeof window.open;
  });
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ justUpdated: { from: '2026.8.0', to: '2026.8.1' } }));
  const dialog = page.locator('[data-ops-just-updated-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('pre')).toHaveCount(0);
  await expect(dialog.locator('article')).toHaveCount(5);
  await expect(dialog.getByRole('button', { name: 'Read the guide' })).toHaveCount(1);
  await expect(dialog.locator('article').nth(0).getByRole('button', { name: 'Read the guide' })).toHaveCount(1);
  await expect(dialog.locator('article').nth(1).getByRole('button')).toHaveCount(0);
  await expect(dialog.locator('article').nth(2).getByRole('button')).toHaveCount(0);
  await expect(dialog.locator('article').nth(3).getByRole('button')).toHaveCount(0);
  await expect(dialog.locator('article').nth(4).getByRole('button')).toHaveCount(0);
  await page.getByText('See full release notes').click({ noWaitAfter: true });
  await expect.poll(() => page.evaluate(() => window.openedReleaseUrls ?? [])).toEqual(['https://github.com/OpenAEC-Foundation/open-planner-studio/wiki/Changelog']);
  await expect(dialog).toBeVisible();
  await page.evaluate(() => { window.open = (() => null) as typeof window.open; });
  await page.getByText('See full release notes').click({ noWaitAfter: true });
  await expect(dialog.getByRole('alert')).toHaveText('The release notes could not be opened.');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('update-highlights werken smal, licht/donker en RTL', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await selectLocale(page, 'NL — Nederlands', 'nl');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiTheme: 'light', justUpdated: { from: null, to: '2026.8.1' } }));
  const dialog = page.locator('[data-ops-just-updated-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Importeer met de datums uit je planning')).toBeVisible();
  await expect(dialog.getByText('RESOURCEBIBLIOTHEKEN', { exact: true })).toBeVisible();
  await expect(dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).resolves.toBe(true);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ justUpdated: null }));
  await expect(dialog).toHaveCount(0);
  await selectLocale(page, 'AR — العربية', 'ar');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiTheme: 'dark', justUpdated: { from: null, to: '2026.8.1' } }));
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('إشغال مكتبة الموارد')).toBeVisible();
  await expect(dialog.getByText('الموارد', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  await expect(dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).resolves.toBe(true);
});
