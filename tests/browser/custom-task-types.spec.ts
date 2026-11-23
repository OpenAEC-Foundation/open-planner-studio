import type { Page } from '@playwright/test';
import { expect, seedProject, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';

async function showProperties(page: Page, taskId: string): Promise<void> {
  await page.evaluate((id) => {
    const store = window.__OPS__!.store.getState();
    store.selectTask(id);
    store.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
  }, taskId);
  await expect(page.locator('[data-ops-task-type]').getByRole('button')).toBeVisible();
}

async function createFromCurrentSelector(page: Page, name: string): Promise<void> {
  const selector = page.locator('[data-ops-task-type]');
  await selector.getByRole('button').click();
  const options = page.getByRole('listbox').getByRole('option');
  await options.nth((await options.count()) - 2).click();
  const dialog = page.locator('[data-ops-new-task-type-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').fill(name);
  await dialog.getByRole('button', { name: /^(Create|Aanmaken)$/ }).click();
  await expect(dialog).toBeHidden();
}

test('persoonlijk taaktype: Properties maakt, groepeert, hernoemt, verwijdert en herstelt projectkopie', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{ name: 'Inspecteer gevel', start: '2026-09-07', finish: '2026-09-08' }]);
  await showProperties(page, taskId);
  expect(await page.locator('[data-ops-task-type] select').count()).toBe(0);

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
  // Eén keer een kleur (#856); die blijft bij hernoemen, ook in de projectkopie.
  expect(created.personal[0].color).toMatch(/^#[0-9A-F]{6}$/i);
  expect(created.catalog).toEqual(created.personal);
  expect(created.task?.taskType).toBe('USERDEFINED');
  expect(created.task?.customTaskTypeId).toBe(created.personal[0].id);

  await createFromCurrentSelector(page, 'engineering');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-personalTaskTypes') ?? '[]')))
    .toEqual(created.personal);

  const select = page.locator('[data-ops-task-type]');
  await select.getByRole('button').click();
  await expect(page.getByRole('listbox')).toContainText(/Built-in work categories/);
  await expect(page.getByRole('listbox')).toContainText(/My work categories/);
  await page.getByRole('option', { name: /^(Manage work categories|Werksoorten beheren)/ }).click();

  const manager = page.locator('[data-ops-task-type-manager]');
  const editButton = manager.getByRole('button', { name: /^(Edit|Bewerken)$/ });
  const removeButton = manager.getByRole('button', { name: /^(Remove|Verwijderen)$/ });
  await expect(editButton).toHaveAttribute('title', /^(Edit|Bewerken)$/);
  await expect(removeButton).toHaveAttribute('title', /^(Remove|Verwijderen)$/);
  expect(await editButton.locator('svg').count()).toBe(1);
  expect(await removeButton.locator('svg').count()).toBe(1);
  await editButton.focus();
  await expect(editButton).toBeFocused();
  await editButton.click();
  await manager.getByRole('textbox').fill('Werkvoorbereiding');
  await manager.getByRole('button', { name: /^(Save|Opslaan)$/ }).click();
  await expect(manager).toContainText('Werkvoorbereiding');

  // Het type staat ook in dit project (#804 keuze 7): de app vraagt of de naam daar mee moet.
  const question = page.locator('[data-ops-rename-project-task-type]');
  await expect(question).toBeVisible();
  await expect(question).toContainText('Engineering');
  await expect(question).toContainText('Werkvoorbereiding');
  await question.getByRole('button', { name: /^(Only in my list|Alleen in mijn lijst)$/ }).click();
  await expect(question).toBeHidden();
  await expect(manager).toBeVisible();

  // Alleen in mijn lijst: de projectkopie en de bestaande toekenning houden hun naam.
  const names = () => page.evaluate(() => ({
    personal: JSON.parse(localStorage.getItem('ops-personalTaskTypes') ?? '[]'),
    project: window.__OPS__!.store.getState().customTaskTypes,
  }));
  expect(await names()).toEqual({
    personal: [{ id: created.personal[0].id, name: 'Werkvoorbereiding', color: created.personal[0].color }],
    project: [{ id: created.personal[0].id, name: 'Engineering', color: created.personal[0].color }],
  });

  // Nogmaals opslaan met dezelfde naam vraagt het opnieuw, want het project heet nog anders.
  await editButton.click();
  await manager.getByRole('button', { name: /^(Save|Opslaan)$/ }).click();
  await expect(question).toBeVisible();
  await question.getByRole('button', { name: /^(Also in this project|Ook in dit project)$/ }).click();
  await expect(question).toBeHidden();
  expect(await names()).toEqual({
    personal: [{ id: created.personal[0].id, name: 'Werkvoorbereiding', color: created.personal[0].color }],
    project: [{ id: created.personal[0].id, name: 'Werkvoorbereiding', color: created.personal[0].color }],
  });
  expect(await page.evaluate(() => window.__OPS__!.store.getState().isDirty)).toBe(true);
  await manager.getByRole('button', { name: /^(Close|Sluiten)$/ }).click();
  await expect(manager).toBeHidden();
  await expect(select.getByRole('button')).toContainText('Werkvoorbereiding');

  // Ctrl+Z zet de naam in het project terug; de persoonlijke naam blijft.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await names()).project).toEqual([{ id: created.personal[0].id, name: 'Engineering', color: created.personal[0].color }]);
  await expect(select.getByRole('button')).toContainText('Engineering');
  expect((await names()).personal).toEqual([{ id: created.personal[0].id, name: 'Werkvoorbereiding', color: created.personal[0].color }]);

  await select.getByRole('button').click();
  await page.getByRole('option', { name: /^(Manage work categories|Werksoorten beheren)/ }).click();
  await expect(manager).toBeVisible();

  page.once('dialog', dialog => void dialog.accept());
  await removeButton.click();
  await expect(manager.getByText(/^(?:From this project|Uit dit project)$/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-personalTaskTypes') ?? '[]'))).toEqual([]);
  expect(await page.evaluate((id) => {
    const state = window.__OPS__!.store.getState();
    return {
      taskTypeId: state.tasks.find(task => task.id === id)?.customTaskTypeId,
      catalog: state.customTaskTypes,
    };
  }, taskId)).toEqual({ taskTypeId: created.personal[0].id, catalog: created.catalog });

  await manager.getByRole('button', { name: /^(Add to my work categories|Toevoegen aan mijn werksoorten)$/ }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-personalTaskTypes') ?? '[]')))
    .toEqual(created.catalog);

  // Een werksoort die geen taak gebruikt (eigenaarsbesluit 18 november 2026): hernoemen geeft geen vraag en
  // de projectkopie krijgt de nieuwe naam stil, zonder dat het document gewijzigd raakt. Daarna tonen het
  // eigenschappenpaneel en de keuzes van de kolom Eigen werksoort de nieuwe naam (knownbug 1829).
  await manager.getByRole('button', { name: /^(Close|Sluiten)$/ }).click();
  await expect(manager).toBeHidden();
  await select.getByRole('button').click();
  await page.getByRole('option', { name: /^(Construction|Bouw)$/ }).click();
  expect(await page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(task => task.id === id)?.customTaskTypeId, taskId))
    .toBeUndefined();
  await page.evaluate(() => window.__OPS__!.store.setState({ isDirty: false })); // zoals na opslaan
  const historyLength = await page.evaluate(() => window.__OPS__!.store.getState().historyEvents.length);
  await select.getByRole('button').click();
  await page.getByRole('option', { name: /^(Manage work categories|Werksoorten beheren)/ }).click();
  await editButton.click();
  await manager.getByRole('textbox').fill('Ontwerp');
  await manager.getByRole('button', { name: /^(Save|Opslaan)$/ }).click();
  await expect(manager).toContainText('Ontwerp');
  await expect(question).toHaveCount(0);
  expect(await names()).toEqual({
    personal: [{ id: created.personal[0].id, name: 'Ontwerp', color: created.personal[0].color }],
    project: [{ id: created.personal[0].id, name: 'Ontwerp', color: created.personal[0].color }],
  });
  expect(await page.evaluate(() => {
    const state = window.__OPS__!.store.getState();
    return { dirty: state.isDirty, history: state.historyEvents.length };
  })).toEqual({ dirty: false, history: historyLength });
  await manager.getByRole('button', { name: /^(Close|Sluiten)$/ }).click();
  await expect(manager).toBeHidden();

  await select.getByRole('button').click();
  await page.getByRole('option', { name: 'Ontwerp', exact: true }).click();
  await expect(select.getByRole('button')).toContainText('Ontwerp');

  await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    const columns = store.taskGridSurfaces['full-task-grid'].columns;
    store.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'task.customTaskTypeId', width: 160, pinned: false } as unknown as (typeof columns)[number],
    ]);
  });
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const typeCell = page.locator('[data-task-grid-surface-id="full-task-grid"]').locator(
    `[data-grid-data-row="true"][data-grid-row-key="${taskId}"] [data-grid-data-cell="true"][data-grid-column-id="task.customTaskTypeId"]`,
  );
  await typeCell.scrollIntoViewIfNeeded();
  await typeCell.click();
  await page.keyboard.press('Enter');
  const columnChoices = page.getByRole('listbox');
  await expect(columnChoices.getByRole('option', { name: 'Ontwerp', exact: true })).toBeVisible();
  await expect(columnChoices).not.toContainText('Engineering');
  await page.keyboard.press('Escape');
});

