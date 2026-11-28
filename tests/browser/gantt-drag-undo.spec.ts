import type { Locator, Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

test.use({ viewport: { width: 1600, height: 900 } });

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

  const milestoneId = await page.evaluate((predecessorId) => {
    const s = window.__OPS__!.store.getState();
    const id = s.addTask({ name: 'Oplevering', isMilestone: true });
    window.__OPS__!.store.getState().addSequence({ predecessorId, successorId: id, type: 'FINISH_FINISH', lagDays: 0 });
    window.__OPS__!.store.getState().runCPM();
    return id;
  }, taskId);
  const milestoneTime = () => page.evaluate((id) => {
    const t = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
    return { start: t.time.scheduleStart, finish: t.time.scheduleFinish, duration: t.time.scheduleDuration };
  }, milestoneId);
  const msBefore = await milestoneTime();
  expect(msBefore.duration).toBe(0);
  const msUndoBefore = (await state(page)).undoDepth;
  for (const edge of ['body', 'right'] as const) {
    const msPoint = await barPoint(page, milestoneId, edge);
    await page.mouse.move(msPoint.x - (edge === 'right' ? 1 : 0), msPoint.y);
    await page.mouse.down();
    await page.mouse.move(msPoint.x + 72, msPoint.y, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => milestoneTime().then(t => t.start)).not.toBe(msBefore.start);
    const moved = await milestoneTime();
    expect(moved.finish).toBe(moved.start);
    expect(moved.duration).toBe(0);
    expect((await state(page)).undoDepth).toBe(msUndoBefore + 1);
    await page.keyboard.press('Control+z');
    await expect.poll(() => milestoneTime()).toEqual(msBefore);
  }
  const msPoint = await barPoint(page, milestoneId);
  await page.mouse.move(msPoint.x, msPoint.y);
  await page.mouse.down();
  await page.mouse.move(msPoint.x + 72, msPoint.y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => milestoneTime().then(t => t.start)).not.toBe(msBefore.start);
  const dropped = await milestoneTime();
  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  const calculated = await page.evaluate((id) => {
    const t = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
    return { start: t.time.earlyStart, constraint: t.constraint?.type };
  }, milestoneId);
  expect(calculated).toEqual({ start: dropped.start, constraint: 'SNET' });

  const looseId = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const b = [{ start: 0, end: 1440 }];
    s.setCalendar({
      ...s.calendar, workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 24,
      simpleBreakStartMinute: undefined, simpleBreakDurationMinutes: undefined,
      workTime: { byWeekday: { 1: b, 2: b, 3: b, 4: b, 5: b, 6: b, 7: b } },
    });
    const id = window.__OPS__!.store.getState().addTask({ name: 'Los moment', isMilestone: true });
    window.__OPS__!.store.getState().runCPM();
    return id;
  });
  const looseTime = () => page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.time, looseId);
  const looseName = () => page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.name, looseId);
  await page.evaluate((id) => window.__OPS__!.store.getState().updateTask(id, { name: 'Eerst hernoemd' }), looseId);
  const looseBefore = await looseTime();
  const looseUndo = (await state(page)).undoDepth;
  const loosePoint = await barPoint(page, looseId);
  await page.mouse.move(loosePoint.x, loosePoint.y);
  await page.mouse.down();
  await page.mouse.move(loosePoint.x + 72, loosePoint.y, { steps: 6 });
  await expect.poll(() => looseTime().then(t => t.earlyStart)).not.toBe(looseBefore.earlyStart);
  await page.mouse.move(loosePoint.x, loosePoint.y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => looseTime()).toEqual(looseBefore);
  const looseUndoAfter = (await state(page)).undoDepth;
  expect(looseUndoAfter).toBe(looseUndo + 1);
  await page.mouse.move(loosePoint.x, loosePoint.y);
  await page.mouse.down();
  await page.mouse.move(loosePoint.x + 8, loosePoint.y, { steps: 2 });
  await page.mouse.up();
  expect(await looseTime()).toEqual(looseBefore);
  expect((await state(page)).undoDepth).toBe(looseUndoAfter);
  await page.keyboard.press('Control+z');
  await expect.poll(() => state(page).then(snapshot => snapshot.undoDepth)).toBe(looseUndo);
  expect(await looseTime()).toEqual(looseBefore);
  expect(await looseName()).toBe('Eerst hernoemd');
});

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
    scheduleStart: "2026-09-07T07:00",
    scheduleFinish: "2026-09-18T16:00",
  });
  expect(after.undoDepth).toBe(before.undoDepth + 1);
});

