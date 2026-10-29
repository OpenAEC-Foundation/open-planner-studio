import type { Locator, Page } from '@playwright/test';
import { expect, test, waitForOps } from './fixtures/ops';
import { blocksOf, mspdiWithBlocks, openMspdiAndCalendarDialog } from './fixtures/mspdiBlocks';

/**
 * Instelling Tijdnotatie (24 of 12 uur). Alle geteste handelingen gaan via echte muis- en
 * toetsenbordevents: de instelling omzetten in het instellingenpaneel, het MSPDI-bestand openen via de
 * echte bestandskiezer, tijden typen en Toepassen. De dev-brug opent alleen het kalendervenster (zoals
 * de bestaande kalendertests), zet de Gantt-zoom als fixture en leest state.
 */

const TIME_FORMAT = /^(Time format|Tijdnotatie)$/;

async function chooseTimeFormat(page: Page, option: RegExp): Promise<void> {
  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  const settings = page.locator('.settings-dialog');
  await expect(settings).toBeVisible();
  await settings.getByLabel(TIME_FORMAT).click();
  await page.getByRole('option', { name: option }).click();
  await settings.locator('.modal-close-btn').click();
  await expect(settings).toBeHidden();
}

const mondayBlocks = (page: Page) => page.evaluate(() =>
  window.__OPS__!.store.getState().calendar.workTime?.byWeekday[1] ?? null);

const band = (dialog: Locator, day: number, index: number, edge: 'start' | 'end') =>
  dialog.locator(`[data-ops-worktime-day="${day}"] [data-ops-band]`).nth(index)
    .locator(`[data-ops-time-input="band-${edge}"]`);

async function typeTime(field: Locator, text: string): Promise<void> {
  await field.click();
  await field.fill(text);
  await field.press('Enter');
}

/** Tekst van de Einde-cel van de enige taak in de Tabel-weergave. */
async function finishCellText(page: Page): Promise<string> {
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const surface = page.locator('[data-task-grid-surface-id="full-task-grid"]');
  const cell = surface.locator('[data-grid-data-row="true"] [data-grid-data-cell="true"][data-grid-column-id="task.time.finish"]').first();
  await expect(cell).toBeVisible();
  return (await cell.innerText()).trim();
}

/**
 * Teksten die de Gantt-canvas tekent op de uurschaal. De `fillText`-haak staat vóór de klik op Start,
 * zodat ook de eerste tekenbeurt na het terugkeren naar de Gantt meetelt; daarna wachten we tot er
 * een uurlabel (in een van beide notaties) getekend is.
 */
async function ganttHourLabels(page: Page, zoom = 1000): Promise<string[]> {
  await page.evaluate(() => {
    const w = window as Window & { __opsDrawnText?: string[] };
    if (!w.__opsDrawnText) {
      const drawn: string[] = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function fillText(text: string, x: number, y: number, maxWidth?: number) {
        drawn.push(String(text));
        if (maxWidth === undefined) original.call(this, text, x, y);
        else original.call(this, text, x, y, maxWidth);
      };
      Object.defineProperty(window, '__opsDrawnText', { configurable: true, value: drawn });
    }
    w.__opsDrawnText!.length = 0;
  });
  // Terug naar de Gantt: het lint-tabblad Start (het tabblad Tabel toont het volledige raster).
  await page.locator('.ribbon-tab').filter({ hasText: /^(Home|Start)$/ }).click();
  await expect(page.locator('[data-task-grid-surface-id="full-task-grid"]')).toHaveCount(0);
  await page.evaluate((z) => {
    window.__OPS__!.store.getState().setZoom(z);
    window.__OPS__!.store.getState().setViewStartDate('2026-01-06');
  }, zoom);
  const drawn = () => page.evaluate(() => (window as Window & { __opsDrawnText?: string[] }).__opsDrawnText ?? []);
  await expect.poll(async () => (await drawn()).some(text => /^(\d{2}:00|\d{1,2} (AM|PM)|\d{1,2}[ap])$/.test(text)), {
    message: 'de Gantt tekende geen uurlabel',
  }).toBe(true);
  return drawn();
}

