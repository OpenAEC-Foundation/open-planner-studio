import type { Locator, Page } from '@playwright/test';
import zhCommon from '@/i18n/locales/zh/common.json' with { type: 'json' };
import { barPoint, expect, state, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';

async function seedAssignedLeaf(page: Page): Promise<{ L: string; N: string; R: string }> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ name: 'Toewijzingen', startDate: '2026-09-07' });
    s.setViewStartDate('2026-09-04');
    const L = s.addTask({ name: 'Metselen' });
    const N = window.__OPS__!.store.getState().addTask({ name: 'Voegen' });
    const R = window.__OPS__!.store.getState().addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 1 });
    window.__OPS__!.store.getState().assignResource(L, R, 1);
    window.__OPS__!.store.getState().runCPM();
    window.__OPS__!.store.getState().setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    return { L, N, R };
  });
}

const assignmentTaskIds = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().assignments.map(a => a.taskId));
const assignmentSnapshot = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().assignments);

test('mijlpaalvinkje op een taak met toewijzing wordt geweigerd met melding', async ({ page, ops: _ops }) => {
  const { L } = await seedAssignedLeaf(page);
  await page.evaluate((id) => window.__OPS__!.store.getState().selectTask(id), L);

  const checkbox = page.locator('label', { hasText: /^Milestone$/ }).first().locator('input[type=checkbox]');
  await expect(checkbox).not.toBeChecked();
  const beforeSingle = await assignmentSnapshot(page);
  expect(beforeSingle).toHaveLength(1);
  await checkbox.click();

  await expect(page.locator('.ops-toast', { hasText: /'Metselen' has resource assignments and cannot become a milestone/ }))
    .toBeVisible();
  await expect(checkbox).not.toBeChecked();
  expect(await page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.isMilestone, L)).toBe(false);
  expect(await assignmentSnapshot(page)).toEqual(beforeSingle);

  await page.locator('.ops-toast [data-ops-toast-close]').click();
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.getByRole('option', { name: /中文/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const zhCheckbox = page.locator('[data-ops-rail] label', { hasText: /^里程碑$/ }).first().locator('input[type=checkbox]');
  await zhCheckbox.click();
  const named = page.locator('.ops-toast.toast-error');
  await expect(named).toContainText('Metselen');
  await expect(named).not.toContainText('{{');
  await expect(named).toHaveAttribute('role', 'alert');
  await expect(zhCheckbox).not.toBeChecked();
  expect(await assignmentSnapshot(page)).toEqual(beforeSingle);
  await named.locator('[data-ops-toast-close]').click();

  const N = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const n = s.tasks.find(t => t.name === 'Voegen')!.id;
    const resource = s.addResource({ name: 'Voeger', type: 'LABOR', description: '', maxUnits: 1 });
    window.__OPS__!.store.getState().assignResource(n, resource, 0.375);
    return n;
  });
  await selectRow(page, L);
  await nameCell(page, N).click({ modifiers: ['Control'] });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds.length)).toBe(2);
  const beforeBulk = await assignmentSnapshot(page);
  expect(beforeBulk).toHaveLength(2);
  expect(new Set(beforeBulk.map(a => a.resourceId)).size).toBe(2);
  expect(beforeBulk.map(a => a.unitsPerDay)).toEqual([1, 0.375]);
  await nameCell(page, L).click({ button: 'right' });
  await page.getByText('切换里程碑', { exact: true }).click();
  const bulk = page.locator('.ops-toast.toast-error');
  await expect(bulk).toHaveCount(1);
  await expect(bulk.locator('.ops-toast-message')).toHaveText(
    zhCommon.notifications.milestoneRefusedAssignmentsMany_other.replace('{{count}}', '2'));
  await expect(bulk.locator('.ops-toast-detail')).toHaveText(
    zhCommon.notifications.refusedTaskNames.replace('{{names}}', 'Metselen, Voegen'));
  await expect(bulk).toHaveAttribute('role', 'alert');
  expect(await page.evaluate(() => window.__OPS__!.store.getState().tasks.map(t => t.isMilestone))).toEqual([false, false]);
  expect(await assignmentSnapshot(page)).toEqual(beforeBulk);
});