test('Gantt-balk vertical slepen verplaatst de taak zonder haar datums te wijzigen', async ({ page, ops: _ops }) => {
  const [firstId, secondId, thirdId] = await seedProject(page, [
    { name: 'Balk die verhuist', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Balk-doel', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Blijft derde', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(ids => window.__OPS__!.store.getState().selectTasks(ids, false), [firstId, secondId]);
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([firstId, secondId]);
  const before = await state(page);
  const source = await barPoint(page, firstId, 'body');
  const targetRow = ganttTaskRow(page, thirdId);
  const target = await rowPoint(targetRow, 'after');

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', 'grabbing');
  await page.mouse.move(source.x + 2, target.y, { steps: 6 });
  await expect(targetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
  await page.mouse.up();

  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.map(task => task.id)))
    .toEqual([secondId, thirdId, firstId]);
  const after = await state(page);
  expect(after.tasks.find(task => task.id === firstId)).toMatchObject({
    scheduleStart: "2026-09-07T07:00",
    scheduleFinish: "2026-09-18T16:00",
  });
  expect(after.undoDepth).toBe(before.undoDepth + 1);
  expect(after.selectedTaskIds).toEqual([firstId]);
});

test('Gantt-balk diagonaal slepen houdt de as vast: horizontaal eerst blijft een datumsleep', async ({ page, ops: _ops }) => {
  const seeded = await seedProject(page, [
    { name: 'Diagonaal horizontaal', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Blijft tweede', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Blijft derde', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Blijft vierde', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Blijft vijfde', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Verleidelijk doel', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const firstId = seeded[0];
  const lastId = seeded[seeded.length - 1];
  const before = await state(page);
  const beforeTask = before.tasks.find(task => task.id === firstId)!;
  const source = await barPoint(page, firstId, 'body');
  const targetRow = ganttTaskRow(page, lastId);
  const target = await rowPoint(targetRow, 'after');

  const firstStepX = 40;
  expect(Math.abs(target.y - source.y)).toBeGreaterThan(firstStepX + 20);

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(source.x + firstStepX, source.y, { steps: 4 });
  await expect.poll(() => state(page).then(snapshot => (
    snapshot.tasks.find(task => task.id === firstId)?.scheduleStart
  ))).not.toBe(beforeTask.scheduleStart);
  await page.mouse.move(source.x + firstStepX + 2, target.y, { steps: 6 });
  await page.mouse.move(source.x + 200, target.y, { steps: 6 });
  await expect(targetRow).not.toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
  await page.mouse.up();

  await expect.poll(() => state(page).then(snapshot => (
    snapshot.tasks.find(task => task.id === firstId)?.scheduleStart
  ))).not.toBe(beforeTask.scheduleStart);
  const after = await state(page);
  expect(after.tasks.map(task => task.id)).toEqual(seeded);
  expect(after.undoDepth).toBe(before.undoDepth + 1);

  await page.keyboard.press('Control+z');
  await expect.poll(() => state(page).then(snapshot => (
    snapshot.tasks.find(task => task.id === firstId)?.scheduleStart
  ))).toBe(beforeTask.scheduleStart);
  const restored = await state(page);
  expect(restored.tasks.map(task => task.id)).toEqual(seeded);
  expect(restored.undoDepth).toBe(before.undoDepth);
});

test('Gantt-balk diagonaal slepen houdt de as vast: verticaal eerst raakt de datums niet', async ({ page, ops: _ops }) => {
  const [firstId, secondId, thirdId] = await seedProject(page, [
    { name: 'Diagonaal verticaal', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Doelrij', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Blijft derde', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const before = await state(page);
  const beforeTask = before.tasks.find(task => task.id === firstId)!;
  const source = await barPoint(page, firstId, 'body');
  const targetRow = ganttTaskRow(page, secondId);
  const target = await rowPoint(targetRow, 'after');

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(source.x + 2, target.y, { steps: 6 });
  await expect(targetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
  await page.mouse.move(source.x + 220, target.y, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.map(task => task.id)))
    .toEqual([secondId, firstId, thirdId]);
  const after = await state(page);
  expect(after.tasks.find(task => task.id === firstId)).toMatchObject({
    scheduleStart: beforeTask.scheduleStart,
    scheduleFinish: beforeTask.scheduleFinish,
  });
  expect(after.undoDepth).toBe(before.undoDepth + 1);
});

test('Gantt-balk vertical slepen buiten boomweergave meldt de vergrendelde structuur en verzet niets', async ({ page, ops: _ops }) => {
  const [firstId, secondId] = await seedProject(page, [
    { name: 'Gesorteerd B', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Gesorteerd A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(() => window.__OPS__!.store.getState().setSort([
    { field: { src: 'builtin', key: 'name' }, dir: 'asc' },
  ]));
  const before = await state(page);
  const beforeTask = before.tasks.find(task => task.id === firstId)!;
  const source = await barPoint(page, firstId, 'body');
  const targetRow = ganttTaskRow(page, secondId);
  const target = await rowPoint(targetRow, 'after');

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(source.x + 2, target.y, { steps: 6 });
  await page.mouse.up();

  await expect(page.locator('[data-ops-structure-locked]')).toBeVisible();
  await expect(targetRow).not.toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
  const after = await state(page);
  expect(after.tasks.map(task => task.id)).toEqual(before.tasks.map(task => task.id));
  expect(after.tasks.find(task => task.id === firstId)).toMatchObject({
    scheduleStart: beforeTask.scheduleStart,
    scheduleFinish: beforeTask.scheduleFinish,
  });
  expect(after.undoDepth).toBe(before.undoDepth);
});

test('Gantt-balk vertical slepen landt in RTL op dezelfde plek als een rijsleep', async ({ page, ops: _ops }) => {
  const ids = await seedProject(page, [
    { name: 'RTL sleept', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'RTL tweede', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'RTL derde', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'RTL vierde', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const [firstId, , thirdId] = ids;
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  const before = await state(page);

  const rowSource = await rowPoint(ganttTaskRow(page, firstId));
  const rowTargetRow = ganttTaskRow(page, thirdId);
  const rowTarget = await rowPoint(rowTargetRow, 'after');
  await page.mouse.move(rowSource.x, rowSource.y);
  await page.mouse.down();
  await page.mouse.move(rowSource.x + 2, rowTarget.y, { steps: 6 });
  await expect(rowTargetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
  await page.mouse.up();
  await expect.poll(() => state(page).then(snapshot => snapshot.undoDepth))
    .toBe(before.undoDepth + 1);
  const viaRow = (await state(page)).tasks.map(task => task.id);
  expect(viaRow).not.toEqual(before.tasks.map(task => task.id));

  await page.keyboard.press('Control+z');
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.map(task => task.id)))
    .toEqual(before.tasks.map(task => task.id));

  await expect.poll(async () => [
    (await rowPoint(ganttTaskRow(page, firstId))).y,
    (await barPoint(page, firstId, 'body')).y,
  ], { message: 'rij en balk na undo weer op de oorspronkelijke beginrij' })
    .toEqual([rowSource.y, rowSource.y]);
  const barSource = await barPoint(page, firstId, 'body');
  const barTargetRow = ganttTaskRow(page, thirdId);
  const barTarget = await rowPoint(barTargetRow, 'after');
  await page.mouse.move(barSource.x, barSource.y);
  await page.mouse.down();
  await page.mouse.move(barSource.x + 2, barTarget.y, { steps: 6 });
  await expect(barTargetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
  await page.mouse.up();

  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.map(task => task.id)))
    .toEqual(viaRow);
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

test('Gantt Escape annuleert rijsleep en datumsleep zonder mutatie', async ({ page, ops: _ops }) => {
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

  const milestoneId = await page.evaluate((predecessorId) => {
    const id = window.__OPS__!.store.getState().addTask({ name: 'Oplevering', isMilestone: true });
    window.__OPS__!.store.getState().addSequence({ predecessorId, successorId: id, type: 'FINISH_FINISH', lagDays: 0 });
    window.__OPS__!.store.getState().runCPM();
    return id;
  }, firstId);
  const fields = (id: string) => page.evaluate((taskId) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === taskId)!;
    return { time: task.time, constraint: task.constraint ?? null };
  }, id);
  const taskName = (id: string) => page.evaluate(
    taskId => window.__OPS__!.store.getState().tasks.find(task => task.id === taskId)!.name, id);
  const nameBefore = await taskName(secondId);
  await page.evaluate(id => window.__OPS__!.store.getState().updateTask(id, { name: 'Eerdere bewerking' }), secondId);
  const edited = await state(page);

  for (const id of [milestoneId, firstId]) {
    const original = await fields(id);
    const point = await barPoint(page, id);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 72, point.y, { steps: 6 });
    await expect.poll(() => fields(id).then(now => now.time.earlyStart)).not.toBe(original.time.earlyStart);
    if (id === milestoneId) expect((await fields(id)).constraint?.type).toBe('SNET');
    await page.keyboard.press('Escape');
    await expect.poll(() => fields(id)).toEqual(original);
    await page.mouse.move(point.x + 216, point.y, { steps: 6 });
    await page.mouse.up();
    expect(await fields(id)).toEqual(original);
    const cancelled = await state(page);
    expect(cancelled.undoDepth).toBe(edited.undoDepth);
    expect(cancelled.selectedTaskIds).toEqual([id]);
    expect(await taskName(secondId)).toBe('Eerdere bewerking');
    await page.keyboard.press('Control+y');
    expect(await fields(id)).toEqual(original);
    expect((await state(page)).redoDepth).toBe(edited.redoDepth);
  }

  const point = await barPoint(page, firstId);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 2, point.y);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await state(page)).undoDepth).toBe(edited.undoDepth);
  expect(await taskName(secondId)).toBe('Eerdere bewerking');

  await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const time = s.tasks.find(task => task.id === id)!.time;
    s.updateTask(id, { time: { ...time, scheduleFinish: '2026-09-25T16:00', earlyFinish: '2026-09-25T16:00', scheduleDuration: 15 } });
  }, firstId);
  const longer = await fields(firstId);
  const longerState = await state(page);
  const heldMilestone = await fields(milestoneId);
  const held = await barPoint(page, milestoneId);
  await page.mouse.move(held.x, held.y);
  await page.mouse.down();
  await page.keyboard.press('F5');
  await expect.poll(() => fields(milestoneId).then(now => now.time.earlyStart)).not.toBe(heldMilestone.time.earlyStart);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await fields(firstId)).time.scheduleFinish).toBe(longer.time.scheduleFinish);
  expect((await state(page)).undoDepth).toBe(longerState.undoDepth);
  await page.keyboard.press('Control+z');
  await expect.poll(() => fields(firstId).then(now => now.time.scheduleDuration)).toBe(10);

  await page.keyboard.press('Control+z');
  await expect.poll(() => taskName(secondId)).toBe(nameBefore);
});
