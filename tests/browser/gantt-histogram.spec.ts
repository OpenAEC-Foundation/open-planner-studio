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

test('histogram picker wisselt echte resourceserie en hover op de plot toont bijdragers', async ({ page, ops: _ops }) => {
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
  // Eigenaarscorrectie op R1: de tooltip is een echte hover-tooltip (~300 ms vertraging), geen
  // klikresultaat — een echte muisbeweging naar de plot en dan wachten, niet klikken.
  await page.mouse.move(
    taskStart.x + 5,
    bounds!.y + Math.min(70, bounds!.height / 2),
  );

  const tooltip = page.locator('.gantt-tooltip');
  await expect(tooltip.getByText(/^(2 taken dragen bij op|2 tasks contribute on)/)).toBeVisible();
  await expect(tooltip.getByText('Overbelaste bijdrage A', { exact: true })).toBeVisible();
  await expect(tooltip.getByText('Overbelaste bijdrage B', { exact: true })).toBeVisible();

  // Verlaat de strook: de tooltip verdwijnt weer (echte hover, geen klikresultaat dat blijft hangen).
  await page.mouse.move(bounds!.x - 20, bounds!.y - 20);
  await expect(tooltip).toHaveCount(0);
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

test('Gantt: pijltjestoetsen volgen de zichtbare taken zodra de gedeelde taakgrid focus heeft', async ({ page, ops: _ops }) => {
  const [firstId, secondId, thirdId] = await seedProject(page, [
    { name: 'Toets taak een', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Toets taak twee', start: '2026-09-21', finish: '2026-10-02', durationDays: 10 },
    { name: 'Toets taak drie', start: '2026-10-05', finish: '2026-10-16', durationDays: 10 },
  ]);
  const secondCell = page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="${secondId}"][data-grid-column-id="task.name"]`,
  );
  await secondCell.click();
  await expect.poll(() => state(page).then(snapshot => snapshot.selectedTaskIds)).toEqual([secondId]);
  await expect(secondCell).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect.poll(() => state(page).then(snapshot => snapshot.selectedTaskIds)).toEqual([thirdId]);
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => state(page).then(snapshot => snapshot.selectedTaskIds)).toEqual([secondId]);

  // Aan de bovengrens blijft de selectie op de eerste zichtbare taak staan.
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => state(page).then(snapshot => snapshot.selectedTaskIds)).toEqual([firstId]);
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => state(page).then(snapshot => snapshot.selectedTaskIds)).toEqual([firstId]);
});

test('histogram: een klik op een staaf opent geen tooltip', async ({ page, ops: _ops }) => {
  const { taskIds } = await seedResourceLoad(page);
  const taskStart = await barPoint(page, taskIds[0], 'left');
  const canvas = page.getByTestId('gantt-histogram-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const plotPoint = { x: taskStart.x + 5, y: bounds!.y + Math.min(70, bounds!.height / 2) };

  // Een klik op de plot (geen pickerrij) selecteert niets en mag — net als vóór de
  // eigenaarscorrectie op R1 al gold voor `onClick` — geen tooltip openen. Playwrights
  // `mouse.click` genereert zelf een `mousemove` naar dat punt vóór de down/up (net als een echte
  // muis die er vlak vóór het klikken aankomt), dus die impliciete hover start ook hier de eigen
  // 300 ms-vertragingstimer — dat is geen regressie, dat ís het hoverpad. Wat hier bewaakt wordt,
  // is dat `onClick` zelf niet synchroon (buiten die hovertimer om) een tooltip opent: meteen na
  // de klik, ruim binnen de hover-vertraging, moet de tooltip nog afwezig zijn.
  await page.mouse.click(plotPoint.x, plotPoint.y);
  await expect(page.locator('.gantt-tooltip')).toHaveCount(0);
  await page.waitForTimeout(100);
  await expect(page.locator('.gantt-tooltip')).toHaveCount(0);

  // Beweeg weg vóórdat de impliciete hover-timer (300 ms) alsnog afgaat, zodat deze test niet
  // toevallig slaagt dankzij een latere tooltip die er weer verdwijnt.
  await page.mouse.move(bounds!.x - 20, bounds!.y - 20);
  await page.waitForTimeout(400);
  await expect(page.locator('.gantt-tooltip')).toHaveCount(0);
});

test('histogram: histogram uit en weer aan toont geen spontane tooltip', async ({ page, ops: _ops }) => {
  const { taskIds } = await seedResourceLoad(page);
  const taskStart = await barPoint(page, taskIds[0], 'left');
  const canvas = page.getByTestId('gantt-histogram-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();

  // Hover eerst echt een tooltip open (zelfde route als de eerste test in dit bestand).
  await page.mouse.move(taskStart.x + 5, bounds!.y + Math.min(70, bounds!.height / 2));
  const tooltip = page.locator('.gantt-tooltip');
  await expect(tooltip).toBeVisible();

  // Herreview-gat (a): het lint zet het histogram uit (portal-canvas unmount, tooltipstate niet
  // vanzelf) en meteen weer aan — de tooltip mag niet spontaan terugkomen zonder nieuwe hover.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showHistogram: false }));
  await expect(page.getByTestId('gantt-histogram')).toHaveCount(0);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showHistogram: true }));
  await expect(page.getByTestId('gantt-histogram-canvas')).toBeVisible();
  await expect(tooltip).toHaveCount(0);
});

async function seedManyResources(page: Page, count: number): Promise<string[]> {
  await seedProject(page, [
    { name: 'Enkele taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  return page.evaluate((n) => {
    const s = window.__OPS__!.store.getState();
    const ids: string[] = [];
    for (let i = 1; i <= n; i++) {
      ids.push(s.addResource({
        name: `Resource ${String(i).padStart(2, '0')}`, type: 'LABOR', description: '', maxUnits: 1,
      }));
    }
    s.setUI({ showHistogram: true });
    return ids;
  }, count);
}

test('histogram: kiezerlijst scrolt binnen de strook, wielscroll boven de lijst en klik na scroll pakken de juiste resource (R2a)', async ({ page, ops: _ops }) => {
  const resourceIds = await seedManyResources(page, 30);
  const lastResourceId = resourceIds[resourceIds.length - 1];

  const canvas = page.getByTestId('gantt-histogram-canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();

  // HistogramRenderer: TOP_PAD=8, ROW_H=18 bij de standaard tekstschaal, scrollTop = 8+18 = 26.
  // Ongescrold past de gepinde somrij plus zeven resourcerijen in de standaard stroophoogte (160px)
  // — de dertigste resource ligt daar ver buiten. Niet-vacuüm: y=150 treft `1 + floor((150-26)/18)
  // = 7` ⇒ picker[7] = de zevende resource (index 6), NIET de laatste.
  await canvas.click({ position: { x: 24, y: 150 } });
  await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).toBe(resourceIds[6]);
  await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).not.toBe(lastResourceId);

  // Wielscroll BOVEN de kiezerlijst (x < pickerWidth) scrolt de lijst zelf, niet de Gantt erboven —
  // echte browser-wheel-events, geen brug-shortcut. Ruim voorbij `maxScroll`; de hook klemt zelf af.
  await page.mouse.move(bounds!.x + 24, bounds!.y + 80);
  await page.mouse.wheel(0, 5000);

  // Na volledige scroll (in PIXELS, R2a-fixronde punt 3 — geen hele-rijen-afronding meer) eindigt
  // de laatste rij exact tegen de onderkant van de strook (142..160px), dus dezelfde y=150 pakt 'm nu.
  await canvas.click({ position: { x: 24, y: 150 } });
  await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).toBe(lastResourceId);
});

