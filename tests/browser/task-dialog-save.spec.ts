// F2: taakdatums worden op D1/D2/D7-momenten vergeleken (§4.2); de echte handeling blijft gelijk.
// "Taak bewerken" → Opslaan, met echte events (dubbelklik op de balk, schuif via het toetsenbord,
// klik op Opslaan, Ctrl+Z). Twee eigenschappen die de dialoog met het eigenschappenpaneel moet delen:
//
//   (1) VOORTGANGSREGELS — Opslaan past dezelfde regels toe als de paneelschuif (`setTaskProgress`:
//       status, werkelijk einde bij 100%, resterende duur). Vóór de fix schreef de dialoog de
//       voortgangsvelden kaal weg: de status bleef NOT_STARTED/STARTED en een eerder (via het paneel)
//       gezette resterende duur bleef staan, zodat de taak in de planning te laat eindigde.
//   (2) ÉÉN UNDO-STAP — één keer Opslaan is één handeling. Vóór de fix gaf een gewijzigde ouder of
//       een voor het eerst gebruikt persoonlijk taaktype 2–3 undo-stappen, en draaide één Ctrl+Z maar
//       een deel terug.
//
// De brug zet alleen fixtures (taken, statusdatum, eerdere voortgang = de paneelactie) en leest state;
// herberekenen gaat via `runCPM` omdat dat niet de geteste handeling is.
import type { Page } from '@playwright/test';
import { barPoint, expect, state, test } from './fixtures/ops';

interface TaskView {
  name: string;
  parentId: string | null;
  customTaskTypeId: string | null;
  completion: number;
  status: string;
  remainingTime: number | null;
  actualStart: string | null;
  actualFinish: string | null;
  earlyFinish: string | null;
}

/** Niet-handmatige taken van 10 werkdagen vanaf maandag 2 maart 2026, statusdatum vrijdag 6 maart. */
async function seedTenDayTasks(page: Page, names: string[]): Promise<string[]> {
  const ids = await page.evaluate((taskNames) => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ name: 'Dialoogvoortgang', startDate: '2026-03-02', statusDate: '2026-03-06' });
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    const created = taskNames.map((name) => {
      const id = s.addTask({ name });
      const current = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
      window.__OPS__!.store.getState().updateTask(id, {
        time: { ...current.time, scheduleStart: '2026-03-02', scheduleDuration: 10 },
      });
      return id;
    });
    const after = window.__OPS__!.store.getState();
    after.runCPM();
    // Balken van 2 t/m 20 maart ruim in beeld, ook met het eigenschappenpaneel open.
    after.setViewStartDate('2026-03-02');
    after.setZoom(18);
    after.setScroll(0, 0);
    return created;
  }, names);
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.length)).toBe(names.length);
  return ids;
}

function readTask(page: Page, taskId: string): Promise<TaskView> {
  return page.evaluate((id) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return {
      name: task.name,
      parentId: task.parentId ?? null,
      customTaskTypeId: task.customTaskTypeId ?? null,
      completion: task.time.completion,
      status: task.status,
      remainingTime: task.time.remainingTime ?? null,
      actualStart: task.time.actualStart ?? null,
      actualFinish: task.time.actualFinish ?? null,
      earlyFinish: task.time.earlyFinish ?? null,
    };
  }, taskId);
}

/** Alleen de voortgangs- en datumvelden (naam/ouder/type verschillen tussen de vergeleken taken). */
async function progressOf(page: Page, taskId: string) {
  const { completion, status, remainingTime, actualStart, actualFinish, earlyFinish } = await readTask(page, taskId);
  return { completion, status, remainingTime, actualStart, actualFinish, earlyFinish };
}

async function recalculate(page: Page): Promise<void> {
  await page.evaluate(() => window.__OPS__!.store.getState().runCPM());
}

