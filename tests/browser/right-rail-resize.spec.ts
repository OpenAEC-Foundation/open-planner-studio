import { expect, seedProject, test } from './fixtures/ops';

async function showRail(page: Parameters<typeof seedProject>[0]): Promise<void> {
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({
      showPropertiesPanel: true,
      rightPanelCollapsed: false,
      rightPanelWidth: 360,
    });
  });
  await expect(page.locator('[data-ops-rail]')).toBeVisible();
}

test('rechterrail pakt een breedtesleep vanaf de zichtbare LTR-scheidingsrand', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Railrand LTR', start: '2026-09-07', finish: '2026-09-18' }]);
  await showRail(page);

  const before = await page.evaluate(() => {
    const rail = document.querySelector('[data-ops-rail]')!.getBoundingClientRect();
    return { width: window.__OPS__!.store.getState().ui.rightPanelWidth, x: rail.left, y: rail.top + 96 };
  });
  await page.mouse.move(before.x - 2, before.y);
  await page.mouse.down();
  await page.mouse.move(before.x - 52, before.y);
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.rightPanelWidth))
    .toBeGreaterThan(before.width);
});

test('rechterrail behoudt de zichtbare sleeprand en breedterichting in RTL', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Railrand RTL', start: '2026-09-07', finish: '2026-09-18' }]);
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  await showRail(page);

  const before = await page.evaluate(() => {
    const rail = document.querySelector('[data-ops-rail]')!.getBoundingClientRect();
    return { width: window.__OPS__!.store.getState().ui.rightPanelWidth, x: rail.right, y: rail.top + 96 };
  });
  await page.mouse.move(before.x + 2, before.y);
  await page.mouse.down();
  await page.mouse.move(before.x + 52, before.y);
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.rightPanelWidth))
    .toBeGreaterThan(before.width);
  // In RTL vergroot slepen naar rechts vanaf de rechter scheiding de rail. De oude LTR-formule zou
  // hier de tegengestelde berekening gebruiken en direct tegen de 60%-bovengrens klemmen.
  const after = await page.evaluate(() => window.__OPS__!.store.getState().ui.rightPanelWidth);
  const max = await page.evaluate(() => Math.round(window.innerWidth * 0.6));
  expect(after).toBeLessThan(max);
});
