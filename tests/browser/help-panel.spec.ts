import { expect, test } from './fixtures/ops';
import type { Page } from '@playwright/test';

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

// Ontwerp gebruikersdocumentatie §6.2 (fase 4): de docs bestaan alleen in nl en en. Auto volgt de
// UI-taal; een UI-taal zonder docs leest Engels met een melding; een expliciete keuze wint.
test('Help volgt de UI-taal automatisch, behoudt een expliciete override en valt voor andere talen terug op Engels', async ({ page, ops: _ops }) => {
  await page.evaluate(() => localStorage.removeItem('ops-docs-locale'));

  // Echte route: Bestand → Help. De bridge opent geen Help-paneel en vervangt dus niet de geteste handeling.
  await page.locator('.ribbon-tab--file').click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();

  const panel = page.locator('.help-panel');
  const docsLanguage = panel.locator('#help-docslang');
  const heading = panel.locator('.help-article-body h1');
  const fallback = panel.locator('[data-help-lang-fallback]');
  await expect(panel).toBeVisible();
  await expect(heading).toHaveText('Adding relations');
  await expect(fallback).toHaveCount(0);
  await expect(docsLanguage).toHaveValue('__auto__');
  await expect(docsLanguage.locator('option').evaluateAll(options => options.map(option => option.getAttribute('value'))))
    .resolves.toEqual(['__auto__', 'nl', 'en']);

  // De UI-taal wordt via de bestaande instellingenbediening gewijzigd; Auto moet de docs meteen
  // laten meebewegen naar de Nederlandse tekst.
  await changeUiLocale(page, 'NL — Nederlands', 'nl');
  await expect(heading).toHaveText('Relaties leggen');
  await expect(docsLanguage).toHaveValue('__auto__');

  // Een expliciete keuze wint vervolgens van de UI-taal en blijft dat ook wanneer die wisselt.
  await docsLanguage.selectOption('en');
  await expect(heading).toHaveText('Adding relations');
  await changeUiLocale(page, 'AR — العربية', 'ar');
  await expect(heading).toHaveText('Adding relations');
  await expect(fallback).toHaveCount(0);

  // Na het wissen van de override volgt Help weer de interfacetaal; Arabisch heeft geen docs, dus
  // Engels met de melding in het Arabisch, in een RTL-interface.
  await docsLanguage.selectOption('__auto__');
  await expect(heading).toHaveText('Adding relations');
  await expect(fallback).toHaveText('التوثيق غير متوفر بلغتك بعد. أنت تقرأ النسخة الإنجليزية.');
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl');

  // De Engelse tekst blijft links-naar-rechts in de RTL-interface (anders springen leestekens naar
  // het verkeerde eind); de taalmelding volgt de interface.
  const direction = (selector: string) => page.locator(selector).first().evaluate(el => getComputedStyle(el).direction);
  expect(await direction('.help-article-body')).toBe('ltr');
  expect(await direction('.help-article-body li')).toBe('ltr');
  const align = (selector: string) => page.locator(selector).first().evaluate(el => getComputedStyle(el).textAlign);
  expect(['left', 'start']).toContain(await align('.help-article-body p'));
  await expect(panel.locator('.help-article-body')).toHaveAttribute('lang', 'en');
  expect(await direction('.help-toc-title')).toBe('ltr');
  expect(await direction('[data-help-lang-fallback]')).toBe('rtl');
});
