import { expect, seedProject, state, test } from './fixtures/ops';

test('document-plus kiest eerst nieuw of bestaand; annuleren verandert geen document', async ({ page, ops: _ops }) => {
  const before = await state(page);
  await page.locator('[data-ops-tabstrip] .ops-tabstrip-add').click();
  await expect(page.locator('[data-ops-new-or-open-project-dialog]')).toBeVisible();
  expect((await state(page)).documentIds).toEqual(before.documentIds);

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ops-new-or-open-project-dialog]')).toBeHidden();
  expect((await state(page)).documentIds).toEqual(before.documentIds);

  await page.locator('[data-ops-tabstrip] .ops-tabstrip-add').click();
  await page.locator('[data-ops-new-project-choice]').click();
  await expect(page.locator('[data-ops-project-dialog="new"]')).toBeVisible();
  expect((await state(page)).documentIds).toEqual(before.documentIds);
  await page.locator('[data-ops-project-cancel]').click();
});

test('Taak toevoegen selecteert, onthult en richt de nieuwe taak zonder zoomwijziging', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Bestaande taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setZoom(96);
    s.setUI({ showPropertiesPanel: false, rightPanelCollapsed: true });
  });
  const before = await state(page);

  await page.getByRole('button', { name: /(?:Taak toevoegen|New task at the bottom of the list)/ }).click();

  await expect.poll(() => state(page).then(s => s.tasks.length)).toBe(2);
  const after = await state(page);
  const created = after.tasks.at(-1)!;
  expect(after.selectedTaskIds).toEqual([created.id]);
  expect(after.view.zoom).toBe(before.view.zoom);
  await expect.poll(() => state(page).then(s => s.view.pendingFocusTaskId)).toBeNull();
  const name = page.locator('[data-ops-rail] input').first();
  await expect(name).toBeFocused();
  await expect(name).toHaveJSProperty('selectionStart', 0);
  await expect(name).toHaveJSProperty('selectionEnd', created.name.length);

  await page.keyboard.type('Directe naam');
  await page.keyboard.press('Enter');
  await expect.poll(() => state(page).then(s => s.tasks.find(task => task.id === created.id)?.name)).toBe('Directe naam');
  await expect(page.locator('[data-ops-rail]')).toBeVisible();
});
