// Review vader (2026-10-06), punt 1: snel taken neerzetten.
//  - Rechtsklik op lege ruimte in de tabel of de Gantt geeft "Nieuwe taak" en "Nieuwe mijlpaal".
//  - Onderaan de tabel staat een spookregel: pas als je er iets invult wordt het een taak, in één
//    undo-stap; ga je weg zonder iets in te vullen, dan is er niets gebeurd.
// Alleen echte muis- en toetsenbordevents; de dev-bridge zet alleen fixtures en leest de toestand.
import type { Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

const SHOT_DIR = process.env.OPS_QA_SHOTS;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

const ganttGrid = '[data-task-grid-surface-id="gantt-task-grid"]';
const ghostRow = (page: Page) => page.locator(`${ganttGrid} [data-grid-ghost="true"]`);
const ghostCell = (page: Page, columnId: string) => ghostRow(page).locator(`[data-grid-column-id="${columnId}"]`);

async function dirty(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__OPS__!.store.getState().isDirty);
}

test('spookregel: erheen gaan en weer weg zonder invoer laat geen spoor na', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Metselwerk', start: '2026-09-14', finish: '2026-09-18', durationDays: 5 },
  ]);
  const before = await state(page);
  await expect(ghostRow(page)).toBeVisible();
  await expect(ghostCell(page, 'task.name')).toContainText('New task');
  await shot(page, 'spookregel');

  await ghostCell(page, 'task.name').click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowUp');

  const after = await state(page);
  expect(after.tasks).toHaveLength(2);
  expect(after.undoDepth).toBe(before.undoDepth);
});

test('spookregel: alleen een duur invullen maakt "New task" in één undo-stap', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
  ]);
  const before = await state(page);
  const wasDirty = await dirty(page);

  await ghostCell(page, 'task.time.scheduleDuration').click();
  await page.keyboard.type('3');
  await page.keyboard.press('Enter');

  await expect.poll(() => state(page).then(s => s.tasks.map(task => task.name))).toEqual(['Fundering', 'New task']);
  const created = await page.evaluate(() => {
    const tasks = window.__OPS__!.store.getState().tasks;
    return tasks[tasks.length - 1].time.scheduleDuration;
  });
  expect(created).toBe(3);
  expect((await state(page)).undoDepth).toBe(before.undoDepth + 1);
  // Onder de nieuwe taak staat weer een spookregel.
  await expect(ghostRow(page)).toBeVisible();
  await shot(page, 'spookregel-na-duur');

  await page.keyboard.press('Control+z');
  await expect.poll(() => state(page).then(s => s.tasks.length)).toBe(1);
  expect(await dirty(page)).toBe(wasDirty);

  // 250: de editor van de nog lege regel volgt de maatkeuze, het profiel en vast werk.
  for (const [profile, unit, fixedWork, seed] of [
    ['ops', 'hours', false, '5'], ['p6', 'days', false, '40'],
    ['msproject', 'days', false, '40'], ['ops', 'days', true, '40'],
  ] as const) {
    await page.evaluate(({ profile, unit, fixedWork }) => {
      window.__OPS__!.store.getState().setProject({
        schedulingProfile: { baseId: profile, id: profile, name: '', overrides: {} },
        defaultTaskDurationUnit: unit,
        defaultWorkRule: fixedWork ? 'FIXED_WORK' : 'FIXED_DURATION_RATE',
      });
    }, { profile, unit, fixedWork });
    const depth = (await state(page)).undoDepth;
    await ghostCell(page, 'task.time.scheduleDuration').click();
    await expect(ghostRow(page).locator('.task-grid-editor-input')).toHaveValue(seed);
    await page.keyboard.type('3');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => {
      const t = window.__OPS__!.store.getState().tasks.at(-1)!;
      return [t.time.durationUnit, t.time.durationMinutes];
    })).toEqual(['hours', 180]);
    expect((await state(page)).undoDepth).toBe(depth + 1);
    await page.keyboard.press('Control+z');
    await expect.poll(() => state(page).then(s => s.tasks.length)).toBe(1);
  }
});

