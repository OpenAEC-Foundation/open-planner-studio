// Oranje blok onder *Standaard werkdag* in het kalendervenster (besluit eigenaar 2026-10-20, punt 8 uit de
// review van #366, optie 2).
//
// Een geïmporteerd bestand kan een eigen getal "uren per dag" meebrengen (`hoursPerDay`; XER `day_hr_cnt`).
// De app rekent met de werktijd (een dag is de werktijd van de taakkalender, besluit 2026-10-15), maar de
// scalar gaat ongewijzigd mee bij export. Wijkt hij af van *Standaard werkdag*, dan toont het venster direct
// onder het getal één oranje blok (`alert--info`). Zonder afwijking: geen blok. Dezelfde vergelijking als de
// IFC-schrijver (`hoursPerDayDiffers` in `src/services/subdayIo.ts`). Het blok volgt de blokken en presets
// live; het verandert niets aan de kalender.
//
// De .xer gaat via de ribbonknop Openen en de bestandskiezer; daarna alleen echte klikken en toetsen.
// `window.__OPS__` wordt alleen gebruikt om de store te LEZEN.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';
import { LOCALE_CASES, chooseLocale } from './fixtures/locale';

// Schermbewijs alleen op verzoek: `OPS_WERKDAG_BLOK_SHOTS=<map>` (patroon `task-recorded-dates-block.spec.ts`).
const SHOTS = process.env.OPS_WERKDAG_BLOK_SHOTS;

type Clock = readonly [string, string];
const calendarData = (band: Clock) => {
  // P6 telt de dagen vanaf zondag (1); 2..6 = ma..vr.
  const day = (n: number) => (n >= 2 && n <= 6 ? `(0||${n}()((0||0(s|${band[0]}|f|${band[1]})())))` : `(0||${n}()())`);
  return `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(day).join('')}))(0||Exceptions()())))`;
};
/** XER met projectkalender C1 (ma–vr één blok) en één urentaak van 40 u. */
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
// Fixture van `tests/planning/check-dag-is-werktijd.ts`: day_hr_cnt 8, ma–vr 07:00–17:00 = 10 u.
const LANGE_DAGEN = xer('Lange dagen', ['07:00', '17:00'], 8);
// Zelfde blokken, day_hr_cnt gelijk aan de dagsom: geen afwijking.
const GELIJK = xer('Gewone dagen', ['07:00', '17:00'], 10);

// Uur-getallen in de getalnotatie van de taal, zonder overbodige nullen, met de eenheid uit i18n
// (check eigenaar 2026-10-20: geen "8,00" en geen "h" naast "u").
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

/** Planning ▸ Kalender met echte klikken; het venster toont de projectkalender. */
async function openCalendarDialog(page: Page): Promise<Locator> {
  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  await page.locator('[data-ops-ribbon-item="calendar"]').first().click();
  const dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();
  return dialog;
}
const netHours = (dialog: Locator) => dialog.locator('[data-ops-simple-break-net-hours]');
const notice = (dialog: Locator) => dialog.locator('[data-ops-file-hours-per-day-notice]');

/** Uitsnede rond *Standaard werkdag* (en het blok, als het er staat), in licht en donker of alleen licht. */
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

/** Uitsnede van de eerste weekdagen in *Werktijden* (uren per weekdag), in licht en donker. */
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
    // Het bestaande oranje infoblok van de app, kleur uit het thema (`--theme-accent`).
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
    // Direct onder het getal: het blok begint onder de onderrand van het getal.
    const outBox = await netHours(dialog).boundingBox();
    const noticeBox = await notice(dialog).boundingBox();
    expect(outBox && noticeBox && noticeBox.y >= outBox.y + outBox.height - 1).toBe(true);

    // Annuleren: het blok veranderde niets aan de kalender.
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

  // Ma 07:00–15:00: alleen maandag op 8, de dagsom die het vaakst voorkomt blijft 10. Het blok blijft.
  const monBand = dialog.locator('[data-ops-worktime-day="1"] [data-ops-band]').first().locator('[data-ops-time-input]');
  await monBand.nth(1).fill('15:00');
  await monBand.nth(1).press('Tab');
  await expect(dialog.locator('[data-ops-worktime-day="1"]')).toContainText('8h');
  await expect(netHours(dialog)).toHaveText('10h');
  await expect(notice(dialog)).toHaveText(NOTICE_8_10);

  // Kopiëren naar alle werkdagen: elke dag 8 u, gelijk aan het getal uit het bestand. Het blok verdwijnt.
  await dialog.locator('[data-ops-worktime-day="1"]').getByTitle('Copy to all workdays').click();
  await expect(dialog.locator('[data-ops-worktime-day="5"]')).toContainText('8h');
  await expect(netHours(dialog)).toHaveText('8h');
  await expect(notice(dialog)).toHaveCount(0);

  // Terug naar 10 u op ma: nog steeds modaal 8 (di–vr), dus nog steeds geen blok.
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

// In het Nederlands: komma als decimaalteken, geen overbodige nullen en overal "u" (ook bij *Standaard
// werkdag* en de weekdagen in *Werktijden*). De taal kiest de test met echte klikken in Instellingen.
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

  // Ma 07:00–14:30: 7,5 u met een komma; de dagsom die het vaakst voorkomt (10 u) en het blok blijven.
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

// RTL (VERVOLG uit de review van #394): ar en fa hebben de sleutel niet en vallen terug op Engels. Met een spatie
// ("7.75 h") zette de RTL-alinea de eenheid links van het getal ("h 7.75"). Zonder spatie (besluit eigenaar
// 2026-10-20: "10h") is "7.75h" één doorlopende LTR-reeks. De test meet de tekenposities op het scherm: het
// eerste cijfer staat links van de "h", bij *Standaard werkdag* én bij de uren per weekdag.
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
    // Ma 07:00–14:45: 7.75h, het geval uit de review.
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
