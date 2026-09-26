// Voortgang INVULLEN via de UI (`engine/progressEntry.ts`), met echte events: klik op de balk,
// het eigenschappenpaneel, het contextmenu, Ctrl+Z.
//
// Regel 1 (Z1, besluit eigenaar): voortgang invullen zonder statusdatum ⇒ de app zet de statusdatum
// op VANDAAG (wat het statusdatumveld oplevert: datum zonder tijd) en meldt dat via het ene
// meldkanaal. Statusdatum + voortgang zijn samen één undo-stap. Vóór de wijziging bleef de
// statusdatum leeg en rekende de solver de lopende taak met speling −1.
//
// De brug zet alleen fixtures (taken, relaties, weergave) en leest state; de geteste handelingen
// gaan via muis en toetsenbord. Headless tegenhanger: tests/planning/check-progress-entry.ts.
import type { Page } from '@playwright/test';
import { barPoint, expect, state, test } from './fixtures/ops';

/** Vandaag in de browser, zoals de gebruiker hem in het statusdatumveld typt (lokale kalenderdag). */
function browserToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A (5 wd) → B (3 wd) FS, projectstart `startOffset` kalenderdagen t.o.v. vandaag, geen statusdatum. */
async function seedChain(page: Page, startOffset: number): Promise<{ A: string; B: string; start: string }> {
  const today = await browserToday(page);
  const start = shiftDays(today, startOffset);
  const ids = await page.evaluate((projectStart) => {
    const s = window.__OPS__!.store.getState();
    s.setCalendar({ ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [] });
    s.setProject({ name: 'Voortgang invullen', startDate: projectStart });
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    const A = s.addTask({ name: 'Fundering', time: { scheduleDuration: 5 } as never });
    const B = s.addTask({ name: 'Metselwerk', time: { scheduleDuration: 3 } as never });
    s.addSequence({ predecessorId: A, successorId: B, type: 'FINISH_START', lagDays: 0 });
    const after = window.__OPS__!.store.getState();
    after.runCPM();
    after.setViewStartDate(projectStart);
    after.setZoom(18);
    after.setScroll(0, 0);
    return { A, B };
  }, start);
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.length)).toBe(2);
  return { ...ids, start };
}

function readProgress(page: Page, taskId: string) {
  return page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks.find(candidate => candidate.id === id)!;
    return {
      statusDate: s.project.statusDate ?? null,
      completion: task.time.completion,
      actualStart: task.time.actualStart ?? null,
    };
  }, taskId);
}

/** De datum zoals de melding hem toont (standaardnotatie dd-mm-jjjj). */
function shown(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

test('Regel 1, paneel: voortgang zonder statusdatum zet hem op vandaag, meldt dat, en is één Ctrl+Z', async ({ page, ops: _ops }) => {
  const today = await browserToday(page);
  const { B } = await seedChain(page, -28);
  expect(await readProgress(page, B)).toEqual({ statusDate: null, completion: 0, actualStart: null });

  const point = await barPoint(page, B);
  await page.mouse.click(point.x, point.y);
  const slider = page.locator('[data-ops-progress-slider]').first();
  await expect(slider).toHaveValue('0');
  const before = await state(page);
  await slider.focus();
  await page.keyboard.press('ArrowRight');

  await expect.poll(() => readProgress(page, B).then(p => p.statusDate)).toBe(today);
  expect((await readProgress(page, B)).completion).toBe(0.01);
  // De melding via het ene meldkanaal, met de datum van vandaag.
  const toast = page.locator('.ops-toast', { hasText: shown(today) });
  await expect(toast).toBeVisible();
  // Het statusdatumveld in het lint toont hem ook (Planning-tab).
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'planning' }));
  const [y, m, d] = today.split('-');
  const statusField = page.getByRole('group', { name: /^(Status date|Statusdatum)$/ }).first();
  await expect(statusField.getByRole('textbox')).toHaveCount(3);
  await expect(statusField.getByRole('textbox').nth(0)).toHaveValue(d);
  await expect(statusField.getByRole('textbox').nth(1)).toHaveValue(m);
  await expect(statusField.getByRole('textbox').nth(2)).toHaveValue(y);
  expect((await state(page)).undoDepth).toBe(before.undoDepth + 1);

  // Focus uit het schuifveld (een invoerveld vangt Ctrl+Z zelf), dan één Ctrl+Z.
  await page.mouse.click(point.x, point.y);
  await page.keyboard.press('Control+z');
  await expect.poll(() => readProgress(page, B)).toEqual({ statusDate: null, completion: 0, actualStart: null });
});

