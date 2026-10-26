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

  // Zonder toewijzingen verwijdert de prullenbak direct, met één herstelbare stap.
  const row = page.locator(`[data-ops-grid-row="${id}"]`);
  const remove = row.getByTitle(/^(Verwijderen|Delete)$/);
  const clickRemove = async () => {
    // TooltipHost haalt title tijdens hover weg. Eerst vertrekken herstelt het attribuut,
    // ook wanneer de knop na verwijderen/undo onder de stilstaande muis terugkwam.
    await page.mouse.move(0, 0);
    await remove.click();
  };
  const beforeEmptyRemove = await resource(page, id);
  await clickRemove();
  await expect(row).toHaveCount(0);
  await expect(page.getByTitle(/^(Annuleren|Cancel)$/)).toHaveCount(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().historyEvents.filter(e => e.state === 'applied').length))
    .toBe(beforeEmptyRemove.undo + 1);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(name).toHaveValue('Kraan');

  const { tasks, other } = await page.evaluate(rid => {
    const g = () => window.__OPS__!.store.getState();
    const tasks = [g().addTask({ name: 'Hijswerk' }), g().addTask({ name: 'Montage' })];
    const other = g().addResource({ name: 'Hulpploeg', type: 'LABOR', description: '', maxUnits: 1 });
    g().assignResource(tasks[0], rid, 1);
    g().assignResource(tasks[0], other, 1);
    return { tasks, other };
  }, id);
  const data = () => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return {
      resources: s.resources,
      assignments: s.assignments,
      tasks: s.tasks.map(t => ({ id: t.id, resourceIds: t.resourceIds })),
      undo: s.historyEvents.filter(e => e.state === 'applied').length,
    };
  });
  const question = page.getByText(/^'Kraan' (heeft \d+ toewijzing\(en\) — verwijderen\?|has \d+ assignment\(s\) — delete\?)$/);
  const countText = (count: number) => new RegExp(String.raw`^'Kraan' (heeft ${count} toewijzing\(en\) — verwijderen\?|has ${count} assignment\(s\) — delete\?)$`);
  const beforeQuestion = await data();
  expect(beforeQuestion.assignments.filter(a => a.resourceId === id)).toHaveLength(1);
  await expect(row).toBeVisible();
  await clickRemove();
  await expect(question).toHaveText(countText(1));
  expect(await data()).toEqual(beforeQuestion);

  // Een open vraag volgt ook externe toewijzingswijzigingen; de telling is geen cache.
  await page.evaluate(({ task, rid }) => window.__OPS__!.store.getState().assignResource(task, rid, 1), { task: tasks[1], rid: id });
  await expect(question).toHaveText(countText(2));
  await page.evaluate(rid => {
    const g = () => window.__OPS__!.store.getState();
    for (const a of g().assignments.filter(a => a.resourceId === rid)) g().unassignResource(a.id);
  }, id);
  await expect(question).toHaveText(countText(0));
  await page.evaluate(({ tasks, rid }) => {
    for (const task of tasks) window.__OPS__!.store.getState().assignResource(task, rid, 1);
  }, { tasks, rid: id });
  await expect(question).toHaveText(countText(2));

  const beforeCancel = await data();
  await page.mouse.move(0, 0);
  await row.getByTitle(/^(Annuleren|Cancel)$/).click();
  await expect(question).toHaveCount(0);
  expect(await data()).toEqual(beforeCancel);
  await clickRemove();
  await expect(question).toHaveText(countText(2));
  await clickRemove();
  await expect(row).toHaveCount(0);
  const afterRemove = await data();
  expect(afterRemove.undo).toBe(beforeCancel.undo + 1);
  expect(afterRemove.resources).toEqual(beforeCancel.resources.filter(r => r.id !== id));
  expect(afterRemove.assignments).toEqual(beforeCancel.assignments.filter(a => a.resourceId === other));
  expect(afterRemove.tasks).toEqual(beforeCancel.tasks.map(t => ({ ...t, resourceIds: t.resourceIds.filter(rid => rid !== id) })));

  await page.keyboard.press('ControlOrMeta+z');
  await expect(name).toHaveValue('Kraan');
  expect(await data()).toEqual(beforeCancel);
  await expect(question).toHaveCount(0);
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
