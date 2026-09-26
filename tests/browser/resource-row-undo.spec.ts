// Resource hernoemen en tarief typen in de Projectweergave van het resourcepaneel (audit
// resources-kalenders R9). Vroeger schreef elk teken `updateResource`: "Torenkraan" typen gaf tien
// undo-stappen, Ctrl+Z haalde één letter weg, en alles-selecteren + Backspace zette een lege naam in
// de store en de undo-geschiedenis. Nu committeert het veld bij verlaten (zelfde draft als de
// Bibliotheekweergave): één undo-stap, en een lege naam nooit.
// Typen, Tab, klikken en Ctrl+Z zijn echte browser-events; `window.__OPS__` zet alleen de resource
// klaar, opent het paneel en leest state.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

async function openProjectResources(page: Page): Promise<string> {
  const id = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const rid = s.addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
    s.setUI({ activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false, resourcesView: 'project' });
    return rid;
  });
  await expect(page.locator(`[data-ops-grid-cell="${id}:name"]`)).toBeVisible();
  return id;
}

const resource = (page: Page, id: string) => page.evaluate((rid) => {
  const s = window.__OPS__!.store.getState();
  const r = s.resources.find(x => x.id === rid)!;
  return {
    name: r.name,
    costPerHour: r.costPerHour ?? null,
    undo: s.historyEvents.filter(e => e.state === 'applied').length,
  };
}, id);

/** Veld verlaten door op een kolomkop te klikken: de focus gaat naar de pagina, niet naar een ander
 *  invoerveld — zodat Ctrl+Z daarna de sneltoets van de app is en niet die van een typveld. */
async function leaveField(page: Page): Promise<void> {
  await page.locator('thead th').nth(1).click();
}

test('projectweergave: hernoemen is één undo-stap en Ctrl+Z zet de oude naam volledig terug', async ({ page, ops: _ops }) => {
  const id = await openProjectResources(page);
  const name = page.locator(`[data-ops-grid-cell="${id}:name"]`);
  const before = await resource(page, id);

  await name.click();
  await name.press('ControlOrMeta+a');
  await page.keyboard.type('Torenkraan', { delay: 20 });
  // Tijdens het typen verandert er nog niets in de store.
  expect(await resource(page, id)).toEqual(before);
  await leaveField(page);

  const after = await resource(page, id);
  expect(after.name).toBe('Torenkraan');
  expect(after.undo - before.undo).toBe(1);

  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => resource(page, id).then(r => r.name)).toBe('Kraan');
  await expect(name).toHaveValue('Kraan');
});

test('projectweergave: een lege naam komt niet in de store of de undo-geschiedenis', async ({ page, ops: _ops }) => {
  const id = await openProjectResources(page);
  const name = page.locator(`[data-ops-grid-cell="${id}:name"]`);
  const before = await resource(page, id);

  await name.click();
  await name.press('ControlOrMeta+a');
  await name.press('Backspace');
  expect(await resource(page, id)).toEqual(before);
  await name.press('Tab');

  expect(await resource(page, id)).toEqual(before);
  await expect(name).toHaveValue('Kraan');
});

test('projectweergave: tarief typen is één undo-stap', async ({ page, ops: _ops }) => {
  const id = await openProjectResources(page);
  const rate = page.locator(`[data-ops-grid-cell="${id}:cost"]`);
  const before = await resource(page, id);

  await rate.click();
  await page.keyboard.type('125', { delay: 20 });
  expect(await resource(page, id)).toEqual(before);
  await leaveField(page);

  const after = await resource(page, id);
  expect(after.costPerHour).toBe(125);
  expect(after.undo - before.undo).toBe(1);

  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => resource(page, id).then(r => r.costPerHour)).toBeNull();
  await expect(rate).toHaveValue('');
});
