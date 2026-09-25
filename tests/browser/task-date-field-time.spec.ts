import type { Locator, Page } from '@playwright/test';
import { expect, state, test } from './fixtures/ops';

/**
 * Datumvelden op een taak met een uurkalender, en verplichte velden in paneel en dialoog. In het meegeleverde voorbeeld "De Vaart Apartment Complex" draagt taak 3.6 een
 * datum-met-tijd (`2027-05-13T07:00`). Het gedeelde datumveld kende alleen `JJJJ-MM-DD`, toonde dus
 * een leeg veld, en wie er alleen doorheen tabde committe `''` als startanker: daarna rekende het
 * hele project niet meer ("Ongeldige startdatum").
 *
 * Alle geteste handelingen gaan via echte muis-/toetsenbordevents. De dev-brug opent alleen het
 * voorbeeld-resultaat (selectie, paneel zichtbaar, dialoog openen) en leest state.
 */

const TASK = 'Rebar fixing, basement floor — Tower A';

interface TaskFacts {
  id: string;
  name: string;
  scheduleStart: string;
  earlyStart?: string;
  scheduleDuration: number;
  actualStart?: string;
  constraint?: { type: string; date?: string };
}

async function taskFacts(page: Page, id: string): Promise<TaskFacts> {
  return page.evaluate((taskId) => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === taskId)!;
    return {
      id: task.id,
      name: task.name,
      scheduleStart: task.time.scheduleStart,
      earlyStart: task.time.earlyStart,
      scheduleDuration: task.time.scheduleDuration,
      actualStart: task.time.actualStart,
      constraint: task.constraint ? { type: task.constraint.type, date: task.constraint.date } : undefined,
    };
  }, id);
}

async function cpmError(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__OPS__!.store.getState().cpmResult?.error ?? null);
}

/** Opent het showcase-voorbeeld via de echte Backstage en selecteert taak 3.6 in het paneel. */
async function openShowcaseTask(page: Page): Promise<string> {
  await page.locator('.ribbon-tab--file').first().click();
  await page.locator('button.backstage-nav-item[data-tour-anchor="backstage-examples"]').click();
  const card = page.locator('button.backstage-export-card')
    .filter({ has: page.locator('h4', { hasText: 'De Vaart Apartment Complex' }) })
    .first();
  await card.click();
  await expect.poll(
    () => page.evaluate(name => window.__OPS__!.store.getState().tasks.some(task => task.name === name), TASK),
    { timeout: 20_000 },
  ).toBe(true);
  const id = await page.evaluate((name) => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks.find(candidate => candidate.name === name)!;
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(task.id);
    return task.id;
  }, TASK);
  const facts = await taskFacts(page, id);
  // De fixture waarom het gaat: een start MET tijd (uurkalender) — anders test deze spec niets.
  expect(facts.earlyStart).toBe('2027-05-13T07:00');
  expect(facts.scheduleStart).toBe('2027-03-01T07:00');
  expect(await cpmError(page)).toBeNull();
  return id;
}

function railGroup(page: Page, label: string): Locator {
  return page.locator('[data-ops-rail]').getByRole('group', { name: label, exact: true }).first();
}

async function segments(group: Locator): Promise<string> {
  return group.locator('input').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value || '__').join('-'));
}

async function recalc(page: Page): Promise<void> {
  await page.locator('[data-ops-rail]').getByText('Start', { exact: true }).first().click();
  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
}

test('paneel: klik-in + Tab op Start van een urentaak laat het anker ongemoeid en F5 rekent', async ({ page, ops: _ops }) => {
  const id = await openShowcaseTask(page);
  const start = railGroup(page, 'Start');
  await start.scrollIntoViewIfNeeded();
  // Het veld toont het datumdeel van de berekende start, niet een leeg veld.
  await expect.poll(() => segments(start)).toBe('13-05-2027');
  const undoBefore = (await state(page)).undoDepth;

  await start.locator('input').first().click();
  await page.keyboard.press('Tab');

  await expect.poll(() => taskFacts(page, id).then(task => task.scheduleStart)).toBe('2027-03-01T07:00');
  expect((await state(page)).undoDepth).toBe(undoBefore);
  await recalc(page);
  expect(await cpmError(page)).toBeNull();
});

test('paneel: een andere datum typen op Start behoudt het tijddeel', async ({ page, ops: _ops }) => {
  const id = await openShowcaseTask(page);
  const start = railGroup(page, 'Start');
  await start.scrollIntoViewIfNeeded();
  await expect.poll(() => segments(start)).toBe('13-05-2027');

  await start.locator('input').first().click();
  await page.keyboard.type('17');
  await page.keyboard.press('Tab');

  await expect.poll(() => taskFacts(page, id).then(task => task.scheduleStart)).toBe('2027-05-17T07:00');
  await recalc(page);
  expect(await cpmError(page)).toBeNull();
});

