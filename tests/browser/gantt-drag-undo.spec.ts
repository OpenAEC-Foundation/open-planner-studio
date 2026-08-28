// Karakterisering vóór de structurele Gantt-/store-refactors: de echte canvas-sleep en Ctrl+Z
// moeten samen exact één undoable handeling blijven vormen.
import type { Page } from '@playwright/test';
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

async function canvasRowPoint(page: Page, taskId: string, yOffset = 0): Promise<{ x: number; y: number }> {
  const row = await barPoint(page, taskId);
  const bounds = await page.getByTestId('gantt-primary-canvas').boundingBox();
  expect(bounds).not.toBeNull();
  return { x: bounds!.x + 40, y: row.y + yOffset };
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

// Een Gantt-balk is niet alleen een datumgreep: een overwegend verticale sleep moet dezelfde
// structurele verplaatsing opleveren als het bestaande slepen van de taakrij. Zonder die route
// verschuift een kleine X-afwijking de datum en blijft de taak onterecht op zijn oude plek staan.
test('Gantt-balk vertical slepen verplaatst de taak zonder haar datums te wijzigen', async ({ page, ops: _ops }) => {
  const [firstId, secondId, thirdId] = await seedProject(page, [
    { name: 'Balk die verhuist', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Balk-doel', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Blijft derde', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const before = await state(page);
  const source = await barPoint(page, firstId);
  const target = await barPoint(page, secondId);

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  // Een lichte X-afwijking maakt dit een realistische, maar nog steeds ondubbelzinnig verticale
  // sleep. De onderkant van de doelrij is de bestaande "na deze taak"-zone.
  await page.mouse.move(source.x + 2, target.y + 10, { steps: 5 });
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

// Rode fase vóór de refactor: de listener hield de oude rows/tasksById vast, zag Rij C niet en
// liet Rij A daarom onbewogen staan. De test gebruikt voor de handeling uitsluitend echte muisevents.
test('canvas rowdrag gebruikt actuele rijen en commit na een mid-gesture update precies eenmaal', async ({ page, ops: _ops }) => {
  const [firstId, secondId] = await seedProject(page, [
    { name: 'Rij A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Rij B', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const canvas = page.getByTestId('gantt-primary-canvas');
  const source = await canvasRowPoint(page, firstId);
  const existingTarget = await canvasRowPoint(page, secondId, 10);

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(existingTarget.x, existingTarget.y);
  await expect(canvas).toHaveCSS('cursor', 'grabbing');

  // Fixture-update midden in de echte pointergesture: de nieuwe rij verandert rows/tasksById.
  const thirdId = await addTaskDuringGesture(page, 'Rij C, tijdens sleep toegevoegd');
  const midGesture = await state(page);
  const newTarget = await canvasRowPoint(page, thirdId, 10);

  await page.mouse.move(newTarget.x, newTarget.y);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await page.mouse.up();

  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.at(-1)?.id)).toBe(firstId);
  const dropped = await state(page);
  expect(dropped.tasks.map(task => task.id)).toEqual([secondId, thirdId, firstId]);
  expect(dropped.undoDepth).toBe(midGesture.undoDepth + 1);
});

test('canvas rowdrag Escape annuleert zonder mutatie', async ({ page, ops: _ops }) => {
  const [firstId, secondId] = await seedProject(page, [
    { name: 'Blijft vooraan', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Blijft achteraan', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const before = await state(page);
  const source = await canvasRowPoint(page, firstId);
  const target = await canvasRowPoint(page, secondId, 10);

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y);
  await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', 'grabbing');
  await page.keyboard.press('Escape');
  await page.mouse.up();

  const after = await state(page);
  expect(after.tasks.map(task => task.id)).toEqual(before.tasks.map(task => task.id));
  expect(after.undoDepth).toBe(before.undoDepth);
});
