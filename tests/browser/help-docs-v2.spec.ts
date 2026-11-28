import { expect, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';
import type { Page, Route } from '@playwright/test';

const LONG_FILLER = Array.from({ length: 60 }, (_, i) => `Alinea ${i + 1} vult de pagina zodat er echt gescrold moet worden.`).join('\n\n');

const FIXTURE_ARTICLES: Record<string, string> = {
  'howto-fixture': `# Fixture how-to\n\nIntro.\n\n[Naar de verre kop](docs://uitleg-fixture#verre-kop)\n\n[Via het oude id](docs://gids-oud-fixture)\n\n${LONG_FILLER}\n`,
  'uitleg-fixture': `# Fixture uitleg\n\n${LONG_FILLER}\n\n## Verre kop\n\nHier landt het anker.\n\n${LONG_FILLER}\n`,
};

async function withFixtureManifest(page: Page): Promise<void> {
  await page.route('**/docs/manifest.json', async (route: Route) => {
    const response = await route.fetch();
    const manifest = await response.json() as { articles: unknown[]; aliases: Record<string, string> };
    manifest.articles.push(
      { id: 'howto-fixture', title: { nl: 'Fixture how-to', en: 'Fixture how-to' }, kind: 'howto' },
      { id: 'uitleg-fixture', title: { nl: 'Fixture uitleg', en: 'Fixture explanation' }, kind: 'uitleg', draft: true },
    );
    manifest.aliases = { ...manifest.aliases, 'gids-oud-fixture': 'howto-fixture' };
    await route.fulfill({ response, json: manifest });
  });
  for (const [id, body] of Object.entries(FIXTURE_ARTICLES)) {
    await page.route(`**/docs/*/${id}.md`, route => route.fulfill({ status: 200, contentType: 'text/markdown', body }));
  }
}

async function openHelp(page: Page): Promise<void> {
  await page.locator('.ribbon-tab--file').click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.locator('.help-panel')).toBeVisible();
}

const current = (page: Page) => page.locator('.help-article-body');

function tutorial(id: string, order: number, title: string) {
  return {
    id, kind: 'tutorial' as const, order,
    title: { nl: title, en: title },
    body: { nl: `# ${title}\n\nNederlandse tekst van ${title}.`, en: `# ${title}\n\nEnglish text of ${title}.` },
  };
}

test('tutorials uit het register: genummerde leerroute met Vorige/Volgende en bestaande gidsaliassen', async ({ page, ops: _ops }) => {
  const calendar = tutorial('tut-fixture-c', 3, 'Calendar');
  calendar.body = {
    nl: `${calendar.body.nl}\n\n[Instellingen](docs://ref-instellingen-lijst)\n\n[Nivelleringsopties](docs://ref-nivellering)`,
    en: `${calendar.body.en}\n\n[Settings](docs://ref-instellingen-lijst)\n\n[Leveling options](docs://ref-nivellering)`,
  };
  const registered = await page.evaluate((articles) => {
    const res = window.__OPS__!.help.registerArticles('fixture-tutorials', articles);
    return res.ok;
  }, [tutorial('tut-fixture-b', 2, 'Relations'), tutorial('tut-fixture-a', 1, 'First schedule'), calendar]);
  expect(registered).toBe(true);

  await openHelp(page);
  const section = page.locator('[data-help-section="kind-tutorial"]');
  await expect(section.locator('.help-toc-item')).toHaveText(['1.First schedule', '2.Relations', '3.Calendar']);

  await section.getByRole('button', { name: /First schedule/ }).click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'tut-fixture-a');
  await expect(page.locator('.help-tutorial-step')).toHaveText('Tutorial 1 of 3');
  const nav = page.locator('.help-tutorial-nav');
  await expect(nav.locator('[data-help-tutorial-nav="prev"]')).toHaveCount(0);

  await nav.locator('[data-help-tutorial-nav="next"]').click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'tut-fixture-b');
  await expect(current(page)).toContainText('English text of Relations.');
  await expect(page.locator('.help-tutorial-step')).toHaveText('Tutorial 2 of 3');

  await nav.locator('[data-help-tutorial-nav="next"]').click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'tut-fixture-c');
  await expect(nav.locator('[data-help-tutorial-nav="next"]')).toHaveCount(0);

  for (const lang of ['en', 'nl'] as const) {
    await page.locator('#help-docslang').selectOption(lang);
    for (const link of [
      { label: { en: 'Settings', nl: 'Instellingen' }, id: 'ref-instellingen',
        title: { en: 'App settings', nl: 'App-instellingen' }, text: { en: 'Duration display', nl: 'Duurweergave' } },
      { label: { en: 'Leveling options', nl: 'Nivelleringsopties' }, id: 'howto-overbezetting-oplossen',
        title: { en: 'Resolving overallocation', nl: 'Overbezetting oplossen' }, text: { en: '3. Leveling', nl: '3. Nivelleren' } },
    ]) {
      await current(page).getByRole('button', { name: link.label[lang], exact: true }).click();
      await expect(current(page)).toHaveAttribute('data-help-current', link.id);
      await expect(current(page)).toHaveAttribute('lang', lang);
      await expect(current(page).locator('h1')).toHaveText(link.title[lang]);
      await expect(current(page)).toContainText(link.text[lang]);
      await expect(nav).toHaveCount(0);
      await section.getByRole('button', { name: /Calendar/ }).click();
      await expect(current(page)).toHaveAttribute('data-help-current', 'tut-fixture-c');
      await expect(page.locator('.help-tutorial-step')).toHaveText('Tutorial 3 of 3');
    }
  }

  await page.locator('#help-docslang').selectOption('en');
  await nav.locator('[data-help-tutorial-nav="prev"]').click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'tut-fixture-b');

  await page.evaluate(() => window.__OPS__!.help.resetArticles());
  await expect(section.locator('.help-toc-item')).toHaveCount(0);
});

