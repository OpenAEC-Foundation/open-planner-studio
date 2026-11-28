import type { Locator, Page } from '@playwright/test';
import { barPoint, expect, test } from './fixtures/ops';

type Band = { start: number; end: number };
const STD: Band[] = [{ start: 420, end: 720 }, { start: 780, end: 960 }];

async function setCalendar(page: Page, bands: Band[], friday: Band[] = bands): Promise<void> {
  await page.evaluate(({ bands, friday }) => {
    const s = window.__OPS__!.store.getState();
    s.setCalendar({
      ...s.calendar, workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
      workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: friday, 6: [], 7: [] } },
    });
  }, { bands, friday });
}

interface DayTaskFacts { start?: string; finish?: string; unit?: string; days: number; minutes?: number }

async function facts(page: Page, id: string): Promise<DayTaskFacts> {
  return page.evaluate(taskId => {
    const t = window.__OPS__!.store.getState().tasks.find(x => x.id === taskId)!;
    return { start: t.time.earlyStart, finish: t.time.earlyFinish, unit: t.time.durationUnit, days: t.time.scheduleDuration, minutes: t.time.durationMinutes };
  }, id);
}

async function seedDayTask(page: Page, projectStart: string, days: number, startClock = '07:00'): Promise<string> {
  return page.evaluate(({ projectStart, days, startClock }) => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ compressNonWorkdays: false, showPropertiesPanel: false, rightPanelCollapsed: true, barSplitMode: 'never', showSplitMode: false });
    s.setProject({ name: 'F4b momenten en maten', startDate: projectStart });
    const id = s.addTask({ name: `Dagenmaat ${days} d`, manuallyScheduled: false });
    const task = window.__OPS__!.store.getState().tasks.find(x => x.id === id)!;
    const start = `${projectStart}T${startClock}`;
    window.__OPS__!.store.getState().updateTask(id, {
      ...(startClock !== '07:00' && startClock !== '22:00' ? { constraint: { type: 'SNET', date: start } } : {}),
      splitGaps: undefined,
      time: { ...task.time, durationUnit: 'days', durationMinutes: undefined, scheduleDuration: days, scheduleStart: start, earlyStart: start },
    });
    window.__OPS__!.store.getState().runCPM();
    return id;
  }, { projectStart, days, startClock });
}

async function settledPoint(page: Page, id: string, edge: 'left' | 'body' | 'right'): Promise<{ x: number; y: number }> {
  let last: { x: number; y: number; paints: number } | null = null;
  let stable = 0;
  await expect.poll(async () => {
    const now = await page.evaluate(({ taskId, e }) => ({
      point: window.__OPS__!.gantt.taskBarPoint(taskId, e, 'primary'),
      paints: window.__OPS__!.gantt.paintCount('primary'),
    }), { taskId: id, e: edge });
    if (!now.point) { stable = 0; last = null; return false; }
    const same = last !== null && last.paints === now.paints && last.x === now.point.x && last.y === now.point.y;
    stable = same ? stable + 1 : 0;
    last = { ...now.point, paints: now.paints };
    return stable >= 2;
  }, { message: `balk van taak ${id} komt niet tot rust` }).toBe(true);
  return { x: last!.x, y: last!.y };
}

async function grabPoint(page: Page, id: string, edge: 'body' | 'right'): Promise<{ x: number; y: number }> {
  const anchor: 'left' | 'right' = edge === 'body' ? 'left' : 'right';
  const paints = await page.evaluate(() => window.__OPS__!.gantt.paintCount('primary'));
  const moved = await page.evaluate(({ taskId, anchor }) => {
    const s = window.__OPS__!.store.getState();
    const point = window.__OPS__!.gantt.taskBarPoint(taskId, anchor, 'primary');
    const canvas = document.querySelector('[data-testid="gantt-primary-canvas"]')!.getBoundingClientRect();
    if (!point) return false;
    const before = s.view.scrollX;
    s.setScroll(Math.max(0, before + point.x - canvas.left - 60), 0);
    return window.__OPS__!.store.getState().view.scrollX !== before;
  }, { taskId: id, anchor });
  if (moved) await expect.poll(() => page.evaluate(() => window.__OPS__!.gantt.paintCount('primary'))).toBeGreaterThan(paints);
  const p = await settledPoint(page, id, anchor);
  return edge === 'body' ? { x: p.x + 30, y: p.y } : { x: p.x - 2, y: p.y };
}

