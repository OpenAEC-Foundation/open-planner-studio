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
  const card = page.locator('[data-ops-tour-card]');
  const primary = card.locator('.btn--primary');
  for (let i = 0; i < 12; i++) {
    await eachStep?.();
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

export const tutorialOffer = (page: Page) => page.locator('[data-ops-tutorial-offer]');
