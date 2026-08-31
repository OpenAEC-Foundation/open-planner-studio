import { expect, test } from './fixtures/ops';

test('kalenderdialoog bewaart gewone enkelregelige velden bij Enter zonder te sluiten', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showCalendarDialog: true, enableHourPlanning: true, weekStartDay: 'sunday' });
  });

  const dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();
  const name = dialog.locator('input').first();
  await name.fill('Bouwkalender 2026');
  await name.press('Enter');

  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().calendar.name)).toBe('Bouwkalender 2026');

  const startHour = dialog.locator('input[type="number"]').first();
  await startHour.fill('6');
  await startHour.press('Enter');
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().calendar.workStartHour)).toBe(6);

  const continuous = dialog.getByRole('button', { name: 'Continuous (24/7)' });
  await continuous.focus();
  await continuous.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Sat' })).toHaveClass(/bg-accent/);

  await dialog.locator('[data-ops-cal-cancel]').click();
});

test('kalenderdialoog rangschikt beide zichtbare weekdagrijen volgens de eerste weekdag', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showCalendarDialog: true, enableHourPlanning: true, weekStartDay: 'sunday' });
  });

  const dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();
  const name = dialog.locator('input').first();
  await name.fill('Bouwkalender 2026');
  await name.press('Enter');
  await expect.poll(() => dialog.getByRole('button').evaluateAll(buttons => buttons
    .map(button => button.textContent?.trim())
    .filter((label): label is string => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(label))))
    .toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ weekStartDay: 'monday' }));
  await expect.poll(() => dialog.getByRole('button').evaluateAll(buttons => buttons
    .map(button => button.textContent?.trim())
    .filter((label): label is string => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(label))))
    .toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ weekStartDay: 'sunday' }));

  await dialog.locator('button').filter({ hasText: 'Add holiday' }).click();
  const holidayEndSegments = dialog.getByRole('group', { name: 'Until' }).last().locator('input');
  await expect(holidayEndSegments).toHaveCount(3);
  await expect.poll(() => holidayEndSegments.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).toEqual(['', '', '']);

  await dialog.locator('[data-ops-band-editor-toggle]').click();
  const firstWeekday = dialog.locator('[data-ops-worktime-editor] > div').first().locator('span').first();
  await expect(firstWeekday).toHaveText('Sun');

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ weekStartDay: 'monday' }));
  await expect(firstWeekday).toHaveText('Mon');
  await expect(dialog.locator('[data-ops-derived-hpd]')).toHaveText('8h');
  await expect(dialog.locator('[data-ops-worktime-editor]')).not.toContainText(/\d(?:\.\d+)?u\b/);

  await dialog.locator('[data-ops-cal-apply]').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const holidays = window.__OPS__!.store.getState().calendar.holidays;
    return holidays[holidays.length - 1];
  })).toMatchObject({ endDate: expect.any(String) });
  await expect.poll(() => page.evaluate(() => {
    const holidays = window.__OPS__!.store.getState().calendar.holidays;
    const holiday = holidays[holidays.length - 1]!;
    return holiday.endDate === holiday.startDate;
  })).toBe(true);

  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showTaskDialog: true, editingTaskId: null });
  });
  const taskDialog = page.locator('[data-ops-task-dialog]');
  await expect(taskDialog).toBeVisible();
  await taskDialog.getByLabel('Calendar', { exact: true }).click();
  await expect(page.getByRole('option', { name: 'Project calendar: Bouwkalender 2026' })).toBeVisible();
});

test('eenvoudig pauzepatroon leidt netto uren af, bewaart het en blokkeert een ongeldige pauze', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showCalendarDialog: true, enableHourPlanning: true });
  });

  const dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();
  const pauseStart = dialog.locator('[data-ops-simple-break-start]');
  const pauseDuration = dialog.locator('[data-ops-simple-break-duration]');
  const netHours = dialog.locator('[data-ops-simple-break-net-hours]');
  await expect(pauseStart).toHaveValue('12:00');
  await expect(pauseDuration).toHaveValue('60');
  await expect(pauseStart).not.toHaveAttribute('type', 'time');
  await expect(dialog.locator('input[type="time"]')).toHaveCount(0);
  await expect(netHours).toHaveText('8.00 h');
  await expect(netHours.locator('input')).toHaveCount(0);
  await expect(dialog.getByText('Net hours per day', { exact: true })).toBeVisible();
  await expect(dialog).not.toContainText('ribbon.calendarDialog.netHoursPerDay');

  await pauseStart.fill('12:00');
  await pauseStart.press('Enter');
  await pauseDuration.fill('35');
  await expect(netHours).toHaveText('8.42 h');
  await pauseDuration.fill('30');
  await expect(netHours).toHaveText('8.50 h');
  await pauseDuration.fill('60');
  await expect(netHours).toHaveText('8.00 h');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().calendar.hoursPerDay)).toBe(8);
  await dialog.locator('[data-ops-cal-apply]').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const c = window.__OPS__!.store.getState().calendar;
    return { start: c.simpleBreakStartMinute, duration: c.simpleBreakDurationMinutes, hours: c.hoursPerDay };
  })).toEqual({ start: 720, duration: 60, hours: 8 });

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showCalendarDialog: true }));
  await expect(dialog).toBeVisible();
  await pauseStart.fill('15:30');
  await pauseStart.press('Enter');
  await pauseDuration.fill('60');
  await expect(dialog.locator('[data-ops-simple-break-error]')).toBeVisible();
  await expect(dialog.locator('[data-ops-cal-apply]')).toBeDisabled();
  await pauseStart.fill('15:3');
  await pauseStart.press('Enter');
  await expect(dialog.locator('[data-ops-simple-break-error]')).toBeVisible();
  await expect(dialog.locator('[data-ops-cal-apply]')).toBeDisabled();
  await dialog.locator('[data-ops-cal-cancel]').click();
});