async function dragBar(page: Page, id: string, edge: 'body' | 'right', dx: number): Promise<void> {
  const p = await grabPoint(page, id, edge);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', edge === 'body' ? 'grabbing' : 'ew-resize');
  await page.mouse.move(p.x + dx, p.y, { steps: 6 });
  await page.mouse.up();
}

async function choosePreset(page: Page, preset: RegExp, zoom: number, id: string): Promise<void> {
  await page.locator('.ribbon-tab').filter({ hasText: /^(View|Beeld)$/ }).click();
  await page.locator('[data-tour-anchor="ribbon-group:beeld:timeScale"] button').filter({ has: page.locator('[data-icon="ui.dropdown"]') }).click();
  await page.getByRole('button', { name: preset, exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().view.zoom)).toBe(zoom);
  await page.evaluate(() => window.__OPS__!.store.getState().setViewStartDate('2026-09-01'));
  await settledPoint(page, id, 'body');
}

test('F4b: een dagenmaat-taak van 2,5 d sleept bij Dag per werkdag en bij Uur per uur, en houdt de breuk', async ({ page, ops: _ops }) => {
  await setCalendar(page, STD);
  let id = await seedDayTask(page, '2026-09-07', 2.5);
  expect(await facts(page, id)).toMatchObject({ start: '2026-09-07T07:00', finish: '2026-09-09T11:00', unit: 'days', days: 2.5 });

  await choosePreset(page, /^(Day|Dag)$/, 100, id);
  await dragBar(page, id, 'body', 100 / 24);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-09-07T07:00', finish: '2026-09-09T11:00', days: 2.5 });
  await dragBar(page, id, 'body', 100);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-09-08T07:00', finish: '2026-09-10T11:00', unit: 'days', days: 2.5 });
  await dragBar(page, id, 'right', 100);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-09-08T07:00', finish: '2026-09-11T11:00', unit: 'days', days: 3.5 });
  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  expect(await facts(page, id)).toMatchObject({ start: '2026-09-08T07:00', finish: '2026-09-11T11:00', days: 3.5 });

  await page.evaluate(() => window.__OPS__!.store.getState().newProject());
  await setCalendar(page, STD);
  id = await seedDayTask(page, '2026-09-08', 2.5);
  await choosePreset(page, /^(Hour|Uur)$/, 1000, id);
  await dragBar(page, id, 'right', 1000 / 24);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-09-08T07:00', finish: '2026-09-10T12:00', unit: 'days', days: 2.625 });
  await dragBar(page, id, 'body', 1000 / 24);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-09-08T08:00', finish: '2026-09-10T14:00', unit: 'days', days: 2.625 });
  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  expect(await facts(page, id)).toMatchObject({ start: '2026-09-08T08:00', finish: '2026-09-10T14:00', days: 2.625 });
});

async function enableSplitMode(page: Page): Promise<void> {
  await page.locator('[data-ops-ribbon-item="splitTask"]').click();
  await expect(page.locator('[data-ops-split-mode]')).toBeVisible();
}

async function gapsOf(page: Page, id: string) {
  return page.evaluate(taskId => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)?.splitGaps ?? null, id);
}

