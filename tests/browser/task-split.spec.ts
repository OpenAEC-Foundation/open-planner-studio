// F2: taakdatums worden op D1/D2/D7-momenten vergeleken (§4.2); de echte handeling blijft gelijk.
// De splits-modus (issue #146, etappe 2): knop in het lint, gekleurd meldingsblok, en het gebaar
// "klik op de dag waar de onderbreking begint, sleep naar rechts voor de lengte".
//
// Alle handelingen lopen via echte muis- en toetsevents; de dev-brug zet alleen de fixture klaar
// en leest de domeinstate terug. De muispositie wordt uit de canvasgeometrie afgeleid die de brug
// al blootgeeft (`taskBarPoint`) plus de zoom — geen pixel-asserties.
import { isWellFormedSplit } from '@/engine/scheduler/splitEdit';
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

test('Splits-modus: een door een voorganger opgeschoven taak splitst waar je klikt (#171)', async ({ page, ops: _ops }) => {
  // De opvolger houdt zijn `scheduleStart`-anker op de projectstart; alleen `earlyStart` (waar de
  // balk staat) schuift mee. Het gebaar mat vanaf het anker en splitste dus twee weken te vroeg.
  const [predId, succId] = await seedProject(page, [
    { name: 'Voorganger', start: START, finish: FINISH, durationDays: 10 },
    { name: 'Opvolger', start: START, finish: FINISH, durationDays: 10 },
  ]);
  await page.evaluate(({ pred, succ }) => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ compressNonWorkdays: false, showPropertiesPanel: false, rightPanelCollapsed: true });
    s.setZoom(20);
    s.setScroll(0, 0);
    for (const id of [pred, succ]) s.updateTask(id, { manuallyScheduled: false });
    s.addSequence({ predecessorId: pred, successorId: succ, type: 'FINISH_START', lagDays: 0 });
    s.runCPM();
  }, { pred: predId, succ: succId });
  await expect.poll(() => page.evaluate((id) => {
    const t = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
    return [t.time.scheduleStart, t.time.earlyStart];
  }, succId)).toEqual([`${START}T07:00`, "2026-06-15T07:00"]);
  await enableSplitMode(page);

  const point = await barPoint(page, succId);
  // Maandag 2026-06-22: zeven kalenderdagen na de balkstart = na vijf werkdagen.
  await page.mouse.move(await dayColumnX(page, succId, 7), point.y);
  await page.mouse.down();
  await page.mouse.up();

  await expect.poll(() => splitGapsOf(page, succId)).toEqual([
    { afterMinutes: 2400, gapMinutes: 480, source: 'user' },
  ]);
  // Het voorlopige balkeinde telt vanaf de balkstart: 11 werkdagen spanne ⇒ maandag 29 juni.
  expect(await page.evaluate((id) => (
    window.__OPS__!.store.getState().tasks.find(task => task.id === id)!.time.earlyFinish
  ), succId)).toBe("2026-06-29T16:00");
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

// ── Etappe 3: buiten de splits-modus de stukken zelf bewerken ────────────────────────────────────

const DAY = 480;

/** Zet via de ENE schrijfweg een split klaar: `pieces` in werkdagen, afwisselend werk/pauze. */
async function seedSplit(page: Page, taskId: string, days: number[]): Promise<void> {
  const refusal = await page.evaluate(({ id, pieces }) => (
    window.__OPS__!.store.getState().setTaskSplits(id, pieces as never)
  ), {
    id: taskId,
    pieces: days.map((d, i) => ({ kind: i % 2 === 0 ? 'work' : 'gap', minutes: d * DAY, ...(i % 2 ? { source: 'user' } : {}) })),
  });
  expect(refusal).toBeNull();
  // Het contextmenu en de hit-test lezen de GETEKENDE taak, niet de store. Wacht dus tot de Gantt de
  // nieuwe stukken getekend heeft; anders kan een rechtsklik nét vóór de repaint vallen en een menu
  // zonder splitsitems openen (gezien in CI op een trage runner, PR #177).
  const workPieces = Math.ceil(days.length / 2);
  await expect.poll(() => page.evaluate(id => window.__OPS__!.gantt.taskSegmentCount(id), taskId))
    .toBe(workPieces);
}

