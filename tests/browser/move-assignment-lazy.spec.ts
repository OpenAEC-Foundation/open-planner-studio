import { expect, seedProject, test } from './fixtures/ops';

// "Verplaats naar…" bouwt zijn opties pas bij openen (prestatiemeting rehab-2, 2026-10-07: de lijst
// per render kostte 47 s per selectie). Fixture via de brug; de geteste handelingen zijn een echte
// muisklik op de keuzelijst en een echte optiekeuze. Asserties op de DOM (aantal opties) en de store.

test('verplaats naar…: opties pas na openen, keuze verplaatst de toewijzing', async ({ page, ops: _ops }) => {
  const [a, b, c] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
    { name: 'Voegwerk', start: '2026-09-11', finish: '2026-09-14', durationDays: 2 },
    { name: 'Schilderwerk', start: '2026-09-15', finish: '2026-09-16', durationDays: 2 },
  ]);
  const resourceId = await page.evaluate(({ a, c }) => {
    const s = window.__OPS__!.store.getState();
    const r = s.addResource({ name: 'Metselploeg', type: 'LABOR', description: '', maxUnits: 2 });
    s.assignResource(a, r, 1);
    // C heeft de resource al ⇒ geen kandidaat; B wel.
    s.assignResource(c, r, 1);
    s.runCPM();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(a);
    return r;
  }, { a, c });

  const move = page.locator('[data-ops-assignment-row] [data-ops-assignment-move]').first();
  await expect(move).toBeVisible();
  // Dicht: alleen de plaatshouder, geen kandidatenlijst in de DOM.
  await expect(move).toHaveAttribute('data-ops-assignment-move', 'closed');
  await expect(move.locator('option')).toHaveCount(1);

  // Openen met de muis bouwt de lijst: plaatshouder + B (C draagt de resource al, A is de bron).
  await move.click();
  await expect(move).toHaveAttribute('data-ops-assignment-move', 'open');
  await expect(move.locator('option')).toHaveCount(2);
  await expect(move.locator(`option[value="${b}"]`)).toHaveCount(1);
  await page.keyboard.press('Escape');

  await move.selectOption(b);
  const owners = await page.evaluate((r) => window.__OPS__!.store.getState().assignments
    .filter(x => x.resourceId === r).map(x => x.taskId).sort(), resourceId);
  expect(owners).toEqual([b, c].sort());
});

test('verplaats naar…: zonder kandidaat geen keuzelijst', async ({ page, ops: _ops }) => {
  const [a, b] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
    { name: 'Voegwerk', start: '2026-09-11', finish: '2026-09-14', durationDays: 2 },
  ]);
  await page.evaluate(({ a, b }) => {
    const s = window.__OPS__!.store.getState();
    const r = s.addResource({ name: 'Metselploeg', type: 'LABOR', description: '', maxUnits: 2 });
    s.assignResource(a, r, 1);
    s.assignResource(b, r, 1);
    s.runCPM();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(a);
  }, { a, b });
  await expect(page.locator('[data-ops-assignment-row]')).toHaveCount(1);
  await expect(page.locator('[data-ops-assignment-move]')).toHaveCount(0);
});
