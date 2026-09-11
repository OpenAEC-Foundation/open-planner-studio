import type { Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

// Contour-UI / fasen-editor (2026-09): de urenverdeling van een toewijzing bewerken in fasen via het
// eigenschappenpaneel. Fixture via de brug (taak + resource + toewijzing); de geteste handelingen
// zijn echte klikken, toetsaanslagen en muissleep op de gerenderde UI (tabel én SVG-strook).
// Asserties op de store (contour, belasting, undo) — geen canvaspixels.

async function seedAssignedTask(page: Page): Promise<{ taskId: string; resourceId: string }> {
  const [taskId] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
  ]);
  return page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const resourceId = s.addResource({ name: 'Metselploeg', type: 'LABOR', description: '', maxUnits: 2 });
    s.assignResource(id, resourceId, 1);
    s.runCPM();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(id);
    return { taskId: id, resourceId };
  }, taskId);
}

function loadOf(page: Page, resourceId: string): Promise<number[]> {
  return page.evaluate((rid) => {
    const load = window.__OPS__!.store.getState().resourceLoadResult?.load[rid] ?? {};
    return Object.keys(load).sort().map(k => Math.round(load[k] * 100) / 100);
  }, resourceId);
}

function contourMinutes(page: Page, taskId: string): Promise<number[] | null> {
  return page.evaluate((id) => {
    const t = window.__OPS__!.store.getState().tasks.find(x => x.id === id)!;
    return t.timephasedContours?.[0]?.periods.map(p => p.workMinutes) ?? null;
  }, taskId);
}