const dialog = (page: Page) => page.locator('[data-ops-phase-dialog]');
const moveButton = (page: Page) => dialog(page).locator('[data-ops-phase-move]');
const removeButton = (page: Page) => dialog(page).locator('[data-ops-phase-remove]');
const cancelButton = (page: Page) => dialog(page).locator('[data-ops-phase-cancel]');
const blockedNote = (page: Page) => dialog(page).locator('[data-ops-phase-move-blocked]');
const notice = (page: Page) => dialog(page).locator('[data-ops-phase-notice]');
const actualWorkLines = (page: Page) => dialog(page).locator('[data-ops-phase-actual-work]');

function nameCell(page: Page, taskId: string): Locator {
  return page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"] [data-grid-data-cell="true"][data-grid-column-id="task.name"]`,
  );
}
const parentOf = (page: Page, id: string) =>
  page.evaluate(taskId => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!.parentId, id);
const fingerprint = (page: Page) => page.evaluate(() => {
  const s = window.__OPS__!.store.getState();
  return JSON.stringify({
    tasks: s.tasks.map(t => [t.id, t.parentId, t.childIds]),
    assignments: s.assignments,
  });
});

async function selectRow(page: Page, id: string): Promise<void> {
  await nameCell(page, id).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([id]);
}

test('Alt+Shift+→ vraagt eerst; Verplaatsen verhuist de toewijzing naar de nieuwe subtaak', async ({ page, ops: _ops }) => {
  const { L, N, R } = await seedAssignedLeaf(page);
  const before = await fingerprint(page);
  const depth = (await state(page)).undoDepth;

  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');

  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText('Task becomes a summary task');
  await expect(dialog(page).locator('[data-ops-phase-dialog-text]')).toHaveText(
    "'Metselen' gets the subtask 'Voegen' and becomes a summary task. A summary task has no assignments of its own. "
    + 'What do you want to do with the assignment of Metselaar?',
  );
  await expect(dialog(page).locator('button[data-ops-phase-cancel], button[data-ops-phase-remove], button[data-ops-phase-move]'))
    .toHaveText(['Cancel', 'Remove assignment', "Move to 'Voegen'"]);
  await expect(moveButton(page)).toBeEnabled();
  await expect(moveButton(page)).toHaveClass(/btn--primary/);
  await expect(notice(page)).toHaveCount(0);
  expect(await fingerprint(page)).toBe(before);

  await moveButton(page).click();
  await expect(dialog(page)).toBeHidden();
  expect(await parentOf(page, N)).toBe(L);
  expect(await assignmentTaskIds(page)).toEqual([N]);
  expect((await state(page)).undoDepth).toBe(depth + 1);
  await expect(page.locator('.ops-toast', { hasText: /moved to subtask/ })).toHaveCount(0);

  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate((rid) => Object.values(
    (window.__OPS__!.store.getState().resourceLoadResult?.load?.[rid] ?? {}) as Record<string, number>,
  ).reduce((sum, value) => sum + value, 0), R)).toBe(5);

  await page.keyboard.press('Control+z');
  await expect.poll(() => parentOf(page, N)).toBeNull();
  expect(await assignmentTaskIds(page)).toEqual([L]);
});

test('Annuleren en Escape veranderen niets, ook het inspringen niet', async ({ page, ops: _ops }) => {
  const { L, N } = await seedAssignedLeaf(page);
  const before = await fingerprint(page);
  const depth = (await state(page)).undoDepth;

  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toBeVisible();
  await cancelButton(page).click();
  await expect(dialog(page)).toBeHidden();
  expect(await fingerprint(page)).toBe(before);
  expect((await state(page)).undoDepth).toBe(depth);

  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  expect(await fingerprint(page)).toBe(before);
  expect((await state(page)).undoDepth).toBe(depth);
  expect(await assignmentTaskIds(page)).toEqual([L]);
});

