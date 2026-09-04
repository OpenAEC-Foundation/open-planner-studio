import { barPoint, expect, state, test } from './fixtures/ops';

async function seedHourTask(page: import('@playwright/test').Page, start = '2026-09-07T07:00', finish = '2026-09-07T16:00'): Promise<string> {
  const id = await page.evaluate(({ taskStart, taskFinish }) => {
    const state = window.__OPS__!.store.getState();
    state.setUI({ enableHourPlanning: true, allowMixedDayHour: true, compressNonWorkdays: false });
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

test('bestaande urentaak behoudt zijn werkminuten wanneer urenplanning uit staat', async ({ page, ops: _ops }) => {
  const id = await seedHourTask(page);
  await page.evaluate(() => {
    const state = window.__OPS__!.store.getState();
    state.setUI({ enableHourPlanning: false });
    // De dagmodus begrenst 1000px/dag naar 400px/dag; volg die bestaande viewportregel in plaats
    // van een punt uit een niet meer zichtbare balk als dragstart te gebruiken.
    state.setScroll(14 * 400 + 80, 0);
  });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  const point = await barPoint(page, id, 'body');

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(page.getByTestId('gantt-primary-canvas')).toHaveCSS('cursor', 'grabbing');
  // Zonder urenplanning is de actieve rasterstap een dag, maar de reeds bestaande taak mag niet
  // naar een dagtaak worden omgezet of zijn minuten kwijtraken.
  await page.mouse.move(point.x + 400, point.y, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => hourState(page, id)).toMatchObject({
    start: '2026-09-08T07:00', finish: '2026-09-08T16:00',
    unit: 'hours', minutes: 480,
  });
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
  await page.evaluate(() => {
    const state = window.__OPS__!.store.getState();
    state.setUI({ compressNonWorkdays: true });
    // Vrijdag 11 september ligt vanaf vrijdag 28 augustus precies tien zichtbare werkdagen verder.
    state.setScroll(10 * 1000, 0);
  });
  // Zelfde reden als bij seedHourTask/de vorige test: barPoint leest renderer-eigen geometrie, en
  // zonder deze wacht kan hij nog de as van vóór de compressNonWorkdays-mutatie teruggeven.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  const point = await barPoint(page, id, 'body');

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