test('Taaktypekiezer: een geïmporteerd projecttype blijft kiesbaar zonder persoonlijke kopie', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{ name: 'Geïmporteerde taak', start: '2026-09-07', finish: '2026-09-08' }]);
  await page.evaluate(() => window.__OPS__!.store.getState().ensureProjectTaskType({
    id: 'imported-permit', name: 'Imported permit',
  }));
  await showProperties(page, taskId);

  const selector = page.locator('[data-ops-task-type]');
  await selector.getByRole('button').click();
  await expect(page.getByRole('listbox')).toContainText(/From this project/);
  await page.getByRole('option', { name: 'Imported permit', exact: true }).click();
  expect(await page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(task => task.id === id)?.customTaskTypeId, taskId))
    .toBe('imported-permit');

  // Een eigen type hernoemen naar de naam van dat geïmporteerde type: in de eigen lijst mag het, in
  // het project niet (#804 keuze 7). De projectnaam blijft en een melding zegt waarom.
  await createFromCurrentSelector(page, 'Permit check');
  await selector.getByRole('button').click();
  await page.getByRole('option', { name: /^(Manage work categories|Werksoorten beheren)/ }).click();
  const manager = page.locator('[data-ops-task-type-manager]');
  await manager.getByRole('button', { name: /^(Edit|Bewerken)$/ }).click();
  await manager.getByRole('textbox').fill('Imported permit');
  await manager.getByRole('button', { name: /^(Save|Opslaan)$/ }).click();
  const question = page.locator('[data-ops-rename-project-task-type]');
  await question.getByRole('button', { name: /^(Also in this project|Ook in dit project)$/ }).click();
  await expect(question).toBeHidden();
  await expect(page.locator('.ops-toast').filter({ hasText: /Permit check/ })).toContainText('Imported permit');
  expect(await page.evaluate(() => window.__OPS__!.store.getState().customTaskTypes.map(type => type.name)))
    .toEqual(['Imported permit', 'Permit check']);

  // De vraag hoort bij het document waarin ze gesteld is (fixronde 1 van #999): wisselt het actieve document
  // terwijl ze openstaat, ook naar een document met een geselecteerde taak (het paneel blijft staan), dan vervalt ze.
  await manager.getByRole('button', { name: /^(Edit|Bewerken)$/ }).click();
  await manager.getByRole('textbox').fill('Permit check 2');
  await manager.getByRole('button', { name: /^(Save|Opslaan)$/ }).click();
  await expect(question).toBeVisible();
  const docA = await page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId);
  await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    store.newDocument();
    const other = store.addTask({ name: 'Taak in B' });
    window.__OPS__!.store.getState().selectTask(other);
  });
  await expect(question).toBeHidden();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().customTaskTypes)).toEqual([]);
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), docA);
  await expect(question).toBeHidden();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().customTaskTypes.map(type => type.name)))
    .toEqual(['Imported permit', 'Permit check']);
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
  const selector = taskDialog.locator('[data-ops-task-type]');
  await selector.getByRole('button').click();
  await page.getByRole('option', { name: 'Permit', exact: true }).click();
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

  // Hernoemen vanuit Taak bewerken (fixronde 1 van #999): de hernoeming in het project is een eigen stap ná
  // de taakbewerking. Annuleren draait alleen de taakbewerking terug; na Opslaan zet één Ctrl+Z alleen de
  // naam van de werksoort terug en een tweede de taakbewerking.
  const permitId = beforeCancel.personal[0].id;
  const stateNow = () => page.evaluate(({ id, task }) => {
    const state = window.__OPS__!.store.getState();
    return {
      project: state.customTaskTypes.find(type => type.id === id)?.name,
      taskName: state.tasks.find(item => item.id === task)?.name,
    };
  }, { id: permitId, task: taskId });
  const renameInDialog = async (newName: string) => {
    await taskDialog.locator('[data-ops-task-type]').getByRole('button').click();
    await page.getByRole('option', { name: /^(Manage work categories|Werksoorten beheren)/ }).click();
    const manager = page.locator('[data-ops-task-type-manager]');
    await manager.getByRole('button', { name: /^(Edit|Bewerken)$/ }).click();
    await manager.getByRole('textbox').fill(newName);
    await manager.getByRole('button', { name: /^(Save|Opslaan)$/ }).click();
    const question = page.locator('[data-ops-rename-project-task-type]');
    await question.getByRole('button', { name: /^(Also in this project|Ook in dit project)$/ }).click();
    await expect(question).toBeHidden();
    await manager.getByRole('button', { name: /^(Close|Sluiten)$/ }).click();
    await expect(manager).toBeHidden();
    await expect(taskDialog.locator('[data-ops-task-type]').getByRole('button')).toContainText(newName);
  };

  await page.evaluate((id) => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), taskId);
  await expect(taskDialog).toBeVisible();
  await renameInDialog('Permit review');
  await taskDialog.getByRole('button', { name: /^(Cancel|Annuleren)$/ }).click();
  await expect(taskDialog).toBeHidden();
  expect(await stateNow()).toEqual({ project: 'Permit review', taskName: 'Vergunning aanvragen' });

  await page.evaluate((id) => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), taskId);
  await expect(taskDialog).toBeVisible();
  await renameInDialog('Permit final');
  await taskDialog.locator('[data-ops-task-name]').fill('Vergunning indienen');
  await taskDialog.getByRole('button', { name: /^(Save|Opslaan)$/ }).click();
  await expect(taskDialog).toBeHidden();
  expect(await stateNow()).toEqual({ project: 'Permit final', taskName: 'Vergunning indienen' });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+z');
  await expect.poll(stateNow).toEqual({ project: 'Permit review', taskName: 'Vergunning indienen' });
  await page.keyboard.press('Control+z');
  await expect.poll(stateNow).toEqual({ project: 'Permit review', taskName: 'Vergunning aanvragen' });
});