test('F4b: splitsen en stukslepen bij dagzoom leggen een dagenmaat-taak op dagslots', async ({ page, ops: _ops }) => {
  test.setTimeout(120_000);
  const NIGHT: Band[] = [{ start: 1320, end: 1800 }];
  let id = '';
  const seed = async (bands: Band[], friday: Band[], days: number, clock = '07:00') => {
    await page.evaluate(() => window.__OPS__!.store.getState().newProject());
    await setCalendar(page, bands, friday);
    id = await seedDayTask(page, '2026-06-01', days, clock);
    await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      s.setViewStartDate('2026-06-01');
      s.setZoom(100);
      s.setScroll(1400, 0);
    });
    await expect.poll(() => page.evaluate(taskId => window.__OPS__!.gantt.taskSegmentCount(taskId), id)).toBe(1);
  };
  const pointAt = async (day: string, hour = 12) => {
    const canvas = await page.getByTestId('gantt-primary-canvas').boundingBox();
    if (!canvas) throw new Error('Gantt ontbreekt');
    const x = await page.evaluate(date => window.__OPS__!.gantt.dateX(date), day);
    if (x === null) throw new Error('Datum ontbreekt op de as');
    return { x: canvas.x + x + hour / 24 * 100, y: (await barPoint(page, id)).y };
  };
  const split = async (day: string, hour = 12) => {
    await enableSplitMode(page);
    const p = await pointAt(day, hour);
    await page.mouse.click(p.x, p.y);
    await page.keyboard.press('Escape');
  };
  const gaps = () => gapsOf(page, id);
  const recalc = async () => {
    await page.evaluate(() => window.__OPS__!.store.getState().runCPM());
    return facts(page, id);
  };

  await seed(STD, STD, 2.5);
  await split('2026-06-02');
  await expect.poll(gaps).toEqual([{ afterMinutes: 480, gapMinutes: 480, source: 'user' }]);
  expect(await recalc()).toMatchObject({ finish: '2026-06-04T11:00', days: 2.5, unit: 'days' });
  await expect.poll(() => page.evaluate(taskId => window.__OPS__!.gantt.taskSegmentCount(taskId), id)).toBe(2);
  let p = await pointAt('2026-06-03', 10);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move((await pointAt('2026-06-04', 10)).x, p.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(gaps).toEqual([{ afterMinutes: 480, gapMinutes: 960, source: 'user' }]);
  p = await pointAt('2026-06-04', 10);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move((await pointAt('2026-06-02', 10)).x, p.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(gaps).toBeNull();

  await seed(STD, [{ start: 420, end: 780 }], 5);
  expect(await facts(page, id)).toMatchObject({ finish: '2026-06-05T13:00' });
  await split('2026-06-05');
  await expect.poll(gaps).toEqual([{ afterMinutes: 1920, gapMinutes: 480, source: 'user' }]);
  expect(await recalc()).toMatchObject({ finish: '2026-06-08T16:00', days: 5 });

  await seed(STD, STD, 2.5, '13:00');
  expect(await facts(page, id)).toMatchObject({ start: '2026-06-01T13:00', finish: '2026-06-04T08:00' });
  await split('2026-06-02');
  await expect.poll(gaps).toEqual([{ afterMinutes: 180, gapMinutes: 480, source: 'user' }]);

  await seed(NIGHT, NIGHT, 2.5, '22:00');
  expect(await facts(page, id)).toMatchObject({ start: '2026-06-01T22:00', finish: '2026-06-04T02:00' });
  await split('2026-06-02');
  await expect.poll(gaps).toEqual([{ afterMinutes: 480, gapMinutes: 480, source: 'user' }]);

  await seed([{ start: 420, end: 930 }], [{ start: 420, end: 930 }], 2.5);
  await split('2026-06-02');
  await expect.poll(gaps).toEqual([{ afterMinutes: 510, gapMinutes: 510, source: 'user' }]);
});

const gridSurface = (page: Page) => page.locator('[data-task-grid-surface-id="full-task-grid"]');
function gridCell(page: Page, id: string, column: string): Locator {
  return gridSurface(page).locator(
    `[data-grid-data-row="true"][data-grid-row-key="${id}"] [data-grid-data-cell="true"][data-grid-column-id="${column}"]`,
  );
}

async function typeDuration(page: Page, id: string, text: string): Promise<void> {
  const cell = gridCell(page, id, 'task.time.scheduleDuration');
  await cell.click();
  await page.keyboard.press('Enter');
  await cell.locator('input').fill(text);
  await page.keyboard.press('Enter');
}

