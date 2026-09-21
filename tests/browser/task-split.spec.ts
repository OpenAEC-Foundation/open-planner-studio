// De splits-modus (issue #146, etappe 2): knop in het lint, gekleurd meldingsblok, en het gebaar
// "klik op de dag waar de onderbreking begint, sleep naar rechts voor de lengte".
//
// Alle handelingen lopen via echte muis- en toetsevents; de dev-brug zet alleen de fixture klaar
// en leest de domeinstate terug. De muispositie wordt uit de canvasgeometrie afgeleid die de brug
// al blootgeeft (`taskBarPoint`) plus de zoom — geen pixel-asserties.
import type { Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

/** Taak 2026-06-01..2026-06-12 = 10 werkdagen, dag-kalender ma–vr. */
const START = '2026-06-01';
const FINISH = '2026-06-12';

interface SplitGap { afterMinutes: number; gapMinutes: number; source?: string }

async function splitGapsOf(page: Page, taskId: string): Promise<SplitGap[] | null> {
  return page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(t => t.id === id);
    return (task?.splitGaps ?? null) as SplitGap[] | null;
  }, taskId);
}

async function durationOf(page: Page, taskId: string): Promise<number | null> {
  return page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(t => t.id === id);
    return task?.time.scheduleDuration ?? null;
  }, taskId);
}

/**
 * Zet de taak klaar zoals de splits-modus hem verwacht: een gewone, automatisch geplande taak op
 * een kale kalender-as (compressie uit, zodat één getoonde kolom één KALENDERdag is en de test de
 * dagpositie zonder rendererkennis kan uitrekenen).
 */
async function seedSplittableTask(page: Page, options: { milestone?: boolean } = {}): Promise<string> {
  const [taskId] = await seedProject(page, [
    { name: 'Splitsbare taak', start: START, finish: FINISH, durationDays: 10 },
  ]);
  await page.evaluate(({ id, milestone }) => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ compressNonWorkdays: false, showPropertiesPanel: false, rightPanelCollapsed: true });
    s.setZoom(20);
    s.setScroll(0, 0);
    // `seedProject` plant handmatig; een handmatig geplande taak is bewust NIET splitsbaar
    // (`canSplitTask`), dus hier terug naar een gewone taak zonder de datums aan te raken.
    s.updateTask(id, { manuallyScheduled: false, ...(milestone ? { isMilestone: true } : {}) });
  }, { id: taskId, milestone: options.milestone === true });
  return taskId;
}

/** Client-x van het MIDDEN van de kalenderdagkolom `dayOffset` dagen na de taakstart. */
async function dayColumnX(page: Page, taskId: string, dayOffset: number): Promise<number> {
  const left = (await barPoint(page, taskId, 'left')).x;
  const zoom = (await state(page)).view.zoom;
  return left + dayOffset * zoom + zoom / 2;
}

async function enableSplitMode(page: Page): Promise<void> {
  // Op het spec-id en niet op de naam: de toegankelijke naam van een lintknop is de tooltip (dus
  // taalafhankelijk) en het zichtbare label verdwijnt in de icoon-only-standen.
  await page.locator('[data-ops-ribbon-item="splitTask"]').click();
  await expect(page.locator('[data-ops-split-mode]')).toBeVisible();
}

test('Splits-modus: slepen op de balk maakt één onderbreking in één undo-stap', async ({ page, ops: _ops }) => {
  const taskId = await seedSplittableTask(page);
  await enableSplitMode(page);

  const before = await state(page);
  const point = await barPoint(page, taskId);
  // Maandag 2026-06-08 = de zesde werkdag, zeven kalenderdagen na de start.
  const downX = await dayColumnX(page, taskId, 7);
  // Donderdag 2026-06-11: drie werkdagen verder ⇒ een pauze van drie werkdagen.
  const upX = await dayColumnX(page, taskId, 10);

  await page.mouse.move(downX, point.y);
  await page.mouse.down();
  await page.mouse.move(upX, point.y, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => splitGapsOf(page, taskId)).toEqual([
    { afterMinutes: 2400, gapMinutes: 1440, source: 'user' },
  ]);
  // De duur is niet veranderd: een onderbreking verplaatst werk, hij voegt er geen toe.
  expect(await durationOf(page, taskId)).toBe(10);
  const after = await state(page);
  expect(after.undoDepth).toBe(before.undoDepth + 1);

  // Eerst de modus uit (anders zou een klik op de balk meteen een tweede onderbreking maken), dan
  // de gewone Ctrl+Z: het hele sleepgebaar is één undo-stap.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await expect.poll(() => splitGapsOf(page, taskId)).toBeNull();
});

test('Splits-modus: een losse klik geeft een pauze van één werkdag', async ({ page, ops: _ops }) => {
  const taskId = await seedSplittableTask(page);
  await enableSplitMode(page);

  const point = await barPoint(page, taskId);
  const downX = await dayColumnX(page, taskId, 7);
  await page.mouse.move(downX, point.y);
  await page.mouse.down();
  await page.mouse.up();

  await expect.poll(() => splitGapsOf(page, taskId)).toEqual([
    { afterMinutes: 2400, gapMinutes: 480, source: 'user' },
  ]);
});

test('Splits-modus: Escape zet de modus uit en haalt het meldingsblok weg', async ({ page, ops: _ops }) => {
  await seedSplittableTask(page);
  await enableSplitMode(page);

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ops-split-mode]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showSplitMode)).toBe(false);
});

test('Splits-modus: een mijlpaal wordt niet gesplitst', async ({ page, ops: _ops }) => {
  // Bewust een mijlpaal MET een balk (de datums blijven staan): zo komt de klik werkelijk op een
  // balk terecht en toetst de test de weigering van `canSplitTask`, niet het ontbreken van een
  // trefvlak.
  const taskId = await seedSplittableTask(page, { milestone: true });
  await enableSplitMode(page);

  const before = await state(page);
  const point = await barPoint(page, taskId);
  const downX = await dayColumnX(page, taskId, 7);
  await page.mouse.move(downX, point.y);
  await page.mouse.down();
  await page.mouse.move(await dayColumnX(page, taskId, 10), point.y, { steps: 6 });
  await page.mouse.up();

  expect(await splitGapsOf(page, taskId)).toBeNull();
  const after = await state(page);
  expect(after.undoDepth).toBe(before.undoDepth);
  expect(after.tasks).toEqual(before.tasks);
});