test('fasen-editor: splitsen, inzet typen, grens slepen, toepassen, undo en loslaten', async ({ page, ops: _ops }) => {
  const { taskId, resourceId } = await seedAssignedTask(page);

  const row = page.locator('[data-ops-assignment-row]').first();
  await expect(row).toBeVisible();
  const contourButton = row.locator('[data-ops-assignment-contour]');
  await expect(contourButton).toHaveAttribute('data-ops-assignment-contour', 'formula');
  await contourButton.click();

  const dialog = page.locator('[data-ops-contour-dialog]');
  await expect(dialog).toBeVisible();
  // Vertrekpunt = de formule: 5 werkdagen uniform ⇒ één fase van 5 dagen op 1 eenheid, 40 uur.
  await expect(dialog.locator('[data-ops-contour-phase]')).toHaveCount(1);
  await expect(dialog.locator('[data-ops-contour-units="0"]')).toHaveValue('1');
  await expect(dialog.locator('[data-ops-contour-total]')).toHaveText('40');

  // Splitsen (knop, halverwege: 2 + 3), dan de tweede fase op een halve ploeg.
  await dialog.locator('[data-ops-contour-split="0"]').click();
  await expect(dialog.locator('[data-ops-contour-phase]')).toHaveCount(2);
  await expect(dialog.locator('[data-ops-contour-days="0"]')).toHaveValue('2');
  await dialog.locator('[data-ops-contour-units="1"]').fill('0,5');
  await expect(dialog.locator('[data-ops-contour-total]')).toHaveText('28');

  // Rasternavigatie zoals in de resourcetabel (issue #48): Enter omlaag, Shift+Enter omhoog, en de
  // afgeleide dagen-cel van de laatste fase wordt overgeslagen.
  await dialog.locator('[data-ops-contour-units="0"]').focus();
  await page.keyboard.press('Enter');
  await expect(dialog.locator('[data-ops-contour-units="1"]')).toBeFocused();
  await page.keyboard.press('Shift+Enter');
  await expect(dialog.locator('[data-ops-contour-units="0"]')).toBeFocused();
  // Navigatie blijft in de eigen kolom: onder dagen[0] ligt alleen de afgeleide dagen-cel van de
  // laatste fase (geen invoerveld), dus Enter vindt geen buur en de focus blijft staan — er wordt
  // geen rij aangemaakt (de laatste fase loopt tot het taakeinde).
  await dialog.locator('[data-ops-contour-days="0"]').focus();
  await page.keyboard.press('Enter');
  await expect(dialog.locator('[data-ops-contour-days="0"]')).toBeFocused();
  await expect(dialog.locator('[data-ops-contour-phase]')).toHaveCount(2);

  // De grens tussen fase 1 en 2 met de muis één werkdag naar rechts slepen (dag 2 → dag 3).
  const strip = dialog.locator('[data-ops-contour-strip]');
  const stripBox = (await strip.boundingBox())!;
  const handle = dialog.locator('[data-ops-contour-boundary="0"]');
  const handleBox = (await handle.boundingBox())!;
  const dayWidth = stripBox.width / 5;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + dayWidth / 2, handleBox.y + handleBox.height / 2, { steps: 4 });
  await page.mouse.move(handleBox.x + handleBox.width / 2 + dayWidth, handleBox.y + handleBox.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(dialog.locator('[data-ops-contour-days="0"]')).toHaveValue('3');
  await expect(dialog.locator('[data-ops-contour-total]')).toHaveText('32');

  // Dubbelklik op de tweede dag van fase 2 (dagindex 4) splitst die fase; samenvoegen maakt het ongedaan.
  const block = dialog.locator('[data-ops-contour-block="1"] rect').first();
  const blockBox = (await block.boundingBox())!;
  await page.mouse.dblclick(blockBox.x + blockBox.width * 0.75, blockBox.y + blockBox.height / 2);
  await expect(dialog.locator('[data-ops-contour-phase]')).toHaveCount(3);
  await dialog.locator('[data-ops-contour-merge="1"]').click();
  await expect(dialog.locator('[data-ops-contour-phase]')).toHaveCount(2);

  await dialog.locator('[data-ops-contour-apply]').click();
  await expect(dialog).toHaveCount(0);

  // Store: één periode per werkdag (opslagvorm), belasting 1/1/1/0,5/0,5, datums ongemoeid.
  await expect.poll(() => contourMinutes(page, taskId)).toEqual([480, 480, 480, 240, 240]);
  await expect.poll(() => loadOf(page, resourceId)).toEqual([1, 1, 1, 0.5, 0.5]);
  await expect.poll(() => page.evaluate((id) => {
    const t = window.__OPS__!.store.getState().tasks.find(x => x.id === id)!;
    return [t.time.earlyStart, t.time.earlyFinish, t.splitGaps ?? null];
  }, taskId)).toEqual(['2026-09-07', '2026-09-11', null]);
  await expect(contourButton).toHaveAttribute('data-ops-assignment-contour', 'contoured');
  await expect(row.locator('[data-ops-assignment-curve]')).toBeDisabled();
  await expect(page.locator('[data-ops-task-timephased]')).toHaveAttribute('data-ops-task-timephased', 'contoured');

  // Heropenen toont dezelfde twee fasen (run-length uit de opslagvorm); ongeldige invoer blokkeert
  // Toepassen; Escape sluit zonder wijziging.
  await contourButton.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-ops-contour-phase]')).toHaveCount(2);
  await expect(dialog.locator('[data-ops-contour-units="1"]')).toHaveValue('0.5');
  await dialog.locator('[data-ops-contour-units="0"]').fill('abc');
  await expect(dialog.locator('[data-ops-contour-apply]')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => loadOf(page, resourceId)).toEqual([1, 1, 1, 0.5, 0.5]);

  // Undo via de store draait de contour terug (één undo-stap voor het toepassen).
  await page.evaluate(() => window.__OPS__!.store.getState().undo());
  await expect.poll(() => contourMinutes(page, taskId)).toBeNull();
  await expect.poll(() => loadOf(page, resourceId)).toEqual([1, 1, 1, 1, 1]);
  await expect(contourButton).toHaveAttribute('data-ops-assignment-contour', 'formula');

  // Vorm toepassen als vertrekpunt (Vooraan belast houdt het totaal en geeft meerdere fasen), dan
  // loslaten via de knop.
  await contourButton.click();
  await dialog.locator('[data-ops-contour-shape]').selectOption('FRONT_LOADED');
  await expect(dialog.locator('[data-ops-contour-total]')).toHaveText('40');
  await expect.poll(() => dialog.locator('[data-ops-contour-phase]').count()).toBeGreaterThan(1);
  await dialog.locator('[data-ops-contour-apply]').click();
  await expect.poll(() => loadOf(page, resourceId).then(l => l[0] > l[4])).toBe(true);
  await contourButton.click();
  await dialog.locator('[data-ops-contour-release]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => contourMinutes(page, taskId)).toBeNull();
  await expect.poll(() => loadOf(page, resourceId)).toEqual([1, 1, 1, 1, 1]);
});
