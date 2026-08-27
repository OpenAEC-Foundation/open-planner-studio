// Karakterisering vóór pointerextractie: alle concurrerende canvasgebaren lopen door één
// mousedown-prioriteit. De tests gebruiken uitsluitend echte muis-/toetsenbordevents; de
// dev-bridge observeert alleen de resulterende domein- en viewstate.
import type { Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

async function canvasBounds(page: Page) {
  const bounds = await page.getByTestId('gantt-primary-canvas').boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

async function tableRowPoint(page: Page, taskId: string, offsetY = 0) {
  const row = await barPoint(page, taskId);
  const bounds = await canvasBounds(page);
  return { x: bounds.x + 40, y: row.y + offsetY };
}

async function chartBackgroundPoint(page: Page, taskId: string) {
  const row = await barPoint(page, taskId);
  const bounds = await canvasBounds(page);
  return { x: bounds.x + bounds.width - 28, y: row.y };
}

function taskDates(snapshot: Awaited<ReturnType<typeof state>>) {
  return snapshot.tasks.map(task => ({
    id: task.id,
    start: task.scheduleStart,
    finish: task.scheduleFinish,
  }));
}

test('Gantt pointer priority: actieve middelpan weigert een tweede bargesture', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [
    { name: 'Middelpan boven balk', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Maakt de tijdas breed', start: '2027-03-01', finish: '2027-03-12', durationDays: 10 },
  ]);
  await barPoint(page, taskId);
  await page.evaluate(() => window.__OPS__!.store.getState().setScroll(120, 0));
  await expect.poll(() => state(page).then(s => s.view.scrollX)).toBeGreaterThan(0);
  const before = await state(page);
  const point = await barPoint(page, taskId);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'middle' });
  // Terwijl de middelpan actief is, mag een linkse mousedown op dezelfde balk geen bar drag armen.
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(point.x + 64, point.y + 12, { steps: 4 });
  await page.mouse.up({ button: 'left' });
  await page.mouse.move(point.x + 96, point.y + 12, { steps: 3 });
  await page.mouse.up({ button: 'middle' });

  await expect.poll(() => state(page).then(s => s.view.scrollX)).not.toBe(before.view.scrollX);
  const after = await state(page);
  expect(taskDates(after)).toEqual(taskDates(before));
  expect(after.undoDepth).toBe(before.undoDepth);
});

test('Gantt pointer priority: tabelsplitter wint op header, taakrij en achtergrond', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{
    name: 'Splittertaak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }]);
  const before = await state(page);
  const row = await barPoint(page, taskId);

  for (const y of [
    (await canvasBounds(page)).y + 10,
    row.y,
    (await canvasBounds(page)).y + (await canvasBounds(page)).height - 24,
  ]) {
    const bounds = await canvasBounds(page);
    const width = (await state(page)).ui.leftPanelWidth;
    const x = bounds.x + width;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 12, y, { steps: 2 });
    await page.mouse.up();
  }

  await expect.poll(() => state(page).then(s => s.ui.leftPanelWidth))
    .toBe(before.ui.leftPanelWidth + 36);
  const after = await state(page);
  expect(taskDates(after)).toEqual(taskDates(before));
  expect(after.selectedTaskIds).toEqual(before.selectedTaskIds);
  expect(after.undoDepth).toBe(before.undoDepth);
  await expect(page.getByTestId('box-select-rect')).toHaveCount(0);
});

test('Gantt pointer priority: onder de header start geen taakgesture', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{
    name: 'Headertaak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }]);
  const before = await state(page);
  const bounds = await canvasBounds(page);
  const x = bounds.x + before.ui.leftPanelWidth + 80;
  const y = bounds.y + 10;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 80, y + 8, { steps: 4 });
  await page.mouse.up();

  const after = await state(page);
  expect(taskDates(after)).toEqual(taskDates(before));
  expect(after.view.scrollX).toBe(before.view.scrollX);
  expect(after.selectedTaskIds).toEqual([]);
  expect(after.undoDepth).toBe(before.undoDepth);
  await expect(page.getByTestId('box-select-rect')).toHaveCount(0);
  expect(after.tasks[0]?.id).toBe(taskId);
});

