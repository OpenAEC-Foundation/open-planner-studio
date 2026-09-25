// Structuurovergangen met toewijzingen (audit taakmutaties §6), met ECHTE browser-events.
// - Het mijlpaalvinkje in het eigenschappenpaneel op een taak met een toewijzing: geweigerd, met een
//   zichtbare melding (voorheen werd de taak een mijlpaal en viel de belasting stil naar 0).
// - Inspringen (Alt+Shift+→) onder een taak met een toewijzing: de toewijzing verhuist naar de nieuwe
//   subtaak, met een zichtbare melding, en de belasting telt na F5 weer mee.
// `__OPS__` zet alleen de fixture (taken, resource, toewijzing, selectie) en leest state.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

async function seedAssignedLeaf(page: Page): Promise<{ L: string; N: string; R: string }> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ name: 'Toewijzingen', startDate: '2026-09-07' });
    s.setViewStartDate('2026-09-04');
    const L = s.addTask({ name: 'Metselen' });
    const N = window.__OPS__!.store.getState().addTask({ name: 'Voegen' });
    const R = window.__OPS__!.store.getState().addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 1 });
    window.__OPS__!.store.getState().assignResource(L, R, 1);
    window.__OPS__!.store.getState().runCPM();
    window.__OPS__!.store.getState().setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    return { L, N, R };
  });
}

const assignmentTaskIds = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().assignments.map(a => a.taskId));

test('mijlpaalvinkje op een taak met toewijzing wordt geweigerd met melding', async ({ page, ops: _ops }) => {
  const { L } = await seedAssignedLeaf(page);
  await page.evaluate((id) => window.__OPS__!.store.getState().selectTask(id), L);

  const checkbox = page.locator('label', { hasText: /^Milestone$/ }).first().locator('input[type=checkbox]');
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();

  await expect(page.locator('.ops-toast', { hasText: /'Metselen' has resource assignments and cannot become a milestone/ }))
    .toBeVisible();
  await expect(checkbox).not.toBeChecked();
  expect(await page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.isMilestone, L)).toBe(false);
  expect(await assignmentTaskIds(page)).toEqual([L]);
});

test('inspringen onder een taak met toewijzing verhuist de toewijzing naar de nieuwe subtaak', async ({ page, ops: _ops }) => {
  const { L, N, R } = await seedAssignedLeaf(page);

  // Echte klik op de rij van N, daarna de echte sneltoets.
  await page.locator(`[data-grid-data-row="true"][data-grid-row-key="${N}"] [data-grid-column-id="task.name"]`).first().click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([N]);
  await page.keyboard.press('Alt+Shift+ArrowRight');

  await expect.poll(() => page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.parentId, N))
    .toBe(L);
  expect(await assignmentTaskIds(page)).toEqual([N]);
  await expect(page.locator('.ops-toast', {
    hasText: /The assignment of Metselaar was moved from 'Metselen' to the new subtask 'Voegen'/,
  })).toBeVisible();

  // Na herberekenen (echte F5) telt de belasting weer mee: 5 werkdagen × 1 eenheid.
  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate((rid) => Object.values(
    (window.__OPS__!.store.getState().resourceLoadResult?.load?.[rid] ?? {}) as Record<string, number>,
  ).reduce((sum, value) => sum + value, 0), R)).toBe(5);

  // Eén Ctrl+Z zet structuur én toewijzing terug.
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.parentId, N))
    .toBeNull();
  expect(await assignmentTaskIds(page)).toEqual([L]);
});
