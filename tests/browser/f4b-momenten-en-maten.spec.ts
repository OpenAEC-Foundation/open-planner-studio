// F4b (spec "alleen uren" §7.2 F4, §3.12 T24, B4, B8, §3.6): het scherm op momenten en maten.
//
// Sinds F2 heeft elke taak momenten, en sinds F3c rekent een dagtaak in het OPS-profiel in de dagenmaat
// (een breuk mag). Deze spec toetst met echte muis- en toetsenbordevents:
//  1. slepen van een dagenmaat-taak van 2,5 d: bij de voorinstelling Dag per hele werkdag (de breuk blijft),
//     bij Uur per uur; een volgende berekening verplaatst de balk niet;
//  2. splitsen en stukslepen bij dagzoom op de dagslot-as van de dagenmaat (één werkdag = één dagslot,
//     ook een korte vrijdag, een nachtploeg en een dag van 8,5 u; een start ma 13:00 splitst di na 0,375 d);
//  3. duurinvoer in de Tabel volgens B8: "5d", "40u" en een kaal getal, ook bij vast werk; een urenmaat-taak
//     is in het paneel te bewerken;
//  4. datums in de Tabel volgens B4, met de voorbeelden uit §8;
//  5. datuminvoer (§3.6): een tijd typen en weer leegmaken in het veld Start.
// De `__OPS__`-brug zet alleen fixtures en leest state; de geteste handelingen zijn echte events.
import type { Locator, Page } from '@playwright/test';
import { barPoint, expect, test } from './fixtures/ops';

type Band = { start: number; end: number };
const STD: Band[] = [{ start: 420, end: 720 }, { start: 780, end: 960 }];

/** De projectkalender: ma–vr met de gegeven blokken, vrijdag apart. */
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

/** Een dagenmaat-taak van `days` d, berekend vanaf de projectstart (geen handmatige planning). */
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

/** Een balkpunt dat over twee peilingen niet meer beweegt en waartussen geen paint viel. */
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

/** Schuif de tijdlijn zodat het grijppunt vlak bij de linkerrand van de Gantt staat (de Gantt is smal
 *  naast het raster), en geef dat punt: de balk 30 px na zijn linkerrand, of de rechterrand. */
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
  // De eindpixel van de balk is fractioneel: grijp de rechterrand twee pixels binnen de rand.
  return edge === 'body' ? { x: p.x + 30, y: p.y } : { x: p.x - 2, y: p.y };
}

/** Sleep de balk of de rechterrand `dx` pixels, met de cursor als bewijs dat het gebaar de balk greep. */
async function dragBar(page: Page, id: string, edge: 'body' | 'right', dx: number): Promise<void> {
  const p = await grabPoint(page, id, edge);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', edge === 'body' ? 'grabbing' : 'ew-resize');
  await page.mouse.move(p.x + dx, p.y, { steps: 6 });
  await page.mouse.up();
}

/** Kies een voorinstelling van de tijdschaal zoals een planner dat doet: Beeld → Tijdschaal ▼ → optie. */
async function choosePreset(page: Page, preset: RegExp, zoom: number, id: string): Promise<void> {
  await page.locator('.ribbon-tab').filter({ hasText: /^(View|Beeld)$/ }).click();
  await page.locator('[data-tour-anchor="ribbon-group:beeld:timeScale"] button').filter({ hasText: /▼/ }).click();
  await page.getByRole('button', { name: preset, exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().view.zoom)).toBe(zoom);
  await page.evaluate(() => window.__OPS__!.store.getState().setViewStartDate('2026-09-01'));
  await settledPoint(page, id, 'body');
}

