// Voortgang van een fase (verzameltaak) via echte browser-events: de paneelschuif is op een fase
// uitgeschakeld, de voortgangscel van een faserij in de Tabel weigert met een reden, en de
// fasevoortgang in de Tabel volgt na een kind-wijziging + F5. Hetzelfde voor de werkelijke datums
// van een fase: vroegste werkelijke start van de bladen, laatste werkelijke einde pas als alle bladen
// klaar zijn, alleen-lezen in Tabel en paneel. De brug zet alleen de fixture neer (project,
// kolomkeuze, zichtbaarheid van het paneel) en leest de state; de geteste handelingen zijn gewone
// klikken en toetsen.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

interface PhaseIds { phase: string; a: string; b: string }

/** Fase met twee bladen van elk 5 werkdagen, beide vanaf de projectstart; statusdatum erna. */
async function seedPhase(page: Page): Promise<PhaseIds> {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ name: 'Fasevoortgang', startDate: '2026-09-07', statusDate: '2026-09-30' });
    s.setViewStartDate('2026-09-07');
    const phase = s.addTask({ name: 'Fase ruwbouw' });
    const leaf = (name: string) => {
      const id = window.__OPS__!.store.getState().addTask({ name, parentId: phase });
      const current = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
      window.__OPS__!.store.getState().updateTask(id, { time: { ...current.time, scheduleDuration: 5 } });
      return id;
    };
    const a = leaf('Fundering');
    const b = leaf('Metselwerk');
    window.__OPS__!.store.getState().runCPM();
    return { phase, a, b };
  });
}

function completionOf(page: Page, id: string): Promise<number | undefined> {
  return page.evaluate(taskId => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)?.time.completion, id);
}

function taskCell(page: Page, taskId: string, columnId: string): Locator {
  return page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"] `
    + `[data-grid-data-cell="true"][data-grid-column-id="${columnId}"]`,
  );
}

function completionCell(page: Page, taskId: string): Locator {
  return taskCell(page, taskId, 'task.time.completion');
}

function actualsOf(page: Page, id: string): Promise<{ as: string | null; af: string | null }> {
  return page.evaluate((taskId) => {
    const t = window.__OPS__!.store.getState().tasks.find(task => task.id === taskId)!;
    return { as: t.time.actualStart ?? null, af: t.time.actualFinish ?? null };
  }, id);
}

test('paneel: de voortgangsschuif is op een fase uitgeschakeld en weigert muis en toetsen', async ({ page, ops: _ops }) => {
  const ids = await seedPhase(page);
  await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    s.selectTask(id);
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
  }, ids.phase);

  const slider = page.locator('[data-ops-progress-slider]');
  await expect(slider).toBeVisible();
  await expect(slider).toBeDisabled();
  await expect(page.locator('[data-ops-summary-progress-note]')).toBeVisible();

  // Een echte klik rechts op de (uitgeschakelde) schuif, plus End: de fase blijft op 0%.
  const box = await slider.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width - 2, box!.y + box!.height / 2);
  await page.keyboard.press('End');
  expect(await completionOf(page, ids.phase)).toBe(0);

  // Op een blad werkt dezelfde schuif gewoon (controle dat de test de echte bediening raakt).
  await page.evaluate((id) => window.__OPS__!.store.getState().selectTask(id), ids.a);
  await expect(slider).toBeEnabled();
  await expect(page.locator('[data-ops-summary-progress-note]')).toHaveCount(0);
  await slider.focus();
  await page.keyboard.press('End');
  await expect.poll(() => completionOf(page, ids.a)).toBe(1);
});

test('Tabel: fasevoortgang is alleen-lezen en volgt na kind-wijziging + F5', async ({ page, ops: _ops }) => {
  const ids = await seedPhase(page);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(page.locator('[data-task-grid-surface-id="full-task-grid"] [role="grid"]')).toBeVisible();

  const phaseCell = completionCell(page, ids.phase);
  await expect(phaseCell).toHaveText(/^0%$/);
  await expect(phaseCell).toHaveAttribute('data-grid-readonly', 'true');

  // Bewerken op de faserij: geweigerd, met de reden in beeld.
  await phaseCell.click();
  await page.keyboard.press('Enter');
  await expect(phaseCell.locator('input')).toHaveCount(0);
  await expect(page.locator('.full-task-grid-error[role="alert"]'))
    .toHaveText(/derived from its subtasks|afgeleid uit de onderliggende taken/);

  // De kinderen wél: A 100%, B 50%.
  for (const [id, value] of [[ids.a, '100'], [ids.b, '50']] as const) {
    const cell = completionCell(page, id);
    await cell.click();
    await page.keyboard.press('Enter');
    const input = cell.locator('input');
    await expect(input).toBeFocused();
    await input.fill(value);
    await page.keyboard.press('Enter');
  }
  await expect.poll(() => completionOf(page, ids.b)).toBe(0.5);
  // Plannen is handmatig: vóór F5 staat de fase nog op de oude berekening.
  await expect(phaseCell).toHaveText(/^0%$/);

  await page.keyboard.press('F5');
  // (5 × 1 + 5 × 0.5) / 10 = 75%, ook in de opgeslagen state.
  await expect(phaseCell).toHaveText(/^75%$/);
  expect(await completionOf(page, ids.phase)).toBe(0.75);
});

