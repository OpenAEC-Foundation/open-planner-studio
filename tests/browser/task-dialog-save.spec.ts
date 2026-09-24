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
  expect(panelAt100).toMatchObject({ completion: 1, status: 'COMPLETED', actualFinish: '2026-03-13', remainingTime: 0 });
  expect(await progressOf(page, dialogId)).toEqual(panelAt100);
});

test('Taak bewerken: voortgang alleen via de dialoog zet de status (gestart, voltooid)', async ({ page, ops: _ops }) => {
  const [taskId] = await seedTenDayTasks(page, ['Alleen dialoog']);

  let dialog = await openDialogByDoubleClick(page, taskId);
  await pressSlider(page, dialog.locator('[data-ops-progress-slider]'), { right: 40 });
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();
  expect(await readTask(page, taskId)).toMatchObject({
    // Onbegonnen werk staat na de statusdatum (6 maart) gepland; de afgeleide start volgt die.
    completion: 0.4, status: 'STARTED', actualStart: '2026-03-06', actualFinish: null, remainingTime: 6,
  });

  dialog = await openDialogByDoubleClick(page, taskId);
  await pressSlider(page, dialog.locator('[data-ops-progress-slider]'), { end: true });
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();
  expect(await readTask(page, taskId)).toMatchObject({
    completion: 1, status: 'COMPLETED', actualStart: '2026-03-06', actualFinish: '2026-03-06', remainingTime: 0,
  });
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
