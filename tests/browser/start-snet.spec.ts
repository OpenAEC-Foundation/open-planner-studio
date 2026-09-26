// W2-vervolg (besluit eigenaar "zoals MS Project"): een getypte startdatum op een taak MET
// voorganger wordt een beperking "Start niet eerder dan" (SNET), met een melding. Vóór de fix schreef
// elke route alleen het anker `scheduleStart`; de solver leest dat alleen voor een taak zónder
// voorganger, dus na F5 sprong de taak stil terug achter haar voorganger.
//
// Vier routes, elk met echte events: de Tabel-kolom Start (klik, Enter, typen, Enter), het
// eigenschappenpaneel (datumsegmenten typen, Enter), Taak bewerken (typen, Opslaan) en de Gantt-balk
// (muis: body verschuiven of linkerrand slepen). Herberekenen is F5, ongedaan maken Ctrl+Z. Heeft de
// taak een andere constraint (MSO, FNLT, …), dan heeft een nieuwe start geen effect: niets
// toepassen, constraint laten staan, melden (besluit eigenaar). De `__OPS__`-brug zet alleen de
// fixture (A → B, eventueel een constraint) en leest state.
import type { Locator, Page } from '@playwright/test';
import { barPoint, expect, state, test } from './fixtures/ops';

const surface = (page: Page) => page.locator('[data-task-grid-surface-id="full-task-grid"]');

function taskCell(page: Page, taskId: string, columnId: string): Locator {
  return surface(page).locator(
    `[data-grid-data-row="true"][data-grid-row-key="${taskId}"] [data-grid-data-cell="true"][data-grid-column-id="${columnId}"]`,
  );
}

/** A (5 werkdagen) → B (3 werkdagen), FS, projectstart ma 01-06-2026: B begint na F5 op 08-06. */
async function seedChain(page: Page): Promise<{ a: string; b: string }> {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setCalendar({ ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [] });
    s.setProject({ startDate: '2026-06-01', name: 'Start wordt SNET' });
    s.setViewStartDate('2026-06-01');
    s.setUI({ dateNotation: 'dmy', showPropertiesPanel: true, rightPanelCollapsed: false });
    const a = s.addTask({ name: 'Fundering', time: { scheduleDuration: 5 } as never });
    const b = s.addTask({ name: 'Metselwerk', time: { scheduleDuration: 3 } as never });
    s.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    s.runCPM();
    return { a, b };
  });
}

async function taskState(page: Page, id: string) {
  return page.evaluate(taskId => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks.find(candidate => candidate.id === taskId)!;
    return {
      constraint: task.constraint ?? null,
      anchor: task.time.scheduleStart,
      start: task.time.earlyStart || task.time.scheduleStart,
    };
  }, id);
}

const toast = (page: Page) => page.locator('.ops-toast[role="status"]');

/** Typ een datum in een gesegmenteerd datumveld zoals een gebruiker: klik in het dag-vakje, cijfers. */
async function typeDate(group: Locator, digits: string): Promise<void> {
  await group.locator('input').first().click();
  await group.page().keyboard.type(digits);
}

test('Tabel: Start typen op een taak met voorganger wordt SNET, F5 toont de datum, Ctrl+Z haalt alles weg', async ({ page, ops: _ops }) => {
  const { b } = await seedChain(page);
  expect((await taskState(page, b)).start).toBe('2026-06-08');
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(surface(page).locator('[role="grid"]')).toBeVisible();

  const cell = taskCell(page, b, 'task.time.start');
  await cell.click();
  await page.keyboard.press('Enter');
  const input = cell.locator('input').first();
  await expect(input).toBeFocused();
  const undoBefore = (await state(page)).undoDepth;
  await input.fill('15-06-2026');
  await page.keyboard.press('Enter');

  await expect.poll(() => taskState(page, b)).toMatchObject({
    constraint: { type: 'SNET', date: '2026-06-15' },
    anchor: '2026-06-15',
  });
  await expect(toast(page)).toContainText('SNET');
  await expect(toast(page)).toContainText('Metselwerk');
  expect((await state(page)).undoDepth).toBe(undoBefore + 1);

  await page.keyboard.press('F5');
  await expect.poll(async () => (await taskState(page, b)).start).toBe('2026-06-15');
  await expect(cell).toHaveText('15-06-2026');

  // Ongedaan maken: eerst de herberekening telt niet mee (runCPM is geen undo-stap), dan in één stap
  // de start én de beperking.
  await cell.click();
  await page.keyboard.press('Control+z');
  await expect.poll(() => taskState(page, b)).toMatchObject({ constraint: null, anchor: '2026-06-01' });
});