test('Tijdnotatie: kalendervenster, tabel en Gantt volgen de instelling, ook na herladen', async ({ page, ops: _ops }) => {
  // Standaard 24 uur.
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.timeNotation)).toBe('24h');

  // 1) 12 uur kiezen in het instellingenpaneel.
  await chooseTimeFormat(page, /^(12-hour \(1:00 PM\)|12 uur \(1:00 PM\))$/);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.timeNotation)).toBe('12h');

  // 2) Kalendervenster met werkblokken (MSPDI via de echte bestandskiezer).
  let dialog = await openMspdiAndCalendarDialog(page, mspdiWithBlocks([['08:00', '12:00'], ['13:00', '17:00']]));
  await expect.poll(() => blocksOf(dialog, 1)).toEqual(['8:00 AM', '12:00 PM', '1:00 PM', '5:00 PM']);
  await expect(dialog.locator('input[type="time"]')).toHaveCount(0);

  // Typen in 12-uursnotatie: "7:30 am" en "3 pm"; 12:00 PM blijft het middaguur.
  await typeTime(band(dialog, 1, 0, 'start'), '7:30 am');
  await expect(band(dialog, 1, 0, 'start')).toHaveValue('7:30 AM');
  await typeTime(band(dialog, 1, 1, 'end'), '3 pm');
  await expect(band(dialog, 1, 1, 'end')).toHaveValue('3:00 PM');
  // Ongeldige invoer valt bij afronden terug op de laatste geldige waarde.
  await typeTime(band(dialog, 1, 1, 'start'), '13:00 PM');
  await expect(band(dialog, 1, 1, 'start')).toHaveValue('1:00 PM');
  await expect.poll(() => blocksOf(dialog, 1)).toEqual(['7:30 AM', '12:00 PM', '1:00 PM', '3:00 PM']);
  await dialog.locator('[data-ops-cal-apply]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => mondayBlocks(page)).toEqual([{ start: 450, end: 720 }, { start: 780, end: 900 }]);

  // 3) Eén weergaveplek buiten het kalendervenster: de taaktijd in de tabel, en de Gantt-uurschaal.
  expect(await finishCellText(page)).toMatch(/^\d{2}-\d{2}-\d{4} \d{1,2}:\d{2} (AM|PM)$/);
  const labels12 = await ganttHourLabels(page);
  expect(labels12.some(text => /^\d{1,2} (AM|PM)$/.test(text)), labels12.join(' | ')).toBe(true);
  expect(labels12.some(text => /^\d{2}:00$/.test(text))).toBe(false);

  // 4) Terug naar 24 uur: dezelfde blokken in 24-uursnotatie, en typen als "1630".
  await chooseTimeFormat(page, /^(24-hour \(13:00\)|24 uur \(13:00\))$/);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showCalendarDialog: true }));
  dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();
  await expect.poll(() => blocksOf(dialog, 1)).toEqual(['07:30', '12:00', '13:00', '15:00']);
  await typeTime(band(dialog, 1, 1, 'end'), '1630');
  await expect(band(dialog, 1, 1, 'end')).toHaveValue('16:30');
  await typeTime(band(dialog, 1, 0, 'end'), '12');
  await expect(band(dialog, 1, 0, 'end')).toHaveValue('12:00');
  await dialog.locator('[data-ops-cal-apply]').click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => mondayBlocks(page)).toEqual([{ start: 450, end: 720 }, { start: 780, end: 990 }]);
  expect(await finishCellText(page)).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/);
  const labels24 = await ganttHourLabels(page);
  expect(labels24.some(text => /^\d{2}:00$/.test(text)), labels24.join(' | ')).toBe(true);
  expect(labels24.some(text => /^\d{1,2} (AM|PM)$/.test(text))).toBe(false);

  // 5) Weer 12 uur, en herladen: de instelling blijft staan.
  await chooseTimeFormat(page, /^(12-hour \(1:00 PM\)|12 uur \(1:00 PM\))$/);
  await page.reload();
  await waitForOps(page);
  const skipWelcome = page.getByRole('button', { name: /^(Skip|Overslaan)$/ });
  await expect(skipWelcome).toBeVisible();
  await skipWelcome.click();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.timeNotation)).toBe('12h');
  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  await expect(page.locator('.settings-dialog').getByLabel(TIME_FORMAT)).toContainText(/12/);
  await page.locator('.settings-dialog .modal-close-btn').click();

  // 6) Begin en Einde van een gewone kalender in 12 uur; 24:00 als einde is 12:00 AM.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showCalendarDialog: true }));
  dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog.locator('[data-ops-work-start]')).toHaveValue('7:00 AM');
  await expect(dialog.locator('[data-ops-work-end]')).toHaveValue('4:00 PM');
  await expect(dialog.locator('[data-ops-work-start]')).toHaveAttribute('placeholder', '1:30 PM');
  await dialog.locator('[data-ops-calendar-preset-continuous]').click();
  await expect(dialog.locator('[data-ops-work-start]')).toHaveValue('12:00 AM');
  await expect(dialog.locator('[data-ops-work-end]')).toHaveValue('12:00 AM');
  // Einde typen als "5 pm" en daarna "12 am" (= 24:00, einde van de dag).
  await typeTime(dialog.locator('[data-ops-work-end]'), '5 pm');
  await expect(dialog.locator('[data-ops-work-end]')).toHaveValue('5:00 PM');
  await typeTime(dialog.locator('[data-ops-work-end]'), '12 am');
  await dialog.locator('[data-ops-cal-apply]').click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => {
    const c = window.__OPS__!.store.getState().calendar;
    return [c.workStartHour, c.workEndHour];
  })).toEqual([0, 24]);
});

