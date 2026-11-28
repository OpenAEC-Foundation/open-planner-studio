import { expect, seedProject, test } from './fixtures/ops';
import { box, centerX, centerY, chooseLocale, LOCALE_CASES } from './fixtures/locale';

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

for (const locale of LOCALE_CASES) {
  test(`${locale.code}: Gantt-splitter ligt op de grens aan de Gantt-kant en volgt muis en pijltoets`, async ({ page, ops: _ops }) => {
    await seedProject(page, [
      { name: 'Ruwbouw', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
      { name: 'Afbouw', start: '2026-09-21', finish: '2026-10-02', durationDays: 10 },
    ]);
    await chooseLocale(page, locale);
    const list = page.locator('.gantt-workspace-grid');
    const timeline = page.locator('.gantt-workspace-timeline');
    const splitter = page.getByTestId('gantt-workspace-splitter');
    const listWidth = () => page.evaluate(() => window.__OPS__!.store.getState().ui.leftPanelWidth);
    const boundary = async () => {
      const rect = await box(list);
      return locale.rtl ? rect.left : rect.right;
    };

    const listBox = await box(list);
    const timelineBox = await box(timeline);
    if (locale.rtl) expect(timelineBox.right).toBe(listBox.left);
    else expect(timelineBox.left).toBe(listBox.right);

    const edge = await boundary();
    const splitBox = await box(splitter);
    expect(splitBox.right - splitBox.left).toBe(5);
    if (locale.rtl) expect(splitBox.right).toBe(edge);
    else expect(splitBox.left).toBe(edge);
    const line = await splitter.evaluate(element => {
      const style = getComputedStyle(element);
      return { left: style.borderLeftWidth, right: style.borderRightWidth };
    });
    expect(line).toEqual(locale.rtl ? { left: '0px', right: '1px' } : { left: '1px', right: '0px' });

    const away = locale.rtl ? -1 : 1;
    const widthBefore = await listWidth();
    const x = centerX(splitBox);
    const y = splitBox.top + 60;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + away * 25, y, { steps: 3 });
    await page.mouse.move(x + away * 50, y, { steps: 3 });
    await page.mouse.up();
    await expect.poll(async () => Math.abs(await boundary() - (x + away * 50))).toBeLessThanOrEqual(1);
    const wider = await listWidth();
    expect(wider).toBeGreaterThanOrEqual(widthBefore + 50);
    expect(wider).toBeLessThanOrEqual(widthBefore + 54);

    const x2 = centerX(await box(splitter));
    await page.mouse.move(x2, y);
    await page.mouse.down();
    await page.mouse.move(x2 - away * 30, y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Math.abs(await boundary() - (x2 - away * 30))).toBeLessThanOrEqual(1);
    expect(await listWidth()).toBeLessThan(wider);

    await splitter.focus();
    for (const [key, dx] of [['ArrowLeft', -10], ['ArrowRight', 10], ['Shift+ArrowLeft', -40]] as const) {
      const edgeBefore = await boundary();
      const widthNow = await listWidth();
      await page.keyboard.press(key);
      await expect.poll(async () => Math.abs(await boundary() - (edgeBefore + dx))).toBeLessThanOrEqual(1);
      expect(await listWidth()).toBe(widthNow + (locale.rtl ? -dx : dx));
    }
  });

  test(`${locale.code}: rapportinstellingen — grijpzone en lijn op de grens, slepen volgt de muis`, async ({ page, ops: _ops }) => {
    await seedProject(page, [
      { name: 'Ruwbouw', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    ]);
    await page.evaluate(() => localStorage.setItem('ops-reportSettings', JSON.stringify({ reportType: 'milestones' })));
    await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
    await chooseLocale(page, locale);
    const zone = page.locator('[data-ops-report-settings-resize]');
    const column = page.locator('[data-ops-report-settings-resize] + div');
    const panel = page.locator('[data-ops-report-settings-resize]').locator('..');
    const boundary = async () => {
      const rect = await box(column);
      return locale.rtl ? rect.left : rect.right;
    };

    const columnBox = await box(column);
    const panelBox = await box(panel);
    if (locale.rtl) expect(columnBox.right).toBe(panelBox.right);
    else expect(columnBox.left).toBe(panelBox.left);

    const edge = await boundary();
    expect(Math.abs(centerX(await box(zone)) - edge)).toBeLessThanOrEqual(1);
    const line = await column.evaluate(element => {
      const style = getComputedStyle(element);
      return { left: style.borderLeftWidth, right: style.borderRightWidth };
    });
    expect(line).toEqual(locale.rtl ? { left: '1px', right: '0px' } : { left: '0px', right: '1px' });

    const away = locale.rtl ? -1 : 1;
    const widthOf = async () => { const rect = await box(column); return rect.right - rect.left; };
    const widthBefore = await widthOf();
    const y = centerY(columnBox);
    await page.mouse.move(edge, y);
    await page.mouse.down();
    await page.mouse.move(edge + away * 20, y, { steps: 3 });
    await page.mouse.move(edge + away * 40, y, { steps: 3 });
    await page.mouse.up();
    await expect.poll(async () => Math.abs(await boundary() - (edge + away * 40))).toBeLessThanOrEqual(1);
    expect(Math.abs(await widthOf() - (widthBefore + 40))).toBeLessThanOrEqual(1);

    const edge2 = await boundary();
    await page.mouse.move(edge2, y);
    await page.mouse.down();
    await page.mouse.move(edge2 - away * 20, y, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => Math.abs(await boundary() - (edge2 - away * 20))).toBeLessThanOrEqual(1);
    expect(Math.abs(await widthOf() - (widthBefore + 20))).toBeLessThanOrEqual(1);
  });
}
