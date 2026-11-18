// Issue #868 deel A — mijlpalen die direct onder elkaar staan, klappen in tot één regel (besluit
// Ethan 14-11-2026, "alles ja"). De route van een planner: de reeks onder een fase inklappen met het
// pijltje, de regel kiest de hele reeks, een ruitje kiest één mijlpaal en is te slepen, uitklappen,
// en Inklappen/Uitklappen in het lint nemen de reeks mee. Alle handelingen zijn echte muis-events; de
// brug zet alleen de fixture en leest de stand.
import type { Locator, Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

test.use({ viewport: { width: 1600, height: 900 } });

function ganttRow(page: Page, rowKey: string): Locator {
  return page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${rowKey}"]`,
  );
}

function nameCell(page: Page, rowKey: string): Locator {
  return ganttRow(page, rowKey).locator('[data-grid-data-cell="true"][data-grid-column-id="task.name"]');
}

async function selected(page: Page): Promise<string[]> {
  return [...(await state(page)).selectedTaskIds].sort();
}

test('mijlpalenreeks: inklappen tot één regel, kiezen, slepen en weer uitklappen', async ({ page, ops: _ops }) => {
  const [phase] = await seedProject(page, [
    { name: 'Ruwbouw', start: '2026-09-07', finish: '2026-10-02', durationDays: 20 },
  ]);
  const ids = await page.evaluate((parentId) => {
    const api = () => window.__OPS__!.store.getState();
    const zero = { durationUnit: 'days', scheduleDuration: 0 } as const;
    const work = api().addTask({ name: 'Fundering', parentId, time: { durationUnit: 'days', scheduleDuration: 5 } as never });
    const m1 = api().addTask({ name: 'Start ruwbouw', parentId, isMilestone: true, time: zero as never });
    const m2 = api().addTask({ name: 'Keuring wapening', parentId, isMilestone: true, time: zero as never });
    const m3 = api().addTask({ name: 'Betonstort', parentId, isMilestone: true, time: zero as never });
    const next = api().addTask({ name: 'Kolommen', parentId, time: { durationUnit: 'days', scheduleDuration: 3 } as never });
    // Drie verschillende dagen, zodat de ruitjes los van elkaar op de regel staan.
    api().addSequence({ predecessorId: work, successorId: m1, type: 'FINISH_START', lagDays: 0 });
    api().addSequence({ predecessorId: work, successorId: m2, type: 'FINISH_START', lagDays: 4 });
    api().addSequence({ predecessorId: work, successorId: m3, type: 'FINISH_START', lagDays: 8 });
    api().runCPM();
    return { work, m1, m2, m3, next };
  }, phase);
  const runKey = `milestones:${ids.m1}`;

  // 1. Uitgeklapt heeft alleen de eerste mijlpaal een pijltje.
  await expect(nameCell(page, ids.m1).locator('.full-task-grid-disclosure')).toBeVisible();
  await expect(nameCell(page, ids.m2).locator('.full-task-grid-disclosure')).toHaveCount(0);

  // 2. Het pijltje klapt de reeks in tot één regel "Mijlpalen (3)".
  await nameCell(page, ids.m1).locator('.full-task-grid-disclosure').click();
  await expect(nameCell(page, runKey)).toContainText(/Mijlpalen \(3\)|Milestones \(3\)/);
  await expect(ganttRow(page, ids.m2)).toHaveCount(0);

  // 3. Pijl omlaag vanaf Fundering komt op de regel en kiest de hele reeks; nog een keer gaat
  //    voorbij de reeks naar Kolommen. Een klik op de regel kiest ook de hele reeks.
  await nameCell(page, ids.work).click();
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => selected(page)).toEqual([ids.m1, ids.m2, ids.m3].sort());
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => selected(page)).toEqual([ids.next]);
  await nameCell(page, runKey).click();
  await expect.poll(() => selected(page)).toEqual([ids.m1, ids.m2, ids.m3].sort());

  // 4. Een ruitje toont de hele naam in de tooltip, en een klik erop kiest die ene mijlpaal.
  const diamond = await barPoint(page, ids.m2);
  await page.mouse.move(diamond.x, diamond.y);
  await expect(page.locator('.gantt-tooltip')).toContainText('Keuring wapening');
  await page.mouse.click(diamond.x, diamond.y);
  await expect.poll(() => selected(page)).toEqual([ids.m2]);

  // 5. Het ruitje blijft sleepbaar op de ingeklapte regel.
  const before = (await state(page)).tasks.find(task => task.id === ids.m2)!.scheduleStart;
  const dayWidth = await page.evaluate(() => {
    const at = (d: string) => window.__OPS__!.gantt.dateX(d) ?? 0;
    return at('2026-09-22') - at('2026-09-21');
  });
  await page.mouse.move(diamond.x, diamond.y);
  await page.mouse.down();
  await page.mouse.move(diamond.x + dayWidth, diamond.y, { steps: 4 });
  await page.mouse.move(diamond.x + 3 * dayWidth, diamond.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).tasks.find(task => task.id === ids.m2)!.scheduleStart).not.toBe(before);
  await expect(nameCell(page, runKey)).toBeVisible();

  // 5b. Twee mijlpalen op dezelfde dag delen één ruitje met hun aantal (#868 punt 3, keuze Ethan):
  //     de tooltip noemt ze allebei, een klik kiest ze allebei en slepen verplaatst ze allebei.
  await page.evaluate(({ m1, m3 }) => {
    const api = () => window.__OPS__!.store.getState();
    api().addSequence({ predecessorId: m3, successorId: m1, type: 'FINISH_START', lagDays: 0 });
    api().runCPM();
    // Tien dagen verder kijken: de groep staat nu rechts van het beeld.
    api().setScroll(api().view.scrollX + 10 * api().view.zoom, api().view.scrollY);
  }, ids);
  const day = async (id: string) => (await state(page)).tasks.find(task => task.id === id)!.scheduleStart.slice(0, 10);
  await expect.poll(async () => (await day(ids.m1)) === (await day(ids.m3))).toBe(true);
  // Na de herberekening staan beide op hetzelfde ruitje (de hertekening kan een frame later komen).
  await expect.poll(async () => JSON.stringify(await barPoint(page, ids.m1)) === JSON.stringify(await barPoint(page, ids.m3))).toBe(true);
  const group = await barPoint(page, ids.m1);
  await page.mouse.move(group.x, group.y);
  await expect(page.locator('.gantt-tooltip')).toContainText(/Mijlpalen \(2\)|Milestones \(2\)/);
  await expect(page.locator('.gantt-tooltip')).toContainText('Start ruwbouw');
  await expect(page.locator('.gantt-tooltip')).toContainText('Betonstort');
  await page.mouse.click(group.x, group.y);
  await expect.poll(() => selected(page)).toEqual([ids.m1, ids.m3].sort());
  // Rechtsklik: een los ruitje opent het taakmenu, het groepsruitje kiest de groep zonder menu (review Sol ronde 2).
  const taskMenu = page.getByText(/^(Insert above|Invoegen boven)$/);
  const single = await barPoint(page, ids.m2);
  await page.mouse.click(single.x, single.y, { button: 'right' });
  await expect(taskMenu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(taskMenu).toHaveCount(0);
  await page.mouse.click(group.x, group.y, { button: 'right' });
  await expect.poll(() => selected(page)).toEqual([ids.m1, ids.m3].sort());
  await expect(taskMenu).toHaveCount(0);
  // Shift+klik op het groepsruitje neemt de hele groep mee in het bereik (review Sol ronde 3).
  await nameCell(page, ids.work).click();
  await page.keyboard.down('Shift');
  await page.mouse.click(group.x, group.y);
  await page.keyboard.up('Shift');
  await expect.poll(() => selected(page)).toEqual([ids.work, ids.m1, ids.m3].sort());
  // F2 opent een losse mijlpaal, maar geen lid van een groepsruitje (review Sol ronde 3).
  const dialog = () => page.evaluate(() => {
    const ui = window.__OPS__!.store.getState().ui;
    return ui.showTaskDialog ? ui.editingTaskId : null;
  });
  await page.mouse.click(single.x, single.y);
  await expect.poll(() => selected(page)).toEqual([ids.m2]);
  await page.keyboard.press('F2');
  await expect.poll(dialog).toBe(ids.m2);
  await page.keyboard.press('Escape');
  await expect.poll(dialog).toBeNull();
  // Shift in de lijst vanaf dat ene ruitje neemt van de reeks alleen dat ruitje mee, niet zijn buren
  // op dezelfde regel (#1004, ronde 7).
  await nameCell(page, ids.work).click({ modifiers: ['Shift'] });
  await expect.poll(() => selected(page)).toEqual([ids.work, ids.m2].sort());
  // Ook met Shift+pijl: terug op de reeksregel blijft alleen dat ruitje over, en een regel verder
  // komt de volgende taak erbij, niet de andere mijlpalen (ronde 8).
  await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(() => selected(page)).toEqual([ids.m2]);
  await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(() => selected(page)).toEqual([ids.m2, ids.next].sort());
  await page.mouse.click(group.x, group.y);
  await expect.poll(() => selected(page)).toEqual([ids.m1, ids.m3].sort());
  await page.keyboard.press('F2');
  await page.waitForTimeout(300);
  expect(await dialog()).toBeNull();
  // Een klik op het groepsruitje zet de tabelcursor op de reeksregel (review Sol ronde 2).
  await nameCell(page, ids.work).click();
  await page.mouse.click(group.x, group.y);
  await expect(nameCell(page, runKey)).toHaveAttribute('data-grid-active', 'true');
  // Ctrl+C op de reeksregel kopieert alle mijlpalen van de reeks (review Sol ronde 2).
  await nameCell(page, runKey).click();
  // Na het ruitje en dan de reeksregel in de lijst is de hele reeks het beginpunt van Shift (#1004).
  await expect.poll(() => page.evaluate(() => [...(window.__OPS__!.store.getState().ui.selectionAnchor?.taskIds ?? [])].sort()))
    .toEqual([ids.m1, ids.m2, ids.m3].sort());
  await page.keyboard.press('Control+c');
  await expect.poll(() => page.evaluate(() => (window.__OPS__!.store.getState().taskClipboard?.tasks ?? []).map(t => t.id).sort()))
    .toEqual([ids.m1, ids.m2, ids.m3].sort());
  await page.mouse.click(group.x, group.y);
  await expect.poll(() => selected(page)).toEqual([ids.m1, ids.m3].sort());
  const groupDay = await day(ids.m1);
  await page.mouse.move(group.x, group.y);
  await page.mouse.down();
  await page.mouse.move(group.x + dayWidth, group.y, { steps: 4 });
  await page.mouse.move(group.x + 2 * dayWidth, group.y, { steps: 4 });
  // Tijdens de sleep is de hele groep gekozen (de klik na het loslaten valt waar het ruitje niet meer staat).
  await expect.poll(() => selected(page)).toEqual([ids.m1, ids.m3].sort());
  await page.mouse.up();
  await expect.poll(() => day(ids.m1)).not.toBe(groupDay);
  expect(await day(ids.m3)).toBe(await day(ids.m1));

  // 6. De regel in de tabel onder "Kolommen" slepen verplaatst de hele reeks.
  const childNames = () => page.evaluate((parentId) => {
    const s = window.__OPS__!.store.getState();
    return s.tasks.find(t => t.id === parentId)!.childIds.map(id => s.tasks.find(t => t.id === id)!.name);
  }, phase);
  const runBox = (await ganttRow(page, runKey).boundingBox())!;
  const nextBox = (await ganttRow(page, ids.next).boundingBox())!;
  const from = { x: runBox.x + Math.min(120, runBox.width / 2), y: runBox.y + runBox.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 2, nextBox.y + nextBox.height - 2, { steps: 5 });
  await expect(ganttRow(page, ids.next)).toHaveAttribute('data-grid-drop-zone', /after/);
  await page.mouse.up();
  await expect.poll(childNames).toEqual(['Fundering', 'Kolommen', 'Start ruwbouw', 'Keuring wapening', 'Betonstort']);
  await expect(nameCell(page, runKey)).toBeVisible();

  // 7. Het pijltje op de regel klapt de reeks weer uit.
  await nameCell(page, runKey).locator('.full-task-grid-disclosure').click();
  await expect(ganttRow(page, ids.m2)).toBeVisible();
  await expect(ganttRow(page, runKey)).toHaveCount(0);

  // 8. Inklappen in het lint (Beeld › Overzicht) met een mijlpaal uit de reeks gekozen, klapt de
  //    reeks in; Uitklappen klapt hem weer uit.
  await ganttRow(page, ids.m3).click();
  await page.getByRole('button', { name: /^(Beeld|View)$/ }).click();
  await page.locator('[data-ops-ribbon-item="collapseTasks"]').click();
  await expect(nameCell(page, runKey)).toBeVisible();
  await nameCell(page, runKey).click();
  await page.locator('[data-ops-ribbon-item="expandTasks"]').click();
  await expect(ganttRow(page, ids.m3)).toBeVisible();
});
