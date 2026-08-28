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
