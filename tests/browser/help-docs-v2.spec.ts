import { expect, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';
import type { Page, Route } from '@playwright/test';

// Help-viewer met manifest v2 (ontwerp gebruikersdocumentatie §6/§8, bijgesteld 2026-09-28):
// tutorials uit het register (straks een extensie), draft/alias/anker in het manifest, de ?-knop in
// een dialoog en "Lees de gids" in Net bijgewerkt.
//
// Fixtures: het manifest en een paar artikelen worden via `page.route` aangevuld (een draft en een
// fixture-alias; sinds fase 4 heeft het echte manifest geen drafts meer), en tutorials worden via de
// dev-brug geregistreerd zoals de tutorialextensie dat doet. Alle geteste handelingen zijn echte klikken en toetsen.
// "Draft verborgen in productie" is hier niet te zien — de testserver draait Vite-dev; dat gedrag
// bewijst tests/planning/check-help-manifest.ts op dezelfde filterfunctie.

const LONG_FILLER = Array.from({ length: 60 }, (_, i) => `Alinea ${i + 1} vult de pagina zodat er echt gescrold moet worden.`).join('\n\n');

const FIXTURE_ARTICLES: Record<string, string> = {
  'howto-fixture': `# Fixture how-to\n\nIntro.\n\n[Naar de verre kop](docs://uitleg-fixture#verre-kop)\n\n[Via het oude id](docs://gids-oud-fixture)\n\n${LONG_FILLER}\n`,
  // Ook ná de kop genoeg tekst, anders kan de container niet ver genoeg scrollen om de kop bovenaan te zetten.
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

test('tutorials uit het register: genummerde leerroute met Vorige/Volgende', async ({ page, ops: _ops }) => {
  const registered = await page.evaluate((articles) => {
    const res = window.__OPS__!.help.registerArticles('fixture-tutorials', articles);
    return res.ok;
  }, [tutorial('tut-fixture-b', 2, 'Relations'), tutorial('tut-fixture-a', 1, 'First schedule'), tutorial('tut-fixture-c', 3, 'Calendar')]);
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

  // Dev-build: de draft staat erin, met label.
  const draftItem = page.locator('[data-help-article="uitleg-fixture"]');
  await expect(draftItem).toBeVisible();
  await expect(draftItem.locator('.help-toc-draft')).toHaveText('draft');
  await expect(page.locator('[data-help-section="kind-howto"] [data-help-article="howto-fixture"]')).toBeVisible();

  // docs:// naar een oud id (alias) opent het nieuwe artikel.
  await page.locator('[data-help-article="howto-fixture"]').click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-fixture');
  await page.locator('[data-help-article="howto-relaties-leggen"]').click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-relaties-leggen');
  await page.locator('[data-help-article="howto-fixture"]').click();
  await current(page).getByRole('button', { name: 'Via het oude id' }).click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-fixture');

  // "Lees meer" in een melding met het oude id (fixture: de melding; de klik is echt).
  await page.locator('[data-help-article="howto-relaties-leggen"]').click();
  await page.evaluate(() => window.__OPS__!.store.getState().notify({
    severity: 'info', messageKey: 'notifications.statusDateSetToday', params: { date: '1-1-2026' }, helpArticleId: 'gids-oud-fixture',
  }));
  await page.locator('.ops-toast').getByRole('button', { name: 'Read more' }).click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-fixture');
  await expect(page.locator('.help-toc-item.active')).toHaveAttribute('data-help-article', 'howto-fixture');

  // Zoeken vindt tekst die alleen in de body staat (niet in titel of kop).
  await page.locator('.help-search').fill('hier landt het anker');
  await expect(page.locator('.help-toc-item')).toHaveCount(1);
  await expect(page.locator('.help-toc-item')).toHaveAttribute('data-help-article', 'uitleg-fixture');
});

test('docs://id#anker scrolt naar de kop; een gewone artikelwissel begint bovenaan', async ({ page, ops: _ops }) => {
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

  // Zonder fragment: terug naar boven.
  await page.locator('[data-help-article="howto-fixture"]').click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-fixture');
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(0);
});

test('?-knop in de sneltoetsendialoog sluit de dialoog en opent het juiste artikel', async ({ page, ops: _ops }) => {
  // Echte route: de sneltoets Ctrl+/ (registry `view.showShortcuts`).
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
  // Zelfde stub als just-updated-dialog.spec.ts: de releasevergelijking wordt hier niet getoetst.
  await page.route('https://api.github.com/repos/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ justUpdated: { from: '2026.8.0', to: '2026.8.1' } }));
  const dialog = page.locator('[data-ops-just-updated-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Read the guide' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.help-panel')).toBeVisible();
  // De release-hoogtepunten van 2026.8.1 noemen het oude id `gids-msproject-import`; de alias opent
  // het artikel dat het verving.
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-mpp-openen');
});

// Fase 4 (omschakelen): de oude id's van vóór de herschrijving staan als alias in het echte manifest.
// Uitgeleverde versies sturen hun "Lees meer" nog naar zo'n oud id. Geen fixture-manifest hier.
test('een oud id uit een melding opent het nieuwe artikel (echte manifestalias)', async ({ page, ops: _ops }) => {
  await openHelp(page);
  await page.locator('[data-help-article="howto-relaties-leggen"]').click();
  await page.evaluate(() => window.__OPS__!.store.getState().notify({
    severity: 'info', messageKey: 'notifications.statusDateSetToday', params: { date: '1-1-2026' }, helpArticleId: 'gids-xer-import',
  }));
  await page.locator('.ops-toast').getByRole('button', { name: 'Read more' }).click();
  await expect(current(page)).toHaveAttribute('data-help-current', 'howto-xer-openen');
  await expect(current(page).locator('h1')).toHaveText('Opening a Primavera P6 file (.xer)');
  // Geen oude secties meer: alleen Tutorials · How-to · Uitleg · Referentie.
  await expect(page.locator('[data-help-section]')).toHaveCount(4);
  await expect(page.locator('[data-help-article="quick-start"]')).toHaveCount(0);
});

// Ontwerp §6.2: de docs bestaan alleen in nl en en. Een andere UI-taal leest Engels met een melding;
// de taalkiezer biedt Auto / Nederlands / English, en een bewaarde oude keuze (de) valt terug op Auto.
test('UI in het Duits: Help toont Engels met een melding, de taalkiezer kent alleen nl en en', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    localStorage.setItem('ops-locale', 'de');
    localStorage.setItem('ops-docs-locale', 'de');
  });
  await page.reload();
  await waitForOps(page);
  await waitForWelcomeDialog(page);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));

  await page.locator('.ribbon-tab--file').click();
  await page.getByRole('button', { name: 'Hilfe', exact: true }).click();
  await expect(page.locator('.help-panel')).toBeVisible();
  await expect(page.locator('[data-help-lang-fallback]')).toHaveText(
    'Die Dokumentation ist noch nicht in Ihrer Sprache verfügbar. Sie lesen die englische Version.');
  await page.locator('[data-help-article="uitleg-kritiek-pad"]').click();
  await expect(current(page).locator('h1')).toHaveText('Critical path and float');
  const select = page.locator('#help-docslang');
  await expect(select.locator('option')).toHaveCount(3);
  await expect(select).toHaveValue('__auto__');
  expect(await page.evaluate(() => localStorage.getItem('ops-docs-locale'))).toBeNull();

  // Zelf Nederlands kiezen: Nederlandse tekst, geen melding meer.
  await select.selectOption('nl');
  await expect(current(page).locator('h1')).toHaveText('Kritiek pad en speling');
  await expect(page.locator('[data-help-lang-fallback]')).toHaveCount(0);

  // Zoeken werkt op de tekst in de gekozen docstaal.
  await page.locator('.help-search').fill('interfererende speling');
  await expect(page.locator('[data-help-article="uitleg-kritiek-pad"]')).toBeVisible();
});
