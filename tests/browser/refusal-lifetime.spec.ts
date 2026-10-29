// Eigenaarsbesluiten 2026-10-19 (PR #375).
//  5a: *Taak* met een selectie buiten boommodus zet de taak achteraan en meldt dat met een RODE
//      toast (geen strook), met de knop *Wissen* die filter, groepering en sortering wist.
//  5b: een weigering verdwijnt na een undo- of redo-stap en bij een documentwissel. Echte fouten
//      blijven (headless bewaakt in tests/planning/check-refusal-lifetime.ts).
// Route 2 (Insert, Ctrl+I) en in-/uitspringen houden de strook.
//
// Echte events: lintknoppen, klikken in het raster, typen, Ctrl+Z/Ctrl+Y, Bestand › Voorbeelden,
// tabklik. De `__OPS__`-brug zet alleen fixtures (project, taal) en leest state.
//
// Schermbewijs: `OPS_REFUSAL_SHOTS=<map>` maakt van de *Taak*-toast een PNG in licht en donker.
import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';
import { LOCALE_CASES, chooseLocale } from './fixtures/locale';

const SHOTS = process.env.OPS_REFUSAL_SHOTS;
const RESOURCE_DIAGRAM = '[data-ops-layout-button="builtin:resource-diagram"] button';
const NL_TEXT = 'De nieuwe taak staat achteraan. Tijdens filteren, groeperen of sorteren kan de app hem niet onder je selectie zetten.';

const S = (page: Page) => ({
  view: () => page.evaluate(() => {
    const v = window.__OPS__!.store.getState().view;
    return { group: v.group, sort: v.sort, filter: v.filter };
  }),
  tasks: () => page.evaluate(() => window.__OPS__!.store.getState().tasks.map(t => ({ id: t.id, name: t.name }))),
  selected: () => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds),
});

async function seedWithResources(page: Page): Promise<void> {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Casco', start: '2026-09-21', finish: '2026-10-16', durationDays: 20 },
    { name: 'Gevel', start: '2026-10-19', finish: '2026-10-30', durationDays: 10 },
  ], 'Weigering achteraan');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const [fundering, casco, gevel] = s.tasks.map(task => task.id);
    const ploeg = s.addResource({ name: 'Ploeg A', type: 'CREW', description: '', maxUnits: 1 });
    s.assignResource(fundering, ploeg, 1);
    s.assignResource(casco, ploeg, 1);
    s.assignResource(gevel, ploeg, 1);
    window.__OPS__!.store.getState().runCPM();
  });
}

const nameCell = (page: Page, name: string) => page.locator('[data-grid-data-row="true"] [data-grid-column-id="task.name"]', { hasText: name }).first();

async function shoot(page: Page, target: Locator, name: string): Promise<void> {
  if (!SHOTS) return;
  const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme);
  const viewport = page.viewportSize()!;
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
    await page.waitForTimeout(300);
    const b = (await target.boundingBox())!;
    // De toast met wat raster erboven, zodat te zien is waar hij staat.
    const pad = 24;
    const x = Math.max(b.x - 260, 0);
    const y = Math.max(b.y - 220, 0);
    const clip = { x, y, width: Math.min(b.width + 520, viewport.width - x), height: Math.min(b.y + b.height + pad, viewport.height) - y };
    await page.screenshot({ path: `${SHOTS}/${name}-${theme === 'light' ? 'licht' : 'donker'}.png`, clip });
  }
  await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), before);
}

async function openExample(page: Page, title: RegExp): Promise<void> {
  await page.locator('.ribbon-tab--file').first().click();
  await page.locator('button.backstage-nav-item[data-tour-anchor="backstage-examples"]').click();
  await page.locator('button.backstage-export-card').filter({ has: page.locator('h4', { hasText: title }) }).first().click();
  // Wacht tot het gekozen voorbeeld echt actief is. Alleen `tasks.length > 5` is bij een tweede
  // voorbeeld al waar vóór de wissel (dan staat het vorige document nog open): race op de CI.
  await expect.poll(() => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return { name: s.project.name, tasks: s.tasks.length };
  }).then(({ name, tasks }) => title.test(name) && tasks > 5)).toBe(true);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showPropertiesPanel: true, rightPanelCollapsed: false }));
}

/** Duurweigering op WBS 4.14 van De Akkers (50 % gedaan, duur 4): typ 1 in *Duur*. */
async function refuseDuration(page: Page): Promise<{ id: string; toast: Locator }> {
  const id = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks.find(t => t.name === 'Upper floor slab — House 4')!;
    s.selectTask(task.id);
    return task.id;
  });
  await typeDuration(page, '1');
  const toast = page.locator('.ops-toast.toast-error', { hasText: /Upper floor slab — House 4/ });
  await expect(toast).toHaveCount(1);
  return { id, toast };
}

async function typeDuration(page: Page, value: string): Promise<void> {
  const field = page.locator('[data-ops-rail] [data-ops-duration-value]');
  await field.click();
  await field.fill('');
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
}

const duration = (page: Page, id: string) => page.evaluate(taskId =>
  window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!.time.scheduleDuration, id);

