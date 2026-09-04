// Karakterisering vóór de structurele Gantt-/store-refactors: de echte canvas-sleep en Ctrl+Z
// moeten samen exact één undoable handeling blijven vormen.
import type { Locator, Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

async function addTaskDuringGesture(page: Page, name: string): Promise<string> {
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

function ganttTaskRow(page: Page, taskId: string): Locator {
  return page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`,
  );
}

async function rowPoint(row: Locator, zone: 'center' | 'after' = 'center'): Promise<{ x: number; y: number }> {
  const bounds = await row.boundingBox();
  expect(bounds).not.toBeNull();
  return {
    x: bounds!.x + Math.min(120, bounds!.width / 2),
    y: zone === 'after' ? bounds!.y + bounds!.height - 2 : bounds!.y + bounds!.height / 2,
  };
}

test('Gantt bodydrag wijzigt de datum en Ctrl+Z herstelt exact één handeling', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{
    name: 'Sleepbare taak',
    start: '2026-09-07',
    finish: '2026-09-18',
    durationDays: 10,
  }]);
  const before = await state(page);
  const beforeTask = before.tasks.find(task => task.id === taskId)!;
  const point = await barPoint(page, taskId);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 72, point.y, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => state(page).then(snapshot => (
    snapshot.tasks.find(task => task.id === taskId)?.scheduleStart
  ))).not.toBe(beforeTask.scheduleStart);
  const dragged = await state(page);
  expect(dragged.undoDepth).toBe(before.undoDepth + 1);
  expect(dragged.redoDepth).toBe(0);

  await page.keyboard.press('Control+z');

  await expect.poll(() => state(page).then(snapshot => (
    snapshot.tasks.find(task => task.id === taskId)?.scheduleStart
  ))).toBe(beforeTask.scheduleStart);
  const restored = await state(page);
  const restoredTask = restored.tasks.find(task => task.id === taskId)!;
  expect(restoredTask.scheduleFinish).toBe(beforeTask.scheduleFinish);
  expect(restored.undoDepth).toBe(before.undoDepth);
  expect(restored.redoDepth).toBe(before.redoDepth + 1);
});

// De gedeelde DOM-taakgrid bezit de structurele rijdrag; het tijdlijncanvas bezit uitsluitend
// datumgebaren. Slepen binnen de Gantt-rij verplaatst dus wel de taak, maar nooit haar datums.
test('Gantt-rij vertical slepen verplaatst de taak zonder haar datums te wijzigen', async ({ page, ops: _ops }) => {
  const [firstId, secondId, thirdId] = await seedProject(page, [
    { name: 'Balk die verhuist', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Balk-doel', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Blijft derde', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const before = await state(page);
  const source = await rowPoint(ganttTaskRow(page, firstId));
  const targetRow = ganttTaskRow(page, secondId);
  const target = await rowPoint(targetRow, 'after');

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(source.x + 2, target.y, { steps: 5 });
  await expect(targetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
  await page.mouse.up();

  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.map(task => task.id)))
    .toEqual([secondId, firstId, thirdId]);
  const after = await state(page);
  expect(after.tasks.find(task => task.id === firstId)).toMatchObject({
    scheduleStart: '2026-09-07',
    scheduleFinish: '2026-09-18',
  });
  expect(after.undoDepth).toBe(before.undoDepth + 1);
});

for (const edge of ['left', 'right'] as const) {
  test(`Gantt ${edge}-randdrag wijzigt de juiste grens in één undoable handeling`, async ({ page, ops: _ops }) => {
    const [taskId] = await seedProject(page, [{
      name: `${edge}-randtaak`,
      start: '2026-09-07',
      finish: '2026-09-18',
      durationDays: 10,
    }]);
    await page.evaluate(() => window.__OPS__!.store.getState().setUI({
      showPropertiesPanel: false,
      rightPanelCollapsed: true,
    }));
    await expect(page.locator('[data-ops-rail="true"]')).toHaveCount(0);
    const before = await state(page);
    const beforeTask = before.tasks.find(task => task.id === taskId)!;
    const point = await barPoint(page, taskId, edge);
    // Vier kalenderdagen kruisen vanaf ma/vr ook werkelijk een werkdaggrens; twee dagen zouden
    // uitsluitend in het weekend landen en door de bestaande canonicalisatie terecht no-op zijn.
    const delta = edge === 'left' ? -120 : 120;

    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', 'ew-resize');
    await page.mouse.move(point.x + delta, point.y, { steps: 5 });
    await page.mouse.up();

    await expect.poll(() => state(page).then(snapshot => {
      const task = snapshot.tasks.find(candidate => candidate.id === taskId)!;
      return edge === 'left' ? task.scheduleStart : task.scheduleFinish;
    })).not.toBe(edge === 'left' ? beforeTask.scheduleStart : beforeTask.scheduleFinish);
    const after = await state(page);
    const afterTask = after.tasks.find(task => task.id === taskId)!;
    if (edge === 'left') expect(afterTask.scheduleFinish).toBe(beforeTask.scheduleFinish);
    else expect(afterTask.scheduleStart).toBe(beforeTask.scheduleStart);
    expect(after.undoDepth).toBe(before.undoDepth + 1);
  });
}

// De ingebedde Gantt-grid gebruikt tijdens de lopende pointergesture steeds de actuele DOM-rijen.
test('Gantt-grid rowdrag gebruikt actuele rijen en commit na een mid-gesture update precies eenmaal', async ({ page, ops: _ops }) => {
  const [firstId, secondId] = await seedProject(page, [
    { name: 'Rij A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Rij B', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const source = await rowPoint(ganttTaskRow(page, firstId));
  const existingTargetRow = ganttTaskRow(page, secondId);
  const existingTarget = await rowPoint(existingTargetRow, 'after');

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(existingTarget.x, existingTarget.y);
  await expect(existingTargetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);

  // Fixture-update midden in de echte pointergesture: de nieuwe rij verandert rows/tasksById.
  const thirdId = await addTaskDuringGesture(page, 'Rij C, tijdens sleep toegevoegd');
  const midGesture = await state(page);
  const newTargetRow = ganttTaskRow(page, thirdId);
  const newTarget = await rowPoint(newTargetRow, 'after');

  await page.mouse.move(newTarget.x, newTarget.y);
  await expect(newTargetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
  await page.mouse.up();

  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.at(-1)?.id)).toBe(firstId);
  const dropped = await state(page);
  expect(dropped.tasks.map(task => task.id)).toEqual([secondId, thirdId, firstId]);
  expect(dropped.undoDepth).toBe(midGesture.undoDepth + 1);
});

test('Gantt-grid rowdrag Escape annuleert zonder mutatie', async ({ page, ops: _ops }) => {
  const [firstId, secondId] = await seedProject(page, [
    { name: 'Blijft vooraan', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Blijft achteraan', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const before = await state(page);
  const source = await rowPoint(ganttTaskRow(page, firstId));
  const targetRow = ganttTaskRow(page, secondId);
  const target = await rowPoint(targetRow, 'after');

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y);
  await expect(targetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
  await page.keyboard.press('Escape');
  await page.mouse.up();

  const after = await state(page);
  expect(after.tasks.map(task => task.id)).toEqual(before.tasks.map(task => task.id));
  expect(after.undoDepth).toBe(before.undoDepth);
});
