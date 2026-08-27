// Karakterisering vóór store-/Ganttgrenswerk: de afzonderlijke DOM-tabel opent een naamcel via
// het toetsenbord, commit met Enter en bewaart één undo-stap.
import type { Locator, Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

function taskRow(page: Page, taskId: string): Locator {
  return page.locator(`[data-testid="task-cell"][data-task-id="${taskId}"]`).first().locator('..');
}

async function addTableTaskDuringGesture(page: Page, name: string): Promise<string> {
  const id = await page.evaluate((taskName) => {
    const store = window.__OPS__!.store.getState();
    const createdId = store.addTask({ name: taskName, manuallyScheduled: true });
    const current = window.__OPS__!.store.getState().tasks.find(task => task.id === createdId)!;
    window.__OPS__!.store.getState().updateTask(createdId, {
      time: {
        ...current.time,
        scheduleStart: '2026-09-07',
        scheduleFinish: '2026-09-18',
        earlyStart: '2026-09-07',
        earlyFinish: '2026-09-18',
        scheduleDuration: 10,
      },
    });
    window.__OPS__!.store.getState().runCPM();
    return createdId;
  }, name);
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.some(task => task.id === id))).toBe(true);
  return id;
}

async function rowPoint(row: Locator, zone: 'center' | 'after' = 'center'): Promise<{ x: number; y: number }> {
  const bounds = await row.boundingBox();
  expect(bounds).not.toBeNull();
  return {
    x: bounds!.x + Math.min(120, bounds!.width / 2),
    y: zone === 'after' ? bounds!.y + bounds!.height - 2 : bounds!.y + bounds!.height / 2,
  };
}

