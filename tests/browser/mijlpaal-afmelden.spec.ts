import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const surface = (page: Page) => page.locator('[data-task-grid-surface-id="full-task-grid"]');

function taskCell(page: Page, taskId: string, columnId: string): Locator {
  return surface(page).locator(
    `[data-grid-data-row="true"][data-grid-row-key="${taskId}"] [data-grid-data-cell="true"][data-grid-column-id="${columnId}"]`,
  );
}

async function seed(page: Page): Promise<{ oplevering: string; startBouw: string; keuring: string }> {
  const ids = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setCalendar({ ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [] });
    s.setProject({ name: 'Mijlpaal afmelden', startDate: '2026-06-01' });
    s.setUI({ dateNotation: 'dmy' });
    const milestone = (name: string, kind?: 'START' | 'FINISH') => s.addTask({
      name, isMilestone: true, ...(kind ? { milestoneKind: kind } : {}), time: { scheduleDuration: 0 } as never,
    });
    const hours = (name: string, h: number) => {
      const id = s.addTask({ name });
      const task = window.__OPS__!.store.getState().tasks.find(t => t.id === id)!;
      s.updateTask(id, { time: { ...task.time, durationUnit: 'hours', durationMinutes: h * 60, scheduleDuration: h / 8 } });
      return id;
    };
    const oplevering = milestone('Oplevering');
    const startBouw = milestone('Start bouw', 'START');
    s.addSequence({ predecessorId: startBouw, successorId: hours('Grondwerk', 8), type: 'FINISH_START', lagDays: 0 });
    const keuring = milestone('Keuring');
    s.addSequence({ predecessorId: hours('Inspectie', 3), successorId: keuring, type: 'FINISH_START', lagDays: 0 });
    const after = window.__OPS__!.store.getState();
    after.runCPM();
    after.setStatusDate('2026-06-05');
    const columns = after.taskGridSurfaces['full-task-grid'].columns;
    after.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'task.time.actualStart', width: 140, pinned: false } as unknown as (typeof columns)[number],
      { id: 'task.time.actualFinish', width: 140, pinned: false } as unknown as (typeof columns)[number],
    ]);
    return { oplevering, startBouw, keuring };
  });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(5);
  return ids;
}

const timeOf = (page: Page, id: string) => page.evaluate((taskId) => {
  const t = window.__OPS__!.store.getState().tasks.find(task => task.id === taskId)!.time;
  return { planned: t.earlyStart, actualStart: t.actualStart ?? null, actualFinish: t.actualFinish ?? null };
}, id);

async function typeInCell(page: Page, cell: Locator, text: string): Promise<void> {
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await page.keyboard.press('Enter');
  const input = cell.locator('input').first();
  await expect(input).toBeFocused();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('tabel: een datum zonder tijd bij een mijlpaal houdt de klokketijd uit de planning', async ({ page, ops: _ops }) => {
  const { oplevering, startBouw, keuring } = await seed(page);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(surface(page).locator('[role="grid"]')).toBeVisible();

  expect((await timeOf(page, oplevering)).planned).toBe('2026-06-01T16:00');
  expect((await timeOf(page, startBouw)).planned).toBe('2026-06-01T07:00');
  expect((await timeOf(page, keuring)).planned).toBe('2026-06-01T10:00');

  const opleveringFinish = taskCell(page, oplevering, 'task.time.actualFinish');
  await typeInCell(page, opleveringFinish, '03-06-2026');
  await expect.poll(() => timeOf(page, oplevering)).toEqual({
    planned: '2026-06-01T16:00', actualStart: '2026-06-03T16:00', actualFinish: '2026-06-03T16:00',
  });
  await expect(opleveringFinish).toHaveText('03-06-2026');

  await typeInCell(page, taskCell(page, startBouw, 'task.time.actualStart'), '02-06-2026');
  await expect.poll(() => timeOf(page, startBouw).then(t => t.actualStart)).toBe('2026-06-02T07:00');

  const keuringFinish = taskCell(page, keuring, 'task.time.actualFinish');
  await typeInCell(page, keuringFinish, '04-06-2026');
  await expect.poll(() => timeOf(page, keuring).then(t => t.actualFinish)).toBe('2026-06-04T10:00');
  await expect(keuringFinish).toContainText('04-06-2026');
  await expect(keuringFinish).toContainText('10:00');

  await typeInCell(page, keuringFinish, '05-06-2026 09:30');
  await expect.poll(() => timeOf(page, keuring).then(t => t.actualFinish)).toBe('2026-06-05T09:30');
});

test('tabel: nachtploeg, een mijlpaal afmelden op de statuswerkdag mag', async ({ page, ops: _ops }) => {
  const ids = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const night = [{ start: 1320, end: 1800 }];
    s.setCalendar({
      ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [], workStartHour: 22, workEndHour: 30, hoursPerDay: 8,
      workTime: { byWeekday: { 1: night, 2: night, 3: night, 4: night, 5: night, 6: [], 7: [] } },
    });
    s.setProject({ name: 'Mijlpaal nachtploeg', startDate: '2026-06-01' });
    s.setUI({ dateNotation: 'dmy' });
    const milestone = (name: string, kind?: 'START' | 'FINISH') => s.addTask({
      name, isMilestone: true, ...(kind ? { milestoneKind: kind } : {}), time: { scheduleDuration: 0 } as never,
    });
    const zonder = milestone('Oplevering nacht');
    const start = milestone('Start nacht', 'START');
    const after = window.__OPS__!.store.getState();
    after.runCPM();
    after.setStatusDate('2026-06-03');
    const columns = after.taskGridSurfaces['full-task-grid'].columns;
    after.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'task.time.actualStart', width: 140, pinned: false } as unknown as (typeof columns)[number],
      { id: 'task.time.actualFinish', width: 140, pinned: false } as unknown as (typeof columns)[number],
    ]);
    return { zonder, start };
  });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(2);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(surface(page).locator('[role="grid"]')).toBeVisible();

  for (const id of [ids.zonder, ids.start]) {
    expect((await timeOf(page, id)).planned).toBe('2026-06-02T06:00');
    const startCell = taskCell(page, id, 'task.time.start');
    await expect(startCell).toContainText('01-06-2026');
    await expect(startCell).not.toContainText('06:00');
  }

  const zonderFinish = taskCell(page, ids.zonder, 'task.time.actualFinish');
  await typeInCell(page, zonderFinish, '03-06-2026');
  await expect.poll(() => timeOf(page, ids.zonder)).toEqual({
    planned: '2026-06-02T06:00', actualStart: '2026-06-04T06:00', actualFinish: '2026-06-04T06:00',
  });
  await expect(zonderFinish).toHaveText('03-06-2026');

  const startStart = taskCell(page, ids.start, 'task.time.actualStart');
  await typeInCell(page, startStart, '03-06-2026');
  await expect.poll(() => timeOf(page, ids.start).then(t => t.actualStart)).toBe('2026-06-04T06:00');
  await expect(startStart).toHaveText('03-06-2026');
});