/** Dubbelklik op de Gantt-balk opent "Taak bewerken". */
async function openDialogByDoubleClick(page: Page, taskId: string) {
  const point = await barPoint(page, taskId);
  await page.mouse.dblclick(point.x, point.y);
  const dialog = page.locator('[data-ops-task-dialog]');
  await expect(dialog).toBeVisible();
  // Controleer de beginfocus voordat de gebruiker hem naar de schuif verplaatst.
  // De focus-trap kiest het naamveld met de volledige, geïnitialiseerde naam geselecteerd.
  await expect(dialog.locator('[data-ops-task-name]')).toBeFocused();
  return dialog;
}

/** Schuif met het toetsenbord: `steps` keer → (1% per stap) of `End` voor 100%. */
async function pressSlider(page: Page, slider: ReturnType<Page['locator']>, keys: { right?: number; end?: boolean }) {
  await slider.focus();
  if (keys.end) await page.keyboard.press('End');
  for (let i = 0; i < (keys.right ?? 0); i++) await page.keyboard.press('ArrowRight');
}

test('Taak bewerken: voortgang opslaan volgt dezelfde regels als het eigenschappenpaneel', async ({ page, ops: _ops }) => {
  const [panelId, dialogId] = await seedTenDayTasks(page, ['Metselwerk paneel', 'Metselwerk dialoog']);
  // Week 1: beide taken kregen 20% via het paneel (fixture = de paneelactie zelf), daarna week 2.
  await page.evaluate((ids) => {
    const s = window.__OPS__!.store.getState();
    for (const id of ids) s.setTaskProgress(id, 0.2);
    s.runCPM();
    s.setProject({ statusDate: '2026-03-13' });
    s.runCPM();
  }, [panelId, dialogId]);
  expect((await readTask(page, dialogId)).remainingTime).toBe(8);

  // Referentie: paneelschuif naar 60% (klik op de balk selecteert de taak in het paneel).
  const panelPoint = await barPoint(page, panelId);
  await page.mouse.click(panelPoint.x, panelPoint.y);
  const panelSlider = page.locator('[data-ops-progress-slider]').first();
  await expect(panelSlider).toHaveValue('20');
  await pressSlider(page, panelSlider, { right: 40 });
  await expect.poll(() => readTask(page, panelId).then(task => task.completion)).toBe(0.6);

  // Dialoog: dubbelklik, schuif naar 60%, Opslaan.
  let dialog = await openDialogByDoubleClick(page, dialogId);
  await pressSlider(page, dialog.locator('[data-ops-progress-slider]'), { right: 40 });
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();
  await recalculate(page);

  const panelAt60 = await progressOf(page, panelId);
  expect(panelAt60).toMatchObject({ completion: 0.6, status: 'STARTED', remainingTime: 4 });
  expect(await progressOf(page, dialogId)).toEqual(panelAt60);

  // 100%: paneel en dialoog weer naast elkaar.
  await page.mouse.click(panelPoint.x, panelPoint.y);
  await pressSlider(page, page.locator('[data-ops-progress-slider]').first(), { end: true });
  await expect.poll(() => readTask(page, panelId).then(task => task.completion)).toBe(1);
  dialog = await openDialogByDoubleClick(page, dialogId);
  await pressSlider(page, dialog.locator('[data-ops-progress-slider]'), { end: true });
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();
  await recalculate(page);

  const panelAt100 = await progressOf(page, panelId);
  expect(panelAt100).toMatchObject({ completion: 1, status: 'COMPLETED', actualFinish: "2026-03-13T16:00", remainingTime: 0 });
  expect(await progressOf(page, dialogId)).toEqual(panelAt100);

  // F1: een datumloos werkelijk einde op de statusdag krijgt het blokeinde of het statusmoment.
  for (const [statusDate, finish] of [
    ['2026-03-13', '2026-03-13T16:00'],
    ['2026-03-13T12:00', '2026-03-13T12:00'],
  ]) {
    await page.evaluate(({ id, statusDate }) => {
      const store = window.__OPS__!.store.getState();
      const bands = [{ start: 480, end: 960 }];
      store.setCalendar({ ...store.calendar, workTime: { byWeekday: {
        1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [],
      } } });
      store.setProject({ statusDate });
      const task = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
      store.updateTask(id, { status: 'STARTED', time: {
        ...task.time, durationUnit: 'hours', durationMinutes: 4800, completion: 0.2,
        actualStart: '2026-03-02T08:00', actualFinish: undefined,
      } });
      window.__OPS__!.store.getState().runCPM();
    }, { id: dialogId, statusDate });
    dialog = await openDialogByDoubleClick(page, dialogId);
    const finishGroup = dialog.getByRole('group', { name: /^(Actual finish|Werkelijk einde|Werkelijke einde)$/i });
    const segments = finishGroup.getByRole('textbox');
    for (const [index, value] of ['13', '03', '2026'].entries()) await segments.nth(index).fill(value);
    await dialog.locator('[data-ops-progress-slider]').focus();
    await dialog.locator('[data-ops-task-save]').click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => readTask(page, dialogId).then(task => task.actualFinish)).toBe(finish);
    await recalculate(page);
    expect((await readTask(page, dialogId)).earlyFinish).toBe(finish);
  }
  // Bij 100% geldt het geplande einde, met de vastgelegde start als ondergrens.
  for (const actualStart of ['2026-06-03T10:00', '2026-06-03T18:00']) {
    await page.evaluate(({ ids, actualStart }) => {
      const s = window.__OPS__!.store.getState();
      s.setProject({ startDate: '2026-06-01', statusDate: '2026-06-03' });
      for (const id of ids) {
        const task = window.__OPS__!.store.getState().tasks.find(t => t.id === id)!;
        s.updateTask(id, { status: 'STARTED', time: {
          ...task.time, scheduleStart: '2026-06-03T08:00', durationUnit: 'hours',
          durationMinutes: 480, scheduleDuration: 1, completion: 0.5,
          remainingMinutes: 240, remainingTime: 0.5, actualStart, actualFinish: undefined,
        } });
      }
      const after = window.__OPS__!.store.getState();
      after.runCPM();
      after.setViewStartDate('2026-06-01');
      after.setScroll(0, 0);
    }, { ids: [panelId, dialogId], actualStart });
    const plannedFinish = (await readTask(page, panelId)).earlyFinish;
    if (!plannedFinish) throw new Error('De taak heeft geen gepland einde');
    expect((await readTask(page, dialogId)).earlyFinish).toBe(plannedFinish);
    const actualFinish = plannedFinish > actualStart ? plannedFinish : actualStart;
    // Na de fixturewissel kan de vorige balkgeometrie nog staan; de rasterrij heeft een vaste plek.
    await page.locator(`[data-grid-row-key="${panelId}"] [data-grid-column-id="task.name"]`).first().click();
    await pressSlider(page, page.locator('[data-ops-progress-slider]').first(), { end: true });
    await expect.poll(() => readTask(page, panelId).then(t => t.completion)).toBe(1);
    await page.locator(`[data-grid-row-key="${dialogId}"] [data-grid-column-id="task.name"]`).first().click({ button: 'right' });
    await page.getByRole('button', { name: /^(Edit|Bewerken)\.\.\.$/ }).click();
    dialog = page.locator('[data-ops-task-dialog]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-ops-task-name]')).toBeFocused();
    await pressSlider(page, dialog.locator('[data-ops-progress-slider]'), { end: true });
    await dialog.locator('[data-ops-task-save]').click();
    await expect(dialog).toBeHidden();
    for (const id of [panelId, dialogId]) expect(await readTask(page, id)).toMatchObject({
      completion: 1, status: 'COMPLETED', actualStart, actualFinish,
    });
    await recalculate(page);
    for (const id of [panelId, dialogId]) expect(await readTask(page, id)).toMatchObject({ actualStart, actualFinish });
  }
  await page.screenshot({ path: 'qa/uren-f1b-status.png' });
});