test('Regel 1, contextmenu: 50 % zonder statusdatum zet hem op vandaag', async ({ page, ops: _ops }) => {
  const today = await browserToday(page);
  const { B } = await seedChain(page, -28);
  const point = await barPoint(page, B);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await page.getByText(/^(Progress|Voortgang)$/).hover();
  await page.getByRole('button', { name: '50%', exact: true }).click();

  await expect.poll(() => readProgress(page, B)).toMatchObject({ statusDate: today, completion: 0.5 });
  await expect(page.locator('.ops-toast', { hasText: shown(today) })).toBeVisible();
});

// ── Regel 2 (Z1b): voortgang op een taak die pas na de statusdatum begint ⇒ eerst vragen ─────────

/** Keten die helemaal ná de statusdatum (gisteren) ligt: projectstart twee weken na vandaag. */
async function seedFutureChain(page: Page): Promise<{ A: string; B: string; statusDate: string; today: string }> {
  const today = await browserToday(page);
  const statusDate = shiftDays(today, -1);
  const { A, B, start } = await seedChain(page, 14);
  await page.evaluate(({ sd, projectStart }) => {
    const s = window.__OPS__!.store.getState();
    s.setStatusDate(sd);
    s.runCPM();
    s.setViewStartDate(projectStart);
  }, { sd: statusDate, projectStart: start });
  return { A, B, statusDate, today };
}

/** Vul een datum in het gesegmenteerde datumveld van de vraag (standaardnotatie dd-mm-jjjj). */
async function fillQuestionDate(page: Page, taskName: string, iso: string): Promise<void> {
  const [y, m, d] = iso.split('-');
  const segments = page.locator('[data-ops-actual-start-dialog]')
    .getByRole('group', { name: new RegExp(taskName) })
    .getByRole('textbox');
  await segments.nth(0).fill(d);
  await segments.nth(1).fill(m);
  await segments.nth(2).fill(y);
}

test('Regel 2, paneel: de app vraagt de werkelijke start; annuleren verandert niets, bevestigen is één stap', async ({ page, ops: _ops }) => {
  const { B, statusDate } = await seedFutureChain(page);
  const point = await barPoint(page, B);
  await page.mouse.click(point.x, point.y);
  const slider = page.locator('[data-ops-progress-slider]').first();
  const before = await state(page);

  // Pijltje rechts op de schuif ⇒ de vraag, met de statusdatum als voorstel; er is nog niets veranderd.
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  const question = page.locator('[data-ops-actual-start-dialog]');
  await expect(question).toBeVisible();
  await expect(question).toContainText('Metselwerk');
  const [y, m, d] = statusDate.split('-');
  const segments = question.getByRole('group', { name: /Metselwerk/ }).getByRole('textbox');
  await expect(segments.nth(0)).toHaveValue(d);
  await expect(segments.nth(1)).toHaveValue(m);
  await expect(segments.nth(2)).toHaveValue(y);
  expect(await readProgress(page, B)).toEqual({ statusDate, completion: 0, actualStart: null });

  // Annuleren (Escape): niets veranderd, geen undo-stap.
  await page.keyboard.press('Escape');
  await expect(question).toBeHidden();
  expect(await readProgress(page, B)).toEqual({ statusDate, completion: 0, actualStart: null });
  expect((await state(page)).undoDepth).toBe(before.undoDepth);

  // Opnieuw; een datum ná de statusdatum bestaat niet: gemeld, Toepassen blijft uit.
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(question).toBeVisible();
  await fillQuestionDate(page, 'Metselwerk', shiftDays(statusDate, 2));
  await expect(question.getByRole('alert')).toBeVisible();
  await expect(question.locator('[data-ops-actual-start-confirm]')).toBeDisabled();

  // Een geldige datum, bevestigen met de knop.
  const actualStart = shiftDays(statusDate, -3);
  await fillQuestionDate(page, 'Metselwerk', actualStart);
  await expect(question.getByRole('alert')).toHaveCount(0);
  await question.locator('[data-ops-actual-start-confirm]').click();
  await expect(question).toBeHidden();
  await expect.poll(() => readProgress(page, B)).toEqual({ statusDate, completion: 0.01, actualStart });
  expect((await state(page)).undoDepth).toBe(before.undoDepth + 1);
});

