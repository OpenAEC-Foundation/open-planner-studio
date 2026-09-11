import { expect, test } from './fixtures/ops';
import type { Page } from '@playwright/test';

const DOC_LOCALES = ['nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa'];

async function changeUiLocale(page: Page, option: string, expectedLocale: string): Promise<void> {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settings = page.locator('.settings-dialog');
  await expect(settings).toBeVisible();
  // Taal zit sinds U1 op de Weergave-tab (tab 0, standaard al actief) samen met andere Selects,
  // dus scopen op de aria-label i.p.v. de eerste listbox-knop op de tab.
  await settings.locator('.settings-tab').nth(0).click();
  await settings.getByRole('button', { name: /^(Language|Taal)$/, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(expectedLocale);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: false }));
}

test('Help volgt de UI-taal automatisch, behoudt een expliciete override en biedt alle 14 talen', async ({ page, ops: _ops }) => {
  await page.evaluate(() => localStorage.removeItem('ops-docs-locale'));

  // Echte route: Bestand → Help. De bridge opent geen Help-paneel en vervangt dus niet de geteste handeling.
  await page.locator('.ribbon-tab--file').click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();

  const panel = page.locator('.help-panel');
  const docsLanguage = panel.locator('#help-docslang');
  const article = panel.locator('.help-article-body');
  await expect(panel).toBeVisible();
  await expect(article).toContainText('Your first schedule in 10 minutes');
  await expect(docsLanguage).toHaveValue('__auto__');
  await expect(docsLanguage.locator('option')).toHaveCount(DOC_LOCALES.length + 1);
  await expect(docsLanguage.locator('option').evaluateAll(options => options.map(option => option.getAttribute('value'))))
    .resolves.toEqual(['__auto__', ...DOC_LOCALES]);

  // De UI-taal wordt via de bestaande instellingenbediening gewijzigd; Auto moet de docs meteen
  // laten meebewegen naar de Nederlandse bron.
  await changeUiLocale(page, 'NL — Nederlands', 'nl');
  await expect(article).toContainText('Je eerste planning in 10 minuten');
  await expect(docsLanguage).toHaveValue('__auto__');

  // Een expliciete keuze wint vervolgens van de UI-taal en blijft dat ook wanneer die wisselt.
  await docsLanguage.selectOption('en');
  await expect(article).toContainText('Your first schedule in 10 minutes');
  await changeUiLocale(page, 'AR — العربية', 'ar');
  await expect(article).toContainText('Your first schedule in 10 minutes');

  // Na het wissen van de override volgt Help weer de (RTL-)interfacetaal.
  await docsLanguage.selectOption('__auto__');
  await expect(article).toContainText('أول جدول لك في 10 دقائق');
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl');
});
