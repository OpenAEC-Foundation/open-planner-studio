import { expect, test } from './fixtures/ops';

test('bedieningssignalen: gewone controls wijzen, uitgeschakelde ribbonbediening weigert en presentatiehint noemt Esc', async ({ page, ops: _ops }) => {
  const startTab = page.locator('.ribbon-tab').first();
  await expect(startTab).toHaveCSS('cursor', 'pointer');

  // De aparte relatietab bestaat niet meer. De vaste relatie-dropdown op Planning toont zonder
  // selectie dezelfde native uitgeschakelde koppelactie en dus dezelfde niet-klikbare aanwijzing.
  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  await page.getByRole('button', { name: /^(Link|Relatie)$/ }).click();
  const nativeDisabled = page.getByRole('menuitem', { name: /Link selected tasks|Geselecteerde taken koppelen/ });
  await expect(nativeDisabled).toBeVisible();
  await expect(nativeDisabled).toHaveCSS('cursor', 'not-allowed');

  // Zoek via de echte tabs een bestaande custom ribboncontrol die via aria-disabled wordt
  // geblokkeerd; het is geen native `disabled`, maar mag evenmin een handcursor krijgen.
  for (const tab of await page.locator('.ribbon-tab').all()) {
    await tab.click();
    if (await page.locator('button.ribbon-btn[aria-disabled="true"]').count()) break;
  }
  const customDisabled = page.locator('button.ribbon-btn[aria-disabled="true"]').first();
  await expect(customDisabled).toBeVisible();
  await expect(customDisabled).toHaveCSS('cursor', 'not-allowed');

  // De presentatiehandeling zelf loopt via de echte F11-sneltoets. De hint is vertaald en Escape
  // verlaat dezelfde modus weer; de storebrug leest uitsluitend de toestand terug.
  await page.keyboard.press('F11');
  await expect(page.locator('text=/Esc.*F11|F11.*Esc/')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.presentationMode)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.presentationMode)).toBe(false);
});
