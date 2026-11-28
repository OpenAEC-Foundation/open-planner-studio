import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, state, test, waitForWelcomeDialog } from './fixtures/ops';

type Surface = 'full-task-grid' | 'gantt-task-grid';
interface Column { id: string; width: number; pinned: boolean }

const TABLE_DEFAULT: Column[] = [
  { id: 'task.wbsCode', width: 60, pinned: false },
  { id: 'task.name', width: 240, pinned: false },
  { id: 'task.time.scheduleDuration', width: 60, pinned: false },
  { id: 'task.time.start', width: 130, pinned: false },
  { id: 'task.time.finish', width: 130, pinned: false },
  { id: 'task.taskType', width: 80, pinned: false },
  { id: 'task.time.isCritical', width: 50, pinned: false },
  { id: 'task.time.totalFloat', width: 50, pinned: false },
  { id: 'task.time.completion', width: 60, pinned: false },
];

const OLD_TABLE: Column[] = [
  { id: 'task.name', width: 300, pinned: true },
  { id: 'task.wbsCode', width: 60, pinned: false },
  { id: 'task.time.scheduleDuration', width: 60, pinned: false },
  { id: 'task.time.scheduleStart', width: 100, pinned: false },
  { id: 'task.time.scheduleFinish', width: 100, pinned: false },
  { id: 'task.taskType', width: 80, pinned: false },
  { id: 'task.time.isCritical', width: 50, pinned: false },
  { id: 'task.time.totalFloat', width: 50, pinned: false },
  { id: 'task.time.completion', width: 60, pinned: false },
  { id: 'task.time.freeFloat', width: 90, pinned: false },
];

const GANTT_DEFAULT: Column[] = [
  { id: 'task.wbsCode', width: 60, pinned: false },
  { id: 'task.name', width: 240, pinned: false },
  { id: 'task.time.scheduleDuration', width: 60, pinned: false },
];

const OLD_GANTT: Column[] = [
  ...GANTT_DEFAULT,
  { id: 'task.time.scheduleStart', width: 100, pinned: false },
];

const RESET = /^(Reset to default|Herstel standaard)$/;

function shell(page: Page, surface: Surface): Locator {
  return page.locator(`[data-task-grid-surface-id="${surface}"] .task-grid-shell`);
}

async function headerIds(page: Page, surface: Surface): Promise<string[]> {
  return shell(page, surface).locator('[role="columnheader"][data-grid-column-id]').evaluateAll(
    headers => headers.map(header => header.getAttribute('data-grid-column-id')!),
  );
}

async function storeColumns(page: Page, surface: Surface): Promise<Column[]> {
  return page.evaluate(id => window.__OPS__!.store.getState().taskGridSurfaces[id].columns
    .map(column => ({ id: column.id as string, width: column.width, pinned: column.pinned })), surface);
}

async function storedColumns(page: Page, surface: Surface): Promise<Column[]> {
  return page.evaluate(id => {
    const raw = JSON.parse(localStorage.getItem('ops-taskGridPreferences')!);
    return raw.surfaces[id].columns as Column[];
  }, surface);
}