test('paneel: Start met Backspace leegmaken wordt geweigerd en het veld valt terug', async ({ page, ops: _ops }) => {
  const id = await openShowcaseTask(page);
  const start = railGroup(page, 'Start');
  await start.scrollIntoViewIfNeeded();
  await expect.poll(() => segments(start)).toBe('13-05-2027');

  // Jaarsegment aanklikken (selecteert de inhoud) en Backspace ingedrukt houden: leeg segment
  // springt terug, dus dag, maand en jaar raken alle drie leeg.
  await start.locator('input').nth(2).click();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace');
  await expect.poll(() => segments(start)).toBe('__-__-__');
  await page.locator('[data-ops-rail]').getByText('Start', { exact: true }).first().click();

  await expect.poll(() => segments(start)).toBe('13-05-2027');
  expect((await taskFacts(page, id)).scheduleStart).toBe('2027-03-01T07:00');
  await recalc(page);
  expect(await cpmError(page)).toBeNull();
});

test('paneel: Werkelijke start van een voltooide taak doortabben verandert niets', async ({ page, ops: _ops }) => {
  const id = await openShowcaseTask(page);
  const actual = railGroup(page, 'Actual start');
  await actual.scrollIntoViewIfNeeded();
  await expect.poll(() => segments(actual)).toBe('13-05-2027');
  const before = await taskFacts(page, id);
  expect(before.actualStart).toBe('2027-05-13T07:00');

  await actual.locator('input').first().click();
  await page.keyboard.press('Tab');

  expect((await taskFacts(page, id)).actualStart).toBe('2027-05-13T07:00');
});

test('paneel: beperkingsdatum toont het datumdeel en weigert leegmaken', async ({ page, ops: _ops }) => {
  const id = await openShowcaseTask(page);
  const rail = page.locator('[data-ops-rail]');
  const constraintSelect = rail.locator('select').filter({ has: page.locator('option[value="SNET"]') }).first();
  await constraintSelect.scrollIntoViewIfNeeded();
  await constraintSelect.selectOption('SNET');
  await expect.poll(() => taskFacts(page, id).then(task => task.constraint)).toEqual({ type: 'SNET', date: '2027-03-01T07:00' });

  const date = railGroup(page, 'Constraint date');
  await expect.poll(() => segments(date)).toBe('01-03-2027');
  await date.locator('input').first().click();
  await page.keyboard.press('Tab');
  expect((await taskFacts(page, id)).constraint).toEqual({ type: 'SNET', date: '2027-03-01T07:00' });

  await date.locator('input').nth(2).click();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace');
  await rail.getByText('Start', { exact: true }).first().click();
  await expect.poll(() => segments(date)).toBe('01-03-2027');
  expect((await taskFacts(page, id)).constraint).toEqual({ type: 'SNET', date: '2027-03-01T07:00' });
});

test('paneel: een leeggemaakte taaknaam wordt niet vastgelegd', async ({ page, ops: _ops }) => {
  const id = await openShowcaseTask(page);
  const rail = page.locator('[data-ops-rail]');
  const name = rail.locator('input[value="' + TASK + '"]').first();
  await name.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  expect((await taskFacts(page, id)).name).toBe(TASK);
  await rail.getByText('Start', { exact: true }).first().click();
  expect((await taskFacts(page, id)).name).toBe(TASK);
  await expect(rail.locator('input[value="' + TASK + '"]')).toHaveCount(1);
});

test('Taak bewerken: met Tab door Startdatum naar Duur en Opslaan laat de start ongemoeid', async ({ page, ops: _ops }) => {
  const id = await openShowcaseTask(page);
  await page.evaluate((taskId) => {
    window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: taskId });
  }, id);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const startGroup = dialog.getByRole('group', { name: 'Start date', exact: true });
  await expect.poll(() => segments(startGroup)).toBe('13-05-2027');

  // Vanaf Naam met Tab naar het duurveld; het pad loopt door het dag-vakje van Startdatum.
  let passedStart = false;
  for (let i = 0; i < 40; i++) {
    const info = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        duration: !!active?.hasAttribute('data-ops-duration-value'),
        inStart: !!active?.closest('[role="group"][aria-label="Start date"]'),
      };
    });
    if (info.inStart) passedStart = true;
    if (info.duration) break;
    await page.keyboard.press('Tab');
  }
  expect(passedStart).toBe(true);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('6');
  await page.keyboard.press('Tab');
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();

  const after = await taskFacts(page, id);
  expect(after.scheduleStart).toBe('2027-03-01T07:00');
  expect(after.scheduleDuration).toBe(6);
  await recalc(page);
  expect(await cpmError(page)).toBeNull();
});

test('Taak bewerken: Startdatum leegmaken en Opslaan behoudt de start', async ({ page, ops: _ops }) => {
  const id = await openShowcaseTask(page);
  await page.evaluate((taskId) => {
    window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: taskId });
  }, id);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const startGroup = dialog.getByRole('group', { name: 'Start date', exact: true });
  await expect.poll(() => segments(startGroup)).toBe('13-05-2027');

  await startGroup.locator('input').nth(2).click();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace');
  await expect.poll(() => segments(startGroup)).toBe('__-__-__');
  await dialog.getByText('Start date', { exact: true }).click();
  await expect.poll(() => segments(startGroup)).toBe('13-05-2027');
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();

  expect((await taskFacts(page, id)).scheduleStart).toBe('2027-03-01T07:00');
  await recalc(page);
  expect(await cpmError(page)).toBeNull();
});
