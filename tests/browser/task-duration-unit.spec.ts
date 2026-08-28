import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

async function seedDurationTask(page: Page, unit: 'days' | 'hours' = 'days', amount = 2): Promise<string> {
  return page.evaluate(({ nativeUnit, nativeAmount }) => {
    const state = window.__OPS__!.store.getState();
    state.setUI({
      enableHourPlanning: true,
      showPropertiesPanel: true,
      rightPanelCollapsed: false,
    });
    state.setCalendar({
      ...state.calendar,
      workDays: [1, 2, 3, 4, 5],
      hoursPerDay: 8,
      workStartHour: 8,
      workEndHour: 16,
      workTime: {
        byWeekday: {
          1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }],
          3: [{ start: 480, end: 960 }], 4: [{ start: 480, end: 960 }],
          5: [{ start: 480, end: 960 }], 6: [], 7: [],
        },
      },
    });
    const id = state.addTask({ name: 'Duurtaak' });
    const current = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
    state.updateTask(id, {
      time: {
        ...current.time,
        durationUnit: nativeUnit,
        scheduleDuration: nativeUnit === 'days' ? nativeAmount : nativeAmount / 8,
        durationMinutes: nativeUnit === 'hours' ? nativeAmount * 60 : undefined,
        scheduleStart: '2026-09-07',
        earlyStart: '2026-09-07T08:00',
      },
    });
    state.selectTask(id);
    return id;
  }, { nativeUnit: unit, nativeAmount: amount });
}

async function openDialog(page: Page, taskId: string): Promise<void> {
  await page.evaluate((id) => {
    window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id });
  }, taskId);
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('dialoog en eigenschappenpaneel gebruiken exact dezelfde duurbediening en suffixregels', async ({ page, ops: _ops }) => {
  const taskId = await seedDurationTask(page);
  const panelDuration = page.locator('[data-ops-task-duration]').first();
  await expect(panelDuration).toBeVisible();
  await panelDuration.locator('[data-ops-duration-value]').fill('12u');
  await panelDuration.locator('[data-ops-duration-value]').blur();

  await expect.poll(() => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, minutes: task.time.durationMinutes };
  }, taskId)).toEqual({ unit: 'hours', minutes: 720 });
  await expect(panelDuration.locator('[data-ops-duration-value]')).toHaveValue('12h');

  await openDialog(page, taskId);
  const dialogDuration = page.getByRole('dialog').locator('[data-ops-task-duration]');
  await expect(dialogDuration.locator('[data-ops-duration-value]')).toHaveValue('12h');
  await expect(dialogDuration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ })).toHaveText(/^(Hours|Uren)$/);
  await dialogDuration.locator('[data-ops-duration-value]').fill('2d');
  await dialogDuration.locator('[data-ops-duration-value]').blur();
  await expect(dialogDuration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ })).toHaveText(/^(Days|Dagen)$/);
  await page.getByRole('dialog').locator('[data-ops-task-save]').click();

  await expect.poll(() => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, days: task.time.scheduleDuration, minutes: task.time.durationMinutes };
  }, taskId)).toEqual({ unit: 'days', days: 2, minutes: undefined });
});

