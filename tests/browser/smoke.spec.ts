import { expect, test } from '@playwright/test';

test('de ontwikkelapp start met de zelftestbrug', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root > div')).toBeVisible();
  await expect.poll(() => page.evaluate(() => '__OPS__' in window)).toBe(true);
});