test('subtaak heeft dezelfde resource al: Verplaatsen uit, oranje infoblok, Verwijderen primair', async ({ page, ops: _ops }) => {
  const { L, N, R } = await seedAssignedLeaf(page);
  await page.evaluate(({ n, r }) => window.__OPS__!.store.getState().assignResource(n, r, 1), { n: N, r: R });
  const own = await page.evaluate((n) => window.__OPS__!.store.getState().assignments.find(a => a.taskId === n)!.id, N);

  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toBeVisible();
  await expect(blockedNote(page)).toHaveText("Moving is not possible: 'Voegen' already has Metselaar.");
  await expect(notice(page)).toHaveClass(/alert--info/);
  await expect(moveButton(page)).toBeDisabled();
  await expect(removeButton(page)).toHaveClass(/btn--primary/);

  await removeButton(page).click();
  await expect(dialog(page)).toBeHidden();
  expect(await parentOf(page, N)).toBe(L);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().assignments.map(a => a.id))).toEqual([own]);

  await page.keyboard.press('Control+z');
  await expect.poll(() => parentOf(page, N)).toBeNull();
  expect((await assignmentTaskIds(page)).sort()).toEqual([L, N].sort());
});

test('lintknop Inspringen en rechtsklik › Inspringen (takenlijst en Gantt) tonen het venster', async ({ page, ops: _ops }) => {
  const { N } = await seedAssignedLeaf(page);
  const before = await fingerprint(page);
  const askAndCancel = async () => {
    await expect(dialog(page)).toBeVisible();
    await cancelButton(page).click();
    await expect(dialog(page)).toBeHidden();
    expect(await fingerprint(page)).toBe(before);
  };

  await selectRow(page, N);
  await page.getByRole('button', { name: /^Planning$/ }).first().click();
  await page.getByRole('button', { name: /^Indent$/ }).first().click();
  await askAndCancel();

  await page.getByRole('button', { name: /^Home$/ }).first().click();
  await expect(page.getByRole('button', { name: /^Indent$/ })).toHaveCount(0);

  await nameCell(page, N).click({ button: 'right' });
  await expect(page.getByRole('button', { name: /^Indent$/ })).toHaveCount(1);
  await page.getByRole('button', { name: /^Indent$/ }).click();
  await askAndCancel();

  const bar = await barPoint(page, N);
  await page.mouse.click(bar.x, bar.y, { button: 'right' });
  await expect(page.getByRole('button', { name: /^Indent$/ })).toHaveCount(1);
  await page.getByRole('button', { name: /^Indent$/ }).click();
  await askAndCancel();
});

test('rechtsklik › Subtaak toevoegen op een taak met toewijzing vraagt eerst', async ({ page, ops: _ops }) => {
  const { L } = await seedAssignedLeaf(page);
  const count = (await state(page)).tasks.length;

  await nameCell(page, L).click({ button: 'right' });
  await page.getByRole('button', { name: /^Add subtask$/ }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('[data-ops-phase-dialog-text]')).toContainText("'Metselen' gets the subtask 'New task'");
  expect((await state(page)).tasks.length).toBe(count);

  await moveButton(page).click();
  await expect(dialog(page)).toBeHidden();
  const child = await page.evaluate((l) => window.__OPS__!.store.getState().tasks.find(t => t.id === l)!.childIds[0], L);
  expect((await state(page)).tasks.length).toBe(count + 1);
  expect(await assignmentTaskIds(page)).toEqual([child]);
});

test('Taak bewerken › Bovenliggende taak: de vraag komt vóór het opslaan, Annuleren laat de dialoog open', async ({ page, ops: _ops }) => {
  const { L, N } = await seedAssignedLeaf(page);
  const depth = (await state(page)).undoDepth;

  await nameCell(page, N).click({ button: 'right' });
  await page.getByRole('button', { name: /^Edit\.\.\.$/ }).click();
  const taskDialog = page.locator('[data-ops-task-dialog]');
  await expect(taskDialog).toBeVisible();
  await taskDialog.getByLabel(/^Parent task$/).click();
  await page.getByRole('option', { name: /Metselen$/ }).click();
  await taskDialog.getByRole('button', { name: /^Save$/ }).click();

  await expect(dialog(page)).toBeVisible();
  await cancelButton(page).click();
  await expect(dialog(page)).toBeHidden();
  await expect(taskDialog).toBeVisible();
  expect(await parentOf(page, N)).toBeNull();

  await taskDialog.getByRole('button', { name: /^Save$/ }).click();
  await expect(dialog(page)).toBeVisible();
  await removeButton(page).click();
  await expect(dialog(page)).toBeHidden();
  await expect(taskDialog).toBeHidden();
  expect(await parentOf(page, N)).toBe(L);
  expect(await assignmentTaskIds(page)).toEqual([]);
  expect((await state(page)).undoDepth).toBe(depth + 1);
});