test('spookregel: met pijltje omlaag erin en een naam typen', async ({ page, ops: _ops }) => {
  const [first] = await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
  ]);
  await page.locator(`${ganttGrid} [data-grid-row-key="${first}"][data-grid-column-id="task.name"]`).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.type('Metselwerk');
  await page.keyboard.press('Enter');
  // Enter gaat door naar de volgende nieuwe taak: meteen weer typen.
  await page.keyboard.type('Dak');
  await page.keyboard.press('Enter');

  await expect.poll(() => state(page).then(s => s.tasks.map(task => task.name))).toEqual(['Fundering', 'Metselwerk', 'Dak']);
});

test('spookregel: na de naam op de duur van dezelfde regel klikken blijft in die nieuwe taak', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
  ]);
  const durationOnGhost = await ghostCell(page, 'task.time.scheduleDuration').boundingBox();
  expect(durationOnGhost).not.toBeNull();
  await ghostCell(page, 'task.name').click();
  await page.keyboard.type('Metselwerk');
  // Klik op de duurcel van DEZELFDE regel (die nu de nieuwe taak is) en typ de duur.
  await page.mouse.click(durationOnGhost!.x + durationOnGhost!.width / 2, durationOnGhost!.y + durationOnGhost!.height / 2);
  await page.keyboard.type('4');
  await page.keyboard.press('Enter');

  await expect.poll(() => state(page).then(s => s.tasks.map(task => task.name))).toEqual(['Fundering', 'Metselwerk']);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks[1].time.scheduleDuration)).toBe(4);
});