async function drag(page: Page, from: { x: number; y: number }, toX: number): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(toX, from.y, { steps: 8 });
  await page.mouse.up();
}

test('Stuk slepen: de pauze ervoor groeit en krimpt, tegen het vorige stuk = samenvoegen', async ({ page, ops: _ops }) => {
  const taskId = await seedSplittableTask(page);
  // 5 werkdagen | 3 werkdagen pauze | 5 werkdagen ⇒ ma 06-01–vr 06-05 | ma–wo | do 06-11–wo 06-17.
  await seedSplit(page, taskId, [5, 3, 5]);
  const y = (await barPoint(page, taskId)).y;

  // Grijp stuk 2 op ma 06-15 en sleep naar wo 06-17: twee werkdagen later ⇒ pauze 3 + 2 = 5.
  const before = await state(page);
  await drag(page, { x: await dayColumnX(page, taskId, 14), y }, await dayColumnX(page, taskId, 16));
  await expect.poll(() => splitGapsOf(page, taskId)).toEqual([
    { afterMinutes: 2400, gapMinutes: 2400, source: 'user' },
  ]);
  expect(await durationOf(page, taskId)).toBe(10);
  const afterGrow = await state(page);
  expect(afterGrow.undoDepth).toBe(before.undoDepth + 1);

  // Stuk 2 staat nu op ma 06-15–vr 06-19. Grijp het op wo 06-17 en sleep tot ma 06-08, voorbij het
  // einde van stuk 1: de pauze valt weg en de stukken zijn weer één balk.
  await drag(page, { x: await dayColumnX(page, taskId, 16), y }, await dayColumnX(page, taskId, 7));
  await expect.poll(() => splitGapsOf(page, taskId)).toBeNull();
  expect(await durationOf(page, taskId)).toBe(10);
  const afterMerge = await state(page);
  expect(afterMerge.undoDepth).toBe(afterGrow.undoDepth + 1);

  // Eén gebaar = één undo-stap: Ctrl+Z haalt precies de langere pauze terug.
  await page.keyboard.press('Control+z');
  await expect.poll(() => splitGapsOf(page, taskId)).toEqual([
    { afterMinutes: 2400, gapMinutes: 2400, source: 'user' },
  ]);
});

test('Stukrand slepen: stuk 1 één werkdag korter maakt de taak één werkdag korter', async ({ page, ops: _ops }) => {
  const taskId = await seedSplittableTask(page);
  await seedSplit(page, taskId, [5, 3, 5]);
  const y = (await barPoint(page, taskId)).y;
  const zoom = (await state(page)).view.zoom;
  // D1: de exclusieve grens van het dagslot ligt op maandag 07:00, na het weekend.
  // Naar vrijdag = één werkdag korter; de nieuwe datumvorm verandert de dagenmaat niet.
  const edgeX = (await barPoint(page, taskId, 'left')).x + 7 * zoom - 2;
  await page.mouse.move(edgeX, y);
  await page.mouse.down();
  await page.mouse.move(await dayColumnX(page, taskId, 4), y, { steps: 8 });
  await expect(page.getByTestId('split-drag-label')).toHaveText(/\b4\b/);
  await page.mouse.up();
  await expect(page.getByTestId('split-drag-label')).toHaveCount(0);
  await expect.poll(() => splitGapsOf(page, taskId)).toEqual([
    { afterMinutes: 1920, gapMinutes: 1440, source: 'user' },
  ]);
  expect(await durationOf(page, taskId)).toBe(9);
});

test('Contextmenu: één onderbreking of alle onderbrekingen opheffen', async ({ page, ops: _ops }) => {
  const taskId = await seedSplittableTask(page);
  await seedSplit(page, taskId, [5, 3, 5]);
  const y = (await barPoint(page, taskId)).y;
  const removeOne = page.getByRole('button', { name: /^(Remove break|Onderbreking opheffen)$/ });
  const removeAll = page.getByRole('button', { name: /^(Remove all breaks|Alle onderbrekingen opheffen)$/ });

  // Op stuk 1 ligt er geen pauze vóór het stuk: alleen "alle" staat er.
  await page.mouse.click(await dayColumnX(page, taskId, 2), y, { button: 'right' });
  await expect(removeAll).toBeVisible();
  await expect(removeOne).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(removeAll).toHaveCount(0);

  // Op stuk 2: de pauze ervóór opheffen.
  await page.mouse.click(await dayColumnX(page, taskId, 14), y, { button: 'right' });
  await removeOne.click();
  await expect.poll(() => splitGapsOf(page, taskId)).toBeNull();
  expect(await durationOf(page, taskId)).toBe(10);

  // Twee pauzes (3 | 1 | 3 | 1 | 4): "alle" haalt ze in één keer weg.
  await seedSplit(page, taskId, [3, 1, 3, 1, 4]);
  await page.mouse.click(await dayColumnX(page, taskId, 1), y, { button: 'right' });
  await removeAll.click();
  await expect.poll(() => splitGapsOf(page, taskId)).toBeNull();
  expect(await durationOf(page, taskId)).toBe(10);
});