test('histogram: wheel-listener hecht opnieuw na remount van de strook (R2a-fixronde punt 1/2)', async ({ page, ops: _ops }) => {
  // Reproduceert een histogram dat AL AAN staat op het moment dat de Gantt terugkomt uit een andere
  // werkruimte (Tabel-tabblad hier, Backstage/presentatiemodus zijn dezelfde remount-route): de
  // portal-doelcontainer (`histogramHost`) bestaat pas ná de eerste render van `GanttWorkspace`, dus
  // een naïeve `RefObject`-afhankelijkheid in de scroll-hook mist die wissel voorgoed.
  const resourceIds = await seedManyResources(page, 30);
  const lastResourceId = resourceIds[resourceIds.length - 1];

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'table' }));
  await expect(page.getByTestId('gantt-histogram-canvas')).toHaveCount(0);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'start' }));

  const canvas = page.getByTestId('gantt-histogram-canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();

  // Vóór scrollen: dezelfde niet-vacuüme controle als de vorige test — de klik pakt de zevende rij,
  // niet de laatste.
  await canvas.click({ position: { x: 24, y: 150 } });
  await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).toBe(resourceIds[6]);

  // Echte browser-wheel-events boven de kiezerzone, ná de remount. Zonder de fix doet dit niets
  // (de listener hangt aan een verweesde of nooit-bestaande container) en blijft de laatste
  // resource onbereikbaar.
  await page.mouse.move(bounds!.x + 24, bounds!.y + 80);
  await page.mouse.wheel(0, 5000);

  await canvas.click({ position: { x: 24, y: 150 } });
  await expect.poll(() => state(page).then(s => s.view.histogramResourceId)).toBe(lastResourceId);
});

test('histogram: pijltjestoetsen volgen resources zodra het histogram focus heeft', async ({ page, ops: _ops }) => {
  const { overId, spareId } = await seedResourceLoad(page);
  const histogram = page.getByTestId('gantt-histogram-canvas');

  await clickPickerRow(page, 1);
  await expect.poll(() => state(page).then(snapshot => snapshot.view.histogramResourceId)).toBe(overId);
  await expect(histogram).toBeFocused();
  await expect(histogram).toHaveClass(/outline-none/);

  await page.keyboard.press('ArrowDown');
  await expect.poll(() => state(page).then(snapshot => snapshot.view.histogramResourceId)).toBe(spareId);
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => state(page).then(snapshot => snapshot.view.histogramResourceId)).toBe(overId);

  // De verzamelrij is het eerste item in dezelfde selector en dus de vorige stap.
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => state(page).then(snapshot => snapshot.view.histogramResourceId)).toBeNull();
});
