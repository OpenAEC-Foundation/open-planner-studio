// "+" direct na het laatste tabblad (sticky aan de rand bij overloop) en een vierkante sluitknop op
// de projectoverzichtskaart die de ACTIVE-badge niet raakt bij een lange titel.
import { expect, seedProject, test } from './fixtures/ops';

const add = '.ops-tabstrip-add';

test('"+" staat direct na het laatste tabblad en blijft zichtbaar bij overloop', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await seedProject(page, [{ name: 'Taak A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 }], 'Document A');
  await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  await expect(page.locator('[data-testid="document-tab"]')).toHaveCount(2);

  const tabs = page.locator('.ops-tab-group');
  const last = await tabs.last().boundingBox();
  const plus = await page.locator(add).boundingBox();
  expect(last && plus).toBeTruthy();
  expect(Math.abs(plus!.x - (last!.x + last!.width))).toBeLessThanOrEqual(8);

  for (let i = 0; i < 14; i += 1) await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  await expect(page.locator('[data-testid="document-tab"]')).toHaveCount(16);
  const strip = (await page.locator('[data-ops-tabstrip]').boundingBox())!;
  const plus2 = (await page.locator(add).boundingBox())!;
  expect(plus2.x + plus2.width).toBeLessThanOrEqual(strip.x + strip.width + 0.5);
  expect(plus2.x).toBeGreaterThan(strip.x + strip.width - 60);
  await expect(page.locator(add)).toBeInViewport({ ratio: 1 });
  await page.locator(add).click();
});

test('sluitknop op de overzichtskaart blijft vierkant en raakt de badge niet', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await seedProject(page, [{ name: 'Taak A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 }], 'Northstar Grid Connection (NORTHSTAR GRID CONNECTION) met extra lange titel');
  await page.locator('.ops-tabstrip-menu').click();
  const close = page.locator('.ops-card-close').first();
  await expect(close).toBeVisible();
  const box = (await close.boundingBox())!;
  expect(Math.round(box.width)).toBe(26);
  expect(Math.round(box.height)).toBe(26);
  const card = page.locator('[data-ops-overview-card]').first();
  const badge = (await card.getByText(/active|actief/i).first().boundingBox())!;
  expect(badge.x + badge.width).toBeLessThanOrEqual(box.x - 4);
});