test('Pauze: geen grijphand en geen pan — een klik selecteert alleen de taak', async ({ page, ops: _ops }) => {
  const taskId = await seedSplittableTask(page);
  await seedSplit(page, taskId, [5, 3, 5]);
  const y = (await barPoint(page, taskId)).y;
  // Ma 06-08 ligt in de pauze (ma–wo na het eerste stuk).
  const gapX = await dayColumnX(page, taskId, 7);
  await page.mouse.move(gapX, y);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('canvas')!).cursor)).toBe('default');
  const before = await state(page);
  await page.evaluate(() => window.__OPS__!.store.getState().deselectAll());
  await page.mouse.move(gapX, y);
  await page.mouse.down();
  await page.mouse.move(gapX + 60, y, { steps: 4 });
  await page.mouse.up();
  const after = await state(page);
  expect(after.view.scrollX).toBe(before.view.scrollX);
  expect(after.selectedTaskIds).toEqual([taskId]);
  expect(await splitGapsOf(page, taskId)).toEqual([{ afterMinutes: 2400, gapMinutes: 1440, source: 'user' }]);
});

// ── Etappe 4: de sectie "Onderbrekingen" in het eigenschappenpaneel ──────────────────────────────

/** Paneel open, taak geselecteerd, datumnotatie vast (de van–tot-datums lopen via `useDisplayDate`). */
async function openPanelFor(page: Page, taskId: string): Promise<void> {
  await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false, dateNotation: 'dmy' });
    s.selectTask(id);
  }, taskId);
}

/** Ctrl+Z buiten een invoerveld: in een input is het de eigen tekst-undo van de browser. */
async function undoFromOutsideInput(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+z');
}

test('Paneel: na en pauze exact invoeren, verwijderen, en elke stap is één undo-stap', async ({ page, ops: _ops }) => {
  const taskId = await seedSplittableTask(page);
  // 5 werkdagen | 3 werkdagen pauze | 5 werkdagen ⇒ stuk 2 loopt do 11-06 – wo 17-06.
  await seedSplit(page, taskId, [5, 3, 5]);
  await openPanelFor(page, taskId);

  const row = page.locator('[data-ops-split-row="0"]');
  const after = row.locator('[data-ops-split-after]');
  const pause = row.locator('[data-ops-split-pause]');
  await expect(after).toHaveValue('5');
  await expect(pause).toHaveValue('3');
  await expect(row.locator('[data-ops-split-dates]')).toHaveText('11-06-2026 – 17-06-2026');
  const start = await state(page);

  // Een geweigerde invoer ("na 0": geen werk vóór de pauze) zet het veld terug en muteert niets.
  await after.fill('0');
  await after.press('Enter');
  await expect(after).toHaveValue('5');
  expect((await state(page)).undoDepth).toBe(start.undoDepth);

  await pause.fill('5');
  await pause.press('Enter');
  await expect.poll(() => splitGapsOf(page, taskId)).toEqual([
    { afterMinutes: 2400, gapMinutes: 2400, source: 'user' },
  ]);
  expect((await state(page)).undoDepth).toBe(start.undoDepth + 1);

  await after.fill('4');
  await after.press('Enter');
  await expect.poll(() => splitGapsOf(page, taskId)).toEqual([
    { afterMinutes: 1920, gapMinutes: 2400, source: 'user' },
  ]);
  expect(await durationOf(page, taskId)).toBe(9);
  expect((await state(page)).undoDepth).toBe(start.undoDepth + 2);

  await row.locator('[data-ops-split-remove]').click();
  await expect.poll(() => splitGapsOf(page, taskId)).toBeNull();
  await expect(page.locator('[data-ops-split-row]')).toHaveCount(0);
  expect((await state(page)).undoDepth).toBe(start.undoDepth + 3);

  // Ctrl+Z loopt de drie stappen één voor één terug.
  await undoFromOutsideInput(page);
  await expect.poll(() => splitGapsOf(page, taskId)).toEqual([
    { afterMinutes: 1920, gapMinutes: 2400, source: 'user' },
  ]);
  await undoFromOutsideInput(page);
  await expect.poll(() => splitGapsOf(page, taskId)).toEqual([
    { afterMinutes: 2400, gapMinutes: 2400, source: 'user' },
  ]);
  expect(await durationOf(page, taskId)).toBe(10);
  await undoFromOutsideInput(page);
  await expect.poll(() => splitGapsOf(page, taskId)).toEqual([
    { afterMinutes: 2400, gapMinutes: 1440, source: 'user' },
  ]);
  await expect(pause).toHaveValue('3');
});