test('5a: Taak onder Resourcediagram ⇒ taak achteraan, rode toast (nl) zonder strook, Wissen wist de weergave en sluit de toast', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await chooseLocale(page, LOCALE_CASES.find(l => l.code === 'nl')!);
  await seedWithResources(page);

  await page.getByRole('button', { name: /^Beeld$/ }).click();
  await page.locator(RESOURCE_DIAGRAM).click();
  expect((await S(page).view()).group).toEqual([{ field: { src: 'resource' }, dir: 'asc' }]);

  await nameCell(page, 'Fundering').click();
  const fundering = (await S(page).tasks()).find(t => t.name === 'Fundering')!.id;
  await expect.poll(() => S(page).selected()).toEqual([fundering]);

  const before = await S(page).tasks();
  await page.getByRole('button', { name: /^Start$/ }).click();
  await page.locator('[data-ops-ribbon-item="addTask"]').first().click();

  // De taak komt er wél, en wel achteraan.
  await expect.poll(async () => (await S(page).tasks()).length).toBe(before.length + 1);
  const after = await S(page).tasks();
  const added = after[after.length - 1];
  expect(before.some(t => t.id === added.id)).toBe(false);
  expect(await S(page).selected()).toEqual([added.id]);

  // Rode weigeringstoast met de letterlijke nl-tekst; geen strook.
  const toast = page.locator('.ops-toast', { hasText: NL_TEXT });
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveClass(/toast-error/);
  await expect(toast).toHaveAttribute('role', 'alert');
  await expect(page.locator('[data-ops-structure-locked]')).toHaveCount(0);
  const clear = toast.locator('[data-ops-notification-action="clearViewArrangement"]');
  await expect(clear).toHaveText('Wissen');
  // Naamveld heeft de focus na *Taak*; los die eerst, zodat de foto de toast toont zoals hij blijft.
  await page.keyboard.press('Escape');
  await shoot(page, toast, 'taak-achteraan');

  await clear.click();
  await expect(toast).toHaveCount(0);
  expect(await S(page).view()).toEqual({ group: [], sort: [], filter: null });
  // De taak blijft staan.
  expect((await S(page).tasks()).some(t => t.id === added.id)).toBe(true);
});

test('5b: duurweigering ⇒ geslaagde bewerking + Ctrl+Z ⇒ toast weg; nieuwe weigering + Ctrl+Y ⇒ toast weg', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openExample(page, /De Akkers/);
  const { id, toast } = await refuseDuration(page);
  expect(await duration(page, id)).toBe(4);

  // Een geslaagde bewerking laat de weigering staan (blijft tot het kruisje).
  await typeDuration(page, '6');
  await expect.poll(() => duration(page, id)).toBe(6);
  await expect(toast).toHaveCount(1);

  // Ctrl+Z buiten het invoerveld: de stap gaat terug en de weigering verdwijnt.
  await nameCell(page, 'Upper floor slab — House 4').click();
  await page.keyboard.press('Control+z');
  await expect.poll(() => duration(page, id)).toBe(4);
  await expect(toast).toHaveCount(0);

  // Opnieuw weigeren, dan Ctrl+Y (redo): ook weg.
  await refuseDuration(page);
  await nameCell(page, 'Upper floor slab — House 4').click();
  await page.keyboard.press('Control+y');
  await expect.poll(() => duration(page, id)).toBe(6);
  await expect(toast).toHaveCount(0);
});

test('5b: weigering ⇒ ander document openen ⇒ toast weg, en terug naar het eerste tabblad brengt hem niet terug', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openExample(page, /De Akkers/);
  const akkers = await page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId);
  const { toast } = await refuseDuration(page);

  await openExample(page, /Refurbishment/);
  const other = await page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId);
  expect(other).not.toBe(akkers);
  await expect(toast).toHaveCount(0);

  await page.locator(`[data-ops-tab="${akkers}"]`).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId)).toBe(akkers);
  await expect(toast).toHaveCount(0);

  // Alleen een tabwissel (geen openen): opnieuw weigeren in De Akkers, dan het andere tabblad.
  await refuseDuration(page);
  await page.locator(`[data-ops-tab="${other}"]`).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId)).toBe(other);
  await expect(toast).toHaveCount(0);
});

test('5a/5b: Insert en Ctrl+I onder groepering geven nog steeds de strook; Ctrl+Z sluit hem', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await seedWithResources(page);
  // Fixture: een bewerking om straks terug te draaien, daarna de groepering.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.updateTask(s.tasks[2].id, { name: 'Gevel (oud)' });
    window.__OPS__!.store.getState().setGroup([{ field: { src: 'resource' }, dir: 'asc' }]);
  });
  const count = (await S(page).tasks()).length;
  const strip = page.locator('[data-ops-structure-locked]');

  await nameCell(page, 'Fundering').click();
  await page.keyboard.press('Insert');
  await expect(strip).toBeVisible();
  await expect(page.locator('.ops-toast')).toHaveCount(0);
  expect((await S(page).tasks()).length).toBe(count);

  await strip.getByTitle('Close', { exact: true }).click();
  await expect(strip).toHaveCount(0);
  await nameCell(page, 'Fundering').click();
  await page.keyboard.press('Control+i');
  await expect(strip).toBeVisible();
  await expect(page.locator('.ops-toast')).toHaveCount(0);
  expect((await S(page).tasks()).length).toBe(count);

  // 5b: na een undo-stap is de strook weg.
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.some(t => t.name === 'Gevel'))).toBe(true);
  await expect(strip).toHaveCount(0);
});