test('zonder geregistreerde tutorial wijst Help naar Extensies › Bladeren', async ({ page, ops: _ops }) => {
  await page.route('https://raw.githubusercontent.com/**', route =>
    route.fulfill({ status: 200, json: { version: '1', lastUpdated: '2026-09-28', extensions: [] } }));
  await openHelp(page);
  const section = page.locator('[data-help-section="kind-tutorial"]');
  await expect(section).toContainText('No tutorials are installed yet.');
  await section.getByRole('button', { name: 'Install tutorials' }).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.backstageSection)).toBe('extensions');
  await expect(page.locator('.ext-tab.active')).toHaveText('Browse');
});

test('dev toont drafts, aliassen openen het nieuwe artikel en zoeken vindt artikeltekst', async ({ page, ops: _ops }) => {
  await withFixtureManifest(page);
  await openHelp(page);

  const draftItem = page.locator('[data-help-article="uitleg-fixture"]');
  await expect(draftItem).toBeVisible();
  await expect(draftItem.locator('.help-toc-draft')).toHaveText('draft');
  await expect(page.locator('[data-help-section="kind-howto"] [data-help-article="howto-fixture"]')).toBeVisible();

  await page.locator('[data-help-article="howto-fixture"]').click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-fixture');
  await page.locator('[data-help-article="howto-relaties-leggen"]').click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-relaties-leggen');
  await page.locator('[data-help-article="howto-fixture"]').click();
  await current(page).getByRole('button', { name: 'Via het oude id' }).click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-fixture');

  await page.locator('[data-help-article="howto-relaties-leggen"]').click();
  await page.evaluate(() => window.__OPS__!.store.getState().notify({
    severity: 'info', messageKey: 'notifications.statusDateSetToday', params: { date: '1-1-2026' }, helpArticleId: 'gids-oud-fixture',
  }));
  await page.locator('.ops-toast').getByRole('button', { name: 'Read more' }).click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-fixture');
  await expect(page.locator('.help-toc-item.active')).toHaveAttribute('data-help-article', 'howto-fixture');

  await page.locator('.help-search').fill('hier landt het anker');
  await expect(page.locator('.help-toc-item')).toHaveCount(1);
  await expect(page.locator('.help-toc-item')).toHaveAttribute('data-help-article', 'uitleg-fixture');
});

test('docs://id#anker scrolt naar de kop; een gewone artikelwissel begint bovenaan; settings:// opent de instelling', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await withFixtureManifest(page);
  await openHelp(page);
  await page.locator('[data-help-article="howto-fixture"]').click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-fixture');

  const scroller = page.locator('.backstage-main');
  await current(page).getByRole('button', { name: 'Naar de verre kop' }).click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'uitleg-fixture');
  const heading = current(page).locator('[data-help-anchor="verre-kop"]');
  await expect(heading).toHaveAttribute('id', 'help-verre-kop');
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(200);
  const [headingTop, scrollerTop] = await Promise.all([
    heading.evaluate(el => el.getBoundingClientRect().top),
    scroller.evaluate(el => el.getBoundingClientRect().top),
  ]);
  expect(Math.abs(headingTop - scrollerTop)).toBeLessThan(40);

  await page.locator('[data-help-article="howto-fixture"]').click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-fixture');
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(0);

  await page.evaluate(() => window.__OPS__!.store.getState().openHelpArticle('ref-instellingen'));
  await expect(current(page)).toHaveAttribute('data-help-current', 'ref-instellingen');
  await current(page).locator('[data-help-setting="compressNonWorkdays"]').click();
  const setting = page.locator('.backstage-main [data-ops-setting="compressNonWorkdays"]');
  await expect(page.locator('.backstage-main [data-ops-settings-group="timeline"]')).toHaveAttribute('aria-current', 'page');
  await expect(setting).toHaveClass(/is-highlighted/);
  await expect(setting.getByRole('checkbox')).toBeFocused();
});