test('Regel 2, schuif slepen: de vraag komt pas bij het loslaten, met de gesleepte waarde', async ({ page, ops: _ops }) => {
  const { B, statusDate } = await seedFutureChain(page);
  const point = await barPoint(page, B);
  await page.mouse.click(point.x, point.y);
  const slider = page.locator('[data-ops-progress-slider]').first();
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const question = page.locator('[data-ops-actual-start-dialog]');

  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 5 });
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 5 });
  // Tijdens het slepen: geen vraag, niets toegepast, de schuif toont wel de gesleepte waarde.
  await expect(question).toHaveCount(0);
  expect((await readProgress(page, B)).completion).toBe(0);
  const dragged = Number(await slider.inputValue());
  expect(dragged).toBeGreaterThan(30);
  await page.mouse.up();

  await expect(question).toBeVisible();
  await question.locator('[data-ops-actual-start-confirm]').click();
  await expect.poll(() => readProgress(page, B)).toEqual({ statusDate, completion: dragged / 100, actualStart: statusDate });
});

test('Regel 2, taakraster: % typen vraagt de werkelijke start en herhaalt de invoer mét die datum', async ({ page, ops: _ops }) => {
  const { B, statusDate } = await seedFutureChain(page);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const cellOf = (taskId: string, columnId: string) => page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"] `
    + `[data-grid-data-cell="true"][data-grid-column-id="${columnId}"]`,
  );
  const completion = cellOf(B, 'task.time.completion');
  await completion.click();
  await page.keyboard.press('Enter');
  const input = completion.locator('input');
  await expect(input).toBeFocused();
  await input.fill('40');
  await page.keyboard.press('Enter');

  const question = page.locator('[data-ops-actual-start-dialog]');
  await expect(question).toBeVisible();
  expect(await readProgress(page, B)).toEqual({ statusDate, completion: 0, actualStart: null });
  const actualStart = shiftDays(statusDate, -2);
  await fillQuestionDate(page, 'Metselwerk', actualStart);
  // Enter bevestigt de vraag (en niets anders).
  await page.keyboard.press('Enter');
  await expect(question).toBeHidden();
  await expect.poll(() => readProgress(page, B)).toEqual({ statusDate, completion: 0.4, actualStart });
});

test('Regel 2, Taak bewerken: de vraag stapelt boven de dialoog; Enter bevestigt alleen de vraag', async ({ page, ops: _ops }) => {
  const { B, statusDate } = await seedFutureChain(page);
  const point = await barPoint(page, B);
  await page.mouse.dblclick(point.x, point.y);
  const taskDialog = page.locator('[data-ops-task-dialog]');
  await expect(taskDialog).toBeVisible();
  await taskDialog.locator('[data-ops-progress-slider]').focus();
  await page.keyboard.press('End');

  const question = page.locator('[data-ops-actual-start-dialog]');
  await expect(question).toBeVisible();
  const actualStart = shiftDays(statusDate, -5);
  await fillQuestionDate(page, 'Metselwerk', actualStart);
  await page.keyboard.press('Enter');
  await expect(question).toBeHidden();
  // De taakdialoog staat nog open: de voortgang staat op de concepttaak, nog niet in de store.
  await expect(taskDialog).toBeVisible();
  expect(await readProgress(page, B)).toEqual({ statusDate, completion: 0, actualStart: null });

  await taskDialog.locator('[data-ops-task-save]').click();
  await expect(taskDialog).toBeHidden();
  await expect.poll(() => readProgress(page, B)).toEqual({ statusDate, completion: 1, actualStart });
});
