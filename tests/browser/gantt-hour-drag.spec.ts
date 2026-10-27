import { barPoint, expect, state, test } from './fixtures/ops';

// Deze route bedient tijdlijnbalken naast de takenlijst en de eigenschappenrail.
// Reserveer expliciet genoeg canvasruimte, onafhankelijk van de standaard paneelbreedte
// (knownbug 60, #627: de standaardbreedte van de takenlijst is 400 px). Bij kwartierzoom is de
// urentaak 1000 px breed en ligt het midden van de balk anders onder de eigenschappenrail.
test.use({ viewport: { width: 1600, height: 900 } });

async function seedHourTask(page: import('@playwright/test').Page, start = '2026-09-07T07:00', finish = '2026-09-07T16:00'): Promise<string> {
  const id = await page.evaluate(({ taskStart, taskFinish }) => {
    const state = window.__OPS__!.store.getState();
    state.setUI({ allowMixedDayHour: true, compressNonWorkdays: false });
    state.setCalendar({
      ...state.calendar,
      workDays: [1, 2, 3, 4, 5],
      workStartHour: 7,
      workEndHour: 16,
      hoursPerDay: 8,
      holidays: [],
      workTime: {
        byWeekday: {
          1: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
          2: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
          3: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
          4: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
          5: [{ start: 420, end: 720 }, { start: 780, end: 960 }],
          6: [], 7: [],
        },
      },
    });
    state.setZoom(1000);
    const id = state.addTask({ name: 'Sleepbare urentaak', manuallyScheduled: true });
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    state.updateTask(id, {
      time: {
        ...task.time,
        durationUnit: 'hours',
        durationMinutes: 480,
        scheduleDuration: 1,
        scheduleStart: taskStart,
        scheduleFinish: taskFinish,
        earlyStart: taskStart,
        earlyFinish: taskFinish,
      },
    });
    state.runCPM();
    // runCPM kan een nieuwe view-origin afleiden; de test moet daarna expliciet op de taakdatum
    // terugzetten voordat hij renderer-eigen pointercoördinaten opvraagt.
    state.setViewStartDate(taskStart.slice(0, 10));
    // `computeEffectiveViewStart` houdt 14 kalenderdagen links als navigatiemarge. Maak de
    // urentaak dus zichtbaar zonder renderergeometrie na te bouwen.
    state.setScroll(14 * 1000 + 200, 0);
    return id;
  }, { taskStart: start, taskFinish: finish });
  // De testdriver leest bewust renderer-eigen geometrie. Wacht daarom op de paint die de
  // storemutatie consumeert; anders kan hij nog de vorige (standaard-)balkpositie teruggeven.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  return id;
}

/** Wacht tot de primaire Gantt-laag ná een storemutatie werkelijk opnieuw is getekend.
 * `barPoint` leest renderer-eigen geometrie uit de LAATSTE paint (`getTaskBarRect`); wie direct na
 * `setUI`/`setScroll` meet, krijgt op een trage machine nog de balkpositie van de vorige as terug. */
async function paintedAfter(page: import('@playwright/test').Page, mutate: () => Promise<void>): Promise<void> {
  const before = await page.evaluate(() => window.__OPS__!.gantt.paintCount('primary'));
  await mutate();
  await expect.poll(
    () => page.evaluate(() => window.__OPS__!.gantt.paintCount('primary')),
    { message: 'de Gantt tekende niet opnieuw na de storemutatie' },
  ).toBeGreaterThan(before);
}

/** Balkpunt dat over twee opeenvolgende peilingen (±100 ms) niet meer beweegt en waartussen geen
 * nieuwe paint viel. Een aswissel kan méér dan één paint kosten (de viewport klemt zijn scroll
 * pas in een vervolgframe); meten na de eerste paint gaf dan nog een tussenstand, waarna de
 * mousedown naast de balk landde (cursor bleef `default`). */
