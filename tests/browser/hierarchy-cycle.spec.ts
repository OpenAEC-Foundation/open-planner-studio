// Verhangen dat via een fase een kring maakt (audit taakmutaties, rapport S4): Grondwerk → Keuring en
// Keuring → Fundering. Hang Fundering onder Grondwerk en Grondwerk wordt een fase: haar relatie geldt
// dan ook voor Fundering, dus Fundering → Keuring → Fundering. Voorheen ging de verhanging stil door
// en liep pas F5 vast. Nu weigert elke verhangroute vooraf, met een melding die de kring noemt.
//
// Fixture (taken + relaties) via de brug; de geteste handeling is echte bediening: klik + Alt+Shift+→,
// een rijsleep met de muis, en "Taak bewerken" via het contextmenu met de ouderkeuzelijst en Opslaan.
import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';

const CYCLE = 'Fundering → Keuring → Fundering';

function taskRow(page: Page, taskId: string): Locator {
  return page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`,
  );
}

function nameCell(page: Page, taskId: string): Locator {
  return taskRow(page, taskId).locator('[data-grid-data-cell="true"][data-grid-column-id="task.name"]');
}

async function rowCenter(row: Locator): Promise<{ x: number; y: number }> {
  const bounds = await row.boundingBox();
  expect(bounds).not.toBeNull();
  return { x: bounds!.x + Math.min(120, bounds!.width / 2), y: bounds!.y + bounds!.height / 2 };
}

/** Grondwerk (optioneel met kind Uitzetten), Fundering, Keuring; Grondwerk → Keuring → Fundering. */
async function seedS4(page: Page, withChild: boolean): Promise<Record<string, string>> {
  const [grondwerk, fundering, keuring] = await seedProject(page, [
    { name: 'Grondwerk', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Fundering', start: '2026-09-21', finish: '2026-09-25', durationDays: 5 },
    { name: 'Keuring', start: '2026-09-14', finish: '2026-09-18', durationDays: 5 },
  ]);
  const uitzetten = await page.evaluate(({ a, b, c, child }) => {
    const s = window.__OPS__!.store.getState();
    const id = child ? s.addTask({ name: 'Uitzetten', parentId: a }) : '';
    s.addSequence({ predecessorId: a, successorId: c, type: 'FINISH_START', lagDays: 0 });
    s.addSequence({ predecessorId: c, successorId: b, type: 'FINISH_START', lagDays: 0 });
    s.runCPM();
    window.__OPS__!.store.setState(st => { st.ui.notifications = []; });
    return id;
  }, { a: grondwerk, b: fundering, c: keuring, child: withChild });
  return { grondwerk, fundering, keuring, uitzetten };
}

async function parentOf(page: Page, taskId: string): Promise<string | null> {
  return page.evaluate(id => window.__OPS__!.store.getState().tasks.find(task => task.id === id)!.parentId, taskId);
}

async function calculationError(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.runCPM();
    return window.__OPS__!.store.getState().cpmResult?.error;
  });
}

test('inspringen met Alt+Shift+→ onder de eigen voorganger-fase wordt geweigerd met een kringmelding', async ({ page, ops: _ops }) => {
  const ids = await seedS4(page, false);
  const before = await state(page);

  await nameCell(page, ids.fundering).click();
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([ids.fundering]);
  await page.keyboard.press('Alt+Shift+ArrowRight');

  // De toetsafhandeling is synchroon: na de toetsdruk staat de uitkomst al in de store.
  expect(await parentOf(page, ids.fundering)).toBeNull();
  expect((await state(page)).undoDepth).toBe(before.undoDepth);
  await expect(page.locator('.ops-toast', { hasText: CYCLE })).toBeVisible();
  expect(await calculationError(page)).toBeUndefined();
});

test('een rij met de muis in de fase slepen wordt geweigerd met een kringmelding', async ({ page, ops: _ops }) => {
  const ids = await seedS4(page, true);
  const before = await state(page);

  // Midden op de faserij = "erin nestelen" (zie useTableRowDrag: 25/50/25).
  const source = await rowCenter(taskRow(page, ids.fundering));
  const targetRow = taskRow(page, ids.grondwerk);
  const target = await rowCenter(targetRow);
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await expect(targetRow).toHaveAttribute('data-grid-drop-zone', 'nest');
  await page.mouse.up();

  expect(await parentOf(page, ids.fundering)).toBeNull();
  expect((await state(page)).undoDepth).toBe(before.undoDepth);
  await expect(page.locator('.ops-toast', { hasText: CYCLE })).toBeVisible();
  expect(await calculationError(page)).toBeUndefined();
});

test('Taak bewerken: een bovenliggende taak die een kring maakt, wordt vóór het opslaan geweigerd', async ({ page, ops: _ops }) => {
  const ids = await seedS4(page, false);
  const before = await state(page);

  // Rechtsklik op de rij ⇒ "Bewerken…" (F2 op een rastercel bewerkt de cel zelf).
  await nameCell(page, ids.fundering).click({ button: 'right' });
  await page.getByRole('button', { name: /^(Edit|Bewerken)\.\.\.$/ }).click();
  const dialog = page.locator('[data-ops-task-dialog]');
  await expect(dialog).toBeVisible();
  // Het naamveld krijgt bij openen de focus (geen gekoppeld label); het is het eerste invoerveld.
  const name = dialog.locator('input').first();
  await expect(name).toBeFocused();
  await name.fill('Fundering (gewijzigd)');
  await dialog.getByLabel(/^(Parent task|Bovenliggende taak)$/).click();
  await page.getByRole('option', { name: /Grondwerk$/ }).click();
  await dialog.getByRole('button', { name: /^(Save|Opslaan)$/ }).click();

  // De melding noemt de kring (met de huidige taaknaam), de dialoog blijft open om te corrigeren,
  // en er is niets opgeslagen: geen ouder, geen naam, geen undo-stap.
  await expect(page.locator('.ops-toast', { hasText: CYCLE })).toBeVisible();
  await expect(dialog).toBeVisible();
  expect(await parentOf(page, ids.fundering)).toBeNull();
  const after = await state(page);
  expect(after.tasks.find(task => task.id === ids.fundering)?.name).toBe('Fundering');
  expect(after.undoDepth).toBe(before.undoDepth);

  // Terug naar "geen" en opnieuw opslaan: nu gaat de rest van de bewerking gewoon door.
  await dialog.getByLabel(/^(Parent task|Bovenliggende taak)$/).click();
  await page.getByRole('option', { name: /None \(root\)|Geen \(root\)/ }).click();
  await dialog.getByRole('button', { name: /^(Save|Opslaan)$/ }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => state(page).then(s => s.tasks.find(task => task.id === ids.fundering)?.name))
    .toBe('Fundering (gewijzigd)');
});
