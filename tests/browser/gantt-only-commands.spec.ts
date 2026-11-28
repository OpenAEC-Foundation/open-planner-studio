import { expect, seedProject, test } from './fixtures/ops';

test('Tabel-tab: splitsen en relatie tekenen staan uit, en een lopende modus gaat uit', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Taak', start: '2026-06-01', finish: '2026-06-12', durationDays: 10 }]);

  await page.locator('[data-ops-ribbon-tab="start"]').click();
  const split = page.locator('[data-ops-ribbon-item="splitTask"]');
  await expect(split).not.toHaveAttribute('aria-disabled', 'true');
  await split.click();
  await expect(page.locator('[data-ops-split-mode]')).toBeVisible();

  await page.locator('[data-ops-ribbon-tab="table"]').click();
  await expect(page.locator('[data-ops-split-mode]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showSplitMode)).toBe(false);

  await expect(split).toHaveAttribute('aria-disabled', 'true');
  await split.click({ force: true });
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showSplitMode)).toBe(false);

  await page.locator('.ribbon-btn[aria-haspopup="menu"]').filter({ has: page.locator('[data-icon="planning.relations-menu"]') }).click();
  const draw = page.locator('.ribbon-relation-menu-item').first();
  await expect(draw).toBeDisabled();
  await expect(page.locator('[data-ops-dependency-mode]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showDependencyMode)).toBe(false);

  await page.keyboard.press('Escape');
  await page.locator('[data-grid-cell-key]').first().click({ button: 'right' });
  const addRelation = page.locator('button[data-ops-context-disabled][title]');
  await expect(addRelation).toHaveCount(1);
  await expect(addRelation).toBeDisabled();
  await expect(addRelation).toHaveAttribute('title', /Gantt/);

  await page.keyboard.press('Escape');
  await page.locator('[data-ops-ribbon-tab="start"]').click();
  await expect(split).not.toHaveAttribute('aria-disabled', 'true');
});