test('tabel: rechtsklik op lege ruimte → Nieuwe taak, naam meteen typen', async ({ page, ops: _ops }) => {
  const [first] = await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
  ]);
  const grid = page.locator(`${ganttGrid} [role="grid"]`);
  const box = await grid.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + 60, box!.y + box!.height - 40, { button: 'right' });

  await expect(page.getByRole('button', { name: 'New task', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Paste', exact: true })).toBeDisabled();
  await shot(page, 'tabel-menu');
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.keyboard.type('Ruwbouw');
  await page.keyboard.press('Enter');

  await expect.poll(() => state(page).then(s => s.tasks.map(task => task.name))).toEqual(['Fundering', 'Ruwbouw']);
  // Klembordinhoud is fixture; de te toetsen Plakken-route loopt door het echte lege-ruimtemenu.
  await page.evaluate(id => window.__OPS__!.store.getState().copyTasks([id]), first);
  const beforePaste = await state(page);
  const pasteBox = (await grid.boundingBox())!;
  await page.mouse.click(pasteBox.x + 60, pasteBox.y + pasteBox.height - 40, { button: 'right' });
  await expect(page.getByRole('button', { name: 'Paste', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Paste', exact: true }).click();
  await expect.poll(() => state(page).then(s => s.tasks.map(t => t.name)))
    .toEqual(['Fundering', 'Ruwbouw', 'Fundering']);
  const afterPaste = await state(page);
  expect(new Set(afterPaste.tasks.map(t => t.id)).size).toBe(3);
  expect(afterPaste.undoDepth).toBe(beforePaste.undoDepth + 1);
  const freshBox = (await grid.boundingBox())!;
  await page.mouse.click(freshBox.x + 60, freshBox.y + freshBox.height - 40, { button: 'right' });
  await page.getByRole('button', { name: 'Add milestone', exact: true }).click();
  await page.keyboard.type('Gewone mijlpaal');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const t = window.__OPS__!.store.getState().tasks.find(t => t.isMilestone);
    return t && [t.taskType, t.milestoneKind, t.parentId, t.mandatory ?? false];
  })).toEqual(['USERDEFINED', 'FINISH', null, false]);
  await page.locator(ganttGrid + ' [data-grid-row-key="' + first + '"][data-grid-column-id="task.name"]').click({ button: 'right' });
  await page.getByRole('button', { name: 'Add milestone', exact: true }).click();
  await expect.poll(() => page.evaluate(parentId => {
    const t = window.__OPS__!.store.getState().tasks.find(t => t.isMilestone && t.parentId === parentId);
    return t && [t.taskType, t.milestoneKind, t.mandatory ?? false];
  }, first)).toEqual(['USERDEFINED', 'FINISH', false]);

});

test('Gantt: rechtsklik op lege ruimte → Nieuwe taak begint op de aangeklikte datum', async ({ page, ops: _ops }) => {
  const [first] = await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
  ]);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ defaultTaskDurationUnit: 'hours' });
    s.setZoom(30);
    s.setScroll(0, 0);
  });
  // Midden onder de balk van Fundering (wo 9 september), maar twee rijen lager: lege ruimte.
  const bar = await barPoint(page, first);
  await page.mouse.click(bar.x, bar.y + 120, { button: 'right' });
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Paste', exact: true })).toBeDisabled();
  await shot(page, 'gantt-menu');
  await page.getByRole('button', { name: 'New task', exact: true }).click();

  await expect.poll(() => state(page).then(s => s.tasks.length)).toBe(2);
  const created = (await state(page)).tasks[1];
  expect(await page.evaluate(() => {
    const t = window.__OPS__!.store.getState().tasks[1];
    return [t.time.durationUnit, t.time.durationMinutes];
  })).toEqual(['hours', 300]);
  expect(created.scheduleStart.slice(0, 10) >= '2026-09-07').toBe(true);
  expect(created.scheduleStart.slice(0, 10) <= '2026-09-11').toBe(true);
  await page.evaluate(id => window.__OPS__!.store.getState().copyTasks([id]), first);
  const beforePaste = await state(page);
  const pasteBar = await barPoint(page, first);
  await page.mouse.click(pasteBar.x, pasteBar.y + 160, { button: 'right' });
  await expect(page.getByRole('button', { name: 'Paste', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Paste', exact: true }).click();
  await expect.poll(() => state(page).then(s => s.tasks.length)).toBe(3);
  const afterPaste = await state(page);
  expect(afterPaste.tasks.at(-1)!.name).toBe('Fundering');
  expect(new Set(afterPaste.tasks.map(t => t.id)).size).toBe(3);
  expect(afterPaste.undoDepth).toBe(beforePaste.undoDepth + 1);

  const currentBar = await barPoint(page, first);
  await page.mouse.click(currentBar.x, currentBar.y + 160, { button: 'right' });
  await page.getByRole('button', { name: 'Add milestone', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const t = window.__OPS__!.store.getState().tasks.find(t => t.isMilestone);
    return t && [t.taskType, t.milestoneKind, t.parentId, t.mandatory ?? false];
  })).toEqual(['USERDEFINED', 'FINISH', null, false]);

  // Op een bestaande taak blijft het een subtaak, maar eveneens een gewone eindmijlpaal.
  const parentBar = await barPoint(page, first);
  await page.mouse.click(parentBar.x, parentBar.y, { button: 'right' });
  await page.getByRole('button', { name: 'Add milestone', exact: true }).click();
  await expect.poll(() => page.evaluate(parentId => {
    const t = window.__OPS__!.store.getState().tasks.find(t => t.isMilestone && t.parentId === parentId);
    return t && [t.taskType, t.milestoneKind, t.mandatory ?? false];
  }, first)).toEqual(['USERDEFINED', 'FINISH', false]);

  // Dezelfde menuroute onder de vaste urenmaat en vast werk: vijf werkdagen worden 40 uur.
  for (const [profile, fixedWork] of [['p6', false], ['msproject', false], ['ops', true]] as const) {
    await page.evaluate(() => window.__OPS__!.store.getState().newProject());
    const [anchor] = await seedProject(page, [
      { name: 'Anker', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    ]);
    await page.evaluate(({ profile, fixedWork }) => {
      const s = window.__OPS__!.store.getState();
      s.setProject({ schedulingProfile: { baseId: profile, id: profile, name: '', overrides: {} },
        defaultTaskDurationUnit: 'days', defaultWorkRule: fixedWork ? 'FIXED_WORK' : 'FIXED_DURATION_RATE' });
      s.setZoom(30);
      s.setScroll(0, 0);
    }, { profile, fixedWork });
    const point = await barPoint(page, anchor);
    const depth = (await state(page)).undoDepth;
    await page.mouse.click(point.x, point.y + 120, { button: 'right' });
    await page.getByRole('button', { name: 'New task', exact: true }).click();
    await expect.poll(() => page.evaluate(() => {
      const t = window.__OPS__!.store.getState().tasks[1];
      return t && [t.time.durationUnit, t.time.durationMinutes];
    })).toEqual(['hours', 2400]);
    expect((await state(page)).undoDepth).toBe(depth + 1);
    const start = (await state(page)).tasks[1].scheduleStart.slice(0, 10);
    expect(start >= '2026-09-07' && start <= '2026-09-11').toBe(true);
  }
});
