// Het sluitkruisje in de gedeelde dialoogkop (DialogHeader) draagt overal dezelfde toegankelijke
// naam én tooltip. Voorheen had de helft van de dialogen geen van beide (een naamloze knop voor
// schermlezers) en heette het kruisje van "Project verplaatsen" juist "Annuleren". De storebrug
// opent alleen de dialoog; het sluiten is een echte klik op de knop die bij die naam hoort.
import { expect, seedProject, test } from './fixtures/ops';
import type { UIState } from '@/state/slices/types';

const CLOSE = /^(Close|Sluiten)$/;

const DIALOG_FLAGS: Array<keyof UIState> = [
  'showProjectInfoDialog',
  'showBaselineDialog',
  'showFilterDialog',
  'showLevelingDialog',
  'showStructureDialog',
  'showCalendarDialog',
  'showMoveProjectDialog',
  'showShortcutsDialog',
];

for (const flag of DIALOG_FLAGS) {
  test(`dialoogkop (${flag}): het sluitkruisje heet "Sluiten" en sluit de dialoog`, async ({ page, ops: _ops }) => {
    const patch: Partial<UIState> = { [flag]: true };
    await page.evaluate(p => window.__OPS__!.store.getState().setUI(p), patch);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Het kopkruisje is de eerste knop met die naam; sommige dialogen hebben er ook een voetknop.
    const close = dialog.getByRole('button', { name: CLOSE }).first();
    await expect(close).toHaveAttribute('title', CLOSE);
    await close.click();
    await expect(dialog).toBeHidden();
  });
}

// TaskDialog en SettingsDialog tekenen hun kop zelf (een <h2>-titel resp. een versleepbare kop) en
// vallen dus buiten DialogHeader; hun kruisje moet toch dezelfde naam én tooltip dragen.
const TASK_DIALOG_CASES = [
  { label: 'Taak bewerken', title: /^(Edit task|Taak bewerken)$/, seed: true },
  { label: 'Nieuwe taak', title: /^(New task|Nieuwe taak)$/, seed: false },
];

for (const { label, title, seed } of TASK_DIALOG_CASES) {
  test(`taakdialoog (${label}): het kopkruisje heet "Sluiten" en sluit de dialoog`, async ({ page, ops: _ops }) => {
    const editingTaskId = seed
      ? (await seedProject(page, [{ name: 'Taak met kruisje', start: '2026-09-07', finish: '2026-09-18' }]))[0]
      : null;
    await page.evaluate(id => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), editingTaskId);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: title })).toBeVisible();

    // Precies één knop met die naam: de voet heeft alleen Annuleren/Opslaan.
    const close = dialog.getByRole('button', { name: CLOSE });
    await expect(close).toHaveCount(1);
    await expect(close).toHaveAttribute('title', CLOSE);
    await close.click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.editingTaskId)).toBeNull();
  });
}

test('instellingendialoog: het kopkruisje heet "Sluiten", start geen sleep en sluit de dialoog', async ({ page, ops: _ops }) => {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const dialog = page.getByRole('dialog', { name: /^(Settings|Instellingen)$/ });
  await expect(dialog).toBeVisible();

  // De voet heeft óók een tekstknop "Sluiten" (zonder tooltip); het kruisje zit in de sleepkop.
  const close = dialog.locator('.settings-header').getByRole('button', { name: CLOSE });
  await expect(close).toHaveAttribute('title', CLOSE);

  // Sleep-uitsluiting: indrukken óp het kruisje en wegslepen verplaatst het paneel niet.
  const before = await dialog.boundingBox();
  const box = (await close.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 120, box.y + 80, { steps: 5 });
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  expect(await dialog.boundingBox()).toEqual(before);

  await close.click();
  await expect(dialog).toBeHidden();
});
