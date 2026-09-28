import { expect, seedProject, test } from './fixtures/ops';

// Nivelleren op de achtergrond (audit 2026-09-26): de nivelleer-dialoog rekent in een Web Worker.
// Fixture via de brug (twee overlappende taken op één ploeg van 1); de geteste handelingen zijn echte
// klikken: lintknop, Berekenen, Toepassen. Bewijs dat de worker-route het voorstel levert en dat
// Toepassen het conflict oplost (store-asserties, geen pixels).

test('nivelleer-dialoog: berekenen via de worker levert een voorstel; toepassen lost het conflict op', async ({ page, ops: _ops }) => {
  const [first, second] = await seedProject(page, [
    { name: 'Metselen', start: '2026-09-07', finish: '2026-09-09', durationDays: 3 },
    { name: 'Voegen', start: '2026-09-07', finish: '2026-09-09', durationDays: 3 },
  ]);
  await page.evaluate(([a, b]) => {
    const s = window.__OPS__!.store.getState();
    // seedProject maakt handmatig geplande taken (die volgen de nivellering niet); hier automatisch.
    for (const id of [a, b]) s.updateTask(id, { manuallyScheduled: false });
    const resourceId = s.addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 });
    s.assignResource(a, resourceId, 1);
    s.assignResource(b, resourceId, 1);
    s.runCPM();
  }, [first, second]);
  await page.locator('[data-ops-ribbon-tab="resources"]').click();
  await page.locator('[data-ops-ribbon-item="levelResources"]').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  // Het voorstel verschijnt (de worker heeft gerekend): één taak schuift drie werkdagen op.
  await expect(dialog.locator('table tbody tr')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: /^(Stoppen|Stop)$/ })).toHaveCount(0);

  await dialog.getByRole('button', { name: /^(Toepassen|Apply)$/ }).click();
  await expect(dialog).toBeHidden();
  const starts = await page.evaluate(([a, b]) => {
    const s = window.__OPS__!.store.getState();
    return [a, b].map(id => s.tasks.find(t => t.id === id)!.time.earlyStart).sort();
  }, [first, second]);
  expect(starts[0]).toBe('2026-09-07');
  expect(starts[1] > '2026-09-09').toBe(true);
});

test('nivelleer-dialoog: tijdens een lange berekening blijft de dialoog bedienbaar en stopt "Stoppen" hem', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Start', start: '2026-09-07', finish: '2026-09-07', durationDays: 1 }]);
  // Fixture in één stap: het ingebouwde benchmarkproject (8000 taken, resources, toewijzingen) — groot
  // genoeg dat nivelleren seconden duurt, zodat de achtergrond en het stoppen waarneembaar zijn.
  await page.evaluate(async () => {
    const { generateBenchmarkProject } = await import('/src/services/benchmark/generateProject.ts' as string);
    const s = window.__OPS__!.store.getState();
    s.applyLoadedProject(generateBenchmarkProject(8000), { filePath: null, recompute: true });
  });

  await page.locator('[data-ops-ribbon-tab="resources"]').click();
  await page.locator('[data-ops-ribbon-item="levelResources"]').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();

  const status = dialog.getByRole('status');
  await expect(status).toBeVisible();
  // De UI-thread is vrij: de smoothing-optie is gewoon aan te klikken en stopt de lopende berekening
  // (die hoort bij de oude opties).
  await dialog.getByRole('checkbox').first().click();
  await expect(status).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ })).toBeEnabled();

  // Opnieuw starten en expliciet stoppen: geen voorstel, Toepassen blijft uit.
  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  await expect(status).toBeVisible();
  await dialog.getByRole('button', { name: /^(Stoppen|Stop)$/ }).click();
  await expect(status).toHaveCount(0);
  await expect(dialog.locator('table tbody tr')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /^(Toepassen|Apply)$/ })).toBeDisabled();
});
