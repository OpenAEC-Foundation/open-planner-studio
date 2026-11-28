import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

async function openAkkers(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.locator('.ribbon-tab--file').first().click();
  await page.locator('button.backstage-nav-item[data-tour-anchor="backstage-examples"]').click();
  const card = page.locator('button.backstage-export-card')
    .filter({ has: page.locator('h4', { hasText: /De Akkers/ }) }).first();
  await card.click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBeGreaterThan(20);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showPropertiesPanel: true, rightPanelCollapsed: false }));
}

async function selectTask(page: Page, find: string): Promise<string> {
  const id = await page.evaluate((name) => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks.find(t => t.name === name);
    if (!task) throw new Error(`taak ${name} niet gevonden`);
    s.selectTask(task.id);
    return task.id;
  }, find);
  return id;
}

const taskTime = (page: Page, id: string) => page.evaluate((taskId) => {
  const task = window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!;
  return { duration: task.time.scheduleDuration, completion: task.time.completion, milestone: !!task.isMilestone };
}, id);

test('geweigerde duur: rode melding blijft na 6 s, sluit via het kruisje, en het veld toont de echte duur', async ({ page, ops: _ops }) => {
  await openAkkers(page);
  const id = await selectTask(page, 'Upper floor slab — House 4');
  const before = await taskTime(page, id);
  expect(before.duration).toBe(4);
  expect(before.completion).toBeCloseTo(0.5, 5);

  const field = page.locator('[data-ops-rail] [data-ops-duration-value]');
  await expect(field).toHaveValue('4');
  await field.click();
  await field.fill('');
  await page.keyboard.type('1');
  await page.keyboard.press('Enter');

  const refusal = page.locator('.ops-toast', { hasText: /Upper floor slab — House 4/ });
  await expect(refusal).toHaveCount(1);
  await expect(refusal).toHaveClass(/toast-error/);
  await expect(refusal).toHaveAttribute('role', 'alert');
  await expect(refusal).toContainText("'Upper floor slab — House 4'");
  await expect(field).toHaveValue('4');
  expect((await taskTime(page, id)).duration).toBe(4);

  await page.clock.install();
  await page.evaluate(() => window.__OPS__!.store.getState().notify({ severity: 'info', messageKey: 'notifications.templateSaved', params: { name: 'klokcontrole' } }));
  const control = page.locator('.ops-toast.toast-info', { hasText: /klokcontrole/ });
  await expect(control).toBeVisible();
  await page.clock.runFor(6_000);
  await expect(control).toHaveCount(0);
  await expect(refusal).toBeVisible();

  await refusal.locator('[data-ops-toast-close]').click();
  await expect(refusal).toHaveCount(0);
  await expect(field).toHaveValue('4');
});

test('geweigerde mijlpaal (taak met toewijzing): rode melding met role=alert', async ({ page, ops: _ops }) => {
  await openAkkers(page);
  const name = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const assigned = new Set(s.assignments.map(a => a.taskId));
    const task = s.tasks.find(t => assigned.has(t.id) && t.childIds.length === 0 && !t.isMilestone)!;
    return task.name;
  });
  const id = await selectTask(page, name);
  const checkbox = page.locator('[data-ops-rail] label', { hasText: /^Milestone$/ }).first().locator('input[type=checkbox]');
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();

  const refusal = page.locator('.ops-toast', { hasText: /cannot become a milestone/ });
  await expect(refusal).toHaveCount(1);
  await expect(refusal).toHaveClass(/toast-error/);
  await expect(refusal).toHaveAttribute('role', 'alert');
  await expect(checkbox).not.toBeChecked();
  expect((await taskTime(page, id)).milestone).toBe(false);
});