test('F4b: een dagenmaat-taak van 2,5 d sleept bij Dag per werkdag en bij Uur per uur, en houdt de breuk', async ({ page, ops: _ops }) => {
  await setCalendar(page, STD);
  let id = await seedDayTask(page, '2026-09-07', 2.5);
  // De motor: 2,5 d vanaf ma 07:00 eindigt wo 11:00 (de helft van de werkdag van wo).
  expect(await facts(page, id)).toMatchObject({ start: '2026-09-07T07:00', finish: '2026-09-09T11:00', unit: 'days', days: 2.5 });

  await choosePreset(page, /^(Day|Dag)$/, 100, id);
  // Bij dagzoom verschuift een sleep van een uur breed niets: de stap is een hele werkdag.
  await dragBar(page, id, 'body', 100 / 24);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-09-07T07:00', finish: '2026-09-09T11:00', days: 2.5 });
  // Eén dag naar rechts: de balk schuift één werkdag op en houdt de breuk.
  await dragBar(page, id, 'body', 100);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-09-08T07:00', finish: '2026-09-10T11:00', unit: 'days', days: 2.5 });
  // De rechterrand één dag verder: 3,5 d, niet 4 d.
  await dragBar(page, id, 'right', 100);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-09-08T07:00', finish: '2026-09-11T11:00', unit: 'days', days: 3.5 });
  // Een berekening verplaatst de balk niet: het einde komt uit dezelfde dagenmaat-lopers als de motor.
  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  expect(await facts(page, id)).toMatchObject({ start: '2026-09-08T07:00', finish: '2026-09-11T11:00', days: 3.5 });

  // Uur: een nieuwe taak van 2,5 d vanaf di 07:00.
  await page.evaluate(() => window.__OPS__!.store.getState().newProject());
  await setCalendar(page, STD);
  id = await seedDayTask(page, '2026-09-08', 2.5);
  await choosePreset(page, /^(Hour|Uur)$/, 1000, id);
  // De rechterrand een uur verder: do 11:00 → 12:00 is 1/8 werkdag, dus 2,625 d.
  await dragBar(page, id, 'right', 1000 / 24);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-09-08T07:00', finish: '2026-09-10T12:00', unit: 'days', days: 2.625 });
  // De balk een uur verder: de duur blijft 2,625 d; het einde schuift over de middagpauze naar 14:00.
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

  // Standaardkalender: 2,5 d vanaf ma; een klik op di geeft een pauze van één werkdag na één werkdag.
  await seed(STD, STD, 2.5);
  await split('2026-06-02');
  await expect.poll(gaps).toEqual([{ afterMinutes: 480, gapMinutes: 480, source: 'user' }]);
  expect(await recalc()).toMatchObject({ finish: '2026-06-04T11:00', days: 2.5, unit: 'days' });
  await expect.poll(() => page.evaluate(taskId => window.__OPS__!.gantt.taskSegmentCount(taskId), id)).toBe(2);
  // Stuk 2 van wo naar do: de pauze wordt twee werkdagen (960 dagslotminuten); terug naar di: samenvoegen.
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

  // Korte vrijdag (6 u): de vrijdag is één werkdag, dus één dagslot (480), niet 360 werkminuten.
  await seed(STD, [{ start: 420, end: 780 }], 5);
  expect(await facts(page, id)).toMatchObject({ finish: '2026-06-05T13:00' });
  await split('2026-06-05');
  await expect.poll(gaps).toEqual([{ afterMinutes: 1920, gapMinutes: 480, source: 'user' }]);
  expect(await recalc()).toMatchObject({ finish: '2026-06-08T16:00', days: 5 });

  // Start ma 13:00: de split op di valt na de rest van ma, 0,375 d = 180 dagslotminuten.
  await seed(STD, STD, 2.5, '13:00');
  expect(await facts(page, id)).toMatchObject({ start: '2026-06-01T13:00', finish: '2026-06-04T08:00' });
  await split('2026-06-02');
  await expect.poll(gaps).toEqual([{ afterMinutes: 180, gapMinutes: 480, source: 'user' }]);

  // Nachtploeg ma–vr 22:00–06:00: een klik op di overdag valt op de ploeg van di; de split komt na de
  // hele ploeg van ma.
  await seed(NIGHT, NIGHT, 2.5, '22:00');
  expect(await facts(page, id)).toMatchObject({ start: '2026-06-01T22:00', finish: '2026-06-04T02:00' });
  await split('2026-06-02');
  await expect.poll(gaps).toEqual([{ afterMinutes: 480, gapMinutes: 480, source: 'user' }]);

  // Een dag van 8,5 u: één dagslot is 510 minuten, zonder afronding op het uur.
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

  // De weergave: een dagenmaat-taak in d (met de breuk), een urenmaat-taak in h (en: "u" in nl).
  await expect(cellText(ids.day)).toHaveText('2.5d');
  await expect(cellText(ids.hour)).toHaveText('40h');
  await expect(cellText(ids.fixed)).toHaveText('24h');

  // Een kaal getal houdt de maat: 3 bij een dagenmaat-taak is 3 d, bij een urenmaat-taak 3 u.
  await typeDuration(page, ids.day, '3');
  await expect.poll(() => facts(page, ids.day)).toMatchObject({ unit: 'days', days: 3 });
  await expect(cellText(ids.day)).toHaveText('3d');
  await typeDuration(page, ids.hour, '3');
  await expect.poll(() => facts(page, ids.hour)).toMatchObject({ unit: 'hours', minutes: 180 });
  await expect(cellText(ids.hour)).toHaveText('3h');

  // "40u" maakt een dagenmaat-taak urenmaat; "5d" maakt een urenmaat-taak dagenmaat.
  await typeDuration(page, ids.day, '40u');
  await expect.poll(() => facts(page, ids.day)).toMatchObject({ unit: 'hours', minutes: 2400 });
  await expect(cellText(ids.day)).toHaveText('40h');
  await typeDuration(page, ids.hour, '5d');
  await expect.poll(() => facts(page, ids.hour)).toMatchObject({ unit: 'days', days: 5 });
  await expect(cellText(ids.hour)).toHaveText('5d');
  // Een breuk mag, voor iedereen.
  await typeDuration(page, ids.hour, '2,5d');
  await expect.poll(() => facts(page, ids.hour)).toMatchObject({ unit: 'days', days: 2.5 });

  // Vast werk is altijd urenmaat (B1a): "5d" wordt 5 × 8 u = 40 u, en een kaal getal is uren.
  await typeDuration(page, ids.fixed, '5d');
  await expect.poll(() => facts(page, ids.fixed)).toMatchObject({ unit: 'hours', minutes: 2400 });
  await expect(cellText(ids.fixed)).toHaveText('40h');
  await typeDuration(page, ids.fixed, '30');
  await expect.poll(() => facts(page, ids.fixed)).toMatchObject({ unit: 'hours', minutes: 1800 });
  await expect(cellText(ids.fixed)).toHaveText('30h');

  // Een urenmaat-taak is in het paneel te bewerken (de oude blokkade is weg), ook zonder gemengde planning.
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
  // Bereken, zodat de cellen niet als verouderd gemarkeerd staan; handmatig geplande taken houden hun momenten.
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
  // Een planning in hele dagen ziet eruit zoals vroeger: alleen datums.
  await expectRow(ids.whole, '03-06-2026', '03-06-2026');
  // Een start na de pauze en een einde vóór de pauze: met tijd.
  await expectRow(ids.afterBreak, '03-06-2026 13:00', '04-06-2026 12:00');
  // Een start om 16:00 (een rauw anker) en een einde om 07:00: met tijd.
  await expectRow(ids.rawAnchor, '01-06-2026 16:00', '02-06-2026 12:00');
  await expectRow(ids.earlyEnd, '01-06-2026 13:00', '02-06-2026 07:00');
  // A en B uit B2: het einde van A en de start van B midden op wo vallen op door de tijd.
  await expectRow(ids.a, '01-06-2026', '03-06-2026 11:00');
  await expectRow(ids.b, '03-06-2026 11:00', '05-06-2026');
  // Een mijlpaal toont geen tijd op een van beide dagranden, wel midden op de dag.
  await expectRow(ids.msEnd, '05-06-2026', '05-06-2026');
  await expectRow(ids.msStart, '05-06-2026', '05-06-2026');
  await expectRow(ids.msMid, '05-06-2026 11:00', '05-06-2026 11:00');
  // Nachtploeg: het blok hoort bij de dag waarop het begint; één nacht is "di – di".
  await expectRow(ids.nightOne, '02-06-2026', '02-06-2026');
  await expectRow(ids.nightMid, '02-06-2026', '03-06-2026 02:00');
  // De 24:00-regel: een einde om 00:00 dat de dag ervoor sluit, toont die dag zonder tijd.
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
  // Een start op het begin van de werkdag toont geen tijd (B4).
  await expect(time).toHaveValue('');
  await expect(time).toHaveAttribute('aria-label', 'Time of Start');

  // Het veld toont de berekende start; na een bewerking rekent F5 (de planning is handmatig, niet reactief).
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

  // De pijltjestoets zet een kwartier later.
  await time.press('ArrowUp');
  await expect.poll(scheduleStart).toBe('2026-06-01T13:15');

  // Leegmaken: de datum zonder tijd, dus het begin van de werkdag (D1).
  await time.fill('');
  await page.keyboard.press('Enter');
  await expect.poll(scheduleStart).toBe('2026-06-01T07:00');
  await recalc();
  await expect(time).toHaveValue('');
  expect(await facts(page, id)).toMatchObject({ start: '2026-06-01T07:00', days: 2 });
});
