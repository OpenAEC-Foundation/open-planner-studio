// Karakterisering vóór de actuele-refrefactor: de eerste echte move wijzigt leftPanelWidth en
// herrendert daarmee de splittercaller met verse opties. De lopende gesture moet gekoppeld blijven,
// de tweede move toepassen en uitsluitend bij mouseup één persistente commit uitvoeren.
import { expect, seedProject, test } from './fixtures/ops';

test('splitter blijft actief na een mid-drag storeupdate en commit precies eenmaal', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Splitterreeks', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const splitter = page.getByTestId('gantt-workspace-splitter');
  const bounds = await splitter.boundingBox();
  expect(bounds).not.toBeNull();
  const workspaceBounds = await page.getByTestId('gantt-workspace').boundingBox();
  expect(workspaceBounds).not.toBeNull();
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

  const start = { x: bounds!.x + bounds!.width / 2, y: bounds!.y + 24 };
  const pointerBaseWidth = Math.round(start.x - workspaceBounds!.x);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y);

  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.leftPanelWidth))
    .toBe(pointerBaseWidth + 40);
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __OPS_SPLITTER_WRITES__?: string[] }).__OPS_SPLITTER_WRITES__?.length
  ))).toBe(0);

  await page.mouse.move(start.x + 70, start.y);
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.leftPanelWidth))
    .toBe(pointerBaseWidth + 70);
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __OPS_SPLITTER_WRITES__?: string[] }).__OPS_SPLITTER_WRITES__
  ))).toEqual([String(pointerBaseWidth + 70)]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ops-leftPanelWidth')))
    .toBe(String(pointerBaseWidth + 70));
});
