// Karakterisering vóór viewportextractie. Storeacties zetten uitsluitend de fixturetoestand;
// wheel-, shortcut-, minimap-, focus- en splitterhandelingen zijn echte browserinteracties.
import type { Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

function manyTasks(prefix: string, count = 58) {
  return Array.from({ length: count }, (_, index) => ({
    name: `${prefix} ${index + 1}`,
    start: index === count - 1 ? '2027-04-05' : '2026-09-07',
    finish: index === count - 1 ? '2027-04-16' : '2026-09-18',
    durationDays: 10,
  }));
}

async function primaryCanvasBounds(page: Page) {
  const bounds = await page.getByTestId('gantt-primary-canvas').boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

function ganttTaskCell(page: Page, taskId: string) {
  return page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="${taskId}"][data-grid-column-id="task.name"]`,
  );
}

test('Gantt viewport: primary wheel volgt drag, modifier en position mode', async ({ page, ops: _ops }) => {
  await seedProject(page, manyTasks('Wheelpad'));
  const bounds = await primaryCanvasBounds(page);
  const point = { x: bounds.x + bounds.width * 0.78, y: bounds.y + bounds.height * 0.65 };

  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ scrollMode: 'drag' });
    s.setScroll(0, 0);
  });
  const dragBefore = await state(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 160);
  await expect.poll(() => state(page).then(s => s.view.zoom)).not.toBe(dragBefore.view.zoom);

  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({
      scrollMode: 'modifier',
      modifierMap: { plain: 'vertical', ctrl: 'zoom', shift: 'horizontal' },
    });
    s.setScroll(100, 0);
  });
  const modifierBefore = await state(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 168);
  await expect.poll(() => state(page).then(s => s.view.scrollY)).toBeGreaterThan(0);
  const modifierAfter = await state(page);
  expect(modifierAfter.view.zoom).toBe(modifierBefore.view.zoom);
  expect(modifierAfter.view.scrollX).toBe(modifierBefore.view.scrollX);

  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ scrollMode: 'position', positionDivision: 'left-right' });
    s.setScroll(0, 0);
  });
  const positionBefore = await state(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 176);
  await expect.poll(() => state(page).then(s => s.view.scrollX)).toBeGreaterThan(0);
  const positionAfter = await state(page);
  expect(positionAfter.view.scrollY).toBe(positionBefore.view.scrollY);
  expect(positionAfter.view.zoom).toBe(positionBefore.view.zoom);
});

test('Gantt viewport: secondary wheel schrijft eigen X en gedeelde Y', async ({ page, ops: _ops }) => {
  await seedProject(page, manyTasks('Secondary wheel'));
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setSplitView({ ratio: 0.55, secondaryZoom: 48, secondaryScrollX: 0 });
    s.setUI({
      scrollMode: 'modifier',
      modifierMap: { plain: 'horizontal', ctrl: 'zoom', shift: 'vertical' },
    });
    s.setScroll(90, 0);
  });
  const pane = page.getByTestId('split-secondary-pane');
  await expect(pane).toBeVisible();
  const paneBounds = await pane.boundingBox();
  expect(paneBounds).not.toBeNull();
  const point = { x: paneBounds!.x + paneBounds!.width / 2, y: paneBounds!.y + paneBounds!.height / 2 };
  const beforeX = await state(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 184);
  await expect.poll(() => state(page).then(s => s.view.splitView?.secondaryScrollX ?? 0)).toBeGreaterThan(0);
  const afterX = await state(page);
  expect(afterX.view.scrollX).toBe(beforeX.view.scrollX);
  expect(afterX.view.scrollY).toBe(beforeX.view.scrollY);

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({
    modifierMap: { plain: 'vertical', ctrl: 'zoom', shift: 'horizontal' },
  }));
  const secondaryX = (await state(page)).view.splitView!.secondaryScrollX;
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 192);
  await expect.poll(() => state(page).then(s => s.view.scrollY)).toBeGreaterThan(0);
  const afterY = await state(page);
  expect(afterY.view.splitView?.secondaryScrollX).toBe(secondaryX);
  expect(afterY.view.scrollX).toBe(beforeX.view.scrollX);
});

test('Gantt viewport: Ctrl+0 past de hele projectspan en reset Y', async ({ page, ops: _ops }) => {
  const inputs = manyTasks('Fitspan', 45);
  inputs[0] = { name: 'Eerste span', start: '2026-01-05', finish: '2026-01-09', durationDays: 5 };
  inputs[inputs.length - 1] = {
    name: 'Laatste span', start: '2027-06-07', finish: '2027-06-18', durationDays: 10,
  };
  const ids = await seedProject(page, inputs);
  await barPoint(page, ids[0]);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setZoom(180);
    s.setScroll(900, 260);
  });
  await expect.poll(() => state(page).then(s => s.view.scrollY)).toBeGreaterThan(0);
  const before = await state(page);
  const paintsBefore = await page.evaluate(() => window.__OPS__!.gantt.paintCount('primary'));

  await page.keyboard.press('Control+0');

  await expect.poll(() => state(page).then(s => s.view.scrollY)).toBe(0);
  await expect.poll(() => state(page).then(s => s.view.viewStartDate)).toBe('2026-01-05');
  await expect.poll(() => state(page).then(s => s.view.zoom)).not.toBe(before.view.zoom);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.gantt.paintCount('primary'))).toBeGreaterThan(paintsBefore);
  const bounds = await primaryCanvasBounds(page);
  const first = await barPoint(page, ids[0]);
  const last = await barPoint(page, ids.at(-1)!);
  expect(first.x).toBeGreaterThanOrEqual(bounds.x);
  expect(last.x).toBeLessThanOrEqual(bounds.x + bounds.width);
});

test('Gantt viewport: een gewone klik in de takenlijst onthult alleen een verborgen balk', async ({ page, ops: _ops }) => {
  const [nearId, farId] = await seedProject(page, [
    { name: 'Nabije balk', start: '2026-01-05', finish: '2026-01-09', durationDays: 5 },
    { name: 'Verborgen balk', start: '2028-07-03', finish: '2028-07-14', durationDays: 10 },
  ]);
  const bounds = await primaryCanvasBounds(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setZoom(60);
    s.setScroll(0, 0);
  });
  const farPoint = await barPoint(page, farId);
  expect(farPoint.x).toBeGreaterThan(bounds.x + bounds.width);
  const before = await state(page);

  await ganttTaskCell(page, farId).click();

  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([farId]);
  await expect.poll(() => state(page).then(s => s.view.scrollX)).toBeGreaterThan(0);
  const afterPlainClick = await state(page);
  expect(afterPlainClick.view.zoom).toBe(before.view.zoom);

  await ganttTaskCell(page, nearId).click({ modifiers: ['Control'] });
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual(expect.arrayContaining([nearId, farId]));
  expect((await state(page)).view.scrollX).toBe(afterPlainClick.view.scrollX);

  await ganttTaskCell(page, farId).click({ modifiers: ['Shift'] });
  expect((await state(page)).view.scrollX).toBe(afterPlainClick.view.scrollX);
});

test('Gantt viewport: de werkdag-as onthult een bestaande berekende taak zonder schaalwijziging', async ({ page, ops: _ops }) => {
  const [nearId, farId] = await seedProject(page, [
    { name: 'Werkdag begin', start: '2026-01-05', finish: '2026-01-09', durationDays: 5 },
    { name: 'Werkdag doel', start: '2028-07-03', finish: '2028-07-14', durationDays: 10 },
  ]);
  const bounds = await primaryCanvasBounds(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ compressNonWorkdays: true });
    s.runCPM();
    s.setZoom(60);
    s.setScroll(0, 0);
  });
  const farPoint = await barPoint(page, farId);
  expect(farPoint.x).toBeGreaterThan(bounds.x + bounds.width);
  const before = await state(page);

  await ganttTaskCell(page, farId).click();

  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([farId]);
  await expect.poll(() => state(page).then(s => s.view.scrollX)).toBeGreaterThan(0);
  const afterPlainClick = await state(page);
  expect(afterPlainClick.view.zoom).toBe(before.view.zoom);
  const revealed = await barPoint(page, farId);
  expect(revealed.x).toBeGreaterThanOrEqual(bounds.x);
  expect(revealed.x).toBeLessThanOrEqual(bounds.x + bounds.width);

  await ganttTaskCell(page, nearId).click({ modifiers: ['Control'] });
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual(expect.arrayContaining([nearId, farId]));
  expect((await state(page)).view.scrollX).toBe(afterPlainClick.view.scrollX);
});

test('Gantt viewport: pijlnavigatie onthult op de werkdag-as de volgende verborgen taak zonder zoomsprong', async ({ page, ops: _ops }) => {
  const [nearId, farId] = await seedProject(page, [
    { name: 'Toets werkdag begin', start: '2026-01-05', finish: '2026-01-09', durationDays: 5 },
    { name: 'Toets werkdag doel', start: '2028-07-03', finish: '2028-07-14', durationDays: 10 },
  ]);
  const bounds = await primaryCanvasBounds(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ compressNonWorkdays: true });
    s.runCPM();
    s.setZoom(60);
    s.setScroll(0, 0);
  });
  const farPoint = await barPoint(page, farId);
  expect(farPoint.x).toBeGreaterThan(bounds.x + bounds.width);

  // De gedeelde DOM-grid bezit selectie en pijlnavigatie; de Gantt-surface onthult de balk bij
  // iedere gewone verplaatsing van de actieve cel.
  const nearCell = ganttTaskCell(page, nearId);
  await nearCell.click();
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([nearId]);
  await expect(nearCell).toBeFocused();
  const before = await state(page);

  await page.keyboard.press('ArrowDown');

  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([farId]);
  await expect.poll(() => state(page).then(s => s.view.scrollX)).toBeGreaterThan(0);
  const after = await state(page);
  expect(after.view.zoom).toBe(before.view.zoom);
  const revealed = await barPoint(page, farId);
  expect(revealed.x).toBeGreaterThanOrEqual(bounds.x);
  expect(revealed.x).toBeLessThanOrEqual(bounds.x + bounds.width);
});

test('Gantt viewport: een nieuwe taak blijft bij werkdagcompressie zichtbaar zonder viewportvlucht', async ({ page, ops: _ops }) => {
  const [, farId] = await seedProject(page, [
    { name: 'Vroege basis', start: '2026-01-05', finish: '2026-01-09', durationDays: 5 },
    { name: 'Late bestaande taak', start: '2028-07-03', finish: '2028-07-14', durationDays: 10 },
  ]);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ compressNonWorkdays: true });
    s.setZoom(60);
    s.setScroll(100_000, 0);
  });
  await page.evaluate((id) => window.__OPS__!.store.getState().selectTask(id), farId);
  await expect(page.getByRole('button', { name: /New task directly below the selection|Nieuwe taak direct onder de selectie/ })).toBeVisible();
  await expect.poll(() => state(page).then(s => s.view.scrollX)).toBeGreaterThan(0);
  const before = await state(page);

  await page.getByRole('button', { name: /New task directly below the selection|Nieuwe taak direct onder de selectie/ }).click();

  await expect.poll(() => state(page).then(s => s.tasks.length)).toBe(3);
  const after = await state(page);
  const newTaskId = after.selectedTaskIds[0];
  expect(after.selectedTaskIds).toHaveLength(1);
  expect(after.view.zoom).toBe(before.view.zoom);
  const bounds = await primaryCanvasBounds(page);
  const newBar = await barPoint(page, newTaskId);
  expect(newBar.x).toBeGreaterThanOrEqual(bounds.x);
  expect(newBar.x).toBeLessThanOrEqual(bounds.x + bounds.width);
});

test('Gantt viewport: WBS-focusklik centreert taak en wist het pending signaal', async ({ page, ops: _ops }) => {
  const inputs = manyTasks('Focustussen', 46);
  inputs[0] = { name: 'Focusbron', start: '2026-01-05', finish: '2026-01-09', durationDays: 5 };
  inputs[inputs.length - 1] = {
    name: 'Focusdoel', start: '2027-08-02', finish: '2027-09-17', durationDays: 35,
  };
  const ids = await seedProject(page, inputs);
  const sourceId = ids[0];
  const targetId = ids.at(-1)!;
  await page.evaluate(({ source, target }) => {
    const s = window.__OPS__!.store.getState();
    s.addSequence({
      predecessorId: source,
      successorId: target,
      type: 'FINISH_START',
      lagDays: 0,
    });
    s.selectTask(source);
    s.setZoom(160);
    s.setScroll(0, 0);
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
  }, { source: sourceId, target: targetId });
  const before = await state(page);
  const jump = page.getByRole('button', { name: /(?:Ga naar taak|Go to task)/ });
  await expect(jump).toBeVisible();

  await jump.click();

  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([targetId]);
  await expect.poll(() => state(page).then(s => s.view.pendingFocusTaskId)).toBeNull();
  const after = await state(page);
  expect(after.view.zoom).not.toBe(before.view.zoom);
  expect(after.view.scrollX).toBeGreaterThan(0);
  expect(after.view.scrollY).toBeGreaterThan(0);
});

test('Gantt viewport: elke minimap bestuurt alleen het eigen paneel', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Minimap begin', start: '2026-01-05', finish: '2026-01-09', durationDays: 5 },
    { name: 'Minimap einde', start: '2027-11-01', finish: '2027-11-12', durationDays: 10 },
  ]);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showMiniMap: true });
    s.setSplitView({ ratio: 0.56, secondaryZoom: 50, secondaryScrollX: 0 });
    s.setScroll(0, 0);
  });
  const primary = page.getByTestId('minimap').locator('canvas');
  const secondary = page.getByTestId('minimap-secondary').locator('canvas');
  await expect(primary).toBeVisible();
  await expect(secondary).toBeVisible();
  const primaryBounds = await primary.boundingBox();
  const secondaryBounds = await secondary.boundingBox();
  expect(primaryBounds).not.toBeNull();
  expect(secondaryBounds).not.toBeNull();

  await primary.click({ position: { x: primaryBounds!.width * 0.82, y: primaryBounds!.height / 2 } });
  await expect.poll(() => state(page).then(s => s.view.scrollX)).toBeGreaterThan(0);
  let snapshot = await state(page);
  expect(snapshot.view.splitView?.secondaryScrollX).toBe(0);
  const primaryX = snapshot.view.scrollX;

  await secondary.click({ position: { x: secondaryBounds!.width * 0.82, y: secondaryBounds!.height / 2 } });
  await expect.poll(() => state(page).then(s => s.view.splitView?.secondaryScrollX ?? 0)).toBeGreaterThan(0);
  snapshot = await state(page);
  expect(snapshot.view.scrollX).toBe(primaryX);
});

test('Gantt viewport: splitratio klemt en blijft na mouseup bij het document', async ({ page, ops: _ops }) => {
  await seedProject(page, [{
    name: 'Ratiosplit', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }]);
  const documentId = (await state(page)).activeDocumentId;
  await page.evaluate(() => window.__OPS__!.store.getState().setSplitView({
    ratio: 0.5,
    secondaryZoom: 30,
    secondaryScrollX: 0,
  }));
  const bar = page.getByTestId('split-ratio-bar');
  await expect(bar).toBeVisible();
  let bounds = await bar.boundingBox();
  expect(bounds).not.toBeNull();

  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(-100, bounds!.y + bounds!.height / 2, { steps: 4 });
  await expect.poll(() => state(page).then(s => s.view.splitView?.ratio)).toBe(0.15);
  await page.mouse.up();

  const otherId = await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  expect(otherId).not.toBe(documentId);
  await page.locator(`[data-testid="document-tab"][data-ops-tab="${documentId}"]`).click();
  await expect.poll(() => state(page).then(s => s.view.splitView?.ratio)).toBe(0.15);

  bounds = await page.getByTestId('split-ratio-bar').boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move((await page.viewportSize())!.width + 100, bounds!.y + bounds!.height / 2, { steps: 4 });
  await expect.poll(() => state(page).then(s => s.view.splitView?.ratio)).toBe(0.85);
  await page.mouse.up();
});
