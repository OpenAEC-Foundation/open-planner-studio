import { expect, state, test } from './fixtures/ops';

// Issue #158: een klik naast het paneel van een dialoog mét invoer mag die dialoog niet sluiten —
// dat gooide stil weg wat de gebruiker al had ingetypt. Escape en Annuleren blijven de uitgangen.
// Echte muisklik op de overlay (de `fixed inset-0`-laag rond het paneel), geen store-shortcut.

test('nieuw-project-wizard overleeft een klik naast het paneel en houdt de getypte naam', async ({ page, ops: _ops }) => {
  const before = await state(page);
  await page.locator('[data-ops-tabstrip] .ops-tabstrip-add').click();
  await page.locator('[data-ops-new-project-choice]').click();
  const dialog = page.locator('[data-ops-project-dialog="new"]');
  await expect(dialog).toBeVisible();

  const name = dialog.locator('input').first();
  await name.click();
  await page.keyboard.type('Half ingevulde naam');
  await expect(name).toHaveValue('Half ingevulde naam');

  // Klik in de linkerbovenhoek van de overlay — buiten het gecentreerde paneel.
  const overlay = dialog.locator('xpath=..');
  await overlay.click({ position: { x: 8, y: 8 } });
  await expect(dialog).toBeVisible();
  await expect(name).toHaveValue('Half ingevulde naam');
  expect((await state(page)).documentIds).toEqual(before.documentIds);

  // Escape sluit wél, zonder een document aan te maken.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect((await state(page)).documentIds).toEqual(before.documentIds);
});

test('keuzedialoog zonder invoer sluit nog gewoon op een klik naast het paneel', async ({ page, ops: _ops }) => {
  await page.locator('[data-ops-tabstrip] .ops-tabstrip-add').click();
  const dialog = page.locator('[data-ops-new-or-open-project-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.locator('xpath=..').click({ position: { x: 8, y: 8 } });
  await expect(dialog).toBeHidden();
});