test('een selectie die twee fases maakt: één venster met per fase de resources', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const ids = await page.evaluate(() => {
    const s = () => window.__OPS__!.store.getState();
    s().setProject({ name: 'Twee fases', startDate: '2026-09-07' });
    const L1 = s().addTask({ name: 'Metselen' });
    const N1 = s().addTask({ name: 'Voegen' });
    const L2 = s().addTask({ name: 'Tegelen' });
    const N2 = s().addTask({ name: 'Kitten' });
    const R1 = s().addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 1 });
    const R2 = s().addResource({ name: 'Tegelzetter', type: 'LABOR', description: '', maxUnits: 1 });
    s().assignResource(L1, R1, 1);
    s().assignResource(L2, R2, 1);
    s().runCPM();
    return { L1, N1, L2, N2 };
  });
  await selectRow(page, ids.N1);
  await nameCell(page, ids.N2).click({ modifiers: ['Control'] });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds.length)).toBe(2);
  await page.keyboard.press('Alt+Shift+ArrowRight');

  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('[data-ops-phase-dialog-row]')).toHaveText(["'Metselen': Metselaar", "'Tegelen': Tegelzetter"]);
  await expect(moveButton(page)).toHaveText('Move to the subtasks');
  await moveButton(page).click();
  await expect(dialog(page)).toBeHidden();
  expect((await assignmentTaskIds(page)).sort()).toEqual([ids.N1, ids.N2].sort());
});

test('Nederlands: de canonieke tekst en knoppen', async ({ page, ops: _ops }) => {
  await page.evaluate(() => localStorage.setItem('ops-locale', 'nl'));
  await page.reload();
  await waitForOps(page);
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.newProject();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false, activeRibbonTab: 'start' });
  });
  const { N } = await seedAssignedLeaf(page);
  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toContainText('Taak wordt een samenvattingstaak');
  await expect(dialog(page).locator('[data-ops-phase-dialog-text]')).toHaveText(
    "'Metselen' krijgt de subtaak 'Voegen' en wordt een samenvattingstaak. Een samenvattingstaak heeft geen eigen toewijzingen. "
    + 'Wat doe je met de toewijzing van Metselaar?',
  );
  await expect(dialog(page).locator('button[data-ops-phase-cancel], button[data-ops-phase-remove], button[data-ops-phase-move]'))
    .toHaveText(['Annuleren', 'Toewijzing verwijderen', "Verplaatsen naar 'Voegen'"]);
  await cancelButton(page).click();
});

test('zolang het venster open is, doen Ctrl+Z, Ctrl+Y en Ctrl+V niets (review #374)', async ({ page, ops: _ops }) => {
  const { L, N } = await seedAssignedLeaf(page);
  await page.evaluate((l) => {
    const s = () => window.__OPS__!.store.getState();
    const R2 = s().addResource({ name: 'Opperman', type: 'LABOR', description: '', maxUnits: 1 });
    s().assignResource(l, R2, 1);
    s().unassignResource(s().assignments.find(a => a.resourceId === R2)!.id);
    s().copyTasks();
  }, L);
  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toBeVisible();
  const before = await fingerprint(page);
  const depth = (await state(page)).undoDepth;

  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+Shift+z');
  await page.keyboard.press('Control+v');
  await expect(dialog(page)).toBeVisible();
  expect(await fingerprint(page)).toBe(before);
  expect((await state(page)).undoDepth).toBe(depth);

  await removeButton(page).click();
  await expect(dialog(page)).toBeHidden();
  expect(await parentOf(page, N)).toBe(L);
  expect(await assignmentTaskIds(page)).toEqual([]);
  await page.keyboard.press('Control+z');
  await expect.poll(() => parentOf(page, N)).toBeNull();
  expect(await assignmentTaskIds(page)).toEqual([L]);
});

