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

  const startHour = dialog.locator('[data-ops-work-start]');
  await startHour.fill('06:00');
  await startHour.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(startHour).toHaveValue('06:00');

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
  await expect(dialog.locator('[data-ops-simple-break-net-hours]')).toHaveText('8.00 h');
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

test('scalar HH:MM-bediening leidt netto uren af, stapt per kwartier en blokkeert ongeldige tijden', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showCalendarDialog: true, enableHourPlanning: true });
  });

  const dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();
  const workStart = dialog.locator('[data-ops-work-start]');
  const workEnd = dialog.locator('[data-ops-work-end]');
  const pauseStart = dialog.locator('[data-ops-simple-break-start]');
  const pauseDuration = dialog.locator('[data-ops-simple-break-duration]');
  const netHours = dialog.locator('[data-ops-simple-break-net-hours]');
  await expect(workStart).toHaveValue('07:00');
  await expect(workEnd).toHaveValue('16:00');
  await expect(pauseStart).toHaveValue('12:00');
  await expect(pauseDuration).toHaveValue('60');
  await expect(workStart).toHaveAttribute('type', 'text');
  await expect(workEnd).toHaveAttribute('type', 'text');
  await expect(pauseStart).toHaveAttribute('type', 'text');
  await expect(workStart).not.toHaveAttribute('type', 'number');
  await expect(workEnd).not.toHaveAttribute('type', 'number');
  await expect(pauseStart).not.toHaveAttribute('type', 'time');
  await expect(dialog.locator('input[type="time"]')).toHaveCount(0);
  await expect(dialog.locator('[data-ops-scalar-time-step="work-start-up"]')).toHaveCount(1);
  await expect(dialog.locator('[data-ops-scalar-time-step="work-end-up"]')).toHaveCount(1);
  await expect(dialog.locator('[data-ops-scalar-time-step="break-start-up"]')).toHaveCount(1);
  await expect(netHours).toHaveText('8.00 h');
  await expect(netHours.locator('input')).toHaveCount(0);
  await expect(dialog.getByText('Net hours per day', { exact: true })).toBeVisible();
  await expect(dialog).not.toContainText('ribbon.calendarDialog.netHoursPerDay');

  await dialog.locator('[data-ops-scalar-time-step="work-start-up"]').click();
  await expect(workStart).toHaveValue('07:15');
  await expect(netHours).toHaveText('7.75 h');
  await workStart.press('ArrowDown');
  await expect(workStart).toHaveValue('07:00');
  await expect(netHours).toHaveText('8.00 h');

  await dialog.getByRole('button', { name: 'Continuous (24/7)' }).click();
  await expect(workStart).toHaveValue('00:00');
  await expect(workEnd).toHaveValue('24:00');
  await workEnd.press('ArrowUp');
  await expect(workEnd).toHaveValue('24:00');
  await expect(netHours).toHaveText('24.00 h');
  await dialog.getByRole('button', { name: 'Mon–Fri' }).click();
  await expect(workStart).toHaveValue('07:00');
  await expect(workEnd).toHaveValue('16:00');

  await workStart.fill('07:30');
  await workStart.press('Enter');
  await workEnd.fill('16:15');
  await workEnd.press('Enter');
  await pauseStart.fill('12:00');
  await pauseStart.press('Enter');
  await pauseDuration.fill('35');
  await expect(netHours).toHaveText('8.17 h');
  await pauseDuration.fill('30');
  await expect(netHours).toHaveText('8.25 h');
  await pauseDuration.fill('60');
  await expect(netHours).toHaveText('7.75 h');
  await dialog.locator('[data-ops-cal-apply]').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const c = window.__OPS__!.store.getState().calendar;
    return { workStart: c.workStartHour, workEnd: c.workEndHour, start: c.simpleBreakStartMinute, duration: c.simpleBreakDurationMinutes, hours: c.hoursPerDay };
  })).toEqual({ workStart: 7.5, workEnd: 16.25, start: 720, duration: 60, hours: 7.75 });

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showCalendarDialog: true }));
  await expect(dialog).toBeVisible();
  const original = await page.evaluate(() => {
    const c = window.__OPS__!.store.getState().calendar;
    return { workStart: c.workStartHour, workEnd: c.workEndHour, breakStart: c.simpleBreakStartMinute };
  });
  await workStart.fill('16:15');
  await workStart.press('Enter');
  await expect(dialog.locator('[data-ops-simple-break-error]')).toContainText('Start time must be before end time.');
  await expect(dialog.locator('[data-ops-cal-apply]')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => {
    const c = window.__OPS__!.store.getState().calendar;
    return { workStart: c.workStartHour, workEnd: c.workEndHour, breakStart: c.simpleBreakStartMinute };
  })).toEqual(original);
  await workStart.fill('07:30');
  await workStart.press('Enter');
  await pauseStart.fill('15:30');
  await pauseStart.press('Enter');
  await expect(dialog.locator('[data-ops-simple-break-error]')).toBeVisible();
  await expect(dialog.locator('[data-ops-cal-apply]')).toBeDisabled();
  await pauseStart.fill('15:3');
  await pauseStart.press('Enter');
  await expect(dialog.locator('[data-ops-simple-break-error]')).toBeVisible();
  await expect(dialog.locator('[data-ops-cal-apply]')).toBeDisabled();
  await dialog.locator('[data-ops-cal-cancel]').click();
});

test('netto-uren blijft in beide urenplanningstanden een afgeleide output', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showCalendarDialog: true, enableHourPlanning: false });
  });
  const dialog = page.locator('[data-ops-calendar-dialog]');
  const netHours = dialog.locator('[data-ops-simple-break-net-hours]');
  await expect(netHours).toHaveText('8.00 h');
  await expect(netHours.locator('input')).toHaveCount(0);
  await expect(dialog.getByText('Net hours per day', { exact: true })).toBeVisible();
  await expect(dialog.locator('input[type="number"][value="8"]')).toHaveCount(0);

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ enableHourPlanning: true }));
  await expect(netHours).toHaveText('8.00 h');
  await expect(netHours.locator('input')).toHaveCount(0);
  await expect(dialog.locator('input[type="number"][value="8"]')).toHaveCount(0);
  await dialog.locator('[data-ops-cal-cancel]').click();
});

test('resourcekalender blokkeert lokaal ongeldige scalar-tijden zonder het model te muteren', async ({ page, ops: _ops }) => {
  const resourceCalendarId = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const { id: _ignored, ...calendar } = structuredClone(s.calendar);
    void _ignored;
    const calendarId = s.addCalendar({ ...calendar, name: 'Browser resource calendar' });
    s.addResource({
      name: 'Browser planner', type: 'LABOR', description: '', maxUnits: 1, calendarId,
    });
    s.setUI({ activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false, resourcesView: 'project' });
    return calendarId;
  });

  const row = page.getByRole('row', { name: /Browser planner/ });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Edit…' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const workStart = dialog.locator('[data-ops-work-start]');
  await expect(workStart).toHaveValue('07:00');
  await workStart.fill('16:00');
  await workStart.press('Enter');
  await expect(dialog.locator('[data-ops-simple-break-error]')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Apply' })).toBeDisabled();
  await expect.poll(() => page.evaluate((calendarId) => {
    const calendar = window.__OPS__!.store.getState().calendars.find(c => c.id === calendarId)!;
    return calendar.workStartHour;
  }, resourceCalendarId)).toBe(7);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
});
