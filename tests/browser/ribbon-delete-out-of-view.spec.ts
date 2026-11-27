import type { Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

const taskCount = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().tasks.length);
const uiState = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui);
const selectedIds = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds);
const hasTask = (page: Page, id: string) => page.evaluate(
  (taskId) => window.__OPS__!.store.getState().tasks.some(t => t.id === taskId), id,
);

async function seedTwoSelectA(page: Page): Promise<string> {
  const ids = await seedProject(page, [
    { name: 'A', start: '2026-06-01', finish: '2026-06-02', durationDays: 2 },
    { name: 'B', start: '2026-06-03', finish: '2026-06-05', durationDays: 3 },
  ]);
  await page.evaluate((id) => window.__OPS__!.store.getState().selectTask(id), ids[0]!);
  return ids[0]!;
}

async function openFullResourcePanel(page: Page): Promise<void> {
  await page.locator('[data-ops-ribbon-tab="resources"]').click();
  await page.locator('[data-ops-ribbon-item="openResourcePanel"]').click();
  await expect.poll(() => uiState(page).then(ui => ui.showResourcePanel && !ui.resourcePanelDocked)).toBe(true);
}

const deleteBtn = (page: Page) => page.locator('[data-ops-ribbon-item="delete"]');
const dissolveBtn = (page: Page) => page.locator('[data-ops-ribbon-item="dissolve"]');

for (const tab of ['start', 'table'] as const) {
  test(`volledig resourcepaneel open, tabblad ${tab}: Verwijderen en Dissolve staan uit en verwijderen niets`, async ({ page, ops: _ops }) => {
    const idA = await seedTwoSelectA(page);
    await openFullResourcePanel(page);
    await page.locator(`[data-ops-ribbon-tab="${tab}"]`).click();

    await expect.poll(() => uiState(page).then(ui => (
      ui.showResourcePanel && !ui.resourcePanelDocked && ui.activeRibbonTab === tab
    ))).toBe(true);
    expect(await selectedIds(page)).toEqual([idA]);

    await expect(deleteBtn(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(dissolveBtn(page)).toHaveAttribute('aria-disabled', 'true');

    await deleteBtn(page).click({ force: true });
    await dissolveBtn(page).click({ force: true });
    expect(await taskCount(page)).toBe(2);
    expect(await hasTask(page, idA)).toBe(true);

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Delete');
    await page.keyboard.press('Backspace');
    expect(await taskCount(page)).toBe(2);
  });
}

test('zonder volledig resourcepaneel staan de knoppen aan en verwijdert Verwijderen wél', async ({ page, ops: _ops }) => {
  const idA = await seedTwoSelectA(page);
  await page.locator('[data-ops-ribbon-tab="start"]').click();
  await expect(deleteBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
  await expect(dissolveBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
  await deleteBtn(page).click();
  await expect.poll(() => taskCount(page)).toBe(1);
  expect(await hasTask(page, idA)).toBe(false);
});

test('volledig resourcepaneel sluiten zet de knoppen weer aan', async ({ page, ops: _ops }) => {
  await seedTwoSelectA(page);
  await openFullResourcePanel(page);
  await page.locator('[data-ops-ribbon-tab="start"]').click();
  await expect(deleteBtn(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(dissolveBtn(page)).toHaveAttribute('aria-disabled', 'true');

  await page.locator('[data-ops-ribbon-tab="resources"]').click();
  await page.locator('[data-ops-ribbon-item="openResourcePanel"]').click();
  await page.locator('[data-ops-ribbon-tab="start"]').click();
  await expect.poll(() => uiState(page).then(ui => !ui.showResourcePanel)).toBe(true);
  await expect(deleteBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
  await expect(dissolveBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
  expect(await taskCount(page)).toBe(2);
});
