import { expect, test } from './fixtures/ops';

test('bedieningssignalen: gewone controls wijzen, uitgeschakelde ribbonbediening weigert en presentatiehint noemt Esc', async ({ page, ops: _ops }) => {
  const startTab = page.locator('.ribbon-tab').first();
  await expect(startTab).toHaveCSS('cursor', 'pointer');

  // De aparte relatietab bestaat niet meer. De vaste relatie-dropdown op Planning toont zonder
  // selectie dezelfde native uitgeschakelde koppelactie en dus dezelfde niet-klikbare aanwijzing.
  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  // De tabwissel laat alleen kleuren overvloeien: een geanimeerde rand of marge gaf een kort
  // donker balkje onder de nieuwe tab en een sprong van 3px. En geen tab steekt onder de
  // titelbalk (z-index 40), ook de actieve en de Bestand-tab niet.
  await expect(page.locator('.ribbon-tab.active').filter({ hasText: /^Planning$/ })).toBeVisible();
  const tabTransitions = await page.evaluate(() => [...new Set([...document.querySelectorAll('.ribbon-tab')]
    .flatMap(t => getComputedStyle(t).transitionProperty.split(',').map(p => p.trim())))]);
  expect(tabTransitions.filter(p => p !== 'background-color' && p !== 'color')).toEqual([]);
  const tabTops = await page.evaluate(() => {
    const titleBottom = document.querySelector('.title-bar')!.getBoundingClientRect().bottom;
    return [...document.querySelectorAll('.ribbon-tab')].map(t => t.getBoundingClientRect().top - titleBottom);
  });
  expect(Math.min(...tabTops)).toBeGreaterThanOrEqual(0);
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

  // In de browser is F11 van de browser: de app start er geen presentatie mee (anders verdwijnt
  // het hele lint zodra iemand volledig scherm kiest). De presentatie start via de lintknop.
  await page.locator('.ribbon-tab').filter({ hasText: /^(Beeld|View)$/ }).click();
  await page.keyboard.press('F11');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.presentationMode)).toBe(false);
  await expect(startTab).toBeVisible();

  // De hint is vertaald en Escape verlaat dezelfde modus weer; de storebrug leest uitsluitend de
  // toestand terug.
  await page.getByRole('button', { name: /^(Presentation|Presentatie)$/ }).click();
  await expect(page.locator('text=/Esc.*F11|F11.*Esc/')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.presentationMode)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.presentationMode)).toBe(false);
});
