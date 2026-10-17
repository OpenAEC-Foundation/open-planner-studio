// Eigenaarsbesluit 2026-10-17: elke weigering is een RODE melding (`toast-error`, `role="alert"`)
// die blijft staan tot de gebruiker hem wegklikt. Een blauwe info verdween na 5 s, en de eigenaar
// miste zo een geweigerde duur.
//
// Plus de fout in hetzelfde onderwerp: na een geweigerde duur bleef het getypte getal in het veld
// *Duur* van het taakpaneel staan. Het veld hoort dan weer de echte duur te tonen.
//
// Zelfde fout bij de werkelijke datums: een geweigerde datum (na de statusdatum) bleef in het veld staan.
//
// Echte events: het voorbeeld opent via Bestand → Voorbeelden, de duur via klik + typen + Enter,
// het mijlpaalvinkje via een klik, de melding sluit via het kruisje. De `__OPS__`-brug kiest alleen
// de taak (fixture) en leest state.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

async function openAkkers(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.locator('.ribbon-tab--file').first().click();
  await page.locator('button.backstage-nav-item[data-tour-anchor="backstage-examples"]').click();
  const card = page.locator('button.backstage-export-card')
    .filter({ has: page.locator('h4', { hasText: /De Akkers/ }) }).first();
  await card.click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBeGreaterThan(20);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showPropertiesPanel: true, rightPanelCollapsed: false }));
}

/** Kies een taak (fixture) en geef haar id terug. */
async function selectTask(page: Page, find: string): Promise<string> {
  const id = await page.evaluate((name) => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks.find(t => t.name === name);
    if (!task) throw new Error(`taak ${name} niet gevonden`);
    s.selectTask(task.id);
    return task.id;
  }, find);
  return id;
}

const taskTime = (page: Page, id: string) => page.evaluate((taskId) => {
  const task = window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!;
  return { duration: task.time.scheduleDuration, completion: task.time.completion, milestone: !!task.isMilestone };
}, id);

test('geweigerde duur: rode melding blijft na 6 s, sluit via het kruisje, en het veld toont de echte duur', async ({ page, ops: _ops }) => {
  await openAkkers(page);
  const id = await selectTask(page, 'Upper floor slab — House 4');
  const before = await taskTime(page, id);
  expect(before.duration).toBe(4);
  expect(before.completion).toBeCloseTo(0.5, 5);

  const field = page.locator('[data-ops-rail] [data-ops-duration-value]');
  await expect(field).toHaveValue('4');
  await field.click();
  await field.fill('');
  await page.keyboard.type('1');
  await page.keyboard.press('Enter');

  const refusal = page.locator('.ops-toast', { hasText: /Upper floor slab — House 4/ });
  await expect(refusal).toHaveCount(1);
  await expect(refusal).toHaveClass(/toast-error/);
  await expect(refusal).toHaveAttribute('role', 'alert');
  await expect(refusal).toContainText("'Upper floor slab — House 4'");
  // Het veld toont direct weer de echte duur, niet de getypte 1.
  await expect(field).toHaveValue('4');
  expect((await taskTime(page, id)).duration).toBe(4);

  // Een info is na 5 s weg; een weigering staat er na 6 s nog. De tijd loopt via `page.clock`
  // (geen vaste wachttijd). Controle dat de klok echt werkt: een info die er tegelijk staat, is
  // na dezelfde 6 s wel weg.
  await page.clock.install();
  await page.evaluate(() => window.__OPS__!.store.getState().notify({ severity: 'info', messageKey: 'notifications.templateSaved', params: { name: 'klokcontrole' } }));
  const control = page.locator('.ops-toast.toast-info', { hasText: /klokcontrole/ });
  await expect(control).toBeVisible();
  await page.clock.runFor(6_000);
  await expect(control).toHaveCount(0);
  await expect(refusal).toBeVisible();

  await refusal.locator('[data-ops-toast-close]').click();
  await expect(refusal).toHaveCount(0);
  await expect(field).toHaveValue('4');
});

test('geweigerde mijlpaal (taak met toewijzing): rode melding met role=alert', async ({ page, ops: _ops }) => {
  await openAkkers(page);
  const name = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const assigned = new Set(s.assignments.map(a => a.taskId));
    const task = s.tasks.find(t => assigned.has(t.id) && t.childIds.length === 0 && !t.isMilestone)!;
    return task.name;
  });
  const id = await selectTask(page, name);
  const checkbox = page.locator('[data-ops-rail] label', { hasText: /^Milestone$/ }).first().locator('input[type=checkbox]');
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();

  const refusal = page.locator('.ops-toast', { hasText: /cannot become a milestone/ });
  await expect(refusal).toHaveCount(1);
  await expect(refusal).toHaveClass(/toast-error/);
  await expect(refusal).toHaveAttribute('role', 'alert');
  await expect(checkbox).not.toBeChecked();
  expect((await taskTime(page, id)).milestone).toBe(false);
});

test('geweigerde werkelijke start (na de statusdatum): het veld valt terug op de opgeslagen waarde', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const id = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setCalendar({ ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [] });
    s.setProject({ name: 'Werkelijke datums', startDate: '2026-06-01', statusDate: '2026-06-10' });
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    const taskId = s.addTask({ name: 'Fundering', time: { scheduleDuration: 5 } as never });
    window.__OPS__!.store.getState().runCPM();
    window.__OPS__!.store.getState().selectTask(taskId);
    return taskId;
  });
  const field = page.locator('[data-ops-rail]').getByRole('group', { name: /^Actual start$/ });
  const day = field.locator('input').first();
  await expect(day).toHaveValue('');
  await day.click();
  await page.keyboard.type('20062026');
  await page.keyboard.press('Enter');

  await expect(page.locator('[data-ops-rail]').getByText('Actuals cannot be after the status date')).toBeVisible();
  // Het veld toont weer de opgeslagen waarde (leeg), niet de geweigerde 20-06-2026.
  for (const input of await field.locator('input').all()) await expect(input).toHaveValue('');
  expect(await page.evaluate((taskId) => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!.time.actualStart ?? null, id))
    .toBeNull();
});

test('inspringen bij een gesorteerde lijst: rode strook met role=alert, blijft staan, sluit via het kruisje', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const second = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ name: 'Structuur vast', startDate: '2026-09-07' });
    s.addTask({ name: 'Eerste' });
    const id = window.__OPS__!.store.getState().addTask({ name: 'Tweede' });
    window.__OPS__!.store.getState().runCPM();
    window.__OPS__!.store.getState().setSort([{ field: { src: 'builtin', key: 'name' }, dir: 'asc' }]);
    return id;
  });
  await page.locator(`[data-grid-data-row="true"][data-grid-row-key="${second}"] [data-grid-column-id="task.name"]`).first().click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([second]);
  await page.clock.install();
  await page.keyboard.press('Alt+Shift+ArrowRight');

  const strip = page.locator('[data-ops-structure-locked]');
  await expect(strip).toBeVisible();
  await expect(strip).toHaveAttribute('role', 'alert');
  await expect(strip).toHaveAttribute('data-ops-notice-tone', 'error');
  // Vroeger verdween de strook na 6 s; nu blijft hij.
  await page.clock.runFor(7_000);
  await expect(strip).toBeVisible();
  await strip.getByTitle('Close', { exact: true }).click();
  await expect(strip).toHaveCount(0);
});
