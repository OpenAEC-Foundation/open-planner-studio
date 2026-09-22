import { expect, test, waitForOps } from './fixtures/ops';
import type { Locator, Page } from '@playwright/test';

// De gecentreerde titel in de titelbalk mag het linkercluster (snelkoppelingen, AutoSave,
// feedbackknop) nooit overlappen, hoe lang de projectnaam ook is: hij blijft exact in het
// midden zolang hij past en kort daarna in. De reservering per kant wordt gemeten, niet geraden.

const LONG_NAME = 'Refurbishment & Extension of a Family Home — fase 2 met bijgebouw en tuinaanleg';

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, `geen boundingBox voor ${String(locator)}`).not.toBeNull();
  return b!;
}

async function setName(page: Page, name: string): Promise<void> {
  await waitForOps(page);
  await page.evaluate(n => window.__OPS__!.store.getState().setProject({ name: n }), name);
  await expect(page.locator('[data-ops-title-file-name]')).toContainText(name.slice(0, 8));
}

// Gemeten linkercluster in de Engelse dev-build: ~422px; de middenruimte is dus
// viewport − 2×422 − 24. De breedtes hieronder houden ruim afstand tot de container-
// drempels (400px en 120px) zodat een iets ander font in CI de uitkomst niet kantelt.
const WIDE = 1366;   // middenruimte ≈ 498px: appnaam zichtbaar, lange projectnaam kort in
const NARROW = 1100; // middenruimte ≈ 232px: appnaam weg, projectnaam zichtbaar
const TINY = 900;    // middenruimte ≈ 8px: beide weg, de tabbalk toont de naam

test('lange projectnaam: titel raakt de feedbackknop niet, staat gecentreerd en kort in', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: WIDE, height: 720 });
  await setName(page, LONG_NAME);

  const center = page.locator('.title-bar-center');
  const feedback = page.locator('[data-tour-anchor="feedback-button"]');
  const fileName = page.locator('[data-ops-title-file-name]');
  await expect(fileName).toBeVisible();

  const c = await box(center);
  const f = await box(feedback);
  expect(c.x, 'titel begint links van het einde van de feedbackknop').toBeGreaterThanOrEqual(f.x + f.width);
  expect(Math.abs((c.x + c.width / 2) - WIDE / 2), 'titel niet paginacentraal').toBeLessThanOrEqual(1);

  // De projectnaam is te lang voor de resterende ruimte en kort in; de appnaam blijft heel.
  const clipped = await fileName.evaluate(el => el.scrollWidth > el.clientWidth);
  expect(clipped, 'projectnaam hoort af te kappen').toBe(true);
  const appName = page.locator('[data-ops-title-app-name]');
  await expect(appName).toBeVisible();
  expect(await appName.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
});

test('korte projectnaam op een breed venster: niets kort in', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1920, height: 900 });
  await setName(page, 'Kort');
  const fileName = page.locator('[data-ops-title-file-name]');
  await expect(fileName).toBeVisible();
  expect(await fileName.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
});

test('smal venster: eerst wijkt de appnaam, de projectnaam blijft zichtbaar', async ({ page }) => {
  await page.goto('/');
  await setName(page, 'Kort');
  await page.setViewportSize({ width: NARROW, height: 700 });
  await expect(page.locator('[data-ops-title-app-name]')).toBeHidden();
  await expect(page.locator('[data-ops-title-file-name]')).toBeVisible();
  const c = await box(page.locator('.title-bar-center'));
  const f = await box(page.locator('[data-tour-anchor="feedback-button"]'));
  expect(c.x).toBeGreaterThanOrEqual(f.x + f.width);

  // Nog smaller: ook de projectnaam wijkt in plaats van tot een onleesbaar restje te krimpen.
  await page.setViewportSize({ width: TINY, height: 700 });
  await expect(page.locator('[data-ops-title-file-name]')).toBeHidden();
  await expect(page.locator('[data-tour-anchor="feedback-button"]')).toBeVisible();
});
