import type { Page } from '@playwright/test';
import { expect, waitForOps } from './ops';

export interface FreshStartOptions {
  seed?: Record<string, string>;
  afterLoad?: (page: Page) => Promise<void>;
}

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

export async function completeTour(page: Page, eachStep?: () => Promise<void>): Promise<void> {
  const primary = page.locator('[data-ops-tour-card] .btn--primary');
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
