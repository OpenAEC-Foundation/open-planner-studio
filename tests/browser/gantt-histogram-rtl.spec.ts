import type { Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';
import { box, centerX, chooseLocale, LOCALE_CASES, type Box, type LocaleCase } from './fixtures/locale';

const TOP_PAD = 8;
const ROW_H = 18;

interface Seeded {
  groundworkId: string;
  masonryId: string;
  groundCrewId: string;
  masonCrewId: string;
}

async function seed(page: Page, locale: LocaleCase): Promise<Seeded> {
  const [groundworkId, masonryId] = await seedProject(page, [
    { name: 'Grondwerk', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Metselwerk', start: '2026-09-14', finish: '2026-09-18', durationDays: 5 },
  ]);
  await chooseLocale(page, locale);
  const crews = await page.evaluate(([groundwork, masonry]) => {
    const s = window.__OPS__!.store.getState();
    const groundCrewId = s.addResource({ name: 'Grondploeg', type: 'LABOR', description: '', maxUnits: 2 });
    const masonCrewId = s.addResource({ name: 'Metselploeg', type: 'LABOR', description: '', maxUnits: 2 });
    s.assignResource(groundwork, groundCrewId, 1);
    s.assignResource(masonry, groundCrewId, 1);
    s.assignResource(masonry, masonCrewId, 1);
    s.runCPM();
    s.setZoom(20);
    s.setUI({ showHistogram: true });
    return { groundCrewId, masonCrewId };
  }, [groundworkId, masonryId]);
  await expect(page.getByTestId('gantt-histogram-canvas')).toBeVisible();
  return { groundworkId, masonryId, ...crews };
}

async function histogramRow(page: Page): Promise<{ left: number; colors: string[] }> {
  return page.getByTestId('gantt-histogram-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const y = Math.floor((rect.height - 8) * dpr);
    const data = canvas.getContext('2d')!.getImageData(0, y, canvas.width, 1).data;
    const colors: string[] = [];
    for (let x = 0; x < Math.floor(rect.width); x++) {
      const i = Math.floor((x + 0.5) * dpr) * 4;
      colors.push(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
    }
    return { left: rect.left, colors };
  });
}

function runAround(row: { left: number; colors: string[] }, x: number): { left: number; right: number } {
  const at = Math.floor(x - row.left);
  const color = row.colors[at];
  let from = at;
  let to = at;
  while (from > 0 && row.colors[from - 1] === color) from--;
  while (to < row.colors.length - 1 && row.colors[to + 1] === color) to++;
  return { left: row.left + from, right: row.left + to + 1 };
}

async function waitForQuietHistogram(page: Page): Promise<void> {
  await page.evaluate(async () => { await document.fonts.ready; });
  await expect.poll(async () => {
    const before = await page.evaluate(() => window.__OPS__!.gantt.paintCount('histogram'));
    await page.waitForTimeout(250);
    return (await page.evaluate(() => window.__OPS__!.gantt.paintCount('histogram'))) === before;
  }).toBe(true);
}

for (const locale of LOCALE_CASES) {
  test(`${locale.code}: histogram — dagas valt samen met de tijdlijn, kiezer staat onder de takenlijst`, async ({ page, ops: _ops }) => {
    const seeded = await seed(page, locale);
    const list = await box(page.locator('.gantt-workspace-grid'));
    const timeline = await box(page.locator('.gantt-workspace-timeline'));
    const canvas = page.getByTestId('gantt-histogram-canvas');
    const strip: Box = await box(canvas);
    if (locale.rtl) expect(timeline.right).toBe(list.left);
    else expect(timeline.left).toBe(list.right);
    expect(strip.left).toBe(Math.min(list.left, timeline.left));
    expect(strip.right).toBe(Math.max(list.right, timeline.right));
    await waitForQuietHistogram(page);

    const row = await histogramRow(page);
    const picker = runAround(row, centerX(list));
    expect(Math.abs(picker.left - list.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(picker.right - list.right)).toBeLessThanOrEqual(1);

    const zoom = (await state(page)).view.zoom;
    for (const taskId of [seeded.groundworkId, seeded.masonryId]) {
      const barLeft = (await barPoint(page, taskId, 'left')).x;
      const barRight = (await barPoint(page, taskId, 'right')).x;
      expect(barLeft).toBeGreaterThanOrEqual(timeline.left);
      expect(barRight).toBeLessThanOrEqual(timeline.right);
      const firstDay = runAround(row, barLeft + zoom / 2);
      const lastDay = runAround(row, barRight - zoom / 2);
      const dayBefore = runAround(row, barLeft - zoom / 2);
      expect(row.colors[Math.floor(barLeft + zoom / 2 - row.left)])
        .not.toBe(row.colors[Math.floor(barLeft - zoom / 2 - row.left)]);
      expect(Math.abs(firstDay.left - (barLeft - 7 / 24 * zoom))).toBeLessThanOrEqual(2);
      expect(Math.abs(lastDay.right - (barRight + 8 / 24 * zoom))).toBeLessThanOrEqual(2);
      expect(dayBefore.right).toBeLessThanOrEqual(firstDay.left);
    }

    const rowY = (index: number) => strip.top + TOP_PAD + index * ROW_H + ROW_H / 2;
    await page.mouse.click(centerX(list), rowY(2));
    await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).toBe(seeded.masonCrewId);
    await page.mouse.click(list.left + 24, rowY(1));
    await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).toBe(seeded.groundCrewId);

    const tooltip = page.locator('.gantt-tooltip');
    const y = strip.top + (strip.bottom - strip.top) * 0.6;
    for (const [taskId, name, other] of [
      [seeded.masonryId, 'Metselwerk', 'Grondwerk'],
      [seeded.groundworkId, 'Grondwerk', 'Metselwerk'],
    ] as const) {
      const barLeft = (await barPoint(page, taskId, 'left')).x;
      await page.mouse.move(barLeft + zoom / 2, y, { steps: 4 });
      await expect(tooltip.getByText(name, { exact: true })).toBeVisible();
      await expect(tooltip.getByText(other, { exact: true })).toHaveCount(0);
    }
    await page.mouse.move(strip.left + 4, strip.top - 20);
    await expect(tooltip).toHaveCount(0);
  });

  test(`${locale.code}: histogram — wielscroll boven de kiezer en de verouderd-melding volgen dezelfde geometrie`, async ({ page, ops: _ops }) => {
    await seed(page, locale);
    const extra = await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      const ids: string[] = [];
      for (let i = 1; i <= 30; i++) {
        ids.push(s.addResource({
          name: `Resource ${String(i).padStart(2, '0')}`, type: 'LABOR', description: '', maxUnits: 1,
        }));
      }
      return ids;
    });
    const list = await box(page.locator('.gantt-workspace-grid'));
    const timeline = await box(page.locator('.gantt-workspace-timeline'));
    const strip = await box(page.getByTestId('gantt-histogram-canvas'));

    const y = strip.top + 150;
    await page.mouse.click(list.left + 24, y);
    await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).toBe(extra[4]);
    await page.mouse.move(list.left + 24, strip.top + 80);
    await page.mouse.wheel(0, 5000);
    await waitForQuietHistogram(page);
    await page.mouse.click(list.left + 24, y);
    await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).toBe(extra[extra.length - 1]);

    await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      s.updateTask(s.tasks[0].id, { name: 'Grondwerk (gewijzigd)' });
    });
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(true);
    const hint = page.getByTestId('gantt-histogram').locator('[data-ops-histogram-stale-hint]');
    await expect(hint).toBeVisible();
    const hintBox = await box(hint);
    expect(hintBox.left).toBeGreaterThanOrEqual(timeline.left);
    expect(hintBox.right).toBeLessThanOrEqual(timeline.right);
  });
}
