import { barPoint, expect, test } from './fixtures/ops';

test.use({ viewport: { width: 1600, height: 900 } });

test('Duurweergave "Altijd uren": taakraster en Gantt-tooltip tonen dezelfde duur', async ({ page, ops: _ops }) => {
  const ids = await page.evaluate(() => {
    const g = () => window.__OPS__!.store.getState();
    g().setUI({ durationDisplay: 'hours' });
    const band = [{ start: 8 * 60, end: 17 * 60 }];
    g().setCalendar({
      ...g().calendar, workDays: [1, 2, 3, 4, 5], holidays: [], hoursPerDay: 9, workStartHour: 8, workEndHour: 17,
      workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } },
    });
    g().setProject({ name: 'Duurweergave', startDate: '2026-06-01' });
    const D = g().addTask({ name: 'D dagtaak' });
    const t = g().tasks.find(x => x.id === D)!;
    g().updateTask(D, { time: { ...t.time, scheduleDuration: 2, scheduleStart: '2026-06-01' } });
    g().setZoom(40);
    g().setViewStartDate('2026-06-12');
    return { D };
  });

  const tooltipDuration = async () => {
    const body = await barPoint(page, ids.D, 'body');
    await page.mouse.move(body.x, body.y);
    const tooltip = page.locator('.gantt-tooltip');
    await expect(tooltip).toBeVisible();
    return tooltip.locator('.tooltip-row').filter({ hasText: /^(Duration|Duur):/ }).locator('.tooltip-value');
  };
  const gridDuration = () => page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${ids.D}"] `
    + '[data-grid-data-cell="true"][data-grid-column-id="task.time.scheduleDuration"]',
  );
  const recalc = async () => {
    await page.keyboard.press('F5');
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  };

  await recalc();
  await expect(await tooltipDuration()).toHaveText('2d');

  await page.mouse.move(5, 5);
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({
    schedulingProfile: { baseId: 'p6', id: 'p6', name: '', overrides: {} },
  }));
  await recalc();
  await expect(await tooltipDuration()).toHaveText('18h(2d)');

  await page.mouse.move(5, 5);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(gridDuration()).toHaveText('18h(2d)');
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({
    schedulingProfile: { baseId: 'ops', id: 'ops', name: '', overrides: {} },
  }));
  await expect(gridDuration()).toHaveText('2d');
});