test('Taak bewerken: voortgang alleen via de dialoog zet de status (gestart, voltooid)', async ({ page, ops: _ops }) => {
  const [taskId] = await seedTenDayTasks(page, ['Alleen dialoog']);

  let dialog = await openDialogByDoubleClick(page, taskId);
  await pressSlider(page, dialog.locator('[data-ops-progress-slider]'), { right: 40 });
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();
  expect(await readTask(page, taskId)).toMatchObject({
    // #998: de taak was naar 6 maart geschoven. Het percentage legt haar geplande begin op 2 maart vast.
    completion: 0.4, status: 'STARTED', actualStart: "2026-03-02T07:00", actualFinish: null, remainingTime: 6,
  });

  dialog = await openDialogByDoubleClick(page, taskId);
  await pressSlider(page, dialog.locator('[data-ops-progress-slider]'), { end: true });
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();
  expect(await readTask(page, taskId)).toMatchObject({
    completion: 1, status: 'COMPLETED', actualStart: "2026-03-02T07:00", actualFinish: "2026-03-06T16:00", remainingTime: 0,
  });

  // Het al in de dialoog afgeleide einde moet de daarna getypte duur volgen.
  await page.evaluate(id => {
    const store = window.__OPS__!.store.getState();
    const task = store.tasks.find(candidate => candidate.id === id)!;
    store.setProject({ statusDate: '2026-03-20' });
    store.updateTask(id, { status: 'NOT_STARTED', time: {
      ...task.time, completion: 0, actualStart: undefined, actualFinish: undefined,
    } });
    store.runCPM();
  }, taskId);
  dialog = await openDialogByDoubleClick(page, taskId);
  await pressSlider(page, dialog.locator('[data-ops-progress-slider]'), { end: true });
  await expect(dialog.locator('[data-ops-progress-slider]')).toHaveValue('100');
  const duration = dialog.locator('[data-ops-duration-value]');
  await duration.fill('3');
  await duration.press('Tab');
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();
  expect(await readTask(page, taskId)).toMatchObject({ completion: 1, actualFinish: '2026-03-04T16:00' });
});

