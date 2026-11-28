import { barPoint, expect, test } from './fixtures/ops';

test('speling en restduur van een urentaak: leesbaar en overal gelijk', async ({ page, ops: _ops }) => {
  const ids = await page.evaluate(() => {
    const g = () => window.__OPS__!.store.getState();
    const band = [{ start: 8 * 60, end: 17 * 60 }];
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
    g().setZoom(120);
    g().setViewStartDate('2026-06-14');
    return { A };
  });

  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const a = s.tasks.find(t => t.id === id)!;
    return { stale: s.scheduleStale, ef: a.time.earlyFinish, tf: Math.round(a.time.totalFloat * 9) };
  }, ids.A)).toEqual({ stale: false, ef: '2026-06-01T13:00', tf: 6 });

  await page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${ids.A}"] `
    + '[data-grid-data-cell="true"][data-grid-column-id="task.name"]',
  ).click();
  const valueAfter = (label: RegExp) => page.locator('span', { hasText: label }).locator('xpath=following-sibling::span[1]');
  await expect(valueAfter(/^(Total float:|Totale speling:)$/)).toHaveText(/^0[.,]67 (days|dagen)$/);
  await expect(valueAfter(/^(Free float:|Vrije speling:)$/)).toHaveText(/^0[.,]67 (days|dagen)$/);
  const remaining = page.locator('label', { hasText: /^(remaining|resterend)( \(.*\))?$/i })
    .locator('xpath=following-sibling::input[1]');
  await expect(remaining).toHaveValue('3h');

  await page.evaluate(id => window.__OPS__!.store.setState(s => {
    const t = s.tasks.find(t => t.id === id)!;
    t.status = 'STARTED';
    t.time.completion = 1;
    t.time.remainingMinutes = 1920;
    t.time.actualFinish = undefined;
  }), ids.A);
  await expect(remaining).toHaveValue('32h');
  await page.evaluate(id => window.__OPS__!.store.setState(s => {
    const t = s.tasks.find(t => t.id === id)!;
    t.time.completion = 0.4;
    t.time.remainingMinutes = 180;
  }), ids.A);
  await expect(remaining).toHaveValue('3h');

  for (const locale of ['en', 'nl']) {
    await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
    const settings = page.locator('.settings-dialog');
    await settings.locator('.settings-tab').nth(0).click();
    await settings.getByRole('button', { name: /^(Language|Taal)$/ }).click();
    await page.getByRole('option', { name: locale === 'en' ? /English/ : /Nederlands/ }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(locale);
    await page.keyboard.press('Escape');
    await expect(settings).not.toBeVisible();
    for (const [value, shown] of [[1, '1'], [-1, '-1'], [0, '0'], [2, '2'], [0.67, '0.67'], [0.999, '1'], [1.004, '1']] as const) {
      await page.evaluate(({ id, value }) => window.__OPS__!.store.setState(s => {
        const time = s.tasks.find(t => t.id === id)!.time;
        time.totalFloat = value;
        time.freeFloat = value;
        time.interferingFloat = value;
      }), { id: ids.A, value });
      const singular = Math.abs(Number(shown)) === 1;
      const unit = locale === 'nl' ? (singular ? 'dag' : 'dagen') : (singular ? 'day' : 'days');
      const expected = (locale === 'nl' ? shown.replace('.', ',') : shown) + ' ' + unit;
      await expect(valueAfter(/^(Total float:|Totale speling:)$/)).toHaveText(expected);
      await expect(valueAfter(/^(Free float:|Vrije speling:)$/)).toHaveText(expected);
      await expect(valueAfter(/^(Interfering float:|Interfererende speling:)$/)).toHaveText(expected);
    }
  }
  await page.keyboard.press('F5');
  await expect(valueAfter(/^(Total float:|Totale speling:)$/)).toHaveText(/^0[.,]67 (days|dagen)$/);

  const body = await barPoint(page, ids.A, 'body');
  await page.mouse.move(body.x, body.y);
  const tooltip = page.locator('.gantt-tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator('.tooltip-row').filter({ hasText: /^(Total float|Totale speling):?/ }).locator('.tooltip-value'))
    .toHaveText(/^0[.,]67d$/);

  await page.evaluate(id => window.__OPS__!.store.setState(s => {
    s.tasks.find(t => t.id === id)!.time.totalFloat = 2;
  }), ids.A);
  await expect(tooltip.locator('.tooltip-row').filter({ hasText: /^(Total float|Totale speling):?/ }).locator('.tooltip-value'))
    .toHaveText('2d');
  await page.keyboard.press('F5');
  await expect(tooltip.locator('.tooltip-row').filter({ hasText: /^(Total float|Totale speling):?/ }).locator('.tooltip-value'))
    .toHaveText(/^0[.,]67d$/);

  await page.mouse.move(5, 5);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${ids.A}"] `
    + '[data-grid-data-cell="true"][data-grid-column-id="task.time.totalFloat"]',
  )).toHaveText(/^0[.,]67d$/);
});