test('Prompt kopiëren zet het promptblok van het artikel letterlijk op het klembord, ook zonder klembord-API', async ({ page, context, ops: _ops }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openHelp(page);
  await page.locator('[data-help-article="howto-ai-assistent-koppelen"]').click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-ai-assistent-koppelen');

  const lang = await current(page).getAttribute('lang');
  const md = await page.evaluate(async (l) => (await fetch(`/docs/${l}/howto-ai-assistent-koppelen.md`)).text(), lang);
  const source = /^```prompt\n([\s\S]*?)\n```$/m.exec(md)?.[1];
  expect(source).toBeTruthy();

  const prompt = current(page).locator('[data-help-prompt]');
  const button = prompt.getByRole('button', { name: /^(Prompt kopiëren|Copy prompt)$/ });
  const status = prompt.getByRole('status');
  expect(await prompt.locator('pre').textContent()).toBe(source);
  await button.click();
  await expect(status).toHaveText(/^(Gekopieerd|Copied)\./);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(source);

  await page.evaluate(async () => {
    const w = window as Window & { __opsClipboard?: Clipboard };
    w.__opsClipboard = navigator.clipboard;
    await navigator.clipboard.writeText('');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
  await expect(status).toHaveText('', { timeout: 6000 });
  await button.click();
  await expect(status).toHaveText(/^(Gekopieerd|Copied)\./);
  await expect(button).toBeFocused();
  expect(await page.evaluate(() => (window as Window & { __opsClipboard?: Clipboard }).__opsClipboard!.readText())).toBe(source);
});

test('?-knop in de sneltoetsendialoog sluit de dialoog en opent het juiste artikel', async ({ page, ops: _ops }) => {
  await page.keyboard.press('Control+/');
  const dialog = page.locator('[data-ops-shortcuts-dialog]');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Help on this topic' }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.showShortcutsDialog)).toBe(false);
  await expect(page.locator('.help-panel')).toBeVisible();
  await expect(current(page)).toHaveAttribute('data-help-current', 'ref-sneltoetsen');
});

test('"Lees de gids" in Net bijgewerkt sluit eerst de dialoog', async ({ page, ops: _ops }) => {
  await page.route('https://api.github.com/repos/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ justUpdated: { from: '2026.8.0', to: '2026.8.1' } }));
  const dialog = page.locator('[data-ops-just-updated-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Read the guide' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.help-panel')).toBeVisible();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-mpp-openen');
});

test('een oud id uit een melding opent het nieuwe artikel (echte manifestalias)', async ({ page, ops: _ops }) => {
  await openHelp(page);
  await page.locator('[data-help-article="howto-relaties-leggen"]').click();
  await page.evaluate(() => window.__OPS__!.store.getState().notify({
    severity: 'info', messageKey: 'notifications.statusDateSetToday', params: { date: '1-1-2026' }, helpArticleId: 'gids-xer-import',
  }));
  await page.locator('.ops-toast').getByRole('button', { name: 'Read more' }).click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-xer-openen');
  await expect(current(page).locator('h1')).toHaveText('Opening a Primavera P6 file (.xer)');
  await expect(page.locator('[data-help-section]')).toHaveCount(4);
  await expect(page.locator('[data-help-article="quick-start"]')).toHaveCount(0);
});

test('UI in het Duits: een artikel buiten de de-index toont Engels met een melding, de taalkiezer kent alle talen', async ({ page, ops: _ops }) => {
  await page.route('**/docs/de/index.json', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ 'howto-relaties-leggen': { title: 'Beziehungen anlegen' } }),
  }));
  await page.route('**/docs/de/howto-relaties-leggen.md', route => route.fulfill({
    status: 200, contentType: 'text/markdown', body: '# Beziehungen anlegen\n\nVorgänge verknüpfen.\n',
  }));
  await page.evaluate(() => {
    localStorage.setItem('ops-locale', 'de');
    localStorage.setItem('ops-docs-locale', 'xx');
  });
  await page.reload();
  await waitForOps(page);
  await waitForWelcomeDialog(page);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));

  await page.locator('.ribbon-tab--file').click();
  await page.getByRole('button', { name: 'Hilfe', exact: true }).click();
  await expect(page.locator('.help-panel')).toBeVisible();
  await page.locator('[data-help-article="howto-relaties-leggen"]').click();
  await expect(current(page).locator('h1')).toHaveText('Beziehungen anlegen');
  await expect(current(page)).toHaveAttribute('lang', 'de');
  await expect(page.locator('[data-help-lang-fallback]')).toHaveCount(0);
  await page.locator('[data-help-article="uitleg-rekenprofielen"]').click();
  await expect(current(page).locator('h1')).toHaveText('Calculation profiles and conventions');
  await expect(current(page)).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-help-lang-fallback]')).toContainText(
    'Dieser Artikel ist noch nicht in Ihrer Sprache verfügbar. Sie lesen die englische Version.');
  const select = page.locator('#help-docslang');
  await expect(select.locator('option')).toHaveCount(29);
  await expect(select).toHaveValue('__auto__');
  expect(await page.evaluate(() => localStorage.getItem('ops-docs-locale'))).toBeNull();

  await select.selectOption('nl');
  await expect(current(page).locator('h1')).toHaveText('Rekenprofielen en conventies');
  await expect(page.locator('[data-help-lang-fallback]')).toHaveCount(0);

  await page.locator('.help-search').fill('andere datums opleveren');
  await expect(page.locator('[data-help-article="uitleg-rekenprofielen"]')).toBeVisible();
});