test('Taak bewerken: voortgang en startanker volgen de actuele planning na het verwijderen van een voorganger', async ({ page, ops: _ops }) => {
  const [predecessor, taskId] = await seedTenDayTasks(page, ['Grondwerk', 'Fundering']);
  await page.evaluate(({ predecessor, taskId }) => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ autoCalcCPM: true, dateNotation: 'dmy' });
    const first = s.tasks.find(task => task.id === predecessor)!;
    s.updateTask(predecessor, { time: { ...first.time, scheduleDuration: 1 } });
    s.addSequence({ predecessorId: predecessor, successorId: taskId, type: 'FINISH_START', lagDays: 0 });
    s.runCPM();
  }, { predecessor, taskId });
  const dates = () => page.evaluate((id) => {
    const time = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!.time;
    return { anchor: time.scheduleStart, calculated: time.earlyStart };
  }, taskId);
  const original = await dates();
  expect(original.calculated).not.toBe(original.anchor);
  const open = async () => {
    await page.locator(`[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="${taskId}"][data-grid-column-id="task.name"]`)
      .click({ button: 'right' });
    await page.getByRole('button', { name: /^(Edit|Bewerken)\.\.\.$/ }).click();
    const dialog = page.locator('[data-ops-task-dialog]');
    await expect(dialog).toBeVisible();
    return dialog;
  };

  let dialog = await open();
  const startInput = dialog.locator('[data-ops-task-date-time="dialog-start"] input').first();
  await startInput.click();
  await page.keyboard.type('23032026');
  await page.keyboard.press('Tab');
  await expect(startInput).toHaveValue('23');
  await pressSlider(page, dialog.locator('[data-ops-progress-slider]'), { right: 1 });

  const question = page.locator('[data-ops-actual-start-dialog]');
  await expect(question).toBeVisible();
  expect(await readTask(page, taskId)).toMatchObject({ completion: 0, actualStart: null });
  await question.getByRole('group', { name: /Fundering/ }).getByRole('textbox').first().fill('04');
  await question.locator('[data-ops-actual-start-confirm]').click();
  await expect(question).toBeHidden();
  await expect(dialog.locator('[data-ops-progress-slider]')).toHaveValue('1');
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();
  expect(await readTask(page, taskId)).toMatchObject({ completion: 0.01, actualStart: '2026-03-04T07:00' });
  expect(await page.evaluate(id => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { anchor: task.time.scheduleStart, constraint: task.constraint };
  }, taskId)).toEqual({
    anchor: '2026-03-23T07:00', constraint: { type: 'SNET', date: '2026-03-23T07:00' },
  });
  await page.locator('.quick-access-toolbar').getByTitle(/^(Undo|Ongedaan maken) \(Ctrl\+Z\)$/).click();
  await expect.poll(dates).toEqual(original);

  dialog = await open();
  await dialog.locator('.dependency-remove-button').click();
  await expect.poll(dates).toEqual({ anchor: original.anchor, calculated: '2026-03-06T07:00' });
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();
  expect((await dates()).anchor).toBe(original.anchor);

  await page.evaluate(({ predecessor, taskId }) => {
    const s = window.__OPS__!.store.getState();
    s.addSequence({ predecessorId: predecessor, successorId: taskId, type: 'FINISH_START', lagDays: 0 });
    s.runCPM();
  }, { predecessor, taskId });
  await expect.poll(dates).toEqual(original);
  dialog = await open();
  await dialog.locator('.dependency-remove-button').click();
  await expect.poll(dates).toEqual({ anchor: original.anchor, calculated: '2026-03-06T07:00' });
  await pressSlider(page, dialog.locator('[data-ops-progress-slider]'), { end: true });
  await expect(page.locator('[data-ops-actual-start-dialog]')).toHaveCount(0);
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();
  expect(await readTask(page, taskId)).toMatchObject({ completion: 1, actualStart: original.anchor });
  expect((await dates()).anchor).toBe(original.anchor);
});