test('Taak bewerken: taak ⇒ mijlpaal met een nieuwe ouder vraagt met het concept (review #374)', async ({ page, ops: _ops }) => {
  const { L, N } = await seedAssignedLeaf(page);
  await nameCell(page, N).click({ button: 'right' });
  await page.getByRole('button', { name: /^Edit\.\.\.$/ }).click();
  const taskDialog = page.locator('[data-ops-task-dialog]');
  await expect(taskDialog).toBeVisible();
  await taskDialog.locator('label', { hasText: /^Milestone$/ }).first().locator('input[type=checkbox]').check();
  await taskDialog.getByLabel(/^Parent task$/).click();
  await page.getByRole('option', { name: /Metselen$/ }).click();
  await taskDialog.getByRole('button', { name: /^Save$/ }).click();

  await expect(dialog(page)).toBeVisible();
  await expect(moveButton(page)).toBeDisabled();
  await expect(blockedNote(page)).toContainText("'Metselen' gets no subtask that can carry an assignment");
  await removeButton(page).click();
  await expect(taskDialog).toBeHidden();
  const after = await page.evaluate((n) => {
    const s = window.__OPS__!.store.getState();
    return { milestone: s.tasks.find(t => t.id === n)!.isMilestone, assignments: s.assignments.length };
  }, N);
  expect(after).toEqual({ milestone: true, assignments: 0 });
  expect(await parentOf(page, N)).toBe(L);
  await expect(page.locator('.ops-toast', { hasText: /Nothing was changed/ })).toHaveCount(0);
});

test('Taak bewerken: mijlpaal ⇒ taak met een nieuwe ouder mag verplaatsen (review #374)', async ({ page, ops: _ops }) => {
  const { L } = await seedAssignedLeaf(page);
  const M = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const id = s.addTask({ name: 'Keuring', isMilestone: true });
    window.__OPS__!.store.getState().runCPM();
    return id;
  });
  await nameCell(page, M).click({ button: 'right' });
  await page.getByRole('button', { name: /^Edit\.\.\.$/ }).click();
  const taskDialog = page.locator('[data-ops-task-dialog]');
  await expect(taskDialog).toBeVisible();
  await taskDialog.locator('label', { hasText: /^Milestone$/ }).first().locator('input[type=checkbox]').uncheck();
  await taskDialog.getByLabel(/^Parent task$/).click();
  await page.getByRole('option', { name: /Metselen$/ }).click();
  await taskDialog.getByRole('button', { name: /^Save$/ }).click();

  await expect(dialog(page)).toBeVisible();
  await expect(moveButton(page)).toBeEnabled();
  await expect(moveButton(page)).toHaveText("Move to 'Keuring'");
  await moveButton(page).click();
  await expect(taskDialog).toBeHidden();
  expect(await parentOf(page, M)).toBe(L);
  expect(await assignmentTaskIds(page)).toEqual([M]);
});

test('Taak bewerken › ? › Opslaan: na de keuze opent Help alsnog (review #374)', async ({ page, ops: _ops }) => {
  const { L, N } = await seedAssignedLeaf(page);
  await nameCell(page, N).click({ button: 'right' });
  await page.getByRole('button', { name: /^Edit\.\.\.$/ }).click();
  const taskDialog = page.locator('[data-ops-task-dialog]');
  await taskDialog.getByLabel(/^Parent task$/).click();
  await page.getByRole('option', { name: /Metselen$/ }).click();
  await taskDialog.locator('[data-ops-help-button="ref-taak-eigenschappen"]').click();
  await page.locator('[data-ops-help-leave-dialog] [data-ops-help-leave-choice="save"]').click();

  await expect(dialog(page)).toBeVisible();
  await moveButton(page).click();
  await expect(taskDialog).toBeHidden();
  expect(await parentOf(page, N)).toBe(L);
  await expect(page.locator('.help-panel')).toBeVisible();
  await expect(page.locator('.help-article-body')).toHaveAttribute('data-help-current', 'ref-taak-eigenschappen');
});

