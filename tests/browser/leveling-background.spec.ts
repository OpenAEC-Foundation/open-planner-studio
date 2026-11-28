import { expect, seedProject, test } from './fixtures/ops';
import type { GeneratedProject } from '@/services/benchmark/generateProject';

test('nivelleer-dialoog: berekenen via de worker levert een voorstel; toepassen lost het conflict op', async ({ page, ops: _ops }) => {
  test.slow();
  const [first, second] = await seedProject(page, [
    { name: 'Metselen', start: '2026-09-07', finish: '2026-09-09', durationDays: 3 },
    { name: 'Voegen', start: '2026-09-07', finish: '2026-09-09', durationDays: 3 },
  ]);
  await page.evaluate(([a, b]) => {
    const s = window.__OPS__!.store.getState();
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

  const conflictHint = 'Resource conflicts remain for these tasks. See the details below.';
  const noChanges = 'No tasks need to move — the schedule is already conflict-free.';
  await dialog.getByRole('button', { name: /^(Annuleren|Cancel)$/ }).click();
  await page.evaluate(ids => {
    const s = window.__OPS__!.store.getState();
    for (const id of ids) s.updateTask(id, { priority: 1000 });
    s.runCPM();
  }, [first, second]);
  await page.locator('[data-ops-ribbon-item="levelResources"]').first().click();
  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  await expect(dialog.getByText(conflictHint, { exact: true })).toBeVisible();
  await expect(dialog.getByText(noChanges, { exact: true })).toHaveCount(0);
  await expect(dialog.locator('table tbody tr')).toHaveCount(0);
  await expect(dialog.getByText('Metselen', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Voegen', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: /^(Annuleren|Cancel)$/ }).click();
  await page.evaluate(ids => {
    const s = window.__OPS__!.store.getState();
    for (const id of ids) s.updateTask(id, { priority: 500 });
    s.runCPM();
  }, [first, second]);
  await page.locator('[data-ops-ribbon-item="levelResources"]').first().click();
  await dialog.getByRole('checkbox').first().check();
  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  await expect(dialog.getByText(conflictHint, { exact: true })).toBeVisible();
  await expect(dialog.getByText(noChanges, { exact: true })).toHaveCount(0);
  await dialog.getByRole('checkbox').first().uncheck();

  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  await expect(dialog.locator('table tbody tr')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: /^(Stoppen|Stop)$/ })).toHaveCount(0);

  await dialog.getByRole('button', { name: /^(Toepassen|Apply)$/ }).click();
  await expect(dialog).toBeHidden();
  const starts = await page.evaluate(([a, b]) => {
    const s = window.__OPS__!.store.getState();
    return [a, b].map(id => s.tasks.find(t => t.id === id)!.time.earlyStart).sort();
  }, [first, second]);
  expect(starts[0]).toBe("2026-09-07T07:00");
  expect(starts[1] > '2026-09-09').toBe(true);

  await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    const resourceId = s.addResource({ name: 'Kleine ploeg', type: 'LABOR', description: '', maxUnits: 1 });
    s.assignResource(id, resourceId, 2);
    s.runCPM();
  }, first);
  await page.locator('[data-ops-ribbon-item="levelResources"]').first().click();
  await expect(dialog.getByRole('checkbox').first()).not.toBeChecked();
  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  await expect(dialog.getByText(conflictHint, { exact: true })).toBeVisible();
  await expect(dialog.getByText(noChanges, { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Kleine ploeg peaks at 2 units/day, capacity is 1 — cannot be resolved by shifting.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: /^(Annuleren|Cancel)$/ }).click();

  await page.evaluate(id => {
    const ops = window.__OPS__!;
    const s = ops.store.getState();
    const resourceId = s.resources.find(r => r.name === 'Kleine ploeg')!.id;
    s.updateResource(resourceId, {
      name: 'Importploeg', availabilitySteps: [{ from: '2026-01-01', maxUnits: 2 }],
    });
    ops.store.setState(st => {
      const assignment = st.assignments.find(a => a.taskId === id && a.resourceId === resourceId)!;
      assignment.unitsPerDay = 1;
      assignment.remainingWorkMinutes = 3 * 3 * 8 * 60;
    });
    s.runCPM();
  }, first);
  await page.locator('[data-ops-ribbon-item="levelResources"]').first().click();
  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  await expect(dialog.getByText('Importploeg peaks at 3 units/day, capacity is 2 — cannot be resolved by shifting.', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/\{\{(?:resource|peak|capacity)\}\}/)).toHaveCount(0);
  await dialog.getByRole('button', { name: /^(Annuleren|Cancel)$/ }).click();

  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    for (const resource of s.resources) s.updateResource(resource.id, { maxUnits: 100, availabilitySteps: [] });
    for (const task of s.tasks) s.updateTask(task.id, { levelingDelay: 0 });
    s.runCPM();
  });
  await page.locator('[data-ops-ribbon-item="levelResources"]').first().click();
  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  await expect(dialog.getByText(noChanges, { exact: true })).toBeVisible();
  await expect(dialog.getByText(conflictHint, { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: /^(Annuleren|Cancel)$/ }).click();

  await page.evaluate(async () => {
    const { generateBenchmarkProject } = await import('/src/services/benchmark/generateProject.ts' as string);
    const fixture: GeneratedProject = generateBenchmarkProject(160);
    const template = window.__OPS__!.store.getState().tasks[0];
    fixture.tasks = Array.from({ length: 160 }, (_, index) => ({
      ...template,
      id: `preview-${index}`,
      name: `Voorstel ${String(index).padStart(3, '0')}`,
      parentId: null,
      childIds: [],
      isSummary: false,
      manuallyScheduled: false,
      priority: 500,
      time: { ...template.time, scheduleDuration: 1, scheduleStart: fixture.project.startDate, scheduleFinish: fixture.project.startDate },
    }));
    fixture.sequences = [];
    fixture.resources = [{ ...fixture.resources[0], id: 'preview-resource', name: 'Voorstelploeg', maxUnits: 1 }];
    fixture.assignments = fixture.tasks.map(task => ({ id: `assignment-${task.id}`, taskId: task.id, resourceId: 'preview-resource', unitsPerDay: 1 }));
    window.__OPS__!.store.getState().applyLoadedProject(fixture, { filePath: null, recompute: true });
  });
  await page.locator('[data-ops-ribbon-item="levelResources"]').first().click();
  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  const preview = dialog.locator('[data-ops-leveling-preview]');
  await expect(preview).toBeVisible();
  await expect(preview.locator('table')).toHaveAttribute('aria-rowcount', '160');
  expect(await preview.locator('tbody tr[aria-rowindex]').count()).toBeLessThan(40);
  await expect(preview.getByText('Voorstel 001', { exact: true })).toBeVisible();
  for (const scale of [100, 125]) {
    await page.evaluate(value => window.__OPS__!.store.getState().setUI({ uiFontScale: value }), scale);
    await preview.focus();
    await page.keyboard.press('Control+End');
    await expect(preview.getByText('Voorstel 159', { exact: true })).toBeVisible();
    expect(await preview.locator('tbody tr[aria-rowindex]').count()).toBeLessThan(40);
    await page.keyboard.press('Control+Home');
    await expect(preview.getByText('Voorstel 001', { exact: true })).toBeVisible();
  }
  await dialog.getByRole('button', { name: /^(Toepassen|Apply)$/ }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => {
    const tasks = window.__OPS__!.store.getState().tasks;
    return tasks.filter(task => (task.levelingDelay ?? 0) > 0).length;
  })).toBe(159);
});

test('nivelleer-dialoog: tijdens een lange berekening blijft de dialoog bedienbaar en stopt "Stoppen" hem', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Start', start: '2026-09-07', finish: '2026-09-07', durationDays: 1 }]);
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
  await dialog.getByRole('checkbox').first().click();
  await expect(status).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ })).toBeEnabled();

  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  await expect(status).toBeVisible();
  await dialog.getByRole('button', { name: /^(Stoppen|Stop)$/ }).click();
  await expect(status).toHaveCount(0);
  await expect(dialog.locator('table tbody tr')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /^(Toepassen|Apply)$/ })).toBeDisabled();
});