test('eigenschappenpaneel: Start typen op een taak met voorganger wordt SNET in één undo-stap', async ({ page, ops: _ops }) => {
  const { b } = await seedChain(page);
  // Fixture: de taak selecteren zodat het paneel haar toont.
  await page.evaluate(id => window.__OPS__!.store.getState().selectTask(id), b);
  const startField = page.locator('[data-ops-rail]').getByRole('group', { name: /^Start$/ });
  await expect(startField.locator('input').first()).toHaveValue('08');

  const undoBefore = (await state(page)).undoDepth;
  await typeDate(startField, '15062026');
  await page.keyboard.press('Enter');

  await expect.poll(() => taskState(page, b)).toMatchObject({
    constraint: { type: 'SNET', date: '2026-06-15' },
    anchor: '2026-06-15',
  });
  await expect(toast(page)).toContainText('SNET');
  expect((await state(page)).undoDepth).toBe(undoBefore + 1);
  // Het paneel toont de beperking meteen in de sectie Constraint.
  await expect(page.locator('[data-ops-rail]').getByRole('group', { name: /^(Constraint date|Constraint-datum)$/ })
    .locator('input').first()).toHaveValue('15');

  // Het veld verlaten committeert niets nieuws: geen tweede, lege undo-stap.
  await page.keyboard.press('Tab');
  expect((await state(page)).undoDepth).toBe(undoBefore + 1);

  await page.keyboard.press('F5');
  await expect.poll(async () => (await taskState(page, b)).start).toBe('2026-06-15');
});

test('Taak bewerken: Startdatum typen op een taak met voorganger wordt SNET bij Opslaan', async ({ page, ops: _ops }) => {
  const { b } = await seedChain(page);
  // Fixture: de dialoog openen zoals het contextmenu/F2 dat doet.
  await page.evaluate(id => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), b);
  const dialog = page.locator('[data-ops-task-dialog]');
  const startField = dialog.getByRole('group', { name: /^(Start date|Startdatum)$/ });
  await expect(startField.locator('input').first()).toHaveValue('08');

  const undoBefore = (await state(page)).undoDepth;
  await typeDate(startField, '15062026');
  await page.keyboard.press('Tab');
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toHaveCount(0);

  await expect.poll(() => taskState(page, b)).toMatchObject({
    constraint: { type: 'SNET', date: '2026-06-15' },
    anchor: '2026-06-15',
  });
  await expect(toast(page)).toContainText('SNET');
  expect((await state(page)).undoDepth).toBe(undoBefore + 1);

  await page.keyboard.press('F5');
  await expect.poll(async () => (await taskState(page, b)).start).toBe('2026-06-15');
});

test('Taak bewerken: een in dezelfde dialoog gekozen constraint wint van de getypte start', async ({ page, ops: _ops }) => {
  const { b } = await seedChain(page);
  await page.evaluate(id => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), b);
  const dialog = page.locator('[data-ops-task-dialog]');
  const startField = dialog.getByRole('group', { name: /^(Start date|Startdatum)$/ });
  await typeDate(startField, '15062026');
  await page.keyboard.press('Tab');
  // De primaire constraintkeuze (de eerste select met de constrainttypes).
  await dialog.locator('select:has(option[value="MSO"])').first().selectOption('MSO');
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toHaveCount(0);

  const after = await taskState(page, b);
  expect(after.constraint).toMatchObject({ type: 'MSO' });
  expect(after.anchor).toBe('2026-06-15');
  await expect(toast(page)).toHaveCount(0);
});

/** Fixture voor de Gantt-sleep: de rechterrail dicht zodat de balken vrij liggen, optioneel een
 *  constraint op B. */
async function seedChainForDrag(
  page: Page,
  constraint?: { type: 'MSO'; date: string },
): Promise<{ a: string; b: string }> {
  const ids = await seedChain(page);
  await page.evaluate(({ b, c }) => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ rightPanelCollapsed: true, showPropertiesPanel: false });
    if (c) s.updateTask(b, { constraint: c });
    window.__OPS__!.store.getState().runCPM();
  }, { b: ids.b, c: constraint });
  return ids;
}

/** Een echte muissleep op de balk: `days` getoonde dagen naar rechts (negatief: links). */
async function dragBar(page: Page, taskId: string, edge: 'body' | 'left' | 'right', days: number): Promise<void> {
  const zoom = await page.evaluate(() => window.__OPS__!.store.getState().view.zoom);
  const point = await barPoint(page, taskId, edge);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + (days * zoom) / 2, point.y, { steps: 6 });
  await page.mouse.move(point.x + days * zoom, point.y, { steps: 6 });
  await page.mouse.up();
}