async function settledBarPoint(page: import('@playwright/test').Page, id: string): Promise<{ x: number; y: number }> {
  let last: { x: number; y: number; paints: number } | null = null;
  let stableReads = 0;
  await expect.poll(async () => {
    const now = await page.evaluate(taskId => ({
      point: window.__OPS__!.gantt.taskBarPoint(taskId, 'body', 'primary'),
      paints: window.__OPS__!.gantt.paintCount('primary'),
    }), id);
    if (!now.point) { stableReads = 0; last = null; return false; }
    const unchanged = last !== null && last.paints === now.paints
      && last.x === now.point.x && last.y === now.point.y;
    stableReads = unchanged ? stableReads + 1 : 0;
    last = { ...now.point, paints: now.paints };
    return stableReads >= 2;
  }, { message: `balkpositie van taak ${id} komt niet tot rust` }).toBe(true);
  return { x: last!.x, y: last!.y };
}

async function hourState(page: import('@playwright/test').Page, id: string) {
  return page.evaluate((taskId) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === taskId)!;
    return {
      start: task.time.scheduleStart,
      finish: task.time.scheduleFinish,
      earlyStart: task.time.earlyStart,
      earlyFinish: task.time.earlyFinish,
      unit: task.time.durationUnit,
      minutes: task.time.durationMinutes,
    };
  }, id);
}

test('urentaak-bodydrag bewaart uren en slaat de middagpauze met de taakkalender over', async ({ page, ops: _ops }) => {
  const id = await seedHourTask(page);
  const before = await hourState(page, id);
  const point = await barPoint(page, id, 'body');

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', 'grabbing');
  await page.mouse.move(point.x + 1000, point.y, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => hourState(page, id)).toMatchObject({
    start: '2026-09-08T07:00', finish: '2026-09-08T16:00',
    earlyStart: '2026-09-08T07:00', earlyFinish: '2026-09-08T16:00',
    unit: 'hours', minutes: 480,
  });
  expect(before.unit).toBe('hours');
});

test('urentaak-bodydrag blijft één undo-stap en herstelt exacte minuten en datums', async ({ page, ops: _ops }) => {
  const id = await seedHourTask(page);
  const before = await hourState(page, id);
  const undoDepthBefore = (await state(page)).undoDepth;
  const point = await barPoint(page, id, 'body');

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 1000, point.y, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => state(page).then(snapshot => snapshot.undoDepth)).toBe(undoDepthBefore + 1);
  await page.keyboard.press('Control+z');

  await expect.poll(() => hourState(page, id)).toMatchObject(before);
  await expect.poll(() => state(page).then(snapshot => snapshot.undoDepth)).toBe(undoDepthBefore);
});

