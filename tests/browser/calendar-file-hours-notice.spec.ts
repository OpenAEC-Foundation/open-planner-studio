import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';
import { LOCALE_CASES, chooseLocale } from './fixtures/locale';

const SHOTS = process.env.OPS_WERKDAG_BLOK_SHOTS;

type Clock = readonly [string, string];
const calendarData = (band: Clock) => {
  const day = (n: number) => (n >= 2 && n <= 6 ? `(0||${n}()((0||0(s|${band[0]}|f|${band[1]})())))` : `(0||${n}()())`);
  return `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(day).join('')}))(0||Exceptions()())))`;
};
function xer(name: string, band: Clock, dayHrCnt: number): string {
  return [
    'ERMHDR\t8.4\t2026-07-18\t\t\t\t\t\tEUR',
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\t${name}\tCA_Base\t${dayHrCnt}\t${dayHrCnt * 5}\t${calendarData(band)}`,
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP1\tWerkdagBlok\tC1\t2026-06-01\t2026-06-01',
    '%T\tPROJWBS', '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\twbs_short_name\twbs_name',
    '%R\t1\tP1\t0\t1\tSWD\tStandaard werkdag',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA1\tP1\t1\tC1\tA-1\tUrentaak\tTT_Task\tTK_NotStart\t40\t40\t2026-06-01 07:00\t2026-06-05 17:00',
    '%E',
  ].join('\n');
}
const LANGE_DAGEN = xer('Lange dagen', ['07:00', '17:00'], 8);
const GELIJK = xer('Gewone dagen', ['07:00', '17:00'], 10);

const NOTICE_8_10 = 'The file has its own workday of 8h. It is kept on export to MS Project and P6. '
  + 'There a day counts 8h, here 10h.';
const NOTICE_8_10_NL = 'Het bestand heeft een eigen werkdag van 8u. Die gaat mee bij export naar MS Project en P6. '
  + 'Daar telt een dag 8u, hier 10u.';
const NL = LOCALE_CASES.find((c) => c.code === 'nl')!;

async function openXer(page: Page, text: string): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'werkdag.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(text) });
}

const storedCalendar = (page: Page) => page.evaluate(() => {
  const c = window.__OPS__!.store.getState().calendar;
  return { name: c.name, hoursPerDay: c.hoursPerDay, mon: c.workTime?.byWeekday[1] ?? null };
});

async function openCalendarDialog(page: Page): Promise<Locator> {
  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  await page.locator('[data-ops-ribbon-item="calendar"]').first().click();
  const dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();
  return dialog;
}
const netHours = (dialog: Locator) => dialog.locator('[data-ops-simple-break-net-hours]');
const notice = (dialog: Locator) => dialog.locator('[data-ops-file-hours-per-day-notice]');

async function shoot(page: Page, dialog: Locator, name: string, themes: readonly ('light' | 'dark')[]): Promise<void> {
  if (!SHOTS) return;
  const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme);
  for (const theme of themes) {
    await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
    await page.waitForTimeout(300);
    const d = (await dialog.boundingBox())!;
    const label = (await dialog.locator('[data-ops-standard-workday-info]').boundingBox())!;
    const below = (await notice(dialog).count()) > 0
      ? (await notice(dialog).boundingBox())!
      : (await netHours(dialog).boundingBox())!;
    const top = Math.max(label.y - 90, d.y);
    await page.screenshot({
      path: `${SHOTS}/${name}-${theme === 'light' ? 'licht' : 'donker'}.png`,
      clip: { x: d.x, y: top, width: d.width, height: below.y + below.height + 70 - top },
    });
  }
  await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), before);
}

async function shootWeekdays(page: Page, dialog: Locator, name: string): Promise<void> {
  if (!SHOTS) return;
  const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme);
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
    await page.waitForTimeout(300);
    const first = dialog.locator('[data-ops-worktime-day="1"]');
    await first.scrollIntoViewIfNeeded();
    const top = (await first.boundingBox())!;
    const last = (await dialog.locator('[data-ops-worktime-day="2"]').boundingBox())!;
    await page.screenshot({
      path: `${SHOTS}/${name}-${theme === 'light' ? 'licht' : 'donker'}.png`,
      clip: { x: top.x - 16, y: top.y - 16, width: top.width + 32, height: last.y + last.height + 16 - (top.y - 16) },
    });
  }
  await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), before);
}

test('kalendervenster: afwijkende uren per dag uit het bestand (8 bij 10 u) geeft één oranje blok onder het getal',
  async ({ page, ops: _ops }) => {
    await openXer(page, LANGE_DAGEN);
    await expect.poll(() => storedCalendar(page).then((c) => [c.name, c.hoursPerDay])).toEqual(['Lange dagen', 8]);

    const dialog = await openCalendarDialog(page);
    await expect(netHours(dialog)).toHaveText('10h');
    await expect(dialog.locator('[data-ops-worktime-day="1"]')).toContainText('10h');
    await expect(notice(dialog)).toHaveCount(1);
    await expect(notice(dialog)).toHaveText(NOTICE_8_10);
    await expect(notice(dialog)).toHaveClass(/\balert\b.*\balert--info\b/);
    const colors = await notice(dialog).evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--theme-accent)';
      el.appendChild(probe);
      const accent = getComputedStyle(probe).color;
      probe.remove();
      return { border: getComputedStyle(el).borderLeftColor, accent };
    });
    expect(colors.border).toBe(colors.accent);
    const outBox = await netHours(dialog).boundingBox();
    const noticeBox = await notice(dialog).boundingBox();
    expect(outBox && noticeBox && noticeBox.y >= outBox.y + outBox.height - 1).toBe(true);

    await dialog.locator('[data-ops-cal-cancel]').click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => storedCalendar(page)).toEqual({
      name: 'Lange dagen', hoursPerDay: 8, mon: [{ start: 420, end: 1020 }],
    });
  });

test('kalendervenster: zonder afwijking geen blok (XER 10 bij 10 u)', async ({ page, ops: _ops }) => {
  await openXer(page, GELIJK);
  await expect.poll(() => storedCalendar(page).then((c) => [c.name, c.hoursPerDay])).toEqual(['Gewone dagen', 10]);
  const dialog = await openCalendarDialog(page);
  await expect(netHours(dialog)).toHaveText('10h');
  await expect(notice(dialog)).toHaveCount(0);
});

test('kalendervenster: de standaardkalender van een nieuw project (dagkalender) toont geen blok',
  async ({ page, ops: _ops }) => {
    const dialog = await openCalendarDialog(page);
    await expect(netHours(dialog)).not.toHaveText('—');
    await expect(notice(dialog)).toHaveCount(0);
  });

test('kalendervenster: blokken naar een dagsom van 8 u laten het blok live verdwijnen', async ({ page, ops: _ops }) => {
  await openXer(page, LANGE_DAGEN);
  await expect.poll(() => storedCalendar(page).then((c) => c.hoursPerDay)).toBe(8);
  const dialog = await openCalendarDialog(page);
  await expect(notice(dialog)).toHaveText(NOTICE_8_10);

  const monBand = dialog.locator('[data-ops-worktime-day="1"] [data-ops-band]').first().locator('[data-ops-time-input]');
  await monBand.nth(1).fill('15:00');
  await monBand.nth(1).press('Tab');
  await expect(dialog.locator('[data-ops-worktime-day="1"]')).toContainText('8h');
  await expect(netHours(dialog)).toHaveText('10h');
  await expect(notice(dialog)).toHaveText(NOTICE_8_10);

  await dialog.locator('[data-ops-worktime-day="1"]').getByTitle('Copy to all workdays').click();
  await expect(dialog.locator('[data-ops-worktime-day="5"]')).toContainText('8h');
  await expect(netHours(dialog)).toHaveText('8h');
  await expect(notice(dialog)).toHaveCount(0);

  await monBand.nth(1).fill('17:00');
  await monBand.nth(1).press('Tab');
  await expect(netHours(dialog)).toHaveText('8h');
  await expect(notice(dialog)).toHaveCount(0);
});

test('kalendervenster: een preset vervangt het getal uit het bestand, het blok verdwijnt', async ({ page, ops: _ops }) => {
  await openXer(page, LANGE_DAGEN);
  await expect.poll(() => storedCalendar(page).then((c) => c.hoursPerDay)).toBe(8);
  const dialog = await openCalendarDialog(page);
  await expect(notice(dialog)).toHaveText(NOTICE_8_10);
  await dialog.locator('[data-ops-preset="two-shift"]').click();
  await expect(netHours(dialog)).toHaveText('16h');
  await expect(notice(dialog)).toHaveCount(0);
});

test('kalendervenster in het Nederlands: "10u", "8u" en "7,5u", geen "10,00 h" of "10 u"', async ({ page, ops: _ops }) => {
  await openXer(page, LANGE_DAGEN);
  await expect.poll(() => storedCalendar(page).then((c) => c.hoursPerDay)).toBe(8);
  await chooseLocale(page, NL);
  const dialog = await openCalendarDialog(page);
  await expect(netHours(dialog)).toHaveText('10u');
  await expect(notice(dialog)).toHaveText(NOTICE_8_10_NL);
  const monday = dialog.locator('[data-ops-worktime-day="1"]');
  await expect(monday).toContainText('10u');
  await expect(monday).not.toContainText('h');
  await shoot(page, dialog, 'blok-8-bij-10', ['light', 'dark']);

  const monBand = monday.locator('[data-ops-band]').first().locator('[data-ops-time-input]');
  await monBand.nth(1).fill('14:30');
  await monBand.nth(1).press('Tab');
  await expect(monday).toContainText('7,5u');
  await expect(netHours(dialog)).toHaveText('10u');
  await expect(notice(dialog)).toHaveText(NOTICE_8_10_NL);
  await shootWeekdays(page, dialog, 'werktijden-per-weekdag');
});

test('kalendervenster in het Nederlands: zonder afwijking "10u" en geen blok', async ({ page, ops: _ops }) => {
  await openXer(page, GELIJK);
  await expect.poll(() => storedCalendar(page).then((c) => c.hoursPerDay)).toBe(10);
  await chooseLocale(page, NL);
  const dialog = await openCalendarDialog(page);
  await expect(netHours(dialog)).toHaveText('10u');
  await expect(notice(dialog)).toHaveCount(0);
  await shoot(page, dialog, 'geen-blok-10-bij-10', ['light']);
});

async function digitLeftOfUnit(target: Locator): Promise<{ text: string; digit: number; unit: number }> {
  return target.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let digit = Number.NaN;
    let unit = Number.NaN;
    let text = '';
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = node.textContent ?? '';
      text += value;
      for (let i = 0; i < value.length; i++) {
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const left = range.getBoundingClientRect().left;
        if (Number.isNaN(digit) && /[0-9]/.test(value[i])) digit = left;
        if (value[i] === 'h') unit = left;
      }
    }
    return { text, digit, unit };
  });
}

for (const code of ['ar', 'fa'] as const) {
  test(`kalendervenster in ${code} (RTL): het getal staat vóór de "h" (geen "h 7.75")`, async ({ page, ops: _ops }) => {
    await openXer(page, LANGE_DAGEN);
    await expect.poll(() => storedCalendar(page).then((c) => c.hoursPerDay)).toBe(8);
    await chooseLocale(page, LOCALE_CASES.find((c) => c.code === code)!);
    await page.locator('[data-ops-ribbon-tab="planning"]').click();
    await page.locator('[data-ops-ribbon-item="calendar"]').first().click();
    const dialog = page.locator('[data-ops-calendar-dialog]');
    await expect(dialog).toBeVisible();
    await expect(netHours(dialog)).toHaveText('10h');
    const monday = dialog.locator('[data-ops-worktime-day="1"]');
    const mondayHours = monday.locator('[data-ops-worktime-day-hours]');
    const monBand = monday.locator('[data-ops-band]').first().locator('[data-ops-time-input]');
    await monBand.nth(1).fill('14:45');
    await monBand.nth(1).press('Tab');
    await expect(mondayHours).toHaveText('7.75h');
    for (const target of [netHours(dialog), mondayHours]) {
      const m = await digitLeftOfUnit(target);
      expect(Number.isFinite(m.digit) && Number.isFinite(m.unit), `meting ${m.text}`).toBe(true);
      expect(m.digit, `"${m.text}": cijfer links van de h`).toBeLessThan(m.unit);
    }
  });
}
