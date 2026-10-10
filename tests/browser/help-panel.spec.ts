import { expect, test } from './fixtures/ops';
import type { Page } from '@playwright/test';
import { LOCALES } from '../../src/i18n/locales';

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

// Vertaalstraat §10: elke UI-taal is een docstaal. Auto volgt de UI-taal; een taal zonder vertaling
// (hier ar: in de repo staat geen public/docs/ar/) leest Engels met een melding; een expliciete keuze wint.
test('Help volgt de UI-taal automatisch, behoudt een expliciete override en valt zonder vertaling terug op Engels', async ({ page, ops: _ops }) => {
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
    .resolves.toEqual(['__auto__', ...LOCALES]);

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

  // Na het wissen van de override volgt Help weer de interfacetaal; Arabisch heeft (in deze test)
  // geen vertaling, dus Engels met de melding in het Arabisch, in een RTL-interface.
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

// Vertaalstraat §10: een vertaald artikel staat in `public/docs/<taal>/index.json`. Fixture via
// `page.route` (geen echte vertaling nodig): een nep-ar-index met één artikel. Dat artikel loopt
// rechts-naar-links in het Arabisch; een artikel dat niet in de index staat, leest Engels,
// links-naar-rechts, met de melding — en wordt niet eerst in het Arabisch opgevraagd.
const AR_ID = 'howto-relaties-leggen';
const AR_TITLE = 'إضافة العلاقات';
const AR_BODY = `# ${AR_TITLE}\n\nالهدف: ربط المهام ببعضها.\n\n## متى تحتاج هذا\n\n- عندما تبدأ مهمة بعد أخرى.\n- عندما تحتاج إلى وقت انتظار.\n`;

test('Arabische vertaling uit de index: rtl in het Arabisch, Engelse terugval ltr met melding, geen fetch buiten de index', async ({ page, ops: _ops }) => {
  await page.evaluate(() => localStorage.removeItem('ops-docs-locale'));
  await page.route('**/docs/ar/index.json', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ [AR_ID]: { title: AR_TITLE } }),
  }));
  await page.route(`**/docs/ar/${AR_ID}.md`, route => route.fulfill({ status: 200, contentType: 'text/markdown', body: AR_BODY }));
  const arArticleRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (/\/docs\/ar\/[^/]+\.md$/.test(url.pathname)) arArticleRequests.push(url.pathname.split('/').pop()!);
  });

  await changeUiLocale(page, 'AR — العربية', 'ar');
  await page.locator('.ribbon-tab--file').click();
  await page.getByRole('button', { name: 'المساعدة', exact: true }).click();

  const panel = page.locator('.help-panel');
  const body = panel.locator('.help-article-body');
  const fallback = panel.locator('[data-help-lang-fallback]');
  await expect(panel).toBeVisible();

  // Het vertaalde artikel: Arabische tekst en titel, rtl, geen melding.
  await panel.locator(`[data-help-article="${AR_ID}"]`).click();
  await expect(body.locator('h1')).toHaveText(AR_TITLE);
  await expect(body).toHaveAttribute('dir', 'rtl');
  await expect(body).toHaveAttribute('lang', 'ar');
  expect(await body.evaluate(el => getComputedStyle(el).direction)).toBe('rtl');
  expect(await body.locator('li').first().evaluate(el => getComputedStyle(el).direction)).toBe('rtl');
  await expect(fallback).toHaveCount(0);
  const tocTitle = panel.locator(`[data-help-article="${AR_ID}"] .help-toc-title`);
  await expect(tocTitle).toHaveText(AR_TITLE);
  await expect(tocTitle).toHaveAttribute('dir', 'auto');
  await expect(tocTitle).toHaveAttribute('lang', 'ar');

  // Een artikel buiten de index: Engels, ltr, met de melding.
  await panel.locator('[data-help-article="howto-taken-en-mijlpalen-toevoegen"]').click();
  await expect(body.locator('h1')).toHaveText('Adding tasks and milestones');
  await expect(body).toHaveAttribute('dir', 'ltr');
  await expect(body).toHaveAttribute('lang', 'en');
  expect(await body.evaluate(el => getComputedStyle(el).direction)).toBe('ltr');
  await expect(fallback).toHaveText('التوثيق غير متوفر بلغتك بعد. أنت تقرأ النسخة الإنجليزية.');
  await expect(panel.locator('[data-help-article="howto-taken-en-mijlpalen-toevoegen"] .help-toc-title')).toHaveAttribute('lang', 'en');

  // Alleen het artikel uit de index is in het Arabisch opgevraagd.
  expect([...new Set(arArticleRequests)]).toEqual([`${AR_ID}.md`]);
});