async function startAsExistingUser(page: Page, table: Column[], gantt: Column[]): Promise<void> {
  await page.evaluate(({ tableColumns, ganttColumns }) => {
    localStorage.setItem('ops-taskGridPreferences', JSON.stringify({
      version: 1,
      surfaces: {
        'gantt-task-grid': { columns: ganttColumns, scrollX: 0 },
        'full-task-grid': { columns: tableColumns, scrollX: 0 },
      },
      recent: ['task.time.freeFloat'],
    }));
  }, { tableColumns: table, ganttColumns: gantt });
  await page.reload();
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.newProject();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false, activeRibbonTab: 'start' });
  });
  await expect.poll(() => storeColumns(page, 'full-task-grid')).toEqual(table);
  await seedProject(page, [
    { name: 'Ruwbouw', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
}

test('tabel: Herstel standaard zet een oude kolomindeling in één handeling terug, undo/redo en opslag volgen', async ({ page, ops: _ops }) => {
  await startAsExistingUser(page, OLD_TABLE, GANTT_DEFAULT);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(shell(page, 'full-task-grid').locator('[role="grid"]')).toBeVisible();

  expect(await headerIds(page, 'full-task-grid')).toEqual(OLD_TABLE.map(column => column.id));
  const before = await state(page);

  await shell(page, 'full-task-grid').locator('.task-grid-add-column').click();
  const chooser = page.getByRole('dialog', { name: /^(Choose column|Kolom kiezen)$/ });
  await expect(chooser).toBeVisible();
  const reset = chooser.getByRole('button', { name: RESET });
  await expect(reset).toBeEnabled();
  await reset.click();

  await expect(chooser).toHaveCount(0);
  await expect.poll(() => headerIds(page, 'full-task-grid')).toEqual(TABLE_DEFAULT.map(column => column.id));
  expect(await storeColumns(page, 'full-task-grid')).toEqual(TABLE_DEFAULT);
  expect(await storedColumns(page, 'full-task-grid')).toEqual(TABLE_DEFAULT);
  expect(await storeColumns(page, 'gantt-task-grid')).toEqual(GANTT_DEFAULT);
  const afterReset = await state(page);
  expect(afterReset.undoDepth).toBe(before.undoDepth + 1);
  expect(afterReset.tasks).toEqual(before.tasks);

  await page.keyboard.press('Control+z');
  await expect.poll(() => storeColumns(page, 'full-task-grid')).toEqual(OLD_TABLE);
  await expect.poll(() => headerIds(page, 'full-task-grid')).toEqual(OLD_TABLE.map(column => column.id));
  expect(await storedColumns(page, 'full-task-grid')).toEqual(OLD_TABLE);
  const afterUndo = await state(page);
  expect(afterUndo.undoDepth).toBe(before.undoDepth);
  expect(afterUndo.redoDepth).toBe(before.redoDepth + 1);

  await page.keyboard.press('Control+y');
  await expect.poll(() => storeColumns(page, 'full-task-grid')).toEqual(TABLE_DEFAULT);
  expect(await storedColumns(page, 'full-task-grid')).toEqual(TABLE_DEFAULT);

  await page.getByRole('button', { name: /^(Choose the columns of the Table view|Kolommen van de Tabel-weergave kiezen)$/ }).click();
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole('button', { name: RESET })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(chooser).toHaveCount(0);
  expect((await state(page)).undoDepth).toBe(before.undoDepth + 1);
});

test('gantt-takenlijst: Herstel standaard in zijn eigen kiezer raakt alleen die lijst', async ({ page, ops: _ops }) => {
  await startAsExistingUser(page, OLD_TABLE, OLD_GANTT);
  await expect(shell(page, 'gantt-task-grid').locator('[role="grid"]')).toBeVisible();
  expect(await headerIds(page, 'gantt-task-grid')).toEqual(OLD_GANTT.map(column => column.id));

  await shell(page, 'gantt-task-grid').locator('.task-grid-add-column').click();
  const chooser = page.getByRole('dialog', { name: /^(Choose column|Kolom kiezen)$/ });
  await chooser.getByRole('button', { name: RESET }).click();

  await expect.poll(() => headerIds(page, 'gantt-task-grid')).toEqual(GANTT_DEFAULT.map(column => column.id));
  expect(await storeColumns(page, 'gantt-task-grid')).toEqual(GANTT_DEFAULT);
  expect(await storedColumns(page, 'gantt-task-grid')).toEqual(GANTT_DEFAULT);
  expect(await storeColumns(page, 'full-task-grid')).toEqual(OLD_TABLE);
  expect(await storedColumns(page, 'full-task-grid')).toEqual(OLD_TABLE);
});