test('F4b: duurinvoer in de Tabel volgens B8 ("5d", "40u", een kaal getal), ook bij vast werk', async ({ page, ops: _ops }) => {
  await setCalendar(page, STD);
  const ids = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ name: 'B8', startDate: '2026-06-01' });
    s.setViewStartDate('2026-06-01');
    const make = (name: string, unit: 'days' | 'hours', amount: number) => {
      const id = s.addTask({ name });
      const t = window.__OPS__!.store.getState().tasks.find(x => x.id === id)!;
      window.__OPS__!.store.getState().updateTask(id, { time: unit === 'days'
        ? { ...t.time, durationUnit: 'days', durationMinutes: undefined, scheduleDuration: amount }
        : { ...t.time, durationUnit: 'hours', durationMinutes: amount, scheduleDuration: amount / 480 } });
      return id;
    };
    const day = make('Dagenmaat', 'days', 2.5);
    const hour = make('Urenmaat', 'hours', 2400);
    const fixed = make('Vast werk', 'hours', 1440);
    const resourceId = s.addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 });
    window.__OPS__!.store.getState().assignResource(fixed, resourceId, 1);
    window.__OPS__!.store.getState().setTaskWorkRule(fixed, 'FIXED_WORK');
    window.__OPS__!.store.getState().runCPM();
    return { day, hour, fixed };
  });
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(gridSurface(page).locator('[role="grid"]')).toBeVisible();
  const cellText = (id: string) => gridCell(page, id, 'task.time.scheduleDuration');

  await expect(cellText(ids.day)).toHaveText('2.5d');
  await expect(cellText(ids.hour)).toHaveText('40h');
  await expect(cellText(ids.fixed)).toHaveText('24h');

  await typeDuration(page, ids.day, '3');
  await expect.poll(() => facts(page, ids.day)).toMatchObject({ unit: 'days', days: 3 });
  await expect(cellText(ids.day)).toHaveText('3d');
  await typeDuration(page, ids.hour, '3');
  await expect.poll(() => facts(page, ids.hour)).toMatchObject({ unit: 'hours', minutes: 180 });
  await expect(cellText(ids.hour)).toHaveText('3h');

  await typeDuration(page, ids.day, '40u');
  await expect.poll(() => facts(page, ids.day)).toMatchObject({ unit: 'hours', minutes: 2400 });
  await expect(cellText(ids.day)).toHaveText('40h');
  await typeDuration(page, ids.hour, '5d');
  await expect.poll(() => facts(page, ids.hour)).toMatchObject({ unit: 'days', days: 5 });
  await expect(cellText(ids.hour)).toHaveText('5d');
  await typeDuration(page, ids.hour, '2,5d');
  await expect.poll(() => facts(page, ids.hour)).toMatchObject({ unit: 'days', days: 2.5 });

  await typeDuration(page, ids.fixed, '5d');
  await expect.poll(() => facts(page, ids.fixed)).toMatchObject({ unit: 'hours', minutes: 2400 });
  await expect(cellText(ids.fixed)).toHaveText('40h');
  await typeDuration(page, ids.fixed, '30');
  await expect.poll(() => facts(page, ids.fixed)).toMatchObject({ unit: 'hours', minutes: 1800 });
  await expect(cellText(ids.fixed)).toHaveText('30h');

  await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ allowMixedDayHour: false, showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(id);
  }, ids.day);
  const panelDuration = page.locator('[data-ops-task-duration] [data-ops-duration-value]').first();
  await expect(panelDuration).toBeEditable();
  await panelDuration.fill('12');
  await panelDuration.press('Enter');
  await expect.poll(() => facts(page, ids.day)).toMatchObject({ unit: 'hours', minutes: 720 });
});

