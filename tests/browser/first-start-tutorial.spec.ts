import { expect, test, waitForOps } from './fixtures/ops';
import type { Page } from '@playwright/test';

// Eerste-startervaring, vervolg (eigenaarsbesluit 2026-09-28): na een VOLTOOIDE rondleiding vraagt de
// app eenmalig of je met een tutorial je eerste planning wilt maken. Alles wat de gebruiker doet —
// welkomstdialoog, rondleiding tot het eind, Overslaan, Escape, Ja/Nee — gaat via echte klikken en
// toetsen, vanaf een lege opslag en een echte herlaad. De dev-brug installeert alleen de
// testextensie (fixture) en leest state. De catalogus wordt onderschept: geen netwerk.

const CATALOG = 'https://raw.githubusercontent.com/**';

async function catalogUnavailable(page: Page): Promise<void> {
  await page.route(CATALOG, route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }));
}

/** Lege instellingen en een echte herlaad: de welkomstdialoog komt vanzelf (eerste start). */
async function freshStart(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForOps(page);
  await expect(page.locator('[data-ops-welcome-dialog]')).toBeVisible();
}

async function startTourFromWelcome(page: Page): Promise<void> {
  const welcome = page.locator('[data-ops-welcome-dialog]');
  await welcome.getByRole('button', { name: /^(Next|Volgende)$/ }).click();
  await welcome.getByRole('button', { name: /^(Start tour|Rondleiding starten)$/ }).click();
  await expect(welcome).toHaveCount(0);
  await expect(page.locator('[data-ops-tour-card]')).toBeVisible();
}

const tourStep = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui.tourStepIndex);

/** Volgende tot de laatste stap, en daar de afsluitknop — elke klik een echte klik. */
async function completeTour(page: Page): Promise<void> {
  const card = page.locator('[data-ops-tour-card]');
  const primary = card.locator('.btn--primary');
  for (let i = 0; i < 12; i++) {
    const label = (await primary.textContent())?.trim() ?? '';
    if (/^(Close|Sluiten)$/.test(label)) {
      await primary.click();
      await expect(card).toHaveCount(0);
      return;
    }
    const before = await tourStep(page);
    await primary.click();
    await expect.poll(() => tourStep(page)).not.toBe(before);
  }
  throw new Error('de rondleiding bereikte geen laatste stap');
}

const offer = (page: Page) => page.locator('[data-ops-tutorial-offer]');
const answered = (page: Page) => page.evaluate(() => localStorage.getItem('ops-tutorialOfferAnswered'));

test('voltooide rondleiding → tutorialvraag; Ja met een geïnstalleerde tutorials-extensie start tutorial 1', async ({ page, ops: _ops }) => {
  await catalogUnavailable(page);
  // Fixture: een extensie met het catalogus-id `tutorials` die luistert op host:tutorial-requested.
  await page.evaluate(async () => {
    await window.__OPS__!.extensions.installFromCode({
      id: 'tutorials', name: 'Tutorials', version: '1.0.0', apiVersion: '1.4', minAppVersion: '0.0.0',
      author: 'Browserfixture', description: '', category: 'Other', main: 'main.js', permissions: ['help', 'events'],
    }, `
      const sdk = require('open-planner-studio');
      module.exports = { onLoad(api) {
        api.help.registerArticles([{ id: 'tut-1-eerste-planning', kind: 'tutorial', order: 1,
          title: { nl: 'Je eerste planning', en: 'Your first schedule' }, body: { nl: '# Tutorial', en: '# Tutorial' } }]);
        api.events.on(sdk.hostEvents.tutorialRequested, (d) => {
          if (!d || d.extensionId !== 'tutorials') return;
          api.help.startGuide({ id: d.tutorialId, title: { nl: 'Je eerste planning', en: 'Your first schedule' },
            steps: [{ id: 'eerste', body: { nl: 'Klik op Nieuw.', en: 'Click New.' } }] });
        });
      } };`);
  });
  await freshStart(page);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().installedExtensions.tutorials?.status)).toBe('enabled');

  await startTourFromWelcome(page);
  await completeTour(page);

  await expect(offer(page)).toBeVisible();
  await offer(page).getByRole('button', { name: /^(Yes|Ja)$/ }).click();

  await expect(offer(page)).toHaveCount(0);
  await expect(page.locator('[data-ops-guide-panel="tut-1-eerste-planning"]')).toBeVisible();
  expect(await answered(page)).toBe('true');
});