test('voorinstelling Dag sleept per hele dag en Uur per uur', async ({ page, ops: _ops }) => {
  const id = await seedHourTask(page);
  await page.locator('.ribbon-tab').filter({ hasText: /^(View|Beeld)$/ }).click();
  const scale = page.locator('[data-tour-anchor="ribbon-group:beeld:timeScale"] button').filter({ hasText: /▼/ });
  for (const [preset, zoom, pixels, expected] of [
    [/^(Day|Dag)$/, 100, 100, '2026-09-08T07:00'],
    [/^(Hour|Uur)$/, 1000, 1000 / 24, '2026-09-08T08:00'],
    [/^(Hour|Uur)$/, 1000, 1000 / 96, '2026-09-08T08:15'],
  ] as const) {
    if (pixels === 1000 / 96) await page.evaluate(() => window.__OPS__!.store.getState().setUI({ enableQuarterHourZoom: true }));
    await scale.click();
    await page.getByRole('button', { name: preset, exact: true }).click();
    await expect.poll(() => state(page).then(s => s.view.zoom)).toBe(zoom);
    await paintedAfter(page, () => page.evaluate(taskId => {
      const s = window.__OPS__!.store.getState();
      const left = window.__OPS__!.gantt.taskBarPoint(taskId, 'left')!;
      const canvas = document.querySelector('[data-testid="gantt-primary-canvas"]')!.getBoundingClientRect();
      s.setScroll(s.view.scrollX + left.x - canvas.left - 100, 0);
    }, id));
    const point = await settledBarPoint(page, id);
    if (zoom === 100) {
      const before = await hourState(page, id);
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.mouse.move(point.x + 100 / 24, point.y, { steps: 2 });
      await page.mouse.up();
      await expect.poll(() => hourState(page, id)).toMatchObject(before);
    }
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', 'grabbing');
    await page.mouse.move(point.x + pixels, point.y, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => hourState(page, id)).toMatchObject({ start: expected, unit: 'hours', minutes: 480 });
    if (pixels === 1000 / 96) continue;
    const canvas = page.getByTestId('gantt-primary-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Tijdkop ontbreekt');
    for (const uiTheme of ['light', 'dark'] as const) {
      await paintedAfter(page, () => page.evaluate(theme => window.__OPS__!.store.getState().setUI({ uiTheme: theme }), uiTheme));
      await page.screenshot({ path: `artifacts/uren-f4a/tijdkop-${zoom === 100 ? 'dag' : 'uur'}-${uiTheme}.png`, clip: { x: box.x, y: box.y, width: Math.min(box.width, 1000), height: 100 } });
    }
  }
});

test('urentaak-rechterrand telt alleen werkuren en landt op de bandgrens vóór de pauze', async ({ page, ops: _ops }) => {
  const id = await seedHourTask(page);
  const point = await barPoint(page, id, 'right');
  // De renderertekent de sub-dagbalk met een fractionele eindpixel. Pak twee CSS-pixels binnen de
  // rechterkant, zodat Playwrights integer muiscoördinaat niet nét buiten de hitzone afrondt.
  const edgeX = point.x - 2;

  await page.mouse.move(edgeX, point.y);
  await page.mouse.down();
  await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', 'ew-resize');
  // Vier uur op de 1000px/dag-as: 16:00 → 12:00. De pauze zelf wordt nooit duur.
  await page.mouse.move(edgeX - (1000 / 6), point.y, { steps: 5 });
  await page.mouse.up();

  await expect.poll(() => hourState(page, id)).toMatchObject({
    start: '2026-09-07T07:00', finish: '2026-09-07T12:00',
    unit: 'hours', minutes: 300,
  });
});

test('urentaak volgt onder werkdagen-as de getekende maandag-vrijdag-naad', async ({ page, ops: _ops }) => {
  const id = await seedHourTask(page, '2026-09-11T07:00', '2026-09-11T16:00');
  // De as wisselt hier van kalenderdagen naar werkdagen én de scroll verspringt. Onder de oude as
  // (scroll 14200) en de nieuwe (scroll 10000) staat de balk toevallig op vrijwel dezelfde plek, dus
  // een meting uit de nog niet ververste paint greep de balk nog wél — maar de sleep rekende dan
  // met een `pointerStart` van de verkeerde as en landde weer op vrijdag (CI, 1 en 3 sep 2026).
  // Wacht daarom expliciet op de paint die de compressie consumeert vóór er wordt gemeten.
  await paintedAfter(page, () => page.evaluate(() => {
    const state = window.__OPS__!.store.getState();
    state.setUI({ compressNonWorkdays: true });
    // Vrijdag 11 september ligt vanaf vrijdag 28 augustus precies tien zichtbare werkdagen verder.
    state.setScroll(10 * 1000, 0);
  }));
  const point = await settledBarPoint(page, id);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', 'grabbing');
  // Eén zichtbare werkdagenkolom is bij zoom 1000 precies één dagbreedte.
  await page.mouse.move(point.x + 1000, point.y, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => hourState(page, id)).toMatchObject({
    start: '2026-09-14T07:00', finish: '2026-09-14T16:00',
    unit: 'hours', minutes: 480,
  });
});