test('verricht werk: het infoblok noemt het, focus op Annuleren, Enter wijzigt niets (eigenaarsbesluit 2026-10-17)', async ({ page, ops: _ops }) => {
  const { L, N } = await seedAssignedLeaf(page);
  await page.evaluate(() => window.__OPS__!.store.setState((s) => { s.assignments[0].actualWorkMinutes = 450; }));
  const before = await fingerprint(page);
  const depth = (await state(page)).undoDepth;

  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toBeVisible();
  await expect(actualWorkLines(page)).toHaveText([
    'The assignment of Metselaar already has 7.5 hours of actual work. Removing it discards that work.',
  ]);
  await expect(notice(page)).toHaveClass(/alert--info/);
  await expect(cancelButton(page)).toBeFocused();
  await expect(cancelButton(page)).toHaveClass(/btn--primary/);
  await expect(removeButton(page)).not.toHaveClass(/btn--primary/);
  await expect(moveButton(page)).toBeEnabled();
  await expect(moveButton(page)).not.toHaveClass(/btn--primary/);

  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeHidden();
  expect(await fingerprint(page)).toBe(before);
  expect((await state(page)).undoDepth).toBe(depth);

  await page.evaluate(({ n }) => {
    const s = window.__OPS__!.store.getState();
    s.assignResource(n, s.assignments[0].resourceId, 1);
  }, { n: N });
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toBeVisible();
  await expect(moveButton(page)).toBeDisabled();
  await expect(cancelButton(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeHidden();
  expect(await parentOf(page, N)).toBeNull();

  await page.keyboard.press('Alt+Shift+ArrowRight');
  await removeButton(page).click();
  await expect(dialog(page)).toBeHidden();
  expect(await parentOf(page, N)).toBe(L);
  expect(await assignmentTaskIds(page)).toEqual([N]);
});

test('verricht werk in het Nederlands: de canonieke zin', async ({ page, ops: _ops }) => {
  await page.evaluate(() => localStorage.setItem('ops-locale', 'nl'));
  await page.reload();
  await waitForOps(page);
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.newProject();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false, activeRibbonTab: 'start' });
  });
  const { N } = await seedAssignedLeaf(page);
  await page.evaluate(() => window.__OPS__!.store.setState((s) => { s.assignments[0].actualWorkMinutes = 480; }));
  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(actualWorkLines(page)).toHaveText([
    'Op de toewijzing van Metselaar staat al 8 uur verricht werk. Verwijderen gooit dat weg.',
  ]);
  await cancelButton(page).click();
});

test('alle globale sneltoetsen staan dicht onder de vraag: Delete, Backspace, F5, Ctrl+S, Insert (review #374)', async ({ page, ops: _ops }) => {
  const { L, N } = await seedAssignedLeaf(page);
  let downloads = 0;
  page.on('download', () => { downloads++; });
  await page.evaluate(() => {
    const seen: Record<string, boolean> = {};
    (window as unknown as { __phaseKeys: Record<string, boolean> }).__phaseKeys = seen;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
        seen[`${e.shiftKey ? 'Shift+' : ''}${e.key.length === 1 ? e.key.toLowerCase() : e.key}`] = e.defaultPrevented;
      }
    });
  });
  await page.evaluate((n) => {
    const s = window.__OPS__!.store.getState();
    const t = s.tasks.find(x => x.id === n)!;
    s.updateTask(n, { time: { ...t.time, scheduleDuration: 6 } });
  }, N);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(true);
  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('[data-ops-help-button]')).toHaveCount(0);
  const snapshot = () => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return JSON.stringify({ tasks: s.tasks, assignments: s.assignments, stale: s.scheduleStale });
  });
  const before = await snapshot();
  const depth = (await state(page)).undoDepth;

  for (const key of ['Delete', 'Backspace', 'F5', 'Control+s', 'Control+Shift+s', 'Insert', 'Alt+Shift+ArrowLeft', 'Control+d', 'Control+z', 'Control+y']) {
    await page.keyboard.press(key);
    await expect(dialog(page), key).toBeVisible();
    expect(await snapshot(), key).toBe(before);
    expect((await state(page)).undoDepth, key).toBe(depth);
  }
  await page.waitForTimeout(500);
  expect(downloads).toBe(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.pendingIfcSchemaQuestion ?? null)).toBeNull();
  expect(await page.evaluate(() => (window as unknown as { __phaseKeys: Record<string, boolean> }).__phaseKeys))
    .toEqual({ F5: true, s: true, 'Shift+s': true });

  await moveButton(page).click();
  await expect(dialog(page)).toBeHidden();
  expect(await parentOf(page, N)).toBe(L);
  expect(await assignmentTaskIds(page)).toEqual([N]);
});

