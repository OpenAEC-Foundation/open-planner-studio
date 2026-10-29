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

  // "Verplaats naar…" staat onder de uitklapknop op de resourcenaam.
  await page.locator('[data-ops-assignment-row] [data-ops-assignment-expand]').first().click();
  const move = page.locator('[data-ops-assignment-row] [data-ops-assignment-move]').first();
  const trigger = move.getByRole('button');
  await expect(move).toBeVisible();
  // Dicht: geen kandidatenlijst in de DOM (eigen keuzelijst, nooit native — eigenaar 2026-10-15).
  await expect(move).toHaveAttribute('data-ops-assignment-move', 'closed');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  // Luiheid zelf: er IS een kandidaat (B), maar vóór focus is er geen enkele optie gebouwd. Ook een
  // nieuwe render van het blok (fixture: inzet wijzigen via de brug) bouwt de lijst niet.
  await expect(move).toHaveAttribute('data-ops-assignment-move-options', '0');
  await page.evaluate((r) => {
    const s = window.__OPS__!.store.getState();
    const asg = s.assignments.find(x => x.resourceId === r)!;
    s.updateAssignment(asg.id, { unitsPerDay: 1.5 });
  }, resourceId);
  await expect(page.locator('[data-ops-assignment-row] input').first()).toHaveValue(/^1[.,]5$/);
  await expect(move).toHaveAttribute('data-ops-assignment-move-options', '0');

  // Focus (Tab-route) bouwt de lijst, nog zonder hem te openen.
  await trigger.focus();
  await expect(move).toHaveAttribute('data-ops-assignment-move-options', '1');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  // Focus weg ⇒ de lijst valt weer weg. (Klik op de kop: een klik op de naam zou de details dichtklappen.)
  await page.locator('[data-ops-assignment-header]').click();
  await expect(move).toHaveAttribute('data-ops-assignment-move-options', '0');

  // Openen met de muis bouwt de lijst: alleen B (C draagt de resource al, A is de bron).
  await trigger.click();
  await expect(move).toHaveAttribute('data-ops-assignment-move', 'open');
  const listbox = page.getByRole('listbox');
  await expect(listbox.getByRole('option')).toHaveCount(1);
  await expect(listbox.locator(`[data-value="${b}"]`)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(listbox).toHaveCount(0);

  // Kiezen met een echte klik op de optie.
  await trigger.click();
  await listbox.locator(`[data-value="${b}"]`).click();
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
  await page.locator('[data-ops-assignment-row] [data-ops-assignment-expand]').first().click();
  await expect(page.locator('[data-ops-assignment-details]')).toBeVisible();
  await expect(page.locator('[data-ops-assignment-move]')).toHaveCount(0);
});
