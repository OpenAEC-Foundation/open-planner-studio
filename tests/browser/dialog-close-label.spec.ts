// Het sluitkruisje in de gedeelde dialoogkop (DialogHeader) draagt overal dezelfde toegankelijke
// naam én tooltip. Voorheen had de helft van de dialogen geen van beide (een naamloze knop voor
// schermlezers) en heette het kruisje van "Project verplaatsen" juist "Annuleren". De storebrug
// opent alleen de dialoog; het sluiten is een echte klik op de knop die bij die naam hoort.
import { expect, test } from './fixtures/ops';
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
