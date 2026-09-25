import { barPoint, expect, test } from './fixtures/ops';

// Audit weergaven, bevinding 8: in urenmodus is speling een fractie van een werkdag. Paneel, tooltip
// en Tabel toonden de ruwe float ("0.6666666666666666"), het paneel rondde de vrije speling wél af
// (TS "0.6666666666666666" naast VS "1"), en een urentaak van 5h op 40% had "Resterend 0" terwijl er 3 uur werk
// openstaat. Nu één opmaak: twee decimalen, decimaalteken van de taal, eenheid; restduur in uren.
// De brug zet alleen de fixture (project, kalender, voortgang); berekenen, selecteren, hoveren en
// het lint-tabblad Tabel gaan via echte events.
test('speling en restduur van een urentaak: leesbaar en overal gelijk', async ({ page, ops: _ops }) => {
  const ids = await page.evaluate(() => {
    const g = () => window.__OPS__!.store.getState();
    g().setUI({ enableHourPlanning: true });
    const band = [{ start: 8 * 60, end: 17 * 60 }]; // 9 werkuren per dag
    g().setCalendar({
      ...g().calendar, workDays: [1, 2, 3, 4, 5], holidays: [], hoursPerDay: 9, workStartHour: 8, workEndHour: 17,
      workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } },
    });
    g().setProject({ name: 'Speling', startDate: '2026-06-01' });
    g().setStatusDate('2026-06-01T10:00');
    const A = g().addTask({ name: 'A stelwerk', time: { durationUnit: 'hours', durationMinutes: 300 } as never });
    const B = g().addTask({ name: 'B bekisting', time: { durationUnit: 'hours', durationMinutes: 540 } as never });
    const C = g().addTask({ name: 'C storten', time: { durationUnit: 'hours', durationMinutes: 240 } as never });
    g().addSequence({ predecessorId: A, successorId: C, type: 'FINISH_START', lagDays: 0 });
    g().addSequence({ predecessorId: B, successorId: C, type: 'FINISH_START', lagDays: 0 });
    g().runCPM();
    g().setTaskProgress(A, 0.4);
    // De tijdlijn toont twee weken vóór de viewstart; 120 px/dag houdt de 5-uursbalk grijpbaar.
    g().setZoom(120);
    g().setViewStartDate('2026-06-14');
    return { A };
  });

  // B start pas op de statusdatum (10:00) en eindigt de volgende dag om 10:00; A (nog 3 uur werk,
  // klaar om 13:00) heeft dus 6 werkuren = 6/9 werkdag speling.
  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const a = s.tasks.find(t => t.id === id)!;
    return { stale: s.scheduleStale, ef: a.time.earlyFinish, tf: Math.round(a.time.totalFloat * 9) };
  }, ids.A)).toEqual({ stale: false, ef: '2026-06-01T13:00', tf: 6 });

  // Selecteer A met een echte klik in het taakraster naast de Gantt: het eigenschappenpaneel.
  await page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${ids.A}"] `
    + '[data-grid-data-cell="true"][data-grid-column-id="task.name"]',
  ).click();
  const valueAfter = (label: RegExp) => page.locator('span', { hasText: label }).locator('xpath=following-sibling::span[1]');
  await expect(valueAfter(/^(Total float:|Totale speling:)$/)).toHaveText(/^0[.,]67 (days|dagen)$/);
  await expect(valueAfter(/^(Free float:|Vrije speling:)$/)).toHaveText(/^0[.,]67 (days|dagen)$/);
  // Het veld "Resterend" (vóór deze fix heette het nog "Resterend (werkdagen)" en stond er 0).
  const remaining = page.locator('label', { hasText: /^(remaining|resterend)( \(.*\))?$/i })
    .locator('xpath=following-sibling::input[1]');
  await expect(remaining).toHaveValue('3h');

  // Gantt-tooltip: echte hover op de balk.
  const body = await barPoint(page, ids.A, 'body');
  await page.mouse.move(body.x, body.y);
  const tooltip = page.locator('.gantt-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator('.tooltip-row').filter({ hasText: /^(Total float|Totale speling):?/ }).locator('.tooltip-value'))
    .toHaveText(/^0[.,]67d$/);

  // Tabel: standaardkolom Totale speling.
  await page.mouse.move(5, 5);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${ids.A}"] `
    + '[data-grid-data-cell="true"][data-grid-column-id="task.time.totalFloat"]',
  )).toHaveText(/^0[.,]67d$/);
});
