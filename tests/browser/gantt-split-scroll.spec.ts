// Karakterisering vóór viewportextractie: secundair horizontaal scrollen is lokaal; een echt
// Shift+wiel-event scrolt de gedeelde rijen en houdt beide rendereroppervlakken actief.
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

test('Gantt splitview isoleert horizontale scroll en deelt verticale wheel-scroll', async ({ page, ops: _ops }) => {
  const taskIds = await seedProject(page, Array.from({ length: 60 }, (_, index) => ({
    name: `Splitrij ${index + 1}`,
    start: '2026-09-07',
    finish: '2026-09-18',
    durationDays: 10,
  })));
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setSplitView({ ratio: 0.6, secondaryZoom: 30, secondaryScrollX: 0 });
    s.setScroll(140, 0);
  });
  await expect(page.getByTestId('gantt-secondary-canvas')).toBeVisible();
  // Karakteriseer de primitive enablegrens: uit ontkoppelt het paneel, opnieuw aan bindt de
  // wheelhandler weer; de handler zelf moet daarna de actuele splitstate uit de store lezen.
  await page.evaluate(() => window.__OPS__!.store.getState().setSplitView(undefined));
  await expect(page.getByTestId('gantt-secondary-canvas')).toHaveCount(0);
  await page.evaluate(() => window.__OPS__!.store.getState().setSplitView({
    ratio: 0.6,
    secondaryZoom: 30,
    secondaryScrollX: 0,
  }));
  await expect(page.getByTestId('gantt-secondary-canvas')).toBeVisible();
  await barPoint(page, taskIds[0], 'body', 'primary');
  await barPoint(page, taskIds[0], 'body', 'secondary');
  const paintsBefore = await page.evaluate(() => ({
    primary: window.__OPS__!.gantt.paintCount('primary'),
    secondary: window.__OPS__!.gantt.paintCount('secondary'),
  }));
  const primaryBefore = (await state(page)).view.scrollX;

  await page.getByTestId('gantt-hscroll-secondary').evaluate((element: HTMLElement) => {
    element.scrollLeft = 240;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect.poll(() => state(page).then(snapshot => snapshot.view.splitView?.secondaryScrollX)).toBe(240);
  expect((await state(page)).view.scrollX).toBe(primaryBefore);

  const secondaryPane = page.getByTestId('split-secondary-pane');
  await secondaryPane.hover({ position: { x: 120, y: 240 } });
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 224);
  await page.keyboard.up('Shift');
  await expect.poll(() => state(page).then(snapshot => snapshot.view.scrollY)).toBeGreaterThan(0);

  // Een statewijziging mag door React en ResizeObserver meer dan één paint opleveren. Deze
  // characterization eist alleen het contract uit het plan: beide levende renderers tekenen ná
  // het wheel-event opnieuw; het dicteert geen onbestaande exact-één-optimalisatie.
  await expect.poll(() => page.evaluate(({ before }) => (
    window.__OPS__!.gantt.paintCount('primary') > before.primary
      && window.__OPS__!.gantt.paintCount('secondary') > before.secondary
  ), { before: paintsBefore })).toBe(true);
  const sizes = await page.evaluate(() => ({
    primary: window.__OPS__!.gantt.lastSize('primary'),
    secondary: window.__OPS__!.gantt.lastSize('secondary'),
  }));
  expect(sizes.primary?.width).toBeGreaterThan(0);
  expect(sizes.secondary?.width).toBeGreaterThan(0);
});