test('taaktypen blijven bruikbaar in RTL en corrupte app-opslag wordt veilig genegeerd', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    localStorage.setItem('ops-personalTaskTypes', '{kapot');
    localStorage.setItem('ops-locale', 'ar');
  });
  await page.reload();
  await waitForOps(page);
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    const state = window.__OPS__!.store.getState();
    state.newProject();
    state.setUI({ showWelcomeDialog: false, showTourOverlay: false });
  });
  const [taskId] = await seedProject(page, [{ name: 'RTL', start: '2026-09-07', finish: '2026-09-08' }]);
  await showProperties(page, taskId);
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  expect(await page.evaluate(() => localStorage.getItem('ops-personalTaskTypes'))).toBe('{kapot');

  const selector = page.locator('[data-ops-task-type]');
  await selector.getByRole('button').click();
  const options = page.getByRole('listbox').getByRole('option');
  await options.nth((await options.count()) - 2).click();
  const dialog = page.locator('[data-ops-new-task-type-dialog]');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
  await expect(dialog.getByRole('textbox')).toBeFocused();
  await dialog.getByRole('textbox').fill('نوع مراجعة');
  await dialog.getByRole('button', { name: 'إنشاء' }).click();

  await selector.getByRole('button').click();
  const managerOptions = page.getByRole('listbox').getByRole('option');
  await managerOptions.nth((await managerOptions.count()) - 1).click();
  const manager = page.locator('[data-ops-task-type-manager]');
  const editButton = manager.getByRole('button', { name: 'تحرير' });
  const removeButton = manager.getByRole('button', { name: 'حذف' });
  await expect(editButton).toHaveAttribute('title', 'تحرير');
  await expect(removeButton).toHaveAttribute('title', 'حذف');
  expect(await editButton.locator('svg').count()).toBe(1);
  expect(await removeButton.locator('svg').count()).toBe(1);
});
