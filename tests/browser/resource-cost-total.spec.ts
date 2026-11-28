import { expect, test } from './fixtures/ops';

test('resourcepaneel: Totaal = uren van de contourdialoog × tarief, ook op een taakkalender met andere uren/dag', async ({ page, ops: _ops }) => {
  const { resourceId, costId, taskId } = await page.evaluate(() => {
    const g = () => window.__OPS__!.store.getState();
    g().setProject({ startDate: '2026-06-01' });
    g().setViewStartDate('2026-06-01');
    const longCal = g().addCalendar({
      name: 'Lange dagen', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 6, workEndHour: 16, hoursPerDay: 10, holidays: [],
    });
    const taskId = g().addTask({ name: 'Bekisting', manuallyScheduled: false });
    const t = g().tasks.find(x => x.id === taskId)!;
    g().updateTask(taskId, { time: { ...t.time, scheduleDuration: 5, scheduleStart: '2026-06-01', earlyStart: '2026-06-01' } });
    g().setTaskCalendar(taskId, longCal);
    const resourceId = g().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 2, costPerHour: 50 });
    const costId = g().addResource({ name: 'Leges', type: 'COST', description: '', maxUnits: 1 });
    g().assignResource(taskId, resourceId, 1);
    g().runCPM();
    g().setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    g().selectTask(taskId);
    return { resourceId, costId, taskId };
  });

  const row = page.locator('[data-ops-assignment-row]').first();
  await row.locator('[data-ops-assignment-expand]').click();
  await row.locator('[data-ops-assignment-contour]').click();
  const dialog = page.locator('[data-ops-contour-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-ops-contour-total]')).toHaveText('50');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  const add = page.locator('[data-ops-assignment-add] button').first();
  await add.click();
  await page.getByRole('listbox').locator(`[data-value="${costId}"]`).click();
  const costOf = () => page.evaluate(([t, r]) => window.__OPS__!.store.getState().assignments
    .find(a => a.taskId === t && a.resourceId === r) ?? null, [taskId, costId] as const);
  await expect.poll(async () => (await costOf())?.unitsPerDay).toBe(1);
  const costRow = page.locator(`[data-ops-assignment-row="${(await costOf())!.id}"]`);
  const amount = costRow.locator('input.assignment-units');
  await amount.click();
  await amount.fill('1250,5');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await costOf())?.costAmount).toBe(1250.5);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  await costRow.locator('[data-ops-assignment-expand]').click();
  await expect(costRow.locator('[data-ops-assignment-curve]')).toHaveCount(0);
  await expect(costRow.locator('[data-ops-assignment-contour]')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await costOf())?.costAmount ?? null).toBeNull();
  await page.keyboard.press('Control+y');
  await expect.poll(async () => (await costOf())?.costAmount).toBe(1250.5);

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({
    activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false, resourcesView: 'project',
  }));
  const total = page.locator(`[data-ops-resource-total="${resourceId}"]`);
  await expect(total).toBeVisible();
  await expect.poll(async () => (await total.textContent())?.replace(/\D/g, '')).toBe('250000');
  const costTotal = page.locator(`[data-ops-resource-total="${costId}"]`);
  await expect.poll(async () => (await costTotal.textContent())?.replace(/\D/g, '')).toBe('125050');
  await expect(costTotal).toHaveAttribute('title', /^(Som van de bedragen op alle toewijzingen|Sum of the amounts on all assignments)$/);
  await expect(total).toHaveAttribute('title', /^(Belaste eenheden × uren\/dag × tarief|Loaded units × hours\/day × rate) \((herbereken met F5|recalculate with F5)\)$/);
  const grand = page.locator('[data-ops-resource-grand-total]');
  await expect.poll(async () => (await grand.textContent())?.replace(/\D/g, '')).toBe('375050');
  const head = await page.locator('[data-ops-resource-total-head]').boundingBox();
  const rowBox = await total.boundingBox();
  const sum = await grand.boundingBox();
  expect(head && rowBox && sum).toBeTruthy();
  for (const box of [rowBox!, sum!]) {
    expect(Math.abs(box.x - head!.x)).toBeLessThan(2);
    expect(Math.abs(box.x + box.width - (head!.x + head!.width))).toBeLessThan(2);
  }
});
