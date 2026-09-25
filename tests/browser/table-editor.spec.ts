// Karakterisering van het gedeelde DOM-raster: de tabel opent een naamcel via het toetsenbord,
// commit met Enter en bewaart één undo-stap.
import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';

function taskRow(page: Page, taskId: string, surfaceId = 'full-task-grid'): Locator {
  return page.locator(
    `[data-task-grid-surface-id="${surfaceId}"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`,
  );
}

function taskCell(page: Page, taskId: string, columnId: string): Locator {
  return taskRow(page, taskId).locator(
    `[data-grid-data-cell="true"][data-grid-column-id="${columnId}"]`,
  );
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
  const table = page.locator('[data-task-grid-surface-id="full-task-grid"] [role="grid"]');
  await expect(table).toBeVisible();
  const nameCell = taskCell(page, firstId, 'task.name');

  // Een gewone klik selecteert de cel; Enter opent de editor. Escape herstelt de celfocus.
  await nameCell.click();
  await page.keyboard.press('Enter');
  await expect(nameCell.locator('input')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nameCell).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(taskCell(page, secondId, 'task.name')).toHaveAttribute('data-grid-active', 'true');
  await expect.poll(() => state(page).then(snapshot => snapshot.selectedTaskIds)).toEqual([secondId]);
  await page.keyboard.press('ArrowUp');
  await expect(nameCell).toHaveAttribute('data-grid-active', 'true');
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

/**
 * Houdt browserframes vast tot de teruggegeven `release`: het volgende frame komt dan aantoonbaar ná
 * de toetsen daartussen, zoals op een belaste runner. De toetsen zelf blijven echte browser-events.
 */
async function holdAnimationFrames(page: Page): Promise<() => Promise<void>> {
  await page.evaluate(() => {
    const held = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    const originalRequest = window.requestAnimationFrame;
    const originalCancel = window.cancelAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      const id = nextId++;
      held.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id) => { held.delete(id); };
    (window as unknown as { __opsReleaseFrames?: () => void }).__opsReleaseFrames = () => {
      window.requestAnimationFrame = originalRequest;
      window.cancelAnimationFrame = originalCancel;
      const callbacks = [...held.values()];
      held.clear();
      const now = performance.now();
      for (const callback of callbacks) callback(now);
    };
  });
  return () => page.evaluate(() => {
    (window as unknown as { __opsReleaseFrames?: () => void }).__opsReleaseFrames?.();
  });
}

// Rode fase (CI, PR #200): de pijltoets plande de focus van de nieuwe actieve cel voor het volgende
// frame; kwam dat frame pas ná de Enter, dan pakte die cel de focus terug van het invoerveld dat de
// editor net had gefocust. De editor stond open, maar getypte tekst kwam er niet in.
test('table surface: een celfocus uit het vorige frame berooft de net geopende editor niet', async ({ page, ops: _ops }) => {
  const [firstId, secondId] = await seedProject(page, [
    { name: 'Oorspronkelijke naam', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Volgende rij', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const nameCell = taskCell(page, firstId, 'task.name');
  const secondCell = taskCell(page, secondId, 'task.name');
  await nameCell.click();
  await page.keyboard.press('ArrowDown');
  await expect(secondCell).toBeFocused();

  const releaseFrames = await holdAnimationFrames(page);
  await page.keyboard.press('ArrowUp');
  await expect(nameCell).toHaveAttribute('data-grid-active', 'true');
  await page.keyboard.press('Enter');
  const input = nameCell.locator('input');
  await expect(input).toBeFocused();
  await releaseFrames();

  await expect(input).toBeFocused();
  await page.keyboard.type('Naam na traag frame');
  await page.keyboard.press('Enter');
  await expect.poll(() => state(page).then(snapshot => (
    snapshot.tasks.find(task => task.id === firstId)?.name
  ))).toBe('Naam na traag frame');
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
  await expect(existingTargetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);

  // Fixture-update midden in de echte pointergesture: DOM-index, rows en tasksById veranderen.
  const thirdId = await addTableTaskDuringGesture(page, 'Tabelrij C, tijdens sleep toegevoegd');
  const midGesture = await state(page);
  const newTargetRow = taskRow(page, thirdId);
  const newTarget = await rowPoint(newTargetRow, 'after');

  await page.mouse.move(newTarget.x, newTarget.y);
  await expect(newTargetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
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
  await expect(targetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
  await page.keyboard.press('Escape');
  await page.mouse.up();

  const after = await state(page);
  expect(after.tasks.map(task => task.id)).toEqual(before.tasks.map(task => task.id));
  expect(after.undoDepth).toBe(before.undoDepth);
});

test('table surface: ingebedde en volledige DOM-grid leveren dezelfde zichtbare rijuitkomst', async ({ page, ops: _ops }) => {
  const [firstId, secondId, thirdId] = await seedProject(page, [
    { name: 'Gedeeld A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Gedeeld B', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Gedeeld C', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const before = await state(page);
  const source = await rowPoint(taskRow(page, firstId, 'gantt-task-grid'));
  const targetRow = taskRow(page, thirdId, 'gantt-task-grid');
  const target = await rowPoint(targetRow, 'after');

  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await expect(targetRow).toHaveAttribute('data-grid-drop-zone', /before|after|nest/);
  await page.mouse.up();
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.map(task => task.id)))
    .toEqual([secondId, thirdId, firstId]);
  const embeddedResult = await state(page);

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

  expect(domResult.viewRows).toEqual(embeddedResult.viewRows);
  expect(domResult.selectedTaskIds).toEqual(embeddedResult.selectedTaskIds);
  expect(domResult.undoDepth).toBe(before.undoDepth + 1);
  expect(embeddedResult.undoDepth).toBe(before.undoDepth + 1);
});
