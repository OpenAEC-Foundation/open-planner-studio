// W2-vervolg (besluit eigenaar "zoals MS Project"): een getypte startdatum op een taak MET
// voorganger wordt een beperking "Start niet eerder dan" (SNET), met een melding. Vóór de fix schreef
// elke route alleen het anker `scheduleStart`; de solver leest dat alleen voor een taak zónder
// voorganger, dus na F5 sprong de taak stil terug achter haar voorganger.
//
// Drie routes, elk met echte toetsen: de Tabel-kolom Start (klik, Enter, typen, Enter), het
// eigenschappenpaneel (datumsegmenten typen, Enter) en Taak bewerken (typen, Opslaan). Herberekenen
// is F5, ongedaan maken Ctrl+Z. De `__OPS__`-brug zet alleen de fixture (A → B) en leest state.
import type { Locator, Page } from '@playwright/test';
import { expect, state, test } from './fixtures/ops';

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
