// Slepen bij Dag volgt de getekende as, de taakkalender en de splitsom (aanval na #600, a09).
//
// Met echte muisgebaren:
//  1. een taak met een eigen kalender van zeven dagen op een project van ma–vr, onder werkdagencompressie:
//     één kolom na vrijdag is maandag (de getekende as), niet zaterdag (fout 1, `dragWorkdaySteps`);
//  2. een kalendertijdtaak (ELAPSEDTIME) van 2 d schuift één dag op de klok: di 00:00 – do 00:00, geen
//     werkuren (fout 2, `ELAPSED_DRAG_CLOCK`);
//  3. een gesplitste dagtaak (4 d, een pauze van één dag na de eerste dag): de linkerrand één dag naar rechts
//     geeft di – vr met 3 d, en de body van het eerste stuk houdt de pauze in het einde (fout 3, de splitsom).
// Na elk gebaar verplaatst een berekening (F5) de balk niet, en elk gebaar is één undo-stap.
// De `__OPS__`-brug zet alleen fixtures en leest state; de geteste handelingen zijn echte events.
import type { Page } from '@playwright/test';
import { expect, state, test } from './fixtures/ops';

test.use({ viewport: { width: 1600, height: 900 } });

type Band = { start: number; end: number };
const STD: Band[] = [{ start: 420, end: 720 }, { start: 780, end: 960 }];

interface Facts { start?: string; finish?: string; days: number; gaps: unknown }

async function facts(page: Page, id: string): Promise<Facts> {
  return page.evaluate(taskId => {
    const t = window.__OPS__!.store.getState().tasks.find(x => x.id === taskId)!;
    return { start: t.time.earlyStart, finish: t.time.earlyFinish, days: t.time.scheduleDuration, gaps: t.splitGaps ?? null };
  }, id);
}

/** Projectkalender ma–vr met een middagpauze, Gantt bij Dag (100 px per dag). */
async function setup(page: Page, compress: boolean, projectStart: string): Promise<void> {
  await page.evaluate(({ compress, projectStart, bands }) => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ compressNonWorkdays: compress, showPropertiesPanel: false, rightPanelCollapsed: true, barSplitMode: 'never', showSplitMode: false });
    s.setProject({ name: 'Slepen op de taakkalender', startDate: projectStart });
    s.setCalendar({
      ...s.calendar, workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
      workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
    });
    s.setZoom(100);
  }, { compress, projectStart, bands: STD });
}

/** Een dagtaak van `days` d vanaf de projectstart, berekend (geen handmatige planning). */
async function seedTask(page: Page, days: number, extra: { elapsed?: boolean; calendarId?: string; start?: string } = {}): Promise<string> {
  return page.evaluate(({ days, elapsed, calendarId, start }) => {
    const s = window.__OPS__!.store.getState();
    const id = s.addTask({ name: `Taak ${days} d`, manuallyScheduled: false });
    const task = window.__OPS__!.store.getState().tasks.find(x => x.id === id)!;
    window.__OPS__!.store.getState().updateTask(id, {
      ...(calendarId ? { calendarId } : {}),
      time: {
        ...task.time, durationType: elapsed ? 'ELAPSEDTIME' : task.time.durationType,
        durationUnit: 'days', durationMinutes: undefined, scheduleDuration: days,
        ...(start ? { scheduleStart: start, earlyStart: start } : {}),
      },
    });
    window.__OPS__!.store.getState().runCPM();
    return id;
  }, { days, elapsed: extra.elapsed ?? false, calendarId: extra.calendarId, start: extra.start });
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

/** Schuif de tijdlijn zodat de linkerrand van de balk vlak bij de linkerrand van de Gantt staat (de Gantt is
 *  smal naast het raster), en geef die linkerrand zodra de balk stilstaat. */
async function showBar(page: Page, id: string): Promise<{ x: number; y: number }> {
  await page.evaluate(() => window.__OPS__!.store.getState().setViewStartDate('2026-05-25'));
  const paints = await page.evaluate(() => window.__OPS__!.gantt.paintCount('primary'));
  const moved = await page.evaluate(taskId => {
    const s = window.__OPS__!.store.getState();
    const point = window.__OPS__!.gantt.taskBarPoint(taskId, 'left', 'primary');
    const canvas = document.querySelector('[data-testid="gantt-primary-canvas"]')!.getBoundingClientRect();
    if (!point) return false;
    const before = s.view.scrollX;
    s.setScroll(Math.max(0, before + point.x - canvas.left - 120), 0);
    return window.__OPS__!.store.getState().view.scrollX !== before;
  }, id);
  if (moved) await expect.poll(() => page.evaluate(() => window.__OPS__!.gantt.paintCount('primary'))).toBeGreaterThan(paints);
  return settledPoint(page, id, 'left');
}

/** Het grijppunt: de body 30 px na de linkerrand (het eerste stuk van een gesplitste balk), of de linkerrand. */
async function grabPoint(page: Page, id: string, edge: 'body' | 'left'): Promise<{ x: number; y: number }> {
  const p = await showBar(page, id);
  // De beginpixel van de balk is fractioneel: grijp de linkerrand twee pixels binnen de rand.
  return edge === 'body' ? { x: p.x + 30, y: p.y } : { x: p.x + 2, y: p.y };
}

/** Sleep de balk of de linkerrand `dx` pixels, met de cursor als bewijs dat het gebaar de balk greep. */
async function drag(page: Page, id: string, edge: 'body' | 'left', dx: number): Promise<void> {
  const p = await grabPoint(page, id, edge);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', edge === 'body' ? 'grabbing' : 'ew-resize');
  await page.mouse.move(p.x + dx, p.y, { steps: 6 });
  await page.mouse.up();
}

/** Bereken (F5) en lees daarna dezelfde feiten: een volgende berekening verplaatst de balk niet. */
async function recalculated(page: Page, id: string): Promise<Facts> {
  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  return facts(page, id);
}

test('Dag onder werkdagencompressie: een taak met een eigen kalender gaat naar de getekende maandag', async ({ page, ops: _ops }) => {
  await setup(page, true, '2026-06-05');
  const sevenId = await page.evaluate(bands => window.__OPS__!.store.getState().addCalendar({
    name: 'Zeven dagen', description: '', workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
    workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: bands, 7: bands } },
  }), STD);
  const id = await seedTask(page, 1, { calendarId: sevenId });
  expect(await facts(page, id)).toMatchObject({ start: '2026-06-05T07:00', finish: '2026-06-05T16:00', days: 1 });

  // Eén kolom naar rechts. Zaterdag en zondag van het project zijn weggevouwen: de volgende kolom is maandag.
  await drag(page, id, 'body', 100);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-06-08T07:00', finish: '2026-06-08T16:00', days: 1 });
  expect(await recalculated(page, id)).toMatchObject({ start: '2026-06-08T07:00', finish: '2026-06-08T16:00', days: 1 });
});