// ── Blokeinde 24:00 (review #347, punt 1 en 3) ──────────────────────────────────────────────────
// Een blok tot middernacht (16:00–24:00) toont in het eindveld 24:00 (12 uur: 12:00 AM), zonder
// "volgende dag". Een stap omlaag — knop of pijltje, getypt of onaangeroerd — geeft 23:45 op
// DEZELFDE dag (1425), nooit 23:45 de volgende dag (2865).

const NOTATIONS = [
  { notation: '24h', option: /^(24-hour \(13:00\)|24 uur \(13:00\))$/, midnight: '24:00', quarterTo: '23:45', five: '17:00', typedMidnight: '24:00' },
  { notation: '12h', option: /^(12-hour \(1:00 PM\)|12 uur \(1:00 PM\))$/, midnight: '12:00 AM', quarterTo: '11:45 PM', five: '5:00 PM', typedMidnight: '12 am' },
] as const;

const dayBlocks = (page: Page) => page.evaluate(() => {
  const c = window.__OPS__!.store.getState().calendar;
  return [1, 2, 3, 4, 5].map(d => c.workTime?.byWeekday[d as 1] ?? null);
});

for (const n of NOTATIONS) {
  test(`Tijdnotatie ${n.notation}: blokeinde 24:00 stapt omlaag naar 23:45 op dezelfde dag`, async ({ page, ops: _ops }) => {
    if (n.notation === '12h') await chooseTimeFormat(page, n.option);
    const dialog = await openMspdiAndCalendarDialog(page, mspdiWithBlocks([['16:00', '00:00']]));
    await expect.poll(() => dayBlocks(page)).toEqual(Array(5).fill([{ start: 960, end: 1440 }]));
    const end = (day: number) => band(dialog, day, 0, 'end');
    for (const day of [1, 2, 3, 4, 5]) {
      await expect(end(day)).toHaveValue(n.midnight);
      const nextDay = dialog.locator(`[data-ops-worktime-day="${day}"] [data-ops-band-next-day]`);
      await expect(nextDay).not.toBeChecked();
      await expect(nextDay).toBeDisabled();
    }
    // Ma: de stapknop omlaag, onaangeroerd veld.
    const monDown = dialog.locator('[data-ops-worktime-day="1"] [data-ops-scalar-time-step="band-end-down"]');
    await monDown.click();
    await expect(end(1)).toHaveValue(n.quarterTo);
    // En weer omhoog: 23:45 + 15 min = 24:00 (het einde van de dag), daarna weer omlaag.
    await dialog.locator('[data-ops-worktime-day="1"] [data-ops-scalar-time-step="band-end-up"]').click();
    await expect(end(1)).toHaveValue(n.midnight);
    await monDown.click();
    await expect(end(1)).toHaveValue(n.quarterTo);
    // Di: het pijltje omlaag, onaangeroerd veld.
    await end(2).click();
    await end(2).press('ArrowDown');
    await expect(end(2)).toHaveValue(n.quarterTo);
    // Wo: middernacht getypt (dezelfde waarde), dan het pijltje omlaag.
    await end(3).click();
    await end(3).fill(n.typedMidnight);
    await end(3).press('ArrowDown');
    await expect(end(3)).toHaveValue(n.quarterTo);
    // Do: eerst 17:00, dan middernacht typen ("24:00" of "12 am") ⇒ weer 24:00, zonder "volgende dag".
    await typeTime(end(4), '17:00');
    await expect(end(4)).toHaveValue(n.five);
    await typeTime(end(4), n.typedMidnight);
    await expect(end(4)).toHaveValue(n.midnight);
    // Vr: "12 am" en "24:00" in een eindveld van 17:00 betekenen beide middernacht.
    await typeTime(end(5), '17:00');
    await typeTime(end(5), n.notation === '24h' ? '12 am' : '24:00');
    await expect(end(5)).toHaveValue(n.midnight);
    await expect(dialog.locator('[data-ops-worktime-day="5"] [data-ops-band-next-day]')).not.toBeChecked();
    // Een stap omhoog vanaf 24:00 kan niet verder.
    await dialog.locator('[data-ops-worktime-day="5"] [data-ops-scalar-time-step="band-end-up"]').click();
    await expect(end(5)).toHaveValue(n.midnight);

    await dialog.locator('[data-ops-cal-apply]').click();
    await expect(dialog).toHaveCount(0);
    const q = { start: 960, end: 1425 };
    const m = { start: 960, end: 1440 };
    await expect.poll(() => dayBlocks(page)).toEqual([[q], [q], [q], [m], [m]]);
    expect(await page.evaluate(() => window.__OPS__!.store.getState().calendar.workTime?.byWeekday[1]))
      .not.toEqual([{ start: 960, end: 2865 }]);
  });
}