test('Paneel: Onderbreking toevoegen splitst halverwege met één werkdag pauze', async ({ page, ops: _ops }) => {
  const taskId = await seedSplittableTask(page);
  await openPanelFor(page, taskId);
  await expect(page.locator('[data-ops-split-row]')).toHaveCount(0);

  await page.locator('[data-ops-split-add]').click();
  await expect.poll(() => splitGapsOf(page, taskId)).toEqual([
    { afterMinutes: 2400, gapMinutes: 480, source: 'user' },
  ]);
  await expect(page.locator('[data-ops-split-row="0"] [data-ops-split-after]')).toHaveValue('5');
  await expect(page.locator('[data-ops-split-row="0"] [data-ops-split-pause]')).toHaveValue('1');

  await undoFromOutsideInput(page);
  await expect.poll(() => splitGapsOf(page, taskId)).toBeNull();
});

test('Paneel: een mijlpaal krijgt geen sectie Onderbrekingen', async ({ page, ops: _ops }) => {
  const taskId = await seedSplittableTask(page, { milestone: true });
  await openPanelFor(page, taskId);
  await expect(page.locator('[data-ops-dependency-add]')).toBeVisible();
  await expect(page.locator('[data-ops-split-add]')).toHaveCount(0);
});

// F4a/T24: kalenderafhankelijke pointer en afstand, apart van het minimum.
// Eén route met een andere kalenderfixture per stap; alle bewerkingen zijn echte muisgebaren.
test('F4a: splitsen en stukslepen bij dagzoom volgen de werkdag van de taakkalender', async ({ page, ops: _ops }) => {
  test.setTimeout(120_000);
  const [taskId] = await seedProject(page, [{ name: 'Kalendersplit', start: START, finish: '2026-06-30', durationDays: 20 }]);
  const seed = async (kind: 'eight' | 'short' | 'half' | 'midday' | 'night', minutes = 4800) => {
    await page.evaluate(({ id, kind, minutes }) => {
      const s = window.__OPS__!.store.getState();
      const normal = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
      const bands = kind === 'night' ? [{ start: 1320, end: 1800 }]
        : kind === 'half' ? [{ start: 420, end: 930 }] : normal;
      s.setCalendar({ ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [], hoursPerDay: 8,
        workStartHour: 7, workEndHour: 16, workTime: { byWeekday: {
          1: bands, 2: bands, 3: bands, 4: bands,
          5: kind === 'short' ? [{ start: 420, end: 780 }] : bands, 6: [], 7: [],
        } } });
      s.setUI({ compressNonWorkdays: false, showPropertiesPanel: false, rightPanelCollapsed: true, barSplitMode: 'never', showSplitMode: false });
      const start = kind === 'night' ? '2026-06-01T22:00' : kind === 'midday' ? '2026-06-01T13:00' : '2026-06-01T07:00';
      const task = window.__OPS__!.store.getState().tasks.find(t => t.id === id)!;
      s.updateTask(id, { manuallyScheduled: false, splitGaps: undefined, time: { ...task.time,
        durationUnit: 'hours', durationMinutes: minutes, scheduleDuration: minutes / 480,
        scheduleStart: start, earlyStart: start, scheduleFinish: '2026-06-30T16:00', earlyFinish: '2026-06-30T16:00',
      } });
      s.setViewStartDate('2026-06-01');
      s.setZoom(100);
      s.setScroll(1400, 0);
    }, { id: taskId, kind, minutes });
    await expect.poll(() => page.evaluate(id => window.__OPS__!.gantt.taskSegmentCount(id), taskId)).toBe(1);
  };
  const pointAt = async (day: string, hour = 12) => {
    const canvas = await page.getByTestId('gantt-primary-canvas').boundingBox();
    if (!canvas) throw new Error('Gantt ontbreekt');
    const x = await page.evaluate(date => window.__OPS__!.gantt.dateX(date), day);
    if (x === null) throw new Error('Datum ontbreekt op de as');
    return { x: canvas.x + x + hour / 24 * 100, y: (await barPoint(page, taskId)).y };
  };
  const split = async (day: string, hour = 12) => {
    await enableSplitMode(page);
    const p = await pointAt(day, hour);
    await page.mouse.click(p.x, p.y);
    await page.keyboard.press('Escape');
  };
  const asDays = async () => {
    await page.evaluate(id => {
      const s = window.__OPS__!.store.getState();
      const task = s.tasks.find(t => t.id === id)!;
      s.updateTask(id, { time: { ...task.time, durationUnit: 'days', durationMinutes: undefined, scheduleDuration: 30,
        scheduleStart: '2026-06-01', earlyStart: '2026-06-01', scheduleFinish: '2026-07-10', earlyFinish: '2026-07-10',
      } });
    }, taskId);
  };
  const gaps = () => splitGapsOf(page, taskId);
  await seed('eight', 960);
  await split('2026-06-02');
  await expect.poll(gaps).toEqual([{ afterMinutes: 480, gapMinutes: 480, source: 'user' }]);
  // Stuk 2 van woensdag naar donderdag: pauze 480 → 960; daarna naar dinsdag: nul → samenvoegen.
  let p = await pointAt('2026-06-03', 10);
  await drag(page, p, (await pointAt('2026-06-04', 10)).x);
  await expect.poll(gaps).toEqual([{ afterMinutes: 480, gapMinutes: 960, source: 'user' }]);
  p = await pointAt('2026-06-04', 10);
  await drag(page, p, (await pointAt('2026-06-02', 10)).x);
  await expect.poll(gaps).toBeNull();

  // Werkstuk van één naar twee werkdagen; grijp twee pixels binnen het eerste blokeinde.
  await seed('eight', 1920);
  await split('2026-06-02');
  p = await pointAt('2026-06-01', 16);
  await drag(page, { x: p.x - 2, y: p.y }, (await pointAt('2026-06-02', 16)).x - 2);
  await expect.poll(gaps).toEqual([{ afterMinutes: 960, gapMinutes: 480, source: 'user' }]);

  await seed('short');
  await split('2026-06-05');
  await expect.poll(gaps).toEqual([{ afterMinutes: 1920, gapMinutes: 360, source: 'user' }]);
  // Een pauze die op donderdag begint, groeit over de korte vrijdag met precies 360 minuten.
  await seed('short');
  await split('2026-06-04');
  p = await pointAt('2026-06-05', 9);
  await drag(page, p, (await pointAt('2026-06-08', 9)).x);
  await expect.poll(gaps).toEqual([{ afterMinutes: 1440, gapMinutes: 840, source: 'user' }]);

  await seed('half');
  await split('2026-06-02');
  await expect.poll(gaps).toEqual([{ afterMinutes: 510, gapMinutes: 510, source: 'user' }]);

  await seed('midday');
  await page.evaluate(() => window.__OPS__!.store.getState().setScroll(1100, 0));
  await split('2026-06-02');
  await expect.poll(gaps).toEqual([{ afterMinutes: 180, gapMinutes: 480, source: 'user' }]);
  p = await pointAt('2026-06-01', 16);
  await drag(page, { x: p.x - 2, y: p.y }, (await pointAt('2026-05-29', 15)).x);
  await expect.poll(gaps).toEqual([{ afterMinutes: 180, gapMinutes: 480, source: 'user' }]);

  await seed('night');
  await split('2026-06-02');
  await expect.poll(gaps).toEqual([{ afterMinutes: 480, gapMinutes: 480, source: 'user' }]);
  // De eerste ploeg blijft volledig staan wanneer de planner de eerste stukrand naar links trekt.
  await seed('night', 1920);
  await page.evaluate(() => window.__OPS__!.store.getState().setViewStartDate('2026-05-29'));
  await split('2026-06-02');
  p = await pointAt('2026-06-02', 6);
  await page.mouse.move(p.x - 2, p.y);
  await page.mouse.down();
  await page.mouse.move((await pointAt('2026-05-29', 12)).x, p.y, { steps: 8 });
  const nightLabel = await page.getByTestId('split-drag-label').textContent();
  await page.mouse.up();
  const night = await page.evaluate(id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!, taskId);
  console.log('NACHTGRENS', JSON.stringify({ gaps: night.splitGaps, minutes: night.time.durationMinutes,
    valid: isWellFormedSplit(night.splitGaps, night.time.durationMinutes!), label: nightLabel }));
  expect(night.splitGaps).toEqual([{ afterMinutes: 480, gapMinutes: 480, source: 'user' }]);
  expect(nightLabel).toBe('Piece: 1 workday');
  expect(night.time.durationMinutes).toBe(1920);
  expect(isWellFormedSplit(night.splitGaps, night.time.durationMinutes!)).toBe(true);

  await seed('night');
  await split('2026-06-06', 2);
  await expect.poll(gaps).toEqual([{ afterMinutes: 1920, gapMinutes: 480, source: 'user' }]);
  await seed('night');
  await split('2026-06-06', 10);
  await expect.poll(gaps).toEqual([{ afterMinutes: 2400, gapMinutes: 480, source: 'user' }]);

  // Drie korte vrijdagen mogen de split niet één dag naar voren trekken.
  await seed('short');
  await asDays();
  await page.evaluate(() => window.__OPS__!.store.getState().setScroll(2800, 0));
  await split('2026-06-22');
  console.log('DAGSLOTS', JSON.stringify(await gaps()));
  await expect.poll(gaps).toEqual([{ afterMinutes: 7200, gapMinutes: 480, source: 'user' }]);
  // Lees de werkelijk getekende grenzen. Het eerste einde is exclusief: maandag 00:00
  // betekent dat het eerste stuk tot en met vrijdag werkt. De pauze neemt maandag in beslag.
  const drawn = await page.evaluate(async id => {
    const modulePath = '/src/engine/renderer/GanttRenderer.ts';
    const { GanttRenderer } = await import(/* @vite-ignore */ modulePath);
    const proto = GanttRenderer.prototype;
    const original = proto.getDrawnSegmentCount;
    let bounds: { start: string; end: string }[] = [];
    proto.getDrawnSegmentCount = function(taskId: string) {
      bounds = this.splitSegmentsByTask.get(taskId)?.map((segment: { x1: number; x2: number }) => ({
        start: this.axis.xToDate(segment.x1).toISOString(), end: this.axis.xToDate(segment.x2).toISOString(),
      })) ?? [];
      return original.call(this, taskId);
    };
    try { window.__OPS__!.gantt.taskSegmentCount(id); } finally { proto.getDrawnSegmentCount = original; }
    return bounds;
  }, taskId);
  console.log('GETEKENDE GRENZEN', JSON.stringify(drawn));
  expect(drawn[0].end).toBe('2026-06-22T07:00:00.000Z'); // D1: exclusieve dagslotgrens.
  expect(drawn[1].start).toBe('2026-06-23T07:00:00.000Z'); // D1: de dagenmaat blijft leidend.

  // Tot F3/F4b bewaart een echte dagtaak (zonder tijdstippen) het bestaande dagslotcontract.
  await seed('short');
  await asDays();
  await split('2026-06-08');
  await expect.poll(gaps).toEqual([{ afterMinutes: 2400, gapMinutes: 480, source: 'user' }]);
  await seed('short');
  await asDays();
  await split('2026-06-04');
  p = await pointAt('2026-06-05', 9);
  await drag(page, p, (await pointAt('2026-06-08', 9)).x);
  await expect.poll(gaps).toEqual([{ afterMinutes: 1440, gapMinutes: 960, source: 'user' }]);
});
