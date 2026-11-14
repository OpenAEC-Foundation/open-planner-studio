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
