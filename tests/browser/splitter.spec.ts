// Karakterisering vóór de actuele-refrefactor: de eerste echte move wijzigt leftPanelWidth en
// herrendert daarmee de splittercaller met verse opties. De lopende gesture moet gekoppeld blijven,
// de tweede move toepassen en uitsluitend bij mouseup één persistente commit uitvoeren.
import { expect, seedProject, test } from './fixtures/ops';

test('splitter blijft actief na een mid-drag storeupdate en commit precies eenmaal', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Splitterreeks', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const canvas = page.getByTestId('gantt-primary-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const startWidth = await page.evaluate(() => window.__OPS__!.store.getState().ui.leftPanelWidth);

  await page.evaluate(() => {
    localStorage.removeItem('ops-leftPanelWidth');
    const original = Storage.prototype.setItem;
    const writes: string[] = [];
    (window as typeof window & { __OPS_SPLITTER_WRITES__?: string[] }).__OPS_SPLITTER_WRITES__ = writes;
    Storage.prototype.setItem = function setItem(key: string, value: string): void {
      if (key === 'ops-leftPanelWidth') writes.push(value);
      original.call(this, key, value);
    };
  });

  const start = { x: bounds!.x + startWidth, y: bounds!.y + 24 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y);

  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.leftPanelWidth))
    .toBe(startWidth + 40);
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __OPS_SPLITTER_WRITES__?: string[] }).__OPS_SPLITTER_WRITES__?.length
  ))).toBe(0);

  await page.mouse.move(start.x + 70, start.y);
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.leftPanelWidth))
    .toBe(startWidth + 70);
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __OPS_SPLITTER_WRITES__?: string[] }).__OPS_SPLITTER_WRITES__
  ))).toEqual([String(startWidth + 70)]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ops-leftPanelWidth')))
    .toBe(String(startWidth + 70));
});
