// Karakterisering vóór de actuele-refrefactor: de eerste echte move wijzigt leftPanelWidth en
// herrendert daarmee de splittercaller met verse opties. De lopende gesture moet gekoppeld blijven,
// de tweede move toepassen en uitsluitend bij mouseup één persistente commit uitvoeren.
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

// Horizontale splitters in ltr én rtl. De shell spiegelt in ar/fa (`dir="rtl"` op <html>): de
// takenlijst staat dan RECHTS van de Gantt en de rapportinstellingen rechts van de preview, zoals de
// rechterrail daar links staat (right-rail-resize.spec). Eerst lag de Gantt-splitter in ar/fa 5 px
// BINNEN de lijst (over de WBS-kolom) en rekenden beide splitters `clientX − rect.left`, dus alsof de
// lijst links stond: 50 px naar links slepen maakte de takenlijst 350 → 570 px breed. Nu ligt de
// splitter op de echte grens en gaat de rand de kant op van de muis en van de pijltoets. Dezelfde
// stappen in nl/en bewijzen dat ltr niet veranderde. Handelingen via echte muis- en toetsevents; de
// brug zet alleen de planning en het instellingenvenster, en leest state.
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
    /** De grens tussen lijst en Gantt: de rand van de lijst aan de Gantt-kant. */
    const boundary = async () => {
      const rect = await box(list);
      return locale.rtl ? rect.left : rect.right;
    };

    // Waar de lijst staat: aan de beginkant van de werkruimte, dus rechts in ar/fa en links in ltr,
    // met de tijdlijn er strak tegenaan.
    const listBox = await box(list);
    const timelineBox = await box(timeline);
    if (locale.rtl) expect(timelineBox.right).toBe(listBox.left);
    else expect(timelineBox.left).toBe(listBox.right);

    // De splitter (5 px) ligt tegen die grens, volledig aan de Gantt-kant: hij bedekt geen pixel van
    // de lijst, en zijn lijn (border-inline-start) staat op de grens.
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

    // Verbreden: pak de splitter en sleep hem 50 px van de lijst af (in ar/fa naar links). De lijst
    // wordt breder en de grens ligt daarna onder de muis.
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

    // Versmallen: 30 px naar de lijst toe; de grens volgt weer de muis.
    const x2 = centerX(await box(splitter));
    await page.mouse.move(x2, y);
    await page.mouse.down();
    await page.mouse.move(x2 - away * 30, y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Math.abs(await boundary() - (x2 - away * 30))).toBeLessThanOrEqual(1);
    expect(await listWidth()).toBeLessThan(wider);

    // Toetsenbord: de pijl verschuift de grens zijn kant op (10 px, met Shift 40 px). In ar/fa maakt
    // pijl-links de lijst dus breder, in ltr smaller. (De focus zetten is opzet; de geteste
    // handeling is de toets.)
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
    await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
    await chooseLocale(page, locale);
    const zone = page.locator('[data-ops-report-settings-resize]');
    const column = page.locator('[data-ops-report-settings-resize] + div');
    const panel = page.locator('[data-ops-report-settings-resize]').locator('..');
    /** De grens tussen instellingen en preview. */
    const boundary = async () => {
      const rect = await box(column);
      return locale.rtl ? rect.left : rect.right;
    };

    // De instellingenkolom staat aan de beginkant van het rapportpaneel (rechts in ar/fa).
    const columnBox = await box(column);
    const panelBox = await box(panel);
    if (locale.rtl) expect(columnBox.right).toBe(panelBox.right);
    else expect(columnBox.left).toBe(panelBox.left);

    // Grijpzone gecentreerd op de grens; de scheidingslijn van de kolom ligt óp de grens.
    const edge = await boundary();
    expect(Math.abs(centerX(await box(zone)) - edge)).toBeLessThanOrEqual(1);
    const line = await column.evaluate(element => {
      const style = getComputedStyle(element);
      return { left: style.borderLeftWidth, right: style.borderRightWidth };
    });
    expect(line).toEqual(locale.rtl ? { left: '1px', right: '0px' } : { left: '0px', right: '1px' });

    // Slepen: pak de grens en sleep 40 px van de kolom af (in ar/fa naar links); de kolom wordt
    // breder en de grens ligt daarna onder de muis. Daarna 20 px terug.
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
