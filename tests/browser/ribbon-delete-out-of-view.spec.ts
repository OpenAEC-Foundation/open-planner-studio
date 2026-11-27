// Issue #1305 (knownbug 2520): met het VOLLEDIGE resourcepaneel open staat de takenlijst niet in
// beeld, maar standen de lintknoppen Verwijderen en Dissolve wél aan — een klik verwijderde de
// geselecteerde taak ongezien. Ze moeten dezelfde regel volgen als de Delete-toets
// (`isTaskListInView` in src/state/ganttVisibility.ts): uit staan zolang de takenlijst niet in
// beeld is, en niets doen.
//
// Route uit het issue, met echte klikken: twee taken aanmaken en A selecteren, via het tabblad
// Resources het volledige resourcepaneel openen, naar Start of Tabel wisselen (paneel blijft
// staan, A blijft geselecteerd), dan beide knoppen bekijken en forceren.
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

/** Tabblad Resources → de knop die het VOLLEDIGE paneel opent (werkruimte overnemend). */
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

    // De stand uit het issue: paneel staat, A is nog geselecteerd, de takenlijst is niet in beeld.
    await expect.poll(() => uiState(page).then(ui => (
      ui.showResourcePanel && !ui.resourcePanelDocked && ui.activeRibbonTab === tab
    ))).toBe(true);
    expect(await selectedIds(page)).toEqual([idA]);

    await expect(deleteBtn(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(dissolveBtn(page)).toHaveAttribute('aria-disabled', 'true');

    // Een geforceerde klik (de knop is uit) mag niets verwijderen; daarna nog twee taken.
    await deleteBtn(page).click({ force: true });
    await dissolveBtn(page).click({ force: true });
    expect(await taskCount(page)).toBe(2);
    expect(await hasTask(page, idA)).toBe(true);

    // Ter controle: Delete/Backspace doen in dezelfde stand evenmin iets (zelfde regel).
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

  // Tweede klik op dezelfde knop sluit het paneel weer (zie openResourcePanel in ribbonConfig).
  await page.locator('[data-ops-ribbon-tab="resources"]').click();
  await page.locator('[data-ops-ribbon-item="openResourcePanel"]').click();
  await page.locator('[data-ops-ribbon-tab="start"]').click();
  await expect.poll(() => uiState(page).then(ui => !ui.showResourcePanel)).toBe(true);
  await expect(deleteBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
  await expect(dissolveBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
  expect(await taskCount(page)).toBe(2);
});