test('Taak bewerken: Delete onder de vraag verwijdert de bewerkte taak niet (review #374)', async ({ page, ops: _ops }) => {
  const { N } = await seedAssignedLeaf(page);
  await nameCell(page, N).click({ button: 'right' });
  await page.getByRole('button', { name: /^Edit\.\.\.$/ }).click();
  const taskDialog = page.locator('[data-ops-task-dialog]');
  await taskDialog.getByLabel(/^Parent task$/).click();
  await page.getByRole('option', { name: /Metselen$/ }).click();
  await taskDialog.getByRole('button', { name: /^Save$/ }).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');
  await cancelButton(page).click();
  await expect(taskDialog).toBeVisible();
  await expect(taskDialog).toContainText('Edit task');
  expect(await page.evaluate((n) => window.__OPS__!.store.getState().tasks.some(t => t.id === n), N)).toBe(true);
});

test('vangnet: verandert de vraag terwijl het venster open is, dan wijzigt de keuze niets en volgt een melding (review #374)', async ({ page, ops: _ops }) => {
  const { L, N } = await seedAssignedLeaf(page);
  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('[data-ops-phase-dialog-text]')).toContainText('the assignment of Metselaar?');
  await page.evaluate((l) => {
    const s = () => window.__OPS__!.store.getState();
    const R2 = s().addResource({ name: 'Opperman', type: 'LABOR', description: '', maxUnits: 1 });
    s().assignResource(l, R2, 1);
  }, L);
  const before = await fingerprint(page);
  const depth = (await state(page)).undoDepth;

  await removeButton(page).click();
  await expect(dialog(page)).toBeHidden();
  expect(await fingerprint(page)).toBe(before);
  expect((await state(page)).undoDepth).toBe(depth);
  expect(await parentOf(page, N)).toBeNull();
  expect(await assignmentTaskIds(page)).toEqual([L, L]);
  await expect(page.locator('.ops-toast', {
    hasText: 'The tasks or assignments changed while the question was open. Nothing was changed; please try again.',
  })).toBeVisible();

  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page).locator('[data-ops-phase-dialog-text]')).toContainText('Metselaar and Opperman');
  await moveButton(page).click();
  await expect(dialog(page)).toBeHidden();
  expect(await parentOf(page, N)).toBe(L);
  expect(await assignmentTaskIds(page)).toEqual([N, N]);
});

const LONG_CHILD = 'Upper floor slab — House 1 — reinforcement, formwork and pouring of the in-situ concrete (phase 2)';
const SHOTS = process.env.OPS_FASE_VRAAG_SHOTS;

async function expectButtonsInsideDialog(page: Page, label: string): Promise<void> {
  const panel = (await dialog(page).boundingBox())!;
  for (const button of [cancelButton(page), removeButton(page), moveButton(page)]) {
    const box = (await button.boundingBox())!;
    const where = `${label}: ${await button.getAttribute('class')} ${JSON.stringify(box)} in ${JSON.stringify(panel)}`;
    expect(box.x, where).toBeGreaterThanOrEqual(panel.x);
    expect(box.x + box.width, where).toBeLessThanOrEqual(panel.x + panel.width);
    expect(box.y + box.height, where).toBeLessThanOrEqual(panel.y + panel.height);
    expect(box.width, where).toBeGreaterThan(40);
  }
  for (const button of [cancelButton(page), removeButton(page)]) {
    expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth), `${label}: label past`).toBe(true);
  }
}

