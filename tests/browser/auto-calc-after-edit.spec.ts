// Automatisch berekenen rekent pas als een bewerking voltooid is (eigenaar, 2026-09-24): "hij
// berekent vaak tijdens een muisbeweging en dat is heel irritant". Een balksleep commit bij elke
// mousemove; met alleen een korte debounce draaide de CPM zodra de muis even stilstond, midden in
// het gebaar.
//
// Echte muis-events; de dev-brug zet alleen de fixture en telt de CPM-runs (elke run levert een
// nieuw `cpmResult`-object op).
import type { Page } from '@playwright/test';
import { barPoint, expect, seedProject, test } from './fixtures/ops';

async function countCpmRuns(page: Page): Promise<void> {
  await page.evaluate(() => {
    let runs = 0;
    window.__OPS__!.store.subscribe((next, prev) => { if (next.cpmResult !== prev.cpmResult) runs++; });
    Object.defineProperty(window, '__cpmRuns', { configurable: true, get: () => runs });
    window.__OPS__!.store.getState().setUI({ autoCalcCPM: true });
  });
}
const cpmRuns = (page: Page) => page.evaluate(() => (window as unknown as { __cpmRuns: number }).__cpmRuns);
const stale = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale);

test('automatisch berekenen: niet tijdens een balksleep, wel direct na het loslaten', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [
    { name: 'Sleepbare taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await countCpmRuns(page);
  const point = await barPoint(page, taskId);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 40, point.y, { steps: 4 });
  // Muis even stil, knop nog ingedrukt: vóór de fix rekende hij hier al.
  await page.waitForTimeout(400);
  expect(await cpmRuns(page)).toBe(0);
  expect(await stale(page)).toBe(true);
  await page.mouse.move(point.x + 72, point.y, { steps: 4 });
  await page.waitForTimeout(400);
  expect(await cpmRuns(page)).toBe(0);

  await page.mouse.up();
  await expect.poll(() => cpmRuns(page)).toBe(1);
  expect(await stale(page)).toBe(false);
});

test('automatisch berekenen: de voortgangsschuif rekent pas na het loslaten', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [
    { name: 'Taak met voortgang', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(id);
  }, taskId);
  await countCpmRuns(page);

  const slider = page.locator('[data-ops-progress-slider]');
  await slider.scrollIntoViewIfNeeded();
  await expect(slider).toBeInViewport();
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, y, { steps: 5 });
  await page.waitForTimeout(400);
  expect(await cpmRuns(page)).toBe(0);
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => cpmRuns(page)).toBe(1);
  expect(await stale(page)).toBe(false);
  expect(await page.evaluate((id) => (
    window.__OPS__!.store.getState().tasks.find(task => task.id === id)!.time.completion
  ), taskId)).toBeGreaterThan(0.3);
});
