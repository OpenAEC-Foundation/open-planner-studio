import type { Page } from '@playwright/test';
import { expect, seedProject, test, waitForOps } from './fixtures/ops';

const NEW = '__ops_new_task_type__';
const MANAGE = '__ops_manage_task_types__';

async function showProperties(page: Page, taskId: string): Promise<void> {
  await page.evaluate((id) => {
    const store = window.__OPS__!.store.getState();
    store.selectTask(id);
    store.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
  }, taskId);
  await expect(page.locator('[data-ops-task-type]')).toBeVisible();
}

async function createFromCurrentSelector(page: Page, name: string): Promise<void> {
  await page.locator('[data-ops-task-type]').selectOption(NEW);
  const dialog = page.locator('[data-ops-new-task-type-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').fill(name);
  await dialog.getByRole('button', { name: /^(Create|Aanmaken)$/ }).click();
  await expect(dialog).toBeHidden();
}

test('persoonlijk taaktype: Properties maakt, groepeert, hernoemt, verwijdert en herstelt projectkopie', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{ name: 'Inspecteer gevel', start: '2026-09-07', finish: '2026-09-08' }]);
  await showProperties(page, taskId);

  await createFromCurrentSelector(page, '  Engineering  ');
  const created = await page.evaluate((id) => {
    const state = window.__OPS__!.store.getState();
    return {
      task: state.tasks.find(task => task.id === id),
      catalog: state.customTaskTypes,
      personal: JSON.parse(localStorage.getItem('ops-personalTaskTypes') ?? '[]'),
    };
  }, taskId);
  expect(created.personal).toHaveLength(1);
  expect(created.personal[0].name).toBe('Engineering');
  expect(created.catalog).toEqual(created.personal);
  expect(created.task?.taskType).toBe('USERDEFINED');
  expect(created.task?.customTaskTypeId).toBe(created.personal[0].id);

  await createFromCurrentSelector(page, 'engineering');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-personalTaskTypes') ?? '[]')))
    .toEqual(created.personal);

  const select = page.locator('[data-ops-task-type]');
  expect(await select.locator('optgroup').evaluateAll(groups => groups.map(group => (group as HTMLOptGroupElement).label)))
    .toEqual(expect.arrayContaining(['Built-in types', 'My task types']));

  await select.selectOption(MANAGE);
  const manager = page.locator('[data-ops-task-type-manager]');
  await manager.getByRole('button', { name: /^(Edit|Bewerken)$/ }).click();
  await manager.getByRole('textbox').fill('Werkvoorbereiding');
  await manager.getByRole('button', { name: /^(Save|Opslaan)$/ }).click();
  await expect(manager).toContainText('Werkvoorbereiding');

  // Globaal hernoemen herschrijft de projectsnapshot en bestaande toekenning bewust niet.
  expect(await page.evaluate(() => ({
    personal: JSON.parse(localStorage.getItem('ops-personalTaskTypes') ?? '[]'),
    project: window.__OPS__!.store.getState().customTaskTypes,
  }))).toEqual({
    personal: [{ id: created.personal[0].id, name: 'Werkvoorbereiding' }],
    project: [{ id: created.personal[0].id, name: 'Engineering' }],
  });

  page.once('dialog', dialog => void dialog.accept());
  await manager.getByRole('button', { name: /^(Remove|Verwijderen)$/ }).click();
  await expect(manager.getByText(/^(?:From this project|Uit dit project)$/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-personalTaskTypes') ?? '[]'))).toEqual([]);
  expect(await page.evaluate((id) => {
    const state = window.__OPS__!.store.getState();
    return {
      taskTypeId: state.tasks.find(task => task.id === id)?.customTaskTypeId,
      catalog: state.customTaskTypes,
    };
  }, taskId)).toEqual({ taskTypeId: created.personal[0].id, catalog: created.catalog });

  await manager.getByRole('button', { name: /^(Add to my task types|Toevoegen aan mijn taaktypen)$/ }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-personalTaskTypes') ?? '[]')))
    .toEqual(created.catalog);
});

test('Taak bewerken: aanmaken blijft app-breed na Annuleren maar materialiseert pas bij Opslaan', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{ name: 'Vergunning aanvragen', start: '2026-09-07', finish: '2026-09-08' }]);
  await page.evaluate((id) => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), taskId);
  const taskDialog = page.locator('[data-ops-task-dialog]');
  await expect(taskDialog).toBeVisible();

  await createFromCurrentSelector(page, '  Permit  ');
  const beforeCancel = await page.evaluate((id) => {
    const state = window.__OPS__!.store.getState();
    return {
      taskTypeId: state.tasks.find(task => task.id === id)?.customTaskTypeId ?? null,
      catalog: state.customTaskTypes,
      personal: JSON.parse(localStorage.getItem('ops-personalTaskTypes') ?? '[]'),
    };
  }, taskId);
  expect(beforeCancel.personal).toHaveLength(1);
  expect(beforeCancel.taskTypeId).toBeNull();
  expect(beforeCancel.catalog).toEqual([]);

  await taskDialog.getByRole('button', { name: /^(Cancel|Annuleren)$/ }).click();
  await expect(taskDialog).toBeHidden();
  expect(await page.evaluate((id) => {
    const state = window.__OPS__!.store.getState();
    return {
      taskTypeId: state.tasks.find(task => task.id === id)?.customTaskTypeId ?? null,
      catalog: state.customTaskTypes,
      personal: JSON.parse(localStorage.getItem('ops-personalTaskTypes') ?? '[]'),
    };
  }, taskId)).toEqual(beforeCancel);

  await page.evaluate((id) => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), taskId);
  await taskDialog.locator('[data-ops-task-type]').selectOption(`custom:${beforeCancel.personal[0].id}`);
  await taskDialog.getByRole('button', { name: /^(Save|Opslaan)$/ }).click();
  await expect(taskDialog).toBeHidden();
  expect(await page.evaluate((id) => {
    const state = window.__OPS__!.store.getState();
    return {
      taskType: state.tasks.find(task => task.id === id)?.taskType,
      taskTypeId: state.tasks.find(task => task.id === id)?.customTaskTypeId,
      catalog: state.customTaskTypes,
    };
  }, taskId)).toEqual({
    taskType: 'USERDEFINED',
    taskTypeId: beforeCancel.personal[0].id,
    catalog: beforeCancel.personal,
  });
});

test('taaktypen blijven bruikbaar in RTL en corrupte app-opslag wordt veilig genegeerd', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    localStorage.setItem('ops-personalTaskTypes', '{kapot');
    localStorage.setItem('ops-locale', 'ar');
  });
  await page.reload();
  await waitForOps(page);
  await page.evaluate(() => {
    const state = window.__OPS__!.store.getState();
    state.newProject();
    state.setUI({ showWelcomeDialog: false, showTourOverlay: false });
  });
  const [taskId] = await seedProject(page, [{ name: 'RTL', start: '2026-09-07', finish: '2026-09-08' }]);
  await showProperties(page, taskId);
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  expect(await page.evaluate(() => localStorage.getItem('ops-personalTaskTypes'))).toBe('{kapot');

  await page.locator('[data-ops-task-type]').selectOption(NEW);
  const dialog = page.locator('[data-ops-new-task-type-dialog]');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
  await expect(dialog.getByRole('textbox')).toBeFocused();
});