test('Gantt: balk van een taak met voorganger verschuiven wordt SNET in één undo-stap', async ({ page, ops: _ops }) => {
  const { b } = await seedChainForDrag(page);
  const undoBefore = (await state(page)).undoDepth;
  await dragBar(page, b, 'body', 7);

  await expect.poll(() => taskState(page, b)).toMatchObject({
    constraint: { type: 'SNET', date: '2026-06-15' },
    anchor: '2026-06-15',
  });
  await expect(toast(page)).toContainText('SNET');
  await expect(toast(page)).toContainText('Metselwerk');
  expect((await state(page)).undoDepth).toBe(undoBefore + 1);

  await page.keyboard.press('F5');
  await expect.poll(async () => (await taskState(page, b)).start).toBe('2026-06-15');
  await page.keyboard.press('Control+z');
  await expect.poll(() => taskState(page, b)).toMatchObject({ constraint: null, anchor: '2026-06-01' });
});

test('Gantt: linkerrand slepen wordt SNET op de nieuwe start; vóór de voorganger wint de voorganger', async ({ page, ops: _ops }) => {
  const { b } = await seedChainForDrag(page);
  await dragBar(page, b, 'left', 1);
  await expect.poll(() => taskState(page, b)).toMatchObject({
    constraint: { type: 'SNET', date: '2026-06-09' },
    anchor: '2026-06-09',
  });
  await page.keyboard.press('F5');
  await expect.poll(async () => (await taskState(page, b)).start).toBe('2026-06-09');

  // Vijf dagen vóór wat de voorganger toelaat: de SNET komt er, maar na F5 wint de voorganger.
  await dragBar(page, b, 'body', -6);
  await expect.poll(async () => (await taskState(page, b)).constraint).toEqual({ type: 'SNET', date: '2026-06-03' });
  await page.keyboard.press('F5');
  await expect.poll(async () => (await taskState(page, b)).start).toBe('2026-06-08');
});

test('Gantt: taak met MSO en voorganger slepen past niets toe en meldt de constraint', async ({ page, ops: _ops }) => {
  const { b } = await seedChainForDrag(page, { type: 'MSO', date: '2026-06-10' });
  const before = await taskState(page, b);
  expect(before.start).toBe('2026-06-10');
  const undoBefore = (await state(page)).undoDepth;
  await dragBar(page, b, 'body', 7);

  await expect(toast(page)).toContainText('MSO');
  await expect(toast(page)).toContainText('10-06-2026');
  await expect(toast(page)).not.toContainText('$t(');
  expect(await taskState(page, b)).toEqual(before);
  expect((await state(page)).undoDepth).toBe(undoBefore);
});

test('Gantt: rechterrand en een taak zonder voorganger blijven zonder constraint', async ({ page, ops: _ops }) => {
  const { a, b } = await seedChainForDrag(page);
  await dragBar(page, b, 'right', 2);
  await expect.poll(async () => (await taskState(page, b)).anchor).toBe('2026-06-01');
  await expect.poll(() => page.evaluate(id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration, b))
    .toBe(5);
  expect((await taskState(page, b)).constraint).toBeNull();

  await dragBar(page, a, 'body', 7);
  await expect.poll(async () => (await taskState(page, a)).anchor).toBe('2026-06-08');
  expect((await taskState(page, a)).constraint).toBeNull();
  await expect(toast(page)).toHaveCount(0);
});

test('eigenschappenpaneel: Start typen op een taak met MSO en voorganger meldt de constraint, het veld valt terug', async ({ page, ops: _ops }) => {
  const { b } = await seedChain(page);
  await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    s.updateTask(id, { constraint: { type: 'MSO', date: '2026-06-10' } });
    window.__OPS__!.store.getState().runCPM();
    window.__OPS__!.store.getState().selectTask(id);
  }, b);
  const before = await taskState(page, b);
  const startField = page.locator('[data-ops-rail]').getByRole('group', { name: /^Start$/ });
  await expect(startField.locator('input').first()).toHaveValue('10');

  const undoBefore = (await state(page)).undoDepth;
  await typeDate(startField, '17062026');
  await page.keyboard.press('Enter');

  await expect(toast(page)).toContainText('MSO');
  await expect(startField.locator('input').first()).toHaveValue('10');
  expect(await taskState(page, b)).toEqual(before);
  expect((await state(page)).undoDepth).toBe(undoBefore);
});

test('Taak bewerken: Startdatum typen op een taak met MSO en voorganger meldt de constraint bij Opslaan', async ({ page, ops: _ops }) => {
  const { b } = await seedChain(page);
  await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    s.updateTask(id, { constraint: { type: 'MSO', date: '2026-06-10' } });
    window.__OPS__!.store.getState().runCPM();
    window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id });
  }, b);
  const before = await taskState(page, b);
  const dialog = page.locator('[data-ops-task-dialog]');
  const startField = dialog.getByRole('group', { name: /^(Start date|Startdatum)$/ });
  await typeDate(startField, '17062026');
  await page.keyboard.press('Tab');
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toHaveCount(0);

  await expect(toast(page)).toContainText('MSO');
  expect(await taskState(page, b)).toEqual(before);
});