test('fase: werkelijke datums volgen de bladen na F5 en zijn alleen-lezen in Tabel en paneel', async ({ page, ops: _ops }) => {
  const ids = await seedPhase(page);
  // Fixture: de twee werkelijke-datumkolommen staan niet in de standaardset van de Tabel; dezelfde
  // voorkeur als via de kolomkiezer, zonder de kiezerdialoog zelf te bedienen.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const columns = s.taskGridSurfaces['full-task-grid'].columns;
    s.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'task.time.actualStart', width: 120, pinned: false } as unknown as (typeof columns)[number],
      { id: 'task.time.actualFinish', width: 120, pinned: false } as unknown as (typeof columns)[number],
    ]);
  });
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(page.locator('[data-task-grid-surface-id="full-task-grid"] [role="grid"]')).toBeVisible();

  const typeDate = async (taskId: string, columnId: string, text: string) => {
    const cell = taskCell(page, taskId, columnId);
    await cell.click();
    await page.keyboard.press('Enter');
    const input = cell.locator('input[data-task-editor-kind]');
    await expect(input).toBeFocused();
    await input.fill(text);
    await page.keyboard.press('Enter');
  };
  const phaseStart = taskCell(page, ids.phase, 'task.time.actualStart');
  const phaseFinish = taskCell(page, ids.phase, 'task.time.actualFinish');

  // Beide bladen beginnen (Metselwerk later dan Fundering); nog niets klaar.
  await typeDate(ids.a, 'task.time.actualStart', '08-09-2026');
  await typeDate(ids.b, 'task.time.actualStart', '10-09-2026');
  await expect.poll(async () => (await actualsOf(page, ids.b)).as?.slice(0, 10)).toBe('2026-09-10');
  // Plannen is handmatig: vóór F5 heeft de fase nog geen werkelijke start.
  await expect(phaseStart).not.toHaveText(/\d/);

  await page.keyboard.press('F5');
  await expect(phaseStart).toHaveText(/08-09-2026/);
  await expect(phaseFinish).not.toHaveText(/\d/);
  await expect(phaseStart).toHaveAttribute('data-grid-readonly', 'true');
  expect((await actualsOf(page, ids.phase)).as).toBe((await actualsOf(page, ids.a)).as);

  // Bewerken op de faserij: geweigerd, met de reden in beeld.
  await phaseStart.click();
  await page.keyboard.press('Enter');
  await expect(phaseStart.locator('input')).toHaveCount(0);
  await expect(page.locator('.full-task-grid-error[role="alert"]'))
    .toHaveText(/derived from its subtasks|afgeleid uit de onderliggende taken/);

  // Eén blad klaar: nog geen fase-einde. Beide klaar: het LAATSTE einde.
  await typeDate(ids.a, 'task.time.actualFinish', '11-09-2026');
  await page.keyboard.press('F5');
  await expect(phaseFinish).not.toHaveText(/\d/);
  await typeDate(ids.b, 'task.time.actualFinish', '14-09-2026');
  await expect.poll(async () => (await actualsOf(page, ids.b)).af?.slice(0, 10)).toBe('2026-09-14');
  await page.keyboard.press('F5');
  await expect(phaseFinish).toHaveText(/14-09-2026/);
  await expect(phaseStart).toHaveText(/08-09-2026/);
  expect(await actualsOf(page, ids.phase)).toEqual({
    as: (await actualsOf(page, ids.a)).as,
    af: (await actualsOf(page, ids.b)).af,
  });

  // Paneel: klik de faserij aan; de werkelijke datums tonen de afgeleide waarde en zijn uitgeschakeld.
  await taskCell(page, ids.phase, 'task.name').click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([ids.phase]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showPropertiesPanel: true, rightPanelCollapsed: false }));
  const startGroup = page.getByRole('group', { name: /^(Actual start|Werkelijke start)$/ });
  await expect(startGroup).toBeVisible();
  await expect(startGroup).toHaveAttribute('aria-disabled', 'true');
  const startSegments = startGroup.locator('input');
  await expect(startSegments).toHaveCount(3);
  expect(await startSegments.evaluateAll(els => els.map(el => (el as HTMLInputElement).value).sort()))
    .toEqual(['08', '09', '2026'].sort());
  const finishGroup = page.getByRole('group', { name: /^(Actual finish|Werkelijke einde)$/ });
  await expect(finishGroup).toHaveAttribute('aria-disabled', 'true');
  expect(await finishGroup.locator('input').evaluateAll(els => els.map(el => (el as HTMLInputElement).value).sort()))
    .toEqual(['09', '14', '2026'].sort());
});