test('tabel: nachtploeg, afmelden op een statusdag zonder werkblok mag', async ({ page, ops: _ops }) => {
  const id = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const night = [{ start: 1320, end: 1800 }];
    s.setCalendar({
      ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [], workStartHour: 22, workEndHour: 30, hoursPerDay: 8,
      workTime: { byWeekday: { 1: night, 2: night, 3: night, 4: night, 5: night, 6: [], 7: [] } },
    });
    s.setProject({ name: 'Mijlpaal nachtploeg zaterdag', startDate: '2026-06-01' });
    s.setUI({ dateNotation: 'dmy' });
    const milestone = s.addTask({ name: 'Oplevering nacht', isMilestone: true, time: { scheduleDuration: 0 } as never });
    const after = window.__OPS__!.store.getState();
    after.runCPM();
    after.setStatusDate('2026-06-06');
    const columns = after.taskGridSurfaces['full-task-grid'].columns;
    after.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'task.time.actualFinish', width: 140, pinned: false } as unknown as (typeof columns)[number],
    ]);
    return milestone;
  });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(1);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(surface(page).locator('[role="grid"]')).toBeVisible();
  expect((await timeOf(page, id)).planned).toBe('2026-06-02T06:00');

  const finish = taskCell(page, id, 'task.time.actualFinish');
  await typeInCell(page, finish, '06-06-2026');
  await expect.poll(() => timeOf(page, id)).toEqual({
    planned: '2026-06-02T06:00', actualStart: '2026-06-07T06:00', actualFinish: '2026-06-07T06:00',
  });
  await expect(finish).toHaveText('06-06-2026');
});

test('tabel: einde blijft einde, Oplevering op een korte vrijdag wordt vr 12:00', async ({ page, ops: _ops }) => {
  const id = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const day = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
    s.setCalendar({
      ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [], workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
      workTime: { byWeekday: { 1: day, 2: day, 3: day, 4: day, 5: [{ start: 420, end: 720 }], 6: [], 7: [] } },
    });
    s.setProject({ name: 'Mijlpaal korte vrijdag', startDate: '2026-06-01' });
    s.setUI({ dateNotation: 'dmy' });
    const oplevering = s.addTask({ name: 'Oplevering', isMilestone: true, time: { scheduleDuration: 0 } as never });
    const after = window.__OPS__!.store.getState();
    after.runCPM();
    after.setStatusDate('2026-06-05');
    const columns = after.taskGridSurfaces['full-task-grid'].columns;
    after.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'task.time.actualFinish', width: 140, pinned: false } as unknown as (typeof columns)[number],
    ]);
    return oplevering;
  });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(1);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(surface(page).locator('[role="grid"]')).toBeVisible();
  expect((await timeOf(page, id)).planned).toBe('2026-06-01T16:00');

  const finish = taskCell(page, id, 'task.time.actualFinish');
  await typeInCell(page, finish, '05-06-2026');
  await expect.poll(() => timeOf(page, id)).toEqual({
    planned: '2026-06-01T16:00', actualStart: '2026-06-05T12:00', actualFinish: '2026-06-05T12:00',
  });
  await expect(finish).toHaveText('05-06-2026');
});