test('table surface: TableEditor navigeert, commit en Ctrl+Z via echte toetsen', async ({ page, ops: _ops }) => {
  const [firstId, secondId] = await seedProject(page, [
    { name: 'Oorspronkelijke naam', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Volgende rij', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const before = await state(page);

  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const table = page.getByTestId('task-table-editor');
  await expect(table).toBeVisible();
  const nameCell = page.locator(
    `[data-testid="task-cell"][data-task-id="${firstId}"][data-field-key="name"]`,
  );

  // Eén gewone klik vestigt de cursor en opent direct; Escape herstelt rasterfocus. De daarop
  // volgende Enter is de letterlijke toetsenbordhandeling die de cel opnieuw opent.
  await nameCell.locator('.cursor-text').click();
  await expect(nameCell.locator('input')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(table).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator(
    `[data-testid="task-cell"][data-task-id="${secondId}"][data-field-key="name"] .table-cell-cursor`,
  )).toBeVisible();
  await expect.poll(() => state(page).then(snapshot => snapshot.selectedTaskIds)).toEqual([secondId]);
  await page.keyboard.press('ArrowUp');
  await expect(page.locator(
    `[data-testid="task-cell"][data-task-id="${firstId}"][data-field-key="name"] .table-cell-cursor`,
  )).toBeVisible();
  await page.keyboard.press('Enter');

  const input = nameCell.locator('input');
  await expect(input).toBeFocused();
  await input.fill('Naam via toetsenbord');
  await page.keyboard.press('Enter');

  await expect.poll(() => state(page).then(snapshot => (
    snapshot.tasks.find(task => task.id === firstId)?.name
  ))).toBe('Naam via toetsenbord');
  const committed = await state(page);
  expect(committed.undoDepth).toBe(before.undoDepth + 1);

  // Enter navigeert volgens bestaand tabelgedrag naar de volgende rij; Escape geeft het globale
  // Ctrl+Z-pad daarna weer de focus zonder een tweede mutatie te veroorzaken.
  await page.keyboard.press('Escape');
  await expect(table).toBeFocused();
  await page.keyboard.press('Control+z');

  await expect.poll(() => state(page).then(snapshot => (
    snapshot.tasks.find(task => task.id === firstId)?.name
  ))).toBe('Oorspronkelijke naam');
  const restored = await state(page);
  expect(restored.undoDepth).toBe(before.undoDepth);
  expect(restored.redoDepth).toBe(before.redoDepth + 1);
});

// Rode fase vóór de refactor: de nieuwe DOM-rij bestond zichtbaar, maar de listener hield de oude
// rows/tasksById vast en kon er geen droptarget voor tekenen. De drag zelf gebruikt echte muisevents.
test('table surface: rowdrag gebruikt actuele DOM-rijen en commit eenmaal', async ({ page, ops: _ops }) => {
  const [firstId, secondId] = await seedProject(page, [
    { name: 'Tabelrij A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Tabelrij B', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const source = await rowPoint(taskRow(page, firstId));
  const existingTargetRow = taskRow(page, secondId);
  const existingTarget = await rowPoint(existingTargetRow, 'after');

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(existingTarget.x, existingTarget.y);
  await expect.poll(() => existingTargetRow.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none');

  // Fixture-update midden in de echte pointergesture: DOM-index, rows en tasksById veranderen.
  const thirdId = await addTableTaskDuringGesture(page, 'Tabelrij C, tijdens sleep toegevoegd');
  const midGesture = await state(page);
  const newTargetRow = taskRow(page, thirdId);
  const newTarget = await rowPoint(newTargetRow, 'after');

  await page.mouse.move(newTarget.x, newTarget.y);
  await expect.poll(() => newTargetRow.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none');
  await page.mouse.up();

  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.at(-1)?.id)).toBe(firstId);
  const dropped = await state(page);
  expect(dropped.tasks.map(task => task.id)).toEqual([secondId, thirdId, firstId]);
  expect(dropped.undoDepth).toBe(midGesture.undoDepth + 1);
});

test('table surface: rowdrag Escape annuleert zonder mutatie', async ({ page, ops: _ops }) => {
  const [firstId, secondId] = await seedProject(page, [
    { name: 'Tabel vooraan', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Tabel achteraan', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const before = await state(page);
  const source = await rowPoint(taskRow(page, firstId));
  const targetRow = taskRow(page, secondId);
  const target = await rowPoint(targetRow, 'after');

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y);
  await expect.poll(() => targetRow.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none');
  await page.keyboard.press('Escape');
  await page.mouse.up();

  const after = await state(page);
  expect(after.tasks.map(task => task.id)).toEqual(before.tasks.map(task => task.id));
  expect(after.undoDepth).toBe(before.undoDepth);
});

test('table surface: canvas- en DOM-rowdrag leveren dezelfde zichtbare rijuitkomst', async ({ page, ops: _ops }) => {
  const [firstId, secondId, thirdId] = await seedProject(page, [
    { name: 'Gedeeld A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Gedeeld B', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Gedeeld C', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const before = await state(page);
  const canvas = page.getByTestId('gantt-primary-canvas');
  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds).not.toBeNull();
  const sourceRow = await barPoint(page, firstId);
  const targetRow = await barPoint(page, thirdId);
  const source = { x: canvasBounds!.x + 40, y: sourceRow.y };
  const target = { x: canvasBounds!.x + 40, y: targetRow.y + 10 };

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await expect(canvas).toHaveCSS('cursor', 'grabbing');
  await page.mouse.up();
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.map(task => task.id)))
    .toEqual([secondId, thirdId, firstId]);
  const canvasResult = await state(page);

  await page.keyboard.press('Control+z');
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.map(task => task.id)))
    .toEqual([firstId, secondId, thirdId]);

  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const domSource = await rowPoint(taskRow(page, firstId));
  const domTarget = await rowPoint(taskRow(page, thirdId), 'after');
  await page.mouse.move(domSource.x, domSource.y);
  await page.mouse.down();
  await page.mouse.move(domTarget.x, domTarget.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.map(task => task.id)))
    .toEqual([secondId, thirdId, firstId]);
  const domResult = await state(page);

  expect(domResult.viewRows).toEqual(canvasResult.viewRows);
  expect(domResult.selectedTaskIds).toEqual(canvasResult.selectedTaskIds);
  expect(domResult.undoDepth).toBe(before.undoDepth + 1);
  expect(canvasResult.undoDepth).toBe(before.undoDepth + 1);
});