test('Dag: een kalendertijdtaak schuift op de klok, niet op werkuren', async ({ page, ops: _ops }) => {
  await setup(page, false, '2026-06-01');
  const id = await seedTask(page, 2, { elapsed: true, start: '2026-06-01T00:00' });
  expect(await facts(page, id)).toMatchObject({ start: '2026-06-01T00:00', finish: '2026-06-03T00:00', days: 2 });

  await drag(page, id, 'body', 100);
  // 48 klokuren, van middernacht tot middernacht; geen 07:00 – 16:00.
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-06-02T00:00', finish: '2026-06-04T00:00', days: 2 });
  expect(await recalculated(page, id)).toMatchObject({ start: '2026-06-02T00:00', finish: '2026-06-04T00:00', days: 2 });
});

test('Dag: de linkerrand en het eerste stuk van een gesplitste dagtaak volgen de splitsom', async ({ page, ops: _ops }) => {
  await setup(page, false, '2026-06-01');
  const id = await seedTask(page, 4);
  await page.evaluate(taskId => {
    const s = window.__OPS__!.store.getState();
    s.setTaskSplits(taskId, [{ kind: 'work', minutes: 480 }, { kind: 'gap', minutes: 480, source: 'user' }, { kind: 'work', minutes: 1440 }]);
    window.__OPS__!.store.getState().runCPM();
  }, id);
  const gaps = [{ afterMinutes: 480, gapMinutes: 480, source: 'user' }];
  // Ma werk, di pauze, wo–vr werk.
  const before = { start: '2026-06-01T07:00', finish: '2026-06-05T16:00', days: 4, gaps };
  expect(await facts(page, id)).toMatchObject(before);
  await showBar(page, id);
  await expect.poll(() => page.evaluate(taskId => window.__OPS__!.gantt.taskSegmentCount(taskId), id)).toBe(2);

  // De linkerrand één dag naar rechts: di werk, wo pauze, do–vr werk. Het einde blijft vrijdag.
  const depth0 = (await state(page)).undoDepth;
  await drag(page, id, 'left', 100);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-06-02T07:00', finish: '2026-06-05T16:00', days: 3, gaps });
  expect((await state(page)).undoDepth).toBe(depth0 + 1);
  expect(await recalculated(page, id)).toMatchObject({ start: '2026-06-02T07:00', finish: '2026-06-05T16:00', days: 3, gaps });

  // Eén gebaar is één undo-stap; de berekening zelf staat niet op de undo-stapel.
  await page.keyboard.press('Control+z');
  await expect.poll(() => facts(page, id)).toMatchObject(before);
  expect((await state(page)).undoDepth).toBe(depth0);

  // De body van het eerste stuk één dag naar rechts: de pauze zit ook direct na het loslaten in het einde.
  await drag(page, id, 'body', 100);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-06-02T07:00', finish: '2026-06-08T16:00', days: 4, gaps });
  expect(await recalculated(page, id)).toMatchObject({ start: '2026-06-02T07:00', finish: '2026-06-08T16:00', days: 4, gaps });
});