test('#998 Taak bewerken: voortgang toetst de actuele toegewezen duur', async ({ page, ops: _ops }) => {
  const id = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ autoCalcCPM: true, dateNotation: 'dmy' });
    s.setProject({ startDate: '2026-06-08', statusDate: '2026-06-10' });
    const task = s.addTask({
      name: 'Fundering', time: { scheduleDuration: 10 } as never,
      constraint: { type: 'MFO', date: '2026-06-22', hard: true },
    });
    const crane = s.addResource({ name: 'Kraan', type: 'LABOR', description: '', maxUnits: 1 });
    s.assignResource(task, crane, 1);
    s.setTaskWorkRule(task, 'FIXED_RATE');
    s.runCPM();
    s.setViewStartDate('2026-06-08');
    return task;
  });
  const planning = () => page.evaluate(taskId => {
    const time = window.__OPS__!.store.getState().tasks.find(task => task.id === taskId)!.time;
    return { start: time.earlyStart, duration: time.scheduleDuration };
  }, id);
  await page.locator(`[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="${id}"][data-grid-column-id="task.name"]`)
    .click({ button: 'right' });
  await page.getByRole('button', { name: /^(Edit|Bewerken)\.\.\.$/ }).click();
  const dialog = page.locator('[data-ops-task-dialog]');
  const work = dialog.locator('[data-ops-assignment-work] input').first();
  await expect(work).toHaveValue('80');
  await work.fill('8');
  await work.press('Tab');
  await expect.poll(planning).toEqual({ start: '2026-06-22T07:00', duration: 1 });

  const slider = dialog.locator('[data-ops-progress-slider]');
  await pressSlider(page, slider, { right: 1 });
  const question = page.locator('[data-ops-actual-start-dialog]');
  await expect(question).toBeVisible();
  expect((await readTask(page, id)).actualStart).toBeNull();
  await question.getByRole('group', { name: /Fundering/ }).getByRole('textbox').first().fill('09');
  await question.locator('[data-ops-actual-start-confirm]').click();
  await expect(slider).toHaveValue('1');

  // Een tweede wijziging via de toewijzing blijft ook na de voortgang van kracht bij Opslaan.
  await work.fill('16');
  await work.press('Tab');
  await expect.poll(() => planning().then(value => value.duration)).toBe(2);
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();
  expect((await planning()).duration).toBe(2);
  expect(await readTask(page, id)).toMatchObject({ completion: 0.01, actualStart: '2026-06-09T07:00' });
});

