import type { Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

// Contour-UI (2026-09): de urenverdeling van een toewijzing bewerken via het eigenschappenpaneel.
// Fixture via de brug (taak + resource + toewijzing); de geteste handelingen zijn echte klikken en
// toetsaanslagen op de gerenderde UI. Asserties op de store (contour, belasting, undo) — geen
// canvaspixels.

async function seedAssignedTask(page: Page): Promise<{ taskId: string; resourceId: string; assignmentId: string }> {
  const [taskId] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-09', durationDays: 3 },
  ]);
  return page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const resourceId = s.addResource({ name: 'Metselploeg', type: 'LABOR', description: '', maxUnits: 2 });
    s.assignResource(id, resourceId, 1);
    s.runCPM();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(id);
    const assignmentId = window.__OPS__!.store.getState().assignments.find(a => a.taskId === id)!.id;
    return { taskId: id, resourceId, assignmentId };
  }, taskId);
}

function loadOf(page: Page, resourceId: string): Promise<number[]> {
  return page.evaluate((rid) => {
    const load = window.__OPS__!.store.getState().resourceLoadResult?.load[rid] ?? {};
    return Object.keys(load).sort().map(k => Math.round(load[k] * 100) / 100);
  }, resourceId);
}

test('contourvenster: dag bewerken, toepassen, undo en loslaten via de echte knoppen', async ({ page, ops: _ops }) => {
  const { taskId, resourceId } = await seedAssignedTask(page);

  const row = page.locator(`[data-ops-assignment-row]`).first();
  await expect(row).toBeVisible();
  const contourButton = row.locator('[data-ops-assignment-contour]');
  await expect(contourButton).toHaveAttribute('data-ops-assignment-contour', 'formula');
  await contourButton.click();

  const dialog = page.locator('[data-ops-contour-dialog]');
  await expect(dialog).toBeVisible();
  // Vertrekpunt = de formule: 3 werkdagen × 8 uur, uniform.
  await expect(dialog.locator('[data-ops-contour-row]')).toHaveCount(3);
  await expect(dialog.locator('[data-ops-contour-hours="0"]')).toHaveValue('8');
  await expect(dialog.locator('[data-ops-contour-total]')).toHaveText('24');

  // Dag 2 naar 4 uur, dag 3 naar 0 uur.
  await dialog.locator('[data-ops-contour-hours="1"]').fill('4');
  await dialog.locator('[data-ops-contour-hours="2"]').fill('0');
  await expect(dialog.locator('[data-ops-contour-total]')).toHaveText('12');
  await dialog.locator('[data-ops-contour-apply]').click();
  await expect(dialog).toHaveCount(0);

  // Store: contour op de taak, gekoppeld aan de resource; belasting 1 / 0.5 / 0; datums ongemoeid.
  await expect.poll(() => page.evaluate((id) => {
    const t = window.__OPS__!.store.getState().tasks.find(x => x.id === id)!;
    return t.timephasedContours?.map(c => [c.resourceId, c.resourceUid, c.periods.map(p => p.workMinutes)]);
  }, taskId)).toEqual([[resourceId, null, [480, 240, 0]]]);
  await expect.poll(() => loadOf(page, resourceId)).toEqual([1, 0.5, 0]);
  await expect.poll(() => page.evaluate((id) => {
    const t = window.__OPS__!.store.getState().tasks.find(x => x.id === id)!;
    return [t.time.earlyStart, t.time.earlyFinish, t.splitGaps ?? null];
  }, taskId)).toEqual(['2026-09-07', '2026-09-09', null]);
  await expect(contourButton).toHaveAttribute('data-ops-assignment-contour', 'contoured');
  await expect(row.locator('[data-ops-assignment-curve]')).toBeDisabled();
  await expect(page.locator('[data-ops-task-timephased]')).toHaveAttribute('data-ops-task-timephased', 'contoured');

  // Ongeldige invoer blokkeert Toepassen; Escape sluit zonder wijziging.
  await contourButton.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-ops-contour-hours="1"]')).toHaveValue('4');
  await dialog.locator('[data-ops-contour-hours="0"]').fill('abc');
  await expect(dialog.locator('[data-ops-contour-apply]')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => loadOf(page, resourceId)).toEqual([1, 0.5, 0]);

  // Undo via de store draait de contour terug (één undo-stap voor het toepassen).
  await page.evaluate(() => window.__OPS__!.store.getState().undo());
  await expect.poll(() => page.evaluate((id) =>
    window.__OPS__!.store.getState().tasks.find(x => x.id === id)!.timephasedContours ?? null, taskId)).toBeNull();
  await expect.poll(() => loadOf(page, resourceId)).toEqual([1, 1, 1]);
  await expect(contourButton).toHaveAttribute('data-ops-assignment-contour', 'formula');

  // Vorm toepassen als vertrekpunt (Vooraan belast houdt het totaal), dan loslaten via de knop.
  await contourButton.click();
  await dialog.locator('[data-ops-contour-shape]').selectOption('FRONT_LOADED');
  await expect(dialog.locator('[data-ops-contour-total]')).toHaveText('24');
  await dialog.locator('[data-ops-contour-apply]').click();
  await expect.poll(() => loadOf(page, resourceId).then(l => l.map(v => v > 0))).toEqual([true, true, true]);
  await expect.poll(() => loadOf(page, resourceId).then(l => l[0] > l[2])).toBe(true);
  await contourButton.click();
  await dialog.locator('[data-ops-contour-release]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate((id) =>
    window.__OPS__!.store.getState().tasks.find(x => x.id === id)!.timephasedContours ?? null, taskId)).toBeNull();
  await expect.poll(() => loadOf(page, resourceId)).toEqual([1, 1, 1]);
});