async function seedLongChild(page: Page): Promise<{ L: string; N: string }> {
  const { L, N } = await seedAssignedLeaf(page);
  await page.evaluate(({ id, name }) => window.__OPS__!.store.getState().updateTask(id, { name }), { id: N, name: LONG_CHILD });
  return { L, N };
}

async function checkAllSizesAndThemes(page: Page, label: string, shotName?: string): Promise<void> {
  for (const viewport of [{ width: 1600, height: 1000 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
      await expectButtonsInsideDialog(page, `${label} ${viewport.width} ${theme}`);
      if (SHOTS && shotName) {
        await page.waitForTimeout(200);
        await dialog(page).screenshot({ path: `${SHOTS}/${shotName}-${viewport.width}-${theme === 'light' ? 'licht' : 'donker'}.png` });
      }
    }
  }
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiTheme: 'light' }));
}

test('lange subtaaknaam: alle knoppen binnen het venster, label afgekapt, volledige naam in title (fixronde 4 #374)', async ({ page, ops: _ops }) => {
  const { L, N } = await seedLongChild(page);
  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toBeVisible();

  await expect(dialog(page).locator('[data-ops-phase-dialog-text]')).toContainText(LONG_CHILD);
  await expect(moveButton(page)).toHaveAttribute('title', `Move to '${LONG_CHILD}'`);
  await expect(moveButton(page)).toHaveText(`Move to '${LONG_CHILD}'`);
  expect(await moveButton(page).locator('[data-ops-phase-move-label]').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(dialog(page).locator('button[data-ops-phase-cancel], button[data-ops-phase-remove], button[data-ops-phase-move]'))
    .toHaveText(['Cancel', 'Remove assignment', `Move to '${LONG_CHILD}'`]);
  await expect(moveButton(page)).toHaveClass(/btn--primary/);
  await expect(moveButton(page)).toBeFocused();

  await checkAllSizesAndThemes(page, 'en', 'en-lang');

  await moveButton(page).click();
  await expect(dialog(page)).toBeHidden();
  expect(await parentOf(page, N)).toBe(L);
  expect(await assignmentTaskIds(page)).toEqual([N]);
});

test('lange subtaaknaam met verricht werk in het Nederlands: Annuleren primair en binnen het venster (fixronde 4 #374)', async ({ page, ops: _ops }) => {
  await page.evaluate(() => localStorage.setItem('ops-locale', 'nl'));
  await page.reload();
  await waitForOps(page);
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.newProject();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false, activeRibbonTab: 'start' });
  });
  const { N } = await seedLongChild(page);
  await page.evaluate(() => window.__OPS__!.store.setState((s) => { s.assignments[0].actualWorkMinutes = 450; }));
  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toBeVisible();
  await expect(cancelButton(page)).toBeFocused();
  await expect(cancelButton(page)).toHaveClass(/btn--primary/);
  await expect(cancelButton(page)).toHaveText('Annuleren');
  await expect(moveButton(page)).toHaveAttribute('title', `Verplaatsen naar '${LONG_CHILD}'`);

  await checkAllSizesAndThemes(page, 'nl', 'nl-verricht-werk');
  await cancelButton(page).click();
  await expect(dialog(page)).toBeHidden();
});

test('lange subtaaknaam in het Arabisch (RTL): alle knoppen binnen het venster (fixronde 4 #374)', async ({ page, ops: _ops }) => {
  await page.evaluate(() => localStorage.setItem('ops-locale', 'ar'));
  await page.reload();
  await waitForOps(page);
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.newProject();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false, activeRibbonTab: 'start' });
  });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const { N } = await seedLongChild(page);
  await selectRow(page, N);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(dialog(page)).toBeVisible();
  await expect(moveButton(page)).toBeFocused();
  const label = moveButton(page).locator('[data-ops-phase-move-label]');
  await expect(label).toHaveText(/[\u0600-\u06FF]/);
  expect(await label.evaluate(el => getComputedStyle(el).direction)).toBe('rtl');

  await checkAllSizesAndThemes(page, 'ar', 'ar-lang');
  await cancelButton(page).click();
  await expect(dialog(page)).toBeHidden();
});