test('Ja zonder extensie en zonder catalogus → Help › Tutorials met een melding', async ({ page, ops }) => {
  // De onderschepte catalogus antwoordt 404; de browser logt dat als resourcefout. Precies dat is
  // hier het scenario.
  ops.acceptError('Failed to load resource: the server responded with a status of 404');
  await catalogUnavailable(page);
  await freshStart(page);
  await startTourFromWelcome(page);
  await completeTour(page);

  await offer(page).getByRole('button', { name: /^(Yes|Ja)$/ }).click();
  await expect(offer(page)).toHaveCount(0);
  // Help opent op Tutorials: de sectie staat in beeld, met de weg naar de catalogus.
  await expect(page.locator('[data-help-section="kind-tutorial"] [data-help-install-tutorials]')).toBeInViewport();
  await expect(page.getByRole('status').filter({ hasText: /Help › Tutorials/ })).toBeVisible();
  expect(await answered(page)).toBe('true');
});

test('Overslaan of Escape in de rondleiding → geen tutorialvraag', async ({ page, ops: _ops }) => {
  await catalogUnavailable(page);
  await freshStart(page);
  await startTourFromWelcome(page);
  await page.locator('[data-ops-tour-card]').getByRole('button', { name: /^(Skip|Overslaan)$/ }).click();
  await expect(page.locator('[data-ops-tour-card]')).toHaveCount(0);
  await expect(offer(page)).toHaveCount(0);

  // Opnieuw starten via Bestand → Rondleiding starten, een stap verder, dan Escape.
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).click();
  await page.getByRole('button', { name: /^(Start tour|Rondleiding starten)$/ }).click();
  const card = page.locator('[data-ops-tour-card]');
  await expect(card).toBeVisible();
  await card.locator('.btn--primary').click();
  await expect.poll(() => tourStep(page)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(offer(page)).toHaveCount(0);
  expect(await answered(page)).toBeNull();
});

test('Overslaan in het welkomstvenster → geen rondleiding en geen tutorialvraag', async ({ page, ops: _ops }) => {
  await catalogUnavailable(page);
  await freshStart(page);
  await page.locator('[data-ops-welcome-dialog]').getByRole('button', { name: /^(Skip|Overslaan)$/ }).click();
  await expect(page.locator('[data-ops-welcome-dialog]')).toHaveCount(0);
  await expect(page.locator('[data-ops-tour-card]')).toHaveCount(0);
  await expect(offer(page)).toHaveCount(0);
});

test('Nee → melding over Help › Tutorials, en de vraag komt niet opnieuw', async ({ page, ops: _ops }) => {
  await catalogUnavailable(page);
  await freshStart(page);
  await startTourFromWelcome(page);
  await completeTour(page);

  await offer(page).getByRole('button', { name: /^(No|Nee)$/ }).click();
  await expect(offer(page)).toHaveCount(0);
  const toast = page.getByRole('status').filter({ hasText: /Help › Tutorials/ });
  await expect(toast).toBeVisible();
  await expect(toast.locator('[data-ops-notification-action]')).toHaveText(/^(Open Help|Help openen)$/);
  expect(await answered(page)).toBe('true');

  // Nog een keer de hele rondleiding, via Bestand → Rondleiding starten: geen vraag meer.
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).click();
  await page.getByRole('button', { name: /^(Start tour|Rondleiding starten)$/ }).click();
  await expect(page.locator('[data-ops-tour-card]')).toBeVisible();
  await completeTour(page);
  await expect(offer(page)).toHaveCount(0);

  // Ook na een herstart niet: de keuze is blijvend.
  await page.reload();
  await waitForOps(page);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.tutorialOfferAnswered)).toBe(true);
});

/** Verse start tot en met de tutorialvraag, via welkomst en een volledig doorlopen rondleiding. */
async function reachOffer(page: Page): Promise<void> {
  await freshStart(page);
  await startTourFromWelcome(page);
  await completeTour(page);
  await expect(offer(page)).toBeVisible();
}

/** Telt catalogusverzoeken (404): zo is zichtbaar of "Ja" (installeren) toch is afgegaan. */
async function countCatalogRequests(page: Page): Promise<() => number> {
  let n = 0;
  await page.route(CATALOG, route => { n++; return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }); });
  return () => n;
}

