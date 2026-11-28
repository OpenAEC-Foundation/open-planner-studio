import { expect, seedProject, test } from './fixtures/ops';

test('statusbalkteller opent het waarschuwingenpaneel en een rij springt naar de taak', async ({ page, ops: _ops }) => {
  const [first, second] = await seedProject(page, [
    { name: 'Grondwerk', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Fundering', start: '2026-09-21', finish: '2026-10-02' },
  ]);

  await page.evaluate(({ a, b }) => {
    const s = window.__OPS__!.store.getState();
    s.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    s.updateTask(b, { deadline: '2026-09-25' });
    s.runCPM();
    s.deselectAll();
  }, { a: first, b: second });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().cpmResult?.missedDeadlineTaskIds.length ?? 0)).toBe(1);

  await expect(page.locator('[data-ops-warnings-panel]')).toHaveCount(0);
  await page.locator('[data-ops-status-warning="missedDeadlines"]').click();
  const panel = page.locator('[data-ops-warnings-panel]');
  await expect(panel).toBeVisible();

  const row = panel.locator(`[data-ops-warning-id="missedDeadline:${second}"]`);
  await expect(row).toBeVisible();
  await expect(row).toContainText('Fundering');

  await row.click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([second]);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().activeTaskId)).toBe(second);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().view.pendingFocusTaskId ?? null)).toBeNull();
  await expect(row).toHaveAttribute('aria-current', 'true');

  await page.evaluate((b) => {
    window.__OPS__!.store.getState().updateTask(b, { deadline: undefined });
  }, second);
  await expect(panel.locator('[data-ops-warnings-stale]')).toBeVisible();

  await page.locator('[data-ops-warnings-close]').click();
  await expect(page.locator('[data-ops-warnings-panel]')).toHaveCount(0);
  await expect(page.locator('[data-ops-rail]')).toBeVisible();
});

test('overbezette resource opent de histogramstrook op die resource', async ({ page, ops: _ops }) => {
  const [first, second] = await seedProject(page, [
    { name: 'Kraan links', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Kraan rechts', start: '2026-09-07', finish: '2026-09-18' },
  ]);
  const resourceId = await page.evaluate(({ a, b }) => {
    const s = window.__OPS__!.store.getState();
    const id = s.addResource({ name: 'Torenkraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
    s.assignResource(a, id, 1);
    s.assignResource(b, id, 1);
    s.setUI({ showHistogram: false, showWarningsPanel: true });
    s.runCPM();
    return id;
  }, { a: first, b: second });

  const row = page.locator(`[data-ops-warning-id="overallocation:${resourceId}"]`);
  await expect(row).toBeVisible();
  await expect(row).toContainText('Torenkraan');
  await row.click();
  await expect.poll(() => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return { on: s.ui.showHistogram, id: s.view.histogramResourceId ?? null, sel: [...s.selectedTaskIds].sort() };
  })).toEqual({ on: true, id: resourceId, sel: [first, second].sort() });
  await expect(page.getByText(/No resources yet|Nog geen resources/)).toHaveCount(0);
});
