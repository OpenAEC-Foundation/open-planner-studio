import { barPoint, expect, test } from './fixtures/ops';

// Deze route bedient tijdlijnbalken naast de takenlijst en de eigenschappenrail.
// Reserveer expliciet genoeg canvasruimte, onafhankelijk van de standaard paneelbreedte.
test.use({ viewport: { width: 1600, height: 900 } });

// Audit weergaven, bevinding 7: "Duur" had drie formatters. Met Duurweergave "Altijd uren" toonde
// de Gantt-tooltip een dagtaak als "18h(2d)", maar het taakraster bleef "2d" zeggen. Nu lezen
// raster, tooltip en afdruk dezelfde formatter. De brug zet alleen de fixture (project, kalender,
// profiel en de instelling); berekenen, hoveren en het lint-tabblad Tabel gaan via echte events.
// B9 (spec "alleen uren" §3.12): in het OPS-profiel heeft Duurweergave geen effect, elke taak toont
// haar eigen maat ("2d"); onder P6 en MSP werkt "Altijd uren" zoals vroeger ("18h(2d)").
test('Duurweergave "Altijd uren": taakraster en Gantt-tooltip tonen dezelfde duur', async ({ page, ops: _ops }) => {
  const ids = await page.evaluate(() => {
    const g = () => window.__OPS__!.store.getState();
    g().setUI({ durationDisplay: 'hours' });
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

  // OPS-profiel (B9): de eigen maat, in tooltip en raster gelijk.
  await recalc();
  await expect(await tooltipDuration()).toHaveText('2d');

  // P6-profiel: "Altijd uren" toont 2 × 9 u, met de eigen maat tussen haakjes.
  await page.mouse.move(5, 5);
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({
    schedulingProfile: { baseId: 'p6', id: 'p6', name: '', overrides: {} },
  }));
  await recalc();
  await expect(await tooltipDuration()).toHaveText('18h(2d)');

  // Taakraster: het lint-tabblad Tabel, standaardkolom Duur.
  await page.mouse.move(5, 5);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(gridDuration()).toHaveText('18h(2d)');
  // Terug naar het OPS-profiel: ook het raster toont dan de eigen maat.
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({
    schedulingProfile: { baseId: 'ops', id: 'ops', name: '', overrides: {} },
  }));
  await expect(gridDuration()).toHaveText('2d');
});
