import { barPoint, expect, test } from './fixtures/ops';

// Audit weergaven, bevinding 7: "Duur" had drie formatters. Met Duurweergave "Altijd uren" toonde
// de Gantt-tooltip een dagtaak als "18h(2d)", maar het taakraster bleef "2d" zeggen. Nu lezen
// raster, tooltip en afdruk dezelfde formatter. De brug zet alleen de fixture (project, kalender en
// de instelling); berekenen, hoveren en het lint-tabblad Tabel gaan via echte events.
test('Duurweergave "Altijd uren": taakraster en Gantt-tooltip tonen dezelfde duur', async ({ page, ops: _ops }) => {
  const ids = await page.evaluate(() => {
    const g = () => window.__OPS__!.store.getState();
    g().setUI({ enableHourPlanning: true, durationDisplay: 'hours' });
    const band = [{ start: 8 * 60, end: 17 * 60 }]; // 9 werkuren per dag
    g().setCalendar({
      ...g().calendar, workDays: [1, 2, 3, 4, 5], holidays: [], hoursPerDay: 9, workStartHour: 8, workEndHour: 17,
      workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } },
    });
    g().setProject({ name: 'Duurweergave', startDate: '2026-06-01' });
    const D = g().addTask({ name: 'D dagtaak' });
    const t = g().tasks.find(x => x.id === D)!;
    g().updateTask(D, { time: { ...t.time, scheduleDuration: 2, scheduleStart: '2026-06-01' } });
    // De tijdlijn toont twee weken vóór de viewstart; zo staat de balk (01-06) ruim in beeld.
    g().setZoom(40);
    g().setViewStartDate('2026-06-12');
    return { D };
  });

  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);

  // Gantt-tooltip: echte hover op de balk.
  const body = await barPoint(page, ids.D, 'body');
  await page.mouse.move(body.x, body.y);
  const tooltip = page.locator('.gantt-tooltip');
  await expect(tooltip).toBeVisible();
  const durationRow = tooltip.locator('.tooltip-row').filter({ hasText: /^(Duration|Duur):/ });
  await expect(durationRow.locator('.tooltip-value')).toHaveText('18h(2d)');

  // Taakraster: het lint-tabblad Tabel, standaardkolom Duur.
  await page.mouse.move(5, 5);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const cell = page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${ids.D}"] `
    + '[data-grid-data-cell="true"][data-grid-column-id="task.time.scheduleDuration"]',
  );
  await expect(cell).toHaveText('18h(2d)');
});
