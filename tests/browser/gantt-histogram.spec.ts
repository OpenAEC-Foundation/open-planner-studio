// Karakterisering vóór histograminteractie-extractie. De picker, plot en splitter worden op hun
// echte canvas-/DOM-coördinaten bediend; state en painttellers worden uitsluitend geobserveerd.
import type { Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

async function seedResourceLoad(page: Page): Promise<{
  taskIds: string[];
  overId: string;
  spareId: string;
}> {
  const taskIds = await seedProject(page, [
    { name: 'Overbelaste bijdrage A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Overbelaste bijdrage B', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const resources = await page.evaluate(([firstTask, secondTask]) => {
    const s = window.__OPS__!.store.getState();
    const overId = s.addResource({
      name: 'Krappe ploeg', type: 'LABOR', description: '', maxUnits: 1,
    });
    const spareId = s.addResource({
      name: 'Ruime ploeg', type: 'LABOR', description: '', maxUnits: 4,
    });
    s.assignResource(firstTask, overId, 1);
    s.assignResource(secondTask, overId, 1);
    s.assignResource(firstTask, spareId, 0.5);
    s.setUI({ showHistogram: true });
    return { overId, spareId };
  }, taskIds);
  await expect(page.getByTestId('gantt-histogram-canvas')).toBeVisible();
  return { taskIds, ...resources };
}

async function digest(page: Page): Promise<string> {
  return page.getByTestId('gantt-histogram-canvas')
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png'));
}

async function clickPickerRow(page: Page, index: number): Promise<void> {
  // HistogramRenderer: TOP_PAD=8, ROW_H=18 bij de standaard fontschaal.
  await page.getByTestId('gantt-histogram-canvas').click({
    position: { x: 24, y: 8 + index * 18 + 9 },
  });
}

async function waitForTwoQuietWindows(page: Page): Promise<number> {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(500);
  const first = await page.evaluate(() => window.__OPS__!.gantt.paintCount('histogram'));
  await page.waitForTimeout(500);
  const second = await page.evaluate(() => window.__OPS__!.gantt.paintCount('histogram'));
  expect(second).toBe(first);
  return second;
}

test('histogram picker wisselt echte resourceserie en plotklik toont bijdragers', async ({ page, ops: _ops }) => {
  const { taskIds, overId, spareId } = await seedResourceLoad(page);
  const load = await page.evaluate(({ over, spare }) => {
    const result = window.__OPS__!.store.getState().resourceLoadResult!;
    return {
      overDays: result.overallocatedDays[over] ?? [],
      spareDays: result.overallocatedDays[spare] ?? [],
    };
  }, { over: overId, spare: spareId });
  expect(load.overDays.length).toBeGreaterThan(0);
  expect(load.spareDays).toEqual([]);

  const allDigest = await digest(page);
  await clickPickerRow(page, 1);
  await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).toBe(overId);
  await expect.poll(() => digest(page)).not.toBe(allDigest);
  const overDigest = await digest(page);

  await clickPickerRow(page, 2);
  await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).toBe(spareId);
  await expect.poll(() => digest(page)).not.toBe(overDigest);

  await clickPickerRow(page, 1);
  await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).toBe(overId);
  const taskStart = await barPoint(page, taskIds[0], 'left');
  const canvas = page.getByTestId('gantt-histogram-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await canvas.click({
    position: {
      x: taskStart.x - bounds!.x + 5,
      y: Math.min(70, bounds!.height / 2),
    },
  });

  await expect(page.getByText(/^(2 taken dragen bij op|2 tasks contribute on)/)).toBeVisible();
  await expect(page.getByText('Overbelaste bijdrage A', { exact: true })).toBeVisible();
  await expect(page.getByText('Overbelaste bijdrage B', { exact: true })).toBeVisible();
});

test('taakselectie beperkt resourcedock en histogram en wissen herstelt beide', async ({ page, ops: _ops }) => {
  const taskIds = await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Afwerking', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(([foundationId, finishingId]) => {
    const s = window.__OPS__!.store.getState();
    const bricklayerId = s.addResource({ name: 'Metselaar taak 73', type: 'LABOR', description: '', maxUnits: 2 });
    const craneId = s.addResource({ name: 'Kraan taak 73', type: 'EQUIPMENT', description: '', maxUnits: 1 });
    const painterId = s.addResource({ name: 'Schilder taak 73', type: 'LABOR', description: '', maxUnits: 2 });
    s.assignResource(foundationId, bricklayerId, 1);
    s.assignResource(foundationId, craneId, 1);
    s.assignResource(finishingId, painterId, 1);
    s.runCPM();
    s.setUI({ showResourcePanel: true, resourcePanelDocked: true, showHistogram: true });
  }, taskIds);

  const resourceDock = page.locator('[data-ops-rail-panel="resources"]');
  const dockResource = (name: string) => resourceDock.getByText(name, { exact: true });
  await expect(dockResource('Metselaar taak 73')).toBeVisible();
  await expect(dockResource('Kraan taak 73')).toBeVisible();
  await expect(dockResource('Schilder taak 73')).toBeVisible();
  const unfilteredHistogram = await digest(page);

  const foundation = await barPoint(page, taskIds[0], 'body');
  const gantt = page.getByTestId('gantt-primary-canvas');
  const ganttBounds = await gantt.boundingBox();
  expect(ganttBounds).not.toBeNull();
  await gantt.click({ position: { x: foundation.x - ganttBounds!.x, y: foundation.y - ganttBounds!.y } });

  await expect.poll(() => state(page).then(snapshot => snapshot.selectedTaskIds)).toEqual([taskIds[0]]);
  await expect(dockResource('Metselaar taak 73')).toBeVisible();
  await expect(dockResource('Kraan taak 73')).toBeVisible();
  await expect(dockResource('Schilder taak 73')).toHaveCount(0);
  await expect.poll(() => digest(page)).not.toBe(unfilteredHistogram);

  await gantt.click({ position: { x: ganttBounds!.width - 40, y: ganttBounds!.height - 40 } });
  await expect.poll(() => state(page).then(snapshot => snapshot.selectedTaskIds)).toEqual([]);
  await expect(dockResource('Schilder taak 73')).toBeVisible();
});

test('histogram splitter persisteert pas bij mouseup en paints worden weer stil', async ({ page, ops: _ops }) => {
  await seedResourceLoad(page);
  await waitForTwoQuietWindows(page);
  const before = await state(page);
  const savedBefore = await page.evaluate(() => localStorage.getItem('ops-histogramHeight'));
  const splitter = page.locator('.histogram-splitter');
  const bounds = await splitter.boundingBox();
  expect(bounds).not.toBeNull();

  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y - 44, { steps: 4 });
  await expect.poll(() => state(page).then(s => s.ui.histogramHeight)).toBeGreaterThan(before.ui.histogramHeight);
  expect(await page.evaluate(() => localStorage.getItem('ops-histogramHeight'))).toBe(savedBefore);
  await page.mouse.up();

  const height = (await state(page)).ui.histogramHeight;
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ops-histogramHeight')))
    .toBe(String(height));
  await expect.poll(() => page.evaluate(() => window.__OPS__!.gantt.lastSize('histogram')?.height))
    .toBe(height);
  await waitForTwoQuietWindows(page);
});
