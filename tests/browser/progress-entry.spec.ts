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
