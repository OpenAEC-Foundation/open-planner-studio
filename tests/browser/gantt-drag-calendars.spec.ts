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

async function showBar(page: Page, id: string): Promise<{ x: number; y: number }> {
  await page.evaluate(() => window.__OPS__!.store.getState().setViewStartDate('2026-05-25'));
  await settledPoint(page, id, 'left');
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

async function grabPoint(page: Page, id: string, edge: 'body' | 'left'): Promise<{ x: number; y: number }> {
  const p = await showBar(page, id);
  return edge === 'body' ? { x: p.x + 30, y: p.y } : { x: p.x + 2, y: p.y };
}

async function drag(page: Page, id: string, edge: 'body' | 'left', dx: number): Promise<void> {
  const p = await grabPoint(page, id, edge);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', edge === 'body' ? 'grabbing' : 'ew-resize');
  await page.mouse.move(p.x + dx, p.y, { steps: 6 });
  await page.mouse.up();
}

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

  await drag(page, id, 'body', 100);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-06-08T07:00', finish: '2026-06-08T16:00', days: 1 });
  expect(await recalculated(page, id)).toMatchObject({ start: '2026-06-08T07:00', finish: '2026-06-08T16:00', days: 1 });
});

test('Dag: een kalendertijdtaak schuift op de klok, niet op werkuren', async ({ page, ops: _ops }) => {
  await setup(page, false, '2026-06-01');
  const id = await seedTask(page, 2, { elapsed: true, start: '2026-06-01T00:00' });
  expect(await facts(page, id)).toMatchObject({ start: '2026-06-01T00:00', finish: '2026-06-03T00:00', days: 2 });

  await drag(page, id, 'body', 100);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-06-02T00:00', finish: '2026-06-04T00:00', days: 2 });
  expect(await recalculated(page, id)).toMatchObject({ start: '2026-06-02T00:00', finish: '2026-06-04T00:00', days: 2 });

  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ schedulingProfile: { baseId: 'p6', id: 'p6', name: '', overrides: {} } });
    s.setUI({ durationDisplay: 'hours' });
    const original = CanvasRenderingContext2D.prototype.fillText;
    const drawn: string[] = [];
    CanvasRenderingContext2D.prototype.fillText = function fillText(text: string, x: number, y: number, maxWidth?: number) {
      if (this.canvas.dataset.testid === 'gantt-primary-canvas') drawn.push(String(text));
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(window, '__opsDragText', { configurable: true, value: drawn });
  });
  const p = await grabPoint(page, id, 'left');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', 'ew-resize');
  await page.mouse.move(p.x + 100, p.y, { steps: 6 });
  await expect.poll(() => facts(page, id)).toMatchObject({ days: 1 });
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __opsDragText?: string[] }).__opsDragText?.includes('24h') ?? false)).toBe(true);
  await page.mouse.up();
  expect(await facts(page, id)).toMatchObject({ start: '2026-06-03T00:00', finish: '2026-06-04T00:00', days: 1 });
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
  const before = { start: '2026-06-01T07:00', finish: '2026-06-05T16:00', days: 4, gaps };
  expect(await facts(page, id)).toMatchObject(before);
  await showBar(page, id);
  await expect.poll(() => page.evaluate(taskId => window.__OPS__!.gantt.taskSegmentCount(taskId), id)).toBe(2);

  const depth0 = (await state(page)).undoDepth;
  await drag(page, id, 'left', 100);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-06-02T07:00', finish: '2026-06-05T16:00', days: 3, gaps });
  expect((await state(page)).undoDepth).toBe(depth0 + 1);
  expect(await recalculated(page, id)).toMatchObject({ start: '2026-06-02T07:00', finish: '2026-06-05T16:00', days: 3, gaps });

  await page.keyboard.press('Control+z');
  await expect.poll(() => facts(page, id)).toMatchObject(before);
  expect((await state(page)).undoDepth).toBe(depth0);

  await drag(page, id, 'body', 100);
  await expect.poll(() => facts(page, id)).toMatchObject({ start: '2026-06-02T07:00', finish: '2026-06-08T16:00', days: 4, gaps });
  expect(await recalculated(page, id)).toMatchObject({ start: '2026-06-02T07:00', finish: '2026-06-08T16:00', days: 4, gaps });
});