// ── Focus + Tab zonder wijziging (review #347, punt 2 en 3) ─────────────────────────────────────
// XER-kalender "Late ploeg": blokken 14:00–24:00 (10 klokuren), maar `day_hr_cnt` 8. Zonder echte
// wijziging mag Toepassen hoursPerDay, de pauze en de blokken niet raken.
const LATE_DAY = (n: number) => `(0||${n}()(${n >= 2 && n <= 6 ? '(0||0(s|14:00|f|00:00)())' : ''}))`;
const LATE_XER = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tC1\tLate ploeg\tCA_Base\t8\t40\t(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(LATE_DAY).join('')}))(0||Exceptions()())))`,
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tLatePloeg\tC1\t2026-03-02\t2026-01-05',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tC1\tA1\tTaak\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05 14:00\t2026-01-08 18:00',
  '%E',
].join('\n');

const calendarFacts = (page: Page) => page.evaluate(() => {
  const c = window.__OPS__!.store.getState().calendar;
  return { workTime: c.workTime, hoursPerDay: c.hoursPerDay, workDays: c.workDays,
    breakStart: c.simpleBreakStartMinute, breakMinutes: c.simpleBreakDurationMinutes };
});

for (const n of NOTATIONS) {
  test(`Tijdnotatie ${n.notation}: focus en Tab zonder wijziging laten de kalender ongemoeid`, async ({ page, ops: _ops }) => {
    if (n.notation === '12h') await chooseTimeFormat(page, n.option);
    const chooser = page.waitForEvent('filechooser');
    await page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ }).click();
    await (await chooser).setFiles({ name: 'late.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(LATE_XER) });
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().calendar.name)).toBe('Late ploeg');
    const before = await calendarFacts(page);
    expect(before.hoursPerDay).toBe(8);
    expect(before.workTime?.byWeekday[1]).toEqual([{ start: 840, end: 1440 }]);

    await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showCalendarDialog: true }));
    const dialog = page.locator('[data-ops-calendar-dialog]');
    await expect(dialog).toBeVisible();
    await expect(band(dialog, 1, 0, 'end')).toHaveValue(n.midnight);
    // Ma–do: focus + Tab door begin en einde, zonder te typen.
    for (const day of [1, 2, 3, 4]) {
      await band(dialog, day, 0, 'start').click();
      await band(dialog, day, 0, 'start').press('Tab');
      await band(dialog, day, 0, 'end').click();
      await band(dialog, day, 0, 'end').press('Tab');
    }
    // Vr: dezelfde waarde opnieuw typen ("24:00" of "12 am") en Tab.
    await band(dialog, 5, 0, 'end').click();
    await band(dialog, 5, 0, 'end').fill(n.typedMidnight);
    await band(dialog, 5, 0, 'end').press('Tab');
    await expect(band(dialog, 5, 0, 'end')).toHaveValue(n.midnight);
    await dialog.locator('[data-ops-cal-apply]').click();
    await expect(dialog).toHaveCount(0);
    expect(await calendarFacts(page)).toEqual(before);
  });
}

// ── Gantt-uurschaal bij zoom 800 (review #347, punt 5) ──────────────────────────────────────────
// Een uurkolom is dan ~33 px: "12 AM" en "10 PM" passen niet. De hele uurrij gebruikt dan de smalle
// vorm ("12a", "12p"), zodat middernacht en middag zichtbaar blijven. Zonder de smalle vorm vielen
// "10 AM", "11 AM", "12 PM", "10 PM" en "11 PM" weg.
test('Tijdnotatie 12h: Gantt-uurschaal bij zoom 800 houdt middernacht en middag', async ({ page, ops: _ops }) => {
  await chooseTimeFormat(page, /^(12-hour \(1:00 PM\)|12 uur \(1:00 PM\))$/);
  await openMspdiAndCalendarDialog(page, mspdiWithBlocks([['08:00', '12:00'], ['13:00', '17:00']]));
  await page.locator('[data-ops-calendar-dialog] [data-ops-cal-cancel]').click();
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const labels = await ganttHourLabels(page, 800);
  // Het zichtbare venster loopt van de vroege ochtend tot de avond: middag moet erin staan, en elke
  // uurlabel in de smalle vorm (middernacht "12a" dekt de planningscheck).
  expect(labels.includes('12p'), labels.join(' | ')).toBe(true);
  expect(labels.filter(text => /^\d{1,2}[ap]$/.test(text)).length, labels.join(' | ')).toBeGreaterThan(8);
  expect(labels.some(text => /^\d{1,2} (AM|PM)$/.test(text))).toBe(false);
});

// ── Blok doortrekken na middernacht (hercheck #347, punt 1 en 2) ────────────────────────────────
// 22:00–24:00 met een getypt einde "02:00" of "2 am" wordt een nachtblok tot 02:00 de volgende dag
// (1560, "volgende dag" aan, 4 h), niet 22:00 terug naar 02:00 (−20 uur). En in het eindveld van
// een nachtblok is "24:00" middernacht (1440), net als "0:00" en "12 am".
for (const n of NOTATIONS) {
  test(`Tijdnotatie ${n.notation}: een getypt einde vóór het begin loopt door naar de volgende dag`, async ({ page, ops: _ops }) => {
    if (n.notation === '12h') await chooseTimeFormat(page, n.option);
    const dialog = await openMspdiAndCalendarDialog(page, mspdiWithBlocks([['22:00', '00:00']]));
    await expect.poll(() => dayBlocks(page)).toEqual(Array(5).fill([{ start: 1320, end: 1440 }]));
    const twoAm = n.notation === '24h' ? '02:00' : '2:00 AM';
    const dayHeader = (day: number) => dialog.locator(`[data-ops-worktime-day="${day}"] > div`).first();
    const nextDay = (day: number) => dialog.locator(`[data-ops-worktime-day="${day}"] [data-ops-band-next-day]`);

    // Ma: "02:00" (24 uur) of "2 am" (12 uur) ⇒ nachtblok tot 02:00.
    await typeTime(band(dialog, 1, 0, 'end'), n.notation === '24h' ? '02:00' : '2 am');
    await expect(band(dialog, 1, 0, 'end')).toHaveValue(twoAm);
    await expect(nextDay(1)).toBeChecked();
    await expect(dayHeader(1)).toContainText('4h');
    // Di: eerst doortrekken naar 02:00, dan "24:00" in het eindveld van het nachtblok ⇒ weer middernacht.
    await typeTime(band(dialog, 2, 0, 'end'), '02:00');
    await expect(nextDay(2)).toBeChecked();
    await typeTime(band(dialog, 2, 0, 'end'), '24:00');
    await expect(band(dialog, 2, 0, 'end')).toHaveValue(n.midnight);
    await expect(nextDay(2)).not.toBeChecked();
    await expect(dayHeader(2)).toContainText('2h');
    // Wo: eerst een nachtblok tot 06:00, dan "23:00" ⇒ 22:00–23:00 op dezelfde dag, nooit 25 uur.
    await typeTime(band(dialog, 3, 0, 'end'), '06:00');
    await expect(nextDay(3)).toBeChecked();
    await expect(dayHeader(3)).toContainText('8h');
    await typeTime(band(dialog, 3, 0, 'end'), n.notation === '24h' ? '23:00' : '11 pm');
    await expect(band(dialog, 3, 0, 'end')).toHaveValue(n.notation === '24h' ? '23:00' : '11:00 PM');
    await expect(nextDay(3)).not.toBeChecked();
    await expect(dayHeader(3)).toContainText('1h');

    await dialog.locator('[data-ops-cal-apply]').click();
    await expect(dialog).toHaveCount(0);
    const blocks = await dayBlocks(page);
    expect(blocks[0]).toEqual([{ start: 1320, end: 1560 }]);
    expect(blocks[1]).toEqual([{ start: 1320, end: 1440 }]);
    expect(blocks[2]).toEqual([{ start: 1320, end: 1380 }]);
    // Na Toepassen en heropenen: ma toont 4h en "volgende dag".
    await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showCalendarDialog: true }));
    await expect(dialog).toBeVisible();
    await expect(dayHeader(1)).toContainText('4h');
    await expect(nextDay(1)).toBeChecked();
    expect(await page.evaluate(() => window.__OPS__!.store.getState().calendar.hoursPerDay)).toBeGreaterThan(0);
  });
}