test('geweigerde werkelijke start (na de statusdatum): het veld valt terug op de opgeslagen waarde', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const id = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setCalendar({ ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [] });
    s.setProject({ name: 'Werkelijke datums', startDate: '2026-06-01', statusDate: '2026-06-10' });
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    const taskId = s.addTask({ name: 'Fundering', time: { scheduleDuration: 5 } as never });
    window.__OPS__!.store.getState().runCPM();
    window.__OPS__!.store.getState().selectTask(taskId);
    return taskId;
  });
  const field = page.locator('[data-ops-rail]').getByRole('group', { name: /^Actual start$/ });
  const day = field.locator('input').first();
  await expect(day).toHaveValue('');
  await day.click();
  await page.keyboard.type('20062026');
  await page.keyboard.press('Enter');

  await expect(page.locator('[data-ops-rail]').getByText('Actuals cannot be after the status date')).toBeVisible();
  for (const input of await field.locator('input').all()) await expect(input).toHaveValue('');
  expect(await page.evaluate((taskId) => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!.time.actualStart ?? null, id))
    .toBeNull();
});

test('inspringen bij een gesorteerde lijst: rode strook met role=alert, blijft staan, sluit via het kruisje', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const second = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ name: 'Structuur vast', startDate: '2026-09-07' });
    s.addTask({ name: 'Eerste' });
    const id = window.__OPS__!.store.getState().addTask({ name: 'Tweede' });
    window.__OPS__!.store.getState().runCPM();
    window.__OPS__!.store.getState().setSort([{ field: { src: 'builtin', key: 'name' }, dir: 'asc' }]);
    return id;
  });
  await page.locator(`[data-grid-data-row="true"][data-grid-row-key="${second}"] [data-grid-column-id="task.name"]`).first().click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([second]);
  await page.clock.install();
  await page.keyboard.press('Alt+Shift+ArrowRight');

  const strip = page.locator('[data-ops-structure-locked]');
  await expect(strip).toBeVisible();
  await expect(strip).toHaveAttribute('role', 'alert');
  await expect(strip).toHaveAttribute('data-ops-notice-tone', 'error');
  await page.clock.runFor(7_000);
  await expect(strip).toBeVisible();
  await strip.getByTitle('Close', { exact: true }).click();
  await expect(strip).toHaveCount(0);
});

test('plakken over een alleen-lezen cel en de relatiekolom: de taak staat bij "Niet toegepast bij"', async ({ page, context, ops: _ops }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const [b, c] = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ name: 'Plakken', startDate: '2026-06-01' });
    const a = s.addTask({ name: 'Fundering', time: { scheduleDuration: 5 } as never });
    const b = window.__OPS__!.store.getState().addTask({ name: 'Metselwerk', time: { scheduleDuration: 4 } as never });
    const c = window.__OPS__!.store.getState().addTask({ name: 'Afwerking', time: { scheduleDuration: 3 } as never });
    window.__OPS__!.store.getState().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    window.__OPS__!.store.getState().runCPM();
    const st = window.__OPS__!.store.getState();
    st.setUI({ activeRibbonTab: 'table' });
    const columns = st.taskGridSurfaces['full-task-grid'].columns
      .filter(col => ['task.wbsCode', 'task.name', 'task.time.totalFloat'].includes(col.id));
    st.commitTaskGridColumns('full-task-grid', 'Relatiekolom voor browsertest', [
      ...columns, { id: 'relation.predecessors' as (typeof columns)[number]['id'], width: 240, pinned: false },
    ]);
    return [b, c];
  });
  const cell = (row: string, col: string) =>
    page.locator(`[data-task-grid-surface-id="full-task-grid"] [data-grid-row-key="${row}"][data-grid-column-id="${col}"]`);
  await cell(b, 'relation.predecessors').click();
  await page.keyboard.press('Control+C');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe('1 FS');
  await page.evaluate((text) => navigator.clipboard.writeText(text), `9\t${copied}`);
  await cell(c, 'task.time.totalFloat').click();
  await page.keyboard.press('Control+V');

  const refusal = page.locator('.ops-toast', { hasText: /Skipped 1 cell/ });
  await expect(refusal).toHaveCount(1);
  await expect(refusal).toHaveClass(/toast-error/);
  await expect(refusal).toHaveAttribute('role', 'alert');
  await expect(refusal).toContainText('Not applied for: Afwerking.');
  await expect(refusal).not.toContainText('Not changed');
  expect(await page.evaluate((id) => window.__OPS__!.store.getState().sequences.filter(s => s.successorId === id).length, c)).toBe(1);
});