// M1 (review PR #261): Enter activeert de GEFOCUSTE knop. De beginfocus staat op Ja; met Shift+Tab
// naar Nee of het kruisje is Enter daar Nee — niet de standaardactie Ja.
for (const target of ['Nee', 'kruisje'] as const) {
  test(`Enter op ${target} → Nee, niet Ja`, async ({ page, ops: _ops }) => {
    const catalogRequests = await countCatalogRequests(page);
    await reachOffer(page);
    const yes = offer(page).getByRole('button', { name: /^(Yes|Ja)$/ });
    const no = offer(page).getByRole('button', { name: /^(No|Nee)$/ });
    const close = offer(page).getByRole('button', { name: /^(Close|Sluiten)$/ });
    await expect(yes).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(no).toBeFocused();
    if (target === 'kruisje') {
      await page.keyboard.press('Shift+Tab');
      await expect(close).toBeFocused();
    }
    await page.keyboard.press('Enter');

    await expect(offer(page)).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: /Help › Tutorials/ })
      .locator('[data-ops-notification-action]')).toHaveText(/^(Open Help|Help openen)$/);
    expect(catalogRequests()).toBe(0);
    expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.backstageSection)).not.toBe('help');
    expect(await answered(page)).toBe('true');
  });
}

test('Enter zonder knopfocus = Ja (de standaardactie)', async ({ page, ops }) => {
  ops.acceptError('Failed to load resource: the server responded with a status of 404');
  const catalogRequests = await countCatalogRequests(page);
  await reachOffer(page);
  // Klik op de vraagtekst: daarna heeft geen knop de focus.
  await offer(page).locator('#ops-tutorial-offer-question').click();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BUTTON');
  await page.keyboard.press('Enter');
  await expect(offer(page)).toHaveCount(0);
  await expect(page.locator('[data-help-section="kind-tutorial"] [data-help-install-tutorials]')).toBeInViewport();
  expect(catalogRequests()).toBe(1);
});

// M2 (review PR #261): een download die nooit antwoordt, laat Ja niet eeuwig "bezig". Na de
// tijdslimiet volgt de gewone foutroute: Help › Tutorials met een melding. De klok van de pagina is
// nep, zodat de test niet echt 20 of 60 seconden wacht; wat de gebruiker doet blijft een echte klik.
test('catalogus antwoordt nooit → na de tijdslimiet Help › Tutorials met een melding', async ({ page, ops: _ops }) => {
  let requested!: () => void;
  const catalogRequested = new Promise<void>(r => { requested = r; });
  await page.route(CATALOG, () => { requested(); /* nooit beantwoorden */ });
  await reachOffer(page);

  await page.clock.install();
  await offer(page).getByRole('button', { name: /^(Yes|Ja)$/ }).click();
  await catalogRequested;
  await expect(offer(page).getByRole('status')).toBeVisible(); // bezig
  await page.clock.runFor(20_000);

  await expect(offer(page)).toHaveCount(0);
  await expect(page.locator('[data-help-section="kind-tutorial"] [data-help-install-tutorials]')).toBeInViewport();
  await expect(page.getByRole('status').filter({ hasText: /Help › Tutorials/ })).toBeVisible();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().catalogError)).toMatch(/20 s/);
  expect(await answered(page)).toBe('true');
});

test('extensie-ZIP antwoordt nooit → na de tijdslimiet Help › Tutorials met een melding', async ({ page, ops }) => {
  ops.acceptError('Installeren vanuit catalogus mislukt');
  let requested!: () => void;
  const zipRequested = new Promise<void>(r => { requested = r; });
  await page.route(CATALOG, route => {
    if (route.request().url().endsWith('/tutorials.zip')) { requested(); return; /* nooit beantwoorden */ }
    return route.fulfill({ status: 200, json: { version: '1', lastUpdated: '2026-09-28', extensions: [{
      id: 'tutorials', name: 'Tutorials', version: '1.0.0', author: 'Browserfixture', description: 'Tutorials',
      category: 'Other', tags: [], minAppVersion: '0.0.0', repository: 'https://example.invalid/tutorials',
      downloadUrl: 'https://raw.githubusercontent.com/fixture/tutorials.zip',
    }] } });
  });
  await reachOffer(page);

  await page.clock.install();
  await offer(page).getByRole('button', { name: /^(Yes|Ja)$/ }).click();
  await zipRequested;
  await expect(offer(page).getByRole('status')).toBeVisible(); // bezig
  await page.clock.runFor(60_000);

  await expect(offer(page)).toHaveCount(0);
  await expect(page.locator('[data-help-section="kind-tutorial"] [data-help-install-tutorials]')).toBeInViewport();
  await expect(page.getByRole('status').filter({ hasText: /Help › Tutorials/ })).toBeVisible();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().installedExtensions.tutorials)).toBeUndefined();
  expect(await answered(page)).toBe('true');
});
