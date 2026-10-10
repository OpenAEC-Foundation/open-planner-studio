import type { Page } from '@playwright/test';
import { expect, waitForOps } from './ops';

// De eerste-startervaring (welkomst → rondleiding → tutorialvraag) als echte gebruikershandelingen,
// gedeeld door `first-start-tutorial.spec.ts` en `just-updated-dialog.spec.ts`.

export interface FreshStartOptions {
  /** `localStorage`-sleutels die er al staan vóór de herlaad (bv. een bestaande `ops-lastVersion`). */
  seed?: Record<string, string>;
  /** Loopt direct na het laden, vóór de welkomst verschijnt (bv. een fixture via de dev-brug). */
  afterLoad?: (page: Page) => Promise<void>;
}

/** Lege instellingen en een echte herlaad: de welkomstdialoog komt vanzelf (eerste start). */
export async function freshStart(page: Page, options: FreshStartOptions = {}): Promise<void> {
  await page.evaluate(seed => {
    localStorage.clear();
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
  }, options.seed ?? {});
  await page.reload();
  await waitForOps(page);
  await options.afterLoad?.(page);
  await expect(page.locator('[data-ops-welcome-dialog]')).toBeVisible();
}

export async function startTourFromWelcome(page: Page): Promise<void> {
  const welcome = page.locator('[data-ops-welcome-dialog]');
  await welcome.getByRole('button', { name: /^(Next|Volgende)$/ }).click();
  await welcome.getByRole('button', { name: /^(Start tour|Rondleiding starten)$/ }).click();
  await expect(welcome).toHaveCount(0);
  await expect(page.locator('[data-ops-tour-card]')).toBeVisible();
}

export const tourStep = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui.tourStepIndex);

/**
 * Volgende tot de laatste stap, en daar de afsluitknop — elke klik een echte klik. `eachStep` loopt
 * vóór elke klik (bv. om te controleren dat er niets over de rondleiding heen kwam).
 */
export async function completeTour(page: Page, eachStep?: () => Promise<void>): Promise<void> {
  const primary = page.locator('[data-ops-tour-card] .btn--primary');
  // Klik, en wacht dan tot óf de rondleiding dicht is (dat was de afsluitknop) óf de kaart een
  // ANDERE stap toont. Tussen twee stappen is de kaart even weg (TourOverlay meet of wacht dan op
  // het anker, bv. de lazy Backstage bij stap 6; knownbugs 54/80), dus "geen kaart" betekent niet
  // "klaar": de toestand van de rondleiding zelf (`ui.showTourOverlay`) beslist. Bewust GEEN label
  // lezen vóór de klik en daarop sturen: een stap waarvan het anker uitblijft, slaat de rondleiding
  // vanzelf over.
  const shownTitle = () => page.evaluate(() =>
    document.querySelector('[data-ops-tour-card] span.font-semibold')?.textContent ?? null);
  const tourOpen = () => page.evaluate(() => window.__OPS__!.store.getState().ui.showTourOverlay);
  for (let i = 0; i < 12; i++) {
    await eachStep?.();
    await expect(primary, 'de rondleidingskaart staat open').toBeVisible();
    const before = await shownTitle();
    await primary.click();
    await expect.poll(async () => !(await tourOpen()) || ((await shownTitle()) ?? before) !== before).toBe(true);
    if (!(await tourOpen())) return;
  }
  throw new Error('de rondleiding bereikte geen laatste stap');
}

export const tutorialOffer = (page: Page) => page.locator('[data-ops-tutorial-offer]');