test('Taak bewerken: één keer Opslaan (naam, ouder, nieuw taaktype, voortgang) is één Ctrl+Z', async ({ page, ops: _ops }) => {
  // Kiest de dialoogdraft een persoonlijk type dat nog niet in het project staat, dan mag de
  // taaktypekiezer dat type maar één keer tonen (de fixture faalt op elke consolefout, dus ook op
  // React's waarschuwing over dubbele keys).
  const [phaseId, taskId] = await seedTenDayTasks(page, ['Fase', 'Taak']);
  const before = await readTask(page, taskId);

  const dialog = await openDialogByDoubleClick(page, taskId);
  // Het naamveld heeft bij openen focus met alles geselecteerd.
  await page.keyboard.type('Taak (hernoemd)');

  // Bovenliggende taak.
  await dialog.getByRole('button', { name: /^(Parent task|Bovenliggende taak)$/ }).click();
  await page.getByRole('option', { name: /Fase/ }).click();

  // Een persoonlijk taaktype dat nog niet in het project staat (materialiseert pas bij Opslaan).
  const typeSelector = dialog.locator('[data-ops-task-type]');
  await typeSelector.getByRole('button').click();
  const typeOptions = page.getByRole('listbox').getByRole('option');
  await typeOptions.nth((await typeOptions.count()) - 2).click();
  const newTypeDialog = page.locator('[data-ops-new-task-type-dialog]');
  await expect(newTypeDialog).toBeVisible();
  await newTypeDialog.getByRole('textbox').fill('Keuring');
  await newTypeDialog.getByRole('button', { name: /^(Create|Aanmaken)$/ }).click();
  await expect(newTypeDialog).toBeHidden();
  await typeSelector.getByRole('button').click();
  await page.getByRole('option', { name: 'Keuring', exact: true }).click();

  await pressSlider(page, dialog.locator('[data-ops-progress-slider]'), { right: 50 });

  const beforeSave = await state(page);
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();

  const saved = await readTask(page, taskId);
  expect.soft(saved).toMatchObject({ name: 'Taak (hernoemd)', parentId: phaseId, completion: 0.5, status: 'STARTED' });
  expect.soft(saved.customTaskTypeId).not.toBeNull();
  expect.soft(await page.evaluate(() => window.__OPS__!.store.getState().customTaskTypes.map(type => type.name)))
    .toEqual(['Keuring']);
  const afterSave = await state(page);
  expect.soft(afterSave.undoDepth, 'één Opslaan = één undo-stap').toBe(beforeSave.undoDepth + 1);

  await page.keyboard.press('Control+z');

  await expect.poll(() => readTask(page, taskId)).toEqual(before);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().customTaskTypes)).toEqual([]);
  const undone = await state(page);
  expect(undone.undoDepth).toBe(beforeSave.undoDepth);
  expect(undone.redoDepth).toBe(beforeSave.redoDepth + 1);
});
