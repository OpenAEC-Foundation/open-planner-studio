import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

type Clock = readonly [string, string];
type Days = Partial<Record<number, Clock>>;
const calendarData = (days: Days) => {
  const day = (n: number) => {
    const band = days[n];
    return band ? `(0||${n}()((0||0(s|${band[0]}|f|${band[1]})())))` : `(0||${n}()())`;
  };
  return `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(day).join('')}))(0||Exceptions()())))`;
};
function xer(name: string, days: Days, dayHrCnt: number, extra?: { name: string; days: Days }): string {
  return [
    'ERMHDR\t8.4\t2026-07-18\t\t\t\t\t\tEUR',
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\t${name}\tCA_Base\t${dayHrCnt}\t${dayHrCnt * 5}\t${calendarData(days)}`,
    ...(extra ? [`%R\tC2\t${extra.name}\tCA_Base\t8\t40\t${calendarData(extra.days)}`] : []),
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP1\tUrenPerDag\tC1\t2026-06-01\t2026-06-01',
    '%T\tPROJWBS', '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\twbs_short_name\twbs_name',
    '%R\t1\tP1\t0\t1\tUPD\tUren per dag',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA1\tP1\t1\tC1\tA-1\tUrentaak\tTT_Task\tTK_NotStart\t40\t40\t2026-06-01 08:00\t2026-06-05 18:00',
    '%E',
  ].join('\n');
}
const ON_MA_VR = (band: Clock) => ({ 2: band, 3: band, 4: band, 5: band, 6: band });
const LATE_PLOEG = xer('Late ploeg', ON_MA_VR(['14:00', '00:00']), 8);
const LATE = [{ start: 840, end: 1440 }];

async function openXer(page: Page, text: string): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'uren-per-dag.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(text) });
}

async function calendarState(page: Page) {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks.find((t) => t.id === 'A1');
    return {
      name: s.calendar.name,
      workDays: s.calendar.workDays,
      hoursPerDay: s.calendar.hoursPerDay,
      sat: s.calendar.workTime?.byWeekday[6] ?? null,
      taskMinutes: task?.time.durationMinutes ?? null,
      taskDays: task?.time.scheduleDuration ?? null,
    };
  });
}

async function openCalendarDialog(page: Page): Promise<Locator> {
  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  await page.locator('[data-ops-ribbon-item="calendar"]').first().click();
  const dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();
  return dialog;
}
const dayButton = (dialog: Locator, label: string) => dialog.getByRole('button', { name: label, exact: true });
async function clickDays(dialog: Locator, labels: readonly string[]): Promise<void> {
  for (const label of labels) await dayButton(dialog, label).click();
}
const netHours = (dialog: Locator) => dialog.locator('[data-ops-simple-break-net-hours]');

test('kalendervenster: Za aan bij Late ploeg (14–24, 8 u/dag) houdt de uren per dag op 8', async ({ page, ops: _ops }) => {
  await openXer(page, LATE_PLOEG);
  await expect.poll(() => calendarState(page)).toEqual({
    name: 'Late ploeg', workDays: [1, 2, 3, 4, 5], hoursPerDay: 8, sat: [], taskMinutes: 2400, taskDays: 4,
  });

  const dialog = await openCalendarDialog(page);
  await expect(netHours(dialog)).toHaveText('10h');
  const sat = dayButton(dialog, 'Sat');
  await expect(sat).toHaveCount(1);
  await sat.click();
  await expect(sat).toHaveClass(/bg-accent/);
  await expect(dialog.locator('[data-ops-worktime-day="6"]')).toContainText('10h');
  await expect(netHours(dialog)).toHaveText('10h');

  await dialog.locator('[data-ops-cal-apply]').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => calendarState(page)).toEqual({
    name: 'Late ploeg', workDays: [1, 2, 3, 4, 5, 6], hoursPerDay: 8, sat: LATE, taskMinutes: 2400, taskDays: 4,
  });
});

test('kalendervenster: ma t/m vr uit en dan Za aan geeft za de werkdag van het openen, zonder verzonnen pauze',
  async ({ page, ops: _ops }) => {
    await openXer(page, xer('Dagploeg 10 u', ON_MA_VR(['08:00', '18:00']), 8));
    await expect.poll(() => calendarState(page).then((s) => [s.workDays, s.hoursPerDay])).toEqual([[1, 2, 3, 4, 5], 8]);

    const dialog = await openCalendarDialog(page);
    await clickDays(dialog, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    await expect(netHours(dialog)).toHaveText('—');
    await clickDays(dialog, ['Sat']);
    await expect(dialog.locator('[data-ops-worktime-day="6"]')).toContainText('10h');
    await expect(netHours(dialog)).toHaveText('10h');

    await dialog.locator('[data-ops-cal-apply]').click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => calendarState(page).then((s) => [s.workDays, s.sat, s.hoursPerDay]))
      .toEqual([[6], [{ start: 480, end: 1080 }], 8]);
  });

test('kalendervenster: twee klikvolgordes naar dezelfde werkdagen geven dezelfde uren per dag',
  async ({ page, ops: _ops }) => {
    const nineToFour = ['07:00', '16:00'] as const;
    await openXer(page, xer('Negen en acht', { 2: nineToFour, 3: nineToFour, 4: nineToFour, 5: nineToFour, 6: ['07:00', '15:00'] }, 8));
    await expect.poll(() => calendarState(page).then((s) => [s.workDays, s.hoursPerDay])).toEqual([[1, 2, 3, 4, 5], 8]);

    let dialog = await openCalendarDialog(page);
    await clickDays(dialog, ['Tue', 'Wed', 'Thu']);
    await expect(netHours(dialog)).toHaveText('9h');
    await dialog.locator('[data-ops-cal-cancel]').click();
    await expect(dialog).toBeHidden();

    dialog = await openCalendarDialog(page);
    await clickDays(dialog, ['Mon', 'Tue', 'Wed', 'Thu', 'Mon']);
    await expect(netHours(dialog)).toHaveText('9h');
    await dialog.locator('[data-ops-cal-apply]').click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => calendarState(page).then((s) => [s.workDays, s.hoursPerDay])).toEqual([[1, 5], 8]);
  });

test('kalendervenster: + blok bij Za in Werktijden houdt de uren per dag van Late ploeg op 8',
  async ({ page, ops: _ops }) => {
    await openXer(page, LATE_PLOEG);
    await expect.poll(() => calendarState(page).then((s) => s.hoursPerDay)).toBe(8);

    const dialog = await openCalendarDialog(page);
    const satRow = dialog.locator('[data-ops-worktime-day="6"]');
    await satRow.getByRole('button', { name: 'Add band', exact: true }).click();
    await expect(satRow).toContainText('8h');
    await expect(dayButton(dialog, 'Sat')).toHaveClass(/bg-accent/);
    await expect(netHours(dialog)).toHaveText('10h');

    await dialog.locator('[data-ops-cal-apply]').click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => calendarState(page).then((s) => [s.workDays, s.sat, s.hoursPerDay]))
      .toEqual([[1, 2, 3, 4, 5, 6], [{ start: 480, end: 960 }], 8]);
  });

test('kalendervenster: na een preset volgen de uren per dag de blokken weer', async ({ page, ops: _ops }) => {
  await openXer(page, LATE_PLOEG);
  await expect.poll(() => calendarState(page).then((s) => s.hoursPerDay)).toBe(8);

  const dialog = await openCalendarDialog(page);
  await dialog.getByRole('button', { name: '2 shifts', exact: true }).click();
  await expect(netHours(dialog)).toHaveText('16h');
  await clickDays(dialog, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  await expect(netHours(dialog)).toHaveText('—');
  await dialog.locator('[data-ops-worktime-day="6"]').getByRole('button', { name: 'Add band', exact: true }).click();
  await expect(netHours(dialog)).toHaveText('8h');

  await dialog.locator('[data-ops-cal-apply]').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => calendarState(page).then((s) => [s.workDays, s.sat, s.hoursPerDay]))
    .toEqual([[6], [{ start: 480, end: 960 }], 8]);
});

test('kalendervenster: de beginstand blijft per kalender bewaard als je in het venster van kalender wisselt',
  async ({ page, ops: _ops }) => {
    const nineToFour = ['07:00', '16:00'] as const;
    await openXer(page, xer('Negen en acht', { 2: nineToFour, 3: nineToFour, 4: nineToFour, 5: nineToFour, 6: ['07:00', '15:00'] }, 8,
      { name: 'Andere', days: ON_MA_VR(['08:00', '16:00']) }));
    await expect.poll(() => calendarState(page).then((s) => [s.name, s.workDays, s.hoursPerDay])).toEqual(['Negen en acht', [1, 2, 3, 4, 5], 8]);
    const ids = await page.evaluate(() => Object.fromEntries(
      window.__OPS__!.store.getState().calendars.map((c) => [c.name, c.id])));

    const dialog = await openCalendarDialog(page);
    await clickDays(dialog, ['Mon', 'Tue', 'Wed', 'Thu']);
    await dialog.locator(`[data-ops-calendar-row="${ids['Andere']}"]`).click();
    await dialog.locator(`[data-ops-calendar-row="${ids['Negen en acht']}"]`).click();
    await clickDays(dialog, ['Mon']);
    await expect(dialog.locator('[data-ops-worktime-day="1"]')).toContainText('9h');
    await expect(netHours(dialog)).toHaveText('9h');

    await dialog.locator('[data-ops-cal-apply]').click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => {
      const c = window.__OPS__!.store.getState().calendar;
      return [c.workDays, c.workTime?.byWeekday[1], c.hoursPerDay];
    })).toEqual([[1, 5], [{ start: 420, end: 960 }], 8]);
  });

test('resourcekalendervenster: ma t/m do uit en ma weer aan bij 9/9/9/9/8 (8 u/dag) geeft 8, en ma krijgt zijn eigen 9 u terug',
  async ({ page, ops: _ops }) => {
    const calendarId = await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      const { id: _ignored, ...base } = structuredClone(s.calendar);
      void _ignored;
      const nine = [{ start: 420, end: 960 }];
      const eight = [{ start: 420, end: 900 }];
      const id = s.addCalendar({
        ...base, name: 'Negen en acht', workDays: [1, 2, 3, 4, 5], hoursPerDay: 8,
        workTime: { byWeekday: { 1: nine, 2: nine, 3: nine, 4: nine, 5: eight, 6: [], 7: [] } },
      });
      s.addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1, calendarId: id });
      window.__OPS__!.store.getState().setUI({
        activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false, resourcesView: 'project',
      });
      return id;
    });
    const resourceCalendar = (id: string) => page.evaluate((cid) => {
      const c = window.__OPS__!.store.getState().calendars.find((x) => x.id === cid)!;
      return [c.workDays, c.workTime?.byWeekday[1], c.hoursPerDay];
    }, id);
    expect(await resourceCalendar(calendarId)).toEqual([[1, 2, 3, 4, 5], [{ start: 420, end: 960 }], 8]);

    await page.getByRole('row', { name: /Ploeg/ }).getByRole('button', { name: 'Edit…' }).click();
    const dialog = page.getByRole('dialog');
    await expect(netHours(dialog)).toHaveText('9h');
    await clickDays(dialog, ['Mon', 'Tue', 'Wed', 'Thu']);
    await expect(netHours(dialog)).toHaveText('8h');
    await clickDays(dialog, ['Mon']);
    await expect(dialog.locator('[data-ops-worktime-day="1"]')).toContainText('9h');
    await expect(netHours(dialog)).toHaveText('9h');

    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => resourceCalendar(calendarId)).toEqual([[1, 5], [{ start: 420, end: 960 }], 8]);
  });

test('kalendervenster: netto-uren per dag toont de werktijd van de blokken, live, en Annuleren laat de opgeslagen 8 staan',
  async ({ page, ops: _ops }) => {
    await openXer(page, xer('Dagploeg 10 u', ON_MA_VR(['08:00', '18:00']), 8));
    await expect.poll(() => calendarState(page).then((s) => [s.workDays, s.hoursPerDay])).toEqual([[1, 2, 3, 4, 5], 8]);

    const dialog = await openCalendarDialog(page);
    await expect(netHours(dialog)).toHaveText('10h');
    await expect(dialog.locator('[data-ops-derived-hpd]')).toHaveCount(0);

    const monBand = dialog.locator('[data-ops-worktime-day="1"] [data-ops-band]').first().locator('[data-ops-time-input]');
    await monBand.nth(0).fill('07:00');
    await monBand.nth(0).press('Tab');
    await monBand.nth(1).fill('16:00');
    await monBand.nth(1).press('Tab');
    await expect(dialog.locator('[data-ops-worktime-day="1"]')).toContainText('9h');
    await expect(netHours(dialog)).toHaveText('10h');
    await dialog.locator('[data-ops-worktime-day="1"]').getByTitle('Copy to all workdays').click();
    await expect(dialog.locator('[data-ops-worktime-day="5"]')).toContainText('9h');
    await expect(netHours(dialog)).toHaveText('9h');

    await dialog.locator('[data-ops-cal-cancel]').click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => {
      const c = window.__OPS__!.store.getState().calendar;
      return [c.hoursPerDay, c.workTime?.byWeekday[1]];
    })).toEqual([8, [{ start: 480, end: 1080 }]]);
  });

test('kalendervenster: standaard werkdag is de dagsom die het vaakst voorkomt, geen gemiddelde (ma 16 u, di–vr 10 u ⇒ 10)',
  async ({ page, ops: _ops }) => {
    await openXer(page, xer('Dagploeg 10 u', ON_MA_VR(['08:00', '18:00']), 10));
    await expect.poll(() => calendarState(page).then((s) => s.workDays)).toEqual([1, 2, 3, 4, 5]);

    const dialog = await openCalendarDialog(page);
    await expect(netHours(dialog)).toHaveText('10h');
    const monBand = dialog.locator('[data-ops-worktime-day="1"] [data-ops-band]').first().locator('[data-ops-time-input]');
    await monBand.nth(0).fill('07:00');
    await monBand.nth(0).press('Tab');
    await monBand.nth(1).fill('23:00');
    await monBand.nth(1).press('Tab');
    await expect(dialog.locator('[data-ops-worktime-day="1"]')).toContainText('16h');
    await expect(netHours(dialog)).toHaveText('10h');
    await dialog.locator('[data-ops-cal-cancel]').click();
    await expect(dialog).toBeHidden();
  });

test('kalendervenster: het i-icoon bij Standard workday legt het veld uit, met de muis en met het toetsenbord',
  async ({ page, ops: _ops }) => {
    await openXer(page, LATE_PLOEG);
    await expect.poll(() => calendarState(page).then((s) => s.workDays)).toEqual([1, 2, 3, 4, 5]);
    const dialog = await openCalendarDialog(page);
    const info = dialog.locator('[data-ops-standard-workday-info]');
    await expect(info).toHaveAttribute('aria-label', 'Explanation of the standard workday');
    expect(await info.evaluate((el) => getComputedStyle(el).cursor)).not.toBe('help');
    const tip = page.locator('.ops-tooltip[role="tooltip"]');
    const text = 'The length of the workday that occurs most often. The app uses it to convert a day into hours.';
    await info.hover();
    await expect(tip).toHaveText(text);
    await page.mouse.move(0, 0);
    await expect(tip).toHaveCount(0);
    await info.focus();
    await expect(tip).toHaveText(text);
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-ops-cal-cancel]').click();
  });