for (const mode of ['Shift', 'dependency mode'] as const) {
  test(`Gantt pointer priority: ${mode} start relatie vóór bar drag`, async ({ page, ops: _ops }) => {
    const [sourceId, targetId] = await seedProject(page, [
      { name: `${mode} bron`, start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
      { name: `${mode} doel`, start: '2026-09-21', finish: '2026-09-25', durationDays: 5 },
    ]);
    if (mode === 'dependency mode') {
      await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showDependencyMode: true }));
    }
    const before = await state(page);
    const source = await barPoint(page, sourceId);
    const target = await barPoint(page, targetId);

    if (mode === 'Shift') await page.keyboard.down('Shift');
    await page.mouse.move(source.x, source.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 5 });
    await page.mouse.up();
    if (mode === 'Shift') await page.keyboard.up('Shift');

    // De getrokken relatie is eerst een concept. Klik-buiten bewaart die als één undoable mutatie.
    await expect(page.getByRole('combobox')).toBeVisible();
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await expect.poll(() => state(page).then(s => s.sequences.length)).toBe(1);
    const after = await state(page);
    expect(after.sequences[0]).toMatchObject({
      predecessorId: sourceId,
      successorId: targetId,
      type: 'FINISH_START',
    });
    expect(taskDates(after)).toEqual(taskDates(before));
    expect(after.undoDepth).toBe(before.undoDepth + 1);
  });
}

// Zonder deze annulering blijft een via de popover afgebroken relatie als onzichtbare
// projectmutatie bestaan: zij verschijnt bij undo/redo en meldt ten onrechte succes.
test('Gantt relationpopover Escape annuleert zonder relatie, undo-stap of melding', async ({ page, ops: _ops }) => {
  const [sourceId, targetId] = await seedProject(page, [
    { name: 'Annuleren bron', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Annuleren doel', start: '2026-09-21', finish: '2026-09-25', durationDays: 5 },
  ]);
  const before = await state(page);
  const notificationsBefore = await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications.length);
  const source = await barPoint(page, sourceId);
  const target = await barPoint(page, targetId);

  await page.keyboard.down('Shift');
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.getByRole('combobox')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('combobox')).toHaveCount(0);
  const after = await state(page);
  expect(after.sequences).toEqual(before.sequences);
  expect(after.undoDepth).toBe(before.undoDepth);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications.length))
    .toBe(notificationsBefore);
});

test('Gantt relationpopover bewaart gekozen type en lag als één relatie', async ({ page, ops: _ops }) => {
  const [sourceId, targetId] = await seedProject(page, [
    { name: 'Bewaren bron', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Bewaren doel', start: '2026-09-21', finish: '2026-09-25', durationDays: 5 },
  ]);
  const before = await state(page);
  const source = await barPoint(page, sourceId);
  const target = await barPoint(page, targetId);

  await page.keyboard.down('Shift');
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.getByRole('combobox').selectOption('FINISH_FINISH');
  const lag = page.getByPlaceholder('0d');
  await lag.fill('2d');

  await page.getByRole('button', { name: 'File', exact: true }).click();

  await expect.poll(() => state(page).then(snapshot => snapshot.sequences)).toEqual([
    expect.objectContaining({
      predecessorId: sourceId,
      successorId: targetId,
      type: 'FINISH_FINISH',
      lagDays: 2,
    }),
  ]);
  expect((await state(page)).undoDepth).toBe(before.undoDepth + 1);
});

test('Gantt pointer priority: Ctrl op een balk selecteert zonder drag', async ({ page, ops: _ops }) => {
  const [firstId, secondId] = await seedProject(page, [
    { name: 'Eerste selectie', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Tweede selectie', start: '2026-09-14', finish: '2026-09-18', durationDays: 5 },
  ]);
  await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    s.selectTask(id);
    s.setUI({ showPropertiesPanel: false, rightPanelCollapsed: true });
  }, firstId);
  await expect(page.locator('[data-ops-rail="true"]')).toHaveCount(0);
  const before = await state(page);
  const point = await barPoint(page, secondId);
  const canvas = page.getByTestId('gantt-primary-canvas');
  const bounds = await canvasBounds(page);

  await canvas.click({
    position: { x: point.x - bounds.x, y: point.y - bounds.y },
    modifiers: ['Control'],
  });

  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([firstId, secondId]);
  const after = await state(page);
  expect(taskDates(after)).toEqual(taskDates(before));
  expect(after.undoDepth).toBe(before.undoDepth);
});