test('F4b: datums in de Tabel volgens B4, met de voorbeelden uit §8', async ({ page, ops: _ops }) => {
  await setCalendar(page, STD);
  const ids = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ dateNotation: 'dmy', timeNotation: '24h' });
    s.setProject({ name: 'B4', startDate: '2026-06-01' });
    s.setViewStartDate('2026-06-01');
    const night = s.addCalendar({
      name: 'Nachtploeg', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 22, workEndHour: 6, hoursPerDay: 8, holidays: [],
      workTime: { byWeekday: { 1: [{ start: 1320, end: 1800 }], 2: [{ start: 1320, end: 1800 }], 3: [{ start: 1320, end: 1800 }], 4: [{ start: 1320, end: 1800 }], 5: [{ start: 1320, end: 1800 }], 6: [], 7: [] } },
    });
    const allDay = [{ start: 0, end: 1440 }];
    const round = window.__OPS__!.store.getState().addCalendar({
      name: '24 uur', description: '', workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 24, holidays: [],
      workTime: { byWeekday: { 1: allDay, 2: allDay, 3: allDay, 4: allDay, 5: allDay, 6: allDay, 7: allDay } },
    });
    const make = (name: string, start: string, finish: string, minutes: number, extra: { milestone?: boolean; calendarId?: string } = {}) => {
      const st = window.__OPS__!.store.getState();
      const id = st.addTask({ name, manuallyScheduled: true });
      const t = window.__OPS__!.store.getState().tasks.find(x => x.id === id)!;
      window.__OPS__!.store.getState().updateTask(id, {
        ...(extra.milestone ? { isMilestone: true } : {}),
        ...(extra.calendarId ? { calendarId: extra.calendarId } : {}),
        time: { ...t.time, durationUnit: 'hours', durationMinutes: minutes, scheduleDuration: minutes / 480,
          scheduleStart: start, scheduleFinish: finish, earlyStart: start, earlyFinish: finish },
      });
      return id;
    };
    return {
      whole: make('Hele dag', '2026-06-03T07:00', '2026-06-03T16:00', 480),
      afterBreak: make('Na de pauze', '2026-06-03T13:00', '2026-06-04T12:00', 480),
      rawAnchor: make('Rauw anker', '2026-06-01T16:00', '2026-06-02T12:00', 300),
      earlyEnd: make('Einde om 07:00', '2026-06-01T13:00', '2026-06-02T07:00', 180),
      a: make('A', '2026-06-01T07:00', '2026-06-03T11:00', 1200),
      b: make('B', '2026-06-03T11:00', '2026-06-05T16:00', 1200),
      msEnd: make('Mijlpaal einde dag', '2026-06-05T16:00', '2026-06-05T16:00', 0, { milestone: true }),
      msStart: make('Mijlpaal begin dag', '2026-06-05T07:00', '2026-06-05T07:00', 0, { milestone: true }),
      msMid: make('Mijlpaal midden', '2026-06-05T11:00', '2026-06-05T11:00', 0, { milestone: true }),
      nightOne: make('Eén nacht', '2026-06-02T22:00', '2026-06-03T06:00', 480, { calendarId: night }),
      nightMid: make('Halve nacht', '2026-06-02T22:00', '2026-06-03T02:00', 240, { calendarId: night }),
      roundClock: make('Kalendertijd', '2026-06-01T00:00', '2026-06-02T00:00', 1440, { calendarId: round }),
    };
  });
  const before = await page.evaluate(() => window.__OPS__!.store.getState().tasks.map(t => [t.time.earlyStart, t.time.earlyFinish]));
  await page.evaluate(() => window.__OPS__!.store.getState().runCPM());
  expect(await page.evaluate(() => { const s = window.__OPS__!.store.getState(); return { stale: s.scheduleStale, error: s.cpmResult?.error ?? null }; })).toEqual({ stale: false, error: null });
  expect(await page.evaluate(() => window.__OPS__!.store.getState().tasks.map(t => [t.time.earlyStart, t.time.earlyFinish]))).toEqual(before);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(gridSurface(page).locator('[role="grid"]')).toBeVisible();
  const expectRow = async (id: string, start: string, finish: string) => {
    await expect(gridCell(page, id, 'task.time.start')).toHaveText(start);
    await expect(gridCell(page, id, 'task.time.finish')).toHaveText(finish);
  };
  await expectRow(ids.whole, '03-06-2026', '03-06-2026');
  await expectRow(ids.afterBreak, '03-06-2026 13:00', '04-06-2026 12:00');
  await expectRow(ids.rawAnchor, '01-06-2026 16:00', '02-06-2026 12:00');
  await expectRow(ids.earlyEnd, '01-06-2026 13:00', '02-06-2026 07:00');
  await expectRow(ids.a, '01-06-2026', '03-06-2026 11:00');
  await expectRow(ids.b, '03-06-2026 11:00', '05-06-2026');
  await expectRow(ids.msEnd, '05-06-2026', '05-06-2026');
  await expectRow(ids.msStart, '05-06-2026', '05-06-2026');
  await expectRow(ids.msMid, '05-06-2026 11:00', '05-06-2026 11:00');
  await expectRow(ids.nightOne, '02-06-2026', '02-06-2026');
  await expectRow(ids.nightMid, '02-06-2026', '03-06-2026 02:00');
  await expectRow(ids.roundClock, '01-06-2026', '01-06-2026');
});

test('F4b: in het veld Start een tijd typen en weer leegmaken (§3.6)', async ({ page, ops: _ops }) => {
  await setCalendar(page, STD);
  const id = await seedDayTask(page, '2026-06-01', 2);
  await page.evaluate(taskId => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(taskId);
  }, id);
  const time = page.locator('input[data-ops-task-date-time-input="start"]');
  const scheduleStart = () => page.evaluate(taskId => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!.time.scheduleStart, id);
  await time.scrollIntoViewIfNeeded();
  await expect(time).toHaveValue('');
  await expect(time).toHaveAttribute('aria-label', 'Time of Start');

  const recalc = async () => {
    await page.locator('[data-ops-rail]').getByText('Start', { exact: true }).first().click();
    await page.keyboard.press('F5');
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  };

  await time.click();
  await page.keyboard.type('13:00');
  await page.keyboard.press('Enter');
  await expect.poll(scheduleStart).toBe('2026-06-01T13:00');
  await recalc();
  await expect(time).toHaveValue('13:00');
  expect(await facts(page, id)).toMatchObject({ start: '2026-06-01T13:00', unit: 'days', days: 2 });

  await time.press('ArrowUp');
  await expect.poll(scheduleStart).toBe('2026-06-01T13:15');

  await time.fill('');
  await page.keyboard.press('Enter');
  await expect.poll(scheduleStart).toBe('2026-06-01T07:00');
  await recalc();
  await expect(time).toHaveValue('');
  expect(await facts(page, id)).toMatchObject({ start: '2026-06-01T07:00', days: 2 });
});