test('duurwaarde blijft de brede primaire invoer met controls op normale, gelijke hoogte', async ({ page, ops: _ops }) => {
  const taskId = await seedDurationTask(page);
  const panelDuration = page.locator('[data-ops-task-duration]').first();

  const panelGeometry = await panelDuration.evaluate((field) => {
    const input = field.querySelector<HTMLElement>('[data-ops-duration-value]')!;
    const unit = field.querySelector<HTMLElement>('[aria-label="Duration unit"]')!;
    const info = field.querySelector<HTMLElement>('[data-ops-duration-info]')!;
    const rect = (element: HTMLElement) => element.getBoundingClientRect();
    return {
      input: { width: rect(input).width, height: rect(input).height },
      unit: { width: rect(unit).width, height: rect(unit).height },
      info: { width: rect(info).width, height: rect(info).height },
    };
  });

  expect(panelGeometry.input.width).toBeGreaterThan(panelGeometry.unit.width);
  expect(panelGeometry.input.height).toBeGreaterThanOrEqual(32);
  expect(Math.abs(panelGeometry.input.height - panelGeometry.unit.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(panelGeometry.info.height - panelGeometry.unit.height)).toBeLessThanOrEqual(2);

  await openDialog(page, taskId);
  const dialogDuration = page.getByRole('dialog').locator('[data-ops-task-duration]');
  const dialogGeometry = await dialogDuration.evaluate((field) => {
    const input = field.querySelector<HTMLElement>('[data-ops-duration-value]')!;
    const unit = field.querySelector<HTMLElement>('[aria-label="Duration unit"]')!;
    const info = field.querySelector<HTMLElement>('[data-ops-duration-info]')!;
    const rect = (element: HTMLElement) => element.getBoundingClientRect();
    return {
      input: { width: rect(input).width, height: rect(input).height },
      unit: { width: rect(unit).width, height: rect(unit).height },
      info: { width: rect(info).width, height: rect(info).height },
    };
  });

  expect(dialogGeometry.input.width).toBeGreaterThan(dialogGeometry.unit.width);
  expect(dialogGeometry.input.height).toBeGreaterThanOrEqual(32);
  expect(Math.abs(dialogGeometry.input.height - dialogGeometry.unit.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(dialogGeometry.info.height - dialogGeometry.unit.height)).toBeLessThanOrEqual(2);
});

test('duurinfo is met hover en toetsenbordfocus bereikbaar en legt het vaste contract uit', async ({ page, ops: _ops }) => {
  await seedDurationTask(page);
  const info = page.locator('[data-ops-duration-info]').first();
  await info.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(/(unit belongs to this task|eenheid hoort bij deze taak)/i);
  await expect(tooltip).toContainText(/(different calendar|andere kalender)/i);

  await page.mouse.move(1, 1);
  await expect(tooltip).toBeHidden();
  await info.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(/(days count working days|dagen tellen werkdagen)/i);
  await expect(tooltip).toContainText(/(hours count working hours|uren tellen werkuren)/i);
});

test('uren zonder concrete werkblokken en niet-exacte omzetting muteren de taak niet', async ({ page, ops: _ops }) => {
  const dayTaskId = await seedDurationTask(page, 'days', 2);
  await page.evaluate(() => {
    const state = window.__OPS__!.store.getState();
    state.setCalendar({ ...state.calendar, workTime: undefined });
  });
  const duration = page.locator('[data-ops-task-duration]').first();
  await duration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ }).click();
  await page.getByRole('option', { name: /^(Hours|Uren)$/ }).click();
  await expect(duration.locator('[data-ops-duration-message]')).toContainText(/(concrete working times|concrete werktijden)/i);
  await expect.poll(() => page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(task => task.id === id)!.time.durationUnit, dayTaskId)).toBe('days');

  const hourTaskId = await seedDurationTask(page, 'hours', 12);
  const hourDuration = page.locator('[data-ops-task-duration]').first();
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ enableHourPlanning: false }));
  await expect(hourDuration.locator('[data-ops-duration-value]')).toBeDisabled();
  await expect(hourDuration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ })).toBeDisabled();
  await expect(hourDuration.locator('[data-ops-duration-hour-planning-blocked]'))
    .toContainText(/(enable hour planning|schakel urenplanning)/i);
  await hourDuration.locator('[data-ops-duration-hour-planning-blocked]').getByRole('button').click();
  await expect(hourDuration.locator('[data-ops-duration-value]')).toBeEnabled();
  await hourDuration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ }).click();
  await page.getByRole('option', { name: /^(Days|Dagen)$/ }).click();
  await expect(hourDuration.locator('[data-ops-duration-message]')).toContainText(/(cannot be converted exactly|niet exact)/i);
  await expect.poll(() => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, minutes: task.time.durationMinutes };
  }, hourTaskId)).toEqual({ unit: 'hours', minutes: 720 });
});

test('een conversievoorstel lekt niet naar een andere geselecteerde taak', async ({ page, ops: _ops }) => {
  await seedDurationTask(page, 'hours', 16);
  const duration = page.locator('[data-ops-task-duration]').first();
  await duration.getByRole('button', { name: /^(Duration unit|Duureenheid)$/ }).click();
  await page.getByRole('option', { name: /^(Days|Dagen)$/ }).click();
  await expect(duration.locator('[data-ops-duration-message]')).toContainText(/(2d)/i);
  await expect(duration.getByRole('button', { name: /^(Apply proposal|Voorstel toepassen)$/ })).toBeVisible();

  const nextTaskId = await seedDurationTask(page, 'hours', 24);
  await expect(duration.locator('[data-ops-duration-value]')).toHaveValue('24h');
  await expect(duration.locator('[data-ops-duration-message]')).toBeHidden();
  await expect.poll(() => page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { unit: task.time.durationUnit, minutes: task.time.durationMinutes };
  }, nextTaskId)).toEqual({ unit: 'hours', minutes: 1440 });
});