test('Gantt pointer priority: alleen tree mode maakt van een kale tabelrij een rowdrag', async ({ page, ops: _ops }) => {
  const [firstId, secondId, thirdId] = await seedProject(page, [
    { name: 'Niet-tree C', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Niet-tree A', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Niet-tree B', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
  ]);
  await page.evaluate(() => window.__OPS__!.store.getState().setSort([
    { field: { src: 'builtin', key: 'name' }, dir: 'asc' },
  ]));
  const before = await state(page);
  const source = await tableRowPoint(page, secondId);
  const target = await tableRowPoint(page, firstId);

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await expect(page.getByTestId('box-select-rect')).toBeVisible();
  await page.mouse.up();

  await expect.poll(() => state(page).then(s => s.selectedTaskIds.length)).toBeGreaterThan(1);
  const after = await state(page);
  expect(after.tasks.map(task => task.id)).toEqual([firstId, secondId, thirdId]);
  expect(after.undoDepth).toBe(before.undoDepth);
});

test('Gantt pointer priority: drag-achtergrond pant en Ctrl maakt daar boxselect van', async ({ page, ops: _ops }) => {
  const ids = await seedProject(page, [
    { name: 'Achtergrond 1', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Achtergrond 2', start: '2026-09-14', finish: '2026-09-18', durationDays: 5 },
    { name: 'Achtergrond 3', start: '2026-09-21', finish: '2026-12-18', durationDays: 65 },
  ]);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ scrollMode: 'drag' });
    s.setScroll(280, 0);
  });
  await expect.poll(() => state(page).then(s => s.view.scrollX)).toBeGreaterThan(0);
  const panStart = await state(page);
  const background = await chartBackgroundPoint(page, ids[0]);

  await page.mouse.move(background.x, background.y);
  await page.mouse.down();
  await page.mouse.move(background.x + 70, background.y + 16, { steps: 4 });
  await expect(page.getByTestId('box-select-rect')).toHaveCount(0);
  await page.mouse.up();
  await expect.poll(() => state(page).then(s => s.view.scrollX)).not.toBe(panStart.view.scrollX);

  const beforeBox = await state(page);
  const boxStart = await chartBackgroundPoint(page, ids[0]);
  const boxEnd = await chartBackgroundPoint(page, ids[2]);
  await page.keyboard.down('Control');
  await page.mouse.move(boxStart.x, boxStart.y);
  await page.mouse.down();
  await page.mouse.move(boxEnd.x, boxEnd.y, { steps: 4 });
  await expect(page.getByTestId('box-select-rect')).toBeVisible();
  await page.mouse.up();
  await page.keyboard.up('Control');

  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual(ids);
  expect((await state(page)).view.scrollX).toBe(beforeBox.view.scrollX);
});

test('Gantt pointer priority: achtergrond buiten drag-mode start boxselect', async ({ page, ops: _ops }) => {
  const ids = await seedProject(page, [
    { name: 'Box 1', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Box 2', start: '2026-09-14', finish: '2026-09-18', durationDays: 5 },
  ]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ scrollMode: 'modifier' }));
  const start = await chartBackgroundPoint(page, ids[0]);
  const end = await chartBackgroundPoint(page, ids[1]);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await expect(page.getByTestId('box-select-rect')).toBeVisible();
  await page.mouse.up();

  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual(ids);
});

test('Gantt pointer priority: Escape annuleert row- en boxgesture zonder mutatie', async ({ page, ops: _ops }) => {
  const ids = await seedProject(page, [
    { name: 'Escape rij A', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Escape rij B', start: '2026-09-14', finish: '2026-09-18', durationDays: 5 },
  ]);
  await page.evaluate(id => window.__OPS__!.store.getState().selectTask(id), ids[0]);
  const before = await state(page);

  const rowStart = await tableRowPoint(page, ids[0]);
  const rowEnd = await tableRowPoint(page, ids[1], 10);
  await page.mouse.move(rowStart.x, rowStart.y);
  await page.mouse.down();
  await page.mouse.move(rowEnd.x, rowEnd.y, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.up();

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ scrollMode: 'modifier' }));
  const boxStart = await chartBackgroundPoint(page, ids[0]);
  const boxEnd = await chartBackgroundPoint(page, ids[1]);
  await page.mouse.move(boxStart.x, boxStart.y);
  await page.mouse.down();
  await page.mouse.move(boxEnd.x, boxEnd.y, { steps: 4 });
  await expect(page.getByTestId('box-select-rect')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();

  const after = await state(page);
  expect(after.tasks.map(task => task.id)).toEqual(before.tasks.map(task => task.id));
  expect(after.selectedTaskIds).toEqual(before.selectedTaskIds);
  expect(after.undoDepth).toBe(before.undoDepth);
  await expect(page.getByTestId('box-select-rect')).toHaveCount(0);
});
